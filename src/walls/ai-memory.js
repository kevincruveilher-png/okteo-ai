// MAJ mémoire (05/11/2026, Kévin) : un symbole déjà appris ne doit plus être réappris. Pur (sans DOM).
// Chaque fiche de la mémoire garde ce que l'IA avait lu (`lu` : type donné par l'IA, ex. « XYZ » ou « LUM » avec doute,
// et l'inscription voisine) et ce que l'opérateur a validé (`type`). Après une analyse, un appareil lu de la même façon
// chez le même pavillonneur prend le type validé, sans doute : il ne clignote plus, la note dit pourquoi.
const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
const DOUBT = new Set(["a_identifier", "a_confirmer"]);

// fiches utilisables : celles qui disent ce que l'IA avait lu
export const learned = (memory) => (memory || []).filter((m) => m && m.type && m.lu);

// devices : appareils d'un relevé {t, aiType?, aiStatus?, aiNote?, inscription?} ; memory : fiches du pavillonneur
// → { devices (copies), fixed: [{i, from, to, by, at}] }
export function memoryFixes(devices, memory) {
  const M = learned(memory).slice().sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
  const fixed = [];
  const out = (devices || []).map((d, i) => {
    const raw = d.aiType || d.t, doubt = d.t === "INCONNU" || DOUBT.has(d.aiStatus) || (d.aiType && d.aiType !== d.t);
    if (!doubt) return d;
    const m = M.find((e) => norm(e.lu) === norm(raw) && (!e.inscription || norm(e.inscription) === norm(d.inscription)));
    if (!m) return d;
    fixed.push({ i, from: raw, to: m.type, by: m.by || "", at: m.at || "" });
    const note = `reconnu par la mémoire des symboles : « ${raw} » = ${m.type}${m.by ? ` (validé par ${m.by}${m.at ? ", " + String(m.at).slice(0, 10) : ""})` : ""}`;
    return { ...d, t: m.type, aiType: raw, aiStatus: "lu", aiNote: note, memoire: true };
  });
  return { devices: out, fixed };
}

// liste à joindre à la consigne copiée (relevé sans clé) : ce que le bureau d'études a déjà validé pour ce pavillonneur
export function memoryPrompt(memory, names = {}) {
  const L = learned(memory).slice(0, 40);
  if (!L.length) return "";
  return `Symboles déjà validés par le bureau d'études pour ce pavillonneur (sur ses plans précédents) : quand tu reconnais ce dessin, donne directement le type validé, sans doute.\n${L.map((m) => `- dessin lu comme « ${m.lu} »${m.inscription ? ` (inscription « ${m.inscription} »)` : ""} = ${m.type}${names[m.type] ? " (" + names[m.type] + ")" : ""}${m.desc ? " — " + m.desc : ""}`).join("\n")}`;
}
