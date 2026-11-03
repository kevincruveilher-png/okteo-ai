// v76 étape 7 : banc d'essai des modes d'analyse (pur, sans DOM) — compare le relevé produit par un mode à une vérité
// terrain validée par le BE : rappel, omissions, faux positifs, types justes, durée, tokens et coût (journal).
// Fichiers acceptés : un export .okteo (format « okteo-chantier » : dessin.s = état du plan, tous niveaux) ou un JSON
// { appareils: [{ t, x, y, lv? }] } (mètres, repère du plan). Les deux fichiers doivent venir du MÊME chantier avec la
// MÊME échelle (mêmes mètres) : un fond recalibré entre les deux fausserait les positions.
import { family } from "./ai-tiles.js";
import { analysesOf } from "./ai-journal.js";

const SANS_REPERE = new Set(["BAIG", "RECV", "DITAL"]);   // sanitaires : pas des appareils électriques

// appareils d'un fichier → [{ t, x, y, lv }] (tous niveaux) ; état du plan si .okteo
export function devicesOf(file) {
  if (Array.isArray(file && file.appareils)) return file.appareils.map((d) => ({ t: String(d.t), x: +d.x, y: +d.y, lv: d.lv || "rdc" }));
  const S = stateOf(file); if (!S) throw new Error("Fichier non reconnu : export .okteo ou JSON { appareils: [...] } attendu.");
  const out = [], add = (lv, L) => (L || []).forEach((a) => { if (!SANS_REPERE.has(a.t)) out.push({ t: a.t, x: a.x, y: a.y, lv }); });
  add(S.level || "rdc", S.app);
  for (const [lv, d] of Object.entries(S.other || {})) add(lv, d.app);
  return out;
}
export function stateOf(file) {
  const s = file && file.dessin && file.dessin.s;
  if (!s) return null;
  return typeof s === "string" ? JSON.parse(s) : s;
}

// appariement glouton par distance croissante : même niveau, même famille de type, à moins de `tol` mètres
export function score(truth, result, { tol = 0.3 } = {}) {
  const pairs = [];
  truth.forEach((v, i) => result.forEach((r, j) => {
    if (v.lv !== r.lv || family(v.t) !== family(r.t)) return;
    const d = Math.hypot(v.x - r.x, v.y - r.y); if (d <= tol) pairs.push([d, i, j]);
  }));
  pairs.sort((a, b) => a[0] - b[0]);
  const tU = new Set(), rU = new Set(), match = [];
  for (const [d, i, j] of pairs) if (!tU.has(i) && !rU.has(j)) { tU.add(i); rU.add(j); match.push({ i, j, d }); }
  const parType = {};
  truth.forEach((v, i) => { const p = (parType[v.t] ||= { vrais: 0, trouves: 0, omissions: 0 }); p.vrais++; if (tU.has(i)) p.trouves++; else p.omissions++; });
  const typesJustes = match.filter((m) => truth[m.i].t === result[m.j].t).length;
  const tp = match.length, fn = truth.length - tp, fp = result.length - tp;
  return {
    vrais: truth.length, releves: result.length, trouves: tp, omissions: fn, fauxPositifs: fp, typesJustes,
    rappel: truth.length ? tp / truth.length : null, precision: result.length ? tp / result.length : null,
    ecartMoyen: tp ? match.reduce((s, m) => s + m.d, 0) / tp : null,
    omis: truth.filter((_, i) => !tU.has(i)), enTrop: result.filter((_, j) => !rU.has(j)), parType,
  };
}

// journal de l'analyse d'un .okteo : dernière analyse de chaque niveau (mode, durée, tokens, coût)
export function journalOf(file) {
  const S = stateOf(file), R = (S && S.cab && S.cab.releves) || {}, out = [];
  for (const [lv, rel] of Object.entries(R)) { const A = analysesOf(rel); if (A.length) out.push({ lv, ...A[A.length - 1] }); }
  return out;
}
const pc = (v) => (v == null ? "—" : Math.round(v * 100) + " %");
export function benchLine(name, S, J) {
  const ms = J.reduce((s, a) => s + (a.ms || 0), 0), tok = J.reduce((s, a) => s + (a.tin || 0) + (a.tout || 0), 0), usd = J.reduce((s, a) => s + (a.usd || 0), 0);
  return { fichier: name, mode: J.map((a) => a.mode).filter(Boolean).join("/") || "?", rappel: pc(S.rappel), omissions: S.omissions, fauxPositifs: S.fauxPositifs, precision: pc(S.precision), typesJustes: `${S.typesJustes}/${S.trouves}`, duree_s: Math.round(ms / 1000), tokens: tok, cout_usd: +usd.toFixed(3) };
}
