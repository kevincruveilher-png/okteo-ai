// Paramètres → Journal des règles de câblage (v51).
// En tête : les choix du chantier ouvert (mode de pieuvre, volets, appareils à choix) et les écarts entre le journal et
// les réglages actuels du logiciel ; puis le tableau filtrable des règles (clic = fiche), les questions et l'historique.
// Pas d'édition directe : une règle se modifie par l'assistant (avant / après, validation, historique).
import { CATS, CERTS, STATUTS, QSTATUTS, getJournal, pendingQuestions, ruleById, usedBy, historyOf, stats, totals, filterRules, ecarts,
  exportJournal, importJournal } from "../cablage/regles.js";
import { MODES } from "../cablage/boites.js";
import { getCab } from "../cablage/settings.js";
import { esc, md } from "./util.js";
import { downloadBlob } from "./dossier.js";

const VOLETS = { "": "à choisir", boite_a_part: "Boîte à part", melanges: "Mélangés aux autres boîtes" };
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
  const F = { cat: "", cert: "", statut: "", q: "", attente: false };
  let open = "", tabQ = false, tabH = false;

  function choixHTML() {
    if (!api) return "";
    const cab = api.cab || {}, ch = cab.choix || {};
    return `<div class="rg-choix">
      <h4>Choix du chantier <span class="mut">${esc(api.ch?.nom || "")}</span></h4>
      <label>Mode de pieuvre <select id="rg-mode">${Object.entries(MODES).map(([k, l]) => `<option value="${k}" ${(cab.mode || "proximite") === k ? "selected" : ""}>${esc(l)}</option>`).join("")}
        <option value="plug" disabled>Plug de pieuvre — bloqué (R-009 incomplète)</option></select></label>
      <label>Volets roulants <select id="rg-volets">${Object.entries(VOLETS).map(([k, l]) => `<option value="${k}" ${(ch.volets || "") === k ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
      <label>Hotte et appareils à choix <select id="rg-racc">${Object.entries(RACC).map(([k, l]) => `<option value="${k}" ${(ch.raccordement || "a_choisir") === k ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
      <p class="mut sm">Pavillonneur : règles communes à tous (aucune différence sur 4 pavillonneurs, Q-26 à confirmer). Le mode de pieuvre sert
      dès maintenant au placement des boîtes ; volets et appareils à choix seront utilisés par le câblage avec les volets roulants (mise à jour 54).</p>
    </div>`;
  }
  function ecartsHTML(J) {
    const E = ecarts(J, getCab());
    if (!E.length) return `<p class="rg-ok">✓ Les réglages du câblage suivent le journal.</p>`;
    return `<div class="rg-ecarts"><h4>⚠ ${E.length} écart${E.length > 1 ? "s" : ""} entre le journal et le logiciel actuel</h4>
      <p class="mut sm">Le câblage sera mis en conformité avec le journal à la mise à jour 52. En attendant, ce sont les réglages actuels qui s'appliquent.</p>
      <table class="rg-tab"><tr><th>Règle</th><th>Sujet</th><th>Journal</th><th>Logiciel</th></tr>
      ${E.map((e) => `<tr><td><a href="#" data-open="${e.id}">${e.id}</a></td><td>${esc(e.label)}${e.note ? `<small class="mut">${esc(e.note)}</small>` : ""}</td><td><b>${val(e.attendu)}</b></td><td>${val(e.logiciel)}</td></tr>`).join("")}</table></div>`;
  }
  function catsHTML(J) {
    const S = stats(J);
    return `<div class="rg-cats">${Object.entries(CATS).map(([k, l]) => {
      const s = S[k]; if (!s || !s.n) return "";
      const rest = s.n - s.confirmee;
      return `<button class="rg-cat${s.rouge ? " rouge" : ""}${F.cat === k ? " on" : ""}" data-cat="${k}" title="${s.confirmee} confirmée(s), ${s.supposee} supposée(s), ${s.inconnue} inconnue(s)${s.rouge ? " — une règle bloquante est inconnue" : ""}">${esc(l)} <b>${s.n}</b>${rest ? ` <span class="mut">· ${rest} à confirmer</span>` : ""}</button>`;
    }).join("")}</div>`;
  }
  function ficheHTML(J, r) {
    const used = usedBy(J, r.id), H = historyOf(J, r.id), Q = (r.questions_liees || []).map((id) => J.questions.find((q) => q.id === id)).filter(Boolean);
    const E = ecarts(J, getCab()).filter((e) => e.id === r.id);
    const chip = (id) => { const x = ruleById(J, id); return `<a href="#" class="rg-ref" data-open="${id}" title="${esc(x ? x.titre : "")}">${id}</a>`; };
    const params = Object.entries(r.parametres || {});
    return `<div class="rg-fiche-in">
      <p>${md(r.description.charAt(0).toUpperCase() + r.description.slice(1))}</p>
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
      <div class="rg-act"><button class="rg-ask" data-id="${r.id}" title="Les règles ne se modifient que par l'assistant : il propose un avant / après que vous validez">✦ Demander une modification à l'assistant</button><span class="mut sm">Modifié le ${esc((r.modifie_le || "").split("-").reverse().join("/"))} par ${esc(r.modifie_par || "—")}</span></div>
    </div>`;
  }
  function tableHTML(J) {
    const list = filterRules(J, F);
    return `<table class="rg-tab rg-rules"><thead><tr><th>Règle</th><th>Titre</th><th>Catégorie</th><th>Certitude</th><th>Statut</th></tr></thead><tbody>
      ${list.map((r) => `<tr class="rg-row${open === r.id ? " on" : ""}${r.statut === "archivee" ? " arch" : ""}" data-id="${r.id}" tabindex="0" title="Cliquer pour la fiche de la règle">
        <td class="mono">${r.id}${r.si_doute === "bloquer" && r.certitude !== "confirmee" ? ` <span class="rg-blk" title="Bloquant tant que la règle n'est pas confirmée">✕</span>` : ""}</td><td>${esc(r.titre)}</td><td>${esc(CATS[r.categorie] || r.categorie)}</td><td>${pill(r.certitude)}</td><td>${esc(STATUTS[r.statut] || r.statut)}</td></tr>
        ${open === r.id ? `<tr class="rg-fiche"><td colspan="5">${ficheHTML(J, r)}</td></tr>` : ""}`).join("")}
      </tbody></table>${list.length ? "" : `<p class="mut">Aucune règle ne correspond aux filtres.</p>`}`;
  }
  // question en suspens : à voir avec un collègue plus qualifié, ou en attente d'un chantier (jamais reposée à Kévin)
  function waitTag(q) {
    if (q.statut !== "attente") return "";
    const col = /coll[eè]gue/i.test(q.statut_texte || "");
    return ` <span class="rg-wait${col ? " col" : ""}" title="${col ? "Hors de portée de Kévin : la valeur supposée reste « à vérifier » jusqu'à la réponse d'un collègue plus qualifié" : "En attente d'un chantier de ce type"}">${col ? "à voir avec un collègue" : "en attente d'un chantier"}</span>`;
  }
  function questionsHTML(J) {
    const ord = { ouverte: 0, attente: 1, partielle: 2, reportee: 3, repondue: 4 };
    const L = [...(F.attente ? pendingQuestions(J) : J.questions)].sort((a, b) => ord[a.statut] - ord[b.statut] || a.id.localeCompare(b.id));
    return `<table class="rg-tab rg-qs"><tr><th>N°</th><th>Question</th><th>Réponse ou supposé</th><th>Statut</th></tr>
      ${L.map((q) => `<tr><td class="mono">${q.id}</td><td>${esc(q.question)}<small class="mut">${esc(q.section)}</small></td><td>${esc(q.reponse || (q.suppose ? "supposé : " + q.suppose : ""))}${q.si_doute ? ` <span class="mut">(si doute : ${esc(q.si_doute)})</span>` : ""}</td><td><span class="rg-q ${q.statut}">${esc(QSTATUTS[q.statut] || q.statut)}</span>${waitTag(q)}</td></tr>`).join("")}</table>`;
  }
  function historyHTML(J) {
    return `<table class="rg-tab rg-hist"><tr><th>N°</th><th>Date</th><th>Règle</th><th>Action</th><th>Avant → après</th><th>Motif</th><th>Par</th><th>Code</th></tr>
      ${[...J.history].reverse().map((h) => `<tr><td class="mono">${h.id}</td><td>${esc(h.date)}</td><td>${esc(h.regle)}</td><td>${esc(h.action)}</td><td>${esc(h.avant)} → ${esc(h.apres)}</td><td>${esc(h.motif)}</td><td>${esc(h.par)}</td><td>${h.code_valide == null ? "—" : h.code_valide ? "oui" : "non"}</td></tr>`).join("")}</table>`;
  }

  function render() {
    const J = getJournal(), T = totals(J);
    el.innerHTML = `<div class="pset-h"><h3>Journal des règles de câblage</h3>
        <span class="rg-io"><button id="rg-export" title="Enregistrer le journal complet (règles, questions, historique) dans un fichier JSON">⤓ Exporter</button>
        <label class="rg-imp" title="Remplacer le journal de ce PC par un journal exporté"><input type="file" id="rg-import" accept=".json,application/json" hidden>⤒ Importer…</label></span></div>
      <p class="mut">Référence unique des règles KiTéOHM. ${T.n} règles : ${T.active} actives, ${T.a_valider} à valider, ${T.brouillon} brouillon, ${T.archivee} archivée${T.archivee > 1 ? "s" : ""} ;
        ${T.questions} questions à traiter. Le logiciel ne devine jamais : une règle non confirmée donne un résultat « à vérifier » ou un doute bloquant (✕).
        Pas d'édition directe : ouvrez une règle et « Demander une modification à l'assistant » (avant / après à valider, historique).</p>
      <p class="rg-msg" hidden></p>
      <div class="rg-choix-box">${choixHTML()}</div>
      <div class="rg-ecarts-box">${ecartsHTML(J)}</div>
      ${catsHTML(J)}
      <div class="rg-filters">
        <select id="rg-f-cert" aria-label="Certitude"><option value="">Toutes certitudes</option>${Object.entries(CERTS).map(([k, l]) => `<option value="${k}" ${F.cert === k ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>
        <select id="rg-f-statut" aria-label="Statut"><option value="">Statuts en vigueur</option>${Object.entries(STATUTS).map(([k, l]) => `<option value="${k}" ${F.statut === k ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>
        <input type="search" id="rg-f-q" placeholder="Chercher dans les règles (ex. terre, ICTA, volet)" value="${esc(F.q)}">
        <button id="rg-f-wait" class="${F.attente ? "on" : ""}" aria-pressed="${!!F.attente}" title="Questions en suspens (en attente d'un chantier ou d'un collègue plus qualifié) et les règles qui en dépendent">⏳ En attente <b>${pendingQuestions(J).length}</b></button>
        <button id="rg-f-clear" ${F.cat || F.cert || F.statut || F.q || F.attente ? "" : "hidden"}>Tout afficher</button>
      </div>
      <div class="rg-list">${tableHTML(J)}</div>
      <details class="rg-more" ${tabQ || F.attente ? "open" : ""} id="rg-qd"><summary>${F.attente ? `Questions en attente (${pendingQuestions(J).length})` : `Questions pour Kévin (${J.questions.length}, dont ${T.questions} à traiter)`}</summary>${questionsHTML(J)}</details>
      <details class="rg-more" ${tabH ? "open" : ""} id="rg-hd"><summary>Historique des modifications (${J.history.length})</summary>${historyHTML(J)}</details>`;
    wire();
  }
  // mise à jour d'un seul bloc (sans toucher au tableau ni à la fiche ouverte)
  function part(which) {
    if (which === "ecarts") { el.querySelector(".rg-ecarts-box").innerHTML = ecartsHTML(getJournal()); wireEcarts(); }
    if (which === "choix") {
      const cab = (api && api.cab) || {}, ch = cab.choix || {}, set = (id, v) => { const x = el.querySelector(id); if (x && x.value !== v && document.activeElement !== x) x.value = v; };
      set("#rg-mode", cab.mode || "proximite"); set("#rg-volets", ch.volets || ""); set("#rg-racc", ch.raccordement || "a_choisir");
    }
  }
  function wireEcarts() { el.querySelectorAll(".rg-ecarts [data-open]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); openRule(a.dataset.open); })); }
  function relist() {
    const J = getJournal(); el.querySelector(".rg-list").innerHTML = tableHTML(J); wireList();
    el.querySelector("#rg-f-clear").hidden = !(F.cat || F.cert || F.statut || F.q || F.attente);
  }
  function msg(t, bad) { const m = el.querySelector(".rg-msg"); m.hidden = false; m.className = "rg-msg" + (bad ? " bad" : ""); m.textContent = t; }

  function openRule(id, scroll = true) {
    open = open === id && !scroll ? "" : id;
    const r = ruleById(getJournal(), id);
    if (r && filterRules(getJournal(), F).every((x) => x.id !== id)) { F.cat = ""; F.cert = ""; F.statut = r.statut === "archivee" ? "archivee" : ""; F.q = ""; F.attente = false; render(); }
    else relist();
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
    el.querySelectorAll(".rg-cat").forEach((b) => (b.onclick = () => { F.cat = F.cat === b.dataset.cat ? "" : b.dataset.cat; render(); }));
    const c = el.querySelector("#rg-f-cert"), s = el.querySelector("#rg-f-statut"), q = el.querySelector("#rg-f-q");
    c.onchange = () => { F.cert = c.value; render(); };
    s.onchange = () => { F.statut = s.value; render(); };
    q.oninput = () => { F.q = q.value; relist(); };
    el.querySelector("#rg-f-clear").onclick = () => { F.cat = F.cert = F.statut = F.q = ""; F.attente = false; render(); };
    el.querySelector("#rg-f-wait").onclick = () => { F.attente = !F.attente; render(); };
    el.querySelector("#rg-qd").ontoggle = (e) => { tabQ = e.target.open; };
    el.querySelector("#rg-hd").ontoggle = (e) => { tabH = e.target.open; };
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
    }
  }

  render();
  cur = { el, render, part, open: openRule, get filters() { return { ...F }; } };
  return cur;
}
