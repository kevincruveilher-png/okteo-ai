// 3D-1 / 3D-2 : géométrie de la vue 3D (src/3d/plan3d.js), sans navigateur.
// Vrais plans : MAILLARD (dessin du BE), relevés IA de MAILLARD et PASQUIER, EVRARD (murs relevés dans le PDF, si
// pdf.js est installé). Cas d'école : jonctions oubliées, murs en double, croisements, ouvertures contre un angle.
import fs from "node:fs";
import { cleanPlan, wallPrisms, prismIssues, openingParts, devicesOf, wallEnds, H3D, heightsFrom, gainePath, nearestWall } from "../src/3d/plan3d.js";
import { computeWiring } from "../src/cablage/gaines.js";
import { computeCircuits } from "../src/cablage/circuits.js";
import { CAB_DEFAULTS } from "../src/cablage/settings.js";
import { parseAiJson, aiToPlan } from "../src/walls/ai-plan.js";
import { poseIssues } from "../src/3d/pose.js";

let ok = 0; const fails = [];
const check = (name, cond, info = "") => { if (cond) { ok++; console.log("  ✓ " + name); } else { fails.push(name + (info ? " : " + info : "")); console.log("  ✗ " + name + (info ? " : " + info : "")); } };
// relevé {nodes [{x,y}], walls [{a,b,ep}], openings [{seg (indice), t, w, kind}]} → données du dessin
const fromReleve = (P) => ({
  nodes: P.nodes.map((n, i) => ({ id: "n" + i, x: n.x, y: n.y })),
  segs: P.walls.map((w, i) => ({ id: "s" + i, a: "n" + w.a, b: "n" + w.b, ep: w.ep })),
  openings: (P.openings || []).map((o, i) => ({ id: "o" + i, seg: "s" + o.seg, t: o.t, w: o.w, kind: o.kind, hinge: o.hinge, swing: o.swing })),
});
const solid = (name, data) => {
  const P = cleanPlan(data), pr = wallPrisms(P), bad = prismIssues(pr), placed = [...P.openings.values()].reduce((s, l) => s + l.length, 0);
  check(`${name} : ${P.walls.length} morceaux de murs, ${pr.length} volumes, aucun volume faux (trou, pointe, quadrilatère retourné)`, pr.length > 0 && bad.length === 0, bad.slice(0, 3).map((b) => b.why + " " + b.p.key).join(", "));
  // chaque bout de mur a ses deux coins (jonction calculée partout)
  const E = wallEnds(P), missing = P.walls.filter((w) => !E.get(w.key).a || !E.get(w.key).b);
  check(`${name} : coins de jonction calculés aux deux bouts de chaque mur`, missing.length === 0, missing.map((w) => w.key).join(","));
  // la coupe « maison de poupée » donne des volumes plus bas, toujours valables
  const low = wallPrisms(P, { cut: 1.0 });
  check(`${name} : coupe à 1 m : volumes valables, aucun au-dessus de 1 m`, prismIssues(low).length === 0 && low.every((p) => p.y1 <= 1.0 + 1e-9));
  return { P, pr, placed };
};

