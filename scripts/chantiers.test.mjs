// Câblage d'Oktéo sur 4 chantiers réels (v52) : contenu relevé sur les bandes FTZ (scripts/fixtures/chantiers-ftz.mjs),
// câblé par Oktéo dans les 3 modes de pieuvre, puis contrôle des règles vérifiées à la main par Kévin sur ces chantiers
// (journal des règles, note de passation section 3). On ne compare PAS le nombre de boîtes à FTZ (16 départs chez nous, v56).
import { CHANTIERS_FTZ, buildChantier } from "./fixtures/chantiers-ftz.mjs";
import { computeCircuits, circuitsByBox } from "../src/cablage/circuits.js";
import { placeBoxes } from "../src/cablage/boites.js";
import { computeWiring } from "../src/cablage/gaines.js";
import { CAB_DEFAULTS as S } from "../src/cablage/settings.js";

let ok = 0; const fails = [];
const check = (name, cond, info = "") => { if (cond) { ok++; console.log("  ✓ " + name); } else { fails.push(name); console.log("  ✗ " + name + (info ? " : " + info : "")); } };
const FACES = ["A", "B", "C", "D"];

function run(name, mode) {
  const { items, links, tab } = buildChantier(name);
  const C0 = computeCircuits(items, links, S);
  const P = placeBoxes(items, links, C0, { rdc: tab }, S, { mode, rooms: {} });
  const C = circuitsByBox(items, links, P.boxes, S);
  const W = computeWiring({ items, links, circuits: C, boxes: P.boxes, levels: ["rdc"], S });
  return { items, links, P, C, W };
}

