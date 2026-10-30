import {random,hash,passwordHash,verify,validPassword,json,fail,body,cookie,identity,safeUser} from './security.js';
const now=()=>new Date().toISOString();
const month=()=>{const parts=new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit'}).formatToParts(new Date());return parts.find(p=>p.type==='year').value+'-'+parts.find(p=>p.type==='month').value;};
const run=(db,sql,...args)=>db.prepare(sql).bind(...args).run();
const audit=(db,u,action,target)=>run(db,'INSERT INTO admin_audit(author,created,action,target) VALUES(?,?,?,?)',u.login,now(),action,target);
function admin(u){if(u.role!=='admin')fail(403,'Droits administrateur requis.');}
function price(x){if(typeof x!=='number'||!Number.isFinite(x)||x<0.01||x>1000)fail(400,'Tarif invalide.');return x;}
function number(x,min,max){if(!Number.isSafeInteger(x)||x<min||x>max)fail(400,'Valeur numérique hors limites.');return x;}
export async function handle(request,env,ctx={waitUntil(){}}) {
 const url=new URL(request.url),p=url.pathname,db=env.DB;
 if(!['GET','HEAD'].includes(request.method)&&request.headers.get('origin')!==url.origin)return json({error:{message:'Origine refusée.'}},403);
 if(['/login.html','/login','/login.js'].includes(p)){
  const r=await env.ASSETS.fetch(new Request(new URL(p==='/login'?'/login.html':p,url),request));
  return new Response(r.body,{status:r.status,headers:{'content-type':p==='/login.js'?'text/javascript; charset=utf-8':'text/html; charset=utf-8','cache-control':'no-store','x-frame-options':'DENY','x-content-type-options':'nosniff','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'"}});
 }
 if(!db)return json({error:{message:'Configuration Cloudflare incomplète : liaison D1 DB requise. Voir docs/deploiement-web-v72.md.'}},503);
 try {
  if(p==='/api/login'&&request.method==='POST') {
   const b=await body(request,4096);
   if(typeof b.login!=='string'||typeof b.password!=='string'||b.login.length>64||b.password.length>256)fail(400,'Identifiants invalides.');
   // Hashed IP and login buckets; no clear IP or password logging. Fixed 15-minute window.
   for(const label of ['ip:'+ (request.headers.get('cf-connecting-ip')||'local'),'account:'+b.login.toLowerCase()]) {
    const bucket=Math.floor(Date.now()/900000)+':'+await hash(label);
    const r=await db.prepare('INSERT INTO login_attempts VALUES(?,1) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count').bind(bucket).first();
    if(r.count>20)fail(429,'Trop de tentatives. Réessayez dans 15 minutes.');
   }
   await run(db,'DELETE FROM login_attempts WHERE bucket<?',String(Math.floor(Date.now()/900000)-2)+':');
   await run(db,'DELETE FROM sessions WHERE expires<?',Date.now());
   let u=await db.prepare('SELECT * FROM users WHERE login=? COLLATE NOCASE').bind(b.login).first();
   // One-time first administrator: password provided only as a Cloudflare secret.
   if(!u&&b.login==='KevinCruveilher'&&env.BOOTSTRAP_PASSWORD&&await hash(b.password)===await hash(env.BOOTSTRAP_PASSWORD)&&validPassword(b.password)) {
    await run(db,"INSERT INTO users(id,login,password,role,vault_key,created) SELECT ?,?,?, 'admin',?,? WHERE NOT EXISTS(SELECT 1 FROM users)",crypto.randomUUID(),b.login,await passwordHash(b.password),random(),now());
    u=await db.prepare('SELECT * FROM users WHERE login=?').bind(b.login).first();
   }
   const dummy='0'.repeat(64)+':'+'0'.repeat(64);
   const ok=await verify(b.password,u?.password||dummy);
   if(!ok||!u?.active)fail(401,'Identifiant ou mot de passe incorrect.');
   const token=random();await run(db,'INSERT INTO sessions VALUES(?,?,?)',await hash(token),u.id,Date.now()+28800000);
   return json({user:safeUser(u)},200,{'set-cookie':cookie(token)});
  }
  const u=await identity(request,db);
  const expected=request.headers.get('x-okteo-user');if(u&&expected&&u.id!==expected)fail(401,'Compte de session changé : exportez puis reconnectez-vous.');
  if(!u){if(p.startsWith('/api/')||p.startsWith('/ai/'))fail(401,'Session expirée. Votre travail ouvert reste disponible pour export.');return Response.redirect(url.origin+'/login.html',302);}
  if(p==='/api/logout'&&request.method==='POST'){await run(db,'DELETE FROM sessions WHERE token_hash=?',u.token_hash);return json({ok:true},200,{'set-cookie':cookie('',0)});}
  if(p==='/api/password'&&request.method==='POST'){
   const b=await body(request,4096);if(!validPassword(b.password))fail(400,'Utilisez de 12 à 256 caractères.');
   if(!await verify(String(b.current||''),u.password))fail(403,'Mot de passe actuel incorrect.');
   await db.batch([db.prepare('UPDATE users SET password=?,must_change=0 WHERE id=?').bind(await passwordHash(b.password),u.id),db.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash!=?').bind(u.id,u.token_hash)]);
   return json({ok:true});
  }
  if(p==='/api/session')return json({user:safeUser(u),vaultKey:u.vault_key,expires:u.expires});
  if(u.must_change){if(p.startsWith('/api/')||p.startsWith('/ai/'))fail(403,'Changez votre mot de passe initial.');return Response.redirect(url.origin+'/login.html',302);}
  if(p==='/ai/status')return json({anthropic:!!env.ANTHROPIC_API_KEY,nvidia:false,enterprise:true});
  if(p==='/ai/anthropic'&&request.method==='POST')return await relay(request,env,u,ctx);
  if(p.startsWith('/ai/'))fail(404,'Seul Claude entreprise est disponible.');
  if(p==='/api/admin/users'){
   admin(u);
   if(request.method==='GET')return json((await db.prepare('SELECT id,login,role,active,ai_enabled,monthly_limit,must_change FROM users ORDER BY created').all()).results);
   if(request.method==='POST'){
    const b=await body(request);if(!/^[\p{L}\p{N}_.-]{3,64}$/u.test(b.login||'')||!validPassword(b.password)||!['admin','operator'].includes(b.role))fail(400,'Identifiant, rôle ou mot de passe invalide (12 caractères minimum).');
    const id=crypto.randomUUID();
    try{await run(db,'INSERT INTO users(id,login,password,role,vault_key,created) VALUES(?,?,?,?,?,?)',id,b.login,await passwordHash(b.password),b.role,random(),now());}catch{fail(409,'Identifiant existant ou limite de trois administrateurs atteinte.');}
    await audit(db,u,'creation-compte',id);return json({ok:true},201);
   }
  }
  if(p.startsWith('/api/admin/users/')&&request.method==='POST'){
   admin(u);const id=p.split('/').at(-1),b=await body(request);
   if(id===u.id&&(b.active===false||b.role==='operator'))fail(400,'Votre propre compte administrateur doit rester actif.');
   const target=await db.prepare('SELECT * FROM users WHERE id=?').bind(id).first();if(!target)fail(404,'Compte inconnu.');
   if(b.password!==undefined&&!validPassword(b.password))fail(400,'12 caractères minimum.');
   const role=b.role??target.role;if(!['admin','operator'].includes(role))fail(400,'Rôle invalide.');
   try{await db.batch([db.prepare('UPDATE users SET role=?,active=?,ai_enabled=?,monthly_limit=?,password=?,must_change=? WHERE id=?').bind(role,b.active===undefined?target.active:+!!b.active,b.ai_enabled===undefined?target.ai_enabled:+!!b.ai_enabled,b.monthly_limit===undefined?target.monthly_limit:number(b.monthly_limit,0,10000000000),b.password?await passwordHash(b.password):target.password,b.password?1:target.must_change,id),db.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash!=?').bind(id,id===u.id?u.token_hash:'')]);}catch{fail(409,'Limite de trois administrateurs atteinte.');}
   await audit(db,u,'modification-compte',id);return json({ok:true});
  }
  if(p==='/api/budget'&&request.method==='GET'){
   const config=await db.prepare('SELECT * FROM config WHERE id=1').first();
   const totals=await db.prepare('SELECT user_id,status,SUM(reserved) reserved,SUM(actual) actual,COUNT(*) calls FROM usage WHERE month=? GROUP BY user_id,status').bind(month()).all();
   const total=totals.results.reduce((n,r)=>n+Number(r.actual??r.reserved??0),0);
   return json({config,month:month(),total,userLimit:u.monthly_limit,usage:u.role==='admin'?totals.results:totals.results.filter(r=>r.user_id===u.id)});
  }
  if(p==='/api/admin/config'&&request.method==='POST'){
   admin(u);const b=await body(request);if(!/^claude-[a-z0-9.-]{1,80}$/.test(b.model))fail(400,'Modèle invalide.');
   await run(db,'UPDATE config SET monthly_limit=?,concurrent_limit=?,model=?,input_price=?,output_price=? WHERE id=1',number(b.monthly_limit,0,10000000000),number(b.concurrent_limit,1,10),b.model,price(b.input_price),price(b.output_price));await audit(db,u,'budget-modele','config');return json({ok:true});
  }
  if(p==='/api/shared'){
   if(request.method==='GET')return json(await db.prepare('SELECT * FROM shared_versions ORDER BY id DESC LIMIT 1').first()||{id:0,data:null});
   if(request.method==='POST'){
    admin(u);const b=await body(request,2000000);validateShared(b.data);
    const r=await db.prepare('INSERT INTO shared_versions(parent,author,created,data,note) SELECT ?,?,?,?,? WHERE COALESCE((SELECT MAX(id) FROM shared_versions),0)=?').bind(b.parent,u.login,now(),JSON.stringify(b.data),String(b.note||'').slice(0,1000),b.parent).run();
    if(!r.meta.changes)fail(409,'Une autre version a été publiée. Rechargez la bibliothèque commune.');return json({id:r.meta.last_row_id});
   }
  }
  if(p==='/api/shared/history'&&request.method==='GET'){return json((await db.prepare('SELECT id,parent,author,created,note FROM shared_versions ORDER BY id DESC LIMIT 100').all()).results);}
  if(/^\/api\/shared\/\d+$/.test(p)&&request.method==='GET')return json(await db.prepare('SELECT * FROM shared_versions WHERE id=?').bind(+p.split('/').at(-1)).first());
  if(p==='/api/proposals'){
   if(request.method==='GET')return json((await db.prepare(u.role==='admin'?'SELECT * FROM proposals ORDER BY created DESC LIMIT 200':'SELECT * FROM proposals WHERE author=? ORDER BY created DESC LIMIT 200').bind(...(u.role==='admin'?[]:[u.login])).all()).results);
   if(request.method==='POST'){const b=await body(request,8000);if(typeof b.message!=='string'||!b.message.trim()||b.message.length>3000||typeof b.reference!=='string'||b.reference.length>100)fail(400,'Indiquez une référence et une description (sans données de chantier).');await run(db,'INSERT INTO proposals(id,author,created,reference,message) VALUES(?,?,?,?,?)',crypto.randomUUID(),u.login,now(),b.reference,b.message);return json({ok:true});}
  }
  if(p.startsWith('/api/proposals/')&&request.method==='POST'){admin(u);const b=await body(request,8000);if(!['ouverte','en_cours','acceptee','refusee'].includes(b.status))fail(400,'Statut invalide.');await run(db,'UPDATE proposals SET status=?,resolution=? WHERE id=?',b.status,String(b.resolution||'').slice(0,3000),p.split('/').at(-1));return json({ok:true});}
  if(p.startsWith('/api/'))fail(404,'Service inconnu.');
  if(!['GET','HEAD'].includes(request.method))fail(405,'Méthode refusée.');
  // Never expose sources/configuration. Only compiled dist is served.
  if(p.startsWith('/src/')||p.startsWith('/server/')||p.startsWith('/migrations/'))fail(404,'Ressource inconnue.');
  const res=await env.ASSETS.fetch(request),headers=new Headers(res.headers);
  headers.set('cache-control','no-store');headers.set('x-content-type-options','nosniff');headers.set('referrer-policy','same-origin');headers.set('x-frame-options','DENY');
  headers.set('content-security-policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' blob: data:; worker-src 'self' blob:; frame-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  return new Response(res.body,{status:res.status,headers});
 }catch(e){return json({error:{message:e.status?e.message:'Service temporairement indisponible. Réessayez ou contactez un administrateur.'}},e.status||500);}
}
export function validateShared(d){
 if(!d||typeof d!=='object'||Array.isArray(d)||Object.keys(d).some(k=>!['rules','symbols','settings','packs','appVersion'].includes(k)))fail(400,'Bibliothèque invalide.');
 if(!d.rules||!Array.isArray(d.rules.rules)||!Array.isArray(d.rules.questions)||!Array.isArray(d.rules.history)||!d.symbols||d.symbols.version!==1||!Array.isArray(d.symbols.be)||!d.symbols.overrides||!d.settings||Array.isArray(d.settings))fail(400,'Règles, questions, historique, symboles et paramètres requis.');
 const ids=new Set();for(const r of d.rules.rules){if(!r||typeof r.id!=='string'||ids.has(r.id)||typeof r.titre!=='string'||!Array.isArray(r.details))fail(400,'Fiche de règle invalide.');ids.add(r.id);}
 for(const symbol of [...d.symbols.be,...Object.values(d.symbols.overrides)]){if(!symbol||typeof symbol!=='object'||symbol.image&&(!/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(symbol.image)||symbol.image.length>340000))fail(400,'Image de symbole invalide ou trop volumineuse.');}
 if(d.packs!==undefined&&!Array.isArray(d.packs))fail(400,'Packs invalides.');
 // Schema contains no plan/PDF/project attachment field. Do not accept generic uploaded documents.
 if(JSON.stringify(d).length>1500000)fail(413,'Bibliothèque trop volumineuse.');
}
async function relay(request,env,u,ctx){
 if(!u.ai_enabled)fail(403,'Accès IA désactivé pour votre compte.');if(!env.ANTHROPIC_API_KEY)fail(503,'Clé Claude entreprise non configurée. Le dessin et les exports restent disponibles.');
 const db=env.DB;
 await run(db,"UPDATE usage SET status='uncertain' WHERE status='pending' AND created<?",Date.now()-600000);
 const c=await db.prepare('SELECT * FROM config WHERE id=1').first(),b=await body(request,16000000);
 if(!Array.isArray(b.messages)||!b.messages.length)fail(400,'Messages manquants.');
 const output=number(b.max_tokens,1,32000);
 const payload={model:c.model,max_tokens:output,system:typeof b.system==='string'?b.system:'',messages:b.messages};
 // Strict content schema: no tools, remote URL sources, caching or arbitrary provider options.
 for(const m of payload.messages){if(!['user','assistant'].includes(m.role))fail(400,'Rôle de message invalide.');if(typeof m.content==='string')continue;if(!Array.isArray(m.content))fail(400,'Contenu invalide.');for(const x of m.content){if(x.type==='text'&&typeof x.text==='string'){if(Object.keys(x).some(k=>!['type','text'].includes(k)))fail(400,'Option non autorisée.');continue;}if(x.type==='image'&&x.source?.type==='base64'&&/^image\/(jpeg|png|webp|gif)$/.test(x.source.media_type)&&typeof x.source.data==='string'&&Object.keys(x).every(k=>['type','source'].includes(k)))continue;fail(400,'Contenu IA non autorisé.');}}
 // Count with provider before reserving; max output + 10% input margin, no speculative token heuristic.
 const headers={'content-type':'application/json','anthropic-version':'2023-06-01','x-api-key':env.ANTHROPIC_API_KEY};
 const countRes=await fetch('https://api.anthropic.com/v1/messages/count_tokens',{method:'POST',headers,body:JSON.stringify({model:payload.model,system:payload.system,messages:payload.messages}),signal:AbortSignal.timeout(30000)});
 if(!countRes.ok)fail(503,'Comptage Claude indisponible : appel annulé pour protéger le budget.');
 const counted=await countRes.json();if(!Number.isSafeInteger(counted.input_tokens)||counted.input_tokens<0||counted.input_tokens>180000)fail(413,'Analyse trop volumineuse (180 000 tokens maximum).');
 const reserved=Math.ceil(counted.input_tokens*1.1*c.input_price+output*c.output_price),id=crypto.randomUUID(),m=month();
 // Single atomic SQLite statement: concurrent requests cannot both spend the same remainder.
 const insert=await db.prepare(`INSERT INTO usage(id,user_id,month,created,status,reserved,model,input_price,output_price)
 SELECT ?,?,?,?,'pending',?,?,?,? WHERE
 (SELECT COALESCE(SUM(COALESCE(actual,reserved)),0) FROM usage WHERE month=?)+? <= (SELECT monthly_limit FROM config WHERE id=1)
 AND (SELECT COALESCE(SUM(COALESCE(actual,reserved)),0) FROM usage WHERE month=? AND user_id=?)+? <= (SELECT monthly_limit FROM users WHERE id=? AND active=1 AND ai_enabled=1)
 AND (SELECT COUNT(*) FROM usage WHERE status='pending') < (SELECT concurrent_limit FROM config WHERE id=1)`).bind(id,u.id,m,Date.now(),reserved,c.model,c.input_price,c.output_price,m,reserved,m,u.id,reserved,u.id).run();
 if(!insert.meta.changes)fail(429,'Plafond mensuel ou nombre d’analyses simultanées atteint.');
 // Keep uncertain holds charged; never release them merely because a client disconnects or a timeout fires.
 const work=(async()=>{try{
   const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers,body:JSON.stringify(payload),signal:AbortSignal.timeout(180000)});
   if(!r.ok){await run(db,"UPDATE usage SET status='rejected',actual=0 WHERE id=?",id);return json({error:{message:`Claude indisponible (${r.status}). Vous pouvez continuer le dessin ou coller une analyse.`}},502);}
   const result=await r.json(),a=result.usage;
   if(!a||!Number.isSafeInteger(a.input_tokens)||!Number.isSafeInteger(a.output_tokens))throw new Error('usage');
   const actual=Math.ceil(a.input_tokens*c.input_price+a.output_tokens*c.output_price);
   await run(db,"UPDATE usage SET status='known',actual=?,input_tokens=?,output_tokens=? WHERE id=?",actual,a.input_tokens,a.output_tokens,id);
   return json({...result,okteo:{model:c.model,cost:actual/1e6,estimatedInvoice:true}});
  }catch{await run(db,"UPDATE usage SET status='uncertain' WHERE id=?",id);return json({error:{message:'Réponse IA interrompue. Réservation conservée par prudence ; dessin et export disponibles.'}},504);}})();
 ctx.waitUntil(work.then(()=>{}));return work;
}
export default {fetch:handle};
