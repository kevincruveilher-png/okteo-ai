// Relecture ciblée par l'IA (v57, étendue en v61) : toutes les erreurs que le logiciel détecte après un relevé
// deviennent une consigne courte qui demande à l'IA de regarder CES points du plan, avec une question propre à chaque
// erreur ; sa réponse (JSON) devient des corrections (aperçu, un seul Ctrl+Z) et un rapport (corrigé, introuvable…).
// Pur (sans DOM) : utilisé par src/ext/ai-recheck-ui.js et par les tests.
//
// Positions : en POURCENTAGE d'un cadre (x % depuis la gauche, y % depuis le haut) ; sans clé le cadre est la page
// entière du PDF, avec clé c'est l'image envoyée. Le cadre est {x0, y0, w, h} en mètres (repère du plan).
import { parseAiJson, AI_TYPES } from "./ai-plan.js";

const CMD = new Set(["INT", "VV", "BP", "CVR"]), LIGHT = new Set(["LUM", "SPOT", "APP", "VR", "VEL"]);
export const RECHECK_KINDS = {
  lum: "lumière sans commande", cmd: "commande sans lumière", vv: "va-et-vient seul", int2: "deux interrupteurs sur la même lumière",
  piece: "pièce non fermée par les murs", type: "type à préciser", hors: "appareil hors des pièces", doublon: "doublon possible",
  rem: "doute signalé par l'IA", haut: "hauteur non écrite (cuisine)", ouv: "ouverture recentrée par le logiciel",
  perdue: "ouverture loin des murs", porte: "sens de porte non lu",
};
// ordre de priorité : les liaisons d'abord, les portes en dernier
const ORDER = ["lum", "cmd", "vv", "int2", "piece", "type", "hors", "doublon", "rem", "haut", "ouv", "perdue", "porte"];
// appareils normalement hors des pièces (façade, jardin, combles, fenêtre)
export const EXT_OK = new Set(["APP", "SPOT", "PCEXT", "GEXT", "PX4", "MGAR", "BPS", "ANT", "AQA", "CLIM", "VR", "VEL", "INTERCO", "VMCG", "BOUCHE", "TAB", "EQP"]);
const NAME = { INT: "interrupteur", VV: "va-et-vient", BP: "bouton-poussoir", CVR: "commande de volet", LUM: "point lumineux", SPOT: "spot", APP: "applique", VR: "volet roulant", VEL: "Velux", PC16: "prise 16 A", PC20: "prise 20 A", SC: "sortie de câble", porte: "porte", fenetre: "fenêtre", garage: "porte de garage" };
const nm = (t) => NAME[t] || (AI_TYPES[t] ? AI_TYPES[t].split(" (")[0] : t);

const r1 = (v) => Math.round(v * 10) / 10;
export const toPct = (frame, x, y) => ({ x: r1(((x - frame.x0) / frame.w) * 100), y: r1(((y - frame.y0) / frame.h) * 100) });
export const fromPct = (frame, x, y) => ({ x: frame.x0 + (x / 100) * frame.w, y: frame.y0 + (y / 100) * frame.h });
export const issueKey = (it) => it.kind + ":" + [...it.ids].sort().join(",");

