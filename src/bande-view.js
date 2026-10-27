// Page téléphone « bande.html » (v49) : la bande de câblage d'une boîte, ouverte en scannant le QR code de sa feuille.
// Les données sont dans l'adresse (#b=…, compressées) : rien n'est chargé d'un serveur, rien n'est envoyé.
// Cases cochées gardées sur le téléphone (localStorage, par boîte et par version de la bande).
import { decodeSheet, unpackSheet } from "./cablage/bande-code.js";
import { schemaSVG, boxSteps, orderLines, FN_SHORT, wireName } from "./cablage/schema.js";
import { wireSolid, wireCss } from "./ext/cablage-data.js";

const el = document.getElementById("bande");
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fr = (v, d = 1) => (v == null ? "—" : Number(v).toFixed(d).replace(".", ","));
const arrow = (ang) => ang == null ? "" : `<svg viewBox="0 0 60 60" width="54" height="54"><g transform="rotate(${(ang * 180 / Math.PI).toFixed(1)} 30 30)"><path d="M4 23H34V13L56 30L34 47V37H4Z" fill="currentColor"/></g></svg>`;

async function main() {
  const m = /[#&]b=([A-Za-z0-9_-]+)/.exec(location.hash);
  if (!m) { el.innerHTML = `<h1>Bande de câblage</h1><p>Scannez le QR code d'une feuille de boîte imprimée par Oktéo.</p>`; return; }
  let D;
  try { D = unpackSheet(await decodeSheet(m[1])); }
  catch (e) { el.innerHTML = `<h1>Bande illisible</h1><p>Le QR code n'a pas pu être lu entièrement. Rescannez-le, ou réimprimez la feuille.</p>`; return; }
  const H = D.head, steps = boxSteps(D.box, D.sizes), order = orderLines(steps);
  const KEY = "okteo.bande." + (H.code || H.box) + "." + m[1].length + m[1].slice(-12);
  let done = new Set(); try { done = new Set(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch { /* */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify([...done])); } catch { /* */ } };
  document.title = `${H.box} — ${H.nom}`;
  el.innerHTML = `
    <header class="hd">
      <div><small>Pavillonneur</small><b>${esc(H.client || "—")}</b><small>Chantier</small><b>${esc(H.nom)}</b></div>
      <div class="tab">${arrow(D.tabAng)}<span>TABLEAU</span></div>
      <div class="r"><small>N° d'affaire</small><b>${esc(H.numero || "—")}</b><small>${esc(H.level)}</small></div>
    </header>
    <h1>Boîte ${esc(H.box)} <span>${esc(H.model)} · couvercle vers le ${esc(H.cover)}</span></h1>
    <div class="faces">${["A", "B", "C", "D"].map((f) => `<span><b>${f}</b> ${esc(D.sides[f] || "—")}</span>`).join("")}</div>
    <section class="sch"><div class="svgw">${schemaSVG(D.box, steps, { color: wireSolid, sides: D.sides })}</div><p class="mut">Écartez deux doigts pour agrandir le schéma.</p></section>
    <section><h2>Ordre de câblage</h2>
      <table class="ord">${order.map((o) => `<tr><td class="n">${o.n}</td><td><i style="background:${wireCss(o.color)}"></i>${esc(o.color)} ${o.section ? fr(o.section) : ""}</td><td class="c">${o.count} fil${o.count > 1 ? "s" : ""}</td></tr>`).join("")}</table></section>
    <section><h2>Raccordements <span class="prog"></span></h2>
      <ol class="steps">${steps.map((s) => `<li data-n="${s.n}" class="${done.has(s.n) ? "done" : ""}"><label><input type="checkbox" ${done.has(s.n) ? "checked" : ""}><b>${s.n}.</b> ${esc(s.label)}
        <small>${s.wires.length} fils → ${s.conn.list.length ? s.conn.list.map((k) => k + " entrées").join(" + ") + (s.conn.ponts ? ` (+ ${s.conn.ponts} pont${s.conn.ponts > 1 ? "s" : ""})` : "") : "fil seul : vérifier"}</small></label>
        <ul>${s.wires.map((w) => `<li><b>${esc(w.gaine)}</b> <i style="background:${wireCss(w.core && w.core !== w.color ? w.core : w.color)}"></i>${esc(wireName(w))} ${fr(w.section)}${w.bague ? ` · bague ${esc(w.bague)}` : ""} <span class="mut">${esc(FN_SHORT[w.fn] || w.fn)}${w.label ? " · " + esc(w.label) : ""}</span></li>`).join("")}</ul></li>`).join("")}</ol></section>
    <section><h2>Contrôle final</h2><ul class="ctl"><li>Chaque gaine : tous ses fils sont dans un connecteur (aucun fil libre).</li><li>Chaque connecteur : le nombre de fils indiqué, enfoncés jusqu'au bout (tirer légèrement pour vérifier).</li></ul></section>
    <footer>${esc(H.code)} · Oktéo</footer>`;
  const prog = () => { el.querySelector(".prog").textContent = `${done.size} / ${steps.length}`; };
  el.querySelectorAll(".steps > li").forEach((li) => li.querySelector("input").onchange = (e) => {
    const n = +li.dataset.n; if (e.target.checked) done.add(n); else done.delete(n);
    li.classList.toggle("done", e.target.checked); save(); prog();
  });
  prog();
}
main();
