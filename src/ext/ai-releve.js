// « Relevé par l'IA » (menu Relevé) : l'image du fond de plan est envoyée à l'IA (Claude, ou NVIDIA en version locale),
// qui renvoie murs, ouvertures, pièces, appareils et liaisons en pixels de l'image. Ils sont convertis en mètres,
// remis au propre (src/walls/ai-plan.js) et montrés en aperçu orange PAR-DESSUS le dessin actuel, pour comparer
// avec le relevé sans IA. On coche ce qu'on garde (murs / pièces / appareils) : un seul Ctrl+Z annule l'ajout.
import { chat, PROVIDERS } from "./ai.js";
import { settings } from "./settings.js";
import { aiPrompt, pastePrompt, parseAiJson, aiToPlan } from "../walls/ai-plan.js";
import { findRooms, nameRooms, labelPoint, pointInPoly } from "../walls/rooms.js";
import { autoScale } from "./pdf-page.js";
import { esc } from "./util.js";
import { recordReleve } from "./ai-recheck-ui.js";

const SYSTEM = "Tu es dessinateur au bureau d'études électricité d'un fabricant de pieuvres électriques pour maisons individuelles. Tu relèves des plans avec précision et tu réponds uniquement en JSON.";

// image du fond, rognée aux bords du dessin (marges blanches retirées) et réduite à maxPx de grand côté
async function fondImage(api, { maxPx = 1568, maxB64 = 0 } = {}) {
  const f = await api.levelFond(api.level.id);
  if (!f) throw new Error("pas de fond de plan sur ce niveau");
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error("image du fond illisible")); img.src = f.url; });
  const iw = img.naturalWidth, ih = img.naturalHeight;
  // bords du dessin sur une petite copie
  const sw = Math.min(800, iw), sh = Math.round(ih * sw / iw), sc = document.createElement("canvas");
  sc.width = sw; sc.height = sh;
  const g0 = sc.getContext("2d"); g0.drawImage(img, 0, 0, sw, sh);
  const px = g0.getImageData(0, 0, sw, sh).data;
  let x0 = sw, y0 = sh, x1 = 0, y1 = 0;
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    const i = (y * sw + x) * 4;
    if (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2] < 215) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 <= x0 || y1 <= y0) { x0 = 0; y0 = 0; x1 = sw - 1; y1 = sh - 1; }
  const k = iw / sw, m = 0.02 * Math.max(sw, sh);
  const cx0 = Math.max(0, (x0 - m) * k), cy0 = Math.max(0, (y0 - m) * k);
  const cw = Math.min(iw, (x1 + m) * k) - cx0, ch = Math.min(ih, (y1 + m) * k) - cy0;
  let W = Math.round(Math.min(cw, maxPx * Math.min(1, cw / ch)));
  let H = Math.round(W * ch / cw);
  const out = document.createElement("canvas");
  let url = "";
  for (let tries = 0; tries < 6; tries++) {
    out.width = W; out.height = H;
    const g = out.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, W, H); g.drawImage(img, cx0, cy0, cw, ch, 0, 0, W, H);
    url = out.toDataURL("image/jpeg", 0.85);
    if (!maxB64 || url.length <= maxB64) break;
    W = Math.round(W * 0.8); H = Math.round(H * 0.8);
  }
  const mx = f.w / iw, my = f.h / ih;           // mètres par pixel du fond
  const map = { x0: f.x + cx0 * mx, y0: f.y + cy0 * my, sx: (cw / W) * mx, sy: (ch / H) * my };
  return { url, W, H, map };
}

