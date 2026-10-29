// Types d'appareils ajoutés en v54 (journal des règles R-084, R-079, R-086, R-087, R-093 à R-097), relevés sur les bandes
// FTZ de 4 chantiers et validés par Kévin le 27/10/2026. Pur (sans DOM) : partagé par le cœur (types, symboles, pose)
// et le moteur de câblage (circuits, gaines, lignes directes).
//
// Pour chaque type :
//   n (nom), r (famille du repère), h (hauteur de pose en cm, null = plafond / combles), lab (texte du symbole),
//   groupe (menu « Autres appareils »), mural (posé contre un mur),
//   racc : "direct" (ligne directe du tableau), "boite" (dans une boîte de pieuvre), "choix" (R-086 : boîte ou ligne directe),
//   lignes : [{ fils: "2,5 B+R+V/J" | cable: "3G2,5", gaine: 16 | 20 | "V20" (verte, courant faible) | 40 | null (sans gaine) }]
//   variantes : autres raccordements possibles (« câble ou fils et section modifiables », R-084) [{ id, label, lignes }]
//   circuit : { section, prot } pour une ligne directe protégée par un disjoncteur ; absent = ligne sans disjoncteur
//   faible : courant faible (jamais avec le courant fort, R-003)
// Lettres des fils (comme sur les bandes FTZ) : B bleu (clair), BF bleu foncé, R rouge, GR gris, N noir, M marron,
// IV ivoire, O orange, V violet, V/J vert/jaune.
export const LETTRES = { B: "bleu", BF: "bleu foncé", R: "rouge", GR: "gris", N: "noir", M: "marron", IV: "ivoire", O: "orange", V: "violet", "V/J": "vert/jaune" };
export const COULEUR_LETTRE = Object.fromEntries(Object.entries(LETTRES).map(([k, v]) => [v, k]));

// v56 (R-096) : volets connectés (choix du BE pour le chantier) : les commandes de volet (CVR) dessinées sur le plan ne
// sont pas câblées ; chaque moteur reçoit seulement gris + bleu clair + vert/jaune
export const sansCvr = (items, S) => (S && S.voletsConnectes ? items.filter((a) => a.t !== "CVR") : items);
export const GROUPES = ["Chauffage et ventilation", "Cuisine et spécialisés", "Extérieur", "Volets roulants", "Courant faible", "Terre et attentes"];

