// Oktéo AI — cœur : Niveaux (RDC, R+1…), liaisons entre niveaux, géométrie pour l'impression.
// Module issu du découpage de app.js (v26). L'état partagé est dans K (core/k.js).
import { K } from "./k.js";
import * as CHS from "../chantiers.js";
import { labelPoint } from "../walls/rooms.js";
import { CH, LKEYS, TYPES, dist, epOf, nodeById, segById, segDir, state, symScaleOf } from "./model.js";
import { markDirty, snapshot } from "./persist.js";
import { fit, repMap } from "./view.js";
import { draw, wallIntervals } from "./render.js";
import { followWalls, roomArea, roomPoly } from "./attach.js";
import { clearSel, roomAt } from "./groups.js";
import { showSide } from "./panel.js";
import { resetTransient, setHint } from "./controls.js";

// ---------- niveaux ----------
export function loadFondImage(refit) {
  const my = ++K.fondSeq;
  if (K.FOND && K.FOND.startsWith("blob:")) URL.revokeObjectURL(K.FOND);
  K.FOND = CH.fond && CH.fond.src === "asset" ? CH.fond.url : "";
  K.BG = CH.fond ? {
    x: CH.fond.x,
    y: CH.fond.y,
    w: CH.fond.w,
    h: CH.fond.h
  } : {
    x: 0,
    y: 0,
    w: 0,
    h: 0
  };
  if (CH.fond && CH.fond.src === "idb") CHS.getFile(CHS.fondKey(CH)).then(bl => {
    if (!bl || my !== K.fondSeq) return;
    K.FOND = URL.createObjectURL(bl);
    if (refit) fit();else draw();
    document.dispatchEvent(new CustomEvent("okteo:fond"));
  }).catch(() => {});else document.dispatchEvent(new CustomEvent("okteo:fond"));
}
// le fond du niveau ouvert devient CH.fond (copie gardée dans la liste des chantiers)

// le fond du niveau ouvert devient CH.fond (copie gardée dans la liste des chantiers)
export function applyLevelFond() {
  Object.assign(CH, CHS.update(CH.id, {
    level: K.LV.cur
  }) || {});
  CH.levels = CHS.levelsOf(CH);
  const L = CH.levels.find(l => l.id === K.LV.cur);
  CH.level = K.LV.cur;
  CH.fond = L ? L.fond || null : null;
  loadFondImage(false);
  document.dispatchEvent(new CustomEvent("okteo:level", {
    detail: {
      id: K.LV.cur
    }
  }));
}

export function stashLevel() {
  K.LV.data[K.LV.cur] = Object.fromEntries(LKEYS.map(k => [k, state[k]]));
}

export function switchLevel(id) {
  if (id === K.LV.cur || !CH.levels.some(l => l.id === id)) return false;
  // outil Liaison en cours : on garde la commande choisie pour la relier à une lumière de l'autre niveau
  const carry = K.tool === "lien" && K.sel && K.sel.kind === "link" ? {
    kind: "link",
    id: K.sel.id,
    lv: K.sel.lv || K.LV.cur,
    rep: K.sel.rep || repMap()[K.sel.id]
  } : null;
  snapshot();
  resetTransient();
  clearSel();
  stashLevel();
  const d = K.LV.data[id] || {};
  LKEYS.forEach(k => state[k] = d[k] || []);
  delete K.LV.data[id];
  K.LV.cur = id;
  applyLevelFond();
  markDirty();
  fit();
  if (carry) {
    K.sel = carry;
    draw();
    setHint(`Liaison depuis ${carry.rep} (${levelName(carry.lv)}) : cliquez la ou les lumières de ce niveau. Échap pour terminer.`);
  } else setHint(`Niveau « ${levelName()} ». Page ↑ / Page ↓ pour changer de niveau.`);
  showSide();
  return true;
}
// toutes les liaisons, tous niveaux, et où se trouve chaque appareil

// toutes les liaisons, tous niveaux, et où se trouve chaque appareil
export function allLinks() {
  return [state.lia, ...Object.entries(K.LV.data).filter(([id]) => id !== K.LV.cur).map(([, d]) => d.lia || [])].flat();
}

export function appIndex() {
  const m = new Map();
  state.app.forEach(a => m.set(a.id, {
    lv: K.LV.cur,
    a
  }));
  for (const [id, d] of Object.entries(K.LV.data)) if (id !== K.LV.cur) (d.app || []).forEach(a => m.set(a.id, {
    lv: id,
    a
  }));
  return m;
}
// repère d'un appareil d'un autre niveau (numérotation propre à chaque niveau)

