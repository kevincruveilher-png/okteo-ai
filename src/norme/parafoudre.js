// MAJ parafoudre (06/11/2026, go de Kévin) — pur, sans DOM.
// Besoin d'un parafoudre selon la NF C 15-100 (alerte simple, jamais bloquante) ; le BE peut toujours passer outre, et
// son choix est gardé (qui / quand / étude initiale) pour le rapport « étude initiale / modifications humaines ».
// Données : niveau kéraunique Nk par département, relevé sur la carte de l'annexe 10A de la NF C 15-100-10 (2024)
// (valeurs seules, aucun texte de la norme). Densité de foudroiement Ng = Nk / 10. Nk > 25 = zone AQ2.
// Val-d'Oise : valeur non imprimée sur la carte (zone AQ1, comme ses voisins à 15).
import { refOf } from "./nfc15100.js";

export const NK = {
  "01": 32, "02": 15, "03": 21, "04": 44, "05": 39, "06": 39, "07": 44, "08": 15, "09": 21, "10": 19,
  "11": 19, "12": 24, "13": 27, "14": 9, "15": 25, "16": 21, "17": 18, "18": 17, "19": 25, "2A": 32,
  "2B": 31, "21": 24, "22": 8, "23": 23, "24": 27, "25": 28, "26": 42, "27": 12, "28": 14, "29": 6,
  "30": 36, "31": 19, "32": 21, "33": 26, "34": 27, "35": 10, "36": 17, "37": 14, "38": 35, "39": 30,
  "40": 28, "41": 12, "42": 30, "43": 34, "44": 8, "45": 17, "46": 23, "47": 28, "48": 33, "49": 12,
  "50": 7, "51": 18, "52": 23, "53": 12, "54": 19, "55": 18, "56": 7, "57": 18, "58": 20, "59": 13,
  "60": 15, "61": 13, "62": 12, "63": 26, "64": 24, "65": 21, "66": 27, "67": 20, "68": 23, "69": 31,
  "70": 22, "71": 27, "72": 13, "73": 31, "74": 33, "75": 15, "76": 12, "77": 17, "78": 15, "79": 13,
  "80": 13, "81": 21, "82": 21, "83": 34, "84": 40, "85": 10, "86": 20, "87": 23, "88": 22, "89": 19,
  "90": 23, "91": 15, "92": 15, "93": 15, "94": 15, "95": 15,
  "971": 31, "972": 26.75, "973": 33.75, "974": 10, "975": 5, "976": 39.8, "987": 31.25, "988": 7.9,
};
export const NK_SEUIL = 25;

// département d'après un code postal (ou un n° de département saisi tel quel : « 69 », « 2A », « 974 »)
export function depOf(cp) {
  const s = String(cp || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!s) return "";
  if (/^2[AB]$/.test(s)) return s;
  if (/^\d{1,2}$/.test(s)) return s.padStart(2, "0");
  if (/^9[78]\d$/.test(s)) return s;
  if (!/^\d{5}$/.test(s)) return "";
  if (/^9[78]/.test(s)) return s.slice(0, 3);
  if (s.startsWith("20")) return +s < 20200 ? "2A" : "2B";
  return s.slice(0, 2);
}
export function nkOf(cp) { const d = depOf(cp); return d && NK[d] != null ? { dep: d, nk: NK[d], aq2: NK[d] > NK_SEUIL } : null; }

// choix du chantier (cab.choix.parafoudre) : arrivee "aerien" | "souterrain" | "" ; paratonnerre (sur le bâtiment ou à
// moins de 50 m) ; securite (matériel médical à domicile, alarme liée à la sécurité des personnes) ; comCuivre (arrivée
// de la communication en cuivre : vrai par défaut) ; be "auto" | "oui" | "non" (choix du BE) + by, at, initial, motif
export const PF_DEFAULT = { arrivee: "", paratonnerre: false, securite: false, comCuivre: true, be: "auto" };

