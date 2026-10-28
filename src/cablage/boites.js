// Placement automatique des boîtes de pieuvre (v29), pour économiser au maximum le cuivre.
// Règles (docs/regles-cablage.md) : boîte carrée dans les combles / le faux plafond, faces A (haut du plan), B (droite),
// C (bas), D (gauche) ; au plus `departsFace` gaines par face (alimentation comprise) et `departsMax` départs par boîte
// (sans l'alimentation, R-001) ; chaque boîte est alimentée
// depuis le tableau (une seule gaine d'alimentation pour tous ses circuits, deux si elle dépasse l'ICTA 20) ; les circuits spécialisés et la
// communication sont des lignes directes (pas de boîte).
// Une commande et les lumières qu'elle allume doivent être dans la même boîte (le retour lampe ne sort pas de la boîte) :
// on place donc des « unités » indivisibles (un allumage complet, ou une prise seule).

import { packAlim } from "./gaine.js";
import { isVolet, sansCvr } from "./appareils.js";
import { pointInPoly, labelPoint } from "../walls/rooms.js";

const LIGHT = new Set(["LUM", "SPOT", "APP"]), CMD = new Set(["INT", "VV", "BP"]);
const d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const FACES = ["A", "B", "C", "D"];

// face d'une gaine qui part de la boîte vers le point p : A = vers le haut du plan (y plus petit), puis sens horaire
export function faceToward(box, p) {
  const dx = p.x - box.x, dy = p.y - box.y;
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return "A";
  if (Math.abs(dy) >= Math.abs(dx)) return dy < 0 ? "A" : "C";
  return dx > 0 ? "B" : "D";
}
// préférence des faces pour une direction (la meilleure d'abord), pour répartir quand une face est pleine
function facePrefs(box, p) {
  const a = Math.atan2(p.x - box.x, -(p.y - box.y));          // 0 = haut, sens horaire
  const centers = { A: 0, B: Math.PI / 2, C: Math.PI, D: -Math.PI / 2 };
  const gap = (f) => { let g = Math.abs(a - centers[f]); if (g > Math.PI) g = 2 * Math.PI - g; return g; };
  return FACES.slice().sort((x, y) => gap(x) - gap(y));
}
// répartit des départs {id, p} sur les faces (au plus `max` par face) ; renvoie Map id → face (ou null si plein)
export function assignFaces(box, departs, max) {
  const out = new Map(), count = { A: 0, B: 0, C: 0, D: 0 };
  // les départs les plus « francs » (bien en face) d'abord, les obliques s'adaptent
  const L = departs.map((g) => ({ ...g, pref: facePrefs(box, g.p) }));
  L.sort((x, y) => obliq(box, x.p) - obliq(box, y.p));
  for (const g of L) { const f = g.pref.find((ff) => count[ff] < max); out.set(g.id, f || null); if (f) count[f]++; }
  return out;
}
// points d'accroche (v37) : `max` points par face, numérotés dans le sens horaire (A : gauche → droite, B : haut → bas,
// C : droite → gauche, D : bas → haut). Les gaines d'une face y sont rangées dans l'ordre de leur direction : elles ne se
// croisent pas. `pins` = choix manuels { clé (id d'appareil ou "tab") : {f, i} } : une gaine épinglée garde sa face et son point.
// deps = [{id, p, keys}] ; renvoie Map id → {face, slot} (slot null si la face est pleine).
export function portLayout(box, deps, max, pins = {}) {
  const out = new Map(), used = { A: new Set(), B: new Set(), C: new Set(), D: new Set() }, count = { A: 0, B: 0, C: 0, D: 0 };
  const free = [];
  for (const d of deps) {
    const pin = (d.keys || [d.id]).map((k) => pins[k]).find((q) => q && FACES.includes(q.f));
    if (pin && pin.i >= 0 && pin.i < max && !used[pin.f].has(pin.i)) { used[pin.f].add(pin.i); count[pin.f]++; out.set(d.id, { face: pin.f, slot: pin.i }); }
    else free.push(d);
  }
  // faces des autres : la plus proche de leur direction, sans dépasser `max` par face
  const L = free.map((g) => ({ ...g, pref: facePrefs(box, g.p) })).sort((x, y) => obliq(box, x.p) - obliq(box, y.p));
  const faceOf = new Map();
  for (const g of L) { const f = g.pref.find((ff) => count[ff] < max); faceOf.set(g.id, f || null); if (f) count[f]++; }
  // dans chaque face : points libres répartis régulièrement, dans l'ordre horaire des directions
  const cw = (f, p) => { let a = Math.atan2(p.x - box.x, -(p.y - box.y)); if (f === "C" && a < 0) a += 2 * Math.PI; return a; };
  for (const f of FACES) {
    const G = free.filter((g) => faceOf.get(g.id) === f).sort((x, y) => cw(f, x.p) - cw(f, y.p));
    const fr = [...Array(max).keys()].filter((i) => !used[f].has(i));
    G.forEach((g, j) => out.set(g.id, { face: f, slot: fr[Math.min(fr.length - 1, Math.round((j + 0.5) * fr.length / G.length - 0.5))] }));
  }
  free.filter((g) => !faceOf.get(g.id)).forEach((g) => out.set(g.id, { face: null, slot: null }));
  return out;
}
// position d'un point d'accroche (boîte de côté S, `max` points par face)
export function portXY(box, S, max, f, i) {
  if (!f || i == null) return { x: box.x, y: box.y };
  const t = (i + 1) / (max + 1) * S - S / 2, h = S / 2;
  return f === "A" ? { x: box.x + t, y: box.y - h } : f === "B" ? { x: box.x + h, y: box.y + t } : f === "C" ? { x: box.x - t, y: box.y + h } : { x: box.x - h, y: box.y - t };
}
function obliq(box, p) { const dx = Math.abs(p.x - box.x), dy = Math.abs(p.y - box.y); return Math.min(dx, dy) / (Math.max(dx, dy) || 1); }

