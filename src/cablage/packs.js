// Packs (v40) — appareillage type d'une pièce, posé tout seul puis ajustable. Partie pure, sans DOM.
// Un pack = un type de pièce (reconnu par des mots du nom de la pièce) + une liste d'appareils, écrite comme on la dit :
// « PC16×3, LUM, INT, RJ45 ». « PC16×norme » = le nombre de prises de la NF C 15-100 pour la surface (séjour : une par
// 4 m², au moins 5, 7 au-delà de 28 m²). Valeurs de base : norme + pratique KiTéOHM, modifiables (Paramètres → Packs).
// Pose : commande (INT/VV/BP) à côté de la porte, côté poignée ; lumières au centre (réparties si plusieurs) ; prises,
// RJ45, sorties de câble réparties sur les murs, loin des portes, des fenêtres et des angles ; RJ45 à côté d'une prise.
// Seul ce qui manque est ajouté (une commande compte pour INT, VV ou BP ; une lumière pour LUM, SPOT ou APP).

export const PACK_DEFAULTS = [
  { id: "chambre", name: "Chambre", words: "chambre, ch.", items: "PC16×3, LUM, INT, RJ45" },
  { id: "sejour", name: "Séjour / pièce de vie", words: "séjour, sejour, salon, pièce de vie, piece de vie, living, espace de vie", items: "PC16×norme, LUM, INT, RJ45×2" },
  { id: "cuisine", name: "Cuisine", words: "cuisine", items: "PC16×6, PC20×3, LUM, INT" },
  { id: "sdb", name: "Salle de bain / d'eau", words: "salle de bain, salle d'eau, sdb, sde, bains", items: "PC16, LUM, INT, APP" },
  { id: "wc", name: "WC", words: "wc, toilettes", items: "LUM, INT" },
  { id: "circulation", name: "Dégagement / entrée", words: "dégagement, degagement, dgt, couloir, entrée, entree, hall", items: "LUM, INT, PC16" },
  { id: "bureau", name: "Bureau", words: "bureau", items: "PC16×3, LUM, INT, RJ45" },
  { id: "garage", name: "Garage", words: "garage", items: "PC16, LUM, INT" },
  { id: "cellier", name: "Cellier / buanderie", words: "cellier, buanderie, cave", items: "PC16, LUM, INT" },
];

const CMD = new Set(["INT", "VV", "BP"]), LIGHT = new Set(["LUM", "SPOT", "APP"]);
const fam = (t) => (CMD.has(t) ? "CMD" : LIGHT.has(t) ? "LIGHT" : t);
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// « PC16×3, LUM, INT » → [{t:"PC16", n:3}, {t:"LUM", n:1}, …] ; n = "norme" possible
export function parseItems(text) {
  return String(text || "").split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean).map((x) => {
    const pre = /^(\d+)\s*[×x*]\s*([A-Za-z]+[0-9]*)$/i.exec(x);           // « 3×PC16 »
    if (pre) return { t: pre[2].toUpperCase(), n: +pre[1] };
    const m = /^([A-Za-z]+[0-9]*)\s*(?:[×x*]\s*(\d+|norme))?$/i.exec(x);  // « PC16×3 », « PC16×norme », « LUM »
    if (!m) return null;
    return { t: m[1].toUpperCase(), n: !m[2] ? 1 : /norme/i.test(m[2]) ? "norme" : +m[2] };
  }).filter(Boolean);
}
// nombre de prises de la norme pour un séjour de surface A (m²)
export const prisesNorme = (A) => Math.max(A > 28 ? 7 : 5, Math.ceil((A || 0) / 4));

// pack d'une pièce d'après son nom (le mot le plus long qui correspond l'emporte : « salle de bain » avant « bain »)
export function packFor(roomName, packs) {
  const n = norm(roomName);
  let best = null, bl = 0;
  for (const p of packs) for (const w of String(p.words || "").split(",").map((x) => norm(x.trim())).filter(Boolean)) if (n.includes(w) && w.length > bl) { best = p; bl = w.length; }
  return best;
}

