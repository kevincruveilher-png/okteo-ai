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
