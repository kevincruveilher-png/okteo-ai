// Régressions MAJ 1/2 : information conservée, absence d'import partiel et relecture ciblée.
import assert from 'node:assert/strict';
import { aiToPlan, parseAiJson, pastePrompt, aiPrompt } from '../src/walls/ai-plan.js';
import { readingData, AI_SYSTEM } from '../src/walls/ai-data.js';
import { recheckPoints, recheckPrompt, parseCorrections } from '../src/walls/ai-recheck.js';
import { computeCircuits } from '../src/cablage/circuits.js';
import { CAB_DEFAULTS } from '../src/cablage/settings.js';
const map = { x0: 0, y0: 0, sx: .01, sy: .01 }, frame = { x0: 0, y0: 0, w: 10, h: 10 };
let n = 0;
function test(name, f) { f(); n++; console.log('  ✓ ' + name); }
const raw = { appareils: [
  { t:'PC16',x:200,y:200,qty:4,inscription:'BLOC 4 PRISES',aiOrigin:'plan',aiGroup:'bloc séjour' },
  { t:'PC20',x:300,y:300,calibre:32,inscription:'32 A' },
  { t:'DESSIN_BE_INCONNU',x:400,y:400,inscription:'SYMBOLE X',aiNote:'à identifier' },
  { t:'APP',x:500,y:500,inscription:'ALIM DETECTEUR PERSONNE' },
], liaisons: [], remarques:'A'.repeat(1500) };
const plan=aiToPlan(raw,map);
test('Bloc quadruple conservé comme un objet avec quantité et inscription',()=>{assert.equal(plan.devices.length,4);assert.equal(plan.devices[0].qty,4);assert.equal(plan.devices[0].aiGroup,'bloc séjour');});
test('32 A ne devient pas PC20 ni plaque inventée ; lecture originale conservée',()=>{assert.equal(plan.devices[1].t,'PC32');assert.equal(plan.devices[1].calibre,32);assert.equal(plan.devices[1].aiReading.t,'PC20');assert.equal(aiToPlan({appareils:[{t:'PC20',x:1,y:1,inscription:'32 A'}]},map).devices[0].t,'PC32');});
test('Symbole inconnu conservé au point lu sans circuit inventé',()=>{assert.equal(plan.devices[2].t,'INCONNU');assert.equal(plan.devices[2].aiType,'DESSIN_BE_INCONNU');assert.equal(plan.devices[2].x,4);const cs=computeCircuits([{...plan.devices[2],id:'inc',lv:'rdc'}],[],CAB_DEFAULTS);assert.ok(cs.circuits? !cs.circuits.some(c=>c.apps.includes('inc')) : !cs.some(c=>c.apps.includes('inc')));});
test('Quantité illisible reste inconnue, anciens objets sans nouveaux champs restent lisibles',()=>{assert.equal(aiToPlan({appareils:[{t:'PC16',x:1,y:1,qty:null}]},map).devices[0].qty,null);assert.equal(aiToPlan({appareils:[{t:'PC16',x:1,y:1}]},map).devices[0].qty,undefined);});
test('Réponse source et remarques longues conservées pour reprise',()=>{assert.deepEqual(plan.evidence,raw);assert.equal(plan.remarques.length,1500);assert.equal(plan.devices[3].inscription,'ALIM DETECTEUR PERSONNE');});
test('JSON tronqué et rubriques invalides refusés avant conversion',()=>{assert.throws(()=>parseAiJson(JSON.stringify(raw).slice(0,-1)),/coupée/);assert.throws(()=>aiToPlan({appareils:{}},map),/liste/);assert.throws(()=>aiToPlan({appareils:[{t:'PC16',x:null,y:1}]},map),/position/);assert.throws(()=>aiToPlan({appareils:[{t:'PC16',x:1,y:1,qty:0}]},map),/quantité/);});
test('Introduction partagée, calibre et inconnus dans le prompt initial ; détecteurs détaillés uniquement en relecture',()=>{const first=pastePrompt({page:3}),key=aiPrompt({W:3500,H:4900,cmPerPx:1});assert.ok(first.startsWith(AI_SYSTEM));assert.match(first,/PC32/);assert.match(first,/INCONNU/);assert.match(key,/"qty"/);assert.doesNotMatch(key,/commande\.mode|détecteurs intégrés\/séparés/);});
const apps=plan.devices.map((a,i)=>({...a,id:'a'+i,rep:'T'+i,room:'Séjour',lv:'rdc'}));
const points=recheckPoints({apps,issues:[{kind:'lum',ids:['a3'],lv:'rdc'}]},{frame});
test('Commande non identifiée et type inconnu sont proposés à la relecture sans nouvel appel IA',()=>{assert.ok(points.some(p=>p.kind==='lum'));assert.ok(points.some(p=>p.kind==='type'&&p.ids.includes('a2')));const prompt=recheckPrompt(points);assert.match(prompt,/détecteurs intégrés\/séparés/);assert.match(prompt,/ALIM DETECTEUR PERSONNE/);assert.match(prompt,/commande/);assert.match(prompt,/32 A/);});
test('Analyse détecteur conservée avec preuve sans inventer de liaison',()=>{const c=parseCorrections(JSON.stringify({lectures:[{rep:'T3',aiOrigin:'interpretation',commande:{mode:'detecteur',detecteur:'integre',alimentation:'permanente',preuve:'ALIM DETECTEUR PERSONNE'}}]}),{apps,frame,points});assert.equal(c.readings[0].commande.mode,'detecteur');assert.equal(c.links.length,0);assert.equal(c.count,1);assert.equal(c.evidence.lectures[0].rep,'T3');});
test('Absence de preuve : fonctionnement inconnu et à confirmer',()=>{const c=parseCorrections({lectures:[{rep:'T3',commande:{mode:'detecteur',alimentation:'permanente'}}]},{apps,frame,points});assert.equal(c.readings[0].commande.mode,'inconnue');assert.equal(c.readings[0].commande.alimentation,'inconnue');assert.equal(c.readings[0].aiStatus,'a_confirmer');});
test('Relecture ne rétrograde pas le calibre 32 A et conserve un nouvel inconnu',()=>{const c=parseCorrections({types:[{rep:'T1',t:'PC20',calibre:20}],lectures:[{rep:'T1',calibre:20}],ajouts:[{t:'CAPTEUR_BE',x:60,y:60,inscription:'DET'}]},{apps,frame,points});assert.ok(!c.types.some(t=>t.t==='PC20'));assert.ok(!c.readings.some(t=>t.calibre===20));assert.equal(c.adds[0].t,'INCONNU');assert.equal(c.adds[0].inscription,'DET');});
test('Champs arbitraires du fournisseur non injectés dans les propriétés',()=>{assert.deepEqual(readingData({id:'evil',x:100,custom:1,qty:2}),{qty:2});assert.throws(()=>parseCorrections({lectures:{}},{apps,frame,points}),/liste/);});
console.log(`${n} vérifications de lecture IA réussies.`);

