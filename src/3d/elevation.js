// 3D-7 : élévation d'un mur (pur, sans DOM) : la face d'un mur mise à plat, vue de la pièce, avec ses ouvertures et ses
// appareils cotés comme sur le chantier : distance depuis la face du mur d'angle le plus proche et hauteur depuis le sol.
// data = { nodes [{id,x,y}], segs [{id,a,b,ep,virt,top?}], openings [{id,seg,t,w,kind,hinge,swing,allege?,linteau?}] (m) }
// apps [{id,t,x,y,h (cm|null),hDef (cm|null),seg,rep,name}] ; rooms [{name, poly [{x,y}]}] ; H hauteurs de départ (m).
// Repère de l'élévation : u = 0 au coin gauche de la face (vue depuis la pièce), vers la droite ; v = hauteur (m).
import { openingHeights, H3D } from "./plan3d.js";

const hyp = Math.hypot;
const num = (v) => typeof v === "number" && Number.isFinite(v);
const inPoly = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i].y > y) !== (P[j].y > y) && x < (P[j].x - P[i].x) * (y - P[i].y) / (P[j].y - P[i].y) + P[i].x) c = !c; return c; };
const PLAFOND = new Set(["LUM", "SPOT", "DCL", "VMC", "BOUCHE", "DET", "DETECT", "PLAF", "HP"]);

// side = +1 : face du côté de la normale (-uy, ux) du mur ; -1 : l'autre face
export function wallElevation(data, apps, rooms, segId, side, H = H3D) {
  const nodes = new Map((data.nodes || []).map((n) => [n.id, n]));
  const segs = (data.segs || []).filter((s) => !s.virt);
  const s = segs.find((x) => x.id === segId);
  if (!s) return null;
  const A = nodes.get(s.a), B = nodes.get(s.b);
  if (!A || !B) return null;
  const L = hyp(B.x - A.x, B.y - A.y);
  if (L < 0.05) return null;
  const ux = (B.x - A.x) / L, uy = (B.y - A.y) / L, sd = side >= 0 ? 1 : -1, nx = -uy * sd, ny = ux * sd, ep = s.ep > 0 ? s.ep : 0.2;
  // bout de la face : un mur qui part de ce côté (angle rentrant, T) la raccourcit de sa demi-épaisseur ; un mur qui part
  // de l'autre côté seulement (angle sortant) la prolonge jusqu'au coin extérieur ; un mur dans le prolongement ne
  // change rien. (Le repère « wa » du plan retire toujours la plus grosse demi-épaisseur du sommet, même d'un mur dans
  // le prolongement : l'élévation donne la vraie distance au coin de la face.)
  const cut = (nodeId) => {
    let inn = 0, out = 0; const n0 = nodes.get(nodeId);
    for (const o of segs) {
      if (o.id === s.id || (o.a !== nodeId && o.b !== nodeId)) continue;
      const far = nodes.get(o.a === nodeId ? o.b : o.a); if (!far) continue;
      const l = hyp(far.x - n0.x, far.y - n0.y) || 1, k = ((far.x - n0.x) * nx + (far.y - n0.y) * ny) / l, h = (o.ep > 0 ? o.ep : 0.2) / 2;
      if (k > 0.3) inn = Math.max(inn, h); else if (k < -0.3) out = Math.max(out, h);
    }
    return inn > 0 ? inn : -out;
  };
  const ca = cut(s.a), cb = cut(s.b);
  // vue depuis la pièce (plan vu de dessus, y vers le bas de l'écran) : l'observateur regarde vers -n, sa droite est
  // (-f.y, f.x) = +u quand sd = +1 → le coin gauche est le bout a ; de l'autre face, c'est le bout b
  const flip = sd < 0;
  const f0 = ca, f1 = L - cb, W = Math.max(0, f1 - f0);
  const toU = (t) => (flip ? f1 - t : t - f0);
  const top = s.top || H.plafond;
  // pièce de ce côté
  const mx = A.x + ux * L / 2 + nx * (ep / 2 + 0.25), my = A.y + uy * L / 2 + ny * (ep / 2 + 0.25);
  const room = (rooms || []).find((r) => r.poly && r.poly.length > 2 && inPoly(mx, my, r.poly));
  const openings = (data.openings || []).filter((o) => o.seg === s.id && num(o.t) && o.w > 0).map((o) => {
    const hh = openingHeights(o, H), a = toU(o.t - o.w / 2), b = toU(o.t + o.w / 2);
    return { id: o.id, kind: o.kind, u0: Math.min(a, b), u1: Math.max(a, b), v0: hh.y0, v1: Math.min(hh.y1, top), defH: hh.defH, w: o.w };
  }).sort((p, q) => p.u0 - q.u0);
  const devices = [];
  for (const a of apps || []) {
    if (a.seg !== s.id || !num(a.x) || !num(a.y)) continue;
    const off = (a.x - A.x) * -uy + (a.y - A.y) * ux;
    if ((off >= 0 ? 1 : -1) !== sd) continue;
    const t = (a.x - A.x) * ux + (a.y - A.y) * uy, hcm = num(a.h) ? a.h : num(a.hDef) ? a.hDef : null;
    const v = hcm != null ? hcm / 100 : PLAFOND.has(a.t) ? top - 0.1 : 1.1;
    const u = toU(t), dl = u, dr = W - u;
    devices.push({ id: a.id, t: a.t, rep: a.rep || "", name: a.name || a.t, u, v, defH: !num(a.h), from: dl <= dr ? "g" : "d", d: Math.max(0, Math.min(dl, dr)) });
  }
  devices.sort((p, q) => p.u - q.u);
  return { seg: s.id, side: sd, room: room ? room.name : null, W, top, ep, openings, devices, ends: { g: flip ? "b" : "a", d: flip ? "a" : "b" } };
}

