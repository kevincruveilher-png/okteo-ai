import {readHistory} from "../web/history.js";
// Fichier d'échange .okteo (JSON : chantier, dessin, fond image + PDF d'origine en data URL).
// Partagé par la page Chantiers (bouton « Fichier »), la sauvegarde automatique et l'alerte d'enregistrement.
import * as CHS from "../chantiers.js";

export const blobToDataURL = (b) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(fr.error || new Error("Lecture de ressource impossible")); fr.readAsDataURL(b); });
export const dataURLToBlob = async (u) => (await fetch(u)).blob();
export const fileName = (c) => `${c.nom}${c.numero ? "_" + c.numero : ""}.okteo`.replace(/[\\/:*?"<>|]+/g, "_");

// live = données du dessin ouvert (api.packData()) : prioritaires sur la copie du navigateur, qui peut avoir échoué
export async function buildOkteo(c, live = null) {
  const out = { format: "okteo-chantier", version: 2, history: readHistory(c.id), ruleSnapshot: c.ruleSnapshot || globalThis.okteoPinned || null, application: {version:"0.72.0"}, exporte: new Date().toISOString(), chantier: { ...c, key: undefined }, dessin: live || CHS.readData(c), fond: null };
  if (c.fond) {
    out.fond = { ...c.fond };
    if (c.fond.src === "asset" && c.fond.url) { const r = await fetch(c.fond.url); if (!r.ok) throw new Error("Fond de démonstration indisponible"); out.fond.image = await blobToDataURL(await r.blob()); out.fond.src = "idb"; }
    if (c.fond.src === "idb") {
      const f = await CHS.getFile(CHS.fondKey(c)); if (!f) throw new Error("Image du fond absente : réimportez le PDF avant export."); if (f) out.fond.image = await blobToDataURL(f);
      const p = await CHS.getFile(CHS.pdfKey(c)); if (c.fond.page && !p) throw new Error("PDF source absent : réimportez-le avant export."); if (p) out.fond.pdf = await blobToDataURL(p);
    }
  }
  // fonds des autres niveaux
  out.fonds = {};
  for (const l of CHS.levelsOf(c)) {
    if (l.id === (c.level || "rdc") || !l.fond || l.fond.src !== "idb") continue;
    const F = {}, f = await CHS.getFile(CHS.fondKey(c, l.id)).catch(() => null), p = await CHS.getFile(CHS.pdfKey(c, l.id)).catch(() => null);
    if (!f || (l.fond.page && !p)) throw new Error("Ressources absentes pour le niveau " + l.name);
    if (f) F.image = await blobToDataURL(f); if (p) F.pdf = await blobToDataURL(p);
    out.fonds[l.id] = F;
  }
  return new Blob([JSON.stringify(out)], { type: "application/json" });
}

export function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