console.log("Vue 3D : cas d'école");
{
  // maison 10 × 8, cloison arrêtée à 4 cm du mur du haut, cloison en double, deux cloisons qui se croisent sans sommet,
  // un muret libre à 20 cm d'un mur, une porte contre l'angle, une fenêtre plus large que son mur
  const N = { A: [0, 0], B: [10, 0], C: [10, 8], D: [0, 8], E: [5, 0.14], F: [5, 8], G: [2, 4], H: [8, 4], I: [6.5, 2], J: [6.5, 6], K: [1, 6], L: [1, 7.7], M: [9, 7.9], O: [9.6, 7.9] };
  const nodes = Object.entries(N).map(([id, [x, y]]) => ({ id, x, y }));
  const S = [["AB", "A", "B", 0.3], ["BC", "B", "C", 0.3], ["CD", "C", "D", 0.3], ["DA", "D", "A", 0.3], ["EF", "E", "F", 0.1], ["EF2", "F", "E", 0.07], ["GH", "G", "H", 0.1], ["IJ", "I", "J", 0.1], ["KL", "K", "L", 0.1], ["MO", "M", "O", 0.1]];
  const segs = S.map(([id, a, b, ep]) => ({ id, a, b, ep }));
  const openings = [{ id: "p1", seg: "AB", t: 0.5, w: 0.9, kind: "porte", hinge: "g", swing: "int" }, { id: "f1", seg: "MO", t: 0.3, w: 1.2, kind: "fenetre" }, { id: "f2", seg: "BC", t: 4, w: 1.2, kind: "fenetre" }];
  const data = { nodes, segs, openings };
  const P = cleanPlan(data), kinds = P.defects.map((d) => d.kind);
  check("cloison arrêtée à 4 cm du mur : recollée en T (le mur du haut est coupé à la jonction)", kinds.includes("recolle") && P.walls.filter((w) => w.id === "AB").length === 2, JSON.stringify(P.stats));
  check("cloison dessinée deux fois : une seule gardée, signalée", kinds.includes("double") && P.walls.filter((w) => w.id === "EF" || w.id === "EF2").length >= 1 && P.stats.doubles === 1);
  check("cloisons qui se croisent sans sommet : coupées aux 2 croisements, signalé", kinds.includes("croisement") && P.walls.filter((w) => w.id === "GH").length === 3 && P.walls.filter((w) => w.id === "IJ").length === 2 && P.stats.croisements === 2);
  check("muret arrêté à environ 20 cm d'un mur : signalé (jonction oubliée ?), pas recollé", P.defects.some((d) => d.kind === "libre" && Math.abs(d.y - 7.7) < 1e-6));
  check("fenêtre plus large que son mur : signalée, pas posée", P.defects.some((d) => d.kind === "ouverture" && d.ids.includes("f1")) && ![...P.openings.values()].flat().some((o) => o.id === "f1"));
  check("chaque défaut a une position sur le plan et les murs concernés", P.defects.every((d) => Number.isFinite(d.x) && Number.isFinite(d.y) && d.ids.length > 0));
  const pr = wallPrisms(P);
  check("porte contre l'angle et fenêtre : volumes valables (allège sous la fenêtre, linteaux au-dessus)", prismIssues(pr).length === 0 && pr.some((p) => p.key.startsWith("BC") && p.y1 === H3D.allege) && pr.some((p) => p.key.startsWith("BC") && p.y0 === H3D.linteau));
  const parts = openingParts(P);
  check("porte : battant ouvert du côté du dessin, fenêtre : vitrage entre allège et linteau", parts.some((p) => p.kind === "porte" && p.leafDir && Math.abs(Math.hypot(...p.leafDir) - 1) < 1e-9) && parts.some((p) => p.kind === "fenetre" && p.y0 === H3D.allege && p.y1 === H3D.linteau));
  check("le dessin n'est jamais modifié par le nettoyage", segs.find((s) => s.id === "AB").a === "A" && nodes.find((n) => n.id === "E").y === 0.14);
}

console.log("Vue 3D : hauteurs (3D-3)");
{
  const H = heightsFrom({ h3dPlafond: 270, h3dAllege: 100, h3dLinteau: 220, h3dPorte: 210, h3dBaie: 225, h3dGarage: 240 });
  check("hauteurs de départ de Paramètres (cm) → mètres, boîtes 35 cm au-dessus du plafond ; réglage vide = valeur d'origine", H.plafond === 2.7 && H.allege === 1 && H.linteau === 2.2 && H.porte === 2.1 && H.baie === 2.25 && H.garage === 2.4 && Math.abs(H.combles - 3.05) < 1e-9 && heightsFrom({ h3dPlafond: 0 }).plafond === H3D.plafond);
  const data = { nodes: [{ id: "A", x: 0, y: 0 }, { id: "B", x: 6, y: 0 }, { id: "C", x: 6, y: 4 }], segs: [{ id: "AB", a: "A", b: "B", ep: 0.25, top: 2.8 }, { id: "BC", a: "B", b: "C", ep: 0.25 }],
    openings: [{ id: "f1", seg: "AB", t: 2, w: 1.2, kind: "fenetre", allege: 1.2, linteau: 2.3 }, { id: "f2", seg: "AB", t: 4.5, w: 1, kind: "fenetre" }, { id: "p1", seg: "BC", t: 2, w: 0.9, kind: "porte" }] };
  const P = cleanPlan(data, undefined, H), pr = wallPrisms(P, { H });
  const ab = pr.filter((p) => p.wall === "AB"), bc = pr.filter((p) => p.wall === "BC");
  check("fenêtre réglée une par une (allège 1,20 m, linteau 2,30 m) ; l'autre prend les valeurs de départ (1,00 / 2,20)", ab.some((p) => Math.abs(p.y1 - 1.2) < 1e-9) && ab.some((p) => Math.abs(p.y0 - 2.3) < 1e-9) && ab.some((p) => Math.abs(p.y1 - 1) < 1e-9) && ab.some((p) => Math.abs(p.y0 - 2.2) < 1e-9));
  check("mur d'une pièce à 2,80 m sous plafond : monte à 2,80 ; l'autre mur reste à la hauteur de départ (2,70)", Math.max(...ab.map((p) => p.y1)) === 2.8 && Math.max(...bc.map((p) => p.y1)) === 2.7 && bc.some((p) => Math.abs(p.y0 - 2.1) < 1e-9));
  const d = devicesOf([{ id: "l1", t: "LUM", x: 3, y: 2, h: null, hsp: 2.8 }, { id: "l2", t: "LUM", x: 3, y: 3, h: null }], data, H);
  check("lumière au plafond de sa pièce (2,80 − 8 cm), sinon au plafond de départ", Math.abs(d[0].h - 2.72) < 1e-9 && Math.abs(d[1].h - 2.62) < 1e-9);
}

