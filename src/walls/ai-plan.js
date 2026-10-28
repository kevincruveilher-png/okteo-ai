// Relevé du plan par l'IA (v31) — partie pure, sans DOM : consigne envoyée au modèle, lecture de sa réponse,
// remise au propre de la géométrie (murs redressés, sommets fusionnés, jonctions en T coupées), conversion pixels → mètres.
// L'IA travaille en pixels de l'image envoyée ; `map` = { x0, y0, sx, sy } : x (m) = x0 + u × sx, y (m) = y0 + v × sy.

import { APPAREILS } from "../cablage/appareils.js";

// types relevés (v55.1 : les 12 de base + les appareils du journal, R-084) — description donnée à l'IA
const BASE_TYPES = {
  PC16: "prise de courant 16 A",
  PC20: "prise spécialisée 20 A ou 32 A dont l'usage n'est pas écrit (sinon FOUR, LL, LV, SL, PLAQ)",
  RJ45: "prise réseau RJ45 / téléphone",
  LUM: "point lumineux au plafond (DCL)",
  APP: "applique murale",
  SPOT: "spot encastré",
  INT: "interrupteur simple",
  VV: "va-et-vient (un symbole à chaque endroit de commande)",
  BP: "bouton poussoir (télérupteur)",
  VMC: "bouche d'extraction VMC",
  TAB: "tableau électrique",
  SC: "sortie de câble dont l'usage n'est pas reconnu (en dernier recours)",
};
// précisions pour reconnaître les appareils du journal sur un plan
const HINT = {
  RAD: "radiateur électrique / convecteur", SS: "sèche-serviette (salle de bain)", VMCG: "caisson / groupe VMC (combles)",
  CVMC: "commande de VMC (grande vitesse)", CLIM: "climatisation (unité ou alimentation)", AQA: "pompe à chaleur / Aqua Air / PAC",
  BOUCHE: "bouche de diffusion motorisée", FOUR: "prise du four", LL: "prise du lave-linge", LV: "prise du lave-vaisselle",
  SL: "prise du sèche-linge", PLAQ: "sortie plaque de cuisson (32 A)", HOTTE: "hotte", CETH: "chauffe-eau (cumulus, thermodynamique)",
  MGAR: "moteur de porte de garage / portail", ICOUP: "interrupteur de coupure", PCEXT: "prise extérieure",
  GEXT: "prise de garage extérieure (G EXT)", PX4: "prise extérieure pilotée (4G1,5)", VR: "moteur de volet roulant (à la fenêtre)",
  VEL: "Velux / fenêtre de toit motorisée", CVR: "commande de volet roulant (inverseur montée / descente)",
  INTERCO: "interphone / visiophone", TV: "prise TV (antenne)", ANT: "antenne / parabole",
  EQP: "équipotentielle principale", EQL: "équipotentielle locale (salle de bain)", AIG: "gaine aiguillée en attente (fibre, réseau)",
  ILOT: "prises de l'îlot central de cuisine", BPS: "bouton poussoir de sonnette (à l'entrée)", SON: "sonnette / carillon",
};
export const AI_TYPES = { ...BASE_TYPES, ...Object.fromEntries(Object.entries(APPAREILS).map(([k, v]) => [k, HINT[k] || v.n])) };
const LIGHT = new Set(["LUM", "APP", "SPOT"]), CMD = new Set(["INT", "VV", "BP"]), VOLET = new Set(["VR", "VEL"]);

