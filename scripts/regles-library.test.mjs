import assert from 'node:assert/strict';
import { REGLES_BASE as J } from '../src/cablage/regles-data.js';
import { libraryMeta, libraryRules, validationOf, facetCounts, DOMAINS, FAMILIES, TYPES, APPLICATIONS } from '../src/cablage/regles-library.js';
const original = JSON.stringify(J);
let n=0;
function test(name,fn){fn();n++;console.log('✓ '+name);}
const ids = f => libraryRules(J,f).map(r=>r.id);
test('Chaque règle possède un domaine, une famille, un type et une application explicite',()=>{
 for(const r of J.rules){const m=libraryMeta(r);assert(FAMILIES[m.family]);assert(TYPES[m.type]);assert(APPLICATIONS[m.application.state]);assert(m.domains.every(d=>DOMAINS[d]));}
});
test('Règles partagées accessibles dans plusieurs domaines sans duplication',()=>{
 assert(ids({domain:'tableau'}).includes('R-130'));assert(ids({domain:'circuits'}).includes('R-130'));
 assert.equal(new Set(ids({})).size,ids({}).length);
});
test('Archives cachées par défaut et consultables volontairement',()=>{assert(!ids({}).includes('R-076'));assert(ids({archives:true}).includes('R-076'));});
test('Recherche sans accents, synonymes, identifiant, plusieurs mots et terme absent',()=>{
 assert(ids({q:'differentiel calibre'}).includes('R-124'));assert(ids({q:'ballon'}).includes('R-135'));
 assert(ids({q:'chauffe eau'}).includes('R-135'));assert.deepEqual(ids({q:'R-144'}),['R-144']);assert.equal(ids({q:'zzzz_inexistant'}).length,0);
});
test('Filtres combinés et compteurs concordants',()=>{
 const F={domain:'tableau',family:'differentiels',validation:'verifier'};
 assert(ids(F).includes('R-124'));
 assert.equal(facetCounts(J,F,'application',APPLICATIONS).partielle,libraryRules(J,{...F,application:'partielle'}).length);
 assert(libraryRules(J,F).every(r=>libraryMeta(r).family==='differentiels'&&validationOf(r)==='verifier'));
});
test('Validation indépendante de l’automatisation ; une règle désactivée ne devient pas validée',()=>{
 const r=J.rules.find(r=>r.id==='R-074');assert.equal(libraryMeta(r).application.state,'automatique');
 assert.equal(validationOf({...r,certitude:'confirmee',statut:'desactivee'}),'verifier');
 assert.equal(validationOf({...r,certitude:'inconnue',statut:'active'}),'manquante');
});
test('Une règle locale modifiée ou inconnue ne revendique pas une automatisation',()=>{
 const r=J.rules.find(r=>r.id==='R-074');assert.equal(libraryMeta({...r,description:'Règle locale différente'}).application.state,'a_documenter');
 assert.equal(libraryMeta({...r,id:'R-999'}).application.state,'a_documenter');
});
test('Le texte historique, les sources, les IDs et les statuts ne sont jamais modifiés',()=>{libraryRules(J,{q:'gaine'});assert.equal(JSON.stringify(J),original);});
console.log(`${n} vérifications de la bibliothèque réussies.`);
