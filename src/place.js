// Placement des étiquettes sans chevauchement (écran et impression).
// Toutes les boîtes sont dans la même unité (mètres du plan, ou mm du papier) : {x0, y0, x1, y1}.
// On place par ordre d'importance ; une étiquette qui ne trouve aucune place libre est masquée (ou forcée si elle est
// indispensable, comme le nom d'une pièce).

export class Placer {
  constructor(cell = 1) { this.cell = cell; this.grid = new Map(); this.n = 0; this.big = []; }
  // lot 1 (05/11/2026) : une boîte qui couvre plus de BIG cases (mur très épais, échelle fausse) n'est pas découpée en
  // cases (des centaines de milliers de clés figeaient le plan) : elle est rangée à part et testée directement
  _span(b) { const c = this.cell; return (Math.floor(b.x1 / c) - Math.floor(b.x0 / c) + 1) * (Math.floor(b.y1 / c) - Math.floor(b.y0 / c) + 1); }
  _keys(b) {
    const c = this.cell, out = [];
    for (let X = Math.floor(b.x0 / c); X <= Math.floor(b.x1 / c); X++) for (let Y = Math.floor(b.y0 / c); Y <= Math.floor(b.y1 / c); Y++) out.push(X + "," + Y);
    return out;
  }
  free(b) {
    const hit = (o) => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0;
    for (const o of this.big) if (hit(o)) return false;
    if (!(this._span(b) <= Placer.BIG)) { for (const L of this.grid.values()) for (const o of L) if (hit(o)) return false; return true; }
    for (const k of this._keys(b)) for (const o of this.grid.get(k) || []) if (hit(o)) return false;
    return true;
  }
  add(b) {
    this.n++;
    if (!(this._span(b) <= Placer.BIG)) { this.big.push(b); return b; }
    for (const k of this._keys(b)) { if (!this.grid.has(k)) this.grid.set(k, []); this.grid.get(k).push(b); }
    return b;
  }
  // essaie les positions dans l'ordre ; renvoie la première libre (et la réserve), sinon null
  first(cands) { for (const b of cands) if (this.free(b)) return this.add(b); return null; }
}
Placer.BIG = 1024;

// boîte d'un texte (approximative) : largeur ≈ nb de caractères × chasse × taille
export function textBox(x, y, str, size, { anchor = "middle", base = "middle", wide = 0.6, pad = 0.12 } = {}) {
  // v72.1 : hauteur réelle d'une ligne de texte ≈ 1,4 × la taille de police (ascendantes + descendantes) ; avec « size »
  // seul, deux étiquettes voisines se chevauchaient de 1 à 3 px (défaut connu depuis v66)
  const w = String(str).length * size * wide, h = size * 1.4;
  const x0 = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x;
  const y0 = base === "middle" ? y - h / 2 : base === "bottom" ? y - h : y;
  const p = size * pad;
  return { x0: x0 - p, y0: y0 - p, x1: x0 + w + p, y1: y0 + h + p };
}

// points candidats pour le nom d'une pièce : le point d'étiquette, puis une grille de points intérieurs, du plus proche
// au plus lointain ; inside(x, y) dit si un point est dans la pièce
export function roomCandidates(lp, bbox, inside, step) {
  const out = [lp];
  for (let x = bbox.x0 + step / 2; x < bbox.x1; x += step) for (let y = bbox.y0 + step / 2; y < bbox.y1; y += step) if (inside(x, y)) out.push({ x, y });
  return out.sort((a, b) => Math.hypot(a.x - lp.x, a.y - lp.y) - Math.hypot(b.x - lp.x, b.y - lp.y));
}

