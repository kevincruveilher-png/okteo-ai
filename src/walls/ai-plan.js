// Relevé du plan par l'IA (v31) — partie pure, sans DOM : consigne envoyée au modèle, lecture de sa réponse,
// remise au propre de la géométrie (murs redressés, sommets fusionnés, jonctions en T coupées), conversion pixels → mètres.
// L'IA travaille en pixels de l'image envoyée ; `map` = { x0, y0, sx, sy } : x (m) = x0 + u × sx, y (m) = y0 + v × sy.

export const AI_TYPES = {
  PC16: "prise de courant 16 A",
  PC20: "prise spécialisée 20 A ou 32 A (four, plaque, lave-linge…)",
  RJ45: "prise réseau RJ45 / téléphone / TV",
  LUM: "point lumineux au plafond (DCL)",
  APP: "applique murale",
  SPOT: "spot encastré",
  INT: "interrupteur simple",
  VV: "va-et-vient",
  BP: "bouton poussoir",
  VMC: "bouche de VMC",
  TAB: "tableau électrique",
  SC: "sortie de câble (volet roulant, chauffe-eau, extérieur…)",
};

export function aiPrompt({ W, H, cmPerPx }) {
  const types = Object.entries(AI_TYPES).map(([k, v]) => `  ${k} = ${v}`).join("\n");
  return `Voici le plan d'une maison individuelle (image de ${W} × ${H} pixels ; 1 pixel ≈ ${cmPerPx.toFixed(2)} cm ; origine en haut à gauche, x vers la droite, y vers le bas).
Relève ce plan pour le redessiner : murs, portes et fenêtres, pièces, appareillage électrique et liaisons commande → lumière.

Règles :
- Coordonnées en PIXELS de cette image, nombres entiers.
- Un mur = un segment sur l'AXE du mur (milieu de son épaisseur), d'un angle à l'autre ; "ep" = épaisseur en cm (murs extérieurs souvent 20 à 30 cm, cloisons 5 à 10 cm). Les murs se rejoignent exactement aux angles et aux jonctions en T (même point).
- Ne coupe pas un mur aux portes et fenêtres : donne les ouvertures à part (centre, largeur en cm, "porte" ou "fenetre").
- Pièces : le nom écrit sur le plan et un point à l'intérieur de la pièce.
- Appareils : le centre du symbole et son type parmi :
${types}
- Liaisons : [indice de la commande, indice de la lumière] dans la liste des appareils (INT, VV ou BP vers LUM, APP ou SPOT).
- N'invente rien : si tu ne vois pas d'appareils, laisse la liste vide.

Réponds UNIQUEMENT avec ce JSON (sans texte autour) :
{"murs":[{"x1":0,"y1":0,"x2":0,"y2":0,"ep":20}],
 "ouvertures":[{"x":0,"y":0,"l":90,"t":"porte"}],
 "pieces":[{"nom":"Cuisine","x":0,"y":0}],
 "appareils":[{"t":"PC16","x":0,"y":0}],
 "liaisons":[[0,1]],
 "remarques":"ce qui est douteux, en une ou deux phrases"}`;
}

