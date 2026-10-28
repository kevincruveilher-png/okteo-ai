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
export function schemaSVG(box, steps, { color = () => "#888", sides = {}, font = "Arial, sans-serif", big = false } = {}) {
  const F = big ? 1.28 : 1; // étiquette de boîte (v50) : textes plus gros
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
    h += `<g class="face" data-f="${f}"${rot ? ` transform="rotate(${rot} ${x} ${y})"` : ""}><text x="${x}" y="${y + 9}" text-anchor="middle" font-size="${26 * F}" font-weight="700" fill="#1f2a36">${esc(t)}</text></g>`;
  }
  const term = new Map();          // borne de chaque fil : { x, y, f, nx, ny } (nx, ny = direction vers l'intérieur)
  const lanes = { A: 0, B: 0, C: 0, D: 0 };
  for (const f of ["A", "B", "C", "D"]) {
    // v60 : gaines dans leur ordre réel sur la face (vue de dessus, comme le plan) : A et B dans l'ordre des points
    // d'accroche, C et D à l'envers (points numérotés dans le sens horaire)
    const G = box.gaines.filter((g) => g.face === f).sort((p, q) => ((p.slot ?? 0) - (q.slot ?? 0)) * (f === "A" || f === "B" ? 1 : -1));
    const vert = f === "A" || f === "C";
    // chaque gaine occupe une place proportionnelle à son nombre de fils
    const tot = G.reduce((s, g) => s + g.wires.length, 0) + G.length * 2.2;
    const L = Math.min(LANE, (S - 50) / Math.max(1, tot));      // écart entre fils : réduit si la face est chargée
    const stag = L < TERM + 1, TW = stag ? Math.min(TERM, 2 * L - 3) : TERM;
    let pos = (S - tot * L) / 2 + X0;
    G.forEach((g) => {
      const gc = circOfG(g), n = g.wires.length, start = pos + L * 1.1;
      g.wires.forEach((w, i) => {
        const t = start + i * L, wc = w.circuit ? [w.circuit] : gc, col = color(w.color);
        const out = 58;    // longueur du fil dessiné hors de la boîte
        // v60 : face chargée (fils plus serrés que les bornes) : bornes en quinconce sur deux rangs, jamais l'une sur l'autre
        const dep = stag && i % 2 ? TERM + 3 : 0;
        let x1, y1, x2, y2, tx, ty, nx = 0, ny = 0;
        if (f === "A") { x1 = x2 = t; y1 = X0 - out; y2 = X0 + dep; tx = t; ty = X0 + 2 + TERM / 2 + dep; ny = 1; }
        if (f === "C") { x1 = x2 = t; y1 = X1 + out; y2 = X1 - dep; tx = t; ty = X1 - 2 - TERM / 2 - dep; ny = -1; }
        if (f === "B") { y1 = y2 = t; x1 = X1 + out; x2 = X1 - dep; tx = X1 - 2 - TERM / 2 - dep; ty = t; nx = -1; }
        if (f === "D") { y1 = y2 = t; x1 = X0 - out; x2 = X0 + dep; tx = X0 + 2 + TERM / 2 + dep; ty = t; nx = 1; }
        const sw = w.section >= 2.5 ? 4 : 3;
        h += `<g class="w" data-c="${cAttr(wc)}" data-n="${w.n ?? ""}"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="${sw}"${w.fn === "terre" ? ` stroke-dasharray="7 5"` : ""}${w.fn === "isole" ? ` opacity="0.45"` : ""}/>`;
        // âme d'un câble : sa vraie couleur sur le bout extérieur (dans la gaine du câble), repérée à la couleur de sa fonction
        if (w.core && w.core !== w.color && !/jaune/.test(w.core)) {
          const k = 0.45, cx2 = x1 + (x2 - x1) * k, cy2 = y1 + (y2 - y1) * k;
          h += `<line class="core" x1="${x1}" y1="${y1}" x2="${cx2}" y2="${cy2}" stroke="${color(w.core)}" stroke-width="${sw}"/>`;
        }
        if (/jaune/.test(w.color)) h += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color("vert")}" stroke-width="${sw}" stroke-dasharray="7 5" stroke-dashoffset="7"/>`;
        // borne numérotée au bord intérieur
        const tw = vert ? TW : TERM, th = vert ? TERM : TW;
        h += `<rect class="term" x="${tx - tw / 2}" y="${ty - th / 2}" width="${tw}" height="${th}" rx="2" fill="#fff" stroke="#333" stroke-width="1"/><text x="${tx}" y="${ty + 5}" text-anchor="middle" font-size="${TW < 15 ? 11.5 : 13.5}" font-weight="700" fill="#111">${w.n ?? "–"}</text></g>`;
        // point de départ intérieur : derrière le 2e rang de bornes, pour que le tracé ne passe pas sur une borne
        const back = stag && !(i % 2) ? TERM + 3 : 0;
        term.set(g.no + "|" + i, { x: tx + nx * (TERM / 2 + back), y: ty + ny * (TERM / 2 + back), f, nx, ny, w, wc, stub: back ? { x: tx + nx * TERM / 2, y: ty + ny * TERM / 2 } : null });
      });
      // câble : gaine du câble dessinée sur le bout extérieur des fils (début de câble), avec son type
      if (g.cable) {
        const a0 = start - L * 0.55, a1 = start + (n - 1) * L + L * 0.55;
        const sh = vert ? { x: a0, y: f === "A" ? X0 - 58 : X1 + 26, w: a1 - a0, h: 32 } : { x: f === "B" ? X1 + 26 : X0 - 58, y: a0, w: 32, h: a1 - a0 };
        h += `<g class="cable" data-c="${cAttr(gc)}"><rect x="${sh.x}" y="${sh.y}" width="${sh.w}" height="${sh.h}" rx="6" fill="#2b3440" fill-opacity="0.13" stroke="#2b3440" stroke-width="1.6"/>` +
          `<text x="${sh.x + sh.w / 2}" y="${sh.y + sh.h / 2 + 4}" text-anchor="middle" font-size="10" font-weight="700" fill="#2b3440"${vert ? "" : ` transform="rotate(-90 ${sh.x + sh.w / 2} ${sh.y + sh.h / 2 + 4})"`}>${esc(g.cable)}</text></g>`;
      }
      // bagues : une accolade par n° de bague sur les fils qui la portent (alimentation : n° du circuit, T1… ; gaine
      // d'appareil : n° de l'allumage quand une couleur de la ronde est réutilisée, R-072)
      if (g.wires.some((w) => w.bague)) {
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
      const l1 = `${g.no}${g.serie > 1 ? ` ×${g.serie}` : ""}`, len = `${fr(g.length, 1)} m · Ø${g.diam ?? "?"}${g.cable ? " · " + g.cable : ""}${g.bouchon ? " · BOUCHON" : ""}`, l2 = `${who} · ${len}`;
      const gAttr = `class="gt" data-c="${cAttr(gc)}"`;
      // faces A et C : titre tourné (comme sur les bandes FTZ), deux lignes côte à côte
      if (f === "A" || f === "C") {
        const y0 = f === "A" ? X0 - 74 : X1 + 74, anc = f === "A" ? "start" : "end";
        h += `<g ${gAttr} transform="translate(${mid} ${y0}) rotate(-90)"><text x="0" y="${-12 * F}" text-anchor="${anc}" font-size="${19 * F}" font-weight="700" fill="#111">${esc(l1)}</text><text x="0" y="${5 * F}" text-anchor="${anc}" font-size="${16 * F}" font-weight="600" fill="#222">${esc(who)}</text><text x="0" y="${21 * F}" text-anchor="${anc}" font-size="${15 * F}" fill="#333">${esc(len)}</text></g>`;
      }
      if (f === "B") h += `<g ${gAttr}><text x="${X1 + 76}" y="${mid - 10 * F}" font-size="${19 * F}" font-weight="700" fill="#111">${esc(l1)}</text><text x="${X1 + 76}" y="${mid + 7 * F}" font-size="${16 * F}" font-weight="600" fill="#222">${esc(who)}</text><text x="${X1 + 76}" y="${mid + 23 * F}" font-size="${15 * F}" fill="#333">${esc(len)}</text></g>`;
      if (f === "D") h += `<g ${gAttr}><text x="${X0 - 76}" y="${mid - 10 * F}" text-anchor="end" font-size="${19 * F}" font-weight="700" fill="#111">${esc(l1)}</text><text x="${X0 - 76}" y="${mid + 7 * F}" text-anchor="end" font-size="${16 * F}" font-weight="600" fill="#222">${esc(who)}</text><text x="${X0 - 76}" y="${mid + 23 * F}" text-anchor="end" font-size="${15 * F}" fill="#333">${esc(len)}</text></g>`;
      pos += (n + 2.2) * L;
    });
  }
  // retours, navettes, commandes (v60) : un connecteur par raccordement, alignés au milieu de la boîte ; chaque fil a
  // sa propre entrée sur le connecteur et ses propres couloirs (horizontal et vertical) : aucun fil n'en recouvre un autre.
  const tr = steps.filter((s) => TRACED.has(s.fn));
  if (tr.length) {
    const R = routeInside(box, tr, term);
    for (const L of R.links) h += `<path class="lnk" data-c="${cAttr(L.wc)}" data-n="${L.n}" d="M${L.pts.map((p) => `${p.x} ${p.y}`).join(" L")}" fill="none" stroke="${color(L.w.color)}" stroke-width="2.4" opacity="0.9"${L.fn === "nav2" ? ' stroke-dasharray="7 4"' : ""}/>`;
    for (const N of R.nodes) h += `<g class="node" data-c="${cAttr(N.wc)}" data-n="${N.n}"><rect x="${N.x0}" y="${N.y0}" width="${N.w}" height="${N.h}" rx="5" fill="#fff" stroke="#2b3440" stroke-width="1.6"/><text x="${N.x0 + N.w / 2}" y="${N.y0 + N.h / 2 + 4.5}" text-anchor="middle" font-size="12" font-weight="700" fill="#111">${N.n}</text></g>`;
  }
  return h + `</svg>`;
}

