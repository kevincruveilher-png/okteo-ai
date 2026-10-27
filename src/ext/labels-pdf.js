// Étiquettes de boîte (v50) : imprimées sur A4 paysage, coupées en 4 (148,5 × 105 mm), collées sur la boîte.
// Lisibles de loin : schéma en grand (faces et pièces aux bords), nom de la boîte, flèche du tableau, en-tête (pavillonneur,
// chantier, n° d'affaire, Nom BE, initiales du câbleur), couvercle ; en bas : logo KiTéOHM, QR code (bande sur le
// téléphone) et code barre. Le détail (ordre de câblage, matériel, raccordements) est dans le dossier PDF du chantier.
import { schemaSVG } from "../cablage/schema.js";
import { wireSolid } from "./cablage-data.js";
import { code128, bars, qrMatrix } from "./barcode.js";
import { sheetUrl } from "../cablage/bande-code.js";
import { logoData, LOGO_RATIO } from "./logo.js";

let lib = null;
async function jspdf() { if (!lib) lib = (await import("jspdf")).jsPDF; return lib; }
const fr = (v, d = 2) => (v == null ? "-" : Number(v).toFixed(d).replace(".", ","));
const win = (s) => String(s ?? "").replace(/[→⟶]/g, "->").replace(/[↔]/g, "<->").replace(/[^\x20-\x7E -ÿ–—…’Œœ]/g, "");

async function svgToJpeg(svg, px = 1400) {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error("schéma illisible")); img.src = url; });
    const c = document.createElement("canvas"); c.width = px; c.height = px;
    const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, px, px); g.drawImage(img, 0, 0, px, px);
    return c.toDataURL("image/jpeg", 0.9);
  } finally { URL.revokeObjectURL(url); }
}

export const LABEL = { w: 148.5, h: 105 };

