// v76 : lecture du plan des modes 2 à 4 d'« Analyse IA » (le mode 1 reste ai-releve.js open(), inchangé).
//  1. lecture globale : exactement celle du mode 1 (image du plan ≤ 1 568 px, murs, pièces, appareils, liaisons) ;
//  2. lecture systématique en tuiles fines (grille avec recouvrement, ai-tiles.js) rendues en haute définition
//     (ai-render.js : PDF vectoriel rendu de nouveau, scan découpé dans ses pixels) ; envoyées en parallèle (réglage
//     « Tuiles envoyées en même temps ») après la première, pour que les suivantes lisent la consigne en cache ;
//  3. zoom à la demande : l'IA demande des zones dans son JSON (« zooms »), Oktéo les rend en plus haute définition et
//     les renvoie dans la même conversation (tuile en cache) ; plafond par tuile (3) et par plan (réglage) ; c'est un
//     complément de la couverture systématique, jamais un substitut ;
//  4. mode 3 : avant l'envoi, chaque tuile d'un plan raster est nettoyée (OpenCV.js) et ses textes lus (Tesseract.js) —
//     ai-raster.js, chargé à la demande ;
//  5. mode 4 : seconde lecture complète + contrôle croisé avec les autres documents (ai-cross.js) ;
//  6. fusion (mergeReadings) : rien n'est supprimé, chaque différence devient un écart à vérifier ; puis aperçu, cases
//     et ajout du relevé standard (un Ctrl+Z), puis 3 cycles de la boucle de relecture existante (ai-recheck-ui.js).
// Rien de tout cela ne corrige « à coup sûr » : l'opérateur ou le BE valide.
import { chat } from "./ai.js";
import { AI_SYSTEM } from "../walls/ai-data.js";
import { aiPrompt, parseAiJson, aiToPlan } from "../walls/ai-plan.js";
import { chooseGrid, tileGrid, tileRules, tilePrompt, zoomPrompt, parseZooms, tileToDevices, mergeReadings, ecartsCount } from "../walls/ai-tiles.js";
import { addUsage, tinOf, fmtMs } from "../walls/ai-journal.js";
import { planSource } from "./ai-render.js";
import { pref } from "../prefs.js";
import { chantierTexts } from "./pdf-page.js";
import { esc } from "./util.js";

const ZOOM_PER_TILE = 3;
const img = (data) => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } });
const txt = (text) => ({ type: "text", text });
const cache = (b) => ({ ...b, cache_control: { type: "ephemeral" } });

