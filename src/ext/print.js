import { arrowPoints, hatchLines, wallLook, wavePoints } from "../plan-style.js";
import { ABREV_DEFAUT, abrevRoom, parseAbrev } from "../print/abrev.js";
import { drawSymbol, drawText as ftzText } from "../print/ftz-sheet.js";
import { boxColor, ftzSymbol, plaques, symIndex } from "../print/ftz-symbols.js";
import { Placer, roomCandidates, spreadSymbols, pushOff, wallBoxes, repCandidates, lineBoxes, glueToWall, switchParts, WALL_SWITCH, SWITCH_R } from "../place.js";
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
import { qrMatrix } from "./barcode.js";
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
  g.direct = (geo.direct || []).map(l => ({...l, a:R(l.a), b:R(l.b), via: RL(l.via)}));
  g.wallThickness = geo.wallThickness;
  g.walls = (geo.walls || []).map(RL);
  g.wallAxis = (geo.wallAxis || []).map(RL);
  g.volumes = (geo.volumes || []).map((v) => ({ ...R(v), rect: v.rect ? RL(v.rect) : null, v0: v.v0 ? RL(v.v0) : null, v1: v.v1 ? RL(v.v1) : null, v2: v.v2 ? RL(v.v2) : null }));
  g.sanis = (geo.sanis || []).map((v) => ({ ...R(v), shape: (v.shape || []).map((p) => ({ k: p.k, pts: RL(p.pts) })), solid: v.solid }));
  g.joints = RL(geo.joints);
  g.openings = (geo.openings || []).map((o) => ({ ...o, j1: R(o.j1), j2: R(o.j2), n: V(o.n), ...(o.hinge ? { hinge: R(o.hinge), leaf: R(o.leaf), arc: RL(o.arc) } : {}) }));
  g.wallDims = (geo.wallDims || []).map((w) => ({ ...R(w), ang: w.ang + t }));
  g.limits = (geo.limits || []).map((l) => ({ a: R(l.a), b: R(l.b) }));
  g.rooms = (geo.rooms || []).map((r) => ({ ...r, poly: RL(r.poly), label: R(r.label) }));
  g.apps = (geo.apps || []).map((a) => {
    const W0 = a.wall, w = W0 ? { ...W0, ux: W0.ux * c - W0.uy * s, uy: W0.ux * s + W0.uy * c, ...(W0.nx != null ? { ax: W0.ax * c - W0.ay * s, ay: W0.ax * s + W0.ay * c, nx: W0.nx * c - W0.ny * s, ny: W0.nx * s + W0.ny * c } : {}) } : null;
    // n° 13 : un appareil mural (sauf l'applique, dos au mur) reste lisible : jamais à l'envers après rotation
    const r = a.rot ? a.rot + d : 0, rot = !r || a.t === "APP" ? r : ((r % 180) + 270) % 180 - 90;
    const rp = a.rpx != null ? { rpx: a.rpx * c - a.rpy * s, rpy: a.rpx * s + a.rpy * c } : {};
    return { ...R(a), rot, wall: w, ...rp };
  });
  g.links = (geo.links || []).map((l) => ({ a: R(l.a), b: R(l.b) }));
  g.dims = (geo.dims || []).map((x) => ({ ...x, a: R(x.a), b: R(x.b) }));
  g.boxes = (geo.boxes || []).map((b) => ({ ...R(b), rot: d, deps: b.deps.map((dp) => ({ ...dp, ends: dp.ends.map((e) => ({ ...R(e), route: RL(e.route) })), ponts: (dp.ponts || []).map((p) => ({ ...p, a: R(p.a), b: R(p.b) })) })) }));
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
  const o0 = { ouvrants: !!pref("ouvrants"), parcours: !!pref("parcours"), fond: false, cotes: true, reperes: true, liaisons: true, nomenclature: true, pieces: true, murs: true, ouvertures: true, appareils: true, boites: false, gaines: false, circuits: false, gaineNos: null, surfaces: !!pref("surfaces"), date: new Date(), ...opts };
  const geos = (Array.isArray(geoIn) ? geoIn : [geoIn]).map((g) => rotateGeo(g, o0.rot || 0));
  const logo = o0.logo === false || o0.ftz ? null : await logoData(); // logo KiTéOHM dans le cartouche (v50)
  let doc;
  if (o0.ftz) return buildFtz(geos[0], o0);
  // mise en page commune : calculée sur l'emprise de tous les niveaux réunis
  const merged = { walls: geos.flatMap((g) => g.walls), apps: geos.flatMap((g) => g.apps), rooms: geos.flatMap((g) => g.rooms), fond: geos[0].fond };
  const Lay0 = layoutPlan(geos.length > 1 ? merged : geos[0], o0);
  const JsPDF = await jspdf();
  doc = new JsPDF({ orientation: Lay0.W > Lay0.H ? "landscape" : "portrait", unit: "mm", format: Lay0.paper.toLowerCase() });
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
    doc.setFillColor(255, 255, 255);
    if (o.pieces) geo.rooms.forEach((r) => poly(r.poly, "F"));
    // murs
    doc.setFillColor(60, 60, 60); doc.setDrawColor(60, 60, 60); doc.setLineWidth(0.05);
    // v74 MAJ 2 : chaque mur dessiné selon son type (maçonnerie / cloison / doublage) et le style du bâti du chantier
    const ST = geo.batiStyle || "hachures";
    const matAt = (i) => (geo.wallMat && geo.wallMat[i]) || (geo.wallThickness?.[i] >= .16 ? "maconnerie" : "cloison");
    const fillHex = (hx) => { const v = parseInt(hx.slice(1), 16); doc.setFillColor((v >> 16) & 255, (v >> 8) & 255, v & 255); };
    const jointMat = (j) => j.mat || (j.e >= .16 ? "maconnerie" : "cloison");
    const jointP = (j) => [{x:j.x-j.e/2,y:j.y-j.e/2},{x:j.x+j.e/2,y:j.y-j.e/2},{x:j.x+j.e/2,y:j.y+j.e/2},{x:j.x-j.e/2,y:j.y+j.e/2}];
    // v77 : contour d'ensemble (comme à l'écran) : toutes les formes d'abord en gris foncé avec un trait double, puis
    // remplies sans trait par-dessus ; il ne reste que le contour extérieur, sans trait en travers des angles ni des T.
    if (o.murs) {
      doc.setDrawColor(32); doc.setFillColor(32); doc.setLineWidth(0.1);
      geo.walls.forEach((P) => poly(P, "FD"));
      geo.joints.forEach((j) => poly(jointP(j), "FD"));
      geo.walls.forEach((P, i) => {
        const L = wallLook(matAt(i), ST);
        fillHex(L.fill); poly(P, "F");
        if (L.hatch) { doc.setDrawColor(32); doc.setLineWidth(.12); hatchLines(P,.14).forEach(([a,b]) => line(a,b)); }
        if (L.wave && geo.wallAxis?.[i]) { doc.setDrawColor(32); doc.setLineWidth(.1); const W = wavePoints(geo.wallAxis[i][0], geo.wallAxis[i][1], geo.wallThickness[i]); for (let k = 1; k < W.length; k++) line(W[k - 1], W[k]); }
      });
      geo.joints.forEach((j) => {
        const P = jointP(j), L = wallLook(jointMat(j), ST);
        fillHex(L.fill); poly(P, "F");
        if (L.hatch) { doc.setDrawColor(32); doc.setLineWidth(.12); hatchLines(P,.14).forEach(([a,b]) => line(a,b)); }
      });
    }
    // v74 MAJ 3 : volumes de la salle de bain (hachures en pointillés) ; n° 9 : sanitaires (forme commune saniShape) en
    // trait gris fin pointillé, contour rempli de blanc
    if (o.appareils && ((geo.volumes || []).length || (geo.sanis || []).length)) {
      const dashPoly = (P) => { for (let k = 0; k < P.length; k++) line(P[k], P[(k + 1) % P.length]); };
      (geo.volumes || []).forEach((V) => {
        [[V.v2, 0.2, 110], [V.v1, 0.1, 70]].forEach(([P, st, g]) => { if (!P) return; doc.setDrawColor(g); doc.setLineWidth(0.1); doc.setLineDashPattern([0.5, 0.5], 0); hatchLines(P, st).forEach(([a, b]) => line(a, b)); dashPoly(P); });
      });
      doc.setDrawColor(130); doc.setLineWidth(0.12); doc.setLineDashPattern([0.7, 0.45], 0); doc.setFillColor(255);
      // n° 10 : zones d'exclusion : hachures et contour rouges
      (geo.sanis || []).filter((V) => V.zone).forEach((V) => { const Q = (V.shape[0] || {}).pts; if (!Q) return; doc.setLineDashPattern([], 0); doc.setDrawColor(221, 51, 51); doc.setLineWidth(0.1); hatchLines(Q, 0.12).forEach(([a, b]) => line(a, b)); doc.setLineWidth(0.25); dashPoly(Q); });
      doc.setDrawColor(130); doc.setLineWidth(0.12); doc.setLineDashPattern([0.7, 0.45], 0);
      (geo.sanis || []).filter((V) => !V.zone).forEach((V) => (V.shape || []).forEach((p) => {
        // n° 11 : mobilier en trait gris clair continu
        doc.setDrawColor(V.meuble ? 170 : 130); doc.setLineDashPattern(V.meuble ? [] : [0.7, 0.45], 0);
        if (p.k === "line") { for (let k = 1; k < p.pts.length; k++) line(p.pts[k - 1], p.pts[k]); }
        else if (p.k === "out") { doc.setLineDashPattern([], 0); poly(p.pts, "F"); doc.setLineDashPattern([0.7, 0.45], 0); dashPoly(p.pts); }
        else dashPoly(p.pts);
      }));
      doc.setLineDashPattern([], 0); doc.setDrawColor(32); doc.setFillColor(255);
    }
    // limites de pièce (sans mur) : trait fin en pointillés
    if (o.pieces && geo.limits && geo.limits.length) {
      doc.setDrawColor(150, 150, 150); doc.setLineWidth(0.1); doc.setLineDashPattern([0.6, 0.6], 0);
      geo.limits.forEach((l) => doc.line(X(l.a.x), Y(l.a.y), X(l.b.x), Y(l.b.y)));
      doc.setLineDashPattern([], 0);
    }
    // ouvertures
    doc.setDrawColor(40, 40, 40);
    (o.ouvertures && o.ouvrants ? geo.openings : []).forEach((op) => {
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
    const FZ = o.ftzSyms || null;   // v74 MAJ 4 : feuille du BE = symboles FTZ à leur taille réelle
    const u = FZ ? 2.1 : Math.max(geo.symU * f, 1.6);   // unité de symbole en mm (v58 : symbole d'au moins 2,5 mm imprimé)
    const tw = (str, size, bold) => { doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size); return doc.getTextWidth(String(str)); };
    const boxAt = (cx, cy, w, h) => ({ x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 });
    const apps = o.appareils ? geo.apps.filter((a) => !o.appIds || o.appIds.has(a.id)) : [];   // v74 : appareils de la page
    // v58 : symboles sans chevauchement sur le papier (décalés le long de leur mur, trait de rappel vers la vraie position)
    // n° 13 : symbole mural poussé hors du mur (bord contre la face du mur), avant l'écartement entre voisins
    // 05/11 : interrupteur / va-et-vient mural : rond collé à la face du mur (trait vers la pièce, voir symbol(..., nrm))
    const wsw = (a) => !FZ && WALL_SWITCH.has(a.t) && a.wall && a.wall.nx != null;
    const base = new Map(apps.map((a) => { const b = a.wall && a.wall.nx != null ? (wsw(a) ? glueToWall(a, a.wall, SWITCH_R * u / f) : pushOff(a, a.wall, u / f)) : a; return [a.id, { x: X(b.x), y: Y(b.y) }]; }));
    const disp = spreadSymbols(apps.map((a) => ({ id: a.id, ...base.get(a.id), ...(a.wall ? { ux: a.wall.ux, uy: a.wall.uy } : {}) })), 1.9 * u);
    const PX = (a) => (disp.get(a.id) || base.get(a.id)).x, PY = (a) => (disp.get(a.id) || base.get(a.id)).y;
    apps.forEach((a) => PL.add(boxAt(PX(a), PY(a), 2 * u, 2 * u)));      // les symboles sont des obstacles
    // v74 MAJ 4 : plaques multipostes (appareils groupés sur un mur), décalées côté pièce, et leur boîte PROF 50 (à confirmer BE)
    const plq = !FZ || o.plaques === false ? [] : plaques(apps).map((P) => {
      const sym = FZ.get(P.name), L = (geo.rooms.find((r) => r.name === P.room) || {}).label || { x: P.x, y: P.y };
      let nx = -P.wall.uy, ny = P.wall.ux; if ((L.x - P.x) * nx + (L.y - P.y) * ny < 0) { nx = -nx; ny = -ny; }
      const ids = new Set(P.ids), pa = apps.filter((a) => ids.has(a.id)), mx = pa.reduce((s2, a) => s2 + PX(a), 0) / pa.length, my = pa.reduce((s2, a) => s2 + PY(a), 0) / pa.length;
      const at = [mx + nx * 5.4, my + ny * 5.4], sw = sym ? sym.w : 6, sh = sym ? sym.h : 3;
      PL.add(boxAt(at[0], at[1], sw, sh));
      const lw = 7 * 0.6 * 2.97 * 0.95, lh = 3.2;
      const cands = [[at[0] + sw / 2 + 1 + lw / 2, at[1]], [at[0] - sw / 2 - 1 - lw / 2, at[1]], [at[0], at[1] + sh / 2 + 0.6 + lh / 2], [at[0], at[1] - sh / 2 - 0.6 - lh / 2]].map(([x, y]) => boxAt(x, y, lw, lh));
      const lab = cands.find((b) => PL.free(b)) || cands[0]; PL.add(lab);
      return { ...P, sym, at, lab };
    });
    geo.__plaques = plq.map(({ sym, ...p }) => p);
    // boîtes de pieuvre (v48) : carré de taille fixe sur le papier (comme à l'écran : environ 3 symboles), obstacles aussi
    const boxes = o.boites || o.gaines ? (geo.boxes || []).filter((b) => !o.boxIds || o.boxIds.has(b.id)) : [];
    const BS = Math.max(3.6 * u, 9), BSm = BS / f;   // v58 : boîtes plus petites
    if (o.boites) boxes.forEach((b) => PL.add(boxAt(X(b.x), Y(b.y) - BS * 0.2, BS + 5, BS * 1.4 + 5)));
    // noms et surfaces des pièces : au point d'étiquette, sinon à la place libre la plus proche dans la pièce
    const inPoly = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; };
    const RT = geo.roomTxt || 1;   // v58 : taille commune des noms de pièces
    const S1 = Math.max(6, Math.min(11, 0.5 * f * 2.83)) * RT, S2 = Math.max(5, Math.min(8, 0.34 * f * 2.83)) * RT;
    // v74 MAJ 2 : plan du BE = noms abrégés (SEJOUR, CH1…), Courier gras 6,52 mm étroit (×0,66), bleu #0000FF
    const FR = o.ftzRooms, FRK = 0.66, FRS = 6.52 * 72 / 25.4 * Math.min(1.2, RT);
    const cw = (str) => { doc.setFont("courier", "bold"); doc.setFontSize(FRS); return doc.getTextWidth(String(str)) * FRK; };
    const roomLabels = (o.pieces ? geo.rooms : []).slice().sort((p, q) => q.area - p.area).map((r) => {
      const name = FR ? abrevRoom(r.name, FR.rules) : r.name;
      const surf = o.surfaces && !FR ? `${fr(r.area, 1)} m²` : "", w = Math.max(FR ? cw(name) : tw(name, S1, true), surf ? tw(surf, S2) : 0) + 1, h = FR ? FRS * MM * 0.8 + 1.2 : (S1 + (surf ? S2 : 0)) * MM + 1.4;
      const P = r.poly, bb = { x0: Math.min(...P.map((p) => p.x)), y0: Math.min(...P.map((p) => p.y)), x1: Math.max(...P.map((p) => p.x)), y1: Math.max(...P.map((p) => p.y)) };
      const c = roomCandidates(r.label, bb, (x, y) => inPoly(x, y, P), Math.max(0.2, 4 / f)).slice(0, 80)
        .map((q) => ({ q, b: boxAt(X(q.x), Y(q.y), w, h) }));
      const fits = (b) => [[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1]].every(([x, y]) => inPoly(cx + (x - area.x - area.w / 2) / f, cy + (y - area.y - area.h / 2) / f, P));
      const got = r.labelFixed ? { b: boxAt(X(r.label.x), Y(r.label.y), w, h) } : c.find((k) => fits(k.b) && PL.free(k.b)) || c.find((k) => PL.free(k.b)) || c[0];
      PL.add(got.b);
      return { r, name, surf, x: (got.b.x0 + got.b.x1) / 2, y: (got.b.y0 + got.b.y1) / 2, h, w };
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
    const SR = FZ ? 2.97 * 72 / 25.4 : Math.max(5, pt(u * 0.9));
    const twR = (str, size, bold) => { if (!FZ) return tw(str, size, bold); doc.setFont("courier", "bold"); doc.setFontSize(size); return doc.getTextWidth(String(str)) * 0.95; };
    // n° 8 : jamais dans un mur (obstacles le long de chaque mur), de préférence côté pièce, plus loin avec un trait de
    // rappel plutôt que masqué ; position choisie à la main à l'écran (rpx / rpy) reprise telle quelle
    const WB = new Placer(PL.cell);   // murs : obstacles des repères seulement (les longueurs de murs restent possibles)
    if (o.reperes && o.murs) (geo.walls || []).forEach((P) => wallBoxes(P.map((p) => ({ x: X(p.x), y: Y(p.y) }))).forEach((b) => WB.add(b)));
    const repLabels = !o.reperes ? [] : apps.map((a) => {
      const str = a.rep || "", hs = [a.h != null && a.h !== a.hDef ? `h ${fr(a.h / 100)}` : "", a.xlink || ""].filter(Boolean).join("  ");
      const w = Math.max(twR(str, SR, true), hs ? twR(hs, SR) : 0), h = SR * MM * (hs ? 2.1 : 1.05), g = u * 0.15;
      const ax = PX(a), ay = PY(a);
      const boxOf = (x, y, an) => { const x0 = an === "start" ? x : an === "end" ? x - w : x - w / 2; return { x0, y0: y - h / 2, x1: x0 + w, y1: y + h / 2 }; };
      let b, ring = 0;
      if (a.rpx != null && a.rpy != null) b = boxOf(X(a.x + a.rpx), Y(a.y + a.rpy), "middle");
      else {
        const side = a.wall && a.wall.nx != null ? { x: a.wall.nx, y: a.wall.ny } : null;
        const C = repCandidates({ x: ax, y: ay }, u, g, h, side).map((k) => ({ ...k, b: boxOf(k.x, k.y, k.an) }));
        const k = C.find((q) => PL.free(q.b) && WB.free(q.b)) || C.find((q) => WB.free(q.b)) || C[C.length - 12];
        b = k.b; ring = k.ring;
      }
      PL.add(b);
      const far = ring > 0 || Math.hypot((b.x0 + b.x1) / 2 - ax, (b.y0 + b.y1) / 2 - ay) > u * 3;
      return { str, hs, x: b.x0, y: b.y0, ...(far ? { lead: [ax, ay, Math.max(b.x0, Math.min(ax, b.x1)), Math.max(b.y0, Math.min(ay, b.y1))] } : {}) };
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
    roomLabels.forEach(({ r, name, surf, x, y, h, w }) => {
      if (FR) {
        doc.setFont("courier", "bold"); doc.setFontSize(FRS); doc.setTextColor(0, 0, 255);
        doc.internal.write(`${FRK * 100} Tz`); doc.text(name, x - (w - 1) / 2, y + FRS * MM * 0.35); doc.internal.write("100 Tz");
        doc.setTextColor(30, 30, 30); return;
      }
      doc.setFont("helvetica", "bold"); doc.setFontSize(S1); doc.text(name, x, y - h / 2 + S1 * MM, { align: "center", baseline: "bottom" });
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
    const arrowPdf = (a, b, label, color = [60,60,60], rep = null) => {
      const P = arrowPoints(a,b,8/f); doc.setDrawColor(...color); doc.setLineWidth(FZ ? .12 : .18);
      line(P[0],P[1]); line(P[2],P[1]); line(P[3],P[1]);
      if (!FZ) { doc.setTextColor(25); doc.setFont("helvetica","normal"); doc.setFontSize(6); doc.text(String(label),X(P[1].x),Y(P[1].y)+(P[1].y<a.y ? -1.3 : 2.5),{align:"center"}); return; }
      // v74 MAJ 4 : feuille du BE : libellé en Courier gras à une place libre près de la pointe (rien s'il redit le repère)
      if (!label || String(label) === String(rep || "")) return;
      const str = String(label), lw = str.length * 0.6 * 2.97 * 0.95, lh = 3.2, tx = X(P[1].x), ty = Y(P[1].y);
      const cands = [[tx, ty - 2.4], [tx, ty + 2.6], [tx + lw / 2 + 1.2, ty], [tx - lw / 2 - 1.2, ty], [tx + lw / 2 + 1, ty - 2.4], [tx - lw / 2 - 1, ty + 2.6]].map(([x, y]) => boxAt(x, y, lw, lh));
      const bx = cands.find((q) => PL.free(q)) || cands[0]; PL.add(bx);
      ftzText(doc, { str, font: "Courier-Bold", sy: 2.97, sx: 2.82, at: [bx.x0, bx.y1 - 0.5], color: "#000000" });
    };
    const repOfApp = new Map(geo.apps.map((a) => [a.id, a.rep]));
    if (o.gaines && o.directOn !== false) (geo.direct || []).forEach(d => {
      if (o.parcours && d.b) { doc.setDrawColor(...(d.faible ? [53,103,71] : [155,36,64])); doc.setLineWidth(.18); const L = [d.b, ...(d.via || []), d.a]; for (let i = 1; i < L.length; i++) line(L[i - 1], L[i]); }
      // n° 10 : ligne directe qui contourne une zone d'exclusion : son tracé (tableau → appareil), en tirets
      else if (d.via && d.via.length && d.b) { doc.setDrawColor(...(d.faible ? [53,103,71] : [155,36,64])); doc.setLineWidth(.18); doc.setLineDashPattern([1.4, 0.7], 0); const L = [d.b, ...d.via, d.a]; for (let i = 1; i < L.length; i++) line(L[i - 1], L[i]); doc.setLineDashPattern([], 0); arrowPdf(d.a, d.via[d.via.length - 1], d.label, [60,60,60], repOfApp.get(d.appId)); }
      else arrowPdf(d.a,d.b || {x:d.a.x-.5,y:d.a.y+.5},d.label, [60,60,60], repOfApp.get(d.appId));
    });
    if (o.gaines) boxes.forEach((b) => b.deps.forEach((d) => {
      const P = portOf(b, d);
      d.ends.forEach((e) => {
        if (d.tab && !o.parcours) { arrowPdf(P,e.route?.[0] || e, b.alimLabel || b.n + "." + ((o.gaineNos || {})[b.id]?.tab || "01")); return; }
        let pts;
        if (e.route && e.route.length) pts = [P, ...e.route, e];
        else { const q = gaineCtrl(P, e, bows.get(b.id + "|" + e.key) ?? 0.15); pts = Array.from({ length: 17 }, (_, i) => { const t = i / 16, v = 1 - t; return { x: v * v * P.x + 2 * v * t * q.x + t * t * e.x, y: v * v * P.y + 2 * v * t * q.y + t * t * e.y }; }); }
        const c = d.tab ? [120, 120, 120] : FZ ? rgb(boxColor(b.n)) : rgb(e.color) || [130, 130, 130];
        doc.setDrawColor(...c); doc.setLineWidth(d.tab ? 0.2 : 0.15);
        if (d.tab) doc.setLineDashPattern([1.5, 1], 0);
        for (let i = 1; i < pts.length; i++) line(pts[i - 1], pts[i]);
        doc.setLineDashPattern([], 0);
        if (e.route && e.route.length && !e.auto) { doc.setFillColor(255, 255, 255); e.route.forEach((p) => doc.circle(X(p.x), Y(p.y), 0.45, "FD")); }
      });
      // n° 6 : pontage d'un appareil au suivant : trait mixte, même couleur que la gaine
      (d.ponts || []).forEach((p) => {
        const c = FZ ? rgb(boxColor(b.n)) : rgb(p.color) || [130, 130, 130], q = gaineCtrl(p.a, p.b, 0.12);
        doc.setDrawColor(...c); doc.setLineWidth(0.15); doc.setLineDashPattern([1.6, 0.6, 0.35, 0.6], 0);
        const pts = Array.from({ length: 13 }, (_, i) => { const t = i / 12, v = 1 - t; return { x: v * v * p.a.x + 2 * v * t * q.x + t * t * p.b.x, y: v * v * p.a.y + 2 * v * t * q.y + t * t * p.b.y }; });
        for (let i = 1; i < pts.length; i++) line(pts[i - 1], pts[i]);
        doc.setLineDashPattern([], 0);
      });
    }));
    apps.forEach((a) => {
      if (disp.has(a.id)) { doc.setDrawColor(150, 150, 150); doc.setLineWidth(0.1); doc.line(X(a.x), Y(a.y), PX(a), PY(a)); doc.setFillColor(150, 150, 150); doc.circle(X(a.x), Y(a.y), 0.25, "F"); }
      if (a.implantation?.etat === "a_preciser") { doc.setDrawColor(153,84,220); doc.setLineWidth(.25); doc.circle(PX(a),PY(a),u*1.6,"S"); }
      const fs = FZ && ftzSymbol(FZ, a.t, a.h);
      if (fs) drawSymbol(doc, fs, PX(a), PY(a), 1, a.rot || 0);
      else symbol(doc, a.t, PX(a), PY(a), u, a.rot || 0, o.circuits && !FZ ? rgb(a.color) : null, wsw(a) ? Math.atan2(a.wall.ny, a.wall.nx) * 180 / Math.PI : null);
    });
    // v74 MAJ 4 : plaques multipostes + « PROF 50 » (placés avant les repères)
    if (FZ) plq.forEach((P) => {
      if (P.sym) drawSymbol(doc, P.sym, P.at[0], P.at[1], 1, 0);
      if (P.lab) ftzText(doc, { str: "PROF 50", font: "Courier-Bold", sy: 2.97, sx: 2.82, at: [P.lab.x0, P.lab.y1 - 0.5], color: "#000000" });
    });
    // boîtes : carré, nom au-dessus, faces A–D, points d'accroche (pleins = gaine raccordée, couleur du circuit),
    // n° de la gaine à côté de son point (onglet Bandes : LI01.04 → « 04 »)
    if (o.boites) boxes.forEach((b) => {
      const bx = X(b.x), by = Y(b.y), nos = (o.gaineNos || {})[b.id] || {};
      doc.setFillColor(255, 255, 255); doc.setDrawColor(20, 20, 20); doc.setLineWidth(0.35);
      if (b.rot) { const C = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u2, v2]) => rotV(b, u2 * BS / 2, v2 * BS / 2)); doc.lines(C.slice(1).map((p, i) => [p[0] - C[i][0], p[1] - C[i][1]]), bx + C[0][0], by + C[0][1], [1, 1], "FD", true); }
      else doc.rect(bx - BS / 2, by - BS / 2, BS, BS, "FD");
      if (FZ) { const sw = String(b.n).length * 3.52 * 0.59 * 0.5; ftzText(doc, { str: String(b.n), font: "Times-Roman", sy: 3.52, sx: 2.08, at: [bx - sw, by + 1.2], color: "#008000" }); return; }
      doc.setTextColor(20, 20, 20); doc.setFont("helvetica", "bold"); doc.setFontSize(Math.max(6, pt(BS * 0.28)));
      doc.text(String(b.n), bx, by, { align: "center", baseline: "middle" });

    });
    doc.setTextColor(200, 70, 40);
    repLabels.forEach((L) => {
      if (L.hidden) return;
      if (L.lead) { doc.setDrawColor(120, 120, 120); doc.setLineWidth(0.1); doc.line(...L.lead); }
      if (FZ) {   // repères FTZ : Courier gras 2,97 mm, ×0,95, noir
        doc.setTextColor(0, 0, 0); doc.setFont("courier", "bold"); doc.setFontSize(SR); doc.internal.write("95 Tz");
        doc.text(L.str, L.x, L.y, { baseline: "top" }); if (L.hs) doc.text(L.hs, L.x, L.y + SR * MM * 1.05, { baseline: "top" });
        doc.internal.write("100 Tz"); return;
      }
      doc.setFont("helvetica", "bold"); doc.setFontSize(SR); doc.text(L.str, L.x, L.y, { baseline: "top" });
      if (L.hs) { doc.setFont("helvetica", "normal"); doc.text(L.hs, L.x, L.y + SR * MM * 1.05, { baseline: "top" }); }
    });
    geo.__hiddenReps = repLabels.filter((L) => L.hidden).length;
    doc.restoreGraphicsState();
    if (!o.bare) { doc.setDrawColor(0); doc.setLineWidth(0.3); doc.rect(area.x, area.y, area.w, area.h); }
  
    for(const d of geo.ventilation || []) { const pts=d.points;if(pts.length>1){doc.setDrawColor(33,155,155);doc.setLineWidth(.3);doc.setLineDashPattern([1.4,.8],0);for(let i=1;i<pts.length;i++)doc.line(X(pts[i-1].x),Y(pts[i-1].y),X(pts[i].x),Y(pts[i].y));doc.setLineDashPattern([],0);} }
    if (o.bare) return { apps, boxes };   // v74 : feuille FTZ, le cartouche et la légende sont dessinés à part
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

  // ---------- v74 : feuille au format FTZ (préparation d'impression) ----------
  // o.ftz = { pages: [{ boxes: [ids] | "all", direct, autres, legend, legendAt }], items: [encarts], images: {ref: {data, fmt}},
  //           fields: {client, chantier, affaire, echelle, dessinateur, date}, logo: {data, ratio}, bg: true = sans encarts }
  async function buildFtz(geo, o) {
    const F = o.ftz, C = F.charte || (await import("../print/ftz-charte.json")).default;
    const S = await import("../print/ftz-sheet.js");
    const symIdx = symIndex(C);
    const JsPDF2 = await jspdf();
    doc = new JsPDF2({ orientation: "landscape", unit: "mm", format: "a3" });
    const cart = C.pages[0].cartouche;
    const area = { x: S.OX + 2, y: S.OY + 2, w: 406, h: cart.top - 3 };
    // cadrage sur ce qui est imprimé : murs, appareils, noms de pièces (un contour de pièce mal relevé ne décentre pas le plan)
    const fit = (g) => { const e = extentOf({ ...g, rooms: g.rooms.map((r) => ({ poly: r.label ? [r.label] : [] })) }); return { e, s: [50, 75, 100, 150, 200].find((s) => (e.x1 - e.x0) * 1000 / s <= area.w && (e.y1 - e.y0) * 1000 / s <= area.h) || 200 }; };
    let F0 = fit(geo);
    // sens automatique (comme le BE) : plan tourné d'un quart de tour s'il tient ainsi à une plus grande échelle
    if (F.autoRot && F0.s > 50) { const g2 = rotateGeo(geo, 90), F2 = fit(g2); if (F2.s < F0.s) { geo = g2; F0 = F2; F.rotated = 90; } }
    const ext = F0.e, ew = ext.x1 - ext.x0, eh = ext.y1 - ext.y0, scale = F0.s;
    const Lay = { paper: "A3", orient: "paysage", W: S.A3.W, H: S.A3.H, scale, f: 1000 / scale, area, fits: ew * 1000 / scale <= area.w && eh * 1000 / scale <= area.h, ext };
    const cx = (ext.x0 + ext.x1) / 2, cy = (ext.y0 + ext.y1) / 2;
    const plan = { x0: area.x + area.w / 2 + (ext.x0 - cx) * Lay.f, x1: area.x + area.w / 2 + (ext.x1 - cx) * Lay.f, y0: area.y + area.h / 2 + (ext.y0 - cy) * Lay.f, y1: area.y + area.h / 2 + (ext.y1 - cy) * Lay.f };
    // appareils de chaque boîte, des lignes directes, et ceux qui ne sont ni dans une boîte ni en ligne directe
    const inBox = new Map(); (geo.boxes || []).forEach((b) => b.deps.forEach((d) => d.ends.forEach((e) => { if (e.key !== "tab") inBox.set(e.key, b.id); })));
    const direct = new Set((geo.direct || []).map((d) => d.appId).filter(Boolean));
    const pages = F.pages && F.pages.length ? F.pages : [{ boxes: "all", direct: false, autres: true, legend: false }, { boxes: [], direct: true, autres: false, legend: true }];
    const used = [], legends = [], cotes = [], plq = [], qrs = [], fields = { echelle: `1 / ${scale}`, ...F.fields };
    const pageApps = pages.map((pg) => {
      const ids = pg.boxes === "all" ? null : new Set(pg.boxes || []);
      return new Set(geo.apps.filter((a) => a.t === "TAB" || (inBox.has(a.id) ? !ids || ids.has(inBox.get(a.id)) : direct.has(a.id) ? pg.direct : pg.autres !== false)).map((a) => a.id));
    });
    pageApps.forEach((s) => geo.apps.forEach((a) => { if (s.has(a.id) && !used.some((u) => u.id === a.id)) used.push(a); }));
    // n° 2 : ce qu'occupe une page (rectangles en mm) si le plan est dessiné dans la zone A : murs, pièces, appareils,
    // boîtes, gaines, lignes directes, bandes des cotes des boîtes, encarts ; la légende va dans ce qui reste
    const blockedFor = (A, pg, pgApps, pgBoxes, extra = []) => {
      const PX = (x) => A.x + A.w / 2 + (x - cx) * Lay.f, PY = (y) => A.y + A.h / 2 + (y - cy) * Lay.f, P = (p) => ({ x: PX(p.x), y: PY(p.y) });
      const out = [], bb = (L) => { const xs = L.map((p) => p.x), ys = L.map((p) => p.y); return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }; };
      (geo.walls || []).forEach((W) => out.push(bb(W.map(P))));
      (geo.rooms || []).forEach((r) => { if (r.poly && r.poly.length > 2) out.push(bb(r.poly.map(P))); });
      const u = 2.1, BS = Math.max(3.6 * u, 9);
      geo.apps.forEach((a) => { if (pgApps.has(a.id)) { const q = P(a); out.push({ x0: q.x - u - 1.5, y0: q.y - u - 1.5, x1: q.x + u + 1.5, y1: q.y + u + 1.5 }); } });
      pgBoxes.forEach((b) => { const q = P(b); out.push({ x0: q.x - BS / 2 - 3, y0: q.y - BS * 0.7 - 3, x1: q.x + BS / 2 + 3, y1: q.y + BS * 0.5 + 3 });
        (b.deps || []).forEach((d) => d.ends.forEach((e) => out.push(...lineBoxes([q, ...(e.route || []).map(P), P(e)], 3, 1.2)))); });
      if (pg.direct) (geo.direct || []).forEach((l) => { if (l.a && l.b) out.push(...lineBoxes([P(l.a), P(l.b)], 3, 1.2)); });
      // cotes des boîtes : rangées le long du bâti, 7 mm puis 5 mm par cote, du côté le plus proche de la boîte
      if (pg.cotes !== false && pgBoxes.length && o.boites !== false) {
        const env = out.length ? bb(geo.walls.flatMap((W) => W.map(P))) : null;
        if (env) {
          const midX = (env.x0 + env.x1) / 2, midY = (env.y0 + env.y1) / 2, n = { top: 0, bottom: 0, left: 0, right: 0 };
          S.boxCotes(pgBoxes, geo.walls).filter((c) => c.cm >= S.COTE_STYLE.min).forEach((c) => { if (c.axis === "x") n[PY(c.at) < midY ? "top" : "bottom"]++; else n[PX(c.at) < midX ? "left" : "right"]++; });
          const band = (k) => (k ? S.COTE_STYLE.gap + (k - 1) * S.COTE_STYLE.step + 4 : 0);
          if (n.top) out.push({ x0: env.x0, y0: env.y0 - band(n.top), x1: env.x1, y1: env.y0 });
          if (n.bottom) out.push({ x0: env.x0, y0: env.y1, x1: env.x1, y1: env.y1 + band(n.bottom) });
          if (n.left) out.push({ x0: env.x0 - band(n.left), y0: env.y0, x1: env.x0, y1: env.y1 });
          if (n.right) out.push({ x0: env.x1, y0: env.y0, x1: env.x1 + band(n.right), y1: env.y1 });
        }
      }
      (F.items || []).filter((it) => (it.page || 1) === pages.indexOf(pg) + 1).forEach((it) => out.push({ x0: it.x, y0: it.y, x1: it.x + (it.w || 20), y1: it.y + (it.h || 10) }));
      return out.concat(extra);
    };
    // plan décalé dans la zone (la zone garde sa taille ; seul le centre bouge) : d (mm) vers la gauche, la droite, le haut…
    const shifted = (dx, dy) => ({ ...area, x: area.x + dx, y: area.y + dy });
    const marginX = (area.w - (plan.x1 - plan.x0)) / 2 - 12, marginY = (area.h - (plan.y1 - plan.y0)) / 2 - 12;
    const legendInfo = [];   // n° 2 : où est allée la légende (centré, plan décalé, page à part), pour la fenêtre d'impression
    for (let i = 0; i < pages.length; i++) {
      const pg = pages[i];
      if (i) doc.addPage("a3", "landscape");
      const boxIds = pg.boxes === "all" ? null : new Set(pg.boxes || []);
      // n° 2 : sur la page de la légende, le plan est décalé si la légende ne trouve pas de place libre autour du plan centré
      let pArea = area, pFit = null, rows0 = null;
      const pgBoxes0 = (geo.boxes || []).filter((b) => pg.boxes === "all" || (pg.boxes || []).includes(b.id));
      if (pg.legend && !pg.legendAt) {
        rows0 = S.legendRows(used, { boxes: (geo.boxes || []).length > 0, arrow: (geo.boxes || []).length > 0 || direct.size > 0 });
        const tries = [[0, 0], [-marginX, 0], [marginX, 0], [0, marginY], [0, -marginY]].filter(([dx, dy], k) => !k || Math.abs(dx) + Math.abs(dy) > 1);
        for (const [dx, dy] of tries) {
          const A = shifted(dx, dy), fit = S.legendFit(area, blockedFor(A, pg, pageApps[i], pgBoxes0), rows0);
          if (fit) { pArea = A; pFit = fit; break; }
        }
      }
      const LayP = pArea === area ? Lay : { ...Lay, area: pArea };
      const planP = pArea === area ? plan : { x0: plan.x0 + pArea.x - area.x, x1: plan.x1 + pArea.x - area.x, y0: plan.y0 + pArea.y - area.y, y1: plan.y1 + pArea.y - area.y };
      await drawPlan(geo, { ...o, bare: true, liaisons: false, ftzSyms: F.symbols === false ? null : symIdx, plaques: F.plaques, ftzRooms: { rules: parseAbrev(pref("abrev") || ABREV_DEFAUT) }, appIds: pageApps[i], boxIds, directOn: !!pg.direct, boites: o.boites !== false && (pg.boxes === "all" || (pg.boxes || []).length > 0), gaines: o.gaines !== false }, LayP);
      plq.push({ page: i + 1, list: geo.__plaques || [] });
      // v74 MAJ 2 : cotes de position des boîtes de la page (violet), hors du plan
      const pgBoxes = (geo.boxes || []).filter((b) => pg.boxes === "all" || (pg.boxes || []).includes(b.id));
      if (pg.cotes !== false && pgBoxes.length && o.boites !== false) {
        const PX = (x) => pArea.x + pArea.w / 2 + (x - cx) * Lay.f, PY = (y) => pArea.y + pArea.h / 2 + (y - cy) * Lay.f;
        cotes.push({ page: i + 1, list: S.drawBoxCotes(doc, S.boxCotes(pgBoxes, geo.walls), PX, PY, planP, area, geo.walls) });
      }
      S.drawFrame(doc);
      S.drawCartouche(doc, cart, fields, F.logo || null);
      if (pg.legend) {
        const rows = S.legendRows(used, { boxes: (geo.boxes || []).length > 0, arrow: (geo.boxes || []).length > 0 || direct.size > 0 });
        // v74 MAJ 4 : plaques multipostes posées sur les pages déjà dessinées (et celle-ci)
        const pn = [...new Set(plq.flatMap((x) => x.list.map((p) => p.name)))].sort();
        if (pn.length) rows.splice(rows.length - (rows[rows.length - 1]?.key === "ARROW" ? 1 : 0) - (rows.some((r) => r.key === "BOX") ? 1 : 0), 0, ...pn.map((n) => ({ key: n, label: n })));
        // n° 2 : jamais sur le plan : place libre réelle (plan, cotes, boîtes, gaines…), 1 à 3 colonnes, réduite jusqu'à
        // 70 %, plan décalé si besoin ; sinon une page « Légende » à part. Une légende placée à la main (préparation) est gardée.
        const drawSym = (d, t, x, y, r, k = 1) => {
          const sym = symIdx.get(S.FTZ_NAMES[r.key] || r.key) || null;
          if (!sym) return symbol(d, t, x, y, 1.8 * k);
          const kk = Math.min(1, (S.rowH(r) - 0.8) / sym.h, (S.LEG.colS - 1.6) / sym.w) * k;
          S.drawSymbol(d, sym, x, y, kk, 0);
        };
        let at = pg.legendAt ? { x: pg.legendAt[0], y: pg.legendAt[1], cols: pg.legendCols || 1, k: 1 } : null, where = at ? "main" : "plan";
        if (!at) {
          const bl = blockedFor(pArea, pg, pageApps[i], pgBoxes0);
          at = rows.length === (rows0 || []).length && pFit ? pFit : S.legendFit(area, bl, rows);
          if (at && pArea !== area) where = "plan décalé";
        }
        if (at) legends.push({ page: i + 1, where, ...S.drawLegend(doc, rows, at.x, at.y, drawSym, at) });
        else {
          // dernier recours : une page « Légende » juste après celle-ci, avec cadre et cartouche
          legendInfo.push({ page: i + 1, apart: true });
          pg.__legendApart = { rows, drawSym };
        }
      }
      // 3D-8 : QR « maquette 3D » de ce qui est imprimé sur cette face (coin libre, hors légende)
      if (F.qr3d) {
        try {
          const q = await F.qr3d({ apps: pageApps[i], boxes: boxIds || null, direct: !!pg.direct, page: i + 1 });
          if (q && !q.tooBig) {
            const Q = await qrMatrix(q.url), size = 48, cap = 4, ms = size / Q.n, leg = legends.find((l) => l.page === i + 1);
            const corners = [[area.x + area.w - size - 2, area.y + area.h - size - cap - 2], [area.x + 2, area.y + area.h - size - cap - 2], [area.x + area.w - size - 2, area.y + 2], [area.x + 2, area.y + 2]];
            const over = ([x, y], r) => r ? Math.max(0, Math.min(x + size, r.x + r.w) - Math.max(x, r.x)) * Math.max(0, Math.min(y + size + cap, r.y + r.h) - Math.max(y, r.y)) : 0;
            const R0 = leg ? { x: leg.x, y: leg.y, w: leg.w, h: leg.h } : null, PL = { x: planP.x0, y: planP.y0, w: planP.x1 - planP.x0, h: planP.y1 - planP.y0 };
            const [qx, qy] = corners.map((c) => ({ c, o: over(c, R0) * 100 + over(c, PL) })).sort((a, b) => a.o - b.o)[0].c;
            doc.setFillColor(255, 255, 255); doc.rect(qx - 1.5, qy - 1.5, size + 3, size + cap + 3, "F");
            doc.setFillColor(0);
            Q.rows.forEach((row, r) => { let c = 0; while (c < Q.n) { if (!row[c]) { c++; continue; } let e = c; while (e < Q.n && row[e]) e++; doc.rect(qx + c * ms, qy + r * ms, (e - c) * ms + 0.01, ms + 0.01, "F"); c = e; } });
            doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(60); doc.text("Maquette 3D de cette face (telephone)", qx + size / 2, qy + size + 3, { align: "center" }); doc.setTextColor(0);
            qrs.push({ page: i + 1, url: q.url, size: q.size, light: q.light, x: qx, y: qy, mm: size, version: Q.version });
          } else if (q) qrs.push({ page: i + 1, tooBig: true, size: q.size });
        } catch (e) { qrs.push({ page: i + 1, error: String(e && e.message || e) }); }
      }
      if (!F.bg) (F.items || []).filter((it) => (it.page || 1) === i + 1).forEach((it) => S.drawItem(doc, it, F.images || {}));
      if (pg.__legendApart) {
        const { rows: R0, drawSym: DS } = pg.__legendApart; delete pg.__legendApart;
        doc.addPage("a3", "landscape"); S.drawFrame(doc); S.drawCartouche(doc, cart, fields, F.logo || null);
        const fit = S.legendFit(area, [], R0) || { x: area.x + 4, y: area.y + 4, cols: 3, k: 0.7 };
        legends.push({ page: doc.getNumberOfPages(), where: "page à part", ...S.drawLegend(doc, R0, fit.x, fit.y, DS, fit) });
      }
    }
    doc.setProperties({ title: `Plan ${geo.chantier.nom} ${geo.chantier.numero}`.trim(), creator: "Oktéo AI — KiTéOHM" });
    return { blob: doc.output("blob"), layout: Lay, pages: doc.getNumberOfPages(), legends, legendInfo, plan, area, ftz: true, rotated: F.rotated || 0, cotes, plaques: plq, qrs };
  }
}

// symboles normalisés simplifiés (mêmes formes qu'à l'écran, v37 : carrés sauf les lumières) ; u = unité de symbole en mm ;
// rot = rotation de l'applique (degrés), côté plat contre le mur
// col : couleur du circuit [r, g, b] (v48, comme le symbole à l'écran quand les circuits sont affichés), sinon bleu
// nrm (05/11) : interrupteur / va-et-vient collé à un mur : direction de la pièce (degrés) ; rond + trait perpendiculaire
export function symbol(doc, t, x, y, u, rot = 0, col = null, nrm = null) {
  const C = col || [20, 60, 110];
  doc.setLineWidth(Math.max(0.12, u * 0.08)); doc.setDrawColor(...C); doc.setFillColor(255, 255, 255);
  if (nrm != null && WALL_SWITCH.has(t)) {
    const P = switchParts(t), c = Math.cos(nrm * Math.PI / 180), sn = Math.sin(nrm * Math.PI / 180);
    const R = (lx, ly) => [x + (lx * c - ly * sn) * u, y + (lx * sn + ly * c) * u];
    doc.circle(x, y, P.r * u, "FD");
    P.lines.forEach(([x1, y1, x2, y2]) => doc.line(...R(x1, y1), ...R(x2, y2)));
    return;
  }
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
