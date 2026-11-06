// Paramètres : depuis le 06/11/2026, une interface à part, plein écran, fond corail (demande de Kévin) :
// « Règles KiTéOHM » = catalogue des règles de l'entreprise (fiches de src/referentiel/catalogue.js + réglages du câblage
// + norme + journal des règles + questions au BE + historique) et « Ce poste » = réglages de ce PC (affichage et thème,
// IA, relevé, 3D, raccourcis). Une rubrique à la fois, recherche dans toutes.
// Les clés sont rangées dans le navigateur de CE PC (localStorage), jamais dans le chantier ni dans l'export.
// Une clé placée dans le fichier .env du projet est aussi acceptée (le serveur local l'ajoute lui-même).

import { normeSettings } from "../norme/circuits.js";
import { ABREV_DEFAUT, abrevRoom, parseAbrev } from "../print/abrev.js";
import { CAB_DEFAULTS, CAB_FIELDS, PROTS, SECTIONS, getCab, resetCab, setCab } from "../cablage/settings.js";
import { esc, store, storeSet } from "./util.js";
import { getPrefs, setPref, applyTheme, PREFS_DEFAULTS } from "../prefs.js";
import { ETATS, RUBRIQUES, FICHES, QUESTIONS, fichesOf, compte, catalogueTexte, historique, noteChangement } from "../referentiel/catalogue.js";
import { REGLES, THEMES, VERSIONS, BASCULE, art2015 } from "../norme/nfc15100.js";
import { mountRegles } from "./regles-ui.js";
import { CAB_RULES } from "../cablage/regles.js";

// préférences d'affichage : [clé, libellé, aide]
  const PREF_FIELDS = [
    ["ouvrants", "Afficher les ouvrants", "Battants et arcs. Les passages restent ouverts lorsque cette option est désactivée."],
    ["parcours", "Afficher les parcours complets", "Alimentations et lignes directes : afficher le trajet à la place des flèches. Les données de câblage sont conservées."],
  ["surfaces", "Afficher la surface des pièces (m²)", "Sur le plan, dans les panneaux, au relevé des pièces et à l'impression. La surface reste calculée (nombre de prises de la norme pour le séjour)."],
  ["charteBE", "Plan aux symboles du BE (FTZ)", "Symboles des plans FTZ sur le plan de travail et gaines à la couleur de leur boîte (LI01 rouge, LI02 vert, LI03 magenta, LI04 bleu, LI05 noir, LI06 orange, LI07 violet). Décoché : symboles Oktéo et gaines à la couleur du circuit. La barre d'outils garde les symboles Oktéo."],
  ["halos", "Halo orange autour des appareils à vérifier", "Contrôle permanent : commande sans lumière, lumière sans commande, va-et-vient incomplet, appareil sans circuit, allumage coupé entre deux boîtes. Le compteur ⚠ en haut reste toujours actif."],
];

const KEY = "okteo.settings.v1";
const DEF = { provider: "", keys: { anthropic: "", nvidia: "" }, models: { anthropic: "", nvidia: "" } };
let envKeys = { anthropic: false, nvidia: false, online: false, checked: false };
const listeners = new Set();

export const settings = {
  get() { const s = store(KEY, DEF); if (globalThis.okteoSession) return { ...DEF, provider: "anthropic", keys: {anthropic:"",nvidia:""}, models: {anthropic:"",nvidia:""} }; return { ...DEF, ...s, keys: { ...DEF.keys, ...(s.keys || {}) }, models: { ...DEF.models, ...(s.models || {}) } }; },
  set(patch) { const s = { ...this.get(), ...patch }; storeSet(KEY, s); listeners.forEach((f) => f(s)); return s; },
  hasKey(p) { if (globalThis.okteoSession) return p === "anthropic"; return !!(this.get().keys[p] || envKeys[p]); },
  // fournisseur utilisé : celui choisi s'il a une clé, sinon le premier qui en a une
  activeProvider() {
    const s = this.get();
    // version en ligne (pas de serveur local) : NVIDIA ne passe pas, Claude d'abord s'il a une clé
    if (envKeys.checked && !envKeys.online && s.provider === "nvidia" && this.hasKey("anthropic")) return "anthropic";
    if (s.provider && this.hasKey(s.provider)) return s.provider;
    return ["anthropic", "nvidia"].find((p) => this.hasKey(p)) || "";
  },
  setEnv(e) { envKeys = { ...envKeys, ...e, checked: true }; listeners.forEach((f) => f(this.get())); },
  get env() { return envKeys; },
  onChange(f) { listeners.add(f); },
};

