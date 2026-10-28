// Étude du câblage (v53) : onglet « Étude », doutes sur le plan et compteur, « Pourquoi ? » au clic sur une boîte ou une
// gaine, commande « Câbler le chantier » (précontrôle d'abord : rien n'est câblé si une règle bloquante manque),
// rapport de câblage (PDF) et statistiques par règle (toutes les études de ce PC).
import { reportHTML, reportText } from "./ai-recheck-ui.js";
import { getCab } from "../cablage/settings.js";
import { getJournal } from "../cablage/regles.js";
import { computeCircuits, checkCircuits, circuitsByBox } from "../cablage/circuits.js";
import { STEPS, ETATS, precontrole, contextOf, buildTrace, whyBox, whyGaine, whyWire, statsOf, scoreOf } from "../cablage/etude.js";
import { MODES } from "../cablage/boites.js";
import { wiringNow, autoBoxes, compareModes, cabS } from "./cablage-data.js";
import { esc, store, storeSet } from "./util.js";
import { downloadBlob } from "./dossier.js";

const KEY = "okteo.etudes.v1";
const fr = (v, d = 1) => (v == null ? "—" : Number(v).toFixed(d).replace(".", ","));
const st = (s) => `<span class="et-st ${s}" title="${esc(ETATS[s]?.t || s)}">${ETATS[s]?.s || "·"}</span>`;

// tout ce qu'il faut pour l'étude, sur l'état actuel du chantier (rien n'est modifié)
export function etudeNow(api, { alternatives = true } = {}) {
  const S = cabS(api), J = getJournal(), items = api.allApps(), links = api.allLinks(), C = api.cab.circuits || [], B = api.cab.boxes || [];
  const W = B.length && C.length ? wiringNow(api) : null;
  const mode = api.cab.mode || "proximite";
  const ctx = contextOf({ items, links, circuits: C, boxes: B, mode, W });
  let alts = [];
  if (alternatives && C.length && items.some((a) => a.t === "TAB")) { try { alts = compareModes(api); } catch (e) { alts = []; } }
  return buildTrace({ J, ctx, items, circuits: C, boxes: B, W, chk: C.length ? checkCircuits(C, items, S) : { issues: [], orphans: [] }, ctl: api.control || [], alternatives: alts, mode, chantier: api.ch.nom });
}

// « Câbler le chantier » : précontrôle, puis circuits (si aucun), boîtes (les boîtes verrouillées ou déplacées à la main
// restent), circuits par boîte, trace de l'étude enregistrée dans le chantier — un seul Ctrl+Z. Renvoie un compte rendu.
export function cabler(api) {
  const S = cabS(api), J = getJournal(), items = api.allApps(), links = api.allLinks(), mode = api.cab.mode || "proximite";
  if (!items.filter((a) => a.t !== "TAB").length) return { ok: false, text: "Je ne peux pas câbler : le plan n'a pas encore d'appareils." };
  const C0 = (api.cab.circuits || []).length ? api.cab.circuits : computeCircuits(items, links, S);
  const pc = precontrole(J, contextOf({ items, links, circuits: C0, boxes: api.cab.boxes || [], mode, W: null }));
  if (!pc.ok) return { ok: false, pc, text: `Je ne peux pas câbler : il manque ${pc.bloquants.length} règle${pc.bloquants.length > 1 ? "s" : ""} — ${pc.bloquants.map((r) => `${r.id} ${r.titre}`).join(" ; ")}.` };
  const keepIds = (api.cab.boxes || []).filter((b) => b.locked || b.manual).map((b) => b.id);
  const r = autoBoxes(api, keepIds, 0, mode, C0);
  const circuits = S.circuitsParBoite ? circuitsByBox(items, links, r.boxes, S) : C0;
  let tr = null;
  api.batch(() => {
    api.setCab({ circuits, boxes: r.boxes });
    tr = etudeNow(api);
    api.setCab({ etude: light(tr) });
  });
  api.showCircuits = true;
  saveStats(api, tr);
  const c = tr.counts;
  return { ok: true, trace: tr, text: `Câblé : ${r.boxes.length} boîtes (${MODES[mode] || mode}), ${circuits.length} circuits${keepIds.length ? `, ${keepIds.length} boîte${keepIds.length > 1 ? "s" : ""} gardée${keepIds.length > 1 ? "s" : ""}` : ""}. ${c.bloque} bloqué${c.bloque > 1 ? "s" : ""}, ${c.doute} doute${c.doute > 1 ? "s" : ""}, ${c.suppose} règle${c.suppose > 1 ? "s" : ""} supposée${c.suppose > 1 ? "s" : ""} : onglet Étude. Ctrl+Z pour revenir.` };
}
const light = (tr) => ({ ...tr, steps: tr.steps.map((s) => ({ ...s, decisions: s.decisions.map(({ rule, state, text, box }) => ({ rule, state, text, box })) })) });
function saveStats(api, tr) { const all = store(KEY, {}); all[api.chantierKey || api.ch.nom] = light(tr); storeSet(KEY, all); }
export function allStats() { return statsOf(Object.values(store(KEY, {}))); }

