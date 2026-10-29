// MAJ 3/4 : propositions métier distinctes des observations et alimentation détecteur justifiée.
import assert from 'node:assert/strict';
import {proposeEquipements, implantationPending} from '../src/cablage/equipements.js';
import {permanentDetector, manuallyControlledLights} from '../src/cablage/detecteur.js';
import {readingData} from '../src/walls/ai-data.js';
import {computeCircuits} from '../src/cablage/circuits.js';
import {computeWiring} from '../src/cablage/gaines.js';
import {CAB_DEFAULTS as S} from '../src/cablage/settings.js';
let n=0; const test=(name,f)=>{f();n++;console.log('  ✓ '+name);};
const rect=(x,y,w,h)=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
const rooms=[{name:'Cuisine',lv:'rdc',poly:rect(0,0,4,4)},{name:'Cellier',lv:'etage',poly:rect(4,0,4,4)}];
const run=items=>proposeEquipements({items,rooms,level:'rdc'});
const p=run([{id:'tv',t:'TV'}]);
test('Cinq équipements et antenne si TV, dans les pièces et niveaux prévus, tous provisoires',()=>{assert.deepEqual(p.adds.map(a=>a.t),['FOUR','LV','PLAQ','LL','SL','ANT']);assert.ok(p.adds.every(implantationPending));assert.equal(p.adds.find(a=>a.t==='LL').lv,'etage');assert.ok(p.adds.slice(0,3).every(a=>a.x>=0&&a.x<=4));});
test('Relance sans doublon, positions manuelles confirmées conservées',()=>{const items=p.adds.map((a,i)=>({...a,id:'a'+i}));items[0].x=2.8;items[0].implantation.etat='confirmee';assert.deepEqual(run(items),{adds:[],updates:[]});assert.equal(items[0].x,2.8);});
test('Prise 32 A en cuisine : même objet, calibre et lecture conservés ; usage cuisson métier',()=>{const a={id:'32',t:'PC32',room:'Cuisine',x:2,y:3,calibre:32,aiReading:{t:'PC20'}};const q=run([a]);assert.ok(!q.adds.some(a=>a.t==='PLAQ'));assert.equal(q.updates[0].t,'PLAQ');assert.equal(q.updates[0].implantation.etat,'confirmee');assert.equal(a.t,'PC32');assert.equal(a.calibre,32);});
test('Indication de principe : position existante conservée mais halo obligatoire',()=>{const q=run([{id:'32',t:'PC32',room:'Cuisine',inscription:'32 A voir plan cuisine'}]);assert.ok(implantationPending(q.updates[0]));});
test('Équipements explicitement lus et antenne existante non déplacés, absence TV sans antenne inventée',()=>{assert.ok(!run([]).adds.some(a=>a.t==='ANT'));const q=run([{id:'ant',t:'ANT',x:8,y:1},{id:'four',t:'FOUR',x:1,y:3},{id:'tv',t:'TV'}]);assert.equal(q.updates.length,0);assert.ok(!q.adds.some(a=>['ANT','FOUR'].includes(a.t)));});
test('Pièces absentes : proposition repérée à préciser, jamais observation prétendue',()=>{const q=proposeEquipements({items:[],level:'rdc',frame:{x0:2,x1:12,y0:0,y1:8}});assert.equal(q.adds[0].x,7);assert.match(q.adds[0].implantation.motif,/non identifiée/);assert.ok(q.adds.every(a=>a.aiOrigin==='regle'));});
test('État implantation filtré et conservé par le même chemin de données que les appareils',()=>{assert.deepEqual(readingData({implantation:{etat:'a_preciser',piece:'Cuisine',custom:123}}),{implantation:{etat:'a_preciser',piece:'Cuisine'}});assert.deepEqual(readingData({implantation:{etat:'evil'}}),{});});
const commande={mode:'detecteur',detecteur:'integre',alimentation:'permanente',preuve:'Applique avec détecteur intégré, alimentation permanente indiquée'};
const tab={id:'tab',t:'TAB',lv:'rdc',x:0,y:0,h:180,rep:'TD1'};
const lamp={id:'l',t:'APP',lv:'rdc',x:3,y:2,h:180,rep:'AP1',commande};
function wiring(a,links=[],other=[]){const items=[tab,a,...other],circuits=computeCircuits(items,links,S);return computeWiring({items,links,circuits,boxes:[{id:'b',n:'LI01',lv:'rdc',x:2,y:2,apps:[a.id,...other.map(a=>a.id)]}],levels:['rdc'],S});}
test('Détecteur intégré : preuve et alimentation permanente toutes nécessaires',()=>{assert.ok(permanentDetector(lamp));for(const c of [{...commande,preuve:''},{...commande,detecteur:'separe'},{...commande,alimentation:'inconnue'},{...commande,mode:'manuelle'}])assert.ok(!permanentDetector({...lamp,commande:c}));assert.ok(!permanentDetector({...lamp,t:'PC16'}));});
test('Applique confirmée : phase/neutre/terre 1,5 mm², même phase alimentation, sans retour flottant',()=>{const w=wiring(lamp),b=w.boxes[0],g=b.gaines.find(g=>g.appIds?.includes('l')||g.id==='l');assert.ok(g,JSON.stringify(b.gaines));assert.deepEqual(g.wires.map(x=>x.fn).sort(),['neutre','phase','terre']);assert.ok(g.wires.every(x=>x.section===1.5));const phase=b.nets.find(n=>n.fn==='phase');assert.ok(phase.wires.length>=2);assert.ok(!b.nets.some(n=>n.fn==='retour'));assert.ok(!w.issues.some(t=>/sans commande/.test(t)));});
test('Applique extérieure : câble 3G1,5, phase sur même borne que alimentation',()=>{const w=wiring({...lamp,ext:true}),b=w.boxes[0],g=b.gaines.find(g=>g.appId==='l');assert.equal(g.cable,'3G1,5');const phase=g.wires.find(f=>f.fn==='phase'),alim=b.gaines.find(g=>g.kind==='alim');assert.equal(phase.net,alim.wires.find(f=>f.fn==='phase').net);assert.equal(phase.n,alim.wires.find(f=>f.fn==='phase').n);assert.equal(phase.core,'marron');});
test('Détecteur séparé ou non prouvé reste une commande à résoudre',()=>{for(const commande of [{mode:'detecteur',detecteur:'separe',alimentation:'permanente',preuve:'DET'},null]){const w=wiring({...lamp,commande});assert.ok(w.issues.some(t=>/sans commande/.test(t)));assert.ok(w.boxes[0].nets.some(n=>n.fn==='retour'));}});
test('Commande manuelle contradictoire : doute bloquant et aucun raccordement permanent silencieux',()=>{const w=wiring(lamp,[{c:'i',l:'l'}],[{id:'i',t:'INT',lv:'rdc',x:1,y:1,rep:'I1'}]);assert.ok(w.doutes.some(d=>d.bloquant&&/détecteur intégré/.test(d.text)));assert.ok(w.boxes[0].nets.some(n=>n.fn==='retour'));});
test('Contradiction transmise par chaîne ou autre boîte : alimentation permanente interdite',()=>{const items=[tab,lamp,{id:'l2',t:'LUM',rep:'L2',lv:'rdc',x:4,y:2},{id:'i',t:'INT',rep:'I1',lv:'rdc',x:1,y:1}],links=[{c:'i',l:'l2'},{c:'l2',l:'l'}];assert.ok(manuallyControlledLights(items,links).has('l'));const w=computeWiring({items,links,circuits:computeCircuits(items,links,S),boxes:[{id:'b',n:'LI01',lv:'rdc',x:2,y:2,apps:['l']}],levels:['rdc'],S});assert.ok(w.doutes.some(d=>d.bloquant&&/détecteur intégré/.test(d.text)));assert.ok(w.boxes[0].nets.some(n=>n.fn==='retour'));});
console.log(`${n} vérifications équipements/détecteurs réussies.`);

