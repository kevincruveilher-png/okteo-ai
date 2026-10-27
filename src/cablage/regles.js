// Journal des règles de câblage (v51) — référence unique des règles KiTéOHM (boîtes, gaines, circuits, couleurs…).
// Base : src/cablage/regles-data.js (généré depuis docs/journal-regles-cablage.md). Le journal vivant (règles modifiées,
// historique) est rangé sur ce PC (localStorage `okteo.regles.v1`), commun à tous les chantiers ; export / import JSON.
// Règles du journal : modification par l'assistant seulement, avant / après validé par Kévin, historique obligatoire,
// suppression = statut « archivee ». Toute modification passe par autoriserModification() (code à brancher plus tard).
import { REGLES_BASE } from "./regles-data.js";

const KEY = "okteo.regles.v1";
export const CATS = { boites: "Boîtes", circuits: "Circuits et couleurs", allumages: "Allumages", gaines: "Gaines",
  raccordements: "Raccordements", tableau: "Tableau", appareils: "Appareils et lignes directes" };
export const CERTS = { confirmee: "confirmée", supposee: "supposée", inconnue: "inconnue" };
export const STATUTS = { active: "active", a_valider: "à valider", desactivee: "désactivée", brouillon: "brouillon", archivee: "archivée" };
export const QSTATUTS = { ouverte: "ouverte", partielle: "en partie", attente: "en attente", reportee: "reportée", repondue: "répondue" };
// champs qu'une proposition de l'assistant peut changer
export const CHAMPS = ["titre", "categorie", "description", "details", "condition", "action", "parametres", "certitude", "si_doute", "statut", "source", "questions_liees", "depends_on", "choix", "note"];

const clone = (o) => JSON.parse(JSON.stringify(o));
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const frDate = (iso) => iso.split("-").reverse().join("/");

function read() { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } }
function write(J) {
  try { localStorage.setItem(KEY, JSON.stringify(J)); } catch { /* */ }
  if (typeof document !== "undefined") document.dispatchEvent(new CustomEvent("okteo:regles"));
  return J;
}

// journal en vigueur : la base, plus ce qui a été modifié sur ce PC. Une nouvelle base (journal relu par Claude)
// remplace les règles jamais touchées ici et ajoute les nouvelles ; une règle modifiée sur ce PC garde sa version.
export function getJournal() {
  const B = REGLES_BASE, S = read();
  if (!S || !Array.isArray(S.rules)) return { ...clone(B), base: B.version };
  if (S.base === B.version) return S;
  const touched = new Set(S.history.filter((h) => h.local).flatMap((h) => h.regle.match(/R-\d{3}/g) || []));
  const rules = B.rules.map((r) => (touched.has(r.id) ? S.rules.find((x) => x.id === r.id) || clone(r) : clone(r)));
  S.rules.filter((r) => !rules.some((x) => x.id === r.id)).forEach((r) => rules.push(r));
  const history = clone(B.history);
  S.history.filter((h) => h.local && !history.some((x) => x.id === h.id)).forEach((h) => history.push(h));
  return { version: B.version, base: B.version, rules, questions: clone(B.questions), history };
}
export const ruleById = (J, id) => J.rules.find((r) => r.id === id) || null;
export const usedBy = (J, id) => J.rules.filter((r) => r.id !== id && (r.depends_on || []).includes(id)).map((r) => r.id);
export const historyOf = (J, id) => J.history.filter((h) => (h.regle.match(/R-\d{3}/g) || []).includes(id) || rangeHas(h.regle, id));
function rangeHas(txt, id) {
  const n = +id.slice(2);
  return [...txt.matchAll(/R-(\d{3}) à R-(\d{3})/g)].some((m) => n >= +m[1] && n <= +m[2]);
}

