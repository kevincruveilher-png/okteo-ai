// Lot 8 (06/11/2026, fiche CH-08) — lien vers le dossier SharePoint de l'affaire, construit d'après le n° d'affaire.
// Le modèle d'adresse est un réglage du poste (Paramètres → Chantier) : aucune adresse de l'entreprise dans le dépôt.
// {affaire} est remplacé par le n° d'affaire ; sans {affaire}, le n° est ajouté à la fin.
export function sharepointUrl(tpl, affaire) {
  const t = String(tpl || "").trim(), n = String(affaire || "").trim();
  if (!t || !n || !/^https:\/\/[^\s/]+\.[^\s/]+/i.test(t)) return "";
  const v = encodeURIComponent(n);
  return t.includes("{affaire}") ? t.split("{affaire}").join(v) : t.replace(/\/?$/, "/") + v;
}
export const sharepointOk = (tpl) => !String(tpl || "").trim() || /^https:\/\/[^\s/]+\.[^\s/]+/i.test(String(tpl).trim());
