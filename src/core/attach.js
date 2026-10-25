// Oktéo AI — cœur : Hit-tests (ce qui est sous la souris) et appareils attachés à leur mur.
// Module issu du découpage de app.js (v26). L'état partagé est dans K (core/k.js).
import { K } from "./k.js";
import { interiorPoly, polyArea } from "../walls/rooms.js";
import { cornerHalf, dist, epOf, nodeById, segById, segDir, state } from "./model.js";
import { markDirty, snapshot } from "./persist.js";
import { tolM } from "./view.js";
import { draw } from "./render.js";
import { cleanNodes, showSide } from "./panel.js";

// ---------- hit-tests ----------
export function hitNode(wx, wy) {
  let b = null,
    bd = tolM();
  for (const n of state.nodes) {
    const d = dist(wx, wy, n.x, n.y);
    if (d < bd) {
      bd = d;
      b = n;
    }
  }
  return b;
}

export function hitApp(wx, wy) {
  let b = null,
    bd = Math.max(tolM(), K.symCm / 100);
  for (const a of state.app) {
    const d = dist(wx, wy, a.x, a.y);
    if (d < bd) {
      bd = d;
      b = a;
    }
  }
  return b;
}

export function segDistPt(px, py, a, b) {
  const vx = b.x - a.x,
    vy = b.y - a.y,
    wx = px - a.x,
    wy = py - a.y,
    Lq = vx * vx + vy * vy;
  let t = Lq ? (wx * vx + wy * vy) / Lq : 0;
  t = Math.max(0, Math.min(1, t));
  return {
    d: dist(px, py, a.x + t * vx, a.y + t * vy),
    t: t * Math.sqrt(Lq)
  };
}

export function hitSeg(wx, wy) {
  let b = null,
    bd = tolM(),
    bt = 0;
  for (const s of state.segs) {
    const a = nodeById(s.a),
      c = nodeById(s.b);
    if (!a || !c) continue;
    const r = segDistPt(wx, wy, a, c);
    if (r.d < bd) {
      bd = r.d;
      b = s;
      bt = r.t;
    }
  }
  return b ? {
    seg: b,
    t: bt
  } : null;
}

export function hitOpen(wx, wy) {
  let b = null,
    bd = 1e9;
  const tol = Math.max(tolM(), state.wallEp, ...state.segs.map(epOf)) + 0.12;
  for (const o of state.openings) {
    const seg = segById(o.seg);
    if (!seg) continue;
    const d = segDir(seg);
    const j1 = {
        x: d.a.x + d.ux * (o.t - o.w / 2),
        y: d.a.y + d.uy * (o.t - o.w / 2)
      },
      j2 = {
        x: d.a.x + d.ux * (o.t + o.w / 2),
        y: d.a.y + d.uy * (o.t + o.w / 2)
      };
    const r = segDistPt(wx, wy, j1, j2);
    if (r.d < tol && r.d < bd) {
      bd = r.d;
      b = o;
    }
  }
  return b;
}
// poignées de largeur d'une ouverture sélectionnée

// poignées de largeur d'une ouverture sélectionnée
export function openHandles(o) {
  const seg = segById(o.seg);
  if (!seg) return null;
  const d = segDir(seg);
  return {
    d,
    j1: {
      x: d.a.x + d.ux * (o.t - o.w / 2),
      y: d.a.y + d.uy * (o.t - o.w / 2)
    },
    j2: {
      x: d.a.x + d.ux * (o.t + o.w / 2),
      y: d.a.y + d.uy * (o.t + o.w / 2)
    }
  };
}

export function hitOpenHandle(wx, wy, o) {
  const H = openHandles(o);
  if (!H) return null;
  const tol = tolM() * 1.2;
  if (dist(wx, wy, H.j1.x, H.j1.y) < tol) return "j1";
  if (dist(wx, wy, H.j2.x, H.j2.y) < tol) return "j2";
  return null;
}
// projeter un point sur un mur -> {t,x,y,d}

