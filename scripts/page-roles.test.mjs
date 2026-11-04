// n° 15 (bloc D, 04/11/2026) : rôle des pages du dossier PDF (proposition, choix de l'opérateur, résumé).
import assert from "node:assert/strict";
import { proposeRole, proposeRoles, setRole, dossierOf, analysisPages, roleLabel, ROLES } from "../src/walls/page-roles.js";

let n = 0;
const test = (name, f) => { f(); n++; console.log("  ✓ " + name); };
const L = { wPt: 1190, hPt: 842 }, Pt = { wPt: 595, hPt: 842 };
const P = [
  { page: 1, text: "DEVIS descriptif quantité désignation prix unitaire total TTC TVA acompte", ...Pt },
  { page: 2, text: "Plan électricité RDC Légende : prise de courant, interrupteur, point lumineux, va-et-vient", ...L },
  { page: 3, text: "Plan électricité Étage R+1 Légende : interrupteur, prise de courant, RJ45", ...L },
  { page: 4, text: "Implantation cuisine (cuisiniste) : meubles hauts, plan de travail, évier, plaque de cuisson, hotte", ...L },
  { page: 5, text: "Façade nord, coupe AA, plan de masse, toiture et charpente", ...L },
];
test("rôles proposés : devis, implantation RDC, implantation R+1, plan cuisine, à ignorer", () => {
  assert.deepEqual(proposeRoles(P).map((x) => x.role), ["devis", "niv:RDC", "niv:R+1", "cuisine", "ignorer"]);
});
test("page sans texte lisible (scan, police codée) : paysage = plan (à vérifier), portrait = à ignorer ; un seul plan par niveau (le dernier en paysage)", () => {
  const S = [{ page: 1, text: "", ...Pt }, { page: 2, text: "% # ! & 1'7 6", ...L }, { page: 3, text: "", ...L }];
  const R = proposeRoles(S);
  assert.deepEqual(R.map((x) => x.role), ["ignorer", "ignorer", "niv:RDC"]);
  assert.ok(R.every((x) => x.conf < 0.6));
  assert.equal(proposeRole({ text: "", ...L }).role, "niv:RDC");
});
test("choix de l'opérateur : une page prise pour un niveau libère l'ancienne (à ignorer)", () => {
  const R = setRole(proposeRoles(P), 3, "niv:RDC");
  assert.deepEqual(R.map((x) => x.role), ["devis", "ignorer", "niv:RDC", "cuisine", "ignorer"]);
  assert.equal(R[2].conf, 1);
});
test("résumé du dossier et pages jointes à l'analyse (plan cuisine, devis)", () => {
  const D = dossierOf(proposeRoles(P));
  assert.deepEqual(D.levels, [{ name: "RDC", page: 2 }, { name: "R+1", page: 3 }]);
  assert.deepEqual([D.cuisine, D.devis, D.ignorer], [[4], [1], [5]]);
  assert.deepEqual(analysisPages(D).map((x) => x.label), ["Devis / descriptif, page 1", "Plan cuisine, page 4"]);
  assert.equal(analysisPages(null), null);
  assert.ok(ROLES.every((r) => roleLabel(r) && roleLabel(r) !== r));
});
console.log(`rôles des pages : ${n} vérifications OK`);
