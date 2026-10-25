// Page « Chantiers » : chantier ouvert, nouveau chantier (avec fond de plan), liste, ouvrir, dupliquer,
// supprimer, enregistrer en fichier .okteo et ouvrir un fichier .okteo.
// Changer de chantier recharge la page (le cœur repart proprement sur le chantier choisi).
import * as CHS from "../chantiers.js";
import { isPdf, isImage, openPdf, pdfThumbs, renderPdfPage, loadImage } from "./fond-import.js";
import { esc, norm } from "./util.js";

const fmtDate = (t) => (t ? new Date(t).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const blobToDataURL = (b) => new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); });
const dataURLToBlob = async (u) => (await fetch(u)).blob();

export function openChantier(id, reload = () => location.reload()) { CHS.setCurrent(id); reload(); }

// Prépare un fond (image + PDF d'origine) et l'enregistre pour le chantier `id`
async function storeFond(id, file, pdfDoc, pageNo) {
  let r;
  if (pdfDoc) { r = await renderPdfPage(pdfDoc, pageNo); await CHS.putFile("pdf:" + id, file); }
  else { r = await loadImage(file); await CHS.delFile("pdf:" + id).catch(() => {}); }
  await CHS.putFile("fond:" + id, r.blob);
  const w = r.provisionalW, h = w * r.pxH / r.pxW;
  return { src: "idb", name: file.name + (pdfDoc ? ` (page ${pageNo})` : ""), page: pdfDoc ? pageNo : null, pxW: r.pxW, pxH: r.pxH, x: 0, y: 0, w, h, calibre: false };
}

