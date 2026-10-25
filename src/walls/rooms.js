// Détection des pièces fermées par les murs, et lecture de leur nom dans le PDF — sans IA.
//
// 1. Pièces : les axes des murs forment un graphe plan. On retire les bouts de mur qui ne ferment rien (cloison
//    arrêtée au milieu d'une pièce), puis on parcourt les faces du graphe (à chaque sommet, on tourne sur le mur
//    suivant). Chaque face fermée intérieure = une pièce, décrite par la suite ordonnée de ses murs (`cycle`) :
//    sa forme se recalcule donc toute seule quand un mur bouge. La surface affichée est la surface HABITABLE :
//    le contour est décalé vers l'intérieur de la demi-épaisseur de chaque mur.
// 2. Noms : les textes du PDF situés dans une pièce. Beaucoup de PDF de plans ont des polices « codées » (les
//    lettres sont remplacées par des numéros de glyphes, sans table de correspondance). On les décode comme un
//    chiffrement par substitution : la forme du mot (lettres répétées) doit correspondre à un nom de pièce connu,
//    avec un même code = une même lettre dans toute la police. Le PDF EVRARD dessine en plus la première lettre à part :
//    « hambre 1 », « arage »… ; le décodeur l'accepte.

// ---------- géométrie ----------
export const polyArea = (P) => { let s = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s += a.x * b.y - b.x * a.y; } return s / 2; };
export function pointInPoly(x, y, P) {
  let inside = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const a = P[i], b = P[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
// point bien à l'intérieur d'un polygone (pour y écrire le nom) : centre de gravité, ou à défaut le point le plus éloigné des bords
export function labelPoint(P) {
  const A = polyArea(P); let cx = 0, cy = 0;
  for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], f = a.x * b.y - b.x * a.y; cx += (a.x + b.x) * f; cy += (a.y + b.y) * f; }
  if (Math.abs(A) > 1e-9) { cx /= 6 * A; cy /= 6 * A; if (pointInPoly(cx, cy, P) && edgeDist(cx, cy, P) > 0.4) return { x: cx, y: cy }; }
  const xs = P.map((p) => p.x), ys = P.map((p) => p.y), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  let best = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 }, bd = -1;
  for (let i = 1; i < 24; i++) for (let j = 1; j < 24; j++) {
    const x = x0 + (x1 - x0) * i / 24, y = y0 + (y1 - y0) * j / 24;
    if (!pointInPoly(x, y, P)) continue; const d = edgeDist(x, y, P); if (d > bd) { bd = d; best = { x, y }; }
  }
  return best;
}
function edgeDist(x, y, P) {
  let m = 1e9;
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / L2));
    m = Math.min(m, Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t)));
  }
  return m;
}

// Contour intérieur d'une pièce à partir de son cycle de murs. getNode(id) → {x,y} ; getSeg(id) → {a,b,ep}.
export function interiorPoly(cycle, getNode, getSeg, defEp = 0.2) {
  const E = [];
  for (const c of cycle) {
    const s = getSeg(c.seg); if (!s) return null;
    const p = getNode(c.from), q = getNode(c.from === s.a ? s.b : s.a); if (!p || !q) return null;
    E.push({ p, q, e: (s.ep > 0 ? s.ep : defEp) / 2 });
  }
  if (E.length < 3) return null;
  const S = polyArea(E.map((e) => e.p));
  const L = E.map(({ p, q, e }) => {
    const dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy) || 1;
    const nx = (S > 0 ? -dy : dy) / l, ny = (S > 0 ? dx : -dx) / l;      // normale vers l'intérieur
    return { x: p.x + nx * e, y: p.y + ny * e, dx: dx / l, dy: dy / l, ex: q.x + nx * e, ey: q.y + ny * e };
  });
  const out = [];
  for (let i = 0; i < L.length; i++) {
    const A = L[(i - 1 + L.length) % L.length], B = L[i];
    const den = A.dx * B.dy - A.dy * B.dx;
    if (Math.abs(den) < 1e-6) { out.push({ x: (A.ex + B.x) / 2, y: (A.ey + B.y) / 2 }); continue; }   // murs alignés
    const t = ((B.x - A.x) * B.dy - (B.y - A.y) * B.dx) / den;
    out.push({ x: +(A.x + A.dx * t).toFixed(4), y: +(A.y + A.dy * t).toFixed(4) });
  }
  return out;
}

