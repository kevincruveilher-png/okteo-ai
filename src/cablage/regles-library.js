// Présentation uniquement : ne modifie ni le journal vivant, ni les moteurs de calcul.
import { REGLES_BASE } from './regles-data.js';
export const DOMAINS = { dessin: 'Dessin et implantation', circuits: 'Circuits et appareils', pieuvre: 'Pieuvre et câblage', tableau: 'Tableau électrique', documents: 'Repérage et documents' };
export const FAMILIES = {
  boites: 'Boîtes et répartition', gaines: 'Gaines et alimentation', fils: 'Fils, couleurs et raccordements', commandes: 'Éclairage et commandes', prises: 'Prises et cuisine', appareils: 'Appareils et lignes directes', volets: 'Volets roulants', differentiels: 'Différentiels', protections: 'Disjoncteurs et circuits dédiés', coffrets: 'Coffrets et réserve', gtl: 'GTL et emplacement', communication: 'Communication et RJ45', branchement: 'Branchement et liaisons', parafoudre: 'Parafoudre', energie: 'Chauffage et gestion d’énergie', irve: 'Recharge de véhicule', annexes: 'Étages et annexes', reperes: 'Repères et étiquettes', referentiel: 'Référentiel du projet', autres: 'Autres règles'
};
export const TYPES = { dimensionnement: 'Dimensionnement', placement: 'Placement et répartition', raccordement: 'Raccordement', reperage: 'Repérage', controle: 'Contrôle', reference: 'Référence et choix' };
export const VALIDATIONS = { validee: 'Validées', verifier: 'À vérifier', manquante: 'Informations manquantes' };
export const APPLICATIONS = { automatique: 'Automatique', partielle: 'Partiellement intégrée', alerte: 'Alerte seulement', manuel: 'Contrôle manuel', non_integree: 'Pas encore intégrée', a_documenter: 'Application à documenter' };
const M = {};
function group(ids, family, type, domains) {
  for (const n of ids.split(' ').map(Number)) M['R-' + String(n).padStart(3, '0')] = { family, type, domains: domains.split(' ') };
}
group('1 4 5 6 88 94', 'boites', 'placement', 'pieuvre');
group('2', 'commandes', 'raccordement', 'pieuvre circuits');
group('7 8 9', 'boites', 'raccordement', 'pieuvre circuits');
group('10 13 73 75 89', 'gaines', 'raccordement', 'pieuvre');
group('11 12 74 78 99', 'gaines', 'dimensionnement', 'pieuvre');
group('14 95 97', 'gaines', 'raccordement', 'pieuvre circuits');
group('20 70 71 83 93', 'commandes', 'raccordement', 'circuits pieuvre');
group('21 22 85 98', 'prises', 'dimensionnement', 'circuits pieuvre');
group('23 24 30 72 80 90 91 92', 'fils', 'raccordement', 'pieuvre');
group('3 82 84 86', 'appareils', 'raccordement', 'circuits pieuvre');
group('79 87 96 138', 'volets', 'raccordement', 'circuits pieuvre tableau');
group('100', 'appareils', 'placement', 'dessin circuits');
group('31 40 41 60 76 77', 'reperes', 'reperage', 'documents pieuvre');
group('81 149', 'reperes', 'reperage', 'documents tableau');
group('50 119 122 124 127', 'differentiels', 'dimensionnement', 'tableau');
group('120 121 125 126', 'differentiels', 'raccordement', 'tableau circuits');
group('123', 'differentiels', 'placement', 'tableau circuits');
group('101', 'referentiel', 'reference', 'tableau dessin');
group('102 144 146 147', 'coffrets', 'dimensionnement', 'tableau');
group('145 148', 'coffrets', 'placement', 'tableau');
group('103 104 105 106 107 108 109 110 111 112', 'gtl', 'placement', 'tableau dessin');
group('113', 'protections', 'raccordement', 'tableau circuits');
group('114 115 116', 'communication', 'dimensionnement', 'tableau circuits');
group('117 118', 'branchement', 'dimensionnement', 'tableau');
group('128 129 130 132 133 134 139 140', 'protections', 'dimensionnement', 'tableau circuits');
group('131', 'prises', 'placement', 'dessin circuits tableau');
group('135 136 137', 'energie', 'dimensionnement', 'tableau circuits');
group('141 142', 'irve', 'raccordement', 'tableau circuits');
group('143 157 158 159 160 161', 'annexes', 'raccordement', 'tableau circuits');
group('150 151 152 153', 'parafoudre', 'controle', 'tableau');
group('154 155 156', 'energie', 'raccordement', 'tableau circuits');

