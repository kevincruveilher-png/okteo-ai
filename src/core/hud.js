// Oktéo AI — cœur : Menu contextuel flottant près de l'objet sélectionné.
// Module issu du découpage de app.js (v26). L'état partagé est dans K (core/k.js).
import { K } from "./k.js";
import { dist, epOf, nodeById, segById, state } from "./model.js";
import { markDirty, snapshot } from "./persist.js";
import { W2V, repMap } from "./view.js";
import { draw, sv } from "./render.js";
import { attach } from "./attach.js";
import { bbox, clampOpenings, clearSel, currentGroup, deleteGroup, duplicateGroup, groupCount, groupPoints, multi, openCenter, transformGroup } from "./groups.js";
import { posOnWall, wallMeasure } from "./interact.js";
import { delSel, showSide } from "./panel.js";
import { setHint } from "./controls.js";

// ---------- menu contextuel flottant (près de l'objet) ----------
export const stageEl = document.querySelector(".stage"),
  hudEl = document.getElementById("hud");

export function worldToScreen(x, y) {
  const [vx, vy] = W2V(x, y);
  const ctm = sv.getScreenCTM();
  if (!ctm) return null;
  const p = sv.createSVGPoint();
  p.x = vx;
  p.y = vy;
  const sp = p.matrixTransform(ctm);
  const r = stageEl.getBoundingClientRect();
  return {
    x: sp.x - r.left,
    y: sp.y - r.top
  };
}

export function selCenter() {
  if (multi.size > 1) {
    const bb = bbox(groupPoints(currentGroup()));
    return bb && {
      x: bb.cx,
      y: bb.y0
    };
  }
  if (!K.sel) return null;
  if (K.sel.kind === "app") {
    const a = state.app.find(x => x.id === K.sel.id);
    return a && {
      x: a.x,
      y: a.y
    };
  }
  if (K.sel.kind === "open") return openCenter(K.sel.id);
  if (K.sel.kind === "seg") {
    const s = segById(K.sel.id);
    if (!s) return null;
    const a = nodeById(s.a),
      b = nodeById(s.b);
    return a && b && {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2
    };
  }
  if (K.sel.kind === "node") return nodeById(K.sel.id);
  if (K.sel.kind === "room") {
    const r = state.rooms.find(x => x.id === K.sel.id);
    return r && {
      x: (r.x0 + r.x1) / 2,
      y: Math.min(r.y0, r.y1)
    };
  }
  if (K.sel.kind === "dim") {
    const d = state.dims.find(x => x.id === K.sel.id);
    return d && {
      x: (d.a.x + d.b.x) / 2,
      y: (d.a.y + d.b.y) / 2
    };
  }
  return null;
}

export const HUD_TF = `<button data-h="ccw" title="Rotation 90° à gauche (Maj+R)">⟲</button><button data-h="cw" title="Rotation 90° à droite (R)">⟳</button>
  <button data-h="mx" title="Symétrie gauche-droite (X)">⇋</button><button data-h="my" title="Symétrie haut-bas (Y)">⇵</button>`;

