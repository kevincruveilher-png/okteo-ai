// Oktéo AI — cœur : Sélection multiple, groupes, copier / déplacer / tourner.
// Module issu du découpage de app.js (v26). L'état partagé est dans K (core/k.js).
import { K } from "./k.js";
import { pointInPoly } from "../walls/rooms.js";
import { layers, node, nodeById, segById, segDir, segLen, state, uidA, uidD, uidO, uidR, uidS } from "./model.js";
import { markDirty, snapshot } from "./persist.js";
import { draw } from "./render.js";
import { attach, reattach } from "./attach.js";
import { fmtM, showText } from "./interact.js";
import { cleanNodes, showSide } from "./panel.js";

// ---------- sélection multiple / groupes ----------
export const multi = new Set();

// aperçu de pose d'appareil sous le curseur
export const mk = (k, id) => k + ":" + id;

export function isSel(k, id) {
  return K.sel && K.sel.kind === k && K.sel.id === id || multi.has(mk(k, id));
}

export function clearSel() {
  K.sel = null;
  multi.clear();
}

export function setSingle(k, id) {
  multi.clear();
  K.sel = {
    kind: k,
    id
  };
}

export function addKey(s) {
  if (s.kind === "seg") {
    const sg = segById(s.id);
    if (sg) {
      multi.add(mk("node", sg.a));
      multi.add(mk("node", sg.b));
    }
  } else multi.add(mk(s.kind, s.id));
}

export function normalizeSel() {
  if (multi.size === 1) {
    const key = [...multi][0];
    const i = key.indexOf(":");
    K.sel = {
      kind: key.slice(0, i),
      id: key.slice(i + 1)
    };
    multi.clear();
  } else if (multi.size > 1) K.sel = null;
}

export function toggleMulti(k, id) {
  if (multi.size === 0 && K.sel && ["app", "node", "room", "open", "dim", "seg"].includes(K.sel.kind)) {
    addKey(K.sel);
    K.sel = null;
  }
  if (k === "seg") {
    const s = segById(id);
    if (s) {
      const ka = mk("node", s.a),
        kb = mk("node", s.b);
      if (multi.has(ka) && multi.has(kb)) {
        multi.delete(ka);
        multi.delete(kb);
      } else {
        multi.add(ka);
        multi.add(kb);
      }
    }
  } else {
    const key = mk(k, id);
    multi.has(key) ? multi.delete(key) : multi.add(key);
  }
  normalizeSel();
}

export function roomAt(wx, wy) {
  for (let i = state.rooms.length - 1; i >= 0; i--) {
    const r = state.rooms[i];
    if (r.poly && r.poly.length > 2) {
      if (pointInPoly(wx, wy, r.poly)) return r;
      continue;
    }
    if (wx >= Math.min(r.x0, r.x1) && wx <= Math.max(r.x0, r.x1) && wy >= Math.min(r.y0, r.y1) && wy <= Math.max(r.y0, r.y1)) return r;
  }
  return null;
}

export function roomExpand(r, G) {
  const ep = state.wallEp,
    own = new Set(),
    others = new Set();
  (r.segs || []).forEach(sid => {
    const s = segById(sid);
    if (s) {
      own.add(s.a);
      own.add(s.b);
    }
  });
  state.rooms.forEach(o => {
    if (o.id !== r.id) (o.segs || []).forEach(sid => {
      const s = segById(sid);
      if (s) {
        others.add(s.a);
        others.add(s.b);
      }
    });
  });
  const X0 = Math.min(r.x0, r.x1),
    X1 = Math.max(r.x0, r.x1),
    Y0 = Math.min(r.y0, r.y1),
    Y1 = Math.max(r.y0, r.y1);
  const inR = (x, y, m) => x >= X0 - m && x <= X1 + m && y >= Y0 - m && y <= Y1 + m;
  own.forEach(id => G.nodes.add(id));
  state.nodes.forEach(n => {
    if (!own.has(n.id) && !others.has(n.id) && inR(n.x, n.y, r.segs ? 0.02 : ep / 2)) G.nodes.add(n.id);
  });
  state.app.forEach(a => {
    if (inR(a.x, a.y, 0.02)) G.apps.add(a.id);
  });
  state.dims.forEach(d => {
    if (inR(d.a.x, d.a.y, 0.02) && inR(d.b.x, d.b.y, 0.02)) G.dims.add(d.id);
  });
}

