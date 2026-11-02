// captures d'écran de la charte v73 (vérification visuelle sur GitHub Actions) : node scripts/shots-v73.mjs
import { chromium } from "playwright";
import { createServer } from "vite";
const server = await createServer({ server: { port: 5290, strictPort: true, open: false }, logLevel: "error" });
await server.listen();
const browser = await chromium.launch();
const errs = [];
try {
  for (const [w, h] of [[1920, 1080], [1500, 900], [1280, 600]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    page.on("pageerror", (e) => errs.push(e.message));
    await page.goto("http://localhost:5290/"); await page.waitForFunction(() => window.okteo && window.okteoExt);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `shots/travail-${w}.png` });
    await page.click("#theme"); await page.waitForTimeout(300);
    await page.screenshot({ path: `shots/travail-clair-${w}.png` });
    await page.click("#theme");
    await page.evaluate(() => { window.__j = okteoExt.aiReleve.attente.start(); });
    await page.waitForSelector(".aw:not([hidden])"); await page.click("#aw-start"); await page.waitForTimeout(900);
    await page.screenshot({ path: `shots/attente-${w}.png` });
    await page.click('.aw-tab[data-g="cab"]'); await page.click("#aw-play"); await page.waitForTimeout(1200);
    await page.screenshot({ path: `shots/attente-cable-${w}.png` });
    await page.evaluate(() => okteoExt.aiReleve.attente.finish(window.__j, true));
    await page.screenshot({ path: `shots/attente-fin-${w}.png` });
    await page.goto("http://localhost:5290/login.html"); await page.waitForTimeout(1200);
    await page.screenshot({ path: `shots/accueil-anim-${w}.png` });
    await page.waitForTimeout(2800);
    await page.screenshot({ path: `shots/accueil-${w}.png` });
    await page.close();
  }
} finally { await browser.close(); await server.close(); }
console.log(errs.length ? "Erreurs : " + errs.join(" | ") : "Captures faites, aucune erreur de page.");
if (errs.length) process.exit(1);
