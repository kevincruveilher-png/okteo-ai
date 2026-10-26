// Préférences d'affichage de ce PC (v42), partagées par le cœur et les extensions (Paramètres → Affichage).
// Rangées dans localStorage "okteo.prefs.v1" ; un changement émet "okteo:prefs" (le plan se redessine).
const KEY = "okteo.prefs.v1";

export const PREFS_DEFAULTS = {
  surfaces: false, // surface (m²) des pièces : sur le plan, dans les panneaux et à l'impression
  halos: true, // contrôle (v43) : halo orange animé autour des appareils à vérifier
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
