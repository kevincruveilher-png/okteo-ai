// Tests du câblage (sans navigateur) : diamètre des gaines (exemples de Kévin) et répartition des circuits sur EVRARD.
import fs from "node:fs";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractSegments } from "../src/walls/extract.js";
import { detectDevices, pageTexts } from "../src/walls/devices.js";
import { gaineFor } from "../src/cablage/gaine.js";
import { computeCircuits, checkCircuits } from "../src/cablage/circuits.js";
import { CAB_DEFAULTS as S } from "../src/cablage/settings.js";

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

console.log(`\n${ok} vérifications réussies, ${fails.length} en échec.`);
if (fails.length) process.exit(1);
