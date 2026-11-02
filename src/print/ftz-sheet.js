// Feuille au format des plans FTZ du BE (v74, MAJ 1) : A3 paysage, cadre, cartouche KiTéOHM, légende en tableau,
// encarts de la préparation d'impression (textes, flèches, panneaux, zones interdites, images). Dessin jsPDF, en mm.
// La charte (positions, polices, couleurs, épaisseurs) vient de `ftz-charte.json`, relevée sur un plan FTZ.

export const A3 = { W: 420, H: 297 };
// la zone imprimée FTZ (410 × 289 mm) est centrée sur la feuille A3
export const OX = 5, OY = 4;
const PT = 72 / 25.4;
const hexRgb = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(c || ""); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
export const FONT = { "Courier-Bold": ["courier", "bold"], Courier: ["courier", "normal"], Helvetica: ["helvetica", "normal"], "Helvetica-Bold": ["helvetica", "bold"], "Times-Roman": ["times", "normal"] };

// « M x y L x y C … Z » → sous-chemins [{start, segs (relatifs, format doc.lines), closed}]
export function parseD(d) {
  const T = d.match(/[MLCZ]|-?[\d.]+(?:e-?\d+)?/g) || [];
  const subs = []; let cur = null, p = [0, 0], i = 0;
  const n = () => +T[i++];
  while (i < T.length) {
    const op = T[i++];
    if (op === "M") { p = [n(), n()]; cur = { start: p.slice(), segs: [], closed: false }; subs.push(cur); }
    else if (op === "L") { const q = [n(), n()]; cur.segs.push([q[0] - p[0], q[1] - p[1]]); p = q; }
    else if (op === "C") { const a = [n(), n()], b = [n(), n()], q = [n(), n()]; cur.segs.push([a[0] - p[0], a[1] - p[1], b[0] - p[0], b[1] - p[1], q[0] - p[0], q[1] - p[1]]); p = q; }
    else if (op === "Z") { if (cur) cur.closed = true; }
  }
  return subs;
}

// un tracé de la charte (coordonnées en mm, origine du symbole ou de la zone FTZ) → jsPDF, décalé de (dx, dy)
export function drawPath(doc, p, dx = 0, dy = 0, k = 1) {
  const fill = p.fill && /B|f|F|b/.test(p.op) ? hexRgb(p.fill) : null, stroke = p.stroke && /S|s|B|b/.test(p.op) ? hexRgb(p.stroke) : null;
  if (!fill && !stroke) return;
  if (fill) doc.setFillColor(...fill);
  if (stroke) { doc.setDrawColor(...stroke); doc.setLineWidth(Math.max(0.05, (p.w || 0) * k)); }
  doc.setLineDashPattern(p.dash && p.dash.length ? p.dash.map((v) => v * k) : [], 0);
  for (const s of parseD(p.d)) {
    if (!s.segs.length) continue;
    doc.lines(s.segs.map((g) => g.map((v) => v * k)), dx + s.start[0] * k, dy + s.start[1] * k, [1, 1], fill && stroke ? "FD" : fill ? "F" : "S", s.closed);
  }
  doc.setLineDashPattern([], 0);
}

// texte de la charte : police PDF standard, hauteur `sy` (mm), largeur ×(sx/sy), angle (degrés, sens trigonométrique)
export function drawText(doc, t, dx = 0, dy = 0, fields = {}, italic = false) {
  const str = String(t.str).replace(/\{(\w+)\}/g, (m, k) => (fields[k] != null ? fields[k] : ""));
  if (!str.trim()) return;
  const [fam, sty] = FONT[t.font] || FONT.Helvetica;
  doc.setFont(fam, italic ? (sty === "bold" ? "bolditalic" : "italic") : sty);
  doc.setFontSize(t.sy * PT);
  const c = hexRgb(t.color) || [0, 0, 0]; doc.setTextColor(...c);
  const r = t.sy ? t.sx / t.sy : 1;
  doc.internal.write(`${(r * 100).toFixed(2)} Tz`);
  doc.text(str, dx + t.at[0], dy + t.at[1], t.angle ? { angle: t.angle } : undefined);
  doc.internal.write("100 Tz");
}

