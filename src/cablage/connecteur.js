// 07/11/2026 (Kévin) : schéma de boîte (onglet Bandes et page du QR code) : un clic sur un numéro de raccordement ne
// garde nets que ce numéro et ses fils (tout le reste en fantôme), et montre le connecteur rapide à utiliser (nombre de
// places, un fil par place à sa couleur ; au-delà du plus gros connecteur, plusieurs connecteurs reliés par un pont).
// Commun à l'écran du BE et au téléphone ; aucune donnée n'est modifiée.

export const GHOST = "0.1";

// fantôme : tout ce qui n'est pas le n° demandé (n = null : tout revient). Les fils, bornes et tracés portent data-n ;
// titres de gaine, gaines de câble et bagues portent data-ns (n° de leurs fils) : une gaine qui amène un fil du n° reste nette.
export function numberFocus(svg, n) {
  if (!svg) return 0;
  let kept = 0;
  svg.querySelectorAll("[data-n], [data-ns]").forEach((el) => {
    if (n == null) { el.style.opacity = ""; return; }
    const keep = el.hasAttribute("data-n") ? el.getAttribute("data-n") === String(n) : (" " + (el.getAttribute("data-ns") || "") + " ").includes(" " + n + " ");
    el.style.opacity = keep ? "" : GHOST;
    if (keep) kept++;
  });
  return kept;
}

// places de chaque connecteur pour les fils (cap = places libres pour des fils) : un seul connecteur = toutes ses places ; plusieurs = une place de chaque
// côté prise par le pont (le premier et le dernier en perdent une, ceux du milieu deux) — même règle que connectorsFor
export function connectorPlaces(conn) {
  const L = (conn && conn.list) || [];
  if (L.length <= 1) return L.map((k) => ({ size: k, cap: k }));
  return L.map((k, i) => ({ size: k, cap: k - (i === 0 || i === L.length - 1 ? 1 : 2) }));
}

// 07/11/2026 (Kévin, 2e passe) : dessin compact, juste ce qu'il faut pour prendre le bon connecteur : ses places et les
// fils qui en sortent, à leur couleur. Jusqu'à 5 places : une rangée ; 6, 8, 10, 12 : deux rangées (3 + 3, 4 + 4, 5 + 5,
// 6 + 6). Plusieurs connecteurs : reliés par un pont de la couleur des fils (en général la terre).
export const rowsOf = (size) => (size <= 5 ? 1 : 2);
export function connecteurSVG(step, { color = () => "#999" } = {}) {
  const P = connectorPlaces(step.conn), W = step.wires || [];
  if (!P.length) return "";
  const PT = 15, PS = 11, PAD = 5, STUB = 12, GAP = 26;
  const geo = P.map((c) => { const rows = rowsOf(c.size), cols = Math.ceil(c.size / rows); return { ...c, rows, cols, w: cols * PT + PAD * 2 - (PT - PS), h: rows * PT + PAD * 2 - (PT - PS) }; });
  const Y0 = geo.some((g) => g.rows === 2) ? STUB + 2 : 2;   // fils vers le haut seulement avec deux rangées
  const H = Y0 + Math.max(...geo.map((g) => g.h)) + STUB + 2;
  let x = 0, wi = 0, h = "";
  const ports = [], pc = color((W[0] || {}).color), vj = /jaune/.test((W[0] || {}).color || "");
  geo.forEach((c, ci) => {
    h += `<g class="cn" data-size="${c.size}" data-rows="${c.rows}"><rect x="${x}" y="${Y0}" width="${c.w}" height="${c.h}" rx="4" fill="#e9edf1" stroke="#3a4552" stroke-width="1.4"/>`;
    const at = [];
    for (let p = 0; p < c.size; p++) {
      const r = Math.floor(p / c.cols), k = p % c.cols, px = x + PAD + k * PT, py = Y0 + PAD + r * PT;
      at.push({ x: px + PS / 2, y: py + PS / 2, top: c.rows === 2 && r === 0, py });
    }
    // places prises par les fils (un pont occupe la dernière place du premier connecteur, la première du dernier)
    const used = new Map();
    for (let p = 0; p < c.cap && wi < W.length; p++, wi++) used.set(ci === 0 || P.length === 1 ? p : p + 1, W[wi]);
    at.forEach((q, p) => {
      const pont = P.length > 1 && ((ci > 0 && p === 0) || (ci < P.length - 1 && p === c.size - 1));
      const w = used.get(p), col = w ? color(w.color) : pont ? pc : "#fff";
      if (w) {
        const y1 = q.top ? 1 : H - 1;
        h += `<line class="cw" x1="${q.x}" y1="${q.y}" x2="${q.x}" y2="${y1}" stroke="${col}" stroke-width="4.5" stroke-linecap="round"/>`;
        if (/jaune/.test(w.color || "")) h += `<line x1="${q.x}" y1="${q.y}" x2="${q.x}" y2="${y1}" stroke="${color("vert")}" stroke-width="4.5" stroke-dasharray="4 4"/>`;
      }
      h += `<rect x="${q.x - PS / 2}" y="${q.py}" width="${PS}" height="${PS}" rx="2" fill="${col}" stroke="#3a4552" stroke-width="1"/>`;
    });
    h += `</g>`;
    ports.push(at);
    x += c.w + GAP;
  });
  // ponts : du dernier trou d'un connecteur au premier du suivant
  for (let i = 0; i + 1 < ports.length; i++) {
    const a = ports[i][ports[i].length - 1], b = ports[i + 1][0], d = `M${a.x} ${a.y} C ${a.x + GAP} ${a.y}, ${b.x - GAP} ${b.y}, ${b.x} ${b.y}`;
    h += `<path class="pont" d="${d}" fill="none" stroke="${pc}" stroke-width="4.5" stroke-linecap="round"/>` + (vj ? `<path d="${d}" fill="none" stroke="${color("vert")}" stroke-width="4.5" stroke-dasharray="4 4"/>` : "");
  }
  const total = x - GAP;
  return `<svg class="cn-svg" viewBox="-3 -1 ${total + 6} ${H + 2}" width="${Math.round((total + 6) * 1.15)}" height="${Math.round((H + 2) * 1.15)}" role="img" aria-label="Connecteur${P.length > 1 ? "s" : ""} ${P.map((c) => c.size).join(" + ")}">${h}</svg>`;
}

// infobulle du dessin : « 7 · Neutre · 2 fils → connecteur 2 »
export function connecteurTitle(step) {
  const P = connectorPlaces(step.conn), n = step.wires.length;
  return `${step.n} · ${step.label} · ${n} fil${n > 1 ? "s" : ""} → ${!P.length ? "fil seul" : P.length === 1 ? `connecteur ${P[0].size}` : `connecteurs ${P.map((c) => c.size).join(" + ")} reliés par un pont`}`;
}
// contenu du coin de la bande : le dessin seul (rien d'autre), avec l'infobulle ; fil seul = un petit avertissement
export function connecteurCard(step, o = {}) {
  const t = connecteurTitle(step), svg = connecteurSVG(step, o), e = o.esc || ((v) => String(v));
  return svg ? `<div class="cn-only" title="${e(t)}">${svg}</div>` : `<div class="cn-only cn-alone" title="${e(t)}">fil seul</div>`;
}