// compteurs par catégorie ; une catégorie est « rouge » si une de ses règles bloquantes est inconnue
export function stats(J) {
  const out = {};
  for (const k of Object.keys(CATS)) out[k] = { n: 0, confirmee: 0, supposee: 0, inconnue: 0, rouge: false };
  for (const r of J.rules) {
    if (r.statut === "archivee") continue;
    const s = out[r.categorie] || (out[r.categorie] = { n: 0, confirmee: 0, supposee: 0, inconnue: 0, rouge: false });
    s.n++; s[r.certitude]++;
    if (r.si_doute === "bloquer" && r.certitude === "inconnue") s.rouge = true;
  }
  return out;
}
export function totals(J) {
  const t = { n: J.rules.length };
  for (const k of Object.keys(STATUTS)) t[k] = J.rules.filter((r) => r.statut === k).length;
  t.bloquants = J.rules.filter((r) => r.statut !== "archivee" && r.si_doute === "bloquer" && r.certitude !== "confirmee").map((r) => r.id);
  t.questions = J.questions.filter((q) => q.statut === "ouverte" || q.statut === "attente" || q.statut === "partielle").length;
  return t;
}

const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
// questions en suspens (v48) : statut « en attente » (d'un chantier, ou d'un collègue plus qualifié : `collegue`)
export function pendingQuestions(J) {
  return J.questions.filter((q) => q.statut === "attente").map((q) => ({ ...q, collegue: /coll[eè]gue/i.test(q.statut_texte || "") }));
}
export function filterRules(J, { cat = "", cert = "", statut = "", q = "", attente = false } = {}) {
  const words = norm(q).split(/\s+/).filter(Boolean);
  const wait = attente ? new Set(pendingQuestions(J).map((x) => x.id)) : null;
  return J.rules.filter((r) => (!cat || r.categorie === cat) && (!cert || r.certitude === cert) && (!statut || r.statut === statut)
    && (!wait || (r.questions_liees || []).some((id) => wait.has(id)))
    && (!statut && r.statut === "archivee" ? false : true)
    && words.every((w) => norm([r.id, r.titre, r.description, ...(r.details || []), JSON.stringify(r.parametres)].join(" ")).includes(w)));
}

// ---------- écarts entre le journal et les réglages actuels du logiciel ----------
// [règle, libellé, valeur de la règle (fonction du paramètre), clé du réglage Câblage, comparaison, note]
const ECARTS = [
  ["R-001", "Départs par boîte (sans l'alimentation)", (p) => p.departs_max, "departsMax"],
  ["R-001", "Gaines par face", (p) => p.gaines_par_face_max, "departsFace"],
  ["R-020", "Section éclairage", (p) => p.section, "secEclairage"],
  ["R-020", "Couleurs éclairage", (p) => p.couleurs, "couleursEclairage"],
  ["R-021", "Prises par circuit", (p) => p.prises_max, "maxPrises"],
  ["R-021", "Section prises", (p) => p.section, "secPrises"],
  ["R-021", "Couleurs prises", (p) => p.couleurs, "couleursPrises"],
  ["R-022", "Prises de cuisine par circuit", (p) => p.prises_max, "maxPrisesCuisine"],
  ["R-022", "Section cuisine", (p) => p.section, "secCuisine"],
  ["R-072", "Ronde des retours et navettes", (p) => p.ronde, "couleursCommande"],
  ["R-074", "ICTA 16 : somme des sections (mm²)", (p) => p.icta16_mm2, "icta16"],
  ["R-074", "ICTA 20 : somme des sections (mm²)", (p) => p.icta20_mm2, "icta20"],
];
// réglage du panneau Paramètres → Câblage → règle(s) du journal
export const CAB_RULES = { departsMax: ["R-001"], departsFace: ["R-001", "R-088"], maxPrises: ["R-021", "R-085"], maxPrisesCuisine: ["R-022"],
  secEclairage: ["R-020"], secPrises: ["R-021"], secCuisine: ["R-022"], couleursEclairage: ["R-020"], couleursPrises: ["R-021"],
  couleursCuisine: ["R-022"], couleursCommande: ["R-072", "R-023"], bagues: ["R-075", "R-085"], icta16: ["R-074"], icta20: ["R-074"], secVolets: ["R-079", "R-087"], protVolets: ["R-087"], puissanceMoteur: ["R-087"], couleursVolets: ["R-079"],
  memeEndroit: ["R-013", "R-073"], cableExt: ["R-014", "R-095"], majoration: ["R-011"], arrondi: ["R-078"], margeBoite: ["R-011"],
  margeApp: ["R-011"], circuitsParBoite: ["R-007", "R-085"], bornes: ["R-092"], hTableau: ["R-011"] };
