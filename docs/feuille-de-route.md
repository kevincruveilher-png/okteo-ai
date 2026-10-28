# Feuille de route — mises à jour 41 à 48 (rédigée le 26/10/2026)

Décidée avec Kévin le 26/10/2026. Détail des échanges : `docs/journal.md` (sections « À faire »).

## Règles de travail
- **Une mise à jour à la fois**, lancée seulement quand Kévin dit « go ». Il fait avancer de mise à jour en mise à jour.
- **Rien n'est poussé avant le « go » d'une mise à jour.** À la fin de chacune : `npm run check` vert, journal et CLAUDE.md à jour, `npm run deploy`, puis push (les commits de notes partent avec la 41).
- Chaque nouvelle fonction : entrée dans `src/ext/catalog.js`, étape dans la visite guidée si c'est une nouvelle zone de l'écran, test dans `scripts/smoke.mjs` (et `scripts/cablage.test.mjs` pour le moteur).
- Kévin est débutant sur l'interface : infobulles, raccourcis affichés, le moins de clics possible. Les fonctions de câblage restent des options, jamais automatiques.

## 41 — Mise en page de l'écran — FAIT (livrée avec la 42, 26/10/2026)
- Bandeau du haut en trois groupes avec un titre court : **Vues** (Bâti, Implantation bâtie, Implantation appareils, Câblage), **Actions** (outils de dessin et de modification), **Panneaux** (Propriétés, Câblage, Packs, Étapes).
- Le contenu d'un panneau s'ouvre dans une zone plus étroite sous le bandeau et se ferme en recliquant l'onglet.
- L'assistant : petit encart fermé en bas à droite, agrandi au clic, réduit par la croix ; il ne recouvre le dessin que lorsqu'il est agrandi.
- Fait avant le reste parce que les boutons des mises à jour suivantes (compteur, Pack, Essai) s'y rangent.
- Corrigé : le bandeau d'aide près de l'objet restait affiché (`.hud[hidden]`).

## 42 — Paramètres et surfaces des pièces — FAIT (26/10/2026)
- Paramètres regroupés en sections avec titre et courte aide : **Affichage** (surfaces), **Assistant et relevé IA** (clés, modèles), **Câblage** (circuits, couleurs, boîtes, gaines et câbles, longueurs), **Packs** (renvoi vers le panneau Packs) ; sommaire et recherche.
- Les m² des pièces disparaissent partout (libellé écran et impression, nomenclature, liste des Packs, liste de détection, total « m² habitables »). Réglage « Afficher les surfaces des pièces », désactivé par défaut. La surface reste calculée (nombre de prises de la norme pour le séjour).

## 43 — Contrôle des appareils seuls — FAIT (26/10/2026)
- Compteur « ⚠ n » actif en permanence dans le bandeau (calcul léger à chaque dessin).
- Cas : commande sans lumière, lumière sans commande, va-et-vient incomplet, appareil sans circuit, allumage coupé entre deux boîtes, commande et lumière dans deux boîtes.
- Halo orange animé (pulsation douce) sur le plan ; un clic sur le compteur zoome sur le cas suivant ; liste dans l'onglet Câblage.

## 44 — Pack en peu de clics — FAIT (26/10/2026 ; raccourci Maj+P, P = outil Prise)
- Bouton « Pack ▾ » dans le bandeau de la pièce : pièce, Pack, type = 3 clics. Touche P puis un chiffre.
- Options : « Pieuvre type » (pack + boîte), « même pack pour les pièces du même nom ».
- Jamais automatique à la création d'une pièce ; un seul Ctrl+Z.

