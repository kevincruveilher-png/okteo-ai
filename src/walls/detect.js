import { doorArcs, closeDoorways } from "./doorways.js";
// Relevé automatique des murs à partir des tracés vectoriels d'un PDF — sans IA, purement géométrique.
//
// Principe (méthode « bandes ») :
//  1. Source : de préférence les polygones REMPLIS (grisés) du plan — la plupart des plans de pavillonneurs
//     dessinent les murs ainsi, interrompus aux portes et fenêtres. À défaut : les traits (méthode de secours).
//  2. Dans un même polygone, deux bords parallèles qui se font face, espacés d'une épaisseur de mur plausible,
//     forment une « bande » : son axe = l'axe du mur, son écart = l'épaisseur.
//  3. Les bandes alignées (même axe, même épaisseur) sont recollées ; un trou entre deux bandes alignées
//     devient une ouverture (porte ou fenêtre, à confirmer par l'utilisateur).
//  4. Les extrémités sont prolongées jusqu'à l'axe du mur qu'elles touchent (angles en L, jonctions en T),
//     puis les sommets proches sont fusionnés : le résultat est un réseau de murs relié, comme un dessin à la main.
// Toutes les distances sont en mètres (les coordonnées de page sont converties avec l'échelle du fond).

const DEF = {
  tMin: 0.04,        // épaisseur minimale d'un mur (m)
  tMax: 0.45,        // épaisseur maximale (m)
  minLen: 0.20,      // longueur minimale d'un mur gardé (m) ; il doit aussi faire au moins 1,5 × son épaisseur
  angTol: 1.5,       // tolérance de parallélisme (degrés)
  alignTol: 0.03,    // écart d'axe toléré pour recoller deux morceaux (m)
  thickTol: 0.035,   // écart d'épaisseur toléré pour recoller (m)
  joinGap: 0.03,     // trou recollé sans créer d'ouverture (m)
  openMin: 0.40,     // largeur minimale d'une ouverture (m)
  openMax: 3.20,     // largeur maximale d'une ouverture (m)
  interiorMax: 0.15, // en dessous : cloison intérieure (ouvertures = portes)
};

const lum = (hex) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return 0; const v = parseInt(m[1], 16); return (0.299 * (v >> 16) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255)) / 255; };

function edgeOf(x1, y1, x2, y2, extra) {
  let dx = x2 - x1, dy = y2 - y1; const L = Math.hypot(dx, dy); if (L < 1e-9) return null;
  let ux = dx / L, uy = dy / L;
  // direction canonique : angle dans [0°, 180°)
  if (uy < -1e-12 || (Math.abs(uy) <= 1e-12 && ux < 0)) { ux = -ux; uy = -uy; }
  const ang = Math.atan2(uy, ux) * 180 / Math.PI;
  const nx = -uy, ny = ux;
  const c = nx * x1 + ny * y1;                       // position de la droite (le long de la normale)
  const a = ux * x1 + uy * y1, b = ux * x2 + uy * y2; // intervalle le long de la direction
  return { x1, y1, x2, y2, L, ux, uy, nx, ny, ang, c, s0: Math.min(a, b), s1: Math.max(a, b), ...extra };
}
const angDiff = (a, b) => { const d = Math.abs(a - b) % 180; return Math.min(d, 180 - d); };

