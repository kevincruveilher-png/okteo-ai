// v76 étape 3 : mode 3 « Plan dégradé » — préparation des tuiles d'un plan RASTER (scan, image) avant leur lecture :
// - OpenCV.js (Apache 2.0, servi depuis /vendor/opencv) : redressement (angle du plan entier, ±5° au plus, appliqué
//   seulement au-delà de 0,3°), contraste local (CLAHE, doux), réduction du bruit (médian 3 × 3). Pas de seuillage ni
//   d'érosion : rien qui déforme un symbole. L'image d'origine est toujours envoyée AVANT la copie nettoyée.
// - Tesseract.js (Apache 2.0, moteur et données « fra » servis depuis /vendor/ocr) : textes (noms de pièces, repères,
//   LL, LV, 32A…) avec position et confiance, lus sur l'image d'ORIGINE et sur la copie NETTOYÉE puis comparés (un
//   nettoyage peut abîmer les petits caractères). L'OCR lit le texte, pas les symboles électriques.
// Les PDF vectoriels lisibles ne passent jamais par ici (ai-modes-run.js) : leurs textes viennent du PDF lui-même.
// Repères : les positions OCR sont données dans l'image nettoyée (celle où Claude donne ses coordonnées) ; Oktéo ramène
// ensuite les points de Claude dans l'image d'origine (ai-tiles.js unrotate) avant la conversion en mètres.
const OCV = "/vendor/opencv/opencv.js";
const OCR = { workerPath: "/vendor/ocr/worker.min.js", corePath: "/vendor/ocr/core", langPath: "/vendor/ocr/lang" };
let cvP = null;
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
// aucune étape ne doit bloquer l'analyse : chaque attente a un délai, et l'étape en cours est connue (diagnostic)
export const rasterState = { stage: "" };
function within(p, ms, what) {
  rasterState.stage = what;
  console.info("[okteo mode 3] " + what);   // visible dans la console (et dans les vérifications automatiques)
  let t = 0;
  return Promise.race([p, new Promise((_, no) => { t = setTimeout(() => no(new Error(what + " : délai dépassé (" + Math.round(ms / 1000) + " s)")), ms); })]).finally(() => clearTimeout(t));
}

// OpenCV.js : script chargé une fois ; on attend que `cv.Mat` existe (ne jamais faire `await cv` : l'objet du module
// est « thenable » et se résout sur lui-même)
export function loadCv(timeout = 90000) {
  if (cvP) return cvP;
  cvP = new Promise((res, rej) => {
    const ready = async () => { const t0 = Date.now(); while (!(window.cv && window.cv.Mat)) { if (Date.now() - t0 > timeout) return rej(new Error("OpenCV.js ne démarre pas")); await sleep(100); } res(window.cv); };
    if (window.cv && window.cv.Mat) return res(window.cv);
    const s = document.createElement("script"); s.src = OCV; s.async = true;
    s.onload = ready; s.onerror = () => rej(new Error("OpenCV.js introuvable (" + OCV + ")"));
    document.head.appendChild(s);
  });
  cvP.catch(() => { cvP = null; });
  return cvP;
}

// angle du plan (degrés, sens horaire positif dans l'image) : médiane des écarts des longs traits presque horizontaux
// ou verticaux (murs, cadres) ; 0 s'il n'y a pas assez de traits
export function skewAngle(cv, canvas) {
  const src = cv.imread(canvas), g = new cv.Mat(), e = new cv.Mat(), L = new cv.Mat();
  try {
    cv.cvtColor(src, g, cv.COLOR_RGBA2GRAY); cv.Canny(g, e, 50, 150);
    const minLen = Math.max(40, Math.min(canvas.width, canvas.height) / 12);
    cv.HoughLinesP(e, L, 1, Math.PI / 720, 80, minLen, 6);
    const a = [];
    for (let i = 0; i < L.rows; i++) {
      const [x1, y1, x2, y2] = [L.data32S[i * 4], L.data32S[i * 4 + 1], L.data32S[i * 4 + 2], L.data32S[i * 4 + 3]];
      let d = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
      d = ((d + 45) % 90 + 90) % 90 - 45;           // écart à l'horizontale ou à la verticale la plus proche
      if (Math.abs(d) <= 5) a.push(d);
    }
    if (a.length < 8) return 0;
    a.sort((p, q) => p - q);
    return a[Math.floor(a.length / 2)];
  } finally { src.delete(); g.delete(); e.delete(); L.delete(); }
}

// copie nettoyée d'une tuile : redressée de `rot` degrés autour de son centre, contraste local, bruit réduit
export function cleanTile(cv, canvas, rot) {
  const src = cv.imread(canvas), g = new cv.Mat(), r = new cv.Mat(), c = new cv.Mat(), d = new cv.Mat();
  try {
    cv.cvtColor(src, g, cv.COLOR_RGBA2GRAY);
    if (rot) {
      const M = cv.getRotationMatrix2D(new cv.Point(canvas.width / 2, canvas.height / 2), rot, 1);
      cv.warpAffine(g, r, M, new cv.Size(canvas.width, canvas.height), cv.INTER_CUBIC, cv.BORDER_CONSTANT, new cv.Scalar(255));
      M.delete();
    } else g.copyTo(r);
    const cl = new cv.CLAHE(2.0, new cv.Size(8, 8)); cl.apply(r, c); cl.delete();
    cv.medianBlur(c, d, 3);
    const out = document.createElement("canvas"); out.width = canvas.width; out.height = canvas.height;
    cv.imshow(out, d);
    return out;
  } finally { src.delete(); g.delete(); r.delete(); c.delete(); d.delete(); }
}

