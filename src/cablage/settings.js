// Réglages du câblage (pieuvre) — valeurs de base décidées avec Kévin le 25/10/2026, toutes modifiables
// dans Paramètres → Câblage. Enregistrés sur ce PC (localStorage), communs à tous les chantiers.
export const CAB_DEFAULTS = {
  // boîtes
  departsMax: 18,          // gaines par boîte, toutes faces confondues
  departsFace: 6,          // gaines par face (A, B, C, D)
  bornes: "2,3,4,5,6,8,10,12",    // connecteurs rapides disponibles (nombre d'entrées), pour le schéma de boîte
  piecesMinDeparts: 3,     // mode « par pièce » : une pièce avec moins de départs rejoint la pièce voisine
  // longueurs
  hsp: 2.5,                // hauteur sous plafond (m)
  traversee: 0.3,          // plancher / isolation à traverser entre la boîte et le haut du mur (m)
  margeBoite: 0.3,         // surlongueur côté boîte (m)
  margeApp: 0.2,           // surlongueur côté appareil (m)
  majoration: 10,          // tracé dans les combles : ligne droite légèrement arrondie (+ %)
  arrondi: 0.1,            // longueur arrondie au … supérieur (m)
  hTableau: 1.8,           // hauteur du haut du tableau (m) : les gaines du tableau montent de là vers les combles
  // gaines
  remplissage: 40,         // surface des fils / surface intérieure de la gaine, maximum (%)
  // circuits (NF C 15-100) — v38, règles KiTéOHM : prises ordinaires en 1,5 mm² (16 A, 8 max), prises de cuisine en
  // 2,5 mm² sur leur circuit (20 A, 6 max), éclairage en 1,5 mm² (8 points max) ; dans une boîte : un circuit prises, un
  // circuit cuisine s'il y en a, un circuit éclairage (un de plus seulement au-delà des limites de la norme)
  maxPoints: 8,            // points d'éclairage par circuit
  maxPrises: 8,            // prises 16 A par circuit
  maxPrisesCuisine: 6,     // prises de cuisine par circuit
  secEclairage: 1.5, protEclairage: 16,
  secPrises: 1.5, protPrises: 16,
  secCuisine: 2.5, protCuisine: 20,
  motsCuisine: "cuisine",  // pièces dont les prises 16 A sont des prises de cuisine (mots séparés par des virgules)
  secSpecialise: 2.5, protSpecialise: 20,
  scSpecialise: true,      // une sortie de câble = un circuit spécialisé (sèche-serviettes, volet…)
  vmcCablee: false,        // « VMC » sur le plan = bouche d'extraction (pas de câble) ; cocher si c'est le groupe VMC
  circuitsParBoite: true,  // une fois les boîtes placées, les circuits suivent les boîtes (chaque boîte ses circuits)
  // couleurs des fils
  cPhase: "rouge", cNeutre: "bleu", cTerre: "vert/jaune", cRetour: "orange", cNavette1: "violet", cNavette2: "noir",
  // v38 : phase/neutre par type de circuit (deux circuits du même type dans une boîte : mêmes couleurs, bagues différentes)
  couleursPrises: "gris/bleu foncé",
  couleursEclairage: "rouge/bleu",
  couleursCuisine: "rouge/bleu",
  couleursSpecialise: "rouge/bleu",
  // ronde des fils : retours lampe, navettes (les deux de même couleur) et commandes de télérupteur prennent la couleur
  // suivante, dans chaque boîte en repartant du début ; même ordre dans toutes les boîtes (fabrication en série)
  couleursCommande: "orange, violet, noir, marron, ivoire",
  bagues: true,            // bague numérotée sur chaque circuit de la gaine d'alimentation (n° du circuit, T1… télérupteur)
  memeEndroit: 0.3,        // appareils à moins de … m l'un de l'autre = même endroit = une seule gaine (repiquage)
  cableExt: true,          // appareil à l'extérieur : câble dans la gaine
  cablesStock: "3G1,5, 3G2,5, 3x1,5, 4G1,5, 4G2,5, 5G1,5, 5G2,5",
  cableBleuLibre: false,   // câble sans neutre : le bleu peut servir de phase ou de retour (sinon : câble plus gros, fil isolé)
};

// v38 : anciens réglages enregistrés avec les valeurs de base de l'époque → remplacés par les nouvelles valeurs de base
const CAB_V = 2;
const OLD_DEFAULTS = { secPrises: 2.5, protPrises: 20, couleursCommande: "orange, marron, noir, ivoire" };

