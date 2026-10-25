// Relevé automatique des appareils électriques d'un plan PDF de pavillonneur, sans IA.
// Entrée : les tracés de la page (extract.js → shapes, courbes échantillonnées) et ses textes, en points de page.
// 1. on repère les cercles (tout symbole électrique courant en contient un) ;
// 2. on regarde ce qui les accompagne, dans la même couleur : traits intérieurs (point lumineux ⊗, prise ⊖),
//    rayons courts (spot ☼), queue (interrupteur ○⁄, deux queues = va-et-vient), croix qui dépasse (sortie de câble ⊗,
//    bouche VMC ⊕), cercle dans le cercle (RJ45 ◎) ;
// 3. le texte voisin précise la prise (16 A / 20 A / 32 A, hauteur « H:1.20m » quand le texte est lisible) ;
// 4. les traits qui relient une commande à un point lumineux (et les points lumineux entre eux) deviennent des liaisons.
// Tout est mesuré par rapport au rayon du cercle : le relevé ne dépend pas de l'échelle du plan.

const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

// cercle = polyligne d'au moins 8 points, tous à la même distance du centre de sa boîte
function asCircle(s) {
  if (s.pts.length < 8) return null;
  const w = s.x1 - s.x0, h = s.y1 - s.y0, cx = (s.x0 + s.x1) / 2, cy = (s.y0 + s.y1) / 2;
  const d = s.pts.map(([x, y]) => dist(x, y, cx, cy)), r = d.reduce((a, b) => a + b, 0) / d.length;
  if (r < 0.4 || Math.abs(w - h) > 0.15 * r) return null;
  const sd = Math.sqrt(d.reduce((a, b) => a + (b - r) ** 2, 0) / d.length);
  if (sd / r > 0.07) return null;
  // il faut faire (presque) tout le tour : pas un arc de porte
  const a = s.pts.map(([x, y]) => Math.atan2(y - cy, x - cx)).sort((p, q) => p - q);
  let gap = a[0] + 2 * Math.PI - a[a.length - 1];
  for (let i = 1; i < a.length; i++) gap = Math.max(gap, a[i] - a[i - 1]);
  if (gap > 1.2) return null;
  return { cx, cy, r, color: s.stroke || s.fill, filled: !!s.fill && !s.stroke, pid: s.pid };
}

const KIND = {
  LUM: "Point lumineux", SPOT: "Spot", PC16: "Prise 16 A", PC20: "Prise 20 A", RJ45: "RJ45", INT: "Interrupteur",
  VV: "Va-et-vient", VMC: "Bouche VMC", SC: "Sortie de câble",
};

