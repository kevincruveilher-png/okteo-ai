import { Placer, roomCandidates, spreadSymbols } from "../place.js";
import { pref } from "../prefs.js";
import { logoData, LOGO_RATIO } from "./logo.js";
// Sortie PDF imprimable du plan (vectorielle, à l'échelle exacte) : page 1 = plan + légende + échelle graphique
// + cartouche ; page 2 = nomenclature (appareils par pièce, surfaces) et liste des appareils.
// Unités jsPDF : millimètres. Échelle 1:N → 1 m réel = 1000/N mm sur le papier.

export const PAPERS = { A4: [297, 210], A3: [420, 297] };
const AUTO = [["A4", 50], ["A3", 50], ["A4", 75], ["A3", 75], ["A4", 100], ["A3", 100], ["A3", 125], ["A3", 150], ["A3", 200]];
const MARGIN = 10, BAND = 44;                       // marge, bandeau bas (légende + cartouche)
import { APPAREILS } from "../cablage/appareils.js";
import { portXY } from "../cablage/boites.js";
import { chooseBows } from "../cablage/trace.js";
const SHORT = { PC16: "16", PC20: "20", RJ45: "RJ", VMC: "V", TAB: "TD" };
const COLS = ["PC16", "PC20", "RJ45", "LUM", "APP", "SPOT", "INT", "VV", "BP", "VMC", "SC", "TAB"];
const COLNAME = { PC16: "16 A", PC20: "20 A", RJ45: "RJ45", LUM: "Point", APP: "Appl.", SPOT: "Spot", INT: "Int.", VV: "VV", BP: "BP", VMC: "VMC", SC: "SC", TAB: "TD" };
const fr = (v, d = 2) => v.toFixed(d).replace(".", ",");
// « #e6194b » → [230, 25, 75] ; autre chose (variable CSS, rien) → null
export function rgb(c) { const m = /^#?([0-9a-f]{6})$/i.exec(c || ""); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
// point de contrôle de l'arc d'une gaine (même formule que le cœur, attach.js gaineCtrl)
// v59 : courbure choisie pour qu'aucune gaine n'en croise une autre (trace.js chooseBows, comme à l'écran)
function gaineCtrl(b, a, k = 0.15) { return { x: (b.x + a.x) / 2 - (a.y - b.y) * k, y: (b.y + a.y) / 2 + (a.x - b.x) * k }; }

let lib = null;
async function jspdf() { if (!lib) lib = (await import("jspdf")).jsPDF; return lib; }

// v62 : plan imprimé dans le sens de la vue (rotation de la vue, okteo.viewRot) : toute la géométrie tourne autour de
// l'origine (même formule que l'écran : rotate(deg) en SVG, sens horaire, y vers le bas) ; les textes restent droits,
// les appliques gardent leur dos au mur, les boîtes tournent avec le plan (faces A–D comme à l'écran)
export function rotateGeo(geo, deg) {
  const d = ((+deg || 0) % 360 + 360) % 360;
  if (!d) return geo;
  const t = (d * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
  const R = (p) => (p ? { ...p, x: p.x * c - p.y * s, y: p.x * s + p.y * c } : p), V = (v) => (v ? { ...v, x: v.x * c - v.y * s, y: v.x * s + v.y * c } : v);
  const RL = (L) => (L || []).map(R);
  const g = { ...geo, rot: d };
  g.walls = (geo.walls || []).map(RL);
  g.joints = RL(geo.joints);
  g.openings = (geo.openings || []).map((o) => ({ ...o, j1: R(o.j1), j2: R(o.j2), n: V(o.n), ...(o.hinge ? { hinge: R(o.hinge), leaf: R(o.leaf), arc: RL(o.arc) } : {}) }));
  g.wallDims = (geo.wallDims || []).map((w) => ({ ...R(w), ang: w.ang + t }));
  g.limits = (geo.limits || []).map((l) => ({ a: R(l.a), b: R(l.b) }));
  g.rooms = (geo.rooms || []).map((r) => ({ ...r, poly: RL(r.poly), label: R(r.label) }));
  g.apps = (geo.apps || []).map((a) => {
    const w = a.wall ? { ...a.wall, ux: a.wall.ux * c - a.wall.uy * s, uy: a.wall.ux * s + a.wall.uy * c } : null;
    return { ...R(a), rot: a.rot ? a.rot + d : 0, wall: w };
  });
  g.links = (geo.links || []).map((l) => ({ a: R(l.a), b: R(l.b) }));
  g.dims = (geo.dims || []).map((x) => ({ ...x, a: R(x.a), b: R(x.b) }));
  g.boxes = (geo.boxes || []).map((b) => ({ ...R(b), rot: d, deps: b.deps.map((dp) => ({ ...dp, ends: dp.ends.map((e) => ({ ...R(e), route: RL(e.route) })) })) }));
  if (geo.fond) {
    const F = geo.fond, P = [{ x: F.x, y: F.y }, { x: F.x + F.w, y: F.y }, { x: F.x, y: F.y + F.h }, { x: F.x + F.w, y: F.y + F.h }].map(R);
    const x0 = Math.min(...P.map((p) => p.x)), y0 = Math.min(...P.map((p) => p.y));
    g.fond = { ...F, x: x0, y: y0, w: Math.max(...P.map((p) => p.x)) - x0, h: Math.max(...P.map((p) => p.y)) - y0, rot: d, w0: F.w, h0: F.h };
  }
  return g;
}
// image du fond tournée (canvas) : même sens que la géométrie ; coins vides en blanc
async function rotImage(dataUrl, deg) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl; });
  const t = (deg * Math.PI) / 180, c = Math.abs(Math.cos(t)), s = Math.abs(Math.sin(t)), k = Math.min(1, 4000 / Math.max(img.width, img.height));
  const w = img.width * k, h = img.height * k, cv = document.createElement("canvas");
  cv.width = Math.round(w * c + h * s); cv.height = Math.round(w * s + h * c);
  const x = cv.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, cv.width, cv.height);
  x.translate(cv.width / 2, cv.height / 2); x.rotate(t); x.drawImage(img, -w / 2, -h / 2, w, h);
  return cv.toDataURL("image/jpeg", 0.85);
}

