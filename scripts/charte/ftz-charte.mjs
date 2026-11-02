// Relevé de la charte FTZ (v74, fondation) : à partir d'un plan FTZ vectoriel exporté par FTZ (ex. VILLANOVA),
// écrit `src/print/ftz-charte.json` = couleurs, épaisseurs, styles de texte, symboles des légendes (nom + dessin exact),
// cartouche (cadres, logo, libellés ; les valeurs du client sont remplacées par le nom du champ).
// Aucune donnée du client n'est enregistrée : le plan de référence reste hors du dépôt (dépôt public).
//   qpdf --qdf --object-streams=disable PLAN.pdf plan-qdf.pdf
//   node scripts/charte/ftz-charte.mjs plan-qdf.pdf [src/print/ftz-charte.json]
// FTZ écrit chaque texte deux fois : en texte invisible (blanc, police PDF standard : position, taille, police) et en
// contours remplis (B*, trait 0,012 pt : ce qu'on voit). La couleur d'un texte = celle de ses contours.
import fs from "node:fs";
import { readQdf, parsePage, pathBox, subD } from "./ftz-pdf.mjs";

const MM = 25.4 / 72;
const r2 = (v) => Math.round(v * 100) / 100;
const mm = (v) => r2(v * MM);
const isGlyph = (p) => p.op === "B*" && p.w < 0.02;

// boîte approximative d'un texte (pt) d'après la police et l'échelle
function textBox(t) {
  const wch = t.font.startsWith("Courier") ? 0.6 : t.font.startsWith("Times") ? 0.5 : 0.55;
  const L = t.str.length * t.sx * wch, H = t.sy * 0.75;
  if (Math.abs(t.angle) === 90) return t.angle > 0 ? { x0: t.x - H, x1: t.x + 0.15 * t.sy, y0: t.y, y1: t.y + L } : { x0: t.x - 0.15 * t.sy, x1: t.x + H, y0: t.y - L, y1: t.y };
  return { x0: t.x, x1: t.x + L, y0: t.y - 0.22 * t.sy, y1: t.y + H };
}
const inter = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

function colorTexts(pg) {
  const glyphs = pg.paths.filter(isGlyph).map((p) => ({ p, b: pathBox(p) }));
  for (const t of pg.texts) {
    const b = textBox(t), hit = {};
    for (const g of glyphs) if (inter(b, g.b)) hit[g.p.fill] = (hit[g.p.fill] || 0) + 1;
    const best = Object.entries(hit).sort((x, y) => y[1] - x[1])[0];
    t.color = best ? best[0] : null; t.bb = b;
  }
}

