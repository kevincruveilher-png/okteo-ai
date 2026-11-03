// 3D-1 / 3D-2 : géométrie de la vue 3D, calculée depuis le dessin du chantier (module pur : ni DOM, ni three.js,
// testé par scripts/v3d.test.mjs). Unités : mètres ; x, y = coordonnées du plan (y vers le bas du plan), h = hauteur.
// Rien n'est inventé : les hauteurs absentes du dessin prennent les valeurs de départ H3D (réglables en 3D-3) et sont
// signalées comme telles. Le nettoyage (cleanPlan) ne modifie jamais le dessin : il ne sert qu'au rendu 3D et liste
// les défauts trouvés, pour que le BE les corrige en 2D.

// valeurs de départ (décision du 03/11/2026, réglables ensuite dans Paramètres, section 3D)
export const H3D = { plafond: 2.5, allege: 0.9, linteau: 2.15, porte: 2.04, baie: 2.15, garage: 2.2, combles: 2.85 };
// 3D-3 : hauteurs de départ réglées dans Paramètres → Vue 3D (préférences en cm) → mètres ; les boîtes restent 35 cm
// au-dessus du plafond
export function heightsFrom(p = {}) {
  const m = (k, d) => (Number.isFinite(+p[k]) && +p[k] > 0 ? +p[k] / 100 : d);
  const H = { plafond: m("h3dPlafond", H3D.plafond), allege: m("h3dAllege", H3D.allege), linteau: m("h3dLinteau", H3D.linteau), porte: m("h3dPorte", H3D.porte), baie: m("h3dBaie", H3D.baie), garage: m("h3dGarage", H3D.garage) };
  H.combles = H.plafond + 0.35;
  return H;
}
// tolérances du nettoyage (mètres)
export const TOL = { merge: 0.02, gap: 0.08, near: 0.3, angle: 1 };
// appareils posés au plafond quand le dessin ne donne pas de hauteur
export const PLAFOND_TYPES = new Set(["LUM", "SPOT", "DCL", "VMC", "BOUCHE", "DET", "DETECT", "PLAF", "HP"]);

const hyp = Math.hypot;
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