// repère d'un appareil d'un autre niveau (numérotation propre à chaque niveau)
export function repOn(lv, id) {
  const r = repMap()[id];
  if (r) return r;
  const d = K.LV.data[lv];
  const a = d && (d.app || []).find(x => x.id === id);
  return a && a.rf && a.n ? a.rf + a.n : a ? TYPES[a.t].r : "?";
}
// liaisons qui partent de ce niveau vers un autre (ou qui en arrivent) : {id (appareil d'ici), txt}

// liaisons qui partent de ce niveau vers un autre (ou qui en arrivent) : {id (appareil d'ici), txt}
export function crossLinks() {
  const idx = appIndex(),
    out = [];
  for (const l of allLinks()) {
    const c = idx.get(l.c),
      m = idx.get(l.l);
    if (!c || !m || c.lv === m.lv) continue;
    // txt : à l'écran ; word : à l'impression (les flèches n'existent pas dans les polices PDF standard)
    if (c.lv === K.LV.cur) out.push({
      id: l.c,
      txt: `→ ${repOn(m.lv, l.l)} ${levelName(m.lv)}`,
      word: `commande ${repOn(m.lv, l.l)} (${levelName(m.lv)})`
    });
    if (m.lv === K.LV.cur) out.push({
      id: l.l,
      txt: `← ${repOn(c.lv, l.c)} ${levelName(c.lv)}`,
      word: `commandé par ${repOn(c.lv, l.c)} (${levelName(c.lv)})`
    });
  }
  return out;
}

export function levelName(id = K.LV.cur) {
  return (CH.levels.find(l => l.id === id) || {}).name || id;
}
// liste des niveaux telle qu'enregistrée (le fond du niveau ouvert a pu changer : mise à l'échelle…)

// liste des niveaux telle qu'enregistrée (le fond du niveau ouvert a pu changer : mise à l'échelle…)
export function levelsNow() {
  return CHS.levelsOf(CHS.get(CH.id) || CH);
}

export function saveLevels(levels) {
  Object.assign(CH, CHS.update(CH.id, {
    levels
  }) || {});
  CH.levels = CHS.levelsOf(CH);
  document.dispatchEvent(new CustomEvent("okteo:level", {
    detail: {
      id: K.LV.cur
    }
  }));
}
// niveau juste en dessous (dans l'ordre de la liste) : affiché en transparence pour caler les murs

// niveau juste en dessous (dans l'ordre de la liste) : affiché en transparence pour caler les murs
export function belowData() {
  const i = CH.levels.findIndex(l => l.id === K.LV.cur);
  if (i <= 0) return null;
  return K.LV.data[CH.levels[i - 1].id] || null;
}
// nouveau niveau ; withWalls : reprend les murs épais (extérieurs) du niveau ouvert

// nouveau niveau ; withWalls : reprend les murs épais (extérieurs) du niveau ouvert
export function addLevel(name, {
  withWalls = false
} = {}) {
  const id = "l" + Date.now().toString(36);
  const lv = [...levelsNow(), {
    id,
    name: String(name || "Niveau").slice(0, 24),
    fond: null
  }];
  const copy = withWalls ? (() => {
    const max = Math.max(0, ...state.segs.filter(s => !s.virt).map(epOf));
    const keep = state.segs.filter(s => !s.virt && epOf(s) >= max * 0.8);
    const nm = {},
      nodes = [],
      segs = [];
    keep.forEach(s => [s.a, s.b].forEach(n => {
      if (!nm[n]) {
        const o = nodeById(n);
        nm[n] = "n" + ++K.NID;
        nodes.push({
          id: nm[n],
          x: o.x,
          y: o.y
        });
      }
    }));
    keep.forEach(s => segs.push({
      id: "s" + ++K.SID,
      a: nm[s.a],
      b: nm[s.b],
      ep: s.ep
    }));
    return {
      nodes,
      segs
    };
  })() : null;
  snapshot();
  saveLevels(lv);
  if (copy) K.LV.data[id] = {
    ...copy
  };
  // le nouveau niveau reprend la position et l'échelle du fond du niveau ouvert si on lui donne une autre page du même PDF
  K.batching = true;
  try {
    switchLevel(id);
  } finally {
    K.batching = false;
  }
  return id;
}

export function renameLevel(id, name) {
  const n = String(name || "").trim().slice(0, 24);
  if (!n) return false;
  saveLevels(levelsNow().map(l => l.id === id ? {
    ...l,
    name: n
  } : l));
  markDirty();
  return true;
}

