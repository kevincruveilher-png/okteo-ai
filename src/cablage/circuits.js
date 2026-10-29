// Répartition automatique des appareils en circuits (NF C 15-100), modifiable ensuite à la main.
// - éclairage : les points lumineux (plafonniers, spots, appliques) par « allumage » (les lumières d'une même commande
//   restent ensemble), au plus `maxPoints` points par circuit ; les commandes suivent leurs lumières ;
// - prises 16 A : au plus `maxPrises` par circuit, voisines entre elles (parcours de proche en proche, niveau par niveau) ;
// - spécialisés (prises 20/32 A, sorties de câble, groupe VMC) : un circuit chacun = ligne directe tableau → appareil ;
// - communication (RJ45) : lignes directes vers le coffret de communication (pas de circuit de puissance).
// Entrée : items [{id, t, x, y, lv, lvName, room, rep}], links [{c, l}], réglages (cablage/settings.js).

import { APPAREILS, raccOf, isVolet, sansCvr } from "./appareils.js";

const LIGHT = new Set(["LUM", "SPOT", "APP"]), CMD = new Set(["INT", "VV", "BP"]);
// v54 : appareil en ligne directe protégé par un disjoncteur (type du journal des règles), ligne sans disjoncteur
// (courant faible, équipotentielle principale, commandes, gaine en attente), hotte en boîte (circuit cuisine)
const directBreaker = (a) => APPAREILS[a.t] && raccOf(a) === "direct" && !!APPAREILS[a.t].circuit;
const directNoBreaker = (a) => a.t === "RJ45" || (APPAREILS[a.t] && raccOf(a) === "direct" && !APPAREILS[a.t].circuit);
const hotteBoite = (a) => a.t === "HOTTE" && raccOf(a) === "boite";
// puissance admissible d'un circuit de volets (R-087) : 2 300 W en 10 A, 3 680 W en 16 A (conducteurs 1,5 mm²)
export const maxMoteurs = (S, p = S.puissanceMoteur || 50) => Math.max(1, Math.floor((S.protVolets >= 16 ? 3680 : 2300) / (p || 50)));
// moteurs de volets par circuit : chaque moteur compte sa puissance ; une commande (CVR) suit ses volets
function voletChunks(list, S) {
  const out = []; let cur = null, w = 0;
  const cap = (S.protVolets >= 16 ? 3680 : 2300);
  for (const a of chain(list.filter((x) => x.t !== "CVR"))) {
    const p = +(a.p ?? S.puissanceMoteur ?? 50) || 50;
    if (!cur || w + p > cap) { cur = []; w = 0; out.push(cur); }
    cur.push(a); w += p;
  }
  return out;
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// prise de cuisine : prise 16 A dans une pièce dont le nom contient un des mots du réglage « motsCuisine »
export function isCuisineRoom(a, S) {
  const room = String(a.room || "").toLowerCase();
  return !!room && String(S.motsCuisine ?? "cuisine").split(",").map((w) => w.trim().toLowerCase()).filter(Boolean).some((w) => room.includes(w));
}
// v56 (R-098) : prise de plan de travail = seule prise du circuit cuisine 2,5 (avec la hotte en boîte). Repère porté par
// la prise : a.pt = true / false (choisi à la main), sinon reconnu : prise posée entre 1,00 m et 1,30 m, dans une pièce
// de cuisine OU à moins de 3 m d'un appareil de cuisine (plaque, hotte, four, lave-vaisselle) du même niveau
export const APP_CUISINE = new Set(["PLAQ", "HOTTE", "FOUR", "LV"]);
export function planTravailAuto(a, S, items = []) {
  if (a.t !== "PC16") return false;
  const h = +a.h;
  if (!(h >= (S.ptHmin ?? 100) && h <= (S.ptHmax ?? 130))) return false;
  if (isCuisineRoom(a, S)) return true;
  return items.some((o) => APP_CUISINE.has(o.t) && (o.lv ?? null) === (a.lv ?? null) && Math.hypot(o.x - a.x, o.y - a.y) <= (S.ptDist ?? 3));
}
export function isCuisine(a, S, items = []) {
  if (a.t !== "PC16") return false;
  if (a.pt === true || a.pt === false) return a.pt;
  return planTravailAuto(a, S, items);
}

// ordre de proche en proche (part du coin haut-gauche), pour garder des circuits compacts
function chain(list) {
  if (list.length < 2) return list.slice();
  const rest = list.slice(), out = [];
  rest.sort((a, b) => (a.y + a.x) - (b.y + b.x));
  let cur = rest.shift(); out.push(cur);
  while (rest.length) {
    let bi = 0, bd = Infinity;
    rest.forEach((p, i) => { const d = dist(cur, p); if (d < bd) { bd = d; bi = i; } });
    cur = rest.splice(bi, 1)[0]; out.push(cur);
  }
  return out;
}
const centroid = (L) => ({ x: L.reduce((s, p) => s + p.x, 0) / L.length, y: L.reduce((s, p) => s + p.y, 0) / L.length });

export function computeCircuits(items0, links, S) {
  const items = sansCvr(items0, S);
  const byId = new Map(items.map((a) => [a.id, a]));
  const levels = [...new Set(items.map((a) => a.lv))];
  const lvName = (lv) => (items.find((a) => a.lv === lv) || {}).lvName || lv;
  const circuits = [];
  const add = (kind, label, apps, extra = {}) => circuits.push({ kind, label, apps, ...extra });

  // ---------- éclairage ----------
  // allumages : lumières reliées par une même commande (union-find sur les liaisons)
  // (v56 : la sonnette en boîte suit le circuit éclairage, comme sur la bande MAILLARD du BE)
  const lights = items.filter((a) => LIGHT.has(a.t) || (APPAREILS[a.t] || {}).eclairage);
  const par = new Map(lights.map((a) => [a.id, a.id])), find = (x) => (par.get(x) === x ? x : (par.set(x, find(par.get(x))), par.get(x)));
  const lightsOf = new Map();                                 // commande → lumières
  for (const l of links) { if (!byId.has(l.c) || !byId.has(l.l) || !LIGHT.has(byId.get(l.l).t)) continue; if (!lightsOf.has(l.c)) lightsOf.set(l.c, []); lightsOf.get(l.c).push(l.l); }
  for (const L of lightsOf.values()) for (let i = 1; i < L.length; i++) par.set(find(L[i]), find(L[0]));
  const groups = new Map(); lights.forEach((a) => { const r = find(a.id); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(a); });
  const lightCircuitOf = new Map();
  for (const lv of levels) {
    const gs = [...groups.values()].filter((g) => g[0].lv === lv).map((g) => ({ g, ...centroid(g) }));
    let cur = null; const mine = [];
    for (const G of chain(gs)) {
      for (const part of split(G.g, S.maxPoints)) {
        if (!cur || cur.apps.length + part.length > S.maxPoints) { cur = { kind: "eclairage", apps: [], parts: [], section: S.secEclairage, prot: S.protEclairage }; mine.push(cur); }
        cur.apps.push(...part.map((a) => a.id)); cur.parts.push(part);
      }
    }
    // dernier circuit presque vide : ses allumages vont dans les circuits voisins qui ont de la place
    for (let ci = mine.length - 1; ci > 0; ci--) {
      const c = mine[ci]; if (c.apps.length > S.maxPoints / 3) continue;
      const moves = c.parts.map((part) => { const m = centroid(part); return mine.filter((o) => o !== c).sort((p, q) => dist(centroid(p.parts.flat()), m) - dist(centroid(q.parts.flat()), m)).find((o) => o.apps.length + part.length <= S.maxPoints); });
      if (moves.some((o) => !o)) continue;
      c.parts.forEach((part, i) => { moves[i].parts.push(part); moves[i].apps.push(...part.map((a) => a.id)); });
      mine.splice(ci, 1);
    }
    mine.forEach((c, i) => { c.label = `Éclairage ${lvName(lv)} ${i + 1}`; c.parts.flat().forEach((a) => lightCircuitOf.set(a.id, c)); delete c.parts; circuits.push(c); });
  }
  // commandes : dans le circuit de leurs lumières, sinon celui de la lumière la plus proche du même niveau
  for (const c of items.filter((a) => CMD.has(a.t))) {
    const L = (lightsOf.get(c.id) || []).map((id) => lightCircuitOf.get(id)).filter(Boolean);
    let target = L[0];
    if (!target) {
      const near = lights.filter((l) => l.lv === c.lv).sort((p, q) => dist(p, c) - dist(q, c))[0] || lights[0];
      target = near && lightCircuitOf.get(near.id);
    }
    if (target) target.apps.push(c.id);
  }
  // ---------- prises 16 A (cuisine à part : 2,5 mm², 6 max) ----------
  for (const lv of levels) {
    const P = chain(items.filter((a) => a.t === "PC16" && a.lv === lv && !isCuisine(a, S, items)));
    let k = 0;
    for (let i = 0; i < P.length; i += S.maxPrises) add("prises", `Prises ${lvName(lv)} ${++k}`, P.slice(i, i + S.maxPrises).map((a) => a.id), { section: S.secPrises, prot: S.protPrises });
    const Q = chain(items.filter((a) => a.lv === lv && ((a.t === "PC16" && isCuisine(a, S, items)) || hotteBoite(a)))), mc = S.maxPrisesCuisine || 6;
    k = 0;
    for (let i = 0; i < Q.length; i += mc) add("cuisine", `Prises cuisine ${lvName(lv)}${Q.length > mc ? " " + ++k : ""}`, Q.slice(i, i + mc).map((a) => a.id), { section: S.secCuisine || 2.5, prot: S.protCuisine || 20 });
  }
  // ---------- spécialisés : un circuit chacun, ligne directe ----------
  const spec = items.filter((a) => a.t === "PC20" || (a.t === "SC" && S.scSpecialise) || (a.t === "VMC" && S.vmcCablee) || directBreaker(a));
  for (const a of spec) {
    const D = APPAREILS[a.t];
    const what = D ? D.n : a.t === "PC20" ? "Prise spécialisée" : a.t === "SC" ? "Sortie de câble" : "VMC";
    add("specialise", `${what} ${a.rep || ""} · ${a.room || lvName(a.lv)}`.replace(/\s+/g, " ").trim(), [a.id], { section: D ? D.circuit.section : S.secSpecialise, prot: D ? D.circuit.prot : S.protSpecialise, direct: true });
  }
  // ---------- volets roulants (v54, R-079, R-087) : circuit dédié, puissance admissible ----------
  for (const lv of levels) {
    const V = items.filter((a) => a.lv === lv && isVolet(a.t));
    voletChunks(V, S).forEach((part, i, all) => {
      const ids = new Set(part.map((a) => a.id));
      // les commandes (CVR) suivent leurs volets
      V.filter((c) => c.t === "CVR" && links.some((l) => l.c === c.id && ids.has(l.l))).forEach((c) => ids.add(c.id));
      add("volets", `Volets roulants ${lvName(lv)}${all.length > 1 ? " " + (i + 1) : ""}`, [...ids], { section: S.secVolets || 1.5, prot: S.protVolets || 10 });
    });
    // commandes de volet sans volet relié : avec le 1er circuit de volets du niveau
    const lone = V.filter((c) => c.t === "CVR" && !circuits.some((x) => x.apps.includes(c.id)));
    if (lone.length) { const host = circuits.find((x) => x.kind === "volets" && byId.get(x.apps[0])?.lv === lv); if (host) host.apps.push(...lone.map((a) => a.id)); else add("volets", `Volets roulants ${lvName(lv)}`, lone.map((a) => a.id), { section: S.secVolets || 1.5, prot: S.protVolets || 10 }); }
  }
  // sorties de câble non spécialisées : avec les prises voisines (ou un circuit à part)
  if (!S.scSpecialise) for (const a of items.filter((x) => x.t === "SC")) {
    const host = circuits.filter((c) => c.kind === "prises" && c.apps.length < S.maxPrises && byId.get(c.apps[0]).lv === a.lv).sort((p, q) => dist(byId.get(p.apps[0]), a) - dist(byId.get(q.apps[0]), a))[0];
    if (host) host.apps.push(a.id); else add("prises", `Sortie de câble ${a.rep || ""}`.trim(), [a.id], { section: S.secPrises, prot: S.protPrises });
  }
  // ---------- communication ----------
  const com = items.filter(directNoBreaker);
  if (com.length) add("comm", "Courant faible et lignes sans disjoncteur", com.map((a) => a.id), { section: null, prot: null, direct: true });

  // numéros : C1, C2… dans l'ordre éclairage, prises, spécialisés ; COM à part
  let n = 0;
  return circuits.map((c, i) => ({ id: "c" + (i + 1), n: c.kind === "comm" ? "COM" : "C" + (++n), section: null, prot: null, direct: false, ...c }));
}

// un allumage plus grand que la limite est coupé en morceaux voisins
function split(list, max) {
  if (list.length <= max) return [list];
  const L = chain(list), out = [];
  for (let i = 0; i < L.length; i += max) out.push(L.slice(i, i + max));
  return out;
}

// contrôles : circuits trop chargés, appareils sans circuit
export function checkCircuits(circuits, items, S) {
  const inC = new Set(circuits.flatMap((c) => c.apps));
  const typeOf = new Map(items.map((a) => [a.id, a.t]));
  const issues = [];
  for (const c of circuits) {
    const n = c.apps.filter((id) => LIGHT.has(typeOf.get(id))).length, p = c.apps.filter((id) => typeOf.get(id) === "PC16").length;
    if (c.kind === "eclairage" && n > S.maxPoints) issues.push({ c: c.id, msg: `${c.n} : ${n} points lumineux (max ${S.maxPoints})` });
    if (c.kind === "prises" && p > S.maxPrises) issues.push({ c: c.id, msg: `${c.n} : ${p} prises (max ${S.maxPrises})` });
    if (c.kind === "cuisine" && p > (S.maxPrisesCuisine || 6)) issues.push({ c: c.id, msg: `${c.n} : ${p} prises de cuisine (max ${S.maxPrisesCuisine || 6})` });
    if (c.kind === "specialise" && c.apps.length > 1) issues.push({ c: c.id, msg: `${c.n} : circuit spécialisé avec ${c.apps.length} appareils` });
    if (c.kind === "volets") { const P = c.apps.map((id) => items.find((a) => a.id === id)).filter((a) => a && a.t !== "CVR").reduce((s2, a) => s2 + (+(a.p ?? S.puissanceMoteur ?? 50) || 50), 0), cap = (c.prot >= 16 ? 3680 : 2300); if (P > cap) issues.push({ c: c.id, msg: `${c.n} : ${P} W de moteurs de volets (max ${cap} W en ${c.prot} A)` }); }
  }
  const need = (a) => !["TAB", "EQL", "VEX", "VREJ"].includes(a.t) && !(a.t === "VMC" && !S.vmcCablee) && !(a.t === "HOTTE" && raccOf(a) === "a_choisir");
  const orphans = items.filter((a) => need(a) && !inC.has(a.id)).map((a) => a.id);
  return { issues, orphans };
}

// v38 — les circuits suivent les boîtes (règle KiTéOHM) : dans chaque boîte, un circuit éclairage (rouge/bleu), un
// circuit prises (gris/bleu foncé) et un circuit prises de cuisine (2,5 mm²) s'il y en a ; un circuit de plus seulement
// au-delà des limites de la norme. Les allumages restent entiers, et les commandes posées au même endroit restent sur
// le même circuit (phase commune). Ce qui n'est dans aucune boîte (lignes directes, RJ45, appareils sans boîte) :
// répartition habituelle (computeCircuits). Numéros : C1, C2… boîte par boîte (éclairage, prises, cuisine), puis le reste.
export function circuitsByBox(items0, links, boxes, S) {
  const items = sansCvr(items0, S);
  const byId = new Map(items.map((a) => [a.id, a]));
  const direct = (a) => a.t === "PC20" || a.t === "RJ45" || (a.t === "SC" && S.scSpecialise) || a.t === "VMC" || a.t === "TAB" || directBreaker(a) || directNoBreaker(a) || (a.t === "HOTTE" && !hotteBoite(a));
  const near = S.memeEndroit ?? 0.3;
  const out = [], inBoxes = new Set();
  const sorted = boxes.slice().sort((p, q) => String(p.n).localeCompare(String(q.n), "fr", { numeric: true }));
  for (const b of sorted) {
    const apps = b.apps.map((id) => byId.get(id)).filter((a) => a && !direct(a));
    apps.forEach((a) => inBoxes.add(a.id));
    const ids = new Set(apps.map((a) => a.id));
    // éclairage : allumages (lumières + commandes reliées), fusionnés si leurs commandes sont au même endroit
    const par = new Map(), find = (x) => { if (!par.has(x)) par.set(x, x); return par.get(x) === x ? x : (par.set(x, find(par.get(x))), par.get(x)); };
    const LC = apps.filter((a) => LIGHT.has(a.t) || CMD.has(a.t) || (APPAREILS[a.t] || {}).eclairage);
    for (const l of links) if (ids.has(l.c) && ids.has(l.l)) par.set(find(l.c), find(l.l));
    const cm = LC.filter((a) => CMD.has(a.t));
    for (let i = 0; i < cm.length; i++) for (let j = i + 1; j < cm.length; j++) if (cm[i].lv === cm[j].lv && dist(cm[i], cm[j]) <= near + 1e-9) par.set(find(cm[i].id), find(cm[j].id));
    const groups = new Map(); LC.forEach((a) => { const r = find(a.id); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(a); });
    const lightCirc = [];
    let cur = null;
    for (const g of [...groups.values()].sort((p, q) => q.filter((a) => LIGHT.has(a.t)).length - p.filter((a) => LIGHT.has(a.t)).length)) {
      const nL = g.filter((a) => LIGHT.has(a.t)).length;
      cur = lightCirc.find((c) => c.nL + nL <= S.maxPoints) || null;
      if (!cur) { cur = { kind: "eclairage", apps: [], nL: 0, section: S.secEclairage, prot: S.protEclairage }; lightCirc.push(cur); }
      cur.apps.push(...g.map((a) => a.id)); cur.nL += nL;
    }
    lightCirc.forEach((c, i) => { delete c.nL; c.label = `Éclairage ${b.n}${lightCirc.length > 1 ? " · " + (i + 1) : ""}`; c.box = b.id; out.push(c); });
    // prises : par paquets de la limite de la norme ; cuisine à part
    // au-delà de la limite : circuits à parts égales (9 prises → 5 + 4, pas 8 + 1)
    const chunk = (L, max, kind, lab, sec, prot) => { const sz = Math.ceil(L.length / Math.max(1, Math.ceil(L.length / max))); for (let i = 0, k = 0; i < L.length; i += sz) out.push({ kind, label: `${lab} ${b.n}${L.length > max ? " · " + ++k : ""}`, apps: L.slice(i, i + sz).map((a) => a.id), section: sec, prot, box: b.id }); };
    const P = chain(apps.filter((a) => (a.t === "PC16" && !isCuisine(a, S, items)) || (a.t === "SC" && !S.scSpecialise)));
    chunk(P, S.maxPrises, "prises", "Prises", S.secPrises, S.protPrises);
    const Q = chain(apps.filter((a) => (a.t === "PC16" && isCuisine(a, S, items)) || hotteBoite(a)));
    chunk(Q, S.maxPrisesCuisine || 6, "cuisine", "Prises cuisine", S.secCuisine || 2.5, S.protCuisine || 20);
    // volets roulants de la boîte : circuit dédié (R-079), coupé selon la puissance admissible (R-087)
    const V = apps.filter((a) => isVolet(a.t));
    voletChunks(V, S).forEach((part, i, all) => {
      const ids = new Set(part.map((a) => a.id));
      V.filter((c) => c.t === "CVR" && links.some((l) => l.c === c.id && ids.has(l.l))).forEach((c) => ids.add(c.id));
      out.push({ kind: "volets", label: `Volets roulants ${b.n}${all.length > 1 ? " · " + (i + 1) : ""}`, apps: [...ids], section: S.secVolets || 1.5, prot: S.protVolets || 10, box: b.id });
    });
    const loneC = V.filter((c) => c.t === "CVR" && !out.some((x) => x.box === b.id && x.apps.includes(c.id)));
    if (loneC.length) { const host = out.find((x) => x.box === b.id && x.kind === "volets"); if (host) host.apps.push(...loneC.map((a) => a.id)); else out.push({ kind: "volets", label: `Volets roulants ${b.n}`, apps: loneC.map((a) => a.id), section: S.secVolets || 1.5, prot: S.protVolets || 10, box: b.id }); }
  }
  const rest = computeCircuits(items.filter((a) => !inBoxes.has(a.id)), links, S);
  let n = 0;
  return [...out, ...rest.map(({ id, n: _n, ...c }) => c)].map((c, i) => ({ id: "c" + (i + 1), n: c.kind === "comm" ? "COM" : "C" + (++n), section: null, prot: null, direct: false, ...c }));
}