export function hudHTML() {
  if (multi.size > 1) {
    const n = groupCount(currentGroup());
    return `<span class="lab">${n} objet${n > 1 ? "s" : ""}</span><span class="vsep"></span>${HUD_TF}<span class="vsep"></span>
      <button data-h="gdup" title="Dupliquer (Ctrl+D)">Dupliquer</button><button data-h="gdel" title="Supprimer (Suppr)">🗑</button>`;
  }
  if (!K.sel) return "";
  if (K.sel.kind === "open") {
    const o = state.openings.find(x => x.id === K.sel.id);
    if (!o) return "";
    return `<button data-h="w-" class="mini">−</button><span class="lab">${o.w.toFixed(2)} m</span><button data-h="w+" class="mini">+</button>
      <span class="vsep"></span><button data-h="gond">Gond</button><button data-h="sens">Sens</button>
      <button data-h="kind" title="Porte → fenêtre → porte de garage">${o.kind === "porte" ? "→ Fenêtre" : o.kind === "fenetre" ? "→ Garage" : "→ Porte"}</button>
      <span class="vsep"></span><button data-h="del" title="Supprimer">🗑</button>`;
  }
  if (K.sel.kind === "app") {
    const a = state.app.find(x => x.id === K.sel.id);
    if (!a) return "";
    const m = a.seg ? wallMeasure(a.seg, a.x, a.y) : null;
    const dc = m ? `<span class="vsep"></span><span class="lab" title="Distance à l'angle le plus proche, face intérieure">↤</span><input data-h="dc" data-from="${m.dA <= m.dB ? "A" : "B"}" type="number" step="1" value="${Math.round(Math.min(m.dA, m.dB) * 100)}"><span class="lab">cm</span>` : "";
    return `<span class="lab">${repMap()[a.id] || a.t}</span><span class="vsep"></span>
      <span class="lab">h</span><input data-h="h" type="number" step="1" value="${a.h ?? ""}" ${a.h == null ? 'placeholder="plaf."' : ''}>${dc}
      <span class="vsep"></span><span class="lab">×</span><input data-h="n" type="number" min="2" max="40" step="1" value="${K.seriesN}" style="width:40px"><button data-h="serie" title="Poser une série équirépartie jusqu'au point cliqué">Série</button>
      <button data-h="dup" title="Dupliquer (Ctrl+D)">Dupliquer</button><span class="vsep"></span><button data-h="del">🗑</button>`;
  }
  if (K.sel.kind === "seg") {
    const s = segById(K.sel.id);
    if (!s) return "";
    const a = nodeById(s.a),
      b = nodeById(s.b);
    const L = dist(a.x, a.y, b.x, b.y);
    return `<span class="lab">L</span><input data-h="L" type="number" step="0.01" value="${L.toFixed(2)}"><span class="lab">m</span>
      <span class="vsep"></span><span class="lab" title="Épaisseur de ce mur">ép.</span><input data-h="ep" type="number" step="1" min="2" max="80" value="${Math.round(epOf(s) * 100)}" title="Épaisseur de ce mur (cm)"><span class="lab">cm</span>
      <span class="vsep"></span><button data-h="del">🗑</button>`;
  }
  if (K.sel.kind === "room") {
    const r = state.rooms.find(x => x.id === K.sel.id);
    if (!r) return "";
    return `<input data-h="name" type="text" value="${r.name.replace(/"/g, '&quot;')}" style="width:104px"><button data-h="pack" class="hud-pack" title="Poser un pack d'appareils dans cette pièce : prises, point lumineux, interrupteur… (Maj+P, puis le chiffre du pack)">▦ Pack ▾</button><span class="vsep"></span>${HUD_TF}
      <span class="vsep"></span><button data-h="gdup" title="Dupliquer la pièce et son contenu (Ctrl+D)">Dupliquer</button><button data-h="gdel" title="Supprimer la pièce, ses murs et son contenu">🗑</button>`;
  }
  if (K.sel.kind === "node") return `<button data-h="del">Supprimer le sommet</button>`;
  if (K.sel.kind === "dim") return `<button data-h="del">Supprimer la cote</button>`;
  return "";
}

