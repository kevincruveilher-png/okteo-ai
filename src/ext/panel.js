// Panneau de droite façon « extension » (comme le panneau Claude dans VS Code) :
// - onglets en haut : Propriétés (fixe) + chaque extension enregistrée (Assistant, plus tard Règles, Boîtes…) ;
// - largeur réglable en tirant le bord gauche ; repliable ;
// - état mémorisé sur ce PC.
import { store, storeSet } from "./util.js";

const KEY = "okteo.side.v1";

export function createSidePanel() {
  const side = document.getElementById("side"), head = document.getElementById("side-head"), grip = document.getElementById("side-grip");
  const panes = [{ id: "props", label: "Propriétés", icon: "☰", el: document.getElementById("sidebody") }];
  let st = { w: 300, pane: "props", collapsed: false, ...store(KEY, {}) };
  const listeners = new Set();

  function apply() {
    side.classList.toggle("collapsed", st.collapsed);
    side.style.width = st.collapsed ? "" : st.w + "px";
    // le volet mémorisé peut appartenir à une extension pas encore enregistrée : on l'attend sans l'oublier
    const cur = panes.find((p) => p.id === st.pane) ? st.pane : "props";
    panes.forEach((p) => { p.el.hidden = p.id !== cur; });
    head.innerHTML = panes.map((p) => `<button data-pane="${p.id}" class="${p.id === cur ? "on" : ""}" title="${p.label}"><span class="ic">${p.icon}</span><span class="lbl">${p.label}</span></button>`).join("")
      + `<span class="grow"></span><button class="col" title="${st.collapsed ? "Déplier le panneau" : "Replier le panneau"}">${st.collapsed ? "⟨" : "⟩"}</button>`;
    head.querySelectorAll("button[data-pane]").forEach((b) => (b.onclick = () => show(b.dataset.pane)));
    head.querySelector(".col").onclick = () => { st.collapsed = !st.collapsed; save(); apply(); };
    document.getElementById("btn-assistant")?.classList.toggle("on", !st.collapsed && cur === "assistant");
    listeners.forEach((f) => f(st));
  }
  const save = () => storeSet(KEY, { w: st.w, pane: st.pane, collapsed: st.collapsed });

  function register({ id, label, icon }) {
    const el = document.createElement("div");
    el.className = "pane"; el.dataset.pane = id; el.hidden = true;
    side.appendChild(el);
    panes.push({ id, label, icon, el });
    apply();
    return el;
  }
  function show(id) { st.pane = id; st.collapsed = false; save(); apply(); }
  function toggle(id) { if (!st.collapsed && st.pane === id) { st.collapsed = true; } else { st.pane = id; st.collapsed = false; } save(); apply(); }

  // élargir / rétrécir en tirant le bord gauche
  grip.addEventListener("pointerdown", (e) => {
    if (st.collapsed) return;
    e.preventDefault(); grip.setPointerCapture(e.pointerId);
    const x0 = e.clientX, w0 = side.getBoundingClientRect().width;
    side.classList.add("resizing");
    const move = (ev) => { st.w = Math.round(Math.max(220, Math.min(Math.min(760, innerWidth * 0.6), w0 - (ev.clientX - x0)))); side.style.width = st.w + "px"; };
    const up = () => { side.classList.remove("resizing"); grip.removeEventListener("pointermove", move); grip.removeEventListener("pointerup", up); save(); };
    grip.addEventListener("pointermove", move); grip.addEventListener("pointerup", up);
  });

  apply();
  return { register, show, toggle, get state() { return { ...st }; }, onChange: (f) => listeners.add(f) };
}
