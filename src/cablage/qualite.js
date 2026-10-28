// Note « belle pieuvre » (v62) : qualité d'une pieuvre, commune à tous les modes d'implantation des boîtes.
// Réponse de Kévin (28/10/2026, 08:38) : le BE cherche « des économies tout en réalisant de belles pieuvres, sans trop
// croiser les gaines ». Critères (décision de Claude) :
// - aucun croisement de gaines dans une même boîte (obligatoire ; entre deux boîtes : permis, Kévin 28/10) ;
// - territoires des boîtes bien séparés : pas d'appareil d'une boîte au milieu de ceux d'une autre ;
// - cuivre (longueur de chaque gaine × nombre de fils), gaine, nombre de boîtes ;
// - départs équilibrés entre les boîtes ; gaines pas trop longues ; peu de pièces par boîte.
// Les modes (Économique, Équilibrée, Par pièce) ne diffèrent que par le poids qu'ils donnent à ces critères pour
// choisir leurs boîtes ; la note affichée utilise les poids communs (POIDS.commun) pour comparer les propositions.
// Module pur (sans DOM).
import { portXY, PORT_S } from "./boites.js";
import { chooseBows, crossings } from "./trace.js";
import { isVolet } from "./appareils.js";

export const CRITERES = [
  { k: "croise", lab: "Croisements dans une même boîte", obligatoire: true, aide: "Gaines d'une même boîte qui se croisent sur le plan (interdit)" },
  { k: "terr", lab: "Territoires mêlés", aide: "Appareils d'une boîte au milieu de ceux d'une autre boîte (même niveau)" },
  { k: "cuivre", lab: "Cuivre", aide: "Longueur de chaque gaine × nombre de fils, comparée à la meilleure proposition" },
  { k: "gaine", lab: "Gaine", aide: "Longueur totale de gaine, comparée à la meilleure proposition" },
  { k: "boites", lab: "Boîtes", aide: "Boîtes de plus que la proposition qui en a le moins" },
  { k: "equil", lab: "Départs équilibrés", aide: "Écart des départs entre les boîtes (coefficient de variation)" },
  { k: "longues", lab: "Gaines longues", aide: "Gaines d'appareil plus longues que le réglage « gaine longue »" },
  { k: "pieces", lab: "Pièces par boîte", aide: "Nombre moyen de pièces desservies par une boîte, au-delà d'une" },
];
// points retirés par unité de chaque mesure (avant le poids du mode)
const PEN = { terr: 4, cuivre: 1, gaine: 1, boites: 12, equil: 40, longues: 3, pieces: 12 };
export const POIDS = {
  commun: { terr: 1, cuivre: 0.6, gaine: 0.3, boites: 0.5, equil: 0.5, longues: 0.6, pieces: 0.3 },
  proximite: { terr: 1, cuivre: 1, gaine: 0.3, boites: 0.3, equil: 0.2, longues: 0.6, pieces: 0.1 },
  equilibre: { terr: 1, cuivre: 0.3, gaine: 0.2, boites: 1, equil: 1, longues: 0.6, pieces: 0.1 },
  piece: { terr: 0.6, cuivre: 0.3, gaine: 0.2, boites: 0.2, equil: 0.2, longues: 0.6, pieces: 1 },
};
export const GAINE_LONGUE = 12; // m (réglage `gaineLongue` s'il existe)

// ---------- géométrie ----------
function hull(P) {
  const p = P.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  if (p.length < 3) return p;
  const cr = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x), lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.slice().reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
const segD = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L)); return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy); };
// point à l'intérieur du polygone convexe H (sens trigonométrique de hull) et à plus de `m` de ses bords
function deepIn(p, H, m) {
  if (H.length < 3) return false;
  for (let i = 0; i < H.length; i++) { const a = H[i], b = H[(i + 1) % H.length]; if ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) < 0) return false; }
  for (let i = 0; i < H.length; i++) if (segD(p, H[i], H[(i + 1) % H.length]) < m) return false;
  return true;
}

// territoires mêlés : groups = [{x, y, pts:[{x,y}]}] (un niveau) → nombre de points d'une boîte au fond du territoire
// (enveloppe convexe de ses appareils et de la boîte) d'une autre boîte ET nettement plus près de cette autre boîte
// (moins de 0,7 fois la distance à la sienne) : un appareil « chez la voisine »
export function intrusions(groups, margin = 0.3) {
  const H = groups.map((g) => hull([{ x: g.x, y: g.y }, ...g.pts])), d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  let n = 0;
  groups.forEach((g, i) => groups.forEach((o, j) => { if (i !== j) for (const p of o.pts) if (d(p, g) < 0.7 * d(p, o) && deepIn(p, H[i], margin)) n++; }));
  return n;
}

