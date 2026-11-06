// n° 10 (lot C, 04/11/2026) : zones d'exclusion (Kévin : « exclut tout » : boîtes, gaines, appareils, lignes directes).
// Une zone est un appareil sans électricité (type ZONE = rectangle, ZONEC = cercle / ellipse, posé comme un sanitaire :
// largeur a.sw, profondeur a.sd, rotation a.srot) ; son contour vient de saniShape (volumes.js). Pur, sans DOM : utilisé
// par le placement des boîtes, le calcul des gaines et des lignes directes, le dessin du plan, l'impression et la 3D.
import { saniShape, SANI } from "./volumes.js";

export const isZone = (t) => !!(SANI[t] && SANI[t].zone);
export const ZONE_MARGE = 0.15;   // distance gardée autour d'une zone (m) : gaine qui la contourne, boîte repoussée

const d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// contour d'une zone (polygone convexe, mètres)
export function zonePoly(a) { const s = saniShape(a)[0]; return s ? s.pts : null; }
// zones par niveau : { niveau: [polygone] } (items = appareils de tous les niveaux, avec lv)
export function zonesByLevel(items) {
  const out = {};
  for (const a of items || []) if (isZone(a.t)) { const P = zonePoly(a); if (P && P.length > 2) (out[a.lv] = out[a.lv] || []).push(P); }
  return out;
}
export function pointIn(p, P) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c; }
  return c;
}
export const insideAny = (p, polys) => (polys || []).find((P) => pointIn(p, P)) || null;
const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
// le segment [A, B] passe-t-il DANS le polygone (convexe) ? (frôler un sommet ou longer un côté ne compte pas)
export function segHits(A, B, P) {
  const n = 9;
  for (let k = 1; k < n; k++) { const t = k / n; if (pointIn({ x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t }, P)) return true; }
  for (let i = 0; i < P.length; i++) {
    const c = P[i], d = P[(i + 1) % P.length];
    const d1 = cross(c, d, A), d3 = cross(c, d, B), d4 = cross(A, B, c), d5 = cross(A, B, d);
    if (((d1 > 1e-9 && d3 < -1e-9) || (d1 < -1e-9 && d3 > 1e-9)) && ((d4 > 1e-9 && d5 < -1e-9) || (d4 < -1e-9 && d5 > 1e-9))) return true;
  }
  return false;
}
// polygone agrandi de m autour de son centre (zones convexes)
function grow(P, m) {
  const c = { x: P.reduce((s, p) => s + p.x, 0) / P.length, y: P.reduce((s, p) => s + p.y, 0) / P.length };
  return P.map((p) => { const L = d2(p, c) || 1; return { x: c.x + ((p.x - c.x) * (L + m * 1.42)) / L, y: c.y + ((p.y - c.y) * (L + m * 1.42)) / L }; });
}
// 07/11/2026 (Kévin : « une gaine ne sort jamais de la maison ») : enveloppe de la maison d'un niveau = ses pièces
// (contours intérieurs). Un point est DANS la maison s'il est dans une pièce ou à moins de HOUSE_TOL de l'une d'elles
// (épaisseur des cloisons et des murs entre deux pièces : la gaine passe par les combles, au-dessus des murs intérieurs).
// Une maison en L : la ligne droite d'une aile à l'autre sort par le creux du L → contournement par l'angle rentrant.
export const HOUSE_TOL = 0.22;
const HOUSE_STEP = 0.1;     // pas de contrôle le long d'un segment (m)
const HOUSE_IN = 0.12;      // point de passage : angle de pièce rentré vers l'intérieur (m)
const HOUSE_PROBE = 0.45;   // un angle est un point de passage possible s'il y a l'extérieur à moins de cette distance
function distSeg(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy || 1e-12, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
function nearOnPoly(p, P) {
  let best = null, bd = Infinity;
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy || 1e-12;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L)), c = { x: a.x + t * dx, y: a.y + t * dy }, d = d2(p, c);
    if (d < bd) { bd = d; best = c; }
  }
  return { p: best, d: bd };
}
const HOUSES = new Map();
// maison d'un niveau à partir des contours des pièces ; null sans pièce (pas de contrainte : comportement d'avant)
export function makeHouse(polys, tol = HOUSE_TOL) {
  const P = (polys || []).filter((q) => q && q.length > 2);
  if (!P.length) return null;
  const sig = tol + ":" + P.map((q) => q.map((v) => v.x.toFixed(2) + "," + v.y.toFixed(2)).join(" ")).join("|");
  if (HOUSES.has(sig)) return HOUSES.get(sig);
  const H = { tol, sig, P: P.map((pts) => ({ pts, x0: Math.min(...pts.map((v) => v.x)) - tol, x1: Math.max(...pts.map((v) => v.x)) + tol, y0: Math.min(...pts.map((v) => v.y)) - tol, y1: Math.max(...pts.map((v) => v.y)) + tol })), nodes: [] };
  // points de passage : angles des pièces proches de l'extérieur, rentrés dans leur pièce
  const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.71, 0.71], [-0.71, 0.71], [0.71, -0.71], [-0.71, -0.71]];
  for (const { pts } of H.P) pts.forEach((v, i) => {
    if (!D8.some(([dx, dy]) => !inHouse({ x: v.x + dx * HOUSE_PROBE, y: v.y + dy * HOUSE_PROBE }, H))) return;
    const a = pts[(i + pts.length - 1) % pts.length], b = pts[(i + 1) % pts.length];
    const ua = { x: a.x - v.x, y: a.y - v.y }, ub = { x: b.x - v.x, y: b.y - v.y }, la = Math.hypot(ua.x, ua.y) || 1, lb = Math.hypot(ub.x, ub.y) || 1;
    let bx = ua.x / la + ub.x / lb, by = ua.y / la + ub.y / lb, bl = Math.hypot(bx, by);
    if (bl < 1e-6) { bx = -ua.y / la; by = ua.x / la; bl = 1; }
    for (const sg of [1, -1]) { const q = { x: v.x + (sg * bx / bl) * HOUSE_IN, y: v.y + (sg * by / bl) * HOUSE_IN }; if (pointIn(q, pts)) { H.nodes.push(q); break; } }
  });
  if (HOUSES.size > 50) HOUSES.clear();
  HOUSES.set(sig, H);
  return H;
}
// maisons par niveau : { niveau: [contours des pièces] } → { niveau: maison }
export const housesByLevel = (roomsByLv) => Object.fromEntries(Object.entries(roomsByLv || {}).map(([lv, P]) => [lv, makeHouse(P)]).filter(([, H]) => H));
export function inHouse(p, H) {
  if (!H) return true;
  for (const q of H.P) {
    if (p.x < q.x0 || p.x > q.x1 || p.y < q.y0 || p.y > q.y1) continue;
    if (pointIn(p, q.pts)) return true;
    for (let i = 0; i < q.pts.length; i++) if (distSeg(p, q.pts[i], q.pts[(i + 1) % q.pts.length]) <= H.tol) return true;
  }
  return false;
}
// distance d'un point à la maison (0 dedans) : appareil posé dehors (façade, jardin)
export function outDist(p, H) {
  if (!H || inHouse(p, H)) return 0;
  return Math.max(0, Math.min(...H.P.map((q) => nearOnPoly(p, q.pts).d)) - H.tol);
}
// le segment [A, B] reste-t-il dans la maison ? (sA / sB : longueur ignorée au départ / à l'arrivée, pour un appareil dehors)
export function segInHouse(A, B, H, sA = 0, sB = 0) {
  if (!H) return true;
  const L = d2(A, B), n = Math.max(1, Math.ceil(L / HOUSE_STEP));
  for (let k = 1; k < n; k++) {
    const t = k / n, s = t * L;
    if (s <= sA || L - s <= sB) continue;
    if (!inHouse({ x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t }, H)) return false;
  }
  return true;
}
// le tracé (A, points…, B) sort-il de la maison ? (contrôle et tests)
export function leavesHouse(A, pts, B, H) {
  if (!H) return false;
  const L = [A, ...(pts || []), B], sA = outDist(A, H) + 0.3, sB = outDist(B, H) + 0.3;
  return L.slice(1).some((q, i) => !segInHouse(L[i], q, H, i === 0 ? sA : 0, i === L.length - 2 ? sB : 0));
}
const DCACHE = new Map();
// contournement : plus court chemin de A à B qui ne traverse aucune zone et ne sort pas de la maison (graphe de
// visibilité sur les sommets des zones agrandies de la marge et les angles de pièces proches de l'extérieur) → points
// intermédiaires ([] si le trajet direct est possible). Une zone qui contient A ou B est ignorée (on ne peut pas
// l'éviter : le contrôle le signale). Appareil dehors : seule sa partie hors de la maison est permise en ligne droite.
export function detour(A, B, polys, m = ZONE_MARGE, house = null) {
  const Z = (polys || []).filter((P) => P && P.length > 2 && !pointIn(A, P) && !pointIn(B, P));
  const H = house || null;
  const sA = H ? outDist(A, H) + (inHouse(A, H) ? 0 : 0.3) : 0, sB = H ? outDist(B, H) + (inHouse(B, H) ? 0 : 0.3) : 0;
  const free = (p, q, ip, iq) => !Z.some((P) => segHits(p, q, P)) && segInHouse(p, q, H, ip === 0 ? sA : ip === 1 ? sB : 0, iq === 1 ? sB : iq === 0 ? sA : 0);
  if (free(A, B, 0, 1)) return [];
  const key = H ? `${H.sig}#${Z.map((P) => P.map((v) => v.x.toFixed(2) + "," + v.y.toFixed(2)).join(" ")).join("|")}#${A.x.toFixed(3)},${A.y.toFixed(3)}>${B.x.toFixed(3)},${B.y.toFixed(3)}#${m}` : null;
  if (key && DCACHE.has(key)) return DCACHE.get(key).map((p) => ({ ...p }));
  const nodes = [A, B, ...Z.flatMap((P) => grow(P, m)).filter((q) => !insideAny(q, Z) && inHouse(q, H)), ...(H ? H.nodes.filter((q) => !insideAny(q, Z)) : [])];
  const N = nodes.length, dist = new Array(N).fill(Infinity), prev = new Array(N).fill(-1), done = new Array(N).fill(false);
  dist[0] = 0;
  for (;;) {
    let u = -1; for (let i = 0; i < N; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || u === 1) break;
    done[u] = true;
    for (let v = 0; v < N; v++) if (!done[v] && v !== u) { const w = dist[u] + d2(nodes[u], nodes[v]); if (w < dist[v] - 1e-12 && free(nodes[u], nodes[v], u, v)) { dist[v] = w; prev[v] = u; } }
  }
  const path = [];
  if (prev[1] >= 0) for (let v = prev[1]; v > 0; v = prev[v]) path.unshift({ x: +nodes[v].x.toFixed(3), y: +nodes[v].y.toFixed(3) });
  if (key) { if (DCACHE.size > 4000) DCACHE.clear(); DCACHE.set(key, path); }
  return path.map((p) => ({ ...p }));
}
// chemin complet d'un départ, points de passage tracés à la main compris : chaque tronçon contourne les zones et
// reste dans la maison
export function detourVia(A, pts, B, polys, m = ZONE_MARGE, house = null) {
  const all = [A, ...(pts || []), B], out = [];
  for (let i = 1; i < all.length; i++) { out.push(...detour(all[i - 1], all[i], polys, m, house)); if (i < all.length - 1) out.push(all[i]); }
  return out;
}
// point repoussé hors des zones (boîte posée dans une zone) : vers le bord le plus proche, plus la marge
export function pushOut(p, polys, m = ZONE_MARGE) {
  let q = { x: p.x, y: p.y };
  for (let pass = 0; pass < 3; pass++) {
    const P = insideAny(q, polys);
    if (!P) return q;
    let best = null, bd = Infinity;
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length], dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy || 1e-12;
      const t = Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / L)), c = { x: a.x + t * dx, y: a.y + t * dy }, d = d2(q, c);
      if (d < bd) { bd = d; best = c; }
    }
    const ux = best.x - q.x, uy = best.y - q.y, L = Math.hypot(ux, uy) || 1;
    q = { x: best.x + (ux / L) * m, y: best.y + (uy / L) * m };
  }
  return q;
}
