Tu dois concevoir et développer Oktéo AI, un nouveau logiciel de dessin destiné à un bureau d’études de pieuvres électriques. Tu ne disposes d’aucune mémoire des discussions précédentes : ce document constitue ton contexte de référence.

Objectif : produire un logiciel fonctionnel, précis, moderne et agréable à utiliser toute la journée. Ne te limite pas à une description, une maquette ou des boutons sans fonction. Avance par étapes testables et livre le code source, les instructions de lancement et les résultats des vérifications.
1. Contexte et décisions techniques
Nous repartons d’une page blanche. Un ancien prototype a permis d’identifier les besoins et les défauts à éviter ; il ne constitue pas une architecture imposée.
- C# est le langage principal. Justifie les technologies complémentaires nécessaires au rendu dans le navigateur.
- La première version sera une application accessible par navigateur, sans installation sur les postes.
- Plusieurs personnes, éventuellement sur plusieurs sites de l’entreprise, doivent pouvoir travailler simultanément sur des chantiers différents.
- Un seul utilisateur peut modifier un chantier à la fois. Les autres utilisateurs autorisés peuvent le consulter en lecture seule, avec indication de la personne qui le modifie.
- Prévoir une gestion robuste des fermetures inattendues et déconnexions pour éviter les verrous permanents et les écrasements.
- L’application installable sur Windows reste une évolution possible, pas un livrable obligatoire de première version.
- Éviter une architecture de prototype jetable nécessitant de réécrire le produit final.
- Si ton environnement ne permet pas d’exécuter ou d’héberger la solution C#, explique précisément la limite et fournis un projet exécutable ailleurs. Ne remplace pas silencieusement le besoin par une simple démonstration JavaScript.
L’entreprise souhaite maîtriser le logiciel : code source complet, données exportables, procédures de compilation et de déploiement, dépendances documentées avec leurs licences. Ne promets pas la propriété exclusive de composants tiers.
2. Fonctionnement manuel et IA
Toutes les fonctions métier essentielles doivent être utilisables sans IA.

L’accès par Internet est accepté pour la première version. Un fonctionnement intégral hors connexion n’est plus une obligation initiale. En revanche, prévoir :
- sauvegarde automatique ;
- protection locale du travail non encore synchronisé, dans les limites du navigateur ;
- état visible : enregistré, en cours, non synchronisé ou erreur ;
- récupération après coupure sans écrasement silencieux ;
- sauvegardes serveur et restauration à prévoir pour la production.
Préparer une couche de connexion aux moteurs d’IA par API, séparée du moteur de dessin. Le logiciel devra pouvoir préparer une demande, recevoir un résultat structuré, le contrôler et proposer son intégration.

La reconnaissance de plans constitue un futur usage majeur. D’autres usages doivent pouvoir être ajoutés sans réécriture générale. Les propositions de l’IA doivent rester modifiables et les incertitudes visibles. Les secrets d’API ne doivent pas être exposés dans le navigateur.
3. Première version : périmètre fonctionnel
La première version doit permettre de :
1. Créer, enregistrer, rouvrir et gérer plusieurs chantiers.
2. Partir d’une page blanche ou importer un fond de plan.
3. Dessiner et modifier le bâtiment en 2D.
4. Placer et modifier les appareils électriques.
5. Créer des liaisons fonctionnelles, par exemple entre un interrupteur et les points lumineux qu’il commande.
Les liaisons fonctionnelles ne constituent pas encore un calcul de câblage. La composition des fils, les câbles, les boîtes de pieuvre, les bandes de câblage et les exports de fabrication sont prévus pour une étape ultérieure.

Préparer les données pour ces évolutions sans introduire prématurément des règles électriques supposées. Les anciennes habitudes métier devront être documentées et validées avant leur automatisation.
4. Import et fond de plan
Accepter les PDF et plusieurs formats d’image usuels, notamment PNG et JPEG. Les sources peuvent être des scans ou des photos de plans prises au téléphone dans de mauvaises conditions.

