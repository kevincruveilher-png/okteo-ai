// Données de câblage calculées à partir du dessin (partagées par l'onglet Câblage et les pages Boîtes / Lignes directes).
import { getCab } from "../cablage/settings.js";
import { placeBoxes, buildUnits, MODES } from "../cablage/boites.js";
import { computeWiring } from "../cablage/gaines.js";
import { circuitsByBox, computeCircuits } from "../cablage/circuits.js";
import { pointInPoly } from "../walls/rooms.js";
import { mesures, noter, noteOf } from "../cablage/qualite.js";

// appareil à l'extérieur : ni sur lui ni à 12 cm autour, aucune pièce (un appareil intérieur posé contre un mur
// touche sa pièce ; un appareil sur la façade est de l'autre côté du mur)
// réglages du câblage + choix du chantier qui changent le calcul (v56 : volets connectés, R-096)
export function cabS(api) { const cv = ((api.cab || {}).choix || {}).commandeVolet || ""; return { ...getCab(), commandeVolet: cv, voletsConnectes: cv === "connecte" }; }
export function markExterior(api, items) {
  const geos = new Map(), at = (lv) => { if (!geos.has(lv)) geos.set(lv, (api.exportGeometry(lv).rooms || []).filter((r) => r.poly && r.poly.length > 2)); return geos.get(lv); };
  const D = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];
  return items.map((a) => {
    // v56 : un moteur de volet (ou de Velux) est posé dans le mur, à la fenêtre : jamais « extérieur » (fils, pas câble)
    if (a.t === "TAB" || a.t === "VR" || a.t === "VEL") return a;
    const R = at(a.lv);
    if (!R.length) return a;
    const inside = D.some(([dx, dy]) => R.some((r) => pointInPoly(a.x + dx * 0.12, a.y + dy * 0.12, r.poly)));
    return inside ? a : { ...a, ext: true };
  });
}

export function wiringNow(api) {
  const S = cabS(api), items = markExterior(api, api.allApps()), links = api.allLinks();
  const W = computeWiring({ items, links, circuits: api.cab.circuits || [], boxes: api.cab.boxes || [], levels: api.levels.map((l) => l.id), S });
  // v56 : le plan suit le découpage des gaines (une gaine coupée en deux par R-073 = deux points d'accroche)
  if (api.setGaineGroups) {
    const m = {};
    W.boxes.forEach((b) => { const g = (m[b.id] = {}); b.gaines.forEach((x) => (x.appIds || []).forEach((id) => (g[id] = x.appIds[0]))); });
    api.setGaineGroups(m);
  }
  return W;
}

// placement automatique des boîtes (tous niveaux) ; le tableau (ou, sur un autre niveau, sa projection) attire les boîtes
// keepIds : boîtes gardées telles quelles (verrouillées ou décochées au recalcul) ; mode : proximite | equilibre | piece
export function roomsByLevel(api) {
  const out = {};
  api.levels.forEach((l) => { out[l.id] = (api.exportGeometry(l.id).rooms || []).filter((r) => r.poly && r.poly.length > 2).map((r) => ({ name: r.name, poly: r.poly })); });
  return out;
}
export function autoBoxes(api, keepIds = [], count = 0, mode = (api.cab.mode || "proximite"), circuits = api.cab.circuits || []) {
  const S = cabS(api), items = api.allApps(), links = api.allLinks();
  const tab = items.find((a) => a.t === "TAB");
  const tabs = {}; api.levels.forEach((l) => { if (tab) tabs[l.id] = { x: tab.x, y: tab.y }; });
  const keep = (api.cab.boxes || []).filter((b) => keepIds.includes(b.id));
  return placeBoxes(items, links, circuits, tabs, S, { keep, count, mode, rooms: mode === "piece" ? roomsByLevel(api) : {}, volets: (api.cab.choix || {}).volets || "" });
}

