// v74 MAJ 3 : volumes de la salle de bain (NF C 15-100, partie 7-701), méthode validée avec Kévin le 02/11/2026,
// à confirmer avec le référentiel du BE. Pur (sans DOM) : partagé par le cœur (dessin, contrôle) et l'impression.
//
// Appareils sanitaires (posés comme des appareils, sans circuit ni repère) :
//   BAIG baignoire, RECV receveur de douche : rectangle w × d (m), tourné de rot degrés autour de son centre ;
//   DITAL douche à l'italienne (sans receveur) : le point posé est la pomme de douche fixe.
// Volume 0 = l'intérieur de la baignoire / du receveur. Volume 1 = la même emprise jusqu'à 2,25 m de haut ; douche sans
// receveur : 1,20 m autour de la pomme fixe. Volume 2 = 0,60 m autour du volume 1, jusqu'à 3 m. Les volumes
// s'arrêtent aux murs : chacun est découpé par le contour intérieur de la pièce.
// n° 9 (lot A, 04/11/2026) : WC, lavabo, meuble vasque et évier en plus (dessin inspiré des symboles des plans de
// pavillonneurs), sans volume de salle de bain. Tous les sanitaires sont dessinés en trait gris fin pointillé (saniShape,
// écran et impression) et en volume dans la vue 3D (sani3d). Le dos (côté mur) est le grand côté du haut (v = -d/2).
export const SANI = {
  BAIG: { n: "Baignoire", w: 1.7, d: 0.75, vol: true },
  RECV: { n: "Receveur de douche", w: 0.9, d: 0.9, vol: true },
  DITAL: { n: "Douche à l'italienne (pomme fixe)", w: 1.2, d: 1.2, vol: true },
  WC: { n: "WC", w: 0.38, d: 0.68 },
  LAVABO: { n: "Lavabo", w: 0.6, d: 0.45 },
  VASQUE: { n: "Meuble vasque", w: 0.8, d: 0.5 },
  EVIER: { n: "Évier", w: 1.2, d: 0.6 },
};
export const isSani = (t) => !!SANI[t];
export const hasVolumes = (t) => !!(SANI[t] && SANI[t].vol);
export const V1_H = 2.25, V2_H = 3, V2_W = 0.6, ITAL_R = 1.2;

