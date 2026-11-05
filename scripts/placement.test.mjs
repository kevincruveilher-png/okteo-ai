// n° 13 + 8 (lot A) : symboles poussés hors du mur, obstacles des repères, positions candidates (src/place.js).
import assert from "node:assert/strict";
import { pushOff, wallBoxes, lineBoxes, repCandidates, Placer, switchParts, glueToWall, SWITCH_R } from "../src/place.js";

let n = 0;
const test = (name, f) => { f(); n++; console.log("  ✓ " + name); };
// mur horizontal d'axe y = 0, épaisseur 0,30 m, appareil côté y > 0 (normale (0, 1))
const W = { ax: 0, ay: 0, ux: 1, uy: 0, nx: 0, ny: 1, ep: 0.3 };

test("symbole mural poussé hors du mur : son bord touche la face, jamais dans le mur, à tous les rayons", () => {
  for (const R of [0.05, 0.15, 0.3, 0.6]) {
    const p = pushOff({ x: 2, y: 0.21 }, W, R);
    assert.equal(p.x, 2);
    assert.ok(p.y - R >= W.ep / 2 - 1e-9, `R ${R} : bord à ${p.y - R}`);
  }
});
test("symbole déjà assez loin du mur : pas déplacé ; mur inconnu : pas déplacé", () => {
  const q = { x: 1, y: 2 };
  assert.equal(pushOff(q, W, 0.2), q);
  assert.equal(pushOff(q, null, 0.2), q);
});
test("obstacles d'un mur : tout le long, à son épaisseur, sans dépasser de la bande", () => {
  const P = [{ x: 0, y: -0.15 }, { x: 4, y: -0.15 }, { x: 4, y: 0.15 }, { x: 0, y: 0.15 }];
  const B = wallBoxes(P);
  assert.ok(B.length >= 13);
  assert.ok(B.every((b) => b.y0 >= -0.15 - 1e-9 && b.y1 <= 0.15 + 1e-9));
  const PL = new Placer(0.5); B.forEach((b) => PL.add(b));
  assert.ok(!PL.free({ x0: 1.9, y0: -0.02, x1: 2.1, y1: 0.02 }), "un repère au milieu du mur est refusé");
  assert.ok(PL.free({ x0: 1.9, y0: 0.2, x1: 2.1, y1: 0.3 }), "juste à côté du mur, c'est libre");
});
test("obstacles d'un trait (liaison) : couvrent le trait", () => {
  const B = lineBoxes([{ x: 0, y: 0 }, { x: 1, y: 1 }], 0.1, 0.02);
  assert.ok(B.length >= 14);
});
test("positions candidates : 3 couronnes de 12, côté pièce d'abord", () => {
  const C = repCandidates({ x: 0, y: 0 }, 0.2, 0.05, 0.1, { x: 0, y: 1 });
  assert.equal(C.length, 36);
  assert.deepEqual([...new Set(C.map((c) => c.ring))], [0, 1, 2]);
  assert.ok(C[0].y > 0, "la première position est du côté de la pièce (y > 0)");
  const d0 = Math.hypot(C[0].x, C[0].y), d2 = Math.hypot(C[30].x, C[30].y);
  assert.ok(d2 > d0 * 1.5, "la 3e couronne est nettement plus loin");
});
test("05/11 : interrupteur collé au mur (rond contre la face, même loin ou dans le mur) ; trait vers la pièce avec crochet ; VV en V", () => {
  const w = { ax: 0, ay: 0, ux: 1, uy: 0, nx: 0, ny: 1, ep: 0.2 };
  for (const y of [0.02, 0.4, 1.2]) { const p = glueToWall({ x: 3, y }, w, 0.06); assert.equal(p.x, 3); assert.ok(Math.abs(p.y - 0.16) < 1e-9); }
  const I = switchParts("INT"), V = switchParts("VV");
  assert.equal(I.r, SWITCH_R); assert.equal(I.lines.length, 2); assert.equal(V.lines.length, 4);
  const [arm, hook] = I.lines;
  assert.ok(Math.abs(arm[0] - SWITCH_R) < 1e-9 && arm[1] === 0 && arm[2] > 1.5 && Math.abs(arm[3]) < 1e-9, "trait perpendiculaire au mur, depuis le bord du rond");
  assert.ok(Math.abs(hook[2] - hook[0]) < 1e-9 && Math.abs(hook[3]) > 0.3, "crochet au bout");
  assert.ok(V.lines[0][3] < 0 && V.lines[2][3] > 0 && V.lines.every((l) => l[2] > 0), "VV : deux traits vers la pièce, de part et d'autre");
});
console.log(`placement : ${n} vérifications OK`);
