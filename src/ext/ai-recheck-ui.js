// Relecture ciblée par l'IA (v57) : les points signalés par le contrôle (lumière sans commande, commande sans lumière,
// va-et-vient seul, deux interrupteurs sur une lumière) deviennent une consigne courte pour l'IA.
// - Sans clé : « Copier la relecture » → la coller dans la conversation qui a fait le relevé (PDF joint) → coller ici
//   les corrections → aperçu → « Appliquer » (un seul Ctrl+Z).
// - Avec clé : relectures automatiques après un relevé IA (Paramètres : 0 à 3, 2 par défaut), arrêt quand il n'y a plus
//   rien à revoir ou qu'une relecture ne corrige rien, 3 min au plus par appel, bouton « Arrêter », compteur et jetons.
// Un point que l'IA dit introuvable est marqué sur l'appareil (aiNo) et n'est plus jamais redemandé ; un point déjà
// demandé sans réponse n'est pas redemandé dans la même session (bouton « Tout redemander »).
import { chat, PROVIDERS } from "./ai.js";
import { settings } from "./settings.js";
import { recheckPoints, recheckPrompt, parseCorrections, shouldContinue, RECHECK_KINDS } from "../walls/ai-recheck.js";
import { pref } from "../prefs.js";
import { esc } from "./util.js";

const SYSTEM = "Tu es dessinateur au bureau d'études électricité d'un fabricant de pieuvres électriques. Tu relis un plan déjà relevé, seulement aux points demandés, et tu réponds uniquement en JSON.";
const TIMEOUT = 180000;

