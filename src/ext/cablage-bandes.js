// Onglet « Bandes » (v33) : le schéma de chaque boîte pour le câbleur — la boîte carrée avec ses faces A–D et ses
// gaines (n°, longueur, Ø, appareil, fils avec couleur et n° de raccordement), les connecteurs, les retours lampe et
// navettes tracés, l'orientation de la boîte (pièce de chaque côté), le matériel, les raccordements à faire dans
// l'ordre (à cocher) et le contrôle final. Impression : une feuille par boîte.
import { wiringNow, wireCss, wireSolid, facesSides, fr } from "./cablage-data.js";
import { getCab } from "../cablage/settings.js";
import { boxSteps, boxMaterial, boxChecks, boxWires, parseSizes, schemaSVG, FN_SHORT, wireName, orderLines, BOX_MODELS } from "../cablage/schema.js";
import { code128, barsSVG, boxCode } from "./barcode.js";
import { pointInPoly } from "../walls/rooms.js";
import { buildBandsPdf } from "./bandes-pdf.js";
import { esc } from "./util.js";

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
      ch: { nom: api.ch.nom, numero: api.ch.numero || "", client: api.ch.client || "" } };
  });
}
// flèche vers le tableau (SVG, pour l'écran)
export function arrowSVG(ang, size = 70) {
  if (ang == null) return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><text x="${size / 2}" y="${size / 2 + 5}" text-anchor="middle" font-size="12">?</text></svg>`;
  const deg = ang * 180 / Math.PI, c = size / 2;
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="tab-arrow"><g transform="rotate(${deg.toFixed(1)} ${c} ${c})"><path d="M${c - 26} ${c - 7}H${c + 6}V${c - 17}L${c + 28} ${c}L${c + 6} ${c + 17}V${c + 7}H${c - 26}Z" fill="#1f2a36"/></g></svg>`;
}

