// Calcule le câblage Oktéo d'un chantier .okteo (boîtes, gaines, fils, lignes directes) et l'écrit en JSON.
// Usage : node scripts/chantier-wiring.mjs <chantier.okteo> <sortie.json> [--recable] [--departs=16] [--connecte] [--mode=equilibre]
//   --recable : refait circuits + boîtes avec les règles actuelles (comme « Câbler le chantier ») avant le calcul.
// Réglages de câblage : ceux de base (le fichier .okteo ne contient pas les réglages du PC).
import { createServer } from "vite";
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const [, , IN, OUT, ...flags] = process.argv;
if (!IN || !OUT) { console.error("usage : node scripts/chantier-wiring.mjs <chantier.okteo> <sortie.json> [--recable]"); process.exit(2); }
const PORT = 5287;
const server = await createServer({ server: { port: PORT, strictPort: true, open: false }, logLevel: "error" });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(`http://localhost:${PORT}/`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.okteo && window.okteoExt);
  await page.click('#tabs button[data-tab="chantiers"]');
  await Promise.all([page.waitForNavigation(), page.setInputFiles("#ch-import", path.resolve(IN))]);
  await page.waitForFunction(() => window.okteo && window.okteoExt && okteo.state.app.length > 0, null, { timeout: 60000 });
  const out = await page.evaluate(async (recable) => {
    const m = await import("/src/ext/cablage-data.js");
    if (recable.connecte) okteo.setCab({ choix: { ...(okteo.cab.choix || {}), commandeVolet: "connecte" } });
    if (recable.mode) okteo.setCab({ mode: recable.mode });
    if (recable.departs) { const st = await import("/src/cablage/settings.js"); st.setCab({ ...st.getCab(), departsMax: recable.departs }); }
    if (recable.on) { const e = await import("/src/ext/etude-ui.js"); await e.cabler(okteo); }
    const W = m.wiringNow(okteo);
    const apps = okteo.allApps().map((a) => ({ id: a.id, t: a.t, rep: a.rep, room: a.room, x: +a.x.toFixed(2), y: +a.y.toFixed(2), h: a.h }));
    const boxes = W.boxes.map((b) => ({ n: b.n, x: b.x, y: b.y, longueur: b.longueur, circuits: b.circuits, bouchons: b.bouchons,
      gaines: b.gaines.map((g) => ({ no: g.no, face: g.face, kind: g.kind, reps: g.reps || null, label: g.label, circuit: g.circuit, diam: g.diam, length: g.length, cable: g.cable || null,
        wires: g.wires.map((w) => ({ fn: w.fn, color: w.color, section: w.section, n: w.n, bague: w.bague || null, circuit: w.circuit || null })) })) }));
    return { chantier: okteo.ch.nom, mode: okteo.cab.mode, circuits: okteo.cab.circuits.map((c) => ({ n: c.n, kind: c.kind, section: c.section, prot: c.prot, direct: c.direct, apps: c.apps.length })),
      apps, links: okteo.allLinks(), boxes, direct: W.direct, directTotals: W.directTotals, doutes: W.doutes, issues: W.issues, totals: W.totals };
  }, { on: flags.includes("--recable"), connecte: flags.includes("--connecte"), mode: (flags.find((f) => f.startsWith("--mode=")) || "").split("=")[1] || "", departs: +((flags.find((f) => f.startsWith("--departs=")) || "").split("=")[1] || 0) });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(`${out.boxes.length} boîtes, ${out.boxes.reduce((s, b) => s + b.gaines.length, 0)} gaines, ${out.direct.length} lignes directes → ${OUT}`);
  if (errors.length) console.log("erreurs de la page :", errors.join(" | "));
} finally {
  await browser.close(); await server.close();
}
