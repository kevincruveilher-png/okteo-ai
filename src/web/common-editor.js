// Human-readable editors over the versioned common document; raw JSON remains an advanced option.
import {esc} from '../ext/util.js';
export function mountCommonEditor(root,data,onChange){
 root.innerHTML='<label>Éditer<select id="common-kind"><option value="rules">Règles</option><option value="symbols">Symboles BE</option><option value="settings">Paramètres de câblage</option></select></label><div id="common-fields"></div>';
 const area=root.querySelector('#common-fields');
 const commit=()=>onChange(data);
 function show(){
  const kind=root.querySelector('select').value;
  if(kind==='settings'){
   area.innerHTML=Object.entries(data.settings).filter(([k,v])=>!k.startsWith('_')&&['string','number','boolean'].includes(typeof v)).map(([k,v])=>`<label>${esc(k)}<input data-setting="${esc(k)}" type="${typeof v==='boolean'?'checkbox':typeof v==='number'?'number':'text'}" ${typeof v==='boolean'?(v?'checked':''):`value="${esc(String(v))}"`}></label>`).join('');
   area.querySelectorAll('input').forEach(i=>i.onchange=()=>{const k=i.dataset.setting,t=typeof data.settings[k];data.settings[k]=t==='boolean'?i.checked:t==='number'?Number(i.value):i.value;commit();});return;
  }
  const items=kind==='rules'?data.rules.rules:data.symbols.be;
  area.innerHTML=`<label>${kind==='rules'?'Règle':'Symbole BE'}<select id="common-item">${items.map((r,i)=>`<option value="${i}">${esc(r.id)} · ${esc(r.titre||r.name)}</option>`).join('')}</select></label>${kind==='symbols'?'<button type="button" id="common-add-symbol">Ajouter une fiche BE</button>':''}<div id="common-item-fields"></div>`;
  if(kind==='symbols')area.querySelector('#common-add-symbol').onclick=()=>{data.symbols.be.push({id:'be-'+crypto.randomUUID(),origin:'be',name:'Nouveau symbole BE',type:'',image:'',rules:[],notes:'',category:'Autres',source:''});commit();show();area.querySelector('#common-item').value=String(items.length-1);edit();};
  function edit(){
   const r=items[+area.querySelector('#common-item').value],fields=area.querySelector('#common-item-fields');if(!r){fields.textContent='Aucune fiche.';return;}
   const names=kind==='rules'?[['titre','Titre'],['description','Description'],['statut','Statut'],['certitude','Certitude'],['source','Source'],['note','Note']]:[['name','Nom'],['category','Famille'],['type','Correspondance Oktéo (vide si inconnue)'],['notes','Notes'],['source','Source']];
   fields.innerHTML=names.map(([k,label])=>{const opts=k==='statut'?['active','a_valider','desactivee','brouillon','archivee']:k==='certitude'?['confirmee','supposee','inconnue']:null;return `<label>${label}${opts?`<select data-field="${k}">${opts.map(v=>`<option ${r[k]===v?'selected':''}>${v}</option>`).join('')}</select>`:`<textarea rows="${k==='description'||k==='notes'?4:2}" data-field="${k}">${esc(r[k]||'')}</textarea>`}</label>`;}).join('');
   if(kind==='symbols')fields.insertAdjacentHTML('beforeend','<label>Dessin du symbole uniquement (PNG/JPEG/WebP, 250 Ko maximum)<input id="common-image" type="file" accept="image/png,image/jpeg,image/webp"></label>');
   fields.querySelectorAll('[data-field]').forEach(i=>i.onchange=()=>{r[i.dataset.field]=i.value;commit();});
   const fi=fields.querySelector('#common-image');if(fi)fi.onchange=async()=>{const f=fi.files[0];if(!f)return;if(f.size>250000||!/^image\/(png|jpeg|webp)$/.test(f.type)){fi.setCustomValidity('Image limitée à 250 Ko');fi.reportValidity();return;}const reader=new FileReader();reader.onload=()=>{r.image=reader.result;commit();};reader.readAsDataURL(f);};
  }
  area.querySelector('#common-item').onchange=edit;edit();
 }
 root.querySelector('#common-kind').onchange=show;show();
}
