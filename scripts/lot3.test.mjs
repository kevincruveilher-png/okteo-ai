// Lot 3 de la reprise des paramètres du BE (06/11/2026) : options des appareils et obstacles (sans navigateur).
import { computeWiring } from "../src/cablage/gaines.js";
import { computeCircuits } from "../src/cablage/circuits.js";
import { CAB_DEFAULTS as S } from "../src/cablage/settings.js";
import { isZone, zonePoly, detour } from "../src/cablage/exclusion.js";
import { APPAREILS } from "../src/cablage/appareils.js";
import { AI_TYPES } from "../src/walls/ai-plan.js";
import { GROUPES_POSE, groupePositions, ECART_GROUPE } from "../src/cablage/groupes.js";
import { assocOK } from "../src/cablage/association.js";

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

console.log("Groupes du BE en un clic (lot 5, décisions n° 25 et 48)");
check("17 groupes (prises, RJ45, TV, commandes), types connus, plaque double / triple / quadruple", GROUPES_POSE.length === 17 && GROUPES_POSE.every((g) => g.types.every((t) => ["PC16", "RJ45", "TV", "INT", "VV", "BP"].includes(t)) && /double|triple|quadruple/.test(g.plaque)));
const pos = groupePositions(GROUPES_POSE.find((g) => g.id === "SA+VV"), { x: 1, y: 2 }, 0, 1);
check("positions le long du mur, à 8 cm (même plaque, sous les 30 cm du même endroit)", pos[1].x === 1 && Math.abs(pos[1].y - 2 - ECART_GROUPE) < 1e-9 && ECART_GROUPE < 0.3);
const g2 = one([{ id: "p", t: "PC16", x: 0, y: 0, lv: "rdc", rep: "P1" }, { id: "r", t: "RJ45", x: 0.08, y: 0, lv: "rdc", rep: "R1" }, { id: "q", t: "PC16", x: 0.16, y: 0, lv: "rdc", rep: "P2" }], []);
check("PC + RJ + PC : les 2 prises dans une gaine, la RJ45 garde sa ligne (association du BE)", assocOK("PC16", "PC16") && !assocOK("PC16", "RJ45") && g2.boxes[0].gaines.some((g) => (g.appIds || []).length === 2));

console.log(`\n${ok} vérifications réussies, ${ko} en échec.`);
if (ko) process.exit(1);