export function mountBandsPage(el, { api }) {
  let cur = null, busy = false, focusC = null;   // focusC : circuit mis en avant (les autres s'estompent)
  const done = new Map();          // cases cochées à l'écran (par boîte), le temps de la session
  const chip = (w) => `<span class="wchip"><i style="background:${wireCss(w.color)}"></i>${esc(w.color)} ${fr(w.section, 1)}</span>`;

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
        <span class="grow"></span><button id="bd-one" title="Une feuille A4 : schéma, orientation, matériel, puis les raccordements à cocher">🖨 Imprimer ${esc(box.n)}</button><button id="bd-all" title="Toutes les boîtes, une feuille chacune">🖨 Imprimer toutes les boîtes</button><span id="bd-st" class="mut sm"></span></div>
      <p class="mut sm">${esc(S.level)}${sides.under ? ` · au-dessus de : ${esc(sides.under)}` : ""} · ${box.gaines.length} gaines · ${steps.length} raccordements · ${fr(box.cuivre)} m de fil</p>
      <div class="bd-grid">
        <div class="bd-svgw"><div class="bd-calq" title="Cliquez un circuit (ou un fil du schéma) : les autres s'estompent, comme un calque">Circuits : <button data-cq="" class="${focusC ? "" : "on"}">Tous</button>${box.circuits.map((c) => `<button data-cq="${esc(c)}" class="${focusC === c ? "on" : ""}">${esc(c)}</button>`).join("")}</div>
        <div class="bd-svg">${svg}</div></div>
        <div class="bd-side">
          <div class="bd-label" title="Étiquette collée sur la boîte (en-tête de la feuille imprimée)">
            <div class="bl-l"><div><span class="mut">Pavillonneur</span><b>${esc(S.ch.client || "—")}</b></div><div><span class="mut">Chantier</span><b>${esc(S.ch.nom)}</b></div></div>
            <div class="bl-c" title="Direction du tableau depuis la boîte (haut de la feuille = haut du plan)">${arrowSVG(S.tabAng, 58)}<b>TABLEAU</b></div>
            <div class="bl-r"><div><span class="mut">N° d'affaire</span><b>${esc(S.ch.numero || "—")}</b></div><div><span class="mut">Nom BE</span><b>…………</b></div><div><span class="mut">Câbleur (initiales)</span><span class="sig"></span></div></div>
          </div>
          <div class="bl-bot"><label class="sm">Modèle de boîte <select disabled title="Seul modèle connu pour l'instant">${BOX_MODELS.map((m) => `<option>${esc(m.name)}</option>`).join("")}</select></label>
            <label class="sm" title="Simple indication pour la pose : ne change ni le plan ni la pieuvre">Couvercle <select id="bd-cover"><option value="haut" ${S.cover === "haut" ? "selected" : ""}>vers le haut</option><option value="bas" ${S.cover === "bas" ? "selected" : ""}>vers le bas</option></select></label>
            <div class="bl-code" id="bd-code" title="Code barre unique de la boîte : ${esc(S.code)}"></div></div>
          <h3>Ordre de câblage</h3>
          <table class="bd-order"><tbody>${S.order.map((o) => `<tr><td class="c"><b>${o.n}</b></td><td><span class="wchip"><i style="background:${wireCss(o.color)}"></i>${esc(o.color)} ${o.section ? fr(o.section, 1) : ""}</span></td><td class="r">${o.count} fil${o.count > 1 ? "s" : ""}</td><td class="mut sm">${esc(FN_SHORT[o.fn] || o.fn)}</td></tr>`).join("")}</tbody></table>
          <h3>1. Orienter la boîte</h3>
          <ul class="bd-or">${["A", "B", "C", "D"].map((f, i) => `<li><b>Face ${f}</b> <span class="mut">(${["haut", "droite", "bas", "gauche"][i]} du plan)</span> : ${esc(sides[f] || "—")}</li>`).join("")}</ul>
          <h3>2. Préparer le matériel</h3>
          <ul>${material.sizes.map(([k, n]) => `<li>${n} connecteur${n > 1 ? "s" : ""} <b>${k} entrées</b></li>`).join("")}${material.ponts ? `<li>${material.ponts} pont${material.ponts > 1 ? "s" : ""} (bout de fil de la même couleur, pour relier deux connecteurs)</li>` : ""}</ul>
          <p class="sm bd-fils" title="Nombre de fils de chaque section et couleur dans les gaines de la boîte">Fils : ${fils.wires.map((w) => `${w.n} × ${fr(w.section, 1)} ${chip({ color: w.color, section: w.section }).replace(/ [\d,]+<\/span>$/, "</span>")}`).join(" · ")}${fils.cables.length ? ` · câbles : ${fils.cables.map((c) => `${c.n} × ${esc(c.cable)}`).join(", ")}` : ""}</p>
          ${(() => { const B = [...new Set(box.gaines.filter((g) => g.kind === "alim").flatMap((g) => g.wires.map((w) => w.bague)).filter(Boolean))]; return B.length ? `<p class="sm" title="Bagues numérotées à poser sur les fils de l'alimentation (n° du circuit au tableau, T1… = télérupteur)">Bagues sur l'alimentation : ${B.map((b) => `<span class="bague">${esc(b)}</span>`).join(" ")}</p>` : ""; })()}
          <h3>3. Raccorder dans l'ordre</h3>
          <p class="mut sm">Terres, neutres, phases, puis retours lampe et navettes. Pour chaque numéro : dans chaque gaine indiquée, prendre le fil de la couleur indiquée, le dénuder et l'enfoncer dans le connecteur. Cocher au fur et à mesure.</p>
        </div>
      </div>
      <table class="gt bd-steps"><thead><tr><th></th><th>N°</th><th>Raccordement</th><th>Fils à prendre (gaine · couleur · appareil)</th><th>Connecteur</th></tr></thead><tbody>
        ${steps.map((s) => `<tr class="${ok.has(s.n) ? "done" : ""}"><td><input type="checkbox" data-n="${s.n}" ${ok.has(s.n) ? "checked" : ""} title="Cocher quand c'est fait"></td><td class="c"><b>${s.n}</b></td><td>${esc(s.label)}</td>
          <td>${s.wires.map((w) => `<div><b>${esc(w.gaine)}</b> ${w.core && w.core !== w.color ? `<span class="wchip"><i style="background:${wireCss(w.core)}"></i>${esc(w.core)}</span> repéré ` : ""}${chip(w)}${w.bague ? ` <span class="bague" title="Bague à poser sur ce fil">bague ${esc(w.bague)}</span>` : ""} <span class="mut">${esc(FN_SHORT[w.fn] || w.fn)} · ${esc(w.label)}${w.room ? " · " + esc(w.room) : ""}</span></div>`).join("")}</td>
          <td>${s.wires.length} fils → ${s.conn.list.length ? s.conn.list.map((k) => `<b>${k} entrées</b>`).join(" + ") + (s.conn.ponts ? ` <span class="mut">(+ ${s.conn.ponts} pont${s.conn.ponts > 1 ? "s" : ""})</span>` : "") : `<span class="warn">fil seul</span>`}</td></tr>`).join("")}
      </tbody></table>
      <h3>4. Contrôle final</h3>
      <ul class="bd-ctl"><li>Chaque gaine : tous ses fils sont dans un connecteur (aucun fil libre).</li><li>Chaque connecteur : le nombre de fils indiqué, enfoncés jusqu'au bout (tirer légèrement pour vérifier).</li></ul>
      ${checks.length ? checks.map((c) => `<p class="warn sm">⚠ ${esc(c)}</p>`).join("") : `<p class="ok sm">✓ Chaque fil de chaque gaine a son raccordement, et chaque raccordement a au moins deux fils.</p>`}
    </div>`;
    el.querySelectorAll("[data-b]").forEach((b) => (b.onclick = () => { cur = b.dataset.b; focusC = null; render(); }));
    // calque par circuit : boutons au-dessus du schéma, ou clic sur un fil / un point du schéma
    const sv = el.querySelector(".bd-svg svg");
    const applyFocus = () => {
      sv.querySelectorAll("[data-c]").forEach((n) => { const cs = n.getAttribute("data-c").split(" ").filter(Boolean); n.style.opacity = !focusC || !cs.length || cs.includes(focusC) ? "" : "0.1"; });
      el.querySelectorAll("[data-cq]").forEach((b) => b.classList.toggle("on", (b.dataset.cq || null) === focusC));
    };
    el.querySelectorAll("[data-cq]").forEach((b) => (b.onclick = () => { focusC = b.dataset.cq || null; applyFocus(); }));
    sv.addEventListener("click", (e) => {
      const n = e.target.closest("[data-c]"); if (!n) { focusC = null; applyFocus(); return; }
      const cs = n.getAttribute("data-c").split(" ").filter(Boolean);
      focusC = cs.length && focusC !== cs[0] ? cs[0] : null; applyFocus();
    });
    applyFocus();
    el.querySelectorAll("input[data-n]").forEach((c) => (c.onchange = () => { const s = done.get(box.id) || new Set(); c.checked ? s.add(+c.dataset.n) : s.delete(+c.dataset.n); done.set(box.id, s); c.closest("tr").classList.toggle("done", c.checked); }));
    el.querySelector("#bd-one").onclick = () => print([S]);
    el.querySelector("#bd-cover").onchange = (e) => { api.setBoxes((api.cab.boxes || []).map((b) => (b.id === box.id ? { ...b, cover: e.target.value } : b))); render(); };
    code128(S.code).then((bits) => { const c = el.querySelector("#bd-code"); if (c) c.innerHTML = barsSVG(bits, S.code, { mod: 1.4, h: 40 }); }).catch(() => {});
    el.querySelector("#bd-all").onclick = () => print(sheets);
  }
  render();
  return { render, get last() { return el.__last; }, print: (all) => print(all ? boxSheets(api) : boxSheets(api).filter((s) => s.box.id === cur)), select: (id) => { cur = id; render(); } };
}
