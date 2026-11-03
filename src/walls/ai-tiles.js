// v76 étape 2 : lecture du plan en tuiles (pur, sans DOM) — grille avec recouvrement, taille des images envoyées,
// conversion tuile → mètres, consignes, demandes de zoom, fusion des lectures.
// Repères (règle 1 de la mission) : une seule chaîne de conversion, jamais de coordonnées « à l'estime » :
//   pixel de la SOURCE (fond du plan, ou page PDF rendue)  --srcMap-->  mètres du plan (repère du dessin)
//   pixel d'une TUILE (image envoyée)  --regionMap(srcMap, région, W, H)-->  mètres du plan
// map = { x0, y0, sx, sy } : x (m) = x0 + u × sx, y (m) = y0 + v × sy (même convention que ai-plan.js aiToPlan).
import { IMAGE_LIMITS } from "../ai-config.js";
import { AI_TYPES, aiToPlan } from "./ai-plan.js";

// ---------- grille ----------
// grille choisie : "3x3", "4x4" ou "auto" (paysage → 4 × 3, portrait → 3 × 4, presque carré → 3 × 3)
export function chooseGrid(w, h, grid = "auto") {
  const m = /^(\d)x(\d)$/.exec(String(grid));
  if (m) return { cols: +m[1], rows: +m[2] };
  const r = w / h;
  return r > 1.25 ? { cols: 4, rows: 3 } : r < 0.8 ? { cols: 3, rows: 4 } : { cols: 3, rows: 3 };
}
// tuiles qui couvrent `box` (pixels de la source) avec un recouvrement `overlap` (fraction de la taille d'une tuile, de
// chaque côté) ; `core` = la partie propre à la tuile (sans recouvrement), qui décide de la tuile « propriétaire »
// d'un symbole lu deux fois
export function tileGrid(box, { cols = 3, rows = 3, overlap = 0.08 } = {}) {
  const cw = box.w / cols, rh = box.h / rows, ox = cw * overlap, oy = rh * overlap, out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x0 = Math.max(box.x, box.x + c * cw - ox), y0 = Math.max(box.y, box.y + r * rh - oy);
    const x1 = Math.min(box.x + box.w, box.x + (c + 1) * cw + ox), y1 = Math.min(box.y + box.h, box.y + (r + 1) * rh + oy);
    out.push({ i: out.length, r, c, x: x0, y: y0, w: x1 - x0, h: y1 - y0, core: { x: box.x + c * cw, y: box.y + r * rh, w: cw, h: rh } });
  }
  return out;
}
// taille de l'image envoyée pour une région de w × h pixels de source : au plus 1 568 px de grand côté et ~1,15 Mpx
// (au-delà, l'API réduit sans gain). `upscale` : facteur d'agrandissement permis (1 = jamais plus de pixels que la
// source : un scan agrandi ne recrée pas les détails ; > 1 seulement pour un PDF vectoriel rendu de nouveau).
export function fitSize(w, h, { maxSide = IMAGE_LIMITS.maxSide, maxPixels = IMAGE_LIMITS.maxPixels, upscale = 1 } = {}) {
  let k = Math.min(upscale, maxSide / Math.max(w, h), Math.sqrt(maxPixels / (w * h)));
  const W = Math.max(1, Math.floor(w * k)), H = Math.max(1, Math.floor(h * k));
  return { W, H, k: W / w };
}
// conversion pixel d'une région rendue en W × H → mètres
export function regionMap(srcMap, region, W, H) {
  return { x0: srcMap.x0 + region.x * srcMap.sx, y0: srcMap.y0 + region.y * srcMap.sy, sx: srcMap.sx * region.w / W, sy: srcMap.sy * region.h / H };
}
// pixel de source → mètres, et inverse (pour retrouver la région d'un zoom ou d'un point)
export const toMeters = (map, u, v) => ({ x: map.x0 + u * map.sx, y: map.y0 + v * map.sy });
export const toPixels = (map, x, y) => ({ u: (x - map.x0) / map.sx, v: (y - map.y0) / map.sy });

// v76 étape 3 : image redressée de `deg` degrés autour de son centre (OpenCV) : un point lu sur l'image redressée est
// ramené dans l'image d'origine avant toute conversion, pour ne jamais déplacer les repères ni les liaisons
export function unrotate(u, v, deg, W, H) {
  if (!deg) return { u, v };
  const a = -deg * Math.PI / 180, cx = W / 2, cy = H / 2, dx = u - cx, dy = v - cy;
  return { u: cx + dx * Math.cos(a) - dy * Math.sin(a), v: cy + dx * Math.sin(a) + dy * Math.cos(a) };
}