export const APPAREILS = {
  PC32: { n: "Prise / sortie 32 A (usage à préciser)", r: "P", h: 30, lab: "32", groupe: "Cuisine et spécialisés", mural: true, racc: "direct", lignes: [{ fils: "6 R+B+V/J", gaine: 20 }], circuit: { section: 6, prot: 32 } },
  RAD: { n: "Radiateur (convecteur, fil pilote)", r: "C", h: 30, lab: "RAD", groupe: "Chauffage et ventilation", mural: true, racc: "direct", lignes: [{ fils: "1,5 B+N+M+V/J", gaine: 16 }], circuit: { section: 1.5, prot: 16 } },
  SS: { n: "Sèche-serviette", r: "SS", h: 30, lab: "SS", groupe: "Chauffage et ventilation", mural: true, racc: "direct", lignes: [{ fils: "1,5 BF+M+V/J", gaine: 16 }], circuit: { section: 1.5, prot: 10 } },
  VEX: { n: "Bouche extraction VMC", r: "EX", h: null, lab: "EX", groupe: "Chauffage et ventilation", racc: "aucun", lignes: [] },
  VREJ: { n: "Rejet VMC toiture", r: "REJ", h: null, lab: "REJ", groupe: "Chauffage et ventilation", racc: "aucun", lignes: [] },
  VMCG: { n: "Caisson VMC", r: "VMC", h: null, lab: "VMC", groupe: "Chauffage et ventilation", racc: "direct", lignes: [{ fils: "1,5 R+B+V/J", gaine: 16 }], circuit: { section: 1.5, prot: 2 } },
  CVMC: { n: "Commande VMC", r: "C VMC", h: 110, lab: "CV", groupe: "Chauffage et ventilation", mural: true, racc: "direct", lignes: [{ fils: "1,5 GR+N", gaine: 16 }] },
  CLIM: { n: "Climatisation", r: "CLIM", h: null, lab: "CLI", groupe: "Chauffage et ventilation", racc: "direct", lignes: [{ cable: "4G1,5", gaine: 20 }], circuit: { section: 1.5, prot: 16 } },
  AQA: { n: "Module Aqua Air (pompe à chaleur)", r: "AQUA AIR", h: null, lab: "AQA", groupe: "Chauffage et ventilation", racc: "direct", lignes: [{ cable: "3G2,5", gaine: 20 }, { cable: "3x1,5", gaine: 16, label: "pilotage" }], circuit: { section: 2.5, prot: 20 } },
  BOUCHE: { n: "Bouche de diffusion motorisée", r: "K", h: null, lab: "K", groupe: "Chauffage et ventilation", faible: true, racc: "direct", lignes: [{ cable: "YSYT 2×1 souple", gaine: null }] },
  FOUR: { n: "Four", r: "FOUR", h: 30, lab: "FO", groupe: "Cuisine et spécialisés", mural: true, racc: "direct", lignes: [{ fils: "2,5 B+R+V/J", gaine: 16 }], circuit: { section: 2.5, prot: 20 } },
  LL: { n: "Lave-linge", r: "LL", h: 30, lab: "LL", groupe: "Cuisine et spécialisés", mural: true, racc: "direct", lignes: [{ fils: "2,5 B+R+V/J", gaine: 16 }], circuit: { section: 2.5, prot: 20 } },
  LV: { n: "Lave-vaisselle", r: "LV", h: 30, lab: "LV", groupe: "Cuisine et spécialisés", mural: true, racc: "direct", lignes: [{ fils: "2,5 B+R+V/J", gaine: 16 }], circuit: { section: 2.5, prot: 20 } },
  SL: { n: "Sèche-linge", r: "SL", h: 30, lab: "SL", groupe: "Cuisine et spécialisés", mural: true, racc: "direct", lignes: [{ fils: "2,5 B+R+V/J", gaine: 16 }], circuit: { section: 2.5, prot: 20 } },
  PLAQ: { n: "Plaque de cuisson", r: "PLAQUES", h: 30, lab: "PL", groupe: "Cuisine et spécialisés", mural: true, racc: "direct", lignes: [{ fils: "6 R+B+V/J", gaine: 20 }], circuit: { section: 6, prot: 32 } },
  HOTTE: { n: "Hotte", r: "HOTTE", h: 200, lab: "HO", groupe: "Cuisine et spécialisés", mural: true, racc: "choix", lignes: [{ fils: "2,5 B+R+V/J", gaine: 16 }], circuit: { section: 2.5, prot: 20 } },
  CETH: { n: "Chauffe-eau thermodynamique", r: "CETH", h: null, lab: "CE", groupe: "Cuisine et spécialisés", racc: "direct", lignes: [{ cable: "3G2,5", gaine: 20 }], variantes: [{ id: "fils", label: "fils 2,5 B+R+V/J en ICTA 16", lignes: [{ fils: "2,5 B+R+V/J", gaine: 16 }] }], circuit: { section: 2.5, prot: 20 } },
  MGAR: { n: "Moteur de garage", r: "MOTEUR", h: 220, lab: "MG", groupe: "Cuisine et spécialisés", racc: "direct", lignes: [{ fils: "1,5 GR+BF+V/J", gaine: 16 }], circuit: { section: 1.5, prot: 16 } },
  ICOUP: { n: "Interrupteur de coupure", r: "I COUPURE", h: 110, lab: "IC", groupe: "Cuisine et spécialisés", mural: true, racc: "direct", lignes: [{ fils: "1,5 R+N", gaine: 16 }] },
  PCEXT: { n: "Prise extérieure", r: "PC EXT", h: 30, lab: "PE", groupe: "Extérieur", mural: true, racc: "direct", lignes: [{ cable: "3G2,5", gaine: 20 }], variantes: [{ id: "fils", label: "fils 2,5 B+R+V/J en ICTA 16", lignes: [{ fils: "2,5 B+R+V/J", gaine: 16 }] }], circuit: { section: 2.5, prot: 16 } },
  GEXT: { n: "Prise de garage extérieure (G EXT)", r: "G EXT", h: 30, lab: "GE", groupe: "Extérieur", mural: true, racc: "direct", lignes: [{ cable: "3G2,5", gaine: 20 }], variantes: [{ id: "3g15", label: "câble 3G1,5 en ICTA 16", lignes: [{ cable: "3G1,5", gaine: 16 }] }], circuit: { section: 2.5, prot: 16 } },
  PX4: { n: "Prise extérieure pilotée (4G1,5)", r: "PC EXT", h: 30, lab: "P4", groupe: "Extérieur", mural: true, racc: "direct", lignes: [{ cable: "4G1,5", gaine: 20 }], circuit: { section: 1.5, prot: 16 } },
  VR: { n: "Volet roulant (moteur)", r: "VR", h: 220, lab: "VR", groupe: "Volets roulants", racc: "boite", volet: true, p: 50 },
  VEL: { n: "Velux motorisé", r: "VEL", h: null, lab: "VEL", groupe: "Volets roulants", racc: "boite", volet: true, p: 50 },
  CVR: { n: "Commande de volet roulant (CVR)", r: "CVR", h: 110, lab: "CVR", groupe: "Volets roulants", mural: true, racc: "boite", voletCmd: true },
  INTERCO: { n: "Interphone", r: "INTERCO", h: 150, lab: "IN", groupe: "Courant faible", mural: true, faible: true, racc: "direct", lignes: [{ cable: "4G1,5", gaine: 20 }], variantes: [{ id: "7g15", label: "câble 7G1,5", lignes: [{ cable: "7G1,5", gaine: 20 }] }] },
  TV: { n: "Prise TV", r: "TV", h: 30, lab: "TV", groupe: "Courant faible", mural: true, faible: true, racc: "direct", lignes: [{ cable: "17 VATC", gaine: "V20" }] },
  ANT: { n: "Antenne", r: "ANT", h: null, lab: "ANT", groupe: "Courant faible", faible: true, racc: "direct", lignes: [{ cable: "17 VATC", gaine: "V20" }] },
  EQP: { n: "Équipotentielle principale", r: "EQ", h: 30, lab: "EQ", groupe: "Terre et attentes", racc: "direct", lignes: [{ fils: "10 V/J", gaine: 20 }] },
  EQL: { n: "Équipotentielle locale (salle de bain)", r: "EQ", h: 30, lab: "EQL", groupe: "Terre et attentes", racc: "boite", terre: 2.5 },
  // v56 (bande MAILLARD du BE, Kévin 28/10/2026) : îlot (prises en ligne directe, sur le disjoncteur d'un circuit prises,
  // sans disjoncteur propre), bouton poussoir de sonnette (1 paire 9/10), sonnette (carillon en boîte, circuit éclairage)
  ILOT: { n: "Îlot (prises de l'îlot central)", r: "ILOT", h: 30, lab: "ILO", groupe: "Cuisine et spécialisés", racc: "direct", lignes: [{ fils: "1,5 GR+BF+V/J", gaine: 16 }], note: "sur le disjoncteur d'un circuit prises (pas de disjoncteur propre)" },
  BPS: { n: "Bouton poussoir de sonnette", r: "BPS", h: 110, lab: "BPS", groupe: "Courant faible", mural: true, faible: true, racc: "direct", lignes: [{ cable: "1P 9/10", gaine: 16 }] },
  SON: { n: "Sonnette (carillon)", r: "SON", h: 200, lab: "SON", groupe: "Courant faible", mural: true, racc: "boite", eclairage: true },
  AIG: { n: "Gaine aiguillée en attente", r: "AIG", h: null, lab: "AIG", groupe: "Terre et attentes", racc: "direct", lignes: [{ fils: "", gaine: 40 }] },
};
// lignes directes des types qui existaient déjà (R-082, R-084 : RJ45 en gaine verte Ø20)
export const LIGNES_BASE = {
  RJ45: [{ cable: "grade 3 TV", gaine: "V20" }],
  PC20: [{ fils: "2,5 B+R+V/J", gaine: 16 }],
};

