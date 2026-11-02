// captures de la préparation d'impression v74 sur le chantier de référence MAILLARD (déjà dans docs/chantiers) (vérification visuelle sur GitHub Actions) :
// node scripts/shots-v74.mjs → shots/prep-*.png + shots/prep-maillard.pdf
import fs from "node:fs";
import { chromium } from "playwright";
import { createServer } from "vite";
const server = await createServer({ server: { port: 5291, strictPort: true, open: false }, logLevel: "error" });
await server.listen();
const browser = await chromium.launch();
const errs = [];
fs.mkdirSync("shots", { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, acceptDownloads: true });
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto("http://localhost:5291/"); await page.waitForFunction(() => window.okteo && window.okteoExt);
  await page.waitForTimeout(800);
  await page.evaluate(() => okteo.setTab("chantiers"));
  await Promise.all([page.waitForEvent("load", { timeout: 60000 }), page.setInputFiles("#ch-import", "docs/chantiers/MAILLARD_kevin.okteo")]);
  await page.waitForFunction(() => window.okteo && window.okteoExt, null, { timeout: 60000 }); await page.waitForTimeout(1500);
  await page.evaluate(() => okteo.setTab("plan"));
  const info = await page.evaluate(() => { try { if (!okteo.cab.boxes.length) okteoExt.catalog.find((c) => c.id === "etude.cabler").run(); } catch (e) { return "cabler : " + e.message; } return `${okteo.state.app.length} appareils, ${okteo.cab.boxes.length} boîtes`; });
  console.log(info);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "shots/plan.png" });
  // diagnostic : outil Liaison sur une commande puis sa lumière
  await page.evaluate(() => { okteoExt.panel.close("assistant"); document.querySelector(".tour-invite")?.remove(); okteo.setTool("lien"); });
  const t = await page.evaluate(() => { const x = okteo.state.lia[0], A = okteo.state.app, c = A.find((a) => a.id === x.c), l = A.find((a) => a.id === x.l); okteo.zoomTo([c.id, l.id]); return { cid: c.id, lid: l.id }; });
  await page.waitForTimeout(600);
  const pp = await page.evaluate((t) => { const A = okteo.state.app, c = A.find((a) => a.id === t.cid), l = A.find((a) => a.id === t.lid); return { c: okteo.toClient(c.x, c.y), l: okteo.toClient(l.x, l.y), ls: okteo.shownAt(l.id), lw: { x: l.x, y: l.y } }; }, t);
  await page.mouse.click(pp.c.x, pp.c.y); const h1 = await page.evaluate(() => document.getElementById("hint").textContent);
  const top = await page.evaluate((p) => { const e = document.elementFromPoint(p.l.x, p.l.y); return e && (e.tagName + "." + e.getAttribute("class") + " dev=" + (e.closest("g.dev")?.dataset.id || "") + " id=" + e.id); }, pp);
  await page.mouse.click(pp.l.x, pp.l.y); const h2 = await page.evaluate(() => document.getElementById("hint").textContent);
  console.log("DIAG", JSON.stringify({ pp, h1, top, h2 }));
  await page.evaluate(() => { okteo.setTool("sel"); });
  // v74 MAJ 3 : baignoire dans la salle de bains, contre le mur du haut (vérification visuelle des volumes)
  console.log(await page.evaluate(() => { const r = okteo.state.rooms.find((x) => /bain/i.test(x.name)); if (!r || !r.poly) return "pas de salle de bains"; const P = r.poly, x0 = Math.min(...P.map((p) => p.x)), y0 = Math.min(...P.map((p) => p.y)); okteo.importDevices([{ t: "BAIG", x: x0 + 0.86, y: y0 + 0.39 }]); return "baignoire posée, " + okteo.control.filter((c) => c.kind === "sdb").length + " alerte(s) sdb"; }));
  await page.evaluate(() => { const r = okteo.state.rooms.find((x) => /bain/i.test(x.name)); if (r) okteo.zoomTo([r.id]); });
  await page.waitForTimeout(800);
  await page.screenshot({ path: "shots/sdb.png" });
  await page.evaluate(() => okteoExt.prep.open());
  await page.waitForFunction(() => okteoExt.prep.bg && document.querySelector(".prep-wait[hidden]"), null, { timeout: 60000 });
  await page.evaluate(() => { const P = okteoExt.prep; P.addItem("enc", { type: "text", w: 52, text: "EMPLACEMENT BOITE\nEN ATTENTE DANS COMBLES\nA DEFINIR AVANT POSE", font: "courier", size: 9, bold: true, color: "#FF0000", frame: "round", frameColor: "#FF0000", frameW: 0.3, align: "center", x: 30, y: 30 }); P.addItem("warn"); P.addItem("arrow"); P.addItem("zone"); });
  await page.waitForTimeout(600);
  await page.screenshot({ path: "shots/prep-recto.png" });
  await page.click('.prep-pages [data-p="1"]');
  await page.waitForFunction(() => document.querySelector(".prep-wait[hidden]"), null, { timeout: 60000 }); await page.waitForTimeout(600);
  await page.screenshot({ path: "shots/prep-verso.png" });
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click(".prep-dl")]);
  await dl.saveAs("shots/prep-maillard.pdf");
  await page.setViewportSize({ width: 1366, height: 768 }); await page.waitForTimeout(1500);
  await page.screenshot({ path: "shots/prep-1366.png" });
} finally { await browser.close(); await server.close(); }
console.log(errs.length ? "Erreurs : " + errs.join(" | ") : "Captures faites, aucune erreur de page.");
if (errs.length) process.exit(1);
