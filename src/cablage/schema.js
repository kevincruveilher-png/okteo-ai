// Schéma de boîte pour le câbleur (v33) — partie pure, sans DOM.
// À partir d'une boîte calculée par computeWiring : les étapes de câblage (une par n° de raccordement, dans l'ordre
// terres → neutres → phases → retours et navettes), le connecteur rapide à prendre pour chacune, la liste de matériel,
// les contrôles, et le dessin SVG de la boîte carrée (faces A–D, gaines, connecteurs, retours et navettes tracés).

export const FN_SHORT = { terre: "Terre", neutre: "Neutre", phase: "Phase", retour: "Retour lampe", nav1: "Navette 1", nav2: "Navette 2", cmdTL: "Cde télérupteur", retTL: "Ret. télérupteur", isole: "Fil en trop" };
// couleur d'un fil pour le câbleur : « orange » ; âme d'un câble : « marron repéré orange »
export const wireName = (w) => (w.core && w.core !== w.color ? `${w.core} repéré ${w.color}` : w.color);

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
    by.get(w.n).push({ gaine: g.no, label: g.label, room: g.room || null, fn: w.fn, color: w.color, core: w.core || null, bague: w.bague || null, section: w.section, face: g.face, kind: g.kind });
  }
  return box.nets.map((nt) => {
    const wires = by.get(nt.n) || [];
    return { n: nt.n, label: nt.label, fn: nt.fn, wires, conn: connectorsFor(wires.length, sizes) };
  }).sort((a, b) => a.n - b.n);
}

// ordre de câblage (v47, cadre de la feuille de boîte) : une ligne par borne, dans l'ordre des n° — couleur, section,
// nombre de fils. Ex. « 1 · vert/jaune 2,5 · 12 fils ».
export function orderLines(steps) {
  return steps.map((s) => {
    const w = s.wires[0] || {}, sec = Math.max(0, ...s.wires.map((x) => x.section || 0));
    return { n: s.n, fn: s.fn, label: s.label, color: w.color || "", section: sec || null, count: s.wires.length };
  });
}
export const BOX_MODELS = [{ id: "pav", name: "Boîte pavillonnaire carrée" }];

