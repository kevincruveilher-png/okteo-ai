// n° 14 (feuille de route du 04/11) : autocorrection des murs — module pur, en mètres.
// Un relevé (IA, automatique, collé ou dessiné à la main) a souvent des murs presque droits : 3°, 6°, un angle en L qui
// n'est pas tout à fait à 90°. On les remet d'équerre dans le SENS DE LA MAISON (trouvé d'après ses murs, pas d'après la
// page : un scan un peu tourné est corrigé dans son propre repère) :
//   - à moins de `tol` degrés (10 par défaut, réglage « angle léger ») d'un angle droit → exactement 0° ou 90° ;
//   - à moins de `tol45` degrés d'un 45° → exactement 45° ;
//   - au-delà : mur gardé tel quel, signalé « en biais à vérifier ».
// Les sommets sont recalculés à partir des murs qui s'y croisent (les angles restent joints) ; les murs dans le
// prolongement l'un de l'autre (écart ≤ 5 cm, bout à bout) sont remis sur la même ligne. Garde-fous : un sommet déplacé de
// plus de `maxMove` (15 cm) est corrigé mais SIGNALÉ (« à vérifier ») ; au-delà de `hardMove` (50 cm), ce n'est plus un mur
// légèrement de travers mais une erreur de relevé : la correction de ses murs est abandonnée et ils sont signalés.

const DEG = Math.PI / 180;
const norm180 = (a) => ((a % 180) + 180) % 180;

// sens de la maison : moyenne circulaire des angles ramenés modulo 90°, pondérée par la longueur, en deux passes (la 2e
// ne garde que les murs à moins de `tol` d'un angle droit : les murs à 45° ou en biais ne faussent pas le sens) ; un plan
// presque aligné sur la page (≤ `pageSnap` degrés) est considéré comme aligné : les plans de pavillonneurs le sont presque tous
export function houseAngle(nodes, walls, { tol = 10, pageSnap = 2 } = {}) {
  const mean = (keep) => {
    let sx = 0, sy = 0;
    for (const w of walls) {
      const A = nodes[w.a], B = nodes[w.b]; if (!A || !B || w.virt) continue;
      const L = Math.hypot(B.x - A.x, B.y - A.y); if (L < 0.2) continue;
      const deg = Math.atan2(B.y - A.y, B.x - A.x) / DEG; if (keep && !keep(deg)) continue;
      const t = deg * 4 * DEG;   // période 90° → 360°
      sx += L * Math.cos(t); sy += L * Math.sin(t);
    }
    if (!sx && !sy) return null;
    const a = (((Math.atan2(sy, sx) / 4 / DEG) % 90) + 90) % 90;
    return a > 45 ? a - 90 : a;   // dans (-45, 45] : le plus petit tour à faire
  };
  const t1 = mean(null); if (t1 == null) return 0;
  const dev = (deg) => { const r = (((deg - t1) % 90) + 90) % 90; return Math.min(r, 90 - r); };
  const t2 = mean((deg) => dev(deg) <= tol); const th = t2 == null ? t1 : t2;
  return Math.abs(th) <= pageSnap ? 0 : th;
}

// classe d'un mur dans le repère de la maison : "h" | "v" | "d1" (45°) | "d2" (135°) | null (biais gardé)
function kindOf(A, B, th, tol, tol45) {
  const rel = norm180(Math.atan2(B.y - A.y, B.x - A.x) / DEG - th);
  const near = (t) => Math.min(Math.abs(rel - t), 180 - Math.abs(rel - t));
  if (near(0) <= tol) return { k: "h", off: near(0) };
  if (near(90) <= tol) return { k: "v", off: near(90) };
  if (near(45) <= tol45) return { k: "d1", off: near(45) };
  if (near(135) <= tol45) return { k: "d2", off: near(135) };
  return { k: null, off: Math.min(near(0), near(90), near(45), near(135)) };
}

// union-find
function uf(n) {
  const p = [...Array(n).keys()];
  const f = (i) => (p[i] === i ? i : (p[i] = f(p[i])));
  return { f, u: (a, b) => { a = f(a); b = f(b); if (a !== b) p[b] = a; } };
}

/**
 * plan : { nodes: [{x, y}], walls: [{a, b, virt?}] } (indices) ; renvoie une COPIE des nœuds corrigés et le compte rendu :
 * { nodes, angle, equerre, a45, biais: [indices de murs], refus: [indices], moved: max déplacement (m) }
 */
