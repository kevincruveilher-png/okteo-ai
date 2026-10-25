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
// - alimentation de la boîte (une gaine par circuit) : phase, neutre, terre (+ fils du télérupteur s'il y en a un).
import { gaineFor } from "./gaine.js";
import { assignFaces, FACES } from "./boites.js";

const LIGHT = new Set(["LUM", "SPOT", "APP"]), CMD = new Set(["INT", "VV", "BP"]);
const d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const NAMES = { PC16: "Prise 16 A", PC20: "Prise spécialisée", RJ45: "RJ45", LUM: "Point lumineux", APP: "Applique", SPOT: "Spot", INT: "Interrupteur", VV: "Va-et-vient", BP: "Bouton poussoir", VMC: "VMC", SC: "Sortie de câble", TAB: "Tableau" };
export const FN_LABEL = { phase: "phase", neutre: "neutre", terre: "terre", retour: "retour lampe", nav1: "navette 1", nav2: "navette 2", cmdTL: "commande télérupteur", retTL: "retour télérupteur" };

// longueur d'une gaine (m) : horizontal × (1 + majoration) + descentes + surlongueurs, arrondi au pas supérieur
export function gaineLength({ horiz, downA = 0, downB = 0, levels = 0 }, S) {
  const L = horiz * (1 + S.majoration / 100) + downA + downB + levels * (S.hsp + S.traversee) + S.margeBoite + S.margeApp;
  const step = S.arrondi > 0 ? S.arrondi : 0.01;
  return +(Math.ceil(L / step - 1e-9) * step).toFixed(2);
}
// descente du plafond (combles) jusqu'à l'appareil ; un appareil au plafond (hauteur vide) : seulement la traversée
const down = (h, S) => S.traversee + (h == null ? 0 : Math.max(0, S.hsp - h / 100));

