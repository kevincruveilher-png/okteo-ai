// v76 : les 4 modes d'« Analyse IA » (pur, sans DOM) : textes des encarts (validés par Kévin le 03/11/2026), niveau
// relatif durée / coût (1 à 4 points, en attendant des mesures réelles), cycles de relecture et disponibilité.
// Tous les modes utilisent uniquement ANALYSE_MODEL (src/ai-config.js).
// `ready` : mode branché dans cette version. Le mode 1 est le flux v75 inchangé (relevé + relectures selon le réglage
// « Relectures automatiques ») ; les modes 2 à 4 arrivent aux étapes suivantes (tuiles, zoom, OpenCV / OCR, contrôle croisé).
// `cycles` : null = réglage de l'opérateur (mode 1, non-régression) ; 3 pour les modes 2 à 4 (décision du 03/11/2026).
export const MODES_IA = [
  {
    n: 1, id: "standard", title: "Analyse standard", pts: 1, ready: true, cycles: null,
    hook: "Le mode rapide pour les plans propres.",
    desc: "L'IA analyse le plan complet, la légende et les quatre quarts, puis applique les règles métier. Un contrôle de cohérence signale les appareils absents ou les liaisons manquantes, et l'IA relit les anomalies détectées (3 cycles de correction maximum).",
    reco: "plan vectoriel ou scan net, symboles lisibles, densité normale.",
  },
  {
    n: 2, id: "renforcee", title: "Analyse renforcée", pts: 2, ready: true, cycles: 3,
    hook: "Une lecture plus fine, sur tout le plan.",
    desc: "Le plan est découpé en zones plus petites, chacune rendue en haute résolution, puis lue par l'IA. Les petits symboles sont mieux visibles et aucune zone n'est survolée. Cette lecture est systématique : elle ne dépend pas d'une alerte pour s'activer.",
    reco: "plans denses, A3 chargés, petits symboles, plans où un oubli serait difficile à repérer à la main.",
  },
  {
    n: 3, id: "degrade", title: "Plan dégradé", pts: 3, ready: true, cycles: 3,
    hook: "Pour les scans difficiles.",
    desc: "Reprend l'analyse renforcée et ajoute un nettoyage de l'image (redressement, contraste, réduction du bruit) ainsi qu'une lecture dédiée des textes : noms de pièces, repères, annotations. L'image d'origine est toujours conservée pour comparaison.",
    reco: "scans inclinés, peu contrastés, bruités, ou annotés à la main.",
  },
  {
    n: 4, id: "approfondie", title: "Analyse approfondie", pts: 4, ready: true, cycles: 3,
    hook: "Le contrôle maximal, quand l'enjeu le justifie.",
    desc: "Combine les lectures précédentes avec une seconde lecture complète du plan. L'IA recoupe aussi ce qu'elle a trouvé avec le devis, le plan cuisine et les autres documents du PDF pour repérer les équipements oubliés. Le résultat est une liste ciblée d'écarts à vérifier.",
    reco: "dossiers sensibles, plans complexes, vérification finale avant validation.",
  },
];

export const MODES_PAGE = {
  title: "Choisissez le mode d'analyse adapté à votre plan",
  intro: "L'IA lit votre plan et prépare l'étude, que vous validez ensuite. Plus le mode est poussé, plus la lecture est minutieuse, mais plus l'analyse est longue et coûteuse. En cas de doute sur la qualité du plan, choisissez un mode supérieur.",
  foot: "Les écarts signalés par l'IA sont des propositions à valider par l'opérateur ou le BE, pas des corrections certaines. Un mode plus poussé augmente la couverture de lecture, il ne garantit pas une détection complète.",
};

export const modeOf = (n) => MODES_IA.find((m) => m.n === +n) || null;
// cycles de relecture après l'ajout d'un relevé : mode 1 = réglage de l'opérateur (0 à 3, inchangé depuis v57) ;
// modes 2 à 4 = 3 cycles (décision du 03/11/2026). Toujours la même boucle (ai-recheck-ui.js loop), jamais une autre.
export function cyclesFor(mode, prefValue) {
  const m = modeOf(mode);
  return m && m.cycles != null ? m.cycles : Math.max(0, Math.min(3, Math.round(+prefValue || 0)));
}

