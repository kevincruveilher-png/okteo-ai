// n° 16 (bloc D, 04/11/2026) + lot 2 (05/11/2026) : mémoire des symboles par pavillonneur, COMMUNE à tous les postes en ligne. Fiche = type Oktéo, description, extrait du dessin,
// pavillonneur, chantier d'origine, qui a validé, date. Seul un symbole validé par un opérateur y entre (bouton
// « Mémoriser ce symbole » dans Propriétés). Lue par l'IA (outil « legende ») ; les symboles BE de la bibliothèque commune
// (administration en ligne) qui ont une correspondance Oktéo en font partie aussi.
import { loadSymbols } from "./symbols-data.js";
import { store, storeSet } from "./util.js";

const KEY = "okteo.symmemo.v1";
const norm = (s) => String(s || "").trim().toLowerCase();
const online = () => typeof window !== "undefined" && !!window.okteoSession;
export function memoAll() { const m = store(KEY, null); return m && typeof m === "object" && !Array.isArray(m) ? m : {}; }
// symboles connus pour un pavillonneur : sa mémoire + les symboles BE communs (avec correspondance Oktéo)
export function symbolMemory(pav) {
  const own = (memoAll()[norm(pav)] || []).map((e) => ({ ...e, pav: e.pav || pav }));
  let be = [];
  try { be = (loadSymbols().be || []).filter((e) => e.type && (!e.pav || norm(e.pav) === norm(pav))).map((e) => ({ type: e.type, desc: [e.name, e.notes].filter(Boolean).join(" — "), pav: e.pav || "", chantier: e.source || "", commun: true })); } catch { /* bibliothèque illisible */ }
  return [...own, ...be];
}
// lot 2 (05/11/2026) : toutes les variantes enregistrées d'un type Oktéo, tous pavillonneurs confondus (bibliothèque)
export function variantsOf(type) {
  const out = [];
  for (const [k, L] of Object.entries(memoAll())) for (const e of L || []) if (e.type === type) out.push({ ...e, pav: e.pav || (k === "(sans pavillonneur)" ? "" : k) });
  return out.sort((a, b) => String(a.pav).localeCompare(String(b.pav)) || String(b.at).localeCompare(String(a.at)));
}
// enregistre un symbole validé par l'opérateur ; même type et même description chez ce pavillonneur = pas de doublon.
// Lot 2 : en version en ligne, la fiche part aussi dans la mémoire COMMUNE du serveur (tous les postes la voient).
// MAJ mémoire : `lu` = type que l'IA avait donné (ex. « XYZ », ou « LUM » avec un doute), `inscription` = texte voisin :
// ce qui permet de reconnaître le même dessin à la prochaine analyse (src/walls/ai-memory.js)
export function remember({ pav, type, desc, chantier = "", by = "", image = "", lu = "", inscription = "" }) {
  if (!type) return null;
  const M = memoAll(), k = norm(pav) || "(sans pavillonneur)", L = M[k] || [];
  const e = { id: "sm-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), type, desc: String(desc || type).slice(0, 300), pav: pav || "", chantier, by, at: new Date().toISOString(), image, lu: String(lu || "").slice(0, 24), inscription: String(inscription || "").slice(0, 80) };
  const same = L.find((x) => x.type === e.type && norm(x.desc) === norm(e.desc));
  if (same) Object.assign(same, { image: e.image || same.image, at: e.at, by: e.by || same.by, chantier: e.chantier || same.chantier, lu: e.lu || same.lu || "", inscription: e.inscription || same.inscription || "", pending: true });
  else L.push({ ...e, pending: true });
  M[k] = L; storeSet(KEY, M);
  const out = same || L[L.length - 1];
  if (online()) push(out).catch(() => { /* gardée en attente, renvoyée à la prochaine synchronisation */ });
  return out;
}
export function forget(pav, id) {
  const M = memoAll(), k = norm(pav) || "(sans pavillonneur)", e = (M[k] || []).find((x) => x.id === id);
  M[k] = (M[k] || []).filter((x) => x.id !== id); storeSet(KEY, M);
  if (e && e.server && online()) return api("/api/symbol-memory/delete", { id: e.server });
  return Promise.resolve({ ok: true });
}
async function api(path, data) { const { request } = await import("../web/client.js"); return request(path, data); }
async function push(e) {
  const r = await api("/api/symbol-memory", { type: e.type, pav: e.pav, desc: e.desc, chantier: e.chantier, lu: e.lu || "", inscription: e.inscription || "", image: e.image && e.image.length <= 90000 ? e.image : "" });
  const M = memoAll();
  for (const L of Object.values(M)) for (const x of L || []) if (x.id === e.id) { x.server = r.id; delete x.pending; }
  storeSet(KEY, M);
  return r;
}
// lot 2 : synchronisation avec la mémoire commune (version en ligne) : fiches en attente envoyées, puis la liste du serveur
// remplace les fiches déjà connues du serveur (les fiches locales jamais envoyées sont gardées)
export async function syncMemory() {
  if (!online()) return { ok: false, offline: true };
  const M0 = memoAll();
  for (const L of Object.values(M0)) for (const e of L || []) if (e.pending) await push(e).catch(() => null);
  const list = await api("/api/symbol-memory");
  const M = {};
  for (const [k, L] of Object.entries(memoAll())) { const keep = (L || []).filter((e) => !e.server); if (keep.length) M[k] = keep; }
  for (const e of list || []) { const k = norm(e.pav) || "(sans pavillonneur)"; (M[k] ||= []).push({ ...e, id: e.server }); }
  storeSet(KEY, M);
  document.dispatchEvent(new CustomEvent("okteo:symbol-memory"));
  return { ok: true, n: (list || []).length };
}

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
