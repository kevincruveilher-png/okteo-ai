// MAJ mémoire (05/11/2026, Kévin) : un symbole déjà appris ne doit plus être réappris. Pur (sans DOM).
// Chaque fiche de la mémoire garde ce que l'IA avait lu (`lu` : type donné par l'IA, ex. « XYZ » ou « LUM » avec doute,
// et l'inscription voisine) et ce que l'opérateur a validé (`type`). Après une analyse, un appareil lu de la même façon
// chez le même pavillonneur prend le type validé, sans doute : il ne clignote plus, la note dit pourquoi.
const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
// MAJ mémoire (06/11/2026) : l'IA hésite entre deux types (note « INT ou VV ? », souvent deux symboles qui se
// chevauchent) : la lecture retenue est la paire, rangée dans l'ordre (« INT ou VV »), apprise comme un dessin
export function doubtKey(d) {
  const m = String((d && d.aiNote) || "").match(/\b([A-Z][A-Z0-9]{1,7})\s+ou\s+([A-Z][A-Z0-9]{1,7})\b/);
  return m ? [m[1], m[2]].sort().join(" ou ") : "";
}
// ce que l'IA avait lu pour cet appareil (clé de la mémoire)
export const readKey = (d) => doubtKey(d) || (d && (d.aiType || d.t)) || "";
const DOUBT = new Set(["a_identifier", "a_confirmer"]);

// fiches utilisables : celles qui disent ce que l'IA avait lu
export const learned = (memory) => (memory || []).filter((m) => m && m.type && m.lu);

// devices : appareils d'un relevé {t, aiType?, aiStatus?, aiNote?, inscription?} ; memory : fiches du pavillonneur
// → { devices (copies), fixed: [{i, from, to, by, at}] }
export function memoryFixes(devices, memory) {
  // fiches du pavillonneur d'abord (`own`), puis celles valables pour tous ; les plus récentes d'abord
  const M = learned(memory).slice().sort((a, b) => (b.own === false ? 0 : 1) - (a.own === false ? 0 : 1) || String(b.at || "").localeCompare(String(a.at || "")));
  const fixed = [];
  const out = (devices || []).map((d, i) => {
    const pair = doubtKey(d), raw = pair || d.aiType || d.t, doubt = !!pair || d.t === "INCONNU" || DOUBT.has(d.aiStatus) || (d.aiType && d.aiType !== d.t);
    if (!doubt) return d;
    const same = (e) => !e.inscription || norm(e.inscription) === norm(d.inscription);
    const m = M.find((e) => norm(e.lu) === norm(raw) && same(e));
    if (!m) return d;
    fixed.push({ i, from: raw, to: m.type, by: m.by || "", at: m.at || "" });
    const note = `reconnu par la mémoire des symboles${m.own === false ? " (valable pour tous les pavillonneurs" + (m.pav ? ", appris chez " + m.pav : "") + ")" : ""} : « ${raw} » = ${m.type}${m.by ? ` (validé par ${m.by}${m.at ? ", " + String(m.at).slice(0, 10) : ""})` : ""}`;
    return { ...d, t: m.type, aiType: pair ? d.aiType || d.t : raw, aiStatus: "lu", aiNote: note, memoire: true };
  });
  return { devices: out, fixed };
}

// liste à joindre à la consigne copiée (relevé sans clé) : ce que le bureau d'études a déjà validé pour ce pavillonneur
export function memoryPrompt(memory, names = {}) {
  const L = learned(memory).slice(0, 40);
  if (!L.length) return "";
  return `Symboles déjà validés par le bureau d'études pour ce pavillonneur (sur ses plans précédents) et pour tous les pavillonneurs : quand tu reconnais ce dessin, donne directement le type validé, sans doute. Si tu hésites entre deux types, ou si deux symboles se chevauchent, compare d'abord avec cette liste : une hésitation déjà tranchée (« A ou B » = type) se tranche de la même façon.\n${L.map((m) => `- ${m.own === false ? "(tous les pavillonneurs) " : ""}dessin lu comme « ${m.lu} »${m.inscription ? ` (inscription « ${m.inscription} »)` : ""} = ${m.type}${names[m.type] ? " (" + names[m.type] + ")" : ""}${m.desc ? " — " + m.desc : ""}`).join("\n")}`;
}
