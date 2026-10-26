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
import { pref } from "../prefs.js";
import { pointInPoly } from "../walls/rooms.js";

const KEY = "okteo.packs.v1";
export function getPacks() {
  try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); if (Array.isArray(v) && v.length) return v; } catch { /* */ }
  return PACK_DEFAULTS.map((p) => ({ ...p }));
}
export function setPacks(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* */ } }
const NAMES = { PC16: "prise", PC20: "prise spécialisée", RJ45: "RJ45", LUM: "point lumineux", APP: "applique", SPOT: "spot", INT: "interrupteur", VV: "va-et-vient", BP: "poussoir", VMC: "VMC", SC: "sortie de câble" };
const DIRECT = new Set(["RJ45", "PC20", "SC", "TAB", "VMC"]);
// pluriel des noms d'appareils : « 3 prises spécialisées », « 2 points lumineux », « 2 RJ45 », « 2 va-et-vient »
const plWord = (w, i) => (/^[A-Z0-9]+$/.test(w) || /-/.test(w) || /[sx]$/.test(w) || ["de", "à", "câble"].includes(w) && i > 0 ? w : w + "s");
const plural = (n, w) => `${n} ${n > 1 ? w.split(" ").map((x, i, all) => (all[i - 1] === "de" ? x : plWord(x, i))).join(" ") : w}`;