Prévoir :
- choix de la page d’un PDF ;
- recadrage et rotation ;
- redressement et correction de perspective pour les photos ;
- mise à l’échelle à partir d’une longueur connue ;
- conservation du fichier original ;
- verrouillage du fond pour éviter son déplacement accidentel.
Ne prétends pas obtenir des dimensions fiables à partir d’une photo sans référence. Une photo déformée ou un document peu lisible doit pouvoir être signalé comme imprécis.

Un curseur « Visibilité du fond de plan », directement accessible, doit permettre de rendre le fond bien visible, très pâle ou complètement masqué. Ce réglage :
- agit immédiatement ;
- n’affecte pas les appareils et liaisons ajoutés ;
- conserve l’échelle et la position ;
- reste enregistré avec le projet ;
- ne modifie pas l’original.
5. Socle de dessin précis et simple
Inspire-toi des usages éprouvés des logiciels de dessin, sans copier leur interface et sans accumuler des outils sans intérêt pour notre métier.

Le socle comprend :
- unités et échelle cohérentes ;
- murs, pièces, portes et fenêtres ;
- dimensions et sens d’ouverture des portes modifiables ;
- saisie précise des longueurs, positions et angles ;
- accrochage aux extrémités, milieux et intersections ;
- aides d’alignement et contraintes horizontales ou verticales ;
- mesure et cotation ;
- sélection simple et multiple ;
- déplacement, duplication, rotation et symétrie ;
- annuler et rétablir ;
- calques ou catégories pouvant être masqués et verrouillés.
Exigence essentielle : sélectionner ou déplacer un objet doit permettre de connaître et régler sa position précisément, pas uniquement à l’œil.

Exemple : placer une prise à 30 cm d’un angle, puis la déplacer de 10 cm. Distinguer :
- coordonnées dans le plan ;
- distance au repère choisi, clairement identifié ;
- hauteur de pose.
Les fonctions courantes doivent rester immédiatement accessibles. Les paramètres moins fréquents peuvent être dans les propriétés contextuelles.
6. Appareils et liaisons
Prévoir un catalogue extensible utilisant les appellations familières du bureau d’études : prises, points lumineux, interrupteurs, va-et-vient, boutons-poussoirs et autres équipements à préciser.
- Symboles lisibles, cohérents et identifiables autrement que par la couleur seule.
- Propriétés directement accessibles au clic.
- Placement répété sans sélectionner à nouveau l’outil.
- Liaisons attachées aux objets : elles suivent leurs déplacements.
- Possibilité de relier plusieurs commandes et points lumineux selon les besoins fonctionnels.
- Aucune déduction de fils ou de câbles dans cette première étape.
Fonction retenue avec intérêt : test visuel des commandes. Dans un mode de test distinct du dessin, cliquer sur une commande doit mettre en évidence les lumières associées ou les afficher allumées. Ce test vérifie les associations définies ; il ne certifie ni le câblage ni la conformité électrique.
7. Une interface de travail unifiée
L’ancien prototype faisait perdre du temps en obligeant à passer entre des écrans « plan », « implantation », « affectation » et « boîtes ». Éviter ce fonctionnement.
- Le plan constitue l’espace principal commun au dessin, à l’implantation et aux liaisons.
- Les outils et propriétés s’adaptent à la sélection.
- Conserver le zoom, le cadrage et la sélection lors de l’ouverture d’un panneau.
- L’espace de travail tient dans la fenêtre : ne pas empiler les résultats sous le plan dans une longue page à faire défiler.
Pour accéder aux documents et futurs résultats, prévoir des onglets visibles, comme les intercalaires d’un classeur, à gauche par défaut.

À terme : « Boîtes », « Bandes de câblage », « Lignes directes », etc. Un clic ouvre le contenu correspondant dans un panneau ou un espace agrandissable. Le retour au plan retrouve son état précédent.

Ces onglets de résultats sont compatibles avec l’espace de dessin unifié : ils ne doivent pas imposer plusieurs modes pour effectuer les opérations courantes sur le plan.