// points à relire. ctx = { apps (allApps du niveau ; a.out = hors de toute pièce), issues (contrôle), openings
// (openingsInfo), missing [{name, x, y}] (pièces nommées non fermées), lost [{x, y, w, kind}] (ouvertures perdues),
// remarques (texte de l'IA au relevé), nope (clés déjà dites introuvables), kitchen(room) → vrai si cuisine }.
// Les points déjà demandés (done) ou introuvables ne sont jamais redemandés.
export function recheckPoints(ctx, { frame, done = new Set(), lv = null, radius = 6, max = 20, maxDoors = 8 } = {}) {
  const { apps = [], issues = [], openings = [], missing = [], lost = [], remarques = "", nope = new Set(), kitchen = () => false } = ctx;
  const byId = new Map(apps.map((a) => [a.id, a])), cand = [];
  const skip = (key) => done.has(key) || nope.has(key);
  const P = (a) => ({ id: a.id, rep: a.rep || a.t, t: a.t, room: a.room || "hors pièce", ...toPct(frame, a.x, a.y) });
  const nearOf = (a, want, ids) => apps.filter((b) => !ids.includes(b.id) && want.has(b.t) && Math.hypot(b.x - a.x, b.y - a.y) <= radius)
    .map((b) => ({ rep: b.rep || b.t, t: b.t, room: b.room, d: Math.hypot(b.x - a.x, b.y - a.y), ...toPct(frame, b.x, b.y) })).sort((p, q) => p.d - q.d).slice(0, 5);
  // 1. liaisons (contrôle du plan)
  for (const it of issues) {
    if (!["lum", "cmd", "vv", "int2"].includes(it.kind) || (lv && it.lv !== lv)) continue;
    const key = issueKey(it), A = it.ids.map((id) => byId.get(id)).filter(Boolean);
    if (skip(key) || !A.length || A.some((a) => a.aiNo)) continue;
    const want = it.kind === "lum" ? CMD : it.kind === "cmd" ? LIGHT : new Set([...CMD, ...LIGHT]);
    cand.push({ key, kind: it.kind, ids: it.ids, points: A.map(P), near: nearOf(A[0], want, it.ids) });
  }
  // 2. pièces nommées par l'IA mais pas fermées par les murs
  missing.forEach((m) => { const key = "piece:" + m.name; if (!skip(key)) cand.push({ key, kind: "piece", ids: [], points: [{ rep: m.name, t: "piece", room: m.name, ...toPct(frame, m.x, m.y) }], near: [] }); });
  // 3. appareils : type vague, hors des pièces, hauteur non écrite en cuisine
  for (const a of apps) {
    if (a.aiNo) continue;
    if ((a.t === "SC" || a.t === "PC20") && !skip("type:" + a.id)) cand.push({ key: "type:" + a.id, kind: "type", ids: [a.id], points: [P(a)], near: [] });
    if (a.out && !EXT_OK.has(a.t) && !skip("hors:" + a.id)) cand.push({ key: "hors:" + a.id, kind: "hors", ids: [a.id], points: [P(a)], near: [] });
    if (a.t === "PC16" && a.hNo && a.pt == null && kitchen(a.room) && !skip("haut:" + a.id)) cand.push({ key: "haut:" + a.id, kind: "haut", ids: [a.id], points: [P(a)], near: [] });
  }
  // 4. doublons : deux appareils du même type à moins de 15 cm
  for (let i = 0; i < apps.length; i++) for (let j = i + 1; j < apps.length; j++) {
    const a = apps[i], b = apps[j];
    if (a.t !== b.t || Math.hypot(a.x - b.x, a.y - b.y) > 0.15) continue;
    const key = "doublon:" + [a.id, b.id].sort().join(",");
    if (!skip(key) && !a.aiNo && !b.aiNo) cand.push({ key, kind: "doublon", ids: [a.id, b.id], points: [P(a), P(b)], near: [] });
  }
  // 5. doutes écrits par l'IA au relevé (une seule fois)
  if (String(remarques || "").trim() && !skip("rem")) cand.push({ key: "rem", kind: "rem", ids: [], points: [], near: [], text: String(remarques).trim().slice(0, 600) });
  // 6. ouvertures recentrées, perdues ; portes sans sens
  const O = (o) => ({ id: o.id, rep: o.rep, t: o.kind, room: "", w: Math.round((o.w || 0) * 100), ...toPct(frame, o.x, o.y) });
  openings.forEach((o) => { if (o.adj && !skip("ouv:" + o.id)) cand.push({ key: "ouv:" + o.id, kind: "ouv", ids: [o.id], points: [O(o)], near: [] }); });
  lost.forEach((o, i) => { const key = "perdue:" + i; if (!skip(key)) cand.push({ key, kind: "perdue", ids: [], points: [{ id: null, rep: "X" + (i + 1), t: o.kind, room: "", w: Math.round((o.w || 0) * 100), lost: i, ...toPct(frame, o.x, o.y) }], near: [] }); });
  let doors = 0;
  openings.forEach((o) => { if (o.kind === "porte" && !o.sens && !skip("porte:" + o.id) && doors < maxDoors) { doors++; cand.push({ key: "porte:" + o.id, kind: "porte", ids: [o.id], points: [O(o)], near: [] }); } });
  cand.sort((p, q) => ORDER.indexOf(p.kind) - ORDER.indexOf(q.kind));
  return cand.slice(0, max);
}

