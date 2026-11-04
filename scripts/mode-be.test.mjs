// n° 7 (lot B, 04/11/2026) : mode de pieuvre « Bureau d'études » — maison synthétique, aucun plan client.
import assert from "node:assert/strict";
import { CAB_DEFAULTS } from "../src/cablage/settings.js";
import { computeCircuits } from "../src/cablage/circuits.js";
import { placeBoxes, beKindOf, MODES } from "../src/cablage/boites.js";

let n = 0;
const test = (name, f) => { f(); n++; console.log("  ✓ " + name); };
const R = (name, x0, y0, x1, y1) => ({ name, poly: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }], c: { x: (x0 + x1) / 2, y: (y0 + y1) / 2 }, b: [x0, y0, x1, y1] });
const rooms = [
  R("Garage", -4, 0, 0, 5), R("Séjour", 0, 0, 7, 5), R("Cuisine", 7, 0, 10, 4), R("Cellier", 10, 0, 12, 4), R("Entrée", 7, 4, 12, 6),
  R("Dégagement", 0, 5, 7, 6.2), R("Chambre 1", 0, 6.2, 3.5, 10), R("Chambre 2", 3.5, 6.2, 7, 10), R("SdB", 7, 6, 9.5, 10), R("Chambre 3", 9.5, 6, 12, 10),
];
const items = [{ id: "tab", t: "TAB", x: -3.8, y: 2, lv: "rdc", room: "Garage" }], links = [];
let k = 0;
const add = (t, x, y, room, h) => { const id = t.toLowerCase() + ++k; items.push({ id, t, x, y, lv: "rdc", room, rep: t + k, ...(h != null ? { h } : {}) }); return id; };
const prises = { "Séjour": 6, "Cuisine": 5, "Chambre 1": 3, "Chambre 2": 3, "Chambre 3": 3, "Garage": 2, "Cellier": 2, "SdB": 1, "Entrée": 1, "Dégagement": 1 };
for (const r of rooms) {
  const [x0, y0, x1, y1] = r.b, l = add("LUM", r.c.x, r.c.y, r.name), i = add("INT", x0 + 0.3, y0 + 0.1, r.name, 110);
  links.push({ c: i, l });
  for (let p = 0; p < (prises[r.name] || 0); p++) add("PC16", x0 + 0.4 + ((x1 - x0 - 0.8) * p) / Math.max(1, prises[r.name] - 1), y1 - 0.1, r.name, 30);
}
const v = add("VR", 1.5, 9.95, "Chambre 1"), cv = add("CVR", 1, 9.8, "Chambre 1", 110); links.push({ c: cv, l: v });
const v2 = add("VR", 3, 0.05, "Séjour"), cv2 = add("CVR", 2.5, 0.2, "Séjour", 110); links.push({ c: cv2, l: v2 });
const S = { ...CAB_DEFAULTS };
const C = computeCircuits(items, links, S);
const P = placeBoxes(items, links, C, { rdc: items[0] }, S, { mode: "be", rooms: { rdc: rooms.map(({ name, poly }) => ({ name, poly })) } });
const roomOf = new Map(items.map((a) => [a.id, a.room]));
const boxRooms = P.boxes.map((b) => [...new Set(b.apps.filter((id) => !/^(vr|cvr)/.test(id)).map((id) => roomOf.get(id)))].sort());
const boxWith = (room) => boxRooms.find((L) => L.includes(room)) || [];

test("mode proposé dans la liste des modes de pieuvre", () => assert.equal(MODES.be, "Bureau d'études"));
test("noms de pièces : chambre, salle de bain, passage (WC, dégagement, entrée), séjour, cuisine, cellier, garage", () => {
  assert.deepEqual(["Chambre 2", "CH1", "Salle d'eau", "WC", "Dégagement", "Entrée", "Séjour / salon", "Cuisine", "Buanderie", "Garage", "Bureau", "Véranda"].map(beKindOf),
    ["chambre", "chambre", "sdb", "passage", "passage", "passage", "sejour", "cuisine", "cellier", "garage", "chambre", "autre"]);
});
test("chambre 1 + chambre 2 dans la même boîte ; salle de bain + chambre 3", () => {
  assert.ok(boxWith("Chambre 1").includes("Chambre 2"), JSON.stringify(boxRooms));
  assert.ok(boxWith("SdB").includes("Chambre 3"), JSON.stringify(boxRooms));
});
test("cuisine + cellier ; séjour + garage", () => {
  assert.ok(boxWith("Cuisine").includes("Cellier"), JSON.stringify(boxRooms));
  assert.ok(boxWith("Séjour").includes("Garage"), JSON.stringify(boxRooms));
});
test("passages avec une voisine (jamais une boîte pour eux seuls) ; jamais deux pièces principales de couples différents", () => {
  assert.ok(boxRooms.filter((L) => L.length).every((L) => L.some((r) => beKindOf(r) !== "passage")), JSON.stringify(boxRooms));
  assert.ok(boxRooms.every((L) => L.filter((r) => beKindOf(r) !== "passage").length <= 2), JSON.stringify(boxRooms));
});
test("volets roulants : une boîte rien que pour eux", () => {
  const vb = P.boxes.filter((b) => b.apps.some((id) => /^(vr|cvr)/.test(id)));
  assert.equal(vb.length, 1); assert.ok(vb[0].apps.every((id) => /^(vr|cvr)/.test(id)), JSON.stringify(vb[0].apps));
});
test("chaque boîte posée dans une de ses pièces ; capacité respectée", () => {
  const inside = (p, Q) => { let c = false; for (let i = 0, j = Q.length - 1; i < Q.length; j = i++) if ((Q[i].y > p.y) !== (Q[j].y > p.y) && p.x < ((Q[j].x - Q[i].x) * (p.y - Q[i].y)) / (Q[j].y - Q[i].y) + Q[i].x) c = !c; return c; };
  P.boxes.forEach((b, i) => { if (b.apps.every((id) => /^(vr|cvr)/.test(id))) return; assert.ok(boxRooms[i].some((r) => inside(b, rooms.find((x) => x.name === r).poly)), `${b.n} hors de ${boxRooms[i]}`); });
  assert.equal(P.issues.length, 0, P.issues.join(" ; "));
});
test("séjour trop chargé : ses prises les plus proches de la cuisine vont dans la boîte de la cuisine", () => {
  const big = items.concat(Array.from({ length: 14 }, (_, i) => ({ id: "xs" + i, t: "PC16", x: 0.3 + i * 0.48, y: 4.9, lv: "rdc", room: "Séjour", h: 30, rep: "PX" + i })));
  const C2 = computeCircuits(big, links, S), P2 = placeBoxes(big, links, C2, { rdc: items[0] }, { ...S, departsMax: 12 }, { mode: "be", rooms: { rdc: rooms.map(({ name, poly }) => ({ name, poly })) } });
  const cuis = P2.boxes.find((b) => b.apps.some((id) => roomOf.get(id) === "Cuisine"));
  assert.ok(cuis && cuis.apps.some((id) => /^xs/.test(id)), JSON.stringify(P2.boxes.map((b) => b.apps.length)));
});
console.log(`mode BE : ${n} vérifications OK`);
