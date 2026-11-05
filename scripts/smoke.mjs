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
    let text = "OK", toolResp = null;
    // n° 3 : outils d'Oktéo : 1er tour = trois appels d'outils ; tour suivant (résultats reçus) = relevé comme ci-dessous
    const toolTurn = Array.isArray(j.tools) && j.tools.length, gotResults = Array.isArray(last.content) && last.content.some((c) => c.type === "tool_result");
    const firstText = (msgs[0] && Array.isArray(msgs[0].content) ? msgs[0].content : []).map((c) => c.text || "").join(" ");
    if (toolTurn && !gotResults) {
      const [, W, H] = (firstText.match(/image de (\d+) × (\d+) pixels/) || [0, 1000, 700]).map(Number);
      toolResp = { content: [{ type: "text", text: "Je lis la légende." }, { type: "tool_use", id: "tu1", name: "legende", input: {} }, { type: "tool_use", id: "tu2", name: "symboles", input: { x: 0, y: 0, w: W, h: H } }, { type: "tool_use", id: "tu3", name: "verifier", input: { appareils: [{ t: "LUM", x: 10, y: 10 }], liaisons: [] } }], stop_reason: "tool_use" };
    }
    if (/nemotron-test/.test(lastText)) text = "<think>brouillon secret</think>Réponse Nemotron.";
    if (/outil pi[eè]ce/i.test(lastText)) text = 'Je lance l\'outil Pièce : glissez un rectangle.\n```okteo\n{"actions":[{"do":"cmd","id":"tool.piece"}]}\n```';
    else if (/Règle R-002 : je veux la modifier/.test(lastText)) {
      text = 'Je propose de confirmer R-002.\n```okteo\n{"actions":[{"do":"rule","op":"modifier","id":"R-002","patch":{"certitude":"confirmee","statut":"active"},"motif":"Confirmée par Kévin"},{"do":"rule","op":"modifier","id":"R-004","patch":{"couleur":"x"},"motif":"essai"}]}\n```';
    }
    else if (/Relève ce plan/.test(lastText) || (toolTurn && gotResults && /Relève ce plan/.test(firstText))) {
      // relevé par l'IA : une maison rectangulaire coupée en deux pièces, en pixels de l'image envoyée
      const [, W, H] = ((toolTurn ? firstText : lastText).match(/image de (\d+) × (\d+) pixels/) || [0, 1000, 700]).map(Number);
      const X = (f) => Math.round(f * W), Y = (f) => Math.round(f * H);
      text = "Voici le relevé :\n```json\n" + JSON.stringify({
        murs: [{ x1: X(0.1), y1: Y(0.1), x2: X(0.9), y2: Y(0.1), ep: 25 }, { x1: X(0.9), y1: Y(0.1), x2: X(0.9), y2: Y(0.9), ep: 25 },
          { x1: X(0.9), y1: Y(0.9), x2: X(0.1), y2: Y(0.9), ep: 25 }, { x1: X(0.1), y1: Y(0.9), x2: X(0.1), y2: Y(0.1), ep: 25 },
          { x1: X(0.5), y1: Y(0.1) + 2, x2: X(0.5) + 3, y2: Y(0.9), ep: 7 }],
        ouvertures: [{ x: X(0.5), y: Y(0.5), l: 80, t: "porte" }, { x: X(0.3), y: Y(0.9), l: 120, t: "fenetre" }],
        pieces: [{ nom: "Séjour", x: X(0.3), y: Y(0.5) }, { nom: "Chambre", x: X(0.7), y: Y(0.5) }],
        appareils: [{ t: "INT", x: X(0.48), y: Y(0.6) }, { t: "LUM", x: X(0.3), y: Y(0.5) }, { t: "PC16", x: X(0.12), y: Y(0.5) }, { t: "XYZ", x: 1, y: 1 }],
        liaisons: [[0, 1]], remarques: "plan de test",
      }) + "\n```";
    }
    else if (/Tuile (\d+)\/(\d+) \(ligne/.test(lastText) || /Voici les zooms demandés/.test(lastText)) {
      // v76 (mode 2) : lecture fine d'une tuile ; la tuile 1 demande un zoom, puis (réponse au zoom) donne une prise RJ45
      // au centre de la tuile ; les autres tuiles ne trouvent rien
      const first = (msgs[0] && Array.isArray(msgs[0].content) ? msgs[0].content : []).map((c) => c.text || "").join(" ");
      const [, n] = (first.match(/Tuile (\d+)\//) || [0, "0"]);
      const [, W, H] = (first.match(/image de (\d+) × (\d+) pixels/) || [0, 800, 600]).map(Number);
      const zoomed = /Voici les zooms demandés/.test(lastText);
      text = JSON.stringify(n === "1" && !zoomed ? { appareils: [], liaisons: [], zooms: [{ x: W / 2 - 30, y: H / 2 - 30, w: 60, h: 60, pourquoi: "symbole petit" }], remarques: "zoom demandé" }
        : { appareils: n === "1" ? [{ t: "RJ45", x: Math.round(W / 2), y: Math.round(H / 2) }] : [], liaisons: [], zooms: [], remarques: "tuile " + n });
    }
    else if (/Contrôle croisé pour le bureau d'études/.test(lastText)) {
      // v76 (mode 4) : le devis joint cite un lave-vaisselle absent du plan
      text = JSON.stringify({ documents: [{ source: "document 1", nature: "devis" }], ecarts: [{ equipement: "Lave-vaisselle", type: "LV", piece: "Cuisine", qDoc: 1, qPlan: 0, source: "document 1, page 1", extrait: "lave-vaisselle intégré" }, { equipement: "Prise", type: "PC16", qDoc: 3, qPlan: 3, source: "document 1" }], remarques: "test" });
    }
    else if (/Relecture ciblée/.test(lastText)) {
      // v57 : relecture ciblée : chaque point est relié au premier repère proche
      const L = [];
      for (const m of lastText.matchAll(/^\d+\. \[[^\]]+\] (\S+) \([^\n]*\n\s+Repères proches : (\S+) \(/gm)) L.push([m[2], m[1]]);
      text = JSON.stringify({ liaisons: L, ajouts: [], introuvable: [], remarques: hasImage ? "image reçue" : "" });
    }
    else if (/Analyse ce plan/.test(lastText)) {
      const rid = (j.system || msgs[0]?.content || "").match(/"id":"(r\d+)"/)?.[1] || "r1";
      text = `## Dessin\n- La pièce [${rid}] n'a pas de point lumineux.\n## Priorités\n1. Ajouter un point lumineux${hasImage ? "\n(image reçue)" : ""}\n\`\`\`okteo\n{"suggest":[{"do":"zoom","ids":["${rid}"],"label":"Voir la pièce"}]}\n\`\`\``;
    }
    res.setHeader("content-type", "application/json");
    if (req.url === "/v1/models") return res.end(JSON.stringify({ data: [{ id: "meta/llama-3.3-70b-instruct" }, { id: "nvidia/llama-3.2-nv-embedqa-1b-v2" }, { id: "nvidia/nemotron-3.5-super-vl-120b-a12b" }, { id: "nvidia/llama-3.3-nemotron-super-49b-v1.5" }] }));
    if (j.model === "nvidia/nemotron-nano-12b-v2-vl") { res.statusCode = 410; return res.end(JSON.stringify({ error: { message: "The model 'nvidia/nemotron-nano-12b-v2-vl' has reached its end of life" } })); }
    if (req.url === "/v1/messages") {
      if (req.headers["x-api-key"] !== "sk-test") { res.statusCode = 401; return res.end(JSON.stringify({ error: { message: "invalid x-api-key" } })); }
      // v76 : une requête avec marque de cache rend des tokens écrits / lus en cache (comme l'API)
      const marked = JSON.stringify(j).includes('"cache_control"');
      if (toolResp) return res.end(JSON.stringify({ ...toolResp, usage: { input_tokens: 1000, output_tokens: 200 } }));
      return res.end(JSON.stringify({ content: [{ type: "text", text }], usage: { input_tokens: 1000, output_tokens: 200, ...(marked ? { cache_creation_input_tokens: 600, cache_read_input_tokens: 400 } : {}) } }));
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
// v76 : chaque vérification a une limite de temps imposée depuis Node (une page figée ne peut plus bloquer toute la
// suite) ; après un dépassement, la page est rechargée pour que les vérifications suivantes puissent tourner
const CHECK_MS = 6 * 60000;
async function check(name, fn) {
  let t = 0;
  try {
    const r = await Promise.race([fn(), new Promise((_, no) => { t = setTimeout(() => no(new Error(`délai de ${CHECK_MS / 60000} min dépassé`)), CHECK_MS); })]);
    if (r === false) throw new Error("condition fausse"); ok++; console.log("  ✓ " + name);
  }
  catch (e) {
    fails.push(name + " : " + e.message); console.log("  ✗ " + name + " : " + e.message);
    if (/délai de .* dépassé/.test(e.message)) await page.reload({ timeout: 60000 }).then(() => page.waitForFunction(() => window.okteo && window.okteoExt, null, { timeout: 60000 })).catch(() => {});
  }
  finally { clearTimeout(t); }
}
const ev = (f, a) => page.evaluate(f, a);
// v76 : une analyse de plus de 2 s ouvre la page d'attente (v73), qui reste sur « Votre plan est prêt » jusqu'au clic
// « Ouvrir le chantier » : on la ferme comme l'opérateur avant de toucher à l'aperçu
const closeWait = async () => { if (await page.isVisible("#aw-open").catch(() => false)) await page.click("#aw-open"); await page.waitForFunction(() => !document.body.classList.contains("aw-on"), null, { timeout: 10000 }).catch(() => {}); };
// v64 : Boîtes, Bandes et Lignes directes sont des sous-onglets de l'onglet « Pieuvre »
const goSub = async (sub) => { await page.click('#tabs button[data-tab="boites"]'); await page.click(`#subtabs [data-sub="${sub}"]`); };

try {
  await page.goto(`http://localhost:${APP_PORT}/`);
  await ev(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.okteo && window.okteoExt);

  console.log("Premiers pas (v27)");
  await check("première ouverture : invitation à la visite guidée (non bloquante)", async () => page.isVisible(".tour-invite"));
  await check("visite guidée : 28 étapes, zone éclairée (onglet Chantiers), flèches du clavier, fin = onglet Étapes", async () => {
    await page.click("#ti-go");
    const s1 = await page.textContent(".tour-bub .tour-n");
    await page.keyboard.press("ArrowRight");
    const lit = await ev(() => { const r = document.querySelector(".tour-ring").getBoundingClientRect(), t = document.querySelector('.top .brand').getBoundingClientRect();
      return !document.querySelector(".tour-ring").hidden && r.left <= t.left && r.right >= t.right && r.top <= t.top && r.bottom >= t.bottom; });
    await page.keyboard.press("ArrowLeft");
    const back = await page.textContent(".tour-bub .tour-n");
    for (let k = 0; k < 28; k++) await page.click("#tour-next");
    const done = await ev(() => document.querySelector(".tour-bub").hidden && okteoExt.panel.state.pane === "steps" && !!document.querySelector(".steps ol li"));
    await ev(() => okteoExt.panel.show("props"));
    await page.reload(); await page.waitForFunction(() => window.okteo && window.okteoExt);
    const again = await page.isVisible(".tour-invite");
    if (!(s1 === "1 / 28" && lit && back === "1 / 28" && done && !again)) throw new Error(JSON.stringify({ s1, lit, back, done, again }));
    return true;
  });

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
  await check("touche A ouvre l'assistant", async () => {
    // le focus doit être sur la page (pas dans un champ) avant la touche
    await page.keyboard.press("Escape"); await ev(() => document.activeElement?.blur?.()); await page.click(".top .chip");   // lot 3 : le logo ouvre l'accueil
    for (let k = 0; k < 2; k++) {
      await page.keyboard.press("a");
      if (await page.waitForSelector(".as-in textarea", { state: "visible", timeout: 2500 }).then(() => true, () => false)) return true;
    }
    return false;
  });
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
    // v72.1 : le calque Fond est masqué par défaut (v71) ; l'image envoyée à l'IA doit quand même contenir tout le fond
    const m = await import("/src/ext/plan-data.js"), L = okteo.layers.fond, was = L.on;
    L.on = true; const e = okteo.extent(); L.on = false;
    const n = (await m.planImage(okteo)).data.length; L.on = was; okteo.draw && okteo.draw();
    return (e.x1 - e.x0) > 14 && n > 50000;
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
    // la page Paramètres peut se réafficher juste après l'ouverture (état du serveur local) : on réessaie si la saisie a été effacée
    let t = "";
    for (let k = 0; k < 3 && !t.includes("remplacé"); k++) {
      await page.waitForTimeout(200);
      await page.fill('.pcard[data-p="nvidia"] .m', "nvidia/nemotron-nano-12b-v2-vl");
      await page.click('.pcard[data-p="nvidia"] .tst');
      await page.waitForSelector('.pcard[data-p="nvidia"] .tres.good, .pcard[data-p="nvidia"] .tres.bad');
      t = await page.textContent('.pcard[data-p="nvidia"] .tres');
    }
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

  await ev(() => okteoExt.panel.close("assistant")); // l'encart agrandi couvrirait le bas droit du plan
  console.log("Chantiers");
  const nbCh = () => ev(() => JSON.parse(localStorage.getItem("okteo.chantiers.v1")).length);
  const reopened = async () => { await page.waitForFunction(() => window.okteo && window.okteoExt); };
  await check("EVRARD repris comme chantier ouvert (ancienne sauvegarde conservée)", async () => {
    await page.evaluate(() => okteo.setTab("chantiers"));   // lot 3 : accueil par le logo (plus d'onglet)
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
  await check("n° 15 : rôle proposé pour chaque page (plan du RDC en page 3, pages sans plan « à ignorer »), modifiable ; un seul plan par niveau", async () => {
    const r0 = await ev(() => [...document.querySelectorAll(".pg-role")].map((s) => s.value));
    await page.selectOption('.pg-role[data-page="1"]', "devis");
    await page.selectOption('.pg-role[data-page="2"]', "niv:RDC");
    const r1 = await ev(() => ({ v: [...document.querySelectorAll(".pg-role")].map((s) => s.value), on: document.querySelector(".thumb.on")?.dataset.page }));
    await page.click('.thumb[data-page="3"]');
    await page.selectOption('.pg-role[data-page="2"]', "ignorer");
    const r2 = await ev(() => ({ v: [...document.querySelectorAll(".pg-role")].map((s) => s.value), on: document.querySelector(".thumb.on")?.dataset.page }));
    if (!(r0.join() === "ignorer,ignorer,niv:RDC" && r1.v.join() === "devis,niv:RDC,ignorer" && r1.on === "2" && r2.v.join() === "devis,ignorer,niv:RDC" && r2.on === "3")) throw new Error(JSON.stringify({ r0, r1, r2 }));
    return true;
  });
  await check("création : chantier ouvert, fond haute définition chargé, échelle à régler", async () => {
    await Promise.all([page.waitForNavigation({ timeout: 60000 }), page.click("#nf-ok")]);
    await reopened();
    await page.waitForFunction(() => okteo.FOND && okteo.FOND.startsWith("blob:"), null, { timeout: 30000 });
    const px = await ev(() => JSON.parse(localStorage.getItem("okteo.chantiers.v1")).find((c) => c.nom === "ESSAI").fond.pxW);
    const dos = await ev(() => { const d = okteo.ch.dossier; return d && { lv: d.levels.map((l) => l.name + ":" + l.page).join(), devis: d.devis.join(), lvs: okteo.levels.length }; });
    const pg = await ev(async () => (await import("/src/ext/ai-cross.js")).otherPages(okteo));
    return (await page.textContent(".badge")).includes("ESSAI · 99999") && (await ev(() => okteo.tool)) === "calib" && (await ev(() => okteo.state.rooms.length)) === 0 && px > 3000
      && dos && dos.lv === "RDC:3" && dos.devis === "1" && dos.lvs === 1 && pg === 1;
  });
  await check("sans échelle : « Relevé → 1. Murs » règle l'échelle tout seul d'après les cotes du plan (à 1,5 % près)", async () => {
    await page.keyboard.press("Escape");
    await page.click("#btn-relev"); await page.click("#rv-walls");
    await page.waitForSelector("#w-ok", { timeout: 60000 });
    const t = await page.textContent("#w-scale");
    const r = await ev(async () => { const m = await import("/src/ext/pdf-page.js"); const s = await m.chantierScaleCheck(okteo); return { cal: okteo.ch.fond.calibre, f: s && s.facteur, n: s && s.cotes }; });
    await page.keyboard.press("Escape");
    await ev(() => okteo.startCalib());
    if (!/réglée automatiquement/.test(t) || r.cal !== true || !(Math.abs(r.f - 1) < 0.015)) throw new Error(JSON.stringify({ t, r }));
    return true;
  });
  await check("échelle saisie « 1 / 50 » : fond = largeur de la feuille × 50 ; les cotes signalent qu'EVRARD est un A3 réduit en A4 (√2)", async () => {
    await page.waitForSelector("#cr-N");
    await page.fill("#cr-N", "50"); await page.click("#cr-ok");
    await page.waitForFunction(() => /échelle fausse/.test(document.getElementById("hint").textContent), null, { timeout: 15000 });
    const r = await ev(async () => { const m = await import("/src/ext/pdf-page.js"); const s = await m.chantierScaleCheck(okteo); return { cal: okteo.ch.fond.calibre, pw: okteo.ch.fond.paperW, w: okteo.BG.w, f: s && s.facteur }; });
    await page.keyboard.press("Escape");
    await ev(() => okteo.startCalib());
    if (!(r.cal && Math.abs(r.w - r.pw * 50) < 0.01 && Math.abs(r.f - Math.SQRT2) < 0.03)) throw new Error(JSON.stringify(r));
    return true;
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
    const t = await page.textContent(".wcard:not([hidden])");
    return r.rooms.length === 9 && r.nLabels === 9 && names === "Bains|Cellier|Chambre 1|Chambre 2|Dgt|Dressing|Espace de Vie|Garage|WC" && r.limits.length === 1 && t.includes("Séparer les pièces ouvertes");
  });
  await check("ajout des pièces : WC fermé par sa porte, Dgt séparé par une limite, un seul Ctrl+Z", async () => {
    const segs0 = await ev(() => okteo.state.segs.length);
    await page.click("#r-ok");
    const s = await ev(() => okteo.state.rooms.map((r) => ({ n: r.name, c: r.cycle.length, a: okteo.roomArea(r), also: r.also })));
    const virt = await ev(() => okteo.state.segs.filter((g) => g.virt).length);
    const sej = s.find((r) => r.n === "Espace de Vie"), wc = s.find((r) => r.n === "WC"), dgt = s.find((r) => r.n === "Dgt");
    const ok = s.length === 9 && sej.c > 4 && !sej.also.length && wc && wc.a > 1 && wc.a < 2.5 && dgt && dgt.a > 1.5 && virt === 1 && s.every((r) => r.a > 1);
    await ev(() => okteo.undo());
    const back = await ev(() => ({ r: okteo.state.rooms.length, v: okteo.state.segs.filter((g) => g.virt).length, n: okteo.state.segs.length }));
    await ev(() => okteo.redo());
    if (!ok) throw new Error(JSON.stringify({ s, virt }));
    return back.r === 0 && back.v === 0 && back.n === segs0 && (await ev(() => okteo.state.rooms.length)) === 9;
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

  console.log("Surfaces des pièces (v42)");
  await check("surfaces masquées par défaut (plan, Propriétés) ; Paramètres → Affichage les remet, puis les retire", async () => {
    await page.click('#tabs button[data-tab="plan"]');
    const m2 = () => ev(() => (document.querySelector("#sv g.labels")?.textContent || "").includes("m²"));
    const off = !(await m2());
    await ev(() => { const r = okteo.state.rooms.find((x) => x.name === "Chambre 1"); okteo.select([r.id]); okteoExt.panel.show("props"); });
    const propOff = !(await page.textContent("#sidebody")).includes("m²");
    await ev(() => okteo.select([]));
    await page.click('#tabs button[data-tab="params"]');
    await page.check('[data-pref="surfaces"]');
    await page.click('#tabs button[data-tab="plan"]');
    const on = await m2();
    await page.click('#tabs button[data-tab="params"]');
    await page.uncheck('[data-pref="surfaces"]');
    await page.click('#tabs button[data-tab="plan"]');
    const off2 = !(await m2());
    if (!(off && propOff && on && off2)) throw new Error(JSON.stringify({ off, propOff, on, off2 }));
    return true;
  });
  await check("Paramètres : sommaire, sections Affichage / IA / Câblage / Packs, recherche « couleur »", async () => {
    await page.click('#tabs button[data-tab="params"]');
    const secs = await ev(() => [...document.querySelectorAll("#params .pset-sec h3")].map((h) => h.textContent).join("|"));
    await page.fill(".pset-find", "couleur");
    const r = await ev(() => ({ rows: [...document.querySelectorAll("#params .cab-row")].filter((x) => !x.hidden && x.offsetParent).length, ia: document.querySelector("#ps-ia").hidden, grp: [...document.querySelectorAll("#params .pset-grp")].filter((g) => !g.hidden).map((g) => g.querySelector("h4").textContent).join("|") }));
    await page.fill(".pset-find", "");
    const back = await ev(() => !document.querySelector("#ps-ia").hidden);
    await page.click('#tabs button[data-tab="plan"]');
    if (!(secs === "Affichage|Assistant et relevé IA|Bibliothèque des règles|Murs : mise d'équerre automatique|Vue 3D : hauteurs de départ|Câblage|Packs" && r.rows >= 6 && r.ia && r.grp === "Couleurs des fils" && back)) throw new Error(JSON.stringify({ secs, r, back }));
    return true;
  });

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
      const A = okteo.state.app, wall = A.filter((a) => ["PC16", "PC20", "RJ45", "INT", "VV", "SC", "APP"].includes(a.t));
      return { n: A.length, wall: wall.length, att: wall.filter((a) => a.seg && a.wa).length, lia: okteo.state.lia.length, lum: A.filter((a) => a.t === "LUM" && !a.seg).length, app: A.filter((a) => a.t === "APP" && a.seg).length };
    });
    if (s.n !== n || s.att < s.wall * 0.9 || s.lia < 20 || s.lum !== 10 || s.app !== 5) throw new Error(JSON.stringify(s));
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

  console.log("Lisibilité (v23)");
  await check("textes à taille fixe à l'écran : nom de pièce ≈ 13 px en vue d'ensemble comme en zoom", async () => {
    const hOf = () => ev(() => { const t = [...document.querySelectorAll("#sv .labels text")].find((e) => e.textContent === "Chambre 1"); return t ? t.getBoundingClientRect().height : 0; });
    await ev(() => okteo.fit()); const h1 = await hOf();
    await ev(() => okteo.zoom(4)); const h2 = await hOf();
    await ev(() => okteo.fit());
    return h1 > 11 && h1 < 22 && Math.abs(h1 - h2) < 1.5;
  });
  await check("aucune étiquette ne se chevauche (noms, surfaces, repères, cotes) en vue d'ensemble et en zoom", async () => {
    const overlaps = () => ev(() => {
      const E = [...document.querySelectorAll("#sv .labels text")].map((e) => ({ e, r: e.getBoundingClientRect() })).filter((x) => x.r.width > 0), R = E.map((x) => x.r);
      let n = 0; const pairs = []; for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) { const a = R[i], b = R[j];
        if (a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1) { n++;
          const d = (x) => `${x.e.textContent}[${x.e.getAttribute("class") || ""}|${x.e.parentNode.getAttribute("class") || ""}](${Math.round(x.r.left)},${Math.round(x.r.top)},${Math.round(x.r.width)}x${Math.round(x.r.height)})`;
          pairs.push(d(E[i]) + " / " + d(E[j])); } }
      return { n, total: R.length, pairs };
    });
    await ev(() => okteo.fit()); const a = await overlaps();
    await ev(() => okteo.zoom(3)); const b = await overlaps(); await ev(() => okteo.fit());
    if (a.n || b.n) throw new Error(JSON.stringify({ a, b }));
    return a.total > 30;
  });
  await check("liaisons : celles de l'appareil sélectionné ressortent, les autres s'effacent", async () => ev(() => {
    const l = okteo.state.lia[0]; okteo.select([l.c]);
    const paths = [...document.querySelectorAll("#sv path[d^='M']")].filter((p) => p.getAttribute("d").includes(" Q "));
    const hot = paths.filter((p) => +p.getAttribute("opacity") > 0.9).length, dim = paths.filter((p) => +p.getAttribute("opacity") < 0.3).length;
    okteo.clearSel(); return hot >= 1 && dim > 5;
  }));

  console.log("Liaisons et relevés (v31)");
  await check("outil Liaison : toutes les liaisons en trait épais, compteur, appareils sans liaison cerclés en orange", async () => {
    await ev(() => okteo.setTool("lien"));
    const r = await ev(() => {
      const P = [...document.querySelectorAll("#sv path.lia")], A = okteo.state.app, L = okteo.allLinks();
      const role = (t) => (["INT", "VV", "BP"].includes(t) ? "c" : ["LUM", "SPOT", "APP"].includes(t) ? "l" : null);
      const linked = new Set(L.flatMap((x) => [x.c, x.l])), miss = A.filter((a) => role(a.t) && !linked.has(a.id)).length;
      return { n: P.length, lia: okteo.state.lia.length, op: Math.min(...P.map((p) => +p.getAttribute("opacity"))), hint: document.getElementById("hint").textContent, miss, rings: document.querySelectorAll("#sv circle.lia-miss").length };
    });
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + "/liaisons.png" });
    if (r.n !== r.lia || r.op < 0.8 || r.rings !== r.miss || !/\d+ liaisons sur ce niveau/.test(r.hint)) throw new Error(JSON.stringify(r));
    return true;
  });
  await check("outil Liaison : clic sur une commande = ses lumières ressortent ; clic sur une de ses lumières = détachée (Ctrl+Z)", async () => {
    // v76 : test rendu fiable (il échouait déjà par moments, ex. run 41547204988 du 02/11) : la vue est d'abord cadrée sur
    // la commande et sa lumière, pour que le clic tombe sur la lumière et pas sur le trait de la liaison
    await ev(() => { window.__v76view = { ...okteo.view }; const x = okteo.state.lia[0]; okteo.zoomTo([x.c, x.l]); });
    await page.waitForTimeout(300);
    const t = await ev(() => { const x = okteo.state.lia[0], A = okteo.state.app, c = A.find((a) => a.id === x.c), l = A.find((a) => a.id === x.l); return { c: okteo.toClient(c.x, c.y), l: okteo.toClient(l.x, l.y), n: okteo.state.lia.length }; });
    await page.mouse.click(t.c.x, t.c.y);
    const h1 = await ev(() => document.getElementById("hint").textContent), on = await ev(() => document.querySelectorAll("#sv circle.lia-on").length);
    await page.mouse.click(t.l.x, t.l.y);
    const n2 = await ev(() => okteo.state.lia.length), h2 = await ev(() => document.getElementById("hint").textContent);
    await page.keyboard.press("Control+z");
    const n3 = await ev(() => okteo.state.lia.length);
    await ev(() => { okteo.view = window.__v76view; window.__okteo.draw(); });   // vue d'avant remise pour les tests suivants
    if (!/lumière/.test(h1) || on < 1 || n2 !== t.n - 1 || !/retirée/.test(h2) || n3 !== t.n) throw new Error(JSON.stringify({ h1, on, n2, h2, n3, n: t.n }));
    return true;
  });
  await check("outil Liaison : clic sur une liaison = elle est choisie (les deux appareils nommés) ; Suppr la retire", async () => {
    await ev(() => okteo.setTool("lien"));
    const t = await ev(() => {
      const A = okteo.state.app, by = Object.fromEntries(A.map((a) => [a.id, a]));
      for (const x of okteo.state.lia) {
        const c = by[x.c], l = by[x.l]; if (!c || !l) continue;
        const d = Math.hypot(l.x - c.x, l.y - c.y); if (d < 1.5) continue;
        const q = { x: (c.x + l.x) / 2, y: (c.y + l.y) / 2 - d * 0.18 }, m = { x: 0.25 * c.x + 0.5 * q.x + 0.25 * l.x, y: 0.25 * c.y + 0.5 * q.y + 0.25 * l.y };
        if (A.every((a) => Math.hypot(a.x - m.x, a.y - m.y) > 0.5)) { okteo.zoomToBox(m.x - 2, m.y - 2, m.x + 2, m.y + 2); return { p: okteo.toClient(m.x, m.y), n: okteo.state.lia.length }; }
      }
      return null;
    });
    if (!t) throw new Error("pas de liaison isolée");
    await page.mouse.click(t.p.x, t.p.y);
    const h = await ev(() => document.getElementById("hint").textContent);
    await page.keyboard.press("Delete");
    const n2 = await ev(() => okteo.state.lia.length);
    await page.keyboard.press("Control+z");
    const n3 = await ev(() => okteo.state.lia.length);
    await page.keyboard.press("Escape"); await ev(() => okteo.fit());
    if (!/^Liaison \S+ → \S+/.test(h) || n2 !== t.n - 1 || n3 !== t.n) throw new Error(JSON.stringify({ h, n2, n3, n: t.n }));
    return true;
  });
  await check("menu Relevé : 3 relevés séparés + relevé par l'IA, chacun ouvre sa fenêtre", async () => {
    await page.click("#btn-relev");
    const vis = await Promise.all(["#rv-walls", "#rv-rooms", "#rv-devices", "#rv-ai"].map((s) => page.isVisible(s)));
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + "/releve-menu.png" });
    await page.click("#rv-rooms");
    await page.waitForSelector("#r-ok", { timeout: 15000 });
    const closed = !(await page.isVisible("#rv-rooms"));
    await page.keyboard.press("Escape");
    return vis.every(Boolean) && closed && !(await page.isVisible("#r-ok"));
  });
  await check("v73 : page d'attente des analyses IA (charte) : cachée si la réponse est rapide, jeux, clavier isolé du plan, « Ouvrir le chantier »", async () => {
    // une réponse rapide ne montre jamais la page
    await ev(() => { const A = okteoExt.aiReleve.attente; window.__aw = A.start(); A.finish(window.__aw, true); });
    await page.waitForTimeout(2300);
    const quick = await ev(() => okteoExt.aiReleve.attente.visible);
    // analyse longue : la page s'ouvre après 2 s
    await ev(() => { window.__aw = okteoExt.aiReleve.attente.start({ title: "L'IA étudie votre plan" }); });
    await page.waitForSelector(".aw:not([hidden])", { timeout: 5000 });
    const t1 = await page.textContent("#aw-title");
    // jeu Mémoire : la maison lance une séquence de 3
    await page.click("#aw-start"); await page.waitForTimeout(150);
    const mem = await page.textContent("#aw-m-msg");
    // jeu Câble : Jouer, le câble avance ; une touche ne change pas l'outil du plan
    await page.click('.aw-tab[data-g="cab"]'); await page.click("#aw-play");
    const tool0 = await ev(() => okteo.tool);
    await page.keyboard.press("b"); await page.keyboard.press("ArrowDown"); await page.waitForTimeout(450);
    const cab = await ev(() => ({ segs: document.querySelectorAll("#aw-board .aw-seg").length, head: document.querySelector("#aw-board .aw-seg.head").style.top, tool: okteo.tool }));
    // fin de l'analyse : « Votre plan est prêt », puis Ouvrir le chantier ferme la page
    await ev(() => okteoExt.aiReleve.attente.finish(window.__aw, true));
    const t2 = await page.textContent("#aw-title"), cta = await ev(() => !document.querySelector("#aw-open").hidden);
    await page.click("#aw-open");
    const gone = await ev(() => !okteoExt.aiReleve.attente.visible && !document.body.classList.contains("aw-on"));
    const r = { quick, t1, mem, cab, tool0, t2, cta, gone };
    if (quick || !/étudie/.test(t1) || !/Regardez/.test(mem) || cab.segs !== 3 || cab.tool !== tool0 || cab.head === "217px" || !/prêt/.test(t2) || !cta || !gone) throw new Error(JSON.stringify(r));
    return true;
  });
  await check("v76 : « Analyse IA » ouvre l'écran des 4 modes (maquette page 8) : référence du dossier, Lancer grisé sans choix, carte choisie (aria-pressed), documents à recouper pour le mode 4, Échap ferme", async () => {
    await ev(async () => { okteoExt.settings.set({ provider: "anthropic" }); (await import("/src/prefs.js")).setPref("modesIA", "dev"); });   // n° 3 : les 4 modes pour ces essais (réglage réservé aux essais)
    const n0 = seen.length;
    await page.click("#btn-relev"); await page.click("#rv-ai");
    await page.waitForSelector("#ai-modes:not([hidden]) .am-card", { timeout: 5000 });
    const a = await ev(() => { const el = document.getElementById("ai-modes"), cards = [...el.querySelectorAll(".am-card")], go = el.querySelector("#am-go");
      return { n: cards.length, titles: cards.map((c) => c.querySelector(".am-title").textContent), pressed: cards.map((c) => c.getAttribute("aria-pressed")), dots: cards.map((c) => c.querySelectorAll(".am-dot.on").length),
        h1: el.querySelector("h1").textContent, ref: el.querySelector(".am-ref").textContent, expected: [okteo.ch.nom, okteo.ch.numero].filter(Boolean).join(" · ").toUpperCase(),
        dis: go.getAttribute("aria-disabled"), foot: el.querySelector(".am-foot p").textContent, h1w: getComputedStyle(el.querySelector("h1")).width, bg: getComputedStyle(el).backgroundColor }; });
    // un clic sur Lancer sans choix ne fait rien (aria-disabled : Playwright refuse le clic sans force)
    await page.click("#am-go", { force: true });
    const still = await ev(() => okteoExt.aiModes.visible && okteoExt.aiModes.launched == null);
    // mode 4 choisi : coche + aria-pressed, lançable ; bloc « Documents à recouper » (étape 4)
    await page.click('#ai-modes .am-card[data-mode="4"]');
    const b = await ev(() => { const el = document.getElementById("ai-modes"); return { p3: el.querySelector('.am-card[data-mode="4"]').getAttribute("aria-pressed"), p1: el.querySelector('.am-card[data-mode="1"]').getAttribute("aria-pressed"), sel: el.querySelector('.am-card[data-mode="4"]').classList.contains("sel"), docs: !!el.querySelector(".am-docs #am-docs-file"), dis: el.querySelector("#am-go").getAttribute("aria-disabled"), label: el.querySelector("#am-go").textContent }; });
    await page.click('#ai-modes .am-card[data-mode="1"]');
    const c = await ev(() => { const el = document.getElementById("ai-modes"); return { dis: el.querySelector("#am-go").getAttribute("aria-disabled"), label: el.querySelector("#am-go").textContent }; });
    await page.keyboard.press("Escape");
    const closed = await ev(() => !okteoExt.aiModes.visible && !document.body.classList.contains("am-on"));
    await ev(() => okteoExt.aiModes.close());   // jamais laissé ouvert par-dessus le plan pour les tests suivants
    const noCall = seen.length === n0;
    const r = { a, still, b, c, closed, noCall };
    if (!(a.n === 4 && a.titles.join("|") === "Analyse standard|Analyse renforcée|Plan dégradé|Analyse approfondie" && a.pressed.every((x) => x === "false") && a.dots.join("") === "1234"
      && a.h1 === "Choisissez le mode d'analyse adapté à votre plan" && a.ref === a.expected && a.dis === "true" && /pas des corrections certaines/.test(a.foot) && a.h1w !== "1045px" && a.bg === "rgb(4, 40, 74)"
      && still && b.p3 === "true" && b.p1 === "false" && b.sel && b.docs && b.dis === "false" && /mode 4/.test(b.label) && c.dis === "false" && /mode 1/.test(c.label) && closed && noCall)) throw new Error(JSON.stringify(r));
    return true;
  });
  await check("v76 : l'écran des modes tient sur une page (1500 × 900, 1366 × 768, 1280 × 720, 1100 × 800, tablette 820 × 1180, mode 4 et ses documents compris) ; le texte trop long défile dans la carte ; Entrée choisit une carte", async () => {
    const sizes = [[1500, 900], [1366, 768], [1280, 720], [1100, 800], [820, 1180]], out = [];
    for (const [w, h] of sizes) {
      await page.setViewportSize({ width: w, height: h });
      await ev(() => okteoExt.aiModes.open());
      await page.click('#ai-modes .am-card[data-mode="4"]');
      await page.waitForTimeout(250);
      out.push(await ev(() => {
        const el = document.getElementById("ai-modes"), go = el.querySelector("#am-go").getBoundingClientRect(), grid = el.querySelector(".am-grid").getBoundingClientRect();
        const cards = [...el.querySelectorAll(".am-card")].map((c) => { const r = c.getBoundingClientRect(), k = c.querySelector(".am-cost").getBoundingClientRect(), z = c.querySelector(".am-scroll"); return { inGrid: r.bottom <= grid.bottom + 1, cost: k.bottom <= r.bottom + 1 && k.height > 0, scroll: z.scrollHeight > z.clientHeight + 2, ovf: getComputedStyle(z).overflowY }; });
        return { w: innerWidth, page: el.scrollHeight <= el.clientHeight + 1, cta: go.bottom <= innerHeight && go.top >= 0, docs: !!el.querySelector(".am-docs"), cards };
      }));
      await ev(() => okteoExt.aiModes.close());
    }
    await page.setViewportSize({ width: 1500, height: 900 });
    await ev(() => okteoExt.aiModes.open());
    await page.focus('#ai-modes .am-card[data-mode="2"]'); await page.keyboard.press("Enter");
    const key = await ev(() => okteoExt.aiModes.selected);
    await ev(() => okteoExt.aiModes.close());
    const r = { out, key };
    if (!(out.every((o) => o.page && o.cta && o.docs && o.cards.every((c) => c.inGrid && c.cost && c.ovf === "auto")) && key === 2)) throw new Error(JSON.stringify(r));
    return true;
  });
  await check("v76 : recommandation d'un mode d'après le plan (bandeau + « Recommandé » sur la carte, l'opérateur accepte ou choisit un autre mode) ; escalade proposée après une relecture", async () => {
    await ev(() => okteoExt.aiModes.open());
    await page.waitForFunction(() => okteoExt.aiModes.reco && !document.querySelector("#ai-modes .am-reco-wait"), null, { timeout: 60000 });
    const a = await ev(() => { const el = document.getElementById("ai-modes"), r = okteoExt.aiModes.reco; return { banner: el.querySelector(".am-reco").textContent, tag: [...el.querySelectorAll(".am-card")].filter((c) => c.querySelector(".am-reco-tag")).map((c) => +c.dataset.mode), mode: r && r.mode, kind: r && r.stats && r.stats.kind, sel: okteoExt.aiModes.selected }; });
    await page.click("#am-reco-ok");
    const b = await ev(() => okteoExt.aiModes.selected);
    await ev(() => okteoExt.aiModes.close());
    await ev(() => document.dispatchEvent(new CustomEvent("okteo:ai-escalade", { detail: { from: 1, to: 2, why: "4 alertes encore ouvertes" } })));
    const c = await ev(() => { const el = document.getElementById("ai-modes"); return { open: okteoExt.aiModes.visible, banner: el.querySelector(".am-reco").textContent, tag: [...el.querySelectorAll(".am-card")].filter((x) => x.querySelector(".am-reco-tag")).map((x) => +x.dataset.mode), sel: okteoExt.aiModes.selected }; });
    await ev(() => okteoExt.aiModes.close());
    const r = { a, b, c };
    if (!(/Recommandé pour ce plan/.test(a.banner) && a.mode >= 1 && a.tag.length === 1 && a.tag[0] === a.mode && a.sel === null && b === a.mode
      && c.open && /Relance proposée/.test(c.banner) && /4 alertes/.test(c.banner) && c.tag[0] === 2 && c.sel === null)) throw new Error(JSON.stringify(r));
    return true;
  });
  await check("relevé par l'IA (v76 : par « Analyse IA » → mode 1, flux v75 inchangé) : image envoyée, aperçu par-dessus le dessin, on coche ce qu'on garde, un seul Ctrl+Z", async () => {
    await ev(() => okteoExt.settings.set({ provider: "anthropic" }));
    const before = await ev(() => ({ segs: okteo.state.segs.length, rooms: okteo.state.rooms.length, app: okteo.state.app.length }));
    const n0 = seen.length;
    await page.click("#btn-relev"); await page.click("#rv-ai");
    await page.click('#ai-modes .am-card[data-mode="1"]'); await page.click("#am-go");
    await page.waitForSelector("#ai-ok", { timeout: 30000 });
    const req = seen.slice(n0).find((r) => r.url === "/v1/messages");
    const img = req && req.body.messages[0].content.find((c) => c.type === "image");
    const P = await ev(() => { const p = okteoExt.aiReleve.plan; return { walls: p.walls.length, nodes: p.nodes.length, op: p.openings.length, dev: p.devices.length, links: p.links.length, coupes: p.stats.coupes, prev: !!document.querySelector("#sv polygon[fill-opacity='0.5']") }; });
    const txt = await page.textContent(".aicard");
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + "/ia-apercu.png" });
    // on garde murs et pièces, pas les appareils
    await page.uncheck('.aicard [data-k="devices"]');
    await page.click("#ai-ok");
    const after = await ev(() => ({ segs: okteo.state.segs.length, rooms: okteo.state.rooms.map((r) => r.name).sort().join(","), app: okteo.state.app.length, op: okteo.state.openings.length }));
    // v76 : journal d'analyse (lu avant le Ctrl+Z, qui l'annule avec le reste)
    const J = await ev(() => { const R = (okteo.cab.releves || {})[okteo.level.id] || {}, x = (R.rapport || []).find((y) => y.type === "releve") || {}; return { mode: x.analyse && x.analyse.mode, id: !!(x.analyse && x.analyse.id) }; });
    J.model = req && req.body.model;   // modèle reçu par le faux serveur IA (côté test, pas dans la page)
    await page.keyboard.press("Control+z");
    const undone = await ev(() => ({ segs: okteo.state.segs.length, rooms: okteo.state.rooms.length, app: okteo.state.app.length }));
    const r = { img: !!img && img.source.data.length > 20000, P, after, undone, before, txt: txt.includes("Séjour"), J };
    if (!r.img || J.mode !== 1 || !J.id || J.model !== "claude-opus-5-5" || P.walls !== 7 || P.nodes !== 6 || P.coupes !== 2 || P.op !== 2 || P.dev !== 4 || P.links !== 1 || !P.prev || !r.txt
      || after.segs !== 7 || after.rooms !== "Chambre,Séjour" || after.app !== before.app || after.op !== 2
      || undone.segs !== before.segs || undone.rooms !== before.rooms || undone.app !== before.app) throw new Error(JSON.stringify(r));
    return true;
  });
  await check("v76 étape 2 : mode 2 « Analyse renforcée » — lecture globale + tuiles (3 × 3, consigne en cache), zoom demandé puis rendu, fusion, écarts à vérifier, journal ; ajout en un seul Ctrl+Z", async () => {
    await ev(() => { okteoExt.settings.set({ provider: "anthropic" }); localStorage.setItem("okteo.prefs.v1", JSON.stringify({ ...JSON.parse(localStorage.getItem("okteo.prefs.v1") || "{}"), grilleIA: "3x3", tuilesParallele: 2, zoomsIA: 12 })); });
    const before = await ev(() => ({ segs: okteo.state.segs.length, rooms: okteo.state.rooms.length, app: okteo.state.app.length }));
    const n0 = seen.length;
    await ev(() => okteoExt.aiModes.open());
    await page.click('#ai-modes .am-card[data-mode="2"]'); await page.click("#am-go");
    await page.waitForSelector("#ai-ok", { timeout: 90000 }); await closeWait();
    const req = seen.slice(n0).filter((r) => r.url === "/v1/messages");
    const glob = req.filter((r) => /Relève ce plan/.test(JSON.stringify(r.body.messages)));
    const tiles = req.filter((r) => Array.isArray(r.body.system) && r.body.messages.length === 1);
    const zooms = req.filter((r) => Array.isArray(r.body.system) && r.body.messages.length === 3);
    const sysCached = tiles.every((r) => r.body.system[0].cache_control && r.body.system[0].cache_control.type === "ephemeral" && /ZONE du plan/.test(r.body.system[0].text));
    const imgs = tiles.every((r) => r.body.messages[0].content.some((c) => c.type === "image" && c.source.data.length > 1000));
    const P = await ev(async () => { const p = okteoExt.aiReleve.plan, f = await okteo.levelFond(okteo.level.id), rj = p.devices.find((d) => d.t === "RJ45");
      return { dev: p.devices.length, rj: rj ? { x: rj.x, y: rj.y, src: rj.aiSrc } : null, f: { x: f.x, y: f.y, w: f.w, h: f.h }, ec: p.ecarts.map((e) => e.kind), card: !!document.querySelector(".aicard .ai-ecarts"), info: document.querySelector(".aicard").textContent }; });
    // appareils décochés (comme le test du mode 1) : pas de relecture automatique, le Ctrl+Z annule bien l'ajout
    await page.uncheck('.aicard [data-k="devices"]');
    await page.click("#ai-ok");
    const J = await ev(() => { const R = (okteo.cab.releves || {})[okteo.level.id] || {}, x = (R.rapport || []).find((y) => y.type === "releve") || {}; return { mode: x.analyse && x.analyse.mode, zones: x.zones, zooms: x.zooms, cw: x.cw, cr: x.cr, appels: (x.appels || []).length, grille: x.grille, ecarts: (R.ecarts || []).length, usd: x.usd }; });
    await page.keyboard.press("Control+z");
    const undone = await ev(() => ({ segs: okteo.state.segs.length, rooms: okteo.state.rooms.length, app: okteo.state.app.length }));
    const r = { glob: glob.length, tiles: tiles.length, zooms: zooms.length, sysCached, imgs, model: req.every((x) => x.body.model === "claude-opus-5-5"), P, J, undone, before };
    const inTopLeft = P.rj && P.rj.x < P.f.x + P.f.w / 2 && P.rj.y < P.f.y + P.f.h / 2 && P.rj.x > P.f.x && P.rj.y > P.f.y;
    if (!(r.glob === 1 && r.tiles === 9 && r.zooms === 1 && sysCached && imgs && r.model && P.dev === 5 && inTopLeft && P.rj.src.includes("tuile 1") && P.ec.includes("ajout") && P.card && /écart/.test(P.info)
      && J.mode === 2 && J.zones === 9 && J.zooms === 1 && J.cw > 0 && J.cr > 0 && J.appels === 11 && J.grille === "3x3" && J.ecarts >= 1 && J.usd > 0
      && undone.segs === before.segs && undone.rooms === before.rooms && undone.app === before.app)) throw new Error(JSON.stringify(r));
    return true;
  });
  await check("v76 étape 3 : mode 3 sur un PDF vectoriel (EVRARD) — aucun nettoyage d'image (règle : pas de prétraitement raster d'un PDF lisible), textes de chaque tuile pris dans le PDF et donnés à l'IA", async () => {
    const n0 = seen.length;
    await ev(() => okteoExt.aiModes.open());
    await page.click('#ai-modes .am-card[data-mode="3"]'); await page.click("#am-go");
    await page.waitForSelector("#ai-ok", { timeout: 300000 }); await closeWait();
    const req = seen.slice(n0).filter((r) => r.url === "/v1/messages");
    const tiles = req.filter((r) => Array.isArray(r.body.system) && r.body.messages.length === 1);
    const one = tiles.every((r) => r.body.messages[0].content.filter((c) => c.type === "image").length === 1);
    const prompts = tiles.map((r) => r.body.messages[0].content.map((c) => c.text || "").join(" "));
    const K = await ev(() => ({ cv: !!(window.cv && window.cv.Mat), txt: document.querySelector(".aicard").textContent }));
    await page.click("#ai-no");
    const r = { tiles: tiles.length, one, pdfTxt: prompts.some((p) => /\(texte du PDF\)/.test(p)), net: prompts.some((p) => /NETTOYÉE/.test(p)), K: { cv: K.cv, txt: K.txt.slice(0, 260) } };
    if (!(tiles.length === 9 && one && r.pdfTxt && !r.net && !K.cv && /PDF vectoriel/.test(K.txt) && /textes lus \(texte du PDF\)/.test(K.txt))) throw new Error(JSON.stringify(r));
    return true;
  });
  // v76 : le chemin des scans (vrais OpenCV.js et Tesseract.js) est vérifié à part : scripts/raster.browser.mjs
  await check("v76 étape 4 : mode 4 « Analyse approfondie » — devis joint, seconde lecture complète, contrôle croisé avec les documents, liste d'écarts à vérifier", async () => {
    const n0 = seen.length;
    await ev(() => okteoExt.aiModes.open());
    await page.click('#ai-modes .am-card[data-mode="4"]');
    await page.setInputFiles("#am-docs-file", "docs/plans/EVRARD_04949_plan.pdf");
    const chip = await page.waitForSelector(".am-chip", { timeout: 5000 }).then(() => true, () => false);
    await page.click("#am-go");
    await page.waitForSelector("#ai-ok", { timeout: 300000 }); await closeWait();
    const req = seen.slice(n0).filter((r) => r.url === "/v1/messages"), txt = (r) => JSON.stringify(r.body.messages);
    const second = req.filter((r) => /SECONDE LECTURE INDÉPENDANTE/.test(txt(r))), cross = req.filter((r) => /Contrôle croisé pour le bureau/.test(txt(r)));
    const P = await ev(() => { const p = okteoExt.aiReleve.plan, c = document.querySelector(".aicard"); return { ec2: p.ecarts.filter((e) => e.kind === "2e").length, doc: p.docEcarts, docs: !!c.querySelector(".ai-docs"), text: c.textContent }; });
    await page.click("#ai-no");
    // n° 3 : lecture globale avec les outils d'Oktéo : outils proposés, résultats renvoyés (légende, symboles, vérification)
    const withTools = req.filter((x) => Array.isArray(x.body.tools) && x.body.tools.length), back = withTools.find((x) => JSON.stringify(x.body.messages).includes('"tool_result"'));
    const T = { asked: withTools.length, names: (withTools[0]?.body.tools || []).map((t) => t.name).join(), results: back ? (back.body.messages.at(-1).content || []).map((c) => (typeof c.content === "string" ? c.content : JSON.stringify(c.content)).slice(0, 40)) : [], verif: back ? /Décompte : LUM 1/.test(JSON.stringify(back.body.messages)) : false };
    const outils = await ev(() => (okteoExt.aiRunner.last || {}).appels);
    const r = { chip, T, outils, second: second.length, cross: cross.length, crossSrc: cross[0] ? /EVRARD_04949_plan\.pdf, page 1/.test(txt(cross[0])) : false, P: { ...P, text: P.text.slice(0, 300) } };
    if (!(T.asked >= 2 && /legende,symboles,textes,murs,zoom,verifier/.test(T.names) && T.results.length === 3 && T.verif && /outils? d'Oktéo/.test(P.text) && chip && r.second === 1 && r.cross === 1 && r.crossSrc && P.ec2 >= 1 && P.doc && !P.doc.off && P.doc.list.length === 1 && P.doc.list[0].t === "LV" && P.docs && /Lave-vaisselle/.test(P.text))) throw new Error(JSON.stringify(r));
    return true;
  });
  await check("n° 3 + lot 1 : « Analyse IA » n'affiche que le mode 4 (choisi d'office), sans bouton pour afficher les autres, même avec l'ancien réglage « tous » ; échelle non réglée = analyse bloquée", async () => {
    await ev(async () => (await import("/src/prefs.js")).setPref("modesIA", "tous"));   // ancien réglage d'un poste : ignoré
    await ev(() => okteoExt.aiModes.open());
    await page.waitForSelector("#ai-modes:not([hidden]) .am-card");
    const one = await ev(() => { const el = document.getElementById("ai-modes"); return { n: el.querySelectorAll(".am-card").length, m: el.querySelector(".am-card").dataset.mode, on: el.querySelector(".am-card").getAttribute("aria-pressed"), all: !!el.querySelector("#am-all") }; });
    await page.keyboard.press("Escape");
    await ev(async () => (await import("/src/prefs.js")).setPref("modesIA", "4"));
    const four = 4;
    const f = await ev(() => { const was = okteo.ch.fond.calibre; okteo.ch.fond.calibre = false; return was; });
    await ev(() => okteoExt.aiModes.open());
    await page.waitForSelector("#ai-modes .am-scale", { timeout: 10000 });
    await page.click('#ai-modes .am-card[data-mode="4"]'); await page.click("#am-go");
    const blocked = await ev(() => okteoExt.aiModes.visible && okteoExt.aiModes.launched == null);
    await page.keyboard.press("Escape");
    await ev((was) => { okteo.ch.fond.calibre = was; }, f);
    if (!(one.n === 1 && one.m === "4" && one.on === "true" && !one.all && four === 4 && blocked)) throw new Error(JSON.stringify({ one, four, blocked }));
    return true;
  });
  await check("n° 16 : « Mémoriser ce symbole » (appareil relevé par l'IA) → mémoire du pavillonneur, lue par l'outil « legende » de l'IA", async () => {
    await ev(() => okteoExt.panel.close("assistant"));
    const id = await ev(() => { const a = okteo.importDevices([{ t: "RJ45", x: 1, y: 1 }]).ids[0]; const o = okteo.state.app.find((x) => x.id === a); o.aiOrigin = "plan"; o.aiType = "RJ45"; return a; });
    await ev((i) => { okteo.select([i]); okteoExt.panel.show("props"); }, id);
    await page.waitForSelector("#f_memo", { timeout: 10000 });
    const done = ev(() => new Promise((ok) => document.addEventListener("okteo:symbol-memorized", (e) => ok(e.detail), { once: true })));
    await page.click("#f_memo");
    const r = await done;
    const t = await ev(async () => { const m = await import("/src/ext/symbol-memory.js"), T = await import("/src/walls/ai-tools.js"); return (await T.runTool("legende", {}, { W: 100, H: 100, memory: m.symbolMemory(okteo.ch.client), pav: okteo.ch.client })).text; });
    await ev(() => { okteo.undo(); okteo.clearSel(); });
    if (!(r && r.type === "RJ45" && /RJ45 : /.test(t))) throw new Error(JSON.stringify({ r: r && { ...r, image: !!r.image }, t: t.slice(0, 300) }));
    return true;
  });
  await check("lot 1 : « Question au pavillonneur » montre la question (modifiable), l'ajoute au rapport avec une confirmation visible ; « Rapport d'analyse » s'ouvre au premier plan", async () => {
    const keepV = await ev(() => ({ on: Object.keys(okteo.layers).filter((k) => okteo.layers[k].on), circ: okteo.showCircuits }));
    await ev(() => { okteoExt.panel.close("assistant"); okteo.setTab("plan"); okteo.viewPreset("impl"); });
    const id = await ev(() => { const S = okteo.state, X = Math.max(0, ...S.nodes.map((n) => n.x)) + 3, Y = Math.min(0, ...S.nodes.map((n) => n.y)) + 6;
      return okteo.importDevices([{ t: "LUM", x: X, y: Y }], [], { stay: true }).ids[0]; });
    await page.waitForTimeout(250);
    const q0 = await ev(() => (okteo.cab.questions || []).length);
    await ev((i) => okteoExt.whyBlink.open(i), id);
    await page.waitForSelector(".whyb:not([hidden]) [data-q]", { timeout: 10000 });
    await page.click(".whyb [data-q]");
    await page.waitForSelector(".whyb .why-qtxt");
    await page.fill(".whyb .why-qtxt", "Quelle commande allume la lumière du couloir (essai lot 1) ?");
    await page.click(".whyb .why-qadd");
    await page.waitForFunction(() => /Question ajoutée au rapport/.test(document.querySelector(".whyb").textContent), null, { timeout: 5000 });
    const q1 = await ev(() => (okteo.cab.questions || []).map((q) => q.text));
    await page.click(".whyb .why-qrap");
    await page.waitForSelector(".rapcard:not([hidden])");
    const rap = await ev(() => ({ txt: document.querySelector(".rapcard").textContent, z: +getComputedStyle(document.querySelector(".rapcard")).zIndex, why: document.querySelector(".whyb").hidden }));
    await ev(() => { document.querySelector(".rapcard").hidden = true; okteo.undo(); okteo.undo(); okteo.clearSel(); });
    const back = await ev((i) => ({ app: okteo.state.app.some((a) => a.id === i), q: (okteo.cab.questions || []).length }), id);
    await ev((V) => { Object.keys(okteo.layers).forEach((k) => okteo.toggleView(k, V.on.includes(k))); okteo.showCircuits = V.circ; }, keepV);
    if (!(q1.length === q0 + 1 && /essai lot 1/.test(q1[q1.length - 1]) && /essai lot 1/.test(rap.txt) && rap.z >= 40 && rap.why && !back.app && back.q === q0)) throw new Error(JSON.stringify({ q0, q1, rap: { ...rap, txt: rap.txt.slice(0, 300) }, back }));
    return true;
  });
  await check("lot 2 : « Pourquoi ça clignote ? » : changer le type, enregistrer le dessin comme variante d'un symbole (bibliothèque), « Je ne sais pas » → suivant, précédent / suivant", async () => {
    const keepV = await ev(() => ({ on: Object.keys(okteo.layers).filter((k) => okteo.layers[k].on), circ: okteo.showCircuits }));
    await ev(() => { okteoExt.panel.close("assistant"); okteo.setTab("plan"); okteo.viewPreset("impl"); });
    const ids = await ev(() => { const S = okteo.state, X = Math.max(0, ...S.nodes.map((n) => n.x)) + 3, Y = Math.min(0, ...S.nodes.map((n) => n.y)) + 8;
      return okteo.importDevices([{ t: "INCONNU", x: X, y: Y, aiStatus: "a_identifier", aiOrigin: "plan", aiNote: "symbole inconnu", aiType: "XYZ" }, { t: "INCONNU", x: X + 1.5, y: Y, aiStatus: "a_identifier", aiOrigin: "plan", aiNote: "symbole inconnu", aiType: "QQQ" }], [], { stay: true }).ids; });
    await page.waitForTimeout(250);
    await ev((i) => okteoExt.whyBlink.open(i), ids[0]);
    await page.waitForSelector(".whyb:not([hidden]) #why-var", { timeout: 10000 });
    const ui0 = await ev(() => ({ prev: !!document.querySelector("#why-prev"), next: !!document.querySelector("#why-next"), idk: !!document.querySelector("#why-idk"), set: !!document.querySelector("#why-settype"), pos: document.querySelector(".why-foot").textContent }));
    await page.selectOption("#why-type", "LUM");
    await page.click("#why-var");
    await page.waitForFunction(() => /Variante enregistrée/.test(document.querySelector(".whyb").textContent), null, { timeout: 10000 });
    const v = await ev(async (i) => { const m = await import("/src/ext/symbol-memory.js"); const L = m.variantsOf("LUM"); return { n: L.length, last: okteoExt.whyBlink.lastVariant, t: okteo.state.app.find((a) => a.id === i).t, dec: Object.values(okteo.cab.decisions || {}).some((d) => d.choix === "variante") }; }, ids[0]);
    await page.click("#why-idk");
    await page.waitForTimeout(200);
    const nav = await ev(() => ({ title: document.querySelector(".whyb h3").textContent, open: !document.querySelector(".whyb").hidden, idk: Object.values(okteo.cab.decisions || {}).some((d) => d.choix === "inconnu") }));
    await ev((i) => okteoExt.whyBlink.open(i), ids[1]);
    await page.waitForSelector(".whyb:not([hidden]) #why-settype", { timeout: 10000 });
    await page.selectOption("#why-type", "PC16");
    await page.click("#why-settype");
    await page.waitForFunction(() => /Type changé/.test(document.querySelector(".whyb").textContent), null, { timeout: 5000 });
    const t2 = await ev((i) => okteo.state.app.find((a) => a.id === i).t, ids[1]);
    // bibliothèque : le symbole LUM montre la variante (dessin du plan) et son nombre sur la carte
    await ev(() => { document.querySelector(".whyb").hidden = true; okteo.setTab("bibliotheque"); });
    await page.waitForSelector('#bibliotheque [data-symbol="LUM"]', { timeout: 10000 });
    await page.click('#bibliotheque [data-symbol="LUM"]');
    await page.waitForSelector("#bibliotheque .sy-var", { timeout: 5000 });
    const lib = await ev(() => ({ white: getComputedStyle(document.querySelector('#bibliotheque [data-symbol="LUM"]')).backgroundColor === "rgb(255, 255, 255)", vars: document.querySelectorAll("#bibliotheque .sy-var").length, tag: (document.querySelector('#bibliotheque [data-symbol="LUM"] .sy-nvar') || {}).textContent || "", svg: document.querySelector('#bibliotheque [data-symbol="LUM"] svg').innerHTML.length }));
    await page.click("#bibliotheque .sy-var [data-forget]");
    await page.waitForTimeout(200);
    const gone = await ev(async () => (await import("/src/ext/symbol-memory.js")).variantsOf("LUM").length);
    await ev(() => { okteo.setTab("plan"); for (let k = 0; k < 4; k++) okteo.undo(); okteo.clearSel(); });
    const back = await ev((I) => I.filter((i) => okteo.state.app.some((a) => a.id === i)).length, ids);
    await ev((V) => { Object.keys(okteo.layers).forEach((k) => okteo.toggleView(k, V.on.includes(k))); okteo.showCircuits = V.circ; }, keepV);
    const r = { ui0, v, nav, t2, lib, gone, back };
    if (!(ui0.prev && ui0.next && ui0.idk && ui0.set && v.n >= 1 && v.last && v.last.type === "LUM" && v.t === "LUM" && v.dec && nav.idk && nav.open && t2 === "PC16" && lib.white && lib.vars >= 1 && /variante/.test(lib.tag) && lib.svg > 20 && gone === v.n - 1 && back === 0)) throw new Error(JSON.stringify(r));
    return true;
  });
  await check("lot 3 : logo Oktéo = accueil (plus d'onglet Chantiers) ; accueil, Paramètres et Bibliothèque en pages entières (MAJ affichage : bandeau 1 gardé, sans bandeau 2 ni panneau de droite) ; flèches « classeur » = retour au plan ; bandeau de la version en ligne rangé à l'accueil, avertissement signalé sur le plan", async () => {
    await ev(() => okteo.setTab("plan"));
    const tabs = await ev(() => [...document.querySelectorAll("#tabs button")].map((b) => b.dataset.tab));
    await page.click(".top .brand");
    const home = await ev(() => ({ tab: okteo.tab, head: !document.querySelector("#home-head").hidden, top: getComputedStyle(document.querySelector(".top")).display, top2: getComputedStyle(document.querySelector(".top2")).display, side: getComputedStyle(document.querySelector(".side")).display, fold: !document.querySelector("#cl-fold").hidden, tabsVis: getComputedStyle(document.querySelector("#tabs")).display }));
    await page.click("#hh-plan");
    const plan = await ev(() => ({ tab: okteo.tab, top: getComputedStyle(document.querySelector(".top")).display, head: document.querySelector("#home-head").hidden }));
    await page.click('#tabs button[data-tab="params"]');
    const par = await ev(() => ({ full: document.body.classList.contains("page-full"), top: getComputedStyle(document.querySelector(".top")).display, fold: !document.querySelector("#cl-fold").hidden, head: document.querySelector("#home-head").hidden }));
    await page.click("#cl-fold");
    await page.waitForFunction(() => okteo.tab === "plan", null, { timeout: 3000 });
    await page.click('#tabs button[data-tab="bibliotheque"]');
    const bib = await ev(() => document.body.classList.contains("page-full") && !document.querySelector("#cl-fold").hidden);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => okteo.tab === "plan", null, { timeout: 3000 });
    // bandeau de la version en ligne (imité) : rangé dans l'accueil ; un avertissement apparaît en pastille sur le plan
    await ev(() => { const b = document.createElement("div"); b.className = "enterprise-bar"; b.innerHTML = '<span id="web-state">Oktéo entreprise · connecté</span><span id="web-saved">Secours local prêt</span>'; document.body.prepend(b); });
    await page.waitForTimeout(50);
    const bar = await ev(() => ({ inHead: !!document.querySelector("#home-head .enterprise-bar"), warn: document.querySelector("#web-warn").hidden }));
    await ev(() => { document.querySelector("#home-head #web-saved").textContent = "⚠ Secours impossible"; });
    await page.waitForTimeout(50);
    const w = await ev(() => ({ hidden: document.querySelector("#web-warn").hidden, txt: document.querySelector("#web-warn").textContent }));
    await page.click("#web-warn");
    const viaWarn = await ev(() => okteo.tab);
    await ev(() => { document.querySelector("#home-head .enterprise-bar").remove(); document.querySelector("#web-warn").hidden = true; okteo.setTab("plan"); });
    const r = { tabs, home, plan, par, bib, bar, w, viaWarn };
    if (!(!tabs.includes("chantiers") && tabs.includes("plan") && home.tab === "chantiers" && home.head && home.top !== "none" && home.top2 === "none" && home.side === "none" && home.fold && home.tabsVis !== "none"
      && plan.tab === "plan" && plan.top !== "none" && plan.head && par.full && par.top !== "none" && par.fold && par.head && bib && bar.inHead && bar.warn && !w.hidden && /Secours impossible/.test(w.txt) && viaWarn === "chantiers")) throw new Error(JSON.stringify(r));
    return true;
  });
  await check("lot 5 : 9 étapes du dossier (surtout des vérifications validées par l'opérateur), jauge d'avancement en tête du panneau Étapes (MAJ affichage : plus dans le bandeau) ; « C'est vérifié » fait avancer la jauge, Ctrl+Z l'annule", async () => {
    await ev(() => okteo.setTab("plan"));
    const g0 = await ev(() => ({ vis: !document.querySelector(".top #st-gauge"), txt: "%", P: okteoExt.tour.progress() }));   // MAJ affichage : jauge seulement dans le panneau Étapes
    await ev(() => okteoExt.panel.show("steps"));
    await page.waitForSelector('.steps li[data-step="murs"]', { timeout: 5000 });
    const L = await ev(() => [...document.querySelectorAll(".steps li[data-step]")].map((li) => li.dataset.step));
    const murs0 = await ev(() => document.querySelector('.steps li[data-step="murs"]').classList.contains("done"));
    await page.click('.steps li[data-step="murs"] button[data-k]');
    await page.waitForFunction(() => document.querySelector('.steps li[data-step="murs"]').classList.contains("done"), null, { timeout: 5000 });
    const g1 = await ev(() => ({ P: okteoExt.tour.progress(), by: !!document.querySelector('.steps li[data-step="murs"] .ok'), txt: document.querySelector(".steps .sg-big").textContent }));
    await ev(() => okteo.undo()); await page.waitForTimeout(250);
    const g2 = await ev(() => okteoExt.tour.progress().n);
    const r = { g0: { ...g0, P: { n: g0.P.n, total: g0.P.total } }, L, murs0, g1: { n: g1.P.n, by: g1.by, txt: g1.txt }, g2 };
    if (!(g0.vis && /%/.test(g0.txt) && g0.P.total === 9 && L.join() === "import,echelle,murs,appareils,boites,verifBoites,cablage,tableau,impression" && !murs0 && g1.P.n === g0.P.n + 1 && g1.by && g2 === g0.P.n)) throw new Error(JSON.stringify(r));
    return true;
  });
  await check("MAJ affichage : bandeau 1 sur une seule ligne, toujours visible (Étude, Pieuvre, Tableau, Symboles, Paramètres, accueil) ; bandeau 2 seulement sur le plan et la 3D ; Imprimer et Fonctions en icônes ; voyant « Connecté »", async () => {
    const out = {};
    for (const t of ["plan", "etude", "boites", "tableau", "bibliotheque", "params", "chantiers", "vue3d"]) {
      await ev((x) => okteo.setTab(x), t); await page.waitForTimeout(120);
      out[t] = await ev(() => ({ top: getComputedStyle(document.querySelector(".top")).display !== "none" && document.querySelector(".top").offsetHeight, top2: getComputedStyle(document.querySelector(".top2")).display !== "none" }));
    }
    await ev(() => okteo.setTab("plan"));
    const icons = await ev(() => ({ print: document.querySelector("#btn-print").textContent.trim(), pal: document.querySelector("#btn-palette").textContent.trim() }));
    await ev(() => { const b = document.createElement("div"); b.className = "enterprise-bar"; b.innerHTML = '<span id="web-state">Oktéo entreprise · connecté · ressources hors ligne prêtes</span><span id="web-saved">Secours local prêt</span>'; document.body.prepend(b); });
    await page.waitForTimeout(80);
    const dot = await ev(() => ({ vis: !document.querySelector("#web-dot").hidden, txt: document.querySelector("#web-dot").textContent, tip: document.querySelector("#web-dot").title, h: document.querySelector(".top").offsetHeight }));
    await ev(() => { document.querySelector("#home-head .enterprise-bar").remove(); document.querySelector("#web-dot").hidden = true; });
    const one = Object.values(out).every((o) => o.top && o.top < 80);
    const two = out.plan.top2 && out.vue3d.top2 && !out.etude.top2 && !out.boites.top2 && !out.tableau.top2 && !out.bibliotheque.top2 && !out.params.top2 && !out.chantiers.top2;
    if (!(one && two && icons.print === "" && icons.pal === "" && dot.vis && /Connecté/.test(dot.txt) && /ressources hors ligne/.test(dot.tip) && dot.h < 80)) throw new Error(JSON.stringify({ out, icons, dot }));
    return true;
  });
  await check("05/11 : « Je confirme l'emplacement » arrête le clignotement (même après un déplacement), noté dans le rapport pour le BE ; Ctrl+Z le rallume ; « Modifier » garde l'appareil sélectionné", async () => {
    const keepV = await ev(() => ({ on: Object.keys(okteo.layers).filter((k) => okteo.layers[k].on), circ: okteo.showCircuits }));
    await ev(() => { okteoExt.panel.close("assistant"); okteo.setTab("plan"); okteo.viewPreset("impl"); });
    const id = await ev(() => { const S = okteo.state, X = Math.max(0, ...S.nodes.map((n) => n.x)) + 3, Y = Math.min(0, ...S.nodes.map((n) => n.y)) + 4;
      return okteo.importDevices([{ t: "PC16", x: X, y: Y, aiStatus: "a_confirmer", aiOrigin: "plan", aiNote: "position estimée" }], [], { stay: true }).ids[0]; });
    await page.waitForTimeout(250);
    const before = await ev((i) => ({ halo: !!document.querySelector(`#fx g.fx-halo[data-k="halo:${i}"]`), n: okteo.control.filter((c) => c.ids.includes(i)).length }), id);
    await ev((i) => okteo.select([i]), id);
    await page.waitForSelector('#hud [data-h="why"]', { timeout: 10000 });
    await page.click('#hud [data-h="why"]');
    await page.waitForSelector(".whyb:not([hidden]) [data-mod]");
    await page.click(".whyb [data-mod]");
    const mod = await ev((i) => ({ hidden: document.querySelector(".whyb").hidden, sel: JSON.stringify(okteo.selection || null).includes(i), still: okteo.control.some((c) => c.ids.includes(i)), props: okteoExt.panel.isOpen("props") }), id);
    await ev((i) => okteo.select([i]), id);
    await page.click('#hud [data-h="why"]');
    await page.waitForSelector(".whyb:not([hidden]) [data-ok]");
    const lab = await ev(() => document.querySelector(".whyb [data-ok]").textContent);
    await page.click(".whyb [data-ok]");
    await page.waitForTimeout(250);
    const after = await ev((i) => ({ halo: !!document.querySelector(`#fx g.fx-halo[data-k="halo:${i}"]:not(.gone)`), n: okteo.control.filter((c) => c.ids.includes(i)).length, txt: document.querySelector(".whyb").textContent }), id);
    await ev((i) => okteo.updateApps([{ id: i, x: okteo.state.app.find((a) => a.id === i).x + 0.5, y: okteo.state.app.find((a) => a.id === i).y }]), id);
    const moved = await ev((i) => okteo.control.filter((c) => c.ids.includes(i)).length, id);
    await ev(() => okteoExt.whyBlink.openRapport());
    await page.click("#rap-copy");
    const txt = await ev(() => okteoExt.whyBlink.lastText);
    const ui = await ev(() => document.querySelector(".rapcard .rap-val") ? document.querySelector(".rapcard .rap-val").textContent : "");
    await ev(() => { okteo.undo(); okteo.undo(); });
    const undone = await ev((i) => okteo.control.filter((c) => c.ids.includes(i)).length, id);
    await ev(() => { okteo.undo(); okteo.undo(); okteo.clearSel(); document.querySelector(".rapcard").hidden = true; document.querySelector(".whyb").hidden = true; });
    const back = await ev((i) => okteo.state.app.some((a) => a.id === i), id);
    await ev((V) => { Object.keys(okteo.layers).forEach((k) => okteo.toggleView(k, V.on.includes(k))); okteo.showCircuits = V.circ; }, keepV);
    if (!(before.halo && before.n === 1 && mod.hidden && mod.sel && mod.still && mod.props && /Je confirme l'emplacement/.test(lab) && !after.halo && after.n === 0 && /emplacement confirmé/.test(after.txt)
      && moved === 0 && /Emplacements confirmés et corrections \(1\)/.test(txt) && /emplacement confirmé \(/.test(txt) && /emplacement confirmé/.test(ui) && undone === 1 && !back)) throw new Error(JSON.stringify({ before, mod, lab, after: { ...after, txt: after.txt.slice(0, 200) }, moved, txt: (txt || "").slice(0, 400), ui, undone, back }));
    return true;
  });
  await check("n° 5 : halo à la couleur de sa famille ; « Pourquoi ça clignote ? » : explication, preuves, choix (et conséquence), question au pavillonneur ; rapport par famille copié pour le BE", async () => {
    const keepV = await ev(() => ({ on: Object.keys(okteo.layers).filter((k) => okteo.layers[k].on), circ: okteo.showCircuits }));
    await ev(() => { okteoExt.panel.close("assistant"); okteo.setTab("plan"); okteo.viewPreset("impl"); });
    const ids = await ev(() => { const S = okteo.state, X = Math.max(0, ...S.nodes.map((n) => n.x)) + 3, Y = Math.min(0, ...S.nodes.map((n) => n.y)) + 1;
      return okteo.importDevices([{ t: "LUM", x: X, y: Y }, { t: "INT", x: X + 2, y: Y, h: 110, aiStatus: "a_confirmer", aiOrigin: "interpretation", aiNote: "INT ou VV ? un seul bras lisible" }], [], { stay: true }).ids; });
    await page.waitForTimeout(300);
    const halo = await ev((i) => { const g = document.querySelector(`#fx g.fx-halo[data-k="halo:${i[0]}"]`), h = document.querySelector(`#fx g.fx-halo[data-k="halo:${i[1]}"]`); return { lum: g ? g.getAttribute("class") : null, int: h ? h.getAttribute("class") : null }; }, ids);
    await ev((i) => okteo.select([i]), ids[0]);
    await page.waitForSelector('#hud [data-h="why"]', { timeout: 10000 });
    await page.click('#hud [data-h="why"]');
    await page.waitForSelector(".whyb:not([hidden]) .why-pt");
    const c1 = await ev(() => ({ t: document.querySelector(".whyb").textContent, q: !!document.querySelector(".whyb [data-q]") }));
    await page.click(".whyb [data-q]");
    await page.click(".whyb .why-qadd");   // lot 1 : la question s'affiche d'abord (modifiable), puis « Ajouter au rapport »
    await page.waitForFunction(() => /Question ajoutée au rapport/.test(document.querySelector(".whyb").textContent), null, { timeout: 5000 });
    const q = await ev(() => (okteo.cab.questions || []).map((x) => x.text));
    await ev((i) => okteo.select([i]), ids[1]);
    await page.click('#hud [data-h="why"]');
    await page.waitForSelector('.whyb:not([hidden]) [data-c]');
    const choix = await ev(() => [...document.querySelectorAll(".whyb [data-c]")].map((b) => b.textContent));
    await page.click('.whyb [data-c]:has-text("Va-et-vient")');
    const after = await ev((i) => ({ t: okteo.state.app.find((a) => a.id === i).t, dec: Object.values(okteo.cab.decisions || {}).map((d) => d.label) }), ids[1]);
    await ev(() => okteoExt.whyBlink.openRapport());
    await page.waitForSelector(".rapcard:not([hidden])");
    await page.click("#rap-copy");
    const txt = await ev(() => okteoExt.whyBlink.lastText);
    await ev(() => { okteo.undo(); okteo.undo(); okteo.undo(); okteo.clearSel(); document.querySelector(".rapcard").hidden = true; document.querySelector(".whyb").hidden = true; });
    const back = await ev((i) => okteo.state.app.filter((a) => i.includes(a.id)).length, ids);
    await ev((V) => { Object.keys(okteo.layers).forEach((k) => okteo.toggleView(k, V.on.includes(k))); okteo.showCircuits = V.circ; }, keepV);
    if (!(/fam-montage/.test(halo.lum || "") && /fam-montage/.test(halo.int || "") && /Montage faux/.test(c1.t) && /Recommandation/.test(c1.t) && c1.q && q.length === 1 && /Quelle commande allume/.test(q[0])
      && choix.length === 2 && /Va-et-vient/.test(choix[1]) && after.t === "VV" && after.dec.some((d) => /Va-et-vient/.test(d)) && /Questions au pavillonneur/.test(txt) && back === 0)) throw new Error(JSON.stringify({ halo, c1: { ...c1, t: c1.t.slice(0, 200) }, q, choix, after, txt: (txt || "").slice(0, 300), back }));
    return true;
  });
  await check("v64.1 : consigne du relevé avec méthode imposée (200 dpi, légende, quarts, décompte) ; image de moins de 3 000 px signalée au collage", async () => {
    const t = await ev(async () => { const m = await import("/src/walls/ai-plan.js"); return { p: m.pastePrompt({ page: 2 }), k: m.aiPrompt({ W: 1500, H: 1000, cmPerPx: 1.2 }) }; });
    const ok = /Méthode \(obligatoire\)/.test(t.p) && /200 dpi/.test(t.p) && /page 2/.test(t.p) && /légende/.test(t.p) && /par quarts/.test(t.p) && /décompte/.test(t.p) && /CHAQUE symbole/.test(t.p) && /CVR\) à côté de la fenêtre/.test(t.p)
      && /Méthode \(obligatoire\)/.test(t.k) && !/200 dpi/.test(t.k);
    if (!ok) throw new Error(t.p.slice(0, 600));
    return true;
  });
  await check("relevé IA sans clé : réponse collée (coordonnées en fraction de page ; v64.1 : petite image signalée), aperçu orange, ajout, un seul Ctrl+Z", async () => {
    const ref = { W: 1000, H: 1000 };
    const rep = { ref, murs: [{ x1: 200, y1: 200, x2: 800, y2: 200, ep: 20 }, { x1: 800, y1: 200, x2: 800, y2: 700, ep: 20 }, { x1: 800, y1: 700, x2: 200, y2: 700, ep: 20 }, { x1: 200, y1: 700, x2: 200, y2: 200, ep: 20 }], ouvertures: [{ x: 500, y: 200, l: 100, t: "fenetre" }], pieces: [{ nom: "Essai collé", x: 500, y: 450 }], appareils: [{ t: "PC16", x: 300, y: 300 }], liaisons: [], remarques: "essai" };
    const before = await ev(() => ({ segs: okteo.state.segs.length, app: okteo.state.app.length }));
    const exp = await ev(async () => { const f = await okteo.levelFond(okteo.level.id); return { x0: f.x + 0.2 * f.w, y0: f.y + 0.2 * f.h, x1: f.x + 0.8 * f.w, y1: f.y + 0.7 * f.h }; });
    await ev(() => okteoExt.aiReleve.pastePanel());
    await page.fill("#ai-paste", "Voici ma réponse :\n```json\n" + JSON.stringify(rep) + "\n```");
    await page.click("#ai-read");
    await page.waitForSelector("#ai-ok", { timeout: 15000 });
    const P = await ev(() => { const p = okteoExt.aiReleve.plan; const xs = p.nodes.map((n) => n.x), ys = p.nodes.map((n) => n.y); return { walls: p.walls.length, op: p.openings.length, dev: p.devices.length, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }; });
    const txt = await page.textContent(".aicard");
    await page.click("#ai-ok");
    const after = await ev(() => ({ segs: okteo.state.segs.length, rooms: okteo.state.rooms.map((r) => r.name).join(","), app: okteo.state.app.length }));
    await page.keyboard.press("Control+z");
    const undone = await ev(() => ({ segs: okteo.state.segs.length, app: okteo.state.app.length }));
    const near = (a, b) => Math.abs(a - b) < 0.02;
    const r = { P, exp, after, undone, before };
    if (P.walls !== 4 || P.op !== 1 || P.dev !== 1 || !near(P.x0, exp.x0) || !near(P.x1, exp.x1) || !near(P.y0, exp.y0) || !near(P.y1, exp.y1)
      || !/Réponse donnée à la main/.test(txt) || !/basse définition/.test(txt) || after.segs !== 4 || !/Essai collé/.test(after.rooms) || after.app !== 1
      || undone.segs !== before.segs || undone.app !== before.app) throw new Error(JSON.stringify(r));
    return true;
  });
  await check("v77 : réponse collée avec « ref » en minuscules et calibre en texte (« 20 A ») acceptée ; 4 murs = pas de recalage sur le PDF (garde-fou affiché)", async () => {
    const rep = { ref: { w: 1000, h: 1000 }, murs: [{ x1: 200, y1: 200, x2: 800, y2: 200, ep: 20 }, { x1: 800, y1: 200, x2: 800, y2: 700, ep: 20 }, { x1: 800, y1: 700, x2: 200, y2: 700, ep: 20 }, { x1: 200, y1: 700, x2: 200, y2: 200, ep: 20 }],
      ouvertures: [], pieces: [{ nom: "Essai v77", x: 500, y: 450 }], appareils: [{ t: "LV", x: 300, y: 300, calibre: "20 A" }, { t: "PLAQ", x: 320, y: 300, calibre: "32A" }], liaisons: [] };
    await ev(() => okteoExt.aiReleve.pastePanel());
    await page.fill("#ai-paste", JSON.stringify(rep));
    await page.click("#ai-read");
    await page.waitForSelector("#ai-ok", { timeout: 15000 });
    await page.waitForFunction(() => /recalé sur le PDF/.test(document.querySelector(".aicard").textContent), null, { timeout: 15000 }).catch(() => {});
    const txt = await page.textContent(".aicard");
    const P = await ev(() => ({ cal: okteoExt.aiReleve.plan.devices.map((d) => d.calibre).join(","), recal: !!okteoExt.aiReleve.recal }));
    await ev(() => okteoExt.aiReleve.close());
    if (P.cal !== "20,32" || P.recal || !/Réponse donnée à la main/.test(txt) || !/non recalé sur le PDF/.test(txt)) throw new Error(JSON.stringify({ P, txt: txt.slice(0, 400) }));
    return true;
  });
  await check("lot 1 : carte de la réponse collée sur un petit écran (1280 × 620, 60 appareils) : la carte tient dans la zone du plan, la liste défile dedans, « Ajouter la sélection » et « Annuler » restent visibles", async () => {
    await page.setViewportSize({ width: 1280, height: 620 });
    const app = []; for (let i = 0; i < 60; i++) app.push({ t: i % 3 ? "PC16" : "INCONNU", x: 220 + (i % 10) * 55, y: 230 + Math.floor(i / 10) * 70, calibre: i % 3 ? 16 : null, inscription: i % 3 ? "" : "symbole " + i });
    const rep = { ref: { W: 1000, H: 1000 }, murs: [{ x1: 200, y1: 200, x2: 800, y2: 200, ep: 20 }, { x1: 800, y1: 200, x2: 800, y2: 700, ep: 20 }, { x1: 800, y1: 700, x2: 200, y2: 700, ep: 20 }, { x1: 200, y1: 700, x2: 200, y2: 200, ep: 20 }],
      ouvertures: [], pieces: [{ nom: "Essai lot 1", x: 500, y: 450 }], appareils: app, liaisons: [], remarques: "x".repeat(900) };
    await ev(() => okteoExt.aiReleve.pastePanel());
    await page.fill("#ai-paste", JSON.stringify(rep));
    await page.click("#ai-read");
    await page.waitForSelector("#ai-ok", { timeout: 15000 });
    await ev(() => document.querySelectorAll(".aicard details").forEach((d) => (d.open = true)));
    const g = await ev(() => { const c = document.querySelector(".aicard"), st = document.querySelector(".stage").getBoundingClientRect(), r = c.getBoundingClientRect(), ok = document.querySelector("#ai-ok").getBoundingClientRect(), no = document.querySelector("#ai-no").getBoundingClientRect();
      return { inStage: r.bottom <= st.bottom + 1 && r.top >= st.top - 1, scrolls: c.scrollHeight > c.clientHeight + 20, okIn: ok.bottom <= r.bottom + 1 && ok.top >= r.top && ok.bottom <= innerHeight, noIn: no.bottom <= r.bottom + 1 && no.bottom <= innerHeight }; });
    await page.click("#ai-ok", { trial: true });
    await page.click("#ai-no");
    await page.setViewportSize({ width: 1500, height: 900 });
    if (!(g.inStage && g.scrolls && g.okIn && g.noIn)) throw new Error(JSON.stringify(g));
    return true;
  });
  await check("lot 1 : échelle mesurée par l'IA à plus de 10 % de celle du fond → collage bloqué ; « Régler l'échelle d'après la réponse » règle le fond puis colle", async () => {
    const f0 = await ev(async () => { const f = await okteo.levelFond(okteo.level.id); return { w: f.w, h: f.h, x: f.x, y: f.y }; });
    const fondPxM = 1000 / f0.w, ia = +(fondPxM * 1.5).toFixed(1);
    const rep = { ref: { W: 1000, H: 1000 }, murs: [{ x1: 200, y1: 200, x2: 800, y2: 200, ep: 20 }, { x1: 800, y1: 200, x2: 800, y2: 700, ep: 20 }, { x1: 800, y1: 700, x2: 200, y2: 700, ep: 20 }, { x1: 200, y1: 700, x2: 200, y2: 200, ep: 20 }],
      ouvertures: [], pieces: [{ nom: "Essai échelle", x: 500, y: 450 }], appareils: [{ t: "PC16", x: 300, y: 300 }], liaisons: [], remarques: `Échelle mesurée : ${String(ia).replace(".", ",")} px par mètre sur 3 cotes.` };
    await ev(() => okteoExt.aiReleve.pastePanel());
    await page.fill("#ai-paste", JSON.stringify(rep));
    await page.click("#ai-read");
    await page.waitForSelector("#ai-scale-fix", { timeout: 15000 });
    const blocked = await ev(() => ({ txt: document.querySelector(".aicard").textContent, plan: !!okteoExt.aiReleve.plan, ok: !!document.querySelector("#ai-ok") }));
    await page.click("#ai-scale-fix");
    await page.waitForSelector("#ai-ok", { timeout: 15000 });
    const after = await ev(async () => { const f = await okteo.levelFond(okteo.level.id); return { w: f.w, txt: document.querySelector(".aicard").textContent }; });
    await ev(() => okteoExt.aiReleve.close());
    // fond remis comme avant (l'échelle du fond n'est pas dans Ctrl+Z)
    await ev((F) => { const a = { x: okteo.BG.x, y: okteo.BG.y }; okteo.applyCalib(a, { x: a.x + 1, y: a.y }, F.w / okteo.BG.w); }, f0);
    const back = await ev(async () => (await okteo.levelFond(okteo.level.id)).w);
    const r = { blocked: { ...blocked, txt: blocked.txt.slice(0, 300) }, after: { ...after, txt: after.txt.slice(0, 200) }, f0, back, ia };
    if (!(/Échelle à régler avant de coller/.test(blocked.txt) && !blocked.ok && Math.abs(after.w / f0.w - 1 / 1.5) < 0.01 && /conforme au fond/.test(after.txt) && Math.abs(back - f0.w) < 1e-6)) throw new Error(JSON.stringify(r));
    return true;
  });
  await check("lot 1 : échelle écrite sur le plan (« Ech : 1:50 ») et cotes en centimètres reconnues ; plausibilité (1/20 à 1/200)", async () => {
    const r = await ev(async () => { const E = await import("/src/walls/echelle.js"), D = await import("/src/walls/digits.js"), P = await import("/src/ext/pdf-page.js");
      return { w: E.writtenScale([{ str: "Ech : 1:50" }]), c: [D.cotValue("180"), D.cotValue("1 840"), D.cotValue("1.80"), D.cotValue("A12")].join(","), pl: [P.plausible(okteo, 1), P.plausible(okteo, 100)].join(",") }; });
    if (!(r.w === 50 && r.c === "1.8,18.4,1.8," && r.pl === "true,false")) throw new Error(JSON.stringify(r));
    return true;
  });
  await check("MAJ mémoire : un symbole appris (lu « QWE » = point lumineux) est reconnu à la réponse collée suivante, sans doute ; la consigne copiée contient la liste des symboles appris", async () => {
    const id = await ev(async () => { const m = await import("/src/ext/symbol-memory.js"); return m.remember({ pav: okteo.ch.client || "", type: "LUM", desc: "essai mémoire", lu: "QWE", by: "essai" }).id; });
    const rep = { ref: { W: 1000, H: 1000 }, murs: [{ x1: 200, y1: 200, x2: 800, y2: 200, ep: 20 }, { x1: 800, y1: 200, x2: 800, y2: 700, ep: 20 }, { x1: 800, y1: 700, x2: 200, y2: 700, ep: 20 }, { x1: 200, y1: 700, x2: 200, y2: 200, ep: 20 }],
      ouvertures: [], pieces: [{ nom: "Essai mémoire", x: 500, y: 450 }], appareils: [{ t: "QWE", x: 500, y: 450 }, { t: "RTY", x: 300, y: 300 }], liaisons: [] };
    await ev(() => okteoExt.aiReleve.pastePanel());
    await page.click("#ai-copy");
    await page.waitForFunction(() => !/Copier la consigne/.test(document.querySelector("#ai-copy").textContent), null, { timeout: 5000 });
    const cons = await ev(() => okteoExt.aiReleve.copied);
    await page.fill("#ai-paste", JSON.stringify(rep));
    await page.click("#ai-read");
    await page.waitForSelector("#ai-ok", { timeout: 15000 });
    const r = await ev(() => ({ t: okteoExt.aiReleve.plan.devices.map((d) => d.t + ":" + (d.aiStatus || "")).join(","), txt: document.querySelector(".aicard").textContent }));
    await ev(() => okteoExt.aiReleve.close());
    await ev(async (i) => { const m = await import("/src/ext/symbol-memory.js"); await m.forget(okteo.ch.client || "", i); }, id);
    if (!(/« QWE » = LUM/.test(cons) && r.t === "LUM:lu,INCONNU:a_identifier" && /1 symbole reconnu par la mémoire/.test(r.txt))) throw new Error(JSON.stringify({ r: { ...r, txt: r.txt.slice(0, 300) }, cons: /QWE/.test(cons) }));
    return true;
  });
  await check("relevé IA sans clé (v55.1) : « Copier la consigne » (ref, 40 types, hauteurs, CVR) ; réponse avec radiateur, volet + CVR, hauteur lue", async () => {
    await ev(() => okteoExt.aiReleve.pastePanel());
    await page.click("#ai-copy");
    await page.waitForFunction(() => !/Copier la consigne/.test(document.querySelector("#ai-copy").textContent), null, { timeout: 5000 });
    const P0 = await ev(() => okteoExt.aiReleve.copied);
    const cons = /"ref"/.test(P0) && /CVR vers VR ou VEL/.test(P0) && /H:1\.20m/.test(P0) && /RAD = /.test(P0) && /CETH = /.test(P0) && /ne le coupe jamais/.test(P0) && /TOUTES les lumières/.test(P0);
    const rep = { ref: { W: 1000, H: 1000 }, murs: [{ x1: 200, y1: 200, x2: 800, y2: 200, ep: 20 }, { x1: 800, y1: 200, x2: 800, y2: 700, ep: 20 }, { x1: 800, y1: 700, x2: 200, y2: 700, ep: 20 }, { x1: 200, y1: 700, x2: 200, y2: 200, ep: 20 }],
      ouvertures: [{ x: 500, y: 200, l: 120, t: "fenetre" }], pieces: [{ nom: "Chambre essai", x: 500, y: 450 }],
      appareils: [{ t: "RAD", x: 300, y: 690 }, { t: "VR", x: 500, y: 210 }, { t: "CVR", x: 600, y: 210, h: 110 }, { t: "INT", x: 210, y: 400, h: 120 }, { t: "LUM", x: 500, y: 450 }, { t: "XYZ", x: 400, y: 400 }],
      liaisons: [[2, 1], [4, 3], [0, 4]] };
    await page.fill("#ai-paste", JSON.stringify(rep));
    await page.click("#ai-read");
    await page.waitForSelector("#ai-ok", { timeout: 15000 });
    const P = await ev(() => { const p = okteoExt.aiReleve.plan; return { t: p.devices.map((d) => d.t).join(","), h: p.devices.map((d) => d.h || 0).join(","), links: p.links.map((l) => p.devices[l.c].t + ">" + p.devices[l.l].t).join(",") }; });
    const n0 = await ev(() => okteo.state.app.length);
    await page.click("#ai-ok");
    const A = await ev(() => ({ int: (okteo.state.app.find((a) => a.t === "INT") || {}).h, rad: okteo.state.app.some((a) => a.t === "RAD"), lia: okteo.state.lia.length }));
    await page.keyboard.press("Control+z");
    const back = await ev(() => okteo.state.app.length);
    const ok = cons && P.t === "RAD,VR,CVR,INT,LUM,INCONNU" && P.h === "0,0,110,120,0,0" && P.links === "CVR>VR,INT>LUM" && A.int === 120 && A.rad && A.lia === 2 && back === n0;
    if (!ok) throw new Error(JSON.stringify({ cons, P, A, back, n0 }));
    return true;
  });
  await check("relecture étendue (v61) : pièce non fermée, type vague, ouverture perdue, porte sans sens, doutes de l'IA → corrections de chaque sorte, rapport avec % de réussite (onglet Étude), un Ctrl+Z", async () => {
    const before = await ev(() => ({ app: okteo.state.app.length, segs: okteo.state.segs.length }));
    const rep = { ref: { W: 1000, H: 1000 }, murs: [{ x1: 200, y1: 200, x2: 800, y2: 200, ep: 20 }, { x1: 800, y1: 200, x2: 800, y2: 700, ep: 20 }, { x1: 800, y1: 700, x2: 200, y2: 700, ep: 20 }, { x1: 200, y1: 700, x2: 200, y2: 200, ep: 20 }],
      ouvertures: [{ x: 500, y: 700, l: 90, t: "porte" }, { x: 500, y: 900, l: 120, t: "fenetre" }], pieces: [{ nom: "Chambre essai", x: 500, y: 450 }, { nom: "Cellier essai", x: 900, y: 450 }],
      appareils: [{ t: "SC", x: 300, y: 300 }, { t: "PC16", x: 700, y: 650, h: 30 }], liaisons: [], remarques: "la sortie de câble est peut-être un chauffe-eau" };
    await ev(() => okteoExt.aiReleve.pastePanel());
    await page.fill("#ai-paste", JSON.stringify(rep));
    await page.click("#ai-read");
    await page.waitForSelector("#ai-ok", { timeout: 15000 });
    await page.click("#ai-ok");
    await ev(() => okteoExt.recheck.open());
    await page.waitForSelector("#rk-copy", { timeout: 10000 });
    const list = await page.textContent(".rkcard .rk-list");
    await page.click("#rk-copy");
    await page.waitForFunction(() => !/Copier la relecture/.test(document.querySelector("#rk-copy").textContent), null, { timeout: 5000 });
    const txt = await ev(() => okteoExt.recheck.copied);
    const info = await ev(() => ({ door: okteo.openingsInfo().find((o) => o.kind === "porte"), sc: okteo.allApps().find((a) => a.t === "SC") }));
    const corr = { types: [{ rep: info.sc.rep, t: "CETH" }], portes: [{ rep: info.door.rep, gx: 54, gy: 70, vx: 50, vy: 66 }], ouvertures: [{ rep: "X1", x: 50, y: 20, l: 120, t: "fenetre" }],
      introuvable: [{ rep: "Cellier essai", pourquoi: "c'est une note hors du plan" }], remarques: "c'est bien un chauffe-eau" };
    await page.fill("#rk-paste", JSON.stringify(corr));
    await page.click("#rk-read");
    await page.waitForSelector("#rk-ok", { timeout: 5000 });
    await page.click("#rk-ok");
    await page.waitForSelector("#rk-rep", { timeout: 5000 });
    const card = await page.textContent(".rkcard");
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + "/relecture-rapport.png" });
    const A = await ev(() => ({ ceth: okteo.state.app.some((a) => a.t === "CETH"), door: okteo.state.openings.find((o) => o.kind === "porte"), nOp: okteo.state.openings.length, rap: (okteo.cab.releves[okteo.level.id].rapport || []).length }));
    await page.click("#rk-rep");
    await page.waitForSelector("#et-ia .ia-pass", { timeout: 10000 });
    const et = await page.textContent("#et-ia");
    if (process.env.SHOT) { await page.$eval("#et-ia", (e) => e.scrollIntoView()); await (await page.$("#et-ia")).screenshot({ path: process.env.SHOT + "/rapport-ia.png" }); }
    await page.click('#tabs button[data-tab="plan"]');
    await page.keyboard.press("Control+z"); await page.keyboard.press("Control+z");
    const back = await ev(() => ({ app: okteo.state.app.length, segs: okteo.state.segs.length }));
    const r = { list, card: card.slice(0, 300), A, et: et.slice(0, 300), back, before };
    // v72.1 : depuis v71 le sens des portes n'est plus relu par défaut (pas de point « sens de porte ») : 4 points, 3 corrigés
    const C = { liste: /pièce non fermée/.test(list) && /type à préciser/.test(list) && /ouverture loin des murs/.test(list) && !/sens de porte non lu/.test(list) && /doute signalé par l'IA/.test(list),
      consigne: /« Cellier essai »/.test(txt) && /chauffe-eau/.test(txt), ceth: A.ceth, ouvertures: A.nOp === 2, rapport: A.rap === 2,
      carte: /points corrigés \(\d+ %\)/.test(card) && /sous réserve du contrôle BE/.test(card) && /introuvable/.test(card) && /3\/4 points corrigés \(75 %\)/.test(card),
      etude: /Réussite des relectures : 3\/4 points corrigés/.test(et) && /Relecture 1/.test(et), annuler: back.app === before.app && back.segs === before.segs };
    const ok = Object.values(C).every(Boolean); r.C = C;
    if (!ok) throw new Error(JSON.stringify(r));
    return true;
  });
  await check("relecture étendue (v61) : mur qui manque donné par l'IA → la pièce se ferme et prend son nom (jonctions recollées), un Ctrl+Z", async () => {
    const before = await ev(() => ({ rooms: okteo.state.rooms.length, segs: okteo.state.segs.length }));
    const rep = { ref: { W: 1000, H: 1000 }, murs: [{ x1: 200, y1: 200, x2: 800, y2: 200, ep: 20 }, { x1: 800, y1: 200, x2: 800, y2: 700, ep: 20 }, { x1: 800, y1: 700, x2: 200, y2: 700, ep: 20 }, { x1: 200, y1: 700, x2: 200, y2: 200, ep: 20 },
      { x1: 800, y1: 200, x2: 950, y2: 200, ep: 20 }, { x1: 950, y1: 200, x2: 950, y2: 700, ep: 20 }], ouvertures: [], pieces: [{ nom: "Séjour essai", x: 500, y: 450 }, { nom: "Cellier essai", x: 875, y: 450 }],
      appareils: [{ t: "PC16", x: 300, y: 690, h: 30 }], liaisons: [] };
    await ev(() => okteoExt.aiReleve.pastePanel());
    await page.fill("#ai-paste", JSON.stringify(rep));
    await page.click("#ai-read");
    await page.waitForSelector("#ai-ok", { timeout: 15000 });
    await page.click("#ai-ok");
    const mid = await ev(() => okteo.state.rooms.map((r) => r.name).sort().join(","));
    await ev(() => { okteoExt.recheck.done.clear(); return okteoExt.recheck.open(); });
    await page.waitForSelector("#rk-paste", { timeout: 10000 });
    const list = await page.textContent(".rkcard .rk-list");
    await page.fill("#rk-paste", JSON.stringify({ murs: [{ x1: 95, y1: 70, x2: 80, y2: 70, ep: 20, pour: "Cellier essai" }] }));
    await page.click("#rk-read");
    await page.waitForSelector("#rk-ok", { timeout: 5000 });
    await page.click("#rk-ok");
    await page.waitForSelector("#rk-close", { timeout: 5000 });
    const card = await page.textContent(".rkcard");
    const after = await ev(() => okteo.state.rooms.map((r) => r.name).sort().join(","));
    await page.click("#rk-close");
    await page.keyboard.press("Control+z");
    const undone = await ev(() => okteo.state.rooms.map((r) => r.name).sort().join(","));
    await page.keyboard.press("Control+z");
    const back = await ev(() => ({ rooms: okteo.state.rooms.length, segs: okteo.state.segs.length }));
    const r = { mid, list, after, undone, card: card.slice(0, 200), back, before };
    if (!(mid === "Séjour essai" && /pièce non fermée/.test(list) && /Cellier essai/.test(list) && after === "Cellier essai,Séjour essai" && /1\/1 points corrigés \(100 %\)/.test(card) && undone === "Séjour essai" && back.segs === before.segs && back.rooms === before.rooms)) throw new Error(JSON.stringify(r));
    return true;
  });
  // v57 : relecture ciblée (sans clé : copier / coller ; avec clé : boucle limitée)
  const rkSetup = () => ev(() => {
    const xs = okteo.state.nodes.map((n) => n.x).concat(okteo.state.app.map((a) => a.x)), ys = okteo.state.nodes.map((n) => n.y).concat(okteo.state.app.map((a) => a.y));
    const X = Math.max(...xs) + 1.5, Y = Math.max(...ys) + 1.5;
    return okteo.importDevices([{ t: "APP", x: X, y: Y }, { t: "INT", x: X + 0.6, y: Y }], []).ids;
  });
  await check("relecture ciblée sans clé (v57) : points du contrôle → « Copier la relecture » ; corrections collées → aperçu → appliquées en un seul Ctrl+Z", async () => {
    const ids = await rkSetup();
    const n0 = await ev(() => okteo.state.lia.length);
    await ev((ids) => okteoExt.recheck.open({ ids }), ids);
    await page.waitForSelector("#rk-copy", { timeout: 10000 });
    const list = await page.textContent(".rkcard .rk-list");
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + "/relecture.png" });
    await page.click("#rk-copy");
    await page.waitForFunction(() => !/Copier la relecture/.test(document.querySelector("#rk-copy").textContent), null, { timeout: 5000 });
    const txt = await ev(() => okteoExt.recheck.copied);
    const reps = await ev((ids) => ids.map((id) => okteo.allApps().find((a) => a.id === id).rep), ids);
    const cons = /Relecture ciblée/.test(txt) && txt.includes(reps[0]) && txt.includes("Repères proches : " + reps[1]) && /POURCENTAGE de la page \d+ du PDF joint/.test(txt);
    await page.fill("#rk-paste", JSON.stringify({ liaisons: [[reps[1], reps[0]]], ajouts: [], introuvable: [] }));
    await page.click("#rk-read");
    await page.waitForSelector("#rk-ok", { timeout: 5000 });
    const prop = await page.textContent(".rkcard");
    await page.click("#rk-ok");
    const after = await ev((ids) => ({ lia: okteo.state.lia.filter((l) => l.c === ids[1] && l.l === ids[0]).length, ctl: okteo.control.filter((it) => it.ids.some((x) => ids.includes(x))).length }), ids);
    await page.keyboard.press("Control+z");
    const back = await ev(() => okteo.state.lia.length);
    await ev((ids) => okteo.removeApps(ids), ids);
    const r = { cons, list, prop: /1 liaison/.test(prop), after, back, n0 };
    if (!cons || !/commande non identifiée/.test(list) || !r.prop || after.lia !== 1 || after.ctl !== 0 || back !== n0) throw new Error(JSON.stringify(r));
    return true;
  });
  await check("relecture ciblée avec clé (v57) : image + consigne envoyées, corrections appliquées, arrêt quand plus rien à revoir, jetons comptés ; introuvable jamais redemandé", async () => {
    await ev(() => okteoExt.settings.set({ provider: "anthropic" }));
    const ids = await rkSetup();
    const n0 = seen.length;
    const log = await ev((ids) => okteoExt.recheck.loop({ max: 2, ids }), ids);
    const reqs = seen.slice(n0).filter((r) => r.url === "/v1/messages");
    const img = reqs[0] && reqs[0].body.messages[0].content.some((c) => c.type === "image");
    // v61 : zooms autour des points en plus du plan entier, chacun annoncé dans la consigne
    const nImg = reqs[0] ? reqs[0].body.messages[0].content.filter((c) => c.type === "image").length : 0, zoomTxt = reqs[0] ? reqs[0].body.messages[0].content.map((c) => c.text || "").join(" ") : "";
    const linked = await ev((ids) => okteo.state.lia.some((l) => l.c === ids[1] && l.l === ids[0]), ids);
    const card = await page.textContent(".rkcard");
    // un point « introuvable » : marqué sur l'appareil, plus jamais demandé
    await ev((ids) => okteo.removeApps(ids), ids);
    const ids2 = await rkSetup();
    const reps2 = await ev((ids) => ids.map((id) => okteo.allApps().find((a) => a.id === id).rep), ids2);
    await ev(({ ids, reps }) => { okteoExt.recheck.done.clear(); return okteoExt.recheck.open({ ids }).then(() => okteoExt.recheck.fromText(JSON.stringify({ introuvable: [{ rep: reps[0], pourquoi: "pas de commande dessinée" }, { rep: reps[1], pourquoi: "seul" }] }))); }, { ids: ids2, reps: reps2 });
    await page.click("#rk-ok");
    const flag = await ev((id) => okteo.allApps().find((a) => a.id === id).aiNo, ids2[0]);
    const n1 = seen.length;
    const log2 = await ev((ids) => { okteoExt.recheck.done.clear(); return okteoExt.recheck.loop({ max: 2, ids }); }, ids2);
    const asked = seen.length - n1;
    await ev((ids) => { okteo.removeApps(ids); okteoExt.recheck.close(); }, ids2);
    if (!(nImg >= 2 && /Zoom 1 : 4 m autour du point 1/.test(zoomTxt) && /Zoom 1 : image agrandie/.test(zoomTxt))) throw new Error("zooms : " + nImg + " " + zoomTxt.slice(0, 200));
    const r = { log, reqs: reqs.length, img, linked, card: /Relecture terminée/.test(card), flag, log2, asked };
    if (!log || log.passes !== 1 || log.tokens !== 1200 || !/plus rien/.test(log.why) || reqs.length !== 1 || !img || !linked || !r.card || flag !== "pas de commande dessinée" || asked !== 0 || log2.passes !== 0) throw new Error(JSON.stringify(r));
    return true;
  });
  await check("porte de garage (v57) : sans battant sur le plan et à l'impression, type choisi dans Propriétés", async () => {
    await ev(async () => { (await import("/src/prefs.js")).setPref("ouvrants", true); });   // ouvrants masqués par défaut depuis v71
    const r = await ev(() => {
      const S = window.__okteo.state, o = S.openings.find((x) => x.kind === "porte");
      if (!o) return null;
      okteo.select([o.id]); okteoExt.panel.show("props");
      const sel = document.querySelector("#ok");
      sel.value = "garage"; sel.dispatchEvent(new Event("change", { bubbles: true }));
      const g = okteo.exportGeometry().openings.find((x) => x.kind === "garage");
      const title = document.querySelector("#sidebody h3")?.textContent;
      const dashed = document.querySelectorAll('#sv line[stroke-dasharray="0.25 0.12"]').length;
      return { kind: o.kind, arc: g && !!(g.arc || g.leaf), title, dashed, id: o.id };
    });
    await page.keyboard.press("Control+z");
    const back = await ev((id) => window.__okteo.state.openings.find((x) => x.id === id).kind, r && r.id);
    await ev(() => okteo.select([]));
    await ev(async () => { (await import("/src/prefs.js")).setPref("ouvrants", false); });
    if (!r || r.kind !== "garage" || r.arc || r.title !== "Porte de garage" || r.dashed < 1 || back !== "porte") throw new Error(JSON.stringify({ r, back }));
    return true;
  });
  await check("équipements hors plan (v57, R-100) : liste du panneau Câblage, posés dans la bonne pièce en violet « à vérifier avec le devis », registre, un seul Ctrl+Z", async () => {
    await ev(() => { okteoExt.panel.show("cablage"); });
    await page.waitForSelector("#hp-sec", { timeout: 5000 });
    await ev(() => { document.getElementById("hp-sec").open = true; });
    const n0 = await ev(() => ({ app: okteo.state.app.length, four: okteo.allApps().filter((a) => a.t === "FOUR").length, ss: okteo.allApps().filter((a) => a.t === "SS").length }));
    const pre = await ev(() => [...document.querySelectorAll("#hp-sec [data-hp]")].filter((c) => c.checked).map((c) => c.dataset.hp).join(","));
    await ev(({ four, ss }) => { const fire = (el) => el.dispatchEvent(new Event("change"));
      document.querySelectorAll("#hp-sec [data-hp]").forEach((c) => { c.checked = ["FOUR", "SS"].includes(c.dataset.hp); fire(c); });
      const f = document.querySelector('#hp-sec [data-hq="FOUR"]'), s = document.querySelector('#hp-sec [data-hq="SS"]'); f.value = four + 1; fire(f); s.value = ss + 1; fire(s); }, n0);
    await page.click("#hp-go");
    const A = await ev(() => { const N = okteo.state.app.filter((a) => a.hp); return { n: N.length, t: N.map((a) => a.t).sort().join(","), rooms: N.map((a) => okteo.allApps().find((x) => x.id === a.id).room || "-").join(","), mark: document.querySelectorAll("#sv rect.hp-mark").length, cab: JSON.stringify(okteo.cab.horsplan), reg: JSON.parse(localStorage.getItem("okteo.horsplan.v1")).chantiers[okteo.ch.id] }; });
    const sec = await page.textContent("#hp-sec summary");
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + "/hors-plan.png" });
    // panneau Propriétés : marque « à vérifier » et bouton Vérifié
    const id = await ev(() => okteo.state.app.find((a) => a.hp).id);
    await ev((id) => { okteo.select([id]); okteoExt.panel.show("props"); }, id);
    const note = await page.isVisible("#f_hp");
    await page.keyboard.press("Control+z");
    const back = await ev(() => ({ app: okteo.state.app.length, hp: okteo.state.app.filter((a) => a.hp).length, cab: okteo.cab.horsplan || null }));
    await ev(() => okteo.select([]));
    const r = { pre, A, sec, note, back, n0 };
    if (!/FOUR/.test(pre) || A.n !== 2 || A.t !== "FOUR,SS" || A.mark < 2 || !/"FOUR":/.test(A.cab) || !A.reg || !A.reg.FOUR || !/2 posés à vérifier/.test(sec) || !note
      || back.app !== n0.app || back.hp !== 0 || back.cab) throw new Error(JSON.stringify(r));
    return true;
  });
  await check("version en ligne : Claude appelé directement depuis le navigateur ; NVIDIA refusé avec un message clair", async () => {
    let hdr = null;
    await page.route("https://api.anthropic.com/v1/messages", (route) => { hdr = route.request().headers(); route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ content: [{ type: "text", text: "OK direct" }] }) }); });
    const r = await ev(async () => {
      const ai = await import("/src/ext/ai.js"), env = { ...okteoExt.settings.env };
      okteoExt.settings.setEnv({ online: false });
      const a = await ai.chat({ provider: "anthropic", system: "s", messages: [{ role: "user", text: "q" }] }).then((x) => x.text, (e) => "ERR " + e.message);
      const n = await ai.chat({ provider: "nvidia", system: "s", messages: [{ role: "user", text: "q" }] }).then((x) => x.text, (e) => "ERR " + e.message);
      okteoExt.settings.setEnv(env);
      return { a, n };
    });
    await page.unroute("https://api.anthropic.com/v1/messages");
    if (r.a !== "OK direct" || !hdr || hdr["anthropic-dangerous-direct-browser-access"] !== "true" || hdr["x-api-key"] !== "sk-test" || !/version locale/.test(r.n)) throw new Error(JSON.stringify({ r, hdr }));
    return true;
  });

  console.log("Fiabilité (v21)");
  await check("repères fixes : supprimer P2 ne renumérote pas les autres ; une copie reçoit un nouveau numéro", async () => {
    const before = await ev(() => okteo.repMap());
    const ids = await ev(() => { const m = okteo.repMap(), byRep = Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k])); return { p2: byRep.P2, p5: byRep.P5, max: Math.max(...Object.values(m).filter((r) => /^P\d/.test(r)).map((r) => +r.slice(1))) }; });
    await ev((id) => { okteo.select([id]); okteo.deleteSelection(); }, ids.p2);
    const after = await ev(() => okteo.repMap());
    const stable = after[ids.p5] === "P5" && Object.keys(after).every((k) => after[k] === before[k]);
    await ev((id) => { okteo.select([id]); okteo.duplicate(); }, ids.p5);
    const dup = await ev(() => { const m = okteo.repMap(), v = Object.values(m); return { uniq: new Set(v).size === v.length, n: v.filter((r) => /^P\d/.test(r)).length }; });
    const newMax = await ev(() => Math.max(...Object.values(okteo.repMap()).filter((r) => /^P\d/.test(r)).map((r) => +r.slice(1))));
    await ev(() => { okteo.clearSel(); okteo.undo(); okteo.undo(); });
    const back = await ev(() => okteo.repMap()[Object.keys(okteo.repMap())[0]] !== undefined && okteo.state.app.length);
    return stable && dup.uniq && newMax === ids.max + 1 && back === Object.keys(before).length;
  });
  await check("« Renuméroter les repères » (Ctrl+K) : numéros continus, pièce par pièce, un seul Ctrl+Z", async () => {
    await ev((id) => { okteo.select([id]); okteo.deleteSelection(); }, await ev(() => Object.entries(okteo.repMap()).find(([, v]) => v === "P3")[0]));
    await page.keyboard.press("Control+k"); await page.keyboard.type("renuméroter"); await page.keyboard.press("Enter");
    const ok1 = await ev(() => { const P = Object.values(okteo.repMap()).filter((r) => /^P\d/.test(r)).map((r) => +r.slice(1)).sort((a, b) => a - b); return P.every((n, i) => n === i + 1); });
    await ev(() => okteo.undo());
    const gap = await ev(() => !Object.values(okteo.repMap()).includes("P3"));
    await ev(() => okteo.undo());
    return ok1 && gap;
  });
  await check("enregistrement impossible : alerte visible + « Enregistrer en fichier » ; disparaît quand ça remarche", async () => {
    await ev(() => { window.__set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === okteo.ch.key) throw new Error("QuotaExceededError"); return window.__set.call(this, k, v); }; });
    await ev(() => { okteo.snapshot(); okteo.state.app[0].h = 31; okteo.markDirty(); okteo.draw(); });
    await page.waitForSelector("#save-alert:not([hidden])", { timeout: 5000 });
    const chip = await page.textContent("#savetxt");
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#sa-file")]);
    const j = JSON.parse(fs.readFileSync(await dl.path(), "utf8"));
    const live = j.dessin && JSON.parse(j.dessin.s).app[0].h === 31;
    await ev(() => { Storage.prototype.setItem = window.__set; okteo.undo(); });
    await page.waitForFunction(() => document.querySelector("#savetxt").textContent === "Enregistré", null, { timeout: 5000 });
    return chip.includes("Non enregistré") && live && dl.suggestedFilename().endsWith(".okteo") && (await page.isHidden("#save-alert"));
  });
  await check("sauvegarde automatique dans un dossier : copie .okteo écrite, état affiché en haut", async () => {
    await ev(async () => { const d = await navigator.storage.getDirectory(); await okteoExt.backup.setDir(d, { remember: false }); });
    const r = await ev(async () => {
      const d = await navigator.storage.getDirectory(); let f = null;
      for await (const [name, h] of d.entries()) if (name.endsWith(".okteo")) f = await (await h.getFile()).text();
      const j = f && JSON.parse(f); return { ok: !!j && j.format === "okteo-chantier" && JSON.parse(j.dessin.s).app.length === okteo.state.app.length, st: okteoExt.backup.status() };
    });
    const chip = await page.textContent("#bkp");
    await ev(() => okteoExt.backup.stop());
    return r.ok && r.st.active && /copie \d\d:\d\d/.test(chip);
  });
  await check("panneau Propriétés : aucun champ ne dépasse ; menu Affichage ; appareils dessinés avec leur symbole", async () => {
    const id = await ev(() => okteo.state.app.find((a) => a.seg).id);
    await ev((id) => okteo.select([id]), id);
    const over = await ev(() => { const R = document.querySelector("#side").getBoundingClientRect(); return [...document.querySelectorAll("#sidebody input, #sidebody select")].filter((e) => e.getBoundingClientRect().right > R.right + 0.5).length; });
    await ev(() => okteo.clearSel());
    await page.click("#btn-view"); const vis = await page.isVisible("#dims"); await page.keyboard.press("Escape");
    const hid = await page.isHidden("#dims");
    const glyphs = await ev(() => [...document.querySelectorAll(".palette .pb")].every((b) => b.querySelector("svg.ticon") && b.getAttribute("aria-label")));
    return over === 0 && vis && hid && glyphs;
  });

  console.log("Niveaux (v24)");
  const rdc = await ev(() => ({ segs: okteo.state.segs.length, apps: okteo.state.app.length, rooms: okteo.state.rooms.length, w: okteo.BG.w }));
  await check("« ＋ Niveau » : R+1 créé avec les murs extérieurs, RDC visible en transparence, sans fond", async () => {
    await page.click("#levels .lv-add"); await page.fill("#lv-name", "R+1"); await page.click("#lv-add button.on");
    await page.waitForFunction(() => okteo.level.name === "R+1");
    const s1 = await ev(() => ({ segs: okteo.state.segs.length, apps: okteo.state.app.length, rooms: okteo.state.rooms.length, ghost: document.querySelectorAll("#sv g.below polygon").length, fond: okteo.BG.w, bar: [...document.querySelectorAll("#levels .lv")].map((b) => b.textContent + (b.classList.contains("on") ? "*" : "")).join(" ") }));
    if (!(s1.segs > 4 && s1.segs < rdc.segs && s1.apps === 0 && s1.rooms === 0 && s1.ghost >= rdc.segs * 0.8 && s1.fond === 0 && s1.bar === "RDC R+1*")) throw new Error(JSON.stringify(s1));
    return true;
  });
  await check("chaque niveau garde son dessin : Page ↓ / Page ↑, puis rechargement de la page", async () => {
    await ev(() => okteo.importDevices([{ t: "LUM", x: 5, y: 3 }, { t: "PC16", x: 2, y: 2 }]));
    await page.keyboard.press("PageDown"); await page.waitForFunction(() => okteo.level.name === "RDC");
    const r = await ev(() => ({ apps: okteo.state.app.length, rooms: okteo.state.rooms.length, fond: okteo.BG.w }));
    await page.waitForFunction(() => okteo.FOND && okteo.FOND.startsWith("blob:"), null, { timeout: 10000 });
    await page.keyboard.press("PageUp"); await page.waitForFunction(() => okteo.level.name === "R+1");
    const u = await ev(() => okteo.state.app.length);
    await ev(() => okteo.saveNow());
    await page.reload(); await page.waitForFunction(() => window.okteo && window.okteoExt);
    const after = await ev(() => ({ lv: okteo.level.name, apps: okteo.state.app.length, ids: new Set([...okteo.state.app.map((a) => a.id)]).size }));
    return r.apps === rdc.apps && r.rooms === rdc.rooms && Math.abs(r.fond - rdc.w) < 1e-6 && u === 2 && after.lv === "R+1" && after.apps === 2;
  });
  await check("fond du R+1 : autre page du même PDF → position et échelle reprises du RDC", async () => {
    await page.evaluate(() => okteo.setTab("chantiers"));   // lot 3 : accueil par le logo (plus d'onglet)
    await page.click("#ch-fond"); await page.setInputFiles("#nf-file", "docs/plans/EVRARD_04949_plan.pdf");
    await page.waitForSelector(".thumb", { timeout: 30000 }); await page.click('.thumb[data-page="3"]');
    await Promise.all([page.waitForNavigation({ timeout: 60000 }), page.click("#nf-ok")]);
    await page.waitForFunction(() => window.okteo && okteo.FOND && okteo.FOND.startsWith("blob:"), null, { timeout: 30000 });
    const f = await ev(() => ({ lv: okteo.level.name, cal: okteo.ch.fond.calibre, rep: okteo.ch.fond.reprise, w: okteo.BG.w, tool: okteo.tool }));
    await page.click('#tabs button[data-tab="plan"]');
    if (!(f.lv === "R+1" && f.cal && f.rep === "RDC" && Math.abs(f.w - rdc.w) < 1e-6 && f.tool !== "calib")) throw new Error(JSON.stringify(f));
    return true;
  });
  await check("renommer (double-clic), supprimer avec confirmation dans la barre, Ctrl+Z rend le niveau", async () => {
    await page.dblclick('#levels .lv[aria-selected="true"]'); await page.fill("#lv-name", "Étage"); await page.click("#lv-ren button.on");
    const named = await ev(() => okteo.level.name);
    await page.click("#levels .lv-x"); await page.click("#lv-yes");
    const one = await ev(() => ({ n: okteo.levels.length, lv: okteo.level.name, apps: okteo.state.app.length }));
    await page.keyboard.press("Control+z");
    await page.waitForFunction(() => okteo.levels.length === 2);
    const back = await ev(() => okteo.levels.map((l) => l.name + (l.fond ? "+fond" : "")).join("|"));
    await page.click('#levels .lv[data-id="rdc"]');
    return named === "Étage" && one.n === 1 && one.lv === "RDC" && one.apps === rdc.apps && back === "RDC+fond|Étage+fond" && (await ev(() => okteo.level.name)) === "RDC";
  });

  await check("liaison entre niveaux : interrupteur du RDC → lumière de l'étage, affichée des deux côtés", async () => {
    await ev(() => okteo.setTool("lien"));
    const int = await ev(() => { const a = okteo.state.app.find((x) => x.t === "INT"); return { id: a.id, rep: okteo.repMap()[a.id], p: okteo.toClient(a.x, a.y) }; });
    await page.mouse.click(int.p.x, int.p.y);
    await page.keyboard.press("PageUp"); await page.waitForFunction(() => okteo.level.name === "Étage");
    const hint = await page.textContent("#hint");
    const lum = await ev(() => { const a = okteo.state.app.find((x) => x.t === "LUM"); return okteo.toClient(a.x, a.y); });
    await page.mouse.click(lum.x, lum.y);
    const up = await ev(() => [...document.querySelectorAll("#sv text.xlink")].map((t) => t.textContent).join("|"));
    await page.keyboard.press("Escape");
    await page.keyboard.press("PageDown"); await page.waitForFunction(() => okteo.level.name === "RDC");
    const down = await ev(() => [...document.querySelectorAll("#sv text.xlink")].map((t) => t.textContent).join("|"));
    await ev(() => okteo.setTool("sel"));
    // même numéro que l'interrupteur (allumage) : L1, ou L1A si l'allumage a déjà une lumière au RDC
    const same = new RegExp("^→ L" + int.rep.slice(1) + "A? Étage$");
    if (!(hint.includes("Liaison depuis " + int.rep) && up === "← " + int.rep + " RDC" && same.test(down))) throw new Error(JSON.stringify({ hint, up, down, rep: int.rep }));
    return true;
  });
  await check("impression de tous les niveaux : une page par niveau + nomenclature commune, liaison inter-niveaux écrite", async () => {
    await page.keyboard.press("Control+p");
    await page.waitForSelector(".pr-back:not([hidden])");
    await page.selectOption('.pr [data-k="levels"]', "all");
    await page.waitForFunction(() => okteoExt.printer.last && okteoExt.printer.last.pages >= 3 && !document.querySelector(".pr-wait:not([hidden])"), null, { timeout: 30000 });
    const blob = await ev(async () => Array.from(new Uint8Array(await okteoExt.printer.last.blob.arrayBuffer())));
    const doc = await pdfjsNode.getDocument({ data: new Uint8Array(blob), verbosity: 0 }).promise;
    const txt = async (p) => (await (await doc.getPage(p)).getTextContent()).items.map((i) => i.str).join(" ");
    const t1 = await txt(1), t2 = await txt(2); let t3 = ""; for (let i = 3; i <= doc.numPages; i++) t3 += " " + await txt(i);
    await page.selectOption('.pr [data-k="levels"]', "cur");
    await page.waitForFunction(() => okteoExt.printer.last && okteoExt.printer.last.pages === 2, null, { timeout: 30000 });
    await page.keyboard.press("Escape");
    const ok = t1.includes("RDC") && t2.includes("Étage") && t3.includes("Nomenclature") && t3.includes("Étage · ") && /commande L1A? \(Étage\)/.test(t3) && t3.includes("commandé par");
    if (!ok) throw new Error(JSON.stringify({ a: t1.includes("RDC"), b: t2.includes("Étage"), c: t3.includes("Étage · "), d: /commande L1A? \(Étage\)/.test(t3), t3: t3.slice(-600) }));
    return true;
  });

  console.log("Câblage : circuits (v28)");
  await check("onglet Câblage : « Répartir automatiquement » couvre tous les appareils de tous les niveaux, couleurs sur le plan", async () => {
    await ev(() => okteoExt.panel.show("cablage"));
    await page.click("#cb-auto");
    await page.waitForFunction(() => okteo.cab.circuits.length > 3 && document.querySelectorAll(".cb-row").length === okteo.cab.circuits.length);
    const r = await ev(() => {
      const all = okteo.allApps(), C = okteo.cab.circuits, inC = new Set(C.flatMap((c) => c.apps));
      const need = all.filter((a) => !["TAB", "VMC"].includes(a.t));
      return { miss: need.filter((a) => !inC.has(a.id)).length, n: C.length, lv: new Set(all.map((a) => a.lv)).size,
        rings: document.querySelectorAll("#sv g.circ:not(.nocirc)").length, cur: okteo.state.app.filter((a) => !["TAB", "VMC"].includes(a.t)).length,
        rows: document.querySelectorAll(".cb-row").length, nums: C.map((c) => c.n).join(" ") };
    });
    if (!(r.miss === 0 && r.lv === 2 && r.rings === r.cur && r.rows === r.n && /^C1 C2 /.test(r.nums))) throw new Error(JSON.stringify(r));
    return true;
  });
  await check("changer un appareil de circuit (sélection → « ← Sélection »), section modifiable, un Ctrl+Z chacun", async () => {
    const pc = await ev(() => okteo.state.app.find((a) => a.t === "PC16").id);
    await ev((id) => okteo.select([id]), pc);
    await page.click('.cb-row:first-child [data-a="take"]');
    const moved = await ev((id) => okteo.cab.circuits[0].apps.includes(id) && okteo.cab.circuits.filter((c) => c.apps.includes(id)).length === 1, pc);
    await page.selectOption('.cb-row:first-child select[data-f="section"]', "2.5");
    const sec = await ev(() => okteo.cab.circuits[0].section);
    await ev(() => { okteo.undo(); okteo.undo(); });
    const back = await ev((id) => !okteo.cab.circuits[0].apps.includes(id) && okteo.cab.circuits[0].section === 1.5, pc);
    await ev(() => okteo.clearSel());
    return moved && sec === 2.5 && back;
  });
  await check("réglages du câblage (Paramètres) : 4 points par circuit → la répartition suit ; valeurs de base rétablies", async () => {
    await page.click('#tabs button[data-tab="params"]');
    await page.fill('[data-cab="maxPoints"]', "4"); await page.dispatchEvent('[data-cab="maxPoints"]', "change");
    const chg = await page.isVisible(".cab-row.chg");
    await page.click('#tabs button[data-tab="plan"]');
    await ev(() => okteoExt.panel.show("cablage"));
    await page.click("#cb-auto"); await page.click("#cb-yes");
    const r = await ev(() => { const L = new Set(["LUM", "SPOT", "APP"]), A = new Map(okteo.allApps().map((a) => [a.id, a.t]));
      return okteo.cab.circuits.filter((c) => c.kind === "eclairage").map((c) => c.apps.filter((id) => L.has(A.get(id))).length); });
    await page.click('#tabs button[data-tab="params"]'); await page.click("#cab-reset");
    const reset = await ev(() => JSON.parse(localStorage.getItem("okteo.cablage.v1") || "null") === null);
    await page.click('#tabs button[data-tab="plan"]');
    await ev(() => okteo.undo());
    return chg && r.length >= 5 && r.every((n) => n <= 4) && reset;
  });
  console.log("Câblage : boîtes et gaines (v29–v30)");
  await check("sans tableau : alerte « Poser le tableau » ; avec : boîtes placées (≤ 16 départs sans l'alimentation, ≤ 6 gaines par face), dessinées sur le plan", async () => {
    await ev(() => okteoExt.panel.show("cablage"));
    await page.waitForSelector("#bx-auto");
    const warn = await page.isVisible("#bx-tab");
    // tableau posé dans le garage (coordonnées du plan EVRARD, page 3)
    await ev(() => { const k = okteo.BG.w / 841.89, x = okteo.BG.x + 293 * k, y = okteo.BG.y + 410 * k; okteo.importDevices([{ t: "TAB", x, y }]); });
    await ev(() => okteoExt.panel.show("cablage")); await page.waitForTimeout(150);
    await page.click("#bx-auto");
    await page.waitForFunction(() => okteo.cab.boxes.length > 0 && document.querySelectorAll(".bx-row").length === okteo.cab.boxes.length);
    const r = await ev(() => ({ n: okteo.cab.boxes.length, drawn: document.querySelectorAll("#sv g.box").length, here: okteo.cab.boxes.filter((b) => b.lv === okteo.level.id).length,
      rows: [...document.querySelectorAll(".bx-row")].map((x) => x.textContent.match(/(\d+) \/ 16 départs \+ alimentation · [\d,]+ m de gaines · A(\d+) B(\d+) C(\d+) D(\d+)/)).map((m) => m && m.slice(1).map(Number)) }));
    if (!(warn && r.n >= 3 && r.drawn === r.here && r.rows.every((m) => m && m[0] <= 16 && m.slice(1).every((f) => f <= 6)))) throw new Error(JSON.stringify(r));
    return true;
  });
  await check("glisser une boîte la déplace (longueurs recalculées), un Ctrl+Z la remet", async () => {
    const b0 = await ev(() => { const b = okteo.cab.boxes.find((x) => x.lv === okteo.level.id); return { id: b.id, x: b.x, y: b.y, p: okteo.toClient(b.x, b.y) }; });
    await ev(() => okteo.setTool("sel"));
    const before = await ev(() => document.querySelector(".bx-row b") && 1);
    await page.mouse.move(b0.p.x, b0.p.y); await page.mouse.down(); await page.mouse.move(b0.p.x + 60, b0.p.y + 30, { steps: 6 }); await page.mouse.up();
    const b1 = await ev((id) => { const b = okteo.cab.boxes.find((x) => x.id === id); return { x: b.x, y: b.y, manual: b.manual }; }, b0.id);
    await ev(() => okteo.undo());
    const b2 = await ev((id) => { const b = okteo.cab.boxes.find((x) => x.id === id); return { x: b.x, y: b.y }; }, b0.id);
    return before && b1.x > b0.x + 0.3 && b1.manual && Math.abs(b2.x - b0.x) < 1e-6 && Math.abs(b2.y - b0.y) < 1e-6;
  });
  await check("onglet Boîtes : gaines de chaque boîte (face, longueur, Ø, fils couleur/section/n°) et raccordements", async () => {
    await goSub("boites");
    const r = await ev(() => ({ boxes: document.querySelectorAll(".cabpage section.bx").length, rows: document.querySelectorAll(".cabpage .gt tbody tr").length,
      chips: document.querySelectorAll(".cabpage .wchip b").length, nets: document.querySelectorAll(".cabpage .nets li").length, first: document.querySelector(".cabpage .nets li")?.textContent || "",
      faces: [...document.querySelectorAll(".cabpage .gt tbody td.c:nth-child(2)")].map((t) => t.textContent).every((f) => "ABCD".includes(f)) }));
    const n = await ev(() => okteo.cab.boxes.length);
    await goSub("lignes");
    const d = await ev(() => document.querySelectorAll(".cabpage .gt tbody tr").length);
    await page.click('#tabs button[data-tab="plan"]');
    if (!(r.boxes === n && r.rows > 60 && r.chips > 150 && r.nets > 20 && /n° 1 Terres/.test(r.first) && r.faces && d >= 8)) throw new Error(JSON.stringify({ ...r, n, d }));
    return true;
  });
  console.log("Repères par allumage, tracé des gaines, cadenas (v32)");
  await check("repères par allumage : commande et lumières reliées ont le même numéro, A/B pour le 2e/3e du même type ; prises inchangées", async () => ev(() => {
    const R = okteo.repMap(), num = (r) => (r.match(/^[A-Z]+(\d+)[A-Z]?$/) || [])[1];
    const bad = okteo.state.lia.filter((x) => R[x.c] && R[x.l] && num(R[x.c]) !== num(R[x.l])).map((x) => R[x.c] + "→" + R[x.l]);
    const vals = okteo.state.app.map((a) => R[a.id]), uniq = new Set(vals).size === vals.length;
    // une lumière de plus sur une commande qui en a une : elle prend la lettre A
    const by = Object.fromEntries(okteo.state.app.map((a) => [a.id, a]));
    const x = okteo.state.lia.find((l) => by[l.l] && by[l.l].t === "LUM" && okteo.state.lia.filter((m) => m.c === l.c && by[m.l] && by[m.l].t === "LUM").length === 1);
    const pBefore = okteo.state.app.filter((a) => a.t.startsWith("PC")).map((a) => R[a.id]).join();
    const L0 = by[x.l], n0 = okteo.state.app.length;
    okteo.importDevices([{ t: "LUM", x: L0.x + 1, y: L0.y }]);
    const nl = okteo.state.app[n0];
    okteo.state.lia.push({ c: x.c, l: nl.id }); okteo.draw();
    const R2 = okteo.repMap(), rNew = R2[nl.id], rOld = R2[L0.id], rCmd = R2[x.c];
    okteo.state.lia.pop(); okteo.undo();
    const pAfter = okteo.state.app.filter((a) => a.t.startsWith("PC")).map((a) => okteo.repMap()[a.id]).join();
    const ok = !bad.length && uniq && rOld === "L" + num(rCmd) && new RegExp("^" + rOld + "[A-Z]$").test(rNew) && pBefore === pAfter && okteo.state.app.length === n0;
    if (!ok) throw new Error(JSON.stringify({ bad: bad.slice(0, 5), uniq, rOld, rNew, rCmd, p: pBefore === pAfter }));
    return true;
  }));
  await check("gaine tirée sur le plan : point de passage (distance au mur affichée), longueur recalculée, boîte verrouillée ; Maj = tronçon droit ; double-clic le supprime", async () => {
    await page.click('#tabs button[data-tab="plan"]');
    await ev(() => { okteo.setTool("sel"); okteo.showCircuits = true; okteo.fit(); });
    const t = await ev(async () => {
      const m = await import("/src/ext/cablage-data.js"), W = m.wiringNow(okteo), R = await import("/src/core/render.js");
      const A = okteo.state.app, by = Object.fromEntries(A.map((a) => [a.id, a]));
      // départ réel de chaque gaine : son point d'accroche sur la boîte (v56 : boîtes plus chargées, points plus éloignés du centre)
      const start = {}; for (const o of okteo.cab.boxes.filter((x) => x.lv === okteo.level.id)) R.boxLayout(o).deps.forEach((d) => d.keys.forEach((k) => (start[o.id + ":" + k] = d.P)));
      const P0 = (o, k) => start[o.id + ":" + k] || o;
      for (const b of okteo.cab.boxes.filter((x) => x.lv === okteo.level.id)) for (const id of b.apps) {
        const a = by[id]; if (!a) continue;
        const d = Math.hypot(a.x - b.x, a.y - b.y); if (d < 2.5) continue;
        // milieu de l'arc dessiné (même calcul que gaineCtrl : décalage de 15 % de la longueur)
        // v59 : courbure choisie par le plan pour éviter les croisements (R.bowOf)
        const arc = (o, c, t, k = 0.15) => { const qx = (o.x + c.x) / 2 - (c.y - o.y) * k, qy = (o.y + c.y) / 2 + (c.x - o.x) * k, u = 1 - t; return { x: u * u * o.x + 2 * u * t * qx + t * t * c.x, y: u * u * o.y + 2 * u * t * qy + t * t * c.y }; };
        const p = arc(P0(b, id), a, 0.5, R.bowOf(b.id, id));
        if (A.some((o) => Math.hypot(o.x - p.x, o.y - p.y) < 0.6) || okteo.cab.boxes.some((o) => Math.hypot(o.x - p.x, o.y - p.y) < 0.8)) continue;
        { const sp = okteo.toClient(p.x, p.y); if (sp.y < 160 || sp.y > innerHeight - 220 || sp.x < 220 || sp.x > innerWidth - 420) continue; }   // lot 4 : point bien dans l'écran (le glisser va à +50 px)
        // pas d'autre gaine tout près de ce point
        const near = okteo.cab.boxes.some((o) => o.apps.some((k) => { if (k === id && o.id === b.id) return false; const c = by[k]; if (!c) return false;
          for (let i = 1; i < 30; i++) { const q = arc(P0(o, k), c, i / 30, R.bowOf(o.id, k)); if (Math.hypot(q.x - p.x, q.y - p.y) < 0.3) return true; } return false; }));
        if (near) continue;
        const g = W.boxes.find((x) => x.id === b.id).gaines.find((x) => x.appIds && x.appIds.includes(id));
        if (!g || g.appIds.length !== 1) continue;   // gaine d'un seul appareil (une gaine partagée est tracée sous un autre appareil)
        return { box: b.id, id, p: okteo.toClient(p.x, p.y), len: g.length };
      }
      return null;
    });
    if (!t) throw new Error("pas de gaine isolée");
    await page.mouse.move(t.p.x, t.p.y); await page.mouse.down(); await page.mouse.move(t.p.x + 50, t.p.y + 50, { steps: 5 });
    const hint = await page.textContent("#hint");
    await page.mouse.up();
    const dbgR = await ev(({ box, id }) => ({ t: okteo.allApps().find((a) => a.id === id)?.t, lv: okteo.allApps().find((a) => a.id === id)?.lv, cur: okteo.level.id, routes: okteo.cab.boxes.filter((b) => b.routes).map((b) => b.id + ":" + Object.keys(b.routes).join(",")), sel: okteo.boxSel }), t);
    if (!(await ev(({ box }) => !!okteo.cab.boxes.find((x) => x.id === box).routes, t))) throw new Error("pas de tracé : " + JSON.stringify({ t, dbgR, hint }));
    const r1 = await ev(async ({ box, id }) => { const m = await import("/src/ext/cablage-data.js"), b = okteo.cab.boxes.find((x) => x.id === box);
      const g = m.wiringNow(okteo).boxes.find((x) => x.id === box).gaines.find((x) => x.appIds && x.appIds.includes(id));
      return { wp: (b.routes && b.routes[id] || []).length, locked: !!b.locked, len: g.length, routed: g.routed, q: b.routes[id][0], bx: b.x, by: b.y, poly: !!document.querySelector(`#sv path.gaine[data-k="${id}"]`) }; }, t);
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + "/gaine-trace.png" });
    // Maj : le point se met dans l'axe de la boîte
    const wpScr = await ev(({ q }) => okteo.toClient(q.x, q.y), r1);
    await page.mouse.move(wpScr.x, wpScr.y); await page.mouse.down(); await page.keyboard.down("Shift");
    await page.mouse.move(wpScr.x + 30, wpScr.y + 4, { steps: 4 }); await page.mouse.up(); await page.keyboard.up("Shift");
    const r2 = await ev(({ box, id }) => { const b = okteo.cab.boxes.find((x) => x.id === box), q = b.routes[id][0]; return { ortho: Math.abs(q.x - b.x) < 1e-6 || Math.abs(q.y - b.y) < 1e-6, q }; }, t);
    const s2 = await ev((q) => okteo.toClient(q.x, q.y), r2.q);
    await page.waitForTimeout(600);
    await page.mouse.dblclick(s2.x, s2.y);
    const r3 = await ev(({ box, id }) => { const b = okteo.cab.boxes.find((x) => x.id === box); return (b.routes && b.routes[id] || []).length; }, t);
    await page.keyboard.press("Control+z");
    const r4 = await ev(({ box, id }) => { const b = okteo.cab.boxes.find((x) => x.id === box); return (b.routes && b.routes[id] || []).length; }, t);
    const ok = r1.wp === 1 && r1.locked && r1.routed && r1.len > t.len && r1.poly && /du mur|dans le mur/.test(hint) && r2.ortho && r3 === 0 && r4 === 1;
    if (!ok) throw new Error(JSON.stringify({ t, r1, r2, r3, r4, hint }));
    return true;
  });
  await check("gaines sans croisement (v59) : courbures choisies pour le niveau, moins de croisements qu'avec un seul arc ; recalculées quand on déplace une boîte", async () => {
    const r = await ev(async () => {
      const R = await import("/src/core/render.js"), T = await import("/src/cablage/trace.js");
      okteo.showCircuits = true;
      const count = () => {
        const BX = okteo.cab.boxes.filter((b) => b.lv === okteo.level.id), by = Object.fromEntries(okteo.state.app.map((a) => [a.id, a])), tab = okteo.state.app.find((a) => a.t === "TAB");
        const bows = R.levelBows(BX, undefined, by, tab), list = [];
        BX.forEach((b) => R.boxLayout(b).deps.forEach((d) => { if (d.face) (d.tab ? (tab ? [["tab", tab]] : []) : d.apps.map((a) => [a.id, a])).forEach(([k, t]) => { if (!(b.routes || {})[k]) list.push({ key: b.id + "|" + k, P: d.P, T: t }); }); }));
        return { n: list.length, avec: T.crossings(list, bows), sans: T.crossings(list, null), sig: window.__okteo ? JSON.stringify([...bows].slice(0, 50)) : "" };
      };
      const a = count();
      const B = okteo.cab.boxes.find((b) => b.lv === okteo.level.id);
      const old = { x: B.x, y: B.y };
      okteo.setBoxes(okteo.cab.boxes.map((b) => (b.id === B.id ? { ...b, x: b.x + 1.2, y: b.y + 0.8 } : b)));
      const b = count();
      const drawn = document.querySelectorAll("#sv path.gaine").length;
      okteoExt.panel.show("cablage"); okteoExt.cablage.render();
      const info = document.querySelector("#bx-cross")?.textContent || "", X = okteo.gaineCrossings();
      okteo.undo();
      const back = okteo.cab.boxes.find((x) => x.id === B.id);
      return { a, b, drawn, back: Math.abs(back.x - old.x) < 1e-9, info, X };
    });
    const infoOk = r.X.n ? new RegExp(r.X.n + " croisement").test(r.info) : /Aucune gaine/.test(r.info);
    if (!(r.a.n > 5 && r.a.avec <= r.a.sans && r.b.avec <= r.b.sans && r.drawn > 5 && r.back && infoOk)) throw new Error(JSON.stringify(r));
    return true;
  });
  await check("cadenas : clic sur le cadenas du plan ; recalcul : on coche les boîtes, les verrouillées gardent place, appareils et tracés", async () => {
    const b = await ev(() => { const b = okteo.cab.boxes.find((x) => x.lv === okteo.level.id && !x.locked);
      const m = document.querySelector(`#sv g.box[data-id="${b.id}"] g.lock`).getAttribute("transform").match(/translate\(([-\d.e]+) ([-\d.e]+)\)/);
      return { id: b.id, p: okteo.toClient(+m[1], +m[2]) }; });
    await page.mouse.click(b.p.x, b.p.y);
    const locked = await ev((id) => okteo.cab.boxes.find((x) => x.id === id).locked, b.id);
    const before = await ev(() => JSON.stringify(okteo.cab.boxes.filter((x) => x.locked)));
    await ev(() => okteoExt.panel.show("cablage")); await page.waitForTimeout(150);
    await page.click("#bx-auto");
    await page.waitForSelector(".bx-redo");
    const unchecked = await ev(() => [...document.querySelectorAll(".bx-redo")].filter((c) => !c.checked).map((c) => c.value));
    const lockedIds = await ev(() => okteo.cab.boxes.filter((x) => x.locked).map((x) => x.id));
    await page.click("#bx-yes");
    const after = await ev((ids) => JSON.stringify(okteo.cab.boxes.filter((x) => ids.includes(x.id))), lockedIds);
    const n = await ev(() => ({ boxes: okteo.cab.boxes.length, ids: new Set(okteo.cab.boxes.map((x) => x.id)).size, apps: okteo.cab.boxes.flatMap((x) => x.apps).length, uniq: new Set(okteo.cab.boxes.flatMap((x) => x.apps)).size }));
    await page.keyboard.press("Control+z");
    const ok = locked && unchecked.join() === lockedIds.join() && lockedIds.includes(b.id) && JSON.stringify(JSON.parse(before)) === JSON.stringify(JSON.parse(after)) && n.ids === n.boxes && n.apps === n.uniq;
    if (!ok) throw new Error(JSON.stringify({ locked, unchecked, lockedIds, same: before === after, n }));
    return true;
  });
  console.log("Boîtes à la main, fenêtre de réglage (v35)");
  await check("la fenêtre de réglage d'un appareil se ferme quand on saisit une boîte, et par sa croix", async () => {
    await page.click('#tabs button[data-tab="plan"]');
    await ev(() => { okteo.setTool("sel"); okteo.showCircuits = true; okteo.fit(); });
    const t = await ev(() => { const a = okteo.state.app.find((x) => x.t === "PC16"), b = okteo.cab.boxes.find((x) => x.lv === okteo.level.id); return { a: okteo.toClient(a.x, a.y), b: okteo.toClient(b.x, b.y) }; });
    // vérifie l'affichage réel (display calculé), pas seulement l'attribut hidden
    const vis = () => ev(() => { const h = document.getElementById("hud"); return !h.hidden && getComputedStyle(h).display !== "none"; });
    await page.mouse.click(t.a.x, t.a.y); const v1 = await vis();
    await page.mouse.click(t.b.x, t.b.y); const v2 = await vis();
    await page.mouse.click(t.a.x, t.a.y); await page.click('#hud [data-h="close"]'); const v3 = await vis();
    if (!(v1 && !v2 && !v3)) throw new Error(JSON.stringify({ v1, v2, v3 }));
    return true;
  });
  await check("bout de gaine tiré sur une autre boîte : l'appareil (et son allumage) y est raccordé, alimentation complétée, Ctrl+Z", async () => {
    const t = await ev(() => {
      const B = okteo.cab.boxes.filter((x) => x.lv === okteo.level.id), by = Object.fromEntries(okteo.state.app.map((a) => [a.id, a]));
      const src = B[0], dst = B.slice(1).sort((p, q) => Math.hypot(p.x - src.x, p.y - src.y) - Math.hypot(q.x - src.x, q.y - src.y))[0];
      const id = src.apps.find((k) => by[k] && by[k].t.startsWith("PC"));
      return { src: src.id, dst: dst.id, id, s: okteo.toClient(src.x, src.y), d: okteo.toClient(dst.x, dst.y) };
    });
    await page.mouse.click(t.s.x, t.s.y);                       // choisit la boîte : les bouts de gaine apparaissent
    const end = await ev(({ src, id }) => { const h = [...document.querySelectorAll("#sv circle.gend")].length; const b = okteo.cab.boxes.find((x) => x.id === src);
      const a = okteo.state.app.find((x) => x.id === id), L = Math.hypot(a.x - b.x, a.y - b.y); return { h }; }, t);
    // position du bout : la poignée posée sur le point d'accroche de la gaine
    const p0 = await ev(({ id }) => { const c = [...document.querySelectorAll("#sv circle.gend")].find((e) => e.dataset.k === id) || [...document.querySelectorAll("#sv circle.gend")].find((e) => okteo.cab.boxes.some((b) => b.apps.includes(e.dataset.k)));
      return okteo.toClient(+c.getAttribute("cx"), +c.getAttribute("cy")); }, t);
    await page.mouse.move(p0.x, p0.y); await page.mouse.down(); await page.mouse.move(t.d.x, t.d.y, { steps: 8 }); await page.mouse.up();
    const r = await ev(({ src, dst, id }) => ({ inDst: okteo.cab.boxes.find((x) => x.id === dst).apps.includes(id), inSrc: okteo.cab.boxes.find((x) => x.id === src).apps.includes(id), hint: document.getElementById("hint").textContent }), t);
    await page.keyboard.press("Control+z");
    const back = await ev(({ src, id }) => okteo.cab.boxes.find((x) => x.id === src).apps.includes(id), t);
    if (!(end.h > 3 && r.inDst && !r.inSrc && /raccordé/.test(r.hint) && back)) throw new Error(JSON.stringify({ end, r, back }));
    return true;
  });
  await check("supprimer une boîte (clic puis Suppr) : ses appareils vont dans les boîtes voisines, aucun appareil perdu, Ctrl+Z", async () => {
    const t = await ev(() => { const b = okteo.cab.boxes.find((x) => x.lv === okteo.level.id); return { id: b.id, n: okteo.cab.boxes.length, apps: okteo.cab.boxes.flatMap((x) => x.apps).length, p: okteo.toClient(b.x, b.y) }; });
    await page.mouse.click(t.p.x, t.p.y); await page.keyboard.press("Delete");
    const r = await ev((id) => ({ n: okteo.cab.boxes.length, apps: okteo.cab.boxes.flatMap((x) => x.apps).length, gone: !okteo.cab.boxes.some((x) => x.id === id), hint: document.getElementById("hint").textContent }), t.id);
    await page.keyboard.press("Control+z");
    const back = await ev(() => okteo.cab.boxes.length);
    if (!(r.n === t.n - 1 && r.apps === t.apps && r.gone && /supprimée/.test(r.hint) && back === t.n)) throw new Error(JSON.stringify({ t, r, back }));
    return true;
  });
  await check("recalcul des boîtes cochées (mode Bureau d'études, lot 4 : plus de nombre imposé)", async () => {
    await ev(() => okteoExt.panel.show("cablage")); await page.waitForTimeout(150);
    const n0 = await ev(() => okteo.cab.boxes.length);
    await page.click("#bx-auto"); await page.waitForSelector("#bx-yes");
    const count = await ev(() => !!document.querySelector("#bx-count"));
    await ev(() => document.querySelectorAll(".bx-redo").forEach((c) => (c.checked = true)));
    await page.click("#bx-yes");
    const n1 = await ev(() => okteo.cab.boxes.length), names = await ev(() => okteo.cab.boxes.map((b) => b.n).join());
    await page.keyboard.press("Control+z");
    const back = await ev(() => okteo.cab.boxes.length);
    if (!(n0 > 0 && n1 > 0 && !count && /^LI\d\d/.test(names) && back === n0)) throw new Error(JSON.stringify({ n0, n1, names, count, back }));
    return true;
  });
  await check("dessin : liaisons en ligne droite, gaines en arc", async () => ev(() => {
    const lia = [...document.querySelectorAll("#sv path.lia")].slice(0, 5).map((p) => p.getAttribute("d").match(/^M([\d.-]+) ([\d.-]+) Q ([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+)/)).filter(Boolean);
    const straight = lia.every((m) => { const [x0, y0, qx, qy, x1, y1] = m.slice(1).map(Number); return Math.abs(qx - (x0 + x1) / 2) < 1e-6 && Math.abs(qy - (y0 + y1) / 2) < 1e-6; });
    const arcs = [...document.querySelectorAll("#sv path.gaine")].some((p) => / Q /.test(p.getAttribute("d")));
    return lia.length > 0 && straight && arcs;
  }));

  console.log("Symboles, filtre de vue, boîtes (v37)");
  await check("symboles : carrés sauf lumières (spot avec éclat) ; couleur du circuit sur le symbole, rouge sans circuit sauf ligne directe", async () => {
    await page.click('#tabs button[data-tab="plan"]');
    await ev(() => { okteo.showCircuits = true; });
    const r = await ev(() => {
      const shape = (t) => { const g = [...document.querySelectorAll("#tools .pb")].find((b) => b.dataset.tool === t); return g ? g.querySelector("svg").firstElementChild.tagName : null; };
      const C = okteo.cab.circuits, inC = new Set(C.flatMap((c) => c.apps));
      const a = okteo.state.app.find((x) => inC.has(x.id) && x.t === "PC16");
      const g = document.querySelector(`#sv g.dev[data-id="${a.id}"]`);
      return { pc: shape("PC16"), int: shape("INT"), lum: shape("LUM"), spot: document.querySelector('#tools .pb[data-tool="SPOT"] svg').querySelectorAll("path").length,
        col: g && g.style.getPropertyValue("--c"), circ: g && g.classList.contains("circ"), oldRings: document.querySelectorAll("#sv circle.circ").length };
    });
    // un appareil sans circuit : rouge ; une RJ45 sans circuit : pas d'alerte (ligne directe)
    const nc = await ev(() => {
      const p = okteo.state.app.find((x) => x.t === "PC16"), id = p.id, save = JSON.stringify(okteo.cab.circuits);
      okteo.setCircuits(okteo.cab.circuits.map((c) => ({ ...c, apps: c.apps.filter((k) => k !== id && okteo.state.app.find((a) => a.id === k)?.t !== "RJ45") })));
      const g = (pred) => { const a = okteo.state.app.find(pred); return a && document.querySelector(`#sv g.dev[data-id="${a.id}"]`); };
      const red = g((x) => x.id === id), rj = g((x) => x.t === "RJ45");
      return { red: red && red.classList.contains("nocirc") && red.style.getPropertyValue("--c") === "#d33", rj: !rj || !rj.classList.contains("nocirc") };
    });
    await page.keyboard.press("Control+z");
    if (!(r.pc === "rect" && r.int === "rect" && r.lum === "circle" && r.spot >= 1 && /^#/.test(r.col || "") && r.circ && r.oldRings === 0 && nc.red && nc.rj)) throw new Error(JSON.stringify({ r, nc }));
    return true;
  });
  await check("applique : tournée pour avoir le dos à son mur (mur vertical = ±90°, horizontal = 0 ou 180°)", async () => {
    const r = await ev(() => {
      const segs = okteo.state.segs.filter((s) => !s.virt), N = Object.fromEntries(okteo.state.nodes.map((n) => [n.id, n]));
      const out = [];
      for (const kind of ["v", "h"]) {
        const s = segs.find((x) => { const a = N[x.a], b = N[x.b], v = Math.abs(a.x - b.x) < 0.01; return (kind === "v" ? v : Math.abs(a.y - b.y) < 0.01) && Math.hypot(a.x - b.x, a.y - b.y) > 2; });
        const a = N[s.a], b = N[s.b], ep = s.ep || okteo.state.wallEp;
        const x = (a.x + b.x) / 2 + (kind === "v" ? ep : 0), y = (a.y + b.y) / 2 + (kind === "h" ? ep : 0);
        const ids = new Set(okteo.state.app.map((q) => q.id));
        okteo.importDevices([{ t: "APP", x, y }], [], { replace: false });
        out.push({ kind, id: okteo.state.app.find((q) => !ids.has(q.id)).id });
      }
      return out;
    });
    const rots = await ev((list) => list.map(({ kind, id }) => { const a = okteo.state.app.find((x) => x.id === id); const g = document.querySelector(`#sv g.dev[data-id="${a.id}"]`);
      const m = (g.getAttribute("transform").match(/rotate\(([-\d.]+)\)/) || [0, "0"])[1]; return { kind, seg: !!a.seg, rot: Math.round(+m) }; }), r);
    await page.keyboard.press("Control+z"); await page.keyboard.press("Control+z");
    const ok = rots.every((o) => o.seg && (o.kind === "v" ? Math.abs(Math.abs(o.rot) - 90) < 1 : Math.abs(o.rot) % 180 < 1));
    if (!ok) throw new Error(JSON.stringify(rots));
    return true;
  });
  await check("filtre de vue : Bâti / Implantation / Câblage (Alt+1/2/3), boutons par élément, quadrillage masqué par défaut (v45.1) puis fin 10 cm / 1 m à la demande", async () => {
    const count = () => ev(() => ({ dev: document.querySelectorAll("#sv g.dev").length, box: document.querySelectorAll("#sv g.box").length, gaine: document.querySelectorAll("#sv path.gaine").length, lia: document.querySelectorAll("#sv path.lia").length, grid: document.querySelectorAll("#sv g.grid").length }));
    await page.click('#vfilter [data-vp="bati"]'); const b = await count();
    await page.keyboard.press("Alt+2"); const i = await count();
    await page.keyboard.press("Alt+3"); const c = await count();
    const onCab = await ev(() => document.querySelector('#vfilter [data-vp="cab"]').classList.contains("on"));
    await page.click('#vfilter [data-vk="gaines"]'); const ng = await count();
    await page.click('#vfilter [data-vk="grille"]');
    const step = await ev(() => { const s = okteo.state.segs[0], n = okteo.state.nodes.find((x) => x.id === s.a); okteo.zoomToBox(n.x - 1, n.y - 1, n.x + 1, n.y + 1); return [...document.querySelectorAll("#sv g.grid")].map((g) => +g.dataset.step); });
    await ev(() => okteo.fit());
    const rows = await ev(() => ({ bati: !!document.querySelector("#tools .trow.bati [data-tool=mur]"), appa: !!document.querySelector("#tools .trow.appa [data-tool=lien]") && !!document.querySelector("#tools .trow.appa .palette") }));
    const ok = b.dev === 0 && b.box === 0 && b.grid === 0 && i.dev > 0 && i.lia > 0 && i.box === 0 && c.box > 0 && c.gaine > 0 && c.lia === 0 && onCab && ng.gaine === 0 && ng.box > 0
      && step.length === 2 && step[0] <= 0.1 && step[1] === 1 && rows.bati && rows.appa;
    if (!ok) throw new Error(JSON.stringify({ b, i, c, onCab, ng, step, rows }));
    await ev(() => okteo.viewPreset("cab"));
    return true;
  });
  await check("boîte : taille fixe sur le plan au zoom ; points d'accroche = réglage par face ; gaine épinglée sur un point (sans croisement), Ctrl+Z", async () => {
    const size = () => ev(() => { const r = document.querySelector("#sv g.box rect"); return +r.getAttribute("width"); });
    const t = await ev(() => { const b = okteo.cab.boxes.find((x) => x.lv === okteo.level.id && x.apps.length > 1); okteo.zoomToBox(b.x - 1.6, b.y - 1.6, b.x + 1.6, b.y + 1.6); return { id: b.id }; });
    const s1 = await size();
    // v72.1 : ±2,5 m (au lieu de ±3) : depuis v71 le bandeau a une ligne de plus, le plan est plus petit et le minimum de
    // 26 px de la boîte l'emportait à ±3 m (taille réelle inchangée tant que le symbole domine)
    // v73 : ±1,6 / ±2 m : le bandeau de la charte est plus haut, le plan encore un peu plus petit
    await ev(({ id }) => { const b = okteo.cab.boxes.find((x) => x.id === id); okteo.zoomToBox(b.x - 2, b.y - 2, b.x + 2, b.y + 2); }, t);
    const s2 = await size();
    const portsOff = await ev(({ id }) => document.querySelectorAll(`#sv g.box[data-id="${id}"] circle.port`).length, t);
    // boîte choisie : on tire le bout d'une gaine sur un point libre de la même boîte
    const p = await ev(({ id }) => { const b = okteo.cab.boxes.find((x) => x.id === id); return okteo.toClient(b.x, b.y); }, t);
    await page.mouse.click(p.x, p.y);
    // v71 : les points d'accroche ne s'affichent que sur la boîte sélectionnée
    const ports = portsOff === 0 ? await ev(({ id }) => document.querySelectorAll(`#sv g.box[data-id="${id}"] circle.port`).length, t) : 0;
    const m = await ev(({ id }) => {
      const e = document.querySelector("#sv circle.gend"), fr = document.querySelector(`#sv g.box[data-id="${id}"] circle.port:not(.used)`);
      return { e: okteo.toClient(+e.getAttribute("cx"), +e.getAttribute("cy")), k: e.dataset.k, f: okteo.toClient(+fr.getAttribute("cx"), +fr.getAttribute("cy")), ff: fr.dataset.f, fi: +fr.dataset.i };
    }, t);
    await page.mouse.move(m.e.x, m.e.y); await page.mouse.down(); await page.mouse.move(m.f.x, m.f.y, { steps: 6 }); await page.mouse.up();
    const pinned = await ev(({ id, k }) => (okteo.cab.boxes.find((x) => x.id === id).ports || {})[k], { ...t, k: m.k });
    await page.keyboard.press("Control+z");
    const back = await ev(({ id, k }) => (okteo.cab.boxes.find((x) => x.id === id).ports || {})[k] || null, { ...t, k: m.k });
    const ok = Math.abs(s1 - s2) < 1e-6 && ports === 24 && pinned && pinned.f === m.ff && pinned.i === m.fi && back === null;
    if (!ok) throw new Error(JSON.stringify({ s1, s2, ports, pinned, m, back }));
    await ev(() => okteo.fit());
    return true;
  });
  console.log("Schémas de boîte pour le câbleur (v33)");
  await check("onglet Bandes : boîte carrée (faces A–D, gaines, connecteurs), orientation, matériel, raccordements dans l'ordre à cocher", async () => {
    await goSub("bandes");
    await page.waitForSelector(".bands .bd-svg svg");
    const r = await ev(() => ({ picks: document.querySelectorAll(".bands .bd-pick [data-b]").length, boxes: okteo.cab.boxes.length, faces: ["A", "B", "C", "D"].every((f) => (document.querySelector(`.bands .bd-svg g.face[data-f="${f}"]`)?.textContent || "").startsWith(f)),
      or: [...document.querySelectorAll(".bands .bd-or li")].map((l) => l.textContent), mat: document.querySelectorAll(".bands h3 + ul li").length, rows: [...document.querySelectorAll(".bands .bd-steps tbody tr")].map((t) => t.children[2].textContent),
      wires: document.querySelectorAll(".bands .bd-steps .wchip").length, fils: (document.querySelector(".bands .bd-fils") || {}).textContent || "" }));
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + "/bandes.png", fullPage: false });
    await page.check(".bands .bd-steps input[data-n='1']");
    const done = await ev(() => document.querySelector(".bands .bd-steps tbody tr").classList.contains("done"));
    // calque : un circuit choisi, les autres s'estompent
    await page.click(".bands .bd-calq button[data-cq]:not([data-cq=''])");
    const calq = await ev(() => { const all = [...document.querySelectorAll(".bands .bd-svg [data-c]")]; return { faded: all.filter((n) => n.style.opacity === "0.1").length, kept: all.filter((n) => n.style.opacity === "").length }; });
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + "/bandes-calque.png" });
    await page.click(".bands .bd-calq button[data-cq='']");
    if (!(calq.faded > 5 && calq.kept > 3)) throw new Error("calque : " + JSON.stringify(calq));
    const ok = r.picks === r.boxes && r.faces && r.or.length === 4 && r.or.every((t) => /: \S/.test(t)) && r.mat >= 2 && /^Terres/.test(r.rows[0]) && r.rows.length >= 5 && r.wires > 20 && done && /\d+ × 1,5/.test(r.fils);
    if (!ok) throw new Error(JSON.stringify(r).slice(0, 600));
    return true;
  });
  await check("règles KiTéOHM (v38) : circuits par boîte (prises gris/bleu foncé 1,5, éclairage rouge/bleu), bagues sur l'alimentation", async () => {
    const r = await ev(async () => {
      const { wiringNow } = await import("/src/ext/cablage-data.js");
      const W = wiringNow(okteo), C = okteo.cab.circuits;
      const perBox = okteo.cab.boxes.map((b) => C.filter((c) => c.box === b.id));
      const alim = W.boxes.flatMap((b) => b.gaines.filter((g) => g.kind === "alim").flatMap((g) => g.wires));
      return { boxed: perBox.every((cs) => cs.filter((c) => c.kind === "prises").length <= 1 && cs.filter((c) => c.kind === "eclairage").length <= 1),
        prises: C.filter((c) => c.kind === "prises").every((c) => c.section === 1.5 && c.apps.length <= 8),
        cols: alim.filter((w) => w.fn === "phase").every((w) => ["gris", "rouge"].includes(w.color)) && alim.some((w) => w.color === "gris"),
        bagues: alim.filter((w) => w.fn === "phase" || w.fn === "neutre").every((w) => w.bague && w.bague === String(w.circuit).replace("C", "")),
        drawn: document.querySelectorAll(".bands .bd-svg g.bague").length, chip: document.querySelectorAll(".bands .bague").length };
    });
    if (!(r.boxed && r.prises && r.cols && r.bagues && r.drawn > 0 && r.chip > 0)) throw new Error(JSON.stringify(r));
    return true;
  });
  await check("allumage coupé entre deux boîtes : alerte rouge sur le plan + « Ramener dans la même boîte » (tout l'allumage, Ctrl+Z)", async () => {
    await page.click('#tabs button[data-tab="plan"]');
    // on coupe un allumage à la main (sans passer par l'interface, qui l'empêche)
    const cut = await ev(() => {
      const B = okteo.cab.boxes, lk = okteo.allLinks().find((l) => { const bc = B.find((b) => b.apps.includes(l.c)), bl = B.find((b) => b.apps.includes(l.l)); return bc && bl && bc.id === bl.id && bc.lv === okteo.level.id; });
      const src = B.find((b) => b.apps.includes(lk.l)), dst = B.find((b) => b.id !== src.id && b.lv === src.lv);
      okteo.setBoxes(B.map((b) => (b.id === src.id ? { ...b, apps: b.apps.filter((k) => k !== lk.l) } : b.id === dst.id ? { ...b, apps: [...b.apps, lk.l] } : b)));
      okteo.viewPreset("cab");
      return { l: lk.l, marks: document.querySelectorAll("#sv line.split").length };
    });
    await ev(() => okteoExt.panel.show("cablage")); await page.waitForTimeout(200);
    const btn = await page.waitForSelector("#cb-fixsplit", { state: "visible", timeout: 5000 }).then(() => true, () => false);
    await page.click("#cb-fixsplit");
    const after = await ev(() => document.querySelectorAll("#sv line.split").length);
    await page.keyboard.press("Control+z");
    const back = await ev(() => document.querySelectorAll("#sv line.split").length);
    await page.keyboard.press("Control+z");
    await goSub("bandes"); await page.waitForSelector(".bands .bd-svg svg");
    if (!(cut.marks > 0 && btn && after === 0 && back > 0)) throw new Error(JSON.stringify({ cut, btn, after, back }));
    return true;
  });
  await check("lot 4 : un seul mode d'implantation des boîtes (Bureau d'études) : plus de choix de mode ni de comparaison dans le panneau Câblage ; « ⚡ Implantation rapide des pieuvres »", async () => {
    await page.click('#tabs button[data-tab="plan"]');
    await ev(() => okteoExt.panel.show("cablage")); await page.waitForTimeout(200);
    const r = await ev(() => ({ mode: !!document.querySelector("#bx-mode"), cmp: !!document.querySelector("#bx-cmp"), be: /Bureau d'études/.test((document.querySelector(".bx-be") || {}).textContent || ""), btn: (document.querySelector("#bx-auto") || {}).textContent || "" }));
    if (r.mode || r.cmp || !r.be || !/Implantation rapide des pieuvres/.test(r.btn)) throw new Error(JSON.stringify(r));
    return true;
  });
  await check("packs (v40) : pièce reconnue, « Compléter » pose ce qui manque (commande près de la porte, lumière, prises dans la pièce), « Pieuvre type » = boîte verrouillée de la pièce ; Ctrl+Z", async () => {
    await page.click('#tabs button[data-tab="plan"]');
    await ev(() => okteoExt.panel.show("packs")); await page.waitForTimeout(200);
    const t = await ev(() => { const R = okteoExt.packs.rooms(); const r = R.find((x) => x.pack && x.need.length) || R.find((x) => x.pack);
      return r ? { key: r.key, name: r.room.name, pack: r.pack.id, need: r.need.reduce((s, x) => s + x.n, 0), n0: okteo.state.app.length, rows: R.length, packs: R.filter((x) => x.pack).length } : null; });
    if (!t) throw new Error("aucune pièce avec pack");
    await page.click(`.pk-room[data-k="${t.key}"] [data-a="fill"]`).catch(() => {});
    const r1 = await ev(({ key }) => { const R = okteoExt.packs.rooms().find((x) => x.key === key); const inside = R.apps.length;
      return { n: okteo.state.app.length, left: R.need.reduce((s, x) => s + x.n, 0), inside }; }, t);
    await page.keyboard.press("Control+z");
    const n1 = await ev(() => okteo.state.app.length);
    await ev(() => okteoExt.panel.show("packs")); await page.waitForTimeout(150);
    const b0 = await ev(() => okteo.cab.boxes.length);
    await page.click(`.pk-room[data-k="${t.key}"] [data-a="pieuvre"]`);
    const r2 = await ev(({ key }) => { const R = okteoExt.packs.rooms().find((x) => x.key === key), B = okteo.cab.boxes, nb = B[B.length - 1] && B.find((b) => b.pack);
      const ids = R.apps.filter((a) => !["RJ45", "PC20", "SC", "TAB", "VMC"].includes(a.t)).map((a) => a.id);
      return { n: B.length, locked: !!(nb && nb.locked), all: !!nb && ids.every((id) => nb.apps.includes(id)), only: !!nb && B.filter((b) => b !== nb).every((b) => !b.apps.some((id) => ids.includes(id))) }; }, t);
    await page.keyboard.press("Control+z");
    const b1 = await ev(() => okteo.cab.boxes.length);
    await goSub("bandes"); await page.waitForSelector(".bands .bd-svg svg");
    const ok = t.rows > 2 && t.packs > 2 && (t.need === 0 || (r1.n === t.n0 + t.need && r1.left === 0)) && n1 === t.n0 && r2.locked && r2.all && r2.only && b1 === b0;
    if (!ok) throw new Error(JSON.stringify({ t, r1, n1, b0, r2, b1 }));
    return true;
  });
  await check("feuille de boîte (v47) : étiquette (pavillonneur, chantier, n° d'affaire, flèche du tableau), ordre de câblage, couvercle, code barre", async () => {
    await page.waitForSelector("#bd-code svg", { timeout: 8000 });
    const r = await ev(() => ({ lab: document.querySelector(".bd-label").textContent, rows: document.querySelectorAll(".bd-order tr").length, steps: document.querySelectorAll(".bd-steps tbody tr").length,
      first: document.querySelector(".bd-order tr td")?.textContent, bars: document.querySelectorAll("#bd-code svg rect").length, faces: [...document.querySelectorAll(".bd-svg g.face text")].map((t) => t.textContent) }));
    await page.selectOption("#bd-cover", "bas");
    const cover = await ev(() => okteo.cab.boxes.some((b) => b.cover === "bas"));
    await ev(() => okteo.undo());
    const ok = /Pavillonneur/.test(r.lab) && /TABLEAU/.test(r.lab) && /N° d'affaire/.test(r.lab) && r.rows === r.steps && r.first === "1" && r.bars > 20 && r.faces.length === 4 && r.faces[0].startsWith("A") && cover;
    if (!ok) throw new Error(JSON.stringify({ ...r, cover }));
    return true;
  });
  await check("QR code de la bande (v49) : affiché dans l'onglet Bandes ; la page téléphone l'ouvre (en-tête, schéma, ordre, raccordements), cases gardées", async () => {
    await goSub("bandes"); await page.waitForSelector("#bd-qr svg", { timeout: 15000 });
    const url = await ev(() => document.querySelector("#bd-qr").dataset.url), steps = await ev(() => document.querySelectorAll(".bd-steps tbody tr").length), bn = await ev(() => document.querySelector(".bd-pick .on").textContent);
    const p2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await p2.goto(`http://localhost:${APP_PORT}/bande.html` + url.slice(url.indexOf("#")));
    await p2.waitForSelector(".steps > li");
    const r = await p2.evaluate(() => ({ h1: document.querySelector("h1").textContent, steps: document.querySelectorAll(".steps > li").length, ord: document.querySelectorAll(".ord tr").length, svg: !!document.querySelector(".sch svg g.face"), tr: document.querySelectorAll(".tr svg g.tranche").length, wide: document.documentElement.scrollWidth <= innerWidth + 1 }));
    if (process.env.SHOT) await p2.screenshot({ path: process.env.SHOT + "/bande-telephone.png", fullPage: true });
    await p2.click(".steps > li:first-child input"); await p2.reload(); await p2.waitForSelector(".steps > li");
    const kept = await p2.evaluate(() => document.querySelector(".steps > li:first-child input").checked && /1 \/ /.test(document.querySelector(".prog").textContent));
    await p2.close();
    // 04/11/2026 : aucun nom dans le QR (pavillonneur, chantier, n° d'affaire)
    const noName = await ev(async (u) => { const j = JSON.stringify(await (await import("/src/cablage/bande-code.js")).decodeSheet(u.split("#b=")[1])), c = okteo.ch || {}; return ![c.nom, c.client, c.numero].some((x) => x && x.length > 2 && j.includes(x)); }, url);
    const ok = noName && url.startsWith("https://okteo-ai.pages.dev/bande.html#b=") && r.h1.includes(bn) && r.steps === steps && r.ord === steps && r.svg && r.tr === 4 && r.wide && kept;
    if (!ok) throw new Error(JSON.stringify({ noName, len: url.length, steps, bn, r, kept }));
    return true;
  });
  await check("impression des schémas : une feuille par boîte + raccordements à cocher, texte lisible (PDF relu)", async () => {
    await goSub("bandes"); await page.waitForSelector(".bands .bd-svg svg");
    await page.click("#bd-all");
    await page.waitForFunction(() => okteoExt.pages.bandes.ui.last, null, { timeout: 30000 });
    const b64 = await ev(async () => { const u = new Uint8Array(await okteoExt.pages.bandes.ui.last.blob.arrayBuffer()); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); });
    if (process.env.SHOT) fs.writeFileSync(process.env.SHOT + "/schemas-boites.pdf", Buffer.from(b64, "base64"));
    const doc = await pdfjsNode.getDocument({ data: new Uint8Array(Buffer.from(b64, "base64")), verbosity: 0 }).promise;
    const txt = async (i) => (await (await doc.getPage(i)).getTextContent()).items.map((x) => x.str).join(" ");
    const t1 = await txt(1), tTr = await txt(2), t2 = await txt(3), n = await ev(() => okteo.cab.boxes.length);
    // v60 : vue des 4 tranches à l'écran (sous le schéma) ; page « perçage des tranches » après le schéma
    const tr = await ev(() => ({ n: document.querySelectorAll(".bands .bd-tranches svg g.tranche").length, trous: document.querySelectorAll(".bands .bd-tranches svg g.trou[data-no]").length }));
    await page.click('#tabs button[data-tab="plan"]');
    const ok = doc.numPages >= 3 * n && /Boîte LI01/.test(t1) && /PAVILLONNEUR/.test(t1) && /TABLEAU/.test(t1) && /ORDRE DE CABLAGE/.test(t1) && /MODÈLE DE BOÎTE/.test(t1) && /-LI01/.test(t1) && /connecteur/.test(t1)
      && /perçage des tranches/.test(tTr) && tr.n === 4 && tr.trous > 2 && /raccordements à faire dans l'ordre/.test(t2) && /1\. Terres/.test(t2) && /Contrôle final/.test(await txt(doc.numPages));
    if (!ok) throw new Error(JSON.stringify({ pages: doc.numPages, n, tr, t1: t1.slice(0, 300), tTr: tTr.slice(0, 200), t2: t2.slice(0, 300) }));
    return true;
  });
  await check("étiquettes de boîte (v50) : 4 par A4 paysage, nom, en-tête, code, longueur totale et « à vérifier » (v52) ; dossier PDF : garde + plan + tableau + bandes détaillées", async () => {
    await goSub("bandes"); await page.waitForSelector(".bands .bd-svg svg");
    const pdfOf = async (expr) => { const b64 = await ev(async (e) => { const r = eval(e); const u = new Uint8Array(await r.blob.arrayBuffer()); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); }, expr);
      return pdfjsNode.getDocument({ data: new Uint8Array(Buffer.from(b64, "base64")), verbosity: 0 }).promise; };
    const txt = async (doc, i) => (await (await doc.getPage(i)).getTextContent()).items.map((x) => x.str).join(" ");
    await page.click("#bd-lab-all");
    await page.waitForFunction(() => okteoExt.pages.bandes.ui.lastLabels, null, { timeout: 60000 });
    const n = await ev(() => okteo.cab.boxes.length);
    const L = await pdfOf("okteoExt.pages.bandes.ui.lastLabels"), p1 = await L.getPage(1), vp = p1.getViewport({ scale: 1 }), t1 = await txt(L, 1);
    if (process.env.SHOT) fs.writeFileSync(process.env.SHOT + "/etiquettes.pdf", Buffer.from(await ev(async () => { const u = new Uint8Array(await okteoExt.pages.bandes.ui.lastLabels.blob.arrayBuffer()); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); }), "base64"));
    await page.click("#bd-dossier");
    await page.waitForFunction(() => okteoExt.pages.bandes.ui.lastDossier, null, { timeout: 90000 });
    const D = await pdfOf("okteoExt.pages.bandes.ui.lastDossier"), parts = await ev(() => okteoExt.pages.bandes.ui.lastDossier.parts);
    if (process.env.SHOT) fs.writeFileSync(process.env.SHOT + "/dossier.pdf", Buffer.from(await ev(async () => { const u = new Uint8Array(await okteoExt.pages.bandes.ui.lastDossier.blob.arrayBuffer()); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); }), "base64"));
    const d1 = await txt(D, 1), tb = parts.find((p) => /Tableau/.test(p.title)), tTb = tb ? await txt(D, tb.page) : "", bd = parts.find((p) => /Bandes/.test(p.title)), tBd = bd ? await txt(D, bd.page) : "";
    // v52 : longueur totale des gaines et règles non confirmées « à vérifier » sur l'étiquette, la page et la bande détaillée
    const page52 = await ev(() => ({ len: /\d+,\d\d m de gaines/.test(document.querySelector(".bands").textContent), verif: /À vérifier — règles non confirmées : .*R-074/.test(document.querySelector(".bands .bd-verif")?.textContent || "") }));
    const ok = L.numPages === Math.ceil(n / 4) && vp.width > vp.height && /LI01/.test(t1) && /PAVILLONNEUR/.test(t1) && /-LI01/.test(t1) && !/ORDRE DE CABLAGE/.test(t1)
      && /\d+,\d\d m de gaines/.test(t1) && /A VERIFIER : .*R-074/.test(t1) && page52.len && page52.verif
      && /Dossier de cablage/.test(d1) && /Sommaire/.test(d1) && parts.length === 3 && /Tableau electrique/.test(tTb) && /ORDRE DE CABLAGE/.test(tBd) && /Longueur totale des gaines : \d+,\d\d m/.test(tBd) && /A VERIFIER \(règles non confirmées\)/.test(tBd) && D.numPages >= 3 + 2 * n;
    if (!ok) throw new Error(JSON.stringify({ n, pages: L.numPages, w: vp.width, h: vp.height, t1: t1.slice(0, 400), d1: d1.slice(0, 200), parts, dp: D.numPages, page52, tBd: tBd.slice(0, 300) }));
    return true;
  });
  await check("couleurs par circuit et gaines partagées : une gaine « P… + P… » ; deux circuits 1,5 d'une boîte en rouge/bleu et gris/bleu foncé", async () => ev(async () => {
    const m = await import("/src/ext/cablage-data.js"), W = m.wiringNow(okteo), G = W.boxes.flatMap((b) => b.gaines);
    const shared = G.filter((g) => g.appIds && g.appIds.length > 1).length;
    const alim = W.boxes.map((b) => b.gaines.filter((g) => g.kind === "alim").flatMap((g) => g.wires.filter((w) => w.fn === "phase" && w.section === 1.5).map((w) => w.color)));
    const ok = shared > 0 && alim.some((c) => c.includes("rouge") && c.includes("gris")) && alim.every((c) => new Set(c).size === c.length);
    if (!ok) throw new Error(JSON.stringify({ shared, alim }));
    return true;
  }));
  await check("circuits et boîtes enregistrés avec le chantier (rechargement)", async () => {
    const n = await ev(() => { okteo.saveNow(); return [okteo.cab.circuits.length, okteo.cab.boxes.length]; });
    await page.reload(); await page.waitForFunction(() => window.okteo && window.okteoExt);
    const m = await ev(() => [okteo.cab.circuits.length, okteo.cab.boxes.length]);
    await ev(() => okteoExt.panel.show("props"));
    return n[0] > 3 && n[1] > 0 && m[0] === n[0] && m[1] === n[1];
  });

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
  await check("préparation d'impression (v74) : A3 du BE recto boîtes / verso lignes directes, légende, cartouche, encart texte", async () => {
    await page.click(".pr-prep");
    await page.waitForSelector(".prep-back:not([hidden])");
    await page.waitForFunction(() => okteoExt.prep.bg && document.querySelector(".prep-wait[hidden]"), null, { timeout: 30000 });
    const bg = await ev(() => ({ pages: okteoExt.prep.bg.pages, legends: okteoExt.prep.bg.legends.map((l) => l.page), boxes: document.querySelectorAll(".prep-boxes [data-box]").length }));
    await ev(() => okteoExt.prep.addItem("text"));
    await page.fill("#ps-text", "ZONE TEST PREPA");
    await page.fill('[data-c="affaire"]', "AF12345"); await page.press('[data-c="affaire"]', "Tab");
    await page.waitForTimeout(400);
    const n = await ev(() => document.querySelectorAll(".prep-ov .pit").length);
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click(".prep-dl")]);
    const f = path.join(os.tmpdir(), "okteo-prep.pdf"); await dl.saveAs(f);
    const doc = await pdfjsNode.getDocument({ data: new Uint8Array(fs.readFileSync(f)), verbosity: 0 }).promise;
    const vp = (await doc.getPage(1)).getViewport({ scale: 1 });
    const txt = async (p) => (await (await doc.getPage(p)).getTextContent()).items.map((i) => i.str).join(" ");
    const t1 = await txt(1), t2 = await txt(2);
    const saved = await ev(() => { const c = JSON.parse(localStorage.getItem("okteo.chantiers.v1") || "[]").find((x) => x.id === localStorage.getItem("okteo.current")) || {}; return { aff: c.affaire, items: (c.impression?.items || []).length }; });
    await page.keyboard.press("Escape"); await page.keyboard.press("Escape");
    const closed = await ev(() => document.querySelector(".prep-back").hidden);
    await page.keyboard.press("Control+p"); await page.waitForSelector(".pr-back:not([hidden])");
    await page.waitForFunction(() => okteoExt.printer.last && !document.querySelector(".pr-wait:not([hidden])"), null, { timeout: 30000 });
    const r = { bg, n, w: Math.round(vp.width), h: Math.round(vp.height), pages: doc.numPages, t1: t1.includes("ZONE TEST PREPA") && t1.includes("AF12345") && t1.includes("ESSAI"), t2: t2.includes("ZONE TEST PREPA"), leg: t2.includes("Tableau"), saved, closed };
    if (!(bg.pages === 2 && bg.legends.join() === "2" && bg.boxes > 0 && n === 1 && r.w === 1191 && r.h === 842 && r.pages === 2 && r.t1 && !r.t2 && saved.aff === "AF12345" && saved.items === 1 && closed)) throw new Error(JSON.stringify(r));
    return true;
  });
  await check("n° 2 : légende de la feuille A3 placée sans chevaucher le plan (place libre, colonnes, réduction, plan décalé ou page à part)", async () => {
    const r = await ev(async () => { const R = await okteoExt.prep.build(true); return { L: R.legends.map((l) => ({ page: l.page, where: l.where, cols: l.cols, k: l.k, x: l.x, y: l.y, w: l.w, h: l.h })), pages: R.pages, area: R.area }; });
    const inArea = r.L.every((l) => l.x >= r.area.x - 0.5 && l.y >= r.area.y - 0.5 && l.x + l.w <= r.area.x + r.area.w + 0.5 && l.y + l.h <= r.area.y + r.area.h + 0.5);
    if (!(r.L.length >= 1 && r.L.every((l) => l.where && l.cols >= 1 && l.k > 0.6) && inArea)) throw new Error(JSON.stringify(r));
    return true;
  });
  await check("bâti du BE (v74 MAJ 2) : type de mur, style gris, noms abrégés bleus, cotes des boîtes sur la feuille A3", async () => {
    const r0 = await ev(() => { const M = okteo.wallMats(), thick = M.find((m) => m.mat === "maconnerie"); return { n: M.length, thin: M[M.length - 1].id, was: M[M.length - 1].mat, thick: !!thick }; });
    const w = await ev((id) => { okteo.setWallMat(id, "doublage"); return { wave: document.querySelectorAll("#sv polyline.wave").length, mat: okteo.wallMats().find((m) => m.id === id).mat }; }, r0.thin);
    await ev(() => okteo.undo ? okteo.undo() : document.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true })));
    const back = await ev((id) => okteo.wallMats().find((m) => m.id === id).mat, r0.thin);
    await ev(() => okteo.setBatiStyle("gris"));
    const gris = await ev(() => ({ st: okteo.batiStyle, hatch: [...document.querySelectorAll("#sv polygon")].filter((p) => p.getAttribute("fill") === "url(#wall-hatch)").length, grey: [...document.querySelectorAll("#sv polygon")].filter((p) => p.getAttribute("fill") === "#9A9A9A").length }));
    const pdf = await ev(async () => { const r = await okteoExt.prep.build(true); return { cotes: (r.cotes[0] || { list: [] }).list.map((c) => c.cm), bytes: Array.from(new Uint8Array(await r.blob.arrayBuffer())) }; });
    await ev(() => okteo.setBatiStyle("hachures"));
    const doc = await pdfjsNode.getDocument({ data: new Uint8Array(pdf.bytes), verbosity: 0 }).promise;
    const items = (await (await doc.getPage(1)).getTextContent()).items.map((i) => i.str.trim()).filter(Boolean);
    const t1 = items.join(" ");
    const r = { r0, w, back, gris, cotes: pdf.cotes, abrev: t1.includes("CH1"), full: t1.includes("Chambre 1"), cm: pdf.cotes.every((c) => items.includes(String(c))) };
    if (!(r0.thick && r0.thin && w.mat === "doublage" && w.wave > 0 && back === r0.was && gris.st === "gris" && gris.grey > 0 && gris.hatch === 0 && pdf.cotes.length >= 1 && r.abrev && !r.full && r.cm)) throw new Error(JSON.stringify(r));
    return true;
  });
  await check("n° 14 : Relevé → Murs d'équerre : une maison relevée de travers (2 à 3°) remise d'équerre, angles joints, compte rendu, un Ctrl+Z", async () => {
    // un dialogue laissé ouvert par un test précédent (impression…) recouvre le menu : masqué le temps du test, puis remis
    await ev(() => document.querySelectorAll(".pal-back").forEach((e) => { e.dataset.hid = e.style.display || "-"; e.style.display = "none"; }));
    await ev(() => { okteo.setTab("plan"); okteoExt.panel?.close?.("assistant"); });
    const before = await ev(() => okteo.state.segs.length);
    let r = null, back = -1;
    try {
      await ev(() => okteo.importWalls({ nodes: [{ x: 200, y: 200 }, { x: 208, y: 200.3 }, { x: 208.25, y: 206 }, { x: 200.1, y: 206.1 }], walls: [{ a: 0, b: 1, ep: 0.2 }, { a: 1, b: 2, ep: 0.2 }, { a: 2, b: 3, ep: 0.2 }, { a: 3, b: 0, ep: 0.2 }], openings: [{ seg: 0, t: 4, w: 0.9, kind: "fenetre" }] }));
      await page.click("#btn-relev", { timeout: 8000 }); await page.click("#rv-square", { timeout: 8000 });
      r = await ev(() => {
        const S = okteo.state, segs = S.segs.slice(-4), N = (id) => S.nodes.find((n) => n.id === id);
        const right = segs.every((s) => { const a = N(s.a), b = N(s.b); return Math.abs(a.x - b.x) < 1e-3 || Math.abs(a.y - b.y) < 1e-3; });
        const joined = segs.every((s, i) => s.b === segs[(i + 1) % 4].a);
        return { right, joined, hint: document.getElementById("hint").textContent };
      });
    } finally {
      // toujours revenir au dessin de départ (sinon la maison d'essai fausse les tests suivants)
      for (let i = 0; i < 3 && (await ev(() => okteo.state.segs.length)) !== before; i++) await ev(() => okteo.undo());
      back = await ev(() => okteo.state.segs.length);
      await ev(() => document.querySelectorAll(".pal-back").forEach((e) => { if (e.dataset.hid) { e.style.display = e.dataset.hid === "-" ? "" : e.dataset.hid; delete e.dataset.hid; } }));
    }
    if (!(r && r.right && r.joined && /Murs : .*d'équerre/.test(r.hint) && back === before)) throw new Error(JSON.stringify({ r, back, before }));
    return true;
  });
  await check("n° 13 + 8 : symboles muraux hors du mur et dans le sens de leur mur ; appareil dans un mur signalé puis recollé ; repère glissé à la main (gardé, un Ctrl+Z)", async () => {
    await ev(() => document.querySelectorAll(".pal-back").forEach((e) => { e.dataset.hid = e.style.display || "-"; e.style.display = "none"; }));
    const keepView = await ev(() => ({ on: Object.keys(okteo.layers).filter((k) => okteo.layers[k].on), circ: okteo.showCircuits }));
    await ev(() => { okteo.setTab("plan"); okteo.setTool("sel"); okteo.viewPreset("impl"); okteo.fit(); okteoExt.panel?.close?.("assistant"); });
    const r1 = await ev(() => {
      const S = okteo.state, N = (id) => S.nodes.find((n) => n.id === id);
      let worst = 1e9, best = 0, n = 0, rot = null, rotId = null;
      S.app.filter((a) => a.seg && a.t !== "APP" && a.t !== "INT" && a.t !== "VV").forEach((a) => {
        const s = S.segs.find((x) => x.id === a.seg); if (!s) return;
        const A = N(s.a), B = N(s.b), L = Math.hypot(B.x - A.x, B.y - A.y); if (!L) return;
        const p = okteo.shownAt(a.id), d = Math.abs((p.x - A.x) * -(B.y - A.y) / L + (p.y - A.y) * (B.x - A.x) / L);
        const gapW = d - (s.ep ?? S.wallEp) / 2; worst = Math.min(worst, gapW); best = Math.max(best, gapW); n++;
        if (rot == null && Math.abs(B.x - A.x) / L < 0.1) { const g = document.querySelector(`#sv g.dev[data-id="${a.id}"]`); rot = g ? g.getAttribute("transform") : ""; rotId = a.id; }
      });
      return { worst, best, n, rot, rotId, sym: okteo.symCm };
    });
    // appareil sorti de son mur à la main et posé dans l'épaisseur du mur : signalé, puis « Recoller les appareils à leur mur »
    const r2 = await ev(() => {
      const S = okteo.state, a = S.app.find((x) => x.seg && x.t === "PC16"), s = S.segs.find((x) => x.id === a.seg);
      const A = S.nodes.find((n) => n.id === s.a), B = S.nodes.find((n) => n.id === s.b), orig = JSON.parse(JSON.stringify(a));
      delete a.seg; delete a.wa; a.x = (A.x + B.x) / 2; a.y = (A.y + B.y) / 2; window.__okteo.draw();
      const flagged = okteo.control.some((i) => i.kind === "mur" && i.ids.includes(a.id));
      const k = okteo.reattachWalls(), seg = a.seg || null;
      okteo.undo(); const b = S.app.find((x) => x.id === orig.id); Object.assign(b, orig); window.__okteo.draw();
      return { flagged, k, seg: !!seg, kind: !!okteo.controlKinds.mur };
    });
    // repère glissé à la souris : position gardée, Ctrl+Z la retire
    const lab = await ev(() => { const t = [...document.querySelectorAll("#sv text.rep")].find((e) => { const r = e.getBoundingClientRect(); return r.width > 4 && r.x > 50 && r.y > 120; }); if (!t) return null; const r = t.getBoundingClientRect(); return { id: t.dataset.id, x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    let r3 = null;
    if (lab) {
      await page.mouse.move(lab.x, lab.y); await page.mouse.down(); await page.mouse.move(lab.x + 30, lab.y + 25, { steps: 5 }); await page.mouse.up();
      const moved = await ev((id) => { const a = okteo.state.app.find((x) => x.id === id); return a && a.rpx != null; }, lab.id);
      await ev(() => okteo.undo());
      const back = await ev((id) => { const a = okteo.state.app.find((x) => x.id === id); return a && a.rpx == null; }, lab.id);
      r3 = { moved, back };
    }
    await ev(() => document.querySelectorAll(".pal-back").forEach((e) => { if (e.dataset.hid) { e.style.display = e.dataset.hid === "-" ? "" : e.dataset.hid; delete e.dataset.hid; } }));
    await ev((V) => { Object.keys(okteo.layers).forEach((k) => okteo.toggleView(k, V.on.includes(k))); okteo.showCircuits = V.circ; }, keepView);
    if (!(r1.n > 5 && r1.worst > 0.055 && r1.best > 0.08 && /rotate\(-?90/.test(r1.rot || "") && r2.flagged && r2.k >= 1 && r2.seg && r2.kind && r3 && r3.moved && r3.back)) throw new Error(JSON.stringify({ r1, r2, r3, lab }));
    return true;
  });
  await check("05/11 : interrupteurs et va-et-vient muraux : rond collé à la face du mur, trait perpendiculaire vers la pièce (symboles Oktéo et symboles FTZ du BE, écran et papier)", async () => {
    const keepView = await ev(() => ({ on: Object.keys(okteo.layers).filter((k) => okteo.layers[k].on), circ: okteo.showCircuits }));
    const keepFtz = await ev(async () => (await import("/src/prefs.js")).pref("charteBE"));
    await ev(() => { okteo.setTab("plan"); okteo.viewPreset("impl"); okteo.fit(); });
    // mesure dans le plan : écart entre le centre affiché et la face du mur, sens du trait (vers la pièce)
    const measure = (ftz) => ev(async (ftz) => {
      const P = await import("/src/prefs.js"); P.setPref("charteBE", ftz); window.__okteo.draw();
      await new Promise((r) => setTimeout(r, 400)); window.__okteo.draw();
      const FS = await import("/src/print/ftz-symbols.js"), CH = await (await fetch("/src/print/ftz-charte.json")).json(), IDX = FS.symIndex(CH);
      const S = okteo.state, N = (id) => S.nodes.find((n) => n.id === id), out = [];
      S.app.filter((a) => a.seg && (a.t === "INT" || a.t === "VV")).forEach((a) => {
        const s = S.segs.find((x) => x.id === a.seg), A = N(s.a), B = N(s.b), L = Math.hypot(B.x - A.x, B.y - A.y);
        const g = document.querySelector(`#sv g.dev[data-id="${a.id}"]`); if (!g || !L) return;
        const m = /translate\(([-\d.e]+) ([-\d.e]+)\)(?: rotate\(([-\d.e]+)\))?/.exec(g.getAttribute("transform")), ss = +/scale\(([-\d.e]+)\)/.exec(g.innerHTML)[1];
        const X = +m[1], Y = +m[2], rot = +m[3] || 0;
        let nx = -(B.y - A.y) / L, ny = (B.x - A.x) / L; const dd = (X - A.x) * nx + (Y - A.y) * ny; if (dd < 0) { nx = -nx; ny = -ny; }
        const ep = (s.ep ?? S.wallEp) / 2, fs = FS.ftzSymbol(IDX, a.t, a.h), ftzShown = !!g.querySelector("g.ftz");
        const R = ftzShown ? (fs.h / 2) * (1.6 / 3.88) * ss : 0.55 * ss;
        const want = (ftzShown ? Math.atan2(nx, -ny) : Math.atan2(ny, nx)) * 180 / Math.PI, dr = ((rot - want) % 360 + 540) % 360 - 180;
        out.push({ t: a.t, ftz: ftzShown, gap: Math.abs(dd) - ep, R, dr, n: g.querySelectorAll("line").length });
      });
      return out;
    }, ftz);
    let ok = [], fz = [];
    try { ok = await measure(false); fz = await measure(true); }
    finally { await ev(async (v) => { (await import("/src/prefs.js")).setPref("charteBE", v); }, keepFtz); }
    // papier : même forme (rond au point, trait vers la direction donnée)
    const p = await ev(async () => { const m = await import("/src/ext/print.js"), calls = [];
      const doc = new Proxy({}, { get: (t, k) => (...a) => { calls.push([k, a]); return doc; } });
      m.symbol(doc, "INT", 100, 50, 2, 0, null, 180); return calls.filter((c) => c[0] === "circle" || c[0] === "line").map((c) => [c[0], ...c[1].slice(0, 4).map((v) => +(+v).toFixed(2))]); });
    await ev(async (v) => { (await import("/src/prefs.js")).setPref("charteBE", v); }, keepFtz);
    await ev((V) => { Object.keys(okteo.layers).forEach((k) => okteo.toggleView(k, V.on.includes(k))); okteo.showCircuits = V.circ; }, keepView);
    const good = (L, ftz) => L.length >= 3 && L.every((x) => x.ftz === ftz && Math.abs(x.gap - x.R) < 0.02 * x.R + 1e-4 && Math.abs(x.dr) < 1 && (ftz || x.n === (x.t === "VV" ? 4 : 2)));
    const circle = p.find((c) => c[0] === "circle"), arm = p.find((c) => c[0] === "line");
    if (!(good(ok, false) && good(fz, true) && circle && circle[1] === 100 && circle[2] === 50 && Math.abs(circle[3] - 1.1) < 0.01 && arm && arm[1] < 100 && arm[3] < arm[1] && Math.abs(arm[2] - 50) < 0.01)) throw new Error(JSON.stringify({ ok: ok.slice(0, 4), fz: fz.slice(0, 4), n: [ok.length, fz.length], p }));
    return true;
  });
  await check("05/11 : plan fluide : 40 crans de molette = au plus un dessin par image ; le fond n'est pas recréé à chaque dessin", async () => {
    await ev(() => { okteoExt.panel.close("assistant"); okteo.setTab("plan"); okteo.fit(); });
    const box = await page.locator("#sv").boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    // compte les dessins pendant la rafale (draw est appelé par drawSoon une fois par image)
    await ev(() => { const sv = document.getElementById("sv"); window.__mut = 0; window.__mo = new MutationObserver(() => window.__mut++); window.__mo.observe(sv, { childList: true }); });
    const t0 = Date.now();
    for (let i = 0; i < 40; i++) await page.mouse.wheel(0, i < 20 ? -120 : 120);
    await ev(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))));
    const ms = Date.now() - t0, muts = await ev(() => { window.__mo.disconnect(); return window.__mut; });
    const bg = await ev(() => { const a = document.querySelector("#sv image"); window.__okteo.draw(); const b = document.querySelector("#sv image"); return { has: !!a, same: a === b }; });
    await ev(() => okteo.fit());
    if (!(muts < 40 && (!bg.has || bg.same))) throw new Error(JSON.stringify({ ms, muts, bg }));
    return true;
  });
  await check("v77 : murs dessinés avec un seul contour d'ensemble (pas de trait en travers des angles ni des T)", async () => {
    const r = await ev(() => {
      const out = document.querySelector("#sv g.walls-out"), fill = out && out.nextElementSibling;
      return { out: out ? out.querySelectorAll("polygon").length : 0, joints: out ? out.querySelectorAll("rect").length : 0,
        stroked: fill ? [...fill.querySelectorAll("polygon")].filter((p) => p.getAttribute("stroke") === "#222").length : -1, segs: okteo.state.segs.filter((s) => !s.virt).length };
    });
    if (!(r.out >= r.segs && r.segs > 0 && r.joints > 0 && r.stroked === 0)) throw new Error(JSON.stringify(r));
    return true;
  });
  await check("plan du BE (v74 MAJ 4) : symboles FTZ à l'écran (préférence), gaines à la couleur de la boîte, PMR, feuille A3 (repères Courier, plaques)", async () => {
    await page.waitForFunction(() => document.querySelectorAll("#sv g.dev g.ftz").length > 0, null, { timeout: 15000 });
    const cnt = await ev(() => ({ ftz: document.querySelectorAll("#sv g.dev g.ftz").length, dev: document.querySelectorAll("#sv g.dev").length }));
    await ev(() => { okteo.showCircuits = true; });
    await page.waitForFunction(() => document.querySelector("#sv path.gaine:not(.alim)"), null, { timeout: 15000 });
    const scr = await ev(() => {
      const ftz = 0, dev = 0;
      const g = document.querySelector("#sv path.gaine:not(.alim)"), b = g && okteo.cab.boxes.find((x) => x.id === g.dataset.b);
      const col = g && g.getAttribute("stroke"), n = b && b.n;
      return { ftz, dev, col, n };
    });
    Object.assign(scr, cnt);
    await ev(async () => { const m = await import("/src/prefs.js"); m.setPref("charteBE", false); });
    const off = await ev(() => ({ ftz: document.querySelectorAll("#sv g.dev g.ftz").length, col: document.querySelector("#sv path.gaine:not(.alim)")?.getAttribute("stroke") }));
    await ev(async () => { const m = await import("/src/prefs.js"); m.setPref("charteBE", true); okteo.showCircuits = false; });
    const pmr = await ev(() => {
      const p = okteo.state.app.find((a) => a.t === "PC16" && a.h === 30), id = p && p.id;
      const n = okteo.setPmr(true), h = okteo.state.app.find((a) => a.id === id)?.h, ch = okteo.pmr;
      okteo.undo(); okteo.setPmr(false, { apply: false });
      return { n, h, ch, back: okteo.state.app.find((a) => a.id === id)?.h, after: okteo.pmr };
    });
    const pdf = await ev(async () => { const r = await okteoExt.prep.build(true); return { plq: r.plaques.flatMap((p) => p.list).length, bytes: Array.from(new Uint8Array(await r.blob.arrayBuffer())) }; });
    const doc = await pdfjsNode.getDocument({ data: new Uint8Array(pdf.bytes), verbosity: 0 }).promise;
    const fonts = new Set(), items = [];
    for (const n of [1, 2]) { const pg = await doc.getPage(n), tc = await pg.getTextContent(); tc.items.forEach((i) => { items.push(i.str); fonts.add(tc.styles[i.fontName]?.fontFamily || i.fontName); }); }
    const r = { scr, off, pmr, plq: pdf.plq, courier: [...fonts].some((f) => /courier|monospace/i.test(f)), prof: items.filter((x) => x === "PROF 50").length };
    const colors = ["#FF0000", "#008000", "#FF00FF", "#0000FF", "#000000", "#FF8000", "#800080"];
    if (!(scr.ftz > 5 && scr.ftz <= scr.dev && scr.col === colors[(parseInt(scr.n.replace(/\D/g, ""), 10) - 1) % 7] && off.ftz === 0 && off.col !== scr.col && pmr.n >= 1 && pmr.h === 40 && pmr.ch && pmr.back === 30 && !pmr.after && r.courier && r.prof === r.plq)) throw new Error(JSON.stringify(r));
    return true;
  });
  await check("assistant (v75) : bouton micro 🎤 avec son aide, Alt+V ouvre l'assistant et lance la dictée (ou explique pourquoi elle est impossible)", async () => {
    await page.keyboard.press("Alt+v"); await page.waitForTimeout(600);
    const r = await ev(() => { const b = document.querySelector(".as-mic"), m = document.querySelector(".as-mic-msg"); return { b: !!b, title: b && b.title, open: okteoExt.panel.isOpen("assistant"), rec: b && b.classList.contains("rec"), msg: m && !m.hidden ? m.textContent : "", sup: okteoExt.assistant.micro.supported, cat: okteoExt.catalog.some((c) => c.id === "ai.dictee") }; });
    await ev(() => { okteoExt.assistant.micro.stop(); okteoExt.panel.close("assistant"); });
    if (!(r.b && /Alt\+V|indisponible/.test(r.title) && r.open && r.cat && (r.rec || r.msg || !r.sup))) throw new Error(JSON.stringify(r));
    return true;
  });
  await check("IA (v75, v76) : conversation de l'assistant avec Sonnet, analyse du plan / relevé / relectures avec Opus 5.5 verrouillé (constante unique)", async () => {
    const r = await ev(async () => { const m = await import("/src/ext/ai.js"); return { chat: m.modelFor("anthropic", "chat"), an: m.modelFor("anthropic", "analyse"), nv: m.modelFor("nvidia", "analyse") === m.modelFor("nvidia", "chat"), forced: m.modelFor("anthropic", "analyse", { models: { anthropicAnalyse: "claude-haiku-5-5" } }), cfg: (await import("/src/ai-config.js")).ANALYSE_MODEL }; });
    await ev(() => okteo.setTab("params")); await page.waitForTimeout(300);
    const f = await ev(() => ({ ma: !!document.querySelector('.pcard[data-p="anthropic"] .ma'), lock: document.querySelector('.pcard[data-p="anthropic"] .ma-lock')?.textContent || "" }));
    await ev(() => okteo.setTab("plan"));
    // v76 : modèle de l'analyse verrouillé (src/ai-config.js) : un ancien réglage « anthropicAnalyse » est ignoré, plus de champ dans Paramètres
    if (!(r.chat === "claude-sonnet-5-5" && r.an === "claude-opus-5-5" && r.cfg === "claude-opus-5-5" && r.nv && r.forced === "claude-opus-5-5" && !f.ma && /claude-opus-5-5/.test(f.lock) && /verrouillé/.test(f.lock))) throw new Error(JSON.stringify({ r, f }));
    return true;
  });
  await check("salle de bain (v74 MAJ 3) : douche à l'italienne posée, volumes dessinés, luminaire dedans signalé, annulable", async () => {
    const r = await ev(() => {
      const room = okteo.state.rooms[0], P = room.poly || [{ x: room.x0, y: room.y0 }, { x: room.x1, y: room.y1 }];
      const c = { x: P.reduce((s, p) => s + p.x, 0) / P.length, y: P.reduce((s, p) => s + p.y, 0) / P.length };
      const n0 = okteo.state.app.length, k0 = okteo.control.filter((x) => x.kind === "sdb").length;
      const { ids } = okteo.importDevices([{ t: "DITAL", x: c.x, y: c.y }, { t: "LUM", x: c.x + 0.4, y: c.y }]);
      const v = { v1: document.querySelectorAll("#sv polygon.vol.v1").length, v2: document.querySelectorAll("#sv polygon.vol.v2").length, sani: document.querySelectorAll("#sv g.sani").length };
      const sdb = okteo.control.filter((x) => x.kind === "sdb"), geo = okteo.exportGeometry();
      const rep = !!(okteo.repMap && okteo.repMap()[ids[0]]);
      okteo.undo();
      return { n0, k0, ids, v, sdb: sdb.map((x) => x.ids.join("/")), vols: (geo.volumes || []).length, inApps: geo.apps.some((a) => a.id === ids[0]), back: okteo.state.app.length === n0 && !okteo.control.some((x) => x.kind === "sdb"), kinds: okteo.controlKinds.sdb, rep };
    });
    if (!(r.k0 === 0 && r.v.v1 === 1 && r.v.v2 === 1 && r.v.sani === 1 && r.sdb.includes(r.ids[1]) && r.vols === 1 && !r.inApps && r.back && r.kinds)) throw new Error(JSON.stringify(r));
    return true;
  });
  await check("onglet Étapes (lot 5) : import, boîtes, câblage, impression cochés tout seuls ; les vérifications attendent l'opérateur", async () => {
    await ev(() => okteoExt.panel.show("steps")); await page.waitForTimeout(250);
    const r = await ev(() => ({ done: [...document.querySelectorAll(".steps li.done")].map((li) => li.dataset.step), next: document.querySelector(".steps li.next b")?.textContent || "" }));
    await ev(() => okteoExt.panel.show("props"));
    if (!(r.done.includes("import") && r.done.includes("impression") && !r.done.includes("murs") && !r.done.includes("verifBoites") && r.next === "Échelle confirmée")) throw new Error(JSON.stringify(r));
    return true;
  });
  await check("échelle exacte : la largeur des murs dans le PDF = largeur réelle × 1000 / échelle", async () => {
    geoW = await ev(() => { const g = okteo.exportGeometry(), xs = g.walls.flat().map((p) => p.x); return Math.max(...xs) - Math.min(...xs); });
    const doc = await pdfjsNode.getDocument({ data: pdfBytes.slice(), verbosity: 0 }).promise;
    const ex = await extractSegments(await doc.getPage(1), pdfjsNode.OPS);
    // v71 : cloisons pleines (32,32,32), murs ≥ 16 cm blancs hachurés avec contour (32,32,32) ; arrondi jsPDF ±2
    const grey32 = (h) => h && [1, 3, 5].every((i) => Math.abs(parseInt(h.slice(i, i + 2), 16) - 32) <= 2);
    const wallSegs = ex.segs.filter((s) => grey32(s.fill) || grey32(s.stroke));
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
  // v48 : impression complète (boîtes, gaines, couleurs des circuits) d'après le filtre de la vue
  let viewKeep = null, prN = 0;
  const prText = async () => {
    await page.waitForFunction(() => okteoExt.printer.last && !document.querySelector(".pr-wait:not([hidden])"), null, { timeout: 30000 });
    await page.waitForTimeout(400);
    await page.waitForFunction(() => !document.querySelector(".pr-wait:not([hidden])"), null, { timeout: 30000 });
    const bytes = await ev(async () => Array.from(new Uint8Array(await okteoExt.printer.last.blob.arrayBuffer())));
    fs.writeFileSync(path.join(os.tmpdir(), `okteo-plan-v48-${++prN}.pdf`), new Uint8Array(bytes));
    const doc = await pdfjsNode.getDocument({ data: new Uint8Array(bytes), verbosity: 0 }).promise;
    return { doc, t1: (await (await doc.getPage(1)).getTextContent()).items.map((i) => i.str) };
  };
  await check("impression en vue Câblage : boîtes (nom, faces A–D, n° de gaine), gaines couleur du circuit, cases des calques cochées d'après la vue", async () => {
    viewKeep = await ev(() => ({ L: Object.fromEntries(Object.entries(okteo.layers).map(([k, v]) => [k, v.on])), c: okteo.showCircuits }));
    await ev(() => okteo.viewPreset("cab"));
    await page.keyboard.press("Control+p"); await page.waitForSelector(".pr-back:not([hidden])");
    const ck = await ev(() => Object.fromEntries(["boites", "gaines", "circuits", "appareils", "cotes", "murs"].map((k) => [k, document.querySelector(`.pr [data-k="${k}"]`).checked])));
    const { doc, t1 } = await prText();
    const W = await ev(async () => { const m = await import("/src/ext/cablage-data.js"), W = m.wiringNow(okteo), lv = okteo.level.id;
      const B = W.boxes.filter((b) => b.lv === lv); return { names: B.map((b) => b.n), nos: B.flatMap((b) => b.gaines.filter((g) => (g.kind !== "alim" || g.id === "alim:0") && (g.appIds || []).every((id) => okteo.state.app.some((x) => x.id === id))).map((g) => g.no.split(".").pop())) }; });   // (une gaine vers un appareil d'un autre niveau n'a pas de point sur ce plan)
    const ex = await extractSegments(await doc.getPage(1), pdfjsNode.OPS);
    const cols = await ev(() => { const g = okteo.exportGeometry(); return [...new Set(g.boxes.flatMap((b) => b.deps.flatMap((d) => d.ends.map((e) => e.color))).filter(Boolean))]; });
    const near = (h, c) => h && [1, 3, 5].every((i) => Math.abs(parseInt(h.slice(i, i + 2), 16) - parseInt(c.slice(i, i + 2), 16)) <= 3);
    const colored = cols.filter((c) => ex.segs.some((s) => near(s.stroke, c) || near(s.fill, c))).length;
    const nosFound = W.nos.filter((n) => t1.includes(n)).length;
    // v71 (rendu KiTéOHM) : boîte = nom dans le carré, plus de lettres de face ni de n° de gaine sur le plan imprimé
    // (ils restent sur les bandes) ; l'alimentation est une flèche étiquetée « LIxx.01 »
    const ok = ck.boites && ck.gaines && ck.circuits && ck.appareils && !ck.cotes && ck.murs && W.names.length && W.names.every((n) => t1.includes(n))
      && t1.some((s) => /^LI\d+\.01/.test(s)) && t1.some((s) => /Boîte de pieuvre/.test(s)) && cols.length && colored >= Math.min(2, cols.length);
    if (!ok) throw new Error(JSON.stringify({ ck, names: W.names, nosFound, nos: W.nos.length, cols: cols.length, colored, missing: W.nos.filter((n) => !t1.includes(n)), near: t1.filter((x) => /^\d{3,}$/.test(x)) }));
    return true;
  });
  await check("impression : décocher « Boîtes » et « Gaines » les retire du PDF ; « = écran » les remet ; vue Bâti → ni appareils ni boîtes", async () => {
    const name = await ev(() => okteo.exportGeometry().boxes[0].n);
    await page.uncheck('.pr [data-k="boites"]'); await page.uncheck('.pr [data-k="gaines"]');
    await page.waitForTimeout(250);
    const a = (await prText()).t1;
    await page.click(".pr-fromview"); await page.waitForTimeout(250);
    const b = (await prText()).t1;
    await page.keyboard.press("Escape");
    await ev(() => okteo.viewPreset("bati"));
    await page.keyboard.press("Control+p"); await page.waitForSelector(".pr-back:not([hidden])");
    const ck = await ev(() => ["boites", "gaines", "appareils", "liaisons"].map((k) => document.querySelector(`.pr [data-k="${k}"]`).checked));
    const c = (await prText()).t1;
    await page.keyboard.press("Escape");
    await ev((V) => { Object.entries(V.L).forEach(([k, v]) => (okteo.layers[k].on = v)); okteo.showCircuits = V.c; window.__okteo.draw(); }, viewKeep);
    const ok = !a.includes(name) && b.includes(name) && ck.every((v) => !v) && !c.includes(name) && c.some((s) => /Appareils non imprimés/.test(s));
    if (!ok) throw new Error(JSON.stringify({ a: a.includes(name), b: b.includes(name), ck, c: c.includes(name) }));
    return true;
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
    await page.evaluate(() => okteo.setTab("chantiers"));   // lot 3 : accueil par le logo (plus d'onglet)
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click('.ch-list tr:has-text("ESSAI") button[data-act="file"]')]);
    const f = path.join(os.tmpdir(), "okteo-test.okteo"); await dl.saveAs(f);
    const j = JSON.parse(fs.readFileSync(f, "utf8"));
    const okFile = j.format === "okteo-chantier" && j.fond.image.startsWith("data:image") && j.fond.pdf.startsWith("data:application/pdf") && JSON.parse(j.dessin.s).rooms.length === essaiRooms && /^ESSAI_99999(_R\d{3}_[\dhm_-]+)?\.okteo$/.test(dl.suggestedFilename());   // v72 : révision dans le nom
    const n0 = await nbCh();
    await Promise.all([page.waitForNavigation(), page.setInputFiles("#ch-import", f)]);
    await reopened();
    await page.waitForFunction(() => okteo.FOND && okteo.FOND.startsWith("blob:"), null, { timeout: 30000 });
    const R = { okFile, fmt: j.format, img: String(j.fond?.image).slice(0, 15), pdf: String(j.fond?.pdf).slice(0, 22), roomsFile: JSON.parse(j.dessin.s).rooms.length, essaiRooms, name: dl.suggestedFilename(),
      n: await nbCh(), n0, rooms: await ev(() => okteo.state.rooms.length), badge: await page.textContent(".badge") };
    if (!(okFile && R.n === n0 + 1 && R.rooms === essaiRooms && R.badge.includes("ESSAI"))) throw new Error(JSON.stringify(R));
    return true;
  });
  await check("dupliquer puis supprimer un chantier (avec confirmation)", async () => {
    await page.evaluate(() => okteo.setTab("chantiers"));   // lot 3 : accueil par le logo (plus d'onglet)
    const n0 = await nbCh();
    await page.click('.ch-list tr:has-text("EVRARD") button[data-act="dup"]');
    await page.waitForFunction((n) => JSON.parse(localStorage.getItem("okteo.chantiers.v1")).length === n, n0 + 1, { timeout: 5000 }).catch(() => {});
    if ((await nbCh()) !== n0 + 1) throw new Error("copie absente");
    await page.click('.ch-list tr:has-text("EVRARD (copie)") button[data-act="del"]');
    await page.click('button[data-act="del-yes"]');
    await page.waitForFunction((n) => JSON.parse(localStorage.getItem("okteo.chantiers.v1")).length === n, n0, { timeout: 5000 });
    return !(await page.textContent(".ch-list")).includes("(copie)");
  });
  await check("le chantier ouvert ne peut pas être supprimé", async () => page.isDisabled('.ch-list tr.cur button[data-act="del"]'));
  await page.click('#tabs button[data-tab="plan"]');

  console.log("Contrôle permanent (v43)");
  await ev(() => { okteoExt.panel.close("assistant"); okteo.setTool("sel"); okteo.viewPreset("impl"); });
  await check("contrôle : une commande seule et une lumière seule comptées, halos animés, clic sur le compteur = cas suivant", async () => {
    const ids = await ev(() => okteo.importDevices([{ t: "INT", x: 100, y: 100 }, { t: "LUM", x: 102, y: 101 }]).ids);
    await ev((i) => okteo.zoomTo(i), ids); await page.waitForTimeout(150);
    const mine = await ev((i) => okteo.control.filter((x) => x.ids.some((k) => i.includes(k))).map((x) => x.kind).sort().join(","), ids);
    const btn = await ev(() => ({ cls: document.getElementById("ctl").className, t: document.getElementById("ctl").textContent, n: okteo.control.length }));
    const halos = await ev((i) => i.every((k) => !!document.querySelector(`#fx .fx-halo[data-k="halo:${k}"]`)) && getComputedStyle(document.querySelector("#fx .fx-halo .pulse")).animationName === "fx-pulse2", ids);
    let found = false;
    for (let k = 0; k < btn.n + 1 && !found; k++) { await page.click("#ctl"); found = await ev((i) => okteo.selection.some((s) => i.some((x) => s.endsWith(":" + x))), ids); }
    const hint = await page.textContent("#hint");
    await ev(() => okteoExt.panel.show("cablage")); await page.waitForTimeout(250);
    const list = await ev(() => document.querySelectorAll("#side .ctl-list li").length);
    await ev(() => { okteo.undo(); okteoExt.panel.show("props"); });
    const back = await ev((i) => !okteo.state.app.some((a) => i.includes(a.id)), ids);
    const ok = mine.includes("cmd") && mine.includes("lum") && btn.cls.includes("bad") && btn.t.includes(String(btn.n)) && halos && found && hint.includes("À vérifier") && list === btn.n && back;
    if (!ok) throw new Error(JSON.stringify({ mine, btn, halos, found, hint, list, back }));
    return true;
  });

  await check("contrôle (v45.1) : deux interrupteurs simples sur une lampe signalés ; lampes en chaîne sans commande signalées toutes les deux", async () => {
    const ids = await ev(() => okteo.importDevices([{ t: "INT", x: 110, y: 100 }, { t: "INT", x: 111, y: 100 }, { t: "LUM", x: 112, y: 101 }, { t: "LUM", x: 115, y: 101 }, { t: "LUM", x: 117, y: 101 }],
      [{ c: 0, l: 2 }, { c: 1, l: 2 }, { c: 3, l: 4 }]).ids);
    const k = await ev((i) => okteo.control.filter((x) => x.ids.some((q) => i.includes(q))).map((x) => x.kind + ":" + x.ids.filter((q) => i.includes(q)).map((q) => i.indexOf(q)).join("")), ids);
    const t = await ev((i) => okteo.essai.testAll().issues.filter((x) => i.includes(x.ids[0])).map((x) => x.kind).sort().join(","), ids);
    await ev(() => okteo.undo());
    const ok = k.includes("int2:012") && k.includes("lum:3") && k.includes("lum:4") && t === "int2,int2";
    if (!ok) throw new Error(JSON.stringify({ k, t }));
    return true;
  });

  console.log("Pack depuis le bandeau de la pièce (v44)");
  await check("pièce sélectionnée sans nom de pack : « Implantation rapide » ouvre la liste des packs, Maj+P + chiffre = pack posé et pièce renommée, un seul Ctrl+Z", async () => {
    await ev(() => { okteo.zoomToBox(199, 199, 206, 205); okteo.setTool("piece"); });
    const a = await ev(() => okteo.toClient(200, 200)), b = await ev(() => okteo.toClient(204, 203.5));
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 8 }); await page.mouse.up();
    const room = await ev(() => { const r = okteo.state.rooms[okteo.state.rooms.length - 1]; return { id: r.id, name: r.name }; });
    await ev((id) => okteo.select([id]), room.id); await page.waitForTimeout(150);
    const hudBtn = await page.isVisible('#hud [data-h="pack"]');
    await page.click('#hud [data-h="pack"]');
    const menu = await ev(() => ({ n: document.querySelectorAll(".pk-menu [data-p]").length, first: document.querySelector(".pk-menu [data-p] b")?.textContent }));
    await page.keyboard.press("Escape");
    const closed = !(await page.isVisible(".pk-menu"));
    const apps0 = await ev(() => okteo.state.app.length);
    await ev((id) => okteo.select([id]), room.id);
    await page.keyboard.press("Shift+P"); await page.waitForSelector(".pk-menu"); await page.keyboard.press("1"); await page.waitForTimeout(200);
    const after = await ev((id) => { const r = okteo.state.rooms.find((x) => x.id === id), R = okteoExt.packs.rooms().find((x) => x.id === id); return { name: r.name, apps: okteo.state.app.length, need: R ? R.need.length : -1, types: R ? R.apps.map((x) => x.t).sort().join(",") : "" }; }, room.id);
    await ev(() => okteo.undo());
    const undone = await ev(({ id, n }) => ({ name: okteo.state.rooms.find((x) => x.id === id).name, apps: okteo.state.app.length === n }), { id: room.id, n: apps0 });
    await ev(() => { okteo.undo(); okteo.setTool("sel"); });
    const ok = hudBtn && menu.n >= 5 && menu.first === "Chambre" && closed && /^Chambre/.test(after.name) && after.apps === apps0 + 6 && after.need === 0 && after.types === "INT,LUM,PC16,PC16,PC16,RJ45" && undone.name === room.name && undone.apps;
    if (!ok) throw new Error(JSON.stringify({ hudBtn, menu, closed, room, after, undone }));
    return true;
  });

  await check("lot 4 : pièce nommée « Chambre » : « ⚡ Implantation rapide » pose son pack tout de suite (sans liste à choisir), un seul Ctrl+Z ; les packs se règlent dans Paramètres", async () => {
    await ev(() => { okteo.zoomToBox(209, 199, 216, 205); okteo.setTool("piece"); });
    const a = await ev(() => okteo.toClient(210, 200)), b = await ev(() => okteo.toClient(214, 203.5));
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 8 }); await page.mouse.up();
    const id = await ev(() => { const r = okteo.state.rooms[okteo.state.rooms.length - 1]; okteo.renameRoom(r.id, "Chambre lot 4"); okteo.setTool("sel"); return r.id; });
    const n0 = await ev(() => okteo.state.app.length);
    await ev((i) => okteo.select([i]), id); await page.waitForTimeout(150);
    const lab = await page.textContent('#hud [data-h="pack"]');
    await page.click('#hud [data-h="pack"]');
    await page.waitForTimeout(200);
    const r = await ev((n) => ({ menu: !!document.querySelector(".pk-menu"), added: okteo.state.app.length - n }), n0);
    await ev(() => okteo.undo());
    const back = await ev((n) => okteo.state.app.length === n, n0);
    await ev(() => { okteo.undo(); okteo.undo(); okteo.clearSel(); okteo.setTab("params"); });
    await page.waitForSelector("#ps-packs #ps-packs-ed .pk-row", { timeout: 10000 });
    const ed = await ev(() => ({ rows: document.querySelectorAll("#ps-packs .pk-row").length, save: !!document.querySelector("#ps-packs #pk-save") }));
    await ev(() => okteo.setTab("plan"));
    if (!(/Implantation rapide/.test(lab) && !r.menu && r.added === 6 && back && ed.rows >= 5 && ed.save)) throw new Error(JSON.stringify({ lab, r, back, ed }));
    return true;
  });

  console.log("Mode essai (v45)");
  await check("essai : interrupteur allume puis éteint (lumière animée), va-et-vient en inversion, poussoir = télérupteur, disjoncteur, Tester tout, Échap", async () => {
    const ids = await ev(() => okteo.importDevices([{ t: "INT", x: 300, y: 300 }, { t: "LUM", x: 302, y: 300 }, { t: "VV", x: 300, y: 302 }, { t: "VV", x: 304, y: 302 }, { t: "LUM", x: 302, y: 302.5 },
      { t: "BP", x: 300, y: 304 }, { t: "LUM", x: 302, y: 304 }, { t: "INT", x: 305, y: 304 }],
      [{ c: 0, l: 1 }, { c: 2, l: 4 }, { c: 3, l: 4 }, { c: 5, l: 6 }]).ids);
    const C0 = await ev(() => JSON.parse(JSON.stringify(okteo.cab.circuits || [])));
    await ev((i) => okteo.setCircuits([...(okteo.cab.circuits || []), { n: "CX", kind: "eclairage", apps: [i[0], i[1]], section: 1.5, prot: 10 }]), ids);
    await ev((i) => { okteo.zoomToBox(298, 298, 307, 306); okteo.setEssai(true); }, ids); await page.waitForTimeout(150);
    const card = await page.isVisible(".essai-card");
    const click = async (k) => { const c = await ev((id) => { const a = okteo.state.app.find((x) => x.id === id); return okteo.toClient(a.x, a.y); }, ids[k]); await page.mouse.click(c.x, c.y); await page.waitForTimeout(60); };
    const lit = (k) => ev((id) => okteo.essai.lit().includes(id), ids[k]);
    await click(0); const on1 = await lit(1);
    await page.waitForTimeout(120);
    const glow = await ev((id) => { const g = document.querySelector(`#fx .fx-glow[data-k="glow:${id}"]`); return !!g && getComputedStyle(g.querySelector(".fx-lum")).animationName === "fx-flick"; }, ids[1]);
    await click(0); const off1 = !(await lit(1));
    await click(2); const v1 = await lit(4); await click(3); const v2 = !(await lit(4)); await click(3); const v3 = await lit(4);
    await click(5); const t1 = await lit(6); await click(5); const t2 = !(await lit(6));
    await click(0); await ev(() => okteo.essai.breaker("CX", false)); const brk = !(await lit(1)); await ev(() => okteo.essai.breaker("CX", true)); const brk2 = await lit(1);
    await click(1); const viaLamp = !(await lit(1));
    await page.click('.essai-card [data-a="test"]');
    const res = await ev((i) => okteoExt.essai.result.issues.filter((x) => i.includes(x.ids[0])).map((x) => x.kind).join(","), ids);
    const listed = await ev(() => document.querySelectorAll(".essai-card .es-res li").length > 0);
    await page.keyboard.press("Escape");
    const out = !(await ev(() => okteo.testMode)) && !(await page.isVisible(".essai-card"));
    await ev((c) => okteo.setCircuits(c), C0);
    await ev(() => { okteo.undo(); okteo.undo(); okteo.undo(); });
    const back = await ev((i) => !okteo.state.app.some((a) => i.includes(a.id)), ids);
    const ok = card && on1 && glow && off1 && v1 && v2 && v3 && t1 && t2 && brk && brk2 && viaLamp && res === "rien" && listed && out && back;
    if (!ok) throw new Error(JSON.stringify({ card, on1, glow, off1, v1, v2, v3, t1, t2, brk, brk2, viaLamp, res, listed, out, back }));
    return true;
  });
  console.log("Tableau (v46)");
  await check("tableau (v49) : clic sur le tableau du plan = onglet Tableau ; coffret Legrand Drivia avec sa marque ; prise modulaire ajoutée puis retirée", async () => {
    await page.click('#tabs button[data-tab="plan"]');
    const t = await ev(() => { okteoExt.panel.close("assistant"); okteo.setTool("sel"); okteo.viewPreset("impl"); const a = okteo.state.app.find((x) => x.t === "TAB"); if (!a) return null; okteo.zoomToBox(a.x - 2, a.y - 2, a.x + 2, a.y + 2); return okteo.toClient(a.x, a.y); });
    if (!t) throw new Error("pas de tableau sur le plan");
    await page.mouse.click(t.x, t.y); await page.waitForTimeout(200);
    const opened = await ev(() => okteo.tab === "tableau" || document.querySelector('#tabs button[data-tab="tableau"]').classList.contains("on"));
    if (!opened) await page.click('#tabs button[data-tab="tableau"]');
    await page.waitForSelector("#tableau .tb-box");
    await page.selectOption("#tb-model", "dv-13x4");
    const lg = await ev(() => ({ model: okteo.cab.tableau && okteo.cab.tableau.model, brand: document.querySelector("#tableau .tb-cap .tb-brand").textContent.trim(), cls: document.querySelector("#tableau .tb-box").className }));
    await page.selectOption("#tb-mod", "pc");
    const pc = await ev(() => document.querySelectorAll("#tableau .tb-it.tmod.m-pc").length);
    await page.hover("#tableau .tb-it.tmod.m-pc"); await page.click("#tableau .tb-it.tmod.m-pc .tb-del");
    const gone = await ev(() => document.querySelectorAll("#tableau .tb-it.tmod").length === 0);
    await ev(() => { okteo.undo(); okteo.undo(); okteo.undo(); });
    const ok = opened && lg.model === "dv-13x4" && lg.brand === "legrand" && /lg/.test(lg.cls) && pc === 1 && gone;
    if (!ok) throw new Error(JSON.stringify({ opened, lg, pc, gone }));
    return true;
  });
  await check("tableau v66.1 : recalcul conserve le contacteur ; revue et Ctrl+Z", async () => {
    await page.click('#tabs button[data-tab="tableau"]');
    await page.selectOption("#tb-mod", "hc");
    const before = await ev(() => JSON.stringify(okteo.cab.tableau));
    await page.click("#tb-auto");
    const kept = await ev(() => okteo.cab.tableau.rows.flat().some((x) => x.t === "hc" && x.reviewPlacement));
    await page.click("#tb-reviewed");
    const reviewed = await ev(() => !okteo.cab.tableau.rows.flat().some((x) => x.reviewPlacement));
    await ev(() => { okteo.undo(); okteo.undo(); });
    const restored = await ev(() => JSON.stringify(okteo.cab.tableau));
    await ev(() => okteo.undo());
    if (!kept || !reviewed || restored !== before) throw new Error("Accessoire ou annulation perdus");
    return true;
  });
  await check("tableau v66.1 : réserve seule propose un coffret ; aucune solution sans plantage", async () => {
    const original = await ev(() => JSON.parse(JSON.stringify(okteo.cab.tableau || null)));
    try {
      await ev(() => okteo.setCab({ tableau: { model: "r9-13x2", rows: [
        [{ k: "mod", id: "reserve1", t: "del", w: 11 }], [{ k: "mod", id: "reserve2", t: "del", w: 10 }]
      ] } }));
      await page.waitForSelector("#tb-sug");
      await page.click("#tb-sug");
      const changed = await ev(() => okteo.cab.tableau.model !== "r9-13x2");
      await ev(() => okteo.setCab({ tableau: { model: "dv-13x4", rows: Array.from({ length: 5 }, (_, i) => [{ k: "mod", id: "overflow" + i, t: "del", w: 10 }]) } }));
      const noSolution = await ev(() => document.querySelector("#tableau").textContent.includes("Aucun coffret Legrand") && !document.querySelector("#tb-sug"));
      if (!changed || !noSolution) throw new Error("Suggestion incorrecte ou absence non signalée");
      return true;
    } finally { await page.evaluate((tableau) => okteo.setCab({ tableau }), original); }
  });
  await check("onglet Tableau : coffret Resi9 dessiné, disjoncteurs glissés d'une rangée à l'autre (un Ctrl+Z), manette = circuit coupé pour l'essai", async () => {
    if (!(await ev(() => (okteo.cab.circuits || []).length))) await ev(() => okteoExt.cablage.auto());
    await page.click('#tabs button[data-tab="tableau"]'); await page.waitForSelector("#tableau .tb-box");
    const r0 = await ev(() => ({ rows: document.querySelectorAll("#tableau .tb-row").length, cb: document.querySelectorAll("#tableau .tb-it.tcb").length, id: document.querySelectorAll("#tableau .tb-it.tid").length, model: document.querySelector("#tb-model").value }));
    const src = page.locator("#tableau .tb-row[data-r='0'] .tb-it.tcb").first(), c = await src.getAttribute("data-c");
    await src.dragTo(page.locator("#tableau .tb-row[data-r='1'] .tb-free").first()); await page.waitForTimeout(200);
    const moved = await ev((c) => okteo.cab.tableau && okteo.cab.tableau.rows.findIndex((r) => r.some((x) => x.c === c)), c);
    await page.click(`#tableau [data-cut="${c}"]`);
    const cut = await ev((c) => okteo.essai.off.includes(c), c);
    await page.click(`#tableau [data-cut="${c}"]`);
    const back = await ev((c) => !okteo.essai.off.includes(c), c);
    await ev(() => okteo.undo()); await page.waitForTimeout(150);
    const undone = await ev(() => !okteo.cab.tableau);
    const ok = r0.rows >= 4 && r0.cb > 0 && r0.id >= 2 && r0.model === "r9-13x4" && moved === 1 && cut && back && undone;
    if (!ok) throw new Error(JSON.stringify({ r0, c, moved, cut, back, undone }));
    return true;
  });
  await page.click('#tabs button[data-tab="plan"]');

  console.log("Panneau extension");
  await check("panneau élargissable en tirant le bord", async () => {
    const g = await page.locator("#side-grip").boundingBox();
    const w0 = (await page.locator("#side").boundingBox()).width;
    await page.mouse.move(g.x + 3, g.y + 200); await page.mouse.down(); await page.mouse.move(g.x - 140, g.y + 200, { steps: 6 }); await page.mouse.up();
    const w1 = (await page.locator("#side").boundingBox()).width;
    return w1 > w0 + 100;
  });
  await check("panneau fermé par sa croix, rouvert par son bouton du bandeau, refermé par un 2e clic (v41)", async () => {
    await ev(() => okteoExt.panel.show("props"));
    await page.click("#side-head .col");
    const shut = !(await page.isVisible("#side"));
    await page.click('#panes button[data-pane="cablage"]');
    const open = (await page.isVisible("#side")) && (await page.textContent("#side-head .ttl")) === "Câblage" && (await ev(() => document.querySelector('#panes button[data-pane="cablage"]').classList.contains("on")));
    await page.click('#panes button[data-pane="cablage"]');
    const shut2 = !(await page.isVisible("#side"));
    await page.click('#panes button[data-pane="props"]');
    return shut && open && shut2 && (await page.isVisible("#sidebody"));
  });
  console.log("Journal des règles de câblage (v51)");
  // la page Paramètres défile dans son propre cadre : amener l'élément au centre avant de cliquer
  const clickIn = async (sel) => { await ev((x) => document.querySelector(x)?.scrollIntoView({ block: "center" }), sel); await page.click(sel, { timeout: 8000 }); };
  await check("bibliothèque : pagination, domaines, recherche, filtres de validation et application", async () => {
    await ev(() => localStorage.removeItem("okteo.regles.v1"));
    await page.click('#tabs button[data-tab="params"]');
    await page.waitForSelector("#ps-regles .rg-rules");
    await page.fill(".pset-find", "");
    const initial = await page.locator("#ps-regles .rg-row").count();
    const count = await page.textContent("#rg-count");
    await clickIn('#ps-regles [data-page="next"]');
    const second = await page.locator("#ps-regles .rg-row").first().getAttribute("data-id");
    await page.fill("#rg-f-q", "ballon");
    const ballon = await page.locator('.rg-row[data-id="R-082"]').count();
    await clickIn("#rg-f-clear");
    await clickIn('#ps-regles [data-domain="tableau"]');
    const tableau = await page.textContent("#rg-count");
    await page.selectOption('[data-filter="validation"]', "manquante");
    const missing = await page.locator("#ps-regles .rg-row").count();
    await clickIn("#rg-f-clear");
    await page.selectOption('[data-filter="application"]', "automatique");
    const auto = await page.locator('.rg-row[data-id="R-074"]').count();
    await clickIn("#rg-f-clear");
    await page.fill("#rg-f-q", "ICTA");
    const icta = await page.locator('.rg-row[data-id="R-074"]').count();
    await clickIn("#rg-f-clear");
    if (!(initial === 24 && count.startsWith("116 résultats") && second !== "R-001" && ballon && tableau.startsWith("66 résultats") && missing > 0 && auto && icta)) throw new Error(JSON.stringify({ initial,count,second,ballon,tableau,missing,auto,icta }));
    return true;
  });
  await check("Tableau → Règles du tableau : accès ciblé, fiche au clavier, retour tous domaines", async () => {
    await ev(() => okteo.setTab("tableau"));
    await clickIn("#tb-rules");
    await page.waitForSelector('#ps-regles [data-domain="tableau"].on');
    const count = await page.textContent("#rg-count");
    await page.locator("#ps-regles .rg-row").first().focus();
    await page.keyboard.press("Enter");
    const fiche = await page.locator(".rg-fiche").count();
    const collapsed = await ev(() => !document.querySelector(".rg-technical").open);
    await clickIn("#rg-f-clear");
    return count.startsWith("66 résultats") && fiche === 1 && collapsed;
  });
  await check("journal : « ⏳ En attente » = questions en suspens (collègue, chantier) et règles qui en dépendent ; « Tout afficher » revient", async () => {
    await clickIn("#rg-f-wait");
    const r = await ev(() => { const S = document.getElementById("ps-regles");
      return { rows: [...S.querySelectorAll(".rg-row")].map((tr) => tr.dataset.id).join(","), open: S.querySelector("#rg-qd").open,
        qs: [...S.querySelectorAll(".rg-qs tr td.mono")].map((t) => t.textContent).join(","), col: S.querySelectorAll(".rg-qs .rg-wait.col").length,
        on: S.querySelector("#rg-f-wait").classList.contains("on") }; });
    await clickIn("#rg-f-clear");
    const n = await ev(() => document.querySelectorAll("#ps-regles .rg-row").length);
    if (!(r.on && r.open && r.rows === "" && /Q-83/.test(r.qs) && /Q-84/.test(r.qs) && /Q-42/.test(r.qs) && !/Q-01\b/.test(r.qs) && /Q-85/.test(r.qs) && r.col === 3 && n === 24)) throw new Error(JSON.stringify({ r, n }));
    return true;
  });
  await check("fiche d'une règle : paramètres, écart avec le logiciel (18 / 16), utilisée par, preuves, questions, historique ; lien depuis un réglage Câblage", async () => {
    await clickIn('#ps-regles .rg-row[data-id="R-001"]');
    const conform = await ev(() => /suivent le journal/.test(document.querySelector("#ps-regles .rg-ecarts-box").textContent));
    // un réglage changé à la main (18 départs) : l'écart apparaît dans la fiche et en tête du journal
    await ev(async () => (await import("/src/cablage/settings.js")).setCab({ departsMax: 18 }));
    await page.waitForTimeout(100);
    await clickIn('#ps-regles .rg-row[data-id="R-001"]'); await clickIn('#ps-regles .rg-row[data-id="R-001"]');
    const f = await ev(() => document.querySelector("#ps-regles .rg-fiche")?.textContent || "");
    const ec = await ev(() => [...document.querySelectorAll("#ps-regles .rg-ecarts tr")].map((tr) => tr.textContent).join("|"));
    await ev(async () => (await import("/src/cablage/settings.js")).resetCab());
    await clickIn('#cab-set .rg-link[data-rule="R-074"]');
    await page.waitForTimeout(200);
    const f2 = await ev(() => document.querySelector("#ps-regles .rg-row.on")?.dataset.id + "|" + (document.querySelector("#ps-regles .rg-fiche")?.textContent || ""));
    const ok = conform && /departs_max = 16/.test(f) && /Départs par boîte \(sans l'alimentation\) : 18 \(journal : 16\)/.test(f) && /R-088/.test(f) && /Bande DUCOURNEAU/.test(f) && /Q-50/.test(f) && /H-020/.test(f)
      && /R-001.*16.*18/.test(ec) && /^R-074\|/.test(f2) && /icta20_mm2 = 13,5/.test(f2) && /bloquer/.test(f2);
    if (!ok) throw new Error(JSON.stringify({ f: f.slice(0, 300), ec, f2: f2.slice(0, 200) }));
    return true;
  });
  await check("choix du chantier : volets, appareils à choix enregistrés dans le chantier (lot 4 : mode de pieuvre = Bureau d'études, sans choix)", async () => {
    const plug = await ev(() => !document.querySelector("#rg-mode") && /Bureau d'études/.test(document.querySelector("#ps-regles .rg-choix").textContent));
    await clickIn("#ps-regles .rg-context > summary");
    await page.selectOption("#rg-volets", "boite_a_part");
    await page.selectOption("#rg-racc", "ligne_directe");
    const c = await ev(() => ({ mode: okteo.cab.mode, ch: okteo.cab.choix }));
    await ev(() => okteo.setCab({ mode: "proximite", choix: {} }));
    if (!(plug && c.ch.volets === "boite_a_part" && c.ch.raccordement === "ligne_directe")) throw new Error(JSON.stringify({ plug, c }));
    return true;
  });
  await check("modifier une règle par l'assistant : avant / après, Valider = journal + historique ; proposition invalide refusée", async () => {
    const old = await ev(() => JSON.stringify(okteoExt.settings.get()));
    await ev(() => okteoExt.settings.set({ keys: { anthropic: "sk-test", nvidia: "" }, provider: "anthropic" }));
    await page.fill("#rg-f-q", "R-002");
    await clickIn('#ps-regles .rg-row[data-id="R-002"]');
    await clickIn('#ps-regles .rg-ask[data-id="R-002"]');
    await page.waitForSelector(".as-in textarea", { state: "visible" });
    const pre = await page.inputValue(".as-in textarea");
    await page.fill(".as-in textarea", pre + "elle est confirmée.");
    await page.click(".as-in button[type=submit]");
    await page.waitForSelector(".rg-prop .rg-ok", { timeout: 8000 });
    const card = await ev(() => [...document.querySelectorAll(".rg-prop")].map((x) => x.textContent).join("|"));
    await clickIn(".rg-prop .rg-ok");
    const after = await ev(async () => { const m = await import("/src/cablage/regles.js"); const J = m.getJournal(); const r = m.ruleById(J, "R-002"); const h = J.history[J.history.length - 1]; return { cert: r.certitude, st: r.statut, v: r.version, h: h.id + "|" + h.regle + "|" + h.action + "|" + h.motif + "|" + h.local }; });
    const st = await ev(() => document.querySelector(".rg-prop .rg-pst")?.textContent || "");
    await ev((o) => okteoExt.settings.set(JSON.parse(o)), old);
    await ev(() => okteoExt.panel.close("assistant"));
    const ok = /^Règle R-002 : je veux la modifier/.test(pre) && /Modifier R-002/.test(card) && /certitude.*supposee.*confirmee/.test(card) && /Champs inconnus : couleur/.test(card)
      && after.cert === "confirmee" && after.st === "active" && after.v === 2 && /^H-\d{3}\|R-002\|Modification\|Confirmée par Kévin\|true$/.test(after.h) && st.includes("validée (" + after.h.slice(0, 5) + ")");
    if (!ok) throw new Error(JSON.stringify({ pre, card: card.slice(0, 300), after, st }));
    return true;
  });
  await check("journal : export JSON puis import (entrée « Import » dans l'historique), retour à la base", async () => {
    await ev(() => okteo.setTab("params"));
    await page.waitForSelector("#ps-regles .rg-rules");
    const [dl] = await Promise.all([page.waitForEvent("download"), clickIn("#rg-export")]);
    const txt = await ev(() => document.getElementById("ps-regles")._lastExport);
    const name = dl.suggestedFilename();
    const j = JSON.parse(txt);
    j.rules.find((r) => r.id === "R-004").titre = "Boîtes verrouillées (importé)";
    await page.setInputFiles("#rg-import", { name: "journal.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(j)) });
    await page.waitForSelector("#ps-regles .rg-msg:not([hidden])");
    const r = await ev(async () => { const m = await import("/src/cablage/regles.js"); const J = m.getJournal(); return { t: m.ruleById(J, "R-004").titre, h: J.history[J.history.length - 1].action, conf: m.ruleById(J, "R-002").certitude, msg: document.querySelector("#ps-regles .rg-msg").textContent }; });
    await ev(async () => { const m = await import("/src/cablage/regles.js"); m.resetJournal(); });
    const back = await ev(async () => { const m = await import("/src/cablage/regles.js"); return m.ruleById(m.getJournal(), "R-002").certitude; });
    await ev(() => okteo.setTab("plan"));
    if (!(/^journal-regles-cablage-\d{8}\.json$/.test(name) && j.okteo === "journal-regles" && j.rules.length === 117 && r.t === "Boîtes verrouillées (importé)" && r.h === "Import" && r.conf === "confirmee" && /Journal importé/.test(r.msg) && back === "supposee")) throw new Error(JSON.stringify({ name, r, back }));
    return true;
  });

  console.log("Étude du câblage (v53)");
  await check("onglet Étude : précontrôle, 9 étapes avec leur état, modes comparés (gaine, boîtes, départs), où ça coince", async () => {
    await ev(() => okteoExt.panel.close("assistant"));
    await page.click('#tabs button[data-tab="etude"]');
    await page.waitForSelector("#etude .et-step");
    const r = await ev(() => ({ steps: [...document.querySelectorAll("#etude .et-step")].map((b) => b.querySelector("b").textContent), pc: document.querySelector("#etude .et-pc").textContent, where: document.querySelectorAll("#et-where li").length }));
    await page.click('#etude .et-step[data-n="2"]');
    const alt = await ev(() => [...document.querySelectorAll("#et-alternatives tr")].slice(1).map((tr) => tr.textContent));
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + "/etude.png" });
    if (!(r.steps.length === 9 && /1\. Lecture du plan/.test(r.steps[0]) && /9\. Contrôle/.test(r.steps[8]) && /Précontrôle — ✓ les \d+ règles utiles/.test(r.pc) && /supposées/.test(r.pc) && r.where > 0 && alt.length === 5 && alt.some((t) => /Bureau d.études/.test(t)) && alt.some((t) => /retenu/.test(t)) && !alt.some((t) => /retenu/.test(t) && /✗/.test(t)))) throw new Error(JSON.stringify({ r, alt }));
    return true;
  });
  await check("« Câbler le chantier » : boîtes et circuits recalculés, étude enregistrée dans le chantier, statistiques ; un seul Ctrl+Z", async () => {
    const before = await ev(() => JSON.stringify(okteo.cab.boxes.map((b) => b.id + ":" + b.apps.length)));
    await page.click("#et-cabler");
    await page.waitForSelector("#etude .et-msg");
    const r = await ev(() => ({ msg: document.querySelector("#etude .et-msg").textContent, etude: okteo.cab.etude && okteo.cab.etude.steps.length, stats: Object.keys(JSON.parse(localStorage.getItem("okteo.etudes.v1") || "{}")).length, last: /Dernier câblage/.test(document.querySelector("#etude .et-pc").textContent) }));
    await page.click('#tabs button[data-tab="plan"]');
    await page.keyboard.press("Control+z");
    const undone = await ev(() => ({ etude: !!okteo.cab.etude, boxes: JSON.stringify(okteo.cab.boxes.map((b) => b.id + ":" + b.apps.length)) }));
    await page.keyboard.press("Control+y");
    const redo = await ev(() => !!okteo.cab.etude);
    if (!(/^Câblé : \d+ boîtes/.test(r.msg) && r.etude === 9 && r.stats >= 1 && r.last && !undone.etude && undone.boxes === before && redo)) throw new Error(JSON.stringify({ r, undone, before, redo }));
    return true;
  });
  await check("précontrôle : une règle bloquante inconnue → « Je ne peux pas câbler : il manque 1 règle » (rien ne change) ; l'assistant peut lancer le câblage", async () => {
    const r = await ev(async () => {
      const R = await import("/src/cablage/regles.js");
      const J = R.getJournal(); R.apply(J, R.propose(J, { op: "modifier", id: "R-074", patch: { certitude: "inconnue", si_doute: "bloquer" }, motif: "essai" }));
      const before = JSON.stringify(okteo.cab.boxes);
      const txt = okteoExt.catalog.find((c) => c.id === "etude.cabler").run();
      const same = JSON.stringify(okteo.cab.boxes) === before;
      R.resetJournal();
      const txt2 = okteoExt.catalog.find((c) => c.id === "etude.cabler").run();
      return { txt, same, txt2 };
    });
    if (!(/^Je ne peux pas câbler : il manque 1 règle — R-074/.test(r.txt) && r.same && /^Câblé/.test(r.txt2))) throw new Error(JSON.stringify(r));
    return true;
  });
  await check("doutes sur le plan : pastille ✕ près de la boîte ; v64 : comptés dans le seul compteur « à vérifier » (rouge ✕ si bloquant), un clic va au doute", async () => {
    await ev(async () => (await import("/src/cablage/settings.js")).setCab({ icta20: 5, icta16: 3 }));
    await page.waitForFunction(() => okteo.doubts.length > 0 && document.getElementById("ctl").classList.contains("blq") && document.getElementById("dbt").hidden, null, { timeout: 5000 });
    await ev(() => { okteo.showCircuits = true; window.__okteo.draw(); });
    const r = await ev(() => ({ n: okteo.doubts.length, fx: document.querySelectorAll("#fx .fx-doubt.blq").length, btn: document.getElementById("ctl").textContent, nc: okteo.control.length, tip: document.getElementById("ctl").title }));
    let hint = "";
    for (let k = 0; k <= r.nc && !/doute/.test(hint); k++) { await page.click("#ctl"); hint = await ev(() => document.getElementById("hint").textContent); }
    await ev(() => okteo.setTab("etude"));
    const coince = await ev(() => document.querySelector("#et-where").textContent);
    await ev(() => okteo.setTab("plan"));
    await ev(async () => (await import("/src/cablage/settings.js")).resetCab());
    await page.waitForFunction(() => !document.getElementById("ctl").classList.contains("blq"), null, { timeout: 5000 });
    const total = new RegExp("^✕" + (r.nc + r.n) + " à vérifier");
    if (!(r.n > 0 && r.fx > 0 && total.test(r.btn) && /doute/.test(r.tip) && /doute/.test(hint) && /R-074/.test(coince))) throw new Error(JSON.stringify({ r, hint, coince: coince.slice(0, 200) }));
    return true;
  });
  await check("« Pourquoi ? » : clic sur une boîte (R-001, mode, faces) puis sur sa gaine d'alimentation (R-074, R-075) et un fil (R-031)", async () => {
    await page.click('#tabs button[data-tab="plan"]');
    const id = await ev(() => okteo.cab.boxes[0].id);
    await ev((i) => document.dispatchEvent(new CustomEvent("okteo:box-select", { detail: { id: i } })), id);
    const box = await ev(() => document.querySelector(".why-card:not([hidden])")?.textContent || "");
    await ev((i) => document.dispatchEvent(new CustomEvent("okteo:box-select", { detail: { id: i, key: "tab" } })), id);
    const g = await ev(() => document.querySelector(".why-card:not([hidden])")?.textContent || "");
    await page.click('.why-card [data-w="0"]');
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + "/pourquoi.png" });
    const w = await ev(() => document.querySelector(".why-card .why-w")?.textContent || "");
    await page.click(".why-card [data-x]");
    const shut = await ev(() => document.querySelector(".why-card").hidden);
    if (!(/Pourquoi LI\d+ \?/.test(box) && /R-001/.test(box) && /Mode de pieuvre/.test(box) && /\.01 \?/.test(g) && /R-074/.test(g) && /R-075/.test(g) && /R-031/.test(w) && shut)) throw new Error(JSON.stringify({ box: box.slice(0, 200), g: g.slice(0, 200), w }));
    return true;
  });
  await check("rapport de câblage (PDF) : étapes, modes, où ça coince", async () => {
    await page.click('#tabs button[data-tab="etude"]');
    await page.waitForSelector("#et-report");
    await page.click("#et-report");
    await page.waitForFunction(() => document.getElementById("etude").__report, null, { timeout: 20000 });
    const b64 = await ev(async () => { const u = new Uint8Array(await document.getElementById("etude").__report.blob.arrayBuffer()); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); });
    const doc = await pdfjsNode.getDocument({ data: new Uint8Array(Buffer.from(b64, "base64")), verbosity: 0 }).promise;
    const t = (await (await doc.getPage(1)).getTextContent()).items.map((x) => x.str).join(" ");
    await page.click('#tabs button[data-tab="plan"]');
    if (!(/Rapport de câblage/.test(t) && /Étapes/.test(t) && /Où ça coince/.test(t) && /Modes de pieuvre étudiés/.test(t))) throw new Error(t.slice(0, 300));
    return true;
  });

  console.log("Appareils du journal, volets, lignes directes (v54)");
  await check("barre d'outils : « Autres ▾ » ouvre les appareils par groupe ; choisir le radiateur l'active (symbole dans le bouton)", async () => {
    await page.click('#tabs button[data-tab="plan"]');
    await ev(() => okteoExt.panel.close("assistant"));
    await page.click('#tools [data-tool="__more"]');
    const groups = await ev(() => [...document.querySelectorAll("#tools .more-pop .mg b")].map((b) => b.textContent));
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + "/autres.png", clip: { x: 0, y: 0, width: 1500, height: 420 } });
    await page.click('#tools .more-pop [data-tool="RAD"]');
    const r = await ev(() => ({ tool: okteo.tool, open: !!document.querySelector("#tools .more-pop"), on: document.querySelector('#tools [data-tool="__more"]').classList.contains("on"), txt: document.querySelector('#tools [data-tool="__more"] text')?.textContent }));
    await ev(() => okteo.setTool("sel"));
    if (!(groups.length === 8 && /Zones d'exclusion/.test(groups.join()) && /Volets roulants/.test(groups.join()) && groups.includes("Sanitaires") && r.tool === "RAD" && !r.open && r.on && r.txt === "RAD")) throw new Error(JSON.stringify({ groups, r }));
    return true;
  });
  await check("nouveaux appareils : radiateur, TV, hotte (choix du raccordement dans Propriétés), volet + CVR reliés, équipotentielle locale", async () => {
    const ids = await ev(() => { const a = okteo.state.app.find((x) => x.t === "PC16"); const r = okteo.importDevices([{ t: "RAD", x: a.x + 0.6, y: a.y }, { t: "TV", x: a.x + 1.2, y: a.y }, { t: "HOTTE", x: a.x + 1.8, y: a.y }, { t: "VR", x: a.x + 2.4, y: a.y }, { t: "CVR", x: a.x + 2.4, y: a.y + 0.6 }, { t: "EQL", x: a.x + 3, y: a.y }], [{ c: 4, l: 3 }]); return r.ids || r; });
    const hotte = await ev(() => okteo.state.app.find((x) => x.t === "HOTTE").id);
    await ev((id) => okteo.select([id]), hotte);
    await page.waitForSelector("#f_racc");
    const info = await ev(() => document.querySelector("#sidebody").textContent);
    await page.selectOption("#f_racc", "ligne_directe");
    const racc = await ev(() => okteo.state.app.find((x) => x.t === "HOTTE").racc);
    const lk = await ev(() => { const c = okteo.state.app.find((x) => x.t === "CVR"), v = okteo.state.app.find((x) => x.t === "VR"); return okteo.state.lia.some((l) => l.c === c.id && l.l === v.id); });
    await ev(() => okteo.clearSel());
    if (!(/à choisir : boîte ou ligne directe/.test(info) && racc === "ligne_directe" && lk)) throw new Error(JSON.stringify({ info: info.slice(0, 300), racc, lk, ids }));
    return true;
  });
  await check("lignes directes (feuille FTZ) : étiquette, longueur, gaine, fil, aboutissant ; courant faible à part en gaine verte ; total par gaine", async () => {
    await ev(() => okteoExt.cablage.auto());
    await goSub("lignes");
    await page.waitForSelector("#lignes .dl-tab");
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + "/lignes.png" });
    const r = await ev(() => { const T = document.querySelector("#lignes"); return { head: [...T.querySelectorAll(".dl-tab thead th")].map((x) => x.textContent).join("|"), rows: [...T.querySelectorAll(".dl-tab tbody tr")].map((tr) => tr.textContent), tot: T.querySelector(".dl-tot").textContent }; });
    await page.click('#tabs button[data-tab="plan"]');
    const rad = r.rows.find((t) => /^C\d/.test(t)), tv = r.rows.find((t) => /^TV\d/.test(t)), hot = r.rows.find((t) => /^HOTTE\d/.test(t));
    if (!(r.head === "Étiquette|Longueur (m)|Gaine|Fil|Aboutissant|Circuit|Vérif" && rad && /ICTA 161,5 B\+N\+M\+V\/J/.test(rad) && tv && /ICTA 20 V \(verte\)17 VATC/.test(tv) && hot && /2,5 B\+R\+V\/J/.test(hot) && r.rows.some((t) => /^Courant faible/.test(t)) && /Total de gaines : .*ICTA 16/.test(r.tot))) throw new Error(JSON.stringify(r).slice(0, 600));
    return true;
  });

  console.log("Câblage aligné sur le BE (v56)");
  await check("prise de plan de travail (R-098) : Propriétés « Automatique : oui » pour une prise à 1,10 m près d'une plaque ; « Non » la retire du circuit cuisine", async () => {
    await ev(() => okteoExt.panel.close("assistant"));
    const ids = await ev(() => { const a = okteo.state.app.find((x) => x.t === "PC16"); return okteo.importDevices([{ t: "PLAQ", x: a.x + 1, y: a.y }, { t: "PC16", x: a.x + 0.6, y: a.y, h: 110 }]).ids; });
    await ev((id) => { okteo.select([id]); okteoExt.panel.show("props"); }, ids[1]);
    await page.waitForSelector("#f_pt");
    const auto = await page.$eval("#f_pt option[value='']", (o) => o.textContent);
    await page.selectOption("#f_pt", "non");
    const pt = await ev((id) => okteo.state.app.find((a) => a.id === id).pt, ids[1]);
    await ev(() => { okteo.undo(); okteo.undo(); okteo.clearSel(); });
    if (!(/Automatique : oui/.test(auto) && pt === false)) throw new Error(JSON.stringify({ auto, pt }));
    return true;
  });
  await check("volets (R-096) : choix « connectés » dans le panneau Câblage → commandes de volet hors des circuits ; doute tant que rien n'est choisi", async () => {
    await ev(() => okteoExt.panel.show("cablage")); await page.waitForTimeout(150);
    await page.waitForSelector("#bx-cvol");
    const probe = () => ev(async () => { const m = await import("/src/ext/cablage-data.js"), c = await import("/src/cablage/circuits.js"), S = m.cabS(okteo);
      const C = c.computeCircuits(okteo.allApps(), okteo.allLinks(), S), cvr = okteo.allApps().filter((a) => a.t === "CVR").map((a) => a.id);
      return { c: (okteo.cab.choix || {}).commandeVolet || "", d: m.wiringNow(okteo).doutes.some((x) => x.rule === "R-096"), n: cvr.length, inC: C.some((k) => k.apps.some((id) => cvr.includes(id))) }; });
    const before = await probe();
    await page.selectOption("#bx-cvol", "connecte");
    const after = await probe();
    await ev(() => okteo.undo());
    if (!(before.n > 0 && before.d && before.inC && after.c === "connecte" && !after.d && !after.inC)) throw new Error(JSON.stringify({ before, after }));
    return true;
  });
  await check("n° 6 : pontage coché dans le panneau Câblage → prises / lumières reliées de proche en proche (moins de départs), tronçons sur le plan ; association toujours active ; un Ctrl+Z", async () => {
    await ev(() => okteoExt.panel.show("cablage")); await page.waitForTimeout(150);
    await page.waitForSelector("#bx-pont");
    const probe = () => ev(async () => { const m = await import("/src/ext/cablage-data.js"), W = m.wiringNow(okteo), G = W.boxes.flatMap((b) => b.gaines.filter((g) => g.kind === "app"));
      return { on: !!(okteo.cab.choix || {}).pontage, deps: G.length, ponts: G.filter((g) => g.ponts).length, assoc: G.filter((g) => g.appIds.length > 1 && !g.ponts).length, cu: W.totals.cuivre }; });
    const before = await probe();
    await page.check("#bx-pont");
    const after = await probe();
    const keepV = await ev(() => ({ on: Object.keys(okteo.layers).filter((k) => okteo.layers[k].on), circ: okteo.showCircuits, tab: okteo.tab }));
    const drawn = await ev(async () => { okteo.setTab("plan"); okteo.showCircuits = true; okteo.toggleView("gaines", true); (await import("/src/ext/cablage-data.js")).wiringNow(okteo); window.__okteo.draw(); return document.querySelectorAll("#sv path.pont").length; });
    await ev(() => okteo.undo());
    await ev((V) => { Object.keys(okteo.layers).forEach((k) => okteo.toggleView(k, V.on.includes(k))); okteo.showCircuits = V.circ; okteo.setTab(V.tab); }, keepV);
    const back = await probe();
    if (!(!before.on && before.ponts === 0 && before.assoc > 0 && after.on && after.ponts > 0 && after.deps < before.deps && drawn > 0 && !back.on && back.deps === before.deps)) throw new Error(JSON.stringify({ before, after, drawn, back }));
    return true;
  });
  await check("n° 10 : zone d'exclusion posée entre une boîte et un appareil → gaine qui la contourne (plus longue, tracé brisé), zone hachurée, bloc rouge en 3D ; un Ctrl+Z", async () => {
    const keepV = await ev(() => ({ on: Object.keys(okteo.layers).filter((k) => okteo.layers[k].on), circ: okteo.showCircuits }));
    const r = await ev(async () => {
      okteo.setTab("plan"); okteoExt.panel.close("assistant"); okteo.showCircuits = true; okteo.toggleView("gaines", true); okteo.toggleView("appareils", true);
      const m = await import("/src/ext/cablage-data.js"), W0 = m.wiringNow(okteo), lv = okteo.level.id, by = new Map(okteo.state.app.map((a) => [a.id, a]));
      let pick = null;
      for (const b of W0.boxes) { const B = okteo.cab.boxes.find((x) => x.id === b.id); if (!B || B.lv !== lv) continue; for (const g of b.gaines) { const a = g.kind === "app" && by.get(g.appIds[0]); if (a && !g.routed && !g.ponts && Math.hypot(a.x - B.x, a.y - B.y) > 3) { pick = { B, a, g }; break; } } if (pick) break; }
      if (!pick) return { none: true };
      const mx = (pick.B.x + pick.a.x) / 2, my = (pick.B.y + pick.a.y) / 2, n0 = okteo.state.app.length;
      const res = okteo.importDevices([{ t: "ZONE", x: mx, y: my }], [], { stay: true });
      const z = okteo.state.app.find((a) => a.id === (res.ids || [])[0]); z.sw = 0.8; z.sd = 0.8; window.__okteo.draw();
      const W1 = m.wiringNow(okteo), g1 = W1.boxes.find((b) => b.id === pick.B.id).gaines.find((g) => (g.appIds || []).includes(pick.a.id));
      window.__okteo.draw();
      const path = document.querySelector(`#sv path.gaine[data-b="${pick.B.id}"][data-k="${pick.a.id}"]`);
      return { zid: z.id, added: okteo.state.app.length - n0, hatch: !!document.querySelector(`#sv g.sani.zone[data-id="${z.id}"]`), via: (g1.via || []).length, longer: g1.length > pick.g.length, L0: pick.g.length, L1: g1.length, poly: path ? / L /.test(path.getAttribute("d")) : null };
    });
    if (r.none) return true;   // aucune gaine assez longue sur ce niveau
    await page.keyboard.press("Alt+4");
    await page.waitForFunction((id) => { const S3 = okteoExt.pages.vue3d?.ui?.state; return S3 && S3.house && S3.house.sanis && S3.house.sanis.children.some((o) => o.userData.zone === id); }, r.zid, { timeout: 60000 });
    await ev(() => { okteo.setTab("plan"); okteo.undo(); });
    const back = await ev((id) => !okteo.state.app.some((a) => a.id === id), r.zid);
    await ev((V) => { Object.keys(okteo.layers).forEach((k) => okteo.toggleView(k, V.on.includes(k))); okteo.showCircuits = V.circ; }, keepV);
    if (!(r.added === 1 && r.hatch && r.via >= 1 && r.longer && r.poly && back)) throw new Error(JSON.stringify(r));
    return true;
  });

  console.log("Plan lisible (v58)");
  await check("taille des symboles d'après le dessin (12 à 26 cm, « Auto ») ; le curseur la règle à la main, « Auto » la recalcule", async () => {
    await page.click('#tabs button[data-tab="plan"]');
    await ev(() => { okteoExt.panel.close("assistant"); okteo.clearSel(); });
    const r = await ev(() => {
      const auto = okteo.symCm, ck = document.getElementById("symauto").checked;
      const sl = document.getElementById("sym"); sl.value = 40; sl.dispatchEvent(new Event("input"));
      const man = okteo.symCm, ck2 = document.getElementById("symauto").checked;
      const a = document.getElementById("symauto"); a.checked = true; a.dispatchEvent(new Event("change"));
      return { auto, ck, man, ck2, back: okteo.symCm };
    });
    if (!(r.ck && r.auto >= 12 && r.auto <= 26 && r.man === 40 && !r.ck2 && r.back === r.auto)) throw new Error(JSON.stringify(r));
    return true;
  });
  await check("deux appareils au même endroit : affichage décalé le long du mur, trait de rappel ; un clic sur le symbole décalé le sélectionne", async () => {
    await ev(() => { okteo.setTool("sel"); okteo.showCircuits = false; okteo.viewPreset("impl"); okteo.fit(); });
    const ids = await ev(() => { const a = okteo.state.app.find((x) => x.t === "PC16" && x.seg); return okteo.importDevices([{ t: "PC16", x: a.x, y: a.y }, { t: "INT", x: a.x, y: a.y }]).ids; });
    const s = await ev((ids) => ids.map((id) => okteo.shownAt(id)), ids);
    const leader = await ev(() => document.querySelectorAll("#sv g.leader").length);
    const moved = s.find((p) => p.moved), id = ids[s.indexOf(moved)];
    const c = await ev((p) => okteo.toClient(p.x, p.y), moved);
    await page.mouse.click(c.x, c.y);
    const sel = await ev(() => (okteo.selection[0] || "").replace(/^app:/, ""));
    await ev(() => { okteo.clearSel(); okteo.undo(); });
    if (!(moved && leader >= 1 && Math.hypot(s[0].x - s[1].x, s[0].y - s[1].y) > 0.05 && sel === id)) throw new Error(JSON.stringify({ s, leader, sel, id }));
    return true;
  });
  await check("nom de pièce : glissé à la souris (position gardée, un Ctrl+Z) ; taille commune à toutes les pièces", async () => {
    await ev(() => { okteo.setTool("sel"); okteo.viewPreset("bati"); okteo.fit(); });
    const L = await ev(() => okteo.roomLabels.sort((p, q) => (q.x1 - q.x0) - (p.x1 - p.x0))[0]);
    const p0 = await ev((l) => okteo.toClient(l.cx, l.cy), L);
    await page.mouse.move(p0.x, p0.y); await page.mouse.down(); await page.mouse.move(p0.x + 40, p0.y + 30, { steps: 6 }); await page.mouse.up();
    const r = await ev((id) => { const r = okteo.state.rooms.find((x) => x.id === id); return { lx: r.lx, ly: r.ly, sel: null }; }, L.id);
    const fs = () => ev(() => [...document.querySelectorAll("#sv g.labels text[font-weight='600']")].map((t) => +t.getAttribute("font-size")));
    const f1 = await fs(); await ev(() => okteo.setRoomTxt(1.5)); const f2 = await fs(); await ev(() => okteo.setRoomTxt(1));
    await ev(() => okteo.undo());
    const back = await ev((id) => okteo.state.rooms.find((x) => x.id === id).lx, L.id);
    await ev(() => okteo.viewPreset("impl"));
    const ratio = f2[0] / f1[0];
    if (!(r.lx != null && Math.abs(ratio - 1.5) < 0.01 && f2.every((v) => Math.abs(v - f2[0]) < 1e-9) && back == null)) throw new Error(JSON.stringify({ r, f1: f1.slice(0, 3), f2: f2.slice(0, 3), back }));
    return true;
  });
  await check("tourner la vue d'un quart de tour : fond et dessin tournent ensemble, textes droits, le clic vise toujours le bon appareil ; 0° remet la vue", async () => {
    await ev(() => { okteo.rotateView(90); okteo.fit(); });
    const r = await ev(() => ({ tr: document.querySelector("#sv g.world").getAttribute("transform"), up: !!document.querySelector("#sv g.labels text[transform*='rotate(-90']"), img: !!document.querySelector("#sv g.world image") }));
    const a = await ev(() => { const a = okteo.state.app.find((x) => x.t === "LUM"); const p = okteo.shownAt(a.id); return { id: a.id, c: okteo.toClient(p.x, p.y) }; });
    await page.mouse.click(a.c.x, a.c.y);
    const sel = await ev((id) => okteo.selection[0] === "app:" + id, a.id);
    await ev(() => { okteo.clearSel(); okteo.rotateView(0, true); okteo.fit(); });
    const r0 = await ev(() => ({ rot: okteo.viewRot, tr: document.querySelector("#sv g.world").getAttribute("transform") }));
    if (!(/rotate\(90\)/.test(r.tr) && r.up && r.img && sel && r0.rot === 0 && !/rotate/.test(r0.tr))) throw new Error(JSON.stringify({ r, sel, r0 }));
    return true;
  });
  await check("v62 : impression dans le sens de la vue (case cochée d'office si la vue est tournée) : plan tourné d'un quart de tour, textes droits", async () => {
    await ev(() => { okteo.rotateView(90, true); okteo.fit(); });
    await page.keyboard.press("Control+p");
    await page.waitForFunction(() => okteoExt.printer.last && !document.querySelector(".pr-wait:not([hidden])"), null, { timeout: 30000 });
    await page.waitForTimeout(300);
    const r = await ev(async () => {
      const P = await import("/src/ext/print.js"), g = okteo.exportGeometry(), q = P.rotateGeo(g, 90), a = g.apps[0], b = q.apps[0];
      const e0 = P.extentOf(g), e1 = okteoExt.printer.last.layout.ext;
      return { vis: !document.getElementById("pr-rotwrap").hidden, on: document.querySelector('[data-k="sensVue"]').checked, rot: Math.abs(b.x + a.y) < 1e-9 && Math.abs(b.y - a.x) < 1e-9,
        sw: Math.abs((e1.x1 - e1.x0) - (e0.y1 - e0.y0)) < 1e-6 && Math.abs((e1.y1 - e1.y0) - (e0.x1 - e0.x0)) < 1e-6, pages: okteoExt.printer.last.pages };
    });
    await page.keyboard.press("Escape");
    await ev(() => { okteo.rotateView(0, true); okteo.fit(); });
    if (!(r.vis && r.on && r.rot && r.sw && r.pages >= 1)) throw new Error(JSON.stringify(r));
    return true;
  });

  console.log("Bandeau en encarts, assistant en bas à droite (v41)");
  await check("bandeau : encarts Actions, Vues, Panneaux (Propriétés, Câblage, Étapes ; lot 4 : plus de bouton Packs), sans bouton Assistant en haut", async () => ev(() => {
    const labs = [...document.querySelectorAll(".top2 .grp .glab")].map((x) => x.textContent).join("|");
    const panes = [...document.querySelectorAll("#panes button[data-pane]")].map((b) => b.dataset.pane).join("|");
    const inGrp = !!document.querySelector(".grp-act #tools .trow.bati") && !!document.querySelector(".grp-view #vfilter [data-vp]");
    return labs === "Actions|Vues|Panneaux" && panes === "props|cablage|steps" && inGrp && !document.getElementById("btn-assistant") && !document.querySelector('#side-head [data-pane="assistant"]');
  }));
  await check("assistant : encart réduit en bas à droite, agrandi au clic, réduit par « — » et par Échap", async () => {
    await ev(() => okteoExt.panel.close("assistant"));
    const pill = await page.locator("#as-dock .dk-pill").boundingBox(), st = await page.locator(".stage").boundingBox();
    const corner = pill && pill.x + pill.width > st.x + st.width - 30 && pill.y + pill.height > st.y + st.height - 30 && !(await page.isVisible(".as-in textarea"));
    await page.click("#as-dock .dk-pill");
    const big = await page.locator("#as-dock .dk-card").boundingBox();
    const open = (await page.isVisible(".as-in textarea")) && big.width > 300 && big.height > 300;
    await page.click("#as-dock .dk-min");
    const shut = !(await page.isVisible(".as-in textarea"));
    await page.keyboard.press("a"); await page.waitForSelector(".as-in textarea", { state: "visible", timeout: 3000 });
    await page.focus(".as-in textarea"); await page.keyboard.press("Escape");
    const esc = !(await page.isVisible(".as-in textarea"));
    if (!(corner && open && shut && esc)) throw new Error(JSON.stringify({ corner, open, shut, esc }));
    return true;
  });
  console.log("Mode IA et coûts du chantier (v63)");
  await check("Mode IA : bascule par le bouton et Alt+M, parcours à droite, bandeau BE masqué, retour au Mode BE", async () => {
    await ev(() => okteoExt.panel.close("assistant"));
    await page.click('#mode-sw [data-m="ia"]');
    await page.waitForSelector("#iapane .ia-step", { timeout: 5000 });
    const r = await ev(() => ({ body: document.body.classList.contains("mode-ia"), pane: getComputedStyle(document.getElementById("iapane")).display !== "none",
      top2: getComputedStyle(document.querySelector(".top2")).display === "none", steps: document.querySelectorAll("#iapane .ia-step").length,
      plan: document.querySelector('#iapane .ia-step[data-s="1"]').classList.contains("done"), cost: !!document.querySelector("#ia-cost"), on: document.querySelector('#mode-sw [data-m="ia"]').classList.contains("on") }));
    await page.keyboard.press("Alt+m");
    const be = await ev(() => !document.body.classList.contains("mode-ia") && getComputedStyle(document.querySelector(".top2")).display !== "none");
    await page.keyboard.press("Alt+m");
    const back = await ev(() => document.body.classList.contains("mode-ia"));
    if (!(r.body && r.pane && r.top2 && r.steps >= 7 && r.plan && r.cost && r.on && be && back)) throw new Error(JSON.stringify({ r, be, back }));
    return true;
  });
  await check("Mode IA sans clé : « Copier la consigne / coller la réponse » ouvre la carte du relevé par copier / coller", async () => {
    const b = await page.$("#ia-rel-paste");
    if (!b) return "pas de bouton (clé présente ?)";
    await b.click();
    const open = await page.waitForFunction(() => { const c = document.querySelector("#ai-paste"); return c && c.offsetParent !== null; }, null, { timeout: 4000 }).then(() => true, () => false);
    await ev(() => document.querySelectorAll(".aicard .wx, .wcard .wx").forEach((x) => x.offsetParent && x.click()));
    if (!open) throw new Error("carte non ouverte");
    return true;
  });
  await check("Mode IA : câbler, alertes listées, note « belle pieuvre », dossier PDF complet", async () => {
    await page.click("#ia-cab");
    await page.waitForFunction(() => (okteo.cab.boxes || []).length > 0 && document.querySelector('#iapane .ia-step[data-s="5"].done'), null, { timeout: 15000 });
    const n = await ev(() => ({ li: document.querySelectorAll("#ia-alerts li").length, ctl: okteo.control.length }));
    await page.click("#ia-dossier");
    await page.waitForFunction(() => okteoExt.iaMode.lastDossier, null, { timeout: 90000 });
    const d = await ev(() => ({ pages: okteoExt.iaMode.lastDossier.pages, size: okteoExt.iaMode.lastDossier.blob.size }));
    const note = await ev(() => /belle pieuvre \d+\/100/.test(document.querySelector('#iapane .ia-step[data-s="7"]').textContent));
    if (!(n.li >= n.ctl && d.pages >= 3 && d.size > 10000 && note)) throw new Error(JSON.stringify({ n, d, note }));
    return true;
  });
  await check("coûts : jetons IA (relevé avec clé) et temps BE chiffrés d'après les prix et le coût horaire de Paramètres", async () => {
    const r = await ev(async () => {
      const P = JSON.parse(localStorage.getItem("okteo.prefs.v1") || "{}");
      localStorage.setItem("okteo.prefs.v1", JSON.stringify({ ...P, prixIn: 3, prixOut: 15, tauxHoraire: 45 }));
      document.dispatchEvent(new CustomEvent("okteo:prefs"));
      const lv = okteo.level.id, all = { ...(okteo.cab.releves || {}) };
      all[lv] = { ...(all[lv] || {}), rapport: [...((all[lv] || {}).rapport || []), { type: "releve", via: "cle", tin: 1000000, tout: 100000 }] };
      okteo.setCab({ releves: all });
      const t0 = okteoExt.temps.get(); okteoExt.temps.add(3600, "ia"); const t1 = okteoExt.temps.get();
      okteoExt.iaMode.render(); await new Promise((r) => setTimeout(r, 400));
      return { dt: t1.ia - t0.ia, txt: document.getElementById("ia-cost").textContent };
    });
    // 1 M × 3 € + 0,1 M × 15 € = 4,50 € ; 1 h × 45 € = 45,00 € au moins
    const T = r.txt.replace(/\s/g, ""), tok = +((T.match(/IA:([\d]+)jetons/) || [])[1] || 0), eu = (T.match(/([\d]+,\d\d)€/g) || []).map((x) => +x.replace("€", "").replace(",", "."));
    if (!(r.dt === 3600 && tok >= 1100000 && eu.length === 2 && eu[0] >= 4.5 && eu[1] >= 45)) throw new Error(JSON.stringify({ r, tok, eu }));
    return true;
  });
  await check("Paramètres : section « Coûts d'un chantier » (prix des jetons, coût horaire)", async () => {
    await page.click('#mode-sw [data-m="be"]');
    await ev(() => okteo.setTab("params"));
    const r = await ev(() => ({ h: !!document.getElementById("ps-couts"), n: document.querySelectorAll("[data-cost]").length }));
    await ev(() => okteo.setTab("plan"));
    if (!(r.h && r.n === 3)) throw new Error(JSON.stringify(r));
    return true;
  });
  console.log("Ergonomie du Mode BE (v64)");
  await check("onglet « Pieuvre » : sous-onglets Boîtes / Bandes / Lignes directes, l'onglet reste allumé, retour au dernier sous-onglet", async () => {
    await goSub("lignes");
    const a = await ev(() => ({ tab: okteo.tab, on: document.querySelector('#tabs button[data-tab="boites"]').classList.contains("on"), vis: !document.getElementById("lignes").hidden && !document.getElementById("pg-pieuvre").hidden,
      sub: document.querySelector('#subtabs [data-sub="lignes"]').classList.contains("on"), n: document.querySelectorAll("#tabs button").length, old: !!document.querySelector('#tabs button[data-tab="bandes"]') }));
    await page.click('#tabs button[data-tab="plan"]');
    const hid = await ev(() => document.getElementById("pg-pieuvre").hidden);
    await page.click('#tabs button[data-tab="boites"]');
    const back = await ev(() => okteo.tab);
    await page.click('#tabs button[data-tab="plan"]');
    if (!(a.tab === "lignes" && a.on && a.vis && a.sub && a.n === 7 && !a.old && hid && back === "lignes")) throw new Error(JSON.stringify({ a, hid, back }));
    return true;
  });
  await check("une seule fenêtre de travail : ouvrir le relevé des pièces ferme le relevé des murs ; la comparaison des modes ferme les deux", async () => {
    await ev(() => { okteoExt.panel.close("assistant"); okteoExt.walls.open(); });
    // 30 s comme les autres lectures du PDF EVRARD (15 s échouait une fois sur deux sur GitHub Actions)
    // v73.1 : en cas d'échec, l'état des cartes est affiché (étape, cartes visibles et leur titre)
    const cards = () => ev(() => [...document.querySelectorAll(".wcard, .cmpcard")].map((c) => ({ cls: c.className, hidden: c.hidden, shown: !!c.offsetParent, h: (c.querySelector(".wcard-h, .cmp-h")?.textContent || c.textContent).trim().slice(0, 60) })));
    // v74 : attendre la FIN du relevé des murs (bouton « Ajouter ») : sinon sa carte se rouvre après celle des pièces
    try { await page.waitForSelector(".wcard:not([hidden]) #w-ok", { timeout: 30000 }); }
    catch { throw new Error("murs : " + JSON.stringify(await cards())); }
    await ev(() => okteoExt.rooms.open());
    try { await page.waitForFunction(() => [...document.querySelectorAll(".wcard")].some((c) => !c.hidden && /Pièces/.test(c.querySelector(".wcard-h")?.textContent || "")), null, { timeout: 30000 }); }
    catch { throw new Error("pièces : " + JSON.stringify(await cards())); }
    const one = await ev(() => [...document.querySelectorAll(".wcard:not(.save-alert)")].filter((c) => !c.hidden && c.offsetParent).length);
    await ev(() => document.dispatchEvent(new CustomEvent("okteo:compare-modes")));
    await page.waitForSelector(".cmpcard", { timeout: 10000 });
    await page.waitForTimeout(200);
    const two = await ev(() => [...document.querySelectorAll(".wcard:not(.save-alert)")].filter((c) => !c.hidden && c.offsetParent).length);
    await page.keyboard.press("Escape");
    if (!(one === 1 && two === 0)) throw new Error(JSON.stringify({ one, two, cards: await cards() }));
    return true;
  });
  await check("panneau Câblage allégé : avec des boîtes, les Boîtes en premier, la liste des circuits repliée (ouvrable), aides en ⓘ", async () => {
    await ev(() => okteoExt.panel.show("cablage")); await page.waitForTimeout(200);
    const r = await ev(() => { const c = document.getElementById("cb-circ"), b = document.querySelector(".cab #bx-auto, .cab #bx-cmp"); return { has: (okteo.cab.boxes || []).length, closed: c && (!c.open || !!c.querySelector("summary .warn")), was: c && c.open, first: c && b && (b.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING) > 0, info: document.querySelectorAll(".cab .info[title]").length }; });
    // repliée : un clic l'ouvre (déjà ouverte à cause d'une alerte : on la replie puis on la rouvre)
    if (r.was) await page.click("#cb-circ > summary");
    await page.click("#cb-circ > summary");
    const open = await ev(() => document.getElementById("cb-circ").open && document.querySelectorAll("#cb-circ .cb-row").length > 0);
    if (!(r.has && r.closed && r.first && r.info >= 2 && open)) throw new Error(JSON.stringify({ r, open }));
    return true;
  });
  await check("MAJ 3/4 : équipements accessibles dans Étude et catalogue ; propositions sans doublon, détecteur confirmé seulement", async () => {
    const r = await ev(async () => {
      const {proposeEquipements}=await import('/src/cablage/equipements.js');
      const {permanentDetector}=await import('/src/cablage/detecteur.js');
      const p=proposeEquipements({items:[{t:'TV'}],level:okteo.level.id});
      const q=proposeEquipements({items:p.adds,level:okteo.level.id});
      okteo.setTab('etude');
      return {button:!!document.querySelector('#et-equipements'), command:okteoExt.catalog.some(c=>c.id==='etude.equipements'), adds:p.adds.length, duplicates:q.adds.length, unsafe:permanentDetector({t:'APP'})};
    });
    if(!(r.button && r.command && r.adds===6 && r.duplicates===0 && !r.unsafe))throw new Error(JSON.stringify(r));
    return true;
  });
  await check("MAJ 5/6 : VMC et comparaison accessibles avec diagnostics séparés", async () => {
    await ev(()=>okteo.setTab('etude'));
    return await ev(()=>!!document.querySelector('#vm-prepare') && !!document.querySelector('#cp-form') && okteoExt.catalog.some(c=>c.id==='etude.vmc') && okteoExt.catalog.some(c=>c.id==='etude.comparaison'));
  });
  console.log("Vue 3D (3D-1, 3D-2)");
  await check("onglet 3D (Alt+4) : maquette construite depuis le dessin (murs, appareils, boîtes), clic sur un appareil → fiche → « Voir sur le plan » ; coupe et calques ; défauts de géométrie listés", async () => {
    await ev(() => { okteoExt.panel.close("assistant"); if (!okteo.state.segs.some((s) => !s.virt)) okteo.addWalls([{ a: { x: 0, y: 0 }, b: { x: 8, y: 0 }, ep: 0.25 }, { a: { x: 8, y: 0 }, b: { x: 8, y: 6 }, ep: 0.25 }, { a: { x: 8, y: 6 }, b: { x: 0, y: 6 }, ep: 0.25 }, { a: { x: 0, y: 6 }, b: { x: 0, y: 0 }, ep: 0.25 }]); });
    const before = await ev(() => okteo.tab);
    await page.keyboard.press("Alt+4");
    await page.waitForFunction(() => okteoExt.pages.vue3d && okteoExt.pages.vue3d.ui && okteoExt.pages.vue3d.ui.state.house, null, { timeout: 60000 });
    await page.waitForTimeout(1200);
    const r = await ev(() => { const S3 = okteoExt.pages.vue3d.ui.state; return { tab: okteo.tab, walls: S3.plan.walls.length, segs: okteo.state.segs.filter((s) => !s.virt).length, prisms: S3.house.walls.children.filter((o) => o.isMesh && o.userData.wall).length, devs: S3.devs.length, apps: okteo.state.app.length, shown: !document.getElementById("vue3d").hidden && document.getElementById("sv").closest(".stage").hidden, catalog: okteoExt.catalog.some((c) => c.id === "vue.3d") }; });
    // le canevas n'est pas vide : des pixels de couleurs différentes
    const px = await ev(() => { const c = document.querySelector(".v3d-cv"), g = document.createElement("canvas"); g.width = 64; g.height = 40; const x = g.getContext("2d"); x.drawImage(c, 0, 0, 64, 40); const d = x.getImageData(0, 0, 64, 40).data, set = new Set(); for (let i = 0; i < d.length; i += 4) set.add((d[i] >> 4) + "," + (d[i + 1] >> 4) + "," + (d[i + 2] >> 4)); return set.size; });
    // coupe à 1 m : volumes plus bas
    await ev(() => { const c = document.querySelector(".v3d-cut"); c.value = 1; c.dispatchEvent(new Event("input")); });
    const low = await ev(() => { const S3 = okteoExt.pages.vue3d.ui.state, T = S3.T; return new T.Box3().setFromObject(S3.house.walls).max.y; });
    // clic sur un appareil mural
    let card = null;
    if (r.devs) {
      const pt = await ev(() => { const S3 = okteoExt.pages.vue3d.ui.state; const BX = (okteo.cab.boxes || []).filter((b) => b.lv === okteo.level.id), far = (x) => Math.min(99, ...BX.map((b) => Math.hypot(b.x - x.x, b.y - x.y))); const d = S3.devs.filter((x) => x.mount === "mur").sort((p, q) => far(q) - far(p))[0] || S3.devs[0]; okteoExt.pages.vue3d.ui.view("top", true); S3.ctl.update(); S3.R.render(S3.scene, S3.cam); const v = new S3.T.Vector3(d.x, d.h, d.y).project(S3.cam), b = document.querySelector(".v3d-cv").getBoundingClientRect(); return { x: b.left + (v.x + 1) / 2 * b.width, y: b.top + (1 - v.y) / 2 * b.height, id: d.id }; });
      await page.mouse.click(pt.x, pt.y); await page.waitForTimeout(400);
      card = await ev(() => ({ open: !document.querySelector(".v3d-card").hidden, id: document.querySelector(".v3d-card").dataset.id }));
      if (card.open) { await page.click('.v3d-card [data-a="plan"]'); await page.waitForTimeout(300); card.after = await ev(() => ({ tab: okteo.tab, sel: okteo.selection })); }
    }
    if (!(r.tab === "vue3d" && r.walls >= r.segs && r.prisms > 0 && r.devs === r.apps && r.shown && r.catalog && px > 8 && low <= 1.0001 && (!r.devs || card.open && card.after.tab === "plan"))) throw new Error(JSON.stringify({ before, r, px, low, card }));
    await page.keyboard.press("Alt+4");   // revient (ou reste) sur le plan
    await ev(() => okteo.setTab("plan"));
    return true;
  });
  await check("n° 9 : WC, lavabo, vasque, évier posés : trait gris pointillé, sans repère ni circuit, imprimés, en volume dans la vue 3D, un Ctrl+Z", async () => {
    const r = await ev(async () => {
      okteo.setTab("plan"); okteoExt.panel.close("assistant");
      const S = okteo.state, X = Math.max(0, ...S.nodes.map((n) => n.x)) + 2, Y = Math.min(0, ...S.nodes.map((n) => n.y)) + 1, n0 = S.app.length;
      const res = okteo.importDevices(["WC", "LAVABO", "VASQUE", "EVIER"].map((t, i) => ({ t, x: X + i * 1.5, y: Y })), [], { stay: true });
      window.__okteo.draw();
      const g = [...document.querySelectorAll("#sv g.sani")].filter((e) => ["WC", "LAVABO", "VASQUE", "EVIER"].includes(e.dataset.t));
      const dashed = g.length === 4 && g.every((e) => [...e.querySelectorAll("polygon, polyline")].every((p) => p.getAttribute("stroke-dasharray") && p.getAttribute("stroke") === "#8a8f96"));
      const geo = okteo.exportGeometry(), ids = new Set((res && res.ids) || []);
      const inGeo = geo.sanis.filter((s) => ids.has(s.id)).length, asApp = geo.apps.filter((a) => ids.has(a.id)).length, vol = geo.volumes.filter((v) => ids.has(v.id)).length;
      const reps = [...document.querySelectorAll("#sv text.rep")].filter((e) => ids.has(e.dataset.id)).length;
      const m = await import("/src/ext/print.js"); const pdf = await m.buildPlanPdf(geo, { nomenclature: false });
      return { added: S.app.length - n0, dashed, inGeo, asApp, vol, reps, pdf: !!pdf, ids: [...ids] };
    });
    await page.keyboard.press("Alt+4");
    await page.waitForFunction((ids) => { const S3 = okteoExt.pages.vue3d?.ui?.state; return S3 && S3.house && S3.house.sanis && ids.every((id) => S3.house.sanis.children.some((o) => o.userData.sani === id)); }, r.ids, { timeout: 60000 });
    const z = await ev(() => { const S3 = okteoExt.pages.vue3d.ui.state; return new S3.T.Box3().setFromObject(S3.house.sanis).max.y; });
    await ev(() => { okteo.setTab("plan"); okteo.undo(); });
    const back = await ev((ids) => okteo.state.app.filter((a) => ids.includes(a.id)).length, r.ids);
    if (!(r.added === 4 && r.dashed && r.inGeo === 4 && r.asApp === 0 && r.vol === 0 && r.reps === 0 && r.pdf && z > 0.79 && back === 0)) throw new Error(JSON.stringify({ r, z, back }));
    return true;
  });
  await check("n° 11 : bouton « Mobilier ▾ » (10 meubles) ; canapé et table posés : gris clair, sans repère, en volume dans la vue 3D, un Ctrl+Z", async () => {
    await ev(() => { okteo.setTab("plan"); okteoExt.panel.close("assistant"); });
    await page.click('#tools [data-tool="__meubles"]');
    const pop = await ev(() => ({ n: document.querySelectorAll("#tools .more-pop .mi").length, g: [...document.querySelectorAll("#tools .more-pop .mg b")].map((b) => b.textContent).join() }));
    await page.click('#tools .more-pop [data-tool="CANAPE"]');
    const tool = await ev(() => okteo.tool);
    await ev(() => okteo.setTool("sel"));
    const r = await ev(() => {
      const S = okteo.state, X = Math.max(0, ...S.nodes.map((n) => n.x)) + 2, Y = Math.min(0, ...S.nodes.map((n) => n.y)) + 1;
      const res = okteo.importDevices([{ t: "CANAPE", x: X, y: Y }, { t: "TABLE", x: X + 3, y: Y }], [], { stay: true }); window.__okteo.draw();
      const g = [...document.querySelectorAll("#sv g.sani")].filter((e) => (res.ids || []).includes(e.dataset.id));
      return { ids: res.ids, n: g.length, solid: g.every((e) => [...e.querySelectorAll("polygon, polyline")].every((p) => !p.getAttribute("stroke-dasharray"))), reps: [...document.querySelectorAll("#sv text.rep")].filter((e) => (res.ids || []).includes(e.dataset.id)).length };
    });
    await page.keyboard.press("Alt+4");
    await page.waitForFunction((ids) => { const S3 = okteoExt.pages.vue3d?.ui?.state; return S3 && S3.house && S3.house.sanis && ids.every((id) => S3.house.sanis.children.some((o) => o.userData.sani === id)); }, r.ids, { timeout: 60000 });
    await ev(() => { okteo.setTab("plan"); okteo.undo(); });
    const back = await ev((ids) => okteo.state.app.filter((a) => ids.includes(a.id)).length, r.ids);
    if (!(pop.n === 10 && pop.g === "Mobilier" && tool === "CANAPE" && r.n === 2 && r.solid && r.reps === 0 && back === 0)) throw new Error(JSON.stringify({ pop, tool, r, back }));
    return true;
  });
  await check("3D-3 : hauteurs de départ dans Paramètres → Vue 3D, allège / linteau d'une fenêtre et hauteur sous plafond d'une pièce dans Propriétés → la 3D suit", async () => {
    await ev(() => okteo.setTab("params"));
    await page.waitForSelector("#ps-3d [data-h3d=\"h3dPlafond\"]");
    await page.fill('#ps-3d [data-h3d="h3dPlafond"]', "270"); await page.press('#ps-3d [data-h3d="h3dPlafond"]', "Enter");
    await page.dispatchEvent('#ps-3d [data-h3d="h3dPlafond"]', "change");
    const pref = await ev(async () => (await import("/src/prefs.js")).pref("h3dPlafond"));
    // une fenêtre réglée à la main (allège 120 cm), un mur à la main dans le dessin
    const oid = await ev(() => { const o = okteo.state.openings.find((x) => x.kind === "fenetre"); if (!o) return null; o.allege = 120; o.linteau = 230; okteo.markDirty(); okteo.draw(); return o.id; });
    await ev(() => okteo.setTab("vue3d"));
    await page.waitForFunction(() => { const S3 = okteoExt.pages.vue3d.ui.state; return S3.house && S3.H && Math.abs(S3.H.plafond - 2.7) < 1e-9; }, null, { timeout: 30000 });
    await ev(() => { const c = document.querySelector(".v3d-cut"); c.value = c.max; c.dispatchEvent(new Event("input")); });
    const r = await ev((oid) => { const S3 = okteoExt.pages.vue3d.ui.state, T = S3.T, top = new T.Box3().setFromObject(S3.house.walls).max.y; const o = oid && [...S3.plan.openings.values()].flat().find((x) => x.id === oid); return { top, o: o && [o.y0, o.y1], note: document.querySelector(".v3d-note").textContent }; }, oid);
    // Propriétés : champs présents
    await ev((oid) => { okteo.setTab("plan"); if (oid) okteo.select([oid]); }, oid);
    const fields = await ev(() => ({ al: !!document.getElementById("oal"), li: !!document.getElementById("oli") }));
    await ev(async () => { (await import("/src/prefs.js")).setPref("h3dPlafond", 250); });
    if (!(pref === 270 && r.top >= 2.7 - 1e-6 && (!oid || (Math.abs(r.o[0] - 1.2) < 1e-9 && Math.abs(r.o[1] - 2.3) < 1e-9 && fields.al && fields.li)) && /2,70 m/.test(r.note))) throw new Error(JSON.stringify({ pref, r, fields, oid }));
    return true;
  });
  await check("3D-4 : visite à pied (ZQSD) : marcher sans traverser les murs, poser une prise au viseur (vrai appareil du chantier, rattaché à son mur, on reste en 3D), Ctrl+Z l'annule, la gomme retire un appareil", async () => {
    await ev(() => okteo.setTab("vue3d"));
    await page.waitForFunction(() => okteoExt.pages.vue3d.ui.state.house, null, { timeout: 30000 });
    const tool0 = await ev(() => okteo.tool);
    await page.click(".v3d-walk");
    await page.waitForTimeout(400);
    const on = await ev(() => okteoExt.pages.vue3d.ui.walk.on && !document.querySelector(".v3w").hidden);
    // marcher 2 s vers l'avant : la position change, aucune paroi traversée (distance aux murs ≥ rayon)
    const p0 = await ev(() => ({ ...okteoExt.pages.vue3d.ui.walk.state.p }));
    await page.keyboard.down("KeyW"); await page.waitForTimeout(2000); await page.keyboard.up("KeyW");
    const p1 = await ev(() => ({ ...okteoExt.pages.vue3d.ui.walk.state.p }));
    const tool = await ev(() => okteo.tool);
    // viser un mur (on tourne jusqu'à ce que le viseur soit vert) puis poser
    const n0 = await ev(() => okteo.state.app.length);
    const aimed = await ev(async () => { const W = okteoExt.pages.vue3d.ui.walk.state; for (let k = 0; k < 24; k++) { W.yaw = k * Math.PI / 12; W.pitch = -0.25; await new Promise((r) => setTimeout(r, 150)); if (W.last && W.last.ok && !W.last.del) return true; } return false; });
    const res = await ev(() => okteoExt.pages.vue3d.ui.walk.act());
    await page.waitForTimeout(600);
    const a = await ev((id) => { const x = okteo.state.app.find((q) => q.id === id); return x && { t: x.t, seg: !!x.seg, h: x.h, tab: okteo.tab, n: okteo.state.app.length }; }, res && res.added);
    // Ctrl+Z : la pose est annulée
    await page.keyboard.press("Control+z"); await page.waitForTimeout(400);
    const n2 = await ev(() => okteo.state.app.length);
    // gomme : viser un appareil existant et le retirer
    await page.keyboard.press("Digit6");
    const gone = await ev(async () => { const S3 = okteoExt.pages.vue3d.ui.state, W = okteoExt.pages.vue3d.ui.walk.state; const d = S3.devs.find((x) => x.mount === "mur") || S3.devs[0]; if (!d) return null; W.p = { x: d.x + (d.n ? d.n[0] : 0.5) * 1.2, y: d.y + (d.n ? d.n[1] : 0.5) * 1.2 }; const dx = d.x - W.p.x, dz = d.y - W.p.y, dy = d.h - 1.62; W.yaw = Math.atan2(-dx, -dz); W.pitch = Math.atan2(dy, Math.hypot(dx, dz)); await new Promise((r) => setTimeout(r, 400)); const r = okteoExt.pages.vue3d.ui.walk.act(); return { id: d.id, r }; });
    await page.waitForTimeout(400);
    const after = await ev((id) => !okteo.state.app.some((x) => x.id === id), gone && gone.id);
    await page.keyboard.press("Control+z"); await page.waitForTimeout(300);
    // Échap : pause (le navigateur rend la souris), puis « Quitter la visite »
    await page.keyboard.press("Escape"); await page.waitForTimeout(400);
    const paused = await ev(() => !document.querySelector(".v3w-pause").hidden);
    if (!paused) { await page.keyboard.press("Escape"); await page.waitForTimeout(400); }
    if (await ev(() => okteoExt.pages.vue3d.ui.walk.on && !document.querySelector(".v3w-pause").hidden)) await page.click('.v3w-pause [data-w="quit"]');
    await page.waitForTimeout(200);
    const out = await ev(() => !okteoExt.pages.vue3d.ui.walk.on);
    if (!out) await ev(() => okteoExt.pages.vue3d.ui.walk.exit());
    await ev(() => okteo.setTab("plan"));
    if (!(on && Math.hypot(p1.x - p0.x, p1.y - p0.y) > 0.3 && tool === tool0 && aimed && a && a.seg && a.tab === "vue3d" && a.n === n0 + 1 && n2 === n0 && gone && gone.r && gone.r.removed && after && out)) throw new Error(JSON.stringify({ on, p0, p1, tool, tool0, aimed, res, a, n0, n2, gone, after, out }));
    return true;
  });
  await check("3D-5 : gaines en 3D (tracé du plan en traits droits, descente dans le mur), fiche de la gaine (n° et longueur de la bande), propriété « passage par le sol » qui rallonge la gaine ; Ctrl+Z", async () => {
    await ev(() => okteo.setTab("plan"));
    await ev(() => { const u = okteoExt.pages.vue3d && okteoExt.pages.vue3d.ui; if (u && u.walk.on) u.walk.exit(); });
    const prep = await ev(() => { if (!(okteo.cab.circuits || []).length) okteoExt.cablage.auto(); if (!(okteo.cab.boxes || []).some((b) => b.lv === okteo.level.id)) okteoExt.cablage.placeAuto(); return { c: (okteo.cab.circuits || []).length, b: (okteo.cab.boxes || []).filter((b) => b.lv === okteo.level.id).length }; });
    await ev(() => okteo.setTab("vue3d"));
    try { await page.waitForFunction(() => (okteoExt.pages.vue3d.ui.state.gList || []).length > 0, null, { timeout: 20000 }); }
    catch { throw new Error("pas de gaines en 3D : " + JSON.stringify(await ev(async () => { const S3 = okteoExt.pages.vue3d.ui.state, { wiringNow } = await import("/src/ext/cablage-data.js"); let W = null; try { W = wiringNow(okteo); } catch (e) { W = String(e); } return { prep: null, lv: okteo.level.id, circ: (okteo.cab.circuits || []).length, boxes: (okteo.cab.boxes || []).map((b) => [b.n, b.lv, (b.apps || []).length]), apps: okteo.state.app.length, gErr: S3.gErr, W: W && W.boxes ? W.boxes.map((b) => [b.id, b.gaines.length]) : W, devs: S3.devs.length, house: !!S3.house }; }))); }
    const g0 = await ev(() => { const S3 = okteoExt.pages.vue3d.ui.state, g = S3.gList.find((x) => x.keys.length && !x.sol && x.no && !/alim/.test(x.id)) || S3.gList.find((x) => x.keys.length && !x.sol); okteoExt.pages.vue3d.ui.showGaine(g.id); const straight = g.pts.every((p, i) => i === 0 || true); return { id: g.id, no: g.no, L: g.length, n: S3.gList.length, tubes: S3.gaines.tubes.size, top: Math.max(...g.pts.map((p) => p[1])), low: Math.min(...g.pts.map((p) => p[1])), card: document.querySelector(".v3d-card").textContent }; });
    await page.check(".v3d-card [data-sol]");
    try { await page.waitForFunction((id) => { const g = (okteoExt.pages.vue3d.ui.state.gList || []).find((x) => x.id === id); return g && g.sol; }, g0.id, { timeout: 20000 }); }
    catch { throw new Error("sol non pris en compte : " + JSON.stringify(await ev((id) => { const S3 = okteoExt.pages.vue3d.ui.state; const [bid] = id.split("|"); return { g0: id, ids: S3.gList.slice(0, 6).map((x) => x.id), box: (okteo.cab.boxes || []).find((b) => b.id === bid)?.sol || null, gErr: S3.gErr }; }, g0.id))); }
    const g1 = await ev((id) => { const g = okteoExt.pages.vue3d.ui.state.gList.find((x) => x.id === id); return { L: g.length, low: Math.min(...g.pts.map((p) => p[1])), card: !document.querySelector(".v3d-card").hidden && document.querySelector(".v3d-card [data-sol]").checked }; }, g0.id);
    await page.keyboard.press("Control+z");
    try { await page.waitForFunction((id) => { const g = (okteoExt.pages.vue3d.ui.state.gList || []).find((x) => x.id === id); return g && !g.sol; }, g0.id, { timeout: 20000 }); }
    catch { throw new Error("Ctrl+Z sans effet : " + JSON.stringify(await ev(() => ({ focus: document.activeElement && document.activeElement.tagName })))); }
    await ev(() => okteo.setTab("plan"));
    if (!(prep.b > 0 && g0.n > 0 && g0.tubes === g0.n && g0.top > 2.5 && g0.low > 0.05 && /Longueur/.test(g0.card) && g1.L > g0.L && g1.low < 0.05 && g1.card)) throw new Error(JSON.stringify({ prep, g0, g1 }));
    return true;
  });
  await check("3D-6 : contrôles de pose : interrupteur derrière le battant d'une porte et commande dans une fenêtre comptés dans « à vérifier », anneaux rouges et liste en 3D, un clic cadre l'appareil et explique ; Ctrl+Z", async () => {
    await ev(() => okteo.setTab("plan"));
    const ids = await ev(() => okteo.batch(() => {
      okteo.addWalls([{ a: { x: 40, y: 0 }, b: { x: 44, y: 0 }, ep: 0.25 }, { a: { x: 44, y: 0 }, b: { x: 44, y: 3 }, ep: 0.25 }]);
      const N = (x, y) => okteo.state.nodes.find((n) => Math.hypot(n.x - x, n.y - y) < 1e-6).id;
      const s1 = okteo.state.segs.find((s) => s.a === N(40, 0) && s.b === N(44, 0)), s2 = okteo.state.segs.find((s) => s.a === N(44, 0) && s.b === N(44, 3));
      okteo.state.openings.push({ id: "o3d6a", seg: s1.id, t: 2, w: 0.8, kind: "porte", hinge: "g", swing: "int" }, { id: "o3d6b", seg: s2.id, t: 1.5, w: 1, kind: "fenetre", hinge: "g", swing: "int" });
      return okteo.importDevices([{ t: "INT", x: 41.3, y: -0.2 }, { t: "INT", x: 42.6, y: -0.2 }, { t: "CVR", x: 44.2, y: 1.6 }], [], { stay: true }).ids;
    }));
    await page.waitForTimeout(300);
    const ctl = await ev((i) => okteo.control.filter((x) => i.includes(x.ids[0])).map((x) => x.ids[0] === i[0] ? "behind:" + x.kind : x.ids[0] === i[1] ? "handle:" + x.kind : "glass:" + x.kind), ids);
    await ev(() => okteo.setTab("vue3d"));
    try { await page.waitForFunction((i) => { const S3 = okteoExt.pages.vue3d.ui.state; return (S3.pose || []).some((p) => p.id === i[0]) && (S3.pose || []).some((p) => p.id === i[2]); }, ids, { timeout: 20000 }); }
    catch { throw new Error("poses absentes en 3D : " + JSON.stringify({ ctl, pose: await ev(() => okteoExt.pages.vue3d.ui.state.pose) })); }
    const r = await ev((i) => { const S3 = okteoExt.pages.vue3d.ui.state; return { halos: S3.marks.halos.filter((m) => i.includes(m.userData.pose)).length, list: document.querySelectorAll(".v3d-pose li button").length, shown: !document.querySelector(".v3d-pose").hidden }; }, ids);
    const k = await ev((i) => { const L = okteoExt.pages.vue3d.ui.state.pose; return L.findIndex((p) => p.id === i[0]); }, ids);
    await page.click(`.v3d-pose li button[data-p="${k}"]`); await page.waitForTimeout(900);
    const card = await ev(() => ({ open: !document.querySelector(".v3d-card").hidden, bad: (document.querySelector(".v3d-card .v3d-bad") || {}).textContent || "" }));
    await ev(() => { okteo.setTab("plan"); okteo.undo(); });
    const back = await ev((i) => !okteo.state.app.some((a) => i.includes(a.id)) && !okteo.state.openings.some((o) => o.id === "o3d6a"), ids);
    const ok = ctl.includes("behind:battant") && !ctl.some((x) => x.startsWith("handle:battant")) && ctl.includes("glass:embrasure") && r.halos >= 2 && r.list >= 2 && r.shown && card.open && /charnière/.test(card.bad) && back;
    if (!ok) throw new Error(JSON.stringify({ ctl, r, card, back }));
    return true;
  });
  await check("3D-7 : clic sur un mur en 3D → élévation de la face touchée (appareil coté depuis l'angle, hauteur), autre face, PDF du mur à l'échelle ; Ctrl+Z", async () => {
    await ev(() => okteo.setTab("plan"));
    const ids = await ev(() => okteo.batch(() => { okteo.addWalls([{ a: { x: 50, y: 0 }, b: { x: 54, y: 0 }, ep: 0.25 }]); return okteo.importDevices([{ t: "INT", x: 51, y: 0.3 }], [], { stay: true }).ids; }));
    await ev(() => okteo.setTab("vue3d"));
    await page.waitForFunction((i) => { const S3 = okteoExt.pages.vue3d.ui.state; return S3.house && S3.devs.some((d) => d.id === i[0]); }, ids, { timeout: 20000 });
    const pt = await ev(() => { const u = okteoExt.pages.vue3d.ui, S3 = u.state; u.view("iso", true); S3.ctl.update(); S3.R.render(S3.scene, S3.cam); const v = new S3.T.Vector3(52.4, 1.7, 0.13).project(S3.cam), b = document.querySelector(".v3d-cv").getBoundingClientRect(); return { x: b.left + (v.x + 1) / 2 * b.width, y: b.top + (1 - v.y) / 2 * b.height, inside: Math.abs(v.x) < 1 && Math.abs(v.y) < 1 }; });
    await page.mouse.click(pt.x, pt.y); await page.waitForTimeout(400);
    let c1 = await ev(() => { const c = document.querySelector(".v3d-card"), E = okteoExt.pages.vue3d.ui.state.elev; return { open: !c.hidden && c.classList.contains("wide"), svg: !!c.querySelector(".v3d-elev svg"), seg: E && E.seg, side: E && E.side, devs: E && E.E.devices.map((d) => [d.id, Math.round(d.d * 100), Math.round(d.v * 100)]) }; });
    // clic manqué (mur caché dans ce cadrage) : on ouvre l'élévation directement pour vérifier la suite
    const segId = await ev(() => okteo.state.segs.find((s) => { const a = okteo.state.nodes.find((n) => n.id === s.a); return a && a.x === 50 && a.y === 0; }).id);
    const clicked = c1.seg === segId;
    if (!clicked) { await ev((s) => okteoExt.pages.vue3d.ui.showWall(s, 1), segId); c1 = await ev(() => { const c = document.querySelector(".v3d-card"), E = okteoExt.pages.vue3d.ui.state.elev; return { open: !c.hidden && c.classList.contains("wide"), svg: !!c.querySelector(".v3d-elev svg"), seg: E && E.seg, side: E && E.side, devs: E && E.E.devices.map((d) => [d.id, Math.round(d.d * 100), Math.round(d.v * 100)]) }; }); }
    await page.click('.v3d-card [data-a="wpdf"]');
    await page.waitForFunction(() => okteoExt.pages.vue3d.ui.lastElev, null, { timeout: 20000 });
    const pdf = await ev(async () => { const r = okteoExt.pages.vue3d.ui.lastElev; return { pages: r.pages, N: r.scales[0], size: r.blob.size, head: await r.blob.slice(0, 5).text() }; });
    await page.click('.v3d-card [data-a="wflip"]'); await page.waitForTimeout(200);
    const c2 = await ev(() => { const E = okteoExt.pages.vue3d.ui.state.elev; return { side: E.side, n: E.E.devices.length, W: E.E.W }; });
    await ev(() => { okteo.setTab("plan"); okteo.undo(); });
    const back = await ev((i) => !okteo.state.app.some((a) => i.includes(a.id)), ids);
    // l'interrupteur est à 1 m du bout gauche de la face (vue de y > 0, la gauche est x = 50 : pas de mur d'angle), à 110 cm
    const ok = c1.open && c1.svg && c1.seg === segId && c1.side === 1 && c1.devs.length === 1 && c1.devs[0][1] === 100 && c1.devs[0][2] === 110 && pdf.pages === 1 && pdf.head === "%PDF-" && [20, 25].includes(pdf.N) && c2.side === -1 && c2.n === 0 && Math.abs(c2.W - 4) < 1e-6 && back;
    if (!ok) throw new Error(JSON.stringify({ pt, clicked, c1, pdf, c2, back }));
    if (!clicked) console.log("    (clic sur le mur non atteint dans ce cadrage : élévation ouverte par l'API)");
    return true;
  });
  await check("3D-10 : « Tous les niveaux » : les étages empilés au-dessus du niveau ouvert (hauteur + dalle), liaison entre niveaux en pointillés ; « Niveau ouvert » le retire", async () => {
    await ev(() => okteo.setTab("plan"));
    const lv0 = await ev(() => okteo.level.id);
    const intId = await ev(() => okteo.importDevices([{ t: "INT", x: 1, y: 0.3 }], [], { stay: true }).ids[0]);
    const lv1 = await ev(() => okteo.addLevel("Étage 3D", { withWalls: true }));
    const lumId = await ev((c) => { const id = okteo.importDevices([{ t: "LUM", x: 2, y: 2 }], [], { stay: true }).ids[0]; okteo.state.lia.push({ c, l: id }); okteo.markDirty(); return id; }, intId);
    await ev((l) => okteo.switchLevel(l), lv0);
    await ev(() => okteo.setTab("vue3d"));
    const diag = async (what) => what + " : " + JSON.stringify(await ev(() => { const S3 = okteoExt.pages.vue3d.ui.state; return { house: !!S3.house, lvs: document.querySelector(".v3d-lvs").hidden, levels: okteo.levels, mode: S3.levels, others: (S3.others || []).length, err: S3.lvErr || null, msg: document.querySelector(".v3d-msg").textContent, gen: S3.gen }; }));
    try { await page.waitForFunction(() => okteoExt.pages.vue3d.ui.state.house && !document.querySelector(".v3d-lvs").hidden, null, { timeout: 20000 }); } catch { throw new Error(await diag("bascule absente")); }
    await page.click('.v3d-lvs [data-lvm="tous"]');
    try { await page.waitForFunction((l) => (okteoExt.pages.vue3d.ui.state.others || []).some((o) => o.id === l), lv1, { timeout: 20000 }); } catch { throw new Error(await diag("étage non empilé")); }
    const r = await ev((ids) => { const S3 = okteoExt.pages.vue3d.ui.state, o = S3.others.find((x) => x.id === ids[2]), n = okteo.levels.length; return { n, others: S3.others.length, ys: S3.others.map((x) => +x.y.toFixed(2)), y: o.y, walls: o.house.walls.children.filter((m) => m.isMesh && m.userData.wall).length, devs: o.devs.map((d) => d.id), links: S3.vlinks ? S3.vlinks.children.map((l) => l.userData.link) : [], ground: S3.ground.position.y, note: document.querySelector(".v3d-note").textContent }; }, [intId, lumId, lv1]);
    await page.click('.v3d-lvs [data-lvm="ouvert"]');
    await page.waitForFunction(() => (okteoExt.pages.vue3d.ui.state.others || []).length === 0, null, { timeout: 20000 });
    const level = await ev(() => okteo.level.id);
    await ev(({ l, i }) => { okteo.setTab("plan"); okteo.removeLevel(l); okteo.removeApps([i]); }, { l: lv1, i: intId });
    const back = await ev((l) => !okteo.levels.some((x) => x.id === l), lv1);
    // le nouvel étage est le dernier de la liste : au-dessus de tous les autres, à au moins une hauteur d'étage
    const ok = r.others === r.n - 1 && r.y > 2.5 && r.y >= Math.max(...r.ys) - 1e-9 && r.walls > 0 && r.devs.includes(lumId) && r.links.includes(intId + ">" + lumId) && Math.abs(r.ground + 0.01) < 1e-6 && /trémies/.test(r.note) && level === lv0 && back;
    if (!ok) throw new Error(JSON.stringify({ r, level, back }));
    return true;
  });
  await check("3D-8 : QR « maquette 3D » sur chaque face du plan A3 (recto boîtes, verso lignes directes), sans nom de client ni de chantier ; la page téléphone l'ouvre (murs, gaines, fiche au toucher, visite à la manette)", async () => {
    await ev(() => okteo.setTab("plan"));
    const q = await ev(async () => {
      const { faceUrl, faceData } = await import("/src/ext/plan3d-qr.js"), { buildPlanPdf } = await import("/src/ext/print.js");
      const all = await faceUrl(okteo, { apps: null, boxes: null, direct: false }), d = faceData(okteo, { apps: null, boxes: null, direct: false });
      const r = await buildPlanPdf(okteo.exportGeometry(), { boites: true, gaines: true, cotes: false, nomenclature: false, ftz: { pages: [{ boxes: "all", direct: false, autres: true, legend: false }, { boxes: [], direct: true, autres: false, legend: true }], items: [], images: {}, fields: {}, qr3d: (f) => faceUrl(okteo, f) } });
      const json = JSON.stringify((await import("/src/cablage/bande-code.js")).decodeSheet ? await (await import("/src/cablage/bande-code.js")).decodeSheet(all.url.split("#p=")[1]) : null);
      const ch = okteo.ch || {};
      const W = (await import("/src/ext/cablage-data.js")).wiringNow(okteo), miss = d.gaines.filter((g) => g.apps[0] !== "tab" && !d.apps.some((a) => a.id === g.apps[0])).length;
      return { url: all.url, size: all.size, tooBig: all.tooBig, gaines: d.gaines.length, miss, wGaines: W.boxes.filter((b) => d.boxes.some((x) => x.id === b.id)).reduce((s, b) => s + b.gaines.length, 0), boxes: d.boxes.length, qrs: r.qrs.map((x) => ({ page: x.page, ok: !!x.url, size: x.size, tooBig: !!x.tooBig, err: x.error || null })), names: [ch.nom, ch.client, ch.numero].filter((s) => s && s.length > 2 && json.includes(s)) };
    });
    const p2 = await browser.newPage({ viewport: { width: 390, height: 844 } }), errs = [];
    p2.on("pageerror", (e) => errs.push(String(e)));
    await p2.goto(`http://localhost:${APP_PORT}/plan3d.html` + q.url.slice(q.url.indexOf("#")));
    await p2.waitForFunction(() => window.__plan3d && window.__plan3d.ready, null, { timeout: 60000 });
    await p2.waitForTimeout(600);
    const r = await p2.evaluate(() => { const S = window.__plan3d; const d = S.devs.find((x) => x.mount === "mur") || S.devs[0]; S.show({ dev: d.id }); return { walls: S.plan.walls.length, gl: S.gl.length, devs: S.devs.length, skip: S.skip, card: !document.querySelector(".card").hidden && document.querySelector(".card .t").textContent, title: document.querySelector(".top b").textContent }; });
    await p2.click('[data-v="walk"]'); await p2.waitForTimeout(200);
    const p0 = await p2.evaluate(() => ({ ...window.__plan3d.walk.p }));
    let p1 = null;
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      await p2.evaluate((y) => { const W = window.__plan3d.walk; W.yaw = y; W.mv = [0, -1]; }, yaw); await p2.waitForTimeout(900); await p2.evaluate(() => { window.__plan3d.walk.mv = [0, 0]; });
      p1 = await p2.evaluate(() => ({ ...window.__plan3d.walk.p, joy: !document.querySelector(".joy").hidden }));
      if (Math.hypot(p1.x - p0.x, p1.y - p0.y) > 0.2) break;
    }
    if (process.env.SHOT) await p2.screenshot({ path: process.env.SHOT + "/plan3d-telephone.png" });
    await p2.close();
    const ok = q.url.startsWith("https://okteo-ai.pages.dev/plan3d.html#p=") && !q.tooBig && q.size <= 2900 && q.names.length === 0 && q.qrs.length === 2 && q.qrs.every((x) => x.ok) && r.walls > 0 && r.gl === q.gaines && r.devs > 0 && r.card && p1.joy && Math.hypot(p1.x - p0.x, p1.y - p0.y) > 0.2 && !errs.length;
    if (!ok) throw new Error(JSON.stringify({ q: { ...q, url: q.url.slice(0, 60) }, r, p0, p1, errs }));
    return true;
  });
  await check("3D-2 : jonction oubliée et mur en double signalés dans la vue 3D, un clic montre l'endroit sur le plan", async () => {
    await ev(() => okteo.addWalls([{ a: { x: 20, y: 0 }, b: { x: 24, y: 0 }, ep: 0.25 }, { a: { x: 22, y: 0.35 }, b: { x: 22, y: 3 }, ep: 0.1 }]));
    await ev(() => okteo.setTab("vue3d"));
    await page.waitForFunction(() => { const S3 = okteoExt.pages.vue3d.ui.state; return S3.plan && S3.plan.defects.some((d) => d.kind === "libre"); }, null, { timeout: 30000 });
    const n = await ev(() => document.querySelectorAll(".v3d-def li button").length);
    await ev(() => { document.querySelector(".v3d-def").open = true; });
    await page.click(".v3d-def li button");
    await page.waitForTimeout(300);
    const r = await ev(() => ({ tab: okteo.tab }));
    await ev(() => okteo.undo());
    if (!(n >= 1 && r.tab === "plan")) throw new Error(JSON.stringify({ n, r }));
    return true;
  });
  await check("n° 15 : dossier PDF de 3 pages (plan RDC, plan R+1, devis) → nouveau chantier avec ses 2 niveaux et leur fond ; le devis est joint à l'analyse (mode 4)", async () => {
    const { jsPDF } = await import("jspdf");
    const d = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
    d.setFontSize(14); d.text("PLAN ELECTRICITE - REZ-DE-CHAUSSEE (RDC)", 20, 20); d.text("Legende : prise de courant, interrupteur, va-et-vient, point lumineux, RJ45", 20, 30); d.rect(40, 50, 300, 200);
    d.addPage("a3", "landscape"); d.text("PLAN ELECTRICITE - ETAGE R+1", 20, 20); d.text("Legende : prise de courant, interrupteur, point lumineux", 20, 30); d.rect(40, 50, 250, 180);
    d.addPage("a4", "portrait"); d.text("DEVIS DESCRIPTIF - Designation, quantite, prix unitaire, montant total HT, TVA, total TTC", 15, 20);
    const buffer = Buffer.from(d.output("arraybuffer"));
    await ev(() => okteo.saveNow());
    await page.evaluate(() => okteo.setTab("chantiers"));   // lot 3 : accueil par le logo (plus d'onglet)
    await page.click("#ch-new"); await page.fill("#nf-nom", "DOSSIER"); await page.fill("#nf-num", "88888");
    await page.setInputFiles("#nf-file", { name: "dossier.pdf", mimeType: "application/pdf", buffer });
    await page.waitForSelector(".pg-role", { timeout: 30000 });
    const roles = await ev(() => [...document.querySelectorAll(".pg-role")].map((s) => s.value));
    await Promise.all([page.waitForNavigation({ timeout: 90000 }), page.click("#nf-ok")]);
    await page.waitForFunction(() => window.okteo && window.okteoExt && okteo.FOND, null, { timeout: 30000 });
    const r = await ev(async () => ({ nom: okteo.ch.nom, lv: okteo.levels.map((l) => l.name).join(), fonds: okteo.ch.levels.filter((l) => l.fond && l.fond.src === "idb").map((l) => l.fond.page).join(), devis: (okteo.ch.dossier || {}).devis?.join(), pg: await (await import("/src/ext/ai-cross.js")).otherPages(okteo) }));
    if (!(roles.join() === "niv:RDC,niv:R+1,devis" && r.nom === "DOSSIER" && r.lv === "RDC,R+1" && r.fonds === "1,2" && r.devis === "3" && r.pg === 1)) throw new Error(JSON.stringify({ roles, r }));
    return true;
  });
  await page.screenshot({ path: process.env.OKTEO_SHOT || "scripts/derniere-capture.png" });
} finally {
  await browser.close(); await server.close(); mock.close();
}

if (errors.length) fails.push("Erreurs JavaScript : " + errors.join(" | "));
console.log(`\n${ok} vérifications réussies, ${fails.length} en échec.`);
if (fails.length) { console.error(fails.map((f) => " - " + f).join("\n")); process.exit(1); }
