// Test du relevé automatique des murs sur le vrai PDF EVRARD (page 3), sans navigateur.
// Vérifie que chaque mur relevé correspond exactement aux murs grisés du PDF (axe et épaisseur),
// que les murs sont reliés entre eux et que les ouvertures sont trouvées.
import fs from "node:fs";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractSegments } from "../src/walls/extract.js";
import { detectWalls } from "../src/walls/detect.js";
import { findRooms, nameRooms } from "../src/walls/rooms.js";
import { pageLabels } from "../src/walls/labels.js";

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

console.log(`\n${ok} vérifications réussies, ${fails.length} en échec.`);
if (fails.length) process.exit(1);