export function createRecheck({ api, aiReleve }) {
  const card = document.createElement("div");
  card.className = "wcard aicard rkcard"; card.hidden = true; card.setAttribute("role", "dialog"); card.setAttribute("aria-label", "Relecture ciblée par l'IA");
  document.querySelector(".stage").appendChild(card);
  const done = new Set();          // points déjà demandés dans cette session
  let corr = null, points = [], frame = null, mode = "paste", running = false, stopped = false, last = null, copied = "";

  const close = () => { card.hidden = true; api.setPreview(null); corr = null; };
  const show = (html) => { card.innerHTML = `<div class="wcard-h"><b>✦ Relecture ciblée par l'IA</b><button class="wx" title="Fermer">✕</button></div>${html}`; card.hidden = false; card.querySelector(".wx").onclick = () => { if (running) stopped = true; close(); }; };
  const issuesHere = () => api.control.filter((it) => RECHECK_KINDS[it.kind] && it.lv === api.level.id);
  const appsHere = () => api.allApps().filter((a) => a.lv === api.level.id);

  async function pageFrame() { const f = await api.levelFond(api.level.id); return f ? { x0: f.x, y0: f.y, w: f.w, h: f.h } : null; }
  let only = null;   // relecture limitée à quelques appareils (ids) : « Relire ce point », tests
  function compute(fr) { frame = fr; points = recheckPoints(appsHere(), issuesHere().filter((it) => !only || it.ids.some((id) => only.has(id))), { frame, done, lv: api.level.id }); return points; }

  // fenêtre de départ : points à revoir, consigne à copier, zone de collage
  async function open({ ids = null } = {}) {
    if (api.tab !== "plan") api.setTab("plan");
    only = ids ? new Set(ids) : null;
    const fr = await pageFrame().catch(() => null);
    if (!fr) return show(`<p>Ce niveau n'a pas de plan (fond). La relecture compare le dessin au plan : ajoutez d'abord le PDF du plan (onglet Chantiers).</p>`);
    mode = "paste";
    compute(fr);
    const key = !!settings.activeProvider(), max = pref("relectures");
    if (!points.length) return show(`<p>Rien à faire relire : le contrôle ne signale aucune lumière sans commande, commande sans lumière ni va-et-vient seul sur ce niveau${done.size ? " (en dehors des points déjà demandés)" : ""}.</p>
      ${done.size ? `<div class="wrow"><button id="rk-reset">Tout redemander</button></div>` : ""}`), wireReset();
    show(`<p class="sm"><b>${points.length} point${points.length > 1 ? "s" : ""} à faire relire</b> (contrôle du plan) :</p>
      <ul class="rk-list sm">${points.map((P) => `<li>${esc(RECHECK_KINDS[P.kind])} : <b>${esc(P.points.map((p) => p.rep).join(", "))}</b> <span class="mut">${esc(P.points[0].room)}</span></li>`).join("")}</ul>
      <p class="sm"><b>1.</b> Copiez la relecture et collez-la <b>dans la conversation qui a fait le relevé</b> (le PDF du plan doit y être joint).
        <button id="rk-copy" title="Consigne courte : chaque point avec son repère, sa pièce, sa position en % de la page et les repères proches">📋 Copier la relecture</button></p>
      <p class="sm"><b>2.</b> Collez ici sa réponse (JSON) :</p>
      <textarea id="rk-paste" rows="5" style="width:100%" placeholder='{"liaisons":[["I5","L12"]],"ajouts":[],"introuvable":[]}'></textarea>
      <div class="wrow"><button class="on" id="rk-read">Lire les corrections</button>
        ${key && max > 0 ? `<button id="rk-auto" title="Envoie l'image du plan et la consigne à l'IA, applique ses corrections, recommence tant que ça progresse (${max} relecture${max > 1 ? "s" : ""} au plus, 3 min par appel)">✦ Relire avec l'IA (${max} max)</button>` : ""}
        ${done.size ? `<button id="rk-reset" title="Redemander aussi les points déjà demandés dans cette session">Tout redemander</button>` : ""}<button id="rk-x">Fermer</button></div>
      ${key ? "" : `<p class="mut sm">Avec une clé IA (Paramètres), la relecture se fait toute seule après un relevé IA.</p>`}`);
    const ta = card.querySelector("#rk-paste");
    card.querySelector("#rk-x").onclick = close;
    card.querySelector("#rk-read").onclick = () => { const t = ta.value.trim(); if (t) fromText(t); };
    card.querySelector("#rk-copy").onclick = async (e) => {
      const b = e.currentTarget, txt = recheckPrompt(points, { mode: "paste" });
      copied = txt;
      points.forEach((P) => done.add(P.key));
      let ok = false;
      try { await Promise.race([navigator.clipboard.writeText(txt), new Promise((_, no) => setTimeout(() => no(new Error("délai")), 1500))]); ok = true; } catch { /* repli ci-dessous */ }
      if (!ok) { ta.value = txt; ta.select(); }
      b.textContent = ok ? "✓ Relecture copiée" : "Consigne dans la zone ci-dessous : Ctrl+C, puis collez la réponse à sa place";
    };
    const au = card.querySelector("#rk-auto"); if (au) au.onclick = () => loop();
    wireReset();
  }
  function wireReset() { const r = card.querySelector("#rk-reset"); if (r) r.onclick = () => { done.clear(); open({ ids: only ? [...only] : null }); }; }

  // réponse collée (ou de l'IA) → aperçu des ajouts et liste des corrections
  function fromText(text) {
    try { corr = parseCorrections(text, { apps: appsHere(), frame, points }); }
    catch (e) { show(`<p>Cette réponse n'est pas exploitable : ${esc(e.message)}</p><div class="wrow"><button id="rk-back">Revenir</button></div>`); card.querySelector("#rk-back").onclick = () => open({ ids: only ? [...only] : null }); return null; }
    points.forEach((P) => done.add(P.key));
    api.setPreview({ devices: corr.adds.map((d) => ({ t: d.t, x: d.x, y: d.y })), links: [] });
    const n = corr.links.length + corr.adds.length + corr.nope.length;
    show(`<p class="sm">L'IA propose : <b>${corr.links.length} liaison${corr.links.length > 1 ? "s" : ""}</b>, <b>${corr.adds.length} appareil${corr.adds.length > 1 ? "s" : ""} à ajouter</b> (en orange)${corr.nope.length ? `, ${corr.nope.length} introuvable${corr.nope.length > 1 ? "s" : ""} (plus redemandé${corr.nope.length > 1 ? "s" : ""})` : ""}.</p>
      ${corr.errors.length ? `<p class="warn sm">⚠ ${esc(corr.errors.join(" ; "))}</p>` : ""}
      ${corr.silent.length ? `<p class="mut sm">${corr.silent.length} point(s) sans réponse.</p>` : ""}
      ${corr.remarques ? `<p class="mut sm">Remarque de l'IA : ${esc(corr.remarques)}</p>` : ""}
      <div class="wrow"><button class="on" id="rk-ok" ${n ? "" : "disabled"}>Appliquer</button><button id="rk-no">Annuler</button></div>`);
    card.querySelector("#rk-ok").onclick = () => { const r = apply(corr); close(); api.setHint(`Relecture appliquée : ${r.text}. Ctrl+Z annule.`); };
    card.querySelector("#rk-no").onclick = close;
    return corr;
  }

  // corrections → plan, un seul Ctrl+Z
  function apply(c) {
    let r = { liaisons: 0, appareils: 0 };
    api.batch(() => {
      if (c.adds.length || c.links.length) {
        const L = c.links.map((k) => ({ c: k.c.startsWith("add:") ? +k.c.slice(4) : k.c, l: k.l.startsWith("add:") ? +k.l.slice(4) : k.l }));
        r = api.importDevices(c.adds.map((d) => ({ t: d.t, x: d.x, y: d.y, h: d.h })), L);
      }
      c.nope.forEach((n) => api.setAppFlags(n.id, { aiNo: n.why || "introuvable" }));
    });
    api.setPreview(null);
    const text = [`${r.liaisons} liaison(s)`, `${r.appareils} appareil(s) ajouté(s)`, c.nope.length ? `${c.nope.length} introuvable(s)` : ""].filter(Boolean).join(", ");
    document.dispatchEvent(new CustomEvent("okteo:recheck", { detail: { ...r, nope: c.nope.length } }));
    return { ...r, nope: c.nope.length, text };
  }

  // relectures automatiques (avec clé)
  async function loop({ max = pref("relectures"), ids = null } = {}) {
    const provider = settings.activeProvider();
    if (!provider || running || !(max > 0)) return null;
    only = ids ? new Set(ids) : null;
    running = true; stopped = false; mode = "image";
    const log = { passes: 0, tokens: 0, fixed: 0, why: "" };
    try {
      while (true) {
        const img = await aiReleve.fondImage(provider === "nvidia" ? { maxPx: 1280, maxB64: PROVIDERS.nvidia.maxImageB64 } : {});
        compute({ x0: img.map.x0, y0: img.map.y0, w: img.W * img.map.sx, h: img.H * img.map.sy });
        const before = issuesHere().length;
        if (!points.length) { log.why = log.passes ? "plus rien à revoir" : "rien à revoir"; break; }
        const pass = log.passes + 1;
        show(`<p><b>Relecture ${pass}/${max}</b> · ${points.length} point${points.length > 1 ? "s" : ""} · l'IA regarde le plan (3 min au plus)…</p>
          <p class="mut sm">${log.tokens ? `Coût jusqu'ici : ${log.tokens.toLocaleString("fr-FR")} jetons. ` : ""}Vous pouvez continuer à travailler.</p>
          <div class="wrow"><button class="danger" id="rk-stop">Arrêter</button></div>`);
        card.querySelector("#rk-stop").onclick = () => { stopped = true; };
        let res, t1 = 0, t2 = 0;
        try {
          res = await Promise.race([
            chat({ system: SYSTEM, messages: [{ role: "user", text: recheckPrompt(points, { mode: "image", pass }), image: { type: "image/jpeg", data: img.url.split(",")[1] } }], maxTokens: 3000, provider }),
            new Promise((_, no) => { t1 = setTimeout(() => no(new Error("sans réponse en 3 min")), TIMEOUT); }),
            new Promise((_, no) => { t2 = setInterval(() => { if (stopped) no(new Error("arrêtée")); }, 200); }),
          ]);
        } catch (e) { log.why = e.message === "arrêtée" ? "arrêtée" : "relecture " + e.message; break; }
        finally { clearTimeout(t1); clearInterval(t2); }
        log.passes = pass;
        if (res.usage) log.tokens += res.usage.in + res.usage.out;
        let c;
        try { c = parseCorrections(res.text, { apps: appsHere(), frame, points }); } catch { log.why = "réponse de l'IA illisible"; break; }
        points.forEach((P) => done.add(P.key));
        const changed = c.links.length + c.adds.length + c.nope.length;
        if (changed) { const r = apply(c); log.fixed += r.liaisons + r.appareils + r.nope; }
        const sc = shouldContinue({ pass, max, before, after: issuesHere().length, changed });
        if (!sc.go || stopped) { log.why = stopped ? "arrêtée" : sc.why; break; }
      }
    } finally { running = false; only = null; }
    last = log;
    const left = issuesHere().length;
    show(`<p><b>Relecture terminée</b> (${esc(log.why)}) : ${log.passes} relecture${log.passes > 1 ? "s" : ""}, ${log.fixed} correction${log.fixed > 1 ? "s" : ""}${log.tokens ? ` · ${log.tokens.toLocaleString("fr-FR")} jetons` : ""}.</p>
      <p class="sm">${left ? `Reste ${left} point${left > 1 ? "s" : ""} au contrôle : à corriger à la main (compteur ⚠ en haut).` : "Le contrôle ne signale plus rien sur ce niveau."}${log.fixed ? " Chaque relecture s'annule avec Ctrl+Z." : ""}</p>
      <div class="wrow"><button class="on" id="rk-close">OK</button></div>`);
    card.querySelector("#rk-close").onclick = close;
    return log;
  }

  // après un relevé IA avec clé (appareils gardés) : relectures automatiques si le contrôle signale des points
  document.addEventListener("okteo:ai-releve", (e) => {
    const d = e.detail || {};
    if (!d.devices) return;
    setTimeout(() => {
      const n = issuesHere().length;
      if (!n) return;
      if (d.mode === "key" && settings.activeProvider() && pref("relectures") > 0) loop();
      else api.setHint(`Relevé IA ajouté. Le contrôle signale ${n} point(s) à revoir : menu Relevé → « Relecture ciblée » pour les faire relire par l'IA. Ctrl+Z annule tout l'ajout.`);
    }, 50);
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !card.hidden && !running) close(); });
  return { open, close, fromText, apply, loop, stop: () => { stopped = true; }, get points() { return points; }, get copied() { return copied; }, get last() { return last; }, get corr() { return corr; }, done };
}
