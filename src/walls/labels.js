// Textes d'une page PDF → étiquettes de pièces placées en mètres (même repère que le fond).
// On ne garde que les textes nettement plus grands que la moyenne (noms de pièces), puis decodeLabels les lit
// (texte lisible, ou police codée décodée par la forme des mots).
import { decodeLabels } from "./rooms.js";

export async function pageLabels(page, { k, ox = 0, oy = 0 }) {
  const vp = page.getViewport({ scale: 1 });
  const tc = await page.getTextContent();
  const items = tc.items.filter((i) => i.str && i.str.trim()).map((i) => {
    const [x, y] = vp.convertToViewportPoint(i.transform[4], i.transform[5]);
    const size = Math.hypot(i.transform[2], i.transform[3]);
    // point de référence : milieu du mot, à mi-hauteur des lettres
    return { str: i.str, font: i.fontName, size, x: ox + (x + (i.width || 0) / 2) * k, y: oy + (y - size * 0.35) * k };
  });
  if (!items.length) return [];
  const sizes = items.map((i) => i.size).sort((a, b) => a - b);
  const med = sizes[Math.floor(sizes.length / 2)];
  return decodeLabels(items.filter((i) => i.size >= med * 1.3));
}
