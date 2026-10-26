import { chromium } from "playwright";
import { createServer } from "vite";
const server = await createServer({ server: { port: 5298, strictPort: true, open: false }, logLevel: "error" });
await server.listen();
const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1500, height: 900 } });
const ev = (f, a) => page.evaluate(f, a);
await page.goto("http://localhost:5298/"); await ev(() => localStorage.clear()); await page.reload();
await page.waitForFunction(() => window.okteo && window.okteoExt);
await ev(() => { localStorage.setItem("okteo.tour.v1", "{\"seen\":true}"); });
// pose deux prises
await ev(() => { okteo.importDevices([{ t: "PC16", x: 3, y: 3 }, { t: "LUM", x: 6, y: 5 }]); okteo.fit(); });
const p = await ev(() => { const a = okteo.state.app[0]; return okteo.toClient(a.x, a.y); });
const hud = () => ev(() => { const h = document.querySelector(".hud") || document.getElementById("hud"); return h ? (h.hidden ? "caché" : "visible") : "absent"; });
await ev(() => okteo.setTool("sel"));
await page.mouse.click(p.x, p.y); console.log("après clic appareil", await hud(), await ev(() => okteo.selection.join()));
await page.mouse.click(p.x + 200, p.y + 150); console.log("après clic dans le vide", await hud(), await ev(() => okteo.selection.join()));
await page.mouse.click(p.x, p.y); await page.keyboard.press("Escape"); console.log("après Échap", await hud());
await page.mouse.click(p.x, p.y); await page.click('#tabs button[data-tab="boites"]'); await page.click('#tabs button[data-tab="plan"]'); console.log("après changement d'onglet", await hud());
await page.mouse.click(p.x, p.y); await ev(() => okteo.setTool("lien")); console.log("après outil Liaison", await hud());

await b.close(); await server.close();
