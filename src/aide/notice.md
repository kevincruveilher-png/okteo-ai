# Oktéo — Notice et support de formation

Cette notice explique comment faire une étude complète dans Oktéo, du plan du pavillonneur jusqu'au fichier de fabrication. Elle sert aussi de support pour former un opérateur du BE.

## Comment s'en servir

- **Pour apprendre** : suivre les étapes 1 à 7 dans l'ordre, puis faire les exercices du parcours de formation.
- **Pour retrouver une fonction** : dans le logiciel, Ctrl+K ouvre la palette ; on tape un mot (« nuage », « boîte », « échelle ») et la fonction s'affiche avec son raccourci. La recherche en haut de cette notice trouve aussi un mot dans toute la notice.
- **Pour un doute** : la partie « Questions fréquentes » donne les réponses aux blocages les plus courants.

Les mots du BE sont gardés tels quels : pieuvre, boîte, gaine, bande, ligne directe, nuage, indice de révision.

**Mise à jour** : la notice est complétée à chaque mise à jour du logiciel. Chaque changement est noté dans l'historique, en bas. Une fonction en préparation est signalée « bientôt ».

## Prise en main

Oktéo s'ouvre à l'adresse [okteo-ai.pages.dev](https://okteo-ai.pages.dev/), avec votre compte. Tout s'enregistre seul : le voyant en haut passe à « ⚠ Non enregistré » seulement en cas de problème.

### L'accueil et les chantiers

- Le **logo Oktéo**, en haut à gauche, ramène toujours à l'accueil : la liste des chantiers.
- **＋ Nouveau chantier** : on donne le nom, puis on choisit le PDF du pavillonneur. Oktéo propose le rôle de chaque page (implantation RDC, étage, plan cuisine, devis, à ignorer) ; on corrige si besoin. Pour bien voir une page, cliquer sur la loupe 🔍 de sa vignette (ou double-cliquer sur la vignette) : la page s'ouvre en grand ; molette = zoom, glisser = déplacer, ← → = page précédente / suivante ; le rôle se corrige aussi depuis cette vue, et « Prendre cette page comme plan » choisit la page. Échap pour fermer.
- La **fiche du chantier** regroupe : n° d'affaire, pavillonneur, dessinateur, date de dépôt du permis (elle choisit la version de la norme), code postal (il décide du parafoudre), case PMR, pièces du dossier et finitions commandées.

### L'écran de travail

| Zone | Où | À quoi ça sert |
| --- | --- | --- |
| Onglets | en haut | Plan, Pieuvre (boîtes, bandes, lignes directes), Tableau, Étude, 3D, Paramètres |
| Barre « Implantation bâti » | 1re ligne d'outils | Sélection, Pièce, Mur, Porte, Fenêtre, Cloison, Cote, Nuage, Échelle, Main |
| Barre « Implantation appareils » | 2e ligne d'outils | Liaison, Essai, les symboles, « Autres ▾ », « Mobilier ▾ », « Groupes ▾ » |
| Vues | à côté des outils | Bâti, Implantation, Câblage (Alt+1, Alt+2, Alt+3) |
| Panneaux | à droite | Propriétés de ce qui est sélectionné, Câblage, Étapes |
| « ✓ Contrôle » | en haut | nombre de points à vérifier ; un clic va au suivant |
| « ? Aide » | en haut à droite | cette notice |
| Assistant | en bas à droite (touche A) | poser une question sur le logiciel ou le chantier |

Chaque changement de vue glisse : la vue qu'on ouvre depuis le plan arrive par la droite, et le plan revient toujours par la gauche. Entre deux autres vues, le glissement suit l'ordre des onglets. Si Windows est réglé pour réduire les animations, rien ne glisse.

### Les gestes de base

- **Molette** : zoomer, centré sur la souris. **Outil Main** : déplacer la vue.
- **Clic** : sélectionner. **Maj+clic** : ajouter à la sélection. **Glisser dans le vide** : cadre de sélection.
- **Échap** : annuler l'outil en cours. **Suppr** : supprimer la sélection.
- **Ctrl+Z** : annuler (80 fois). **Ctrl+Maj+Z** : rétablir.
- **Ctrl+K** : chercher n'importe quelle fonction. Chaque bouton affiche une explication quand on laisse la souris dessus.

La première fois, Oktéo propose une **visite guidée** de l'écran. Elle se relance depuis le panneau « Étapes ».

## Étape 1 — Importer le plan et régler l'échelle

Une étude juste commence par une échelle juste : toutes les longueurs de gaine en dépendent.

1. **Le fond** : à la création du chantier, le PDF devient le fond du plan, un niveau par page d'implantation. Pour le changer : fiche du chantier → « Changer le fond… ».
2. **Les niveaux** : la barre des niveaux (RDC, R+1…) permet de passer de l'un à l'autre ; Page ↑ et Page ↓ font la même chose.
3. **L'échelle** : Oktéo la déduit seul des cotes du plan quand il les lit. Sinon, outil **Échelle** : zoomer sur une cote connue (par exemple 13,00), cliquer ses deux bouts, taper la longueur réelle, Entrée. Le panneau de l'outil accepte aussi une échelle « 1/50 », « 1/100 ».
4. **Le contrôle** : après le réglage, Oktéo compare son échelle aux autres cotes du plan. S'il trouve un écart, il le dit et propose « Corriger ».

**À vérifier avant d'aller plus loin** : mesurer une cote longue du plan avec l'outil Cote. Elle doit tomber à quelques centimètres près.

## Étape 2 — Relever le plan

Le relevé dessine les murs, les pièces et les appareils à partir du PDF. Oktéo propose toujours un **aperçu en orange** : on garde ou on refuse, et Ctrl+Z annule le relevé entier.

Tout part du menu **Relevé** :

| Bouton | Ce qu'il fait | Quand l'utiliser |
| --- | --- | --- |
| 1. Murs | lit les traits du PDF, sans IA | PDF vectoriel (pas un scan) |
| 2. Pièces | ferme les pièces et lit leur nom | après les murs |
| 3. Appareillage | lit les symboles du PDF, sans IA | légende classique |
| Murs d'équerre | redresse les angles presque droits | fait seul après chaque relevé |
| ✦ Analyse IA | l'IA lit tout le plan : murs, pièces, appareils, liaisons | cas général, scans compris |
| ✦ Relecture ciblée | l'IA revient sur les points douteux | après une analyse IA |

**L'analyse IA** : Oktéo lit d'abord l'échelle sur trois cotes. Si elle s'écarte trop de celle du fond, il s'arrête et demande. Pendant l'analyse, une page d'attente s'affiche ; « Ouvrir le chantier » ramène au plan.

**Les points qui clignotent** : un appareil violet ou clignotant est un doute (type, emplacement, hauteur). Cliquer dessus, puis « Pourquoi ça clignote ? » : on choisit le bon type, « Je confirme l'emplacement » ou « Modifier ». Oktéo retient le symbole pour les plans suivants du même pavillonneur (ou pour tous, si on coche la case).

**Le mode IA** (Alt+M) montre les étapes une par une dans une colonne, pour qui veut être guidé. Le mode BE garde l'écran complet.

**À vérifier** : chaque pièce a son nom, aucun appareil n'est resté hors d'une pièce sans raison, les portes ouvrent du bon côté.

## Étape 3 — Corriger le bâti

Le relevé n'est jamais parfait : on reprend à la main ce qui manque ou ce qui est faux. Les outils sont sur la ligne « Implantation bâti ».

| Outil | Touche | Comment |
| --- | --- | --- |
| Mur | B | cliquer point après point ; taper une longueur en mètres puis Entrée pour la fixer ; double-clic ou Échap pour finir |
| Pièce | E | glisser un rectangle : les 4 murs et la pièce d'un coup |
| Porte | O (ou Ctrl+8) | cliquer sur un mur ; glisser pour déplacer, poignées pour la largeur ; G et S changent le gond et le sens |
| Fenêtre | F (ou Ctrl+9) | comme la porte |
| Cloison | — | cliquer un mur du côté voulu, puis taper la distance de la cloison parallèle |
| Cote | C | deux points |
| Nuage | — | deux coins autour de la zone modifiée (voir plus bas) |

**Modifier un mur** : le sélectionner, puis le glisser (il se déplace parallèlement) ou régler son épaisseur et sa matière (maçonnerie, cloison, doublage) dans Propriétés. La case « Angles droits » (F6) force les murs à l'horizontale ou à la verticale.

**Renommer une pièce** : cliquer dans la pièce ; le nom se change dans le menu qui apparaît au-dessus. Le nom compte : il décide des règles (cuisine, salle de bain, chambre…).

**Le nuage de révision** : quand un plan déjà envoyé change, on entoure la zone modifiée avec l'outil Nuage. Le triangle porte l'indice de révision (A, B, C…), modifiable dans Propriétés ; le nuage suivant reprend le même indice. Il est imprimé sur le plan.

**Sanitaires et mobilier** : baignoire, douche, WC, lavabo (bouton « Autres ▾ ») et meubles (« Mobilier ▾ ») se posent comme des appareils. Les sanitaires tracent les volumes de la salle de bain ; Oktéo en tient compte pour placer les boîtes.

## Étape 4 — Poser et régler les appareils

Les appareils sont sur la ligne « Implantation appareils ». L'outil reste actif : on pose autant d'appareils qu'on veut, Échap pour finir.

### Poser

- **Un appareil** : cliquer son symbole, puis cliquer sur le plan. Près d'un mur, il se colle au mur. Le tableau (TD) aussi : son dos touche le mur et il tourne d'un quart de tour selon le sens du mur. Pour le poser à une distance exacte de l'angle : taper la distance en centimètres, puis Entrée.
- **Les autres appareils** (radiateurs, four, plaque, volets, VMC, courant faible, sanitaires…) : bouton « Autres ▾ ».
- **Une plaque entière** : bouton « Groupes ▾ » (PC+RJ, 3PC cuisine, SA+VV…). Un clic sur le mur pose tous les appareils côte à côte, déjà associés.
- **Une pièce d'un coup** : sélectionner la pièce, puis « ⚡ Implantation rapide » (Maj+P) pose son appareillage type. Les types de pièce se règlent dans Paramètres → Appareils.

### Régler (panneau Propriétés)

- **Hauteur** : boutons rapides 120, 110 et 40 cm, ou valeur libre.
- **Options** : étanche, interrupteur lumineux ou à témoin, prise en plan de travail (cuisine), variante de câble ou de fils, raccordement en boîte ou en direct.
- **Tourner** : R (droite), Maj+R (gauche), ou Ctrl+R comme dans FTZ.

### Relier les commandes aux lumières

Outil **Liaison** (L ou Ctrl+G) : cliquer un interrupteur (ou un va-et-vient, un bouton poussoir), puis la ou les lumières qu'il commande. Recliquer une lumière la détache. Les repères suivent les allumages (I3 commande L3, L3A…).

**Pour essayer** : bouton **Essai**, puis cliquer les interrupteurs : les lumières s'allument comme dans la maison (va-et-vient et télérupteurs compris). Une lumière qui ne s'allume pas n'est reliée à rien.

## Étape 5 — Contrôles, norme et alertes

Oktéo vérifie le plan en continu. Une alerte ne bloque jamais rien : elle signale, l'opérateur décide.

- **Le bouton « ✓ Contrôle »** (en haut) : commande sans lumière, lumière sans commande, va-et-vient incomplet, appareil sans circuit, allumage coupé entre deux boîtes, appareil décollé de son mur. Un clic mène au point suivant ; il s'entoure d'un halo sur le plan.
- **Le panneau Étapes** : les 9 étapes du dossier, avec une jauge. Oktéo coche seul ce qu'il sait vérifier (import, boîtes, câblage, impression) ; les vérifications humaines attendent « C'est vérifié ».
- **La norme NF C 15-100** (Étapes → Norme) : nombre minimum de prises, de points lumineux et de prises de communication par pièce. Pour chaque point sous le minimum, trois choix : **Voir** (zoomer dessus), **Question au pavillonneur** (noté pour le rapport), **Voulu** (choix assumé, l'alerte se tait).
- **Le parafoudre** (Étapes → Norme → Parafoudre) : décidé d'après le code postal du chantier et le type d'arrivée. Le BE peut le retirer ou l'imposer ; le choix est noté au rapport.
- **La salle de bain** : les volumes 0 à 2 sont tracés autour des sanitaires ; un appareil interdit dans un volume est signalé, et les boîtes en sont écartées.

La version de la norme dépend de la date de dépôt du permis : série de 2024 après le 31/08/2025, version 2002 + A5 avant. La date se saisit dans la fiche du chantier.

## Étape 6 — Câbler : circuits, pieuvres, gaines, tableau

Le plus court : onglet **Étude** → **« Câbler le chantier »**. Oktéo fait les circuits, place les boîtes, calcule gaines et fils, et prépare le tableau. Un seul Ctrl+Z annule le tout. On reprend ensuite à la main ce qui ne convient pas.

### Lire l'étude

- L'onglet Étude montre les 9 étapes du calcul, chaque décision et la règle qui l'a prise.
- Cliquer une boîte, une gaine ou un fil sur le plan ouvre **« Pourquoi ? »** : la raison de ce choix.
- Les **doutes** (règle non tranchée, gaine trop pleine, allumage coupé) remontent dans « ✓ Contrôle ».

### Reprendre à la main (vue Câblage, Alt+3)

| Je veux… | Je fais… |
| --- | --- |
| déplacer une boîte | la glisser ; elle se verrouille (cadenas) et garde sa place au prochain calcul |
| changer le passage d'une gaine | tirer sur la gaine pour créer un point ; double-clic sur un point pour le retirer |
| changer de boîte un appareil | glisser le bout de sa gaine sur une autre boîte |
| choisir le trou de sortie | lâcher le bout de la gaine sur un point de la boîte |
| supprimer une boîte | la sélectionner, Suppr : ses appareils vont à la boîte la plus proche |
| revoir les circuits | panneau Câblage → Circuits |

Une gaine ne sort jamais de la maison : dans une maison en L, la gaine d'une aile à l'autre passe par l'angle intérieur au lieu de couper par le jardin, et sa longueur en tient compte. Oktéo se repère sur les pièces du plan : une partie de la maison sans pièce dessinée est vue comme l'extérieur. Il contourne aussi les zones d'exclusion.

Les choix propres au chantier (pontage, commande des volets, raccordement de la hotte) se règlent dans le panneau Câblage. Les règles générales (couleurs, sections, nombre de départs, place dans les gaines) sont dans Paramètres.

### Le tableau

Onglet **Tableau** : Oktéo dispose différentiels et disjoncteurs d'après les circuits et la norme. On glisse un appareil pour le déplacer, on ajoute un modulaire (télérupteur, contacteur, horloge…), et les alertes du tableau s'affichent dessous.

**À vérifier** : aucun doute bloquant, aucune gaine trop pleine, des boîtes là où le BE les mettrait. La vue 3D (Alt+4) aide à juger les passages.

### La vue 3D (Alt+4)

- Glisser pour tourner, molette pour zoomer, clic droit pour déplacer la vue. Le curseur **Coupe** baisse les murs pour voir dans les pièces.
- Les cases du panneau affichent ou cachent : murs contrastés, **Portes** (décochée : on voit à travers les passages), appareils, boîtes, gaines, volumes de la salle de bain.
- **Visite à pied · ZQSD** : on marche dans la maison et on pose des appareils au viseur. Ctrl+Z annule.
- **Déplacer un appareil en visite** : touche 7 (outil « Déplacer »). Viser l'appareil et cliquer pour l'attraper. Il suit alors le viseur sur les murs, ou au plafond pour un point lumineux. Un second clic le pose : il se recolle à son mur, et Ctrl+Z annule. Il garde sa hauteur ; la touche H permet de le poser à la hauteur visée. Échap le lâche sans le bouger.

## Étape 7 — Bandes, lignes directes et fichiers

Une fois l'étude juste, l'onglet **Pieuvre** donne tout ce qui part à l'atelier. Il a trois sous-onglets : Boîtes, Bandes, Lignes directes.

- **Bandes** : le schéma de câblage de chaque boîte, avec ses gaines, ses fils, ses connecteurs, le perçage des tranches et un QR code (la bande s'ouvre sur un téléphone). Boutons : étiquettes de boîte (4 par A4), bandes détaillées, dossier complet, documents à remettre.
- **Un numéro à la fois** : cliquer un numéro du schéma (ou un de ses fils). Seuls ce numéro et ses fils restent visibles : les autres fils et numéros passent en fantôme, ainsi que les gaines qui n'amènent pas de fil de ce numéro. Le connecteur à prendre s'affiche en petit dans le coin haut droit, avec ses fils à leur couleur. De 2 à 5 places il a une rangée ; 6 = 3 + 3, 8 = 4 + 4, 10 = 5 + 5, 12 = 6 + 6. Au-delà de 12 fils, deux connecteurs sont reliés par un pont de la couleur des fils. En survolant le dessin, on lit le numéro et le nombre de fils. Pour tout revoir : recliquer le numéro, cliquer à côté ou cliquer sur le connecteur. Sur le téléphone (QR code), même chose en touchant le numéro ; le connecteur s'affiche en bas à droite. Les boutons « Circuits » au-dessus du schéma gardent la mise en avant par circuit.
- **Lignes directes** : les lignes qui partent du tableau sans boîte (prises spécialisées, RJ45, sorties de câble), avec leur gaine et leur longueur.
- **Fichier .spv (Counter)** : un seul fichier pour tout le chantier, au format du BE. L'atelier le découpe lui-même.
- **Totaux du planning** : surface, gaines, boîtes, copiés pour le planning.
- **Imprimer le plan** : Ctrl+P, avec aperçu, choix des calques et de l'échelle.

**Bientôt** : export vers ALTIOR, impression au format exact du BE. Le fichier .spv doit encore être validé dans Counter sur un chantier réel avant d'être utilisé en production.

Le n° d'affaire et le pavillonneur viennent de la fiche du chantier : sans eux, le .spv le signale.

## Paramètres et raccourcis

L'onglet **Paramètres** ouvre une page à part, sur fond corail. « Revenir au logiciel » ou Échap ramène au plan.

- **Règles KiTéOHM** : le catalogue des règles, rangé par rubrique (chantier, appareils, câblage, fils et gaines, pieuvres, tableau, norme, fabrication, journal, questions au BE, historique). Chaque fiche dit ce qu'Oktéo fait, pourquoi, et son état : Appliquée, À intégrer, Question, Plus tard.
- **Ce poste** : affichage (thème clair ou sombre), IA, relevé, 3D, raccourcis.
- **La recherche** parcourt toutes les rubriques : taper « couleur » ou « calibre ».
- **L'historique** garde chaque réglage changé, avec l'ancienne valeur.
- **Exporter le catalogue** en fait un fichier texte à transmettre.

### Touches du BE (comme dans FTZ)

| Touche | Action |
| --- | --- |
| F6 / F7 | angles droits |
| Ctrl+8 | porte |
| Ctrl+9 | fenêtre |
| Ctrl+G | liaison |
| Ctrl+7 | défaire (annuler) |
| Ctrl+R | rotation de 90° |
| Ctrl+Y | copier (dupliquer la sélection) |
| F5 | étiquettes (repères) |
| F2 / F9 | vue Câblage |

Ces touches marchent sur le plan. Paramètres → Raccourcis permet de les changer, poste par poste. Ctrl+W, Ctrl+N et Ctrl+T restent au navigateur.

### Touches d'Oktéo

| Touche | Action |
| --- | --- |
| Ctrl+K ou F1 | chercher une fonction |
| Ctrl+Z / Ctrl+Maj+Z | annuler / rétablir |
| Ctrl+D | dupliquer |
| Ctrl+C / Ctrl+V | copier / coller |
| Ctrl+P | imprimer |
| Suppr | supprimer |
| Échap | quitter l'outil |
| V, E, B, O, F, C, L | sélection, pièce, mur, porte, fenêtre, cote, liaison |
| Alt+1 / 2 / 3 / 4 | vues Bâti, Implantation, Câblage, 3D |
| Alt+M | mode IA / mode BE |
| Page ↑ / Page ↓ | niveau du dessus / du dessous |
| A | assistant |

## Parcours de formation

Six modules, du plus simple au plus complet. Chaque module se fait sur MAILLARD, le chantier de référence déjà comparé au travail du BE, et se termine par un critère de réussite. On travaille toujours sur une copie : fichier MAILLARD_kevin.okteo, ouvert avec « Ouvrir un fichier .okteo » depuis l'accueil, puis supprimé à la fin. Le module 3 repart du PDF de MAILLARD dans un nouveau chantier. À la fin du module 5, on compare les boîtes et les gaines de l'élève à celles du BE.

| Module | Exercice | Réussi si |
| --- | --- | --- |
| 1. Se repérer | faire la visite guidée ; zoomer, déplacer la vue, chercher « nuage » avec Ctrl+K | on retrouve seul l'outil Mur, le panneau Propriétés et le bouton « ✓ Contrôle » |
| 2. Dessiner une maison | tracer une maison de 4 pièces avec l'outil Pièce, ajouter 3 portes et 4 fenêtres, nommer les pièces | les pièces portent leur nom, les portes ouvrent du bon côté |
| 3. Importer un vrai plan | créer un chantier depuis un PDF, régler l'échelle, lancer le relevé, corriger les murs | une cote longue mesurée tombe à 2 cm près |
| 4. Implanter | poser l'appareillage d'une chambre et d'une cuisine (avec « Groupes ▾ » et « Implantation rapide »), relier commandes et lumières | le mode Essai allume chaque lumière, la norme ne signale rien |
| 5. Câbler | « Câbler le chantier », puis déplacer une boîte et une gaine, et expliquer une boîte avec « Pourquoi ? » | aucun doute bloquant ; on sait dire pourquoi chaque boîte est là |
| 6. Sortir le dossier | ouvrir les bandes, les lignes directes, le tableau ; produire le .spv | les bandes sont lisibles par un câbleur, le .spv porte le bon n° d'affaire |

**Pour le formateur** : faire refaire le module 3 sur deux plans de pavillonneurs différents. C'est là que se voient les vrais pièges : légendes, cotes, symboles inconnus.

## Questions fréquentes

| Problème | Solution |
| --- | --- |
| Je ne trouve pas une fonction | Ctrl+K, puis un mot ; ou laisser la souris sur un bouton pour lire son explication |
| J'ai fait une erreur | Ctrl+Z, autant de fois que nécessaire (80 fois au plus) |
| Rien ne se passe quand je clique sur le plan | un outil est peut-être actif : Échap, puis recommencer ; ou un calque est verrouillé (vues Alt+1 à Alt+3) |
| Les longueurs de gaine sont fausses | l'échelle est mauvaise : refaire l'étape 1 avec une cote longue |
| Un appareil clignote en violet | c'est un doute du relevé : le cliquer, puis « Pourquoi ça clignote ? » |
| Une lumière ne s'allume pas en mode Essai | elle n'est reliée à aucune commande : outil Liaison |
| Une boîte revient toujours au même endroit | elle est verrouillée (cadenas) : cliquer le cadenas pour la libérer |
| F5 ne recharge plus la page | sur le plan, F5 affiche les étiquettes (comme dans FTZ) : recharger avec le bouton du navigateur |
| Ctrl+Y ne rétablit plus | Ctrl+Y copie (comme dans FTZ) : rétablir avec Ctrl+Maj+Z |
| Le voyant affiche « ⚠ Non enregistré » | ne pas fermer la page ; enregistrer le chantier en fichier depuis sa fiche, puis prévenir |
| Je veux une réponse rapide | l'assistant (touche A) connaît toutes les fonctions et peut les lancer |

## Historique de la notice

| Date | Mise à jour du logiciel | Ce qui a changé dans la notice |
| --- | --- | --- |
| 07/11/2026 | connecteur en petit dans le coin | Étape 7 : connecteur dessiné en petit (rangées), sans fiche |
| 07/11/2026 | numéro seul sur la bande | Étape 7 : clic sur un numéro, fantôme et connecteur rapide (écran et téléphone) |
| 07/11/2026 | déplacer en 3D | La vue 3D : outil « Déplacer » de la visite à pied |
| 07/11/2026 | portes en 3D | nouvelle partie « La vue 3D » ; case Portes |
| 07/11/2026 | tableau collé au mur | Étape 4 : le tableau se colle au mur et tourne avec lui |
| 07/11/2026 | animation des vues | L'écran de travail : chaque changement de vue glisse, le retour au plan arrive par la gauche |
| 07/11/2026 | gaines dans la maison | Étape 6 : une gaine ne sort jamais de la maison (contournement par l'intérieur, d'après les pièces) |
| 06/11/2026 | loupe des pages du PDF | Nouveau chantier : loupe 🔍 / double-clic pour voir une page du dossier en grand |
| 06/11/2026 | — | parcours de formation sur une copie de MAILLARD (choix de Kévin) |
| 06/11/2026 | bouton « ? Aide » | notice lisible dans le logiciel (bouton « ? Aide », recherche) ; noms exacts du menu Relevé et du bouton « ✓ Contrôle » |
| 06/11/2026 | lots 1 à 10 de la reprise des paramètres du BE | première version : prise en main, étapes 1 à 7, paramètres et touches du BE, parcours de formation, questions fréquentes |
