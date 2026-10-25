// Données de câblage calculées à partir du dessin (partagées par l'onglet Câblage et les pages Boîtes / Lignes directes).
import { getCab } from "../cablage/settings.js";
import { placeBoxes } from "../cablage/boites.js";
import { computeWiring } from "../cablage/gaines.js";

export function wiringNow(api) {
  const S = getCab(), items = api.allApps(), links = api.allLinks();
  return computeWiring({ items, links, circuits: api.cab.circuits || [], boxes: api.cab.boxes || [], levels: api.levels.map((l) => l.id), S });
}

// placement automatique des boîtes (tous niveaux) ; le tableau (ou, sur un autre niveau, sa projection) attire les boîtes
export function autoBoxes(api) {
  const S = getCab(), items = api.allApps(), links = api.allLinks();
  const tab = items.find((a) => a.t === "TAB");
  const tabs = {}; api.levels.forEach((l) => { if (tab) tabs[l.id] = { x: tab.x, y: tab.y }; });
  return placeBoxes(items, links, api.cab.circuits || [], tabs, S);
}

// couleur d'affichage d'un fil d'après son nom (réglages « Couleurs des fils »)
const CSS = { rouge: "#d42a2a", bleu: "#2459d6", "vert/jaune": "linear-gradient(90deg,#2c9b3a 50%,#f0d020 50%)", orange: "#f28c1b", violet: "#8a3ccf", noir: "#222",
  marron: "#7b4a12", gris: "#8a8a8a", blanc: "#f4f4f4", jaune: "#f0d020", vert: "#2c9b3a", rose: "#ee7fb5" };
export const wireCss = (c) => CSS[String(c || "").toLowerCase().trim()] || "#999";
export const fr = (v, d = 1) => (v == null ? "—" : Number(v).toFixed(d).replace(".", ","));
