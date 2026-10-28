// Onglet « Tableau » (v46) : le tableau électrique du chantier.
// - coffret au choix (Schneider Electric Resi9 ou Legrand Drivia, 1 à 4 rangées de 13 ou 18 modules), dessiné module
//   par module, marque en tête (v49) ; appareillage modulaire (prise 2P+T, parafoudre, télérupteurs du plan, contacteur
//   heures creuses…) ajouté depuis une liste, déplaçable, supprimable ;
// - placement automatique (NF C 15-100 simplifiée : ID type A pour les spécialisés, ID type AC selon la surface,
//   8 circuits au plus par ID) ; chaque disjoncteur se glisse ailleurs (même rangée ou autre rangée) ;
// - la manette d'un disjoncteur (ou d'un différentiel) coupe / remet le circuit pour le mode essai ;
// - alertes : circuit sans différentiel, spécialisé hors type A, plus de 8 circuits, rangée trop pleine, réserve 20 %.
// Le tableau est enregistré dans le chantier (okteo.cab.tableau, un Ctrl+Z par changement) dès qu'on le modifie.
import { MODELS, BRANDS, MODS, DEFAULT_MODEL, modelOf, autoTableau, syncTableau, tableauIssues, protections, rowMods, moveItem, addBreaker, addModular, removeItem, newId, suggestModel, hasBreaker } from "../cablage/tableau.js";
import { wiringNow } from "./cablage-data.js";
import { esc } from "./util.js";

const KIND = { eclairage: "Éclairage", prises: "Prises", cuisine: "Prises cuisine", specialise: "Spécialisé", comm: "Communication" };

// v66 : contexte des règles du tableau (R-105 pièce du tableau, R-116 nombre de RJ45)
export function tabCtx(api) { const A = api.allApps(), t = A.find((a) => a.t === "TAB"); return { tabRoom: t ? t.room || "" : "", rj45: A.filter((a) => a.t === "RJ45").length }; }

