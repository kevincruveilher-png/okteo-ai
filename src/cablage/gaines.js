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
// Couleurs (v38, règles KiTéOHM) : phase/neutre selon le type de circuit (prises gris/bleu foncé, éclairage et cuisine
// rouge/bleu) ; deux circuits du même type dans une boîte gardent les mêmes couleurs et se distinguent par leur bague
// (n° du circuit sur la paire de fils de l'alimentation, T1… pour le télérupteur). Ronde des fils : retours lampe, navettes
// (les deux de même couleur) et commandes de télérupteur prennent la couleur suivante (orange, violet, noir, marron,
// ivoire), en repartant du début dans chaque boîte, dans le même ordre partout : les allumages les plus fréquents du
// chantier d'abord, pour que les mêmes gaines se fabriquent en série.
// Appareils au même endroit (≤ memeEndroit) : une seule gaine, chaque fil commun une seule fois (repiquage).
// Appareil à l'extérieur : câble du stock (3G1,5…) choisi selon les fils nécessaires, âmes repérées à la couleur de leur
// fonction (ex. marron repéré orange), âme en trop isolée.
import { gaineFor, packAlim } from "./gaine.js";
import { FACES, portLayout } from "./boites.js";

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
export const FN_LABEL = { phase: "phase", neutre: "neutre", terre: "terre", retour: "retour lampe", nav1: "navette 1", nav2: "navette 2", cmdTL: "commande télérupteur", retTL: "retour télérupteur", isole: "fil en trop (isolé)" };
// couleurs phase/neutre d'un type de circuit (réglages v38)
export function pairOf(kind, S) {
  const v = kind === "prises" ? S.couleursPrises : kind === "cuisine" ? S.couleursCuisine : kind === "specialise" ? S.couleursSpecialise : S.couleursEclairage;
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

export function computeWiring({ items, links, circuits, boxes, levels = [], S }) {
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
  // harmonisation : les compositions d'allumage les plus fréquentes du chantier prennent les premières couleurs de la ronde
  const freq = new Map();
  boxes.forEach((b) => boxGroups(b).forEach((x) => freq.set(x.sig, (freq.get(x.sig) || 0) + 1)));
  let tlNo = 0;

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
    let ci = 0;
    const nextCol = () => cmdCols.length ? cmdCols[ci++ % cmdCols.length] : S.cRetour;
    // ordre de câblage (= ordre des n°, v47, demande de Kévin) : terres, puis circuit par circuit neutre et phase —
    // cuisine (bleu / rouge 2,5), prises (bleu foncé / gris 1,5), éclairage (bleu / rouge 1,5) — puis retours et navettes
    const RANK = { cuisine: 0, specialise: 1, prises: 2, eclairage: 3 };
    const ordered = [...circs].sort((p, q) => (RANK[p.kind] ?? 4) - (RANK[q.kind] ?? 4) || String(p.n).localeCompare(String(q.n), "fr", { numeric: true }));
    for (const c of ordered) { net("N" + c.id, `Neutre ${c.n}`, "neutre"); net("P" + c.id, `Phase ${c.n}`, "phase"); }
    // allumages de la boîte, dans l'ordre commun à toutes les boîtes (le plus fréquent du chantier d'abord)
    const groupsL = boxGroups(b).sort((p, q) => (freq.get(q.sig) || 0) - (freq.get(p.sig) || 0) || p.sig.localeCompare(q.sig) || p.cy - q.cy || p.cx - q.cx);
    const role = new Map();            // appareil → fils
    const tl = new Map();              // circuit → fils télérupteur à ajouter dans son alimentation
    let gi = 0;
    for (const { lights, cmds, tele } of groupsL) {
      gi++;
      const c = circOf.get((lights[0] || cmds[0]).id) || circOf.get((cmds[0] || lights[0]).id);
      const cOf = (a) => circOf.get(a.id) || c;
      if (!c) continue;
      const lab = lights.map((a) => a.rep).join(" ") || "—";
      if (!cmds.length) { issues.push(`${b.n} : ${lab} sans commande (retour lampe non raccordé)`); }
      if (!lights.length) { cmds.forEach((k) => role.set(k.id, [["phase", "P" + cOf(k).id], ["retour", null]])); issues.push(`${b.n} : ${cmds.map((k) => k.rep).join(" ")} ne commande aucune lumière`); continue; }
      const R = net("R" + gi, `Retour lampe ${lab}`, "retour").key;
      keyColor.set(R, nextCol());
      lights.forEach((l) => role.set(l.id, [["retour", R], ["neutre", "N" + cOf(l).id], ["terre", "T"]]));
      if (cmds.length === 1 && !tele) role.set(cmds[0].id, [["phase", "P" + cOf(cmds[0]).id], ["retour", R]]);
      else if (cmds.length === 2 && !tele) {
        const n1 = net("V1" + gi, `Navette 1 ${cmds[0].rep}↔${cmds[1].rep}`, "nav1").key, n2 = net("V2" + gi, `Navette 2 ${cmds[0].rep}↔${cmds[1].rep}`, "nav2").key;
        const cn = nextCol(); keyColor.set(n1, cn); keyColor.set(n2, cn);
        role.set(cmds[0].id, [["phase", "P" + cOf(cmds[0]).id], ["nav1", n1], ["nav2", n2]]);
        role.set(cmds[1].id, [["retour", R], ["nav1", n1], ["nav2", n2]]);
      } else if (cmds.length) {
        const K = net("K" + gi, `Commande télérupteur ${lab}`, "cmdTL").key;
        keyColor.set(K, nextCol());
        const T = "T" + ++tlNo;
        if (S.bagues !== false) { keyBague.set(K, T); keyBague.set(R + "@alim", T); }
        cmds.forEach((k) => role.set(k.id, [["phase", "P" + cOf(k).id], ["cmdTL", K]]));
        if (!tl.has(c.id)) tl.set(c.id, []);
        tl.get(c.id).push(["cmdTL", K], ["retTL", R]);
        issues.push(`${b.n} : ${cmds.length} commandes pour ${lab} → télérupteur ${T} au tableau`);
      }
    }
    // prises et sorties de câble
    apps.filter((a) => !LIGHT.has(a.t) && !CMD.has(a.t)).forEach((a) => { const c = circOf.get(a.id); if (c) role.set(a.id, [["phase", "P" + c.id], ["neutre", "N" + c.id], ["terre", "T"]]); });

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
          wires.push({ fn, color: colorOf(fn, key), section: sec, net: key, circuit: fn === "terre" ? null : circOf.get(m.id).n });
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
      const route = G.map((m) => (b.routes || {})[m.id]).find(Boolean) || null;
      const downMax = Math.max(...G.map((m) => down(m.h, S)));
      const len = gaineLength({ horiz: viaLen(b, route, a), downA: downMax, levels: Math.abs(lvIdx(a.lv) - lvB) }, S);
      const label = G.length === 1 ? `${NAMES[a.t] || a.t} ${a.rep || ""}`.trim() : G.map((m) => m.rep || NAMES[m.t] || m.t).join(" + ");
      const cn = [...new Set(G.map((m) => circOf.get(m.id).n))];
      // la face est celle par où la gaine sort : vers son 1er point de passage s'il y en a un
      deps.push({ id: a.id, kind: "app", p: route ? route[0] : a, app: a, appIds: G.map((m) => m.id), reps: G.map((m) => m.rep || NAMES[m.t] || m.t), routed: !!route, label, room: a.room, circuit: cn.join(", "), wires, length: len, cable, ext: !!cable });
    }
    // alimentation depuis le tableau : une seule gaine (phase + neutre de chaque circuit, télérupteur, une terre) ;
    // divisée si elle passait en Ø25, la terre restant dans la 1re
    const alimG = packAlim(circs.map((c) => ({ ...c, section: c.section || 1.5, extra: (tl.get(c.id) || []).length })), S.remplissage);
    alimG.forEach((G, gi) => {
      const wires = [];
      for (const c of G) {
        const sec = c.section || 1.5;
        [["phase", "P" + c.id], ["neutre", "N" + c.id], ...(tl.get(c.id) || [])].forEach(([fn, key]) => wires.push({ fn, color: colorOf(fn, key), section: sec, net: key, circuit: c.n, bague: keyBague.get(fn === "retTL" ? key + "@alim" : key) || null }));
      }
      // une seule terre par boîte : dans la 1re gaine d'alimentation, à la plus grosse section de la boîte
      if (gi === 0) wires.push({ fn: "terre", color: S.cTerre, section: Math.max(...circs.map((c) => c.section || 1.5)), net: "T" });
      const route = (b.routes || {}).tab || null;
      const len = tab ? gaineLength({ horiz: viaLen(b, route, tab), downA: S.traversee + Math.max(0, S.hsp - hTab), levels: Math.abs(lvIdx(tab.lv) - lvB) }, S) : null;
      const names = G.map((c) => c.n);
      deps.push({ id: "alim:" + gi, kind: "alim", p: route ? route[0] : tab || { x: b.x, y: b.y - 1 }, routed: !!route,
        label: `Alimentation ${names.join(" + ")} (tableau)${alimG.length > 1 ? ` — gaine ${gi + 1}/${alimG.length}` : ""}`, circuit: names.join(", "), circuits: names, wires, length: len });
    });
    const PL = portLayout(b, deps.map((g) => ({ id: g.id, p: g.p, keys: g.kind === "alim" ? [g.id === "alim:0" ? "tab" : g.id] : g.appIds })), S.departsFace, b.ports || {});
    deps.forEach((g) => { const q = PL.get(g.id) || {}; g.face = q.face || "?"; g.slot = q.slot ?? null; g.diam = gaineFor(g.wires.map((w) => w.section), S.remplissage); });
    if (deps.length > S.departsMax) issues.push(`${b.n} : ${deps.length} départs (max ${S.departsMax})`);
    FACES.forEach((f) => { const n = deps.filter((g) => g.face === f).length; if (n > S.departsFace) issues.push(`${b.n} face ${f} : ${n} départs (max ${S.departsFace})`); });
    if (deps.some((g) => g.face === "?")) issues.push(`${b.n} : trop de départs pour les faces (max ${S.departsFace} par face)`);
    // numéros de gaine : face A puis B, C, D ; dans une face, dans le sens horaire
    const ang = (g) => Math.atan2(g.p.x - b.x, -(g.p.y - b.y));
    deps.sort((p, q) => FACES.indexOf(p.face) - FACES.indexOf(q.face) || (p.slot ?? 99) - (q.slot ?? 99) || ang(p) - ang(q));
    deps.forEach((g, i) => { g.no = `${b.n}.${String(i + 1).padStart(2, "0")}`; });
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
  // gaines identiques sur tout le chantier (mêmes fils, mêmes couleurs, même câble) : fabrication en série
  const sigG = (g) => (g.cable ? g.cable + "|" : "") + g.wires.map((w) => `${w.section}${w.core ? w.core + ">" : ""}${w.color}`).sort().join(",");
  const series = new Map();
  outBoxes.forEach((b) => b.gaines.forEach((g) => { if (g.kind === "app") { const k = sigG(g); series.set(k, (series.get(k) || 0) + 1); } }));
  outBoxes.forEach((b) => b.gaines.forEach((g) => { if (g.kind === "app") g.serie = series.get(sigG(g)); }));
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
  return { boxes: outBoxes, direct, issues, splits, series: [...series].map(([sig, n]) => ({ sig, n })).sort((p, q) => q.n - p.n), totals: { cuivre: +cuivre.toFixed(1), gaine: +gaine.toFixed(1), boites: outBoxes.length, gaines: outBoxes.reduce((s, b) => s + b.gaines.length, 0) + direct.length } };
}