// comparatif des modes de pieuvre (v39) : pour chacun, les boîtes, les circuits qui en découlent et les chiffres
// (boîtes, circuits, cuivre, gaine, départs par boîte, alertes) ; les boîtes verrouillées restent en place partout
export function compareModes(api) {
  const S = cabS(api), items = api.allApps(), links = api.allLinks();
  const keepIds = (api.cab.boxes || []).filter((b) => b.locked).map((b) => b.id);
  const base = (api.cab.circuits || []).length ? api.cab.circuits : computeCircuits(items, links, S);
  const ext = markExterior(api, items), levels = api.levels.map((l) => l.id);
  const res = Object.entries(MODES).map(([mode, name]) => {
    const r = autoBoxes(api, keepIds, 0, mode, base);
    const circuits = S.circuitsParBoite ? circuitsByBox(items, links, r.boxes, S) : base;
    const W = computeWiring({ items: ext, links, circuits, boxes: r.boxes, levels, S });
    const dep = W.boxes.map((b) => b.gaines.length);
    const mean = dep.reduce((s, v) => s + v, 0) / (dep.length || 1);
    const q = mesures(W, { items, boxes: r.boxes, S });
    return { mode, name, boxes: r.boxes, circuits, W, q, issues: [...r.issues, ...W.issues.filter((x) => !/télérupteur au tableau|sans commande|ne commande aucune/.test(x))],
      m: { boites: r.boxes.length, circuits: circuits.filter((c) => !c.direct && c.kind !== "comm").length, cuivre: W.totals.cuivre, gaine: W.totals.gaine,
        depMin: Math.min(...dep), depMax: Math.max(...dep), ecart: +Math.sqrt(dep.reduce((s, v) => s + (v - mean) ** 2, 0) / (dep.length || 1)).toFixed(1),
        croise: q.croise, terr: q.terr, longues: q.longues,
        pieces: (() => { const n = r.boxes.map((b) => new Set(b.apps.map((id) => items.find((a) => a.id === id)?.room).filter(Boolean)).size); return n.length ? Math.max(...n) : 0; })() } };
  });
  // v62 : note « belle pieuvre » commune, les propositions comparées entre elles
  const N = noter(res.map((r) => r.q));
  res.forEach((r, i) => { r.note = N[i]; r.m.note = N[i].note; });
  return res;
}
// v62 : note « belle pieuvre » de la pieuvre actuelle du chantier (sans comparaison : cuivre, gaine et boîtes non relatifs)
export function noteNow(api, W = null) {
  if (!(api.cab.boxes || []).length) return null;
  try { W = W || wiringNow(api); } catch { return null; }
  const q = mesures(W, { items: api.allApps(), boxes: api.cab.boxes, S: cabS(api) });
  return { q, ...noteOf(q) };
}

// couleur d'affichage d'un fil d'après son nom (réglages « Couleurs des fils »)
const CSS = { rouge: "#d42a2a", bleu: "#2459d6", "vert/jaune": "linear-gradient(90deg,#2c9b3a 50%,#f0d020 50%)", orange: "#f28c1b", violet: "#8a3ccf", noir: "#222",
  marron: "#7b4a12", gris: "#8a8a8a", blanc: "#f4f4f4", jaune: "#f0d020", vert: "#2c9b3a", rose: "#ee7fb5",
  "bleu foncé": "#0b2a8a", "bleu fonce": "#0b2a8a", "bleu clair": "#7fd3f0", ivoire: "#efe6c4", beige: "#d9c79e" };
export const wireCss = (c) => CSS[String(c || "").toLowerCase().trim()] || "#999";
export const fr = (v, d = 1) => (v == null ? "—" : Number(v).toFixed(d).replace(".", ","));

// couleur pleine (pour le SVG et le PDF) : vert/jaune → jaune (le schéma ajoute la moitié verte)
export const wireSolid = (c) => { const k = String(c || "").toLowerCase().trim(); return k === "vert/jaune" ? CSS.jaune : CSS[k] || "#999"; };

