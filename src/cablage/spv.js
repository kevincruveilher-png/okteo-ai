// Fichier .spv pour Counter (lot 4 de la reprise des paramètres du BE, 06/11/2026, décisions n° 53 à 59 de Kévin).
// Pur (sans DOM). Format relevé sur les .spv du BE : texte ASCII sans accent, fin de ligne CRLF, pas de ligne de titres,
// une ligne par gaine (bras, alimentation, ligne directe, tronçon de pontage), 24 champs séparés par « ; » :
//  1 départ (boîte + face « LI04 D », « TAB », « TRI » = coffret de communication, ou appareil d'où part un pontage)
//  2 gaine (ICTA16, ICTA20, ICTA25, ICTA_V20…) · 3 longueur de la gaine (m) · 4 arrivée : repères « + » et pièce
//  5 câble « U1000R2V_3G1.5_B-M-V/J (0.40) » · 6 vide · 7 fils rigides « B[6] R[6] V/J[6] (0.40) » · 8 fils 2,5
//  9 fils 1,5 (codes couleur triés, répétés) · 10 quantité 1 · 11 état ACTIVE (Counter écrit FAIT / DESACTIVE)
//  12 boîte livrée avec l'alimentation (KEO_BOITE_PAV) · 13 dossier « AF…_NOM » · 14 pavillonneur · 15 nom du chantier
//  16 n° d'affaire · 17-19 vides · 20 n° de gaine (LI04.13) ou repère de la ligne directe · 21 type (Bras, Alimentation,
//  Direct, Bras pontage) · 22 vide · 23 hauteur de l'arrivée (mm ; plafond 2500 ; alimentation 3200) · 24 longueur de
//  coupe des fils = gaine + surlongueur des fils (0,40 m).
// Un seul fichier, tout « à faire » (ACTIVE) : l'atelier le découpe lui-même. Lignes rangées pour produire les gaines en
// série : gaine, câble avant fils, composition, longueur (Counter n'exige aucun ordre).
import { cableCores } from "./gaines.js";

export const COULEUR_CODE = { "bleu": "B", "bleu clair": "B", "bleu foncé": "BF", "marron": "M", "gris": "GR", "ivoire": "IV", "blanc": "IV", "noir": "N", "orange": "O", "rouge": "R", "vert/jaune": "V/J", "violet": "V", "vert": "VE" };
export const ascii = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[;\r\n]/g, " ").replace(/[^\x20-\x7E]/g, "");
const num = (v, d) => { const s = (+v || 0).toFixed(d); return d === 1 ? s.replace(/\.0$/, "") : s; };
const code = (c) => COULEUR_CODE[String(c || "").toLowerCase()] || ascii(c).toUpperCase().slice(0, 3);
const sortCodes = (L) => L.slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

// câble : « 3G1,5 » → « U1000R2V_3G1.5_B-M-V/J » ; courant faible (« 17 VATC ») → « 17_VATC »
export function cableTxt(name, cores, surl) {
  const m = /^(\d+)\s*([gGxX])\s*([\d.,]+)$/.exec(String(name || "").replace(/\s+/g, ""));
  if (!m) return `${ascii(name).trim().replace(/\s+/g, "_")} (${num(surl, 2)})`;
  const n = +m[1], G = m[2].toUpperCase() === "G", sec = m[3].replace(",", ".");
  // âmes dans l'ordre des articles du BE (catalogue des câbles) ; sinon celles du câble, vert/jaune à la fin
  const CAT = { "3G": "B M V/J", "4G": "N M GR V/J", "5G": "N GR M B V/J", "2X": "N M", "3X": "N B M", "4X": "GR N B M" };
  const k = `${n}${G ? "G" : "X"}`;
  const C = CAT[k] ? CAT[k].split(" ") : G && n > 5 ? [...Array(n - 1).fill("N"), "V/J"] : (cores && cores.length ? cores : cableCores(n, G)).map(code).sort((a, b) => (a === "V/J") - (b === "V/J"));
  return `U1000R2V_${n}${G ? "G" : "X"}${sec}_${C.join("-")} (${num(surl, 2)})`;
}
// fils par section (les âmes d'un câble n'y sont pas) → [rigides, 2,5, 1,5]
export function filsTxt(wires, surl) {
  const loose = (wires || []).filter((w) => !w.core && w.fn !== "isole");
  const s = (t) => `${t} (${num(surl, 2)})`;
  const r = loose.filter((w) => +w.section >= 4), d = loose.filter((w) => +w.section === 2.5), u = loose.filter((w) => +w.section < 2.5);
  return [r.length ? s(sortCodes(r.map((w) => `${code(w.color)}[${+w.section}]`)).join(" ")) : "",
    d.length ? s(sortCodes(d.map((w) => code(w.color))).join(" ")) : "", u.length ? s(sortCodes(u.map((w) => code(w.color))).join(" ")) : ""];
}
const gaineTxt = (diam, faible) => (faible && (diam == null || diam === 20) ? "ICTA_V20" : diam ? `ICTA${diam}` : "");

