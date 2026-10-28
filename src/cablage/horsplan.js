// Équipements hors plan (v57, R-100) : le BE ajoute d'après le devis des appareils qui ne sont pas dessinés sur le plan
// de l'architecte (cuisine équipée, VMC et bouches, sèche-serviette, équipotentielles, antenne, sonnette, G EXT…).
// Pur (sans DOM sauf localStorage) : liste de contrôle, registre des chantiers (fréquence de chaque équipement),
// emplacement proposé dans la pièce qui convient. Les appareils posés sont marqués hp:true « à vérifier avec le devis ».
export const HP_ITEMS = [
  { t: "FOUR", n: "Four", rooms: ["cuisine", "sejour", "vie"] },
  { t: "PLAQ", n: "Plaque de cuisson", rooms: ["cuisine", "sejour", "vie"] },
  { t: "HOTTE", n: "Hotte", rooms: ["cuisine", "sejour", "vie"] },
  { t: "LV", n: "Lave-vaisselle", rooms: ["cuisine", "sejour", "vie"] },
  { t: "LL", n: "Lave-linge", rooms: ["buanderie", "cellier", "garage", "sdb", "bain", "cuisine"] },
  { t: "SL", n: "Sèche-linge", rooms: ["buanderie", "cellier", "garage", "sdb", "bain", "cuisine"] },
  { t: "ILOT", n: "Îlot", rooms: ["cuisine", "sejour", "vie"] },
  { t: "VMCG", n: "Caisson VMC", rooms: ["@centre"] },
  { t: "CVMC", n: "Commande VMC", rooms: ["cuisine", "sejour", "vie"] },
  { t: "BOUCHE", n: "Bouche de diffusion motorisée", rooms: ["@each:chambre,sejour,salon,bureau,vie"], q: 7 },
  { t: "SS", n: "Sèche-serviette", rooms: ["sdb", "bain", "eau", "sde"] },
  { t: "EQL", n: "Équipotentielle locale", rooms: ["sdb", "bain", "eau", "sde"] },
  { t: "EQP", n: "Équipotentielle principale", rooms: ["@tab"] },
  { t: "ANT", n: "Antenne", rooms: ["@centre"] },
  { t: "SON", n: "Sonnette (carillon)", rooms: ["entree", "degagement", "dgt", "couloir", "hall"] },
  { t: "BPS", n: "Bouton poussoir de sonnette", rooms: ["entree", "hall", "degagement", "dgt"] },
  { t: "GEXT", n: "Prise de garage extérieure (G EXT)", rooms: ["garage"] },
];
export const HP_KEY = "okteo.horsplan.v1";
// premier chantier connu (MAILLARD, bandes du BE du 28/10/2026)
export const HP_SEED = { MAILLARD: { FOUR: 1, PLAQ: 1, HOTTE: 1, LV: 1, LL: 1, SL: 1, ILOT: 1, VMCG: 1, CVMC: 1, BOUCHE: 7, SS: 1, EQL: 1, EQP: 1, ANT: 1, SON: 1, BPS: 1, GEXT: 1 } };
export const HP_FREQ = 0.8;   // au-delà : coché d'avance (réglable plus tard)

const LS = () => { try { return globalThis.localStorage || null; } catch { return null; } };
export function getRegistry() {
  try { const s = LS()?.getItem(HP_KEY); const o = s ? JSON.parse(s) : null; if (o && o.chantiers) return o; } catch { /* registre illisible */ }
  return { chantiers: { ...HP_SEED } };
}
export function saveRegistry(R) { try { LS()?.setItem(HP_KEY, JSON.stringify(R)); } catch { /* stockage plein ou refusé */ } return R; }
// enregistre la liste d'un chantier (id → {t: quantité}) : sert aux fréquences des chantiers suivants
export function recordChantier(id, list) { const R = getRegistry(); R.chantiers[id] = { ...list }; return saveRegistry(R); }

