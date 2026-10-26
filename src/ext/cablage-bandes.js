// Onglet « Bandes » (v33) : le schéma de chaque boîte pour le câbleur — la boîte carrée avec ses faces A–D et ses
// gaines (n°, longueur, Ø, appareil, fils avec couleur et n° de raccordement), les connecteurs, les retours lampe et
// navettes tracés, l'orientation de la boîte (pièce de chaque côté), le matériel, les raccordements à faire dans
// l'ordre (à cocher) et le contrôle final. Impression : une feuille par boîte.
import { wiringNow, wireCss, wireSolid, facesSides, fr } from "./cablage-data.js";
import { getCab } from "../cablage/settings.js";
import { boxSteps, boxMaterial, boxChecks, parseSizes, schemaSVG, FN_SHORT } from "../cablage/schema.js";
import { pointInPoly } from "../walls/rooms.js";
import { buildBandsPdf } from "./bandes-pdf.js";
import { esc } from "./util.js";

export function boxSheets(api) {
  const W = wiringNow(api), sizes = parseSizes(getCab().bornes), geos = new Map(), lvName = new Map(api.levels.map((l) => [l.id, l.name]));
  return W.boxes.map((box) => {
    if (!geos.has(box.lv)) geos.set(box.lv, api.exportGeometry(box.lv));
    const steps = boxSteps(box, sizes);
    return { box, steps, material: boxMaterial(steps), checks: boxChecks(box, steps), sides: facesSides(box, geos.get(box.lv), pointInPoly), level: lvName.get(box.lv) || box.lv };
  });
}

export function mountBandsPage(el, { api }) {
  let cur = null, busy = false;
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
    const S = sheets.find((s) => s.box.id === cur), { box, steps, material, checks, sides } = S;
    const ok = done.get(box.id) || new Set();
    const svg = schemaSVG(box, steps, { color: wireSolid, sides });
    el.innerHTML = `<div class="params-in cabpage bands">
      <h2>Bandes — schémas de boîte</h2>
      <div class="bd-pick">${sheets.map((s) => `<button data-b="${s.box.id}" class="${s.box.id === cur ? "on" : ""}" title="${s.box.gaines.length} gaines · ${s.steps.length} raccordements">${esc(s.box.n)}</button>`).join("")}
        <span class="grow"></span><button id="bd-one" title="Une feuille A4 : schéma, orientation, matériel, puis les raccordements à cocher">🖨 Imprimer ${esc(box.n)}</button><button id="bd-all" title="Toutes les boîtes, une feuille chacune">🖨 Imprimer toutes les boîtes</button><span id="bd-st" class="mut sm"></span></div>
      <p class="mut sm">${esc(S.level)}${sides.under ? ` · au-dessus de : ${esc(sides.under)}` : ""} · ${box.gaines.length} gaines · ${steps.length} raccordements · ${fr(box.cuivre)} m de fil</p>
      <div class="bd-grid">
        <div class="bd-svg">${svg}</div>
        <div class="bd-side">
          <h3>1. Orienter la boîte</h3>
          <ul class="bd-or">${["A", "B", "C", "D"].map((f, i) => `<li><b>Face ${f}</b> <span class="mut">(${["haut", "droite", "bas", "gauche"][i]} du plan)</span> : ${esc(sides[f] || "—")}</li>`).join("")}</ul>
          <h3>2. Préparer le matériel</h3>
          <ul>${material.sizes.map(([k, n]) => `<li>${n} connecteur${n > 1 ? "s" : ""} <b>${k} entrées</b></li>`).join("")}${material.ponts ? `<li>${material.ponts} pont${material.ponts > 1 ? "s" : ""} (bout de fil de la même couleur, pour relier deux connecteurs)</li>` : ""}</ul>
          <h3>3. Raccorder dans l'ordre</h3>
          <p class="mut sm">Terres, neutres, phases, puis retours lampe et navettes. Pour chaque numéro : dans chaque gaine indiquée, prendre le fil de la couleur indiquée, le dénuder et l'enfoncer dans le connecteur. Cocher au fur et à mesure.</p>
        </div>
      </div>
      <table class="gt bd-steps"><thead><tr><th></th><th>N°</th><th>Raccordement</th><th>Fils à prendre (gaine · couleur · appareil)</th><th>Connecteur</th></tr></thead><tbody>
        ${steps.map((s) => `<tr class="${ok.has(s.n) ? "done" : ""}"><td><input type="checkbox" data-n="${s.n}" ${ok.has(s.n) ? "checked" : ""} title="Cocher quand c'est fait"></td><td class="c"><b>${s.n}</b></td><td>${esc(s.label)}</td>
          <td>${s.wires.map((w) => `<div><b>${esc(w.gaine)}</b> ${chip(w)} <span class="mut">${esc(FN_SHORT[w.fn] || w.fn)} · ${esc(w.label)}${w.room ? " · " + esc(w.room) : ""}</span></div>`).join("")}</td>
          <td>${s.wires.length} fils → ${s.conn.list.length ? s.conn.list.map((k) => `<b>${k} entrées</b>`).join(" + ") + (s.conn.ponts ? ` <span class="mut">(+ ${s.conn.ponts} pont${s.conn.ponts > 1 ? "s" : ""})</span>` : "") : `<span class="warn">fil seul</span>`}</td></tr>`).join("")}
      </tbody></table>
      <h3>4. Contrôle final</h3>
      <ul class="bd-ctl"><li>Chaque gaine : tous ses fils sont dans un connecteur (aucun fil libre).</li><li>Chaque connecteur : le nombre de fils indiqué, enfoncés jusqu'au bout (tirer légèrement pour vérifier).</li></ul>
      ${checks.length ? checks.map((c) => `<p class="warn sm">⚠ ${esc(c)}</p>`).join("") : `<p class="ok sm">✓ Chaque fil de chaque gaine a son raccordement, et chaque raccordement a au moins deux fils.</p>`}
    </div>`;
    el.querySelectorAll("[data-b]").forEach((b) => (b.onclick = () => { cur = b.dataset.b; render(); }));
    el.querySelectorAll("input[data-n]").forEach((c) => (c.onchange = () => { const s = done.get(box.id) || new Set(); c.checked ? s.add(+c.dataset.n) : s.delete(+c.dataset.n); done.set(box.id, s); c.closest("tr").classList.toggle("done", c.checked); }));
    el.querySelector("#bd-one").onclick = () => print([S]);
    el.querySelector("#bd-all").onclick = () => print(sheets);
  }
  render();
  return { render, get last() { return el.__last; }, print: (all) => print(all ? boxSheets(api) : boxSheets(api).filter((s) => s.box.id === cur)), select: (id) => { cur = id; render(); } };
}
