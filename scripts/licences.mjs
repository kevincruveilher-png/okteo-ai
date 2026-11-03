// v76 : garde des licences (npm run licences, et dans npm run check). Règle de Kévin (03/11/2026) : uniquement des
// bibliothèques gratuites à licence permissive (MIT, Apache 2.0, BSD), exécutées dans le navigateur ; jamais d'AGPL /
// GPL / licence commerciale (ex. Scribe.js, AGPL-3.0, refusé). Contrôle toutes les dépendances livrées dans le logiciel
// (pas les outils de test) d'après package-lock.json, et la licence déclarée dans chaque paquet installé.
import fs from "node:fs";
import path from "node:path";

const OK = /^(MIT|Apache-2\.0|BSD-2-Clause|BSD-3-Clause)$/;
// équivalents permissifs (ISC, 0BSD : texte de type MIT ; Zlib : de type BSD), signalés à part
const OK_EQ = /^(ISC|0BSD|Zlib)$/;
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const rows = [], bad = [];
const licOf = (name, entry) => {
  let l = entry.license;
  const pj = path.join("node_modules", name, "package.json");
  if (fs.existsSync(pj)) { const j = JSON.parse(fs.readFileSync(pj, "utf8")); l = j.license || (j.licenses && j.licenses.map((x) => x.type || x).join(" OR ")) || l; }
  return typeof l === "object" && l ? l.type : l;
};
// expression SPDX : « A OR B » = l'une suffit ; « A AND B » = toutes doivent être permissives
const one = (x) => OK.test(x.trim()) || OK_EQ.test(x.trim());
const accept = (l) => String(l || "").replace(/[()]/g, "").split(/\s+OR\s+/).some((alt) => alt.split(/\s+AND\s+/).every(one));
for (const [k, e] of Object.entries(lock.packages || {})) {
  if (!k.startsWith("node_modules/") || e.dev || e.devOptional) continue;
  const name = k.slice(k.lastIndexOf("node_modules/") + 13), l = licOf(name, e);
  rows.push({ name, version: e.version, license: l || "?" });
  if (!accept(l)) bad.push(`${name}@${e.version} : ${l || "licence inconnue"}`);
  if (/scribe\.js/i.test(name)) bad.push(`${name} : Scribe.js est exclu (AGPL-3.0)`);
}
const direct = Object.keys(pkg.dependencies || {});
console.log("Licences des dépendances du logiciel (directes) :");
for (const d of direct) { const r = rows.find((x) => x.name === d); console.log(`  ${d}@${r ? r.version : "?"} : ${r ? r.license : "absent du verrou npm"}`); }
const eq = rows.filter((r) => accept(r.license) && OK_EQ.test(String(r.license).replace(/[()]/g, "").split(/\s+(?:OR|AND)\s+/).find((x) => !OK.test(x.trim())) || ""));
if (eq.length) console.log(`Équivalents permissifs (ISC / 0BSD / Zlib) : ${eq.map((r) => r.name + " " + r.license).join(", ")}`);
if (bad.length) { console.error("✗ Licences refusées :\n  " + bad.join("\n  ")); process.exit(1); }
console.log(`✓ ${rows.length} paquets livrés, tous sous licence permissive.`);
