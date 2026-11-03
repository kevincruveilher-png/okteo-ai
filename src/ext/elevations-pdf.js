// 3D-7 : élévations de murs en PDF (jsPDF, licence MIT, déjà utilisé pour le plan) : une élévation par page A4 paysage,
// à l'échelle 1:20, 1:25 ou 1:50 (la plus grande qui tient), cotes depuis l'angle et hauteurs depuis le sol.
// Le dessin vient d'elevationDraw (src/3d/elevation.js), le même qu'à l'écran. Texte en WinAnsi seulement.
import { elevationDraw } from "../3d/elevation.js";

let lib = null;
async function jspdf() { if (!lib) lib = (await import("jspdf")).jsPDF; return lib; }
const win = (s) => String(s ?? "").replace(/[→⟶]/g, "->").replace(/[^\x20-\x7E\xA0-\xFF–—…’Œœ]/g, "");
export const ELEV_SCALES = [20, 25, 50, 100];

// list [{ E (wallElevation), title }], o { chantier, level } → { blob, pages, scales [N…] }
export async function buildElevationsPdf(list, o = {}) {
  const JsPDF = await jspdf();
  const doc = new JsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const PW = 297, PH = 210, M = 12, top = 24, bottom = 16, scales = [];
  list.forEach(({ E, title }, i) => {
    if (i) doc.addPage();
    const D = elevationDraw(E), w = D.x1 - D.x0, h = D.y1 - D.y0;
    const N = ELEV_SCALES.find((n) => (w * 1000) / n <= PW - 2 * M && (h * 1000) / n <= PH - top - bottom) || 100;
    scales.push(N);
    const k = 1000 / N, ox = (PW - w * k) / 2 - D.x0 * k, oy = top + (PH - top - bottom - h * k) / 2 + D.y1 * k;
    const X = (x) => ox + x * k, Y = (y) => oy - y * k;
    // en-tête
    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(20, 30, 50);
    doc.text(win(title || "Élévation"), M, 14);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(90, 100, 115);
    doc.text(win(`${o.chantier || ""}${o.level ? " · " + o.level : ""} · vue depuis ${E.room ? "la pièce" : "l'extérieur"} · échelle 1:${N} · cotes en cm depuis la face du mur d'angle, hauteurs depuis le sol fini`), M, 19.5);
    for (const it of D.items) {
      if (it.k === "rect") {
        const cls = it.cls;
        if (cls === "mur") { doc.setFillColor(244, 241, 234); doc.setDrawColor(60, 64, 72); doc.setLineWidth(0.35); doc.rect(X(it.x), Y(it.y + it.h), it.w * k, it.h * k, "FD"); }
        else if (cls.startsWith("ouv")) { doc.setFillColor(cls.includes("fenetre") ? 214 : 255, cls.includes("fenetre") ? 232 : 255, cls.includes("fenetre") ? 246 : 255); doc.setDrawColor(60, 64, 72); doc.setLineWidth(0.3); doc.rect(X(it.x), Y(it.y + it.h), it.w * k, it.h * k, "FD"); }
        else { doc.setFillColor(211, 51, 51); doc.setDrawColor(150, 20, 20); doc.setLineWidth(0.2); doc.rect(X(it.x), Y(it.y + it.h), Math.max(2.4, it.w * k), Math.max(2.4, it.h * k), "FD"); }
      } else if (it.k === "line") {
        if (it.cls === "sol") { doc.setDrawColor(40, 44, 52); doc.setLineWidth(0.6); }
        else if (it.cls === "rappel") { doc.setDrawColor(150, 155, 165); doc.setLineWidth(0.1); doc.setLineDashPattern([0.8, 0.8], 0); }
        else { doc.setDrawColor(40, 90, 170); doc.setLineWidth(0.18); }
        doc.line(X(it.x1), Y(it.y1), X(it.x2), Y(it.y2));
        doc.setLineDashPattern([], 0);
        if (it.cls === "cote") for (const x of [it.x1, it.x2]) doc.line(X(x) - 0.9, Y(it.y1) + 0.9, X(x) + 0.9, Y(it.y1) - 0.9);
      } else {
        const fs = it.cls === "rep" ? 7.5 : it.cls === "ouvt" ? 7 : 7;
        doc.setFontSize(fs); doc.setFont("helvetica", it.cls === "rep" ? "bold" : "normal");
        doc.setTextColor(...(it.cls === "dcote" || it.cls === "hcote" ? [40, 90, 170] : [30, 34, 42]));
        doc.text(win(it.s), X(it.x), Y(it.y), { align: it.anchor === "middle" ? "center" : "left" });
      }
    }
    doc.setFontSize(7.5); doc.setTextColor(120, 125, 135); doc.setFont("helvetica", "normal");
    doc.text(win("* hauteur de départ (Paramètres -> Vue 3D), à confirmer dans Propriétés. Oktéo AI"), M, PH - 7);
    doc.text(`${i + 1}/${list.length}`, PW - M, PH - 7, { align: "right" });
  });
  const blob = doc.output("blob");
  return { blob, pages: list.length, scales };
}