const pt = (p) => `${p.rep} (${nm(p.t)}${p.room ? ", " + p.room : ""}) à x = ${p.x} %, y = ${p.y} %`;
// question propre à chaque erreur : quoi regarder, où, ce qui est plausible
function lineOf(P, i, zoom) {
  const [a, b] = P.points;
  const Q = {
    lum: () => `${pt(a)} n'a pas de commande. Cherche l'interrupteur (ou le va-et-vient) qui l'allume : suis le trait de liaison ; pour un point extérieur, regarde à l'intérieur près de la porte ou de la baie la plus proche (souvent un boîtier double).`,
    cmd: () => `${pt(a)} ne commande aucune lumière. Quelle lumière allume-t-il ? Suis son trait de liaison.`,
    vv: () => `${pt(a)} est un va-et-vient seul sur ${b ? b.rep : "sa lumière"}. Où est le 2e va-et-vient (ou le bon type de commande) ?`,
    int2: () => `${P.points.map((p) => p.rep).join(", ")} commandent la même lumière avec un interrupteur simple : ce sont sans doute des va-et-vient, ou une liaison est fausse.`,
    piece: () => `La pièce « ${a.rep} » (x = ${a.x} %, y = ${a.y} %) n'est pas fermée par les murs relevés. Donne le ou les murs qui manquent dans "murs" (axe du mur, épaisseur), avec "pour":"${a.rep}". Si ce nom n'est pas une pièce (placard, note, cote), mets-le dans "introuvable".`,
    type: () => `${pt(a)} : type trop vague. Quel appareil est-ce exactement (chauffe-eau CETH, lave-linge LL, four FOUR, plaque PLAQ, VMC, Aqua Air AQA, sèche-serviette SS…) ? Lis le texte écrit à côté du symbole et la légende. Réponds dans "types".`,
    hors: () => `${pt(a)} est en dehors de toutes les pièces. Est-il mal placé (donne sa vraie position dans "deplacer") ou est-ce un appareil extérieur d'un autre type (réponds dans "types") ? S'il n'existe pas, mets-le dans "supprimer".`,
    doublon: () => `${a.rep} et ${b.rep} (${nm(a.t)}) sont au même endroit (x = ${a.x} %, y = ${a.y} %). Le plan en montre-t-il vraiment deux ? Sinon, mets le repère en trop dans "supprimer".`,
    rem: () => `Au relevé, tu as écrit : « ${P.text} ». Reprends chaque doute et corrige ce qui doit l'être (dans la rubrique qui convient) ; ce que tu ne peux pas trancher, dis-le dans "remarques".`,
    haut: () => `${pt(a)} : prise de la cuisine sans hauteur relevée. Une hauteur est-elle écrite à côté (ex. « H:1.10m ») ? Est-elle le long du plan de travail ? Réponds dans "hauteurs" ("h" en cm, "pt": true ou false).`,
    ouv: () => `${a.rep} (${nm(a.t)}, ${a.w} cm), recentrée par le logiciel à x = ${a.x} %, y = ${a.y} % : donne sa vraie position (centre sur l'axe du mur) et sa largeur dans "ouvertures".`,
    perdue: () => `${a.rep} (${nm(a.t)}, ${a.w} cm) à x = ${a.x} %, y = ${a.y} % : loin de tout mur relevé. Donne sa vraie position (centre sur l'axe du mur) dans "ouvertures", ou mets-la dans "introuvable" si elle n'existe pas.`,
    porte: () => `${a.rep} (porte, ${a.w} cm) à x = ${a.x} %, y = ${a.y} % : de quel côté sont les gonds et de quel côté s'ouvre-t-elle ? Réponds dans "portes" : "gx","gy" = montant des gonds, "vx","vy" = un point au milieu de l'arc du battant.`,
  }[P.kind];
  const near = P.near && P.near.length ? `\n   Repères proches : ${P.near.map((n) => `${n.rep} (${nm(n.t)}, x ${n.x} %, y ${n.y} %)`).join(" ; ")}.` : "";
  return `${i + 1}. [${RECHECK_KINDS[P.kind]}] ${Q()}${near}${zoom && zoom.has(P.key) ? `\n   Zoom ${zoom.get(P.key)} : image agrandie autour de ce point.` : ""}`;
}

