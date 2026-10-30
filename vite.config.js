// Serveur local Oktéo AI (Vite) + relais IA.
// Le navigateur ne peut pas appeler directement Anthropic ou NVIDIA (blocage CORS, et la clé serait exposée).
// Le logiciel appelle donc /ai/anthropic ou /ai/nvidia sur ce serveur local, qui ajoute la clé et transmet.
// Clé : celle saisie dans Paramètres (en-tête x-okteo-key), sinon celle du fichier .env.
import { defineConfig, loadEnv } from "vite";

function aiRelay(env) {
  const get = (k) => process.env[k] || env[k] || "";
  const UP = {
    anthropic: () => (get("OKTEO_ANTHROPIC_URL") || "https://api.anthropic.com") + "/v1/messages",
    nvidia: () => (get("OKTEO_NVIDIA_URL") || "https://integrate.api.nvidia.com") + "/v1/chat/completions",
  };

  const readBody = (req) => new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on("data", (c) => { size += c.length; if (size > 25e6) { reject(new Error("Requête trop grosse")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
  const send = (res, status, obj) => { res.statusCode = status; res.setHeader("content-type", "application/json"); res.end(typeof obj === "string" ? obj : JSON.stringify(obj)); };

  async function handler(req, res, next) {
    if (!req.url.startsWith("/ai/")) return next();
    const route = req.url.slice(4).split("?")[0];
    if (route === "status" && req.method === "GET")
      return send(res, 200, { anthropic: !!get("ANTHROPIC_API_KEY"), nvidia: !!get("NVIDIA_API_KEY") });
    // liste des modèles disponibles sur le compte NVIDIA
    if (route === "nvidia/models" && req.method === "GET") {
      const key = String(req.headers["x-okteo-key"] || "") || get("NVIDIA_API_KEY");
      if (!key) return send(res, 401, { error: { message: "Aucune clé (Paramètres ou .env)" } });
      try {
        const up = await fetch((get("OKTEO_NVIDIA_URL") || "https://integrate.api.nvidia.com") + "/v1/models", { headers: { authorization: "Bearer " + key, accept: "application/json" } });
        return send(res, up.status, await up.text());
      } catch (e) { return send(res, 502, { error: { message: e.message } }); }
    }
    if (!UP[route] || req.method !== "POST") return send(res, 404, { error: { message: "Route IA inconnue" } });

    const key = String(req.headers["x-okteo-key"] || "") || get(route === "anthropic" ? "ANTHROPIC_API_KEY" : "NVIDIA_API_KEY");
    if (!key) return send(res, 401, { error: { message: "Aucune clé (Paramètres ou .env)" } });
    try {
      const body = await readBody(req);
      const headers = { "content-type": "application/json" };
      if (route === "anthropic") { headers["x-api-key"] = key; headers["anthropic-version"] = "2023-06-01"; }
      else { headers["authorization"] = "Bearer " + key; headers["accept"] = "application/json"; }
      const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 120000);
      const up = await fetch(UP[route](), { method: "POST", headers, body, signal: ctrl.signal });
      clearTimeout(to);
      send(res, up.status, await up.text());
    } catch (e) {
      send(res, e.name === "AbortError" ? 504 : 502, { error: { message: e.name === "AbortError" ? "Le fournisseur n'a pas répondu à temps." : e.message } });
    }
  }
  return {
    name: "okteo-ai-relay",
    configureServer(server) { server.middlewares.use(handler); },
    configurePreviewServer(server) { server.middlewares.use(handler); },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // deux pages : le logiciel (index.html) et la bande de câblage pour téléphone (bande.html, ouverte par le QR code)
  return { base: "./", define: mode === "enterprise" ? { "import.meta.env.VITE_OKTEO_ENTERPRISE": JSON.stringify("true") } : {}, plugins: [aiRelay(env)], server: { open: false },
    build: { rollupOptions: { input: { main: "index.html", bande: "bande.html" } } } };
});
