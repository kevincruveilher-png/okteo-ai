// Diamètre de gaine (ICTA) — règle R-074 du journal des règles. v52 : somme des sections (7,5 / 13,5 mm²) ; depuis le
// 06/11/2026 (lot 2) : place occupée par les fils, méthode du BE (voir plus bas). Au-delà de l'ICTA 20 : doute (le logiciel
// ne choisit pas). Capacités réglables (Paramètres → Fils, câbles et gaines : icta16, icta20).
// Ancienne méthode (v28–v51, surface des fils × remplissage) : gardée pour l'affichage du taux de remplissage seulement.

// diamètre extérieur des fils H07V-U (mm), valeurs usuelles des fabricants
export const FIL_OD = { 1.5: 3.0, 2.5: 3.6, 4: 4.2, 6: 4.8, 10: 6.1, 16: 7.2 };
// gaines ICTA : diamètre nominal → diamètre intérieur (mm)
export const GAINES = [[16, 10.7], [20, 14.1], [25, 18.3], [32, 24.3], [40, 31.2]];
const surf = (d) => Math.PI * d * d / 4;
export function filsSurface(fils) { return fils.reduce((s, sec) => s + surf(FIL_OD[sec] || Math.sqrt(sec) * 2.4), 0); }
export function tauxRemplissage(fils, nom) { const g = GAINES.find((x) => x[0] === nom); return g ? Math.round(filsSurface(fils) / surf(g[1]) * 100) : null; }

// Lot 2 (reprise FTZ, 06/11/2026, décision n° 38 de Kévin) : remplissage par la PLACE OCCUPÉE (« encombrement » du BE),
// plus par la somme des sections de cuivre. Place d'un fil (mm²) : 1,5 → 8,6 ; 2,5 → 11,9 ; 6 → 22,9 ; 10 → 36,3 ;
// 16 → 50,3 ; 25 → 75,4 (4 mm² : estimé entre 2,5 et 6). Capacité d'une gaine (même échelle) : ICTA 16 → 44 ; ICTA 20 → 90 ;
// ICTA 25 → 155 ; ICTA 32 → 200. Un câble compte pour sa place à lui (catalogue des câbles du BE, PLACE_CABLE).
export const PLACE_FIL = { 1.5: 8.6, 2.5: 11.9, 4: 16.6, 6: 22.9, 10: 36.3, 16: 50.3, 25: 75.4 };
export const placeFil = (sec) => PLACE_FIL[+sec] ?? +(8.6 * Math.max(1, +sec || 1.5) / 1.5).toFixed(1);
// place d'un câble (« 3G1,5 », « 4x1,5 »…) : 35 petits câbles ; 70 (4G / 5G 1,5, câbles 2,5, 3G4, 3G6) ; 130 (4G / 5G 4,
// 5G6, 5G16, 2X16) ; 170 (10 mm², 3G16) ; courant faible : 35
export function placeCable(name) {
  const m = /^(\d+)\s*([gGxX])\s*([\d.,]+)/.exec(String(name || "").replace(/\s+/g, ""));
  if (!m) return 35;
  const n = +m[1], sec = +m[3].replace(",", ".");
  if (sec <= 1.5) return n <= 3 ? 35 : 70;
  if (sec <= 2.5) return 70;
  if (sec <= 4) return n <= 3 ? 70 : 130;
  if (sec <= 6) return n <= 3 ? 70 : 130;
  if (sec <= 10) return 170;
  return n <= 3 ? 170 : 130;
}
export const placeFils = (fils) => +fils.reduce((s, x) => s + placeFil(x), 0).toFixed(1);
// capacités (place) : [[diamètre, capacité]…], du plus petit au plus grand ; icta16 / icta20 réglables (Paramètres)
export function capacities(S) {
  const c16 = S && +S.icta16 > 0 ? +S.icta16 : 44, c20 = S && +S.icta20 > 0 ? +S.icta20 : 90;
  return [[16, c16], [20, c20]];
}
export const sumSections = (fils) => +fils.reduce((s, x) => s + (+x || 0), 0).toFixed(2);
// fils : liste des sections (mm²) ; S : réglages (icta16, icta20) ; o.cable : nom du câble si la gaine est un câble
// → 16 | 20 | 25 | null (au-delà de l'ICTA 20 : doute R-074, jamais d'ICTA 25 dans une boîte — sauf les lignes de gros fils)
// exceptions (Kévin, 27/10/2026, Q-79 et Q-81) : lignes B + R + V/J de 6 mm² → ICTA 20, de 10 mm² → ICTA 25
export const GROS_FILS = { 6: 20, 10: 25 };
export function gaineFor(fils, S, o = {}) {
  if (!o.cable && fils.length && fils.length <= 3 && fils.every((x) => +x === +fils[0]) && GROS_FILS[+fils[0]]) return GROS_FILS[+fils[0]];
  const place = o.cable ? placeCable(o.cable) : placeFils(fils);
  for (const [nom, cap] of capacities(typeof S === "object" ? S : null)) if (place <= cap + 1e-9) return nom;
  return null;
}

// Gaine(s) d'alimentation d'une boîte (R-010, R-075) : UNE gaine pour tous les circuits de la boîte — phase + neutre de
// chaque circuit, fils du télérupteur, une seule terre (de la plus forte section) ; divisée seulement si elle dépasse la
// capacité de l'ICTA 20 (la terre reste dans la 1re). circs = [{ id, section, extra }] → groupes de circuits, un par gaine
export function packAlim(circs, S) {
  const cap = capacities(typeof S === "object" ? S : null).at(-1)[1];
  const maxSec = Math.max(1.5, ...circs.map((c) => c.section || 1.5));
  const secs = (g, withT) => [...g.flatMap((c) => Array(2 + (c.extra || 0)).fill(c.section || 1.5)), ...(withT ? [maxSec] : [])];
  const groups = [];
  let cur = [];
  for (const c of circs) {
    if (cur.length && placeFils(secs([...cur, c], !groups.length)) > cap + 1e-9) { groups.push(cur); cur = []; }
    cur.push(c);
  }
  if (cur.length) groups.push(cur);
  return groups;
}
