// Chantier de référence MAILLARD (AF26074801, v56) : le relevé d'Opus corrigé par Kévin (docs/chantiers/MAILLARD_kevin.okteo)
// est recâblé avec les règles actuelles (mode Équilibrée, volets connectés comme le BE), puis comparé à la bande du bureau
// d'études (docs/chantiers/MAILLARD_bandes_FTZ.pdf, relevée à la main dans BE ci-dessous) et aux règles du journal.
// Les appareils hors plan (four, VMC, bouches…, R-100) ne sont pas dans le relevé : ils ne sont pas comparés.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const OUT = path.join(os.tmpdir(), "okteo-maillard.json");
execFileSync(process.execPath, ["scripts/chantier-wiring.mjs", "docs/chantiers/MAILLARD_kevin.okteo", OUT, "--recable", "--connecte", "--mode=equilibre"], { stdio: "pipe" });
const D = JSON.parse(fs.readFileSync(OUT, "utf8"));

// bande du BE : départs (gaines hors alimentation) par boîte ; LI06 = boîte des volets (8 moteurs connectés)
const BE = { boites: 6, departs: [11, 15, 13, 15, 14, 8], voletsBoite: 8 };

let ok = 0;
const fails = [];
function check(name, cond, info = "") { if (cond) { ok++; console.log("  ✓ " + name); } else { fails.push(name); console.log("  ✗ " + name + (info ? " : " + info : "")); } }

const B = D.boxes, apps = new Map(D.apps.map((a) => [a.id, a])), tOf = (id) => (apps.get(id) || {}).t;
const appG = (b) => b.gaines.filter((g) => g.kind === "app");
const col = (g) => g.wires.map((w) => w.color).sort().join(",");
const typesOf = (g) => [...new Set((g.reps || []).map((r) => (D.apps.find((a) => a.rep === r) || {}).t))];
console.log("MAILLARD recâblé (v56) : " + B.map((b) => `${b.n} ${appG(b).length}`).join(" · ") + " départs ; BE : " + BE.departs.join(" · "));

check("6 boîtes comme le BE, dont une seule pour les 8 volets (mode Équilibrée, volets connectés)", B.length === BE.boites && B.filter((b) => b.circuits.length === 1 && appG(b).every((g) => typesOf(g).every((t) => t === "VR"))).length === 1);
const vb = B.find((b) => appG(b).length && appG(b).every((g) => typesOf(g).every((t) => t === "VR")));
check("boîte des volets : 8 moteurs, chacun en gris + bleu clair + vert/jaune ICTA 16, aucune commande de volet câblée (R-079, R-096)",
  vb && appG(vb).length === BE.voletsBoite && appG(vb).every((g) => col(g) === "bleu clair,gris,vert/jaune" && g.diam === 16 && !g.cable) && !B.some((b) => b.gaines.some((g) => typesOf(g).includes("CVR"))));
check("R-001 : au plus 16 départs par boîte et 6 gaines par face", B.every((b) => appG(b).length <= 16 && ["A", "B", "C", "D"].every((f) => b.gaines.filter((g) => g.face === f).length <= 6)));
check("R-077 : .01 = alimentation dans chaque boîte", B.every((b) => b.gaines[0].kind === "alim" && b.gaines[0].no.endsWith(".01")));
const pr = B.flatMap((b) => appG(b).filter((g) => typesOf(g).every((t) => t === "PC16")));
check("prises : gris + bleu foncé + vert/jaune 1,5 (comme le BE)", pr.length > 20 && pr.every((g) => col(g) === "bleu foncé,gris,vert/jaune" && g.wires.every((w) => w.section === 1.5)));
const lum = B.flatMap((b) => appG(b).filter((g) => typesOf(g).length === 1 && ["LUM", "APP"].includes(typesOf(g)[0]) && !g.cable));
check("lumières : bleu + retour + vert/jaune (comme le BE)", lum.length > 8 && lum.every((g) => g.wires.length === 3 && g.wires.some((w) => w.color === "bleu") && g.wires.some((w) => w.color === "vert/jaune")));
const cmd = B.flatMap((b) => appG(b).filter((g) => typesOf(g).every((t) => ["INT", "VV", "BP"].includes(t))));
check("commandes : sans terre (comme le BE)", cmd.length > 5 && cmd.every((g) => !g.wires.some((w) => w.color === "vert/jaune")));
const ext = B.flatMap((b) => appG(b).filter((g) => g.cable));
check("appliques extérieures : câble 3G1,5 avec le marron (comme L1, L1A, L3 du BE)", ext.length >= 2 && ext.every((g) => g.cable === "3G1,5" && g.wires.some((w) => w.color === "marron")));
check("pas de gaine ICTA 25 dans les boîtes (R-073)", B.every((b) => b.gaines.every((g) => g.diam <= 20)));
const dl = (e) => D.direct.find((d) => d.etiquette === e);
check("lignes directes communes au BE : RJ1 à RJ7 en gaine verte (grade 3 TV), interphone 4G1,5 ICTA 20, moteur 1,5 GR+BF+V/J ICTA 16, TV en 17 VATC",
  [1, 2, 3, 4, 5, 6, 7].every((i) => dl("RJ" + i) && dl("RJ" + i).gaine === "V20" && /grade 3 TV/.test(dl("RJ" + i).fil)) && dl("INTERCO1")?.fil === "4G1,5" && dl("INTERCO1")?.diam === 20
  && dl("MOTEUR1")?.fil === "1,5 GR+BF+V/J" && dl("MOTEUR1")?.diam === 16 && ["TV1", "TV2"].every((e) => dl(e)?.fil === "17 VATC"));
check("R-099 : total des lignes directes, gaines vertes comptées avec les ICTA 20", (D.directTotals["ICTA 20"] || 0) >= 9 && !Object.keys(D.directTotals).some((k) => /verte/.test(k)), JSON.stringify(D.directTotals));
check("aucun doute bloquant", !D.doutes.some((d) => d.bloquant), D.doutes.map((d) => d.rule).join(","));

console.log(`\n${ok} vérifications réussies, ${fails.length} en échec.`);
if (fails.length) process.exit(1);
