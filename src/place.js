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
