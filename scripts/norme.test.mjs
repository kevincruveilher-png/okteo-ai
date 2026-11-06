// MAJ norme (06/11/2026) : règles de la NF C 15-100 pour le logement (bible Oktéo), contrôles purs.
import assert from "node:assert/strict";
import { REGLES, THEMES, regle, refOf, art2015, versionFor, forJournal, BASCULE } from "../src/norme/nfc15100.js";
import { REGLES_BASE } from "../src/cablage/regles-data.js";
import { roomKind, prisesSejour, checkPieces, questionsOf } from "../src/norme/pieces.js";
import { normeCircuits, normeSettings, protMax, prisesMax } from "../src/norme/circuits.js";
import { checkCircuits } from "../src/cablage/circuits.js";
import { unifilaire, reperage, liensCom, autocontrole, fonctionOf } from "../src/norme/documents.js";
import { CAB_DEFAULTS } from "../src/cablage/settings.js";

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

test("n° 4 : plafonds par circuit (8 / 12 prises selon la section, 8 points, cuisine 6 en 2,5 mm²) et tableau 10-1F", () => {
  assert.equal(prisesMax(1.5), 8); assert.equal(prisesMax(2.5), 12);
  assert.deepEqual([protMax("prises", 1.5), protMax("prises", 2.5), protMax("cuisine", 1.5), protMax("specialise", 6, "PLAQ"), protMax("specialise", 10), protMax("comm", null)], [16, 20, null, 32, 40, undefined]);
  const P = (n, k = "p") => Array.from({ length: n }, (_, i) => ({ id: k + i, t: "PC16" })), L = Array.from({ length: 9 }, (_, i) => ({ id: "l" + i, t: "LUM" }));
  const items = [...P(10), ...P(10, "q"), ...P(7, "k"), ...L];
  const C = [{ id: "c1", n: "C1", kind: "prises", apps: P(10).map((a) => a.id), section: 1.5, prot: 16 },
    { id: "c2", n: "C2", kind: "prises", apps: P(10, "q").map((a) => a.id), section: 2.5, prot: 20 },
    { id: "c3", n: "C3", kind: "cuisine", apps: P(7, "k").map((a) => a.id), section: 1.5, prot: 16 },
    { id: "c4", n: "C4", kind: "eclairage", apps: L.map((a) => a.id), section: 1.5, prot: 20 }];
  const I = normeCircuits(C, items);
  assert.deepEqual(I.map((x) => `${x.code}@${x.c}`), ["CIR-01@c1", "CIR-04@c3", "CIR-04@c3", "CIR-09@c3", "CIR-02@c4", "CIR-09@c4", "CIR-03@c4"]);
  assert.match(I[0].msg, /^CIR-01 · C1 : 10 prises 16 A en 1,5 mm², la norme en admet 8$/);
  // checkCircuits : le dépassement déjà vu par le réglage prend le message de la norme (pas de doublon)
  const r = checkCircuits(C.slice(0, 1), items, CAB_DEFAULTS);
  assert.equal(r.issues.length, 1); assert.equal(r.issues[0].code, "CIR-01");
});
test("n° 4 : réglages de Paramètres plus larges que la norme → messages (valeurs de base : aucun)", () => {
  assert.deepEqual(normeSettings(CAB_DEFAULTS), []);
  assert.deepEqual(normeSettings({ ...CAB_DEFAULTS, maxPrises: 10, maxPoints: 9, maxPrisesCuisine: 7, secCuisine: 1.5 }).map((x) => x.code), ["CIR-02", "CIR-01", "CIR-04", "CIR-04"]);
  assert.deepEqual(normeSettings({ ...CAB_DEFAULTS, maxPrises: 12, secPrises: 2.5 }), []);
});

test("n° 6 : schéma unifilaire, repérage (local + fonction), liens RJ45 numérotés, fiche d'autocontrôle pré-remplie", () => {
  const apps = [{ id: "a1", t: "LUM", room: "Chambre 1" }, { id: "a2", t: "LUM", room: "Séjour" }, { id: "a3", t: "PC16", room: "Séjour" }, { id: "a4", t: "PLAQ", room: "Cuisine" },
    { id: "r2", t: "RJ45", room: "Séjour", rep: "R2", lvName: "RDC" }, { id: "r1", t: "RJ45", room: "Chambre 1", rep: "R1", lvName: "RDC" }];
  const C = [{ n: "C1", kind: "eclairage", apps: ["a1", "a2"], section: 1.5, prot: 16 }, { n: "C2", kind: "prises", apps: ["a3"], section: 1.5, prot: 16 }, { n: "C3", kind: "specialise", apps: ["a4"], section: 6, prot: 32, label: "Plaque de cuisson PL1 · Cuisine" }];
  const T = { rows: [[{ k: "id", a: 40, type: "AC" }, { k: "cb", c: "C1", a: 16 }, { k: "cb", c: "C2", a: 16 }], [{ k: "id", a: 40, type: "A" }, { k: "cb", c: "C3", a: 32 }]] };
  const U = unifilaire(T, C, apps);
  assert.deepEqual(U.map((g) => [g.id, g.circuits.map((l) => `${l.n}:${l.locaux.join("+")}`).join(",")]), [["ID 40 A type AC 30 mA", "C1:Chambre 1+Séjour,C2:Séjour"], ["ID 40 A type A 30 mA", "C3:Cuisine"]]);
  assert.equal(fonctionOf(C[2]), "Spécialisé — Plaque de cuisson PL1");
  const R = reperage(T, C, apps);
  assert.deepEqual(R[0], { n: "C1", titre: "C1 · 16 A · 1,5 mm²", fonction: "Éclairage", locaux: "Chambre 1, Séjour" });
  assert.deepEqual(liensCom(apps).map((l) => `${l.port}=${l.rep}@${l.room}`), ["RJ1=R1@Chambre 1", "RJ2=R2@Séjour"]);
  const F = autocontrole({ pieces: [{ code: "PC-01" }], circuits: [], tableau: ["R-134 (CIR-05) : 1 circuit spécialisé"], sdb: [], hasTableau: true });
  const st = Object.fromEntries(F.map((r) => [r.code + (r.groupe[0] === "V" ? "" : "*"), r.etat]));
  assert.equal(st["PC-01"], "NR"); assert.equal(st["CIR-05"], "NR"); assert.equal(st["TAB-03"], "R"); assert.equal(st["DOC-02"], "R"); assert.equal(st["SDE-16*"], "");
  assert.ok(F.every((r) => r.ref && r.libelle));
  assert.equal(autocontrole({ hasTableau: false }).find((r) => r.code === "TAB-03").etat, "SO");
});

console.log(`norme : ${n} groupes de vérifications réussis.`);
