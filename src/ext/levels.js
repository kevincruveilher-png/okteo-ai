// Barre des niveaux (RDC, R+1, combles…), à côté du nom du chantier.
// Clic = ouvrir le niveau ; double-clic = renommer ; « ＋ » = ajouter un niveau (avec ou sans les murs extérieurs du
// niveau ouvert) ; « ✕ » sur le niveau ouvert = supprimer (confirmation dans la barre, jamais de fenêtre bloquante).
// Page ↑ / Page ↓ : niveau du dessus / du dessous.
import { esc } from "./util.js";

export function createLevelsBar({ api }) {
  const bar = document.getElementById("levels");
  let mode = null;                  // null | {add:true} | {rename:id} | {del:id}

  function render() {
    const L = api.levels;
    if (mode && mode.add) {
      bar.innerHTML = `<form class="lv-form" id="lv-add">
        <input id="lv-name" value="${L.length === 1 ? "R+1" : "Niveau " + (L.length + 1)}" maxlength="24" aria-label="Nom du niveau" list="lv-names">
        <datalist id="lv-names"><option>R+1</option><option>R+2</option><option>Combles</option><option>Sous-sol</option><option>Étage</option></datalist>
        <label class="ck" title="Recopie les murs épais (extérieurs) du niveau ouvert : il reste à dessiner les cloisons de l'étage"><input type="checkbox" id="lv-walls" checked> murs extérieurs</label>
        <button class="on" type="submit">Ajouter</button><button type="button" id="lv-cancel">Annuler</button></form>`;
      const f = bar.querySelector("#lv-add"), inp = bar.querySelector("#lv-name");
      inp.focus(); inp.select();
      f.onsubmit = (e) => { e.preventDefault(); const n = inp.value.trim(); if (!n) return; mode = null; api.addLevel(n, { withWalls: bar.querySelector("#lv-walls").checked }); render();
        api.setHint(`Niveau « ${n} » ajouté. Pour son plan : page Chantiers → « Ajouter un fond… » (autre page du même PDF : l'échelle du RDC est reprise).`); };
      bar.querySelector("#lv-cancel").onclick = () => { mode = null; render(); };
      return;
    }
    if (mode && mode.rename) {
      const lv = L.find((l) => l.id === mode.rename);
      bar.innerHTML = `<form class="lv-form" id="lv-ren"><input id="lv-name" value="${esc(lv ? lv.name : "")}" maxlength="24" aria-label="Nouveau nom du niveau"><button class="on" type="submit">OK</button><button type="button" id="lv-cancel">Annuler</button></form>`;
      const inp = bar.querySelector("#lv-name"); inp.focus(); inp.select();
      bar.querySelector("#lv-ren").onsubmit = (e) => { e.preventDefault(); api.renameLevel(mode.rename, inp.value); mode = null; render(); };
      bar.querySelector("#lv-cancel").onclick = () => { mode = null; render(); };
      return;
    }
    if (mode && mode.del) {
      const lv = L.find((l) => l.id === mode.del);
      bar.innerHTML = `<span class="lv-ask">Supprimer le niveau « ${esc(lv ? lv.name : "")} » et tout son dessin ?</span><button class="danger" id="lv-yes">Supprimer</button><button id="lv-cancel">Annuler</button>`;
      bar.querySelector("#lv-yes").onclick = () => { const n = lv && lv.name; api.removeLevel(mode.del); mode = null; render(); api.setHint(`Niveau « ${n} » supprimé. Ctrl+Z pour le récupérer.`); };
      bar.querySelector("#lv-cancel").onclick = () => { mode = null; render(); };
      return;
    }
    bar.innerHTML = L.map((l) => `<button role="tab" aria-selected="${l.current}" class="lv ${l.current ? "on" : ""}" data-id="${l.id}" title="Niveau « ${esc(l.name)} »${l.fond ? "" : " (sans plan de fond)"} — double-clic : renommer · Page ↑ / Page ↓ : changer de niveau">${esc(l.name)}</button>`).join("")
      + (L.length > 1 ? `<button class="lv-x" title="Supprimer le niveau ouvert">✕</button>` : "")
      + `<button class="lv-add" title="Ajouter un niveau (R+1, combles, sous-sol…)">＋ Niveau</button>`;
    bar.querySelectorAll(".lv").forEach((b) => {
      b.onclick = () => api.switchLevel(b.dataset.id);
      b.ondblclick = () => { mode = { rename: b.dataset.id }; render(); };
    });
    bar.querySelector(".lv-add").onclick = () => { mode = { add: true }; render(); };
    const x = bar.querySelector(".lv-x"); if (x) x.onclick = () => { mode = { del: api.level.id }; render(); };
  }

  const step = (d) => { const L = api.levels, i = L.findIndex((l) => l.current), j = i + d; if (j >= 0 && j < L.length) api.switchLevel(L[j].id); };
  document.addEventListener("keydown", (e) => {
    if (/input|select|textarea/i.test(e.target.tagName)) return;
    if (e.key === "PageUp") { e.preventDefault(); step(1); } else if (e.key === "PageDown") { e.preventDefault(); step(-1); }
  });
  document.addEventListener("okteo:level", () => { if (!mode) render(); });
  render();
  return { render, add: () => { mode = { add: true }; render(); }, rename: () => { mode = { rename: api.level.id }; render(); }, up: () => step(1), down: () => step(-1) };
}
