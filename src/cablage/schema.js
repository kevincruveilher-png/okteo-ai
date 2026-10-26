// Schéma de boîte pour le câbleur (v33) — partie pure, sans DOM.
// À partir d'une boîte calculée par computeWiring : les étapes de câblage (une par n° de raccordement, dans l'ordre
// terres → neutres → phases → retours et navettes), le connecteur rapide à prendre pour chacune, la liste de matériel,
// les contrôles, et le dessin SVG de la boîte carrée (faces A–D, gaines, connecteurs, retours et navettes tracés).

export const FN_SHORT = { terre: "Terre", neutre: "Neutre", phase: "Phase", retour: "Retour lampe", nav1: "Navette 1", nav2: "Navette 2", cmdTL: "Cde télérupteur", retTL: "Ret. télérupteur" };

// « 2,3,5,8,12 » → [2, 3, 5, 8, 12]
export function parseSizes(s) {
  const v = [...new Set(String(s || "").split(/[^\d]+/).map(Number).filter((n) => n >= 2))].sort((a, b) => a - b);
  return v.length ? v : [2, 3, 5];
}

// n fils à raccorder ensemble → connecteurs à prendre. Au-delà du plus gros connecteur : plusieurs connecteurs
// reliés par des ponts (un bout de fil de même couleur, qui prend une entrée de chaque côté).
export function connectorsFor(n, sizes) {
  if (n < 2) return { list: [], ponts: 0 };
  const max = sizes[sizes.length - 1];
  if (n <= max) return { list: [sizes.find((s) => s >= n)], ponts: 0 };
  let k = 2;
  while (k * max - 2 * (k - 1) < n) k++;
  const rest = n + 2 * (k - 1) - (k - 1) * max;
  return { list: [...Array(k - 1).fill(max), sizes.find((s) => s >= rest) || max], ponts: k - 1 };
}

// étapes de câblage d'une boîte (sortie de computeWiring) : [{ n, label, fn, wires: [{gaine, label, fn, color, section, face}], conn }]
export function boxSteps(box, sizes) {
  const by = new Map();
  for (const g of box.gaines) for (const w of g.wires) {
    if (w.n == null) continue;
    if (!by.has(w.n)) by.set(w.n, []);
    by.get(w.n).push({ gaine: g.no, label: g.label, room: g.room || null, fn: w.fn, color: w.color, section: w.section, face: g.face, kind: g.kind });
  }
  return box.nets.map((nt) => {
    const wires = by.get(nt.n) || [];
    return { n: nt.n, label: nt.label, fn: nt.fn, wires, conn: connectorsFor(wires.length, sizes) };
  }).sort((a, b) => a.n - b.n);
}

// matériel : connecteurs par taille + ponts
// fils de la boîte par section et couleur (« 7 × 1,5 bleu »), comme la liste de FTZ ; câbles à part
export function boxWires(box) {
  const m = new Map(), cables = new Map();
  for (const g of box.gaines) {
    if (g.cable) { cables.set(g.cable, (cables.get(g.cable) || 0) + 1); continue; }
    for (const w of g.wires) { const k = `${w.section}|${w.color}`; m.set(k, (m.get(k) || 0) + 1); }
  }
  const wires = [...m].map(([k, n]) => { const [sec, color] = k.split("|"); return { section: +sec, color, n }; }).sort((a, b) => a.section - b.section || a.color.localeCompare(b.color, "fr"));
  return { wires, cables: [...cables].map(([cable, n]) => ({ cable, n })) };
}

export function boxMaterial(steps) {
  const sizes = {};
  let ponts = 0;
  for (const s of steps) { s.conn.list.forEach((k) => (sizes[k] = (sizes[k] || 0) + 1)); ponts += s.conn.ponts; }
  return { sizes: Object.entries(sizes).map(([k, n]) => [+k, n]).sort((a, b) => a[0] - b[0]), ponts };
}