for (const name of Object.keys(CHANTIERS_FTZ)) {
  for (const mode of ["proximite", "equilibre", "piece"]) {
    const { items, links, P, C, W } = run(name, mode);
    const B = W.boxes, G = B.flatMap((b) => b.gaines);
    const nApp = items.filter((a) => a.t !== "TAB").length;
    console.log(`${name} (${CHANTIERS_FTZ[name].client}), pieuvre ${mode} : ${nApp} appareils → ${B.length} boîtes (FTZ : ${Object.keys(CHANTIERS_FTZ[name].boites).length} sans les volets), ${G.length} gaines, ${W.totals.gaine} m de gaine`);
    console.log("    " + B.map((b) => `${b.n} ${b.gaines.filter((g) => g.kind === "app").length}+${b.gaines.filter((g) => g.kind === "alim").length} (${FACES.map((f) => f + b.gaines.filter((g) => g.face === f).length).join(" ")}) ${b.longueur} m`).join(" · "));
    const tag = `${name} ${mode} : `;
    const needBox = new Set([...C.filter((c) => !c.direct && c.kind !== "comm").flatMap((c) => c.apps), ...items.filter((a) => a.t === "EQL").map((a) => a.id)]);
    const boxedOk = items.filter((a) => needBox.has(a.id)).every((a) => P.boxes.filter((b) => b.apps.includes(a.id)).length === 1) && items.filter((a) => !needBox.has(a.id)).every((a) => !P.boxes.some((b) => b.apps.includes(a.id)));
    const pIss = P.issues.filter((x) => !/R-094/.test(x));   // volets en mode « par pièce » : pas de règle, signalé (avertir)
    check(tag + "chaque appareil dans exactement une boîte, aucun allumage coupé, aucun doute bloquant", boxedOk && !pIss.length && !W.splits.length && !W.doutes.some((d) => d.bloquant),
      [...P.issues, ...W.doutes.map((d) => d.text)].join(" ; "));
    // 1. R-001 : 16 départs (sans l'alimentation, v56), 6 gaines par face (alimentation comprise)
    check(tag + "R-001 : ≤ 16 départs par boîte, ≤ 6 gaines par face", B.every((b) => b.gaines.filter((g) => g.kind === "app").length <= 16 && FACES.every((f) => b.gaines.filter((g) => g.face === f).length <= 6) && b.gaines.every((g) => FACES.includes(g.face))));
    // 2. R-074 : diamètre par la somme des sections
    check(tag + "R-074 : ≤ 7,5 mm² → ICTA 16, ≤ 13,5 mm² → ICTA 20", G.every((g) => g.diam === (g.sum <= 7.5 + 1e-9 ? 16 : g.sum <= 13.5 + 1e-9 ? 20 : null) && g.diam != null),
      G.filter((g) => g.diam == null).map((g) => g.no + " " + g.sum).join(", "));
    // 3. R-075 : une terre dans l'alimentation, de la plus forte section de la gaine
    check(tag + "R-075 : une seule terre par boîte, dans l'alimentation, à la plus forte section", B.every((b) => {
      const A = b.gaines.filter((g) => g.kind === "alim"), T = A.flatMap((g) => g.wires.filter((w) => w.fn === "terre"));
      return T.length === 1 && T[0].section === Math.max(...A.flatMap((g) => g.wires.map((w) => w.section)));
    }));
    // 4. R-081 : circuits numérotés 1…N dans l'ordre des boîtes, éclairage puis prises (cuisine après)
    const boxed = C.filter((c) => c.box), order = boxed.map((c) => P.boxes.findIndex((b) => b.id === c.box));
    const rank = { eclairage: 0, prises: 1, cuisine: 2, volets: 3 };
    check(tag + "R-081 : circuits C1…Cn dans l'ordre des boîtes, éclairage puis prises puis cuisine", boxed.every((c, i) => c.n === "C" + (i + 1)) && order.every((o, i) => i === 0 || o > order[i - 1] || (o === order[i - 1] && rank[boxed[i].kind] >= rank[boxed[i - 1].kind])));
    // 5. R-021 / R-022 : 8 prises par circuit, 6 en cuisine (hotte comprise)
    check(tag + "R-021 / R-022 : ≤ 8 prises par circuit, ≤ 6 en cuisine", C.every((c) => (c.kind !== "prises" || c.apps.length <= 8) && (c.kind !== "cuisine" || c.apps.length <= 6)));
    // 6. R-077 : .01 = alimentation, puis strictement dans le sens anti-horaire (v56)
    const M = S.departsFace, per = 4 * M, pos = (g) => FACES.indexOf(g.face) * M + g.slot;
    check(tag + "R-077 : .01 = alimentation, numéros strictement dans le sens anti-horaire", B.every((b) => {
      const L = b.gaines, p0 = pos(L[0]);
      return L[0].id === "alim:0" && L.every((g, i) => g.no === `${b.n}.${String(i + 1).padStart(2, "0")}` && (i === 0 || (p0 - pos(g) + per) % per > (p0 - pos(L[i - 1]) + per) % per));
    }));
    // 7. R-072 : jamais deux allumages de la même couleur dans une gaine ; pas de répétition dans la boîte sans bague
    const gid = (k) => String(k || "").replace(/^(R|V1|V2|K)/, "");
    check(tag + "R-072 : dans chaque gaine, une couleur de la ronde = un seul allumage ; couleur répétée dans la boîte = bague", B.every((b) => {
      const ronde = (g) => g.wires.filter((w) => /^(retour|nav1|nav2|cmdTL|retTL)$/.test(w.fn));
      const okG = b.gaines.every((g) => { const m = new Map(); ronde(g).forEach((w) => { if (!m.has(w.color)) m.set(w.color, new Set()); m.get(w.color).add(gid(w.net)); }); return [...m.values()].every((s) => s.size === 1); });
      const byCol = new Map(); b.gaines.filter((g) => g.kind === "app").forEach((g) => ronde(g).forEach((w) => { if (!byCol.has(w.color)) byCol.set(w.color, new Map()); byCol.get(w.color).set(gid(w.net), w.bague || null); }));
      const okB = [...byCol.values()].every((m) => [...m.values()].filter((x) => !x).length <= 1);
      return okG && okB;
    }));
    // 8. R-020 / R-021 : rouge = phase des lumières seulement, gris = phase des prises seulement
    check(tag + "R-020 / R-021 : phase rouge 1,5 seulement pour l'éclairage (et la cuisine 2,5), phase grise seulement pour les prises (et les volets, R-021 / R-079)", G.every((g) => g.wires.every((w) => {
      if (w.fn !== "phase" || !w.circuit) return true;
      const c = C.find((x) => x.n === w.circuit);
      // (volets : gris / bleu clair, R-079 et R-021 confirmées par Kévin, Q-82)
      return (w.color === "gris") === (c.kind === "prises" || c.kind === "volets") && (w.color !== "rouge" || c.kind === "eclairage" || c.kind === "cuisine");
    })));
    // lumières extérieures : câble 3G et bouchon (R-014, R-095) ; retour marron (R-072)
    const extG = G.filter((g) => g.appIds && g.appIds.some((id) => items.find((a) => a.id === id).ext));
    check(tag + "R-014 / R-095 : lumière extérieure en câble 3G avec bouchon ; son allumage est marron", extG.every((g) => g.cable && /^3G/.test(g.cable) && g.bouchon && g.wires.find((w) => w.fn === "retour").color === "marron") && (extG.length > 0) === items.some((a) => a.ext),
      extG.map((g) => `${g.no} ${g.cable} ${g.bouchon} ${g.wires.find((w) => w.fn === "retour")?.color}`).join(", "));
    // volets roulants (R-079, R-087, R-096) : circuit dédié gris / bleu clair 1,5 mm², 10 A, puissance admissible ;
    // volet filaire : la gaine du CVR et celle du moteur portent les deux mêmes fils de commande
    const VC = C.filter((c) => c.kind === "volets"), byId = new Map(items.map((a) => [a.id, a]));
    const hasV = items.some((a) => a.t === "VR" || a.t === "VEL");
    check(tag + "R-079 / R-087 : volets sur un circuit dédié 1,5 mm² 10 A (≤ 2 300 W de moteurs), phase grise et neutre bleu clair", !hasV || (VC.length > 0 && VC.every((c) => c.section === 1.5 && c.prot === 10 && c.apps.filter((id) => byId.get(id).t !== "CVR").length * 50 <= 2300)
      && G.filter((g) => g.appIds && g.appIds.some((id) => ["VR", "VEL"].includes(byId.get(id)?.t))).every((g) => g.wires.some((w) => w.fn === "phase" && w.color === "gris") && g.wires.some((w) => w.fn === "neutre" && w.color === "bleu clair"))));
    const cvr = items.filter((a) => a.t === "CVR");
    check(tag + "R-096 : volet filaire = mêmes deux fils de commande dans la gaine du CVR et dans celle du moteur", cvr.every((c) => {
      const gc = G.find((g) => (g.appIds || []).includes(c.id)), v = links.find((l) => l.c === c.id), gv = v && G.find((g) => (g.appIds || []).includes(v.l));
      const k = (g) => g.wires.filter((w) => /^cmdV/.test(w.fn)).map((w) => w.net + w.color).sort().join();
      return gc && gv && k(gc) && k(gc) === k(gv) && !gc.wires.some((w) => w.fn === "terre");
    }));
    if (mode === "equilibre" && hasV) {
      const vb = B.filter((b) => b.gaines.some((g) => g.appIds && g.appIds.some((id) => ["VR", "VEL", "CVR"].includes(byId.get(id)?.t))));
      check(tag + "R-094 : pieuvre équilibrée → une seule boîte pour tous les volets, sans autre appareil", vb.length === 1 && vb[0].gaines.filter((g) => g.kind === "app").every((g) => g.appIds.every((id) => ["VR", "VEL", "CVR"].includes(byId.get(id)?.t))), vb.map((b) => b.n).join(","));
    }
    // équipotentielle locale (R-080) : un fil vert/jaune 2,5 sur la terre de la boîte, terre de l'alimentation en 2,5 (R-075)
    const eqB = B.filter((b) => b.gaines.some((g) => (g.appIds || []).some((id) => byId.get(id)?.t === "EQL")));
    check(tag + "R-080 / R-075 : équipotentielle locale = un fil V/J 2,5 dans sa gaine ; terre de l'alimentation de sa boîte en 2,5", eqB.every((b) => b.gaines.filter((g) => (g.appIds || []).some((id) => byId.get(id)?.t === "EQL")).every((g) => g.wires.length === 1 && g.wires[0].fn === "terre" && g.wires[0].section === 2.5)
      && b.gaines.find((g) => g.kind === "alim").wires.find((w) => w.fn === "terre").section === 2.5) && (eqB.length > 0) === items.some((a) => a.t === "EQL"));
    check(tag + "longueur totale de chaque boîte = somme de ses gaines", B.every((b) => Math.abs(b.longueur - b.gaines.reduce((s, g) => s + g.length, 0)) < 0.01));
  }
}