const dims = (a) => ({ w: a.sw > 0 ? a.sw : SANI[a.t].w, d: a.sd > 0 ? a.sd : SANI[a.t].d });
// contour d'un sanitaire (rectangle tourné), en mètres
export function saniRect(a) {
  const { w, d } = dims(a), t = ((a.srot || 0) * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
  return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([x, y]) => ({ x: a.x + x * c - y * s, y: a.y + x * s + y * c }));
}
// repère local du sanitaire (u le long de la largeur, v vers l'avant) → plan
function frame(a) {
  const t = ((a.srot || 0) * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
  return (u, v) => ({ x: a.x + u * c - v * s, y: a.y + u * s + v * c });
}
const ell = (F, cu, cv, ru, rv, n = 28) => Array.from({ length: n }, (_, i) => F(cu + ru * Math.cos((2 * Math.PI * i) / n), cv + rv * Math.sin((2 * Math.PI * i) / n)));
const rrect = (F, u0, v0, u1, v1, r = 0, n = 5) => {
  r = Math.max(0, Math.min(r, (u1 - u0) / 2, (v1 - v0) / 2));
  if (!r) return [F(u0, v0), F(u1, v0), F(u1, v1), F(u0, v1)];
  const out = [], C = [[u1 - r, v0 + r, -90], [u1 - r, v1 - r, 0], [u0 + r, v1 - r, 90], [u0 + r, v0 + r, 180]];
  for (const [cu, cv, a0] of C) for (let k = 0; k <= n; k++) { const t = ((a0 + (90 * k) / n) * Math.PI) / 180; out.push(F(cu + r * Math.cos(t), cv + r * Math.sin(t))); }
  return out;
};
// dessin d'un sanitaire, en mètres : [{k: "out" (contour, rempli de blanc) | "in" (trait) | "line" (trait ouvert), pts}]
export function saniShape(a) {
  if (!isSani(a.t)) return [];
  const F = frame(a), { w, d } = dims(a), u0 = -w / 2, u1 = w / 2, v0 = -d / 2, v1 = d / 2, P = (k, pts) => ({ k, pts });
  switch (a.t) {
    case "DITAL": return [P("out", ell(F, 0, 0, 0.09, 0.09, 24)), P("in", ell(F, 0, 0, 0.03, 0.03, 12))];
    case "BAIG": return [P("out", rrect(F, u0, v0, u1, v1)), P("in", rrect(F, u0 + 0.07, v0 + 0.07, u1 - 0.07, v1 - 0.07, Math.min(0.2, d / 3))), P("in", ell(F, u0 + 0.2, 0, 0.025, 0.025, 10))];
    case "RECV": return [P("out", rrect(F, u0, v0, u1, v1)), P("line", [F(u0, v0), F(u1, v1)]), P("line", [F(u1, v0), F(u0, v1)]), P("in", ell(F, 0, 0, 0.035, 0.035, 12))];
    case "WC": {
      const tk = Math.min(0.18, d * 0.3), cv = (v0 + tk + v1) / 2, rv = (v1 - v0 - tk) / 2;
      return [P("out", rrect(F, u0, v0, u1, v0 + tk, 0.03)), P("out", ell(F, 0, cv, w / 2 * 0.92, rv)), P("in", ell(F, 0, cv + rv * 0.08, w / 2 * 0.6, rv * 0.68))];
    }
    case "LAVABO": return [P("out", rrect(F, u0, v0, u1, v1, Math.min(0.12, d / 3))), P("in", ell(F, 0, 0.03, w * 0.34, d * 0.3)), P("in", ell(F, 0, v0 + 0.06, 0.02, 0.02, 10))];
    case "VASQUE": {
      const two = w >= 1.2, cs = two ? [-w / 4, w / 4] : [0], ru = Math.min(two ? w * 0.17 : w * 0.3, 0.22), out = [P("out", rrect(F, u0, v0, u1, v1))];
      for (const c of cs) out.push(P("in", ell(F, c, 0.03, ru, d * 0.28)), P("in", ell(F, c, v0 + 0.06, 0.02, 0.02, 10)));
      return out;
    }
    case "EVIER": {
      const b1 = Math.min(u0 + 0.08 + 0.45, u1 - 0.2), out = [P("out", rrect(F, u0, v0, u1, v1)), P("in", rrect(F, u0 + 0.08, v0 + 0.1, b1, v1 - 0.08, 0.04)), P("in", ell(F, (u0 + 0.08 + b1) / 2, v0 + 0.05, 0.02, 0.02, 10))];
      const e0 = b1 + 0.06, e1 = u1 - 0.06, n = Math.max(2, Math.round((e1 - e0) / 0.07));
      for (let i = 0; i <= n && e1 > e0; i++) { const u = e0 + ((e1 - e0) * i) / n; out.push(P("line", [F(u, v0 + 0.12), F(u, v1 - 0.1)])); }
      return out;
    }
  }
  return [P("out", saniRect(a))];
}
// volumes 3D d'un sanitaire (vue 3D) : [{pts (contour au sol), z0, z1}] en mètres
export function sani3d(a) {
  if (!isSani(a.t)) return [];
  const F = frame(a), { w, d } = dims(a), R = (u0, v0, u1, v1, z0, z1, r = 0) => ({ pts: rrect(F, u0, v0, u1, v1, r), z0, z1 });
  switch (a.t) {
    case "DITAL": return [{ pts: ell(F, 0, 0, 0.09, 0.09, 20), z0: 1.95, z1: 2 }, { pts: ell(F, 0, -0.0, 0.015, 0.015, 8), z0: 0, z1: 1.95 }];
    case "BAIG": return [R(-w / 2, -d / 2, w / 2, d / 2, 0, 0.55)];
    case "RECV": return [R(-w / 2, -d / 2, w / 2, d / 2, 0, 0.06)];
    case "WC": { const tk = Math.min(0.18, d * 0.3), cv = (-d / 2 + tk + d / 2) / 2; return [R(-w / 2, -d / 2, w / 2, -d / 2 + tk, 0, 0.8, 0.03), { pts: ell(F, 0, cv, w / 2 * 0.92, (d - tk) / 2, 20), z0: 0, z1: 0.4 }]; }
    case "LAVABO": return [R(-w / 2, -d / 2, w / 2, d / 2, 0.7, 0.85, Math.min(0.12, d / 3)), R(-0.08, -d / 2, 0.08, -d / 2 + 0.16, 0, 0.7)];
    case "VASQUE": return [R(-w / 2, -d / 2, w / 2, d / 2, 0.15, 0.85)];
    case "EVIER": return [R(-w / 2, -d / 2, w / 2, d / 2, 0, 0.9)];
  }
  return [];
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
  if (!hasVolumes(a.t)) return null;
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
  const out = [], vols = apps.filter((a) => hasVolumes(a.t)).map((s) => ({ s, V: volumesOf(s, roomFor(s, rooms)) }));
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
