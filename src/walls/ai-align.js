// v77 : recalage d'un relevé IA sur les murs tirés du PDF vectoriel (tout en mètres, module pur).
// L'IA estime ses positions à l'œil et donne parfois une taille d'image fausse (« ref ») : le relevé arrive décalé,
// étiré ou les deux. On cherche pour chaque axe u' = a·u + b qui pose les murs de l'IA sur ceux du PDF
// (murs verticaux → x, horizontaux → y), puis on colle chaque mur reconnu sur son mur du PDF. Appareils, pièces et
// ouvertures perdues suivent le recalage d'ensemble. Rien n'est inventé : un mur de l'IA sans correspondant reste
// où il est (recalé d'ensemble seulement).

const ANG = 0.1;          // tolérance d'orientation (pente) pour dire qu'un mur est horizontal / vertical
const SNAP = 0.3;         // un mur de l'IA est collé sur un mur du PDF à moins de 30 cm (après recalage d'ensemble)

// murs d'un plan {nodes, walls|segs} → lignes {o: "v"|"h", c (abscisse ou ordonnée), s0, s1, L, i}
export function axisLines(P) {
  const out = [], W = P.walls || P.segs || [];
  W.forEach((w, i) => {
    const A = P.nodes[w.a], B = P.nodes[w.b]; if (!A || !B) return;
    const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy); if (L < 0.3 || w.virt) return;
    if (Math.abs(dx) <= ANG * Math.abs(dy)) out.push({ o: "v", c: (A.x + B.x) / 2, s0: Math.min(A.y, B.y), s1: Math.max(A.y, B.y), L, i });
    else if (Math.abs(dy) <= ANG * Math.abs(dx)) out.push({ o: "h", c: (A.y + B.y) / 2, s0: Math.min(A.x, B.x), s1: Math.max(A.x, B.x), L, i });
  });
  return out;
}

const overlap = (p, q) => Math.max(0, Math.min(p.s1, q.s1) - Math.max(p.s0, q.s0));
// ligne de l'IA vue à travers la transformation T = {x: {a, b}, y: {a, b}}
function moved(l, T) {
  const C = l.o === "v" ? T.x : T.y, S = l.o === "v" ? T.y : T.x;
  const s0 = S.a * l.s0 + S.b, s1 = S.a * l.s1 + S.b;
  return { ...l, c: C.a * l.c + C.b, s0: Math.min(s0, s1), s1: Math.max(s0, s1) };
}
// meilleur mur du PDF pour une ligne de l'IA : même orientation, assez proche, qui se recouvrent sur ≥ 30 %
function match(l, refs, tol) {
  let best = null;
  for (const r of refs) {
    if (r.o !== l.o) continue;
    const d = Math.abs(r.c - l.c); if (d > tol) continue;
    if (overlap(l, r) < 0.3 * Math.min(l.L, r.L)) continue;
    if (!best || d < best.d) best = { r, d };
  }
  return best;
}
function pairsFor(lines, refs, T, tol, o) {
  const out = [];
  for (const l of lines) {
    if (l.o !== o) continue;
    const m = match(moved(l, T), refs, tol);
    if (m) out.push({ u: l.c, v: m.r.c, w: Math.min(l.L, m.r.L) });
  }
  return out;
}
// moindres carrés pondérés v ≈ a·u + b (2 murs écartés de 3 m au moins suffisent) ; échelle bornée (± 8 %),
// sinon simple décalage (médiane pondérée, moyenne sous 3 murs)
function fit(pairs, a0 = 1) {
  if (!pairs.length) return null;
  const W = pairs.reduce((s, p) => s + p.w, 0);
  const mu = pairs.reduce((s, p) => s + p.w * p.u, 0) / W, mv = pairs.reduce((s, p) => s + p.w * p.v, 0) / W;
  const su = pairs.reduce((s, p) => s + p.w * (p.u - mu) ** 2, 0) / W;
  if (pairs.length >= 2 && Math.sqrt(su) >= 1.5) {
    const a = pairs.reduce((s, p) => s + p.w * (p.u - mu) * (p.v - mv), 0) / W / su;
    if (a > 0.92 && a < 1.08) return { a, b: mv - a * mu };
  }
  const d = pairs.map((p) => ({ d: p.v - a0 * p.u, w: p.w })).sort((p, q) => p.d - q.d);
  if (d.length < 3) return { a: a0, b: d.reduce((s, p) => s + p.d * p.w, 0) / W };
  let acc = 0; for (const p of d) { acc += p.w; if (acc >= W / 2) return { a: a0, b: p.d }; }
  return { a: a0, b: d[d.length - 1].d };
}
// 1er décalage : le décalage qui pose le plus de longueur de murs à moins de 15 cm (essais = écarts entre murs)
function coarse(lines, refs, o) {
  const L = lines.filter((l) => l.o === o), R = refs.filter((r) => r.o === o);
  let best = { b: 0, score: -1 };
  const tried = new Set();
  for (const l of L) for (const r of R) {
    const b = r.c - l.c; if (Math.abs(b) > 3) continue;
    const k = Math.round(b * 50); if (tried.has(k)) continue; tried.add(k);
    let score = 0;
    for (const m of L) { const n = R.find((q) => Math.abs(q.c - (m.c + b)) <= 0.15); if (n) score += Math.min(m.L, n.L); }
    if (score > best.score) best = { b, score };
  }
  return best.score > 0 ? best.b : 0;
}