// unités indivisibles : allumages (lumières + commandes liées) et appareils seuls ; uniquement les circuits « à boîte »
export function buildUnits(items, links, circuits) {
  const circOf = new Map(); circuits.forEach((c) => c.apps.forEach((id) => circOf.set(id, c)));
  // (v54 : l'équipotentielle locale va dans une boîte sans circuit : un fil vert/jaune sur la terre, R-080)
  const boxed = items.filter((a) => { const c = circOf.get(a.id); return (c && !c.direct && c.kind !== "comm") || a.t === "EQL"; });
  const ids = new Set(boxed.map((a) => a.id));
  const par = new Map(boxed.map((a) => [a.id, a.id])), find = (x) => (par.get(x) === x ? x : (par.set(x, find(par.get(x))), par.get(x)));
  for (const l of links) if (ids.has(l.c) && ids.has(l.l)) par.set(find(l.c), find(l.l));
  const groups = new Map();
  boxed.forEach((a) => { const r = find(a.id); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(a); });
  return [...groups.values()].map((g) => ({
    ids: g.map((a) => a.id), lv: g[0].lv, x: g.reduce((s, a) => s + a.x, 0) / g.length, y: g.reduce((s, a) => s + a.y, 0) / g.length,
    pts: g.map((a) => ({ x: a.x, y: a.y })), circuits: [...new Set(g.map((a) => circOf.get(a.id)?.id).filter(Boolean))],
    volet: g.every((a) => isVolet(a.t)),
    // pièce de l'unité (mode « par pièce ») : celle de la majorité de ses lumières, sinon de ses appareils
    room: majority(g.filter((a) => LIGHT.has(a.t) && a.room).map((a) => a.room)) || majority(g.filter((a) => a.room).map((a) => a.room)) || null,
  }));
}

function majority(L) {
  const m = new Map(); L.forEach((x) => m.set(x, (m.get(x) || 0) + 1));
  return [...m].sort((p, q) => q[1] - p[1])[0]?.[0] || null;
}

// départs d'une boîte (R-001, v52) : une gaine par endroit desservi (appareils au même endroit = une gaine partagée,
// R-073), SANS l'alimentation ; l'alimentation compte seulement dans les faces (6 gaines par face, alimentation comprise)
const departsOf = (units, S) => spotPts(units, S && S.memeEndroit != null ? S.memeEndroit : 0.3).length;
// gaines d'une boîte pour le contrôle des faces : un départ par endroit + la ou les gaines d'alimentation (vers le tableau)
function faceDeps(units, tab, S) {
  const deps = spotPts(units, S.memeEndroit ?? 0.3).map((p, i) => ({ id: "s" + i, p }));
  const C = new Set(units.flatMap((u) => u.circuits)), na = S.alimCount ? S.alimCount(C) : (C.size ? 1 : 0);
  for (let i = 0; i < na; i++) deps.push({ id: "alim:" + i, p: tab || { x: deps[0]?.p.x ?? 0, y: (deps[0]?.p.y ?? 0) - 1 } });
  return deps;
}

