// Tracé des gaines sans croisement (v59). Pur (sans DOM) : utilisé par le plan (render.js), l'impression (print.js),
// le placement des points d'accroche (boites.js portLayout) et les tests.
// - Une gaine est dessinée en arc (comme sur les plans KiTéOHM) : point de contrôle décalé de k × longueur sur le côté.
// - chooseBows : pour chaque gaine, la courbure (k) parmi BOWS qui croise le moins les autres gaines du niveau
//   (arcs déjà choisis + tracés faits à la main), sinon l'arc habituel (k = 0,15).
export const BOW0 = 0.15;
export const BOWS = [0.15, -0.15, 0.07, -0.07, 0, 0.25, -0.25, 0.35, -0.35];

export function ctrl(P, T, k = BOW0) {
  return { x: (P.x + T.x) / 2 - (T.y - P.y) * k, y: (P.y + T.y) / 2 + (T.x - P.x) * k };
}
// points de l'arc (n + 1 points, du départ à l'arrivée)
export function curve(P, T, k = BOW0, n = 16) {
  if (!k) return [P, T];
  const q = ctrl(P, T, k), out = [];
  for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; out.push({ x: u * u * P.x + 2 * u * t * q.x + t * t * T.x, y: u * u * P.y + 2 * u * t * q.y + t * t * T.y }); }
  return out;
}
const near = (a, b, e) => Math.abs(a.x - b.x) < e && Math.abs(a.y - b.y) < e;
// intersection propre de [a,b] et [c,d] (point d'intersection) ou null
export function segX(a, b, c, d) {
  const r = { x: b.x - a.x, y: b.y - a.y }, s = { x: d.x - c.x, y: d.y - c.y }, den = r.x * s.y - r.y * s.x;
  if (Math.abs(den) < 1e-12) return null;
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / den, u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den;
  if (t <= 1e-9 || t >= 1 - 1e-9 || u <= 1e-9 || u >= 1 - 1e-9) return null;
  return { x: a.x + t * r.x, y: a.y + t * r.y };
}
const bbox = (L) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const p of L) { if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y; } return { x0, y0, x1, y1 }; };
// nombre de croisements entre deux lignes brisées ; les croisements tout près d'un bout commun (même point d'accroche,
// même appareil) ne comptent pas
export function polyCross(A, B, eps = 0.02) {
  const ba = A.bb || bbox(A), bb = B.bb || bbox(B);
  if (ba.x1 < bb.x0 || bb.x1 < ba.x0 || ba.y1 < bb.y0 || bb.y1 < ba.y0) return 0;
  const ends = [A[0], A[A.length - 1]].filter((p) => near(p, B[0], eps) || near(p, B[B.length - 1], eps));
  let n = 0;
  for (let i = 1; i < A.length; i++) for (let j = 1; j < B.length; j++) {
    const X = segX(A[i - 1], A[i], B[j - 1], B[j]);
    if (X && !ends.some((e) => Math.hypot(X.x - e.x, X.y - e.y) < 0.25)) n++;
  }
  return n;
}
const withBB = (L) => { L.bb = bbox(L); return L; };

// list = [{key, P, T}] (gaines en arc) ; fixed = [[{x,y}…]] (tracés à la main, alimentation…) ; renvoie Map key → k
export function chooseBows(list, fixed = []) {
  const F = fixed.filter((L) => L && L.length > 1).map(withBB);
  const C = new Map(list.map((g) => [g.key, BOWS.map((k) => withBB(curve(g.P, g.T, k)))]));
  const pick = new Map(list.map((g) => [g.key, 0]));
  const grp = (g) => String(g.key).split("|")[0], alim = (g) => /\|tab$/.test(g.key);   // l'alimentation (pointillés) croise forcément : elle compte peu
  const cost = (g, i) => {
    const L = C.get(g.key)[i];
    let n = 0;
    for (const f of F) n += polyCross(L, f);
    // un croisement entre deux gaines de la même boîte (clé « boîte|appareil ») compte triple : c'est le plus gênant
    for (const o of list) if (o !== g) n += polyCross(L, C.get(o.key)[pick.get(o.key)]) * (alim(o) || alim(g) ? 0.3 : grp(o) === grp(g) ? 3 : 1);
    return n * 10 + i * 0.01;   // à croisements égaux, l'arc habituel
  };
  // les plus longues d'abord (ce sont elles qui croisent), puis une 2e passe en connaissant toutes les autres
  const order = list.slice().sort((a, b) => Math.hypot(b.T.x - b.P.x, b.T.y - b.P.y) - Math.hypot(a.T.x - a.P.x, a.T.y - a.P.y));
  for (let pass = 0; pass < 2; pass++) for (const g of order) {
    let best = pick.get(g.key), bc = cost(g, best);
    for (let i = 0; i < BOWS.length; i++) { if (i === best) continue; const c = cost(g, i); if (c < bc - 1e-9) { bc = c; best = i; } }
    pick.set(g.key, best);
  }
  // 3e passe : deux gaines qui se croisent encore changent de courbure ensemble (une seule ne suffit pas toujours)
  const curOf = (g) => C.get(g.key)[pick.get(g.key)];
  for (let it = 0; it < 3; it++) {
    let changed = false;
    for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) {
      const g = list[a], h = list[b];
      if (!polyCross(curOf(g), curOf(h))) continue;
      const base = cost(g, pick.get(g.key)) + cost(h, pick.get(h.key));
      let best = null;
      const pg = pick.get(g.key), ph = pick.get(h.key);
      for (let i = 0; i < BOWS.length; i++) for (let j = 0; j < BOWS.length; j++) {
        pick.set(g.key, i); pick.set(h.key, j);
        const c = cost(g, i) + cost(h, j);
        if (c < base - 0.5 && (!best || c < best.c)) best = { i, j, c };
      }
      pick.set(g.key, best ? best.i : pg); pick.set(h.key, best ? best.j : ph);
      if (best) changed = true;
    }
    if (!changed) break;
  }
  return new Map([...pick].map(([k, i]) => [k, BOWS[i]]));
}
// croisements qui restent (tests, compte rendu) : list avec k choisi + fixed
export function crossings(list, bows, fixed = []) {
  const L = list.map((g) => ({ key: g.key, c: withBB(curve(g.P, g.T, bows ? bows.get(g.key) ?? BOW0 : BOW0)) }));
  const F = fixed.filter((x) => x && x.length > 1).map(withBB);
  let n = 0;
  for (let i = 0; i < L.length; i++) { for (let j = i + 1; j < L.length; j++) n += polyCross(L[i].c, L[j].c); for (const f of F) n += polyCross(L[i].c, f); }
  return n;
}
