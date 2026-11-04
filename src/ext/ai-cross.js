// v76 étape 4 : mode 4 « Analyse approfondie » — partie navigateur.
// - secondReading : seconde lecture COMPLÈTE du plan, indépendante (parcours pièce par pièce), même sans alerte, sur le
//   plan entier rendu à la meilleure définition permise (PDF vectoriel rendu de nouveau, sinon pixels du fond).
// - crossCheck : documents du dossier = autres pages du PDF du chantier (hors pages de plan des niveaux) + documents
//   joints sur l'écran des modes (PDF, images) ; texte lu par pdf.js, page sans texte (scan) envoyée en image ;
//   une seule question à l'IA → liste ciblée d'écarts (équipements des documents absents du plan, quantités différentes).
//   Sans aucun document : partie désactivée proprement, et dit à l'opérateur.
import * as CHS from "../chantiers.js";
import { analysisPages } from "../walls/page-roles.js";
import { pdfjs } from "./fond-import.js";
import { AI_SYSTEM } from "../walls/ai-data.js";
import { aiPrompt, parseAiJson, aiToPlan } from "../walls/ai-plan.js";
import { SECOND_METHOD, planSummary, crossPrompt, parseCross, CROSS_OFF } from "../walls/ai-cross.js";
import { fitSize } from "../walls/ai-tiles.js";

const LIM = { sources: 10, images: 6, chars: 6000, total: 30000, minText: 80 };

export async function secondReading({ api, S, call }) {
  const R = await S.render(S.box, {});
  const text = SECOND_METHOD + "\n\n" + aiPrompt({ W: R.W, H: R.H, cmPerPx: R.map.sx * 100 });
  const r = await call("2e lecture", { system: AI_SYSTEM, messages: [{ role: "user", blocks: [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: R.data } }, { type: "text", text }] }], maxTokens: 12000 });
  const P = aiToPlan(parseAiJson(r.text), R.map, { defEp: api.state.wallEp });
  return { devices: P.devices, links: P.links, text: r.text };
}

// pages de plan à exclure du PDF du chantier : la page du niveau ouvert et celles des autres niveaux
function planPages(api) {
  const s = new Set(); if (api.ch.fond && api.ch.fond.page) s.add(api.ch.fond.page);
  for (const l of api.levels || []) if (l.fond && l.fond.page) s.add(l.fond.page);
  return s;
}
async function openDoc(data) { const L = await pdfjs(); return L.getDocument({ data }).promise; }
const canvasImage = (c) => c.toDataURL("image/jpeg", 0.85).split(",")[1];
async function pageSource(page, source) {
  const tc = await page.getTextContent(), text = tc.items.map((i) => i.str).join(" ").replace(/\s+/g, " ").trim();
  if (text.length >= LIM.minText) return { source, text: text.slice(0, LIM.chars) };
  const vp1 = page.getViewport({ scale: 1 }), { W, H } = fitSize(vp1.width * 3, vp1.height * 3), sc = W / vp1.width, vp = page.getViewport({ scale: sc });
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
  await page.render({ canvasContext: g, viewport: vp }).promise;
  return { source: source + " (page sans texte : image)", image: canvasImage(c) };
}
async function imageSource(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("image illisible")); i.src = url; });
    const { W, H } = fitSize(img.naturalWidth, img.naturalHeight), c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, W, H); g.drawImage(img, 0, 0, W, H);
    return { source: file.name, image: canvasImage(c) };
  } finally { URL.revokeObjectURL(url); }
}

// nombre d'autres pages dans le PDF du chantier (écran des modes, mode 4)
export async function otherPages(api) {
  const AP = analysisPages(api.ch.dossier);   // n° 15 : rôles des pages : plan cuisine et devis seulement
  if (AP) return AP.length;
  const blob = await CHS.getFile(CHS.pdfKey(api.ch)).catch(() => null);
  if (!blob) return 0;
  try { const d = await openDoc(new Uint8Array(await blob.arrayBuffer())), n = d.numPages, skip = planPages(api); await d.destroy(); return [...Array(n).keys()].filter((i) => !skip.has(i + 1)).length; }
  catch { return 0; }
}

// documents → sources pour la consigne (bornées : 10 sources, 6 images, 6 000 caractères par page, 30 000 au total)
export async function gatherDocs(api, files = []) {
  const out = [];
  const push = (s) => { if (out.length >= LIM.sources) return; if (s.image && out.filter((x) => x.image).length >= LIM.images) return; if (s.text && out.reduce((n, x) => n + (x.text ? x.text.length : 0), 0) + s.text.length > LIM.total) return; out.push(s); };
  const blob = await CHS.getFile(CHS.pdfKey(api.ch)).catch(() => null);
  if (blob) {
    try {
      const d = await openDoc(new Uint8Array(await blob.arrayBuffer())), skip = planPages(api), AP = analysisPages(api.ch.dossier);
      // n° 15 : avec les rôles des pages, seulement le plan cuisine et le devis ; sans, toutes les pages hors plans
      if (AP) { for (const x of AP) if (x.page <= d.numPages) push(await pageSource(await d.getPage(x.page), `${x.label} (PDF du chantier)`)); }
      else for (let i = 1; i <= Math.min(d.numPages, 30); i++) if (!skip.has(i)) push(await pageSource(await d.getPage(i), `PDF du chantier, page ${i}`));
      await d.destroy();
    } catch { /* PDF illisible : on continue avec les documents joints */ }
  }
  for (const f of files) {
    try {
      if (/pdf$/i.test(f.type) || /\.pdf$/i.test(f.name)) { const d = await openDoc(new Uint8Array(await f.arrayBuffer())); for (let i = 1; i <= Math.min(d.numPages, 30); i++) push(await pageSource(await d.getPage(i), `${f.name}, page ${i}`)); await d.destroy(); }
      else if (/^image\//i.test(f.type)) push(await imageSource(f));
    } catch { push({ source: `${f.name} (illisible)`, text: "(document joint illisible)" }); }
  }
  return out;
}

export async function crossCheck({ api, devices, rooms, docs = [], call }) {
  const sources = await gatherDocs(api, docs);
  if (!sources.length) return { off: CROSS_OFF, list: [] };
  const summary = planSummary(devices, rooms);
  const blocks = [...sources.filter((s) => s.image).map((s) => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: s.image } })), { type: "text", text: crossPrompt(summary, sources) }];
  const r = await call("contrôle croisé", { system: AI_SYSTEM, messages: [{ role: "user", blocks }], maxTokens: 4000 }, { documents: sources.length });
  const P = parseCross(parseAiJson(r.text));
  return { sources: sources.map((s) => s.source).join(", "), list: P.list, natures: P.docs, remarques: P.remarques };
}
