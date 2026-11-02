// v74 MAJ 3 : volumes de la salle de bain (NF C 15-100, partie 7-701), méthode validée avec Kévin le 02/11/2026,
// à confirmer avec le référentiel du BE. Pur (sans DOM) : partagé par le cœur (dessin, contrôle) et l'impression.
//
// Appareils sanitaires (posés comme des appareils, sans circuit ni repère) :
//   BAIG baignoire, RECV receveur de douche : rectangle w × d (m), tourné de rot degrés autour de son centre ;
//   DITAL douche à l'italienne (sans receveur) : le point posé est la pomme de douche fixe.
// Volume 0 = l'intérieur de la baignoire / du receveur. Volume 1 = la même emprise jusqu'à 2,25 m de haut ; douche sans
// receveur : 1,20 m autour de la pomme fixe. Volume 2 = 0,60 m autour du volume 1, jusqu'à 3 m. Les volumes
// s'arrêtent aux murs : chacun est découpé par le contour intérieur de la pièce.
export const SANI = {
  BAIG: { n: "Baignoire", w: 1.7, d: 0.75 },
  RECV: { n: "Receveur de douche", w: 0.9, d: 0.9 },
  DITAL: { n: "Douche à l'italienne (pomme fixe)", w: 1.2, d: 1.2 },
};
export const isSani = (t) => !!SANI[t];
export const V1_H = 2.25, V2_H = 3, V2_W = 0.6, ITAL_R = 1.2;