// consigne de relecture ; mode "paste" (PDF joint) ou "image" (image jointe = le cadre) ; zoom = Map clé → n° d'image
export function recheckPrompt(P, { mode = "paste", pass = 1, page = 1, zoom = null } = {}) {
  const where = mode === "paste" ? `la page ${page} du PDF joint (page ENTIÈRE ; ignore les autres pages)` : "la 1re image jointe (le plan entier)";
  const kinds = new Set(P.map((x) => x.kind));
  const rub = [
    ["liaisons", `[["I5","L12"]] = [commande, lumière]`, ["lum", "cmd", "vv", "int2"]],
    ["ajouts", `[{"t":"INT","x":41.2,"y":63.5,"h":110,"pour":"L12","rep":"N1"}] = appareil qui manque au logiciel (type de la liste du relevé, "pour" = repère concerné, "rep" = un nom à toi pour "liaisons")`, ["lum", "cmd", "vv", "int2", "rem"]],
    ["types", `[{"rep":"SC3","t":"CETH"}] = bon type d'un appareil`, ["type", "hors", "rem"]],
    ["deplacer", `[{"rep":"P12","x":40.1,"y":22.5}] = vraie position d'un appareil`, ["hors", "rem"]],
    ["supprimer", `[{"rep":"P13","pourquoi":"…"}] = appareil qui n'existe pas (doublon, note prise pour un symbole)`, ["hors", "doublon", "rem"]],
    ["hauteurs", `[{"rep":"P20","h":110,"pt":true}]`, ["haut", "rem"]],
    ["ouvertures", `[{"rep":"O3","x":50.2,"y":30.1,"l":90,"t":"porte"}] = vraie position et largeur (cm) ; "t" : porte, fenetre ou garage`, ["ouv", "perdue", "rem"]],
    ["portes", `[{"rep":"O4","gx":0,"gy":0,"vx":0,"vy":0}] = montant des gonds et point de l'arc du battant`, ["porte", "rem"]],
    ["murs", `[{"x1":0,"y1":0,"x2":0,"y2":0,"ep":10,"pour":"Cuisine"}] = mur qui manque (axe, épaisseur en cm)`, ["piece", "rem"]],
  ].filter(([, , k]) => k.some((x) => kinds.has(x)));
  const form = `{${rub.map(([n]) => `"${n}":[]`).join(",")}${rub.length ? "," : ""}"introuvable":[{"rep":"L7","pourquoi":"…"}],"remarques":""}`;
  return `Relecture ciblée${pass > 1 ? ` (passe ${pass})` : ""} d'un plan électrique de maison déjà relevé. Le contrôle du logiciel signale ${P.length} point${P.length > 1 ? "s" : ""} à revoir.
Positions en POURCENTAGE de ${where} : x depuis le bord gauche, y depuis le bord haut (0 à 100), avec une décimale.
Repères : I = interrupteur, V = va-et-vient, B = poussoir, L = point lumineux, S = spot, AP = applique, P = prise, O = ouverture (comme dans le logiciel, pas forcément comme sur le plan).
Ignore les annotations ajoutées à la main (écritures manuscrites, surlignages, traits de feutre).

${P.map((x, i) => lineOf(x, i, zoom)).join("\n")}

Rubriques de la réponse :
${rub.map(([n, d]) => `- "${n}" : ${d}`).join("\n")}
- "introuvable" : repère que tu ne trouves pas sur le plan, avec la raison. N'invente rien.

Réponds UNIQUEMENT avec ce JSON (sans texte autour) :
${form}`;
}

