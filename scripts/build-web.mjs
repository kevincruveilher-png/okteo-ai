import {build} from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
await build({entryPoints:['server/worker.js'],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:'dist/_worker.js'});
fs.writeFileSync('dist/_routes.json',JSON.stringify({version:1,include:['/*'],exclude:[]}));
const version=JSON.parse(fs.readFileSync('package.json')).version;
const commit=execFileSync('git',['rev-parse','--short','HEAD'],{encoding:'utf8'}).trim();
const id=version+'-'+commit+'-'+Date.now();
fs.writeFileSync('dist/version.json',JSON.stringify({version,id}));
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(d=>d.isDirectory()?walk(path.join(dir,d.name)):[path.join(dir,d.name)]);
const assets=walk('dist/assets').map(f=>'/'+f.replace(/^dist\//,''));
// No plans, API responses, session keys, or HTML in the cache; only immutable build resources.
fs.writeFileSync('dist/sw.js',`const CACHE=${JSON.stringify('okteo-'+id)},ASSETS=${JSON.stringify(assets)};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('message',e=>{if(e.data==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(u.origin===self.location.origin&&ASSETS.includes(u.pathname))e.respondWith(caches.open(CACHE).then(async c=>(await c.match(e.request))||fetch(e.request)));});
`);
// Guard against the exact uncompiled pdfjs-dist regression.
const html=fs.readFileSync('dist/index.html','utf8');if(html.includes('/src/'))throw Error('Sources non compilées dans dist/index.html');
if(!assets.some(f=>/pdf\.worker/.test(f)))throw Error('Worker PDF absent');
console.log('Cloudflare dist prêt : worker sécurisé, PDF worker, cache hors ligne, version '+id);
