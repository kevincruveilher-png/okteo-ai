// Oktéo AI — cœur : Barres d'outils, contrôles, démarrage.
// Module issu du découpage de app.js (v26). L'état partagé est dans K (core/k.js).
import { pref, setPref } from "../prefs.js";
import { K } from "./k.js";
import * as CHS from "../chantiers.js";
import { CH, PAL, TYPES, dist, layers, node, nodeById, redo, state, uidS, undo } from "./model.js";
import { applyPack, load, markDirty, packState, paintStatus, save, snapshot } from "./persist.js";
import { applyOrtho, autoSymCm, fit, repMap, rotateView } from "./view.js";
import { draw, glyph } from "./render.js";
import { wallMounted } from "./attach.js";
import { APPAREILS, GROUPES } from "../cablage/appareils.js";
import { clearSel, currentGroup, duplicateGroup, groupCount, groupEmpty, instantiateGroup, multi, selectAll, serializeGroup, setSingle, transformGroup } from "./groups.js";
import { hideReadout, linkSummary, placeApp, posOnWall, showText, wallMeasure } from "./interact.js";
import { delSel, showSide } from "./panel.js";
import { levelsNow, loadFondImage } from "./levels.js";

// ---------- barres ----------
// icônes des outils (traits simples, couleur du texte)
export const TI = {
  sel: '<path d="M4 2l10 7-5 1-2 5z"/>',
  piece: '<rect x="3" y="4" width="12" height="10"/>',
  mur: '<path d="M2 12h14M2 6h14" stroke-width="2.4"/>',
  porte: '<path d="M3 15V4h2M5 4a10 10 0 0 1 10 10"/>',
  fenetre: '<rect x="2" y="7" width="14" height="4"/><path d="M9 7v4"/>',
  offset: '<path d="M3 4v11M8 4v11M12 7h4M14 5v4"/>',
  cote: '<path d="M2 9h14M2 6v6M16 6v6M5 9l-2 0M13 9h2"/>',
  pan: '<path d="M6 15c-2-2-3-5-3-7M6 15h6l2-5V5M9 9V3M12 9V4M6 9V5"/>',
  lien: '<path d="M3 13C6 3 12 3 15 13" stroke-dasharray="2 1.6"/>',
  calib: '<path d="M2 12l10-10 4 4-10 10z"/><path d="M5 9l1.5 1.5M7.5 6.5l1.5 1.5M10 4l1.5 1.5"/>',
  __test: '<path d="M5 3l10 6-10 6z"/>'
};

export const icon = k => `<svg class="ti" viewBox="0 0 18 18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">${TI[k] || ""}</svg>`;

