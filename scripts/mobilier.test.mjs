// n° 11 (lot C, 04/11/2026) : bibliothèque de mobilier (formes 2D, volumes 3D, hors relevé IA).
import assert from "node:assert/strict";
import { SANI, isSani, isMeuble, saniShape, sani3d } from "../src/cablage/volumes.js";
import { APPAREILS } from "../src/cablage/appareils.js";
import { AI_TYPES } from "../src/walls/ai-plan.js";

let n = 0;
const test = (name, f) => { f(); n++; console.log("  ✓ " + name); };
const M = Object.keys(SANI).filter(isMeuble);
test("10 meubles : canapé, fauteuil, table, chaise, lits, meuble TV, armoire, bureau, plante ; groupe « Mobilier », sans électricité", () => {
  assert.deepEqual(M, ["CANAPE", "FAUTEUIL", "TABLE", "CHAISE", "LIT2", "LIT1", "MTV", "ARMOIRE", "MBUREAU", "PLANTE"]);
  assert.ok(M.every((t) => isSani(t) && APPAREILS[t].groupe === "Mobilier" && APPAREILS[t].racc === "aucun" && APPAREILS[t].r === "SANI"));
});
test("dessin 2D dans l'emprise du meuble, tourné avec lui", () => {
  for (const t of M) {
    const { w, d } = SANI[t], S = saniShape({ t, x: 0, y: 0 });
    assert.ok(S.length >= 1 && S[0].k === "out", t);
    assert.ok(S.every((p) => p.pts.every((q) => Math.abs(q.x) <= w / 2 + 1e-9 && Math.abs(q.y) <= d / 2 + 1e-9)), t);
  }
  const r = saniShape({ t: "LIT2", x: 0, y: 0, srot: 90 })[0].pts, W = Math.max(...r.map((q) => q.x)) - Math.min(...r.map((q) => q.x));
  assert.ok(Math.abs(W - 2.0) < 1e-6);
});
test("volumes 3D : assise du canapé 42 cm et dossier 85 cm, plateau de table à 75 cm, armoire 2 m, plante feuillage", () => {
  const top = (t) => Math.max(...sani3d({ t, x: 0, y: 0 }).map((p) => p.z1));
  assert.equal(top("CANAPE"), 0.85); assert.equal(top("TABLE"), 0.75); assert.equal(top("ARMOIRE"), 2);
  assert.ok(sani3d({ t: "PLANTE", x: 0, y: 0 }).some((p) => p.plante));
  assert.ok(M.every((t) => sani3d({ t, x: 0, y: 0 }).every((p) => p.z1 > p.z0 && p.pts.length >= 3)));
});
test("le relevé IA ne propose ni meubles ni zones d'exclusion", () => {
  assert.ok(M.every((t) => !AI_TYPES[t]) && !AI_TYPES.ZONE && !AI_TYPES.ZONEC && AI_TYPES.WC && AI_TYPES.PC16);
});
console.log(`mobilier : ${n} vérifications OK`);