// point qui minimise la somme pondérée des distances (algorithme de Weiszfeld)
function median(pts, start) {
  let p = { ...start };
  for (let it = 0; it < 40; it++) {
    let sx = 0, sy = 0, sw = 0;
    for (const q of pts) { const d = Math.max(0.05, d2(p, q)); const w = (q.w || 1) / d; sx += q.x * w; sy += q.y * w; sw += w; }
    const np = { x: sx / sw, y: sy / sw }; if (d2(np, p) < 1e-4) { p = np; break; } p = np;
  }
  return p;
}

// coût en cuivre d'une boîte : longueurs horizontales boîte → appareils (pondérées par le nombre de fils ≈ 3)
// + alimentations depuis le tableau (une par circuit, 3 fils)
// points desservis par une boîte : les appareils au même endroit (≤ near) partagent une gaine → un seul point
function spotPts(units, near = 0.3) {
  const out = [];
  for (const u of units) for (const p of u.pts) if (!out.some((q) => d2(p, q) <= near + 1e-9)) out.push(p);
  return out;
}
function boxCost(box, units, tab, near) {
  let c = 0;
  for (const p of spotPts(units, near)) c += d2(box, p) * 3;
  if (tab) { const nc = new Set(units.flatMap((u) => u.circuits)).size; c += d2(box, tab) * (2 * nc + 1); }   // phase + neutre par circuit, une terre
  return c;
}

// placement pour un niveau : regroupement avec capacité, k boîtes, plusieurs essais ; renvoie [{x, y, units}]
// nom d'une boîte (format KiTéOHM / FTZ) : LI01, LI02…
export const boxName = (n) => "LI" + String(n).padStart(2, "0");
export function minBoxes(units, S) { return Math.max(1, Math.ceil(departsOf(units, S) / S.departsMax)); }
function placeLevel(units, tab, S, tries = 4, kFixed = 0) {
  if (!units.length) return [];
  const kmin = minBoxes(units, S);
  let best = null;
  const k0 = kFixed ? Math.max(kmin, kFixed) : kmin, k1 = kFixed ? k0 : kmin + tries;
  for (let k = k0; k <= k1; k++) {
    for (let seed = 0; seed < 3; seed++) {
      const r = cluster(units, k, tab, S, seed);
      if (!r) continue;
      const cost = r.reduce((s, b) => s + boxCost(b, b.units, tab, S.memeEndroit ?? 0.3), 0) + r.length * 0.5;   // une boîte de plus coûte un peu
      if (!best || cost < best.cost) best = { cost, boxes: r };
    }
    if (best && (kFixed || k > kmin + 1)) break;
  }
  if (!best && kFixed) return placeLevel(units, tab, S, tries, 0);   // nombre imposé impossible : on revient au calcul automatique
  return best ? best.boxes : null;
}

function cluster(units, k, tab, S, seed) {
  // départ : k unités éloignées les unes des autres (k-means++ déterministe)
  const U = units.slice().sort((a, b) => (a.x + a.y) - (b.x + b.y));
  const centers = [U[(seed * 7) % U.length]];
  while (centers.length < k) {
    let far = null, fd = -1;
    for (const u of U) { const d = Math.min(...centers.map((c) => d2(c, u))); if (d > fd) { fd = d; far = u; } }
    centers.push(far);
  }
  let boxes = centers.map((c) => ({ x: c.x, y: c.y, units: [] }));
  for (let it = 0; it < 25; it++) {
    boxes.forEach((b) => (b.units = []));
    // les plus grosses unités d'abord, chacune dans la boîte la plus proche qui a encore de la place
    const order = units.slice().sort((a, b) => b.ids.length - a.ids.length || (a.x - b.x));
    for (const u of order) {
      const cand = boxes.map((b, i) => ({ b, i, d: d2(b, u) })).sort((p, q) => p.d - q.d);
      const fit = cand.find(({ b }) => departsOf([...b.units, u], S) <= S.departsMax);
      if (!fit) return null;
      fit.b.units.push(u);
    }
    // boîte restée vide : on la recentre sur l'unité la plus éloignée de sa boîte (le nombre de boîtes demandé est tenu)
    let reseed = false;
    for (const e of boxes.filter((b) => !b.units.length)) {
      let far = null, fd = -1;
      for (const b of boxes) if (b.units.length > 1) for (const u of b.units) { const d = d2(b, u); if (d > fd) { fd = d; far = u; } }
      if (far) { e.x = far.x + 0.01; e.y = far.y + 0.01; reseed = true; }
    }
    if (reseed && it < 24) continue;
    const moved = boxes.map((b) => {
      if (!b.units.length) return 0;
      const pts = spotPts(b.units, S.memeEndroit ?? 0.3);
      if (tab) pts.push({ x: tab.x, y: tab.y, w: (2 * new Set(b.units.flatMap((u) => u.circuits)).size + 1) / 3 });
      const np = median(pts, b); const m = d2(np, b); b.x = np.x; b.y = np.y; return m;
    });
    if (Math.max(...moved) < 0.01) break;
  }
  boxes = boxes.filter((b) => b.units.length);
  // contrôle des faces (au plus `departsFace` par face) : sinon cette répartition n'est pas valable
  for (const b of boxes) if ([...assignFaces(b, faceDeps(b.units, tab, S), S.departsFace).values()].some((x) => !x)) return null;
  return boxes;
}

