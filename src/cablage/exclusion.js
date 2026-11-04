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
// contournement : plus court chemin de A à B qui ne traverse aucune zone (graphe de visibilité sur les sommets des zones
// agrandies de la marge) → points intermédiaires ([] si le trajet direct est libre). Une zone qui contient A ou B est
// ignorée (on ne peut pas l'éviter : le contrôle le signale).
export function detour(A, B, polys, m = ZONE_MARGE) {
  const Z = (polys || []).filter((P) => P && P.length > 2 && !pointIn(A, P) && !pointIn(B, P));
  if (!Z.some((P) => segHits(A, B, P))) return [];
  const nodes = [A, B, ...Z.flatMap((P) => grow(P, m)).filter((q) => !insideAny(q, Z))];
  const free = (p, q) => !Z.some((P) => segHits(p, q, P));
  const N = nodes.length, dist = new Array(N).fill(Infinity), prev = new Array(N).fill(-1), done = new Array(N).fill(false);
  dist[0] = 0;
  for (;;) {
    let u = -1; for (let i = 0; i < N; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || u === 1) break;
    done[u] = true;
    for (let v = 0; v < N; v++) if (!done[v] && v !== u) { const w = dist[u] + d2(nodes[u], nodes[v]); if (w < dist[v] - 1e-12 && free(nodes[u], nodes[v])) { dist[v] = w; prev[v] = u; } }
  }
  if (prev[1] < 0) return [];
  const path = []; for (let v = prev[1]; v > 0; v = prev[v]) path.unshift({ x: +nodes[v].x.toFixed(3), y: +nodes[v].y.toFixed(3) });
  return path;
}
// chemin complet d'un départ, points de passage tracés à la main compris : chaque tronçon contourne les zones
export function detourVia(A, pts, B, polys, m = ZONE_MARGE) {
  const all = [A, ...(pts || []), B], out = [];
  for (let i = 1; i < all.length; i++) { out.push(...detour(all[i - 1], all[i], polys, m)); if (i < all.length - 1) out.push(all[i]); }
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
