// Tests du câblage (sans navigateur) : diamètre des gaines (exemples de Kévin) et répartition des circuits sur EVRARD.
import fs from "node:fs";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractSegments } from "../src/walls/extract.js";
import { detectDevices, pageTexts } from "../src/walls/devices.js";
import { gaineFor } from "../src/cablage/gaine.js";
import { computeCircuits, checkCircuits, circuitsByBox } from "../src/cablage/circuits.js";
import { CAB_DEFAULTS as S } from "../src/cablage/settings.js";
import { placeBoxes, buildUnits, faceToward, portLayout, portXY } from "../src/cablage/boites.js";
import { pointInPoly } from "../src/walls/rooms.js";
import { PACK_DEFAULTS, packFor, missing, placePack, prisesNorme } from "../src/cablage/packs.js";
import { computeWiring, gaineLength, cableColors } from "../src/cablage/gaines.js";
import { connectorsFor, boxSteps, boxMaterial, boxChecks, parseSizes, schemaSVG } from "../src/cablage/schema.js";
import { autoTableau, syncTableau, tableauIssues, protections, moveItem, suggestModel, addBreaker, addModular, MODELS } from "../src/cablage/tableau.js";
import { packSheet, unpackSheet, encodeSheet, decodeSheet, sheetUrl } from "../src/cablage/bande-code.js";

let ok = 0; const fails = [];
const check = (name, cond, info = "") => { if (cond) { ok++; console.log("  ✓ " + name); } else { fails.push(name); console.log("  ✗ " + name + (info ? " : " + info : "")); } };

console.log("Diamètre des gaines (place occupée par les fils)");
const f = (n, sec) => Array(n).fill(sec);
check("5 fils de 1,5 mm² → Ø16", gaineFor(f(5, 1.5), S.remplissage) === 16);
check("6 fils de 1,5 mm² → Ø20 (au-delà de 5)", gaineFor(f(6, 1.5), S.remplissage) === 20);
check("4 fils de 1,5 + 1 fil de 2,5 → Ø20", gaineFor([...f(4, 1.5), 2.5], S.remplissage) === 20);
check("3 fils de 1,5 → Ø16 ; 3 fils de 6 → Ø20 ; 5 fils de 6 → Ø25", gaineFor(f(3, 1.5)) === 16 && gaineFor(f(3, 6)) === 20 && gaineFor(f(5, 6)) === 25, [gaineFor(f(3, 6)), gaineFor(f(5, 6))].join(","));

console.log("Circuits NF C 15-100 sur EVRARD (appareils relevés du PDF)");
const data = new Uint8Array(fs.readFileSync(new URL("../docs/plans/EVRARD_04949_plan.pdf", import.meta.url)));
const doc = await pdfjs.getDocument({ data, verbosity: 0 }).promise;
const page = await doc.getPage(3);
const ex = await extractSegments(page, pdfjs.OPS);
const dv = detectDevices(ex, await pageTexts(page), { k: 13 / 550 * 1.056 });
const items = dv.devices.map((d, i) => ({ id: "a" + i, t: d.t, x: d.x, y: d.y, lv: "rdc", lvName: "RDC", room: null, rep: d.t + i }));
const links = dv.links.map((l) => ({ c: "a" + l.c, l: "a" + l.l }));
const C = computeCircuits(items, links, S);
const where = new Map(); C.forEach((c) => c.apps.forEach((id) => where.set(id, [...(where.get(id) || []), c])));
const T = (t) => items.filter((a) => a.t === t);
const powered = items.filter((a) => !["TAB", "VMC"].includes(a.t));
check("chaque appareil est dans exactement un circuit", powered.every((a) => (where.get(a.id) || []).length === 1), powered.filter((a) => (where.get(a.id) || []).length !== 1).map((a) => a.t).join(","));
const ecl = C.filter((c) => c.kind === "eclairage"), pr = C.filter((c) => c.kind === "prises");
const L = new Set(["LUM", "SPOT", "APP"]), byId = new Map(items.map((a) => [a.id, a]));
check("éclairage : au plus 8 points par circuit, en 1,5 mm² / 16 A", ecl.length >= 3 && ecl.every((c) => c.apps.filter((id) => L.has(byId.get(id).t)).length <= 8 && c.section === 1.5 && c.prot === 16), ecl.map((c) => c.apps.length).join(","));
check("prises 16 A : au plus 8 par circuit, en 1,5 mm² / 16 A (règle KiTéOHM)", pr.length === Math.ceil(T("PC16").length / 8) && pr.every((c) => c.apps.length <= 8 && c.section === 1.5 && c.prot === 16), pr.map((c) => c.apps.length).join(","));
check("prises 20/32 A et sorties de câble : un circuit spécialisé chacune (ligne directe)", [...T("PC20"), ...T("SC")].every((a) => where.get(a.id)[0].kind === "specialise" && where.get(a.id)[0].apps.length === 1 && where.get(a.id)[0].direct));
check("RJ45 : lignes directes de communication", T("RJ45").every((a) => where.get(a.id)[0].kind === "comm"));
const cmdOk = links.filter((l) => L.has(byId.get(l.l).t)).every((l) => where.get(l.c)[0].apps.includes(l.l) || ecl.some((c) => c.apps.includes(l.c)));
check("une commande est dans le circuit des lumières qu'elle allume", cmdOk);
// les lumières d'une même commande restent ensemble (sauf allumage de plus de 8 points)
const together = [...new Set(links.map((l) => l.c))].every((c) => { const ls = links.filter((l) => l.c === c && L.has(byId.get(l.l).t)).map((l) => where.get(l.l)[0].id); return new Set(ls).size <= 1 || ls.length > 8; });
check("les lumières d'un même allumage restent dans le même circuit", together);
console.log("    éclairage :", ecl.map((c) => c.apps.filter((id) => L.has(byId.get(id).t)).length).join(" / "));
check("pas de circuit d'éclairage presque vide (répartition équilibrée)", ecl.length === Math.ceil(items.filter((a) => L.has(a.t)).length / 8) && ecl.every((c) => c.apps.filter((id) => L.has(byId.get(id).t)).length > 8 / 3));
check("numérotation C1, C2… puis COM", C.filter((c) => c.kind !== "comm").every((c, i) => c.n === "C" + (i + 1)) && C.some((c) => c.n === "COM"));
check("contrôle : aucun dépassement, aucun appareil oublié", (() => { const r = checkCircuits(C, items, S); return !r.issues.length && !r.orphans.length; })());