const same = (a, b) => (typeof a === "string" ? norm(a).replace(/\s+/g, "") === norm(b).replace(/\s+/g, "") : a === b);
export function ecarts(J, cab) {
  const out = [];
  for (const [id, label, val, key, eq, note] of ECARTS) {
    const r = ruleById(J, id); if (!r || r.statut === "archivee") continue;
    const attendu = val(r.parametres || {}); if (attendu == null) continue;
    const v = cab[key], ok = eq ? eq(attendu, v) || same(attendu, v) : same(attendu, v);
    if (!ok) out.push({ id, label, attendu, logiciel: v, key, note: note || "" });
  }
  return out;
}

// ---------- modifications (assistant + validation de Kévin) ----------
// Point unique où brancher le code de modification (décision du 27/10/2026) : toujours autorisé pour l'instant.
export function autoriserModification(action, regle) { return { autorise: true, code_valide: null, action, regle: regle && regle.id }; }

function nextId(J) { return "R-" + String(Math.max(0, ...J.rules.map((r) => +r.id.slice(2))) + 1).padStart(3, "0"); }
const VALS = { categorie: Object.keys(CATS), certitude: Object.keys(CERTS), statut: Object.keys(STATUTS), si_doute: ["bloquer", "avertir"] };
function clean(patch) {
  const p = {}, bad = [];
  for (const [k, v] of Object.entries(patch || {})) {
    if (!CHAMPS.includes(k)) { bad.push(k); continue; }
    if (VALS[k] && !VALS[k].includes(v)) throw new Error(`Valeur « ${v} » impossible pour ${k} (${VALS[k].join(", ")})`);
    p[k] = v;
  }
  if (bad.length) throw new Error("Champs inconnus : " + bad.join(", "));
  return p;
}
// proposition = { op, id, titre, avant, apres, champs, motif } ; rien n'est appliqué
// op : modifier (id, patch) | ajouter (rule) | archiver (id) | restaurer (id)
export function propose(J, { op, id, patch, rule, motif = "" }) {
  if (!["modifier", "ajouter", "archiver", "restaurer"].includes(op)) throw new Error(`Opération inconnue : ${op}`);
  if (!String(motif).trim()) throw new Error("Motif manquant : dire pourquoi la règle change");
  if (op === "ajouter") {
    const p = clean(rule);
    if (!p.titre || !p.description || !p.categorie) throw new Error("Une règle nouvelle a besoin d'un titre, d'une catégorie et d'une description");
    const nid = nextId(J);
    // une règle sans source reste brouillon (règle 6 du journal)
    const apres = { id: nid, titre: "", categorie: "", description: "", details: [], condition: "", action: "", parametres: {}, parametres_texte: "",
      certitude: "supposee", si_doute: "avertir", statut: p.source ? "a_valider" : "brouillon", source: "", note: "", precise: "", questions_liees: [],
      noeud: `chantier/${p.categorie}/${nid}`, depends_on: [], choix: null, preuves: [], version: 1, ...p };
    return { op, id: nid, titre: apres.titre, avant: null, apres, champs: Object.keys(p), motif };
  }
  const r = ruleById(J, id);
  if (!r) throw new Error(`Règle introuvable : ${id}`);
  let p;
  if (op === "archiver") { if (r.statut === "archivee") throw new Error(`${id} est déjà archivée`); p = { statut: "archivee" }; }
  else if (op === "restaurer") { if (r.statut !== "archivee") throw new Error(`${id} n'est pas archivée`); p = { statut: "a_valider" }; }
  else p = clean(patch);
  if (p.parametres) p.parametres = { ...(r.parametres || {}), ...p.parametres };
  const champs = Object.keys(p).filter((k) => JSON.stringify(r[k]) !== JSON.stringify(p[k]));
  if (!champs.length) throw new Error(`Rien ne change dans ${id}`);
  const avant = {}, apres = {};
  champs.forEach((k) => { avant[k] = r[k]; apres[k] = p[k]; });
  return { op, id, titre: r.titre, avant, apres, champs, motif };
}
const show = (v) => (v == null ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));
const brief = (o, champs) => (o ? champs.map((k) => `${k} : ${show(o[k])}`).join(" ; ") : "—");
// applique une proposition validée : version + 1, entrée d'historique, enregistrement
export function apply(J, prop, { par = "IA (validée par Kévin)" } = {}) {
  const r0 = prop.op === "ajouter" ? null : ruleById(J, prop.id);
  const auth = autoriserModification(prop.op, r0 || prop.apres);
  if (!auth.autorise) throw new Error("Modification refusée (code)");
  const J2 = clone(J), d = today();
  if (prop.op === "ajouter") {
    if (ruleById(J2, prop.id)) prop = { ...prop, id: nextId(J2), apres: { ...prop.apres, id: nextId(J2) } };
    J2.rules.push({ ...prop.apres, cree_le: d, modifie_le: d, modifie_par: par });
  } else {
    const r = ruleById(J2, prop.id);
    Object.assign(r, prop.apres, { version: (r.version || 1) + 1, modifie_le: d, modifie_par: par });
  }
  const n = Math.max(0, ...J2.history.map((h) => +h.id.slice(2))) + 1;
  const h = { id: "H-" + String(n).padStart(3, "0"), date: frDate(d), regle: prop.id, action: { modifier: "Modification", ajouter: "Création", archiver: "Archivage", restaurer: "Restauration" }[prop.op],
    avant: prop.op === "ajouter" ? "—" : brief(prop.avant, prop.champs), apres: prop.op === "ajouter" ? `${prop.apres.titre} (${prop.apres.statut})` : brief(prop.apres, prop.champs),
    motif: prop.motif, par, code_valide: auth.code_valide, local: true };
  J2.history.push(h);
  write(J2);
  return { journal: J2, entry: h };
}

