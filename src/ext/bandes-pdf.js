// Impression des schémas de boîte (v33) : une feuille A4 par boîte (schéma + orientation + matériel), puis la liste
// des raccordements à cocher (suite sur d'autres feuilles si besoin). jsPDF, unités mm ; texte en WinAnsi seulement
// (pas de flèches ni d'émojis).
import { schemaSVG, FN_SHORT, wireName } from "../cablage/schema.js";
import { wireSolid } from "./cablage-data.js";
import { code128, bars } from "./barcode.js";

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
    const { box, steps, material, checks, sides, level, fils, order = [], tabAng = null, code = "", model = "Boîte pavillonnaire carrée", cover = "haut", ch = {} } = P;
    if (!first) doc.addPage(); first = false;
    // ---------- en-tête (v47, feuille de Kévin) : étiquette collée sur la boîte ----------
    doc.setTextColor(0);
    const lab = (k, v, x, y, al = "left") => { doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(110); doc.text(win(k), x, y, { align: al }); doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(0); doc.text(win(v || "-"), x, y + 4.6, { align: al }); };
    lab("PAVILLONNEUR", ch.client || chantier, M, 11);
    lab("CHANTIER", ch.nom || chantier, M, 22);
    lab("N° D'AFFAIRE", ch.numero || numero, W - M, 11, "right");
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(110); doc.text("NOM BE", W - M, 22, { align: "right" });
    doc.setDrawColor(150); doc.setLineWidth(0.2); doc.line(W - M - 34, 27, W - M, 27);
    doc.text(win("CÂBLEUR (initiales)"), W - M - 22, 32.5, { align: "right" });
    doc.setDrawColor(0); doc.setLineWidth(0.4); doc.rect(W - M - 20, 29, 20, 9);
    // flèche vers le tableau
    const cx = W / 2, cy = 16;
    if (tabAng != null) {
      const c = Math.cos(tabAng), s2 = Math.sin(tabAng), L = 9, P2 = (a, b) => [cx + a * c - b * s2, cy + a * s2 + b * c];
      doc.setFillColor(31, 42, 54);
      const pts = [P2(-L, -2.2), P2(2.5, -2.2), P2(2.5, -5.5), P2(L + 1, 0), P2(2.5, 5.5), P2(2.5, 2.2), P2(-L, 2.2)];
      doc.lines(pts.slice(1).map((p, k) => [p[0] - pts[k][0], p[1] - pts[k][1]]), pts[0][0], pts[0][1], [1, 1], "F", true);
    }
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(0); doc.text(tabAng != null ? "TABLEAU" : "TABLEAU ?", cx, 31, { align: "center" });
    doc.setFontSize(16); doc.text(win(`Boîte ${box.n}`), M, 40);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(90); doc.text(win(level || ""), M + 32, 40); doc.setTextColor(0);
    // ---------- schéma (faces et pièces aux quatre bords) ----------
    const png = await svgToPng(schemaSVG(box, steps, { color: wireSolid, sides }));
    doc.addImage(png, "JPEG", M - 2, 44, 148, 148);
    // ---------- ordre de câblage (cadre à droite) ----------
    const ox = M + 148, ow = W - M - ox;
    let oy = 48;
    doc.setDrawColor(0); doc.setLineWidth(0.4);
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.text("ORDRE DE CABLAGE", ox + ow / 2, oy, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(100); doc.text("borne · fil · nombre", ox + ow / 2, oy + 3.6, { align: "center" }); doc.setTextColor(0);
    oy += 8;
    const rowH = Math.min(5.2, 124 / Math.max(1, order.length));
    for (const o of order) {
      const [r, g, b] = rgb(wireSolid(o.color));
      doc.setFont("helvetica", "bold"); doc.setFontSize(Math.min(8.5, rowH * 1.8)); doc.text(String(o.n), ox + 4, oy, { align: "center" });
      doc.setFillColor(r, g, b); doc.rect(ox + 7.5, oy - rowH * 0.62, 3.2, rowH * 0.75, "F");
      if (/jaune/.test(o.color)) { doc.setFillColor(40, 160, 70); doc.rect(ox + 7.5, oy - rowH * 0.62, 1.6, rowH * 0.75, "F"); }
      doc.setFont("helvetica", "normal"); doc.text(win(`${o.color} ${o.section ? fr(o.section, 1) : ""}`), ox + 12.5, oy);
      doc.setFont("helvetica", "bold"); doc.text(`${o.count}`, ox + ow - 2, oy, { align: "right" });
      doc.setDrawColor(210); doc.setLineWidth(0.15); doc.line(ox + 1, oy + rowH * 0.35, ox + ow - 1, oy + rowH * 0.35);
      oy += rowH;
    }
    doc.setDrawColor(0); doc.setLineWidth(0.5); doc.rect(ox, 43, ow, Math.max(oy - 43, 40));
    // ---------- sous le schéma : matériel, fils, bagues, mode d'emploi ----------
    let y = 200;
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text("Matériel", M, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    const mat = material.sizes.map(([k, n]) => `${n} connecteur${n > 1 ? "s" : ""} ${k} entrées`).join(" · ") + (material.ponts ? ` · ${material.ponts} pont${material.ponts > 1 ? "s" : ""} (bout de fil de la même couleur)` : "");
    const matT = doc.splitTextToSize(win(mat || "-"), W - 2 * M - 22); doc.text(matT, M + 20, y); y += matT.length * 4.2 + 1.5;
    const bg = [...new Set(box.gaines.filter((g) => g.kind === "alim").flatMap((g) => g.wires.map((w) => w.bague)).filter(Boolean))];
    if (bg.length) { doc.text(win("Bagues sur l'alimentation (accolades) : " + bg.join(" · ")), M + 20, y); y += 5; }
    const fl = fils ? fils.wires.map((w) => `${w.n} x ${fr(w.section, 1)} ${w.color}`).join(" · ") + (fils.cables.length ? " · câbles : " + fils.cables.map((c) => `${c.n} x ${c.cable}`).join(", ") : "") : "";
    if (fl) { doc.setFont("helvetica", "bold"); doc.text("Fils", M, y); doc.setFont("helvetica", "normal"); const t = doc.splitTextToSize(win(fl), W - 2 * M - 22); doc.text(t, M + 20, y); y += t.length * 4.2 + 1.5; }
    doc.setFontSize(8.5); doc.setTextColor(70);
    const how = doc.splitTextToSize(win("Câbler dans l'ordre des bornes (cadre « Ordre de câblage », détail au verso) : terres, puis neutre et phase de chaque circuit, puis retours lampe et navettes. Bornes = n° de raccordement ; tracés à l'intérieur : retours, navettes (N2 en pointillés) et commandes ; accolade = bague à poser sur l'alimentation ; câble : âme repérée à la couleur de sa fonction ; xn = gaines identiques sur le chantier."), W - 2 * M);
    doc.text(how, M, y + 2); doc.setTextColor(0);
    // ---------- pied : modèle de boîte (gauche), code barre (droite) ----------
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(110); doc.text(win("MODÈLE DE BOÎTE"), M, 268);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(0); doc.text(win(model), M, 273);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(win(`Couvercle vers le ${cover}`), M, 279);
    if (code) {
      try {
        const bits = await code128(code), mw = 0.3, bw = bits.length * mw, x0 = W - M - bw, y0 = 262;
        doc.setFillColor(0);
        bars(bits).forEach(([x, w]) => doc.rect(x0 + x * mw, y0, w * mw, 14, "F"));
        doc.setFont("courier", "normal"); doc.setFontSize(9); doc.text(win(code), x0 + bw / 2, y0 + 18, { align: "center" });
      } catch (e) { /* code barre impossible : la feuille reste utilisable */ }
    }

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
