// Étude d'une maison (v53, journal des règles section 3 et 3 ter) — pur, sans DOM.
// - précontrôle : les règles dont le chantier a besoin et leur certitude ; une règle inconnue et bloquante (ou absente)
//   empêche de câbler (« le logiciel ne devine jamais ») ; une règle supposée est appliquée, son résultat « à vérifier » ;
// - trace en 9 étapes : chaque décision a un état — appliqué (règle confirmée), supposé, doute, bloqué, corrigé à la main —
//   et les alternatives étudiées (modes de pieuvre) ont un score : longueur totale de gaine, puis boîtes, puis départs (Q-77) ;
// - « Où ça coince » : doutes, blocages, supposés et corrections, du plus grave au moins grave ;
// - « Pourquoi ? » : la chaîne de règles qui a produit une boîte, une gaine ou un fil ;
// - statistiques par règle (applications, doutes, blocages, corrections).
import { ruleById } from "./regles.js";

export const STEPS = [
  { n: 1, id: "lecture", title: "Lecture du plan", rules: ["R-084", "R-086"] },
  { n: 2, id: "mode", title: "Mode de pieuvre", rules: ["R-085", "R-094", "R-009"] },
  { n: 3, id: "boites", title: "Placement des boîtes", rules: ["R-001", "R-088", "R-004", "R-005", "R-006", "R-008"] },
  { n: 4, id: "circuits", title: "Répartition des circuits", rules: ["R-007", "R-020", "R-021", "R-022", "R-081", "R-079", "R-087"] },
  { n: 5, id: "allumages", title: "Allumages", rules: ["R-002", "R-040", "R-041", "R-070", "R-071", "R-072", "R-093", "R-096"] },
  { n: 6, id: "gaines", title: "Gaines", rules: ["R-010", "R-011", "R-073", "R-074", "R-075", "R-077", "R-078", "R-014", "R-095", "R-089", "R-060", "R-003", "R-080", "R-082", "R-097"] },
  { n: 7, id: "raccordements", title: "Raccordements", rules: ["R-030", "R-031", "R-090", "R-092"] },
  { n: 8, id: "tableau", title: "Tableau", rules: ["R-050", "R-081"] },
  { n: 9, id: "controle", title: "Contrôle", rules: ["R-091"] },
];
// états, du plus grave au moins grave
export const ETATS = { bloque: { s: "✕", t: "bloqué" }, doute: { s: "?", t: "doute" }, suppose: { s: "◐", t: "supposé" }, corrige: { s: "✎", t: "corrigé à la main" }, applique: { s: "✓", t: "appliqué" } };
const GRAV = ["bloque", "doute", "suppose", "corrige", "applique"];
const worst = (L) => GRAV.find((g) => L.includes(g)) || "applique";
export const stepOfRule = (id) => (STEPS.find((s) => s.rules.includes(id)) || STEPS[8]).n;

// règles utiles à ce chantier (certaines seulement si le cas existe : télérupteur, va-et-vient, câble extérieur…)
const WHEN = {
  "R-009": (c) => c.mode === "plug", "R-094": (c) => c.volets, "R-085": (c) => c.prises > 8, "R-093": (c) => c.tl, "R-071": (c) => c.vv,
  "R-014": (c) => c.ext, "R-095": (c) => c.ext, "R-079": (c) => c.volets, "R-087": (c) => c.volets, "R-096": (c) => c.volets,
  "R-086": (c) => c.hotte, "R-080": (c) => c.eql, "R-082": (c) => c.direct, "R-097": (c) => c.aig, "R-022": (c) => c.cuisine, "R-050": (c) => c.circuits > 0, "R-081": (c) => c.circuits > 0,
};
export function neededRules(ctx) { return [...new Set(STEPS.flatMap((s) => s.rules))].filter((id) => !WHEN[id] || WHEN[id](ctx)); }

