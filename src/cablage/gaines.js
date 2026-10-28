// Gaines et fils (v30) : pour chaque boîte, ses gaines (une par appareil + une alimentation par circuit), leur face,
// leur longueur, leur diamètre et leurs fils ; chaque fil porte un n° de « circuit de câblage » : tous les fils qui
// portent le même n° dans la boîte se raccordent ensemble (ex. n° 1 = toutes les terres). Plus les lignes directes.
//
// Contenu des gaines (H07V-U, section du circuit) :
// - prise / sortie de câble : phase, neutre, terre ;
// - point lumineux (plafonnier, spot, applique) : retour lampe, neutre, terre ;
// - interrupteur simple : phase, retour lampe ;
// - va-et-vient (2 commandes pour les mêmes lumières) : la 1re reçoit phase + navettes 1 et 2, la 2e retour + navettes ;
// - 3 commandes ou plus, ou bouton poussoir : télérupteur au tableau → chaque commande reçoit phase + commande TL,
//   et l'alimentation du circuit apporte en plus « commande TL » (vers le tableau) et « retour TL » (vers les lumières) ;
// - alimentation de la boîte : une seule gaine (phase + neutre de chaque circuit, télérupteur, une terre), coupée avant Ø25.
// Couleurs (règles KiTéOHM, journal des règles) : phase/neutre selon le type de circuit (R-020 rouge = lumières seulement,
// R-021 gris = prises seulement, R-022 cuisine rouge/bleu 2,5) ; deux circuits du même type dans une boîte gardent les mêmes
// couleurs et se distinguent par leur bague (R-085 : n° du circuit, T1… pour le télérupteur).
// Ronde (R-072, v52) : orange, violet, noir, marron, ivoire, dans chaque boîte en repartant du début ; d'abord les couleurs
// imposées (lumière en câble 3G : le marron du câble), puis les va-et-vient (navettes d'une couleur, retour d'une autre),
// les télérupteurs (commande, retour), les allumages simples, par ordre de repère ; un allumage garde la même couleur sur
// tous ses fils ; pas de répétition tant qu'une couleur est libre dans la boîte (le marron évité tant qu'une autre est
// libre) ; une couleur réutilisée ne l'est que pour un allumage qui ne partage aucune gaine avec l'autre, avec une bague
// au n° de l'allumage ; impossible : doute bloquant.
// Numéros de gaine (R-077, v56) : .01 = alimentation, puis strictement dans le sens anti-horaire à partir de l'alimentation.
// Diamètre (R-074) : somme des sections ; au-delà de l'ICTA 20 : doute. Bouchon (R-095) sur les gaines à câble extérieur.
// Doutes (v52) : W.doutes = [{rule, text, box, bloquant}] ; chaque gaine porte ses règles (g.rules) pour la marque
// « à vérifier » des règles non confirmées.
// Appareils au même endroit (≤ memeEndroit) : une seule gaine, chaque fil commun une seule fois (repiquage).
// Appareil à l'extérieur : câble du stock (3G1,5…) choisi selon les fils nécessaires, âmes repérées à la couleur de leur
// fonction (ex. marron repéré orange), âme en trop isolée.
import { gaineFor, packAlim } from "./gaine.js";
import { FACES, portLayout } from "./boites.js";
import { APPAREILS, lignesOf, parseFils, gaineLabel, raccOf, isFaible, sansCvr } from "./appareils.js";

