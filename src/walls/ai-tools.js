// n° 3 (bloc D, 04/11/2026) : outils de l'IA pour le relevé (mode 4). Claude les appelle pendant sa lecture ; Oktéo les
// exécute dans le navigateur sur les données du plan (traits, formes et textes du PDF vectoriel, murs détectés, mémoire
// des symboles du pavillonneur) et renvoie le résultat. Pur (sans DOM) : le zoom (rendu d'image) est fourni par l'appelant.
// Coordonnées : pixels de l'image entière envoyée à l'IA (origine en haut à gauche), comme dans la consigne.
const zoneSchema = { x: { type: "number", description: "gauche de la zone (pixels de l'image)" }, y: { type: "number", description: "haut de la zone" }, w: { type: "number", description: "largeur" }, h: { type: "number", description: "hauteur" } };
export const AI_TOOLS = [
  { name: "legende", description: "Légende des symboles : textes de la légende du plan (tableau ou cartouche) et symboles déjà validés pour ce pavillonneur (mémoire des symboles d'Oktéo). À appeler en premier.", input_schema: { type: "object", properties: {} } },
  { name: "symboles", description: "Inventaire des formes dessinées dans une zone (cercles, carrés, rectangles, petits traits), avec centre, taille, couleur, remplissage et formes collées : sert à ne sauter aucun symbole et à distinguer deux symboles proches. Plan vectoriel seulement.", input_schema: { type: "object", properties: zoneSchema, required: ["x", "y", "w", "h"] } },
  { name: "textes", description: "Textes du PDF dans une zone (inscriptions « 16A », « H:1.10m », « LL », noms de pièces, cotes) avec leur position. Une police codée donne des caractères illisibles : le signaler.", input_schema: { type: "object", properties: zoneSchema, required: ["x", "y", "w", "h"] } },
  { name: "murs", description: "Murs détectés par Oktéo dans les traits du PDF (axe et épaisseur en cm) dans une zone : pour poser les murs sur les vrais traits.", input_schema: { type: "object", properties: zoneSchema, required: ["x", "y", "w", "h"] } },
  { name: "zoom", description: "Image agrandie d'une zone (rendue de nouveau depuis le PDF quand il est vectoriel) pour lire un symbole serré, une inscription ou un trait de liaison.", input_schema: { type: "object", properties: { ...zoneSchema, pourquoi: { type: "string" } }, required: ["x", "y", "w", "h"] } },
  { name: "verifier", description: "Contrôle par Oktéo d'un relevé avant la réponse finale : décompte par type, lumières sans commande, commandes sans lumière, volets sans commande, symboles du PDF qu'aucun appareil ne couvre. À appeler avec ta liste avant de répondre.", input_schema: { type: "object", properties: { appareils: { type: "array", items: { type: "object", properties: { t: { type: "string" }, x: { type: "number" }, y: { type: "number" } }, required: ["t", "x", "y"] } }, liaisons: { type: "array", items: { type: "array", items: { type: "integer" } } } }, required: ["appareils"] } },
];
export const toolNames = () => AI_TOOLS.map((t) => t.name);

const inZone = (p, z) => p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h;
const r0 = (v) => Math.round(v);
const zoneOf = (i, W, H) => { const x = Math.max(0, +i.x || 0), y = Math.max(0, +i.y || 0); return { x, y, w: Math.max(1, Math.min(W - x, +i.w || W)), h: Math.max(1, Math.min(H - y, +i.h || H)) }; };
const LIGHT = new Set(["LUM", "APP", "SPOT"]), CMD = new Set(["INT", "VV", "BP"]);

// formes du PDF (déjà en pixels de l'image) → symboles probables : ni trop grandes (murs, cadres), ni minuscules
export function symbolShapes(shapes, W) {
  const min = W * 0.002, max = W * 0.05;
  return (shapes || []).filter((s) => { const L = Math.max(s.w, s.h); return L >= min && L <= max; });
}
// formes collées (même centre ou côte à côte, moins d'une taille d'écart) : regroupées pour l'IA
function groupsOf(L) {
  const g = L.map((_, i) => i), f = (i) => (g[i] === i ? i : (g[i] = f(g[i])));
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    const a = L[i], b = L[j], d = Math.hypot(a.x - b.x, a.y - b.y), s = Math.max(a.w, a.h, b.w, b.h);
    if (d < s * 0.9) g[f(j)] = f(i);
  }
  const out = new Map(); L.forEach((s, i) => { const k = f(i); if (!out.has(k)) out.set(k, []); out.get(k).push(s); });
  return [...out.values()];
}
const desc = (s) => `${s.kind}${s.fill ? " plein" : ""} ${r0(s.w)}×${r0(s.h)} px${s.color ? " " + s.color : ""}`;