console.log("Boîtes (v29) et gaines (v30) sur EVRARD");
check("longueur : 3 m dans les combles, prise à 30 cm → 3×1,10 + 0,30 + 2,20 + 0,30 + 0,20 = 6,30 m", gaineLength({ horiz: 3, downA: 0.3 + 2.2 }, S) === 6.3, String(gaineLength({ horiz: 3, downA: 2.5 }, S)));
check("faces : vers le haut du plan = A, droite = B, bas = C, gauche = D", faceToward({ x: 0, y: 0 }, { x: 0.2, y: -2 }) === "A" && faceToward({ x: 0, y: 0 }, { x: 2, y: 0.5 }) === "B" && faceToward({ x: 0, y: 0 }, { x: 0, y: 3 }) === "C" && faceToward({ x: 0, y: 0 }, { x: -1, y: 0 }) === "D");
const k2 = 13 / 550 * 1.056;
items.push({ id: "tab", t: "TAB", x: 293 * k2, y: 410 * k2, h: null, lv: "rdc", lvName: "RDC", room: "Garage", rep: "TD1" });
const P = placeBoxes(items, links, C, { rdc: { x: 293 * k2, y: 410 * k2 } }, S);
const W = computeWiring({ items, links, circuits: C, boxes: P.boxes, levels: ["rdc"], S });
const boxedIds = new Set(C.filter((c) => !c.direct && c.kind !== "comm").flatMap((c) => c.apps));
const inBox = new Map(); P.boxes.forEach((b) => b.apps.forEach((id) => inBox.set(id, [...(inBox.get(id) || []), b.n])));
check("chaque appareil d'un circuit à boîte est dans exactement une boîte", [...boxedIds].every((id) => (inBox.get(id) || []).length === 1) && !P.issues.length, P.issues.join(" ; "));
console.log("    boîtes :", W.boxes.map((b) => `${b.n} ${b.gaines.length} départs (A${b.gaines.filter((g) => g.face === "A").length} B${b.gaines.filter((g) => g.face === "B").length} C${b.gaines.filter((g) => g.face === "C").length} D${b.gaines.filter((g) => g.face === "D").length})`).join(" · "), `· cuivre ${W.totals.cuivre} m · gaine ${W.totals.gaine} m`);
check("au plus 18 départs par boîte et 6 par face (alimentations comprises)", W.boxes.every((b) => b.gaines.length <= 18 && ["A", "B", "C", "D"].every((f) => b.gaines.filter((g) => g.face === f).length <= 6)));
const units = buildUnits(items, links, C);
check("une commande et ses lumières sont toujours dans la même boîte", units.every((u) => new Set(u.ids.map((id) => inBox.get(id)[0])).size === 1));
// économie de cuivre : déplacer une boîte de 50 cm ne fait pas mieux (optimum local)
const cost = (boxes) => computeWiring({ items, links, circuits: C, boxes, levels: ["rdc"], S }).totals.cuivre;
const base = W.totals.cuivre;
const better = P.boxes.some((b, i) => [[0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]].some(([dx, dy]) => cost(P.boxes.map((x, j) => (j === i ? { ...x, x: x.x + dx, y: x.y + dy } : x))) < base - 2));
check("placement économe : déplacer une boîte de 50 cm n'économise pas de cuivre", !better);
const one = { id: "x", n: "LI01", lv: "rdc", x: items.reduce((s, a) => s + a.x, 0) / items.length, y: items.reduce((s, a) => s + a.y, 0) / items.length, apps: [...boxedIds] };
console.log("    (une seule boîte au centre : " + cost([one]) + " m de cuivre)");
const g = (t) => W.boxes.flatMap((b) => b.gaines).find((x) => x.appId && x.appIds.length === 1 && byId.get(x.appId).t === t);
const fns = (x) => x.wires.map((w) => w.fn + "/" + w.color + "/" + w.section).join(" ");
check("prise 16 A : phase gris, neutre bleu foncé, terre vert/jaune en 1,5 mm², Ø16", fns(g("PC16")) === "phase/gris/1.5 neutre/bleu foncé/1.5 terre/vert/jaune/1.5" && g("PC16").diam === 16, fns(g("PC16")));
const CMDC = ["orange", "violet", "noir", "marron", "ivoire"];
check("point lumineux : retour (ronde : orange, violet, noir, marron, ivoire), neutre bleu, terre en 1,5 mm² ; interrupteur : phase rouge + retour",
  /^retour\/(orange|violet|noir|marron|ivoire)\/1\.5 neutre\/bleu\/1\.5 terre\/vert\/jaune\/1\.5$/.test(fns(g("LUM"))) && W.boxes.flatMap((b) => b.gaines).filter((x) => x.appIds && x.appIds.length === 1 && byId.get(x.appId).t === "INT").some((x) => /^phase\/rouge\/1\.5 retour\/(orange|violet|noir|marron|ivoire)\/1\.5$/.test(fns(x))), fns(g("LUM")));