// ---------- tracé intérieur sans superposition (v60) ----------
// Couloirs : bande du haut (fils qui arrivent par le dessus des connecteurs), bande du bas, bandes latérales (faces B et D).
// Chaque segment est réservé ; un nouveau segment ne peut pas reprendre la même ligne sur une longueur commune.
const BOX = { X0: 285, X1: 715, IN0: 328, IN1: 672, NY: 500, NH: 24 };   // IN0, IN1 : derrière les deux rangs de bornes
export function routeInside(box, tr, term) {
  // couloirs espacés de 9 (lisible), resserrés seulement si la boîte est trop chargée
  let R = null;
  for (const sp of [9, 7, 5.5, 4.5]) { R = routeWith(box, tr, term, sp); if (!R.fails) break; }
  return R;
}
function routeWith(box, tr, term, SP) {
  const { IN0, IN1, NY, NH } = BOX;
  let fails = 0;
  const H = [], V = [];                // segments réservés : H {y, a, b} ; V {x, a, b}
  const lo = (a, b) => [Math.min(a, b), Math.max(a, b)];
  // o = fil propriétaire du segment (le départ d'un fil des faces B et D est réservé d'avance pour lui seul)
  let own = null;
  const freeH = (y, x1, x2) => { const [a, b] = lo(x1, x2); return !H.some((s) => s.o !== own && Math.abs(s.y - y) < 1.6 && s.a < b - 0.5 && a < s.b - 0.5); };
  const freeV = (x, y1, y2) => { const [a, b] = lo(y1, y2); return !V.some((s) => s.o !== own && Math.abs(s.x - x) < 1.6 && s.a < b - 0.5 && a < s.b - 0.5); };
  const take = (pts) => { for (let i = 1; i < pts.length; i++) { const p = pts[i - 1], q = pts[i]; if (Math.abs(p.y - q.y) < 1e-9) { const [a, b] = lo(p.x, q.x); H.push({ y: p.y, a, b, o: own }); } else { const [a, b] = lo(p.y, q.y); V.push({ x: p.x, a, b, o: own }); } } };
  const ok = (pts) => pts.every((q, i) => !i || (Math.abs(pts[i - 1].y - q.y) < 1e-9 ? freeH(q.y, pts[i - 1].x, q.x) : freeV(q.x, pts[i - 1].y, q.y)));
  // fils de chaque raccordement tracé, avec leur borne
  const items = tr.map((s) => {
    const W = [];
    box.gaines.forEach((g) => g.wires.forEach((w, i) => { if (w.n !== s.n) return; const T = term.get(g.no + "|" + i); if (T) W.push({ T, w, wc: T.wc, key: g.no + "|" + i }); }));
    return { s, W, cx: W.length ? W.reduce((a, x) => a + x.T.x, 0) / W.length : 500 };
  }).filter((it) => it.W.length).sort((a, b) => a.cx - b.cx);
  // côté d'arrivée de chaque fil : par le dessus (face A, ou B / D au-dessus du milieu) ou par le dessous
  items.forEach((it) => it.W.forEach((x) => { x.top = x.T.f === "A" || ((x.T.f === "B" || x.T.f === "D") && x.T.y < NY); }));
  // connecteurs alignés au milieu (les couloirs latéraux ne traversent jamais la rangée des connecteurs)
  const SB = 64, xA = IN0 + 4, xB = IN1 - 4;
  const need = items.map((it) => Math.max(it.W.filter((x) => x.top).length, it.W.filter((x) => !x.top).length));
  const pad = 6, gap0 = 6;
  let g = 7;
  const width = (gg) => items.reduce((a, it, i) => a + Math.max(22, need[i] * gg + 2 * pad), 0) + (items.length - 1) * gap0;
  while (g > 3 && width(g) > xB - xA) g -= 0.5;
  let x = (xA + xB) / 2 - width(g) / 2;
  const nodes = items.map((it, i) => { const w = Math.max(22, need[i] * g + 2 * pad), N = { n: it.s.n, x0: x, y0: NY - NH / 2, w, h: NH, wc: [...new Set(it.W.flatMap((y) => y.wc))] }; x += w + gap0; return N; });
  nodes.forEach((N) => H.push({ y: N.y0, a: N.x0, b: N.x0 + N.w }, { y: N.y0 + N.h, a: N.x0, b: N.x0 + N.w }));
  // départs des fils des faces B et D réservés d'avance (toute la bande latérale) : aucun couloir ne passe sur leur ligne
  items.forEach((it) => it.W.forEach((y) => { const x0 = (y.T.stub || y.T).x; if (y.T.f === "B") H.push({ y: y.T.y, a: IN1 - SB, b: x0, o: y.key }); if (y.T.f === "D") H.push({ y: y.T.y, a: x0, b: IN0 + SB, o: y.key }); }));
  const links = [];
  items.forEach((it, i) => {
    const N = nodes[i];
    for (const top of [true, false]) {
      // entrées dans l'ordre des bornes (de gauche à droite) : moins de croisements
      const W = it.W.filter((y) => y.top === top).sort((a, b) => (a.T.f === "D" ? -1e3 : a.T.f === "B" ? 1e3 : a.T.x) - (b.T.f === "D" ? -1e3 : b.T.f === "B" ? 1e3 : b.T.x));
      const span = (W.length - 1) * g, ex0 = N.x0 + N.w / 2 - span / 2;
      // entrées possibles : les places régulières et les demi-places entre elles (si un trait passe déjà sur une place)
      const slots = []; for (let q = 0; q <= 2 * W.length; q++) slots.push(ex0 - g / 2 + q * g / 2);
      const usedE = new Set();
      W.forEach((y, k) => {
        const ideal = ex0 + k * g, ey = top ? N.y0 : N.y0 + N.h, T = y.T;
        const exs = slots.filter((v) => ![...usedE].some((u) => Math.abs(u - v) < 2)).sort((p, q) => Math.abs(p - ideal) - Math.abs(q - ideal));
        let ex = exs[0] ?? ideal;
        own = y.key;
        const S0 = T.stub || { x: T.x, y: T.y };   // départ au bord de la borne (2e rang de bornes : le trait passe entre elles)
        // couloirs horizontaux : de la bande vers l'extérieur
        const ys = []; for (let d = 9; ; d += SP) { const yy = top ? ey - d : ey + d; if (top ? yy < IN0 + 8 : yy > IN1 - 8) break; ys.push(yy); }
        let pts = null;
        const xs = []; for (let d = 8; d < SB - 4; d += SP) xs.push(T.f === "B" ? IN1 - d : IN0 + d);
        outer: for (const e of exs) for (const yy of ys) {
          if (T.f === "A" || T.f === "C") { const c = [S0, { x: T.x, y: yy }, { x: e, y: yy }, { x: e, y: ey }]; if (ok(c)) { pts = c; ex = e; break outer; } }
          else for (const xx of xs) { const c = [S0, { x: xx, y: T.y }, { x: xx, y: yy }, { x: e, y: yy }, { x: e, y: ey }]; if (ok(c)) { pts = c; ex = e; break outer; } }
        }
        usedE.add(ex);
        // repli (cas extrême : boîte saturée) : le premier couloir, même partagé
        if (!pts) fails++;
        if (!pts) pts = T.f === "A" || T.f === "C" ? [S0, { x: T.x, y: ys[0] ?? ey }, { x: ex, y: ys[0] ?? ey }, { x: ex, y: ey }] : [S0, { x: T.f === "B" ? IN1 - 8 : IN0 + 8, y: T.y }, { x: T.f === "B" ? IN1 - 8 : IN0 + 8, y: ys[0] ?? ey }, { x: ex, y: ys[0] ?? ey }, { x: ex, y: ey }];
        // points alignés retirés (segments nuls)
        pts = pts.filter((p, j) => !j || Math.hypot(p.x - pts[j - 1].x, p.y - pts[j - 1].y) > 1e-6);
        take(pts);
        links.push({ n: it.s.n, fn: it.s.fn, w: y.w, wc: y.wc, pts });
      });
    }
  });
  return { nodes, links, fails };
}
// segments qui se recouvrent (même ligne, longueur commune) : [] attendu (tests)
export function overlaps(links) {
  const S = [];
  links.forEach((L, li) => L.pts.forEach((q, i) => { if (!i) return; const p = L.pts[i - 1]; S.push({ li, h: Math.abs(p.y - q.y) < 1e-9, c: Math.abs(p.y - q.y) < 1e-9 ? p.y : p.x, a: Math.min(Math.abs(p.y - q.y) < 1e-9 ? p.x : p.y, Math.abs(p.y - q.y) < 1e-9 ? q.x : q.y), b: Math.max(Math.abs(p.y - q.y) < 1e-9 ? p.x : p.y, Math.abs(p.y - q.y) < 1e-9 ? q.x : q.y) }); }));
  const out = [];
  for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) {
    const p = S[i], q = S[j];
    if (p.li === q.li || p.h !== q.h || Math.abs(p.c - q.c) >= 1.6) continue;
    if (p.a < q.b - 0.5 && q.a < p.b - 0.5) out.push([p.li, q.li]);
  }
  return out;
}

