// Placement automatique des boîtes de pieuvre (v29), pour économiser au maximum le cuivre.
// Règles (docs/regles-cablage.md) : boîte carrée dans les combles / le faux plafond, faces A (haut du plan), B (droite),
// C (bas), D (gauche) ; au plus `departsFace` gaines par face (alimentation comprise) et `departsMax` départs par boîte
// (sans l'alimentation, R-001) ; chaque boîte est alimentée
// depuis le tableau (une seule gaine d'alimentation pour tous ses circuits, deux si elle dépasse l'ICTA 20) ; les circuits spécialisés et la
// communication sont des lignes directes (pas de boîte).
// Une commande et les lumières qu'elle allume doivent être dans la même boîte (le retour lampe ne sort pas de la boîte) :
// on place donc des « unités » indivisibles (un allumage complet, ou une prise seule).

import { packAlim } from "./gaine.js";
import { isVolet, sansCvr, lignesOf, parseFils } from "./appareils.js";
import { intrusions } from "./qualite.js";
import { pointInPoly, labelPoint } from "../walls/rooms.js";

const LIGHT = new Set(["LUM", "SPOT", "APP"]), CMD = new Set(["INT", "VV", "BP"]);
const d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// v62 : nombre de fils (approché) de la gaine d'un appareil, pour le mode Économique (le moins de cuivre = longueur de
// chaque gaine × nombre de fils, Kévin 28/10 08:45) ; le calcul exact des fils vient ensuite (gaines.js)
const FILS = { INT: 2, BP: 2, VV: 3, CVR: 4, VR: 3, VEL: 3, EQL: 1 };
export function wiresOf(a) {
  if (FILS[a.t]) return FILS[a.t];
  const L = lignesOf(a);
  const n = (L || []).reduce((s, l) => s + (l.fils ? parseFils(l.fils).length : 0), 0);
  return n || 3;
}
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
  // v59 : aucune gaine ne croise une autre gaine de la boîte : on échange deux points, ou on déplace une gaine vers un
  // point libre, tant que ça enlève des croisements (les gaines épinglées à la main ne bougent pas)
  uncross(box, deps, out, max, new Set(deps.filter((d) => !free.includes(d)).map((d) => d.id)));
  return out;
}
export const PORT_S = 0.6;   // côté de référence de la boîte pour ce calcul (m) : le résultat ne dépend pas du zoom
function uncross(box, deps, out, max, pinned) {
  const D = deps.filter((d) => out.get(d.id) && out.get(d.id).face);
  if (D.length < 2) return;
  const segs = (d, q) => { const P = portXY(box, PORT_S, max, q.face, q.slot); return (d.pts && d.pts.length ? d.pts : [d.p]).map((t) => [P, t]); };
  const pair = (d, q, e, r) => { let n = 0; for (const [a, b] of segs(d, q)) for (const [c, x] of segs(e, r)) if (!(Math.hypot(a.x - c.x, a.y - c.y) < 1e-9) && crossSeg(a, b, c, x)) n++; return n; };
  const len = (d, q) => segs(d, q).reduce((s, [a, b]) => s + Math.hypot(a.x - b.x, a.y - b.y), 0);
  // une gaine sort par une face tournée vers son appareil (elle ne repasse pas sous la boîte)
  const faces = (d, q) => { const P = portXY(box, PORT_S, max, q.face, q.slot); return (d.pts && d.pts.length ? d.pts : [d.p]).every((t) => q.face === "A" ? t.y < P.y : q.face === "B" ? t.x > P.x : q.face === "C" ? t.y > P.y : t.x < P.x); };
  const okA = (A, ids) => ids.every((id) => { const d = D.find((x) => x.id === id), q = A.get(id); return !faces(d, out.get(id)) || faces(d, q); });
  const total = (A) => { let n = 0, L = 0; for (let i = 0; i < D.length; i++) { L += len(D[i], A.get(D[i].id)); for (let j = i + 1; j < D.length; j++) n += pair(D[i], A.get(D[i].id), D[j], A.get(D[j].id)); } return { n, L }; };
  let cur = total(out);
  for (let it = 0; it < 80 && cur.n > 0; it++) {
    const usedSlots = new Set([...out.values()].filter((q) => q.face).map((q) => q.face + q.slot));
    const freeSlots = [];
    for (const f of FACES) for (let i = 0; i < max; i++) if (!usedSlots.has(f + i)) freeSlots.push({ face: f, slot: i });
    let best = null;
    const tryA = (A, ids) => { if (!okA(A, ids)) return; const t = total(A); if (t.n < cur.n && (!best || t.n < best.t.n || (t.n === best.t.n && t.L < best.t.L))) best = { A, t }; };
    for (let i = 0; i < D.length; i++) for (let j = i + 1; j < D.length; j++) {
      const di = D[i], dj = D[j];
      if (!pair(di, out.get(di.id), dj, out.get(dj.id))) continue;
      if (!pinned.has(di.id) && !pinned.has(dj.id)) { const A = new Map(out); A.set(di.id, out.get(dj.id)); A.set(dj.id, out.get(di.id)); tryA(A, [di.id, dj.id]); }
      for (const d of [di, dj]) if (!pinned.has(d.id)) for (const q of freeSlots) { const A = new Map(out); A.set(d.id, q); tryA(A, [d.id]); }
    }
    if (!best) break;
    for (const [k, v] of best.A) out.set(k, v);
    cur = best.t;
  }
}
function crossSeg(a, b, c, d) {
  const o = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = o(c, d, a), d2 = o(c, d, b), d3 = o(a, b, c), d4 = o(a, b, d);
  return ((d1 > 1e-12 && d2 < -1e-12) || (d1 < -1e-12 && d2 > 1e-12)) && ((d3 > 1e-12 && d4 < -1e-12) || (d3 < -1e-12 && d4 > 1e-12));
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
    pts: g.map((a) => ({ x: a.x, y: a.y, f: wiresOf(a) })), circuits: [...new Set(g.map((a) => circOf.get(a.id)?.id).filter(Boolean))],
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
// v62 : `cu` = poids de chaque point = nombre de fils de sa gaine (mode Économique), sinon 1
function spotPts(units, near = 0.3, cu = false) {
  const out = [];
  for (const u of units) for (const p of u.pts) {
    const q = out.find((o) => d2(p, o) <= near + 1e-9);
    if (q) { if (cu) q.w = Math.max(q.w, p.f || 3); } else out.push(cu ? { x: p.x, y: p.y, w: p.f || 3 } : { x: p.x, y: p.y });
  }
  return out;
}
function boxCost(box, units, tab, near) {
  let c = 0;
  for (const p of spotPts(units, near, true)) c += d2(box, p) * p.w;   // v62 : longueur × fils de chaque gaine
  if (tab) { const nc = new Set(units.flatMap((u) => u.circuits)).size; c += d2(box, tab) * (2 * nc + 1); }   // phase + neutre par circuit, une terre
  return c;
}
// territoires mêlés d'une répartition (même niveau) : points d'une boîte au fond du territoire d'une autre
const terrOf = (boxes, S) => intrusions(boxes.map((b) => ({ x: b.x, y: b.y, pts: spotPts(b.units, S.memeEndroit ?? 0.3) })));
// v62 : une boîte « belle pieuvre » coûte en cuivre ce qu'elle coûte, plus une pénalité par appareil chez le voisin
export const TERR_COST = 8;
// une boîte de plus (boîte, connecteurs, alimentation, pose) comptée comme ce poids de cuivre (m de fil) : réglage
// `coutBoite` (25 m de base : avec 0,5 m, MAILLARD avait 10 boîtes dont trois de 1 ou 2 départs pour 0,3 % de cuivre en moins)
const boxCostOf = (S) => (S.coutBoite != null ? +S.coutBoite : 25);
const levelCost = (r, tab, S) => r.reduce((s, b) => s + boxCost(b, b.units, tab, S.memeEndroit ?? 0.3), 0) + r.length * boxCostOf(S) + TERR_COST * terrOf(r, S);
// v62 : petites boîtes (moins de 3 départs) : leurs unités vont dans les boîtes voisines qui ont de la place, si le
// total (cuivre + boîtes + territoires) baisse
function absorbSmall(boxes, tab, S) {
  let B = boxes.map((b) => ({ ...b, units: b.units.slice() }));
  for (let again = true; again && B.length > 1;) {
    again = false;
    const small = B.filter((b) => departsOf(b.units, S) < 3).sort((p, q) => departsOf(p.units, S) - departsOf(q.units, S));
    for (const sb of small) {
      const rest = B.filter((b) => b !== sb).map((b) => ({ ...b, units: b.units.slice() }));
      let ok = true;
      for (const u of sb.units) {
        // une place de marge : une gaine trop chargée peut être coupée en deux au câblage (R-073)
        const to = rest.slice().sort((p, q) => d2(p, u) - d2(q, u)).find((b) => departsOf([...b.units, u], S) <= S.departsMax - 1 && boxOk({ ...b, units: [...b.units, u] }, tab, S));
        if (!to) { ok = false; break; }
        to.units.push(u);
      }
      if (!ok) continue;
      rest.forEach((b) => { const p = median([...spotPts(b.units, S.memeEndroit ?? 0.3, true), ...(tab ? [{ x: tab.x, y: tab.y, w: 2 * new Set(b.units.flatMap((u) => u.circuits)).size + 1 }] : [])], b); b.x = p.x; b.y = p.y; });
      if (rest.every((b) => boxOk(b, tab, S)) && levelCost(rest, tab, S) < levelCost(B, tab, S)) { B = rest; again = true; break; }
    }
  }
  return B;
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
      const r0 = cluster(units, k, tab, S, seed), r = r0 && !kFixed ? absorbSmall(r0, tab, S) : r0;
      if (!r) continue;
      const cost = levelCost(r, tab, S);   // cuivre, boîtes, territoires bien séparés (v62)
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
      const pts = spotPts(b.units, S.memeEndroit ?? 0.3, true);   // v62 : pondéré par les fils de chaque gaine
      if (tab) pts.push({ x: tab.x, y: tab.y, w: 2 * new Set(b.units.flatMap((u) => u.circuits)).size + 1 });
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
// v62 : boîte des volets en mode Équilibrée (R-094 : une seule) ; coupée en deux seulement si les volets sont aux deux
// bouts de la maison (plus de VOLETS_SPAN m entre les extrêmes) et que deux boîtes font gagner plus de 40 % de gaine
// (alimentations comprises) : on évite ainsi de traverser toute la maison (proposé à Kévin, Q-87)
export const VOLETS_SPAN = 14;
function voletsBalanced(LV, tab, S) {
  const one = { ...seat(LV, tab, S, false), units: LV };
  if (!boxOk(one, tab, S)) return placeLevel(LV, tab, S, 4, 0);
  const pts = spotPts(LV, S.memeEndroit ?? 0.3);
  let span = 0; for (const p of pts) for (const q of pts) span = Math.max(span, d2(p, q));
  if (span <= VOLETS_SPAN || LV.length < 2) return [one];
  const len = (B) => B.reduce((s, b) => s + spotPts(b.units, S.memeEndroit ?? 0.3).reduce((t, p) => t + d2(b, p), 0) + (tab ? d2(b, tab) : 0), 0);
  const two = bisect(LV, 2, S).filter((P) => P.length).map((P) => ({ ...seat(P, tab, S, false), units: P }));
  return two.length === 2 && two.every((b) => boxOk(b, tab, S)) && len(two) < 0.6 * len([one]) ? two : [one];
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

// ---------- mode « par zone » (v62 bis, demandé par Kévin le 28/10/2026, 08:46 ; le BE ne le fait pas) ----------
// zones jour / nuit / garage d'après le nom des pièces ; les pièces de passage (WC, dégagement, couloir…) et les noms
// inconnus prennent la zone de leurs voisines (pièce qui touche, à moins de 35 cm : l'épaisseur d'un mur)
export const ZONES = { nuit: "Nuit", jour: "Jour", garage: "Garage" };
export const ZONE_MOTS = {
  nuit: ["chambre", "ch", "suite", "parental", "sdb", "bain", "salle d'eau", "sde", "douche", "dressing", "nuit"],
  garage: ["garage", "cellier", "buanderie", "atelier", "local tech", "chaufferie", "abri", "remise", "cave"],
  jour: ["sejour", "séjour", "salon", "piece de vie", "pièce de vie", "cuisine", "manger", "sam", "entree", "entrée", "bureau", "veranda", "véranda", "living", "jour", "bibliotheque", "bibliothèque", "jeux"],
};
// mots de 3 lettres ou moins (ch, sdb, sde, sam) : mot entier seulement
export function zoneOfName(name) {
  const n = String(name || "").toLowerCase().replace(/[^a-z0-9àâäçéèêëîïôöùûü']+/g, " ").trim();
  const hit = (m) => (m.length <= 3 ? new RegExp("(^| )" + m + "( |$)").test(n) : n.includes(m));
  for (const z of ["garage", "nuit", "jour"]) if (ZONE_MOTS[z].some(hit)) return z;
  return null;
}
const polyDist = (P, Q) => {
  let d = Infinity;
  const sd = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L)); return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy); };
  for (const p of P) for (let i = 0; i < Q.length; i++) d = Math.min(d, sd(p, Q[i], Q[(i + 1) % Q.length]));
  return d;
};
// rooms = [{name, poly}] → Map nom → zone ; une pièce de passage prend la zone la plus présente chez ses voisines
export function zonesOf(rooms) {
  const R = (rooms || []).filter((r) => r.poly && r.poly.length > 2), Z = new Map();
  R.forEach((r) => { const z = zoneOfName(r.name); if (z) Z.set(r.name, z); });
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    for (const r of R) {
      if (Z.has(r.name)) continue;
      const votes = {};
      R.forEach((o) => { if (o !== r && Z.has(o.name) && Math.min(polyDist(r.poly, o.poly), polyDist(o.poly, r.poly)) < 0.35) votes[Z.get(o.name)] = (votes[Z.get(o.name)] || 0) + 1; });
      // à égalité : nuit avant jour (le dégagement des chambres), jour avant garage
      const best = Object.entries(votes).sort((p, q) => q[1] - p[1] || ["nuit", "jour", "garage"].indexOf(p[0]) - ["nuit", "jour", "garage"].indexOf(q[0]))[0];
      if (best) { Z.set(r.name, best[0]); changed = true; }
    }
    if (!changed) break;
  }
  R.forEach((r) => { if (!Z.has(r.name)) Z.set(r.name, "jour"); });   // isolée et inconnue : jour
  return Z;
}
function placeLevelZones(units, tab, S, roomsLv) {
  if (!units.length) return [];
  const Z = zonesOf(roomsLv), R = (roomsLv || []).filter((r) => r.poly && r.poly.length > 2);
  if (!Z.size) return placeLevel(units, tab, S);
  const zoneOfUnit = (u) => {
    if (u.room && Z.has(u.room)) return Z.get(u.room);
    // hors pièce (extérieur) : zone de la pièce la plus proche
    let best = null, bd = Infinity;
    R.forEach((r) => { const d = polyDist([{ x: u.x, y: u.y }], r.poly); if (d < bd) { bd = d; best = r; } });
    return best ? Z.get(best.name) : "jour";
  };
  const G = new Map();
  units.forEach((u) => { const z = zoneOfUnit(u); if (!G.has(z)) G.set(z, []); G.get(z).push(u); });
  // zone avec moins de 3 départs : rejoint la zone la plus proche
  for (const [z, L] of [...G]) {
    if (G.size < 2 || departsOf(L, S) >= 3) continue;
    const c = { x: L.reduce((s, u) => s + u.x, 0) / L.length, y: L.reduce((s, u) => s + u.y, 0) / L.length };
    const to = [...G.entries()].filter(([k]) => k !== z).sort(([, p], [, q]) => Math.min(...p.map((u) => d2(u, c))) - Math.min(...q.map((u) => d2(u, c))))[0][0];
    G.get(to).push(...L); G.delete(z);
  }
  const out = [];
  for (const [z, L] of G) {
    // une boîte par zone ; plus si la zone dépasse la capacité d'une boîte (parts égales, comme l'Équilibrée)
    const B = placeLevelBalanced(L, tab, S, minBoxes(L, S)) || placeLevel(L, tab, S);
    if (!B) return null;
    const zr = R.filter((r) => Z.get(r.name) === z);
    for (const b of B) {
      // la boîte reste dans sa zone
      if (zr.length && !zr.some((r) => pointInPoly(b.x, b.y, r.poly))) { const r = zr.slice().sort((p, q) => polyDist([b], p.poly) - polyDist([b], q.poly))[0]; const p = labelPoint(r.poly); b.x = p.x; b.y = p.y; }
      out.push({ ...b, zone: z });
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
// v62 : « proximite » s'appelle Économique (le moins de cuivre) ; la clé reste pour les chantiers déjà enregistrés
export const MODES = { proximite: "Économique", equilibre: "Équilibrée", piece: "Par pièce", zone: "Par zone" };
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
    if (mode === "zone") return placeLevelZones(L, tabs[lv] || null, S, rooms[lv]);
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
      }
      // v62 : par pièce = chaque volet dans la boîte de sa pièce (proposé à Kévin, Q-87) : mélangés
    }
    if (apart) {
      const rv = mode === "equilibre" ? voletsBalanced(LV, tabOf(lv), S) : placeLevel(LV, tabOf(lv), S, 4, 0);
      const ro = placeMode(LO, lv, want[lv] ? Math.max(1, want[lv] - (rv || []).length) : 0);
      r = rv && ro ? [...ro, ...rv] : null;
    } else r = placeMode(L, lv, want[lv] || 0);
    if (!r) { issues.push(`Niveau ${lv} : impossible de respecter ${S.departsMax} départs par boîte (sans l'alimentation) et ${S.departsFace} gaines par face (une unité trop grosse ?)`); continue; }
    for (const b of r) { do n++; while (usedIds.has("b" + n)); usedIds.add("b" + n); out.push({ id: "b" + n, n: boxName(n), lv, x: +(Math.round(b.x / 0.05) * 0.05).toFixed(2), y: +(Math.round(b.y / 0.05) * 0.05).toFixed(2), apps: b.units.flatMap((u) => u.ids), ...(b.zone ? { zone: b.zone } : {}) }); }
  }
  out.sort((a, b) => (+String(a.n).replace(/\D/g, "") || 0) - (+String(b.n).replace(/\D/g, "") || 0));
  return { boxes: out, issues, mode };
}
