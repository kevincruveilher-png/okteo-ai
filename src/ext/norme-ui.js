// MAJ norme n° 2 (06/11/2026, go de Kévin) : minimums par pièce de la NF C 15-100, en ALERTES SIMPLES (jamais bloquantes).
// - Panneau Étapes, sous les étapes : « Norme » = ce qui est sous le minimum (prises, éclairage, RJ45), pièce par pièce,
//   avec le code de la règle et l'article (bible Oktéo) ; « Voir » (zoom sur la pièce), « Question au pavillonneur »
//   (rapport d'analyse), « Voulu » (le point ne s'affiche plus ; noté dans les décisions, qui / quand).
// - Lecture du plan avant dessin : juste après un relevé IA, la ligne d'aide dit combien de points sont sous le minimum ;
//   « Poser les questions » les envoie toutes au rapport (questions au pavillonneur), avant de dessiner.
// Passe seulement par l'API (window.okteo).
import { checkPieces } from "../norme/pieces.js";
import { esc } from "./util.js";

export function createNorme({ api }) {
  const who = () => (window.okteoSession && window.okteoSession.user && window.okteoSession.user.login) || "opérateur";
  const decisions = () => (api.cab && api.cab.decisions) || {};
  // pièces de tous les niveaux (contour intérieur, surface habitable) et appareils de tous les niveaux
  function roomsAll() {
    const out = [];
    for (const L of api.levels) api.inLevel(L.id, () => (api.state.rooms || []).forEach((r) => out.push({ id: r.id, name: r.name, poly: api.roomPoly(r), area: api.roomArea(r), lv: L.id })));
    return out;
  }
  function all() {
    const V = api.normeVersion();
    return checkPieces(roomsAll(), api.allApps(), { v: V.v });
  }
  // points encore à traiter (un point « voulu » est gardé dans les décisions, il ne s'affiche plus)
  const issues = () => all().filter((i) => !((decisions()[i.key] || {}).choix === "garde"));
  function decide(i, d) {
    api.setCab({ decisions: { ...decisions(), [i.key]: { ...d, rep: i.room, alerte: `${i.ref} — ${i.text}`, by: who(), at: new Date().toISOString() } } });
  }
  function ask(list) {
    const Q = [...(api.cab.questions || [])], keys = new Set(Q.map((q) => q.key));
    let n = 0;
    for (const i of list) if (i.question && !keys.has(i.key)) { Q.push({ text: `${i.question} (${i.ref})`, key: i.key, by: who(), at: new Date().toISOString() }); keys.add(i.key); n++; }
    if (n) api.setCab({ questions: Q });
    return n;
  }
  function show(i) {
    if (i.lv && i.lv !== api.level.id) api.switchLevel(i.lv);
    if (api.tab !== "plan") api.setTab("plan");
    const id = i.appId || i.roomId;
    if (id) { api.zoomTo([id]); if (i.appId) api.select([i.appId]); }
  }
  // section du panneau Étapes
  function mount(el) {
    if (!el) return;
    let I = [];
    try { I = issues(); } catch (e) { el.innerHTML = ""; return; }
    const V = api.normeVersion(), asked = new Set((api.cab.questions || []).map((q) => q.key));
    const open = I.filter((i) => i.question && !asked.has(i.key));
    el.innerHTML = `<details class="nm-sec" id="nm-sec-d" ${I.length ? "open" : ""}><summary title="Minimums de la NF C 15-100 pour le logement : alertes simples, rien n'est bloqué"><b>Norme</b> <span class="mut sm">${esc(V.court)}${V.sure ? "" : " · date du permis à renseigner (accueil)"}</span> <span class="nm-n ${I.length ? "bad" : "okk"}" id="nm-n">${I.length ? `${I.length} sous le minimum` : "minimums respectés"}</span></summary>
      ${I.length ? `<p class="sm mut">Alertes simples (rien n'est bloqué). « Voulu » : le point ne s'affiche plus et reste dans le rapport.</p>
      ${open.length ? `<p><button id="nm-ask" title="Ajoute les questions à la liste « Questions au pavillonneur » du rapport d'analyse">Poser ${open.length} question${open.length > 1 ? "s" : ""} au pavillonneur</button></p>` : ""}
      <ul class="nm-list">${I.map((i, k) => `<li data-i="${k}"><span class="nm-code" title="${esc(i.ref)}">${esc(i.code)}</span> ${esc(i.text)}
        <span class="wrow nm-act"><button class="lnk" data-see="${k}" title="Montre la pièce sur le plan">Voir</button>${i.question ? (asked.has(i.key) ? `<span class="sm mut">question posée</span>` : `<button class="lnk" data-q="${k}" title="Ajoute la question au rapport d'analyse">Question au pavillonneur</button>`) : ""}<button class="lnk" data-keep="${k}" title="Minimum non retenu, voulu (noté qui / quand dans les décisions)">Voulu</button></span></li>`).join("")}</ul>` : `<p class="sm mut">Prises, éclairage et RJ45 : minimums de la norme respectés sur les pièces nommées.</p>`}
    </details>`;
    el.querySelectorAll("[data-see]").forEach((b) => (b.onclick = () => show(I[+b.dataset.see])));
    el.querySelectorAll("[data-q]").forEach((b) => (b.onclick = () => { ask([I[+b.dataset.q]]); mount(el); }));
    el.querySelectorAll("[data-keep]").forEach((b) => (b.onclick = () => { decide(I[+b.dataset.keep], { choix: "garde", label: "minimum de la norme non retenu (voulu)" }); mount(el); }));
    const a = el.querySelector("#nm-ask"); if (a) a.onclick = () => { const n = ask(open); api.setHint(`${n} question${n > 1 ? "s" : ""} au pavillonneur ajoutée${n > 1 ? "s" : ""} au rapport d'analyse.`); mount(el); };
  }
  // lecture du plan avant dessin : après un relevé IA qui a ajouté des appareils
  document.addEventListener("okteo:ai-releve", (e) => {
    if (!(e.detail && e.detail.devices)) return;
    setTimeout(() => {
      let n = 0;
      try { n = issues().length; } catch { return; }
      if (!n) return;
      const h = document.getElementById("hint");
      if (h) h.textContent = (h.textContent ? h.textContent + " — " : "") + `Norme : ${n} point${n > 1 ? "s" : ""} sous le minimum (panneau Étapes → Norme).`;
      document.dispatchEvent(new CustomEvent("okteo:norme-lecture", { detail: { n } }));
    }, 300);
  });
  return { issues, all, mount, ask, show };
}
