import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {handle} from '../server/worker.js';
import {passwordHash,verify} from '../server/security.js';
import {differences,revisionLabel} from '../src/web/history.js';
import {validateProject} from '../src/web/exchange.js';
function database(){const sqlite=new DatabaseSync(':memory:');sqlite.exec(fs.readFileSync('migrations/0001_enterprise.sql','utf8'));return {sqlite,prepare(sql){const statement=sqlite.prepare(sql);const wrap=args=>({bind:(...a)=>wrap(a),first:async()=>statement.get(...args)||null,all:async()=>({results:statement.all(...args)}),run:async()=>{const r=statement.run(...args);return {meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}}}});return wrap([]);},async batch(stmts){sqlite.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sqlite.exec('COMMIT');return r;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};}
function fixture(){const DB=database(),env={DB,BOOTSTRAP_PASSWORD:'Temporary-secure-1234',ANTHROPIC_API_KEY:'test-server-only',ASSETS:{fetch:async()=>new Response('asset')}};return {env,db:DB.sqlite,async call(path,data,cookie='',extra={}){const req=new Request('https://okteo.test'+path,{method:data===undefined?'GET':'POST',headers:{origin:'https://okteo.test',cookie,...extra},body:data===undefined?undefined:JSON.stringify(data)});return handle(req,env,{waitUntil(){}});},async login(login='KevinCruveilher',password=env.BOOTSTRAP_PASSWORD){const r=await this.call('/api/login',{login,password});assert.equal(r.status,200,await r.clone().text());return r.headers.get('set-cookie').split(';')[0];},async admin(){const c=await this.login();await this.call('/api/password',{current:env.BOOTSTRAP_PASSWORD,password:'Personal-password-5678'},c);return c;}};}
test('password hashes salted; verification rejects wrong passwords',async()=>{const a=await passwordHash('long password');assert(await verify('long password',a));assert(!await verify('wrong',a));assert.notEqual(a,await passwordHash('long password'));});
test('server fails closed without DB and protects assets/API',async()=>{const f=fixture();assert.equal((await f.call('/')).status,302);assert.equal((await f.call('/api/session')).status,401);assert.equal((await f.call('/ai/anthropic',{})).status,401);assert.equal((await handle(new Request('https://x/'),{ASSETS:f.env.ASSETS})).status,503);});
test('bootstrap, mandatory password, session isolation, CSRF and secret absence',async()=>{const f=fixture(),c=await f.login();assert.equal((await f.call('/api/admin/users',undefined,c)).status,403);assert.equal((await f.call('/api/password',{current:'wrong',password:'Valid-password-123'},c)).status,403);await f.call('/api/password',{current:f.env.BOOTSTRAP_PASSWORD,password:'Valid-password-123'},c);const session=await (await f.call('/api/session',undefined,c)).json();assert.equal(session.user.login,'KevinCruveilher');assert(session.vaultKey);assert(!JSON.stringify(session).includes('test-server-only'));assert.equal((await f.call('/api/logout',{},c,{origin:'https://evil.test'})).status,403);await f.call('/api/logout',{},c);assert.equal((await f.call('/api/session',undefined,c)).status,401);assert.equal((await f.call('/api/login',{login:'KevinCruveilher',password:f.env.BOOTSTRAP_PASSWORD})).status,401);});
test('three admins maximum, operator refusal, disable/reset revokes sessions',async()=>{const f=fixture(),c=await f.admin();for(const login of ['AdminTwo','AdminThree'])assert.equal((await f.call('/api/admin/users',{login,role:'admin',password:'Temporary-other-123'},c)).status,201);assert.equal((await f.call('/api/admin/users',{login:'AdminFour',role:'admin',password:'Temporary-other-123'},c)).status,409);assert.equal((await f.call('/api/admin/users',{login:'Operator',role:'operator',password:'Temporary-other-123'},c)).status,201);const op=await f.login('Operator','Temporary-other-123');await f.call('/api/password',{current:'Temporary-other-123',password:'Permanent-other-123'},op);assert.equal((await f.call('/api/admin/users',undefined,op)).status,403);assert.equal((await f.call('/api/shared',{parent:0,data:{}},op)).status,403);const s=await (await f.call('/api/session',undefined,op)).json();await f.call('/api/admin/users/'+s.user.id,{active:false},c);assert.equal((await f.call('/api/session',undefined,op)).status,401);});
test('shared versions optimistic concurrency, history and proposals',async()=>{const f=fixture(),c=await f.admin(),data={rules:{rules:[],questions:[],history:[]},settings:{},symbols:{version:1,be:[],overrides:{}},appVersion:'0.72.0'};assert.equal((await f.call('/api/shared',{parent:0,data},c)).status,200);assert.equal((await f.call('/api/shared',{parent:0,data},c)).status,409);assert.equal((await f.call('/api/shared',{parent:1,data:{...data,plan:'forbidden'}},c)).status,400);const h=await (await f.call('/api/shared/history',undefined,c)).json();assert.equal(h.length,1);assert.equal((await f.call('/api/proposals',{reference:'R-001',message:'Préciser le texte'},c)).status,200);assert.equal((await (await f.call('/api/proposals',undefined,c)).json()).length,1);});
test('budget reservations are atomic under concurrent requests; provider-only key, unknown usage retained',async()=>{const f=fixture(),c=await f.admin();f.db.exec('UPDATE config SET monthly_limit=1500,concurrent_limit=2');const original=globalThis.fetch;let calls=0;globalThis.fetch=async(url,opts)=>{assert.equal(opts.headers['x-api-key'],'test-server-only');if(url.endsWith('/count_tokens'))return Response.json({input_tokens:100});calls++;await new Promise(r=>setTimeout(r,30));return Response.json({content:[{type:'text',text:'OK'}],usage:{input_tokens:100,output_tokens:20}});};try{const payload={messages:[{role:'user',content:'hello'}],max_tokens:100};const results=await Promise.all([f.call('/ai/anthropic',payload,c),f.call('/ai/anthropic',payload,c)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,429]);assert.equal(calls,1);assert.equal(f.db.prepare('SELECT actual FROM usage').get().actual,400);f.db.exec('UPDATE config SET monthly_limit=100000');globalThis.fetch=async url=>{if(url.endsWith('/count_tokens'))return Response.json({input_tokens:100});throw Error('timeout');};assert.equal((await f.call('/ai/anthropic',payload,c)).status,504);assert.equal(f.db.prepare("SELECT reserved FROM usage WHERE status='uncertain'").get().reserved,1220);}finally{globalThis.fetch=original;}});
test('project validation, revisions and exact element diffs',()=>{assert.throws(()=>validateProject({format:'okteo-chantier',version:99}));assert.throws(()=>validateProject({format:'okteo-chantier',version:2,chantier:{nom:'X'},fond:{pdf:'https://evil/'}}));assert.equal(validateProject({format:'okteo-chantier',version:1,chantier:{nom:'Legacy'},dessin:{s:JSON.stringify({nodes:[],app:[]})}}).version,1);assert.equal(revisionLabel(3,new Date('2026-10-30T13:35:22Z')),'R003_2026-10-30_14h35m22');assert.deepEqual(differences([{id:'a1',x:1}],[{id:'a1',x:2}]),[{element:'/a1/x',before:1,after:2}]);});
test('encrypted local recovery: ciphertext at rest, restore and account isolation including PDF',async()=>{
 const {indexedDB}=await import('fake-indexeddb');globalThis.indexedDB=indexedDB;globalThis.window={};globalThis.document=new EventTarget();globalThis.addEventListener=()=>{};
 const a=await import('../src/web/vault.js?test=A'),b=await import('../src/web/vault.js?test=B');
 const sa={user:{id:'account-a'},vaultKey:'01'.repeat(32)},sb={user:{id:'account-b'},vaultKey:'02'.repeat(32)};
 await a.unlock(sa);window.localStorage.setItem('project','Private chantier A');await a.putBlob('pdf:one',new Blob(['Secret PDF'],{type:'application/pdf'}));await a.flush();
 const cipher=await a.get('metadata');assert(!new TextDecoder().decode(cipher.data).includes('Private chantier A'));assert.equal(await (await a.getBlob('pdf:one')).text(),'Secret PDF');
 await b.unlock(sb);assert.equal(window.localStorage.getItem('project'),null);assert.equal(await b.getBlob('pdf:one'),undefined);await assert.rejects(b.unseal(cipher));
 const restore=await import('../src/web/vault.js?test=restore');await restore.unlock(sa);assert.equal(window.localStorage.getItem('project'),'Private chantier A');
});
test('budget denied at zero and user mismatch rejected',async()=>{const f=fixture(),c=await f.admin();const r=await f.call('/api/session',undefined,c,{'x-okteo-user':'other-user'});assert.equal(r.status,401);const session=await (await f.call('/api/session',undefined,c)).json();await f.call('/api/admin/users/'+session.user.id,{ai_enabled:false},c);assert.equal((await f.call('/ai/anthropic',{messages:[],max_tokens:1},c)).status,403);});
test('v72.1 : page bande du QR publique, rien d’autre sans session',async()=>{const f=fixture();
 for(const p of ['/bande.html','/bande','/assets/bande-Ab12_cD3.js','/assets/index-Zz9yXw8v.css'])assert.equal((await f.call(p)).status,200,p);
 const b=await f.call('/bande.html');assert.match(b.headers.get('content-security-policy')||'',/frame-ancestors 'none'/);
 for(const p of ['/','/index.html','/assets/fond-evrard-04949.jpg','/assets/kiteohm-logo.png','/version.json','/sw.js'])assert.equal((await f.call(p)).status,302,p);
 for(const p of ['/api/session','/ai/status'])assert.equal((await f.call(p)).status,401,p);
 assert.equal((await f.call('/assets/../src/app.js')).status,302);
 // sans base D1 : la bande reste lisible, le reste est fermé
 assert.equal((await handle(new Request('https://x/bande.html'),{ASSETS:f.env.ASSETS})).status,200);
 assert.equal((await handle(new Request('https://x/index.html'),{ASSETS:f.env.ASSETS})).status,503);});