// recalage : {ok, T, n {x, y}, avant, apres (écart moyen en m des murs reconnus), colles, raison}
// Garde-fous : il faut au moins 6 murs droits côté IA (avec 2 murs par axe, n'importe quelle paire de murs du PDF
// « colle »), au moins 60 % de leur longueur reconnue à la fin, un décalage ≤ 1,5 m et une échelle à ± 5 %.
export function alignTransform(plan, ref, { minPairs = 2, minWalls = 6, cover = 0.6, maxShift = 1.5, maxScale = 0.05 } = {}) {
  const lines = axisLines(plan), refs = axisLines(ref);
  if (lines.length < minWalls) return { ok: false, raison: `trop peu de murs dans la réponse (${lines.length}) pour recaler sans risque` };
  const nV = lines.filter((l) => l.o === "v").length, nH = lines.length - nV;
  if (nV < 2 || nH < 2 || refs.filter((r) => r.o === "v").length < 2 || refs.filter((r) => r.o === "h").length < 2)
    return { ok: false, raison: "pas assez de murs droits pour recaler" };
  const ecart = (T, tol) => {
    let s = 0, w = 0, n = 0;
    for (const l of lines) { const m = match(moved(l, T), refs, tol); if (m) { s += m.d * l.L; w += l.L; n++; } }
    return { moy: w ? s / w : null, n };
  };
  const I = { x: { a: 1, b: 0 }, y: { a: 1, b: 0 } };
  const avant = ecart(I, 0.8);
  let T = { x: { a: 1, b: coarse(lines, refs, "v") }, y: { a: 1, b: coarse(lines, refs, "h") } };
  let px = [], py = [];
  for (const tol of [0.6, 0.4, 0.25, 0.15]) {
    px = pairsFor(lines, refs, T, tol, "v"); py = pairsFor(lines, refs, T, tol, "h");
    const fx = px.length >= minPairs ? fit(px) : null, fy = py.length >= minPairs ? fit(py) : null;
    T = { x: fx || T.x, y: fy || T.y };
  }
  if (px.length < minPairs || py.length < minPairs) return { ok: false, raison: "trop peu de murs reconnus sur le PDF", n: { x: px.length, y: py.length } };
  const apres = ecart(T, SNAP);
  const total = lines.reduce((s, l) => s + l.L, 0);
  const seen = lines.reduce((s, l) => s + (match(moved(l, T), refs, SNAP) ? l.L : 0), 0);
  // décalage mesuré au milieu du relevé (et non à l'origine du repère)
  const mid = (o) => { const L = lines.filter((l) => l.o === o); return L.reduce((s, l) => s + l.c, 0) / L.length; };
  const shift = Math.max(Math.abs((T.x.a - 1) * mid("v") + T.x.b), Math.abs((T.y.a - 1) * mid("h") + T.y.b));
  const scale = Math.max(Math.abs(T.x.a - 1), Math.abs(T.y.a - 1));
  const base = { T, n: { x: px.length, y: py.length }, avant: avant.moy, apres: apres.moy, part: seen / total };
  if (seen / total < cover) return { ok: false, ...base, raison: `seulement ${Math.round(100 * seen / total)} % des murs retrouvés sur le PDF` };
  if (shift > maxShift || scale > maxScale) return { ok: false, ...base, raison: "décalage trop grand pour être sûr du recalage" };
  return { ok: true, ...base };
}

