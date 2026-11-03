// v76 : réglage IA partagé par le navigateur (src/ext/ai.js) et le Worker Cloudflare (server/worker.js, regroupé par
// esbuild). Un seul endroit pour le modèle de l'analyse : « Analyser le plan », relevé IA (4 modes) et relectures.
// Décision de Kévin (03/11/2026) : l'analyse utilise uniquement Claude Opus 5.5, sans choix possible dans Paramètres
// ni dans la fenêtre Budget de l'administrateur. La conversation de l'assistant (Sonnet) garde son propre réglage.
export const ANALYSE_MODEL = "claude-opus-5-5";
// Tarif public d'Opus 5.5 vérifié le 03/11/2026 (platform.claude.com : Models overview, page Opus 5.5, Prompt caching),
// en USD par million de tokens : entrée 4, sortie 20, écriture du cache (5 min) 5, lecture du cache 0,20.
// Sert de valeur par défaut ; l'administrateur peut ajuster entrée / sortie si Anthropic change ses prix (la facture fait foi).
export const ANALYSE_PRICE = { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 };
// rapports du cache à l'entrée, pour appliquer un prix d'entrée réglé par l'administrateur (écriture 1,25 ×, lecture 0,05 ×)
export const CACHE_RATIO = { write: 1.25, read: 0.05 };
// Limites d'image vérifiées le 03/11/2026 (doc Vision) : au-delà de 1 568 px de grand côté ou ~1,15 Mpx, l'API réduit l'image
// (aucun gain de qualité) ; plus de 20 images dans une requête = 2 000 × 2 000 px au plus.
export const IMAGE_LIMITS = { maxSide: 1568, maxPixels: 1150000, manyImages: 20 };