const allNets = W.boxes.flatMap((b) => b.nets.map((n) => ({ ...n, box: b })));
check("n° 1 de chaque boîte = toutes les terres ensemble", W.boxes.every((b) => b.nets[0].fn === "terre" && b.nets[0].wires.length === b.gaines.filter((x) => x.wires.some((w) => w.fn === "terre")).length));
check("chaque raccordement réunit au moins 2 fils (rien ne reste en l'air)", allNets.every((n) => n.wires.length >= 2), allNets.filter((n) => n.wires.length < 2).map((n) => n.box.n + " " + n.label).join(", "));
console.log("    alimentations :", W.boxes.map((b) => b.n + " " + b.gaines.filter((x) => x.kind === "alim").map((x) => `${x.circuit} Ø${x.diam} ${x.wires.length} fils`).join(" | ")).join(" · "));
check("alimentation : une seule gaine par boîte (phase + neutre de chaque circuit, une seule terre), divisée seulement si elle passait en Ø25 (terre dans la 1re)",
  W.boxes.every((b) => { const A = b.gaines.filter((x) => x.kind === "alim");
    return b.circuits.every((cn) => A.some((x) => x.circuits.includes(cn) && x.wires.some((w) => w.fn === "phase" && w.circuit === cn) && x.wires.some((w) => w.fn === "neutre" && w.circuit === cn)))
      && A.reduce((s, x) => s + x.wires.filter((w) => w.fn === "terre").length, 0) === 1 && A[0].wires.some((w) => w.fn === "terre") && A.every((x) => x.diam < 25); }),
  W.boxes.map((b) => b.gaines.filter((x) => x.kind === "alim").map((x) => `${x.circuit} Ø${x.diam} (${x.wires.length} fils)`).join(" | ")).join(" ; "));
check("lignes directes : prises spécialisées, sorties de câble et RJ45 (tableau → appareil)", W.direct.length === T("PC20").length + T("SC").length + T("RJ45").length && W.direct.every((x) => x.length > 2));

console.log("Couleurs par circuit, gaines partagées, câble extérieur (v34)");
{
  const G = W.boxes.flatMap((b) => b.gaines.map((g) => ({ ...g, box: b })));
  // couleurs par type de circuit ; bagues = n° du circuit sur la paire de fils de l'alimentation
  const alimW = W.boxes.flatMap((b) => b.gaines.filter((g) => g.kind === "alim").flatMap((g) => g.wires));
  const kindOf = new Map(C.map((c) => [c.n, c.kind]));
  const colOk = alimW.filter((w) => w.fn === "phase" || w.fn === "neutre").every((w) => (kindOf.get(w.circuit) === "prises" ? (w.fn === "phase" ? w.color === "gris" : w.color === "bleu foncé") : (w.fn === "phase" ? w.color === "rouge" : w.color === "bleu")) && w.bague === w.circuit.replace("C", ""));
  check("couleurs par type : prises gris/bleu foncé, éclairage rouge/bleu ; bague n° du circuit (sans « C ») sur chaque paire de l'alimentation",
    colOk && alimW.some((w) => w.color === "gris") && alimW.some((w) => w.color === "rouge"), alimW.filter((w) => w.fn === "phase").map((w) => `${w.circuit}:${w.color}:${w.bague}`).join(" "));
  const vv = G.find((g) => g.wires.some((w) => w.fn === "nav1"));
  const n1 = vv && vv.wires.find((w) => w.fn === "nav1"), n2 = vv && vv.wires.find((w) => w.fn === "nav2");
  const allCmd = G.flatMap((g) => g.wires.filter((w) => ["retour", "nav1", "nav2"].includes(w.fn))).every((w) => CMDC.includes(w.color));
  check("ronde des fils : retours et navettes dans orange, violet, noir, marron, ivoire ; les 2 navettes d'un va-et-vient de la même couleur",
    allCmd && (!vv || (n1.color === n2.color && n1.n !== n2.n)), vv ? vv.no + " " + fns(vv) : "pas de va-et-vient");
  const grp = G.filter((g) => g.appIds && g.appIds.length > 1);
  check("appareils au même endroit (≤ 30 cm) : une seule gaine « P2 + P3… », chaque fil commun une seule fois",
    grp.length >= 3 && grp.every((g) => g.label.includes(" + ") && new Set(g.wires.filter((w) => w.net).map((w) => w.net)).size === g.wires.filter((w) => w.net).length), grp.map((g) => g.label).join(" | "));
  // un appareil à l'extérieur : câble du stock, âmes repérées à la couleur de leur fonction
  const ext = { id: "ext1", t: "APP", x: 1, y: -1, h: 180, lv: "rdc", room: null, rep: "AP9", ext: true }, extC = { id: "ext2", t: "INT", x: 1.2, y: -1.4, h: 110, lv: "rdc", room: null, rep: "I9", ext: true };
  const We = computeWiring({ items: [...items, ext, extC], links: [...links, { c: "ext2", l: "ext1" }], circuits: C.map((c, i) => (i === 0 ? { ...c, apps: [...c.apps, "ext1", "ext2"] } : c)),
    boxes: [{ id: "bx", n: "BX", lv: "rdc", x: 1, y: 0.5, apps: ["ext1", "ext2"] }], levels: ["rdc"], S });
  const ge = We.boxes[0].gaines.find((g) => g.appId === "ext1"), gi = We.boxes[0].gaines.find((g) => g.appId === "ext2");
  const core = (g, fn) => (g.wires.find((w) => w.fn === fn) || {}).core;
  check("extérieur : applique en 3G1,5 (vert/jaune, bleu = neutre, marron repéré à la couleur du retour) ; interrupteur en 4G1,5 (phase, retour, terre, une âme isolée, jamais le bleu)",
    ge && ge.cable === "3G1,5" && core(ge, "neutre") === "bleu" && core(ge, "terre") === "vert/jaune" && core(ge, "retour") === "marron" && CMDC.includes(ge.wires.find((w) => w.fn === "retour").color)
    && gi && gi.cable === "4G1,5" && gi.wires.some((w) => w.fn === "isole") && !gi.wires.some((w) => w.core === "bleu") && gi.wires.some((w) => w.fn === "terre" && w.net === "T"),
    ge && `${ge.cable} ${ge.wires.map((w) => w.fn + ":" + w.core + ">" + w.color)} | ${gi && gi.cable} ${gi && gi.wires.map((w) => w.fn + ":" + w.core)}`);
  const Wb = computeWiring({ items: [...items, ext, extC], links: [...links, { c: "ext2", l: "ext1" }], circuits: C.map((c, i) => (i === 0 ? { ...c, apps: [...c.apps, "ext1", "ext2"] } : c)),
    boxes: [{ id: "bx", n: "BX", lv: "rdc", x: 1, y: 0.5, apps: ["ext1", "ext2"] }], levels: ["rdc"], S: { ...S, cableBleuLibre: true } });
  const gb = Wb.boxes[0].gaines.find((g) => g.appId === "ext2");
  check("réglage « le bleu peut servir » : interrupteur extérieur en 3G1,5", gb && gb.cable === "3G1,5" && !gb.wires.some((w) => w.fn === "isole"), gb && gb.cable);
}