const LIGHT = new Set(["LUM", "SPOT", "APP"]), CMD = new Set(["INT", "VV", "BP"]);
const d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const list = (v) => String(v || "").split(",").map((x) => x.trim()).filter(Boolean);
// « rouge/bleu, gris/bleu foncé » → [{phase, neutre}]
export function parsePairs(v) {
  const P = list(v).map((x) => x.split("/").map((y) => y.trim())).filter((x) => x.length === 2 && x[0] && x[1]).map(([phase, neutre]) => ({ phase, neutre }));
  return P.length ? P : [{ phase: "rouge", neutre: "bleu" }];
}
// conducteurs d'un câble (ancien comportement, gardé pour les tests) : terre vert/jaune, neutre bleu, autres marron, noir, gris
export function cableColors(wires) {
  const n = wires.length, rest = ["marron", "noir", "gris"];
  const hasBlue = n === 2 || n === 3 || n >= 5;
  return wires.map((w) => (w.fn === "terre" ? "vert/jaune" : w.fn === "neutre" && hasBlue ? "bleu" : rest.shift() || "gris"));
}
// âmes normalisées (HD 308) : G = avec vert/jaune
export function cableCores(n, G) {
  if (G) return n === 3 ? ["vert/jaune", "bleu", "marron"] : n === 4 ? ["vert/jaune", "marron", "noir", "gris"] : n === 5 ? ["vert/jaune", "bleu", "marron", "noir", "gris"] : ["vert/jaune", "bleu", "marron", "noir", "gris"].slice(0, n);
  return n === 3 ? ["marron", "noir", "gris"] : n === 4 ? ["bleu", "marron", "noir", "gris"] : ["bleu", "marron", "noir", "gris", "noir"].slice(0, n);
}
// « 3G1,5, 4G2,5, 3x1,5 » → [{ name, n, G, sec }]
export function parseStock(v) {
  // séparateur : « ; », espace, ou virgule suivie d'un espace (la virgule seule est celle de la section : 1,5)
  return String(v || "").split(/\s*;\s*|,\s+|\s+/).map((x) => x.trim()).filter(Boolean).map((x) => { const m = /^(\d+)\s*([gGxX])\s*([\d.,]+)$/.exec(x.replace(/\s+/g, "")); return m ? { name: `${m[1]}${m[2].toUpperCase() === "G" ? "G" : "x"}${m[3].replace(".", ",")}`, n: +m[1], G: m[2].toUpperCase() === "G", sec: +m[3].replace(",", ".") } : null; }).filter(Boolean);
}
// câble pour les fils d'une gaine (terre exigée : la terre suit toujours dans un câble extérieur) : le plus petit câble du
// stock, à la bonne section, qui a un bleu pour le neutre et assez d'autres âmes ; le bleu ne sert pas de phase ou de
// retour (sauf réglage cableBleuLibre) ; les âmes en trop sont isolées. → { name, wires } ou null
export function chooseCable(wires, S) {
  const sec = Math.max(...wires.map((w) => w.section || 1.5));
  const hasN = wires.some((w) => w.fn === "neutre"), others = wires.filter((w) => w.fn !== "terre" && w.fn !== "neutre");
  const ok = parseStock(S.cablesStock).filter((c) => c.G && c.sec >= sec - 1e-9).filter((c) => {
    const cores = cableCores(c.n, c.G).filter((k) => k !== "vert/jaune");
    if (hasN && !cores.includes("bleu")) return false;
    const usable = cores.filter((k) => k !== "bleu" || (!hasN && S.cableBleuLibre)).length - (hasN ? 0 : 0);
    return usable >= others.length;
  }).sort((p, q) => p.sec - q.sec || p.n - q.n);
  const c = ok[0];
  if (!c) return null;
  const cores = cableCores(c.n, true), free = cores.filter((k) => k !== "vert/jaune" && k !== "bleu");
  if (!hasN && S.cableBleuLibre && cores.includes("bleu")) free.push("bleu");
  const taken = new Set(), out = [];
  const pe = wires.find((w) => w.fn === "terre"), N = wires.find((w) => w.fn === "neutre");
  out.push({ ...(pe || { fn: "terre", color: S.cTerre, section: c.sec, net: "T", circuit: null }), core: "vert/jaune", section: c.sec }); taken.add("vert/jaune");
  if (N) { out.push({ ...N, core: "bleu", section: c.sec }); taken.add("bleu"); }
  others.forEach((w, i) => { out.push({ ...w, core: free[i], section: c.sec }); taken.add(free[i]); });
  // âmes en trop : isolées (dans l'ordre du câble)
  const left = cores.slice(); for (const k of [...taken]) { const i = left.indexOf(k); if (i >= 0) left.splice(i, 1); }
  left.forEach((k) => out.push({ fn: "isole", color: k, core: k, section: c.sec, net: null, circuit: null }));
  return { name: c.name, wires: out };
}
// longueur à plat d'une gaine : boîte → points de passage (tracé à la main, b.routes[clé]) → arrivée
export function viaLen(from, pts, to) {
  let p = from, L = 0;
  for (const q of [...(pts || []), to]) { L += d2(p, q); p = q; }
  return L;
}
const NAMES = { PC16: "Prise 16 A", PC20: "Prise spécialisée", RJ45: "RJ45", LUM: "Point lumineux", APP: "Applique", SPOT: "Spot", INT: "Interrupteur", VV: "Va-et-vient", BP: "Bouton poussoir", VMC: "VMC", SC: "Sortie de câble", TAB: "Tableau" };
const COULEUR_L = (c) => ({ bleu: "B", "bleu foncé": "BF", rouge: "R", gris: "GR", noir: "N", marron: "M", ivoire: "IV", orange: "O", violet: "V", "vert/jaune": "V/J" })[c] || c;
export const FN_LABEL = { phase: "phase", neutre: "neutre", terre: "terre", retour: "retour lampe", nav1: "navette 1", nav2: "navette 2", cmdTL: "commande télérupteur", retTL: "retour télérupteur", cmdV1: "commande volet 1", cmdV2: "commande volet 2", isole: "fil en trop (isolé)" };
// couleurs phase/neutre d'un type de circuit (réglages v38)
export function pairOf(kind, S) {
  const v = kind === "prises" ? S.couleursPrises : kind === "cuisine" ? S.couleursCuisine : kind === "specialise" ? S.couleursSpecialise : kind === "volets" ? (S.couleursVolets || "gris/bleu clair") : S.couleursEclairage;
  return parsePairs(v || `${S.cPhase}/${S.cNeutre}`)[0];
}
// bague d'un circuit : son n° sans le « C » (C5 → 5)
export const bagueOf = (c) => String(c.n || "").replace(/^C/i, "");

// longueur d'une gaine (m) : horizontal × (1 + majoration) + descentes + surlongueurs, arrondi au pas supérieur
export function gaineLength({ horiz, downA = 0, downB = 0, levels = 0 }, S) {
  const L = horiz * (1 + S.majoration / 100) + downA + downB + levels * (S.hsp + S.traversee) + S.margeBoite + S.margeApp;
  const step = S.arrondi > 0 ? S.arrondi : 0.01;
  return +(Math.ceil(L / step - 1e-9) * step).toFixed(2);
}
// descente du plafond (combles) jusqu'à l'appareil ; un appareil au plafond (hauteur vide) : seulement la traversée
const down = (h, S) => S.traversee + (h == null ? 0 : Math.max(0, S.hsp - h / 100));

