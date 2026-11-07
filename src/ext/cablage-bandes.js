// Onglet « Bandes » (v33) : le schéma de chaque boîte pour le câbleur — la boîte carrée avec ses faces A–D et ses
// gaines (n°, longueur, Ø, appareil, fils avec couleur et n° de raccordement), les connecteurs, les retours lampe et
// navettes tracés, l'orientation de la boîte (pièce de chaque côté), le matériel, les raccordements à faire dans
// l'ordre (à cocher) et le contrôle final. Impression : une feuille par boîte.
import { getJournal, ruleById } from "../cablage/regles.js";
import { wiringNow, wireCss, wireSolid, facesSides, fr } from "./cablage-data.js";
import { getCab } from "../cablage/settings.js";
import { boxSteps, boxMaterial, boxChecks, boxWires, parseSizes, schemaSVG, tranchesSVG, FN_SHORT, wireName, orderLines, BOX_MODELS } from "../cablage/schema.js";
import { code128, barsSVG, boxCode, qrMatrix, qrSVG } from "./barcode.js";
import { sheetUrl } from "../cablage/bande-code.js";
import { buildLabelsPdf } from "./labels-pdf.js";
import { buildDossier, downloadBlob } from "./dossier.js";
import { pointInPoly } from "../walls/rooms.js";
import { buildBandsPdf } from "./bandes-pdf.js";
import { esc } from "./util.js";
import { spvLines, spvText, spvName, totaux } from "../cablage/spv.js";
import { coupeFils } from "../cablage/gaines.js";
import { abrevRoom, parseAbrev } from "../print/abrev.js";
import { getPrefs } from "../prefs.js";
import { numberFocus, connecteurCard } from "../cablage/connecteur.js";

// lot 4 : fichier .spv du chantier ouvert (tous niveaux) + totaux du planning du BE
export function spvNow(api) {
  const W = wiringNow(api), items = api.allApps(), ch = api.ch || {}, S = getCab();
  const R = parseAbrev(getPrefs().abrev || undefined);
  const lines = spvLines(W, items, ch, { surl: +(coupeFils(0, S)).toFixed(2), abrev: (n) => abrevRoom(n, R) });
  const T = totaux(W, lines);
  let surface = 0;
  try { surface = (api.allLevelsGeometry() || []).reduce((s, g) => s + (g.rooms || []).reduce((t, r) => t + (+r.area || 0), 0), 0); } catch { surface = 0; }
  const manque = [!(ch.affaire || "").trim() && "n° d'affaire absent de la fiche du chantier", !(ch.client || "").trim() && "pavillonneur absent"].filter(Boolean).join(", ");
  return { lines, text: spvText(lines), name: spvName(ch), totaux: T, manque, planning: { surface: Math.round(surface), gaines: lines.length, boites: T.boites, plomberie: false } };
}

