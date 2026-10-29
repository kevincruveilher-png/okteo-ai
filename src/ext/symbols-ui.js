// Page native compacte. Les images BE sont des PNG/JPEG/WebP, jamais du SVG/HTML importé.
import { GROUPS, loadSymbols, saveSymbols, symbolEntries, filterSymbols, deviceInfo } from "./symbols-data.js";
import { getJournal, CERTS, STATUTS } from "../cablage/regles.js";
import { esc } from "./util.js";
import { downloadBlob } from "./dossier.js";

export function mountSymbols(el, { api }) {
  let data = loadSymbols(), selected = "PC16", editing = false, image = "", message = "";
  const filters = { q: "", category: "", origin: "" };
  const all = () => symbolEntries(api.TYPES, data);
  const entry = () => all().find((d) => d.id === selected);
  const preview = (d) => d.origin === "be" ? (d.image ? `<img src="${esc(d.image)}" alt="Dessin original BE : ${esc(d.name)}">` : `<span class="sy-missing" aria-label="Dessin BE à fournir">?</span>`) :
    `<svg class="ticon" viewBox="-1.6 -1.6 3.2 3.2" aria-label="${esc(d.name)}">${api.symbolMarkup(d.type)}</svg>`;
  const options = (items, val) => items.map(([v, n]) => `<option value="${esc(v)}" ${v === val ? "selected" : ""}>${esc(n)}</option>`).join("");
  const status = (d) => d.origin === "be" ? (d.type ? "Correspondance manuelle" : "Non reconnu par Oktéo") : "Symbole Oktéo";

  el.innerHTML = `<div class="sy-page">
    <header class="sy-head"><div><h2>Bibliothèque de symboles</h2><p class="mut">Appareils, variantes BE et règles associées</p></div><span class="grow"></span>
      <button data-action="export" title="Exporter les fiches, variantes BE et liens de règles en JSON">Exporter</button>
      <button data-action="add" title="Ajouter le dessin original d’un symbole du BE">+ Symbole BE</button></header>
    <div class="sy-filters"><input id="sy-search" type="search" placeholder="Rechercher un symbole, une règle…" aria-label="Rechercher un symbole">
      <select id="sy-category" aria-label="Catégorie">${options([["", "Toutes les catégories"], ...GROUPS.map((s) => [s, s])], "")}</select>
      <select id="sy-origin" aria-label="Origine">${options([["", "Toutes les origines"], ["okteo", "Symboles Oktéo"], ["be", "Variantes BE"]], "")}</select><span id="sy-count" class="mut" role="status"></span></div>
    <div class="sy-layout"><div class="sy-grid" id="sy-grid" role="group" aria-label="Symboles"></div><aside id="sy-detail" class="sy-detail" aria-label="Fiche du symbole"></aside></div>
    <p class="sy-message" id="sy-message" role="status"></p></div>`;
  // Garder les raccourcis de dessin hors de cette page (supprimer, copier, lettres d’outil…).
  el.addEventListener("keydown", (e) => { if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "k") e.stopPropagation(); });
  for (const [id, key] of [["sy-search", "q"], ["sy-category", "category"], ["sy-origin", "origin"]]) {
    el.querySelector(`#${id}`).addEventListener(key === "q" ? "input" : "change", (e) => { filters[key] = e.target.value; renderGrid(); });
  }
  function tell(s) { message = s; el.querySelector("#sy-message").textContent = s; }
  function renderGrid() {
    const list = filterSymbols(all(), filters);
    el.querySelector("#sy-count").textContent = `${list.length} / ${all().length} symboles`;
    el.querySelector("#sy-grid").innerHTML = list.length ? list.map((d) => `<button class="sy-card ${selected === d.id ? "chosen" : ""}" data-symbol="${esc(d.id)}" aria-pressed="${selected === d.id}" title="${esc(d.name)} — ${status(d)}">
      <span class="sy-preview">${preview(d)}</span><span class="sy-name">${esc(d.name)}</span><span class="sy-tag ${d.origin === "be" ? "sy-be" : ""}">${esc(d.origin === "be" ? status(d) : d.type)}</span></button>`).join("") : `<p class="mut">Aucun symbole. Modifiez les filtres ou ajoutez une variante BE.</p>`;
  }
  function renderDetail() {
    const d = entry(), detail = el.querySelector("#sy-detail");
    if (editing) { renderEditor(d); return; }
    if (!d) { detail.innerHTML = `<p class="mut">Sélectionnez un symbole.</p>`; return; }
    const spec = deviceInfo(d.type), J = getJournal();
    detail.innerHTML = `<div class="sy-large">${preview(d)}</div><span class="sy-tag ${d.origin === "be" ? "sy-be" : ""}">${status(d)}</span>
      <h3 class="sy-title">${esc(d.name)}</h3><p class="mut">${esc(d.category)}</p>
      <div class="sy-actions"><button data-action="insert" ${!d.type || !api.TYPES[d.type] ? "disabled" : ""} title="Activer la pose du symbole sur le plan">Insérer sur le plan</button><button data-action="edit">Modifier la fiche</button></div>
      ${d.origin === "be" ? `<p class="sy-warning">${d.type ? `Insertion avec le symbole Oktéo ${esc(d.type)}. Cette correspondance manuelle n’entraîne pas la reconnaissance automatique du dessin BE.` : "Dessin BE non appris. Aucune substitution automatique. Renseignez une correspondance explicite pour permettre l’insertion."}</p>` : ""}
      <dl><dt>Origine</dt><dd>${esc(d.source || "Non renseignée")}</dd>
      <dt>Hauteur par défaut</dt><dd>${api.TYPES[d.type]?.h != null ? `${api.TYPES[d.type].h} cm — réglable sur le plan` : "Selon implantation"}</dd>
      ${spec?.racc ? `<dt>Raccordement prévu</dt><dd>${esc({ direct: "Ligne directe", boite: "Boîte de pieuvre", choix: "À choisir par le BE" }[spec.racc])}</dd>` : ""}
      ${spec?.circuit ? `<dt>Réglage actuel du moteur</dt><dd>${spec.circuit.section} mm² · ${spec.circuit.prot} A</dd>` : ""}</dl>
      ${d.type === "PLAQ" ? `<p class="sy-warning">Le type PLAQ existe dans Oktéo (32 A). Le dessin « prise 32 A » du plan KICHOUH reste à fournir et à vérifier pour sa reconnaissance.</p>` : ""}
      ${d.notes ? `<p class="sy-notes">${esc(d.notes)}</p>` : ""}
      <h4>Règles associées <span class="sy-tag">${(d.rules || []).length}</span></h4>
      <p class="mut sy-small">Liens de consultation. Le statut et la source du journal restent ceux de chaque règle.</p>
      ${(d.rules || []).map((id) => { const r = J.rules.find((r) => r.id === id); return r ? `<details class="sy-rule"><summary>${esc(id)} · ${esc(r.titre)}</summary><p><span class="sy-tag">${esc(CERTS[r.certitude] || r.certitude)}</span> <span class="sy-tag">${esc(STATUTS[r.statut] || r.statut)}</span></p><p>${esc(r.description)}</p><p class="mut">Source : ${esc(r.source || "Non renseignée")}</p></details>` : `<p class="mut">${esc(id)} — règle absente du journal</p>`; }).join("") || `<p class="mut">Aucune règle liée pour l’instant.</p>`}
      <p class="mut sy-small">Modifications sans code pour l’instant. Fiches enregistrées sur ce navigateur. Le halo violet est réservé à l’emplacement restant à préciser.</p>`;
  }
  function renderEditor(d) {
    const isBE = !d || d.origin === "be";
    el.querySelector("#sy-detail").innerHTML = `<form id="sy-form"><h3>${d ? "Modifier la fiche" : "Ajouter un symbole BE"}</h3>
      <p class="mut sy-small">Sans code pour l’instant. Les règles de câblage et le dessin natif restent gérés par leurs modules.</p>
      <label>Nom<input name="name" required maxlength="100" value="${esc(d?.name || "")}"></label>
      <label>Catégorie<select name="category">${options(GROUPS.map((s) => [s, s]), d?.category || "Prises")}</select></label>
      <label>Source / légende BE<input name="source" maxlength="180" value="${esc(d?.source || "")}" placeholder="Pavillonneur, plan, page…"></label>
      ${isBE ? `<label>Dessin original BE<input name="image" type="file" accept="image/png,image/jpeg,image/webp"></label><p class="mut sy-small">PNG, JPEG ou WebP · 5 Mo maximum. Image réduite pour la fiche.</p><div class="sy-upload-preview">${image ? `<img src="${esc(image)}" alt="Dessin BE sélectionné">` : "Dessin BE à fournir"}</div>
        <label>Correspondance Oktéo<select name="type">${options([["", "Non reconnu — aucune substitution"], ...Object.entries(api.TYPES).map(([t, s]) => [t, `${t} · ${s.n}`])], d?.type || "")}</select></label>` : ""}
      <label>Règles liées<input name="rules" value="${esc((d?.rules || []).join(", "))}" placeholder="R-084, R-096"></label>
      <label>Notes<textarea name="notes" maxlength="2000" rows="4">${esc(d?.notes || "")}</textarea></label>
      <p class="sy-form-error" role="alert"></p><div class="sy-actions"><button type="submit">Enregistrer</button><button type="button" data-action="cancel">Annuler</button></div></form>`;
    const form = el.querySelector("#sy-form");
    let reading = false;
    const error = (s) => { form.querySelector(".sy-form-error").textContent = s; };
    if (isBE) form.elements.image.onchange = async () => {
      const f = form.elements.image.files[0]; if (!f) return;
      if (!/^image\/(png|jpeg|webp)$/.test(f.type) || f.size > 5 * 1024 * 1024) { error("Image attendue : PNG, JPEG ou WebP de 5 Mo maximum."); return; }
      reading = true; error("");
      try {
        const bitmap = await createImageBitmap(f), ratio = Math.min(1, 600 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(bitmap.width * ratio)); canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
        canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close(); image = canvas.toDataURL("image/png");
        form.querySelector(".sy-upload-preview").innerHTML = `<img src="${image}" alt="Dessin BE sélectionné">`;
      } catch { error("Impossible de lire cette image."); } finally { reading = false; }
    };
    form.onsubmit = (e) => {
      e.preventDefault(); if (reading) { error("Lecture de l’image en cours."); return; }
      const f = new FormData(form), name = String(f.get("name")).trim();
      const rules = [...new Set(String(f.get("rules")).split(/[,;\s]+/).filter(Boolean))];
      if (!name) { error("Renseignez un nom."); return; }
      const unknown = rules.filter((id) => !getJournal().rules.some((r) => r.id === id));
      if (unknown.length) { error(`Règle inconnue : ${unknown.join(", ")}`); return; }
      const next = structuredClone(data), id = d?.id || `be-${crypto.randomUUID()}`;
      const patch = { name, category: String(f.get("category")), source: String(f.get("source")).trim(), notes: String(f.get("notes")).trim(), rules };
      if (isBE) {
        const item = { ...patch, id, origin: "be", image, type: String(f.get("type")) };
        const idx = next.be.findIndex((r) => r.id === id); if (idx < 0) next.be.push(item); else next.be[idx] = item;
      } else next.overrides[id] = patch;
      next.history ||= []; next.history.push({ at: new Date().toISOString(), id, action: d ? "modifier" : "ajouter", before: d || null, after: isBE ? { ...patch, type: String(f.get("type")) } : patch });
      if (!saveSymbols(next)) { error("Enregistrement impossible : stockage du navigateur indisponible ou plein. Exportez vos fiches."); return; }
      data = next; selected = id; editing = false; render(); tell("Fiche enregistrée.");
    };
    form.elements.name.focus();
  }
  el.addEventListener("click", (e) => {
    const card = e.target.closest("[data-symbol]");
    if (card) { if (editing) { tell("Enregistrez ou annulez la fiche avant de changer de symbole."); return; } selected = card.dataset.symbol; renderGrid(); renderDetail(); return; }
    const action = e.target.closest("[data-action]")?.dataset.action, d = entry();
    if (action === "insert" && d?.type && api.TYPES[d.type]) { api.setTab("plan"); api.setTool(d.type); api.setHint(`${d.name} : cliquez sur le plan pour poser l’appareil. Échap pour terminer.`); }
    if (action === "edit") { editing = true; image = d?.image || ""; renderDetail(); }
    if (action === "add") { if (editing) { tell("Enregistrez ou annulez la fiche en cours."); return; } selected = ""; editing = true; image = ""; renderGrid(); renderDetail(); }
    if (action === "cancel") { editing = false; selected ||= "PC16"; render(); }
    if (action === "export") downloadBlob(new Blob([JSON.stringify({ okteo: "bibliotheque-symboles", ...data, entries: all() }, null, 2)], { type: "application/json" }), "okteo-bibliotheque-symboles.json");
  });
  document.addEventListener("okteo:regles", () => { if (api.tab === "bibliotheque" && !editing) renderDetail(); });
  function render() { renderGrid(); if (!(editing && el.querySelector("#sy-form"))) renderDetail(); tell(message); }
  render(); return { render };
}