test('v72.1 : délai IA compatible avec un relevé de 10 minutes',async()=>{const {AI_TIMEOUT}=await import('../server/worker.js');assert(AI_TIMEOUT>=600000);});
test('v72.1 : pages servies malgré les redirections .html de Cloudflare (page blanche du 02/11)',async()=>{
 // ASSETS qui imite html_handling de Cloudflare Pages : /x.html -> 308 /x, /x -> contenu de x.html
 const pages={'/login':'<title>Connexion</title>','/bande':'<title>Bande</title>','/':'<title>Oktéo</title>'};
 const ASSETS={fetch:async(req)=>{const p=new URL(req.url).pathname;if(p.endsWith('.html')){const t=p==='/index.html'?'/':p.slice(0,-5);return new Response(null,{status:308,headers:{location:t}});}
  return pages[p]?new Response(pages[p],{headers:{'content-type':'text/html'}}):new Response('js',{headers:{'content-type':'text/javascript'}});}};
 const DB=fixture().env.DB,env={DB,ASSETS};
 for(const [path,txt] of [['/login.html','Connexion'],['/login','Connexion'],['/bande.html','Bande'],['/bande','Bande']]){
  const r=await handle(new Request('https://okteo.test'+path),env,{waitUntil(){}});assert.equal(r.status,200,path);assert.match(await r.text(),new RegExp(txt),path);}
 const js=await handle(new Request('https://okteo.test/login.js'),env,{waitUntil(){}});assert.equal(js.status,200);
});
test('v75 : conversation = modèle de base (Sonnet), analyse = Opus au tarif d’analyse ; réglage admin des deux',async()=>{const f=fixture(),c=await f.admin();const original=globalThis.fetch,seen=[];
 globalThis.fetch=async(url,opts)=>{const b=JSON.parse(opts.body);if(url.endsWith('/count_tokens'))return Response.json({input_tokens:100});seen.push(b);assert(!('purpose' in b));return Response.json({content:[{type:'text',text:'OK'}],usage:{input_tokens:1000,output_tokens:100}});};
 try{const msg={messages:[{role:'user',content:'Bonjour'}],max_tokens:200};
  const a=await (await f.call('/ai/anthropic',msg,c)).json(),z=await (await f.call('/ai/anthropic',{...msg,purpose:'analyse'},c)).json();
  assert.equal(seen[0].model,'claude-sonnet-5-5');assert.equal(seen[1].model,'claude-opus-5-5');assert.equal(a.okteo.purpose,'chat');assert.equal(z.okteo.purpose,'analyse');
  assert(Math.abs(a.okteo.cost-(1000*2+100*10)/1e6)<1e-9);assert(Math.abs(z.okteo.cost-(1000*4+100*20)/1e6)<1e-9);
  const r=await f.call('/api/admin/config',{monthly_limit:50000000,concurrent_limit:2,model:'claude-sonnet-5-5',input_price:2,output_price:10,analysis_model:'claude-opus-5-5',analysis_input_price:5,analysis_output_price:25},c);assert.equal(r.status,200);
  const z2=await (await f.call('/ai/anthropic',{...msg,purpose:'analyse'},c)).json();assert(Math.abs(z2.okteo.cost-(1000*5+100*25)/1e6)<1e-9);
  assert.equal((await f.call('/api/admin/config',{monthly_limit:1,concurrent_limit:1,model:'claude-sonnet-5-5',input_price:2,output_price:10,analysis_model:'gpt-4',analysis_input_price:5,analysis_output_price:25},c)).status,400);
 }finally{globalThis.fetch=original;}});
