// Non-blocking dialogs; no native alert/confirm/prompt (tests and drawing stay responsive).
export function ask(message,{text=false,confirm=false,value=''}={}){
 return new Promise(resolve=>{const d=document.createElement('dialog');d.className='enterprise-dialog';const p=document.createElement('p');p.style.whiteSpace='pre-wrap';p.textContent=message;d.append(p);let field;
 if(text){field=document.createElement('textarea');field.rows=4;field.value=value;d.append(field);}
 const actions=document.createElement('div'),ok=document.createElement('button');ok.textContent=text?'Continuer':confirm?'Oui, continuer':'Fermer';
 const finish=v=>{d.remove();resolve(v);};ok.onclick=()=>finish(text?field.value:true);actions.append(ok);
 if(text||confirm){const cancel=document.createElement('button');cancel.textContent='Annuler';cancel.onclick=()=>finish(text?null:false);actions.append(cancel);}
 d.append(actions);d.addEventListener('cancel',e=>{e.preventDefault();finish(text?null:false);});d.addEventListener('keydown',e=>e.stopPropagation());document.body.append(d);d.showModal();(field||ok).focus();});
}
export const notify=message=>{void ask(message);};
