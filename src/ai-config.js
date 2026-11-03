// v76 : réglage IA partagé par le navigateur (src/ext/ai.js) et le Worker Cloudflare (server/worker.js, regroupé par
// esbuild). Un seul endroit pour le modèle de l'analyse : « Analyser le plan », relevé IA (4 modes) et relectures.
// Décision de Kévin (03/11/2026) : l'analyse utilise uniquement Claude Opus 5.5, sans choix possible dans Paramètres
// ni dans la fenêtre Budget de l'administrateur. La conversation de l'assistant (Sonnet) garde son propre réglage.
export const ANALYSE_MODEL = "claude-opus-5-5";
// Tarif public d'Opus 5.5 vérifié le 03/11/2026 (platform.claude.com, Models overview) : USD par million de tokens.
// Sert de valeur par défaut ; l'administrateur peut l'ajuster si Anthropic change ses prix (la facture fait foi).
export const ANALYSE_PRICE = { input: 4, output: 20 };