console.log("Règles KiTéOHM (v38) : circuits par boîte, ronde harmonisée, télérupteur");
{
  const CB = circuitsByBox(items, links, P.boxes, S);
  const boxOfApp = new Map(); P.boxes.forEach((b) => b.apps.forEach((id) => boxOfApp.set(id, b.id)));
  const perBox = P.boxes.map((b) => ({ b, cs: CB.filter((c) => c.box === b.id) }));
  check("circuits par boîte : chaque boîte a au plus un circuit prises (sauf au-delà de 8) et ses circuits ne sortent pas de la boîte",
    perBox.every(({ b, cs }) => cs.filter((c) => c.kind === "prises").length <= Math.max(1, Math.ceil(cs.filter((c) => c.kind === "prises").flatMap((c) => c.apps).length / 8)) && cs.every((c) => c.apps.every((id) => boxOfApp.get(id) === b.id)))
    && CB.filter((c) => c.kind === "prises").every((c) => c.apps.length <= 8 && c.section === 1.5) && /^C1$/.test(CB[0].n),
    perBox.map(({ b, cs }) => `${b.n}: ${cs.map((c) => c.kind[0] + c.apps.length).join(" ")}`).join(" · "));
  const inC = new Set(CB.flatMap((c) => c.apps));
  check("circuits par boîte : tous les appareils restent dans un circuit (lignes directes et RJ45 inchangées)", powered.every((a) => inC.has(a.id)) && CB.some((c) => c.kind === "comm"));
  // cuisine : 2,5 mm², circuit à part ; commandes au même endroit = même circuit
  const ck = [0, 1, 2].map((i) => ({ id: "k" + i, t: "PC16", x: 50 + i, y: 50, lv: "rdc", room: "Cuisine", rep: "PK" + i }));
  const cmd2 = [{ id: "m1", t: "INT", x: 60, y: 60, lv: "rdc", rep: "I71" }, { id: "m2", t: "INT", x: 60.1, y: 60, lv: "rdc", rep: "I72" }];
  const lamps = Array.from({ length: 9 }, (_, i) => ({ id: "l" + i, t: "SPOT", x: 61 + i * 0.5, y: 61, lv: "rdc", rep: "S" + i }));
  const its = [...ck, ...cmd2, ...lamps], lk = [...lamps.slice(0, 5).map((l) => ({ c: "m1", l: l.id })), ...lamps.slice(5).map((l) => ({ c: "m2", l: l.id }))];
  const CK = circuitsByBox(its, lk, [{ id: "bk", n: "LI09", lv: "rdc", x: 55, y: 55, apps: its.map((a) => a.id) }], S);
  const cu = CK.find((c) => c.kind === "cuisine"), circOfId = (id) => CK.find((c) => c.apps.includes(id));
  check("prises de cuisine : circuit à part en 2,5 mm² / 20 A ; deux commandes au même endroit sur le même circuit (phase commune), même au-delà de 8 points",
    cu && cu.section === 2.5 && cu.prot === 20 && cu.apps.length === 3 && circOfId("m1") === circOfId("m2"), CK.map((c) => `${c.kind}:${c.apps.length}`).join(" "));
  // harmonisation : 3 boîtes avec un allumage simple (et une avec un va-et-vient posé avant) → retour orange partout pour l'allumage simple
  const H = [], HL = [], HB = [];
  for (let k = 0; k < 3; k++) {
    const i = { id: "hi" + k, t: "INT", x: 100 + k * 10, y: 100, lv: "rdc", rep: "I8" + k }, l = { id: "hl" + k, t: "LUM", x: 101 + k * 10, y: 101, lv: "rdc", rep: "L8" + k };
    H.push(i, l); HL.push({ c: i.id, l: l.id }); HB.push({ id: "hb" + k, n: "LH" + k, lv: "rdc", x: 100.5 + k * 10, y: 100.5, apps: [i.id, l.id] });
  }
  const v1 = { id: "hv1", t: "VV", x: 100, y: 98, lv: "rdc", rep: "VV9" }, v2 = { id: "hv2", t: "VV", x: 100.4, y: 99.5, lv: "rdc", rep: "VV9A" }, vl = { id: "hvl", t: "LUM", x: 100.2, y: 99, lv: "rdc", rep: "L9" };
  H.push(v1, v2, vl); HL.push({ c: "hv1", l: "hvl" }, { c: "hv2", l: "hvl" }); HB[0].apps.push("hv1", "hv2", "hvl");
  const HC = circuitsByBox(H, HL, HB, S);
  const HW = computeWiring({ items: [...H, { id: "ht", t: "TAB", x: 90, y: 90, lv: "rdc" }], links: HL, circuits: HC, boxes: HB, levels: ["rdc"], S });
  const retOf = (id) => HW.boxes.flatMap((b) => b.gaines).find((g) => g.appIds && g.appIds.includes(id)).wires.find((w) => w.fn === "retour").color;
  const vvG = HW.boxes[0].gaines.find((g) => g.appIds && g.appIds.includes("hv1"));
  check("harmonisation : l'allumage le plus fréquent du chantier (interrupteur + lampe) a le retour orange dans toutes les boîtes ; le va-et-vient prend les couleurs suivantes",
    ["hl0", "hl1", "hl2"].every((id) => retOf(id) === "orange") && retOf("hvl") === "violet" && vvG.wires.filter((w) => w.fn === "nav1" || w.fn === "nav2").every((w) => w.color === "noir"),
    ["hl0", "hl1", "hl2", "hvl"].map(retOf).join(" "));
  // télérupteur (3 commandes) : bague T1 sur ses fils de l'alimentation
  const t3 = [0, 1, 2].map((k) => ({ id: "tc" + k, t: "BP", x: 200 + k * 2, y: 200, lv: "rdc", rep: "BP" + k })), tlL = { id: "tl", t: "LUM", x: 201, y: 201, lv: "rdc", rep: "L7" };
  const TI = [...t3, tlL], TL_ = t3.map((c) => ({ c: c.id, l: "tl" })), TB = [{ id: "tb", n: "LT1", lv: "rdc", x: 201, y: 200.5, apps: TI.map((a) => a.id) }];
  const TW = computeWiring({ items: [...TI, { id: "ht2", t: "TAB", x: 190, y: 190, lv: "rdc" }], links: TL_, circuits: circuitsByBox(TI, TL_, TB, S), boxes: TB, levels: ["rdc"], S });
  const ta = TW.boxes[0].gaines.find((g) => g.kind === "alim").wires;
  check("télérupteur : commande et retour du télérupteur dans l'alimentation avec la bague T1 ; commande dans la ronde",
    ta.filter((w) => w.fn === "cmdTL" || w.fn === "retTL").length === 2 && ta.filter((w) => w.fn === "cmdTL" || w.fn === "retTL").every((w) => w.bague === "T1") && CMDC.includes(ta.find((w) => w.fn === "cmdTL").color),
    ta.map((w) => `${w.fn}:${w.color}:${w.bague}`).join(" "));
}

