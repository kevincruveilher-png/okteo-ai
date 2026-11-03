// 3D-6 : contrôles de pose (pur, sans DOM) : ce que la 3D rend visible et que le plan cache.
// - battant : une commande derrière le battant d'une porte ouverte (côté paumelles, face où la porte s'ouvre) ;
// - embrasure : un appareil mural dans le tableau d'une ouverture (dans la largeur ET la hauteur du vide) ;
// - hauteur : commande hors 0,90–1,30 m ou prise sous 0,40 m en logement accessible (R-110, valeurs prudentes) ;
//   hors PMR, seules les hauteurs de commande invraisemblables (sous 0,60 m ou au-dessus de 1,60 m) sont signalées.
// Données : plan en mètres { nodes [{id,x,y}], segs [{id,a,b,ep,virt}], openings [{id,seg,t (m depuis a),w,kind,hinge,swing,
// allege?,linteau? (m)}] } ; apps [{id,t,x,y,h (cm, déjà par défaut)}] ; opts { pmr, H (hauteurs de départ en m) }.
// Conventions du dessin (comme render.js et plan3d.js) : swing "ext" = côté de la normale (-uy, ux) du mur, hinge "d" =
// charnière vers le bout b du mur.

export const POSE_KINDS = {
  battant: "Commande derrière le battant d'une porte",
  embrasure: "Appareil dans le tableau d'une ouverture",
  hauteur: "Hauteur de pose hors règle",
};
export const CMD_T = new Set(["INT", "VV", "BP", "CVR", "ICOUP", "CVMC", "BPS"]);
// prises d'usage (les sorties dédiées derrière un appareil ne sont pas concernées)
const PRISE_T = new Set(["PC16", "PC20", "RJ45", "TV"]);
const PLAFOND = new Set(["LUM", "SPOT", "DCL", "VMC", "BOUCHE", "DET", "DETECT", "PLAF", "HP"]);
const hyp = Math.hypot;
const num = (v) => typeof v === "number" && Number.isFinite(v);
const cmf = (m) => String(Math.round(m * 100));

// hauteurs d'une ouverture, mêmes valeurs de départ que la 3D
function vide(o, H) {
  if (o.kind === "fenetre") return [num(o.allege) ? o.allege : H.allege, num(o.linteau) ? o.linteau : H.linteau];
  if (o.kind === "garage") return [0, num(o.linteau) ? o.linteau : H.garage];
  return [0, num(o.linteau) ? o.linteau : o.w > 1.2 ? H.baie : H.porte];
}

export function poseIssues(plan, apps, { pmr = false, H = { allege: 0.9, linteau: 2.15, porte: 2.04, baie: 2.15, garage: 2.2 } } = {}) {
  const nodes = new Map((plan.nodes || []).map((n) => [n.id, n]));
  const segs = new Map((plan.segs || []).filter((s) => !s.virt).map((s) => [s.id, s]));
  const geo = (s) => { const A = nodes.get(s.a), B = nodes.get(s.b); if (!A || !B) return null; const L = hyp(B.x - A.x, B.y - A.y); return L > 1e-6 ? { A, B, L, ux: (B.x - A.x) / L, uy: (B.y - A.y) / L, ep: s.ep > 0 ? s.ep : 0.2 } : null; };
  const out = [];
  // battants des portes (portes simples ≤ 1,20 m) : charnière sur la face d'ouverture, sens le long du mur loin du vide
  const leaves = [];
  for (const o of plan.openings || []) {
    const s = segs.get(o.seg), g = s && geo(s);
    if (!g || !num(o.t) || !(o.w > 0)) continue;
    if (o.kind === "porte" && o.w <= 1.2) {
      const side = o.swing === "ext" ? 1 : -1, hg = o.hinge === "d" ? 1 : -1, nx = -g.uy * side, ny = g.ux * side;
      const sx = g.A.x + g.ux * (o.t + hg * o.w / 2), sy = g.A.y + g.uy * (o.t + hg * o.w / 2);
      leaves.push({ o, seg: s.id, hx: sx + nx * g.ep / 2, hy: sy + ny * g.ep / 2, ux: g.ux * hg, uy: g.uy * hg, nx, ny, w: o.w });
    }
  }
  for (const a of apps || []) {
    if (!num(a.x) || !num(a.y)) continue;
    const cmd = CMD_T.has(a.t), hm = num(a.h) ? a.h / 100 : null;
    // derrière le battant : bande de la longueur du battant (+10 cm), de 25 cm de profondeur, le long de la face
    if (cmd) for (const L of leaves) {
      const px = a.x - L.hx, py = a.y - L.hy, along = px * L.ux + py * L.uy, depth = px * L.nx + py * L.ny;
      if (along > -0.03 && along < L.w + 0.1 && depth > -0.05 && depth < 0.25) {
        out.push({ kind: "battant", id: a.id, ids: [a.id, L.o.id], x: a.x, y: a.y, text: `à ${cmf(Math.max(0, along))} cm de la charnière, du côté où la porte s'ouvre : cachée par le battant ouvert. Placez-la côté poignée.` });
        break;
      }
    }
    // dans le tableau d'une ouverture de son mur
    if (a.seg && segs.has(a.seg) && hm != null && !PLAFOND.has(a.t)) {
      const g = geo(segs.get(a.seg));
      if (g) {
        const t = (a.x - g.A.x) * g.ux + (a.y - g.A.y) * g.uy;
        for (const o of plan.openings || []) {
          if (o.seg !== a.seg || !num(o.t) || !(o.w > 0)) continue;
          const [y0, y1] = vide(o, H);
          if (Math.abs(t - o.t) < o.w / 2 - 0.05 && hm > y0 + 0.02 && hm < y1 - 0.02) {
            out.push({ kind: "embrasure", id: a.id, ids: [a.id, o.id], x: a.x, y: a.y, text: `posé dans le vide d'une ${o.kind === "fenetre" ? "fenêtre" : o.kind === "garage" ? "porte de garage" : "porte"} (${cmf(o.w)} cm, de ${cmf(y0)} à ${cmf(y1)} cm du sol) : l'appareil ou l'ouverture est mal placé (à décaler d'au moins ${cmf(o.w / 2 - Math.abs(t - o.t) + 0.05)} cm).` });
            break;
          }
        }
      }
    }
    // hauteurs
    if (hm != null) {
      if (cmd && pmr && (hm < 0.9 - 1e-6 || hm > 1.3 + 1e-6)) out.push({ kind: "hauteur", id: a.id, ids: [a.id], x: a.x, y: a.y, text: `commande à ${cmf(hm)} cm : en logement accessible, entre 90 et 130 cm (R-110).` });
      else if (cmd && !pmr && (hm < 0.6 || hm > 1.6)) out.push({ kind: "hauteur", id: a.id, ids: [a.id], x: a.x, y: a.y, text: `commande à ${cmf(hm)} cm : hauteur inhabituelle (d'ordinaire 110 cm), à vérifier.` });
      else if (pmr && PRISE_T.has(a.t) && hm < 0.4 - 1e-6 && !a.pt) out.push({ kind: "hauteur", id: a.id, ids: [a.id], x: a.x, y: a.y, text: `prise à ${cmf(hm)} cm : en logement accessible, au moins 40 cm du sol.` });
    }
  }
  return out;
}
