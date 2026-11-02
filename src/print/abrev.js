// v74 MAJ 2 : noms de pièces abrégés comme sur les plans du BE (SEJOUR, CH1, DEGT, SDB, DRESS…).
// Table modifiable dans Paramètres (préférence « abrev » : une règle par ligne « mot ou expression = ABREVIATION »).
// Pur : aucune dépendance au DOM.
export const ABREV_DEFAUT = [
  "Pièce de vie = SEJOUR",
  "Séjour = SEJOUR",
  "Salon = SEJOUR",
  "Salle à manger = SAM",
  "Cuisine = CUISINE",
  "Chambre = CH",
  "Suite parentale = SUITE",
  "Salle de bains = SDB",
  "Salle de bain = SDB",
  "Bains = SDB",
  "Salle d'eau = SDE",
  "Dégagement = DEGT",
  "Dgt = DEGT",
  "Couloir = DEGT",
  "Circulation = DEGT",
  "Dressing = DRESS",
  "Placard = PL",
  "Entrée = ENTREE",
  "Hall = ENTREE",
  "Cellier = CELLIER",
  "Buanderie = BUAND",
  "Garage = GARAGE",
  "Bureau = BUREAU",
  "Mezzanine = MEZZA",
  "Palier = PALIER",
  "Combles = COMBLES",
  "Terrasse = TERRASSE",
  "WC = WC",
].join("\n");

const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();

export function parseAbrev(text = ABREV_DEFAUT) {
  return String(text || "").split(/\n|;/).map((l) => l.split("=")).filter((p) => p.length === 2 && p[0].trim() && p[1].trim())
    .map(([a, b]) => ({ from: norm(a), to: norm(b).replace(/[^A-Z0-9 .\-/]/g, "") }))
    .sort((p, q) => q.from.length - p.from.length);   // l'expression la plus longue gagne (« SALLE DE BAINS » avant « BAINS »)
}

// « Chambre 1 » → CH1 ; « Salle de bains 2 » → SDB2 ; nom inconnu → en majuscules sans accents
export function abrevRoom(name, rules = parseAbrev()) {
  const n = norm(name);
  if (!n) return "";
  for (const r of rules) {
    const i = n.indexOf(r.from);
    if (i < 0) continue;
    const before = n[i - 1], after = n[i + r.from.length];
    if ((before && /[A-Z0-9]/.test(before)) || (after && /[A-Z]/.test(after))) continue;   // mot entier seulement
    const rest = (n.slice(0, i) + " " + n.slice(i + r.from.length)).trim();
    const num = /^(\d+|[A-Z]?\d*)$/.test(rest.replace(/\s+/g, "")) && rest.length <= 3 ? rest.replace(/\s+/g, "") : null;
    if (num != null) return r.to + num;
    return (r.to + " " + rest).trim();
  }
  return n;
}
