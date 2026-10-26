// Test du relevé automatique des murs sur le vrai PDF EVRARD (page 3), sans navigateur.
// Vérifie que chaque mur relevé correspond exactement aux murs grisés du PDF (axe et épaisseur),
// que les murs sont reliés entre eux et que les ouvertures sont trouvées.
import fs from "node:fs";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractSegments } from "../src/walls/extract.js";
import { detectWalls } from "../src/walls/detect.js";
import { findRooms, nameRooms, findLimits, addLimit } from "../src/walls/rooms.js";
import { pageLabels } from "../src/walls/labels.js";
import { detectDevices, pageTexts } from "../src/walls/devices.js";
import { solveDigits, readDigits } from "../src/walls/digits.js";
import { parseAiJson, aiToPlan } from "../src/walls/ai-plan.js";

const data = new Uint8Array(fs.readFileSync(new URL("../docs/plans/EVRARD_04949_plan.pdf", import.meta.url)));
const doc = await pdfjs.getDocument({ data, verbosity: 0 }).promise;
const page = await doc.getPage(3);
const ex = await extractSegments(page, pdfjs.OPS);

// Échelle : sur ce plan, la cote « 13.00 » ≈ 550 points ; peu importe sa valeur exacte, on vérifie en unités de page.
const k = 13 / 550;
const res = detectWalls(ex.segs, { k, ox: 0, oy: 0 });

let ok = 0; const fails = [];
const check = (name, cond, info = "") => { if (cond) { ok++; console.log("  ✓ " + name); } else { fails.push(name + (info ? " : " + info : "")); console.log("  ✗ " + name + (info ? " : " + info : "")); } };

console.log("Relevé des murs (PDF EVRARD, page 3)");
check("méthode : murs grisés du PDF", res.mode === "aplats", res.mode);
check("entre 20 et 35 murs", res.walls.length >= 20 && res.walls.length <= 35, String(res.walls.length));
check("au moins 12 ouvertures", res.openings.length >= 12, String(res.openings.length));

// deux familles d'épaisseur : cloisons et murs extérieurs, dans le rapport du plan (≈ 7 / 19)
const eps = res.walls.map((w) => w.ep).sort((a, b) => a - b);
const thin = eps[0], thick = eps[eps.length - 1];
check("cloisons et murs extérieurs distingués (rapport 2,2 à 3,2)", thick / thin > 2.2 && thick / thin < 3.2, `${(thin * 100).toFixed(1)} / ${(thick * 100).toFixed(1)} cm`);

