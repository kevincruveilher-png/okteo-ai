// Loupe des pages du dossier PDF (06/11/2026, demande de Kévin) : à l'import d'un PDF de plusieurs pages, chaque
// vignette a une loupe (ou double-clic) qui ouvre la page en grand, rendue en haute définition à la demande.
// Zoom à la molette (autour du pointeur), déplacement en glissant, double-clic = ajuster, flèches ← → = page
// précédente / suivante, rôle de la page modifiable, « Prendre cette page comme plan », Échap ou ✕ = fermer.
// Aucune donnée du chantier n'est modifiée ici : tout passe par les fonctions données par la page Chantiers.
import { renderPdfPage } from "./fond-import.js";
import { ROLES, roleLabel } from "../walls/page-roles.js";
import { esc } from "./util.js";

const HD = 2600; // côté le plus long du rendu (px) : assez pour lire un cartouche, rapide à rendre

// o = { doc, pages: [n…], page, roleOf(p) → {role, conf, why}, onRole(p, role), onPick(p), isPicked(p), pickLabel }
export function openLoupe(o) {
  const cache = new Map(); // n° de page → URL de l'image haute définition
  let cur = o.page, z = 1, tx = 0, ty = 0, drag = null, gen = 0;
  const el = document.createElement("div");
  el.className = "pgl"; el.id = "pg-loupe";
  el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true");
  el.innerHTML = `<div class="pgl-bar">
      <button type="button" class="pgl-nav" data-d="-1" title="Page précédente (←)" aria-label="Page précédente">←</button>
      <b class="pgl-n"></b>
      <button type="button" class="pgl-nav" data-d="1" title="Page suivante (→)" aria-label="Page suivante">→</button>
      <label class="pgl-rl">Rôle <select class="pgl-role" aria-label="Rôle de la page">${ROLES.map((k) => `<option value="${k}">${esc(roleLabel(k))}</option>`).join("")}</select></label>
      <button type="button" class="on pgl-pick"></button>
      <span class="pgl-sp"></span>
      <button type="button" class="pgl-z" data-z="out" title="Dézoomer" aria-label="Dézoomer">−</button>
      <button type="button" class="pgl-z" data-z="fit" title="Page entière (double-clic sur l'image)">Ajuster</button>
      <button type="button" class="pgl-z" data-z="in" title="Zoomer" aria-label="Zoomer">+</button>
      <button type="button" class="pgl-x" title="Fermer (Échap)" aria-label="Fermer">✕</button>
    </div>
    <div class="pgl-stage"><img class="pgl-img" alt="" draggable="false"><p class="pgl-wait">Rendu de la page en grand…</p></div>
    <p class="pgl-help mut">Molette : zoom · glisser : déplacer · double-clic : page entière · ← → : page précédente / suivante · Échap : fermer</p>`;
  document.body.appendChild(el);
  const $ = (s) => el.querySelector(s);
  const stage = $(".pgl-stage"), img = $(".pgl-img"), wait = $(".pgl-wait");

  const apply = () => { img.style.transform = `translate(${tx}px, ${ty}px) scale(${z})`; };
  function fit() {
    const W = stage.clientWidth, H = stage.clientHeight, w = img.naturalWidth || 1, h = img.naturalHeight || 1;
    z = Math.min(W / w, H / h) * 0.98; tx = (W - w * z) / 2; ty = (H - h * z) / 2; apply();
  }
  function zoomAt(f, cx, cy) {
    const nz = Math.max(0.05, Math.min(8, z * f)); const k = nz / z;
    tx = cx - (cx - tx) * k; ty = cy - (cy - ty) * k; z = nz; apply();
  }
  function bar() {
    const i = o.pages.indexOf(cur);
    $(".pgl-n").textContent = `Page ${cur} / ${o.pages.length}`;
    el.querySelector('.pgl-nav[data-d="-1"]').disabled = i <= 0;
    el.querySelector('.pgl-nav[data-d="1"]').disabled = i >= o.pages.length - 1;
    const r = o.roleOf(cur) || {}; const s = $(".pgl-role"); s.value = r.role || "ignorer";
    s.classList.toggle("doubt", r.conf != null && r.conf < 0.6);
    s.title = r.why ? "Proposé par Oktéo : " + r.why + (r.conf < 0.6 ? " (à vérifier)" : "") : "Rôle de la page";
    const pk = $(".pgl-pick"), on = o.isPicked(cur);
    pk.textContent = on ? "✓ Page prise comme plan" : o.pickLabel; pk.disabled = on;
  }
  async function show(p) {
    cur = p; bar(); const g = ++gen;
    let url = cache.get(p);
    if (!url) {
      img.hidden = true; wait.hidden = false; wait.textContent = "Rendu de la page en grand…";
      try { const r = await renderPdfPage(o.doc, p, HD); url = URL.createObjectURL(r.blob); cache.set(p, url); }
      catch (e) { if (g === gen) wait.textContent = "Page illisible : " + e.message; return; }
    }
    if (g !== gen) return; // une autre page a été demandée entre-temps
    img.onload = () => { if (g !== gen) return; wait.hidden = true; img.hidden = false; fit(); };
    img.src = url; img.alt = "Page " + p;
  }
  const go = (d) => { const i = o.pages.indexOf(cur) + d; if (i >= 0 && i < o.pages.length) show(o.pages[i]); };

  function close() {
    document.removeEventListener("keydown", onKey, true); window.removeEventListener("resize", fit);
    el.remove(); for (const u of cache.values()) URL.revokeObjectURL(u);
    if (o.onClose) o.onClose();
  }
  function onKey(e) {
    if (e.target && e.target.tagName === "SELECT" && (e.key === "ArrowLeft" || e.key === "ArrowRight")) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") go(-1);
    else if (e.key === "ArrowRight") go(1);
    else if (e.key === "+" || e.key === "=") zoomAt(1.25, stage.clientWidth / 2, stage.clientHeight / 2);
    else if (e.key === "-") zoomAt(0.8, stage.clientWidth / 2, stage.clientHeight / 2);
    else return;
    e.preventDefault(); e.stopPropagation();
  }
  document.addEventListener("keydown", onKey, true);
  window.addEventListener("resize", fit);

  el.querySelectorAll(".pgl-nav").forEach((b) => (b.onclick = () => go(+b.dataset.d)));
  $(".pgl-x").onclick = close;
  el.querySelectorAll(".pgl-z").forEach((b) => (b.onclick = () => {
    const W = stage.clientWidth / 2, H = stage.clientHeight / 2;
    if (b.dataset.z === "fit") fit(); else zoomAt(b.dataset.z === "in" ? 1.25 : 0.8, W, H);
  }));
  $(".pgl-role").onchange = (e) => { o.onRole(cur, e.target.value); bar(); };
  $(".pgl-pick").onclick = () => { o.onPick(cur); bar(); };
  el.onclick = (e) => { if (e.target === el) close(); }; // clic sur le fond sombre
  stage.addEventListener("wheel", (e) => {
    e.preventDefault(); const b = stage.getBoundingClientRect();
    zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - b.left, e.clientY - b.top);
  }, { passive: false });
  stage.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, tx, ty }; stage.setPointerCapture(e.pointerId); stage.classList.add("drag"); });
  stage.addEventListener("pointermove", (e) => { if (!drag) return; tx = drag.tx + e.clientX - drag.x; ty = drag.ty + e.clientY - drag.y; apply(); });
  const up = () => { drag = null; stage.classList.remove("drag"); };
  stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", up);
  stage.addEventListener("dblclick", fit);

  show(cur);
  $(".pgl-x").focus();
  return { close, show, get page() { return cur; }, get zoom() { return z; }, el };
}
