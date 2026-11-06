// Catalogue des règles (page Paramètres, 06/11/2026) : cohérence des fiches, sans navigateur.
import { ETATS, RUBRIQUES, FICHES, QUESTIONS, fichesOf, compte, cherche, catalogueTexte } from "../src/referentiel/catalogue.js";
import { CAB_DEFAULTS } from "../src/cablage/settings.js";
import { REGLES } from "../src/norme/nfc15100.js";
import { sharepointUrl, sharepointOk } from "../src/referentiel/sharepoint.js";

let ok = 0, ko = 0;
const check = (name, cond, info) => { if (cond) { ok++; console.log("  ✓ " + name); } else { ko++; console.log("  ✗ " + name + (info ? " — " + JSON.stringify(info) : "")); } };

console.log("Catalogue des règles");
const ids = FICHES.map((f) => f.id);
check("identifiants uniques", new Set(ids).size === ids.length, ids.filter((x, i) => ids.indexOf(x) !== i));
check("identifiants au format AA-00", ids.every((x) => /^[A-Z]{2}-\d{2}$/.test(x)));
const rubs = new Set(RUBRIQUES.map((r) => r.id));
check("chaque fiche dans une rubrique connue", FICHES.every((f) => rubs.has(f.rub)), FICHES.filter((f) => !rubs.has(f.rub)).map((f) => f.id));
check("chaque fiche a un état connu", FICHES.every((f) => f.etat in ETATS));
check("chaque fiche a un titre, une valeur, une explication, une source, un usage", FICHES.every((f) => f.titre && f.valeur && f.pourquoi && f.source && f.usage));
const badCab = FICHES.flatMap((f) => (f.cab || []).filter((k) => !(k in CAB_DEFAULTS)).map((k) => f.id + ":" + k));
check("réglages liés existants (getCab)", !badCab.length, badCab);
check("n° de décision entre 1 et 69", FICHES.every((f) => (f.n || []).every((n) => n >= 1 && n <= 69)));
const nums = new Set(FICHES.flatMap((f) => f.n || []));
check("les décisions principales de l'étude FTZ ont leur fiche", [1, 2, 3, 4, 11, 19, 20, 21, 25, 38, 41, 42, 46, 47, 50, 53, 60, 61, 64, 65].every((n) => nums.has(n)), [...nums].sort((a, b) => a - b));
check("les rubriques des règles KiTéOHM ont des fiches", ["chantier", "appareils", "cablage", "conducteurs", "pieuvres", "tableau", "fabrication"].every((r) => fichesOf(r).length >= 3));
const C = compte();
check("décompte des états = nombre de fiches", Object.values(C).reduce((a, b) => a + b, 0) === FICHES.length);
check("recherche « couleur » : fiches des couleurs", cherche("couleur").some((f) => f.id === "CB-01") && cherche("couleur").some((f) => f.id === "CO-04"));
check("recherche sans accent (« calibre » trouve TA-01)", cherche("calibre").some((f) => f.id === "TA-01"));
const txt = catalogueTexte({ cab: { couleursCommande: "orange/ivoire" }, labels: { couleursCommande: "Ronde des fils" }, date: "06/11/2026", normes: REGLES });
check("export texte : toutes les fiches, les questions et la norme", ids.every((id) => txt.includes(id)) && QUESTIONS.every(([r]) => txt.includes(r + " :")) && txt.includes("PC-01") && txt.includes("Ronde des fils = orange/ivoire"));
// confidentialité (dépôt public) : pas de prix, pas de nom de client ni de chantier étudié
const all = JSON.stringify({ FICHES, QUESTIONS });
check("aucun prix ni nom de chantier réel dans le catalogue", !/€|MONTEAUD|PASQUIER|MAILLARD|EVRARD|DUCOURNEAU/i.test(all));

check("CH-08 : adresse SharePoint = modèle + n° d'affaire ; rien sans modèle, sans n° ou sans https", sharepointUrl("https://x.sharepoint.com/sites/BE/{affaire}/plans", "AF26 001") === "https://x.sharepoint.com/sites/BE/AF26%20001/plans" && sharepointUrl("https://x.sharepoint.com/BE", "AF1") === "https://x.sharepoint.com/BE/AF1" && sharepointUrl("", "AF1") === "" && sharepointUrl("https://x.sharepoint.com/{affaire}", "") === "" && sharepointUrl("javascript:alert(1)/{affaire}", "AF1") === "" && !sharepointOk("http://x.fr") && sharepointOk(""));

console.log(`\n${ok} vérifications réussies, ${ko} en échec.`);
if (ko) process.exit(1);