// ---------- page Paramètres ----------
export function mountParams(el, { PROVIDERS, testProvider, serverStatus, listModels, openPacks, api, askRule, raccourcis }) {
  let regles = null;
  const card = (p) => {
    if (globalThis.okteoSession) return p === "anthropic" ? `<div class="enterprise-ia"><b>Claude entreprise</b><p>Clé et modèle gérés par les administrateurs. Aucun secret sur ce poste. Le collage d’une analyse reste disponible.</p></div>` : "";
    const P = PROVIDERS[p], s = settings.get();
    const env = envKeys[p] ? `<span class="okk">clé trouvée dans .env</span>` : "";
    return `<div class="pcard" data-p="${p}">
      <div class="pcard-h"><b>${P.name}</b> <span class="mut">${p === "anthropic" ? "Anthropic · console.anthropic.com · payant" : "build.nvidia.com · Nemotron · crédits gratuits"}</span> ${env}</div>
      <label class="f">Clé API
        <span class="keyrow"><input type="password" class="k" autocomplete="off" spellcheck="false" placeholder="${p === "anthropic" ? "sk-ant-…" : "nvapi-…"}" value="${esc(s.keys[p])}">
        <button class="eye" title="Afficher / masquer">👁</button><button class="clr" title="Effacer la clé de ce PC">Effacer</button></span></label>
      <label class="f" title="Conversation de l'assistant (questions, commandes) : modèle rapide">Modèle de la conversation
        <input class="m" list="dl-${p}" placeholder="${P.defaultModel}" value="${esc(s.models[p])}">
        <datalist id="dl-${p}">${P.models.map((m) => `<option value="${m}">`).join("")}</datalist></label>
      ${P.analyseModel ? `<p class="f ma-lock sm" title="Décision du 03/11/2026 : « Analyse IA » (4 modes), relevé et relectures utilisent uniquement ce modèle ; il ne se règle pas.">Modèle de l'analyse (plan, relevé, relectures) : <b>${esc(P.analyseModel)}</b> <span class="mut">(verrouillé)</span></p>` : ""}
      <div class="trow"><button class="tst">Tester la connexion</button>${p === "nvidia" ? `<button class="lst" title="Lire chez NVIDIA la liste des modèles disponibles sur ce compte">Charger les modèles</button>` : ""}<span class="tres"></span></div>
    </div>`;
  };

  const provHTML = () => {
    const act = settings.activeProvider();
    return ["anthropic", "nvidia"].map((p) => `<label class="radio ${settings.hasKey(p) ? "" : "dis"}"><input type="radio" name="prov" value="${p}" ${act === p ? "checked" : ""} ${settings.hasKey(p) ? "" : "disabled"}> ${PROVIDERS[p].name}${settings.hasKey(p) ? "" : " <span class=\"mut\">(pas de clé)</span>"}</label>`).join("");
  };
  // mise à jour partielle : ne pas reconstruire les cartes pendant qu'on clique dedans
  function refreshProv() {
    const box = el.querySelector(".prov"); if (!box) return;
    box.innerHTML = provHTML();
    box.querySelectorAll('input[name="prov"]').forEach((r) => (r.onchange = () => settings.set({ provider: r.value })));
  }

  // ---------- page Paramètres (06/11/2026) : interface à part, plein écran, fond corail ----------
  // À gauche : « Règles KiTéOHM » (catalogue des règles de l'entreprise, src/referentiel/catalogue.js) et « Ce poste »
  // (réglages de ce PC). Une rubrique à la fois ; la recherche parcourt toutes les rubriques.
  // Les anciennes sections gardent leur id (ps-aff, ps-ia, ps-regles, ps-murs, ps-3d, cab-set, ps-packs).
  const SEC_ID = { affichage: "ps-aff", ia: "ps-ia", releve: "ps-murs", v3d: "ps-3d", journal: "ps-regles", cablage: "cab-set" };
  const secId = (rub) => SEC_ID[rub] || "rb-" + rub;
  // groupes des réglages du câblage (CAB_FIELDS, par indice) rangés dans les rubriques du catalogue
  const CAB_RUB = { cablage: [0, 1], pieuvres: [2], conducteurs: [3, 4] };
  const CAB_LABEL = Object.fromEntries(CAB_FIELDS.flatMap(([, rows]) => rows.map(([k, l]) => [k, l])));
  const cabRubOf = (k) => { const i = CAB_FIELDS.findIndex(([, rows]) => rows.some((r) => r[0] === k)); return Object.keys(CAB_RUB).find((r) => CAB_RUB[r].includes(i)) || "cablage"; };
  const RKEY = "okteo.params.rub";
  let active = (() => { try { const r = localStorage.getItem(RKEY); return RUBRIQUES.some((x) => x.id === r) ? r : "chantier"; } catch { return "chantier"; } })();
  const fmtVal = (v) => typeof v === "boolean" ? (v ? "oui" : "non") : String(v).replace(/(\d)\.(\d)/g, "$1,$2");

  function prefHTML() {
    const v = getPrefs(), th = v.theme || "auto";
    return `<h3>Affichage</h3>
      <p class="mut rub-intro">Réglages de ce PC, pour tous les chantiers. Cotes, repères, fond de plan, taille des symboles et rotation de la vue restent dans le menu <b>Affichage</b> au-dessus du plan, à portée de main pendant le travail.</p>
      <div class="pp-theme" role="group" aria-label="Thème de l'écran"><span class="pp-theme-l">Thème de l'écran</span>
        ${[["dark", "Sombre"], ["light", "Clair"], ["auto", "Comme l'ordinateur"]].map(([k, l]) => `<button data-theme-set="${k}" aria-pressed="${th === k}">${l}</button>`).join("")}</div>
      <div class="pset-rows">${PREF_FIELDS.map(([k, label, help]) => `<label class="cab-row pref-row${v[k] !== PREFS_DEFAULTS[k] ? " chg" : ""}" title="${esc(help)}"><span>${esc(label)}<small class="mut">${esc(help)}</small></span><span class="cab-ctl"><input type="checkbox" data-pref="${k}" ${v[k] ? "checked" : ""}></span></label>`).join("")}</div>`;
  }
  function abrevHTML() {
    const v = getPrefs();
    return `<div class="pset-grp" id="ps-abrev-g"><h4 id="ps-abrev">Table des abréviations des pièces</h4>
      <p class="mut sm">Une règle par ligne : <code>mot ou expression = ABRÉVIATION</code>. Le numéro suit : « Chambre 2 » → CH2. Mot entier seulement ; l'expression la plus longue gagne. Nom sans règle : en majuscules, sans accents. Réglage de ce PC pour l'instant.</p>
      <textarea id="pref-abrev" rows="10" spellcheck="false" aria-label="Abréviations des noms de pièces">${esc(v.abrev || ABREV_DEFAUT)}</textarea>
      <div class="trow"><button class="sm" id="pref-abrev-def" title="Remettre la table d'origine">Table d'origine</button><span class="mut sm" id="pref-abrev-ex"></span></div></div>`;
  }
  // une fiche du catalogue
  function ficheHTML(f) {
    const E = ETATS[f.etat], v = getCab();
    const cab = (f.cab || []).filter((k) => k in CAB_DEFAULTS);
    return `<article class="rf-card e-${f.etat}" id="fi-${f.id}" data-id="${f.id}">
      <div class="rf-h"><span class="rf-id">${f.id}</span><b class="rf-t">${esc(f.titre)}</b><span class="rf-e e-${f.etat}" title="${esc(E.label)}">${E.sym} ${esc(E.court)}</span></div>
      <p class="rf-v"><span class="rf-l">Ce qu'Oktéo fait</span>${esc(f.valeur)}</p>
      <p class="rf-p"><span class="rf-l">Pourquoi</span>${esc(f.pourquoi)}</p>
      ${cab.length ? `<p class="rf-cab"><span class="rf-l">Réglage actuel</span>${cab.map((k) => `<a href="#" data-goto-cab="${k}" title="Aller au réglage">${esc(CAB_LABEL[k] || k)} : <b>${esc(fmtVal(v[k]))}</b></a>`).join(" · ")}</p>` : ""}
      ${f.ancre ? `<p class="rf-cab"><a href="#" data-goto-id="${f.ancre}">Régler plus bas ›</a></p>` : ""}
      <p class="rf-m">Source : ${esc(f.source || "—")}${f.n && f.n.length ? ` · décision${f.n.length > 1 ? "s" : ""} n° ${f.n.join(", ")}` : ""} · Sert à : ${esc(f.usage || "—")}${(f.regles || []).map((id) => ` · <a href="#" class="rg-link" data-rule="${id}">${id}</a>`).join("")}</p>
    </article>`;
  }
  const countHTML = (rub) => { const C = compte(rub); return `<div class="rf-count">${Object.entries(C).filter(([, n]) => n).map(([k, n]) => `<span class="rf-e e-${k}" title="${esc(ETATS[k].label)}">${ETATS[k].sym} ${n} ${esc(((t) => n > 1 && /[en]$/.test(t) ? t + "s" : t)(ETATS[k].court.toLowerCase()))}</span>`).join("")}</div>`; };
  function normeHTML() {
    const lv = { O: "obligatoire", R: "recommandé", BE: "choix KiTéOHM" };
    return Object.entries(THEMES).map(([t, nom]) => {
      const L = REGLES.filter((r) => r.theme === t); if (!L.length) return "";
      return `<div class="pset-grp nm-grp"><h4>${esc(nom)}</h4>${L.map((r) => `<div class="nm-row cab-row" data-code="${r.code}"><span><b class="rf-id">${r.code}</b> ${esc(r.texte)}<small class="mut">${lv[r.niveau] || r.niveau} · article ${esc(r.art)} (2024)${art2015(r.art) !== r.art ? ` · ${esc(art2015(r.art))} (2015)` : ""}${r.R.length ? " · " + r.R.map((id) => `<a href="#" class="rg-link" data-rule="${id}">${id}</a>`).join(" ") : ""}</small></span></div>`).join("")}</div>`;
    }).join("");
  }
  function histHTML() {
    const H = historique();
    if (!H.length) return `<p class="mut">Aucun réglage changé sur ce poste pour l'instant.</p>`;
    return `<table class="pp-hist"><thead><tr><th>Quand</th><th>Réglage</th><th>Avant</th><th>Après</th></tr></thead><tbody>${H.slice(0, 120).map((h) => `<tr><td>${esc(new Date(h.at).toLocaleString("fr-FR"))}</td><td>${esc(h.quoi)}</td><td>${esc(fmtVal(h.avant))}</td><td>${esc(fmtVal(h.apres))}</td></tr>`).join("")}</tbody></table>`;
  }
  // contenu d'une rubrique du catalogue
  function rubHTML(r) {
    const head = `<h3>${esc(r.titre)}</h3><p class="mut rub-intro">${esc(r.intro)}</p>`;
    const fiches = fichesOf(r.id);
    const list = fiches.length ? `${countHTML(r.id)}<div class="rf-list">${fiches.map(ficheHTML).join("")}</div>` : "";
    const groups = CAB_RUB[r.id] ? cabGroupsHTML(CAB_RUB[r.id]) : "";
    if (r.id === "cablage") return `<div class="pset-h"><div>${head}</div><button id="cab-reset" title="Remettre toutes les valeurs de base du câblage (toutes rubriques)">Valeurs de base</button></div>${normeWarn()}${list}${groups ? `<h4 class="pp-sub">Réglages du câblage</h4>${groups}` : ""}`;
    if (r.id === "chantier") return head + list + abrevHTML();
    if (r.id === "appareils") return head + list + `<div class="pp-packs" id="ps-packs"><h4 class="pp-sub">Implantation type des pièces (packs)</h4><p class="mut sm">L'appareillage type de chaque pièce (chambre, séjour, cuisine…). Sur le plan : sélectionnez une pièce nommée, puis « ⚡ Implantation rapide » (ou Maj+P) pose son pack.</p><div id="ps-packs-ed"></div></div>`;
    if (r.id === "norme") return head + `<p class="mut sm">Version appliquée à un chantier : ${esc(VERSIONS["2024"].label)} si le permis est déposé après le ${BASCULE.split("-").reverse().join("/")}, sinon ${esc(VERSIONS["2015"].label)} (date du permis dans la fiche du chantier).</p>` + normeHTML();
    if (r.id === "questions") return head + `<div class="rf-list">${QUESTIONS.map(([ref, q, pour]) => `<article class="rf-card e-question q-row"><div class="rf-h"><span class="rf-id">${ref}</span><b class="rf-t">${esc(q)}</b></div><p class="rf-m">Pour : ${esc(pour)}</p></article>`).join("")}</div>`;
    if (r.id === "historique") return head + `<div id="pp-hist">${histHTML()}</div>`;
    if (r.id === "clavier") return head + keysHTML() + list;
    return head + list + groups;
  }
  // lot 6 (PO-01) : touches du BE, une ligne par action
  function keysHTML() {
    if (!raccourcis) return "";
    const rows = raccourcis.keymap().map((a) => `<tr class="kb-row${a.perso ? " chg" : ""}" data-kb="${a.id}"><td>${esc(a.label)}${a.note ? `<div class="mut sm">${esc(a.note)}</div>` : ""}</td><td><kbd>${esc([a.be, a.alt].filter(Boolean).join(" / "))}</kbd></td><td>${a.cmd ? (a.keys.length ? a.keys.map((k) => `<kbd>${esc(k)}</kbd>`).join(" ") : `<span class="mut">aucune</span>`) : `<span class="mut">pas d'équivalent</span>`}</td><td>${a.cmd ? `<button data-kb-set="${a.id}" title="Appuyez ensuite sur la nouvelle touche (Échap = annuler)">Changer</button>${a.perso ? ` <button data-kb-reset="${a.id}" title="Revenir à la touche du BE">Touche du BE</button>` : ""}` : ""}</td></tr>`).join("");
    return `<h4 class="pp-sub">Touches du bureau d'études</h4><p class="mut sm">Sur le plan, les touches de FTZ marchent dans Oktéo. Ctrl+W, Ctrl+N et Ctrl+T sont gardées par le navigateur : elles ne peuvent pas servir. Les autres raccourcis d'Oktéo restent dans la palette (Ctrl+K).</p><p class="kb-msg" id="kb-msg" role="status"></p><table class="kb-tab" id="kb-tab"><thead><tr><th>Action</th><th>FTZ</th><th>Oktéo</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  function normeWarn() { const N = normeSettings(getCab()); return N.length ? `<p class="nm-warn" id="cab-norme">Au-delà de la norme (alerte simple, rien n'est bloqué) : ${N.map((x) => esc(x.msg)).join(" ; ")}.</p>` : ""; }
  // contenu des rubriques « Ce poste » (réglages existants, même id qu'avant)
  function posteHTML(r) {
    if (r.id === "affichage") return prefHTML();
    if (r.id === "ia") return iaHTML();
    if (r.id === "releve") return `<h3>Murs : mise d'équerre automatique</h3>
        <p class="mut rub-intro">Après chaque relevé (IA, automatique, réponse collée) et avec Relevé → Murs d'équerre, Oktéo remet d'équerre les murs presque droits dans le sens de la maison ; les angles restent joints. Mettre 0 pour ne rien corriger. Préférences de ce PC.</p>
        ${[["equerreTol", "Angle léger mis d'équerre", "Un mur à moins de ces degrés d'un angle droit est remis à 0° ou 90°", "°", 20], ["equerre45", "Tolérance autour de 45°", "Un mur à moins de ces degrés de 45° est remis à 45° exact", "°", 20], ["equerreMax", "Déplacement signalé au-delà de", "Un mur corrigé dont un bout bouge de plus que ça est signalé « à vérifier »", "cm", 100]].map(([k, l, h, u, mx]) => `<label class="cab-row" title="${esc(h)}"><span>${esc(l)}<small class="mut">${esc(h)} · ${u}</small></span><span class="cab-ctl"><input type="number" min="0" max="${mx}" step="1" data-eq="${k}" data-max="${mx}" value="${getPrefs()[k]}"></span></label>`).join("")}`;
    if (r.id === "v3d") return `<h3>Vue 3D : hauteurs de départ</h3>
        <p class="mut rub-intro">Utilisées par l'onglet 3D quand le dessin ne donne pas la hauteur. Une pièce (hauteur sous plafond) ou une ouverture (allège, linteau) se règle aussi une par une dans Propriétés. Préférences de ce PC, pour tous les chantiers.</p>
        ${[["h3dPlafond", "Hauteur sous plafond", "Hauteur des murs et des plafonds"], ["h3dAllege", "Allège des fenêtres", "Du sol au bas de la fenêtre"], ["h3dLinteau", "Haut des fenêtres", "Du sol au dessous du linteau"], ["h3dPorte", "Haut des portes", "Porte de 1,20 m de large au plus"], ["h3dBaie", "Haut des baies", "Porte-fenêtre ou passage de plus de 1,20 m"], ["h3dGarage", "Haut des portes de garage", ""]].map(([k, l, h]) => `<label class="cab-row" title="${esc(h)}"><span>${esc(l)}<small class="mut">${esc(h || "cm")}${h ? " · cm" : ""}</small></span><span class="cab-ctl"><input type="number" min="0" max="600" step="1" data-h3d="${k}" value="${getPrefs()[k]}"></span></label>`).join("")}`;
    return rubHTML(r);
  }
  function iaHTML() {
    return `<h3>Assistant et relevé IA</h3>
        <p class="mut rub-intro">Une seule clé suffit. Elle sert à l'assistant (encart en bas à droite du plan), à l'analyse du plan et au relevé par l'IA.
        La clé reste sur ce PC ; elle passe par le serveur local lancé avec <code>npm run dev</code>, puis directement chez le fournisseur.</p>
        ${!envKeys.checked || envKeys.online ? "" : `<p class="warn">Serveur local introuvable : lancez le logiciel avec <code>npm run dev</code> (l'IA ne marche pas en ouvrant le fichier directement).</p>`}
        <div class="pcards">${card("anthropic")}${card("nvidia")}</div>
        <h4>Fournisseur utilisé par l'assistant</h4>
        <div class="prov">${provHTML()}</div>
        <label class="cab-row" id="ps-grille" title="Modes 2 à 4 de « Analyse IA » : découpage du plan en tuiles lues une à une en haute définition. Automatique : 4 × 3 en paysage, 3 × 4 en portrait, sinon 3 × 3. Plus de tuiles = lecture plus fine, plus longue et plus coûteuse."><span>Grille des tuiles (modes 2 à 4)<small class="mut">Automatique, 3 × 3 ou 4 × 4</small></span><span class="cab-ctl"><select id="pref-grille"><option value="auto">Automatique</option><option value="3x3">3 × 3</option><option value="4x4">4 × 4</option></select></span></label>
        <label class="cab-row" id="ps-parallele" title="Nombre de tuiles envoyées à l'IA en même temps. En ligne, ne pas dépasser le réglage « Analyses simultanées » de la fenêtre Budget (sinon Oktéo réessaie une tuile à la fois)."><span>Tuiles envoyées en même temps<small class="mut">1 à 10 ; 2 par défaut</small></span><span class="cab-ctl"><input type="number" min="1" max="10" step="1" id="pref-parallele"></span></label>
        <label class="cab-row" id="ps-zooms" title="Modes 2 à 4 : l'IA peut demander l'agrandissement d'une zone ambiguë (3 au plus par tuile). Plafond par plan pour maîtriser le coût."><span>Zooms à la demande par plan<small class="mut">0 à 40 ; 12 par défaut</small></span><span class="cab-ctl"><input type="number" min="0" max="40" step="1" id="pref-zooms"></span></label>
        <label class="cab-row" id="ps-relect" title="Avec une clé : après un relevé IA, Oktéo renvoie à l'IA les points signalés par le contrôle (lumière sans commande…). Arrêt quand il n'y a plus rien à revoir ou qu'une relecture ne corrige rien ; 3 min au plus par appel ; bouton Arrêter."><span>Relectures automatiques par l'IA<small class="mut">0 = jamais (relecture à la main seulement), 3 au plus. Chaque relecture coûte un appel à l'IA.</small></span><span class="cab-ctl"><input type="number" min="0" max="3" step="1" id="pref-relect" value="${getPrefs().relectures}"></span></label>
        <h4 id="ps-couts">Coûts d'un chantier</h4>
        <p class="mut sm">Pour chiffrer chaque chantier (mode IA, rapport de l'analyse IA) : jetons de l'IA comptés à chaque appel avec une clé, temps de travail BE compté quand le logiciel est utilisé. Laisser 0 = non chiffré.</p>
        <label class="cab-row" title="Prix de votre fournisseur IA pour 1 million de jetons envoyés (image + consigne). Voir sa grille tarifaire : les prix changent selon le modèle."><span>Prix des jetons d'entrée<small class="mut">€ par million de jetons</small></span><span class="cab-ctl"><input type="number" min="0" step="0.01" data-cost="prixIn" value="${getPrefs().prixIn}"></span></label>
        <label class="cab-row" title="Prix pour 1 million de jetons de réponse de l'IA"><span>Prix des jetons de sortie<small class="mut">€ par million de jetons</small></span><span class="cab-ctl"><input type="number" min="0" step="0.01" data-cost="prixOut" value="${getPrefs().prixOut}"></span></label>
        <label class="cab-row" title="Coût horaire chargé du technicien BE : multiplié par le temps de travail compté sur le chantier"><span>Coût horaire du technicien BE<small class="mut">€ / h</small></span><span class="cab-ctl"><input type="number" min="0" step="0.5" data-cost="tauxHoraire" value="${getPrefs().tauxHoraire}"></span></label>
        <p class="mut">Conseil : Claude pour l'analyse du plan (meilleure lecture des images). NVIDIA : Nemotron 3.5 Super VL par défaut (gratuit dans la limite des crédits, voit le plan). Si NVIDIA retire un modèle, Oktéo en choisit un autre tout seul. Un modèle sans « VL » ou « vision » ne lit que la liste des objets, pas l'image.</p>`;
  }
  const LOGO = () => (document.querySelector(".top .brand .brand-mark") || {}).outerHTML || "";
  function navHTML() {
    const grp = (g, t) => `<div class="pn-g">${t}</div>` + RUBRIQUES.filter((r) => r.g === g).map((r) => { const n = fichesOf(r.id).filter((f) => f.etat === "decide" || f.etat === "question").length; return `<a href="#${secId(r.id)}" data-to="${secId(r.id)}" data-rub="${r.id}" class="${r.id === active ? "on" : ""}">${esc(r.titre)}${n ? `<span class="pn-n" title="${n} règle(s) à intégrer ou en question">${n}</span>` : ""}</a>`; }).join("");
    return grp("kiteohm", "Règles KiTéOHM") + grp("poste", "Ce poste");
  }

  function render() {
    const q = el.querySelector(".pset-find")?.value || ""; // la recherche en cours survit à un nouvel affichage
    const all = compte();
    el.innerHTML = `<div class="params-in pset pp">
      <header class="pp-head">
        <div class="pp-brand" aria-hidden="true">${LOGO()}</div>
        <div class="pset-head pp-title"><h2>Paramètres</h2><p>Catalogue des règles KiTéOHM et réglages de ce poste · ${FICHES.length} fiches, dont ${all.actif} appliquées et ${all.decide} à intégrer</p></div>
        <input type="search" class="pset-find" placeholder="Chercher une règle ou un réglage… (ex. couleur, prise, gaine, calibre)" aria-label="Chercher une règle ou un réglage">
        <button id="pp-export" title="Le catalogue complet en texte (Markdown), à lire ou à transmettre hors du logiciel">Exporter le catalogue</button>
        <button id="pp-back" class="pp-back" title="Revenir au plan (Échap)">‹ Revenir au logiciel</button>
      </header>
      <div class="pset-wrap">
        <nav class="pset-nav" aria-label="Rubriques des paramètres">${navHTML()}</nav>
        <div class="pset-body">
          ${RUBRIQUES.map((r) => `<section class="pset-sec${r.id === "cablage" ? " cab-set" : ""}${r.id === active ? " on" : ""}" id="${secId(r.id)}" data-rub="${r.id}">${r.id === "journal" ? "" : r.g === "poste" ? posteHTML(r) : rubHTML(r)}</section>`).join("")}
          <p class="pset-none mut" hidden>Aucune règle ni aucun réglage ne correspond à cette recherche.</p>
        </div>
      </div>
    </div>`;
    regles = mountRegles(el.querySelector("#ps-regles"), { api, ask: askRule });
    wire();
    if (q) { el.querySelector(".pset-find").value = q; find(q); }
  }
  function setActive(rub) {
    if (!RUBRIQUES.some((r) => r.id === rub)) return;
    active = rub; try { localStorage.setItem(RKEY, rub); } catch { /* */ }
    el.querySelectorAll(".pset-sec").forEach((s) => s.classList.toggle("on", s.dataset.rub === rub));
    el.querySelectorAll(".pset-nav a").forEach((a) => a.classList.toggle("on", a.dataset.rub === rub));
    if (rub === "historique") { const h = el.querySelector("#pp-hist"); if (h) h.innerHTML = histHTML(); }
    el.querySelector(".pset-body")?.scrollTo?.({ top: 0 });
  }

  // ---------- réglages du câblage ----------
  function cabGroupsHTML(idx) {
    const v = getCab();
    const input = ([k, label, unit, type]) => {
      const val = v[k], d = CAB_DEFAULTS[k], changed = val !== d ? " chg" : "";
      let ctl;
      if (type === "bool") ctl = `<input type="checkbox" data-cab="${k}" ${val ? "checked" : ""}>`;
      else if (type === "sec") ctl = `<select data-cab="${k}">${SECTIONS.map((x) => `<option value="${x}" ${x === val ? "selected" : ""}>${String(x).replace(".", ",")}</option>`).join("")}</select>`;
      else if (type === "prot") ctl = `<select data-cab="${k}">${PROTS.map((x) => `<option value="${x}" ${x === val ? "selected" : ""}>${x}</option>`).join("")}</select>`;
      else ctl = `<input data-cab="${k}" ${type === "txt" ? "" : `type="number" step="${type === "int" ? 1 : "any"}" min="0"`} value="${esc(String(val))}">`;
      const rg = (CAB_RULES[k] || []).map((id) => `<a href="#" class="rg-link" data-rule="${id}" title="Voir la règle ${id} dans le journal">${id}</a>`).join("");
      return `<label class="cab-row${changed}" title="Valeur de base : ${esc(String(d).replace(".", ","))} ${esc(unit)}"><span>${esc(label)}${rg ? ` <span class="rg-links">${rg}</span>` : ""}</span><span class="cab-ctl">${ctl}<span class="mut">${esc(unit)}</span></span></label>`;
    };
    return idx.map((i) => { const [g, rows, help] = CAB_FIELDS[i]; return `<div class="pset-grp" id="ps-cab-${i}"><h4>${esc(g)}</h4>${help ? `<p class="mut sm">${esc(help)}</p>` : ""}<div class="pset-rows">${rows.map(input).join("")}</div></div>`; }).join("");
  }
  function wireCab() {
    el.querySelectorAll("[data-cab]").forEach((c) => (c.onchange = () => {
      const k = c.dataset.cab, t = typeof CAB_DEFAULTS[k], before = getCab()[k];
      const v = c.type === "checkbox" ? c.checked : t === "number" ? parseFloat(String(c.value).replace(",", ".")) : c.value.trim();
      if (t === "number" && !(v >= 0)) { c.value = getCab()[k]; return; }
      setCab({ [k]: v }); c.closest(".cab-row").classList.toggle("chg", v !== CAB_DEFAULTS[k]);
      noteChangement(CAB_LABEL[k] || k, before, v, cabRubOf(k));
      // MAJ norme n° 4 : réglage plus large que la NF C 15-100 → message sous le titre (sans rien bloquer)
      { const box = el.querySelector("#cab-set"), w = box.querySelector("#cab-norme"), html = normeWarn().replace(/^<p[^>]*>|<\/p>$/g, "");
        if (w && !html) w.remove(); else if (w) w.innerHTML = html; else if (html) box.querySelector(".pset-h").insertAdjacentHTML("afterend", `<p class="nm-warn" id="cab-norme">${html}</p>`); }
      // la valeur affichée dans les fiches suit
      el.querySelectorAll(`[data-goto-cab="${k}"] b`).forEach((b) => (b.textContent = fmtVal(v)));
    }));
    el.querySelectorAll(".rg-link").forEach((a) => (a.onclick = (e) => { e.preventDefault(); e.stopPropagation(); setActive("journal"); regles && regles.open(a.dataset.rule); }));
    const rs = el.querySelector("#cab-reset"); if (rs) rs.onclick = () => { const b = getCab(); resetCab(); const a = getCab(); Object.keys(a).forEach((k) => { if (k in CAB_LABEL) noteChangement(CAB_LABEL[k], b[k], a[k], cabRubOf(k)); }); render(); };
  }

  // recherche : garde les lignes et les fiches qui contiennent tous les mots tapés, dans toutes les rubriques ;
  // masque les groupes vides ; sans recherche, seule la rubrique choisie est montrée
  const norm = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  function find(q) {
    const words = norm(q).split(/\s+/).filter(Boolean), hit = (t) => words.every((w) => norm(t).includes(w));
    let any = false;
    el.querySelector(".pset")?.classList.toggle("searching", !!words.length);
    el.querySelectorAll(".pset-sec").forEach((sec) => {
      const rows = [...sec.querySelectorAll(".cab-row, .rf-card")];
      let n = 0;
      if (rows.length) {
        rows.forEach((r) => { const ok = !words.length || hit(r.textContent + " " + (r.title || "") + " " + (r.closest(".pset-grp")?.querySelector("h4")?.textContent || "")); r.hidden = !ok; if (ok) n++; });
        sec.querySelectorAll(".pset-grp").forEach((g) => { g.hidden = !!words.length && !g.querySelector(".cab-row:not([hidden])"); });
        sec.querySelectorAll(".rf-count").forEach((c) => { c.hidden = !!words.length; });
        if (!n && words.length && hit(sec.textContent)) n = 1;
      } else n = !words.length || hit(sec.textContent) ? 1 : 0;
      sec.hidden = !n; if (n) any = true;
    });
    el.querySelector(".pset-none").hidden = any;
  }

  function wire() {
    wireCab();
    const abx = el.querySelector("#pref-abrev"), abEx = () => { const R = parseAbrev(abx.value); el.querySelector("#pref-abrev-ex").textContent = "Exemples : " + ["Pièce de vie", "Chambre 1", "Salle de bains", "Dégagement", "Dressing"].map((n) => `${n} → ${abrevRoom(n, R)}`).join(" · "); };
    if (abx) {
      abEx();
      abx.oninput = abEx;
      abx.onchange = () => setPref("abrev", abx.value.trim() === ABREV_DEFAUT.trim() ? "" : abx.value);
      el.querySelector("#pref-abrev-def").onclick = () => { abx.value = ABREV_DEFAUT; setPref("abrev", ""); abEx(); };
    }
    el.querySelectorAll("[data-h3d]").forEach((c) => (c.onchange = () => { const v = Math.max(0, Math.min(600, Math.round(+String(c.value).replace(",", ".") || 0))); if (!v) { c.value = getPrefs()[c.dataset.h3d]; return; } c.value = v; setPref(c.dataset.h3d, v); }));
    el.querySelectorAll("[data-cost]").forEach((c) => (c.onchange = () => { const v = Math.max(0, +String(c.value).replace(",", ".") || 0); c.value = v; setPref(c.dataset.cost, v); }));
    // v76 : réglages de la lecture en tuiles (modes 2 à 4)
    const gr = el.querySelector("#pref-grille"); if (gr) { gr.value = getPrefs().grilleIA; gr.onchange = () => setPref("grilleIA", gr.value); }
    const pa = el.querySelector("#pref-parallele"); if (pa) { pa.value = getPrefs().tuilesParallele; pa.onchange = () => { const v = Math.max(1, Math.min(10, Math.round(+pa.value || 1))); pa.value = v; setPref("tuilesParallele", v); }; }
    const zo = el.querySelector("#pref-zooms"); if (zo) { zo.value = getPrefs().zoomsIA; zo.onchange = () => { const v = Math.max(0, Math.min(40, Math.round(+zo.value || 0))); zo.value = v; setPref("zoomsIA", v); }; }
    el.querySelectorAll("[data-eq]").forEach((c) => (c.onchange = () => { const v = Math.max(0, Math.min(+c.dataset.max, Math.round(+c.value || 0))); c.value = v; setPref(c.dataset.eq, v); }));
    const rl = el.querySelector("#pref-relect"); if (rl) rl.onchange = () => { const v = Math.max(0, Math.min(3, Math.round(+rl.value || 0))); rl.value = v; setPref("relectures", v); };
    el.querySelectorAll("[data-pref]").forEach((c) => (c.onchange = () => { const k = c.dataset.pref; noteChangement((PREF_FIELDS.find((x) => x[0] === k) || [k, k])[1], getPrefs()[k], c.checked, "affichage"); setPref(k, c.checked); c.closest(".cab-row").classList.toggle("chg", c.checked !== PREFS_DEFAULTS[k]); }));
    const fi = el.querySelector(".pset-find");
    fi.oninput = () => find(fi.value);
    el.querySelectorAll(".pset-nav a").forEach((a) => (a.onclick = (e) => { e.preventDefault(); if (fi.value) { fi.value = ""; find(""); } setActive(a.dataset.rub); }));
    // fiche → réglage lié (dans sa rubrique), ou bloc plus bas dans la même rubrique
    el.querySelectorAll("[data-goto-cab]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); const k = a.dataset.gotoCab; if (fi.value) { fi.value = ""; find(""); } setActive(cabRubOf(k)); const c = el.querySelector(`[data-cab="${k}"]`); if (c) { c.closest(".cab-row")?.scrollIntoView({ block: "center" }); c.focus(); } }));
    el.querySelectorAll("[data-goto-id]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); el.querySelector("#" + a.dataset.gotoId)?.scrollIntoView({ block: "start" }); }));
    // thème de l'écran
    el.querySelectorAll("[data-theme-set]").forEach((b) => (b.onclick = () => {
      const t = b.dataset.themeSet, before = getPrefs().theme || "auto";
      setPref("theme", t); applyTheme(t); noteChangement("Thème de l'écran", before, t, "affichage");
      el.querySelectorAll("[data-theme-set]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.themeSet === t)));
    }));
    el.querySelectorAll("[data-kb-set]").forEach((b) => (b.onclick = () => {
      const id = b.dataset.kbSet, msg = el.querySelector("#kb-msg");
      b.textContent = "Appuyez sur une touche…"; b.classList.add("wait");
      raccourcis.capture((k) => {
        if (k) { const before = raccourcis.keymap().find((a) => a.id === id).keys.join(" / "); const r = raccourcis.setKey(id, k); if (r.ok) noteChangement(`Touche « ${raccourcis.keymap().find((a) => a.id === id).label} »`, before, k, "clavier"); msg.textContent = r.msg; msg.classList.toggle("err", !r.ok); }
        render(); setActive("clavier"); const m2 = el.querySelector("#kb-msg"); if (m2 && msg.textContent) { m2.textContent = msg.textContent; m2.classList.toggle("err", msg.classList.contains("err")); }
      });
    }));
    el.querySelectorAll("[data-kb-reset]").forEach((b) => (b.onclick = () => { raccourcis.resetKey(b.dataset.kbReset); render(); setActive("clavier"); }));
    el.querySelector("#pp-back").onclick = () => api.setTab("plan");
    el.querySelector("#pp-export").onclick = () => {
      const d = new Date(), txt = catalogueTexte({ cab: getCab(), labels: CAB_LABEL, date: d.toLocaleDateString("fr-FR"), normes: REGLES });
      lastExport = txt;
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type: "text/markdown;charset=utf-8" }));
      a.download = `catalogue-regles-okteo-${d.toISOString().slice(0, 10)}.md`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    };
    { const box = el.querySelector("#ps-packs-ed"); if (box && openPacks && openPacks.mount) openPacks.mount(box); }
    el.querySelectorAll(".pcard").forEach((c) => {
      const p = c.dataset.p, k = c.querySelector(".k"), m = c.querySelector(".m"), res = c.querySelector(".tres");
      k.onchange = () => { const s = settings.get(); settings.set({ keys: { ...s.keys, [p]: k.value.trim() }, provider: s.provider || p }); refreshProv(); };
      m.onchange = () => { const s = settings.get(); settings.set({ models: { ...s.models, [p]: m.value.trim() } }); };
      c.querySelector(".eye").onclick = () => { k.type = k.type === "password" ? "text" : "password"; };
      c.querySelector(".clr").onclick = () => { const s = settings.get(); settings.set({ keys: { ...s.keys, [p]: "" } }); render(); };
      c.querySelector(".tst").onclick = async () => {
        // enregistrer ce qui vient d'être tapé avant de tester
        const s = settings.get(); settings.set({ keys: { ...s.keys, [p]: k.value.trim() }, models: { ...s.models, [p]: m.value.trim() }, provider: s.provider || p });
        refreshProv();
        if (!settings.hasKey(p)) { res.className = "tres bad"; res.textContent = "Entrez d'abord une clé."; return; }
        res.className = "tres"; res.textContent = "Test en cours…";
        try {
          const r = await testProvider(p); res.className = "tres good";
          res.textContent = `✓ Connecté · ${r.model} · ${r.ms} ms` + (r.switched ? ` (« ${r.switched} » retiré par le fournisseur : remplacé automatiquement)` : "");
          if (r.switched) m.value = r.model;
        }
        catch (e) { res.className = "tres bad"; res.textContent = "✗ " + e.message; }
      };
      const lst = c.querySelector(".lst");
      if (lst) lst.onclick = async () => {
        const s = settings.get(); settings.set({ keys: { ...s.keys, [p]: k.value.trim() } });
        if (!settings.hasKey(p)) { res.className = "tres bad"; res.textContent = "Entrez d'abord une clé."; return; }
        res.className = "tres"; res.textContent = "Lecture de la liste…";
        try {
          const ids = await listModels(p);
          c.querySelector("datalist").innerHTML = ids.map((id) => `<option value="${esc(id)}">${PROVIDERS[p].vision(id) ? "voit les images" : "texte seul"}</option>`).join("");
          const nem = ids.filter((id) => /nemotron/i.test(id)).length, vis = ids.filter((id) => PROVIDERS[p].vision(id)).length;
          res.className = "tres good"; res.textContent = `✓ ${ids.length} modèles (${nem} Nemotron, ${vis} qui voient les images) : cliquez dans « Modèle » pour choisir.`;
        } catch (e) { res.className = "tres bad"; res.textContent = "✗ " + e.message; }
      };
    });
    refreshProv();
  }

  // ouvrir la rubrique qui contient un élément (id) : okteo:params-goto {detail: "ps-couts"} (catalogue, 3D, mode IA, tableau)
  const onGoto = (e) => {
    if (!el.isConnected) return document.removeEventListener("okteo:params-goto", onGoto);
    const t = el.querySelector("#" + String(e.detail || "").replace(/[^\w-]/g, "")), sec = t && (t.classList.contains("pset-sec") ? t : t.closest(".pset-sec"));
    if (!sec) return;
    const fi = el.querySelector(".pset-find"); if (fi && fi.value) { fi.value = ""; find(""); }
    setActive(sec.dataset.rub); if (t !== sec) t.scrollIntoView({ block: "start" });
  };
  document.addEventListener("okteo:params-goto", onGoto);
  serverStatus().then((st) => { settings.setEnv({ online: !!st.online, anthropic: !!st.anthropic, nvidia: !!st.nvidia }); render(); });
  render();
  let lastExport = "";
  return { render, setActive, get active() { return active; }, get lastExport() { return lastExport; }, get regles() { return regles; } };
}