// Périmètres explicitement relus dans le code v66.1 ; ce n'est pas une certification normative.
const SUPPORT = {};
function support(ids, state, detail, source) {
  for (const n of ids.split(' ').map(Number)) SUPPORT['R-' + String(n).padStart(3, '0')] = { state, detail, source };
}
support('74', 'automatique', 'Le diamètre est calculé à partir des sections de fils ; les cas hors abaque sont signalés.', 'src/cablage/gaine.js · gaineFor');
support('77', 'automatique', 'Les gaines reçoivent un numéro dans le sens prévu par le journal.', 'src/cablage/gaines.js');
support('4', 'automatique', 'Les boîtes verrouillées sont conservées lors du recalcul.', 'src/cablage/boites.js · placeBoxes');
support('20 21 22 85 87 98', 'partielle', 'La répartition utilise les réglages du chantier. Cela ne garantit pas toutes les conditions de la fiche.', 'src/cablage/circuits.js');
support('1 2 7 8 11 13 14 30 31 40 41 70 71 72 73 75 78 79 80 81 82 83 88 89 90 92 93 94 95 96 99', 'partielle', 'Une partie est calculée ou contrôlée dans le câblage. Les choix du chantier et les cas particuliers restent à vérifier.', 'src/cablage/etude.js, circuits.js, gaines.js et boites.js');
support('9', 'non_integree', 'Le mode Plug reste bloqué : la règle doit être complétée avant utilisation.', 'src/ext/regles-ui.js · choix du chantier');
support('84 86 97 100', 'partielle', 'Des choix ou propositions existent dans l’interface ; le dessinateur doit vérifier le résultat.', 'src/cablage/appareils.js, horsplan.js');
support('102 119 122 123 124 127 128 144 147 148', 'partielle', 'La composition et les alertes du tableau en utilisent une partie. Les matériels restent génériques et le BE valide les cas particuliers.', 'src/cablage/tableau.js · autoTableau, tableauIssues, suggestModel');
support('105 116 129 130 134', 'alerte', 'Une alerte vérifie certains cas. Elle ne corrige pas automatiquement les équipements ou les circuits.', 'src/cablage/tableau.js · tableauIssues');
support('120 121', 'partielle', 'La répartition distingue les circuits spécialisés et communs. Tous les types de différentiels ne sont pas modélisés.', 'src/cablage/tableau.js · needsA');
support('146 154 155 156', 'partielle', 'Ajout manuel d’appareils génériques et comptage des modules ; pas de choix automatique de référence ni de raccordement.', 'src/cablage/tableau.js · MODS, addModular');
support('103 104 106 107 108 109 110 111 112 113 114 115 117 118 125 126 131 132 133 135 136 137 138 140 143 145 149 157 158 159 160 161', 'manuel', 'La fiche sert de guide au BE. Aucun contrôle complet de cette règle n’est établi dans le moteur du tableau.', 'Relecture du périmètre de src/cablage/tableau.js');
support('101 141 142 150 151 152 153', 'non_integree', 'Le moteur du tableau ne prend pas encore en charge cette décision automatiquement.', 'docs/journal.md · version 66');
const CONTEXT = {
  boites: ['Lors de la répartition des appareils entre les boîtes.', 'Vérifier les appareils desservis et les choix de répartition.', 'Ouvrir la fiche avant de déplacer ou de verrouiller une boîte.'],
  gaines: ['Lors du calcul ou de la modification des gaines.', 'Comparer le contenu, le tracé et les caractéristiques avec la règle.', 'Une modification du contenu d’une gaine peut nécessiter de revoir son dimensionnement.'],
  fils: ['Lors du raccordement des fils dans une boîte.', 'Contrôler les circuits, les couleurs et les raccordements concernés.', 'Consulter la fiche en lisant une bande de câblage.'],
  commandes: ['Lors de l’association d’une commande à ses lumières.', 'Vérifier les liaisons et le mode de commande.', 'Pour un va-et-vient, rechercher « va-et-vient » avant de relire ses raccordements.'],
  differentiels: ['Lors de la composition ou du contrôle du tableau.', 'Identifier les circuits concernés et vérifier les conditions de la règle.', 'Pour choisir un calibre, consulter R-124 et les circuits qui seront placés sous le différentiel.'],
  coffrets: ['Lors du choix du coffret et de l’organisation des rangées.', 'Comparer la capacité du coffret aux appareils installés et à la réserve.', 'R-144 : avec 40 modules occupés, une capacité de 50 laisse 10 modules libres, soit 20 %.'],
  gtl: ['Lors du choix de l’emplacement du tableau.', 'Relever les dimensions et les conditions du local avant de conclure.', 'Une hauteur se vérifie avec le sol fini comme référence si la règle le précise.'],
  reperes: ['Lors de la lecture ou de la production des plans et bandes.', 'Vérifier que le repère permet de retrouver le même élément dans les documents.', 'Partir du numéro d’une gaine pour retrouver sa ligne dans la bande.']
};
export const normalize = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, ' ').replace(/[^a-z0-9-]+/g, ' ').trim();
const ALIASES = [ ['ballon','cumulus','chauffe-eau','chauffe eau'], ['differentiel','differentiels','ddr','interrupteur differentiel'], ['irve','borne','recharge','voiture'], ['terre','equipotentielle'], ['gaine','icta'], ['lave linge','ll'], ['lave vaisselle','lv'], ['volet','volets','vr'], ['reserve','libre','libres'], ['coffret','coffrets'], ['disjoncteur','disjoncteurs'], ['boite','boites'], ['prise','prises'] ];
export function validationOf(r) {
  if (r.certitude === 'inconnue') return 'manquante';
  return r.certitude === 'confirmee' && r.statut === 'active' ? 'validee' : 'verifier';
}
export function libraryMeta(r) {
  const fallback = { boites: ['boites','pieuvre'], gaines: ['gaines','pieuvre'], raccordements: ['fils','pieuvre'], circuits: ['protections','circuits'], allumages: ['commandes','circuits'], appareils: ['appareils','circuits'], tableau: ['coffrets','tableau'] }[r.categorie] || ['autres','pieuvre'];
  const m = M[r.id] || { family: fallback[0], domains: [fallback[1]], type: 'reference' };
  const base = REGLES_BASE.rules.find((b) => b.id === r.id);
  const unchanged = base && ['titre','description','details','condition','action','parametres','parametres_texte','categorie'].every((k) => JSON.stringify(base[k]) === JSON.stringify(r[k]));
  const application = unchanged && SUPPORT[r.id] || { state: 'a_documenter', detail: base ? 'Règle modifiée ou prise en charge non documentée : faire vérifier son application dans cette version.' : 'Nouvelle règle : son application dans le logiciel reste à documenter.', source: '' };
  const context = CONTEXT[m.family] || ['Lorsque le projet comporte les équipements décrits dans cette fiche.', 'Vérifier les conditions, les choix du chantier et les informations encore manquantes.', 'Rechercher le nom de l’équipement, puis consulter les conditions et les règles associées.'];
  const plain = String(r.description || '').replace(/[`*]/g, '').replace(/\s+/g, ' ').trim();
  return { ...m, validation: validationOf(r), application, summary: plain.length > 165 ? plain.slice(0,162) + '…' : plain, when: r.condition || context[0], action: r.action || context[1], example: context[2] };
}
export function matchesWords(value, query) {
  let hay = normalize(value), q = normalize(query);
  for (const synonyms of ALIASES) {
    const words = synonyms.map(normalize);
    if (words.some((w) => (' ' + hay.replace(/-/g, ' ') + ' ').includes(' ' + w.replace(/-/g, ' ') + ' '))) hay += ' ' + words.join(' ');
  }
  // Les tirets ne doivent pas empêcher « chauffe eau » de retrouver « chauffe-eau ».
  const text = hay + ' ' + hay.replace(/-/g,' ');
  return q.split(/\s+/).filter(Boolean).every((w) => text.includes(w));
}
export function libraryRules(J, F = {}) {
  const waiting = new Set((J.questions || []).filter((q) => q.statut === 'attente').map((q) => q.id));
  return J.rules.filter((r) => {
    const m = libraryMeta(r);
    return (F.archives || r.statut !== 'archivee') && (!F.domain || m.domains.includes(F.domain))
      && (!F.family || m.family === F.family) && (!F.type || m.type === F.type)
      && (!F.validation || m.validation === F.validation) && (!F.application || m.application.state === F.application)
      && (!F.cert || r.certitude === F.cert) && (!F.statut || r.statut === F.statut)
      && (!F.attente || (r.questions_liees || []).some((id) => waiting.has(id)))
      && matchesWords([r.id,r.titre,r.description,...(r.details || []),r.source,r.parametres_texte,JSON.stringify(r.parametres),FAMILIES[m.family],...m.domains.map((d) => DOMAINS[d])].join(' '), F.q);
  }).sort((a,b) => a.id.localeCompare(b.id, 'fr', { numeric: true }));
}
export function facetCounts(J, F, key, options) {
  return Object.fromEntries(Object.keys(options).map((v) => [v, libraryRules(J, { ...F, [key]: v }).length]));
}