// repère d'orientation de chaque face : la pièce qu'on trouve en partant de la boîte dans cette direction
// (A = haut du plan, B = droite, C = bas, D = gauche) ; geo = exportGeometry(niveau de la boîte)
// v47 (Kévin) : la pièce d'une face = la pièce des appareils desservis par ses gaines (la plus fréquente) ; à égalité,
// ou sans appareil, la pièce vers laquelle la face regarde ; une face qui n'a que l'alimentation = « Tableau »
export function facesSides(box, geo, pointInPoly) {
  const look = facesLook(box, geo, pointInPoly), out = { under: look.under };
  for (const f of ["A", "B", "C", "D"]) {
    const G = (box.gaines || []).filter((g) => g.face === f), cnt = new Map();
    G.filter((g) => g.kind === "app" && g.room).forEach((g) => cnt.set(g.room, (cnt.get(g.room) || 0) + 1));
    const best = [...cnt].sort((p, q) => q[1] - p[1]);
    const lookName = String(look[f] || "").replace(/^côté /, "");
    if (best.length && (best.length === 1 || best[0][1] > best[1][1])) out[f] = best[0][0];
    else if (best.length) out[f] = best.some(([r]) => r === lookName) ? lookName : best[0][0];
    else if (G.some((g) => g.kind === "alim")) out[f] = "Tableau";
    else out[f] = lookName === "façade (extérieur)" ? "façade" : lookName;
  }
  return out;
}
// pièce vers laquelle chaque face regarde (v33)
export function facesLook(box, geo, pointInPoly) {
  const R = (geo && geo.rooms) || [];
  const at = (x, y) => R.find((r) => r.poly && r.poly.length > 2 && pointInPoly(x, y, r.poly));
  const under = at(box.x, box.y);
  const out = { under: under ? under.name : null };
  for (const [f, dx, dy] of [["A", 0, -1], ["B", 1, 0], ["C", 0, 1], ["D", -1, 0]]) {
    // on avance dans la direction de la face : la 1re autre pièce rencontrée ; plus de 0,8 m hors de toute pièce
    // (au-delà de l'épaisseur d'un mur) = la façade
    let txt = null, gap = 0;
    for (let d = 0.2; d <= 12 && !txt; d += 0.1) {
      const r = at(box.x + dx * d, box.y + dy * d);
      if (!r) { gap += 0.1; if (gap > 0.8) txt = "côté façade (extérieur)"; continue; }
      gap = 0;
      if (!under || r.name !== under.name) txt = "côté " + r.name;
    }
    out[f] = txt || (under ? "côté " + under.name : "");
  }
  return out;
}

// supprimer une boîte : chaque allumage (ou appareil seul) qu'elle desservait part dans la boîte la plus proche du même
// niveau ; sans autre boîte sur ce niveau, ses appareils restent sans boîte (alerte dans la liste)
export function removeBoxPlan(api, id) {
  const B = api.cab.boxes || [], box = B.find((b) => b.id === id);
  if (!box) return null;
  const inBox = new Set(box.apps), rest = B.filter((b) => b.id !== id).map((b) => ({ ...b, apps: [...b.apps] }));
  const units = buildUnits(api.allApps(), api.allLinks(), api.cab.circuits || []), moved = {};
  let orphan = 0;
  for (const u of units) {
    const ids = u.ids.filter((i) => inBox.has(i));
    if (!ids.length) continue;
    const cand = rest.filter((b) => b.lv === u.lv).sort((p, q) => Math.hypot(p.x - u.x, p.y - u.y) - Math.hypot(q.x - u.x, q.y - u.y))[0];
    if (!cand) { orphan += ids.length; continue; }
    ids.forEach((i) => { if (!cand.apps.includes(i)) cand.apps.push(i); });
    moved[cand.n] = (moved[cand.n] || 0) + ids.length;
  }
  return { boxes: rest, moved, orphan, name: box.n };
}