// exactitude : chaque mur épais horizontal doit coïncider avec un polygone gris (axe à mi-hauteur, même épaisseur)
const grey = new Map();
const lum = (h) => { const v = parseInt(h.slice(1), 16); return (0.299 * (v >> 16) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255)) / 255; };
for (const s of ex.segs.filter((s) => s.fill && s.closed && lum(s.fill) < 0.9)) {      // aplats foncés = murs
  const b = grey.get(s.pid) || { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
  b.x0 = Math.min(b.x0, s.x1, s.x2); b.x1 = Math.max(b.x1, s.x1, s.x2); b.y0 = Math.min(b.y0, s.y1, s.y2); b.y1 = Math.max(b.y1, s.y1, s.y2);
  grey.set(s.pid, b);
}
// morceaux de murs horizontaux du PDF ; les bandes de moins de 4 cm (enduit, doublage le long des murs) ne sont pas des murs
const rects = [...grey.values()].filter((b) => b.x1 - b.x0 > 20 && b.y1 - b.y0 < 12 && (b.y1 - b.y0) * k >= 0.04);
let matched = 0, worst = 0;
for (const b of rects) {
  const cy = (b.y0 + b.y1) / 2 * k, th = (b.y1 - b.y0) * k, mx = (b.x0 + b.x1) / 2 * k;
  const w = res.walls.find((w) => {
    const A = res.nodes[w.a], B = res.nodes[w.b];
    return Math.abs(A.y - B.y) < 1e-3 && Math.abs(A.y - cy) < 0.03 && mx >= Math.min(A.x, B.x) - 0.01 && mx <= Math.max(A.x, B.x) + 0.01;
  });
  if (w) { matched++; worst = Math.max(worst, Math.abs(res.nodes[w.a].y - cy), Math.abs(w.ep - th)); }
  else if (process.env.DEBUG) console.log("    non retrouvé :", JSON.stringify({ x0: b.x0.toFixed(1), x1: b.x1.toFixed(1), y0: b.y0.toFixed(1), y1: b.y1.toFixed(1) }));
}
check("morceaux de murs horizontaux du PDF retrouvés (≥ 90 %)", matched >= rects.length * 0.9, `${matched}/${rects.length}`);
check("axe et épaisseur exacts à 1 cm près", worst <= 0.01, `écart max ${(worst * 100).toFixed(2)} cm`);

// réseau relié : la plupart des sommets sont partagés par plusieurs murs
const deg = new Map(); res.walls.forEach((w) => { deg.set(w.a, (deg.get(w.a) || 0) + 1); deg.set(w.b, (deg.get(w.b) || 0) + 1); });
const linked = [...deg.values()].filter((d) => d >= 2).length;
check("murs reliés entre eux (≥ 14 jonctions)", linked >= 14, String(linked));
// les 4 angles extérieurs du rectangle principal existent (sommets de degré 2 aux coins)
const xs = res.nodes.map((n) => n.x), ys = res.nodes.map((n) => n.y);
const X1 = Math.max(...xs), Y0 = Math.min(...ys);
const corner = res.nodes.findIndex((n) => Math.abs(n.x - X1) < 0.02 && Math.abs(n.y - Y0) < 0.02);
check("angle extérieur haut-droit relié", corner >= 0 && (deg.get(corner) || 0) >= 2);

console.log("Détection des pièces et de leurs noms");
const nodes = res.nodes.map((n, i) => ({ id: "n" + i, ...n })), segs = res.walls.map((w, i) => ({ id: "s" + i, a: "n" + w.a, b: "n" + w.b, ep: w.ep }));
const rooms = findRooms(nodes, segs);
const labels = await pageLabels(page, { k, ox: 0, oy: 0 });
const named = nameRooms(rooms, labels);
const names = named.map((r) => r.name).sort();
check("7 pièces fermées trouvées", rooms.length === 7, String(rooms.length));
check("9 noms lus sur le plan (police codée décodée)", labels.length === 9, labels.map((l) => l.name).join(", "));
check("noms : Bains, Cellier, Chambre 1, Chambre 2, Dressing, Espace de Vie, Garage", JSON.stringify(names) === JSON.stringify(["Bains", "Cellier", "Chambre 1", "Chambre 2", "Dressing", "Espace de Vie", "Garage"]), names.join(", "));
const sej = named.find((r) => r.name === "Espace de Vie");
check("séjour en L : il contient aussi « Dgt » et « WC » (cloisons non grisées sur ce PDF)", sej && sej.labels.includes("Dgt") && sej.labels.includes("WC") && sej.cycle.length > 4);
const ch1 = named.find((r) => r.name === "Chambre 1"), ch2 = named.find((r) => r.name === "Chambre 2");
// surface habitable = entre les faces intérieures : plus petite que la surface aux axes des murs
const axis = Math.abs(ch1.cycle.reduce((s, c, i, A) => { const p = nodes.find((n) => n.id === c.from), q = nodes.find((n) => n.id === A[(i + 1) % A.length].from); return s + p.x * q.y - q.x * p.y; }, 0) / 2);
check("surface habitable mesurée entre les faces des murs", ch1.area < axis && ch1.area > axis * 0.85, `${ch1.area.toFixed(2)} < ${axis.toFixed(2)} m²`);
check("Chambre 1 plus grande que Chambre 2 (comme sur le plan)", ch1.area > ch2.area);

console.log("Pièces ouvertes et portes en travers (v22)");
const res2 = detectWalls(ex.segs, { k, ox: 0, oy: 0 }, { shapes: ex.shapes });
check("porte du WC posée en travers du dégagement : un mur avec porte ajouté", res2.stats.portesEnTravers === 1 && res2.openings.length === res.openings.length + 1, JSON.stringify(res2.stats));
const n2 = res2.nodes.map((n, i) => ({ id: "n" + i, ...n })), s2 = res2.walls.map((w, i) => ({ id: "s" + i, a: "n" + w.a, b: "n" + w.b, ep: w.ep }));
const lims = findLimits(n2, s2, labels);
check("limite proposée entre « Espace de Vie » et « Dgt » (0,6 à 1,2 m)", lims.length === 1 && lims[0].names.includes("Dgt") && lims[0].L > 0.6 && lims[0].L < 1.2, JSON.stringify(lims));
let kk = 0; lims.forEach((l) => addLimit(n2, s2, l.a, l.b, { node: () => "x" + ++kk, seg: () => "y" + ++kk }));
const named2 = nameRooms(findRooms(n2, s2), labels), nm2 = named2.map((r) => r.name).sort();
check("9 pièces : WC et Dgt séparés du séjour, chaque nom dans sa pièce", nm2.join("|") === "Bains|Cellier|Chambre 1|Chambre 2|Dgt|Dressing|Espace de Vie|Garage|WC" && named2.every((r) => r.labels.length === 1), nm2.join(", "));

console.log("Relevé des appareils (symboles du PDF)");
const texts = await pageTexts(page);
const dv = detectDevices(ex, texts, { k, ox: 0, oy: 0 });
const by = dv.stats.byType, prises = (by.PC16 || 0) + (by.PC20 || 0);
check("10 points lumineux et 8 spots", by.LUM === 10 && by.SPOT === 8, JSON.stringify(by));
check("prises : 30 à 36, dont des 20/32 A repérées par leur texte", prises >= 30 && prises <= 36 && by.PC20 >= 2, `${by.PC16} + ${by.PC20}`);
check("4 RJ45, 7 sorties de câble, 18 à 24 interrupteurs", by.RJ45 === 4 && by.SC === 7 && (by.INT || 0) + (by.VV || 0) >= 18 && (by.INT || 0) + (by.VV || 0) <= 24, JSON.stringify(by));
const lit = new Set(dv.links.map((l) => l.l)), lights = dv.devices.map((d, i) => [d, i]).filter(([d]) => d.t === "LUM" || d.t === "SPOT" || d.t === "APP");
check("liaisons : toujours commande → lumière, ≥ 80 % des lumières commandées", dv.links.length >= 20 && dv.links.every((l) => ["INT", "VV"].includes(dv.devices[l.c].t) && ["LUM", "SPOT", "APP"].includes(dv.devices[l.l].t)) && lit.size >= lights.length * 0.8, `${dv.links.length} liaisons, ${lit.size}/${lights.length} lumières`);
// la lumière de Chambre 1 est commandée par un interrupteur situé dans la même pièce (près de sa porte)
const inCh1 = (d) => ch1 && d && (() => { const P = ch1.poly; let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i].y > d.y) !== (P[j].y > d.y) && d.x < (P[j].x - P[i].x) * (d.y - P[i].y) / (P[j].y - P[i].y) + P[i].x) c = !c; return c; })();
const l1 = dv.devices.findIndex((d) => d.t === "LUM" && inCh1(d));
const cmd1 = dv.links.filter((l) => l.l === l1).map((l) => dv.devices[l.c]);
check("Chambre 1 : son point lumineux a son interrupteur, à moins de 50 cm de la pièce", l1 >= 0 && cmd1.length >= 1 && cmd1.every((c) => {
  const P = ch1.poly, x0 = Math.min(...P.map((p) => p.x)) - 0.5, x1 = Math.max(...P.map((p) => p.x)) + 0.5, y0 = Math.min(...P.map((p) => p.y)) - 0.5, y1 = Math.max(...P.map((p) => p.y)) + 0.5;
  return c.x > x0 && c.x < x1 && c.y > y0 && c.y < y1; }), JSON.stringify(cmd1));

