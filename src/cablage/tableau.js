// Tableau électrique (v46) — moteur pur.
// Un tableau = un coffret (modèle : rangées × modules) et ses rangées : [{k:"id", id, a, type, w:2} | {k:"cb", id, c, a, w:1}].
// Convention : un interrupteur différentiel (ID) protège les disjoncteurs placés à sa droite sur la même rangée,
// jusqu'au prochain ID.
// Placement automatique (NF C 15-100, simplifié) : circuits spécialisés (lave-linge, plaque, four…) sur un ID type A,
// les autres répartis sur des ID type AC (1 jusqu'à 35 m², 2 jusqu'à 100 m², 3 au-delà), au plus 8 circuits par ID ;
// une rangée par ID. Les circuits de communication (RJ45) n'ont pas de disjoncteur.

// coffrets : Schneider Electric Resi9 et Legrand Drivia, 1 à 4 rangées de 13 ou 18 modules
const SE = "Schneider Electric", LG = "Legrand";
export const MODELS = [
  { id: "r9-13x1", brand: SE, range: "Resi9", name: "Resi9 · 1 rangée · 13 modules (R9H13401)", rows: 1, mods: 13 },
  { id: "r9-13x2", brand: SE, range: "Resi9", name: "Resi9 · 2 rangées · 13 modules (R9H13402)", rows: 2, mods: 13 },
  { id: "r9-13x3", brand: SE, range: "Resi9", name: "Resi9 · 3 rangées · 13 modules (R9H13403)", rows: 3, mods: 13 },
  { id: "r9-13x4", brand: SE, range: "Resi9", name: "Resi9 · 4 rangées · 13 modules (R9H13404)", rows: 4, mods: 13 },
  { id: "r9-18x2", brand: SE, range: "Resi9", name: "Resi9 · 2 rangées · 18 modules (R9H18402)", rows: 2, mods: 18 },
  { id: "r9-18x3", brand: SE, range: "Resi9", name: "Resi9 · 3 rangées · 18 modules (R9H18403)", rows: 3, mods: 18 },
  { id: "r9-18x4", brand: SE, range: "Resi9", name: "Resi9 · 4 rangées · 18 modules (R9H18404)", rows: 4, mods: 18 },
  { id: "dv-13x1", brand: LG, range: "Drivia", name: "Drivia · 1 rangée · 13 modules (401211)", rows: 1, mods: 13 },
  { id: "dv-13x2", brand: LG, range: "Drivia", name: "Drivia · 2 rangées · 13 modules (401212)", rows: 2, mods: 13 },
  { id: "dv-13x3", brand: LG, range: "Drivia", name: "Drivia · 3 rangées · 13 modules (401213)", rows: 3, mods: 13 },
  { id: "dv-13x4", brand: LG, range: "Drivia", name: "Drivia · 4 rangées · 13 modules (401214)", rows: 4, mods: 13 },
  { id: "dv-18x2", brand: LG, range: "Drivia", name: "Drivia · 2 rangées · 18 modules (401222)", rows: 2, mods: 18 },
  { id: "dv-18x3", brand: LG, range: "Drivia", name: "Drivia · 3 rangées · 18 modules (401223)", rows: 3, mods: 18 },
  { id: "dv-18x4", brand: LG, range: "Drivia", name: "Drivia · 4 rangées · 18 modules (401224)", rows: 4, mods: 18 },
];
export const BRANDS = [SE, LG];
// appareillage modulaire (v49) : largeur en modules ; under = doit être à droite d'un différentiel
export const MODS = {
  pc: { n: "Prise modulaire 2P+T 16 A", s: "Prise 2P+T", w: 2.5, under: true },
  pf: { n: "Parafoudre type 2", s: "Parafoudre", w: 2 },
  pfd: { n: "Disjoncteur de déconnexion du parafoudre", s: "Disj. parafoudre", w: 1 },
  tl: { n: "Télérupteur", s: "Télérupteur", w: 1 },
  hc: { n: "Contacteur jour / nuit (chauffe-eau, heures creuses)", s: "Contacteur HC", w: 1 },
  min: { n: "Minuterie", s: "Minuterie", w: 1 },
  hor: { n: "Horloge / programmateur", s: "Horloge", w: 1 },
  del: { n: "Délesteur", s: "Délesteur", w: 2 },
  son: { n: "Transformateur de sonnette", s: "Transfo sonnette", w: 2 },
};
export const DEFAULT_MODEL = "r9-13x4";
export const MAX_PER_ID = 8;
export const modelOf = (id) => MODELS.find((m) => m.id === id) || MODELS.find((m) => m.id === DEFAULT_MODEL);
export const needsA = (c) => c.kind === "specialise";
export const hasBreaker = (c) => c.kind !== "comm";

