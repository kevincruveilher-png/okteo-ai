// Dossier PDF du chantier (v50) : un seul PDF, à garder ou à envoyer (pas destiné à être imprimé en entier).
// 1. page de garde (logo KiTéOHM, chantier, sommaire) ; 2. plan (tous les niveaux, à l'échelle, cartouche avec logo) ;
// 3. tableau électrique (coffret, différentiels, disjoncteurs, appareillage modulaire) ; 4. bande détaillée de chaque
// boîte (schéma, ordre de câblage, matériel, raccordements). Assemblé avec pdf-lib (chargé à la demande).
import { buildPlanPdf } from "./print.js";
import { buildBandsPdf } from "./bandes-pdf.js";
import { boxSheets } from "./cablage-bandes.js";
import { modelOf, autoTableau, syncTableau, protections, rowMods, MODS, tableauIssues, hasBreaker } from "../cablage/tableau.js";
import { logoData, LOGO_RATIO } from "./logo.js";

let J = null;
async function jspdf() { if (!J) J = (await import("jspdf")).jsPDF; return J; }
const win = (s) => String(s ?? "").replace(/[→⟶]/g, "->").replace(/[↔]/g, "<->").replace(/[^\x20-\x7E -ÿ–—…’Œœ]/g, "");
const rgb = (hex) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); const v = m ? parseInt(m[1], 16) : 0x999999; return [v >> 16, (v >> 8) & 255, v & 255]; };
const KIND = { eclairage: "Eclairage", prises: "Prises", cuisine: "Prises cuisine", specialise: "Specialise", comm: "Communication" };
const today = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`; };

// tableau du chantier (enregistré, sinon disposition automatique)
export function tableauNow(api) {
  const C = api.cab.circuits || [], saved = api.cab.tableau;
  if (!C.filter(hasBreaker).length) return null;
  let area = 100; try { area = api.allLevelsGeometry().reduce((s, g) => s + g.rooms.reduce((t, r) => t + (r.area || 0), 0), 0) || 100; } catch { /* */ }
  const T = saved && saved.rows ? syncTableau(saved, C) : { ...autoTableau(C, { model: (saved && saved.model) || undefined, area }), missing: [] };
  return { T, C };
}

export async function buildTableauPdf({ T, C }, { chantier = {}, colors = [] } = {}) {
  const JsPDF = await jspdf(), logo = await logoData();
  const doc = new JsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const M = modelOf(T.model), W = 297, mw = Math.min(14, (W - 110) / M.mods), x0 = 24;
  const nIss = Math.min(6, tableauIssues(T, C).length), nR = Math.max(M.rows, T.rows.length);
  const mh = Math.min(34, (196 - 34 - nIss * 4) / nR - 7); // toutes les rangées tiennent sur la page
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text("Tableau electrique", 12, 16);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(win(`${chantier.nom || ""}${chantier.numero ? " - n° " + chantier.numero : ""} - ${M.brand} ${M.name}`), 12, 23);
  if (logo) doc.addImage(logo, "JPEG", W - 12 - 46, 9, 46, 46 / LOGO_RATIO);
  const byN = new Map(C.map((c, i) => [c.n, { c, i }])), prot = protections(T.rows);
  let y = 34;
  for (let r = 0; r < nR; r++) {
    const row = T.rows[r] || [];
    doc.setDrawColor(150); doc.setFillColor(220, 225, 230); doc.rect(x0 - 2, y - 2, M.mods * mw + 4, mh + 4, "F");
    doc.setFontSize(8); doc.setTextColor(90); doc.text(String(r + 1), x0 - 6, y + mh / 2);
    let x = x0;
    for (const it of row) {
      const w = it.w * mw - 0.8;
      doc.setFillColor(252, 252, 250); doc.setDrawColor(120); doc.setLineWidth(0.2); doc.rect(x + 0.4, y, w, mh, "FD");
      let top = [90, 100, 115], l1 = "", l2 = "", l3 = "";
      if (it.k === "id") { top = it.type === "A" ? [47, 123, 216] : [91, 107, 125]; l1 = "ID"; l2 = `${it.a} A`; l3 = `type ${it.type} 30 mA`; }
      else if (it.k === "cb") { const x2 = byN.get(it.c); top = rgb(x2 ? colors[x2.i % colors.length] : "#999999"); l1 = it.c; l2 = `${it.a} A`; l3 = x2 ? (x2.c.name || KIND[x2.c.kind] || "") : ""; }
      else { const D = MODS[it.t] || { s: it.t }; l1 = it.label || ""; l3 = D.s; }
      doc.setFillColor(...top); doc.rect(x + 0.4, y, w, 3, "F");
      doc.setTextColor(0); doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.text(win(l1), x + 0.4 + w / 2, y + 8, { align: "center" });
      doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); doc.text(win(l2), x + 0.4 + w / 2, y + 13, { align: "center" });
      doc.setFontSize(5); doc.text(doc.splitTextToSize(win(l3), w - 1).slice(0, mh > 26 ? 4 : 2), x + 0.4 + w / 2, y + Math.min(20, mh - 6), { align: "center" });
      x += it.w * mw;
    }
    y += mh + 7;
  }
  // nomenclature des circuits
  doc.setTextColor(0); doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text("Circuits", x0 + M.mods * mw + 12, 34);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
  let yy = 40;
  for (const it of T.rows.flat().filter((x) => x.k === "cb")) {
    const x2 = byN.get(it.c), id = prot.get(it.id);
    const t = `${it.c}  ${it.a} A  ${x2 ? (x2.c.section ? String(x2.c.section).replace(".", ",") + " mm2  " : "") + (x2.c.name || KIND[x2.c.kind] || "") : ""}${id ? `  (ID ${id.type})` : ""}`;
    doc.text(doc.splitTextToSize(win(t), W - (x0 + M.mods * mw + 12) - 10)[0], x0 + M.mods * mw + 12, yy); yy += 4.2;
    if (yy > 196) break;
  }
  const iss = tableauIssues(T, C);
  if (iss.length) { doc.setTextColor(190, 60, 30); doc.setFontSize(7.5); iss.slice(0, 6).forEach((t, i) => doc.text(win("! " + t), 12, 200 - (iss.slice(0, 6).length - 1 - i) * 4)); }
  return { blob: doc.output("blob"), pages: doc.getNumberOfPages() };
}

async function coverPdf(api, parts) {
  const JsPDF = await jspdf(), logo = await logoData();
  const doc = new JsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  if (logo) doc.addImage(logo, "JPEG", 40, 40, 130, 130 / LOGO_RATIO);
  doc.setFont("helvetica", "bold"); doc.setFontSize(24); doc.text("Dossier de cablage", 105, 100, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(14);
  const ch = api.ch;
  [["Chantier", ch.nom], ["Pavillonneur", ch.client || "-"], ["N° d'affaire", ch.numero || "-"], ["Date", today()]].forEach(([k, v], i) => {
    doc.setTextColor(110); doc.setFontSize(10); doc.text(win(k), 50, 122 + i * 12); doc.setTextColor(0); doc.setFontSize(14); doc.text(win(v), 95, 122 + i * 12);
  });
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text("Sommaire", 50, 185);
  doc.setFont("helvetica", "normal"); doc.setFontSize(11);
  parts.forEach((p, i) => doc.text(win(`${p.title}${p.page ? "  ....  page " + p.page : ""}`), 55, 194 + i * 7));
  doc.setFontSize(8); doc.setTextColor(120); doc.text("Oktéo AI - KiTéOHM", 105, 285, { align: "center" });
  return doc.output("blob");
}

// assemble le dossier ; renvoie { blob, pages, parts }
export async function buildDossier(api, { indice = "A" } = {}) {
  const parts = [];
  const geo = api.allLevelsGeometry();
  const plan = await buildPlanPdf(geo.length > 1 ? geo : geo[0], { nomenclature: true, indice, niveau: geo[0] && geo[0].level, rot: api.viewRot || 0 });   // v62 : sens de la vue
  parts.push({ title: geo.length > 1 ? `Plan (${geo.length} niveaux) et nomenclature` : "Plan et nomenclature", blob: plan.blob });
  const tb = tableauNow(api);
  if (tb) parts.push({ title: "Tableau electrique", blob: (await buildTableauPdf(tb, { chantier: api.ch, colors: api.circuitColors || [] })).blob });
  const sheets = boxSheets(api);
  if (sheets.length) parts.push({ title: `Bandes detaillees (${sheets.length} boite${sheets.length > 1 ? "s" : ""} : ${sheets.map((s) => s.box.n).join(", ")})`, blob: (await buildBandsPdf(sheets, { chantier: api.ch.nom, numero: api.ch.numero })).blob });
  const { PDFDocument } = await import("pdf-lib");
  // numéros de page de chaque partie (la page de garde est la page 1)
  const docs = [];
  for (const p of parts) docs.push(await PDFDocument.load(await p.blob.arrayBuffer()));
  let pg = 2; parts.forEach((p, i) => { p.page = pg; pg += docs[i].getPageCount(); });
  const out = await PDFDocument.create();
  const cover = await PDFDocument.load(await (await coverPdf(api, parts)).arrayBuffer());
  for (const d of [cover, ...docs]) (await out.copyPages(d, d.getPageIndices())).forEach((p) => out.addPage(p));
  out.setTitle(`Dossier de câblage - ${api.ch.nom}`); out.setAuthor("KiTéOHM"); out.setCreator("Oktéo AI");
  const bytes = await out.save();
  return { blob: new Blob([bytes], { type: "application/pdf" }), pages: out.getPageCount(), parts: parts.map(({ title, page }) => ({ title, page })) };
}

export function downloadBlob(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name.replace(/[\\/:*?"<>|]+/g, "_");
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}