// deux barres (v37) : « Implantation bâti » (murs, pièces, ouvertures, cotes, échelle) et « Implantation appareils »
// (symboles, liaisons, test) ; à droite, le filtre rapide de la vue
export function buildTools() {
  const t = document.getElementById("tools");
  const btn = (k, n, tip) => `<button data-tool="${k}" class="tb ${K.tool === k ? 'on' : ''}" title="${tip}">${icon(k)}<span class="tl">${n}</span></button>`;
  const bati = [["sel", "Sélection", "Sélection (V) : cliquer, glisser un cadre, déplacer"], ["piece", "Pièce", "Pièce (E) : un rectangle de murs"], ["mur", "Mur", "Mur (B) : murs enchaînés"], ["porte", "Porte", "Porte : cliquer sur un mur"], ["fenetre", "Fenêtre", "Fenêtre : cliquer sur un mur"], ["offset", "Cloison", "Cloison parallèle à un mur"], ["cote", "Cote", "Cote : deux points"], ["calib", "Échelle", "Échelle du plan : deux points d'une cote connue, ou 1/50"], ["pan", "Main", "Main : déplacer la vue"]];
  let h = `<div class="trow bati" role="toolbar" aria-label="Implantation bâti"><span class="tlab" title="Outils pour dessiner le bâtiment">Implantation<b>bâti</b></span>` + bati.map(([k, n, tip]) => btn(k, n, tip)).join("") + `</div>`;
  h += `<div class="trow appa" role="toolbar" aria-label="Implantation appareils"><span class="tlab" title="Outils pour poser l'appareillage et ses liaisons">Implantation<b>appareils</b></span>` + btn("lien", "Liaison", "Liaison : une commande puis ses lumières") +
    `<button data-tool="__test" class="tb ${K.testMode ? 'on' : ''}" title="Essai : cliquer un interrupteur allume ou éteint ses lumières, comme dans la maison (va-et-vient, télérupteur, disjoncteurs)">${icon("__test")}<span class="tl">Essai</span></button><span class="sep"></span>`;
  // appareils : le symbole tel qu'il est dessiné sur le plan (nom complet dans l'infobulle)
  const pb = k => `<button data-tool="${k}" class="pb ${K.tool === k ? 'on' : ''}" title="${TYPES[k].n}" aria-label="${TYPES[k].n}"><svg class="ticon" viewBox="-1.25 -1.35 2.5 2.7" aria-hidden="true">${glyph(k)}</svg></button>`;
  // v54 : « Autres ▾ » = les appareils du journal des règles (radiateurs, spécialisés, volets, courant faible…), par groupe
  const more = APPAREILS[K.tool];
  h += `<span class="palette" role="group" aria-label="Appareils">` + PAL.map(pb).join("") +
    `<span class="more-w"><button data-tool="__more" class="pb more ${more || K.moreOpen ? 'on' : ''}" title="Autres appareils : radiateurs, sèche-serviette, VMC, four, lave-linge, plaque, hotte, chauffe-eau, prises extérieures, volets roulants, interphone, TV, équipotentielles, gaine aiguillée…" aria-label="Autres appareils" aria-haspopup="true" aria-expanded="${!!K.moreOpen}"><svg class="ticon" viewBox="-1.25 -1.35 2.5 2.7" aria-hidden="true">${more ? glyph(K.tool) : `<circle cx="-0.7" r="0.22" class="gf"/><circle r="0.22" class="gf"/><circle cx="0.7" r="0.22" class="gf"/>`}</svg><span class="tl">Autres ▾</span></button>` +
    (K.moreOpen ? `<div class="more-pop" role="menu">${GROUPES.map(g => `<div class="mg"><b>${g}</b><div class="mgl">${Object.keys(APPAREILS).filter(t => APPAREILS[t].groupe === g).map(pb).map((x, i) => x.replace('class="pb', 'class="pb mi')).join("")}</div></div>`).join("")}</div>` : "") + `</span></span></div>`;
  t.innerHTML = h;
  t.querySelectorAll("button").forEach(btn => btn.onclick = () => {
    const v = btn.dataset.tool;
    if (v === "__more") {
      K.moreOpen = !K.moreOpen;
      if (!K.moreHook) {
        // le menu se ferme au clic ailleurs ou avec Échap
        K.moreHook = true;
        document.addEventListener("pointerdown", e => { if (K.moreOpen && !e.target.closest(".more-w")) { K.moreOpen = false; buildTools(); } });
        document.addEventListener("keydown", e => { if (K.moreOpen && e.key === "Escape") { K.moreOpen = false; buildTools(); } });
      }
      buildTools();
      return;
    }
    K.moreOpen = false;
    resetTransient();
    if (v === "__test") {
      K.testMode = !K.testMode;
      clearSel();
      buildTools();
      setHint(K.testMode ? "Mode essai : cliquez un interrupteur pour allumer ou éteindre ses lumières (un 2e clic les éteint). Va-et-vient : chacun inverse. Échap ou « Essai » pour sortir." : "");
      draw();
      showSide();
      return;
    }
    K.tool = v;
    K.testMode = false;
    clearSel();
    buildTools();
    setHint(hintFor(v));
    draw();
    showSide();
    if (v === "calib") document.dispatchEvent(new CustomEvent("okteo:ask"));
  });
  buildFilter();
}

