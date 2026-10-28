// Relecture ciblée par l'IA (v57, étendue en v61) : toutes les erreurs que le logiciel détecte après un relevé
// (liaisons, pièces non fermées, types vagues, appareils hors pièce, doublons, doutes de l'IA, hauteurs, ouvertures,
// sens des portes) deviennent une consigne courte, avec une question propre à chaque erreur.
// - Sans clé : « Copier la relecture » → la coller dans la conversation qui a fait le relevé (PDF joint) → coller ici
//   les corrections → aperçu → « Appliquer » (un seul Ctrl+Z).
// - Avec clé : relectures automatiques après un relevé IA (Paramètres : 0 à 3, 2 par défaut), arrêt quand il n'y a plus
//   rien à revoir ou qu'une relecture ne corrige rien, 3 min au plus par appel, « Arrêter », jetons ; Claude reçoit en
//   plus une image agrandie autour de chaque point (8 au plus).
// - Rapport (cab.releves[niveau].rapport) : pour chaque relecture, chaque point (corrigé, introuvable, sans réponse…)
//   et le % de réussite, « sous réserve du contrôle BE » ; onglet Étude (reportHTML).
// Un point dit introuvable n'est plus jamais redemandé ; un point déjà demandé ne l'est plus dans la session.
import { chat, PROVIDERS } from "./ai.js";
import { settings } from "./settings.js";
import { recheckPoints, recheckPrompt, parseCorrections, recheckReport, shouldContinue, RECHECK_KINDS } from "../walls/ai-recheck.js";
import { findRooms, nameRooms, pointInPoly, labelPoint } from "../walls/rooms.js";
import { pref } from "../prefs.js";
import { esc } from "./util.js";

const SYSTEM = "Tu es dessinateur au bureau d'études électricité d'un fabricant de pieuvres électriques. Tu relis un plan déjà relevé, seulement aux points demandés, et tu réponds uniquement en JSON.";
const TIMEOUT = 180000, MAX_ZOOM = 8, ZOOM_M = 4;
const CUISINE_APP = new Set(["PLAQ", "HOTTE", "FOUR", "LV"]);

// données du relevé IA d'un niveau (gardées dans le chantier)
export function releveOf(api, lv = api.level.id) { return ((api.cab || {}).releves || {})[lv] || null; }
function saveReleve(api, lv, patch) {
  const all = { ...((api.cab || {}).releves || {}) };
  all[lv] = { ...(all[lv] || { date: new Date().toISOString(), pieces: [], lost: [], remarques: "", nope: [], rapport: [] }), ...patch };
  api.setCab({ releves: all });
  return all[lv];
}
// à l'ajout d'un relevé IA (ai-releve.js) : pièces nommées, ouvertures perdues, remarques, premier rapport
export function recordReleve(api, plan, { mode = "", info = "", counts = {} } = {}) {
  return saveReleve(api, api.level.id, {
    date: new Date().toISOString(), mode, info, nope: [],
    pieces: (plan.pieces || []).map((p) => ({ name: p.name, x: +p.x.toFixed(3), y: +p.y.toFixed(3) })),
    lost: (plan.lost || []).map((o) => ({ x: +o.x.toFixed(3), y: +o.y.toFixed(3), w: o.w, kind: o.kind })),
    remarques: String(plan.remarques || "").slice(0, 600),
    rapport: [{ type: "releve", date: new Date().toISOString(), info, counts }],
  });
}

