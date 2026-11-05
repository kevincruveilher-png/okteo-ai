// Lot 1 (05/11/2026) : échelle du plan (cotes en centimètres entiers, échelle écrite) et garde-fous du placement des
// étiquettes (boîtes d'obstacles bornées, rognées à la zone visible ; boîte géante rangée à part).
import assert from "node:assert/strict";
import { solveDigits } from "../src/walls/digits.js";
import { writtenScale } from "../src/walls/echelle.js";
import { Placer, lineBoxes, wallBoxes, clipSeg } from "../src/place.js";

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };

// plan type COURIAUT : cotes écrites en cm sans virgule (« 180 », « 320 », « 1840 », « 1 840 »), feuille au 1/50,
// fond provisoire réglé deux fois trop petit (facteur attendu ≈ 2)
const k = 0.01;   // mètres par point de page du fond provisoire
const L = [180, 320, 410, 1840, 900, 265, 1215, 540, 735, 180, 320, 410, 900, 265, 540, 735, 120, 345, 460, 280, 1840, 1215];
const segs = [], texts = [];
L.forEach((cm, i) => {
  const y = 100 + i * 40, len = (cm / 100) / 2 / k;
  segs.push({ stroke: true, x1: 100, y1: y, x2: 100 + len, y2: y });
  texts.push({ str: cm === 1840 && i === 3 ? "1 840" : String(cm), x: 100 + len / 2, y: y - 3, size: 8, ang: 0, font: "f1" });
});
const sol = [...solveDigits(texts, segs, k).values()][0];
ok(sol && sol.checked >= 7, "cotes en cm entiers relues : " + JSON.stringify(sol && { checked: sol.checked, total: sol.total }));
ok(sol && Math.abs(sol.scale - 2) < 0.03, "facteur d'échelle ≈ 2 (cotes en cm) : " + (sol && sol.scale));

// échelle écrite
ok(writtenScale([{ str: "Ech : 1:50" }]) === 50, "« Ech : 1:50 »");
ok(writtenScale([{ str: "ECHELLE" }, { str: "1/100" }]) === 100, "« ECHELLE » + « 1/100 » (deux textes)");
ok(writtenScale([{ str: "1:50" }]) === 50, "« 1:50 » seul");
ok(writtenScale([{ str: "Échelle 1/75" }]) === 75, "« Échelle 1/75 »");
ok(writtenScale([{ str: "PC16 1/2" }, { str: "lot 1:3" }]) === null, "pas d'échelle inventée");
ok(writtenScale([{ str: "1/37" }]) === null, "échelle non standard ignorée");

// boîtes d'obstacles : bornées et rognées
ok(lineBoxes([{ x: 0, y: 0 }, { x: 10000, y: 0 }], 0.01, 0.005).length <= 601, "liaison de 10 km : 601 boîtes au plus");
ok(lineBoxes([{ x: -500, y: 0 }, { x: 500, y: 0 }], 0.01, 0.005, { x0: 0, y0: -1, x1: 1, y1: 1 }).length <= 110, "rognée à la zone visible");
ok(lineBoxes([{ x: 0, y: 5 }, { x: 10, y: 5 }], 0.1, 0.05, { x0: 0, y0: 0, x1: 1, y1: 1 }).length === 0, "trait hors de la zone : aucune boîte");
ok(wallBoxes([{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 0.2 }, { x: 0, y: 0.2 }]).length <= 601, "mur de 2 km : 601 boîtes au plus");
ok(lineBoxes([{ x: 0, y: 0 }, { x: 4, y: 0 }], 1, 0.1).length === 5, "trait normal inchangé (5 boîtes)");
ok(clipSeg({ x: -1, y: 0.5 }, { x: 2, y: 0.5 }, { x0: 0, y0: 0, x1: 1, y1: 1 }).map((p) => p.x).join() === "0,1", "rognage d'un segment");
const P = new Placer(0.05);
const t0 = Date.now();
P.add({ x0: 0, y0: 0, x1: 900, y1: 900 });   // 18 000 × 18 000 cases : rangée à part
ok(Date.now() - t0 < 200 && P.grid.size === 0 && P.big.length === 1, "boîte géante rangée à part (pas de découpage en cases)");
ok(!P.free({ x0: 1, y0: 1, x1: 2, y1: 2 }) && P.free({ x0: 950, y0: 950, x1: 951, y1: 951 }), "boîte géante toujours un obstacle");
P.add({ x0: 1000, y0: 0, x1: 1000.1, y1: 0.1 });
ok(!P.free({ x0: 999.9, y0: 0, x1: 1000.05, y1: 0.05 }) && P.grid.size > 0, "petites boîtes : grille normale");

console.log(`échelle et garde-fous : ${n}/${n} vérifications`);
