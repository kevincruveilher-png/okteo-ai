// Sans navigateur : métadonnées et correspondances. --browser : parcours réel Chromium.
import assert from "node:assert/strict";
import { APPAREILS } from "../src/cablage/appareils.js";
import { REGLES_BASE } from "../src/cablage/regles-data.js";
import { symbolEntries, filterSymbols, loadSymbols, saveSymbols } from "../src/ext/symbols-data.js";

const memory = new Map();
globalThis.localStorage = { getItem: (k) => memory.get(k) || null, setItem: (k, v) => memory.set(k, v) };
const types = { PC16: { n: "Prise 16 A" }, ...APPAREILS };
const data = loadSymbols(), entries = symbolEntries(types, data);
assert.equal(entries.filter((d) => d.origin === "okteo").length, Object.keys(types).length);
assert.equal(entries.find((d) => d.id === "be-kichouh-32a").type, "");
assert.equal(entries.find((d) => d.id === "be-kichouh-32a").image, "");
assert.equal(filterSymbols(entries, { q: "plaque cuisson", origin: "okteo" })[0].type, "PLAQ");
assert.equal(filterSymbols(entries, { q: "seche serviette" })[0].type, "SS");
assert.ok(filterSymbols(entries, { q: "R-096" }).every((d) => d.rules.includes("R-096")));
assert.equal(filterSymbols(entries, { origin: "be", category: "Prises" }).length, 0);
assert.ok(entries.every((d) => d.rules.every((id) => REGLES_BASE.rules.some((r) => r.id === id))));
data.overrides.PLAQ = { name: "Plaque — fiche du BE", rules: ["R-084"] };
assert.ok(saveSymbols(data));
assert.equal(symbolEntries(types, loadSymbols()).find((d) => d.id === "PLAQ").name, "Plaque — fiche du BE");
assert.equal(APPAREILS.PLAQ.n, "Plaque de cuisson"); // métadonnées séparées du moteur
assert.equal(APPAREILS.PLAQ.circuit.prot, 32);
memory.set("okteo.symbols.v1", "JSON invalide");
assert.equal(loadSymbols().be[0].type, "");
globalThis.localStorage.setItem = () => { throw new Error("quota"); };
assert.equal(saveSymbols(data), false);
delete globalThis.localStorage;
console.log("Bibliothèque : 14 vérifications des données réussies.");

if (process.argv.includes("--browser")) {
  const { chromium } = await import("playwright");
  const { createServer } = await import("vite");
  const server = await createServer({ server: { port: 5198, strictPort: true, open: false }, logLevel: "error" });
  let browser;
  try {
    await server.listen(); browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://localhost:5198");
    await page.waitForFunction(() => window.okteoExt);
    await page.evaluate(() => { window.okteoExt.iaMode.setMode("be"); window.okteo.setTab("bibliotheque"); });
    const total = await page.locator(".sy-card").count();
    assert.ok(total > 40);
    assert.ok(await page.locator("#side").isHidden());
    assert.ok(await page.locator(".sy-card").first().evaluate((e) => e.getBoundingClientRect().height < 130));
    for (const theme of ["dark", "light"]) {
      await page.evaluate((t) => document.documentElement.dataset.theme = t, theme);
      assert.ok(await page.locator("#bibliotheque").evaluate((e) => e.scrollWidth <= e.clientWidth + 1));
    }
    await page.locator("#sy-search").fill("plaque cuisson");
    await page.locator('[data-symbol="PLAQ"]').click();
    assert.match(await page.locator("#sy-detail").innerText(), /32 A/);
    await page.locator('[data-action="insert"]').click();
    assert.equal(await page.evaluate(() => window.okteo.tab), "plan");
    assert.equal(await page.evaluate(() => window.okteo.tool), "PLAQ");
    await page.evaluate(() => window.okteo.setTab("bibliotheque"));
    await page.locator('[data-action="add"]').click();
    await page.locator('[name="name"]').fill('Variante BE <script>');
    await page.locator('[name="rules"]').fill("R-999");
    await page.locator('#sy-form button[type="submit"]').click();
    assert.match(await page.locator(".sy-form-error").innerText(), /Règle inconnue/);
    await page.locator('[name="rules"]').fill("R-084");
    await page.locator('#sy-form button[type="submit"]').click();
    assert.ok(await page.locator('[data-action="insert"]').isDisabled());
    assert.match(await page.locator("#sy-detail").innerText(), /Non reconnu par Oktéo/);
    assert.equal(await page.locator("#sy-detail script").count(), 0);
    await page.reload(); await page.waitForFunction(() => window.okteoExt);
    await page.evaluate(() => window.okteo.setTab("bibliotheque"));
    assert.equal(await page.locator(".sy-card").count(), total + 1);
    await page.locator("#sy-origin").selectOption("be");
    await page.locator(".sy-card").filter({ hasText: "Variante BE" }).click();
    await page.locator('[data-action="edit"]').click();
    await page.locator('[name="type"]').selectOption("PLAQ");
    await page.locator('#sy-form button[type="submit"]').click();
    assert.ok(await page.locator('[data-action="insert"]').isEnabled());
    assert.match(await page.locator("#sy-detail").innerText(), /reconnaissance automatique/);
    assert.deepEqual(errors, []);
    console.log("Bibliothèque : parcours navigateur réussi.");
  } finally { await browser?.close(); await server.close(); }
}
