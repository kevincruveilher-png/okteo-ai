// Journal des règles de câblage (v51) : lit docs/journal-regles-cablage.md (le journal tenu avec Kévin) et écrit
// src/cablage/regles-data.js (règles, questions, historique en JSON). À relancer (`npm run regles`) quand le journal change.
// Les champs que le journal n'écrit pas ligne à ligne (paramètres chiffrés, choix, catégorie) viennent de PLUS ci-dessous.
import fs from "node:fs";

const SRC = "docs/journal-regles-cablage.md", OUT = "src/cablage/regles-data.js";
const md = fs.readFileSync(SRC, "utf8");
const lines = md.split("\n");

// ---------- catégories (section 3 bis « Regroupement par catégorie ») ----------
const CAT_OF_LABEL = { "Boîtes": "boites", "Circuits et couleurs": "circuits", "Allumages": "allumages", "Gaines": "gaines",
  "Raccordements": "raccordements", "Tableau": "tableau", "Appareils et lignes directes": "appareils" };
const catOf = {};
for (const l of lines) {
  const m = l.match(/^- (Boîtes|Circuits et couleurs|Allumages|Gaines|Raccordements|Tableau|Appareils et lignes directes) : (R-.*)$/);
  if (!m) continue;
  const ids = [];
  for (const part of m[2].split(",")) {
    const r = part.trim().match(/^R-(\d{3})(?: à R-(\d{3}))?$/);
    if (!r) continue;
    const a = +r[1], b = r[2] ? +r[2] : a;
    for (let i = a; i <= b; i++) ids.push("R-" + String(i).padStart(3, "0"));
  }
  ids.forEach((id) => { catOf[id] = CAT_OF_LABEL[m[1]]; });
}
const CAT_OF_HEADING = { "Boîtes": "boites", "Gaines": "gaines", "Circuits et couleurs": "circuits", "Raccordements": "raccordements",
  "Repères": "allumages", "Tableau": "tableau", "Présentation": "gaines" };

// ---------- compléments (valeurs chiffrées réglables, choix) ----------
const PLUS = {
  "R-001": { parametres: { departs_max: 16, gaines_par_face_max: 6 } },
  "R-011": { parametres: { marge_pct: 10 } },
  "R-020": { parametres: { section: 1.5, couleurs: "rouge/bleu" } },
  "R-021": { parametres: { section: 1.5, prises_max: 8, couleurs: "gris/bleu foncé" } },
  "R-022": { parametres: { section: 2.5, prises_max: 6, couleurs: "rouge/bleu" } },
  "R-072": { parametres: { ronde: "orange, violet, noir, marron, ivoire" } },
  "R-074": { parametres: { icta16_mm2: 7.5, icta20_mm2: 13.5 } },
  "R-087": { parametres: { puissance_moteur_w: 50, calibre_volets_a: 10 } },
  "R-009": { choix: [{ nom: "liaison_boites", valeurs: ["gaine", "connecteur"] }, { nom: "repartition_circuits", valeurs: ["repartie", "limitee_a_une_boite"] }] },
  "R-079": { choix: [{ nom: "volets", valeurs: ["boite_a_part", "melanges"] }] },
  "R-085": { choix: [{ nom: "mode_pieuvre", valeurs: ["proximite", "equilibree", "par_piece", "plug"] }] },
  "R-086": { choix: [{ nom: "raccordement", valeurs: ["boite", "ligne_directe", "a_choisir"] }] },
  "R-096": { choix: [{ nom: "commande_volet", valeurs: ["filaire", "connecte"] }] },
};

