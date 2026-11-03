// v76 : journal des analyses IA (pur, sans DOM). Une « analyse » = un lancement depuis l'écran des modes (relevé +
// relectures qui suivent). Rien n'est stocké à part : chaque élément du rapport du niveau (cab.releves[niveau].rapport,
// écrit par ai-recheck-ui.js) porte `analyse` = { id, mode } (relevé) ou `analyse` = id (relecture), avec sa durée (ms),
// ses tokens (tin / tout) et son coût en USD. `analysesOf` regroupe ces éléments pour l'affichage (onglet Étude) et pour
// le futur banc d'essai (étape 7).
// Ce qui est journalisé : mode choisi, zones retraitées (`zones`, modes 2 à 4), zooms (`zooms`), alertes (points signalés
// avant / restants), écarts proposés (points corrigés par une relecture = propositions à valider, jamais certaines),
// durée, tokens, coût estimé.
import { ANALYSE_PRICE, CACHE_RATIO } from "../ai-config.js";

export const newAnalyseId = (now = Date.now()) => "an-" + now.toString(36) + "-" + Math.random().toString(36).slice(2, 6);

// entrée totale d'un appel : hors cache + écrite en cache + lue en cache
export const tinOf = (u) => (u ? (u.in ?? 0) + (u.cw || 0) + (u.cr || 0) : 0);
// coût d'un appel en USD : celui renvoyé par le Worker (tarif de l'administrateur) s'il existe, sinon le tarif public,
// cache compris (écriture 1,25 ×, lecture 0,05 × le prix d'entrée pour Opus 5.5)
export function callCost(usage, price = ANALYSE_PRICE) {
  if (!usage) return null;
  if (Number.isFinite(usage.usd)) return usage.usd;
  const tin = usage.in ?? usage.tin ?? 0, tout = usage.out ?? usage.tout ?? 0, cw = usage.cw || 0, cr = usage.cr || 0;
  if (!(tin || tout || cw || cr)) return null;
  const base = usage.in != null ? tin : Math.max(0, tin - cw - cr);
  return (base * price.input + cw * price.input * CACHE_RATIO.write + cr * price.input * CACHE_RATIO.read + tout * price.output) / 1e6;
}
// somme de plusieurs usages (relevé en tuiles : un usage par appel)
export function addUsage(list) {
  const s = { in: 0, out: 0, cw: 0, cr: 0, usd: 0 };
  let known = true;
  for (const u of list) { if (!u) continue; s.in += u.in || 0; s.out += u.out || 0; s.cw += u.cw || 0; s.cr += u.cr || 0; const c = callCost(u); if (c == null) known = false; else s.usd += c; }
  if (!known) delete s.usd;
  return s;
}

const idOf = (x) => (x && typeof x.analyse === "object" ? x.analyse.id : x && x.analyse) || null;

// rapport d'un niveau → [{ id, mode, date, appels, ms, tin, tout, usd, zones, zooms, alertes, reste, ecarts }]
export function analysesOf(releve) {
  const out = new Map();
  for (const x of (releve && releve.rapport) || []) {
    const id = idOf(x);
    if (!id) continue;
    if (!out.has(id)) out.set(id, { id, mode: null, date: x.date, appels: 0, ms: 0, tin: 0, tout: 0, usd: 0, usdConnu: true, zones: 0, zooms: 0, alertes: null, reste: null, ecarts: 0, relectures: 0 });
    const A = out.get(id);
    if (x.type === "releve" && typeof x.analyse === "object") { A.mode = x.analyse.mode ?? A.mode; A.date = x.date; }
    if (x.tin != null || x.tout != null) A.appels += Array.isArray(x.appels) && x.appels.length ? x.appels.length : 1;
    if (x.type === "releve") { if (x.ecartsN) A.lectureEcarts = (A.lectureEcarts || 0) + x.ecartsN; if (x.tuilesKo) A.tuilesKo = x.tuilesKo; if (x.docs) A.docs = x.docs; }
    A.ms += +x.ms || 0; A.tin += +x.tin || 0; A.tout += +x.tout || 0;
    const c = Number.isFinite(x.usd) ? x.usd : callCost({ tin: x.tin, tout: x.tout, cw: x.cw, cr: x.cr });
    if (c == null) { if (x.tin != null || x.tout != null) A.usdConnu = false; } else A.usd += c;
    A.zones += +x.zones || 0; A.zooms += +x.zooms || 0;
    if (x.type === "relecture") {
      A.relectures++;
      if (A.alertes == null) A.alertes = x.total ?? null;
      if (x.reste != null) A.reste = x.reste;
      A.ecarts += (x.rows || []).filter((r) => r.state === "corrigé").length;
    }
  }
  return [...out.values()];
}

export const fmtUsd = (n) => (n == null ? "—" : (n < 0.01 && n > 0 ? "< 0,01" : n.toFixed(2).replace(".", ",")) + " USD");
export const fmtMs = (ms) => { const s = Math.round((ms || 0) / 1000); return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`; };
