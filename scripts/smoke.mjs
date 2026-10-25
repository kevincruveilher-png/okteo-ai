// Test automatique d'Oktéo AI : npm run check
// Lance le logiciel dans un Chromium invisible et vérifie le dessin, la palette, les paramètres,
// l'assistant et le relais IA. Les fournisseurs IA sont remplacés par un faux serveur local :
// aucun appel réel n'est fait, aucune clé n'est nécessaire.
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as pdfjsNode from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractSegments } from "../src/walls/extract.js";
import { chromium } from "playwright";
import { createServer } from "vite";

const MOCK_PORT = 5201, APP_PORT = 5199;
const seen = [];

// ---------- faux fournisseurs IA ----------
const mock = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const j = JSON.parse(body || "{}");
    seen.push({ url: req.url, headers: req.headers, body: j });
    const msgs = j.messages || [];
    const last = msgs[msgs.length - 1] || {};
    const lastText = typeof last.content === "string" ? last.content : (last.content || []).map((c) => c.text || "").join(" ");
    const hasImage = Array.isArray(last.content) && last.content.some((c) => c.type === "image" || c.type === "image_url");
    let text = "OK";
    if (/nemotron-test/.test(lastText)) text = "<think>brouillon secret</think>Réponse Nemotron.";
    if (/outil pi[eè]ce/i.test(lastText)) text = 'Je lance l\'outil Pièce : glissez un rectangle.\n```okteo\n{"actions":[{"do":"cmd","id":"tool.piece"}]}\n```';
    else if (/Analyse ce plan/.test(lastText)) {
      const rid = (j.system || msgs[0]?.content || "").match(/"id":"(r\d+)"/)?.[1] || "r1";
      text = `## Dessin\n- La pièce [${rid}] n'a pas de point lumineux.\n## Priorités\n1. Ajouter un point lumineux${hasImage ? "\n(image reçue)" : ""}\n\`\`\`okteo\n{"suggest":[{"do":"zoom","ids":["${rid}"],"label":"Voir la pièce"}]}\n\`\`\``;
    }
    res.setHeader("content-type", "application/json");
    if (req.url === "/v1/models") return res.end(JSON.stringify({ data: [{ id: "meta/llama-3.3-70b-instruct" }, { id: "nvidia/llama-3.2-nv-embedqa-1b-v2" }, { id: "nvidia/nemotron-3.5-super-vl-120b-a12b" }, { id: "nvidia/llama-3.3-nemotron-super-49b-v1.5" }] }));
    if (j.model === "nvidia/nemotron-nano-12b-v2-vl") { res.statusCode = 410; return res.end(JSON.stringify({ error: { message: "The model 'nvidia/nemotron-nano-12b-v2-vl' has reached its end of life" } })); }
    if (req.url === "/v1/messages") {
      if (req.headers["x-api-key"] !== "sk-test") { res.statusCode = 401; return res.end(JSON.stringify({ error: { message: "invalid x-api-key" } })); }
      return res.end(JSON.stringify({ content: [{ type: "text", text }] }));
    }
    if (req.url === "/v1/chat/completions") {
      if (req.headers.authorization !== "Bearer nvapi-test") { res.statusCode = 401; return res.end(JSON.stringify({ error: { message: "unauthorized" } })); }
      return res.end(JSON.stringify({ choices: [{ message: { content: text } }] }));
    }
    res.statusCode = 404; res.end("{}");
  });
});
await new Promise((r) => mock.listen(MOCK_PORT, r));

process.env.OKTEO_ANTHROPIC_URL = `http://localhost:${MOCK_PORT}`;
process.env.OKTEO_NVIDIA_URL = `http://localhost:${MOCK_PORT}`;
delete process.env.ANTHROPIC_API_KEY; delete process.env.NVIDIA_API_KEY;

const server = await createServer({ server: { port: APP_PORT, strictPort: true, open: false }, logLevel: "error" });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

let ok = 0;
const fails = [];
async function check(name, fn) {
  try { const r = await fn(); if (r === false) throw new Error("condition fausse"); ok++; console.log("  ✓ " + name); }
  catch (e) { fails.push(name + " : " + e.message); console.log("  ✗ " + name + " : " + e.message); }
}
const ev = (f, a) => page.evaluate(f, a);

