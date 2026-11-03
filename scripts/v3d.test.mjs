// 3D-1 / 3D-2 : géométrie de la vue 3D (src/3d/plan3d.js), sans navigateur.
// Vrais plans : MAILLARD (dessin du BE), relevés IA de MAILLARD et PASQUIER, EVRARD (murs relevés dans le PDF, si
// pdf.js est installé). Cas d'école : jonctions oubliées, murs en double, croisements, ouvertures contre un angle.
import fs from "node:fs";
import { cleanPlan, wallPrisms, prismIssues, openingParts, devicesOf, wallEnds, H3D } from "../src/3d/plan3d.js";
import { parseAiJson, aiToPlan } from "../src/walls/ai-plan.js";

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
