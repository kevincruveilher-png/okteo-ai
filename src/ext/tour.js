// « Premiers pas » pour un nouvel utilisateur :
// 1. onglet « Étapes » du panneau de droite : les 9 étapes du dossier (lot 5 : surtout des vérifications, validées par
//    l'opérateur) et une jauge d'avancement toujours visible dans le bandeau du haut ;
// 2. visite guidée : chaque zone de l'écran est éclairée à son tour avec une bulle d'explication
//    (Suivant / Précédent / Quitter, flèches du clavier, Échap) ;
// 3. à la première ouverture, une petite invitation (non bloquante) propose la visite.
import { esc, store, storeSet } from "./util.js";
import { confirmable } from "../cablage/rapport.js";

const KEY = "okteo.tour.v1";            // { seen: bool, never: bool }
const PRINTED = "okteo.printed.v1";      // { [chantier:niveau]: date }

const TOUR = [
  { t: null, title: "Bienvenue dans Oktéo", text: "Oktéo dessine le plan électrique d'une maison : les murs et les pièces, puis les appareils (prises, interrupteurs, points lumineux…) et leurs liaisons. Le plan du pavillonneur (PDF) sert de fond et de modèle : la plupart des éléments sont relevés automatiquement. Cette visite dure 2 minutes." },
  { t: '.top .brand', title: "1. Le chantier et son plan", text: "Cliquez sur le logo Oktéo pour l'accueil (page Chantiers) : « ＋ Nouveau chantier », nom, n° de dossier, pavillonneur, puis le PDF du plan (on clique la bonne page). Chaque chantier est enregistré tout seul." },
  { t: "#mode-sw", title: "Mode BE / Mode IA", text: "Mode BE : l'interface complète, avec tout le détail des choix et du résultat. Mode IA : une interface simplifiée pour piloter l'IA — le plan et un parcours à droite (plan, relevé IA, relecture, hors plan, câblage, alertes, dossier PDF), avec le coût du chantier (jetons IA, temps BE). Alt+M pour basculer ; mêmes données." },
  { t: ".badge", title: "Chantier ouvert", text: "Le nom du chantier ouvert. Un clic ramène à la page Chantiers (changer de chantier, dupliquer, enregistrer en fichier .okteo)." },
  { t: "#sv", title: "2. L'échelle", text: "Juste après l'import, Oktéo demande l'échelle : cliquer les deux bouts d'une cote connue du plan (la plus longue possible), taper sa longueur. Il vérifie ensuite tout seul avec les autres cotes du plan." },
  { t: "#btn-relev", title: "3. Relevé automatique", text: "Menu « ⤓ Relevé » : 1. Murs, 2. Pièces (avec leurs noms), 3. Appareillage (symboles et liaisons). Chaque relevé montre un aperçu en orange : vous gardez ou non le résultat, un seul Ctrl+Z annule. « ✦ Analyse IA » propose les trois d'un coup, pour comparer : on choisit d'abord un des 4 modes (clé IA nécessaire). « ✦ Relecture ciblée » fait revoir par l'IA les seuls points signalés par le contrôle (lumière sans commande…)." },
  { t: ".grp-act", title: "4. Actions", text: "Le bandeau du haut a trois encarts : Actions (dessiner et poser), Vues (ce qui est affiché) et Panneaux (le panneau de droite). Dans Actions, deux barres : le bâtiment, puis l'appareillage." },
  { t: "#tools .trow.bati", title: "Implantation bâti", text: "1re barre (bord orange) : dessiner et corriger le bâtiment — Sélection (V), Pièce (E), Mur (B), Porte, Fenêtre, Cloison, Cote, Échelle. Survolez un bouton : son rôle et son raccourci s'affichent." },
  { t: "#tools .trow.appa", title: "Implantation appareils", text: "2e barre (bord bleu) : poser l'appareillage (un symbole par type), relier commandes et lumières (Liaison) et vérifier (Essai)." },
  { t: "#vfilter", title: "Vues", text: "Encart Vues : trois vues en un clic — Bâti (Alt+1), Implantation (Alt+2), Câblage (Alt+3) — et un bouton par élément (fond, murs, pièces, appareils, liaisons, boîtes, gaines, cotes, quadrillage) pour l'afficher ou le masquer." },
  { t: ".palette", title: "5. Poser un appareil", text: "Chaque appareil est dessiné avec son symbole. Cliquez-le puis cliquez sur le plan : près d'un mur, il s'y colle. Tapez 30 puis Entrée pour le poser à 30 cm de l'angle." },
  { t: "#panes", title: "6. Panneaux", text: "Encart Panneaux : Propriétés, Câblage, Packs, Étapes. Un clic ouvre le panneau à droite, un 2e clic sur le même bouton (ou sa croix ✕) le ferme pour agrandir le plan." },
  { t: "#side", title: "Propriétés", text: "L'objet sélectionné se règle ici : hauteur d'une prise, distance à l'angle, épaisseur d'un mur, nom d'une pièce… Le bouton « Étapes » montre où en est le chantier." },
  { t: '#panes button[data-pane="packs"]', title: "Packs", text: "Panneau Packs : l'appareillage type de chaque pièce, reconnu d'après son nom (chambre, séjour, cuisine…). « Compléter » pose ce qui manque, « Équiper toutes les pièces » fait tout le niveau, « Pieuvre type » ajoute la boîte de la pièce. Les packs se modifient (« Modifier les packs… »)." },
  { t: '#tools button[data-tool="lien"]', title: "7. Liaisons", text: "Outil Liaison : toutes les liaisons s'affichent, et ce qui n'est pas relié est cerclé en orange. Cliquez un interrupteur : ses lumières ressortent ; cliquez une lumière pour la relier ou la détacher. « Essai » allume et éteint les lumières comme dans la maison (va-et-vient, télérupteur, disjoncteurs, « Tester tout »)." },
  { t: '#panes button[data-pane="cablage"]', title: "Câblage", text: "Panneau Câblage : « Équipements hors plan » pose ce que le BE ajoute d'après le devis (cuisine équipée, VMC, sèche-serviette, antenne…), en violet « à vérifier avec le devis ». Puis les appareils sont répartis en circuits (NF C 15-100) d'un clic, chaque symbole prend la couleur de son circuit (rouge = pas encore de circuit) ; puis les boîtes sont placées pour économiser le cuivre (on les déplace en les glissant, on tire une gaine pour changer son passage ; le cadenas 🔒 empêche une boîte de bouger au recalcul ; chaque face montre ses points d'accroche, on y tire le bout d'une gaine pour la placer). Onglets Boîtes et Lignes directes (à gauche) : chaque gaine, sa longueur et ses fils. Onglet Bandes : le schéma de chaque boîte pour le câbleur et le perçage des 4 tranches pour le perceur, à imprimer. Les réglages (départs par boîte, longueurs, sections, couleurs des fils) sont dans Paramètres → Câblage." },
  { t: '#tabs button[data-tab="boites"]', title: "Pieuvre", text: "Onglet Pieuvre : trois sous-onglets en haut de la page — Boîtes (gaines, longueurs, fils, raccordements), Bandes (schéma de chaque boîte pour le câbleur, étiquettes, dossier PDF) et Lignes directes (du tableau à l'appareil, sans boîte)." },
  { t: '#tabs button[data-tab="vue3d"]', title: "3D", text: "Onglet 3D (Alt+4) : la maison en volume, construite toute seule depuis le dessin, avec les appareils à leur hauteur et les boîtes de la pieuvre. Glisser pour tourner, « Coupe » pour regarder dans les pièces, clic sur un appareil puis « Voir sur le plan ». « Visite à pied » : marcher dans la maison (ZQSD) et poser des appareils au viseur. Les murs mal joints ou en double sont signalés dans la liste du panneau 3D." },
  { t: '#tabs button[data-tab="tableau"]', title: "Tableau", text: "Onglet Tableau : le coffret, ses différentiels et ses disjoncteurs, placés automatiquement puis déplaçables en les glissant. Les manettes coupent les circuits pour le mode essai." },
  { t: '#tabs button[data-tab="etude"]', title: "Étude du câblage", text: "Onglet Étude : « ⚡ Câbler le chantier » vérifie d'abord les règles, puis câble ; les 9 étapes de l'étude, ce qui coince (avec la question à poser), le rapport de câblage et le rapport de l'analyse IA du relevé (ce qui a été corrigé ou non trouvé, % de réussite). Sur le plan, un clic sur une boîte ou une gaine explique pourquoi (« Pourquoi ? »)." },
  { t: '#tabs button[data-tab="params"]', title: "Paramètres et règles de câblage", text: "Onglet Paramètres : une page à part (fond corail) qui prend tout l'écran. À gauche, « Règles KiTéOHM » : le catalogue des règles, chacune avec ce qu'Oktéo fait, pourquoi, et son état (appliquée, à intégrer, question au BE) ; le Journal des règles de câblage y est aussi. « Ce poste » : thème clair / sombre, affichage, clés IA, 3D. « Revenir au logiciel » (ou Échap) ramène au plan." },
  { t: "#levels", title: "8. Niveaux", text: "RDC, R+1, combles : « ＋ Niveau » ajoute un étage (avec ses murs extérieurs). Page ↑ / Page ↓ pour passer d'un niveau à l'autre." },
  { t: "#btn-view", title: "9. Affichage", text: "Cotes, repères, visibilité du plan de fond, taille des symboles, niveau du dessous en transparence." },
  { t: "#ctl", title: "À vérifier", text: "Un seul compteur, toujours actif : « ⚠ n à vérifier » compte les commandes sans lumière, lumières sans commande, va-et-vient incomplets, appareils sans circuit, allumages coupés entre deux boîtes (halo orange sur le plan) et les doutes du câblage (règle manquante ou cas non prévu ; rouge ✕ s'il y en a un bloquant). Un clic va au cas suivant ; la liste est dans le panneau Câblage, les doutes dans l'onglet Étude." },
  { t: "#savedot", title: "10. Enregistrement", text: "Tout s'enregistre seul. Pour ne jamais rien perdre : page Chantiers → « Sauvegarde automatique » dans un dossier du PC. Ctrl+Z / Ctrl+Y : annuler / rétablir." },
  { t: "#btn-print", title: "11. Imprimer", text: "Plan PDF à l'échelle exacte (1:50…), avec légende, cartouche et nomenclature. Les calques imprimés suivent la vue : en mode Câblage, boîtes, gaines et couleurs des circuits. Ctrl+P." },
  { t: "#btn-palette", title: "12. Trouver une fonction", text: "Ctrl+K (ou F1) : toutes les fonctions avec une recherche. Tapez par ex. « niveau », « échelle » ou « renuméroter ». Le bouton « ? Aide », juste à côté, ouvre la notice et le support de formation." },
  { t: "#as-dock", title: "13. L'assistant", text: "En bas à droite du plan : un clic l'agrandit, « — » le réduit (touche A pour l'ouvrir). L'assistant IA répond aux questions sur le logiciel et peut analyser le plan (clé Claude ou NVIDIA dans Paramètres). Cette visite se relance par Ctrl+K → « Visite guidée »." },
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
  const el = panel.register({ id: "steps", label: "Étapes", icon: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>', tip: "Où en est le chantier : les étapes faites et la suivante" });
  const printedKey = () => api.ch.id + ":" + api.level.id;
  // lot 5 (05/11/2026) : 9 étapes du dossier, surtout des VÉRIFICATIONS (liste validée par Kévin). Une étape de
  // vérification n'est faite que lorsque l'opérateur la valide (« C'est vérifié », noté qui / quand dans le chantier,
  // Ctrl+Z l'annule) : importer le dossier ne coche plus tout d'un coup.
  const who = () => (window.okteoSession && window.okteoSession.user && window.okteoSession.user.login) || "opérateur";
  const checked = (k) => ((api.cab.etapes || {})[k]) || null;
  const validate = (k, on = true) => { const E = { ...(api.cab.etapes || {}) }; if (on) E[k] = { by: who(), at: new Date().toISOString() }; else delete E[k]; api.setCab({ etapes: E }); };
  function items() {
    const S = api.state, ch = api.ch, f = ch.fond, apps = api.allApps ? api.allApps() : S.app;
    const printed = !!store(PRINTED, {})[printedKey()];
    const devAlerts = (api.control || []).filter((it) => confirmable(it.kind)).length;
    const boxes = (api.cab.boxes || []).length, circuits = (api.cab.circuits || []).length, tab = apps.some((a) => a.t === "TAB");
    const V = (k, title, how, ready, act, run) => ({ k, verif: true, done: !!checked(k), by: checked(k), title, how, off: !ready, act, run });
    return [
      { k: "import", done: !!f, title: "Import du dossier", how: "Accueil (logo Oktéo) → « Ajouter un fond… » : le PDF du dossier, rôle de chaque page.", act: "Ouvrir l'accueil", run: () => api.setTab("chantiers") },
      { k: "echelle", done: !!(f && f.calibre) && !!checked("echelle"), by: checked("echelle"), verif: true, title: "Échelle confirmée", how: "Échelle réglée (cotes du plan ou 1/50), puis vérifiée sur une cote connue avec l'outil Cote.", act: f && f.calibre ? "C'est vérifié" : "Régler l'échelle", run: () => (f && f.calibre ? validate("echelle") : api.startCalib()), off: !f },
      V("murs", "Vérification des murs et pièces", "Murs à leur place, pièces fermées et bien nommées (comparez avec le fond).", S.segs.length >= 3 && S.rooms.length > 0, "C'est vérifié", () => validate("murs")),
      { k: "appareils", done: apps.length > 0 && devAlerts === 0, title: "Vérification des appareils", how: devAlerts ? `${devAlerts} alerte${devAlerts > 1 ? "s" : ""} à traiter (appareils qui clignotent : « Pourquoi ça clignote ? »).` : "Toutes les alertes des appareils sont traitées.", act: "Voir l'alerte suivante", run: () => { const b = document.getElementById("ctl"); if (b) b.click(); }, off: !apps.length },
      { k: "boites", done: boxes > 0, title: "Implantation des boîtes", how: "Panneau Câblage → « ⚡ Implantation rapide des pieuvres » (mode Bureau d'études), puis à la main.", act: "Implanter les boîtes", run: () => (circuits ? hooks.boxesAuto() : hooks.circuitsAuto()), off: !apps.length },
      V("verifBoites", "Vérification des boîtes", "Boîtes à leur place, départs et faces corrects, gaines sans croisement.", boxes > 0, "C'est vérifié", () => validate("verifBoites")),
      { k: "cablage", done: boxes > 0 && circuits > 0 && tab, title: "Câblage", how: tab ? "Circuits, boîtes, gaines et fils : panneau Câblage et page Étude." : "Posez d'abord le tableau (TD) sur le plan.", act: "Ouvrir le câblage", run: () => hooks.circuitsAuto && (circuits ? window.okteoExt?.panel?.show("cablage") : hooks.circuitsAuto()), off: !boxes },
      V("tableau", "Vérification du tableau", "Page Tableau : rangées, différentiels et disjoncteurs.", circuits > 0, "C'est vérifié", () => validate("tableau")),
      { k: "impression", done: printed, title: "Impression", how: "Plan à l'échelle avec cartouche, puis le dossier PDF complet.", act: "Imprimer", run: () => hooks.print(), off: !S.segs.length },
    ];
  }
  // jauge : part des étapes faites (affichée en permanence dans le bandeau et en tête du panneau Étapes)
  function progress() { const L = items(), n = L.filter((x) => x.done).length, nxt = L.find((x) => !x.done); return { n, total: L.length, pct: Math.round((n / L.length) * 100), next: nxt || null, list: L }; }
  const gauge = document.createElement("button");
  gauge.className = "st-gauge"; gauge.id = "st-gauge";
  gauge.innerHTML = `<span class="sg-bar"><span class="sg-fill"></span></span><span class="sg-txt"></span>`;
  gauge.onclick = () => panel.show("steps");
  // MAJ affichage (05/11/2026) : la jauge n'est plus dans le bandeau 1 (il doit tenir sur une ligne) ; elle reste en tête
  // du panneau Étapes (barre .sg-big). L'élément est gardé hors de la page pour le texte d'aide.
  function paintGauge() {
    const P = progress();
    gauge.querySelector(".sg-fill").style.width = P.pct + "%";
    gauge.querySelector(".sg-txt").textContent = `${P.pct} %` + (P.next ? ` · ${P.next.title}` : " · dossier terminé");
    gauge.title = `Avancement du dossier : ${P.n} / ${P.total} étapes${P.next ? ` — prochaine : ${P.next.title}` : ""}. Cliquez pour voir les étapes.`;
    gauge.classList.toggle("full", P.n === P.total);
  }
  function renderSteps() {
    paintGauge();
    if (el.hidden && !el.isConnected) return;
    const P = progress(), L = P.list, nxt = L.findIndex((x) => !x.done);
    el.innerHTML = `<div class="steps">
      <p class="steps-h"><b>${esc(api.ch.nom)}</b> · niveau ${esc(api.level.name)} — ${P.n} / ${L.length} étapes</p>
      <div class="sg-big" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${P.pct}"><span style="width:${P.pct}%"></span><b>${P.pct} %</b></div>
      <ol>${L.map((x, k) => `<li class="${x.done ? "done" : k === nxt ? "next" : ""}${x.verif ? " verif" : ""}" data-step="${x.k}">
        <span class="st-ic">${x.done ? "✓" : k + 1}</span><div><b>${esc(x.title)}</b>${x.verif ? ` <span class="mut sm">(vérification)</span>` : ""}
        <div class="mut sm">${esc(x.how)}</div>
        ${x.done && x.by ? `<div class="ok sm">Vérifié par ${esc(x.by.by || "")}${x.by.at ? ", " + esc(String(x.by.at).slice(0, 16).replace("T", " ")) : ""} <button class="lnk" data-undo="${x.k}" title="Annuler cette validation">annuler</button></div>` : ""}
        ${!x.done ? `<button data-k="${k}" class="${k === nxt ? "on" : ""}" ${x.off ? "disabled title=\"Faites d'abord l'étape précédente\"" : ""}>${esc(x.act)}</button>` : ""}</div></li>`).join("")}</ol>
      <div id="nm-host"></div>
      <button id="st-tour" title="Présentation de l'écran, étape par étape">▶ Visite guidée (2 min)</button>
    </div>`;
    el.querySelectorAll("button[data-k]").forEach((b) => (b.onclick = () => { const x = L[+b.dataset.k]; if (api.tab !== "plan" && !/accueil|dossier/i.test(x.act)) api.setTab("plan"); x.run(); later(); }));
    el.querySelectorAll("[data-undo]").forEach((b) => (b.onclick = () => { validate(b.dataset.undo, false); later(); }));
    el.querySelector("#st-tour").onclick = start;
    if (hooks.norme) hooks.norme.mount(el.querySelector("#nm-host"));   // MAJ norme n° 2 : minimums par pièce
  }
  let t = null;
  const later = () => { clearTimeout(t); t = setTimeout(renderSteps, 120); };
  ["okteo:saved", "okteo:level", "okteo:fond", "okteo:calibrated", "okteo:tab", "okteo:printed", "okteo:control", "okteo:norme"].forEach((ev) => document.addEventListener(ev, later));
  panel.onChange((s) => { if (s.pane === "steps") later(); });
  document.addEventListener("okteo:printed", () => { const p = store(PRINTED, {}); p[printedKey()] = Date.now(); storeSet(PRINTED, p); });
  renderSteps();

  return { start, stop, next, prev, get step() { return i; }, steps: TOUR, render: renderSteps, items, progress, validate };
}
