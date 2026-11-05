// TEMPORAIRE (05/11/2026) : mesure du temps de dessin du plan et profil CPU (lenteur signalée par Kévin). Pas dans check.
import { chromium } from "playwright";
import { createServer } from "vite";
const server = await createServer({ server: { port: 5199, strictPort: true }, logLevel: "error" });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
page.on("pageerror", (e) => console.log("ERREUR PAGE", e.message));
await page.goto("http://localhost:5199/");
await page.waitForFunction(() => window.okteo && window.okteo.state && window.__okteo, null, { timeout: 60000 });
await page.waitForTimeout(3000);
const ev = (f, a) => page.evaluate(f, a);
// plan chargé : ajoute ~120 appareils et 40 liaisons répartis dans l'emprise, comme un vrai plan (COURIAUT : 119 appareils)
const info = await ev(() => {
  const S = okteo.state, xs = S.nodes.map((n) => n.x), ys = S.nodes.map((n) => n.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const T = ["PC16", "PC16", "PC16", "LUM", "INT", "VV", "RJ45", "APP"], list = [], links = [];
  let seed = 7; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 120; i++) list.push({ t: T[i % T.length], x: x0 + 0.3 + r() * (x1 - x0 - 0.6), y: y0 + 0.3 + r() * (y1 - y0 - 0.6) });
  for (let i = 0; i < 120; i += 8) { links.push([i + 4, i + 3]); links.push([i + 5, i + 3]); }
  okteo.importDevices(list, links, {});
  return { apps: S.app.length, segs: S.segs.length, lia: S.lia.length, rooms: S.rooms.length };
});
console.log("plan :", JSON.stringify(info));
const timeDraw = (n) => ev((n) => { const t = []; for (let i = 0; i < n; i++) { const a = performance.now(); window.__okteo.draw(); t.push(performance.now() - a); } t.sort((p, q) => p - q); return { med: +t[n >> 1].toFixed(1), max: +t[n - 1].toFixed(1), pm: okteo.view ? JSON.stringify(okteo.view) : "" }; }, n);
await ev(() => { okteo.setTab("plan"); okteo.fit(); });
for (const [lab, prep] of [["vue entière", () => okteo.fit()], ["zoom ×4", () => { okteo.fit(); okteo.zoom(4); }], ["zoom ×12", () => { okteo.fit(); okteo.zoom(12); }], ["zoom max", () => { okteo.fit(); okteo.zoom(1000); }]]) {
  await page.evaluate(prep);
  console.log(lab, JSON.stringify(await timeDraw(9)));
}
for (const [k, v] of [["charteBE", false], ["charteBE", true]]) {
  await ev(async ([k, v]) => (await import("/src/prefs.js")).setPref(k, v), [k, v]);
  await page.evaluate(() => { okteo.fit(); okteo.zoom(4); });
  console.log("préférence", k, v, JSON.stringify(await timeDraw(7)));
}
// profil CPU de 8 dessins au zoom ×4
const cdp = await page.context().newCDPSession(page);
await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
await page.evaluate(() => { okteo.fit(); okteo.zoom(4); });
await cdp.send("Profiler.start");
await ev(() => { for (let i = 0; i < 8; i++) window.__okteo.draw(); });
const { profile } = await cdp.send("Profiler.stop");
const self = new Map(), byId = new Map(profile.nodes.map((n) => [n.id, n]));
const dt = profile.timeDeltas; profile.samples.forEach((id, i) => { const n = byId.get(id), f = n.callFrame, k = `${f.functionName || "(anonyme)"} ${f.url.split("/").pop()}:${f.lineNumber + 1}`; self.set(k, (self.get(k) || 0) + (dt[i] || 0) / 1000); });
const tot = [...self.values()].reduce((s, v) => s + v, 0);
console.log("profil (ms, temps propre, 8 dessins) total", tot.toFixed(0));
[...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).forEach(([k, v]) => console.log("  ", v.toFixed(1).padStart(8), k));
// inclusif par fonction : remonte l'arbre
const parent = new Map(); profile.nodes.forEach((n) => (n.children || []).forEach((c) => parent.set(c, n.id)));
const incl = new Map(); profile.samples.forEach((id, i) => { const seen = new Set(); let x = id; while (x != null) { const f = byId.get(x).callFrame, k = `${f.functionName || "(anonyme)"} ${f.url.split("/").pop()}:${f.lineNumber + 1}`; if (!seen.has(k)) { seen.add(k); incl.set(k, (incl.get(k) || 0) + (dt[i] || 0) / 1000); } x = parent.get(x); } });
console.log("profil inclusif (ms)");
[...incl.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).forEach(([k, v]) => console.log("  ", v.toFixed(1).padStart(8), k));
await browser.close(); await server.close();
