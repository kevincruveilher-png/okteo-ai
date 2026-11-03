// v76 étape 2 : source du plan pour la lecture fine (tuiles, zooms) et rendu de régions.
// - PDF vectoriel : la région est rendue de nouveau par pdf.js depuis les données vectorielles (vraie haute définition).
// - Scan (PDF sans traits) ou image : la région est découpée dans les pixels du fond (JPEG rendu à l'import, ~4 500 px),
//   sans agrandissement : agrandir ne recrée pas les détails perdus.
// Repère : pixels du fond (iw × ih) ; srcMap = pixels du fond → mètres (fond posé en f.x, f.y, f.w × f.h).
// Le PDF et le fond viennent de la même page (fond-import.js renderPdfPage) : 1 pixel du fond = (vp1.width / iw)
// unités de la page à l'échelle 1, rotation de page comprise (même viewport).
import * as CHS from "../chantiers.js";
import { pdfjs } from "./fond-import.js";
import { isScanned } from "./pdf-page.js";
import { fitSize, regionMap } from "../walls/ai-tiles.js";

const loadImg = (url) => new Promise((res, rej) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = () => rej(new Error("image du fond illisible")); i.src = url; });

// bords du dessin (marges blanches retirées), en pixels du fond — même règle que le relevé standard (ai-releve.js)
function drawingBox(img) {
  const iw = img.naturalWidth, ih = img.naturalHeight, sw = Math.min(800, iw), sh = Math.round(ih * sw / iw), c = document.createElement("canvas");
  c.width = sw; c.height = sh;
  const g = c.getContext("2d"); g.drawImage(img, 0, 0, sw, sh);
  const px = g.getImageData(0, 0, sw, sh).data;
  let x0 = sw, y0 = sh, x1 = 0, y1 = 0;
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) { const i = (y * sw + x) * 4; if (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2] < 215) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  if (x1 <= x0 || y1 <= y0) return { x: 0, y: 0, w: iw, h: ih };
  const k = iw / sw, m = 0.02 * Math.max(sw, sh);
  const bx = Math.max(0, (x0 - m) * k), by = Math.max(0, (y0 - m) * k);
  return { x: bx, y: by, w: Math.min(iw, (x1 + m) * k) - bx, h: Math.min(ih, (y1 + m) * k) - by };
}

const jpeg = (c, q = 0.9) => c.toDataURL("image/jpeg", q).split(",")[1];

export async function planSource(api) {
  const f = await api.levelFond(api.level.id);
  if (!f) throw new Error("pas de fond de plan sur ce niveau");
  const img = await loadImg(f.url), iw = img.naturalWidth, ih = img.naturalHeight;
  const srcMap = { x0: f.x, y0: f.y, sx: f.w / iw, sy: f.h / ih };
  let page = null, vp1 = null, kind = "raster";
  const ch = api.ch, blob = ch.fond && ch.fond.page ? await CHS.getFile(CHS.pdfKey(ch)).catch(() => null) : null;
  if (blob) {
    try {
      const L = await pdfjs(), doc = await L.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
      page = await doc.getPage(ch.fond.page || 1); vp1 = page.getViewport({ scale: 1 });
      // même rapport largeur / hauteur que le fond : sinon le fond ne vient pas de cette page, on reste sur les pixels
      if (Math.abs(vp1.width / vp1.height - iw / ih) > 0.01) page = null;
      else if (!(await isScanned(api))) kind = "vector";
    } catch { page = null; }
  }
  const box = drawingBox(img);
  const s0 = vp1 ? iw / vp1.width : 1;   // pixels du fond par unité de page

  // rendu d'une région (pixels du fond) : { canvas, data (JPEG base64), W, H, map, kind, native }
  async function render(region, { maxSide, maxPixels, minSide = 0 } = {}) {
    const r = { x: Math.max(0, region.x), y: Math.max(0, region.y), w: Math.min(iw - Math.max(0, region.x), region.w), h: Math.min(ih - Math.max(0, region.y), region.h) };
    // vectoriel : jusqu'à 8 × l'échelle de la page ; pixels : jamais plus que la source, sauf `minSide` (petits zooms d'un
    // scan, agrandis pour rester lisibles par l'API — sans détail ajouté, et dit comme tel dans la consigne)
    const vec = kind === "vector" && page;
    let { W, H, k } = fitSize(r.w, r.h, { maxSide, maxPixels, upscale: vec ? Math.max(1, 8 / s0) : 1 });
    let upscaled = false;
    if (!vec && minSide && Math.min(W, H) < minSide) { const kk = minSide / Math.min(r.w, r.h); W = Math.round(r.w * kk); H = Math.round(r.h * kk); k = W / r.w; upscaled = kk > 1; }
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
    if (vec) {
      const sc = k * s0, vp = page.getViewport({ scale: sc, offsetX: -(r.x / s0) * sc, offsetY: -(r.y / s0) * sc });
      await page.render({ canvasContext: g, viewport: vp }).promise;
    } else g.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, W, H);
    return { canvas: c, data: jpeg(c), W, H, map: regionMap(srcMap, r, W, H), region: r, kind: vec ? "vector" : "raster", upscaled };
  }
  return { kind, iw, ih, srcMap, box, img, page, vp1, s0, render, fond: f };
}
