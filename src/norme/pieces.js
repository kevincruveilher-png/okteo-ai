// MAJ norme n° 2 (06/11/2026, go de Kévin) : minimums par pièce de la NF C 15-100 (bible Oktéo, codes PC / ECL / COM).
// Pur (sans DOM). ALERTES SIMPLES seulement (décision de Kévin) : rien n'est bloqué, rien n'est ajouté tout seul.
// Sert aussi à la « lecture du plan avant dessin » : juste après le relevé du plan du pavillonneur, on voit ce qui est
// sous le minimum et on peut le poser en question au pavillonneur (rapport d'analyse).
//
// Entrées : rooms [{id, name, area (m²), poly [{x,y}], lv}] ; apps [{id, t, x, y, lv, pt?}] (mètres, tous niveaux).
// Sortie : [{key, code, lv, roomId, room, need, have, text, question}] ; key = « norme:CODE:pièce » (décisions, questions).
import { refOf } from "./nfc15100.js";

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const has = (n, re) => re.test(" " + n + " ");

// sorte de pièce d'après son nom (tel qu'écrit sur le plan : « CH 2 », « Séjour/Cuisine », « SdE », « Dgt »…)
export function roomKind(name) {
  const n = norm(name);
  if (!n) return "inconnue";
  if (has(n, / (placard|plac|pl) /)) return "placard";
  if (has(n, / (terrasse|porche|balcon|jardin|exterieur|auvent|pergola) /)) return "exterieur";
  const sej = has(n, / (sejour|salon|living|piece de vie|salle a manger|sam|pdv|espace de vie) /), cui = has(n, / (cuisine|cuis|kitchenette) /);
  if (sej && cui) return "sejour_cuisine";
  if (sej) return "sejour";
  if (cui) return "cuisine";
  if (has(n, / (chambre|ch|ch\d+|suite|suite parentale) /) || /^ch\s?\d/.test(n)) return "chambre";
  if (has(n, / (bureau) /)) return "bureau";
  if (has(n, / (salle de bain|salle de bains|sdb|salle d eau|sde|douche|bains) /)) return "sdb";
  if (has(n, / (wc|toilettes|toilette) /)) return "wc";
  if (has(n, / (degagement|dgt|deg|couloir|circulation|entree|hall|palier|escalier) /)) return "degagement";
  if (has(n, / (garage) /)) return "garage";
  return "service";   // cellier, buanderie, dressing, local technique…
}
export const PRINCIPALES = new Set(["sejour", "sejour_cuisine", "chambre", "bureau"]);

// prises de la norme pour un séjour de surface A (m²) : 1 par 4 m² (5 au moins) jusqu'à 28 m², 7 au moins au-delà
export const prisesSejour = (A) => (A > 28 ? 7 : Math.max(5, Math.ceil((A || 0) / 4 - 1e-9)));

const PRISE = new Set(["PC16"]);                         // prises 16 A non spécialisées (USB et induction ne comptent pas)
const LIGHT = new Set(["LUM", "APP", "SPOT", "APPE"]);
const RJ = new Set(["RJ45"]);
export function pointIn(x, y, P) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c; }
  return c;
}
const fmt = (v) => String(Math.round(v * 10) / 10).replace(".", ",");
const pl = (n, w) => `${n} ${w}${n > 1 ? "s" : ""}`;

