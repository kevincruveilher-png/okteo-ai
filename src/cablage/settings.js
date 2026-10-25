// Réglages du câblage (pieuvre) — valeurs de base décidées avec Kévin le 25/10/2026, toutes modifiables
// dans Paramètres → Câblage. Enregistrés sur ce PC (localStorage), communs à tous les chantiers.
export const CAB_DEFAULTS = {
  // boîtes
  departsMax: 18,          // gaines par boîte, toutes faces confondues
  departsFace: 6,          // gaines par face (A, B, C, D)
  // longueurs
  hsp: 2.5,                // hauteur sous plafond (m)
  traversee: 0.3,          // plancher / isolation à traverser entre la boîte et le haut du mur (m)
  margeBoite: 0.3,         // surlongueur côté boîte (m)
  margeApp: 0.2,           // surlongueur côté appareil (m)
  majoration: 10,          // tracé dans les combles : ligne droite légèrement arrondie (+ %)
  arrondi: 0.1,            // longueur arrondie au … supérieur (m)
  // gaines
  remplissage: 40,         // surface des fils / surface intérieure de la gaine, maximum (%)
  // circuits (NF C 15-100)
  maxPoints: 8,            // points d'éclairage par circuit
  maxPrises: 8,            // prises 16 A par circuit
  secEclairage: 1.5, protEclairage: 16,
  secPrises: 2.5, protPrises: 20,
  secSpecialise: 2.5, protSpecialise: 20,
  scSpecialise: true,      // une sortie de câble = un circuit spécialisé (sèche-serviettes, volet…)
  vmcCablee: false,        // « VMC » sur le plan = bouche d'extraction (pas de câble) ; cocher si c'est le groupe VMC
  // couleurs des fils
  cPhase: "rouge", cNeutre: "bleu", cTerre: "vert/jaune", cRetour: "orange", cNavette1: "violet", cNavette2: "noir",
};

const KEY = "okteo.cablage.v1";
export function getCab() {
  let v = {};
  try { v = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { v = {}; }
  return { ...CAB_DEFAULTS, ...v };
}
export function setCab(patch) {
  const v = { ...getCab(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* */ }
  document.dispatchEvent(new CustomEvent("okteo:cab-settings"));
  return v;
}
export function resetCab() { try { localStorage.removeItem(KEY); } catch { /* */ } document.dispatchEvent(new CustomEvent("okteo:cab-settings")); return getCab(); }

// fiche des réglages affichée dans Paramètres : [clé, libellé, unité, type, options]
export const CAB_FIELDS = [
  ["Boîtes", [["departsMax", "Départs par boîte (toutes faces)", "gaines", "int"], ["departsFace", "Départs par face (A, B, C, D)", "gaines", "int"]]],
  ["Longueurs des gaines", [["hsp", "Hauteur sous plafond", "m", "num"], ["traversee", "Traversée plancher / isolation", "m", "num"],
    ["margeBoite", "Surlongueur côté boîte", "m", "num"], ["margeApp", "Surlongueur côté appareil", "m", "num"],
    ["majoration", "Tracé dans les combles (ligne droite arrondie)", "+ %", "num"], ["arrondi", "Arrondir la longueur au … supérieur", "m", "num"]]],
  ["Gaines", [["remplissage", "Remplissage maximum de la gaine", "%", "num"]]],
  ["Circuits (NF C 15-100)", [["maxPoints", "Points d'éclairage par circuit", "max", "int"], ["maxPrises", "Prises 16 A par circuit", "max", "int"],
    ["secEclairage", "Section éclairage", "mm²", "sec"], ["protEclairage", "Protection éclairage", "A", "prot"],
    ["secPrises", "Section prises", "mm²", "sec"], ["protPrises", "Protection prises", "A", "prot"],
    ["secSpecialise", "Section circuits spécialisés", "mm²", "sec"], ["protSpecialise", "Protection circuits spécialisés", "A", "prot"],
    ["scSpecialise", "Une sortie de câble = un circuit spécialisé", "", "bool"], ["vmcCablee", "« VMC » = groupe VMC à alimenter (sinon : bouche, pas de câble)", "", "bool"]]],
  ["Couleurs des fils", [["cPhase", "Phase", "", "txt"], ["cNeutre", "Neutre", "", "txt"], ["cTerre", "Terre", "", "txt"],
    ["cRetour", "Retour lampe", "", "txt"], ["cNavette1", "Navette 1", "", "txt"], ["cNavette2", "Navette 2", "", "txt"]]],
];
export const SECTIONS = [1.5, 2.5, 4, 6, 10];
export const PROTS = [2, 10, 16, 20, 25, 32, 40];