// faces d'une pièce (contour r.cycle ou côtés du polygone) : [{seg, side}] vers l'intérieur de la pièce
export function roomFaces(data, room) {
  const nodes = new Map((data.nodes || []).map((n) => [n.id, n])), out = [];
  const segs = new Map((data.segs || []).filter((s) => !s.virt).map((s) => [s.id, s]));
  const ids = room.cycle ? room.cycle.map((c) => c.seg) : [];
  for (const id of ids) {
    const s = segs.get(id); if (!s) continue;
    const A = nodes.get(s.a), B = nodes.get(s.b); if (!A || !B) continue;
    const L = hyp(B.x - A.x, B.y - A.y) || 1, ux = (B.x - A.x) / L, uy = (B.y - A.y) / L, e = (s.ep > 0 ? s.ep : 0.2) / 2 + 0.2;
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
    const side = room.poly && inPoly(mx - uy * e, my + ux * e, room.poly) ? 1 : -1;
    if (!out.some((f) => f.seg === id && f.side === side)) out.push({ seg: id, side });
  }
  return out;
}

// dessin de l'élévation en primitives (mètres, v vers le haut) : partagé par l'écran (SVG) et le PDF
// → { w, h, items [{k:"rect",x,y,w,h,cls} | {k:"line",x1,y1,x2,y2,cls} | {k:"text",x,y,s,cls,anchor}] }
export function elevationDraw(E) {
  const items = [], cm = (m) => String(Math.round(m * 100));
  items.push({ k: "rect", x: 0, y: 0, w: E.W, h: E.top, cls: "mur" });
  items.push({ k: "line", x1: -0.3, y1: 0, x2: E.W + 0.3, y2: 0, cls: "sol" });
  for (const o of E.openings) {
    items.push({ k: "rect", x: o.u0, y: o.v0, w: o.u1 - o.u0, h: o.v1 - o.v0, cls: "ouv " + o.kind });
    items.push({ k: "text", x: (o.u0 + o.u1) / 2, y: o.v1 + 0.08, s: `${o.kind === "fenetre" ? "Fenêtre" : o.kind === "garage" ? "Garage" : "Porte"} ${cm(o.w)}${o.kind === "fenetre" ? ` · allège ${cm(o.v0)}` : ""}${o.defH ? "*" : ""}`, cls: "ouvt", anchor: "middle" });
  }
  // cotes : une ligne de cote par appareil sous le sol (empilées), depuis le coin le plus proche ; hauteur à côté du symbole
  let row = 0;
  for (const d of E.devices) {
    items.push({ k: "rect", x: d.u - 0.04, y: d.v - 0.04, w: 0.08, h: 0.08, cls: "dev" });
    items.push({ k: "text", x: d.u, y: d.v + 0.08, s: d.rep || d.t, cls: "rep", anchor: "middle" });
    items.push({ k: "line", x1: d.u, y1: 0, x2: d.u, y2: d.v - 0.04, cls: "rappel" });
    items.push({ k: "text", x: d.u + 0.06, y: d.v / 2, s: `H ${cm(d.v)}${d.defH ? "*" : ""}`, cls: "hcote", anchor: "start" });
    const y = -0.18 - 0.16 * (row++ % 4), x0 = d.from === "g" ? 0 : E.W;
    items.push({ k: "line", x1: x0, y1: y, x2: d.u, y2: y, cls: "cote" });
    items.push({ k: "line", x1: d.u, y1: 0, x2: d.u, y2: y - 0.03, cls: "rappel" });
    items.push({ k: "text", x: (x0 + d.u) / 2, y: y + 0.03, s: cm(d.d), cls: "dcote", anchor: "middle" });
  }
  items.push({ k: "line", x1: 0, y1: E.top + 0.25, x2: E.W, y2: E.top + 0.25, cls: "cote" });
  items.push({ k: "text", x: E.W / 2, y: E.top + 0.28, s: `${cm(E.W)} (face)`, cls: "dcote", anchor: "middle" });
  const low = -0.18 - 0.16 * Math.min(3, Math.max(0, E.devices.length - 1)) - 0.12;
  return { w: E.W, h: E.top, x0: -0.35, y0: low, x1: E.W + 0.35, y1: E.top + 0.45, items };
}

// SVG de l'élévation (écran) ; px = largeur en pixels
export function elevationSVG(E, { px = 260 } = {}) {
  const D = elevationDraw(E), w = D.x1 - D.x0, h = D.y1 - D.y0, k = px / w;
  const X = (x) => ((x - D.x0) * k).toFixed(1), Y = (y) => ((D.y1 - y) * k).toFixed(1);
  const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const fs = Math.max(8, Math.min(11, 0.09 * k));
  const body = D.items.map((it) => it.k === "rect" ? `<rect class="${it.cls}" x="${X(it.x)}" y="${Y(it.y + it.h)}" width="${(it.w * k).toFixed(1)}" height="${(it.h * k).toFixed(1)}"/>`
    : it.k === "line" ? `<line class="${it.cls}" x1="${X(it.x1)}" y1="${Y(it.y1)}" x2="${X(it.x2)}" y2="${Y(it.y2)}"/>`
    : `<text class="${it.cls}" x="${X(it.x)}" y="${Y(it.y)}" text-anchor="${it.anchor || "start"}" font-size="${fs}">${esc(it.s)}</text>`).join("");
  return `<svg class="elev" viewBox="0 0 ${px} ${(h * k).toFixed(0)}" width="${px}" height="${(h * k).toFixed(0)}" role="img" aria-label="Élévation du mur${E.room ? " (" + esc(E.room) + ")" : ""}">${body}</svg>`;
}
