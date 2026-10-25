// Oktéo AI — cœur : Mesures sur mur et interactions souris / clavier sur le plan.
// Module issu du découpage de app.js (v26). L'état partagé est dans K (core/k.js).
import { K } from "./k.js";
import { TYPES, cornerHalf, dist, epOf, layers, node, nodeById, segById, segDir, segLen, state, uidA, uidD, uidO, uidR, uidS } from "./model.js";
import { markDirty, save, snapshot } from "./persist.js";
import { applyOrtho, evWorld, pxPerVB, repMap, snapWorld, tolM } from "./view.js";
import { draw, sv } from "./render.js";
import { attach, hitApp, hitNode, hitOpen, hitOpenHandle, hitSeg, projOnSeg, segDistPt, snapAlign, snapToWall, wallMounted } from "./attach.js";
import { clampOpenings, clearSel, currentGroup, isSel, marqueeSelect, mk, moveGroup, multi, normalizeSel, roomAt, setSingle, startGroupDrag, toggleMulti } from "./groups.js";
import { showSide } from "./panel.js";
import { buildTools, hintFor, setHint } from "./controls.js";
import { allLinks, levelName } from "./levels.js";

// ---------- mesure sur mur (distance à l'angle) ----------
export const fmtM = v => (v >= 0 ? "" : "−") + Math.abs(v).toFixed(2).replace(".", ",") + " m";

export const fmtCm = v => Math.round(v * 100) + " cm";

export function wallMeasure(segId, x, y) {
  const seg = segById(segId);
  if (!seg) return null;
  const p = projOnSeg(x, y, seg),
    d = p.dir;
  const cA = cornerHalf(seg.a, seg.id),
    cB = cornerHalf(seg.b, seg.id),
    nx = -d.uy,
    ny = d.ux;
  const side = (x - p.x) * nx + (y - p.y) * ny >= 0 ? 1 : -1;
  return {
    seg,
    t: p.t,
    L: d.L,
    dA: Math.max(0, p.t - cA),
    dB: Math.max(0, d.L - p.t - cB),
    cA,
    cB,
    side,
    dir: d
  };
}

export function posOnWall(m, fromA, dm) {
  const t = Math.max(0, Math.min(m.L, fromA ? dm + m.cA : m.L - (dm + m.cB))),
    d = m.dir,
    off = epOf(m.seg) / 2 + 0.06;
  return {
    x: +(d.a.x + d.ux * t - d.uy * off * m.side).toFixed(2),
    y: +(d.a.y + d.uy * t + d.ux * off * m.side).toFixed(2)
  };
}

export function wallText(m) {
  const near = Math.min(m.dA, m.dB),
    far = Math.max(m.dA, m.dB);
  return fmtCm(near) + " de l'angle · " + fmtCm(far) + " de l'autre";
}

export function placementFor(t, wx, wy, exclId) {
  let px = wx,
    py = wy,
    segRef = null;
  if (wallMounted(t)) {
    const ws = snapToWall(wx, wy);
    if (ws) {
      px = ws.x;
      py = ws.y;
      segRef = ws.seg;
    }
  }
  if (!segRef) {
    const al = snapAlign(px, py, exclId);
    px = al.x;
    py = al.y;
    if (!K.guides.length) {
      px = Math.round(px / K.gridM) * K.gridM;
      py = Math.round(py / K.gridM) * K.gridM;
    }
  } else K.guides = [];
  return {
    x: +px.toFixed(2),
    y: +py.toFixed(2),
    seg: segRef
  };
}

export function seriesPositions(src, end, n) {
  const out = [];
  for (let i = 1; i < n; i++) {
    const f = i / (n - 1);
    let x = src.x + (end.x - src.x) * f,
      y = src.y + (end.y - src.y) * f,
      seg = null;
    if (wallMounted(src.t) && end.seg) {
      const ws = snapToWall(x, y);
      if (ws) {
        x = ws.x;
        y = ws.y;
        seg = ws.seg;
      }
    }
    out.push({
      x: +x.toFixed(2),
      y: +y.toFixed(2),
      seg
    });
  }
  return out;
}