// exécution d'un outil : ctx = { W, H, shapes [{x, y, w, h, kind, color, fill}], texts [{s, x, y, h}], walls [{x1, y1, x2,
// y2, ep}], memory [{type, desc, pav, chantier}], legendText, vector (bool), zoom: async(zone) → {data, W, H} | null }
export async function runTool(name, input, ctx) {
  const W = ctx.W, H = ctx.H, I = input || {};
  if (name === "legende") {
    const mem = (ctx.memory || []).slice(0, 40).map((m) => `- ${m.type} : ${m.desc}${m.pav ? ` (${m.pav}${m.chantier ? ", " + m.chantier : ""})` : ""}`);
    return { text: `Légende du plan : ${ctx.legendText ? ctx.legendText.slice(0, 3000) : "aucun texte de légende lisible dans le PDF (lis-la sur l'image, zoome si besoin)"}\nMémoire des symboles validés${ctx.pav ? " pour " + ctx.pav : ""} : ${mem.length ? "\n" + mem.join("\n") : "aucun pour l'instant"}\nLa légende du plan fait foi pour ce plan ; en cas de contradiction avec la mémoire, suis la légende et signale-le dans "remarques".` };
  }
  if (name === "symboles") {
    if (!ctx.vector) return { text: "Plan scanné (pixels) : pas de formes vectorielles. Utilise « zoom » sur la zone." };
    const z = zoneOf(I, W, H), L = symbolShapes(ctx.shapes, W).filter((s) => inZone(s, z));
    const G = groupsOf(L).sort((a, b) => a[0].y - b[0].y || a[0].x - b[0].x);
    const lines = G.slice(0, 150).map((g, i) => { const c = { x: g.reduce((s, q) => s + q.x, 0) / g.length, y: g.reduce((s, q) => s + q.y, 0) / g.length }; return `${i + 1}. (${r0(c.x)}, ${r0(c.y)}) ${g.length > 1 ? `${g.length} formes collées : ` : ""}${g.map(desc).join(" + ")}`; });
    return { text: `${G.length} symbole(s) probable(s) dans la zone x ${r0(z.x)}–${r0(z.x + z.w)}, y ${r0(z.y)}–${r0(z.y + z.h)}${G.length > 150 ? " (150 premiers)" : ""} :\n${lines.join("\n") || "aucun"}` };
  }
  if (name === "textes") {
    if (!ctx.texts || !ctx.texts.length) return { text: "Aucun texte lisible dans le PDF (scan ou texte vectorisé) : lis les inscriptions sur l'image (zoom)." };
    const z = zoneOf(I, W, H), L = ctx.texts.filter((t) => inZone(t, z)).slice(0, 200);
    const coded = L.length && L.filter((t) => /[a-zà-ü]{3,}|\d/i.test(t.s)).length / L.length < 0.3;
    return { text: `${L.length} texte(s) dans la zone${coded ? " — police codée probable (caractères sans sens) : lis plutôt l'image" : ""} :\n${L.map((t) => `« ${t.s} » (${r0(t.x)}, ${r0(t.y)}) h ${r0(t.h || 0)}`).join("\n") || "aucun"}` };
  }
  if (name === "murs") {
    if (!ctx.walls || !ctx.walls.length) return { text: "Aucun mur détecté dans les traits du PDF : relève-les sur l'image." };
    const z = zoneOf(I, W, H), L = ctx.walls.filter((w) => inZone({ x: (w.x1 + w.x2) / 2, y: (w.y1 + w.y2) / 2 }, z)).slice(0, 120);
    return { text: `${L.length} mur(s) détecté(s) (axe, épaisseur) :\n${L.map((w) => `(${r0(w.x1)}, ${r0(w.y1)}) → (${r0(w.x2)}, ${r0(w.y2)}) ep ${r0(w.ep)} cm`).join("\n") || "aucun"}` };
  }
  if (name === "zoom") {
    if (!ctx.zoom) return { text: "Zoom indisponible." };
    if ((ctx.zoomsLeft ?? 8) <= 0) return { text: "Plus de zoom disponible pour cette analyse : réponds avec ce que tu as." };
    ctx.zoomsLeft = (ctx.zoomsLeft ?? 8) - 1;
    const z = zoneOf(I, W, H), r = await ctx.zoom(z);
    if (!r) return { text: "Zoom impossible sur cette zone." };
    return { text: `Zoom de la zone x ${r0(z.x)}–${r0(z.x + z.w)}, y ${r0(z.y)}–${r0(z.y + z.h)} (${r.W} × ${r.H} px ; pour une position, ramène-la en pixels de l'image ENTIÈRE : x = ${r0(z.x)} + px × ${(z.w / r.W).toFixed(3)}, y = ${r0(z.y)} + py × ${(z.h / r.H).toFixed(3)}).`, image: r.data };
  }
  if (name === "verifier") return { text: checkReleve(I, ctx) };
  return { text: `Outil inconnu : ${name}` };
}