export function computeWiring({ items, links, circuits, boxes, levels = [], S }) {
  const byId = new Map(items.map((a) => [a.id, a]));
  const circOf = new Map(); circuits.forEach((c) => c.apps.forEach((id) => circOf.set(id, c)));
  const lvIdx = (lv) => Math.max(0, levels.indexOf(lv));
  const tab = items.find((a) => a.t === "TAB") || null;
  const issues = [];
  if (!tab) issues.push("Pas de tableau sur le plan : posez-le (appareil « Tableau ») pour calculer les alimentations et les lignes directes.");
  const hTab = S.hTableau ?? 1.8;
  const col = { phase: S.cPhase, neutre: S.cNeutre, terre: S.cTerre, retour: S.cRetour, nav1: S.cNavette1, nav2: S.cNavette2, cmdTL: S.cRetour, retTL: S.cRetour };

  const outBoxes = boxes.map((b) => {
    const apps = b.apps.map((id) => byId.get(id)).filter(Boolean);
    const inBox = new Set(apps.map((a) => a.id));
    const circs = circuits.filter((c) => c.apps.some((id) => inBox.has(id))).sort((p, q) => String(p.n).localeCompare(String(q.n), "fr", { numeric: true }));
    // ---------- n° de raccordement (« circuit de câblage ») ----------
    const nets = []; const net = (key, label, fn) => { let x = nets.find((n) => n.key === key); if (!x) { x = { key, n: nets.length + 1, label, fn, wires: [] }; nets.push(x); } return x; };
    net("T", "Terres (toutes ensemble)", "terre");
    for (const c of circs) { net("P" + c.id, `Phase ${c.n}`, "phase"); net("N" + c.id, `Neutre ${c.n}`, "neutre"); }
    // allumages de la boîte : lumières + commandes reliées
    const lightsOf = new Map();
    for (const l of links) if (inBox.has(l.c) && inBox.has(l.l) && LIGHT.has(byId.get(l.l)?.t)) { if (!lightsOf.has(l.c)) lightsOf.set(l.c, []); lightsOf.get(l.c).push(l.l); }
    const par = new Map(), find = (x) => { if (!par.has(x)) par.set(x, x); return par.get(x) === x ? x : (par.set(x, find(par.get(x))), par.get(x)); };
    for (const [c, ls] of lightsOf) ls.forEach((l) => par.set(find(c), find(l)));
    const groups = new Map();
    apps.filter((a) => LIGHT.has(a.t) || CMD.has(a.t)).forEach((a) => { const r = find(a.id); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(a); });
    const role = new Map();            // appareil → fils
    const tl = new Map();              // circuit → fils télérupteur à ajouter dans son alimentation
    let gi = 0;
    for (const g of groups.values()) {
      gi++;
      const lights = g.filter((a) => LIGHT.has(a.t)), cmds = g.filter((a) => CMD.has(a.t));
      const c = circOf.get((lights[0] || cmds[0]).id);
      const lab = lights.map((a) => a.rep).join(" ") || "—";
      if (!cmds.length) { issues.push(`${b.n} : ${lab} sans commande (retour lampe non raccordé)`); }
      if (!lights.length) { cmds.forEach((k) => role.set(k.id, [["phase", "P" + c.id], ["retour", null]])); issues.push(`${b.n} : ${cmds.map((k) => k.rep).join(" ")} ne commande aucune lumière`); continue; }
      const R = net("R" + gi, `Retour lampe ${lab}`, "retour").key;
      lights.forEach((l) => role.set(l.id, [["retour", R], ["neutre", "N" + circOf.get(l.id).id], ["terre", "T"]]));
      const tele = cmds.length >= 3 || cmds.some((k) => k.t === "BP");
      if (cmds.length === 1 && !tele) role.set(cmds[0].id, [["phase", "P" + c.id], ["retour", R]]);
      else if (cmds.length === 2 && !tele) {
        const n1 = net("V1" + gi, `Navette 1 ${cmds[0].rep}↔${cmds[1].rep}`, "nav1").key, n2 = net("V2" + gi, `Navette 2 ${cmds[0].rep}↔${cmds[1].rep}`, "nav2").key;
        role.set(cmds[0].id, [["phase", "P" + c.id], ["nav1", n1], ["nav2", n2]]);
        role.set(cmds[1].id, [["retour", R], ["nav1", n1], ["nav2", n2]]);
      } else if (cmds.length) {
        const K = net("K" + gi, `Commande télérupteur ${lab}`, "cmdTL").key;
        cmds.forEach((k) => role.set(k.id, [["phase", "P" + c.id], ["cmdTL", K]]));
        if (!tl.has(c.id)) tl.set(c.id, []);
        tl.get(c.id).push(["cmdTL", K], ["retTL", R]);
        issues.push(`${b.n} : ${cmds.length} commandes pour ${lab} → télérupteur au tableau`);
      }
    }
    // prises et sorties de câble
    apps.filter((a) => !LIGHT.has(a.t) && !CMD.has(a.t)).forEach((a) => { const c = circOf.get(a.id); role.set(a.id, [["phase", "P" + c.id], ["neutre", "N" + c.id], ["terre", "T"]]); });

    // ---------- gaines ----------
    const deps = [];
    const lvB = lvIdx(b.lv);
    for (const a of apps) {
      const c = circOf.get(a.id), sec = c.section || 1.5;
      const wires = (role.get(a.id) || []).map(([fn, key]) => ({ fn, color: col[fn], section: ["retour", "nav1", "nav2", "cmdTL", "retTL"].includes(fn) ? sec : sec, net: key }));
      const len = gaineLength({ horiz: d2(b, a), downA: down(a.h, S), levels: Math.abs(lvIdx(a.lv) - lvB) }, S);
      deps.push({ id: a.id, kind: "app", p: a, app: a, label: `${NAMES[a.t] || a.t} ${a.rep || ""}`.trim(), room: a.room, circuit: c.n, wires, length: len });
    }
    for (const c of circs) {
      const sec = c.section || 1.5;
      const wires = [["phase", "P" + c.id], ["neutre", "N" + c.id], ["terre", "T"], ...(tl.get(c.id) || [])].map(([fn, key]) => ({ fn, color: col[fn], section: sec, net: key }));
      const len = tab ? gaineLength({ horiz: d2(b, tab), downA: S.traversee + Math.max(0, S.hsp - hTab), levels: Math.abs(lvIdx(tab.lv) - lvB) }, S) : null;
      deps.push({ id: "alim:" + c.id, kind: "alim", p: tab || { x: b.x, y: b.y - 1 }, label: `Alimentation ${c.n} (tableau)`, circuit: c.n, wires, length: len });
    }
    const faces = assignFaces(b, deps, S.departsFace);
    deps.forEach((g) => { g.face = faces.get(g.id) || "?"; g.diam = gaineFor(g.wires.map((w) => w.section), S.remplissage); });
    if (deps.length > S.departsMax) issues.push(`${b.n} : ${deps.length} départs (max ${S.departsMax})`);
    FACES.forEach((f) => { const n = deps.filter((g) => g.face === f).length; if (n > S.departsFace) issues.push(`${b.n} face ${f} : ${n} départs (max ${S.departsFace})`); });
    if (deps.some((g) => g.face === "?")) issues.push(`${b.n} : trop de départs pour les faces (max ${S.departsFace} par face)`);
    // numéros de gaine : face A puis B, C, D ; dans une face, dans le sens horaire
    const ang = (g) => Math.atan2(g.p.x - b.x, -(g.p.y - b.y));
    deps.sort((p, q) => FACES.indexOf(p.face) - FACES.indexOf(q.face) || ang(p) - ang(q));
    deps.forEach((g, i) => { g.no = `${b.n}-${String(i + 1).padStart(2, "0")}`; });
    // n° de raccordement définitifs (dans l'ordre : terre, phases, neutres, retours…)
    const used = nets.filter((nt) => deps.some((g) => g.wires.some((w) => w.net === nt.key)));
    used.forEach((nt, i) => { nt.n = i + 1; nt.wires = deps.flatMap((g) => g.wires.filter((w) => w.net === nt.key).map((w) => ({ gaine: g.no, label: g.label, fn: w.fn }))); });
    const numOf = new Map(used.map((nt) => [nt.key, nt.n]));
    deps.forEach((g) => g.wires.forEach((w) => { w.n = w.net ? numOf.get(w.net) ?? null : null; }));
    const cuivre = deps.reduce((s, g) => s + (g.length || 0) * g.wires.length, 0);
    return { ...b, gaines: deps.map(({ p, app, ...g }) => ({ ...g, appId: app ? app.id : null })), nets: used.map(({ key, ...nt }) => nt), circuits: circs.map((c) => c.n), cuivre: +cuivre.toFixed(1) };
  });

  // ---------- lignes directes : du tableau à l'appareil (spécialisés), du coffret de communication (RJ45) ----------
  const direct = [];
  let k = 0;
  for (const c of circuits.filter((x) => x.direct || x.kind === "comm")) {
    for (const id of c.apps) {
      const a = byId.get(id); if (!a) continue;
      const len = tab ? gaineLength({ horiz: d2(tab, a), downA: S.traversee + Math.max(0, S.hsp - hTab), downB: down(a.h, S), levels: Math.abs(lvIdx(tab.lv) - lvIdx(a.lv)) }, S) : null;
      const wires = c.kind === "comm" ? [] : ["phase", "neutre", "terre"].map((fn) => ({ fn, color: col[fn], section: c.section || 2.5, n: null }));
      direct.push({ no: `L${++k}`, circuit: c.n, appId: a.id, label: `${NAMES[a.t] || a.t} ${a.rep || ""}`.trim(), room: a.room, lv: a.lv, length: len, wires,
        cable: c.kind === "comm" ? "câble communication (RJ45)" : null, diam: c.kind === "comm" ? 20 : gaineFor(wires.map((w) => w.section), S.remplissage) });
    }
  }
  const cuivre = outBoxes.reduce((s, b) => s + b.cuivre, 0) + direct.reduce((s, g) => s + (g.length || 0) * g.wires.length, 0);
  const gaine = outBoxes.reduce((s, b) => s + b.gaines.reduce((t, g) => t + (g.length || 0), 0), 0) + direct.reduce((s, g) => s + (g.length || 0), 0);
  return { boxes: outBoxes, direct, issues, totals: { cuivre: +cuivre.toFixed(1), gaine: +gaine.toFixed(1), boites: outBoxes.length, gaines: outBoxes.reduce((s, b) => s + b.gaines.length, 0) + direct.length } };
}