// ---------- 1-2 : bandes ----------
function bandsFrom(edges, o, sameGroup) {
  const bands = [];
  // rangement par tranche d'angle (1°) : on ne compare que les bords à peu près parallèles
  const bucket = new Map();
  edges.forEach((e, i) => { e.i = i; const k = Math.floor(e.ang) % 180; if (!bucket.has(k)) bucket.set(k, []); bucket.get(k).push(e); });
  const span = Math.ceil(o.angTol);
  const near = (e) => { const out = []; const k0 = Math.floor(e.ang); for (let d = -span; d <= span; d++) { const l = bucket.get(((k0 + d) % 180 + 180) % 180); if (l) out.push(...l); } return out; };
  for (const a of edges) {
    for (const b of near(a)) {
      if (b.i <= a.i) continue;
      if (angDiff(a.ang, b.ang) > o.angTol) continue;
      if (sameGroup && a.g !== b.g) continue;
      // b exprimé dans le repère de a
      const bc = a.nx * b.x1 + a.ny * b.y1;
      const t = Math.abs(bc - a.c); if (t < o.tMin || t > o.tMax) continue;
      const b0 = Math.min(a.ux * b.x1 + a.uy * b.y1, a.ux * b.x2 + a.uy * b.y2), b1 = Math.max(a.ux * b.x1 + a.uy * b.y1, a.ux * b.x2 + a.uy * b.y2);
      const s0 = Math.max(a.s0, b0), s1 = Math.min(a.s1, b1);
      if (s1 - s0 < 0.04) continue;
      bands.push({ ux: a.ux, uy: a.uy, nx: a.nx, ny: a.ny, ang: a.ang, c: (a.c + bc) / 2, t, s0, s1, ea: a, eb: b, cLo: Math.min(a.c, bc), cHi: Math.max(a.c, bc) });
    }
  }
  // un bord parallèle situé ENTRE les deux bords d'une bande (même zone) : la bande est fausse (on a sauté un mur)
  const keep = [];
  for (const B of bands) {
    let inside = false;
    for (const e of near(B.ea)) {
      if (e === B.ea || e === B.eb) continue;
      if (sameGroup && e.g !== B.ea.g) continue;
      if (angDiff(e.ang, B.ang) > o.angTol) continue;
      const ec = B.nx * e.x1 + B.ny * e.y1;
      if (ec <= B.cLo + 0.005 || ec >= B.cHi - 0.005) continue;
      const e0 = Math.min(B.ux * e.x1 + B.uy * e.y1, B.ux * e.x2 + B.uy * e.y2), e1 = Math.max(B.ux * e.x1 + B.uy * e.y1, B.ux * e.x2 + B.uy * e.y2);
      if (Math.min(e1, B.s1) - Math.max(e0, B.s0) > 0.02) { inside = true; break; }
    }
    if (!inside) keep.push(B);
  }
  return keep;
}

// ---------- 3 : recoller les bandes alignées, repérer les ouvertures ----------
function mergeBands(bands, o) {
  const groups = [];
  for (const B of bands.sort((p, q) => p.t - q.t)) {
    let g = groups.find((G) => angDiff(G.ang, B.ang) <= o.angTol && Math.abs(G.c - projC(G, B)) <= o.alignTol && Math.abs(G.t - B.t) <= o.thickTol);
    if (!g) { g = { ang: B.ang, ux: B.ux, uy: B.uy, nx: B.nx, ny: B.ny, c: B.c, t: B.t, parts: [] }; groups.push(g); }
    // l'intervalle de B exprimé le long de la direction du groupe
    const p = reproj(g, B);
    g.parts.push(p);
  }
  const walls = [];
  for (const g of groups) {
    const parts = g.parts.sort((p, q) => p.s0 - q.s0);
    let cur = null; const runs = [];
    for (const p of parts) {
      if (cur && p.s0 <= cur.s1 + o.joinGap) { cur.s1 = Math.max(cur.s1, p.s1); cur.tw += p.t * (p.s1 - p.s0); cur.w += p.s1 - p.s0; }
      else { cur = { s0: p.s0, s1: p.s1, tw: p.t * (p.s1 - p.s0), w: p.s1 - p.s0 }; runs.push(cur); }
    }
    // morceaux alignés séparés par un trou de largeur plausible = un mur percé d'ouvertures
    let wall = null;
    for (const r of runs) {
      const t = r.tw / r.w;
      if (wall && r.s0 - wall.s1 >= o.openMin && r.s0 - wall.s1 <= o.openMax) {
        wall.openings.push({ s0: wall.s1, s1: r.s0 });
        wall.s1 = r.s1; wall.tw += t * r.w; wall.w += r.w;
      } else {
        wall = { g, s0: r.s0, s1: r.s1, tw: t * r.w, w: r.w, openings: [] };
        walls.push(wall);
      }
    }
  }
  return walls.map((w) => {
    const t = w.tw / w.w, g = w.g;
    const P = (s) => ({ x: g.ux * s + g.nx * g.c, y: g.uy * s + g.ny * g.c });
    return { a: P(w.s0), b: P(w.s1), t, ux: g.ux, uy: g.uy, nx: g.nx, ny: g.ny, c: g.c, s0: w.s0, s1: w.s1, openings: w.openings.map((op) => ({ ...op, a: P(op.s0), b: P(op.s1) })) };
  });
}
function projC(G, B) { const px = B.nx * B.c, py = B.ny * B.c; return G.nx * px + G.ny * py; }
function reproj(G, B) {
  const ax = B.ux * B.s0 + B.nx * B.c, ay = B.uy * B.s0 + B.ny * B.c, bx = B.ux * B.s1 + B.nx * B.c, by = B.uy * B.s1 + B.ny * B.c;
  const a = G.ux * ax + G.uy * ay, b = G.ux * bx + G.uy * by;
  return { s0: Math.min(a, b), s1: Math.max(a, b), t: B.t };
}