export function createPacksPane({ api, panel }) {
  const el = panel.register({ id: "packs", label: "Packs", icon: "▦", tip: "Appareillage type de chaque pièce : compléter une pièce, tout le niveau, pieuvre type" });
  let editing = false;
  const choice = new Map();       // pièce → pack choisi à la main (sinon : reconnu d'après le nom)

  function rooms() {
    const geo = api.exportGeometry(), packs = getPacks();
    return geo.rooms.filter((r) => r.poly && r.poly.length > 2).map((r, i) => {
      const key = r.name + "#" + i, pk = choice.has(key) ? packs.find((p) => p.id === choice.get(key)) || null : packFor(r.name, packs);
      const inRoom = geo.apps.filter((a) => pointInPoly(a.x, a.y, r.poly));
      return { key, id: r.id, room: r, pack: pk, apps: inRoom, need: pk ? missing(pk, r, inRoom) : [], openings: geo.openings };
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
    api.batch(() => { name = pieuvreIn(key); });
    api.showCircuits = true;
    api.setHint(`Pieuvre type ${name} : ${R0.room.name} équipée selon son pack, sa boîte au centre (verrouillée 🔒), ses circuits. Ctrl+Z pour annuler.`);
    render();
  }
  // pieuvre type sans annulation propre (appelée dans un api.batch) : renvoie le nom de la boîte
  function pieuvreIn(key) {
    const R0 = rooms().find((x) => x.key === key);
    if (!R0) return "";
    let name = "";
    {
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
    }
    return name;
  }

  // ---------- v44 : menu « Pack ▾ » du bandeau de la pièce (Maj+P, puis le chiffre du pack) ----------
  const OPT = "okteo.packmenu.v1";
  const opts = () => { try { return { pieuvre: false, same: true, ...JSON.parse(localStorage.getItem(OPT) || "{}") }; } catch { return { pieuvre: false, same: true }; } };
  const setOpt = (k, v) => { try { localStorage.setItem(OPT, JSON.stringify({ ...opts(), [k]: v })); } catch { /* */ } };
  const base = (n) => String(n || "").toLowerCase().replace(/\s*(?:n°|nº|no\.?)?\s*\d+\s*$/i, "").trim(); // « Chambre 2 » → « chambre »
  const desc = (p) => parseItems(p.items).map((x) => (x.n === "norme" ? "prises (norme)" : plural(x.n, NAMES[x.t] || x.t))).join(", ");
  // pièces « du même nom » : Chambre 1, Chambre 2… — seulement si le nom désigne un pack (pas « Pièce 1, Pièce 2 »)
  const twinsOf = (L, R) => packFor(R.room.name, getPacks()) ? L.filter((r) => r.id !== R.id && base(r.room.name) === base(R.room.name)) : [];
  let menu = null;
  function closeMenu() { if (menu) { menu.remove(); menu = null; document.removeEventListener("pointerdown", outside, true); } }
  function outside(e) { if (menu && !menu.contains(e.target)) closeMenu(); }
  function openMenu(roomId, x, y) {
    closeMenu();
    const L = rooms(), R = L.find((r) => r.id === roomId);
    if (!R) { api.setHint("Sélectionnez d'abord une pièce fermée (relevée ou dessinée)."); return; }
    const packs = getPacks().slice(0, 9), rec = packFor(R.room.name, getPacks()), o = opts();
    const twins = twinsOf(L, R);
    menu = document.createElement("div");
    menu.className = "pk-menu";
    menu.setAttribute("role", "menu");
    menu.innerHTML = `<div class="pk-mh"><b>Pack pour « ${esc(R.room.name)} »</b><span class="mut sm">chiffre ou clic · Échap ferme</span></div>
      <div class="pk-mo top">
        <label title="Après le pack, une boîte verrouillée au centre de la pièce avec ses appareils (hors lignes directes) ; les circuits suivent"><input type="checkbox" data-o="pieuvre" ${o.pieuvre ? "checked" : ""}> Avec sa boîte (pieuvre type)</label>
        ${twins.length ? `<label title="Le même pack, en une fois, dans les pièces du même nom"><input type="checkbox" data-o="same" ${o.same ? "checked" : ""}> Aussi ${twins.map((t) => "« " + esc(t.room.name) + " »").join(", ")}</label>` : ""}
      </div>
      ${packs.map((p, i) => `<button role="menuitem" data-p="${esc(p.id)}" class="${rec && rec.id === p.id ? "rec" : ""}"><kbd>${i + 1}</kbd><span><b>${esc(p.name)}</b>${rec && rec.id === p.id ? ` <em>reconnu</em>` : ""}<small>${esc(desc(p))}</small></span></button>`).join("")}`;
    document.body.appendChild(menu);
    const W = menu.offsetWidth, H = menu.offsetHeight;
    menu.style.left = Math.max(8, Math.min(innerWidth - W - 8, x)) + "px";
    menu.style.top = Math.max(8, y + H > innerHeight - 8 ? y - H - 44 : y) + "px";
    menu.querySelectorAll("[data-o]").forEach((c) => (c.onchange = () => setOpt(c.dataset.o, c.checked)));
    menu.querySelectorAll("[data-p]").forEach((b) => (b.onclick = () => { closeMenu(); applyPack(R.id, b.dataset.p); }));
    setTimeout(() => document.addEventListener("pointerdown", outside, true), 0);
    menu.querySelector("button.rec, [data-p]")?.focus();
  }
  // pose le pack dans la pièce (et ses jumelles si l'option est cochée), renomme une pièce sans nom reconnu ; un seul Ctrl+Z
  function applyPack(roomId, packId, o = opts()) {
    const pk = getPacks().find((p) => p.id === packId);
    const L0 = rooms(), R = L0.find((r) => r.id === roomId);
    if (!pk || !R) return 0;
    const twins = o.same ? twinsOf(L0, R) : [];
    const ids = [R.id, ...twins.map((t) => t.id)];
    let n = 0, boxes = [];
    api.batch(() => {
      // une pièce dont le nom ne désigne aucun pack prend le nom du pack (Chambre, Chambre 2…)
      if (!packFor(R.room.name, getPacks())) {
        const taken = new Set(api.state.rooms.map((r) => r.name));
        let nm = pk.name.split("/")[0].trim(), k = 1;
        while (taken.has(nm)) nm = pk.name.split("/")[0].trim() + " " + ++k;
        api.renameRoom(R.id, nm);
      }
      for (const id of ids) {
        const Rk = rooms().find((r) => r.id === id);
        if (!Rk) continue;
        choice.set(Rk.key, pk.id);
        const R2 = rooms().find((r) => r.id === id);
        if (o.pieuvre) { const before = api.state.app.length; const b = pieuvreIn(R2.key); n += api.state.app.length - before; if (b) boxes.push(b); }
        else n += complete(R2);
      }
    });
    if (o.pieuvre) api.showCircuits = true;
    const where = ids.length > 1 ? `${ids.length} pièces` : `« ${(api.state.rooms.find((r) => r.id === R.id) || R.room).name} »`;
    api.setHint(n || boxes.length ? `Pack « ${pk.name} » dans ${where} : ${plural(n, "appareil")} posé(s)${boxes.length ? `, boîte${boxes.length > 1 ? "s" : ""} ${boxes.join(", ")} 🔒` : ""}. Ajustez à la souris ; Ctrl+Z annule tout.` : `Pack « ${pk.name} » : rien ne manque dans ${where}.`);
    render();
    return n;
  }
  document.addEventListener("okteo:pack-menu", (e) => openMenu(e.detail.room, e.detail.x, e.detail.y));
  document.addEventListener("keydown", (e) => {
    const typing = /input|select|textarea/i.test(e.target.tagName) || e.target.isContentEditable;
    if (menu) {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeMenu(); return; }
      if (/^[1-9]$/.test(e.key)) { const b = menu.querySelectorAll("[data-p]")[+e.key - 1]; if (b) { e.preventDefault(); e.stopPropagation(); b.click(); } return; }
      return;
    }
    // Maj+P (P seul = outil Prise)
    if (typing || e.ctrlKey || e.metaKey || e.altKey || !e.shiftKey || e.key.toLowerCase() !== "p") return;
    const sel = api.selection;
    if (sel.length !== 1 || !sel[0].startsWith("room:")) return;
    e.preventDefault();
    const b = document.querySelector('#hud [data-h="pack"]'), r = b ? b.getBoundingClientRect() : { left: innerWidth / 2 - 150, bottom: 140 };
    openMenu(sel[0].slice(5), r.left, r.bottom + 4);
  }, true);

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
      <div><b>${esc(R.room.name)}</b> <span class="mut sm">${pref("surfaces") ? (R.room.area || 0).toFixed(1).replace(".", ",") + " m² · " : ""}${plural(R.apps.length, "appareil")}</span></div>
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
  ["okteo:saved", "okteo:level", "okteo:prefs"].forEach((ev) => document.addEventListener(ev, () => { if (panel.state.pane === "packs" && !editing) render(); }));
  document.addEventListener("okteo:packs-all", completeAll);
  render();
  return { render, completeAll, completeOne, pieuvre, rooms, openMenu, applyPack, closeMenu, get menu() { return menu; } };
}