export function squarePlan(plan, { tol = 10, tol45 = 10, maxMove = 0.15, hardMove = 0.5, collinear = 0.05, pageSnap = 2 } = {}) {
  const N0 = plan.nodes, W = plan.walls || plan.segs || [];
  const th = houseAngle(N0, W, { tol, pageSnap }), c = Math.cos(th * DEG), s = Math.sin(th * DEG);
  // repère de la maison : u le long des murs « horizontaux », v le long des « verticaux »
  const toL = (p) => ({ u: p.x * c + p.y * s, v: -p.x * s + p.y * c });
  const toW = (q) => ({ x: q.u * c - q.v * s, y: q.u * s + q.v * c });
  const L0 = N0.map(toL);
  const kinds = W.map((w) => (w.virt || !N0[w.a] || !N0[w.b] ? { k: null, off: 0, skip: true } : kindOf(N0[w.a], N0[w.b], th, tol, tol45)));
  const refus = new Set();
  let out = L0;
  for (let pass = 0; pass < 4; pass++) {
    // 1. groupes de sommets qui doivent partager v (murs h) ou u (murs v)
    const gu = uf(N0.length), gv = uf(N0.length);
    W.forEach((w, i) => { if (refus.has(i)) return; if (kinds[i].k === "h") gv.u(w.a, w.b); else if (kinds[i].k === "v") gu.u(w.a, w.b); });
    // 2. murs dans le prolongement : deux murs h (ou v) bout à bout, à ≤ `collinear` l'un de l'autre → même ligne
    const lines = (k) => W.map((w, i) => ({ w, i })).filter(({ i }) => kinds[i].k === k && !refus.has(i)).map(({ w, i }) => {
      const A = L0[w.a], B = L0[w.b];
      return k === "h" ? { i, c: (A.v + B.v) / 2, s0: Math.min(A.u, B.u), s1: Math.max(A.u, B.u), a: w.a } : { i, c: (A.u + B.u) / 2, s0: Math.min(A.v, B.v), s1: Math.max(A.v, B.v), a: w.a };
    });
    for (const [k, g] of [["h", gv], ["v", gu]]) {
      const Ls = lines(k);
      for (let i = 0; i < Ls.length; i++) for (let j = i + 1; j < Ls.length; j++) {
        const p = Ls[i], q = Ls[j];
        if (Math.abs(p.c - q.c) > collinear) continue;
        const gap = Math.max(p.s0, q.s0) - Math.min(p.s1, q.s1);   // < 0 : ils se recouvrent
        if (gap <= 0.6) g.u(p.a, q.a);
      }
    }
    // 3. valeur commune de chaque groupe = moyenne pondérée par la longueur des murs qui le forment
    const acc = (g, key, k) => {
      const m = new Map();
      W.forEach((w, i) => {
        if (kinds[i].k !== k || refus.has(i)) return;
        const A = L0[w.a], B = L0[w.b], L = Math.hypot(B.u - A.u, B.v - A.v);
        for (const n of [w.a, w.b]) { const r = g.f(n), e = m.get(r) || { s: 0, w: 0 }; e.s += L0[n][key] * L; e.w += L; m.set(r, e); }
      });
      return m;
    };
    const mv = acc(gv, "v", "h"), mu = acc(gu, "u", "v");
    out = L0.map((q, n) => {
      const ev = mv.get(gv.f(n)), eu = mu.get(gu.f(n));
      return { u: eu && eu.w ? eu.s / eu.w : q.u, v: ev && ev.w ? ev.s / ev.w : q.v };
    });
    // 4. murs à 45° : le bout libre (sans autre contrainte sur l'axe à corriger) est remis sur la diagonale exacte
    W.forEach((w, i) => {
      const k = kinds[i].k; if ((k !== "d1" && k !== "d2") || refus.has(i)) return;
      const A = out[w.a], B = out[w.b], sg = k === "d1" ? 1 : -1;
      const du = B.u - A.u, dv = B.v - A.v, d = (Math.abs(du) + Math.abs(dv)) / 2;
      const bFreeV = !mv.get(gv.f(w.b)), aFreeV = !mv.get(gv.f(w.a));
      if (bFreeV) out[w.b] = { u: B.u, v: A.v + sg * Math.sign(du || 1) * Math.abs(du) };
      else if (aFreeV) out[w.a] = { u: A.u, v: B.v - sg * Math.sign(du || 1) * Math.abs(du) };
      else if (Math.abs(Math.abs(du) - Math.abs(dv)) > 0.01 && d) refus.add(i);   // les deux bouts sont tenus : on n'y touche pas
    });
    // 5. garde-fou : un sommet déplacé de plus de hardMove → les murs qui le tiennent ne sont pas corrigés (signalés)
    let bad = false;
    out.forEach((q, n) => {
      if (Math.hypot(q.u - L0[n].u, q.v - L0[n].v) <= hardMove + 1e-9) return;
      W.forEach((w, i) => { if ((w.a === n || w.b === n) && kinds[i].k && !refus.has(i)) { refus.add(i); bad = true; } });
    });
    if (!bad) break;
  }
  const nodes = out.map((q, n) => (Math.hypot(q.u - L0[n].u, q.v - L0[n].v) < 1e-6 ? { ...N0[n] } : { ...N0[n], ...toW(q) }));
  let moved = 0; const far = [];
  nodes.forEach((p, n) => { const d = Math.hypot(p.x - N0[n].x, p.y - N0[n].y); moved = Math.max(moved, d); if (d > maxMove + 1e-9) far.push(n); });
  // murs dont un bout a bougé de plus de maxMove : corrigés, mais à vérifier
  const verifier = W.map((w, i) => i).filter((i) => far.includes(W[i].a) || far.includes(W[i].b));
  const equerre = W.filter((w, i) => (kinds[i].k === "h" || kinds[i].k === "v") && !refus.has(i) && kinds[i].off > 0.05).length;
  const a45 = W.filter((w, i) => (kinds[i].k === "d1" || kinds[i].k === "d2") && !refus.has(i) && kinds[i].off > 0.05).length;
  const biais = W.map((w, i) => i).filter((i) => !kinds[i].skip && kinds[i].k === null);
  return { nodes, angle: +th.toFixed(2), equerre, a45, biais, refus: [...refus], verifier, moved: +moved.toFixed(3), maxMove, hardMove };
}