// ---------- nettoyage du plan (3D-2) ----------
// data = { nodes [{id,x,y}], segs [{id,a,b,ep,mat?,virt?}], openings [{id,seg,t,w,kind,hinge,swing}] }
// → { nodes Map id→{id,x,y}, walls [{id (mur d'origine), key, A, B, ep, mat, s0, L, ux, uy}], openings par clé de
//    morceau, defects [{kind, level: "info"|"warn", text, x, y, ids}], stats }
export function cleanPlan(data, tol = TOL, H = H3D) {
  const defects = [], stats = { merged: 0, nuls: 0, doubles: 0, recolles: 0, croisements: 0, chevauchements: 0 };
  const raw = new Map((data.nodes || []).filter((n) => n && isNum(n.x) && isNum(n.y)).map((n) => [n.id, { id: n.id, x: n.x, y: n.y }]));
  // 1. sommets confondus (moins de 2 cm) fusionnés
  const parent = new Map([...raw.keys()].map((k) => [k, k]));
  const find = (k) => { while (parent.get(k) !== k) { parent.set(k, parent.get(parent.get(k))); k = parent.get(k); } return k; };
  const list = [...raw.values()].sort((p, q) => p.x - q.x);
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length && list[j].x - list[i].x <= tol.merge; j++) {
    if (hyp(list[j].x - list[i].x, list[j].y - list[i].y) <= tol.merge) { const a = find(list[i].id), b = find(list[j].id); if (a !== b) { parent.set(b, a); stats.merged++; } }
  }
  const nodes = new Map();
  for (const n of raw.values()) { const r = find(n.id); if (!nodes.has(r)) nodes.set(r, { ...raw.get(r) }); }
  let nid = 0; const newNode = (x, y) => { const id = `3d:n${++nid}`; nodes.set(id, { id, x, y }); return id; };

  // 2. murs : sommets fusionnés, murs nuls retirés, murs en double (même paire de sommets) : le plus épais est gardé
  const segs = [], byPair = new Map();
  for (const s of data.segs || []) {
    if (!s || s.virt) continue;
    const a = raw.has(s.a) ? find(s.a) : null, b = raw.has(s.b) ? find(s.b) : null;
    if (!a || !b) continue;
    const A = nodes.get(a), B = nodes.get(b), L = hyp(B.x - A.x, B.y - A.y);
    if (a === b || L < tol.merge) { stats.nuls++; continue; }
    const ep = s.ep > 0 ? s.ep : 0.2, key = a < b ? a + "|" + b : b + "|" + a;
    const w = { id: s.id, a, b, ep, mat: s.mat || null, s0: 0, sDir: 1, top: s.top > 0 ? s.top : null };
    if (byPair.has(key)) {
      const o = byPair.get(key); stats.doubles++;
      defects.push({ kind: "double", level: "warn", text: "Deux murs l'un sur l'autre : un seul est gardé pour la 3D", x: (A.x + B.x) / 2, y: (A.y + B.y) / 2, ids: [o.id, s.id] });
      if (ep > o.ep) Object.assign(o, { id: s.id, ep, mat: w.mat });
      if (w.top > (o.top || 0)) o.top = w.top;
      continue;
    }
    byPair.set(key, w); segs.push(w);
  }
  const geom = (w) => { const A = nodes.get(w.a), B = nodes.get(w.b), L = hyp(B.x - A.x, B.y - A.y) || 1e-9; return { A, B, L, ux: (B.x - A.x) / L, uy: (B.y - A.y) / L }; };
  const degree = () => { const d = new Map(); for (const w of segs) { d.set(w.a, (d.get(w.a) || 0) + 1); d.set(w.b, (d.get(w.b) || 0) + 1); } return d; };
  // coupe le mur w au point (s le long du mur) : deux morceaux, le 2e garde le reste de la longueur d'origine
  const split = (w, s, nodeId) => {
    const g = geom(w);
    const w2 = { ...w, a: nodeId, s0: w.s0 + s * w.sDir };
    w.b = nodeId;
    segs.push(w2);
    return [w, w2, g];
  };

  // 3. bout libre arrêté près d'un autre mur (moins de 8 cm de sa face) ou qui le traverse un peu : recollé en T ;
  //    bout libre près du bout d'un autre mur : recollé en angle
  for (let pass = 0; pass < 2; pass++) {
    const deg = degree();
    for (const n of [...nodes.values()]) {
      if (deg.get(n.id) !== 1) continue;
      const own = segs.find((w) => w.a === n.id || w.b === n.id);
      if (!own) continue;
      const og = geom(own), out = own.a === n.id ? { x: -og.ux, y: -og.uy } : { x: og.ux, y: og.uy };
      let best = null;
      for (const w of segs) {
        if (w === own || w.a === n.id || w.b === n.id) continue;
        const g = geom(w), s = (n.x - g.A.x) * g.ux + (n.y - g.A.y) * g.uy;
        const px = g.A.x + g.ux * s, py = g.A.y + g.uy * s, d = hyp(n.x - px, n.y - py);
        const reach = w.ep / 2 + tol.gap;
        if (d > reach) continue;
        // le point de contact doit être devant le bout (ou dans le mur), pas derrière
        const ahead = (px - n.x) * out.x + (py - n.y) * out.y;
        if (ahead < -(w.ep / 2 + own.ep / 2 + 0.02)) continue;
        if (s > 0.03 && s < g.L - 0.03) { if (!best || d < best.d) best = { kind: "T", w, s, px, py, d }; }
        else {
          const end = s <= 0.03 ? w.a : w.b, E = nodes.get(end), de = hyp(E.x - n.x, E.y - n.y);
          if (de <= Math.max(w.ep, own.ep) + tol.gap && (!best || de < best.d)) best = { kind: "L", end, d: de };
        }
      }
      if (!best || best.d < 1e-4) continue;
      if (best.kind === "T") {
        const mid = newNode(best.px, best.py);
        split(best.w, best.s, mid);
        if (own.a === n.id) own.a = mid; else own.b = mid;
        nodes.delete(n.id);
      } else {
        if (own.a === n.id) own.a = best.end; else own.b = best.end;
        nodes.delete(n.id);
      }
      stats.recolles++;
      defects.push({ kind: "recolle", level: "info", text: best.kind === "T" ? `Mur arrêté à ${Math.round(best.d * 100)} cm d'un autre mur : recollé pour la 3D` : `Angle ouvert de ${Math.round(best.d * 100)} cm : recollé pour la 3D`, x: n.x, y: n.y, ids: [own.id] });
      deg.set(n.id, 0);
    }
  }

  // 4. murs qui se croisent sans sommet commun : coupés au croisement (pour des jonctions propres)
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const p = segs[i], q = segs[j];
    if (p.a === q.a || p.a === q.b || p.b === q.a || p.b === q.b) continue;
    const G = geom(p), Hq = geom(q), den = G.ux * Hq.uy - G.uy * Hq.ux;
    if (Math.abs(den) < Math.sin((tol.angle * Math.PI) / 180)) {
      // parallèles : chevauchement le long du même axe ?
      const dl = Math.abs((Hq.A.x - G.A.x) * -G.uy + (Hq.A.y - G.A.y) * G.ux);
      if (dl > Math.max(0.01, Math.min(p.ep, q.ep) / 2)) continue;
      const s1 = (Hq.A.x - G.A.x) * G.ux + (Hq.A.y - G.A.y) * G.uy, s2 = (Hq.B.x - G.A.x) * G.ux + (Hq.B.y - G.A.y) * G.uy;
      const lo = Math.max(0, Math.min(s1, s2)), hi = Math.min(G.L, Math.max(s1, s2));
      if (hi - lo > 0.05) { stats.chevauchements++; defects.push({ kind: "chevauchement", level: "warn", text: `Deux murs se recouvrent sur ${Math.round((hi - lo) * 100)} cm`, x: G.A.x + G.ux * (lo + hi) / 2, y: G.A.y + G.uy * (lo + hi) / 2, ids: [p.id, q.id] }); }
      continue;
    }
    const t = ((Hq.A.x - G.A.x) * Hq.uy - (Hq.A.y - G.A.y) * Hq.ux) / den, u = ((Hq.A.x - G.A.x) * G.uy - (Hq.A.y - G.A.y) * G.ux) / den;
    if (t <= 0.03 || t >= G.L - 0.03 || u <= 0.03 || u >= Hq.L - 0.03) continue;
    const X = G.A.x + G.ux * t, Y = G.A.y + G.uy * t, mid = newNode(X, Y);
    split(p, t, mid); split(q, u, mid);
    stats.croisements++;
    defects.push({ kind: "croisement", level: "info", text: "Deux murs se croisent sans jonction dessinée : coupés pour la 3D", x: X, y: Y, ids: [p.id, q.id] });
  }

  // 5. bouts libres restés près d'un mur (moins de 30 cm) : signalés (peut-être un oubli de jonction)
  const deg = degree();
  for (const n of nodes.values()) {
    if (deg.get(n.id) !== 1) continue;
    const own = segs.find((w) => w.a === n.id || w.b === n.id);
    let dmin = Infinity;
    for (const w of segs) {
      if (w === own) continue;
      const g = geom(w), s = Math.max(0, Math.min(g.L, (n.x - g.A.x) * g.ux + (n.y - g.A.y) * g.uy));
      dmin = Math.min(dmin, hyp(n.x - g.A.x - g.ux * s, n.y - g.A.y - g.uy * s) - w.ep / 2);
    }
    if (dmin > 0.005 && dmin < tol.near) defects.push({ kind: "libre", level: "warn", text: `Mur arrêté à ${Math.round(dmin * 100)} cm d'un autre : jonction oubliée ?`, x: n.x, y: n.y, ids: own ? [own.id] : [] });
  }

  // morceaux de murs, avec leur position le long du mur d'origine (pour y placer les ouvertures)
  const walls = segs.map((w, i) => {
    const g = geom(w);
    return { id: w.id, key: `${w.id}#${i}`, a: w.a, b: w.b, A: g.A, B: g.B, L: g.L, ux: g.ux, uy: g.uy, ep: w.ep, mat: w.mat, s0: w.s0, sDir: w.sDir, top: w.top };
  });
  // ouvertures : sur le morceau qui contient leur centre (position comptée depuis le début du mur d'origine)
  const origin = new Map((data.segs || []).map((s) => [s.id, s]));
  const opens = new Map();
  for (const o of data.openings || []) {
    const s = origin.get(o.seg);
    if (!s || !isNum(o.t) || !(o.w > 0)) continue;
    const A0 = raw.get(s.a);
    // position du centre en coordonnées du plan, puis le morceau le plus proche
    const B0 = raw.get(s.b);
    if (!A0 || !B0) continue;
    const L0 = hyp(B0.x - A0.x, B0.y - A0.y) || 1, cx = A0.x + (B0.x - A0.x) / L0 * o.t, cy = A0.y + (B0.y - A0.y) / L0 * o.t;
    let best = null;
    for (const w of walls) {
      if (w.id !== o.seg) continue;
      const s1 = (cx - w.A.x) * w.ux + (cy - w.A.y) * w.uy, d = hyp(cx - w.A.x - w.ux * s1, cy - w.A.y - w.uy * s1);
      const out = s1 < 0 ? -s1 : s1 > w.L ? s1 - w.L : 0;
      if (!best || out + d < best.e) best = { w, s1, e: out + d };
    }
    if (!best) continue;
    const half = o.w / 2, c = Math.max(half, Math.min(best.w.L - half, best.s1));
    if (best.w.L < o.w - 0.01) { defects.push({ kind: "ouverture", level: "warn", text: `Ouverture de ${Math.round(o.w * 100)} cm plus large que son mur (${Math.round(best.w.L * 100)} cm)`, x: cx, y: cy, ids: [o.id, o.seg] }); continue; }
    if (!opens.has(best.w.key)) opens.set(best.w.key, []);
    opens.get(best.w.key).push({ id: o.id, c, w: o.w, kind: o.kind, hinge: o.hinge, swing: o.swing, ...openingHeights(o, H) });
  }
  // ouvertures qui se chevauchent sur un même mur : signalées, la 2e est réduite
  const byKey = new Map(walls.map((w) => [w.key, w]));
  for (const [k, L] of opens) {
    L.sort((p, q) => p.c - q.c);
    const w = byKey.get(k);
    for (let i = 1; i < L.length; i++) {
      const p = L[i - 1], q = L[i], over = p.c + p.w / 2 - (q.c - q.w / 2);
      if (over > 0.01) {
        const s = (p.c + q.c) / 2;
        defects.push({ kind: "ouverture", level: "warn", text: `Deux ouvertures se chevauchent de ${Math.round(over * 100)} cm`, x: w.A.x + w.ux * s, y: w.A.y + w.uy * s, ids: [p.id, q.id] });
        q.w = Math.max(0.1, q.w - over); q.c += over / 2;
      }
    }
  }
  return { nodes, walls, openings: opens, defects, stats };
}