console.log("Tracé des gaines et boîtes gardées (v32)");
{
  const b0 = P.boxes[0], id = b0.apps.find((x) => items.find((a) => a.id === x && !["LUM", "SPOT"].includes(a.t)));
  const a = items.find((x) => x.id === id), mid = { x: (a.x + b0.x) / 2 + 1, y: (a.y + b0.y) / 2 };
  const boxes2 = P.boxes.map((b) => (b === b0 ? { ...b, routes: { [id]: [mid] } } : b));
  const W2 = computeWiring({ items, links, circuits: C, boxes: boxes2, levels: ["rdc"], S });
  const g1 = W.boxes[0].gaines.find((g) => g.appId === id), g2 = W2.boxes[0].gaines.find((g) => g.appId === id);
  const extra = (Math.hypot(mid.x - b0.x, mid.y - b0.y) + Math.hypot(a.x - mid.x, a.y - mid.y) - Math.hypot(a.x - b0.x, a.y - b0.y)) * (1 + S.majoration / 100);
  check("point de passage : la gaine passe par lui (+10 % gardés), marquée « tracée à la main »", g2.routed && !g1.routed && g2.length - g1.length > extra - S.arrondi - 0.01 && g2.length - g1.length < extra + S.arrondi + 0.01, `${g1.length} → ${g2.length} (+${extra.toFixed(2)})`);
  const keep = [{ ...P.boxes[1], x: P.boxes[1].x + 2, locked: true, routes: { tab: [{ x: 1, y: 1 }] } }];
  const P2 = placeBoxes(items, links, C, { rdc: { x: 293 * k2, y: 410 * k2 } }, S, { keep });
  const kb = P2.boxes.find((b) => b.id === keep[0].id), all = P2.boxes.flatMap((b) => b.apps);
  check("recalcul : la boîte gardée ne bouge pas (place, nom, appareils, tracés) ; les autres reçoivent le reste, sans doublon ni oubli",
    kb && kb.x === keep[0].x && kb.n === keep[0].n && kb.routes.tab.length === 1 && keep[0].apps.every((x) => kb.apps.includes(x)) && new Set(all).size === all.length && new Set(all).size === new Set(P.boxes.flatMap((b) => b.apps)).size && new Set(P2.boxes.map((b) => b.id)).size === P2.boxes.length,
    JSON.stringify(P2.boxes.map((b) => [b.id, b.apps.length])));
}