// boîte valable : au plus departsMax départs (sans l'alimentation) et departsFace gaines par face (alimentation comprise)
function boxOk(b, tab, S) {
  if (departsOf(b.units, S) > S.departsMax) return false;
  return ![...assignFaces(b, faceDeps(b.units, tab, S), S.departsFace).values()].some((x) => !x);
}
// position d'une boîte : point médian de ses endroits desservis (attiré par le tableau si `pull`)
function seat(units, tab, S, pull = true) {
  const pts = spotPts(units, S.memeEndroit ?? 0.3);
  if (tab && pull) pts.push({ x: tab.x, y: tab.y, w: (2 * new Set(units.flatMap((u) => u.circuits)).size + 1) / 3 });
  const c = { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length };
  return median(pts, c);
}

// mode « équilibrée » (v39 ; v56 : le moins de boîtes possible) : la maison découpée en k parts de départs à peu près égaux, par coupes successives selon
// le plus grand côté (comme le fait le bureau d'études : des boîtes régulières, « qui plaisent à l'œil ») ; les allumages
// restent entiers ; chaque boîte au milieu de sa part (sans attraction du tableau)
function bisect(units, k, S) {
  if (k <= 1 || units.length <= 1) return [units];
  const xs = units.map((u) => u.x), ys = units.map((u) => u.y);
  const ax = Math.max(...xs) - Math.min(...xs) >= Math.max(...ys) - Math.min(...ys) ? "x" : "y";
  const U = units.slice().sort((p, q) => p[ax] - q[ax]);
  const w = (u) => departsOf([u], S) + 0.1, tot = U.reduce((s, u) => s + w(u), 0), kL = Math.floor(k / 2);   // v56 : parts égales en départs
  let acc = 0, i = 0;
  while (i < U.length - 1 && acc + w(U[i]) / 2 < tot * kL / k) acc += w(U[i++]);
  i = Math.max(1, Math.min(U.length - 1, i));
  return [...bisect(U.slice(0, i), kL, S), ...bisect(U.slice(i), k - kL, S)];
}
function placeLevelBalanced(units, tab, S, k0) {
  if (!units.length) return [];
  for (let k = Math.max(k0, minBoxes(units, S)); k <= k0 + 6; k++) {
    const parts = bisect(units, k, S).filter((p) => p.length);
    const boxes = parts.map((P) => ({ ...seat(P, tab, S, false), units: P }));
    if (boxes.every((b) => boxOk(b, tab, S))) return boxes;
  }
  return null;
}