console.log("Vue 3D : gaines (3D-5)");
{
  const H = heightsFrom({});
  const box = { x: 2, y: 2 }, end = { x: 6.1, y: 5, h: 0.3, axis: [6, 5], mount: "mur" };
  const p = gainePath({ box, route: [{ x: 4, y: 2 }], end, H });
  const top = H.combles - 0.1;
  check("par le plafond : boîte → point de passage → au-dessus de l'appareil en traits droits (diagonale), puis descente verticale dans le mur", p.pts.length === 6 && p.pts[1][1] === top && p.pts[2][0] === 4 && p.pts[3][0] === 6 && p.pts[3][1] === top && p.pts[4][0] === 6 && p.pts[4][1] === 0.3 && p.pts[5][0] === 6.1, JSON.stringify(p.pts));
  const L = (H.combles - top) + 2 + Math.hypot(2, 3) + (top - 0.3) + 0.1;
  check("longueur du tracé 3D = somme des traits", Math.abs(p.L - L) < 1e-9, `${p.L} / ${L}`);
  const s = gainePath({ box, route: [{ x: 4, y: 2 }], end, H, sol: true, wall: { x: 2, y: 0 } });
  check("par le sol : descente dans le mur près de la boîte, dans la dalle (mêmes points de passage), remontée dans le mur de l'appareil", s.pts.some((q) => q[0] === 2 && q[2] === 0 && q[1] < 0.05) && s.pts.some((q) => q[0] === 4 && q[1] < 0.05) && s.pts.some((q) => q[0] === 6 && q[1] < 0.05) && s.pts[s.pts.length - 2][1] === 0.3, JSON.stringify(s.pts));
  const lum = gainePath({ box, end: { x: 3, y: 4, h: 2.42, mount: "plafond" }, H });
  check("point lumineux : la gaine s'arrête au plafond", lum.pts[lum.pts.length - 1][1] > 2.42 && lum.pts[lum.pts.length - 1][1] < H.plafond + 0.01);
  const plan = cleanPlan({ nodes: [{ id: "A", x: 0, y: 0 }, { id: "B", x: 8, y: 0 }], segs: [{ id: "AB", a: "A", b: "B", ep: 0.2 }], openings: [{ id: "p", seg: "AB", t: 2, w: 0.9, kind: "porte" }] });
  const nw = nearestWall(plan, 2, 1);
  check("descente par le sol : jamais dans une porte (mur le plus proche hors passage)", nw && Math.abs(nw.y) < 1e-9 && Math.abs(nw.x - 2) > 0.5, JSON.stringify(nw));
  // longueur de la bande : propriété « par le sol » = descente au sol + remontée (au lieu de la descente du plafond)
  const S = { ...CAB_DEFAULTS };
  const items = [{ id: "t", t: "TAB", x: 0, y: 0, h: null, lv: "rdc" }, { id: "p1", t: "PC16", x: 6, y: 5, h: 30, lv: "rdc", rep: "P1" }, { id: "p2", t: "PC16", x: 7, y: 5, h: 30, lv: "rdc", rep: "P2" }];
  const circuits = computeCircuits(items, [], S);
  const boxes = (sol) => [{ id: "b1", n: "LI01", lv: "rdc", x: 4, y: 4, apps: ["p1", "p2"], ...(sol ? { sol: { p1: true } } : {}) }];
  const g = (sol) => computeWiring({ items, links: [], circuits, boxes: boxes(sol), levels: ["rdc"], S }).boxes[0].gaines.find((x) => (x.appIds || []).includes("p1"));
  const a = g(false), b = g(true);
  check("bande : gaine par le sol plus longue de deux fois la hauteur de l'appareil (descente au sol + remontée), marquée « sol »", a && b && !a.sol && b.sol && Math.abs(b.length - a.length - 0.6) < 0.11, JSON.stringify([a && a.length, b && b.length]));
}

