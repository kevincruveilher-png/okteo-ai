// Onglet « Câblage » du panneau de droite (v28) : les circuits du chantier.
// - « Répartir automatiquement » (NF C 15-100, réglages dans Paramètres → Câblage) ;
// - chaque circuit : couleur (la même sur le plan), nombre de points / prises, section, protection, nom ;
//   « Voir » sélectionne ses appareils du niveau ouvert ; « ← Sélection » y met les appareils sélectionnés sur le plan ;
// - alertes : circuit trop chargé, appareil sans circuit.
// Tout passe par okteo.setCircuits (un Ctrl+Z par changement).
import { computeCircuits, checkCircuits, circuitsByBox } from "../cablage/circuits.js";
import { getCab, SECTIONS, PROTS } from "../cablage/settings.js";
import { esc } from "./util.js";
import { wiringNow, autoBoxes, removeBoxPlan, fr, cabS } from "./cablage-data.js";
import { buildUnits, MODES } from "../cablage/boites.js";
import { createCompare } from "./pieuvre-compare.js";
import { controlSection, wireControlSection } from "./controle-ui.js";
import { hpSection, wireHpSection, hpOpen } from "./horsplan-ui.js";

const KIND = { eclairage: "Éclairage", prises: "Prises", cuisine: "Prises cuisine", specialise: "Spécialisé", comm: "Communication" };
const LIGHT = new Set(["LUM", "SPOT", "APP"]);

