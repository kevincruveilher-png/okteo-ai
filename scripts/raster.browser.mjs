// v76 étape 3 : chemin des scans du mode 3 avec les VRAIS OpenCV.js et Tesseract.js (servis par /vendor, comme en ligne),
// à part de la suite smoke : une image de test inclinée de 2° avec du texte → angle mesuré, copie nettoyée distincte,
// texte lu par l'OCR. Chaque étape est suivie dans la console ; tout le test est borné à 6 min depuis Node.
//   node scripts/raster.browser.mjs   (après node scripts/vendor-ia.mjs)
import { chromium } from "playwright";
import { createServer } from "vite";

const LIMIT = 6 * 60000;
const server = await createServer({ server: { port: 5293, strictPort: true, open: false }, logLevel: "error" });
await server.listen();
const browser = await chromium.launch();
let code = 1;
const stages = [], errs = [];
const t0 = Date.now(), log = (m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)} s] ${m}`);
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  page.on("console", (m) => { const t = m.text(); if (/okteo mode 3/.test(t)) { stages.push(t); log(t); } });
  page.on("pageerror", (e) => { errs.push(e.message); log("erreur de page : " + e.message); });
  page.on("crash", () => log("la page a planté"));
  await page.goto("http://localhost:5293/"); await page.waitForFunction(() => window.okteo && window.okteoExt, null, { timeout: 60000 });
  log("logiciel chargé");
  const run = page.evaluate(async () => {
    const c = document.createElement("canvas"); c.width = 900; c.height = 650;
    const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, 900, 650);
    g.save(); g.translate(450, 325); g.rotate(2 * Math.PI / 180); g.translate(-450, -325);
    g.strokeStyle = "#222"; g.lineWidth = 6;
    for (const y of [80, 560]) { g.beginPath(); g.moveTo(60, y); g.lineTo(840, y); g.stroke(); }
    for (const x of [60, 450, 840]) { g.beginPath(); g.moveTo(x, 80); g.lineTo(x, 560); g.stroke(); }
    g.lineWidth = 3; for (let y = 140; y < 520; y += 60) { g.beginPath(); g.moveTo(470, y); g.lineTo(820, y); g.stroke(); }
    g.fillStyle = "#111"; g.font = "bold 46px Arial"; g.fillText("CUISINE", 120, 330); g.fillText("CHAMBRE", 520, 120);
    g.restore();
    const m = await import("/src/ext/ai-raster.js"), R = await m.createRaster();
    const P = await R.prepare({ canvas: c, data: c.toDataURL("image/jpeg", 0.9).split(",")[1], W: 900, H: 650 });
    const out = { ok: R.ok, errors: R.errors, rot: P.rot, n: P.images.length, differ: P.images[0] !== P.images[1], cleaned: P.cleaned, words: P.ocr.map((w) => w.text + ":" + w.src + ":" + Math.round(w.conf)) };
    await R.close();
    return out;
  });
  const r = await Promise.race([run, new Promise((_, no) => setTimeout(() => no(new Error("délai de 6 min dépassé")), LIMIT))]);
  log("résultat : " + JSON.stringify(r));
  const ok = r.ok && !r.errors.length && Math.abs(r.rot - 2) < 0.6 && r.n === 2 && r.differ && r.cleaned && r.words.some((w) => /CUISINE/i.test(w));
  console.log(ok ? "✓ chemin des scans : OpenCV.js (angle, nettoyage) et Tesseract.js (texte) fonctionnent." : "✗ chemin des scans : résultat inattendu.");
  code = ok ? 0 : 1;
} catch (e) {
  console.log(`✗ chemin des scans : ${e.message} — dernière étape : ${stages.at(-1) || "aucune (OpenCV.js / Tesseract.js pas encore appelés)"}${errs.length ? " — erreurs : " + errs.join(" | ") : ""}`);
} finally { await browser.close().catch(() => {}); await server.close().catch(() => {}); }
process.exit(code);
