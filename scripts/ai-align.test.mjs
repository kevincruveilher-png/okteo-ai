// v77 : réponse collée — « ref » tolérant, calibre en texte, recalage du relevé IA sur les murs du PDF.
// Maison synthétique (aucun plan client) : murs « vrais » = ceux du PDF ; relevé IA = mêmes murs décalés, étirés et bruités.
import assert from "node:assert/strict";
import { aiToPlan, refOf, pastePrompt } from "../src/walls/ai-plan.js";
import { readingData, validateReleve, calibreOf } from "../src/walls/ai-data.js";
import { alignPlan, alignTransform, axisLines } from "../src/walls/ai-align.js";

let n = 0;
function test(name, f) { f(); n++; console.log("  ✓ " + name); }

// --- maison de 12 × 9 m : 4 murs extérieurs, une cloison verticale à 5 m, une horizontale à 4 m (côté gauche)
const TRUE = { x0: 2, y0: 1.5 };
const node = (x, y) => ({ x: TRUE.x0 + x, y: TRUE.y0 + y });
const ref = {
  nodes: [node(0, 0), node(12, 0), node(12, 9), node(0, 9), node(5, 0), node(5, 9), node(0, 4), node(5, 4)],
  walls: [[0, 4], [4, 1], [1, 2], [2, 5], [5, 3], [3, 6], [6, 0], [4, 7], [7, 5], [6, 7]].map(([a, b]) => ({ a, b, ep: 0.2 })),
};

// --- relevé IA en pixels : 1 px = 2 cm ; l'IA s'est trompée : +35 cm en x, −25 cm en y, hauteur étirée de 2 %, bruit
const PX = 0.02, err = { dx: 0.35, dy: -0.25, sy: 1.02 };
const noise = [0.04, -0.06, 0.05, -0.03, 0.06, -0.05, 0.02, -0.04];
const toPx = (p, i) => ({ x: Math.round(((p.x - TRUE.x0) + err.dx + noise[i % 8]) / PX), y: Math.round(((p.y - TRUE.y0) * err.sy + err.dy + noise[(i + 3) % 8]) / PX) });
const pts = ref.nodes.map(toPx);
const raw = {
  ref: { w: 700, h: 500 },
  murs: ref.walls.map((w) => ({ x1: pts[w.a].x, y1: pts[w.a].y, x2: pts[w.b].x, y2: pts[w.b].y, ep: 20 })),
  ouvertures: [{ x: Math.round((pts[0].x + pts[4].x) / 2), y: pts[0].y, l: 90, t: "fenetre" }],
  pieces: [{ nom: "Séjour", x: Math.round((pts[4].x + pts[1].x) / 2), y: Math.round((pts[1].y + pts[2].y) / 2) }],
  // une prise collée au mur droit (x = 12 m) à mi-hauteur, une lumière au centre du séjour
  appareils: [
    { t: "PC16", x: pts[1].x - 3, y: Math.round((pts[1].y + pts[2].y) / 2) },
    { t: "LUM", x: Math.round((pts[4].x + pts[1].x) / 2), y: Math.round((pts[1].y + pts[2].y) / 2) },
    { t: "LV", x: 100, y: 100, calibre: "20 A" },
    { t: "PLAQ", x: 110, y: 100, calibre: "32A" },
  ],
  liaisons: [],
};
const map = { x0: TRUE.x0, y0: TRUE.y0, sx: PX, sy: PX };

