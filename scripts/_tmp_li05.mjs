import { chromium } from "playwright";
import { createServer } from "vite";
import fs from "node:fs";
const srv = await createServer({ server: { port: 5190 }, logLevel: "silent" }); await srv.listen();
const br = await chromium.launch(); const page = await br.newPage({ viewport: { width: 1600, height: 950 } });
page.on("pageerror", (e) => console.log("ERR", e.message));
await page.goto("http://localhost:5190/"); await page.waitForFunction(() => window.okteo && window.okteoExt);
await page.click('#tabs button[data-tab="chantiers"]'); await page.click("#ch-new");
await page.fill("#nf-nom", "PASQUIER"); await page.setInputFiles("#nf-file", "docs/plans/PASQUIER_BLIN_plan_scanne.pdf");
await page.waitForSelector(".thumb", { timeout: 60000 }); await page.click('.thumb[data-page="1"]');
await Promise.all([page.waitForNavigation({ timeout: 90000 }), page.click("#nf-ok")]);
await page.waitForFunction(() => window.okteo && window.okteoExt && okteo.FOND && okteo.FOND.startsWith("blob:"), null, { timeout: 60000 });
await page.keyboard.press("Escape");
await page.evaluate(() => { document.querySelector(".tour-invite")?.remove(); okteo.applyScaleRatio(50); okteoExt.aiReleve.pastePanel(); });
await page.fill("#ai-paste", fs.readFileSync("docs/exemples/PASQUIER_releve_ia.json", "utf8"));
await page.click("#ai-read"); await page.waitForSelector("#ai-ok", { timeout: 30000 }); await page.click("#ai-ok");
await page.evaluate(() => { document.querySelectorAll(".wcard").forEach((c) => (c.hidden = true)); okteoExt.panel.show("cablage"); }); await page.waitForTimeout(300);
await page.click("#cb-auto"); await page.waitForTimeout(400);
await page.evaluate(() => okteoExt.panel.show("cablage")); await page.waitForTimeout(200);
await page.click("#bx-auto"); await page.waitForTimeout(400);
const y = await page.$("#bx-yes"); if (y) await y.click();
await page.waitForTimeout(500);
const out = await page.evaluate(async () => {
  const { boxSheets } = await import("/src/ext/cablage-bandes.js");
  const S = boxSheets(okteo).find((s) => s.box.n === "LI05");
  if (!S) return { names: okteo.cab.boxes.map((b) => b.n) };
  const b = S.box;
  return { n: b.n, sides: S.sides, circuits: b.circuits, cuivre: b.cuivre,
    gaines: b.gaines.map((g) => ({ no: g.no, face: g.face, label: g.label, room: g.room, circuit: g.circuit, len: g.length, diam: g.diam, cable: g.cable, wires: g.wires.map((w) => `${w.fn}:${w.color} ${w.section} n°${w.n}`) })),
    steps: S.steps.map((s) => ({ n: s.n, label: s.label, conn: s.conn, wires: s.wires.map((w) => `${w.gaine} ${w.color} ${w.section} (${w.fn} ${w.label})`) })),
    mat: S.material, fils: S.fils, checks: S.checks };
});
fs.writeFileSync("/tmp/claude-0/li05.json", JSON.stringify(out, null, 1));
await page.evaluate(async () => { const b = okteo.cab.boxes.find((x) => x.n === "LI05"); okteo.viewPreset("cab"); okteo.boxSel = b.id; okteo.zoomToBox(b.x - 4, b.y - 3, b.x + 4, b.y + 3); });
await page.screenshot({ path: "/tmp/claude-0/li05-plan.png" });
await page.click('#tabs button[data-tab="bandes"]'); await page.waitForSelector(".bands .bd-svg svg");
await page.evaluate(() => { const b = [...document.querySelectorAll(".bands .bd-pick [data-b]")].find((x) => x.textContent === "LI05"); b && b.click(); });
await page.waitForTimeout(300);
await page.screenshot({ path: "/tmp/claude-0/li05-bande.png", fullPage: false });
await br.close(); await srv.close();
