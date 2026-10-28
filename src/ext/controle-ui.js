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
  let pos = -1, D = [];   // v64 : doutes du câblage (okteo:doubts), comptés dans le même compteur

  function paint() {
    const L = api.control;
    if (!btn) return;
    if (!L.length && !D.length) {
      btn.className = "ctl";
      btn.innerHTML = `<span class="ic">✓</span>Contrôle`;
      btn.title = "Contrôle du plan : rien à signaler (commandes, lumières, va-et-vient, circuits, boîtes). Toujours actif.";
      return;
    }
    const by = {}, nb = D.filter((d) => d.bloquant).length;
    L.forEach((i) => (by[i.kind] = (by[i.kind] || 0) + 1));
    btn.className = "ctl bad" + (nb ? " blq" : "");
    btn.innerHTML = `<span class="ic">${nb ? "✕" : "⚠"}</span>${L.length + D.length} à vérifier`;
    btn.title = "À vérifier (toujours actif) :\n" + Object.entries(by).map(([k, n]) => `• ${n} × ${api.controlKinds[k] || k}`).join("\n")
      + (D.length ? `${L.length ? "\n" : ""}• ${D.length} doute${D.length > 1 ? "s" : ""} du câblage${nb ? ` dont ${nb} bloquant${nb > 1 ? "s" : ""}` : ""} (règle manquante ou cas non prévu)` : "")
      + "\nCliquez : aller au cas suivant (liste complète : panneau Câblage ; doutes : onglet Étude → Où ça coince).";
  }

  function go(i) {
    const L = api.control, T = L.length + D.length;
    if (!T) { api.setHint("Contrôle : rien à signaler sur ce chantier."); return null; }
    pos = ((i % T) + T) % T;
    if (pos >= L.length) return goDoubt(pos - L.length, T);
    const it = L[pos];
    if (it.lv && api.level.id !== it.lv) api.switchLevel(it.lv);
    const here = it.ids.filter((id) => api.state.app.some((a) => a.id === id));
    if (here.length) { api.select(here); api.zoomTo(here); }
    const byId = new Map(api.allApps().map((a) => [a.id, a])), d = describe(api, it, byId);
    api.setHint(`À vérifier ${pos + 1}/${T} — ${d.who} : ${d.what}${d.lvl && api.levels.length > 1 ? ` [${d.lvl}]` : ""}. Recliquez le compteur pour le suivant.`);
    return it;
  }
  // doute du câblage : on va à sa boîte (circuits affichés) ; sans boîte : onglet Étude
  function goDoubt(j, T) {
    const d = D[j];
    if (!d) return null;
    if (d.x == null) { api.setTab("etude"); api.setHint(`À vérifier ${pos + 1}/${T} — doute ${d.rule || ""} : ${d.text}`); return d; }
    if (api.tab !== "plan") api.setTab("plan");
    if (d.lv && api.level.id !== d.lv) api.switchLevel(d.lv);
    api.showCircuits = true;
    if (d.box) { api.boxSel = d.box; const b = (api.cab.boxes || []).find((x) => x.id === d.box), here = ((b && b.apps) || []).filter((id) => api.state.app.some((a) => a.id === id)); if (here.length) api.zoomTo(here); }
    else if (d.ids && d.ids.length) { api.select(d.ids); api.zoomTo(d.ids); }
    api.setHint(`À vérifier ${pos + 1}/${T} — ${d.bloquant ? "doute bloquant" : "doute"}${d.boxN ? " " + d.boxN : ""} ${d.rule ? "(" + d.rule + ")" : ""} : ${d.text}. Recliquez le compteur pour le suivant ; « Pourquoi ? » : onglet Étude.`);
    return d;
  }
  const next = () => go(pos + 1);
  document.addEventListener("okteo:doubts", (e) => { D = e.detail || []; paint(); });

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
