// « Relever les murs du PDF » : lance le relevé automatique (src/walls/*), montre l'aperçu sur le plan,
// permet d'ajuster l'épaisseur min/max, puis ajoute les murs au dessin (un seul Ctrl+Z pour tout annuler).
import * as CHS from "../chantiers.js";
import { detectWalls } from "../walls/detect.js";
import { chantierPage, pageMap } from "./pdf-page.js";
import { esc } from "./util.js";

export function createWallsTool({ api }) {
  const card = document.createElement("div");
  card.className = "wcard"; card.hidden = true; card.setAttribute("role", "dialog"); card.setAttribute("aria-label", "Relevé des murs");
  document.querySelector(".stage").appendChild(card);
  let page = null, res = null, opts = { tMin: 4, tMax: 45 }, replace = false, busy = false, detectRoomsAfter = true;

  const close = () => { card.hidden = true; api.setPreview(null); res = null; };
  function show(html) { card.innerHTML = `<div class="wcard-h"><b>Relevé des murs</b><button class="wx" title="Fermer">✕</button></div>${html}`; card.hidden = false; card.querySelector(".wx").onclick = close; }

  function message(text, buttons = []) {
    show(`<p>${text}</p><div class="wrow">${buttons.map((b, i) => `<button data-i="${i}" class="${i === 0 ? "on" : ""}">${esc(b.label)}</button>`).join("")}</div>`);
    card.querySelectorAll("[data-i]").forEach((el) => (el.onclick = () => { const b = buttons[+el.dataset.i]; close(); b.run(); }));
  }

  function compute() {
    res = detectWalls(page.segs, pageMap(api, page), { tMin: opts.tMin / 100, tMax: opts.tMax / 100 });
    api.setPreview(res);
  }

  function summary() {
    const by = {};
    res.walls.forEach((w) => { const e = Math.round(w.ep * 100); by[e] = (by[e] || 0) + 1; });
    const ep = Object.entries(by).sort((a, b) => +a[0] - +b[0]).map(([e, n]) => `${n} × ${e} cm`).join(" · ");
    const nP = res.openings.filter((o) => o.kind === "porte").length, nF = res.openings.length - nP;
    const existing = api.state.segs.length;
    show(`
      <p class="wbig"><b>${res.walls.length}</b> murs · <b>${res.openings.length}</b> ouvertures <span class="mut">(${nP} portes, ${nF} fenêtres, à confirmer)</span></p>
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
    const pdf = await CHS.getFile("pdf:" + ch.id).catch(() => null);
    if (!pdf) return message("Le fond de ce chantier n'est pas un PDF (c'est une image) : le relevé automatique lit les traits du PDF d'origine. Remplacez le fond par le PDF du plan (Chantiers → Changer le fond).", [{ label: "Ouvrir Chantiers", run: () => api.setTab("chantiers") }]);
    if (!ch.fond.calibre) return message("Réglez d'abord l'échelle du fond : les murs seront relevés à la bonne dimension.", [{ label: "Régler l'échelle", run: () => api.startCalib() }]);
    busy = true; show(`<p>Lecture des traits du PDF…</p>`);
    try {
      page = await chantierPage(api);
      compute();
      if (!res.walls.length) return message("Aucun mur trouvé sur cette page. Vérifiez que c'est la bonne page du plan (Chantiers → Changer le fond), ou dessinez les murs à la main.", [{ label: "OK", run: () => {} }]);
      summary();
    } catch (e) {
      message("Lecture du PDF impossible : " + esc(e.message), [{ label: "OK", run: () => {} }]);
    } finally { busy = false; }
  }

  // juste après la mise à l'échelle d'un plan PDF encore vide : proposer le relevé
  document.addEventListener("okteo:calibrated", async () => {
    if (api.state.segs.length) return;
    const pdf = await CHS.getFile("pdf:" + api.ch.id).catch(() => null);
    if (pdf) message("Échelle réglée. Voulez-vous relever automatiquement les murs du plan ?", [{ label: "Relever les murs", run: open }, { label: "Plus tard", run: () => {} }]);
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !card.hidden) close(); });

  return { open, close, get result() { return res; } };
}
