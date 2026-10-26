// Paramètres (onglet « Paramètres ») : clés IA, fournisseur, modèles.
// Les clés sont rangées dans le navigateur de CE PC (localStorage), jamais dans le chantier ni dans l'export.
// Une clé placée dans le fichier .env du projet est aussi acceptée (le serveur local l'ajoute lui-même).

import { CAB_DEFAULTS, CAB_FIELDS, PROTS, SECTIONS, getCab, resetCab, setCab } from "../cablage/settings.js";
import { esc, store, storeSet } from "./util.js";

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
export function mountParams(el, { PROVIDERS, testProvider, serverStatus, listModels }) {
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

  function render() {
    el.innerHTML = `<div class="params-in">
      <h2>Paramètres</h2>
      <section>
        <h3>Intelligence artificielle</h3>
        <p class="mut">Une seule clé suffit. Elle sert à l'assistant (panneau de droite) et à l'analyse du plan.
        La clé reste sur ce PC ; elle passe par le serveur local lancé avec <code>npm run dev</code>, puis directement chez le fournisseur.</p>
        ${!envKeys.checked || envKeys.online ? "" : `<p class="warn">Serveur local introuvable : lancez le logiciel avec <code>npm run dev</code> (l'IA ne marche pas en ouvrant le fichier directement).</p>`}
        <div class="pcards">${card("anthropic")}${card("nvidia")}</div>
        <h3 style="margin-top:18px">Fournisseur utilisé par l'assistant</h3>
        <div class="prov">${provHTML()}</div>
        <p class="mut">Conseil : Claude pour l'analyse du plan (meilleure lecture des images). NVIDIA : Nemotron 3.5 Super VL par défaut (gratuit dans la limite des crédits, voit le plan). Si NVIDIA retire un modèle, Oktéo en choisit un autre tout seul. Un modèle sans « VL » ou « vision » ne lit que la liste des objets, pas l'image.</p>
      </section>
      <section class="cab-set" id="cab-set">${cabHTML()}</section>
      <section class="later">
        <h3>À venir</h3>
        <p class="mut">Règles par pavillonneur · Calcul des boîtes et des gaines (utilise les réglages ci-dessus).</p>
      </section>
    </div>`;
    wire();
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
      return `<label class="cab-row${changed}" title="Valeur de base : ${esc(String(d).replace(".", ","))} ${esc(unit)}"><span>${esc(label)}</span><span class="cab-ctl">${ctl}<span class="mut">${esc(unit)}</span></span></label>`;
    };
    return `<h3>Câblage (pieuvre)</h3>
      <p class="mut">Valeurs de base décidées avec le bureau d'études ; elles servent à la répartition des circuits (onglet Câblage du panneau de droite) et, bientôt, au calcul des boîtes et des gaines. Une valeur modifiée est surlignée ; l'infobulle donne la valeur de base.</p>
      <div class="cab-grid">${CAB_FIELDS.map(([g, rows]) => `<fieldset><legend>${esc(g)}</legend>${rows.map(input).join("")}</fieldset>`).join("")}</div>
      <button id="cab-reset" title="Remettre toutes les valeurs de base">Valeurs de base</button>`;
  }
  function wireCab() {
    const box = el.querySelector("#cab-set"); if (!box) return;
    box.querySelectorAll("[data-cab]").forEach((c) => (c.onchange = () => {
      const k = c.dataset.cab, t = typeof CAB_DEFAULTS[k];
      const v = c.type === "checkbox" ? c.checked : t === "number" ? parseFloat(String(c.value).replace(",", ".")) : c.value.trim();
      if (t === "number" && !(v >= 0)) { c.value = getCab()[k]; return; }
      setCab({ [k]: v }); c.closest(".cab-row").classList.toggle("chg", v !== CAB_DEFAULTS[k]);
    }));
    box.querySelector("#cab-reset").onclick = () => { resetCab(); box.innerHTML = cabHTML(); wireCab(); };
  }

  function wire() {
    wireCab();
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
  return { render };
}
