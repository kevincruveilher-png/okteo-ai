// n° 3 (bloc D, 04/11/2026) : outils de l'IA (symboles, textes, murs, zoom, légende, vérification) — données synthétiques.
import assert from "node:assert/strict";
import { AI_TOOLS, runTool, checkReleve, symbolShapes, TOOLS_GUIDE } from "../src/walls/ai-tools.js";

let n = 0;
const test = async (name, f) => { await f(); n++; console.log("  ✓ " + name); };
const ctx = {
  W: 1000, H: 700, vector: true,
  shapes: [{ x: 100, y: 100, w: 12, h: 12, kind: "cercle", color: "#ff0000" }, { x: 108, y: 100, w: 6, h: 6, kind: "cercle", color: "#ff0000", fill: true },
    { x: 400, y: 300, w: 14, h: 10, kind: "rectangle", color: "#000000" }, { x: 500, y: 350, w: 800, h: 600, kind: "rectangle" }, { x: 600, y: 600, w: 0.5, h: 0.5, kind: "trait" }],
  texts: [{ s: "16A", x: 410, y: 310, h: 8 }, { s: "Séjour", x: 300, y: 250, h: 14 }],
  walls: [{ x1: 50, y1: 50, x2: 950, y2: 50, ep: 34 }],
  memory: [{ type: "RJ45", desc: "carré avec un « I »", pav: "Maisons Test", chantier: "ESSAI" }], legendText: "Prise de courant · Interrupteur", pav: "Maisons Test",
  zoom: async (z) => ({ data: "AAAA", W: 600, H: 400, z }), zoomsLeft: 1,
};
await test("6 outils déclarés au format de l'API (nom, description, schéma) ; consigne d'usage", () => {
  assert.deepEqual(AI_TOOLS.map((t) => t.name), ["legende", "symboles", "textes", "murs", "zoom", "verifier"]);
  assert.ok(AI_TOOLS.every((t) => /^[a-z_]+$/.test(t.name) && t.description && t.input_schema.type === "object" && Object.keys(t).length === 3));
  assert.match(TOOLS_GUIDE, /verifier/);
});
await test("symboles : formes d'une zone, collées regroupées, ni murs ni poussières", async () => {
  assert.equal(symbolShapes(ctx.shapes, 1000).length, 3);
  const r = await runTool("symboles", { x: 0, y: 0, w: 1000, h: 700 }, ctx);
  assert.match(r.text, /^2 symbole/); assert.match(r.text, /2 formes collées/);
  const z = await runTool("symboles", { x: 300, y: 250, w: 200, h: 100 }, ctx); assert.match(z.text, /^1 symbole/);
  assert.match((await runTool("symboles", {}, { ...ctx, vector: false })).text, /scanné/);
});
await test("textes, murs, légende et mémoire des symboles du pavillonneur", async () => {
  assert.match((await runTool("textes", { x: 380, y: 280, w: 60, h: 60 }, ctx)).text, /« 16A » \(410, 310\)/);
  assert.match((await runTool("murs", { x: 0, y: 0, w: 1000, h: 100 }, ctx)).text, /ep 34 cm/);
  const L = (await runTool("legende", {}, ctx)).text;
  assert.match(L, /Prise de courant/); assert.match(L, /RJ45 : carré avec un « I » \(Maisons Test, ESSAI\)/); assert.match(L, /la légende du plan fait foi|La légende du plan fait foi/);
});
await test("zoom : image renvoyée avec la règle de conversion ; nombre de zooms borné", async () => {
  const z = await runTool("zoom", { x: 100, y: 50, w: 300, h: 200 }, ctx);
  assert.equal(z.image, "AAAA"); assert.match(z.text, /x = 100 \+ px × 0\.500/);
  assert.match((await runTool("zoom", { x: 0, y: 0, w: 10, h: 10 }, ctx)).text, /Plus de zoom/);
});
await test("vérifier : décompte, lumière sans commande, commande sans lumière, va-et-vient seul, volets, symboles non couverts", () => {
  const t = checkReleve({ appareils: [{ t: "LUM", x: 100, y: 100 }, { t: "INT", x: 50, y: 60 }, { t: "VV", x: 70, y: 60 }, { t: "VR", x: 900, y: 50 }], liaisons: [] }, ctx);
  assert.match(t, /Décompte : INT 1, LUM 1, VR 1, VV 1 \(total 4\)/);
  assert.match(t, /Lumières sans commande \(1\)/); assert.match(t, /Commandes qui n'allument rien \(2\)/); assert.match(t, /Un seul va-et-vient/); assert.match(t, /1 VR pour 0 CVR/);
  assert.match(t, /Symboles probables du PDF : 2 ; sans appareil relevé à leur place : 1/);
  assert.match(checkReleve({ appareils: [{ t: "INT", x: 0, y: 0 }, { t: "LUM", x: 9, y: 9 }], liaisons: [[0, 1]] }, { W: 100 }), /^Décompte : INT 1, LUM 1 \(total 2\)\.$/);
});
console.log(`outils de l'IA : ${n} vérifications OK`);
