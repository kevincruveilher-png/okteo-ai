// « Relever les murs du PDF » : lance le relevé automatique (src/walls/*), montre l'aperçu sur le plan,
// permet d'ajuster l'épaisseur min/max, puis ajoute les murs au dessin (un seul Ctrl+Z pour tout annuler).
import * as CHS from "../chantiers.js";
import { detectWalls } from "../walls/detect.js";
import { autoScale, chantierPage, chantierScaleCheck, pageMap } from "./pdf-page.js";
import { esc } from "./util.js";

export function createWallsTool({ api }) {
  const card = document.createElement("div");
  card.className = "wcard"; card.hidden = true; card.setAttribute("role", "dialog"); card.setAttribute("aria-label", "Relevé des murs");
  document.querySelector(".stage").appendChild(card);
  let page = null, res = null, scale = null, auto = null, opts = { tMin: 4, tMax: 45 }, replace = false, busy = false, detectRoomsAfter = true;

  const close = () => { card.hidden = true; api.setPreview(null); res = null; };
  function show(html) { card.innerHTML = `<div class="wcard-h"><b>Relevé des murs</b><button class="wx" title="Fermer">✕</button></div>${html}`; card.hidden = false; card.querySelector(".wx").onclick = close; }

  function message(text, buttons = []) {
    show(`<p>${text}</p><div class="wrow">${buttons.map((b, i) => `<button data-i="${i}" class="${i === 0 ? "on" : ""}">${esc(b.label)}</button>`).join("")}</div>`);
    card.querySelectorAll("[data-i]").forEach((el) => (el.onclick = () => { const b = buttons[+el.dataset.i]; close(); b.run(); }));
  }

  function compute() {
    res = detectWalls(page.segs, pageMap(api, page), { tMin: opts.tMin / 100, tMax: opts.tMax / 100, shapes: page.shapes });
    api.setPreview(res);
  }

  function summary() {
    const by = {};
    res.walls.forEach((w) => { const e = Math.round(w.ep * 100); by[e] = (by[e] || 0) + 1; });
    const ep = Object.entries(by).sort((a, b) => +a[0] - +b[0]).map(([e, n]) => `${n} × ${e} cm`).join(" · ");
    const nP = res.openings.filter((o) => o.kind === "porte").length, nF = res.openings.length - nP;
    const existing = api.state.segs.length;
    const ecart = scale ? (scale.facteur - 1) * 100 : 0, okScale = scale && Math.abs(ecart) <= 1.5;
    const pct = (v) => Math.abs(v).toFixed(1).replace(".", ",") + " %";
    const scaleLine = auto && auto.auto ? `<p class="ok sm" id="w-scale">✓ Échelle réglée automatiquement d'après ${auto.cotes} cotes du plan.</p>` : !scale ? "" : okScale
      ? `<p class="ok sm" id="w-scale">✓ Échelle confirmée par ${scale.cotes} cotes du plan (écart ${pct(ecart)}).</p>`
      : `<p class="warn sm" id="w-scale">⚠ ${scale.cotes} cotes du plan indiquent que l'échelle du fond est ${ecart > 0 ? "trop petite" : "trop grande"} de ${pct(ecart)}.
         ${api.state.segs.length ? "Refaites la mise à l'échelle sur la plus grande cote du plan." : `<button id="w-fix" title="Remet le fond à l'échelle donnée par les cotes du plan">Corriger l'échelle</button>`}</p>`;
    show(`
      ${scaleLine}
      <p class="wbig"><b>${res.walls.length}</b> murs · <b>${res.openings.length}</b> ouvertures <span class="mut">(${nP} portes, ${nF} fenêtres, à confirmer)</span></p>
      ${res.stats.portesEnTravers ? `<p class="mut sm">Dont ${res.stats.portesEnTravers} porte${res.stats.portesEnTravers > 1 ? "s" : ""} posée${res.stats.portesEnTravers > 1 ? "s" : ""} en travers d'un couloir sans cloison dessinée (ex. WC sur dégagement) : un mur avec porte est ajouté pour fermer la pièce.</p>` : ""}
      <p class="mut">Épaisseurs : ${ep || "—"}<br>Méthode : ${res.mode === "aplats" ? "murs grisés du PDF (fiable)" : "traits du PDF (méthode de secours : à vérifier de près)"}</p>
      <div class="wgrid">
        <label>Épaisseur min. <span><input id="w-min" type="number" min="1" max="40" step="1" value="${opts.tMin}"> cm</span></label>
        <label>Épaisseur max. <span><input id="w-max" type="number" min="5" max="80" step="1" value="${opts.tMax}"> cm</span></label>
      </div>
      ${existing ? `<label class="wck"><input type="checkbox" id="w-rep" ${replace ? "checked" : ""}> Remplacer les ${existing} murs déjà dessinés</label>` : ""}
      <div class="wrow"><button class="on" id="w-ok" ${res.walls.length ? "" : "disabled"}>Ajouter au dessin</button><button id="w-no">Annuler</button></div>
      <label class="wck"><input type="checkbox" id="w-rooms" ${detectRoomsAfter ? "checked" : ""}> Détecter ensuite les pièces (noms lus sur le plan)</label>
      <p class="mut sm">En orange : l'aperçu. Après l'ajout, tout reste modifiable (glisser, supprimer, longueur et épaisseur dans le menu du mur, porte ↔ fenêtre dans le menu de l'ouverture). Ctrl+Z annule tout l'ajout.</p>`);
    const rerun = () => { const a = +card.querySelector("#w-min").value, b = +card.querySelector("#w-max").value; if (a > 0 && b > a) { opts = { tMin: a, tMax: b }; compute(); summary(); } };
    card.querySelector("#w-min").onchange = rerun; card.querySelector("#w-max").onchange = rerun;
    const rp = card.querySelector("#w-rep"); if (rp) rp.onchange = () => { replace = rp.checked; };
    const dr = card.querySelector("#w-rooms"); dr.onchange = () => { detectRoomsAfter = dr.checked; };
    card.querySelector("#w-no").onclick = close;
    const fx = card.querySelector("#w-fix");
    if (fx) fx.onclick = () => { const a = { x: api.BG.x, y: api.BG.y }; close(); api.applyCalib(a, { x: a.x + 1, y: a.y }, scale.facteur); };
    card.querySelector("#w-ok").onclick = () => {
      const r = api.importWalls(res, { replace });
      card.hidden = true; res = null;
      api.setHint(`Relevé ajouté : ${r.murs} murs, ${r.ouvertures} ouvertures. Vérifiez portes et fenêtres ; Ctrl+Z pour tout annuler.`);
      document.dispatchEvent(new CustomEvent("okteo:walls-imported", { detail: { ...r, rooms: detectRoomsAfter } }));
    };
  }

  async function open() {
    if (busy) return;
    const ch = api.ch;
    if (api.tab !== "plan") api.setTab("plan");
    if (!ch.fond) return message("Ce chantier n'a pas encore de plan. Ajoutez le PDF du plan dans l'onglet Chantiers.", [{ label: "Ouvrir Chantiers", run: () => api.setTab("chantiers") }]);
    const pdf = await CHS.getFile(CHS.pdfKey(ch)).catch(() => null);
    if (!pdf) return message("Le fond de ce chantier n'est pas un PDF (c'est une image) : le relevé automatique lit les traits du PDF d'origine. Remplacez le fond par le PDF du plan (Chantiers → Changer le fond).", [{ label: "Ouvrir Chantiers", run: () => api.setTab("chantiers") }]);
    busy = true; show(`<p>Lecture des traits du PDF…</p>`);
    try {
      // pas encore d'échelle : on la déduit des cotes du plan ; sinon on la demande
      auto = await autoScale(api);
      if (!auto.ok) { busy = false; return message("Le logiciel n'a pas réussi à lire assez de cotes sur le plan pour régler l'échelle tout seul. Réglez-la à la main : cliquez les deux bouts d'une cote connue, puis tapez sa longueur.", [{ label: "Régler l'échelle", run: () => api.startCalib() }, { label: "Plus tard", run: () => {} }]); }
      page = await chantierPage(api);
      scale = await chantierScaleCheck(api).catch(() => null);
      compute();
      if (!res.walls.length) return message("Aucun mur trouvé sur cette page. Vérifiez que c'est la bonne page du plan (Chantiers → Changer le fond), ou dessinez les murs à la main.", [{ label: "OK", run: () => {} }]);
      summary();
    } catch (e) {
      message("Lecture du PDF impossible : " + esc(e.message), [{ label: "OK", run: () => {} }]);
    } finally { busy = false; }
  }

  // juste après la mise à l'échelle d'un plan PDF encore vide : proposer le relevé
  document.addEventListener("okteo:calibrated", async () => {
    if (autoScale.busy || busy || api.state.segs.length) return;
    const pdf = await CHS.getFile(CHS.pdfKey(api.ch)).catch(() => null);
    if (pdf) message("Échelle réglée. Voulez-vous relever automatiquement les murs du plan ?", [{ label: "Relever les murs", run: open }, { label: "Plus tard", run: () => {} }]);
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !card.hidden) close(); });

  return { open, close, get result() { return res; } };
}