// fréquence et quantité habituelle de chaque équipement sur les chantiers enregistrés
export function stats(R = getRegistry(), exclude = null) {
  const C = Object.entries(R.chantiers || {}).filter(([k]) => k !== exclude).map(([, v]) => v), n = C.length, out = {};
  for (const it of HP_ITEMS) {
    const qs = C.map((c) => +c[it.t] || 0).filter((q) => q > 0);
    const sorted = qs.slice().sort((a, b) => a - b);
    out[it.t] = { n, seen: qs.length, freq: n ? qs.length / n : 0, q: sorted.length ? sorted[Math.floor(sorted.length / 2)] : it.q || 1 };
  }
  return out;
}

// liste proposée pour un chantier : celle déjà enregistrée sur le chantier, sinon cochée d'après les fréquences
export function proposal(saved, R = getRegistry(), id = null) {
  const st = stats(R, id);
  return HP_ITEMS.map((it) => {
    const s = saved && it.t in saved ? +saved[it.t] || 0 : null;
    return { ...it, q: s != null ? s || st[it.t].q : st[it.t].q, on: s != null ? s > 0 : st[it.t].freq >= HP_FREQ, freq: st[it.t].freq, seen: st[it.t].seen, total: st[it.t].n };
  });
}

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ");
const centroid = (P) => { let x = 0, y = 0; P.forEach((p) => { x += p.x; y += p.y; }); return { x: x / P.length, y: y / P.length }; };
const roomPt = (r) => (r.lx != null ? { x: r.lx, y: r.ly } : r.poly && r.poly.length ? centroid(r.poly) : { x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 });
const area = (r) => { const P = r.poly || []; let s = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s += a.x * b.y - b.x * a.y; } return Math.abs(s / 2); };

// emplacements des équipements cochés : [{t, x, y, room, why}] ; rooms = [{name, poly, lx?, ly?}] ; tab = {x,y} | null ;
// have = {t: nombre déjà posé} : on ne pose que ce qui manque
export function placeHorsPlan(list, rooms, { tab = null, have = {} } = {}) {
  const R = rooms.filter((r) => r.poly && r.poly.length > 2 || r.x0 != null);
  const all = R.flatMap((r) => r.poly || []);
  const house = all.length ? centroid(all) : tab || { x: 0, y: 0 };
  const find = (words) => { for (const w of words) { const r = R.find((x) => norm(x.name).split(" ").some((p) => p.startsWith(w))); if (r) return r; } return null; };
  const used = new Map(), out = [];
  const put = (t, r, why, base) => {
    const p = base || (r ? roomPt(r) : house), u = r ? r.name : "@" + why, k = used.get(u) || 0;
    used.set(u, k + 1);
    // décalage en couronne pour ne pas empiler les symboles (≈ 45 cm)
    const ang = k * 1.3, d = k ? 0.45 + 0.1 * k : 0;
    out.push({ t, x: +(p.x + Math.cos(ang) * d).toFixed(3), y: +(p.y + Math.sin(ang) * d).toFixed(3), room: r ? r.name : null, why });
  };
  for (const it of list) {
    if (!it.on) continue;
    let need = Math.max(0, (+it.q || 0) - (+have[it.t] || 0));
    if (!need) continue;
    const spec = it.rooms[0] || "";
    if (spec === "@centre") { while (need--) put(it.t, null, "centre de la maison (combles)", house); continue; }
    if (spec === "@tab") { while (need--) put(it.t, null, "à côté du tableau", tab ? { x: tab.x + 0.4, y: tab.y } : house); continue; }
    if (spec.startsWith("@each:")) {
      const words = spec.slice(6).split(",");
      const cand = R.filter((r) => words.some((w) => norm(r.name).split(" ").some((p) => p.startsWith(w)))).sort((a, b) => area(b) - area(a));
      for (let i = 0; i < need; i++) { const r = cand.length ? cand[i % cand.length] : null; put(it.t, r, r ? "une par pièce sèche" : "pièce non reconnue"); }
      continue;
    }
    const r = find(it.rooms);
    while (need--) put(it.t, r, r ? "pièce « " + r.name + " »" : "pièce non reconnue : centre de la maison");
  }
  return out;
}