export function mountChantiers(el, { api }) {
  const cur = CHS.current();
  let q = "", mode = null; // mode : null | "new" | "fond"
  let pick = { file: null, doc: null, thumbs: [], page: 1, busy: "" };
  let confirmDel = null;

  function fondHTML() {
    if (!pick.file) return `<p class="mut">Facultatif : PDF du plan (choix de la page) ou image (JPG, PNG, photo).</p>`;
    if (pick.busy) return `<p class="mut">${esc(pick.busy)}</p>`;
    if (pick.doc) return `<p class="mut">${esc(pick.file.name)} · ${pick.doc.numPages} page${pick.doc.numPages > 1 ? "s" : ""} : cliquez la page du plan à utiliser.</p>
      <div class="thumbs">${pick.thumbs.map((t) => `<button type="button" class="thumb ${t.page === pick.page ? "on" : ""}" data-page="${t.page}"><img src="${t.url}" alt="Page ${t.page}"><span>Page ${t.page}</span></button>`).join("")}</div>`;
    return `<p class="mut">${esc(pick.file.name)} (image)</p>`;
  }

  function formHTML() {
    const isNew = mode === "new";
    return `<div class="ch-form">
      <h3>${isNew ? "Nouveau chantier" : "Changer le fond du chantier ouvert"}</h3>
      ${isNew ? `<div class="ch-grid">
        <label class="f">Nom du client / chantier *<input id="nf-nom" autocomplete="off" placeholder="ex. DUPONT"></label>
        <label class="f">N° de dossier<input id="nf-num" autocomplete="off" placeholder="ex. 05012"></label>
        <label class="f">Pavillonneur<input id="nf-cli" autocomplete="off" list="dl-clients" placeholder="ex. Maisons CPR"><datalist id="dl-clients">${[...new Set(CHS.list().map((c) => c.client).filter(Boolean))].map((c) => `<option value="${esc(c)}">`).join("")}</datalist></label>
      </div>` : `<p class="mut">Le dessin reste en place ; seul le fond change. Il faudra ensuite régler son échelle.</p>`}
      <label class="f">Fond de plan<input id="nf-file" type="file" accept=".pdf,application/pdf,image/*"></label>
      <div id="nf-fond">${fondHTML()}</div>
      <p class="warn" id="nf-err" hidden></p>
      <div class="ch-actions"><button class="on" id="nf-ok" ${pick.busy ? "disabled" : ""}>${isNew ? "Créer et ouvrir" : "Remplacer le fond"}</button><button id="nf-cancel">Annuler</button></div>
      <p class="mut">Après l'ouverture : cliquez deux points d'une cote connue du plan et tapez sa longueur ; le fond est alors à l'échelle exacte.</p>
    </div>`;
  }

  function row(c) {
    const isCur = c.id === cur.id, st = c.stats;
    const del = confirmDel === c.id
      ? `<button class="danger" data-act="del-yes" data-id="${c.id}">Confirmer la suppression</button><button data-act="del-no">Non</button>`
      : `<button data-act="del" data-id="${c.id}" ${isCur ? 'disabled title="Ouvrez un autre chantier avant de supprimer celui-ci"' : ""}>Supprimer</button>`;
    return `<tr class="${isCur ? "cur" : ""}">
      <td><b>${esc(c.nom)}</b>${isCur ? ` <span class="pill">ouvert</span>` : ""}<div class="mut sm">${esc(c.fond ? c.fond.name : "sans fond")}${c.fond && !c.fond.calibre ? " · échelle à régler" : ""}</div></td>
      <td class="num">${esc(c.numero || "")}</td><td>${esc(c.client || "")}</td>
      <td class="sm">${fmtDate(c.updated || c.created)}</td>
      <td class="sm">${st ? (st.pieces + st.appareils + st.murs ? `${st.pieces} pièce${st.pieces > 1 ? "s" : ""} · ${st.appareils} app.` : "vide") : "—"}</td>
      <td><div class="acts">${isCur ? "" : `<button class="on" data-act="open" data-id="${c.id}">Ouvrir</button>`}<button data-act="dup" data-id="${c.id}">Dupliquer</button><button data-act="file" data-id="${c.id}" title="Enregistrer le chantier dans un fichier .okteo (dessin + fond)">Fichier</button>${del}</div></td></tr>`;
  }

  function render() {
    const all = CHS.list().slice().sort((a, b) => (b.updated || b.created || 0) - (a.updated || a.created || 0));
    const words = norm(q).split(/\s+/).filter(Boolean);
    const shown = all.filter((c) => words.every((w) => norm(`${c.nom} ${c.numero} ${c.client}`).includes(w)));
    el.innerHTML = `<div class="params-in wide">
      <h2>Chantiers</h2>
      <section class="ch-cur">
        <h3>Chantier ouvert</h3>
        <div class="ch-grid">
          <label class="f">Nom<input data-f="nom" value="${esc(cur.nom)}"></label>
          <label class="f">N° de dossier<input data-f="numero" value="${esc(cur.numero || "")}"></label>
          <label class="f">Pavillonneur<input data-f="client" value="${esc(cur.client || "")}"></label>
        </div>
        <div class="ch-fond"><span>Fond : <b>${esc(cur.fond ? cur.fond.name : "aucun")}</b> ${cur.fond ? (cur.fond.calibre ? `<span class="okk">✓ à l'échelle (${(cur.fond.w).toFixed(2)} m de large)</span>` : `<span class="warn">échelle à régler</span>`) : ""}</span>
          <span class="grow"></span>
          ${cur.fond ? `<button id="ch-calib" title="Cliquer deux points d'une cote connue, puis taper sa longueur">Régler l'échelle</button>` : ""}
          ${cur.fond && cur.fond.src === "idb" && cur.fond.page ? `<button id="ch-walls" class="on" title="Relever automatiquement les murs du PDF (sans IA)">Relever les murs</button> <button id="ch-devices" title="Relever automatiquement les appareils du PDF (prises, lumières, interrupteurs…), sans IA">Relever les appareils</button>` : ""}
          <button id="ch-fond">${cur.fond ? "Changer le fond…" : "Ajouter un fond…"}</button>
          <button data-act="file" data-id="${cur.id}">Enregistrer en fichier</button></div>
      </section>
      ${mode ? formHTML() : ""}
      <section>
        <div class="ch-bar"><button class="on" id="ch-new">＋ Nouveau chantier</button>
          <label class="btnlike">Ouvrir un fichier .okteo<input id="ch-import" type="file" accept=".okteo,application/json" hidden></label>
          <span class="grow"></span><input id="ch-q" placeholder="Chercher (nom, n°, pavillonneur)" value="${esc(q)}"></div>
        <table class="ch-list"><thead><tr><th>Chantier</th><th>N°</th><th>Pavillonneur</th><th>Modifié</th><th>Contenu</th><th></th></tr></thead>
        <tbody>${shown.map(row).join("") || `<tr><td colspan="6" class="mut">Aucun chantier ne correspond.</td></tr>`}</tbody></table>
        <p class="mut">Les chantiers sont enregistrés dans ce navigateur, sur ce PC. Le bouton <b>Fichier</b> en fait une copie (.okteo) à ranger sur le réseau ou à transmettre.</p>
      </section></div>`;
    wire();
  }

  function err(msg) { const e = el.querySelector("#nf-err"); if (e) { e.hidden = !msg; e.textContent = msg || ""; } }

  function wire() {
    el.querySelectorAll(".ch-cur input[data-f]").forEach((inp) => (inp.onchange = () => {
      const v = inp.value.trim(); if (inp.dataset.f === "nom" && !v) { inp.value = cur.nom; return; }
      cur[inp.dataset.f] = v; CHS.update(cur.id, { [inp.dataset.f]: v });
      const bd = document.querySelector(".badge"); if (bd) bd.textContent = cur.nom + (cur.numero ? " · " + cur.numero : "");
    }));
    el.querySelector("#ch-calib")?.addEventListener("click", () => api.startCalib());
    el.querySelector("#ch-walls")?.addEventListener("click", () => document.dispatchEvent(new CustomEvent("okteo:walls")));
    el.querySelector("#ch-devices")?.addEventListener("click", () => document.dispatchEvent(new CustomEvent("okteo:devices")));
    el.querySelector("#ch-fond").onclick = () => { mode = "fond"; pick = { file: null, doc: null, thumbs: [], page: 1, busy: "" }; render(); };
    el.querySelector("#ch-new").onclick = () => { mode = "new"; pick = { file: null, doc: null, thumbs: [], page: 1, busy: "" }; render(); el.querySelector("#nf-nom")?.focus(); };
    const qi = el.querySelector("#ch-q"); qi.oninput = () => { q = qi.value; const pos = qi.selectionStart; render(); const n = el.querySelector("#ch-q"); n.focus(); n.setSelectionRange(pos, pos); };
    el.querySelector("#ch-import").onchange = (e) => importFile(e.target.files[0]);
    el.querySelectorAll("[data-act]").forEach((b) => (b.onclick = () => act(b.dataset.act, b.dataset.id)));
    if (mode) wireForm();
  }

  function wireForm() {
    const fi = el.querySelector("#nf-file");
    fi.onchange = async () => {
      const f = fi.files[0]; if (!f) return;
      if (!isPdf(f) && !isImage(f)) { err("Format non pris en charge : PDF, JPG ou PNG."); return; }
      const keep = { nom: el.querySelector("#nf-nom")?.value, num: el.querySelector("#nf-num")?.value, cli: el.querySelector("#nf-cli")?.value };
      pick = { file: f, doc: null, thumbs: [], page: 1, busy: isPdf(f) ? "Lecture du PDF…" : "" };
      refreshFond();
      if (isPdf(f)) {
        try {
          pick.doc = await openPdf(f); pick.thumbs = await pdfThumbs(pick.doc);
          // un plan est en général en paysage : on présélectionne la dernière page paysage
          const land = pick.thumbs.filter((t) => t.wPt > t.hPt); pick.page = (land.at(-1) || pick.thumbs.at(-1)).page;
        } catch (e) { pick.file = null; err("PDF illisible : " + e.message); }
        pick.busy = ""; refreshFond(keep);
      }
    };
    el.querySelector("#nf-cancel").onclick = () => { mode = null; render(); };
    el.querySelector("#nf-ok").onclick = submit;
  }
  function refreshFond() {
    const box = el.querySelector("#nf-fond"); if (!box) return;
    box.innerHTML = fondHTML();
    box.querySelectorAll(".thumb").forEach((b) => (b.onclick = () => { pick.page = +b.dataset.page; refreshFond(); }));
    const ok = el.querySelector("#nf-ok"); if (ok) ok.disabled = !!pick.busy;
  }

  async function submit() {
    err("");
    const ok = el.querySelector("#nf-ok");
    if (mode === "fond" && !pick.file) { err("Choisissez d'abord le fichier du fond."); return; }
    let id = cur.id, meta = null;
    if (mode === "new") {
      const nom = el.querySelector("#nf-nom").value.trim();
      if (!nom) { err("Le nom est obligatoire."); el.querySelector("#nf-nom").focus(); return; }
      const numero = el.querySelector("#nf-num").value.trim(), client = el.querySelector("#nf-cli").value.trim();
      id = CHS.newId(nom, numero);
      meta = { id, nom, numero, client, key: CHS.dataKey(id), created: Date.now(), updated: Date.now(), stats: null, fond: null };
    }
    ok.disabled = true; ok.textContent = "Préparation du fond…";
    try {
      const fond = pick.file ? await storeFond(id, pick.file, pick.doc, pick.page) : null;
      if (meta) { meta.fond = fond; CHS.add(meta); }
      else { api.saveNow(); CHS.update(id, { fond }); }
      openChantier(id);
    } catch (e) { ok.disabled = false; ok.textContent = "Réessayer"; err("Échec : " + e.message); }
  }

  async function act(a, id) {
    const c = CHS.get(id);
    if (a === "open") { api.saveNow(); openChantier(id); return; }
    if (a === "del") { confirmDel = id; render(); return; }
    if (a === "del-no") { confirmDel = null; render(); return; }
    if (a === "del-yes") {
      try { localStorage.removeItem(c.key); localStorage.removeItem("okteo.chat." + c.id); } catch { /* */ }
      await CHS.delFile("fond:" + id).catch(() => {}); await CHS.delFile("pdf:" + id).catch(() => {});
      CHS.remove(id); confirmDel = null; render(); return;
    }
    if (a === "dup") {
      if (id === cur.id) api.saveNow();
      const nid = CHS.newId(c.nom + " copie", c.numero);
      const copy = { ...c, id: nid, nom: c.nom + " (copie)", key: CHS.dataKey(nid), created: Date.now(), updated: Date.now() };
      const d = CHS.readData(c); if (d) CHS.writeData(copy, d);
      if (c.fond && c.fond.src === "idb") {
        const f = await CHS.getFile("fond:" + id); if (f) await CHS.putFile("fond:" + nid, f);
        const p = await CHS.getFile("pdf:" + id); if (p) await CHS.putFile("pdf:" + nid, p);
      }
      CHS.add(copy); render(); return;
    }
    if (a === "file") { if (id === cur.id) api.saveNow(); await exportFile(c); }
  }

  async function exportFile(c) {
    const out = { format: "okteo-chantier", version: 1, exporte: new Date().toISOString(), chantier: { ...c, key: undefined }, dessin: CHS.readData(c), fond: null };
    if (c.fond) {
      out.fond = { ...c.fond };
      if (c.fond.src === "idb") {
        const f = await CHS.getFile("fond:" + c.id); if (f) out.fond.image = await blobToDataURL(f);
        const p = await CHS.getFile("pdf:" + c.id); if (p) out.fond.pdf = await blobToDataURL(p);
      }
    }
    const blob = new Blob([JSON.stringify(out)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${c.nom}${c.numero ? "_" + c.numero : ""}.okteo`.replace(/[\\/:*?"<>|]+/g, "_");
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  async function importFile(file) {
    if (!file) return;
    let j;
    try { j = JSON.parse(await file.text()); } catch { j = null; }
    if (!j || j.format !== "okteo-chantier") { el.querySelector(".ch-bar").insertAdjacentHTML("afterend", `<p class="warn">« ${esc(file.name)} » n'est pas un fichier de chantier Oktéo.</p>`); return; }
    const src = j.chantier || {};
    const id = CHS.newId(src.nom || "import", src.numero);
    const meta = { ...src, id, key: CHS.dataKey(id), updated: Date.now(), fond: null };
    if (j.fond) {
      const { image, pdf, ...f } = j.fond;
      if (image) { await CHS.putFile("fond:" + id, await dataURLToBlob(image)); f.src = "idb"; }
      if (pdf) await CHS.putFile("pdf:" + id, await dataURLToBlob(pdf));
      meta.fond = f;
    }
    if (j.dessin) CHS.writeData(meta, j.dessin);
    CHS.add(meta);
    api.saveNow(); openChantier(id);
  }

  render();
  return { render };
}
