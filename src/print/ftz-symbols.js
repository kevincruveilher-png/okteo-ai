// v74 MAJ 4 : symboles et couleurs du plan du BE (FTZ), partagés par l'écran et l'impression. Pur (sans DOM).
import { FTZ_NAMES } from "./ftz-sheet.js";

// couleur de chaque boîte, ordre verrouillé par Kévin (02/11/2026) : LI01 rouge, LI02 vert, LI03 magenta, LI04 bleu,
// LI05 noir, LI06 orange, LI07 violet ; à partir de LI08 le cycle recommence
export const BOX_COLORS = ["#FF0000", "#008000", "#FF00FF", "#0000FF", "#000000", "#FF8000", "#800080"];
export function boxColor(n) {
  const k = parseInt(String(n ?? "").replace(/\D/g, ""), 10);
  return BOX_COLORS[((k > 0 ? k : 1) - 1) % BOX_COLORS.length];
}
export const symKey = (t, h) => (t === "PC16" && h >= 100 ? "PC16H" : t);
// index nom de légende → symbole (premier trouvé sur les pages de la charte)
export function symIndex(C) {
  const m = new Map();
  (C.pages || []).forEach((p) => (p.legende || []).forEach((s) => { if (!m.has(s.name)) m.set(s.name, s); }));
  return m;
}
export function ftzSymbol(idx, t, h) {
  const n = idx && FTZ_NAMES[symKey(t, h)];
  return n ? idx.get(n) || null : null;
}
// plaques multipostes (Kévin : posées automatiquement d'après les appareils regroupés) : commandes et prises du même mur
// à moins de 25 cm les unes des autres → plaque double ou triple (au-delà : découpée par 3), verticale si les hauteurs
// diffèrent de plus de 20 cm, horizontale sinon ; chaque plaque reçoit une boîte d'encastrement PROF 50 (à confirmer BE)
const MULTI = new Set(["INT", "VV", "BP", "CVR", "PC16", "PC20", "RJ45", "TV", "PCEXT", "CVMC", "BPS"]);
export function plaques(apps, near = 0.25) {
  const L = apps.filter((a) => MULTI.has(a.t) && a.wall), used = new Set(), out = [];
  for (const a of L) {
    if (used.has(a.id)) continue;
    const g = [a]; used.add(a.id);
    for (let i = 0; i < g.length; i++) for (const b of L) {
      if (used.has(b.id)) continue;
      const par = Math.abs(g[i].wall.ux * b.wall.uy - g[i].wall.uy * b.wall.ux) < 0.1;
      if (par && Math.hypot(g[i].x - b.x, g[i].y - b.y) <= near) { g.push(b); used.add(b.id); }
    }
    if (g.length < 2) continue;
    const ux = a.wall.ux, uy = a.wall.uy;
    g.sort((p, q) => (p.x * ux + p.y * uy) - (q.x * ux + q.y * uy) || (q.h ?? 0) - (p.h ?? 0));
    for (let i = 0; i < g.length; i += 3) {
      const part = g.slice(i, i + 3);
      if (part.length < 2) { out[out.length - 1]?.ids.push(part[0].id); continue; }
      const hs = part.map((p) => p.h ?? 0), vert = Math.max(...hs) - Math.min(...hs) > 20;
      out.push({ ids: part.map((p) => p.id), n: part.length, vert, x: part.reduce((s, p) => s + p.x, 0) / part.length, y: part.reduce((s, p) => s + p.y, 0) / part.length, wall: { ux, uy }, room: a.room });
    }
  }
  return out.map((p) => ({ ...p, n: Math.min(3, p.ids.length), name: `Plaque ${Math.min(3, p.ids.length) === 3 ? "triple" : "double"} ${p.vert ? "Verticale" : "Horizontale"}` }));
}