Les fonctions futures ne doivent pas être présentées comme opérationnelles avant leur développement.
8. Réduire systématiquement les interactions
Pour chaque parcours, analyser :
- nombre de clics ;
- déplacements de souris ;
- saisies répétées ;
- informations à rechercher ;
- changements d’outil.
Exemples attendus :
- choisir un appareil une fois, puis le poser plusieurs fois ;
- modifier une dimension directement ;
- accéder au résultat concernant un objet depuis cet objet ;
- conserver les réglages utiles ;
- éviter les confirmations répétitives pour des actions facilement annulables.
L’objectif est la rapidité avec compréhension et précision, pas la réduction artificielle des clics au prix d’actions ambiguës.
9. Navigation et raccourcis personnalisables
Configuration initiale souhaitée :
- clic gauche : sélectionner ou utiliser l’outil actif ;
- clic droit maintenu et glissé : déplacer la vue ;
- clic droit bref : menu contextuel lorsque pertinent ;
- molette : zoom centré sur le pointeur ;
- Échap : sortir ou annuler l’action en cours.
La navigation doit rester disponible pendant le dessin ou la pose, sans perdre l’opération en cours.

Prévoir un menu « Raccourcis et commandes », comparable au réglage des commandes d’un jeu :
- attribution des touches et gestes pris en charge ;
- raccourcis pour les outils et les appareils ;
- détection des doublons ;
- indication des limitations du navigateur ;
- restauration des valeurs par défaut ;
- sauvegarde par utilisateur.
Exemple : R active la pose d’un point lumineux, aperçu sous le pointeur, puis clic pour le placer. L’outil reste actif pour les suivants.

Les raccourcis de dessin ne doivent pas se déclencher pendant la saisie d’un texte ou d’une dimension.
10. Esthétique, confort et personnalisation
Nous voulons un logiciel moderne, agréable, donnant envie d’y travailler toute la journée.

La charte de l’entreprise sera fournie par son logo :
- fond blanc pour le thème de référence ;
- bleu ;
- rouge-orangé ;
- teintes exactes à relever sur le logo, sans les inventer comme définitives.
Prévoir :
- mode jour et mode nuit ;
- plusieurs thèmes prêts à utiliser ;
- aperçu immédiat ;
- personnalisation des fonds, panneaux, textes et couleurs d’accent ;
- variantes enregistrables par utilisateur ;
- retour facile au thème par défaut.
L’utilisateur n’exclut aucune palette par principe. Prévoir une aide à la lisibilité sans imposer arbitrairement une seule apparence.

Les couleurs métier et les documents imprimés doivent être indépendants des préférences esthétiques personnelles.

Chaque utilisateur doit pouvoir organiser son espace :
- panneaux à gauche ou à droite ;
- redimensionnement et repli ;
- ordre des onglets ;
- outils favoris ;
- thème et raccourcis personnels ;
- réinitialisation de la disposition.
Les préférences suivent le compte, avec adaptation à la taille de l’écran, et ne modifient ni le chantier ni l’interface des collègues.
11. Exigence d’exploration créative
Ne te contente pas d’exécuter littéralement une liste de boutons.

Explore plusieurs solutions en t’inspirant aussi :
- des applications créatives ;
- des jeux et de leurs commandes personnalisables ;
- des interfaces modernes ;
- des travaux sur l’ergonomie et le confort de travail.
Propose des améliorations auxquelles nous n’avons pas pensé. Explique leurs bénéfices et leurs limites à l’aide de scénarios concrets et de prototypes.

Le résultat doit associer plaisir visuel, fluidité, précision, faible effort d’apprentissage et facilité de récupération après erreur.

Aucune piste n’est exclue a priori de la réflexion. Cela n’impose pas de tout développer en première version : distingue exploration, expérimentation et fonctionnalités validées.
12. 3D : prévoir dès la conception, expérimenter par pièce
Conserver une possibilité de vue 3D, même si son utilité quotidienne reste à évaluer.

Premier scénario :
- sélectionner une pièce ;
- l’afficher en 3D ;
- positionner un appareil sur une face de mur ;
- régler sa hauteur et sa distance à une porte ou un angle ;
- retrouver la modification en 2D ;
- proposer aussi une vue de face du mur.
La 2D et la 3D doivent utiliser les mêmes objets et les mêmes données, sans deux copies divergentes du chantier.

Prévoir les informations nécessaires : hauteur des murs, niveaux de référence, ouvertures, face du mur et hauteur des appareils. Les valeurs inconnues doivent être renseignées ou explicitement proposées comme hypothèses.

