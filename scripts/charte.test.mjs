// v74 : charte FTZ relevée (src/print/ftz-charte.json) : contenu attendu, aucune donnée du client, dessin SVG valide.
import fs from "node:fs";
import { symbolSVG, cartoucheSVG, pathSVG } from "../src/print/ftz-draw.js";

let ok = 0; const fails = [];
const check = (name, fn) => { try { const r = fn(); if (r === false) throw new Error("condition fausse"); ok++; console.log("  ✓ " + name); } catch (e) { fails.push(name + " : " + e.message); console.log("  ✗ " + name + " : " + e.message); } };
const raw = fs.readFileSync("src/print/ftz-charte.json", "utf8"), C = JSON.parse(raw);
const P1 = C.pages[0], P2 = C.pages[1], P3 = C.pages[2];

console.log("Charte FTZ relevée (v74)");
check("format A3 paysage FTZ (zone imprimée 410 × 289 mm) pour les plans 1 et 2", () => Math.abs(P1.w - 410) < 1 && Math.abs(P1.h - 289) < 1 && Math.abs(P2.w - 410) < 1);
check("légende du plan pieuvre : 19 symboles nommés, chacun dessiné", () => {
  const names = P1.legende.map((s) => s.name);
  const need = ["Interrupteur simple allumage", "Interrupteur Va-et-Vient", "Point lumineux", "Applique étanche", "Prise de courant H0.30m (PMR H0.40m)", "Prise de courant H1.20m", "Plaque double Horizontale", "Renvoi de tableau", "Liaison équipotentielle"];
  const miss = need.filter((n) => !names.includes(n));
  if (P1.legende.length !== 19 || miss.length || P1.legende.some((s) => !s.paths.length || !(s.w > 1 && s.h > 1))) throw new Error(JSON.stringify({ n: P1.legende.length, miss }));
});
check("légende du plan équipements : 20 symboles (chauffe-eau, clim, convecteur, RJ45, TV, détecteur de fumée…)", () => {
  const names = P2.legende.map((s) => s.name);
  return P2.legende.length === 20 && ["Chauffe-eau électrique thermodynamique", "Climatisation", "Convecteur de chauffage rayonnant", "Prise RJ45 H0.30m (PMR H0.40m)", "Détecteur de fumée", "Prise de terre"].every((n) => names.includes(n));
});
check("tailles FTZ : point lumineux ≈ 6,3 mm, prise ≈ 3,9 mm, interrupteur 2,8 × 6,1 mm", () => {
  const S = (n) => P1.legende.find((s) => s.name === n);
  const L = S("Point lumineux"), PC = S("Prise de courant H0.30m (PMR H0.40m)"), I = S("Interrupteur simple allumage");
  return Math.abs(L.w - 6.3) < 0.3 && Math.abs(PC.w - 3.9) < 0.2 && Math.abs(I.w - 2.82) < 0.2 && Math.abs(I.h - 6.14) < 0.3;
});
check("couleurs FTZ : point lumineux et interrupteur rouges (#FF0000), prise bleue (#0080FF), RJ45 vert (#008000)", () => {
  const col = (s) => new Set(s.paths.map((p) => p.stroke || p.fill).filter(Boolean));
  const S = (pg, n) => pg.legende.find((s) => s.name === n);
  return col(S(P1, "Point lumineux")).has("#FF0000") && col(S(P1, "Interrupteur simple allumage")).has("#FF0000") && col(S(P1, "Prise de courant H0.30m (PMR H0.40m)")).has("#0080FF") && col(S(P2, "Prise RJ45 H0.30m (PMR H0.40m)")).has("#008000");
});
check("textes FTZ : repères Courier gras noir 3 mm, pièces Courier gras bleu 6,5 mm étroit, boîtes Times vert, cotes violettes", () => {
  const T = P1.textes, f = (pred) => T.find(pred);
  const rep = f((t) => t.font === "Courier-Bold" && t.ex.includes("P21")), room = f((t) => t.ex.includes("SEJOUR")), box = f((t) => t.ex.includes("LI01")), cote = f((t) => t.color === "#800080" && t.font === "Courier-Bold");
  if (!(rep && rep.color === "#000000" && Math.abs(rep.sy - 2.97) < 0.1 && room && room.color === "#0000FF" && Math.abs(room.sy - 6.52) < 0.1 && room.ratio < 0.7 && box && box.font === "Times-Roman" && box.color === "#008000" && cote)) throw new Error(JSON.stringify({ rep, room, box, cote }));
});
check("cartouche : libellés KiTéOHM et champs à remplir (client, chantier, n° d'affaire, échelle, dessinateur, date)", () => {
  const c = P1.cartouche, s = c.texts.map((t) => t.str).join("|");
  return ["{client}", "{chantier}", "{affaire}", "{echelle}", "{dessinateur}", "{date}", "Client", "Chantier", "N°", "www.kiteohm.fr"].every((k) => s.includes(k)) && /hauteurs sont données à partir du sol fini/.test(s) && c.paths.length > 50;
});
check("plan plomberie : tableau des hauteurs de sorties d'eau dans le cartouche", () => /SORTIES D'EAU/.test(P3.cartouche.texts.map((t) => t.str).join(" ")));
check("aucune donnée du client dans la charte (noms, n° d'affaire, dates, dessinateur)", () => {
  const bad = ["VILLANOVA", "DEMEURES", "AF25114192", "GS / ACR", "27/07/2026", "23/07/2026", "28/07/2026"].filter((w) => raw.includes(w));
  if (bad.length) throw new Error(bad.join(", "));
});
check("dessin SVG : chaque symbole et le cartouche se dessinent (chemins valides, champs remplis)", () => {
  for (const pg of [P1, P2]) for (const s of pg.legende) { const g = symbolSVG(s, 10, 10, 2); if (!/<path d="M[-\d.]/.test(g) && !/<text/.test(g)) throw new Error(s.name); }
  const svg = cartoucheSVG(P1.cartouche, { client: "CLIENT TEST", affaire: "AF00000000" });
  return svg.includes("CLIENT TEST") && svg.includes("AF00000000") && !svg.includes("{client}") && pathSVG({ op: "S", stroke: "#000", w: 0.1, d: "M0 0L1 1", dash: [] }).includes('stroke="#000"');
});
console.log("Bâti et textes du plan du BE (v74 MAJ 2)");
const { abrevRoom, parseAbrev } = await import("../src/print/abrev.js");
const { boxCotes } = await import("../src/print/ftz-sheet.js");
const { wallLook, wavePoints } = await import("../src/plan-style.js");
check("noms abrégés : Pièce de vie → SEJOUR, Chambre 2 → CH2, Salle de bains → SDB, Dégagement → DEGT, Dressing → DRESS, inconnu en majuscules", () => {
  const got = ["Pièce de vie", "Chambre 2", "Salle de bains", "Dégagement", "Dressing", "Dgt", "Bains", "Cellier", "Local technique", "Chambre parents"].map((n) => abrevRoom(n));
  const want = ["SEJOUR", "CH2", "SDB", "DEGT", "DRESS", "DEGT", "SDB", "CELLIER", "LOCAL TECHNIQUE", "CH PARENTS"];
  if (got.join() !== want.join()) throw new Error(got.join(", "));
  return abrevRoom("Chambre 1", parseAbrev("Chambre = CHB")) === "CHB1" && abrevRoom("Placard", parseAbrev("Pla = X")) === "PLACARD";
});
check("cotes de boîte : distance au mur le plus proche, horizontale et verticale, en cm", () => {
  const R = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
  const walls = [R(0, 0, 10, 0.2), R(0, 7.8, 10, 8), R(0, 0, 0.2, 8), R(9.8, 0, 10, 8), R(4, 0, 4.07, 8)];   // pièce 10 × 8 + cloison en x = 4
  const c = boxCotes([{ id: "b1", n: "LI01", x: 2.6, y: 1.7 }, { id: "b2", n: "LI02", x: 7, y: 6 }], walls);
  const f = (id, ax) => c.find((k) => k.box === id && k.axis === ax);
  if (!(f("b1", "x").cm === 140 && f("b1", "y").cm === 150 && f("b2", "x").cm === 280 && f("b2", "y").cm === 180 && Math.abs(f("b2", "x").a - 9.8) < 1e-9)) throw new Error(JSON.stringify(c));
});
check("dessin des murs : maçonnerie hachurée ou gris plein, cloison pleine, doublage ondulé", () => {
  return wallLook("maconnerie").hatch && wallLook("maconnerie", "gris").fill === "#9A9A9A" && !wallLook("maconnerie", "gris").hatch && wallLook("cloison").fill === "#202020" && wallLook("doublage").wave && wavePoints({ x: 0, y: 0 }, { x: 1, y: 0 }, 0.1).length > 20;
});
console.log("Volumes de la salle de bain (v74 MAJ 3)");
const VOL = await import("../src/cablage/volumes.js");
check("baignoire contre le mur : volume 1 = son emprise, volume 2 = 0,60 m autour, coupé par les murs de la pièce", () => {
  const room = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 2.5 }, { x: 0, y: 2.5 }];
  const bath = { id: "b", t: "BAIG", x: 0.85, y: 0.375 };           // 1,70 × 0,75 dans l'angle haut gauche
  const V = VOL.volumesOf(bath, room), A = (P) => Math.abs(P.reduce((s, p, i) => { const q = P[(i + 1) % P.length]; return s + p.x * q.y - q.x * p.y; }, 0) / 2);
  const bb = (P) => [Math.min(...P.map((p) => p.x)), Math.min(...P.map((p) => p.y)), Math.max(...P.map((p) => p.x)), Math.max(...P.map((p) => p.y))].map((v) => +v.toFixed(2));
  if (!(Math.abs(A(V.v1) - 1.275) < 1e-6 && bb(V.v2).join() === "0,0,2.3,1.35" && A(V.v2) > 2.9 && A(V.v2) < 3.1)) throw new Error(JSON.stringify({ v1: A(V.v1), v2: bb(V.v2), a2: A(V.v2) }));
  const at = (x, y, h) => VOL.volumeAt(x, y, h, V);
  return at(0.5, 0.3, 30) === 0 && at(0.5, 0.3, 110) === 1 && at(2.1, 0.3, 110) === 2 && at(2.5, 0.3, 110) === null && at(0.5, 0.3, 250) === 2 && at(1, 2, 30) === null;
});
check("douche à l'italienne : volume 1 = 1,20 m autour de la pomme, s'arrête aux murs", () => {
  const room = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 3 }, { x: 0, y: 3 }];
  const V = VOL.volumesOf({ id: "d", t: "DITAL", x: 0.1, y: 0.1 }, room);
  return V.v0 === null && V.v1.every((p) => p.x >= -1e-9 && p.y >= -1e-9) && VOL.volumeAt(1.1, 0.1, 100, V) === 1 && VOL.volumeAt(1.6, 0.1, 100, V) === 2 && VOL.volumeAt(1.95, 2.9, 100, V) === null;
});
check("contrôle : prise et interrupteur en volume 1 ou 2 interdits, luminaire en volume 1 = TBTS, hors volume rien", () => {
  const room = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 2.5 }, { x: 0, y: 2.5 }];
  const apps = [{ id: "b", t: "BAIG", x: 0.85, y: 0.375 }, { id: "p1", t: "PC16", x: 1.2, y: 0, h: 110 }, { id: "i1", t: "INT", x: 2.1, y: 0, h: 110 }, { id: "l1", t: "APP", x: 0.85, y: 0, h: 180 }, { id: "p2", t: "PC16", x: 3, y: 2, h: 30 }, { id: "l2", t: "LUM", x: 2.6, y: 2, h: null }];
  const I = VOL.checkVolumes(apps, [room]), by = Object.fromEntries(I.map((x) => [x.id, x]));
  if (!(by.p1 && by.p1.v === 1 && by.p1.bloquant && by.i1 && by.i1.v === 2 && by.i1.bloquant && by.l1 && !by.l1.bloquant && !by.p2 && !by.l2 && I.length === 3)) throw new Error(JSON.stringify(I));
});
console.log("Sanitaires (n° 9)");
check("WC, lavabo, vasque, évier : sanitaires sans volume de salle de bain ni contrôle ; dessin tourné avec la rotation", () => {
  const room = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 2.5 }, { x: 0, y: 2.5 }];
  const S = ["WC", "LAVABO", "VASQUE", "EVIER"].map((t, i) => ({ id: "s" + i, t, x: 0.6 + i * 0.6, y: 0.4 }));
  const noVol = S.every((a) => VOL.isSani(a.t) && !VOL.hasVolumes(a.t) && VOL.volumesOf(a, room) === null);
  const I = VOL.checkVolumes([...S, { id: "p", t: "PC16", x: 0.6, y: 0.1, h: 110 }], [room]);
  const sh = Object.fromEntries(S.map((a) => [a.t, VOL.saniShape(a)]));
  const okShape = S.every((a) => sh[a.t].length >= 2 && sh[a.t][0].k === "out" && sh[a.t].every((p) => p.pts.length >= 2 && p.pts.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y))));
  // contour dans son rectangle (largeur × profondeur)
  const inBox = S.every((a) => { const { w, d } = VOL.SANI[a.t]; return sh[a.t].every((p) => p.pts.every((q) => Math.abs(q.x - a.x) <= w / 2 + 1e-9 && Math.abs(q.y - a.y) <= d / 2 + 1e-9)); });
  // tourné de 90° : la largeur devient verticale
  const r = VOL.saniShape({ t: "EVIER", x: 0, y: 0, srot: 90 })[0].pts, H = Math.max(...r.map((q) => q.y)) - Math.min(...r.map((q) => q.y));
  const dbl = VOL.saniShape({ t: "VASQUE", x: 0, y: 0, sw: 1.4 }).filter((p) => p.k === "in").length === 4 && VOL.saniShape({ t: "VASQUE", x: 0, y: 0 }).filter((p) => p.k === "in").length === 2;
  return noVol && I.length === 0 && okShape && inBox && Math.abs(H - 1.2) < 1e-9 && dbl;
});
check("sanitaires en 3D : volumes au sol (WC = cuvette + réservoir plus haut, lavabo suspendu, évier sur meuble), douche à l'italienne = pomme en hauteur", () => {
  const z = (t, o = {}) => VOL.sani3d({ t, x: 1, y: 1, ...o });
  const wc = z("WC"), lav = z("LAVABO"), ev = z("EVIER"), it = z("DITAL"), b = z("BAIG");
  return wc.length === 2 && Math.max(...wc.map((p) => p.z1)) === 0.8 && lav.some((p) => p.z0 === 0.7 && p.z1 === 0.85) && ev[0].z1 === 0.9 && it.some((p) => p.z0 > 1.9) && b[0].z1 === 0.55 && z("PC16").length === 0
    && [wc, lav, ev, b].every((L) => L.every((p) => p.pts.length >= 3 && p.z1 > p.z0));
});
console.log("Plan pieuvre et équipements du BE (v74 MAJ 4)");
const FS = await import("../src/print/ftz-symbols.js");
const SH = await import("../src/print/ftz-sheet.js");
check("couleurs des boîtes verrouillées : LI01 rouge, LI02 vert, LI03 magenta, LI04 bleu, LI05 noir, LI06 orange, LI07 violet, LI08 rouge", () =>
  ["LI01", "LI02", "LI03", "LI04", "LI05", "LI06", "LI07", "LI08", "LI14"].map(FS.boxColor).join() === "#FF0000,#008000,#FF00FF,#0000FF,#000000,#FF8000,#800080,#FF0000,#800080");