// cadre de la feuille FTZ (trait fin à 1 mm du bord de la zone imprimée)
export function drawFrame(doc) {
  doc.setDrawColor(0); doc.setLineWidth(0.12); doc.setLineDashPattern([], 0);
  doc.rect(OX + 1, OY + 1, 408, 287);
}

// cartouche : tracés et libellés de la charte, champs du chantier ; le logo KiTéOHM (image haute définition) remplace
// celui dessiné par FTZ, à la même place
export function drawCartouche(doc, c, fields, logo) {
  const LOGO = new Set(["#00004F", "#FF3737"]);
  let lb = null;
  for (const p of c.paths) {
    const isLogo = LOGO.has(p.fill) || LOGO.has(p.stroke);
    if (isLogo) {
      for (const s of parseD(p.d)) { let x = s.start[0], y = s.start[1]; const pts = [[x, y]]; for (const g of s.segs) { x += g[g.length - 2]; y += g[g.length - 1]; pts.push([x, y]); }
        for (const [px, py] of pts) lb = lb ? { x0: Math.min(lb.x0, px), y0: Math.min(lb.y0, py), x1: Math.max(lb.x1, px), y1: Math.max(lb.y1, py) } : { x0: px, y0: py, x1: px, y1: py }; }
      if (logo) continue;
    }
    drawPath(doc, p, OX, OY);
  }
  for (const t of c.texts) {
    if (t.logo && !logo) continue;           // dessinée par ses contours quand il n'y a pas d'image
    drawText(doc, t, OX, OY, fields, /^\{/.test(t.str));
  }
  if (logo && lb) {
    // le mot KiTéOHM seul (sans la phrase, écrite en dessous) : partie haute de la zone du logo
    const tag = c.texts.filter((t) => t.logo).map((t) => t.at[1] - t.sy);
    const yTop = lb.y0, yBot = tag.length ? Math.min(...tag) - 0.6 : lb.y1;
    const h = Math.max(4, yBot - yTop), w = h * logo.ratio, cx = (lb.x0 + lb.x1) / 2;
    const ww = Math.min(w, lb.x1 - lb.x0), hh = ww / logo.ratio;
    doc.addImage(logo.data, "PNG", OX + cx - ww / 2, OY + yTop + (h - hh) / 2, ww, hh, undefined, "FAST");
  }
}

// ---------- légende : tableau 2 colonnes comme FTZ (symbole | libellé), seulement ce qui est utilisé ----------
// libellés FTZ des types Oktéo (même vocabulaire que les légendes du BE)
export const FTZ_NAMES = {
  PC16: "Prise de courant H0.30m (PMR H0.40m)", PC16H: "Prise de courant H1.20m", PC20: "Prise de courant 2.5² H0.30m (PMR H0.40m)",
  RJ45: "Prise RJ45 H0.30m (PMR H0.40m)", TV: "Prise télévision H0.30m (PMR H0.40m)", LUM: "Point lumineux", APP: "Applique étanche",
  INT: "Interrupteur simple allumage", VV: "Interrupteur Va-et-Vient", TAB: "Tableau d'alimentation générale basse tension",
  CETH: "Chauffe-eau électrique thermodynamique", CLIM: "Climatisation", RAD: "Convecteur de chauffage rayonnant", SS: "Sèche serviette",
  AQA: "Pompe à chaleur unité extérieur", ANT: "Antenne TV  H comble", PC32: "Sortie de cable 32A", PLAQ: "Sortie de cable 32A",
  CVR: "Interrupteur volet roulant connecté", CVMC: "Commande VMC", PCEXT: "Prise de courant étanche ext H0.30m (PMR H0.40m)",
  GEXT: "Prise de courant étanche ext H0.30m (PMR H0.40m)", LL: "Prise de courant spécialisée H0.30m (PMR H0.40m)",
  LV: "Prise de courant spécialisée H0.30m (PMR H0.40m)", SL: "Prise de courant spécialisée H0.30m (PMR H0.40m)",
  FOUR: "Prise de courant spécialisée H0.30m (PMR H0.40m)", BPS: "Bouton saillie pour carillon filaire", SON: "Carillon filaire",
  EQL: "Liaison équipotentielle", EQP: "Prise de terre",
};
export const LEG = { colS: 13.6, colL: 44.7, font: { font: "Helvetica", sy: 2.2, sx: 1.8 } };

// rangées : [{key, t, label}] ; types identiques au même libellé regroupés ; flèche du tableau et boîte en plus
export function legendRows(apps, { boxes = false, arrow = false, names = {} } = {}) {
  const seen = new Map();
  for (const a of apps) {
    const key = a.t === "PC16" && a.h >= 100 ? "PC16H" : a.t;
    const label = FTZ_NAMES[key] || names[a.t] || a.name || a.t;
    if (!seen.has(label)) seen.set(label, { key, t: a.t, label });
  }
  const rows = [...seen.values()];
  if (boxes) rows.push({ key: "BOX", label: "Boîte de dérivation (pieuvre)" });
  if (arrow) rows.push({ key: "ARROW", label: "Départ vers le tableau (boîte, ligne directe)" });
  return rows;
}
export const rowH = (r) => (["INT", "VV", "TAB", "BOX"].includes(r.key) ? 6.2 : 5);
export const legendSize = (rows) => ({ w: LEG.colS + LEG.colL, h: rows.reduce((s, r) => s + rowH(r), 0) });

// dessin de la légende en (x, y) = coin haut gauche ; drawSym(doc, t, cx, cy) dessine le symbole du plan
export function drawLegend(doc, rows, x, y, drawSym) {
  const { w, h } = legendSize(rows);
  doc.setFillColor(255, 255, 255); doc.setDrawColor(0); doc.setLineWidth(0.12); doc.setLineDashPattern([], 0);
  doc.rect(x, y, w, h, "FD");
  doc.line(x + LEG.colS, y, x + LEG.colS, y + h);
  let yy = y;
  rows.forEach((r, i) => {
    const rh = rowH(r), cy = yy + rh / 2, cx = x + LEG.colS / 2;
    if (i) doc.line(x, yy, x + w, yy);
    if (r.key === "ARROW") {
      doc.setDrawColor(0); doc.setLineWidth(0.12); doc.line(cx - 4.5, cy, cx + 4, cy);
      doc.setFillColor(0); doc.triangle(cx + 4.6, cy, cx + 3.2, cy - 0.7, cx + 3.2, cy + 0.7, "F");
    } else if (r.key === "BOX") {
      doc.setDrawColor(0, 128, 0); doc.setLineWidth(0.12); doc.setFillColor(255, 255, 255); doc.rect(cx - 3, cy - 2.4, 6, 4.8, "FD");
      drawText(doc, { str: "LI", font: "Times-Roman", sy: 3.52, sx: 2.08, at: [cx - 1.2, cy + 1.2], color: "#008000" });
    } else drawSym(doc, r.t, cx, cy, r);
    drawText(doc, { str: r.label, font: LEG.font.font, sy: LEG.font.sy, sx: LEG.font.sx, at: [x + LEG.colS + 1.2, cy + 0.75], color: "#000000" });
    yy += rh;
  });
  return { x, y, w, h };
}

// coin libre de la zone de dessin : le premier coin où la légende ne touche pas le plan, sinon celui qui le touche le moins
export function freeCorner(area, plan, size, pad = 2) {
  const C = [
    [area.x + area.w - size.w - pad, area.y + pad], [area.x + pad, area.y + pad],
    [area.x + area.w - size.w - pad, area.y + area.h - size.h - pad], [area.x + pad, area.y + area.h - size.h - pad],
  ];
  const ov = ([x, y]) => Math.max(0, Math.min(x + size.w, plan.x1) - Math.max(x, plan.x0)) * Math.max(0, Math.min(y + size.h, plan.y1) - Math.max(y, plan.y0));
  return C.map((c) => ({ c, o: ov(c) })).sort((a, b) => a.o - b.o)[0].c;
}

// ---------- encarts de la préparation d'impression ----------
export const ITEM_FONTS = { helvetica: "Helvetica", times: "Times", courier: "Courier" };
function styleOf(it) { return it.bold && it.italic ? "bolditalic" : it.bold ? "bold" : it.italic ? "italic" : "normal"; }
// découpe un texte en lignes qui tiennent dans la largeur w (mm)
export function wrapLines(doc, it) {
  doc.setFont(it.font || "helvetica", styleOf(it)); doc.setFontSize(it.size || 10);
  return String(it.text || "").split("\n").flatMap((l) => (it.w ? doc.splitTextToSize(l, Math.max(5, it.w - 2 * (it.pad ?? 1.5))) : [l]));
}

export function drawItem(doc, it, images = {}) {
  const col = hexRgb(it.color) || [0, 0, 0];
  doc.setLineDashPattern([], 0);
  if (it.type === "text") {
    const pad = it.pad ?? 1.5, lines = wrapLines(doc, it), lh = (it.size || 10) / PT * 1.18;
    const h = it.h || lines.length * lh + 2 * pad;
    if (it.frame && it.frame !== "none") {
      const fc = hexRgb(it.frameColor) || col; doc.setDrawColor(...fc); doc.setLineWidth(it.frameW || 0.35);
      const fill = hexRgb(it.fill); if (fill) doc.setFillColor(...fill);
      const st = fill ? "FD" : "S";
      if (it.frame === "round") doc.roundedRect(it.x, it.y, it.w, h, 2, 2, st); else doc.rect(it.x, it.y, it.w, h, st);
    }
    doc.setTextColor(...col); doc.setFont(it.font || "helvetica", styleOf(it)); doc.setFontSize(it.size || 10);
    const al = it.align || "left", tx = al === "center" ? it.x + it.w / 2 : al === "right" ? it.x + it.w - pad : it.x + pad;
    lines.forEach((l, i) => doc.text(l, tx, it.y + pad + lh * (i + 0.8), { align: al }));
  } else if (it.type === "arrow") {
    const w = it.lw || 0.35; doc.setDrawColor(...col); doc.setFillColor(...col); doc.setLineWidth(w);
    const dx = it.x2 - it.x, dy = it.y2 - it.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, hl = Math.max(2, w * 7), hw = hl * 0.45;
    doc.line(it.x, it.y, it.x2 - ux * hl * 0.8, it.y2 - uy * hl * 0.8);
    doc.triangle(it.x2, it.y2, it.x2 - ux * hl - uy * hw, it.y2 - uy * hl + ux * hw, it.x2 - ux * hl + uy * hw, it.y2 - uy * hl - ux * hw, "F");
  } else if (it.type === "warn") {
    // panneau ⚠ : triangle rouge, point d'exclamation noir (comme l'avertissement du cartouche FTZ)
    const s = it.size || 8, x = it.x, y = it.y, hgt = s * 0.87;
    doc.setDrawColor(255, 0, 0); doc.setFillColor(255, 255, 255); doc.setLineWidth(Math.max(0.3, s * 0.09)); doc.setLineJoin && doc.setLineJoin("round");
    doc.triangle(x + s / 2, y, x + s, y + hgt, x, y + hgt, "FD");
    doc.setTextColor(0); doc.setFont("helvetica", "bold"); doc.setFontSize(s * 0.62 * PT); doc.text("!", x + s / 2, y + hgt * 0.86, { align: "center" });
  } else if (it.type === "zone") {
    // zone interdite : contour en pointillés + hachures à 45° en pointillés, découpées à la forme
    const c = hexRgb(it.color) || [128, 0, 128]; doc.setDrawColor(...c); doc.setLineWidth(0.18);
    doc.saveGraphicsState();
    if (it.shape === "ellipse") doc.ellipse(it.x + it.w / 2, it.y + it.h / 2, it.w / 2, it.h / 2, null); else doc.rect(it.x, it.y, it.w, it.h, null);
    doc.clip(); doc.discardPath();
    doc.setLineDashPattern([0.6, 0.6], 0); doc.setLineWidth(0.12);
    const st = it.step || 2;
    for (let k = -it.h; k < it.w; k += st) doc.line(it.x + k, it.y + it.h, it.x + k + it.h, it.y);
    doc.restoreGraphicsState();
    doc.setDrawColor(...c); doc.setLineWidth(0.18); doc.setLineDashPattern([0.6, 0.6], 0);
    if (it.shape === "ellipse") doc.ellipse(it.x + it.w / 2, it.y + it.h / 2, it.w / 2, it.h / 2, "S"); else doc.rect(it.x, it.y, it.w, it.h, "S");
    doc.setLineDashPattern([], 0);
  } else if (it.type === "image" && images[it.ref]) {
    const im = images[it.ref];
    doc.addImage(im.data, im.fmt || "JPEG", it.x, it.y, it.w, it.h, undefined, "FAST");
  }
}

// encarts types (bibliothèque) : textes que le BE remet souvent ; l'utilisateur peut en ajouter (localStorage)
export const ENCARTS = [
  { id: "rampants", label: "Bandeau : boîtes dans les rampants", item: { type: "text", w: 150, text: "LES BOÎTES SE TROUVENT DANS LES RAMPANTS DES COMBLES AMÉNAGEABLES", font: "helvetica", size: 11, bold: true, color: "#FF0000", frame: "rect", frameColor: "#FF0000", frameW: 0.3, align: "center" } },
  { id: "attente", label: "Boîte en attente dans les combles", item: { type: "text", w: 52, text: "EMPLACEMENT BOITE\nEN ATTENTE DANS COMBLES\nA DEFINIR AVANT POSE", font: "courier", size: 9, bold: true, color: "#FF0000", frame: "round", frameColor: "#FF0000", frameW: 0.3, align: "center" } },
  { id: "sdb", label: "Attention : interrupteur de SDB", item: { type: "text", w: 72, text: "ATTENTION DANS SDB L'INTERRUPTEUR A L'ENTREE DOIT ETRE A PLUS 1,80M DU MITIGEUR (DOUCHE DE PLAIN-PIED) ET A PLUS 60CM DU BORD D'UN BAC A DOUCHE OU INSTALLER UNE CLOISON FIXE ET PERENNE D'AU-MOINS 2,25M DE HAUT", font: "helvetica", size: 8, bold: true, color: "#FF0000", frame: "rect", frameColor: "#FF0000", frameW: 0.3, align: "center" } },
  { id: "hauteurs", label: "Liste des hauteurs (cuisine…)", item: { type: "text", w: 32, text: "P1 HT1.20M\nP2 HT0.30M", font: "courier", size: 8, bold: true, color: "#800080", frame: "round", frameColor: "#800080", frameW: 0.3, align: "center" } },
];

// ---------- v74 MAJ 2 : cotes de position des boîtes (comme les plans du BE) ----------
// Pour chaque boîte : distance horizontale et verticale entre le centre de la boîte et la face du mur le plus proche
// (premier mur touché en partant de la boîte vers la gauche / la droite, puis vers le haut / le bas). En mètres.
function rayHit(walls, x, y, dx, dy) {
  let best = Infinity;
  for (const P of walls) for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length];
    if (dy === 0) {
      if ((a.y > y) === (b.y > y)) continue;
      const t = (y - a.y) / (b.y - a.y), hx = a.x + t * (b.x - a.x), d = (hx - x) * dx;
      if (d > 0.01 && d < best) best = d;
    } else {
      if ((a.x > x) === (b.x > x)) continue;
      const t = (x - a.x) / (b.x - a.x), hy = a.y + t * (b.y - a.y), d = (hy - y) * dy;
      if (d > 0.01 && d < best) best = d;
    }
  }
  return best;
}
export function boxCotes(boxes, walls, max = 12) {
  const out = [];
  for (const b of boxes) {
    const L = rayHit(walls, b.x, b.y, -1, 0), R = rayHit(walls, b.x, b.y, 1, 0), U = rayHit(walls, b.x, b.y, 0, -1), D = rayHit(walls, b.x, b.y, 0, 1);
    const h = Math.min(L, R), v = Math.min(U, D);
    if (h < max) out.push({ box: b.id, n: b.n, axis: "x", a: L <= R ? b.x - L : b.x + R, b: b.x, at: b.y, cm: Math.round(h * 100) });
    if (v < max) out.push({ box: b.id, n: b.n, axis: "y", a: U <= D ? b.y - U : b.y + D, b: b.y, at: b.x, cm: Math.round(v * 100) });
  }
  return out;
}
// dessin : cotes horizontales au-dessus ou au-dessous du plan, verticales à gauche ou à droite (côté le plus proche de la
// boîte), lignes d'attache jusqu'au bord du plan, valeur en cm (Courier gras 2,97 mm ×0,66, violet #800080)
export const COTE_STYLE = { color: [128, 0, 128], w: 0.12, font: { font: "Courier-Bold", sy: 2.97, sx: 1.96, color: "#800080" }, gap: 7, step: 5, min: 20 };
export function drawBoxCotes(doc, cotes, X, Y, plan, area, walls = []) {
  const C = COTE_STYLE, used = { top: 0, bottom: 0, left: 0, right: 0 };
  // enveloppe du bâti (murs) sur le papier : les cotes se rangent juste à l'extérieur
  const pts = walls.flat(), env = pts.length ? { x0: Math.min(...pts.map((p) => X(p.x))), x1: Math.max(...pts.map((p) => X(p.x))), y0: Math.min(...pts.map((p) => Y(p.y))), y1: Math.max(...pts.map((p) => Y(p.y))) } : plan;
  const midX = (env.x0 + env.x1) / 2, midY = (env.y0 + env.y1) / 2, FAR = 1e4;
  // ligne d'attache : du trait de cote jusqu'au premier mur rencontré en venant de l'extérieur
  const edgeY = (xm, top) => { const d = rayHit(walls, xm, top ? -FAR : FAR, 0, top ? 1 : -1); return d < Infinity ? Y(top ? -FAR + d : FAR - d) : top ? env.y0 : env.y1; };
  const edgeX = (ym, left) => { const d = rayHit(walls, left ? -FAR : FAR, ym, left ? 1 : -1, 0); return d < Infinity ? X(left ? -FAR + d : FAR - d) : left ? env.x0 : env.x1; };
  const list = cotes.filter((c) => c.cm >= C.min).sort((p, q) => Math.abs(p.a - p.b) - Math.abs(q.a - q.b));
  const drawn = [];
  doc.setDrawColor(...C.color); doc.setLineWidth(C.w); doc.setLineDashPattern([], 0);
  const tick = (x, y) => doc.line(x - 0.7, y + 0.7, x + 0.7, y - 0.7);
  for (const c of list) {
    if (c.axis === "x") {
      const top = Y(c.at) < midY, side = top ? "top" : "bottom", k = used[side]++;
      let yy = top ? env.y0 - C.gap - k * C.step : env.y1 + C.gap + k * C.step;
      yy = Math.max(area.y + 3, Math.min(area.y + area.h - 1, yy));
      const xa = X(c.a), xb = X(c.b);
      doc.line(xa, yy, xb, yy); tick(xa, yy); tick(xb, yy);
      [[xa, c.a], [xb, c.b]].forEach(([x, xm]) => { const e = edgeY(xm, top); doc.line(x, yy + (top ? -1 : 1), x, e + (top ? -0.6 : 0.6)); });
      drawText(doc, { str: String(c.cm), ...C.font, at: [(xa + xb) / 2 - String(c.cm).length * 0.9, yy - 0.8] });
      drawn.push({ ...c, line: yy, side });
    } else {
      const left = X(c.at) < midX, side = left ? "left" : "right", k = used[side]++;
      let xx = left ? env.x0 - C.gap - k * C.step : env.x1 + C.gap + k * C.step;
      xx = Math.max(area.x + 3, Math.min(area.x + area.w - 3, xx));
      const ya = Y(c.a), yb = Y(c.b);
      doc.line(xx, ya, xx, yb); tick(xx, ya); tick(xx, yb);
      [[ya, c.a], [yb, c.b]].forEach(([y, ym]) => { const e = edgeX(ym, left); doc.line(xx + (left ? -1 : 1), y, e + (left ? -0.6 : 0.6), y); });
      drawText(doc, { str: String(c.cm), ...C.font, angle: 90, at: [xx - 0.8, (ya + yb) / 2 + String(c.cm).length * 0.9] });
      drawn.push({ ...c, line: xx, side });
    }
  }
  return drawn;
}