// mots d'un résultat Tesseract (v5 : data.words ; sinon blocs → paragraphes → lignes → mots)
function wordsOf(data) {
  if (data && Array.isArray(data.words) && data.words.length) return data.words;
  const out = [];
  for (const b of (data && data.blocks) || []) for (const p of b.paragraphs || []) for (const l of p.lines || []) out.push(...(l.words || []));
  return out;
}
// point (u, v) de l'image d'origine → image redressée de `rot` (sens inverse de ai-tiles.js unrotate)
const rotate = (u, v, deg, W, H) => { const a = -deg * Math.PI / 180, cx = W / 2, cy = H / 2, dx = u - cx, dy = v - cy; return { x: cx + dx * Math.cos(a) - dy * Math.sin(a), y: cy + dx * Math.sin(a) + dy * Math.cos(a) }; };
const norm = (s) => String(s || "").trim().toUpperCase().replace(/[^0-9A-ZÀ-Ü:.,/-]/g, "");

// comparaison des deux lectures OCR (positions déjà dans l'image nettoyée) : même texte à moins de 15 px = « both »
// (confiance la plus haute) ; sinon chaque mot garde sa source ; confiance < 30 % écartée
export function mergeOcr(orig, net, { minConf = 30, tol = 15 } = {}) {
  const A = orig.filter((w) => w.conf >= minConf), B = net.filter((w) => w.conf >= minConf), used = new Set(), out = [];
  for (const a of A) {
    const j = B.findIndex((b, k) => !used.has(k) && norm(b.text) === norm(a.text) && Math.hypot(b.x - a.x, b.y - a.y) <= tol);
    if (j >= 0) { used.add(j); out.push({ ...a, conf: Math.max(a.conf, B[j].conf), src: "both" }); }
    else out.push({ ...a, src: "orig" });
  }
  B.forEach((b, k) => { if (!used.has(k)) out.push({ ...b, src: "net" }); });
  return out.filter((w) => norm(w.text).length > 0).sort((p, q) => q.conf - p.conf);
}

export async function createRaster({ ocr = true } = {}) {
  const errors = [];
  let cv = null, worker = null, rot = null;
  try { cv = await within(loadCv(), 120000, "chargement d'OpenCV.js"); } catch (e) { errors.push(e.message); }
  if (ocr) {
    try {
      const T = await within(import("tesseract.js"), 30000, "chargement de Tesseract.js");
      worker = await within(T.createWorker("fra", 1, { ...OCR, workerBlobURL: false, gzip: true, errorHandler: (e) => errors.push("OCR : " + (e && e.message || e)) }), 90000, "démarrage de l'OCR (moteur et langue fra)");
      await within(worker.setParameters({ tessedit_pageseg_mode: "11", preserve_interword_spaces: "1" }), 15000, "réglage de l'OCR");   // texte épars
    } catch (e) { errors.push("OCR indisponible : " + (e.message || e)); worker = null; }
  }
  const read = async (canvas, toNet) => {
    if (!worker) return [];
    const { data } = await within(worker.recognize(canvas), 60000, "lecture OCR d'une tuile");
    return wordsOf(data).map((w) => { const b = w.bbox || {}, c = toNet((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2); return { text: String(w.text || "").trim(), x: c.x, y: c.y, w: (b.x1 - b.x0) || 0, h: (b.y1 - b.y0) || 0, conf: +w.confidence || 0 }; }).filter((w) => w.text);
  };
  // R = rendu d'une tuile (ai-render.js) → { images (JPEG base64, origine puis nettoyée), rot, ocr, cleaned }
  async function prepare(R) {
    const W = R.W, H = R.H;
    if (!cv) { const o = await read(R.canvas, (x, y) => ({ x, y })).catch(() => []); return { images: [R.data], rot: 0, ocr: mergeOcr(o, []), cleaned: false }; }
    // angle mesuré une fois sur la première tuile qui a assez de traits, puis réutilisé (même angle pour tout le plan)
    if (rot == null) { const a = skewAngle(cv, R.canvas); if (a) rot = Math.abs(a) >= 0.3 ? a : 0; }
    const deg = rot || 0, C = cleanTile(cv, R.canvas, deg);
    rasterState.stage = "nettoyage d'une tuile";
    const o = await read(R.canvas, (x, y) => rotate(x, y, deg, W, H)).catch((e) => { errors.push(e.message); return []; }), n = await read(C, (x, y) => ({ x, y })).catch((e) => { errors.push(e.message); return []; });
    return { images: [R.data, C.toDataURL("image/jpeg", 0.9).split(",")[1]], rot: deg, ocr: mergeOcr(o, n), cleaned: true };
  }
  async function close() { try { if (worker) await within(worker.terminate(), 10000, "arrêt de l'OCR"); } catch { /* déjà arrêté */ } rasterState.stage = ""; }
  return { prepare, close, errors, get angle() { return rot || 0; }, get ok() { return !!cv; } };
}
