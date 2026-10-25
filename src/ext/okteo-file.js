// Fichier d'échange .okteo (JSON : chantier, dessin, fond image + PDF d'origine en data URL).
// Partagé par la page Chantiers (bouton « Fichier »), la sauvegarde automatique et l'alerte d'enregistrement.
import * as CHS from "../chantiers.js";

export const blobToDataURL = (b) => new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); });
export const dataURLToBlob = async (u) => (await fetch(u)).blob();
export const fileName = (c) => `${c.nom}${c.numero ? "_" + c.numero : ""}.okteo`.replace(/[\\/:*?"<>|]+/g, "_");

// live = données du dessin ouvert (api.packData()) : prioritaires sur la copie du navigateur, qui peut avoir échoué
export async function buildOkteo(c, live = null) {
  const out = { format: "okteo-chantier", version: 1, exporte: new Date().toISOString(), chantier: { ...c, key: undefined }, dessin: live || CHS.readData(c), fond: null };
  if (c.fond) {
    out.fond = { ...c.fond };
    if (c.fond.src === "idb") {
      const f = await CHS.getFile(CHS.fondKey(c)); if (f) out.fond.image = await blobToDataURL(f);
      const p = await CHS.getFile(CHS.pdfKey(c)); if (p) out.fond.pdf = await blobToDataURL(p);
    }
  }
  // fonds des autres niveaux
  out.fonds = {};
  for (const l of CHS.levelsOf(c)) {
    if (l.id === (c.level || "rdc") || !l.fond || l.fond.src !== "idb") continue;
    const F = {}, f = await CHS.getFile(CHS.fondKey(c, l.id)).catch(() => null), p = await CHS.getFile(CHS.pdfKey(c, l.id)).catch(() => null);
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
