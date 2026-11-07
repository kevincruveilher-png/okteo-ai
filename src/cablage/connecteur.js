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

// dessin du ou des connecteurs d'un raccordement (step de boxSteps) ; color(c) = couleur pleine d'un fil
export function connecteurSVG(step, { color = () => "#999" } = {}) {
  const P = connectorPlaces(step.conn), W = step.wires || [];
  if (!P.length) return "";
  const PL = 22, GAP = 34, H = 108, bodyY = 14, bodyH = 46;
  const widths = P.map((c) => c.size * PL + 10), total = widths.reduce((s, w) => s + w, 0) + GAP * (P.length - 1);
  const pontCol = color((W[0] || {}).color);
  let x = 0, wi = 0, h = "";
  const holes = [];
  P.forEach((c, ci) => {
    const w = widths[ci];
    h += `<g class="cn" data-size="${c.size}"><rect x="${x}" y="${bodyY}" width="${w}" height="${bodyH}" rx="7" fill="#eef2f5" stroke="#3a4552" stroke-width="1.6"/>`;
    const H0 = [];
    for (let p = 0; p < c.size; p++) {
      const px = x + 5 + p * PL + PL / 2;
      // levier (en haut) et entrée (en bas)
      h += `<rect x="${px - 7}" y="${bodyY - 9}" width="14" height="16" rx="3" fill="#f28c1b" stroke="#8a4a08" stroke-width="1"/>`;
      h += `<rect x="${px - 5}" y="${bodyY + bodyH - 16}" width="10" height="12" rx="2" fill="#fff" stroke="#3a4552" stroke-width="1"/>`;
      H0.push(px);
    }
    // fils dans les places, à leur couleur (vert/jaune : jaune + tirets verts)
    for (let p = 0; p < c.cap && wi < W.length; p++, wi++) {
      const px = H0[ci === 0 || P.length === 1 ? p : p + 1], col = color(W[wi].color), y0 = bodyY + bodyH - 8;
      h += `<line class="cw" x1="${px}" y1="${y0}" x2="${px}" y2="${H - 12}" stroke="${col}" stroke-width="5" stroke-linecap="round"/>`;
      if (/jaune/.test(W[wi].color || "")) h += `<line x1="${px}" y1="${y0}" x2="${px}" y2="${H - 12}" stroke="${color("vert")}" stroke-width="5" stroke-dasharray="6 5"/>`;
    }
    h += `<text x="${x + w / 2}" y="${bodyY + 26}" text-anchor="middle" font-size="12" font-weight="700" fill="#2b3440">${c.size} places</text></g>`;
    holes.push(H0);
    x += w + GAP;
  });
  // ponts : du dernier trou d'un connecteur au premier du suivant (bout de fil de la même couleur)
  for (let i = 0; i + 1 < holes.length; i++) {
    const a = holes[i][holes[i].length - 1], b = holes[i + 1][0], y0 = bodyY + bodyH - 8, y1 = H - 4;
    h += `<path class="pont" d="M${a} ${y0} V${y1} H${b} V${y0}" fill="none" stroke="${pontCol}" stroke-width="5" stroke-linejoin="round"/><text x="${(a + b) / 2}" y="${y1 - 6}" text-anchor="middle" font-size="11" fill="#2b3440">pont</text>`;
  }
  return `<svg class="cn-svg" viewBox="-4 -2 ${total + 8} ${H + 4}" width="${Math.min(360, total + 8)}" role="img" aria-label="Connecteur${P.length > 1 ? "s" : ""} ${P.map((c) => c.size + " places").join(" + ")}">${h}</svg>`;
}

// fiche du n° (HTML) : titre, connecteur(s), fils à prendre ; o = { color, css, esc, name, short, fr }
export function connecteurCard(step, o) {
  const e = o.esc, n = step.wires.length, P = connectorPlaces(step.conn);
  const what = !P.length ? `<span class="warn">fil seul : vérifier</span>` : P.length === 1 ? `connecteur <b>${P[0].size} places</b>` : `${P.length} connecteurs ${P.map((c) => `<b>${c.size}</b>`).join(" + ")} places, reliés par ${P.length - 1} pont${P.length > 2 ? "s" : ""}`;
  return `<div class="cn-head"><b class="cn-n">${step.n}</b><span><b>${e(step.label)}</b><br>${n} fil${n > 1 ? "s" : ""} → ${what}</span><button type="button" class="cn-x" aria-label="Fermer" title="Tout afficher">✕</button></div>
    ${connecteurSVG(step, o)}
    <ul class="cn-wires">${step.wires.map((w) => `<li><b>${e(w.gaine)}</b> <i style="background:${o.css(w.core && w.core !== w.color ? w.core : w.color)}"></i>${e(o.name ? o.name(w) : w.color)}${w.section ? " " + o.fr(w.section, 1) : ""}${w.bague ? ` · bague ${e(w.bague)}` : ""} <span class="mut">${e((o.short && o.short[w.fn]) || w.fn || "")}${w.label ? " · " + e(w.label) : ""}</span></li>`).join("")}</ul>`;
}
