// Oktéo AI — cœur : Chantier ouvert, modèle (murs, pièces, appareils), types d'appareils, géométrie de base.
// Module issu du découpage de app.js (v26). L'état partagé est dans K (core/k.js).
import { K } from "./k.js";
import * as CHS from "../chantiers.js";
import { pxPerVB } from "./view.js";

// ---------- chantier ouvert ----------
// Un seul chantier est chargé à la fois ; changer de chantier recharge la page (état propre, annuler/rétablir compris).
export const CH = CHS.current();

export const LKEYS = ["nodes", "segs", "rooms", "app", "lia", "openings", "dims"];

// aperçu d'un relevé automatique : {nodes, walls, openings} | {rooms} | {devices, links, unknown}
export const PLAN = {
  w: 16,
  h: 11
};

export const state = {
  nodes: [],
  segs: [],
  rooms: [],
  app: [],
  lia: [],
  openings: [],
  dims: [],
  wallEp: 0.20
};

export const layers = {
  fond: {
    on: true,
    lock: false
  },
  pieces: {
    on: true,
    lock: false
  },
  murs: {
    on: true,
    lock: false
  },
  ouvertures: {
    on: true,
    lock: false
  },
  appareils: {
    on: true,
    lock: false
  },
  liaisons: {
    on: true,
    lock: false
  },
  cotes: {
    on: true,
    lock: false
  },
  // v37 : filtre de la vue (boîtes et gaines visibles seulement avec l'affichage des circuits)
  boites: {
    on: true,
    lock: false
  },
  gaines: {
    on: true,
    lock: false
  },
  grille: {
    on: true,
    lock: false
  }
};

export const TYPES = {
  PC16: {
    n: "Prise 16 A",
    h: 30,
    r: "P"
  },
  PC20: {
    n: "Prise 20 A",
    h: 30,
    r: "P"
  },
  RJ45: {
    n: "RJ45",
    h: 30,
    r: "R"
  },
  LUM: {
    n: "Point lumineux",
    h: null,
    r: "L"
  },
  APP: {
    n: "Applique",
    h: 180,
    r: "AP"
  },
  SPOT: {
    n: "Spot",
    h: null,
    r: "S"
  },
  INT: {
    n: "Interrupteur",
    h: 110,
    r: "I"
  },
  VV: {
    n: "Va-et-vient",
    h: 110,
    r: "VV"
  },
  BP: {
    n: "Bouton poussoir",
    h: 110,
    r: "BP"
  },
  VMC: {
    n: "VMC",
    h: null,
    r: "V"
  },
  TAB: {
    n: "Tableau",
    h: null,
    r: "TD"
  },
  SC: {
    n: "Sortie de câble",
    h: null,
    r: "SC"
  }
};

export const PAL = ["PC16", "PC20", "RJ45", "LUM", "APP", "SPOT", "INT", "VV", "BP", "VMC", "SC", "TAB"];

export const VB = {
  w: 100,
  h: 70
};

export const undo = [],
  redo = [];

export const symScaleOf = () => K.symCm / 180;

// à l'écran, un symbole ne descend jamais sous 12 px de diamètre (vue d'ensemble lisible)
export const pmNow = () => 1 / (pxPerVB() * K.view.scale);

export const symView = () => Math.max(symScaleOf(), 12 * pmNow() / 1.8);

export const uidN = () => "n" + ++K.NID,
  uidS = () => "s" + ++K.SID,
  uidA = () => "a" + ++K.AID,
  uidR = () => "r" + ++K.RID,
  uidO = () => "o" + ++K.OID,
  uidD = () => "d" + ++K.DID;

export function node(x, y) {
  const n = {
    id: uidN(),
    x: +x.toFixed(3),
    y: +y.toFixed(3)
  };
  state.nodes.push(n);
  return n;
}

export function nodeById(id) {
  return state.nodes.find(n => n.id === id);
}

export function segById(id) {
  return state.segs.find(s => s.id === id);
}