const apps = dv.devices.filter((d) => d.t === "APP");
const onWall = (d) => res.walls.some((w) => { const A = res.nodes[w.a], B = res.nodes[w.b], L = Math.hypot(B.x - A.x, B.y - A.y), ux = (B.x - A.x) / L, uy = (B.y - A.y) / L, t = (d.x - A.x) * ux + (d.y - A.y) * uy;
  return t > -0.05 && t < L + 0.05 && Math.abs((d.x - A.x) * -uy + (d.y - A.y) * ux) < w.ep / 2 + 0.08; });
check("5 appliques (demi-cercles) reconnues, toutes contre un mur, chacune commandée", apps.length === 5 && apps.every(onWall) && apps.every((d) => dv.links.some((l) => dv.devices[l.l] === d)), `${apps.length} appliques`);

const dvT = detectDevices(ex, [...texts, { str: "Tableau Elec.", font: "x", size: 5, ang: 0, x: 300, y: 410 }], { k, ox: 0, oy: 0 });
check("tableau électrique repéré quand le texte « Tableau » est lisible", dvT.devices.filter((d) => d.t === "TAB").length === 1 && dv.devices.every((d) => d.t !== "TAB"));

console.log("Lecture des chiffres en police codée (par les cotes du plan)");
const sols = solveDigits(texts, ex.segs, k), f3 = sols.get("g_d0_f3");
check("les 10 chiffres retrouvés, ≥ 30 cotes relues exactement", f3 && f3.map.size === 10 && f3.checked >= 30, f3 ? `${f3.map.size} chiffres, ${f3.checked}/${f3.total}` : "aucune solution");
const cotes = new Set(texts.filter((t) => t.font === "g_d0_f3").map((t) => readDigits(t, sols)));
check("cotes relues : 1.75 et 1.78 (Chambre 1), 2.35 (cuisine), 1.49 (Chambre 2)", ["1.75", "1.78", "2.35", "1.49"].every((v) => cotes.has(v)), [...cotes].filter((c) => /^[\d.]+$/.test(c)).join(" "));
// l'échelle d'essai k = 13/550 a été prise « à l'œil » : les cotes disent qu'elle est trop petite d'environ 5,6 %
check("échelle contrôlée par les cotes (facteur stable sur toute la page)", dv.scaleCheck && Math.abs(dv.scaleCheck.facteur - 1.056) < 0.006, JSON.stringify(dv.scaleCheck));
const hs = dv.devices.filter((d) => d.h);
const near = (x, y) => dv.devices.filter((d) => d.t.startsWith("PC")).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
check("hauteurs lues : ≥ 10 prises, Bains 110 cm, Cellier 120 cm, plaque de cuisson 32 A à 65 cm", hs.length >= 10 && near(492 * k, 198 * k).h === 110 && near(185 * k, 159 * k).h === 120 && near(252 * k, 177 * k).h === 65 && near(252 * k, 177 * k).t === "PC20", hs.map((d) => d.h).join(","));

