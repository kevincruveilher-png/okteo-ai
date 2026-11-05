// n° 5 (bloc D, 04/11/2026) : « Pourquoi ça clignote ? » (bouton du menu flottant d'un appareil signalé) et rapport
// d'analyse. Pour chaque point : famille et couleur, explication, preuves (extrait du plan, inscriptions, lecture de
// l'IA), choix possibles et leur conséquence, recommandation ; réponse de l'opérateur gardée (qui, quand) pour le
// technicien BE ; ce que le plan ne dit pas devient une question au pavillonneur. Passe par l'API seulement.
import { explain, buildRapport, rapportText, FAMILLES, confirmable, isConfirmed } from "../cablage/rapport.js";
import { cropAround, remember } from "./symbol-memory.js";
import { esc } from "./util.js";

export function createWhyBlink({ api }) {
  const card = document.createElement("div");
  card.className = "wcard whyb"; card.hidden = true; card.setAttribute("role", "dialog"); card.setAttribute("aria-label", "Pourquoi ça clignote");
  document.querySelector(".stage").appendChild(card);
  const rcard = document.createElement("div");
  rcard.className = "wcard rapcard"; rcard.hidden = true; rcard.setAttribute("role", "dialog"); rcard.setAttribute("aria-label", "Rapport d'analyse");
  document.querySelector(".stage").appendChild(rcard);
  const who = () => (window.okteoSession && window.okteoSession.user && window.okteoSession.user.login) || "opérateur";
  const decisions = () => api.cab.decisions || {};
  const byId = () => { const m = new Map(api.allApps().map((a) => [a.id, a])); for (const a of api.state.app) if (m.has(a.id)) m.set(a.id, { ...a, ...m.get(a.id) }); return m; };
  function decide(p, d, extra = {}) {
    const D = { ...decisions(), [p.key]: { ...d, rep: p.rep, alerte: p.pourquoi, by: who(), at: new Date().toISOString() } };
    api.setCab({ decisions: D, ...extra });
  }
  const badge = (f) => `<span class="fam-badge" style="--fc:${FAMILLES[f].color}" title="${esc(FAMILLES[f].aide)}">${esc(FAMILLES[f].label)}</span>`;
  function pointHTML(p, i) {
    return `<div class="why-pt" data-i="${i}">
      <p>${badge(p.fam)} <b>${esc(api.controlKinds[p.kind] || p.kind)}</b></p>
      <p class="sm">${esc(p.pourquoi)}</p>
      ${p.preuves.length ? `<ul class="sm why-pr">${p.preuves.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      ${p.choix.length ? `<div class="why-ch">${p.choix.map((c, j) => `<button data-c="${i}:${j}" title="${esc(c.consequence)}">${esc(c.label)}</button><span class="sm mut">${esc(c.consequence)}</span>`).join("")}</div>` : ""}
      ${p.recommandation ? `<p class="sm"><b>Recommandation :</b> ${esc(p.recommandation)}</p>` : ""}
      <p class="why-act">${confirmable(p.kind) ? `<button class="why-ok" data-ok="${i}" title="Valide ce point : l'appareil ne clignote plus pour lui, même s'il est déplacé ensuite. Noté dans le rapport pour le technicien BE (Ctrl+Z l'annule).">${p.fam === "montage" ? "Je confirme, c'est voulu" : "Je confirme l'emplacement"}</button>` : ""}<button data-mod="${i}" title="Ferme la carte et garde l'appareil sélectionné : déplacez-le ou changez son type (Propriétés). Il clignote tant que le point n'est pas réglé ou confirmé.">Modifier</button>${p.question ? `<button data-q="${i}" title="Ajoute la question à la liste « Questions au pavillonneur » du rapport">Question au pavillonneur</button>` : ""}</p>
      <div class="why-qbox" hidden></div>
      ${confirmable(p.kind) ? "" : `<p class="sm mut">Point de câblage : il se règle dans le panneau Câblage et s'éteint tout seul une fois réglé.</p>`}
      ${p.decision ? `<p class="ok sm why-dec">✓ ${esc(p.decision.label)} — ${esc(p.decision.by || "")}${p.decision.at ? ", " + esc(p.decision.at.slice(0, 16).replace("T", " ")) : ""}</p>` : ""}
    </div>`;
  }
  let cur = null;
  // lot 2 (05/11/2026) : agir sur l'appareil, pas seulement confirmer : changer son type, enregistrer son dessin comme
  // variante d'un symbole (bibliothèque + mémoire commune), « Je ne sais pas » (passe au suivant), précédent / suivant
  const typeOpts = (sel) => Object.entries(api.TYPES).filter(([, T]) => !T.zone).map(([t, T]) => `<option value="${esc(t)}" ${t === sel ? "selected" : ""}>${esc(t)} · ${esc(T.n || t)}</option>`).join("");
  function fixHTML(a, pts) {
    if (!pts.some((p) => confirmable(p.kind))) return "";
    const pav = api.ch.client || "";
    return `<div class="why-fix">
      <p class="sm"><b>Que faire de cet appareil ?</b></p>
      <div class="why-row"><label class="sm">C'est un <select id="why-type" aria-label="Type de l'appareil">${typeOpts(a.t)}</select></label><button id="why-settype" title="Change le type de l'appareil (noté pour le technicien BE ; Ctrl+Z l'annule)">Changer le type</button></div>
      <div class="why-row"><button id="why-var" class="on" title="Le dessin du plan autour de l'appareil est rangé dans la bibliothèque comme variante du symbole choisi ci-dessus, pour ${esc(pav || "ce pavillonneur")} : l'IA le reconnaîtra sur les prochains plans">Enregistrer ce dessin comme variante du symbole choisi</button></div>
      <div class="why-row"><button id="why-idk" title="Laisse le point ouvert (il continue de clignoter), noté « je ne sais pas » pour le technicien BE, et passe au suivant">Je ne sais pas → suivant</button></div>
      <p class="sm mut why-fixmsg" role="status"></p></div>`;
  }
  // appareils signalés (points réglables dans cette carte), dans l'ordre du contrôle
  function navList() { const seen = new Set(), out = []; for (const it of api.control) { if (!confirmable(it.kind)) continue; const i = (it.ids || [])[0]; if (i && !seen.has(i) && api.state.app.some((x) => x.id === i)) { seen.add(i); out.push(i); } } return out; }
  function navPos(id) { const L = navList(), k = L.indexOf(id); return L.length ? `${k < 0 ? "—" : k + 1} / ${L.length}` : ""; }
  function go(step) {
    const L = navList(); if (!L.length) { card.hidden = true; api.setHint("Plus aucun appareil signalé."); return; }
    const k = L.indexOf(cur && cur.id), id = L[((k < 0 ? (step > 0 ? -1 : 0) : k) + step + L.length) % L.length];
    api.select([id]); try { api.zoomTo([id]); } catch { /* vue inchangée */ }
    open(id);
  }
  async function open(id) {
    const B = byId(), a = B.get(id);
    if (!a) return;
    const issues = api.control.filter((it) => (it.ids || []).includes(id));
    const pts = issues.map((it) => explain(it, a, api.TYPES, decisions()[`${it.kind}:${(it.ids || []).join(",")}`] || null));
    // les types candidats ne sont proposés qu'une fois (sur le premier point qui en a)
    let seenC = false; pts.forEach((p) => { if (p.choix.length) { if (seenC) p.choix = []; seenC = true; } });
    cur = { id, pts };
    // points déjà confirmés pour cet appareil (ils ne clignotent plus) : rappel de qui a confirmé et quand
    const done = Object.entries(decisions()).filter(([k, d]) => isConfirmed(d) && (k.split(":")[1] || "").split(",").includes(id)).map(([, d]) => d);
    card.innerHTML = `<button class="wx" title="Fermer (Échap)" aria-label="Fermer">✕</button><h3>Pourquoi ça clignote ? · ${esc(a.rep || a.t)}${a.room ? ` <span class="mut sm">${esc(a.room)}</span>` : ""}</h3>
      <div class="why-img" hidden><img alt="Extrait du plan autour de l'appareil"><span class="sm mut">Extrait du plan (1,20 m autour)</span></div>
      ${fixHTML(a, pts)}
      ${pts.length ? pts.map(pointHTML).join("") : `<p class="ok">Plus rien à signaler sur cet appareil.</p>`}
      ${done.map((d) => `<p class="ok sm why-dec">✓ ${esc(d.label)} — ${esc(d.by || "")}${d.at ? ", " + esc(d.at.slice(0, 16).replace("T", " ")) : ""}</p>`).join("")}
      <p class="why-foot wrow"><button id="why-prev" title="Point signalé précédent">‹ Précédent</button><span class="sm mut">${navPos(id)}</span><button id="why-next" title="Point signalé suivant">Suivant ›</button><span class="grow"></span><button id="why-rap" title="Tous les points du plan, par famille, avec les décisions et les questions au pavillonneur">Rapport d'analyse</button></p>`;
    card.hidden = false;
    wire();
    const img = await cropAround(api, a).catch(() => "");
    if (img && cur && cur.id === id) { const w = card.querySelector(".why-img"); w.querySelector("img").src = img; w.hidden = false; }
  }
  function wire() {
    card.querySelector(".wx").onclick = () => (card.hidden = true);
    const say = (t) => { const m = card.querySelector(".why-fixmsg"); if (m) m.textContent = t; };
    card.querySelector("#why-prev").onclick = () => go(-1);
    card.querySelector("#why-next").onclick = () => go(1);
    const st = card.querySelector("#why-settype");
    if (st) st.onclick = () => {
      const t = card.querySelector("#why-type").value, p = cur.pts.find((x) => confirmable(x.kind)) || cur.pts[0];
      if (!t || !api.TYPES[t]) return;
      api.batch(() => { api.updateApps([{ id: cur.id, t, aiStatus: "lu" }]); if (p) decide(p, { choix: "type", label: `type corrigé : ${api.TYPES[t].n || t}`, type: t }); });
      api.setHint(`Type changé : ${api.TYPES[t].n || t} (noté pour le technicien BE ; Ctrl+Z l'annule).`);
      open(cur.id); say(`✓ Type changé : ${api.TYPES[t].n || t}.`);   // la carte est redessinée tout de suite (l'extrait du plan suit)
    };
    const vb = card.querySelector("#why-var");
    if (vb) vb.onclick = async () => {
      const t = card.querySelector("#why-type").value, a = api.state.app.find((x) => x.id === cur.id);
      if (!a || !api.TYPES[t]) return;
      vb.disabled = true; say("Enregistrement du dessin…");
      const image = await cropAround(api, a).catch(() => "");
      const desc = [`dessin du plan pour ${api.TYPES[t].n || t}`, a.inscription ? `inscription « ${a.inscription} »` : "", a.aiType && a.aiType !== t ? `lu par l'IA comme ${a.aiType}` : ""].filter(Boolean).join(", ");
      const r = remember({ pav: api.ch.client || "", type: t, desc, chantier: [api.ch.nom, api.ch.numero].filter(Boolean).join(" "), by: who(), image });
      const p = cur.pts.find((x) => confirmable(x.kind)) || cur.pts[0];
      api.batch(() => { if (a.t !== t || a.aiStatus !== "lu") api.updateApps([{ id: a.id, t, aiStatus: "lu" }]); if (p) decide(p, { choix: "variante", label: `dessin enregistré comme variante de ${api.TYPES[t].n || t}`, type: t }); });
      document.dispatchEvent(new CustomEvent("okteo:symbol-memorized", { detail: r }));
      api.setHint(`Dessin enregistré dans la bibliothèque : variante de ${api.TYPES[t].n || t} pour ${api.ch.client || "ce pavillonneur"}. L'IA s'en servira sur les prochains plans.`);
      open(cur.id); say(`✓ Variante enregistrée dans la bibliothèque (${api.TYPES[t].n || t}).`);
      ui.lastVariant = r;
    };
    const idk = card.querySelector("#why-idk");
    if (idk) idk.onclick = () => {
      const p = cur.pts.find((x) => confirmable(x.kind)) || cur.pts[0];
      if (p) decide(p, { choix: "inconnu", label: "je ne sais pas (à voir par le technicien BE)" });
      go(1);
    };
    card.querySelector("#why-rap").onclick = () => { card.hidden = true; openRapport(); };
    card.querySelectorAll("[data-c]").forEach((b) => (b.onclick = () => {
      const [i, j] = b.dataset.c.split(":").map(Number), p = cur.pts[i], c = p.choix[j];
      api.batch(() => { api.updateApps([{ id: cur.id, t: c.type, aiStatus: "lu" }]); decide(p, { choix: "type", label: c.label, type: c.type }); });
      api.setHint(`${c.label} : ${c.consequence} (décision notée pour le technicien BE ; Ctrl+Z l'annule).`);
      open(cur.id);
    }));
    // lot 1 (05/11/2026) : la question s'affiche, modifiable, avant d'être ajoutée ; confirmation visible ensuite
    card.querySelectorAll("[data-q]").forEach((b) => (b.onclick = () => {
      const i = +b.dataset.q, p = cur.pts[i], box = card.querySelector(`.why-pt[data-i="${i}"] .why-qbox`);
      if (!box) return;
      box.hidden = false;
      box.innerHTML = `<label class="sm"><b>Question au pavillonneur</b> (modifiable)<textarea class="why-qtxt" rows="3">${esc(p.question)}</textarea></label>
        <p class="wrow"><button class="on why-qadd">Ajouter au rapport</button><button class="why-qno">Annuler</button></p>`;
      const ta = box.querySelector(".why-qtxt"); ta.focus();
      box.querySelector(".why-qno").onclick = () => { box.hidden = true; box.innerHTML = ""; };
      box.querySelector(".why-qadd").onclick = () => {
        const text = ta.value.trim() || p.question;
        const qs = [...(api.cab.questions || []).filter((q) => q.key !== p.key && q.text !== text), { text, key: p.key, by: who(), at: new Date().toISOString() }];
        decide(p, { choix: "pavillonneur", label: "question posée au pavillonneur" }, { questions: qs });
        api.setHint(`Question ajoutée au rapport d'analyse (${qs.length} question${qs.length > 1 ? "s" : ""} au pavillonneur).`);
        open(cur.id); (() => { const n = card.querySelector(`.why-pt[data-i="${i}"] .why-qbox`); if (n) { n.hidden = false; n.innerHTML = `<p class="ok sm">✓ Question ajoutée au rapport (${qs.length} au total). <button class="lnk why-qrap">Voir le rapport</button></p>`; n.querySelector(".why-qrap").onclick = () => { card.hidden = true; openRapport(); }; } })();
      };
    }));
    // « Je confirme » : le point ne clignote plus (filtré par le contrôle) ; un emplacement à préciser passe à « confirmé »
    card.querySelectorAll("[data-ok]").forEach((b) => (b.onclick = () => {
      const p = cur.pts[+b.dataset.ok], a = api.state.app.find((x) => x.id === cur.id);
      const label = p.fam === "montage" ? "montage confirmé tel quel" : "emplacement confirmé";
      api.batch(() => {
        if (p.kind === "implantation" && a) api.updateApps([{ id: a.id, implantation: { ...(a.implantation || {}), etat: "confirmee", origine: "manuel", motif: "Position confirmée par le dessinateur." } }]);
        decide(p, { choix: "confirme", label });
      });
      api.setHint(`${p.rep} : ${label}, noté dans le rapport pour le technicien BE (Ctrl+Z l'annule).`);
      open(cur.id);
    }));
    card.querySelectorAll("[data-mod]").forEach((b) => (b.onclick = () => {
      const p = cur.pts[+b.dataset.mod];
      decide(p, { choix: "modifier", label: "en cours de modification" });
      // lot 1 (05/11/2026) : l'appareil est sélectionné, centré, et ses Propriétés s'ouvrent (type, hauteur, position)
      const id = cur.id;
      card.hidden = true; api.select([id]);
      try { api.zoomTo([id]); } catch { /* vue inchangée */ }
      window.okteoExt?.panel?.show?.("props");
      api.setHint(`${p.rep} : glissez l'appareil à sa place ou changez son type dans Propriétés (à droite). Il clignote tant que le point n'est pas réglé ou confirmé.`);
    }));
  }
  function rapportNow() { return buildRapport(api.control, byId(), api.TYPES, decisions(), api.cab.questions || []); }
  function openRapport() {
    const R = rapportNow(), chantier = [api.ch.nom, api.ch.numero].filter(Boolean).join(" ");
    rcard.innerHTML = `<button class="wx" title="Fermer (Échap)" aria-label="Fermer">✕</button><h3>Rapport d'analyse <span class="mut sm">${R.total} point(s) à régler · ${R.validations.length} confirmé(s)</span></h3>
      <p class="sm mut">D'abord pour vous (questionnaire), puis à transmettre au technicien BE : chaque décision garde qui l'a prise et quand.</p>
      ${R.parFamille.map((g) => `<details class="rap-fam" open><summary>${badge(g.fam)} ${g.points.length}</summary><ul>${g.points.map((p) => `<li><button class="lnk" data-go="${esc((p.key.split(":")[1] || "").split(",")[0])}">${esc(p.rep)}</button> ${esc(api.controlKinds[p.kind] || p.kind)} ${p.decision ? `<span class="ok sm">✓ ${esc(p.decision.label)}</span>` : `<span class="warn sm">à décider</span>`}</li>`).join("")}</ul></details>`).join("") || `<p class="ok">Rien à signaler.</p>`}
      <h4>Emplacements confirmés et corrections (${R.validations.length})</h4>${R.validations.length ? `<ul class="sm rap-val">${R.validations.map((v) => `<li><b>${esc(v.rep)}</b> ${esc(v.label)} <span class="mut">${esc(v.by)}${v.at ? ", " + esc(v.at.slice(0, 16).replace("T", " ")) : ""}</span><br><span class="mut">${esc(v.alerte)}</span></li>`).join("")}</ul>` : `<p class="sm mut">Aucun pour l'instant (bouton « Je confirme » d'un point).</p>`}
      <h4>Questions au pavillonneur (${R.questions.length})</h4>${R.questions.length ? `<ol class="sm rap-q">${R.questions.map((q) => `<li>${esc(q)}</li>`).join("")}</ol>` : `<p class="sm mut">Aucune pour l'instant (bouton « Question au pavillonneur » d'un point).</p>`}
      <p class="wrow"><button id="rap-copy" title="Copie le rapport complet (points, décisions, questions) pour le technicien BE">Copier pour le BE</button><button id="rap-q" ${R.questions.length ? "" : "disabled"} title="Copie seulement les questions au pavillonneur">Copier les questions</button></p>`;
    rcard.hidden = false;
    rcard.querySelector(".wx").onclick = () => (rcard.hidden = true);
    rcard.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => { const id = b.dataset.go; api.setTab("plan"); api.select([id]); api.zoomTo([id]); rcard.hidden = true; open(id); }));
    const copy = async (t) => { ui.lastText = t; try { await navigator.clipboard.writeText(t); api.setHint("Copié dans le presse-papiers."); } catch { api.setHint("Copie impossible ici : le texte est dans okteoExt.whyBlink.lastText."); } };
    rcard.querySelector("#rap-copy").onclick = () => copy(rapportText(R, { chantier }));
    rcard.querySelector("#rap-q").onclick = () => copy(R.questions.map((q, i) => `${i + 1}. ${q}`).join("\n"));
  }
  document.addEventListener("okteo:why", (e) => open(e.detail && e.detail.id));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { card.hidden = true; rcard.hidden = true; } });
  const ui = { open, openRapport, rapport: rapportNow, lastText: "", lastVariant: null, next: () => go(1), prev: () => go(-1), card, rcard };
  return ui;
}