if(process.argv.includes('--browser')){
 const {chromium}=await import('playwright'),{createServer}=await import('vite');
 const server=await createServer({server:{port:5205,strictPort:true,open:false},logLevel:'error'});let browser;
 try{
  await server.listen();browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1500,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:5205');await page.waitForFunction(()=>window.okteoExt);await page.evaluate(()=>localStorage.clear());await page.reload();await page.waitForFunction(()=>window.okteoExt);
  await page.evaluate(()=>{okteoExt.iaMode.setMode('be');okteo.setTab('plan');okteo.importDevices([{t:'TV',x:2,y:2}],[],{replace:true});});
  await page.evaluate(()=>okteo.setTab('etude'));await page.click('#et-equipements');
  const all=await page.evaluate(()=>okteo.allApps());assert.equal(all.length,7);assert.equal(all.filter(a=>a.implantation?.etat==='a_preciser').length,6);
  await page.click('#et-equipements');assert.equal(await page.evaluate(()=>okteo.allApps().length),7);
  const four=all.find(a=>a.t==='FOUR');await page.evaluate(id=>{okteo.setTab('plan');okteo.select([id]);},four.id);
  assert.match(await page.locator('.placement-note').textContent(),/emplacement à préciser/);
  assert.equal(await page.locator('#fx .fx-placement:not(.gone)').count(),6);
  // Déplacement réel par les propriétés : ne confirme pas l'emplacement implicitement.
  await page.evaluate(id=>{okteo.state.app.find(a=>a.id===id).x+=.6;window.__okteo.draw();},four.id);
  assert.equal(await page.locator('#fx .fx-placement:not(.gone)').count(),6);
  await page.click('#f-placement-confirm');assert.equal(await page.locator('#fx .fx-placement:not(.gone)').count(),5);
  await page.keyboard.press('Control+z');assert.equal(await page.locator('#fx .fx-placement:not(.gone)').count(),6);await page.keyboard.press('Control+y');
  const exported=await page.evaluate(()=>okteo.exportGeometry().apps.find(a=>a.t==='FOUR'));assert.equal(exported.implantation.etat,'confirmee');
  await page.screenshot({path:'/tmp/okteo-maj34-halo.png'});
  const serialized=await page.evaluate(async()=>{const{buildOkteo}=await import('/src/ext/okteo-file.js');return JSON.parse(await(await buildOkteo(okteo.ch,okteo.packData())).text());});assert.equal(JSON.parse(serialized.dessin.s).app.find(a=>a.t==='FOUR').implantation.etat,'confirmee');
  await page.evaluate(()=>okteo.saveNow());await page.reload();await page.waitForFunction(()=>window.okteoExt);assert.equal(await page.evaluate(id=>okteo.allApps().find(a=>a.id===id).implantation.etat,four.id),'confirmee');
  // Proposition multi-niveaux et annulation atomique : niveau ouvert inchangé.
  const mult=await page.evaluate(()=>{const before=okteo.allApps().length,cur=okteo.level.id;okteo.addLevel('Étage');const lv=okteo.level.id;okteo.switchLevel(cur);okteo.applyEquipmentProposal({adds:[{t:'SL',lv,x:1,y:1,implantation:{etat:'a_preciser'}}]});return{before,cur,lv,now:okteo.level.id,total:okteo.allApps().length};});assert.equal(mult.now,mult.cur);assert.equal(mult.total,mult.before+1);await page.keyboard.press('Control+z');assert.equal(await page.evaluate(()=>okteo.allApps().length),mult.before);
  // Détecteur : contrôle initial, lecture confirmée, contradiction manuelle.
  await page.evaluate(()=>{okteo.importDevices([{t:'APP',x:1,y:1}],[],{replace:true});});const id=await page.evaluate(()=>okteo.state.app[0].id);
  assert.ok(await page.evaluate(id=>okteo.control.some(c=>c.kind==='lum'&&c.ids.includes(id)),id));
  await page.evaluate(({id,commande})=>okteo.updateApps([{id,commande}]),{id,commande});assert.ok(!await page.evaluate(id=>okteo.control.some(c=>c.kind==='lum'&&c.ids.includes(id)),id));
  await page.evaluate(({commande})=>okteo.importDevices([{t:'INT',x:0,y:0},{t:'APP',x:2,y:2,commande}],[{c:0,l:1}],{replace:true}),{commande});assert.ok(await page.evaluate(()=>okteo.control.some(c=>c.kind==='detecteur')));
  const cab=await page.evaluate(async()=>{
    const {cabler}=await import('/src/ext/etude-ui.js'),{computeCircuits}=await import('/src/cablage/circuits.js'),{getCab,setCab}=await import('/src/cablage/settings.js'),R=await import('/src/cablage/regles.js');
    setCab({circuitsParBoite:false});okteo.importDevices([{t:'TV',x:1,y:1}],[],{replace:true});
    const c=computeCircuits(okteo.allApps(),[],getCab())[0];c.id='manual9';c.note='Conservé par le BE';okteo.setCab({circuits:[c],boxes:[]});
    const before=JSON.stringify(okteo.packData()),J=R.getJournal();R.apply(J,R.propose(J,{op:'modifier',id:'R-074',patch:{certitude:'inconnue',si_doute:'bloquer'},motif:'essai MAJ3'}));
    const blocked=cabler(okteo),same=JSON.stringify(okteo.packData())===before;R.resetJournal();
    const result=cabler(okteo);return{blocked:!blocked.ok,same,ok:result.ok,count:okteo.allApps().length,manual:okteo.cab.circuits.find(c=>c.id==='manual9'),circuits:okteo.cab.circuits.length};
  });assert.ok(cab.blocked&&cab.same&&cab.ok);assert.equal(cab.count,7);assert.equal(cab.manual.note,'Conservé par le BE');assert.ok(cab.circuits>=6);await page.keyboard.press('Control+z');assert.equal(await page.evaluate(()=>okteo.allApps().length),1);
  assert.deepEqual(errors,[]);console.log('Parcours navigateur MAJ 3/4 réussis : ajout sans doublon, halos, confirmation, annulation, export, réouverture, multi-niveaux et détecteurs.');
 }finally{await browser?.close();await server.close();}
}
