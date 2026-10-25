// Oktéo AI — cœur : Historique (annuler / rétablir) et enregistrement dans le navigateur.
// Module issu du découpage de app.js (v26). L'état partagé est dans K (core/k.js).
import { K } from "./k.js";
import * as CHS from "../chantiers.js";
import { CH, LKEYS, layers, redo, state, undo } from "./model.js";
import { applyLevelFond, levelsNow } from "./levels.js";

// ---------- historique / persistance ----------
export function packState() {
  const other = {};
  for (const [id, d] of Object.entries(K.LV.data)) if (id !== K.LV.cur) other[id] = d;
  return JSON.stringify({
    nodes: state.nodes,
    segs: state.segs,
    rooms: state.rooms,
    app: state.app,
    lia: state.lia,
    openings: state.openings,
    dims: state.dims,
    wallEp: state.wallEp,
    level: K.LV.cur,
    other,
    levels: levelsNow().map(l => ({
      id: l.id,
      name: l.name
    }))
  });
}

export function snapshot() {
  if (K.batching) return;
  undo.push(packState());
  if (undo.length > 80) undo.shift();
  redo.length = 0;
}

export function applyPack(s) {
  const o = JSON.parse(s);
  LKEYS.forEach(k => state[k] = o[k] || []);
  if (o.wallEp) state.wallEp = o.wallEp;
  K.sel = null;
  K.LV.data = o.other || {};
  // liste des niveaux (noms, ordre) reprise de l'historique ; le fond de chaque niveau reste celui enregistré
  if (Array.isArray(o.levels) && o.levels.length) {
    const now = levelsNow(),
      byId = {
        ...((CHS.get(CH.id) || CH).levelsTrash || {}),
        ...Object.fromEntries(now.map(l => [l.id, l]))
      };
    const next = o.levels.map(l => ({
      ...(byId[l.id] || {
        fond: null
      }),
      id: l.id,
      name: l.name
    }));
    if (JSON.stringify(next.map(l => [l.id, l.name])) !== JSON.stringify(now.map(l => [l.id, l.name]))) {
      Object.assign(CH, CHS.update(CH.id, {
        levels: next
      }) || {});
      CH.levels = CHS.levelsOf(CH);
      document.dispatchEvent(new CustomEvent("okteo:level", {
        detail: {
          id: K.LV.cur
        }
      }));
    }
  }
  const lv = o.level || K.LV.cur;
  if (lv !== K.LV.cur) {
    K.LV.cur = lv;
    if (CH.levels.some(l => l.id === lv)) applyLevelFond();
  }
}

export const packData = () => ({
  s: packState(),
  view: K.view,
  bg: K.bgLevel,
  sym: K.symCm,
  ortho: K.ortho,
  dims: K.showDims,
  reps: K.showReps,
  below: K.showBelow,
  layers
});

export function writeNow() {
  try {
    localStorage.setItem(K.KEY, JSON.stringify(packData()));
    K.dirty = false;
    const all = [state, ...Object.entries(K.LV.data).filter(([id]) => id !== K.LV.cur).map(([, d]) => d)],
      sum = k => all.reduce((n, d) => n + (d[k] || []).length, 0);
    CHS.update(CH.id, {
      updated: Date.now(),
      stats: {
        pieces: sum("rooms"),
        murs: sum("segs"),
        appareils: sum("app"),
        niveaux: CH.levels.length
      }
    });
    const was = K.saveFail;
    K.saveFail = null;
    paintStatus();
    document.dispatchEvent(new CustomEvent("okteo:saved", {
      detail: {
        recovered: !!was
      }
    }));
    return true;
  } catch (e) {
    K.saveFail = String(e && e.message || e);
    paintStatus();
    document.dispatchEvent(new CustomEvent("okteo:save-error", {
      detail: {
        message: K.saveFail
      }
    }));
    return false;
  }
}

export function save() {
  clearTimeout(K.saveT);
  K.saveT = setTimeout(writeNow, 400);
}
// identifiants uniques sur TOUS les niveaux (un appareil garde son identifiant d'un niveau à l'autre)

// identifiants uniques sur TOUS les niveaux (un appareil garde son identifiant d'un niveau à l'autre)
export function bumpIds() {
  const all = [state, ...Object.values(K.LV.data)];
  const mx = (arr, cur) => {
    (arr || []).forEach(o => {
      const k = +String(o.id).slice(1);
      if (k > cur) cur = k;
    });
    return cur;
  };
  all.forEach(d => {
    K.NID = mx(d.nodes, K.NID);
    K.SID = mx(d.segs, K.SID);
    K.AID = mx(d.app, K.AID);
    K.RID = mx(d.rooms, K.RID);
    K.OID = mx(d.openings, K.OID);
    K.DID = mx(d.dims, K.DID);
  });
}

export function load() {
  try {
    const r = localStorage.getItem(K.KEY);
    if (!r) return;
    const o = JSON.parse(r);
    if (o.s) applyPack(o.s);
    if (o.view) K.view = o.view;
    if (typeof o.bg === "number") K.bgLevel = o.bg;
    if (typeof o.sym === "number") K.symCm = o.sym;
    if (typeof o.ortho === "boolean") K.ortho = o.ortho;
    if (typeof o.dims === "boolean") K.showDims = o.dims;
    if (typeof o.reps === "boolean") K.showReps = o.reps;
    if (typeof o.below === "boolean") K.showBelow = o.below;
    if (o.layers) Object.assign(layers, o.layers);
    bumpIds();
  } catch (e) {}
}

export function markDirty() {
  K.dirty = true;
  save();
  paintStatus();
}

export function paintStatus() {
  const d = document.getElementById("savedot"),
    t = document.getElementById("savetxt"),
    c = d.parentElement;
  c.classList.toggle("err", !!K.saveFail);
  c.title = K.saveFail ? "L'enregistrement dans le navigateur a échoué : " + K.saveFail + ". Enregistrez le chantier en fichier (page Chantiers → Fichier)." : "Le dessin s'enregistre tout seul dans ce navigateur.";
  if (K.saveFail) {
    d.classList.add("dirty");
    t.textContent = "⚠ Non enregistré";
  } else if (K.dirty) {
    d.classList.add("dirty");
    t.textContent = "Non synchronisé";
  } else {
    d.classList.remove("dirty");
    t.textContent = "Enregistré";
  }
}

// ---------- vue ----------
// la zone de dessin prend exactement les proportions de l'écran : pas de bandes, pas de décalage entre clic et affichage

// initialisation (étape 2 du démarrage)
export function init2() {
K.batching = false;
K.KEY = CH.key;
K.saveT = null;
// enregistrement dans le navigateur ; un échec (stockage plein, navigation privée…) est SIGNALÉ, jamais silencieux
K.saveFail = null;
}