// ce qui manque dans la pièce : [{t, n}] (existing = appareils déjà dans la pièce)
export function missing(pack, room, existing) {
  // ce qui existe déjà est décompté par famille (commande, lumière, puis chaque type), dans l'ordre du pack
  const pool = new Map();
  existing.forEach((a) => pool.set(fam(a.t), (pool.get(fam(a.t)) || 0) + 1));
  const out = [];
  for (const it of parseItems(pack.items)) {
    const n = it.n === "norme" ? (it.t === "PC16" ? prisesNorme(room.area) : 1) : it.n, k = fam(it.t), use = Math.min(pool.get(k) || 0, n);
    pool.set(k, (pool.get(k) || 0) - use);
    if (n - use > 0) { const o = out.find((x) => x.t === it.t); if (o) o.n += n - use; else out.push({ t: it.t, n: n - use }); }
  }
  return out;
}

// pose dans une pièce : room {poly, area, label}, openings de la géométrie ({kind, j1, j2, hinge}), existing (appareils
// de la pièce) → { list: [{t, x, y}], links: [{c, l}] } (c, l = indice dans list, ou id d'un appareil existant)
export function placePack(room, openings, need, existing = []) {
  const P = room.poly, n = P.length, list = [], links = [];
  if (!P || n < 3) return { list, links };
  // contour : longueur cumulée, point et normale vers l'intérieur à une abscisse donnée
  const area2 = P.reduce((s, p, i) => s + p.x * P[(i + 1) % n].y - P[(i + 1) % n].x * p.y, 0), sg = area2 > 0 ? 1 : -1;
  const edges = P.map((a, i) => { const b = P[(i + 1) % n], L = d2(a, b) || 1e-9; return { a, b, L, ux: (b.x - a.x) / L, uy: (b.y - a.y) / L }; });
  const per = edges.reduce((s, e) => s + e.L, 0);
  const at = (s) => {
    s = ((s % per) + per) % per;
    for (const e of edges) { if (s <= e.L) return { x: e.a.x + e.ux * s, y: e.a.y + e.uy * s, nx: -e.uy * sg, ny: e.ux * sg, e, s }; s -= e.L; }
    const e = edges[edges.length - 1]; return { x: e.b.x, y: e.b.y, nx: -e.uy * sg, ny: e.ux * sg, e, s: e.L };
  };
  const inset = (q, k = 0.12) => ({ x: +(q.x + q.nx * k).toFixed(3), y: +(q.y + q.ny * k).toFixed(3) });
  // ouvertures sur le contour de la pièce (à moins de 0,4 m du contour)
  const nearPoly = (p) => edges.some((e) => { const t = Math.max(0, Math.min(e.L, (p.x - e.a.x) * e.ux + (p.y - e.a.y) * e.uy)); return d2(p, { x: e.a.x + e.ux * t, y: e.a.y + e.uy * t }) < 0.4; });
  const ops = (openings || []).filter((o) => nearPoly({ x: (o.j1.x + o.j2.x) / 2, y: (o.j1.y + o.j2.y) / 2 }));
  const taken = existing.map((a) => ({ x: a.x, y: a.y }));
  // abscisse libre : loin des angles (0,3 m), des ouvertures (0,25 m au-delà des tableaux) et des appareils (0,35 m)
  const free = (s, margin = 0.25) => {
    const q = at(s);
    if (q.s < 0.3 || q.e.L - q.s < 0.3) return false;
    for (const o of ops) { const c = { x: (o.j1.x + o.j2.x) / 2, y: (o.j1.y + o.j2.y) / 2 }; if (d2(q, c) < d2(o.j1, o.j2) / 2 + margin) return false; }
    return !taken.some((p) => d2(p, q) < 0.35);
  };
  const nearestFree = (s0, margin) => { for (let k = 0; k <= per / 0.05; k++) for (const sgn of [1, -1]) { const s = s0 + sgn * k * 0.05; if (free(s, margin)) return s; } return null; };
  const proj = (p) => { let best = null; let acc = 0; for (const e of edges) { const t = Math.max(0, Math.min(e.L, (p.x - e.a.x) * e.ux + (p.y - e.a.y) * e.uy)); const d = d2(p, { x: e.a.x + e.ux * t, y: e.a.y + e.uy * t }); if (!best || d < best.d) best = { d, s: acc + t }; acc += e.L; } return best.s; };
  const door = ops.find((o) => o.kind !== "fenetre");
  const lightIdx = [];
  const existingLight = existing.find((a) => LIGHT.has(a.t));
  // ordre de pose : commandes (près de la porte), lumières, puis prises et le reste, les RJ45 en dernier (à côté d'une prise)
  const rank = (t) => (CMD.has(t) ? 0 : LIGHT.has(t) && t !== "APP" ? 1 : t === "RJ45" ? 3 : 2);
  for (const { t, n: k } of need.slice().sort((p, q) => rank(p.t) - rank(q.t))) {
    for (let i = 0; i < k; i++) {
      if (CMD.has(t)) {
        // à côté de la porte, côté poignée (opposé au gond), à 15 cm du tableau
        let s = null;
        if (door) {
          const F = door.hinge ? (d2(door.hinge, door.j1) < 1e-6 ? door.j2 : door.j1) : door.j2;
          const sF = proj(F), sH = proj(door.hinge || door.j1), dir = Math.sign(((sF - sH + per * 1.5) % per) - per / 2) || 1;
          s = nearestFree(sF + dir * 0.15, 0.1);
        }
        if (s == null) s = nearestFree(0.4);
        if (s == null) continue;
        const q = inset(at(s)); taken.push(q); list.push({ t, x: q.x, y: q.y, h: 110 });
      } else if (LIGHT.has(t) && t !== "APP") {
        // au centre ; plusieurs : réparties sur le grand axe
        const c = room.label || P.reduce((s, p) => ({ x: s.x + p.x / n, y: s.y + p.y / n }), { x: 0, y: 0 });
        const xs = P.map((p) => p.x), ys = P.map((p) => p.y), wide = Math.max(...xs) - Math.min(...xs) >= Math.max(...ys) - Math.min(...ys);
        const span = (wide ? Math.max(...xs) - Math.min(...xs) : Math.max(...ys) - Math.min(...ys)) * 0.5, off = k > 1 ? (i / (k - 1) - 0.5) * span : 0;
        const q = { x: +(c.x + (wide ? off : 0)).toFixed(3), y: +(c.y + (wide ? 0 : off)).toFixed(3) };
        lightIdx.push(list.length); list.push({ t, ...q });
      } else {
        // sur les murs, réparties régulièrement (applique : idem, à 1,80 m) ; RJ45 à côté d'une prise
        let s = null;
        if (t === "RJ45") { const pr = list.filter((x) => x.t === "PC16").concat(existing.filter((a) => a.t === "PC16")); for (const p of pr) { const s1 = nearestFree(proj(p) + 0.36); if (s1 != null && Math.abs(s1 - proj(p)) < 0.8) { s = s1; break; } } }
        if (s == null) {
          const same = list.filter((x) => x.t === t).length, tot = k;
          s = nearestFree(((same + 0.5) / tot) * per + per * 0.07);
        }
        if (s == null) continue;
        const q = inset(at(s)); taken.push(q);
        if (t === "APP") lightIdx.push(list.length);
        list.push({ t, x: q.x, y: q.y });
      }
    }
  }
  // liaisons : chaque nouvelle commande allume les nouvelles lumières (ou la lumière déjà posée)
  const cmds = list.map((x, i) => (CMD.has(x.t) ? i : -1)).filter((i) => i >= 0);
  const existingCmd = existing.find((a) => CMD.has(a.t));
  for (const c of cmds) {
    if (lightIdx.length) lightIdx.forEach((l) => links.push({ c, l }));
    else if (existingLight) links.push({ c, l: existingLight.id });
  }
  if (!cmds.length && existingCmd) lightIdx.forEach((l) => links.push({ c: existingCmd.id, l }));
  return { list, links };
}