export function createModeRunner({ api, aiReleve }) {
  let stopped = false, running = false, last = null, ext3 = null, ext4 = null;

  // un appel journalisé ; 429 « simultanées » (limite de l'entreprise) : on réessaie une fois après 4 s
  async function call(log, phase, args, extra = {}) {
    const t = performance.now();
    let r;
    try { r = await chat({ purpose: "analyse", provider: "anthropic", ...args }); }
    catch (e) {
      if (e && e.status === 429 && !stopped) { await new Promise((ok) => setTimeout(ok, 4000)); r = await chat({ purpose: "analyse", provider: "anthropic", ...args }); log.retries++; }
      else throw e;
    }
    const u = r.usage || null;
    log.usages.push(u);
    log.appels.push({ phase, ...extra, ms: Math.round(performance.now() - t), tin: tinOf(u), tout: u ? u.out : 0, cw: u ? u.cw : 0, cr: u ? u.cr : 0 });
    return r;
  }

  // petite file d'attente : `limit` tuiles en même temps
  async function pool(items, limit, fn) {
    const out = new Array(items.length); let next = 0;
    const worker = async () => { while (next < items.length && !stopped) { const i = next++; out[i] = await fn(items[i], i); } };
    await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
    return out;
  }

  function progress(state) {
    aiReleve.show(`<p><b>Analyse IA · mode ${state.mode}</b> — ${esc(state.step)}</p>
      ${state.total ? `<p class="sm">Tuiles lues : <b>${state.done}/${state.total}</b>${state.zooms ? ` · zooms : ${state.zooms}` : ""}${state.ko ? ` · <span class="warn">${state.ko} en échec</span>` : ""}</p>` : ""}
      <p class="mut sm">Vous pouvez continuer à travailler : l'aperçu s'affichera ici.</p>
      <div class="wrow"><button class="danger" id="am-stop" title="Arrête l'analyse ; rien n'est ajouté au plan">Arrêter</button></div>`);
    const b = document.getElementById("am-stop"); if (b) b.onclick = () => { stopped = true; };
  }

  // lecture d'une tuile (+ zooms) → { devices, links, core, zooms, ok, ocr }
  async function readTile(S, tile, n, total, ctx, log, st) {
    const R = await S.render(tile, {});
    const map = R.map, cmPerPx = map.sx * 100;
    let images = [img(R.data)], rot = 0, ocr = null, cleaned = false;
    if (ctx.raster) { const P = await ctx.raster.prepare(R, { tile }); images = P.images.map(img); rot = P.rot || 0; ocr = P.ocr; cleaned = P.cleaned; if (P.cleaned) log.nettoyees++; log.ocrMots += (ocr || []).length; }
    // mode 3 sur un PDF vectoriel : pas de nettoyage (inutile et nuisible) ; textes de la tuile lus dans le PDF lui-même
    else if (ctx.pdfTexts) {
      const kx = R.W / R.region.w, ky = R.H / R.region.h;
      ocr = ctx.pdfTexts.map((t) => ({ text: t.str, u: t.x * S.s0, v: t.y * S.s0 })).filter((t) => t.u >= R.region.x && t.u <= R.region.x + R.region.w && t.v >= R.region.y && t.v <= R.region.y + R.region.h)
        .map((t) => ({ text: String(t.text).trim(), x: (t.u - R.region.x) * kx, y: (t.v - R.region.y) * ky, conf: 100, src: "pdf" })).filter((t) => t.text);
      log.ocrMots += ocr.length;
    }
    const system = [cache(txt(AI_SYSTEM + "\n\n" + tileRules({ zoomMax: ZOOM_PER_TILE })))];
    const first = [...images, cache(txt(tilePrompt(tile, { n, total, W: R.W, H: R.H, cmPerPx, ocr, cleaned })))];
    const r1 = await call(log, "tuile", { system, messages: [{ role: "user", blocks: first }], maxTokens: 6000 }, { tuile: n });
    let raw = parseAiJson(r1.text), text = r1.text, zs = [];
    const room = Math.max(0, Math.min(ZOOM_PER_TILE, ctx.zoomsLeft));
    if (room > 0) zs = parseZooms(raw, R.W, R.H, { max: room });
    if (zs.length && !stopped) {
      ctx.zoomsLeft -= zs.length; st.zooms += zs.length; log.zooms += zs.length;
      // zone du zoom en pixels du fond : la tuile couvre `R.region` ; zoom rendu à la plus haute définition disponible
      const kx = R.region.w / R.W, ky = R.region.h / R.H, Z = [];
      for (const z of zs) { const zr = await S.render({ x: R.region.x + z.x * kx, y: R.region.y + z.y * ky, w: z.w * kx, h: z.h * ky }, { minSide: 400 }); Z.push({ ...z, W: zr.W, H: zr.H, data: zr.data, up: zr.upscaled }); }
      log.zoomList.push(...zs.map((z) => ({ tuile: n, pourquoi: z.pourquoi })));
      const blocks = [...Z.map((z) => img(z.data)), txt(zoomPrompt(Z) + (Z.some((z) => z.up) ? "\n(Zooms d'un scan : agrandis à partir des pixels du scan, aucun détail ajouté.)" : ""))];
      const r2 = await call(log, "zoom", { system, messages: [{ role: "user", blocks: first }, { role: "assistant", text: r1.text }, { role: "user", blocks }], maxTokens: 6000 }, { tuile: n, zooms: zs.length });
      try { raw = parseAiJson(r2.text); text = r2.text; } catch { /* réponse au zoom illisible : on garde la première lecture de la tuile */ }
    }
    const D = tileToDevices(raw, map, { rot, W: R.W, H: R.H });
    const c = tile.core, a = { x: S.srcMap.x0 + c.x * S.srcMap.sx, y: S.srcMap.y0 + c.y * S.srcMap.sy }, b = { x: S.srcMap.x0 + (c.x + c.w) * S.srcMap.sx, y: S.srcMap.y0 + (c.y + c.h) * S.srcMap.sy };
    return { ...D, src: `tuile ${n}`, core: { x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) }, text, ocr };
  }

  let lastOpts = {};
  async function run(mode, opts = {}) {
    if (running) return null;
    lastOpts = opts;
    const ok = await aiReleve.prepare({ needClaude: true });
    if (!ok) return null;
    running = true; stopped = false; aiReleve.setBusy(true);
    const t0 = performance.now(), log = { usages: [], appels: [], zooms: 0, zoomList: [], retries: 0, nettoyees: 0, ocrMots: 0 };
    const st = { mode, step: "préparation du plan…", done: 0, total: 0, zooms: 0, ko: 0 };
    const job = aiReleve.attente.start({ title: `L'IA étudie votre plan (mode ${mode})` });
    let okEnd = false, ctxRef = null;
    try {
      progress(st);
      const S = await planSource(api);
      const raster = S.kind === "raster";
      const ctx = { zoomsLeft: Math.max(0, +pref("zoomsIA") || 0), raster: null, pdfTexts: null };
      ctxRef = ctx;
      if (mode >= 3 && raster) {
        st.step = "chargement du nettoyage d'image et de l'OCR…"; progress(st);
        ext3 = ext3 || await import("./ai-raster.js"); ctx.raster = await ext3.createRaster();
        log.rasterErr = ctx.raster.errors.slice();
      } else if (mode >= 3 && S.page) ctx.pdfTexts = await chantierTexts(api).catch(() => null);
      // 1. lecture globale (celle du mode 1)
      st.step = "lecture globale du plan…"; progress(st);
      const G = await aiReleve.fondImage({});
      let g;
      if (mode >= 4) {
        // n° 3 : mode 4 : lecture globale avec les outils d'Oktéo (légende et mémoire des symboles, symboles, textes et murs du
        // PDF, zoom, vérification du relevé avant la réponse)
        st.step = "lecture globale avec les outils d'Oktéo…"; progress(st);
        const agent = await import("./ai-agent.js"), tctx = await agent.toolContext(api, G, S);
        const first = [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: G.url.split(",")[1] } }, { type: "text", text: aiPrompt({ W: G.W, H: G.H, cmPerPx: G.map.sx * 100 }) }];
        const R = await agent.readWithTools({ call: (a) => call(log, "outils", a), system: AI_SYSTEM, first, ctx: tctx, maxRounds: Math.max(2, Math.min(12, +pref("toursOutils") || 8)), onTool: (n) => { st.step = `lecture globale : outil « ${n} »…`; progress(st); } });
        log.outils = R.uses; g = { text: R.text };
      } else g = await call(log, "globale", { system: AI_SYSTEM, messages: [{ role: "user", text: aiPrompt({ W: G.W, H: G.H, cmPerPx: G.map.sx * 100 }), image: { type: "image/jpeg", data: G.url.split(",")[1] } }], maxTokens: 12000, think: true });
      const P0 = aiToPlan(parseAiJson(g.text), G.map, { defEp: api.state.wallEp });
      if (stopped) throw new Error("arrêtée");
      // 2. tuiles : la première seule (écrit la consigne en cache), les autres en parallèle
      const grid = chooseGrid(S.box.w, S.box.h, pref("grilleIA")), tiles = tileGrid(S.box, { ...grid, overlap: 0.08 });
      st.total = tiles.length; st.step = `lecture fine en ${grid.cols} × ${grid.rows} tuiles…`; progress(st);
      const lim = Math.max(1, Math.min(10, +pref("tuilesParallele") || 2)), reads = [];
      const one = async (t, i) => {
        try { const r = await readTile(S, t, i + 1, tiles.length, ctx, log, st); reads[i] = r; }
        catch (e) { st.ko++; reads[i] = null; log.appels.push({ phase: "tuile", tuile: i + 1, erreur: String(e.message || e).slice(0, 200) }); }
        st.done++; if (!stopped) progress(st);
      };
      await one(tiles[0], 0);
      await pool(tiles.slice(1), lim, (t, i) => one(t, i + 1));
      if (stopped) throw new Error("arrêtée");
      // 3. mode 4 : seconde lecture complète + contrôle croisé (ai-cross.js)
      const lectures = [{ src: "lecture globale", devices: P0.devices, links: P0.links }, ...reads.filter(Boolean).map((r) => ({ src: r.src, devices: r.devices, links: r.links, core: r.core }))];
      let docEcarts = null, second = null;
      if (mode >= 4) {
        ext4 = ext4 || await import("./ai-cross.js");
        st.step = "seconde lecture complète du plan…"; progress(st);
        second = await ext4.secondReading({ api, S, G, call: (phase, a, x) => call(log, phase, a, x) });
        if (second) lectures.push({ src: "2e lecture", devices: second.devices, links: second.links });
      }
      const M = mergeReadings(lectures, { tol: 0.3 });
      // seconde lecture complète : ce qu'elle seule a vu, et ce qu'elle n'a pas vu, deviennent des écarts « 2e »
      if (second) {
        for (const e of M.ecarts) if (e.src === "2e lecture" && e.kind === "ajout") { e.kind = "2e"; e.detail = "vu par la seconde lecture seulement"; }
        for (const d of M.devices) if (!d.aiSrc.includes("2e lecture")) M.ecarts.push({ kind: "2e", t: d.t, x: d.x, y: d.y, src: "2e lecture", detail: `non vu par la seconde lecture (vu par : ${d.aiSrc.join(", ")})` });
      }
      if (mode >= 4) {
        st.step = "contrôle croisé avec le devis et les autres documents…"; progress(st);
        docEcarts = await ext4.crossCheck({ api, devices: M.devices, rooms: P0.pieces, docs: opts.docs || [], call: (phase, a, x) => call(log, phase, a, x) });
      }
      const usage = addUsage(log.usages), ms = Math.round(performance.now() - t0), n = ecartsCount(M.ecarts);
      const info = `Claude · Opus 5.5 · mode ${mode} · ${fmtMs(ms)} · ${log.appels.length} appels${log.outils ? ` · ${log.outils.length} outil${log.outils.length > 1 ? "s" : ""} d'Oktéo utilisé${log.outils.length > 1 ? "s" : ""}` : ""} · ${S.kind === "vector" ? "PDF vectoriel rendu en haute définition" : "pixels du plan (scan ou image)"} · ${grid.cols} × ${grid.rows} tuiles${st.ko ? ` (${st.ko} en échec)` : ""} · ${log.zooms} zooms`;
      const plan = { ...P0, devices: M.devices, links: M.links, ecarts: M.ecarts, docEcarts,
        journal: { info: `${tiles.length - st.ko} tuiles lues sur ${tiles.length}${st.ko ? ` — ${st.ko} tuile(s) non lue(s) : ces zones n'ont eu que la lecture globale` : ""}${log.nettoyees ? ` · ${log.nettoyees} tuile(s) nettoyée(s) (image d'origine gardée)${ctxRef && ctxRef.raster && ctxRef.raster.angle ? `, plan redressé de ${ctxRef.raster.angle.toFixed(1).replace(".", ",")}°` : ""}` : ""}${log.ocrMots ? ` · ${log.ocrMots} textes lus (${ctxRef && ctxRef.pdfTexts ? "texte du PDF" : "OCR"})` : ""}${log.rasterErr && log.rasterErr.length ? ` · ⚠ ${log.rasterErr.join(" ; ")}` : ""}${second ? " · seconde lecture complète faite" : ""}.`,
          zones: tiles.length - st.ko, zooms: log.zooms, tuilesKo: st.ko, grille: `${grid.cols}x${grid.rows}`, source: S.kind, ocrMots: log.ocrMots, nettoyees: log.nettoyees, ecartsN: M.ecarts.length, secondeLecture: !!second,
          docs: docEcarts ? (docEcarts.off ? "désactivé" : docEcarts.sources) : null, appels: log.appels, ...(log.outils ? { outils: log.outils.length, outilsListe: log.outils } : {}) } };
      last = { mode, ms, usage, ecarts: n, tiles: tiles.length, ko: st.ko, zooms: log.zooms, zoomList: log.zoomList, appels: log.appels.length };
      aiReleve.fromPlan(plan, { info, text: [g.text, ...reads.filter(Boolean).map((r) => r.text)].join("\n\n"), usage, ms, mode });
      okEnd = true;
      return plan;
    } catch (e) {
      aiReleve.message(e.message === "arrêtée" ? "Analyse arrêtée : rien n'a été ajouté au plan." : "L'analyse IA a échoué : " + esc(e.message || String(e)), [{ label: "Fermer", run: () => {} }]);
      return null;
    } finally { aiReleve.attente.finish(job, okEnd); running = false; aiReleve.setBusy(false); if (ctxRef && ctxRef.raster) ctxRef.raster.close(); }
  }
  aiReleve.setAgain((m) => run(m, lastOpts));
  return { run, stop: () => { stopped = true; }, get running() { return running; }, get last() { return last; } };
}