export function extentOf(geo) {
  const pts = [...geo.walls.flat(), ...geo.apps.map((a) => ({ x: a.x, y: a.y })), ...geo.rooms.flatMap((r) => r.poly)];
  if (!pts.length && geo.fond) pts.push({ x: geo.fond.x, y: geo.fond.y }, { x: geo.fond.x + geo.fond.w, y: geo.fond.y + geo.fond.h });
  if (!pts.length) return { x0: 0, y0: 0, x1: 10, y1: 8 };
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y), pad = 0.6;
  return { x0: Math.min(...xs) - pad, y0: Math.min(...ys) - pad, x1: Math.max(...xs) + pad, y1: Math.max(...ys) + pad };
}

// choix format / orientation / échelle ; `fits` = le plan entre dans la zone de dessin
export function layoutPlan(geo, { paper = "auto", orient = "auto", scale = "auto" } = {}) {
  const ext = extentOf(geo), ew = ext.x1 - ext.x0, eh = ext.y1 - ext.y0;
  const tries = [];
  const papers = paper === "auto" ? ["A4", "A3"] : [paper];
  const scales = scale === "auto" ? null : [+scale];
  const list = scales ? papers.flatMap((p) => scales.map((s) => [p, s])) : AUTO.filter(([p]) => papers.includes(p));
  for (const [p, s] of list) {
    const [L, S] = PAPERS[p];
    for (const o of orient === "auto" ? ["paysage", "portrait"] : [orient]) {
      const W = o === "paysage" ? L : S, H = o === "paysage" ? S : L;
      const area = { x: MARGIN, y: MARGIN, w: W - 2 * MARGIN, h: H - 2 * MARGIN - BAND };
      const f = 1000 / s, fits = ew * f <= area.w && eh * f <= area.h;
      tries.push({ paper: p, orient: o, W, H, scale: s, f, area, fits, ext });
    }
  }
  return tries.find((t) => t.fits) || tries.sort((a, b) => Math.min(b.area.w / (ew * b.f), b.area.h / (eh * b.f)) - Math.min(a.area.w / (ew * a.f), a.area.h / (eh * a.f)))[0];
}

async function toDataURL(url) {
  const b = await (await fetch(url)).blob();
  return await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });
}

