// v76 : modes d'« Analyse IA » et journal des analyses (pur, sans navigateur) : node scripts/ai-modes.test.mjs
import assert from "node:assert/strict";
import { MODES_IA, MODES_PAGE, modeOf, dossierRef, dotsLabel, launchState, cyclesFor, recommend, escalade } from "../src/walls/ai-modes.js";
import { imageStats } from "../src/walls/ai-stats.js";
import { score, devicesOf } from "../src/walls/ai-bench.js";
import { chooseGrid, tileGrid, fitSize, regionMap, toMeters, toPixels, unrotate, parseZooms, tileToDevices, mergeReadings, ecartsCount, tilePrompt, tileRules } from "../src/walls/ai-tiles.js";
import { analysesOf, callCost, newAnalyseId, fmtUsd, fmtMs, addUsage, tinOf } from "../src/walls/ai-journal.js";
import { ANALYSE_MODEL, ANALYSE_PRICE } from "../src/ai-config.js";
import { mergeOcr } from "../src/ext/ai-raster.js";
import { planSummary, summaryText, crossPrompt, parseCross, SECOND_METHOD, CROSS_OFF } from "../src/walls/ai-cross.js";

let n = 0;
const t = (name, fn) => { fn(); n++; console.log("✓ " + name); };

t("constante unique : Opus 5.5 au tarif public vérifié", () => {
  assert.equal(ANALYSE_MODEL, "claude-opus-5-5");
  assert.deepEqual(ANALYSE_PRICE, { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 });
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
t("bouton de lancement : grisé sans choix, actif pour un mode branché", () => {
  assert.equal(launchState(null).ok, false);
  assert.equal(launchState(2).ok, true);
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

t("cycles de relecture : mode 1 = réglage de l'opérateur (0 à 3), modes 2 à 4 = 3", () => {
  assert.equal(cyclesFor(1, 2), 2); assert.equal(cyclesFor(1, 0), 0); assert.equal(cyclesFor(1, 9), 3);
  assert.deepEqual([2, 3, 4].map((m) => cyclesFor(m, 0)), [3, 3, 3]);
});
t("cache : entrée totale et coût (écriture 1,25 ×, lecture 0,05 ×)", () => {
  const u = { in: 1000, out: 200, cw: 600, cr: 400 };
  assert.equal(tinOf(u), 2000);
  assert.ok(Math.abs(callCost(u) - (1000 * 4 + 600 * 5 + 400 * 0.2 + 200 * 20) / 1e6) < 1e-12);
  const s = addUsage([u, u, null]);
  assert.equal(s.in, 2000); assert.equal(s.cr, 800); assert.ok(Math.abs(s.usd - 2 * callCost(u)) < 1e-12);
});
t("grille : paysage 4 × 3, portrait 3 × 4 ; tuiles qui couvrent tout le plan avec recouvrement", () => {
  assert.deepEqual(chooseGrid(4000, 2800), { cols: 4, rows: 3 });
  assert.deepEqual(chooseGrid(2800, 4000), { cols: 3, rows: 4 });
  assert.deepEqual(chooseGrid(3000, 3000, "4x4"), { cols: 4, rows: 4 });
  const box = { x: 100, y: 50, w: 3900, h: 2700 }, T = tileGrid(box, { cols: 4, rows: 3, overlap: 0.08 });
  assert.equal(T.length, 12);
  // tout point du plan est dans au moins une tuile ; les tuiles restent dans le plan ; recouvrement entre voisines
  for (const [x, y] of [[100, 50], [3999, 2749], [1075, 950], [2050, 1850]]) assert.ok(T.some((t) => x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h), `${x},${y}`);
  assert.ok(T.every((t) => t.x >= box.x && t.y >= box.y && t.x + t.w <= box.x + box.w + 1e-9 && t.y + t.h <= box.y + box.h + 1e-9));
  assert.ok(T[0].x + T[0].w > T[1].x);
});
t("taille envoyée : ≤ 1 568 px et 1,15 Mpx ; un scan n'est jamais agrandi, un PDF vectoriel peut l'être", () => {
  const a = fitSize(1000, 700);
  assert.deepEqual([a.W, a.H], [1000, 700]);          // pixels d'un scan : pas d'agrandissement
  const b = fitSize(1000, 700, { upscale: 8 });       // vectoriel : rendu plus fin, dans les limites de l'API
  assert.ok(b.W <= 1568 && b.H <= 1568 && b.W * b.H <= 1150000 && b.W > 1000);
  const c = fitSize(4000, 3000);
  assert.ok(c.W <= 1568 && c.W * c.H <= 1150000);
});
t("repères conservés : pixel de tuile → mètres = pixel de source → mètres (aller-retour exact)", () => {
  const src = { x0: 2, y0: -1, sx: 0.004, sy: 0.004 }, region = { x: 1200, y: 800, w: 1000, h: 700 };
  const { W, H } = fitSize(region.w, region.h, { upscale: 8 }), m = regionMap(src, region, W, H);
  const p = toMeters(m, W / 2, H / 2), q = toMeters(src, region.x + region.w / 2, region.y + region.h / 2);
  assert.ok(Math.abs(p.x - q.x) < 1e-9 && Math.abs(p.y - q.y) < 1e-9);
  const back = toPixels(src, p.x, p.y);
  assert.ok(Math.abs(back.u - 1700) < 1e-6 && Math.abs(back.v - 1150) < 1e-6);
  // redressement (mode 3) : un point tourné puis ramené retombe sur lui-même
  const r = unrotate(300, 200, 2.5, 1000, 700), rr = unrotate(r.u, r.v, -2.5, 1000, 700);
  assert.ok(Math.abs(rr.u - 300) < 1e-9 && Math.abs(rr.v - 200) < 1e-9);
  assert.deepEqual(unrotate(10, 20, 0, 100, 100), { u: 10, v: 20 });
  // convention OpenCV : +90° = un quart de tour dans le sens inverse des aiguilles ; le point à droite du centre passe en
  // haut ; ramené, il revient à droite
  const back90 = unrotate(500, 250, 90, 1000, 700);
  assert.ok(Math.abs(back90.u - 600) < 1e-9 && Math.abs(back90.v - 350) < 1e-9);
});
t("zooms demandés : bornés à la tuile, taille minimale, plafond", () => {
  const z = parseZooms({ zooms: [{ x: -20, y: 5, w: 10, h: 10, pourquoi: "petit" }, { x: 900, y: 600, w: 400, h: 400 }, { x: 1, y: 1, w: 50, h: 50 }, { x: "a" }] }, 1000, 700, { max: 2 });
  assert.equal(z.length, 2);
  assert.ok(z[0].x >= 0 && z[0].w >= 24 && z[0].h >= 24);
  assert.ok(z[1].x + z[1].w <= 1000 && z[1].y + z[1].h <= 700);
  assert.deepEqual(parseZooms(null, 10, 10), []);
});
t("tuile → mètres (aiToPlan avec la map de la tuile), liaisons gardées", () => {
  const map = { x0: 10, y0: 20, sx: 0.01, sy: 0.01 };
  const D = tileToDevices({ appareils: [{ t: "INT", x: 100, y: 50 }, { t: "LUM", x: 300, y: 50 }], liaisons: [[0, 1]] }, map);
  assert.deepEqual(D.devices.map((d) => [d.t, +d.x.toFixed(3), +d.y.toFixed(3)]), [["INT", 11, 20.5], ["LUM", 13, 20.5]]);
  assert.deepEqual(D.links, [{ c: 0, l: 1 }]);
});
t("fusion : doublons des recouvrements réunis, ajouts et types différents = écarts à vérifier, rien supprimé", () => {
  const G = { src: "lecture globale", devices: [{ t: "PC16", x: 1, y: 1 }, { t: "INT", x: 3, y: 1 }, { t: "LUM", x: 5, y: 5 }], links: [{ c: 1, l: 2 }] };
  const T1 = { src: "tuile 1", core: { x0: 0, y0: 0, x1: 2.5, y1: 3 }, devices: [{ t: "PC20", x: 1.1, y: 1, inscription: "20A" }, { t: "RJ45", x: 2, y: 2 }], links: [] };
  const T2 = { src: "tuile 2", core: { x0: 2.5, y0: 0, x1: 6, y1: 3 }, devices: [{ t: "RJ45", x: 2.05, y: 2.02 }, { t: "INT", x: 3.02, y: 1.01 }], links: [] };
  const M = mergeReadings([G, T1, T2]);
  assert.equal(M.devices.length, 4);                       // 3 + la RJ45 (vue par les deux tuiles = une seule)
  const pc = M.devices.find((d) => d.x === 1);
  assert.equal(pc.t, "PC20"); assert.equal(pc.aiTypeGlobal, "PC16"); assert.equal(pc.aiStatus, "a_confirmer"); assert.equal(pc.inscription, "20A");
  assert.deepEqual(M.devices.find((d) => d.t === "RJ45").aiSrc, ["tuile 1", "tuile 2"]);
  assert.deepEqual(M.links, [{ c: 1, l: 2 }]);
  const n = ecartsCount(M.ecarts);
  assert.equal(n.ajout, 1); assert.equal(n.type, 1);
  assert.equal(n["seul-base"], 0);                         // la LUM (5, 5) n'est dans le cœur d'aucune tuile
  const M2 = mergeReadings([G, { ...T2, devices: [] , core: { x0: 4, y0: 4, x1: 6, y1: 6 } }]);
  assert.equal(ecartsCount(M2.ecarts)["seul-base"], 1);    // LUM dans une tuile lue qui ne l'a pas vue
});
t("consignes des tuiles : pixels de la tuile, zooms bornés, OCR et image nettoyée signalés", () => {
  const R = tileRules({ zoomMax: 3 });
  assert.match(R, /PIXELS de l'image de la tuile/); assert.match(R, /3 au plus/); assert.match(R, /N'invente rien/);
  const P = tilePrompt({ r: 0, c: 1 }, { n: 2, total: 12, W: 1500, H: 1000, cmPerPx: 0.4, ocr: [{ text: "LL", x: 10, y: 20, conf: 91, src: "orig" }], cleaned: true });
  assert.match(P, /Tuile 2\/12 \(ligne 1, colonne 2\)/); assert.match(P, /image de 1500 × 1000 pixels/); assert.match(P, /NETTOYÉE/); assert.match(P, /"LL" en \(10, 20\) · 91 %/);
});
t("OCR (mode 3) : lectures d'origine et nettoyée comparées, confiance faible écartée", () => {
  const o = [{ text: "LL", x: 10, y: 10, conf: 80 }, { text: "Cuisine", x: 200, y: 50, conf: 70 }, { text: "~", x: 1, y: 1, conf: 90 }, { text: "32A", x: 400, y: 80, conf: 20 }];
  const n = [{ text: "ll", x: 14, y: 12, conf: 92 }, { text: "LV", x: 300, y: 60, conf: 75 }];
  const M = mergeOcr(o, n);
  assert.deepEqual(M.map((w) => [w.text, w.src, w.conf]), [["LL", "both", 92], ["LV", "net", 75], ["Cuisine", "orig", 70]]);
});
t("mode 4 : décompte du plan, consigne du contrôle croisé, écarts lus (quantités égales écartées, extrait court)", () => {
  const S = planSummary([{ t: "PC16", x: 1, y: 1 }, { t: "PC16", x: 1.2, y: 1, qty: 2 }, { t: "LUM", x: 5, y: 5 }], [{ name: "Cuisine", x: 1, y: 1 }, { name: "Séjour", x: 5, y: 5 }]);
  assert.deepEqual(S.byType, { PC16: 3, LUM: 1 });
  assert.deepEqual(S.byRoom, { Cuisine: { PC16: 2 }, "Séjour": { LUM: 1 } });
  assert.match(summaryText(S), /PC16 \(prise de courant 16 A\) : 3/);
  const P = crossPrompt(S, [{ source: "devis.pdf, page 1", text: "Four, lave-vaisselle" }, { source: "cuisine.png", image: "x" }]);
  assert.match(P, /Document 1 — devis\.pdf, page 1\nFour, lave-vaisselle/); assert.match(P, /image jointe ci-dessus/); assert.match(P, /N'invente rien/);
  const C = parseCross({ documents: [{ source: "devis", nature: "devis" }], ecarts: [{ equipement: "Lave-vaisselle", type: "lv", qDoc: 1, qPlan: 0, extrait: "un deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze quinze seize dix-sept" }, { equipement: "Prise", type: "PC16", qDoc: 3, qPlan: 3 }, { equipement: "" }, { equipement: "Borne", type: "XYZ", qDoc: null }] });
  assert.deepEqual(C.list.map((e) => [e.equipement, e.t, e.qDoc]), [["Lave-vaisselle", "LV", 1], ["Borne", "", null]]);
  assert.equal(C.list[0].extrait.split(" ").length, 15);
  assert.match(SECOND_METHOD, /PIÈCE PAR PIÈCE/); assert.match(CROSS_OFF, /désactivée/);
});
t("recommandation à l'import : scan incliné / peu contrasté → mode 3 ; dense ou faible définition → mode 2 ; sinon mode 1", () => {
  assert.equal(recommend({ kind: "raster", skew: 1.2, contrast: 200 }).mode, 3);
  assert.equal(recommend({ kind: "raster", skew: 0, contrast: 80 }).mode, 3);
  assert.equal(recommend({ kind: "vector", shapes: 3000 }).mode, 2);
  assert.equal(recommend({ kind: "raster", skew: 0, contrast: 200, noise: 0.02, pxPerM: 90 }).mode, 2);
  const r = recommend({ kind: "vector", shapes: 400, docs: 2 });
  assert.equal(r.mode, 1); assert.match(r.why[0], /vectoriel lisible/); assert.equal(r.docs, 2);
});
t("mesures d'image : inclinaison d'un trait à 2°, contraste, encre", () => {
  const w = 400, h = 300, g = new Uint8Array(w * h).fill(250);
  for (let x = 20; x < 380; x++) for (const y0 of [60, 150, 240]) { const y = Math.round(y0 + (x - 200) * Math.tan(2 * Math.PI / 180)); for (let k = -1; k <= 1; k++) g[(y + k) * w + x] = 20; }
  const S = imageStats(g, w, h);
  assert.ok(Math.abs(S.skew - 2) <= 0.25, String(S.skew)); assert.ok(S.contrast > 200); assert.ok(S.ink > 0.02 && S.ink < 0.05);
});
t("escalade : alertes encore ouvertes après les cycles → mode supérieur proposé (jamais au-delà de 4)", () => {
  assert.deepEqual(escalade({ mode: 1, rest: 4, initial: 6 }).to, 2);
  assert.equal(escalade({ mode: 2, rest: 1, initial: 2 }).to, 3);     // la moitié reste
  assert.equal(escalade({ mode: 1, rest: 1, initial: 10 }).propose, false);
  assert.equal(escalade({ mode: 4, rest: 9, initial: 9 }).propose, false);
  assert.equal(escalade({ mode: 1, rest: 0, initial: 9 }).propose, false);
});
t("banc d'essai : rappel, omissions, faux positifs, types justes (même famille à 30 cm, même niveau)", () => {
  const T = devicesOf({ appareils: [{ t: "PC16", x: 0, y: 0 }, { t: "INT", x: 2, y: 0 }, { t: "LUM", x: 4, y: 0 }, { t: "LUM", x: 4, y: 0, lv: "r1" }] });
  const R = devicesOf({ appareils: [{ t: "PC20", x: 0.1, y: 0 }, { t: "INT", x: 2.5, y: 0 }, { t: "SPOT", x: 4, y: 0.2 }, { t: "RJ45", x: 6, y: 0 }] });
  const S = score(T, R);
  assert.equal(S.trouves, 2); assert.equal(S.omissions, 2); assert.equal(S.fauxPositifs, 2); assert.equal(S.typesJustes, 0);
  assert.equal(S.rappel, 0.5); assert.deepEqual(S.omis.map((d) => d.t + "@" + d.lv), ["INT@rdc", "LUM@r1"]);
});
console.log(`${n}/${n} vérifications (modes d'analyse IA, journal)`);