export function showText(s) {
  const r = document.getElementById("readout");
  r.hidden = false;
  r.textContent = s;
}

// ---------- interactions ----------

export function hitAny(wx, wy) {
  if (layers.murs.on && !layers.murs.lock) {
    const n = hitNode(wx, wy);
    if (n) return {
      kind: "node",
      id: n.id,
      obj: n
    };
  }
  if (layers.appareils.on && !layers.appareils.lock) {
    const a = hitApp(wx, wy);
    if (a) return {
      kind: "app",
      id: a.id,
      obj: a
    };
  }
  if (layers.ouvertures.on && !layers.ouvertures.lock) {
    const o = hitOpen(wx, wy);
    if (o) return {
      kind: "open",
      id: o.id,
      obj: o
    };
  }
  if (layers.murs.on && !layers.murs.lock) {
    const s = hitSeg(wx, wy);
    if (s) return {
      kind: "seg",
      id: s.seg.id,
      obj: s.seg
    };
  }
  if (layers.cotes.on && !layers.cotes.lock) {
    for (const d of state.dims) {
      if (segDistPt(wx, wy, d.a, d.b).d < tolM()) return {
        kind: "dim",
        id: d.id,
        obj: d
      };
    }
  }
  return null;
}

export function inGroup(G, h) {
  if (h.kind === "node") return G.nodes.has(h.id);
  if (h.kind === "app") return G.apps.has(h.id);
  if (h.kind === "open") return G.opens.has(h.id);
  if (h.kind === "dim") return G.dims.has(h.id);
  if (h.kind === "seg") {
    const s = segById(h.id);
    return s && G.nodes.has(s.a) && G.nodes.has(s.b);
  }
  return false;
}

export function placeApp(t, p) {
  const na = {
    id: uidA(),
    t,
    x: p.x,
    y: p.y,
    h: TYPES[t].h
  };
  if (p.seg) {
    na.seg = p.seg;
    attach(na);
  }
  state.app.push(na);
  return na;
}

export function endPtr() {
  if (K.marquee) {
    const m = K.marquee;
    K.marquee = null;
    if (m.moved) marqueeSelect(m);else if (m.room) {
      if (m.shift) toggleMulti("room", m.room);else setSingle("room", m.room);
    } else if (!m.shift) clearSel();
    draw();
    showSide();
    return;
  }
  if (K.roomDraft) {
    const r = K.roomDraft;
    K.roomDraft = null;
    hideReadout();
    const w = Math.abs(r.x1 - r.x0),
      hh = Math.abs(r.y1 - r.y0);
    if (w > 0.3 && hh > 0.3) {
      snapshot();
      const x0 = Math.min(r.x0, r.x1),
        y0 = Math.min(r.y0, r.y1),
        x1 = Math.max(r.x0, r.x1),
        y1 = Math.max(r.y0, r.y1);
      const n1 = node(x0, y0),
        n2 = node(x1, y0),
        n3 = node(x1, y1),
        n4 = node(x0, y1),
        sids = [];
      [[n1, n2], [n2, n3], [n3, n4], [n4, n1]].forEach(([a, b]) => {
        const id = uidS();
        sids.push(id);
        state.segs.push({
          id,
          a: a.id,
          b: b.id
        });
      });
      const rm = {
        id: uidR(),
        name: "Pièce " + (state.rooms.length + 1),
        x0,
        y0,
        x1,
        y1,
        segs: sids
      };
      state.rooms.push(rm);
      setSingle("room", rm.id);
      markDirty();
      draw();
      showSide();
    } else draw();
    return;
  }
  if (K.drag) {
    const d = K.drag;
    K.drag = null;
    K.guides = [];
    hideReadout();
    if (d.moved) markDirty();else if (d.clickHit) setSingle(d.clickHit.kind, d.clickHit.id);
    draw();
    showSide();
  }
  if (K.pan) {
    K.pan = null;
    save();
  }
}

