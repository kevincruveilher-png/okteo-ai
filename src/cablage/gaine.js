// Diamètre de gaine (ICTA) d'après la place que prennent les fils, comme l'explique Kévin :
// « c'est une histoire d'addition de section et de la place que ça prend dans la gaine ».
// Surface occupée = somme des surfaces des fils, isolant compris (fils rigides H07V-U) ;
// la gaine choisie est la plus petite dont la surface intérieure × remplissage max ≥ surface occupée.
// Calé sur ses exemples (remplissage 40 %) : 5 × 1,5 mm² → Ø16 ; 6 × 1,5 → Ø20 ; 4 × 1,5 + 1 × 2,5 → Ø20.

// diamètre extérieur des fils H07V-U (mm), valeurs usuelles des fabricants
export const FIL_OD = { 1.5: 3.0, 2.5: 3.6, 4: 4.2, 6: 4.8, 10: 6.1, 16: 7.2 };
// gaines ICTA : diamètre nominal → diamètre intérieur (mm)
export const GAINES = [[16, 10.7], [20, 14.1], [25, 18.3], [32, 24.3], [40, 31.2]];

const surf = (d) => Math.PI * d * d / 4;

// fils : liste des sections (mm²) ; remplissage en %
export function filsSurface(fils) { return fils.reduce((s, sec) => s + surf(FIL_OD[sec] || Math.sqrt(sec) * 2.4), 0); }
export function gaineFor(fils, remplissage = 40) {
  const need = filsSurface(fils);
  for (const [nom, di] of GAINES) if (need <= surf(di) * remplissage / 100 + 1e-9) return nom;
  return GAINES[GAINES.length - 1][0];
}
// taux de remplissage d'une gaine donnée (%) : pour l'affichage
export function tauxRemplissage(fils, nom) { const g = GAINES.find((x) => x[0] === nom); return g ? Math.round(filsSurface(fils) / surf(g[1]) * 100) : null; }

// Gaines d'alimentation d'une boîte (règle de Kévin, v33) : UNE gaine pour tous les circuits de la boîte — phase + neutre
// de chaque circuit, une seule terre (à la plus grosse section) ; on passe à une 2e gaine dès qu'il faudrait un Ø25.
// circs = [{ id, section, extra: nombre de fils en plus (télérupteur) }] → groupes de circuits, un par gaine
export function packAlim(circs, remplissage = 40, maxDiam = 25) {
  const secs = (g) => [...g.flatMap((c) => Array(2 + (c.extra || 0)).fill(c.section || 1.5)), Math.max(...g.map((c) => c.section || 1.5))];
  const groups = [];
  let cur = [];
  for (const c of circs) {
    if (cur.length && gaineFor(secs([...cur, c]), remplissage) >= maxDiam) { groups.push(cur); cur = []; }
    cur.push(c);
  }
  if (cur.length) groups.push(cur);
  return groups;
}
