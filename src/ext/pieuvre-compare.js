// Comparatif des modes de pieuvre (v39 ; v62 : note « belle pieuvre » commune, qualite.js) : économique (le moins de
// cuivre), équilibrée (le moins de boîtes, parts égales, comme le bureau d'études), par pièce. Pour chacun : un mini-plan du niveau ouvert (pièces, boîtes, gaines vers les appareils), les
// chiffres (boîtes, circuits, fil, gaine, départs par boîte) et un bouton pour l'appliquer (un seul Ctrl+Z).
import { compareModes } from "./cablage-data.js";
import { esc } from "./util.js";
import { CRITERES } from "../cablage/qualite.js";

const DESC = {
  proximite: "Le moins de cuivre (longueur de chaque gaine × nombre de fils), sans mêler les territoires des boîtes ; volets avec les boîtes voisines si c'est moins de cuivre.",
  equilibre: "Comme le BE : le moins de boîtes, parts de départs égales ; une boîte pour les volets (deux s'ils sont aux deux bouts de la maison).",
  piece: "Une boîte par pièce (les petites pièces rejoignent leur voisine) ; chaque volet dans la boîte de sa pièce.",
  zone: "Une boîte par zone : nuit (chambres, salles de bains), jour (séjour, cuisine, bureau, entrée), garage ; WC et dégagements avec leurs voisines ; plus de boîtes si la zone est trop chargée.",
};
const COL = ["#e6194b", "#3cb44b", "#4363d8", "#f58231", "#911eb4", "#42d4f4", "#f032e6", "#9a6324", "#469990", "#808000"];
const fr = (v, d = 0) => (v == null || !isFinite(v) ? "—" : Number(v).toFixed(d).replace(".", ","));

function miniPlan(api, R) {
  const lv = api.level.id, geo = api.exportGeometry(lv), items = new Map(api.allApps().map((a) => [a.id, a]));
  const rooms = (geo.rooms || []).filter((r) => r.poly && r.poly.length > 2);
  const B = R.boxes.filter((b) => b.lv === lv);
  const pts = [...rooms.flatMap((r) => r.poly), ...B, ...B.flatMap((b) => b.apps.map((id) => items.get(id)).filter((a) => a && a.lv === lv))];
  if (!pts.length) return `<p class="mut sm">Rien à dessiner sur ce niveau.</p>`;
  const x0 = Math.min(...pts.map((p) => p.x)) - 0.5, y0 = Math.min(...pts.map((p) => p.y)) - 0.5, x1 = Math.max(...pts.map((p) => p.x)) + 0.5, y1 = Math.max(...pts.map((p) => p.y)) + 0.5;
  const w = x1 - x0, h = y1 - y0, k = Math.max(w, h) / 60;
  let s = `<svg class="cmp-svg" viewBox="${x0} ${y0} ${w} ${h}" preserveAspectRatio="xMidYMid meet">`;
  rooms.forEach((r) => { s += `<polygon points="${r.poly.map((p) => p.x + "," + p.y).join(" ")}" fill="var(--accent)" fill-opacity="0.07" stroke="var(--mut)" stroke-width="${k * 0.25}"/>`; });
  B.forEach((b, i) => {
    const c = COL[i % COL.length];
    b.apps.map((id) => items.get(id)).filter((a) => a && a.lv === lv).forEach((a) => { s += `<line x1="${b.x}" y1="${b.y}" x2="${a.x}" y2="${a.y}" stroke="${c}" stroke-width="${k * 0.3}" opacity="0.7"/><circle cx="${a.x}" cy="${a.y}" r="${k * 0.45}" fill="${c}"/>`; });
  });
  B.forEach((b, i) => { const q = k * 2.2; s += `<rect x="${b.x - q / 2}" y="${b.y - q / 2}" width="${q}" height="${q}" fill="var(--panel)" stroke="${COL[i % COL.length]}" stroke-width="${k * 0.5}"/><text x="${b.x}" y="${b.y - q * 0.75}" text-anchor="middle" font-size="${k * 1.9}" font-weight="700" fill="var(--fg)">${esc(b.n)}</text>`; });
  return s + `</svg>`;
}