// ---------- rapport de câblage (PDF) ----------
export async function buildReport(api, tr) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const win = (s) => String(s ?? "").replace(/[→⟶]/g, "->").replace(/[←]/g, "<-").replace(/[✓]/g, "OK").replace(/[✕]/g, "X").replace(/[◐]/g, "~").replace(/[✎]/g, "M").replace(/[^\x20-\x7E -ÿ–—…’Œœ]/g, "");
  let y = 16;
  const line = (t, size = 9.5, bold = false, color = 0) => { doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(color); const L = doc.splitTextToSize(win(t), 186); if (y + L.length * size * 0.42 > 285) { doc.addPage(); y = 16; } doc.text(L, 12, y); y += L.length * size * 0.42 + 1.6; };
  line(`Rapport de câblage — ${api.ch.nom}${api.ch.numero ? " n° " + api.ch.numero : ""}`, 15, true);
  line(`${new Date(tr.date).toLocaleString("fr-FR")} · mode de pieuvre ${MODES[tr.mode] || tr.mode} · journal des règles ${tr.journal}`, 9, false, 90);
  line(`Bloqués : ${tr.counts.bloque} · doutes : ${tr.counts.doute} · règles supposées : ${tr.counts.suppose} · corrections à la main : ${tr.counts.corrige}${tr.score ? ` · ${fr(tr.score.gaine)} m de gaine, ${tr.score.boites} boîtes, ${tr.score.departs} départs` : ""}`, 9.5);
  y += 2; line("Étapes", 12, true);
  tr.steps.forEach((s) => line(`${s.n}. ${s.title} : ${ETATS[s.state].t}`, 9.5));
  if (tr.alternatives.length) { y += 2; line("Modes de pieuvre étudiés (longueur de gaine, puis boîtes, puis départs)", 12, true); tr.alternatives.forEach((a) => line(`${a.rank}. ${a.name}${a.chosen ? " (retenu)" : ""} : ${fr(a.score.gaine)} m de gaine, ${a.score.boites} boîtes, ${a.score.departs} départs${a.note != null ? `, belle pieuvre ${a.note}/100${a.noteOk ? "" : " (croisement dans une boîte)"}` : ""}`)); }
  y += 2; line("Où ça coince", 12, true);
  if (!tr.where.length) line("Rien : toutes les règles utilisées sont confirmées et aucun doute.");
  tr.where.forEach((d) => { line(`[${ETATS[d.state].t}] étape ${d.step} ${d.stepTitle}${d.rule ? " · " + d.rule : ""} : ${d.text}`, 9.5, d.state === "bloque"); if (d.question) line(`   Question : ${d.question}`, 8.5, false, 90); });
  return { blob: doc.output("blob"), pages: doc.getNumberOfPages() };
}