// hauteurs d'une ouverture (allège y0, dessous du linteau y1)
export function openingHeights(o, H = H3D) {
  if (o.kind === "fenetre") return { y0: isNum(o.allege) ? o.allege : H.allege, y1: isNum(o.linteau) ? o.linteau : H.linteau, defH: !isNum(o.allege) };
  if (o.kind === "garage") return { y0: 0, y1: isNum(o.linteau) ? o.linteau : H.garage, defH: !isNum(o.linteau) };
  return { y0: 0, y1: isNum(o.linteau) ? o.linteau : o.w > 1.2 ? H.baie : H.porte, defH: !isNum(o.linteau) };
}

// ---------- jonctions : coins de chaque bout de mur (onglets aux angles, coupes en T) ----------
// renvoie Map clé du morceau → { a: [gauche, droite], b: [droite, gauche] } (points [x, y] des faces au bout)
export function wallEnds(plan) {
  const inc = new Map();
  for (const w of plan.walls) {
    const h = w.ep / 2;
    if (!inc.has(w.a)) inc.set(w.a, []);
    if (!inc.has(w.b)) inc.set(w.b, []);
    inc.get(w.a).push({ w, d: [w.ux, w.uy], end: "a", h });
    inc.get(w.b).push({ w, d: [-w.ux, -w.uy], end: "b", h });
  }
  const Lp = (d) => [-d[1], d[0]];
  const inter = (p, d, q, e, n, lim) => {
    const den = d[0] * e[1] - d[1] * e[0];
    if (Math.abs(den) < 1e-6) return p;
    const t = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / den, r = [p[0] + t * d[0], p[1] + t * d[1]];
    return hyp(r[0] - n.x, r[1] - n.y) > lim ? p : r;
  };
  const out = new Map(plan.walls.map((w) => [w.key, {}]));
  for (const [nodeId, list] of inc) {
    const n = plan.nodes.get(nodeId);
    list.sort((a, b) => Math.atan2(a.d[1], a.d[0]) - Math.atan2(b.d[1], b.d[0]));
    const k = list.length;
    list.forEach((a, i) => {
      const l = Lp(a.d), pl = [n.x + l[0] * a.h, n.y + l[1] * a.h], pr = [n.x - l[0] * a.h, n.y - l[1] * a.h];
      let cL = pl, cR = pr;
      if (k > 1) {
        const nx = list[(i + 1) % k], pv = list[(i - 1 + k) % k], lim = 4 * Math.max(a.h, nx.h, pv.h, 0.05);
        const ln = Lp(nx.d), lp = Lp(pv.d);
        cL = inter(pl, a.d, [n.x - ln[0] * nx.h, n.y - ln[1] * nx.h], nx.d, n, lim);
        cR = inter(pr, a.d, [n.x + lp[0] * pv.h, n.y + lp[1] * pv.h], pv.d, n, lim);
      }
      out.get(a.w.key)[a.end] = { L: cL, R: cR };
    });
  }
  return out;
}

