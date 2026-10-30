// Paramètres (onglet « Paramètres »), v42 : sommaire à gauche et une section par thème —
// Affichage (préférences de ce PC), Assistant et relevé IA (clés, fournisseur, modèles), Câblage (règles de la pieuvre),
// Packs (renvoi vers le panneau Packs) ; champ « Chercher un réglage ».
// Les clés sont rangées dans le navigateur de CE PC (localStorage), jamais dans le chantier ni dans l'export.
// Une clé placée dans le fichier .env du projet est aussi acceptée (le serveur local l'ajoute lui-même).

import { CAB_DEFAULTS, CAB_FIELDS, PROTS, SECTIONS, getCab, resetCab, setCab } from "../cablage/settings.js";
import { esc, store, storeSet } from "./util.js";
import { getPrefs, setPref, PREFS_DEFAULTS } from "../prefs.js";
import { mountRegles } from "./regles-ui.js";
import { CAB_RULES } from "../cablage/regles.js";

// préférences d'affichage : [clé, libellé, aide]
  const PREF_FIELDS = [
    ["ouvrants", "Afficher les ouvrants", "Battants et arcs. Les passages restent ouverts lorsque cette option est désactivée."],
    ["parcours", "Afficher les parcours complets", "Alimentations et lignes directes : afficher le trajet à la place des flèches. Les données de câblage sont conservées."],
  ["surfaces", "Afficher la surface des pièces (m²)", "Sur le plan, dans les panneaux, au relevé des pièces et à l'impression. La surface reste calculée (nombre de prises de la norme pour le séjour)."],
  ["halos", "Halo orange autour des appareils à vérifier", "Contrôle permanent : commande sans lumière, lumière sans commande, va-et-vient incomplet, appareil sans circuit, allumage coupé entre deux boîtes. Le compteur ⚠ en haut reste toujours actif."],
];

const KEY = "okteo.settings.v1";
const DEF = { provider: "", keys: { anthropic: "", nvidia: "" }, models: { anthropic: "", nvidia: "" } };
let envKeys = { anthropic: false, nvidia: false, online: false, checked: false };
const listeners = new Set();

export const settings = {
  get() { const s = store(KEY, DEF); return { ...DEF, ...s, keys: { ...DEF.keys, ...(s.keys || {}) }, models: { ...DEF.models, ...(s.models || {}) } }; },
  set(patch) { const s = { ...this.get(), ...patch }; storeSet(KEY, s); listeners.forEach((f) => f(s)); return s; },
  hasKey(p) { return !!(this.get().keys[p] || envKeys[p]); },
  // fournisseur utilisé : celui choisi s'il a une clé, sinon le premier qui en a une
  activeProvider() {
    const s = this.get();
    // version en ligne (pas de serveur local) : NVIDIA ne passe pas, Claude d'abord s'il a une clé
    if (envKeys.checked && !envKeys.online && s.provider === "nvidia" && this.hasKey("anthropic")) return "anthropic";
    if (s.provider && this.hasKey(s.provider)) return s.provider;
    return ["anthropic", "nvidia"].find((p) => this.hasKey(p)) || "";
  },
  setEnv(e) { envKeys = { ...envKeys, ...e, checked: true }; listeners.forEach((f) => f(this.get())); },
  get env() { return envKeys; },
  onChange(f) { listeners.add(f); },
};

