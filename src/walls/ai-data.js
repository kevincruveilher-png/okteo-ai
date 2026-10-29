// Données de lecture v68 : partagées par conversion, API et relecture. Aucun moteur de câblage ici.
export const AI_SYSTEM = "Tu es dessinateur au bureau d'études électricité d'un fabricant de pieuvres électriques pour maisons individuelles. Tu relèves des plans avec précision et tu réponds uniquement en JSON.";
export const UNKNOWN_TYPE = "INCONNU";
const clean = (v) => typeof v === "string" ? v.trim() : "";
// Ne copie que les champs documentés : aucune donnée du fournisseur ne devient une propriété arbitraire du modèle.
export function readingData(d = {}) {
  const out = {};
  if (d.qty === null) { out.qty = null; out.aiStatus = "a_confirmer"; }
  else if (Number.isInteger(d.qty) && d.qty > 0) out.qty = d.qty;
  if (Number.isFinite(d.calibre) && d.calibre > 0) out.calibre = d.calibre;
  else { const m = /\b(16|20|32)\s*A\b/i.exec(clean(d.inscription)); if (m) out.calibre = +m[1]; }
  for (const k of ["inscription", "aiType", "aiGroup", "aiNote"]) if (clean(d[k])) out[k] = clean(d[k]);
  if (["lu", "a_identifier", "a_confirmer"].includes(d.aiStatus)) out.aiStatus = d.aiStatus;
  if (["plan", "interpretation", "regle"].includes(d.aiOrigin)) out.aiOrigin = d.aiOrigin;
  if (d.aiReading && typeof d.aiReading === "object") out.aiReading = JSON.parse(JSON.stringify(d.aiReading));
  if (d.commande && typeof d.commande === "object") {
    const c = d.commande, preuve = clean(c.preuve);
    out.commande = {
      mode: ["manuelle", "detecteur"].includes(c.mode) && preuve ? c.mode : "inconnue",
      detecteur: ["integre", "separe"].includes(c.detecteur) && preuve ? c.detecteur : "inconnu",
      alimentation: ["permanente", "commandee"].includes(c.alimentation) && preuve ? c.alimentation : "inconnue",
      preuve,
    };
  }
  return out;
}
export function validateReleve(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Le relevé doit être un objet JSON.");
  for (const k of ["murs", "ouvertures", "pieces", "appareils", "liaisons"])
    if (k in raw && !Array.isArray(raw[k])) throw new Error(`Rubrique ${k} : une liste est attendue.`);
  for (const [i, d] of (raw.appareils || []).entries()) {
    if (!d || !Number.isFinite(+d.x) || !Number.isFinite(+d.y) || d.x == null || d.y == null || d.x === "" || d.y === "")
      throw new Error(`Appareil ${i + 1} : position absente ou invalide ; import annulé.`);
    if ("qty" in d && d.qty !== null && !(Number.isInteger(d.qty) && d.qty > 0)) throw new Error(`Appareil ${i + 1} : quantité invalide.`);
    if ("calibre" in d && !(Number.isFinite(d.calibre) && d.calibre > 0)) throw new Error(`Appareil ${i + 1} : calibre invalide.`);
  }
  return raw;
}
