// Lot 10 (06/11/2026) — fiche du chantier : pièces du dossier (CH-04) et finitions commandées (CH-02), comme les
// fiches chantier du BE (InfosChantier). Pur : données dans la fiche du chantier (meta.pieces, meta.finitions).
// Aucun nom de client ni prix ici : seulement la liste des pièces et des familles.

// pièces du dossier ; auto = déjà connue par le rôle des pages du PDF (meta.dossier, page-roles.js)
export const PIECES = [
  { id: "plan", label: "Plan client à jour", auto: (d) => !!(d && d.levels && d.levels.length) },
  { id: "devis", label: "Devis / descriptif", auto: (d) => !!(d && d.devis && d.devis.length) },
  { id: "coupes", label: "Coupes" },
  { id: "cuisine", label: "Plan cuisine", auto: (d) => !!(d && d.cuisine && d.cuisine.length) },
  { id: "thermique", label: "Étude thermique" },
  { id: "vmc", label: "Étude VMC" },
  { id: "chauffage", label: "Documentation du chauffage" },
  { id: "empl", label: "Emplacements U INT, CETH, G EXT, convecteurs et tableau" },
  { id: "photos", label: "Photos" },
  { id: "pmr", label: "PMR (logement accessible)", opt: true, auto: (d, m) => !!m.pmr },
];

// état de chaque pièce : {id, label, ok, auto, opt} ; la case cochée ou décochée à la main l'emporte
export function piecesOf(meta) {
  const m = meta || {}, P = m.pieces || {};
  return PIECES.map((p) => {
    const auto = p.auto ? p.auto(m.dossier, m) : false, has = Object.prototype.hasOwnProperty.call(P, p.id);
    return { id: p.id, label: p.label, opt: !!p.opt, auto, ok: has ? !!P[p.id] : auto, main: has };
  });
}
// résumé « 6 / 9 » (les pièces facultatives ne comptent que si elles sont là) et liste des manquantes
export function piecesResume(meta) {
  const L = piecesOf(meta), need = L.filter((p) => !p.opt || p.ok);
  return { ok: need.filter((p) => p.ok).length, n: need.length, manque: need.filter((p) => !p.ok).map((p) => p.label) };
}

// finitions commandées : une ligne par famille, 4 champs
export const FAMILLES = [
  { id: "appareillage", label: "Appareillage" },
  { id: "etancheInt", label: "Étanche intérieur" },
  { id: "etancheExt", label: "Étanche extérieur" },
  { id: "eclairage", label: "Éclairage" },
  { id: "vmc", label: "VMC" },
  { id: "tableau", label: "Tableau" },
];
export const CHAMPS = [
  { id: "marque", label: "Marque", ex: "SCHNEIDER" },
  { id: "gamme", label: "Gamme", ex: "ODACE" },
  { id: "couleur", label: "Couleur", ex: "BLANC" },
  { id: "plaque", label: "Plaque", ex: "BLANC" },
];
const up = (s) => String(s || "").trim().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
// valeur rangée (majuscules sans accents, comme les fichiers du BE)
export const finition = (v) => up(v).slice(0, 40);
// texte d'une famille : « SCHNEIDER · ODACE · BLANC · BLANC » (vide si rien)
export function finitionTexte(f) { return CHAMPS.map((c) => (f || {})[c.id]).filter(Boolean).join(" · "); }
// une ligne par famille avec son texte
export function finitionsOf(meta) {
  const F = (meta || {}).finitions || {};
  return FAMILLES.map((fam) => ({ ...fam, v: F[fam.id] || {}, txt: finitionTexte(F[fam.id]) }));
}