// contrôles : fil sans raccordement, raccordement d'un seul fil
export function boxChecks(box, steps) {
  const out = [];
  for (const g of box.gaines) for (const w of g.wires) if (w.n == null) out.push(`${g.no} (${g.label}) : fil ${w.color} (${FN_SHORT[w.fn] || w.fn}) sans raccordement — à isoler et signaler`);
  for (const s of steps) if (s.wires.length === 1) out.push(`Raccordement ${s.n} (${s.label}) : un seul fil — vérifier le plan`);
  return out;
}

// libellé court pour la case du connecteur : « N C2 », « P C2 », « Ret L3 L3A », « Nav1 VV1-VV1A »
export function shortLabel(l) {
  return String(l).replace(/\s*\(toutes ensemble\)/, "").replace(/^Neutre /, "N ").replace(/^Phase /, "P ").replace(/^Retour lampe /, "Ret ")
    .replace(/^Navette (\d) /, "Nav$1 ").replace(/^Commande télérupteur /, "Cde TL ").replace(/^Retour télérupteur /, "Ret TL ").replace(/↔/g, "-");
}
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fr = (v, d = 2) => (v == null ? "—" : Number(v).toFixed(d).replace(".", ","));
const cut = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + "…" : String(s));

// Dessin SVG de la boîte (carré de 400 dans un cadre de 1000) ; color(nom) → couleur CSS ; sides = { A: "côté …" }.
export function schemaSVG(box, steps, { color = () => "#888", sides = {}, font = "Arial, sans-serif" } = {}) {
  const X0 = 300, X1 = 700, S = X1 - X0;
  const FACES = { A: [0, -1], B: [1, 0], C: [0, 1], D: [-1, 0] };
  let h = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000" font-family="${font}">`;
  h += `<rect x="0" y="0" width="1000" height="1000" fill="#fff"/>`;
  h += `<rect x="${X0}" y="${X0}" width="${S}" height="${S}" fill="#fafafa" stroke="#222" stroke-width="4"/>`;
  // nom des faces + repère d'orientation, à l'intérieur du carré
  const faceTxt = { A: [500, X0 + 22, 0], B: [X1 - 14, 500, 90], C: [500, X1 - 10, 0], D: [X0 + 14, 500, -90] };
  for (const [f, [x, y, r]] of Object.entries(faceTxt)) {
    h += `<text x="${x}" y="${y}" transform="rotate(${r} ${x} ${y})" text-anchor="middle" font-size="15" font-weight="700" fill="#222">Face ${f}${sides[f] ? ` <tspan font-weight="400" font-style="italic" fill="#555">· ${esc(cut(sides[f], 30))}</tspan>` : ""}</text>`;
  }
  // gaines : réparties sur leur face, un trait vers l'extérieur et l'étiquette au bout
  const entry = new Map();
  for (const f of Object.keys(FACES)) {
    const G = box.gaines.filter((g) => g.face === f), n = G.length;
    G.forEach((g, i) => {
      const t = X0 + S * (i + 1) / (n + 1), [dx, dy] = FACES[f];
      const ex = dx ? (dx > 0 ? X1 : X0) : t, ey = dy ? (dy > 0 ? X1 : X0) : t;
      entry.set(g.no, { x: ex, y: ey, f });
      const L = 46, ox = ex + dx * L, oy = ey + dy * L;
      const w = g.diam >= 20 ? 12 : 9;
      h += `<line x1="${ex}" y1="${ey}" x2="${ox}" y2="${oy}" stroke="${g.kind === "alim" ? "#222" : "#666"}" stroke-width="${w}" stroke-linecap="butt" opacity="0.85"/>`;
      // étiquette : vers l'extérieur, tournée pour les faces A et C
      const lines = [`${g.no}  ·  ${fr(g.length)} m  ·  Ø${g.diam}${g.cable ? "  ·  câble " + g.cable : ""}`, cut(g.label + (g.room ? ` (${g.room})` : ""), 34)];
      const rot = dy ? -90 : 0, anchor = dx < 0 || dy < 0 ? "end" : "start";
      const bx = ox + dx * 8, by = oy + dy * 8;
      h += `<g transform="translate(${bx} ${by}) rotate(${rot})">`;
      const along = dy ? -dy : 1;   // sens du texte après rotation (toujours vers l'extérieur)
      const anc = dy ? (dy < 0 ? "start" : "end") : anchor;
      h += `<text x="0" y="-8" text-anchor="${anc}" font-size="14" font-weight="700" fill="#111">${esc(lines[0])}</text>`;
      h += `<text x="0" y="8" text-anchor="${anc}" font-size="13" fill="#333">${esc(lines[1])}</text>`;
      // pastilles des fils : couleur + n° de raccordement
      const chips = g.wires.map((wi) => ({ c: color(wi.color), n: wi.n, name: wi.color }));
      const cw = 30, tot = chips.length * cw, start = anc === "end" ? -tot : 0;
      chips.forEach((c, k) => {
        const x = start + k * cw;
        h += `<rect x="${x}" y="16" width="12" height="12" rx="2" fill="${c.c}" stroke="#333" stroke-width="0.8"/>`;
        if (/jaune/.test(c.name)) h += `<rect x="${x}" y="16" width="6" height="12" fill="${color("vert")}"/>`;
        h += `<text x="${x + 15}" y="27" font-size="12" font-weight="700" fill="#111">${c.n ?? "–"}</text>`;
      });
      h += `</g>`;
      void along;
    });
  }
  // connecteurs : grille au centre de la boîte, dans l'ordre des étapes
  const cols = steps.length > 12 ? 4 : 3, rows = Math.max(1, Math.ceil(steps.length / cols));
  const gx0 = X0 + 40, gy0 = X0 + 40, cw = (S - 80) / cols, ch = Math.min(60, (S - 80) / rows);
  const pos = new Map();
  const cells = steps.map((s, i) => {
    const c = i % cols, r = Math.floor(i / cols), x = gx0 + c * cw + 4, y = gy0 + r * ch + 3, w = cw - 8, hh = ch - 6;
    pos.set(s.n, { x: x + w / 2, y: y + hh / 2 });
    return { s, x, y, w, hh };
  });
  // retours lampe et navettes : tracés de la gaine au connecteur
  const traced = new Set(["retour", "nav1", "nav2", "cmdTL", "retTL"]);
  for (const s of steps) {
    if (!traced.has(s.fn)) continue;
    const p = pos.get(s.n);
    for (const w of s.wires) {
      const e = entry.get(w.gaine); if (!e || !p) continue;
      h += `<path d="M${e.x} ${e.y} Q ${(e.x + p.x) / 2 + (e.f === "A" || e.f === "C" ? 0 : 0)} ${(e.y + p.y) / 2} ${p.x} ${p.y}" fill="none" stroke="${color(w.color)}" stroke-width="3" opacity="0.85"${s.fn === "nav2" ? ' stroke-dasharray="8 5"' : ""}/>`;
    }
  }
  // les connecteurs par-dessus les traits
  cells.forEach(({ s, x, y, w, hh }) => {
    const col = color(s.wires[0] ? s.wires[0].color : "gris");
    h += `<rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="6" fill="#fff" stroke="${col}" stroke-width="3"/>`;
    h += `<text x="${x + 7}" y="${y + 24}" font-size="22" font-weight="700" fill="#111">${s.n}</text>`;
    h += `<text x="${x + (s.n > 9 ? 36 : 26)}" y="${y + 18}" font-size="13" font-weight="700" fill="#222">${esc(cut(shortLabel(s.label), s.n > 9 ? 10 : 12))}</text>`;
    if (hh > 34) h += `<text x="${x + (s.n > 9 ? 36 : 26)}" y="${y + 35}" font-size="12" fill="#555">${s.wires.length} fils · ${s.conn.list.length ? s.conn.list.map((k) => k + " e.").join("+") : "seul"}</text>`;
  });
  h += `<text x="500" y="985" text-anchor="middle" font-size="13" fill="#555">Trait épais = gaine (n° · longueur · diamètre) ; pastille = couleur du fil + n° de raccordement. Retours lampe et navettes tracés en couleur (navette 2 en pointillés).</text>`;
  return h + `</svg>`;
}
