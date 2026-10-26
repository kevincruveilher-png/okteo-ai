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
// Couleurs (v34) : dans une boîte, 1er circuit d'une section = rouge/bleu, 2e = gris/bleu foncé… (réglage pairesCircuits) ;
// retours et navettes : orange, marron, noir, ivoire à tour de rôle (les 2 navettes d'un va-et-vient : même couleur).
// Appareils au même endroit (≤ memeEndroit) : une seule gaine, chaque fil commun une seule fois (repiquage).
// Appareil à l'extérieur : câble nG (marron, noir, gris, bleu, vert/jaune) au lieu de fils.
import { gaineFor, packAlim } from "./gaine.js";
import { assignFaces, FACES } from "./boites.js";

const LIGHT = new Set(["LUM", "SPOT", "APP"]), CMD = new Set(["INT", "VV", "BP"]);
const d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const list = (v) => String(v || "").split(",").map((x) => x.trim()).filter(Boolean);
// « rouge/bleu, gris/bleu foncé » → [{phase, neutre}]
export function parsePairs(v) {
  const P = list(v).map((x) => x.split("/").map((y) => y.trim())).filter((x) => x.length === 2 && x[0] && x[1]).map(([phase, neutre]) => ({ phase, neutre }));
  return P.length ? P : [{ phase: "rouge", neutre: "bleu" }];
}
// conducteurs d'un câble : la terre en vert/jaune, le neutre en bleu, les autres en marron, noir, gris
export function cableColors(wires) {
  const n = wires.length, rest = ["marron", "noir", "gris"];
  const hasBlue = n === 2 || n === 3 || n >= 5;
  return wires.map((w) => (w.fn === "terre" ? "vert/jaune" : w.fn === "neutre" && hasBlue ? "bleu" : rest.shift() || "gris"));
}
// longueur à plat d'une gaine : boîte → points de passage (tracé à la main, b.routes[clé]) → arrivée
export function viaLen(from, pts, to) {
  let p = from, L = 0;
  for (const q of [...(pts || []), to]) { L += d2(p, q); p = q; }
  return L;
}
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
  const pairs = parsePairs(S.pairesCircuits || `${S.cPhase}/${S.cNeutre}`), cmdCols = list(S.couleursCommande || `${S.cRetour}, ${S.cNavette1}, ${S.cNavette2}`);
  const col = { phase: pairs[0].phase, neutre: pairs[0].neutre, terre: S.cTerre, retour: cmdCols[0] || S.cRetour, nav1: cmdCols[1] || S.cNavette1, nav2: cmdCols[1] || S.cNavette2, cmdTL: cmdCols[0] || S.cRetour, retTL: cmdCols[0] || S.cRetour };

  const outBoxes = boxes.map((b) => {
    const apps = b.apps.map((id) => byId.get(id)).filter(Boolean);
    const inBox = new Set(apps.map((a) => a.id));
    const circs = circuits.filter((c) => c.apps.some((id) => inBox.has(id))).sort((p, q) => String(p.n).localeCompare(String(q.n), "fr", { numeric: true }));
    // ---------- n° de raccordement (« circuit de câblage ») ----------
    const nets = []; const net = (key, label, fn) => { let x = nets.find((n) => n.key === key); if (!x) { x = { key, n: nets.length + 1, label, fn, wires: [] }; nets.push(x); } return x; };
    net("T", "Terres (toutes ensemble)", "terre");
    // couleurs de la boîte : chaque circuit sa paire phase/neutre (par section), chaque allumage ses couleurs de commande
    const keyColor = new Map([["T", S.cTerre]]), bySec = new Map();
    for (const c of circs) {
      const sec = c.section || 1.5, k = bySec.get(sec) || 0; bySec.set(sec, k + 1);
      const p = pairs[k % pairs.length];
      if (k >= pairs.length) issues.push(`${b.n} : plus de ${pairs.length} circuits en ${String(sec).replace(".", ",")} mm² — couleurs phase/neutre à compléter (Paramètres → Câblage)`);
      keyColor.set("P" + c.id, p.phase); keyColor.set("N" + c.id, p.neutre);
    }
    let ci = 0;
    const nextCol = () => cmdCols.length ? cmdCols[ci++ % cmdCols.length] : S.cRetour;
    // ordre de câblage (= ordre des n°) : terres, neutres circuit par circuit, phases, puis retours et navettes
    for (const c of circs) net("N" + c.id, `Neutre ${c.n}`, "neutre");
    for (const c of circs) net("P" + c.id, `Phase ${c.n}`, "phase");
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
      keyColor.set(R, nextCol());
      lights.forEach((l) => role.set(l.id, [["retour", R], ["neutre", "N" + circOf.get(l.id).id], ["terre", "T"]]));
      const tele = cmds.length >= 3 || cmds.some((k) => k.t === "BP");
      if (cmds.length === 1 && !tele) role.set(cmds[0].id, [["phase", "P" + c.id], ["retour", R]]);
      else if (cmds.length === 2 && !tele) {
        const n1 = net("V1" + gi, `Navette 1 ${cmds[0].rep}↔${cmds[1].rep}`, "nav1").key, n2 = net("V2" + gi, `Navette 2 ${cmds[0].rep}↔${cmds[1].rep}`, "nav2").key;
        const cn = nextCol(); keyColor.set(n1, cn); keyColor.set(n2, cn);
        role.set(cmds[0].id, [["phase", "P" + c.id], ["nav1", n1], ["nav2", n2]]);
        role.set(cmds[1].id, [["retour", R], ["nav1", n1], ["nav2", n2]]);
      } else if (cmds.length) {
        const K = net("K" + gi, `Commande télérupteur ${lab}`, "cmdTL").key;
        keyColor.set(K, nextCol());
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
    // appareils au même endroit (même niveau, ≤ memeEndroit) : une seule gaine
    const near = S.memeEndroit ?? 0.3, spots = [];
    for (const a of apps) {
      const sp = spots.find((g) => g[0].lv === a.lv && g.some((o) => d2(o, a) <= near + 1e-9));
      if (sp) sp.push(a); else spots.push([a]);
    }
    const colorOf = (fn, key) => (key != null && keyColor.has(key) ? keyColor.get(key) : col[fn]);
    for (const G of spots) {
      const a = G[0], seen = new Set(), wires = [];
      for (const m of G) {
        const sec = circOf.get(m.id).section || 1.5;
        for (const [fn, key] of role.get(m.id) || []) {
          if (key != null && seen.has(key)) continue;          // fil commun : une seule fois (repiqué sur place)
          if (key != null) seen.add(key);
          wires.push({ fn, color: colorOf(fn, key), section: sec, net: key });
        }
      }
      let cable = null;
      if (S.cableExt && G.every((m) => m.ext)) {
        const cc = cableColors(wires);
        wires.forEach((w, i) => { w.color = cc[i]; });
        cable = `${wires.length}G${String(Math.max(...wires.map((w) => w.section))).replace(".", ",")}`;
      }
      const route = G.map((m) => (b.routes || {})[m.id]).find(Boolean) || null;
      const downMax = Math.max(...G.map((m) => down(m.h, S)));
      const len = gaineLength({ horiz: viaLen(b, route, a), downA: downMax, levels: Math.abs(lvIdx(a.lv) - lvB) }, S);
      const label = G.length === 1 ? `${NAMES[a.t] || a.t} ${a.rep || ""}`.trim() : G.map((m) => m.rep || NAMES[m.t] || m.t).join(" + ");
      const cn = [...new Set(G.map((m) => circOf.get(m.id).n))];
      // la face est celle par où la gaine sort : vers son 1er point de passage s'il y en a un
      deps.push({ id: a.id, kind: "app", p: route ? route[0] : a, app: a, appIds: G.map((m) => m.id), routed: !!route, label, room: a.room, circuit: cn.join(", "), wires, length: len, cable, ext: !!cable });
    }
    // alimentation depuis le tableau : une seule gaine (phase + neutre de chaque circuit, télérupteur, une terre) ;
    // divisée si elle passait en Ø25, la terre restant dans la 1re
    const alimG = packAlim(circs.map((c) => ({ ...c, section: c.section || 1.5, extra: (tl.get(c.id) || []).length })), S.remplissage);
    alimG.forEach((G, gi) => {
      const wires = [];
      for (const c of G) {
        const sec = c.section || 1.5;
        [["phase", "P" + c.id], ["neutre", "N" + c.id], ...(tl.get(c.id) || [])].forEach(([fn, key]) => wires.push({ fn, color: colorOf(fn, key), section: sec, net: key, circuit: c.n }));
      }
      // une seule terre par boîte : dans la 1re gaine d'alimentation, à la plus grosse section de la boîte
      if (gi === 0) wires.push({ fn: "terre", color: S.cTerre, section: Math.max(...circs.map((c) => c.section || 1.5)), net: "T" });
      const route = (b.routes || {}).tab || null;
      const len = tab ? gaineLength({ horiz: viaLen(b, route, tab), downA: S.traversee + Math.max(0, S.hsp - hTab), levels: Math.abs(lvIdx(tab.lv) - lvB) }, S) : null;
      const names = G.map((c) => c.n);
      deps.push({ id: "alim:" + gi, kind: "alim", p: route ? route[0] : tab || { x: b.x, y: b.y - 1 }, routed: !!route,
        label: `Alimentation ${names.join(" + ")} (tableau)${alimG.length > 1 ? ` — gaine ${gi + 1}/${alimG.length}` : ""}`, circuit: names.join(", "), circuits: names, wires, length: len });
    });
    const faces = assignFaces(b, deps, S.departsFace);
    deps.forEach((g) => { g.face = faces.get(g.id) || "?"; g.diam = gaineFor(g.wires.map((w) => w.section), S.remplissage); });
    if (deps.length > S.departsMax) issues.push(`${b.n} : ${deps.length} départs (max ${S.departsMax})`);
    FACES.forEach((f) => { const n = deps.filter((g) => g.face === f).length; if (n > S.departsFace) issues.push(`${b.n} face ${f} : ${n} départs (max ${S.departsFace})`); });
    if (deps.some((g) => g.face === "?")) issues.push(`${b.n} : trop de départs pour les faces (max ${S.departsFace} par face)`);
    // numéros de gaine : face A puis B, C, D ; dans une face, dans le sens horaire
    const ang = (g) => Math.atan2(g.p.x - b.x, -(g.p.y - b.y));
    deps.sort((p, q) => FACES.indexOf(p.face) - FACES.indexOf(q.face) || ang(p) - ang(q));
    deps.forEach((g, i) => { g.no = `${b.n}-${String(i + 1).padStart(2, "0")}`; });
    // n° de raccordement définitifs (dans l'ordre : terres, neutres, phases, retours et navettes…)
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
