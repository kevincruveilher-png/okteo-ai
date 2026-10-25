// Fenêtre « Imprimer / PDF » : réglages (format, orientation, échelle, options), aperçu du PDF, téléchargement.
import { buildPlanPdf, layoutPlan } from "./print.js";
import { esc, store, storeSet } from "./util.js";
import { pdfjs } from "./fond-import.js";

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
      <label class="f">Indice<input data-k="indice" value="A" maxlength="3"></label>
      <div class="pr-ck">
        <label><input type="checkbox" data-k="cotes"> Cotes</label>
        <label><input type="checkbox" data-k="reperes"> Repères et hauteurs</label>
        <label><input type="checkbox" data-k="liaisons"> Liaisons</label>
        <label><input type="checkbox" data-k="fond"> Fond de plan (estompé)</label>
        <label><input type="checkbox" data-k="nomenclature"> Page 2 : nomenclature</label>
      </div>
      <p class="pr-info"></p>
      <button class="on pr-dl">Télécharger le PDF</button>
      <p class="mut sm">Pour imprimer à l'échelle exacte : dans la fenêtre d'impression, choisir « Taille réelle » (100 %), pas « Ajuster à la page ».</p>
    </div>
    <div class="pr-view"><div class="pr-pages" aria-label="Aperçu du PDF"></div><div class="pr-wait">Préparation…</div></div>
  </div>`;
  document.body.appendChild(back);
  const $ = (s) => back.querySelector(s);
  let opts = { paper: "auto", orient: "auto", scale: "auto", niveau: "RDC", indice: "A", cotes: true, reperes: true, liaisons: true, fond: false, nomenclature: true, ...store(KEY, {}) };
  let last = null, url = null, timer = null, seq = 0;

  function fill() {
    back.querySelectorAll("[data-k]").forEach((el) => { const v = opts[el.dataset.k]; if (el.type === "checkbox") el.checked = !!v; else el.value = String(v); });
  }
  async function refresh() {
    const my = ++seq;
    $(".pr-wait").hidden = false;
    const geo = api.exportGeometry();
    const L = layoutPlan(geo, opts);
    $(".pr-info").innerHTML = `${L.paper} ${L.orient} · <b>1:${L.scale}</b> · ${L.fits ? "le plan tient dans le cadre" : `<span class="warn">le plan dépasse : choisissez un plus grand format ou une plus petite échelle</span>`}`;
    try {
      const r = await buildPlanPdf(geo, opts);
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
  back.onclick = (e) => { if (e.target === back) close(); };
  $(".pr-dl").onclick = async () => {
    if (!last) await refresh();
    const ch = api.ch, a = document.createElement("a");
    a.href = url; a.download = `${ch.nom}${ch.numero ? "_" + ch.numero : ""}_plan_${last.layout.paper}_1-${last.layout.scale}.pdf`.replace(/[\\/:*?"<>|]+/g, "_");
    document.body.appendChild(a); a.click(); a.remove();
  };
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") { e.preventDefault(); open(); return; }
    if (e.key === "Escape" && !back.hidden) close();
  });
  // le niveau imprimé est celui qui est ouvert
  function open() { if (api.tab !== "plan") api.setTab("plan"); opts.niveau = api.level.name; fill(); back.hidden = false; refresh(); }
  return { open, close, get last() { return last; } };
}