console.log("Schéma de boîte pour le câbleur (v33)");
{
  const Z = parseSizes("2, 3,5 ;8,12");
  const Zk = parseSizes(S.bornes);
  check("connecteurs de KiTéOHM par défaut : 2, 3, 4, 5, 6, 8, 10, 12 ; 7 fils → 8 entrées, 9 → 10, 20 → 12 + 10 avec un pont",
    Zk.join() === "2,3,4,5,6,8,10,12" && connectorsFor(7, Zk).list.join() === "8" && connectorsFor(9, Zk).list.join() === "10" && JSON.stringify(connectorsFor(20, Zk)) === '{"list":[12,10],"ponts":1}', Zk.join());
  const c = (n) => JSON.stringify(connectorsFor(n, Z));
  check("connecteurs : 2 fils → 2 entrées, 4 → 5, 12 → 12, 13 → 12 + 3 avec un pont, 20 → 12 + 12 avec un pont",
    c(2) === '{"list":[2],"ponts":0}' && c(4) === '{"list":[5],"ponts":0}' && c(12) === '{"list":[12],"ponts":0}' && c(13) === '{"list":[12,3],"ponts":1}' && c(20) === '{"list":[12,12],"ponts":1}', [2, 4, 12, 13, 20].map(c).join(" "));
  const B = W.boxes[0], st = boxSteps(B, Z), fnOrder = st.map((x) => x.fn);
  const lastN = fnOrder.lastIndexOf("neutre"), firstP = fnOrder.indexOf("phase"), lastP = fnOrder.lastIndexOf("phase"), firstR = fnOrder.findIndex((f) => !["terre", "neutre", "phase"].includes(f));
  const wired = B.gaines.reduce((s, g) => s + g.wires.filter((w) => w.n != null).length, 0);
  // v47 (Kévin) : terres, puis circuit par circuit neutre puis phase (cuisine, prises, éclairage), puis retours et navettes
  const pairs = fnOrder.slice(1, firstR < 0 ? undefined : firstR);
  const byPair = pairs.every((f, i) => f === (i % 2 ? "phase" : "neutre"));
  const RK = { cuisine: 0, specialise: 1, prises: 2, eclairage: 3 }, circK = (lab) => (C.find((c) => lab.endsWith(" " + c.n)) || {}).kind;
  const kinds = st.filter((x) => x.fn === "neutre").map((x) => RK[circK(x.label)] ?? 4);
  check("étapes dans l'ordre de câblage (v47) : n° 1 = terres, puis neutre et phase circuit par circuit (cuisine, prises, éclairage), puis retours et navettes",
    fnOrder[0] === "terre" && byPair && (firstR < 0 || lastP < firstR) && kinds.every((k, i) => !i || kinds[i - 1] <= k) && st.every((x, i) => x.n === i + 1), fnOrder.join(",") + " " + kinds.join(","));
  const mat = boxMaterial(st), nConn = mat.sizes.reduce((s, [, n]) => s + n, 0);
  check("chaque fil de chaque gaine apparaît dans une étape ; matériel = un connecteur par raccordement (+ ponts)",
    st.reduce((s, x) => s + x.wires.length, 0) === wired && nConn === st.length + mat.ponts && boxChecks(B, st).every((t) => /un seul fil|sans raccordement/.test(t)), JSON.stringify(mat));
  const svg = schemaSVG(B, st, { sides: { A: "Chambre 1", C: "Garage" } });
  const nW = B.gaines.reduce((s, g) => s + g.wires.length, 0), traced = st.filter((x) => ["retour", "nav1", "nav2", "cmdTL", "retTL"].includes(x.fn));
  check("dessin de la boîte (v47) : faces et pièces à l'extérieur, chaque fil jusqu'à sa borne numérotée, sans Ph / N / PE, un point par retour/navette",
    [">A · Chambre 1<", ">B<", ">C · Garage<", ">D<"].every((f) => svg.includes(f)) && !/>(Ph|PE|N)( C\d+)?</.test(svg) && /LI\d+\.\d+<\/text>/.test(svg) && /[\d,]+ m · Ø\d+</.test(svg) && (svg.match(/class="term"/g) || []).length === nW && (svg.match(/class="w"/g) || []).length === nW
    && (svg.match(/class="node"/g) || []).length === traced.length && (svg.match(/class="lnk"/g) || []).length === traced.reduce((s, x) => s + x.wires.length, 0) && /data-c="C\d/.test(svg), `${nW} fils, ${traced.length} points`);
}

{
  // points d'accroche (v37) : 6 par face, gaines rangées dans l'ordre de leur direction (pas de croisement), épinglage respecté
  const box = { x: 0, y: 0 }, deps = [-3, -1, 0.5, 2, 4].map((x, k) => ({ id: "g" + k, p: { x, y: -5 }, keys: ["g" + k] }));
  const L = portLayout(box, deps, 6), xs = deps.map((d) => portXY(box, 1, 6, L.get(d.id).face, L.get(d.id).slot).x);
  const pinned = portLayout(box, deps, 6, { g4: { f: "A", i: 0 } });
  const crosses = (P) => { const s = deps.map((d) => ({ x0: portXY(box, 1, 6, P.get(d.id).face, P.get(d.id).slot).x, x1: d.p.x })); return s.some((a, i) => s.some((b, j) => j > i && (a.x0 - b.x0) * (a.x1 - b.x1) < 0)); };
  check("points d'accroche : 5 gaines vers le haut sur la face A, dans l'ordre gauche → droite, sans croisement ; une gaine épinglée garde son point",
    deps.every((d) => L.get(d.id).face === "A") && xs.every((x, i) => i === 0 || x > xs[i - 1]) && !crosses(L) && pinned.get("g4").slot === 0 && pinned.get("g4").face === "A"
    && new Set(deps.map((d) => pinned.get(d.id).slot)).size === 5, xs.join(" "));
}

console.log("Modes de pieuvre (v39)");
{
  const tab = items.find((a) => a.t === "TAB") || { x: 0, y: 0 };
  const tabs = { rdc: { x: tab.x, y: tab.y } };
  const prox = placeBoxes(items, links, C, tabs, S), eq = placeBoxes(items, links, C, tabs, S, { mode: "equilibre" });
  const deps = (r) => computeWiring({ items, links, circuits: C, boxes: r.boxes, levels: ["rdc"], S }).boxes.map((b) => b.gaines.length);
  const dP = deps(prox), dE = deps(eq), spread = (d) => Math.max(...d) - Math.min(...d);
  const allIn = (r) => { const s = new Set(r.boxes.flatMap((b) => b.apps)); return buildUnits(items, links, C).every((u) => u.ids.every((id) => s.has(id))) && r.boxes.flatMap((b) => b.apps).length === s.size; };
  check("pieuvre équilibrée : même nombre de boîtes que la proximité, départs plus réguliers, tous les appareils placés, ≤ 18 départs et ≤ 6 par face",
    eq.boxes.length === prox.boxes.length && spread(dE) <= spread(dP) && allIn(eq) && dE.every((n) => n <= 18) && !eq.issues.length, `proximité ${dP.join("/")} · équilibrée ${dE.join("/")}`);
  // par pièce : 3 pièces (dont une petite) + un appareil extérieur
  const sq = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
  const rooms = { rdc: [{ name: "Séjour", poly: sq(0, 0, 6, 5) }, { name: "Chambre", poly: sq(6, 0, 10, 4) }, { name: "WC", poly: sq(6, 4, 7.5, 5) }] };
  const R = [], RL = [];
  const put = (id, t, x, y, room) => R.push({ id, t, x, y, lv: "rdc", room, rep: id });
  for (let i = 0; i < 5; i++) put("sp" + i, "PC16", 0.3 + i, 0.3, "Séjour");
  put("si", "INT", 5.7, 4.6, "Séjour"); put("sl", "LUM", 3, 2.5, "Séjour"); RL.push({ c: "si", l: "sl" });
  for (let i = 0; i < 3; i++) put("cp" + i, "PC16", 6.3 + i, 0.3, "Chambre");
  put("ci", "INT", 6.3, 3.7, "Chambre"); put("cl", "LUM", 8, 2, "Chambre"); RL.push({ c: "ci", l: "cl" });
  put("wi", "INT", 6.3, 4.3, "WC"); put("wl", "LUM", 6.8, 4.5, "WC"); RL.push({ c: "wi", l: "wl" });
  put("ex", "PC16", 11, 1, null);
  const RC = computeCircuits(R, RL, S), pr = placeBoxes(R, RL, RC, { rdc: { x: 0, y: 5 } }, S, { mode: "piece", rooms });
  const roomOfBox = (b) => rooms.rdc.find((r) => pointInPoly(b.x, b.y, r.poly))?.name;
  const boxWith = (id) => pr.boxes.find((b) => b.apps.includes(id));
  check("pieuvre par pièce : une boîte par pièce posée dans sa pièce ; le WC (2 départs) rejoint la pièce voisine ; l'appareil extérieur va à la pièce la plus proche",
    pr.boxes.length === 2 && pr.boxes.map(roomOfBox).sort().join() === "Chambre,Séjour" && boxWith("wl") === boxWith("cl") && boxWith("ex") === boxWith("cp0") && boxWith("sl") === boxWith("sp0"),
    pr.boxes.map((b) => `${b.n}@${roomOfBox(b)}:${b.apps.length}`).join(" "));
}

console.log("Packs (v40)");
{
  const sq = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3.5 }, { x: 0, y: 3.5 }];
  const door = { kind: "porte", j1: { x: 3, y: 3.5 }, j2: { x: 3.8, y: 3.5 }, hinge: { x: 3.8, y: 3.5 } }, win = { kind: "fenetre", j1: { x: 1.5, y: 0 }, j2: { x: 2.5, y: 0 } };
  const room = { name: "Chambre 2", poly: sq, area: 14, label: { x: 2, y: 1.75 } };
  const pk = packFor(room.name, PACK_DEFAULTS), need = missing(pk, room, []);
  const r = placePack(room, [door, win], need, []);
  const of = (t) => r.list.filter((x) => x.t === t), onWall = (p) => Math.min(p.x, 4 - p.x, p.y, 3.5 - p.y) < 0.2;
  const I = of("INT")[0], P = of("PC16");
  check("pack chambre : 3 prises sur les murs (loin de la fenêtre et des angles), point lumineux au centre, interrupteur à 15-30 cm de la porte côté poignée, RJ45, liaison interrupteur → lumière",
    pk.id === "chambre" && P.length === 3 && P.every(onWall) && P.every((p) => !(p.y < 0.2 && p.x > 1.2 && p.x < 2.8)) && of("LUM").length === 1 && Math.abs(of("LUM")[0].x - 2) < 0.01
    && I && Math.abs(I.y - 3.38) < 0.01 && I.x < 3 && I.x > 2.65 && of("RJ45").length === 1 && r.links.some((l) => r.list[l.c].t === "INT" && r.list[l.l].t === "LUM"), JSON.stringify(r.list));
  const have = [{ t: "PC16", x: 0.1, y: 1 }, { t: "VV", x: 2.8, y: 3.4 }, { id: "x9", t: "SPOT", x: 2, y: 2 }];
  const n2 = missing(pk, room, have), r2 = placePack(room, [door], n2, have);
  check("pack : seul ce qui manque est ajouté (un va-et-vient compte pour la commande, un spot pour la lumière) ; séjour : prises selon la norme (1 par 4 m², 5 min, 7 au-delà de 28 m²)",
    n2.map((x) => x.t + x.n).sort().join() === "PC162,RJ451" && !r2.list.some((x) => x.t === "INT" || x.t === "LUM") && prisesNorme(20) === 5 && prisesNorme(31.5) === 8 && prisesNorme(26) === 7 && prisesNorme(30) === 8 && packFor("Pièce de vie", PACK_DEFAULTS).id === "sejour" && packFor("Salle d'eau", PACK_DEFAULTS).id === "sdb",
    JSON.stringify(n2));
}

