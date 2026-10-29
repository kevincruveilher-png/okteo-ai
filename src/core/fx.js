// Couche d'effets animés (v43–v45), au-dessus du plan : halos orange du contrôle, lumière des lampes en mode essai.
// Une seule <svg id="fx"> qui n'est pas reconstruite à chaque dessin : ses éléments sont gardés d'un dessin à l'autre
// (clé = appareil), seule leur position change ; les animations (pulsation, fondu, scintillement) ne repartent donc pas
// à chaque mouvement de souris. Un élément qui disparaît s'éteint en fondu avant d'être retiré.
import { K } from "./k.js";
import { VB } from "./model.js";
import { viewTransform } from "./view.js";

const DEFS = `<defs>
  <radialGradient id="fxGlow"><stop offset="0" stop-color="#fff6cf" stop-opacity=".58"/><stop offset=".18" stop-color="#ffe08a" stop-opacity=".44"/>
    <stop offset=".45" stop-color="#ffc94a" stop-opacity=".18"/><stop offset=".75" stop-color="#ffb52e" stop-opacity=".05"/><stop offset="1" stop-color="#ffb020" stop-opacity="0"/></radialGradient>
  <radialGradient id="fxCore"><stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset=".6" stop-color="#fff3b8" stop-opacity=".45"/><stop offset="1" stop-color="#ffe08a" stop-opacity="0"/></radialGradient>
  <radialGradient id="fxPlacement"><stop offset="0" stop-color="#9b59e6" stop-opacity=".08"/><stop offset=".7" stop-color="#9b59e6" stop-opacity=".32"/><stop offset="1" stop-color="#9b59e6" stop-opacity="0"/></radialGradient>
</defs><g class="fx-root"></g>`;

const tpl = (it) => it.kind === "glow"
  ? `<g class="fx-in"><circle class="fx-lum" r="1" fill="url(#fxGlow)" style="animation-delay:${(-Math.random() * 3).toFixed(2)}s"/><circle class="fx-core" r=".22" fill="url(#fxCore)"/></g>`
  // doute du câblage (v53) : pastille « ✕ » (bloquant) ou « ? » à côté de la boîte concernée
  : it.kind === "doubt" ? `<circle class="dbt-pulse" r="1"/><circle class="dbt-bg" r="1"/><text class="dbt-t" y=".42" text-anchor="middle" font-size="1.25">${it.bloquant ? "✕" : "?"}</text>`
  : it.kind === "placement" ? `<circle r="1.25" fill="url(#fxPlacement)"/><circle r=".85" fill="none" stroke="#9954dc" stroke-width=".07"/><title>Emplacement précis à définir : déplacer puis confirmer dans Propriétés</title>`
  : `<circle class="pulse" r="1"/><circle class="ring" r="1"/>`;
const tr = (it) => `translate(${it.x} ${it.y}) scale(${it.r})`;

// items : [{key, kind: "glow" | "halo" | "doubt", x, y, r (m), bloquant}]
export function fxDraw(items) {
  const fx = document.getElementById("fx");
  if (!fx) return;
  fx.setAttribute("viewBox", `0 0 ${VB.w} ${VB.h}`);
  let root = fx.querySelector("g.fx-root");
  if (!root) { fx.innerHTML = DEFS; root = fx.querySelector("g.fx-root"); }
  root.setAttribute("transform", viewTransform());
  const want = new Map(items.map((it) => [it.kind + ":" + it.key, it]));
  root.querySelectorAll(":scope > g[data-k]").forEach((g) => {
    const it = want.get(g.dataset.k);
    if (it) {
      g.setAttribute("transform", tr(it));
      if (g.classList.contains("gone")) { g.classList.remove("gone"); clearTimeout(+g.dataset.t); }
      want.delete(g.dataset.k);
    } else if (!g.classList.contains("gone")) {
      g.classList.add("gone");
      g.dataset.t = setTimeout(() => g.remove(), 480);
    }
  });
  for (const [k, it] of want) {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", it.kind === "glow" ? "fx-glow" : it.kind === "doubt" ? "fx-doubt" + (it.bloquant ? " blq" : "") : it.kind === "placement" ? "fx-placement" : "fx-halo");
    g.dataset.k = k;
    g.setAttribute("transform", tr(it));
    g.innerHTML = tpl(it);
    root.appendChild(g);
  }
}
