// Onglet « Packs » (v40) : l'appareillage type de chaque pièce.
// - chaque pièce du niveau ouvert, son pack reconnu d'après son nom (modifiable), ce qui lui manque ;
// - « Compléter » pose ce qui manque (commande à côté de la porte, lumière au centre, prises réparties sur les murs…) ;
// - « Pieuvre type » = compléter + une boîte verrouillée au centre de la pièce avec ses appareils (les circuits suivent) ;
// - « Équiper toutes les pièces » ; éditeur des packs (communs à tous les chantiers, enregistrés sur ce PC).
// Chaque action = un seul Ctrl+Z.
import { PACK_DEFAULTS, packFor, missing, placePack, parseItems } from "../cablage/packs.js";
import { circuitsByBox } from "../cablage/circuits.js";
import { boxName } from "../cablage/boites.js";
import { getCab } from "../cablage/settings.js";
import { esc } from "./util.js";
import { pointInPoly } from "../walls/rooms.js";

const KEY = "okteo.packs.v1";
export function getPacks() {
  try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); if (Array.isArray(v) && v.length) return v; } catch { /* */ }
  return PACK_DEFAULTS.map((p) => ({ ...p }));
}
export function setPacks(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* */ } }
const NAMES = { PC16: "prise", PC20: "prise spécialisée", RJ45: "RJ45", LUM: "point lumineux", APP: "applique", SPOT: "spot", INT: "interrupteur", VV: "va-et-vient", BP: "poussoir", VMC: "VMC", SC: "sortie de câble" };
const DIRECT = new Set(["RJ45", "PC20", "SC", "TAB", "VMC"]);
const plural = (n, w) => `${n} ${w}${n > 1 && !/s$/.test(w) ? "s" : ""}`;