// ---------- filtre rapide de la vue (v37) ----------
export const VIEW_KEYS = [["fond", "Fond", "Fond de plan (PDF ou image)"], ["murs", "Murs", "Murs, portes et fenêtres"], ["pieces", "Pièces", "Pièces : couleur, nom et surface"],
  ["appareils", "Appareils", "Symboles de l'appareillage et repères"], ["liaisons", "Liaisons", "Traits commande → lumière"], ["boites", "Boîtes", "Boîtes de pieuvre et leurs points d'accroche"],
  ["gaines", "Gaines", "Gaines boîte → appareils et alimentation"], ["cotes", "Cotes", "Cotes et longueurs des murs"], ["grille", "Quadrillage", "Quadrillage : 5 cm à 1 m selon le zoom, trait marqué tous les mètres"]];
export const VIEW_PRESETS = {
  bati: { name: "Bâti", key: "1", tip: "Le bâtiment seul : fond, murs, pièces, cotes", on: ["fond", "murs", "pieces", "cotes"], circ: false },
  impl: { name: "Implantation", key: "2", tip: "Le bâtiment et l'appareillage : appareils, liaisons, cotes", on: ["fond", "murs", "pieces", "appareils", "liaisons", "cotes"], circ: false },
  cab: { name: "Câblage", key: "3", tip: "Les circuits (couleur des symboles), les boîtes et leurs gaines", on: ["murs", "pieces", "appareils", "boites", "gaines"], circ: true }
};
const viewOn = k => (k === "murs" ? layers.murs.on && layers.ouvertures.on : layers[k].on);
function setView(k, v) {
  layers[k].on = v;
  if (k === "murs") layers.ouvertures.on = v;
}
export function viewPreset(id) {
  const P = VIEW_PRESETS[id];
  if (!P) return false;
  VIEW_KEYS.forEach(([k]) => setView(k, P.on.includes(k)));
  K.showCirc = P.circ;
  save();
  draw();
  buildFilter();
  showSide();
  setHint(`Vue « ${P.name} » : ${P.tip.toLowerCase()}.`);
  return true;
}
export function toggleView(k, v) {
  if (!layers[k]) return false;
  setView(k, v == null ? !viewOn(k) : !!v);
  // boîtes et gaines n'existent qu'avec l'affichage des circuits
  if ((k === "boites" || k === "gaines") && layers[k].on) K.showCirc = true;
  save();
  draw();
  buildFilter();
  showSide();
  return true;
}
export function buildFilter() {
  const f = document.getElementById("vfilter");
  if (!f) return;
  const cur = Object.entries(VIEW_PRESETS).find(([, P]) => VIEW_KEYS.every(([k]) => viewOn(k) === P.on.includes(k)) && !!K.showCirc === P.circ);
  f.innerHTML = `<div class="vrow"><span class="tlab">Vue</span>` + Object.entries(VIEW_PRESETS).map(([id, P]) => `<button data-vp="${id}" class="vp ${cur && cur[0] === id ? "on" : ""}" title="${P.tip} (Alt+${P.key})">${P.name}<kbd>Alt+${P.key}</kbd></button>`).join("") + `</div>` +
    `<div class="vrow chips">` + VIEW_KEYS.map(([k, n, tip]) => `<button data-vk="${k}" class="vk ${viewOn(k) && (k !== "boites" && k !== "gaines" || K.showCirc) ? "on" : ""}" aria-pressed="${viewOn(k)}" title="${tip} : afficher / masquer">${n}</button>`).join("") + `</div>`;
  f.innerHTML += `<div class="vrow chips">${[["ouvrants", "Ouvrants", "Afficher les battants et arcs pour dessiner les portes"], ["parcours", "Parcours complets", "Afficher le cheminement des alimentations et lignes directes à la place des flèches"]].map(([k,n,t]) => `<button data-pref="${k}" class="vk ${pref(k) ? "on" : ""}" aria-pressed="${!!pref(k)}" title="${t}">${n}</button>`).join("")}</div>`;
  f.querySelectorAll("[data-pref]").forEach(b => b.onclick = () => setPref(b.dataset.pref, !pref(b.dataset.pref)));
  f.querySelectorAll("[data-vp]").forEach(b => (b.onclick = () => viewPreset(b.dataset.vp)));
  f.querySelectorAll("[data-vk]").forEach(b => (b.onclick = () => toggleView(b.dataset.vk, !(viewOn(b.dataset.vk) && (b.dataset.vk !== "boites" && b.dataset.vk !== "gaines" || K.showCirc)))));
}
document.addEventListener("keydown", e => {
  if (!e.altKey || e.ctrlKey || e.metaKey) return;
  const tg = e.target && e.target.tagName;
  if (tg === "INPUT" || tg === "TEXTAREA" || tg === "SELECT") return;
  const id = Object.keys(VIEW_PRESETS).find(k => VIEW_PRESETS[k].key === e.key || "Digit" + VIEW_PRESETS[k].key === e.code);
  if (id) { e.preventDefault(); viewPreset(id); }
});