let seq = 0;
const uid = (p) => p + Date.now().toString(36).slice(-4) + (++seq).toString(36);

// nombre d'ID type AC selon la surface habitable (m²)
export function idsAC(area) { return area <= 35 ? 1 : area <= 100 ? 2 : 3; }

export function autoTableau(circuits, { model = DEFAULT_MODEL, area = 100 } = {}) {
  const C = (circuits || []).filter(hasBreaker);
  const spec = C.filter(needsA), rest = C.filter((c) => !needsA(c));
  const groups = [];
  // AC : répartition équilibrée (éclairage et prises alternés pour ne pas tout couper d'un coup)
  const nAC = Math.max(rest.length ? idsAC(area) : 0, Math.ceil(rest.length / MAX_PER_ID));
  const order = [...rest.filter((c) => c.kind === "eclairage"), ...rest.filter((c) => c.kind !== "eclairage")];
  for (let i = 0; i < nAC; i++) groups.push({ type: "AC", a: 40, cs: [] });
  order.forEach((c, i) => groups[i % nAC].cs.push(c));
  for (let i = 0; i < spec.length; i += MAX_PER_ID) groups.push({ type: "A", a: 40, cs: spec.slice(i, i + MAX_PER_ID) });
  const rows = groups.filter((g) => g.cs.length || g.type === "A").map((g) => [
    { k: "id", id: uid("i"), a: g.a, type: g.type, w: 2 },
    ...g.cs.map((c) => ({ k: "cb", id: uid("d"), c: c.n, a: c.prot || 16, w: 1 })),
  ]);
  return { model, rows };
}

// le tableau enregistré, débarrassé des circuits disparus ; les circuits pas encore placés à part
export function syncTableau(tab, circuits) {
  const C = (circuits || []).filter(hasBreaker), byN = new Map(C.map((c) => [c.n, c]));
  const rows = (tab.rows || []).map((r) => r.filter((it) => it.k !== "cb" || byN.has(it.c)).map((it) => (it.k === "cb" ? { ...it, a: byN.get(it.c).prot || it.a } : it)));
  const placed = new Set(rows.flat().filter((it) => it.k === "cb").map((it) => it.c));
  return { model: tab.model || DEFAULT_MODEL, rows, missing: C.filter((c) => !placed.has(c.n)) };
}

// ID qui protège chaque disjoncteur (le plus proche à sa gauche sur la rangée)
export function protections(rows) {
  const m = new Map();
  rows.forEach((r) => { let cur = null; r.forEach((it) => { if (it.k === "id") cur = it; else if (it.k === "cb") m.set(it.id, cur); }); });
  return m;
}
export const rowMods = (r) => r.reduce((s, it) => s + (it.w || 1), 0);

