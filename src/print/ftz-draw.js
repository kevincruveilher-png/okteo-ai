// Dessin des éléments de la charte FTZ (v74) à partir de `ftz-charte.json` : symboles de légende et cartouche,
// en SVG (unités = mm, y vers le bas). Le même dessin servira à l'écran et, converti, à l'impression (jsPDF).
const FONTS = {
  "Courier-Bold": { family: "'Courier New',Courier,monospace", weight: 700 },
  Courier: { family: "'Courier New',Courier,monospace", weight: 400 },
  Helvetica: { family: "Arial,Helvetica,sans-serif", weight: 400 },
  "Helvetica-Bold": { family: "Arial,Helvetica,sans-serif", weight: 700 },
  "Times-Roman": { family: "'Times New Roman',Times,serif", weight: 400 },
};
export const fontOf = (f) => FONTS[f] || FONTS.Helvetica;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function pathSVG(p) {
  const fill = p.fill && /B|f|F|b/.test(p.op) ? p.fill : "none";
  const stroke = p.stroke && /S|s|B|b/.test(p.op) ? p.stroke : "none";
  const rule = p.op.includes("*") ? ' fill-rule="evenodd"' : "";
  const dash = p.dash && p.dash.length ? ` stroke-dasharray="${p.dash.join(" ")}"` : "";
  return `<path d="${p.d}" fill="${fill}" stroke="${stroke}" stroke-width="${p.w || 0.01}"${rule}${dash} stroke-linecap="round" stroke-linejoin="round"/>`;
}

export function textSVG(t, fields = {}) {
  const F = fontOf(t.font), str = String(t.str).replace(/\{(\w+)\}/g, (m, k) => (fields[k] != null ? fields[k] : m));
  const r = t.sy ? t.sx / t.sy : 1;
  return `<text transform="translate(${t.at[0]} ${t.at[1]}) rotate(${-(t.angle || 0)}) scale(${r.toFixed(3)} 1)" font-family="${F.family}" font-weight="${F.weight}" font-size="${t.sy}" fill="${t.color || "#000"}">${esc(str)}</text>`;
}

// un symbole de légende, centré sur (x, y), agrandi k fois
export function symbolSVG(sym, x = 0, y = 0, k = 1) {
  return `<g transform="translate(${x} ${y}) scale(${k})">${sym.paths.map(pathSVG).join("")}${sym.texts.map((t) => textSVG(t)).join("")}</g>`;
}

export function cartoucheSVG(c, fields = {}) {
  // la phrase du logo est déjà dessinée par ses contours (logo.true) : pas de second texte par-dessus
  return `<g>${c.paths.map(pathSVG).join("")}${c.texts.filter((t) => !t.logo).map((t) => textSVG(t, fields)).join("")}</g>`;
}
