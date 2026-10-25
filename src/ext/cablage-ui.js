// Onglet « Câblage » du panneau de droite (v28) : les circuits du chantier.
// - « Répartir automatiquement » (NF C 15-100, réglages dans Paramètres → Câblage) ;
// - chaque circuit : couleur (la même sur le plan), nombre de points / prises, section, protection, nom ;
//   « Voir » sélectionne ses appareils du niveau ouvert ; « ← Sélection » y met les appareils sélectionnés sur le plan ;
// - alertes : circuit trop chargé, appareil sans circuit.
// Tout passe par okteo.setCircuits (un Ctrl+Z par changement).
import { computeCircuits, checkCircuits } from "../cablage/circuits.js";
import { getCab, SECTIONS, PROTS } from "../cablage/settings.js";
import { esc } from "./util.js";

const KIND = { eclairage: "Éclairage", prises: "Prises", specialise: "Spécialisé", comm: "Communication" };
const LIGHT = new Set(["LUM", "SPOT", "APP"]);

export function createCablagePane({ api, panel }) {
  const el = panel.register({ id: "cablage", label: "Câblage", icon: "⚡" });
  let ask = null, renaming = null;
  const fr = (v) => String(v).replace(".", ",");

  function data() {
    const S = getCab(), items = api.allApps(), C = api.cab.circuits || [];
    return { S, items, C, chk: checkCircuits(C, items, S), byId: new Map(items.map((a) => [a.id, a])) };
  }
  function auto() {
    const { S, items } = data();
    api.setCircuits(computeCircuits(items, api.allLinks(), S));
    api.setHint(`Circuits répartis automatiquement (NF C 15-100). Les couleurs sur le plan montrent le circuit de chaque appareil. Ctrl+Z pour annuler.`);
  }
  const selectedApps = () => api.selection.filter((k) => k.startsWith("app:")).map((k) => k.slice(4));
  // met des appareils dans un circuit (et les retire de leur ancien circuit)
  function moveInto(cid, ids) {
    if (!ids.length) { api.setHint("Sélectionnez d'abord des appareils sur le plan (clic, Maj+clic ou cadre), puis « ← Sélection »."); return; }
    const C = api.cab.circuits.map((c) => ({ ...c, apps: c.apps.filter((id) => !ids.includes(id)) }));
    const t = C.find((c) => c.id === cid); t.apps.push(...ids);
    api.setCircuits(C.filter((c) => c.apps.length || c.id === cid));
  }
  function patch(cid, p) { api.setCircuits(api.cab.circuits.map((c) => (c.id === cid ? { ...c, ...p } : c))); }
  function renumber(C) { let n = 0; return C.map((c) => ({ ...c, n: c.kind === "comm" ? "COM" : "C" + (++n) })); }

  function render() {
    if (el.hidden) return;
    const { S, C, chk, byId } = data(), colors = api.circuitColors;
    const head = `<div class="cab-h"><b>Circuits</b> <span class="mut sm">NF C 15-100 · max ${S.maxPoints} points / ${S.maxPrises} prises</span></div>
      <label class="ck sm"><input type="checkbox" id="cb-show" ${api.showCircuits ? "checked" : ""}> Couleurs des circuits sur le plan</label>`;
    if (!C.length) {
      el.innerHTML = `<div class="cab">${head}<p class="mut">Aucun circuit pour l'instant. Oktéo peut répartir tous les appareils du chantier (tous niveaux) en circuits : éclairage par allumage, prises voisines ensemble, un circuit par prise spécialisée, RJ45 en lignes directes.</p>
        <button class="on" id="cb-auto" ${api.allApps().length ? "" : "disabled title=\"Posez d'abord des appareils\""}>Répartir automatiquement</button>
        <p class="mut sm">Réglages (limites, sections, protections, couleurs des fils) : Paramètres → Câblage.</p></div>`;
      wire(); return;
    }
    const rows = C.map((c, i) => {
      const lights = c.apps.filter((id) => byId.get(id) && LIGHT.has(byId.get(id).t)).length, pr = c.apps.filter((id) => byId.get(id) && byId.get(id).t === "PC16").length;
      const count = c.kind === "eclairage" ? `${lights} pt${lights > 1 ? "s" : ""} / ${S.maxPoints}` : c.kind === "prises" ? `${pr} / ${S.maxPrises}` : `${c.apps.length} app.`;
      const over = chk.issues.some((x) => x.c === c.id);
      const lvls = [...new Set(c.apps.map((id) => byId.get(id)?.lvName).filter(Boolean))].join(", ");
      return `<div class="cb-row${over ? " over" : ""}" data-c="${c.id}">
        <span class="cb-dot" style="background:${colors[i % colors.length]}"></span>
        <div class="cb-main">
          ${renaming === c.id ? `<form class="cb-ren"><input value="${esc(c.label)}" maxlength="60" aria-label="Nom du circuit"><button class="on">OK</button></form>`
            : `<div><b>${esc(c.n)}</b> <span class="cb-lbl" title="Double-clic : renommer">${esc(c.label)}</span>${c.direct ? ` <span class="pill" title="Ligne directe : du tableau (ou du coffret de communication) jusqu'à l'appareil, sans boîte">ligne directe</span>` : ""}</div>`}
          <div class="mut sm">${KIND[c.kind] || c.kind} · ${count}${lvls ? " · " + esc(lvls) : ""}</div>
          ${c.kind !== "comm" ? `<div class="cb-ctl">
            <select data-f="section" title="Section des fils">${SECTIONS.map((x) => `<option value="${x}" ${x === c.section ? "selected" : ""}>${fr(x)} mm²</option>`).join("")}</select>
            <select data-f="prot" title="Protection au tableau">${PROTS.map((x) => `<option value="${x}" ${x === c.prot ? "selected" : ""}>${x} A</option>`).join("")}</select></div>` : ""}
          <div class="cb-ctl"><button data-a="see" title="Sélectionner ses appareils sur le plan (niveau ouvert)">Voir</button>
            <button data-a="take" title="Mettre dans ce circuit les appareils sélectionnés sur le plan">← Sélection</button>
            <button data-a="del" title="Supprimer le circuit (ses appareils n'ont plus de circuit)">✕</button></div>
        </div></div>`;
    }).join("");
    const orphans = chk.orphans.length ? `<p class="warn sm">⚠ ${chk.orphans.length} appareil${chk.orphans.length > 1 ? "s" : ""} sans circuit (anneau rouge pointillé sur le plan). <button id="cb-orph">Les sélectionner</button></p>` : "";
    const issues = chk.issues.map((x) => `<p class="warn sm">⚠ ${esc(x.msg)}</p>`).join("");
    el.innerHTML = `<div class="cab">${head}${orphans}${issues}
      <div class="cb-list">${rows}</div>
      <div class="cb-foot">
        <select id="cb-kind">${Object.entries(KIND).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
        <button id="cb-new" title="Nouveau circuit (avec les appareils sélectionnés sur le plan, s'il y en a)">＋ Circuit</button>
        ${ask === "auto" ? `<span class="cb-ask">Remplacer les ${C.length} circuits ? <button class="danger" id="cb-yes">Remplacer</button><button id="cb-no">Annuler</button></span>`
          : `<button id="cb-auto" title="Refaire toute la répartition (Ctrl+Z pour revenir)">Répartir automatiquement</button>`}
      </div>
      <p class="mut sm">Couleur = circuit. Réglages : Paramètres → Câblage. Boîtes et gaines : prochaine étape.</p></div>`;
    wire();
  }

  function wire() {
    const $ = (s) => el.querySelector(s);
    const sh = $("#cb-show"); if (sh) sh.onchange = () => { api.showCircuits = sh.checked; };
    const au = $("#cb-auto"); if (au) au.onclick = () => { if (api.cab.circuits.length) { ask = "auto"; render(); } else auto(); };
    const y = $("#cb-yes"); if (y) y.onclick = () => { ask = null; auto(); };
    const n = $("#cb-no"); if (n) n.onclick = () => { ask = null; render(); };
    const o = $("#cb-orph"); if (o) o.onclick = () => { const { chk } = data(); api.select(chk.orphans); };
    const nw = $("#cb-new"); if (nw) nw.onclick = () => {
      const kind = $("#cb-kind").value, S = getCab(), ids = selectedApps();
      const sec = { eclairage: [S.secEclairage, S.protEclairage], prises: [S.secPrises, S.protPrises], specialise: [S.secSpecialise, S.protSpecialise], comm: [null, null] }[kind];
      let C = api.cab.circuits.map((c) => ({ ...c, apps: c.apps.filter((id) => !ids.includes(id)) })).filter((c) => c.apps.length);
      C.push({ id: "c" + Date.now().toString(36), kind, label: `${KIND[kind]} (nouveau)`, apps: ids, section: sec[0], prot: sec[1], direct: kind === "specialise" || kind === "comm" });
      api.setCircuits(renumber(C));
    };
    el.querySelectorAll(".cb-row").forEach((r) => {
      const cid = r.dataset.c;
      r.querySelectorAll("select[data-f]").forEach((s) => (s.onchange = () => patch(cid, { [s.dataset.f]: parseFloat(s.value) })));
      r.querySelector('[data-a="see"]').onclick = () => { const c = api.cab.circuits.find((x) => x.id === cid); const k = api.select(c.apps); if (k) api.zoomTo(c.apps); else api.setHint("Ce circuit n'a pas d'appareil sur le niveau ouvert (Page ↑ / Page ↓)."); };
      r.querySelector('[data-a="take"]').onclick = () => moveInto(cid, selectedApps());
      r.querySelector('[data-a="del"]').onclick = () => api.setCircuits(renumber(api.cab.circuits.filter((c) => c.id !== cid)));
      const lb = r.querySelector(".cb-lbl"); if (lb) lb.ondblclick = () => { renaming = cid; render(); r.querySelector(".cb-ren input")?.focus(); };
      const f = r.querySelector(".cb-ren"); if (f) { const inp = f.querySelector("input"); inp.focus(); inp.select(); f.onsubmit = (e) => { e.preventDefault(); renaming = null; if (inp.value.trim()) patch(cid, { label: inp.value.trim() }); else render(); }; }
    });
  }

  let t = null;
  const later = () => { clearTimeout(t); t = setTimeout(render, 80); };
  ["okteo:cab", "okteo:saved", "okteo:level", "okteo:cab-settings"].forEach((e) => document.addEventListener(e, later));
  // les couleurs des circuits s'affichent quand l'onglet Câblage est ouvert (et restent tant qu'on ne les décoche pas)
  panel.onChange((s) => { if (s.pane === "cablage" && !s.collapsed) { if (!api.showCircuits && !el.__shown) { el.__shown = true; api.showCircuits = true; } later(); } });
  render();
  return { render, auto, el };
}
