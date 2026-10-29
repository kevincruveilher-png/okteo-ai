// Paramètres → Journal des règles de câblage (v51).
// En tête : les choix du chantier ouvert (mode de pieuvre, volets, appareils à choix) et les écarts entre le journal et
// les réglages actuels du logiciel ; puis le tableau filtrable des règles (clic = fiche), les questions et l'historique.
// Pas d'édition directe : une règle se modifie par l'assistant (avant / après, validation, historique).
import { CERTS, STATUTS, QSTATUTS, getJournal, pendingQuestions, ruleById, usedBy, historyOf, totals, ecarts,
  exportJournal, importJournal } from "../cablage/regles.js";
import { DOMAINS, FAMILIES, TYPES, VALIDATIONS, APPLICATIONS, libraryMeta, libraryRules, facetCounts, matchesWords } from "../cablage/regles-library.js";
import { MODES } from "../cablage/boites.js";
import { getCab } from "../cablage/settings.js";
import { esc, md } from "./util.js";
import { downloadBlob } from "./dossier.js";

const VOLETS = { "": "à choisir", boite_a_part: "Boîte à part", melanges: "Mélangés aux autres boîtes" };
const CVOL = { "": "Commande des volets : à choisir (BE)", filaire: "Filaire (commandes CVR câblées)", connecte: "Connectée (moteurs seuls : gris + bleu clair + V/J)" };
const RACC = { a_choisir: "À choisir (doute signalé)", boite: "En boîte (circuit cuisine)", ligne_directe: "En ligne directe" };
const CHOIX_LIB = { mode_pieuvre: "Mode de pieuvre", volets: "Volets roulants", raccordement: "Raccordement", liaison_boites: "Liaison entre boîtes",
  repartition_circuits: "Répartition des circuits", commande_volet: "Commande du volet" };
const pill = (c) => `<span class="rg-cert ${c}" title="Certitude : ${esc(CERTS[c] || c)}">${esc(CERTS[c] || c)}</span>`;
const val = (v) => (typeof v === "number" ? String(v).replace(".", ",") : esc(String(v)));

// une seule écoute des événements, pour la section affichée (la page Paramètres est reconstruite à chaque affichage)
let cur = null;
if (typeof document !== "undefined") {
  document.addEventListener("okteo:regles", () => cur && cur.el.isConnected && cur.render());
  // réglages du câblage changés : seulement les écarts ; chantier changé : seulement les choix (pas de reconstruction du tableau)
  document.addEventListener("okteo:cab-settings", () => cur && cur.el.isConnected && cur.part("ecarts"));
  document.addEventListener("okteo:cab", () => cur && cur.el.isConnected && cur.part("choix"));
}

