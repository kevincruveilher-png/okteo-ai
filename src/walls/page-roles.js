// n° 15 (bloc D, 04/11/2026) : rôle de chaque page du dossier PDF d'un chantier, proposé par Oktéo d'après le texte de la
// page (cartouche, titres, légende) et son sens, puis validé par l'opérateur. Pur (sans DOM).
// Rôles : « niv:RDC », « niv:R+1 », « niv:R+2 », « niv:Sous-sol », « niv:Combles » (plan d'implantation d'un niveau),
// « cuisine » (plan du cuisiniste), « devis » (devis, descriptif, notice), « ignorer » (façades, coupes, plan de masse…).
// Chaque niveau prend sa page ; le plan cuisine et le devis sont joints à l'analyse IA (mode 4, contrôle croisé).
export const NIVEAUX = ["RDC", "R+1", "R+2", "Sous-sol", "Combles"];
export const ROLES = [...NIVEAUX.map((n) => "niv:" + n), "cuisine", "devis", "ignorer"];
export function roleLabel(r) {
  if (String(r).startsWith("niv:")) return "Implantation " + r.slice(4);
  return { cuisine: "Plan cuisine", devis: "Devis / descriptif", ignorer: "À ignorer" }[r] || r;
}
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
const count = (t, re) => (t.match(re) || []).length;
const W = {
  elec: /electri|implantation elec|plan elec|courant fort|appareillage|interrupteur|va[- ]et[- ]vient|point lumineux|prise de courant|prises? 16 ?a|legende|tableau (electrique|de repartition)|rj ?45/g,
  cuisine: /plan (de )?cuisine|implantation (de la )?cuisine|cuisiniste|electromenager|meubles? (haut|bas)|colonne four|plan de travail|credence|evier|plaque de cuisson|lave[- ]vaisselle|hotte/g,
  devis: /devis|descriptif|c\.?c\.?t\.?p|notice|prix|montant|total (ht|ttc)|t\.?v\.?a|quantite|designation|conditions generales|bon de commande|acompte|unitaire/g,
  ignorer: /facade|coupe [a-z]{1,2}\b|elevation|plan de masse|plan de situation|toiture|charpente|fondation|v\.?r\.?d|assainissement|perspective|cadastr|plan de reperage|insertion|terrassement/g,
};
function levelOf(t) {
  if (/sous[- ]sol/.test(t)) return "Sous-sol";
  if (/combles? amenag|\bcombles?\b/.test(t) && !/trappe (de |d'acces aux )?combles/.test(t)) return "Combles";
  if (/\br ?\+ ?2\b|2 ?(e|eme) etage|deuxieme etage/.test(t)) return "R+2";
  if (/\br ?\+ ?1\b|1 ?(er|ere) etage|premier etage|\betage\b/.test(t)) return "R+1";
  return "RDC";
}
// page = { page, text, wPt, hPt } → { role, conf (0 à 1), why, score }
export function proposeRole(p) {
  const t = norm(p.text), land = p.wPt > p.hPt, len = t.replace(/[^a-z0-9]/g, "").length;
  const s = { elec: count(t, W.elec), cuisine: count(t, W.cuisine), devis: count(t, W.devis), ignorer: count(t, W.ignorer) };
  const readable = len > 20 && /[aeiou]{1}[a-z]{2,}/.test(t) && (t.match(/\b[a-z]{4,}\b/g) || []).length >= 3;
  if (!readable) {
    // page sans texte lisible (scan, police codée) : le sens de la page seulement
    return land ? { role: "niv:RDC", conf: 0.35, why: "texte illisible ; page en paysage (un plan, en général)", score: 1 } : { role: "ignorer", conf: 0.3, why: "texte illisible ; page en portrait", score: 0 };
  }
  if (s.devis >= 3 || (!land && s.devis >= 1 && len > 1500 && s.elec < 3)) return { role: "devis", conf: s.devis >= 4 ? 0.85 : 0.6, why: `mots du devis : ${s.devis}`, score: s.devis };
  if (s.cuisine >= 2 && s.cuisine >= s.elec) return { role: "cuisine", conf: s.cuisine >= 4 ? 0.85 : 0.6, why: `mots du plan cuisine : ${s.cuisine}`, score: s.cuisine };
  if (s.ignorer >= 1 && s.elec < 2) return { role: "ignorer", conf: 0.7, why: "façade, coupe, plan de masse ou toiture", score: 0 };
  const lv = levelOf(t);
  if (s.elec >= 2 || (land && s.elec >= 1)) return { role: "niv:" + lv, conf: s.elec >= 4 ? 0.9 : 0.65, why: `plan électrique (${s.elec} indices)${lv !== "RDC" ? ", niveau « " + lv + " » écrit" : ""}`, score: 2 + s.elec };
  return land ? { role: "niv:" + lv, conf: 0.4, why: "page en paysage sans indice électrique", score: 1 } : { role: "ignorer", conf: 0.4, why: "aucun indice de plan électrique", score: 0 };
}
// toutes les pages : une seule page par niveau (la plus probable ; à égalité, la dernière en paysage, comme avant)
export function proposeRoles(pages) {
  const out = (pages || []).map((p) => ({ page: p.page, ...proposeRole(p) }));
  for (const n of NIVEAUX) {
    const L = out.filter((x) => x.role === "niv:" + n);
    if (L.length < 2) continue;
    const keep = L.slice().sort((a, b) => b.score - a.score || b.conf - a.conf || b.page - a.page)[0];
    L.filter((x) => x !== keep).forEach((x) => Object.assign(x, { role: "ignorer", conf: Math.min(x.conf, 0.4), why: `autre page proposée pour le ${n} (page ${keep.page} retenue)` }));
  }
  return out;
}
// l'opérateur donne un rôle à une page : un niveau n'a qu'une page (l'ancienne passe « à ignorer »)
export function setRole(roles, page, role) {
  return roles.map((x) => (x.page === page ? { ...x, role, conf: 1, why: "choisi par l'opérateur" } : role.startsWith("niv:") && x.role === role ? { ...x, role: "ignorer", conf: 1, why: `page ${page} choisie pour ce niveau` } : x));
}
// résumé du dossier : niveaux (dans l'ordre RDC, R+1…) avec leur page, pages du plan cuisine et du devis
export function dossierOf(roles) {
  const levels = NIVEAUX.map((n) => ({ name: n, page: (roles.find((x) => x.role === "niv:" + n) || {}).page })).filter((l) => l.page);
  const pages = (r) => roles.filter((x) => x.role === r).map((x) => x.page);
  return { levels, cuisine: pages("cuisine"), devis: pages("devis"), ignorer: pages("ignorer"), pages: roles.map(({ page, role }) => ({ page, role })) };
}
// pages à joindre à l'analyse (mode 4) : [{page, role, label}]
export function analysisPages(dossier) {
  if (!dossier || !Array.isArray(dossier.pages)) return null;
  return dossier.pages.filter((x) => x.role === "cuisine" || x.role === "devis").map((x) => ({ ...x, label: `${roleLabel(x.role)}, page ${x.page}` }));
}