// v58 : symboles sans chevauchement. Chaque appareil garde sa position réelle ; seul son AFFICHAGE est décalé, juste
// assez pour que les symboles ne se touchent plus (D = distance mini entre centres). Un appareil posé contre un mur
// (ux, uy = direction du mur) n'est décalé que le long de son mur. Renvoie Map id → {x, y} des seuls appareils décalés.
export function spreadSymbols(items, D, { iter = 40, maxShift = 6 } = {}) {
  if (!(D > 0) || items.length < 2) return new Map();
  const P = items.map((a, i) => ({ id: a.id, x0: a.x, y0: a.y, x: a.x, y: a.y, ux: a.ux, uy: a.uy, i }));
  const cell = D;
  for (let it = 0; it < iter; it++) {
    const grid = new Map(), key = (X, Y) => X + "," + Y;
    P.forEach((p) => { const k = key(Math.floor(p.x / cell), Math.floor(p.y / cell)); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(p); });
    let worst = 0;
    for (const p of P) {
      const X = Math.floor(p.x / cell), Y = Math.floor(p.y / cell);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const q of grid.get(key(X + i, Y + j)) || []) {
        if (q.i <= p.i) continue;
        let dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy);
        if (d >= D - 1e-9) continue;
        worst = Math.max(worst, D - d);
        if (d < 1e-6) {   // au même point : on les écarte dans l'ordre (le long du mur s'il y en a un)
          const u = p.ux != null ? [p.ux, p.uy] : q.ux != null ? [q.ux, q.uy] : [1, 0];
          dx = u[0]; dy = u[1]; d = 1;
        }
        const nx = dx / d, ny = dy / d, push = (D - d) / 2 + 1e-4;
        const mv = (o, s) => {
          if (o.ux != null) {   // le long du mur seulement
            let t = (nx * o.ux + ny * o.uy) * s;
            if (Math.abs(nx * o.ux + ny * o.uy) < 0.3) t = (o === p ? -1 : 1) * Math.abs(s);   // poussé de travers : on glisse quand même le long du mur
            o.x += o.ux * t * push; o.y += o.uy * t * push;
          } else { o.x += nx * s * push; o.y += ny * s * push; }
        };
        mv(p, -1); mv(q, 1);
      }
    }
    if (worst < D * 0.01) break;
  }
  const out = new Map();
  for (const p of P) {
    let dx = p.x - p.x0, dy = p.y - p.y0;
    const L = Math.hypot(dx, dy), lim = maxShift * D;
    if (L > lim) { dx *= lim / L; dy *= lim / L; }
    if (L > 1e-4) out.set(p.id, { x: p.x0 + dx, y: p.y0 + dy });
  }
  return out;
}

// n° 13 (lot A) : symbole d'un appareil mural poussé hors du mur. w = { ax, ay, ux, uy, nx, ny, ep } (axe du mur, normale
// côté appareil, épaisseur) ; p = point du symbole ; R = rayon du symbole affiché. Le bord du symbole touche la face du mur
// sans jamais la chevaucher, quel que soit le zoom ; la position réelle de l'appareil (câblage, longueurs) ne change pas.
export function pushOff(p, w, R) {
  if (!w || w.nx == null) return p;
  const d = (p.x - w.ax) * w.nx + (p.y - w.ay) * w.ny, need = (w.ep || 0) / 2 + R * 1.05;
  return d >= need ? p : { x: p.x + w.nx * (need - d), y: p.y + w.ny * (need - d) };
}

// 05/11/2026 (Kévin) : interrupteur et va-et-vient collés au mur : le rond touche la face du mur côté pièce, le trait part
// perpendiculairement au mur vers la pièce, avec un petit crochet au bout (va-et-vient : deux traits en V). Forme commune
// à l'écran et au papier, en unités de symbole, axe +x = vers la pièce ; le rond est centré en (0, 0).
export const WALL_SWITCH = new Set(["INT", "VV"]);
export const SWITCH_R = 0.55;
export function switchParts(t) {
  const r = SWITCH_R, L = 1.75, hook = 0.42, arm = (deg, side) => {
    const a = deg * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a);
    const x0 = r * c, y0 = r * sn, x1 = L * c, y1 = L * sn;
    // crochet perpendiculaire au trait, du côté `side`
    return [[x0, y0, x1, y1], [x1, y1, x1 - side * sn * hook, y1 + side * c * hook]];
  };
  const lines = t === "VV" ? [...arm(-22, -1), ...arm(22, 1)] : arm(0, -1);
  return { r, lines };
}
// centre du rond posé contre la face du mur (côté pièce), à la même place le long du mur
export function glueToWall(p, w, R) {
  if (!w || w.nx == null) return p;
  const d = (p.x - w.ax) * w.nx + (p.y - w.ay) * w.ny, need = (w.ep || 0) / 2 + R;
  return { x: p.x + w.nx * (need - d), y: p.y + w.ny * (need - d) };
}

