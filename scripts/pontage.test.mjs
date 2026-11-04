// n° 6 (lot B, 04/11/2026) : association et pontage dans le calcul des gaines — chantier synthétique, aucun plan client.
import assert from "node:assert/strict";
import { CAB_DEFAULTS } from "../src/cablage/settings.js";
import { computeCircuits } from "../src/cablage/circuits.js";
import { computeWiring } from "../src/cablage/gaines.js";

let n = 0;
const test = (name, f) => { f(); n++; console.log("  ✓ " + name); };

// boîte en (0, 0) ; 4 prises en ligne à 3, 4,5, 6, 7,5 m (deux pièces) ; 3 plafonniers d'un même interrupteur ; une prise
// double (2 PC16 sur la même plaque) ; un RJ45 collé à une prise ; tableau loin
const items = [
  { id: "tb", t: "TAB", x: -6, y: 0, lv: "rdc" },
  ...[3, 4.5, 6, 7.5].map((x, i) => ({ id: "p" + i, t: "PC16", x, y: 2, h: 30, lv: "rdc", rep: "P" + (i + 1), room: i < 2 ? "Chambre 1" : "Chambre 2" })),
  { id: "i1", t: "INT", x: 1, y: -1, h: 110, lv: "rdc", rep: "I1" },
  ...[2, 4, 6].map((x, i) => ({ id: "l" + i, t: "LUM", x, y: -3, lv: "rdc", rep: "L" + (i + 1) })),
  { id: "d1", t: "PC16", x: -2, y: 3, h: 30, lv: "rdc", rep: "P8" }, { id: "d2", t: "PC16", x: -1.9, y: 3, h: 30, lv: "rdc", rep: "P9" },
  { id: "rj", t: "RJ45", x: -2.05, y: 3.1, h: 30, lv: "rdc", rep: "RJ1" },
];
const links = [0, 1, 2].map((i) => ({ c: "i1", l: "l" + i }));
const run = (S) => {
  const circuits = computeCircuits(items, links, S);
  const inBox = new Set(circuits.filter((c) => !c.direct && c.kind !== "comm").flatMap((c) => c.apps));
  const boxes = [{ id: "b1", n: "LI01", lv: "rdc", x: 0, y: 0, apps: items.filter((a) => inBox.has(a.id)).map((a) => a.id) }];
  return computeWiring({ items, links, circuits, boxes, levels: ["rdc"], S });
};
const S0 = { ...CAB_DEFAULTS }, W0 = run(S0), B0 = W0.boxes[0];
const appG = (B) => B.gaines.filter((g) => g.kind === "app");

test("association : prise double (même plaque) = une seule gaine, fils communs une fois ; le RJ45 n'y entre jamais", () => {
  const g = appG(B0).find((x) => x.appIds.includes("d1"));
  assert.ok(g && g.appIds.includes("d2"), "d1 + d2 dans la même gaine");
  assert.equal(g.wires.length, 3, "phase, neutre, terre une seule fois");
  assert.ok(!appG(B0).some((x) => x.appIds.includes("rj")), "le RJ45 reste en ligne directe");
});
test("sans pontage (par défaut) : une gaine par endroit, aucun tronçon de pontage", () => {
  assert.ok(!S0.pontage);
  assert.ok(appG(B0).every((g) => !g.ponts));
  assert.equal(appG(B0).filter((g) => g.appIds.some((id) => /^p\d/.test(id))).length, 4);
});
const S1 = { ...CAB_DEFAULTS, pontage: true }, W1 = run(S1), B1 = W1.boxes[0];
test("pontage : les 4 prises du même circuit sur une gaine (d'une chambre à l'autre), de proche en proche depuis la boîte", () => {
  const g = appG(B1).find((x) => x.appIds.includes("p0"));
  assert.ok(g && ["p0", "p1", "p2", "p3"].every((id) => g.appIds.includes(id)), JSON.stringify(appG(B1).map((x) => x.appIds)));
  assert.deepEqual(g.ponts.map((p) => [p.from, p.to]), [["p0", "p1"], ["p1", "p2"], ["p2", "p3"]]);
  assert.match(g.label, /P1 → P2 → P3 → P4 \(pontage\)/);
  assert.ok(g.pontLen > 0 && g.ponts.every((p) => p.length > 1.5), "tronçon = 1,5 m à plat + montées et descentes");
  assert.equal(g.wires.length, 3);
});
test("pontage : les 3 lumières d'un même allumage chaînées ; l'interrupteur garde sa gaine", () => {
  const g = appG(B1).find((x) => x.appIds.includes("l0"));
  assert.ok(g && g.appIds.length === 3 && g.ponts.length === 2, JSON.stringify(g && g.appIds));
  assert.ok(appG(B1).some((x) => x.appIds.includes("i1") && !x.ponts));
  assert.deepEqual(g.wires.map((w) => w.fn).sort(), ["neutre", "retour", "terre"]);
});
test("pontage : moins de départs, fil et gaine comptés avec les tronçons", () => {
  assert.ok(appG(B1).length <= appG(B0).length - 4, `${appG(B0).length} → ${appG(B1).length}`);
  const sum = (B) => B.gaines.reduce((s, g) => s + (g.length || 0) + (g.pontLen || 0), 0);
  assert.ok(Math.abs(B1.longueur - +sum(B1).toFixed(2)) < 1e-6);
  assert.ok(W1.totals.cuivre < W0.totals.cuivre, `cuivre ${W0.totals.cuivre} → ${W1.totals.cuivre}`);
});
test("pontage : au plus « pontageMax » endroits à la suite (2 → prises par paires)", () => {
  const B = run({ ...S1, pontageMax: 2 }).boxes[0], gs = appG(B).filter((g) => g.appIds.some((id) => /^p\d/.test(id)));
  assert.ok(gs.every((g) => g.appIds.length <= 2) && gs.length === 2, JSON.stringify(gs.map((g) => g.appIds)));
});
test("pontage : un endroit plus près de la boîte que de la prise précédente n'est pas ponté", () => {
  const far = [{ ...items[0] }, { id: "q0", t: "PC16", x: 3, y: 0, h: 30, lv: "rdc", rep: "P1" }, { id: "q1", t: "PC16", x: -3, y: 0, h: 30, lv: "rdc", rep: "P2" }];
  const C = computeCircuits(far, [], S1), W = computeWiring({ items: far, links: [], circuits: C, boxes: [{ id: "b", n: "LI01", lv: "rdc", x: 0, y: 0, apps: ["q0", "q1"] }], levels: ["rdc"], S: S1 });
  assert.equal(W.boxes[0].gaines.filter((g) => g.kind === "app").length, 2);
});
console.log(`pontage : ${n} vérifications OK`);
