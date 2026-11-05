// v76 : écran « Analyse IA » = choix du mode (maquette page 8 de l'artefact logiciel dessin).
// Ouvert par « ✦ Analyse IA » (menu Relevé, #rv-ai) et par le bouton de l'étape 2 du Mode IA (#ia-rel).
// Quatre cartes (boutons aria-pressed, coche, bordure), indicateur durée / coût à 4 points, mention de bas de page,
// bouton de lancement désactivé (aria-disabled) tant qu'aucun mode disponible n'est choisi.
// Routage : mode 1 → relevé IA v75 inchangé (aiReleve.open, puis relectures selon le réglage de l'opérateur) ;
// modes 2 à 4 : affichés, sélectionnables, pas encore lançables (étapes suivantes).
// Échap ou ✕ ferme ; flèches gauche / droite passent d'une carte à l'autre.
import { MODES_IA, MODES_PAGE, modeOf, dossierRef, dotsLabel, launchState } from "../walls/ai-modes.js";
import { LOGO } from "./attente.js";
import { otherPages } from "./ai-cross.js";
import { recommendFor } from "./ai-reco.js";
import { esc as esc_ } from "./util.js";
import { pref } from "../prefs.js";
import { chantierScaleCheck } from "./pdf-page.js";

export function createAiModes({ api, aiReleve, runner = null }) {
  const el = document.createElement("div");
  el.className = "am"; el.id = "ai-modes"; el.hidden = true;
  el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-labelledby", "am-title");
  document.body.appendChild(el);
  // v76 : reco = recommandation calculée sur le plan (acceptée ou non par l'opérateur) ; esc = escalade proposée
  let sel = null, launched = null, back = null, docs = [], pages = null, reco = null, esc = null, recoTok = 0, scale = null;   // v76 : documents joints pour le contrôle croisé (mode 4)

  const dots = (pts) => `<span class="am-dots" role="img" aria-label="${esc_(dotsLabel(pts))}">${[1, 2, 3, 4].map((i) => `<span class="am-dot${i <= pts ? " on" : ""}"></span>`).join("")}</span>`;
  // v76 : carte = élément « bouton » (role, aria-pressed, Entrée / Espace) et non <button> : le texte doit pouvoir défiler
  // DANS la carte (zone .am-scroll) pour que tout l'écran tienne sur une page — un <button> ne défile pas partout
  const card = (m) => `<div role="button" tabindex="0" class="am-card${sel === m.n ? " sel" : ""}${m.ready ? "" : " soon"}" data-mode="${m.n}" aria-pressed="${sel === m.n}"
      title="${esc_(m.ready ? `Mode ${m.n} : ${m.title}. Cliquez pour le choisir, puis « Lancer l'analyse ».` : `Mode ${m.n} : ${m.title} — en préparation, arrive dans une prochaine version.`)}">
      <span class="am-top"><span class="am-lab">Mode ${m.n}${(esc ? esc.to : reco && reco.mode) === m.n ? `<span class="am-reco-tag">${esc ? "Proposé" : "Recommandé"}</span>` : ""}</span><span class="am-ring" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg></span></span>
      <span class="am-title">${esc_(m.title)}</span>
      <span class="am-hook">${esc_(m.hook)}</span>
      <span class="am-div"></span>
      <span class="am-scroll" title="">
        <span class="am-desc">${esc_(m.desc)}</span>
        <span class="am-recobox"><span class="am-lab am-small">Recommandé pour</span><span class="am-recotxt">${esc_(m.reco)}</span></span>
        ${m.ready ? "" : `<span class="am-soon">En préparation : prochaine version</span>`}
      </span>
      <span class="am-cost"><span class="am-costlab">Durée / coût</span>${dots(m.pts)}</span>
    </div>`;

  function render() {
    const L = launchState(sel);
    el.innerHTML = `<div class="am-in">
      <div class="am-head">
        <div class="am-brand">${LOGO}<span class="brand-word">okt<span class="brand-e">e</span>o</span></div>
        <div class="am-headr"><span class="am-ref" title="Référence du dossier (fiche du chantier)">${esc_(dossierRef(api.ch).toUpperCase())}</span>
          <button type="button" class="am-x" title="Fermer (Échap)" aria-label="Fermer">✕</button></div>
      </div>
      <div class="am-intro"><h1 id="am-title">${esc_(MODES_PAGE.title)}</h1><p>${esc_(MODES_PAGE.intro)}</p></div>
      ${only4() ? "" : bannerHTML()}
      ${scaleHTML()}
      <div class="am-grid${only4() ? " one" : ""}" role="group" aria-label="Modes d'analyse">${(only4() ? MODES_IA.filter((m) => m.n === 4) : MODES_IA).map(card).join("")}</div>
      ${sel === 4 ? docsHTML() : ""}
      <div class="am-foot"><p>${esc_(MODES_PAGE.foot)}</p>
        <button type="button" class="am-cta" id="am-go" aria-disabled="${!L.ok}" title="${esc_(L.why)}">${esc_(L.label)}</button></div>
    </div>`;
    el.querySelectorAll("[data-scale]").forEach((b) => (b.onclick = () => { close(); if (b.dataset.scale === "calib") api.startCalib(); else document.dispatchEvent(new CustomEvent("okteo:walls")); }));
    el.querySelectorAll(".am-card").forEach((b) => {
      b.onclick = () => select(+b.dataset.mode, true);
      b.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(+b.dataset.mode, true); } };
    });
    // texte plus long que la carte : dégradé en bas de la zone et « faites défiler » dans l'infobulle
    el.querySelectorAll(".am-scroll").forEach((z) => {
      const mark = () => { const more = z.scrollHeight > z.clientHeight + 2; z.classList.toggle("more", more && z.scrollTop + z.clientHeight < z.scrollHeight - 2); z.title = more ? "Faites défiler pour lire la suite" : ""; };
      z.onscroll = mark; requestAnimationFrame(mark);
    });
    el.querySelector(".am-x").onclick = close;
    const rb = el.querySelector("#am-reco-ok"); if (rb) rb.onclick = () => select(esc ? esc.to : reco.mode, true);
    const fi = el.querySelector("#am-docs-file");
    if (fi) fi.onchange = () => { docs.push(...[...fi.files].filter((f) => !docs.some((d) => d.name === f.name && d.size === f.size))); render(); };
    el.querySelectorAll("[data-rmdoc]").forEach((b) => (b.onclick = () => { docs.splice(+b.dataset.rmdoc, 1); render(); }));
    el.querySelector("#am-go").onclick = launch;
  }

  // bandeau : escalade proposée (après une analyse), sinon recommandation d'après le plan — jamais choisie à la place de l'opérateur
  function bannerHTML() {
    const r = esc ? { mode: esc.to, why: [esc.why], kind: "esc" } : reco;
    if (!r) return `<p class="am-reco am-reco-wait" aria-live="polite">Analyse du plan pour vous recommander un mode…</p>`;
    const m = modeOf(r.mode);
    return `<div class="am-reco" aria-live="polite"><span>${r.kind === "esc" ? "<b>Relance proposée</b>" : "<b>Recommandé pour ce plan</b>"} : mode ${m.n} · ${esc_(m.title)} — <span class="am-why">${esc_(r.why.join(" ; "))}</span>${!esc && reco && reco.docs && m.n < 4 ? ` <span class="am-why">· ${reco.docs} autre${reco.docs > 1 ? "s" : ""} page${reco.docs > 1 ? "s" : ""} dans le PDF : le mode 4 peut les recouper.</span>` : ""}</span>
      ${sel === m.n ? "" : `<button type="button" class="am-reco-ok" id="am-reco-ok" title="Sélectionne ce mode ; vous pouvez en choisir un autre">Choisir ce mode</button>`}</div>`;
  }
  // v76 étape 4 : mode 4 = contrôle croisé avec les documents ; autres pages du PDF du chantier + documents joints
  function docsHTML() {
    const n = pages == null ? "…" : pages;
    return `<div class="am-docs" role="group" aria-label="Documents à recouper (mode 4)">
      <p><b>Documents à recouper avec le plan</b> — ${api.ch.dossier && pages > 0 ? `${pages} page${pages > 1 ? "s" : ""} du dossier (plan cuisine, devis, d'après le rôle des pages) jointe${pages > 1 ? "s" : ""} automatiquement ; ` : ""}${pages === 0 && !docs.length ? "aucune autre page dans le PDF du chantier : joignez le devis ou le plan cuisine, sinon le contrôle croisé sera désactivé (la seconde lecture se fait quand même)." : `${n} autre${pages === 1 ? "" : "s"} page${pages === 1 ? "" : "s"} dans le PDF du chantier${docs.length ? ` + ${docs.length} document${docs.length > 1 ? "s" : ""} joint${docs.length > 1 ? "s" : ""}` : ""}.`}</p>
      <div class="am-docrow"><label class="am-file" title="Devis, plan de cuisine, descriptif… (PDF ou image). Ils restent sur ce PC : seul leur contenu est envoyé à l'IA pour cette analyse.">＋ Joindre un devis / plan cuisine<input type="file" id="am-docs-file" multiple accept=".pdf,application/pdf,image/*"></label>
        ${docs.map((d, i) => `<span class="am-chip">${esc_(d.name)}<button type="button" data-rmdoc="${i}" aria-label="Retirer ${esc_(d.name)}" title="Retirer">✕</button></span>`).join("")}</div>
    </div>`;
  }
  // n° 3 + lot 1 du 05/11/2026 : un seul mode d'analyse, le mode 4 (modes 1 à 3 = étapes internes). Les 4 cartes ne
  // s'affichent plus que pour les essais du code (préférence « modesIA » = « dev », jamais proposée à l'écran).
  // Échelle bloquante si elle n'est pas confirmée.
  function only4() { return pref("modesIA") !== "dev"; }
  function scaleHTML() {
    if (scale == null || scale.ok) return "";
    return `<div class="am-scale warnbox" role="alert"><p><b>Échelle du plan non confirmée</b> — ${esc_(scale.why)} L'analyse est bloquée tant que l'échelle n'est pas juste (sinon tout le relevé serait décalé).</p>
      <p><button type="button" data-scale="walls" title="Relève les murs du PDF et règle l'échelle d'après les cotes">Relever les murs (règle l'échelle)</button> <button type="button" data-scale="calib" title="Deux points d'une cote connue, ou 1/50">Régler l'échelle à la main</button></p></div>`;
  }
  async function checkScale() {
    const f = api.ch.fond;
    if (!f) return { ok: true };
    if (!f.calibre) return { ok: false, why: "le fond n'a pas encore été mis à l'échelle." };
    const c = await chantierScaleCheck(api).catch(() => null);
    if (c && Math.abs(c.facteur - 1) > 0.03) return { ok: false, why: `les ${c.cotes} cotes lues sur le plan donnent un écart de ${Math.abs((c.facteur - 1) * 100).toFixed(1).replace(".", ",")} %.` };
    return { ok: true };
  }
  function select(n, focus = false) {
    if (!modeOf(n)) return;
    sel = n; render();
    if (n === 4 && pages == null) otherPages(api).then((k) => { pages = k; if (sel === 4) render(); }).catch(() => { pages = 0; if (sel === 4) render(); });
    if (focus) el.querySelector(`.am-card[data-mode="${n}"]`)?.focus();
  }

  function open({ escalade = null } = {}) {
    back = document.activeElement;
    sel = null; launched = null; pages = null; esc = escalade; scale = null;
    checkScale().then((r) => { scale = r; if (!el.hidden) render(); }).catch(() => { scale = { ok: true }; });
    // seul le dernier calcul compte (un calcul lancé par une ouverture précédente est ignoré)
    if (!esc) { reco = null; const tok = ++recoTok; recommendFor(api).then((r) => { if (tok !== recoTok) return; reco = r || { mode: 1, why: ["pas de plan sur ce niveau"], docs: 0 }; if (!el.hidden) render(); }).catch(() => { if (tok !== recoTok) return; reco = { mode: 1, why: ["mesure du plan impossible"], docs: 0 }; if (!el.hidden) render(); }); }
    if (only4()) select(4); else render();
    el.hidden = false; document.body.classList.add("am-on");
    el.querySelector(".am-card")?.focus();
  }
  function close() {
    if (el.hidden) return;
    el.hidden = true; document.body.classList.remove("am-on");
    if (back && back.focus && document.contains(back)) back.focus();
  }

  function launch() {
    const L = launchState(sel), m = modeOf(sel);
    if (scale && !scale.ok) { el.querySelector(".am-scale")?.animate?.([{ transform: "translateX(-4px)" }, { transform: "translateX(4px)" }, { transform: "none" }], { duration: 180 }); return false; }
    if (!L.ok) { el.querySelector("#am-go")?.animate?.([{ transform: "translateX(-4px)" }, { transform: "translateX(4px)" }, { transform: "none" }], { duration: 180 }); return false; }
    launched = m.n;
    close();
    // mode 1 : flux v75 inchangé (consigne, image, relecture automatique selon le réglage « Relectures automatiques »)
    if (m.n === 1) aiReleve.open({ mode: 1 });
    // modes 2 à 4 : lecture globale + tuiles (+ nettoyage / OCR, + seconde lecture et contrôle croisé) : ai-modes-run.js
    else if (runner) runner.run(m.n, { docs: docs.slice() });
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

  // escalade proposée par la relecture (ai-recheck-ui.js) : l'écran s'ouvre avec le mode supérieur mis en avant
  document.addEventListener("okteo:ai-escalade", (e) => { const d = e.detail || {}; if (d.to) open({ escalade: { to: d.to, why: d.why || "" } }); });
  // à l'import d'un plan : recommandation affichée dans la barre d'aide (une fois par fond)
  const seenFonds = new Set();
  document.addEventListener("okteo:fond", () => {
    const f = api.ch && api.ch.fond, k = f ? [api.ch.id, api.level && api.level.id, f.page, f.pxW].join("|") : "";
    if (!f || seenFonds.has(k)) return; seenFonds.add(k);
    setTimeout(() => recommendFor(api).then((r) => { if (r) api.setHint(`Plan prêt pour l'analyse IA — mode recommandé : ${r.mode} (${r.why.join(", ")}). Menu Relevé → « ✦ Analyse IA » pour accepter ou choisir un autre mode.`); }).catch(() => {}), 400);
  });
  return { open, close, select, launch, get reco() { return reco; }, get selected() { return sel; }, get launched() { return launched; }, get visible() { return !el.hidden; }, el };
}
