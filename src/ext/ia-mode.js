// Mode IA (v63) : interface simplifiée pour piloter l'IA, à côté du Mode BE (l'interface complète, inchangée).
// Un seul écran : le plan + une colonne « parcours » (plan → relevé IA → relecture → hors plan → câbler → alertes →
// résultat), avec un bouton par étape, une seule liste d'alertes (contrôle, doutes du câblage, points introuvables) et
// le résultat (chiffres, dossier PDF, rapport IA, coûts IA et temps BE). Avec ou sans clé : sans clé, les mêmes étapes
// par copier / coller (consigne et réponse). Retouche : bouton « Mode BE » (mêmes données, même chantier).
// Bascule : bouton Mode BE / Mode IA en haut, Alt+M ; préférence « ui » (prefs.js).
import { settings } from "./settings.js";
import { pref, setPref } from "../prefs.js";
import { esc } from "./util.js";
import { describe } from "./controle-ui.js";
import { wiringNow, noteNow } from "./cablage-data.js";
import { cabler } from "./etude-ui.js";
import { buildDossier, downloadBlob } from "./dossier.js";
import { hpState, poserHorsPlan } from "./horsplan-ui.js";
import { releveOf, reportHTML } from "./ai-recheck-ui.js";
import { autoScale } from "./pdf-page.js";
import { MODES } from "../cablage/boites.js";
import { tempsOf, fmtDur, coutTemps, iaUsage, estimateReleve, fmtTok } from "./temps.js";

const LINK_KINDS = new Set(["lum", "cmd", "vv", "int2"]);