export function currentGroup() {
  const G = {
    nodes: new Set(),
    apps: new Set(),
    rooms: new Set(),
    opens: new Set(),
    dims: new Set()
  };
  const add = (k, id) => {
    if (k === "node") G.nodes.add(id);else if (k === "app") G.apps.add(id);else if (k === "room") G.rooms.add(id);else if (k === "open") G.opens.add(id);else if (k === "dim") G.dims.add(id);else if (k === "seg") {
      const s = segById(id);
      if (s) {
        G.nodes.add(s.a);
        G.nodes.add(s.b);
      }
    }
  };
  if (multi.size) multi.forEach(key => {
    const i = key.indexOf(":");
    add(key.slice(0, i), key.slice(i + 1));
  });else if (K.sel) add(K.sel.kind, K.sel.id);
  G.rooms.forEach(rid => {
    const r = state.rooms.find(x => x.id === rid);
    if (r) roomExpand(r, G);
  });
  state.openings.forEach(o => {
    const s = segById(o.seg);
    if (s && G.nodes.has(s.a) && G.nodes.has(s.b)) G.opens.add(o.id);
  });
  return G;
}

export const groupEmpty = G => !G.nodes.size && !G.apps.size && !G.rooms.size && !G.opens.size && !G.dims.size;

export function openCenter(id) {
  const o = state.openings.find(x => x.id === id);
  if (!o) return null;
  const s = segById(o.seg);
  if (!s) return null;
  const d = segDir(s);
  return {
    x: d.a.x + d.ux * o.t,
    y: d.a.y + d.uy * o.t
  };
}

export function groupPoints(G) {
  const pts = [];
  G.nodes.forEach(id => {
    const n = nodeById(id);
    if (n) pts.push(n);
  });
  G.apps.forEach(id => {
    const a = state.app.find(x => x.id === id);
    if (a) pts.push(a);
  });
  G.rooms.forEach(id => {
    const r = state.rooms.find(x => x.id === id);
    if (r) pts.push({
      x: r.x0,
      y: r.y0
    }, {
      x: r.x1,
      y: r.y1
    });
  });
  G.dims.forEach(id => {
    const d = state.dims.find(x => x.id === id);
    if (d) pts.push(d.a, d.b);
  });
  G.opens.forEach(id => {
    const c = openCenter(id);
    if (c) pts.push(c);
  });
  return pts;
}

export function bbox(pts) {
  if (!pts.length) return null;
  let x0 = 1e9,
    y0 = 1e9,
    x1 = -1e9,
    y1 = -1e9;
  pts.forEach(p => {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  });
  return {
    x0,
    y0,
    x1,
    y1,
    cx: (x0 + x1) / 2,
    cy: (y0 + y1) / 2
  };
}

export function clampOpenings() {
  state.openings.forEach(o => {
    const s = segById(o.seg);
    if (!s) return;
    const L = segLen(s);
    o.w = Math.min(o.w, Math.max(0.2, L));
    o.t = +Math.max(o.w / 2, Math.min(L - o.w / 2, o.t)).toFixed(3);
  });
}

export function groupCount(G) {
  return G.apps.size + G.rooms.size + G.dims.size + G.opens.size + state.segs.filter(s => G.nodes.has(s.a) && G.nodes.has(s.b)).length;
}