// règles utilisées par une boîte qui ne sont pas encore confirmées par Kévin : [{id, titre}]
export function aVerifier(ids) {
  const J = getJournal();
  return (ids || []).map((id) => ruleById(J, id)).filter((r) => r && r.statut !== "archivee" && r.certitude !== "confirmee").map((r) => ({ id: r.id, titre: r.titre })).sort((a, b) => a.id.localeCompare(b.id));
}
export function boxSheets(api) {
  const W = wiringNow(api), sizes = parseSizes(getCab().bornes), geos = new Map(), lvName = new Map(api.levels.map((l) => [l.id, l.name]));
  const tabs = api.allApps().filter((a) => a.t === "TAB");
  return W.boxes.map((box) => {
    if (!geos.has(box.lv)) geos.set(box.lv, api.exportGeometry(box.lv));
    const steps = boxSteps(box, sizes);
    // direction du tableau depuis la boîte (même niveau de préférence), en radians dans le repère du plan (y vers le bas)
    const tab = tabs.find((t) => t.lv === box.lv) || tabs[0];
    const tabAng = tab && Math.hypot(tab.x - box.x, tab.y - box.y) > 0.05 ? Math.atan2(tab.y - box.y, tab.x - box.x) : null;
    return { box, steps, material: boxMaterial(steps), fils: boxWires(box), checks: boxChecks(box, steps), sides: facesSides(box, geos.get(box.lv), pointInPoly), level: lvName.get(box.lv) || box.lv,
      order: orderLines(steps), tabAng, code: boxCode(api.ch, box), model: (BOX_MODELS.find((m) => m.id === box.model) || BOX_MODELS[0]).name, cover: box.cover === "bas" ? "bas" : "haut",
      ch: { nom: api.ch.nom, numero: api.ch.numero || "", client: api.ch.client || "" },
      // v52 : longueur totale des gaines de la boîte, bouchons (R-095), règles non confirmées utilisées (« à vérifier »)
      longueur: box.longueur, bouchons: box.bouchons || 0, verifier: aVerifier(box.rules) };
  });
}
// flèche vers le tableau (SVG, pour l'écran)
export function arrowSVG(ang, size = 70) {
  if (ang == null) return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><text x="${size / 2}" y="${size / 2 + 5}" text-anchor="middle" font-size="12">?</text></svg>`;
  const deg = ang * 180 / Math.PI, c = size / 2;
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="tab-arrow"><g transform="rotate(${deg.toFixed(1)} ${c} ${c})"><path d="M${c - 26} ${c - 7}H${c + 6}V${c - 17}L${c + 28} ${c}L${c + 6} ${c + 17}V${c + 7}H${c - 26}Z" fill="#1f2a36"/></g></svg>`;
}