// ---------- mesures d'une solution ----------
// W = computeWiring(...) ; items = appareils (x, y, lv, room) ; boxes = boîtes du placement (id, lv, x, y, apps)
export function mesures(W, { items = [], boxes = [], S = {} } = {}) {
  const by = new Map(items.map((a) => [a.id, a])), lvOf = new Map(boxes.map((b) => [b.id, b.lv]));
  const N = S.departsFace || 6, LONG = S.gaineLongue || GAINE_LONGUE;
  let croise = 0, longues = 0;
  const groups = new Map(), rooms = [];
  for (const b of W.boxes || []) {
    const box = boxes.find((x) => x.id === b.id) || b, lv = b.lv ?? box.lv ?? lvOf.get(b.id), list = [];
    const pts = [];
    for (const g of b.gaines || []) {
      if (g.kind !== "app") continue;
      if ((g.length || 0) > LONG) longues++;
      const P = portXY(b, S.portS || PORT_S, N, g.face, g.slot);
      for (const id of g.appIds || [g.appId]) {
        const a = by.get(id);
        if (!a || (a.lv != null && lv != null && a.lv !== lv)) continue;
        pts.push({ x: a.x, y: a.y });
        // gaine tracée à la main (points de passage) : ce n'est pas un arc, le BE l'a voulue ainsi (comme à l'écran)
        if (!((box.routes || {})[id])) list.push({ key: b.id + "|" + id, P, T: a });
      }
    }
    if (list.length > 1) croise += crossings(list, chooseBows(list, []));
    // la boîte des volets (R-094) fait le tour de la maison : elle n'a pas de territoire
    const volets = (b.gaines || []).filter((g) => g.kind === "app").every((g) => (g.appIds || [g.appId]).every((id) => by.get(id) && isVolet(by.get(id).t)));
    if (!groups.has(lv)) groups.set(lv, []);
    if (!volets) groups.get(lv).push({ x: b.x, y: b.y, pts });
    const ids = (boxes.find((x) => x.id === b.id) || {}).apps || (b.gaines || []).flatMap((g) => g.appIds || [g.appId]);
    rooms.push(new Set(ids.map((id) => (by.get(id) || {}).room).filter(Boolean)).size);
  }
  const terr = [...groups.values()].reduce((s, G) => s + intrusions(G), 0);
  const dep = (W.boxes || []).map((b) => (b.gaines || []).filter((g) => g.kind === "app").length), mean = dep.reduce((s, v) => s + v, 0) / (dep.length || 1);
  const cv = mean ? Math.sqrt(dep.reduce((s, v) => s + (v - mean) ** 2, 0) / (dep.length || 1)) / mean : 0;
  return { croise, terr, cuivre: (W.totals || {}).cuivre || 0, gaine: (W.totals || {}).gaine || 0, boites: (W.boxes || []).length, equil: +cv.toFixed(3), longues,
    pieces: rooms.length ? +(rooms.reduce((s, v) => s + v, 0) / rooms.length).toFixed(2) : 0 };
}

// notes de plusieurs propositions comparées entre elles (cuivre, gaine et boîtes relatifs à la meilleure) ;
// list = [mesures] → [{note 0–100, ok (aucun croisement dans une boîte), pen {critère: points retirés}}]
export function noter(list, poids = POIDS.commun) {
  const min = (k) => Math.min(...list.map((m) => m[k]).filter((v) => v > 0)) || 0;
  const c0 = min("cuivre"), g0 = min("gaine"), b0 = Math.min(...list.map((m) => m.boites));
  return list.map((m) => {
    const raw = { terr: m.terr, cuivre: c0 ? 100 * (m.cuivre / c0 - 1) : 0, gaine: g0 ? 100 * (m.gaine / g0 - 1) : 0, boites: m.boites - b0, equil: m.equil, longues: m.longues, pieces: Math.max(0, m.pieces - 1) };
    const pen = {};
    let tot = 0;
    for (const k of Object.keys(raw)) { pen[k] = +((poids[k] || 0) * PEN[k] * raw[k]).toFixed(1); tot += pen[k]; }
    let note = Math.max(0, Math.round(100 - tot));
    const ok = !m.croise;
    if (!ok) note = Math.min(note, 40);
    return { note, ok, pen };
  });
}
export const noteOf = (m, poids) => noter([m], poids)[0];
export const noteTxt = (n) => (n.ok ? `${n.note}/100` : `${n.note}/100 ✗`);