// geoIn : une géométrie (exportGeometry) ou une liste (un niveau par page, même format et même échelle)
export async function buildPlanPdf(geoIn, opts = {}) {
  const o0 = { fond: false, cotes: true, reperes: true, liaisons: true, nomenclature: true, pieces: true, murs: true, ouvertures: true, appareils: true, boites: false, gaines: false, circuits: false, gaineNos: null, surfaces: !!pref("surfaces"), date: new Date(), ...opts };
  const geos = (Array.isArray(geoIn) ? geoIn : [geoIn]).map((g) => rotateGeo(g, o0.rot || 0));
  const logo = o0.logo === false ? null : await logoData(); // logo KiTéOHM dans le cartouche (v50)
  // mise en page commune : calculée sur l'emprise de tous les niveaux réunis
  const merged = { walls: geos.flatMap((g) => g.walls), apps: geos.flatMap((g) => g.apps), rooms: geos.flatMap((g) => g.rooms), fond: geos[0].fond };
  const Lay0 = layoutPlan(geos.length > 1 ? merged : geos[0], o0);
  const JsPDF = await jspdf();
  const doc = new JsPDF({ orientation: Lay0.W > Lay0.H ? "landscape" : "portrait", unit: "mm", format: Lay0.paper.toLowerCase() });
  const geo = geos[0], Lay = Lay0, o = o0;
  for (let gi = 0; gi < geos.length; gi++) {
    if (gi) doc.addPage(Lay0.paper.toLowerCase(), Lay0.W > Lay0.H ? "landscape" : "portrait");
    await drawPlan(geos[gi], { ...o0, niveau: geos.length > 1 ? geos[gi].level : o0.niveau }, { ...Lay0, ext: geos.length > 1 ? extentOf(merged) : Lay0.ext });
  }
  // ---------- page 2 : nomenclature ----------
  const ch = geo.chantier, allApps = geos.flatMap((g) => g.apps.map((a) => ({ ...a, level: g.level || "" })));
  const totA = geos.reduce((s, g) => s + g.rooms.reduce((t, r) => t + r.area, 0), 0);
  if (o.nomenclature) {
    doc.addPage(Lay.paper.toLowerCase(), Lay.W > Lay.H ? "landscape" : "portrait");
    let y = MARGIN + 6;
    doc.setTextColor(0); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text(`Nomenclature — ${ch.nom}${ch.numero ? " · n° " + ch.numero : ""}`, MARGIN, y);
    y += 8;
    // une ligne par pièce, niveau par niveau ; les appareils sont comptés une seule fois
    const names = geos.flatMap((g) => {
      const lv = geos.length > 1 ? (g.level || "") + " · " : "";
      const l = g.rooms.map((r) => ({ label: lv + r.name, room: r, apps: g.apps.filter((a) => a.room === r.name) }));
      const out = g.apps.filter((a) => !a.room); if (out.length) l.push({ label: lv + "Hors pièce", room: null, apps: out });
      return l;
    });
    const colX = [MARGIN, MARGIN + 52, MARGIN + 70];
    const cw = Math.min(16, (Lay.W - 2 * MARGIN - 70 - 16) / COLS.length);
    const head = () => {
      doc.setFillColor(30, 45, 60); doc.rect(MARGIN, y - 4.5, Lay.W - 2 * MARGIN, 6.5, "F");
      doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
      doc.text("Pièce", colX[0] + 2, y); if (o.surfaces) doc.text("Surface", colX[1] + 14, y, { align: "right" });
      COLS.forEach((t, i) => doc.text(COLNAME[t], colX[2] + i * cw + cw / 2, y, { align: "center" }));
      doc.text("Total", colX[2] + COLS.length * cw + 8, y, { align: "center" });
      doc.setTextColor(0); y += 6.5;
    };
    head();
    const tot = Object.fromEntries(COLS.map((t) => [t, 0]));
    names.forEach(({ label: nm, room, apps }, ri) => {
      if (y > Lay.H - MARGIN - 6) { doc.addPage(Lay.paper.toLowerCase(), Lay.W > Lay.H ? "landscape" : "portrait"); y = MARGIN + 6; head(); }
      if (ri % 2) { doc.setFillColor(244, 247, 250); doc.rect(MARGIN, y - 4.3, Lay.W - 2 * MARGIN, 6, "F"); }
      doc.setFont("helvetica", "normal"); doc.setFontSize(8);
      doc.text(nm, colX[0] + 2, y); if (o.surfaces) doc.text(room ? `${fr(room.area, 1)} m²` : "", colX[1] + 14, y, { align: "right" });
      COLS.forEach((t, i) => { const n = apps.filter((a) => a.t === t).length; tot[t] += n; if (n) doc.text(String(n), colX[2] + i * cw + cw / 2, y, { align: "center" }); });
      doc.setFont("helvetica", "bold"); doc.text(String(apps.length), colX[2] + COLS.length * cw + 8, y, { align: "center" });
      y += 6;
    });
    doc.setDrawColor(0); doc.setLineWidth(0.3); doc.line(MARGIN, y - 4.3, Lay.W - MARGIN, y - 4.3);
    doc.setFont("helvetica", "bold"); doc.text("TOTAL", colX[0] + 2, y); if (o.surfaces) doc.text(`${fr(totA, 1)} m²`, colX[1] + 14, y, { align: "right" });
    COLS.forEach((t, i) => doc.text(String(tot[t]), colX[2] + i * cw + cw / 2, y, { align: "center" }));
    doc.text(String(allApps.length), colX[2] + COLS.length * cw + 8, y, { align: "center" });
    y += 12;
    // liste des appareils
    if (allApps.length) {
      doc.setFontSize(10); doc.text("Appareils", MARGIN, y); y += 6;
      doc.setFontSize(7.5);
      const list = allApps.slice().sort((a, b) => (a.level || "").localeCompare(b.level || "") || (a.room || "~").localeCompare(b.room || "~") || String(a.rep).localeCompare(String(b.rep), "fr", { numeric: true }));
      const colsN = Lay.W > 300 ? 3 : 2, cwid = (Lay.W - 2 * MARGIN) / colsN, y0 = y;
      let col = 0;
      list.forEach((a) => {
        if (y > Lay.H - MARGIN - 4) { col++; y = y0; if (col >= colsN) { doc.addPage(Lay.paper.toLowerCase(), Lay.W > Lay.H ? "landscape" : "portrait"); col = 0; y = MARGIN + 6; } }
        const x = MARGIN + col * cwid;
        doc.setFont("helvetica", "bold"); doc.text(a.rep || "", x, y);
        doc.setFont("helvetica", "normal"); doc.text(`${a.name}${a.h != null ? ` · h ${fr(a.h / 100)} m` : ["LUM", "SPOT", "VMC"].includes(a.t) ? " · plafond" : " · hauteur à préciser"} · ${geos.length > 1 ? a.level + " · " : ""}${a.room || "hors pièce"}${a.xlink ? " · " + a.xlink : ""}`, x + 12, y);
        y += 4.6;
      });
    }
  }
  async function drawPlan(geo, o, Lay) {
  const { area, f, ext } = Lay;
    const cx = (ext.x0 + ext.x1) / 2, cy = (ext.y0 + ext.y1) / 2;
    const X = (x) => area.x + area.w / 2 + (x - cx) * f, Y = (y) => area.y + area.h / 2 + (y - cy) * f;
    const pt = (mm) => mm * 72 / 25.4;                 // taille de police (pt) pour une hauteur en mm
    const poly = (P, style) => {
      if (P.length < 3) return;
      const v = []; for (let i = 1; i < P.length; i++) v.push([X(P[i].x) - X(P[i - 1].x), Y(P[i].y) - Y(P[i - 1].y)]);
      doc.lines(v, X(P[0].x), Y(P[0].y), [1, 1], style, true);
    };
    const line = (a, b) => doc.line(X(a.x), Y(a.y), X(b.x), Y(b.y));
    doc.setFont("helvetica", "normal");
    doc.setProperties({ title: `Plan électrique ${geo.chantier.nom} ${geo.chantier.numero}`.trim(), creator: "Oktéo AI — KiTéOHM" });
  
    // ---------- zone de dessin (découpée) ----------
    doc.saveGraphicsState();
    doc.rect(area.x, area.y, area.w, area.h, null); doc.clip(); doc.discardPath();
    if (o.fond && geo.fond) {
      try {
        let img = await toDataURL(geo.fond.url);
        if (geo.fond.rot) img = await rotImage(img, geo.fond.rot);
        doc.setGState(new doc.GState({ opacity: 0.3 }));
        doc.addImage(img, "JPEG", X(geo.fond.x), Y(geo.fond.y), geo.fond.w * f, geo.fond.h * f, undefined, "FAST");
        doc.setGState(new doc.GState({ opacity: 1 }));
      } catch { /* fond illisible : plan sans fond */ }
    }
    // pièces : fond très clair
    doc.setFillColor(242, 246, 249);
    if (o.pieces) geo.rooms.forEach((r) => poly(r.poly, "F"));
    // murs
    doc.setFillColor(60, 60, 60); doc.setDrawColor(60, 60, 60); doc.setLineWidth(0.05);
    if (o.murs) geo.walls.forEach((P) => poly(P, "F"));
    if (o.murs) geo.joints.forEach((j) => doc.rect(X(j.x - j.e / 2), Y(j.y - j.e / 2), j.e * f, j.e * f, "F"));
    // limites de pièce (sans mur) : trait fin en pointillés
    if (o.pieces && geo.limits && geo.limits.length) {
      doc.setDrawColor(150, 150, 150); doc.setLineWidth(0.1); doc.setLineDashPattern([0.6, 0.6], 0);
      geo.limits.forEach((l) => doc.line(X(l.a.x), Y(l.a.y), X(l.b.x), Y(l.b.y)));
      doc.setLineDashPattern([], 0);
    }
    // ouvertures
    doc.setDrawColor(40, 40, 40);
    (o.ouvertures ? geo.openings : []).forEach((op) => {
      const e2 = op.ep / 2, n = op.n;
      if (op.kind === "garage") {   // v57 : porte de garage, sans battant
        doc.setLineWidth(0.25); doc.setLineDashPattern([1, 0.6], 0); line(op.j1, op.j2); doc.setLineDashPattern([], 0);
        doc.setLineWidth(0.15); [op.j1, op.j2].forEach((j) => line({ x: j.x + n.x * e2, y: j.y + n.y * e2 }, { x: j.x - n.x * e2, y: j.y - n.y * e2 }));
      } else if (op.kind === "fenetre") {
        doc.setLineWidth(0.2);
        line({ x: op.j1.x + n.x * e2, y: op.j1.y + n.y * e2 }, { x: op.j2.x + n.x * e2, y: op.j2.y + n.y * e2 });
        line({ x: op.j1.x - n.x * e2, y: op.j1.y - n.y * e2 }, { x: op.j2.x - n.x * e2, y: op.j2.y - n.y * e2 });
        doc.setLineWidth(0.1); line(op.j1, op.j2);
      } else {
        doc.setLineWidth(0.25); line(op.hinge, op.leaf);
        doc.setLineWidth(0.12); doc.setLineDashPattern([0.8, 0.6], 0);
        for (let i = 1; i < op.arc.length; i++) line(op.arc[i - 1], op.arc[i]);
        doc.setLineDashPattern([], 0);
      }
    });
    // ---------- étiquettes placées sans chevauchement (boîtes en mm sur le papier) ----------
    const PL = new Placer(6), MM = 25.4 / 72;
    const u = Math.max(geo.symU * f, 1.6);              // unité de symbole en mm (v58 : symbole d'au moins 2,5 mm imprimé)
    const tw = (str, size, bold) => { doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size); return doc.getTextWidth(String(str)); };
    const boxAt = (cx, cy, w, h) => ({ x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 });
    const apps = o.appareils ? geo.apps : [];
    // v58 : symboles sans chevauchement sur le papier (décalés le long de leur mur, trait de rappel vers la vraie position)
    const disp = spreadSymbols(apps.map((a) => ({ id: a.id, x: X(a.x), y: Y(a.y), ...(a.wall ? { ux: a.wall.ux, uy: a.wall.uy } : {}) })), 1.9 * u);
    const PX = (a) => (disp.get(a.id) || { x: X(a.x) }).x, PY = (a) => (disp.get(a.id) || { y: Y(a.y) }).y;
    apps.forEach((a) => PL.add(boxAt(PX(a), PY(a), 2 * u, 2 * u)));      // les symboles sont des obstacles
    // boîtes de pieuvre (v48) : carré de taille fixe sur le papier (comme à l'écran : environ 3 symboles), obstacles aussi
    const boxes = o.boites || o.gaines ? (geo.boxes || []) : [];
    const BS = Math.max(3.6 * u, 9), BSm = BS / f;   // v58 : boîtes plus petites
    if (o.boites) boxes.forEach((b) => PL.add(boxAt(X(b.x), Y(b.y) - BS * 0.2, BS + 5, BS * 1.4 + 5)));
    // noms et surfaces des pièces : au point d'étiquette, sinon à la place libre la plus proche dans la pièce
    const inPoly = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; };
    const RT = geo.roomTxt || 1;   // v58 : taille commune des noms de pièces
    const S1 = Math.max(6, Math.min(11, 0.5 * f * 2.83)) * RT, S2 = Math.max(5, Math.min(8, 0.34 * f * 2.83)) * RT;
    const roomLabels = (o.pieces ? geo.rooms : []).slice().sort((p, q) => q.area - p.area).map((r) => {
      const surf = o.surfaces ? `${fr(r.area, 1)} m²` : "", w = Math.max(tw(r.name, S1, true), surf ? tw(surf, S2) : 0) + 1, h = (S1 + (surf ? S2 : 0)) * MM + 1.4;
      const P = r.poly, bb = { x0: Math.min(...P.map((p) => p.x)), y0: Math.min(...P.map((p) => p.y)), x1: Math.max(...P.map((p) => p.x)), y1: Math.max(...P.map((p) => p.y)) };
      const c = roomCandidates(r.label, bb, (x, y) => inPoly(x, y, P), Math.max(0.2, 4 / f)).slice(0, 80)
        .map((q) => ({ q, b: boxAt(X(q.x), Y(q.y), w, h) }));
      const fits = (b) => [[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1]].every(([x, y]) => inPoly(cx + (x - area.x - area.w / 2) / f, cy + (y - area.y - area.h / 2) / f, P));
      const got = r.labelFixed ? { b: boxAt(X(r.label.x), Y(r.label.y), w, h) } : c.find((k) => fits(k.b) && PL.free(k.b)) || c.find((k) => PL.free(k.b)) || c[0];
      PL.add(got.b);
      return { r, surf, x: (got.b.x0 + got.b.x1) / 2, y: (got.b.y0 + got.b.y1) / 2, h };
    });
    // cotes libres (toujours imprimées)
    const dimLabels = (o.cotes ? geo.dims : []).map((d) => {
      const ux = (d.b.x - d.a.x) / (d.L || 1), uy = (d.b.y - d.a.y) / (d.L || 1);
      let ang = -Math.atan2(uy, ux) * 180 / Math.PI; if (ang > 90 || ang <= -90) ang += 180;
      const x = X((d.a.x + d.b.x) / 2 - uy * 0.18), y = Y((d.a.y + d.b.y) / 2 + ux * 0.18), w = tw(fr(d.L), 6), h = 6 * MM;
      const vert = Math.abs(Math.sin(ang * Math.PI / 180)) > 0.7;
      PL.add(boxAt(x, y, vert ? h : w, vert ? w : h));
      return { d, ux, uy, ang, x, y };
    });
    // repères (et hauteur hors standard) : autour du symbole, à la première place libre
    const SR = Math.max(5, pt(u * 0.9));
    const repLabels = !o.reperes ? [] : apps.map((a) => {
      const str = a.rep || "", hs = [a.h != null && a.h !== a.hDef ? `h ${fr(a.h / 100)}` : "", a.xlink || ""].filter(Boolean).join("  ");
      const w = Math.max(tw(str, SR, true), hs ? tw(hs, SR) : 0), h = SR * MM * (hs ? 2.1 : 1.05), g = u * 1.05;
      const ax = PX(a), ay = PY(a);
      const pos = [[g, -g - h / 2, "l"], [g, g + h / 2, "l"], [-g, -g - h / 2, "r"], [-g, g + h / 2, "r"], [g, 0, "l"], [-g, 0, "r"], [0, -g - h / 2, "c"], [0, g + h / 2, "c"]];
      for (const [dx, dy, al] of pos) {
        const x0 = al === "l" ? ax + dx : al === "r" ? ax + dx - w : ax - w / 2, b = { x0, y0: ay + dy - h / 2, x1: x0 + w, y1: ay + dy + h / 2 };
        if (PL.free(b)) { PL.add(b); return { str, hs, x: x0, y: b.y0 }; }
      }
      return { str, hs, x: ax + g, y: ay - g - h, hidden: true };
    });
    // longueur des murs : seulement là où il reste de la place
    const wallLabels = !o.cotes || !o.murs ? [] : geo.wallDims.filter((d) => d.L >= 0.5).map((d) => {
      let a = -d.ang * 180 / Math.PI; if (a > 90 || a <= -90) a += 180;
      const w = tw(fr(d.L), 6), h = 6 * MM, vert = Math.abs(Math.sin(a * Math.PI / 180)) > 0.7, b = boxAt(X(d.x), Y(d.y), vert ? h : w, vert ? w : h);
      if (!PL.free(b)) return null; PL.add(b); return { d, a };
    }).filter(Boolean);
  
    // ---------- dessin, dans l'ordre : cotes, noms, liaisons, symboles, repères ----------
    doc.setTextColor(110, 110, 110); doc.setFont("helvetica", "normal"); doc.setFontSize(6);
    wallLabels.forEach(({ d, a }) => doc.text(fr(d.L), X(d.x), Y(d.y), { align: "center", baseline: "middle", angle: a }));
    doc.setDrawColor(60, 90, 160); doc.setTextColor(60, 90, 160); doc.setLineWidth(0.15);
    dimLabels.forEach(({ d, ux, uy, ang, x, y }) => {
      line(d.a, d.b);
      const t = 0.12;
      [d.a, d.b].forEach((p) => line({ x: p.x - uy * t, y: p.y + ux * t }, { x: p.x + uy * t, y: p.y - ux * t }));
      doc.text(fr(d.L), x, y, { align: "center", baseline: "middle", angle: ang });
    });
    doc.setTextColor(30, 30, 30);
    roomLabels.forEach(({ r, surf, x, y, h }) => {
      doc.setFont("helvetica", "bold"); doc.setFontSize(S1); doc.text(r.name, x, y - h / 2 + S1 * MM, { align: "center", baseline: "bottom" });
      if (surf) { doc.setFont("helvetica", "normal"); doc.setFontSize(S2); doc.text(surf, x, y + h / 2, { align: "center", baseline: "bottom" }); }
    });
    // liaisons commande → lumière : droites, comme à l'écran (v35)
    if (o.liaisons && o.appareils && geo.links.length) {
      doc.setDrawColor(50, 90, 200); doc.setLineWidth(0.15); doc.setLineDashPattern([1.2, 0.8], 0);
      geo.links.forEach((l) => line(l.a, l.b));
      doc.setLineDashPattern([], 0);
    }
    // gaines (v48) : du point d'accroche de la boîte à l'appareil, en arc ou par les points de passage tracés à la main,
    // couleur du circuit ; l'alimentation (vers le tableau) en pointillés gris
    // v62 : boîte tournée avec le plan : le point d'accroche tourne autour du centre de la boîte
    const rotV = (b, dx, dy) => { const t = ((b.rot || 0) * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t); return [dx * c - dy * s, dx * s + dy * c]; };
    const portW = (b, f2, i) => { const P = portXY({ x: 0, y: 0 }, BSm, b.N, f2, i), [dx, dy] = rotV(b, P.x, P.y); return { x: b.x + dx, y: b.y + dy }; };
    const portOf = (b, d) => portW(b, d.face, d.slot);
    // courbures choisies boîte par boîte (seuls les croisements dans une même boîte sont interdits)
    const bows = new Map();
    if (o.gaines) boxes.forEach((b) => {
      const bowL = [], bowF = [];
      b.deps.forEach((d) => { const P = portOf(b, d); d.ends.forEach((e) => { if (e.route && e.route.length) bowF.push([P, ...e.route, e]); else bowL.push({ key: b.id + "|" + e.key, P, T: e }); }); });
      chooseBows(bowL, bowF).forEach((v, k) => bows.set(k, v));
    });
    if (o.gaines) boxes.forEach((b) => b.deps.forEach((d) => {
      const P = portOf(b, d);
      d.ends.forEach((e) => {
        let pts;
        if (e.route && e.route.length) pts = [P, ...e.route, e];
        else { const q = gaineCtrl(P, e, bows.get(b.id + "|" + e.key) ?? 0.15); pts = Array.from({ length: 17 }, (_, i) => { const t = i / 16, v = 1 - t; return { x: v * v * P.x + 2 * v * t * q.x + t * t * e.x, y: v * v * P.y + 2 * v * t * q.y + t * t * e.y }; }); }
        const c = d.tab ? [120, 120, 120] : rgb(e.color) || [130, 130, 130];
        doc.setDrawColor(...c); doc.setLineWidth(d.tab ? 0.2 : 0.25);
        if (d.tab) doc.setLineDashPattern([1.5, 1], 0);
        for (let i = 1; i < pts.length; i++) line(pts[i - 1], pts[i]);
        doc.setLineDashPattern([], 0);
        if (e.route && e.route.length) { doc.setFillColor(255, 255, 255); e.route.forEach((p) => doc.circle(X(p.x), Y(p.y), 0.45, "FD")); }
      });
    }));
    apps.forEach((a) => {
      if (disp.has(a.id)) { doc.setDrawColor(150, 150, 150); doc.setLineWidth(0.1); doc.line(X(a.x), Y(a.y), PX(a), PY(a)); doc.setFillColor(150, 150, 150); doc.circle(X(a.x), Y(a.y), 0.25, "F"); }
      if (a.implantation?.etat === "a_preciser") { doc.setDrawColor(153,84,220); doc.setLineWidth(.25); doc.circle(PX(a),PY(a),u*1.6,"S"); }
      symbol(doc, a.t, PX(a), PY(a), u, a.rot || 0, o.circuits ? rgb(a.color) : null);
    });
    // boîtes : carré, nom au-dessus, faces A–D, points d'accroche (pleins = gaine raccordée, couleur du circuit),
    // n° de la gaine à côté de son point (onglet Bandes : LI01.04 → « 04 »)
    if (o.boites) boxes.forEach((b) => {
      const bx = X(b.x), by = Y(b.y), nos = (o.gaineNos || {})[b.id] || {};
      doc.setFillColor(255, 255, 255); doc.setDrawColor(20, 20, 20); doc.setLineWidth(0.35);
      if (b.rot) { const C = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u2, v2]) => rotV(b, u2 * BS / 2, v2 * BS / 2)); doc.lines(C.slice(1).map((p, i) => [p[0] - C[i][0], p[1] - C[i][1]]), bx + C[0][0], by + C[0][1], [1, 1], "FD", true); }
      else doc.rect(bx - BS / 2, by - BS / 2, BS, BS, "FD");
      doc.setTextColor(20, 20, 20); doc.setFont("helvetica", "bold"); doc.setFontSize(Math.max(6, pt(BS * 0.28)));
      doc.text(String(b.n), bx, by - BS / 2 - 3, { align: "center", baseline: "bottom" });
      doc.setFont("helvetica", "normal"); doc.setFontSize(Math.max(4, pt(BS * 0.14))); doc.setTextColor(140, 140, 140);
      [["A", 0, -1], ["B", 1, 0], ["C", 0, 1], ["D", -1, 0]].forEach(([fc, dx, dy]) => { const [rx, ry] = rotV(b, dx, dy); doc.text(fc, bx + rx * BS * 0.3, by + ry * BS * 0.3, { align: "center", baseline: "middle" }); });
      const used = new Map(b.deps.filter((d) => d.face && d.slot != null).map((d) => [d.face + d.slot, d]));
      const out = { A: [0, -1], B: [1, 0], C: [0, 1], D: [-1, 0] };
      // rang d'un point dans sa suite de points voisins occupés (0, 1, 2…) : les n° alternent sur deux lignes
      const runIdx = (fc, i) => { let k = 0; while (i - k - 1 >= 0 && used.has(fc + (i - k - 1))) k++; return k; };
      for (const fc of ["A", "B", "C", "D"]) for (let i = 0; i < b.N; i++) {
        const Pw = portW(b, fc, i), px = X(Pw.x), py = Y(Pw.y), d = used.get(fc + i);
        const c = d ? (d.tab ? [20, 20, 20] : rgb((d.ends[0] || {}).color) || [130, 130, 130]) : null;
        doc.setLineWidth(0.12); doc.setDrawColor(...(c || [150, 150, 150])); doc.setFillColor(...(c || [255, 255, 255]));
        doc.circle(px, py, d ? 0.55 : 0.4, "FD");
        const no = d && (d.tab ? nos.tab : d.ends.map((e) => nos[e.key]).find(Boolean));
        if (no) {
          const [ox, oy] = rotV(b, ...out[fc]).map((v) => Math.round(v * 1e6) / 1e6), vert = Math.abs(ox) > Math.abs(oy);
          // n° sur un petit fond blanc, pour rester lisible par-dessus les gaines
          // (toujours horizontal : sur les faces B et D, les n° voisins se suivent sans se chevaucher)
          doc.setFont("helvetica", "bold"); doc.setFontSize(4);
          const w = doc.getTextWidth(no) + 0.3, h = 1.45, tx = px + ox * (vert ? w / 2 + 0.75 : 0), ty = py + oy * (vert ? 0 : 1.55 + (runIdx(fc, i) % 2 ? 1.5 : 0)); // points voisins occupés : un sur deux décalé d'un cran
          doc.setFillColor(255, 255, 255); doc.rect(tx - w / 2, ty - h / 2, w, h, "F");
          doc.setTextColor(...(c || [0, 0, 0]));
          doc.text(no, tx, ty, { align: "center", baseline: "middle" });
        }
      }
    });
    doc.setTextColor(200, 70, 40);
    repLabels.forEach((L) => {
      if (L.hidden) return;
      doc.setFont("helvetica", "bold"); doc.setFontSize(SR); doc.text(L.str, L.x, L.y, { baseline: "top" });
      if (L.hs) { doc.setFont("helvetica", "normal"); doc.text(L.hs, L.x, L.y + SR * MM * 1.05, { baseline: "top" }); }
    });
    geo.__hiddenReps = repLabels.filter((L) => L.hidden).length;
    doc.restoreGraphicsState();
    doc.setDrawColor(0); doc.setLineWidth(0.3); doc.rect(area.x, area.y, area.w, area.h);
  
    // ---------- bandeau : légende, échelle graphique, cartouche ----------
    const by = Lay.H - MARGIN - BAND + 4, bh = BAND - 4;
    const present = o.appareils ? COLS.filter((t) => geo.apps.some((a) => a.t === t)) : [];
    const cartW = 128, legW = Lay.W - 2 * MARGIN - cartW - 4;
    doc.setLineWidth(0.25); doc.rect(MARGIN, by, legW, bh);
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(0);
    doc.text("LÉGENDE", MARGIN + 3, by + 5);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7);
    const perCol = 5, colW = 46;
    present.forEach((t, i) => {
      const c = Math.floor(i / perCol), r = i % perCol, x = MARGIN + 6 + c * colW, y = by + 10 + r * 5.6;
      if (x + colW > MARGIN + legW - 50) return;
      symbol(doc, t, x, y, 2.2);
      doc.setTextColor(0); doc.setFontSize(7); doc.setFont("helvetica", "normal");
      doc.text(`${geo.apps.find((a) => a.t === t).name}  × ${geo.apps.filter((a) => a.t === t).length}`, x + 4, y, { baseline: "middle" });
    });
    if (o.boites && (geo.boxes || []).length) {
      const i = present.length, c = Math.floor(i / perCol), r = i % perCol, x = MARGIN + 6 + c * colW, y = by + 10 + r * 5.6;
      if (x + colW <= MARGIN + legW - 50) {
        doc.setDrawColor(20, 20, 20); doc.setFillColor(255, 255, 255); doc.setLineWidth(0.3); doc.rect(x - 1.8, y - 1.8, 3.6, 3.6, "FD");
        doc.setTextColor(0); doc.setFontSize(7); doc.setFont("helvetica", "normal");
        doc.text(`Boîte de pieuvre  × ${geo.boxes.length}`, x + 4, y, { baseline: "middle" });
      }
    }
    if (!present.length && !(o.boites && (geo.boxes || []).length)) { doc.setTextColor(120); doc.text(o.appareils ? "Aucun appareil posé." : "Appareils non imprimés.", MARGIN + 6, by + 11); }
    // échelle graphique (0 – 1 – 2 – 5 m)
    const sx = MARGIN + legW - 46, sy = by + bh - 8, m1 = f;
    doc.setTextColor(0); doc.setFontSize(6.5); doc.setLineWidth(0.2); doc.setDrawColor(0);
    const steps = [0, 1, 2, 5].filter((v) => v * m1 <= 42);
    for (let i = 0; i + 1 < steps.length; i++) { doc.setFillColor(i % 2 ? 255 : 0); doc.rect(sx + steps[i] * m1, sy, (steps[i + 1] - steps[i]) * m1, 1.6, "FD"); }
    steps.forEach((v) => doc.text(`${v}`, sx + v * m1, sy - 1, { align: "center" }));
    doc.text("m", sx + steps[steps.length - 1] * m1 + 2.5, sy + 1.4);
    doc.setFont("helvetica", "bold"); doc.text(`ÉCHELLE 1:${Lay.scale}`, sx, sy + 5.5);
    // cartouche
    const kx = Lay.W - MARGIN - cartW;
    doc.setFont("helvetica", "normal"); doc.setLineWidth(0.3); doc.rect(kx, by, cartW, bh);
    doc.setFillColor(30, 45, 60); doc.rect(kx, by, cartW, 8, "F");
    doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text(o.boites && (geo.boxes || []).length ? "PLAN ÉLECTRIQUE — CÂBLAGE (PIEUVRE)" : "PLAN ÉLECTRIQUE — IMPLANTATION", kx + 3, by + 5.3);
    doc.setFontSize(7); doc.text("Oktéo AI", kx + cartW - 3, by + 5.3, { align: "right" });
    if (logo) { const lw = 30; doc.addImage(logo, "JPEG", kx + cartW - 3 - lw, by + bh - 3 - lw / LOGO_RATIO, lw, lw / LOGO_RATIO); }
    const ch = geo.chantier, d = o.date;
    const rows = [
      ["Chantier", `${ch.nom}${ch.numero ? "  ·  n° " + ch.numero : ""}`],
      ["Pavillonneur", ch.client || "—"],
      ["Niveau", o.niveau || "RDC"],
      ["Échelle · format", `1:${Lay.scale}  ·  ${Lay.paper} ${Lay.orient}`],
      ["Date · indice", `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}  ·  ${o.indice || "A"}`],
    ];
    doc.setTextColor(0);
    rows.forEach(([k, v], i) => {
      const y = by + 13.5 + i * 5.6;
      doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); doc.setTextColor(110); doc.text(k, kx + 3, y);
      doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(0); doc.text(v, kx + 32, y);
      doc.setDrawColor(200); doc.setLineWidth(0.1); if (i < rows.length - 1) doc.line(kx + 2, y + 1.8, kx + cartW - 2, y + 1.8);
    });
    const totA = geo.rooms.reduce((s, r) => s + r.area, 0);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(90);
    doc.text(`${geo.rooms.length} pièces${o.surfaces ? ` · ${fr(totA, 1)} m² habitables` : ""} · ${geo.apps.length} appareils`, MARGIN + 3, by + bh - 2.5);
    if (!Lay.fits) { doc.setTextColor(200, 40, 40); doc.setFontSize(7); doc.text("Attention : le plan dépasse du cadre à cette échelle.", area.x + 2, area.y + 4); }
  }

  const blob = doc.output("blob");
  return { blob, layout: Lay0, pages: doc.getNumberOfPages() };
}