export function createCablagePane({ api, panel, ctl }) {
  const el = panel.register({ id: "cablage", label: "Câblage", icon: "⚡", tip: "Circuits, boîtes et gaines : répartition, placement, réglages" });
  let ask = null, renaming = null, askBox = false;
  const fr = (v) => String(v).replace(".", ",");

  function data() {
    const S = cabS(api), items = api.allApps(), C = api.cab.circuits || [];
    return { S, items, C, chk: checkCircuits(C, items, S), byId: new Map(items.map((a) => [a.id, a])) };
  }
  function auto() {
    const { S, items } = data(), B = api.cab.boxes || [];
    if (B.length && S.circuitsParBoite) {
      api.setCircuits(circuitsByBox(items, api.allLinks(), B, S));
      api.setHint(`Circuits répartis par boîte (règles KiTéOHM) : dans chaque boîte un circuit éclairage, un circuit prises, un circuit cuisine s'il y en a. Ctrl+Z pour annuler.`);
      return;
    }
    api.setCircuits(computeCircuits(items, api.allLinks(), S));
    api.setHint(`Circuits répartis automatiquement (NF C 15-100). Les couleurs sur le plan montrent le circuit de chaque appareil. Ctrl+Z pour annuler.`);
  }
  // boîtes modifiées : les circuits suivent les boîtes (réglage « Les circuits suivent les boîtes ») — un seul Ctrl+Z
  // comparatif des modes de pieuvre : appliquer un mode = ses boîtes et ses circuits, en un seul Ctrl+Z
  const compare = createCompare({ api, apply: (r) => {
    api.setCab({ mode: r.mode, boxes: r.boxes, circuits: getCab().circuitsParBoite ? r.circuits : api.cab.circuits });
    api.showCircuits = true;
    api.setHint(`Pieuvre « ${r.name} » appliquée : ${r.m.boites} boîtes, ${r.m.circuits} circuits, ${Math.round(r.m.cuivre)} m de fil. Ctrl+Z pour revenir.`);
    render();
  } });
  document.addEventListener("okteo:compare-modes", () => compare.open());
  function commitBoxes(boxes) {
    const S = cabS(api);
    if (S.circuitsParBoite && (api.cab.circuits || []).length) api.setCab({ boxes, circuits: circuitsByBox(api.allApps(), api.allLinks(), boxes, S) });
    else api.setBoxes(boxes);
  }
  // allumage complet : appareils d'un circuit à boîte reliés (commande ↔ lumières) à ceux de la liste
  function withAllumage(ids) {
    const out = new Set(ids), units = buildUnits(api.allApps(), api.allLinks(), api.cab.circuits || []);
    for (let grew = true; grew;) { grew = false; for (const u of units) if (u.ids.some((k) => out.has(k))) u.ids.forEach((k) => { if (!out.has(k)) { out.add(k); grew = true; } }); }
    return out;
  }
  // allumages coupés entre deux boîtes : tout l'allumage va dans la boîte qui a le plus de ses lumières
  function fixSplits() {
    const B = (api.cab.boxes || []).map((b) => ({ ...b, apps: [...b.apps] })), items = api.allApps(), by = new Map(items.map((a) => [a.id, a]));
    const units = buildUnits(items, api.allLinks(), api.cab.circuits || []), boxOf = (id) => B.find((b) => b.apps.includes(id));
    let n = 0;
    for (const u of units) {
      const bs = new Set(u.ids.map((id) => boxOf(id)).filter(Boolean).map((b) => b.id));
      if (bs.size < 2) continue;
      const score = (bid) => u.ids.filter((id) => boxOf(id)?.id === bid && ["LUM", "SPOT", "APP"].includes(by.get(id)?.t)).length * 10 + u.ids.filter((id) => boxOf(id)?.id === bid).length;
      const target = [...bs].sort((p, q) => score(q) - score(p))[0];
      B.forEach((b) => { if (b.id !== target) b.apps = b.apps.filter((id) => !u.ids.includes(id)); });
      const T = B.find((b) => b.id === target); u.ids.forEach((id) => { if (!T.apps.includes(id)) T.apps.push(id); });
      n++;
    }
    if (!n) { api.setHint("Aucun allumage coupé entre deux boîtes."); return; }
    commitBoxes(B);
    api.setHint(`${n} allumage${n > 1 ? "s" : ""} ramené${n > 1 ? "s" : ""} dans une seule boîte (avec ses commandes). Ctrl+Z pour annuler.`);
  }
  document.addEventListener("okteo:fix-splits", fixSplits);
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
    // une saisie en cours (nombre de boîtes, boîtes cochées) survit à un nouvel affichage (enregistrement automatique…)
    const keepCount = el.querySelector("#bx-count")?.value, keepRedo = new Map([...el.querySelectorAll(".bx-redo")].map((c) => [c.value, c.checked]));
    const { S, C, chk, byId } = data(), colors = api.circuitColors;
    const head = `<div class="cab-h"><b>Circuits</b> <span class="mut sm">NF C 15-100 · max ${S.maxPoints} points / ${S.maxPrises} prises</span></div>
      <label class="ck sm"><input type="checkbox" id="cb-show" ${api.showCircuits ? "checked" : ""}> Couleurs des circuits sur le plan</label>`;
    if (!C.length) {
      el.innerHTML = `<div class="cab">${controlSection(api)}${hpSection(api, hpOpen)}${head}<p class="mut">Aucun circuit pour l'instant. Oktéo peut répartir tous les appareils du chantier (tous niveaux) en circuits : éclairage par allumage, prises voisines ensemble, un circuit par prise spécialisée, RJ45 en lignes directes.</p>
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
    el.innerHTML = `<div class="cab">${controlSection(api)}${hpSection(api, hpOpen)}${head}${orphans}${issues}
      <div class="cb-list">${rows}</div>
      <div class="cb-foot">
        <select id="cb-kind">${Object.entries(KIND).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
        <button id="cb-new" title="Nouveau circuit (avec les appareils sélectionnés sur le plan, s'il y en a)">＋ Circuit</button>
        ${ask === "auto" ? `<span class="cb-ask">Remplacer les ${C.length} circuits ? <button class="danger" id="cb-yes">Remplacer</button><button id="cb-no">Annuler</button></span>`
          : `<button id="cb-auto" title="Refaire toute la répartition (Ctrl+Z pour revenir)">Répartir automatiquement</button>`}
      </div>
      <p class="mut sm">Couleur = circuit. Réglages : Paramètres → Câblage.</p>
      ${boxesHTML()}</div>`;
    if (keepCount) { const i = el.querySelector("#bx-count"); if (i) i.value = keepCount; }
    el.querySelectorAll(".bx-redo").forEach((c) => { if (keepRedo.has(c.value)) c.checked = keepRedo.get(c.value); });
    wire();
  }

  // v56 (R-096) : commande des volets = choix du BE pour le chantier (le plan ne le dit pas) ; affiché s'il y a des volets
  function voletsHTML() {
    if (!api.allApps().some((a) => a.t === "VR" || a.t === "VEL" || a.t === "CVR")) return "";
    const v = (api.cab.choix || {}).commandeVolet || "";
    return `<div class="bx-mode"><label title="Choix du bureau d'études pour ce chantier (règle R-096). Connectée : les commandes de volet du plan ne sont pas câblées, chaque moteur reçoit gris + bleu clair + vert/jaune.">Volets : <select id="bx-cvol">
      <option value=""${!v ? " selected" : ""}>commande à choisir (câblés en filaire)</option><option value="filaire"${v === "filaire" ? " selected" : ""}>commande filaire (CVR câblées)</option><option value="connecte"${v === "connecte" ? " selected" : ""}>connectés (moteurs seuls)</option></select></label></div>`;
  }
  // ---------- boîtes ----------
  function boxesHTML() {
    const B = api.cab.boxes || [], hasTab = api.allApps().some((a) => a.t === "TAB");
    const mode = api.cab.mode || "proximite";
    const head = `<div class="cab-h" style="margin-top:14px"><b>Boîtes</b> <span class="mut sm">max ${getCab().departsMax} départs sans l'alimentation, ${getCab().departsFace} gaines par face (A haut, B droite, C bas, D gauche)</span></div>
      <div class="bx-mode"><label title="Comment les boîtes sont constituées au prochain placement automatique">Pieuvre : <select id="bx-mode">${Object.entries(MODES).map(([k, v]) => `<option value="${k}" ${k === mode ? "selected" : ""}>${v}</option>`).join("")}</select></label>
        <button id="bx-cmp" title="Calcule les trois modes (économique, équilibrée, par pièce) et les compare : note « belle pieuvre », mini-plans, fil, gaine, boîtes, départs. Puis « Appliquer ».">Comparer les 3 modes</button></div>${voletsHTML()}`;
    const tabWarn = hasTab ? "" : `<p class="warn sm">⚠ Pas de tableau sur le plan : les boîtes sont placées sans tenir compte de leur alimentation et les longueurs vers le tableau manquent. <button id="bx-tab">Poser le tableau</button></p>`;
    if (!B.length) return `${head}${tabWarn}<p class="mut sm">Oktéo place les boîtes selon le mode choisi — économique (le moins de cuivre), équilibrée (le moins de boîtes, comme le BE) ou par pièce —, une commande et ses lumières toujours dans la même boîte ; vous pouvez ensuite les déplacer à la souris.</p>
      <button class="on" id="bx-auto">Placer les boîtes automatiquement</button>`;
    const W = wiringNow(api), lvName = new Map(api.levels.map((l) => [l.id, l.name]));
    const rows = W.boxes.map((b) => {
      const f = ["A", "B", "C", "D"].map((x) => `${x}${b.gaines.filter((g) => g.face === x).length}`).join(" ");
      const nApp = b.gaines.filter((g) => g.kind === "app").length;
      const over = nApp > getCab().departsMax || ["A", "B", "C", "D"].some((x) => b.gaines.filter((g) => g.face === x).length > getCab().departsFace);
      const src = B.find((x) => x.id === b.id) || {}, nR = Object.keys(src.routes || {}).length;
      return `<div class="cb-row bx-row${over ? " over" : ""}${api.boxSel === b.id ? " sel" : ""}" data-b="${b.id}"><button class="bx-lock${src.locked ? " on" : ""}" data-a="lock" title="${src.locked ? "Verrouillée : ne bouge pas quand on recalcule les boîtes. Clic pour déverrouiller." : "Clic pour verrouiller : la boîte ne bougera plus quand on recalcule les boîtes."}">${src.locked ? "🔒" : "🔓"}</button><div class="cb-main">
        <div><b>${esc(b.n)}</b> <span class="mut sm">${esc(lvName.get(b.lv) || b.lv)} · ${nApp} / ${getCab().departsMax} départs + alimentation · ${String(b.longueur ?? "").replace(".", ",")} m de gaines · ${f}</span></div>
        <div class="mut sm">circuits ${esc(b.circuits.join(", "))} · ${fr(b.cuivre)} m de fil${src.manual ? " · déplacée à la main" : ""}${nR ? ` · ${nR} gaine${nR > 1 ? "s" : ""} tracée${nR > 1 ? "s" : ""} à la main` : ""}</div>
        <div class="cb-ctl"><button data-a="see" title="Montrer la boîte sur le plan">Voir</button><button data-a="take" title="Raccorder à cette boîte les appareils sélectionnés sur le plan">← Sélection</button><button data-a="list" title="Ses gaines et ses fils (onglet Boîtes)">Gaines</button><button data-a="del" title="Supprimer la boîte : ses appareils vont dans la boîte la plus proche (Ctrl+Z pour annuler). Sur le plan : cliquer la boîte puis Suppr.">🗑</button>${nR ? `<button data-a="straight" title="Supprimer les points de passage : toutes les gaines de cette boîte reprennent la ligne droite">Remettre en ligne droite</button>` : ""}</div></div></div>`;
    }).join("");
    const issues = W.issues.filter((x) => !/^Pas de tableau/.test(x)).map((x) => `<p class="warn sm">⚠ ${esc(x)}</p>`).join("")
      + (W.splits && W.splits.length ? `<p><button id="cb-fixsplit" title="Chaque allumage coupé va entier (commandes + lumières) dans la boîte qui a le plus de ses lumières. Ctrl+Z pour annuler.">Ramener dans la même boîte (${W.splits.length})</button></p>` : "");
    // v59 : croisements de gaines qui restent sur le plan (le tracé les évite tant que c'est possible)
    const X = api.gaineCrossings ? api.gaineCrossings() : { n: 0 };
    const cross = `<p class="sm ${X.n ? "warn" : "mut"}" id="bx-cross" title="Les points d'accroche et la courbure des gaines sont choisis pour qu'elles ne se croisent pas ; ils sont recalculés quand on déplace une boîte. Un croisement qui reste vient en général d'une boîte qui dessert toute la maison (volets) : déplacez la boîte ou tirez la gaine pour la faire passer ailleurs.">${X.n ? `⚠ ${X.n} croisement${X.n > 1 ? "s" : ""} de gaines sur ce niveau (${esc(X.boxes.join(", "))})${X.intra ? `, dont ${X.intra} dans une même boîte` : ""} : déplacer la boîte ou tirer la gaine.` : "✓ Aucune gaine n'en croise une autre sur ce niveau."}</p>`;
    return `${head}${tabWarn}<p class="sm"><b>${W.totals.boites}</b> boîtes · <b>${W.totals.gaines}</b> gaines · <b>${fr(W.totals.gaine)}</b> m de gaine · <b>${fr(W.totals.cuivre)}</b> m de fil</p>
      ${cross}${issues}<div class="cb-list">${rows}</div>
      ${askBox ? `<div class="cb-ask bx-ask"><b>Quelles boîtes recalculer ?</b> <span class="mut sm">Les boîtes décochées gardent leur place, leurs appareils et leurs tracés.</span>
          ${B.map((b) => `<label class="wck"><input type="checkbox" class="bx-redo" value="${b.id}" ${b.locked ? "" : "checked"}> ${esc(b.n)}${b.locked ? ` <span class="mut sm">🔒 verrouillée</span>` : ""}</label>`).join("")}
          <label class="wck" title="Vide = le logiciel choisit le nombre qui économise le plus de cuivre">Nombre de boîtes en tout : <input id="bx-count" type="number" min="1" max="40" step="1" placeholder="auto" style="width:64px"></label>
          <div><button class="on" id="bx-yes">Recalculer les boîtes cochées</button><button id="bx-no">Annuler</button></div></div>`
        : `<button id="bx-auto" title="Recalculer l'emplacement des boîtes selon le mode choisi : vous choisissez lesquelles (les verrouillées restent en place). Ctrl+Z pour revenir.">Replacer les boîtes automatiquement…</button>`}
      <p class="mut sm">Sur le plan : glisser une boîte pour la déplacer ; tirer une gaine pour lui donner un point de passage (Maj : tronçon droit, double-clic sur un point : le supprimer). Une boîte déplacée ou retracée se verrouille 🔒 toute seule. Onglets « Boîtes » et « Lignes directes » (à gauche) : le détail des gaines et des fils.</p>`;
  }
  function deleteBox(id) {
    const r = removeBoxPlan(api, id);
    if (!r) return;
    api.boxSel = null;
    commitBoxes(r.boxes);
    const mv = Object.entries(r.moved).map(([n, k]) => `${k} vers ${n}`).join(", ");
    api.setHint(`${r.name} supprimée${mv ? " : appareils " + mv : ""}${r.orphan ? ` ; ${r.orphan} appareil${r.orphan > 1 ? "s" : ""} sans boîte (aucune autre boîte sur ce niveau)` : ""}. Ctrl+Z pour annuler.`);
  }
  document.addEventListener("okteo:box-delete", (e) => deleteBox(e.detail.id));
  // bout de gaine tiré sur une autre boîte : l'appareil (avec ceux au même endroit et son allumage) change de boîte ;
  // un circuit qui n'arrivait pas dans la nouvelle boîte est ajouté à sa gaine d'alimentation ; alerte si la boîte déborde
  function moveGaine({ from, to, id }) {
    const B = api.cab.boxes || [], src = B.find((b) => b.id === from), dst = B.find((b) => b.id === to);
    if (!src || !dst) return;
    const items = api.allApps(), by = new Map(items.map((a) => [a.id, a])), a0 = by.get(id), near = getCab().memeEndroit ?? 0.3;
    if (!a0) return;
    // l'endroit tiré, avec tout l'allumage de chaque appareil (commandes et lumières, même déjà dans une autre boîte) :
    // une commande et ses lumières ne sont jamais séparées
    const ids = withAllumage(src.apps.filter((k) => { const a = by.get(k); return a && a.lv === a0.lv && Math.hypot(a.x - a0.x, a.y - a0.y) <= near + 1e-9; }));
    const before = (wiringNow(api).boxes.find((b) => b.id === to) || {}).circuits || [];
    commitBoxes(B.map((b) => (b.id === to ? { ...b, apps: [...new Set([...b.apps, ...ids])], locked: true } : b.apps.some((k) => ids.has(k)) ? { ...b, apps: b.apps.filter((k) => !ids.has(k)), locked: b.id === from ? true : b.locked } : b)));
    const W = wiringNow(api), tb = W.boxes.find((b) => b.id === to) || { circuits: [], n: dst.n };
    const added = tb.circuits.filter((c) => !before.includes(c));
    const warn = W.issues.filter((x) => x.startsWith(tb.n + " ") || x.startsWith(tb.n + " :"));
    const names = [...ids].map((k) => (by.get(k) || {}).rep).filter(Boolean);
    api.setHint(`${names.join(", ")} raccordé${names.length > 1 ? "s" : ""} à ${tb.n}${ids.size > 1 ? " (même endroit ou même allumage)" : ""}`
      + (added.length ? ` · ${added.join(", ")} ajouté${added.length > 1 ? "s" : ""} à l'alimentation de ${tb.n}` : "")
      + (warn.length ? ` · ⚠ ${warn.map((x) => x.replace(tb.n + " : ", "")).join(" ; ")}` : "") + " · Ctrl+Z pour annuler.");
    render();
  }
  document.addEventListener("okteo:gaine-move", (e) => moveGaine(e.detail));
  function placeAuto(keepIds = [], count = 0) {
    if (!(api.cab.circuits || []).length) { api.setHint("Répartissez d'abord les appareils en circuits."); return; }
    const r = autoBoxes(api, keepIds, count, api.cab.mode || "proximite");
    commitBoxes(r.boxes); api.showCircuits = true;
    const kept = keepIds.length ? ` (${keepIds.length} gardée${keepIds.length > 1 ? "s" : ""} telle${keepIds.length > 1 ? "s" : ""} quelle${keepIds.length > 1 ? "s" : ""})` : "";
    api.setHint(`${r.boxes.length} boîtes${kept}, placées pour économiser le cuivre${r.issues.length ? " — " + r.issues.join(" ; ") : ""}. Glissez une boîte pour la déplacer ; Ctrl+Z pour annuler.`);
  }
  function wireBoxes() {
    const $ = (q) => el.querySelector(q);
    const a = $("#bx-auto"); if (a) a.onclick = () => { if ((api.cab.boxes || []).length) { askBox = true; render(); } else placeAuto(); };
    const y = $("#bx-yes"); if (y) y.onclick = () => {
      const keep = [...el.querySelectorAll(".bx-redo")].filter((c) => !c.checked).map((c) => c.value);
      const count = +($("#bx-count") || {}).value || 0;
      askBox = false; placeAuto(keep, count);
    };
    const n = $("#bx-no"); if (n) n.onclick = () => { askBox = false; render(); };
    const t = $("#bx-tab"); if (t) t.onclick = () => { api.setTool("TAB"); api.setHint("Cliquez sur le plan à l'emplacement du tableau (TD)."); };
    const fx = $("#cb-fixsplit"); if (fx) fx.onclick = fixSplits;
    const cv = $("#bx-cvol"); if (cv) cv.onchange = () => { api.setCab({ choix: { ...(api.cab.choix || {}), commandeVolet: cv.value } }); api.setHint(cv.value === "connecte" ? "Volets connectés : les commandes de volet ne sont plus câblées (recalculez les circuits et les boîtes : « Câbler le chantier »)." : "Volets en commande filaire : les commandes de volet sont câblées avec leurs volets."); };
    const md = $("#bx-mode"); if (md) md.onchange = () => { api.setCab({ mode: md.value }); api.setHint(`Pieuvre « ${MODES[md.value]} » : appliquée au prochain placement (« ${(api.cab.boxes || []).length ? "Replacer les boîtes…" : "Placer les boîtes"} »). « Comparer les 3 modes » pour voir avant de choisir.`); };
    const cp = $("#bx-cmp"); if (cp) cp.onclick = () => compare.open();
    el.querySelectorAll(".bx-row").forEach((r) => {
      const id = r.dataset.b, b = () => api.cab.boxes.find((x) => x.id === id);
      r.querySelector('[data-a="see"]').onclick = () => { const B = b(); if (B.lv !== api.level.id) api.switchLevel(B.lv); api.showCircuits = true; api.boxSel = id; api.zoomToBox(B.x - 3, B.y - 3, B.x + 3, B.y + 3); render(); };
      r.querySelector('[data-a="take"]').onclick = () => {
        const sel = selectedApps(); if (!sel.length) { api.setHint("Sélectionnez d'abord des appareils sur le plan, puis « ← Sélection » sur la boîte."); return; }
        const ids = [...withAllumage(sel)];
        commitBoxes(api.cab.boxes.map((x) => ({ ...x, apps: x.id === id ? [...new Set([...x.apps, ...ids])] : x.apps.filter((k) => !ids.includes(k)) })));
        if (ids.length > sel.length) api.setHint(`${ids.length - sel.length} appareil(s) du même allumage emmené(s) aussi : une commande et ses lumières restent dans la même boîte.`);
      };
      r.querySelector('[data-a="del"]').onclick = () => deleteBox(id);
      r.querySelector('[data-a="lock"]').onclick = () => api.setBoxes(api.cab.boxes.map((x) => (x.id === id ? { ...x, locked: !x.locked } : x)));
      const st = r.querySelector('[data-a="straight"]');
      if (st) st.onclick = () => { api.setBoxes(api.cab.boxes.map((x) => { if (x.id !== id) return x; const { routes, ...rest } = x; return rest; })); api.setHint("Gaines remises en ligne droite (Ctrl+Z pour annuler)."); };
      r.querySelector('[data-a="list"]').onclick = () => { api.setTab("boites"); setTimeout(() => document.getElementById("bx-" + id)?.scrollIntoView({ block: "start" }), 50); };
    });
  }

  function wire() {
    if (ctl) wireControlSection(el, ctl);
    wireHpSection(el, api, render);
    wireBoxes();
    const $ = (s) => el.querySelector(s);
    const sh = $("#cb-show"); if (sh) sh.onchange = () => { api.showCircuits = sh.checked; };
    const au = $("#cb-auto"); if (au) au.onclick = () => { if (api.cab.circuits.length) { ask = "auto"; render(); } else auto(); };
    const y = $("#cb-yes"); if (y) y.onclick = () => { ask = null; auto(); };
    const n = $("#cb-no"); if (n) n.onclick = () => { ask = null; render(); };
    const o = $("#cb-orph"); if (o) o.onclick = () => { const { chk } = data(); api.select(chk.orphans); };
    const nw = $("#cb-new"); if (nw) nw.onclick = () => {
      const kind = $("#cb-kind").value, S = cabS(api), ids = selectedApps();
      const sec = { eclairage: [S.secEclairage, S.protEclairage], prises: [S.secPrises, S.protPrises], specialise: [S.secSpecialise, S.protSpecialise], comm: [null, null] }[kind];
      let C = api.cab.circuits.map((c) => ({ ...c, apps: c.apps.filter((id) => !ids.includes(id)) })).filter((c) => c.apps.length);
      C.push({ id: "c" + Date.now().toString(36), kind, label: `${KIND[kind]} (nouveau)`, apps: ids, section: sec[0], prot: sec[1], direct: kind === "specialise" || kind === "comm" });
      api.setCircuits(renumber(C));
    };
    el.querySelectorAll(".cb-row:not(.bx-row)").forEach((r) => {
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
  ["okteo:cab", "okteo:saved", "okteo:level", "okteo:cab-settings", "okteo:box-select", "okteo:control"].forEach((e) => document.addEventListener(e, later));
  document.addEventListener("okteo:open-cablage", () => panel.show("cablage"));
  // les couleurs des circuits s'affichent quand l'onglet Câblage est ouvert (et restent tant qu'on ne les décoche pas)
  panel.onChange((s) => { if (s.pane === "cablage" && !s.collapsed) { if (!api.showCircuits && !el.__shown) { el.__shown = true; api.showCircuits = true; } later(); } });
  render();
  return { render, auto, placeAuto, el };
}
