// MAJ mémoire (05/11/2026) : un symbole appris n'est plus réappris (correction après l'analyse, consigne copiée,
// images envoyées à l'IA par l'outil « legende »). Données synthétiques, aucun plan client.
import assert from "node:assert/strict";
import { memoryFixes, memoryPrompt, learned } from "../src/walls/ai-memory.js";
import { runTool } from "../src/walls/ai-tools.js";
import { pastePrompt } from "../src/walls/ai-plan.js";

let n = 0;
const test = async (name, f) => { await f(); n++; console.log("  ✓ " + name); };
const mem = [
  { type: "LUM", lu: "XYZ", desc: "cercle barré en croix", pav: "Maisons Aliénor", by: "kevin", at: "2026-11-05T12:00:00Z", image: "data:image/jpeg;base64,AAAA" },
  { type: "APP", lu: "LUM", inscription: "ALIM DETECTEUR", desc: "demi-cercle", by: "kevin", at: "2026-11-04T10:00:00Z" },
  { type: "PC16", desc: "ancienne fiche sans lecture de l'IA" },
];
await test("un appareil lu « XYZ » (inconnu) prend le type validé, sans doute, avec une note qui dit pourquoi", () => {
  const F = memoryFixes([{ t: "INCONNU", aiType: "XYZ", aiStatus: "a_identifier", x: 1, y: 1 }], mem);
  assert.equal(F.fixed.length, 1);
  const d = F.devices[0];
  assert.equal(d.t, "LUM"); assert.equal(d.aiStatus, "lu"); assert.equal(d.aiType, "XYZ"); assert.ok(d.memoire);
  assert.match(d.aiNote, /mémoire des symboles.*XYZ.*LUM.*kevin/);
});
await test("doute levé quand le même dessin (même lecture + même inscription) a déjà été validé", () => {
  const F = memoryFixes([{ t: "LUM", aiStatus: "a_confirmer", inscription: "alim detecteur" }, { t: "LUM", aiStatus: "a_confirmer", inscription: "autre" }], mem);
  assert.equal(F.devices[0].t, "APP"); assert.equal(F.devices[0].aiStatus, "lu");
  assert.equal(F.devices[1].t, "LUM"); assert.equal(F.devices[1].aiStatus, "a_confirmer", "autre inscription : pas reconnu");
});
await test("un appareil lu sans doute n'est jamais changé ; une fiche sans « lu » ne sert pas à corriger", () => {
  const F = memoryFixes([{ t: "LUM" }, { t: "PC16", aiStatus: "a_confirmer" }], mem);
  assert.equal(F.fixed.length, 0);
  assert.equal(learned(mem).length, 2);
});
await test("consigne copiée : la liste des symboles déjà validés pour le pavillonneur", () => {
  const txt = memoryPrompt(mem, { LUM: "Point lumineux", APP: "Applique" });
  assert.match(txt, /« XYZ » = LUM \(Point lumineux\)/); assert.match(txt, /ALIM DETECTEUR/);
  const P = pastePrompt({ page: 1, memory: txt });
  assert.ok(P.includes(txt) && P.indexOf(txt) < P.indexOf("Réponds UNIQUEMENT"));
  assert.equal(memoryPrompt([]), "");
});
await test("outil « legende » : la mémoire avec « lu comme » et les dessins validés en images", async () => {
  const r = await runTool("legende", {}, { W: 100, H: 100, memory: mem, pav: "Maisons Aliénor" });
  assert.match(r.text, /lu comme « XYZ »/); assert.match(r.text, /\[image 1\]/);
  assert.deepEqual(r.images, ["AAAA"]);
});
console.log(`mémoire des symboles : ${n} vérifications OK`);