export function removeLevel(id) {
  if (CH.levels.length < 2) return false;
  const i = CH.levels.findIndex(l => l.id === id);
  if (i < 0) return false;
  snapshot();
  if (id === K.LV.cur) {
    K.batching = true;
    try {
      switchLevel(CH.levels[i ? i - 1 : 1].id);
    } finally {
      K.batching = false;
    }
  }
  // les fichiers et la fiche du fond restent de côté : Ctrl+Z peut rendre le niveau avec son plan
  const gone = levelsNow().find(l => l.id === id);
  CHS.update(CH.id, {
    levelsTrash: {
      ...((CHS.get(CH.id) || {}).levelsTrash || {}),
      [id]: gone
    }
  });
  delete K.LV.data[id];
  saveLevels(levelsNow().filter(l => l.id !== id));
  markDirty();
  draw();
  showSide();
  return true;
}

// géométrie d'impression du niveau ouvert (ou d'un autre via withLevel)

// géométrie d'impression du niveau ouvert (ou d'un autre via withLevel)
export function okteoGeo() {
  followWalls();
  const walls = [],
    joints = [],
    openings = [],
    wallDims = [];
  const limits = [];
  state.segs.forEach(seg => {
    const d = segDir(seg);
    if (!d.a || !d.L) return;
    if (seg.virt) {
      limits.push({
        a: {
          x: d.a.x,
          y: d.a.y
        },
        b: {
          x: d.b.x,
          y: d.b.y
        }
      });
      return;
    }
    const e = epOf(seg),
      e2 = e / 2,
      nx = -d.uy * e2,
      ny = d.ux * e2;
    wallIntervals(seg).forEach(([s0, s1]) => {
      const ax = d.a.x + d.ux * s0,
        ay = d.a.y + d.uy * s0,
        bx = d.a.x + d.ux * s1,
        by = d.a.y + d.uy * s1;
      walls.push([{
        x: ax + nx,
        y: ay + ny
      }, {
        x: bx + nx,
        y: by + ny
      }, {
        x: bx - nx,
        y: by - ny
      }, {
        x: ax - nx,
        y: ay - ny
      }]);
    });
    wallDims.push({
      x: (d.a.x + d.b.x) / 2 - d.uy * (e2 + 0.22),
      y: (d.a.y + d.b.y) / 2 + d.ux * (e2 + 0.22),
      L: d.L,
      ang: Math.atan2(d.uy, d.ux)
    });
  });
  state.nodes.forEach(n => {
    let e = 0;
    state.segs.forEach(s => {
      if (s.a === n.id || s.b === n.id) e = Math.max(e, epOf(s));
    });
    if (e > 0) joints.push({
      x: n.x,
      y: n.y,
      e
    });
  });
  state.openings.forEach(o => {
    const seg = segById(o.seg);
    if (!seg) return;
    const d = segDir(seg);
    if (!d.a) return;
    const ep = epOf(seg),
      nx = -d.uy,
      ny = d.ux,
      hw = o.w / 2;
    const cx = d.a.x + d.ux * o.t,
      cy = d.a.y + d.uy * o.t,
      j1 = {
        x: cx - d.ux * hw,
        y: cy - d.uy * hw
      },
      j2 = {
        x: cx + d.ux * hw,
        y: cy + d.uy * hw
      };
    const O = {
      kind: o.kind,
      j1,
      j2,
      n: {
        x: nx,
        y: ny
      },
      ep,
      w: o.w
    };
    if (o.kind !== "fenetre") {
      const sdir = o.swing === "ext" ? 1 : -1,
        H = o.hinge === "d" ? j2 : j1,
        F = o.hinge === "d" ? j1 : j2,
        Lp = {
          x: H.x + nx * sdir * o.w,
          y: H.y + ny * sdir * o.w
        };
      let a0 = Math.atan2(Lp.y - H.y, Lp.x - H.x),
        a1 = Math.atan2(F.y - H.y, F.x - H.x),
        da = a1 - a0;
      while (da > Math.PI) da -= 2 * Math.PI;
      while (da < -Math.PI) da += 2 * Math.PI;
      O.hinge = H;
      O.leaf = Lp;
      O.arc = Array.from({
        length: 13
      }, (_, i) => ({
        x: H.x + Math.cos(a0 + da * i / 12) * o.w,
        y: H.y + Math.sin(a0 + da * i / 12) * o.w
      }));
    }
    openings.push(O);
  });
  const rooms = state.rooms.map(r => {
    const P = roomPoly(r);
    return {
      name: r.name,
      poly: P,
      area: roomArea(r),
      label: r.poly ? labelPoint(r.poly) : {
        x: (r.x0 + r.x1) / 2,
        y: (r.y0 + r.y1) / 2
      }
    };
  });
  const reps = repMap();
  const xl = {};
  crossLinks().forEach(x => {
    xl[x.id] = (xl[x.id] ? xl[x.id] + ' · ' : '') + x.word;
  });
  const apps = state.app.map(a => ({
    id: a.id,
    t: a.t,
    x: a.x,
    y: a.y,
    h: a.h,
    hDef: TYPES[a.t].h,
    rep: reps[a.id],
    name: TYPES[a.t].n,
    room: (roomAt(a.x, a.y) || {}).name || null,
    xlink: xl[a.id] || null
  }));
  const byId = Object.fromEntries(state.app.map(a => [a.id, a]));
  const links = state.lia.map(l => byId[l.c] && byId[l.l] && {
    a: {
      x: byId[l.c].x,
      y: byId[l.c].y
    },
    b: {
      x: byId[l.l].x,
      y: byId[l.l].y
    }
  }).filter(Boolean);
  const dims = state.dims.map(d => ({
    a: {
      ...d.a
    },
    b: {
      ...d.b
    },
    L: dist(d.a.x, d.a.y, d.b.x, d.b.y)
  }));
  return {
    walls,
    joints,
    openings,
    wallDims,
    limits,
    rooms,
    apps,
    links,
    dims,
    symU: symScaleOf(),
    fond: K.FOND && K.BG.w > 0 ? {
      url: K.FOND,
      x: K.BG.x,
      y: K.BG.y,
      w: K.BG.w,
      h: K.BG.h
    } : null,
    chantier: {
      nom: CH.nom,
      numero: CH.numero || "",
      client: CH.client || ""
    },
    level: levelName(),
    levelId: K.LV.cur
  };
}
// exécute fn avec le niveau `id` chargé dans `state` (sans dessin, sans historique), puis remet le niveau ouvert

