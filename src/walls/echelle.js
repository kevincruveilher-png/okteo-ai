// Pur (sans DOM) : lecture de l'échelle écrite sur un plan (lot 1 du 05/11/2026).
// Lot 1 (05/11/2026) : échelle écrite sur le plan (« Ech : 1:50 », « ÉCHELLE 1/100 », « 1/50 » seul) : N ou null.
// Un texte isolé « 1/50 » ou « 1:50 » compte ; ailleurs, il faut le mot « échelle » / « ech » juste avant.
export const ECHELLES = [20, 25, 50, 75, 100, 125, 200];
export function writtenScale(texts) {
  const strs = (texts || []).map((t) => String(t.str || "").trim()).filter(Boolean);
  const pick = (n) => (ECHELLES.includes(+n) ? +n : null);
  for (const s of strs) { const m = /^1\s*[:/]\s*(\d{2,3})$/.exec(s); if (m && pick(m[1])) return pick(m[1]); }
  const all = strs.join(" ");
  const m = /[ée]ch(?:elle)?\.?\s*:?\s*1\s*[:/]\s*(\d{2,3})\b/i.exec(all);
  return m ? pick(m[1]) : null;
}
