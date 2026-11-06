// Fichier .spv pour Counter (lot 4, 06/11/2026) : format du BE, sans navigateur.
import { CHANTIERS_FTZ, buildChantier } from "./fixtures/chantiers-ftz.mjs";
import { computeCircuits, circuitsByBox } from "../src/cablage/circuits.js";
import { placeBoxes } from "../src/cablage/boites.js";
import { computeWiring } from "../src/cablage/gaines.js";
import { CAB_DEFAULTS as S } from "../src/cablage/settings.js";
import { spvLines, spvText, spvName, totaux, cableTxt, filsTxt, pieceDefaut } from "../src/cablage/spv.js";

let ok = 0, ko = 0;
const check = (n, c, i) => { if (c) { ok++; console.log("  ✓ " + n); } else { ko++; console.log("  ✗ " + n + (i ? " — " + i : "")); } };
const name = Object.keys(CHANTIERS_FTZ)[0];
const { items, links, tab } = buildChantier(name);
const C0 = computeCircuits(items, links, S), P = placeBoxes(items, links, C0, { rdc: tab }, S, { mode: "equilibre", rooms: {} });
const C = circuitsByBox(items, links, P.boxes, S), W = computeWiring({ items, links, circuits: C, boxes: P.boxes, levels: ["rdc"], S });
const ch = { affaire: "AF26000001", nom: "Essai Été", client: "Maisons Test" };
const L = spvLines(W, items.map((a) => ({ ...a, room: a.room || "Séjour" })), ch, { surl: 0.4 });
const txt = spvText(L);
console.log("Fichier .spv (" + name + ") : " + L.length + " lignes");
console.log("    " + L.slice(0, 3).join("\n    "));
check("24 champs par ligne, ASCII sans accent, fin de ligne CRLF, pas de ligne de titres", L.every((l) => l.split(";").length === 24) && /^[\x20-\x7E\r\n]*$/.test(txt) && txt.endsWith("\r\n") && !/\n(?!$)/.test(txt.replace(/\r\n/g, "")) && !/^@|MATREF/.test(L[0]));
const F = L.map((l) => l.split(";"));
check("une ligne par gaine de boîte + une par ligne directe (+ tronçons de pontage)", L.length >= W.boxes.reduce((s, b) => s + b.gaines.length, 0) + W.direct.filter((d) => d.length != null).length);
check("tout « à faire » (ACTIVE), quantité 1, dossier / pavillonneur / chantier / n° d'affaire", F.every((f) => f[10] === "ACTIVE" && f[9] === "1" && f[12] === "AF26000001_ESSAI ETE" && f[13] === "MAISONS TEST" && f[14] === "ESSAI ETE" && f[15] === "AF26000001"));
const al = F.filter((f) => f[20] === "Alimentation"), br = F.filter((f) => f[20] === "Bras");
check("alimentations : départ TAB, arrivée « LI01 A(…) », boîte livrée KEO_BOITE_PAV, hauteur 3200", al.length >= W.boxes.length && al.every((f) => f[0] === "TAB" && /^LI\d+ [A-D]/.test(f[3]) && f[22] === "3200") && al.filter((f) => f[11] === "KEO_BOITE_PAV").length === W.boxes.length);
check("bras : départ « LI01 B », n° de gaine LI01.04, gaine ICTA16 / ICTA20, longueur de coupe = gaine + 0,40", br.length > 10 && br.every((f) => /^LI\d+ [A-D]$/.test(f[0]) && /^LI\d+\.\d+$/.test(f[19]) && /^ICTA(16|20)$/.test(f[1]) && Math.abs(+f[23] - +f[2] - 0.4) < 0.051));
check("fils 1,5 en codes couleur triés avec la surlongueur (« BF GR V/J (0.40) »)", F.some((f) => f[8] === "BF GR V/J (0.40)"), F.map((f) => f[8]).slice(0, 5).join(" | "));
check("câble : « U1000R2V_3G1.5_B-M-V/J (0.40) » ; fils rigides « B[6] R[6] V/J[6] (0.40) »", cableTxt("3G1,5", null, 0.4) === "U1000R2V_3G1.5_B-M-V/J (0.40)" && filsTxt([{ color: "bleu", section: 6 }, { color: "rouge", section: 6 }, { color: "vert/jaune", section: 6 }], 0.4)[0] === "B[6] R[6] V/J[6] (0.40)");
check("nom du fichier « AF…_NOM-.spv »", spvName(ch) === "AF26000001_ESSAI_ETE-.spv", spvName(ch));
const T = totaux(W, L);
check("totaux (planning du BE, métrages) : somme des lignes ; nombre de boîtes", T.boites === W.boxes.length && T.fils["1.5 V/J"] > 0 && Math.abs(T.longueur - F.reduce((s, f) => s + (+f[2] || 0), 0)) < 0.5, JSON.stringify(T).slice(0, 200));

check("CH-07 : pièce inconnue → GARAGE (moteur), EXTERIEUR (dehors), CELLIER (le reste) ; pièce connue gardée", pieceDefaut({ t: "MGAR" }) === "GARAGE" && pieceDefaut({ t: "PC16", ext: true }) === "EXTERIEUR" && pieceDefaut({ t: "GEXT" }) === "EXTERIEUR" && pieceDefaut({ t: "PC16" }) === "CELLIER");

console.log(`\n${ok} vérifications réussies, ${ko} en échec.`);
if (ko) process.exit(1);
