// Notice dans le logiciel (06/11/2026) : lecture de src/aide/notice.md (test pur)
import { readFileSync } from "node:fs";
import { renderNotice, inline, matches, slug } from "../src/aide/markdown.js";
let ok = 0, ko = 0;
const check = (n, c, i) => { if (c) { ok++; console.log("  ✓ " + n); } else { ko++; console.log("  ✗ " + n + (i ? " — " + i : "")); } };
const md = readFileSync(new URL("../src/aide/notice.md", import.meta.url), "utf8");
const R = renderNotice(md), parts = R.toc.filter((x) => x.lvl === 2).map((x) => x.t);
check("la notice a ses parties : prise en main, étapes 1 à 7, paramètres, formation, questions, historique", parts.length >= 12 && parts.some((t) => /Prise en main/.test(t)) && [1, 2, 3, 4, 5, 6, 7].every((n) => parts.some((t) => t.startsWith("Étape " + n))) && parts.some((t) => /Historique/.test(t)), parts.join(" | "));
check("tableaux, listes, gras et liens rendus ; une section par partie", (R.html.match(/<section /g) || []).length === parts.length && /<table>/.test(R.html) && /<ol>/.test(R.html) && /<ul>/.test(R.html) && /<b>/.test(R.html) && /href="https:\/\/okteo-ai\.pages\.dev\/"/.test(R.html));
check("texte échappé, seuls les liens https gardés", inline("<script> [x](javascript:alert(1)) **g**") === "&lt;script&gt; [x](javascript:alert(1)) <b>g</b>");
check("recherche sans accents ni majuscules, tous les mots", matches("Échelle du plan", "echelle PLAN") && !matches("Échelle", "nuage"));
check("ancres stables", slug("Étape 1 — Importer le plan") === "etape-1-importer-le-plan");
check("la notice cite les boutons du logiciel (menu Relevé, ✓ Contrôle, ? Aide)", /1\. Murs/.test(md) && /✓ Contrôle/.test(md) && /\? Aide/.test(md));
console.log(`\n${ok} vérifications réussies, ${ko} en échec.`);
if (ko) process.exit(1);