// ---------- consignes ----------
const TYPES_TXT = () => Object.entries(AI_TYPES).map(([k, v]) => `  ${k} = ${v}`).join("\n");
// partie fixe (identique pour toutes les tuiles d'un plan : mise en cache, voir ai-modes-run.js)
export function tileRules({ zoomMax = 3 } = {}) {
  return `Lecture fine d'une ZONE du plan d'une maison (une tuile d'une grille qui couvre tout le plan, avec un léger recouvrement entre tuiles).
Méthode (obligatoire) :
1. Parcours TOUTE l'image de la tuile, bord compris, sans sauter de zone ; chaque symbole électrique compte, même petit ou serré.
2. Sers-toi de la légende du plan si elle est visible dans la tuile ; sinon des types ci-dessous.
3. Ne relève que l'appareillage électrique et ses liaisons : pas les murs, ni les pièces, ni les cotes.
Règles :
- Coordonnées en PIXELS de l'image de la tuile (origine en haut à gauche, x vers la droite, y vers le bas), nombres entiers : le centre du symbole.
- Un symbole coupé par le bord de la tuile : relève-le seulement si son centre est dans l'image.
- Types :
${TYPES_TXT()}
  Prends le type le plus précis ; INCONNU si le symbole est visible mais non reconnu (garde son "inscription"). "h" = hauteur en cm si elle est écrite à côté.
  Plusieurs symboles côte à côte : un objet par symbole. Un bloc marqué « bloc 2 prises » ou « bloc 4 prises » : un objet avec "qty".
  Garde dans "inscription" ce qui est écrit à côté (16A, 32A, LL, LV, H:1.10m, ALIM DÉTECTEUR…), dans "aiNote" tes doutes avec "aiStatus": "a_identifier" ou "a_confirmer".
- Liaisons : [indice de la commande, indice de l'appareil commandé] dans TA liste (indices à partir de 0), seulement si le trait de liaison est visible dans la tuile.
- Zoom : si une zone de la tuile est trop petite ou ambiguë pour être lue sûrement, demande-la dans "zooms" ([{"x","y","w","h","pourquoi"}] en pixels de la tuile, ${zoomMax} au plus). Le logiciel te renverra cette zone en plus haute définition. Ne demande un zoom que si c'est utile ; mais relève quand même ce que tu vois.
- N'invente rien : ce que tu ne vois pas reste absent.
Réponds UNIQUEMENT avec ce JSON (sans texte autour) :
{"appareils":[{"t":"PC16","x":0,"y":0}],"liaisons":[[0,1]],"zooms":[],"remarques":"décompte par type dans la tuile, puis les doutes"}`;
}
// partie propre à la tuile
export function tilePrompt(tile, { n, total, W, H, cmPerPx, ocr = null, cleaned = false }) {
  return `Tuile ${n}/${total} (ligne ${tile.r + 1}, colonne ${tile.c + 1}) : image de ${W} × ${H} pixels ; 1 pixel ≈ ${cmPerPx.toFixed(2)} cm.${cleaned ? `
Deux images : d'abord l'image D'ORIGINE, puis une copie NETTOYÉE (contraste, bruit, redressement) pour t'aider à lire. Les coordonnées se donnent sur l'image NETTOYÉE ; en cas de doute, l'image d'origine fait foi (un nettoyage peut abîmer un petit symbole).` : ""}${ocr && ocr.length ? `
Textes lus par OCR dans la tuile (aide seulement, l'OCR peut se tromper ; positions en pixels de l'image ${cleaned ? "nettoyée" : ""}, confiance en %) :
${ocr.slice(0, 120).map((w) => `- "${w.text}" en (${Math.round(w.x)}, ${Math.round(w.y)}) · ${Math.round(w.conf)} %${w.src === "orig" ? " (image d'origine)" : w.src === "net" ? " (image nettoyée)" : ""}`).join("\n")}` : ""}`;
}
// réponse à des zooms : les images suivent, dans l'ordre des demandes
export function zoomPrompt(zs) {
  return `Voici les zooms demandés, dans l'ordre : ${zs.map((z, i) => `zoom ${i + 1} = zone (${Math.round(z.x)}, ${Math.round(z.y)}, ${Math.round(z.w)} × ${Math.round(z.h)}) de la tuile, image de ${z.W} × ${z.H} px`).join(" ; ")}.
Redonne la liste COMPLÈTE des appareils et liaisons de la tuile (même format JSON, coordonnées toujours en pixels de l'image de la TUILE, pas du zoom), corrigée grâce aux zooms. "zooms" doit être vide.`;
}

// demandes de zoom de l'IA : bornées à la tuile, taille minimale, `max` au plus ; triées dans l'ordre de la réponse
export function parseZooms(raw, W, H, { max = 3, min = 24 } = {}) {
  const out = [];
  for (const z of (raw && Array.isArray(raw.zooms) ? raw.zooms : [])) {
    let x = +z.x, y = +z.y, w = +z.w, h = +z.h;
    if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) continue;
    // zone trop petite : agrandie autour de son centre (un symbole a besoin de son voisinage)
    if (w < min) { x -= (min - w) / 2; w = min; } if (h < min) { y -= (min - h) / 2; h = min; }
    x = Math.max(0, Math.min(W - 1, x)); y = Math.max(0, Math.min(H - 1, y)); w = Math.min(W - x, w); h = Math.min(H - y, h);
    out.push({ x, y, w, h, pourquoi: String(z.pourquoi || z.raison || "").slice(0, 200) });
    if (out.length >= max) break;
  }
  return out;
}