console.log("Vue 3D : MAILLARD (dessin du BE)");
{
  const d = JSON.parse(fs.readFileSync(new URL("../docs/chantiers/MAILLARD_kevin.okteo", import.meta.url), "utf8")), s = JSON.parse(d.dessin.s);
  const data = { nodes: s.nodes, segs: s.segs.map((x) => ({ ...x, ep: x.ep > 0 ? x.ep : s.wallEp })), openings: s.openings };
  const { P, placed } = solid("MAILLARD", data);
  check(`MAILLARD : les ${s.openings.length} ouvertures sont posées dans leur mur`, placed === s.openings.length, `${placed}`);
  check("MAILLARD : aucun défaut bloquant inventé sur un plan propre", P.defects.filter((x) => x.level === "warn").length <= 2, P.defects.map((x) => x.text).join(" | "));
  const devs = devicesOf(s.app.map((a) => ({ ...a, hDef: null })), data);
  const wall = devs.filter((a) => a.mount === "mur"), ceil = devs.filter((a) => a.mount === "plafond");
  check(`MAILLARD : ${wall.length} appareils muraux plaqués contre la face de leur mur, ${ceil.length} au plafond`, wall.length >= 60 && ceil.length >= 10 && wall.every((a) => a.n && Math.abs(Math.hypot(...a.n) - 1) < 1e-9));
  check("MAILLARD : prise à 0,30 m, interrupteur à 1,10 m, lumière au plafond (hauteur de départ signalée)", devs.find((a) => a.t === "PC16").h === 0.3 && devs.find((a) => a.t === "INT").h === 1.1 && ceil.every((a) => a.defH && a.h < H3D.plafond));
}

