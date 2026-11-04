// n° 5 (bloc D, 04/11/2026) : rapport d'analyse clair (familles, explications, choix, décisions, questions au pavillonneur).
import assert from "node:assert/strict";
import { FAMILLES, familyOf, candidates, explain, buildRapport, rapportText } from "../src/cablage/rapport.js";

let n = 0;
const test = (name, f) => { f(); n++; console.log("  ✓ " + name); };
const T = { INT: { n: "Interrupteur simple" }, VV: { n: "Va-et-vient" }, LUM: { n: "Point lumineux" } };
test("quatre familles de couleur ; chaque sorte de point a sa famille", () => {
  assert.deepEqual(Object.keys(FAMILLES), ["ia", "montage", "pose", "cablage"]);
  assert.deepEqual(["lecture", "lum", "vv", "sdb", "mur", "battant", "nobox", "split"].map(familyOf), ["ia", "montage", "montage", "pose", "pose", "pose", "cablage", "cablage"]);
  assert.ok(Object.values(FAMILLES).every((f) => /^#[0-9a-f]{6}$/i.test(f.color) && f.label && f.aide));
});
test("types candidats lus dans la remarque de l'IA, avec la conséquence de chaque choix", () => {
  assert.deepEqual(candidates("INT ou VV ? un seul bras lisible", T), ["INT", "VV"]);
  assert.deepEqual(candidates("rien de tel", T), []);
  const p = explain({ kind: "lecture", ids: ["i1"] }, { id: "i1", t: "INT", rep: "I3", room: "SdE", aiNote: "INT ou VV ? deux traits de liaison", aiType: "INT", inscription: "VR" }, T);
  assert.equal(p.fam, "ia"); assert.equal(p.rep, "I3 (SdE)");
  assert.deepEqual(p.choix.map((c) => c.type), ["INT", "VV"]); assert.match(p.choix[1].consequence, /2e va-et-vient/);
  assert.ok(p.preuves.some((x) => /« VR »/.test(x)) && p.preuves.some((x) => /deux traits/.test(x)));
  assert.match(p.question, /I3 \(SdE\) : quel est cet appareil \(inscription « VR »\) \?/);
});
test("rapport : points par famille, décisions (qui, quand), questions au pavillonneur ; texte pour le BE", () => {
  const issues = [{ kind: "lum", ids: ["l1"] }, { kind: "mur", ids: ["p1"] }, { kind: "lecture", ids: ["i1"] }];
  const by = new Map([["l1", { id: "l1", t: "LUM", rep: "L2", room: "Séjour" }], ["p1", { id: "p1", t: "PC16", rep: "P4" }], ["i1", { id: "i1", t: "INT", rep: "I3", aiNote: "INT ou VV ?" }]]);
  const D = { "lum:l1": { choix: "pavillonneur", label: "question posée au pavillonneur", by: "kevin", at: "2026-11-04T21:00:00Z" }, "lecture:i1": { choix: "type", label: "C'est Va-et-vient", by: "kevin", at: "2026-11-04T21:01:00Z" } };
  const R = buildRapport(issues, by, T, D, [{ text: "Hauteur des prises du garage ?" }]);
  assert.equal(R.total, 3); assert.equal(R.decided, 2);
  assert.deepEqual(R.parFamille.map((g) => [g.fam, g.points.length]), [["ia", 1], ["montage", 1], ["pose", 1]]);
  assert.deepEqual(R.questions, ["Hauteur des prises du garage ?", "Quelle commande allume L2 (Séjour) (aucune commande ne lui est reliée sur le plan) ?"]);
  const t = rapportText(R, { chantier: "ESSAI 99999" });
  assert.match(t, /Rapport d'analyse — ESSAI 99999 : 3 point\(s\), 2 décidé\(s\)/); assert.match(t, /C'est Va-et-vient \(kevin, 2026-11-04\)/); assert.match(t, /P4 : .* → à décider/); assert.match(t, /Questions au pavillonneur\n1\. Hauteur/);
});
console.log(`rapport : ${n} vérifications OK`);
