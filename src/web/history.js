const key=id=>'okteo.audit.'+id;
export function readHistory(id){try{return JSON.parse(localStorage.getItem(key(id)))||{events:[],projectId:crypto.randomUUID(),revision:0,head:null};}catch{return {events:[],projectId:crypto.randomUUID(),revision:0,head:null};}}
export function saveHistory(id,h){localStorage.setItem(key(id),JSON.stringify(h));}
export function event(id,type,change,reason=''){
 const h=readHistory(id);h.events.push({id:crypto.randomUUID(),author:globalThis.okteoSession?.user.login||'Prototype local (non authentifié)',at:new Date().toISOString(),type,change,reason});saveHistory(id,h);return h;
}
export function differences(before,after,path=''){
 if(JSON.stringify(before)===JSON.stringify(after))return [];
 if(Array.isArray(before)&&Array.isArray(after)&&[...before,...after].every(x=>x&&typeof x==='object'&&x.id)){
  const a=Object.fromEntries(before.map(x=>[x.id,x])),b=Object.fromEntries(after.map(x=>[x.id,x]));return differences(a,b,path);
 }
 if(before&&after&&typeof before==='object'&&typeof after==='object'&&!Array.isArray(before)&&!Array.isArray(after)){
  return [...new Set([...Object.keys(before),...Object.keys(after)])].flatMap(k=>differences(before[k],after[k],path+'/'+k));
 }
 return [{element:path||'/',before:before??null,after:after??null}];
}
export function recordDrawing(id,previous,current){
 const h=readHistory(id),before=h.lastDrawing||previous||{};
 const diff=differences(before,current);if(!diff.length)return;
 h.events.push({id:crypto.randomUUID(),author:globalThis.okteoSession?.user.login||'Prototype local (non authentifié)',at:new Date().toISOString(),type:'dessin',change:diff});h.lastDrawing=current;saveHistory(id,h);
}
export function recordInitial(id,raw,context){const h=readHistory(id);const item={at:new Date().toISOString(),author:globalThis.okteoSession?.user.login||'Prototype local',raw,context};(h.analyses||=[]).push(item);saveHistory(id,h);}
export function revisionLabel(revision,date=new Date()){
 const parts=new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date);const get=t=>parts.find(p=>p.type===t).value;
 return `R${String(revision).padStart(3,'0')}_${get('year')}-${get('month')}-${get('day')}_${get('hour')}h${get('minute')}m${get('second')}`;
}