// projeter un point sur un mur -> {t,x,y,d}
export function projOnSeg(wx, wy, seg) {
  const d = segDir(seg);
  const t = Math.max(0, Math.min(d.L, (wx - d.a.x) * d.ux + (wy - d.a.y) * d.uy));
  return {
    t,
    x: d.a.x + d.ux * t,
    y: d.a.y + d.uy * t,
    d: dist(wx, wy, d.a.x + d.ux * t, d.a.y + d.uy * t),
    dir: d
  };
}
// accrocher un appareil mural au mur le plus proche (face côté curseur)

// accrocher un appareil mural au mur le plus proche (face côté curseur)
export function snapToWall(wx, wy) {
  let best = null,
    bd = 0.6;
  for (const seg of state.segs) {
    if (seg.virt) continue;
    const p = projOnSeg(wx, wy, seg);
    if (p.t <= 0.001 || p.t >= p.dir.L - 0.001) continue;
    if (p.d < bd) {
      bd = p.d;
      best = {
        seg,
        p
      };
    }
  }
  if (!best) return null;
  const d = best.p.dir;
  const nx = -d.uy,
    ny = d.ux;
  const sideSign = (wx - d.a.x) * nx + (wy - d.a.y) * ny >= 0 ? 1 : -1;
  const off = epOf(best.seg) / 2 + 0.06;
  return {
    x: +(best.p.x + nx * off * sideSign).toFixed(3),
    y: +(best.p.y + ny * off * sideSign).toFixed(3),
    seg: best.seg.id,
    wall: true
  };
}
// guides d'alignement sur un autre appareil (même x ou même y)

export function snapAlign(x, y, exclId) {
  K.guides = [];
  const tol = tolM() * 0.9;
  let rx = x,
    ry = y;
  for (const a of state.app) {
    if (a.id === exclId) continue;
    if (Math.abs(a.x - x) < tol) {
      rx = a.x;
      K.guides.push({
        v: true,
        at: a.x
      });
    }
    if (Math.abs(a.y - y) < tol) {
      ry = a.y;
      K.guides.push({
        v: false,
        at: a.y
      });
    }
  }
  return {
    x: rx,
    y: ry
  };
}

export const wallMounted = t => ["PC16", "PC20", "RJ45", "INT", "VV", "BP", "SC", "APP"].includes(t);

// ---------- appareils attachés à leur mur ----------
// a.wa = {e:"a"|"b", d, s} : distance d (m) depuis la FACE du mur d'angle côté e (le plus proche), côté s (±1) du mur.
// Avant chaque dessin, followWalls() replace les appareils d'après a.wa : ils suivent leur mur (déplacé, tourné,
// allongé, épaissi) et gardent leur distance à l'angle (« prise à 30 cm de l'angle » reste vrai).
export function attachOf(a) {
  const seg = segById(a.seg);
  if (!seg) return null;
  const p = projOnSeg(a.x, a.y, seg),
    d = p.dir;
  if (!d.a || !d.L) return null;
  const s = (a.x - p.x) * -d.uy + (a.y - p.y) * d.ux >= 0 ? 1 : -1;
  const dA = p.t - cornerHalf(seg.a, seg.id),
    dB = d.L - p.t - cornerHalf(seg.b, seg.id);
  return dA <= dB ? {
    e: "a",
    d: +dA.toFixed(3),
    s
  } : {
    e: "b",
    d: +dB.toFixed(3),
    s
  };
}

export function attach(a) {
  if (!a.seg) {
    delete a.wa;
    return;
  }
  const w = attachOf(a);
  if (w) a.wa = w;else {
    delete a.seg;
    delete a.wa;
  }
}

export function posFromAttach(a) {
  const seg = segById(a.seg);
  if (!seg || !a.wa) return null;
  const d = segDir(seg);
  if (!d.a || !d.L) return null;
  let t = a.wa.e === "a" ? a.wa.d + cornerHalf(seg.a, seg.id) : d.L - a.wa.d - cornerHalf(seg.b, seg.id);
  t = Math.max(0, Math.min(d.L, t));
  const off = epOf(seg) / 2 + 0.06;
  return {
    x: +(d.a.x + d.ux * t - d.uy * off * a.wa.s).toFixed(3),
    y: +(d.a.y + d.uy * t + d.ux * off * a.wa.s).toFixed(3)
  };
}
// pièces : rectangle (outil Pièce) ou contour de murs détecté (r.cycle → r.poly = contour intérieur, surface habitable)