console.log("Relevé par l'IA : remise au propre de la réponse");
{
  const txt = 'Voilà :\n```json\n{"murs":[{"x1":100,"y1":100,"x2":900,"y2":104,"ep":25},{"x1":900,"y1":104,"x2":902,"y2":700,"ep":25},{"x1":902,"y1":700,"x2":98,"y2":700,"ep":25},{"x1":98,"y1":700,"x2":100,"y2":100,"ep":25},{"x1":500,"y1":103,"x2":503,"y2":700,"ep":7},{"x1":10,"y1":10,"x2":12,"y2":11}],"ouvertures":[{"x":501,"y":400,"l":80,"t":"porte"},{"x":2000,"y":2000,"l":90}],"pieces":[{"nom":"Séjour {1}","x":300,"y":400}],"appareils":[{"t":"int","x":480,"y":420},{"t":"LUM","x":300,"y":400},{"t":"???","x":1,"y":1}],"liaisons":[[1,0],[0,2]],"remarques":"ok"}\n```\nfin';
  const raw = parseAiJson(txt), P = aiToPlan(raw, { x0: 0, y0: 0, sx: 0.01, sy: 0.01 });
  const R = nameRooms(findRooms(P.nodes.map((n, i) => ({ id: "n" + i, ...n })), P.walls.map((w, i) => ({ id: "s" + i, a: "n" + w.a, b: "n" + w.b, ep: w.ep }))), P.pieces);
  const axisOk = P.walls.every((w) => { const A = P.nodes[w.a], B = P.nodes[w.b]; return Math.abs(A.x - B.x) < 1e-9 || Math.abs(A.y - B.y) < 1e-9; });
  check("réponse lue malgré le texte autour ; murs redressés, sommets fusionnés, jonctions en T coupées : 2 pièces fermées",
    P.walls.length === 7 && P.nodes.length === 6 && P.stats.coupes === 2 && axisOk && R.length === 2 && R.some((r) => r.name === "Séjour {1}"), JSON.stringify({ w: P.walls.length, n: P.nodes.length, s: P.stats, rooms: R.map((r) => r.name) }));
  check("ouverture loin des murs ignorée, type inconnu ignoré, liaison remise dans le bon sens (commande → lumière)",
    P.openings.length === 1 && P.openings[0].kind === "porte" && P.stats.ouverturesPerdues === 1 && P.devices.length === 2 && P.links.length === 1 && P.devices[P.links[0].c].t === "INT", JSON.stringify({ o: P.openings, d: P.devices, l: P.links }));
}

console.log(`\n${ok} vérifications réussies, ${fails.length} en échec.`);
if (fails.length) process.exit(1);