// ---------- volumes des murs : un prisme par morceau plein (entre les ouvertures, allèges, linteaux) ----------
// cut = hauteur de coupe (maison de poupée) ; → [{ q: [[x,y]×4], y0, y1, wall, ext, mat }]
export function wallPrisms(plan, { cut = Infinity, H = H3D } = {}) {
  const ends = wallEnds(plan), out = [];
  for (const w of plan.walls) {
    const E = ends.get(w.key), h = w.ep / 2, nx = -w.uy, ny = w.ux;
    const at = (s, side) => [w.A.x + w.ux * s + side * nx * h, w.A.y + w.uy * s + side * ny * h];
    // aux bouts : les coins de jonction ; ailleurs : coupe droite
    const face = (s) => s <= 1e-6 ? [E.a.L, E.a.R] : s >= w.L - 1e-6 ? [E.b.R, E.b.L] : [at(s, 1), at(s, -1)];
    const ext = w.mat === "maconnerie" || (!w.mat && w.ep >= 0.15);
    const piece = (s0, s1, y0, y1) => {
      y0 = Math.min(y0, cut); y1 = Math.min(y1, cut);
      if (s1 - s0 < 0.005 || y1 - y0 < 0.005) return;
      let [L0, R0] = face(s0), [L1, R1] = face(s1);
      // morceau court près d'un angle (ouverture contre la jonction) : un coin d'onglet ne doit pas dépasser l'autre bout
      const p = (v) => (v[0] - w.A.x) * w.ux + (v[1] - w.A.y) * w.uy;
      if (p(L0) > s1) L0 = at(s1, 1);
      if (p(R0) > s1) R0 = at(s1, -1);
      if (p(L1) < s0) L1 = at(s0, 1);
      if (p(R1) < s0) R1 = at(s0, -1);
      const q = [L0, L1, R1, R0];
      let A = 0; for (let i = 0; i < 4; i++) { const u = q[i], v = q[(i + 1) % 4]; A += u[0] * v[1] - v[0] * u[1]; }
      if (Math.abs(A) / 2 < 1e-5) return;
      out.push({ q, y0, y1, wall: w.id, key: w.key, ext, mat: w.mat, ep: w.ep });
    };
    // 3D-3 : hauteur du mur = la plus haute des pièces qu'il borde (sinon la hauteur de départ)
    const top = w.top || H.plafond;
    let s = 0;
    for (const o of plan.openings.get(w.key) || []) {
      const a = Math.max(0, o.c - o.w / 2), b = Math.min(w.L, o.c + o.w / 2);
      piece(s, a, 0, top);
      if (o.y0 > 0) piece(a, b, 0, Math.min(o.y0, top));
      if (o.y1 < top) piece(a, b, o.y1, top);
      s = Math.max(s, b);
    }
    piece(s, w.L, 0, top);
  }
  return out;
}