// pièces : rectangle (outil Pièce) ou contour de murs détecté (r.cycle → r.poly = contour intérieur, surface habitable)
export const roomPoly = r => r.poly && r.poly.length > 2 ? r.poly : [{
  x: Math.min(r.x0, r.x1),
  y: Math.min(r.y0, r.y1)
}, {
  x: Math.max(r.x0, r.x1),
  y: Math.min(r.y0, r.y1)
}, {
  x: Math.max(r.x0, r.x1),
  y: Math.max(r.y0, r.y1)
}, {
  x: Math.min(r.x0, r.x1),
  y: Math.max(r.y0, r.y1)
}];

export const roomArea = r => r.poly && r.poly.length > 2 ? Math.abs(polyArea(r.poly)) : Math.abs((r.x1 - r.x0) * (r.y1 - r.y0));

// le contour d'une pièce suit ses murs (déplacés, tournés, allongés, épaissis)
export function followRooms() {
  for (const r of state.rooms) {
    if (r.cycle) {
      const P = interiorPoly(r.cycle, nodeById, segById, state.wallEp);
      if (P) {
        r.poly = P;
        r.x0 = Math.min(...P.map(p => p.x));
        r.x1 = Math.max(...P.map(p => p.x));
        r.y0 = Math.min(...P.map(p => p.y));
        r.y1 = Math.max(...P.map(p => p.y));
      } else r.open = true; // un mur du contour a disparu : la pièce n'est plus fermée
      continue;
    }
    const ss = (r.segs || []).map(segById);
    if (!ss.length || ss.some(s => !s)) continue;
    const ns = ss.flatMap(s => [nodeById(s.a), nodeById(s.b)]).filter(Boolean);
    if (ns.length < 4) continue;
    r.x0 = Math.min(...ns.map(n => n.x));
    r.x1 = Math.max(...ns.map(n => n.x));
    r.y0 = Math.min(...ns.map(n => n.y));
    r.y1 = Math.max(...ns.map(n => n.y));
  }
}

export function followWalls() {
  followRooms();
  for (const a of state.app) {
    if (!a.seg) continue;
    if (!segById(a.seg)) {
      delete a.seg;
      delete a.wa;
      continue;
    } // mur supprimé : l'appareil reste, détaché
    if (!a.wa) {
      a.wa = attachOf(a);
      if (!a.wa) continue;
    } // ancien dessin : attache calculée une fois
    const p = posFromAttach(a);
    if (p) {
      a.x = p.x;
      a.y = p.y;
    }
  }
}
// raccroche un appareil mural au mur le plus proche (≤ 60 cm), sinon le détache

// raccroche un appareil mural au mur le plus proche (≤ 60 cm), sinon le détache
export function reattach(a) {
  if (!wallMounted(a.t)) {
    delete a.seg;
    delete a.wa;
    return;
  }
  const ws = snapToWall(a.x, a.y);
  if (ws) {
    a.seg = ws.seg;
    a.x = ws.x;
    a.y = ws.y;
    attach(a);
  } else {
    delete a.seg;
    delete a.wa;
  }
}
// supprimer un mur : avec ses appareils, ou en les gardant (détachés)

// supprimer un mur : avec ses appareils, ou en les gardant (détachés)
export function removeSeg(id, withApps) {
  snapshot();
  if (withApps) {
    const kill = new Set(state.app.filter(a => a.seg === id).map(a => a.id));
    state.app = state.app.filter(a => !kill.has(a.id));
    state.lia = state.lia.filter(l => !kill.has(l.c) && !kill.has(l.l));
  } else state.app.forEach(a => {
    if (a.seg === id) {
      delete a.seg;
      delete a.wa;
    }
  });
  state.openings = state.openings.filter(o => o.seg !== id);
  state.segs = state.segs.filter(x => x.id !== id);
  cleanNodes();
  K.sel = null;
  markDirty();
  draw();
  showSide();
}

// ---------- sélection multiple / groupes ----------

// initialisation (étape 3 du démarrage)
export function init3() {
// guides d'alignement sur un autre appareil (même x ou même y)
K.guides = [];
}