// exécute fn avec le niveau `id` chargé dans `state` (sans dessin, sans historique), puis remet le niveau ouvert
export function withLevel(id, fn) {
  const keep = {
    cur: K.LV.cur,
    arrays: Object.fromEntries(LKEYS.map(k => [k, state[k]])),
    BG: K.BG,
    FOND: K.FOND,
    sel: K.sel
  };
  const d = K.LV.data[id] || {};
  K.LV.data[K.LV.cur] = keep.arrays;
  LKEYS.forEach(k => state[k] = d[k] || []);
  delete K.LV.data[id];
  K.LV.cur = id;
  const L = CH.levels.find(l => l.id === id);
  K.BG = L && L.fond ? {
    x: L.fond.x,
    y: L.fond.y,
    w: L.fond.w,
    h: L.fond.h
  } : {
    x: 0,
    y: 0,
    w: 0,
    h: 0
  };
  K.FOND = "";
  K.sel = null;
  try {
    return fn();
  } finally {
    K.LV.data[id] = Object.fromEntries(LKEYS.map(k => [k, state[k]]));
    LKEYS.forEach(k => state[k] = keep.arrays[k]);
    delete K.LV.data[keep.cur];
    K.LV.cur = keep.cur;
    K.BG = keep.BG;
    K.FOND = keep.FOND;
    K.sel = keep.sel;
  }
}
// fond d'un niveau pour l'impression : {url, x, y, w, h} (image relue dans IndexedDB)

// fond d'un niveau pour l'impression : {url, x, y, w, h} (image relue dans IndexedDB)
export async function levelFondInfo(id) {
  if (id === K.LV.cur) return K.FOND && K.BG.w > 0 ? {
    url: K.FOND,
    x: K.BG.x,
    y: K.BG.y,
    w: K.BG.w,
    h: K.BG.h
  } : null;
  const L = levelsNow().find(l => l.id === id);
  if (!L || !L.fond || !(L.fond.w > 0)) return null;
  if (L.fond.src === "asset") return {
    url: L.fond.url,
    x: L.fond.x,
    y: L.fond.y,
    w: L.fond.w,
    h: L.fond.h
  };
  const bl = await CHS.getFile(CHS.fondKey(CH, id)).catch(() => null);
  return bl ? {
    url: URL.createObjectURL(bl),
    x: L.fond.x,
    y: L.fond.y,
    w: L.fond.w,
    h: L.fond.h
  } : null;
}

// ---------- interface publique (extensions : assistant, palette, paramètres ; tests) ----------