const KEY = "okteo.cablage.v1";
export function getCab() {
  let v = {};
  try { v = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { v = {}; }
  if ((v._v || 1) < CAB_V) for (const [k, old] of Object.entries(OLD_DEFAULTS)) if (v[k] === old) delete v[k];
  return { ...CAB_DEFAULTS, ...v, _v: CAB_V };
}
export function setCab(patch) {
  const v = { ...getCab(), ...patch, _v: CAB_V };
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* */ }
  document.dispatchEvent(new CustomEvent("okteo:cab-settings"));
  return v;
}
export function resetCab() { try { localStorage.removeItem(KEY); } catch { /* */ } document.dispatchEvent(new CustomEvent("okteo:cab-settings")); return getCab(); }

// fiche des réglages affichée dans Paramètres (v42 : groupes dans l'ordre du travail, avec une aide) :
// [titre du groupe, [[clé, libellé, unité, type]…], aide]
export const CAB_FIELDS = [
  ["Circuits (NF C 15-100)", [["maxPoints", "Points d'éclairage par circuit", "max", "int"], ["maxPrises", "Prises 16 A par circuit", "max", "int"],
    ["maxPrisesCuisine", "Prises de cuisine par circuit", "max", "int"], ["motsCuisine", "Pièces « cuisine » (mots du nom, séparés par des virgules)", "", "txt"],
    ["circuitsParBoite", "Les circuits suivent les boîtes (chaque boîte : prises, cuisine, éclairage)", "", "bool"],
    ["secEclairage", "Section éclairage", "mm²", "sec"], ["protEclairage", "Protection éclairage", "A", "prot"],
    ["secPrises", "Section prises", "mm²", "sec"], ["protPrises", "Protection prises", "A", "prot"],
    ["secCuisine", "Section prises de cuisine", "mm²", "sec"], ["protCuisine", "Protection prises de cuisine", "A", "prot"],
    ["secSpecialise", "Section circuits spécialisés", "mm²", "sec"], ["protSpecialise", "Protection circuits spécialisés", "A", "prot"],
    ["scSpecialise", "Une sortie de câble = un circuit spécialisé", "", "bool"], ["vmcCablee", "« VMC » = groupe VMC à alimenter (sinon : bouche, pas de câble)", "", "bool"]],
    "Nombre d'appareils par circuit, sections et protections : servent à la répartition en circuits (panneau Câblage)."],
  ["Couleurs des fils", [["couleursEclairage", "Éclairage : phase/neutre", "", "txt"], ["couleursPrises", "Prises : phase/neutre", "", "txt"],
    ["couleursCuisine", "Prises de cuisine : phase/neutre", "", "txt"], ["couleursSpecialise", "Lignes directes : phase/neutre", "", "txt"], ["cTerre", "Terre", "", "txt"],
    ["couleursCommande", "Ronde des fils : retours lampe, navettes, commandes de télérupteur (dans l'ordre)", "", "txt"],
    ["bagues", "Bagues numérotées sur l'alimentation (n° du circuit, T1… pour le télérupteur)", "", "bool"]],
    "Couleurs écrites sur les bandes et les schémas de boîte (règles KiTéOHM)."],
  ["Boîtes", [["departsMax", "Départs par boîte (toutes faces)", "gaines", "int"], ["departsFace", "Départs par face (A, B, C, D)", "gaines", "int"],
    ["bornes", "Connecteurs rapides disponibles (nombre d'entrées, séparés par des virgules)", "", "txt"],
    ["piecesMinDeparts", "Pieuvre par pièce : gaines d'appareils minimum pour qu'une pièce ait sa boîte (sinon elle rejoint la voisine)", "départs", "int"]],
    "Capacité d'une boîte et connecteurs utilisés pour les raccordements."],
  ["Gaines et câbles", [["remplissage", "Remplissage maximum de la gaine", "%", "num"],
    ["memeEndroit", "Appareils au même endroit (une seule gaine) : distance maximum", "m", "num"],
    ["cableExt", "Appareil à l'extérieur : câble dans la gaine", "", "bool"], ["cablesStock", "Câbles en stock (le plus petit qui convient est choisi)", "", "txt"],
    ["cableBleuLibre", "Câble sans neutre : le bleu peut servir de phase ou de retour (sinon câble plus gros, fil en trop isolé)", "", "bool"]],
    "Diamètre des gaines, gaines partagées et câbles pour l'extérieur."],
  ["Longueurs des gaines", [["hsp", "Hauteur sous plafond", "m", "num"], ["traversee", "Traversée plancher / isolation", "m", "num"],
    ["margeBoite", "Surlongueur côté boîte", "m", "num"], ["margeApp", "Surlongueur côté appareil", "m", "num"],
    ["majoration", "Tracé dans les combles (ligne droite arrondie)", "+ %", "num"], ["arrondi", "Arrondir la longueur au … supérieur", "m", "num"],
    ["hTableau", "Hauteur du haut du tableau", "m", "num"]],
    "Longueur d'une gaine = tracé dans les combles + descentes + surlongueurs, arrondie."],
];
export const SECTIONS = [1.5, 2.5, 4, 6, 10];
export const PROTS = [2, 10, 16, 20, 25, 32, 40];
