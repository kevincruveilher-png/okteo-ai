// n° 14 : autocorrection des murs (src/walls/squaring.js) — plans synthétiques, aucun plan client.
import assert from "node:assert/strict";
import { squarePlan, houseAngle, squareReleve, squareOptions, squareText, keepOpenings } from "../src/walls/squaring.js";

let n = 0;
const test = (name, f) => { f(); n++; console.log("  ✓ " + name); };
const W = (pairs) => pairs.map(([a, b]) => ({ a, b }));
const ang = (A, B) => (Math.atan2(B.y - A.y, B.x - A.x) * 180) / Math.PI;
const isRight = (N, w) => { const a = ((ang(N[w.a], N[w.b]) % 90) + 90) % 90; return Math.min(a, 90 - a) < 0.01; };
const rot = (p, d) => { const c = Math.cos((d * Math.PI) / 180), s = Math.sin((d * Math.PI) / 180); return { x: p.x * c - p.y * s, y: p.x * s + p.y * c }; };

// maison de 8 × 6 m relevée de travers (3° et 2° d'écart), cloison au milieu
const N1 = [{ x: 0, y: 0 }, { x: 8, y: 0.25 }, { x: 8.3, y: 6 }, { x: 0.1, y: 6.1 }, { x: 4, y: 0.12 }, { x: 4.1, y: 6.05 }];
const W1 = W([[0, 4], [4, 1], [1, 2], [2, 5], [5, 3], [3, 0], [4, 5]]);

test("angles légers : tous les murs remis à 0° / 90°, angles joints (mêmes sommets)", () => {
  const R = squarePlan({ nodes: N1, walls: W1 });
  assert.equal(R.angle, 0);
  assert.ok(W1.every((w) => isRight(R.nodes, w)));
  assert.equal(R.equerre, 7); assert.equal(R.biais.length, 0); assert.equal(R.refus.length, 0);
  assert.equal(R.nodes.length, N1.length);
});
test("déplacement de plus de 15 cm : corrigé mais signalé « à vérifier » ; au-delà de 50 cm : pas corrigé", () => {
  const R = squarePlan({ nodes: N1, walls: W1 });
  assert.ok(R.moved > 0.15 && R.verifier.length > 0);
  const far = squarePlan({ nodes: [{ x: 0, y: 0 }, { x: 10, y: 1.5 }, { x: 10, y: 8 }, { x: 0, y: 8 }], walls: W([[0, 1], [1, 2], [2, 3], [3, 0]]) }, { tol: 10, hardMove: 0.5 });
  assert.ok(far.refus.length > 0, "8,5° sur 10 m = 1,5 m : refusé");
});
test("plan tourné de 20° (scan) : reste à 20°, d'équerre dans son propre sens", () => {
  const N = [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 6 }, { x: 0, y: 6 }].map((p) => rot(p, 20)); N[2].x += 0.08;
  const R = squarePlan({ nodes: N, walls: W([[0, 1], [1, 2], [2, 3], [3, 0]]) });
  assert.ok(Math.abs(R.angle - 20) < 0.5, "sens de la maison " + R.angle);
  const a01 = ang(R.nodes[0], R.nodes[1]), a12 = ang(R.nodes[1], R.nodes[2]);
  assert.ok(Math.abs(Math.abs(a12 - a01) - 90) < 0.01);
});
test("presque aligné sur la page (1,5°) : aligné exactement sur la page", () => {
  const N = [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 6 }, { x: 0, y: 6 }].map((p) => rot(p, 1.5));
  assert.equal(houseAngle(N, W([[0, 1], [1, 2], [2, 3], [3, 0]])), 0);
});
test("mur près de 45° remis à 45° exact ; mur à 34° gardé et signalé en biais", () => {
  const N = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 3 }, { x: 4.1, y: 5 }, { x: 0, y: 5 }, { x: 3, y: -2 }];
  const R = squarePlan({ nodes: N, walls: W([[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [0, 5]]) });
  assert.equal(R.a45, 1);
  const d = ang(R.nodes[2], R.nodes[3]); assert.ok(Math.abs(Math.abs(d) - 135) < 0.01, "diagonale " + d);
  assert.deepEqual(R.biais, [5]);
  assert.deepEqual(R.nodes[5], N[5]);
});
test("murs dans le prolongement (écart 3 cm, séparés de 40 cm) remis sur la même ligne", () => {
  const N = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3.4, y: 0.03 }, { x: 7, y: 0.03 }];
  const R = squarePlan({ nodes: N, walls: W([[0, 1], [2, 3]]) });
  assert.ok(Math.abs(R.nodes[0].y - R.nodes[3].y) < 1e-9);
});
test("ouvertures : même place relative sur leur mur, dans le mur", () => {
  const S = squareReleve({ nodes: N1, walls: W1, openings: [{ seg: 0, t: 2, w: 0.9 }, { seg: 2, t: 5.7, w: 1.4 }] }, squareOptions({}));
  for (const o of S.plan.openings) {
    const w = W1[o.seg], A = S.plan.nodes[w.a], B = S.plan.nodes[w.b], L = Math.hypot(B.x - A.x, B.y - A.y);
    assert.ok(o.t - o.w / 2 >= -1e-9 && o.t + o.w / 2 <= L + 1e-9);
  }
  assert.ok(keepOpenings([], [], [], []).length === 0);
});
test("réglages : 0° partout = rien de corrigé ; compte rendu lisible", () => {
  const S = squareReleve({ nodes: N1, walls: W1, openings: [] }, squareOptions({ equerreTol: 0, equerre45: 0 }));
  assert.equal(S.R, null); assert.deepEqual(S.plan.nodes, N1);
  const o = squareOptions({ equerreTol: 12, equerre45: 5, equerreMax: 20 });
  assert.deepEqual(o, { tol: 12, tol45: 5, maxMove: 0.2 });
  const t = squareText(squarePlan({ nodes: N1, walls: W1 }));
  assert.match(t, /7 murs mis d'équerre/); assert.match(t, /à vérifier/);
});
test("un plan déjà d'équerre n'est pas touché", () => {
  const N = [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 6 }, { x: 0, y: 6 }];
  const R = squarePlan({ nodes: N, walls: W([[0, 1], [1, 2], [2, 3], [3, 0]]) });
  assert.deepEqual(R.nodes, N); assert.equal(R.equerre, 0); assert.equal(squareText(R), "murs déjà d'équerre");
});
console.log(`squaring : ${n} vérifications OK`);
