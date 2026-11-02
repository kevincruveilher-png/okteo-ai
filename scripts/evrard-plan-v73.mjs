// Plan Oktéo du chantier EVRARD (comparaison avec le plan du BE) : relevé automatique murs → pièces → appareils,
// « Câbler le chantier », captures de l'écran et PDF imprimé. GitHub Actions : node scripts/evrard-plan-v73.mjs
import { chromium } from "playwright";
import { createServer } from "vite";
import fs from "node:fs";
const server = await createServer({ server: { port: 5291, strictPort: true, open: false }, logLevel: "error" });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const log = (...a) => console.log("  ", ...a);
const ev = (f, a) => page.evaluate(f, a);
const save = async (name, getBlob) => { const b64 = await ev(getBlob); fs.writeFileSync("shots/" + name, Buffer.from(b64, "base64")); log("écrit", name); };
const B64 = `async (blob) => { const u = new Uint8Array(await blob.arrayBuffer()); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); }`;
try {
  await page.goto("http://localhost:5291/"); await page.waitForFunction(() => window.okteo && window.okteoExt);
  await ev(() => { localStorage.clear(); localStorage.setItem("okteo.tour.v1", JSON.stringify({ done: true, seen: true, never: true })); });
  await page.reload(); await page.waitForFunction(() => window.okteo && window.okteoExt);
  await ev(() => okteoExt.panel.close("assistant"));
  await page.click('#tabs button[data-tab="chantiers"]');
  await page.click("#ch-new"); await page.fill("#nf-nom", "EVRARD"); await page.fill("#nf-num", "04949"); await page.fill("#nf-cli", "Maisons CPR");
  await page.setInputFiles("#nf-file", "docs/plans/EVRARD_04949_plan.pdf");
  await page.waitForSelector(".thumb", { timeout: 30000 }); await page.click('.thumb[data-page="3"]');
  await Promise.all([page.waitForNavigation({ timeout: 60000 }), page.click("#nf-ok")]);
  await page.waitForFunction(() => window.okteo && window.okteoExt && okteo.FOND && okteo.FOND.startsWith("blob:"), null, { timeout: 30000 });
  await ev(() => okteoExt.panel.close("assistant"));
  await page.keyboard.press("Escape");
  await page.click("#btn-relev"); await page.click("#rv-walls");
  await page.waitForSelector("#w-ok", { timeout: 60000 });
  if ((await page.textContent("#w-scale")).includes("⚠")) { await page.click("#w-fix"); await page.waitForSelector(".wcard:not([hidden]) .wrow button.on"); await page.click(".wcard .wrow button.on"); await page.waitForSelector("#w-ok", { timeout: 60000 }); }
  await page.click("#w-ok");
  await page.waitForSelector("#r-ok", { timeout: 60000 }); await page.click("#r-ok");
  await page.waitForSelector("#d-ok", { timeout: 60000 }); await page.click("#d-ok");
  await page.waitForTimeout(800);
  const st = await ev(() => ({ murs: okteo.state.segs.length, pieces: okteo.state.rooms.map((r) => r.name), app: okteo.state.app.length, lia: okteo.state.lia.length, types: okteo.state.app.reduce((m, a) => ((m[a.t] = (m[a.t] || 0) + 1), m), {}) }));
  log("relevé", JSON.stringify(st));
  const cab = await ev(() => okteoExt.catalog.find((c) => c.id === "etude.cabler").run());
  log("câblage", String(cab).replace(/\s+/g, " ").slice(0, 600));
  await page.click('#tabs button[data-tab="plan"]'); await page.waitForTimeout(300);
  for (const [id, name] of [["impl", "implantation"], ["cab", "cablage"]]) {
    await ev((v) => { okteo.viewPreset(v); okteo.fit(); }, id); await page.waitForTimeout(800);
    await page.screenshot({ path: `shots/evrard-ecran-${name}.png` });
  }
  fs.writeFileSync("shots/evrard-etat.json", JSON.stringify({ st, cab: String(cab), boxes: await ev(() => okteo.cab.boxes.length), circuits: await ev(() => (okteo.cab.circuits || []).length) }, null, 1));
  // impression : tous les calques cochés (comme le plan du BE : appareils, liaisons, boîtes, gaines, circuits)
  await page.keyboard.press("Control+p");
  await page.waitForSelector(".pr-back:not([hidden])");
  await page.waitForFunction(() => okteoExt.printer.last && !document.querySelector(".pr-wait:not([hidden])"), null, { timeout: 60000 });
  await save("evrard-oktéo-vue.pdf", new Function("return (" + B64 + ")(okteoExt.printer.last.blob)"));
  await ev(() => { document.querySelectorAll(".pr-layers input[type=checkbox]").forEach((c) => { if (!c.checked) { c.checked = true; c.dispatchEvent(new Event("change", { bubbles: true })); } }); });
  await page.waitForTimeout(1500);
  await page.waitForFunction(() => okteoExt.printer.last && !document.querySelector(".pr-wait:not([hidden])"), null, { timeout: 60000 });
  await save("evrard-oktéo-tout.pdf", new Function("return (" + B64 + ")(okteoExt.printer.last.blob)"));
  log("mise en page", JSON.stringify(await ev(() => okteoExt.printer.last.layout)));
} catch (e) { console.log("ERREUR", e.message); await page.screenshot({ path: "shots/evrard-erreur.png" }); process.exitCode = 1; }
finally { await browser.close(); await server.close(); }