// échelle du plan saisie (1/50, 1/100…) : possible pour un fond PDF dont on connaît la largeur de la feuille (paperW, m)
export function applyRatio(N) {
  const pw = CH.fond && CH.fond.paperW;
  if (!(pw > 0) || !(N > 0) || !(K.BG.w > 0)) return false;
  K.calib = {
    a: { x: K.BG.x, y: K.BG.y },
    b: { x: K.BG.x + 1, y: K.BG.y },
    cur: null
  };
  const ok = applyCalib(pw * N / K.BG.w);
  if (ok) setHint(`Échelle 1/${N} appliquée (feuille de ${Math.round(pw * 1000)} mm de large). Vérifiez avec l'outil Cote sur une dimension connue.`);
  return ok;
}

export function applyCalib(L) {
  if (!K.calib || !K.calib.b) return false;
  const a = K.calib.a,
    d = dist(a.x, a.y, K.calib.b.x, K.calib.b.y);
  if (!(d > 0) || !(L > 0)) return false;
  const f = L / d;
  K.BG = {
    x: a.x + (K.BG.x - a.x) * f,
    y: a.y + (K.BG.y - a.y) * f,
    w: K.BG.w * f,
    h: K.BG.h * f
  };
  CH.fond = {
    ...CH.fond,
    x: K.BG.x,
    y: K.BG.y,
    w: K.BG.w,
    h: K.BG.h,
    calibre: true
  };
  CHS.update(CH.id, {
    fond: CH.fond
  });
  CH.levels = levelsNow();
  K.calib = null;
  K.sel = null;
  K.tool = "sel";
  buildTools();
  fit();
  showSide();
  setHint("Échelle réglée : " + L.toFixed(2) + " m entre les deux points (" + (f >= 1 ? "×" : "÷") + (f >= 1 ? f : 1 / f).toFixed(3) + "). Vérifiez avec l'outil Cote sur une autre dimension.");
  document.dispatchEvent(new CustomEvent("okteo:fond"));
  document.dispatchEvent(new CustomEvent("okteo:calibrated"));
  return true;
}

export function resetTransient() {
  K.calib = null;
  K.draftFrom = null;
  K.draftPt = null;
  K.typed = "";
  K.roomDraft = null;
  K.dimDraft = null;
  K.marquee = null;
  K.seriesMode = null;
  K.seriesPrev = null;
  K.ghost = null;
  K.endDrag = null;
  K.linkHot = null;
  K.linkLight = null;
  hideReadout();
}

export function hintFor(v) {
  const m = {
    sel: "Clic : sélectionner · glisser dans le vide : cadre de sélection · Maj+clic : ajouter · glisser un mur : le déplacer · Ctrl+A : tout. Molette : zoom · clic droit : vue.",
    piece: "Glissez un rectangle pour créer une pièce (murs + surface d'un coup).",
    mur: "Cliquez pour enchaîner les murs ; double-clic ou Échap pour finir ; tapez un nombre pour fixer la longueur.",
    porte: "Cliquez sur un mur pour y poser une porte qui le perce.",
    fenetre: "Cliquez sur un mur pour y poser une fenêtre.",
    offset: "Cliquez un mur, du côté voulu, puis indiquez la distance de la cloison parallèle.",
    calib: "Échelle du fond : zoomez sur une cote connue du plan (ex. 13,00), cliquez ses deux extrémités, puis tapez sa longueur réelle.",
    cote: "Cliquez deux points pour poser une cote mesurée.",
    pan: "Faites glisser pour déplacer la vue.",
    lien: linkSummary() + ". Cliquez une commande pour voir ses lumières, puis une lumière pour la relier ou la détacher ; cliquez une liaison pour la choisir (Suppr la retire)."
  };
  if (TYPES[v]) return "Pose : " + TYPES[v].n + ". L'outil reste actif." + (wallMounted(v) ? " Près d'un mur, tapez une distance en cm puis Entrée pour poser à cette distance de l'angle." : "");
  return m[v] || "";
}