export function startGroupDrag(wx, wy, G, perp) {
  G = G || currentGroup();
  if (groupEmpty(G)) return false;
  const orig = {
    nodes: {},
    apps: {},
    rooms: {},
    dims: {}
  };
  G.nodes.forEach(id => {
    const n = nodeById(id);
    if (n) orig.nodes[id] = {
      x: n.x,
      y: n.y
    };
  });
  G.apps.forEach(id => {
    const a = state.app.find(x => x.id === id);
    if (a) orig.apps[id] = {
      x: a.x,
      y: a.y
    };
  });
  G.rooms.forEach(id => {
    const r = state.rooms.find(x => x.id === id);
    if (r) orig.rooms[id] = {
      x0: r.x0,
      y0: r.y0,
      x1: r.x1,
      y1: r.y1
    };
  });
  G.dims.forEach(id => {
    const d = state.dims.find(x => x.id === id);
    if (d) orig.dims[id] = {
      a: {
        ...d.a
      },
      b: {
        ...d.b
      }
    };
  });
  K.drag = {
    kind: "group",
    G,
    orig,
    sx: wx,
    sy: wy,
    perp: perp || null,
    moved: false
  };
  return true;
}

export function moveGroup(wx, wy, shift) {
  let dx = wx - K.drag.sx,
    dy = wy - K.drag.sy;
  if (K.drag.perp) {
    let k = dx * K.drag.perp.x + dy * K.drag.perp.y;
    k = Math.round(k / K.gridM) * K.gridM;
    dx = k * K.drag.perp.x;
    dy = k * K.drag.perp.y;
    showText("Déplacement du mur : " + fmtM(Math.abs(k)));
  } else {
    if (shift) {
      if (Math.abs(dx) >= Math.abs(dy)) dy = 0;else dx = 0;
    }
    dx = Math.round(dx / K.gridM) * K.gridM;
    dy = Math.round(dy / K.gridM) * K.gridM;
    showText("Δ " + fmtM(dx) + " ; " + fmtM(dy));
  }
  const o = K.drag.orig;
  for (const id in o.nodes) {
    const n = nodeById(id);
    if (n) {
      n.x = +(o.nodes[id].x + dx).toFixed(3);
      n.y = +(o.nodes[id].y + dy).toFixed(3);
    }
  }
  for (const id in o.apps) {
    const a = state.app.find(x => x.id === id);
    if (a) {
      a.x = +(o.apps[id].x + dx).toFixed(2);
      a.y = +(o.apps[id].y + dy).toFixed(2);
      if (a.seg) {
        const s = segById(a.seg);
        if (!(s && o.nodes[s.a] && o.nodes[s.b])) reattach(a);
      }
    }
  }
  for (const id in o.rooms) {
    const r = state.rooms.find(x => x.id === id),
      q = o.rooms[id];
    if (r) {
      r.x0 = +(q.x0 + dx).toFixed(3);
      r.x1 = +(q.x1 + dx).toFixed(3);
      r.y0 = +(q.y0 + dy).toFixed(3);
      r.y1 = +(q.y1 + dy).toFixed(3);
    }
  }
  for (const id in o.dims) {
    const d = state.dims.find(x => x.id === id),
      q = o.dims[id];
    if (d) {
      d.a = {
        x: q.a.x + dx,
        y: q.a.y + dy
      };
      d.b = {
        x: q.b.x + dx,
        y: q.b.y + dy
      };
    }
  }
  clampOpenings();
}