check("symboles FTZ : prise, prise haute, point lumineux, interrupteur, RJ45, tableau trouvés dans la charte ; tracé tourné", () => {
  const I = FS.symIndex(C), n = (t, h) => FS.ftzSymbol(I, t, h)?.name;
  const ok = n("PC16", 30) === "Prise de courant H0.30m (PMR H0.40m)" && n("PC16", 120) === "Prise de courant H1.20m" && n("LUM") === "Point lumineux" && n("INT") === "Interrupteur simple allumage" && n("RJ45") === "Prise RJ45 H0.30m (PMR H0.40m)" && n("TAB") === "Tableau d'alimentation générale basse tension" && FS.ftzSymbol(I, "XYZ") === null;
  return ok && SH.rotD("M-2 1L3 0", 90) === "M-1.0000 -2.0000L0.0000 3.0000";
});
check("plaques multipostes : 2 appareils côte à côte = double horizontale, 3 superposés = triple verticale, isolé = rien", () => {
  const w = { ux: 1, uy: 0 }, P = FS.plaques([
    { id: "a", t: "INT", x: 1, y: 0, h: 110, wall: w }, { id: "b", t: "PC16", x: 1.08, y: 0, h: 110, wall: w },
    { id: "c", t: "PC16", x: 4, y: 0, h: 30, wall: w }, { id: "d", t: "RJ45", x: 4.02, y: 0, h: 60, wall: w }, { id: "e", t: "PC16", x: 4.04, y: 0, h: 110, wall: w },
    { id: "f", t: "PC16", x: 8, y: 0, h: 30, wall: w }, { id: "g", t: "LUM", x: 1.05, y: 0, h: null, wall: null }]);
  const s2 = P.map((p) => `${p.name}:${p.ids.join("")}`).sort().join("|");
  if (s2 !== "Plaque double Horizontale:ab|Plaque triple Verticale:cde") throw new Error(s2);
  const I = FS.symIndex(C); return P.every((p) => I.has(p.name));
});
console.log(`\n${ok} vérifications réussies, ${fails.length} en échec.`);
if (fails.length) process.exit(1);