console.log("Bande dans un QR code (v49)");
{
  const W = computeWiring({ items, links, circuits: C, boxes: P.boxes, levels: ["rdc"], S });
  const B = W.boxes[0], st = boxSteps(B, parseSizes(S.bornes));
  const sheet = { box: B, steps: st, sides: { A: "Chambre 1", B: "Séjour", C: "", D: "Tableau" }, level: "RDC", ch: { client: "Maisons Test", nom: "ESSAI", numero: "99999" }, tabAng: 1.2, code: "99999-" + B.n, model: "Boîte pavillonnaire carrée", cover: "haut" };
  const enc = await encodeSheet(packSheet(sheet)), back = unpackSheet(await decodeSheet(enc)), st2 = boxSteps(back.box, back.sizes);
  const same = st2.length === st.length && st2.every((x, i) => x.n === st[i].n && x.fn === st[i].fn && x.wires.length === st[i].wires.length && x.wires.every((w, j) => w.color === st[i].wires[j].color && w.gaine === st[i].wires[j].gaine)) && back.head.box === B.n && back.sides.A === "Chambre 1";
  const u = await sheetUrl(sheet);
  check("bande compressée puis relue : mêmes raccordements, fils, couleurs et gaines ; adresse assez courte pour un QR code",
    same && !u.tooBig && /bande\.html#b=[A-Za-z0-9_-]+$/.test(u.url), `${enc.length} caractères, ${u.url.length} dans l'adresse`);
}

console.log("Tableau électrique (v46)");
{
  const mk = (kind, n, k, prot) => Array.from({ length: n }, (_, i) => ({ n: "C" + (k + i), kind, prot, name: kind }));
  const C = [...mk("eclairage", 3, 1, 10), ...mk("prises", 4, 4, 16), ...mk("cuisine", 2, 8, 20), ...mk("specialise", 4, 10, 20), { n: "COM", kind: "comm" }];
  const T = autoTableau(C, { model: "r9-13x4", area: 120 }), P = protections(T.rows), cbs = T.rows.flat().filter((x) => x.k === "cb");
  const ids = T.rows.map((r) => r[0]);
  const specUnderA = cbs.filter((x) => +x.c.slice(1) >= 10).every((x) => P.get(x.id).type === "A");
  check("auto : 3 ID type AC (> 100 m²) + 1 type A, une rangée chacun, COM sans disjoncteur, spécialisés sous type A",
    T.rows.length === 4 && ids.filter((x) => x.type === "AC").length === 3 && ids.filter((x) => x.type === "A").length === 1 && cbs.length === 13 && specUnderA && tableauIssues(T, C).length === 0,
    JSON.stringify(T.rows.map((r) => r.map((x) => x.k === "id" ? "ID" + x.type : x.c))) + " " + JSON.stringify(tableauIssues(T, C)));
  const sp = cbs.find((x) => x.c === "C10"), firstAC = T.rows[0];
  const T2 = { ...T, rows: moveItem(T.rows, sp.id, 0, null) };
  const iss = tableauIssues(T2, C);
  check("déplacer un spécialisé sous un ID type AC : alerte type A ; un circuit avant tout ID : alerte « aucun différentiel »",
    iss.some((x) => /C10.*type A/.test(x)) && tableauIssues({ ...T, rows: moveItem(T.rows, firstAC[1].id, 0, firstAC[0].id) }, C).some((x) => /aucun interrupteur différentiel/.test(x)), JSON.stringify(iss));
  const S2 = syncTableau({ model: "r9-13x1", rows: T.rows }, [...C.filter((c) => c.n !== "C4"), { n: "C20", kind: "prises", prot: 16 }]);
  const big = suggestModel({ model: "r9-13x1", rows: T.rows });
  check("synchro : circuit disparu retiré, nouveau circuit signalé ; coffret 1 rangée trop petit → suggestion 4 rangées ; ajout sous un ID du bon type",
    !S2.rows.flat().some((x) => x.c === "C4") && S2.missing.map((c) => c.n).join() === "C20" && tableauIssues(S2, C).some((x) => /rangées pour un coffret de 1/.test(x)) && big.rows >= 4
      && protections(addBreaker(T.rows, { n: "C21", kind: "specialise", prot: 32 })).size === 14, big.id);
}

console.log(`\n${ok} vérifications réussies, ${fails.length} en échec.`);
if (fails.length) process.exit(1);
