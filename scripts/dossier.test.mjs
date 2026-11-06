// Lot 10 (CH-04, CH-02) : pièces du dossier et finitions (test pur)
import { piecesOf, piecesResume, finition, finitionTexte, finitionsOf, PIECES, FAMILLES } from "../src/referentiel/dossier.js";
let ok = 0, ko = 0;
const check = (n, c, i) => { if (c) { ok++; console.log("  ✓ " + n); } else { ko++; console.log("  ✗ " + n + (i ? " — " + i : "")); } };
const m0 = {};
check("dossier vide : 9 pièces à fournir (PMR facultatif), aucune cochée", piecesResume(m0).n === 9 && piecesResume(m0).ok === 0 && PIECES.length === 10);
const m1 = { dossier: { levels: [{ name: "RDC", page: 1 }], devis: [3], cuisine: [] } };
const L1 = piecesOf(m1);
check("pages du PDF : plan et devis cochés seuls, plan cuisine non", L1.find((p) => p.id === "plan").ok && L1.find((p) => p.id === "devis").ok && !L1.find((p) => p.id === "cuisine").ok && L1.find((p) => p.id === "plan").auto);
const m2 = { ...m1, pieces: { devis: false, photos: true }, pmr: true };
const R2 = piecesResume(m2);
check("case à la main prioritaire ; PMR compté quand le logement est PMR", !piecesOf(m2).find((p) => p.id === "devis").ok && piecesOf(m2).find((p) => p.id === "photos").ok && R2.n === 10 && R2.ok === 3 && R2.manque.includes("Devis / descriptif"), JSON.stringify(R2));
check("finitions en majuscules sans accents (comme les fichiers du BE)", finition(" schneider odace ") === "SCHNEIDER ODACE" && finition("Étanché") === "ETANCHE");
check("texte d'une famille : MARQUE · GAMME · COULEUR · PLAQUE", finitionTexte({ marque: "SCHNEIDER", gamme: "ODACE", couleur: "BLANC", plaque: "BLANC" }) === "SCHNEIDER · ODACE · BLANC · BLANC" && finitionsOf({}).length === FAMILLES.length && finitionsOf({}).every((f) => f.txt === ""));
console.log(`\n${ok} vérifications réussies, ${ko} en échec.`);
if (ko) process.exit(1);