test('v76 : modèle de l’analyse verrouillé sur Opus 5.5 (src/ai-config.js) : refusé s’il diffère, ignoré même écrit en base ; prix de l’analyse toujours réglables',async()=>{const f=fixture(),c=await f.admin();const original=globalThis.fetch,seen=[];
 globalThis.fetch=async(url,opts)=>{const b=JSON.parse(opts.body);if(url.endsWith('/count_tokens'))return Response.json({input_tokens:100});seen.push(b);return Response.json({content:[{type:'text',text:'OK'}],usage:{input_tokens:1000,output_tokens:100}});};
 try{const {ANALYSE_MODEL}=await import('../src/ai-config.js');assert.equal(ANALYSE_MODEL,'claude-opus-5-5');
  const base={monthly_limit:50000000,concurrent_limit:2,model:'claude-sonnet-5-5',input_price:2,output_price:10};
  assert.equal((await f.call('/api/admin/config',{...base,analysis_model:'claude-haiku-5-5',analysis_input_price:5,analysis_output_price:25},c)).status,400);
  assert.equal((await f.call('/api/admin/config',{...base,analysis_input_price:6,analysis_output_price:30},c)).status,200);
  await f.env.DB.prepare("UPDATE config SET analysis_model='claude-haiku-5-5' WHERE id=1").run();
  const z=await (await f.call('/ai/anthropic',{messages:[{role:'user',content:'Plan'}],max_tokens:200,purpose:'analyse'},c)).json();
  assert.equal(seen.at(-1).model,'claude-opus-5-5');assert.equal(z.okteo.model,'claude-opus-5-5');assert(Math.abs(z.okteo.cost-(1000*6+100*30)/1e6)<1e-9);
 }finally{globalThis.fetch=original;}});

