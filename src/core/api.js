// Oktéo AI — cœur : Interface publique window.okteo (extensions, assistant, tests).
// Module issu du découpage de app.js (v26). L'état partagé est dans K (core/k.js).
import { K } from "./k.js";
import { addLimit } from "../walls/rooms.js";
import { CH, PAL, PLAN, TYPES, VB, layers, node, nodeById, segById, state, uidA, uidN, uidO, uidR, uidS } from "./model.js";
import { markDirty, packData, snapshot, writeNow } from "./persist.js";
import { fit, renumberReps, repMap, rotExtent, rotateView, syncVB } from "./view.js";
import { draw, drawFx, gaineCrossings, sv } from "./render.js";
import { attach, reattach, roomArea, roomPoly, snapToWall, wallMounted } from "./attach.js";
import { bbox, clampOpenings, clearSel, duplicateGroup, multi, normalizeSel, openCenter, roomAt, selectAll, transformGroup } from "./groups.js";
import { wallMeasure } from "./interact.js";
import { worldToScreen } from "./hud.js";
import { delSel, showSide } from "./panel.js";
import { VIEW_PRESETS, applyCalib, applyRatio, buildFilter, buildTools, hintFor, resetTransient, setHint, setRoomTxt, setTab, toggleView, viewPreset } from "./controls.js";
import { addLevel, allLinks, appIndex, levelFondInfo, levelName, loadFondImage, okteoGeo, removeLevel, renameLevel, switchLevel, withLevel } from "./levels.js";
import { CIRC_COLORS } from "./render.js";
import { CHECK_KINDS, essai, essaiPress, essaiReset, litSet, setBreaker, testAll } from "./check.js";

// ---------- interface publique (extensions : assistant, palette, paramètres ; tests) ----------
export function zoomToBox(x0, y0, x1, y1) {
  syncVB();
  const pad = 0.8,
    w = Math.max(1.5, x1 - x0),
    h = Math.max(1.5, y1 - y0);
  const E = rotExtent(w + pad * 2, h + pad * 2);
  K.view.scale = Math.min(90, Math.min(VB.w / E.w, VB.h / E.h));
  K.view.cx = (x0 + x1) / 2;
  K.view.cy = (y0 + y1) / 2;
  draw();
}

export function objBox(id) {
  const k = String(id)[0];
  if (k === "a") {
    const a = state.app.find(x => x.id === id);
    return a && {
      kind: "app",
      x0: a.x,
      y0: a.y,
      x1: a.x,
      y1: a.y
    };
  }
  if (k === "r") {
    const r = state.rooms.find(x => x.id === id);
    return r && {
      kind: "room",
      x0: Math.min(r.x0, r.x1),
      y0: Math.min(r.y0, r.y1),
      x1: Math.max(r.x0, r.x1),
      y1: Math.max(r.y0, r.y1)
    };
  }
  if (k === "s") {
    const s = segById(id);
    if (!s) return null;
    const a = nodeById(s.a),
      b = nodeById(s.b);
    return a && b && {
      kind: "seg",
      x0: Math.min(a.x, b.x),
      y0: Math.min(a.y, b.y),
      x1: Math.max(a.x, b.x),
      y1: Math.max(a.y, b.y)
    };
  }
  if (k === "o") {
    const c = openCenter(id);
    return c && {
      kind: "open",
      x0: c.x,
      y0: c.y,
      x1: c.x,
      y1: c.y
    };
  }
  if (k === "d") {
    const d = state.dims.find(x => x.id === id);
    return d && {
      kind: "dim",
      x0: Math.min(d.a.x, d.b.x),
      y0: Math.min(d.a.y, d.b.y),
      x1: Math.max(d.a.x, d.b.x),
      y1: Math.max(d.a.y, d.b.y)
    };
  }
  if (k === "n") {
    const n = nodeById(id);
    return n && {
      kind: "node",
      x0: n.x,
      y0: n.y,
      x1: n.x,
      y1: n.y
    };
  }
  return null;
}