export function createRecheck({ api, aiReleve }) {
  const card = document.createElement("div");
  card.className = "wcard aicard rkcard"; card.hidden = true; card.setAttribute("role", "dialog"); card.setAttribute("aria-label", "Relecture ciblée par l'IA");
  document.querySelector(".stage").appendChild(card);
  const done = new Set();          // points déjà demandés dans cette session
  let corr = null, points = [], frame = null, running = false, stopped = false, last = null, copied = "", lastReport = null, only = null, ops = [];

  const close = () => { card.hidden = true; api.setPreview(null); corr = null; };
  const show = (html) => { card.innerHTML = `<div class="wcard-h"><b>✦ Relecture ciblée par l'IA</b><button class="wx" title="Fermer">✕</button></div>${html}`; card.hidden = false; card.querySelector(".wx").onclick = () => { if (running) stopped = true; close(); }; };
  const lv = () => api.level.id;
  const page = () => (api.ch.fond && api.ch.fond.page) || 1;

  // contexte : appareils du niveau (hors pièce ?), contrôle, ouvertures, pièces non fermées, ouvertures perdues, remarques
  function ctx() {
    const geo = api.exportGeometry(lv()), R = (geo.rooms || []).filter((r) => r.poly && r.poly.length > 2);
    const D = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];
    const inside = (x, y, tol) => D.some(([dx, dy]) => R.some((r) => pointInPoly(x + dx * tol, y + dy * tol, r.poly)));
    const apps = api.allApps().filter((a) => a.lv === lv()).map((a) => ({ ...a, out: R.length > 0 && a.t !== "TAB" && !inside(a.x, a.y, 0.3) }));
    const kitchenRooms = new Set(apps.filter((a) => CUISINE_APP.has(a.t) && a.room).map((a) => a.room));
    const rel = releveOf(api) || {};
    ops = api.openingsInfo ? api.openingsInfo() : [];
    return {
      apps, issues: api.control.filter((it) => it.lv === lv()), openings: ops,
      missing: (rel.pieces || []).filter((p) => R.length && !inside(p.x, p.y, 0)),
      lost: rel.lost || [], remarques: rel.remarques || "", nope: new Set(rel.nope || []),
      kitchen: (room) => !!room && (/cuisin|kitchen/i.test(room) || kitchenRooms.has(room)),
    };
  }
  async function pageFrame() { const f = await api.levelFond(lv()); return f ? { x0: f.x, y0: f.y, w: f.w, h: f.h } : null; }
  // points à demander maintenant ; relecture limitée à quelques appareils ou ouvertures (« relire ce point », tests)
  function pointsNow() {
    const C = ctx();
    return only ? recheckPoints(C, { frame, done, lv: lv(), max: 999, maxDoors: 999 }).filter((P) => P.ids.some((id) => only.has(id))).slice(0, 20) : recheckPoints(C, { frame, done, lv: lv() });
  }
  function compute(fr) { frame = fr; points = pointsNow(); return points; }
  // clés encore signalées (sans tenir compte des points déjà demandés) : sert au rapport
  function stillKeys() { const C = ctx(); return new Set(recheckPoints(C, { frame, done: new Set(), max: 999, maxDoors: 999 }).map((P) => P.key)); }

  const listHTML = () => `<ul class="rk-list sm">${points.map((P) => `<li><span class="rk-k">${esc(RECHECK_KINDS[P.kind])}</span> <b>${esc(P.kind === "rem" ? "remarques du relevé" : P.points.map((p) => p.rep).join(", "))}</b> <span class="mut">${esc(P.points[0] ? P.points[0].room || "" : "")}</span></li>`).join("")}</ul>`;

  // fenêtre de départ : points à revoir, consigne à copier, zone de collage
  async function open({ ids = null } = {}) {
    if (api.tab !== "plan") api.setTab("plan");
    only = ids ? new Set(ids) : null;
    const fr = await pageFrame().catch(() => null);
    if (!fr) return show(`<p>Ce niveau n'a pas de plan (fond). La relecture compare le dessin au plan : ajoutez d'abord le PDF du plan (onglet Chantiers).</p>`);
    compute(fr);
    const key = !!settings.activeProvider(), max = pref("relectures");
    if (!points.length) { show(`<p>Rien à faire relire : le logiciel ne signale aucune erreur de relevé sur ce niveau${done.size ? " (en dehors des points déjà demandés)" : ""}.</p>${done.size ? `<div class="wrow"><button id="rk-reset">Tout redemander</button></div>` : ""}`); wireReset(); return; }
    show(`<p class="sm"><b>${points.length} point${points.length > 1 ? "s" : ""} à faire relire</b> :</p>${listHTML()}
      <p class="sm"><b>1.</b> Copiez la relecture et collez-la <b>dans la conversation qui a fait le relevé</b> (le PDF du plan doit y être joint).
        <button id="rk-copy" title="Consigne courte : une question par erreur, avec le repère, la pièce, la position en % de la page ${page()} et les repères proches">📋 Copier la relecture</button></p>
      <p class="sm"><b>2.</b> Collez ici sa réponse (JSON) :</p>
      <textarea id="rk-paste" rows="5" style="width:100%" placeholder='{"liaisons":[["I5","L12"]],"types":[],"introuvable":[]}'></textarea>
      <div class="wrow"><button class="on" id="rk-read">Lire les corrections</button>
        ${key && max > 0 ? `<button id="rk-auto" title="Envoie l'image du plan, des zooms autour des points et la consigne à l'IA, applique ses corrections, recommence tant que ça progresse (${max} relecture${max > 1 ? "s" : ""} au plus, 3 min par appel)">✦ Relire avec l'IA (${max} max)</button>` : ""}
        ${done.size ? `<button id="rk-reset" title="Redemander aussi les points déjà demandés dans cette session">Tout redemander</button>` : ""}<button id="rk-x">Fermer</button></div>
      ${key ? "" : `<p class="mut sm">Avec une clé IA (Paramètres), la relecture se fait toute seule après un relevé IA.</p>`}`);
    const ta = card.querySelector("#rk-paste");
    card.querySelector("#rk-x").onclick = close;
    card.querySelector("#rk-read").onclick = () => { const t = ta.value.trim(); if (t) fromText(t); };
    card.querySelector("#rk-copy").onclick = async (e) => {
      const b = e.currentTarget, txt = recheckPrompt(points, { mode: "paste", page: page() });
      copied = txt;
      points.forEach((P) => done.add(P.key));
      let ok = false;
      try { await Promise.race([navigator.clipboard.writeText(txt), new Promise((_, no) => setTimeout(() => no(new Error("délai")), 1500))]); ok = true; } catch { /* repli ci-dessous */ }
      if (!ok) { ta.value = txt; ta.select(); }
      b.textContent = ok ? "✓ Relecture copiée" : "Consigne dans la zone ci-dessous : Ctrl+C, puis collez la réponse à sa place";
    };
    const au = card.querySelector("#rk-auto"); if (au) au.onclick = () => loop();
    wireReset();
  }
  function wireReset() { const r = card.querySelector("#rk-reset"); if (r) r.onclick = () => { done.clear(); open({ ids: only ? [...only] : null }); }; }

  const parse = (text) => parseCorrections(text, { apps: ctx().apps, openings: ops, frame, points });
  const summary = (c) => [["liaison", "liaisons", c.links.length], ["appareil ajouté", "appareils ajoutés", c.adds.length], ["type changé", "types changés", c.types.length], ["appareil déplacé", "appareils déplacés", c.moves.length],
    ["appareil supprimé", "appareils supprimés", c.dels.length], ["hauteur", "hauteurs", c.heights.length], ["ouverture", "ouvertures", c.opens.length], ["sens de porte", "sens de portes", c.doors.length],
    ["mur ajouté", "murs ajoutés", c.walls.length], ["introuvable", "introuvables", c.nopeKeys.length]]
    .filter(([, , n]) => n).map(([w1, w2, n]) => `<b>${n}</b> ${n > 1 ? w2 : w1}`).join(", ");

  // réponse collée (ou de l'IA) → aperçu et liste des corrections
  function fromText(text, meta = { via: "copie" }) {
    try { corr = parse(text); }
    catch (e) { show(`<p>Cette réponse n'est pas exploitable : ${esc(e.message)}</p><div class="wrow"><button id="rk-back">Revenir</button></div>`); card.querySelector("#rk-back").onclick = () => open({ ids: only ? [...only] : null }); return null; }
    points.forEach((P) => done.add(P.key));
    api.setPreview({ devices: [...corr.adds.map((d) => ({ t: d.t, x: d.x, y: d.y })), ...corr.moves.map((m) => ({ t: (ctx().apps.find((a) => a.id === m.id) || {}).t || "SC", x: m.x, y: m.y }))], links: [] });
    const n = corr.count + corr.nope.length + corr.nopeKeys.length;
    show(`<p class="sm">L'IA propose : ${summary(corr) || "rien"}. En orange : appareils ajoutés ou déplacés.</p>
      <ul class="rk-list sm">${points.map((P) => { const a = corr.acts.get(P.key) || [], no = corr.nopeKeys.find((k) => k.key === P.key); return `<li><b>${esc(P.kind === "rem" ? "remarques" : P.points.map((p) => p.rep).join(", "))}</b> ${a.length ? esc(a.join(" ; ")) : no ? `<span class="mut">introuvable : ${esc(no.why)}</span>` : `<span class="mut">sans réponse</span>`}</li>`; }).join("")}</ul>
      ${corr.errors.length ? `<p class="warn sm">⚠ ${esc(corr.errors.join(" ; "))}</p>` : ""}
      ${corr.remarques ? `<p class="mut sm">Remarque de l'IA : ${esc(corr.remarques)}</p>` : ""}
      <div class="wrow"><button class="on" id="rk-ok" ${n ? "" : "disabled"}>Appliquer</button><button id="rk-no">Annuler</button></div>`);
    card.querySelector("#rk-ok").onclick = () => { const r = apply(corr, meta); reportCard(r.report); api.setHint(`Relecture appliquée : ${r.report.ok}/${r.report.total} points corrigés (${r.report.pct} %, sous réserve du contrôle BE). Ctrl+Z annule.`); };
    card.querySelector("#rk-no").onclick = close;
    return corr;
  }

  // pièces recalculées après l'ajout de murs : noms des pièces actuelles + noms relevés par l'IA
  function redoRooms() {
    const S = api.state, rel = releveOf(api) || {};
    const labels = [...S.rooms.map((r) => { const P = r.poly || (r.x0 != null ? [{ x: r.x0, y: r.y0 }, { x: r.x1, y: r.y0 }, { x: r.x1, y: r.y1 }, { x: r.x0, y: r.y1 }] : null); const c = P ? labelPoint(P) : null; return c && r.name ? { name: r.name, x: c.x, y: c.y, size: 2 } : null; }).filter(Boolean),
      ...(rel.pieces || []).map((p) => ({ ...p, size: 1 }))];
    const list = nameRooms(findRooms(S.nodes, S.segs, { defEp: S.wallEp }), labels).map((r) => ({ ...r, also: r.labels.filter((n) => n !== r.name) }));
    if (list.length >= S.rooms.length) api.addRooms(list, { replace: true });
  }

  // corrections → plan, un seul Ctrl+Z ; rapport enregistré dans le chantier
  function apply(c, meta = { via: "copie" }) {
    let report = null;
    const rel0 = releveOf(api) || {};
    api.batch(() => {
      if (c.walls.length) { api.addWalls(c.walls); redoRooms(); }
      if (c.adds.length || c.links.length) {
        const L = c.links.map((k) => ({ c: String(k.c).startsWith("add:") ? +k.c.slice(4) : k.c, l: String(k.l).startsWith("add:") ? +k.l.slice(4) : k.l }));
        api.importDevices(c.adds.map((d) => ({ t: d.t, x: d.x, y: d.y, h: d.h })), L);
      }
      const upd = [...c.types.map((u) => ({ id: u.id, t: u.t })), ...c.moves.map((u) => ({ id: u.id, x: u.x, y: u.y })), ...c.heights.map((u) => ({ id: u.id, h: u.h, pt: u.pt }))];
      if (upd.length) api.updateApps(upd);
      if (c.dels.length) api.removeApps(c.dels.map((d) => d.id));
      c.opens.forEach((o) => { if (o.id || o.lost != null) api.placeOpening({ id: o.id, x: o.x, y: o.y, w: o.w, kind: o.kind }); });
      c.doors.forEach((d) => api.placeOpening({ id: d.id, x: d.x, y: d.y, w: d.w, kind: "porte", g: d.g, v: d.v }));
      c.nope.forEach((n) => api.setAppFlags(n.id, { aiNo: n.why || "introuvable" }));
      const still = stillKeys();
      // points « fixes » (remarques du relevé, ouverture perdue) : traités dès que l'IA y a répondu
      points.forEach((P) => { if ((P.kind === "rem" || P.kind === "perdue") && (c.acts.get(P.key) || []).length) still.delete(P.key); });
      report = recheckReport(points, c, still);
      // jamais redemandés : introuvables, remarques reprises, ouvertures perdues posées
      const closed = [...c.nopeKeys.map((k) => k.key), ...report.rows.filter((r) => r.state === "corrigé" && /^(rem|perdue:)/.test(r.key)).map((r) => r.key)];
      saveReleve(api, lv(), { nope: [...new Set([...(rel0.nope || []), ...closed])], rapport: [...(rel0.rapport || []), { type: "relecture", date: new Date().toISOString(), ...meta, total: report.total, ok: report.ok, pct: report.pct, rows: report.rows, errors: c.errors.slice(0, 10) }] });
    });
    api.setPreview(null);
    lastReport = report;
    document.dispatchEvent(new CustomEvent("okteo:recheck", { detail: { report } }));
    return { report };
  }

  function reportCard(r) {
    show(`<p><b>Relecture appliquée : ${r.ok}/${r.total} points corrigés (${r.pct} %)</b> <span class="mut sm">sous réserve du contrôle BE</span></p>
      <ul class="rk-list sm">${r.rows.map((x) => `<li class="rk-${x.state === "corrigé" ? "ok" : x.state === "introuvable" ? "no" : "wait"}"><b>${esc(x.state)}</b> · ${esc(x.label)}${x.detail ? ` <span class="mut">— ${esc(x.detail)}</span>` : ""}</li>`).join("")}</ul>
      <div class="wrow"><button class="on" id="rk-close">OK</button><button id="rk-rep" title="Le rapport complet de l'analyse IA (relevé et relectures) dans l'onglet Étude">Rapport complet</button><button id="rk-again" title="Revoir les points qui restent">Relire ce qui reste</button></div>`);
    card.querySelector("#rk-close").onclick = close;
    card.querySelector("#rk-rep").onclick = () => { close(); api.setTab("etude"); setTimeout(() => document.getElementById("et-ia")?.scrollIntoView({ block: "start" }), 150); };
    card.querySelector("#rk-again").onclick = () => open();
  }

  // zooms autour des points (avec clé, Claude) : images JPEG de 4 m de côté
  async function zooms(P) {
    const f = await api.levelFond(lv()).catch(() => null);
    if (!f) return { images: [], map: new Map() };
    const img = new Image(); img.crossOrigin = "anonymous";
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = f.url; }).catch(() => null);
    if (!img.naturalWidth) return { images: [], map: new Map() };
    const k = img.naturalWidth / f.w, S = ZOOM_M * k, c = document.createElement("canvas"); c.width = c.height = 512;
    const g = c.getContext("2d"), images = [], map = new Map();
    for (const p of P) {
      if (images.length >= MAX_ZOOM || !p.points[0]) continue;
      const w = { x: frame.x0 + p.points[0].x / 100 * frame.w, y: frame.y0 + p.points[0].y / 100 * frame.h };
      const sx = (w.x - f.x) * k - S / 2, sy = (w.y - f.y) * k - S / 2;
      g.fillStyle = "#fff"; g.fillRect(0, 0, 512, 512); g.drawImage(img, sx, sy, S, S, 0, 0, 512, 512);
      g.strokeStyle = "#e4472b"; g.lineWidth = 3; g.beginPath(); g.arc(256, 256, 22, 0, 7); g.stroke();
      const n = images.length + 1;
      images.push({ type: "image/jpeg", data: c.toDataURL("image/jpeg", 0.85).split(",")[1], label: `Zoom ${n} : ${ZOOM_M} m autour du point ${P.indexOf(p) + 1} (cercle rouge au centre)` });
      map.set(p.key, n);
    }
    return { images, map };
  }

  // relectures automatiques (avec clé)
  async function loop({ max = pref("relectures"), ids = null } = {}) {
    const provider = settings.activeProvider();
    if (!provider || running || !(max > 0)) return null;
    only = ids ? new Set(ids) : null;
    running = true; stopped = false;
    const log = { passes: 0, tokens: 0, fixed: 0, why: "", reports: [] };
    try {
      while (true) {
        const img = await aiReleve.fondImage(provider === "nvidia" ? { maxPx: 1280, maxB64: PROVIDERS.nvidia.maxImageB64 } : {});
        compute({ x0: img.map.x0, y0: img.map.y0, w: img.W * img.map.sx, h: img.H * img.map.sy });
        if (!points.length) { log.why = log.passes ? "plus rien à revoir" : "rien à revoir"; break; }
        const pass = log.passes + 1;
        show(`<p><b>Relecture ${pass}/${max}</b> · ${points.length} point${points.length > 1 ? "s" : ""} · l'IA regarde le plan (3 min au plus)…</p>${listHTML()}
          <p class="mut sm">${log.tokens ? `Coût jusqu'ici : ${log.tokens.toLocaleString("fr-FR")} jetons. ` : ""}Vous pouvez continuer à travailler.</p>
          <div class="wrow"><button class="danger" id="rk-stop">Arrêter</button></div>`);
        card.querySelector("#rk-stop").onclick = () => { stopped = true; };
        const Z = provider === "anthropic" ? await zooms(points) : { images: [], map: new Map() };
        let res, t1 = 0, t2 = 0;
        try {
          res = await Promise.race([
            chat({ system: SYSTEM, messages: [{ role: "user", text: recheckPrompt(points, { mode: "image", pass, zoom: Z.map }), image: { type: "image/jpeg", data: img.url.split(",")[1] }, images: Z.images }], maxTokens: 4000, provider }),
            new Promise((_, no) => { t1 = setTimeout(() => no(new Error("sans réponse en 3 min")), TIMEOUT); }),
            new Promise((_, no) => { t2 = setInterval(() => { if (stopped) no(new Error("arrêtée")); }, 200); }),
          ]);
        } catch (e) { log.why = e.message === "arrêtée" ? "arrêtée" : "relecture " + e.message; break; }
        finally { clearTimeout(t1); clearInterval(t2); }
        log.passes = pass;
        const tokens = res.usage ? res.usage.in + res.usage.out : 0;
        log.tokens += tokens;
        let c;
        try { c = parse(res.text); } catch { log.why = "réponse de l'IA illisible"; break; }
        points.forEach((P) => done.add(P.key));
        const changed = c.count + c.nope.length + c.nopeKeys.length;
        const { report } = apply(c, { via: "clé", model: res.model, ms: res.ms, tokens, zooms: Z.images.length });
        log.fixed += report.ok; log.reports.push(report);
        // on continue s'il reste des points jamais demandés et que la relecture a corrigé quelque chose
        const rest = pointsNow().length;
        const sc = shouldContinue({ pass, max, before: rest + report.ok, after: rest, changed: changed && report.ok });
        if (!sc.go || stopped) { log.why = stopped ? "arrêtée" : sc.why; break; }
      }
    } finally { running = false; only = null; }
    last = log;
    const tot = log.reports.reduce((s, r) => s + r.total, 0), ok = log.reports.reduce((s, r) => s + r.ok, 0);
    show(`<p><b>Relecture terminée</b> (${esc(log.why)}) : ${log.passes} relecture${log.passes > 1 ? "s" : ""}, ${ok}/${tot} points corrigés${tot ? ` (${Math.round(ok / tot * 100)} %)` : ""}${log.tokens ? ` · ${log.tokens.toLocaleString("fr-FR")} jetons` : ""}.</p>
      <p class="mut sm">Sous réserve du contrôle BE. Chaque relecture s'annule avec Ctrl+Z.</p>
      <div class="wrow"><button class="on" id="rk-close">OK</button><button id="rk-rep">Rapport complet</button></div>`);
    card.querySelector("#rk-close").onclick = close;
    card.querySelector("#rk-rep").onclick = () => { close(); api.setTab("etude"); setTimeout(() => document.getElementById("et-ia")?.scrollIntoView({ block: "start" }), 150); };
    return log;
  }

  // après un relevé IA (appareils gardés) : relectures automatiques avec clé, sinon proposition
  document.addEventListener("okteo:ai-releve", (e) => {
    const d = e.detail || {};
    if (!d.devices) return;
    setTimeout(async () => {
      const fr = await pageFrame().catch(() => null);
      if (!fr) return;
      frame = fr;
      const n = stillKeys().size;
      if (!n) return;
      if (d.mode === "key" && settings.activeProvider() && pref("relectures") > 0) loop();
      else api.setHint(`Relevé IA ajouté. Le logiciel signale ${n} point(s) à revoir : menu Relevé → « Relecture ciblée » pour les faire relire par l'IA. Ctrl+Z annule tout l'ajout.`);
    }, 50);
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !card.hidden && !running) close(); });
  return { open, close, fromText, apply, loop, stop: () => { stopped = true; }, get points() { return points; }, get copied() { return copied; }, get last() { return last; }, get corr() { return corr; }, get report() { return lastReport; }, done };
}

// rapport de l'analyse IA (onglet Étude) : relevé puis relectures, % de réussite, chaque point
export function reportHTML(api) {
  const all = (api.cab || {}).releves || {}, lvs = api.levels.filter((l) => all[l.id]);
  if (!lvs.length) return `<p class="mut sm">Pas encore de relevé par l'IA sur ce chantier. Menu Relevé → « ✦ Relevé par l'IA ».</p>`;
  return lvs.map((l) => {
    const R = all[l.id], rel = (R.rapport || []).filter((x) => x.type === "relecture");
    const tot = rel.reduce((s, x) => s + x.total, 0), ok = rel.reduce((s, x) => s + x.ok, 0);
    const first = (R.rapport || []).find((x) => x.type === "releve") || {};
    const cnt = first.counts || {};
    return `<div class="ia-rep">${api.levels.length > 1 ? `<h4>${esc(l.name)}</h4>` : ""}
      <p class="sm">Relevé du ${new Date(R.date).toLocaleString("fr-FR")}${first.info ? ` · ${esc(first.info)}` : ""}${cnt.appareils != null ? ` · ${cnt.murs || 0} murs, ${cnt.pieces || 0} pièces, ${cnt.appareils} appareils, ${cnt.liaisons || 0} liaisons` : ""}</p>
      ${rel.length ? `<p><b>Réussite des relectures : ${ok}/${tot} points corrigés (${tot ? Math.round(ok / tot * 100) : 0} %)</b> <span class="mut sm">sous réserve du contrôle BE</span></p>` : `<p class="mut sm">Aucune relecture pour l'instant.</p>`}
      ${rel.map((x, i) => `<details class="ia-pass"${i === rel.length - 1 ? " open" : ""}><summary>Relecture ${i + 1} · ${new Date(x.date).toLocaleString("fr-FR")} · ${x.via === "clé" ? `automatique${x.model ? " (" + esc(x.model) + ")" : ""}${x.tokens ? ` · ${x.tokens.toLocaleString("fr-FR")} jetons` : ""}${x.zooms ? ` · ${x.zooms} zooms` : ""}` : "copier / coller"} · <b>${x.ok}/${x.total} (${x.pct} %)</b></summary>
        <table class="gt ia-rows"><tbody>${(x.rows || []).map((r) => `<tr class="rk-${r.state === "corrigé" ? "ok" : r.state === "introuvable" ? "no" : "wait"}"><td><b>${esc(r.state)}</b></td><td>${esc(r.label)}</td><td class="mut">${esc(r.detail || "")}</td></tr>`).join("")}</tbody></table>
        ${(x.errors || []).length ? `<p class="warn sm">Réponse partiellement ignorée : ${esc(x.errors.join(" ; "))}</p>` : ""}</details>`).join("")}</div>`;
  }).join("");
}
// le même rapport en texte (copie, assistant)
export function reportText(api) {
  const all = (api.cab || {}).releves || {};
  return api.levels.filter((l) => all[l.id]).map((l) => {
    const rel = (all[l.id].rapport || []).filter((x) => x.type === "relecture");
    return `${l.name} : ` + (rel.length ? rel.map((x, i) => `relecture ${i + 1} : ${x.ok}/${x.total} corrigés (${x.pct} %)\n` + (x.rows || []).map((r) => `  - ${r.state} · ${r.label}${r.detail ? " — " + r.detail : ""}`).join("\n")).join("\n") : "aucune relecture");
  }).join("\n") + "\n(sous réserve du contrôle BE)";
}