// matériel : connecteurs par taille + ponts
// fils de la boîte par section et couleur (« 7 × 1,5 bleu »), comme la liste de FTZ ; câbles à part
export function boxWires(box) {
  const m = new Map(), cables = new Map();
  for (const g of box.gaines) {
    if (g.cable) { cables.set(g.cable, (cables.get(g.cable) || 0) + 1); continue; }   // un câble = un article
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
  for (const g of box.gaines) for (const w of g.wires) if (w.n == null && w.fn !== "isole") out.push(`${g.no} (${g.label}) : fil ${wireName(w)} (${FN_SHORT[w.fn] || w.fn}) sans raccordement — à isoler et signaler`);
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

// Dessin SVG de la boîte (v35, d'après la bande que préfère Kévin) : chaque fil dessiné séparément jusqu'à une borne
// numérotée au bord de la boîte ; à l'intérieur, seuls les retours, navettes et commandes sont tracés (lignes à angle
// droit vers un point numéroté) ; N / Ph / PE : numéro de borne seulement. Chaque fil porte data-c = ses circuits
// (pour estomper les autres circuits au clic, comme un calque). color(nom) → couleur CSS ; sides = { A: "côté …" }.
const FN_TAG = { terre: "PE", neutre: "N", phase: "Ph", retour: "RET", nav1: "N1", nav2: "N2", cmdTL: "CTL", retTL: "RTL", isole: "isolé" };
const TRACED = new Set(["retour", "nav1", "nav2", "cmdTL", "retTL"]);
export function schemaSVG(box, steps, { color = () => "#888", sides = {}, font = "Arial, sans-serif" } = {}) {
  // v47 (feuille de boîte de Kévin) : faces et pièces écrites à l'extérieur, aux quatre bords ; textes plus gros ;
  // plus de Ph / N / PE au bout des fils ; gaine = « LI01.10 » puis « P14 · 4,8 m · Ø16 »
  const X0 = 285, X1 = 715, S = X1 - X0, LANE = 13, TERM = 18;
  const circOfG = (g) => g.circuits || String(g.circuit || "").split(",").map((x) => x.trim()).filter(Boolean);
  const cAttr = (list) => esc([...new Set(list)].join(" "));
  let h = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000" font-family="${font}">`;
  h += `<rect x="0" y="0" width="1000" height="1000" fill="#fff"/>`;
  h += `<rect x="${X0}" y="${X0}" width="${S}" height="${S}" rx="10" fill="#f6f8fa" stroke="#2b3440" stroke-width="3"/>`;
  // faces et pièces, à l'extérieur, aux quatre bords (sens de pose de la boîte)
  for (const [f, x, y, rot] of [["A", 500, 26, 0], ["B", 982, 500, 90], ["C", 500, 982, 0], ["D", 18, 500, -90]]) {
    const t = `${f}${sides[f] ? " · " + cut(sides[f], 24) : ""}`;
    h += `<g class="face" data-f="${f}"${rot ? ` transform="rotate(${rot} ${x} ${y})"` : ""}><text x="${x}" y="${y + 9}" text-anchor="middle" font-size="26" font-weight="700" fill="#1f2a36">${esc(t)}</text></g>`;
  }
  const term = new Map();          // borne de chaque fil : { x, y, f, nx, ny } (nx, ny = direction vers l'intérieur)
  const lanes = { A: 0, B: 0, C: 0, D: 0 };
  for (const f of ["A", "B", "C", "D"]) {
    const G = box.gaines.filter((g) => g.face === f);
    const vert = f === "A" || f === "C";
    // chaque gaine occupe une place proportionnelle à son nombre de fils
    const tot = G.reduce((s, g) => s + g.wires.length, 0) + G.length * 2.2;
    const L = Math.min(LANE, (S - 50) / Math.max(1, tot));      // écart entre fils : réduit si la face est chargée
    let pos = (S - tot * L) / 2 + X0;
    G.forEach((g) => {
      const gc = circOfG(g), n = g.wires.length, start = pos + L * 1.1;
      g.wires.forEach((w, i) => {
        const t = start + i * L, wc = w.circuit ? [w.circuit] : gc, col = color(w.color);
        const out = 58;    // longueur du fil dessiné hors de la boîte
        let x1, y1, x2, y2, tx, ty, nx = 0, ny = 0;
        if (f === "A") { x1 = x2 = t; y1 = X0 - out; y2 = X0; tx = t; ty = X0 + 2 + TERM / 2; ny = 1; }
        if (f === "C") { x1 = x2 = t; y1 = X1 + out; y2 = X1; tx = t; ty = X1 - 2 - TERM / 2; ny = -1; }
        if (f === "B") { y1 = y2 = t; x1 = X1 + out; x2 = X1; tx = X1 - 2 - TERM / 2; ty = t; nx = -1; }
        if (f === "D") { y1 = y2 = t; x1 = X0 - out; x2 = X0; tx = X0 + 2 + TERM / 2; ty = t; nx = 1; }
        const sw = w.section >= 2.5 ? 4 : 3;
        h += `<g class="w" data-c="${cAttr(wc)}" data-n="${w.n ?? ""}"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="${sw}"${w.fn === "terre" ? ` stroke-dasharray="7 5"` : ""}${w.fn === "isole" ? ` opacity="0.45"` : ""}/>`;
        // âme d'un câble : sa vraie couleur sur le bout extérieur (dans la gaine du câble), repérée à la couleur de sa fonction
        if (w.core && w.core !== w.color && !/jaune/.test(w.core)) {
          const k = 0.45, cx2 = x1 + (x2 - x1) * k, cy2 = y1 + (y2 - y1) * k;
          h += `<line class="core" x1="${x1}" y1="${y1}" x2="${cx2}" y2="${cy2}" stroke="${color(w.core)}" stroke-width="${sw}"/>`;
        }
        if (/jaune/.test(w.color)) h += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color("vert")}" stroke-width="${sw}" stroke-dasharray="7 5" stroke-dashoffset="7"/>`;
        // borne numérotée au bord intérieur
        h += `<rect class="term" x="${tx - TERM / 2}" y="${ty - TERM / 2}" width="${TERM}" height="${TERM}" rx="2" fill="#fff" stroke="#333" stroke-width="1"/><text x="${tx}" y="${ty + 5}" text-anchor="middle" font-size="13.5" font-weight="700" fill="#111">${w.n ?? "–"}</text></g>`;
        term.set(g.no + "|" + i, { x: tx + nx * TERM / 2, y: ty + ny * TERM / 2, f, nx, ny, w, wc });
      });
      // câble : gaine du câble dessinée sur le bout extérieur des fils (début de câble), avec son type
      if (g.cable) {
        const a0 = start - L * 0.55, a1 = start + (n - 1) * L + L * 0.55;
        const sh = vert ? { x: a0, y: f === "A" ? X0 - 58 : X1 + 26, w: a1 - a0, h: 32 } : { x: f === "B" ? X1 + 26 : X0 - 58, y: a0, w: 32, h: a1 - a0 };
        h += `<g class="cable" data-c="${cAttr(gc)}"><rect x="${sh.x}" y="${sh.y}" width="${sh.w}" height="${sh.h}" rx="6" fill="#2b3440" fill-opacity="0.13" stroke="#2b3440" stroke-width="1.6"/>` +
          `<text x="${sh.x + sh.w / 2}" y="${sh.y + sh.h / 2 + 4}" text-anchor="middle" font-size="10" font-weight="700" fill="#2b3440"${vert ? "" : ` transform="rotate(-90 ${sh.x + sh.w / 2} ${sh.y + sh.h / 2 + 4})"`}>${esc(g.cable)}</text></g>`;
      }
      // bagues de l'alimentation : une accolade par n° de bague sur les fils qui la portent
      if (g.kind === "alim") {
        const runs = [];
        g.wires.forEach((w, i) => { if (!w.bague) return; const r = runs[runs.length - 1]; if (r && r.b === w.bague && r.j === i - 1) r.j = i; else runs.push({ b: w.bague, i, j: i }); });
        for (const r of runs) {
          const a0 = start + r.i * L - 4, a1 = start + r.j * L + 4, m = (a0 + a1) / 2, o = vert ? (f === "A" ? X0 - 30 : X1 + 30) : (f === "B" ? X1 + 30 : X0 - 30), d = vert ? (f === "A" ? -8 : 8) : (f === "B" ? 8 : -8);
          const path = vert ? `M${a0} ${o} v${d} H${a1} v${-d} M${m} ${o + d} v${d}` : `M${o} ${a0} h${d} V${a1} h${-d} M${o + d} ${m} h${d}`;
          const tx = vert ? m : o + d * 2.6, ty = vert ? o + d * 2.6 + 4 : m + 4;
          h += `<g class="bague" data-b="${esc(r.b)}"><path d="${path}" fill="none" stroke="#111" stroke-width="1.6"/><rect x="${tx - 14}" y="${ty - 14}" width="28" height="19" rx="9" fill="#fff" stroke="#111" stroke-width="1.6"/><text x="${tx}" y="${ty}" text-anchor="middle" font-size="13" font-weight="700" fill="#111">${esc(r.b)}</text></g>`;
        }
      }
      // titre de la gaine (v47) : « LI01.10 » puis « P14 · 4,8 m · Ø16 » (alimentation : « Tableau · … »)
      const mid = start + (n - 1) * L / 2;
      const who = g.kind === "alim" ? "Tableau" : cut((g.reps && g.reps.length ? g.reps.join("+") : g.label), 16);
      const l1 = `${g.no}${g.serie > 1 ? ` ×${g.serie}` : ""}`, len = `${fr(g.length, 1)} m · Ø${g.diam}${g.cable ? " · " + g.cable : ""}`, l2 = `${who} · ${len}`;
      const gAttr = `class="gt" data-c="${cAttr(gc)}"`;
      // faces A et C : titre tourné (comme sur les bandes FTZ), deux lignes côte à côte
      if (f === "A" || f === "C") {
        const y0 = f === "A" ? X0 - 74 : X1 + 74, anc = f === "A" ? "start" : "end";
        h += `<g ${gAttr} transform="translate(${mid} ${y0}) rotate(-90)"><text x="0" y="-12" text-anchor="${anc}" font-size="19" font-weight="700" fill="#111">${esc(l1)}</text><text x="0" y="5" text-anchor="${anc}" font-size="16" font-weight="600" fill="#222">${esc(who)}</text><text x="0" y="21" text-anchor="${anc}" font-size="15" fill="#333">${esc(len)}</text></g>`;
      }
      if (f === "B") h += `<g ${gAttr}><text x="${X1 + 76}" y="${mid - 10}" font-size="19" font-weight="700" fill="#111">${esc(l1)}</text><text x="${X1 + 76}" y="${mid + 7}" font-size="16" font-weight="600" fill="#222">${esc(who)}</text><text x="${X1 + 76}" y="${mid + 23}" font-size="15" fill="#333">${esc(len)}</text></g>`;
      if (f === "D") h += `<g ${gAttr}><text x="${X0 - 76}" y="${mid - 10}" text-anchor="end" font-size="19" font-weight="700" fill="#111">${esc(l1)}</text><text x="${X0 - 76}" y="${mid + 7}" text-anchor="end" font-size="16" font-weight="600" fill="#222">${esc(who)}</text><text x="${X0 - 76}" y="${mid + 23}" text-anchor="end" font-size="15" fill="#333">${esc(len)}</text></g>`;
      pos += (n + 2.2) * L;
    });
  }
  // retours, navettes, commandes : un point numéroté par raccordement, au centre ; liaisons à angle droit
  const tr = steps.filter((s) => TRACED.has(s.fn));
  const cols = Math.max(1, Math.min(4, Math.ceil(Math.sqrt(tr.length)))), rows = Math.max(1, Math.ceil(tr.length / cols));
  const node = new Map();
  tr.forEach((s, i) => { const c = i % cols, r = Math.floor(i / cols); node.set(s.n, { x: 500 - (cols - 1) * 45 + c * 90 + (r % 2) * 18, y: 500 - (rows - 1) * 42 + r * 84 }); });
  let depth = { A: 0, B: 0, C: 0, D: 0 };
  for (const s of tr) {
    const P = node.get(s.n), wc = new Set();
    box.gaines.forEach((g) => g.wires.forEach((w, i) => {
      if (w.n !== s.n) return;
      const T = term.get(g.no + "|" + i); if (!T) return;
      (w.circuit ? [w.circuit] : circOfG(g)).forEach((c) => wc.add(c));
      const d = 26 + (depth[T.f]++ % 9) * 9;           // chaque fil rentre à sa profondeur : les traits ne se superposent pas
      const ax = T.x + T.nx * d, ay = T.y + T.ny * d;
      const path = T.nx ? `M${T.x} ${T.y} H${ax} V${P.y} H${P.x}` : `M${T.x} ${T.y} V${ay} H${P.x} V${P.y}`;
      h += `<path class="lnk" data-c="${cAttr(w.circuit ? [w.circuit] : circOfG(g))}" data-n="${s.n}" d="${path}" fill="none" stroke="${color(w.color)}" stroke-width="2.4" opacity="0.9"${s.fn === "nav2" ? ' stroke-dasharray="7 4"' : ""}/>`;
    }));
    h += `<g class="node" data-c="${cAttr([...wc])}" data-n="${s.n}"><circle cx="${P.x}" cy="${P.y}" r="12" fill="#fff" stroke="#2b3440" stroke-width="1.6"/><text x="${P.x}" y="${P.y + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="#111">${s.n}</text></g>`;
  }
  return h + `</svg>`;
}
