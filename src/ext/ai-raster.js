// v76 étape 3 : mode 3 « Plan dégradé » — préparation des tuiles d'un plan RASTER (scan, image) avant leur lecture :
// - OpenCV.js (Apache 2.0, servi depuis /vendor/opencv, exécuté dans un Web Worker : ai-cv-worker.js) : redressement (angle du plan entier, ±5° au plus, appliqué
//   seulement au-delà de 0,3°), contraste local (CLAHE, doux), réduction du bruit (médian 3 × 3). Pas de seuillage ni
//   d'érosion : rien qui déforme un symbole. L'image d'origine est toujours envoyée AVANT la copie nettoyée.
// - Tesseract.js (Apache 2.0, moteur et données « fra » servis depuis /vendor/ocr) : textes (noms de pièces, repères,
//   LL, LV, 32A…) avec position et confiance, lus sur l'image d'ORIGINE et sur la copie NETTOYÉE puis comparés (un
//   nettoyage peut abîmer les petits caractères). L'OCR lit le texte, pas les symboles électriques.
// Les PDF vectoriels lisibles ne passent jamais par ici (ai-modes-run.js) : leurs textes viennent du PDF lui-même.
// Repères : les positions OCR sont données dans l'image nettoyée (celle où Claude donne ses coordonnées) ; Oktéo ramène
// ensuite les points de Claude dans l'image d'origine (ai-tiles.js unrotate) avant la conversion en mètres.
const OCR = { workerPath: "/vendor/ocr/worker.min.js", corePath: "/vendor/ocr/core", langPath: "/vendor/ocr/lang" };
// aucune étape ne doit bloquer l'analyse : chaque attente a un délai, et l'étape en cours est connue (diagnostic)
export const rasterState = { stage: "" };
function within(p, ms, what) {
  rasterState.stage = what;
  console.info("[okteo mode 3] " + what);   // visible dans la console (et dans les vérifications automatiques)
  let t = 0;
  return Promise.race([p, new Promise((_, no) => { t = setTimeout(() => no(new Error(what + " : délai dépassé (" + Math.round(ms / 1000) + " s)")), ms); })]).finally(() => clearTimeout(t));
}

// OpenCV.js tourne dans un Web Worker (ai-cv-worker.js) : la page reste réactive pendant son chargement (10 Mo) et
// ses calculs ; s'il ne répond pas dans le délai, il est arrêté et l'analyse continue avec l'image d'origine.
function cvWorker() {
  let w = null, n = 0, dead = false;
  const wait = new Map();
  const start = () => {
    w = new Worker(new URL("./ai-cv-worker.js", import.meta.url));
    w.onmessage = (e) => { const d = e.data || {}, p = wait.get(d.id); if (!p) return; wait.delete(d.id); if (d.error) p.no(new Error(d.error)); else p.ok(d); };
    w.onerror = (e) => { dead = true; for (const p of wait.values()) p.no(new Error("OpenCV.js : " + (e.message || "erreur du worker"))); wait.clear(); };
  };
  const call = (op, data, ms, what) => {
    if (dead) return Promise.reject(new Error("OpenCV.js arrêté"));
    if (!w) start();
    const id = ++n, msg = { id, op, ...data };
    const p = new Promise((ok, no) => { wait.set(id, { ok, no }); w.postMessage(msg); });
    return within(p, ms, what).catch((e) => { if (/délai dépassé/.test(e.message)) { dead = true; w.terminate(); wait.clear(); } throw e; });
  };
  return { call, stop: () => { if (w) w.terminate(); dead = true; } };
}
const imageData = (canvas) => canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
function toCanvas(img) { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; c.getContext("2d").putImageData(img, 0, 0); return c; }

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
  const errors = [], CV = cvWorker();
  let cvOk = false, worker = null, rot = null;
  try { await CV.call("ping", {}, 150000, "chargement d'OpenCV.js"); cvOk = true; } catch (e) { errors.push(e.message); CV.stop(); }
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
    let C = null, deg = 0;
    if (cvOk) {
      try {
        const img = imageData(R.canvas);
        // angle mesuré une fois sur la première tuile qui a assez de traits, puis réutilisé (même angle pour tout le plan)
        if (rot == null) { const r = await CV.call("skew", { img }, 60000, "mesure de l'inclinaison"); if (r.deg) rot = Math.abs(r.deg) >= 0.3 ? r.deg : 0; }
        deg = rot || 0;
        C = toCanvas((await CV.call("clean", { img, rot: deg }, 60000, "nettoyage d'une tuile")).img);
      } catch (e) { errors.push(e.message); cvOk = false; C = null; deg = 0; }
    }
    if (!C) { const o = await read(R.canvas, (x, y) => ({ x, y })).catch((e) => { errors.push(e.message); return []; }); return { images: [R.data], rot: 0, ocr: mergeOcr(o, []), cleaned: false }; }
    const o = await read(R.canvas, (x, y) => rotate(x, y, deg, W, H)).catch((e) => { errors.push(e.message); return []; }), n = await read(C, (x, y) => ({ x, y })).catch((e) => { errors.push(e.message); return []; });
    return { images: [R.data, C.toDataURL("image/jpeg", 0.9).split(",")[1]], rot: deg, ocr: mergeOcr(o, n), cleaned: true };
  }
  async function close() { CV.stop(); try { if (worker) await within(worker.terminate(), 10000, "arrêt de l'OCR"); } catch { /* déjà arrêté */ } rasterState.stage = ""; }
  return { prepare, close, errors, get angle() { return rot || 0; }, get ok() { return cvOk; } };
}