if (process.argv.includes('--browser')) {
 const {chromium}=await import('playwright'); const {createServer}=await import('vite');
 const server=await createServer({server:{port:5204,strictPort:true,open:false},logLevel:'error'});let browser;
 try {
  await server.listen();browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1500,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://localhost:5204');await page.waitForFunction(()=>window.okteoExt);
  await page.evaluate(()=>{localStorage.clear();});await page.reload();await page.waitForFunction(()=>window.okteoExt);
  await page.evaluate(()=>{okteoExt.iaMode.setMode('be');okteo.setTab('plan');});
  // Parcours réel du collage : un fichier incomplet ne touche pas le chantier.
  const before=await page.evaluate(()=>JSON.stringify(okteo.state));
  await page.evaluate(()=>okteoExt.aiReleve.pastePanel());await page.fill('#ai-paste','{"appareils":[');await page.click('#ai-read');
  assert.equal(await page.evaluate(()=>JSON.stringify(okteo.state)),before);
  const payload={...raw,ref:{W:3500,H:4900}};
  await page.evaluate(()=>okteoExt.aiReleve.pastePanel());await page.fill('#ai-paste',JSON.stringify(payload));await page.click('#ai-read');await page.waitForSelector('#ai-ok');await page.click('#ai-ok');
  const imported=await page.evaluate(()=>okteo.allApps());assert.equal(imported.length,4);assert.equal(imported[0].qty,4);assert.equal(imported[1].t,'PC32');assert.equal(imported[2].t,'INCONNU');
  const meta=await page.evaluate(()=>okteo.cab.releves[okteo.level.id]);assert.deepEqual(meta.evidence,payload);
  // Informations accessibles et texte fournisseur échappé dans les propriétés.
  await page.evaluate((id)=>{okteo.updateApps([{id,inscription:'<script>window.BAD=1</script>'}]);okteo.select([id]);},imported[0].id);
  assert.equal(await page.locator('.ai-reading script').count(),0);assert.match(await page.locator('.ai-reading').textContent(),/4/);
  // Correction ciblée réellement appliquée via la carte existante.
  await page.evaluate(async(id)=>{await okteoExt.recheck.open({ids:[id]});},imported[3].id);
  const light=await page.evaluate((id)=>okteo.allApps().find(a=>a.id===id),imported[3].id);
  await page.fill('#rk-paste',JSON.stringify({lectures:[{rep:light.rep,aiOrigin:'interpretation',commande:{mode:'detecteur',detecteur:'integre',alimentation:'permanente',preuve:'ALIM DETECTEUR PERSONNE'}}]}));
  await page.click('#rk-read');await page.click('#rk-ok');
  assert.equal(await page.evaluate((id)=>okteo.state.app.find(a=>a.id===id).commande.mode,light.id),'detecteur');
  await page.keyboard.press('Control+z');assert.equal(await page.evaluate((id)=>okteo.state.app.find(a=>a.id===id).commande,light.id),undefined);
  await page.keyboard.press('Control+y');assert.equal(await page.evaluate((id)=>okteo.state.app.find(a=>a.id===id).commande.mode,light.id),'detecteur');
  const serialized=await page.evaluate(async()=>{const {buildOkteo}=await import('/src/ext/okteo-file.js');return JSON.parse(await(await buildOkteo(okteo.ch,okteo.packData())).text());});
  const savedState=JSON.parse(serialized.dessin.s);
  assert.equal(savedState.app[0].qty,4);assert.equal(savedState.app[1].calibre,32);assert.equal(savedState.app[3].commande.mode,'detecteur');
  await page.evaluate(()=>okteo.saveNow());
  await page.reload();await page.waitForFunction(()=>window.okteoExt);const restored=await page.evaluate(()=>okteo.allApps());assert.equal(restored[0].qty,4);assert.equal(restored[1].calibre,32);assert.equal(restored[3].commande.mode,'detecteur');
  await page.evaluate(()=>okteo.setTab('bibliotheque'));await page.locator('#sy-search').fill('PC32');await page.locator('[data-symbol="PC32"]').click();assert.match(await page.locator('#sy-detail').innerText(),/32 A/);
  await page.screenshot({path:'/tmp/okteo-maj12-symboles.png'});assert.deepEqual(errors,[]);
  console.log('Parcours navigateur MAJ 1/2 réussis : import, propriétés, relecture, annuler/rétablir, export, réouverture et bibliothèque.');
 } finally {await browser?.close();await server.close();}
}
