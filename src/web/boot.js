import {unlock,flush} from './vault.js';
import {request} from './client.js';
import {lockAccount} from './lock.js';
// Local Vite and GitHub Pages retain prototype mode. Cloudflare is always fail-closed.
const secured=location.hostname.endsWith('.pages.dev')||import.meta.env.VITE_OKTEO_ENTERPRISE==='true';
async function boot(){
 if(secured){
  const session=await request('/api/session');
  if(session.user.must_change){location.href='/login.html';return;}
  await lockAccount(session.user.id);
  window.okteoSession=session;window.okteoFlush=flush;
  await unlock(session);
  delete session.vaultKey;
  const channel=new BroadcastChannel("okteo-accounts");
  channel.onmessage=async e=>{if(e.data.logout||e.data.userId!==session.user.id){try{window.okteo?.saveNow();await flush();}finally{location.replace("/login.html");}}};
  window.okteoSessionChannel=channel;
  const {prepareShared}=await import("./shared.js");await prepareShared();
 }
 await import('../app.js');await import('../ext/main.js');
 if(secured){const {startEnterprise}=await import('./workspace.js');await startEnterprise();}
}
boot().catch(e=>{if(window.okteo){window.okteo.setHint("Services entreprise : "+e.message+". Exportez votre chantier avant de recharger.");return;}document.body.replaceChildren();const main=document.createElement('main');main.style.cssText='padding:50px;font:18px system-ui';main.textContent='Oktéo ne peut pas ouvrir la session : '+e.message;const a=document.createElement('a');a.href='/login.html';a.textContent=' Se connecter';main.appendChild(a);document.body.appendChild(main);});