// lignes directes de DUCOURNEAU comparées à la feuille « LIGNES DIRECTES » de FTZ (R-082, R-084)
{
  const { items, links, lignes, lignesTotal } = buildChantier("DUCOURNEAU");
  const { W } = run("DUCOURNEAU", "proximite");
  const norm = (x) => String(x).replace(/[\s_-]+/g, "").replace(/,/g, ".").replace("×", "x");
  const gnorm = (d) => (d.gaine === "V20" ? "ICTA_V20" : d.gaine === 40 ? "GAINE_AIGUILLEE40" : "ICTA" + d.diam);
  const diff = lignes.filter(([rep, , g, f]) => { const d = W.direct.find((x) => x.etiquette === rep); if (!d) return true; const fil = norm(d.fil); return gnorm(d) !== g || (f && fil !== norm(f) && !(rep === "C4" && fil === norm("1.5B+N+M+V/J"))); });
  console.log("Lignes directes DUCOURNEAU : " + W.direct.length + " lignes · " + Object.entries(W.directTotals).map(([k, n]) => n + " × " + k).join(" · "));
  check("DUCOURNEAU : les 28 lignes directes ont la gaine et le fil de la feuille FTZ (sauf la couleur du fil pilote de C4 : ivoire chez FTZ, question Q-83)", !diff.length && W.direct.length === 28,
    diff.map(([rep]) => { const d = W.direct.find((x) => x.etiquette === rep); return rep + " " + (d ? gnorm(d) + " " + d.fil : "absente"); }).join(" ; "));
  const t = W.directTotals, n16 = t["ICTA 16"] || 0, n20 = t["ICTA 20"] || 0, aig = t["ICTA 40"] || 0;
  check("DUCOURNEAU : total par gaine identique à FTZ (11 ICTA 16, 16 ICTA 20 dont les vertes, R-099 ; 1 gaine aiguillée)", n16 === lignesTotal.ICTA16 && n20 === lignesTotal.ICTA20 && aig === lignesTotal.AIG && W.directVertes > 0, JSON.stringify(t));
  check("courant faible jamais dans une boîte ni avec le courant fort (R-003) : TV, antenne, RJ45 en gaine verte", W.direct.filter((d) => d.faible).every((d) => d.gaine === "V20" || d.gaine === 20) && !W.boxes.some((b) => b.gaines.some((g) => (g.appIds || []).some((id) => /^(RJ45|TV|ANT|INTERCO)$/.test(items.find((a) => a.id === id)?.t)))));
}

console.log(`\n${ok} vérifications réussies, ${fails.length} en échec.`);
if (fails.length) { console.error(fails.map((f) => " - " + f).join("\n")); process.exit(1); }