// symboles normalisés simplifiés (mêmes formes qu'à l'écran, v37 : carrés sauf les lumières) ; u = unité de symbole en mm ;
// rot = rotation de l'applique (degrés), côté plat contre le mur
// col : couleur du circuit [r, g, b] (v48, comme le symbole à l'écran quand les circuits sont affichés), sinon bleu
export function symbol(doc, t, x, y, u, rot = 0, col = null) {
  const C = col || [20, 60, 110];
  doc.setLineWidth(Math.max(0.12, u * 0.08)); doc.setDrawColor(...C); doc.setFillColor(255, 255, 255);
  const txt = (s, white) => { doc.setFont("helvetica", "bold"); doc.setFontSize(Math.max(3.5, u * 0.85 * 72 / 25.4)); if (white) doc.setTextColor(255, 255, 255); else doc.setTextColor(...C); doc.text(s, x, y + u * 0.05, { align: "center", baseline: "middle" }); };
  const sq = (r, style = "FD") => doc.roundedRect(x - r * u, y - r * u, 2 * r * u, 2 * r * u, 0.18 * r * u, 0.18 * r * u, style);
  const tick = () => doc.line(x + 0.4 * u, y - 0.4 * u, x + 0.95 * u, y - 0.95 * u);
  switch (t) {
    case "PC16": sq(0.8); txt(SHORT.PC16); break;
    case "PC20": doc.setFillColor(...C); sq(0.8); txt(SHORT.PC20, true); break;
    case "RJ45": sq(0.8); txt(SHORT.RJ45); break;
    case "APP": { const r = 0.9 * u, c = Math.cos(rot * Math.PI / 180), sn = Math.sin(rot * Math.PI / 180);
      const R = (lx, ly) => [x + lx * c - ly * sn, y + lx * sn + ly * c];
      const n = 12, P = []; for (let i = 0; i <= n; i++) { const a = Math.PI + Math.PI * i / n; P.push(R(Math.cos(a) * r, 0.25 * u + Math.sin(a) * r)); }
      doc.lines(P.slice(1).map((p, i) => [p[0] - P[i][0], p[1] - P[i][1]]), P[0][0], P[0][1], [1, 1], "FD", true);
      const L = (a, b) => doc.line(...R(...a), ...R(...b));
      L([-0.55 * u, -0.3 * u], [0.55 * u, 0.25 * u]); L([0.55 * u, -0.3 * u], [-0.55 * u, 0.25 * u]); break; }
    case "LUM": doc.circle(x, y, 0.9 * u, "FD"); doc.line(x - 0.6 * u, y - 0.6 * u, x + 0.6 * u, y + 0.6 * u); doc.line(x + 0.6 * u, y - 0.6 * u, x - 0.6 * u, y + 0.6 * u); break;
    case "SPOT": { doc.circle(x, y, 0.5 * u, "FD"); doc.setFillColor(...C); doc.circle(x, y, 0.2 * u, "F");
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, r0 = (k % 2 ? 0.68 : 0.68) * u, r1 = (k % 2 ? 1.0 : 1.02) * u; doc.line(x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * r1, y + Math.sin(a) * r1); } break; }
    case "INT": sq(0.55); tick(); break;
    case "VV": sq(0.55); tick(); doc.line(x - 0.1 * u, y + 0.3 * u, x + 0.5 * u, y - 0.3 * u); break;
    case "BP": sq(0.55); doc.setFillColor(...C); doc.circle(x, y, 0.2 * u, "F"); break;
    case "VMC": sq(0.8); txt(SHORT.VMC); break;
    case "INCONNU": sq(0.8); txt("?"); break;
    case "SC": sq(0.6); doc.line(x - 0.85 * u, y - 0.85 * u, x + 0.85 * u, y + 0.85 * u); doc.line(x + 0.85 * u, y - 0.85 * u, x - 0.85 * u, y + 0.85 * u); break;
    case "TAB": doc.setFillColor(...C); doc.roundedRect(x - u, y - 1.2 * u, 2 * u, 2.4 * u, 0.2 * u, 0.2 * u, "FD"); txt(SHORT.TAB, true); break;
    default: { sq(0.8); const D = APPAREILS[t]; if (D) { doc.setFont("helvetica", "bold"); doc.setFontSize(Math.max(3, u * (D.lab.length > 2 ? 0.55 : 0.8) * 72 / 25.4)); doc.setTextColor(...C); doc.text(D.lab, x, y + u * 0.05, { align: "center", baseline: "middle" }); } }
  }
}
