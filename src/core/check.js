// Contrôle permanent du plan (v43) et mode essai (v45).
// - controlIssues() : ce qui ne va pas, sur tous les niveaux (calcul léger, refait à chaque dessin) :
//   commande sans lumière, lumière sans commande, va-et-vient incomplet, appareil sans circuit (quand des circuits
//   existent), commande et lumière dans deux boîtes (allumage coupé).
// - essai : état des commandes (interrupteurs, va-et-vient : inversion), télérupteurs (bouton-poussoir), disjoncteurs ;
//   lampLit(id) dit si une lumière est allumée ; essaiPress(id) actionne une commande (ou la commande d'une lumière).
// - testAll() : actionne chaque commande et liste celles qui n'allument rien ou qui allument une lumière d'un autre circuit.
import { K } from "./k.js";
import { TYPES } from "./model.js";
import { appIndex, allLinks } from "./levels.js";
import { linkRole } from "./attach.js";
import { circuitMap } from "./render.js";

export const CHECK_KINDS = {
  cmd: "Commande sans lumière",
  lum: "Lumière sans commande",
  vv: "Va-et-vient incomplet",
  int2: "Deux interrupteurs sur la même lumière",
  nobox: "Appareil dans aucune boîte",
  circ: "Appareil sans circuit",
  split: "Commande et lumière dans deux boîtes",
};

// tables commande → lumières et lumière → commandes (tous niveaux, liaisons dont les deux bouts existent)
// v45.1 : seule une vraie commande (interrupteur, va-et-vient, poussoir) commande ; une lumière reliée à une autre
// lumière (relevé du plan : lumières en chaîne) reçoit les commandes de celle-ci ; une lumière reliée seulement à
// d'autres lumières sans commande reste « sans commande ».
export function linkTables(idx = appIndex()) {
  const lights = new Map(), cmds = new Map(), adj = new Map();
  const add = (m, k, v) => { if (!m.has(k)) m.set(k, []); if (!m.get(k).includes(v)) m.get(k).push(v); };
  for (const l of allLinks()) {
    if (!idx.has(l.c) || !idx.has(l.l)) continue;
    const rc = linkRole(idx.get(l.c).a.t), rl = linkRole(idx.get(l.l).a.t);
    if (rc === "c" && rl === "l") { add(lights, l.c, l.l); add(cmds, l.l, l.c); }
    else if (rc === "l" && rl === "l") { add(adj, l.c, l.l); add(adj, l.l, l.c); }
    else if (rc === "l" && rl === "c") { add(lights, l.l, l.c); add(cmds, l.c, l.l); }
  }
  // chaînes de lumières : chaque commande atteint toutes les lumières de la chaîne
  if (adj.size) for (const [c, ls] of [...lights]) {
    const seen = new Set(ls), todo = [...ls];
    while (todo.length) for (const n of adj.get(todo.pop()) || []) if (!seen.has(n)) { seen.add(n); todo.push(n); add(lights, c, n); add(cmds, n, c); }
  }
  return { lights, cmds };
}

export function controlIssues() {
  const idx = appIndex(), { lights, cmds } = linkTables(idx), out = [];
  for (const [id, { lv, a }] of idx) {
    const r = linkRole(a.t);
    if (r === "c" && !lights.has(id)) out.push({ kind: "cmd", ids: [id], lv });
    // un volet sans commande filaire est un volet connecté (micromodule, R-096) : normal
    else if (r === "l" && !cmds.has(id) && a.t !== "VR" && a.t !== "VEL") out.push({ kind: "lum", ids: [id], lv });
  }
  // va-et-vient : une lumière commandée par un seul va-et-vient (il en faut deux, ou un va-et-vient et des permutateurs)
  const seen = new Set();
  for (const [lid, cs] of cmds) {
    const vv = cs.filter((c) => idx.get(c).a.t === "VV");
    if (vv.length === 1 && !seen.has(vv[0])) { seen.add(vv[0]); out.push({ kind: "vv", ids: [vv[0], lid], lv: idx.get(vv[0]).lv }); }
  }
  // deux interrupteurs simples (ou un simple et un va-et-vient) sur la même lumière : il faut des va-et-vient
  for (const [lid, cs] of cmds) {
    const ints = cs.filter((c) => idx.get(c).a.t === "INT"), vvs = cs.filter((c) => idx.get(c).a.t === "VV");
    if (ints.length >= 2 || (ints.length >= 1 && vvs.length >= 1)) out.push({ kind: "int2", ids: [...ints, ...vvs, lid], lv: idx.get(ints[0]).lv });
  }
  // appareils sans circuit : seulement quand la répartition en circuits a été faite
  if ((K.CAB.circuits || []).length) {
    const cm = circuitMap();
    for (const [id, { lv, a }] of idx) if (cm.__need(a) && !cm.__direct(a) && !cm[id]) out.push({ kind: "circ", ids: [id], lv });
  }
  // allumage coupé : la commande et sa lumière dans deux boîtes différentes
  const B = K.CAB.boxes || [];
  if (B.length) {
    const boxOf = new Map();
    B.forEach((b) => (b.apps || []).forEach((id) => boxOf.set(id, b)));
    // appareil raccordé à rien : des boîtes existent sur son niveau, mais il n'est dans aucune (pas de gaine)
    const cm = circuitMap(), lvBox = new Set(B.map((b) => b.lv)), direct = new Set();
    (K.CAB.circuits || []).forEach((c) => { if (["specialise", "comm"].includes(c.kind)) (c.apps || []).forEach((id) => direct.add(id)); });
    for (const [id, { lv, a }] of idx) if (lvBox.has(lv) && cm.__need(a) && !cm.__direct(a) && !direct.has(id) && !boxOf.has(id)) out.push({ kind: "nobox", ids: [id], lv });
    const done = new Set();
    for (const [c, ls] of lights) for (const l of ls) {
      const bc = boxOf.get(c), bl = boxOf.get(l);
      if (bc && bl && bc !== bl && !done.has(c + "|" + l)) { done.add(c + "|" + l); out.push({ kind: "split", ids: [c, l], lv: idx.get(c).lv, boxes: [bc.n, bl.n] }); }
    }
  }
  return out;
}