// étude : meta = fiche du chantier ({cp, permis}), choix = cab.choix.parafoudre, v = version de la norme
export function etudeParafoudre(meta = {}, choix = {}, v = "2024") {
  const C = { ...PF_DEFAULT, ...(choix || {}) }, Z = nkOf(meta.cp), raisons = [], manque = [];
  let etat = "non", type = 2;
  if (C.paratonnerre) { etat = "obligatoire"; type = 1; raisons.push("paratonnerre sur le bâtiment ou à moins de 50 m (type 1)"); }
  if (!Z) manque.push("code postal du chantier (fiche du chantier)");
  if (!C.arrivee && !(Z && !Z.aq2)) manque.push("arrivée du réseau électrique (aérienne ou souterraine)");
  if (Z && Z.aq2) {
    if (C.arrivee === "aerien") { etat = "obligatoire"; raisons.push(`ligne aérienne en zone AQ2 (Nk ${Z.nk} > 25)`); }
    if (C.securite) { etat = "obligatoire"; raisons.push(`sécurité des personnes en jeu en zone AQ2 (Nk ${Z.nk} > 25)`); }
  } else if (Z && etat !== "obligatoire") {
    if (C.securite) { etat = "recommande"; raisons.push(`sécurité des personnes en jeu (Nk ${Z.nk} ≤ 25 : analyse de risque)`); }
  }
  if (etat === "non" && Z && Z.aq2 && C.arrivee === "souterrain") raisons.push(`zone AQ2 (Nk ${Z.nk}) mais ligne souterraine : non obligatoire`);
  if (etat === "non" && Z && !Z.aq2) raisons.push(`zone AQ1 (Nk ${Z.nk} ≤ 25) : non obligatoire`);
  // sans assez de données : « à préciser », sauf si un cas d'obligation est déjà certain
  if (etat === "non" && manque.length && !(Z && !Z.aq2 && !C.securite)) etat = "inconnu";
  const auto = etat === "obligatoire";
  const avec = C.be === "oui" ? true : C.be === "non" ? false : auto;
  const ecart = C.be !== "auto" && avec !== auto;
  return {
    v, zone: Z, choix: C, etat, type, raisons, manque, auto, avec, ecart,
    com: avec && C.comCuivre && v === "2024",           // PF-03 (2024) : parafoudre de communication
    distance: v === "2024" ? 10 : 30,                    // PF-02 : parafoudre complémentaire au-delà
    ref: refOf("PF-01", v),
    texte: etatTexte(etat, type),
  };
}
export function etatTexte(etat, type = 2) {
  return etat === "obligatoire" ? `Parafoudre obligatoire (type ${type})` : etat === "recommande" ? "Parafoudre recommandé (analyse de risque)" : etat === "inconnu" ? "Parafoudre : données à préciser" : "Parafoudre non obligatoire";
}

// tableau : ajoute (ou retire) le parafoudre et son disjoncteur en tête de la 1re rangée, en amont des différentiels
// (PF-04 : jamais sous un 30 mA). Seuls les éléments posés automatiquement (auto) sont retirés.
export function withParafoudre(rows, on, type = 2) {
  const R = (rows || []).map((r) => [...r]), has = R.flat().some((x) => x.k === "mod" && (x.t === "pf" || x.t === "pf1"));
  if (on && !has) {
    const t = type === 1 ? "pf1" : "pf", n = Date.now().toString(36);
    const add = [{ k: "mod", t, id: `m${n}pf`, w: 2, label: "", auto: true }, { k: "mod", t: "pfd", id: `m${n}pd`, w: 1, label: "", auto: true }];
    if (!R.length) R.push([]);
    R[0] = [...add, ...R[0]];
  }
  if (!on) return R.map((r) => r.filter((x) => !(x.k === "mod" && x.auto && ["pf", "pf1", "pfd"].includes(x.t))));
  return R;
}

// alertes du tableau (préfixées par le code de la bible) ; ctx.pf = etudeParafoudre(...), ctx.tabs = autres tableaux
// [{d (m depuis le tableau principal), name}]
export function parafoudreIssues(tab, pf, ctx = {}) {
  if (!pf) return [];
  const out = [], items = (tab.rows || []).flat(), pfIt = items.filter((x) => x.k === "mod" && (x.t === "pf" || x.t === "pf1"));
  if (pf.avec && !pfIt.length) out.push(`PF-01 : ${pf.choix.be === "oui" ? "parafoudre voulu par le BE" : pf.texte.toLowerCase()} (${pf.raisons.join(" ; ")}) : à ajouter au tableau.`);
  if (pf.avec && pfIt.length && !items.some((x) => x.k === "mod" && x.t === "pfd")) out.push("PF-01 : disjoncteur de déconnexion du parafoudre à ajouter.");
  if (pf.avec && pf.type === 1 && pfIt.length && !pfIt.some((x) => x.t === "pf1")) out.push("PF-01 : paratonnerre : parafoudre de type 1 (Iimp ≥ 12,5 kA).");
  // PF-04 : un parafoudre placé à droite d'un différentiel est protégé par lui (30 mA) : à mettre en tête de rangée
  for (const r of tab.rows || []) { let cur = null; for (const it of r) { if (it.k === "id") cur = it; else if (cur && it.k === "mod" && (it.t === "pf" || it.t === "pf1")) { out.push("PF-04 : parafoudre en aval d'un différentiel 30 mA : à placer en tête (différentiel de type S en amont s'il en faut un)."); break; } } }
  if (pf.avec) for (const t of ctx.tabs || []) if (t.d == null || t.d > pf.distance) out.push(`PF-02 : ${t.name || "tableau divisionnaire"} à ${t.d == null ? "un autre niveau" : Math.round(t.d) + " m"} du parafoudre (plus de ${pf.distance} m) : parafoudre complémentaire à prévoir.`);
  if (pf.com) out.push("PF-03 : parafoudre de communication à prévoir (arrivée en cuivre, puissance protégée) : tableau de communication.");
  return out;
}

// ligne du rapport « étude initiale / modifications humaines »
export function ecartParafoudre(pf) {
  if (!pf || !pf.ecart) return null;
  const C = pf.choix;
  return { sujet: "Parafoudre", code: "PF-01", initial: `${pf.texte}${pf.raisons.length ? " — " + pf.raisons.join(" ; ") : ""}`, choix: C.be === "oui" ? "parafoudre ajouté par le BE" : "parafoudre retiré par le BE", motif: C.motif || "", by: C.by || "", at: C.at || "" };
}