// v58 : taille commune des noms de pièces (facteur 0,6 à 2,5) : un seul réglage pour toutes les pièces, écran et impression
export function setRoomTxt(f) {
  K.roomTxt = Math.max(0.6, Math.min(2.5, +f || 1));
  const el = document.getElementById("roomtxt"), v = document.getElementById("roomtxtv");
  if (el) el.value = Math.round(K.roomTxt * 100);
  if (v) v.textContent = Math.round(K.roomTxt * 100) + "%";
  draw();
  save();
}
export function setHint(s) {
  document.getElementById("hint").textContent = s || "";
}

export function buildTabs() {
  const el = document.getElementById("tabs");
  // v64 : onglets réunis : « Pieuvre » = Boîtes, Bandes et Lignes directes (sous-onglets en haut de la page)
  const items = [["chantiers", "Chantiers", null], ["plan", "Plan", null], ["etude", "Étude", null], ["boites", "Pieuvre", null], ["tableau", "Tableau", null], ["bibliotheque", "Symboles", null], ["params", "Paramètres", null]];
  const on = (k) => K.tab === k || (k === "boites" && PIEUVRE_TABS.includes(K.tab));
  el.innerHTML = items.map(([k, n, s]) => `<button data-tab="${k}" class="${on(k) ? 'on' : ''}${k === "params" ? " tab-params" : ""}" ${s ? 'disabled' : ''}${k === "boites" ? ' title="Boîtes, bandes de câblage et lignes directes du chantier"' : ""}><span class="lbl">${n}</span>${s ? `<span class="soon">${s}</span>` : ""}</button>`).join("");
  el.querySelectorAll("button").forEach(b => b.onclick = () => {
    if (b.disabled) return;
    setTab(b.dataset.tab === "boites" ? (PIEUVRE_TABS.includes(K.tab) ? K.tab : K.pieuvreSub || "boites") : b.dataset.tab);
  });
}

export const PIEUVRE_TABS = ["boites", "bandes", "lignes"];
export function setTab(t) {
  K.tab = t;
  if (PIEUVRE_TABS.includes(t)) K.pieuvreSub = t;
  buildTabs();
  showSide();
  document.dispatchEvent(new CustomEvent("okteo:tab", {
    detail: K.tab
  }));
  if (K.tab === "plan") requestAnimationFrame(draw);
}

// ---------- contrôles ----------

