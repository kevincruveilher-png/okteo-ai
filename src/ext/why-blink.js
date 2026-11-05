// n° 5 (bloc D, 04/11/2026) : « Pourquoi ça clignote ? » (bouton du menu flottant d'un appareil signalé) et rapport
// d'analyse. Pour chaque point : famille et couleur, explication, preuves (extrait du plan, inscriptions, lecture de
// l'IA), choix possibles et leur conséquence, recommandation ; réponse de l'opérateur gardée (qui, quand) pour le
// technicien BE ; ce que le plan ne dit pas devient une question au pavillonneur. Passe par l'API seulement.
import { explain, buildRapport, rapportText, FAMILLES, confirmable } from "../cablage/rapport.js";
import { cropAround } from "./symbol-memory.js";
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
      ${confirmable(p.kind) ? "" : `<p class="sm mut">Point de câblage : il se règle dans le panneau Câblage et s'éteint tout seul une fois réglé.</p>`}
      ${p.decision ? `<p class="ok sm why-dec">✓ ${esc(p.decision.label)} — ${esc(p.decision.by || "")}${p.decision.at ? ", " + esc(p.decision.at.slice(0, 16).replace("T", " ")) : ""}</p>` : ""}
    </div>`;
  }
  let cur = null;
  async function open(id) {
    const B = byId(), a = B.get(id);
    if (!a) return;
    const issues = api.control.filter((it) => (it.ids || []).includes(id));
    const pts = issues.map((it) => explain(it, a, api.TYPES, decisions()[`${it.kind}:${(it.ids || []).join(",")}`] || null));
    // les types candidats ne sont proposés qu'une fois (sur le premier point qui en a)
    let seenC = false; pts.forEach((p) => { if (p.choix.length) { if (seenC) p.choix = []; seenC = true; } });
    cur = { id, pts };
    card.innerHTML = `<button class="wx" title="Fermer (Échap)" aria-label="Fermer">✕</button><h3>Pourquoi ça clignote ? · ${esc(a.rep || a.t)}${a.room ? ` <span class="mut sm">${esc(a.room)}</span>` : ""}</h3>
      <div class="why-img" hidden><img alt="Extrait du plan autour de l'appareil"><span class="sm mut">Extrait du plan (1,20 m autour)</span></div>
      ${pts.length ? pts.map(pointHTML).join("") : `<p class="ok">Plus rien à signaler sur cet appareil.</p>`}
      <p class="why-foot"><button id="why-rap" title="Tous les points du plan, par famille, avec les décisions et les questions au pavillonneur">Rapport d'analyse</button></p>`;
    card.hidden = false;
    wire();
    const img = await cropAround(api, a).catch(() => "");
    if (img && cur && cur.id === id) { const w = card.querySelector(".why-img"); w.querySelector("img").src = img; w.hidden = false; }
  }
  function wire() {
    card.querySelector(".wx").onclick = () => (card.hidden = true);
    card.querySelector("#why-rap").onclick = () => { card.hidden = true; openRapport(); };
    card.querySelectorAll("[data-c]").forEach((b) => (b.onclick = () => {
      const [i, j] = b.dataset.c.split(":").map(Number), p = cur.pts[i], c = p.choix[j];
      api.batch(() => { api.updateApps([{ id: cur.id, t: c.type, aiStatus: "lu" }]); decide(p, { choix: "type", label: c.label, type: c.type }); });
      api.setHint(`${c.label} : ${c.consequence} (décision notée pour le technicien BE ; Ctrl+Z l'annule).`);
      open(cur.id);
    }));
    card.querySelectorAll("[data-q]").forEach((b) => (b.onclick = () => {
      const p = cur.pts[+b.dataset.q];
      decide(p, { choix: "pavillonneur", label: "question posée au pavillonneur" }, { questions: [...(api.cab.questions || []).filter((q) => q.text !== p.question), { text: p.question, key: p.key, by: who(), at: new Date().toISOString() }] });
      open(cur.id);
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
      card.hidden = true; api.select([cur.id]);
      api.setHint(`${p.rep} : déplacez l'appareil ou changez son type dans Propriétés. Il clignote tant que le point n'est pas réglé ou confirmé.`);
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
  const ui = { open, openRapport, rapport: rapportNow, lastText: "", card, rcard };
  return ui;
}
