// v76 étape 3 : OpenCV.js dans un Web Worker (processus à part) — son chargement (10 Mo, WebAssembly) figeait la page
// quand il était fait dans la page elle-même. Ici, la page reste réactive et ai-raster.js peut arrêter le worker s'il ne
// répond pas dans le délai. Messages : { id, op: "skew", img: ImageData } → { id, deg } ;
// { id, op: "clean", img, rot } → { id, img: ImageData } ; réponse { id, error } en cas d'échec.
/* global cv */
let ready = null;
function load() {
  if (ready) return ready;
  ready = new Promise((ok, no) => {
    try { self.importScripts("/vendor/opencv/opencv.js"); } catch (e) { no(new Error("OpenCV.js introuvable : " + e.message)); return; }
    // ne jamais « await » l'objet du module : il est « thenable » et se résout sur lui-même (boucle sans fin)
    const t0 = Date.now(), tick = () => { if (self.cv && self.cv.Mat) ok(self.cv); else if (Date.now() - t0 > 120000) no(new Error("OpenCV.js ne démarre pas")); else setTimeout(tick, 50); };
    tick();
  });
  return ready;
}
function skew(cv, img) {
  const src = cv.matFromImageData(img), g = new cv.Mat(), e = new cv.Mat(), L = new cv.Mat();
  try {
    cv.cvtColor(src, g, cv.COLOR_RGBA2GRAY); cv.Canny(g, e, 50, 150);
    cv.HoughLinesP(e, L, 1, Math.PI / 720, 80, Math.max(40, Math.min(img.width, img.height) / 12), 6);
    const a = [];
    for (let i = 0; i < L.rows; i++) {
      const x1 = L.data32S[i * 4], y1 = L.data32S[i * 4 + 1], x2 = L.data32S[i * 4 + 2], y2 = L.data32S[i * 4 + 3];
      let d = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI; d = ((d + 45) % 90 + 90) % 90 - 45;
      if (Math.abs(d) <= 5) a.push(d);
    }
    if (a.length < 8) return 0;
    a.sort((p, q) => p - q);
    return a[Math.floor(a.length / 2)];
  } finally { src.delete(); g.delete(); e.delete(); L.delete(); }
}
function clean(cv, img, rot) {
  const src = cv.matFromImageData(img), g = new cv.Mat(), r = new cv.Mat(), c = new cv.Mat(), d = new cv.Mat(), o = new cv.Mat();
  try {
    cv.cvtColor(src, g, cv.COLOR_RGBA2GRAY);
    if (rot) { const M = cv.getRotationMatrix2D(new cv.Point(img.width / 2, img.height / 2), rot, 1); cv.warpAffine(g, r, M, new cv.Size(img.width, img.height), cv.INTER_CUBIC, cv.BORDER_CONSTANT, new cv.Scalar(255)); M.delete(); }
    else g.copyTo(r);
    const cl = new cv.CLAHE(2.0, new cv.Size(8, 8)); cl.apply(r, c); cl.delete();
    cv.medianBlur(c, d, 3);
    cv.cvtColor(d, o, cv.COLOR_GRAY2RGBA);
    return new ImageData(new Uint8ClampedArray(o.data), img.width, img.height);
  } finally { src.delete(); g.delete(); r.delete(); c.delete(); d.delete(); o.delete(); }
}
self.onmessage = async (ev) => {
  const { id, op, img, rot } = ev.data || {};
  try {
    const cv = await load();
    if (op === "ping") return self.postMessage({ id, ok: true });
    if (op === "skew") return self.postMessage({ id, deg: skew(cv, img) });
    if (op === "clean") { const out = clean(cv, img, rot || 0); return self.postMessage({ id, img: out }, [out.data.buffer]); }
    self.postMessage({ id, error: "opération inconnue" });
  } catch (e) { self.postMessage({ id, error: String((e && e.message) || e) }); }
};