// précontrôle → { rules: [{id, titre, certitude, si_doute, etat, step}], bloquants, supposees, ok }
export function precontrole(J, ctx) {
  const rules = neededRules(ctx).map((id) => {
    const r = ruleById(J, id);
    if (!r || r.statut === "archivee" || r.statut === "desactivee") return { id, titre: r ? r.titre : "règle absente du journal", certitude: "inconnue", si_doute: "bloquer", etat: "bloque", step: stepOfRule(id) };
    const etat = r.certitude === "confirmee" ? "applique" : r.certitude === "inconnue" && r.si_doute === "bloquer" ? "bloque" : "suppose";
    return { id, titre: r.titre, certitude: r.certitude, si_doute: r.si_doute, etat, step: stepOfRule(id) };
  }).sort((a, b) => a.step - b.step || a.id.localeCompare(b.id));
  const bloquants = rules.filter((r) => r.etat === "bloque"), supposees = rules.filter((r) => r.etat === "suppose");
  return { rules, bloquants, supposees, ok: !bloquants.length };
}

// score d'une solution (Q-77) et comparaison : longueur totale de gaine, puis boîtes, puis départs
export function scoreOf(W) {
  return { gaine: +W.totals.gaine.toFixed(1), boites: W.boxes.length, departs: W.boxes.reduce((s, b) => s + b.gaines.filter((g) => g.kind === "app").length, 0) };
}
export const cmpScore = (a, b) => a.gaine - b.gaine || a.boites - b.boites || a.departs - b.departs;

// contexte du chantier pour le précontrôle
export function contextOf({ items, links, circuits, boxes, mode, W }) {
  const LIGHT = new Set(["LUM", "SPOT", "APP"]), CMD = new Set(["INT", "VV", "BP"]);
  const by = new Map(items.map((a) => [a.id, a]));
  const cmdsOf = new Map(); links.forEach((l) => { if (LIGHT.has(by.get(l.l)?.t) && CMD.has(by.get(l.c)?.t)) { if (!cmdsOf.has(l.l)) cmdsOf.set(l.l, new Set()); cmdsOf.get(l.l).add(l.c); } });
  const nC = [...cmdsOf.values()].map((s) => s.size);
  const prisesBox = (boxes || []).map((b) => b.apps.filter((id) => by.get(id)?.t === "PC16").length);
  return {
    mode, volets: items.some((a) => a.t === "VR" || a.t === "VEL"), hotte: items.some((a) => a.t === "HOTTE"), eql: items.some((a) => a.t === "EQL"),
    aig: items.some((a) => a.t === "AIG"), direct: (circuits || []).some((c) => c.direct), ext: items.some((a) => a.ext) || (W ? W.boxes.some((b) => b.gaines.some((g) => g.cable)) : false),
    tl: items.some((a) => a.t === "BP") || nC.some((n) => n >= 3), vv: nC.some((n) => n === 2) || items.some((a) => a.t === "VV"),
    cuisine: (circuits || []).some((c) => c.kind === "cuisine"), prises: Math.max(0, ...prisesBox), circuits: (circuits || []).length,
  };
}