// initialisation (étape 6 du démarrage)
export function init6() {
// préférences d'affichage (Paramètres → Affichage, v42) : surfaces des pièces…
document.addEventListener("okteo:prefs", () => { draw(); showSide(); buildFilter(); });
// ---------- contrôles ----------
document.getElementById("bg").addEventListener("input", e => {
  K.bgLevel = +e.target.value / 100;
  document.getElementById("bgv").textContent = e.target.value + "%";
  draw();
  save();
});
document.getElementById("sym").addEventListener("input", e => {
  K.symCm = +e.target.value;
  K.symAuto = false;   // v58 : réglée à la main
  document.getElementById("symauto").checked = false;
  document.getElementById("symv").textContent = e.target.value;
  draw();
  save();
});
document.getElementById("symauto").addEventListener("change", e => {
  K.symAuto = e.target.checked;
  draw();
  document.getElementById("sym").value = Math.round(K.symCm);
  document.getElementById("symv").textContent = Math.round(K.symCm);
  save();
});
document.getElementById("roomtxt").addEventListener("input", e => setRoomTxt(+e.target.value / 100));
// v58 : tourner la vue (le dessin ne change pas)
document.getElementById("vr-ccw").addEventListener("click", () => rotateView(-90));
document.getElementById("vr-cw").addEventListener("click", () => rotateView(90));
document.getElementById("vr-180").addEventListener("click", () => rotateView(180));
document.getElementById("vr-0").addEventListener("click", () => rotateView(0, true));
document.getElementById("vr-deg").addEventListener("change", e => rotateView(+e.target.value || 0, true));
document.addEventListener("okteo:view-rot", e => { const el = document.getElementById("vr-deg"); if (el && document.activeElement !== el) el.value = e.detail.rot; setHint(e.detail.rot ? `Vue tournée de ${String(e.detail.rot).replace(".", ",")}° : le dessin, les relevés et l'impression ne changent pas. « 0° » remet la vue droite.` : "Vue droite d'origine."); });
document.getElementById("ortho").addEventListener("change", e => {
  K.ortho = e.target.checked;
  save();
});
document.getElementById("dims").addEventListener("change", e => {
  K.showDims = e.target.checked;
  draw();
  save();
});
document.getElementById("reps").addEventListener("change", e => {
  K.showReps = e.target.checked;
  draw();
  save();
});
document.getElementById("below").addEventListener("change", e => {
  K.showBelow = e.target.checked;
  draw();
  save();
});
document.getElementById("zin").onclick = () => {
  K.view.scale = Math.min(90, K.view.scale * 1.15);
  draw();
};
document.getElementById("zout").onclick = () => {
  K.view.scale = Math.max(2, K.view.scale / 1.15);
  draw();
};
document.getElementById("zfit").onclick = fit;
document.getElementById("undo").onclick = () => {
  if (!undo.length) return;
  redo.push(packState());
  applyPack(undo.pop());
  markDirty();
  draw();
  showSide();
};
document.getElementById("redo").onclick = () => {
  if (!redo.length) return;
  undo.push(packState());
  applyPack(redo.pop());
  markDirty();
  draw();
  showSide();
};
document.getElementById("export").onclick = () => {
  const data = {
    chantier: CH.nom + "_" + CH.numero,
    murs: {
      nodes: state.nodes,
      segs: state.segs,
      epaisseur: state.wallEp
    },
    pieces: state.rooms,
    ouvertures: state.openings,
    appareils: state.app,
    reperes: repMap(),
    liaisons: state.lia,
    cotes: state.dims
  };
  const t = JSON.stringify(data, null, 2);
  navigator.clipboard?.writeText(t).then(() => setHint("Chantier (JSON) copié."), () => {
    document.getElementById("sidebody").innerHTML = `<h3>Export JSON</h3><textarea style="width:100%;height:60vh;font-family:var(--fm);font-size:11px" readonly>${t.replace(/</g, "&lt;")}</textarea>`;
  });
};
document.getElementById("theme").onclick = () => {
  const r = document.documentElement;
  const cur = r.getAttribute("data-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  r.setAttribute("data-theme", cur === "dark" ? "light" : "dark");
  draw();
};
document.addEventListener("keydown", e => {
  if (/input|select|textarea/i.test(e.target.tagName)) return;
  const k = e.key.toLowerCase(),
    grp = multi.size > 1 || K.sel && K.sel.kind === "room";
  // saisie de longueur pendant le tracé d'un mur
  if (K.tool === "mur" && K.draftFrom) {
    if (/^[0-9]$/.test(e.key) || e.key === ".") {
      K.typed += e.key;
      draw();
      return;
    }
    if (e.key === "Backspace") {
      K.typed = K.typed.slice(0, -1);
      draw();
      return;
    }
    if (e.key === "Enter" && K.typed !== "") {
      const f = nodeById(K.draftFrom);
      let [ox, oy] = applyOrtho(f.x, f.y, K.draftPt ? K.draftPt.x : f.x + 1, K.draftPt ? K.draftPt.y : f.y);
      let dx = ox - f.x,
        dy = oy - f.y;
      const d = Math.hypot(dx, dy) || 1,
        L = +K.typed,
        nx = f.x + dx / d * L,
        ny = f.y + dy / d * L;
      const nd = node(nx, ny);
      snapshot();
      state.segs.push({
        id: uidS(),
        a: K.draftFrom,
        b: nd.id
      });
      K.draftFrom = nd.id;
      K.typed = "";
      markDirty();
      draw();
      return;
    }
  }
  // saisie d'une distance à l'angle pendant la pose d'un appareil mural
  if (TYPES[K.tool] && wallMounted(K.tool) && !e.ctrlKey) {
    if (/^[0-9]$/.test(e.key) && K.ghost && K.ghost.seg) {
      K.typed += e.key;
      const m = wallMeasure(K.ghost.seg, K.ghost.x, K.ghost.y);
      showText("⌨ " + K.typed + " cm de l'angle le plus proche · Entrée pour poser");
      return;
    }
    if (e.key === "Backspace" && K.typed !== "") {
      K.typed = K.typed.slice(0, -1);
      if (K.typed === "") hideReadout();else showText("⌨ " + K.typed + " cm de l'angle le plus proche · Entrée pour poser");
      return;
    }
    if (e.key === "Enter" && K.typed !== "" && K.ghost && K.ghost.seg) {
      const m = wallMeasure(K.ghost.seg, K.ghost.x, K.ghost.y);
      if (m) {
        snapshot();
        const p = posOnWall(m, m.dA <= m.dB, +K.typed / 100);
        const na = placeApp(K.tool, {
          x: p.x,
          y: p.y,
          seg: K.ghost.seg
        });
        setSingle("app", na.id);
        markDirty();
      }
      K.typed = "";
      hideReadout();
      draw();
      showSide();
      return;
    }
  }
  if (e.key === "Escape") {
    if (K.seriesMode) {
      K.seriesMode = null;
      K.seriesPrev = null;
      hideReadout();
      setHint(hintFor(K.tool));
      draw();
      return;
    }
    if (K.typed !== "") {
      K.typed = "";
      hideReadout();
      draw();
      return;
    }
    if (K.tool === "mur" && K.draftFrom) {
      K.draftFrom = null;
      K.draftPt = null;
      hideReadout();
      draw();
      return;
    }
    if (K.dimDraft) {
      K.dimDraft = null;
      hideReadout();
      draw();
      return;
    }
    if (K.testMode) {
      K.testMode = false;
      buildTools();
      setHint("");
      draw();
      showSide();
      return;
    }
    clearSel();
    resetTransient();
    if (K.tool !== "sel") {
      K.tool = "sel";
      buildTools();
    }
    setHint(hintFor("sel"));
    draw();
    showSide();
    return;
  }
  // boîte de pieuvre choisie sur le plan (sans autre sélection) : Suppr la supprime (traitée par l'onglet Câblage)
  if ((e.key === "Delete" || e.key === "Backspace") && K.showCirc && K.boxSel && !K.sel && multi.size <= 1) {
    e.preventDefault();
    document.dispatchEvent(new CustomEvent("okteo:box-delete", { detail: { id: K.boxSel } }));
    return;
  }
  if ((e.key === "Delete" || e.key === "Backspace") && K.tool === "lien" && K.linkHot) {
    e.preventDefault();
    const i = state.lia.findIndex(x => x.c === K.linkHot.c && x.l === K.linkHot.l);
    if (i >= 0) {
      snapshot();
      state.lia.splice(i, 1);
      markDirty();
    }
    K.linkHot = null;
    draw();
    setHint("Liaison retirée (Ctrl+Z pour annuler). " + hintFor("lien"));
    return;
  }
  if ((e.key === "Delete" || e.key === "Backspace") && (K.sel || multi.size > 1)) {
    e.preventDefault();
    delSel();
    return;
  }
  if (K.sel && K.sel.kind === "open" && !e.ctrlKey) {
    const o = state.openings.find(x => x.id === K.sel.id);
    if (o && k === "g") {
      snapshot();
      o.hinge = o.hinge === "g" ? "d" : "g";
      markDirty();
      draw();
      showSide();
      return;
    }
    if (o && k === "s") {
      snapshot();
      o.swing = o.swing === "int" ? "ext" : "int";
      markDirty();
      draw();
      showSide();
      return;
    }
  }
  if (e.ctrlKey && k === "z" && !e.shiftKey) {
    e.preventDefault();
    document.getElementById("undo").click();
    return;
  }
  if (e.ctrlKey && (k === "y" || e.shiftKey && k === "z")) {
    e.preventDefault();
    document.getElementById("redo").click();
    return;
  }
  if (e.ctrlKey && k === "a") {
    e.preventDefault();
    if (K.tool !== "sel") {
      K.tool = "sel";
      buildTools();
      setHint(hintFor("sel"));
    }
    selectAll();
    return;
  }
  if (e.ctrlKey && k === "c") {
    const G = currentGroup();
    if (!groupEmpty(G)) {
      K.clip = serializeGroup(G);
      e.preventDefault();
      setHint("Copié (" + groupCount(G) + " objet" + (groupCount(G) > 1 ? "s" : "") + "). Ctrl+V colle sous le curseur.");
    }
    return;
  }
  if (e.ctrlKey && k === "v" && K.clip && K.clip.nodes) {
    e.preventDefault();
    snapshot();
    const dx = Math.round((K.lastW.x - K.clip.cx) / K.gridM) * K.gridM,
      dy = Math.round((K.lastW.y - K.clip.cy) / K.gridM) * K.gridM;
    instantiateGroup(K.clip, dx, dy);
    if (K.tool !== "sel") {
      K.tool = "sel";
      buildTools();
    }
    markDirty();
    draw();
    showSide();
    return;
  }
  if (e.ctrlKey && k === "d") {
    e.preventDefault();
    duplicateGroup();
    return;
  }
  if (grp && !e.ctrlKey) {
    if (k === "r") {
      transformGroup(e.shiftKey ? "ccw" : "cw");
      return;
    }
    if (k === "x") {
      transformGroup("mx");
      return;
    }
    if (k === "y") {
      transformGroup("my");
      return;
    }
  }
  const map = {
    v: "sel",
    e: "piece",
    b: "mur",
    o: "porte",
    f: "fenetre",
    c: "cote",
    m: "pan",
    l: "lien",
    p: "PC16",
    r: "LUM",
    i: "INT"
  };
  if (map[k] && !e.ctrlKey && !e.altKey) {
    resetTransient();
    K.tool = map[k];
    K.testMode = false;
    if (K.tool !== "sel") clearSel();
    buildTools();
    setHint(hintFor(K.tool));
    draw();
    showSide();
  }
});

// init
// init
load();
buildTools();
buildTabs();
document.getElementById("bg").value = Math.round(K.bgLevel * 100);
document.getElementById("bgv").textContent = Math.round(K.bgLevel * 100) + "%";
if (K.symAuto) K.symCm = autoSymCm();
document.getElementById("sym").value = Math.round(K.symCm);
document.getElementById("symv").textContent = Math.round(K.symCm);
document.getElementById("symauto").checked = !!K.symAuto;
document.getElementById("roomtxt").value = Math.round((K.roomTxt || 1) * 100);
document.getElementById("vr-deg").value = K.view.rot || 0;
document.getElementById("roomtxtv").textContent = Math.round((K.roomTxt || 1) * 100) + "%";
document.getElementById("ortho").checked = K.ortho;
document.getElementById("dims").checked = K.showDims;
document.getElementById("reps").checked = K.showReps;
document.getElementById("below").checked = K.showBelow;
{
  const bd = document.querySelector(".badge");
  if (bd) {
    bd.textContent = CH.nom + (CH.numero ? " · " + CH.numero : "");
    bd.title = "Chantier ouvert (" + (CH.client || "pavillonneur ?") + ") : cliquez pour changer de chantier";
    bd.onclick = () => setTab("chantiers");
  }
}
document.title = "Oktéo AI · " + CH.nom;
fit();
setHint(hintFor(K.tool));
paintStatus();
showSide();
loadFondImage(true);
// nouveau fond pas encore à l'échelle : on enchaîne directement sur la mise à l'échelle
// nouveau fond pas encore à l'échelle : on enchaîne directement sur la mise à l'échelle
if (CH.fond && !CH.fond.calibre) {
  K.tool = "calib";
  buildTools();
  setHint("Nouveau fond : " + hintFor("calib"));
  showSide();
}
addEventListener("resize", draw);
// la zone de dessin change de taille quand le panneau de droite s'ouvre, se ferme ou s'élargit
// la zone de dessin change de taille quand le panneau de droite s'ouvre, se ferme ou s'élargit
if (window.ResizeObserver) new ResizeObserver(() => draw()).observe(document.querySelector(".stage"));

// ---------- niveaux ----------
}

