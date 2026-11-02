// Planche de contrôle de la charte FTZ (v74) : chaque symbole des légendes FTZ, redessiné depuis
// `src/print/ftz-charte.json`, à taille réelle × 4, avec son nom ; option --orig DIR : à côté, l'extrait du PDF d'origine
// (DIR/<page>-<n>.png, fait hors dépôt) ; option --okteo FILE.json : {nom: "chemin.png"} = symbole actuel d'Oktéo.
//   node scripts/charte/planche.mjs [charte.json] [sortie.svg] [--orig DIR] [--okteo map.json]
import fs from "node:fs";
import path from "node:path";
import { symbolSVG, cartoucheSVG } from "../../src/print/ftz-draw.js";

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : null; };
const origDir = opt("--orig"), okMap = opt("--okteo");
const [input = "src/print/ftz-charte.json", output = "planche-charte.svg"] = args;
const C = JSON.parse(fs.readFileSync(input, "utf8"));
const ok = okMap ? JSON.parse(fs.readFileSync(okMap, "utf8")) : {};
const K = 4, ROW = 46, COL = origDir ? 70 : 0, X0 = 8;
const rows = C.pages.flatMap((p) => p.legende.map((s, i) => ({ p: p.n, i, s })));
const W = 330, H = 30 + rows.length * ROW;
let g = `<rect width="${W}" height="${H}" fill="#fff"/>`;
g += `<text x="${X0}" y="12" font-family="Arial" font-size="7" font-weight="700">Charte FTZ — symboles relevés (× ${K})</text>`;
const heads = [origDir ? ["PDF FTZ d'origine", X0] : null, ["Oktéo : relevé de la charte", X0 + COL], ok && Object.keys(ok).length ? ["Oktéo aujourd'hui", X0 + COL + 70] : null].filter(Boolean);
for (const [t, x] of heads) g += `<text x="${x}" y="24" font-family="Arial" font-size="4.5" fill="#555">${t}</text>`;
rows.forEach(({ p, i, s }, r) => {
  const y = 30 + r * ROW, cy = y + ROW / 2;
  g += `<line x1="0" x2="${W}" y1="${y}" y2="${y}" stroke="#ddd" stroke-width="0.3"/>`;
  if (origDir) { const f = path.resolve(origDir, `${p}-${i}.png`); if (fs.existsSync(f)) g += `<image href="file://${f}" x="${X0}" y="${y + 2}" width="62" height="${ROW - 4}" preserveAspectRatio="xMidYMid meet"/>`; }
  g += symbolSVG(s, X0 + COL + 31, cy, K);
  if (ok[s.name]) g += `<image href="file://${path.resolve(ok[s.name])}" x="${X0 + COL + 70}" y="${y + 2}" width="62" height="${ROW - 4}" preserveAspectRatio="xMidYMid meet"/>`;
  g += `<text x="${X0 + COL + (Object.keys(ok).length ? 140 : 70)}" y="${cy + 1.5}" font-family="Arial" font-size="4.5">${s.name.replace(/&/g, "&amp;")}</text>`;
  g += `<text x="${W - 4}" y="${cy + 1.5}" font-family="Arial" font-size="3.5" fill="#888" text-anchor="end">p.${p} · ${s.w}×${s.h} mm</text>`;
});
fs.writeFileSync(output, `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">${g}</svg>`);
// cartouche seul (page 1), valeurs d'exemple
const c = C.pages[0].cartouche;
if (c) {
  const ch = C.pages[0].h - c.top + 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${C.pages[0].w}mm" height="${ch}mm" viewBox="0 ${c.top - 1} ${C.pages[0].w} ${ch}"><rect x="0" y="${c.top - 1}" width="${C.pages[0].w}" height="${ch}" fill="#fff"/>${cartoucheSVG(c, { client: "CONSTRUCTEUR EXEMPLE", chantier: "CHANTIER", affaire: "AF00000000", date: "02/11/2026", echelle: "1 / 50", dessinateur: "BE" })}</svg>`;
  fs.writeFileSync(output.replace(/\.svg$/, "-cartouche.svg"), svg);
}
console.log(`${rows.length} symboles → ${output}`);
