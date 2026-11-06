// MAJ norme (06/11/2026) : règles de la NF C 15-100 pour le logement (bible Oktéo), contrôles purs.
import assert from "node:assert/strict";
import { REGLES, THEMES, regle, refOf, art2015, versionFor, forJournal, BASCULE } from "../src/norme/nfc15100.js";
import { REGLES_BASE } from "../src/cablage/regles-data.js";

let n = 0;
const test = (name, f) => { f(); n++; console.log("  ✓ " + name); };

test("n° 1 : 91 règles, codes uniques et stables, thème connu, niveau O / R / BE, article et résumé", () => {
  assert.equal(REGLES.length, 91);
  assert.equal(new Set(REGLES.map((r) => r.code)).size, REGLES.length);
  for (const r of REGLES) {
    assert.match(r.code, /^[A-Z]+-\d{2}$/, r.code);
    assert.ok(THEMES[r.theme], r.code);
    assert.ok(["O", "R", "BE"].includes(r.niveau), r.code);
    assert.ok(r.art && r.texte.length > 10 && r.texte.length < 200, r.code);
  }
});
test("n° 1 : chaque règle R-xxx citée existe dans le journal des règles KiTéOHM", () => {
  const ids = new Set(REGLES_BASE.rules.map((r) => r.id));
  for (const r of REGLES) for (const id of r.R) assert.ok(ids.has(id), `${r.code} → ${id}`);
  assert.deepEqual(forJournal("R-131").map((r) => r.code).slice(0, 3), ["PC-01", "PC-02", "PC-03"]);
});
test("n° 1 : référence lisible pour 2024 et correspondance avec l'A5 (2015)", () => {
  assert.equal(refOf("PC-01"), "PC-01 · NF C 15-100-10 § 10.1.6.3.2");
  assert.equal(refOf("PC-01", "2015"), "PC-01 · NF C 15-100 A5 § 10.1.3.3.2");
  assert.equal(refOf("COM-01"), "COM-01 · NF C 15-100-11 § 5.2.2.1");
  assert.equal(refOf("PC-09"), "PC-09 · NF C 15-100-1 § 555.1.9");
  assert.equal(refOf("TAB-03"), "TAB-03 · NF C 15-100-10, Tableau 10-1G");
  assert.equal(refOf("GTL-01", "2015"), "GTL-01 · NF C 15-100 A5 § 10.1.4.1.2");
  assert.equal(art2015("10.1.8.2"), "10.1.5.2");
  assert.equal(refOf("XX-99"), "XX-99");
  assert.equal(regle("SDE-04").niveau, "O");
});
test("n° 1 : version selon la date de dépôt du permis (bascule au 31/08/2025), 2024 par défaut", () => {
  assert.equal(BASCULE, "2025-08-31");
  assert.equal(versionFor({ permis: "2025-08-31" }).v, "2015");
  assert.equal(versionFor({ permis: "2025-09-01" }).v, "2024");
  const d = versionFor({});
  assert.equal(d.v, "2024"); assert.equal(d.sure, false); assert.equal(d.permis, null);
  assert.equal(versionFor({ permis: "06/11/2026" }).sure, false, "date mal écrite = non renseignée");
});

console.log(`norme : ${n} groupes de vérifications réussis.`);
