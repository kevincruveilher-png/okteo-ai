// Code barre de la feuille de boîte (v47) : Code 128 (jeu B, caractères imprimables), encodé par jsbarcode (chargé à
// la demande), dessiné par nous en barres (SVG pour l'écran, rectangles pour le PDF).
// Contenu : n° d'affaire (ou identifiant du chantier) + nom de la boîte, ex. « 04949-LI01 » — stable d'une impression à
// l'autre ; à quoi il renverra au scan reste à décider.
let Enc = null;
export async function code128(text) {
  if (!Enc) { const m = await import("jsbarcode/bin/barcodes/CODE128/CODE128B.js"); Enc = m.default || m; }
  const e = new Enc(String(text), {});
  if (!e.valid()) throw new Error("code barre impossible pour « " + text + " »");
  return e.encode().data;     // « 1101001… » : 1 = barre d'un module
}
export const boxCode = (ch, box) => `${ch.numero || ch.id || "OKTEO"}-${box.n}`.replace(/[^\x20-\x7e]/g, "").slice(0, 40);

// barres regroupées : [[début, largeur]…] en modules
export function bars(bits) {
  const out = [];
  for (let i = 0; i < bits.length;) {
    if (bits[i] !== "1") { i++; continue; }
    let j = i; while (bits[j] === "1") j++;
    out.push([i, j - i]); i = j;
  }
  return out;
}
export function barsSVG(bits, text, { mod = 2, h = 54 } = {}) {
  const q = 10 * mod, W = bits.length * mod + 2 * q;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${h + 18}" width="${W}" height="${h + 18}" class="barcode"><rect width="${W}" height="${h + 18}" fill="#fff"/>`
    + bars(bits).map(([x, w]) => `<rect x="${q + x * mod}" y="0" width="${w * mod}" height="${h}" fill="#000"/>`).join("")
    + `<text x="${W / 2}" y="${h + 14}" text-anchor="middle" font-family="monospace" font-size="13">${String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text></svg>`;
}
