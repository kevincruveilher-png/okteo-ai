// Une seule fenêtre de travail à la fois (v64) : quand une carte s'ouvre (relevé des murs, pièces, appareils, relevé IA,
// relecture, comparaison des modes, rapport IA…), les autres se ferment, comme si l'on cliquait leur ✕. Les cartes ne
// s'empilent plus sur le plan. Exceptions : l'alerte « Dessin non enregistré » (toujours visible), le mode essai,
// la bulle « Pourquoi ? » et l'assistant (encart à part).
export const CARDS = ".wcard:not(.save-alert), .cmpcard";
const shown = (el) => el.isConnected && !el.hidden && el.offsetParent !== null;

export function createOneCard(root = document.body) {
  let busy = false, last = null;
  function closeOthers(keep) {
    if (busy) return;
    busy = true;
    try {
      root.querySelectorAll(CARDS).forEach((el) => {
        if (el === keep || el.contains(keep) || keep.contains(el) || !shown(el)) return;
        const x = el.querySelector(":scope > .wcard-h .wx, :scope > .cmp-h .wx, .wx");
        if (x) x.click(); else el.hidden = true;
        if (shown(el)) el.hidden = true;   // une carte qui ne se ferme pas d'elle-même
      });
    } finally { busy = false; }
    last = keep;
  }
  const check = (el) => { if (el && el.nodeType === 1 && el.matches && el.matches(CARDS) && shown(el)) closeOthers(el); };
  const obs = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === "attributes") check(m.target);
      else m.addedNodes.forEach((n) => { check(n); if (n.querySelectorAll) n.querySelectorAll(CARDS).forEach(check); });
    }
  });
  obs.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["hidden"] });
  return { closeOthers, get last() { return last; }, stop: () => obs.disconnect() };
}
