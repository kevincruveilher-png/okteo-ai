// v76 : captures de l'écran « Analyse IA » (choix des 4 modes) pour comparer avec la maquette page 8
// (vérification visuelle sur GitHub Actions) : node scripts/shots-v76.mjs → shots/modes-*.png
import fs from "node:fs";
import { chromium } from "playwright";
import { createServer } from "vite";
const server = await createServer({ server: { port: 5292, strictPort: true, open: false }, logLevel: "error" });
await server.listen();
const browser = await chromium.launch();
const errs = [];
fs.mkdirSync("shots", { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1040 } });
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto("http://localhost:5292/"); await page.waitForFunction(() => window.okteo && window.okteoExt);
  await page.waitForTimeout(800);
  await page.evaluate(() => okteoExt.aiModes.open());
  await page.waitForTimeout(400);
  await page.screenshot({ path: "shots/modes-1440-vide.png" });
  await page.click('#ai-modes .am-card[data-mode="2"]'); await page.waitForTimeout(200);
  await page.screenshot({ path: "shots/modes-1440-mode2.png" });
  await page.click('#ai-modes .am-card[data-mode="1"]'); await page.waitForTimeout(200);
  await page.screenshot({ path: "shots/modes-1440-mode1.png" });
  for (const [w, h] of [[1920, 1080], [1100, 900], [390, 844]]) {
    await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(300);
    await page.screenshot({ path: `shots/modes-${w}.png`, fullPage: true });
  }
} finally { await browser.close(); await server.close(); }
console.log(errs.length ? "Erreurs : " + errs.join(" | ") : "Captures faites, aucune erreur de page.");
if (errs.length) process.exit(1);
