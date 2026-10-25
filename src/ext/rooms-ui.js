// « Détecter les pièces » : pièces fermées par les murs (avec leur forme et leur surface habitable),
// nommées d'après le texte du PDF quand il y en a un, sinon d'après les pièces déjà dessinées à cet endroit.
import { findRooms, nameRooms, labelPoint, pointInPoly } from "../walls/rooms.js";
import { chantierLabels } from "./pdf-page.js";
import { esc } from "./util.js";

const m2 = (v) => v.toFixed(1).replace(".", ",") + " m²";

export function createRoomsTool({ api }) {
  const card = document.createElement("div");
  card.className = "wcard"; card.hidden = true; card.setAttribute("role", "dialog"); card.setAttribute("aria-label", "Détection des pièces");
  document.querySelector(".stage").appendChild(card);
  let res = null, replace = true;

  const close = () => { card.hidden = true; api.setPreview(null); res = null; };
  const show = (html) => { card.innerHTML = `<div class="wcard-h"><b>Pièces</b><button class="wx" title="Fermer">✕</button></div>${html}`; card.hidden = false; card.querySelector(".wx").onclick = close; };

  async function compute() {
    const S = api.state;
    const rooms = findRooms(S.nodes, S.segs, { defEp: S.wallEp });
    let labels = [];
    try { labels = await chantierLabels(api); } catch { labels = []; }
    const named = nameRooms(rooms, labels);
    // pas de nom sur le plan : reprendre celui d'une pièce déjà dessinée à cet endroit
    named.forEach((r) => {
      if (!/^Pièce \d+/.test(r.name)) return;
      const p = labelPoint(r.poly), old = S.rooms.find((o) => pointInPoly(p.x, p.y, api.roomPoly(o)));
      if (old) r.name = old.name;
    });
    return { rooms: named.map((r) => ({ ...r, also: r.labels.filter((n) => n !== r.name) })), nLabels: labels.length };
  }

  function render() {
    const existing = api.state.rooms.length;
    const total = res.rooms.reduce((s, r) => s + r.area, 0);
    const warn = res.rooms.filter((r) => r.also.length);
    show(`
      <p class="wbig"><b>${res.rooms.length}</b> pièces · <b>${m2(total)}</b> habitables</p>
      <p class="mut">${res.nLabels ? `Noms lus sur le plan : ${res.nLabels}.` : "Aucun nom lu sur le plan : les pièces sans nom s'appellent « Pièce 1, 2… » (renommez-les dans leur menu)."}</p>
      <div class="wlist">${res.rooms.map((r) => `<div><span>${esc(r.name)}${r.also.length ? ` <em title="Le plan indique aussi : ${esc(r.also.join(", "))}">⚠</em>` : ""}</span><b class="num">${m2(r.area)}</b></div>`).join("")}</div>
      ${warn.length ? `<p class="warn sm">⚠ ${warn.map((r) => `« ${esc(r.name)} » contient aussi ${esc(r.also.join(", "))}`).join(" ; ")} : un mur manque sans doute pour les séparer.</p>` : ""}
      ${existing ? `<label class="wck"><input type="checkbox" id="r-rep" ${replace ? "checked" : ""}> Remplacer les ${existing} pièces existantes</label>` : ""}
      <div class="wrow"><button class="on" id="r-ok">Ajouter les pièces</button><button id="r-no">Annuler</button></div>
      <p class="mut sm">Surface habitable = entre les faces intérieures des murs. La forme et la surface suivront les murs si vous les déplacez.</p>`);
    const rp = card.querySelector("#r-rep"); if (rp) rp.onchange = () => { replace = rp.checked; };
    card.querySelector("#r-no").onclick = close;
    card.querySelector("#r-ok").onclick = () => {
      let list = res.rooms;
      if (!replace && existing) list = list.filter((r) => { const p = labelPoint(r.poly); return !api.state.rooms.some((o) => pointInPoly(p.x, p.y, api.roomPoly(o))); });
      const n = api.addRooms(list, { replace: replace || !existing });
      card.hidden = true; res = null;
      api.setHint(`${n} pièce${n > 1 ? "s" : ""} ajoutée${n > 1 ? "s" : ""}. Cliquez une pièce pour la renommer ; Ctrl+Z pour annuler.`);
    };
  }

  async function open() {
    if (api.tab !== "plan") api.setTab("plan");
    if (api.state.segs.length < 3) { show(`<p>Il faut d'abord des murs : relevez-les du PDF ou dessinez-les (outil Mur ou Pièce).</p>`); return; }
    show(`<p>Recherche des pièces…</p>`);
    res = await compute();
    if (!res.rooms.length) { show(`<p>Aucune pièce fermée trouvée. Les murs doivent se rejoindre aux angles (sommets communs) pour fermer une pièce.</p>`); return; }
    api.setPreview({ rooms: res.rooms });
    replace = api.state.rooms.every((r) => r.auto);
    render();
  }

  document.addEventListener("okteo:walls-imported", (e) => { if (e.detail && e.detail.rooms) open(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !card.hidden) close(); });
  return { open, close, get result() { return res; } };
}
