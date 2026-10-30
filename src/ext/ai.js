// Appels IA : Claude (Anthropic) ou NVIDIA, via le petit serveur local (/ai/...),
// qui ajoute la clé et contourne le blocage des appels directs depuis le navigateur.
// Version en ligne (pas de serveur local) : Claude est appelé directement depuis le navigateur (Anthropic l'autorise,
// la clé reste dans ce navigateur) ; NVIDIA bloque ces appels, il ne marche qu'en version locale.
// Format interne des messages : { role: "user" | "assistant", text, image?: { data, type } }.

import { settings } from "./settings.js";

export const PROVIDERS = {
  anthropic: {
    name: "Claude",
    models: ["claude-sonnet-5-5", "claude-haiku-5-5", "claude-opus-5-5"],
    defaultModel: "claude-sonnet-5-5",
    vision: () => true,
  },
  nvidia: {
    name: "NVIDIA",
    // Nemotron par défaut : la version « VL » lit les images (analyse du plan).
    // NVIDIA retire régulièrement des modèles : la liste à jour se charge depuis Paramètres,
    // et un modèle retiré est remplacé automatiquement (voir pickReplacement).
    models: ["nvidia/nemotron-3.5-super-vl-120b-a12b", "meta/llama-3.2-90b-vision-instruct", "meta/llama-3.3-70b-instruct"],
    defaultModel: "nvidia/nemotron-3.5-super-vl-120b-a12b",
    maxImageB64: 240000, // NVIDIA peut refuser les images trop lourdes envoyées directement (~180 Ko)
    vision: (model) => /vision|vl\b|-vl|multimodal/i.test(model),
  },
};

export class AIError extends Error {
  constructor(msg, status, raw) { super(msg); this.status = status; this.raw = raw || ""; }
}

function rawMsg(body) {
  return body?.error?.message || body?.detail || body?.message || (typeof body === "string" ? body : "");
}
function frenchError(status, body) {
  const raw = rawMsg(body);
  if (status === 401 || status === 403) return "Clé refusée par le fournisseur (vérifiez la clé dans Paramètres).";
  if (status === 404) return "Modèle introuvable chez ce fournisseur : choisissez-en un autre dans Paramètres." + (raw ? " (" + raw + ")" : "");
  if (status === 410) return "Ce modèle a été retiré par le fournisseur : choisissez-en un autre dans Paramètres (bouton « Charger les modèles »)." + (raw ? " (" + raw + ")" : "");
  if (status === 402) return "Crédits épuisés chez le fournisseur." + (raw ? " (" + raw + ")" : "");
  if (status === 429) return "Trop de demandes ou crédit épuisé chez le fournisseur. Réessayez dans un moment.";
  if (status === 0 || status === 502 || status === 504) return "Pas de connexion au fournisseur IA. " + (raw || "Le logiciel est-il bien lancé avec « npm run dev » ?");
  return `Erreur ${status}${raw ? " : " + raw : ""}`;
}

async function call(method, path, key, payload) {
  let res;
  try {
    res = await fetch(path, { method, headers: { "content-type": "application/json", ...(window.okteoSession ? {"x-okteo-user":window.okteoSession.user.id} : {}), ...(key ? { "x-okteo-key": key } : {}) }, body: payload ? JSON.stringify(payload) : undefined });
  } catch (e) {
    throw new AIError(frenchError(0, e.message), 0);
  }
  const txt = await res.text();
  let body; try { body = JSON.parse(txt); } catch { body = txt; }
  if (!res.ok) { if (window.okteoSession && res.status === 401) document.dispatchEvent(new CustomEvent("okteo:session-expired")); throw new AIError(window.okteoSession ? rawMsg(body) || "Service IA indisponible" : frenchError(res.status, body), res.status, rawMsg(body)); }
  return body;
}

// Liste des modèles réellement disponibles sur le compte (NVIDIA uniquement)
export async function listModels(provider = "nvidia") {
  if (provider !== "nvidia") return PROVIDERS[provider].models;
  const body = await call("GET", "/ai/nvidia/models", settings.get().keys.nvidia || "");
  const ids = (body.data || []).map((m) => m.id).filter(Boolean);
  // Nemotron d'abord, puis les modèles qui voient les images
  const rank = (id) => (/nemotron/i.test(id) ? 0 : 2) + (PROVIDERS.nvidia.vision(id) ? 0 : 1);
  return [...new Set(ids)].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

// Remplaçant d'un modèle retiré : un Nemotron qui voit les images, sinon un modèle vision, sinon un Nemotron
export function pickReplacement(ids, failed) {
  const ok = ids.filter((id) => id !== failed && !/embed|rerank|guard|safety|reward|parse|ocr|retriever|clip/i.test(id));
  const v = PROVIDERS.nvidia.vision;
  return ok.find((id) => /nemotron/i.test(id) && v(id)) || ok.find((id) => v(id)) || ok.find((id) => /nemotron/i.test(id)) || "";
}

// Les modèles qui « réfléchissent » (Nemotron…) renvoient parfois leur brouillon entre <think> et </think> : on l'enlève.
export const stripThink = (s) => String(s || "").replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/^[\s\S]*?<\/think>/i, "").trim();