export function detectDevices(ex, texts, { k, ox = 0, oy = 0 }, opts = {}) {
  const shapes = ex.shapes || [];
  // ---- 1. cercles (doublons trait + aplat fusionnés)
  const circles = [];
  for (const s of shapes) {
    const c = asCircle(s); if (!c) continue;
    const twin = circles.find((o) => dist(o.cx, o.cy, c.cx, c.cy) < 0.25 * c.r && Math.abs(o.r - c.r) < 0.15 * c.r);
    if (twin) { if (twin.filled && !c.filled) Object.assign(twin, { color: c.color, filled: false }); continue; }
    circles.push(c);
  }
  // ---- traits disponibles (hors cercles), avec leur couleur et le chemin d'origine
  const segs = [];
  for (const s of shapes) {
    if (!s.stroke || asCircle(s)) continue;
    for (let i = 0; i + 1 < s.pts.length; i++) {
      const [x1, y1] = s.pts[i], [x2, y2] = s.pts[i + 1];
      if (dist(x1, y1, x2, y2) > 0.05) segs.push({ x1, y1, x2, y2, color: s.stroke });
    }
  }
  // index spatial simple (grille) pour ne regarder que les traits proches d'un cercle
  const G = 12, grid = new Map();
  segs.forEach((g, i) => {
    const xs = [Math.floor(Math.min(g.x1, g.x2) / G), Math.floor(Math.max(g.x1, g.x2) / G)], ys = [Math.floor(Math.min(g.y1, g.y2) / G), Math.floor(Math.max(g.y1, g.y2) / G)];
    for (let X = xs[0]; X <= xs[1]; X++) for (let Y = ys[0]; Y <= ys[1]; Y++) { const kk = X + "," + Y; if (!grid.has(kk)) grid.set(kk, []); grid.get(kk).push(i); }
  });
  const near = (x, y, R) => {
    const out = new Set();
    for (let X = Math.floor((x - R) / G); X <= Math.floor((x + R) / G); X++) for (let Y = Math.floor((y - R) / G); Y <= Math.floor((y + R) / G); Y++) (grid.get(X + "," + Y) || []).forEach((i) => out.add(i));
    return [...out].map((i) => segs[i]);
  };

  // ---- 2. ce qui accompagne chaque cercle
  const radial = (c, g) => {    // trait orienté vers le centre ? (angle entre le trait et le rayon)
    const n = dist(g.x1, g.y1, c.cx, c.cy) < dist(g.x2, g.y2, c.cx, c.cy) ? [g.x1, g.y1, g.x2, g.y2] : [g.x2, g.y2, g.x1, g.y1];
    const vx = n[2] - n[0], vy = n[3] - n[1], rx = n[2] - c.cx, ry = n[3] - c.cy, L = Math.hypot(vx, vy) * Math.hypot(rx, ry) || 1;
    return { cos: Math.abs(vx * rx + vy * ry) / L, dn: dist(n[0], n[1], c.cx, c.cy), df: dist(n[2], n[3], c.cx, c.cy), ang: Math.atan2(ry, rx) };
  };
  for (const c of circles) {
    const f = { inner: 0, rays: [], tails: [], spokes: [] };
    for (const g of near(c.cx, c.cy, c.r * 6)) {
      if (g.color !== c.color) continue;
      const q = radial(c, g), len = dist(g.x1, g.y1, g.x2, g.y2);
      if (q.df < c.r * 1.1 && len > c.r * 0.3) { f.inner++; continue; }
      if (q.dn < c.r * 0.3 && q.df > c.r * 1.15 && q.df < c.r * 2.4 && q.cos > 0.95) { f.spokes.push(q.ang); continue; }      // croix qui dépasse
      if (q.dn > c.r * 0.8 && q.dn < c.r * 1.45 && q.cos > 0.9) {
        if (q.df > c.r * 1.2 && q.df <= c.r * 2.3) f.rays.push(q.ang);
        else if (q.df > c.r * 2.3 && q.df < c.r * 6) f.tails.push(q.ang);
      }
    }
    c.f = f;
  }
  // cercles concentriques : le petit appartient au grand (RJ45 ◎, ou décor d'un symbole)
  for (const c of circles) for (const o of circles) {
    if (o === c || o.r >= c.r || o.color !== c.color) continue;
    if (dist(o.cx, o.cy, c.cx, c.cy) < 0.25 * c.r && o.r / c.r > 0.25 && o.r / c.r < 0.8) { o.inside = c; c.ring = (c.ring || 0) + 1; }
  }

  // ---- taille de référence : le petit cercle le plus fréquent (prise, interrupteur)
  const rs = circles.filter((c) => !c.inside).map((c) => +c.r.toFixed(1));
  const freq = {}; rs.forEach((r) => (freq[r] = (freq[r] || 0) + 1));
  const r0 = +Object.entries(freq).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] || 2;

  // ---- classement
  const angSpread = (as) => { if (as.length < 2) return 0; let m = 0; for (const a of as) for (const b of as) { let d = Math.abs(a - b); if (d > Math.PI) d = 2 * Math.PI - d; m = Math.max(m, d); } return m; };
  const diag = (as) => as.filter((a) => Math.abs(Math.sin(2 * a)) > 0.8).length;
  const devices = [], unknown = [];
  for (const c of circles) {
    if (c.inside) continue;
    const f = c.f, rel = c.r / r0;
    let t = null;
    if (rel > 2 && f.inner >= 4) t = "LUM";
    else if (rel > 1.2 && rel <= 2.2 && f.rays.length >= 3) t = "SPOT";
    else if (f.spokes.length >= 3) t = diag(f.spokes) >= 3 ? "SC" : "VMC";
    else if (rel >= 0.7 && rel <= 1.4) {
      if (c.ring) t = "RJ45";
      else if (f.tails.length >= 2) t = angSpread(f.tails) > 2.2 ? "VV" : "INT";
      else if (f.tails.length === 1) t = "INT";
      else if (f.inner >= 1) t = "PC16";
    }
    if (!t) { unknown.push(c); continue; }
    devices.push({ t, px: c.cx, py: c.cy, pr: c.r, x: +(ox + c.cx * k).toFixed(3), y: +(oy + c.cy * k).toFixed(3) });
  }

  // ---- 3. textes voisins (prises : intensité et hauteur)
  const labels = (texts || []).filter((t) => t.str && t.str.trim());
  const maxSize = Math.max(0, ...labels.map((t) => t.size));
  const small = labels.filter((t) => t.size < maxSize * 0.9);                 // les plus gros textes sont les noms de pièces
  const nearestText = (d) => {
    let best = null, bd = r0 * 14;
    for (const t of small) { const dd = dist(t.x, t.y, d.px, d.py); if (dd < bd) { bd = dd; best = t; } }
    return best;
  };
  const readable = (s) => /\d\s*[Aa]\b/.test(s) || /H\s*[:=]/.test(s);
  const prises = devices.filter((d) => d.t === "PC16");
  prises.forEach((d) => { const t = nearestText(d); d.label = t ? t.str : ""; d.labelSize = t ? t.size : 0; });
  if (prises.some((d) => readable(d.label))) {
    for (const d of prises) {
      const m = /(\d{2})\s*A/i.exec(d.label); if (m && +m[1] >= 20) d.t = "PC20";
      const h = /H\s*[:=]?\s*(\d+[.,]\d+)\s*m/i.exec(d.label); if (h) d.h = Math.round(parseFloat(h[1].replace(",", ".")) * 100);
    }
  } else {
    // police codée : le texte le plus fréquent à côté des prises est « 16A » ; un texte de même longueur qui finit
    // par le même caractère (« A ») mais qui diffère est une prise spécialisée (20 A, 32 A)
    // (on compare le début du texte : « 16A H:1.20m » commence par « 16A », « 20A H:0.30m » par « 20A »)
    const cnt = {}; prises.forEach((d) => { if (d.label) cnt[d.label] = (cnt[d.label] || 0) + 1; });
    const ref = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (ref && cnt[ref] >= 3) for (const d of prises) {
      const W = d.label.slice(0, ref.length);
      if (W.length === ref.length && W !== ref && W.slice(-1) === ref.slice(-1)) d.t = "PC20";
    }
    if (opts.debug) prises.forEach((d) => console.log(Math.round(d.px), Math.round(d.py), JSON.stringify(d.label), d.t));
  }

  // ---- 4. liaisons : un trait (hors symbole) qui part d'une commande et arrive à un point lumineux
  const isCmd = (t) => t === "INT" || t === "VV";
  const isLight = (t) => t === "LUM" || t === "SPOT";
  const symColor = new Set(circles.filter((c) => !c.inside && devices.some((d) => d.px === c.cx && d.py === c.cy)).map((c) => c.color));
  const reach = (d) => (isCmd(d.t) ? d.pr * 5 : d.pr * 1.8);
  const at = (x, y) => {
    let best = -1, bd = Infinity;
    devices.forEach((d, i) => { const dd = dist(x, y, d.px, d.py); if (dd < reach(d) && dd < bd) { bd = dd; best = i; } });
    return best;
  };
  const edges = [];
  for (const s of shapes) {
    if (!s.stroke || symColor.has(s.stroke) || s.closed || s.pts.length < 2) continue;
    let L = 0; for (let i = 1; i < s.pts.length; i++) L += dist(...s.pts[i - 1], ...s.pts[i]);
    if (L < r0 * 4) continue;
    const a = at(...s.pts[0]), b = at(...s.pts[s.pts.length - 1]);
    if (a < 0 || b < 0 || a === b) continue;
    const ta = devices[a].t, tb = devices[b].t;
    if ((isCmd(ta) && isLight(tb)) || (isLight(ta) && isCmd(tb)) || (isLight(ta) && isLight(tb)) || (isCmd(ta) && isCmd(tb))) edges.push([a, b]);
  }
  // une commande allume les points lumineux qu'elle touche, et ceux qui leur sont reliés de proche en proche
  // (sans passer par une autre commande) ; deux commandes reliées entre elles (va-et-vient) partagent leurs points
  const adj = devices.map(() => []);
  edges.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a); });
  const reached = (i) => {
    const seen = new Set(), stack = adj[i].filter((j) => isLight(devices[j].t));
    while (stack.length) { const j = stack.pop(); if (seen.has(j)) continue; seen.add(j); adj[j].forEach((n) => { if (isLight(devices[n].t)) stack.push(n); }); }
    return seen;
  };
  const own = devices.map((d, i) => (isCmd(d.t) ? reached(i) : null));
  const links = [], seenL = new Set();
  devices.forEach((d, i) => {
    if (!isCmd(d.t)) return;
    const all = new Set(own[i]);
    adj[i].forEach((j) => { if (isCmd(devices[j].t)) own[j].forEach((l) => all.add(l)); });
    all.forEach((j) => { const key = i + ":" + j; if (!seenL.has(key)) { seenL.add(key); links.push({ c: i, l: j }); } });
  });

  const byType = {}; devices.forEach((d) => (byType[d.t] = (byType[d.t] || 0) + 1));
  return {
    devices: devices.map(({ t, x, y, h }) => (h ? { t, x, y, h } : { t, x, y })),
    links,
    unknown: unknown.map((c) => ({ x: +(ox + c.cx * k).toFixed(3), y: +(oy + c.cy * k).toFixed(3) })),
    stats: { byType, cercles: circles.length, inconnus: unknown.length, liaisons: links.length },
    names: KIND,
  };
}

// textes d'une page en points de page (même repère que extract.js)
export async function pageTexts(page) {
  const vp = page.getViewport({ scale: 1 });
  const tc = await page.getTextContent();
  return tc.items.filter((i) => i.str && i.str.trim()).map((i) => {
    const [x, y] = vp.convertToViewportPoint(i.transform[4], i.transform[5]);
    const size = Math.hypot(i.transform[2], i.transform[3]);
    const ang = Math.atan2(i.transform[1], i.transform[0]);
    const w = i.width || 0;
    // milieu du texte (les textes tournés sont fréquents à côté des prises)
    return { str: i.str, size, x: x + Math.cos(ang) * w / 2 + Math.sin(ang) * size * 0.35, y: y - Math.sin(ang) * w / 2 - Math.cos(ang) * size * 0.35 };
  });
}
