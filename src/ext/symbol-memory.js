// n° 16 (bloc D, 04/11/2026) : mémoire des symboles par pavillonneur. Fiche = type Oktéo, description, extrait du dessin,
// pavillonneur, chantier d'origine, qui a validé, date. Seul un symbole validé par un opérateur y entre (bouton
// « Mémoriser ce symbole » dans Propriétés). Lue par l'IA (outil « legende ») ; les symboles BE de la bibliothèque commune
// (administration en ligne) qui ont une correspondance Oktéo en font partie aussi.
import { loadSymbols } from "./symbols-data.js";
import { store, storeSet } from "./util.js";

const KEY = "okteo.symmemo.v1";
const norm = (s) => String(s || "").trim().toLowerCase();
export function memoAll() { const m = store(KEY, null); return m && typeof m === "object" && !Array.isArray(m) ? m : {}; }
// symboles connus pour un pavillonneur : sa mémoire + les symboles BE communs (avec correspondance Oktéo)
export function symbolMemory(pav) {
  const own = (memoAll()[norm(pav)] || []).map((e) => ({ ...e, pav: e.pav || pav }));
  let be = [];
  try { be = (loadSymbols().be || []).filter((e) => e.type && (!e.pav || norm(e.pav) === norm(pav))).map((e) => ({ type: e.type, desc: [e.name, e.notes].filter(Boolean).join(" — "), pav: e.pav || "", chantier: e.source || "", commun: true })); } catch { /* bibliothèque illisible */ }
  return [...own, ...be];
}
// enregistre un symbole validé par l'opérateur ; même type et même description chez ce pavillonneur = pas de doublon
export function remember({ pav, type, desc, chantier = "", by = "", image = "" }) {
  if (!type) return null;
  const M = memoAll(), k = norm(pav) || "(sans pavillonneur)", L = M[k] || [];
  const e = { id: "sm-" + Date.now().toString(36), type, desc: String(desc || type).slice(0, 300), pav: pav || "", chantier, by, at: new Date().toISOString(), image };
  const same = L.find((x) => x.type === e.type && norm(x.desc) === norm(e.desc));
  if (same) Object.assign(same, { image: e.image || same.image, at: e.at, by: e.by || same.by, chantier: e.chantier || same.chantier });
  else L.push(e);
  M[k] = L; storeSet(KEY, M);
  return same || e;
}
export function forget(pav, id) { const M = memoAll(), k = norm(pav); M[k] = (M[k] || []).filter((e) => e.id !== id); storeSet(KEY, M); }

// extrait du dessin autour d'un appareil (image du fond, 1,2 m de côté) en JPEG data URL, ou "" si pas de fond
export async function cropAround(api, a, side = 1.2) {
  const f = await api.levelFond(api.level.id).catch(() => null);
  if (!f) return "";
  const img = new Image(); img.crossOrigin = "anonymous";
  await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = f.url; }).catch(() => null);
  if (!img.naturalWidth) return "";
  const sx = img.naturalWidth / f.w, sy = img.naturalHeight / f.h, x = (a.x - f.x - side / 2) * sx, y = (a.y - f.y - side / 2) * sy, w = side * sx, h = side * sy;
  const c = document.createElement("canvas"), S = Math.min(220, Math.round(w)); c.width = S; c.height = Math.round(S * h / w);
  const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, x, y, w, h, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.8);
}
