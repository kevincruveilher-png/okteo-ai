// Bibliothèque : métadonnées séparées des TYPES et des règles exécutées par le moteur.
// Modifier une fiche ne change ni le symbole natif, ni le câblage, ni la reconnaissance IA.
import { APPAREILS } from "../cablage/appareils.js";
import { norm, store, storeSet } from "./util.js";

const KEY = "okteo.symbols.v1";
const BASE_GROUPS = { PC16: "Prises", PC20: "Prises", RJ45: "Courant faible", LUM: "Éclairage", APP: "Éclairage", SPOT: "Éclairage", INT: "Commandes", VV: "Commandes", BP: "Commandes", VMC: "Chauffage et ventilation", TAB: "Tableau et distribution", SC: "Terre et attentes" };
const LINKS = {
  PC16: ["R-021", "R-098"], PC20: ["R-082", "R-084"], RJ45: ["R-003", "R-082", "R-084"],
  LUM: ["R-040", "R-041", "R-070"], APP: ["R-040", "R-041", "R-070"], SPOT: ["R-040", "R-041", "R-070"],
  INT: ["R-040", "R-070", "R-083"], VV: ["R-040", "R-071", "R-072"], BP: ["R-093"], TAB: ["R-050", "R-081"], SC: ["R-082"],
  VR: ["R-079", "R-087", "R-094", "R-096"], VEL: ["R-079", "R-096"], CVR: ["R-096"],
  HOTTE: ["R-084", "R-086", "R-098"], AIG: ["R-097"], EQP: ["R-080", "R-084"], EQL: ["R-080", "R-084"],
};
export const GROUPS = [...new Set([...Object.values(BASE_GROUPS), ...Object.values(APPAREILS).map((d) => d.groupe)])];
export function loadSymbols() {
  const s = store(KEY, null);
  return s && s.version === 1 && Array.isArray(s.be) && s.overrides && typeof s.overrides === "object" ? s : { version: 1, overrides: {}, be: [{ id: "be-kichouh-32a", origin: "be", name: "Prise 32 A — dessin BE à fournir", category: "Cuisine et spécialisés", type: "", image: "", source: "Retour de Kévin · test KICHOUH · 29/10/2026", rules: ["R-084"], notes: "L’IA a remplacé la prise 32 A par une PC20 lors du relevé. Le type plaque existe sous PLAQ. Fournir le dessin original BE pour vérifier sa reconnaissance ; aucun dessin BE n’est inventé ici." }], history: [] };
}
export function saveSymbols(s) { return storeSet(KEY, s); }
export function symbolEntries(types, s) {
  return Object.entries(types).map(([id, d]) => ({
    id, type: id, origin: "okteo", name: d.n, category: BASE_GROUPS[id] || APPAREILS[id]?.groupe || "Autres",
    rules: LINKS[id] || (APPAREILS[id] ? ["R-084"] : []), notes: "", source: "Catalogue actuel d’Oktéo",
    ...s.overrides[id],
  })).concat(s.be);
}
export function filterSymbols(entries, { q = "", origin = "", category = "" }) {
  const words = norm(q).split(/\s+/).filter(Boolean);
  return entries.filter((d) => (!origin || d.origin === origin) && (!category || d.category === category) &&
    words.every((w) => norm([d.name, d.id, d.category, d.source, d.notes, ...(d.rules || [])].join(" ")).includes(w)));
}
export function deviceInfo(type) { return APPAREILS[type] || null; }