export function tableauIssues(tab, circuits) {
  const M = modelOf(tab.model), out = [], byN = new Map((circuits || []).map((c) => [c.n, c])), prot = protections(tab.rows);
  if (tab.rows.length > M.rows) out.push(`${tab.rows.length} rangées pour un coffret de ${M.rows} : prenez un coffret plus grand.`);
  tab.rows.forEach((r, i) => { const n = rowMods(r); if (n > M.mods) out.push(`Rangée ${i + 1} : ${n} modules pour ${M.mods} places.`); });
  const count = new Map();
  for (const it of tab.rows.flat().filter((x) => x.k === "cb")) {
    const id = prot.get(it.id), c = byN.get(it.c);
    if (!id) { out.push(`${it.c} n'est protégé par aucun interrupteur différentiel (placez-le à droite d'un ID).`); continue; }
    count.set(id, (count.get(id) || 0) + 1);
    if (c && needsA(c) && id.type !== "A") out.push(`${it.c} (${c.name || "spécialisé"}) doit être sous un différentiel type A.`);
  }
  rows0: for (const r of tab.rows) { let cur = null; for (const it of r) { if (it.k === "id") cur = it; else if (it.k === "mod" && MODS[it.t] && MODS[it.t].under && !cur) { out.push(`${MODS[it.t].s} : à placer à droite d'un interrupteur différentiel.`); break rows0; } } }
  for (const [id, n] of count) if (n > MAX_PER_ID) out.push(`Un différentiel ${id.a} A type ${id.type} protège ${n} circuits (8 au plus).`);
  const used = tab.rows.reduce((s, r) => s + rowMods(r), 0), total = M.rows * M.mods;
  if (total - used < Math.ceil(used * 0.2)) out.push(`Réserve insuffisante : ${total - used} modules libres (norme : 20 % de réserve, soit ${Math.ceil(used * 0.2)}).`);
  return out;
}

// plus petit coffret qui contient le tableau (rangées et modules), avec la réserve de 20 %
export function suggestModel(tab) {
  const used = tab.rows.reduce((s, r) => s + rowMods(r), 0), widest = Math.max(0, ...tab.rows.map(rowMods));
  return MODELS.slice().sort((a, b) => a.rows * a.mods - b.rows * b.mods)
    .find((m) => m.rows >= tab.rows.length && m.mods >= widest && m.rows * m.mods - used >= Math.ceil(used * 0.2)) || MODELS[MODELS.length - 1];
}

// déplacer un élément (id) vers la rangée r, avant l'élément before (ou en fin de rangée) ; renvoie de nouvelles rangées
// appareil modulaire ajouté sur la rangée qui a le plus de place (ou une nouvelle rangée)
export function addModular(rows, t, mods, label = "") {
  const D = MODS[t];
  if (!D) return rows;
  const R = rows.map((x) => [...x]), it = { k: "mod", t, id: uid("m"), w: D.w, label };
  // une prise doit être sous un différentiel : rangée avec un ID ; sinon la rangée la moins pleine
  const cand = R.map((r, i) => ({ i, free: mods - rowMods(r), id: r.some((x) => x.k === "id") })).filter((c) => c.free >= D.w && (!D.under || c.id)).sort((a, b) => b.free - a.free);
  if (cand.length) R[cand[0].i].push(it); else R.push(D.under ? [{ k: "id", id: uid("i"), a: 40, type: "AC", w: 2 }, it] : [it]);
  return R;
}
export function removeItem(rows, id) { return rows.map((r) => r.filter((x) => x.id !== id)); }

export function moveItem(rows, id, r, before = null) {
  const R = rows.map((x) => [...x]);
  let item = null;
  R.forEach((row) => { const i = row.findIndex((it) => it.id === id); if (i >= 0) item = row.splice(i, 1)[0]; });
  if (!item) return rows;
  while (R.length <= r) R.push([]);
  const j = before ? R[r].findIndex((it) => it.id === before) : -1;
  if (j >= 0) R[r].splice(j, 0, item); else R[r].push(item);
  return R.filter((row, i) => row.length || i < rows.length);
}
export function addBreaker(rows, c) {
  const R = rows.map((x) => [...x]), prot = protections(R);
  const want = needsA(c) ? "A" : "AC";
  // sous un ID du bon type qui a encore de la place
  for (const row of R) {
    const id = row.find((it) => it.k === "id" && it.type === want);
    if (id && [...prot].filter(([, v]) => v === id).length < MAX_PER_ID) { row.push({ k: "cb", id: uid("d"), c: c.n, a: c.prot || 16, w: 1 }); return R; }
  }
  R.push([{ k: "id", id: uid("i"), a: 40, type: want, w: 2 }, { k: "cb", id: uid("d"), c: c.n, a: c.prot || 16, w: 1 }]);
  return R;
}
export function newId(rows, type = "AC") { return [...rows.map((x) => [...x]), [{ k: "id", id: uid("i"), a: 40, type, w: 2 }]]; }