// ---------- page Paramètres ----------
export function mountParams(el, { PROVIDERS, testProvider, serverStatus, listModels, openPacks, api, askRule }) {
  let regles = null;
  const card = (p) => {
    const P = PROVIDERS[p], s = settings.get();
    const env = envKeys[p] ? `<span class="okk">clé trouvée dans .env</span>` : "";
    return `<div class="pcard" data-p="${p}">
      <div class="pcard-h"><b>${P.name}</b> <span class="mut">${p === "anthropic" ? "Anthropic · console.anthropic.com · payant" : "build.nvidia.com · Nemotron · crédits gratuits"}</span> ${env}</div>
      <label class="f">Clé API
        <span class="keyrow"><input type="password" class="k" autocomplete="off" spellcheck="false" placeholder="${p === "anthropic" ? "sk-ant-…" : "nvapi-…"}" value="${esc(s.keys[p])}">
        <button class="eye" title="Afficher / masquer">👁</button><button class="clr" title="Effacer la clé de ce PC">Effacer</button></span></label>
      <label class="f">Modèle
        <input class="m" list="dl-${p}" placeholder="${P.defaultModel}" value="${esc(s.models[p])}">
        <datalist id="dl-${p}">${P.models.map((m) => `<option value="${m}">`).join("")}</datalist></label>
      <div class="trow"><button class="tst">Tester la connexion</button>${p === "nvidia" ? `<button class="lst" title="Lire chez NVIDIA la liste des modèles disponibles sur ce compte">Charger les modèles</button>` : ""}<span class="tres"></span></div>
    </div>`;
  };

  const provHTML = () => {
    const act = settings.activeProvider();
    return ["anthropic", "nvidia"].map((p) => `<label class="radio ${settings.hasKey(p) ? "" : "dis"}"><input type="radio" name="prov" value="${p}" ${act === p ? "checked" : ""} ${settings.hasKey(p) ? "" : "disabled"}> ${PROVIDERS[p].name}${settings.hasKey(p) ? "" : " <span class=\"mut\">(pas de clé)</span>"}</label>`).join("");
  };
  // mise à jour partielle : ne pas reconstruire les cartes pendant qu'on clique dedans
  function refreshProv() {
    const box = el.querySelector(".prov"); if (!box) return;
    box.innerHTML = provHTML();
    box.querySelectorAll('input[name="prov"]').forEach((r) => (r.onchange = () => settings.set({ provider: r.value })));
  }

  const SECS = () => [
    ["ps-aff", "Affichage"], ["ps-ia", "Assistant et relevé IA"],
    ["ps-regles", "Bibliothèque des règles"], ["cab-set", "Câblage"], ...CAB_FIELDS.map(([g], i) => ["ps-cab-" + i, g, true]), ["ps-packs", "Packs"],
  ];
  function prefHTML() {
    const v = getPrefs();
    return `<h3>Affichage</h3>
      <p class="mut">Préférences de ce PC, pour tous les chantiers. Cotes, repères, fond, taille des symboles et thème : menu <b>Affichage</b> en haut de l'écran.</p>
      <div class="pset-rows">${PREF_FIELDS.map(([k, label, help]) => `<label class="cab-row pref-row${v[k] !== PREFS_DEFAULTS[k] ? " chg" : ""}" title="${esc(help)}"><span>${esc(label)}<small class="mut">${esc(help)}</small></span><span class="cab-ctl"><input type="checkbox" data-pref="${k}" ${v[k] ? "checked" : ""}></span></label>`).join("")}</div>`;
  }

  function render() {
    const q = el.querySelector(".pset-find")?.value || ""; // la recherche en cours survit à un nouvel affichage
    el.innerHTML = `<div class="params-in pset">
      <div class="pset-head"><h2>Paramètres</h2><input type="search" class="pset-find" placeholder="Chercher un réglage… (ex. couleur, prise, gaine)" aria-label="Chercher un réglage"></div>
      <div class="pset-wrap">
        <nav class="pset-nav" aria-label="Sommaire des paramètres">${SECS().map(([id, t, sub]) => `<a href="#${id}" data-to="${id}" class="${sub ? "sub" : ""}">${esc(t)}</a>`).join("")}</nav>
        <div class="pset-body">
      <section class="pset-sec" id="ps-aff">${prefHTML()}</section>
      <section class="pset-sec" id="ps-ia">
        <h3>Assistant et relevé IA</h3>
        <p class="mut">Une seule clé suffit. Elle sert à l'assistant (encart en bas à droite du plan), à l'analyse du plan et au relevé par l'IA.
        La clé reste sur ce PC ; elle passe par le serveur local lancé avec <code>npm run dev</code>, puis directement chez le fournisseur.</p>
        ${!envKeys.checked || envKeys.online ? "" : `<p class="warn">Serveur local introuvable : lancez le logiciel avec <code>npm run dev</code> (l'IA ne marche pas en ouvrant le fichier directement).</p>`}
        <div class="pcards">${card("anthropic")}${card("nvidia")}</div>
        <h4>Fournisseur utilisé par l'assistant</h4>
        <div class="prov">${provHTML()}</div>
        <label class="cab-row" id="ps-relect" title="Avec une clé : après un relevé IA, Oktéo renvoie à l'IA les points signalés par le contrôle (lumière sans commande…). Arrêt quand il n'y a plus rien à revoir ou qu'une relecture ne corrige rien ; 3 min au plus par appel ; bouton Arrêter."><span>Relectures automatiques par l'IA<small class="mut">0 = jamais (relecture à la main seulement), 3 au plus. Chaque relecture coûte un appel à l'IA.</small></span><span class="cab-ctl"><input type="number" min="0" max="3" step="1" id="pref-relect" value="${getPrefs().relectures}"></span></label>
        <h4 id="ps-couts">Coûts d'un chantier</h4>
        <p class="mut sm">Pour chiffrer chaque chantier (mode IA, rapport de l'analyse IA) : jetons de l'IA comptés à chaque appel avec une clé, temps de travail BE compté quand le logiciel est utilisé. Laisser 0 = non chiffré.</p>
        <label class="cab-row" title="Prix de votre fournisseur IA pour 1 million de jetons envoyés (image + consigne). Voir sa grille tarifaire : les prix changent selon le modèle."><span>Prix des jetons d'entrée<small class="mut">€ par million de jetons</small></span><span class="cab-ctl"><input type="number" min="0" step="0.01" data-cost="prixIn" value="${getPrefs().prixIn}"></span></label>
        <label class="cab-row" title="Prix pour 1 million de jetons de réponse de l'IA"><span>Prix des jetons de sortie<small class="mut">€ par million de jetons</small></span><span class="cab-ctl"><input type="number" min="0" step="0.01" data-cost="prixOut" value="${getPrefs().prixOut}"></span></label>
        <label class="cab-row" title="Coût horaire chargé du technicien BE : multiplié par le temps de travail compté sur le chantier"><span>Coût horaire du technicien BE<small class="mut">€ / h</small></span><span class="cab-ctl"><input type="number" min="0" step="0.5" data-cost="tauxHoraire" value="${getPrefs().tauxHoraire}"></span></label>
        <p class="mut">Conseil : Claude pour l'analyse du plan (meilleure lecture des images). NVIDIA : Nemotron 3.5 Super VL par défaut (gratuit dans la limite des crédits, voit le plan). Si NVIDIA retire un modèle, Oktéo en choisit un autre tout seul. Un modèle sans « VL » ou « vision » ne lit que la liste des objets, pas l'image.</p>
      </section>
      <section class="pset-sec" id="ps-regles"></section>
      <section class="pset-sec cab-set" id="cab-set">${cabHTML()}</section>
      <section class="pset-sec" id="ps-packs">
        <h3>Packs</h3>
        <p class="mut">L'appareillage type de chaque pièce (chambre, séjour, cuisine…) se règle dans le panneau <b>Packs</b>, bouton « Modifier les packs… ». Communs à tous les chantiers de ce PC.</p>
        <button class="ps-open-packs">▦ Ouvrir le panneau Packs</button>
      </section>
      <p class="pset-none mut" hidden>Aucun réglage ne correspond à cette recherche.</p>
        </div>
      </div>
    </div>`;
    regles = mountRegles(el.querySelector("#ps-regles"), { api, ask: askRule });
    wire();
    if (q) { el.querySelector(".pset-find").value = q; find(q); }
  }

  // ---------- réglages du câblage ----------
  function cabHTML() {
    const v = getCab();
    const input = ([k, label, unit, type]) => {
      const val = v[k], d = CAB_DEFAULTS[k], changed = val !== d ? " chg" : "";
      let ctl;
      if (type === "bool") ctl = `<input type="checkbox" data-cab="${k}" ${val ? "checked" : ""}>`;
      else if (type === "sec") ctl = `<select data-cab="${k}">${SECTIONS.map((x) => `<option value="${x}" ${x === val ? "selected" : ""}>${String(x).replace(".", ",")}</option>`).join("")}</select>`;
      else if (type === "prot") ctl = `<select data-cab="${k}">${PROTS.map((x) => `<option value="${x}" ${x === val ? "selected" : ""}>${x}</option>`).join("")}</select>`;
      else ctl = `<input data-cab="${k}" ${type === "txt" ? "" : `type="number" step="${type === "int" ? 1 : "any"}" min="0"`} value="${esc(String(val))}">`;
      const rg = (CAB_RULES[k] || []).map((id) => `<a href="#" class="rg-link" data-rule="${id}" title="Voir la règle ${id} dans le journal">${id}</a>`).join("");
      return `<label class="cab-row${changed}" title="Valeur de base : ${esc(String(d).replace(".", ","))} ${esc(unit)}"><span>${esc(label)}${rg ? ` <span class="rg-links">${rg}</span>` : ""}</span><span class="cab-ctl">${ctl}<span class="mut">${esc(unit)}</span></span></label>`;
    };
    return `<div class="pset-h"><h3>Câblage</h3><button id="cab-reset" title="Remettre toutes les valeurs de base du câblage">Valeurs de base</button></div>
      <p class="mut">Règles de la pieuvre décidées avec le bureau d'études : circuits, couleurs, boîtes, gaines. Une valeur modifiée est surlignée ; l'infobulle donne la valeur de base.</p>
      ${CAB_FIELDS.map(([g, rows, help], i) => `<div class="pset-grp" id="ps-cab-${i}"><h4>${esc(g)}</h4>${help ? `<p class="mut sm">${esc(help)}</p>` : ""}<div class="pset-rows">${rows.map(input).join("")}</div></div>`).join("")}`;
  }
  function wireCab() {
    const box = el.querySelector("#cab-set"); if (!box) return;
    box.querySelectorAll("[data-cab]").forEach((c) => (c.onchange = () => {
      const k = c.dataset.cab, t = typeof CAB_DEFAULTS[k];
      const v = c.type === "checkbox" ? c.checked : t === "number" ? parseFloat(String(c.value).replace(",", ".")) : c.value.trim();
      if (t === "number" && !(v >= 0)) { c.value = getCab()[k]; return; }
      setCab({ [k]: v }); c.closest(".cab-row").classList.toggle("chg", v !== CAB_DEFAULTS[k]);
    }));
    box.querySelectorAll(".rg-link").forEach((a) => (a.onclick = (e) => { e.preventDefault(); e.stopPropagation(); regles && regles.open(a.dataset.rule); }));
    box.querySelector("#cab-reset").onclick = () => { resetCab(); box.innerHTML = cabHTML(); wireCab(); };
  }

  // recherche : garde les lignes dont le libellé contient tous les mots tapés ; masque les groupes vides
  const norm = (t) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  function find(q) {
    const words = norm(q).split(/\s+/).filter(Boolean), hit = (t) => words.every((w) => norm(t).includes(w));
    let any = false;
    el.querySelectorAll(".pset-sec").forEach((sec) => {
      const rows = [...sec.querySelectorAll(".cab-row")];
      let n = 0;
      if (rows.length) {
        rows.forEach((r) => { const ok = !words.length || hit(r.textContent + " " + (r.title || "") + " " + (r.closest(".pset-grp")?.querySelector("h4")?.textContent || "")); r.hidden = !ok; if (ok) n++; });
        sec.querySelectorAll(".pset-grp").forEach((g) => { g.hidden = !g.querySelector(".cab-row:not([hidden])"); });
      } else n = !words.length || hit(sec.textContent) ? 1 : 0;
      sec.hidden = !n; if (n) any = true;
    });
    el.querySelector(".pset-none").hidden = any;
  }

  function wire() {
    wireCab();
    el.querySelectorAll("[data-cost]").forEach((c) => (c.onchange = () => { const v = Math.max(0, +String(c.value).replace(",", ".") || 0); c.value = v; setPref(c.dataset.cost, v); }));
    const rl = el.querySelector("#pref-relect"); if (rl) rl.onchange = () => { const v = Math.max(0, Math.min(3, Math.round(+rl.value || 0))); rl.value = v; setPref("relectures", v); };
    el.querySelectorAll("[data-pref]").forEach((c) => (c.onchange = () => { setPref(c.dataset.pref, c.checked); c.closest(".cab-row").classList.toggle("chg", c.checked !== PREFS_DEFAULTS[c.dataset.pref]); }));
    const fi = el.querySelector(".pset-find");
    fi.oninput = () => find(fi.value);
    el.querySelectorAll(".pset-nav a").forEach((a) => (a.onclick = (e) => { e.preventDefault(); if (fi.value) { fi.value = ""; find(""); } el.querySelector("#" + a.dataset.to)?.scrollIntoView({ behavior: "smooth", block: "start" }); }));
    el.querySelector(".ps-open-packs").onclick = () => openPacks && openPacks();
    el.querySelectorAll(".pcard").forEach((c) => {
      const p = c.dataset.p, k = c.querySelector(".k"), m = c.querySelector(".m"), res = c.querySelector(".tres");
      k.onchange = () => { const s = settings.get(); settings.set({ keys: { ...s.keys, [p]: k.value.trim() }, provider: s.provider || p }); refreshProv(); };
      m.onchange = () => { const s = settings.get(); settings.set({ models: { ...s.models, [p]: m.value.trim() } }); };
      c.querySelector(".eye").onclick = () => { k.type = k.type === "password" ? "text" : "password"; };
      c.querySelector(".clr").onclick = () => { const s = settings.get(); settings.set({ keys: { ...s.keys, [p]: "" } }); render(); };
      c.querySelector(".tst").onclick = async () => {
        // enregistrer ce qui vient d'être tapé avant de tester
        const s = settings.get(); settings.set({ keys: { ...s.keys, [p]: k.value.trim() }, models: { ...s.models, [p]: m.value.trim() }, provider: s.provider || p });
        refreshProv();
        if (!settings.hasKey(p)) { res.className = "tres bad"; res.textContent = "Entrez d'abord une clé."; return; }
        res.className = "tres"; res.textContent = "Test en cours…";
        try {
          const r = await testProvider(p); res.className = "tres good";
          res.textContent = `✓ Connecté · ${r.model} · ${r.ms} ms` + (r.switched ? ` (« ${r.switched} » retiré par le fournisseur : remplacé automatiquement)` : "");
          if (r.switched) m.value = r.model;
        }
        catch (e) { res.className = "tres bad"; res.textContent = "✗ " + e.message; }
      };
      const lst = c.querySelector(".lst");
      if (lst) lst.onclick = async () => {
        const s = settings.get(); settings.set({ keys: { ...s.keys, [p]: k.value.trim() } });
        if (!settings.hasKey(p)) { res.className = "tres bad"; res.textContent = "Entrez d'abord une clé."; return; }
        res.className = "tres"; res.textContent = "Lecture de la liste…";
        try {
          const ids = await listModels(p);
          c.querySelector("datalist").innerHTML = ids.map((id) => `<option value="${esc(id)}">${PROVIDERS[p].vision(id) ? "voit les images" : "texte seul"}</option>`).join("");
          const nem = ids.filter((id) => /nemotron/i.test(id)).length, vis = ids.filter((id) => PROVIDERS[p].vision(id)).length;
          res.className = "tres good"; res.textContent = `✓ ${ids.length} modèles (${nem} Nemotron, ${vis} qui voient les images) : cliquez dans « Modèle » pour choisir.`;
        } catch (e) { res.className = "tres bad"; res.textContent = "✗ " + e.message; }
      };
    });
    refreshProv();
  }

  serverStatus().then((st) => { settings.setEnv({ online: !!st.online, anthropic: !!st.anthropic, nvidia: !!st.nvidia }); render(); });
  render();
  return { render, get regles() { return regles; } };
}
