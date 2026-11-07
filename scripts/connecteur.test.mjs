// 07/11/2026 : connecteur rapide d'un n° de raccordement (dessin compact du coin de la bande, écran et téléphone)
import assert from "node:assert/strict";
import { connectorsFor } from "../src/cablage/schema.js";
import { connectorPlaces, connecteurSVG, connecteurCard, connecteurTitle, rowsOf } from "../src/cablage/connecteur.js";

let n = 0;
const test = (name, f) => { f(); n++; console.log("  ✓ " + name); };
const SIZES = [2, 3, 4, 5, 6, 8, 10, 12];
const step = (k, color = "orange") => ({ n: 7, label: "Retour lampe", fn: "retour", wires: Array.from({ length: k }, (_, i) => ({ gaine: "LI01.0" + (i + 1), color, section: 1.5 })), conn: connectorsFor(k, SIZES) });
const count = (s, re) => (s.match(re) || []).length;
const rows = (svg) => [...svg.matchAll(/data-size="(\d+)" data-rows="(\d)"/g)].map((m) => [+m[1], +m[2]]);

test("2 fils orange → connecteur 2 (une rangée), deux fils orange, rien d'autre", () => {
  const svg = connecteurSVG(step(2), { color: (c) => (c === "orange" ? "#f80" : "#000") });
  assert.deepEqual(rows(svg), [[2, 1]]); assert.equal(count(svg, /class="cw"/g), 2); assert.equal(count(svg, /stroke="#f80"/g), 2);
  assert.doesNotMatch(connecteurCard(step(2), { color: () => "#f80" }), /<li>|<b>|places/);
});
test("3, 4, 5 : une rangée ; 6 = 3 + 3, 8 = 4 + 4, 10 = 5 + 5, 12 = 6 + 6 : deux rangées", () => {
  for (const k of [3, 4, 5]) assert.deepEqual(rows(connecteurSVG(step(k))), [[k, 1]]);
  for (const k of [6, 8, 10, 12]) { assert.equal(rowsOf(k), 2); assert.deepEqual(rows(connecteurSVG(step(k))), [[k, 2]]); }
});
test("7 fils → connecteur 8 (4 + 4), 7 fils dessinés, une place vide", () => {
  assert.deepEqual(connectorPlaces(step(7).conn), [{ size: 8, cap: 8 }]);
  assert.equal(count(connecteurSVG(step(7)), /class="cw"/g), 7);
});
test("14 fils → 12 + 4 reliés par un pont (11 + 3 fils, le pont prend une place de chaque), pont à la couleur des fils", () => {
  const S = step(14, "vert/jaune"), P = connectorPlaces(S.conn), svg = connecteurSVG(S, { color: (c) => (c === "vert" ? "#0a0" : "#ff0") });
  assert.deepEqual(S.conn, { list: [12, 4], ponts: 1 });
  assert.deepEqual(P, [{ size: 12, cap: 11 }, { size: 4, cap: 3 }]);
  assert.deepEqual(rows(svg), [[12, 2], [4, 1]]);
  assert.equal(count(svg, /class="cw"/g), 14); assert.equal(count(svg, /class="pont"[^>]*stroke="#ff0"/g), 1);
  assert.match(connecteurTitle(S), /12 \+ 4 reliés par un pont/);
});
test("fil seul : pas de dessin, le coin dit « fil seul » ; l'infobulle donne n°, libellé, fils et connecteur", () => {
  assert.equal(connecteurSVG(step(1)), "");
  assert.match(connecteurCard(step(1)), /fil seul/);
  assert.equal(connecteurTitle(step(3)), "7 · Retour lampe · 3 fils → connecteur 3");
});
console.log(`connecteur : ${n} vérifications OK`);