// consigne commune (relevé avec clé : image envoyée ; sans clé : PDF joint dans une autre conversation)
function promptBody(coords) {
  const types = Object.entries(AI_TYPES).map(([k, v]) => `  ${k} = ${v}`).join("\n");
  return `Relève ce plan pour le redessiner : murs, portes et fenêtres, pièces, appareillage électrique et liaisons des commandes.

Règles :
${coords}
- Murs : un segment sur l'AXE du mur (milieu de son épaisseur), d'un angle à l'autre ; "ep" = épaisseur en cm (murs extérieurs souvent 20 à 30 cm, cloisons 5 à 10 cm). Les murs se rejoignent exactement aux angles et aux jonctions en T (même point).
- Un mur PASSE à travers ses portes et fenêtres : ne le coupe jamais à une ouverture. Donne les ouvertures à part : centre sur l'axe du mur, largeur en cm, type "porte", "fenetre" ou "garage" (porte de garage sectionnelle ou basculante : grande, sans arc de battant). Chaque pièce doit être entièrement fermée par des murs.
- Pour chaque porte (type "porte") : "gx","gy" = le montant où sont les gonds (là où pivote le battant), et "vx","vy" = un point au milieu de l'arc dessiné, du côté où la porte s'ouvre. Regarde l'arc du battant sur le plan.
- Pièces : le nom écrit sur le plan et un point à l'intérieur de la pièce. Ne crée pas de pièce qui n'est pas écrite.
- Appareils : le centre du symbole, son type parmi la liste ci-dessous, et "h" = hauteur en cm quand elle est écrite à côté (ex. « H:1.20m » → 120), sinon pas de "h".
${types}
  Prends le type le plus précis : une prise marquée « LL » ou « lave-linge » est LL, pas PC20 ; un chauffe-eau est CETH, pas SC ; une commande de volet est CVR, pas SC ni INT. SC seulement si l'usage n'est pas reconnaissable.
  Une prise posée le long du plan de travail de la cuisine (souvent écrite « H:1.10m » ou « PT ») : ajoute "pt": true.
- Liaisons : [indice de la commande, indice de l'appareil commandé] dans la liste des appareils :
  INT, VV ou BP vers LUM, APP ou SPOT ; CVR vers VR ou VEL.
  Un allumage commandé de plusieurs endroits : chaque VV (ou BP) est relié à TOUTES les lumières qu'il commande. Une commande qui allume plusieurs lumières : une liaison par lumière.
  Points extérieurs (appliques, spots en façade, terrasse) : leur commande est presque toujours À L'INTÉRIEUR, près de la porte ou de la baie la plus proche, souvent dans un boîtier double avec une autre commande ; suis le trait de liaison. Chaque lumière doit avoir sa commande ; sinon dis-le dans "remarques".
- Ignore les annotations ajoutées à la main sur le plan (écritures manuscrites, surlignages, traits de feutre, tampons) : ne relève que le dessin et les symboles de l'électricité.
- N'invente rien : ce que tu ne vois pas reste absent. Mets dans "remarques" ce qui est douteux, appareil par appareil.`;
}
const JSON_FORM = `{"murs":[{"x1":0,"y1":0,"x2":0,"y2":0,"ep":20}],
 "ouvertures":[{"x":0,"y":0,"l":90,"t":"porte","gx":0,"gy":0,"vx":0,"vy":0},{"x":0,"y":0,"l":240,"t":"garage"}],
 "pieces":[{"nom":"Cuisine","x":0,"y":0}],
 "appareils":[{"t":"PC16","x":0,"y":0},{"t":"INT","x":0,"y":0,"h":110},{"t":"LUM","x":0,"y":0},{"t":"PC16","x":0,"y":0,"h":110,"pt":true}],
 "liaisons":[[1,2]],
 "remarques":"ce qui est douteux, en une ou deux phrases"}`;

