// Portes posées EN TRAVERS d'un couloir, entre deux murs parallèles (ex. porte du WC qui donne sur le dégagement) :
// sur le PDF il n'y a pas de cloison à cet endroit, seulement l'arc de la porte. Sans elle, la pièce n'est pas fermée.
// On repère les arcs de porte (quart de cercle, rayon 0,5–1,2 m) ; la position « porte fermée » est le rayon de l'arc
// qui va de la charnière jusqu'à un autre mur. On y ajoute un mur (épaisseur de la plus fine des deux cloisons) portant
// une porte, et on coupe les deux murs touchés (jonctions en T) pour que la pièce se ferme.

const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

function circle3(a, b, c) {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
  if (Math.abs(d) < 1e-9) return null;
  const A = a[0] ** 2 + a[1] ** 2, B = b[0] ** 2 + b[1] ** 2, C = c[0] ** 2 + c[1] ** 2;
  return [(A * (b[1] - c[1]) + B * (c[1] - a[1]) + C * (a[1] - b[1])) / d, (A * (c[0] - b[0]) + B * (a[0] - c[0]) + C * (b[0] - a[0])) / d];
}

// arcs de porte en mètres : {c:{x,y}, r, ends:[{x,y},{x,y}]}
export function doorArcs(shapes, { k, ox = 0, oy = 0 }) {
  const out = [];
  for (const s of shapes || []) {
    if (!s.stroke || s.closed || s.pts.length < 5) continue;
    const P = s.pts.map(([x, y]) => [ox + x * k, oy + y * k]);
    const c = circle3(P[0], P[P.length >> 1], P[P.length - 1]); if (!c) continue;
    const r = dist(P[0][0], P[0][1], c[0], c[1]);
    if (r < 0.5 || r > 1.2 || !P.every((p) => Math.abs(dist(p[0], p[1], c[0], c[1]) - r) < r * 0.03)) continue;
    const a0 = Math.atan2(P[0][1] - c[1], P[0][0] - c[0]), a1 = Math.atan2(P[P.length - 1][1] - c[1], P[P.length - 1][0] - c[0]);
    let span = Math.abs(a1 - a0); if (span > Math.PI) span = 2 * Math.PI - span;
    if (span < 1.2 || span > 1.95) continue;                                          // ≈ 70° à 110°
    if (out.some((o) => dist(o.c.x, o.c.y, c[0], c[1]) < 0.03 && Math.abs(o.r - r) < 0.03)) continue;
    out.push({ c: { x: c[0], y: c[1] }, r, ends: [{ x: P[0][0], y: P[0][1] }, { x: P[P.length - 1][0], y: P[P.length - 1][1] }] });
  }
  return out;
}

// res = résultat de detectWalls ({nodes, walls, openings}) : modifié sur place ; renvoie le nombre de portes ajoutées
export function closeDoorways(res, arcs) {
  const N = res.nodes, W = res.walls;
  const axis = (w) => { const A = N[w.a], B = N[w.b], L = dist(A.x, A.y, B.x, B.y) || 1; return { A, B, L, ux: (B.x - A.x) / L, uy: (B.y - A.y) / L }; };
  // intersection de la droite (P, u) avec l'axe du mur w ; s = abscisse sur le mur, q = abscisse sur la droite
  const cross = (P, ux, uy, w) => {
    const g = axis(w), den = ux * g.uy - uy * g.ux; if (Math.abs(den) < 0.2) return null;   // il faut deux directions bien distinctes
    const dx = g.A.x - P.x, dy = g.A.y - P.y, q = (dx * g.uy - dy * g.ux) / den, s = (dx * uy - dy * ux) / den;
    return { q, s, x: P.x + ux * q, y: P.y + uy * q, g };
  };
  let added = 0;
  for (const arc of arcs) {
    for (const E of arc.ends) {
      const ux = (E.x - arc.c.x) / arc.r, uy = (E.y - arc.c.y) / arc.r;
      // murs traversés par la droite charnière → porte fermée, près de ses deux bouts
      const hits = [];
      W.forEach((w, i) => {
        const X = cross(arc.c, ux, uy, w); if (!X) return;
        const ep = w.ep || 0.1, m = ep / 2 + 0.06;
        if (X.s < -m || X.s > X.g.L + m) return;
        if (X.q > -(ep / 2 + 0.15) && X.q < 0.25) hits.push({ i, end: "c", ...X });
        else if (Math.abs(X.q - arc.r) < ep / 2 + 0.2) hits.push({ i, end: "e", ...X });
      });
      let hc = hits.filter((h) => h.end === "c").sort((a, b) => Math.abs(a.q) - Math.abs(b.q))[0];
      const he = hits.filter((h) => h.end === "e").sort((a, b) => Math.abs(a.q - arc.r) - Math.abs(b.q - arc.r))[0];
      if (!hc || !he || hc.i === he.i) continue;
      // porte presque perpendiculaire au mur de la charnière : on la redresse (le dessin du PDF est rarement parfait)
      { const g = hc.g, c = Math.abs(g.ux * ux + g.uy * uy);
        if (c < 0.12) { const sx = Math.sign(-g.uy * ux + g.ux * uy) || 1, vx = -g.uy * sx, vy = g.ux * sx;
          const P0 = { x: hc.x, y: hc.y }, X = cross(P0, vx, vy, W[he.i]); if (X) { he.x = X.x; he.y = X.y; } } }
      // déjà un mur le long de la porte fermée (porte classique, dans l'épaisseur d'un mur) : rien à faire
      const mid = { x: (hc.x + he.x) / 2, y: (hc.y + he.y) / 2 };
      const along = W.some((w) => {
        const g = axis(w), t = (mid.x - g.A.x) * g.ux + (mid.y - g.A.y) * g.uy;
        const d = Math.abs((mid.x - g.A.x) * -g.uy + (mid.y - g.A.y) * g.ux);
        return t > -0.05 && t < g.L + 0.05 && d < (w.ep || 0.1) / 2 + 0.08 && Math.abs(g.ux * ux + g.uy * uy) > 0.9;
      });
      if (along) continue;
      const L = dist(hc.x, hc.y, he.x, he.y);
      if (L < arc.r * 0.8 || L > arc.r + 0.6) continue;
      const ep = Math.min(W[hc.i].ep, W[he.i].ep);
      const na = splitAt(res, hc.i, hc), nb = splitAt(res, he.i, he);
      if (na === nb) continue;
      W.push({ a: na, b: nb, ep, auto: "porte" });
      res.openings.push({ seg: W.length - 1, t: +(L / 2).toFixed(3), w: +Math.min(arc.r, L - 0.02).toFixed(3), kind: "porte" });
      added++;
      break;
    }
  }
  return added;
}

// coupe le mur i au point p (déjà sur son axe) ; renvoie l'indice du sommet (réutilise un bout s'il est à moins de 3 cm)
function splitAt(res, i, p) {
  const N = res.nodes, w = res.walls[i], A = N[w.a], B = N[w.b];
  if (dist(A.x, A.y, p.x, p.y) < 0.03) return w.a;
  if (dist(B.x, B.y, p.x, p.y) < 0.03) return w.b;
  const L1 = dist(A.x, A.y, p.x, p.y);
  N.push({ x: +p.x.toFixed(3), y: +p.y.toFixed(3) });
  const n = N.length - 1, j = res.walls.length;
  res.walls.push({ a: n, b: w.b, ep: w.ep });
  w.b = n;
  for (const o of res.openings) if (o.seg === i && o.t > L1) { o.seg = j; o.t = +(o.t - L1).toFixed(3); }
  return n;
}
