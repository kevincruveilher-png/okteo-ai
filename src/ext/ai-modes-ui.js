// v76 : écran « Analyse IA » = choix du mode (maquette page 8 de l'artefact logiciel dessin).
// Ouvert par « ✦ Analyse IA » (menu Relevé, #rv-ai) et par le bouton de l'étape 2 du Mode IA (#ia-rel).
// Quatre cartes (boutons aria-pressed, coche, bordure), indicateur durée / coût à 4 points, mention de bas de page,
// bouton de lancement désactivé (aria-disabled) tant qu'aucun mode disponible n'est choisi.
// Routage : mode 1 → relevé IA v75 inchangé (aiReleve.open, puis relectures selon le réglage de l'opérateur) ;
// modes 2 à 4 : affichés, sélectionnables, pas encore lançables (étapes suivantes).
// Échap ou ✕ ferme ; flèches gauche / droite passent d'une carte à l'autre.
import { MODES_IA, MODES_PAGE, modeOf, dossierRef, dotsLabel, launchState } from "../walls/ai-modes.js";
import { LOGO } from "./attente.js";
import { esc } from "./util.js";

export function createAiModes({ api, aiReleve }) {
  const el = document.createElement("div");
  el.className = "am"; el.id = "ai-modes"; el.hidden = true;
  el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-labelledby", "am-title");
  document.body.appendChild(el);
  let sel = null, launched = null, back = null;

  const dots = (pts) => `<span class="am-dots" role="img" aria-label="${esc(dotsLabel(pts))}">${[1, 2, 3, 4].map((i) => `<span class="am-dot${i <= pts ? " on" : ""}"></span>`).join("")}</span>`;
  const card = (m) => `<button type="button" class="am-card${sel === m.n ? " sel" : ""}${m.ready ? "" : " soon"}" data-mode="${m.n}" aria-pressed="${sel === m.n}"
      title="${esc(m.ready ? `Mode ${m.n} : ${m.title}. Cliquez pour le choisir, puis « Lancer l'analyse ».` : `Mode ${m.n} : ${m.title} — en préparation, arrive dans une prochaine version.`)}">
      <span class="am-top"><span class="am-lab">Mode ${m.n}</span><span class="am-ring" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#04284A" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg></span></span>
      <span class="am-title">${esc(m.title)}</span>
      <span class="am-hook">${esc(m.hook)}</span>
      <span class="am-div"></span>
      <span class="am-desc">${esc(m.desc)}</span>
      <span class="am-bottom">
        <span><span class="am-lab am-small">Recommandé pour</span><span class="am-reco">${esc(m.reco)}</span></span>
        ${m.ready ? "" : `<span class="am-soon">En préparation : prochaine version</span>`}
        <span class="am-cost"><span class="am-costlab">Durée / coût</span>${dots(m.pts)}</span>
      </span>
    </button>`;

  function render() {
    const L = launchState(sel);
    el.innerHTML = `<div class="am-in">
      <div class="am-head">
        <div class="am-brand">${LOGO}<span class="brand-word">okt<span class="brand-e">e</span>o</span></div>
        <div class="am-headr"><span class="am-ref" title="Référence du dossier (fiche du chantier)">${esc(dossierRef(api.ch).toUpperCase())}</span>
          <button type="button" class="am-x" title="Fermer (Échap)" aria-label="Fermer">✕</button></div>
      </div>
      <div class="am-intro"><h1 id="am-title">${esc(MODES_PAGE.title)}</h1><p>${esc(MODES_PAGE.intro)}</p></div>
      <div class="am-grid" role="group" aria-label="Modes d'analyse">${MODES_IA.map(card).join("")}</div>
      <div class="am-foot"><p>${esc(MODES_PAGE.foot)}</p>
        <button type="button" class="am-cta" id="am-go" aria-disabled="${!L.ok}" title="${esc(L.why)}">${esc(L.label)}</button></div>
    </div>`;
    el.querySelectorAll(".am-card").forEach((b) => (b.onclick = () => select(+b.dataset.mode, true)));
    el.querySelector(".am-x").onclick = close;
    el.querySelector("#am-go").onclick = launch;
  }

  function select(n, focus = false) {
    if (!modeOf(n)) return;
    sel = n; render();
    if (focus) el.querySelector(`.am-card[data-mode="${n}"]`)?.focus();
  }

  function open() {
    back = document.activeElement;
    sel = null; launched = null;
    render(); el.hidden = false; document.body.classList.add("am-on");
    el.querySelector(".am-card")?.focus();
  }
  function close() {
    if (el.hidden) return;
    el.hidden = true; document.body.classList.remove("am-on");
    if (back && back.focus && document.contains(back)) back.focus();
  }

  function launch() {
    const L = launchState(sel), m = modeOf(sel);
    if (!L.ok) { el.querySelector("#am-go")?.animate?.([{ transform: "translateX(-4px)" }, { transform: "translateX(4px)" }, { transform: "none" }], { duration: 180 }); return false; }
    launched = m.n;
    close();
    // mode 1 : flux v75 inchangé (consigne, image, relecture automatique selon le réglage « Relectures automatiques »)
    if (m.n === 1) aiReleve.open({ mode: 1 });
    return true;
  }

  el.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.stopPropagation(); close(); return; }
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      const cur = +(document.activeElement && document.activeElement.dataset && document.activeElement.dataset.mode) || 0;
      if (!cur) return;
      const n = Math.min(4, Math.max(1, cur + (e.key === "ArrowRight" ? 1 : -1)));
      el.querySelector(`.am-card[data-mode="${n}"]`)?.focus(); e.preventDefault();
    }
  });

  return { open, close, select, launch, get selected() { return sel; }, get launched() { return launched; }, get visible() { return !el.hidden; }, el };
}