// réponse d'une tuile → appareils et liaisons en mètres (aiToPlan, conversion par la map de la tuile)
export function tileToDevices(raw, map, { rot = 0, W = 0, H = 0 } = {}) {
  const ap = (raw.appareils || []).map((d) => { if (!rot) return d; const p = unrotate(+d.x, +d.y, rot, W, H); return { ...d, x: p.u, y: p.v }; });
  const P = aiToPlan({ appareils: ap, liaisons: raw.liaisons || [] }, map);
  return { devices: P.devices, links: P.links, remarques: P.remarques };
}

// ---------- fusion ----------
const FAM = { LUM: "lum", APP: "lum", SPOT: "lum", INT: "cmd", VV: "cmd", BP: "cmd", PC16: "pc", PC20: "pc", PC32: "pc", LL: "pc", LV: "pc", SL: "pc", FOUR: "pc", PLAQ: "pc", PCEXT: "pc", GEXT: "pc" };
export const family = (t) => FAM[t] || t;
const same = (a, b) => a.t === b.t || family(a.t) === family(b.t) || a.t === "INCONNU" || b.t === "INCONNU";
const inside = (p, c) => c && p.x >= c.x0 && p.x <= c.x1 && p.y >= c.y0 && p.y <= c.y1;

// lectures = [{ src: "globale" | "tuile:i" | "2e lecture", devices, links, core? {x0,y0,x1,y1} (m) }]
// La première lecture est la base ; chaque appareil des suivantes est rapproché (même famille, à moins de `tol` m)
// d'un appareil déjà retenu, sinon ajouté. Un type différent lu en tuile (plus haute définition) dans sa zone propre
// remplace le type de la lecture globale, qui est gardé dans `aiTypeGlobal` (à confirmer). Rien n'est supprimé.
// → { devices (avec aiSrc [...]), links, ecarts [{kind, t, x, y, src, detail}] }
export function mergeReadings(lectures, { tol = 0.3 } = {}) {
  const devices = [], links = [], seen = new Set(), ecarts = [];
  const addLink = (c, l) => { const k = c + "-" + l; if (c !== l && !seen.has(k)) { seen.add(k); links.push({ c, l }); } };
  lectures.forEach((L, li) => {
    const idx = [];
    L.devices.forEach((d) => {
      let best = -1, bd = tol;
      devices.forEach((m, j) => { const dist = Math.hypot(m.x - d.x, m.y - d.y); if (dist <= bd && same(m, d) && !(m.aiSrc.includes(L.src))) { bd = dist; best = j; } });
      if (best < 0) {
        idx.push(devices.length);
        devices.push({ ...d, aiSrc: [L.src] });
        if (li > 0) ecarts.push({ kind: "ajout", t: d.t, x: d.x, y: d.y, src: L.src, detail: `vu par la ${L.src} seulement` });
        return;
      }
      const m = devices[best];
      idx.push(best);
      m.aiSrc.push(L.src);
      if (m.t !== d.t && d.t !== "INCONNU") {
        const own = inside(d, L.core);
        ecarts.push({ kind: "type", t: d.t, x: m.x, y: m.y, src: L.src, detail: `${m.t} (${m.aiSrc[0]}) ou ${d.t} (${L.src})` });
        if (own && m.t !== d.t) { m.aiTypeGlobal = m.aiTypeGlobal || m.t; m.t = d.t; m.aiStatus = "a_confirmer"; }
        if (m.t === "INCONNU") m.t = d.t;
      }
      for (const k of ["h", "qty", "calibre", "inscription", "pt"]) if (m[k] == null && d[k] != null) m[k] = d[k];
      if (m.hNo && d.h) delete m.hNo;
    });
    L.links.forEach((k) => { const c = idx[k.c], l = idx[k.l]; if (c != null && l != null) addLink(c, l); });
  });
  // vus par la lecture de base seulement, alors qu'une lecture plus fine a couvert la zone : à vérifier
  if (lectures.length > 1) devices.forEach((d) => { if (d.aiSrc.length === 1 && d.aiSrc[0] === lectures[0].src && lectures.slice(1).some((L) => inside(d, L.core))) ecarts.push({ kind: "seul-base", t: d.t, x: d.x, y: d.y, src: lectures[0].src, detail: `vu par la ${lectures[0].src} seulement` }); });
  return { devices, links, ecarts };
}
// résumé des écarts (journal, carte de l'aperçu)
export function ecartsCount(ecarts) {
  const n = { ajout: 0, type: 0, "seul-base": 0 };
  for (const e of ecarts || []) n[e.kind] = (n[e.kind] || 0) + 1;
  return n;
}