// ---------- 4 : jonctions ----------
function lineInter(w1, w2) {
  // intersection des axes : P = a1 + u1*s, avec n2·P = c2
  const den = w2.nx * w1.ux + w2.ny * w1.uy; if (Math.abs(den) < 0.2) return null; // presque parallèles
  const s = (w2.c - (w2.nx * w1.a.x + w2.ny * w1.a.y)) / den;
  return { x: w1.a.x + w1.ux * s, y: w1.a.y + w1.uy * s };
}
function sAlong(w, p) { return w.ux * p.x + w.uy * p.y; }

const longEnough = (w, o) => (w.s1 - w.s0) >= Math.max(o.minLen, 1.5 * w.t);

function connect(all, o) {
  // les morceaux trop courts (petits symboles, côtés d'un poteau) sont écartés AVANT de relier :
  // sinon ils créeraient des jonctions parasites sur les vrais murs
  const walls = all.filter((w) => longEnough(w, o));
  // prolonger / raccourcir chaque extrémité jusqu'à l'axe du mur qu'elle touche
  for (const w of walls) {
    for (const end of ["a", "b"]) {
      const P = w[end]; let best = null;
      for (const v of walls) {
        if (v === w) continue;
        const I = lineInter(w, v); if (!I) continue;
        const reach = v.t / 2 + Math.max(w.t / 2 + 0.06, 0.20);   // une cloison peut s’arrêter un peu avant le mur sur le plan
        if (Math.hypot(I.x - P.x, I.y - P.y) > reach) continue;          // trop loin de l'extrémité
        const sv = sAlong(v, I);
        if (sv < v.s0 - (w.t / 2 + 0.06) || sv > v.s1 + (w.t / 2 + 0.06)) continue; // hors du mur v
        const d = Math.hypot(I.x - P.x, I.y - P.y);
        if (!best || d < best.d) best = { d, I, v };
      }
      if (best) { w[end] = { x: best.I.x, y: best.I.y }; (w.links ||= []).push({ end, v: best.v, I: best.I }); }
    }
    w.s0 = Math.min(sAlong(w, w.a), sAlong(w, w.b)); w.s1 = Math.max(sAlong(w, w.a), sAlong(w, w.b));
  }
  // un mur v touché en son milieu (jonction en T) est coupé en deux au point de jonction
  const cuts = new Map();
  for (const w of walls) for (const L of w.links || []) {
    const v = L.v, s = sAlong(v, L.I);
    if (s > v.s0 + 0.05 && s < v.s1 - 0.05) { if (!cuts.has(v)) cuts.set(v, []); cuts.get(v).push(s); }
  }
  const out = [];
  for (const w of walls) {
    if (!longEnough(w, o)) continue;
    const P = (s) => ({ x: w.ux * s + w.nx * w.c, y: w.uy * s + w.ny * w.c });
    const pts = [w.s0, ...(cuts.get(w) || []).sort((p, q) => p - q), w.s1].filter((s, i, arr) => i === 0 || s - arr[i - 1] > 0.02);
    for (let i = 0; i + 1 < pts.length; i++) {
      const s0 = pts[i], s1 = pts[i + 1];
      // les ouvertures qui tombent dans ce morceau
      const ops = w.openings.filter((op) => (op.s0 + op.s1) / 2 > s0 && (op.s0 + op.s1) / 2 < s1)
        .map((op) => ({ t: (op.s0 + op.s1) / 2 - s0, w: op.s1 - op.s0 }));
      out.push({ a: P(s0), b: P(s1), t: w.t, openings: ops });
    }
  }
  // fusionner les sommets proches (≤ 2 cm) pour obtenir un réseau relié
  const nodes = [];
  const nodeAt = (p) => { let n = nodes.find((q) => Math.hypot(q.x - p.x, q.y - p.y) <= 0.02); if (!n) { n = { x: p.x, y: p.y, k: nodes.length }; nodes.push(n); } return n.k; };
  const segs = out.map((w) => ({ a: nodeAt(w.a), b: nodeAt(w.b), t: w.t, openings: w.openings })).filter((s) => s.a !== s.b);
  return { nodes, segs };
}

