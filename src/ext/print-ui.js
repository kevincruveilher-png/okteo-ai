// Fenêtre « Imprimer / PDF » : réglages (format, orientation, échelle, options), aperçu du PDF, téléchargement.
import { buildPlanPdf, layoutPlan, rotateGeo } from "./print.js";
import { pref } from "../prefs.js";
import { esc, store, storeSet } from "./util.js";
import { pdfjs } from "./fond-import.js";
import { wiringNow } from "./cablage-data.js";

const KEY = "okteo.print.v1";

export function createPrintTool({ api }) {
  const back = document.createElement("div");
  back.className = "pal-back pr-back"; back.hidden = true;
  back.innerHTML = `<div class="pr" role="dialog" aria-label="Imprimer le plan">
    <div class="pr-side">
      <div class="pr-h"><b>Imprimer / PDF</b><button class="pr-x" title="Fermer (Échap)">✕</button></div>
      <label class="f">Format<select data-k="paper"><option value="auto">Automatique</option><option value="A4">A4</option><option value="A3">A3</option></select></label>
      <label class="f">Orientation<select data-k="orient"><option value="auto">Automatique</option><option value="paysage">Paysage</option><option value="portrait">Portrait</option></select></label>
      <label class="f">Échelle<select data-k="scale"><option value="auto">Automatique</option><option value="50">1:50</option><option value="75">1:75</option><option value="100">1:100</option><option value="150">1:150</option><option value="200">1:200</option></select></label>
      <label class="f">Niveau<input data-k="niveau" value="RDC"></label>
      <label class="f" id="pr-lvwrap" title="Tous les niveaux : une page par niveau, même format et même échelle, nomenclature commune">Niveaux imprimés<select data-k="levels"><option value="cur">Le niveau ouvert</option><option value="all">Tous les niveaux</option></select></label>
      <label class="f">Indice<input data-k="indice" value="A" maxlength="3"></label>
      <div class="pr-ck pr-layers" title="Calques imprimés : cochés d'après le filtre de la vue (Bâti / Implantation / Câblage) à l'ouverture de la fenêtre">
        <div class="pr-ckh">Calques <button class="pr-fromview sm" title="Reprendre les calques affichés à l'écran">= écran</button></div>
        <label><input type="checkbox" data-k="murs"> Murs</label>
        <label><input type="checkbox" data-k="ouvertures"> Portes et fenêtres</label>
        <label><input type="checkbox" data-k="pieces"> Pièces (fond et noms)</label>
        <label><input type="checkbox" data-k="cotes"> Cotes</label>
        <label><input type="checkbox" data-k="appareils"> Appareils</label>
        <label><input type="checkbox" data-k="reperes"> Repères et hauteurs</label>
        <label><input type="checkbox" data-k="liaisons"> Liaisons</label>
        <label><input type="checkbox" data-k="circuits"> Couleur des circuits</label>
        <label><input type="checkbox" data-k="boites"> Boîtes (faces, n° de gaine)</label>
        <label><input type="checkbox" data-k="gaines"> Gaines</label>
        <label><input type="checkbox" data-k="fond"> Fond de plan (estompé)</label>
      </div>
      <div class="pr-ck">
        <label><input type="checkbox" data-k="ouvrants"> Dessiner les ouvrants</label>
        <label><input type="checkbox" data-k="parcours"> Parcours complets (au lieu des flèches)</label>
        <label id="pr-rotwrap" title="Le plan imprimé est tourné comme la vue à l'écran (boutons de rotation en bas du plan) ; décoché : plan dans le sens du PDF d'origine"><input type="checkbox" data-k="sensVue"> Dans le sens de la vue (<span id="pr-rotv">0</span>°)</label>
        <label><input type="checkbox" data-k="nomenclature"> Page 2 : nomenclature</label>
      </div>
      <p class="pr-info"></p>
      <button class="on pr-dl">Télécharger le PDF</button>
      <button class="pr-dossier" title="Un seul PDF : page de garde (logo), plan, tableau électrique, bandes détaillées de toutes les boîtes">📁 Dossier complet du chantier</button>
      <p class="mut sm">Pour imprimer à l'échelle exacte : dans la fenêtre d'impression, choisir « Taille réelle » (100 %), pas « Ajuster à la page ».</p>
    </div>
    <div class="pr-view"><div class="pr-pages" aria-label="Aperçu du PDF"></div><div class="pr-wait">Préparation…</div></div>
  </div>`;
  document.body.appendChild(back);
  const $ = (s) => back.querySelector(s);
  let opts = { paper: "auto", orient: "auto", scale: "auto", niveau: "RDC", levels: "cur", indice: "A", cotes: true, reperes: true, liaisons: true, fond: false, nomenclature: true, ...store(KEY, {}) };
  let last = null, url = null, timer = null, seq = 0;
  // calques imprimés = ceux de la vue à l'écran (filtre Bâti / Implantation / Câblage, cases du menu Affichage) ;
  // boîtes, gaines et couleurs de circuit seulement quand les circuits sont affichés (onglet Câblage)
  function fromView() {
    const L = api.layers || {}, on = (k) => !L[k] || L[k].on !== false, circ = !!api.showCircuits, has = (api.cab.boxes || []).length > 0;
    Object.assign(opts, { ouvrants: !!pref("ouvrants"), parcours: !!pref("parcours"), murs: on("murs"), ouvertures: on("ouvertures"), pieces: on("pieces"), cotes: on("cotes"), appareils: on("appareils"),
      liaisons: on("liaisons"), circuits: circ, boites: circ && has && on("boites"), gaines: circ && has && on("gaines"), fond: on("fond") && !!opts.fond });
  }
  // n° des gaines par boîte : { boxId: { appId | "tab": "04" } } (repris du calcul des bandes)
  function gaineNos() {
    if (!(api.cab.boxes || []).length) return null;
    try {
      const W = wiringNow(api), out = {};
      W.boxes.forEach((b) => {
        const m = (out[b.id] = {});
        b.gaines.forEach((g) => { const no = String(g.no || "").split(".").pop(); if (g.kind === "alim") { if (g.id === "alim:0") m.tab = no; } else (g.appIds || [g.appId]).filter(Boolean).forEach((id) => (m[id] = no)); });
      });
      return out;
    } catch { return null; }
  }

  function fill() {
    back.querySelectorAll("[data-k]").forEach((el) => { const v = opts[el.dataset.k]; if (el.type === "checkbox") el.checked = !!v; else el.value = String(v); });
  }
  async function refresh() {
    const my = ++seq;
    $(".pr-wait").hidden = false;
    const all = opts.levels === "all" && api.levels.length > 1;
    const nos = opts.boites ? gaineNos() : null;   // d'abord le calcul des gaines : le plan suit leur découpage (v56)
    const geo = all ? api.allLevelsGeometry() : api.exportGeometry();
    if (all && opts.fond) for (const g of geo) g.fond = await api.levelFond(g.levelId);
    const rot = opts.sensVue ? api.viewRot || 0 : 0, rg = (all ? geo : [geo]).map((g) => rotateGeo(g, rot));
    const L = layoutPlan(all ? { walls: rg.flatMap((g) => g.walls), apps: rg.flatMap((g) => g.apps), rooms: rg.flatMap((g) => g.rooms), fond: rg[0].fond } : rg[0], opts);
    $(".pr-info").innerHTML = `${L.paper} ${L.orient} · <b>1:${L.scale}</b> · ${L.fits ? "le plan tient dans le cadre" : `<span class="warn">le plan dépasse : choisissez un plus grand format ou une plus petite échelle</span>`}`;
    try {
      const r = await buildPlanPdf(geo, { ...opts, gaineNos: nos, rot });
      if (my !== seq) return;
      last = r; if (url) URL.revokeObjectURL(url); url = URL.createObjectURL(r.blob);
      await preview(r.blob, my);
      $(".pr-info").innerHTML += ` · ${r.pages} page${r.pages > 1 ? "s" : ""}`;
    } catch (e) { $(".pr-info").innerHTML = `<span class="warn">Échec : ${esc(e.message)}</span>`; }
    $(".pr-wait").hidden = true;
  }
  back.querySelectorAll("[data-k]").forEach((el) => (el.onchange = () => {
    opts[el.dataset.k] = el.type === "checkbox" ? el.checked : el.value;
    storeSet(KEY, opts); clearTimeout(timer); timer = setTimeout(refresh, 150);
  }));
  // aperçu dessiné par pdf.js (marche dans tous les navigateurs, même sans lecteur PDF intégré)
  async function preview(blob, my) {
    const L = await pdfjs();
    const doc = await L.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
    const box = $(".pr-pages"), wrapW = Math.max(300, box.clientWidth - 32);
    const canvases = [];
    for (let n = 1; n <= Math.min(doc.numPages, 4); n++) {
      const pg = await doc.getPage(n), vp1 = pg.getViewport({ scale: 1 }), k = wrapW / vp1.width, dpr = Math.min(2, window.devicePixelRatio || 1);
      const vp = pg.getViewport({ scale: k * dpr }), c = document.createElement("canvas");
      c.width = Math.round(vp.width); c.height = Math.round(vp.height); c.style.width = Math.round(vp.width / dpr) + "px";
      await pg.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
      canvases.push(c);
    }
    if (my !== seq) return;
    box.replaceChildren(...canvases);
  }
  const close = () => { back.hidden = true; };
  $(".pr-x").onclick = close;
  $(".pr-fromview").onclick = () => { fromView(); fill(); storeSet(KEY, opts); refresh(); };
  back.onclick = (e) => { if (e.target === back) close(); };
  $(".pr-dossier").onclick = async () => {
    const b = $(".pr-dossier"); b.disabled = true; b.textContent = "Préparation…";
    try { const { buildDossier, downloadBlob } = await import("./dossier.js"); const r = await buildDossier(api, { indice: opts.indice }); downloadBlob(r.blob, `${api.ch.nom}${api.ch.numero ? "_" + api.ch.numero : ""}_dossier.pdf`); $(".pr-info").innerHTML += ` · dossier : ${r.pages} pages`; }
    catch (e) { $(".pr-info").innerHTML += ` · <span class="warn">dossier impossible : ${esc(e.message)}</span>`; }
    b.disabled = false; b.textContent = "📁 Dossier complet du chantier";
  };
  $(".pr-dl").onclick = async () => {
    if (!last) await refresh();
    const ch = api.ch, a = document.createElement("a");
    a.href = url; a.download = `${ch.nom}${ch.numero ? "_" + ch.numero : ""}_plan_${last.layout.paper}_1-${last.layout.scale}.pdf`.replace(/[\\/:*?"<>|]+/g, "_");
    document.body.appendChild(a); a.click(); a.remove();
    document.dispatchEvent(new CustomEvent("okteo:printed"));
  };
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") { e.preventDefault(); open(); return; }
    if (e.key === "Escape" && !back.hidden) close();
  });
  // le niveau imprimé est celui qui est ouvert
  function open() { if (api.tab !== "plan") api.setTab("plan"); opts.niveau = api.level.name; fromView();
    const vr = api.viewRot || 0; $("#pr-rotwrap").hidden = !vr; $("#pr-rotv").textContent = String(vr).replace(".", ","); opts.sensVue = !!vr; $("#pr-lvwrap").hidden = api.levels.length < 2; if (api.levels.length < 2) opts.levels = "cur"; fill(); back.hidden = false; refresh(); }
  return { open, close, get last() { return last; } };
}
