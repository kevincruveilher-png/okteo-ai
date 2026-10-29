import {APPAREILS} from './appareils.js';
// Comparaison documentée : blocs physiques != repères BE != gaines.
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
export function validateReference(raw){
 if(!raw||!Array.isArray(raw.lignes)||raw.lignes.length>1000)throw Error('Référence attendue : {lignes:[…]}.');
 const ids=new Set(),used=new Set();
 const lignes=raw.lignes.map(r=>{if(!r.id||ids.has(r.id)||!r.type||!['plan','be','inconnue'].includes(r.source)||r.qty!=null&&(!Number.isInteger(r.qty)||r.qty<1)||!Array.isArray(r.appIds)||!Array.isArray(r.reperes)||new Set(r.appIds).size!==r.appIds.length||r.appIds.some(id=>typeof id!=='string'||used.has(id)))throw Error('Ligne invalide : id unique, source, quantité, repères et appIds sans doublon requis.');ids.add(r.id);r.appIds.forEach(id=>used.add(id));return {id:String(r.id),type:/^PC\s*EXT$/i.test(r.type)?'PC16':String(r.type),libelle:String(r.libelle||r.type),source:r.source,qty:r.qty??null,appIds:[...r.appIds],reperes:r.reperes.map(String),gaine:String(r.gaine||''),piece:String(r.piece||''),lv:String(r.lv||''),preuve:String(r.preuve||'')};});return {nom:String(raw.nom||''),lignes};
}
export function comparer(reference,items){
 return reference.lignes.map(r=>{
 const matched=r.appIds.map(id=>items.find(a=>a.id===id)),missing=matched.some(a=>!a),apps=matched.filter(Boolean),unknown=apps.some(a=>a.qty===null),qty=unknown?null:apps.reduce((s,a)=>s+(a.qty??1),0);
 let status='appariement_a_confirmer';
 if(missing)status='appariement_perdu';
 else if(r.source==='be')status='ajout_ou_modification_be';
 else if(!apps.length){const candidates=items.some(a=>a.t===r.type||a.t==='INCONNU');status=candidates?'appariement_a_confirmer':r.source==='plan'&&r.preuve.trim()&&(['PC16','PC20','RJ45','LUM','APP','SPOT','INT','VV','BP','VMC','SC','TAB'].includes(r.type)||APPAREILS[r.type])?'oubli_ia':'presence_source_a_verifier';}
 else if(apps.some(a=>a.t!==r.type))status='mal_interprete';
 else if(unknown||r.qty===null||apps.some(a=>a.aiStatus==='a_identifier'||a.aiStatus==='a_confirmer'))status='detecte_a_preciser';
 else if(qty!==r.qty)status='quantite_a_verifier';
 else status='quantite_concordante';
 return {...r,status,blocs:apps.length,qtyIA:qty,placements:apps.some(a=>a.implantation?.etat==='a_preciser')?'À préciser':'À vérifier séparément',cablage:'À vérifier séparément'};
 });
}
export const COMP_LABELS={appariement_a_confirmer:'Appariement à confirmer',appariement_perdu:'Appariement perdu',ajout_ou_modification_be:'Ajout / modification BE',oubli_ia:'Oubli IA sur source attestée',presence_source_a_verifier:'Présence sur source à vérifier',mal_interprete:'Mal interprété',detecte_a_preciser:'Détecté à préciser',quantite_a_verifier:'Quantité à vérifier',quantite_concordante:'Quantité concordante'};
export function diagnosticEtude({items,rooms,circuits}){
 const out=[];for(const a of items){if(a.t==='INCONNU')out.push(`Type à identifier : ${a.rep||a.id}`);if(a.implantation?.etat==='a_preciser')out.push(`Emplacement à préciser : ${a.rep||a.id}`);}
 const names=new Map();for(const r of rooms){const k=r.lv+':'+norm(r.name);names.set(k,(names.get(k)||0)+1);if(!norm(r.name))out.push('Pièce sans nom : affectation à vérifier.');}for(const[k,n]of names)if(n>1)out.push(`Nom de pièce répété (${n}) : ${k}. Ne pas fusionner automatiquement.`);
 const tabs=items.filter(a=>a.t==='TAB');if(!tabs.length)out.push('Tableau absent : emplacement à prévoir.');if(tabs.length>1)out.push('Plusieurs tableaux : affectation des circuits à vérifier.');
 for(const t of tabs)if(!t.room)out.push(`Tableau ${t.rep||t.id} hors pièce reconnue : vérifier le découpage, sans conclure à un mauvais emplacement.`);
 const covered=new Set(circuits.flatMap(c=>c.apps));for(const a of items.filter(a=>['FOUR','LV','LL','SL','PLAQ','VMCG'].includes(a.t)))if(!covered.has(a.id))out.push(`Circuit à prévoir : ${a.rep||a.id}.`);
 return out;
}