// mode « par pièce » (v39) : une boîte par pièce (pièce des lumières de chaque allumage) ; une pièce avec peu de départs
// (moins que « départs minimum » : WC, dégagement…) rejoint la pièce voisine ; un appareil sans pièce (extérieur) va
// à la pièce la plus proche ; une pièce trop chargée est coupée ; la boîte est posée dans sa pièce
function placeLevelRooms(units, tab, S, roomsLv) {
  if (!units.length) return [];
  const centerOf = (L) => ({ x: L.reduce((s, u) => s + u.x, 0) / L.length, y: L.reduce((s, u) => s + u.y, 0) / L.length });
  const G = new Map();
  units.filter((u) => u.room).forEach((u) => { if (!G.has(u.room)) G.set(u.room, []); G.get(u.room).push(u); });
  if (!G.size) return placeLevel(units, tab, S);
  const near = (u) => [...G.entries()].sort(([, p], [, q]) => d2(centerOf(p), u) - d2(centerOf(q), u))[0][0];
  units.filter((u) => !u.room).forEach((u) => G.get(near(u)).push(u));
  // petites pièces : rattachées à la pièce la plus proche (la plus petite d'abord)
  const minD = S.piecesMinDeparts ?? 3;
  for (let again = true; again && G.size > 1;) {
    again = false;
    // départs vers les appareils (un par endroit), sans l'alimentation
    const small = [...G.entries()].map(([r, L]) => ({ r, L, d: spotPts(L, S.memeEndroit ?? 0.3).length })).filter((x) => x.d < minD).sort((p, q) => p.d - q.d)[0];
    if (!small) break;
    const c = centerOf(small.L), to = [...G.entries()].filter(([r]) => r !== small.r).sort(([, p], [, q]) => d2(centerOf(p), c) - d2(centerOf(q), c))[0][0];
    G.get(to).push(...small.L); G.delete(small.r); again = true;
  }
  const out = [];
  for (const [room, L] of G) {
    let parts = [L];
    for (let k = 2; !parts.every((P) => boxOk({ ...seat(P, tab, S), units: P }, tab, S)) && k <= 6; k++) parts = bisect(L, k, S);
    const poly = (roomsLv || []).find((r) => r.name === room)?.poly;
    for (const P of parts) {
      let p = seat(P, tab, S, false);
      if (poly && poly.length > 2 && !pointInPoly(p.x, p.y, poly)) p = labelPoint(poly);
      out.push({ ...p, units: P, room });
    }
  }
  return out;
}