test("« ref » : W/H, w/h, width/height, textes ; absent ou nul → null", () => {
  assert.deepEqual([refOf({ ref: { W: 1568, H: 1109 } }).W, refOf({ ref: { W: 1568, H: 1109 } }).H], [1568, 1109]);
  assert.equal(refOf({ ref: { w: 1568, h: 1100 } }).W, 1568);
  assert.equal(refOf({ ref: { width: "2000", height: "1414 px" } }).H, 1414);
  assert.equal(refOf({ ref: { W: 0, H: 10 } }), null);
  assert.equal(refOf({}), null);
});
test("« ref » : hauteur arrondie (1 100 pour 1 109) corrigée d'après la proportion du fond ; écart > 3 % gardé", () => {
  const r = refOf({ ref: { W: 1568, H: 1100 } }, { fondW: 1568 * 0.005, fondH: 1109 * 0.005 });
  assert.ok(r.ajuste && Math.abs(r.H - 1109) < 0.01 && r.annonce.H === 1100);
  const r2 = refOf({ ref: { W: 1568, H: 1000 } }, { fondW: 1568, fondH: 1109 });
  assert.ok(!r2.ajuste && r2.H === 1000);
});
test("calibre : nombre ou texte « 20 A » / « 32A » accepté, texte illisible refusé", () => {
  assert.equal(calibreOf(20), 20); assert.equal(calibreOf("20 A"), 20); assert.equal(calibreOf("32A"), 32); assert.equal(calibreOf("16"), 16);
  assert.equal(calibreOf("vingt"), null); assert.equal(calibreOf(-3), null);
  assert.equal(readingData({ calibre: "32 A" }).calibre, 32);
  assert.doesNotThrow(() => validateReleve({ appareils: [{ t: "LV", x: 1, y: 1, calibre: "20 A" }] }));
  assert.throws(() => validateReleve({ appareils: [{ t: "LV", x: 1, y: 1, calibre: "beaucoup" }] }), /calibre invalide/);
  const P = aiToPlan(raw, map);
  assert.deepEqual(P.devices.slice(2).map((d) => d.calibre), [20, 32]);
});
test("consigne collée : « ref » W/H et calibre en nombre demandés", () => {
  const t = pastePrompt();
  assert.match(t, /"ref":\{"W":0,"H":0\}/); assert.match(t, /nombre d'ampères sans unité/);
});
test("recalage : décalage + étirement retrouvés, murs collés sur ceux du PDF à moins de 1 cm", () => {
  const P = aiToPlan(raw, map);
  const before = Math.max(...axisLines(P).map((l) => Math.min(...axisLines(ref).filter((r) => r.o === l.o).map((r) => Math.abs(r.c - l.c)))));
  assert.ok(before > 0.2, "le relevé de départ est bien décalé");
  const R = alignPlan(P, ref);
  assert.ok(R.ok, R.raison);
  assert.ok(Math.abs(R.T.y.a - 1 / err.sy) < 0.02, "échelle verticale corrigée " + R.T.y.a);
  const after = Math.max(...axisLines(R.plan).map((l) => Math.min(...axisLines(ref).filter((r) => r.o === l.o).map((r) => Math.abs(r.c - l.c)))));
  assert.ok(after < 0.01, "écart restant " + after);
  assert.ok(R.colles >= 8 && R.apres < R.avant);
});
test("recalage : appareils et pièce suivent le recalage d'ensemble, l'ouverture reste sur son mur", () => {
  const R = alignPlan(aiToPlan(raw, map), ref), P = R.plan;
  const pc = P.devices[0], lum = P.devices[1];
  assert.ok(Math.abs(pc.x - (TRUE.x0 + 12 - 3 * PX)) < 0.1, "prise près du mur droit : " + pc.x);
  assert.ok(Math.abs(lum.x - (TRUE.x0 + 8.5)) < 0.12 && Math.abs(lum.y - (TRUE.y0 + 4.5)) < 0.12, "lumière au centre du séjour");
  assert.ok(Math.abs(P.pieces[0].x - (TRUE.x0 + 8.5)) < 0.12);
  const o = P.openings[0], w = P.walls[o.seg], A = P.nodes[w.a], B = P.nodes[w.b];
  assert.ok(o.t > o.w / 2 && o.t < Math.hypot(B.x - A.x, B.y - A.y) - o.w / 2);
});
test("recalage : sans murs du PDF (scan) ou trop peu de murs → rien n'est déplacé", () => {
  const P = aiToPlan(raw, map);
  const R = alignPlan(P, { nodes: [], walls: [] });
  assert.ok(!R.ok && R.plan === P);
  assert.ok(!alignTransform(P, { nodes: [node(0, 0), node(5, 0)], walls: [{ a: 0, b: 1 }] }).ok);
});
test("garde-fous : 4 murs seulement, ou relevé sans rapport avec le PDF → pas de recalage", () => {
  const sq = aiToPlan({ murs: [[0, 0, 300, 0], [300, 0, 300, 250], [300, 250, 0, 250], [0, 250, 0, 0]].map(([x1, y1, x2, y2]) => ({ x1, y1, x2, y2, ep: 20 })) }, map);
  const r1 = alignTransform(sq, ref); assert.ok(!r1.ok && /trop peu de murs/.test(r1.raison));
  // un autre plan (murs tous les 1,7 m, décalés de 80 cm) : moins de 60 % retrouvés
  const far = { murs: [] };
  for (let i = 0; i < 5; i++) far.murs.push({ x1: 40 + i * 85, y1: 40, x2: 40 + i * 85, y2: 400, ep: 10 }, { x1: 40, y1: 40 + i * 90, x2: 380, y2: 40 + i * 90, ep: 10 });
  const r2 = alignTransform(aiToPlan(far, { ...map, x0: map.x0 + 0.8, y0: map.y0 + 0.8 }), ref);
  assert.ok(!r2.ok, JSON.stringify(r2));
});
console.log(`ai-align : ${n} vérifications OK`);