// ---------- 1. pièces = faces fermées du réseau de murs ----------
// nodes : [{id,x,y}] ; segs : [{id,a,b,ep}] → [{cycle:[{seg,from}], poly (intérieur), area (m², habitable)}]
export function findRooms(nodes, segs, { minArea = 0.8, defEp = 0.2 } = {}) {
  const N = new Map(nodes.map((n) => [n.id, n]));
  let E = segs.filter((s) => N.has(s.a) && N.has(s.b) && s.a !== s.b);
  // retirer les bouts de murs qui ne ferment rien (sommet relié à un seul mur), jusqu'à stabilité
  for (;;) {
    const deg = new Map(); E.forEach((s) => { deg.set(s.a, (deg.get(s.a) || 0) + 1); deg.set(s.b, (deg.get(s.b) || 0) + 1); });
    const keep = E.filter((s) => deg.get(s.a) > 1 && deg.get(s.b) > 1);
    if (keep.length === E.length) break; E = keep;
  }
  // demi-arêtes, triées par angle autour de chaque sommet
  const out = new Map();
  const add = (from, to, seg) => { const a = N.get(from), b = N.get(to); if (!out.has(from)) out.set(from, []); out.get(from).push({ from, to, seg, ang: Math.atan2(b.y - a.y, b.x - a.x), used: false }); };
  E.forEach((s) => { add(s.a, s.b, s.id); add(s.b, s.a, s.id); });
  out.forEach((l) => l.sort((p, q) => p.ang - q.ang));
  const twinIndex = (v, u, seg) => out.get(v).findIndex((h) => h.to === u && h.seg === seg);
  const faces = [];
  for (const list of out.values()) for (const h0 of list) {
    if (h0.used) continue;
    const cyc = []; let h = h0, guard = 0;
    while (!h.used && guard++ < 10000) {
      h.used = true; cyc.push(h);
      const l = out.get(h.to), i = twinIndex(h.to, h.from, h.seg);
      h = l[(i - 1 + l.length) % l.length];                       // tourner sur le mur voisin
    }
    if (h === h0 && cyc.length >= 3) faces.push(cyc);
  }
  const withArea = faces.map((c) => ({ c, S: polyArea(c.map((h) => N.get(h.from))) }));
  if (!withArea.length) return [];
  // la face extérieure (la plus grande en valeur absolue) a le signe opposé des pièces
  const outer = withArea.reduce((m, f) => (Math.abs(f.S) > Math.abs(m.S) ? f : m));
  const sgn = Math.sign(outer.S);
  const getSeg = (id) => segs.find((s) => s.id === id), getNode = (id) => N.get(id);
  return withArea.filter((f) => Math.sign(f.S) === -sgn && Math.abs(f.S) >= minArea).map((f) => {
    const cycle = f.c.map((h) => ({ seg: h.seg, from: h.from }));
    const poly = interiorPoly(cycle, getNode, getSeg, defEp);
    return poly && { cycle, poly, area: Math.abs(polyArea(poly)) };
  }).filter((r) => r && r.area >= minArea * 0.5).sort((a, b) => b.area - a.area);
}

// ---------- 2. noms des pièces lus dans le PDF ----------
export const ROOM_NAMES = [
  ...Array.from({ length: 6 }, (_, i) => `Chambre ${i + 1}`), "Chambre", "Suite parentale", "Suite",
  "Espace de Vie", "Pièce de vie", "Séjour", "Salon", "Salle à manger", "Cuisine", "Arrière-cuisine",
  "Cellier", "Garage", "Buanderie", "Lingerie", "Local technique", "Atelier",
  "Salle de bains", "Salle de bain", "Bains", "SdB", "Salle d'eau", "SdE", "WC",
  "Dressing", "Bureau", "Entrée", "Dégagement", "Dgt", "Couloir", "Palier", "Hall", "Placard", "Rangement",
  "Mezzanine", "Véranda", "Grenier", "Combles", "Jeux", "Salle de jeux",
];
// pièces de passage : un nom de vraie pièce passe avant (« Espace de Vie » plutôt que « Dgt » dans un même espace ouvert)
const LOW = new Set(["dgt", "degagement", "couloir", "palier", "hall", "placard", "rangement"]);
const fold = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const signature = (arr) => { const m = new Map(); return arr.map((c) => { if (!m.has(c)) m.set(c, m.size); return m.get(c); }).join(","); };

function readable(str) { return /[a-zà-ÿ]{2,}/i.test(str) && [...str].every((c) => c.charCodeAt(0) >= 32); }
function matchReadable(str) {
  const f = fold(str).replace(/\s+/g, " ").trim();
  return ROOM_NAMES.find((n) => fold(n) === f) || ROOM_NAMES.find((n) => f.startsWith(fold(n))) || (f.length >= 3 ? str.trim() : null);
}

