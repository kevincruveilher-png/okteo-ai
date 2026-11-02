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
console.log(`\n${ok} vérifications réussies, ${fails.length} en échec.`);
if (fails.length) process.exit(1);
