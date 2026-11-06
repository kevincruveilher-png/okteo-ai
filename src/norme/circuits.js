// MAJ norme n° 4 (06/11/2026, go de Kévin) : plafonds de la NF C 15-100 par circuit (bible CIR-01 à CIR-04, tableau 10-1F).
// Pur (sans DOM). Alertes simples. Les réglages de Paramètres → Câblage (maxPrises, maxPoints…) peuvent être plus stricts
// que la norme, jamais plus larges : au-delà, chaque circuit concerné est signalé avec le code de la règle.
// Le pontage (n° 6) ne relie que des appareils d'un même circuit et jamais un circuit spécialisé : il respecte donc ces
// plafonds dès que le circuit les respecte.
const LIGHT = new Set(["LUM", "APP", "SPOT", "APPE"]);
// plafonds de la norme (prises 16 A selon la section ; points d'éclairage ; prises de cuisine)
export const NORME = { pointsMax: 8, prises15: 8, prises25: 12, cuisineMax: 6, cuisineSection: 2.5 };
export const prisesMax = (section) => (section >= 2.5 ? NORME.prises25 : NORME.prises15);
// disjoncteur maximal pour une section (tableau 10-1F), par nature de circuit
export function protMax(kind, section, t) {
  const s = +section || 0;
  if (kind === "eclairage") return s >= 1.5 ? 16 : null;
  if (kind === "prises") return s >= 2.5 ? 20 : s >= 1.5 ? 16 : null;
  if (kind === "cuisine") return s >= 2.5 ? 20 : null;
  if (kind === "volets") return s >= 1.5 ? 16 : null;
  if (kind === "specialise") {
    if (t === "PLAQ" || t === "PC32") return s >= 6 ? 32 : s >= 2.5 ? 20 : null;   // cuisson : 6 mm² / 32 A (mono)
    return s >= 10 ? 40 : s >= 6 ? 32 : s >= 4 ? 25 : s >= 2.5 ? 20 : s >= 1.5 ? 16 : null;   // 10 mm² / 40 A : borne de recharge 32 A
  }
  return undefined;   // courant faible, lignes sans disjoncteur : rien à contrôler
}
// circuits [{id, n, kind, apps, section, prot}] ; items [{id, t}] → [{c, code, msg}]
export function normeCircuits(circuits, items) {
  const typeOf = new Map((items || []).map((a) => [a.id, a.t])), out = [];
  const lights = (c) => c.apps.filter((id) => LIGHT.has(typeOf.get(id))).length, prises = (c) => c.apps.filter((id) => typeOf.get(id) === "PC16").length;
  for (const c of circuits || []) {
    if (c.kind === "eclairage" && lights(c) > NORME.pointsMax) out.push({ c: c.id, code: "CIR-02", msg: `CIR-02 · ${c.n} : ${lights(c)} points d'éclairage, la norme en admet ${NORME.pointsMax} par circuit` });
    if (c.kind === "prises" && prises(c) > prisesMax(c.section)) out.push({ c: c.id, code: "CIR-01", msg: `CIR-01 · ${c.n} : ${prises(c)} prises 16 A en ${String(c.section ?? "?").replace(".", ",")} mm², la norme en admet ${prisesMax(c.section)}` });
    if (c.kind === "cuisine") {
      if (prises(c) > NORME.cuisineMax) out.push({ c: c.id, code: "CIR-04", msg: `CIR-04 · ${c.n} : ${prises(c)} prises de cuisine sur un circuit, la norme en admet ${NORME.cuisineMax}` });
      if (c.section != null && +c.section < NORME.cuisineSection) out.push({ c: c.id, code: "CIR-04", msg: `CIR-04 · ${c.n} : prises de cuisine en ${String(c.section).replace(".", ",")} mm², la norme demande 2,5 mm²` });
    }
    if (c.prot != null && c.section != null) {
      const t = typeOf.get(c.apps[0]), m = protMax(c.kind, c.section, t);
      if (m === null) out.push({ c: c.id, code: "CIR-09", msg: `Tableau 10-1F · ${c.n} : section de ${String(c.section).replace(".", ",")} mm² trop petite pour ce circuit` });
      else if (m !== undefined && +c.prot > m) out.push({ c: c.id, code: "CIR-09", msg: `Tableau 10-1F · ${c.n} : disjoncteur ${c.prot} A sur ${String(c.section).replace(".", ",")} mm² (${m} A au plus)` });
    }
  }
  // deux circuits d'éclairage au moins (un seul admis pour un logement d'une seule pièce principale)
  const ecl = (circuits || []).filter((c) => c.kind === "eclairage" && lights(c) > 0);
  const nl = ecl.reduce((s, c) => s + lights(c), 0);
  if (ecl.length === 1 && nl >= 4) out.push({ c: ecl[0].id, code: "CIR-03", msg: `CIR-03 · un seul circuit d'éclairage pour ${nl} points : la norme en demande 2 (sauf logement d'une seule pièce principale)` });
  return out;
}
// réglages de Paramètres → Câblage plus larges que la norme : [{champ, code, msg}]
export function normeSettings(S) {
  const out = [];
  if ((+S.maxPoints || 0) > NORME.pointsMax) out.push({ champ: "maxPoints", code: "CIR-02", msg: `CIR-02 · ${S.maxPoints} points d'éclairage par circuit : la norme en admet ${NORME.pointsMax}` });
  if ((+S.maxPrises || 0) > prisesMax(S.secPrises)) out.push({ champ: "maxPrises", code: "CIR-01", msg: `CIR-01 · ${S.maxPrises} prises par circuit en ${String(S.secPrises).replace(".", ",")} mm² : la norme en admet ${prisesMax(S.secPrises)}` });
  if ((+S.maxPrisesCuisine || 0) > NORME.cuisineMax) out.push({ champ: "maxPrisesCuisine", code: "CIR-04", msg: `CIR-04 · ${S.maxPrisesCuisine} prises de cuisine par circuit : la norme en admet ${NORME.cuisineMax}` });
  if (S.secCuisine != null && +S.secCuisine < NORME.cuisineSection) out.push({ champ: "secCuisine", code: "CIR-04", msg: `CIR-04 · prises de cuisine en ${String(S.secCuisine).replace(".", ",")} mm² : la norme demande 2,5 mm²` });
  return out;
}