export function createPacksPane({ api, panel }) {
  const el = panel.register({ id: "packs", label: "Packs", icon: "▦" });
  let editing = false;
  const choice = new Map();       // pièce → pack choisi à la main (sinon : reconnu d'après le nom)

  function rooms() {
    const geo = api.exportGeometry(), packs = getPacks();
    return geo.rooms.filter((r) => r.poly && r.poly.length > 2).map((r, i) => {
      const key = r.name + "#" + i, pk = choice.has(key) ? packs.find((p) => p.id === choice.get(key)) || null : packFor(r.name, packs);
      const inRoom = geo.apps.filter((a) => pointInPoly(a.x, a.y, r.poly));
      return { key, room: r, pack: pk, apps: inRoom, need: pk ? missing(pk, r, inRoom) : [], openings: geo.openings };
    });
  }
  // pose ce qui manque dans une pièce ; renvoie le nombre d'appareils posés
  function complete(R) {
    if (!R.pack || !R.need.length) return 0;
    const { list, links } = placePack(R.room, R.openings, R.need, R.apps);
    if (!list.length) return 0;
    return api.importDevices(list, links).appareils;
  }
  function completeOne(key) {
    const R = rooms().find((x) => x.key === key);
    if (!R) return;
    if (!R.pack) { api.setHint(`${R.room.name} : aucun pack (choisissez-en un dans la liste).`); return; }
    const n = complete(R);
    api.setHint(n ? `${R.room.name} : ${plural(n, "appareil")} posé(s) selon le pack « ${R.pack.name} ». Ajustez-les à la souris ; Ctrl+Z pour annuler.` : `${R.room.name} : rien ne manque au pack « ${R.pack.name} ».`);
    render();
  }
  function completeAll() {
    let n = 0, k = 0;
    api.batch(() => {
      for (const key of rooms().map((r) => r.key)) { const R = rooms().find((x) => x.key === key); const m = R ? complete(R) : 0; if (m) { n += m; k++; } }
    });
    api.setHint(n ? `${plural(n, "appareil")} posé(s) dans ${plural(k, "pièce")} selon leur pack. Ctrl+Z pour tout annuler.` : "Rien ne manque : toutes les pièces ont leur pack.");
    render();
  }
  // pieuvre type : pack complété + une boîte verrouillée au centre de la pièce avec ses appareils (hors lignes directes)
  function pieuvre(key) {
    const R0 = rooms().find((x) => x.key === key);
    if (!R0) return;
    let name = "";
    api.batch(() => {
      complete(R0);
      const R = rooms().find((x) => x.key === key) || R0;
      const ids = R.apps.filter((a) => !DIRECT.has(a.t)).map((a) => a.id);
      const B = (api.cab.boxes || []).map((b) => ({ ...b, apps: b.apps.filter((id) => !ids.includes(id)) })).filter((b) => b.apps.length || b.locked);
      let n = Math.max(0, ...B.map((b) => +String(b.n).replace(/\D/g, "") || 0)) + 1, id = "b" + n;
      while (B.some((b) => b.id === id)) id = "b" + ++n;
      name = boxName(n);
      const lab = R.room.label || R.room.poly[0];
      B.push({ id, n: name, lv: api.level.id, x: +(+lab.x).toFixed(2), y: +(+lab.y).toFixed(2), apps: ids, locked: true, pack: R.pack ? R.pack.id : null });
      const S = getCab();
      api.setCab({ boxes: B, ...(S.circuitsParBoite ? { circuits: circuitsByBox(api.allApps(), api.allLinks(), B, S) } : {}) });
    });
    api.showCircuits = true;
    api.setHint(`Pieuvre type ${name} : ${R0.room.name} équipée selon son pack, sa boîte au centre (verrouillée 🔒), ses circuits. Ctrl+Z pour annuler.`);
    render();
  }

  function editorHTML() {
    const P = getPacks();
    return `<div class="pk-ed"><p class="mut sm">Un pack par type de pièce : les mots reconnus dans le nom de la pièce, puis les appareils (ex. « PC16×3, LUM, INT, RJ45 » ; « PC16×norme » = une prise par 4 m², 5 au moins, 7 au-delà de 28 m²). Codes : ${Object.keys(NAMES).join(", ")}. Communs à tous les chantiers (ce PC).</p>
      ${P.map((p, i) => `<div class="pk-row" data-i="${i}"><input class="pk-name" value="${esc(p.name)}" title="Nom du pack"><input class="pk-words" value="${esc(p.words)}" title="Mots du nom de la pièce, séparés par des virgules"><input class="pk-items" value="${esc(p.items)}" title="Appareils du pack"><button data-del="${i}" title="Supprimer ce pack">✕</button></div>`).join("")}
      <div class="wrow"><button id="pk-add">＋ Pack</button><button class="on" id="pk-save">Enregistrer</button><button id="pk-reset" title="Revenir aux packs de base (norme + pratique KiTéOHM)">Packs de base</button><button id="pk-close">Fermer</button></div></div>`;
  }
  function render() {
    if (editing) {
      el.innerHTML = `<div class="cab"><div class="cab-h"><b>Packs</b> <span class="mut sm">modifier</span></div>${editorHTML()}</div>`;
      const rowsVal = () => [...el.querySelectorAll(".pk-row")].map((r, i) => ({ id: getPacks()[i]?.id || "p" + Date.now() + i, name: r.querySelector(".pk-name").value.trim(), words: r.querySelector(".pk-words").value.trim(), items: r.querySelector(".pk-items").value.trim() })).filter((p) => p.name);
      el.querySelector("#pk-add").onclick = () => { setPacks([...rowsVal(), { id: "p" + Date.now(), name: "Nouveau pack", words: "", items: "PC16, LUM, INT" }]); render(); };
      el.querySelector("#pk-save").onclick = () => { const v = rowsVal(); const bad = v.find((p) => !parseItems(p.items).length); if (bad) { api.setHint(`Pack « ${bad.name} » : liste d'appareils illisible.`); return; } setPacks(v); editing = false; api.setHint("Packs enregistrés."); render(); };
      el.querySelector("#pk-reset").onclick = () => { setPacks(PACK_DEFAULTS.map((p) => ({ ...p }))); render(); };
      el.querySelector("#pk-close").onclick = () => { editing = false; render(); };
      el.querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => { const v = rowsVal(); v.splice(+b.dataset.del, 1); setPacks(v); render(); }));
      return;
    }
    const L = rooms(), packs = getPacks();
    const rows = L.map((R) => `<div class="cb-row pk-room" data-k="${esc(R.key)}"><div class="cb-main">
      <div><b>${esc(R.room.name)}</b> <span class="mut sm">${(R.room.area || 0).toFixed(1).replace(".", ",")} m² · ${plural(R.apps.length, "appareil")}</span></div>
      <div class="sm"><select class="pk-pick" title="Pack de cette pièce (reconnu d'après son nom)"><option value="">— aucun pack —</option>${packs.map((p) => `<option value="${esc(p.id)}" ${R.pack && R.pack.id === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select>
        ${R.pack ? (R.need.length ? `<span class="warn">manque : ${R.need.map((x) => plural(x.n, NAMES[x.t] || x.t)).join(", ")}</span>` : `<span class="ok">✓ complet</span>`) : ""}</div>
      <div class="cb-ctl"><button data-a="see" title="Montrer la pièce sur le plan">Voir</button><button data-a="fill" ${R.pack && R.need.length ? "" : "disabled"} title="Poser ce qui manque : commande à côté de la porte, lumière au centre, prises réparties sur les murs (loin des portes, fenêtres et angles), RJ45 à côté d'une prise">Compléter</button><button data-a="pieuvre" ${R.pack ? "" : "disabled"} title="Pieuvre type : compléter le pack, puis une boîte verrouillée au centre de la pièce avec tous ses appareils (hors lignes directes) ; les circuits suivent">Pieuvre type</button></div></div></div>`).join("");
    const todo = L.filter((R) => R.pack && R.need.length).length;
    el.innerHTML = `<div class="cab"><div class="cab-h"><b>Packs</b> <span class="mut sm">appareillage type des pièces (${esc(api.level.name || "")})</span></div>
      ${L.length ? "" : `<p class="mut sm">Pas encore de pièces sur ce niveau : relevez ou dessinez les murs et les pièces d'abord.</p>`}
      <div class="wrow"><button class="on" id="pk-all" ${todo ? "" : "disabled"} title="Poser ce qui manque dans toutes les pièces du niveau (un seul Ctrl+Z)">Équiper toutes les pièces (${todo})</button><button id="pk-edit" title="Voir et modifier les packs (types de pièce, appareils)">Modifier les packs…</button></div>
      <div class="cb-list">${rows}</div>
      <p class="mut sm">« Compléter » n'ajoute que ce qui manque (une commande compte pour un interrupteur, un va-et-vient ou un poussoir ; une lumière pour un point lumineux, un spot ou une applique). Les appareils posés se déplacent ensuite à la souris.</p></div>`;
    el.querySelector("#pk-all").onclick = completeAll;
    el.querySelector("#pk-edit").onclick = () => { editing = true; render(); };
    el.querySelectorAll(".pk-room").forEach((row) => {
      const key = row.dataset.k, R = L.find((x) => x.key === key);
      row.querySelector(".pk-pick").onchange = (e) => { choice.set(key, e.target.value); render(); };
      row.querySelector('[data-a="see"]').onclick = () => { const xs = R.room.poly.map((p) => p.x), ys = R.room.poly.map((p) => p.y); api.zoomToBox(Math.min(...xs) - 1, Math.min(...ys) - 1, Math.max(...xs) + 1, Math.max(...ys) + 1); };
      row.querySelector('[data-a="fill"]').onclick = () => completeOne(key);
      row.querySelector('[data-a="pieuvre"]').onclick = () => pieuvre(key);
    });
  }
  panel.onChange((s) => { if (s.pane === "packs" && !s.collapsed) render(); });
  ["okteo:saved", "okteo:level"].forEach((ev) => document.addEventListener(ev, () => { if (panel.state.pane === "packs" && !editing) render(); }));
  document.addEventListener("okteo:packs-all", completeAll);
  render();
  return { render, completeAll, completeOne, pieuvre, rooms };
}
