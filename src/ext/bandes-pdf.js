// Impression des schémas de boîte (v33) : une feuille A4 par boîte (schéma + orientation + matériel), puis la liste
// des raccordements à cocher (suite sur d'autres feuilles si besoin). jsPDF, unités mm ; texte en WinAnsi seulement
// (pas de flèches ni d'émojis).
import { schemaSVG, FN_SHORT, wireName } from "../cablage/schema.js";
import { wireSolid } from "./cablage-data.js";

let lib = null;
async function jspdf() { if (!lib) lib = (await import("jspdf")).jsPDF; return lib; }

async function svgToPng(svg, px = 1500) {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error("schéma illisible")); img.src = url; });
    const c = document.createElement("canvas"); c.width = px; c.height = px;
    const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, px, px); g.drawImage(img, 0, 0, px, px);
    return c.toDataURL("image/jpeg", 0.92);   // JPEG : PDF léger (un PNG serait stocké presque brut)
  } finally { URL.revokeObjectURL(url); }
}
const rgb = (hex) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); const v = m ? parseInt(m[1], 16) : 0x999999; return [v >> 16, (v >> 8) & 255, v & 255]; };
const fr = (v, d = 2) => (v == null ? "-" : Number(v).toFixed(d).replace(".", ","));
// texte sûr pour la police standard du PDF
const win = (s) => String(s ?? "").replace(/[→⟶]/g, "->").replace(/[↔]/g, "<->").replace(/[^\x20-\x7E -ÿ–—…’Œœ]/g, "");

// pages = [{ box, steps, material, checks, sides, level }]
export async function buildBandsPdf(pages, { chantier = "", numero = "" } = {}) {
  const JsPDF = await jspdf();
  const doc = new JsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const W = 210, M = 12;
  let first = true;
  for (const P of pages) {
    const { box, steps, material, checks, sides, level, fils } = P;
    if (!first) doc.addPage(); first = false;
    // en-tête
    doc.setFont("helvetica", "bold"); doc.setFontSize(15);
    doc.text(win(`Boîte ${box.n}`), M, 16);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
    doc.text(win(`${chantier}${numero ? " · " + numero : ""} · ${level || ""}${sides.under ? " · au-dessus de : " + sides.under : ""} · ${box.gaines.length} gaines · ${steps.length} raccordements`), M, 22);
    // schéma
    const png = await svgToPng(schemaSVG(box, steps, { color: wireSolid, sides }));
    doc.addImage(png, "JPEG", M + 6, 26, 174, 174);
    // orientation + matériel
    let y = 206;
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.text("Orienter la boîte", M, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
    ["A", "B", "C", "D"].forEach((f, i) => doc.text(win(`Face ${f} (${["haut", "droite", "bas", "gauche"][i]} du plan) : ${sides[f] || "-"}`), M + 2, y + 5.5 + i * 5));
    y += 28;
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.text("Matériel", M, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
    const mat = material.sizes.map(([k, n]) => `${n} connecteur${n > 1 ? "s" : ""} ${k} entrées`).join(" · ") + (material.ponts ? ` · ${material.ponts} pont${material.ponts > 1 ? "s" : ""} (bout de fil de la même couleur)` : "");
    const matT = doc.splitTextToSize(win(mat || "-"), W - 2 * M - 4);
    doc.text(matT, M + 2, y + 5.5);
    y += (matT.length - 1) * 4.4;
    const bg = [...new Set(box.gaines.filter((g) => g.kind === "alim").flatMap((g) => g.wires.map((w) => w.bague)).filter(Boolean))];
    if (bg.length) { doc.text(win("Bagues sur l'alimentation : " + bg.join(" · ")), M + 2, y + 11); y += 5; }
    const fl = fils ? "Fils : " + fils.wires.map((w) => `${w.n} x ${fr(w.section, 1)} ${w.color}`).join(" · ") + (fils.cables.length ? " · câbles : " + fils.cables.map((c) => `${c.n} x ${c.cable}`).join(", ") : "") : "";
    const flT = doc.splitTextToSize(win(fl), W - 2 * M - 4);
    if (fl) doc.text(flT, M + 2, y + 11);
    y += 16 + (fl ? flT.length * 4.4 : 0);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.text("Comment faire", M, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
    doc.text(doc.splitTextToSize(win("Faire les raccordements dans l'ordre des numéros (au verso) : terres, neutres, phases, puis retours lampe et navettes. Pour chaque numéro : prendre dans chaque gaine indiquée le fil de la couleur indiquée, dénuder, l'enfoncer dans le connecteur indiqué, cocher la case."), W - 2 * M - 4), M + 2, y + 5.5);

    // raccordements à cocher
    doc.addPage();
    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.text(win(`Boîte ${box.n} : raccordements à faire dans l'ordre`), M, 16);
    y = 24;
    for (const s of steps) {
      const lines = s.wires.map((w) => win(`${w.gaine}  ${wireName(w)} ${fr(w.section, 1)} mm²${w.bague ? "  [bague " + w.bague + "]" : ""}  (${FN_SHORT[w.fn] || w.fn} · ${w.label}${w.room ? ", " + w.room : ""})`));
      const conn = s.conn.list.length ? s.conn.list.map((k) => `${k} entrées`).join(" + ") + (s.conn.ponts ? ` (relier par ${s.conn.ponts} pont${s.conn.ponts > 1 ? "s" : ""})` : "") : "fil seul : vérifier";
      const need = 7 + lines.length * 4.3 + 3;
      if (y + need > 285) { doc.addPage(); y = 16; }
      doc.setDrawColor(40); doc.setLineWidth(0.4); doc.rect(M, y - 4, 5, 5);
      const [r, g, b] = rgb(wireSolid(s.wires[0] && s.wires[0].color)); doc.setFillColor(r, g, b); doc.rect(M + 8, y - 4, 3, 5, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(0);
      doc.text(win(`${s.n}. ${s.label}`), M + 14, y);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
      doc.text(win(`${s.wires.length} fils -> connecteur ${conn}`), W - M, y, { align: "right" });
      doc.setFontSize(9); doc.setTextColor(60);
      lines.forEach((t, i) => doc.text(t, M + 18, y + 5 + i * 4.3));
      doc.setTextColor(0);
      y += need;
    }
    // contrôle final
    if (y + 26 > 285) { doc.addPage(); y = 16; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.text("Contrôle final", M, y + 2);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
    const ctl = ["Chaque gaine : tous ses fils sont dans un connecteur (aucun fil libre).", "Chaque connecteur : le nombre de fils indiqué, enfoncés jusqu'au bout (tirer légèrement pour vérifier).", ...checks.map((c) => "A signaler : " + c)];
    let yy = y + 8;
    for (const c of ctl) { const t = doc.splitTextToSize(win(c), W - 2 * M - 10); doc.rect(M, yy - 3.6, 4, 4); doc.text(t, M + 7, yy); yy += t.length * 4.6 + 1.5; if (yy > 288) { doc.addPage(); yy = 16; } }
  }
  const blob = doc.output("blob");
  return { blob, pages: doc.getNumberOfPages() };
}
