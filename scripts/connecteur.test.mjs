// 07/11/2026 : connecteur rapide d'un n° de raccordement (fiche du clic sur un numéro, onglet Bandes et page du QR code)
import assert from "node:assert/strict";
import { connectorsFor } from "../src/cablage/schema.js";
import { connectorPlaces, connecteurSVG, connecteurCard } from "../src/cablage/connecteur.js";

let n = 0;
const test = (name, f) => { f(); n++; console.log("  ✓ " + name); };
const SIZES = [2, 3, 4, 5, 6, 8, 10, 12];
const step = (k, color = "bleu") => ({ n: 7, label: "Neutre", fn: "neutre", wires: Array.from({ length: k }, (_, i) => ({ gaine: "LI01.0" + (i + 1), color, section: 1.5, fn: "neutre", label: "P" + i })), conn: connectorsFor(k, SIZES) });
const count = (s, re) => (s.match(re) || []).length;

test("3 fils → un connecteur 3 places, 3 fils dessinés, pas de pont", () => {
  const S = step(3), P = connectorPlaces(S.conn), svg = connecteurSVG(S, { color: () => "#00f" });
  assert.deepEqual(P, [{ size: 3, cap: 3 }]);
  assert.equal(count(svg, /class="cw"/g), 3); assert.equal(count(svg, /class="pont"/g), 0); assert.match(svg, /3 places/);
});
test("5 fils → connecteur 5 places ; 7 fils → 8 places (taille au-dessus), 7 fils dessinés, une place vide", () => {
  assert.deepEqual(connectorPlaces(step(5).conn), [{ size: 5, cap: 5 }]);
  assert.deepEqual(connectorPlaces(step(7).conn), [{ size: 8, cap: 8 }]);
  assert.equal(count(connecteurSVG(step(7), { color: () => "#00f" }), /class="cw"/g), 7);
});
test("14 fils (au-delà de 12) → 12 + 4 reliés par un pont : 11 + 3 fils, le pont prend une place de chaque", () => {
  const S = step(14), P = connectorPlaces(S.conn), svg = connecteurSVG(S, { color: () => "#00f" });
  assert.deepEqual(S.conn, { list: [12, 4], ponts: 1 });
  assert.deepEqual(P, [{ size: 12, cap: 11 }, { size: 4, cap: 3 }]);
  assert.equal(P.reduce((s, c) => s + c.cap, 0), 14);
  assert.equal(count(svg, /class="cw"/g), 14); assert.equal(count(svg, /class="pont"/g), 1);
});
test("fiche : n°, libellé, « connecteur 3 places », une ligne par fil avec sa gaine ; vert/jaune dessiné en deux couleurs", () => {
  const S = step(3, "vert/jaune"), esc = (s) => String(s ?? "");
  const h = connecteurCard(S, { color: (c) => (c === "vert" ? "#0a0" : "#ff0"), css: () => "#ff0", esc, fr: (v) => String(v) });
  assert.match(h, />7</); assert.match(h, /Neutre/); assert.match(h, /connecteur <b>3 places<\/b>/);
  assert.equal(count(h, /<li>/g), 3); assert.match(h, /LI01\.01/);
  assert.equal(count(connecteurSVG(S, { color: (c) => (c === "vert" ? "#0a0" : "#ff0") }), /stroke-dasharray="6 5"/g), 3);
});
test("fil seul (1 fil) : aucun connecteur, la fiche le signale", () => {
  const S = step(1);
  assert.equal(connecteurSVG(S), "");
  assert.match(connecteurCard(S, { color: () => "#000", css: () => "#000", esc: String, fr: String }), /fil seul/);
});
console.log(`connecteur : ${n} vérifications OK`);
