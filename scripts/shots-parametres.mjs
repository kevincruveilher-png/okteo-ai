// captures d'écran de la page Paramètres (06/11/2026, vérification visuelle sur GitHub Actions) :
// node scripts/shots-parametres.mjs → shots/parametres-*.png
import fs from "node:fs";
import { chromium } from "playwright";
import { createServer } from "vite";
fs.mkdirSync("shots", { recursive: true });
const server = await createServer({ server: { port: 5291, strictPort: true, open: false }, logLevel: "error" });
await server.listen();
const browser = await chromium.launch();
const errs = [];
try {
  for (const [w, h] of [[1920, 1080], [1366, 768]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    page.on("pageerror", (e) => errs.push(e.message));
    await page.goto("http://localhost:5291/"); await page.waitForFunction(() => window.okteo && window.okteoExt);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `shots/parametres-0-plan-${w}.png` });
    await page.click('#tabs button[data-tab="params"]');
    await page.waitForFunction(() => window.okteoExt?.pages?.params?.ui?.setActive);
    for (const r of ["chantier", "cablage", "conducteurs", "tableau", "norme", "fabrication", "questions", "affichage"]) {
      await page.evaluate((x) => okteoExt.pages.params.ui.setActive(x), r); await page.waitForTimeout(250);
      await page.screenshot({ path: `shots/parametres-${r}-${w}.png` });
    }
    await page.fill(".pset-find", "couleur"); await page.waitForTimeout(250);
    await page.screenshot({ path: `shots/parametres-recherche-${w}.png` });
    await page.close();
  }
} finally { await browser.close(); await server.close(); }
console.log(errs.length ? "Erreurs : " + errs.join(" | ") : "Captures faites, aucune erreur de page.");
if (errs.length) process.exit(1);
