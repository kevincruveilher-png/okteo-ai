// v76 : mesures du plan pour la recommandation de mode (ai-modes.js recommend) : sur une copie réduite du fond
// (≤ 1 000 px), sans IA ni réseau. Vectoriel ou scan (isScanned), définition (pixels du fond par mètre réel), contraste
// (luminosité 95e − 2e centile), inclinaison (profil de projection des points d'encre, ±4° par pas de 0,25°), bruit (part
// des points d'encre isolés), densité (part d'encre ; nombre de formes pour un PDF vectoriel), autres documents.
import { isScanned, chantierPage } from "./pdf-page.js";
import { otherPages } from "./ai-cross.js";
import { recommend } from "../walls/ai-modes.js";
import { imageStats } from "../walls/ai-stats.js";

const loadImg = (url) => new Promise((res, rej) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = () => rej(new Error("image du fond illisible")); i.src = url; });

export async function planStats(api) {
  const f = await api.levelFond(api.level.id);
  if (!f) return null;
  const img = await loadImg(f.url), iw = img.naturalWidth, ih = img.naturalHeight, k = Math.min(1, 1000 / Math.max(iw, ih));
  const w = Math.max(1, Math.round(iw * k)), h = Math.max(1, Math.round(ih * k)), c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data, gray = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) gray[i] = Math.round(0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]);
  const P = await chantierPage(api).catch(() => null), vector = !!P && !(await isScanned(api).catch(() => true));
  const st = { kind: vector ? "vector" : "raster", pxPerM: f.w > 0 ? iw / f.w : null, ...imageStats(gray, w, h), docs: await otherPages(api).catch(() => 0) };
  if (vector) st.shapes = (P.shapes || []).length;
  return st;
}
export async function recommendFor(api) { const st = await planStats(api); return st ? { ...recommend(st), stats: st } : null; }