// trace de l'étude. in = { J, ctx, items, circuits, boxes (enregistrées), W, chk ({issues, orphans}), ctl ([{kind, ids}]),
// alternatives ([{mode, name, W}]), mode, chantier, date }
export function buildTrace(inp) {
  const { J, ctx, items, circuits = [], boxes = [], W, chk = { issues: [], orphans: [] }, ctl = [], alternatives = [], mode, chantier = "", date = new Date().toISOString() } = inp;
  const pc = precontrole(J, ctx), by = new Map(items.map((a) => [a.id, a]));
  const steps = STEPS.map((s) => ({ n: s.n, id: s.id, title: s.title, decisions: [] }));
  const add = (n, d) => steps[n - 1].decisions.push(d);
  // règles appliquées (✓ confirmée, ◐ supposée), comptées sur les objets concernés
  const G = W ? W.boxes.flatMap((b) => b.gaines) : [];
  const count = { "R-001": W ? W.boxes.length : 0, "R-074": G.length, "R-011": G.length, "R-077": G.length, "R-073": G.filter((g) => (g.appIds || []).length > 1).length,
    "R-095": G.filter((g) => g.bouchon).length, "R-014": G.filter((g) => g.cable).length, "R-072": G.filter((g) => g.rules && g.rules.ronde).length,
    "R-075": W ? W.boxes.length : 0, "R-031": W ? W.boxes.reduce((s, b) => s + b.nets.length, 0) : 0, "R-081": circuits.length };
  for (const r of pc.rules) add(r.step, { rule: r.id, state: r.etat, text: `${r.titre}${count[r.id] != null ? ` — ${count[r.id]} objet${count[r.id] > 1 ? "s" : ""}` : ""}${r.etat === "suppose" ? " (règle à confirmer : résultat à vérifier)" : r.etat === "bloque" ? " (règle inconnue : point bloqué)" : ""}` });
  // 1. lecture du plan
  const nApp = items.filter((a) => a.t !== "TAB").length;
  add(1, { rule: null, state: items.some((a) => a.t === "TAB") ? "applique" : "doute", text: `${nApp} appareils, ${new Set(items.map((a) => a.room).filter(Boolean)).size} pièces${items.some((a) => a.t === "TAB") ? "" : " — pas de tableau sur le plan : alimentations et lignes directes sans longueur"}`, question: items.some((a) => a.t === "TAB") ? null : "Poser le tableau sur le plan" });
  const KIND = { cmd: ["R-070", "commande sans lumière"], lum: ["R-070", "lumière sans commande"], vv: ["R-071", "va-et-vient incomplet"], int2: ["R-071", "deux interrupteurs simples sur la même lumière (va-et-vient ?)"], circ: ["R-007", "appareil sans circuit"], split: ["R-002", "allumage coupé entre deux boîtes"], nobox: ["R-001", "appareil sans boîte"] };
  for (const c of ctl) {
    const [rule, what] = KIND[c.kind] || [null, c.kind];
    add(c.kind === "circ" ? 4 : c.kind === "nobox" ? 3 : c.kind === "split" ? 5 : 1, { rule, state: c.kind === "split" ? "bloque" : "doute", text: `${what} : ${c.ids.map((id) => by.get(id)?.rep || id).join(", ")}`, ids: c.ids, question: "Corriger le plan (liaisons, commandes)" });
  }
  // 2. mode de pieuvre et alternatives (score Q-77)
  const alts = alternatives.map((a) => ({ mode: a.mode, name: a.name, score: scoreOf(a.W), chosen: a.mode === mode })).sort((a, b) => cmpScore(a.score, b.score));
  alts.forEach((a, i) => { a.rank = i + 1; });
  const ch = alts.find((a) => a.chosen), best = alts[0];
  add(2, { rule: "R-094", state: "applique", text: `Mode choisi : ${ch ? ch.name : mode}${best && ch && best.mode !== ch.mode ? ` — la solution la plus économique est « ${best.name} » (${(ch.score.gaine - best.score.gaine).toFixed(1).replace(".", ",")} m de gaine en moins)` : best && ch ? " — c'est aussi la solution la plus économique" : ""}` });
  // 3. boîtes : corrections à la main
  for (const b of boxes) {
    if (b.locked || b.manual) add(3, { rule: "R-004", state: "corrige", text: `${b.n} ${b.manual ? "déplacée" : "verrouillée"} à la main : gardée au recalcul`, box: b.n });
    const nR = Object.keys(b.routes || {}).length, nP = Object.keys(b.ports || {}).length;
    if (nR) add(6, { rule: "R-011", state: "corrige", text: `${b.n} : ${nR} gaine${nR > 1 ? "s" : ""} tracée${nR > 1 ? "s" : ""} à la main (longueur du tracé + majoration)`, box: b.n });
    if (nP) add(6, { rule: "R-077", state: "corrige", text: `${b.n} : ${nP} gaine${nP > 1 ? "s" : ""} épinglée${nP > 1 ? "s" : ""} sur un point de face à la main`, box: b.n });
  }
  // 4. circuits : surcharges, appareils sans circuit
  chk.issues.forEach((x) => add(4, { rule: /prises de cuisine/.test(x.msg) ? "R-022" : /prises/.test(x.msg) ? "R-021" : null, state: "doute", text: x.msg }));
  if (chk.orphans.length) add(4, { rule: "R-007", state: "doute", text: `${chk.orphans.length} appareil${chk.orphans.length > 1 ? "s" : ""} sans circuit`, ids: chk.orphans });
  // doutes du câblage (gaines, ronde, bornes, faces…) et allumages coupés
  if (W) {
    W.doutes.forEach((d) => add(stepOfRule(d.rule), { rule: d.rule, state: d.bloquant ? "bloque" : "doute", text: d.text, box: d.box, question: questionOf(J, d.rule) }));
    (W.splits || []).forEach((s) => add(5, { rule: "R-002", state: "bloque", text: `Allumage coupé : ${by.get(s.c)?.rep || s.c} et ${by.get(s.l)?.rep || s.l} dans deux boîtes`, ids: [s.c, s.l], question: "« Ramener dans la même boîte »" }));
  }
  // 8. tableau : règle reportée
  steps.forEach((s) => { s.state = worst(s.decisions.map((d) => d.state)); });
  const where = steps.flatMap((s) => s.decisions.filter((d) => d.state !== "applique").map((d) => ({ ...d, step: s.n, stepTitle: s.title })))
    .sort((a, b) => GRAV.indexOf(a.state) - GRAV.indexOf(b.state) || a.step - b.step);
  const n = (st) => where.filter((d) => d.state === st).length;
  return { date, chantier, journal: J.version, mode, pc: { ok: pc.ok, bloquants: pc.bloquants.map((r) => r.id), supposees: pc.supposees.map((r) => r.id) }, steps, alternatives: alts, where,
    counts: { bloque: n("bloque"), doute: n("doute"), suppose: n("suppose"), corrige: n("corrige") }, score: W ? scoreOf(W) : null };
}
// question à poser pour une règle : une question liée encore ouverte, sinon « confirmer la règle » si elle est supposée
export function questionOf(J, id) {
  const r = id && ruleById(J, id); if (!r) return id ? `Règle ${id} absente du journal : à créer` : null;
  const q = (r.questions_liees || []).map((x) => J.questions.find((y) => y.id === x)).find((y) => y && /ouverte|attente|partielle/.test(y.statut));
  if (q) return `${q.id} : ${q.question}`;
  return r.certitude !== "confirmee" ? `Confirmer ${r.id} (${r.titre}) ?` : null;
}

