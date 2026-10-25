// Répartition automatique des appareils en circuits (NF C 15-100), modifiable ensuite à la main.
// - éclairage : les points lumineux (plafonniers, spots, appliques) par « allumage » (les lumières d'une même commande
//   restent ensemble), au plus `maxPoints` points par circuit ; les commandes suivent leurs lumières ;
// - prises 16 A : au plus `maxPrises` par circuit, voisines entre elles (parcours de proche en proche, niveau par niveau) ;
// - spécialisés (prises 20/32 A, sorties de câble, groupe VMC) : un circuit chacun = ligne directe tableau → appareil ;
// - communication (RJ45) : lignes directes vers le coffret de communication (pas de circuit de puissance).
// Entrée : items [{id, t, x, y, lv, lvName, room, rep}], links [{c, l}], réglages (cablage/settings.js).

const LIGHT = new Set(["LUM", "SPOT", "APP"]), CMD = new Set(["INT", "VV", "BP"]);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

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

export function computeCircuits(items, links, S) {
  const byId = new Map(items.map((a) => [a.id, a]));
  const levels = [...new Set(items.map((a) => a.lv))];
  const lvName = (lv) => (items.find((a) => a.lv === lv) || {}).lvName || lv;
  const circuits = [];
  const add = (kind, label, apps, extra = {}) => circuits.push({ kind, label, apps, ...extra });

  // ---------- éclairage ----------
  // allumages : lumières reliées par une même commande (union-find sur les liaisons)
  const lights = items.filter((a) => LIGHT.has(a.t));
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
  // ---------- prises 16 A ----------
  for (const lv of levels) {
    const P = chain(items.filter((a) => a.t === "PC16" && a.lv === lv));
    let k = 0;
    for (let i = 0; i < P.length; i += S.maxPrises) add("prises", `Prises ${lvName(lv)} ${++k}`, P.slice(i, i + S.maxPrises).map((a) => a.id), { section: S.secPrises, prot: S.protPrises });
  }
  // ---------- spécialisés : un circuit chacun, ligne directe ----------
  const spec = items.filter((a) => a.t === "PC20" || (a.t === "SC" && S.scSpecialise) || (a.t === "VMC" && S.vmcCablee));
  for (const a of spec) {
    const what = a.t === "PC20" ? "Prise spécialisée" : a.t === "SC" ? "Sortie de câble" : "VMC";
    add("specialise", `${what} ${a.rep || ""} · ${a.room || lvName(a.lv)}`.replace(/\s+/g, " ").trim(), [a.id], { section: S.secSpecialise, prot: S.protSpecialise, direct: true });
  }
  // sorties de câble non spécialisées : avec les prises voisines (ou un circuit à part)
  if (!S.scSpecialise) for (const a of items.filter((x) => x.t === "SC")) {
    const host = circuits.filter((c) => c.kind === "prises" && c.apps.length < S.maxPrises && byId.get(c.apps[0]).lv === a.lv).sort((p, q) => dist(byId.get(p.apps[0]), a) - dist(byId.get(q.apps[0]), a))[0];
    if (host) host.apps.push(a.id); else add("prises", `Sortie de câble ${a.rep || ""}`.trim(), [a.id], { section: S.secPrises, prot: S.protPrises });
  }
  // ---------- communication ----------
  const com = items.filter((a) => a.t === "RJ45");
  if (com.length) add("comm", "Communication (RJ45)", com.map((a) => a.id), { section: null, prot: null, direct: true });

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
    if (c.kind === "specialise" && c.apps.length > 1) issues.push({ c: c.id, msg: `${c.n} : circuit spécialisé avec ${c.apps.length} appareils` });
  }
  const need = (t) => !["TAB"].includes(t) && !(t === "VMC" && !S.vmcCablee);
  const orphans = items.filter((a) => need(a.t) && !inC.has(a.id)).map((a) => a.id);
  return { issues, orphans };
}
