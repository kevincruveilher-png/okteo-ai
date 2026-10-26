// « Premiers pas » pour un nouvel utilisateur :
// 1. onglet « Étapes » du panneau de droite : la liste des étapes d'un chantier (plan, échelle, murs, pièces, appareils,
//    liaisons, impression, sauvegarde), cochées automatiquement, avec le bouton qui lance l'étape suivante ;
// 2. visite guidée : chaque zone de l'écran est éclairée à son tour avec une bulle d'explication
//    (Suivant / Précédent / Quitter, flèches du clavier, Échap) ;
// 3. à la première ouverture, une petite invitation (non bloquante) propose la visite.
import { esc, store, storeSet } from "./util.js";

const KEY = "okteo.tour.v1";            // { seen: bool, never: bool }
const PRINTED = "okteo.printed.v1";      // { [chantier:niveau]: date }

const TOUR = [
  { t: null, title: "Bienvenue dans Oktéo", text: "Oktéo dessine le plan électrique d'une maison : les murs et les pièces, puis les appareils (prises, interrupteurs, points lumineux…) et leurs liaisons. Le plan du pavillonneur (PDF) sert de fond et de modèle : la plupart des éléments sont relevés automatiquement. Cette visite dure 2 minutes." },
  { t: '#tabs button[data-tab="chantiers"]', title: "1. Le chantier et son plan", text: "Page Chantiers : « ＋ Nouveau chantier », nom, n° de dossier, pavillonneur, puis le PDF du plan (on clique la bonne page). Chaque chantier est enregistré tout seul." },
  { t: ".badge", title: "Chantier ouvert", text: "Le nom du chantier ouvert. Un clic ramène à la page Chantiers (changer de chantier, dupliquer, enregistrer en fichier .okteo)." },
  { t: "#sv", title: "2. L'échelle", text: "Juste après l'import, Oktéo demande l'échelle : cliquer les deux bouts d'une cote connue du plan (la plus longue possible), taper sa longueur. Il vérifie ensuite tout seul avec les autres cotes du plan." },
  { t: "#btn-relev", title: "3. Relevé automatique", text: "Menu « ⤓ Relevé » : 1. Murs, 2. Pièces (avec leurs noms), 3. Appareillage (symboles et liaisons). Chaque relevé montre un aperçu en orange : vous gardez ou non le résultat, un seul Ctrl+Z annule. « ✦ Relevé par l'IA » propose les trois d'un coup, pour comparer (clé IA nécessaire)." },
  { t: "#tools", title: "4. Dessiner et corriger", text: "Les outils de dessin : Sélection (V), Pièce (E), Mur (B), Porte, Fenêtre, Cloison, Cote… Survolez un bouton : son rôle et son raccourci s'affichent." },
  { t: ".palette", title: "5. Poser un appareil", text: "Chaque appareil est dessiné avec son symbole. Cliquez-le puis cliquez sur le plan : près d'un mur, il s'y colle. Tapez 30 puis Entrée pour le poser à 30 cm de l'angle." },
  { t: "#side", title: "6. Propriétés", text: "L'objet sélectionné se règle ici : hauteur d'une prise, distance à l'angle, épaisseur d'un mur, nom d'une pièce… L'onglet « Étapes » montre où en est le chantier." },
  { t: '#tools button[data-tool="lien"]', title: "7. Liaisons", text: "Outil Liaison : toutes les liaisons s'affichent, et ce qui n'est pas relié est cerclé en orange. Cliquez un interrupteur : ses lumières ressortent ; cliquez une lumière pour la relier ou la détacher. « Test » allume les lumières d'une commande pour vérifier." },
  { t: '#side-head button[data-pane="cablage"]', title: "Câblage", text: "Onglet Câblage : les appareils sont répartis en circuits (NF C 15-100) d'un clic, chaque circuit a sa couleur sur le plan ; puis les boîtes sont placées pour économiser le cuivre (on les déplace en les glissant, on tire une gaine pour changer son passage ; le cadenas 🔒 empêche une boîte de bouger au recalcul). Onglets Boîtes et Lignes directes (à gauche) : chaque gaine, sa longueur et ses fils. Onglet Bandes : le schéma de chaque boîte pour le câbleur, à imprimer. Les réglages (départs par boîte, longueurs, sections, couleurs des fils) sont dans Paramètres → Câblage." },
  { t: "#levels", title: "8. Niveaux", text: "RDC, R+1, combles : « ＋ Niveau » ajoute un étage (avec ses murs extérieurs). Page ↑ / Page ↓ pour passer d'un niveau à l'autre." },
  { t: "#btn-view", title: "9. Affichage", text: "Cotes, repères, visibilité du plan de fond, taille des symboles, niveau du dessous en transparence." },
  { t: "#savedot", title: "10. Enregistrement", text: "Tout s'enregistre seul. Pour ne jamais rien perdre : page Chantiers → « Sauvegarde automatique » dans un dossier du PC. Ctrl+Z / Ctrl+Y : annuler / rétablir." },
  { t: "#btn-print", title: "11. Imprimer", text: "Plan PDF à l'échelle exacte (1:50…), avec légende, cartouche et nomenclature. Ctrl+P." },
  { t: "#btn-palette", title: "12. Trouver une fonction", text: "Ctrl+K (ou F1) : toutes les fonctions avec une recherche. Tapez par ex. « niveau », « échelle » ou « renuméroter »." },
  { t: "#btn-assistant", title: "13. L'assistant", text: "L'assistant IA répond aux questions sur le logiciel et peut analyser le plan (clé Claude ou NVIDIA dans Paramètres). Cette visite se relance par Ctrl+K → « Visite guidée »." },
];

