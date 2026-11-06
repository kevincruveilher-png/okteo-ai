// Notice dans le logiciel (06/11/2026) : bouton « ? Aide » du bandeau → la notice et le support de formation
// (src/aide/notice.md, la même que le document du projet, tenue à jour à chaque version), avec sommaire et recherche.
import NOTICE from "../aide/notice.md?raw";
import { renderNotice, matches } from "../aide/markdown.js";

export function createAide() {
  let el = null;
  const R = renderNotice(NOTICE);
  function build() {
    el = document.createElement("div");
    el.className = "aide"; el.id = "aide"; el.hidden = true;
    el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Notice d'Oktéo");
    const toc = R.toc.filter((x) => x.lvl === 2).map((x) => `<a href="#aide-${x.id}" data-go="${x.id}">${x.t.replace(/[<>&]/g, "")}</a>`).join("");
    el.innerHTML = `<div class="aide-in"><header class="aide-head"><b>Notice et formation</b>
      <input class="aide-find" id="aide-find" type="search" placeholder="Chercher dans la notice (ex. nuage, échelle, boîte)" aria-label="Chercher dans la notice">
      <span class="aide-n mut" id="aide-n" role="status"></span>
      <button class="aide-x" id="aide-x" title="Fermer (Échap)" aria-label="Fermer la notice">✕</button></header>
      <div class="aide-body"><nav class="aide-toc" aria-label="Sommaire">${toc}</nav><article class="aide-doc" id="aide-doc">${R.html}</article></div></div>`;
    document.body.appendChild(el);
    el.querySelector("#aide-x").onclick = close;
    el.addEventListener("click", (e) => { if (e.target === el) close(); });
    el.querySelectorAll("[data-go]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); goto(a.dataset.go); }));
    const fi = el.querySelector("#aide-find");
    fi.oninput = () => find(fi.value);
    document.addEventListener("keydown", (e) => { if (el && !el.hidden && e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); close(); } }, true);
  }
  function find(q) {
    const S = [...el.querySelectorAll("#aide-doc section")];
    let n = 0;
    S.forEach((s) => { const ok = !q.trim() || matches(s.textContent, q); s.hidden = !ok; if (ok) n++; });
    el.querySelector("#aide-n").textContent = q.trim() ? (n ? `${n} partie${n > 1 ? "s" : ""}` : "rien trouvé") : "";
    el.querySelectorAll(".aide-toc a").forEach((a) => { const s = el.querySelector(`section[data-s="${a.dataset.go}"]`); a.hidden = !!(s && s.hidden); });
    return n;
  }
  function goto(id) { const h = el.querySelector("#aide-" + id); if (h) h.scrollIntoView({ block: "start" }); }
  function open(id) {
    if (!el) build();
    el.hidden = false; document.body.classList.add("aide-on");
    if (id) goto(id);
    setTimeout(() => el.querySelector("#aide-find").focus(), 0);
  }
  function close() { if (!el) return; el.hidden = true; document.body.classList.remove("aide-on"); }
  return { open, close, find, get isOpen() { return !!el && !el.hidden; }, toc: R.toc, get el() { return el; } };
}
