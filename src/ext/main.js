// Point d'entrée des extensions d'Oktéo AI : panneau de droite, assistant, palette Ctrl+K, page Paramètres, infobulles.
// Le cœur du logiciel (src/app.js) expose window.okteo ; tout ce qui est ici passe par cette interface.
import { buildCatalog, tooltipFor } from "./catalog.js";
import { createPalette } from "./palette.js";
import { createSidePanel } from "./panel.js";
import { createAssistant } from "./assistant.js";
import { settings, mountParams } from "./settings.js";
import { PROVIDERS, testProvider, serverStatus, listModels } from "./ai.js";
import { mountChantiers } from "./chantiers-page.js";
import { createWallsTool } from "./walls-ui.js";
import { createRoomsTool } from "./rooms-ui.js";
import { createPrintTool } from "./print-ui.js";
import { createDevicesTool } from "./devices-ui.js";
import { initBackup } from "./backup.js";

function start() {
  const api = window.okteo;
  const panel = createSidePanel();
  let assistant = null, palette = null;

  const hooks = {
    openAssistant: () => { panel.show("assistant"); assistant?.focus(); },
    analyse: () => { panel.show("assistant"); assistant?.analyse(); },
    openPalette: () => palette?.open(),
    detectWalls: () => walls.open(),
    detectRooms: () => rooms.open(),
    detectDevices: () => devices.open(),
    print: () => printer.open(),
  };
  const walls = createWallsTool({ api });
  const rooms = createRoomsTool({ api });
  const devices = createDevicesTool({ api });
  const printer = createPrintTool({ api });
  document.addEventListener("okteo:walls", () => walls.open());
  document.addEventListener("okteo:devices", () => devices.open());
  const catalog = buildCatalog(api, hooks);
  const getCatalog = () => catalog;

  palette = createPalette({ getCatalog, onAsk: (t) => { panel.show("assistant"); if (t.trim()) assistant.ask(t); else assistant.focus(); } });
  const asEl = panel.register({ id: "assistant", label: "Assistant", icon: "✦" });
  assistant = createAssistant(asEl, { api, getCatalog, openParams: () => api.setTab("params") });

  // ---------- pages pleine largeur (remplacent la zone de dessin quand leur onglet est actif) ----------
  const stage = document.querySelector(".stage");
  const pages = {
    params: { el: document.getElementById("params"), mount: (el) => mountParams(el, { PROVIDERS, testProvider, serverStatus, listModels }), ui: null },
    chantiers: { el: document.getElementById("chantiers"), mount: (el) => mountChantiers(el, { api }), ui: null },
  };
  const onTab = (t) => {
    stage.hidden = !!pages[t];
    for (const [k, pg] of Object.entries(pages)) {
      pg.el.hidden = k !== t;
      if (k === t) { if (!pg.ui) pg.ui = pg.mount(pg.el); else pg.ui.render(); }
    }
  };
  document.addEventListener("okteo:tab", (e) => onTab(e.detail));
  // une saisie attend dans Propriétés (échelle, cloison parallèle) : on l'affiche même si l'Assistant était ouvert
  document.addEventListener("okteo:ask", () => { panel.show("props"); setTimeout(() => document.querySelector("#sidebody input")?.focus(), 0); });
  onTab(api.tab);

  // ---------- infobulles des outils (la barre est reconstruite à chaque changement d'outil) ----------
  const tools = document.getElementById("tools");
  const tip = () => tools.querySelectorAll("button[data-tool]").forEach((b) => { const t = tooltipFor(catalog, b.dataset.tool); if (t && b.title !== t) b.title = t; });
  new MutationObserver(tip).observe(tools, { childList: true, subtree: true });
  tip();

  // ---------- barre du haut ----------
  document.getElementById("btn-palette").onclick = () => palette.open();
  // menu « Affichage » : s'ouvre au clic, se ferme au clic ailleurs ou avec Échap
  const pop = document.getElementById("pop-view"), popBtn = document.getElementById("btn-view"), popBody = pop.querySelector(".pop-body");
  const setPop = (open) => { popBody.hidden = !open; popBtn.setAttribute("aria-expanded", String(open)); popBtn.classList.toggle("on", open); };
  popBtn.onclick = (e) => { e.stopPropagation(); setPop(popBody.hidden); };
  document.addEventListener("pointerdown", (e) => { if (!popBody.hidden && !pop.contains(e.target)) setPop(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !popBody.hidden) setPop(false); });
  document.getElementById("btn-print").onclick = () => printer.open();
  document.getElementById("btn-assistant").onclick = () => { panel.toggle("assistant"); if (panel.state.pane === "assistant" && !panel.state.collapsed) assistant.focus(); };

  // ---------- raccourcis ----------
  document.addEventListener("keydown", (e) => {
    const typing = /input|select|textarea/i.test(e.target.tagName);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); palette.isOpen ? palette.close() : palette.open(); return; }
    if (e.key === "F1") { e.preventDefault(); palette.open(); return; }
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "?") { e.preventDefault(); palette.open(); return; }
    if (e.key.toLowerCase() === "a" && !palette.isOpen) { e.preventDefault(); hooks.openAssistant(); }
  });

  serverStatus().then((st) => settings.setEnv({ online: !!st.online, anthropic: !!st.anthropic, nvidia: !!st.nvidia }));

  // accès pour les tests et le débogage
  window.okteoExt = { panel, palette, assistant, catalog, settings, walls, rooms, devices, printer, backup: null };
  initBackup(api).then((b) => { window.okteoExt.backup = b; });
}

if (window.okteo) start(); else document.addEventListener("okteo:ready", start, { once: true });
