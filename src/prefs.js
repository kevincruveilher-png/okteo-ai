// Préférences d'affichage de ce PC (v42), partagées par le cœur et les extensions (Paramètres → Affichage).
// Rangées dans localStorage "okteo.prefs.v1" ; un changement émet "okteo:prefs" (le plan se redessine).
const KEY = "okteo.prefs.v1";

export const PREFS_DEFAULTS = {
  ouvrants: false, // battants et arcs ; les passages restent ouverts
  parcours: false, // alimentations et lignes directes complètes au lieu des flèches
  surfaces: false, // surface (m²) des pièces : sur le plan, dans les panneaux et à l'impression
  halos: true, // contrôle (v43) : halo orange animé autour des appareils à vérifier
  relectures: 2, // v57 : relectures automatiques par l'IA (avec clé) après un relevé, 0 à 3
  ui: "be", // v63 : interface « be » (complète) ou « ia » (simplifiée, centrée sur l'IA)
  prixIn: 0, // v63 : prix des jetons d'entrée de l'IA, € par million (0 = non renseigné)
  prixOut: 0, // v63 : prix des jetons de sortie, € par million
  tauxHoraire: 0, // v63 : coût horaire du technicien BE, € / h (0 = non renseigné)
  charteBE: true, // v74 MAJ 4 : plan à l'écran aux symboles du BE (FTZ) et gaines à la couleur de leur boîte
  grilleIA: "auto", // v76 : grille des tuiles des modes 2 à 4 (« auto » : 4 × 3 en paysage, 3 × 4 en portrait, sinon 3 × 3 ; ou « 3x3 », « 4x4 »)
  tuilesParallele: 2, // v76 : tuiles envoyées en même temps (1 à 10) ; à régler sur « Analyses simultanées » de l'entreprise
  zoomsIA: 12, // v76 : zooms à la demande au plus par plan (3 au plus par tuile)
  // n° 3 : « Analyse IA » : seulement le mode 4 à l'écran (« tous » : les 4 modes, pour comparer) ; tours d'outils au plus
  modesIA: "4", toursOutils: 8,
  // 3D-3 : hauteurs de départ de la vue 3D (cm), quand le dessin ne les donne pas (réglables dans Paramètres → Vue 3D)
  h3dPlafond: 250, h3dAllege: 90, h3dLinteau: 215, h3dPorte: 204, h3dBaie: 215, h3dGarage: 220,
  // n° 14 : autocorrection des murs (Paramètres → Murs) : angle léger mis d'équerre, tolérance autour de 45°, déplacement
  // au-delà duquel le mur corrigé est signalé (cm)
  equerreTol: 10, equerre45: 10, equerreMax: 15,
  abrev: "", // v74 : abréviations des noms de pièces du plan imprimé (vide = table par défaut, src/print/abrev.js)
};

export function getPrefs() {
  try { return { ...PREFS_DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) || "{}") || {}) }; } catch { return { ...PREFS_DEFAULTS }; }
}
export const pref = (k) => getPrefs()[k];
export function setPref(k, v) {
  const p = { ...getPrefs(), [k]: v };
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* stockage indisponible : réglage pour cette session seulement */ }
  document.dispatchEvent(new CustomEvent("okteo:prefs", { detail: { key: k, value: v } }));
  return p;
}