export function createTour({ api, panel, hooks }) {
  let st = { seen: false, never: false, ...store(KEY, {}) };
  const save = () => storeSet(KEY, st);

  // ---------- visite guidée ----------
  const shade = document.createElement("div"); shade.className = "tour-shade"; shade.hidden = true;
  const ring = document.createElement("div"); ring.className = "tour-ring"; ring.hidden = true;
  const bub = document.createElement("div"); bub.className = "tour-bub"; bub.hidden = true; bub.setAttribute("role", "dialog"); bub.setAttribute("aria-live", "polite");
  document.body.append(shade, ring, bub);
  let i = -1;

  function place() {
    const s = TOUR[i], el = s.t && document.querySelector(s.t);
    const r = el && el.getBoundingClientRect(), vis = r && r.width > 0 && r.height > 0;
    ring.hidden = !vis; shade.hidden = !!vis;
    if (vis) { const p = 6; Object.assign(ring.style, { left: r.left - p + "px", top: r.top - p + "px", width: r.width + 2 * p + "px", height: r.height + 2 * p + "px" }); }
    const bw = Math.min(360, innerWidth - 24), bh = bub.offsetHeight || 160;
    let x = innerWidth / 2 - bw / 2, y = innerHeight / 2 - bh / 2;
    if (vis) {
      const big = r.width > innerWidth * 0.5 && r.height > innerHeight * 0.4;          // grande zone (le plan) : bulle au centre
      if (!big) {
        x = Math.min(innerWidth - bw - 12, Math.max(12, r.left + r.width / 2 - bw / 2));
        y = r.bottom + 14 + bh < innerHeight ? r.bottom + 14 : Math.max(12, r.top - bh - 14);
        if (r.left > innerWidth * 0.6 && r.height > innerHeight * 0.4) { x = Math.max(12, r.left - bw - 16); y = Math.max(12, r.top + 40); }
      }
    }
    Object.assign(bub.style, { left: x + "px", top: y + "px", width: bw + "px" });
  }
  function render() {
    const s = TOUR[i];
    bub.innerHTML = `<div class="tour-n">${i + 1} / ${TOUR.length}</div><b>${esc(s.title)}</b><p>${esc(s.text)}</p>
      <div class="tour-btns"><button id="tour-x" title="Quitter la visite (Échap)">Quitter</button><span class="grow"></span>
      ${i > 0 ? `<button id="tour-prev" title="Étape précédente (←)">Précédent</button>` : ""}
      <button class="on" id="tour-next" title="${i + 1 < TOUR.length ? "Étape suivante (→)" : "Terminer"}">${i + 1 < TOUR.length ? "Suivant" : "Terminer"}</button></div>`;
    bub.hidden = false;
    bub.querySelector("#tour-x").onclick = stop;
    bub.querySelector("#tour-next").onclick = next;
    const pv = bub.querySelector("#tour-prev"); if (pv) pv.onclick = prev;
    place(); requestAnimationFrame(place);
    bub.querySelector("#tour-next").focus();
  }
  function start() { hideInvite(); if (api.tab !== "plan") api.setTab("plan"); i = 0; st.seen = true; save(); render(); }
  function next() { if (i + 1 >= TOUR.length) return stop(); i++; render(); }
  function prev() { if (i > 0) { i--; render(); } }
  function stop() { i = -1; bub.hidden = ring.hidden = shade.hidden = true; panel.show("steps"); }
  document.addEventListener("keydown", (e) => {
    if (i < 0) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); stop(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); next(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
  }, true);
  addEventListener("resize", () => { if (i >= 0) place(); });

  // ---------- invitation (première ouverture) ----------
  const inv = document.createElement("div"); inv.className = "tour-invite"; inv.hidden = true; inv.setAttribute("role", "status");
  inv.innerHTML = `<b>Nouveau sur Oktéo ?</b> Visite guidée de 2 minutes.
    <div class="tour-btns"><button class="on" id="ti-go">Commencer</button><button id="ti-later">Plus tard</button><button id="ti-never" title="Ne plus proposer (la visite reste dans Ctrl+K)">Ne plus proposer</button></div>`;
  document.querySelector(".stage").appendChild(inv);
  function hideInvite() { inv.hidden = true; }
  inv.querySelector("#ti-go").onclick = start;
  inv.querySelector("#ti-later").onclick = () => { st.seen = true; save(); hideInvite(); };
  inv.querySelector("#ti-never").onclick = () => { st.never = true; st.seen = true; save(); hideInvite(); };
  if (!st.seen && !st.never) inv.hidden = false;

  // ---------- onglet « Étapes » ----------
  const el = panel.register({ id: "steps", label: "Étapes", icon: "✓" });
  const printedKey = () => api.ch.id + ":" + api.level.id;
  function items() {
    const S = api.state, ch = api.ch, f = ch.fond, pdf = !!(f && f.src === "idb" && f.page);
    const hasCmd = S.app.some((a) => ["INT", "VV", "BP"].includes(a.t)), lights = S.app.some((a) => ["LUM", "SPOT", "APP"].includes(a.t));
    const printed = !!store(PRINTED, {})[printedKey()], bk = window.okteoExt && window.okteoExt.backup && window.okteoExt.backup.status();
    return [
      { done: !!f, title: "Plan du pavillonneur en fond", how: "Page Chantiers → « Ajouter un fond… » (PDF : cliquer la page du plan).", act: "Ouvrir Chantiers", run: () => api.setTab("chantiers") },
      { done: !!(f && f.calibre), title: "Échelle du plan", how: "Deux points d'une cote connue + sa longueur. Les cotes du plan la vérifient ensuite.", act: "Régler l'échelle", run: () => api.startCalib(), off: !f },
      { done: S.segs.length >= 4, title: "Murs", how: pdf ? "Relevés automatiquement sur le PDF, puis corrigés à la main si besoin." : "Outil Pièce (E) ou Mur (B).", act: pdf ? "Relever les murs" : "Dessiner un mur", run: () => (pdf ? hooks.detectWalls() : api.setTool("mur")), off: !(f && f.calibre) && pdf },
      { done: S.rooms.length > 0, title: "Pièces (noms et surfaces)", how: "Détectées entre les murs, noms lus sur le plan.", act: "Détecter les pièces", run: () => hooks.detectRooms(), off: S.segs.length < 3 },
      { done: S.app.length > 0, title: "Appareils", how: pdf ? "Relevés sur les symboles du PDF ; à compléter avec la barre des appareils." : "Barre des appareils (2e ligne d'outils).", act: pdf ? "Relever les appareils" : "Poser une prise", run: () => (pdf ? hooks.detectDevices() : api.setTool("PC16")), off: pdf && !(f && f.calibre) },
      { done: S.lia.length > 0 || (S.app.length > 0 && !(hasCmd && lights)), title: "Liaisons commande → lumière", how: "Outil Liaison : l'interrupteur, puis ses lumières. « Test » pour vérifier.", act: "Outil Liaison", run: () => api.setTool("lien"), off: !S.app.length },
      { done: (api.cab.circuits || []).length > 0, title: "Circuits (câblage)", how: "Répartition automatique NF C 15-100, puis ajustements : onglet Câblage.", act: "Répartir en circuits", run: () => hooks.circuitsAuto(), off: !S.app.length },
      { done: (api.cab.boxes || []).length > 0, title: "Boîtes et gaines", how: "Placement automatique économe en cuivre, boîtes déplaçables ; détail des gaines dans l'onglet Boîtes.", act: "Placer les boîtes", run: () => hooks.boxesAuto(), off: !(api.cab.circuits || []).length },
      { done: printed, title: "Plan imprimé (PDF)", how: "À l'échelle, avec cartouche et nomenclature.", act: "Imprimer", run: () => hooks.print(), off: !S.segs.length },
      { done: !!(bk && bk.active), title: "Sauvegarde automatique", how: "Une copie .okteo dans un dossier du PC, à chaque modification (Chrome / Edge).", act: "Choisir le dossier", run: () => api.setTab("chantiers"), opt: true },
    ];
  }
  function renderSteps() {
    if (el.hidden && !el.isConnected) return;
    const L = items(), nxt = L.findIndex((x) => !x.done && !x.opt);
    const n = L.filter((x) => x.done).length;
    el.innerHTML = `<div class="steps">
      <p class="steps-h"><b>${esc(api.ch.nom)}</b> · niveau ${esc(api.level.name)} — ${n} / ${L.length} étapes</p>
      <ol>${L.map((x, k) => `<li class="${x.done ? "done" : k === nxt ? "next" : ""}">
        <span class="st-ic">${x.done ? "✓" : k + 1}</span><div><b>${esc(x.title)}</b>${x.opt ? ` <span class="mut sm">(conseillé)</span>` : ""}
        <div class="mut sm">${esc(x.how)}</div>
        ${!x.done ? `<button data-k="${k}" class="${k === nxt ? "on" : ""}" ${x.off ? "disabled title=\"Faites d'abord l'étape précédente\"" : ""}>${esc(x.act)}</button>` : ""}</div></li>`).join("")}</ol>
      <button id="st-tour" title="Présentation de l'écran, étape par étape">▶ Visite guidée (2 min)</button>
    </div>`;
    el.querySelectorAll("button[data-k]").forEach((b) => (b.onclick = () => { const x = L[+b.dataset.k]; if (api.tab !== "plan" && !/Chantiers|dossier/.test(x.act)) api.setTab("plan"); x.run(); }));
    el.querySelector("#st-tour").onclick = start;
  }
  let t = null;
  const later = () => { clearTimeout(t); t = setTimeout(renderSteps, 120); };
  ["okteo:saved", "okteo:level", "okteo:fond", "okteo:calibrated", "okteo:tab", "okteo:printed"].forEach((ev) => document.addEventListener(ev, later));
  panel.onChange((s) => { if (s.pane === "steps") later(); });
  document.addEventListener("okteo:printed", () => { const p = store(PRINTED, {}); p[printedKey()] = Date.now(); storeSet(PRINTED, p); });
  renderSteps();

  return { start, stop, next, prev, get step() { return i; }, steps: TOUR, render: renderSteps, items };
}