export function transformGroup(kind) {
  const G = currentGroup();
  if (groupEmpty(G)) return;
  const bb = bbox(groupPoints(G));
  if (!bb) return;
  const c = {
    x: Math.round(bb.cx / K.gridM) * K.gridM,
    y: Math.round(bb.cy / K.gridM) * K.gridM
  };
  const f = {
    cw: (dx, dy) => [-dy, dx],
    ccw: (dx, dy) => [dy, -dx],
    mx: (dx, dy) => [-dx, dy],
    my: (dx, dy) => [dx, -dy]
  }[kind];
  const T = p => {
    const [nx, ny] = f(p.x - c.x, p.y - c.y);
    return {
      x: +(c.x + nx).toFixed(3),
      y: +(c.y + ny).toFixed(3)
    };
  };
  snapshot();
  G.nodes.forEach(id => {
    const n = nodeById(id);
    if (n) {
      const p = T(n);
      n.x = p.x;
      n.y = p.y;
    }
  });
  // les appareils posés sur un mur transformé le suivent, même s'ils n'étaient pas sélectionnés (sinon une symétrie les mettrait du mauvais côté)
  const onMoved = a => {
    const s = a.seg && segById(a.seg);
    return !!(s && G.nodes.has(s.a) && G.nodes.has(s.b));
  };
  state.app.forEach(a => {
    if (!G.apps.has(a.id) && !onMoved(a)) return;
    const p = T(a);
    a.x = +p.x.toFixed(2);
    a.y = +p.y.toFixed(2);
    if (a.seg) {
      if (onMoved(a)) attach(a);else reattach(a);
    }
  });
  G.rooms.forEach(id => {
    const r = state.rooms.find(x => x.id === id);
    if (r) {
      const p0 = T({
          x: r.x0,
          y: r.y0
        }),
        p1 = T({
          x: r.x1,
          y: r.y1
        });
      r.x0 = Math.min(p0.x, p1.x);
      r.x1 = Math.max(p0.x, p1.x);
      r.y0 = Math.min(p0.y, p1.y);
      r.y1 = Math.max(p0.y, p1.y);
    }
  });
  G.dims.forEach(id => {
    const d = state.dims.find(x => x.id === id);
    if (d) {
      d.a = T(d.a);
      d.b = T(d.b);
    }
  });
  if (kind === "mx" || kind === "my") G.opens.forEach(id => {
    const o = state.openings.find(x => x.id === id);
    if (o) o.swing = o.swing === "int" ? "ext" : "int";
  });
  clampOpenings();
  markDirty();
  draw();
  showSide();
}

export function serializeGroup(G) {
  const segs = state.segs.filter(s => G.nodes.has(s.a) && G.nodes.has(s.b));
  const segIds = new Set(segs.map(s => s.id));
  const data = {
    nodes: [...G.nodes].map(nodeById).filter(Boolean).map(n => ({
      ...n
    })),
    segs: segs.map(s => ({
      ...s
    })),
    openings: state.openings.filter(o => segIds.has(o.seg)).map(o => ({
      ...o
    })),
    rooms: [...G.rooms].map(id => state.rooms.find(r => r.id === id)).filter(Boolean).map(r => ({
      ...r,
      segs: (r.segs || []).slice()
    })),
    apps: [...G.apps].map(id => state.app.find(a => a.id === id)).filter(Boolean).map(a => ({
      ...a
    })),
    dims: [...G.dims].map(id => state.dims.find(d => d.id === id)).filter(Boolean).map(d => ({
      id: d.id,
      a: {
        ...d.a
      },
      b: {
        ...d.b
      }
    }))
  };
  const appIds = new Set(data.apps.map(a => a.id));
  data.lia = state.lia.filter(l => appIds.has(l.c) && appIds.has(l.l)).map(l => ({
    ...l
  }));
  const bb = bbox([...data.nodes, ...data.apps, ...data.rooms.flatMap(r => [{
    x: r.x0,
    y: r.y0
  }, {
    x: r.x1,
    y: r.y1
  }]), ...data.dims.flatMap(d => [d.a, d.b])]);
  data.cx = bb ? bb.cx : 0;
  data.cy = bb ? bb.cy : 0;
  return data;
}

