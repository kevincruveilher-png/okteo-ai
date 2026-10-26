// Contrôle permanent (v43) : compteur « ⚠ n à vérifier » dans le bandeau du haut, toujours actif.
// - le cœur recalcule les anomalies à chaque dessin (okteo.control) et prévient par okteo:control ;
// - un clic sur le compteur va au cas suivant (change de niveau si besoin, sélectionne, zoome, explique) ;
// - la liste complète est dans le panneau Câblage (controlSection) ; halos orange animés sur le plan (Paramètres →
//   Affichage pour les masquer).
import { esc } from "./util.js";

const WHAT = {
  cmd: "commande sans lumière : reliez-la à sa lumière (outil Liaison)",
  lum: "lumière sans commande : reliez-la à son interrupteur (outil Liaison)",
  vv: "va-et-vient seul : il faut un 2e va-et-vient sur la même lumière",
  int2: "deux commandes dont un interrupteur simple sur la même lumière : ça ne peut pas marcher, mettez des va-et-vient",
  nobox: "appareil raccordé à rien : il n'est dans aucune boîte (panneau Câblage → placer les boîtes, ou tirer une gaine)",
  circ: "appareil sans circuit : panneau Câblage → répartir, ou l'ajouter à un circuit",
  split: "allumage coupé : la commande et sa lumière sont dans deux boîtes (panneau Câblage → regrouper)",
};

// libellé d'une anomalie : repères des appareils, pièce, niveau
export function describe(api, it, byId) {
  const names = it.ids.map((id) => { const a = byId.get(id); return a ? (a.rep || a.t) + (a.room ? ` (${a.room})` : "") : id; });
  const lvl = byId.get(it.ids[0])?.lvName;
  return { title: api.controlKinds[it.kind] || it.kind, who: names.join(" → ") + (it.boxes ? ` · ${it.boxes.join(" / ")}` : ""), lvl, what: WHAT[it.kind] || "" };
}

export function createControl({ api }) {
  const btn = document.getElementById("ctl");
  let pos = -1;

  function paint() {
    const L = api.control;
    if (!btn) return;
    if (!L.length) {
      btn.className = "ctl";
      btn.innerHTML = `<span class="ic">✓</span>Contrôle`;
      btn.title = "Contrôle du plan : rien à signaler (commandes, lumières, va-et-vient, circuits, boîtes). Toujours actif.";
      return;
    }
    const by = {};
    L.forEach((i) => (by[i.kind] = (by[i.kind] || 0) + 1));
    btn.className = "ctl bad";
    btn.innerHTML = `<span class="ic">⚠</span>${L.length} à vérifier`;
    btn.title = "Contrôle du plan (toujours actif) :\n" + Object.entries(by).map(([k, n]) => `• ${n} × ${api.controlKinds[k] || k}`).join("\n") + "\nCliquez : aller au cas suivant (la liste complète est dans le panneau Câblage).";
  }

  function go(i) {
    const L = api.control;
    if (!L.length) { api.setHint("Contrôle : rien à signaler sur ce chantier."); return null; }
    pos = ((i % L.length) + L.length) % L.length;
    const it = L[pos];
    if (it.lv && api.level.id !== it.lv) api.switchLevel(it.lv);
    const here = it.ids.filter((id) => api.state.app.some((a) => a.id === id));
    if (here.length) { api.select(here); api.zoomTo(here); }
    const byId = new Map(api.allApps().map((a) => [a.id, a])), d = describe(api, it, byId);
    api.setHint(`Contrôle ${pos + 1}/${L.length} — ${d.who} : ${d.what}${d.lvl && api.levels.length > 1 ? ` [${d.lvl}]` : ""}. Recliquez le compteur pour le suivant.`);
    return it;
  }
  const next = () => go(pos + 1);

  if (btn) btn.onclick = next;
  document.addEventListener("okteo:control", () => { paint(); if (pos >= api.control.length) pos = -1; });
  paint();
  return { next, go, paint, get pos() { return pos; } };
}

// section « Contrôle » du panneau Câblage : la liste complète, chaque ligne cliquable
export function controlSection(api) {
  const L = api.control;
  if (!L.length) return `<div class="ctl-sec ok"><b>✓ Contrôle</b> <span class="mut sm">rien à signaler (commandes, lumières, va-et-vient, circuits, boîtes)</span></div>`;
  const byId = new Map(api.allApps().map((a) => [a.id, a]));
  return `<details class="ctl-sec" ${L.length <= 8 ? "open" : ""}><summary><b>⚠ Contrôle : ${L.length} à vérifier</b> <span class="mut sm">cliquez une ligne pour y aller</span></summary>
    <ul class="ctl-list">${L.map((it, i) => { const d = describe(api, it, byId); return `<li data-i="${i}" title="${esc(d.what)}"><span class="k">${esc(d.title)}</span><span>${esc(d.who)}${d.lvl && api.levels.length > 1 ? ` <em>${esc(d.lvl)}</em>` : ""}</span></li>`; }).join("")}</ul></details>`;
}
export function wireControlSection(root, ctl) {
  root.querySelectorAll(".ctl-list li[data-i]").forEach((li) => (li.onclick = () => ctl.go(+li.dataset.i)));
}
