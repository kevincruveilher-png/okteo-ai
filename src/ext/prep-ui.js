// v74 (MAJ 1) : « Préparation d'impression » au format des plans FTZ du BE. Feuille A3 paysage avec cadre et cartouche
// KiTéOHM ; recto = boîtes de pieuvre, verso = lignes directes (+ légende dans un coin libre), le contenu de chaque page se
// choisit (boîte par boîte) ; encarts posés par-dessus la feuille (jamais sur le plan de travail) : zones de texte (cadre,
// couleur, gras, italique, taille, alignement), flèches, panneaux ⚠, zones interdites hachurées, images (documentation
// fournisseur), encarts types. Tout est enregistré dans le chantier (meta.impression ; images dans le stockage des fichiers).
import { faceUrl } from "./plan3d-qr.js";
import * as CHS from "../chantiers.js";
import { buildPlanPdf } from "./print.js";
import { pdfjs } from "./fond-import.js";
import { wiringNow } from "./cablage-data.js";
import { esc } from "./util.js";
import { ENCARTS, wrapLines, A3 } from "../print/ftz-sheet.js";

const USER_ENCARTS = "okteo.encarts.v1";
const COLORS = ["#000000", "#FF0000", "#0000FF", "#008000", "#800080", "#FF8000", "#0080FF", "#FF00FF", "#7F7F7F"];
const uid = () => Math.random().toString(36).slice(2, 9);
const today = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`; };
const loadUser = () => { try { return JSON.parse(localStorage.getItem(USER_ENCARTS) || "[]"); } catch { return []; } };
const saveUser = (l) => { try { localStorage.setItem(USER_ENCARTS, JSON.stringify(l)); } catch { /* */ } };

let logoCache = null;
async function logoHD() {
  if (logoCache) return logoCache;
  try {
    const b = await (await fetch("assets/kiteohm-logo-hd.png")).blob();
    const data = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });
    logoCache = { data, ratio: 1590 / 349 };
  } catch { logoCache = null; }
  return logoCache;
}
// image ajoutée : réduite (≤ 1600 px) pour garder un PDF et un stockage légers
async function shrink(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
    return { data: c.toDataURL("image/jpeg", 0.88), fmt: "JPEG", ratio: c.width / c.height };
  } finally { URL.revokeObjectURL(url); }
}

export function createPrepTool({ api }) {
  const back = document.createElement("div");
  back.className = "prep-back"; back.hidden = true;
  back.setAttribute("role", "dialog"); back.setAttribute("aria-label", "Préparation d'impression");
  back.innerHTML = `<div class="prep">
    <aside class="prep-side">
      <div class="prep-h"><b>Préparation d'impression</b><button class="prep-x" title="Fermer (Échap)">✕</button></div>
      <p class="mut sm">Feuille A3 au format des plans du BE. Les encarts se posent ici, jamais sur le plan de travail.</p>
      <div class="prep-pages" role="tablist"></div>
      <div class="prep-content"></div>
      <label class="f prep-bati" title="Dessin de la maçonnerie pour tout le chantier, comme le plan du constructeur. Le type de chaque mur se règle dans ses Propriétés.">Maçonnerie<select id="prep-bati"><option value="hachures">Hachures (comme VILLANOVA, MAILLARD)</option><option value="gris">Gris plein (comme EVRARD)</option></select></label>
      <label class="f prep-sens" title="Auto : le plan est tourné d'un quart de tour s'il tient ainsi à une plus grande échelle (1/50 de préférence)">Sens du plan<select id="prep-sens"><option value="auto">Automatique (plus grande échelle)</option><option value="vue">Comme la vue</option><option value="0">Sans rotation</option><option value="90">Quart de tour à droite</option><option value="-90">Quart de tour à gauche</option></select></label>
      <label class="f prep-qr3d" title="Sur chaque face, un QR code ouvre sur le téléphone la maquette 3D de ce qui est imprimé sur cette face (boîtes et gaines, ou lignes directes). Aucun nom de client ni de chantier dans le QR."><input type="checkbox" id="prep-qr3d"> QR « maquette 3D » sur chaque face</label>
      <details class="prep-sec" open><summary>Cartouche</summary>
        <label class="f">Client du BE<input data-c="clientBE"></label>
        <label class="f">N° d'affaire<input data-c="affaire"></label>
        <label class="f">Dessinateur<input data-c="dessinateur"></label>
        <label class="f">Date<input data-c="date"></label>
      </details>
      <details class="prep-sec" open><summary>Ajouter sur la page</summary>
        <div class="prep-add">
          <button data-add="text" title="Zone de texte (encadrée ou non)">Texte</button>
          <button data-add="arrow" title="Flèche (glisser ses deux bouts)">Flèche</button>
          <button data-add="warn" title="Panneau attention ⚠">⚠ Attention</button>
          <button data-add="zone" title="Zone interdite hachurée (rectangle)">Zone interdite</button>
          <button data-add="zoneE" title="Zone interdite hachurée (ellipse)">Zone (ellipse)</button>
          <label class="btnlike" title="Image : documentation fournisseur, photo de matériel (PNG, JPEG)">Image…<input type="file" accept="image/*" hidden id="prep-img"></label>
        </div>
        <div class="prep-enc"><select id="prep-enc" aria-label="Encarts types"></select><button id="prep-enc-add">Insérer</button></div>
      </details>
      <div class="prep-sel"></div>
      <div class="prep-foot"><span class="prep-info mut sm"></span><button class="on prep-dl">Télécharger le PDF</button></div>
    </aside>
    <div class="prep-view"><div class="prep-sheet"><canvas class="prep-bg"></canvas><svg class="prep-ov" viewBox="0 0 ${A3.W} ${A3.H}" xmlns="http://www.w3.org/2000/svg"></svg></div><div class="prep-wait">Préparation…</div></div>
  </div>`;
  document.body.appendChild(back);
  const $ = (s) => back.querySelector(s);
  let P = null, cur = 0, sel = null, images = {}, bg = null, seq = 0, saveT = 0, bgT = 0, scratch = null;

  // ---------- données ----------
  const meta = () => CHS.current();
  function defaults() {
    return { pages: [{ id: "p1", name: "Recto — boîtes", boxes: "all", direct: false, autres: true, legend: false }, { id: "p2", name: "Verso — lignes directes", boxes: [], direct: true, autres: false, legend: true }], items: [], date: "" };
  }
  function save() { clearTimeout(saveT); saveT = setTimeout(() => { const c = meta(); CHS.update(c.id, { impression: P }); }, 250); }
  function fields() {
    const c = meta();
    return { client: c.clientBE || c.client || "", chantier: `${c.nom || ""}${c.numero ? " " + c.numero : ""}`, affaire: c.affaire || "", dessinateur: c.dessinateur || "", date: P.date || today() };
  }
  async function loadImages() {
    images = {};
    for (const it of P.items.filter((x) => x.type === "image")) { if (images[it.ref]) continue; try { const b = await CHS.getFile(it.ref); if (b) images[it.ref] = typeof b === "string" ? JSON.parse(b) : JSON.parse(await b.text()); } catch { /* image absente */ } }
  }
  const boxesHere = () => (api.cab.boxes || []).filter((b) => b.lv === api.level.id).sort((a, b) => String(a.n).localeCompare(String(b.n), "fr", { numeric: true }));
  function gaineNos() {
    try { const W = wiringNow(api), out = {}; W.boxes.forEach((b) => { const m = (out[b.id] = {}); b.gaines.forEach((g) => { const no = String(g.no || "").split(".").pop(); if (g.kind === "alim") { if (g.id === "alim:0") m.tab = no; } else (g.appIds || [g.appId]).filter(Boolean).forEach((id) => (m[id] = no)); }); }); return out; } catch { return null; }
  }
  async function build(final) {
    const geo = api.exportGeometry(), has = (api.cab.boxes || []).length > 0;
    const sens = P.sens || "auto", rot = sens === "vue" ? api.viewRot || 0 : sens === "auto" ? 0 : +sens;
    return buildPlanPdf(geo, { rot, boites: has, gaines: has, circuits: has, cotes: false, nomenclature: false, gaineNos: has ? gaineNos() : null,
      ftz: { pages: P.pages, items: P.items, images, fields: fields(), logo: await logoHD(), bg: !final, autoRot: sens === "auto", qr3d: P.qr3d === false ? null : (face) => faceUrl(api, face) } });
  }

  // ---------- fond de la page (PDF sans les encarts, dessiné par pdf.js) ----------
  async function refreshBg() {
    const my = ++seq; $(".prep-wait").hidden = false;
    try {
      const r = await build(false); if (my !== seq) return;
      bg = r;
      const L = await pdfjs(), doc = await L.getDocument({ data: new Uint8Array(await r.blob.arrayBuffer()) }).promise;
      const pg = await doc.getPage(Math.min(cur + 1, doc.numPages)), sheet = $(".prep-sheet");
      const wpx = sheet.clientWidth || 900, vp1 = pg.getViewport({ scale: 1 }), dpr = Math.min(2, window.devicePixelRatio || 1);
      const vp = pg.getViewport({ scale: (wpx / vp1.width) * dpr }), c = $(".prep-bg");
      c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      await pg.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
      if (my !== seq) return;
      $(".prep-info").textContent = `A3 paysage · 1/${r.layout.scale}${r.rotated ? " · plan tourné" : ""} · ${r.pages} page${r.pages > 1 ? "s" : ""}${r.layout.fits ? "" : " · le plan dépasse"}`;
      paintOv();
    } catch (e) { $(".prep-info").textContent = "Échec : " + e.message; }
    if (my === seq) $(".prep-wait").hidden = true;
  }
  const bgSoon = () => { clearTimeout(bgT); bgT = setTimeout(refreshBg, 250); };

  // ---------- encarts dessinés par-dessus la feuille (SVG en mm, comme le PDF) ----------
  async function ensureScratch() { if (!scratch) { const { jsPDF } = await import("jspdf"); scratch = new jsPDF({ unit: "mm", format: "a3", orientation: "landscape" }); } return scratch; }
  const FAM = { helvetica: "Arial,Helvetica,sans-serif", times: "'Times New Roman',Times,serif", courier: "'Courier New',Courier,monospace" };
  function itemSVG(it) {
    const on = sel === it.id, cls = `pit${on ? " on" : ""}`;
    if (it.type === "text") {
      const lines = scratch ? wrapLines(scratch, it) : String(it.text || "").split("\n"), size = it.size || 10, lh = size / (72 / 25.4) * 1.18, pad = it.pad ?? 1.5;
      const h = it.h || lines.length * lh + 2 * pad; it._h = h;
      const al = it.align || "left", tx = al === "center" ? it.x + it.w / 2 : al === "right" ? it.x + it.w - pad : it.x + pad, anchor = al === "center" ? "middle" : al === "right" ? "end" : "start";
      const fr = it.frame && it.frame !== "none" ? `<rect x="${it.x}" y="${it.y}" width="${it.w}" height="${h}" rx="${it.frame === "round" ? 2 : 0}" fill="${it.fill || "none"}" stroke="${it.frameColor || it.color}" stroke-width="${it.frameW || 0.35}"/>` : "";
      const tx2 = lines.map((l, i) => `<text x="${tx}" y="${it.y + pad + lh * (i + 0.8)}" font-family="${FAM[it.font || "helvetica"]}" font-size="${size / (72 / 25.4)}" font-weight="${it.bold ? 700 : 400}" font-style="${it.italic ? "italic" : "normal"}" fill="${it.color}" text-anchor="${anchor}">${esc(l)}</text>`).join("");
      return `<g class="${cls}" data-id="${it.id}"><rect class="hit" x="${it.x}" y="${it.y}" width="${it.w}" height="${h}" fill="transparent"/>${fr}${tx2}${on ? `<rect class="hdl" data-h="se" x="${it.x + it.w - 1.6}" y="${it.y + h - 1.6}" width="3.2" height="3.2"/>` : ""}</g>`;
    }
    if (it.type === "arrow") {
      const dx = it.x2 - it.x, dy = it.y2 - it.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, w = it.lw || 0.35, hl = Math.max(2, w * 7), hw = hl * 0.45;
      return `<g class="${cls}" data-id="${it.id}"><line class="hit" x1="${it.x}" y1="${it.y}" x2="${it.x2}" y2="${it.y2}" stroke="transparent" stroke-width="4"/><line x1="${it.x}" y1="${it.y}" x2="${it.x2 - ux * hl * 0.8}" y2="${it.y2 - uy * hl * 0.8}" stroke="${it.color}" stroke-width="${w}"/><polygon points="${it.x2},${it.y2} ${it.x2 - ux * hl - uy * hw},${it.y2 - uy * hl + ux * hw} ${it.x2 - ux * hl + uy * hw},${it.y2 - uy * hl - ux * hw}" fill="${it.color}"/>${on ? `<circle class="hdl" data-h="a" cx="${it.x}" cy="${it.y}" r="1.6"/><circle class="hdl" data-h="b" cx="${it.x2}" cy="${it.y2}" r="1.6"/>` : ""}</g>`;
    }
    if (it.type === "warn") {
      const s = it.size || 8, h = s * 0.87;
      return `<g class="${cls}" data-id="${it.id}"><polygon class="hit" points="${it.x + s / 2},${it.y} ${it.x + s},${it.y + h} ${it.x},${it.y + h}" fill="#fff" stroke="#FF0000" stroke-width="${Math.max(0.3, s * 0.09)}" stroke-linejoin="round"/><text x="${it.x + s / 2}" y="${it.y + h * 0.86}" font-family="Arial" font-weight="700" font-size="${s * 0.62}" text-anchor="middle">!</text>${on ? `<rect class="hdl" data-h="se" x="${it.x + s - 1.6}" y="${it.y + h - 1.6}" width="3.2" height="3.2"/>` : ""}</g>`;
    }
    if (it.type === "zone") {
      const pid = "hz" + it.id, shape = it.shape === "ellipse" ? `<ellipse cx="${it.x + it.w / 2}" cy="${it.y + it.h / 2}" rx="${it.w / 2}" ry="${it.h / 2}"` : `<rect x="${it.x}" y="${it.y}" width="${it.w}" height="${it.h}"`;
      return `<g class="${cls}" data-id="${it.id}"><defs><pattern id="${pid}" width="${it.step || 2}" height="${it.step || 2}" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><line x1="0" y1="0" x2="0" y2="${it.step || 2}" stroke="${it.color}" stroke-width="0.12" stroke-dasharray="0.6 0.6"/></pattern></defs>${shape} class="hit" fill="url(#${pid})" stroke="${it.color}" stroke-width="0.18" stroke-dasharray="0.6 0.6"/>${on ? `<rect class="hdl" data-h="se" x="${it.x + it.w - 1.6}" y="${it.y + it.h - 1.6}" width="3.2" height="3.2"/>` : ""}</g>`;
    }
    if (it.type === "image") {
      const im = images[it.ref];
      return `<g class="${cls}" data-id="${it.id}">${im ? `<image href="${im.data}" x="${it.x}" y="${it.y}" width="${it.w}" height="${it.h}" preserveAspectRatio="none"/>` : `<rect x="${it.x}" y="${it.y}" width="${it.w}" height="${it.h}" fill="#eee"/>`}<rect class="hit" x="${it.x}" y="${it.y}" width="${it.w}" height="${it.h}" fill="transparent" stroke="${on ? "#0B6E99" : "none"}" stroke-width="0.3"/>${on ? `<rect class="hdl" data-h="se" x="${it.x + it.w - 1.6}" y="${it.y + it.h - 1.6}" width="3.2" height="3.2"/>` : ""}</g>`;
    }
    return "";
  }
  function paintOv() {
    const ov = $(".prep-ov"), leg = bg && bg.legends.find((l) => l.page === cur + 1);
    const legSel = sel === "legend";
    ov.innerHTML = (leg ? `<g class="pit pleg${legSel ? " on" : ""}" data-id="legend"><rect class="hit" x="${leg.x}" y="${leg.y}" width="${leg.w}" height="${leg.h}" fill="transparent" stroke="${legSel ? "#0B6E99" : "none"}" stroke-width="0.4" stroke-dasharray="1 0.6"><title>Légende : glisser pour la déplacer</title></rect></g>` : "") +
      P.items.filter((it) => (it.page || 1) === cur + 1).map(itemSVG).join("");
    paintSel();
  }

  // ---------- panneau de gauche ----------
  function paintPages() {
    $(".prep-pages").innerHTML = P.pages.map((p, i) => `<button role="tab" aria-selected="${i === cur}" class="${i === cur ? "on" : ""}" data-p="${i}">${esc(p.name)}</button>`).join("");
    $(".prep-pages").querySelectorAll("[data-p]").forEach((b) => (b.onclick = () => { cur = +b.dataset.p; sel = null; paintPages(); refreshBg(); }));
    const pg = P.pages[cur], bx = boxesHere(), all = pg.boxes === "all", has = (id) => all || (pg.boxes || []).includes(id);
    $(".prep-content").innerHTML = `<details class="prep-sec" open><summary>Contenu de la page</summary>
      ${bx.length ? `<div class="prep-boxes">${bx.map((b) => `<label class="ck"><input type="checkbox" data-box="${b.id}" ${has(b.id) ? "checked" : ""}> ${esc(String(b.n))}</label>`).join("")}</div>
        <div class="trow"><button class="sm" id="prep-all">Toutes les boîtes</button><button class="sm" id="prep-none">Aucune</button></div>` : `<p class="mut sm">Pas de boîte sur ce niveau (Câblage).</p>`}
      <label class="ck"><input type="checkbox" data-o="direct" ${pg.direct ? "checked" : ""}> Lignes directes</label>
      <label class="ck" title="Appareils qui ne sont ni dans une boîte ni en ligne directe"><input type="checkbox" data-o="autres" ${pg.autres !== false ? "checked" : ""}> Autres appareils</label>
      <label class="ck" title="Distance de chaque boîte de la page au mur le plus proche, en cm (violet, hors du plan)"><input type="checkbox" data-o="cotes" ${pg.cotes !== false ? "checked" : ""}> Cotes des boîtes</label>
      <label class="ck"><input type="checkbox" data-o="legend" ${pg.legend ? "checked" : ""}> Légende sur cette page</label>
      ${pg.legendAt ? `<button class="sm" id="prep-legauto" title="Replacer la légende dans le coin libre">Légende : coin libre</button>` : ""}
    </details>`;
    const C = $(".prep-content");
    C.querySelectorAll("[data-box]").forEach((el) => (el.onchange = () => {
      let L = pg.boxes === "all" ? bx.map((b) => b.id) : (pg.boxes || []).slice();
      L = el.checked ? [...new Set([...L, el.dataset.box])] : L.filter((x) => x !== el.dataset.box);
      pg.boxes = L.length === bx.length ? "all" : L; save(); bgSoon();
    }));
    C.querySelector("#prep-all")?.addEventListener("click", () => { pg.boxes = "all"; save(); paintPages(); bgSoon(); });
    C.querySelector("#prep-none")?.addEventListener("click", () => { pg.boxes = []; save(); paintPages(); bgSoon(); });
    C.querySelectorAll("[data-o]").forEach((el) => (el.onchange = () => { pg[el.dataset.o] = el.checked; save(); bgSoon(); }));
    C.querySelector("#prep-legauto")?.addEventListener("click", () => { delete pg.legendAt; save(); paintPages(); bgSoon(); });
  }
  function paintCart() {
    const c = meta();
    back.querySelectorAll("[data-c]").forEach((el) => {
      const k = el.dataset.c; el.value = k === "date" ? P.date || today() : c[k] || "";
      if (k === "clientBE") el.placeholder = c.client || "";
      el.onchange = () => { if (k === "date") { P.date = el.value.trim(); save(); } else CHS.update(c.id, { [k]: el.value.trim() }); bgSoon(); };
    });
  }
  function paintEnc() {
    const L = [...ENCARTS, ...loadUser()];
    $("#prep-enc").innerHTML = L.map((e) => `<option value="${esc(e.id)}">${esc(e.label)}</option>`).join("");
  }
  const selItem = () => P.items.find((x) => x.id === sel);
  function paintSel() {
    const it = selItem(), box = $(".prep-sel");
    if (sel === "legend") { box.innerHTML = `<details class="prep-sec" open><summary>Légende</summary><p class="mut sm">Glisser la légende sur la feuille pour la déplacer. Elle liste seulement les symboles utilisés sur le plan.</p></details>`; return; }
    if (!it) { box.innerHTML = ""; return; }
    const col = (k, v) => `<span class="prep-cols">${COLORS.map((c) => `<button class="sw${v === c ? " on" : ""}" data-col="${k}" data-v="${c}" style="background:${c}" title="${c}" aria-label="Couleur ${c}"></button>`).join("")}<input type="color" data-colin="${k}" value="${v || "#000000"}" title="Autre couleur"></span>`;
    let h = `<details class="prep-sec" open><summary>${{ text: "Zone de texte", arrow: "Flèche", warn: "Panneau attention", zone: "Zone interdite", image: "Image" }[it.type]}</summary>`;
    if (it.type === "text") h += `<textarea id="ps-text" rows="4">${esc(it.text || "")}</textarea>
      <div class="trow"><select id="ps-font"><option value="helvetica">Helvetica</option><option value="times">Times</option><option value="courier">Courier</option></select>
      <label class="f">Taille<input id="ps-size" type="number" min="5" max="48" step="0.5" value="${it.size || 10}"></label></div>
      <div class="trow"><button class="sm${it.bold ? " on" : ""}" id="ps-b" title="Gras"><b>G</b></button><button class="sm${it.italic ? " on" : ""}" id="ps-i" title="Italique"><i>I</i></button>
      <select id="ps-al"><option value="left">À gauche</option><option value="center">Centré</option><option value="right">À droite</option></select></div>
      <label class="f">Couleur du texte</label>${col("color", it.color)}
      <div class="trow"><select id="ps-fr"><option value="none">Sans cadre</option><option value="rect">Cadre</option><option value="round">Cadre arrondi</option></select><label class="f">Trait<input id="ps-fw" type="number" min="0.1" max="2" step="0.05" value="${it.frameW || 0.35}"></label></div>
      <label class="f">Couleur du cadre</label>${col("frameColor", it.frameColor || it.color)}
      <label class="ck"><input type="checkbox" id="ps-fill" ${it.fill ? "checked" : ""}> Fond blanc</label>`;
    if (it.type === "arrow") h += `<label class="f">Couleur</label>${col("color", it.color)}<label class="f">Épaisseur<input id="ps-lw" type="number" min="0.1" max="2" step="0.05" value="${it.lw || 0.35}"></label>`;
    if (it.type === "warn") h += `<label class="f">Taille (mm)<input id="ps-ws" type="number" min="3" max="40" step="0.5" value="${it.size || 8}"></label>`;
    if (it.type === "zone") h += `<label class="f">Couleur</label>${col("color", it.color)}<select id="ps-shape"><option value="rect">Rectangle</option><option value="ellipse">Ellipse</option></select>`;
    h += `<div class="trow"><button class="sm" id="ps-dup">Dupliquer</button><button class="sm danger" id="ps-del">Supprimer (Suppr)</button>${it.type === "text" ? `<button class="sm" id="ps-save" title="Ajouter ce texte aux encarts types (tous les chantiers)">Garder comme encart type</button>` : ""}</div></details>`;
    box.innerHTML = h;
    const set = (k, v) => { it[k] = v; save(); paintOv(); };
    const q = (s) => box.querySelector(s);
    if (it.type === "text") {
      q("#ps-font").value = it.font || "helvetica"; q("#ps-al").value = it.align || "left"; q("#ps-fr").value = it.frame || "none";
      q("#ps-text").oninput = (e) => { it.text = e.target.value; save(); paintOvKeep(); };
      q("#ps-font").onchange = (e) => set("font", e.target.value); q("#ps-size").onchange = (e) => set("size", +e.target.value || 10);
      q("#ps-b").onclick = () => set("bold", !it.bold); q("#ps-i").onclick = () => set("italic", !it.italic);
      q("#ps-al").onchange = (e) => set("align", e.target.value); q("#ps-fr").onchange = (e) => set("frame", e.target.value);
      q("#ps-fw").onchange = (e) => set("frameW", +e.target.value || 0.35); q("#ps-fill").onchange = (e) => set("fill", e.target.checked ? "#FFFFFF" : null);
      q("#ps-save").onclick = () => { const L = loadUser(); const { id, x, y, page, _h, ...item } = it; L.push({ id: "u" + uid(), label: (it.text || "Texte").split("\n")[0].slice(0, 40), item }); saveUser(L); paintEnc(); $(".prep-info").textContent = "Encart type enregistré."; };
    }
    if (q("#ps-lw")) q("#ps-lw").onchange = (e) => set("lw", +e.target.value || 0.35);
    if (q("#ps-ws")) q("#ps-ws").onchange = (e) => set("size", +e.target.value || 8);
    if (q("#ps-shape")) { q("#ps-shape").value = it.shape || "rect"; q("#ps-shape").onchange = (e) => set("shape", e.target.value); }
    box.querySelectorAll("[data-col]").forEach((b) => (b.onclick = () => set(b.dataset.col, b.dataset.v)));
    box.querySelectorAll("[data-colin]").forEach((b) => (b.onchange = () => set(b.dataset.colin, b.value.toUpperCase())));
    q("#ps-dup").onclick = () => { const c = { ...it, id: uid(), x: it.x + 5, y: it.y + 5, ...(it.x2 != null ? { x2: it.x2 + 5, y2: it.y2 + 5 } : {}) }; P.items.push(c); sel = c.id; save(); paintOv(); };
    q("#ps-del").onclick = removeSel;
  }
  // texte modifié : redessine la feuille sans reconstruire le panneau (garde le curseur dans la zone de saisie)
  function paintOvKeep() { const ov = $(".prep-ov"), keep = ov.innerHTML; try { const leg = bg && bg.legends.find((l) => l.page === cur + 1); ov.innerHTML = (leg ? `<g class="pit pleg" data-id="legend"><rect class="hit" x="${leg.x}" y="${leg.y}" width="${leg.w}" height="${leg.h}" fill="transparent"/></g>` : "") + P.items.filter((it) => (it.page || 1) === cur + 1).map(itemSVG).join(""); } catch { ov.innerHTML = keep; } }
  function removeSel() {
    const it = selItem(); if (!it) return;
    P.items = P.items.filter((x) => x !== it);
    if (it.type === "image" && !P.items.some((x) => x.ref === it.ref)) CHS.delFile(it.ref).catch(() => {});
    sel = null; save(); paintOv();
  }
  function addItem(kind, extra = {}) {
    const x = 160, y = 110, base = { id: uid(), page: cur + 1, color: "#000000" };
    const it = kind === "text" ? { ...base, type: "text", x, y, w: 60, text: "Texte", font: "helvetica", size: 10, frame: "rect", frameColor: "#FF0000", color: "#FF0000", align: "center" }
      : kind === "arrow" ? { ...base, type: "arrow", x, y, x2: x + 30, y2: y + 15, color: "#FF0000", lw: 0.35 }
      : kind === "warn" ? { ...base, type: "warn", x, y, size: 8 }
      : kind === "zone" || kind === "zoneE" ? { ...base, type: "zone", shape: kind === "zoneE" ? "ellipse" : "rect", x, y, w: 30, h: 20, color: "#800080" }
      : { ...base, ...extra };
    Object.assign(it, extra.type ? {} : extra);
    P.items.push(it); sel = it.id; save(); paintOv();
  }

  // ---------- souris sur la feuille : choisir, glisser, agrandir ----------
  const ov = $(".prep-ov");
  const mmAt = (e) => { const m = ov.getScreenCTM().inverse(), p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m); return [p.x, p.y]; };
  let drag = null;
  ov.addEventListener("pointerdown", (e) => {
    const g = e.target.closest(".pit"); const h = e.target.closest(".hdl");
    if (!g) { sel = null; paintOv(); return; }
    sel = g.dataset.id; const [x, y] = mmAt(e);
    if (sel === "legend") { const pg = P.pages[cur], L = bg.legends.find((l) => l.page === cur + 1); drag = { legend: true, ox: x - L.x, oy: y - L.y, L, pg }; }
    else { const it = selItem(); drag = { it, h: h && h.dataset.h, x0: x, y0: y, s: JSON.parse(JSON.stringify(it)) }; }
    ov.setPointerCapture(e.pointerId); paintOv(); e.preventDefault();
  });
  ov.addEventListener("pointermove", (e) => {
    if (!drag) return; const [x, y] = mmAt(e);
    if (drag.legend) { drag.pg.legendAt = [Math.round((x - drag.ox) * 10) / 10, Math.round((y - drag.oy) * 10) / 10]; drag.L.x = drag.pg.legendAt[0]; drag.L.y = drag.pg.legendAt[1]; paintOv(); return; }
    const { it, s, h } = drag, dx = x - drag.x0, dy = y - drag.y0;
    if (h === "se") { if (it.type === "warn") it.size = Math.max(3, s.size + dx); else { it.w = Math.max(5, s.w + dx); if (it.type !== "text") it.h = Math.max(3, s.h + dy); else if (s.h) it.h = Math.max(3, s.h + dy); if (it.type === "image" && images[it.ref]) it.h = it.w / images[it.ref].ratio; } }
    else if (h === "a") { it.x = s.x + dx; it.y = s.y + dy; }
    else if (h === "b") { it.x2 = s.x2 + dx; it.y2 = s.y2 + dy; }
    else { it.x = s.x + dx; it.y = s.y + dy; if (s.x2 != null) { it.x2 = s.x2 + dx; it.y2 = s.y2 + dy; } }
    paintOvKeep();
  });
  ov.addEventListener("pointerup", () => { if (!drag) return; const lg = drag.legend; drag = null; save(); if (lg) bgSoon(); else paintOv(); });

  // ---------- boutons ----------
  back.querySelectorAll("[data-add]").forEach((b) => (b.onclick = () => addItem(b.dataset.add)));
  $("#prep-enc-add").onclick = () => { const L = [...ENCARTS, ...loadUser()], e = L.find((x) => x.id === $("#prep-enc").value); if (e) addItem("enc", { ...JSON.parse(JSON.stringify(e.item)), x: 130, y: 20 }); };
  $("#prep-img").onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = ""; if (!f) return;
    try {
      const im = await shrink(f), ref = `img:${meta().id}:${uid()}`;
      await CHS.putFile(ref, new Blob([JSON.stringify(im)], { type: "application/json" }));
      images[ref] = im; const w = 60; addItem("img", { type: "image", ref, x: 20, y: 20, w, h: w / im.ratio });
    } catch (err) { $(".prep-info").textContent = "Image illisible : " + err.message; }
  };
  $(".prep-dl").onclick = async () => {
    const b = $(".prep-dl"); b.disabled = true;
    try {
      const r = await build(true), c = meta(), a = document.createElement("a"), url = URL.createObjectURL(r.blob);
      a.href = url; a.download = `${c.nom}${c.numero ? "_" + c.numero : ""}_plan_A3_1-${r.layout.scale}.pdf`.replace(/[\\/:*?"<>|]+/g, "_");
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
      last = r; document.dispatchEvent(new CustomEvent("okteo:printed"));
    } catch (e) { $(".prep-info").textContent = "Échec : " + e.message; }
    b.disabled = false;
  };
  let last = null;
  const close = () => { back.hidden = true; document.body.classList.remove("prep-on"); };
  $(".prep-x").onclick = close;
  // clavier : rien ne part vers le plan pendant la préparation (Suppr supprime l'encart choisi, Échap ferme)
  window.addEventListener("keydown", (e) => {
    if (back.hidden) return;
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "");
    e.stopPropagation();
    if (e.key === "Escape") { e.preventDefault(); if (sel) { sel = null; paintOv(); } else close(); }
    else if ((e.key === "Delete" || e.key === "Backspace") && !typing && sel && sel !== "legend") { e.preventDefault(); removeSel(); }
  }, true);
  window.addEventListener("resize", () => { if (!back.hidden) bgSoon(); });

  async function open() {
    if (api.tab !== "plan") api.setTab("plan");
    P = JSON.parse(JSON.stringify(meta().impression || defaults()));
    if (!P.pages || !P.pages.length) P.pages = defaults().pages;
    P.items = P.items || [];
    cur = Math.min(cur, P.pages.length - 1); sel = null;
    back.hidden = false; document.body.classList.add("prep-on");
    await ensureScratch(); await loadImages();
    $("#prep-bati").value = api.batiStyle || "hachures";
    $("#prep-bati").onchange = (e) => { api.setBatiStyle(e.target.value); bgSoon(); };
    $("#prep-sens").value = P.sens || "auto";
    $("#prep-sens").onchange = (e) => { P.sens = e.target.value; save(); bgSoon(); };
    $("#prep-qr3d").checked = P.qr3d !== false;
    $("#prep-qr3d").onchange = (e) => { P.qr3d = e.target.checked; save(); bgSoon(); };
    paintPages(); paintCart(); paintEnc(); paintOv();
    await refreshBg();
  }
  return { open, close, get last() { return last; }, get bg() { return bg; }, get prep() { return P; }, build, addItem, select: (id) => { sel = id; paintOv(); } };
}
