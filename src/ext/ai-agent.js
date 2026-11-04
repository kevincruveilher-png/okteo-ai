// n° 3 (bloc D, 04/11/2026) : lecture du plan par Claude avec les outils d'Oktéo (src/walls/ai-tools.js). Construit le
// contexte des outils (formes, textes et murs du PDF vectoriel en pixels de l'image envoyée, zoom rendu depuis le PDF,
// mémoire des symboles) et mène la boucle question → outils → réponse, bornée en tours et en zooms.
import { AI_TOOLS, runTool, TOOLS_GUIDE } from "../walls/ai-tools.js";
import { chantierPage, chantierTexts, pageMap } from "./pdf-page.js";
import { detectWalls } from "../walls/detect.js";
import { symbolMemory } from "./symbol-memory.js";

const hex = (c) => (Array.isArray(c) ? "#" + c.slice(0, 3).map((v) => Math.round(v * (v <= 1 ? 255 : 1)).toString(16).padStart(2, "0")).join("") : c ? String(c) : "");

// G = image globale envoyée à l'IA {W, H, map} ; S = source du plan (ai-render.js planSource : rendu des zooms)
export async function toolContext(api, G, S) {
  const toPx = (wx, wy) => ({ x: (wx - G.map.x0) / G.map.sx, y: (wy - G.map.y0) / G.map.sy });
  const ctx = { W: G.W, H: G.H, vector: false, shapes: [], texts: [], walls: [], memory: [], legendText: "", pav: api.ch.client || "", zoomsLeft: 8 };
  const P = S && S.kind === "vector" ? await chantierPage(api).catch(() => null) : null;
  if (P) {
    const m = pageMap(api, P), W = (x, y) => toPx(m.ox + x * m.k, m.oy + y * m.k);
    ctx.vector = true;
    ctx.shapes = (P.shapes || []).map((s) => {
      const a = W(s.x0, s.y0), b = W(s.x1, s.y1), w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
      const kind = s.rect ? (Math.abs(w - h) < 0.2 * Math.max(w, h) ? "carré" : "rectangle") : s.curves ? (Math.abs(w - h) < 0.25 * Math.max(w, h) ? "cercle" : "courbe") : s.closed ? "polygone" : "trait";
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, w, h, kind, color: hex(s.stroke || s.fill), fill: !!s.fill && hex(s.fill) !== "#ffffff" };
    });
    const T = (await chantierTexts(api).catch(() => [])) || [];
    ctx.texts = T.map((t) => { const p = W(t.x, t.y); return { s: t.str, x: p.x, y: p.y, h: t.size * m.k / G.map.sy }; });
    // légende : textes autour du mot « légende » (en dessous et à droite)
    const L = ctx.texts.find((t) => /l[ée]gende/i.test(t.s));
    if (L) ctx.legendText = ctx.texts.filter((t) => t.x >= L.x - G.W * 0.05 && t.x <= L.x + G.W * 0.35 && t.y >= L.y - 5 && t.y <= L.y + G.H * 0.5).sort((a, b) => a.y - b.y || a.x - b.x).map((t) => t.s).join(" · ");
    // murs : calculés à la première demande seulement
    let walls = null;
    Object.defineProperty(ctx, "walls", { get() {
      if (walls) return walls;
      try { const r = detectWalls(P.segs, m, { shapes: P.shapes }); walls = r.walls.map((w) => { const A = toPx(r.nodes[w.a].x, r.nodes[w.a].y), B = toPx(r.nodes[w.b].x, r.nodes[w.b].y); return { x1: A.x, y1: A.y, x2: B.x, y2: B.y, ep: w.ep * 100 }; }); }
      catch { walls = []; }
      return walls;
    } });
  }
  ctx.memory = symbolMemory(api.ch.client);
  if (S && S.render) ctx.zoom = async (z) => {
    // pixels de l'image → mètres → pixels du fond
    const wx = G.map.x0 + z.x * G.map.sx, wy = G.map.y0 + z.y * G.map.sy, ww = z.w * G.map.sx, wh = z.h * G.map.sy;
    const fx = (wx - S.srcMap.x0) / S.srcMap.sx, fy = (wy - S.srcMap.y0) / S.srcMap.sy;
    const r = await S.render({ x: fx, y: fy, w: ww / S.srcMap.sx, h: wh / S.srcMap.sy }, { maxSide: 1200, maxPixels: 1.1e6, minSide: 500 }).catch(() => null);
    return r && { data: r.data, W: r.W, H: r.H };
  };
  return ctx;
}

// boucle d'outils : call(args) = chat (ai.js) ; first = blocs du 1er message (image + consigne) ; renvoie { text, rounds, uses }
export async function readWithTools({ call, system, first, ctx, maxRounds = 8, maxTokens = 12000, onTool = () => {} }) {
  const messages = [{ role: "user", blocks: [...first, { type: "text", text: TOOLS_GUIDE }] }], uses = [];
  let r = null;
  for (let round = 0; round <= maxRounds; round++) {
    const last = round === maxRounds;
    if (last) messages.push({ role: "user", blocks: [{ type: "text", text: "Plus d'outil : donne maintenant ta réponse JSON finale." }] });
    r = await call({ system, messages, tools: AI_TOOLS, maxTokens });
    const calls = (r.content || []).filter((c) => c.type === "tool_use");
    if (!calls.length || last) return { text: r.text, rounds: round, uses, last: r };
    messages.push({ role: "assistant", blocks: r.content });
    const results = [];
    for (const u of calls) {
      let out;
      try { out = await runTool(u.name, u.input, ctx); } catch (e) { out = { text: "Erreur de l'outil : " + (e && e.message || e) }; }
      uses.push({ outil: u.name, zone: u.input && u.input.w ? [u.input.x, u.input.y, u.input.w, u.input.h].map(Math.round).join(",") : "" });
      onTool(u.name);
      results.push({ type: "tool_result", tool_use_id: u.id, content: out.image ? [{ type: "text", text: out.text }, { type: "image", source: { type: "base64", media_type: "image/jpeg", data: out.image } }] : out.text });
    }
    messages.push({ role: "user", blocks: results });
  }
  return { text: r ? r.text : "", rounds: maxRounds, uses, last: r };
}