// contrôle complet ; opts.v = version de la norme (« 2024 » | « 2015 »), opts.near = distance RJ45 → prise (m)
export function checkPieces(rooms, apps, opts = {}) {
  const v = opts.v || "2024", near = opts.near ?? 1, out = [];
  const R = (rooms || []).filter((r) => r && r.poly && r.poly.length >= 3);
  const inRoom = (r) => (apps || []).filter((a) => (a.lv ?? null) === (r.lv ?? null) && pointIn(a.x, a.y, r.poly));
  const push = (code, r, need, have, text, question) => out.push({ key: `norme:${code}:${r ? r.id : "logement"}`, code, ref: refOf(code, v), lv: r ? r.lv ?? null : null, roomId: r ? r.id : null, room: r ? r.name : "Logement", need, have, text, question });
  let principales = 0;
  const rjOther = [];
  for (const r of R) {
    const k = roomKind(r.name), A = +r.area || 0, L = inRoom(r);
    if (k === "placard" || k === "exterieur" || k === "inconnue") continue;
    if (PRINCIPALES.has(k)) principales++;
    const pc = L.filter((a) => PRISE.has(a.t)).length, lum = L.filter((a) => LIGHT.has(a.t)).length, rj = L.filter((a) => RJ.has(a.t)).length;
    // éclairage : un point dans chaque pièce principale, de service et dégagement
    if (!lum) push("ECL-01", r, 1, 0, `${r.name} : aucun point d'éclairage (1 au moins).`, `${r.name} : aucun point d'éclairage n'est dessiné ; où le place-t-on ?`);
    // prises
    let need = 0, code = null, why = "";
    if (k === "chambre") { need = 3; code = "PC-01"; why = "chambre"; }
    else if (k === "sejour") { need = prisesSejour(A); code = A > 28 ? "PC-03" : "PC-02"; why = `séjour de ${fmt(A)} m²`; }
    else if (k === "sejour_cuisine") { const S = Math.max(0, A - 8); need = prisesSejour(S) + 6; code = "PC-04"; why = `séjour ${fmt(S)} m² (${fmt(A)} m² − 8 m² de cuisine) + 6 prises de cuisine`; }
    else if (k === "cuisine") { need = A > 0 && A <= 4 ? 3 : 6; code = "PC-05"; why = A > 0 && A <= 4 ? "cuisine de 4 m² ou moins" : "cuisine"; }
    else if (A > 4 && k !== "wc") { need = 1; code = "PC-06"; why = `pièce de plus de 4 m²`; }
    if (code && A <= 0 && (k === "sejour" || k === "sejour_cuisine")) code = null;   // surface inconnue : pas de calcul
    if (code && pc < need) push(code, r, need, pc, `${r.name} : ${pl(pc, "prise")} 16 A, la norme en demande ${need} (${why}).`, `${r.name} : ${pl(pc, "prise")} 16 A sur le plan alors que la norme en demande ${need} (${why}) ; en ajoute-t-on ${need - pc} ?`);
    // cuisine : 4 prises au-dessus du plan de travail (seulement si des prises sont déjà marquées « plan de travail »)
    if ((k === "cuisine" || k === "sejour_cuisine") && need >= 6) {
      const pt = L.filter((a) => PRISE.has(a.t) && a.pt === true).length + L.filter((a) => a.t === "ILOT").length;
      if (pt > 0 && pt < 4) push("PC-05", r, 4, pt, `${r.name} : ${pl(pt, "prise")} au-dessus du plan de travail, 4 au moins.`, `${r.name} : combien de prises au-dessus du plan de travail ? ${pt} repérée${pt > 1 ? "s" : ""}, la norme en demande 4.`);
    }
    if (k === "sejour" || k === "sejour_cuisine") { if (rj < 2) push("COM-01", r, 2, rj, `${r.name} : ${pl(rj, "prise")} RJ45, il en faut 2 côte à côte près des équipements multimédia.`, `${r.name} : où poser les 2 prises RJ45 du séjour (près de l'emplacement TV / box) ?`); }
    else if (PRINCIPALES.has(k)) rjOther.push({ r, rj });
  }
  // RJ45 dans les autres pièces principales : 1 de plus (2 pièces principales) ou 2 (plus de 2)
  const needOther = principales > 2 ? 2 : principales === 2 ? 1 : 0, haveOther = rjOther.filter((x) => x.rj > 0).length;
  if (needOther && haveOther < needOther && R.length) {
    const r0 = (rjOther.find((x) => !x.rj) || {}).r || null;
    push("COM-01", null, needOther, haveOther, `Logement de ${principales} pièces principales : ${pl(haveOther, "pièce")} équipée${haveOther > 1 ? "s" : ""} d'une RJ45 en dehors du séjour, il en faut ${needOther}${r0 ? ` (par exemple ${r0.name})` : ""}.`, `RJ45 : dans quelle${needOther > 1 ? "s" : ""} pièce${needOther > 1 ? "s" : ""} en plus du séjour (${needOther} demandée${needOther > 1 ? "s" : ""}) ?`);
  }
  // toute RJ45 près d'une prise 16 A (« à proximité » : 1 m, choix du BE)
  for (const a of (apps || []).filter((x) => RJ.has(x.t))) {
    const ok = (apps || []).some((b) => PRISE.has(b.t) && (b.lv ?? null) === (a.lv ?? null) && Math.hypot(b.x - a.x, b.y - a.y) <= near);
    if (!ok) {
      const r = R.find((p) => (p.lv ?? null) === (a.lv ?? null) && pointIn(a.x, a.y, p.poly)) || null;
      out.push({ key: `norme:COM-02:${a.id}`, code: "COM-02", ref: refOf("COM-02", v), lv: a.lv ?? null, roomId: r ? r.id : null, room: r ? r.name : "—", appId: a.id, need: 1, have: 0, text: `${r ? r.name + " : " : ""}prise RJ45 sans prise 16 A à moins de ${fmt(near)} m.`, question: null });
    }
  }
  return out;
}
// questions au pavillonneur tirées du contrôle (sans doublon)
export const questionsOf = (issues) => [...new Set((issues || []).map((i) => i.question).filter(Boolean))];
