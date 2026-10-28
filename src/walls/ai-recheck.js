// Relecture ciblée par l'IA (v57) : le contrôle du plan (lumière sans commande, commande sans lumière, va-et-vient seul,
// deux interrupteurs sur une lumière) devient une consigne courte qui demande à l'IA de regarder CES points du plan.
// Pur (sans DOM) : utilisé par src/ext/ai-recheck-ui.js et par les tests.
//
// Positions : en POURCENTAGE d'un cadre (x % depuis la gauche, y % depuis le haut) ; sans clé le cadre est la page
// entière du PDF, avec clé c'est l'image envoyée. Le cadre est {x0, y0, w, h} en mètres (repère du plan).
// Réponse attendue : {"liaisons":[["I5","L12"]], "ajouts":[{"t":"INT","x":41.2,"y":63.5,"h":110,"pour":"S3","rep":"N1"}],
//                     "introuvable":[{"rep":"S3","pourquoi":"…"}], "remarques":"…"}
import { parseAiJson } from "./ai-plan.js";

const CMD = new Set(["INT", "VV", "BP", "CVR"]), LIGHT = new Set(["LUM", "SPOT", "APP", "VR", "VEL"]);
export const RECHECK_KINDS = { lum: "lumière sans commande", cmd: "commande sans lumière", vv: "va-et-vient seul", int2: "deux interrupteurs sur la même lumière" };
const ADD_TYPES = new Set(["INT", "VV", "BP", "LUM", "SPOT", "APP", "CVR"]);
const NAME = { INT: "interrupteur", VV: "va-et-vient", BP: "bouton-poussoir", CVR: "commande de volet", LUM: "point lumineux", SPOT: "spot", APP: "applique", VR: "volet roulant", VEL: "Velux" };

const r1 = (v) => Math.round(v * 10) / 10;
export const toPct = (frame, x, y) => ({ x: r1(((x - frame.x0) / frame.w) * 100), y: r1(((y - frame.y0) / frame.h) * 100) });
export const fromPct = (frame, x, y) => ({ x: frame.x0 + (x / 100) * frame.w, y: frame.y0 + (y / 100) * frame.h });
export const issueKey = (it) => it.kind + ":" + [...it.ids].sort().join(",");

// points à relire : anomalies du niveau (apps = allApps() du niveau), sauf points déjà traités (done = Set de clés)
// et appareils que l'IA n'a pas trouvés (a.aiNo) ; voisins = candidats proches avec leur repère
export function recheckPoints(apps, issues, { frame, done = new Set(), lv = null, radius = 6, max = 12 } = {}) {
  const byId = new Map(apps.map((a) => [a.id, a])), out = [];
  for (const it of issues) {
    if (!RECHECK_KINDS[it.kind] || (lv && it.lv !== lv)) continue;
    const key = issueKey(it);
    if (done.has(key)) continue;
    const A = it.ids.map((id) => byId.get(id)).filter(Boolean);
    if (!A.length || A.some((a) => a.aiNo)) continue;
    const a = A[0];
    // voisins : commandes près d'une lumière, lumières près d'une commande
    const want = it.kind === "lum" ? CMD : it.kind === "cmd" ? LIGHT : new Set([...CMD, ...LIGHT]);
    const near = apps.filter((b) => !it.ids.includes(b.id) && want.has(b.t) && Math.hypot(b.x - a.x, b.y - a.y) <= radius)
      .map((b) => ({ rep: b.rep || b.t, t: b.t, room: b.room, d: Math.hypot(b.x - a.x, b.y - a.y), ...toPct(frame, b.x, b.y) }))
      .sort((p, q) => p.d - q.d).slice(0, 5);
    out.push({ key, kind: it.kind, ids: it.ids, points: A.map((b) => ({ id: b.id, rep: b.rep || b.t, t: b.t, room: b.room || "hors pièce", ...toPct(frame, b.x, b.y) })), near });
    if (out.length >= max) break;
  }
  return out;
}

const pt = (p) => `${p.rep} (${NAME[p.t] || p.t}, ${p.room}) à x = ${p.x} %, y = ${p.y} %`;
function lineOf(P, i) {
  const [a, b] = P.points;
  const q = P.kind === "lum" ? `${pt(a)} n'a pas de commande. Cherche l'interrupteur (ou le va-et-vient) qui l'allume : suis le trait de liaison ; pour un point extérieur, regarde à l'intérieur près de la porte ou de la baie la plus proche (souvent un boîtier double).`
    : P.kind === "cmd" ? `${pt(a)} ne commande aucune lumière. Quelle lumière allume-t-il ? Suis son trait de liaison.`
    : P.kind === "vv" ? `${pt(a)} est un va-et-vient seul sur ${b ? b.rep : "sa lumière"}. Où est le 2e va-et-vient (ou le bon type de commande) ?`
    : `${P.points.map((p) => p.rep).join(", ")} commandent la même lumière avec un interrupteur simple : ce sont sans doute des va-et-vient, ou une liaison est fausse.`;
  const near = P.near.length ? `\n   Repères proches : ${P.near.map((n) => `${n.rep} (${NAME[n.t] || n.t}, x ${n.x} %, y ${n.y} %)`).join(" ; ")}.` : "";
  return `${i + 1}. ${q}${near}`;
}