const dims = (a) => ({ w: a.sw > 0 ? a.sw : SANI[a.t].w, d: a.sd > 0 ? a.sd : SANI[a.t].d });
// contour d'un sanitaire (rectangle tourné), en mètres
export function saniRect(a) {
  const { w, d } = dims(a), t = ((a.srot || 0) * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
  return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([x, y]) => ({ x: a.x + x * c - y * s, y: a.y + x * s + y * c }));
}
const area2 = (P) => P.reduce((s, p, i) => { const q = P[(i + 1) % P.length]; return s + p.x * q.y - q.x * p.y; }, 0);
const ccw = (P) => (area2(P) < 0 ? P.slice().reverse() : P);
function circle(c, r, n = 48) { return Array.from({ length: n }, (_, i) => ({ x: c.x + r * Math.cos((2 * Math.PI * i) / n), y: c.y + r * Math.sin((2 * Math.PI * i) / n) })); }
// rectangle agrandi de r tout autour, coins arrondis (polygone convexe)
function offsetRect(R, r, n = 8) {
  const C = ccw(R), out = [];
  for (let i = 0; i < 4; i++) {
    const p = C[i], a = C[(i + 3) % 4], b = C[(i + 1) % 4];
    const a0 = Math.atan2(p.y - a.y, p.x - a.x) - Math.PI / 2, a1 = Math.atan2(b.y - p.y, b.x - p.x) - Math.PI / 2;
    let d = a1 - a0; while (d < 0) d += 2 * Math.PI; while (d > 2 * Math.PI) d -= 2 * Math.PI;
    for (let k = 0; k <= n; k++) { const t = a0 + (d * k) / n; out.push({ x: p.x + r * Math.cos(t), y: p.y + r * Math.sin(t) }); }
  }
  return out;
}
// Sutherland–Hodgman : le contour de la pièce (quelconque) découpé par une forme convexe
export function clipConvex(subject, clip) {
  const C = ccw(clip);
  let out = subject.slice();
  const inside = (p, a, b) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) >= -1e-12;
  const cut = (p, q, a, b) => { const A1 = b.y - a.y, B1 = a.x - b.x, C1 = A1 * a.x + B1 * a.y, A2 = q.y - p.y, B2 = p.x - q.x, C2 = A2 * p.x + B2 * p.y, D = A1 * B2 - A2 * B1; return Math.abs(D) < 1e-15 ? p : { x: (B2 * C1 - B1 * C2) / D, y: (A1 * C2 - A2 * C1) / D }; };
  for (let i = 0; i < C.length && out.length; i++) {
    const a = C[i], b = C[(i + 1) % C.length], inp = out; out = [];
    for (let j = 0; j < inp.length; j++) {
      const p = inp[j], q = inp[(j + 1) % inp.length], pi = inside(p, a, b), qi = inside(q, a, b);
      if (pi) { out.push(p); if (!qi) out.push(cut(p, q, a, b)); } else if (qi) out.push(cut(p, q, a, b));
    }
  }
  return out.length >= 3 && Math.abs(area2(out)) > 1e-6 ? out : null;
}
export function distPoly(x, y, P) {
  let m = Infinity;
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy || 1e-12;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / L));
    m = Math.min(m, Math.hypot(x - a.x - t * dx, y - a.y - t * dy));
  }
  return m;
}
export function pointIn(x, y, P) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c; }
  return c;
}
// volumes d'un sanitaire dans sa pièce : {v0, v1, v2} (polygones ou null) ; room = contour intérieur de la pièce
export function volumesOf(a, room) {
  if (!isSani(a.t)) return null;
  const R = room && room.length >= 3 ? room : null;
  const cl = (shape) => (R ? clipConvex(R, shape) : ccw(shape));
  if (a.t === "DITAL") return { v0: null, v1: cl(circle(a, ITAL_R)), v2: cl(circle(a, ITAL_R + V2_W, 64)) };
  const S = saniRect(a);
  return { v0: cl(S), v1: cl(S), v2: cl(offsetRect(S, V2_W)) };
}
// volume (0, 1 ou 2) où se trouve un point à la hauteur h (cm, null = plafond) ; null = hors volume
export function volumeAt(x, y, h, V) {
  const hm = h == null ? 2.5 : h / 100;
  // un appareil mural est posé sur la face du mur, souvent pile au bord du volume : 3 cm de tolérance
  const inV = (P) => P && (pointIn(x, y, P) || distPoly(x, y, P) < 0.03);
  if (inV(V.v0) && hm <= 0.6) return 0;
  if (inV(V.v1) && hm <= V1_H) return 1;
  if (inV(V.v2) && hm <= V2_H && !(inV(V.v1) && hm <= V1_H)) return 2;
  if (inV(V.v1) && hm > V1_H && hm <= V2_H) return 2;   // au-dessus du volume 1 et jusqu'à 3 m : traité comme le volume 2
  return null;
}
// règles simplifiées (à valider avec le BE) : rien en volume 0 ; en volume 1, aucune prise, commande, chauffage
// (lumière seulement en TBTS 12 V) ; en volume 2, aucune prise ni commande (lumière et sèche-serviette classe II).
const PRISE = (t) => /^(PC|PLAQ|RJ45|TV|PCEXT|PC32)/.test(t);
const CMD = (t) => /^(INT|VV|BP|CVR|CVMC|DET)/.test(t);
const LIGHT = (t) => ["LUM", "APP", "SPOT", "APPE"].includes(t);
const HEAT = (t) => ["RAD", "SS"].includes(t);
export function volumeRule(t, v) {
  if (v == null || isSani(t) || ["TAB", "VEX", "VREJ", "EQL", "INCONNU"].includes(t)) return null;
  if (v === 0) return { bloquant: true, text: "volume 0 : aucun appareil électrique (sauf TBTS 12 V)" };
  if (v === 1) {
    if (LIGHT(t)) return { bloquant: false, text: "volume 1 : luminaire en TBTS 12 V seulement (IPX4)" };
    if (PRISE(t) || CMD(t) || HEAT(t)) return { bloquant: true, text: "volume 1 : prise, commande et chauffage interdits" };
    return { bloquant: false, text: "volume 1 : seulement du matériel prévu pour ce volume (TBTS 12 V, IPX4)" };
  }
  if (PRISE(t) || CMD(t)) return { bloquant: true, text: "volume 2 : prise et commande interdites (sauf prise rasoir)" };
  if (LIGHT(t) || HEAT(t)) return { bloquant: false, text: "volume 2 : matériel classe II, IPX4" };
  return null;
}
// contrôle d'un niveau : sanis + appareils + contours des pièces → [{id, sani, v, bloquant, text}]
export function checkVolumes(apps, rooms) {
  const out = [], vols = apps.filter((a) => isSani(a.t)).map((s) => ({ s, V: volumesOf(s, roomFor(s, rooms)) }));
  if (!vols.length) return out;
  for (const a of apps) {
    if (isSani(a.t)) continue;
    let best = null;
    for (const { s, V } of vols) { const v = volumeAt(a.x, a.y, a.h, V); if (v != null && (best == null || v < best.v)) best = { s, v }; }
    const r = best && volumeRule(a.t, best.v);
    if (r) out.push({ id: a.id, sani: best.s.id, v: best.v, ...r });
  }
  return out;
}
export function roomFor(a, rooms) {
  const r = (rooms || []).find((p) => p && p.length >= 3 && pointIn(a.x, a.y, p));
  return r || null;
}
