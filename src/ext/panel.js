// Panneaux (v41) :
// - les onglets (Propriétés, Câblage, Packs, Étapes) sont des boutons du bandeau du haut, groupe « Panneaux » (#panes) ;
//   un clic ouvre le panneau à droite, un 2e clic sur le même bouton le ferme ; la croix du panneau le ferme aussi ;
// - l'assistant n'est plus dans ce panneau : il a son propre encart en bas à droite du plan (#as-dock), réduit par
//   défaut, agrandi au clic ;
// - largeur réglable en tirant le bord gauche ; état mémorisé sur ce PC.
import { store, storeSet } from "./util.js";

const KEY = "okteo.side.v2"; // v2 : panneau plus étroit par défaut (l'ancienne largeur mémorisée est abandonnée)
const W_DEF = 280, W_MIN = 220;

export function createSidePanel() {
  const side = document.getElementById("side"), head = document.getElementById("side-head"), grip = document.getElementById("side-grip");
  const bar = document.getElementById("panes");
  const panes = [{ id: "props", label: "Propriétés", icon: "☰", tip: "Réglages de l'objet sélectionné, calques et résumé du chantier", el: document.getElementById("sidebody") }];
  let st = { w: W_DEF, pane: "props", collapsed: false, dock: false, ...store(KEY, {}) };
  if (st.pane === "assistant") st.pane = "props";
  const listeners = new Set();
  let dock = null; // { id, el, root }

  function apply() {
    side.classList.toggle("collapsed", st.collapsed);
    side.style.width = st.collapsed ? "" : st.w + "px";
    // le volet mémorisé peut appartenir à une extension pas encore enregistrée : on l'attend sans l'oublier
    const cur = panes.find((p) => p.id === st.pane) ? st.pane : "props";
    const P = panes.find((p) => p.id === cur);
    panes.forEach((p) => { p.el.hidden = p.id !== cur; });
    head.innerHTML = `<span class="ic">${P.icon}</span><b class="ttl">${P.label}</b><span class="grow"></span>`
      + `<button class="col" title="Fermer le panneau (le rouvrir : bouton « ${P.label} » en haut)">✕</button>`;
    head.querySelector(".col").onclick = () => { st.collapsed = true; save(); apply(); };
    if (bar) {
      bar.innerHTML = panes.map((p) => `<button data-pane="${p.id}" class="${!st.collapsed && p.id === cur ? "on" : ""}" aria-pressed="${!st.collapsed && p.id === cur}" title="${p.tip || p.label} — un 2e clic ferme le panneau"><span class="ic">${p.icon}</span>${p.label}</button>`).join("");
      bar.querySelectorAll("button[data-pane]").forEach((b) => (b.onclick = () => toggle(b.dataset.pane)));
    }
    if (dock) {
      dock.root.classList.toggle("open", st.dock);
      dock.el.hidden = !st.dock;
      dock.root.querySelector(".dk-pill").setAttribute("aria-expanded", String(st.dock));
    }
    listeners.forEach((f) => f(st));
  }
  const save = () => storeSet(KEY, { w: st.w, pane: st.pane, collapsed: st.collapsed, dock: st.dock });

  // encart de l'assistant, en bas à droite de la zone de dessin
  function mountDock({ id, label, icon }) {
    const root = document.getElementById("as-dock");
    root.innerHTML = `<button class="dk-pill" title="${label} : poser une question, analyser le plan (touche A)"><span class="ic">${icon}</span>${label}<kbd>A</kbd></button>
      <div class="dk-card"><div class="dk-head"><span class="ic">${icon}</span><b>${label}</b><span class="grow"></span>
        <button class="dk-min" title="Réduire l'assistant (Échap)">—</button></div><div class="pane dk-body" data-pane="${id}"></div></div>`;
    const el = root.querySelector(".dk-body");
    root.querySelector(".dk-pill").onclick = () => { st.dock = true; save(); apply(); };
    root.querySelector(".dk-min").onclick = () => { st.dock = false; save(); apply(); };
    root.addEventListener("keydown", (e) => { if (e.key === "Escape" && st.dock) { e.stopPropagation(); st.dock = false; save(); apply(); } });
    dock = { id, el, root };
    apply();
    return el;
  }

  function register({ id, label, icon, tip, dock: inDock }) {
    if (inDock) return mountDock({ id, label, icon });
    const el = document.createElement("div");
    el.className = "pane"; el.dataset.pane = id; el.hidden = true;
    side.appendChild(el);
    panes.push({ id, label, icon, tip, el });
    apply();
    return el;
  }
  function show(id) {
    if (dock && id === dock.id) st.dock = true;
    else { st.pane = id; st.collapsed = false; }
    save(); apply();
  }
  function toggle(id) {
    if (dock && id === dock.id) st.dock = !st.dock;
    else if (!st.collapsed && st.pane === id) st.collapsed = true;
    else { st.pane = id; st.collapsed = false; }
    save(); apply();
  }
  function close(id) {
    if (dock && (!id || id === dock.id)) st.dock = false;
    if (!id || id !== (dock && dock.id)) st.collapsed = true;
    save(); apply();
  }

  // élargir / rétrécir en tirant le bord gauche
  grip.addEventListener("pointerdown", (e) => {
    if (st.collapsed) return;
    e.preventDefault(); grip.setPointerCapture(e.pointerId);
    const x0 = e.clientX, w0 = side.getBoundingClientRect().width;
    side.classList.add("resizing");
    const move = (ev) => { st.w = Math.round(Math.max(W_MIN, Math.min(Math.min(760, innerWidth * 0.6), w0 - (ev.clientX - x0)))); side.style.width = st.w + "px"; };
    const up = () => { side.classList.remove("resizing"); grip.removeEventListener("pointermove", move); grip.removeEventListener("pointerup", up); save(); };
    grip.addEventListener("pointermove", move); grip.addEventListener("pointerup", up);
  });

  apply();
  return {
    register, show, toggle, close,
    get state() { return { ...st, open: st.collapsed ? null : st.pane }; },
    isOpen: (id) => (dock && id === dock.id ? st.dock : !st.collapsed && st.pane === id),
    onChange: (f) => listeners.add(f),
  };
}
