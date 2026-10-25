// « Relever les appareils du PDF » : prises, points lumineux, spots, interrupteurs, RJ45, sorties de câble, VMC,
// lus sur les symboles du plan du pavillonneur (sans IA), avec les liaisons commande → lumière.
// Aperçu sur le dessin, puis « Ajouter les appareils » (un seul Ctrl+Z). Les appareils muraux se collent à leur mur.
import { detectDevices } from "../walls/devices.js";
import { chantierPage, chantierTexts, pageMap } from "./pdf-page.js";
import { esc } from "./util.js";

const ORDER = ["PC16", "PC20", "RJ45", "INT", "VV", "LUM", "SPOT", "SC", "VMC"];

export function createDevicesTool({ api }) {
  const card = document.createElement("div");
  card.className = "wcard"; card.hidden = true; card.setAttribute("role", "dialog"); card.setAttribute("aria-label", "Relevé des appareils");
  document.querySelector(".stage").appendChild(card);
  let res = null, replace = true, links = true;

  const close = () => { card.hidden = true; api.setPreview(null); res = null; };
  const show = (html) => { card.innerHTML = `<div class="wcard-h"><b>Appareils</b><button class="wx" title="Fermer (Échap)">✕</button></div>${html}`; card.hidden = false; card.querySelector(".wx").onclick = close; };

  async function compute() {
    const P = await chantierPage(api);
    if (!P) return null;
    const texts = await chantierTexts(api);
    return detectDevices({ shapes: P.shapes, segs: P.segs }, texts, pageMap(api, P));
  }

  function render() {
    const existing = api.state.app.length;
    const by = res.stats.byType, n = res.devices.length;
    const rows = ORDER.filter((t) => by[t]).map((t) => `<div><span>${esc(api.TYPES[t].n)}</span><b class="num">${by[t]}</b></div>`).join("");
    show(`
      <p class="wbig"><b>${n}</b> appareils · <b>${res.links.length}</b> liaisons</p>
      <div class="wlist">${rows}</div>
      <p class="mut sm" id="d-h">${res.stats.hauteurs ? `Hauteurs lues sur le plan : ${res.stats.hauteurs} prise${res.stats.hauteurs > 1 ? "s" : ""} (« H:1.20m »…) ; les autres à la hauteur par défaut.` : "Aucune hauteur lue sur le plan : hauteurs par défaut."}</p>
      ${res.unknown.length ? `<p class="mut sm">${res.unknown.length} petit${res.unknown.length > 1 ? "s" : ""} cercle${res.unknown.length > 1 ? "s" : ""} non reconnu${res.unknown.length > 1 ? "s" : ""} (pointillés rouges : plaques de cuisson, robinets…) : à poser à la main s'il s'agit d'appareils.</p>` : ""}
      <label class="wck"><input type="checkbox" id="d-lia" ${links ? "checked" : ""}> Reprendre les liaisons commande → lumière</label>
      ${existing ? `<label class="wck"><input type="checkbox" id="d-rep" ${replace ? "checked" : ""}> Remplacer les ${existing} appareils existants</label>` : ""}
      <div class="wrow"><button class="on" id="d-ok">Ajouter les appareils</button><button id="d-no">Annuler</button></div>
      <p class="mut sm">Les prises, interrupteurs, RJ45 et sorties de câble se collent au mur le plus proche. Hauteurs modifiables dans le menu de l'appareil. À vérifier avant le câblage.</p>`);
    const rp = card.querySelector("#d-rep"); if (rp) rp.onchange = () => { replace = rp.checked; };
    const lk = card.querySelector("#d-lia"); lk.onchange = () => { links = lk.checked; api.setPreview({ devices: res.devices, links: links ? res.links : [], unknown: res.unknown }); };
    card.querySelector("#d-no").onclick = close;
    card.querySelector("#d-ok").onclick = () => {
      const r = api.importDevices(res.devices, links ? res.links : [], { replace: replace && existing > 0 });
      card.hidden = true; res = null;
      api.setHint(`${r.appareils} appareils ajoutés (${r.muraux} collés à un mur), ${r.liaisons} liaisons. Ctrl+Z pour annuler.`);
      document.dispatchEvent(new CustomEvent("okteo:devices-imported", { detail: r }));
    };
  }

  async function open() {
    if (api.tab !== "plan") api.setTab("plan");
    if (!api.ch.fond || !api.BG || !(api.BG.w > 0)) { show(`<p>Il faut un plan PDF en fond, mis à l'échelle : page Chantiers → importer le PDF, puis « Mettre à l'échelle ».</p>`); return; }
    show(`<p>Lecture des symboles du plan…</p>`);
    try { res = await compute(); } catch (e) { show(`<p class="warn">Échec de la lecture du PDF : ${esc(e.message)}</p>`); return; }
    if (!res) { show(`<p>Ce chantier n'a pas de PDF d'origine (fond image seulement) : le relevé a besoin du PDF. Réimportez le plan en PDF depuis la page Chantiers.</p>`); return; }
    if (!res.devices.length) { show(`<p>Aucun symbole d'appareil reconnu sur ce plan. Les symboles de ce pavillonneur sont peut-être différents : envoyez le PDF pour qu'on les ajoute.</p>`); return; }
    replace = api.state.app.length === 0 || api.state.app.every((a) => a.auto);
    api.setPreview({ devices: res.devices, links: links ? res.links : [], unknown: res.unknown });
    render();
  }

  document.addEventListener("okteo:rooms-imported", (e) => { if (e.detail && e.detail.devices) open(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !card.hidden) close(); });
  return { open, close, get result() { return res; } };
}