// ---------- export / import ----------
export function exportJournal(J) { return JSON.stringify({ okteo: "journal-regles", ...J }, null, 1); }
export function importJournal(text) {
  let o; try { o = typeof text === "string" ? JSON.parse(text) : text; } catch { throw new Error("Fichier illisible (JSON attendu)"); }
  if (!o || !Array.isArray(o.rules) || !Array.isArray(o.history) || !o.rules.every((r) => /^R-\d{3}$/.test(r.id) && r.titre)) throw new Error("Ce fichier n'est pas un journal des règles d'Oktéo");
  const auth = autoriserModification("importer", null);
  if (!auth.autorise) throw new Error("Import refusé (code)");
  const J = { version: o.version || REGLES_BASE.version, base: REGLES_BASE.version, rules: o.rules, questions: o.questions || clone(REGLES_BASE.questions), history: o.history };
  // marquer l'import et rendre les règles « locales » (elles survivent à une nouvelle base)
  const n = Math.max(0, ...J.history.map((h) => +h.id.slice(2))) + 1;
  J.history.push({ id: "H-" + String(n).padStart(3, "0"), date: frDate(today()), regle: J.rules.map((r) => r.id).join(", "), action: "Import", avant: "—", apres: `${J.rules.length} règles`, motif: "Journal importé", par: "Kévin", code_valide: auth.code_valide, local: true });
  return write(J);
}
export function resetJournal() { try { localStorage.removeItem(KEY); } catch { /* */ } return write(getJournal()); }

// résumé compact pour l'assistant
export function journalForAI(J) {
  return J.rules.map((r) => `${r.id} | ${r.categorie} | ${r.statut}/${r.certitude}/${r.si_doute} | ${r.titre} | ${r.description.replace(/\s+/g, " ").slice(0, 260)}${Object.keys(r.parametres || {}).length ? " | paramètres " + JSON.stringify(r.parametres) : ""}`).join("\n");
}