// réponse → corrections (en mètres) + ce qui a été fait pour chaque point (rapport)
export function parseCorrections(text, { apps, openings = [], frame, points = [] }) {
  const raw = typeof text === "string" ? parseAiJson(text) : text || {};
  const U = (v) => String(v == null ? "" : v).trim().toUpperCase();
  const byRep = new Map(), opRep = new Map(), errors = [];
  apps.forEach((a) => { if (a.rep) byRep.set(U(a.rep), a); });
  openings.forEach((o) => opRep.set(U(o.rep), o));
  const pct = (x, y) => { x = +x; y = +y; return x >= 0 && x <= 100 && y >= 0 && y <= 100 ? fromPct(frame, x, y) : null; };
  const app = (rep, what) => { const a = byRep.get(U(rep)); if (!a) errors.push(`${what} ${esc0(rep)} : repère inconnu`); return a || null; };
  // ajouts (tout type de la liste du relevé)
  const adds = [];
  (raw.ajouts || []).forEach((d) => {
    const t = U(d.t), p = pct(d.x, d.y);
    if (!AI_TYPES[t] || !p) { errors.push(`ajout ignoré (${esc0(d.t)} ${d.x}/${d.y})`); return; }
    const h = +d.h;
    adds.push({ t, ...p, ...(h > 0 && h <= 300 ? { h: Math.round(h) } : {}), pour: d.pour ? U(d.pour) : null, rep: d.rep ? U(d.rep) : null });
  });
  const ref = (rep) => { const R = U(rep); if (byRep.has(R)) return byRep.get(R).id; const i = adds.findIndex((a) => a.rep === R); return i >= 0 ? "add:" + i : null; };
  const role = (k) => { if (k.startsWith("add:")) return CMD.has(adds[+k.slice(4)].t) ? "c" : LIGHT.has(adds[+k.slice(4)].t) ? "l" : null; const a = apps.find((x) => x.id === k); return a && CMD.has(a.t) ? "c" : a && LIGHT.has(a.t) ? "l" : null; };
  const links = [];
  (raw.liaisons || []).forEach((l) => {
    if (!Array.isArray(l) || l.length < 2) return;
    let c = ref(l[0]), m = ref(l[1]);
    if (!c || !m) { errors.push(`liaison ${l[0]} → ${l[1]} : repère inconnu`); return; }
    if (role(c) === "l" && role(m) === "c") [c, m] = [m, c];
    if (role(c) !== "c" || role(m) !== "l") { errors.push(`liaison ${l[0]} → ${l[1]} : il faut une commande et une lumière`); return; }
    links.push({ c, l: m, txt: `liaison ${U(l[0])} → ${U(l[1])}` });
  });
  adds.forEach((d, i) => {
    if (!d.pour || links.some((k) => k.c === "add:" + i || k.l === "add:" + i)) return;
    const p = byRep.get(d.pour);
    if (!p) return;
    if (CMD.has(d.t) && LIGHT.has(p.t)) links.push({ c: "add:" + i, l: p.id, txt: `${d.t} ajouté et relié à ${d.pour}` });
    else if (LIGHT.has(d.t) && CMD.has(p.t)) links.push({ c: p.id, l: "add:" + i, txt: `${d.t} ajouté et relié à ${d.pour}` });
  });
  const types = [], moves = [], dels = [], heights = [], opens = [], doors = [], walls = [];
  (raw.types || []).forEach((d) => { const a = app(d.rep, "type"), t = U(d.t); if (!a) return; if (!AI_TYPES[t]) { errors.push(`type inconnu ${esc0(d.t)}`); return; } if (t !== a.t) types.push({ id: a.id, t, txt: `${U(d.rep)} : ${a.t} → ${t}` }); });
  (raw.deplacer || []).forEach((d) => { const a = app(d.rep, "déplacement"), p = pct(d.x, d.y); if (a && p) moves.push({ id: a.id, ...p, txt: `${U(d.rep)} déplacé` }); });
  (raw.supprimer || []).forEach((d) => { const r = d && typeof d === "object" ? d.rep : d, a = app(r, "suppression"); if (a) dels.push({ id: a.id, why: String((d && d.pourquoi) || "").slice(0, 160), txt: `${U(r)} supprimé${d && d.pourquoi ? " (" + String(d.pourquoi).slice(0, 80) + ")" : ""}` }); });
  (raw.hauteurs || []).forEach((d) => { const a = app(d.rep, "hauteur"); if (!a) return; const h = +d.h, u = { id: a.id }; if (h > 0 && h <= 300) u.h = Math.round(h); if (d.pt === true || d.pt === false) u.pt = d.pt; if (u.h || "pt" in u) heights.push({ ...u, txt: `${U(d.rep)} : ${u.h ? u.h + " cm" : "hauteur inchangée"}${u.pt === true ? ", plan de travail" : u.pt === false ? ", pas de plan de travail" : ""}` }); });
  (raw.ouvertures || []).forEach((d) => {
    const R = U(d.rep), p = pct(d.x, d.y), o = opRep.get(R), lost = /^X(\d+)$/.exec(R);
    if (!p || (!o && !lost)) { errors.push(`ouverture ${esc0(d.rep)} : repère ou position inconnus`); return; }
    const kind = /gar/i.test(d.t || "") ? "garage" : /fen/i.test(d.t || "") ? "fenetre" : /porte/i.test(d.t || "") ? "porte" : o ? o.kind : "porte";
    opens.push({ id: o ? o.id : null, lost: lost ? +lost[1] - 1 : null, ...p, w: +d.l > 0 ? +d.l / 100 : o ? o.w : 0.9, kind, txt: `${R} ${o ? "replacée" : "posée"} (${Math.round(+d.l || (o ? o.w * 100 : 90))} cm)` });
  });
  (raw.portes || []).forEach((d) => { const R = U(d.rep), o = opRep.get(R), g = pct(d.gx, d.gy), v = pct(d.vx, d.vy); if (!o || (!g && !v)) { errors.push(`porte ${esc0(d.rep)} : repère ou points inconnus`); return; } doors.push({ id: o.id, x: o.x, y: o.y, w: o.w, g, v, txt: `${R} : sens de la porte lu` }); });
  (raw.murs || []).forEach((d) => { const a = pct(d.x1, d.y1), b = pct(d.x2, d.y2); if (!a || !b) { errors.push("mur ignoré (positions)"); return; } walls.push({ a, b, ep: +d.ep > 0 ? Math.min(0.5, +d.ep / 100) : 0.1, pour: d.pour ? String(d.pour).trim() : null, txt: `mur ajouté${d.pour ? " (" + String(d.pour).trim() + ")" : ""}` }); });
  // introuvables : appareil (marqué aiNo), ou n'importe quel point de la consigne (clé)
  const nope = [], nopeKeys = [];
  (raw.introuvable || []).forEach((n) => {
    const R = U((n && n.rep) || n), why = String((n && n.pourquoi) || "introuvable").slice(0, 200), a = byRep.get(R);
    if (a) nope.push({ id: a.id, why });
    points.filter((P) => P.points.some((p) => U(p.rep) === R)).forEach((P) => nopeKeys.push({ key: P.key, why }));
  });
  // ce qui a été fait pour chaque point (rapport)
  const idOfAdd = (k) => (String(k).startsWith("add:") ? null : k);
  const acts = new Map(points.map((P) => [P.key, []]));
  const hit = (pred, txt) => points.forEach((P) => { if (pred(P)) acts.get(P.key).push(txt); });
  links.forEach((k) => hit((P) => P.ids.includes(idOfAdd(k.c)) || P.ids.includes(idOfAdd(k.l)), k.txt));
  adds.forEach((d, i) => { if (d.pour && !links.some((k) => k.c === "add:" + i || k.l === "add:" + i)) hit((P) => P.points.some((p) => U(p.rep) === d.pour), `${d.t} ajouté pour ${d.pour}`); });
  [...types, ...moves, ...dels, ...heights].forEach((u) => hit((P) => P.ids.includes(u.id), u.txt));
  opens.forEach((u) => hit((P) => (u.id && P.ids.includes(u.id)) || (u.lost != null && P.kind === "perdue" && P.points[0].lost === u.lost), u.txt));
  doors.forEach((u) => hit((P) => P.ids.includes(u.id), u.txt));
  walls.forEach((u) => hit((P) => P.kind === "piece" && (!u.pour || U(P.points[0].rep) === U(u.pour)), u.txt));
  const nCorr = links.length + adds.length + types.length + moves.length + dels.length + heights.length + opens.length + doors.length + walls.length;
  if (String(raw.remarques || "").trim() || nCorr) hit((P) => P.kind === "rem", "doutes repris");
  const nopeOf = new Map(nopeKeys.map((n) => [n.key, n.why]));
  const silent = points.filter((P) => !acts.get(P.key).length && !nopeOf.has(P.key)).map((P) => P.key);
  const count = nCorr;
  return { links, adds, types, moves, dels, heights, opens, doors, walls, nope, nopeKeys, acts, silent, errors, count, remarques: String(raw.remarques || "").slice(0, 600) };
}
const esc0 = (v) => String(v == null ? "" : v).slice(0, 20);

