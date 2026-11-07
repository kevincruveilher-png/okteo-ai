// 07/11/2026 (Kévin) : une animation à CHAQUE changement de vue. Quitter le plan : la nouvelle vue arrive par la droite
// (glisse de droite à gauche, comme les Paramètres « en classeur ») ; revenir au plan : le plan arrive par la gauche
// (glisse de gauche à droite). D'une vue à une autre : le sens suit l'ordre des onglets (vers un onglet plus à droite :
// arrivée par la droite ; plus à gauche : par la gauche). Sous-onglets de Pieuvre compris. Rien n'est animé si le
// système demande moins d'animations (prefers-reduced-motion), ni pour les tests (window.__okteoNoVT : les tests du plan
// cliquent à des coordonnées calculées, sans attendre la fin du glissement).
// Passe seulement par les événements de l'interface (okteo:tab) et le DOM des pages : aucune donnée n'est touchée.
const ORDER = ["chantiers", "plan", "vue3d", "etude", "boites", "bandes", "lignes", "tableau", "bibliotheque", "params"];
const SUB = ["boites", "bandes", "lignes"];
export const VT_MS = 260;

export function viewDirection(from, to) {
  if (!from || from === to) return null;
  if (to === "plan") return "left";     // retour au plan : de gauche à droite
  if (from === "plan") return "right";  // départ du plan : de droite à gauche
  const a = ORDER.indexOf(from), b = ORDER.indexOf(to);
  if (a < 0 || b < 0) return "right";
  return b > a ? "right" : "left";
}

export function createTransitions({ api }) {
  const reduce = () => !!window.__okteoNoVT || !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const main = document.querySelector(".main");
  // élément qui entre : la zone de dessin pour le plan, le groupe Pieuvre en y entrant, la page sinon
  const target = (from, to) => {
    if (to === "plan") return document.querySelector(".stage");
    if (SUB.includes(to)) return SUB.includes(from) ? document.getElementById(to) : document.getElementById("pg-pieuvre");
    return document.getElementById(to);
  };
  const st = { last: null, count: 0 };
  let prev = api.tab, timer = 0;
  function run(to) {
    const from = prev; prev = to;
    const dir = viewDirection(from, to);
    if (!dir) return;
    const el = target(from, to);
    st.last = { from, to, dir, id: el ? el.id || el.className : null, animated: false };
    if (!el || reduce()) return;
    document.querySelectorAll(".vt-in-right, .vt-in-left").forEach((x) => x.classList.remove("vt-in-right", "vt-in-left"));
    void el.offsetWidth;   // relance l'animation même si la classe était déjà là
    el.classList.add(dir === "right" ? "vt-in-right" : "vt-in-left");
    main && main.classList.add("vt-run");
    st.last.animated = true; st.count++;
    clearTimeout(timer);
    timer = setTimeout(() => { el.classList.remove("vt-in-right", "vt-in-left"); main && main.classList.remove("vt-run"); }, VT_MS + 60);
  }
  document.addEventListener("okteo:tab", (e) => run(e.detail));
  return st;
}
