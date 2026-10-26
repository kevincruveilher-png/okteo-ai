// Couche d'effets animés (v43–v45), au-dessus du plan : halos orange du contrôle, lumière des lampes en mode essai.
// Une seule <svg id="fx"> qui n'est pas reconstruite à chaque dessin : ses éléments sont gardés d'un dessin à l'autre
// (clé = appareil), seule leur position change ; les animations (pulsation, fondu, scintillement) ne repartent donc pas
// à chaque mouvement de souris. Un élément qui disparaît s'éteint en fondu avant d'être retiré.
import { K } from "./k.js";
import { VB } from "./model.js";

const DEFS = `<defs>
  <radialGradient id="fxGlow"><stop offset="0" stop-color="#fff6cf" stop-opacity=".95"/><stop offset=".18" stop-color="#ffe08a" stop-opacity=".75"/>
    <stop offset=".45" stop-color="#ffc94a" stop-opacity=".32"/><stop offset=".75" stop-color="#ffb52e" stop-opacity=".1"/><stop offset="1" stop-color="#ffb020" stop-opacity="0"/></radialGradient>
  <radialGradient id="fxCore"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset=".6" stop-color="#fff3b8" stop-opacity=".8"/><stop offset="1" stop-color="#ffe08a" stop-opacity="0"/></radialGradient>
</defs><g class="fx-root"></g>`;

const tpl = (it) => it.kind === "glow"
  ? `<g class="fx-in"><circle class="fx-lum" r="1" fill="url(#fxGlow)" style="animation-delay:${(-Math.random() * 3).toFixed(2)}s"/><circle class="fx-core" r=".22" fill="url(#fxCore)"/></g>`
  : `<circle class="pulse" r="1"/><circle class="ring" r="1"/>`;
const tr = (it) => `translate(${it.x} ${it.y}) scale(${it.r})`;

// items : [{key, kind: "glow" | "halo", x, y, r (m)}]
export function fxDraw(items) {
  const fx = document.getElementById("fx");
  if (!fx) return;
  fx.setAttribute("viewBox", `0 0 ${VB.w} ${VB.h}`);
  let root = fx.querySelector("g.fx-root");
  if (!root) { fx.innerHTML = DEFS; root = fx.querySelector("g.fx-root"); }
  root.setAttribute("transform", `translate(${VB.w / 2} ${VB.h / 2}) scale(${K.view.scale}) translate(${-K.view.cx} ${-K.view.cy})`);
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
    g.setAttribute("class", it.kind === "glow" ? "fx-glow" : "fx-halo");
    g.dataset.k = k;
    g.setAttribute("transform", tr(it));
    g.innerHTML = tpl(it);
    root.appendChild(g);
  }
}