async function nvidiaCall({ key, model, system, messages, maxTokens, think }) {
  const canSee = PROVIDERS.nvidia.vision(model);
  const msgs = [{ role: "system", content: system }, ...messages.map((m) => ({
    role: m.role,
    content: m.image && canSee
      ? [{ type: "text", text: m.text }, { type: "image_url", image_url: { url: `data:${m.image.type};base64,${m.image.data}` } }]
      : m.text,
  }))];
  const payload = { model, max_tokens: think ? Math.max(maxTokens, 4000) : maxTokens, temperature: 0.6, top_p: 0.95, messages: msgs };
  // Nemotron : réflexion activée seulement quand elle sert (analyse du plan), sinon réponse directe et plus rapide
  if (/nemotron/i.test(model)) payload.chat_template_kwargs = { enable_thinking: !!think };
  try {
    return await call("POST", "/ai/nvidia", key, payload);
  } catch (e) {
    // modèle qui ne connaît pas ce réglage : on réessaie sans
    if (e.status === 400 && payload.chat_template_kwargs && /chat_template|enable_thinking|kwargs/i.test(e.raw)) {
      delete payload.chat_template_kwargs;
      return await call("POST", "/ai/nvidia", key, payload);
    }
    throw e;
  }
}

// Claude : par le serveur local s'il tourne, sinon directement (version en ligne)
const NO_RELAY = new Set([0, 404, 405, 501]);
async function anthropicDirect(key, payload) {
  if (!key) throw new AIError("Version en ligne : ajoutez votre clé Claude (Anthropic) dans l'onglet Paramètres.", 401);
  let res;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }, body: JSON.stringify(payload) });
  } catch (e) {
    throw new AIError("Pas de connexion à Claude (" + e.message + ").", 0);
  }
  const txt = await res.text();
  let body; try { body = JSON.parse(txt); } catch { body = txt; }
  if (!res.ok) { if (window.okteoSession && res.status === 401) document.dispatchEvent(new CustomEvent("okteo:session-expired")); throw new AIError(window.okteoSession ? rawMsg(body) || "Service IA indisponible" : frenchError(res.status, body), res.status, rawMsg(body)); }
  return body;
}
async function anthropicCall(key, payload) {
  const env = settings.env || {};
  if (window.okteoSession) return call("POST", "/ai/anthropic", "", payload);
  if (env.checked && !env.online) return anthropicDirect(key, payload);
  try { return await call("POST", "/ai/anthropic", key, payload); }
  catch (e) { if (NO_RELAY.has(e.status) && key) return anthropicDirect(key, payload); throw e; }
}
export const relayOnline = () => !!(settings.env && settings.env.online);

// Envoie une conversation ; renvoie { text, provider, model, ms, sawImage, switched? }.
export async function chat({ system, messages, maxTokens = 1800, provider, model, think = false }) {
  const s = settings.get();
  provider = window.okteoSession ? "anthropic" : provider || settings.activeProvider();
  if (!provider) throw new AIError("Aucune clé IA : ajoutez une clé Claude ou NVIDIA dans l'onglet Paramètres.", 0);
  model = model || s.models[provider] || PROVIDERS[provider].defaultModel;
  const key = s.keys[provider] || "";
  const t0 = performance.now();
  let text, switched = "", usage = null;

  if (provider === "anthropic") {
    const msgs = messages.map((m) => ({
      role: m.role,
      content: m.image
        ? [{ type: "image", source: { type: "base64", media_type: m.image.type, data: m.image.data } },
          // v61 : images supplémentaires (zooms de la relecture ciblée), chacune précédée de son nom
          ...(m.images || []).flatMap((im) => [{ type: "text", text: im.label || "Image" }, { type: "image", source: { type: "base64", media_type: im.type, data: im.data } }]),
          { type: "text", text: m.text }]
        : m.text,
    }));
    const body = await anthropicCall(key, { model, max_tokens: maxTokens, system, messages: msgs });
    if(window.okteoSession){ model=body.okteo?.model||body.model||model;document.dispatchEvent(new CustomEvent("okteo:ai-cost")); }
    text = (body.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
    if (body.usage) usage = { in: body.usage.input_tokens || 0, out: body.usage.output_tokens || 0 };
  } else {
    const env = settings.env || {};
    if (env.checked && !env.online) throw new AIError("NVIDIA ne marche que dans la version locale du logiciel (NVIDIA bloque les appels depuis un site en ligne). En ligne, utilisez une clé Claude (Paramètres).", 0);
    let body;
    try {
      body = await nvidiaCall({ key, model, system, messages, maxTokens, think });
    } catch (e) {
      // modèle retiré (410) ou absent (404) : on prend le meilleur remplaçant disponible, on le retient, on réessaie une fois
      if (e.status !== 410 && e.status !== 404) throw e;
      let ids = [];
      try { ids = await listModels("nvidia"); } catch { throw e; }
      const repl = pickReplacement(ids, model);
      if (!repl) throw e;
      switched = model;
      model = repl;
      settings.set({ models: { ...settings.get().models, nvidia: repl } });
      body = await nvidiaCall({ key, model, system, messages, maxTokens, think });
    }
    text = body.choices?.[0]?.message?.content || "";
    if (body.usage) usage = { in: body.usage.prompt_tokens || 0, out: body.usage.completion_tokens || 0 };
  }
  text = stripThink(text);
  return { text: text || "(réponse vide)", provider, model, ms: Math.round(performance.now() - t0), sawImage: PROVIDERS[provider].vision(model), switched, usage };
}

// Test de connexion depuis les Paramètres
export async function testProvider(provider) {
  return chat({ provider, system: "Tu réponds en un seul mot.", messages: [{ role: "user", text: "Réponds simplement : OK" }], maxTokens: 10 });
}

// Le serveur local a-t-il des clés dans .env ?
export async function serverStatus() {
  try { const r = await fetch("/ai/status"); if (!r.ok) return { online: false }; return { online: true, ...(await r.json()) }; }
  catch { return { online: false }; }
}