// ---------- règles ----------
const rules = [];
let heading = "";
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  const h = l.match(/^### (.+)$/); if (h) heading = h[1].trim();
  const m = l.match(/^\*\*(R-\d{3}) · (.+?)\*\*(.*)$/);
  if (!m) continue;
  const [, id, titre, rest] = m;
  const ticks = [...rest.matchAll(/`([^`]+)`/g)].map((x) => x[1]);
  const statut = ticks.find((t) => /^(active|a_valider|desactivee|brouillon|archivee)$/.test(t)) || "a_valider";
  const cert = ticks.find((t) => /^(confirmee|supposee|inconnue)$/.test(t)) || (statut === "brouillon" ? "inconnue" : "supposee");
  const precise = (rest.match(/\((précise[^)]*|écart avec[^)]*)\)/) || [])[1] || "";
  const note = rest.replace(/`[^`]*`/g, "").replace(/\((précise|écart avec)[^)]*\)/, "").replace(/^[\s—·]+/, "").replace(/[\s·]+$/, "").replace(/^\((.*)\)$/, "$1").trim();
  const bullets = [];
  for (let j = i + 1; j < lines.length && /^(- |\s+(- |\d+\. ))/.test(lines[j]); j++) {
    if (/^- /.test(lines[j]) || !bullets.length) bullets.push(lines[j].replace(/^\s*- /, "").trim());
    else bullets[bullets.length - 1] += "\n" + lines[j].trim(); // sous-liste : rattachée à la puce du dessus
  }
  let description = "", source = "", params = "";
  const details = [];
  for (const b of bullets) {
    if (/^Description : /.test(b)) description = b.replace(/^Description : /, "");
    else if (/^Sources? : /.test(b)) source = b.replace(/^Sources? : /, "");
    else if (/^Paramètres? : /.test(b)) params = b.replace(/^Paramètres? : /, "");
    else details.push(b);
  }
  if (!description) description = details.shift() || "";
  if (!source) source = /Kévin|Q-\d|sources?/i.test(note) ? note : "Journal des règles, 27/10/2026";
  const all = [titre, rest, ...bullets].join(" ");
  const refs = [...new Set([...all.matchAll(/R-\d{3}/g)].map((x) => x[0]).filter((x) => x !== id))];
  const qs = [...new Set([...all.matchAll(/Q-\d{2}/g)].map((x) => x[0]))];
  const bloque = /si_doute = bloquer|doute bloquant|bloqu(ant|er)/i.test(all);
  const cat = catOf[id] || CAT_OF_HEADING[heading] || (/Liaisons/.test(heading) ? "boites" : "gaines");
  const plus = PLUS[id] || {};
  rules.push({
    id, titre, categorie: cat, description, details, condition: "", action: "",
    parametres: plus.parametres || {}, parametres_texte: params,
    certitude: cert, si_doute: bloque ? "bloquer" : "avertir", statut, source, note, precise,
    questions_liees: qs, noeud: `chantier/${cat}/${id}`, depends_on: refs, choix: plus.choix || null,
    preuves: [], version: 1, cree_le: "2026-10-27", modifie_le: "2026-10-27",
    modifie_par: cert === "confirmee" ? "Kévin" : "IA (à valider par Kévin)",
  });
}
// preuves : tableau « Règles existantes confirmées par la bande »
for (const l of lines) {
  const m = l.match(/^\| (R-\d{3}(?:, R-\d{3})*) \| (.+) \|$/);
  if (!m) continue;
  m[1].split(", ").forEach((id) => rules.find((r) => r.id === id)?.preuves.push("Bande DUCOURNEAU : " + m[2]));
}

// ---------- questions ----------
// statut : ouverte | repondue | partielle | reportee | attente (le texte complet est gardé dans statut_texte)
function qStatut(t) {
  if (/report/i.test(t)) return "reportee";
  if (/attente/i.test(t)) return "attente";
  if (/^ouverte/i.test(t)) return "ouverte";
  if (/partie|provisoire|reste /i.test(t)) return "partielle";
  return "repondue";
}
const questions = [];
let sec = "";
for (const l of lines) {
  const h = l.match(/^### ([A-O])\. (.+)$/); if (h) sec = h[1] + ". " + h[2];
  const m = l.match(/^\| (Q-\d{2}) \| (.+) \|$/);
  if (!m) continue;
  const c = m[2].split(" | ").map((x) => x.trim());
  const open = /^(bloquer|avertir|—)$/.test(c[2] || "");
  questions.push({
    id: m[1], section: sec, question: c[0],
    reponse: open ? "" : c[1] || "", suppose: open ? c[1] || "" : "",
    si_doute: open && c[2] !== "—" ? c[2] : "",
    statut: open ? "ouverte" : qStatut(c[2] || ""), statut_texte: open ? "" : (c[2] || "").replace(/\*\*/g, ""),
  });
}

// ---------- historique ----------
const history = [];
for (const l of lines) {
  const m = l.match(/^\| (H-\d{3}) \| (.+) \|$/);
  if (!m) continue;
  const c = m[2].split(" | ").map((x) => x.trim());
  history.push({ id: m[1], date: c[0], regle: c[1], action: c[2], avant: c[3], apres: c[4], motif: c[5], par: c[6], code_valide: c[7] === "—" ? null : c[7] });
}

const version = (md.match(/État au (\d{2})\/(\d{2})\/(\d{4})/) || []).slice(1).reverse().join("-") + "." + history.length;
const data = { version, rules, questions, history };
fs.writeFileSync(OUT, `// Généré par scripts/regles-import.mjs depuis ${SRC} — ne pas modifier à la main.\n` +
  `export const REGLES_BASE = ${JSON.stringify(data, null, 1)};\n`);
const n = (f) => rules.filter(f).length;
console.log(`${rules.length} règles (${n((r) => r.statut === "active")} actives, ${n((r) => r.statut === "a_valider")} à valider, ${n((r) => r.statut === "brouillon")} brouillon, ${n((r) => r.statut === "archivee")} archivée), ${questions.length} questions, ${history.length} entrées d'historique → ${OUT} (version ${version})`);