// vitrages et battants : [{ kind, cx, cy, ang, w, y0, y1, ep, hinge:[x,y], leafAng }]
export function openingParts(plan, { cut = Infinity } = {}) {
  const out = [];
  for (const w of plan.walls) for (const o of plan.openings.get(w.key) || []) {
    const cx = w.A.x + w.ux * o.c, cy = w.A.y + w.uy * o.c, ang = Math.atan2(w.uy, w.ux);
    const y1 = Math.min(o.y1, cut);
    if (y1 - o.y0 <= 0.02) continue;
    const P = { kind: o.kind, id: o.id, cx, cy, ang, w: o.w, y0: o.y0, y1, ep: w.ep };
    if (o.kind === "porte" && o.w <= 1.2) {
      // battant ouvert à 70°, côté charnière (g/d) et sens (int/ext) du dessin
      const side = o.swing === "ext" ? 1 : -1, hg = o.hinge === "d" ? 1 : -1, nx = -w.uy, ny = w.ux;
      P.hinge = [cx + w.ux * hg * (o.w / 2 - 0.02) + nx * side * (w.ep / 2), cy + w.uy * hg * (o.w / 2 - 0.02) + ny * side * (w.ep / 2)];
      const c = Math.cos(1.22), sn = Math.sin(1.22);   // 70°
      P.leafDir = [-hg * w.ux * c + side * nx * sn, -hg * w.uy * c + side * ny * sn];
      P.leafW = o.w - 0.04;
    }
    out.push(P);
  }
  return out;
}

