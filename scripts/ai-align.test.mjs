// v77 : réponse collée — « ref » tolérant, calibre en texte, recalage du relevé IA sur les murs du PDF.
// Maison synthétique (aucun plan client) : murs « vrais » = ceux du PDF ; relevé IA = mêmes murs décalés, étirés et bruités.
import assert from "node:assert/strict";
import { aiToPlan, refOf, pastePrompt, aiPrompt, scaleClaim, scaleCheck, parseAiJson } from "../src/walls/ai-plan.js";
import { readingData, validateReleve, calibreOf } from "../src/walls/ai-data.js";
import { alignPlan, alignTransform, axisLines, mergeBands } from "../src/walls/ai-align.js";

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
test("n° 4 : consigne (collage et relevé avec clé) : un seul mur maçonnerie + doublage, cloisons jusqu'à l'axe, pointillés, placards, symboles tournés, doutes à deux types, échelle sur les cotes, guillemets droits", () => {
  for (const p of [pastePrompt({ page: 2 }), aiPrompt({ W: 1500, H: 1000, cmPerPx: 0.8 })]) {
    for (const re of [/UN SEUL mur/, /jusqu'à l'AXE du mur/, /JAMAIS des murs/, /Placard : fermé sur 3 côtés/, /Symboles tournés/, /deux types nommés/, /pixels par mètre/, /guillemets droits/]) assert.match(p, re);
  }
  assert.match(pastePrompt({ page: 2 }), /page 2/);
});
test("n° 4 : échelle annoncée dans les remarques comparée à l'échelle du fond (3 % de tolérance) ; réponse à guillemets typographiques lue", () => {
  assert.equal(scaleClaim("échelle : 236 pixels par mètre (cotes utilisées : 2,00 = 473 px)"), 236);
  assert.equal(scaleClaim("236,2 px/m"), 236.2);
  assert.equal(scaleClaim("aucune échelle"), null);
  assert.ok(scaleCheck("échelle : 236 pixels par mètre", { sx: 1 / 236.2 }).ok);
  const bad = scaleCheck("échelle : 236 pixels par mètre", { sx: 1 / 200 });
  assert.ok(!bad.ok && bad.ecart > 15);
  assert.equal(scaleCheck("rien", { sx: 0.004 }), null);
  const raw = parseAiJson("{\u201cref\u201d:{\u201cW\u201d:4961,\u201dH\u201d:3508},\u201cmurs\u201d:[],\u201cremarques\u201d:\u201d\u00e9chelle : 236 pixels par m\u00e8tre\u201d}");
  assert.equal(raw.ref.H, 3508); assert.equal(scaleClaim(raw.remarques), 236);
});
test("lot 6 : maçonnerie + doublage relevés en deux bandes sur le PDF = un seul mur (axe au milieu de l'épaisseur totale) ; le mur de l'IA y est collé", () => {
  // mur extérieur gauche : maçonnerie 20 cm (axe x = 0,10) + doublage 10 cm collé côté intérieur (axe x = 0,25) ; épaisseur 30 cm, milieu 0,15
  const B = { nodes: [{ x: 0.1, y: 0 }, { x: 0.1, y: 9 }, { x: 0.25, y: 0.3 }, { x: 0.25, y: 8.7 }, { x: 5, y: 0 }, { x: 5, y: 9 }], walls: [{ a: 0, b: 1, ep: 0.2 }, { a: 2, b: 3, ep: 0.1 }, { a: 4, b: 5, ep: 0.07 }] };
  const M = mergeBands(axisLines(B)).filter((l) => l.o === "v").sort((p, q) => p.c - q.c);
  assert.equal(M.length, 2, JSON.stringify(M));
  assert.ok(Math.abs(M[0].c - 0.15) < 1e-6 && Math.abs(M[0].ep - 0.3) < 1e-6 && M[0].merged === 2, JSON.stringify(M[0]));
  assert.ok(Math.abs(M[1].c - 5) < 1e-6 && M[1].merged === 1, "cloison isolée inchangée");
  // deux murs parallèles séparés par une pièce ne sont jamais réunis
  const far = mergeBands(axisLines({ nodes: [{ x: 0, y: 0 }, { x: 0, y: 5 }, { x: 0.5, y: 0 }, { x: 0.5, y: 5 }], walls: [{ a: 0, b: 1, ep: 0.2 }, { a: 2, b: 3, ep: 0.2 }] }));
  assert.equal(far.length, 2);
  // maison 12 × 9 du PDF avec murs extérieurs en deux bandes (20 + 10 cm) ; l'IA donne des murs de 30 cm à l'axe total
  const R2 = JSON.parse(JSON.stringify(ref));
  const extra = [[0, 3, "v", 0.15], [1, 2, "v", -0.15], [0, 1, "h", 0.15], [3, 2, "h", -0.15]];
  for (const [a, b, o, d] of extra) {
    const A = R2.nodes[a], Bn = R2.nodes[b], k = R2.nodes.length;
    R2.nodes.push(o === "v" ? { x: A.x + d, y: A.y + 0.3 } : { x: A.x + 0.3, y: A.y + d }, o === "v" ? { x: Bn.x + d, y: Bn.y - 0.3 } : { x: Bn.x - 0.3, y: Bn.y + d });
    R2.walls.push({ a: k, b: k + 1, ep: 0.1 });
  }
  // axe total des murs extérieurs : décalé de 5 cm vers l'intérieur par rapport à la maçonnerie
  const ai = { nodes: ref.nodes.map((p) => ({ x: p.x + (p.x - TRUE.x0 < 1 ? 0.05 : p.x - TRUE.x0 > 11 ? -0.05 : 0) + 0.12, y: p.y + (p.y - TRUE.y0 < 1 ? 0.05 : p.y - TRUE.y0 > 8 ? -0.05 : 0) - 0.08 })), walls: ref.walls.map((w) => ({ ...w, ep: 0.3 })), openings: [], pieces: [], devices: [] };
  const r = alignPlan(ai, R2);
  assert.ok(r.ok, r.raison);
  const left = Math.min(...r.plan.nodes.map((p) => p.x));
  assert.ok(Math.abs(left - (TRUE.x0 + 0.05)) < 0.02, `mur gauche à l'axe des deux bandes : ${left}`);
});
test("lot 6 : murs qui se croisent en X coupés au croisement (les deux pièces restent séparées)", () => {
  const rawX = { ref: { W: 1000, H: 1000 }, murs: [{ x1: 100, y1: 100, x2: 900, y2: 100, ep: 20 }, { x1: 900, y1: 100, x2: 900, y2: 900, ep: 20 }, { x1: 900, y1: 900, x2: 100, y2: 900, ep: 20 }, { x1: 100, y1: 900, x2: 100, y2: 100, ep: 20 },
    { x1: 500, y1: 50, x2: 500, y2: 950, ep: 10 }, { x1: 50, y1: 500, x2: 950, y2: 500, ep: 10 }], ouvertures: [], pieces: [], appareils: [], liaisons: [] };
  const P = aiToPlan(rawX, { x0: 0, y0: 0, sx: 0.01, sy: 0.01 });
  assert.ok(P.stats.croisements >= 1, JSON.stringify(P.stats));
  const c = P.nodes.findIndex((q) => Math.abs(q.x - 5) < 0.02 && Math.abs(q.y - 5) < 0.02);
  assert.ok(c >= 0, "sommet au croisement");
  assert.equal(P.walls.filter((w) => w.a === c || w.b === c).length, 4, "4 murs partent du croisement");
});
console.log(`ai-align : ${n} vérifications OK`);