export function wireHud() {
  hudEl.querySelectorAll("[data-h]").forEach(el => {
    const act = el.dataset.h;
    const run = fn => {
      snapshot();
      fn();
      markDirty();
      draw();
      showSide();
    };
    if (el.tagName === "INPUT") {
      el.onchange = e => {
        if (act === "n") {
          K.seriesN = Math.max(2, Math.min(40, Math.round(+e.target.value || 3)));
          return;
        }
        if (!K.sel) return;
        if (act === "h") {
          const a = state.app.find(x => x.id === K.sel.id);
          run(() => a.h = e.target.value === "" ? null : +e.target.value);
        }
        if (act === "dc") {
          const a = state.app.find(x => x.id === K.sel.id);
          const m = a && a.seg && wallMeasure(a.seg, a.x, a.y);
          if (m) run(() => {
            const p = posOnWall(m, el.dataset.from === "A", +e.target.value / 100);
            a.x = p.x;
            a.y = p.y;
            attach(a);
          });
        }
        if (act === "ep") {
          const s = segById(K.sel.id),
            v = +e.target.value;
          if (s && v >= 2 && v <= 80) run(() => {
            s.ep = +(v / 100).toFixed(3);
          });
        }
        if (act === "L") {
          const s = segById(K.sel.id),
            a = nodeById(s.a),
            c = nodeById(s.b),
            d = dist(a.x, a.y, c.x, c.y) || 1,
            nl = +e.target.value;
          run(() => {
            c.x = +(a.x + (c.x - a.x) / d * nl).toFixed(3);
            c.y = +(a.y + (c.y - a.y) / d * nl).toFixed(3);
            clampOpenings();
          });
        }
        if (act === "name") {
          const r = state.rooms.find(x => x.id === K.sel.id);
          run(() => r.name = e.target.value || r.name);
        }
      };
      return;
    }
    el.onclick = () => {
      if (act === "pack") {
        // le menu des packs est dans l'extension Packs (src/ext/packs-ui.js)
        const r = el.getBoundingClientRect();
        document.dispatchEvent(new CustomEvent("okteo:pack-menu", { detail: { room: K.sel && K.sel.id, x: r.left, y: r.bottom + 4 } }));
        return;
      }
      if (act === "del") {
        delSel();
        return;
      }
      if (act === "gdel") {
        deleteGroup(currentGroup());
        return;
      }
      if (act === "gdup") {
        duplicateGroup();
        return;
      }
      if (["cw", "ccw", "mx", "my"].includes(act)) {
        transformGroup(act);
        return;
      }
      if (!K.sel) return;
      if (K.sel.kind === "open") {
        const o = state.openings.find(x => x.id === K.sel.id);
        if (!o) return;
        if (act === "w-") run(() => o.w = Math.max(0.2, +(o.w - 0.05).toFixed(2)));
        if (act === "w+") run(() => {
          o.w = +(o.w + 0.05).toFixed(2);
          clampOpenings();
        });
        if (act === "gond") run(() => o.hinge = o.hinge === "g" ? "d" : "g");
        if (act === "sens") run(() => o.swing = o.swing === "int" ? "ext" : "int");
        if (act === "kind") run(() => o.kind = o.kind === "porte" ? "fenetre" : o.kind === "fenetre" ? "garage" : "porte");   // v57 : porte de garage
      }
      if (act === "dup" && K.sel.kind === "app") {
        duplicateGroup();
      }
      if (act === "serie" && K.sel.kind === "app") {
        const inp = hudEl.querySelector('[data-h="n"]');
        if (inp) K.seriesN = Math.max(2, Math.min(40, Math.round(+inp.value || 3)));
        K.seriesMode = {
          src: K.sel.id,
          n: K.seriesN
        };
        K.seriesPrev = null;
        setHint("Série de " + K.seriesN + " : cliquez le point d'arrivée. Échap pour annuler.");
        draw();
      }
    };
  });
}

export function placeHud() {
  const kinds = ["open", "app", "seg", "room", "node", "dim"];
  const active = multi.size > 1 || K.sel && kinds.includes(K.sel.kind);
  if (!active || K.drag || K.pan || K.roomDraft || K.marquee || K.seriesMode) {
    hudEl.hidden = true;
    return;
  }
  const c = selCenter();
  if (!c) {
    hudEl.hidden = true;
    return;
  }
  const html = hudHTML();
  if (!html) {
    hudEl.hidden = true;
    return;
  }
  if (hudEl.contains(document.activeElement) && !hudEl.hidden) return; // ne pas reconstruire pendant une saisie
  hudEl.innerHTML = html + `<span class="vsep"></span><button data-h="close" class="mini" title="Fermer (Échap, ou cliquer dans le vide)">✕</button>`;
  wireHud();
  hudEl.querySelector('[data-h="close"]').onclick = () => { clearSel(); draw(); showSide(); };
  const p = worldToScreen(c.x, c.y);
  if (!p) {
    hudEl.hidden = true;
    return;
  }
  const r = stageEl.getBoundingClientRect();
  let left = Math.max(140, Math.min(r.width - 140, p.x)),
    top = Math.max(48, p.y - 34);
  hudEl.style.left = left + "px";
  hudEl.style.top = top + "px";
  hudEl.hidden = false;
}

// ---------- panneau ----------