// référence du dossier affichée en haut à droite (maquette : « EVRARD · 04949 »)
export function dossierRef(ch) {
  const nom = String((ch && ch.nom) || "").trim(), num = String((ch && ch.numero) || "").trim();
  return [nom, num].filter(Boolean).join(" · ") || "Chantier sans référence";
}

// libellé accessible de l'indicateur à 4 points
export const dotsLabel = (pts) => `Durée et coût : niveau ${pts} sur 4 (relatif, pas encore mesuré)`;

// peut-on lancer ? (bouton désactivé tant qu'aucun mode disponible n'est choisi)
export function launchState(sel) {
  const m = modeOf(sel);
  if (!m) return { ok: false, label: "Choisissez un mode", why: "Sélectionnez d'abord un des quatre modes." };
  if (!m.ready) return { ok: false, label: "Mode en préparation", why: `Le mode ${m.n} (${m.title.toLowerCase()}) arrive dans une prochaine version.` };
  return { ok: true, label: `Lancer l'analyse · mode ${m.n}`, why: `Lance l'${m.title.toLowerCase()} sur le plan de ce niveau.` };
}

// ---------- v76 : recommandation d'un mode à l'import (l'opérateur accepte ou choisit un autre mode) ----------
// stats = { kind "vector"|"raster", pxPerM (pixels du fond par mètre réel), contrast (écart entre papier et encre :
// luminosité 95e − 2e centile, 0–255), skew (degrés), noise (part de points d'encre isolés), ink (part d'encre), shapes (formes vectorielles),
// docs (autres pages / documents) } — seuils de départ à ajuster avec le banc d'essai (rien n'est encore mesuré)
export const RECO_SEUILS = { skew: 0.5, contrast: 110, noise: 0.18, pxPerM: 150, ink: 0.12, shapes: 2500 };
export function recommend(st = {}, S = RECO_SEUILS) {
  const why = [];
  let mode = 1;
  if (st.kind === "raster") {
    if (Math.abs(st.skew || 0) >= S.skew) why.push(`scan incliné d'environ ${Math.abs(st.skew).toFixed(1).replace(".", ",")}°`);
    if (st.contrast != null && st.contrast < S.contrast) why.push("scan peu contrasté");
    if (st.noise != null && st.noise > S.noise) why.push("scan bruité");
    if (why.length) mode = 3;
  }
  if (mode < 2) {
    if (st.pxPerM != null && st.pxPerM < S.pxPerM) why.push("image de faible définition : petits symboles");
    if (st.ink != null && st.ink > S.ink) why.push("plan dense");
    if (st.shapes != null && st.shapes > S.shapes) why.push("plan vectoriel dense");
    if (why.length) mode = 2;
  }
  if (mode === 1) why.push(st.kind === "vector" ? "plan vectoriel lisible, densité normale" : "scan net, densité normale");
  return { mode, why, docs: st.docs || 0 };
}

// ---------- v76 : escalade après une analyse (surtout le mode 1) ----------
// propose de relancer en mode supérieur si beaucoup d'alertes restent, ou si les cycles n'ont pas résolu une bonne
// part des alertes du départ ; jamais au-delà du mode 4
export function escalade({ mode = 1, rest = 0, initial = 0 } = {}) {
  if (mode >= 4 || rest <= 0) return { propose: false };
  const part = initial > 0 ? rest / initial : 1;
  if (rest >= 3 || part >= 0.3) return { propose: true, to: mode + 1, why: `${rest} alerte${rest > 1 ? "s" : ""} encore ouverte${rest > 1 ? "s" : ""} après les relectures${initial ? ` (sur ${initial} au départ)` : ""}` };
  return { propose: false };
}
