// Assistant IA (extension du panneau de droite).
// - répond aux questions sur les fonctions (il reçoit le catalogue complet) ;
// - analyse le plan (image + données) ;
// - agit dans le logiciel quand on le lui demande, via un bloc ```okteo {...}``` à la fin de sa réponse :
//     "actions"  : exécutées tout de suite (seulement sur demande explicite de l'utilisateur)
//     "suggest"  : boutons proposés
//   Une suppression demande TOUJOURS une confirmation, quoi que dise l'IA.
// - sans clé : recherche locale dans la liste des fonctions.

import { chat, PROVIDERS } from "./ai.js";
import { settings } from "./settings.js";
import { planSummary, planImage } from "./plan-data.js";
import { searchCatalog } from "./palette.js";
import { esc, md, store, storeSet } from "./util.js";

const MAX_KEEP = 40, MAX_SEND = 12;

export function systemPrompt(api, catalog) {
  const fns = catalog.map((c) => `${c.id} | ${c.cat} | ${c.label} | ${c.keys || "-"} | ${c.run ? "lançable" : "mode d'emploi"} | ${c.desc}`).join("\n");
  const plan = planSummary(api);
  if (plan.murs.length > 250) plan.murs = plan.murs.slice(0, 250);
  return `Tu es l'assistant intégré d'Oktéo AI, logiciel de dessin de plans électriques de maisons individuelles, utilisé par le bureau d'études de pieuvres électriques de KiTéOHM. Dans le logiciel, on dessine les murs et on implante l'appareillage (prises, lumières, interrupteurs…) ; le câblage (boîtes, bandes, SPV) viendra plus tard.
L'utilisateur est spécialiste du câblage et des pieuvres, mais débutant sur ce logiciel.
Réponds en français, court et concret : étapes numérotées quand il y a une manipulation, raccourcis clavier en **gras**.

FONCTIONS DU LOGICIEL (id | rubrique | nom | raccourci | type | mode d'emploi) :
${fns}

Si on te demande une fonction absente de cette liste, dis clairement qu'elle n'existe pas encore. N'invente jamais de fonction, de bouton ni de raccourci.

PLAN ACTUEL (${api.chantier}) en JSON :
${JSON.stringify(plan)}
Désigne les objets par leur id entre crochets, par exemple [a3] ou [r1] : ils deviennent cliquables pour l'utilisateur.

ACTIONS. Tu peux agir dans le logiciel en terminant ta réponse par un bloc :
\`\`\`okteo
{"actions":[ ... ],"suggest":[ ... ]}
\`\`\`
- "actions" : exécutées immédiatement. UNIQUEMENT si l'utilisateur te demande explicitement d'agir (« active… », « sélectionne… », « montre-moi… », « renomme… », « fais-le »).
- "suggest" : boutons proposés à l'utilisateur, chacun avec un "label" court. Quand il pose une question sur une fonction, propose le bouton qui la lance.
Types d'action :
{"do":"cmd","id":"<id de fonction lançable>"}
{"do":"select","ids":["a3","a4"]}  sélectionne des objets
{"do":"zoom","ids":["r2"]}  centre la vue sur des objets ou des pièces
{"do":"rename","room":"r1","name":"Chambre 1"}  renomme une pièce
{"do":"delete","ids":["a7"]}  supprime (l'utilisateur devra toujours confirmer)
Tu ne peux pas encore dessiner de murs ni poser d'appareils toi-même : si on te le demande, explique comment faire et active l'outil (ou propose-le).
N'écris le bloc que s'il contient au moins une action ou une suggestion, et n'écris rien après.`;
}