// « Pourquoi ? » : chaîne de règles d'une boîte, d'une gaine ou d'un fil → [{rule, text}]
const fr = (v, d = 1) => (v == null ? "?" : Number(v).toFixed(d).replace(".", ","));
export function whyBox(b, S, mode) {
  const nApp = b.gaines.filter((g) => g.kind === "app").length;
  return [
    { rule: "R-001", text: `${nApp} départs (max ${S.departsMax}, sans l'alimentation) ; faces ${["A", "B", "C", "D"].map((f) => f + b.gaines.filter((g) => g.face === f).length).join(" ")} (max ${S.departsFace} par face, alimentation comprise)` },
    { rule: mode === "equilibre" ? "R-094" : "R-085", text: `Mode de pieuvre « ${mode || "proximite"} » : ${mode === "equilibre" ? "parts de départs égales" : mode === "piece" ? "une boîte par pièce" : "le moins de cuivre"}` },
    { rule: "R-002", text: "Une commande et ses lumières sont dans la même boîte (allumages entiers)" },
    { rule: "R-005", text: "Une boîte peut desservir plusieurs pièces et niveaux" },
    { rule: "R-007", text: `Circuits de la boîte : ${b.circuits.join(", ")} (un circuit ne passe que par une boîte)` },
    ...(b.locked || b.manual ? [{ rule: "R-004", text: "Boîte verrouillée ou déplacée à la main : elle reste en place au recalcul" }] : []),
    { rule: "R-077", text: `Gaines numérotées ${b.n}.01 (alimentation) puis dans le sens anti-horaire (lus de gauche à droite sur chaque tranche)` },
    { rule: null, text: `Longueur totale des gaines : ${fr(b.longueur, 2)} m` },
  ];
}
export function whyGaine(g, b, S) {
  const out = [{ rule: "R-077", text: `${g.no} : face ${g.face}, ${g.kind === "alim" ? "alimentation = .01" : "numéro dans le sens anti-horaire depuis l'alimentation"}` }];
  if (g.kind === "alim") out.push({ rule: "R-010", text: `Une seule gaine d'alimentation (${(g.circuits || []).join(", ")}), divisée seulement au-delà de l'ICTA 20` }, { rule: "R-075", text: "Phase et neutre de chaque circuit, une seule terre de la plus forte section" });
  else {
    if ((g.appIds || []).length > 1) out.push({ rule: "R-073", text: `Gaine partagée : ${(g.reps || []).join(" + ")} au même endroit (≤ ${fr(S.memeEndroit ?? 0.3, 2)} m), fils communs une seule fois` });
    if (g.rules && g.rules.ronde) out.push({ rule: "R-072", text: `Couleurs de la ronde : ${[...new Set(g.wires.filter((w) => /^(retour|nav1|nav2|cmdTL)$/.test(w.fn)).map((w) => w.color + (w.bague ? ` (bague ${w.bague})` : "")))].join(", ")}` });
    if (g.cable) out.push({ rule: "R-014", text: `Appareil à l'extérieur : câble ${g.cable} dans la gaine` }, { rule: "R-095", text: "Bouchon obligatoire dans la boîte (air extérieur)" });
  }
  out.push({ rule: "R-074", text: `Somme des sections ${fr(g.sum, 1)} mm² → ${g.diam ? "ICTA " + g.diam : "aucun diamètre (au-delà de l'ICTA 20 : doute)"}` });
  out.push({ rule: "R-011", text: `Longueur ${fr(g.length, 2)} m = tracé + ${S.majoration} % + descentes + surlongueurs, arrondie` });
  return out;
}
export function whyWire(w) {
  const out = [];
  if (w.fn === "terre") out.push({ rule: "R-030", text: "Une seule terre par boîte : toutes les terres sur le n° 1 (sections différentes admises, R-092)" });
  else if (w.fn === "phase" || w.fn === "neutre") out.push({ rule: w.color === "gris" || w.color === "bleu foncé" ? "R-021" : "R-020", text: `${w.fn} ${w.color} ${fr(w.section)} mm² : couleur du type de circuit${w.bague ? ` ; bague ${w.bague} (n° du circuit)` : ""}` });
  else out.push({ rule: "R-072", text: `${w.fn} ${w.color} : couleur de la ronde de l'allumage${w.bague ? ` ; bague ${w.bague} (couleur réutilisée)` : ""}` });
  out.push({ rule: "R-031", text: `N° de raccordement ${w.n ?? "?"} : terres, puis neutre et phase de chaque circuit, puis retours et navettes` });
  return out;
}

