// Géométrie de présentation uniquement : aucune modification des trajets métier.
export function arrowPoints(a, target, length) {
  let dx = (target?.x ?? a.x - 1) - a.x, dy = (target?.y ?? a.y + 1) - a.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-9) { dx = -1; dy = 1; }
  const n = Math.hypot(dx,dy); dx /= n; dy /= n;
  const b = {x:a.x+dx*length,y:a.y+dy*length}, h=length*.22, w=length*.1;
  return [a,b,{x:b.x-dx*h-dy*w,y:b.y-dy*h+dx*w},{x:b.x-dx*h+dy*w,y:b.y-dy*h-dx*w}];
}

export function hatchLines(poly, step) {
  const vals=poly.map(p=>p.x+p.y), out=[];
  for(let v=Math.ceil(Math.min(...vals)/step)*step;v<Math.max(...vals);v+=step){
    const hits=[];
    poly.forEach((a,i)=>{const b=poly[(i+1)%poly.length], va=a.x+a.y,vb=b.x+b.y;
      if((va<=v&&vb>v)||(vb<=v&&va>v)){const t=(v-va)/(vb-va);hits.push({x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)});}
    });
    hits.sort((a,b)=>a.x-b.x);
    for(let i=0;i+1<hits.length;i+=2) out.push([hits[i],hits[i+1]]);
  }
  return out;
}

// v74 MAJ 2 : dessin d'un mur selon son type et le style du bâti du chantier (écran et impression)
// maçonnerie : hachures (fond blanc + traits à 45°) ou gris plein ; cloison : plein foncé ; doublage : fond blanc + ondulation
export const WALL_GREY = "#9A9A9A", WALL_DARK = "#202020";
export function wallLook(mat, style = "hachures") {
  if (mat === "maconnerie") return style === "gris" ? { fill: WALL_GREY, hatch: false, wave: false } : { fill: "#FFFFFF", hatch: true, wave: false };
  if (mat === "doublage") return { fill: "#FFFFFF", hatch: false, wave: true };
  return { fill: WALL_DARK, hatch: false, wave: false };
}
// ondulation de l'isolant le long de l'axe a→b d'un mur d'épaisseur e (points en mètres)
export function wavePoints(a, b, e) {
  const L = Math.hypot(b.x - a.x, b.y - a.y);
  if (L < 1e-6) return [];
  const ux = (b.x - a.x) / L, uy = (b.y - a.y) / L, nx = -uy, ny = ux, amp = e * 0.36;
  const n = Math.max(2, Math.round(L / Math.max(0.04, e * 0.8))) * 2, out = [];
  for (let i = 0; i <= n * 4; i++) {
    const t = i / (n * 4), s = Math.sin(t * n * Math.PI) * amp;
    out.push({ x: a.x + ux * L * t + nx * s, y: a.y + uy * L * t + ny * s });
  }
  return out;
}
