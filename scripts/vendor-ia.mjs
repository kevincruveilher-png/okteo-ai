// v76 étape 3 : copie des bibliothèques du mode 3 dans public/vendor (servies par okteo-ai.pages.dev, jamais par un CDN :
// la CSP du site n'autorise que 'self'). Lancé par npm run dev / build / build:web / check. public/vendor n'est pas versionné.
//   OpenCV.js (Apache 2.0)        → public/vendor/opencv/opencv.js
//   Tesseract.js worker (Apache 2.0), moteur tesseract.js-core (Apache 2.0) → public/vendor/ocr/worker.min.js, ocr/core/*
//   données de langue « fra » (tessdata, Apache 2.0) → public/vendor/ocr/lang/fra.traineddata.gz
// Chaque dossier reçoit aussi le fichier de licence du paquet d'origine.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const NM = "node_modules", OUT = path.join("public", "vendor");
const need = (p, what) => { if (!fs.existsSync(p)) { console.error(`✗ ${what} introuvable (${p}) : lancez npm install`); process.exit(1); } return p; };
const copy = (from, to) => { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); };
const licence = (pkg, dir) => { for (const f of ["LICENSE", "LICENSE.md", "LICENSE.txt", "license", "COPYING"]) { const p = path.join(NM, pkg, f); if (fs.existsSync(p)) { copy(p, path.join(dir, `LICENCE-${pkg.replace(/[@/]/g, "_")}.txt`)); return; } } };
const find = (dir, re) => { const out = []; const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (re.test(e.name)) out.push(p); } }; if (fs.existsSync(dir)) walk(dir); return out; };

// OpenCV.js
const ocvDir = path.join(OUT, "opencv");
copy(need(path.join(NM, "@techstark", "opencv-js", "dist", "opencv.js"), "OpenCV.js"), path.join(ocvDir, "opencv.js"));
licence("@techstark/opencv-js", ocvDir);
// Tesseract.js : worker + moteur (toutes les variantes : SIMD / non SIMD, LSTM) + langue
const ocrDir = path.join(OUT, "ocr");
copy(need(path.join(NM, "tesseract.js", "dist", "worker.min.js"), "worker Tesseract.js"), path.join(ocrDir, "worker.min.js"));
licence("tesseract.js", ocrDir);
const core = find(path.join(NM, "tesseract.js-core"), /^tesseract-core.*\.(wasm\.js|wasm|js)$/);
if (!core.length) { console.error("✗ moteur tesseract.js-core introuvable : lancez npm install"); process.exit(1); }
for (const f of core) copy(f, path.join(ocrDir, "core", path.basename(f)));
licence("tesseract.js-core", ocrDir);
const lang = find(path.join(NM, "@tesseract.js-data", "fra"), /^fra\.traineddata(\.gz)?$/).sort((a, b) => (/best_int/.test(b) ? 1 : 0) - (/best_int/.test(a) ? 1 : 0));
if (!lang.length) { console.error("✗ données de langue fra introuvables (@tesseract.js-data/fra)"); process.exit(1); }
// toujours compressé (Tesseract.js est réglé avec gzip: true dans src/ext/ai-raster.js)
const langOut = path.join(ocrDir, "lang", "fra.traineddata.gz");
fs.mkdirSync(path.dirname(langOut), { recursive: true });
if (/\.gz$/.test(lang[0])) fs.copyFileSync(lang[0], langOut); else fs.writeFileSync(langOut, zlib.gzipSync(fs.readFileSync(lang[0])));
licence("@tesseract.js-data/fra", path.join(ocrDir, "lang"));
const size = (d) => find(d, /./).reduce((s, f) => s + fs.statSync(f).size, 0);
console.log(`Bibliothèques du mode 3 copiées dans public/vendor : OpenCV ${(size(ocvDir) / 1e6).toFixed(1)} Mo, OCR ${(size(ocrDir) / 1e6).toFixed(1)} Mo (langue : ${path.basename(lang[0])}).`);