// relevé avec clé : l'image (rognée) est envoyée avec la consigne
export function aiPrompt({ W, H, cmPerPx }) {
  return `Voici le plan d'une maison individuelle (image de ${W} × ${H} pixels ; 1 pixel ≈ ${cmPerPx.toFixed(2)} cm ; origine en haut à gauche, x vers la droite, y vers le bas).
${promptBody("- Coordonnées en PIXELS de cette image, nombres entiers.")}

Réponds UNIQUEMENT avec ce JSON (sans texte autour) :
${JSON_FORM}`;
}
// relevé sans clé (v36) : consigne à copier dans une conversation neuve avec le PDF joint ; la réponse se colle dans Oktéo
export function pastePrompt({ page = 1 } = {}) {
  return `Voici le plan d'une maison individuelle (PDF joint, page ${page}). Ignore les autres pages du PDF (plan du bureau d'études, notices).
${promptBody(`- Fais une image de TOUTE la page ${page} (sans rognage). Coordonnées en PIXELS de cette image (origine en haut à gauche, x vers la droite, y vers le bas), nombres entiers. Donne la taille de cette image dans "ref" (W = largeur, H = hauteur en pixels) : sans "ref", la réponse ne peut pas être placée.
- Mesure les positions sur l'image (pas à l'estime) : les murs doivent tomber sur les murs du plan.`)}

Réponds UNIQUEMENT avec ce JSON (sans texte autour) :
${JSON_FORM.replace("{", '{"ref":{"W":0,"H":0},\n ')}`;
}

