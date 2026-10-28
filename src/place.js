// Placement des étiquettes sans chevauchement (écran et impression).
// Toutes les boîtes sont dans la même unité (mètres du plan, ou mm du papier) : {x0, y0, x1, y1}.
// On place par ordre d'importance ; une étiquette qui ne trouve aucune place libre est masquée (ou forcée si elle est
// indispensable, comme le nom d'une pièce).

export class Placer {
  constructor(cell = 1) { this.cell = cell; this.grid = new Map(); this.n = 0; }
  _keys(b) {
    const c = this.cell, out = [];
    for (let X = Math.floor(b.x0 / c); X <= Math.floor(b.x1 / c); X++) for (let Y = Math.floor(b.y0 / c); Y <= Math.floor(b.y1 / c); Y++) out.push(X + "," + Y);
    return out;
  }
  free(b) {
    for (const k of this._keys(b)) for (const o of this.grid.get(k) || []) if (b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0) return false;
    return true;
  }
  add(b) { this.n++; for (const k of this._keys(b)) { if (!this.grid.has(k)) this.grid.set(k, []); this.grid.get(k).push(b); } return b; }
  // essaie les positions dans l'ordre ; renvoie la première libre (et la réserve), sinon null
  first(cands) { for (const b of cands) if (this.free(b)) return this.add(b); return null; }
}

// boîte d'un texte (approximative) : largeur ≈ nb de caractères × chasse × taille
export function textBox(x, y, str, size, { anchor = "middle", base = "middle", wide = 0.6, pad = 0.12 } = {}) {
  const w = String(str).length * size * wide, h = size;
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
