// MAJ norme n° 2 (06/11/2026, go de Kévin) : minimums par pièce de la NF C 15-100, en ALERTES SIMPLES (jamais bloquantes).
// - Panneau Étapes, sous les étapes : « Norme » = ce qui est sous le minimum (prises, éclairage, RJ45), pièce par pièce,
//   avec le code de la règle et l'article (bible Oktéo) ; « Voir » (zoom sur la pièce), « Question au pavillonneur »
//   (rapport d'analyse), « Voulu » (le point ne s'affiche plus ; noté dans les décisions, qui / quand).
// - Lecture du plan avant dessin : juste après un relevé IA, la ligne d'aide dit combien de points sont sous le minimum ;
//   « Poser les questions » les envoie toutes au rapport (questions au pavillonneur), avant de dessiner.
// Passe seulement par l'API (window.okteo).
import { checkPieces } from "../norme/pieces.js";
import { withParafoudre } from "../norme/parafoudre.js";
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
  // MAJ parafoudre : étude selon la norme (zone de foudre, arrivée, paratonnerre, sécurité des personnes) ; le BE garde la
  // main (« Avec » / « Sans ») : son choix est noté (qui, quand, étude initiale) pour le rapport.
  function pfHTML() {
    let P; try { P = api.parafoudre(); } catch { return ""; }
    const C = P.choix, Z = P.zone, sel = (v, a) => (v === a ? " selected" : "");
    const cls = P.etat === "obligatoire" ? "bad" : P.etat === "inconnu" ? "wait" : "okk";
    return `<div class="nm-pf" id="nm-pf"><b>Parafoudre</b> <span class="nm-n ${cls}" id="pf-etat" title="${esc(P.ref)}">${esc(P.texte)}</span>
      <div class="sm mut">${Z ? `Département ${esc(Z.dep)} · Nk ${String(Z.nk).replace(".", ",")} (${Z.aq2 ? "AQ2" : "AQ1"})` : "Code postal à renseigner (fiche du chantier, accueil)"}${P.raisons.length ? " · " + esc(P.raisons.join(" ; ")) : ""}${P.manque.length ? " · manque : " + esc(P.manque.join(", ")) : ""}</div>
      <div class="wrow nm-pf-f"><label title="Arrivée du réseau électrique jusqu'au logement">Arrivée <select id="pf-arr"><option value=""${sel(C.arrivee, "")}>à préciser</option><option value="aerien"${sel(C.arrivee, "aerien")}>aérienne (même en partie)</option><option value="souterrain"${sel(C.arrivee, "souterrain")}>souterraine</option></select></label>
      <label title="Paratonnerre sur la maison ou sur un bâtiment à moins de 50 m : parafoudre de type 1 obligatoire"><input type="checkbox" id="pf-para"${C.paratonnerre ? " checked" : ""}> paratonnerre</label>
      <label title="Matériel médical à domicile, alarme liée à la sécurité des personnes"><input type="checkbox" id="pf-secu"${C.securite ? " checked" : ""}> sécurité des personnes</label>
      <label title="Arrivée téléphone / internet en cuivre (2024 : parafoudre de communication si la puissance en a un)"><input type="checkbox" id="pf-com"${C.comCuivre ? " checked" : ""}> communication en cuivre</label></div>
      <div class="wrow"><label title="Le BE peut toujours passer outre : son choix est noté et apparaît dans le rapport (étude initiale / modifications)">Choix du BE <select id="pf-be"><option value="auto"${sel(C.be, "auto")}>selon l'étude (${P.auto ? "avec" : "sans"})</option><option value="oui"${sel(C.be, "oui")}>avec parafoudre</option><option value="non"${sel(C.be, "non")}>sans parafoudre</option></select></label>
      ${C.be !== "auto" ? `<input id="pf-motif" placeholder="motif (facultatif)" value="${esc(C.motif || "")}" title="Motif du choix du BE, repris dans le rapport">` : ""}</div>
      ${P.ecart ? `<div class="sm nm-warn" id="pf-ecart">Différent de l'étude initiale (${esc(P.texte.toLowerCase())}) : noté au rapport${C.by ? ` — ${esc(C.by)}` : ""}.</div>` : ""}
      ${P.com ? `<div class="sm mut">PF-03 : parafoudre de communication à prévoir au tableau de communication.</div>` : ""}</div>`;
  }
  function pfSave(patch, el) {
    const before = api.parafoudre(), C = { ...before.choix, ...patch };
    if ("be" in patch) { if (patch.be === "auto") { delete C.by; delete C.at; delete C.initial; delete C.motif; } else Object.assign(C, { by: who(), at: new Date().toISOString(), initial: before.texte }); }
    const choix = { ...(api.cab.choix || {}), parafoudre: C };
    api.batch(() => {
      api.setCab({ choix });
      const P = api.parafoudre(), T = api.cab.tableau;
      if (T && T.rows) api.setCab({ tableau: { ...T, rows: withParafoudre(T.rows, P.avec, P.type) } });
    });
    const P = api.parafoudre();
    api.setHint(`${P.avec ? "Parafoudre retenu" : "Sans parafoudre"}${P.ecart ? " (choix du BE, différent de l'étude : noté au rapport)" : ""}. Tableau mis à jour.`);
    mount(el);
  }
  function pfWire(el) {
    const q = (s) => el.querySelector(s);
    if (!q("#nm-pf")) return;
    q("#pf-arr").onchange = (e) => pfSave({ arrivee: e.target.value }, el);
    q("#pf-para").onchange = (e) => pfSave({ paratonnerre: e.target.checked }, el);
    q("#pf-secu").onchange = (e) => pfSave({ securite: e.target.checked }, el);
    q("#pf-com").onchange = (e) => pfSave({ comCuivre: e.target.checked }, el);
    q("#pf-be").onchange = (e) => pfSave({ be: e.target.value }, el);
    const m = q("#pf-motif"); if (m) m.onchange = () => pfSave({ motif: m.value.trim() }, el);
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
    </details>${pfHTML()}`;
    pfWire(el);
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