// applique le recalage au plan (copie) : murs, ouvertures, pièces, appareils, ouvertures perdues
export function alignPlan(plan, ref, opts = {}) {
  const R = alignTransform(plan, ref, opts);
  if (!R.ok) return { plan, ...R };
  const { T } = R, tx = (x) => T.x.a * x + T.x.b, ty = (y) => T.y.a * y + T.y.b;
  const lenOf = (P, w) => { const A = P.nodes[w.a], B = P.nodes[w.b]; return Math.hypot(B.x - A.x, B.y - A.y); };
  const old = plan;
  const P = JSON.parse(JSON.stringify(plan));
  P.nodes = P.nodes.map((n) => ({ x: tx(n.x), y: ty(n.y) }));
  // chaque mur de l'IA reconnu est collé sur son mur du PDF (abscisse ou ordonnée du nœud)
  const refs = axisLines(ref), votes = new Map();
  let colles = 0;
  for (const l of axisLines(P)) {
    const m = match(l, refs, SNAP); if (!m) continue;
    colles++;
    const w = P.walls[l.i];
    for (const k of [w.a, w.b]) {
      const v = votes.get(k) || { x: [], y: [] };
      (l.o === "v" ? v.x : v.y).push({ c: m.r.c, w: l.L });
      votes.set(k, v);
    }
  }
  const avg = (list) => list.reduce((s, p) => s + p.c * p.w, 0) / list.reduce((s, p) => s + p.w, 0);
  for (const [k, v] of votes) { if (v.x.length) P.nodes[k].x = avg(v.x); if (v.y.length) P.nodes[k].y = avg(v.y); }
  // ouvertures : même position relative sur leur mur (sa longueur a pu changer)
  P.openings = (P.openings || []).map((o) => {
    const L0 = lenOf(old, old.walls[o.seg]), L1 = lenOf(P, P.walls[o.seg]);
    if (!(L0 > 0) || !(L1 > 0)) return o;
    const w = Math.min(o.w, L1 - 0.1), t = Math.min(L1 - w / 2, Math.max(w / 2, o.t * L1 / L0));
    return { ...o, t: +t.toFixed(3), w: +Math.max(0.4, w).toFixed(3) };
  });
  // appareils et pièces : recalage d'ensemble seulement. Un appareil n'est pas déplacé avec « son » mur : sur les essais,
  // l'IA place souvent mieux les symboles que les murs, et les appareils muraux sont de toute façon recollés à leur mur
  // à l'ajout (snapToWall).
  const follow = (p) => ({ x: tx(p.x), y: ty(p.y) });
  P.devices = (P.devices || []).map((d) => ({ ...d, ...follow(d) }));
  P.pieces = (P.pieces || []).map((r) => ({ ...r, x: tx(r.x), y: ty(r.y) }));
  P.lost = (P.lost || []).map((o) => ({ ...o, ...follow(o) }));
  P.nodes = P.nodes.map((n) => ({ x: +n.x.toFixed(3), y: +n.y.toFixed(3) }));
  P.stats = { ...(P.stats || {}), recalage: { x: T.x, y: T.y, colles, avant: R.avant, apres: R.apres } };
  return { plan: P, ...R, colles };
}
