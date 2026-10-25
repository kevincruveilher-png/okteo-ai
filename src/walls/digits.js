// Lecture des chiffres d'un PDF à police « codée » (les caractères du texte ne correspondent pas aux lettres dessinées).
// Idée : les cotes du plan donnent la réponse. Une cote « 1.50 » est posée le long d'un trait de cote qui mesure 1,50 m
// sur le plan. En comparant chaque texte court à la longueur des traits voisins, on retrouve quel code correspond à quel
// chiffre (vote, puis attribution un code ↔ un chiffre), et on vérifie que la majorité des cotes se relisent juste.
// Ensuite tous les textes de la même police se lisent : « 16A H:1.20m », « 20A », « 32A H:0.65m »…
// Un PDF lisible (vrais chiffres) donne simplement la correspondance identique.

const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const SEPS = [" ", ".", ","];

// textes : {str, x, y, size, ang, font} en points de page ; segs : segments droits (extract.js) ; k : mètres par point
export function solveDigits(texts, segs, k, { tol = 0.02 } = {}) {
  const fonts = new Map();
  for (const t of texts) { if (!fonts.has(t.font)) fonts.set(t.font, []); fonts.get(t.font).push(t); }
  const lines = segs.filter((s) => s.stroke && dist(s.x1, s.y1, s.x2, s.y2) * k >= 0.1);
  const res = new Map();
  for (const [font, list] of fonts) {
    const sol = solveFont(list, lines, k, tol);
    if (sol) res.set(font, sol);
  }
  return res;   // police → { map: Map(code → "0".."9"), checked, total, scale (facteur d'échelle vu par les cotes) }
}

function candidatesFor(t, lines, k) {
  // traits parallèles au texte, qui passent tout près (le texte est posé sur ou juste à côté du trait de cote)
  const ux = Math.cos(t.ang), uy = -Math.sin(t.ang), out = [];
  for (const s of lines) {
    const L = dist(s.x1, s.y1, s.x2, s.y2), vx = (s.x2 - s.x1) / L, vy = (s.y2 - s.y1) / L;
    if (Math.abs(vx * ux + vy * uy) < 0.98) continue;
    const px = t.x - s.x1, py = t.y - s.y1, along = px * vx + py * vy, perp = Math.abs(px * -vy + py * vx);
    if (perp > t.size * 1.6 || along < L * 0.15 || along > L * 0.85) continue;
    out.push({ v: L * k, perp });
  }
  return out.sort((a, b) => a.perp - b.perp).slice(0, 3).map((o) => o.v);
}

// toutes les écritures possibles d'une longueur (m) : « 1.50 », « 150 » (cm) ; avec la tolérance d'échelle
function writings(v, tol) {
  const out = new Set();
  for (const f of [1 - tol, 1 - tol / 2, 1, 1 + tol / 2, 1 + tol]) {
    const cm = Math.round(v * f * 100);
    if (cm >= 100) out.add((cm / 100).toFixed(2));
    if (cm >= 10 && cm < 1000) out.add(String(cm));
  }
  return [...out];
}