// ---------- point d'entrée ----------
// segsPage : sortie de extractSegments (coordonnées de page) ; map : {k (m par unité de page), ox, oy}
export function detectWalls(segsPage, map, opts = {}) {
  const o = { ...DEF, ...opts };
  const k = map.k, ox = map.ox || 0, oy = map.oy || 0;
  const W = (s) => ({ x1: ox + s.x1 * k, y1: oy + s.y1 * k, x2: ox + s.x2 * k, y2: oy + s.y2 * k });

  // source 1 : polygones remplis non blancs
  const filled = segsPage.filter((s) => s.fill && s.closed && lum(s.fill) < 0.9);
  const pids = new Set(filled.map((s) => s.pid));
  let mode = "aplats", edges;
  if (pids.size >= 4) {
    edges = filled.map((s) => { const w = W(s); return edgeOf(w.x1, w.y1, w.x2, w.y2, { g: s.pid }); }).filter((e) => e && e.L >= 0.03);
  } else {
    // source 2 (secours) : les traits, en ignorant les tout petits (texte, symboles)
    mode = "traits";
    edges = segsPage.filter((s) => s.stroke).map((s) => { const w = W(s); return edgeOf(w.x1, w.y1, w.x2, w.y2, { g: 0 }); }).filter((e) => e && e.L >= 0.15);
  }
  const bands = bandsFrom(edges, o, mode === "aplats");
  const merged = mergeBands(bands, { ...o, minLen: mode === "traits" ? Math.max(o.minLen, 0.5) : o.minLen });
  const net = connect(merged, { ...o, minLen: mode === "traits" ? Math.max(o.minLen, 0.5) : o.minLen });
  const openings = [];
  net.segs.forEach((s, i) => s.openings.forEach((op) => {
    if (op.w < o.openMin || op.w > o.openMax) return;
    openings.push({ seg: i, t: op.t, w: op.w, kind: s.t < o.interiorMax ? "porte" : "fenetre" });
  }));
  const res = {
    mode,
    nodes: net.nodes.map((n) => ({ x: +n.x.toFixed(3), y: +n.y.toFixed(3) })),
    walls: net.segs.map((s) => ({ a: s.a, b: s.b, ep: +s.t.toFixed(3) })),
    openings: openings.map((op) => ({ ...op, t: +op.t.toFixed(3), w: +op.w.toFixed(3) })),
    stats: { sources: edges.length, bandes: bands.length, portesEnTravers: 0 },
  };
  // portes posées en travers d'un couloir, sans cloison dessinée (ex. WC sur dégagement) : on ferme la pièce
  if (opts.shapes) res.stats.portesEnTravers = closeDoorways(res, doorArcs(opts.shapes, map));
  return res;
}
