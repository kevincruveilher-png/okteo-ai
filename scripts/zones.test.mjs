// n° 10 (lot C, 04/11/2026) : zones d'exclusion — géométrie, gaines, lignes directes, boîtes ; chantier synthétique.
import assert from "node:assert/strict";
import { CAB_DEFAULTS } from "../src/cablage/settings.js";
import { computeCircuits } from "../src/cablage/circuits.js";
import { computeWiring } from "../src/cablage/gaines.js";
import { placeBoxes } from "../src/cablage/boites.js";
import { isZone, zonePoly, detour, detourVia, pushOut, segHits, zonesByLevel, insideAny } from "../src/cablage/exclusion.js";
import { sani3d, isSani } from "../src/cablage/volumes.js";

let n = 0;
const test = (name, f) => { f(); n++; console.log("  ✓ " + name); };
const len = (A, pts, B) => { let p = A, L = 0; for (const q of [...pts, B]) { L += Math.hypot(q.x - p.x, q.y - p.y); p = q; } return L; };
const Z = { id: "z", t: "ZONE", x: 5, y: 0, sw: 2, sd: 2, lv: "rdc" }, P = zonePoly(Z);

test("types ZONE (rectangle) et ZONEC (cercle) : sans électricité, sans repère, bloc 3D sur toute la hauteur", () => {
  assert.ok(isZone("ZONE") && isZone("ZONEC") && !isZone("WC") && isSani("ZONE"));
  assert.equal(P.length, 4);
  const c = zonePoly({ t: "ZONEC", x: 0, y: 0, sw: 1, sd: 1 });
  assert.ok(c.length >= 20 && c.every((p) => Math.abs(Math.hypot(p.x, p.y) - 0.5) < 1e-9));
  const s = sani3d(Z); assert.ok(s[0].zone && s[0].z0 === 0 && s[0].z1 >= 2.5);
});
test("contournement : trajet libre = rien ; trajet qui traverse = passe par les coins, en dehors de la zone, à peine plus long", () => {
  assert.deepEqual(detour({ x: 0, y: 3 }, { x: 10, y: 3 }, [P]), []);
  const v = detour({ x: 0, y: 0 }, { x: 10, y: 0 }, [P]);
  assert.ok(v.length >= 2);
  const L = [{ x: 0, y: 0 }, ...v, { x: 10, y: 0 }];
  for (let i = 1; i < L.length; i++) assert.ok(!segHits(L[i - 1], L[i], P), "tronçon dans la zone");
  const l = len({ x: 0, y: 0 }, v, { x: 10, y: 0 }); assert.ok(l > 10 && l < 11.5, String(l));
  const c = detour({ x: 0, y: 0 }, { x: 10, y: 0 }, [zonePoly({ t: "ZONEC", x: 5, y: 0, sw: 2, sd: 2 })]);
  assert.ok(c.length >= 1);
});
test("contournement avec points de passage tracés à la main ; zone qui contient un bout = ignorée", () => {
  const v = detourVia({ x: 0, y: 0 }, [{ x: 5, y: 3 }], { x: 10, y: 0 }, [P]);
  assert.deepEqual(v, [{ x: 5, y: 3 }]);
  assert.deepEqual(detour({ x: 5, y: 0 }, { x: 10, y: 0 }, [P]), []);
});
test("boîte dans une zone : repoussée hors de la zone (marge 15 cm)", () => {
  const q = pushOut({ x: 5.3, y: 0.2 }, [P]);
  assert.ok(!insideAny(q, [P]) && Math.abs(q.x - 6.15) < 1e-9, JSON.stringify(q));
  assert.deepEqual(pushOut({ x: 0, y: 0 }, [P]), { x: 0, y: 0 });
});
// petit chantier : boîte en (0, 0), prise en (10, 0), tableau en (0, -6), RJ45 en (10, -6) ; zone entre la boîte et la prise
const items = [
  { id: "tab", t: "TAB", x: 0, y: -6, lv: "rdc" },
  { id: "p1", t: "PC16", x: 10, y: 0, h: 30, lv: "rdc", rep: "P1" },
  { id: "rj", t: "RJ45", x: 10, y: -6, h: 30, lv: "rdc", rep: "RJ1" },
];
const S = { ...CAB_DEFAULTS };
const wire = (its) => { const C = computeCircuits(its, [], S); return computeWiring({ items: its, links: [], circuits: C, boxes: [{ id: "b", n: "LI01", lv: "rdc", x: 0, y: 0, apps: ["p1"] }], levels: ["rdc"], S }); };
test("gaine : contourne la zone, plus longue, points du contournement donnés (plan, impression, 3D)", () => {
  const W0 = wire(items), W1 = wire([...items, Z]);
  const g0 = W0.boxes[0].gaines.find((g) => g.appIds && g.appIds.includes("p1")), g1 = W1.boxes[0].gaines.find((g) => g.appIds && g.appIds.includes("p1"));
  assert.ok(!g0.via && g1.via && g1.via.length >= 2 && g1.detour, JSON.stringify(g1.via));
  assert.ok(g1.length > g0.length, `${g0.length} → ${g1.length}`);
});
test("ligne directe : contourne la zone (tracée sur le plan), les autres restent des flèches", () => {
  const W0 = wire(items), W1 = wire([...items, { id: "z2", t: "ZONE", x: 5, y: -6, sw: 2, sd: 2, lv: "rdc" }]);
  const d0 = W0.direct.find((d) => d.appId === "rj"), d1 = W1.direct.find((d) => d.appId === "rj");
  assert.ok(d0 && !d0.via && d1.via && d1.via.length >= 2 && d1.length > d0.length);
});
test("placement automatique : aucune boîte dans une zone", () => {
  const its = [{ id: "tab", t: "TAB", x: -6, y: 0, lv: "rdc" }, ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, y], i) => ({ id: "q" + i, t: "PC16", x, y, h: 30, lv: "rdc", rep: "P" + i }))];
  const C = computeCircuits(its, [], S);
  const free = placeBoxes(its, [], C, { rdc: its[0] }, S, {}), zp = { id: "zz", t: "ZONE", x: free.boxes[0].x, y: free.boxes[0].y, sw: 1, sd: 1, lv: "rdc" };
  const r = placeBoxes([...its, zp], [], C, { rdc: its[0] }, S, {});
  const ZL = zonesByLevel([zp]);
  assert.ok(r.boxes.length && r.boxes.every((b) => !insideAny(b, ZL.rdc)), JSON.stringify(r.boxes.map((b) => [b.x, b.y])));
});
console.log(`zones : ${n} vérifications OK`);
