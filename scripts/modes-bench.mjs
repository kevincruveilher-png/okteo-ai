// v76 étape 7 : banc d'essai des modes d'analyse IA (protocole : docs/banc-essai-v76.md).
//   node scripts/modes-bench.mjs --verite VERITE.okteo RESULTAT_mode1.okteo RESULTAT_mode2.okteo … [--tol 0.3] [--csv sortie.csv] [--detail]
// VERITE = le chantier validé par le BE (export .okteo, ou JSON { appareils: [{ t, x, y, lv? }] }) ;
// RESULTAT = l'export .okteo fait juste après l'analyse IA (relevé ajouté + relectures), AVANT toute correction à la main.
// Sortie : rappel, omissions, faux positifs, précision, types justes, durée, tokens, coût, par fichier ; --csv ajoute
// une ligne par fichier (date, plan, catégorie si --categorie vectoriel|scan-net|scan-degrade).
import fs from "node:fs";
import path from "node:path";
import { devicesOf, score, journalOf, benchLine } from "../src/walls/ai-bench.js";

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : d; }, flag = (k) => { const i = args.indexOf(k); if (i >= 0) args.splice(i, 1); return i >= 0; };
const verite = opt("--verite"), tol = +opt("--tol", "0.3"), csv = opt("--csv"), cat = opt("--categorie", ""), detail = flag("--detail");
if (!verite || !args.length) { console.error("Usage : node scripts/modes-bench.mjs --verite VERITE.okteo RESULTAT.okteo [...] [--tol 0.3] [--csv sortie.csv] [--categorie scan-net] [--detail]"); process.exit(2); }
const read = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const T = devicesOf(read(verite));
console.log(`Vérité terrain : ${path.basename(verite)} — ${T.length} appareils ; tolérance ${tol} m, même famille de type, même niveau.\n`);
const lines = [];
for (const f of args) {
  const F = read(f), S = score(T, devicesOf(F), { tol }), L = benchLine(path.basename(f), S, journalOf(F));
  lines.push(L);
  if (detail) {
    console.log(`— ${L.fichier} : omis ${S.omis.map((d) => `${d.t}@${d.x.toFixed(2)},${d.y.toFixed(2)}`).join(" ") || "aucun"}`);
    console.log(`  en trop ${S.enTrop.map((d) => `${d.t}@${d.x.toFixed(2)},${d.y.toFixed(2)}`).join(" ") || "aucun"}`);
    console.log(`  par type ${Object.entries(S.parType).map(([t, p]) => `${t} ${p.trouves}/${p.vrais}`).join(", ")}`);
  }
}
console.table(lines);
console.log("Mesures d'un essai : à valider par le BE ; aucun taux n'est garanti d'un plan à l'autre.");
if (csv) {
  const head = "date;plan;categorie;fichier;mode;rappel;omissions;faux_positifs;precision;types_justes;duree_s;tokens;cout_usd\n";
  if (!fs.existsSync(csv)) fs.writeFileSync(csv, head);
  const d = new Date().toISOString().slice(0, 10);
  for (const L of lines) fs.appendFileSync(csv, [d, path.basename(verite), cat, L.fichier, L.mode, L.rappel, L.omissions, L.fauxPositifs, L.precision, L.typesJustes, L.duree_s, L.tokens, L.cout_usd].join(";") + "\n");
  console.log(`Ajouté à ${csv}.`);
}
