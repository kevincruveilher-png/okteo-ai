// Pages « Boîtes » et « Lignes directes » (onglets de gauche) : pour chaque boîte, ses gaines avec face, appareil,
// circuit, longueur, diamètre et fils (couleur, section, n° de raccordement), puis la liste des raccordements ;
// les lignes directes tableau → appareil. Tout est recalculé à partir du dessin (déplacer une boîte = nouvelles longueurs).
import { wiringNow, wireCss, fr } from "./cablage-data.js";
import { FN_LABEL } from "../cablage/gaines.js";
import { esc } from "./util.js";

const wire = (w) => `<span class="wchip" title="${esc(FN_LABEL[w.fn] || w.fn)} ${esc(w.color)} ${fr(w.section, 1)} mm²${w.n ? " · raccordement n° " + w.n : ""}"><i style="background:${wireCss(w.color)}"></i>${esc(w.color)} ${fr(w.section, 1)}${w.n ? `<b>${w.n}</b>` : ""}</span>`;

export function mountBoxesPage(el, { api }) {
  function render() {
    const W = wiringNow(api), lv = new Map(api.levels.map((l) => [l.id, l.name]));
    if (!W.boxes.length) {
      el.innerHTML = `<div class="params-in"><h2>Boîtes</h2><p class="mut">Pas encore de boîtes. Onglet Câblage (panneau de droite) : « Répartir automatiquement » les circuits, puis « Placer les boîtes ».</p>
        <button class="on" id="bp-go">Ouvrir l'onglet Câblage</button></div>`;
      el.querySelector("#bp-go").onclick = () => { api.setTab("plan"); document.dispatchEvent(new CustomEvent("okteo:open-cablage")); };
      return;
    }
    el.innerHTML = `<div class="params-in cabpage">
      <h2>Boîtes <span class="mut sm">${W.totals.boites} boîtes · ${W.totals.gaines} gaines · ${fr(W.totals.gaine)} m de gaine · ${fr(W.totals.cuivre)} m de fil</span></h2>
      ${W.issues.length ? `<div class="warnbox">${W.issues.map((x) => `<p class="warn sm">⚠ ${esc(x)}</p>`).join("")}</div>` : ""}
      ${W.boxes.map((b) => `<section class="bx" id="bx-${b.id}">
        <h3>${esc(b.n)} <span class="mut sm">· ${esc(lv.get(b.lv) || b.lv)} · ${b.gaines.length} départs (${["A", "B", "C", "D"].map((f) => `${f} ${b.gaines.filter((g) => g.face === f).length}`).join(" · ")}) · circuits ${esc(b.circuits.join(", "))} · ${fr(b.cuivre)} m de fil</span>
          <button class="sm" data-see="${b.id}" title="Montrer la boîte sur le plan">Voir sur le plan</button></h3>
        <table class="gt"><thead><tr><th>N° gaine</th><th>Face</th><th>Appareil</th><th>Circuit</th><th>Longueur</th><th>Ø</th><th>Fils (couleur, section mm², n° de raccordement)</th></tr></thead>
        <tbody>${b.gaines.map((g) => `<tr class="gk-${g.kind}"><td><b>${esc(g.no)}</b></td><td class="c">${g.face}</td><td>${esc(g.label)}${g.room ? ` <span class="mut">· ${esc(g.room)}</span>` : ""}</td><td>${esc(g.circuit)}</td><td class="r">${g.length == null ? "—" : fr(g.length, 2) + " m"}${g.routed ? ` <span title="Gaine tracée à la main (points de passage)">✎</span>` : ""}</td><td class="c">${g.diam}</td><td>${g.cable ? `<b title="Appareil à l'extérieur : câble dans la gaine">câble ${esc(g.cable)}</b> ` : ""}${g.wires.map(wire).join(" ")}</td></tr>`).join("")}</tbody></table>
        <details class="nets"><summary>Raccordements dans la boîte (${b.nets.length})</summary>
          <ol>${b.nets.map((n) => `<li><b>n° ${n.n}</b> ${esc(n.label)} : ${n.wires.map((w) => `${esc(w.gaine)} (${esc(FN_LABEL[w.fn] || w.fn)})`).join(", ")}</li>`).join("")}</ol></details>
      </section>`).join("")}
    </div>`;
    el.querySelectorAll("[data-see]").forEach((x) => (x.onclick = () => { const b = api.cab.boxes.find((y) => y.id === x.dataset.see); api.setTab("plan"); if (b.lv !== api.level.id) api.switchLevel(b.lv); api.showCircuits = true; api.boxSel = b.id; api.zoomToBox(b.x - 3, b.y - 3, b.x + 3, b.y + 3); }));
  }
  render();
  return { render };
}

export function mountDirectPage(el, { api }) {
  function render() {
    const W = wiringNow(api), lv = new Map(api.levels.map((l) => [l.id, l.name]));
    el.innerHTML = `<div class="params-in cabpage"><h2>Lignes directes <span class="mut sm">${W.direct.length} lignes · du tableau (ou du coffret de communication) jusqu'à l'appareil, sans boîte</span></h2>
      ${!W.direct.length ? `<p class="mut">Aucune ligne directe : elles apparaissent après la répartition en circuits (prises spécialisées, sorties de câble, RJ45).</p>` : `
      <table class="gt"><thead><tr><th>N°</th><th>Circuit</th><th>Appareil</th><th>Pièce</th><th>Niveau</th><th>Longueur</th><th>Ø</th><th>Fils</th></tr></thead>
      <tbody>${W.direct.map((g) => `<tr><td><b>${esc(g.no)}</b></td><td>${esc(g.circuit)}</td><td>${esc(g.label)}</td><td>${esc(g.room || "—")}</td><td>${esc(lv.get(g.lv) || g.lv)}</td><td class="r">${g.length == null ? "—" : fr(g.length, 2) + " m"}</td><td class="c">${g.diam}</td><td>${g.cable ? esc(g.cable) : g.wires.map(wire).join(" ")}</td></tr>`).join("")}</tbody></table>`}
      ${W.issues.filter((x) => /^Pas de tableau/.test(x)).map((x) => `<p class="warn sm">⚠ ${esc(x)}</p>`).join("")}</div>`;
  }
  render();
  return { render };
}