export function computeWiring({ items: items0, links, circuits, boxes, levels = [], S }) {
  const items = sansCvr(items0, S);
  const byId = new Map(items.map((a) => [a.id, a]));
  const circOf = new Map(); circuits.forEach((c) => c.apps.forEach((id) => circOf.set(id, c)));
  const lvIdx = (lv) => Math.max(0, levels.indexOf(lv));
  const tab = items.find((a) => a.t === "TAB") || null;
  const issues = [];
  if (!tab) issues.push("Pas de tableau sur le plan : posez-le (appareil « Tableau ») pour calculer les alimentations et les lignes directes.");
  const hTab = S.hTableau ?? 1.8;
  const cmdCols = list(S.couleursCommande || `${S.cRetour}, ${S.cNavette1}, ${S.cNavette2}`);
  const sp = pairOf("specialise", S);
  const col = { phase: sp.phase, neutre: sp.neutre, terre: S.cTerre, retour: cmdCols[0] || S.cRetour, nav1: cmdCols[1] || S.cNavette1, nav2: cmdCols[1] || S.cNavette2, cmdTL: cmdCols[0] || S.cRetour, retTL: cmdCols[0] || S.cRetour };

  // allumages d'une boîte (lumières + commandes reliées dans la boîte), avec leur « composition » (pour l'harmonisation)
  const boxGroups = (b) => {
    const apps = b.apps.map((id) => byId.get(id)).filter(Boolean), inBox = new Set(apps.map((a) => a.id));
    const lightsOf = new Map();
    for (const l of links) if (inBox.has(l.c) && inBox.has(l.l) && LIGHT.has(byId.get(l.l)?.t)) { if (!lightsOf.has(l.c)) lightsOf.set(l.c, []); lightsOf.get(l.c).push(l.l); }
    const par = new Map(), find = (x) => { if (!par.has(x)) par.set(x, x); return par.get(x) === x ? x : (par.set(x, find(par.get(x))), par.get(x)); };
    for (const [c, ls] of lightsOf) ls.forEach((l) => par.set(find(c), find(l)));
    const G = new Map();
    apps.filter((a) => LIGHT.has(a.t) || CMD.has(a.t)).forEach((a) => { const r = find(a.id); if (!G.has(r)) G.set(r, []); G.get(r).push(a); });
    return [...G.values()].map((g) => {
      const lights = g.filter((a) => LIGHT.has(a.t)), cmds = g.filter((a) => CMD.has(a.t));
      const tele = cmds.length >= 3 || cmds.some((k) => k.t === "BP");
      const kind = !lights.length || !cmds.length ? "seul" : tele ? "TL" : cmds.length === 2 ? "VV" : "INT";
      const sig = `${kind}|${lights.map((a) => a.t).sort().join("+")}`;
      const cx = g.reduce((s, a) => s + a.x, 0) / g.length, cy = g.reduce((s, a) => s + a.y, 0) / g.length;
      return { g, lights, cmds, tele, sig, cx, cy };
    });
  };
  let tlNo = 0;
  const doutes = [];
  const doubt = (rule, text, box = null, bloquant = false) => { doutes.push({ rule, text, box, bloquant }); issues.push(`${text} — ${bloquant ? "doute bloquant" : "à vérifier"} (${rule})`); };
  const numOfRep = (r) => (String(r || "").match(/\d+/) || [""])[0];
  const repKey = (g) => { const r = (g.lights[0] || g.cmds[0] || {}).rep || ""; const m = String(r).match(/(\d+)([A-Z]*)$/i); return m ? +m[1] * 100 + (m[2] ? m[2].charCodeAt(0) - 64 : 0) : 1e6; };

  // appareils d'un circuit à boîte qui ne sont dans aucune boîte (boîte supprimée, appareil ajouté après le placement)
  const boxedAll = new Set(boxes.flatMap((b) => b.apps));
  const loose = circuits.filter((c) => !c.direct && c.kind !== "comm").flatMap((c) => c.apps).filter((id) => byId.has(id) && !boxedAll.has(id));
  if (boxes.length && loose.length) issues.push(`${loose.length} appareil${loose.length > 1 ? "s" : ""} sans boîte (${loose.slice(0, 6).map((id) => byId.get(id).rep || id).join(", ")}${loose.length > 6 ? "…" : ""}) : « Replacer les boîtes… » ou « ← Sélection » sur une boîte`);
  const outBoxes = boxes.map((b) => {
    const apps = b.apps.map((id) => byId.get(id)).filter(Boolean);
    const inBox = new Set(apps.map((a) => a.id));
    const circs = circuits.filter((c) => c.apps.some((id) => inBox.has(id))).sort((p, q) => String(p.n).localeCompare(String(q.n), "fr", { numeric: true }));
    // ---------- n° de raccordement (« circuit de câblage ») ----------
    const nets = []; const net = (key, label, fn) => { let x = nets.find((n) => n.key === key); if (!x) { x = { key, n: nets.length + 1, label, fn, wires: [] }; nets.push(x); } return x; };
    net("T", "Terres (toutes ensemble)", "terre");
    // couleurs de la boîte : la paire phase/neutre du type de circuit ; bague = n° du circuit
    const keyColor = new Map([["T", S.cTerre]]), keyBague = new Map();
    for (const c of circs) {
      const p = pairOf(c.kind, S);
      keyColor.set("P" + c.id, p.phase); keyColor.set("N" + c.id, p.neutre);
      if (S.bagues !== false) { keyBague.set("P" + c.id, bagueOf(c)); keyBague.set("N" + c.id, bagueOf(c)); }
    }
    // ronde (R-072) : chaque allumage demande une ou deux couleurs (« emplacements ») ; elles sont choisies plus bas, une
    // fois les gaines connues (deux allumages dans une même gaine n'ont jamais la même couleur)
    const slots = [];                  // [{ g: n° de l'allumage, keys: [n° de raccordement], imposed, ids }]
    // ordre de câblage (= ordre des n°, v47, demande de Kévin) : terres, puis circuit par circuit neutre et phase —
    // cuisine (bleu / rouge 2,5), prises (bleu foncé / gris 1,5), éclairage (bleu / rouge 1,5) — puis retours et navettes
    const RANK = { cuisine: 0, specialise: 1, prises: 2, eclairage: 3, volets: 4 };
    const ordered = [...circs].sort((p, q) => (RANK[p.kind] ?? 4) - (RANK[q.kind] ?? 4) || String(p.n).localeCompare(String(q.n), "fr", { numeric: true }));
    for (const c of ordered) { net("N" + c.id, `Neutre ${c.n}`, "neutre"); net("P" + c.id, `Phase ${c.n}`, "phase"); }
    // allumages de la boîte : couleurs imposées (lumière en câble), va-et-vient, télérupteurs, simples ; par repère
    const extCable = (x) => S.cableExt && x.lights.some((l) => l.ext);
    const kindRank = (x) => (extCable(x) ? 0 : x.cmds.length === 2 && !x.tele ? 1 : x.tele ? 2 : 3);
    const groupsL = boxGroups(b).sort((p, q) => kindRank(p) - kindRank(q) || repKey(p) - repKey(q) || p.cy - q.cy || p.cx - q.cx);
    const role = new Map();            // appareil → fils
    const tl = new Map();              // circuit → fils télérupteur à ajouter dans son alimentation
    let gi = 0;
    for (const G0 of groupsL) {
      const { lights, cmds, tele } = G0;
      gi++;
      const ids = [...lights, ...cmds].map((a) => a.id), no = numOfRep((lights[0] || cmds[0]).rep), imposed = extCable(G0);
      const c = circOf.get((lights[0] || cmds[0]).id) || circOf.get((cmds[0] || lights[0]).id);
      const cOf = (a) => circOf.get(a.id) || c;
      if (!c) continue;
      const lab = lights.map((a) => a.rep).join(" ") || "—";
      if (!cmds.length) { issues.push(`${b.n} : ${lab} sans commande (retour lampe non raccordé)`); }
      if (!lights.length) { cmds.forEach((k) => role.set(k.id, [["phase", "P" + cOf(k).id], ["retour", null]])); issues.push(`${b.n} : ${cmds.map((k) => k.rep).join(" ")} ne commande aucune lumière`); continue; }
      const R = net("R" + gi, `Retour lampe ${lab}`, "retour").key;
      const rSlot = { g: no, keys: [R], imposed, ids, tele };
      lights.forEach((l) => role.set(l.id, [["retour", R], ["neutre", "N" + cOf(l).id], ["terre", "T"]]));
      if (cmds.length === 1 && !tele) { role.set(cmds[0].id, [["phase", "P" + cOf(cmds[0]).id], ["retour", R]]); slots.push(rSlot); }
      else if (cmds.length === 2 && !tele) {
        const n1 = net("V1" + gi, `Navette 1 ${cmds[0].rep}↔${cmds[1].rep}`, "nav1").key, n2 = net("V2" + gi, `Navette 2 ${cmds[0].rep}↔${cmds[1].rep}`, "nav2").key;
        // va-et-vient (exemple R-072 : navettes orange, retour violet) : les navettes d'abord (une couleur pour les deux),
        // puis le retour (marron imposé s'il passe dans un câble)
        slots.push({ g: no, keys: [n1, n2], imposed: false, ids }, rSlot);
        role.set(cmds[0].id, [["phase", "P" + cOf(cmds[0]).id], ["nav1", n1], ["nav2", n2]]);
        role.set(cmds[1].id, [["retour", R], ["nav1", n1], ["nav2", n2]]);
      } else if (cmds.length) {
        const K = net("K" + gi, `Commande télérupteur ${lab}`, "cmdTL").key;
        // télérupteur (R-093) : commande et retour prennent chacun une couleur ; les deux passent dans l'alimentation
        slots.push({ ...rSlot, tele: true }, { g: no, keys: [K], imposed: false, ids, tele: true });
        const T = "T" + ++tlNo;
        if (S.bagues !== false) { keyBague.set(K, T); keyBague.set(R + "@alim", T); }
        cmds.forEach((k) => role.set(k.id, [["phase", "P" + cOf(k).id], ["cmdTL", K]]));
        if (!tl.has(c.id)) tl.set(c.id, []);
        tl.get(c.id).push(["cmdTL", K], ["retTL", R]);
        issues.push(`${b.n} : ${cmds.length} commandes pour ${lab} → télérupteur ${T} au tableau`);
      } else slots.push(rSlot);
    }
    // volets roulants (v54, R-096) : moteur = phase + neutre + terre du circuit de volets ; volet filaire (relié à une
    // commande CVR) : deux fils de commande, de la ronde, dans la gaine du CVR et dans celle du moteur ; CVR = phase + neutre
    const inBoxIds = new Set(apps.map((a) => a.id));
    apps.filter((a) => a.t === "CVR").forEach((cv, vi) => {
      const c = circOf.get(cv.id); if (!c) return;
      const vs = links.filter((l) => l.c === cv.id && inBoxIds.has(l.l)).map((l) => byId.get(l.l)).filter((x) => x && (x.t === "VR" || x.t === "VEL"));
      const A = net("VA" + vi, `Commande volet ${cv.rep || ""} (1)`, "cmdV1").key, B = net("VB" + vi, `Commande volet ${cv.rep || ""} (2)`, "cmdV2").key;
      role.set(cv.id, [["phase", "P" + c.id], ["neutre", "N" + c.id], ["cmdV1", A], ["cmdV2", B]]);
      vs.forEach((v) => { const cvv = circOf.get(v.id) || c; role.set(v.id, [["phase", "P" + cvv.id], ["neutre", "N" + cvv.id], ["terre", "T"], ["cmdV1", A], ["cmdV2", B]]); });
      const no = numOfRep(cv.rep), ids = [cv.id, ...vs.map((v) => v.id)];
      slots.push({ g: no, keys: [A], imposed: false, ids, pref: "marron" }, { g: no, keys: [B], imposed: false, ids, pref: "noir" });
      if (!vs.length) issues.push(`${b.n} : commande de volet ${cv.rep || ""} reliée à aucun volet de la boîte`);
    });
    // équipotentielle locale (R-080) : un fil vert/jaune sur la terre de la boîte
    apps.filter((a) => a.t === "EQL").forEach((a) => role.set(a.id, [["terre", "T"]]));
    // prises, sorties de câble, volets connectés
    apps.filter((a) => !LIGHT.has(a.t) && !CMD.has(a.t) && !role.has(a.id)).forEach((a) => { const c = circOf.get(a.id); if (c) role.set(a.id, [["phase", "P" + c.id], ["neutre", "N" + c.id], ["terre", "T"]]); });

    // ---------- gaines ----------
    const deps = [];
    const lvB = lvIdx(b.lv);
    // appareils au même endroit (même niveau, ≤ memeEndroit) : une seule gaine
    const near = S.memeEndroit ?? 0.3, spots = [];
    for (const a of apps) {
      const sp = spots.find((g) => g[0].lv === a.lv && g.some((o) => d2(o, a) <= near + 1e-9));
      if (sp) sp.push(a); else spots.push([a]);
    }
    // v56 (R-073, H-041) : commande et prises au même endroit partagent une gaine, mais jamais de gaine ICTA 25 dans une
    // boîte : si la somme des sections dépasse l'ICTA 20, prises d'un côté, commandes et lumières de l'autre
    const secOf = (m) => (m.t === "EQL" ? (APPAREILS.EQL.terre || 2.5) : (circOf.get(m.id) || {}).section || 1.5);
    const sumOf = (G) => { const seen = new Set(); let t = 0; for (const m of G) for (const [, key] of role.get(m.id) || []) { if (key != null && seen.has(key)) continue; if (key != null) seen.add(key); t += secOf(m); } return t; };
    for (let i = 0; i < spots.length; i++) {
      const G = spots[i];
      if (G.length < 2 || sumOf(G) <= (S.icta20 ?? 13.5)) continue;
      const cmdL = G.filter((m) => CMD.has(m.t) || LIGHT.has(m.t)), other = G.filter((m) => !(CMD.has(m.t) || LIGHT.has(m.t)));
      if (cmdL.length && other.length) spots.splice(i, 1, other, cmdL);
    }
    // ---------- ronde (R-072) ----------
    // gaines (endroits) où passe chaque n° de raccordement ; les fils du télérupteur passent aussi dans l'alimentation
    const keySpots = new Map(), addK = (k, sp) => { if (k == null) return; if (!keySpots.has(k)) keySpots.set(k, new Set()); keySpots.get(k).add(sp); };
    spots.forEach((G, i) => G.forEach((m) => (role.get(m.id) || []).forEach(([, k]) => addK(k, i))));
    for (const L of tl.values()) L.forEach(([, k]) => addK(k, "alim"));
    const touch = (sl) => new Set(sl.keys.flatMap((k) => [...(keySpots.get(k) || [])]));
    const users = new Map();           // couleur → [{ g, touch }]
    const clash = (T, c) => (users.get(c) || []).some((u) => [...u.touch].some((t) => T.has(t)));
    const ronde = cmdCols.length ? cmdCols : [S.cRetour];
    const rondeBague = new Map();      // n° de raccordement → bague (n° de l'allumage) quand une couleur est réutilisée
    for (const sl of slots) {
      const T = touch(sl), mine = new Set(slots.filter((o) => o.g === sl.g && o !== sl && keyColor.has(o.keys[0])).map((o) => keyColor.get(o.keys[0])));
      const freeC = ronde.filter((c) => !users.has(c) && !mine.has(c));
      let c = null, bague = null;
      if (sl.imposed && !mine.has("marron")) {
        // lumière en câble : le marron du câble ; déjà pris dans la boîte par un allumage d'une autre gaine → bague
        c = "marron";
        if (users.has("marron")) { bague = sl.g || "?"; if (clash(T, "marron")) doubt("R-072", `${b.n} : deux lumières en câble (marron imposé) dans une même gaine, allumage ${sl.g || "?"}`, b.n, true); }
      } else if (sl.pref && freeC.includes(sl.pref)) c = sl.pref;   // commande de volet : marron et noir (R-096)
      else if (freeC.length) c = freeC.find((x) => x !== "marron") || freeC[0];
      else {
        // plus de couleur libre : une couleur dont les allumages ne partagent aucune gaine avec celui-ci, avec une bague
        c = ronde.find((x) => !mine.has(x) && !clash(T, x)) || null;
        if (c) bague = sl.g || "?";
        else { c = ronde[0]; bague = sl.g || "?"; doubt("R-072", `${b.n} : plus de couleur possible pour l'allumage ${sl.g || "?"} (deux allumages de même couleur dans une gaine)`, b.n, true); }
      }
      sl.keys.forEach((k) => { keyColor.set(k, c); if (bague) rondeBague.set(k, String(bague)); });
      if (!users.has(c)) users.set(c, []);
      users.get(c).push({ g: sl.g, touch: T });
    }
    const colorOf = (fn, key) => (key != null && keyColor.has(key) ? keyColor.get(key) : col[fn]);
    for (const G of spots) {
      const a = G[0], seen = new Set(), wires = [];
      for (const m of G) {
        const sec = m.t === "EQL" ? (APPAREILS.EQL.terre || 2.5) : (circOf.get(m.id) || {}).section || 1.5;
        for (const [fn, key] of role.get(m.id) || []) {
          if (key != null && seen.has(key)) continue;          // fil commun : une seule fois (repiqué sur place)
          if (key != null) seen.add(key);
          wires.push({ fn, color: colorOf(fn, key), section: sec, net: key, circuit: fn === "terre" ? null : (circOf.get(m.id) || {}).n || null, ...(rondeBague.has(key) ? { bague: rondeBague.get(key) } : {}) });
        }
      }
      let cable = null;
      if (S.cableExt && G.every((m) => m.ext)) {
        const ch = chooseCable(wires, S);
        if (ch) { cable = ch.name; wires.splice(0, wires.length, ...ch.wires); }
        else {
          const cc = cableColors(wires);
          wires.forEach((w, i) => { w.core = cc[i]; });
          cable = `${wires.length}G${String(Math.max(...wires.map((w) => w.section))).replace(".", ",")}`;
          issues.push(`${b.n} : aucun câble du stock ne convient pour ${G.map((m) => m.rep).join(" + ")} (${wires.length} fils)`);
        }
      }
      if (G.length > 1 && G.some((m) => circOf.get(m.id).kind === "specialise")) doubt("R-089", `${b.n} : un circuit spécialisé est dans une gaine partagée (${G.map((m) => m.rep).join(" + ")})`, b.n, true);
      const route = G.map((m) => (b.routes || {})[m.id]).find(Boolean) || null;
      const downMax = Math.max(...G.map((m) => down(m.h, S)));
      const len = gaineLength({ horiz: viaLen(b, route, a), downA: downMax, levels: Math.abs(lvIdx(a.lv) - lvB) }, S);
      const label = G.length === 1 ? `${NAMES[a.t] || (APPAREILS[a.t] || {}).n || a.t} ${a.rep || ""}`.trim() : G.map((m) => m.rep || NAMES[m.t] || m.t).join(" + ");
      const cn = [...new Set(G.map((m) => (circOf.get(m.id) || {}).n).filter(Boolean))];
      // la face est celle par où la gaine sort : vers son 1er point de passage s'il y en a un
      deps.push({ id: a.id, kind: "app", p: route ? route[0] : a, pts: route ? [route[0]] : G.map((m) => ({ x: m.x, y: m.y })), app: a, appIds: G.map((m) => m.id), reps: G.map((m) => m.rep || NAMES[m.t] || m.t), routed: !!route, label, room: a.room, circuit: cn.join(", "), wires, length: len, cable, ext: !!cable, bouchon: !!cable,
        rules: { length: "R-011", diam: "R-074", wires: G.length > 1 ? "R-073" : null, ronde: wires.some((w) => /^(retour|nav1|nav2|cmdTL|cmdV1|cmdV2)$/.test(w.fn)) ? "R-072" : null, volet: G.some((m) => m.t === "VR" || m.t === "VEL" || m.t === "CVR") ? "R-096" : null, eq: G.some((m) => m.t === "EQL") ? "R-080" : null, cable: cable ? "R-014" : null, bouchon: cable ? "R-095" : null } });
    }
    // alimentation depuis le tableau : une seule gaine (phase + neutre de chaque circuit, télérupteur, une terre) ;
    // divisée si elle passait en Ø25, la terre restant dans la 1re
    const alimG = packAlim(circs.map((c) => ({ ...c, section: c.section || 1.5, extra: (tl.get(c.id) || []).length })), S);
    alimG.forEach((G, gi) => {
      const wires = [];
      for (const c of G) {
        const sec = c.section || 1.5;
        // un fil qu'aucun appareil de la boîte n'utilise n'est pas amené (ex. neutre d'un circuit dont la boîte n'a qu'une
        // commande sans lumière : rien ne reste en l'air)
        const usedK = (k) => [...role.values()].some((r) => r.some(([, key]) => key === k)) || (tl.get(c.id) || []).some(([, key]) => key === k);
        [["phase", "P" + c.id], ["neutre", "N" + c.id], ...(tl.get(c.id) || [])].filter(([fn, key]) => fn !== "neutre" || usedK(key)).forEach(([fn, key]) => wires.push({ fn, color: colorOf(fn, key), section: sec, net: key, circuit: c.n, bague: keyBague.get(fn === "retTL" ? key + "@alim" : key) || null }));
      }
      // une seule terre par boîte : dans la 1re gaine d'alimentation, à la plus grosse section de la boîte
      // (v54 : 2,5 mm² si une équipotentielle locale est raccordée dans la boîte, R-075 / R-080)
      if (gi === 0) wires.push({ fn: "terre", color: S.cTerre, section: Math.max(...circs.map((c) => c.section || 1.5), ...apps.filter((a) => a.t === "EQL").map(() => APPAREILS.EQL.terre || 2.5)), net: "T" });
      const route = (b.routes || {}).tab || null;
      const len = tab ? gaineLength({ horiz: viaLen(b, route, tab), downA: S.traversee + Math.max(0, S.hsp - hTab), levels: Math.abs(lvIdx(tab.lv) - lvB) }, S) : null;
      const names = G.map((c) => c.n);
      deps.push({ id: "alim:" + gi, kind: "alim", p: route ? route[0] : tab || { x: b.x, y: b.y - 1 }, routed: !!route,
        label: `Alimentation ${names.join(" + ")} (tableau)${alimG.length > 1 ? ` — gaine ${gi + 1}/${alimG.length}` : ""}`, circuit: names.join(", "), circuits: names, wires, length: len,
        rules: { length: "R-011", diam: "R-074", wires: "R-075" } });
    });
    const PL = portLayout(b, deps.map((g) => ({ id: g.id, p: g.p, pts: g.pts, keys: g.kind === "alim" ? [g.id === "alim:0" ? "tab" : g.id] : g.appIds })), S.departsFace, b.ports || {});
    deps.forEach((g) => {
      const q = PL.get(g.id) || {}; g.face = q.face || "?"; g.slot = q.slot ?? null;
      const secs = g.wires.filter((w) => w.fn !== "isole" || g.cable).map((w) => w.section);
      g.sum = +secs.reduce((s2, x) => s2 + x, 0).toFixed(2);
      g.diam = gaineFor(secs, S);
      if (g.diam == null) doubt("R-074", `${b.n} : ${g.label} : ${String(g.sum).replace(".", ",")} mm² de fils, plus que l'ICTA 20 (${String(S.icta20 ?? 13.5).replace(".", ",")} mm²)`, b.n, true);
    });
    const nApp = deps.filter((g) => g.kind === "app").length;
    if (nApp > S.departsMax) doubt("R-001", `${b.n} : ${nApp} départs (max ${S.departsMax}, sans l'alimentation)`, b.n, true);
    FACES.forEach((f) => { const n = deps.filter((g) => g.face === f).length; if (n > S.departsFace) doubt("R-001", `${b.n} face ${f} : ${n} gaines (max ${S.departsFace})`, b.n, true); });
    if (deps.some((g) => g.face === "?")) doubt("R-088", `${b.n} : plus aucune face libre (${S.departsFace} gaines par face, alimentation comprise)`, b.n, true);
    // numéros de gaine (R-077, v56) : .01 = alimentation, puis strictement dans le sens ANTI-HORAIRE à partir de
    // l'alimentation : sur chaque tranche, vue de l'extérieur de la boîte, les numéros se lisent de gauche à droite
    // (les points d'accroche restent repérés dans le sens horaire : on parcourt leur rang à l'envers)
    const M = Math.max(1, S.departsFace), per = 4 * M;
    const ang = (g) => Math.atan2(g.p.x - b.x, -(g.p.y - b.y));
    const pos = (g) => (g.face && g.face !== "?" ? FACES.indexOf(g.face) * M + (g.slot ?? 0) : null);
    const a0 = deps.find((g) => g.id === "alim:0"), p0 = a0 ? pos(a0) ?? 0 : 0;
    deps.sort((p, q) => {
      const pp = pos(p), pq = pos(q);
      if (pp == null || pq == null) return (pp == null) - (pq == null) || ang(q) - ang(p);
      return ((p0 - pp + per) % per) - ((p0 - pq + per) % per) || ang(q) - ang(p);
    });
    deps.forEach((g, i) => { g.no = `${b.n}.${String(i + 1).padStart(2, "0")}`; });
    // n° de raccordement définitifs (dans l'ordre : terres, neutres, phases, retours et navettes…)
    const used = nets.filter((nt) => deps.some((g) => g.wires.some((w) => w.net === nt.key)));
    used.forEach((nt, i) => { nt.n = i + 1; nt.wires = deps.flatMap((g) => g.wires.filter((w) => w.net === nt.key).map((w) => ({ gaine: g.no, label: g.label, fn: w.fn }))); });
    const numOf = new Map(used.map((nt) => [nt.key, nt.n]));
    deps.forEach((g) => g.wires.forEach((w) => { w.n = w.net ? numOf.get(w.net) ?? null : null; }));
    // bornes (R-092) : jamais de sections différentes sur un même n° (sauf les terres, réunies par boîte : à confirmer)
    for (const nt of used) {
      if (nt.key === "T") continue;
      const secs = new Set(deps.flatMap((g) => g.wires.filter((w) => w.net === nt.key).map((w) => w.section)));
      if (secs.size > 1) doubt("R-092", `${b.n} : n° ${nt.n} (${nt.label}) réunit des fils de sections différentes (${[...secs].join(" et ").replace(/\./g, ",")} mm²)`, b.n, true);
    }
    const cuivre = deps.reduce((s, g) => s + (g.length || 0) * g.wires.length, 0);
    const longueur = +deps.reduce((s, g) => s + (g.length || 0), 0).toFixed(2);
    const rules = [...new Set(["R-001", "R-077", "R-031", "R-088", ...deps.flatMap((g) => Object.values(g.rules || {}).filter(Boolean))])];
    return { ...b, gaines: deps.map(({ p, app, ...g }) => ({ ...g, appId: app ? app.id : null })), nets: used.map(({ key, ...nt }) => nt), circuits: circs.map((c) => c.n), cuivre: +cuivre.toFixed(1), longueur, bouchons: deps.filter((g) => g.bouchon).length, rules };
  });

  // ---------- lignes directes (R-003, R-082, R-084 ; v54) : du tableau à l'appareil, une ligne par raccordement ----------
  // étiquette = repère de l'appareil (comme la feuille FTZ « LIGNES DIRECTES ») ; fils ou câble et gaine d'après le type
  // (src/cablage/appareils.js) ; courant faible en gaine verte Ø20 ; bouche motorisée sans gaine ; gaine aiguillée Ø40
  const direct = [];
  // v56 : étiquettes comme le BE : RJ45 → « RJ1 » ; les autres gardent leur repère du plan (« MOTEUR1 », « FOUR1 » :
  // DUCOURNEAU numérote tout ; sur MAILLARD, seuls les équipements hors plan n'ont pas de numéro)
  const etiq = (a) => (a.t === "RJ45" ? "RJ" + ((String(a.rep || "").match(/\d+[A-Z]?$/i) || [""])[0]) : a.rep || a.t);
  const legacy = (a, c) => (a.t === "PC20" ? lignesOf(a) : null) || [{ fils: `${String(c.section || 2.5).replace(".", ",")} ${COULEUR_L(col.neutre)}+${COULEUR_L(col.phase)}+V/J`, gaine: null, auto: true }];
  for (const c of circuits.filter((x) => x.direct || x.kind === "comm")) {
    for (const id of c.apps) {
      const a = byId.get(id); if (!a) continue;
      const len = tab ? gaineLength({ horiz: d2(tab, a), downA: S.traversee + Math.max(0, S.hsp - hTab), downB: down(a.h, S), levels: Math.abs(lvIdx(tab.lv) - lvIdx(a.lv)) }, S) : null;
      const L = APPAREILS[a.t] || a.t === "RJ45" ? lignesOf(a) : legacy(a, c);
      (L || []).forEach((ln, li) => {
        const wires = ln.fils ? parseFils(ln.fils).map((f) => ({ fn: /V\/J/.test(f.lettre) ? "terre" : "fil", color: f.color, section: f.section, lettre: f.lettre, n: null })) : [];
        const sum = wires.reduce((t, w) => t + w.section, 0);
        const diam = ln.gaine === "V20" ? 20 : ln.gaine === 40 ? 40 : ln.gaine == null && ln.auto ? gaineFor(wires.map((w) => w.section), S) : ln.gaine;
        const rep = etiq(a), lab = li ? `${rep} ${ln.label || li + 1}`.trim() : rep;
        direct.push({ no: lab, etiquette: lab, circuit: c.n, appId: a.id, label: `${(APPAREILS[a.t] || {}).n || NAMES[a.t] || a.t} ${rep}${ln.label ? " (" + ln.label + ")" : ""}`.trim(),
          room: a.room, lv: a.lv, length: len, wires, cable: ln.cable || null, fil: ln.cable ? ln.cable : ln.fils || "—", gaine: ln.gaine === undefined ? null : ln.gaine, gaineTxt: ln.auto ? gaineLabel(diam) : gaineLabel(ln.gaine), diam, faible: isFaible(a.t), aboutissant: rep });
        if (diam == null && ln.gaine !== null && !ln.cable && sum) doubt("R-074", `Ligne directe ${rep} : ${String(sum).replace(".", ",")} mm² de fils, au-delà de l'ICTA 20 : diamètre à confirmer`, null, false);
      });
    }
  }
  // v56 (R-096) : commande des volets filaire ou connectée = choix du BE pour le chantier ; non choisi → filaire, à vérifier
  if (!S.commandeVolet && items.some((x) => x.t === "CVR")) doubt("R-096", "Volets roulants : commande filaire ou connectée non choisie pour le chantier (choix du BE) — câblés en filaire", null, false);
  // hotte dont le raccordement reste à choisir (R-086) : doute sur l'appareil seulement
  for (const a of items.filter((x) => x.t === "HOTTE" && raccOf(x) === "a_choisir")) doubt("R-086", `${a.rep || "Hotte"} : raccordement à choisir (en boîte sur le circuit cuisine, ou en ligne directe)`, null, false);
  // totaux des lignes directes (R-099, comme le BE) : ICTA 16, ICTA 20 (gaines vertes V20 comprises), liaisons sans gaine
  // (YSYT) comptées aussi ; directVertes = dont gaines vertes
  const totKey = (d) => (d.diam == null ? (d.cable ? String(d.cable).split(" ")[0] : "sans gaine") : `ICTA ${d.diam}`);
  const directTotals = {}; direct.forEach((d) => { const k = totKey(d); directTotals[k] = (directTotals[k] || 0) + 1; });
  const directVertes = direct.filter((d) => d.gaine === "V20").length;
  // gaines identiques sur tout le chantier (mêmes fils, mêmes couleurs, même câble) : fabrication en série
  const sigG = (g) => (g.cable ? g.cable + "|" : "") + g.wires.map((w) => `${w.section}${w.core ? w.core + ">" : ""}${w.color}`).sort().join(",");
  const series = new Map();
  outBoxes.forEach((b) => b.gaines.forEach((g) => { if (g.kind === "app") { const k = sigG(g); series.set(k, (series.get(k) || 0) + 1); } }));
  outBoxes.forEach((b) => b.gaines.forEach((g) => { if (g.kind === "app") g.serie = series.get(sigG(g)); }));
  // prise de salle de bain sur le circuit de la cuisine (R-091)
  for (const c of circuits.filter((x) => x.kind === "cuisine")) {
    const bad = c.apps.map((id) => byId.get(id)).filter((a) => a && /salle de bain|salle d'eau|\bsdb\b|\bsde\b|douche/i.test(a.room || ""));
    if (bad.length) doubt("R-091", `${c.n} (cuisine) dessert la salle de bain : ${bad.map((a) => a.rep || a.id).join(", ")}`, null, true);
  }
  // allumage coupé entre deux boîtes : une commande et une lumière qu'elle allume dans deux boîtes différentes
  const boxOf = new Map(); boxes.forEach((b) => b.apps.forEach((id) => boxOf.set(id, b)));
  const splits = [];
  for (const l of links) {
    const bc = boxOf.get(l.c), bl = boxOf.get(l.l);
    if (!bc || !bl || bc.id === bl.id || !byId.has(l.c) || !byId.has(l.l)) continue;
    splits.push({ c: l.c, l: l.l, bc: bc.id, bl: bl.id });
    issues.push(`Allumage coupé : ${byId.get(l.c).rep || l.c} (${bc.n}) commande ${byId.get(l.l).rep || l.l} (${bl.n}) — une commande et ses lumières doivent être dans la même boîte (« Ramener dans la même boîte »)`);
  }
  const cuivre = outBoxes.reduce((s, b) => s + b.cuivre, 0) + direct.reduce((s, g) => s + (g.length || 0) * g.wires.length, 0);
  const gaine = outBoxes.reduce((s, b) => s + b.gaines.reduce((t, g) => t + (g.length || 0), 0), 0) + direct.reduce((s, g) => s + (g.length || 0), 0);
  return { boxes: outBoxes, direct, directTotals, directVertes, issues, doutes, splits, series: [...series].map(([sig, n]) => ({ sig, n })).sort((p, q) => q.n - p.n), totals: { cuivre: +cuivre.toFixed(1), gaine: +gaine.toFixed(1), boites: outBoxes.length, gaines: outBoxes.reduce((s, b) => s + b.gaines.length, 0) + direct.length } };
}