// ---------- mode essai ----------
export function essai() {
  if (!K.essai) K.essai = { sw: {}, tl: {}, off: [] };
  return K.essai;
}
export function essaiReset() { K.essai = { sw: {}, tl: {}, off: essai().off }; }
const circOf = (cm, id) => (cm[id] ? cm[id].n : null);

// une lumière est allumée si ses commandes la mettent sous tension (inversion à chaque va-et-vient / interrupteur,
// état du télérupteur pour les boutons-poussoirs) et si son circuit n'est pas coupé au disjoncteur
export function lampLit(lid, T = linkTables(), cm = circuitMap(), idx = appIndex()) {
  const cs = T.cmds.get(lid);
  if (!cs || !cs.length) return false;
  const E = essai();
  let on = 0;
  const bp = cs.some((c) => idx.get(c).a.t === "BP");
  cs.forEach((c) => { if (idx.get(c).a.t !== "BP") on ^= E.sw[c] ? 1 : 0; });
  if (bp) on ^= E.tl[lid] ? 1 : 0;
  const n = circOf(cm, lid);
  if (n && E.off.includes(n)) return false;
  return !!on;
}
export function litSet() {
  const T = linkTables(), cm = circuitMap(), idx = appIndex(), s = new Set();
  for (const lid of T.cmds.keys()) if (lampLit(lid, T, cm, idx)) s.add(lid);
  return s;
}
// actionner : une commande inverse son état (poussoir : inverse le télérupteur de ses lumières) ;
// une lumière actionne sa première commande. Renvoie l'id de la commande actionnée (ou null).
export function essaiPress(id) {
  const idx = appIndex(), it = idx.get(id);
  if (!it) return null;
  const T = linkTables(idx), E = essai();
  let c = id;
  if (linkRole(it.a.t) === "l") {
    const cs = T.cmds.get(id) || [];
    c = cs.find((k) => idx.get(k).a.t !== "BP") || cs[0];
    if (!c) return null;
  } else if (linkRole(it.a.t) !== "c") return null;
  if (idx.get(c).a.t === "BP") (T.lights.get(c) || []).forEach((l) => (E.tl[l] = E.tl[l] ? 0 : 1));
  else E.sw[c] = E.sw[c] ? 0 : 1;
  return c;
}
export function setBreaker(n, on) {
  const E = essai();
  E.off = E.off.filter((x) => x !== n);
  if (!on) E.off.push(n);
}

// tester tout : chaque commande actionnée seule ; ce qui ne s'allume pas ou n'est pas sur le circuit de la commande
export function testAll() {
  const idx = appIndex(), T = linkTables(idx), cm = circuitMap(), out = [], save = K.essai;
  const hasCirc = (K.CAB.circuits || []).length > 0;
  for (const [id, { lv, a }] of idx) {
    if (linkRole(a.t) !== "c") continue;
    const ls = T.lights.get(id) || [];
    if (!ls.length) { out.push({ kind: "rien", ids: [id], lv, text: "n'allume rien (aucune lumière reliée)" }); continue; }
    K.essai = { sw: {}, tl: {}, off: [] };
    essaiPress(id);
    const dead = ls.filter((l) => !lampLit(l, T, cm, idx));
    if (dead.length) out.push({ kind: "eteinte", ids: [id, ...dead], lv, text: `${dead.length} lumière(s) ne s'allume(nt) pas` });
    if (hasCirc) {
      const cc = circOf(cm, id), other = ls.filter((l) => circOf(cm, l) && cc && circOf(cm, l) !== cc);
      if (other.length) out.push({ kind: "autre", ids: [id, ...other], lv, text: `allume une lumière d'un autre circuit (${cc} → ${[...new Set(other.map((l) => circOf(cm, l)))].join(", ")})` });
    }
    if (a.t === "VV" && ls.every((l) => (T.cmds.get(l) || []).filter((c) => idx.get(c).a.t === "VV").length === 1))
      out.push({ kind: "vv", ids: [id, ...ls], lv, text: "va-et-vient seul : il manque le second" });
    if (a.t === "INT") {
      const twin = ls.filter((l) => (T.cmds.get(l) || []).some((c) => c !== id && ["INT", "VV"].includes(idx.get(c).a.t)));
      if (twin.length) out.push({ kind: "int2", ids: [id, ...twin], lv, text: "interrupteur simple sur une lumière qui a une autre commande : il faut des va-et-vient" });
    }
  }
  K.essai = save;
  return { tested: [...idx.values()].filter(({ a }) => linkRole(a.t) === "c").length, issues: out };
}

export const typeName = (t) => (TYPES[t] ? TYPES[t].n : t);
