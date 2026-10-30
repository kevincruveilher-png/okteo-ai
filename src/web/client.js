export const enterprise = () => !!window.okteoSession;
export async function request(path,data){
 const r=await fetch(path,{method:data===undefined?'GET':'POST',headers:{...(data===undefined?{}:{'content-type':'application/json'}),...(window.okteoSession?{'x-okteo-user':window.okteoSession.user.id}:{})},body:data===undefined?undefined:JSON.stringify(data)});
 let b;try{b=await r.json();}catch{throw Error('Service web indisponible.');}
 if(!r.ok){if(r.status===401)document.dispatchEvent(new CustomEvent('okteo:session-expired'));throw Error(b.error?.message||'Service indisponible.');}return b;
}
