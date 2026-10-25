// Palette « Toutes les fonctions » (Ctrl+K) : liste classée + recherche + exécution.
import { CATS } from "./catalog.js";
import { esc, norm } from "./util.js";

export function searchCatalog(catalog, q) {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return catalog;
  return catalog
    .map((c) => {
      const lab = norm(c.label), all = norm(`${c.label} ${c.desc} ${c.keys} ${c.cat}`);
      if (!words.every((w) => all.includes(w))) return null;
      const score = words.reduce((s, w) => s + (lab.startsWith(w) ? 3 : lab.includes(w) ? 2 : 1), 0) + (c.run ? 0.5 : 0);
      return { c, score };
    })
    .filter(Boolean).sort((a, b) => b.score - a.score).map((x) => x.c);
}

export function createPalette({ getCatalog, onAsk }) {
  const root = document.createElement("div");
  root.className = "pal-back"; root.hidden = true;
  root.innerHTML = `<div class="pal" role="dialog" aria-label="Toutes les fonctions">
    <div class="pal-top"><input class="pal-q" placeholder="Chercher une fonction… (ex. prise, porte, annuler)" autocomplete="off"><kbd>Échap</kbd></div>
    <div class="pal-list"></div>
    <div class="pal-foot"><span>↑↓ choisir · Entrée lancer</span><button class="pal-ask">✦ Demander à l'assistant</button></div>
  </div>`;
  document.body.appendChild(root);
  const q = root.querySelector(".pal-q"), list = root.querySelector(".pal-list");
  let items = [], cur = 0;

  function render() {
    const cat = getCatalog();
    items = searchCatalog(cat, q.value);
    const grouped = q.value.trim() === "";
    if (grouped) items = CATS.flatMap((k) => items.filter((c) => c.cat === k));
    let h = "";
    if (!items.length) h = `<div class="pal-empty">Aucune fonction ne correspond. Essayez un autre mot, ou demandez à l'assistant.</div>`;
    if (grouped) {
      for (const k of CATS) {
        const g = items.filter((c) => c.cat === k); if (!g.length) continue;
        h += `<div class="pal-cat">${k}</div>` + g.map(row).join("");
      }
    } else h += items.map(row).join("");
    list.innerHTML = h;
    cur = Math.min(cur, Math.max(0, items.length - 1));
    paint();
    list.querySelectorAll(".pal-row").forEach((el) => {
      el.onmousemove = () => { cur = +el.dataset.i; paint(false); };
      el.onclick = () => runAt(+el.dataset.i);
    });
  }
  function row(c) {
    const i = items.indexOf(c);
    return `<div class="pal-row ${c.run ? "" : "info"}" data-i="${i}">
      <div class="pal-l"><b>${esc(c.label)}</b><span>${esc(c.desc)}</span></div>
      <div class="pal-r">${c.keys ? `<kbd>${esc(c.keys)}</kbd>` : ""}${c.run ? "" : `<em>mode d'emploi</em>`}</div></div>`;
  }
  function paint(scroll = true) {
    list.querySelectorAll(".pal-row").forEach((el) => el.classList.toggle("cur", +el.dataset.i === cur));
    if (scroll) list.querySelector(".pal-row.cur")?.scrollIntoView({ block: "nearest" });
  }
  function runAt(i) {
    const c = items[i]; if (!c) return;
    if (!c.run) return; // ligne d'information : rien à lancer
    close(); c.run();
  }
  function open(text = "") { root.hidden = false; q.value = text; cur = 0; render(); q.focus(); q.select(); }
  function close() { root.hidden = true; }

  q.oninput = () => { cur = 0; render(); };
  q.onkeydown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); cur = Math.min(items.length - 1, cur + 1); paint(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); cur = Math.max(0, cur - 1); paint(); }
    else if (e.key === "Enter") { e.preventDefault(); runAt(cur); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
  };
  root.onclick = (e) => { if (e.target === root) close(); };
  root.querySelector(".pal-ask").onclick = () => { const t = q.value; close(); onAsk(t); };
  return { open, close, get isOpen() { return !root.hidden; } };
}