// contrôle d'un relevé proposé (pixels de l'image) : décompte, liaisons, symboles du PDF non couverts
export function checkReleve({ appareils = [], liaisons = [] } = {}, ctx = {}) {
  const A = (appareils || []).filter((a) => a && a.t && Number.isFinite(+a.x) && Number.isFinite(+a.y));
  const cnt = {}; A.forEach((a) => (cnt[a.t] = (cnt[a.t] || 0) + 1));
  const lk = (liaisons || []).filter((l) => Array.isArray(l) && A[l[0]] && A[l[1]]);
  const lit = new Set(lk.map((l) => l[1])), cmd = new Set(lk.map((l) => l[0]));
  const out = [`Décompte : ${Object.entries(cnt).sort().map(([t, n]) => `${t} ${n}`).join(", ") || "aucun appareil"} (total ${A.length}).`];
  const noCmd = A.map((a, i) => [a, i]).filter(([a, i]) => LIGHT.has(a.t) && !lit.has(i));
  if (noCmd.length) out.push(`Lumières sans commande (${noCmd.length}) : ${noCmd.slice(0, 15).map(([a, i]) => `n° ${i} ${a.t} (${r0(a.x)}, ${r0(a.y)})`).join(", ")}.`);
  const idle = A.map((a, i) => [a, i]).filter(([a, i]) => CMD.has(a.t) && !cmd.has(i));
  if (idle.length) out.push(`Commandes qui n'allument rien (${idle.length}) : ${idle.slice(0, 15).map(([a, i]) => `n° ${i} ${a.t} (${r0(a.x)}, ${r0(a.y)})`).join(", ")}.`);
  const vr = A.filter((a) => a.t === "VR").length, cvr = A.filter((a) => a.t === "CVR").length;
  if (vr !== cvr) out.push(`Volets : ${vr} VR pour ${cvr} CVR (en général une commande par volet).`);
  const vv = A.filter((a) => a.t === "VV").length;
  if (vv === 1) out.push("Un seul va-et-vient : il en faut au moins deux pour un même allumage (sinon INT).");
  if (ctx.vector && ctx.shapes) {
    const S = groupsOf(symbolShapes(ctx.shapes, ctx.W)).map((g) => ({ x: g.reduce((s, q) => s + q.x, 0) / g.length, y: g.reduce((s, q) => s + q.y, 0) / g.length, w: Math.max(...g.map((q) => Math.max(q.w, q.h))) }));
    const free = S.filter((s) => !A.some((a) => Math.hypot(a.x - s.x, a.y - s.y) <= Math.max(s.w, ctx.W * 0.008)));
    out.push(`Symboles probables du PDF : ${S.length} ; sans appareil relevé à leur place : ${free.length}${free.length ? " — à regarder (zoom) : " + free.slice(0, 25).map((s) => `(${r0(s.x)}, ${r0(s.y)})`).join(" ") : ""}. (Une forme peut être du mobilier ou un sanitaire : n'ajoute un appareil que si c'est un symbole électrique de la légende.)`);
  }
  return out.join("\n");
}
// consigne ajoutée au relevé quand les outils sont proposés
export const TOOLS_GUIDE = `Outils d'Oktéo (coordonnées en pixels de cette image) : appelle d'abord « legende », puis pour chaque quart du plan « symboles » et « textes » (et « murs ») ; « zoom » quand un symbole ou une inscription est serré ; enfin « verifier » avec ta liste d'appareils et de liaisons, corrige ce qu'il signale, puis donne ta réponse JSON finale (sans appeler d'autre outil).`;
