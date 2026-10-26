// Page PDF du chantier ouvert (PDF d'origine gardé dans IndexedDB), chargée une fois et partagée par
// le relevé des murs et la détection des pièces : traits (segments) et étiquettes (noms de pièces).
import * as CHS from "../chantiers.js";
import { extractSegments } from "../walls/extract.js";
import { pageLabels } from "../walls/labels.js";
import { pageTexts } from "../walls/devices.js";
import { solveDigits } from "../walls/digits.js";
import { pdfjs } from "./fond-import.js";

let cache = null;   // { id, page, width, segs, labels: Map(clé d'échelle → étiquettes) }

// null si le chantier n'a pas de PDF ; sinon { page, width, segs, shapes }
export async function chantierPage(api) {
  const ch = api.ch;
  const key = CHS.pdfKey(ch);
  if (cache && cache.id === ch.id && cache.key === key && cache.pageNo === (ch.fond && ch.fond.page)) return cache;
  const pdf = await CHS.getFile(key).catch(() => null);
  if (!pdf || !ch.fond) return null;
  const L = await pdfjs();
  const doc = await L.getDocument({ data: new Uint8Array(await pdf.arrayBuffer()) }).promise;
  const page = await doc.getPage(ch.fond.page || 1);
  const ex = await extractSegments(page, L.OPS);
  cache = { id: ch.id, key, pageNo: ch.fond.page, page, width: ex.width, segs: ex.segs, shapes: ex.shapes, labels: new Map(), texts: null };
  return cache;
}

// repère page → mètres du fond actuel
export const pageMap = (api, P) => ({ k: api.BG.w / P.width, ox: api.BG.x, oy: api.BG.y });

// étiquettes de pièces du PDF, en mètres (mises en cache pour l'échelle actuelle)
export async function chantierLabels(api) {
  const P = await chantierPage(api); if (!P) return [];
  const m = pageMap(api, P), key = [m.k, m.ox, m.oy].map((v) => v.toFixed(6)).join("|");
  if (!P.labels.has(key)) P.labels.set(key, await pageLabels(P.page, m).catch(() => []));
  return P.labels.get(key);
}

// tous les textes de la page, en points de page (pour le relevé des appareils : « 16A », « RJ45 », « H:1.20m »…)
export async function chantierTexts(api) {
  const P = await chantierPage(api); if (!P) return null;
  if (!P.texts) P.texts = await pageTexts(P.page).catch(() => []);
  return P.texts;
}

// contrôle de l'échelle du fond par les cotes du plan : { facteur, cotes } (facteur 1 = échelle juste ; 1,05 = le plan
// réel est 5 % plus grand que le fond) ou null si les cotes ne se lisent pas
export async function chantierScaleCheck(api) {
  const P = await chantierPage(api); if (!P) return null;
  const texts = await chantierTexts(api), m = pageMap(api, P), key = "scale|" + m.k.toFixed(8);
  if (P.labels.has(key)) return P.labels.get(key);
  const sols = [...solveDigits(texts, P.segs, m.k).values()].sort((a, b) => b.checked - a.checked);
  const r = sols.length ? { facteur: sols[0].scale, cotes: sols[0].checked } : null;
  P.labels.set(key, r);
  return r;
}

// Échelle automatique : un fond PDF pas encore mis à l'échelle l'est d'après ses cotes (au moins 4 cotes concordantes),
// sans rien demander. { ok, auto, cotes } ; ok = false si le fond n'a pas d'échelle et que les cotes ne se lisent pas.
export async function autoScale(api) {
  const f = api.ch.fond;
  if (!f) return { ok: false, cotes: 0 };
  if (f.calibre) return { ok: true, auto: false };
  const s = await chantierScaleCheck(api).catch(() => null);
  if (!s || s.cotes < 4 || !(s.facteur > 0)) return { ok: false, cotes: s ? s.cotes : 0 };
  const a = { x: api.BG.x, y: api.BG.y };
  autoScale.busy = true;
  try { api.applyCalib(a, { x: a.x + 1, y: a.y }, s.facteur); } finally { autoScale.busy = false; }
  return { ok: !!api.ch.fond.calibre, auto: true, cotes: s.cotes };
}
