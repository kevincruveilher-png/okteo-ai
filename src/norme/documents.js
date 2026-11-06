// MAJ norme n° 6 (06/11/2026, go de Kévin) : documents à remettre (bible DOC-01 à DOC-05) et fiche d'autocontrôle (DOC-04).
// Pur (sans DOM) : les données ; la mise en page PDF est dans src/ext/documents-pdf.js.
// - unifilaire : chaque différentiel et ses disjoncteurs (calibre, section, fonction, locaux desservis) — DOC-02 ;
// - repérage : une étiquette par circuit (n°, fonction, locaux), lisible sans autre document — DOC-01 ;
// - liens de communication : chaque RJ45 numérotée (prise ↔ port du bandeau de brassage), code couleur « B » — DOC-03 ;
// - autocontrôle : ce qu'Oktéo vérifie sur le plan (R / NR) et ce qui se vérifie sur le chantier (case vide) — DOC-04 ;
// la version de la norme du chantier figure sur chaque document (DOC-05).
import { refOf } from "./nfc15100.js";

export const FONCTION = { eclairage: "Éclairage", prises: "Prises", cuisine: "Prises cuisine", specialise: "Spécialisé", volets: "Volets roulants", comm: "Communication" };
const uniq = (L) => [...new Set(L.filter(Boolean))];
const sec = (v) => (v == null ? "" : String(v).replace(".", ",") + " mm²");

// locaux desservis par un circuit (noms des pièces de ses appareils, dans l'ordre)
export function locauxOf(c, byId) {
  return uniq((c.apps || []).map((id) => { const a = byId.get(id); return a ? a.room || (a.lvName ? `${a.lvName} (hors pièce)` : null) : null; }));
}
export function fonctionOf(c) {
  const f = FONCTION[c.kind] || "Circuit";
  const what = c.kind === "specialise" ? String(c.label || c.name || "").replace(/\s*[·-].*$/, "").trim() : "";
  return what && what.toLowerCase() !== "specialise" ? `${f} — ${what}` : f;
}
// schéma unifilaire : T = tableau {rows}, C = circuits, apps = okteo.allApps()
export function unifilaire(T, C, apps) {
  const byN = new Map((C || []).map((c) => [c.n, c])), byId = new Map((apps || []).map((a) => [a.id, a])), out = [];
  let cur = null;
  for (const row of (T && T.rows) || []) for (const it of row) {
    if (it.k === "id") { cur = { id: `ID ${it.a} A type ${it.type} 30 mA`, type: it.type, a: it.a, circuits: [] }; out.push(cur); }
    else if (it.k === "cb") {
      const c = byN.get(it.c), line = { n: it.c, a: it.a, section: c ? c.section : null, fonction: c ? fonctionOf(c) : "", locaux: c ? locauxOf(c, byId) : [], points: c ? (c.apps || []).length : 0 };
      if (!cur) { cur = { id: "Sans différentiel (à corriger)", type: null, a: null, circuits: [] }; out.push(cur); }
      cur.circuits.push(line);
    }
  }
  return out;
}
// étiquettes de repérage (une par circuit avec disjoncteur, + communication)
export function reperage(T, C, apps) {
  return unifilaire(T, C, apps).flatMap((g) => g.circuits.map((l) => ({ n: l.n, titre: `${l.n} · ${l.a} A${l.section ? " · " + sec(l.section) : ""}`, fonction: l.fonction, locaux: l.locaux.join(", ") || "—" })));
}
// liens de communication : RJ45 dans l'ordre (niveau, pièce, repère) → RJ1, RJ2… = port du bandeau de brassage
export function liensCom(apps) {
  const L = (apps || []).filter((a) => a.t === "RJ45").slice().sort((p, q) => String(p.lvName || p.lv || "").localeCompare(String(q.lvName || q.lv || ""), "fr") || String(p.room || "").localeCompare(String(q.room || ""), "fr") || String(p.rep || "").localeCompare(String(q.rep || ""), "fr", { numeric: true }));
  return L.map((a, i) => ({ port: `RJ${i + 1}`, rep: a.rep || "", room: a.room || "—", niveau: a.lvName || "", id: a.id }));
}