// la réponse peut contenir des ``` ou du texte autour : on prend le premier objet JSON complet
export function parseAiJson(text) {
  const s = String(text || "").replace(/```(?:json)?/gi, "");
  const i = s.indexOf("{");
  if (i < 0) throw new Error("La réponse de l'IA ne contient pas de données.");
  let depth = 0, inStr = false, esc = false;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return JSON.parse(s.slice(i, j + 1));
  }
  throw new Error("La réponse de l'IA est coupée (données incomplètes).");
}

const num = (v) => (typeof v === "number" ? v : parseFloat(v));
const ok = (...v) => v.every((x) => Number.isFinite(x));
const LIGHT = new Set(["LUM", "APP", "SPOT"]), CMD = new Set(["INT", "VV", "BP"]);

// Réponse de l'IA → { nodes, walls, openings } (format du relevé automatique), pieces, devices, links, stats
export function aiToPlan(raw, map, { defEp = 0.2, mergeTol = 0.15, axisTol = 4 } = {}) {
  const P = (u, v) => ({ x: map.x0 + u * map.sx, y: map.y0 + v * map.sy });
  const stats = { mursLus: 0, redresses: 0, coupes: 0, ouverturesPerdues: 0 };

  // 1. murs en mètres, redressés s'ils sont presque horizontaux / verticaux
  let W = [];
  for (const m of raw.murs || []) {
    const x1 = num(m.x1), y1 = num(m.y1), x2 = num(m.x2), y2 = num(m.y2);
    if (!ok(x1, y1, x2, y2)) continue;
    stats.mursLus++;
    let a = P(x1, y1), b = P(x2, y2);
    const ang = Math.abs(Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI) % 180;
    if (Math.min(ang, 180 - ang) <= axisTol) { const y = (a.y + b.y) / 2; a = { x: a.x, y }; b = { x: b.x, y }; stats.redresses++; }
    else if (Math.abs(ang - 90) <= axisTol) { const x = (a.x + b.x) / 2; a = { x, y: a.y }; b = { x, y: b.y }; stats.redresses++; }
    const ep = Math.min(0.5, Math.max(0.05, num(m.ep) > 0 ? num(m.ep) / 100 : defEp));
    if (Math.hypot(b.x - a.x, b.y - a.y) < 0.2) continue;
    W.push({ a, b, ep });
  }

  // 2. sommets proches fusionnés (moyenne), en gardant les murs redressés droits
  const nodes = [];
  const nodeAt = (p) => {
    let n = nodes.find((q) => Math.hypot(q.x - p.x, q.y - p.y) <= mergeTol);
    if (!n) { n = { x: p.x, y: p.y, k: nodes.length, c: 1 }; nodes.push(n); }
    else { n.x = (n.x * n.c + p.x) / (n.c + 1); n.y = (n.y * n.c + p.y) / (n.c + 1); n.c++; }
    return n.k;
  };
  let segs = W.map((w) => ({ a: nodeAt(w.a), b: nodeAt(w.b), ep: w.ep })).filter((s) => s.a !== s.b);
  // un mur presque horizontal / vertical après fusion : on aligne ses deux sommets
  for (const s of segs) {
    const A = nodes[s.a], B = nodes[s.b], dx = Math.abs(B.x - A.x), dy = Math.abs(B.y - A.y);
    if (dy > 0 && dy <= mergeTol && dx > 4 * dy) { const y = (A.y + B.y) / 2; A.y = y; B.y = y; }
    else if (dx > 0 && dx <= mergeTol && dy > 4 * dx) { const x = (A.x + B.x) / 2; A.x = x; B.x = x; }
  }

  // 3. jonctions en T : un sommet posé sur un autre mur coupe ce mur en deux (sinon les pièces ne se ferment pas)
  for (let pass = 0; pass < 3; pass++) {
    let cut = false;
    for (let k = 0; k < nodes.length; k++) {
      const N = nodes[k];
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i]; if (s.a === k || s.b === k) continue;
        const A = nodes[s.a], B = nodes[s.b], L = Math.hypot(B.x - A.x, B.y - A.y); if (L < 1e-6) continue;
        const ux = (B.x - A.x) / L, uy = (B.y - A.y) / L;
        const t = (N.x - A.x) * ux + (N.y - A.y) * uy, d = Math.abs((N.x - A.x) * -uy + (N.y - A.y) * ux);
        if (d > mergeTol || t < 0.05 || t > L - 0.05) continue;
        N.x = A.x + ux * t; N.y = A.y + uy * t;
        segs.splice(i, 1, { a: s.a, b: k, ep: s.ep }, { a: k, b: s.b, ep: s.ep });
        stats.coupes++; cut = true; break;
      }
    }
    if (!cut) break;
  }
  // doublons (même paire de sommets)
  const seen = new Set();
  segs = segs.filter((s) => { const key = Math.min(s.a, s.b) + "-" + Math.max(s.a, s.b); if (seen.has(key)) return false; seen.add(key); return true; });

  // 4. ouvertures : posées sur le mur le plus proche (distance le long du mur depuis son 1er sommet)
  const openings = [];
  for (const o of raw.ouvertures || []) {
    const u = num(o.x), v = num(o.y); if (!ok(u, v)) continue;
    const p = P(u, v), w = Math.min(3.2, Math.max(0.4, num(o.l) > 0 ? num(o.l) / 100 : 0.9));
    let best = null;
    segs.forEach((s, i) => {
      const A = nodes[s.a], B = nodes[s.b], L = Math.hypot(B.x - A.x, B.y - A.y); if (L < w) return;
      const ux = (B.x - A.x) / L, uy = (B.y - A.y) / L;
      const t = (p.x - A.x) * ux + (p.y - A.y) * uy, d = Math.abs((p.x - A.x) * -uy + (p.y - A.y) * ux);
      if (t < w / 2 || t > L - w / 2 || d > Math.max(0.35, s.ep)) return;
      if (!best || d < best.d) best = { d, seg: i, t };
    });
    if (!best) { stats.ouverturesPerdues++; continue; }
    const kind = /fen|win/i.test(o.t || "") ? "fenetre" : /porte|door/i.test(o.t || "") ? "porte" : segs[best.seg].ep < 0.15 ? "porte" : "fenetre";
    openings.push({ seg: best.seg, t: +best.t.toFixed(3), w: +w.toFixed(3), kind });
  }

  // 5. pièces (nom + point) et appareils
  const pieces = (raw.pieces || []).map((r) => ({ name: String(r.nom || r.name || "").trim(), ...P(num(r.x), num(r.y)) }))
    .filter((r) => r.name && ok(r.x, r.y)).map((r) => ({ ...r, size: 1 }));
  const devIdx = [], devices = [];
  (raw.appareils || []).forEach((d, i) => {
    const t = String(d.t || "").toUpperCase(), u = num(d.x), v = num(d.y);
    if (!AI_TYPES[t] || !ok(u, v)) return;
    devIdx[i] = devices.length; devices.push({ t, ...P(u, v) });
  });
  const links = [];
  (raw.liaisons || []).forEach((l) => {
    const c = devIdx[Array.isArray(l) ? l[0] : l.c], m = devIdx[Array.isArray(l) ? l[1] : l.l];
    if (c == null || m == null) return;
    if (CMD.has(devices[c].t) && LIGHT.has(devices[m].t)) links.push({ c, l: m });
    else if (CMD.has(devices[m].t) && LIGHT.has(devices[c].t)) links.push({ c: m, l: c });
  });

  // sommets sans mur retirés, numéros resserrés
  const re = new Map(), used = [];
  segs.forEach((s) => [s.a, s.b].forEach((k) => { if (!re.has(k)) { re.set(k, used.length); used.push(nodes[k]); } }));
  return {
    nodes: used.map((n) => ({ x: +n.x.toFixed(3), y: +n.y.toFixed(3) })),
    walls: segs.map((s) => ({ a: re.get(s.a), b: re.get(s.b), ep: +s.ep.toFixed(3) })),
    openings,
    pieces, devices, links,
    remarques: String(raw.remarques || "").slice(0, 600),
    stats,
  };
}