try {
  await page.goto(`http://localhost:${APP_PORT}/`);
  await ev(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.okteo && window.okteoExt);

  console.log("Dessin");
  await check("une pièce tracée = 4 murs", async () => {
    const before = await ev(() => okteo.state.segs.length);
    await page.keyboard.press("e");
    const box = await page.locator("#sv").boundingBox();
    await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.35);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.6, { steps: 8 });
    await page.mouse.up();
    return (await ev(() => okteo.state.segs.length)) - before === 4;
  });

  console.log("Appareils attachés aux murs");
  // murs de la pièce tracée ci-dessus (EVRARD)
  const wallsOf = () => ev(() => {
    const rm = okteo.state.rooms[0], X0 = Math.min(rm.x0, rm.x1), X1 = Math.max(rm.x0, rm.x1), Y0 = Math.min(rm.y0, rm.y1), Y1 = Math.max(rm.y0, rm.y1);
    const N = (id) => okteo.state.nodes.find((n) => n.id === id);
    const find = (f) => okteo.state.segs.find((s) => f(N(s.a), N(s.b)))?.id;
    const near = (a, b) => Math.abs(a - b) < 0.02;
    return { X0, X1, Y0, Y1,
      top: find((a, b) => near(a.y, Y0) && near(b.y, Y0)), left: find((a, b) => near(a.x, X0) && near(b.x, X0)), right: find((a, b) => near(a.x, X1) && near(b.x, X1)) };
  });
  const A = (id) => ev((i) => { const a = okteo.state.app.find((x) => x.id === i); return a && { x: a.x, y: a.y, seg: a.seg || null, wa: a.wa || null }; }, id);
  const M = (id) => ev((i) => okteo.measure(i), id);
  const dragWall = async (segId, dx, dy) => {
    await page.keyboard.press("v");
    const p = await ev((i) => { const s = okteo.state.segs.find((g) => g.id === i), a = okteo.state.nodes.find((n) => n.id === s.a), b = okteo.state.nodes.find((n) => n.id === s.b); return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }, segId);
    const c0 = await ev((q) => okteo.toClient(q.x, q.y), p), c1 = await ev((q) => okteo.toClient(q.x, q.y), { x: p.x + dx, y: p.y + dy });
    await page.mouse.move(c0.x, c0.y); await page.mouse.down(); await page.mouse.move(c1.x, c1.y, { steps: 8 }); await page.mouse.up();
    await page.keyboard.press("Escape");
  };
  let W, pr, p0;
  await check("prise posée à 30 cm de l'angle : position le long du mur mémorisée", async () => {
    W = await wallsOf();
    await page.keyboard.press("p");
    const c = await ev((q) => okteo.toClient(q.x, q.y), { x: W.X0 + 0.7, y: W.Y0 + 0.2 });
    await page.mouse.move(c.x, c.y); await page.mouse.move(c.x + 2, c.y + 1);
    await page.keyboard.type("30"); await page.keyboard.press("Enter");
    pr = await ev(() => okteo.state.app.at(-1).id); p0 = await A(pr);
    const m = await M(pr);
    return p0.seg === W.top && Math.abs(m.near - 0.30) < 0.005 && p0.wa && Math.abs(p0.wa.d - 0.30) < 0.005;
  });
  await check("déplacer le mur : la prise suit (50 cm) et reste à 30 cm de l'angle", async () => {
    await dragWall(W.top, 0, -0.5);
    const p1 = await A(pr), m = await M(pr);
    return Math.abs((p0.y - p1.y) - 0.5) < 0.01 && Math.abs(p1.x - p0.x) < 0.01 && Math.abs(m.near - 0.30) < 0.005;
  });
  await check("allonger le mur par l'autre bout : la prise ne bouge pas", async () => {
    const before = await A(pr);
    await dragWall(W.right, 1.0, 0);
    const p1 = await A(pr), m = await M(pr);
    return Math.abs(p1.x - before.x) < 0.005 && Math.abs(p1.y - before.y) < 0.005 && Math.abs(m.near - 0.30) < 0.005;
  });
  await check("déplacer le mur d'angle : la prise garde ses 30 cm", async () => {
    const before = await A(pr);
    await dragWall(W.left, -0.4, 0);
    const p1 = await A(pr), m = await M(pr);
    return Math.abs((before.x - p1.x) - 0.4) < 0.01 && Math.abs(m.near - 0.30) < 0.005;
  });
  await check("épaissir le mur d'angle (20 → 30 cm) : toujours 30 cm de sa face", async () => {
    const before = await A(pr);
    await ev((i) => okteo.select([i]), W.left);
    await page.waitForSelector('#hud [data-h="ep"]');
    await page.fill('#hud [data-h="ep"]', "30"); await page.dispatchEvent('#hud [data-h="ep"]', "change");
    await ev(() => document.activeElement && document.activeElement.blur()); await page.keyboard.press("Escape");
    const p1 = await A(pr), m = await M(pr);
    return Math.abs((p1.x - before.x) - 0.05) < 0.005 && Math.abs(m.near - 0.30) < 0.005;
  });
  await check("supprimer le mur : Oktéo demande ; « garder » laisse la prise détachée", async () => {
    await ev((i) => okteo.select([i]), W.top);
    await page.keyboard.press("Delete");
    await page.waitForSelector("#sd-keep");
    const txt = await page.textContent("#sidebody");
    await page.click("#sd-keep");
    const p1 = await A(pr);
    return txt.includes("1 appareil") && p1 && p1.seg === null && !(await ev((i) => okteo.state.segs.some((s) => s.id === i), W.top));
  });
  await check("Ctrl+Z puis « supprimer avec ses appareils » : la prise part avec le mur", async () => {
    await page.keyboard.press("Control+z");
    const back = await A(pr);
    if (!back || back.seg !== W.top) throw new Error("annulation : " + JSON.stringify(back));
    await ev((i) => okteo.select([i]), W.top);
    await page.keyboard.press("Delete");
    await page.waitForSelector("#sd-all"); await page.click("#sd-all");
    const gone = !(await A(pr));
    await page.keyboard.press("Control+z");
    return gone && (await A(pr)) && (await A(pr)).seg === W.top;
  });
  await check("tourner puis symétriser la pièce : la prise reste sur son mur, côté intérieur, à 30 cm", async () => {
    // « à l'intérieur » = dans le cadre formé par les murs de la pièce (le rectangle de la pièce n'a pas suivi les murs déplacés)
    const inside = async () => ev((i) => { const a = okteo.state.app.find((x) => x.id === i), rm = okteo.state.rooms[0];
      const ns = rm.segs.flatMap((sid) => { const s = okteo.state.segs.find((g) => g.id === sid); return s ? [s.a, s.b] : []; }).map((id) => okteo.state.nodes.find((n) => n.id === id));
      const xs = ns.map((n) => n.x), ys = ns.map((n) => n.y);
      return a.x > Math.min(...xs) && a.x < Math.max(...xs) && a.y > Math.min(...ys) && a.y < Math.max(...ys); }, pr);
    const rid = await ev(() => okteo.state.rooms[0].id);
    await ev((i) => okteo.select([i]), rid);
    await page.keyboard.press("r");
    const r1 = (await A(pr)).seg === W.top && Math.abs((await M(pr)).near - 0.30) < 0.005 && (await inside());
    await ev((i) => okteo.select([i]), rid);
    await page.keyboard.press("x");
    const r2 = (await A(pr)).seg === W.top && Math.abs((await M(pr)).near - 0.30) < 0.005 && (await inside());
    return r1 && r2;
  });
  await page.keyboard.press("Escape");

  console.log("Fonctions (Ctrl+K) et infobulles");
  await check("infobulle de l'outil Pièce avec raccourci", async () => (await page.getAttribute('button[data-tool="piece"]', "title")).includes("(E)"));
  await check("Ctrl+K ouvre la palette", async () => { await page.keyboard.press("Control+k"); return await page.isVisible(".pal"); });
  await check("recherche « fenetre » + Entrée active l'outil Fenêtre", async () => {
    await page.fill(".pal-q", "fenetre");
    const first = await page.textContent(".pal-row.cur b");
    await page.keyboard.press("Enter");
    return /fenêtre/i.test(first) && (await ev(() => okteo.tool)) === "fenetre" && !(await page.isVisible(".pal"));
  });
  await check("le catalogue couvre tous les outils de la barre", async () => ev(() => {
    const ids = [...document.querySelectorAll("#tools button[data-tool]")].map((b) => b.dataset.tool);
    return ids.every((t) => document.querySelector(`#tools button[data-tool="${t}"]`).title.length > 5);
  }));

  console.log("Assistant sans clé");
  await check("touche A ouvre l'assistant", async () => { await page.keyboard.press("Escape"); await page.keyboard.press("a"); return await page.isVisible(".as-in textarea"); });
  await check("sans clé : recherche locale dans les fonctions", async () => {
    await page.fill(".as-in textarea", "porte"); await page.keyboard.press("Enter");
    await page.waitForSelector(".as-meta");
    return (await page.textContent(".as-msgs")).includes("Recherche locale");
  });

  console.log("Paramètres et relais IA");
  await check("onglet Paramètres remplace la zone de dessin", async () => {
    await page.click('#tabs button[data-tab="params"]');
    return (await page.isVisible("#params .pcard")) && !(await page.isVisible(".stage"));
  });
  await check("clé Claude : test de connexion réussi via le relais local", async () => {
    await page.fill('.pcard[data-p="anthropic"] .k', "sk-test");
    await page.click('.pcard[data-p="anthropic"] .tst');
    await page.waitForSelector('.pcard[data-p="anthropic"] .tres.good, .pcard[data-p="anthropic"] .tres.bad');
    const t = await page.textContent('.pcard[data-p="anthropic"] .tres');
    const req = seen.at(-1);
    if (!t.includes("Connecté")) throw new Error(t);
    return req.url === "/v1/messages" && req.headers["x-api-key"] === "sk-test" && req.headers["anthropic-version"];
  });
  await check("mauvaise clé : message clair en français", async () => {
    await page.fill('.pcard[data-p="nvidia"] .k', "nvapi-FAUX");
    await page.click('.pcard[data-p="nvidia"] .tst');
    await page.waitForSelector('.pcard[data-p="nvidia"] .tres.bad');
    return (await page.textContent('.pcard[data-p="nvidia"] .tres')).includes("Clé refusée");
  });
  await check("clé NVIDIA : test réussi (en-tête Bearer)", async () => {
    await page.fill('.pcard[data-p="nvidia"] .k', "nvapi-test");
    await page.click('.pcard[data-p="nvidia"] .tst');
    await page.waitForSelector('.pcard[data-p="nvidia"] .tres.good');
    return seen.at(-1).headers.authorization === "Bearer nvapi-test";
  });
  await check("les clés ne sont pas dans la sauvegarde du chantier", async () => ev(() => !localStorage.getItem("okteo.evrard.04949.v4")?.includes("sk-test")));
  await check("choix du fournisseur Claude", async () => { await page.check('input[name="prov"][value="anthropic"]'); return (await ev(() => okteoExt.settings.activeProvider())) === "anthropic"; });

  console.log("Assistant avec IA");
  await check("« Active l'outil pièce » : l'assistant agit seul", async () => {
    await page.click('#tabs button[data-tab="plan"]');
    await ev(() => okteo.setTool("sel"));
    await page.fill(".as-in textarea", "Active l'outil pièce"); await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelectorAll(".as-log").length > 0);
    const log = await page.textContent(".as-msgs");
    return (await ev(() => okteo.tool)) === "piece" && log.includes("✓ Tracer une pièce") && !log.includes("```");
  });
  await check("« Analyser le plan » envoie une image + les données", async () => {
    const n = seen.length;
    await page.click(".as-an");
    await page.waitForFunction((k) => document.querySelectorAll(".as-msg.a:not(.busy)").length >= k && !document.querySelector(".busy"), 3, { timeout: 20000 });
    const req = seen.slice(n).find((r) => r.url === "/v1/messages");
    const last = req.body.messages.at(-1);
    const img = Array.isArray(last.content) && last.content.find((c) => c.type === "image");
    if (!img) throw new Error("pas d image ; journal : " + (await page.$$eval(".as-log", (els) => els.map((e) => e.textContent).join(" | "))) + " ; contenu : " + JSON.stringify(last).slice(0, 200));
    if (img.source.data.length < 20000) throw new Error("image trop petite : " + img.source.data.length);
    return req.body.system.includes('"pieces"') && req.body.system.includes("tool.piece");
  });
  await check("repère [r…] cliquable → sélectionne la pièce", async () => {
    await page.click(".as-msg.a:last-of-type a.obj");
    return (await ev(() => okteo.selection.join())).startsWith("room:");
  });
  await check("bouton proposé « Voir la pièce »", async () => { await page.click(".as-sug >> text=Voir la pièce"); return (await page.textContent(".as-msgs")).includes("✓ Vue centrée"); });
  await check("historique conservé après rechargement", async () => {
    await page.reload(); await page.waitForFunction(() => window.okteoExt);
    return (await ev(() => okteoExt.assistant.history.length)) > 4;
  });
  await check("le panneau rouvre l'assistant là où on l'avait laissé", async () => page.isVisible(".as-in textarea"));
  await check("image IA : tout le fond de plan est cadré", async () => ev(async () => {
    const m = await import("/src/ext/plan-data.js"); const e = okteo.extent();
    return (e.x1 - e.x0) > 14 && (await m.planImage(okteo)).data.length > 50000;
  }));

  console.log("Nemotron (NVIDIA)");
  await check("Nemotron par défaut, réponse directe, brouillon masqué", async () => {
    await ev(() => okteoExt.settings.set({ provider: "nvidia" }));
    const n = seen.length;
    await page.fill(".as-in textarea", "question nemotron-test"); await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelector(".as-msgs").textContent.includes("Réponse Nemotron"));
    const req = seen.slice(n).find((r) => r.url === "/v1/chat/completions");
    const txt = await page.textContent(".as-msgs");
    return req.body.model === "nvidia/nemotron-3.5-super-vl-120b-a12b" && req.body.chat_template_kwargs?.enable_thinking === false && !txt.includes("brouillon");
  });
  await check("analyse avec Nemotron : réflexion activée, image allégée (< 180 Ko)", async () => {
    const n = seen.length;
    await page.click(".as-an");
    await page.waitForFunction(() => !document.querySelector(".busy") && document.querySelectorAll(".as-msg.u").length >= 4, null, { timeout: 20000 });
    await page.waitForFunction(() => !document.querySelector(".busy"));
    const req = seen.slice(n).find((r) => r.url === "/v1/chat/completions");
    const img = req.body.messages.at(-1).content.find((c) => c.type === "image_url");
    return req.body.chat_template_kwargs?.enable_thinking === true && img && img.image_url.url.length <= 240000 + 30;
  });

  await check("modèle retiré (410) : remplacé automatiquement par un Nemotron qui voit les images", async () => {
    await page.click('#tabs button[data-tab="params"]');
    await page.fill('.pcard[data-p="nvidia"] .m', "nvidia/nemotron-nano-12b-v2-vl");
    await page.click('.pcard[data-p="nvidia"] .tst');
    await page.waitForSelector('.pcard[data-p="nvidia"] .tres.good, .pcard[data-p="nvidia"] .tres.bad');
    const t = await page.textContent('.pcard[data-p="nvidia"] .tres');
    if (!t.includes("remplacé")) throw new Error(t);
    return (await ev(() => okteoExt.settings.get().models.nvidia)) === "nvidia/nemotron-3.5-super-vl-120b-a12b";
  });
  await check("« Charger les modèles » lit la liste du compte NVIDIA", async () => {
    await page.click('.pcard[data-p="nvidia"] .lst');
    await page.waitForSelector('.pcard[data-p="nvidia"] .tres.good');
    const t = await page.textContent('.pcard[data-p="nvidia"] .tres');
    const first = await page.getAttribute('#dl-nvidia option:first-child', "value");
    return t.includes("4 modèles") && first.includes("nemotron");
  });
  await page.click('#tabs button[data-tab="plan"]');

  console.log("Chantiers");
  const nbCh = () => ev(() => JSON.parse(localStorage.getItem("okteo.chantiers.v1")).length);
  const reopened = async () => { await page.waitForFunction(() => window.okteo && window.okteoExt); };
  await check("EVRARD repris comme chantier ouvert (ancienne sauvegarde conservée)", async () => {
    await page.click('#tabs button[data-tab="chantiers"]');
    return (await page.textContent(".ch-list")).includes("EVRARD") && (await page.textContent(".badge")).includes("EVRARD") && !(await page.isVisible(".stage"));
  });
  const evrardRooms = await ev(() => okteo.state.rooms.length);
  await check("nouveau chantier avec le PDF : vignettes des pages, choix de la page 3", async () => {
    await page.click("#ch-new"); await page.fill("#nf-nom", "ESSAI"); await page.fill("#nf-num", "99999"); await page.fill("#nf-cli", "Maisons Test");
    await page.setInputFiles("#nf-file", "docs/plans/EVRARD_04949_plan.pdf");
    await page.waitForSelector(".thumb", { timeout: 30000 });
    const n = await page.locator(".thumb").count();
    await page.click('.thumb[data-page="3"]');
    return n === 3 && (await page.isVisible('.thumb.on[data-page="3"]'));
  });
  await check("création : chantier ouvert, fond haute définition chargé, échelle à régler", async () => {
    await Promise.all([page.waitForNavigation({ timeout: 60000 }), page.click("#nf-ok")]);
    await reopened();
    await page.waitForFunction(() => okteo.FOND && okteo.FOND.startsWith("blob:"), null, { timeout: 30000 });
    const px = await ev(() => JSON.parse(localStorage.getItem("okteo.chantiers.v1")).find((c) => c.nom === "ESSAI").fond.pxW);
    return (await page.textContent(".badge")).includes("ESSAI · 99999") && (await ev(() => okteo.tool)) === "calib" && (await ev(() => okteo.state.rooms.length)) === 0 && px > 3000;
  });
  await check("mise à l'échelle 2 points : la cote mesure exactement 10,00 m", async () => {
    const box = await page.locator("#sv").boundingBox();
    const w0 = await ev(() => okteo.BG.w);
    await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.5);
    await page.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.52);   // angles droits : ramené à l'horizontale
    await page.waitForSelector("#cl-L");
    const before = parseFloat(await page.textContent("#sidebody .note b.num"));
    await page.fill("#cl-L", "10"); await page.click("#cl-ok");
    const ratio = (await ev(() => okteo.BG.w)) / w0, expected = 10 / before;
    const meta = await ev(() => JSON.parse(localStorage.getItem("okteo.chantiers.v1")).find((c) => c.nom === "ESSAI").fond);
    return Math.abs(ratio - expected) / expected < 0.002 && meta.calibre === true && (await ev(() => okteo.tool)) === "sel";
  });
  console.log("Relevé automatique des murs");
  let nbMurs = 0;
  await check("après l'échelle, Oktéo propose de relever les murs", async () => {
    await page.waitForSelector(".wcard:not([hidden])", { timeout: 5000 });
    return (await page.textContent(".wcard")).includes("Relever les murs");
  });
  await check("aperçu : murs grisés du PDF, épaisseurs, ouvertures (rien n'est encore ajouté)", async () => {
    await page.click(".wcard button.on");
    await page.waitForSelector("#w-ok", { timeout: 30000 });
    const r = await ev(() => okteoExt.walls.result);
    nbMurs = r.walls.length;
    return r.mode === "aplats" && nbMurs >= 20 && r.openings.length >= 12 && (await page.textContent(".wcard")).includes("murs grisés") && (await ev(() => okteo.state.segs.length)) === 0;
  });
  await check("échelle contrôlée par les cotes du plan ; « Corriger l'échelle » la remet juste", async () => {
    await page.waitForSelector("#w-scale");
    const t0 = await page.textContent("#w-scale");
    if (process.env.SHOT) { console.log("    " + t0.trim().replace(/\s+/g, " ")); await page.screenshot({ path: process.env.SHOT + "/echelle.png" }); }
    if (t0.includes("✓")) return true;                       // échelle déjà juste à 1,5 % près
    const w0 = await ev(() => okteo.BG.w);
    await page.click("#w-fix");
    await page.waitForSelector(".wcard:not([hidden]) .wrow button.on");
    await page.click(".wcard .wrow button.on");              // « Relever les murs » reproposé après la correction
    await page.waitForSelector("#w-ok", { timeout: 30000 });
    const t1 = await page.textContent("#w-scale"), w1 = await ev(() => okteo.BG.w);
    if (process.env.SHOT) console.log("    " + t1.trim().replace(/\s+/g, " "));
    nbMurs = (await ev(() => okteoExt.walls.result)).walls.length;
    if (!t1.includes("✓")) throw new Error(t0 + " → " + t1);
    return t0.includes("⚠") && Math.abs(w1 / w0 - 1) > 0.015 && nbMurs >= 20;
  });
  await check("épaisseur max. réglable : le relevé se recalcule", async () => {
    const r0 = await ev(() => okteoExt.walls.result);
    const eps = r0.walls.map((w) => w.ep * 100), mid = Math.round((Math.min(...eps) + Math.max(...eps)) / 2);
    await page.fill("#w-max", String(mid)); await page.dispatchEvent("#w-max", "change");
    const r1 = await ev(() => okteoExt.walls.result);
    const ok1 = r1.walls.length > 0 && r1.walls.length < nbMurs && r1.walls.every((w) => w.ep * 100 <= mid);
    await page.fill("#w-max", "45"); await page.dispatchEvent("#w-max", "change");
    return ok1 && (await ev(() => okteoExt.walls.result.walls.length)) === nbMurs;
  });
  await check("ajout au dessin : murs reliés, épaisseurs réelles gardées, un seul Ctrl+Z", async () => {
    await page.click("#w-ok");
    const s = await ev(() => {
      const deg = {}; okteo.state.segs.forEach((g) => { deg[g.a] = (deg[g.a] || 0) + 1; deg[g.b] = (deg[g.b] || 0) + 1; });
      return { n: okteo.state.segs.length, o: okteo.state.openings.length, eps: new Set(okteo.state.segs.map((g) => Math.round(g.ep * 100))).size, j: Object.values(deg).filter((d) => d >= 2).length };
    });
    if (s.n !== nbMurs || s.o < 12 || s.eps < 2 || s.j < 14) throw new Error(JSON.stringify(s));
    await page.keyboard.press("Control+z");
    const undone = await ev(() => okteo.state.segs.length + okteo.state.openings.length);
    await page.keyboard.press("Control+y");
    return undone === 0 && (await ev(() => okteo.state.segs.length)) === nbMurs && !(await page.isVisible(".wcard"));
  });
  console.log("Détection des pièces");
  await check("après le relevé, les pièces sont proposées avec leurs noms lus sur le plan", async () => {
    await page.waitForSelector("#r-ok", { timeout: 30000 });
    const r = await ev(() => okteoExt.rooms.result);
    const names = r.rooms.map((x) => x.name).sort().join("|");
    return r.rooms.length === 7 && r.nLabels === 9 && names === "Bains|Cellier|Chambre 1|Chambre 2|Dressing|Espace de Vie|Garage";
  });
  await check("ajout des pièces : formes réelles (séjour en L), surfaces, avertissement mur manquant", async () => {
    await page.click("#r-ok");
    const s = await ev(() => okteo.state.rooms.map((r) => ({ n: r.name, c: r.cycle.length, a: okteo.roomArea(r), also: r.also })));
    const sej = s.find((r) => r.n === "Espace de Vie");
    return s.length === 7 && sej.c > 4 && sej.also.includes("WC") && s.every((r) => r.a > 2);
  });
  await check("la surface d'une pièce détectée suit ses murs", async () => {
    const before = await ev(() => { const r = okteo.state.rooms.find((x) => x.name === "Chambre 2"); return { a: okteo.roomArea(r), seg: r.cycle[0].seg }; });
    // déplacer d'un coup le premier mur du contour, puis annuler
    const moved = await ev((sid) => { const s = okteo.state.segs.find((g) => g.id === sid), A = okteo.state.nodes.find((n) => n.id === s.a), B = okteo.state.nodes.find((n) => n.id === s.b);
      const dx = Math.abs(A.x - B.x) < 1e-6 ? 0.5 : 0, dy = dx ? 0 : 0.5; okteo.snapshot(); A.x += dx; B.x += dx; A.y += dy; B.y += dy; okteo.draw();
      return okteo.roomArea(okteo.state.rooms.find((x) => x.name === "Chambre 2")); }, before.seg);
    await ev(() => okteo.undo());
    const after = await ev(() => okteo.roomArea(okteo.state.rooms.find((x) => x.name === "Chambre 2")));
    return Math.abs(moved - before.a) > 0.3 && Math.abs(after - before.a) < 1e-6;
  });
  await check("un appareil posé dans une pièce détectée sait dans quelle pièce il est", async () => ev(() => {
    const r = okteo.state.rooms.find((x) => x.name === "Chambre 1"), p = okteo.roomPoly(r), c = p.reduce((m, q) => ({ x: m.x + q.x / p.length, y: m.y + q.y / p.length }), { x: 0, y: 0 });
    return okteo.roomAt(c.x, c.y)?.name === "Chambre 1";
  }));

  console.log("Relevé des appareils");
  await check("après les pièces, les appareils du PDF sont proposés (aperçu, rien d'ajouté)", async () => {
    await page.waitForSelector("#d-ok", { timeout: 30000 });
    const r = await ev(() => okteoExt.devices.result);
    const t = await page.textContent(".wcard:not([hidden])");
    return r.stats.byType.LUM === 10 && r.links.length >= 20 && t.includes("Point lumineux") && t.includes("liaisons") && t.includes("Hauteurs lues sur le plan") && (await ev(() => okteo.state.app.length)) === 0;
  });
  await check("ajout : prises et interrupteurs collés à leur mur, liaisons reprises, un seul Ctrl+Z", async () => {
    const n = await ev(() => okteoExt.devices.result.devices.length);
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + "/appareils-apercu.png" });
    await page.click("#d-ok");
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + "/appareils-ajoutes.png" });
    const s = await ev(() => {
      const A = okteo.state.app, wall = A.filter((a) => ["PC16", "PC20", "RJ45", "INT", "VV", "SC"].includes(a.t));
      return { n: A.length, wall: wall.length, att: wall.filter((a) => a.seg && a.wa).length, lia: okteo.state.lia.length, lum: A.filter((a) => a.t === "LUM" && !a.seg).length };
    });
    if (s.n !== n || s.att < s.wall * 0.9 || s.lia < 20 || s.lum !== 10) throw new Error(JSON.stringify(s));
    await page.keyboard.press("Control+z");
    const undone = await ev(() => okteo.state.app.length + okteo.state.lia.length);
    await page.keyboard.press("Control+y");
    return undone === 0 && (await ev(() => okteo.state.app.length)) === n && !(await page.isVisible(".wcard"));
  });
  await check("hauteurs lues sur le plan (police codée) : prises à 110, 120, 65 cm ; affichées dans la carte", async () => {
    const hs = await ev(() => okteo.state.app.filter((a) => a.t.startsWith("PC") && a.h !== 30).map((a) => a.h));
    return hs.length >= 10 && [110, 120, 65].every((h) => hs.includes(h));
  });
  await check("une prise relevée mesure sa distance à l'angle et suit son mur", async () => ev(() => {
    const a = okteo.state.app.find((x) => x.t === "PC16" && x.seg), m = okteo.measure(a.id);
    const s = okteo.state.segs.find((g) => g.id === a.seg), A = okteo.state.nodes.find((n) => n.id === s.a), B = okteo.state.nodes.find((n) => n.id === s.b);
    const vert = Math.abs(A.x - B.x) < 1e-6, x0 = a.x, y0 = a.y;
    okteo.snapshot(); if (vert) { A.x += 0.3; B.x += 0.3; } else { A.y += 0.3; B.y += 0.3; } okteo.draw();
    const moved = vert ? Math.abs(a.x - x0 - 0.3) < 0.01 : Math.abs(a.y - y0 - 0.3) < 0.01;
    okteo.undo();
    return m && m.near >= 0 && moved;
  }));

  console.log("Impression PDF");
  let pdfBytes = null, lay = null, geoW = 0;
  await check("Ctrl+P : aperçu du PDF, format et échelle choisis automatiquement", async () => {
    await page.keyboard.press("Control+p");
    await page.waitForSelector(".pr-back:not([hidden])");
    await page.waitForFunction(() => okteoExt.printer.last && !document.querySelector(".pr-wait:not([hidden])"), null, { timeout: 30000 });
    lay = await ev(() => okteoExt.printer.last.layout);
    return lay.fits && (await page.textContent(".pr-info")).includes("1:" + lay.scale);
  });
  await check("téléchargement : PDF de 2 pages (plan + nomenclature) avec cartouche et noms de pièces", async () => {
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click(".pr-dl")]);
    const f = path.join(os.tmpdir(), "okteo-plan.pdf"); await dl.saveAs(f);
    pdfBytes = new Uint8Array(fs.readFileSync(f));
    const doc = await pdfjsNode.getDocument({ data: pdfBytes.slice(), verbosity: 0 }).promise;
    const p1 = await doc.getPage(1), vp = p1.getViewport({ scale: 1 });
    const txt = async (p) => (await (await doc.getPage(p)).getTextContent()).items.map((i) => i.str).join(" ");
    const t1 = await txt(1), t2 = doc.numPages > 1 ? await txt(2) : "";
    const [L, S] = { A4: [841.89, 595.28], A3: [1190.55, 841.89] }[lay.paper];
    const sizeOk = Math.abs(Math.max(vp.width, vp.height) - L) < 1 && Math.abs(Math.min(vp.width, vp.height) - S) < 1;
    if (!sizeOk) throw new Error(`taille ${vp.width}×${vp.height}`);
    return doc.numPages === 2 && t1.includes("ESSAI") && t1.includes("1:" + lay.scale) && t1.includes("Garage") && t1.includes("Chambre 1") && t1.includes("PLAN") && t2.includes("Nomenclature") && dl.suggestedFilename().endsWith(".pdf");
  });
  await check("échelle exacte : la largeur des murs dans le PDF = largeur réelle × 1000 / échelle", async () => {
    geoW = await ev(() => { const g = okteo.exportGeometry(), xs = g.walls.flat().map((p) => p.x); return Math.max(...xs) - Math.min(...xs); });
    const doc = await pdfjsNode.getDocument({ data: pdfBytes.slice(), verbosity: 0 }).promise;
    const ex = await extractSegments(await doc.getPage(1), pdfjsNode.OPS);
    // gris des murs (60,60,60) ; jsPDF l'écrit avec 3 décimales, d'où un arrondi possible à ±2
    const grey60 = (h) => h && [1, 3, 5].every((i) => Math.abs(parseInt(h.slice(i, i + 2), 16) - 60) <= 2);
    const wallSegs = ex.segs.filter((s) => grey60(s.fill));
    const xs = wallSegs.flatMap((s) => [s.x1, s.x2]), wPt = Math.max(...xs) - Math.min(...xs);
    const expected = geoW * 1000 / lay.scale * 72 / 25.4;
    if (Math.abs(wPt - expected) > 0.5) throw new Error(`${wPt.toFixed(2)} pt au lieu de ${expected.toFixed(2)} pt`);
    return wallSegs.length > 50;
  });
  await check("format et échelle imposés (A3, 1:100) : pris en compte", async () => {
    await page.selectOption('.pr [data-k="paper"]', "A3"); await page.selectOption('.pr [data-k="scale"]', "100");
    await page.waitForFunction(() => okteoExt.printer.last && okteoExt.printer.last.layout.scale === 100 && okteoExt.printer.last.layout.paper === "A3", null, { timeout: 30000 });
    await page.selectOption('.pr [data-k="paper"]', "auto"); await page.selectOption('.pr [data-k="scale"]', "auto");
    await page.keyboard.press("Escape");
    return !(await page.isVisible(".pr"));
  });

  await check("l'épaisseur d'un mur relevé se modifie dans son menu", async () => {
    const id = await ev(() => okteo.state.segs[0].id);
    await ev((i) => okteo.select([i]), id);
    await page.waitForSelector('#hud [data-h="ep"]');
    await page.fill('#hud [data-h="ep"]', "25"); await page.dispatchEvent('#hud [data-h="ep"]', "change");
    return (await ev((i) => okteo.state.segs.find((g) => g.id === i).ep, id)) === 0.25;
  });
  await ev(() => document.activeElement && document.activeElement.blur());   // sortir de la case « épaisseur »
  await page.keyboard.press("Escape");

  let essaiRooms = 0;
  await check("chaque chantier garde son propre dessin", async () => {
    const r0 = await ev(() => okteo.state.rooms.length);
    await page.keyboard.press("e");
    const box = await page.locator("#sv").boundingBox();
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.4); await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.55, { steps: 6 }); await page.mouse.up();
    essaiRooms = await ev(() => okteo.state.rooms.length);
    if (essaiRooms !== r0 + 1) throw new Error("pièce non créée");
    await page.click(".badge");
    await Promise.all([page.waitForNavigation(), page.click('.ch-list tr:has-text("EVRARD") button[data-act="open"]')]);
    await reopened();
    return (await page.textContent(".badge")).includes("EVRARD") && (await ev(() => okteo.state.rooms.length)) === evrardRooms;
  });
  await check("fichier .okteo : enregistrer (dessin + fond + PDF) puis rouvrir", async () => {
    await page.click('#tabs button[data-tab="chantiers"]');
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click('.ch-list tr:has-text("ESSAI") button[data-act="file"]')]);
    const f = path.join(os.tmpdir(), "okteo-test.okteo"); await dl.saveAs(f);
    const j = JSON.parse(fs.readFileSync(f, "utf8"));
    const okFile = j.format === "okteo-chantier" && j.fond.image.startsWith("data:image") && j.fond.pdf.startsWith("data:application/pdf") && JSON.parse(j.dessin.s).rooms.length === essaiRooms && dl.suggestedFilename() === "ESSAI_99999.okteo";
    const n0 = await nbCh();
    await Promise.all([page.waitForNavigation(), page.setInputFiles("#ch-import", f)]);
    await reopened();
    await page.waitForFunction(() => okteo.FOND && okteo.FOND.startsWith("blob:"), null, { timeout: 30000 });
    return okFile && (await nbCh()) === n0 + 1 && (await ev(() => okteo.state.rooms.length)) === essaiRooms && (await page.textContent(".badge")).includes("ESSAI");
  });
  await check("dupliquer puis supprimer un chantier (avec confirmation)", async () => {
    await page.click('#tabs button[data-tab="chantiers"]');
    const n0 = await nbCh();
    await page.click('.ch-list tr:has-text("EVRARD") button[data-act="dup"]');
    if ((await nbCh()) !== n0 + 1) throw new Error("copie absente");
    await page.click('.ch-list tr:has-text("EVRARD (copie)") button[data-act="del"]');
    await page.click('button[data-act="del-yes"]');
    await page.waitForFunction((n) => JSON.parse(localStorage.getItem("okteo.chantiers.v1")).length === n, n0, { timeout: 5000 });
    return !(await page.textContent(".ch-list")).includes("(copie)");
  });
  await check("le chantier ouvert ne peut pas être supprimé", async () => page.isDisabled('.ch-list tr.cur button[data-act="del"]'));
  await page.click('#tabs button[data-tab="plan"]');

  console.log("Panneau extension");
  await check("panneau élargissable en tirant le bord", async () => {
    const g = await page.locator("#side-grip").boundingBox();
    const w0 = (await page.locator("#side").boundingBox()).width;
    await page.mouse.move(g.x + 3, g.y + 200); await page.mouse.down(); await page.mouse.move(g.x - 140, g.y + 200, { steps: 6 }); await page.mouse.up();
    const w1 = (await page.locator("#side").boundingBox()).width;
    return w1 > w0 + 100;
  });
  await check("panneau repliable puis dépliable", async () => {
    await page.click("#side-head .col");
    const w = (await page.locator("#side").boundingBox()).width;
    await page.click("#side-head .col");
    return w < 50;
  });
  await page.screenshot({ path: process.env.OKTEO_SHOT || "scripts/derniere-capture.png" });
} finally {
  await browser.close(); await server.close(); mock.close();
}

if (errors.length) fails.push("Erreurs JavaScript : " + errors.join(" | "));
console.log(`\n${ok} vérifications réussies, ${fails.length} en échec.`);
if (fails.length) { console.error(fails.map((f) => " - " + f).join("\n")); process.exit(1); }