// toutes les boîtes du chantier ; tabs : {[niveau]: {x, y}} position du tableau (ou de la trémie qui y mène) par niveau
// keep = boîtes à garder telles quelles (verrouillées ou non cochées) : elles gardent position, nom, tracés et
// appareils ; une unité dont un appareil est déjà dans une boîte gardée y va en entier ; le reste est réparti.
// count = nombre total de boîtes voulu (boîtes gardées comprises), 0 = automatique
// mode (v39) : "proximite" (le moins de cuivre, défaut), "equilibre" (parts égales), "piece" (une boîte par pièce ;
// rooms = {[niveau]: [{name, poly}]})
export const MODES = { proximite: "Proximité", equilibre: "Équilibrée", piece: "Par pièce" };
export function placeBoxes(items0, links, circuits, tabs, S0, { keep = [], count = 0, mode = "proximite", rooms = {}, volets = "" } = {}) {
  const items = sansCvr(items0, S0);
  const secOf = new Map(circuits.map((c) => [c.id, c.section || 1.5]));
  const S = { ...S0, alimCount: (ids) => (ids.size ? packAlim([...ids].map((id) => ({ id, section: secOf.get(id) || 1.5 })), S0).length : 0) };
  const all = buildUnits(items, links, circuits), exist = new Set(items.map((a) => a.id));
  const kept = keep.map((b) => ({ ...b, apps: b.apps.filter((id) => exist.has(id)) }));
  const inKept = new Map(); kept.forEach((b) => b.apps.forEach((id) => inKept.set(id, b)));
  const units = [];
  for (const u of all) {
    const kb = u.ids.map((id) => inKept.get(id)).find(Boolean);
    if (kb) u.ids.forEach((id) => { if (!kb.apps.includes(id)) { kb.apps.push(id); inKept.set(id, kb); } });
    else units.push(u);
  }
  const levels = [...new Set(units.map((u) => u.lv))];
  const out = [...kept], issues = [];
  const usedIds = new Set(kept.map((b) => b.id));
  let n = Math.max(0, ...kept.map((b) => +String(b.n).replace(/\D/g, "") || 0));
  // nombre imposé : réparti entre les niveaux selon leurs départs, jamais moins que le minimum (départs par boîte)
  const want = {};
  if (count > 0) {
    const free = Math.max(0, count - kept.length), dep = Object.fromEntries(levels.map((lv) => [lv, departsOf(units.filter((u) => u.lv === lv), S)]));
    const tot = Object.values(dep).reduce((s, v) => s + v, 0) || 1;
    // au moins une boîte par niveau, le reste au prorata des départs (plus forts restes) : la somme fait bien `free`
    const base = levels.map((lv) => ({ lv, x: Math.max(0, free - levels.length) * dep[lv] / tot }));
    base.forEach((b) => { want[b.lv] = 1 + Math.floor(b.x); });
    let left = Math.max(levels.length, free) - levels.reduce((s, lv) => s + want[lv], 0);
    base.sort((p, q) => (q.x - Math.floor(q.x)) - (p.x - Math.floor(p.x))).forEach((b) => { if (left > 0) { want[b.lv]++; left--; } });
    // jamais plus de boîtes que d'unités sur un niveau : le surplus va aux niveaux qui en ont le plus
    const cap = Object.fromEntries(levels.map((lv) => [lv, units.filter((u) => u.lv === lv).length]));
    let extra = 0; levels.forEach((lv) => { if (want[lv] > cap[lv]) { extra += want[lv] - cap[lv]; want[lv] = cap[lv]; } });
    for (const lv of levels.slice().sort((p, q) => dep[q] - dep[p])) { const room = cap[lv] - want[lv]; const k = Math.min(room, extra); want[lv] += k; extra -= k; }
    const mins = levels.reduce((s, lv) => s + minBoxes(units.filter((u) => u.lv === lv), S), 0);
    if (free < mins) issues.push(`${count} boîtes demandées : il en faut au moins ${mins + kept.length} pour respecter ${S.departsMax} départs par boîte (sans l'alimentation) et ${S.departsFace} gaines par face`);
  }
  const placeMode = (L, lv, k) => {
    if (mode === "piece") return placeLevelRooms(L, tabs[lv] || null, S, rooms[lv]);
    // v56 (R-094, H-041) : en mode équilibrée, le moins de boîtes possible (comme le BE) : on part du minimum de boîtes
    // permis par les départs, et on n'en ajoute que si les parts ne tiennent pas (départs ou gaines par face)
    if (mode === "equilibre") return placeLevelBalanced(L, tabs[lv] || null, S, k || minBoxes(L, S));
    return placeLevel(L, tabs[lv] || null, S, 4, k || 0);
  };
  const tabOf = (lv) => tabs[lv] || null;
  for (const lv of levels) {
    const L = units.filter((u) => u.lv === lv);
    let r;
    // volets roulants (v54, R-079, R-094) : choix du chantier « boîte à part » ou « mélangés » ; sinon selon le mode :
    // équilibrée = une boîte pour les volets (à part), proximité = la solution la plus économique, par pièce = mélangés
    const LV = L.filter((u) => u.volet), LO = L.filter((u) => !u.volet);
    let apart = false;
    if (LV.length && LO.length) {
      if (volets === "boite_a_part") apart = true;
      else if (volets === "melanges") apart = false;
      else if (mode === "equilibre") apart = true;
      else if (mode === "proximite") {
        const cost = (B) => (B || []).reduce((s2, b) => s2 + boxCost(b, b.units, tabOf(lv), S.memeEndroit ?? 0.3), 0) + (B || []).length * 0.5;
        const mix = placeMode(L, lv, want[lv] || 0), sep = [...(placeLevel(LV, tabOf(lv), S, 4, 0) || []), ...(placeMode(LO, lv, 0) || [])];
        apart = !!sep.length && (!mix || cost(sep) < cost(mix));
      } else if (mode === "piece") issues.push("Volets roulants en mode « par pièce » : pas de règle (R-094) — volets mélangés aux autres boîtes, à vérifier");
    }
    if (apart) {
      const rv = mode === "equilibre" ? (boxOk({ ...seat(LV, tabOf(lv), S, false), units: LV }, tabOf(lv), S) ? [{ ...seat(LV, tabOf(lv), S, false), units: LV }] : placeLevel(LV, tabOf(lv), S, 4, 0)) : placeLevel(LV, tabOf(lv), S, 4, 0);
      const ro = placeMode(LO, lv, want[lv] ? Math.max(1, want[lv] - (rv || []).length) : 0);
      r = rv && ro ? [...ro, ...rv] : null;
    } else r = placeMode(L, lv, want[lv] || 0);
    if (!r) { issues.push(`Niveau ${lv} : impossible de respecter ${S.departsMax} départs par boîte (sans l'alimentation) et ${S.departsFace} gaines par face (une unité trop grosse ?)`); continue; }
    for (const b of r) { do n++; while (usedIds.has("b" + n)); usedIds.add("b" + n); out.push({ id: "b" + n, n: boxName(n), lv, x: +(Math.round(b.x / 0.05) * 0.05).toFixed(2), y: +(Math.round(b.y / 0.05) * 0.05).toFixed(2), apps: b.units.flatMap((u) => u.ids) }); }
  }
  out.sort((a, b) => (+String(a.n).replace(/\D/g, "") || 0) - (+String(b.n).replace(/\D/g, "") || 0));
  return { boxes: out, issues, mode };
}