## 45 — Mode essai — FAIT (26/10/2026 ; disjoncteurs dans l'encart Essai en attendant l'onglet Tableau)
- Bouton « Essai » : un clic sur un interrupteur allume / éteint ses lampes (deuxième clic sur l'interrupteur ; à confirmer : clic direct sur la lampe aussi).
- Lumière soignée : fondu à l'allumage et à l'extinction, halo qui éclaire autour de la lampe, légère variation d'intensité en continu ; animations réduites si le système le demande.
- Va-et-vient en inversion, télérupteur par bouton-poussoir, un disjoncteur simple par circuit dans l'onglet Câblage.
- Bouton « Tester tout » : liste les commandes sans effet ou sur un autre circuit.

## 45.1 — Retours de Kévin du 26/10 — FAIT (27/10/2026)
- **Quadrillage retiré** du fond du plan (trop d'informations, on ne s'y retrouve plus) : calque « Quadrillage » désactivé par défaut et retiré des vues Bâti / Implantation / Câblage (il reste activable à la main dans l'encart Vues).
- **Contrôle — lampes raccordées à rien** : vérifier pourquoi des lampes sans liaison n'apparaissent pas comme des interrupteurs seuls (le cas « lumière sans commande » existe déjà : chercher le cas manqué sur le chantier de Kévin, ex. lumière reliée seulement à une autre lumière, spot, applique, lumière d'un autre niveau).
- **Effets (retour de Kévin)** : lumière de l'essai moins forte (effet et halo gardés : intensité du dégradé ≈ −40 %, rayon un peu réduit) ; alertes plus visibles et plus rouges (anneau rouge-orangé #e4472b plus épais, pulsation plus marquée).
- **Contrôle — deux interrupteurs simples sur la même lampe** : nouvelle alerte « Deux interrupteurs sur la même lumière : il faut des va-et-vient » (aussi un interrupteur simple mêlé à un va-et-vient) ; le mode essai et « Tester tout » la signalent aussi.

## 46 — Onglet Tableau — FAIT (27/10/2026)
- Tracé du tableau complet : disjoncteurs et circuits, disjoncteurs déplaçables sur les rangées.
- Modèle de tableau au choix (grand Schneider), avec sa taille et son nombre de rangées.
- Remplace les disjoncteurs simples du mode essai.

## 47 — Feuille de boîte — FAIT (27/10/2026)
Spécification complète : `docs/journal.md`, section « feuille de boîte ». En bref :
- En-tête : Pavillonneur et Chantier (haut gauche) ; N° d'affaire, « Nom BE », cadre d'émargement du câbleur (haut droite) ; ancienne ligne de sous-titre supprimée.
- Grosse flèche vers le tableau (direction réelle) avec le mot « TABLEAU » ; lettre et pièce de chaque face à l'extérieur de la boîte, sur les quatre bords ; A, B, C, D inchangés (pas de miroir).
- Pièce d'une face = pièce des appareils desservis par ses gaines (égalité : pièce vers laquelle elle regarde ; alimentation seule : « Tableau »).
- Cadre « Ordre de câblage » : couleur, section, quantité de fils, borne. Raccordements numérotés dans l'ordre : terres, puis par circuit neutre et phase (cuisine, prises, éclairage), puis retours et navettes.
- Code barre unique (code 128, identifiant du chantier + nom de la boîte) ; modèle de boîte (pavillonnaire carrée) et couvercle haut / bas en simple mention.
- Textes plus gros, sans Ph / N / PE ; gaine écrite « LI01.10 · P14 · 4,8 m · Ø16 » ; alimentation avec accolades et bagues 1, 2… sous les bornes.

## 49 — Tableau complet — FAIT (27/10/2026 ; marques en texte, logos officiels à fournir)
Ajouter au tableau, depuis une liste « ＋ Appareil modulaire », chacun avec sa largeur en modules et son symbole :
- prise modulaire 2P+T 16 A (2,5 modules, sous un différentiel) ;
- parafoudre type 2 (2 modules) + son disjoncteur de déconnexion (obligatoire selon la zone, conseillé sinon) ;
- télérupteur modulaire (1 module) — à relier aux allumages à télérupteur du plan (T1, T2…) ;
- contacteur jour/nuit heures creuses pour le chauffe-eau (1 module) ;
- délesteur, minuterie, horloge / programmateur, transformateur de sonnette (1 à 2 modules) ;
- obturateurs pour les places vides (réserve).
Contrôle : réserve de 20 % recalculée avec ces appareils.
- **Coffrets Legrand** en plus des Schneider : gamme Drivia 13 et 18 modules, 1 à 4 rangées (références à vérifier au
  moment de coder).
- **Marques** : nom de la marque en tête du tableau (Schneider Electric / Legrand), dans ses couleurs ; les logos
  officiels seulement si KiTéOHM fournit les fichiers (marques déposées, pas de copie depuis Internet).
- **Ouvrir le tableau depuis le plan** : clic sur le symbole du tableau → bouton « Ouvrir le tableau » dans son bandeau ;
  double-clic → onglet Tableau directement (un simple clic doit encore permettre de le sélectionner et de le déplacer). À valider avec Kévin (ou son électricien de référence) : ce qui
est mis par défaut, et ce qui est fourni par KiTéOHM ou par l'électricien.

## 50 — Étiquettes de boîte et dossier PDF du chantier — FAIT (27/10/2026)

## 48 — Impression complète du plan — FAIT (27/10/2026, version 0.55.0)
- Boîtes (faces, numéros de gaine, couleurs des circuits), gaines avec leurs points intermédiaires, liaisons en courbe comme à l'écran.
- Impression selon le filtre de vues actif, une case par calque dans la fenêtre d'impression.
- Rendu vérifié sur le PDF produit, comme pour l'échelle. Placée en dernier : le dessin des boîtes et des gaines peut encore bouger avec le tableau.

## 49 — QR code → bande de câblage sur téléphone — FAIT (27/10/2026)
- Un **QR code** sur la feuille de boîte (à côté du code barre) : scanné avec l'appareil photo du téléphone ou de la
  tablette, il ouvre la version en ligne d'Oktéo directement sur la bande de cette boîte (schéma, ordre de câblage,
  raccordements à cocher), en page adaptée au téléphone.