// fiche d'autocontrôle : ctx = {pieces (issues n° 2), circuits (checkCircuits().issues), tableau (tableauIssues),
// sdb (contrôle « sdb »), hasTableau, v} → [{groupe, code, ref, libelle, etat: "R"|"NR"|"SO"|"", note}]
export function autocontrole(ctx = {}) {
  const v = ctx.v || "2024", out = [];
  const add = (groupe, code, libelle, etat, note = "") => out.push({ groupe, code, ref: refOf(code, v), libelle, etat, note });
  const P = ctx.pieces || [], CI = ctx.circuits || [], TB = ctx.tableau || [], SD = ctx.sdb || [], hasT = !!ctx.hasTableau;
  const n = (L, re) => L.filter((x) => re.test(typeof x === "string" ? x : `${x.code || ""} ${x.msg || ""}`)).length;
  const st = (k, ok = true) => (!ok ? "SO" : k ? "NR" : "R");
  const pc = P.filter((i) => /^PC-/.test(i.code)), ecl = P.filter((i) => i.code === "ECL-01"), com = P.filter((i) => /^COM-/.test(i.code));
  // vérifié sur le plan par Oktéo
  add("Vérifié sur le plan (Oktéo)", "PC-01", "Nombre de prises par pièce (chambre, séjour, cuisine, autres pièces)", st(pc.length), pc.length ? `${pc.length} point(s) sous le minimum` : "");
  add("Vérifié sur le plan (Oktéo)", "ECL-01", "Un point d'éclairage par pièce principale, de service et dégagement", st(ecl.length), ecl.length ? `${ecl.length} pièce(s) sans point d'éclairage` : "");
  add("Vérifié sur le plan (Oktéo)", "COM-01", "Prises RJ45 (séjour et autres pièces principales), près d'une prise 16 A", st(com.length), com.length ? `${com.length} point(s)` : "");
  add("Vérifié sur le plan (Oktéo)", "CIR-01", "Prises 16 A par circuit (8 en 1,5 mm², 12 en 2,5 mm²)", st(n(CI, /CIR-01/), !!(CI.length || hasT)));
  add("Vérifié sur le plan (Oktéo)", "CIR-02", "Points d'éclairage par circuit (8 au plus)", st(n(CI, /CIR-02/), !!(CI.length || hasT)));
  add("Vérifié sur le plan (Oktéo)", "CIR-04", "Prises de cuisine : circuit dédié en 2,5 mm², 6 au plus", st(n(CI, /CIR-04/), !!(CI.length || hasT)));
  add("Vérifié sur le plan (Oktéo)", "CIR-05", "Circuits spécialisés (4 au moins : cuisson + 3)", st(n(TB, /R-134|CIR-05/), hasT));
  add("Vérifié sur le plan (Oktéo)", "CIR-09", "Disjoncteur adapté à la section de chaque circuit (tableau 10-1F)", st(n(CI, /CIR-09/) + n(TB, /R-129 \(tableau|R-130/), hasT));
  add("Vérifié sur le plan (Oktéo)", "TAB-03", "Différentiels 30 mA : 2 au moins, 8 circuits au plus chacun, éclairage et prises sous 2", st(n(TB, /TAB-03|R-119|R-123|aucun interrupteur différentiel/), hasT));
  add("Vérifié sur le plan (Oktéo)", "TAB-04", "Type des différentiels (A cuisson et lave-linge ; F appareils à variateur)", st(n(TB, /TAB-04|type A\./), hasT));
  add("Vérifié sur le plan (Oktéo)", "TAB-05", "Calibre des différentiels", st(n(TB, /TAB-05|R-124/), hasT));
  add("Vérifié sur le plan (Oktéo)", "TAB-01", "Réserve de 20 % dans le tableau", st(n(TB, /Réserve/), hasT));
  add("Vérifié sur le plan (Oktéo)", "IRVE-01", "Recharge de véhicule : circuit et différentiel propres à chaque point", st(n(TB, /IRVE-01/), hasT));
  add("Vérifié sur le plan (Oktéo)", "CIR-10", "Circuits extérieurs sous un différentiel distinct", st(n(TB, /CIR-10/), hasT));
  add("Vérifié sur le plan (Oktéo)", "SDE-07", "Salle d'eau : rien d'interdit dans les volumes 0, 1, 2", st(SD.length), SD.length ? `${SD.length} appareil(s) signalé(s)` : "");
  add("Vérifié sur le plan (Oktéo)", "GTL-03", "Emplacement du tableau (ni salle d'eau, ni placard, ni sous un escalier)", st(n(TB, /R-105|GTL-03/), hasT));
  add("Vérifié sur le plan (Oktéo)", "DOC-01", "Repérage des circuits au tableau (local et fonction)", hasT ? "R" : "SO", hasT ? "étiquettes jointes" : "");
  add("Vérifié sur le plan (Oktéo)", "DOC-02", "Schéma unifilaire remis à l'usager", hasT ? "R" : "SO", hasT ? "joint" : "");
  // à vérifier sur le chantier (cases laissées vides)
  for (const [code, lib] of [
    ["SDE-16", "Prise de terre (valeur mesurée), liaison équipotentielle principale et supplémentaire"],
    ["TAB-02", "Différentiels 30 mA : essai du bouton test"],
    ["TAB-09", "Sectionnement de chaque circuit (neutre compris), fil pilote sectionné"],
    ["PC-10", "Prises à obturateurs ; appareillage fixé par vis, sans griffes"],
    ["PC-09", "Hauteur des prises (axe à 5 cm au moins, 12 cm au-delà de 20 A)"],
    ["SDE-10", "Degré de protection IP des matériels de la salle d'eau"],
    ["GTL-01", "ETEL et GTL : dimensions, distances (gaz, chaleur, eau), passage de 70 cm"],
    ["GTL-07", "Coupure d'urgence accessible (0,90 à 1,80 m)"],
    ["GTL-08", "Section des conducteurs d'alimentation du tableau"],
    ["PF-01", "Parafoudre (selon la zone et l'alimentation)"],
    ["COM-08", "Tableau de communication (DTIo, bandeau RJ45, terre)"],
  ]) add("À vérifier sur le chantier", code, lib, "", "");
  return out;
}