// n° 8 (lot A) : boîtes d'obstacle le long d'un mur (pour que les repères ne tombent pas dedans) : un rectangle de mur
// (4 sommets dans l'ordre) découpé en carrés de la taille de son épaisseur, le long de son grand côté
// Lot 1 (05/11/2026) : segment [a, b] rogné à la boîte clip {x0, y0, x1, y1} (Liang-Barsky) ; null s'il est dehors
export function clipSeg(a, b, clip) {
  if (!clip) return [a, b];
  let t0 = 0, t1 = 1;
  const dx = b.x - a.x, dy = b.y - a.y;
  const edges = [[-dx, a.x - clip.x0], [dx, clip.x1 - a.x], [-dy, a.y - clip.y0], [dy, clip.y1 - a.y]];
  for (const [p, q] of edges) {
    if (p === 0) { if (q < 0) return null; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; }
    else { if (r < t0) return null; if (r < t1) t1 = r; }
  }
  return [{ x: a.x + dx * t0, y: a.y + dy * t0 }, { x: a.x + dx * t1, y: a.y + dy * t1 }];
}
// Lot 1 : nombre de boîtes borné par trait (max) et limité à la zone visible (clip) : une échelle fausse (murs ou liaisons
// de centaines de mètres) ne doit jamais figer le placement des étiquettes au zoom
export const MAX_BOXES = 600;

export function wallBoxes(P, pad = 0, clip = null, max = MAX_BOXES) {
  if (!P || P.length < 4) return [];
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }), len = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const l01 = len(P[0], P[1]), l12 = len(P[1], P[2]);
  const [A0, B0, ep] = l01 >= l12 ? [mid(P[0], P[3]), mid(P[1], P[2]), l12] : [mid(P[0], P[1]), mid(P[3], P[2]), l01];
  const h = ep / 2 + pad;
  const cs = clipSeg(A0, B0, clip && { x0: clip.x0 - h, y0: clip.y0 - h, x1: clip.x1 + h, y1: clip.y1 + h });
  if (!cs) return [];
  const [A, B] = cs, L = len(A, B), step = Math.max(ep, 1e-6), n = Math.min(max, Math.max(1, Math.ceil(L / step))), out = [];
  for (let i = 0; i <= n; i++) {
    const t = Math.min(1, i / n), x = A.x + (B.x - A.x) * t, y = A.y + (B.y - A.y) * t;
    out.push({ x0: x - h, y0: y - h, x1: x + h, y1: y + h });
  }
  return out;
}

// boîtes d'obstacle le long d'un trait (liaison, gaine) : petits carrés tous les `step`
export function lineBoxes(pts, step, half, clip = null, max = MAX_BOXES) {
  const out = [];
  const C = clip && { x0: clip.x0 - half, y0: clip.y0 - half, x1: clip.x1 + half, y1: clip.y1 + half };
  for (let k = 1; k < pts.length; k++) {
    const cs = clipSeg(pts[k - 1], pts[k], C);
    if (!cs) continue;
    const [a, b] = cs, L = Math.hypot(b.x - a.x, b.y - a.y), n = Math.min(max, Math.max(1, Math.ceil(L / step)));
    for (let i = 0; i <= n; i++) { const x = a.x + (b.x - a.x) * i / n, y = a.y + (b.y - a.y) * i / n; out.push({ x0: x - half, y0: y - half, x1: x + half, y1: y + half }); }
  }
  return out;
}

// positions candidates d'un repère autour de son symbole (centre p, rayon R, gap entre symbole et texte) : 3 couronnes
// de 12 positions, du plus près au plus loin ; dans chaque couronne, le côté `side` (normale du mur, côté pièce) d'abord.
// Chaque candidat = {x, y, an ("start" | "end" | "middle"), ring}
export function repCandidates(p, R, gap, h, side = null) {
  const out = [];
  [1, 1.9, 2.9].forEach((k, ring) => {
    const r = R + gap * k + h * (k - 1);
    const C = [];
    for (let i = 0; i < 12; i++) {
      const t = (i * 30 * Math.PI) / 180, cx = Math.cos(t), cy = Math.sin(t);
      const an = cx > 0.3 ? "start" : cx < -0.3 ? "end" : "middle";
      const x = p.x + cx * r, y = p.y + cy * (r + (an === "middle" ? h * 0.5 : 0));
      const pref = side ? -(cx * side.x + cy * side.y) : 0;   // plus petit = plus côté pièce
      C.push({ x, y, an, ring, pref, i });
    }
    C.sort((a, b) => a.pref - b.pref || a.i - b.i);
    out.push(...C);
  });
  return out;
}