- Sans serveur : le QR contient les données de la bande elles-mêmes (compressées, dans l'adresse), rien n'est envoyé sur
  Internet ; contrôle de la taille (au-delà de la capacité d'un QR : données réduites à l'essentiel, ou 2 QR).
- Plus tard, avec une sauvegarde partagée : QR court (n° d'affaire + boîte) qui va chercher la dernière version.
- Le code barre Code 128 reste pour l'appli de scan / contrôle du poids de l'atelier.

## 51 à 54 — Règles de câblage KiTéOHM (note du 27/10/2026)
Références : `docs/remarques-dev-journal-regles.md` (note de passation) et le journal des règles du projet
(`claude/journal-regles-cablage.md` : 52 règles R-001…R-096, questions Q-01…Q-78, historique H-001…H-028).
Principe : le logiciel ne devine jamais ; une valeur sans règle `confirmee` = « à vérifier » ou doute bloquant.

### 51 — Journal des règles dans Paramètres — FAIT (27/10/2026)
- Les 52 règles en données (JSON dans le code, copie modifiée dans le chantier/localStorage), questions, historique ;
  export / import du journal complet.
- Tableau filtrable (id, titre, catégorie, pastille de certitude, statut ; filtres + recherche ; compteur par catégorie,
  catégorie rouge si une règle `bloquer` est inconnue) ; fiche d'une règle (dépend de / utilisée par, choix, historique).
- Choix du chantier en tête : mode de pieuvre (Proximité, Équilibrée, Par pièce, Plug = bloqué), volets (boîte à part /
  mélangés), hotte et appareils à choix (boîte / ligne directe / à choisir).
- Modification par l'assistant seulement : action `rule` avant / après, validation, entrée d'historique,
  `autoriserModification(action, regle)` (toujours autorisé pour l'instant), champ `code_valide`.
- Chaque réglage du moteur (Paramètres → Câblage) pointe vers sa règle.

### 52 — Moteur aligné sur les règles confirmées — FAIT (27/10/2026)
- R-001 : 12 départs hors alimentation (au lieu de 18), 6 gaines par face alimentation comprise ; R-088 face pleine →
  face voisine, sans alerte ; plus de face libre = doute bloquant.
- R-077 : n° de gaine `.01` = alimentation puis strictement horaire (A, B, C, D) à partir de l'alimentation.
- R-074 : diamètre par somme des sections (≤ 7,5 mm² ICTA 16, ≤ 13,5 mm² ICTA 20, au-delà doute bloquant), à la
  place du remplissage en surface ; capacités réglables.
- R-075 / R-030 : une terre dans l'alimentation, de la plus grande section de la gaine ; R-031 garde la numérotation
  (terres n° 1) : les numéros de R-075 (R 1 / B 2, GR 3…) sont ceux de FTZ, seules les couleurs sont reprises.
- R-020 / R-021 / R-085 : rouge 1,5 = phase des lumières seulement, gris = prises seulement ; 2e circuit prises =
  mêmes couleurs + bague ; 8 prises / circuit, 6 en cuisine.
- R-072 / R-023 : ronde orange, violet, noir, marron, ivoire ; couleurs imposées d'abord (marron du câble 3G), puis
  va-et-vient, puis simples ; pas de répétition tant qu'une couleur est libre dans la boîte ; répétition = bague au n°
  de l'allumage, jamais dans une même gaine (sinon doute bloquant).
- R-093 : télérupteur au tableau, BP = phase + commande (neutre seulement si voyant/domotique, R-083).
- R-095 : BOUCHON automatique sur les gaines à câble extérieur (bande + décompte).
- R-089 à R-092 : contrôles des liaisons interdites (spécialisé en gaine partagée, phase/neutre partagés, VV coupé,
  prise SDB sur cuisine, sections mélangées dans une borne).
- Longueur totale de la boîte sous son nom (bande, étiquette, dossier).
- Chaque résultat garde la règle qui l'a produit et sa certitude ; « à vérifier » imprimé sur la bande si non confirmée.

### Notes du 27/10/2026 (15:50) — faites avec la 53 (sauf R-097 : avec la 54)
- R-074 : exceptions dans `gaineFor` (lignes directes) : B + R + V/J 6 mm² → ICTA 20, 10 mm² → ICTA 25 (Q-79, Q-81).
- R-092 : terres de sections différentes autorisées sur la borne n° 1 (déjà le cas dans le contrôle, retirer la mention
  « à confirmer »).
- Q-77 confirmé : score des alternatives = longueur totale de gaine, puis boîtes, puis départs (53, comparaison des modes).
- Q-26 confirmé : règles communes à tous les pavillonneurs (pas de réglage par pavillonneur).
- R-097 : type « gaine aiguillée en attente » (AIG, ligne directe sans fil, Ø40 modifiable) à ajouter avec la 54.
- `npm run regles` après la mise à jour du journal (H-031 à H-034 ; 53 règles).

### 53 — Doutes, précontrôle et étude — FAIT (27/10/2026)
- Précontrôle avant « Câbler » (bouton et assistant) : règles utiles au chantier et leur certitude ; « Je ne peux pas
  câbler : il manque N règles » si un point bloquant est ouvert.
- Doutes : marqueur sur le plan (comme les halos), compteur, liste cliquable, rapport de câblage.
- Trace de l'étude enregistrée dans le chantier : 9 étapes (lecture, mode, boîtes, circuits, allumages, gaines,
  raccordements, tableau, contrôle), états ✓ ◐ ? ✕ ✎, alternatives avec score (longueur totale de gaine, boîtes,
  départs — critère provisoire, Q-77).
- Vues : bande des 9 étapes, « Où ça coince » (avec « Proposer une modification de la règle »), « Pourquoi ? » au
  clic sur une gaine / un fil / une boîte, statistiques par règle.

### 54 — Nouveaux appareils, volets roulants, lignes directes — FAIT (27/10/2026)
- Types (R-084) : radiateur, sèche-serviette, caisson et commande VMC, prises spécialisées nommées (four, LL, LV, SL),
  plaque 6 mm², chauffe-eau, prises extérieures, interphones, antenne et TV, équipotentielles principale et locale,
  volet roulant, CVR, Velux, Aqua Air (alimentation + pilotage), bouche motorisée (YSYT sans gaine), moteur de garage,
  prise extérieure 4G1,5, interrupteur de coupure, climatisation, G EXT ; câble/fils et section modifiables.
- Volets (R-079, R-087, R-094, R-096) : circuit dédié gris / bleu clair 1,5, 10 A, 50 W par moteur ; filaire (CVR,
  marron + noir de la ronde) ou connecté, au choix par volet ; boîte selon le mode de pieuvre.
- R-003 / R-082 / R-084 : tout le courant faible en ligne directe, gaine verte Ø20 ; jamais avec le courant fort.
- R-086 : raccordement « boîte / ligne directe / à choisir » par appareil (doute tant que « à choisir »).
- Tableau des lignes directes : étiquette, longueur, gaine, fil, aboutissant, total par diamètre.
- Gaine aiguillée en attente (R-097) : type AIG, ligne directe sans fil, Ø40 par défaut.

### Pour les tests
- Invariants sur les 4 chantiers FTZ (DUCOURNEAU, FALGUA E6390, BATELIER, FONTES D2129) : 6 gaines par face,
  diamètres, terre, repères 1…N, prises ≤ 8 / ≤ 6, sens horaire, ronde sans répétition, volets 10 A. Ne pas comparer
  le nombre de boîtes à FTZ. Plans et bandes reçus le 27/10 : `docs/chantiers/` (fond scanné sur 3 des 4 plans →
  relevé fait une fois et figé en `.okteo`, puis câblage et contrôle automatiques).

### Hors 51–54 (ne pas coder)
- Tableau (R-050, Q-65 à Q-68) reporté par Kévin ; noter seulement : ID 63 A sur les bandes, pas 40 A.
- Plug de pieuvre (R-009) : bloqué tant que Q-42 / Q-44 manquent.

## Notes du 27/10/2026 (18:39), pour la prochaine mise à jour
- Q-82 répondue : volets bleu clair + gris + vert/jaune validés ; R-021 et R-079 confirmées (journal H-036).
- Q-83 (couleur du fil pilote, peut-être par zone de chauffage) et Q-84 (calibres) : en attente d'un collègue plus
  qualifié. Le logiciel garde la valeur supposée « à vérifier ». Idée : dans le journal, un filtre « en attente » et
  la mention « à voir avec un collègue » sur la fiche, pour que ces questions ne soient pas reposées à Kévin.
  → Fait avec la 48 (bouton « ⏳ En attente » du journal).

## Plan des mises à jour 56 à 60 (révisé le 28/10/2026, 00:34) — une à la fois, sur « go »
- **56 — Câblage aligné sur le BE — FAIT (28/10/2026, 0.56.0)** (moteur, règles H-037 à H-041) : R-001 16 départs ; R-077 anti-horaire ; mode
  Équilibrée = le moins de boîtes (R-094) ; R-098 prises de plan de travail (repère sur la prise, reconnaissance par la
  hauteur) ; R-073 pas d'ICTA 25 en boîte ; types îlot, BPS, sonnette ; volets : jamais « extérieurs », choix
  filaire / connecté demandé au câblage (R-096) ; étiquettes et total des lignes directes comme le BE (R-099) ;
  journal régénéré ; test de référence MAILLARD (outil chantier-wiring, écart avec la bande du BE).
- **57 — Saisie complète du chantier — FAIT (28/10/2026, 0.58.1 ; livrée après la 58)** : équipements hors plan (R-100 : liste à cocher d'après le devis, registre,
  propositions « à vérifier ») ; relevé IA en boucle (relecture ciblée générée par les alertes, limites) ; consigne
  enrichie (points extérieurs, prises de plan de travail, nouveaux types, gonds et sens des portes) ; porte de garage.
- **58 — Plan lisible — FAIT (28/10/2026, 0.58.0 ; faite avant la 57)** : taille des symboles d'après le dessin, aucun chevauchement, boîtes plus petites, noms des
  pièces déplaçables (taille commune), rotation du fond.
- **59 — Gaines sans croisement — FAIT (28/10/2026, 0.59.0)** : points d'accroche et tracés sans croisement, recalcul au déplacement d'une boîte.
- **60 — Boîte pour le câbleur et le perceur — FAIT (28/10/2026, 0.60.0)** : schéma sans fils superposés, vue des 4 tranches (n° de gaine et
  aboutissant), à l'écran et dans les PDF.

## Comparaison MAILLARD, réponses de Kévin (28/10/2026, 00:32) — journal H-041
- Les 20 équipements absents de notre relevé ne sont pas sur le plan : registre des équipements hors plan (R-100) ;
  proposés par défaut quand ils reviennent sur la plupart des chantiers, « à vérifier avec le devis ». À coder (56) :
  liste des équipements du chantier à cocher (comme un pack « maison »), lignes directes ajoutées sans position sur le
  plan ou posées au tableau.
- Mode Équilibrée = le moins de boîtes possible (R-094) ; Proximité garde « moins de gaine d'abord ». À coder (56).
- Volets filaire / connecté : choisi par le BE pour le chantier (R-096) : demandé au câblage, pas déduit du plan.
- Commande + prises dans une gaine : oui, mais jamais de gaine ICTA 25 dans une boîte (R-073). À coder (56).
- Défauts du moteur trouvés (56) : moteur de volet pris pour un appareil extérieur (câble 5G1,5 au lieu de fils) ;
  étiquettes des lignes directes (RJ1, pas R1 ; pas de numéro pour un appareil seul : MOTEUR, AQUA AIR).
- Outil `scripts/chantier-wiring.mjs` : câblage d'un `.okteo` en JSON (option `--recable`, `--departs=16`) ; à
  transformer en test de référence MAILLARD (écart gaine par gaine avec la bande du BE).

## Notes du 27/10/2026 (23:19), 1er essai réel du relevé IA (Opus) puis câblage — pour la prochaine mise à jour
Retour de Kévin : « à première vue très prometteur ». Les vues lui seront transmises.

**Relevé IA (Opus, consigne v55.1)**
- Deux décisions non prises par l'IA : la lampe des WC sans son interrupteur ; les spots extérieurs, dont elle n'a pas
  reconnu l'interrupteur (corrigé par Kévin à 23:35 : ce n'était pas la lampe du garage).
  Consigne à compléter : chercher la commande des points extérieurs (spots, appliques), souvent à l'intérieur près de la
  porte ; sinon la signaler appareil par appareil dans « remarques ». Les alertes orange du contrôle des appareils ont permis de corriger très vite (à garder tel quel).
- Portes mal ajustées :
  - la porte de garage est une grande porte (sectionnelle / basculante) : prévoir une ouverture adaptée (type « porte
    de garage », grande largeur, sans arc de battant) ;
  - le sens des portes (charnière, côté d'ouverture) est souvent faux : la consigne doit demander le côté des gonds
    et le côté où la porte s'ouvre, et l'import doit les reprendre (aujourd'hui l'ouverture est posée sans sens).
- **Relecture ciblée par l'IA (idée de Kévin, 23:42)** : après l'import, le logiciel rédige lui-même une 2e consigne
  à partir des alertes du contrôle (lumière sans commande, commande sans lumière, VV incomplet, pièce non fermée,
  ouverture ajustée, appareil hors pièce…). Pour chaque point : repère stable (L12, I5…), type, pièce, position en
  pixels de l'image de référence (même « ref »), et les candidats proches (commandes à moins de quelques mètres).
  On la colle dans la MÊME conversation (l'IA a encore le PDF) ; elle répond en JSON de corrections :
  `{"liaisons":[["I5","L12"]], "ajouts":[{"t":"INT","x":…,"y":…,"pour":"L12"}], "portes":[…], "introuvable":[{"rep":"AP3","pourquoi":"…"}]}`.
  Import = aperçu + un seul Ctrl+Z ; ce que l'IA déclare introuvable garde son alerte, marquée « vu par l'IA :
  introuvable » (la décision revient au dessinateur). Avec une clé : relecture lancée automatiquement après le relevé.
  Bouton « Copier la relecture » dans la fenêtre du relevé + commande Ctrl+K.
  Essai à la main (23:47, Opus, même conversation) : les 3 lumières sans commande retrouvées en une réponse.
  WC : INT ajouté dans le WC derrière la porte (côté paumelle), relié ; appliques extérieures 87 et 88 : reliées entre
  elles et à un interrupteur du boîtier double de la baie ouest de la pièce de vie (l'autre élément = la CVR 76 déjà
  relevée). Format de réponse respecté (liaisons par indices, ajouts à partir de 100, « introuvable » vide).
  Confirmé par Kévin (23:48) : c'est juste. Principe retenu : toutes les détections automatiques d'erreurs du logiciel
  (contrôle des appareils, pièces non fermées, ouvertures ajustées, appareils hors pièce, doutes de l'étude…) servent à
  générer de nouvelles consignes ciblées pour l'IA ; boucle relevé → contrôle → relecture jusqu'à ce qu'il ne reste que
  des alertes « introuvable » à trancher par le dessinateur.
- Vues de l'essai reçues (23:35, plan scanné tourné, 1/75) : murs posés sur ceux du plan, les 11 pièces fermées et
  nommées (porche non fermé, non relevé : normal) ; fenêtres bien placées ; porte de garage placée mais en « porte »
  (battant de 2,2 m) ; petit bout de mur qui dépasse à gauche sous la Chambre 2 ; appareils au bon endroit, 8 volets
  avec leur CVR ; deux appliques extérieures (façades Ch2 et pièce de vie) sans commande ; symboles qui se chevauchent
  au plan de travail de la cuisine (prises + RJ45 alignés) et trop gros pour ce plan.
- À noter au comparatif des moteurs du journal (essai Opus du 27/10, durée 9 min, chiffres de la réponse : 25 murs, 22 ouvertures,
  11 pièces, 100 appareils, 30 liaisons ; 22/22 ouvertures placées après la v55.2).

**Comparaison avec les bandes du BE (MAILLARD AF26074801, 6 boîtes, 23:50)** — `docs/chantiers/MAILLARD_bandes_FTZ.pdf`
Identique à nos règles : prises GR/BF/V/J 1,5 ; lumières B + retour + V/J ; commandes sans terre (R + retours) ; câble
3G1,5 marron pour les lumières extérieures (L1, L1A, L3) ; ICTA 20 dès que la somme des sections dépasse 7,5 (LI04.09,
LI04.12, alimentations LI01 / LI05 à 13,5) ; terre de l'alimentation en 2,5 quand une équipotentielle locale (EQ1) ou
la cuisine est dans la boîte (notre moteur fait pareil) ; volets dans une boîte à part (LI06, 8 VR connectés, GR/B/V/J,
pas de fil de commande) ; hotte dans la boîte (LI05.07, 2,5 B/R/V/J) ; ≤ 6 gaines par face. Lignes directes : SS, moteur,
commande VMC, VMC, EQ principale 10 V/J ICTA 20, antenne / TV en 17 VATC V20, four / LL / LV / SL en 2,5 B+R+V/J,
bouches K1A…K6 en YSYT 2×1 sans gaine, G EXT 3G2,5, interphone 4G1,5, plaques 6 R+B+V/J ICTA 20, RJ en grade 3 V20 :
tous identiques à notre catalogue (R-084).
Différences à trancher avec Kévin :
1. Départs par boîte : le BE monte à 11–15 gaines hors alimentation (LI02 et LI04 : 15) ; R-001 = 12 maximum. Avec
   nos règles, ce chantier aurait plus de 6 boîtes. Garder 12 ?
2. Ronde des retours : aucun violet sur les 6 boîtes (orange, marron, ivoire, noir seulement). R-072 met le violet en
   2e position.
3. Cuisine ouverte dans la « Pièce de vie » : seules les prises du plan de travail (P28 à P31) et la hotte sont en
   2,5 R/B (circuit cuisine) ; les autres prises de la pièce (P19, P27) restent en 1,5 GR/BF. Notre moteur reconnaît la
   cuisine au NOM de la pièce : dans une pièce de vie, il ne verrait pas de cuisine du tout. Il faut un repère
   « prise de plan de travail » (type ou propriété) indépendant du nom de la pièce.
4. Types absents de notre catalogue : ILOT (prises de l'îlot en ligne directe, 1,5 GR+BF+V/J ICTA 16), BPS (bouton
   poussoir de sonnette, câble 1P 9/10 en ICTA 16), SON (sonnette dans une boîte, R+B+V/J).
5. Aqua Air : une seule ligne directe (3G2,5 ICTA 20) ; notre catalogue ajoute une ligne de pilotage 3×1,5 ICTA 16.
6. Total des gaines du tableau des lignes directes : le BE compte les YSYT dans le total (10 ICT16 + 15 ICT20 + 7 YSYT
   = 32) et range les V20 avec les ICTA 20. À aligner sur notre total.
7. Numérotation des raccordements : terres n° 9 chez le BE (R 1, B 2, GR 3, BF 4, R 2,5 7, B 2,5 8, V/J 9, retours 11+),
   terres n° 1 chez nous (R-031, écart déjà décidé). Gaines numérotées dans le sens horaire chez le BE (.01 à gauche
   puis A, B, C) : à passer en anti-horaire (demande de Kévin, R-077).
8. Page « Repères tableau » du BE (alimentation de chaque boîte avec ses n° de bague 1 à 12) : nous ne la produisons pas
   en page à part.

Réponses de Kévin (28/10/2026, 00:01), inscrites au journal des règles (H-037 à H-039) — code à faire à la prochaine
mise à jour (`npm run regles` + PLUS de regles-import.mjs : `departs_max` 16 ; réglage `departsMax` 16 avec montée de
version des réglages ; tests du décompte des règles et des 12 départs à mettre à jour) :
1. R-001 : 16 départs hors alimentation (au lieu de 12).
2. Violet : bien utilisé, ronde inchangée.
3. R-098 (nouvelle) : seules les prises de plan de travail (+ hotte en boîte) sur le circuit cuisine 2,5 ; repère porté
   par la prise (propriété « plan de travail »), pas par le nom de la pièce. À coder : propriété dans le panneau,
   import IA (consigne : prises du plan de travail), `isCuisine` remplacé, packs cuisine.
4. Nouveaux types à apprendre au logiciel : ILOT (ligne directe 1,5 GR+BF+V/J ICTA 16), BPS (ligne directe 1P 9/10
   ICTA 16), SON (sonnette en boîte, 1,5 R+B+V/J ICTA 16) ; aussi dans la consigne IA.
5. Q-85 Aqua Air (une ou deux lignes) : à poser à Thibault (collègue qui prendra la suite) ; deux lignes en attendant.
6. R-099 (nouvelle) : total des lignes directes avec les YSYT, V20 comptées avec les ICTA 20.
7. On garde nos règles (terres n° 1, R-031) ; gaines en anti-horaire (R-077 modifiée, H-037).
8. Page « Repères tableau » : aucun intérêt, pas à faire.
Réponses du 28/10/2026 (00:13) : prises de plan de travail reconnues par la hauteur (1,00–1,30 m) en cuisine ou près
d'un appareil de cuisine (R-098, H-040) ; îlot sur le disjoncteur d'un circuit prises (ses prises comptent dans ce
circuit, supposé). Sonnette : sur MAILLARD, la gaine SON (LI04) prend les raccordements 1 et 2 = phase et neutre de
l'éclairage de la boîte → réexpliqué à Kévin, à confirmer. Volets : différence oubliée dans la comparaison — le BE a
des volets connectés (aucun fil de commande dans LI06), le relevé IA a trouvé 8 CVR sur le plan ; en mode « filaire »,
Oktéo ajouterait les gaines de CVR et les fils de commande (marron / noir) : boîte de volets différente de celle du BE.
Question posée : qu'est-ce qui, sur un plan, dit que les volets sont connectés ?

**Câblage des boîtes : lisibilité**
- Le câblage des boîtes a l'air correct, mais le tracé des circuits est ambigu : les fils se chevauchent dans le schéma
  de la boîte (lignes qui se croisent et se superposent, capture LI05) ; difficile de voir rapidement qui va avec qui.
  À revoir : tracés sans superposition, couloirs séparés, croisements réduits, mise en avant d'un circuit au survol.
- Numéros de gaine dans le sens **anti-horaire** (au lieu d'horaire) : ainsi, sur chaque face, ils se lisent de gauche à
  droite. Changement de la règle R-077 (confirmée « strictement horaire », Q-52) demandé par Kévin : à passer dans le
  journal (modification de R-077 + entrée d'historique) puis dans le moteur (gaines.js), les bandes, les étiquettes,
  l'impression (n° autour des boîtes, v48) et les tests (chantiers.test.mjs : sens horaire).
  Précisé par Kévin (23:21) : .01 reste l'alimentation, la suite tourne dans le sens anti-horaire à partir d'elle.

**Plan : boîtes, gaines, appareils (Kévin, 23:25)**
- Boîtes trop grosses sur le plan : diminuer leur taille (aujourd'hui 3 symboles et au moins 34 px à l'écran, 11 mm
  minimum à l'impression).
- **Jamais de gaines qui se croisent.** Quand on déplace une boîte, ses gaines se recalculent automatiquement pour ne
  pas se croiser (choix des points d'accroche et des tracés, entre gaines d'une même boîte et entre boîtes voisines).
  Les tracés faits à la main (points de passage) restent prioritaires : à signaler s'ils créent un croisement.
- **Jamais d'appareils qui se chevauchent** sur le plan (symboles posés au même endroit ou trop près : décalage
  d'affichage, l'appareil garde sa position réelle).
- **Taille des appareils adaptée au dessin** : symboles proportionnés à la taille du plan et des pièces (aujourd'hui
  taille fixe réglable, au moins 12 px à l'écran), à l'écran comme à l'impression.
  Décision (Claude, 23:26) : une seule taille pour tout le plan, calculée d'après le dessin (taille de la maison et des
  pièces) ; proportions entre symboles inchangées (prise > interrupteur, lumière ronde) ; bornes mini / maxi (≥ 2,5 mm
  imprimé, ≥ 12 px écran) ; jamais de taille différente selon l'endroit (zone chargée = décalage d'affichage avec trait
  de rappel, même taille) ; réglage manuel gardé. Aucun effet sur les calculs (positions réelles inchangées).
- **Tourner le fond de plan (Kévin, 23:41)** : pouvoir faire pivoter le fond (90°, 180°, et quelques degrés pour un
  scan de travers) pour travailler en vue droite ; le dessin déjà fait tourne avec lui (murs, appareils, boîtes), et
  le relevé IA / automatique reste calé sur la page d'origine.
- **Noms des pièces (Kévin, 23:32)** :
  - position modifiable : on glisse le nom à la main dans sa pièce ; la position choisie est gardée (enregistrée avec la
    pièce, respectée par le placement automatique des étiquettes et à l'impression) ;
  - taille modifiable, mais commune : changer la taille d'un nom change celle de TOUS les noms de pièces, pour qu'ils
    soient tous de la même taille (réglage du chantier, à l'écran et à l'impression).
- Nouvelle vue dans le détail du câblage (onglet Bandes, feuille de boîte) : **les 4 tranches de la boîte** (faces A à D
  vues de face), avec sur chacune le n° de chaque gaine et son aboutissant (repère de l'appareil, pièce), pour aider le
  perceur de boîte. À prévoir aussi dans le PDF des bandes / étiquettes.

## Notes du 28/10/2026 (08:37), réponses de Kévin — pour les prochaines mises à jour
- **Relecture ciblée étendue et plus fine** : toutes les détections d'erreurs du logiciel génèrent la consigne
  (pièces non fermées, ouvertures recentrées, appareils hors pièce, doutes de l'étude, en plus des liaisons) ; consigne
  plus précise par type d'erreur (ce qu'il faut regarder, où, quels candidats). Kévin : « c'est le seul moyen d'alerte
  que nous avons » → précision de Claude : pour l'IA oui ; pour le dessinateur il y a aussi le contrôle permanent
  (compteur ⚠, halos) et les doutes de l'étude.
- **Impression dans le sens de la vue tournée** : à intégrer dans une prochaine mise à jour (option « comme à l'écran »).
- **Croisements de gaines — règle précisée par Kévin** : les gaines d'une MÊME boîte ne doivent JAMAIS se croiser
  (contrainte stricte, aujourd'hui 1 cas sur MAILLARD) ; deux gaines de boîtes différentes peuvent se croiser (permis).
  → Le tracé ne cherche plus à éviter les croisements entre boîtes ; le zéro croisement dans une boîte est garanti
  (points d'accroche + tracé, sinon détour) et signalé s'il est impossible (gaine épinglée à la main).
  → Améliorer le choix d'implantation des boîtes : le placement (modes proximité / équilibrée / par pièce) doit éviter
  les boîtes dont les gaines se croiseraient (appareils d'une boîte « entremêlés » avec ceux d'une autre).

## Mise à jour 61 — FAIT (28/10/2026, 0.61.0) — relecture ciblée étendue et plus fine (définie avec Kévin, 28/10/2026, 08:47–08:49)
- Points envoyés à l'IA en plus des liaisons : pièce nommée non fermée, ouverture recentrée / rétrécie / loin des murs,
  porte sans sens, appareil hors pièce, type vague (SC) ou peu probable, prise de cuisine sans hauteur, doublons,
  doutes écrits par l'IA dans « remarques ». Repères O1, O2… pour les ouvertures. Question propre à chaque erreur.
- Avec clé : image agrandie autour de chaque point (en plus du plan entier). Sans clé : zone précise en % de la page.
- Réponse : liaisons, ajouts, types, portes, ouvertures, murs, doublons, hauteurs, introuvables. Aperçu + un Ctrl+Z.
- L'IA peut modifier (types compris), visible dans l'aperçu (Kévin, 08:49).
- **Rapport de l'analyse IA** (Kévin, 08:49) : ce qui a été modifié, ce qui n'a pas été trouvé, et un % de réussite,
  « sous réserve du contrôle BE ». Décisions (Claude) : % = points résolus / points signalés, par relecture et au total ;
  chaque point avec son repère, l'erreur, la correction (avant → après) ou la raison de l'IA ; gardé dans le chantier
  (historique des relevés et relectures, moteur, durée, jetons) ; consultable dans l'onglet Étude.
- Limites inchangées (2 relectures auto, arrêt sans progrès, 3 min, Arrêter, introuvable jamais redemandé).
- Consigne sans clé : le n° de page vient de la page choisie à l'import du fond (aujourd'hui « page 1 » écrit en dur) ;
  phrase « ignore les autres pages (plan du BE, notices) » (Kévin, 09:02 : la page 2 des PDF contient le plan du BE).

## Mise à jour 62 — FAIT (28/10/2026, 0.63.1) — types d'implantation des boîtes revus (Kévin, 28/10/2026, 08:38 ; décisions laissées à Claude)
- Livré : note « belle pieuvre », Économique = le moins de cuivre (coût d'une boîte réglable, petites boîtes fondues),
  volets selon le mode, impression dans le sens de la vue ; Q-86 et Q-87 à faire valider par Kévin. Mode « Par zone » : FAIT (0.63.2, jour / nuit / garage, Q-88 à valider).
Réponses de Kévin : le BE fait « selon sa logique : des économies tout en réalisant de belles pieuvres, sans trop
croiser les gaines » ; boîte posable partout (on y reviendra) ; autant de modes que judicieux ; volets adaptés au mode.
Décisions (Claude) :
- **Une note de qualité commune** à tous les modes (« belle pieuvre »), calculée et affichée pour chaque proposition :
  aucun croisement dans une même boîte (obligatoire) ; territoires des boîtes bien séparés (pas d'appareils d'une boîte
  au milieu de ceux d'une autre) ; longueur de gaine ; nombre de boîtes ; départs équilibrés ; gaines pas trop longues.
  Les modes ne diffèrent que par le poids donné à chaque critère.
- **Économique** (ancien Proximité) : le moins de **cuivre** (rectification de Kévin, 08:45 : longueur de chaque gaine ×
  nombre de fils, pas la longueur de gaine seule ; une gaine de 5 fils pèse plus qu'une de 3), dans la limite d'une
  belle pieuvre ; volets dans les boîtes voisines si c'est moins de cuivre, sinon boîte(s) de volets. Q-77 (« plus
  petite longueur de gaine d'abord ») à mettre à jour dans le journal avec Kévin.
- **Équilibrée** (comme le BE) : le moins de boîtes, parts égales ; une boîte à part pour les volets (R-094), coupée en
  deux si les volets sont aux deux bouts de la maison et que ça évite de traverser toute la maison (à vérifier sur MAILLARD).
- **Par pièce** : la boîte de chaque pièce ou groupe de petites pièces ; volets dans la boîte de leur pièce.
- Autres modes envisagés (Claude, 08:45) : « Par zone » (jour / nuit / garage, une boîte par zone, découpage d'après
  les pièces voisines) proposé à Kévin — le BE ne le fait pas, mais Kévin veut l'avoir (08:46) : à ajouter dans une
  mise à jour après la 62 ; écartés : « gaines courtes » (devient un critère de la note), « près du tableau »
  (déjà compté dans le cuivre des alimentations).
- Comparer les modes affiche la note de qualité ; R-094 complété pour Par pièce (journal, à faire valider par Kévin).

## Pistes pour rendre le logiciel plus autonome (réflexion du 28/10/2026, 08:59, à décider avec Kévin)
1. **Analyse de fin de chantier** (idée de Kévin) : photos du chantier à chaque étape (relevé IA brut, après relectures,
   après câblage automatique, version validée BE) ; écart classé (appareils ajoutés / retirés / déplacés / changés de
   type, liaisons, boîtes déplacées, gaines retracées, circuits, fils) ; cumul sur les chantiers → propositions de
   règles nouvelles ou à revoir dans le journal (validées par Kévin) et taux de réussite mesuré par moteur IA et par
   pavillonneur. Prérequis : garder ces versions dans le chantier (aujourd'hui seulement l'annulation).
2. **Plans déjà faits (modèles de pavillonneur)** : empreinte du plan (pièces, surfaces, graphe des murs, en miroir
   aussi) comparée aux chantiers passés ; un modèle déjà fait = partir du chantier validé, l'IA ne relève que les écarts.
3. **Profil de pavillonneur** : sa légende de symboles (lue une fois), ses habitudes (hauteurs, volets connectés), ses
   équipements hors plan et ses packs, appliqués à la création du chantier.
4. **Lecture du devis** : équipements hors plan et quantités lus dans le devis au lieu d'être cochés (R-100).
5. **Boîtes standard** : compositions de boîte qui reviennent d'un chantier à l'autre → bandes identiques, fabrication
   en série (intérêt atelier à confirmer par Kévin).

## 63 — Mode BE / Mode IA et coûts du chantier — FAIT (28/10/2026, 0.63.0 ; demande de Kévin du 28/10, 15:46)
- **Mode BE** = l'interface actuelle, conservée telle quelle (tout le détail des choix et du résultat).
- **Mode IA** = interface légère, le moins de clics possible, alertes et résultat : un seul écran (plan + colonne
  « parcours » : plan → relevé IA → relecture automatique → hors plan → câbler → résultat), une seule liste d'alertes
  (contrôle, relecture, étude) avec action directe, résultat = bandes / dossier / rapport IA ; barres d'outils, vues,
  panneaux et onglets détaillés masqués ; bascule Mode BE / Mode IA à tout moment, mêmes données.
- Réponses de Kévin (16:26) : un technicien BE fait tourner tout le logiciel ; la vue simplifiée sert à se concentrer
  sur l'IA ; toujours avec une clé ; résultat = dossier PDF complet ; retouche = passage en mode BE.
- **Coût IA par chantier** (question de Kévin) : jetons réels renvoyés par l'API à chaque appel (relevé + relectures ;
  aujourd'hui seules les relectures sont comptées) cumulés dans le chantier et le rapport IA ; estimation avant de lancer
  (image + consigne + réponse attendue) ; coût en € si on saisit le prix par million de jetons dans Paramètres (prix non
  écrits dans le code : ils changent).
- Livré : parcours en 7 étapes, copier / coller sans clé (essais), jetons réels du relevé et des relectures, temps BE
  et coûts (Paramètres → Coûts d'un chantier). Ergonomie du Mode BE ci-dessous = mise à jour 64.
- **64 — FAIT (28/10/2026, 0.64.0)** : ergonomie du Mode BE livrée (fenêtre unique, compteur unique, onglet Pieuvre, panneau Câblage allégé, ⓘ).
- Ergonomie (propositions de Claude, **mise à jour 64**) : une seule fenêtre de travail à la fois (les cartes ne s'empilent plus) ; un seul
  compteur « à vérifier » (contrôle + doutes) ; panneau Câblage allégé ; onglets Boîtes / Lignes directes / Bandes
  réunis ; textes d'aide longs remplacés par des infobulles (?).

## Notes du 28/10/2026 (20:04), Kévin — pour une prochaine mise à jour : gaines hors de la maison, obstacles
- **Gaines qui sortent de la maison** : sur une maison en L (ou en U, avec un porche, un garage en retrait…), l'arc ou
  la ligne droite entre la boîte et l'appareil passe dehors puis rentre. Une gaine doit rester dans l'emprise de la
  maison (combles ou faux plafond au-dessus des pièces). Proposé : contour de la maison (pièces + murs) ; une gaine qui
  en sort passe par l'angle rentrant (point de passage automatique) et sa longueur est recalculée ; une boîte n'est
  jamais posée dehors ; la note « belle pieuvre » compte les gaines qui sortaient.
- **Obstacles** (Kévin cite les trémies ; liste proposée par Claude, à confirmer par Kévin) : trémie d'escalier, trappe
  d'accès aux combles, conduit de cheminée ou de poêle (écart au feu), gaines et caisson de VMC, ballon / chaudière /
  pompe à chaleur en combles, puits de lumière et fenêtres de toit, pièces sans combles au-dessus (rampant, toit plat,
  dalle béton à l'étage), mur coupe-feu entre garage et maison (traversée à limiter), porche ou auvent ouvert.
  Proposé : un objet « obstacle » dessiné sur le plan (rectangle ou polygone, avec son type) ; les boîtes ne s'y posent
  pas, les gaines le contournent (points de passage automatiques) ; une traversée de mur coupe-feu compte comme un doute
  « à vérifier ».
- Réponse de Kévin (20:07) : rien à ajouter ; il ne sait pas exactement quels obstacles reviennent, mais veut pouvoir
  **matérialiser un obstacle** sur le plan. → Mise à jour 65 : contour de la maison + outil Obstacle (types proposés
  ci-dessus, liste modifiable), en attente du « go ».

## Note du 28/10/2026 (20:15), Kévin — Mode IA : échelle saisie
- En mode IA, l'échelle ne se règle qu'en pointant deux points (le panneau Propriétés, qui a la case « 1 / N » de l'outil
  Échelle, y est caché). Kévin veut pouvoir taper « 1/75 » directement dans l'étape 1 du parcours (champ 1 / N +
  « Appliquer » = `okteo.applyScaleRatio(N)`, si le fond est un PDF au format d'origine ; sinon message clair).
  Contournement en attendant : Alt+M (Mode BE) → outil Échelle → case « 1 / … » → Appliquer → Alt+M.

## Note du 28/10/2026 (20:28), Kévin — 2e relevé IA de MAILLARD « moins bien, beaucoup d'oublis »
- Réponse collée : image de 1 654 × 1 169 px (page rendue en basse définition, l'IA le dit : « page imprimée réduite,
  env. 34 px/m »), 63 appareils contre 102 dans le relevé corrigé (1er essai Opus du 27/10 : 100), 14 liaisons contre 33.
  Manquent : 8 CVR, 6 appliques, 9 VV, 7 prises, TAB, interphone, 2 Aqua Air, moteur de garage, 1 TV.
- Cause probable : définition de l'image (symboles de quelques pixels) et réponse sans vérification par la légende.
- À essayer (ajout en tête de consigne donné à Kévin) : page rendue à 200 dpi au moins, lecture par quarts de page,
  légende lue d'abord, décompte par type à la fin. Si c'est mieux : l'intégrer à `pastePrompt` / `aiPrompt`.
- Durée de l'essai : 3 min (1er essai Opus : 9 min) → l'IA a pris un raccourci (image basse définition, sans zoom).
- Essai 3 (21:00, Opus effort moyen, consigne 0.64.1) : 9 min, image 4 960 × 3 508 (300 dpi), 104 appareils pour 102
  (APP 6/6, CVR 8/8, LUM 12/12, INT 10/10, VR 8/8, RJ45 7/7, TV 2/2, AQA 2/2, TAB, MGAR, CETH ; PC16 30/31 + 1 PC20
  « 16Asp H:1.20m » ; VV 13/12 ; BPS + SON en plus ; interphone manquant), 33 liaisons toutes valables (33 au relevé
  corrigé), aucune lumière sans commande ; décompte en tête des remarques comme demandé. → la méthode imposée règle les oublis.
- Essai 4 (21:15, Opus effort fort, même consigne) : 10 min, 104 appareils, 33 liaisons valables ; mêmes écarts (VV 14,
  BPS + SON en plus, interphone absent ; la prise « 16A sp H:1.20m » lue cette fois CETH) ; 102 appareils sur 104 au même
  endroit que l'essai moyen (écart moyen 4 px ≈ 4 cm). → effort moyen suffisant. Interphone absent des deux relevés et
  BPS / SON présents dans les deux : à vérifier par Kévin sur le plan.
- FAIT en 0.64.1 : consigne avec méthode imposée et alerte « basse définition » (point 1 ci-dessous). Reste le point 2.
- À faire (proposé à Kévin, 20:36) : (1) au collage / à la réponse, alerte si `ref.W` < 3 000 px (« relevé fait en basse
  définition, appareils probablement oubliés ») ; (2) la relecture v61 ne voit que les incohérences de ce qui a été
  relevé, pas les oublis : ajouter des points « familles absentes » (volet sans CVR à côté, pas de TAB, cuisine sans
  plaque / four, maison sans interphone ni TV…) envoyés à l'IA comme zones à rechercher.

## 66 — Règles du tableau électrique NF C 15-100:2024 — FAIT (29/10/2026, 0.66.0)
- R-101 à R-161 et Q-89 à Q-110 dans le journal (à valider) ; moteur : différentiels par les circuits, calibre R-124,
  alertes R-105, R-116, R-119, R-123, R-124, R-129, R-130, R-134. Reste : GTL / hauteurs, parafoudre, IRVE, chauffage,
  heures creuses, délesteur, divisionnaire (après les réponses de Kévin aux Q-89 à Q-110).

## Sans date
- Interrupteur à voyant (avec neutre) et nouvel appareillage.
- Export SPV pour Counter.
- Packs propres à chaque pavillonneur (aujourd'hui communs, enregistrés sur le PC).
- Relevé IA en ligne avec une clé (OpenAI Sol / Astra : clé et CORS à vérifier).
- Recollage des murs coupés aux portes pour le relevé Opus.
- Page « Reprendre le projet » : seulement quand Kévin le demandera.