Commencer par une expérimentation sur une pièce. La maison entière n’est pas nécessaire pour démontrer l’intérêt. Le module doit pouvoir être désactivé sans casser le travail en 2D.
13. Autres évolutions à conserver
Comparaison de versions de plans — idée acceptée :

Importer un nouveau plan, l’aligner avec l’ancien et faire ressortir les différences possibles : cloison, porte, ouverture ou implantation modifiée. Signaler les appareils potentiellement concernés. Prévoir correction manuelle de l’alignement et incertitudes visibles. Ne jamais déplacer automatiquement le travail sans action explicite.

Règles métier — prévues pour une seconde étape :

Distinguer les règles de base communes et les règles spécifiques par pavillonneur. Leur contenu, leurs priorités et leurs exceptions seront définis plus tard. Ne pas inventer ces règles.

Commande vocale — piste ultérieure avec réserve forte :

Une tentative précédente a été très insatisfaisante. Elle ne doit pas ralentir le parcours clavier-souris ni devenir indispensable. Si un prototype est réalisé, exiger des demandes simples correctement comprises, un aperçu et une correction ou annulation facile.

Variantes d’implantation — proposition à confirmer :

Pouvoir essayer une alternative, la comparer et revenir à l’original. Cette idée a été proposée, mais sa priorité n’a pas été explicitement validée.

Production et échanges — étapes suivantes :

Boîtes de pieuvre, fils et câbles, bandes de câblage, lignes directes, exports de fabrication et échanges avec d’autres logiciels, notamment par fichiers CSV ou connecteurs. Les formats exacts seront documentés avec des exemples réels.
14. Accès et protection
L’objectif est d’empêcher qu’une simple copie permette une utilisation non autorisée.

Avec l’orientation web retenue, prévoir comptes, authentification et autorisations contrôlées côté serveur. Ne pas confondre masquage de boutons et protection réelle.

Une licence liée à un PC avait été envisagée pour une version installable. Elle n’est pas à imposer à la première version web. La politique commerciale de licences reste à définir.

Ne jamais supprimer les projets à cause d’un problème de licence ou d’accès.
15. Méthode de travail attendue
- Communique en français, simplement.
- Pose les questions une par une.
- Ne redemande pas la validation de décisions déjà présentes dans ce document.
- Prends les décisions techniques courantes et explique brièvement les choix structurants.
- Distingue clairement ce qui est prévu, développé, testé et réellement déployé.
- Ne prétends pas avoir sauvegardé, testé ou publié sans preuve.
- Préserve les projets existants lors des évolutions.
- Documente les hypothèses et les points encore ouverts.
- Ne demande pas à l’utilisateur de définir chaque outil élémentaire : propose un socle pertinent.
- Livre une application réelle, pas seulement un cahier des charges supplémentaire.
16. Vérifications minimales
Vérifier notamment :
- mise à l’échelle correcte et conservation des dimensions après réouverture ;
- placement précis par rapport à un repère ;
- maintien des liaisons lors du déplacement des appareils ;
- annuler/rétablir cohérent ;
- zoom et déplacement sans perdre l’outil actif ;
- absence de raccourcis intempestifs pendant une saisie ;
- réglage du fond sans modification des objets ajoutés ;
- conservation des préférences utilisateur ;
- accès direct aux contenus sans longue page verticale ;
- sauvegarde et récupération après interruption ;
- travail simultané sur deux chantiers distincts ;
- protection contre deux modifications concurrentes du même chantier ;
- cohérence 2D–3D si l’expérimentation est incluse.
17. Commence maintenant
Analyse ce cahier des charges, propose brièvement une architecture adaptée, puis commence à produire une première tranche fonctionnelle : espace de travail, projet sauvegardable, fond de plan à l’échelle, dessin et placement précis d’appareils, puis liaisons fonctionnelles.

Prépare des étapes courtes et vérifiables jusqu’à couvrir la première version. Fournis les sources et un guide de lancement reproductible. Signale précisément ce qui reste à faire.

Le résultat attendu est un logiciel de dessin utilisable, fidèle à ces choix, avec une base solide pour les extensions métier et l’IA.