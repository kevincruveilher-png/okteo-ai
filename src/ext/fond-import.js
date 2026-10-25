// Import d'un fond de plan : PDF (page au choix) ou image (JPG, PNG…).
// Le PDF est rendu en image haute définition pour l'affichage ; le PDF d'origine est conservé à part
// (il servira au relevé automatique des murs, qui lira ses traits vectoriels).

let lib = null;
export async function pdfjs() {
  if (lib) return lib;
  lib = await import("pdfjs-dist");
  const w = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  lib.GlobalWorkerOptions.workerSrc = w.default;
  return lib;
}

export const isPdf = (file) => /pdf$/i.test(file.type) || /\.pdf$/i.test(file.name);
export const isImage = (file) => /^image\//i.test(file.type) || /\.(jpe?g|png|webp|bmp|gif)$/i.test(file.name);

export async function openPdf(file) {
  const L = await pdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  return L.getDocument({ data }).promise;
}

const toBlob = (canvas, q = 0.9) => new Promise((res) => canvas.toBlob(res, "image/jpeg", q));

// Vignettes de toutes les pages (pour choisir la bonne page du plan)
export async function pdfThumbs(doc, width = 220) {
  const out = [];
  for (let i = 1; i <= Math.min(doc.numPages, 30); i++) {
    const page = await doc.getPage(i);
    const vp1 = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: width / vp1.width });
    const c = document.createElement("canvas"); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: g, viewport: vp }).promise;
    out.push({ page: i, url: c.toDataURL("image/jpeg", 0.75), wPt: vp1.width, hPt: vp1.height });
  }
  return out;
}

// Rendu haute définition d'une page : côté le plus long ≈ maxPx pixels
export async function renderPdfPage(doc, pageNo, maxPx = 4500) {
  const page = await doc.getPage(pageNo);
  const vp1 = page.getViewport({ scale: 1 });
  const scale = Math.min(8, maxPx / Math.max(vp1.width, vp1.height));
  const vp = page.getViewport({ scale });
  const c = document.createElement("canvas"); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
  const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: g, viewport: vp }).promise;
  const blob = await toBlob(c, 0.9);
  // Taille physique de la page : sert d'échelle provisoire (1:50 supposé) avant la vraie mise à l'échelle
  const mmW = vp1.width / 72 * 25.4;
  return { blob, pxW: c.width, pxH: c.height, provisionalW: (mmW / 1000) * 50 };
}

// Image : on la garde telle quelle (ré-encodée en JPEG si elle est énorme)
export async function loadImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error("Image illisible")); img.src = url; });
    let blob = file, pxW = img.naturalWidth, pxH = img.naturalHeight;
    if (Math.max(pxW, pxH) > 6000 || file.size > 12e6) {
      const k = 6000 / Math.max(pxW, pxH);
      const c = document.createElement("canvas"); c.width = Math.round(pxW * k); c.height = Math.round(pxH * k);
      const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      blob = await toBlob(c, 0.9); pxW = c.width; pxH = c.height;
    }
    return { blob, pxW, pxH, provisionalW: 20 };
  } finally { URL.revokeObjectURL(url); }
}