// ouvertures : même position relative sur leur mur (sa longueur a pu changer), largeur bornée
export function keepOpenings(openings, wallsOld, nodesOld, nodesNew) {
  const len = (N, w) => Math.hypot(N[w.b].x - N[w.a].x, N[w.b].y - N[w.a].y);
  return (openings || []).map((o) => {
    const w = wallsOld[o.seg]; if (!w) return o;
    const L0 = len(nodesOld, w), L1 = len(nodesNew, w); if (!(L0 > 0) || !(L1 > 0)) return o;
    const ww = Math.min(o.w, Math.max(0.4, L1 - 0.1)), t = Math.min(L1 - ww / 2, Math.max(ww / 2, o.t * L1 / L0));
    return { ...o, t: +t.toFixed(3), w: +ww.toFixed(3) };
  });
}

// compte rendu en une phrase pour les cartes de relevé
export function squareText(R) {
  if (!R) return "";
  const parts = [];
  if (R.equerre) parts.push(`${R.equerre} mur${R.equerre > 1 ? "s" : ""} mis d'équerre`);
  if (R.a45) parts.push(`${R.a45} mur${R.a45 > 1 ? "s" : ""} remis à 45°`);
  if (R.biais.length) parts.push(`${R.biais.length} mur${R.biais.length > 1 ? "s" : ""} en biais à vérifier`);
  if (R.verifier && R.verifier.length) parts.push(`${R.verifier.length} déplacé${R.verifier.length > 1 ? "s" : ""} de plus de ${Math.round((R.maxMove || 0.15) * 100)} cm (à vérifier)`);
  if (R.refus.length) parts.push(`${R.refus.length} non corrigé${R.refus.length > 1 ? "s" : ""} (il aurait fallu le déplacer de plus de ${Math.round((R.hardMove || 0.5) * 100)} cm)`);
  return parts.length ? parts.join(", ") : "murs déjà d'équerre";
}

// réglages (préférences de Paramètres → Murs) → options de squarePlan
export function squareOptions(p = {}) {
  const n = (v, d, lo, hi) => { const x = +v; return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d; };
  return { tol: n(p.equerreTol, 10, 0, 20), tol45: n(p.equerre45, 10, 0, 20), maxMove: n(p.equerreMax, 15, 1, 100) / 100 };
}
// relevé {nodes, walls, openings, …} (IA, automatique, collé) → même relevé d'équerre + compte rendu
export function squareReleve(plan, opts = {}) {
  if (!plan || !Array.isArray(plan.nodes) || !(plan.walls || []).length || !(opts.tol > 0 || opts.tol45 > 0)) return { plan, R: null };
  const R = squarePlan(plan, opts);
  const nodes = R.nodes.map((n) => ({ ...n, x: +n.x.toFixed(3), y: +n.y.toFixed(3) }));
  const openings = keepOpenings(plan.openings, plan.walls, plan.nodes, nodes);
  return { plan: { ...plan, nodes, openings, stats: { ...(plan.stats || {}), equerre: { angle: R.angle, equerre: R.equerre, a45: R.a45, biais: R.biais.length, verifier: R.verifier.length, refus: R.refus.length } } }, R };
}