export function createIaMode({ api, aiReleve, recheck, ctl }) {
  const main = document.querySelector(".main");
  const pane = document.createElement("aside");
  pane.className = "iapane"; pane.id = "iapane"; pane.setAttribute("aria-label", "Mode IA");
  main.appendChild(pane);
  const sw = document.getElementById("mode-sw");
  let pend = null, busy = "", msg = "", lastDossier = null, t = null;

  const isIa = () => pref("ui") === "ia";
  function setMode(m) {
    setPref("ui", m === "ia" ? "ia" : "be");
    apply();
    if (isIa()) { if (api.tab !== "plan" && api.tab !== "chantiers") api.setTab("plan"); if ((api.cab.boxes || []).length) { api.viewPreset("cab"); api.showCircuits = true; } render(); }
    api.setHint(isIa() ? "Mode IA : suivez le parcours à droite. Alt+M (ou « Mode BE ») pour retoucher le dessin dans l'interface complète." : "Mode BE : interface complète. Alt+M pour revenir au mode IA.");
    document.dispatchEvent(new CustomEvent("okteo:ui", { detail: pref("ui") }));
  }
  function apply() {
    document.body.classList.toggle("mode-ia", isIa());
    if (sw) sw.querySelectorAll("[data-m]").forEach((b) => { b.classList.toggle("on", b.dataset.m === pref("ui")); b.setAttribute("aria-pressed", String(b.dataset.m === pref("ui"))); });
    // la taille du plan change : on redessine quand le navigateur a refait la mise en page
    requestAnimationFrame(() => api.fit && api.fit());
  }
  if (sw) sw.querySelectorAll("[data-m]").forEach((b) => (b.onclick = () => setMode(b.dataset.m)));
  document.addEventListener("keydown", (e) => { if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === "m" || e.key === "M" || e.code === "KeyM")) { e.preventDefault(); setMode(isIa() ? "be" : "ia"); } });

  // ---------- données du parcours ----------
  function alerts() {
    const byId = new Map(api.allApps().map((a) => [a.id, a])), out = [];
    api.control.forEach((it, i) => { const d = describe(api, it, byId); out.push({ src: "ctl", i, it, grave: ["split", "nobox", "int2"].includes(it.kind) ? 2 : 1, title: d.title, who: d.who, what: d.what, ids: it.ids }); });
    let W = null;
    if ((api.cab.boxes || []).length) { try { W = wiringNow(api); } catch { W = null; } }
    (W ? W.doutes || [] : []).forEach((d) => out.push({ src: "doute", grave: d.bloquant ? 3 : 1, title: d.bloquant ? "Doute bloquant" : "Doute", who: d.box || "", what: `${d.rule ? d.rule + " : " : ""}${d.text}`, box: d.box }));
    api.allApps().filter((a) => a.aiNo).forEach((a) => out.push({ src: "ia", grave: 1, title: "Introuvable pour l'IA", who: `${a.rep || a.t}${a.room ? " (" + a.room + ")" : ""}`, what: String(a.aiNo), ids: [a.id] }));
    return { list: out.sort((p, q) => q.grave - p.grave), W };
  }
  function iaPct() {
    const all = (api.cab || {}).releves || {};
    let ok = 0, tot = 0;
    for (const R of Object.values(all)) for (const x of R.rapport || []) if (x.type === "relecture") { ok += x.ok; tot += x.total; }
    return tot ? { ok, tot, pct: Math.round((ok / tot) * 100) } : null;
  }

  // ---------- affichage ----------
  const step = (n, title, state, body) => `<section class="ia-step ${state}" data-s="${n}"><h4><span class="ia-n">${state === "done" ? "✓" : n}</span>${esc(title)}</h4>${body}</section>`;
  async function render() {
    if (!isIa()) return;
    const key = !!settings.activeProvider(), f = api.ch.fond, hasPlan = !!f, cal = !!(f && f.calibre);
    const apps = api.allApps().filter((a) => a.t !== "TAB"), relIa = api.levels.some((l) => releveOf(api, l.id)), rel = relIa || apps.length > 0;
    if (pend == null && hasPlan) recheck.pending().then((n) => { pend = n; render(); }).catch(() => { pend = 0; });
    const hp = hpState(api), hpMiss = hp.list.filter((it) => it.on && (+it.q || 0) > (hp.have[it.t] || 0));
    const boxes = (api.cab.boxes || []).length, A = alerts(), pct = iaPct(), U = iaUsage(api), T = tempsOf(api), CT = coutTemps(T);
    const est = estimateReleve();
    const s1 = hasPlan && cal ? "done" : "todo";
    const s2 = rel ? "done" : s1 === "done" ? "todo" : "wait";
    const s3 = !rel ? "wait" : pend ? "todo" : "done";
    const s4 = !apps.length ? "wait" : api.cab.horsplan ? "done" : "todo";
    const s5 = !apps.length ? "wait" : boxes ? "done" : "todo";
    pane.innerHTML = `<div class="ia-head"><b>Mode IA</b><span class="mut sm">${esc(api.ch.nom || "")}${api.ch.numero ? " · " + esc(api.ch.numero) : ""}</span><span class="grow"></span>
        <button class="mini" id="ia-be" title="Retoucher le dessin dans l'interface complète (Alt+M)">Mode BE</button></div>
      ${msg ? `<p class="ia-msg sm">${esc(msg)}</p>` : ""}
      ${step(1, "Plan du pavillonneur", s1, !hasPlan ? `<p class="sm">Ajoutez le PDF du plan (page du plan d'architecte).</p><button class="on" id="ia-plan">Ajouter le PDF du plan</button>`
        : !cal ? `<p class="sm">Le plan n'est pas encore à l'échelle.</p><button class="on" id="ia-scale" title="Échelle déduite des cotes du plan ; sinon outil Échelle">Régler l'échelle</button>`
        : `<p class="mut sm">${esc(f.name || "Plan")} · à l'échelle</p>`)}
      ${step(2, "Relevé par l'IA", s2, `<p class="sm">${relIa ? "Relevé ajouté au chantier." : rel ? `${apps.length} appareils déjà sur le plan (relevé fait avant ou à la main).` : "Murs, ouvertures, pièces, appareils et liaisons lus sur le plan."}</p>
        ${key ? `<button class="${s2 === "todo" ? "on" : ""}" id="ia-rel" ${s1 !== "done" ? "disabled" : ""} title="Envoie l'image du plan à l'IA (clé de Paramètres). Estimation : ${fmtTok(est.tokens)} jetons${est.eur != null ? " ≈ " + est.eur.toFixed(2).replace(".", ",") + " €" : ""}.">✦ ${rel ? "Refaire le relevé" : "Lancer le relevé"}</button> <span class="mut sm">≈ ${fmtTok(est.tokens)} jetons</span>`
        : `<button class="${s2 === "todo" ? "on" : ""}" id="ia-rel-paste" ${s1 !== "done" ? "disabled" : ""} title="Sans clé : copier la consigne, la coller dans une conversation Claude avec le PDF, coller sa réponse ici">✦ ${rel ? "Recoller un relevé" : "Copier la consigne / coller la réponse"}</button>`}`)}
      ${step(3, "Relecture ciblée", s3, `<p class="sm">${!rel ? "Après le relevé." : pend == null ? "Recherche des erreurs…" : pend ? `<b>${pend}</b> erreur${pend > 1 ? "s" : ""} de relevé à faire relire.` : "Aucune erreur de relevé détectée."}${pct ? ` <span class="mut">Réussite : ${pct.ok}/${pct.tot} (${pct.pct} %).</span>` : ""}</p>
        ${rel ? `${key ? `<button class="${pend ? "on" : ""}" id="ia-rk-auto" ${pend ? "" : "disabled"} title="Relectures automatiques (${pref("relectures")} au plus, Paramètres)">✦ Relire automatiquement</button> ` : ""}<button id="ia-rk" ${pend ? "" : "disabled"} class="${!key && pend ? "on" : ""}" title="Copier la relecture, la coller dans la conversation du relevé, coller sa réponse">${key ? "Copier / coller" : "✦ Copier la relecture / coller la réponse"}</button>` : ""}`)}
      ${step(4, "Équipements hors plan", s4, apps.length ? `<p class="sm">${hpMiss.length ? `À poser d'après le devis : ${esc(hpMiss.slice(0, 6).map((it) => it.n + ((+it.q || 1) > 1 ? " ×" + it.q : "")).join(", "))}${hpMiss.length > 6 ? ` <span class="mut">et ${hpMiss.length - 6} autres</span>` : ""}.` : "Rien à poser (liste habituelle déjà sur le plan)."}</p>
        ${hpMiss.length ? `<button class="${s4 === "todo" ? "on" : ""}" id="ia-hp" title="Pose les équipements habituels dans la pièce qui convient, en violet « à vérifier avec le devis » (Ctrl+Z annule). Liste détaillée : Mode BE → Câblage.">Poser (${hpMiss.length})</button>` : ""}` : `<p class="mut sm">Après le relevé.</p>`)}
      ${step(5, "Câbler le chantier", s5, apps.length ? `<p class="sm">${boxes ? `${boxes} boîte${boxes > 1 ? "s" : ""} · ${A.W ? `${A.W.totals.gaines} gaines · ${String(A.W.totals.gaine).replace(".", ",")} m de gaine` : ""}` : "Circuits, boîtes, gaines et fils, d'après les règles du journal."}</p>
        <div class="ia-row"><select id="ia-mode" title="Type d'implantation des boîtes">${Object.entries(MODES).map(([k, v]) => `<option value="${k}" ${(api.cab.mode || "proximite") === k ? "selected" : ""}>${v}</option>`).join("")}</select>
        <button class="${s5 === "todo" ? "on" : ""}" id="ia-cab" title="Précontrôle des règles, circuits, boîtes (les boîtes verrouillées restent), circuits par boîte ; un seul Ctrl+Z">⚡ ${boxes ? "Recâbler" : "Câbler"}</button></div>` : `<p class="mut sm">Après le relevé.</p>`)}
      ${step(6, "Alertes", A.list.length ? "todo" : apps.length ? "done" : "wait", A.list.length ? `<p class="sm"><b>${A.list.length}</b> à vérifier. Cliquez une ligne pour y aller.</p>
        <ul class="ia-alerts" id="ia-alerts">${A.list.slice(0, 40).map((a, i) => `<li data-i="${i}" class="g${a.grave}"><span class="k">${esc(a.title)}</span> <b>${esc(a.who)}</b><br><span class="mut sm">${esc(a.what)}</span>
          <span class="ia-acts">${a.src === "ctl" && LINK_KINDS.has(a.it.kind) && rel ? `<button class="mini" data-a="rk" data-i="${i}" title="Faire relire ce point par l'IA">✦ Relire</button>` : ""}<button class="mini" data-a="be" data-i="${i}" title="Corriger dans l'interface complète">Mode BE</button></span></li>`).join("")}</ul>${A.list.length > 40 ? `<p class="mut sm">… et ${A.list.length - 40} autres.</p>` : ""}`
        : `<p class="mut sm">${apps.length ? "Rien à signaler." : "Après le relevé."}</p>`)}
      ${step(7, "Résultat", boxes ? "done" : "wait", boxes ? `<p class="sm">${boxes} boîte${boxes > 1 ? "s" : ""}${A.W ? ` · ${A.W.totals.gaines} gaines · ${String(A.W.totals.gaine).replace(".", ",")} m de gaine · ${String(A.W.totals.cuivre).replace(".", ",")} m de fil · ${(A.W.direct || []).length} lignes directes` : ""}${pct ? ` · IA ${pct.pct} %` : ""}${(() => { const N = noteNow(api, A.W); return N ? ` · <b title="Note « belle pieuvre » : croisements dans une boîte ${N.q.croise}, appareils chez la boîte voisine ${N.q.terr}, gaines longues ${N.q.longues}">belle pieuvre ${N.note}/100${N.ok ? "" : " ✗"}</b>` : ""; })()}</p>
        <div class="ia-row"><button class="on" id="ia-dossier" title="Dossier PDF complet : garde, plan, tableau, bandes de toutes les boîtes">📁 Dossier PDF</button><button id="ia-rep" title="Rapport de l'analyse IA : ce qui a été corrigé ou non trouvé">Rapport IA</button></div>` : `<p class="mut sm">Après le câblage.</p>`)}
      <section class="ia-cost" id="ia-cost"><h4>Coûts du chantier</h4>
        <p class="sm">IA : ${U.tokens ? `<b>${fmtTok(U.tokens)}</b> jetons (${U.calls} appel${U.calls > 1 ? "s" : ""})${U.txt ? " · <b>" + U.txt + "</b>" : ""}` : "aucun appel avec clé"}${U.paste ? ` · ${U.paste} étape${U.paste > 1 ? "s" : ""} en copier / coller (non comptée${U.paste > 1 ? "s" : ""})` : ""}</p>
        <p class="sm">Temps BE : <b>${fmtDur(T.be + T.ia)}</b> <span class="mut">(mode IA ${fmtDur(T.ia)}, mode BE ${fmtDur(T.be)})</span>${CT.txt ? " · <b>" + CT.txt + "</b>" : ""}</p>
        ${!U.txt || !CT.txt ? `<p class="mut sm">Prix des jetons et coût horaire : <a href="#" id="ia-prix">Paramètres → Coûts d'un chantier</a>.</p>` : ""}</section>`;
    wire(A.list);
  }
  const later = () => { clearTimeout(t); t = setTimeout(() => { pend = null; render(); }, 180); };

  function wire(list) {
    const $ = (s) => pane.querySelector(s), on = (s, f) => { const e = $(s); if (e) e.onclick = f; };
    on("#ia-be", () => setMode("be"));
    on("#ia-plan", () => api.setTab("chantiers"));
    on("#ia-scale", async () => { const r = await autoScale(api).catch(() => ({ ok: false })); if (!r.ok) { api.setTab("plan"); api.startCalib(); } render(); });
    on("#ia-rel", () => { api.setTab("plan"); aiReleve.open(); });
    on("#ia-rel-paste", () => { api.setTab("plan"); aiReleve.pastePanel(); });
    on("#ia-rk-auto", () => { api.setTab("plan"); recheck.loop(); });
    on("#ia-rk", () => { api.setTab("plan"); recheck.open(); });
    on("#ia-hp", () => { const { list: L } = hpState(api), saved = {}; L.forEach((it) => (saved[it.t] = it.on ? Math.max(1, +it.q || 1) : 0)); poserHorsPlan(api, saved); render(); });
    const sel = $("#ia-mode"); if (sel) sel.onchange = () => api.setCab({ mode: sel.value });
    on("#ia-cab", () => { const r = cabler(api); msg = r.text || ""; if ((api.cab.boxes || []).length) { api.viewPreset("cab"); api.showCircuits = true; } render(); });
    on("#ia-dossier", async (e) => {
      const b = e.currentTarget; if (busy) return; busy = "dossier"; b.disabled = true; b.textContent = "Préparation…";
      try { const r = await buildDossier(api); lastDossier = r; downloadBlob(r.blob, `${api.ch.nom}${api.ch.numero ? "_" + api.ch.numero : ""}_dossier.pdf`); msg = `Dossier prêt : ${r.pages} pages.`; }
      catch (err) { msg = "Dossier impossible : " + err.message; }
      finally { busy = ""; render(); }
    });
    on("#ia-rep", () => showReport());
    on("#ia-prix", (e) => { e.preventDefault(); api.setTab("params"); setTimeout(() => document.getElementById("ps-couts")?.scrollIntoView({ block: "start" }), 150); });
    pane.querySelectorAll("#ia-alerts li[data-i]").forEach((li) => (li.onclick = (e) => { if (e.target.closest("button")) return; goTo(list[+li.dataset.i]); }));
    pane.querySelectorAll("#ia-alerts button[data-a]").forEach((b) => (b.onclick = () => {
      const a = list[+b.dataset.i];
      if (b.dataset.a === "rk") { api.setTab("plan"); recheck.open({ ids: a.ids }); }
      else { setMode("be"); goTo(a); }
    }));
  }
  function goTo(a) {
    if (!a) return;
    if (api.tab !== "plan") api.setTab("plan");
    if (a.src === "ctl" && ctl) return ctl.go(a.i);
    if (a.src === "doute" && a.box) {
      const b = (api.cab.boxes || []).find((x) => x.n === a.box);
      if (b) { if (b.lv !== api.level.id) api.switchLevel(b.lv); api.showCircuits = true; api.boxSel = b.id; const here = (b.apps || []).filter((id) => api.state.app.some((x) => x.id === id)); if (here.length) api.zoomTo(here); }
      api.setHint(`${a.title} — ${a.what}`);
      return;
    }
    if (a.ids && a.ids.length) { api.select(a.ids); api.zoomTo(a.ids); api.setHint(`${a.title} — ${a.who} : ${a.what}`); }
  }
  function showReport() {
    let card = document.getElementById("ia-repcard");
    if (!card) { card = document.createElement("div"); card.id = "ia-repcard"; card.className = "wcard aicard iarep"; card.setAttribute("role", "dialog"); document.querySelector(".stage").appendChild(card); }
    card.innerHTML = `<div class="wcard-h"><b>Rapport de l'analyse IA</b><button class="wx" title="Fermer">✕</button></div><div class="iarep-b">${reportHTML(api)}</div>`;
    card.hidden = false; card.querySelector(".wx").onclick = () => (card.hidden = true);
  }

  ["okteo:saved", "okteo:cab", "okteo:control", "okteo:level", "okteo:fond", "okteo:calibrated", "okteo:recheck", "okteo:ai-releve", "okteo:temps", "okteo:prefs", "okteo:horsplan", "okteo:tab"].forEach((ev) => document.addEventListener(ev, () => { if (isIa()) later(); }));
  apply();
  if (isIa()) render();
  return { setMode, render, get mode() { return pref("ui"); }, get lastDossier() { return lastDossier; }, pane, showReport };
}