test('v76 : cache de prompt — cache_control 5 min accepté (système en blocs, texte, image), 1 h et plus de 4 marques refusés, coût du cache compté',async()=>{const f=fixture(),c=await f.admin();const original=globalThis.fetch,seen=[];
 globalThis.fetch=async(url,opts)=>{const b=JSON.parse(opts.body);if(url.endsWith('/count_tokens'))return Response.json({input_tokens:100});seen.push(b);return Response.json({content:[{type:'text',text:'OK'}],usage:{input_tokens:1000,output_tokens:100,cache_creation_input_tokens:2000,cache_read_input_tokens:10000}});};
 try{const eph={type:'ephemeral'},img={type:'image',source:{type:'base64',media_type:'image/jpeg',data:'AAAA'}};
  const ok={purpose:'analyse',max_tokens:200,system:[{type:'text',text:'Consigne fixe',cache_control:eph}],messages:[{role:'user',content:[{...img,cache_control:eph},{type:'text',text:'Tuile 1',cache_control:eph}]}]};
  const r=await f.call('/ai/anthropic',ok,c);assert.equal(r.status,200);const z=await r.json();
  assert.deepEqual(seen.at(-1).system,ok.system);assert.equal(seen.at(-1).messages[0].content[1].cache_control.type,'ephemeral');
  assert(Math.abs(z.okteo.cost-(1000*4+2000*4*1.25+10000*4*0.05+100*20)/1e6)<1e-9);
  const ttl={...ok,messages:[{role:'user',content:[{type:'text',text:'x',cache_control:{type:'ephemeral',ttl:'1h'}}]}]};
  assert.equal((await f.call('/ai/anthropic',ttl,c)).status,400);
  const five={...ok,messages:[{role:'user',content:[1,2,3,4].map(i=>({type:'text',text:'t'+i,cache_control:eph}))}]};
  assert.equal((await f.call('/ai/anthropic',five,c)).status,400);
  assert.equal((await f.call('/ai/anthropic',{...ok,system:[{type:'text',text:'x',other:1}]},c)).status,400);
 }finally{globalThis.fetch=original;}});
