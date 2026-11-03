// v75 : dictée vocale de l'assistant (micro). Reconnaissance de la parole du navigateur (Web Speech API, français) :
// Chrome et Edge (le son passe par le service de reconnaissance du navigateur), Safari récent ; pas Firefox.
// createMicro({ onText(texte, final), onState(état, message) }) → { supported, active, start(), stop(), toggle() }
// états : "ecoute" | "arret" | "erreur" ; le texte reçu est la phrase en cours (provisoire) ou terminée (final = true).
export const MIC_ERRORS = {
  "not-allowed": "Micro refusé : autorisez le micro pour ce site (cadenas à gauche de l'adresse), puis recliquez sur 🎤.",
  "service-not-allowed": "Dictée refusée par le navigateur pour ce site.",
  "no-speech": "Je n'ai rien entendu. Recliquez sur 🎤 et parlez près du micro.",
  "audio-capture": "Aucun micro trouvé sur ce PC.",
  network: "Dictée indisponible : pas de connexion au service de reconnaissance du navigateur.",
  aborted: "",
};
export function speechCtor(w = globalThis) { return w.SpeechRecognition || w.webkitSpeechRecognition || null; }

export function createMicro({ onText = () => {}, onState = () => {}, lang = "fr-FR", win = globalThis } = {}) {
  const C = speechCtor(win);
  let rec = null, active = false, finals = "";
  function start() {
    if (!C || active) return false;
    rec = new C();
    rec.lang = lang; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
    finals = "";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i], t = r[0].transcript;
        if (r.isFinal) finals += (finals && !/\s$/.test(finals) ? " " : "") + t.trim(); else interim += t;
      }
      onText((finals + (interim ? (finals ? " " : "") + interim.trim() : "")).trim(), !interim);
    };
    rec.onerror = (e) => { const m = MIC_ERRORS[e.error] ?? `Dictée interrompue (${e.error}).`; if (m) onState("erreur", m); };
    rec.onend = () => { active = false; rec = null; onState("arret", ""); };
    try { rec.start(); active = true; onState("ecoute", ""); return true; } catch (err) { active = false; onState("erreur", "Dictée impossible : " + err.message); return false; }
  }
  function stop() { if (rec) try { rec.stop(); } catch { /* déjà arrêtée */ } }
  return { supported: !!C, get active() { return active; }, start, stop, toggle: () => (active ? (stop(), false) : start()) };
}
