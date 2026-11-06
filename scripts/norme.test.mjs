// MAJ norme (06/11/2026) : règles de la NF C 15-100 pour le logement (bible Oktéo), contrôles purs.
import assert from "node:assert/strict";
import { REGLES, THEMES, regle, refOf, art2015, versionFor, forJournal, BASCULE } from "../src/norme/nfc15100.js";
import { REGLES_BASE } from "../src/cablage/regles-data.js";
import { roomKind, prisesSejour, checkPieces, questionsOf } from "../src/norme/pieces.js";

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

const sq = (x, y, w, h) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
test("n° 2 : sorte de pièce d'après le nom écrit sur le plan", () => {
  const K = ["CH 2", "Chambre 1", "Séjour", "SÉJOUR/CUISINE", "Cuisine", "SdE", "Salle de bain", "WC", "Dgt", "Entrée", "Placard", "Cellier", "Garage", "Bureau", "Terrasse", ""].map(roomKind);
  assert.deepEqual(K, ["chambre", "chambre", "sejour", "sejour_cuisine", "cuisine", "sdb", "sdb", "wc", "degagement", "degagement", "placard", "service", "garage", "bureau", "exterieur", "inconnue"]);
});
test("n° 2 : prises du séjour (1 par 4 m², 5 au moins, 7 entre 24 et 28 m², 7 au-delà de 28 m²)", () => {
  assert.deepEqual([12, 20, 21, 24, 26, 28, 40].map(prisesSejour), [5, 5, 6, 6, 7, 7, 7]);
});
test("n° 2 : minimums d'une maison (chambre, séjour/cuisine, WC, RJ45) → alertes avec code, article et question au pavillonneur", () => {
  const rooms = [
    { id: "r1", name: "Chambre 1", area: 11, poly: sq(0, 0, 3, 3.7), lv: "rdc" },
    { id: "r2", name: "Séjour/Cuisine", area: 38, poly: sq(4, 0, 8, 4.75), lv: "rdc" },
    { id: "r3", name: "WC", area: 1.5, poly: sq(0, 5, 1, 1.5), lv: "rdc" },
    { id: "r4", name: "Chambre 2", area: 10, poly: sq(0, 8, 3, 3.3), lv: "rdc" },
    { id: "r5", name: "Placard", area: 1, poly: sq(3.2, 8, 0.6, 1), lv: "rdc" },
  ];
  const A = (id, t, x, y, more) => ({ id, t, x, y, lv: "rdc", ...more });
  const apps = [A("p1", "PC16", 0.5, 0.2), A("p2", "PC16", 2.5, 0.2), A("l1", "LUM", 1.5, 1.8),
    ...Array.from({ length: 9 }, (_, i) => A("s" + i, "PC16", 4.5 + i * 0.8, 0.2, i < 2 ? { pt: true } : {})), A("l2", "LUM", 8, 2), A("rj1", "RJ45", 4.6, 0.2), A("rj2", "RJ45", 11, 4.5),
    A("l4", "LUM", 1.5, 9.6), ...[0, 1, 2].map((i) => A("q" + i, "PC16", 0.3 + i, 8.2)), A("rj4", "RJ45", 0.4, 8.2)];
  const I = checkPieces(rooms, apps);
  const codes = I.map((i) => `${i.code}@${i.room}:${i.have}/${i.need}`);
  assert.deepEqual(codes, ["PC-01@Chambre 1:2/3", "PC-04@Séjour/Cuisine:9/13", "PC-05@Séjour/Cuisine:2/4", "ECL-01@WC:0/1", "COM-01@Logement:1/2", "COM-02@Séjour/Cuisine:0/1"]);
  assert.equal(I[0].ref, "PC-01 · NF C 15-100-10 § 10.1.6.3.2");
  assert.match(I[1].text, /séjour 30 m² \(38 m² − 8 m² de cuisine\) \+ 6 prises de cuisine/);
  assert.equal(I[0].key, "norme:PC-01:r1");
  assert.ok(!I.some((i) => i.room === "Placard"), "pas de minimum pour un placard");
  assert.equal(questionsOf(I).length, 5);
  // A5 (2015) : mêmes minimums, article de l'ancienne édition
  assert.equal(checkPieces(rooms, apps, { v: "2015" })[0].ref, "PC-01 · NF C 15-100 A5 § 10.1.3.3.2");
});
test("n° 2 : RJ45 hors séjour selon le nombre de pièces principales (2 → 1, plus de 2 → 2)", () => {
  const rooms = [{ id: "a", name: "Séjour", area: 20, poly: sq(0, 0, 5, 4) }, { id: "b", name: "Chambre", area: 10, poly: sq(6, 0, 3, 3) }, { id: "c", name: "Chambre 2", area: 10, poly: sq(10, 0, 3, 3) }];
  const base = [0, 1].map((i) => ({ id: "r" + i, t: "RJ45", x: 1 + i * 0.1, y: 0.2 })).concat([{ id: "pp", t: "PC16", x: 1, y: 0.3 }]);
  const one = checkPieces(rooms, base).filter((i) => i.code === "COM-01");
  assert.equal(one.length, 1); assert.equal(one[0].need, 2); assert.equal(one[0].have, 0); assert.equal(one[0].roomId, null);
  assert.equal(checkPieces(rooms.slice(0, 2), base).filter((i) => i.code === "COM-01")[0].need, 1);
});

console.log(`norme : ${n} groupes de vérifications réussis.`);
