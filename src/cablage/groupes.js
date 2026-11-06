// Groupes d'appareils en un clic (lot 5 de la reprise des paramètres du BE, 06/11/2026, décisions n° 25, 26 et 48) :
// comme les groupes du Stream Deck du BE — une plaque, plusieurs appareils posés côte à côte sur le même mur, déjà
// associés (même endroit, une gaine si la règle d'association le permet : le courant faible garde sa ligne).
// h : hauteur imposée (cm) ; sinon la hauteur par défaut de chaque appareil. Pur.
export const GROUPES_POSE = [
  { id: "PC+RJ", n: "Prise + RJ45", types: ["PC16", "RJ45"], plaque: "double" },
  { id: "PC+TV", n: "Prise + TV", types: ["PC16", "TV"], plaque: "double" },
  { id: "PC+RJ+TV", n: "Prise + RJ45 + TV", types: ["PC16", "RJ45", "TV"], plaque: "triple" },
  { id: "2PC+2RJ+TV", n: "2 prises + 2 RJ45 + TV", types: ["PC16", "PC16", "RJ45", "RJ45", "TV"], plaque: "quadruple" },
  { id: "3PC+2RJ+TV", n: "3 prises + 2 RJ45 + TV", types: ["PC16", "PC16", "PC16", "RJ45", "RJ45", "TV"], plaque: "quadruple" },
  { id: "2PC", n: "2 prises", types: ["PC16", "PC16"], plaque: "double" },
  { id: "3PC", n: "3 prises", types: ["PC16", "PC16", "PC16"], plaque: "triple" },
  { id: "3PC-CUIS", n: "3 prises de cuisine (plan de travail)", types: ["PC16", "PC16", "PC16"], plaque: "triple", h: 110, pt: true },
  { id: "RJ+RJ", n: "2 RJ45", types: ["RJ45", "RJ45"], plaque: "double" },
  { id: "RJ+TV", n: "RJ45 + TV", types: ["RJ45", "TV"], plaque: "double" },
  { id: "RJ+RJ+TV", n: "2 RJ45 + TV", types: ["RJ45", "RJ45", "TV"], plaque: "triple" },
  { id: "SA+SA", n: "2 interrupteurs", types: ["INT", "INT"], plaque: "double" },
  { id: "SA+VV", n: "Interrupteur + va-et-vient", types: ["INT", "VV"], plaque: "double" },
  { id: "SA+BP", n: "Interrupteur + bouton poussoir", types: ["INT", "BP"], plaque: "double" },
  { id: "VV+VV", n: "2 va-et-vient", types: ["VV", "VV"], plaque: "double" },
  { id: "VV+BP", n: "Va-et-vient + bouton poussoir", types: ["VV", "BP"], plaque: "double" },
  { id: "BP+BP", n: "2 boutons poussoirs", types: ["BP", "BP"], plaque: "double" },
];
export const ECART_GROUPE = 0.08;   // m entre deux appareils d'un groupe (même plaque : bien en dessous de « même endroit », 0,30 m)
export const groupe = (id) => GROUPES_POSE.find((g) => g.id === id) || null;
// positions des appareils d'un groupe le long du mur : p0 = premier appareil, (ux, uy) = sens du mur
export function groupePositions(g, p0, ux = 1, uy = 0) {
  return g.types.map((t, i) => ({ t, x: +(p0.x + ux * ECART_GROUPE * i).toFixed(3), y: +(p0.y + uy * ECART_GROUPE * i).toFixed(3) }));
}
