// Lot 6 (06/11/2026, fiche PO-01) — raccourcis du bureau d'études repris de FTZ, modifiables touche par touche.
// Chaque action renvoie à une commande du catalogue (src/ext/catalog.js) : on n'ajoute aucune fonction, on donne
// seulement aux opérateurs les touches qu'ils connaissent. Réglages de chaque poste : localStorage `okteo.raccourcis.v1`
// ({ id: "Ctrl+8" | "" }) ; "" = touche retirée. Les touches que le navigateur garde pour lui (Ctrl+W, Ctrl+N, Ctrl+T…)
// ne peuvent pas être prises : on le dit et on propose une autre touche.

const KEY = "okteo.raccourcis.v1";

// be = touche de FTZ (custom.gr) ; cmd = id du catalogue ; sans cmd = pas encore d'équivalent dans Oktéo
export const ACTIONS = [
  { id: "ortho", label: "Murs orthogonaux (angles droits)", be: "F6", alt: "F7", cmd: "help.angles" },
  { id: "porte", label: "Poser une porte", be: "Ctrl+8", cmd: "tool.porte" },
  { id: "fenetre", label: "Poser une fenêtre", be: "Ctrl+9", cmd: "tool.fenetre" },
  { id: "liaison", label: "Liaison (relier une commande à ses lumières)", be: "Ctrl+G", cmd: "tool.lien" },
  { id: "defaire", label: "Défaire (annuler)", be: "Ctrl+7", cmd: "edit.undo" },
  { id: "rotation", label: "Rotation de 90°", be: "Ctrl+R", cmd: "edit.cw" },
  { id: "copier", label: "Copier (dupliquer la sélection)", be: "Ctrl+Y", cmd: "edit.dup", note: "Dans Oktéo, Ctrl+Y rétablissait : Ctrl+Maj+Z rétablit toujours." },
  { id: "etiquettes", label: "Étiquettes (repères des appareils)", be: "F5", cmd: "view.reps", note: "Remplace « recharger la page » du navigateur sur le plan." },
  { id: "gaine", label: "Gaine", be: "F2", alt: "F9", cmd: "view.cab", note: "Oktéo trace les gaines lui-même : la touche montre la vue Câblage." },
  { id: "association", label: "Association", be: "Ctrl+J", cmd: null, note: "Oktéo associe les appareils au même endroit tout seul (règle du BE)." },
  { id: "direct", label: "Câble direct", be: "Ctrl+6", cmd: null, note: "Les lignes directes sont calculées par Oktéo (Pieuvre → Lignes directes)." },
];

// touches que le navigateur ne laisse jamais à une page
export const INTERDITES = ["Ctrl+W", "Ctrl+N", "Ctrl+T", "Ctrl+Maj+N", "Ctrl+Maj+T", "Ctrl+Maj+W", "Ctrl+Tab", "Ctrl+Maj+Tab", "Alt+F4", "Ctrl+Q", "Ctrl+Maj+Q"];
// remplacement proposé quand le BE avait une touche interdite
export const REMPLACE = { "Ctrl+W": "Ctrl+Maj+F", "Ctrl+N": "Ctrl+Alt+N", "Ctrl+T": "Ctrl+Alt+T" };

// texte d'une touche à partir d'un événement clavier (« Ctrl+Maj+8 »)
export function keyName(e) {
  const k = e.key;
  if (!k || ["Control", "Shift", "Alt", "Meta", "AltGraph"].includes(k)) return "";
  let base = /^F\d{1,2}$/.test(k) ? k : k === " " ? "Espace" : k.length === 1 ? k.toUpperCase() : k;
  // chiffres : la touche physique (Ctrl+8 sur un clavier AZERTY donne « _ »)
  if (e.code && /^Digit\d$/.test(e.code)) base = e.code.slice(5);
  if (e.code && /^Numpad\d$/.test(e.code)) base = e.code.slice(6);
  if (e.code && /^Key[A-Z]$/.test(e.code) && (e.ctrlKey || e.altKey || e.metaKey)) base = e.code.slice(3);
  return [(e.ctrlKey || e.metaKey) && "Ctrl", e.altKey && "Alt", e.shiftKey && "Maj", base].filter(Boolean).join("+");
}

export const interdite = (k) => INTERDITES.includes(k);

function load() { try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { return {}; } }
function save(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch {} }

// touches en service : [{...action, keys: [..], perso}]
export function keymap() {
  const own = load();
  return ACTIONS.map((a) => {
    const perso = Object.prototype.hasOwnProperty.call(own, a.id);
    const keys = perso ? (own[a.id] ? [own[a.id]] : []) : [a.be, a.alt].filter(Boolean).map((k) => interdite(k) ? REMPLACE[k] : k).filter(Boolean);
    return { ...a, keys, perso };
  });
}

// changer la touche d'une action ; renvoie {ok, msg}
export function setKey(id, k) {
  if (!ACTIONS.some((a) => a.id === id)) return { ok: false, msg: "Action inconnue." };
  if (k && interdite(k)) return { ok: false, msg: `${k} est gardée par le navigateur : choisissez une autre touche${REMPLACE[k] ? ` (par exemple ${REMPLACE[k]})` : ""}.` };
  const used = k && keymap().find((a) => a.id !== id && a.keys.includes(k));
  const own = load();
  if (used) own[used.id] = "";   // une touche ne sert qu'à une action : retirée de l'autre
  own[id] = k || "";
  save(own);
  return { ok: true, msg: used ? `${k} servait à « ${used.label} » : retirée de cette action.` : "" };
}
export function resetKey(id) { const own = load(); if (id) delete own[id]; save(id ? own : {}); }

// écoute du clavier : avant les raccourcis d'Oktéo (phase de capture), seulement sur le plan, jamais pendant une saisie
export function createRaccourcis({ catalog, tab }) {
  let map = new Map();
  const refresh = () => { map = new Map(); for (const a of keymap()) if (a.cmd) for (const k of a.keys) map.set(k, a); };
  refresh();
  const onKey = (e) => {
    if (onKey.capture) return;
    const t = e.target;
    if (t && (/input|select|textarea/i.test(t.tagName) || t.isContentEditable)) return;
    if (tab() !== "plan") return;
    const a = map.get(keyName(e));
    if (!a) return;
    const c = (typeof catalog === "function" ? catalog() : catalog).find((x) => x.id === a.cmd);
    if (!c || !c.run) return;
    e.preventDefault(); e.stopImmediatePropagation();
    c.run();
    onKey.last = a.id;
  };
  window.addEventListener("keydown", onKey, true);
  return { refresh, keymap, setKey: (id, k) => { const r = setKey(id, k); refresh(); return r; }, resetKey: (id) => { resetKey(id); refresh(); }, get last() { return onKey.last; },
    // attendre la prochaine touche (page Paramètres) ; Échap = annuler
    capture(fn) { onKey.capture = true; const h = (e) => { const k = keyName(e); if (!k) return; e.preventDefault(); e.stopImmediatePropagation(); window.removeEventListener("keydown", h, true); onKey.capture = false; fn(k === "Escape" ? null : k); }; window.addEventListener("keydown", h, true); } };
}
