// v76 étape 4 : mode 4 « Analyse approfondie » (pur, sans DOM) — seconde lecture complète et contrôle croisé du plan avec
// les autres documents du dossier (devis, plan cuisine, notices…), pour repérer les équipements oubliés.
// Sortie : une liste ciblée d'écarts à vérifier. Rien n'est ajouté au plan automatiquement : l'opérateur ou le BE décide.
import { AI_TYPES } from "./ai-plan.js";

// consigne de la seconde lecture : indépendante de la première, parcours pièce par pièce (autre chemin de lecture)
export const SECOND_METHOD = `SECONDE LECTURE INDÉPENDANTE du plan (une première lecture a déjà été faite ; ne cherche pas à la deviner) :
parcours le plan PIÈCE PAR PIÈCE (entrée, séjour, cuisine, chambres, salle de bain, WC, cellier, garage, extérieurs), et dans
chaque pièce fais le tour des murs, puis le plafond, puis les extérieurs proches. Relève chaque symbole électrique.`;

// pièce la plus proche d'un point (noms relevés par la lecture globale : nom + point dans la pièce ; approximatif)
function nearest(p, pieces) {
  let best = null, bd = Infinity;
  for (const r of pieces || []) { const d = Math.hypot(r.x - p.x, r.y - p.y); if (d < bd) { bd = d; best = r; } }
  return best ? best.name : "";
}
// décompte du plan par type, et par pièce (pièce = nom relevé le plus proche, approximatif)
export function planSummary(devices, pieces = []) {
  const byType = {}, byRoom = {};
  for (const d of devices || []) {
    byType[d.t] = (byType[d.t] || 0) + (Number.isInteger(d.qty) && d.qty > 1 ? d.qty : 1);
    const r = nearest(d, pieces) || "?";
    (byRoom[r] ||= {})[d.t] = (byRoom[r][d.t] || 0) + 1;
  }
  return { byType, byRoom };
}
export function summaryText(S) {
  const name = (t) => `${t} (${AI_TYPES[t] || t})`;
  const types = Object.entries(S.byType).sort((a, b) => b[1] - a[1]).map(([t, n]) => `- ${name(t)} : ${n}`).join("\n");
  const rooms = Object.entries(S.byRoom).map(([r, m]) => `- ${r} : ${Object.entries(m).map(([t, n]) => `${t}×${n}`).join(", ")}`).join("\n");
  return `Décompte sur le plan, par type :\n${types || "- (aucun appareil)"}\nPar pièce (pièce la plus proche, approximatif) :\n${rooms || "- (aucune pièce nommée)"}`;
}

// consigne du contrôle croisé ; docs = [{ source, nature?, text?, image? }]
export function crossPrompt(summary, docs) {
  const parts = docs.map((d, i) => `### Document ${i + 1} — ${d.source}${d.text ? `\n${d.text}` : " (image jointe ci-dessus, dans l'ordre)"}`).join("\n\n");
  return `Contrôle croisé pour le bureau d'études : compare l'équipement électrique relevé sur le PLAN d'une maison avec les autres documents du dossier (devis, plan de cuisine, notices, descriptif…).

${summaryText(summary)}

Documents :
${parts}

Tâche : liste les équipements électriques ou besoins de raccordement MENTIONNÉS dans les documents qui MANQUENT sur le plan, ou dont la QUANTITÉ diffère (ex. four, plaque, hotte, lave-vaisselle, lave-linge, sèche-linge, réfrigérateur, congélateur, chauffe-eau, VMC, volets roulants, portail, prises supplémentaires, RJ45, TV, éclairage extérieur, borne de recharge…).
Règles :
- Seulement ce qui est écrit dans un document : cite la source (document et page) et un court extrait exact (moins de 15 mots).
- "type" : le code le plus proche parmi ${Object.keys(AI_TYPES).join(", ")} (ou "" si aucun).
- "qDoc" : quantité dans le document (nombre, ou null si non chiffrée) ; "qPlan" : quantité de ce type sur le plan d'après le décompte ci-dessus (0 si absent).
- Un équipement présent sur le plan en même quantité n'est PAS un écart. N'invente rien ; en cas de doute, dis-le dans "doute".
Réponds UNIQUEMENT avec ce JSON :
{"documents":[{"source":"…","nature":"devis|plan cuisine|notice|descriptif|autre"}],"ecarts":[{"equipement":"…","type":"LV","piece":"Cuisine","qDoc":1,"qPlan":0,"source":"document 1, page 2","extrait":"…","doute":""}],"remarques":"…"}`;
}

// réponse → écarts nettoyés (60 au plus) ; parseJson = parseAiJson de ai-plan.js
export function parseCross(raw) {
  const docs = Array.isArray(raw && raw.documents) ? raw.documents.map((d) => ({ source: String(d.source || "").slice(0, 120), nature: String(d.nature || "autre").slice(0, 40) })) : [];
  const list = (Array.isArray(raw && raw.ecarts) ? raw.ecarts : []).map((e) => ({
    equipement: String(e.equipement || "").slice(0, 120), t: AI_TYPES[String(e.type || "").toUpperCase()] ? String(e.type).toUpperCase() : "",
    piece: String(e.piece || "").slice(0, 60), qDoc: Number.isFinite(+e.qDoc) && e.qDoc !== null && e.qDoc !== "" ? +e.qDoc : null,
    qPlan: Number.isFinite(+e.qPlan) ? +e.qPlan : null, source: String(e.source || "").slice(0, 120),
    extrait: String(e.extrait || "").split(/\s+/).slice(0, 15).join(" "), doute: String(e.doute || "").slice(0, 200),
  })).filter((e) => e.equipement && !(e.qDoc != null && e.qPlan != null && e.qDoc === e.qPlan)).slice(0, 60);
  return { docs, list, remarques: String((raw && raw.remarques) || "").slice(0, 500) };
}

// documents disponibles → message si la partie doit être désactivée
export const CROSS_OFF = "aucun devis, plan cuisine ni autre document : ni autre page dans le PDF du chantier, ni document joint. Partie désactivée ; joignez-les sur l'écran « Analyse IA » (mode 4) pour l'activer.";
