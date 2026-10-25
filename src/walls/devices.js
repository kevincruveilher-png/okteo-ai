// Relevé automatique des appareils électriques d'un plan PDF de pavillonneur, sans IA.
// Entrée : les tracés de la page (extract.js → shapes, courbes échantillonnées) et ses textes, en points de page.
// 1. on repère les cercles (tout symbole électrique courant en contient un) ;
// 2. on regarde ce qui les accompagne, dans la même couleur : traits intérieurs (point lumineux ⊗, prise ⊖),
//    rayons courts (spot ☼), queue (interrupteur ○⁄, deux queues = va-et-vient), croix qui dépasse (sortie de câble ⊗,
//    bouche VMC ⊕), cercle dans le cercle (RJ45 ◎) ;
// 3. le texte voisin précise la prise (16 A / 20 A / 32 A, hauteur « H:1.20m »), même en police codée (digits.js) ;
// 4. les traits qui relient une commande à un point lumineux (et les points lumineux entre eux) deviennent des liaisons.
// Tout est mesuré par rapport au rayon du cercle : le relevé ne dépend pas de l'échelle du plan.

import { solveDigits, readDigits, parseDeviceLabel } from "./digits.js";

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
  const prises = devices.filter((d) => d.t === "PC16");
  // chiffres : lisibles, ou retrouvés grâce aux cotes du plan (police codée) → « 16A H:1.20m » = 16 A à 120 cm
  const sols = solveDigits(small, ex.segs || [], k);
  const AMPS = [10, 16, 20, 32];
  const devLabels = small.map((t) => {
    const read = readDigits(t, sols), p = parseDeviceLabel(read);
    // une étiquette d'appareil contient des lettres (« A », « H: ») : une cote « 1.50 » n'en est pas une
    if (!read.includes("?") && !/[A-Za-z]/.test(t.str)) return null;
    const amp = AMPS.includes(p.amp) ? p.amp : null, h = p.h >= 20 && p.h <= 250 ? p.h : null;
    if (!amp && h && read.replace(/\s/g, "").length > 8) return null;    // « All : 1.10 m » (allège de fenêtre) n'est pas une hauteur d'appareil
    return amp || h ? { t, amp, h, read } : null;
  }).filter(Boolean);
  // « 16A » et « H:1.20m » sont souvent deux textes l'un sous l'autre : on les réunit
  for (const H of devLabels.filter((L) => L.h && !L.amp)) {
    let best = null, bd = H.t.size * 2.6;
    for (const L of devLabels) { if (L.amp && !L.h) { const dd = dist(L.t.x, L.t.y, H.t.x, H.t.y); if (dd < bd) { bd = dd; best = L; } } }
    if (best) { best.h = H.h; H.merged = true; }
  }
  for (let i = devLabels.length - 1; i >= 0; i--) if (devLabels[i].merged) devLabels.splice(i, 1);
  let byLabel = 0;
  for (const d of prises) {
    let best = null, bd = r0 * 14;
    for (const L of devLabels) { const dd = dist(L.t.x, L.t.y, d.px, d.py); if (dd < bd) { bd = dd; best = L; } }
    if (!best) continue;
    byLabel++;
    if (best.amp >= 20) d.t = "PC20";
    if (best.h) d.h = best.h;
    if (opts.debug) console.log(Math.round(d.px), Math.round(d.py), best.read, d.t, d.h || "");
  }
  if (!byLabel) {
    // police codée sans cotes lisibles : le texte le plus fréquent à côté des prises est « 16A » ; un texte qui commence
    // par un mot de même longueur, finissant par le même caractère (« A ») mais différent, est une prise 20 A ou 32 A
    prises.forEach((d) => { const t = nearestText(d); d.label = t ? t.str : ""; });
    const cnt = {}; prises.forEach((d) => { if (d.label) cnt[d.label] = (cnt[d.label] || 0) + 1; });
    const ref = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (ref && cnt[ref] >= 3) for (const d of prises) {
      const W = d.label.slice(0, ref.length);
      if (W.length === ref.length && W !== ref && W.slice(-1) === ref.slice(-1)) d.t = "PC20";
    }
  }
  // échelle vue par les cotes du plan (1 = le fond est à la bonne échelle)
  const solList = [...sols.values()].sort((a, b) => b.checked - a.checked);
  const scaleCheck = solList.length ? { facteur: +solList[0].scale.toFixed(4), cotes: solList[0].checked } : null;

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
    stats: { byType, cercles: circles.length, inconnus: unknown.length, liaisons: links.length, etiquettes: byLabel, hauteurs: prises.filter((d) => d.h).length },
    scaleCheck,
    names: KIND,
  };
}

// textes d'une page en points de page (même repère que extract.js)
export async function pageTexts(page) {
  const vp = page.getViewport({ scale: 1 });
  const tc = await page.getTextContent();
  return tc.items.filter((i) => i.str && i.str.trim()).map((i) => {
    const [a, b, c, d, e, f] = i.transform;
    const size = Math.hypot(c, d), na = Math.hypot(a, b) || 1, nc = size || 1, w = i.width || 0;
    // milieu du texte, calculé dans le repère du PDF (textes tournés, page éventuellement tournée), puis ramené sur la page
    const mx = e + (a / na) * w / 2 + (c / nc) * size * 0.35, my = f + (b / na) * w / 2 + (d / nc) * size * 0.35;
    const [x, y] = vp.convertToViewportPoint(mx, my), [x2, y2] = vp.convertToViewportPoint(mx + a / na, my + b / na);
    return { str: i.str, font: i.fontName, size, ang: Math.atan2(-(y2 - y), x2 - x), x, y };
  });
}
