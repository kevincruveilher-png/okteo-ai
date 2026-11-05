// Lot 3 (05/11/2026) : navigation allégée.
// - Plus d'onglet « Chantiers » : un clic sur le logo Oktéo ouvre la page d'accueil (chantiers, compte, état de la
//   version en ligne). Le bandeau « Oktéo entreprise · connecté · ressources hors ligne · Compte / administration » y
//   est rangé : la vue principale gagne de la hauteur. Un avertissement de ce bandeau (hors ligne, session expirée,
//   secours en échec, budget IA) reste signalé sur le plan par une pastille qui ramène à l'accueil.
// - Accueil, Paramètres et Bibliothèque de symboles = pages entières, sans le bandeau du haut ni le panneau de droite,
//   ouvertes « en classeur » : la page arrive par la droite ; les petites flèches à droite la rangent à gauche (dans la
//   colonne des onglets) et ramènent au plan.
// Passe par l'API seulement (setTab, tab, ch) et l'événement okteo:tab.
export const FULL_PAGES = ["chantiers", "params", "bibliotheque"];
const TITLES = { chantiers: "Accueil · chantiers", params: "Paramètres", bibliotheque: "Bibliothèque de symboles" };

export function createHomeShell({ api }) {
  const app = document.querySelector(".app"), main = document.querySelector(".main"), brand = document.querySelector(".top .brand");
  // logo = bouton d'accueil
  if (brand) {
    brand.setAttribute("role", "button"); brand.tabIndex = 0;
    brand.title = "Accueil : chantiers, compte et administration";
    const home = () => api.setTab("chantiers");
    brand.addEventListener("click", home);
    brand.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); home(); } });
  }
  // en-tête de l'accueil (au-dessus de la page Chantiers)
  const head = document.createElement("header");
  head.className = "home-head"; head.id = "home-head"; head.hidden = true;
  head.innerHTML = `<div class="hh-brand">${brand ? brand.innerHTML : "Oktéo"}</div>
    <div class="hh-txt"><h1>Accueil</h1><p class="mut" id="hh-cur"></p></div><span class="grow"></span>
    <div class="hh-bar" id="hh-bar"></div>
    <button class="on" id="hh-plan" title="Revenir au plan du chantier ouvert">Ouvrir le plan ›</button>`;
  app.insertBefore(head, main);
  head.querySelector("#hh-plan").onclick = () => api.setTab("plan");
  // poignée « classeur » : petites flèches à droite de la page entière
  const fold = document.createElement("button");
  fold.className = "cl-fold"; fold.id = "cl-fold"; fold.hidden = true;
  fold.innerHTML = `<span aria-hidden="true">‹‹</span>`;
  main.appendChild(fold);
  fold.onclick = () => close();
  // pastille d'avertissement sur le plan (bandeau rangé à l'accueil)
  const warn = document.createElement("button");
  warn.className = "web-warn"; warn.id = "web-warn"; warn.hidden = true;
  warn.title = "Message de la version en ligne : cliquez pour ouvrir l'accueil";
  warn.onclick = () => api.setTab("chantiers");
  const top = document.querySelector(".top"), chip = top && top.querySelector(".chip");
  if (chip) chip.after(warn); else if (top) top.appendChild(warn);

  // bandeau de la version en ligne (créé par src/web/workspace.js) rangé dans l'en-tête de l'accueil
  const WARN = /⚠|expir|Hors ligne|incomplet|indisponible/i;
  let bar = null, barObs = null;
  function adopt(b) {
    if (!b || b === bar) return;
    bar = b; head.querySelector("#hh-bar").appendChild(b);
    barObs = new MutationObserver(checkWarn); barObs.observe(b, { subtree: true, childList: true, characterData: true });
    checkWarn();
  }
  function checkWarn() {
    if (!bar) return;
    const t = [...bar.querySelectorAll("span")].map((s) => s.textContent).filter((x) => WARN.test(x)).join(" · ");
    warn.hidden = !t; warn.textContent = t ? "⚠ " + t.replace(/^⚠\s*/, "").slice(0, 60) : "";
  }
  adopt(document.querySelector("body > .enterprise-bar"));
  new MutationObserver(() => adopt(document.querySelector("body > .enterprise-bar"))).observe(document.body, { childList: true });

  let last = null;
  function apply(t) {
    const full = FULL_PAGES.includes(t);
    document.body.classList.toggle("page-full", full);
    document.body.dataset.tab = t;
    head.hidden = t !== "chantiers";
    fold.hidden = !full;
    if (full) {
      fold.title = `Ranger « ${TITLES[t]} » et revenir au plan`;
      fold.setAttribute("aria-label", fold.title);
      const ch = api.ch || {}; head.querySelector("#hh-cur").textContent = ch.nom ? `Chantier ouvert : ${ch.nom}${ch.numero ? " · " + ch.numero : ""}${ch.client ? " · " + ch.client : ""}` : "Aucun chantier ouvert";
      const sec = document.getElementById(t);
      if (sec && last !== t) { sec.classList.remove("cl-out"); sec.classList.remove("cl-in"); void sec.offsetWidth; sec.classList.add("cl-in"); }
    }
    last = t;
  }
  // ranger la page : elle glisse vers la gauche (vers la colonne des onglets) puis le plan revient
  function close() {
    const t = api.tab, sec = document.getElementById(t);
    if (!FULL_PAGES.includes(t)) return;
    const done = () => { if (api.tab === t) api.setTab("plan"); };
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!sec || reduce) return done();
    sec.classList.remove("cl-in"); sec.classList.add("cl-out");
    setTimeout(() => { sec.classList.remove("cl-out"); done(); }, 240);
  }
  document.addEventListener("okteo:tab", (e) => apply(e.detail));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && FULL_PAGES.includes(api.tab) && !document.querySelector("dialog[open]") && !e.target.closest?.("input,textarea,select")) close(); });
  apply(api.tab);
  return { close, apply, get head() { return head; }, get bar() { return bar; } };
}