export function createCompare({ api, apply }) {
  let card = null;
  const close = () => { if (card) card.remove(); card = null; };
  function open() {
    close();
    if (!(api.allApps().length)) { api.setHint("Posez d'abord des appareils."); return; }
    card = document.createElement("div");
    card.className = "cmpcard"; card.setAttribute("role", "dialog"); card.setAttribute("aria-label", "Comparer les modes de pieuvre");
    card.innerHTML = `<div class="cmp-h"><b>Comparer les modes de pieuvre</b><button class="wx" title="Fermer (Échap)">✕</button></div><p class="mut sm">Calcul en cours…</p>`;
    document.querySelector(".stage").appendChild(card);
    card.querySelector(".wx").onclick = close;
    setTimeout(() => {
      if (!card) return;
      let res;
      try { res = compareModes(api); } catch (e) { card.innerHTML += `<p class="warn sm">Comparaison impossible : ${esc(e.message)}</p>`; return; }
      const cur = api.cab.mode || "proximite";
      const best = (key, max = false) => { const v = res.map((r) => r.m[key]); const b = max ? Math.max(...v) : Math.min(...v); return (r) => r.m[key] === b; };
      const rows = [["note", "Belle pieuvre (note sur 100)", 0, best("note", true)], ["croise", "Croisements dans une boîte (interdit)", 0, null], ["terr", "Appareils chez la boîte voisine", 0, best("terr")], ["boites", "Boîtes", 0, null], ["circuits", "Circuits (hors lignes directes)", 0, null], ["cuivre", "Fil (m)", 0, best("cuivre")], ["gaine", "Gaine (m)", 0, best("gaine")],
        ["dep", "Départs par boîte (sans l'alimentation)", 0, null], ["ecart", "Écart des départs (régularité)", 1, best("ecart")], ["longues", "Gaines longues", 0, best("longues")], ["pieces", "Pièces par boîte (max)", 0, best("pieces")]];
      const why = (r) => CRITERES.filter((c) => r.note && r.note.pen[c.k] > 0).map((c) => `${c.lab} : −${String(r.note.pen[c.k]).replace(".", ",")}`).join("\n") || "aucun point retiré";
      const val = (r, k, d) => (k === "dep" ? `${r.m.depMin} à ${r.m.depMax}` : fr(r.m[k], d));
      card.innerHTML = `<div class="cmp-h"><b>Comparer les modes de pieuvre</b><span class="mut sm">les boîtes verrouillées 🔒 restent en place · en vert : le meilleur</span><button class="wx" title="Fermer (Échap)">✕</button></div>
        <div class="cmp-grid">${res.map((r) => `<div class="cmp-col${r.mode === cur ? " cur" : ""}" data-mode="${r.mode}">
          <h3>${esc(r.name)}${r.mode === cur ? ` <span class="mut sm">(mode actuel)</span>` : ""}</h3><p class="sm mut">${esc(DESC[r.mode])}</p>
          ${miniPlan(api, r)}
          <table class="gt cmp-t">${rows.map(([k, lab, d, isBest]) => `<tr${k === "note" ? ` class="cmp-note" title="${esc(why(r))}"` : ""}><td>${lab}</td><td class="num${isBest && isBest(r) ? " best" : ""}${k === "croise" && r.m.croise ? " warn" : ""}">${k === "note" && r.note && !r.note.ok ? val(r, k, d) + " ✗" : val(r, k, d)}</td></tr>`).join("")}</table>
          ${r.issues.length ? `<p class="warn sm" title="${esc(r.issues.join("\n"))}">⚠ ${r.issues.length} alerte${r.issues.length > 1 ? "s" : ""}</p>` : `<p class="ok sm">✓ aucune alerte</p>`}
          <button class="on" data-apply="${r.mode}" title="Placer les boîtes de ce mode (les circuits suivent) — Ctrl+Z pour revenir">Appliquer « ${esc(r.name)} »</button></div>`).join("")}</div>`;
      card.querySelector(".wx").onclick = close;
      card.querySelectorAll("[data-apply]").forEach((b) => (b.onclick = () => { const r = res.find((x) => x.mode === b.dataset.apply); close(); apply(r); }));
    }, 30);
  }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && card) close(); });
  return { open, close, get el() { return card; } };
}