export function showReadout(len, ang) {
  const r = document.getElementById("readout");
  r.hidden = false;
  let deg = Math.round(ang * 180 / Math.PI);
  if (deg < 0) deg += 360;
  r.textContent = (K.typed !== "" ? "⌨ " + K.typed + " m" : len.toFixed(2) + " m") + (ang ? "  ·  " + deg + "°" : "");
}

export function showReadout2(w, h) {
  const r = document.getElementById("readout");
  r.hidden = false;
  r.textContent = w.toFixed(2) + " × " + h.toFixed(2) + " m  ·  " + (w * h).toFixed(1) + " m²";
}

export function hideReadout() {
  document.getElementById("readout").hidden = true;
}

// ---------- menu contextuel flottant (près de l'objet) ----------

// initialisation (étape 5 du démarrage)
export function init5() {
// ---------- interactions ----------
K.drag = null;
K.pan = null;
sv.addEventListener("pointerdown", e => {
  sv.setPointerCapture(e.pointerId);
  const [wx, wy] = evWorld(e);
  if (document.activeElement && document.activeElement !== document.body && document.activeElement.blur) document.activeElement.blur();
  if (e.button === 2 || e.button === 1 || K.tool === "pan") {
    K.pan = {
      x: e.clientX,
      y: e.clientY,
      cx: K.view.cx,
      cy: K.view.cy
    };
    return;
  }
  if (K.seriesMode) {
    const src = state.app.find(a => a.id === K.seriesMode.src);
    if (src && K.seriesPrev && K.seriesPrev.length) {
      snapshot();
      multi.clear();
      K.sel = null;
      multi.add(mk("app", src.id));
      K.seriesPrev.forEach(p => {
        const na = placeApp(src.t, p);
        na.h = src.h;
        multi.add(mk("app", na.id));
      });
      normalizeSel();
      markDirty();
    }
    K.seriesMode = null;
    K.seriesPrev = null;
    hideReadout();
    setHint(hintFor(K.tool));
    draw();
    showSide();
    return;
  }
  if (K.tool === "calib") {
    if (!K.calib || K.calib.b) {
      K.calib = {
        a: {
          x: wx,
          y: wy
        },
        b: null,
        cur: null
      };
      setHint("Échelle : cliquez le second point de la cote connue.");
      draw();
      return;
    }
    let [bx, by] = K.ortho ? applyOrtho(K.calib.a.x, K.calib.a.y, wx, wy) : [wx, wy];
    if (dist(K.calib.a.x, K.calib.a.y, bx, by) < 1e-6) return;
    K.calib.b = {
      x: bx,
      y: by
    };
    hideReadout();
    multi.clear();
    K.sel = {
      kind: "calibAsk"
    };
    draw();
    showSide();
    document.dispatchEvent(new CustomEvent("okteo:ask"));
    setHint("Échelle : tapez la longueur réelle de cette cote dans le panneau de droite.");
    return;
  }
  if (K.tool === "piece") {
    const p = snapWorld(wx, wy);
    K.roomDraft = {
      x0: p.x,
      y0: p.y,
      x1: p.x,
      y1: p.y
    };
    return;
  }
  if (K.tool === "mur") {
    let p;
    if (K.draftFrom) {
      const f = nodeById(K.draftFrom);
      let [ox, oy] = applyOrtho(f.x, f.y, wx, wy);
      p = snapWorld(ox, oy);
    } else p = snapWorld(wx, wy);
    const nd = p.node ? nodeById(p.node) : node(p.x, p.y);
    if (K.draftFrom && K.draftFrom !== nd.id) {
      snapshot();
      state.segs.push({
        id: uidS(),
        a: K.draftFrom,
        b: nd.id
      });
      markDirty();
    }
    K.draftFrom = nd.id;
    K.typed = "";
    draw();
    return;
  }
  if (K.tool === "porte" || K.tool === "fenetre") {
    const hs = hitSeg(wx, wy);
    if (!hs) {
      setHint("Cliquez sur un mur pour y insérer l'ouverture.");
      return;
    }
    snapshot();
    const w = K.tool === "porte" ? 0.83 : 1.0;
    const L = segLen(hs.seg);
    const t = Math.max(w / 2, Math.min(L - w / 2, hs.t));
    const o = {
      id: uidO(),
      seg: hs.seg.id,
      t: +t.toFixed(3),
      w,
      kind: K.tool,
      hinge: "g",
      swing: "int"
    };
    state.openings.push(o);
    K.tool = "sel";
    setSingle("open", o.id);
    buildTools();
    markDirty();
    draw();
    showSide();
    return;
  }
  if (K.tool === "offset") {
    const hs = hitSeg(wx, wy);
    if (!hs) {
      setHint("Cliquez le mur à dupliquer en parallèle.");
      return;
    }
    const d = segDir(hs.seg);
    const nx = -d.uy,
      ny = d.ux;
    const side = (wx - d.a.x) * nx + (wy - d.a.y) * ny >= 0 ? 1 : -1;
    multi.clear();
    K.sel = {
      kind: "offsetAsk",
      seg: hs.seg.id,
      side
    };
    showSide();
    document.dispatchEvent(new CustomEvent("okteo:ask"));
    setHint("Indiquez la distance de la cloison parallèle dans le panneau de droite.");
    return;
  }
  if (K.tool === "cote") {
    const p = snapWorld(wx, wy);
    if (!K.dimDraft) {
      K.dimDraft = {
        x: p.x,
        y: p.y
      };
      setHint("Cliquez le second point de la cote.");
    } else {
      snapshot();
      state.dims.push({
        id: uidD(),
        a: {
          x: K.dimDraft.x,
          y: K.dimDraft.y
        },
        b: {
          x: p.x,
          y: p.y
        }
      });
      K.dimDraft = null;
      markDirty();
      draw();
      showSide();
      setHint(hintFor("cote"));
    }
    return;
  }
  if (K.tool === "sel") {
    if (K.testMode) {
      const a = hitApp(wx, wy);
      if (a && (a.t === "INT" || a.t === "VV" || a.t === "BP")) {
        setSingle("app", a.id);
        draw();
      }
      return;
    }
    const shift = e.shiftKey;
    if (!shift && layers.ouvertures.on && !layers.ouvertures.lock && K.sel && K.sel.kind === "open") {
      const so = state.openings.find(x => x.id === K.sel.id);
      const hh = so && hitOpenHandle(wx, wy, so);
      if (hh) {
        K.drag = {
          kind: "openW",
          o: so,
          handle: hh,
          sx: wx,
          sy: wy,
          moved: false
        };
        return;
      }
    }
    const hit = hitAny(wx, wy);
    if (hit) {
      if (shift) {
        toggleMulti(hit.kind, hit.id);
        draw();
        showSide();
        return;
      }
      if (multi.size > 1 || K.sel && K.sel.kind === "room") {
        const G = currentGroup();
        if (inGroup(G, hit)) {
          startGroupDrag(wx, wy, G);
          K.drag.clickHit = hit;
          draw();
          return;
        }
      }
      setSingle(hit.kind, hit.id);
      if (hit.kind === "node") K.drag = {
        kind: "node",
        n: hit.obj,
        sx: wx,
        sy: wy,
        moved: false
      };else if (hit.kind === "app") K.drag = {
        kind: "app",
        a: hit.obj,
        dx: hit.obj.x - wx,
        dy: hit.obj.y - wy,
        sx: wx,
        sy: wy,
        moved: false
      };else if (hit.kind === "open") K.drag = {
        kind: "openT",
        o: hit.obj,
        sx: wx,
        sy: wy,
        moved: false
      };else if (hit.kind === "seg") {
        const d = segDir(hit.obj);
        const G = {
          nodes: new Set([hit.obj.a, hit.obj.b]),
          apps: new Set(),
          rooms: new Set(),
          opens: new Set(),
          dims: new Set()
        };
        startGroupDrag(wx, wy, G, {
          x: -d.uy,
          y: d.ux
        });
      }
      draw();
      showSide();
      return;
    }
    const rm = layers.pieces.on && !layers.pieces.lock ? roomAt(wx, wy) : null;
    if (rm && !shift && isSel("room", rm.id)) {
      startGroupDrag(wx, wy);
      draw();
      return;
    }
    if (rm && !shift && multi.size > 1) {
      const G = currentGroup();
      if (G.rooms.has(rm.id)) {
        startGroupDrag(wx, wy, G);
        draw();
        return;
      }
    }
    K.marquee = {
      x0: wx,
      y0: wy,
      x1: wx,
      y1: wy,
      moved: false,
      shift,
      room: rm ? rm.id : null
    };
    return;
  }
  if (K.tool === "lien") {
    const a = hitApp(wx, wy);
    if (!a) return;
    if (!K.sel || K.sel.kind !== "link") {
      if (a.t === "INT" || a.t === "VV" || a.t === "BP") {
        multi.clear();
        K.sel = {
          kind: "link",
          id: a.id
        };
        draw();
        setHint("Cliquez la/les lumière(s) commandée(s). Échap pour terminer.");
      }
    } else {
      if (a.t === "LUM" || a.t === "SPOT" || a.t === "APP") {
        snapshot();
        if (!allLinks().some(x => x.c === K.sel.id && x.l === a.id)) state.lia.push({
          c: K.sel.id,
          l: a.id
        });
        markDirty();
        draw();
        if (K.sel.lv && K.sel.lv !== K.LV.cur) setHint(`Liaison entre niveaux : ${K.sel.rep} (${levelName(K.sel.lv)}) → ${repMap()[a.id]} (${levelName()}). Échap pour terminer.`);
      }
    }
    return;
  }
  // pose d'appareil (aperçu = position finale)
  if (TYPES[K.tool]) {
    snapshot();
    const p = placementFor(K.tool, wx, wy, null);
    K.guides = [];
    const na = placeApp(K.tool, p);
    setSingle("app", na.id);
    markDirty();
    draw();
    showSide();
  }
});
sv.addEventListener("pointermove", e => {
  const [wx, wy] = evWorld(e);
  K.lastW = {
    x: wx,
    y: wy
  };
  if (K.pan) {
    const k = pxPerVB();
    K.view.cx = K.pan.cx - (e.clientX - K.pan.x) / k / K.view.scale;
    K.view.cy = K.pan.cy - (e.clientY - K.pan.y) / k / K.view.scale;
    draw();
    return;
  }
  if (K.seriesMode) {
    const src = state.app.find(a => a.id === K.seriesMode.src);
    if (!src) {
      K.seriesMode = null;
      return;
    }
    const end = placementFor(src.t, wx, wy, src.id);
    K.seriesPrev = seriesPositions(src, end, K.seriesMode.n);
    showText(K.seriesMode.n + " appareils · pas de " + fmtM(dist(src.x, src.y, end.x, end.y) / (K.seriesMode.n - 1)));
    draw();
    return;
  }
  if (K.marquee) {
    K.marquee.x1 = wx;
    K.marquee.y1 = wy;
    if (!K.marquee.moved && dist(K.marquee.x0, K.marquee.y0, wx, wy) > tolM() * 0.4) K.marquee.moved = true;
    draw();
    return;
  }
  if (K.roomDraft) {
    const p = snapWorld(wx, wy);
    K.roomDraft.x1 = p.x;
    K.roomDraft.y1 = p.y;
    showReadout2(Math.abs(K.roomDraft.x1 - K.roomDraft.x0), Math.abs(K.roomDraft.y1 - K.roomDraft.y0));
    draw();
    return;
  }
  if (K.drag) {
    if (!K.drag.moved) {
      if (dist(K.drag.sx, K.drag.sy, wx, wy) < tolM() * 0.35) return;
      snapshot();
      K.drag.moved = true;
    }
    if (K.drag.kind === "group") {
      moveGroup(wx, wy, e.shiftKey);
      draw();
      showSide();
    } else if (K.drag.kind === "node") {
      const p = snapWorld(wx, wy, K.drag.n.id);
      K.drag.n.x = p.x;
      K.drag.n.y = p.y;
      clampOpenings();
      draw();
      showSide();
    } else if (K.drag.kind === "openT") {
      const seg = segById(K.drag.o.seg);
      const pr = projOnSeg(wx, wy, seg);
      K.drag.o.t = +Math.max(K.drag.o.w / 2, Math.min(pr.dir.L - K.drag.o.w / 2, pr.t)).toFixed(3);
      draw();
      showSide();
    } else if (K.drag.kind === "openW") {
      const seg = segById(K.drag.o.seg);
      const pr = projOnSeg(wx, wy, seg);
      K.drag.o.w = +Math.max(0.2, Math.abs(pr.t - K.drag.o.t) * 2).toFixed(3);
      clampOpenings();
      draw();
      showSide();
    } else {
      const p = placementFor(K.drag.a.t, wx + K.drag.dx, wy + K.drag.dy, K.drag.a.id);
      K.drag.a.x = p.x;
      K.drag.a.y = p.y;
      if (p.seg) {
        K.drag.a.seg = p.seg;
        attach(K.drag.a);
        const m = wallMeasure(p.seg, p.x, p.y);
        if (m) showText(wallText(m));
      } else {
        delete K.drag.a.seg;
        delete K.drag.a.wa;
        hideReadout();
      }
      draw();
      showSide();
    }
    return;
  }
  if (K.tool === "calib" && K.calib && K.calib.a && !K.calib.b) {
    const [bx, by] = K.ortho ? applyOrtho(K.calib.a.x, K.calib.a.y, wx, wy) : [wx, wy];
    K.calib.cur = {
      x: bx,
      y: by
    };
    showText("Échelle actuelle : " + dist(K.calib.a.x, K.calib.a.y, bx, by).toFixed(2) + " m entre les deux points");
    draw();
    return;
  }
  if (TYPES[K.tool] && K.tool !== "sel") {
    K.ghost = placementFor(K.tool, wx, wy, null);
    K.ghost.t = K.tool;
    if (K.ghost.seg) {
      const m = wallMeasure(K.ghost.seg, K.ghost.x, K.ghost.y);
      if (m) showText(K.typed !== "" ? "⌨ " + K.typed + " cm de l'angle le plus proche · Entrée pour poser" : wallText(m));
    } else if (K.typed === "") {
      hideReadout();
    }
    draw();
    return;
  }
  if (K.tool === "mur") {
    let ox = wx,
      oy = wy;
    if (K.draftFrom) {
      const f = nodeById(K.draftFrom);
      [ox, oy] = applyOrtho(f.x, f.y, wx, wy);
    }
    const p = snapWorld(ox, oy);
    K.draftPt = {
      x: p.x,
      y: p.y,
      snap: p.kind === "nœud"
    };
    if (K.draftFrom) {
      const f = nodeById(K.draftFrom);
      showReadout(dist(f.x, f.y, p.x, p.y), Math.atan2(-(p.y - f.y), p.x - f.x));
    }
    draw();
  } else if (K.tool === "cote" && K.dimDraft) {
    const p = snapWorld(wx, wy);
    K.draftPt = {
      x: p.x,
      y: p.y,
      snap: p.kind === "nœud"
    };
    showReadout(dist(K.dimDraft.x, K.dimDraft.y, p.x, p.y), 0);
    draw();
  }
});
sv.addEventListener("pointerleave", () => {
  if (K.ghost) {
    K.ghost = null;
    if (K.typed === "") hideReadout();
    draw();
  }
});
sv.addEventListener("pointerup", endPtr);
sv.addEventListener("pointercancel", endPtr);
sv.addEventListener("contextmenu", e => e.preventDefault());
sv.addEventListener("dblclick", () => {
  if (K.tool === "mur") {
    K.draftFrom = null;
    K.draftPt = null;
    K.typed = "";
    hideReadout();
    draw();
  }
});
sv.addEventListener("wheel", e => {
  e.preventDefault();
  const [wx, wy] = evWorld(e);
  const f = e.deltaY < 0 ? 1.12 : 1 / 1.12;
  K.view.scale = Math.max(2, Math.min(90, K.view.scale * f));
  const [nx, ny] = evWorld(e);
  K.view.cx += wx - nx;
  K.view.cy += wy - ny;
  draw();
}, {
  passive: false
});
}

