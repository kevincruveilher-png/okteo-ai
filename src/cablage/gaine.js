// Diamètre de gaine (ICTA) — règle R-074 du journal des règles (v52) : on additionne les sections des fils.
// Somme ≤ 7,5 mm² → ICTA 16 (5 × 1,5 ou 3 × 2,5) ; ≤ 13,5 mm² → ICTA 20 ; au-delà : pas de règle → doute (le logiciel ne
// choisit pas). Capacités réglables (Paramètres → Câblage : icta16, icta20). Vérifié par Kévin sur les bandes de 4 chantiers.
// Ancienne méthode (v28–v51, surface des fils × remplissage) : gardée pour l'affichage du taux de remplissage seulement.

// diamètre extérieur des fils H07V-U (mm), valeurs usuelles des fabricants
export const FIL_OD = { 1.5: 3.0, 2.5: 3.6, 4: 4.2, 6: 4.8, 10: 6.1, 16: 7.2 };
// gaines ICTA : diamètre nominal → diamètre intérieur (mm)
export const GAINES = [[16, 10.7], [20, 14.1], [25, 18.3], [32, 24.3], [40, 31.2]];
const surf = (d) => Math.PI * d * d / 4;
export function filsSurface(fils) { return fils.reduce((s, sec) => s + surf(FIL_OD[sec] || Math.sqrt(sec) * 2.4), 0); }
export function tauxRemplissage(fils, nom) { const g = GAINES.find((x) => x[0] === nom); return g ? Math.round(filsSurface(fils) / surf(g[1]) * 100) : null; }

// capacités (mm², somme des sections) : [[diamètre, capacité]…], du plus petit au plus grand
export function capacities(S) {
  const c16 = S && +S.icta16 > 0 ? +S.icta16 : 7.5, c20 = S && +S.icta20 > 0 ? +S.icta20 : 13.5;
  return [[16, c16], [20, c20]];
}
export const sumSections = (fils) => +fils.reduce((s, x) => s + (+x || 0), 0).toFixed(2);
// fils : liste des sections (mm²) ; S : réglages (icta16, icta20) — un nombre seul (ancien « remplissage ») est ignoré.
// → 16 | 20 | null (au-delà de la plus grande capacité connue : doute R-074)
// exceptions de R-074 (Kévin, 27/10/2026, Q-79 et Q-81) : lignes B + R + V/J de grosse section
export const GROS_FILS = { 6: 20, 10: 25 };
export function gaineFor(fils, S) {
  const sum = sumSections(fils);
  if (fils.length && fils.length <= 3 && fils.every((x) => +x === +fils[0]) && GROS_FILS[+fils[0]]) return GROS_FILS[+fils[0]];
  for (const [nom, cap] of capacities(typeof S === "object" ? S : null)) if (sum <= cap + 1e-9) return nom;
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
    if (cur.length && sumSections(secs([...cur, c], !groups.length)) > cap + 1e-9) { groups.push(cur); cur = []; }
    cur.push(c);
  }
  if (cur.length) groups.push(cur);
  return groups;
}