function solveFont(list, lines, k, tol) {
  const base = [];
  for (const t of list) {
    const s = [...t.str];
    if (s.length < 2 || s.length > 5) continue;
    const cands = candidatesFor(t, lines, k);
    if (cands.length) base.push({ s, cands });
  }
  if (base.length < 4) return null;
  // séparateur décimal de cette police : le caractère (espace, point, virgule) le plus souvent 3e en partant de la fin
  const sc = {};
  base.forEach((it) => { const c = it.s[it.s.length - 3]; if (it.s.length >= 4 && SEPS.includes(c)) sc[c] = (sc[c] || 0) + 1; });
  const sep = Object.entries(sc).sort((a, b) => b[1] - a[1])[0]?.[0] ?? " ";
  base.forEach((it) => (it.sep = sep));
  // l'échelle du fond peut être un peu fausse (ou pas encore réglée) : on essaie des facteurs de 0,3 à 3
  let best = null;
  for (let f = 0.3; f <= 3; f *= 1 + tol / 2) {
    const sol = tryScale(base, f, tol / 2);
    if (sol && (!best || sol.checked > best.checked)) best = { ...sol, scale: f };
  }
  if (!best) return null;
  // affinage de l'échelle : médiane des rapports « valeur écrite / longueur mesurée » sur les cotes relues
  const ratios = [];
  for (const it of base) {
    const read = it.s.map((c) => (c === sep ? "." : best.map.get(c) || "?")).join("");
    if (read.includes("?")) continue;
    const val = read.includes(".") ? parseFloat(read) : parseInt(read, 10) / 100;
    const v = it.cands.reduce((m, c) => (Math.abs(c * best.scale - val) < Math.abs(m * best.scale - val) ? c : m));
    if (Math.abs(v * best.scale - val) / val < tol * 1.5) ratios.push(val / v);
  }
  if (ratios.length) { ratios.sort((a, b) => a - b); best.scale = ratios[ratios.length >> 1]; }
  best.sep = sep;
  return best;
}

function tryScale(base, f, tol) {
  const items = [];
  for (const it of base) {
    const ws = [...new Set(it.cands.flatMap((v) => writings(v * f, tol)))].filter((w) => w.length === it.s.length);
    // le séparateur décimal du texte doit être à la même place que le point
    const ok = ws.filter((w) => [...w].every((c, i) => (c === ".") === (it.s[i] === it.sep)));
    if (ok.length) items.push({ s: it.s, ws: ok, sep: it.sep });
  }
  if (items.length < 4) return null;
  // votes code → chiffre
  const votes = new Map();
  for (const it of items) for (const w of it.ws) [...w].forEach((c, i) => {
    if (c === ".") return;
    const key = it.s[i] + "\u0000" + c; votes.set(key, (votes.get(key) || 0) + 1 / it.ws.length);
  });
  const map = new Map(), used = new Set();
  [...votes.entries()].sort((a, b) => b[1] - a[1]).forEach(([key, n]) => {
    const [code, d] = key.split("\u0000");
    if (n < 1.5 || map.has(code) || used.has(d)) return;
    map.set(code, d); used.add(d);
  });
  // contrôle : combien de cotes se relisent exactement ?
  const score = () => items.reduce((n, it) => n + (it.ws.includes(it.s.map((c) => (c === it.sep ? "." : map.get(c) || "?")).join("")) ? 1 : 0), 0);
  let good = score();
  // chiffres rares (peu de cotes) : on les garde seulement s'ils font relire juste davantage de cotes
  for (const [key, n] of [...votes.entries()].sort((a, b) => b[1] - a[1])) {
    const [code, d] = key.split("\u0000");
    if (n < 0.3 || map.has(code) || used.has(d)) continue;
    map.set(code, d); const g = score();
    if (g > good) { good = g; used.add(d); } else map.delete(code);
  }
  if (good < 5 || good < items.length * 0.6) return null;
  return { map, checked: good, total: base.length };
}
// texte lu avec la correspondance de sa police : chiffres et point décimal ; « ? » pour les autres caractères (lettres)
export function readDigits(t, sols) {
  const sol = sols && sols.get(t.font);
  return [...t.str].map((c) => {
    if (!sol) return /[0-9]/.test(c) ? c : c === "." || c === "," ? "." : c === " " ? " " : "?";
    if (sol.map.has(c)) return sol.map.get(c);
    if (c === sol.sep) return ".";
    return "?";
  }).join("");
}

// étiquette d'appareil : intensité (16, 20, 32 A) et hauteur en cm (« H:1.20m » → 120)
export function parseDeviceLabel(read) {
  const amp = /(?:^|[^0-9.])(\d\d)(?![0-9.])/.exec(read) || /^(\d\d)(?![0-9.])/.exec(read);
  const h = /(\d)\.(\d\d)(?!\d)/.exec(read);
  return { amp: amp ? +amp[1] : null, h: h ? Math.round(parseFloat(h[1] + "." + h[2]) * 100) : null };
}
