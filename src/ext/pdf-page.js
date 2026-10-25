// Page PDF du chantier ouvert (PDF d'origine gardé dans IndexedDB), chargée une fois et partagée par
// le relevé des murs et la détection des pièces : traits (segments) et étiquettes (noms de pièces).
import * as CHS from "../chantiers.js";
import { extractSegments } from "../walls/extract.js";
import { pageLabels } from "../walls/labels.js";
import { pageTexts } from "../walls/devices.js";
import { pdfjs } from "./fond-import.js";

let cache = null;   // { id, page, width, segs, labels: Map(clé d'échelle → étiquettes) }

// null si le chantier n'a pas de PDF ; sinon { page, width, segs, shapes }
export async function chantierPage(api) {
  const ch = api.ch;
  if (cache && cache.id === ch.id && cache.pageNo === (ch.fond && ch.fond.page)) return cache;
  const pdf = await CHS.getFile("pdf:" + ch.id).catch(() => null);
  if (!pdf || !ch.fond) return null;
  const L = await pdfjs();
  const doc = await L.getDocument({ data: new Uint8Array(await pdf.arrayBuffer()) }).promise;
  const page = await doc.getPage(ch.fond.page || 1);
  const ex = await extractSegments(page, L.OPS);
  cache = { id: ch.id, pageNo: ch.fond.page, page, width: ex.width, segs: ex.segs, shapes: ex.shapes, labels: new Map(), texts: null };
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
