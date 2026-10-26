// Mode essai (v45) : encart en haut à gauche du plan quand le bouton « Essai » est enfoncé.
// - un clic sur un interrupteur allume / éteint ses lumières (le cœur gère l'état : va-et-vient en inversion,
//   télérupteur par bouton-poussoir), la lumière s'allume en fondu et vit (couche d'effets) ;
// - « Tout éteindre », « Tester tout » (chaque commande actionnée seule : ce qui n'allume rien ou allume une lumière
//   d'un autre circuit), disjoncteurs : un par circuit (couper un circuit éteint ses lumières) ;
// - « Quitter » (ou Échap, ou le bouton Essai).
import { esc } from "./util.js";

const KIND = { eclairage: "Éclairage", prises: "Prises", cuisine: "Prises cuisine", specialise: "Spécialisé", comm: "Communication" };

export function createEssai({ api, ctlDescribe }) {
  const stage = document.querySelector(".stage");
  const card = document.createElement("div");
  card.className = "essai-card";
  card.hidden = true;
  stage.appendChild(card);
  let res = null, showBrk = false;

  function render() {
    if (!api.testMode) { card.hidden = true; return; }
    card.hidden = false;
    const C = api.cab.circuits || [], off = new Set(api.essai.off), lit = api.essai.lit().length;
    const colors = api.circuitColors || [];
    const brk = !showBrk ? "" : C.length
      ? `<div class="es-brk">${C.map((c, i) => `<label class="es-d ${off.has(c.n) ? "off" : ""}" title="Disjoncteur du circuit ${esc(c.n)}${c.name ? " (" + esc(c.name) + ")" : ""} : décocher = couper"><input type="checkbox" data-n="${esc(c.n)}" ${off.has(c.n) ? "" : "checked"}><i style="background:${colors[i % colors.length] || "var(--accent)"}"></i>${esc(c.n)}<small>${esc(c.name || KIND[c.kind] || c.kind || "")}</small></label>`).join("")}</div>`
      : `<p class="mut sm">Pas encore de circuits : panneau Câblage → « Répartir automatiquement ».</p>`;
    let out = "";
    if (res) {
      const byId = new Map(api.allApps().map((a) => [a.id, a]));
      out = res.issues.length
        ? `<p class="es-sum warn">${res.issues.length} problème${res.issues.length > 1 ? "s" : ""} sur ${res.tested} commande${res.tested > 1 ? "s" : ""} :</p><ul class="es-res">${res.issues.map((it, i) => { const d = ctlDescribe(api, it, byId); return `<li data-i="${i}" title="Cliquez pour y aller"><b>${esc(d.who.split(" → ")[0])}</b> ${esc(it.text)}</li>`; }).join("")}</ul>`
        : `<p class="es-sum ok">✓ ${res.tested} commande${res.tested > 1 ? "s" : ""} essayée${res.tested > 1 ? "s" : ""} : toutes allument leurs lumières, sur leur circuit.</p>`;
    }
    card.innerHTML = `<div class="es-h"><b>💡 Essai</b><span class="mut sm">${lit} lumière${lit > 1 ? "s" : ""} allumée${lit > 1 ? "s" : ""}</span><span class="grow"></span><button class="es-x" title="Quitter l'essai (Échap)">✕</button></div>
      <p class="mut sm">Cliquez un interrupteur pour allumer, recliquez pour éteindre. Va-et-vient : chacun inverse. Poussoir : télérupteur.</p>
      <div class="es-btns"><button data-a="off" title="Éteindre toutes les lumières (remet les commandes à zéro)">Tout éteindre</button>
        <button data-a="test" class="on" title="Actionne chaque commande seule et liste celles qui n'allument rien, qui laissent une lumière éteinte ou qui allument une lumière d'un autre circuit">Tester tout</button>
        <button data-a="brk" class="${showBrk ? "act" : ""}" title="Un disjoncteur par circuit : couper un circuit éteint ses lumières">Disjoncteurs ${showBrk ? "▴" : "▾"}</button></div>
      ${brk}${out}`;
    card.querySelector(".es-x").onclick = () => api.setEssai(false);
    card.querySelector('[data-a="off"]').onclick = () => { api.essai.reset(); api.setHint("Essai : tout est éteint."); render(); };
    card.querySelector('[data-a="test"]').onclick = () => { res = api.essai.testAll(); render(); };
    card.querySelector('[data-a="brk"]').onclick = () => { showBrk = !showBrk; render(); };
    card.querySelectorAll("[data-n]").forEach((c) => (c.onchange = () => { api.essai.breaker(c.dataset.n, c.checked); api.setHint(`Disjoncteur ${c.dataset.n} ${c.checked ? "remis" : "coupé"}.`); render(); }));
    card.querySelectorAll(".es-res li").forEach((li) => (li.onclick = () => {
      const it = res.issues[+li.dataset.i];
      if (it.lv && api.level.id !== it.lv) api.switchLevel(it.lv);
      const here = it.ids.filter((id) => api.state.app.some((a) => a.id === id));
      if (here.length) api.zoomTo(here);
      api.setHint(`Essai — ${it.text}.`);
    }));
  }
  document.addEventListener("okteo:essai", (e) => { if (!e.detail.on) res = null; render(); });
  // le nombre de lumières allumées suit les clics sur le plan
  document.addEventListener("pointerup", () => { if (api.testMode) setTimeout(render, 0); });
  ["okteo:saved", "okteo:level"].forEach((ev) => document.addEventListener(ev, () => { if (api.testMode) render(); }));
  render();
  return { render, get result() { return res; } };
}