export const isVolet = (t) => !!(APPAREILS[t] && (APPAREILS[t].volet || APPAREILS[t].voletCmd));
export const isFaible = (t) => t === "RJ45" || !!(APPAREILS[t] && APPAREILS[t].faible);
export const muraux = Object.keys(APPAREILS).filter((t) => APPAREILS[t].mural);

// raccordement effectif d'un appareil : "direct" | "boite" | "a_choisir" (hotte : choix de l'appareil, sinon du chantier)
export function raccOf(a) {
  const D = APPAREILS[a.t];
  if (!D) return null;
  if (D.racc !== "choix") return D.racc;
  const r = a.racc || "a_choisir";
  return r === "boite" ? "boite" : r === "ligne_directe" ? "direct" : "a_choisir";
}
// lignes directes d'un appareil (variante choisie comprise)
export function lignesOf(a) {
  const D = APPAREILS[a.t];
  if (!D) return LIGNES_BASE[a.t] || null;
  const v = a.var && (D.variantes || []).find((x) => x.id === a.var);
  return (v || D).lignes || null;
}
// « 2,5 B+R+V/J » → [{section, color, lettre}]
export function parseFils(s) {
  const m = /^\s*([\d.,]+)\s+(.+)$/.exec(String(s || ""));
  if (!m) return [];
  const sec = +m[1].replace(",", ".");
  return m[2].split("+").map((x) => x.trim()).filter(Boolean).map((l) => ({ section: sec, lettre: l, color: LETTRES[l] || l }));
}
// libellé de gaine comme sur la feuille des lignes directes FTZ
export const gaineLabel = (g) => (g == null ? "sans gaine" : g === "V20" ? "ICTA 20 V (verte)" : g === 40 ? "gaine aiguillée Ø40" : "ICTA " + g);
