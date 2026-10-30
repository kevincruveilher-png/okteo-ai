// All enterprise localStorage content is memory-only; the persistent copy is AES-GCM encrypted.
// No key in localStorage/sessionStorage/IndexedDB. The server returns only the logged-in user's key.
let database,key,user,values={},queue=Promise.resolve(),dirty=false,timer,inFlight=0;
export function transaction(mode,fn){return new Promise((resolve,reject)=>{const t=database.transaction('vault',mode),r=fn(t.objectStore('vault'));t.oncomplete=()=>resolve(r?.result);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||Error('Stockage interrompu'));});}
export async function seal(value){const iv=crypto.getRandomValues(new Uint8Array(12));return {iv,data:await crypto.subtle.encrypt({name:'AES-GCM',iv},key,value)};}
export async function unseal(value){return crypto.subtle.decrypt({name:'AES-GCM',iv:value.iv},key,value.data);}
const encode=new TextEncoder(),decode=new TextDecoder();
export async function put(keyName,value){return transaction('readwrite',s=>s.put(value,user+':'+keyName));}
export async function get(keyName){return transaction('readonly',s=>s.get(user+':'+keyName));}
export async function remove(keyName){return transaction('readwrite',s=>s.delete(user+':'+keyName));}
export async function putBlob(name,blob){if(!(blob instanceof Blob))throw Error('Seuls les fichiers sont conservés dans le secours sécurisé.');await put('file:'+name,{...(await seal(await blob.arrayBuffer())),type:blob.type});}
export async function getBlob(name){const v=await get('file:'+name);return v?new Blob([await unseal(v)],{type:v.type}):undefined;}
export const removeBlob=name=>remove('file:'+name);
export async function flush(){
 clearTimeout(timer);if(!dirty)return queue;dirty=false;
 values['okteo.secure.lastSaved']=String(Date.now());
 const data=encode.encode(JSON.stringify(values));
 inFlight++;
 queue=queue.catch(()=>{}).then(async()=>{try{await put('metadata',await seal(data));document.dispatchEvent(new CustomEvent('okteo:vault-saved',{detail:{at:Date.now()}}));}finally{inFlight--;}});
 try{await queue;}catch(e){dirty=true;document.dispatchEvent(new CustomEvent('okteo:save-error',{detail:{message:'Secours chiffré non enregistré : '+e.message}}));throw e;}
}
function schedule(){dirty=true;clearTimeout(timer);timer=setTimeout(()=>flush().catch(()=>{}),200);}
export async function unlock(session){
 user=session.user.id;
 key=await crypto.subtle.importKey('raw',Uint8Array.from(session.vaultKey.match(/../g),x=>parseInt(x,16)),'AES-GCM',false,['encrypt','decrypt']);
 database=await new Promise((res,rej)=>{const r=indexedDB.open('okteo-secure-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('vault');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
 const previous=await get('metadata');values=previous?JSON.parse(decode.decode(await unseal(previous))):{};
 const storage={get length(){return Object.keys(values).length;},key:i=>Object.keys(values)[i]??null,getItem:k=>Object.hasOwn(values,k)?values[k]:null,setItem(k,v){values[String(k)]=String(v);schedule();},removeItem(k){delete values[k];schedule();},clear(){values={};schedule();}};
 Object.defineProperty(window,'localStorage',{value:storage,configurable:true});
 addEventListener('beforeunload',e=>{if(dirty||inFlight){e.preventDefault();e.returnValue='';flush().catch(()=>{});}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)flush().catch(()=>{});});
 return !!previous;
}
