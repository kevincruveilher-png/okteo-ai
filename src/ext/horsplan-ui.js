// Équipements hors plan (v57, R-100) : section du panneau Câblage. Liste de contrôle d'après le devis (cuisine équipée,
// VMC, bouches, sèche-serviette, équipotentielles, antenne, sonnette, G EXT…), cochée d'avance d'après les chantiers
// déjà faits (registre local) ; « Poser » ajoute ce qui manque dans la pièce qui convient, marqué « à vérifier avec le
// devis » (hp). Un seul Ctrl+Z. La liste du chantier est gardée dans le chantier (cab.horsplan) et dans le registre.
import { proposal, placeHorsPlan, recordChantier, getRegistry } from "../cablage/horsplan.js";
import { esc } from "./util.js";

export function hpState(api) {
  const apps = api.allApps(), have = {};
  apps.forEach((a) => (have[a.t] = (have[a.t] || 0) + 1));
  const list = proposal(draft || api.cab.horsplan || null, getRegistry(), api.ch.id);
  const hp = apps.filter((a) => a.hp);
  return { list, have, hp, apps };
}

export function hpSection(api, open = false) {
  const { list, have, hp } = hpState(api);
  const miss = list.filter((it) => it.on && (+it.q || 0) > (have[it.t] || 0)).length;
  const rows = list.map((it) => `<label class="hp-row" title="${it.total > 0 ? `Vu sur ${it.seen} chantier${it.seen > 1 ? "s" : ""} sur ${it.total}` : "Aucun chantier enregistré"}">
      <input type="checkbox" data-hp="${it.t}" ${it.on ? "checked" : ""}>
      <span class="hp-n">${esc(it.n)}${have[it.t] || it.total ? `<small class="mut">${[have[it.t] ? `${have[it.t]} sur le plan` : "", it.total ? `${Math.round(it.freq * 100)} % des chantiers` : ""].filter(Boolean).join(" · ")}</small>` : ""}</span>
      <input type="number" min="0" max="20" value="${it.q}" data-hq="${it.t}" aria-label="Quantité"></label>`).join("");
  return `<details class="hp-sec" id="hp-sec" ${open ? "open" : ""}><summary><b>Équipements hors plan</b> <span class="mut sm">${miss ? `${miss} à poser d'après le devis` : "rien à poser"}${hp.length ? ` · ${hp.length} posé${hp.length > 1 ? "s" : ""} à vérifier` : ""}</span></summary>
    <p class="mut sm">Ce que le BE ajoute d'après le devis et qui n'est pas dessiné sur le plan. Cochez d'après le devis ; le % = part des chantiers déjà faits qui l'avaient (coché d'avance à partir de 80 %).</p>
    <div class="hp-list">${rows}</div>
    <div class="wrow"><button class="on" id="hp-go" title="Ajoute ce qui manque dans la pièce qui convient (Ctrl+Z annule). Marqué « à vérifier avec le devis ».">Poser les cochés</button>
    ${hp.length ? `<button id="hp-see" title="Sélectionner sur le plan les équipements hors plan">Voir</button><button id="hp-clear" title="Retirer les équipements hors plan posés (Ctrl+Z annule)">Retirer</button>` : ""}</div></details>`;
}

// lit la liste cochée dans la section
function readList(root) {
  const out = {};
  root.querySelectorAll("[data-hp]").forEach((c) => { const q = +root.querySelector(`[data-hq="${c.dataset.hp}"]`).value || 0; out[c.dataset.hp] = c.checked ? Math.max(1, q) : 0; });
  return out;
}

// pose ce qui manque (niveau ouvert) ; renvoie le nombre posé
export function poserHorsPlan(api, saved) {
  const { have } = hpState(api), list = proposal(saved, getRegistry(), api.ch.id);
  const lv = api.level.id, geo = api.exportGeometry(lv);
  const tab = api.state.app.find((a) => a.t === "TAB");
  const pos = placeHorsPlan(list, (geo.rooms || []).map((r) => ({ name: r.name, poly: r.poly })), { tab, have });
  let n = 0;
  api.batch(() => {
    api.setCab({ horsplan: saved });
    if (pos.length) n = api.importDevices(pos.map((p) => ({ t: p.t, x: p.x, y: p.y, hp: true })), []).appareils;
  });
  recordChantier(api.ch.id, saved);
  const where = [...new Set(pos.map((p) => p.room).filter(Boolean))].join(", ");
  api.setHint(n ? `${n} équipement(s) hors plan posé(s)${where ? ` (${where})` : ""}, marqués « à vérifier avec le devis ». Déplacez-les à leur vraie place. Ctrl+Z annule.` : "Rien à poser : tout ce qui est coché est déjà sur le plan.");
  document.dispatchEvent(new CustomEvent("okteo:horsplan", { detail: { n } }));
  return n;
}

export function wireHpSection(root, api, rerender) {
  const sec = root.querySelector("#hp-sec");
  if (!sec) return;
  sec.ontoggle = () => { hpOpen = sec.open; };
  // la saisie en cours survit à un nouvel affichage du panneau (enregistrement automatique…)
  sec.querySelectorAll("[data-hp], [data-hq]").forEach((i) => (i.onchange = i.oninput = () => { draft = readList(sec); }));
  root.querySelector("#hp-go").onclick = () => { const L = readList(sec); draft = null; poserHorsPlan(api, L); hpOpen = true; rerender && rerender(); };
  const see = root.querySelector("#hp-see");
  if (see) see.onclick = () => { const ids = api.state.app.filter((a) => a.hp).map((a) => a.id); if (ids.length) { api.select(ids); api.zoomTo(ids); } else api.setHint("Aucun équipement hors plan sur ce niveau."); };
  const cl = root.querySelector("#hp-clear");
  if (cl) cl.onclick = () => { const ids = api.allApps().filter((a) => a.hp).map((a) => a.id); const n = api.removeApps(ids); api.setHint(`${n} équipement(s) hors plan retiré(s). Ctrl+Z annule.`); };
}
export let hpOpen = false;
let draft = null;
