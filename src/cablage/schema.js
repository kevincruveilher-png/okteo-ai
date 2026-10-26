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
  const X0 = 250, X1 = 750, S = X1 - X0, LANE = 13, TERM = 16;
  const circOfG = (g) => g.circuits || String(g.circuit || "").split(",").map((x) => x.trim()).filter(Boolean);
  const cAttr = (list) => esc([...new Set(list)].join(" "));
  let h = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000" font-family="${font}">`;
  h += `<rect x="0" y="0" width="1000" height="1000" fill="#fff"/>`;
  h += `<text x="500" y="22" text-anchor="middle" font-size="13" fill="#555">A haut · B droite · C bas · D gauche — repère du plan${sides.A ? ` · A ${esc(cut(sides.A, 26))}` : ""}</text>`;
  h += `<rect x="${X0}" y="${X0}" width="${S}" height="${S}" rx="10" fill="#f6f8fa" stroke="#2b3440" stroke-width="3"/>`;
  // pastilles des faces, à l'intérieur
  for (const [f, x, y] of [["A", 500, X0 + 24], ["B", X1 - 24, 500], ["C", 500, X1 - 24], ["D", X0 + 24, 500]]) {
    h += `<rect x="${x - 13}" y="${y - 13}" width="26" height="26" rx="5" fill="#1f2a36"/><text x="${x}" y="${y + 6}" text-anchor="middle" font-size="16" font-weight="700" fill="#fff">${f}</text>`;
    if (sides[f]) h += `<text x="${x}" y="${f === "C" ? y - 20 : y + 30}" text-anchor="middle" font-size="10" font-style="italic" fill="#667"${f === "B" || f === "D" ? ` transform="rotate(${f === "B" ? 90 : -90} ${x} ${y})"` : ""}>${esc(cut(sides[f], 28))}</text>`;
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
        // fonction du fil, au bout extérieur
        const tag = (FN_TAG[w.fn] || w.fn) + (g.kind === "alim" && w.circuit ? " " + w.circuit : "");
        if (vert) h += `<text x="${x1}" y="${f === "A" ? y1 - 4 : y1 + 4}" transform="rotate(-90 ${x1} ${f === "A" ? y1 - 4 : y1 + 4})" text-anchor="${f === "A" ? "start" : "end"}" font-size="9" fill="#555">${esc(tag)}</text>`;
        else h += `<text x="${f === "B" ? x1 + 4 : x1 - 4}" y="${y1 + 3}" text-anchor="${f === "B" ? "start" : "end"}" font-size="9" fill="#555">${esc(tag)}</text>`;
        // borne numérotée au bord intérieur
        h += `<rect class="term" x="${tx - TERM / 2}" y="${ty - TERM / 2}" width="${TERM}" height="${TERM}" rx="2" fill="#fff" stroke="#333" stroke-width="1"/><text x="${tx}" y="${ty + 4}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#111">${w.n ?? "–"}</text></g>`;
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
          h += `<g class="bague" data-b="${esc(r.b)}"><path d="${path}" fill="none" stroke="#111" stroke-width="1.6"/><rect x="${tx - 12}" y="${ty - 12}" width="24" height="16" rx="8" fill="#fff" stroke="#111" stroke-width="1.4"/><text x="${tx}" y="${ty}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#111">${esc(r.b)}</text></g>`;
        }
      }
      // titre de la gaine : n° · face, appareil · pièce, longueur (+ câble)
      const mid = start + (n - 1) * L / 2;
      const l1 = `${g.no} · ${f}${g.serie > 1 ? ` · ×${g.serie}` : ""}`, l2 = cut(g.label + (g.room ? ` · ${g.room}` : ""), vert ? 18 : 30), l3 = `${fr(g.length)} m · Ø${g.diam}${g.cable ? " · câble " + g.cable : ""}`;
      const gAttr = `class="gt" data-c="${cAttr(gc)}"`;
      // faces A et C : titre tourné (comme sur les bandes FTZ), trois lignes côte à côte
      if (f === "A" || f === "C") {
        const y0 = f === "A" ? X0 - 84 : X1 + 84, anc = f === "A" ? "start" : "end";
        h += `<g ${gAttr} transform="translate(${mid} ${y0}) rotate(-90)"><text x="0" y="-9" text-anchor="${anc}" font-size="11.5" font-weight="700" fill="#111">${esc(l1)}</text><text x="0" y="3" text-anchor="${anc}" font-size="9.5" fill="#333">${esc(cut(g.label + (g.room ? ` · ${g.room}` : ""), 30))}</text><text x="0" y="14" text-anchor="${anc}" font-size="9.5" fill="#b4691f">${esc(l3)}</text></g>`;
      }
      if (f === "B") h += `<g ${gAttr}><text x="${X1 + 92}" y="${mid - 9}" font-size="12" font-weight="700" fill="#111">${esc(l1)}</text><text x="${X1 + 92}" y="${mid + 4}" font-size="10" fill="#333">${esc(l2)}</text><text x="${X1 + 92}" y="${mid + 16}" font-size="10" fill="#b4691f">${esc(l3)}</text></g>`;
      if (f === "D") h += `<g ${gAttr}><text x="${X0 - 92}" y="${mid - 9}" text-anchor="end" font-size="12" font-weight="700" fill="#111">${esc(l1)}</text><text x="${X0 - 92}" y="${mid + 4}" text-anchor="end" font-size="10" fill="#333">${esc(l2)}</text><text x="${X0 - 92}" y="${mid + 16}" text-anchor="end" font-size="10" fill="#b4691f">${esc(l3)}</text></g>`;
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
  h += `<text x="500" y="972" text-anchor="middle" font-size="12" fill="#555">Bornes = n° de raccordement · tracés à l'intérieur : retours lampe, navettes (N2 en pointillés) et commandes · N / Ph / PE : n° seulement, sans trait.</text>`;
  h += `<text x="500" y="990" text-anchor="middle" font-size="12" fill="#555">Accolade = bague à poser sur ces fils de l'alimentation (n° du circuit, T1… télérupteur) · câble : gaine grise, âme repérée à la couleur de sa fonction · ×n = gaines identiques sur le chantier.</text>`;
  return h + `</svg>`;
}