export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

// épaisseur d'un mur : la sienne (murs relevés du PDF) sinon l'épaisseur par défaut du chantier
// limite de pièce (s.virt) : sépare deux pièces sans mur (séjour / dégagement), épaisseur nulle
export const epOf = s => s && s.virt ? 0 : s && s.ep > 0 ? s.ep : state.wallEp;

// demi-épaisseur des AUTRES murs qui arrivent à un sommet (pour mesurer depuis la face intérieure)
export const cornerHalf = (nodeId, exceptId) => {
  let m = 0;
  state.segs.forEach(s => {
    if (s.id !== exceptId && (s.a === nodeId || s.b === nodeId)) m = Math.max(m, epOf(s));
  });
  return m / 2;
};

export function segLen(s) {
  const a = nodeById(s.a),
    b = nodeById(s.b);
  return a && b ? dist(a.x, a.y, b.x, b.y) : 0;
}

export function segDir(s) {
  const a = nodeById(s.a),
    b = nodeById(s.b),
    L = segLen(s) || 1;
  return {
    ux: (b.x - a.x) / L,
    uy: (b.y - a.y) / L,
    a,
    b,
    L
  };
}

// ---------- historique / persistance ----------

// initialisation (étape 1 du démarrage)
export function init1() {
// niveaux (RDC, R+1…) : le dessin du niveau ouvert est dans `state`, les autres dans LV.data ; chacun a son fond
if (!CH.level) CH.level = "rdc";
CH.levels = CHS.levelsOf(CH);
{
  const L = CH.levels.find(l => l.id === CH.level);
  if (!L) CH.level = CH.levels[0].id;else if (L.fond !== undefined && JSON.stringify(L.fond) !== JSON.stringify(CH.fond)) CH.fond = L.fond;
}
K.LV = {
  cur: CH.level,
  data: {}
};
K.fondSeq = 0;
K.FOND = CH.fond && CH.fond.src === "asset" ? CH.fond.url : "";
// image du fond (URL) ; chargée depuis IndexedDB sinon
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
K.calib = null;
// mise à l'échelle en cours : {a,b,cur}
K.preview = null;
// ---------- modèle ----------
K.NID = 0;
K.SID = 0;
K.AID = 0;
K.RID = 0;
K.OID = 0;
K.DID = 0;
K.tool = "piece";
K.sel = null;
K.testMode = false;
K.essai = null; // mode essai (v45) : {sw: état des commandes, tl: télérupteurs, off: circuits coupés}
K.ctl = []; // contrôle permanent (v43) : liste des anomalies
K.ctlSig = "";
K.tab = "plan";
K.draftFrom = null;
K.draftPt = null;
K.typed = "";
K.roomDraft = null;
K.dimDraft = null;
K.showDims = true;
K.showReps = true;
K.showBelow = true;
// câblage du chantier (tous niveaux) : circuits [{id, n, kind, label, section, prot, apps:[ids], direct}]
K.CAB = {
  circuits: [],
  boxes: []
};
K.showCirc = false;
K.boxDrag = null;
K.routeDrag = null;
K.endDrag = null; // bout de gaine tiré vers une autre boîte ({from, id, x, y, ax, ay})
K.wpClick = null; // dernier clic sur un point de passage (double-clic maison) // point de passage de gaine en cours de déplacement ({id, key, i, snap})
K.linkHot = null; // liaison choisie avec l'outil Liaison ({c, l})
K.linkLight = null; // lumière cliquée avec l'outil Liaison (ses commandes ressortent)
K.boxSel = null;
K.__boxLayer = "";
K.bgLevel = 0.60;
K.symCm = 20;
K.ortho = true;
K.gridM = 0.05;
K.view = {
  cx: PLAN.w / 2,
  cy: PLAN.h / 2,
  scale: 1
};
K.dirty = false;
K.clip = null;
K.lastW = {
  x: PLAN.w / 2,
  y: PLAN.h / 2
};
}