export function instantiateGroup(data, dx, dy) {
  const nm = {},
    sm = {},
    am = {};
  multi.clear();
  K.sel = null;
  data.nodes.forEach(n => {
    const nn = node(n.x + dx, n.y + dy);
    nm[n.id] = nn.id;
    multi.add(mk("node", nn.id));
  });
  data.segs.forEach(s => {
    if (nm[s.a] && nm[s.b]) {
      const id = uidS();
      sm[s.id] = id;
      state.segs.push({
        ...s,
        id,
        a: nm[s.a],
        b: nm[s.b]
      });
    }
  });
  data.openings.forEach(o => {
    if (sm[o.seg]) {
      const id = uidO();
      state.openings.push({
        ...o,
        id,
        seg: sm[o.seg]
      });
      multi.add(mk("open", id));
    }
  });
  data.rooms.forEach(r => {
    const id = uidR();
    const segs = (r.segs || []).map(s => sm[s]).filter(Boolean);
    if (r.cycle && r.cycle.every(c => sm[c.seg] && nm[c.from])) {
      state.rooms.push({
        id,
        name: r.name + " (copie)",
        cycle: r.cycle.map(c => ({
          seg: sm[c.seg],
          from: nm[c.from]
        })),
        poly: r.poly.map(p => ({
          x: p.x + dx,
          y: p.y + dy
        })),
        x0: r.x0 + dx,
        y0: r.y0 + dy,
        x1: r.x1 + dx,
        y1: r.y1 + dy,
        segs,
        auto: true
      });
      multi.add(mk("room", id));
      return;
    }
    state.rooms.push({
      id,
      name: r.name + " (copie)",
      x0: +(r.x0 + dx).toFixed(3),
      y0: +(r.y0 + dy).toFixed(3),
      x1: +(r.x1 + dx).toFixed(3),
      y1: +(r.y1 + dy).toFixed(3),
      segs
    });
    multi.add(mk("room", id));
  });
  data.apps.forEach(a => {
    const id = uidA();
    am[a.id] = id;
    const na = {
      ...a,
      id,
      x: +(a.x + dx).toFixed(2),
      y: +(a.y + dy).toFixed(2)
    };
    if (na.seg) na.seg = sm[na.seg];
    if (!na.seg) {
      delete na.seg;
      delete na.wa;
    }
    state.app.push(na);
    multi.add(mk("app", id));
  });
  data.lia.forEach(l => {
    if (am[l.c] && am[l.l]) state.lia.push({
      c: am[l.c],
      l: am[l.l]
    });
  });
  data.dims.forEach(d => {
    const id = uidD();
    state.dims.push({
      id,
      a: {
        x: d.a.x + dx,
        y: d.a.y + dy
      },
      b: {
        x: d.b.x + dx,
        y: d.b.y + dy
      }
    });
    multi.add(mk("dim", id));
  });
  normalizeSel();
}

export function duplicateGroup() {
  const G = currentGroup();
  if (groupEmpty(G)) return;
  snapshot();
  instantiateGroup(serializeGroup(G), 0.5, 0.5);
  markDirty();
  draw();
  showSide();
}

export function deleteGroup(G) {
  snapshot();
  const segKill = new Set(state.segs.filter(s => G.nodes.has(s.a) || G.nodes.has(s.b)).map(s => s.id));
  state.openings = state.openings.filter(o => !G.opens.has(o.id) && !segKill.has(o.seg));
  state.segs = state.segs.filter(s => !segKill.has(s.id));
  state.nodes = state.nodes.filter(n => !G.nodes.has(n.id));
  cleanNodes();
  state.rooms = state.rooms.filter(r => !G.rooms.has(r.id));
  state.app = state.app.filter(a => !G.apps.has(a.id));
  state.lia = state.lia.filter(l => !G.apps.has(l.c) && !G.apps.has(l.l));
  state.dims = state.dims.filter(d => !G.dims.has(d.id));
  clearSel();
  markDirty();
  draw();
  showSide();
}

export function selectAll() {
  multi.clear();
  K.sel = null;
  if (layers.appareils.on && !layers.appareils.lock) state.app.forEach(a => multi.add(mk("app", a.id)));
  if (layers.murs.on && !layers.murs.lock) state.nodes.forEach(n => multi.add(mk("node", n.id)));
  if (layers.pieces.on && !layers.pieces.lock) state.rooms.forEach(r => multi.add(mk("room", r.id)));
  if (layers.cotes.on && !layers.cotes.lock) state.dims.forEach(d => multi.add(mk("dim", d.id)));
  normalizeSel();
  draw();
  showSide();
}