export function mountTableauPage(el, { api }) {
  let drag = null;

  const area = () => { try { return api.allLevelsGeometry().reduce((s, g) => s + g.rooms.reduce((t, r) => t + (r.area || 0), 0), 0) || 100; } catch { return 100; } }; // sans pièces : 35 à 100 m²
  function current() {
    const C = api.cab.circuits || [];
    const saved = api.cab.tableau;
    const T = saved && saved.rows ? syncTableau(saved, C) : { ...autoTableau(C, { model: (saved && saved.model) || DEFAULT_MODEL, area: area() }), missing: [] };
    return { T, C, saved: !!(saved && saved.rows) };
  }
  const save = (T) => api.setCab({ tableau: { model: T.model, rows: T.rows } });

  function render() {
    const { T, C, saved } = current(), M = modelOf(T.model), byN = new Map(C.map((c, i) => [c.n, { c, i }]));
    if (!C.filter(hasBreaker).length) {
      el.innerHTML = `<div class="params-in"><h2>Tableau</h2><p class="mut">Pas encore de circuits. Panneau Câblage (encart Panneaux, en haut) : « Répartir automatiquement », puis revenez ici.</p>
        <button class="on" id="tb-go">Ouvrir le panneau Câblage</button></div>`;
      el.querySelector("#tb-go").onclick = () => { api.setTab("plan"); document.dispatchEvent(new CustomEvent("okteo:open-cablage")); };
      return;
    }
    const off = new Set(api.essai.off), prot = protections(T.rows), issues = tableauIssues(T, C, tabCtx(api)), colors = api.circuitColors || [];
    const nCb = T.rows.flat().filter((x) => x.k === "cb").length, nId = T.rows.flat().filter((x) => x.k === "id").length;
    const used = T.rows.reduce((s, r) => s + rowMods(r), 0), total = M.rows * M.mods, sug = suggestModel(T);
    const idOff = (id) => { const cs = T.rows.flat().filter((x) => x.k === "cb" && prot.get(x.id) === id).map((x) => x.c); return cs.length && cs.every((n) => off.has(n)); };
    const item = (it) => {
      if (it.k === "mod") { const D = MODS[it.t] || { s: it.t, n: it.t }; return `<div class="tb-it tmod m-${esc(it.t)}" draggable="true" data-id="${it.id}" style="--w:${it.w}" title="${esc(D.n)}${it.label ? " " + esc(it.label) : ""} (${String(it.w).replace(".", ",")} module${it.w > 1 ? "s" : ""}). Glisser pour déplacer.">
        <b>${esc(it.label || "")}</b><span class="nm">${esc(D.s)}</span><button class="tb-del" data-del="${it.id}" title="Retirer du tableau">✕</button></div>`; }
      if (it.k === "id") return `<div class="tb-it tid t${it.type}" draggable="true" data-id="${it.id}" style="--w:${it.w}" title="Interrupteur différentiel ${it.a} A 30 mA type ${it.type} : protège les disjoncteurs à sa droite. Glisser pour déplacer.">
        <b>ID</b><span>${it.a} A</span><span class="ty">type ${it.type}</span><button class="lev ${idOff(it) ? "" : "on"}" data-lev="${it.id}" title="Couper / remettre tous ses circuits (mode essai)"></button><span class="ma">30 mA</span></div>`;
      const x = byN.get(it.c), c = x ? x.c : { n: it.c }, col = x ? colors[x.i % colors.length] : "#999";
      return `<div class="tb-it tcb" draggable="true" data-id="${it.id}" data-c="${esc(it.c)}" style="--w:${it.w};--cc:${col}" title="${esc(c.n)} · ${esc(c.name || KIND[c.kind] || "")} · ${it.a} A${c.section ? " · " + String(c.section).replace(".", ",") + " mm²" : ""}. Glisser pour déplacer ; manette = couper / remettre (essai).">
        <b>${esc(c.n)}</b><span>${it.a} A</span><button class="lev ${off.has(c.n) ? "" : "on"}" data-cut="${esc(c.n)}" title="Couper / remettre ${esc(c.n)} (mode essai)"></button><span class="nm">${esc(c.name || KIND[c.kind] || "")}</span></div>`;
    };
    const nRows = Math.max(M.rows, T.rows.length);
    const rows = Array.from({ length: nRows }, (_, r) => {
      const row = T.rows[r] || [], n = rowMods(row), free = Math.max(0, M.mods - n), over = r >= M.rows || n > M.mods;
      return `<div class="tb-row ${over ? "over" : ""}" data-r="${r}"><span class="tb-rn">${r + 1}</span><div class="tb-rail" data-r="${r}" style="--mods:${M.mods}">${row.map(item).join("")}${Array.from({ length: free }, () => `<div class="tb-free" data-r="${r}"></div>`).join("")}</div></div>`;
    }).join("");
    const brandCls = M.brand === "Legrand" ? "lg" : "se";
    const nTL = (() => { try { return wiringNow(api).boxes.reduce((s, b) => s + b.nets.filter((n) => n.fn === "cmdTL").length, 0); } catch { return 0; } })();
    const hasTL = T.rows.flat().filter((x) => x.k === "mod" && x.t === "tl").length;
    el.innerHTML = `<div class="params-in tbpage">
      <h2>Tableau <span class="mut sm">${nId} différentiel${nId > 1 ? "s" : ""} · ${nCb} disjoncteur${nCb > 1 ? "s" : ""} · ${used} / ${total} modules${saved ? "" : " · disposition automatique (enregistrée au premier changement)"}</span></h2>
      <div class="tb-bar">
        <label class="f">Coffret <select id="tb-model" title="Marque et modèle du coffret : rangées × modules">${BRANDS.map((b) => `<optgroup label="${esc(b)}">${MODELS.filter((m) => m.brand === b).map((m) => `<option value="${m.id}" ${m.id === M.id ? "selected" : ""}>${esc(m.name)}</option>`).join("")}</optgroup>`).join("")}</select></label>
        <span class="tb-brand ${brandCls}" title="Marque du coffret">${M.brand === "Legrand" ? "legrand" : "Schneider<small>Electric</small>"}</span>
        <label class="f">Appareillage <select id="tb-mod" title="Ajouter un appareil modulaire au tableau (sur la rangée qui a le plus de place)"><option value="">＋ Appareil modulaire…</option>${Object.entries(MODS).map(([k, D]) => `<option value="${k}">${esc(D.n)} — ${String(D.w).replace(".", ",")} mod.</option>`).join("")}</select></label>
        ${nTL > hasTL ? `<button id="tb-tl" title="Un télérupteur par allumage à télérupteur du plan (T1, T2…)">＋ Télérupteurs du plan (${nTL - hasTL})</button>` : ""}
        ${sug.id !== M.id && (T.rows.length > M.rows || used > total) ? `<button id="tb-sug" title="Le plus petit coffret qui contient le tableau avec 20 % de réserve">→ ${esc(sug.name)}</button>` : ""}
        <button id="tb-auto" title="Refaire la disposition : ID type A pour les spécialisés, ID type AC selon la surface, 8 circuits au plus par ID (un seul Ctrl+Z)">Placer automatiquement</button>
        <button id="tb-addid" title="Ajouter un interrupteur différentiel sur une nouvelle rangée">＋ Différentiel</button>
        <button id="tb-essai" title="Revenir au plan en mode essai : les disjoncteurs coupés ici éteignent leurs lumières">💡 Essai sur le plan</button>
      </div>
      ${issues.length ? `<div class="warnbox">${issues.map((x) => `<p class="warn sm">⚠ ${esc(x)}</p>`).join("")}</div>` : `<p class="ok sm">✓ Conforme aux règles vérifiées (différentiels, type A, 8 circuits par ID, réserve de 20 %).</p>`}
      ${T.missing.length ? `<div class="tb-miss"><b>Circuits pas encore au tableau :</b> ${T.missing.map((c) => `<button data-add="${esc(c.n)}" title="L'ajouter sous un différentiel du bon type">＋ ${esc(c.n)} ${esc(c.name || KIND[c.kind] || "")}</button>`).join(" ")}</div>` : ""}
      <div class="tb-box ${brandCls}" style="--mods:${M.mods}"><div class="tb-cap"><span class="tb-brand ${brandCls}">${M.brand === "Legrand" ? "legrand" : "Schneider<small>Electric</small>"}</span><span class="mut sm">${esc(M.range)} · ${M.rows} × ${M.mods} modules</span></div>${rows}</div>
      <p class="mut sm">Glissez un disjoncteur ou un différentiel pour le déplacer (sur un autre appareil = juste avant lui, sur une place libre = en fin de rangée). Un différentiel protège les disjoncteurs à sa droite. La manette coupe ou remet le circuit pour le mode essai.</p>
    </div>`;
    wire(T);
  }

  function wire(T) {
    const $ = (s) => el.querySelector(s);
    $("#tb-model").onchange = (e) => save({ ...T, model: e.target.value });
    const sg = $("#tb-sug"); if (sg) sg.onclick = () => save({ ...T, model: suggestModel(T).id });
    $("#tb-auto").onclick = () => { save(autoTableau(api.cab.circuits || [], { model: T.model, area: area() })); api.setHint("Tableau disposé automatiquement. Ctrl+Z pour revenir."); };
    $("#tb-addid").onclick = () => save({ ...T, rows: newId(T.rows, "AC") });
    $("#tb-mod").onchange = (e) => { const t = e.target.value; if (!t) return; save({ ...T, rows: addModular(T.rows, t, modelOf(T.model).mods) }); api.setHint(`${MODS[t].n} ajouté au tableau : glissez-le où vous voulez. Ctrl+Z pour annuler.`); };
    const tlb = $("#tb-tl");
    if (tlb) tlb.onclick = () => {
      let R = T.rows, k = R.flat().filter((x) => x.k === "mod" && x.t === "tl").length;
      const n = wiringNow(api).boxes.reduce((s, b) => s + b.nets.filter((x) => x.fn === "cmdTL").length, 0);
      while (k < n) R = addModular(R, "tl", modelOf(T.model).mods, "T" + ++k);
      save({ ...T, rows: R }); api.setHint(`Télérupteurs T1 à T${n} au tableau.`);
    };
    el.querySelectorAll("[data-del]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); save({ ...T, rows: removeItem(T.rows, b.dataset.del) }); }));
    $("#tb-essai").onclick = () => { api.setTab("plan"); api.setEssai(true); };
    el.querySelectorAll("[data-add]").forEach((b) => (b.onclick = () => { const c = (api.cab.circuits || []).find((x) => x.n === b.dataset.add); if (c) save({ ...T, rows: addBreaker(T.rows, c) }); }));
    el.querySelectorAll("[data-cut]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); const n = b.dataset.cut, on = api.essai.off.includes(n); api.essai.breaker(n, on); api.setHint(`Disjoncteur ${n} ${on ? "remis" : "coupé"} (mode essai).`); render(); }));
    el.querySelectorAll("[data-lev]").forEach((b) => (b.onclick = (e) => {
      e.stopPropagation();
      const prot = protections(T.rows), id = T.rows.flat().find((x) => x.id === b.dataset.lev);
      const cs = T.rows.flat().filter((x) => x.k === "cb" && prot.get(x.id) === id).map((x) => x.c), allOff = cs.length && cs.every((n) => api.essai.off.includes(n));
      cs.forEach((n) => api.essai.breaker(n, allOff));
      api.setHint(`Différentiel ${allOff ? "remis" : "coupé"} : ${cs.join(", ") || "aucun circuit"}.`);
      render();
    }));
    // glisser-déposer
    el.querySelectorAll(".tb-it").forEach((it) => {
      it.ondragstart = (e) => { drag = it.dataset.id; it.classList.add("drag"); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", drag); };
      it.ondragend = () => { drag = null; el.querySelectorAll(".drop").forEach((x) => x.classList.remove("drop")); it.classList.remove("drag"); };
    });
    const target = (node) => node.closest(".tb-it, .tb-free, .tb-rail");
    el.querySelectorAll(".tb-rail").forEach((rail) => {
      rail.ondragover = (e) => { e.preventDefault(); el.querySelectorAll(".drop").forEach((x) => x.classList.remove("drop")); target(e.target)?.classList.add("drop"); };
      rail.ondrop = (e) => {
        e.preventDefault();
        const id = drag || e.dataTransfer.getData("text/plain"), t = target(e.target), r = +rail.dataset.r;
        if (!id) return;
        const before = t && t.classList.contains("tb-it") && t.dataset.id !== id ? t.dataset.id : null;
        save({ ...T, rows: moveItem(T.rows, id, r, before) });
        api.setHint("Tableau modifié. Ctrl+Z pour revenir.");
      };
    });
  }

  ["okteo:cab", "okteo:saved", "okteo:essai"].forEach((ev) => document.addEventListener(ev, () => { if (!el.hidden) render(); }));
  render();
  return { render, current };
}