const ANALYSE_PROMPT = `Analyse ce plan : image jointe (fond de plan + dessin) et données JSON du plan actuel.
Vérifie, pièce par pièce :
1. Le dessin : pièces sans nom ou mal nommées, appareils hors de toute pièce, appareils muraux non accrochés à un mur.
2. L'éclairage : chaque pièce a-t-elle un point lumineux commandé ? Interrupteurs reliés à rien, lumières sans commande.
3. Prises et équipements par rapport aux minimums usuels de la NF C 15-100 pour le logement (ce sont des repères : écris « à vérifier »).
4. Ce que tu vois sur le fond de plan et qui n'est pas encore dessiné (pièces, appareils).
Format : un titre court par thème, des puces courtes, les ids entre crochets. Termine par les 3 actions prioritaires.
Mets en "suggest" des boutons de zoom sur les points principaux. N'exécute aucune action.`;

export function parseReply(text) {
  const re = /```(?:okteo|json)?\s*(\{[\s\S]*?"(?:actions|suggest)"[\s\S]*?\})\s*```\s*$/;
  const m = text.match(re);
  if (!m) return { text: text.trim(), actions: [], suggest: [] };
  let obj = {};
  try { obj = JSON.parse(m[1]); } catch { return { text: text.trim(), actions: [], suggest: [] }; }
  return { text: text.slice(0, m.index).trim(), actions: Array.isArray(obj.actions) ? obj.actions : [], suggest: Array.isArray(obj.suggest) ? obj.suggest : [] };
}