// une étiquette dans le rectangle (x, y) de 148,5 × 105 mm :
// à gauche le schéma (82 mm) et, dessous, le logo et le code barre ; à droite l'en-tête et le QR code
async function drawLabel(doc, S, x, y, logo) {
  const { box, sides, tabAng, code, cover, ch } = S, W = LABEL.w, H = LABEL.h, m = 4, sq = 83;
  doc.addImage(await svgToJpeg(schemaSVG(box, S.steps, { color: wireSolid, sides, big: true })), "JPEG", x + m - 1, y + m - 1, sq, sq);
  // colonne de droite
  const cx = x + m + sq + 2, cw = W - (cx - x) - m;
  let yy = y + m + 4;
  doc.setTextColor(0); doc.setFont("helvetica", "bold"); doc.setFontSize(26); doc.text(win(box.n), cx, yy + 5);
  const ax = cx + cw - 8, ay = yy + 1.5;
  if (tabAng != null) {
    const c = Math.cos(tabAng), s = Math.sin(tabAng), L = 6, P = (a, b) => [ax + a * c - b * s, ay + a * s + b * c];
    const pts = [P(-L, -1.6), P(1.8, -1.6), P(1.8, -4), P(L + 0.8, 0), P(1.8, 4), P(1.8, 1.6), P(-L, 1.6)];
    doc.setFillColor(31, 42, 54);
    doc.lines(pts.slice(1).map((p, k) => [p[0] - pts[k][0], p[1] - pts[k][1]]), pts[0][0], pts[0][1], [1, 1], "F", true);
  }
  doc.setFontSize(6.5); doc.text("TABLEAU", ax, ay + 9.5, { align: "center" });
  // longueur totale des gaines de la boîte, sous son nom
  if (S.longueur != null) { doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.text(win(`${fr(S.longueur, 2)} m de gaines${S.bouchons ? ` · ${S.bouchons} bouchon${S.bouchons > 1 ? "s" : ""}` : ""}`), cx, yy + 10.2); }
  yy += 14;
  const line = (k, v) => { doc.setFont("helvetica", "normal"); doc.setFontSize(6.3); doc.setTextColor(110); doc.text(win(k), cx, yy); doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(0); doc.text(doc.splitTextToSize(win(v || "-"), cw)[0], cx, yy + 4); yy += 8.8; };
  line("PAVILLONNEUR", ch.client); line("CHANTIER", ch.nom);
  // n° d'affaire et couvercle sur une ligne
  doc.setFont("helvetica", "normal"); doc.setFontSize(6.3); doc.setTextColor(110); doc.text("N° D'AFFAIRE", cx, yy); doc.text("COUVERCLE", cx + cw / 2 + 1, yy);
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(0); doc.text(win(ch.numero || "-"), cx, yy + 4); doc.text(win(`vers le ${cover}`), cx + cw / 2 + 1, yy + 4); yy += 9.5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(6.3); doc.setTextColor(110); doc.text("NOM BE", cx, yy); doc.text(win("CÂBLEUR (initiales)"), cx + cw / 2 + 1, yy); doc.setTextColor(0);
  doc.setDrawColor(150); doc.setLineWidth(0.2); doc.line(cx, yy + 7, cx + cw / 2 - 3, yy + 7);
  doc.setDrawColor(0); doc.setLineWidth(0.4); doc.rect(cx + cw / 2 + 1, yy + 1.5, cw / 2 - 1, 7.5);
  // QR code en bas à droite (bande sur le téléphone)
  const by = y + H - m;
  try {
    const q = await sheetUrl(S);
    if (!q.tooBig) {
      const Q = await qrMatrix(q.url), size = 32, ms = size / Q.n, qx = cx + cw - size, qy = by - size;
      doc.setFillColor(0);
      Q.rows.forEach((row, r) => { let c = 0; while (c < Q.n) { if (!row[c]) { c++; continue; } let e = c; while (e < Q.n && row[e]) e++; doc.rect(qx + c * ms, qy + r * ms, (e - c) * ms + 0.01, ms + 0.01, "F"); c = e; } });
      doc.setFont("helvetica", "normal"); doc.setFontSize(5.5); doc.setTextColor(90); doc.text(win("Bande sur le téléphone"), qx - 1.5, by - 1, { angle: 90 }); doc.setTextColor(0);
    }
  } catch (e) { /* QR impossible */ }
  // règles non confirmées utilisées : « à vérifier » (à gauche du QR code)
  if ((S.verifier || []).length) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(5.6); doc.setTextColor(170, 100, 0);
    doc.text(doc.splitTextToSize(win("A VERIFIER : " + S.verifier.map((r) => r.id).join(", ")), cw - 32 - 4).slice(0, 5), cx, by - 30);
    doc.setTextColor(0);
  }
  // sous le schéma : logo KiTéOHM et code barre côte à côte
  const sy = y + m + sq + 1.5, lw = 36, lh = lw / LOGO_RATIO;
  if (logo) doc.addImage(logo, "JPEG", x + m, sy + (by - sy - lh) / 2, lw, lh);
  try {
    const bits = await code128(code), mw = 0.28, bw = bits.length * mw, bx0 = x + m + sq - bw;
    doc.setFillColor(0); bars(bits).forEach(([bx, w]) => doc.rect(bx0 + bx * mw, sy + 0.5, w * mw, by - sy - 4.5, "F"));
    doc.setFont("courier", "normal"); doc.setFontSize(6.5); doc.text(win(code), bx0 + bw / 2, by - 0.8, { align: "center" });
  } catch (e) { /* code barre impossible */ }
}

// sheets = boxSheets(api) ; 4 étiquettes par A4 paysage, traits de coupe
export async function buildLabelsPdf(sheets) {
  const JsPDF = await jspdf(), logo = await logoData();
  const doc = new JsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  for (let i = 0; i < sheets.length; i++) {
    if (i && i % 4 === 0) doc.addPage();
    const k = i % 4, x = (k % 2) * LABEL.w, y = Math.floor(k / 2) * LABEL.h;
    if (k === 0) {
      doc.setDrawColor(170); doc.setLineWidth(0.15); doc.setLineDashPattern([2, 2], 0);
      doc.line(LABEL.w, 0, LABEL.w, 2 * LABEL.h); doc.line(0, LABEL.h, 2 * LABEL.w, LABEL.h); doc.setLineDashPattern([], 0);
    }
    await drawLabel(doc, sheets[i], x, y, logo);
  }
  return { blob: doc.output("blob"), pages: doc.getNumberOfPages(), labels: sheets.length };
}