// ---------- appareils : position, hauteur, normale du mur ----------
// apps [{id,t,x,y,h (cm|null), hDef (cm|null), seg, rep, color, room, name}] ; segs = données d'origine
export function devicesOf(apps, data, H = H3D) {
  const nodes = new Map((data.nodes || []).map((n) => [n.id, n]));
  const segs = new Map((data.segs || []).map((s) => [s.id, s]));
  return (apps || []).filter((a) => isNum(a.x) && isNum(a.y)).map((a) => {
    const hcm = isNum(a.h) ? a.h : isNum(a.hDef) ? a.hDef : null;
    const s = a.seg ? segs.get(a.seg) : null, A = s && nodes.get(s.a), B = s && nodes.get(s.b);
    let mount = "pose", n = null, x = a.x, y = a.y, h, defH = !isNum(a.h);
    if (A && B && !s.virt) {
      const L = hyp(B.x - A.x, B.y - A.y) || 1, ux = (B.x - A.x) / L, uy = (B.y - A.y) / L, ep = s.ep > 0 ? s.ep : 0.2;
      let nx = -uy, ny = ux;
      const side = (a.x - A.x) * nx + (a.y - A.y) * ny;
      if (side < 0) { nx = -nx; ny = -ny; }
      const t = (a.x - A.x) * ux + (a.y - A.y) * uy;
      // appareil plaqué contre la face du mur (le dessin le pose sur la face ou sur l'axe selon les relevés)
      x = A.x + ux * t + nx * (ep / 2 + 0.008); y = A.y + uy * t + ny * (ep / 2 + 0.008);
      mount = "mur"; n = [nx, ny];
      h = hcm != null ? hcm / 100 : 1.1;
      return { ...a, x, y, h, n, mount, defH, axis: [A.x + ux * t, A.y + uy * t], seg: s.id };
    }
    if (hcm == null && PLAFOND_TYPES.has(a.t)) { mount = "plafond"; h = (a.hsp > 0 ? a.hsp : H.plafond) - 0.08; }
    else if (hcm == null) { h = a.t === "TAB" ? 1.3 : 1.0; }
    else h = hcm / 100;
    return { ...a, x, y, h, n, mount, defH };
  });
}