export function createAssistant(el, { api, getCatalog, openParams }) {
  const KEY = "okteo.chat." + api.chantierKey;
  let hist = store(KEY, []);
  let busy = false;

  el.classList.add("as");
  el.innerHTML = `
    <div class="as-head"><span class="as-prov"></span><span class="grow"></span>
      <button class="as-an" title="Envoyer l'image du plan et ses données à l'IA">📐 Analyser le plan</button>
      <button class="as-clear" title="Effacer la conversation">🗑</button></div>
    <div class="as-msgs" aria-live="polite"></div>
    <form class="as-in"><textarea rows="2" placeholder="Votre question… (Entrée pour envoyer, Maj+Entrée pour aller à la ligne)"></textarea><button class="on" type="submit">Envoyer</button></form>`;
  const msgsEl = el.querySelector(".as-msgs"), ta = el.querySelector("textarea"), form = el.querySelector("form"), provEl = el.querySelector(".as-prov");

  const save = () => { hist = hist.slice(-MAX_KEEP); storeSet(KEY, hist.map(({ image, ...m }) => (image ? { ...m, hadImage: true } : m))); };

  function paintProv() {
    const p = settings.activeProvider();
    if (!p) { provEl.innerHTML = `<span class="pill off">Pas de clé IA</span>`; return; }
    const m = settings.get().models[p] || PROVIDERS[p].defaultModel;
    provEl.innerHTML = `<span class="pill">${PROVIDERS[p].name}</span><span class="mut mono">${esc(m)}</span>`;
  }
  settings.onChange(() => { paintProv(); if (!hist.length && !busy) render(); });

  // ---------- affichage ----------
  function btn(a, i, scope) {
    const label = a.label || describe(a);
    return `<button class="as-sug ${a.do === "delete" ? "danger" : ""}" data-scope="${scope}" data-i="${i}">${esc(label)}</button>`;
  }
  function render() {
    if (!hist.length) {
      msgsEl.innerHTML = `<div class="as-welcome">
        <p><b>Assistant Oktéo.</b> Demandez-moi comment faire quelque chose, ou demandez-moi de le faire.</p>
        <div class="as-chips">${["Comment poser une prise à 30 cm de l'angle ?", "Active l'outil pièce", "Comment relier un interrupteur à une lumière ?", "Quels raccourcis clavier existent ?"].map((t) => `<button class="as-chip">${esc(t)}</button>`).join("")}</div>
        ${settings.activeProvider() ? "" : `<p class="warn">Aucune clé IA : je cherche seulement dans la liste des fonctions. <button class="as-params">Ajouter une clé</button></p>`}
      </div>`;
    } else {
      msgsEl.innerHTML = hist.map((m, mi) => {
        if (m.role === "user") return `<div class="as-msg u">${m.image || m.hadImage ? `<div class="as-att">📐 image du plan jointe</div>` : ""}${esc(m.show || m.text).replace(/\n/g, "<br>")}</div>`;
        if (m.role === "log") return `<div class="as-log">${esc(m.text)}</div>`;
        const sug = (m.suggest || []).map((a, i) => btn(a, i, mi)).join("");
        const meta = m.meta ? `<div class="as-meta">${esc(m.meta)}</div>` : "";
        return `<div class="as-msg a ${m.error ? "err" : ""}">${md(m.text)}${sug ? `<div class="as-sugs">${sug}</div>` : ""}${meta}</div>`;
      }).join("");
    }
    if (busy) msgsEl.insertAdjacentHTML("beforeend", `<div class="as-msg a busy"><span class="dots"><i></i><i></i><i></i></span> ${esc(busy)}</div>`);
    wire();
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }
  function wire() {
    msgsEl.querySelectorAll(".as-chip").forEach((b) => (b.onclick = () => ask(b.textContent)));
    msgsEl.querySelectorAll(".as-params").forEach((b) => (b.onclick = openParams));
    msgsEl.querySelectorAll("a.obj").forEach((a) => (a.onclick = (e) => { e.preventDefault(); const id = a.dataset.obj; if (!api.zoomTo([id])) return; api.select([id]); }));
    msgsEl.querySelectorAll(".as-sug").forEach((b) => (b.onclick = () => {
      const m = hist[+b.dataset.scope]; const a = m?.suggest?.[+b.dataset.i]; if (!a) return;
      if (a.do === "delete") { api.select(a.ids || []); api.deleteSelection(); log(`✓ Supprimé : ${(a.ids || []).join(", ")}`); m.suggest.splice(+b.dataset.i, 1); save(); render(); return; }
      runAction(a, true);
    }));
  }
  function log(text) { hist.push({ role: "log", text }); save(); render(); }

  // ---------- actions ----------
  function describe(a) {
    const C = getCatalog().find((c) => c.id === a.id);
    switch (a.do) {
      case "cmd": return C ? C.label : a.id;
      case "select": return "Sélectionner " + (a.ids || []).join(", ");
      case "zoom": return "Voir " + (a.ids || []).join(", ");
      case "rename": return `Renommer ${a.room} en « ${a.name} »`;
      case "delete": return "Supprimer " + (a.ids || []).join(", ");
      default: return "Action";
    }
  }
  // renvoie le texte de compte rendu, ou null
  function runAction(a, fromButton = false) {
    try {
      if (a.do === "cmd") {
        const C = getCatalog().find((c) => c.id === a.id);
        if (!C) return note(`✗ Fonction inconnue : ${a.id}`);
        if (!C.run) return note(`ℹ ${C.label} : ${C.desc}`);
        C.run(); return note(`✓ ${C.label}`);
      }
      if (a.do === "select") { const n = api.select(a.ids || []); return note(n ? `✓ ${n} objet${n > 1 ? "s" : ""} sélectionné${n > 1 ? "s" : ""}` : "✗ Objets introuvables"); }
      if (a.do === "zoom") { return note(api.zoomTo(a.ids || []) ? `✓ Vue centrée sur ${(a.ids || []).join(", ")}` : "✗ Objets introuvables"); }
      if (a.do === "rename") { return note(api.renameRoom(a.room, a.name) ? `✓ Pièce ${a.room} renommée « ${a.name} » (Ctrl+Z pour annuler)` : "✗ Pièce introuvable"); }
      if (a.do === "delete") return null; // jamais sans confirmation
      return note("✗ Action non reconnue");
    } catch (e) { return note("✗ " + e.message); }
    function note(t) { if (fromButton) log(t); return t; }
  }

  // ---------- envoi ----------
  async function ask(text, { image = null, show = null } = {}) {
    text = (text || "").trim();
    if (!text || busy) return;
    hist.push({ role: "user", text, show, image });
    save();

    if (!settings.activeProvider()) { offline(text); return; }

    busy = image ? "Analyse du plan…" : "Réflexion…"; render();
    try {
      const convo = hist.filter((m) => m.role === "user" || m.role === "assistant").slice(-MAX_SEND)
        .map((m, i, arr) => ({ role: m.role, text: m.role === "user" && m.hadImage ? m.text + "\n(image du plan envoyée précédemment)" : m.text, image: i === arr.length - 1 ? m.image : null }));
      // l'API veut une conversation qui commence par l'utilisateur
      while (convo.length && convo[0].role !== "user") convo.shift();
      const r = await chat({ system: systemPrompt(api, getCatalog()), messages: convo, maxTokens: image ? 2500 : 1500, think: !!image });
      const p = parseReply(r.text);
      const sug = p.suggest.slice(0, 8);
      // une suppression demandée en action devient un bouton à confirmer
      p.actions.filter((a) => a.do === "delete").forEach((a) => sug.push({ ...a, label: `Confirmer : supprimer ${(a.ids || []).length} objet(s)` }));
      hist.push({ role: "assistant", text: p.text || "(fait)", suggest: sug, meta: `${PROVIDERS[r.provider].name} · ${r.model} · ${(r.ms / 1000).toFixed(1)} s${image && !r.sawImage ? " · ce modèle ne voit pas les images" : ""}${r.switched ? ` · « ${r.switched} » retiré, remplacé automatiquement` : ""}` });
      busy = false; save(); render();
      for (const a of p.actions.filter((a) => a.do !== "delete")) { const t = runAction(a); if (t) hist.push({ role: "log", text: t }); }
      if (p.actions.length) { save(); render(); }
    } catch (e) {
      busy = false;
      hist.push({ role: "assistant", text: e.message, error: true, suggest: /Paramètres/.test(e.message) ? [{ do: "cmd", id: "ai.params", label: "Ouvrir les Paramètres" }] : [] });
      save(); render();
    }
  }

  function offline(text) {
    const res = searchCatalog(getCatalog(), text).slice(0, 4);
    let t = res.length
      ? "Sans clé IA, je cherche dans la liste des fonctions. Voici ce qui correspond :\n" + res.map((c) => `- **${c.label}**${c.keys ? " (" + c.keys + ")" : ""} : ${c.desc}`).join("\n")
      : "Sans clé IA, je ne trouve rien dans la liste des fonctions pour cette demande. Essayez d'autres mots, ou ajoutez une clé dans Paramètres.";
    const sug = res.filter((c) => c.run).slice(0, 3).map((c) => ({ do: "cmd", id: c.id, label: c.label }));
    sug.push({ do: "cmd", id: "ai.params", label: "Ajouter une clé IA" });
    hist.push({ role: "assistant", text: t, suggest: sug, meta: "Recherche locale (sans IA)" });
    save(); render();
  }

  async function analyse() {
    if (busy) return;
    if (!settings.activeProvider()) { hist.push({ role: "user", text: "Analyser le plan" }); hist.push({ role: "assistant", text: "L'analyse du plan demande une clé IA (Claude ou NVIDIA).", error: true, suggest: [{ do: "cmd", id: "ai.params", label: "Ouvrir les Paramètres" }] }); save(); render(); return; }
    busy = "Préparation de l'image du plan…"; render();
    let image = null;
    const prov = settings.activeProvider(), lim = PROVIDERS[prov].maxImageB64 || 0;
    try { image = await planImage(api, lim ? { width: 1280, maxB64: lim } : {}); } catch (e) { hist.push({ role: "log", text: "Image du plan impossible (" + e.message + ") : analyse sur les données seules." }); }
    busy = false;
    await ask(ANALYSE_PROMPT, { image, show: "📐 Analyse le plan (oublis, éclairage, prises, ce qui reste à dessiner)" });
  }

  form.onsubmit = (e) => { e.preventDefault(); const t = ta.value; ta.value = ""; ask(t); };
  ta.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } };
  el.querySelector(".as-an").onclick = analyse;
  el.querySelector(".as-clear").onclick = () => { hist = []; save(); render(); };

  paintProv(); render();
  return { ask, analyse, focus: () => ta.focus(), get history() { return hist; } };
}