// items : [{str, font, x, y, size}] (textes ASSEZ GRANDS du plan) → [{name, x, y, size, how}]
export function decodeLabels(items) {
  const res = [];
  const coded = [];
  for (const it of items) {
    const s = it.str.replace(/\u0000/g, "");
    if (!s.trim()) continue;
    if (readable(s)) { const n = matchReadable(s); if (n) res.push({ name: n, x: it.x, y: it.y, size: it.size, how: "texte" }); continue; }
    coded.push({ ...it, codes: [...s] });
  }
  if (!coded.length) return res;
  // candidats pour chaque étiquette codée : noms dont la forme correspond (nom entier, ou sans sa 1re lettre).
  // Majuscules et minuscules sont des glyphes différents : on essaie les casses usuelles (« Garage », « garage », « GARAGE »).
  const variants = (n) => [...new Set([n, n[0].toUpperCase() + n.slice(1).toLowerCase(), n.toLowerCase(), n.toUpperCase()])];
  const cands = coded.map((it) => {
    const sig = signature(it.codes), out = [];
    for (const name of ROOM_NAMES) for (const v of variants(name)) {
      const full = [...v];
      if (full.length === it.codes.length && signature(full) === sig) out.push({ name, letters: full });
      const tail = full.slice(1);
      if (tail.length === it.codes.length && signature(tail) === sig) out.push({ name, letters: tail });
    }
    return out;
  });
  // Décodage police par police (un code n'a de sens que dans sa police) : on cherche la correspondance code → lettre
  // cohérente (même code = même lettre, et réciproquement) qui explique le plus de lettres.
  const fonts = new Map();
  // groupes = même police ET même taille : les noms de pièces d'un plan ont tous le même style (les cotes, « 16A »… un autre)
  coded.forEach((it, i) => { const g = it.font + "@" + (+it.size).toFixed(1); if (!fonts.has(g)) fonts.set(g, []); fonts.get(g).push(i); });
  for (const idx of fonts.values()) {
    const order = idx.filter((i) => cands[i].length).sort((a, b) => cands[a].length - cands[b].length || coded[b].codes.length - coded[a].codes.length);
    if (!order.length) continue;
    const c2l = new Map(), l2c = new Map(), pick = new Map();
    let best = { score: -1, pick: new Map() }, steps = 0;
    const remaining = (k) => order.slice(k).reduce((s, i) => s + coded[i].codes.length, 0);
    const assign = (i, cand) => {
      const added = [];
      for (let k = 0; k < cand.letters.length; k++) {
        const c = coded[i].codes[k], l = cand.letters[k], a = c2l.get(c), b = l2c.get(l);
        if ((a !== undefined && a !== l) || (b !== undefined && b !== c)) { added.forEach(([x, y]) => { c2l.delete(x); l2c.delete(y); }); return null; }
        if (a === undefined) { c2l.set(c, l); l2c.set(l, c); added.push([c, l]); }
      }
      return added;
    };
    const rec = (k, score) => {
      if (++steps > 120000) return;
      if (score + remaining(k) <= best.score) return;
      if (k === order.length) { best = { score, pick: new Map(pick) }; return; }
      const i = order[k];
      for (const c of cands[i]) {
        const added = assign(i, c); if (!added) continue;
        pick.set(i, c); rec(k + 1, score + c.letters.length); pick.delete(i);
        added.forEach(([x, y]) => { c2l.delete(x); l2c.delete(y); });
      }
      rec(k + 1, score);                         // étiquette laissée sans nom
    };
    rec(0, 0);
    // confiance : au moins 2 noms différents de 5 lettres ou plus, et 70 % des textes du groupe expliqués
    const long = new Set([...best.pick.values()].filter((c) => c.letters.length >= 5).map((c) => c.name));
    if (long.size < 2 || best.pick.size < idx.length * 0.7) continue;
    best.pick.forEach((c, i) => res.push({ name: c.name, x: coded[i].x, y: coded[i].y, size: coded[i].size, how: "décodé" }));
  }
  return res;
}

// donne un nom à chaque pièce d'après les étiquettes qu'elle contient
export function nameRooms(rooms, labels) {
  const used = new Map();
  return rooms.map((r, i) => {
    const inside = labels.filter((l) => pointInPoly(l.x, l.y, r.poly));
    inside.sort((a, b) => (LOW.has(fold(a.name)) - LOW.has(fold(b.name))) || b.size - a.size || b.name.length - a.name.length);
    let name = inside[0]?.name || `Pièce ${i + 1}`;
    const n = (used.get(name) || 0) + 1; used.set(name, n);
    if (n > 1) name += ` (${n})`;
    return { ...r, name, labels: inside.map((l) => l.name) };
  });
}
