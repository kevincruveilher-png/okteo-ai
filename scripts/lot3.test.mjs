// Lot 3 de la reprise des paramètres du BE (06/11/2026) : options des appareils et obstacles (sans navigateur).
import { computeWiring } from "../src/cablage/gaines.js";
import { computeCircuits } from "../src/cablage/circuits.js";
import { CAB_DEFAULTS as S } from "../src/cablage/settings.js";
import { isZone, zonePoly, detour } from "../src/cablage/exclusion.js";
import { APPAREILS } from "../src/cablage/appareils.js";
import { AI_TYPES } from "../src/walls/ai-plan.js";

let ok = 0, ko = 0;
const check = (n, c, i) => { if (c) { ok++; console.log("  ✓ " + n); } else { ko++; console.log("  ✗ " + n + (i ? " — " + i : "")); } };
const one = (its, lk) => { const C = computeCircuits(its, lk, S); return computeWiring({ items: [...its, { id: "tb", t: "TAB", x: -3, y: 0, lv: "rdc" }], links: lk, circuits: C, boxes: [{ id: "b", n: "LI01", lv: "rdc", x: 1, y: 1, apps: its.map((a) => a.id) }], levels: ["rdc"], S }); };
const fn = (W, id) => W.boxes[0].gaines.find((g) => (g.appIds || []).includes(id)).wires.map((w) => w.fn).sort().join(",");

console.log("Interrupteur lumineux / à témoin (décision n° 2)");
const L = [{ c: "i", l: "l" }];
const a = one([{ id: "i", t: "INT", x: 0, y: 0, lv: "rdc", rep: "I1" }, { id: "l", t: "LUM", x: 2, y: 2, lv: "rdc", rep: "L1" }], L);
const b = one([{ id: "i", t: "INT", x: 0, y: 0, lv: "rdc", rep: "I1", temoin: true }, { id: "l", t: "LUM", x: 2, y: 2, lv: "rdc", rep: "L1" }], L);
check("sans option : phase + retour ; avec : phase + retour + neutre bleu", fn(a, "i") === "phase,retour" && fn(b, "i") === "neutre,phase,retour", fn(b, "i"));
check("le neutre du circuit monte dans l'alimentation", b.boxes[0].gaines.find((g) => g.kind === "alim").wires.some((w) => w.fn === "neutre"));

console.log("Trémies et réservations = obstacles (décision n° 21)");
check("5 types (trémies 50, 100, 200 × 150 ; réservations Ø50, Ø100) = zones d'exclusion, groupe « Zones d'exclusion », hors de la lecture IA",
  ["TR50", "TR100", "TR200", "RS50", "RS100"].every((t) => isZone(t) && APPAREILS[t].groupe === "Zones d'exclusion" && !AI_TYPES[t]));
const P = zonePoly({ t: "TR200", x: 5, y: 0 });
const area = P.reduce((s, p, i) => { const q = P[(i + 1) % P.length]; return s + p.x * q.y - q.x * p.y; }, 0) / 2;
check("trémie 200 × 150 : 3 m² ; une gaine la contourne", Math.abs(Math.abs(area) - 3) < 0.01 && detour({ x: 0, y: 0 }, { x: 10, y: 0 }, [P]).length > 0, String(area));

console.log(`\n${ok} vérifications réussies, ${ko} en échec.`);
if (ko) process.exit(1);