// légende : tableau à 2 colonnes (symbole | libellé), rangées séparées par des traits pleine largeur
function legend(pg) {
  const lab = pg.texts.filter((t) => t.font === "Helvetica" && t.sy > 6 && t.sy < 6.5 && t.angle === 0);
  if (lab.length < 5) return [];
  const xl = Math.min(...lab.map((t) => t.x)), ytop = Math.max(...lab.map((t) => t.y));
  const V = [], H = [];
  for (const p of pg.paths) if (p.op === "S" && p.stroke === "#000000") for (const s of p.sub) for (let i = 1; i < s.length; i++) {
    const [a, b] = [s[i - 1], s[i]];
    if (Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) > 60 && a[0] < xl && a[0] > xl - 80 && Math.max(a[1], b[1]) > ytop) V.push(a[0]);
    if (Math.abs(a[1] - b[1]) < 0.01 && Math.min(a[0], b[0]) < xl - 20 && Math.max(a[0], b[0]) > xl + 80) H.push(a[1]);
  }
  const xL = Math.min(...V), xM = Math.max(...V.filter((x) => x < xl));
  const ys = [...new Set(H.map((y) => +y.toFixed(1)))].sort((a, b) => b - a);
  const rows = [];
  for (let i = 1; i < ys.length; i++) {
    const y1 = ys[i - 1], y0 = ys[i];
    if (y1 - y0 < 3) continue;
    const name = lab.filter((t) => t.y > y0 && t.y < y1).sort((a, b) => b.y - a.y).map((t) => t.str.trim()).join(" ");
    if (!name) continue;
    const cell = { x0: xL + 0.3, x1: xM - 0.3, y0: y0 + 0.3, y1: y1 - 0.3 };
    const inCell = (b) => b.x0 >= cell.x0 - 0.5 && b.x1 <= cell.x1 + 0.5 && b.y0 >= cell.y0 - 0.5 && b.y1 <= cell.y1 + 0.5;
    const texts = pg.texts.filter((t) => inCell(t.bb) && !lab.includes(t));
    const paths = pg.paths.filter((p) => p.op !== "n" && inCell(pathBox(p)) && !(isGlyph(p) && texts.some((t) => inter(t.bb, pathBox(p)))));
    if (!paths.length && !texts.length) continue;
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (const p of paths) { const b = pathBox(p); bx0 = Math.min(bx0, b.x0); by0 = Math.min(by0, b.y0); bx1 = Math.max(bx1, b.x1); by1 = Math.max(by1, b.y1); }
    for (const t of texts) { bx0 = Math.min(bx0, t.bb.x0); by0 = Math.min(by0, t.bb.y0); bx1 = Math.max(bx1, t.bb.x1); by1 = Math.max(by1, t.bb.y1); }
    const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
    // repère local en mm, axe y vers le bas (comme le plan et jsPDF)
    const P = ([x, y]) => [mm(x - cx), mm(cy - y)];
    rows.push({
      name, w: mm(bx1 - bx0), h: mm(by1 - by0), box: [mm(bx0), mm(pg.box[3] - by1), mm(bx1), mm(pg.box[3] - by0)],
      paths: paths.map((p) => ({ op: p.op, stroke: p.stroke, fill: p.fill, w: +(p.w * MM).toFixed(4), dash: p.dash.map(mm), d: p.sub.map((s) => subD(s, P)).join("") })),
      texts: texts.map((t) => ({ str: t.str, font: t.font, sx: mm(t.sx), sy: mm(t.sy), angle: t.angle, at: P([t.x, t.y]), color: t.color })),
    });
  }
  return rows;
}

// styles de texte : regroupés par police, taille et couleur ; exemples génériques seulement
function textStyles(pg, privateStrs) {
  const st = {};
  for (const t of pg.texts) {
    const k = `${t.font}|${mm(t.sx)}|${mm(t.sy)}|${t.color}`;
    const o = (st[k] ||= { font: t.font, sx: mm(t.sx), sy: mm(t.sy), ratio: r2(t.sx / t.sy), color: t.color, n: 0, ex: [] });
    o.n++;
    if (o.ex.length < 8 && !privateStrs.has(t.str) && t.str.length < 60 && !o.ex.includes(t.str)) o.ex.push(t.str);
  }
  return Object.values(st).sort((a, b) => b.n - a.n);
}

function palette(pg) {
  const k = {};
  for (const p of pg.paths) {
    if (p.op === "n") continue;
    const kind = isGlyph(p) ? "texte" : p.fill && !p.stroke ? "aplat" : p.sub.some((s) => s.curve) ? "courbe" : "trait";
    const key = `${kind}|${p.stroke || "-"}|${p.fill || "-"}|${mm(p.w)}|${p.dash.length ? p.dash.map(mm).join("/") : ""}`;
    k[key] = (k[key] || 0) + 1;
  }
  return Object.entries(k).sort((a, b) => b[1] - a[1]).map(([key, n]) => { const [kind, stroke, fill, w, dash] = key.split("|"); return { kind, stroke, fill, w: +w, dash, n }; });
}