// la réponse peut contenir des ``` ou du texte autour : on prend le premier objet JSON complet
// v55.2 : guillemets typographiques (“ ” ″, ajoutés par un traitement de texte ou une messagerie) remplacés si besoin
export function parseAiJson(text) {
  try { return parseJson(text); }
  catch (e) {
    const t = String(text || "");
    if (!/[“”„″]/.test(t)) throw e;
    return parseJson(t.replace(/[“”„″]/g, '"'));
  }
}
function parseJson(text) {
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

// v61 : sens d'une porte sur le mur A→B, centre à t (m depuis A) : gond du côté du montant g, ouverture du côté du point v
export function doorSense(A, B, t, g, v) {
  const L = Math.hypot(B.x - A.x, B.y - A.y) || 1, ux = (B.x - A.x) / L, uy = (B.y - A.y) / L;
  let hinge = "g", swing = "int";
  if (g) hinge = (g.x - A.x) * ux + (g.y - A.y) * uy > t ? "d" : "g";
  if (v) { const c = { x: A.x + ux * t, y: A.y + uy * t }; swing = (v.x - c.x) * -uy + (v.y - c.y) * ux > 0 ? "ext" : "int"; }
  return { hinge, swing };
}
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
  const openings = [], lost = [];
  for (const o of raw.ouvertures || []) {
    const u = num(o.x), v = num(o.y); if (!ok(u, v)) continue;
    const p = P(u, v), w = Math.min(3.2, Math.max(0.4, num(o.l) > 0 ? num(o.l) / 100 : 0.9));
    // v55.2 : mur coupé par une jonction en T trop près de l'ouverture (positions de l'IA estimées) → ouverture
    // recentrée sur le morceau de mur, ou rétrécie s'il est plus court qu'elle (40 cm minimum) ; comptée « ajustée »
    let best = null;
    segs.forEach((s, i) => {
      const A = nodes[s.a], B = nodes[s.b], L = Math.hypot(B.x - A.x, B.y - A.y);
      const ux = (B.x - A.x) / L, uy = (B.y - A.y) / L;
      const t = (p.x - A.x) * ux + (p.y - A.y) * uy, d = Math.abs((p.x - A.x) * -uy + (p.y - A.y) * ux);
      if (t < -0.05 || t > L + 0.05 || d > Math.max(0.35, s.ep)) return;
      const w2 = Math.min(w, L - 0.1); if (w2 < 0.4) return;
      const t2 = Math.min(L - w2 / 2, Math.max(w2 / 2, t)), shift = Math.abs(t2 - t) + (w - w2);
      if (!best || d + shift < best.d + best.shift) best = { d, shift, seg: i, t: t2, w: w2 };
    });
    if (!best) { stats.ouverturesPerdues++; lost.push({ ...p, w, kind: /gar|sect|bascul/i.test(o.t || "") ? "garage" : /fen|win/i.test(o.t || "") ? "fenetre" : "porte" }); continue; }
    if (best.shift > 1e-6) stats.ouverturesAjustees = (stats.ouverturesAjustees || 0) + 1;
    const kind = /gar|sect|bascul/i.test(o.t || "") ? "garage" : /fen|win/i.test(o.t || "") ? "fenetre" : /porte|door/i.test(o.t || "") ? "porte" : segs[best.seg].ep < 0.15 ? "porte" : "fenetre";
    // v57 : gond (côté du montant gx, gy) et sens (côté du point vx, vy) relevés par l'IA ; sinon gauche / intérieur
    let hinge = "g", swing = "int", sens = false;
    if (kind === "porte") {
      const g = ok(num(o.gx), num(o.gy)) ? P(num(o.gx), num(o.gy)) : null, v = ok(num(o.vx), num(o.vy)) ? P(num(o.vx), num(o.vy)) : null;
      ({ hinge, swing } = doorSense(nodes[segs[best.seg].a], nodes[segs[best.seg].b], best.t, g, v));
      if (g || v) { sens = true; stats.portesOrientees = (stats.portesOrientees || 0) + 1; }
    }
    // v61 : marques pour la relecture ciblée : ouverture recentrée / rétrécie (adj), porte dont le sens a été lu (sens)
    openings.push({ seg: best.seg, t: +best.t.toFixed(3), w: +best.w.toFixed(3), kind, hinge, swing, ai: true, ...(best.shift > 1e-6 ? { adj: true } : {}), ...(sens ? { sens: true } : {}) });
  }

  // 5. pièces (nom + point) et appareils
  const pieces = (raw.pieces || []).map((r) => ({ name: String(r.nom || r.name || "").trim(), ...P(num(r.x), num(r.y)) }))
    .filter((r) => r.name && ok(r.x, r.y)).map((r) => ({ ...r, size: 1 }));
  const devIdx = [], devices = [];
  (raw.appareils || []).forEach((d, i) => {
    const t = String(d.t || "").toUpperCase(), u = num(d.x), v = num(d.y);
    if (!AI_TYPES[t] || !ok(u, v)) return;
    const h = num(d.h);   // hauteur écrite sur le plan (cm), gardée si plausible
    devIdx[i] = devices.length; devices.push({ t, ...P(u, v), ...(h > 0 && h <= 300 ? { h: Math.round(h) } : { hNo: true }), ...(t === "PC16" && (d.pt === true || d.pt === "true") ? { pt: true } : {}) });
  });
  const links = [];
  (raw.liaisons || []).forEach((l) => {
    const c = devIdx[Array.isArray(l) ? l[0] : l.c], m = devIdx[Array.isArray(l) ? l[1] : l.l];
    if (c == null || m == null) return;
    // commande → lumière, ou commande de volet (CVR) → volet / Velux ; dans un sens ou dans l'autre
    const pair = (x, y) => (CMD.has(devices[x].t) && LIGHT.has(devices[y].t)) || (devices[x].t === "CVR" && VOLET.has(devices[y].t));
    if (pair(c, m)) links.push({ c, l: m });
    else if (pair(m, c)) links.push({ c: m, l: c });
  });

  // sommets sans mur retirés, numéros resserrés
  const re = new Map(), used = [];
  segs.forEach((s) => [s.a, s.b].forEach((k) => { if (!re.has(k)) { re.set(k, used.length); used.push(nodes[k]); } }));
  return {
    nodes: used.map((n) => ({ x: +n.x.toFixed(3), y: +n.y.toFixed(3) })),
    walls: segs.map((s) => ({ a: re.get(s.a), b: re.get(s.b), ep: +s.ep.toFixed(3) })),
    openings,
    pieces, devices, links, lost,
    remarques: String(raw.remarques || "").slice(0, 600),
    stats,
  };
}
