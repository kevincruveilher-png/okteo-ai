// Oktéo AI — cœur : Vue (zoom, déplacement), accrochage, repères des appareils.
// Module issu du découpage de app.js (v26). L'état partagé est dans K (core/k.js).
import { K } from "./k.js";
import { PLAN, TYPES, VB, dist, state } from "./model.js";
import { markDirty, snapshot } from "./persist.js";
import { draw, sv } from "./render.js";
import { bbox, roomAt } from "./groups.js";
import { linkRole } from "./attach.js";
import { allLinks } from "./levels.js";
import { showSide } from "./panel.js";

// ---------- vue ----------
// la zone de dessin prend exactement les proportions de l'écran : pas de bandes, pas de décalage entre clic et affichage
export function syncVB() {
  const R = sv.getBoundingClientRect();
  if (R.width > 0 && R.height > 0) {
    VB.h = 70;
    VB.w = 70 * R.width / R.height;
    sv.setAttribute("viewBox", "0 0 " + VB.w + " " + VB.h);
  }
}

export function fit() {
  syncVB();
  let pts = [...state.nodes, ...state.app];
  if (!pts.length && K.FOND && K.BG.w > 0) pts = [{
    x: K.BG.x,
    y: K.BG.y
  }, {
    x: K.BG.x + K.BG.w,
    y: K.BG.y + K.BG.h
  }]; // chantier vide : cadrer le fond
  const bb = pts.length ? bbox(pts) : null;
  const w = bb ? Math.max(2, bb.x1 - bb.x0) : PLAN.w,
    h = bb ? Math.max(2, bb.y1 - bb.y0) : PLAN.h,
    pad = 1.0;
  K.view.scale = Math.min(VB.w / (w + pad * 2), VB.h / (h + pad * 2));
  K.view.cx = bb ? bb.cx : PLAN.w / 2;
  K.view.cy = bb ? bb.cy : PLAN.h / 2;
  draw();
}

export function V2W(vx, vy) {
  return [K.view.cx + (vx - VB.w / 2) / K.view.scale, K.view.cy + (vy - VB.h / 2) / K.view.scale];
}

export function W2V(x, y) {
  return [VB.w / 2 + (x - K.view.cx) * K.view.scale, VB.h / 2 + (y - K.view.cy) * K.view.scale];
}

export function evWorld(e) {
  const ctm = sv.getScreenCTM();
  if (!ctm) return [0, 0];
  const p = sv.createSVGPoint();
  p.x = e.clientX;
  p.y = e.clientY;
  const v = p.matrixTransform(ctm.inverse());
  return V2W(v.x, v.y);
}

export function pxPerVB() {
  const r = sv.getBoundingClientRect();
  return Math.min(r.width / VB.w, r.height / VB.h) || 1;
}

export function tolM() {
  return 12 / pxPerVB() / K.view.scale;
}

// ---------- accrochage ----------

// ---------- accrochage ----------
export function snapWorld(wx, wy, excl) {
  const tol = tolM();
  let best = null,
    bd = tol;
  for (const n of state.nodes) {
    if (excl && n.id === excl) continue;
    const d = dist(wx, wy, n.x, n.y);
    if (d < bd) {
      bd = d;
      best = {
        x: n.x,
        y: n.y,
        node: n.id,
        kind: "nœud"
      };
    }
  }
  if (best) return best;
  const gx = Math.round(wx / K.gridM) * K.gridM,
    gy = Math.round(wy / K.gridM) * K.gridM;
  return {
    x: +gx.toFixed(3),
    y: +gy.toFixed(3),
    node: null,
    kind: "grille"
  };
}

export function applyOrtho(fx, fy, wx, wy) {
  if (!K.ortho) return [wx, wy];
  return Math.abs(wx - fx) >= Math.abs(wy - fy) ? [wx, fy] : [fx, wy];
}

// ---------- repères auto ----------
// chaque appareil garde son numéro (a.n) dans sa famille (a.rf) : supprimer P3 ne renumérote pas P4, P5…
// numéro manquant (nouvel appareil, ancien dessin), en double (copie) ou famille changée → le premier numéro libre au-dessus du max

// ---------- repères auto ----------
// chaque appareil garde son numéro (a.n) dans sa famille (a.rf) : supprimer P3 ne renumérote pas P4, P5…
// numéro manquant (nouvel appareil, ancien dessin), en double (copie) ou famille changée → le premier numéro libre au-dessus du max
export function ensureReps() {
  const max = {},
    seen = {};
  state.app.forEach(a => {
    const f = TYPES[a.t] ? TYPES[a.t].r : "?";
    if (a.rf === f && a.n > 0) max[f] = Math.max(max[f] || 0, a.n);
    // un nouvel appareil ne doit pas prendre le numéro d'un allumage existant de sa famille
    if (a.rf === f && a.g > 0) max[f] = Math.max(max[f] || 0, a.g);
  });
  state.app.forEach(a => {
    const f = TYPES[a.t] ? TYPES[a.t].r : "?";
    const k = f + "|" + a.n;
    if (a.rf !== f || !(a.n > 0) || seen[k]) {
      a.rf = f;
      a.n = (max[f] || 0) + 1;
      max[f] = a.n;
    }
    seen[f + "|" + a.n] = true;
  });
}