export function createAiReleve({ api, openParams }) {
  const card = document.createElement("div");
  card.className = "wcard aicard"; card.hidden = true; card.setAttribute("role", "dialog"); card.setAttribute("aria-label", "Relevé par l'IA");
  document.querySelector(".stage").appendChild(card);
  let lastMode = "", lastUsage = null;   // v57 : "key" (relevé envoyé à l'IA) ou "paste" (réponse collée) : décide de la relecture automatique
  let busy = false, plan = null, rooms = [], meta = "", keep = { walls: true, rooms: true, devices: true }, lastImage = null, lastText = "";

  const close = () => { card.hidden = true; api.setPreview(null); plan = null; };
  const show = (html) => { card.innerHTML = `<div class="wcard-h"><b>✦ Relevé par l'IA</b><button class="wx" title="Fermer">✕</button></div>${html}`; card.hidden = false; card.querySelector(".wx").onclick = close; };
  const message = (text, buttons = [{ label: "OK", run: () => {} }]) => {
    show(`<p>${text}</p><div class="wrow">${buttons.map((b, i) => `<button data-i="${i}" class="${i === 0 ? "on" : ""}">${esc(b.label)}</button>`).join("")}</div>`);
    card.querySelectorAll("[data-i]").forEach((el) => (el.onclick = () => { const b = buttons[+el.dataset.i]; close(); b.run(); }));
  };

  // pièces : sur les murs proposés par l'IA (si on les garde), sinon sur les murs déjà dessinés ; noms donnés par l'IA
  function roomsFor(useAiWalls) {
    const S = api.state;
    let nodes, segs;
    if (useAiWalls) { nodes = plan.nodes.map((n, i) => ({ id: "an" + i, ...n })); segs = plan.walls.map((w, i) => ({ id: "as" + i, a: "an" + w.a, b: "an" + w.b, ep: w.ep })); }
    else { nodes = S.nodes; segs = S.segs; }
    return nameRooms(findRooms(nodes, segs, { defEp: S.wallEp }), plan.pieces);
  }
  function preview() {
    rooms = keep.rooms ? roomsFor(keep.walls) : [];
    api.setPreview({
      ...(keep.walls ? { nodes: plan.nodes, walls: plan.walls, openings: plan.openings } : {}),
      rooms,
      ...(keep.devices ? { devices: plan.devices, links: plan.links } : { devices: [] }),
    });
  }

  function render() {
    const S = api.state, nP = plan.openings.filter((o) => o.kind === "porte").length, nG = plan.openings.filter((o) => o.kind === "garage").length;
    const row = (k, label, n, extra, has) => `<label class="ai-row"><input type="checkbox" data-k="${k}" ${keep[k] ? "checked" : ""} ${n ? "" : "disabled"}><span><b>${label} : ${n}</b>${extra ? `<br><span class="sm">${extra}</span>` : ""}${has ? `<br><span class="mut sm">remplace les ${has} déjà dessinés</span>` : ""}</span></label>`;
    show(`
      <p class="mut sm">${esc(meta)}</p>
      <p class="sm">En orange : ce que propose l'IA, posé sur votre dessin actuel pour comparer. Cochez ce que vous gardez.</p>
      ${row("walls", "Murs", plan.walls.length, `${plan.openings.length} ouvertures (${nP} portes${plan.stats.portesOrientees ? `, dont ${plan.stats.portesOrientees} avec leur sens` : ""}, ${plan.openings.length - nP - nG} fenêtres${nG ? `, ${nG} porte(s) de garage` : ""})`, S.segs.filter((s) => !s.virt).length)}
      ${row("rooms", "Pièces", keep.rooms ? rooms.length : roomsFor(keep.walls).length, keep.rooms && rooms.length ? esc(rooms.map((r) => r.name).join(", ")) : plan.pieces.length && !rooms.length && keep.rooms ? "les murs ne ferment aucune pièce" : "", S.rooms.length)}
      ${row("devices", "Appareils", plan.devices.length, `${plan.links.length} liaisons`, S.app.length)}
      ${plan.remarques ? `<p class="mut sm">Remarque de l'IA : ${esc(plan.remarques)}</p>` : ""}
      ${plan.stats.ouverturesPerdues ? `<p class="warn sm">⚠ ${plan.stats.ouverturesPerdues} ouverture(s) loin de tout mur, ignorée(s).</p>` : ""}
      ${plan.stats.ouverturesAjustees ? `<p class="mut sm">${plan.stats.ouverturesAjustees} ouverture(s) recentrée(s) ou rétrécie(s) pour tenir sur leur morceau de mur : vérifiez-les sur le plan.</p>` : ""}
      <div class="wrow"><button class="on" id="ai-ok">Ajouter la sélection</button><button id="ai-again" title="Redemander à l'IA (la réponse peut changer)">Refaire</button><button id="ai-no">Annuler</button></div>
      <details class="sm"><summary>Réponse brute de l'IA</summary><pre class="ai-raw">${esc(lastText.slice(0, 4000))}</pre></details>`);
    card.querySelectorAll("[data-k]").forEach((el) => (el.onchange = () => { keep[el.dataset.k] = el.checked; preview(); render(); }));
    card.querySelector("#ai-no").onclick = close;
    card.querySelector("#ai-again").onclick = () => { close(); open(); };
    card.querySelector("#ai-ok").onclick = add;
  }

  function add() {
    if (!keep.walls && !keep.rooms && !keep.devices) return close();
    const S = api.state, done = [];
    let devAdded = false;
    api.batch(() => {
      if (keep.walls && plan.walls.length) { const r = api.importWalls(plan, { replace: S.segs.length > 0 }); done.push(`${r.murs} murs`); }
      if (keep.rooms) {
        const list = roomsFor(false).map((r) => ({ ...r, also: r.labels.filter((n) => n !== r.name) }));
        if (list.length) done.push(`${api.addRooms(list, { replace: true })} pièces`);
      }
      if (keep.devices && plan.devices.length) { const r = api.importDevices(plan.devices, plan.links, { replace: true }); devAdded = true; done.push(`${r.appareils} appareils, ${r.liaisons} liaisons`); }
      // v61 : ce que la relecture ciblée et son rapport doivent savoir (pièces nommées, ouvertures perdues, remarques)
      recordReleve(api, keep.walls ? plan : { ...plan, lost: [] }, { mode: lastMode, info: meta, usage: lastUsage, counts: { murs: keep.walls ? plan.walls.length : 0, ouvertures: keep.walls ? plan.openings.length : 0, pieces: plan.pieces.length, appareils: keep.devices ? plan.devices.length : 0, liaisons: keep.devices ? plan.links.length : 0 } });
    });
    card.hidden = true; plan = null;
    api.setHint(`Relevé IA ajouté : ${done.join(", ") || "rien"}. Ctrl+Z annule tout l'ajout.`);
    document.dispatchEvent(new CustomEvent("okteo:ai-releve", { detail: { done, devices: !!devAdded, mode: lastMode } }));
  }

  // réponse de l'IA (texte) → aperçu ; sert aussi aux tests (réponse préparée à l'avance)
  function fromText(text, map, info = "") {
    lastText = String(text || "");
    let raw;
    try { raw = parseAiJson(lastText); } catch (e) { message("La réponse de l'IA n'est pas exploitable : " + esc(e.message) + " Cliquez « Refaire » pour redemander.", [{ label: "Refaire", run: open }, { label: "Fermer", run: () => {} }]); return null; }
    plan = aiToPlan(raw, map, { defEp: api.state.wallEp });
    meta = info;
    keep = { walls: plan.walls.length > 0, rooms: plan.pieces.length > 0 || plan.walls.length > 0, devices: plan.devices.length > 0 };
    preview(); render();
    return plan;
  }

  // Mode sans clé : la réponse (JSON) est donnée à la main (collée, ou lue dans un fichier .json). Coordonnées en pixels
  // d'une image de TOUTE la page du PDF ("ref": {"W":…,"H":…}) : indépendant du rognage fait pour l'envoi à l'IA.
  async function fromPaste(text) {
    let raw;
    try { raw = parseAiJson(text); } catch (e) { return message("Ce texte n'est pas un relevé exploitable : " + esc(e.message), [{ label: "Réessayer", run: pastePanel }, { label: "Fermer", run: () => {} }]); }
    const f = await api.levelFond(api.level.id).catch(() => null);
    if (!f) return message("Ce chantier n'a pas encore de plan. Ajoutez le PDF ou l'image du plan dans l'onglet Chantiers.", [{ label: "Ouvrir Chantiers", run: () => api.setTab("chantiers") }, { label: "Fermer", run: () => {} }]);
    if (!api.ch.fond.calibre) {
      const sc = await autoScale(api).catch(() => ({ ok: false }));
      if (!sc.ok) return message("Réglez d'abord l'échelle du plan (outil Échelle : « 1/50 » si le plan est au 1/50 sur sa feuille d'origine), puis recollez la réponse.", [{ label: "Régler l'échelle", run: () => api.startCalib() }, { label: "Fermer", run: () => {} }]);
    }
    const f2 = await api.levelFond(api.level.id), ref = raw.ref && raw.ref.W > 0 && raw.ref.H > 0 ? raw.ref : null;
    if (!ref) return message("Cette réponse n'indique pas la taille de l'image de référence (champ « ref »). Elle ne peut pas être placée sur le plan.", [{ label: "Fermer", run: () => {} }]);
    const map = { x0: f2.x, y0: f2.y, sx: f2.w / ref.W, sy: f2.h / ref.H };
    lastMode = "paste"; lastUsage = null;
    return fromText(text, map, `Réponse donnée à la main · image de référence ${ref.W} × ${ref.H} px`);
  }
  function pastePanel() {
    if (api.tab !== "plan") api.setTab("plan");
    show(`<p class="sm"><b>1.</b> Copiez la consigne, collez-la dans une conversation neuve (Claude, ChatGPT…) avec le PDF du plan joint.
      <button id="ai-copy" title="Copie la consigne du relevé (murs, ouvertures, pièces, 40 types d'appareils, hauteurs, liaisons) dans le presse-papiers">📋 Copier la consigne</button></p>
      <p class="sm"><b>2.</b> Collez ici sa réponse (texte JSON) ou choisissez le fichier <b>.json</b> qu'on vous a remis.</p>
      <textarea id="ai-paste" rows="6" style="width:100%" placeholder='{"ref":{"W":1819,"H":1286},"murs":[…]}'></textarea>
      <div class="wrow"><input type="file" id="ai-file" accept=".json,.txt,application/json,text/plain"><button class="on" id="ai-read">Lire la réponse</button><button id="ai-x">Annuler</button></div>`);
    const ta = card.querySelector("#ai-paste");
    card.querySelector("#ai-file").onchange = async (e) => { const f = e.target.files && e.target.files[0]; if (f) ta.value = await f.text(); };
    card.querySelector("#ai-read").onclick = () => { const t = ta.value.trim(); if (t) fromPaste(t); };
    card.querySelector("#ai-x").onclick = close;
    card.querySelector("#ai-copy").onclick = async (e) => {
      const b = e.currentTarget, txt = pastePrompt({ page: (api.ch.fond && api.ch.fond.page) || 1 });
      copied = txt;
      let ok = false;
      // presse-papiers refusé ou sans réponse (1,5 s) : la consigne est mise dans la zone de texte, sélectionnée
      try { await Promise.race([navigator.clipboard.writeText(txt), new Promise((_, no) => setTimeout(() => no(new Error("délai")), 1500))]); ok = true; } catch { /* repli ci-dessous */ }
      if (!ok) { ta.value = txt; ta.select(); }
      b.textContent = ok ? "✓ Consigne copiée" : "Consigne dans la zone ci-dessous : Ctrl+C";
    };
  }

  async function open() {
    if (busy) return;
    if (api.tab !== "plan") api.setTab("plan");
    if (!api.ch.fond) return message("Ce chantier n'a pas encore de plan. Ajoutez le PDF ou l'image du plan dans l'onglet Chantiers.", [{ label: "Ouvrir Chantiers", run: () => api.setTab("chantiers") }, { label: "Fermer", run: () => {} }]);
    const provider = settings.activeProvider();
    if (!provider) return message("Il faut une clé IA pour ce relevé. En version en ligne : une clé Claude (Anthropic). En version locale : Claude ou NVIDIA. Sans clé, vous pouvez coller une réponse déjà préparée.", [{ label: "Coller une réponse", run: pastePanel }, { label: "Ouvrir Paramètres", run: openParams }, { label: "Fermer", run: () => {} }]);
    busy = true;
    try {
      if (!api.ch.fond.calibre) {
        show(`<p>Réglage de l'échelle d'après les cotes du plan…</p>`);
        const sc = await autoScale(api).catch(() => ({ ok: false }));
        if (!sc.ok) { busy = false; return message("Réglez d'abord l'échelle du plan (les deux bouts d'une cote connue, puis sa longueur) : l'IA a besoin des vraies dimensions.", [{ label: "Régler l'échelle", run: () => api.startCalib() }, { label: "Fermer", run: () => {} }]); }
      }
      show(`<p>Préparation de l'image du plan…</p>`);
      const img = await fondImage(api, provider === "nvidia" ? { maxPx: 1280, maxB64: PROVIDERS.nvidia.maxImageB64 } : {});
      lastImage = img;
      const model = settings.get().models[provider] || PROVIDERS[provider].defaultModel;
      show(`<p>L'IA lit le plan (${esc(PROVIDERS[provider].name)} · ${esc(model)})… compter 30 s à 2 min.</p><p class="mut sm">Vous pouvez continuer à travailler : l'aperçu s'affichera ici.</p>`);
      const r = await chat({ system: SYSTEM, messages: [{ role: "user", text: aiPrompt({ W: img.W, H: img.H, cmPerPx: img.map.sx * 100 }), image: { type: "image/jpeg", data: img.url.split(",")[1] } }], maxTokens: 12000, provider, think: true });
      if (!r.sawImage) { busy = false; return message(`Le modèle ${esc(r.model)} ne lit pas les images : choisissez un modèle « vision » dans Paramètres.`, [{ label: "Ouvrir Paramètres", run: openParams }, { label: "Fermer", run: () => {} }]); }
      lastMode = "key"; lastUsage = r.usage || null;
      fromText(r.text, img.map, `${PROVIDERS[r.provider].name} · ${r.model} · ${(r.ms / 1000).toFixed(0)} s · image ${img.W} × ${img.H} px`);
    } catch (e) {
      message("Le relevé par l'IA a échoué : " + esc(e.message), [{ label: "Fermer", run: () => {} }, { label: "Ouvrir Paramètres", run: openParams }]);
    } finally { busy = false; }
  }

  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !card.hidden) close(); });
  let copied = "";
  return { open, close, fromText, fromPaste, pastePanel, pastePrompt, get copied() { return copied; }, fondImage: (o) => fondImage(api, o), get plan() { return plan; }, get lastImage() { return lastImage; } };
}