export function mountBandsPage(el, { api }) {
  let cur = null, busy = false, focusC = null, focusN = null;   // focusC : circuit mis en avant ; focusN (07/11) : n° de raccordement
  const done = new Map();          // cases cochées à l'écran (par boîte), le temps de la session
  const chip = (w) => `<span class="wchip"><i style="background:${wireCss(w.color)}"></i>${esc(w.color)} ${fr(w.section, 1)}</span>`;

  // étiquettes à coller (v50) et dossier PDF du chantier
  async function labels(sheets) {
    if (busy) return; busy = true;
    const st = el.querySelector("#bd-st"); if (st) st.textContent = "Préparation des étiquettes…";
    try {
      const r = await buildLabelsPdf(sheets); el.__labels = r;
      downloadBlob(r.blob, `${api.ch.nom}${api.ch.numero ? "_" + api.ch.numero : ""}_etiquettes_${sheets.length === 1 ? sheets[0].box.n : "boites"}.pdf`);
      if (st) st.textContent = `Étiquettes prêtes : ${r.labels} étiquette${r.labels > 1 ? "s" : ""} sur ${r.pages} feuille${r.pages > 1 ? "s" : ""} A4 (à couper en 4).`;
    } catch (e) { if (st) st.textContent = "Étiquettes impossibles : " + e.message; }
    finally { busy = false; }
  }
  async function dossier() {
    if (busy) return; busy = true;
    const st = el.querySelector("#bd-st"); if (st) st.textContent = "Préparation du dossier…";
    try {
      const r = await buildDossier(api); el.__dossier = r;
      downloadBlob(r.blob, `${api.ch.nom}${api.ch.numero ? "_" + api.ch.numero : ""}_dossier.pdf`);
      if (st) st.textContent = `Dossier prêt : ${r.pages} pages (${r.parts.map((p) => p.title.split(" (")[0]).join(", ")}).`;
    } catch (e) { if (st) st.textContent = "Dossier impossible : " + e.message; }
    finally { busy = false; }
  }
  async function print(sheets) {
    if (busy) return; busy = true;
    const st = el.querySelector("#bd-st"); if (st) st.textContent = "Préparation du PDF…";
    try {
      const r = await buildBandsPdf(sheets, { chantier: api.ch.nom, numero: api.ch.numero });
      el.__last = r;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(r.blob);
      a.download = `${api.ch.nom}${api.ch.numero ? "_" + api.ch.numero : ""}_schemas_${sheets.length === 1 ? sheets[0].box.n : "boites"}.pdf`.replace(/[\\/:*?"<>|]+/g, "_");
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 30000);
      if (st) st.textContent = `PDF prêt : ${r.pages} pages.`;
    } catch (e) { if (st) st.textContent = "Impression impossible : " + e.message; }
    finally { busy = false; }
  }

  function render() {
    const sheets = boxSheets(api);
    if (!sheets.length) {
      el.innerHTML = `<div class="params-in"><h2>Bandes — schémas de boîte</h2><p class="mut">Pas encore de boîtes. Onglet Câblage (panneau de droite) : « Répartir automatiquement » les circuits, puis « Placer les boîtes ».</p>
        <button class="on" id="bd-go">Ouvrir l'onglet Câblage</button></div>`;
      el.querySelector("#bd-go").onclick = () => { api.setTab("plan"); document.dispatchEvent(new CustomEvent("okteo:open-cablage")); };
      return;
    }
    if (!sheets.some((s) => s.box.id === cur)) cur = sheets[0].box.id;
    const S = sheets.find((s) => s.box.id === cur), { box, steps, material, checks, sides, fils } = S;
    const ok = done.get(box.id) || new Set();
    const svg = schemaSVG(box, steps, { color: wireSolid, sides });
    el.innerHTML = `<div class="params-in cabpage bands">
      <h2>Bandes — schémas de boîte</h2>
      <div class="bd-pick">${sheets.map((s) => `<button data-b="${s.box.id}" class="${s.box.id === cur ? "on" : ""}" title="${s.box.gaines.length} gaines · ${s.steps.length} raccordements">${esc(s.box.n)}</button>`).join("")}
        <span class="grow"></span><button id="bd-lab-one" class="on" title="Étiquette à coller sur la boîte (148,5 × 105 mm, un quart de A4) : schéma en grand, en-tête, logo, QR code et code barre">🏷 Étiquette ${esc(box.n)}</button><button id="bd-lab-all" title="Les étiquettes de toutes les boîtes, 4 par feuille A4 (traits de coupe)">🏷 Toutes les étiquettes (4 par A4)</button>
        <button id="bd-one" title="Bande détaillée de cette boîte (PDF) : schéma, ordre de câblage, matériel, raccordements">📄 Bande détaillée ${esc(box.n)}</button><button id="bd-all" title="Bandes détaillées de toutes les boîtes (PDF)">📄 Toutes les bandes détaillées</button><button id="bd-dossier" title="Dossier PDF du chantier : page de garde, plan, tableau, documents à remettre, bandes détaillées de toutes les boîtes">📁 Dossier du chantier</button><button id="bd-docs" title="Documents à remettre (NF C 15-100) : schéma unifilaire, étiquettes de repérage, liens RJ45, fiche d'autocontrôle pré-remplie (PDF)">📄 Documents à remettre</button><button id="bd-spv" title="Fichier .spv pour Counter (fabrication des gaines) : une ligne par gaine, au format du BE, tout « à faire ». L'atelier le découpe lui-même. N° d'affaire et pavillonneur : fiche du chantier (accueil).">⚙ Fichier .spv (Counter)</button><button id="bd-planning" title="Totaux pour le planning du BE (surface, nombre de gaines, nombre de boîtes, plomberie) : copiés pour les coller dans InfoChantier">📋 Totaux du planning</button><span id="bd-st" class="mut sm"></span></div>
      <p class="mut sm">${esc(S.level)}${sides.under ? ` · au-dessus de : ${esc(sides.under)}` : ""} · ${box.gaines.length} gaines · <b title="Somme des longueurs de toutes les gaines de la boîte">${fr(S.longueur, 2)} m de gaines</b> · ${steps.length} raccordements · ${fr(box.cuivre)} m de fil${S.bouchons ? ` · <b class="warn" title="R-095 : bouchon obligatoire dans la boîte sur les gaines qui amènent l'air extérieur">${S.bouchons} bouchon${S.bouchons > 1 ? "s" : ""}</b>` : ""}</p>
      ${S.verifier.length ? `<p class="sm bd-verif" title="Le logiciel applique ces règles du journal, mais Kévin ne les a pas encore confirmées : le résultat est à vérifier">À vérifier — règles non confirmées : ${S.verifier.map((r) => `<b>${esc(r.id)}</b> ${esc(r.titre)}`).join(" · ")}</p>` : ""}
      <div class="bd-grid">
        <div class="bd-svgw"><div class="bd-calq" title="Boutons : un circuit en avant, les autres s'estompent. Dans le schéma : cliquez un numéro (ou un de ses fils) pour ne garder que lui et voir son connecteur">Circuits : <button data-cq="" class="${focusC ? "" : "on"}">Tous</button>${box.circuits.map((c) => `<button data-cq="${esc(c)}" class="${focusC === c ? "on" : ""}">${esc(c)}</button>`).join("")}</div>
        <div class="bd-svg" title="Cliquez un numéro : seuls ses fils restent visibles, et le connecteur à prendre s'affiche en haut à droite. Recliquez (ou cliquez à côté) pour tout revoir">${svg}</div>
        <div class="bd-conn" hidden aria-live="polite"></div></div>
        <div class="bd-side">
          <div class="bd-label" title="Étiquette collée sur la boîte (en-tête de la feuille imprimée)">
            <div class="bl-l"><div><span class="mut">Pavillonneur</span><b>${esc(S.ch.client || "—")}</b></div><div><span class="mut">Chantier</span><b>${esc(S.ch.nom)}</b></div></div>
            <div class="bl-c" title="Direction du tableau depuis la boîte (haut de la feuille = haut du plan)">${arrowSVG(S.tabAng, 58)}<b>TABLEAU</b></div>
            <div class="bl-r"><div><span class="mut">N° d'affaire</span><b>${esc(S.ch.numero || "—")}</b></div><div><span class="mut">Nom BE</span><b>…………</b></div><div><span class="mut">Câbleur (initiales)</span><span class="sig"></span></div></div>
          </div>
          <div class="bl-bot"><label class="sm">Modèle de boîte <select disabled title="Seul modèle connu pour l'instant">${BOX_MODELS.map((m) => `<option>${esc(m.name)}</option>`).join("")}</select></label>
            <label class="sm" title="Simple indication pour la pose : ne change ni le plan ni la pieuvre">Couvercle <select id="bd-cover"><option value="haut" ${S.cover === "haut" ? "selected" : ""}>vers le haut</option><option value="bas" ${S.cover === "bas" ? "selected" : ""}>vers le bas</option></select></label>
            <div class="bl-code" id="bd-code" title="Code barre unique de la boîte : ${esc(S.code)}"></div>
            <img class="bl-logo" src="assets/kiteohm-logo.png" alt="KiTéOHM">
            <div class="bl-qr" id="bd-qr" title="QR code : scannez-le avec l'appareil photo du téléphone pour ouvrir cette bande (les données sont dans le QR, rien n'est envoyé sur Internet)"></div></div>
          <p class="sm mut" id="bd-qrinfo"></p>
          <h3>Ordre de câblage</h3>
          <table class="bd-order"><tbody>${S.order.map((o) => `<tr><td class="c"><b>${o.n}</b></td><td><span class="wchip"><i style="background:${wireCss(o.color)}"></i>${esc(o.color)} ${o.section ? fr(o.section, 1) : ""}</span></td><td class="r">${o.count} fil${o.count > 1 ? "s" : ""}</td><td class="mut sm">${esc(FN_SHORT[o.fn] || o.fn)}</td></tr>`).join("")}</tbody></table>
          <h3>1. Orienter la boîte</h3>
          <ul class="bd-or">${["A", "B", "C", "D"].map((f, i) => `<li><b>Face ${f}</b> <span class="mut">(${["haut", "droite", "bas", "gauche"][i]} du plan)</span> : ${esc(sides[f] || "—")}</li>`).join("")}</ul>
          <h3>2. Préparer le matériel</h3>
          <ul>${material.sizes.map(([k, n]) => `<li>${n} connecteur${n > 1 ? "s" : ""} <b>${k} entrées</b></li>`).join("")}${material.ponts ? `<li>${material.ponts} pont${material.ponts > 1 ? "s" : ""} (bout de fil de la même couleur, pour relier deux connecteurs)</li>` : ""}${S.bouchons ? `<li><b>${S.bouchons} bouchon${S.bouchons > 1 ? "s" : ""}</b> (gaine${S.bouchons > 1 ? "s" : ""} à câble extérieur : ${box.gaines.filter((g) => g.bouchon).map((g) => esc(g.no)).join(", ")})</li>` : ""}</ul>
          <p class="sm bd-fils" title="Nombre de fils de chaque section et couleur dans les gaines de la boîte">Fils : ${fils.wires.map((w) => `${w.n} × ${fr(w.section, 1)} ${chip({ color: w.color, section: w.section }).replace(/ [\d,]+<\/span>$/, "</span>")}`).join(" · ")}${fils.cables.length ? ` · câbles : ${fils.cables.map((c) => `${c.n} × ${esc(c.cable)}`).join(", ")}` : ""}</p>
          ${box.gaines.some((g) => g.ponts) ? `<p class="sm bd-ponts" title="Pontage (choix du chantier) : gaines d'un appareil au suivant, avec les mêmes fils que la gaine de la boîte">Pontages : ${box.gaines.filter((g) => g.ponts).flatMap((g) => g.ponts.map((p) => `<b>${esc(g.no)}</b> ${esc(p.de)} → ${esc(p.vers)} ${fr(p.length, 2)} m`)).join(" · ")}</p>` : ""}
          ${(() => { const B = [...new Set(box.gaines.filter((g) => g.kind === "alim").flatMap((g) => g.wires.map((w) => w.bague)).filter(Boolean))]; const R = [...new Set(box.gaines.filter((g) => g.kind !== "alim").flatMap((g) => g.wires.map((w) => w.bague)).filter(Boolean))]; return (B.length ? `<p class="sm" title="Bagues numérotées à poser sur les fils de l'alimentation (n° du circuit au tableau, T1… = télérupteur)">Bagues sur l'alimentation : ${B.map((b) => `<span class="bague">${esc(b)}</span>`).join(" ")}</p>` : "") + (R.length ? `<p class="sm" title="R-072 : une couleur de la ronde est réutilisée ; ses fils portent une bague au n° de l'allumage">Bagues d'allumage (couleur réutilisée) : ${R.map((b) => `<span class="bague">${esc(b)}</span>`).join(" ")}</p>` : ""); })()}
          <h3>3. Raccorder dans l'ordre</h3>
          <p class="mut sm">Terres, neutres, phases, puis retours lampe et navettes. Pour chaque numéro : dans chaque gaine indiquée, prendre le fil de la couleur indiquée, le dénuder et l'enfoncer dans le connecteur. Cocher au fur et à mesure.</p>
        </div>
      </div>
      <h3 id="bd-tr-h">Perçage des tranches <span class="mut sm">pour le perceur : chaque face vue de l'extérieur, trous dans l'ordre de gauche à droite, n° de gaine, appareil au bout et diamètre</span></h3>
      <div class="bd-tranches" title="Vue de l'extérieur de chaque face : le perceur perce les trous dans cet ordre (n° croissants de gauche à droite, règle R-077)">${tranchesSVG(box, { sides, n: getCab().departsFace })}</div>
      <table class="gt bd-steps"><thead><tr><th></th><th>N°</th><th>Raccordement</th><th>Fils à prendre (gaine · couleur · appareil)</th><th>Connecteur</th></tr></thead><tbody>
        ${steps.map((s) => `<tr class="${ok.has(s.n) ? "done" : ""}"><td><input type="checkbox" data-n="${s.n}" ${ok.has(s.n) ? "checked" : ""} title="Cocher quand c'est fait"></td><td class="c"><b>${s.n}</b></td><td>${esc(s.label)}</td>
          <td>${s.wires.map((w) => `<div><b>${esc(w.gaine)}</b> ${w.core && w.core !== w.color ? `<span class="wchip"><i style="background:${wireCss(w.core)}"></i>${esc(w.core)}</span> repéré ` : ""}${chip(w)}${w.bague ? ` <span class="bague" title="Bague à poser sur ce fil">bague ${esc(w.bague)}</span>` : ""} <span class="mut">${esc(FN_SHORT[w.fn] || w.fn)} · ${esc(w.label)}${w.room ? " · " + esc(w.room) : ""}</span></div>`).join("")}</td>
          <td>${s.wires.length} fils → ${s.conn.list.length ? s.conn.list.map((k) => `<b>${k} entrées</b>`).join(" + ") + (s.conn.ponts ? ` <span class="mut">(+ ${s.conn.ponts} pont${s.conn.ponts > 1 ? "s" : ""})</span>` : "") : `<span class="warn">fil seul</span>`}</td></tr>`).join("")}
      </tbody></table>
      <h3>4. Contrôle final</h3>
      <ul class="bd-ctl"><li>Chaque gaine : tous ses fils sont dans un connecteur (aucun fil libre).</li><li>Chaque connecteur : le nombre de fils indiqué, enfoncés jusqu'au bout (tirer légèrement pour vérifier).</li></ul>
      ${checks.length ? checks.map((c) => `<p class="warn sm">⚠ ${esc(c)}</p>`).join("") : `<p class="ok sm">✓ Chaque fil de chaque gaine a son raccordement, et chaque raccordement a au moins deux fils.</p>`}
    </div>`;
    el.querySelectorAll("[data-b]").forEach((b) => (b.onclick = () => { cur = b.dataset.b; focusC = null; focusN = null; render(); }));
    // calque par circuit : boutons au-dessus du schéma, ou clic sur un fil / un point du schéma
    const sv = el.querySelector(".bd-svg svg");
    // 07/11/2026 (Kévin) : clic sur un numéro (ou un de ses fils) : seuls ce n° et ses fils restent nets, le reste en fantôme,
    // et la fiche du connecteur rapide à utiliser s'affiche ; les boutons « Circuits » gardent la mise en avant par circuit
    const card = el.querySelector(".bd-conn");
    const applyFocus = () => {
      numberFocus(sv, null);
      if (focusN != null) numberFocus(sv, focusN);
      else sv.querySelectorAll("[data-c]").forEach((n) => { const cs = n.getAttribute("data-c").split(" ").filter(Boolean); n.style.opacity = !focusC || !cs.length || cs.includes(focusC) ? "" : "0.1"; });
      el.querySelectorAll("[data-cq]").forEach((b) => b.classList.toggle("on", focusN == null && (b.dataset.cq || null) === focusC));
      const st = focusN != null && steps.find((s) => String(s.n) === focusN);
      card.hidden = !st;
      card.innerHTML = st ? connecteurCard(st, { color: wireSolid, esc }) : "";
    };
    el.querySelectorAll("[data-cq]").forEach((b) => (b.onclick = () => { focusC = b.dataset.cq || null; focusN = null; applyFocus(); }));
    card.onclick = () => { focusN = null; applyFocus(); };   // clic sur le connecteur : tout revient
    sv.addEventListener("click", (e) => {
      const t = e.target.closest("[data-n]"), num = t && t.getAttribute("data-n");
      if (num) { focusN = focusN === num ? null : num; focusC = null; applyFocus(); return; }
      const n = e.target.closest("[data-c]"); if (!n) { focusC = null; focusN = null; applyFocus(); return; }
      const cs = n.getAttribute("data-c").split(" ").filter(Boolean);
      focusN = null; focusC = cs.length && focusC !== cs[0] ? cs[0] : null; applyFocus();
    });
    applyFocus();
    el.querySelectorAll("input[data-n]").forEach((c) => (c.onchange = () => { const s = done.get(box.id) || new Set(); c.checked ? s.add(+c.dataset.n) : s.delete(+c.dataset.n); done.set(box.id, s); c.closest("tr").classList.toggle("done", c.checked); }));
    el.querySelector("#bd-one").onclick = () => print([S]);
    el.querySelector("#bd-cover").onchange = (e) => { api.setBoxes((api.cab.boxes || []).map((b) => (b.id === box.id ? { ...b, cover: e.target.value } : b))); render(); };
    code128(S.code).then((bits) => { const c = el.querySelector("#bd-code"); if (c) c.innerHTML = barsSVG(bits, S.code, { mod: 1.4, h: 40 }); }).catch(() => {});
    // QR code de la bande (v49) : la bande compressée dans l'adresse de la page « bande.html » de la version en ligne
    sheetUrl(S).then(async (q) => {
      const box = el.querySelector("#bd-qr"), info = el.querySelector("#bd-qrinfo");
      if (!box) return;
      if (q.tooBig) { info.textContent = "⚠ Bande trop grande pour un QR code : utilisez la feuille imprimée."; return; }
      box.innerHTML = qrSVG(await qrMatrix(q.url));
      box.dataset.url = q.url;
      info.innerHTML = `📱 Scannez le QR avec le téléphone pour ouvrir cette bande${q.short ? " (version courte : libellés des raccordements abrégés)" : ""}. <a href="${esc(q.url)}" target="_blank" rel="noopener">Ouvrir ici</a>`;
    }).catch((e) => { const info = el.querySelector("#bd-qrinfo"); if (info) info.textContent = "QR code impossible : " + e.message; });
    el.querySelector("#bd-all").onclick = () => print(sheets);
    el.querySelector("#bd-lab-one").onclick = () => labels([S]);
    el.querySelector("#bd-lab-all").onclick = () => labels(sheets);
    el.querySelector("#bd-dossier").onclick = () => dossier();
    // lot 4 (06/11/2026, décisions n° 53 à 59 et 64) : .spv pour Counter et totaux du planning du BE
    el.querySelector("#bd-spv").onclick = () => {
      const st = el.querySelector("#bd-st"), r = spvNow(api);
      el.__spv = r;
      downloadBlob(new Blob([r.text], { type: "text/plain" }), r.name);
      if (st) st.textContent = `Fichier ${r.name} : ${r.lines.length} lignes (gaines, alimentations, lignes directes).${r.manque ? " ⚠ " + r.manque : ""}`;
    };
    el.querySelector("#bd-planning").onclick = () => {
      const st = el.querySelector("#bd-st"), r = spvNow(api), t = r.planning;
      const txt = `Surface ${t.surface} m² · ${t.gaines} gaines · ${t.boites} boîtes · plomberie ${t.plomberie ? "oui" : "non"}`;
      el.__planning = t;
      navigator.clipboard?.writeText(txt).catch(() => {});
      if (st) st.textContent = "Planning du BE (copié) : " + txt;
    };
    el.querySelector("#bd-docs").onclick = async () => {
      const st = el.querySelector("#bd-st"); if (st) st.textContent = "Documents en préparation…";
      try { const { buildDocumentsPdf } = await import("./documents-pdf.js"); const { downloadBlob } = await import("./dossier.js"); const r = await buildDocumentsPdf(api); el.__docs = r; downloadBlob(r.blob, `Documents ${api.ch.nom}.pdf`); if (st) st.textContent = `Documents à remettre : ${r.pages} page(s).`; }
      catch (e) { if (st) st.textContent = "Documents : erreur (" + (e.message || e) + ")"; }
    };
  }
  render();
  return { render, get last() { return el.__last; }, get lastLabels() { return el.__labels; }, get lastDossier() { return el.__dossier; }, get lastDocs() { return el.__docs; }, get lastSpv() { return el.__spv; }, get lastPlanning() { return el.__planning; }, labels: (all) => labels(all ? boxSheets(api) : boxSheets(api).filter((s) => s.box.id === cur)), dossier, print: (all) => print(all ? boxSheets(api) : boxSheets(api).filter((s) => s.box.id === cur)), select: (id) => { cur = id; render(); } };
}