// cartouche : zone basse de la page (sous le trait horizontal qui la sépare du plan)
function cartouche(pg, fields) {
  const lbl = pg.texts.find((t) => t.str === "Client");
  if (!lbl) return null;
  // trait horizontal du haut du cartouche : FTZ le découpe en morceaux, on additionne les longueurs par hauteur
  const tot = {};
  for (const p of pg.paths) if (p.op === "S" && p.stroke === "#000000") for (const s of p.sub) for (let i = 1; i < s.length; i++) {
    const [a, b] = [s[i - 1], s[i]];
    if (Math.abs(a[1] - b[1]) < 0.05 && a[1] > lbl.y && a[1] < lbl.y + 30) { const k = a[1].toFixed(1); tot[k] = (tot[k] || 0) + Math.abs(a[0] - b[0]); }
  }
  const cand = Object.entries(tot).filter(([, L]) => L > 300).map(([y]) => +y);
  if (!cand.length) return null;
  const top = Math.max(...cand);
  const zone = (b) => b.y1 <= top + 0.5;
  // textes redessinés avec leur police ; on ne garde des contours de lettres que ceux du logo (bleu nuit / rouge
  // KiTéOHM, et la phrase « pour une maison branchée » qui en fait partie) : aucune lettre des valeurs du client
  const LOGO = new Set(["#00004F", "#FF3737"]);
  const texts = pg.texts.filter((t) => zone(t.bb) && !(LOGO.has(t.color) && /maison|branch/.test(t.str)));
  const paths = pg.paths.filter((p) => p.op !== "n" && zone(pathBox(p)) && (!isGlyph(p) || LOGO.has(p.fill)));
  const H = pg.box[3];
  const P = ([x, y]) => [mm(x), mm(H - y)];
  return {
    top: mm(H - top),
    paths: paths.map((p) => ({ op: p.op, stroke: p.stroke, fill: p.fill, w: +(p.w * MM).toFixed(4), dash: p.dash.map(mm), d: p.sub.map((s) => subD(s, P)).join("") })),
    texts: texts.map((t) => ({ str: fields[t.str] ? `{${fields[t.str]}}` : t.str, font: t.font, sx: mm(t.sx), sy: mm(t.sy), angle: t.angle, at: P([t.x, t.y]), color: t.color })),
  };
}

// ---------- programme ----------
if (process.argv[1] && process.argv[1].endsWith("ftz-charte.mjs")) {
  const [, , input, output = "src/print/ftz-charte.json"] = process.argv;
  const pages = readQdf(input).map(parsePage);
  pages.forEach(colorTexts);
  // valeurs propres au client (jamais enregistrées) : celles des champs du cartouche
  const p1 = pages[0];
  const near = (lab, dx = 200) => { const L = p1.texts.find((t) => t.str === lab); return L ? p1.texts.filter((t) => t !== L && Math.abs(t.y - L.y) < 4 && t.x > L.x && t.x < L.x + dx).sort((a, b) => a.x - b.x)[0] : null; };
  const fields = {};
  for (const [lab, key] of [["Client", "client"], ["Chantier", "chantier"], ["N°", "affaire"]]) { const v = near(lab); if (v) fields[v.str] = key; }
  for (const t of p1.texts) { if (/^\d{2}\/\d{2}\/\d{4}$/.test(t.str)) fields[t.str] = "date"; if (/^1 \/ \d+$/.test(t.str)) fields[t.str] = "echelle"; }
  const dess = p1.texts.find((t) => t.str.startsWith("Dess")); if (dess) { const v = p1.texts.filter((t) => t !== dess && Math.abs(t.x - dess.x) < 20 && t.y < dess.y && t.y > dess.y - 15)[0]; if (v) fields[v.str] = "dessinateur"; }
  pages.forEach((pg) => pg.texts.forEach((t) => { if (/^\d{2}\/\d{2}\/\d{4}$/.test(t.str)) fields[t.str] = "date"; if (/^BE\d+$/.test(t.str.trim())) fields[t.str] = "dessinateur"; }));
  const priv = new Set(Object.keys(fields));
  const out = {
    source: "plan FTZ vectoriel (export SchemBAT / FTZ PDF Library) ; valeurs du client retirées",
    unite: "mm, y vers le bas",
    pages: pages.map((pg, i) => ({
      n: i + 1, w: mm(pg.box[2]), h: mm(pg.box[3]),
      palette: palette(pg).slice(0, 60),
      textes: textStyles(pg, priv).slice(0, 60),
      legende: legend(pg),
      cartouche: cartouche(pg, fields),
    })),
  };
  fs.mkdirSync(output.replace(/\/[^/]+$/, ""), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(out));
  for (const pg of out.pages) console.log(`page ${pg.n} ${pg.w}×${pg.h} mm · légende ${pg.legende.length} symboles · cartouche ${pg.cartouche ? pg.cartouche.paths.length + " tracés" : "—"}`);
  console.log("champs du client retirés :", Object.values(fields).join(", "));
}
