// Données de câblage calculées à partir du dessin (partagées par l'onglet Câblage et les pages Boîtes / Lignes directes).
import { getCab } from "../cablage/settings.js";
import { placeBoxes } from "../cablage/boites.js";
import { computeWiring } from "../cablage/gaines.js";

export function wiringNow(api) {
  const S = getCab(), items = api.allApps(), links = api.allLinks();
  return computeWiring({ items, links, circuits: api.cab.circuits || [], boxes: api.cab.boxes || [], levels: api.levels.map((l) => l.id), S });
}

// placement automatique des boîtes (tous niveaux) ; le tableau (ou, sur un autre niveau, sa projection) attire les boîtes
// keepIds : boîtes gardées telles quelles (verrouillées ou décochées au recalcul)
export function autoBoxes(api, keepIds = []) {
  const S = getCab(), items = api.allApps(), links = api.allLinks();
  const tab = items.find((a) => a.t === "TAB");
  const tabs = {}; api.levels.forEach((l) => { if (tab) tabs[l.id] = { x: tab.x, y: tab.y }; });
  const keep = (api.cab.boxes || []).filter((b) => keepIds.includes(b.id));
  return placeBoxes(items, links, api.cab.circuits || [], tabs, S, { keep });
}

// couleur d'affichage d'un fil d'après son nom (réglages « Couleurs des fils »)
const CSS = { rouge: "#d42a2a", bleu: "#2459d6", "vert/jaune": "linear-gradient(90deg,#2c9b3a 50%,#f0d020 50%)", orange: "#f28c1b", violet: "#8a3ccf", noir: "#222",
  marron: "#7b4a12", gris: "#8a8a8a", blanc: "#f4f4f4", jaune: "#f0d020", vert: "#2c9b3a", rose: "#ee7fb5" };
export const wireCss = (c) => CSS[String(c || "").toLowerCase().trim()] || "#999";
export const fr = (v, d = 1) => (v == null ? "—" : Number(v).toFixed(d).replace(".", ","));

// couleur pleine (pour le SVG et le PDF) : vert/jaune → jaune (le schéma ajoute la moitié verte)
export const wireSolid = (c) => { const k = String(c || "").toLowerCase().trim(); return k === "vert/jaune" ? CSS.jaune : CSS[k] || "#999"; };

// repère d'orientation de chaque face : la pièce qu'on trouve en partant de la boîte dans cette direction
// (A = haut du plan, B = droite, C = bas, D = gauche) ; geo = exportGeometry(niveau de la boîte)
export function facesSides(box, geo, pointInPoly) {
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