// statistiques par règle sur toutes les études de ce PC : { [rule]: {app, doute, bloque, corrige} } + modes retenus
export function statsOf(traces) {
  const R = {}, modes = {};
  for (const t of traces) {
    for (const s of t.steps) for (const d of s.decisions) {
      if (!d.rule) continue;
      const x = R[d.rule] || (R[d.rule] = { app: 0, doute: 0, bloque: 0, corrige: 0, suppose: 0 });
      x[d.state === "applique" ? "app" : d.state]++;
    }
    for (const a of t.alternatives || []) { const m = modes[a.mode] || (modes[a.mode] = { name: a.name, etudie: 0, retenu: 0, meilleur: 0 }); m.etudie++; if (a.chosen) m.retenu++; if (a.rank === 1) m.meilleur++; }
  }
  const signal = (x) => (x.corrige >= 2 && x.corrige >= x.app / 3 ? "souvent corrigée à la main : à revoir" : x.bloque ? "bloque : règle manquante ou cas non prévu" : x.doute >= 2 ? "doutes fréquents" : "");
  return { rules: Object.entries(R).map(([id, x]) => ({ id, ...x, signal: signal(x) })).sort((a, b) => a.id.localeCompare(b.id)),
    modes: Object.entries(modes).map(([mode, m]) => ({ mode, ...m, signal: m.etudie >= 3 && !m.retenu ? "jamais retenu : à revoir" : "" })), etudes: traces.length };
}