export function mountRegles(el, { api, ask }) {
  const defaults = () => ({ domain: "", family: "", type: "", validation: "", application: "", cert: "", statut: "", q: "", attente: false, archives: false });
  const previous = cur?.api === api ? cur.state : null;
  const F = { ...defaults(), ...previous?.filters };
  const PAGE_SIZE = 24;
  let open = previous?.open || "", view = previous?.view || "rules", page = previous?.page || 0, contextOpen = previous?.contextOpen || false, advancedOpen = previous?.advancedOpen || false;
  const selected = () => Object.keys(F).filter((k) => !!F[k]);
  const rows = (J) => libraryRules(J, F);

  function choixHTML() {
    if (!api) return "";
    const cab = api.cab || {}, ch = cab.choix || {};
    return `<div class="rg-choix">
      <h4>Choix du chantier <span class="mut">${esc(api.ch?.nom || "")}</span></h4>
      <label>Mode de pieuvre <select id="rg-mode">${Object.entries(MODES).map(([k, l]) => `<option value="${k}" ${(cab.mode || "proximite") === k ? "selected" : ""}>${esc(l)}</option>`).join("")}
        <option value="plug" disabled>Plug de pieuvre — bloqué (R-009 incomplète)</option></select></label>
      <label>Volets roulants <select id="rg-volets">${Object.entries(VOLETS).map(([k, l]) => `<option value="${k}" ${(ch.volets || "") === k ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
      <label title="R-096 : choix du bureau d'études pour le chantier ; le plan ne le dit pas">Commande des volets <select id="rg-cvol">${Object.entries(CVOL).map(([k, l]) => `<option value="${k}" ${(ch.commandeVolet || "") === k ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
      <label>Hotte et appareils à choix <select id="rg-racc">${Object.entries(RACC).map(([k, l]) => `<option value="${k}" ${(ch.raccordement || "a_choisir") === k ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
      <p class="mut sm">Pavillonneur : règles communes à tous (aucune différence sur 4 pavillonneurs, Q-26 à confirmer). Le mode de pieuvre sert
      au placement des boîtes ; volets, commande des volets et appareils à choix sont utilisés par le câblage.</p>
    </div>`;
  }
  function ecartsHTML(J) {
    const E = ecarts(J, getCab());
    if (!E.length) return `<p class="rg-ok">✓ Les réglages du câblage suivent le journal.</p>`;
    return `<div class="rg-ecarts"><h4>⚠ ${E.length} écart${E.length > 1 ? "s" : ""} entre le journal et le logiciel actuel</h4>
      <p class="mut sm">Les valeurs du journal et les réglages diffèrent. Vérifiez cet écart : ce sont les réglages actuels qui sont utilisés par le moteur.</p>
      <table class="rg-tab"><tr><th>Règle</th><th>Sujet</th><th>Journal</th><th>Logiciel</th></tr>
      ${E.map((e) => `<tr><td><a href="#" data-open="${e.id}">${e.id}</a></td><td>${esc(e.label)}${e.note ? `<small class="mut">${esc(e.note)}</small>` : ""}</td><td><b>${val(e.attendu)}</b></td><td>${val(e.logiciel)}</td></tr>`).join("")}</table></div>`;
  }
  function catsHTML(J) {
    const counts = facetCounts(J, { ...F, family: "" }, "domain", DOMAINS);
    return `<div class="rg-cats" aria-label="Domaines"><button class="rg-cat${!F.domain ? " on" : ""}" data-domain="" aria-pressed="${!F.domain}">Tous les domaines <b>${libraryRules(J, { ...F, domain: "", family: "" }).length}</b></button>${Object.entries(DOMAINS).map(([k,l]) => `<button class="rg-cat${F.domain === k ? " on" : ""}" data-domain="${k}" aria-pressed="${F.domain === k}">${esc(l)} <b>${counts[k]}</b></button>`).join("")}</div>`;
  }
  function selectHTML(J, key, labels, title, id = "rg-f-" + key) {
    const counts = facetCounts(J, F, key, labels);
    return `<label>${esc(title)}<select id="${id}" data-filter="${key}"><option value="">Toutes / tous</option>${Object.entries(labels).map(([k,l]) => `<option value="${k}" ${F[key] === k ? "selected" : ""}>${esc(l)} (${counts[k]})</option>`).join("")}</select></label>`;
  }
  function pagination(n) {
    const last = Math.max(0, Math.ceil(n / PAGE_SIZE) - 1); page = Math.min(page, last);
    return `<div class="rg-paging"><span role="status" aria-live="polite" id="rg-count">${n} résultat${n > 1 ? "s" : ""}${n ? ` · ${page * PAGE_SIZE + 1}–${Math.min(n, (page + 1) * PAGE_SIZE)}` : ""}</span><button data-page="prev" ${page === 0 ? "disabled" : ""}>← Précédent</button><span>Page ${page + 1} / ${last + 1}</span><button data-page="next" ${page >= last ? "disabled" : ""}>Suivant →</button></div>`;
  }
  function ficheHTML(J, r) {
    const used = usedBy(J, r.id), H = historyOf(J, r.id), Q = (r.questions_liees || []).map((id) => J.questions.find((q) => q.id === id)).filter(Boolean);
    const E = ecarts(J, getCab()).filter((e) => e.id === r.id);
    const chip = (id) => { const x = ruleById(J, id); return `<a href="#" class="rg-ref" data-open="${id}" title="${esc(x ? x.titre : "")}">${id}</a>`; };
    const params = Object.entries(r.parametres || {}), m = libraryMeta(r);
    const related = J.rules.filter((x) => x.id !== r.id && libraryMeta(x).family === m.family).slice(0, 6);
    return `<div class="rg-fiche-in">
      <div class="rg-reading"><div><h4>À quoi sert cette règle ?</h4><p>${esc(m.summary)}</p></div>
      <div><h4>Quand l’utiliser ?</h4><p>${esc(m.when)}</p></div><div><h4>Que dois-je vérifier ?</h4><p>${esc(m.action)}</p></div>
      <div><h4>Exemple de consultation</h4><p>${esc(m.example)}</p></div></div>
      <div class="rg-application"><b>Dans Oktéo : ${esc(APPLICATIONS[m.application.state])}</b><p>${esc(m.application.detail)}</p>${m.application.source ? `<small class="mut">Périmètre relu : ${esc(m.application.source)}</small>` : ""}</div>
      ${related.length ? `<p class="rg-related"><b>Dans la même famille :</b> ${related.map((x) => `<a href="#" data-open="${x.id}">${esc(x.titre)} <small>${x.id}</small></a>`).join(" ")}</p>` : ""}
      <details class="rg-technical"><summary>Voir le texte complet, les sources et l’historique</summary>
      <p>${md(String(r.description || ""))}</p>
      ${(r.details || []).length ? `<ul>${r.details.map((d) => `<li>${md(d)}</li>`).join("")}</ul>` : ""}
      ${r.condition ? `<p><b>Quand :</b> ${esc(r.condition)}</p>` : ""}${r.action ? `<p><b>Action :</b> ${esc(r.action)}</p>` : ""}
      <dl class="rg-dl">
        ${params.length || r.parametres_texte ? `<dt>Paramètres</dt><dd>${params.map(([k, v]) => `<code>${esc(k)} = ${val(v)}</code>`).join(" ")}${r.parametres_texte ? ` <span class="mut">${md(r.parametres_texte)}</span>` : ""}</dd>` : ""}
        ${E.length ? `<dt>Logiciel actuel</dt><dd class="rg-warn">${E.map((e) => `${esc(e.label)} : ${val(e.logiciel)} (journal : ${val(e.attendu)})`).join("<br>")}</dd>` : ""}
        ${r.choix ? `<dt>Choix possibles</dt><dd>${r.choix.map((c) => `${esc(CHOIX_LIB[c.nom] || c.nom)} : ${c.valeurs.map(esc).join(" | ")}`).join("<br>")}</dd>` : ""}
        <dt>Certitude</dt><dd>${pill(r.certitude)} · en cas de doute : <b>${r.si_doute === "bloquer" ? "bloquer" : "avertir"}</b> · statut ${esc(STATUTS[r.statut] || r.statut)} · version ${r.version || 1}</dd>
        <dt>Source</dt><dd>${esc(r.source || "—")}</dd>
        ${r.precise ? `<dt>Lien</dt><dd>${esc(r.precise)}</dd>` : ""}
        <dt>Dépend de</dt><dd>${(r.depends_on || []).map(chip).join(" ") || "—"}</dd>
        <dt>Utilisée par</dt><dd>${used.map(chip).join(" ") || "—"}</dd>
        ${(r.preuves || []).length ? `<dt>Preuves</dt><dd>${r.preuves.map(esc).join("<br>")}</dd>` : ""}
        ${Q.length ? `<dt>Questions</dt><dd>${Q.map((q) => `<span class="rg-q ${q.statut}">${q.id}</span> ${esc(q.question)} <span class="mut">— ${esc(q.reponse || q.suppose || "")} (${esc(QSTATUTS[q.statut] || q.statut)})</span>${waitTag(q)}`).join("<br>")}</dd>` : ""}
        <dt>Historique</dt><dd>${H.length ? H.map((h) => `<span class="mono">${h.id}</span> ${esc(h.date)} · ${esc(h.action)} · ${esc(h.motif)}`).join("<br>") : "—"}</dd>
      </dl>
      </details>
      <div class="rg-act"><button class="rg-ask" data-id="${r.id}" title="Les règles ne se modifient que par l'assistant : il propose un avant / après que vous validez">✦ Demander une modification à l'assistant</button><span class="mut sm">Modifié le ${esc((r.modifie_le || "").split("-").reverse().join("/"))} par ${esc(r.modifie_par || "—")}</span></div>
    </div>`;
  }
  function tableHTML(J) {
    const list = rows(J);
    const nav = pagination(list.length), visible = list.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    return `${nav}<table class="rg-tab rg-rules"><thead><tr><th>Règle</th><th>En quelques mots</th><th>Famille</th><th>Validation</th><th>Dans Oktéo</th></tr></thead><tbody>
      ${visible.map((r) => { const m = libraryMeta(r); return `<tr class="rg-row${open === r.id ? " on" : ""}${r.statut === "archivee" ? " arch" : ""}" data-id="${r.id}" tabindex="0" aria-expanded="${open === r.id}" title="Ouvrir la fiche : ${esc(r.titre)}">
        <td class="mono">${r.id}</td><td><strong>${esc(r.titre)}</strong><small class="rg-summary">${esc(m.summary)}</small></td><td>${esc(FAMILIES[m.family])}<small class="mut">${esc(TYPES[m.type])}</small></td>
        <td><span class="rg-validation ${m.validation}">${esc(VALIDATIONS[m.validation])}</span><small class="mut">${esc(STATUTS[r.statut] || r.statut)}</small></td><td><span class="rg-app-state">${esc(APPLICATIONS[m.application.state])}</span></td></tr>
        ${open === r.id ? `<tr class="rg-fiche"><td colspan="5">${ficheHTML(J,r)}</td></tr>` : ""}`; }).join("")}
      </tbody></table>${list.length ? "" : `<div class="rg-empty"><b>Aucun résultat.</b><p>Essayez un autre mot ou retirez un filtre. Les règles archivées sont masquées par défaut.</p><button data-reset>Tout réinitialiser</button></div>`}`;
  }
  // question en suspens : à voir avec un collègue plus qualifié, ou en attente d'un chantier (jamais reposée à Kévin)
  function waitTag(q) {
    if (q.statut !== "attente") return "";
    const col = !/chantier/i.test(q.statut_texte || "");   // en attente d'un collègue (Thibault…) sauf « en attente du chantier »
    return ` <span class="rg-wait${col ? " col" : ""}" title="${col ? "Hors de portée de Kévin : la valeur supposée reste « à vérifier » jusqu'à la réponse d'un collègue plus qualifié" : "En attente d'un chantier de ce type"}">${col ? "à voir avec " + ((q.statut_texte || "").match(/\(([A-ZÉ][\wéèêë-]+)\)/) || [, "un collègue"])[1].replace(/^collègue qualifié$/, "un collègue") : "en attente d'un chantier"}</span>`;
  }
  function questionsHTML(J) {
    const ord = { ouverte: 0, attente: 1, partielle: 2, reportee: 3, repondue: 4 };
    const L = [...(F.attente ? pendingQuestions(J) : J.questions)].filter((q) => matchesWords([q.id,q.question,q.reponse,q.suppose,q.section].join(" "), F.q)).sort((a, b) => ord[a.statut] - ord[b.statut] || a.id.localeCompare(b.id));
    const nav = pagination(L.length);
    return `${nav}<table class="rg-tab rg-qs"><tr><th>N°</th><th>Question</th><th>Réponse ou supposé</th><th>Statut</th></tr>
      ${L.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((q) => `<tr><td class="mono">${q.id}</td><td>${esc(q.question)}<small class="mut">${esc(q.section)}</small></td><td>${esc(q.reponse || (q.suppose ? "supposé : " + q.suppose : ""))}${q.si_doute ? ` <span class="mut">(si doute : ${esc(q.si_doute)})</span>` : ""}</td><td><span class="rg-q ${q.statut}">${esc(QSTATUTS[q.statut] || q.statut)}</span>${waitTag(q)}</td></tr>`).join("")}</table>`;
  }
  function historyHTML(J) {
    const H = [...J.history].reverse().filter((h) => matchesWords(Object.values(h).join(" "), F.q));
    const nav = pagination(H.length);
    return `${nav}<table class="rg-tab rg-hist"><tr><th>N°</th><th>Date</th><th>Règle</th><th>Action</th><th>Avant → après</th><th>Motif</th><th>Par</th><th>Code</th></tr>
      ${H.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((h) => `<tr><td class="mono">${h.id}</td><td>${esc(h.date)}</td><td>${esc(h.regle)}</td><td>${esc(h.action)}</td><td>${esc(h.avant)} → ${esc(h.apres)}</td><td>${esc(h.motif)}</td><td>${esc(h.par)}</td><td>${h.code_valide == null ? "—" : h.code_valide ? "oui" : "non"}</td></tr>`).join("")}</table>`;
  }

  function render() {
    const focus = el.contains(document.activeElement) ? document.activeElement.id : "";
    const caret = focus === "rg-f-q" ? document.activeElement.selectionStart : null;
    const J = getJournal(), T = totals(J);
    const labels = { ...DOMAINS,...FAMILIES,...TYPES,...VALIDATIONS,...APPLICATIONS,...CERTS,...STATUTS };
    el.innerHTML = `<div class="pset-h"><h3>Bibliothèque des règles</h3><span class="rg-io"><button id="rg-export" title="Exporter toutes les règles, questions et historiques, sans tenir compte des filtres">⤓ Exporter</button><label class="rg-imp">⤒ Importer…<input type="file" id="rg-import" accept=".json,application/json" hidden></label></span></div>
      <p class="mut rg-intro">Trouvez une règle par sujet ou par mot-clé, puis ouvrez sa fiche. <b>Une règle validée n’est pas forcément automatisée.</b></p>
      <p class="mut sm">${T.n} règles : ${T.active} actives, ${T.a_valider} à valider, ${T.brouillon} brouillon, ${T.archivee} archivée${T.archivee > 1 ? "s" : ""}. Les numéros et l’historique sont conservés.</p>
      <p class="rg-msg" hidden></p>
      <nav class="rg-views" aria-label="Vues de la bibliothèque">${[["rules","Règles",T.n],["questions","Questions en attente / réponses",J.questions.length],["history","Historique",J.history.length]].map(([v,l,n]) => `<button data-view="${v}" class="${view === v ? "on" : ""}" aria-pressed="${view === v}">${l} <b>${n}</b></button>`).join("")}</nav>
      <label class="rg-search">Rechercher ${view === "rules" ? "une règle" : view === "questions" ? "une question" : "dans l’historique"}<input type="search" id="rg-f-q" placeholder="Ex. ballon, différentiel, terre, diamètre, R-144…" value="${esc(F.q)}" autocomplete="off"></label>
      ${view === "rules" ? `${catsHTML(J)}<div class="rg-filters">${selectHTML(J,"family",FAMILIES,"Famille")}${selectHTML(J,"type",TYPES,"Type de règle")}${selectHTML(J,"validation",VALIDATIONS,"Validation")}${selectHTML(J,"application",APPLICATIONS,"Application dans Oktéo")}</div>
      <details class="rg-advanced" ${advancedOpen ? "open" : ""}><summary>Filtres avancés : certitude, statut d’origine, archives</summary><div class="rg-filters">${selectHTML(J,"cert",CERTS,"Certitude d’origine","rg-f-cert")}${selectHTML(J,"statut",STATUTS,"Statut d’origine","rg-f-statut")}<label class="rg-check"><input id="rg-archives" type="checkbox" ${F.archives ? "checked" : ""}> Inclure les règles archivées</label></div></details>` : `<p class="mut sm">La recherche porte sur cette vue. Les filtres de famille et de validation concernent uniquement la vue Règles.</p>`}
      <div class="rg-tools"><button id="rg-f-wait" class="${F.attente ? "on" : ""}" aria-pressed="${F.attente}">⏳ En attente d’une réponse <b>${pendingQuestions(J).length}</b></button><button id="rg-f-clear" ${selected().length ? "" : "hidden"}>Tout réinitialiser</button></div>
      <div class="rg-active" aria-label="Filtres actifs">${selected().filter((k) => view === "rules" || ["q","attente"].includes(k)).map((k) => `<button data-remove="${k}" title="Retirer ce filtre">${k === "q" ? 'Recherche : ' + esc(F.q) : k === "attente" ? 'En attente' : k === "archives" ? 'Archives incluses' : esc(labels[F[k]] || F[k])} ×</button>`).join("")}</div>
      <div class="rg-list" ${view === "rules" ? "" : "hidden"}>${view === "rules" ? tableHTML(J) : ""}</div>
      <details class="rg-more" id="rg-qd" ${view === "questions" ? "open" : "hidden"}><summary>Questions et réponses</summary>${view === "questions" ? questionsHTML(J) : ""}</details>
      <details class="rg-more" id="rg-hd" ${view === "history" ? "open" : "hidden"}><summary>Historique des modifications</summary>${view === "history" ? historyHTML(J) : ""}</details>
      <details class="rg-context" ${contextOpen ? "open" : ""}><summary>Choix du chantier et écarts avec les réglages</summary><div class="rg-choix-box">${choixHTML()}</div><div class="rg-ecarts-box">${ecartsHTML(J)}</div></details>`;
    wire();
    if (focus) { const x = el.querySelector('#' + focus); if (x) { x.focus({ preventScroll: true }); if (caret != null && x.type === "search") x.setSelectionRange(caret, caret); } }
  }
  // mise à jour d'un seul bloc (sans toucher au tableau ni à la fiche ouverte)
  function part(which) {
    if (which === "ecarts") { el.querySelector(".rg-ecarts-box").innerHTML = ecartsHTML(getJournal()); wireEcarts(); }
    if (which === "choix") {
      const cab = (api && api.cab) || {}, ch = cab.choix || {}, set = (id, v) => { const x = el.querySelector(id); if (x && x.value !== v && document.activeElement !== x) x.value = v; };
      set("#rg-mode", cab.mode || "proximite"); set("#rg-volets", ch.volets || ""); set("#rg-cvol", ch.commandeVolet || ""); set("#rg-racc", ch.raccordement || "a_choisir");
    }
  }
  function wireEcarts() { el.querySelectorAll(".rg-ecarts [data-open]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); openRule(a.dataset.open); })); }
  function msg(t, bad) { const m = el.querySelector(".rg-msg"); m.hidden = false; m.className = "rg-msg" + (bad ? " bad" : ""); m.textContent = t; }

  function openRule(id, scroll = true) {
    open = open === id && !scroll ? "" : id;
    const J = getJournal(), r = ruleById(J,id);
    if (!r) return;
    view = "rules";
    if (!rows(J).some((x) => x.id === id)) Object.assign(F,defaults(), { archives: r.statut === "archivee" });
    page = Math.floor(rows(J).findIndex((x) => x.id === id) / PAGE_SIZE);
    render();
    if (!scroll) el.querySelector(`.rg-row[data-id="${id}"]`)?.focus({ preventScroll: true });
    if (scroll) el.querySelector(`.rg-row[data-id="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function wireList() {
    el.querySelectorAll(".rg-list .rg-row").forEach((tr) => {
      tr.onclick = () => openRule(tr.dataset.id, false);
      tr.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openRule(tr.dataset.id, false); } };
    });
    el.querySelectorAll(".rg-list [data-open]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); e.stopPropagation(); openRule(a.dataset.open); }));
    el.querySelectorAll(".rg-ask").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); ask && ask(b.dataset.id); }));
  }
  function wire() {
    wireList();
    wireEcarts();
    const reset = () => { Object.assign(F,defaults()); page = 0; view = "rules"; open = ""; render(); };
    el.querySelectorAll('[data-domain]').forEach((b) => b.onclick = () => { F.domain = b.dataset.domain; F.family = ""; page = 0; render(); });
    el.querySelectorAll('[data-filter]').forEach((s) => s.onchange = () => { F[s.dataset.filter] = s.value; if (F.statut === "archivee") F.archives = true; page = 0; render(); });
    el.querySelectorAll('[data-view]').forEach((b) => b.onclick = () => { view = b.dataset.view; page = 0; render(); });
    el.querySelectorAll('[data-remove]').forEach((b) => b.onclick = () => { const k = b.dataset.remove; F[k] = defaults()[k]; if (k === "domain") F.family = ""; page = 0; render(); });
    el.querySelectorAll('[data-page]').forEach((b) => b.onclick = () => { page += b.dataset.page === "next" ? 1 : -1; open = ""; render(); });
    el.querySelectorAll('[data-reset]').forEach((b) => b.onclick = reset);
    el.querySelector('#rg-f-q').oninput = (e) => { F.q = e.target.value; page = 0; render(); };
    const archives = el.querySelector('#rg-archives'); if (archives) archives.onchange = () => { F.archives = archives.checked; if (!F.archives && F.statut === "archivee") F.statut = ""; page = 0; render(); };
    el.querySelector('#rg-f-clear').onclick = reset;
    el.querySelector('#rg-f-wait').onclick = () => { F.attente = !F.attente; page = 0; view = "questions"; render(); };
    const advanced = el.querySelector(".rg-advanced"); if (advanced) advanced.ontoggle = (e) => { advancedOpen = e.target.open; };
    el.querySelector('.rg-context').ontoggle = (e) => { contextOpen = e.target.open; };
    el.querySelector("#rg-export").onclick = () => {
      const J = getJournal(), d = new Date();
      downloadBlob(new Blob([exportJournal(J)], { type: "application/json" }), `journal-regles-cablage-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}.json`);
      el._lastExport = exportJournal(J);
    };
    el.querySelector("#rg-import").onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { const J = importJournal(await f.text()); render(); msg(`✓ Journal importé : ${J.rules.length} règles (entrée ${J.history[J.history.length - 1].id} de l'historique).`); }
      catch (err) { msg("✗ " + err.message, true); }
    };
    if (api) {
      const m = el.querySelector("#rg-mode"), v = el.querySelector("#rg-volets"), r = el.querySelector("#rg-racc");
      m.onchange = () => api.setCab({ mode: m.value });
      v.onchange = () => api.setCab({ choix: { ...(api.cab.choix || {}), volets: v.value } });
      r.onchange = () => api.setCab({ choix: { ...(api.cab.choix || {}), raccordement: r.value } });
      const cv = el.querySelector("#rg-cvol"); cv.onchange = () => api.setCab({ choix: { ...(api.cab.choix || {}), commandeVolet: cv.value } });
    }
  }

  render();
  cur = { el, api, render, part, get state() { return { filters: { ...F }, open, view, page, contextOpen, advancedOpen }; }, open: openRule, browse(domain = "") { Object.assign(F, defaults(), { domain }); view = "rules"; page = 0; open = ""; render(); el.scrollIntoView({ block: "start" }); }, get filters() { return { ...F }; } };
  return cur;
}

// Accès depuis le tableau : on laisse Paramètres se monter avant d'appliquer le domaine.
export function openRulesLibrary(api, domain = "") {
  api.setTab("params");
  if (cur?.el.isConnected) cur.browse(domain);
}