// ---------- vue des 4 tranches pour le perceur (v60) ----------
// Chaque face de la boîte vue DE L'EXTÉRIEUR : les trous dans l'ordre réel, de gauche à droite (numéros croissants,
// R-077), taille du trou d'après le diamètre de la gaine, n° de gaine et aboutissant. Les points d'accroche sont
// numérotés dans le sens horaire vus de dessus : vus de l'extérieur, de gauche à droite = rang décroissant, sur les 4 faces.
export function trancheOrder(box, f, n = 6) {
  const G = new Map(box.gaines.filter((g) => g.face === f && g.slot != null).map((g) => [g.slot, g]));
  return [...Array(n).keys()].reverse().map((slot) => ({ slot, g: G.get(slot) || null }));
}
export function tranchesSVG(box, { sides = {}, n = 6, font = "Arial, sans-serif" } = {}) {
  const N = Math.max(n, 1 + Math.max(-1, ...box.gaines.map((g) => g.slot ?? -1)));
  const W = 1000, SH = 190, H = 4 * SH + 10;
  let h = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${font}"><rect width="${W}" height="${H}" fill="#fff"/>`;
  const where = { A: "haut du plan", B: "droite du plan", C: "bas du plan", D: "gauche du plan" };
  ["A", "B", "C", "D"].forEach((f, k) => {
    const y0 = 8 + k * SH, rx = 40, rw = W - 80, ry = y0 + 40, rh = 74;
    const list = trancheOrder(box, f, N), used = list.filter((x) => x.g).length;
    h += `<g class="tranche" data-f="${f}"><text x="${rx}" y="${y0 + 24}" font-size="22" font-weight="700" fill="#1f2a36">Tranche ${f}${sides[f] ? " · " + esc(cut(sides[f], 30)) : ""}</text>`;
    h += `<text x="${rx + rw}" y="${y0 + 24}" text-anchor="end" font-size="15" fill="#555">vue de l'extérieur (${where[f]}) · ${used} trou${used > 1 ? "s" : ""} · gauche → droite</text>`;
    h += `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" rx="8" fill="#f6f8fa" stroke="#2b3440" stroke-width="2.5"/>`;
    const step = rw / N;
    list.forEach(({ g }, i) => {
      const cx = rx + step * (i + 0.5), cy = ry + rh / 2;
      if (!g) { h += `<circle class="trou libre" cx="${cx}" cy="${cy}" r="9" fill="none" stroke="#bbb" stroke-width="1.5" stroke-dasharray="4 3"/>`; return; }
      const r = g.diam >= 25 ? 27 : g.diam >= 20 ? 23 : 19;
      const no = String(g.no).split(".").pop(), who = g.kind === "alim" ? "Tableau" : cut(g.reps && g.reps.length ? g.reps.join("+") : g.label, 16);
      h += `<g class="trou" data-no="${esc(g.no)}"><circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" stroke="#111" stroke-width="2.5"/><text x="${cx}" y="${cy + 8}" text-anchor="middle" font-size="22" font-weight="800" fill="#111">${esc(no)}</text>`;
      h += `<text x="${cx}" y="${ry + rh + 22}" text-anchor="middle" font-size="16" font-weight="700" fill="#111">${esc(who)}</text>`;
      h += `<text x="${cx}" y="${ry + rh + 41}" text-anchor="middle" font-size="14" fill="#444">Ø${g.diam ?? "?"}${g.room && g.kind !== "alim" ? " · " + esc(cut(g.room, 14)) : ""}${g.bouchon ? " · bouchon" : ""}</text></g>`;
    });
    h += `</g>`;
  });
  const lost = box.gaines.filter((g) => g.slot == null || !["A", "B", "C", "D"].includes(g.face));
  if (lost.length) h += `<text x="40" y="${H - 4}" font-size="14" fill="#b05a00">Sans place sur une face : ${esc(lost.map((g) => g.no).join(", "))}</text>`;
  return h + `</svg>`;
}
