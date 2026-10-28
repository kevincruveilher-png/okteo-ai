// Temps de travail BE et coûts d'un chantier (v63).
// - Temps : compté quand le logiciel est au premier plan et utilisé (souris, clavier, molette) ; au-delà de 2 min sans
//   rien faire, le compteur s'arrête. Gardé dans la fiche du chantier (meta.temps {be, ia, days}) : mode BE et mode IA
//   séparés, par jour. Coût = heures × coût horaire (Paramètres → Coûts d'un chantier).
// - IA : jetons renvoyés par l'API à chaque appel avec une clé (relevé et relectures), gardés dans cab.releves ; coût
//   d'après les prix par million de jetons saisis dans Paramètres (jamais écrits dans le code : ils changent).
import * as CHS from "../chantiers.js";
import { pref } from "../prefs.js";

const IDLE = 120000, TICK = 15000;

export function createTemps(api) {
  let last = Date.now();
  const act = () => { last = Date.now(); };
  ["pointerdown", "pointermove", "keydown", "wheel"].forEach((e) => document.addEventListener(e, act, { passive: true }));
  function add(sec, mode = pref("ui")) {
    const id = api.ch && api.ch.id, m = id && CHS.get(id);
    if (!m || !(sec > 0)) return null;
    const t = { be: 0, ia: 0, days: {}, ...(m.temps || {}) }, day = new Date().toISOString().slice(0, 10);
    t[mode === "ia" ? "ia" : "be"] = Math.round((t[mode === "ia" ? "ia" : "be"] || 0) + sec);
    t.days = { ...(t.days || {}), [day]: Math.round(((t.days || {})[day] || 0) + sec) };
    CHS.update(id, { temps: t });
    document.dispatchEvent(new CustomEvent("okteo:temps", { detail: t }));
    return t;
  }
  // toutes les 15 s : on compte le quart de minute si quelqu'un a travaillé dans les 2 dernières minutes
  const tick = () => (!document.hidden && Date.now() - last < IDLE ? add(TICK / 1000) : null);
  setInterval(tick, TICK);
  return { add, tick, get: () => tempsOf(api) };
}

export function tempsOf(api) {
  const m = api.ch && CHS.get(api.ch.id);
  return { be: 0, ia: 0, days: {}, ...((m && m.temps) || {}) };
}
export function fmtDur(sec) {
  const m = Math.round((sec || 0) / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
}
const eur = (v) => v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

// coût du temps BE : null si le coût horaire n'est pas renseigné
export function coutTemps(t) {
  const h = ((t.be || 0) + (t.ia || 0)) / 3600, taux = +pref("tauxHoraire") || 0;
  return { h, eur: taux > 0 ? h * taux : null, txt: taux > 0 ? eur(h * taux) : null };
}

// jetons de l'IA sur le chantier (tous niveaux) : relevé + relectures avec clé ; copier / coller = non compté
export function iaUsage(api) {
  const all = ((api.cab || {}).releves) || {};
  let tin = 0, tout = 0, calls = 0, paste = 0;
  for (const R of Object.values(all)) for (const x of R.rapport || []) {
    if (x.tin || x.tout) { tin += x.tin || 0; tout += x.tout || 0; calls++; }
    else if (x.tokens) { tin += x.tokens; calls++; }
    else if (x.type === "releve" || x.via === "copie") paste++;
  }
  const pi = +pref("prixIn") || 0, po = +pref("prixOut") || 0, e = pi > 0 || po > 0 ? (tin / 1e6) * pi + (tout / 1e6) * po : null;
  return { tin, tout, tokens: tin + tout, calls, paste, eur: e, txt: e != null ? eur(e) : null };
}

// estimation d'un relevé par l'IA avant de le lancer (image + consigne + réponse habituelle) ; formule de Claude pour
// les images : largeur × hauteur / 750 jetons (approchée ; le compte réel vient de l'API après l'appel)
export function estimateReleve({ W = 1568, H = 1100, promptChars = 5400, out = 9000 } = {}) {
  const tin = Math.round((W * H) / 750 + promptChars / 3.5), tout = out;
  const pi = +pref("prixIn") || 0, po = +pref("prixOut") || 0;
  return { tin, tout, tokens: tin + tout, eur: pi > 0 || po > 0 ? (tin / 1e6) * pi + (tout / 1e6) * po : null };
}
export const fmtTok = (n) => Math.round(n || 0).toLocaleString("fr-FR");
export const fmtEur = eur;
