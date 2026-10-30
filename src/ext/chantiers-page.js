import {ask,notify} from "../web/dialogs.js";
import {exportDirectory,pickProject,validateProject,acceptHistory,checkOlder} from "../web/exchange.js";
import {event,readHistory,saveHistory,revisionLabel} from "../web/history.js";
// Page « Chantiers » : chantier ouvert, nouveau chantier (avec fond de plan), liste, ouvrir, dupliquer,
// supprimer, enregistrer en fichier .okteo et ouvrir un fichier .okteo.
// Changer de chantier recharge la page (le cœur repart proprement sur le chantier choisi).
import * as CHS from "../chantiers.js";
import { isPdf, isImage, openPdf, pdfThumbs, renderPdfPage, loadImage } from "./fond-import.js";
import { esc, norm } from "./util.js";
import { buildOkteo, dataURLToBlob, download, fileName } from "./okteo-file.js";
import { backupBox, wireBackupBox, onChange as onBackupChange } from "./backup.js";

const fmtDate = (t) => (t ? new Date(t).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

export async function openChantier(id, reload = () => location.reload()) { CHS.setCurrent(id); await window.okteoFlush?.(); reload(); }

// Prépare un fond (image + PDF d'origine) et l'enregistre pour le niveau ouvert du chantier `meta`
async function storeFond(meta, file, pdfDoc, pageNo) {
  let r;
  if (pdfDoc) { r = await renderPdfPage(pdfDoc, pageNo); await CHS.putFile(CHS.pdfKey(meta), file); }
  else { r = await loadImage(file); await CHS.delFile(CHS.pdfKey(meta)).catch(() => {}); }
  await CHS.putFile(CHS.fondKey(meta), r.blob);
  const w = r.provisionalW, h = w * r.pxH / r.pxW;
  return { src: "idb", name: file.name + (pdfDoc ? ` (page ${pageNo})` : ""), page: pdfDoc ? pageNo : null, pxW: r.pxW, pxH: r.pxH, x: 0, y: 0, w, h, calibre: false, paperW: pdfDoc ? r.provisionalW / 50 : null };
}

export function mountChantiers(el, { api }) {
  let cur = CHS.current();
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
    cur = CHS.current();                        // le niveau ouvert (et donc le fond) a pu changer
    const all = CHS.list().slice().sort((a, b) => (b.updated || b.created || 0) - (a.updated || a.created || 0));
    const words = norm(q).split(/\s+/).filter(Boolean);
    const shown = all.filter((c) => words.every((w) => norm(`${c.nom} ${c.numero} ${c.client}`).includes(w)));
    el.innerHTML = `<div class="params-in wide">
      <h2>Chantiers</h2>
      <section class="ch-cur">
        <h3>Chantier ouvert</h3><div class="ch-actions"><button id="web-export">Exporter le dossier…</button><button id="web-final" class="on">Finaliser et exporter…</button><button id="web-history">Journal du chantier</button></div>
        <div class="ch-grid">
          <label class="f">Nom<input data-f="nom" value="${esc(cur.nom)}"></label>
          <label class="f">N° de dossier<input data-f="numero" value="${esc(cur.numero || "")}"></label>
          <label class="f">Pavillonneur<input data-f="client" value="${esc(cur.client || "")}"></label>
        </div>
        <div class="ch-fond"><span>Fond du niveau « ${esc((CHS.levelsOf(cur).find((l) => l.id === (cur.level || "rdc")) || {}).name || "RDC")} » : <b>${esc(cur.fond ? cur.fond.name : "aucun")}</b>${cur.fond && cur.fond.reprise ? ` <span class="mut sm">(échelle reprise du niveau « ${esc(cur.fond.reprise)} »)</span>` : ""} ${cur.fond ? (cur.fond.calibre ? `<span class="okk">✓ à l'échelle (${(cur.fond.w).toFixed(2)} m de large)</span>` : `<span class="warn">échelle à régler</span>`) : ""}</span>
          <span class="grow"></span>
          ${cur.fond ? `<button id="ch-calib" title="Cliquer deux points d'une cote connue, puis taper sa longueur">Régler l'échelle</button>` : ""}
          ${cur.fond && cur.fond.src === "idb" && cur.fond.page ? `<button id="ch-walls" class="on" title="Relever automatiquement les murs du PDF (sans IA)">Relever les murs</button> <button id="ch-devices" title="Relever automatiquement les appareils du PDF (prises, lumières, interrupteurs…), sans IA">Relever les appareils</button>` : ""}
          <button id="ch-fond">${cur.fond ? "Changer le fond…" : "Ajouter un fond…"}</button>
          <button data-act="file" data-id="${cur.id}">Enregistrer en fichier</button></div>
      </section>
      ${mode ? formHTML() : ""}
      <section>
        <div class="ch-bar"><button id="web-import">Ouvrir un dossier Oktéo…</button><button class="on" id="ch-new">＋ Nouveau chantier</button>
          <label class="btnlike">Ouvrir un fichier .okteo<input id="ch-import" type="file" accept=".okteo,application/json" hidden></label>
          <span class="grow"></span><input id="ch-q" placeholder="Chercher (nom, n°, pavillonneur)" value="${esc(q)}"></div>
        <table class="ch-list"><thead><tr><th>Chantier</th><th>N°</th><th>Pavillonneur</th><th>Modifié</th><th>Contenu</th><th></th></tr></thead>
        <tbody>${shown.map(row).join("") || `<tr><td colspan="6" class="mut">Aucun chantier ne correspond.</td></tr>`}</tbody></table>
        <p class="mut">Les chantiers sont enregistrés dans ce navigateur, sur ce PC. Le bouton <b>Fichier</b> en fait une copie (.okteo) à ranger sur le réseau ou à transmettre.</p>
      </section>
      <div id="ch-bkp-slot">${backupBox()}</div></div>`;
    wire();
  }

  // encart « Sauvegarde automatique » : redessiné seul (sans toucher aux champs en cours de saisie)
  function paintBkp() { const sl = el.querySelector("#ch-bkp-slot"); if (!sl) return; sl.innerHTML = backupBox(); wireBackupBox(sl, paintBkp); }
  onBackupChange(paintBkp);

  function err(msg) { const e = el.querySelector("#nf-err"); if (e) { e.hidden = !msg; e.textContent = msg || ""; } }

  function wire() {
    paintBkp();
    const report=e=>{if(e.name!=="AbortError")notify(e.message);};
    el.querySelector("#web-export").onclick=()=>exportDirectory(api,false).catch(report);
    el.querySelector("#web-final").onclick=()=>exportDirectory(api,true).catch(report);
    el.querySelector("#web-import").onclick=()=>pickProject().then(importFile).catch(report);
    el.querySelector("#web-history").onclick=()=>{const h=readHistory(cur.id);const d=document.createElement("dialog");d.style.cssText="max-width:900px;width:90vw;max-height:80vh;overflow:auto";const pre=document.createElement("pre");pre.style.whiteSpace="pre-wrap";pre.textContent=h.events.map(e=>`${e.at} · ${e.author} · ${e.type}\n${JSON.stringify(e.change)}${e.reason?"\nMotif : "+e.reason:""}`).join("\n\n")||"Aucun événement";const close=document.createElement("button");close.textContent="Fermer";close.onclick=()=>d.remove();d.append(close,pre);document.body.append(d);d.showModal();};
    el.querySelectorAll(".ch-cur input[data-f]").forEach((inp) => (inp.onchange = () => {
      const v = inp.value.trim(); if (inp.dataset.f === "nom" && !v) { inp.value = cur.nom; return; }
      event(cur.id,"identite",{element:inp.dataset.f,before:cur[inp.dataset.f],after:v});
      cur[inp.dataset.f] = v; CHS.update(cur.id, { [inp.dataset.f]: v });
      const bd = document.querySelector(".badge"); if (bd) bd.textContent = cur.nom + (cur.numero ? " · " + cur.numero : "");
    }));
    el.querySelector("#ch-calib")?.addEventListener("click", () => api.startCalib());
    el.querySelector("#ch-walls")?.addEventListener("click", () => document.dispatchEvent(new CustomEvent("okteo:walls")));
    el.querySelector("#ch-devices")?.addEventListener("click", () => document.dispatchEvent(new CustomEvent("okteo:devices")));
    el.querySelector("#ch-fond").onclick = () => { mode = "fond"; pick = { file: null, doc: null, thumbs: [], page: 1, busy: "" }; render(); };
    el.querySelector("#ch-new").onclick = () => { mode = "new"; pick = { file: null, doc: null, thumbs: [], page: 1, busy: "" }; render(); el.querySelector("#nf-nom")?.focus(); };
    const qi = el.querySelector("#ch-q"); qi.oninput = () => { q = qi.value; const pos = qi.selectionStart; render(); const n = el.querySelector("#ch-q"); n.focus(); n.setSelectionRange(pos, pos); };
    el.querySelector("#ch-import").onchange = (e) => importFile(e.target.files[0]).catch(err=>notify(err.message));
    el.querySelectorAll("[data-act]").forEach((b) => (b.onclick = () => act(b.dataset.act, b.dataset.id).catch(err=>notify(err.message))));
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
      const target = meta || CHS.current();
      let fond = pick.file ? await storeFond(target, pick.file, pick.doc, pick.page) : null;
      // autre page du même PDF qu'un niveau déjà à l'échelle (même format) : on reprend sa position et son échelle
      if (fond && !meta) {
        const base = (n) => String(n || "").replace(/ \(page \d+\)$/, "");
        const twin = CHS.levelsOf(target).find((l) => l.id !== (target.level || "rdc") && l.fond && l.fond.calibre && l.fond.pxW === fond.pxW && l.fond.pxH === fond.pxH && base(l.fond.name) === base(fond.name));
        if (twin) fond = { ...fond, x: twin.fond.x, y: twin.fond.y, w: twin.fond.w, h: twin.fond.h, calibre: true, reprise: twin.name };
      }
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
      try { localStorage.removeItem(c.key); localStorage.removeItem("okteo.chat." + c.id); localStorage.removeItem("okteo.audit." + c.id); } catch { /* */ }
      for (const l of CHS.levelsOf(c)) { await CHS.delFile(CHS.fondKey(c, l.id)).catch(() => {}); await CHS.delFile(CHS.pdfKey(c, l.id)).catch(() => {}); }
      CHS.remove(id); confirmDel = null; render(); return;
    }
    if (a === "dup") {
      if (id === cur.id) api.saveNow();
      const nid = CHS.newId(c.nom + " copie", c.numero);
      const copy = { ...c, id: nid, nom: c.nom + " (copie)", key: CHS.dataKey(nid), created: Date.now(), updated: Date.now() };
      const d = CHS.readData(c); if (d) CHS.writeData(copy, d);
      for (const l of CHS.levelsOf(c)) {
        const f = await CHS.getFile(CHS.fondKey(c, l.id)).catch(() => null); if (f) await CHS.putFile(CHS.fondKey(copy, l.id), f);
        const p = await CHS.getFile(CHS.pdfKey(c, l.id)).catch(() => null); if (p) await CHS.putFile(CHS.pdfKey(copy, l.id), p);
      }
      saveHistory(nid,structuredClone(readHistory(c.id)));event(nid,"copie",{source:c.id});
      CHS.add(copy); render(); return;
    }
    if (a === "file" && window.okteoSession && id === cur.id) { await exportDirectory(api,false).catch(e=>{if(e.name!=="AbortError")notify(e.message);}); return; }
    if (a === "file") { if (id === cur.id) api.saveNow(); await exportFile(c); }
  }

  async function exportFile(c) {
    const h=readHistory(c.id);h.revision++;h.parentRevision=h.head;h.head=crypto.randomUUID();saveHistory(c.id,h);event(c.id,"export-fichier",{revision:h.revision,head:h.head,parent:h.parentRevision});
    download(await buildOkteo(c, c.id === cur.id ? api.packData() : null), fileName(c).replace(/\.okteo$/, "_"+revisionLabel(h.revision)+".okteo"));
  }

  async function importFile(file) {
    if (!file) return;
    if(file.size>150*1024*1024){notify("Dossier limité à 150 Mo. Contactez un administrateur.");return;}
    let j;
    try { j = JSON.parse(await file.text()); } catch { j = null; }
    if (!j || j.format !== "okteo-chantier") { el.querySelector(".ch-bar").insertAdjacentHTML("afterend", `<p class="warn">« ${esc(file.name)} » n'est pas un fichier de chantier Oktéo.</p>`); return; }
    try {validateProject(j);} catch(e) {notify(e.message);return;}
    if(!await checkOlder(j)) return;
    const src = j.chantier || {};
    const id = CHS.newId(src.nom || "import", src.numero);
    const meta = { ...src, ruleSnapshot: j.ruleSnapshot || src.ruleSnapshot, id, key: CHS.dataKey(id), updated: Date.now(), fond: null };
    if (j.fond) {
      const { image, pdf, ...f } = j.fond;
      if (image) { await CHS.putFile(CHS.fondKey(meta), await dataURLToBlob(image)); f.src = "idb"; }
      if (pdf) await CHS.putFile(CHS.pdfKey(meta), await dataURLToBlob(pdf));
      meta.fond = f;
    }
    // fonds des autres niveaux (fichiers .okteo v24)
    for (const [lid, F] of Object.entries(j.fonds || {})) {
      if (F.image) await CHS.putFile(CHS.fondKey(meta, lid), await dataURLToBlob(F.image));
      if (F.pdf) await CHS.putFile(CHS.pdfKey(meta, lid), await dataURLToBlob(F.pdf));
    }
    meta.levels=CHS.levelsOf(meta).map(l=>({...l,fond:l.id===(meta.level||"rdc")?meta.fond:j.fonds?.[l.id]?.image?{...l.fond,src:"idb"}:l.fond}));
    if (j.dessin) CHS.writeData(meta, j.dessin);
    acceptHistory(j,id);
    CHS.add(meta);
    api.saveNow(); openChantier(id);
  }

  render();
  return { render };
}