export function segInter(p1, p2, p3, p4) {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (Math.abs(d) < 1e-12) return false;
  const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d,
    u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

export function segRectHit(a, b, x0, y0, x1, y1) {
  const ins = p => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
  if (ins(a) || ins(b)) return true;
  const E = [[{
    x: x0,
    y: y0
  }, {
    x: x1,
    y: y0
  }], [{
    x: x1,
    y: y0
  }, {
    x: x1,
    y: y1
  }], [{
    x: x1,
    y: y1
  }, {
    x: x0,
    y: y1
  }], [{
    x: x0,
    y: y1
  }, {
    x: x0,
    y: y0
  }]];
  return E.some(([p, q]) => segInter(a, b, p, q));
}
// cadre : de gauche à droite = objets entièrement dedans ; de droite à gauche = objets touchés

// cadre : de gauche à droite = objets entièrement dedans ; de droite à gauche = objets touchés
export function marqueeSelect(m) {
  const x0 = Math.min(m.x0, m.x1),
    x1 = Math.max(m.x0, m.x1),
    y0 = Math.min(m.y0, m.y1),
    y1 = Math.max(m.y0, m.y1),
    crossing = m.x1 < m.x0;
  const inside = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  if (!m.shift) {
    multi.clear();
    K.sel = null;
  } else if (K.sel) {
    addKey(K.sel);
    K.sel = null;
  }
  const add = (k, id) => multi.add(mk(k, id));
  if (layers.appareils.on && !layers.appareils.lock) state.app.forEach(a => {
    if (inside(a.x, a.y)) add("app", a.id);
  });
  if (layers.murs.on && !layers.murs.lock) {
    state.nodes.forEach(n => {
      if (inside(n.x, n.y)) add("node", n.id);
    });
    if (crossing) state.segs.forEach(s => {
      const a = nodeById(s.a),
        b = nodeById(s.b);
      if (a && b && segRectHit(a, b, x0, y0, x1, y1)) {
        add("node", s.a);
        add("node", s.b);
      }
    });
  }
  if (layers.pieces.on && !layers.pieces.lock) state.rooms.forEach(r => {
    const rx0 = Math.min(r.x0, r.x1),
      rx1 = Math.max(r.x0, r.x1),
      ry0 = Math.min(r.y0, r.y1),
      ry1 = Math.max(r.y0, r.y1);
    const full = rx0 >= x0 && rx1 <= x1 && ry0 >= y0 && ry1 <= y1,
      over = rx0 <= x1 && rx1 >= x0 && ry0 <= y1 && ry1 >= y0;
    if (crossing ? over : full) add("room", r.id);
  });
  if (layers.cotes.on && !layers.cotes.lock) state.dims.forEach(d => {
    const ia = inside(d.a.x, d.a.y),
      ib = inside(d.b.x, d.b.y);
    if (crossing ? ia || ib : ia && ib) add("dim", d.id);
  });
  if (layers.ouvertures.on && !layers.ouvertures.lock) state.openings.forEach(o => {
    const c = openCenter(o.id);
    if (c && inside(c.x, c.y)) add("open", o.id);
  });
  normalizeSel();
}

export function resizeRoom(r, nw, nh) {
  const X0 = Math.min(r.x0, r.x1),
    X1 = Math.max(r.x0, r.x1),
    Y0 = Math.min(r.y0, r.y1),
    Y1 = Math.max(r.y0, r.y1);
  const own = new Set();
  (r.segs || []).forEach(sid => {
    const s = segById(sid);
    if (s) {
      own.add(s.a);
      own.add(s.b);
    }
  });
  own.forEach(id => {
    const n = nodeById(id);
    if (!n) return;
    if (nw != null && Math.abs(n.x - X1) < 0.01) n.x = +(X0 + nw).toFixed(3);
    if (nh != null && Math.abs(n.y - Y1) < 0.01) n.y = +(Y0 + nh).toFixed(3);
  });
  r.x0 = X0;
  r.y0 = Y0;
  if (nw != null) r.x1 = +(X0 + nw).toFixed(3);else r.x1 = X1;
  if (nh != null) r.y1 = +(Y0 + nh).toFixed(3);else r.y1 = Y1;
  clampOpenings();
}

// ---------- mesure sur mur (distance à l'angle) ----------

// initialisation (étape 4 du démarrage)
export function init4() {
// clés "kind:id"
K.marquee = null;
// cadre de sélection en cours
K.seriesMode = null;
K.seriesPrev = null;
K.seriesN = 3;
K.ghost = null;
}