console.log("Vue 3D-6 : contrôles de pose");
{
  // mur de 4 m le long de x (y = 0, épaisseur 10 cm), porte de 80 cm centrée à 2 m, charnière à gauche (vers x = 1,6),
  // battant du côté y < 0 (sens « int » = côté opposé à la normale (-uy, ux) = (0, 1)) ; fenêtre de 1 m centrée à 3,4 m sur un 2e mur
  const plan = { nodes: [{ id: "a", x: 0, y: 0 }, { id: "b", x: 4, y: 0 }, { id: "c", x: 4, y: 3 }],
    segs: [{ id: "s1", a: "a", b: "b", ep: 0.1 }, { id: "s2", a: "b", b: "c", ep: 0.2 }],
    openings: [{ id: "o1", seg: "s1", t: 2, w: 0.8, kind: "porte", hinge: "g", swing: "int" }, { id: "o2", seg: "s2", t: 1.5, w: 1, kind: "fenetre" }] };
  const A = [
    { id: "behind", t: "INT", x: 1.3, y: -0.05, h: 110, seg: "s1" },    // côté charnière, face où s'ouvre la porte : caché
    { id: "handle", t: "INT", x: 2.55, y: -0.05, h: 110, seg: "s1" },   // côté poignée : bon
    { id: "other", t: "INT", x: 1.3, y: 0.05, h: 110, seg: "s1" },      // côté charnière mais l'autre face : bon
    { id: "door", t: "INT", x: 2.1, y: -0.05, h: 110, seg: "s1" },      // dans le vide de la porte
    { id: "under", t: "PC16", x: 4.1, y: 1.5, h: 30, seg: "s2" },       // prise sous l'allège : bon
    { id: "glass", t: "CVR", x: 4.1, y: 1.6, h: 110, seg: "s2" },       // commande dans la fenêtre
    { id: "high", t: "INT", x: 0.5, y: 0.05, h: 150, seg: "s1" },       // 1,50 m
    { id: "low", t: "PC16", x: 0.8, y: 0.05, h: 30, seg: "s1" },        // prise à 30 cm
  ];
  const k = (R) => R.map((r) => r.id + ":" + r.kind).sort().join(",");
  const R0 = poseIssues(plan, A, {}), R1 = poseIssues(plan, A, { pmr: true });
  check("battant : commande côté charnière sur la face d'ouverture signalée ; côté poignée et autre face acceptés", R0.some((r) => r.id === "behind" && r.kind === "battant") && !R0.some((r) => ["handle", "other"].includes(r.id)), k(R0));
  check("embrasure : commande dans le vide d'une porte et dans une fenêtre signalées ; prise sous l'allège acceptée", R0.some((r) => r.id === "door" && r.kind === "embrasure") && R0.some((r) => r.id === "glass" && r.kind === "embrasure") && !R0.some((r) => r.id === "under"), k(R0));
  check("hauteur : 1,50 m accepté hors PMR ; en PMR, commande à 1,50 m et prise à 30 cm signalées (R-110)", !R0.some((r) => r.kind === "hauteur") && R1.some((r) => r.id === "high" && r.kind === "hauteur") && R1.some((r) => r.id === "low" && r.kind === "hauteur") && R1.some((r) => r.id === "under" && r.kind === "hauteur"), k(R1));
  // l'allège réglée à 1,20 m dans Propriétés : la commande à 1,10 m n'est plus dans la fenêtre
  const R2 = poseIssues({ ...plan, openings: [plan.openings[0], { ...plan.openings[1], allege: 1.2 }] }, A, {});
  check("embrasure : l'allège de l'ouverture (Propriétés) est prise en compte", !R2.some((r) => r.id === "glass"), k(R2));
  // charnière à droite : c'est l'autre côté qui est caché
  const R3 = poseIssues({ ...plan, openings: [{ ...plan.openings[0], hinge: "d" }, plan.openings[1]] }, A, {});
  check("battant : charnière à droite → la commande côté x > 2,4 m est cachée, celle de gauche ne l'est plus", R3.some((r) => r.id === "handle" && r.kind === "battant") && !R3.some((r) => r.id === "behind" && r.kind === "battant"), k(R3));
}

console.log("Vue 3D : relevés IA (MAILLARD, PASQUIER)");
for (const [name, file, sx] of [["MAILLARD (relevé IA)", "../docs/chantiers/MAILLARD_releve_ia_opus.json", 0.018], ["PASQUIER (relevé IA)", "../docs/exemples/PASQUIER_releve_ia.json", 0.0163]]) {
  const raw = parseAiJson(fs.readFileSync(new URL(file, import.meta.url), "utf8"));
  const P = aiToPlan(raw, { x0: 0, y0: 0, sx, sy: sx });
  solid(name, fromReleve(P));
}

console.log("Vue 3D : EVRARD (murs relevés dans le PDF)");
try {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { extractSegments } = await import("../src/walls/extract.js"), { detectWalls } = await import("../src/walls/detect.js");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(new URL("../docs/plans/EVRARD_04949_plan.pdf", import.meta.url))), verbosity: 0 }).promise;
  const ex = await extractSegments(await doc.getPage(3), pdfjs.OPS);
  const res = detectWalls(ex.segs, { k: 13 / 550, ox: 0, oy: 0 }, { shapes: ex.shapes });
  const { placed } = solid("EVRARD", fromReleve(res));
  check(`EVRARD : ouvertures posées (${placed} sur ${res.openings.length})`, placed >= res.openings.length - 1);
} catch (e) {
  if (/Cannot find|ERR_MODULE_NOT_FOUND/.test(String(e && (e.code || e.message)))) console.log("  (pdf.js absent : EVRARD vérifié seulement avec npm install)");
  else check("EVRARD : relevé et vue 3D", false, e.message);
}

console.log(`\n${ok} vérifications réussies, ${fails.length} échec(s)`);
if (fails.length) { console.log(fails.map((f) => "  - " + f).join("\n")); process.exit(1); }
