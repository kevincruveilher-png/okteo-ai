// Tests du câblage (sans navigateur) : diamètre des gaines (exemples de Kévin) et répartition des circuits sur EVRARD.
import fs from "node:fs";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractSegments } from "../src/walls/extract.js";
import { detectDevices, pageTexts } from "../src/walls/devices.js";
import { gaineFor } from "../src/cablage/gaine.js";
import { computeCircuits, checkCircuits } from "../src/cablage/circuits.js";
import { CAB_DEFAULTS as S } from "../src/cablage/settings.js";
import { placeBoxes, buildUnits, faceToward, portLayout, portXY } from "../src/cablage/boites.js";
import { computeWiring, gaineLength, cableColors } from "../src/cablage/gaines.js";
import { connectorsFor, boxSteps, boxMaterial, boxChecks, parseSizes, schemaSVG } from "../src/cablage/schema.js";

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
check("prises 16 A : au plus 8 par circuit, en 2,5 mm² / 20 A", pr.length === Math.ceil(T("PC16").length / 8) && pr.every((c) => c.apps.length <= 8 && c.section === 2.5), pr.map((c) => c.apps.length).join(","));
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
check("prise 16 A : phase rouge, neutre bleu, terre vert/jaune en 2,5 mm², Ø16", fns(g("PC16")) === "phase/rouge/2.5 neutre/bleu/2.5 terre/vert/jaune/2.5" && g("PC16").diam === 16, fns(g("PC16")));
const CMDC = ["orange", "marron", "noir", "ivoire"];
check("point lumineux : retour (orange, marron, noir ou ivoire), neutre, terre en 1,5 mm² ; interrupteur : phase + retour",
  /^retour\/(orange|marron|noir|ivoire)\/1\.5 neutre\/(bleu|bleu foncé)\/1\.5 terre\/vert\/jaune\/1\.5$/.test(fns(g("LUM"))) && W.boxes.flatMap((b) => b.gaines).filter((x) => x.appIds && x.appIds.length === 1 && byId.get(x.appId).t === "INT").some((x) => /^phase\/(rouge|gris)\/1\.5 retour\/(orange|marron|noir|ivoire)\/1\.5$/.test(fns(x))), fns(g("LUM")));
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
  // dans une même gaine, deux circuits de même section n'ont jamais les mêmes couleurs de phase
  const clash = G.filter((g) => { const ph = g.wires.filter((w) => w.fn === "phase"); return ph.some((w, i) => ph.some((v, j) => j > i && v.net !== w.net && v.color === w.color && v.section === w.section)); });
  const two = W.boxes.find((b) => { const secs = b.gaines.filter((g) => g.kind === "alim").flatMap((g) => g.wires.filter((w) => w.fn === "phase")); return secs.some((w, i) => secs.some((v, j) => j > i && v.section === w.section)); });
  const ph2 = two && two.gaines.filter((g) => g.kind === "alim").flatMap((g) => g.wires.filter((w) => w.fn === "phase"));
  check("couleurs : dans une boîte, 2 circuits de même section = rouge/bleu puis gris/bleu foncé ; jamais deux phases pareilles dans une gaine",
    !clash.length && two && ph2.some((w) => w.color === "rouge") && ph2.some((w) => w.color === "gris") && two.gaines.some((g) => g.wires.some((w) => w.color === "bleu foncé")), clash.map((g) => g.no).join(" "));
  const vv = G.find((g) => g.wires.some((w) => w.fn === "nav1"));
  const n1 = vv && vv.wires.find((w) => w.fn === "nav1"), n2 = vv && vv.wires.find((w) => w.fn === "nav2");
  const allCmd = G.flatMap((g) => g.wires.filter((w) => ["retour", "nav1", "nav2"].includes(w.fn))).every((w) => CMDC.includes(w.color));
  check("retours et navettes : orange, marron, noir, ivoire à tour de rôle ; les 2 navettes d'un va-et-vient de la même couleur",
    allCmd && (!vv || (n1.color === n2.color && n1.n !== n2.n)), vv ? vv.no + " " + fns(vv) : "pas de va-et-vient");
  const grp = G.filter((g) => g.appIds && g.appIds.length > 1);
  check("appareils au même endroit (≤ 30 cm) : une seule gaine « P2 + P3… », chaque fil commun une seule fois",
    grp.length >= 3 && grp.every((g) => g.label.includes(" + ") && new Set(g.wires.filter((w) => w.net).map((w) => w.net)).size === g.wires.filter((w) => w.net).length), grp.map((g) => g.label).join(" | "));
  // un appareil à l'extérieur : câble
  const ext = { id: "ext1", t: "APP", x: 1, y: -1, h: 180, lv: "rdc", room: null, rep: "AP9", ext: true }, extC = { id: "ext2", t: "INT", x: 1.2, y: 1, h: 110, lv: "rdc", room: "Entrée", rep: "I9" };
  const We = computeWiring({ items: [...items, ext, extC], links: [...links, { c: "ext2", l: "ext1" }], circuits: C.map((c, i) => (i === 0 ? { ...c, apps: [...c.apps, "ext1", "ext2"] } : c)),
    boxes: [{ id: "bx", n: "BX", lv: "rdc", x: 1, y: 0.5, apps: ["ext1", "ext2"] }], levels: ["rdc"], S });
  const ge = We.boxes[0].gaines.find((g) => g.appId === "ext1"), gi = We.boxes[0].gaines.find((g) => g.appId === "ext2");
  check("appareil à l'extérieur : câble 3G1,5 (marron, bleu, vert/jaune) ; à l'intérieur : fils",
    ge && ge.cable === "3G1,5" && ge.wires.map((w) => w.color).join() === "marron,bleu,vert/jaune" && !gi.cable && cableColors([{ fn: "phase" }, { fn: "retour" }, { fn: "neutre" }, { fn: "terre" }]).join() === "marron,noir,gris,vert/jaune", ge && (ge.cable + " " + ge.wires.map((w) => w.color)));
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
  check("étapes dans l'ordre de câblage : n° 1 = terres, puis tous les neutres, puis les phases, puis retours et navettes",
    fnOrder[0] === "terre" && lastN < firstP && (firstR < 0 || lastP < firstR) && st.every((x, i) => x.n === i + 1), fnOrder.join(","));
  const mat = boxMaterial(st), nConn = mat.sizes.reduce((s, [, n]) => s + n, 0);
  check("chaque fil de chaque gaine apparaît dans une étape ; matériel = un connecteur par raccordement (+ ponts)",
    st.reduce((s, x) => s + x.wires.length, 0) === wired && nConn === st.length + mat.ponts && boxChecks(B, st).every((t) => /un seul fil|sans raccordement/.test(t)), JSON.stringify(mat));
  const svg = schemaSVG(B, st, { sides: { A: "côté Chambre 1" } });
  const nW = B.gaines.reduce((s, g) => s + g.wires.length, 0), traced = st.filter((x) => ["retour", "nav1", "nav2", "cmdTL", "retTL"].includes(x.fn));
  check("dessin de la boîte : faces A–D, chaque fil dessiné jusqu'à sa borne numérotée, un point par retour/navette, traits intérieurs",
    ["A haut", ">A<", ">B<", ">C<", ">D<"].every((f) => svg.includes(f)) && (svg.match(/class="term"/g) || []).length === nW && (svg.match(/class="w"/g) || []).length === nW
    && (svg.match(/class="node"/g) || []).length === traced.length && (svg.match(/class="lnk"/g) || []).length === traced.reduce((s, x) => s + x.wires.length, 0) && svg.includes("côté Chambre 1")
    && /data-c="C\d/.test(svg), `${nW} fils, ${traced.length} points`);
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

console.log(`\n${ok} vérifications réussies, ${fails.length} en échec.`);
if (fails.length) process.exit(1);