// Repères par allumage (v32) : une commande et les lumières qu'elle allume portent le même numéro (I3 + L3) ;
// le 2e appareil du même type dans l'allumage prend A, le 3e B… (VV1 + VV1A, L3 + L3A, BP1 + BP1A + BP1B).
// Le numéro d'allumage `a.g` est commun à tous les niveaux et gardé tant que l'allumage existe ; un nouvel allumage
// prend le numéro de sa commande s'il est libre. Ce qui n'est relié à rien garde son propre numéro `a.n`
// (changé seulement s'il tombait sur un allumage de sa famille). Renvoie { id → repère } pour tous les niveaux.
export function repMap() {
  ensureReps();
  const apps = [...state.app, ...Object.entries(K.LV.data).filter(([id]) => id !== K.LV.cur).flatMap(([, d]) => d.app || [])];
  const by = new Map(apps.map(a => [a.id, a]));
  const fam = a => TYPES[a.t] ? TYPES[a.t].r : "?";
  const par = new Map(),
    root = x => {
      while (par.get(x) !== x) x = par.get(x);
      return x;
    };
  for (const x of allLinks()) {
    const c = by.get(x.c),
      l = by.get(x.l);
    if (!c || !l || linkRole(c.t) !== "c" || linkRole(l.t) !== "l") continue;
    [c.id, l.id].forEach(id => {
      if (!par.has(id)) par.set(id, id);
    });
    par.set(root(c.id), root(l.id));
  }
  const groups = new Map();
  for (const id of par.keys()) {
    const r = root(id);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(by.get(id));
  }
  const G = [...groups.values()];
  const cmdMin = g => Math.min(...g.filter(a => linkRole(a.t) === "c").map(a => a.n > 0 ? a.n : 1e9));
  G.sort((p, q) => cmdMin(p) - cmdMin(q));
  // numéros propres des appareils non reliés, par famille (un allumage ne doit pas les prendre)
  const loose = {};
  apps.forEach(a => {
    if (par.has(a.id)) return;
    (loose[fam(a)] ||= new Set()).add(a.n);
  });
  const taken = new Set(),
    num = new Map();
  const freeFor = (g, n) => !taken.has(n) && g.every(a => !(loose[fam(a)] && loose[fam(a)].has(n)));
  for (const g of G) {
    const cnt = {};
    g.forEach(a => {
      if (a.g > 0) cnt[a.g] = (cnt[a.g] || 0) + 1;
    });
    const best = Object.keys(cnt).map(Number).sort((x, y) => cnt[y] - cnt[x] || x - y).find(n => !taken.has(n));
    if (best) {
      num.set(g, best);
      taken.add(best);
    }
  }
  for (const g of G) {
    if (num.has(g)) continue;
    const c = cmdMin(g);
    let n = c < 1e9 && freeFor(g, c) ? c : 1;
    while (!freeFor(g, n)) n++;
    num.set(g, n);
    taken.add(n);
  }
  const m = {},
    famUse = {};
  for (const g of G) {
    const n = num.get(g),
      byFam = {};
    g.forEach(a => {
      a.g = n;
      (byFam[fam(a)] ||= []).push(a);
      (famUse[fam(a)] ||= new Set()).add(n);
    });
    for (const [f, list] of Object.entries(byFam)) {
      list.sort((p, q) => (p.n || 0) - (q.n || 0) || String(p.id).localeCompare(String(q.id)));
      list.forEach((a, i) => m[a.id] = f + n + (i ? String.fromCharCode(64 + i) : ""));
    }
  }
  // non reliés : leur propre numéro ; s'il est déjà celui d'un allumage de la même famille, le premier libre
  apps.forEach(a => {
    if (par.has(a.id)) return;
    const f = fam(a);
    if (a.g) delete a.g;
    if (famUse[f] && famUse[f].has(a.n)) {
      const used = new Set([...famUse[f], ...apps.filter(b => !par.has(b.id) && fam(b) === f && b !== a).map(b => b.n)]);
      let k = 1;
      while (used.has(k)) k++;
      a.n = k;
    }
    m[a.id] = f + a.n;
  });
  return m;
}
// renumérotation volontaire (commande) : par pièce puis de gauche à droite, de haut en bas ; un seul Ctrl+Z

// renumérotation volontaire (commande) : par pièce puis de gauche à droite, de haut en bas ; un seul Ctrl+Z
export function renumberReps() {
  snapshot();
  const key = a => {
    const r = roomAt(a.x, a.y);
    return [r && r.name || "~", Math.round(a.y * 2), a.x];
  };
  const sorted = state.app.slice().sort((p, q) => {
    const A = key(p),
      B = key(q);
    return A[0].localeCompare(B[0], "fr", {
      numeric: true
    }) || A[1] - B[1] || A[2] - B[2];
  });
  const c = {};
  sorted.forEach(a => {
    const f = TYPES[a.t].r;
    c[f] = (c[f] || 0) + 1;
    a.rf = f;
    a.n = c[f];
    delete a.g;            // les allumages reprennent le numéro de leur commande
  });
  markDirty();
  draw();
  showSide();
  return sorted.length;
}

// ---------- rendu ----------

