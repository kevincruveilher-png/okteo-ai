// MAJ norme n° 6 (06/11/2026, go de Kévin) : « Documents à remettre » (PDF A4) — schéma unifilaire (DOC-02), étiquettes de
// repérage des circuits (DOC-01), liens de communication (DOC-03), fiche d'autocontrôle pré-remplie (DOC-04) ; la version
// de la norme du chantier sur chaque page (DOC-05). Joint au dossier du chantier (dossier.js) ou téléchargé seul.
// Passe seulement par l'API (window.okteo).
import { unifilaire, reperage, liensCom, autocontrole } from "../norme/documents.js";
import { checkPieces } from "../norme/pieces.js";
import { checkCircuits } from "../cablage/circuits.js";
import { tableauIssues } from "../cablage/tableau.js";
import { getCab } from "../cablage/settings.js";
import { tableauNow } from "./dossier.js";
import { tabCtx } from "./tableau-page.js";

let J = null;
async function jspdf() { if (!J) J = (await import("jspdf")).jsPDF; return J; }
const win = (s) => String(s ?? "").replace(/[→⟶]/g, "->").replace(/[↔]/g, "<->").replace(/[^\x20-\x7E -ÿ–—…’Œœ]/g, "");
const today = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`; };

// toutes les données des documents (aussi pour les tests)
export function documentsData(api) {
  const V = api.normeVersion(), apps = api.allApps(), tb = tableauNow(api), C = api.cab.circuits || [];
  const rooms = [];
  for (const L of api.levels) api.inLevel(L.id, () => (api.state.rooms || []).forEach((r) => rooms.push({ id: r.id, name: r.name, poly: api.roomPoly(r), area: api.roomArea(r), lv: L.id })));
  const pieces = checkPieces(rooms, apps, { v: V.v }).filter((i) => !(((api.cab.decisions || {})[i.key] || {}).choix === "garde"));
  let circ = [];
  try { circ = C.length ? checkCircuits(C, apps, getCab()).issues : []; } catch { circ = []; }
  const tab = tb ? tableauIssues(tb.T, tb.C, tabCtx(api)) : [];
  const sdb = (api.control || []).filter((x) => x.kind === "sdb");
  return {
    V, chantier: api.ch,
    unifilaire: tb ? unifilaire(tb.T, tb.C, apps) : [],
    reperage: tb ? reperage(tb.T, tb.C, apps) : [],
    liens: liensCom(apps),
    fiche: autocontrole({ v: V.v, pieces, circuits: circ, tableau: tab, sdb, hasTableau: !!tb }),
  };
}

export async function buildDocumentsPdf(api) {
  const D = documentsData(api), JsPDF = await jspdf();
  const doc = new JsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const W = 210, H = 297, ch = D.chantier || {}, norme = `${D.V.label}${D.V.permis ? ` (permis déposé le ${D.V.permis.split("-").reverse().join("/")})` : " (date du permis non renseignée)"}`;
  let page = 0;
  const head = (title, code) => {
    if (page++) doc.addPage("a4", "portrait");
    doc.setTextColor(0); doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.text(win(title), 12, 16);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text(win(`${ch.nom || ""}${ch.numero ? " - n° " + ch.numero : ""}${ch.client ? " - " + ch.client : ""} - ${today()}`), 12, 22);
    doc.setFontSize(7.5); doc.setTextColor(90); doc.text(win(`Référence : ${norme} · ${code}`), 12, 27);
    doc.setTextColor(120); doc.text(win("Oktéo AI - KiTéOHM"), W / 2, H - 8, { align: "center" });
    doc.setTextColor(0);
    return 34;
  };
  const line = (y, x0 = 12, x1 = W - 12) => { doc.setDrawColor(200); doc.setLineWidth(0.2); doc.line(x0, y, x1, y); };
  // 1. schéma unifilaire (DOC-02)
  let y = head("Schéma unifilaire", "DOC-02");
  if (!D.unifilaire.length) { doc.setFontSize(10); doc.text(win("Pas encore de circuits ni de tableau : répartissez les circuits (panneau Câblage)."), 12, y); y += 8; }
  doc.setFontSize(8);
  const cols = [12, 30, 44, 62, 112];
  for (const g of D.unifilaire) {
    if (y > H - 30) y = head("Schéma unifilaire (suite)", "DOC-02");
    doc.setFont("helvetica", "bold"); doc.setFillColor(235, 240, 248); doc.rect(12, y - 4, W - 24, 6, "F"); doc.text(win(g.id), 14, y); y += 6;
    doc.setFont("helvetica", "normal");
    const y0 = y - 3;
    for (const l of g.circuits) {
      if (y > H - 20) { y = head("Schéma unifilaire (suite)", "DOC-02"); }
      doc.text(win(l.n), cols[0] + 6, y); doc.text(win(`${l.a} A`), cols[1], y); doc.text(win(l.section != null ? `${String(l.section).replace(".", ",")} mm²` : "-"), cols[2], y);
      doc.text(doc.splitTextToSize(win(l.fonction), 48)[0] || "", cols[3], y);
      const loc = doc.splitTextToSize(win(l.locaux.join(", ") || "-"), W - 12 - cols[4]);
      doc.text(loc.slice(0, 2), cols[4], y);
      doc.setDrawColor(150); doc.line(cols[0] + 2, y - 1.2, cols[0] + 5, y - 1.2);
      y += 4.4 * Math.min(2, loc.length);
    }
    doc.setDrawColor(150); doc.line(cols[0] + 2, y0, cols[0] + 2, y - 5.6);
    y += 3;
  }
  doc.setFontSize(7); doc.setTextColor(90); doc.text(win("Colonnes : circuit, disjoncteur, section cuivre, fonction, locaux desservis. À mettre à jour à chaque modification de l'installation."), 12, Math.min(y + 2, H - 14)); doc.setTextColor(0);
  // 2. étiquettes de repérage (DOC-01)
  y = head("Étiquettes de repérage des circuits", "DOC-01");
  const EW = 61, EH = 20, gap = 2.5;
  D.reperage.forEach((e, i) => {
    const k = i % 39; if (i && k === 0) y = head("Étiquettes de repérage (suite)", "DOC-01");
    const cx = 12 + (k % 3) * (EW + gap), cy = y + Math.floor(k / 3) * (EH + gap);
    doc.setDrawColor(120); doc.setLineDashPattern([1, 0.8], 0); doc.rect(cx, cy, EW, EH); doc.setLineDashPattern([], 0);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text(win(e.titre), cx + 2, cy + 5);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.text(win(e.fonction), cx + 2, cy + 10);
    doc.setFontSize(7); doc.text(doc.splitTextToSize(win(e.locaux), EW - 4).slice(0, 2), cx + 2, cy + 14.5);
  });
  if (!D.reperage.length) { doc.setFontSize(10); doc.text(win("Aucun circuit au tableau pour l'instant."), 12, y); }
  // 3. liens de communication (DOC-03)
  y = head("Liens de communication (RJ45)", "DOC-03");
  doc.setFontSize(8.5);
  if (!D.liens.length) doc.text(win("Aucune prise RJ45 sur le plan."), 12, y);
  else {
    doc.setFont("helvetica", "bold"); ["Port du bandeau", "Repère de la prise", "Pièce", "Niveau"].forEach((t, i) => doc.text(win(t), [12, 50, 90, 160][i], y)); doc.setFont("helvetica", "normal"); line(y + 1.5); y += 6;
    for (const l of D.liens) { if (y > H - 24) y = head("Liens de communication (suite)", "DOC-03"); [l.port, l.rep, l.room, l.niveau].forEach((t, i) => doc.text(win(t), [12, 50, 90, 160][i], y)); y += 5; }
    y += 3; doc.setFontSize(7.5); doc.setTextColor(90);
    doc.text(doc.splitTextToSize(win("Chaque lien est repéré aux deux bouts (port du bandeau et prise). Code couleur du câblage : « B » (usage en France), le même pour tous les liens. Dossier technique : synoptique, plans, code couleur, notices des produits."), W - 24), 12, y);
    doc.setTextColor(0);
  }
  // 4. fiche d'autocontrôle (DOC-04)
  y = head("Fiche d'autocontrôle de l'installation", "DOC-04");
  doc.setFontSize(7.5); doc.setTextColor(90); doc.text(win("R : réalisé · NR : non réalisé · SO : sans objet. Les lignes « Vérifié sur le plan » sont remplies par Oktéo ; les autres se remplissent sur le chantier."), 12, y); doc.setTextColor(0); y += 6;
  let grp = null;
  for (const r of D.fiche) {
    if (y > H - 30) y = head("Fiche d'autocontrôle (suite)", "DOC-04");
    if (r.groupe !== grp) { grp = r.groupe; doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text(win(grp), 12, y); y += 5; doc.setFont("helvetica", "normal"); }
    doc.setFontSize(8);
    const lib = doc.splitTextToSize(win(`${r.libelle}${r.note ? " - " + r.note : ""}`), 120);
    doc.setTextColor(90); doc.text(win(r.code), 12, y); doc.setTextColor(0);
    doc.text(lib.slice(0, 2), 30, y);
    ["R", "NR", "SO"].forEach((k, i) => { const bx = 158 + i * 13; doc.setDrawColor(130); doc.rect(bx, y - 3, 3.2, 3.2); if (r.etat === k) { doc.setFont("helvetica", "bold"); doc.text("X", bx + 0.6, y - 0.4); doc.setFont("helvetica", "normal"); } doc.setFontSize(6.5); doc.text(k, bx + 4.2, y - 0.6); doc.setFontSize(8); });
    y += 4.4 * Math.min(2, lib.length) + 1;
  }
  y += 4; if (y > H - 30) y = head("Fiche d'autocontrôle (suite)", "DOC-04");
  doc.setFontSize(8.5); doc.text(win("Fiche établie par : ......................................   Date : ................   Signature :"), 12, y);
  return { blob: doc.output("blob"), pages: doc.getNumberOfPages(), data: D };
}