// consigne de relecture ; mode "paste" (PDF joint, page entière) ou "image" (image jointe = le cadre)
export function recheckPrompt(P, { mode = "paste", pass = 1 } = {}) {
  const where = mode === "paste" ? "la page 1 du PDF joint (page ENTIÈRE)" : "l'image jointe";
  return `Relecture ciblée${pass > 1 ? ` (passe ${pass})` : ""} d'un plan électrique de maison déjà relevé. Le contrôle du logiciel signale ${P.length} point${P.length > 1 ? "s" : ""} à revoir.
Positions en POURCENTAGE de ${where} : x depuis le bord gauche, y depuis le bord haut (0 à 100).
Repères : I = interrupteur, V = va-et-vient, B = poussoir, L = point lumineux, S = spot, AP = applique (comme dans le logiciel, pas forcément comme sur le plan).

${P.map(lineOf).join("\n")}

Pour chaque point :
- la commande existe déjà dans le logiciel (repère connu) : donne la liaison ["repère commande","repère lumière"] ;
- elle existe sur le plan mais pas dans le logiciel : donne-la dans "ajouts" (type INT, VV, BP, LUM, SPOT, APP ou CVR, position en %, "h" en cm si écrite, "pour" = repère de l'appareil concerné, "rep" = un nom à toi, N1, N2…, si tu veux t'en servir dans "liaisons") ;
- tu ne la trouves pas sur le plan : mets le repère dans "introuvable" avec la raison. N'invente rien.

Réponds UNIQUEMENT avec ce JSON (sans texte autour) :
{"liaisons":[["I5","L12"]],"ajouts":[{"t":"INT","x":41.2,"y":63.5,"h":110,"pour":"S3","rep":"N1"}],"introuvable":[{"rep":"L7","pourquoi":"aucune commande dessinée"}],"remarques":""}`;
}

// réponse → modifications : {links [{c, l} ids ou "add:i"], adds [{t, x, y, h, pour}], nope [ids], errors [texte], remarques}
export function parseCorrections(text, { apps, frame, points = [] }) {
  const raw = typeof text === "string" ? parseAiJson(text) : text || {};
  const byRep = new Map(), errors = [];
  apps.forEach((a) => { if (a.rep) byRep.set(String(a.rep).toUpperCase(), a); });
  const adds = [];
  (raw.ajouts || []).forEach((d) => {
    const t = String(d.t || "").toUpperCase(), x = +d.x, y = +d.y;
    if (!ADD_TYPES.has(t) || !(x >= 0 && x <= 100 && y >= 0 && y <= 100)) { errors.push(`ajout ignoré (${esc0(d.t)} ${d.x}/${d.y})`); return; }
    const h = +d.h;
    adds.push({ t, ...fromPct(frame, x, y), ...(h > 0 && h <= 300 ? { h: Math.round(h) } : {}), pour: d.pour ? String(d.pour).toUpperCase() : null, rep: d.rep ? String(d.rep).toUpperCase() : null });
  });
  // un repère est soit un appareil existant, soit un appareil ajouté (on le désigne par son "pour")
  const ref = (rep) => {
    const R = String(rep || "").toUpperCase();
    if (byRep.has(R)) return byRep.get(R).id;
    const i = adds.findIndex((a) => a.rep === R);
    return i >= 0 ? "add:" + i : null;
  };
  const links = [];
  const role = (k) => { if (k.startsWith("add:")) return CMD.has(adds[+k.slice(4)].t) ? "c" : "l"; const a = apps.find((x) => x.id === k); return a && CMD.has(a.t) ? "c" : a && LIGHT.has(a.t) ? "l" : null; };
  (raw.liaisons || []).forEach((l) => {
    if (!Array.isArray(l) || l.length < 2) return;
    let c = ref(l[0]), m = ref(l[1]);
    if (!c || !m) { errors.push(`liaison ${l[0]} → ${l[1]} : repère inconnu`); return; }
    if (role(c) === "l" && role(m) === "c") [c, m] = [m, c];
    if (role(c) !== "c" || role(m) !== "l") { errors.push(`liaison ${l[0]} → ${l[1]} : il faut une commande et une lumière`); return; }
    links.push({ c, l: m });
  });
  // un ajout sans liaison donnée est relié à l'appareil "pour" (commande ↔ lumière)
  adds.forEach((d, i) => {
    if (!d.pour || links.some((k) => k.c === "add:" + i || k.l === "add:" + i)) return;
    const p = byRep.get(d.pour);
    if (!p) return;
    const isC = CMD.has(d.t);
    if (isC && LIGHT.has(p.t)) links.push({ c: "add:" + i, l: p.id });
    else if (!isC && CMD.has(p.t)) links.push({ c: p.id, l: "add:" + i });
  });
  const nope = [];
  (raw.introuvable || []).forEach((n) => { const a = byRep.get(String((n && n.rep) || n || "").toUpperCase()); if (a) nope.push({ id: a.id, why: String((n && n.pourquoi) || "").slice(0, 200) }); });
  // points de la consigne restés sans réponse
  const touched = new Set([...links.flatMap((k) => [k.c, k.l]), ...nope.map((n) => n.id), ...adds.map((d) => d.pour && byRep.get(d.pour)?.id).filter(Boolean)]);
  const silent = points.filter((P) => !P.ids.some((id) => touched.has(id))).map((P) => P.key);
  return { links, adds, nope, errors, silent, remarques: String(raw.remarques || "").slice(0, 600) };
}
const esc0 = (v) => String(v == null ? "" : v).slice(0, 20);

// boucle avec clé : limites décidées avec Kévin (v57) — passes ≤ max (0–3), arrêt sans anomalie ou sans progrès
export function shouldContinue({ pass, max, before, after, changed }) {
  if (pass >= max) return { go: false, why: `limite de ${max} relecture${max > 1 ? "s" : ""} atteinte` };
  if (!after) return { go: false, why: "plus rien à revoir" };
  if (!changed || after >= before) return { go: false, why: "la dernière relecture n'a rien corrigé" };
  return { go: true };
}
