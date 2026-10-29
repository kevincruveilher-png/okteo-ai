// Réseau aéraulique : distinct du câblage électrique, aucune toiture déduite du plan de niveau.
import {labelPoint,pointInPoly} from '../walls/rooms.js';
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const point=r=>labelPoint(r.poly);
const pending=motif=>({etat:'a_preciser',origine:'vmc',motif});
export function proposeVmc({items,rooms,level,frame,network={},vmcCablee=false}){
 const adds=[], ducts=structuredClone(network.ducts||[]);
 const add=(t,p,motif)=>{const id='new-'+adds.length;adds.push({...p,t,id,aiOrigin:'regle',implantation:pending(motif)});return adds.at(-1);};
 const usable=rooms.filter(r=>r.poly?.length>2), garage=usable.find(r=>/garage/.test(norm(r.name))),hatch=items.find(a=>/trappe/.test(norm(a.inscription))),deg=usable.find(r=>/degagement|couloir|dgt/.test(norm(r.name)));
 let pos=hatch?{x:hatch.x+.45,y:hatch.y,lv:hatch.lv}:deg?{...point(deg),lv:deg.lv}:{x:(frame.x0+frame.x1)/2,y:(frame.y0+frame.y1)/2,lv:level};
 if(!hatch&&!deg&&garage){const p=point(garage);pos={x:Math.max(...garage.poly.map(p=>p.x))+.6,y:p.y,lv:garage.lv};}
 if(garage&&pos.lv===garage.lv&&pointInPoly(pos.x,pos.y,garage.poly))pos.x=Math.max(...garage.poly.map(p=>p.x))+.6;
 const group=items.find(a=>a.id===network.groupId&&(a.t==='VMCG'||vmcCablee&&a.t==='VMC'))||items.find(a=>a.t==='VMCG'||vmcCablee&&a.t==='VMC')||add('VMCG',pos,hatch?'Près de la trappe ; faîtage et position dans les combles à confirmer.':'Proposition près du dégagement ou du garage, hors garage ; faîtage à confirmer.');
 if(network.groupId && network.groupId!==group.id)for(const d of ducts)if(d.from===network.groupId)d.from=group.id;
 const boucheIds=new Set(network.boucheIds||[]);let cuisine=null;
 const targets=[];for(const [name,re] of [['WC',/\bwc\b|toilet/],['SDB',/sdb|salle.*(bain|eau)|\bsde\b/],['Cuisine',/cuisine/]]){const found=usable.filter(r=>re.test(norm(r.name)));targets.push(...(found.length?found:[{name,lv:group.lv,poly:null}]));}
 const used=new Set();for(const r of targets){
  const a=items.find(a=>!used.has(a.id)&&(a.t==='VEX'||a.t==='VMC'&&!vmcCablee)&&(r.poly?a.lv===r.lv&&pointInPoly(a.x,a.y,r.poly):a.implantation?.piece===r.name))||add('VEX',{...(r.poly?point(r):{x:group.x+(targets.indexOf(r)+1)*.55,y:group.y+1}),lv:r.lv},`Bouche ${r.name} : ${r.poly?'emplacement précis à définir':'pièce non identifiée, emplacement à définir'}.`);
  used.add(a.id);if(adds.includes(a))a.implantation.piece=r.name;
  boucheIds.add(a.id);if(/cuisine/.test(norm(r.name)))cuisine=a;
  if(!ducts.some(d=>d.kind==='extraction'&&d.to===a.id))ducts.push({id:'extraction-'+a.id,kind:'extraction',from:group.id,to:a.id,via:[],fromZ:null,toZ:null});
 }
 let command=items.find(a=>a.id===network.commandId&&a.t==='CVMC')||items.find(a=>a.t==='CVMC');
 if(!command)command=add('CVMC',cuisine?{x:cuisine.x+.5,y:cuisine.y,lv:cuisine.lv}:{x:group.x+.5,y:group.y,lv:group.lv},'Commande cuisine associée à la bouche cuisine ; implantation et raccordement à confirmer.');
 if(!ducts.some(d=>d.kind==='rejet')){const out=items.find(a=>a.t==='VREJ')||add('VREJ',{x:group.x+1,y:group.y,lv:group.lv},'Sortie de toiture proposée ; emplacement et altitude à préciser.');ducts.push({id:'rejet-'+out.id,kind:'rejet',from:group.id,to:out.id,via:[],fromZ:null,toZ:null});}
 return {adds,network:{...network,groupId:group.id,commandId:command.id,cuisineId:cuisine?.id||network.cuisineId||null,boucheIds:[...boucheIds],ducts,visible:network.visible!==false}};
}
export function ductPath(d,items){
 const by=new Map(items.map(a=>[a.id,a])),a=by.get(d.from),b=by.get(d.to);if(!a||!b)return [];
 return [{x:a.x,y:a.y,z:d.fromZ,lv:a.lv},...(d.via||[]),{x:b.x,y:b.y,z:d.toZ,lv:b.lv}];
}
export function ductReport(d,items){
 const path=ductPath(d,items);if(!path.length)return {length:null,status:'bloque',text:'Extrémité supprimée ou non associée.'};
 const precise=path.every(p=>Number.isFinite(p.z)),crossLevel=new Set(path.filter(p=>p.lv).map(p=>p.lv)).size>1;
 let length=0;for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i];length+=Math.hypot(b.x-a.x,b.y-a.y,precise?b.z-a.z:0);}
 const over=d.kind==='rejet'&&length>3+1e-9;
 const placed=items.filter(a=>[d.from,d.to].includes(a.id)).every(a=>a.implantation?.etat!=='a_preciser');
 return {length,status:over?'bloque':precise&&placed?'ok':'a_preciser',text:over?'Rejet supérieur à 3 m : modifier le parcours.':!precise?`Longueur minimale en plan ; altitudes ${crossLevel?'entre niveaux ':''}à préciser.`:!placed?'Implantation des extrémités à confirmer.':'Parcours renseigné, à valider avec le BE.'};
}
export function validateDucts(ducts,items){
 if(!Array.isArray(ducts)||ducts.length>200)throw Error('Liste de gaines VMC invalide.');
 const ids=new Set(),apps=new Set(items.map(a=>a.id));
 for(const d of ducts){if(!d.id||ids.has(d.id)||!['extraction','rejet'].includes(d.kind)||!apps.has(d.from)||!apps.has(d.to)||d.from===d.to||!Array.isArray(d.via)||d.via.length>200||d.via.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.z!=null&&!Number.isFinite(p.z))||[d.fromZ,d.toZ].some(z=>z!=null&&!Number.isFinite(z)))throw Error('Gaine VMC invalide : extrémités, points ou altitudes à vérifier.');ids.add(d.id);}
 return structuredClone(ducts);
}
