// v76 : modes d'« Analyse IA » et journal des analyses (pur, sans navigateur) : node scripts/ai-modes.test.mjs
import assert from "node:assert/strict";
import { MODES_IA, MODES_PAGE, modeOf, dossierRef, dotsLabel, launchState } from "../src/walls/ai-modes.js";
import { analysesOf, callCost, newAnalyseId, fmtUsd, fmtMs } from "../src/walls/ai-journal.js";
import { ANALYSE_MODEL, ANALYSE_PRICE } from "../src/ai-config.js";

let n = 0;
const t = (name, fn) => { fn(); n++; console.log("✓ " + name); };

t("constante unique : Opus 5.5 au tarif public vérifié", () => {
  assert.equal(ANALYSE_MODEL, "claude-opus-5-5");
  assert.deepEqual(ANALYSE_PRICE, { input: 4, output: 20 });
});
t("4 modes, points 1 à 4, textes validés, cycles : réglage pour le mode 1, 3 pour les modes 2 à 4", () => {
  assert.deepEqual(MODES_IA.map((m) => [m.n, m.pts]), [[1, 1], [2, 2], [3, 3], [4, 4]]);
  assert.deepEqual(MODES_IA.map((m) => m.title), ["Analyse standard", "Analyse renforcée", "Plan dégradé", "Analyse approfondie"]);
  assert.equal(modeOf(1).hook, "Le mode rapide pour les plans propres.");
  assert.match(modeOf(4).desc, /devis, le plan cuisine/);
  assert.equal(modeOf(1).cycles, null);
  assert.deepEqual(MODES_IA.slice(1).map((m) => m.cycles), [3, 3, 3]);
  assert.match(MODES_PAGE.foot, /ne garantit pas une détection complète/);
  assert.equal(modeOf(9), null);
});
t("référence du dossier dynamique", () => {
  assert.equal(dossierRef({ nom: "EVRARD", numero: "04949" }), "EVRARD · 04949");
  assert.equal(dossierRef({ nom: "MAILLARD" }), "MAILLARD");
  assert.equal(dossierRef({}), "Chantier sans référence");
  assert.match(dotsLabel(3), /niveau 3 sur 4/);
});
t("bouton de lancement : grisé sans choix, grisé pour un mode pas encore branché, actif pour le mode 1", () => {
  assert.equal(launchState(null).ok, false);
  assert.equal(launchState(2).ok, false);
  assert.match(launchState(2).label, /préparation/);
  const L = launchState(1);
  assert.equal(L.ok, true); assert.match(L.label, /mode 1/);
});
t("coût d'un appel : celui du Worker s'il existe, sinon tarif public", () => {
  assert.equal(callCost({ in: 1000, out: 100, usd: 0.5 }), 0.5);
  assert.ok(Math.abs(callCost({ in: 1000, out: 100 }) - (1000 * 4 + 100 * 20) / 1e6) < 1e-12);
  assert.equal(callCost(null), null);
  assert.equal(callCost({ in: 0, out: 0 }), null);
});
t("journal : relevé + relectures regroupés par analyse (durée, tokens, coût, zooms, alertes, écarts proposés)", () => {
  const id = newAnalyseId(1);
  assert.match(id, /^an-1-/);
  const R = { rapport: [
    { type: "releve", date: "d", analyse: { id, mode: 1 }, tin: 10000, tout: 2000, usd: 0.08, ms: 90000 },
    { type: "relecture", analyse: id, tin: 5000, tout: 500, ms: 30000, zooms: 4, total: 6, reste: 2, rows: [{ state: "corrigé" }, { state: "corrigé" }, { state: "introuvable" }] },
    { type: "relecture", analyse: id, tin: 4000, tout: 400, ms: 20000, zooms: 2, total: 2, reste: 1, rows: [{ state: "corrigé" }] },
    { type: "releve", info: "ancien relevé v75 sans journal" },
  ] };
  const [A, ...rest] = analysesOf(R);
  assert.equal(rest.length, 0);
  assert.equal(A.mode, 1); assert.equal(A.appels, 3); assert.equal(A.ms, 140000);
  assert.equal(A.tin, 19000); assert.equal(A.tout, 2900); assert.equal(A.zooms, 6);
  assert.equal(A.alertes, 6); assert.equal(A.reste, 1); assert.equal(A.ecarts, 3); assert.equal(A.relectures, 2);
  assert.ok(Math.abs(A.usd - (0.08 + (5000 * 4 + 500 * 20) / 1e6 + (4000 * 4 + 400 * 20) / 1e6)) < 1e-12);
  assert.equal(fmtUsd(0.123), "0,12 USD"); assert.equal(fmtMs(140000), "2 min 20 s");
  assert.deepEqual(analysesOf(null), []);
});
console.log(`${n}/${n} vérifications (modes d'analyse IA, journal)`);
