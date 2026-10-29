// Raccordement permanent uniquement pour un détecteur intégré explicitement qualifié.
export function permanentDetector(a) {
  const c = a?.commande;
  return ['LUM','APP','SPOT'].includes(a?.t) && c?.mode === 'detecteur' && c.detecteur === 'integre' && c.alimentation === 'permanente' && typeof c.preuve === 'string' && !!c.preuve.trim();
}

// Les commandes d’une chaîne de lumières comptent même si une boîte manuelle les a séparées.
export function manuallyControlledLights(items, links) {
  const byId = new Map(items.map(a=>[a.id,a])), light = id=>['LUM','APP','SPOT'].includes(byId.get(id)?.t), cmd = id=>['INT','VV','BP'].includes(byId.get(id)?.t);
  const controlled = new Set(), adj = new Map();
  const edge = (a,b) => { if(!adj.has(a))adj.set(a,[]);adj.get(a).push(b); };
  for(const l of links) {
    if(cmd(l.c)&&light(l.l))controlled.add(l.l);
    else if(light(l.c)&&cmd(l.l))controlled.add(l.c);
    else if(light(l.c)&&light(l.l)){edge(l.c,l.l);edge(l.l,l.c);}
  }
  const todo=[...controlled];
  while(todo.length)for(const id of adj.get(todo.pop())||[])if(!controlled.has(id)){controlled.add(id);todo.push(id);}
  return controlled;
}
