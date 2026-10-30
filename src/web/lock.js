// A second tab must not overwrite the same encrypted metadata snapshot.
export async function lockAccount(id){
 if(!navigator.locks)throw Error('Edge doit être à jour pour protéger l’ouverture simultanée du secours.');
 let release;const held=new Promise(r=>{release=r;});
 await new Promise((resolve,reject)=>{navigator.locks.request('okteo-vault-'+id,{ifAvailable:true},async lock=>{if(!lock){reject(Error('Ce compte travaille déjà dans un autre onglet. Fermez cet onglet avant de reprendre ici.'));return;}resolve();await held;}).catch(reject);});
 addEventListener('pagehide',()=>release(),{once:true});
}
