// Point d'entrée des extensions d'Oktéo AI : panneau de droite, assistant, palette Ctrl+K, page Paramètres, infobulles.
// Le cœur du logiciel (src/app.js) expose window.okteo ; tout ce qui est ici passe par cette interface.
import { mountSymbols } from "./symbols-ui.js";
import { buildCatalog, tooltipFor } from "./catalog.js";
import { createPalette } from "./palette.js";
import { createSidePanel } from "./panel.js";
import { createAssistant } from "./assistant.js";
import { mountEtudePage, createDoubts, createWhy, cabler } from "./etude-ui.js";
import { settings, mountParams } from "./settings.js";
import { PROVIDERS, testProvider, serverStatus, listModels } from "./ai.js";
import { mountChantiers } from "./chantiers-page.js";
import { createWallsTool } from "./walls-ui.js";
import { squareOptions, squareText } from "../walls/squaring.js";
import { getPrefs } from "../prefs.js";
import { createRoomsTool } from "./rooms-ui.js";
import { createPrintTool } from "./print-ui.js";
import { createPrepTool } from "./prep-ui.js";
import { createDevicesTool } from "./devices-ui.js";
import { initBackup } from "./backup.js";
import { createLevelsBar } from "./levels.js";
import { createTour } from "./tour.js";
import { createCablagePane } from "./cablage-ui.js";
import { createPacksPane } from "./packs-ui.js";
import { createControl, describe as ctlDescribe } from "./controle-ui.js";
import { createEssai } from "./essai-ui.js";
import { mountBoxesPage, mountDirectPage } from "./cablage-pages.js";
import { createAiReleve } from "./ai-releve.js";
import { createRecheck } from "./ai-recheck-ui.js";
import { createIaMode } from "./ia-mode.js";
import { createAiModes } from "./ai-modes-ui.js";
import { createModeRunner } from "./ai-modes-run.js";
import { createOneCard } from "./one-card.js";
import { createHomeShell } from "./home-shell.js";
import { createTemps } from "./temps.js";
import { ensurePaperW, chantierScaleCheck } from "./pdf-page.js";
import { mountBandsPage } from "./cablage-bandes.js";
import { mountTableauPage } from "./tableau-page.js";
import { mountVue3d } from "./vue3d.js";
import { createWhyBlink } from "./why-blink.js";