// W = computeWiring(...) ; items = allApps() (rep, room, h, t) ; ch = fiche du chantier {affaire, nom, client} ;
// o.abrev(nomDePièce) = nom court (Paramètres → Chantier → abréviations) ; o.surl = surlongueur des fils (m, 0,40)
export function spvLines(W, items, ch = {}, o = {}) {
  const byId = new Map((items || []).map((a) => [a.id, a]));
  const ab = o.abrev || ((n) => ascii(n).toUpperCase());
  const surl = o.surl ?? 0.4;
  const aff = ascii(ch.affaire || ch.numero || "").trim(), nom = ascii(ch.nom || "").trim().toUpperCase();
  const fixe = [`${aff}_${nom}`, ascii(ch.client || "").toUpperCase(), nom, aff, "", "", ""];
  const reps = (ids) => (ids || []).map((id) => (byId.get(id) || {}).rep).filter(Boolean).map(ascii).join("+");
  const roomOf = (ids) => { const r = (ids || []).map((id) => (byId.get(id) || {}).room).find(Boolean); return r ? `(${ab(r)})` : ""; };
  const hOf = (ids) => { const a = byId.get((ids || [])[0]); return a ? (a.h == null ? 2500 : Math.round(a.h * 10)) : 0; };
  const rows = [];
  const push = (r) => rows.push(r);
  const line = ({ dep, gaine, len, arr, cable, wires, boite = "", no, type, h, cut, faible }) => {
    const [fr, f25, f15] = cable ? ["", "", ""] : filsTxt(wires, surl);
    const cab = cable ? cableTxt(cable, (wires || []).filter((w) => w.core).map((w) => w.core), surl) : "";
    push({ faible, gaine, cable: !!cable, comp: (cab || [fr, f25, f15].join("|")), len: +len || 0,
      f: [ascii(dep), gaine, num(len, 1), arr, cab, "", fr, f25, f15, "1", "ACTIVE", boite, ...fixe, ascii(no), type, "", String(h), num(cut, 2)] });
  };
  for (const b of W.boxes || []) {
    const boxRoom = roomOf(b.apps || (b.gaines || []).flatMap((g) => g.appIds || []));
    let alimDone = false;
    for (const g of b.gaines || []) {
      const cut = (+g.length || 0) + surl;
      if (g.kind === "alim") {
        line({ dep: "TAB", gaine: gaineTxt(g.diam), len: g.length, arr: `${ascii(b.n)} ${g.face || ""}${boxRoom}`, cable: g.cable, wires: g.wires, boite: alimDone ? "" : "KEO_BOITE_PAV", no: g.no, type: "Alimentation", h: 3200, cut });
        alimDone = true; continue;
      }
      const ids = (g.ponts && g.ponts.length) ? (g.appIds || []).filter((id) => !g.ponts.some((p) => (p.ids || []).includes(id))) : g.appIds;
      line({ dep: `${b.n} ${g.face || ""}`, gaine: gaineTxt(g.diam), len: g.length, arr: `${reps(ids)}${roomOf(ids)}`, cable: g.cable, wires: g.wires, no: g.no, type: "Bras", h: hOf(ids), cut });
      for (const p of g.ponts || []) {
        const from = (byId.get(p.from) || {}).rep || p.de || "";
        line({ dep: from, gaine: gaineTxt(g.diam), len: p.length, arr: `${reps(p.ids)}${roomOf(p.ids)}`, cable: g.cable, wires: g.wires, no: reps([p.ids[0]]), type: "Bras pontage", h: hOf(p.ids), cut: (+p.length || 0) + surl });
      }
    }
  }
  for (const d of W.direct || []) {
    if (d.length == null) continue;
    const a = byId.get(d.appId) || {};
    line({ dep: d.faible ? "TRI" : "TAB", gaine: gaineTxt(d.diam, d.faible), len: d.length, arr: `${ascii(d.etiquette || a.rep || "")}${roomOf([d.appId])}`, cable: d.cable, wires: d.wires, no: d.etiquette || a.rep, type: "Direct", h: hOf([d.appId]), cut: (+d.length || 0) + surl, faible: d.faible });
  }
  // rangement pour la production en série : courant faible, ICTA 20 et plus, ICTA 16 ; câbles d'abord ; composition ; longueur
  const rank = (r) => (r.gaine === "ICTA_V20" ? 0 : /ICTA(20|25|32|40)/.test(r.gaine) ? 1 : r.gaine === "ICTA16" ? 2 : 3);
  rows.sort((p, q) => rank(p) - rank(q) || (q.cable - p.cable) || (p.comp.length - q.comp.length) || (p.comp < q.comp ? -1 : p.comp > q.comp ? 1 : 0) || p.len - q.len);
  return rows.map((r) => r.f.join(";"));
}
export const spvText = (lines) => lines.join("\r\n") + (lines.length ? "\r\n" : "");
export const spvName = (ch = {}) => `${ascii(ch.affaire || ch.numero || "SANS-AFFAIRE").trim().replace(/[^\w-]+/g, "_")}_${ascii(ch.nom || "CHANTIER").trim().toUpperCase().replace(/[^\w-]+/g, "_")}-.spv`;
// totaux du planning du BE (décision n° 64) et métrages par fil, comme le « cumul » du BE (= somme des lignes du .spv)
export function totaux(W, lines) {
  const fils = {}, gaines = {};
  for (const l of lines) {
    const f = l.split(";"), cut = +f[23] || 0, len = +f[2] || 0;
    if (f[1]) gaines[f[1]] = +((gaines[f[1]] || 0) + len).toFixed(1);
    [[6, null], [7, "2.5"], [8, "1.5"]].forEach(([i, sec]) => {
      for (const tok of String(f[i] || "").replace(/\s*\([\d.]+\)\s*$/, "").split(/\s+/).filter(Boolean)) {
        const m = /^(.+)\[([\d.]+)\]$/.exec(tok), k = m ? `${m[2]} ${m[1]}` : `${sec} ${tok}`;
        fils[k] = +((fils[k] || 0) + cut).toFixed(1);
      }
    });
  }
  return { gaines, fils, boites: (W.boxes || []).length, nbGaines: lines.length, longueur: +Object.values(gaines).reduce((s, x) => s + x, 0).toFixed(1) };
}