// ---------- gaines (3D-5) ----------
// point de mur le plus proche (hors passages), pour la descente d'une gaine par le sol près de sa boîte
export function nearestWall(plan, x, y) {
  let best = null;
  for (const w of plan.walls) {
    let s = Math.max(0, Math.min(w.L, (x - w.A.x) * w.ux + (y - w.A.y) * w.uy));
    // dans un passage (porte, baie) : on glisse jusqu'au bord le plus proche du passage
    for (const o of plan.openings.get(w.key) || []) if (o.y0 < 0.3 && Math.abs(s - o.c) < o.w / 2 + 0.1) s = s < o.c ? o.c - o.w / 2 - 0.1 : o.c + o.w / 2 + 0.1;
    if (s < 0 || s > w.L || (plan.openings.get(w.key) || []).some((o) => o.y0 < 0.3 && Math.abs(s - o.c) < o.w / 2 + 0.1 - 1e-9)) continue;
    const px = w.A.x + w.ux * s, py = w.A.y + w.uy * s, d = hyp(px - x, py - y);
    if (!best || d < best.d) best = { x: px, y: py, d };
  }
  return best;
}
// tracé 3D d'une gaine : le tracé du plan en traits droits (la courbe du plan n'est qu'un effet visuel), au-dessus du
// plafond, en diagonale si besoin, puis descente dans le mur jusqu'à l'appareil. Par le sol : descente dans le mur le
// plus proche de la boîte, trajet dans la dalle (mêmes points de passage), remontée dans le mur de l'appareil.
// box {x,y} ; route [{x,y}] ; end {x, y, h, axis?:[x,y], mount} ; → { pts [[x, hauteur, y]…], L }
export function gainePath({ box, route = [], end, sol = false, H = H3D, wall = null }) {
  const Y = H.combles - 0.1, F = 0.015, P = [];
  const add = (x, h, y) => { const l = P[P.length - 1]; if (!l || hyp(l[0] - x, l[1] - h, l[2] - y) > 1e-4) P.push([x, h, y]); };
  const ax = end.axis || [end.x, end.y];
  add(box.x, H.combles, box.y); add(box.x, Y, box.y);
  if (sol) {
    const q = wall || { x: box.x, y: box.y };
    add(q.x, Y, q.y); add(q.x, F, q.y);
    for (const p of route || []) add(p.x, F, p.y);
    add(ax[0], F, ax[1]); add(ax[0], end.h, ax[1]);
  } else {
    for (const p of route || []) add(p.x, Y, p.y);
    add(ax[0], Y, ax[1]);
    add(ax[0], end.mount === "plafond" ? end.h + 0.07 : end.h, ax[1]);
  }
  if (end.mount !== "plafond") add(end.x, end.h, end.y);
  let L = 0; for (let i = 1; i < P.length; i++) L += hyp(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1], P[i][2] - P[i - 1][2]);
  return { pts: P, L };
}

// ---------- contrôle des volumes (tests et défauts) ----------
// prisme valable : 4 points finis, quadrilatère non croisé d'aire > 0, hauteur > 0
export function prismIssues(prisms) {
  const bad = [];
  for (const p of prisms) {
    const q = p.q;
    if (!q.every((v) => isNum(v[0]) && isNum(v[1])) || !(p.y1 > p.y0)) { bad.push({ p, why: "nombre" }); continue; }
    let A = 0; for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4]; A += a[0] * b[1] - b[0] * a[1]; }
    if (Math.abs(A) / 2 < 1e-6) { bad.push({ p, why: "aire nulle" }); continue; }
    // côtés opposés qui se croisent = quadrilatère retourné
    const cross = (p1, p2, p3, p4) => { const d = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); return d(p1, p2, p3) * d(p1, p2, p4) < -1e-12 && d(p3, p4, p1) * d(p3, p4, p2) < -1e-12; };
    if (cross(q[0], q[1], q[2], q[3]) || cross(q[1], q[2], q[3], q[0])) bad.push({ p, why: "croisé" });
    // pointe : un coin de jonction parti loin du mur
    const span = Math.max(...q.map((v) => hyp(v[0] - q[0][0], v[1] - q[0][1])));
    if (span > 60) bad.push({ p, why: "pointe" });
  }
  return bad;
}

// emprise du plan (pour cadrer la caméra)
export function planBounds(plan) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const n of plan.nodes.values()) { x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x); y1 = Math.max(y1, n.y); }
  if (!isFinite(x0)) return { x0: 0, y0: 0, x1: 10, y1: 8 };
  return { x0, y0, x1, y1 };
}