// initialisation (étape 7 du démarrage)
export function init7() {
window.okteo = {
  state,
  TYPES,
  PAL,
  layers,
  sv,
  get BG() {
    return K.BG;
  },
  get FOND() {
    return K.FOND;
  },
  ch: CH,
  get levels() {
    return CH.levels.map(l => ({
      id: l.id,
      name: l.name,
      fond: !!l.fond,
      current: l.id === K.LV.cur
    }));
  },
  get level() {
    return {
      id: K.LV.cur,
      name: levelName()
    };
  },
  switchLevel,
  // ---------- câblage (v28) ----------
  get cab() {
    return K.CAB;
  },
  circuitColors: CIRC_COLORS,
  // remplace la liste des circuits (un seul Ctrl+Z)
  setCircuits(list) {
    snapshot();
    K.CAB = {
      ...K.CAB,
      circuits: list
    };
    markDirty();
    draw();
    showSide();
    document.dispatchEvent(new CustomEvent("okteo:cab"));
  },
  // boîtes de pieuvre [{id, n, lv, x, y, apps}] (un seul Ctrl+Z)
  setBoxes(list) {
    snapshot();
    K.CAB = {
      ...K.CAB,
      boxes: list
    };
    markDirty();
    draw();
    showSide();
    document.dispatchEvent(new CustomEvent("okteo:cab"));
  },
  // circuits et boîtes d'un coup (un seul Ctrl+Z)
  setCab(patch) {
    snapshot();
    K.CAB = {
      ...K.CAB,
      ...patch
    };
    markDirty();
    draw();
    showSide();
    document.dispatchEvent(new CustomEvent("okteo:cab"));
  },
  get boxSel() {
    return K.boxSel;
  },
  set boxSel(id) {
    K.boxSel = id;
    draw();
  },
  get showCircuits() {
    return K.showCirc;
  },
  set showCircuits(v) {
    K.showCirc = !!v;
    draw();
    buildFilter();
  },
  // filtre rapide de la vue (v37) : vues toutes prêtes ("bati", "impl", "cab") et un élément à la fois
  viewPreset(id) {
    return viewPreset(id);
  },
  toggleView(k, v) {
    return toggleView(k, v);
  },
  viewPresets: VIEW_PRESETS,
  // tous les appareils de tous les niveaux, avec leur pièce et leur repère
  allApps() {
    const one = (lv) => state.app.map(a => ({
      id: a.id,
      t: a.t,
      x: a.x,
      y: a.y,
      h: a.h,
      lv,
      lvName: levelName(lv),
      room: (roomAt(a.x, a.y) || {}).name || null,
      rep: repMap()[a.id],
      // v54 : variante de raccordement, raccordement (hotte : celui de l'appareil, sinon le choix du chantier), puissance
      ...(a.var ? { var: a.var } : {}),
      ...(a.t === "HOTTE" ? { racc: a.racc || (K.CAB.choix || {}).raccordement || "a_choisir" } : {}),
      ...(a.p != null ? { p: a.p } : {}),
      // v56 (R-098) : prise de plan de travail choisie à la main (true / false) ; absent = reconnue automatiquement
      ...(a.pt === true || a.pt === false ? { pt: a.pt } : {}),
      // v57 : équipement hors plan (ajouté d'après le devis, à vérifier) ; point que l'IA n'a pas trouvé en relecture
      ...(a.hp ? { hp: true } : {}),
      ...(a.aiNo ? { aiNo: a.aiNo } : {}),
      ...(a.hNo ? { hNo: true } : {})
    }));
    const out = [];
    for (const l of CH.levels) out.push(...(l.id === K.LV.cur ? one(l.id) : withLevel(l.id, () => one(l.id))));
    return out;
  },
  allLinks() {
    return allLinks().map(l => ({
      c: l.c,
      l: l.l
    }));
  },
  addLevel,
  renameLevel,
  removeLevel,
  reloadFond() {
    loadFondImage(true);
  },
  chantier: CH.nom + (CH.numero ? " · " + CH.numero : ""),
  chantierKey: CH.id === "evrard-04949" ? "evrard.04949" : CH.id,
  startCalib() {
    resetTransient();
    clearSel();
    K.tool = "calib";
    K.testMode = false;
    if (K.tab !== "plan") setTab("plan");
    buildTools();
    setHint(hintFor("calib"));
    draw();
    showSide();
    document.dispatchEvent(new CustomEvent("okteo:ask"));   // panneau Propriétés : saisie de l'échelle (1/50) visible
  },
  applyScaleRatio(N) {
    return applyRatio(N);
  },
  applyCalib(a, b, L) {
    K.calib = {
      a,
      b,
      cur: null
    };
    return applyCalib(L);
  },
  setPreview(p) {
    K.preview = p || null;
    draw();
  },
  // v56 : appareils regroupés par gaine (calcul des gaines) : { boxId: { appId: 1er appareil de la gaine } }, pour que les
  // points d'accroche du plan suivent les gaines calculées ; redessin seulement si le découpage change
  setGaineGroups(m) {
    const sig = JSON.stringify(m || {});
    if (sig === K.gaineGroupsSig) return;
    K.gaineGroupsSig = sig;
    K.gaineGroups = m || {};
    draw();
  },
  // doutes du câblage affichés sur le plan (v53) : [{key, x, y, lv, bloquant, text}]
  setDoubts(list) {
    K.doubts = Array.isArray(list) ? list : [];
    drawFx();
  },
  get doubts() {
    return K.doubts || [];
  },
  roomArea,
  roomPoly,
  // tout ce qu'il faut pour imprimer le plan (en mètres) : murs découpés aux ouvertures, portes avec leur arc,
  // pièces (contour, surface), appareils (repère, pièce), liaisons, cotes, fond
  exportGeometry(lvId) {
    if (lvId && lvId !== K.LV.cur && CH.levels.some(l => l.id === lvId)) return withLevel(lvId, () => okteoGeo());
    return okteoGeo();
  },
  levelFond: levelFondInfo,
  allLevelsGeometry() {
    return CH.levels.map(l => window.okteo.exportGeometry(l.id));
  },
  // ajoute des pièces détectées ({name, cycle, poly, also}) ; replace = retire d'abord toutes les pièces existantes
  addRooms(list, {
    replace = false
  } = {}) {
    snapshot();
    if (replace) state.rooms = [];
    for (const r of list) {
      const P = r.poly;
      state.rooms.push({
        id: uidR(),
        name: r.name,
        cycle: r.cycle,
        poly: P,
        also: r.also || [],
        auto: true,
        segs: [...new Set(r.cycle.map(c => c.seg))],
        x0: Math.min(...P.map(p => p.x)),
        x1: Math.max(...P.map(p => p.x)),
        y0: Math.min(...P.map(p => p.y)),
        y1: Math.max(...P.map(p => p.y))
      });
    }
    K.preview = null;
    resetTransient();
    clearSel();
    if (K.tab !== "plan") setTab("plan");
    markDirty();
    draw();
    showSide();
    return list.length;
  },
  // ajoute des appareils relevés ({t,x,y,h?}) et leurs liaisons ({c,l} = indices dans list) : un seul pas d'annulation.
  // Les appareils muraux se collent au mur le plus proche (≤ 60 cm) et restent attachés à leur distance de l'angle.
  importDevices(list, links = [], {
    replace = false
  } = {}) {
    snapshot();
    if (replace) {
      state.app = [];
      state.lia = [];
    }
    const ids = list.map(d => {
      if (!TYPES[d.t]) return null;
      const p = wallMounted(d.t) ? snapToWall(d.x, d.y) || {
        x: d.x,
        y: d.y
      } : {
        x: d.x,
        y: d.y
      };
      const na = {
        id: uidA(),
        t: d.t,
        x: +(+p.x).toFixed(3),
        y: +(+p.y).toFixed(3),
        h: d.h || TYPES[d.t].h,
        auto: true
      };
      if (d.pt) na.pt = true; // v57 : prise de plan de travail relevée
      if (d.hp) na.hp = true; // v57 : équipement hors plan (à vérifier avec le devis)
      if (d.hNo) na.hNo = true; // v61 : hauteur non écrite sur le plan (relecture ciblée)
      if (p.seg) {
        na.seg = p.seg;
        attach(na);
      }
      state.app.push(na);
      return na.id;
    });
    let nl = 0;
    // un bout de liaison = indice dans la liste, ou id d'un appareil déjà posé (v40 : packs)
    const idOf = v => typeof v === "string" ? state.app.some(a => a.id === v) ? v : null : ids[v];
    links.forEach(l => {
      const c = idOf(l.c),
        lm = idOf(l.l);
      if (c && lm && !state.lia.some(x => x.c === c && x.l === lm)) {
        state.lia.push({
          c,
          l: lm
        });
        nl++;
      }
    });
    K.preview = null;
    resetTransient();
    clearSel();
    K.tool = "sel";
    K.testMode = false;
    if (K.tab !== "plan") setTab("plan");
    buildTools();
    markDirty();
    draw();
    showSide();
    return {
      appareils: ids.filter(Boolean).length,
      muraux: state.app.filter(a => ids.includes(a.id) && a.seg).length,
      liaisons: nl,
      ids
    };
  },
  // v59 : croisements de gaines qui restent sur le niveau ouvert
  gaineCrossings() {
    return gaineCrossings();
  },
  // v61 : murs ajoutés par la relecture IA : [{a:{x,y}, b:{x,y}, ep}] ; chaque bout se colle à un sommet (≤ 0,3 m) ou
  // coupe le mur touché (jonction en T, ouvertures gardées sur le bon morceau). Renvoie le nombre de murs ajoutés.
  addWalls(list = []) {
    snapshot();
    const near = 0.3;
    const at = (p) => {
      let best = null;
      for (const n of state.nodes) { const d = Math.hypot(n.x - p.x, n.y - p.y); if (d <= near && (!best || d < best.d)) best = { d, n }; }
      if (best) return best.n.id;
      // sur un mur : coupe en T
      for (const sg of state.segs) {
        if (sg.virt) continue;
        const A = nodeById(sg.a), B = nodeById(sg.b);
        if (!A || !B) continue;
        const L = Math.hypot(B.x - A.x, B.y - A.y), ux = (B.x - A.x) / L, uy = (B.y - A.y) / L, t = (p.x - A.x) * ux + (p.y - A.y) * uy;
        if (t < near || t > L - near || Math.abs((p.x - A.x) * -uy + (p.y - A.y) * ux) > near) continue;
        const k = node(A.x + ux * t, A.y + uy * t), s2 = { ...sg, id: uidS(), a: k.id, b: sg.b };
        delete s2.virt;
        sg.b = k.id;
        state.segs.push(s2);
        state.openings.filter((o) => o.seg === sg.id && o.t > t).forEach((o) => { o.seg = s2.id; o.t = +(o.t - t).toFixed(3); });
        state.app.filter((ap) => ap.seg === sg.id).forEach((ap) => reattach(ap));
        return k.id;
      }
      return node(p.x, p.y).id;
    };
    let n = 0;
    for (const w of list) {
      if (!w || !w.a || !w.b || Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y) < 0.2) continue;
      const a = at(w.a), b = at(w.b);
      if (a === b || state.segs.some((sg) => (sg.a === a && sg.b === b) || (sg.a === b && sg.b === a))) continue;
      state.segs.push({ id: uidS(), a, b, ...(w.ep ? { ep: +w.ep.toFixed(3) } : {}) });
      n++;
    }
    clampOpenings();
    markDirty();
    draw();
    showSide();
    return n;
  },
  // v61 : ouvertures du niveau ouvert, avec repère O1, O2… (relecture ciblée) : centre, largeur, type, marques
  openingsInfo() {
    return state.openings.map((o, i) => {
      const sg = segById(o.seg), A = sg && nodeById(sg.a), B = sg && nodeById(sg.b);
      if (!A || !B) return null;
      const L = Math.hypot(B.x - A.x, B.y - A.y) || 1;
      return { id: o.id, rep: "O" + (i + 1), kind: o.kind, w: o.w, x: A.x + (B.x - A.x) / L * o.t, y: A.y + (B.y - A.y) / L * o.t, adj: !!o.aiAdj, sens: !!o.aiSens || o.kind !== "porte" || !o.aiRel };
    }).filter(Boolean);
  },
  // v61 : corrections d'appareils (tous niveaux) : [{id, t?, x?, y?, h?, pt?}] ; un appareil mural déplacé se recolle à son mur
  updateApps(list = []) {
    const idx = appIndex();
    snapshot();
    let n = 0;
    for (const u of list) {
      const e = idx.get(u.id);
      if (!e) continue;
      const a = e.a;
      if (u.t && TYPES[u.t]) a.t = u.t;
      if (u.h != null && u.h > 0) { a.h = u.h; delete a.hNo; }
      if (u.pt === true || u.pt === false) a.pt = u.pt;
      if (u.x != null && u.y != null) {
        if (e.lv === K.LV.cur) { const p = wallMounted(a.t) ? snapToWall(u.x, u.y) : null; a.x = +(p ? p.x : u.x).toFixed(3); a.y = +(p ? p.y : u.y).toFixed(3); delete a.seg; delete a.wa; if (p && p.seg) { a.seg = p.seg; attach(a); } }
        else { a.x = u.x; a.y = u.y; }
      }
      n++;
    }
    markDirty();
    draw();
    showSide();
    return n;
  },
  // v61 : pose (ou replace) une ouverture sur le mur le plus proche du point {x, y} (≤ 0,6 m) ; g / v = montant des gonds
  // et point de l'arc (sens de la porte). Renvoie l'id, ou null s'il n'y a pas de mur assez près.
  placeOpening({ id = null, x, y, w = 0.9, kind = "porte", g = null, v = null } = {}) {
    let best = null;
    for (const sg of state.segs) {
      if (sg.virt) continue;
      const A = nodeById(sg.a), B = nodeById(sg.b);
      if (!A || !B) continue;
      const L = Math.hypot(B.x - A.x, B.y - A.y);
      if (L < 0.5) continue;
      const ux = (B.x - A.x) / L, uy = (B.y - A.y) / L, t = (x - A.x) * ux + (y - A.y) * uy, d = Math.abs((x - A.x) * -uy + (y - A.y) * ux);
      if (t < 0 || t > L || d > 0.6) continue;
      if (!best || d < best.d) best = { sg, A, B, L, t, d };
    }
    if (!best) return null;
    snapshot();
    const W = Math.min(Math.max(0.4, w), best.L - 0.1), t = Math.min(best.L - W / 2, Math.max(W / 2, best.t));
    let o = id ? state.openings.find((q) => q.id === id) : null;
    if (!o) { o = { id: uidO(), hinge: "g", swing: "int" }; state.openings.push(o); }
    Object.assign(o, { seg: best.sg.id, t: +t.toFixed(3), w: +W.toFixed(3), kind: ["porte", "fenetre", "garage"].includes(kind) ? kind : o.kind || "porte" });
    delete o.aiAdj;
    if (g || v) {
      const L = best.L, ux = (best.B.x - best.A.x) / L, uy = (best.B.y - best.A.y) / L;
      if (g) o.hinge = (g.x - best.A.x) * ux + (g.y - best.A.y) * uy > o.t ? "d" : "g";
      if (v) { const c = { x: best.A.x + ux * o.t, y: best.A.y + uy * o.t }; o.swing = (v.x - c.x) * -uy + (v.y - c.y) * ux > 0 ? "ext" : "int"; }
      o.aiSens = true;
    }
    clampOpenings();
    markDirty();
    draw();
    showSide();
    return o.id;
  },
  // v57 : marques d'un appareil (tous niveaux) : hp (hors plan), aiNo (introuvable pour l'IA, jamais redemandé), pt
  setAppFlags(id, patch = {}) {
    const e = appIndex().get(id);
    if (!e) return false;
    snapshot();
    for (const k of ["hp", "aiNo", "pt"]) if (k in patch) { if (patch[k] == null || patch[k] === false && k !== "pt") delete e.a[k]; else e.a[k] = patch[k]; }
    markDirty();
    draw();
    showSide();
    return true;
  },
  // v57 : supprime des appareils (tous niveaux) et leurs liaisons : un seul Ctrl+Z
  removeApps(ids = []) {
    const S = new Set(ids);
    snapshot();
    let n = 0;
    const one = (d) => { const k = (d.app || []).length; d.app = (d.app || []).filter(a => !S.has(a.id)); n += k - d.app.length; d.lia = (d.lia || []).filter(l => !S.has(l.c) && !S.has(l.l)); };
    one(state);
    for (const [id, d] of Object.entries(K.LV.data)) if (id !== K.LV.cur) one(d);
    clearSel();
    markDirty();
    draw();
    showSide();
    return n;
  },
  // plusieurs modifications = un seul pas d'annulation
  batch(fn) {
    snapshot();
    K.batching = true;
    try {
      return fn();
    } finally {
      K.batching = false;
    }
  },
  // limites de pièce [{a,b}] (points proches des axes de murs) : coupe les murs touchés et ajoute des murs virtuels
  addLimits(list) {
    snapshot();
    let n = 0;
    for (const l of list) {
      const r = addLimit(state.nodes, state.segs, l.a, l.b, {
        node: () => uidN(),
        seg: () => uidS()
      });
      if (!r) continue;
      n++;
      r.splits.forEach(sp => {
        state.openings.forEach(o => {
          if (o.seg === sp.seg && o.t > sp.at) {
            o.seg = sp.newSeg;
            o.t = +(o.t - sp.at).toFixed(3);
          }
        });
        state.app.forEach(a => {
          if (a.seg === sp.seg) reattach(a);
        });
      });
    }
    markDirty();
    draw();
    showSide();
    return n;
  },
  measure(appId) {
    const a = state.app.find(x => x.id === appId);
    if (!a || !a.seg) return null;
    const m = wallMeasure(a.seg, a.x, a.y);
    return m && {
      seg: a.seg,
      dA: +m.dA.toFixed(3),
      dB: +m.dB.toFixed(3),
      near: +Math.min(m.dA, m.dB).toFixed(3),
      side: m.side
    };
  },
  toClient(x, y) {
    const p = worldToScreen(x, y);
    const r = document.querySelector(".stage").getBoundingClientRect();
    return p && {
      x: p.x + r.left,
      y: p.y + r.top
    };
  },
  // ajoute au dessin le résultat d'un relevé automatique (un seul pas d'annulation)
  importWalls(r, {
    replace = false
  } = {}) {
    snapshot();
    if (replace) {
      state.openings = [];
      state.segs = [];
      state.nodes = [];
      state.rooms.forEach(rm => rm.segs = []);
      state.app.forEach(a => {
        delete a.seg;
      });
    }
    const ids = r.nodes.map(n => node(n.x, n.y).id);
    const sids = r.walls.map(w => {
      const id = uidS();
      state.segs.push({
        id,
        a: ids[w.a],
        b: ids[w.b],
        ep: w.ep
      });
      return id;
    });
    r.openings.forEach(o => state.openings.push({
      id: uidO(),
      seg: sids[o.seg],
      t: o.t,
      w: o.w,
      kind: o.kind,
      hinge: o.hinge === "d" ? "d" : "g",   // v57 : gond et sens relevés par l'IA
      swing: o.swing === "ext" ? "ext" : "int",
      ...(o.adj ? { aiAdj: true } : {}),    // v61 : recentrée / rétrécie au relevé (relecture ciblée)
      ...(o.sens ? { aiSens: true } : {}),  // v61 : sens de la porte lu par l'IA
      ...(o.ai ? { aiRel: true } : {})      // v61 : ouverture du relevé IA (seules celles-là sont relues)
    }));
    state.app.forEach(a => {
      if (!a.seg || !segById(a.seg)) reattach(a);
    });
    clampOpenings();
    K.preview = null;
    resetTransient();
    clearSel();
    K.tool = "sel";
    K.testMode = false;
    if (K.tab !== "plan") setTab("plan");
    buildTools();
    markDirty();
    draw();
    showSide();
    return {
      murs: sids.length,
      ouvertures: r.openings.length
    };
  },
  saveNow() {
    clearTimeout(K.saveT);
    return writeNow();
  },
  packData,
  get saveFail() {
    return K.saveFail;
  },
  get tool() {
    return K.tool;
  },
  get tab() {
    return K.tab;
  },
  // contrôle permanent (v43) : anomalies de tout le chantier [{kind, ids, lv}] (recalculées à chaque dessin)
  get control() {
    return (K.ctl || []).map(i => ({ ...i, ids: [...i.ids] }));
  },
  controlKinds: CHECK_KINDS,
  // mode essai (v45)
  essai: {
    press(id) { const c = essaiPress(id); draw(); return c; },
    reset() { essaiReset(); draw(); },
    lit() { return [...litSet()]; },
    get off() { return [...essai().off]; },
    breaker(n, on) { setBreaker(n, on); draw(); },
    testAll() { return testAll(); },
  },
  setEssai(on) {
    if (!!on === !!K.testMode) return;
    this.toggleTest();
  },
  get testMode() {
    return K.testMode;
  },
  get view() {
    return K.view;
  },
  set view(v) {
    K.view = v;
  },
  VB,
  get selection() {
    return K.sel ? [K.sel.kind + ":" + K.sel.id] : [...multi];
  },
  draw,
  showSide,
  fit,
  syncVB,
  snapshot,
  markDirty,
  repMap,
  renumberReps,
  roomAt,
  hintFor,
  setHint,
  buildTools,
  setTool(v) {
    resetTransient();
    K.tool = v;
    K.testMode = false;
    if (v !== "sel") clearSel();
    if (K.tab !== "plan") setTab("plan");
    buildTools();
    setHint(hintFor(v));
    draw();
    showSide();
  },
  toggleTest() {
    resetTransient();
    K.testMode = !K.testMode;
    clearSel();
    buildTools();
    setHint(K.testMode ? "Mode essai : cliquez un interrupteur pour allumer ou éteindre ses lumières (un 2e clic les éteint). Va-et-vient : chacun inverse. Échap ou « Essai » pour sortir." : "");
    draw();
    showSide();
  },
  setTab,
  // v58 : vue tournée (degrés) ; rotateView(pas) ou rotateView(angle, true)
  rotateView(deg, abs = false) {
    rotateView(deg, abs);
    return K.view.rot || 0;
  },
  get viewRot() {
    return K.view.rot || 0;
  },
  setRoomTxt(f) {
    setRoomTxt(f);
  },
  // v58 : boîtes des noms de pièces affichés [{id, x0, y0, x1, y1, cx, cy}] et position AFFICHÉE d'un appareil
  get roomLabels() {
    return (K.roomLabelBoxes || []).map(b => ({ ...b }));
  },
  shownAt(id) {
    const a = state.app.find(x => x.id === id);
    const d = K.dispPos && K.dispPos.get(id);
    return a ? { x: d ? d.x : a.x, y: d ? d.y : a.y, moved: !!d } : null;
  },
  get symCm() {
    return K.symCm;
  },
  objBox,
  zoomToBox,
  // emprise du dessin + du fond de plan (pour l'image envoyée à l'IA)
  extent() {
    const pts = [...state.nodes, ...state.app];
    const bb = pts.length ? bbox(pts) : null;
    const fond = layers.fond.on && K.bgLevel > 0 && !!K.FOND && K.BG.w > 0;
    const xs = [...(bb ? [bb.x0, bb.x1] : []), ...(fond ? [K.BG.x, K.BG.x + K.BG.w] : [])],
      ys = [...(bb ? [bb.y0, bb.y1] : []), ...(fond ? [K.BG.y, K.BG.y + K.BG.h] : [])];
    return xs.length ? {
      x0: Math.min(...xs),
      y0: Math.min(...ys),
      x1: Math.max(...xs),
      y1: Math.max(...ys)
    } : {
      x0: 0,
      y0: 0,
      x1: PLAN.w,
      y1: PLAN.h
    };
  },
  select(ids) {
    clearSel();
    resetTransient();
    const keys = ids.map(id => {
      const b = objBox(id);
      return b ? b.kind + ":" + id : null;
    }).filter(Boolean);
    keys.forEach(k => multi.add(k));
    normalizeSel();
    if (K.tool !== "sel") {
      K.tool = "sel";
      K.testMode = false;
      buildTools();
    }
    if (K.tab !== "plan") setTab("plan");
    draw();
    showSide();
    return keys.length;
  },
  zoomTo(ids) {
    const bs = ids.map(objBox).filter(Boolean);
    if (!bs.length) return false;
    if (K.tab !== "plan") setTab("plan");
    zoomToBox(Math.min(...bs.map(b => b.x0)), Math.min(...bs.map(b => b.y0)), Math.max(...bs.map(b => b.x1)), Math.max(...bs.map(b => b.y1)));
    return true;
  },
  renameRoom(id, name) {
    const r = state.rooms.find(x => x.id === id);
    if (!r || !name) return false;
    snapshot();
    r.name = String(name).slice(0, 40);
    markDirty();
    draw();
    showSide();
    return true;
  },
  deleteSelection() {
    delSel();
  },
  selectAll() {
    if (K.tool !== "sel") {
      K.tool = "sel";
      buildTools();
    }
    selectAll();
  },
  duplicate() {
    duplicateGroup();
  },
  transform(k) {
    const grp = multi.size > 1 || K.sel && K.sel.kind === "room";
    if (!grp && !K.sel) return false;
    transformGroup(k);
    return true;
  },
  undo() {
    document.getElementById("undo").click();
  },
  redo() {
    document.getElementById("redo").click();
  },
  clearSel() {
    clearSel();
    resetTransient();
    draw();
    showSide();
  },
  toggle(name) {
    const el = document.getElementById(name);
    if (el) {
      el.checked = !el.checked;
      el.dispatchEvent(new Event("change"));
    }
  },
  zoom(f) {
    K.view.scale = Math.max(2, Math.min(90, K.view.scale * f));
    draw();
  }
};
// accès historique pour les tests automatiques
// accès historique pour les tests automatiques
window.__okteo = {
  state,
  draw
};
document.dispatchEvent(new CustomEvent("okteo:ready"));
}

