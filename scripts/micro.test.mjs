// v75 : dictée au micro de l'assistant (src/ext/micro.js) avec une fausse reconnaissance vocale
import { createMicro, MIC_ERRORS } from "../src/ext/micro.js";
let ok = 0; const fails = [];
const check = (name, fn) => { try { if (fn() === false) throw new Error("condition fausse"); ok++; console.log("  ✓ " + name); } catch (e) { fails.push(name); console.log("  ✗ " + name + " : " + e.message); } };
class FakeRec { constructor() { FakeRec.last = this; } start() { this.started = true; } stop() { this.onend && this.onend(); } }
const res = (list, from = 0) => ({ resultIndex: from, results: list.map(([t, fin]) => Object.assign([{ transcript: t }], { isFinal: fin })) });
console.log("Dictée au micro (v75)");
check("navigateur sans reconnaissance vocale : non disponible, start refusé", () => { const m = createMicro({ win: {} }); return !m.supported && m.start() === false; });
check("écoute : français, phrases provisoires puis finales, arrêt", () => {
  const got = [], st = [];
  const m = createMicro({ win: { webkitSpeechRecognition: FakeRec }, onText: (t, f) => got.push([t, f]), onState: (s) => st.push(s) });
  m.start(); const r = FakeRec.last;
  r.onresult(res([["où est la", false]]));
  r.onresult(res([["où est la prise", true]]));
  r.onresult(res([["où est la prise", true], [" du salon", false]], 1));
  r.onresult(res([["où est la prise", true], ["du salon", true]], 1));
  const act = m.active; m.toggle();
  if (!(r.lang === "fr-FR" && r.continuous && r.interimResults && act && !m.active)) throw new Error(JSON.stringify({ lang: r.lang, act }));
  return JSON.stringify(got) === JSON.stringify([["où est la", false], ["où est la prise", true], ["où est la prise du salon", false], ["où est la prise du salon", true]]) && st.join() === "ecoute,arret";
});
check("erreurs : micro refusé = message clair ; arrêt volontaire = rien", () => {
  const msgs = []; const m = createMicro({ win: { SpeechRecognition: FakeRec }, onState: (s, t) => s === "erreur" && msgs.push(t) });
  m.start(); FakeRec.last.onerror({ error: "not-allowed" }); FakeRec.last.onerror({ error: "aborted" });
  return msgs.length === 1 && msgs[0] === MIC_ERRORS["not-allowed"];
});
console.log(`\n${ok} vérifications réussies, ${fails.length} en échec.`);
if (fails.length) process.exit(1);