function start() {
  const api = window.okteo;
  const panel = createSidePanel();
  let assistant = null, palette = null;

  const hooks = {
    openAssistant: () => { panel.show("assistant"); assistant?.focus(); },
    dictate: () => { panel.show("assistant"); assistant?.dictate(); },
    analyse: () => { panel.show("assistant"); assistant?.analyse(); },
    openPalette: () => palette?.open(),
    detectWalls: () => walls.open(),
    // n° 14 : murs du niveau ouvert mis d'équerre (réglages de Paramètres → Murs), compte rendu dans la barre d'aide
    squareWalls: () => {
      if (api.tab !== "plan") api.setTab("plan");
      const R = api.squareWalls(squareOptions(getPrefs()));
      const t = R ? "Murs : " + squareText(R) + (R.biais.length + R.verifier.length + R.refus.length ? " · Ctrl+Z annule." : "") : "Aucun mur à mettre d'équerre sur ce niveau.";
      api.setHint(t);
      return t;
    },
    detectRooms: () => rooms.open(),
    detectDevices: () => devices.open(),
    print: () => printer.open(),
    prep: () => prep.open(),
    levels: () => levels,
  };
  const walls = createWallsTool({ api });
  const rooms = createRoomsTool({ api });
  const devices = createDevicesTool({ api });
  const printer = createPrintTool({ api });
  const prep = createPrepTool({ api });
  document.querySelector(".pr-prep")?.addEventListener("click", () => { printer.close?.(); document.querySelector(".pr-back")?.setAttribute("hidden", ""); prep.open(); });
  const levels = createLevelsBar({ api });
  const aiReleve = createAiReleve({ api, openParams: () => api.setTab("params") });
  // largeur de feuille des anciens fonds PDF (échelle 1/50) ; plan scanné signalé dès la mise à l'échelle
  ensurePaperW(api).catch(() => {});
  document.addEventListener("okteo:fond", () => ensurePaperW(api).catch(() => {}));
  // après une mise à l'échelle : contrôle par les cotes du plan (ex. 1/50 saisi sur un PDF réduit d'A3 en A4)
  document.addEventListener("okteo:calibrated", async () => {
    const s = await chantierScaleCheck(api).catch(() => null);
    if (!s || s.cotes < 4 || Math.abs(s.facteur - 1) <= 0.03) return;
    const pct = Math.abs((s.facteur - 1) * 100).toFixed(0);
    api.setHint(`⚠ Les cotes du plan (${s.cotes}) indiquent une échelle fausse de ${pct} % : le PDF n'est peut-être pas à son format d'origine (A3 imprimé en A4 ?). Menu Relevé → 1. Murs → « Corriger l'échelle », ou réglez-la sur une cote.`);
  });
  const recheck = createRecheck({ api, aiReleve });
  // v76 : « Analyse IA » = écran de choix des 4 modes (menu Relevé et étape 2 du Mode IA)
  const aiRunner = createModeRunner({ api, aiReleve });
  const aiModes = createAiModes({ api, aiReleve, runner: aiRunner });
  hooks.recheck = () => recheck.open();
  hooks.aiReleve = () => aiModes.open();
  const whyBlink = createWhyBlink({ api });   // n° 5 : « Pourquoi ça clignote ? » et rapport d'analyse
  // lot 2 (05/11/2026) : mémoire des symboles commune (version en ligne) rapatriée au démarrage
  import("./symbol-memory.js").then((m) => m.syncMemory()).catch(() => { /* hors ligne : mémoire du poste */ });
  hooks.rapport = () => whyBlink.openRapport();
  hooks.aiPaste = () => aiReleve.pastePanel();
  document.addEventListener("okteo:walls", () => walls.open());
  // n° 16 : « Mémoriser ce symbole » (Propriétés) : type validé + extrait du dessin dans la mémoire du pavillonneur
  document.addEventListener("okteo:symbol-memo", async (e) => {
    const a = api.state.app.find((x) => x.id === e.detail.id); if (!a) return;
    const { remember, cropAround } = await import("./symbol-memory.js");
    const image = await cropAround(api, a).catch(() => "");
    const desc = [api.TYPES[a.t]?.n || a.t, a.inscription ? `inscription « ${a.inscription} »` : "", a.aiType && a.aiType !== a.t ? `lu par l'IA comme ${a.aiType}` : ""].filter(Boolean).join(", ");
    const r = remember({ pav: api.ch.client || "", type: a.t, desc, chantier: [api.ch.nom, api.ch.numero].filter(Boolean).join(" "), by: (window.okteoSession && window.okteoSession.user && window.okteoSession.user.login) || "", image });
    api.setHint(r ? `Symbole mémorisé pour ${api.ch.client || "ce pavillonneur (fiche du chantier sans pavillonneur)"} : ${r.type}. L'IA s'en servira (outil « légende ») sur les prochains plans.` : "Symbole non mémorisé.");
    document.dispatchEvent(new CustomEvent("okteo:symbol-memorized", { detail: r }));
  });
  document.addEventListener("okteo:devices", () => devices.open());
  const catalog = buildCatalog(api, hooks);
  const getCatalog = () => catalog;

  palette = createPalette({ getCatalog, onAsk: (t) => { panel.show("assistant"); if (t.trim()) assistant.ask(t); else assistant.focus(); } });
  const asEl = panel.register({ id: "assistant", label: "Assistant", icon: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="#E8534A" stroke="none" stroke-width="0" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c.6 5.5 4.5 9.4 10 10-5.5.6-9.4 4.5-10 10-.6-5.5-4.5-9.4-10-10 5.5-.6 9.4-4.5 10-10z"/></svg>', dock: true });
  assistant = createAssistant(asEl, { api, getCatalog, openParams: () => api.setTab("params") });

  // demande de modification d'une règle : l'assistant s'ouvre avec la demande préparée (journal des règles, étude)
  const askRule = (id, text) => { api.setTab("plan"); panel.show("assistant"); assistant.prefill(text || `Règle ${id} : je veux la modifier — `); };
  // ---------- pages pleine largeur (remplacent la zone de dessin quand leur onglet est actif) ----------
  const stage = document.querySelector(".stage");
  const pages = {
    bibliotheque: { el: document.getElementById("bibliotheque"), mount: (el) => mountSymbols(el, { api }), ui: null },
    params: { el: document.getElementById("params"), mount: (el) => mountParams(el, { PROVIDERS, testProvider, serverStatus, listModels, openPacks: () => { api.setTab("plan"); panel.show("packs"); }, api,
      askRule }), ui: null },
    etude: { el: document.getElementById("etude"), mount: (el) => mountEtudePage(el, { api, askRule }), ui: null },
    chantiers: { el: document.getElementById("chantiers"), mount: (el) => mountChantiers(el, { api }), ui: null },
    boites: { el: document.getElementById("boites"), mount: (el) => mountBoxesPage(el, { api }), ui: null },
    lignes: { el: document.getElementById("lignes"), mount: (el) => mountDirectPage(el, { api }), ui: null },
    bandes: { el: document.getElementById("bandes"), mount: (el) => mountBandsPage(el, { api }), ui: null },
    tableau: { el: document.getElementById("tableau"), mount: (el) => mountTableauPage(el, { api }), ui: null },
    vue3d: { el: document.getElementById("vue3d"), mount: (el) => mountVue3d(el, { api }), ui: null },   // 3D-1
  };
  // v64 : Boîtes, Bandes et Lignes directes réunies sous l'onglet « Pieuvre » (sous-onglets en haut)
  const pgEl = document.getElementById("pg-pieuvre"), SUB = ["boites", "bandes", "lignes"];
  pgEl.querySelectorAll("[data-sub]").forEach((b) => (b.onclick = () => api.setTab(b.dataset.sub)));
  const onTab = (t) => {
    document.querySelector(".main").classList.toggle("sy-active", t === "bibliotheque");
    stage.hidden = !!pages[t];
    pgEl.hidden = !SUB.includes(t);
    pgEl.querySelectorAll("[data-sub]").forEach((b) => { b.classList.toggle("on", b.dataset.sub === t); b.setAttribute("aria-pressed", String(b.dataset.sub === t)); });
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
  // menus « Affichage » et « Relevé » : s'ouvrent au clic, se ferment au clic ailleurs ou avec Échap
  const popMenu = (id, btnId) => {
    const pop = document.getElementById(id), btn = document.getElementById(btnId), body = pop.querySelector(".pop-body");
    const set = (open) => { body.hidden = !open; btn.setAttribute("aria-expanded", String(open)); btn.classList.toggle("on", open); };
    btn.onclick = (e) => { e.stopPropagation(); set(body.hidden); };
    document.addEventListener("pointerdown", (e) => { if (!body.hidden && !pop.contains(e.target)) set(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !body.hidden) set(false); });
    return set;
  };
  popMenu("pop-view", "btn-view");
  const setRelev = popMenu("pop-relev", "btn-relev");
  const relev = (fn) => () => { setRelev(false); fn(); };
  document.getElementById("rv-walls").onclick = relev(() => walls.open());
  document.getElementById("rv-square").onclick = relev(() => hooks.squareWalls());
  document.getElementById("rv-rooms").onclick = relev(() => rooms.open());
  document.getElementById("rv-devices").onclick = relev(() => devices.open());
  document.getElementById("rv-ai").onclick = relev(() => aiModes.open());
  document.getElementById("rv-recheck").onclick = relev(() => recheck.open());
  hooks.openReleve = () => setRelev(true);
  document.getElementById("btn-print").onclick = () => printer.open();

  // ---------- raccourcis ----------
  document.addEventListener("keydown", (e) => {
    const typing = /input|select|textarea/i.test(e.target.tagName);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); palette.isOpen ? palette.close() : palette.open(); return; }
    if (e.key === "F1") { e.preventDefault(); palette.open(); return; }
    // v75 : Alt+V = dicter une question à l'assistant (même pendant la saisie)
    if (e.altKey && !e.ctrlKey && !e.metaKey && (e.code === "KeyV" || e.key.toLowerCase() === "v")) { e.preventDefault(); hooks.dictate(); return; }
    // 3D-1 : Alt+4 = onglet 3D (et retour au plan)
    if (e.altKey && !e.ctrlKey && !e.metaKey && !typing && (e.code === "Digit4" || e.key === "4")) { e.preventDefault(); api.setTab(api.tab === "vue3d" ? "plan" : "vue3d"); return; }
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "?") { e.preventDefault(); palette.open(); return; }
    if (e.key.toLowerCase() === "a" && !palette.isOpen) { e.preventDefault(); hooks.openAssistant(); }
  });

  serverStatus().then((st) => settings.setEnv({ online: !!st.online, anthropic: !!st.anthropic, nvidia: !!st.nvidia }));

  // accès pour les tests et le débogage
  const ctl = createControl({ api });
  const essai = createEssai({ api, ctlDescribe });
  const cablage = createCablagePane({ api, panel, ctl });
  const packs = createPacksPane({ api, panel });
  hooks.packs = () => panel.show("packs");
  hooks.cablage = () => panel.show("cablage");
  hooks.horsplan = () => { panel.show("cablage"); setTimeout(() => { const d = document.getElementById("hp-sec"); if (d) { d.open = true; d.scrollIntoView({ block: "start" }); } }, 60); };
  hooks.circuitsAuto = () => { panel.show("cablage"); cablage.auto(); };
  hooks.boxesAuto = () => { panel.show("cablage"); cablage.placeAuto(); };
  const tour = createTour({ api, panel, hooks });
  hooks.tour = () => tour.start();
  hooks.steps = () => { panel.show("steps"); tour.render(); };
  const doubts = createDoubts(api), why = createWhy(api);
  // v63 : temps de travail BE compté sur le chantier ; mode IA (interface simplifiée)
  const temps = createTemps(api);
  const iaMode = createIaMode({ api, aiReleve, recheck, ctl, aiModes });
  const oneCard = createOneCard();   // v64 : une seule fenêtre de travail à la fois
  const home = createHomeShell({ api });   // lot 3 : logo = accueil, pages entières « en classeur »
  hooks.modeIa = () => iaMode.setMode(iaMode.mode === "ia" ? "be" : "ia");
  hooks.cabler = () => { const r = cabler(api); api.setHint(r.text); if (pages.etude.ui) pages.etude.ui.render(); return r.text; };
  window.okteoExt = { home, whyBlink, doubts, why, ctl, essai, cablage, packs, tour, panel, palette, assistant, catalog, settings, walls, rooms, devices, printer, prep, levels, aiReleve, aiModes, aiRunner, recheck, iaMode, temps, oneCard, pages, backup: null };
  initBackup(api).then((b) => { window.okteoExt.backup = b; });
}

if (window.okteo) start(); else document.addEventListener("okteo:ready", start, { once: true });