// rapport d'une relecture : état de chaque point (après application) et % de réussite (points corrigés / signalés)
// still = Set des clés encore signalées après correction
export function recheckReport(points, C, still) {
  const nopeOf = new Map((C.nopeKeys || []).map((n) => [n.key, n.why]));
  const rows = points.map((P) => {
    const acts = (C.acts && C.acts.get(P.key)) || [], gone = !still.has(P.key);
    const state = nopeOf.has(P.key) ? "introuvable" : acts.length && gone ? "corrigé" : acts.length ? "modifié, toujours signalé" : gone ? "corrigé" : "sans réponse";
    return { key: P.key, kind: P.kind, label: `${RECHECK_KINDS[P.kind]} : ${P.kind === "rem" ? "remarques du relevé" : P.points.map((p) => p.rep).join(", ")}`, state, detail: nopeOf.get(P.key) || acts.join(" ; ") };
  });
  const ok = rows.filter((r) => r.state === "corrigé").length;
  return { rows, total: rows.length, ok, pct: rows.length ? Math.round((ok / rows.length) * 100) : 100, nope: rows.filter((r) => r.state === "introuvable").length };
}

// boucle avec clé : limites décidées avec Kévin (v57) — passes ≤ max (0–3), arrêt sans anomalie ou sans progrès
export function shouldContinue({ pass, max, before, after, changed }) {
  if (pass >= max) return { go: false, why: `limite de ${max} relecture${max > 1 ? "s" : ""} atteinte` };
  if (!after) return { go: false, why: "plus rien à revoir" };
  if (!changed || after >= before) return { go: false, why: "la dernière relecture n'a rien corrigé" };
  return { go: true };
}