// ---------- page « Étude » ----------
export function mountEtudePage(el, { api, askRule }) {
  let cur = 1, tr = null, msg = "";
  function render() {
    tr = etudeNow(api);
    const J = getJournal(), pc = precontrole(J, contextOf({ items: api.allApps(), links: api.allLinks(), circuits: api.cab.circuits || [], boxes: api.cab.boxes || [], mode: api.cab.mode || "proximite", W: null }));
    const last = api.cab.etude, S = stepOf(cur);
    const stats = allStats();
    el.innerHTML = `<div class="params-in etude">
      <div class="et-head"><h2>Étude du câblage</h2><span class="mut">${esc(api.ch.nom)} · pieuvre ${esc(MODES[api.cab.mode || "proximite"] || "")}</span><span class="grow"></span>
        <button class="on" id="et-cabler" title="Précontrôle des règles, puis circuits, boîtes (les boîtes verrouillées restent) et circuits par boîte ; un seul Ctrl+Z pour revenir">⚡ Câbler le chantier</button>
        <button id="et-report" title="Rapport de câblage (PDF) : étapes, modes étudiés, tout ce qui coince avec la question à poser">📄 Rapport de câblage</button></div>
      ${msg ? `<p class="et-msg ${/^Je ne peux pas/.test(msg) ? "warn" : "ok"}">${esc(msg)}</p>` : ""}
      <div class="et-pc ${pc.ok ? "" : "bad"}"><b>Précontrôle</b> — ${pc.ok ? `✓ les ${pc.rules.length} règles utiles à ce chantier sont connues${pc.supposees.length ? ` ; ${pc.supposees.length} sont supposées (résultat « à vérifier ») : ${pc.supposees.map((r) => `<a href="#" data-rule="${r.id}" title="${esc(r.titre)}">${r.id}</a>`).join(" ")}` : ""}.`
        : `✕ Je ne peux pas câbler : il manque ${pc.bloquants.length} règle${pc.bloquants.length > 1 ? "s" : ""} — ${pc.bloquants.map((r) => `<b>${r.id}</b> ${esc(r.titre)}`).join(" ; ")}.`}
        ${last ? `<div class="mut sm">Dernier câblage : ${esc(new Date(last.date).toLocaleString("fr-FR"))} · ${esc(MODES[last.mode] || last.mode)} · ${last.counts.bloque} bloqué(s), ${last.counts.doute} doute(s)</div>` : `<div class="mut sm">Pas encore câblé avec « Câbler le chantier » : l'étude ci-dessous décrit l'état actuel.</div>`}</div>
      <div class="et-steps" role="tablist">${tr.steps.map((s) => `<button class="et-step ${s.state}${s.n === cur ? " cur" : ""}" aria-selected="${s.n === cur}" data-n="${s.n}" title="${esc(ETATS[s.state].t)}"><span class="st">${ETATS[s.state].s}</span><b>${s.n}. ${esc(s.title)}</b><small>${s.decisions.length} décision${s.decisions.length > 1 ? "s" : ""}</small></button>`).join("")}</div>
      <div class="et-cols">
        <div class="et-box"><h3>${S.n}. ${esc(S.title)}</h3>
          ${cur === 2 && tr.alternatives.length ? `<table class="rg-tab"><tr><th>Rang</th><th>Mode</th><th>Gaine</th><th>Boîtes</th><th>Départs</th><th title="Note « belle pieuvre » (v62) : croisements, territoires, cuivre, boîtes, départs équilibrés, gaines longues">Belle pieuvre</th><th></th></tr>${tr.alternatives.map((a) => `<tr><td>${a.rank}</td><td>${esc(a.name)}</td><td>${fr(a.score.gaine)} m</td><td>${a.score.boites}</td><td>${a.score.departs}</td><td>${a.note != null ? a.note + "/100" + (a.noteOk ? "" : " ✗") : "—"}</td><td>${a.chosen ? "<b>retenu</b>" : ""}</td></tr>`).join("")}</table><p class="mut sm">Rang (Q-77) : longueur totale de gaine, puis nombre de boîtes, puis départs (changement proposé à Kévin, Q-86 : le cuivre et la note « belle pieuvre »). Changer de mode : panneau Câblage → Pieuvre.</p>` : ""}
          <ul class="et-where">${tr.steps[cur - 1].decisions.map((d) => `<li>${st(d.state)} ${d.rule ? `<a href="#" data-rule="${d.rule}">${d.rule}</a> ` : ""}${esc(d.text)}</li>`).join("") || "<li class=mut>Rien à signaler.</li>"}</ul></div>
        <div class="et-box"><h3>Où ça coince <span class="mut sm">(${tr.where.filter((d) => d.state !== "suppose").length} point${tr.where.length > 1 ? "s" : ""} + règles supposées)</span></h3>
          <ul class="et-where" id="et-where">${tr.where.map((d, i) => `<li data-i="${i}">${st(d.state)} <b>${d.step}.</b> ${d.rule ? `<a href="#" data-rule="${d.rule}">${d.rule}</a> ` : ""}${esc(d.text)}
            ${d.question ? `<span class="q">Question : ${esc(d.question)}</span>` : ""}
            <span>${d.box || (d.ids && d.ids.length) ? `<button data-a="see" data-i="${i}" title="Montrer sur le plan">Voir</button>` : ""}${d.rule && d.state !== "corrige" ? ` <button data-a="prop" data-i="${i}" title="L'assistant prépare un avant / après de la règle, avec ce cas comme preuve">Proposer une modification de la règle</button>` : ""}</span></li>`).join("") || "<li class=mut>Rien : toutes les règles utilisées sont confirmées et aucun doute.</li>"}</ul></div>
      </div>
      <section class="et-iasec" id="et-ia"><h3>Analyse IA du relevé <span class="mut sm">relevé, relectures ciblées, ce qui a été modifié ou non trouvé</span><span class="grow"></span><button id="et-ia-copy" title="Copier le rapport en texte (pour un mail ou le BE)">📋 Copier le rapport</button></h3>${reportHTML(api)}</section>
      <details class="rg-more" id="et-stats"><summary>Statistiques par règle (${stats.etudes} chantier${stats.etudes > 1 ? "s" : ""} câblé${stats.etudes > 1 ? "s" : ""} sur ce PC)</summary>
        ${stats.rules.length ? `<table class="rg-tab"><tr><th>Règle</th><th>Appliquée</th><th>Supposée</th><th>Doutes</th><th>Blocages</th><th>Corrigée à la main</th><th>Signal</th></tr>${stats.rules.map((r) => `<tr><td><a href="#" data-rule="${r.id}">${r.id}</a></td><td>${r.app}</td><td>${r.suppose}</td><td>${r.doute}</td><td>${r.bloque}</td><td>${r.corrige}</td><td class="warn">${esc(r.signal)}</td></tr>`).join("")}</table>
          <table class="rg-tab"><tr><th>Mode</th><th>Étudié</th><th>Retenu</th><th>Le plus économique</th><th>Signal</th></tr>${stats.modes.map((m) => `<tr><td>${esc(m.name)}</td><td>${m.etudie}</td><td>${m.retenu}</td><td>${m.meilleur}</td><td class="warn">${esc(m.signal)}</td></tr>`).join("")}</table>
          <button id="et-stats-exp" title="Fichier JSON des études de ce PC, pour regrouper plusieurs PC">⤓ Exporter les statistiques</button>` : `<p class="mut">Les statistiques se remplissent à chaque « Câbler le chantier ».</p>`}</details>
    </div>`;
    wire();
  }
  const stepOf = (n) => STEPS[n - 1];
  function wire() {
    el.querySelectorAll(".et-step").forEach((b) => (b.onclick = () => { cur = +b.dataset.n; render(); }));
    el.querySelectorAll("[data-rule]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); api.setTab("params"); setTimeout(() => window.okteoExt?.pages?.params?.ui?.regles?.open(a.dataset.rule), 80); }));
    el.querySelector("#et-cabler").onclick = () => { const r = cabler(api); msg = r.text; render(); };
    const iac = el.querySelector("#et-ia-copy");
    if (iac) iac.onclick = async () => { const t = reportText(api); el.__iaText = t; try { await Promise.race([navigator.clipboard.writeText(t), new Promise((_, no) => setTimeout(() => no(new Error("délai")), 1500))]); iac.textContent = "✓ Rapport copié"; } catch { iac.textContent = "Copie impossible : sélectionnez le rapport"; } };
    el.querySelector("#et-report").onclick = async () => { const r = await buildReport(api, tr); el.__report = r; downloadBlob(r.blob, `${api.ch.nom}${api.ch.numero ? "_" + api.ch.numero : ""}_rapport_cablage.pdf`); };
    const ex = el.querySelector("#et-stats-exp");
    if (ex) ex.onclick = () => downloadBlob(new Blob([JSON.stringify({ okteo: "etudes", ...store(KEY, {}) }, null, 1)], { type: "application/json" }), "etudes-cablage.json");
    el.querySelectorAll("#et-where button").forEach((b) => (b.onclick = () => {
      const d = tr.where[+b.dataset.i]; if (!d) return;
      if (b.dataset.a === "see") {
        api.setTab("plan");
        const box = d.box && (api.cab.boxes || []).find((x) => x.n === d.box);
        const ids = d.ids && d.ids.length ? d.ids : box ? box.apps : [];
        setTimeout(() => { if (box) api.boxSel = box.id; if (ids.length) api.zoomTo(ids); }, 30);
      } else askRule && askRule(d.rule, `Règle ${d.rule} : cas observé sur le chantier ${api.ch.nom} (étape ${d.step} ${d.stepTitle}) : « ${d.text} ». Propose une modification de la règle (avant / après), ou dis-moi pourquoi elle est juste.`);
    }));
  }
  render();
  return { render, get trace() { return tr; }, get el() { return el; } };
}

// ---------- doutes sur le plan + compteur du bandeau ----------
export function createDoubts(api) {
  const btn = document.getElementById("dbt");
  let t = null, last = [];
  function update() {
    t = null;
    const B = api.cab.boxes || [];
    let D = [];
    if (B.length && (api.cab.circuits || []).length) {
      try {
        const W = wiringNow(api), byN = new Map(B.map((b) => [b.n, b])), by = new Map(api.allApps().map((a) => [a.id, a]));
        D = W.doutes.map((d, i) => { const b = d.box && byN.get(d.box); return { key: "d" + i + (b ? b.id : ""), x: b ? b.x : null, y: b ? b.y : null, lv: b ? b.lv : null, box: b ? b.id : null, boxN: d.box || "", bloquant: d.bloquant, text: d.text, rule: d.rule }; });
        (W.splits || []).forEach((s, i) => { const a = by.get(s.c); D.push({ key: "s" + i, x: a ? a.x : null, y: a ? a.y : null, lv: a ? a.lv : null, ids: a ? [a.id] : [], bloquant: true, text: "allumage coupé", rule: "R-002" }); });
      } catch (e) { D = []; }
    }
    last = D;
    api.setDoubts(D.filter((d) => d.x != null));
    // v64 : un seul compteur « à vérifier » (#ctl) : contrôle + doutes ; l'ancien bouton des doutes reste caché
    document.dispatchEvent(new CustomEvent("okteo:doubts", { detail: D }));
    if (btn) {
      const nb = D.filter((d) => d.bloquant).length;
      btn.hidden = true;
      btn.textContent = nb ? `✕ ${D.length} doute${D.length > 1 ? "s" : ""}` : `? ${D.length} doute${D.length > 1 ? "s" : ""}`;
      btn.classList.toggle("warn", !nb);
      btn.title = `Doutes du câblage (${nb} bloquant${nb > 1 ? "s" : ""}) : ${D.slice(0, 4).map((d) => d.text).join(" ; ")}${D.length > 4 ? "…" : ""} — clic : onglet Étude`;
    }
  }
  const later = () => { if (!t) t = setTimeout(update, 120); };
  ["okteo:cab", "okteo:saved", "okteo:level", "okteo:cab-settings", "okteo:regles", "okteo:ready"].forEach((e) => document.addEventListener(e, later));
  if (btn) btn.onclick = () => api.setTab("etude");
  update(); setTimeout(update, 0);   // 2e fois : le compteur « à vérifier » est créé après
  return { update, get list() { return last; } };
}

// ---------- « Pourquoi ? » sur le plan : clic sur une boîte ou une gaine ----------
export function createWhy(api) {
  const stage = document.querySelector(".stage");
  const card = document.createElement("div");
  card.className = "why-card"; card.hidden = true; card.setAttribute("role", "dialog");
  stage.appendChild(card);
  let sel = null;
  function show(id, key) {
    const W = (api.cab.circuits || []).length ? wiringNow(api) : null, b = W && W.boxes.find((x) => x.id === id);
    if (!b) { card.hidden = true; return; }
    const S = getCab();
    const g = key ? b.gaines.find((x) => (key === "tab" ? x.id === "alim:0" : (x.appIds || []).includes(key))) : null;
    sel = { id, key };
    const chain = g ? whyGaine(g, b, S) : whyBox(b, S, api.cab.mode);
    card.innerHTML = `<h4><span>Pourquoi ${esc(g ? g.no : b.n)} ?</span><span class="grow"></span>${g ? `<button data-k="" title="Revenir à la boîte">${esc(b.n)}</button>` : ""}<button class="mini" data-x title="Fermer">✕</button></h4>
      <div class="mut sm">${g ? esc(g.label) : `${b.gaines.length} gaines · circuits ${esc(b.circuits.join(", "))}`}</div>
      <ol>${chain.map((c) => `<li>${c.rule ? `<b>${c.rule}</b> ` : ""}${esc(c.text)}</li>`).join("")}</ol>
      ${g ? `<div class="mut sm">Fils : ${g.wires.map((w, i) => `<a href="#" data-w="${i}">${esc(w.color)}${w.n ? " n°" + w.n : ""}</a>`).join(" · ")}</div><div class="why-w"></div>`
        : `<div class="gl">${b.gaines.map((x) => `<button data-k="${esc(x.kind === "alim" ? (x.id === "alim:0" ? "tab" : x.id) : (x.appIds || [])[0])}" title="${esc(x.label)}">${esc(x.no.split(".")[1])}</button>`).join("")}</div>`}`;
    card.hidden = false;
    card.querySelector("[data-x]").onclick = () => { card.hidden = true; };
    card.querySelectorAll("[data-k]").forEach((x) => (x.onclick = () => show(id, x.dataset.k || null)));
    card.querySelectorAll("[data-w]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); const w = g.wires[+a.dataset.w]; card.querySelector(".why-w").innerHTML = `<ol>${whyWire(w).map((c) => `<li><b>${c.rule}</b> ${esc(c.text)}</li>`).join("")}</ol>`; }));
  }
  document.addEventListener("okteo:box-select", (e) => { const d = e.detail || {}; if (d.id) show(d.id, d.key || null); else card.hidden = true; });
  document.addEventListener("okteo:tab", (e) => { if (e.detail !== "plan") card.hidden = true; });
  document.addEventListener("okteo:cab", () => { if (!card.hidden && sel) show(sel.id, sel.key); });
  return { show, hide: () => { card.hidden = true; }, get el() { return card; } };
}
