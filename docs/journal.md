# Oktéo AI — journal de développement

Prototype navigateur de l'outil de dessin (artefact) : https://claude.ai/artifact/7Lb91H5P2y8eCbcgr4eKDu
Depuis le 25/10/2026, la référence du code est le dossier VS Code `okteo-ai` (index.html + src/app.js + src/style.css, servi par Vite, test `npm run check`). L'artefact n'est plus qu'une vitrine.
Chantier d'essai : EVRARD · dossier 04949 (plan Maisons CPR en fond).

## Cap produit
- Logiciel de dessin très rapide et agréable pour le BE pieuvres ; pas une copie de FTZ ni des CAO existantes.
- Claude pilote le développement et apporte l'expertise dessin ; avancer par gros incréments.
- Principe d'ergonomie : les actions viennent à la souris (menu flottant près de l'objet), pas l'inverse.
- Toute correction manuelle doit survivre aux recalculs (défaut principal de FTZ : la régénération écrase les corrections).
- Le logiciel doit rester apprenable par un débutant : Kévin trouve que les fonctions vont plus vite que lui (25/10/2026).

## Décisions d'organisation (25/10/2026)
- Étape 1 = « dessin » : bâtiment et implantation des appareils restent dans le même éditeur. Pas de séparation en outils distincts pour l'instant.
- Étape 2 = câblage (boîtes, liaisons, bandes, SPV) : plus tard, c'est le terrain de Kévin ; ses règles métier seront demandées à ce moment-là.
- Kévin veut avancer vite mais sans partir dans tous les sens : une fonction ou un sujet à la fois, pour ne pas oublier de détails.
- Le développement passe dans VS Code (Kévin a une clé API) : dossier `okteo-ai` livré le 25/10/2026.

## État au 25/10/2026 (version 12 du prototype)
- Tracé : outil Pièce (rectangle → 4 murs + surface), Mur en chaîne, saisie de longueur au clavier, angles droits, accrochage sommets/grille 5 cm, jonctions nettes, épaisseur réglable.
- Ouvertures : portes/fenêtres qui percent le mur, glisser le long du mur, poignées de largeur, gond/sens (G/S).
- Édition : sélection simple et multiple (cadre gauche→droite = dedans, droite→gauche = touché ; Maj+clic), déplacement de groupe, glisser un mur pour le déplacer, pièce déplaçable avec ses murs et son contenu, rotation 90° (R / Maj+R), symétries (X / Y), dupliquer (Ctrl+D), copier-coller sous le curseur (Ctrl+C/V), tout sélectionner (Ctrl+A), redimensionnement réel d'une pièce.
- Appareils : pose répétée avec aperçu sous le curseur, aimantation au mur, guides d'alignement, pose à distance exacte de l'angle (taper 30 + Entrée = 30 cm de la face intérieure du mur d'angle), série équirépartie, repères auto (P1, L1, I1…), liaisons commande→lumière + mode test.
- Cotes : permanentes sur les murs + cotes libres. Calques visibles/verrouillables. Annuler/rétablir, sauvegarde navigateur, export JSON.
- Corrigé : décalage entre point cliqué et point affiché quand la fenêtre n'avait pas les proportions du plan.
- Problème ouvert et prioritaire : les murs et appareils du plan EVRARD sont placés à l'œil, pas exacts.

## Version 13 (25/10/2026) — livrée : assistant IA, fonctions, paramètres
Décidé avec Kévin le 25/10 : il a des clés Claude et NVIDIA ; il est seul à les utiliser pendant les tests (clés sur son PC) ;
l'assistant peut agir seul quand on le lui demande.
- Onglet **Paramètres** (gauche) : clé Claude et/ou NVIDIA, modèle, « Tester la connexion », choix du fournisseur. Clés dans le navigateur du PC ou dans `.env`.
- Relais IA dans le serveur local (`vite.config.js`, routes `/ai/anthropic`, `/ai/nvidia`, `/ai/status`).
- Panneau de droite façon extension : onglets Propriétés / Assistant, largeur réglable, repliable, état mémorisé ; emplacement générique pour de futures extensions (règles, boîtes…).
- **Assistant** (touche A ou bouton ✦) : répond sur les fonctions (reçoit tout le catalogue), agit sur demande (activer un outil ou une fonction, sélectionner, centrer la vue, renommer une pièce ; suppression toujours confirmée), propose des boutons, repères [a12]/[r3] cliquables, historique par chantier. Sans clé : recherche locale dans les fonctions.
- **Analyser le plan** : image JPEG de tout le plan (fond + dessin) + données JSON (pièces, appareils avec pièce d'appartenance, liaisons, ouvertures, murs) ; vérifie dessin, éclairage, prises (repères NF C 15-100 « à vérifier »), ce qui reste à dessiner.
- **Catalogue des fonctions** (`src/ext/catalog.js`) + palette **Ctrl+K** / F1 / ? avec recherche ; infobulles automatiques sur les outils.
- NVIDIA : Nemotron demandé par Kévin (clé NVIDIA NIM gratuite). 1er choix `nemotron-nano-12b-v2-vl` = erreur 410 chez Kévin (modèle retiré le 26/08/2026) → défaut **Nemotron 3.5 Super VL** (`nvidia/nemotron-3.5-super-vl-120b-a12b`, lit les images) ; réflexion via `enable_thinking` (coupée pour les questions, activée pour l'analyse) ; image allégée sous 180 Ko ; bouton « Charger les modèles » (liste réelle du compte) ; remplacement automatique d'un modèle retiré. La clé de Kévin fonctionne (le 410 prouve l'authentification).
- Tests : 26 vérifications (`npm run check`), faux serveur Claude/NVIDIA.
- Pas encore testé avec les vraies clés de Kévin (pas d'accès réseau aux fournisseurs depuis l'environnement de Claude).

## Version 14 (25/10/2026) — livrée : chantiers + import du plan + échelle
- Onglet **Chantiers** (et clic sur le nom du chantier dans la barre) : chantier ouvert (nom, n°, pavillonneur modifiables), liste avec recherche,
  nouveau chantier, ouvrir, dupliquer, supprimer (confirmation ; impossible pour le chantier ouvert), fichier `.okteo` (dessin + image du fond + PDF d'origine) et ouverture d'un fichier `.okteo`.
- EVRARD 04949 repris automatiquement comme premier chantier (ancienne sauvegarde conservée).
- Import du plan : PDF (vignettes des pages, page paysage présélectionnée, rendu ~4500 px) ou image/photo ; le PDF d'origine est gardé pour le futur relevé automatique des murs.
- **Mise à l'échelle 2 points** : cliquer les extrémités d'une cote connue, taper la longueur réelle ; lancée automatiquement après l'import ; « Régler l'échelle » pour refaire ; « Changer le fond » garde le dessin.
- Assistant : historique propre à chaque chantier. Catalogue : 4 nouvelles entrées (Chantiers, échelle, nouveau chantier, fichier).
- Tests : 34 vérifications, dont le parcours complet sur le vrai PDF EVRARD.

## Version 15 (25/10/2026) — livrée : relevé automatique des murs depuis le PDF (sans IA)
- Le PDF EVRARD (Maisons CPR) dessine chaque morceau de mur comme un polygone grisé (#9c8e8e), interrompu aux ouvertures ;
  des bandes fines (< 4 cm) le long des façades = enduit/doublage, ignorées.
- `src/walls/extract.js` lit les traits du PDF d'origine (pdf.js) ; `src/walls/detect.js` : bandes entre bords parallèles
  d'un même polygone (épaisseur 4–45 cm), recollage des morceaux alignés, trous de 0,40 à 3,20 m = ouvertures
  (cloison < 15 cm → porte, sinon fenêtre, à confirmer), prolongement jusqu'à l'axe du mur touché (L, T, cloison arrêtée
  jusqu'à 20 cm avant), coupure des murs aux jonctions en T, sommets fusionnés à 2 cm. Secours sur les traits si pas d'aplats.
- Résultat EVRARD : 32 murs (cloisons 7 cm, murs 16–19 cm à l'échelle d'essai), 17 ouvertures, angles reliés ;
  axe et épaisseur identiques aux polygones du PDF (écart ≤ 1 cm), en 20 à 40 ms.
- Interface : proposé juste après l'échelle ; Chantiers → « Relever les murs » ; Ctrl+K. Aperçu orange, épaisseur min./max.,
  option « remplacer les murs existants », « Ajouter au dessin » (un seul Ctrl+Z).
- Chaque mur a maintenant sa propre épaisseur (`seg.ep`), modifiable dans son menu (« ép. ») ; mesures « à X cm de l'angle »
  calculées depuis la face réelle du mur d'angle.
- Code partagé sur GitHub (`kevincruveilher-png/okteo-ai`) : mises à jour par Synchroniser dans VS Code.
- Tests : 8 (moteur, vrai PDF) + 39 (navigateur) = 47.

## Version 16 (25/10/2026) — livrée : appareils attachés à leur mur
- Chaque appareil mural garde `a.wa` = distance à la FACE du mur d'angle le plus proche + côté du mur ; il est replacé
  avant chaque dessin : il suit son mur déplacé, tourné, symétrisé (même non sélectionné), allongé ou épaissi, et le mur
  d'angle épaissi ne change pas sa distance (règle « 30 cm de l'angle »).
- Suppression d'un mur portant des appareils : choix « supprimer avec » / « garder détachés » (Ctrl+Z possible).
- Appareil déplacé seul (en groupe) : se raccroche au mur le plus proche ; relevé PDF « remplacer » : raccrochage automatique.
- Corrigé au passage : le rectangle (et la surface) d'une pièce suit désormais ses murs déplacés.
- Tests : 8 (relevé PDF) + 47 (navigateur, dont 8 nouveaux sur l'attache) = 55.

## Version 17 (25/10/2026) — livrée : détection des pièces et de leurs noms (sans IA)
- Pièces = faces fermées du réseau des axes de murs (après retrait des murs pendants), y compris en L ; une pièce garde la
  suite ordonnée de ses murs (`cycle`) : forme et surface habitable (entre faces intérieures) suivent les murs.
- Noms lus dans le PDF : le PDF EVRARD a une police « codée » (glyphes sans correspondance avec les lettres) et la 1re lettre
  de chaque nom dessinée à part (« hambre 1 », « arage ») ; décodage sans IA par la forme des mots (lettres répétées) et une
  correspondance code→lettre cohérente dans la police, contre une liste de noms de pièces. EVRARD : 9 noms sur 9 retrouvés.
- Résultat EVRARD : 7 pièces (Espace de Vie 46,4 m² en L, Garage 13,4, Chambre 1 12,0, Chambre 2 10,0, Bains 6,0,
  Cellier 5,6, Dressing 4,0 à l'échelle d'essai) ; « Espace de Vie » contient aussi « Dgt » et « WC » : sur ce PDF les
  cloisons du WC et du dégagement ne sont pas grisées → avertissement « un mur manque ».
- Proposé automatiquement après « Ajouter au dessin » du relevé ; commande Ctrl+K « Détecter les pièces » (marche aussi sur des
  murs dessinés à la main s'ils se rejoignent aux angles) ; panneau de la pièce : surface habitable, avertissements.
- Tests : 14 (moteur, vrai PDF) + 51 (navigateur) = 65.

## Version 18 (25/10/2026) — livrée : impression PDF du plan
- PDF vectoriel (jsPDF 2.5.2) à l'échelle exacte ; mise en page automatique (A4 puis A3, 1:50 puis 1:75…1:200) ou imposée.
- Page 1 : plan (murs découpés aux ouvertures, portes avec arc, fenêtres, cotes des murs et cotes libres, pièces + surface
  habitable, symboles, repères, hauteurs hors standard, liaisons), légende avec quantités, échelle graphique, cartouche
  (chantier, n°, pavillonneur, niveau, échelle/format, date, indice). Fond de plan estompé en option.
- Page 2 : nomenclature (appareils par pièce et par type, surfaces, totaux) + liste des appareils (repère, type, hauteur, pièce).
- Fenêtre « Imprimer » (bouton 🖨, Ctrl+P) avec aperçu dessiné par pdf.js et téléchargement.
- Contrôle automatique : le test relit le PDF produit (pdf.js) et vérifie format, pages, textes et l'échelle (largeur des murs
  dans le PDF = largeur réelle × 1000 / échelle, à 0,5 pt près).
- Tests : 14 + 55 = 69.

## Version 19 (25/10/2026) — livrée : relevé automatique des appareils du PDF
- Demande de Kévin : continuer le dessin, ne pas attaquer les boîtes. Sans IA.
- Lecture des symboles du plan pavillonneur : cercles (tracés en polylignes dans le PDF EVRARD) + ce qui les accompagne dans la
  même couleur : point lumineux (gros cercle, traits intérieurs), spot (rayons), prise (trait intérieur), interrupteur (queue),
  va-et-vient (deux queues opposées), RJ45 (cercle dans le cercle), sortie de câble (croix diagonale qui dépasse), bouche VMC
  (croix droite). Tailles relatives au petit cercle le plus fréquent : indépendant de l'échelle.
- Prises 20/32 A : texte voisin (police codée : même longueur et même dernière lettre que « 16A » mais différent).
- Liaisons reprises des traits bleus : commande → lumières touchées, puis de lumière en lumière (sans traverser une autre commande).
- Nouveau type d'appareil « Sortie de câble » (SC), dans la palette, l'impression et la nomenclature.
- Enchaînement : murs → pièces → appareils (case cochée par défaut), bouton « Relever les appareils » sur la page Chantiers, Ctrl+K.
- Résultat EVRARD : 82 appareils (29 prises 16 A, 3 prises 20/32 A, 4 RJ45, 21 interrupteurs, 10 points lumineux, 8 spots,
  7 sorties de câble), 26 liaisons, 64 appareils collés à leur mur. 37 petits cercles non reconnus (plaques, robinets…) montrés.
- Limites : hauteurs « H:1.20m » non lues sur police codée (valeurs par défaut) ; appliques demi-cercle dans les murs
  extérieurs non reconnues ; symboles propres à chaque pavillonneur → tester sur d'autres plans.
- Tests : 19 (moteur, vrai PDF) + 58 (navigateur) = 77.

## Version 20 (25/10/2026) — livrée : lecture des cotes et des hauteurs, contrôle de l'échelle
- Le PDF EVRARD utilise une police codée : les chiffres des textes ne sont pas des vrais chiffres. Nouveau décodage sans IA
  par les cotes du plan : chaque cote est posée le long d'un trait qui mesure sa valeur ; en comparant on retrouve les
  10 chiffres (40 cotes relues exactement sur EVRARD), même si l'échelle du fond est fausse (essai de facteurs 0,3 à 3).
- Hauteurs et intensités des prises lues : « 16A H:1.20m », « 32A H:0.65m », « 20A H:0.60m », textes séparés réunis.
  EVRARD : 13 hauteurs lues (Cellier 120, Bains 110, Garage 120, cuisine 30/60/65/120/220…).
- Contrôle de l'échelle : la carte du relevé des murs affiche « ✓ Échelle confirmée par N cotes » ou « ⚠ décalée de x % »
  avec « Corriger l'échelle ». Bug corrigé au passage : l'angle des textes ignorait la rotation de la page.
- Tests : 23 + 60 = 83.

## Analyse complète (25/10/2026)
Défauts relevés par Claude, classés : graves (stockage navigateur seul et échec silencieux ; repères renumérotés ;
relevés testés sur un seul pavillonneur ; WC/Dgt fondus dans le séjour), relevé incomplet (appliques, tableau, BP,
hauteurs des interrupteurs, liaisons groupées, étages), interface (panneau qui déborde, barre trop chargée, plan illisible
en vue d'ensemble, menu flottant qui masque, pas de « Premiers pas »), technique (app.js trop dense, relais IA seulement
en mode dev, clés en clair, tests centrés EVRARD). Ordre : v21 fiabilité, v22 cloisons fines + appliques/tableau/BP,
v23 lisibilité, puis étages et découpage d'app.js. Kévin : envoyer 2–3 PDF d'autres pavillonneurs.

## Version 21 (25/10/2026) — livrée : fiabilité
- Repères fixes (numéro stocké sur l'appareil) ; commande « Renuméroter les repères » (pièce par pièce).
- Enregistrement : échec signalé (voyant « ⚠ Non enregistré » + alerte « Enregistrer en fichier »), stockage persistant
  demandé au navigateur, sauvegarde automatique .okteo dans un dossier choisi (Chrome/Edge), état « copie HH:MM » en haut.
- Panneau Propriétés : plus de champs coupés. Barre d'outils sur 2 lignes avec icônes, appareils dessinés avec leur
  symbole, menu « Affichage » (cotes, repères, fond, symboles, thème, export JSON).
- Tests : 23 + 65 = 88.

## Version 22 (25/10/2026) — livrée : WC/Dgt séparés, appliques
- Constat sur le PDF EVRARD : le WC n'a pas de cloison côté dégagement, seulement sa porte dessinée en travers ; le
  dégagement est réellement ouvert sur le séjour (passage sans porte).
- Portes en travers : arc de porte → mur + porte ajoutés (coupe en T des deux murs). WC = 1,7 m² (échelle réelle).
- Limites de pièce (murs virtuels, pointillés) proposées aux étranglements quand deux noms tombent dans la même pièce ;
  aussi à la main (case « Limite de pièce » dans le menu d'un mur). EVRARD : 9 pièces, chaque nom dans sa pièce.
- Appliques (demi-cercles contre un mur) : nouveau type « Applique » (repère L, murale, 180 cm). EVRARD : 5 trouvées
  (extérieur nord ×2, sud, garage, au-dessus de la vasque des Bains), toutes avec leur interrupteur.
- Tableau : seulement si le texte est lisible (EVRARD est en police codée → à poser à la main).
- Boutons poussoirs : aucun sur EVRARD → pas de reconnaissance sans exemple réel (à faire avec un plan qui en a).
- Tests : 28 + 65 = 93.

## Version 23 (25/10/2026) — livrée : lisibilité du plan
- Textes à taille fixe à l'écran (13 px noms, 11 px surfaces/repères/cotes), placés sans chevauchement (module place.js) ;
  noms de pièces déplacés dans la pièce si besoin, repères autour du symbole, longueurs de murs masquées faute de place.
- Symboles ≥ 12 px en vue d'ensemble ; poignées des sommets à taille fixe ; liaisons fines, celles de l'appareil
  sélectionné mises en avant.
- Impression : même placement (repères + hauteurs, noms, cotes) ; vérifié visuellement sur EVRARD (A3 1:50).
- Correction : la carte « Pièces » affichait « Aucune pièce » si on annulait/rétablissait pendant son calcul ; elle se
  recalcule maintenant quand le dessin change.
- Tests : 28 + 68 = 96 (non-chevauchement à deux zooms, taille constante, mise en avant des liaisons).

## Version 24 (25/10/2026) — livrée : niveaux
- Barre des niveaux (RDC, R+1, combles, sous-sol) : ajouter (avec les murs extérieurs du niveau ouvert), renommer,
  supprimer (Ctrl+Z le rend avec son plan), Page ↑/↓. Chaque niveau a son dessin et son fond ; une autre page du même PDF
  reprend position et échelle du RDC. Niveau du dessous en transparence. Impression du niveau ouvert (nom au cartouche).
  .okteo avec tous les niveaux. Relevés automatiques par niveau.
- Défaut corrigé pendant le développement : la liste des niveaux gardée en mémoire écrasait la mise à l'échelle du
  fond ; on relit désormais toujours la liste enregistrée.
- Limite : pas de liaison entre deux niveaux (va-et-vient d'escalier) ; pas d'impression de tous les niveaux d'un coup.
- Tests : 28 + 72 = 100.

## Version 25 (25/10/2026) — livrée : liaisons entre niveaux, impression de tous les niveaux
- Outil Liaison : la commande choisie reste active en changeant de niveau (Page ↑/↓) ; étiquettes « → L1 Étage » /
  « ← I5 RDC » à l'écran, « commande … / commandé par … » à l'impression et dans la nomenclature.
- Impression « Tous les niveaux » : une page par niveau (même format, même échelle), nomenclature commune.
- Corrigé au passage : « plafond » écrit pour une sortie de câble sans hauteur → « hauteur à préciser ».
- Tests : 28 + 74 = 102.

## Version 26 (25/10/2026) — livrée : découpage du cœur
- `src/app.js` (1 200 lignes denses) découpé automatiquement (outil d'analyse du code, sans réécriture à la main) en
  13 fichiers `src/core/` par thème, remis en forme lisible. Variables partagées dans l'objet `K`, fonctions exportées.
- Aucun changement de comportement : les 102 vérifications passent (plusieurs passages), construction `vite build` OK.
- `npm run check` vérifie maintenant la syntaxe de tous les fichiers (scripts/syntax.mjs).
- Kévin : faire un `git pull` avant de modifier quoi que ce soit dans VS Code (app.js a complètement changé).

## Version 27 (25/10/2026) — livrée : premiers pas
- Visite guidée en 15 étapes (zone éclairée + bulle, clavier ← → Échap), proposée à la 1re ouverture sans bloquer.
- Onglet « Étapes » : 8 étapes du chantier cochées automatiquement, bouton de l'étape suivante (relevés, échelle,
  liaison, impression, sauvegarde). Événement `okteo:printed` au téléchargement du PDF.
- Tests : 28 + 77 = 105.

## Version 28 (25/10/2026) — livrée : câblage, étape 1 (réglages et circuits)
- Règles recueillies auprès de Kévin : `docs/regles-cablage.md` (18 départs / 6 par face, faces A–D sens horaire,
  alimentation de boîte depuis le tableau, lignes directes pour spécialisés et RJ45/TV, NF C 15-100, couleurs, gaine
  selon la place des fils, +10 %, document de boîte pour câbleur débutant, retours lampe et navettes tracés).
- Paramètres → Câblage (toutes les valeurs réglables) ; onglet Câblage : répartition automatique en circuits
  (EVRARD : éclairage 8 / 7 / 8 points, 4 circuits de prises, spécialisés et sorties de câble en lignes directes, COM),
  couleurs sur le plan, déplacement d'appareils, section / protection / nom, alertes, annulable, enregistré.
- Moteur `src/cablage/` testé sans navigateur (`scripts/cablage.test.mjs`).
- Tests : 28 + 14 + 81 = 123.

## Versions 29 et 30 (25/10/2026) — livrées ensemble : boîtes, gaines et fils
- Boîtes placées automatiquement pour économiser le cuivre (EVRARD : 7 boîtes, 108 gaines, 614 m de gaine, 1 700 m de
  fil ; dans le test moteur : 1 356 m de fil contre 1 644 m avec une seule boîte), 18 départs / 6 par face respectés, commande + lumières dans
  la même boîte, alimentation par circuit depuis le tableau ; boîtes déplaçables à la souris (un Ctrl+Z).
- Gaines : n° B1-01…, face A–D, longueur (+10 %, descentes, surlongueurs, arrondi), diamètre par remplissage, fils avec
  couleur, section et n° de raccordement ; raccordements de chaque boîte (n° 1 = terres) ; lignes directes.
- Onglets Boîtes et Lignes directes ouverts ; « Bandes » reste pour le schéma de boîte (v31).
- À valider par Kévin : contenu des gaines (va-et-vient, télérupteur), hauteur du haut du tableau (1,80 m), surlongueurs.
- Tests : 28 + 26 + 84 = 138.

## Version 31 (26/10/2026) — livrée : liaisons visibles, menu Relevé, relevé par l'IA, version en ligne
- Demandes de Kévin : « je ne vois pas les liaisons », « je n'arrive pas à utiliser la détection des murs », trois
  détections séparées, et un bouton IA pour comparer.
- Outil Liaison : tout visible, appareils sans liaison cerclés en orange, compteur, clic commande / lumière / liaison,
  Suppr. Menu « ⤓ Relevé » en haut (avant : relevés cachés dans Ctrl+K et l'onglet Étapes). Échelle réglée toute seule
  d'après les cotes. Relevé par l'IA (Claude en ligne ou en local, NVIDIA en local) avec cases murs / pièces / appareils.
- Version en ligne : https://kevincruveilher-png.github.io/okteo-ai/ (GitHub Pages, branche gh-pages, `npm run deploy`).
- Essai IA sur EVRARD (Claude a rédigé la réponse à l'œil sur l'image envoyée par le bouton) : murs à 6 cm près en
  moyenne, 95 % à moins de 15 cm ; 8 pièces sur 9 (le Dgt fondu dans l'Espace de vie) ; 62 appareils dont 50 au bon
  endroit sur 87 ; 22 liaisons sur 31. Conclusion : géométrie = référence pour les PDF vectoriels, IA = secours pour
  les plans scannés. À refaire avec une vraie clé (Claude Sonnet) et un plan scanné.
- Tests : 30 + 26 + 91 = 147.

## Version 32 (26/10/2026) — livrée : repères par allumage, passage des gaines, cadenas des boîtes
- Règles de Kévin : commande et lumières reliées = même numéro (I3, L3) ; 2e du même type = A, 3e = B (VV1/VV1A,
  L3/L3A, BP1/BP1A/BP1B, S3/S3A) ; seul = numéro sans lettre ; non relié = garde son numéro.
- Gaines : points de passage libres (pas d'accroche aux murs, distance au mur affichée, Maj = droit, double-clic =
  supprimer, « Remettre en ligne droite ») ; +10 % conservés sur un tracé à la main (décision de Kévin).
- Boîtes : cadenas ; verrou automatique quand on déplace ou retrace ; au recalcul, cases à cocher (verrouillées décochées).
- Familles de repères changées : spot S, applique AP, va-et-vient VV (les anciens chantiers sont renumérotés tout seuls).
- Tests : 30 + 28 + 94 = 152.

## Version 33 (26/10/2026) — livrée : schémas de boîte pour le câbleur (onglet Bandes)
- Pour chaque boîte : schéma carré (faces A–D, gaines avec n°, longueur, Ø, appareil, fils couleur + n°), connecteurs
  au centre, retours lampe et navettes tracés ; orientation (pièce de chaque côté) ; matériel (connecteurs 2/3/5/8/12
  entrées, ponts) ; raccordements dans l'ordre à cocher ; contrôle final. Impression A4, une feuille par boîte.
- N° de raccordement réordonnés : 1 = terres, puis neutres, phases, retours et navettes (ordre de câblage de Kévin).
- Kévin : gaines déjà repérées ; connecteurs rapides 2, 3, 5… jusqu'à 12 entrées (tailles intermédiaires supposées
  8 — réglable) ; pas de page « Reprendre le projet » pour l'instant (il dira quand).
- Correction après remarque de Kévin : une seule gaine d'alimentation par boîte (phase + neutre de chaque circuit,
  une terre), divisée en deux seulement si elle passait en Ø25 (avant : une gaine par circuit). EVRARD : 1 356 → 1 276 m
  de fil (test moteur). Puis : une seule terre par boîte même si la gaine est divisée (dans la 1re), fils du
  télérupteur dans la gaine d'alimentation (confirmé), connecteurs 2, 3, 4, 5, 6, 8, 10, 12 entrées.
- Tests : 30 + 33 + 96 = 159.

## Version 34 (26/10/2026) — livrée : couleurs par circuit, gaines partagées, câble extérieur
- Comparaison avec une boîte FTZ (LI03) : deux circuits 1,5 dans une même gaine étaient tous deux rouge/bleu
  (indiscernables) → paires de couleurs par circuit (rouge/bleu, gris/bleu foncé) ; retours/navettes orange, marron,
  noir, ivoire ; appareils au même endroit = une gaine (« P17 + P18 + I12 ») ; câble 3G pour l'extérieur ; liste des
  fils de la boîte. EVRARD (test moteur) : 1 276 → 1 228 m de fil.
- À demander à Kévin : 3e paire de couleurs phase/neutre ; « Ouverture vers le haut » (sens exact) ; n° de circuit
  du tableau à afficher à côté de l'alimentation.
- Tests : 30 + 37 + 97 = 164.

## Version 35 (26/10/2026) — livrée : boîtes à la main, échelle 1/50, nouvelle bande
- Remarques de Kévin après essai sur le chantier PASQUIER BLIN : plan scanné (murs non reconnus : le PDF n'a qu'une
  image) → message clair + échelle 1/50 saisissable ; fenêtre de réglage qui restait affichée (corrigé) ; boîtes
  impossibles à supprimer (corrigé) ; rattacher une gaine à une autre boîte en tirant son extrémité ; nombre de boîtes
  imposé ; liaisons droites et gaines en arc ; nouvelle bande d'après son exemple, avec calque par circuit ; noms
  LI01 / LI01.04.
- EVRARD est un A3 réduit en A4 : 1/50 saisi donne une échelle fausse de 41 % → l'alerte des cotes le signale.
- Exemples rangés dans docs/exemples (bande FTZ, bande préférée, plan d'expédition, fichier SPV + format supposé).
- Tests : 30 + 37 + 103 = 170.

## Version 36 (26/10/2026) — livrée : relevé IA sans clé (réponse donnée à la main)
- Kévin ne peut pas utiliser de clé IA en ligne (NVIDIA refusé par le navigateur) : « tu joueras le rôle de l'API ».
  Claude relève lui-même le plan (page 1 du PDF scanné PASQUIER) au format du relevé IA ; le logiciel sait le lire.
- Fenêtre « Relevé par l'IA » sans clé : bouton « Coller une réponse » (texte ou fichier .json) ; commande Ctrl+K
  « Relevé IA : coller une réponse ». Coordonnées en pixels d'une image de TOUTE la page : champ `"ref":{"W","H"}`
  (indépendant du rognage de l'image envoyée à l'IA) → `fromPaste` (ai-releve.js). Même aperçu orange, mêmes cases,
  un seul Ctrl+Z. L'échelle doit être réglée (1/50 si la feuille est au format d'origine).
- Exemple : docs/exemples/PASQUIER_releve_ia.json = 32 murs, 16 ouvertures, 8 pièces, 77 appareils, 20 liaisons (12 va-et-vient, interrupteur des appliques AP2/AP3 ajouté).
  Contrôle : surfaces habitables du logiciel (49,8 / 13,6 / 11,3 / 11,0 / 9,2 / 6,1 / 3,3 / 1,2 m²) à 1-2 % de celles
  écrites sur le plan (50,02 / 15,01 SA / 11,40 / 11,01 / 9,33 / 6,29 / 3,39 / 1,21), sauf le garage (SA ≠ surface habitable).
- Limites du relevé : commandes de volets roulants non relevées (moteurs en SC), « 16Asp » relevée en 16 A, liaisons
  du cellier / de la pièce de vie à vérifier, portes sans arc (dégagement) relevées comme ouvertures.
- Tests : 30 + 37 + 104 = 171.
- 2e relevé refait de zéro (autre moteur, sans les remarques de Kévin) : docs/exemples/PASQUIER_releve_ia_v2.json =
  32 murs, 17 ouvertures, 81 appareils (12 VV, 10 SC dont chauffe-eau et PAC, sonnette), 21 liaisons.

## Version 66.1 (29/10/2026) — correction de la composition du tableau
Demande de Kévin : « go pour la correction », après audit du code v66 par ChatGPT.
- Conservation des accessoires lors de « Placer automatiquement » : identifiants, libellés et largeurs conservés,
  même rangée et ordre relatif entre accessoires. Les positions par rapport aux disjoncteurs sont à revoir : le modèle
  ne connaît pas leurs raccordements électriques. Alerte persistante et bouton de revue ; le tout reste annulable.
- R-144 : réserve calculée sur la capacité totale du coffret, et non sur les modules occupés. Journal de règles
  corrigé (H-045) et données régénérées ; statut `a_valider` inchangé, aucune certification normative ajoutée.
- Groupes dépassant 63 A selon la règle aval actuelle fractionnés ; au moins deux ID même si tous les circuits
  sont spécialisés. Si un circuit seul dépasse la gamme, alerte explicite demandant une étude.
- Suggestion dans la marque choisie ; `suggestModel` renvoie `null` si aucune solution. Proposition affichée aussi
  pour réserve insuffisante ou rangée trop large. Aucun coffret trop petit proposé par défaut.
- Message de résultat limité aux contrôles disponibles, sans annoncer une conformité globale.
- Tests : six régressions moteur et deux régressions navigateur (accessoire conservé, revue, Ctrl+Z ; suggestion et absence de solution).
- Validation : syntaxe de 88 fichiers ; 41 contrôles murs, 86 câblage, 176 chantiers, 14 MAILLARD réussis.
  Chromium sur GitHub : 167 contrôles réussis, 1 échec préexistant (chevauchement des étiquettes : 2 au plan
  d'ensemble et 1 au zoom, mêmes valeurs sur la v66). Les deux nouvelles régressions Tableau passent, dont Ctrl+Z.
  Un délai intermittent du test des fenêtres au premier passage n'est pas reproduit au second.
  Build Vite réussi en local et sur GitHub. Aucun nouvel échec identifié par comparaison avec la v66 inchangée.
  Résultats : https://github.com/kevincruveilher-png/okteo-ai/actions/runs/40832349461 ;
  référence v66 : https://github.com/kevincruveilher-png/okteo-ai/actions/runs/40832066397.
  Autorisation explicite de Kévin pour l'envoi GitHub et la publication après vérification.
- Limites conservées : appareillage générique, classification spécialisée simplifiée, règle amont non calculée,
  IRVE/parafoudre/chauffage détaillés hors périmètre. Le recalcul explicite redispose les disjoncteurs ; pas de
  verrouillage individuel ajouté. Les changements de circuits restent synchronisés par leur numéro Cn.

## Version 66 (29/10/2026) — livrée : règles du tableau électrique (NF C 15-100:2024)
Version du logiciel : 0.66.0 (la 65, contour de la maison et obstacles, reste à faire). Demandé par Kévin (29/10, 00:08) :
« il va falloir faire une maj et implanter ces nouvelles règles » (recherche documentaire sur le tableau).
- **Journal des règles** : 61 règles R-101 à R-161 (référentiel 2024, GTL, hauteurs, communication, branchement,
  différentiels, protections, réserve, parafoudre, gestion d'énergie, étage et annexes) et 22 questions Q-89 à Q-110 ;
  toutes `a_valider`, `supposee` ou `inconnue` (la norme n'a pas été lue directement). R-050 annotée : le dimensionnement
  par la surface est remplacé. Journal : 117 règles, 110 questions (numéros de question à 3 chiffres acceptés).
- **Moteur du tableau** (`tableau.js`) :
  - nombre de différentiels d'après les circuits, plus d'après la surface : max(2, arrondi_sup(circuits / 8)) (R-102,
    R-119, R-122, R-127) ; éclairage et prises alternés sous 2 différentiels au moins (R-123) ;
  - calibre de chaque différentiel calculé (R-124 : 1 × chauffage / eau chaude / IRVE + 0,5 × le reste → 25, 40 ou 63 A) ;
  - un différentiel en tête de chaque rangée (R-148), spécialisés sous type A (R-120), réserve de 20 % (R-144) ;
  - nouvelles alertes de la page Tableau et du dossier PDF, avec le n° de règle : R-119, R-123, R-124, R-129, R-130, R-134,
    R-105 (tableau dans une salle d'eau, un placard, sous un escalier), R-116 (moins de 4 RJ45).
- Pas encore dans le moteur (à faire avec les réponses de Kévin) : hauteurs de la GTL et des manettes (R-103 à R-112),
  parafoudre (R-150 à R-153), IRVE (R-141, R-142), chauffage électrique et plancher (R-136, R-137), contacteur heures creuses
  et délesteur (R-154, R-155), tableau divisionnaire et annexes (R-157 à R-161).
- Tests : 80 vérifications du câblage (+3), 166 Playwright.

## Version 64.1 (28/10/2026) — livrée : consigne du relevé IA avec méthode imposée
Version du logiciel : 0.64.1. Suite au 2e relevé de MAILLARD par Opus (63 appareils sur 102, image de 1 654 px, 3 min).
- Consigne (avec et sans clé) : « Méthode (obligatoire) » en tête — image de toute la page à 200 dpi au moins (sans clé),
  légende lue d'abord, relevé par quarts en zoomant, décompte par type revérifié en fin de réponse (en tête des
  remarques) ; chaque symbole d'un boîtier double ou triple relevé séparément ; commande de chaque volet cherchée à côté
  de sa fenêtre ; indices des liaisons à partir de 0 (c'était déjà ainsi, maintenant écrit).
- Collage d'une réponse : si l'image de l'IA fait moins de 3 000 px, alerte « relevé fait en basse définition, des
  appareils sont probablement oubliés ».
- À comparer par Kévin : Opus effort moyen et effort élevé avec cette consigne.
- Tests : 166 vérifications Playwright (+1).

## Version 64 (28/10/2026) — livrée : ergonomie du Mode BE
Version du logiciel : 0.64.0. Propositions de Claude (28/10, après la demande Mode BE / Mode IA de Kévin), dites « go ».
- **Une seule fenêtre de travail à la fois** (`src/ext/one-card.js`) : quand une fenêtre s'ouvre sur le plan (relevé des
  murs, pièces, appareils, relevé IA, relecture, comparaison des modes, rapport IA), les autres se ferment comme par leur
  ✕. Restent à part : l'alerte « Dessin non enregistré », le mode essai, la bulle « Pourquoi ? », l'assistant.
- **Un seul compteur « à vérifier »** en haut : contrôle du plan + doutes du câblage (rouge ✕ si un doute est bloquant).
  Un clic va au cas suivant : d'abord le contrôle, puis chaque doute (zoom sur sa boîte, circuits affichés ; sans boîte :
  onglet Étude). L'ancien bouton des doutes a disparu.
- **Onglets réunis** : à gauche, Chantiers · Plan · Étude · **Pieuvre** · Tableau · Paramètres. Pieuvre = trois
  sous-onglets en haut de la page (Boîtes, Bandes, Lignes directes) ; l'onglet rouvre le dernier utilisé.
- **Panneau Câblage allégé** : une fois les boîtes posées, les Boîtes passent en premier et la liste des circuits est
  repliée (titre, nombre, ✓ ou ⚠ ; un clic l'ouvre, le choix est gardé) ; les longs textes d'aide sont devenus des
  ⓘ (infobulle au survol). Croisements entre deux boîtes : affichés comme permis (✓), seuls ceux d'une même boîte alertent.
- Visite guidée : 27 étapes (onglet Pieuvre). Catalogue : « Onglet Pieuvre », « Une seule fenêtre de travail à la fois ».
- Tests : 165 vérifications Playwright (+3 ; navigation des tests par les sous-onglets).

## Version 62.1 (28/10/2026) — livrée : mode « Par zone »
Version du logiciel : 0.63.2. Demandé par Kévin (28/10, 08:46 : « le BE ne le fait pas, mais je veux l'avoir »).
- **Par zone** : une boîte par zone **nuit** (chambres, salles de bains, salle d'eau, dressing), **jour** (séjour, pièce
  de vie, cuisine, salle à manger, entrée, bureau) et **garage** (garage, cellier, buanderie, atelier, local technique),
  d'après le nom des pièces. WC, dégagements et noms inconnus prennent la zone de leurs voisines (pièce qui touche) ;
  plus de boîtes si la zone dépasse la capacité d'une boîte (parts égales) ; une zone de moins de 3 départs rejoint la
  plus proche ; la boîte reste dans une pièce de sa zone ; volets dans la boîte de leur zone ; appareils extérieurs avec
  la pièce la plus proche.
- MAILLARD : 7 boîtes (nuit 3, jour 3, garage 1), 1 346 m de fil.
- Comparer les modes : 4 colonnes ; « Départs par boîte » compte maintenant sans l'alimentation (R-001), comme partout.
- Note « belle pieuvre » : une gaine tracée à la main (points de passage) n'est plus comptée comme un croisement
  (comme à l'écran).
- Journal des règles : Q-88 (définition des zones) proposée à Kévin.
- Tests : 77 vérifications du câblage (+2).

## Version 62 (28/10/2026) — livrée : types d'implantation des boîtes revus, note « belle pieuvre », impression dans le sens de la vue
Version du logiciel : 0.63.1 (livrée après la 63). Demandé par Kévin (28/10, 08:38–08:46), décisions laissées à Claude.
- **Note « belle pieuvre »** sur 100, la même pour tous les modes (`src/cablage/qualite.js`) : aucun croisement de
  gaines dans une même boîte (obligatoire : sinon ✗ et 40 au plus) ; pas d'appareil d'une boîte au milieu de ceux d'une
  autre (« chez la voisine » ; la boîte des volets, qui fait le tour de la maison, n'a pas de territoire) ; cuivre et
  gaine comparés à la meilleure proposition ; boîtes en plus ; départs équilibrés ; gaines de plus de 12 m ; pièces par
  boîte. Affichée dans « Comparer les modes » (détail des points retirés en infobulle), l'étude et le mode IA.
- **Économique** (ancien « Proximité », même clé pour les chantiers enregistrés) : le moins de **cuivre** = longueur de
  chaque gaine × nombre de fils (rectification de Kévin) ; une boîte de plus vaut 25 m de fil (réglage « coutBoite »,
  Paramètres → Câblage → Boîtes) ; territoires séparés ; les boîtes de moins de 3 départs sont fondues dans leurs voisines
  quand c'est moins cher. MAILLARD : 6 boîtes (avant : 10, dont trois de 1 ou 2 départs), 1 195 m de fil contre 1 234 m
  en Équilibrée.
- **Équilibrée** (comme le BE) : inchangée (le moins de boîtes, parts égales) ; boîte des volets coupée en deux seulement
  si les volets sont aux deux bouts de la maison (plus de 14 m) et que ça fait gagner plus de 40 % de gaine. MAILLARD
  garde une seule boîte de volets, comme le BE.
- **Par pièce** : chaque volet dans la boîte de sa pièce, sans l'alerte « pas de règle ».
- **Journal des règles** : Q-86 (Q-77 revu : le moins de cuivre et la note « belle pieuvre ») et Q-87 (volets en Par
  pièce et en Équilibrée) proposées à Kévin ; R-094 annotée « supposé, à valider ». L'étude garde le rang Q-77 en
  attendant sa réponse et affiche la note à côté.
- **Impression dans le sens de la vue** : si la vue est tournée, la fenêtre Imprimer coche « Dans le sens de la vue » ;
  tout le plan tourne (murs, portes, pièces, appareils, boîtes avec leurs faces, gaines, cotes, fond), les textes restent
  droits. Le dossier PDF suit la vue aussi.
- Tests : 75 vérifications du câblage (+6), 14 sur MAILLARD (+1 : mode Économique), 162 Playwright (+1).

## Version 63 (28/10/2026) — livrée : Mode IA et coûts du chantier
Version du logiciel : 0.63.0. Demandé par Kévin (28/10, 15:46–16:40) : garder l'interface complète (Mode BE) et pouvoir
basculer sur une interface légère centrée sur l'IA, le moins de clics possible, avec alertes et résultat.
- **Bascule** : boutons « Mode BE / Mode IA » en haut à gauche (à côté du nom du logiciel) ou **Alt+M** ; même chantier,
  mêmes données ; le choix est gardé sur le PC (préférence `ui`).
- **Mode IA** = le plan + une colonne « parcours » à droite, sans barres d'outils, vues, onglets ni panneaux :
  1. Plan du pavillonneur (PDF, échelle déduite des cotes, sinon outil Échelle) ;
  2. Relevé IA : avec une clé, « Lancer le relevé » (estimation des jetons affichée avant) ; **sans clé, « Copier la
     consigne / coller la réponse »** (pour les essais avec Claude en conversation, comme demandé) ;
  3. Relecture : automatique avec une clé, sinon copier la relecture / coller la réponse ;
  4. Hors plan : « Poser (n) » d'après la liste habituelle (devis) ;
  5. Câbler : type d'implantation + « Câbler / Recâbler » (un seul Ctrl+Z) ;
  6. Alertes : une seule liste (contrôle, doutes du câblage, points introuvables pour l'IA), les plus graves en haut ;
     un clic zoome sur le cas, boutons « ✦ Relire » (par l'IA) ou « Mode BE » (corriger à la main) ;
  7. Résultat : boîtes, gaines, % de réussite de l'IA, **📁 Dossier PDF** complet, rapport IA.
  Retouche du dessin : bouton « Mode BE ».
- **Coûts du chantier** (en bas de la colonne, et Paramètres → « Coûts d'un chantier ») :
  - jetons de l'IA : nombres réels renvoyés par l'API à chaque appel avec clé (relevé **et** relectures), gardés dans le
    chantier ; les étapes faites par copier / coller sont comptées à part (jetons inconnus) ;
  - temps BE : compté quand le logiciel est utilisé (souris, clavier, molette ; arrêt après 2 min sans rien faire),
    séparé mode IA / mode BE, par jour, gardé dans la fiche du chantier ;
  - coûts en € si on saisit dans Paramètres le prix des jetons (entrée / sortie, € par million) et le coût horaire BE ;
    ces prix ne sont jamais écrits dans le code (ils changent).
- Visite guidée : 26 étapes (bascule de mode). Catalogue : « Mode IA » (Alt+M), « Coûts d'un chantier ».
- Tests : 161 vérifications Playwright (bascule, copier / coller sans clé, câbler, dossier, coûts, Paramètres).
- Note : lors de la publication de la 61.1, une commande interrompue par Kévin s'était quand même exécutée ; la relance
  avait doublé l'entrée du journal (corrigé avant l'envoi, rien de perdu).

## Version 61.1 (28/10/2026) — livrée : correctif de fluidité (boîtes sur le plan)
Version du logiciel : 0.61.1. Signalé par Kévin : énorme latence dès que les boîtes sont sur le plan.
- Cause : le choix des courbures des gaines (v59) traitait toutes les gaines du niveau ensemble et se refaisait à chaque
  zoom, à chaque lâcher de boîte et à chaque modification : 3 à 8 s par calcul sur MAILLARD (97 gaines).
- Courbures calculées boîte par boîte (seuls les croisements d'une même boîte sont interdits, règle de Kévin du 28/10),
  cache par boîte (déplacer une boîte ne recalcule qu'elle), pas de recalcul pendant le zoom à la molette (un dessin
  complet 0,26 s après) ; taille du plan mémorisée (`K.svSize`, ResizeObserver) au lieu de `getBoundingClientRect`
  pendant le dessin. Impression : même calcul boîte par boîte.
- MAILLARD : un cran de molette ≈ 8,5 s → 0,1 s ; lâcher une boîte 8,8 s → 0,25 s ; dessin 76 → 37 ms ; 0 croisement dans
  une même boîte (avant : 1). Reste : glisser une boîte ≈ 13 images/s (tout le plan est redessiné à chaque mouvement).

## Version 61 (28/10/2026) — livrée : relecture ciblée étendue et plus fine, rapport de l'analyse IA
Version du logiciel : 0.61.0.
- Toutes les erreurs détectées après un relevé IA sont relues par l'IA (`recheckPoints(ctx)`), dans cet ordre :
  liaisons (lumière sans commande, commande sans lumière, va-et-vient seul, deux interrupteurs), pièce nommée non
  fermée par les murs, type vague (SC, PC20 sans usage), appareil hors des pièces (sauf appareils normalement dehors),
  doublon (même type à moins de 15 cm), doutes écrits par l'IA au relevé (« remarques »), prise de cuisine sans hauteur
  écrite, ouverture recentrée par le logiciel, ouverture loin des murs, porte sans sens (8 au plus) ; 20 points au plus.
- Question propre à chaque erreur (quoi regarder, où, ce qui est plausible) ; repères O1… pour les ouvertures, X1… pour
  les ouvertures perdues ; rubriques de réponse selon les erreurs : liaisons, ajouts (tout type du relevé), types,
  deplacer, supprimer, hauteurs, ouvertures, portes, murs, introuvable.
- Corrections appliquées en un seul Ctrl+Z (API : `updateApps`, `placeOpening`, `addWalls` avec coupe en T, pièces
  recalculées avec leurs noms quand un mur est ajouté, `openingsInfo`). L'IA modifie directement (Kévin), tout est
  visible dans l'aperçu.
- Avec clé : Claude reçoit en plus une image agrandie (4 m) autour de chaque point (8 au plus), annoncée dans la consigne.
- Rapport de l'analyse IA (Kévin, 08:49) : gardé dans le chantier (`cab.releves[niveau]` : pièces, ouvertures perdues,
  remarques, points introuvables, rapport) ; pour chaque relecture, chaque point « corrigé », « modifié, toujours
  signalé », « introuvable » (avec la raison) ou « sans réponse », le détail (avant → après) et le % de réussite
  (corrigés / signalés), « sous réserve du contrôle BE » ; moteur, jetons, zooms. Carte après « Appliquer » et onglet
  Étude, section « Analyse IA du relevé » (« Copier le rapport »).
- Consigne du relevé : n° de la page du fond importé, « ignore les autres pages » (plan du BE en page 2), « ignore les
  annotations ajoutées à la main », doutes appareil par appareil. Marques du relevé pour la relecture : ouverture
  ajustée, porte dont le sens est lu, ouverture du relevé IA, prise sans hauteur écrite, ouvertures perdues gardées.
- Tests : 41 + 69 + 176 + 13 + 156 = 455.

## Version 60 (28/10/2026) — livrée : boîte pour le câbleur et le perceur
Version du logiciel : 0.60.0.
- Schéma de boîte sans fils superposés (schema.js `routeInside`) : un connecteur par raccordement tracé (retours,
  navettes, commandes), alignés au milieu de la boîte, largeur d'après le nombre de fils ; chaque fil a sa propre entrée
  sur le connecteur (par le dessus ou par le dessous) et ses propres couloirs : bande du haut, bande du bas, bandes
  latérales pour les faces B et D ; chaque segment est réservé, un autre fil ne peut pas reprendre la même ligne. Couloirs
  espacés de 9, resserrés seulement si la boîte est trop chargée. `overlaps(links)` pour les tests.
- Bornes en quinconce sur deux rangs (elles se chevauchaient dès 2 fils voisins) ; le trait d'un fil du 1er rang passe
  entre les bornes du 2e rang.
- Gaines dans leur ordre réel sur chaque face (points d'accroche), sur le schéma comme sur le plan.
- Vue des 4 tranches pour le perceur (`tranchesSVG`, `trancheOrder`) : chaque face vue de l'extérieur, un trou par point
  d'accroche (pointillés = libre), taille d'après le Ø de la gaine, n° de gaine (croissants de gauche à droite, R-077),
  appareil au bout, Ø, pièce, bouchon. Onglet Bandes (sous le schéma), page 2 de chaque bande détaillée (PDF, donc aussi
  dans le dossier du chantier), page téléphone (QR : le point d'accroche est ajouté à la bande compressée).
- MAILLARD et les 4 chantiers FTZ : 0 recouvrement de fils sur tous les schémas (proximité et équilibrée).
- Tests : 36 + 69 + 176 + 13 + 154 = 448.

## Version 59 (28/10/2026) — livrée : gaines sans croisement
Version du logiciel : 0.59.0.
- Points d'accroche (boites.js `portLayout`, utilisé par le plan, l'impression et le calcul des gaines, donc les mêmes
  n° R-077) : après le rangement par direction, deux gaines d'une même boîte qui se croisent échangent leur point, ou
  l'une passe sur un point libre (seulement sur une face tournée vers son appareil) ; les gaines épinglées à la main ne
  bougent pas. Calcul avec une boîte de référence de 0,6 m : le résultat ne dépend pas du zoom.
- Courbure des gaines (`src/cablage/trace.js` `chooseBows`) : chaque gaine en arc prend, parmi 9 courbures, celle qui croise
  le moins les autres gaines du niveau (toutes les boîtes, tracés faits à la main compris) ; un croisement dans une même
  boîte compte triple, un croisement avec l'alimentation (pointillés) très peu ; à égalité, l'arc habituel. 2 passes puis
  essai à deux gaines. Recalculé quand le plan change, au lâcher d'une boîte (pas pendant le glisser). Même calcul à
  l'impression (avec les points d'accroche imprimés).
- Panneau Câblage (Boîtes) : « ✓ Aucune gaine n'en croise une autre » ou « ⚠ n croisements (boîtes) » (`okteo.gaineCrossings()`).
- MAILLARD (Équilibrée, volets connectés) : 81 croisements avec l'arc unique → 31 (dont 22 avec l'alimentation), 9 entre
  gaines d'appareils, 1 dans une même boîte. Ceux qui restent viennent presque tous de la boîte des volets (LI07), qui
  dessert les 8 volets de toute la maison : ses gaines traversent forcément les zones des autres boîtes.
- Tests : 36 + 67 + 175 + 13 + 154 = 445.

## Version 57 (28/10/2026) — livrée : saisie complète du chantier (après la 58)
Version du logiciel : 0.58.1 (la 58 était déjà livrée en 0.58.0).
- Équipements hors plan (R-100) : section « Équipements hors plan » du panneau Câblage (et Ctrl+K) : four, plaque, hotte,
  lave-vaisselle, lave-linge, sèche-linge, îlot, VMC + commande, bouches (7), sèche-serviette, équipotentielles locale et
  principale, antenne, sonnette + bouton, G EXT. Quantité par ligne ; coché d'avance quand l'équipement est sur 80 % des
  chantiers du registre (localStorage `okteo.horsplan.v1`, 1er chantier : MAILLARD d'après les bandes du BE).
  « Poser les cochés » ajoute ce qui manque (déjà sur le plan = pas reposé) dans la pièce qui convient (cuisine / pièce de
  vie, buanderie / cellier / garage, salle de bain, entrée ; équipotentielle principale à côté du tableau ; VMC et antenne
  au centre de la maison ; bouches une par chambre / séjour), un seul Ctrl+Z. Marque violette « à vérifier avec le
  devis » (`a.hp`) sur le plan, note et bouton « Vérifié » dans Propriétés ; « Voir », « Retirer ». Liste du chantier
  gardée dans `cab.horsplan` et dans le registre (fréquences des chantiers suivants). Moteur pur `src/cablage/horsplan.js`.
- Relecture ciblée par l'IA : menu Relevé → « ✦ Relecture ciblée » (et Ctrl+K). Les points du contrôle (lumière sans
  commande, commande sans lumière, va-et-vient seul, deux interrupteurs sur une lumière) deviennent une consigne courte :
  repère, pièce, position en % de la page, repères proches. Sans clé : « Copier la relecture » → la coller dans la
  conversation du relevé → coller la réponse (liaisons, ajouts, introuvables) → aperçu → « Appliquer » (un Ctrl+Z).
  Avec clé : relectures automatiques après un relevé IA qui ajoute des appareils (Paramètres → Assistant et relevé IA :
  0 à 3, 2 par défaut) ; arrêt quand plus rien n'est à revoir ou qu'une relecture ne corrige rien ; 3 min au plus par
  appel ; bouton « Arrêter » ; compteur « Relecture 1/2 » et jetons consommés ; un Ctrl+Z par relecture. Un point dit
  introuvable est marqué sur l'appareil (`a.aiNo`, « Redemander » dans Propriétés) et n'est plus jamais redemandé ; un
  point déjà demandé ne l'est plus dans la session (« Tout redemander »). Pur : `src/walls/ai-recheck.js` ; interface
  `src/ext/ai-recheck-ui.js`. Sans clé, pas de boucle.
- Consigne du relevé enrichie : commandes des points extérieurs (à l'intérieur près de la porte ou de la baie, boîtier
  double, suivre le trait), `"pt": true` pour les prises de plan de travail (importé sur les PC16), portes avec le montant
  des gonds (`gx, gy`) et un point de l'arc (`vx, vy`) → gond gauche / droite et sens d'ouverture importés, type
  « garage ». Les types îlot, BPS, sonnette y étaient déjà (55.1).
- Porte de garage : nouveau type d'ouverture (`kind: "garage"`) : grande ouverture sans battant, tablier en pointillés,
  à l'écran et à l'impression ; Propriétés (Type) et menu flottant (porte → fenêtre → garage).
- API : `okteo.setAppFlags(id, {hp, aiNo, pt})`, `okteo.removeApps(ids)` ; `allApps()` rend `hp`, `aiNo` ; `chat()` rend
  `usage` (jetons). `okteoExt.recheck` (open, loop, fromText, apply, stop).
- Tests : 36 + 65 + 175 + 12 + 153 = 441.

## Version 58 (28/10/2026) — livrée : plan lisible (avant la 57, à la demande de Kévin)
Version du logiciel : 0.58.0.
- Taille des symboles d'après le dessin : 5 cm par mètre de la plus petite dimension médiane des pièces, entre 12 et
  26 cm, la même pour tous les appareils (`autoSymCm`, `K.symAuto`, case « Auto » du curseur Symboles ; bouger le
  curseur la règle à la main ; dessins anciens : gardent leur taille si elle avait été changée). Impression : symbole
  d'au moins 2,5 mm.
- Aucun chevauchement : `spreadSymbols` (place.js) écarte l'affichage des symboles trop proches (le long de leur mur
  pour un appareil mural), position réelle gardée, trait de rappel ; écran (`K.dispPos`, repères, halos, sélection)
  et impression (mêmes règles en mm).
- Boîtes plus petites : côté 2,2 symboles / 26 px mini à l'écran (points d'accroche plus petits), 3,6 u / 9 mm imprimé.
- Noms des pièces : glissés à la souris (`r.lx`, `r.ly`, suivent la pièce quand on la déplace ou la tourne, un Ctrl+Z),
  « Replacer le nom » dans Propriétés ; taille commune (`K.roomTxt`, Affichage → Noms, Propriétés de la pièce), écran
  et impression.
- Tourner la vue (Affichage → Tourner la vue : ±90°, 180°, angle libre, 0°) : le fond et le dessin tournent ensemble
  à l'écran, textes et symboles restent droits ; les coordonnées du dessin, les relevés et l'impression ne changent pas
  (`K.view.rot`, `W2V`/`V2W`, `viewTransform`, groupe `g.world`). L'impression reste dans le sens du plan d'origine.
- Tests : 31 + 63 + 175 + 12 + 149 = 430.

## Version 56 (28/10/2026) — livrée : câblage aligné sur le bureau d'études (MAILLARD)
Version du logiciel : 0.56.0. Règles du journal H-037 à H-041 (réponses de Kévin des 27 et 28/10).
- R-001 : 16 départs par boîte hors alimentation (réglage `departsMax` 16, anciens 12 et 18 remplacés : `CAB_V` 4).
- R-077 : numéros de gaine .01 = alimentation puis sens anti-horaire (chaque tranche lue de gauche à droite de l'extérieur).
- R-094 : mode Équilibrée = le moins de boîtes possible (parts égales en départs, une boîte de plus seulement si les faces
  ne tiennent pas) ; Proximité inchangé (moins de gaine).
- R-098 : prise de plan de travail = circuit cuisine 2,5 (avec la hotte en boîte) ; reconnue à 1,00–1,30 m en cuisine
  ou à moins de 3 m d'une plaque / hotte / four / lave-vaisselle ; Propriétés « Prise de plan de travail » (auto / oui /
  non, `a.pt`). Les autres prises de la cuisine restent en 1,5.
- R-073 : commande + prises au même endroit dans une gaine, sauf si elle passerait en ICTA 25 (alors coupée en deux) ;
  le plan suit ce découpage (`okteo.setGaineGroups`, appelé par `wiringNow`).
- Nouveaux types : îlot (ligne directe 1,5 GR+BF+V/J), bouton de sonnette BPS (1P 9/10), sonnette SON (en boîte, sur
  le circuit éclairage).
- R-096 : commande des volets filaire / connectée = choix du BE pour le chantier (`K.CAB.choix.commandeVolet`, panneau
  Câblage « Volets » et choix du chantier du journal) ; connectés = commandes non câblées ; non choisi = filaire +
  doute « à vérifier ». Moteurs de volet jamais « extérieurs » (plus de câble 5G1,5).
- Lignes directes : RJ45 étiquetées RJ1… ; total R-099 (ICTA 16, ICTA 20 vertes comprises, YSYT).
- Journal : « à voir avec Thibault » pour Q-85 (questions en attente d'un collègue nommé).
- Test de référence MAILLARD (`scripts/maillard.test.mjs`, outil `scripts/chantier-wiring.mjs`) : 6 boîtes comme le
  BE, boîte des volets identique, contenu des gaines et lignes directes communes identiques.
- Tests : 31 + 63 + 175 + 12 + 145 = 426.

## Version 55.2 (27/10/2026) — livrée : réponse IA recopiée à la main
- 1er essai de Kévin avec la nouvelle consigne : 25 murs, 22 ouvertures, 11 pièces, 100 appareils (8 volets + 8 CVR,
  interphone, chauffe-eau, PAC, moteur de garage), 30 liaisons toutes valides. La réponse est arrivée en texte (pas en
  fichier) avec des guillemets typographiques « “ ” » : JSON illisible tel quel.
- `parseAiJson` : si la lecture échoue et que le texte contient “ ” „ ″, ils sont remplacés par des guillemets droits.
- Ouvertures : une ouverture coupée par une jonction en T (positions estimées par l'IA) est recentrée sur son morceau de
  mur, ou rétrécie s'il est plus court (40 cm minimum) ; `stats.ouverturesAjustees`, signalé dans l'aperçu. Sur l'essai :
  22/22 ouvertures placées au lieu de 9/22.
- Tests : 31 + 58 + 175 + 143 = 407.

## Version 55.1 (27/10/2026) — livrée : consigne du relevé IA refaite
- Consigne commune au relevé avec clé et au relevé sans clé (`promptBody`, ai-plan.js) ; `pastePrompt()` = version à
  copier dans une conversation neuve avec le PDF joint (image de la page entière, champ « ref » obligatoire).
- 40 types au lieu de 12 : les appareils du journal (radiateur, sèche-serviette, four, LL, LV, SL, plaque, hotte,
  chauffe-eau, Aqua Air / PAC, volet + CVR, Velux, interphone / sonnette, TV, équipotentielles, prises extérieures,
  moteur de garage…) ; « le type le plus précis », SC en dernier recours (leçons du comparatif : commandes de volets
  comptées en SC, chauffe-eau / PAC / sonnette oubliés).
- Hauteur `h` lue quand elle est écrite (« H:1.20m » → 120) et gardée à l'import ; liaisons CVR → volet / Velux en plus
  de commande → lumière ; chaque VV relié à toutes ses lumières ; murs jamais coupés aux ouvertures, pièces fermées,
  pas de pièce inventée (défauts d'Opus, de Sonnet et de Luna dans le comparatif).
- Fenêtre « Coller une réponse » : bouton « 📋 Copier la consigne » (repli : consigne mise dans la zone de texte) ;
  commande Ctrl+K « Relevé IA : copier la consigne ». Types inconnus toujours ignorés à l'import.
- Tests : 30 + 58 + 175 + 143 = 406.

## Version 48 (27/10/2026) — livrée : impression complète du plan (boîtes, gaines, circuits), questions en attente
Livrée après la 54 (elle attendait que le dessin des boîtes et des gaines soit stable). Version du logiciel : 0.55.0.
- Impression (Ctrl+P) : les calques imprimés suivent la vue de l'écran (Bâti / Implantation / Câblage, menu Affichage) ;
  une case par calque dans la fenêtre (murs, portes et fenêtres, pièces, cotes, appareils, repères, liaisons, couleur
  des circuits, boîtes, gaines, fond) ; bouton « = écran » pour reprendre la vue.
- Boîtes sur le PDF : carré de taille fixe sur le papier (≈ 3 symboles, 11 mm mini), nom au-dessus, faces A–D, points
  d'accroche (pleins = gaine raccordée, couleur du circuit), n° de gaine à côté de chaque point (« 01 » = alimentation,
  sens horaire, les mêmes que les bandes), sur fond blanc, décalés d'un cran quand deux points voisins sont pris.
- Gaines : en arc comme à l'écran, ou par les points de passage tracés à la main (points marqués) ; couleur du circuit ;
  alimentation vers le tableau en pointillés gris. Symboles à la couleur de leur circuit (case « Couleur des circuits »).
  Liaisons droites, comme à l'écran depuis la v35. Légende : « Boîte de pieuvre × n » ; cartouche « CÂBLAGE (PIEUVRE) ».
- `exportGeometry()` : `boxes` [{id, n, x, y, N, deps [{face, slot, tab, ends [{key, x, y, route, color}]}]}] et
  `apps[].color / circuit` ; `buildPlanPdf` options `murs, ouvertures, pieces, appareils, boites, gaines, circuits,
  gaineNos` (n° tirés de `wiringNow`).
- Journal des règles : bouton « ⏳ En attente » = questions en suspens (Q-42, Q-44 : en attente d'un chantier ; Q-83,
  Q-84 : « à voir avec un collègue ») et règles qui en dépendent ; mention sur la fiche et dans la liste des questions.
- Vérifié sur le PDF produit (relu par pdf.js) : noms des boîtes, faces, tous les n° de gaine, traits à la couleur des
  circuits ; décocher Boîtes / Gaines les retire ; vue Bâti → ni appareils ni boîtes.
- Tests : 30 + 58 + 175 + 142 = 405.

## Version 54 (27/10/2026) — livrée : appareils du journal, volets roulants, lignes directes comme FTZ
- `src/cablage/appareils.js` (pur, partagé cœur + moteur) : 28 types (R-084) — radiateur, sèche-serviette, caisson et
  commande VMC, climatisation, Aqua Air (2 lignes), bouche motorisée, four, lave-linge, lave-vaisselle, sèche-linge,
  plaque, hotte (R-086), chauffe-eau, moteur de garage, interrupteur de coupure, prises extérieures (3G2,5, G EXT, 4G1,5),
  volet roulant, Velux, CVR, interphone, TV, antenne, équipotentielles principale et locale, gaine aiguillée (R-097).
  Chacun : repère, hauteur, raccordement (ligne directe, boîte, choix), fils ou câble, gaine, calibre, variantes.
- Barre d'outils : bouton « Autres ▾ » (menu par groupe). Propriétés : raccordement de l'appareil, variante (câble ou
  fils), hotte en boîte / ligne directe / à choisir, puissance d'un moteur de volet. Symboles à l'écran et à l'impression.
- Volets (R-079, R-087, R-094, R-096) : circuit dédié gris / bleu clair 1,5 mm² 10 A, coupé à 2 300 W (50 W par moteur) ;
  la CVR se relie à ses volets avec l'outil Liaison (volet filaire : deux fils de commande marron et noir de la ronde dans
  la gaine de la CVR et dans celle du moteur ; sans CVR = volet connecté) ; boîte à part ou mélangés selon le choix du
  chantier, sinon selon le mode (équilibrée : une boîte, proximité : le plus économique, par pièce : signalé).
- Équipotentielle locale : un fil V/J 2,5 sur la terre de la boîte, terre de l'alimentation en 2,5 (R-080, R-075).
- Lignes directes : une ligne par raccordement, étiquette = repère, fils ou câble et gaine du type ; courant faible en
  gaine verte Ø20, à part ; page « Lignes directes » comme la feuille FTZ (étiquette, longueur, gaine, fil, aboutissant,
  vérif, total par gaine). Les 28 lignes de DUCOURNEAU sortent avec la gaine et le fil de FTZ (test).
- Circuits : spécialisés aux calibres du type ; « Courant faible et lignes sans disjoncteur » (COM).
- Questions : Q-82 (gris des volets / R-021), Q-83 (couleur du fil pilote), Q-84 (calibres non relevés).
- Tests : 30 + 58 + 175 + 139.

## Version 53 (27/10/2026) — livrée : étude du câblage, doutes sur le plan, « Pourquoi ? », câbler avec précontrôle
- Onglet « Étude » (`src/ext/etude-ui.js`, moteur pur `src/cablage/etude.js`) : précontrôle (règles utiles au chantier
  et leur certitude ; une règle inconnue et bloquante, ou absente, empêche de câbler : « Je ne peux pas câbler : il manque
  N règles »), bande des 9 étapes avec leur état (✓ appliqué, ◐ supposé, ? doute, ✕ bloqué, ✎ corrigé à la main), modes de
  pieuvre comparés avec leur score (gaine, puis boîtes, puis départs : Q-77), « Où ça coince » trié par gravité avec la
  question à poser, « Voir » et « Proposer une modification de la règle » (l'assistant s'ouvre avec le cas), rapport de
  câblage PDF, statistiques par règle et par mode sur toutes les études du PC (export JSON).
- « ⚡ Câbler le chantier » (aussi pour l'assistant, commande `etude.cabler`) : précontrôle, circuits si besoin, boîtes
  (verrouillées et déplacées à la main gardées), circuits par boîte, étude enregistrée dans le chantier (`cab.etude`) :
  un seul Ctrl+Z.
- Doutes sur le plan : pastille ✕ (bloquant) / ? à côté de la boîte (`okteo.setDoubts`, couche fx), compteur « ✕ n doutes »
  en haut (clic = onglet Étude).
- « Pourquoi ? » : clic sur une boîte ou une gaine du plan → carte avec la chaîne de règles (boîte : R-001, mode, R-002,
  R-005, R-007, R-077… ; gaine : R-077, R-073, R-072, R-014/R-095, R-074, R-011 ; fil : couleur et n°).
- Journal : réponses Q-26, Q-77, Q-79 à Q-81, R-097 (gaine aiguillée en attente) ; R-074 : exceptions B + R + V/J 6 mm²
  → ICTA 20, 10 mm² → ICTA 25 ; R-092 : terres de sections différentes autorisées. 53 règles.
- Placement : une boîte restée vide pendant le regroupement est recentrée, jamais plus de boîtes que d'unités sur un
  niveau (le nombre de boîtes demandé est tenu) ; panneau Câblage : le nombre de boîtes tapé et les cases cochées ne sont
  plus effacés par un enregistrement automatique.
- Tests : 30 + 58 + 132 + 136.

## Version 52 (27/10/2026) — livrée : le câblage suit les règles confirmées du journal
- R-001 : 12 départs par boîte sans l'alimentation (un départ = une gaine, appareils au même endroit comptés une fois),
  6 gaines par face alimentation comprise ; anciens réglages à 18 remplacés (`CAB_V` 3). R-088 : face pleine → face
  voisine sans alerte ; plus de face libre = doute bloquant.
- R-074 : diamètre par la somme des sections (ICTA 16 ≤ 7,5 mm², ICTA 20 ≤ 13,5 mm², réglables `icta16`/`icta20`) ;
  au-delà : doute (pas de diamètre inventé). Alimentation divisée seulement au-delà de l'ICTA 20 ; un fil qu'aucun
  appareil de la boîte n'utilise n'est pas amené.
- R-077 : .01 = alimentation, puis strictement dans le sens horaire à partir de l'alimentation.
- R-072 : ronde orange, violet, noir, marron, ivoire : lumière en câble = marron imposé, puis va-et-vient (navettes,
  retour), télérupteurs, simples, par repère ; pas de répétition tant qu'une couleur est libre ; réutilisation seulement
  pour des allumages sans gaine commune, avec bague au n° de l'allumage (dessinée sur le schéma) ; sinon doute bloquant.
  L'ancienne « harmonisation par fréquence » est retirée.
- R-095 : BOUCHON sur les gaines à câble extérieur (schéma, bande, matériel, étiquette). Longueur totale de la boîte
  (somme des gaines) sur la page Bandes, la bande détaillée, l'étiquette et le panneau Câblage.
- Contrôles : R-089 (spécialisé en gaine partagée), R-091 (salle de bain sur le circuit cuisine), R-092 (sections
  mélangées sur un n°, terres à part : Q-80). `W.doutes` = [{rule, text, box, bloquant}].
- « À vérifier » : chaque gaine porte ses règles (`g.rules`), chaque boîte la liste (`box.rules`) ; les règles non
  confirmées sont écrites sur la page Bandes, la bande détaillée et l'étiquette.
- Tests sur 4 chantiers réels : `scripts/fixtures/chantiers-ftz.mjs` (contenu relevé sur les bandes FTZ, positions
  schématiques) + `scripts/chantiers.test.mjs` (132 contrôles : 4 chantiers × 3 modes de pieuvre × 11 règles).
  Questions nouvelles : Q-79 (plaque 6 mm² en ICTA 20 ?), Q-80 (terres de sections différentes sur la borne n° 1).
- Tests : 30 + 57 + 132 + 130.

## Version 51 (27/10/2026) — livrée : journal des règles de câblage dans Paramètres
- Le journal des règles tenu avec Kévin (`docs/journal-regles-cablage.md`, 52 règles, 78 questions, historique) devient
  des données du logiciel : `scripts/regles-import.mjs` (`npm run regles`) → `src/cablage/regles-data.js`. Moteur
  `src/cablage/regles.js` (journal vivant sur ce PC, `okteo.regles.v1` ; une nouvelle base remplace les règles jamais
  modifiées ici ; export / import JSON ; `autoriserModification()` = point unique du futur code ; `code_valide`).
- Paramètres → « Journal des règles » : choix du chantier (mode de pieuvre, Plug bloqué tant que R-009 est incomplète ;
  volets ; hotte et appareils à choix), écarts avec les réglages actuels (départs 18 / 12, diamètre par remplissage au
  lieu de la somme des sections), compteurs par catégorie (rouge si une règle bloquante est inconnue), filtres, tableau,
  fiche (paramètres, écarts, choix, certitude, source, dépend de / utilisée par, preuves, questions, historique),
  questions et historique complets. Chaque réglage du câblage renvoie vers sa règle (R-001…).
- Modification par l'assistant seulement : action `rule` (modifier, ajouter, archiver, restaurer) → carte avant / après,
  « Valider » = version + 1 et entrée d'historique, « Refuser » ; proposition invalide ou périmée refusée.
- Journal corrigé (H-029) : R-075 garde les couleurs, la numérotation suit R-031. Plans et bandes des 4 chantiers de
  test dans `docs/chantiers/`. Visite : une étape Paramètres. Tests : 30 + 52 + 130.

## Version 50 (27/10/2026) — livrée : étiquettes de boîte, dossier PDF du chantier, logo KiTéOHM
- Deux documents (demande de Kévin) : l'**étiquette** imprimée et collée sur la boîte, et la **bande détaillée** qui va
  dans le dossier PDF (pas imprimée).
- Étiquette : 148,5 × 105 mm, 4 par A4 paysage avec traits de coupe. Schéma en grand (textes ×1,28), nom de la boîte en
  très gros, flèche du tableau, pavillonneur, chantier, n° d'affaire, couvercle (gardé), Nom BE, cadre d'initiales du
  câbleur ; sous le schéma le logo KiTéOHM et le code barre, à droite le QR code (bande sur le téléphone). Retirés de
  l'étiquette : ordre de câblage, matériel, fils, modèle de boîte, paragraphe d'explication.
- Dossier PDF du chantier (onglet Bandes « Dossier du chantier », ou fenêtre d'impression) : page de garde (logo,
  chantier, pavillonneur, n° d'affaire, date, sommaire avec pages), plan de tous les niveaux et nomenclature, tableau
  électrique (coffret, différentiels, disjoncteurs, appareillage modulaire, liste des circuits, alertes), bandes
  détaillées de toutes les boîtes. Assemblé avec pdf-lib 1.17.1.
- Logo KiTéOHM (fourni par Kévin, rogné : public/assets/kiteohm-logo.png / .jpg) : étiquettes, page de garde, cartouche
  du plan, page du tableau, aperçu de l'étiquette dans l'onglet Bandes.
- Tests : 30 + 52 + 125.

## Version 49 (27/10/2026) — livrée : bande sur le téléphone (QR code), tableau complet
- QR code de la bande de câblage : un par boîte, sur la feuille imprimée (en bas à droite, « Bande sur le téléphone »)
  et dans l'onglet Bandes. Scanné avec l'appareil photo, il ouvre la page `bande.html` de la version en ligne : en-tête
  (pavillonneur, chantier, n° d'affaire, flèche du tableau), faces et pièces, schéma (agrandissable), ordre de câblage,
  raccordements à cocher (gardés sur le téléphone), contrôle final. Les données sont dans le QR (JSON réduit, deflate,
  base64url ; ≈ 1 à 2 Ko) : pas de serveur, rien d'envoyé. Trop gros : libellés abrégés, sinon message. Le QR correspond
  à la bande au moment de l'impression (réimprimer si le plan change). Code barre gardé pour l'appli de scan.
- Tableau : coffrets Legrand Drivia (13 et 18 modules, 1 à 4 rangées, réf. 401211…401224) en plus des Resi9 ; nom de la
  marque en tête du coffret et à côté du choix (dans les couleurs de la marque — pas les logos officiels, à fournir par
  KiTéOHM si souhaité) ; appareillage modulaire (prise 2P+T, parafoudre type 2 et son disjoncteur, télérupteur,
  contacteur heures creuses, minuterie, horloge, délesteur, transformateur de sonnette), placé sur la rangée la plus
  libre, déplaçable, ✕ pour retirer ; « ＋ Télérupteurs du plan » ajoute T1, T2… d'après les allumages à télérupteur.
- Un clic (sans glisser) sur le tableau du plan ouvre l'onglet Tableau ; le glisser le déplace toujours.
- Tests : 30 + 52 + 124.

## Versions 46 et 47 (27/10/2026) — livrées : onglet Tableau, feuille de boîte
- v46 — onglet « Tableau » (à gauche) : coffret Schneider Resi9 au choix (1 à 4 rangées de 13 ou 18 modules ;
  4 × 13 = R9H13404 par défaut), dessiné module par module. Placement automatique (NF C 15-100 simplifiée) : ID 40 A
  30 mA type A pour les circuits spécialisés, ID type AC selon la surface (1 jusqu'à 35 m², 2 jusqu'à 100 m², 3 au-delà),
  8 circuits au plus par ID, une rangée par ID ; les RJ45 n'ont pas de disjoncteur. Disjoncteurs et différentiels se
  glissent d'une place à l'autre (un Ctrl+Z) ; « ＋ Différentiel » ; circuits pas encore au tableau proposés ; coffret
  plus grand proposé si besoin. Alertes : circuit sans différentiel, spécialisé hors type A, plus de 8 circuits par ID,
  rangée trop pleine, réserve de 20 %. La manette d'un disjoncteur (ou d'un différentiel) coupe ses circuits pour le
  mode essai ; bouton « Essai sur le plan », et bouton « Tableau » dans l'encart Essai. Enregistré dans le chantier
  (`cab.tableau`) dès la première modification. Hypothèses à valider avec Kévin : pas de télérupteurs ni de
  parafoudre dans le coffret, ID 40 A partout.
- v47 — feuille de boîte (photo annotée LI01) : en-tête pavillonneur / chantier (gauche), flèche vers le tableau avec
  « TABLEAU » (centre, direction réelle depuis la boîte), n° d'affaire, Nom BE (libellé), cadre d'émargement du câbleur
  (droite) ; faces et pièces écrites à l'extérieur, aux quatre bords (pièce = celle des appareils des gaines de la face ;
  « Tableau » pour une face qui n'a que l'alimentation) ; gaines en « LI01.10 / P14 / 4,8 m · Ø16 », textes plus gros,
  plus de Ph / N / PE ; cadre « Ordre de câblage » (borne, couleur, section, nombre de fils) ; raccordements numérotés
  terre, puis neutre et phase circuit par circuit (cuisine, prises, éclairage), puis retours et navettes ; modèle de
  boîte (pavillonnaire carrée) et couvercle haut / bas (choix dans l'onglet Bandes, simple mention) ; code barre Code 128
  « n° d'affaire-LI01 » (jsbarcode 3.11.6, chargé à la demande). La même étiquette apparaît dans l'onglet Bandes.
- Tests : 30 + 51 + 122.

## Version 45.1 (27/10/2026) — livrée : retours de Kévin sur les 43 à 45
- Quadrillage masqué par défaut (y compris sur les anciens dessins, une fois) et retiré de la vue Bâti ; il reste dans
  l'encart Vues pour qui le veut.
- Contrôle : nouvelle alerte « Deux interrupteurs sur la même lumière » (deux simples, ou un simple + un va-et-vient :
  il faut des va-et-vient) ; « Appareil dans aucune boîte » (des boîtes existent sur son niveau mais il n'est raccordé à
  aucune, lignes directes exceptées) ; lumières reliées en chaîne : seule une vraie commande commande, une chaîne de
  lumières sans commande est signalée en entier. « Tester tout » signale aussi l'interrupteur simple doublé.
- Lumière de l'essai ≈ 40 % moins forte et un peu moins large ; alertes plus rouges (anneau #e4472b plus épais,
  pulsation plus marquée), compteur rouge.
- Tests : 30 + 48 + 120.

## Versions 43, 44 et 45 (26/10/2026) — livrées ensemble : contrôle permanent, Pack depuis la pièce, mode essai
- v43 — contrôle permanent : bouton « ⚠ n à vérifier » dans le bandeau du haut (vert « ✓ Contrôle » quand tout va bien),
  recalculé à chaque dessin sur tous les niveaux : commande sans lumière, lumière sans commande, va-et-vient seul,
  appareil sans circuit (une fois les circuits répartis), commande et lumière dans deux boîtes. Un clic va au cas suivant
  (change de niveau, sélectionne, zoome, explique dans le bandeau d'aide) ; liste cliquable en tête du panneau Câblage ;
  halo orange animé (pulsation) autour des appareils concernés, réglage « Halo orange » dans Paramètres → Affichage.
- v44 — pièce sélectionnée : bouton « ▦ Pack ▾ » dans son bandeau (ou Maj+P : P seul reste l'outil Prise), menu des
  packs numérotés (chiffre ou clic), pack reconnu d'après le nom mis en avant ; options « Avec sa boîte (pieuvre type) »
  et « Aussi Chambre 2, Chambre 3… » (pièces du même nom, seulement si le nom désigne un pack). Une pièce au nom non
  reconnu (« Pièce 3 ») prend le nom du pack (« Chambre 3 »). Rien n'est automatique ; un seul Ctrl+Z.
- v45 — mode essai (bouton « Essai », ancien « Test ») : un clic sur un interrupteur allume ses lumières, un 2e clic
  les éteint ; va-et-vient en inversion (chacun inverse) ; poussoir = télérupteur ; un clic sur une lumière actionne sa
  commande. Lumière animée : fondu à l'allumage et à l'extinction, halo chaud qui éclaire autour de la lampe, légère
  variation d'intensité (désactivé si le système demande moins d'animations). Encart Essai en haut à gauche du plan :
  nombre de lumières allumées, « Tout éteindre », « Tester tout » (chaque commande seule : n'allume rien, lumière qui
  reste éteinte, lumière d'un autre circuit, va-et-vient seul ; lignes cliquables), « Disjoncteurs » (un par circuit :
  couper éteint ses lumières). Échap ou ✕ pour sortir. Écart à la feuille de route : les disjoncteurs sont dans l'encart
  Essai (plus près du plan) au lieu du panneau Câblage ; ils iront dans l'onglet Tableau (v46).
- Effets animés : couche `#fx` séparée du plan, gardée d'un dessin à l'autre (les animations ne repartent pas à chaque
  mouvement).
- Tests : 30 + 48 + 119 = 197.

## Versions 41 et 42 (26/10/2026) — livrées ensemble : écran en encarts, assistant en bas à droite, Paramètres rangés
- v41 — bandeau du haut en trois encarts titrés : **Actions** (barres Implantation bâti / appareils), **Vues** (Bâti,
  Implantation, Câblage + un bouton par calque), **Panneaux** (Propriétés, Câblage, Packs, Étapes). Un clic ouvre le
  panneau à droite, un 2e clic sur le même bouton (ou la croix ✕ de son en-tête) le ferme : le plan prend toute la
  largeur. Panneau plus étroit par défaut (280 px, toujours élargissable en tirant son bord).
- v41 — l'assistant quitte le panneau : encart réduit en bas à droite du plan (« ✦ Assistant A »), agrandi au clic
  (400 × 560 px), réduit par « — » ou Échap ; touche A pour l'ouvrir ; état gardé sur ce PC. Plus de bouton
  « Assistant » dans la barre du haut. Les boutons de zoom se décalent quand il est ouvert.
- v41 — correctif du bandeau près de l'objet (restait affiché après un clic dans le vide ou sur sa croix : la règle CSS
  `.hud{display:flex}` écrasait `hidden`).
- v42 — Paramètres : sommaire à gauche, une section par thème (Affichage, Assistant et relevé IA, Câblage, Packs) ;
  Câblage en 5 groupes avec une aide chacun (Circuits, Couleurs des fils, Boîtes, Gaines et câbles, Longueurs des
  gaines) ; champ « Chercher un réglage » (ex. « couleur » ne garde que les couleurs des fils) ; bouton qui ouvre le
  panneau Packs.
- v42 — surfaces des pièces (m²) masquées partout par défaut : plan, Propriétés, relevé des pièces, panneau Packs,
  impression (étiquettes, nomenclature, bandeau). Réglage « Afficher la surface des pièces » dans Paramètres →
  Affichage (préférence de ce PC, `src/prefs.js`). La surface reste calculée (prises de la norme au séjour).
- Visite guidée : 21 étapes (encarts Actions et Panneaux, assistant en bas à droite).
- Tests : 30 + 48 + 116 = 194.

## Version 40 (26/10/2026) — livrée : packs et pieuvres types
- Onglet « Packs » (panneau de droite) : chaque pièce du niveau, son pack reconnu d'après son nom (modifiable), ce qui
  manque ; « Compléter », « Équiper toutes les pièces », « Pieuvre type » (pack + boîte verrouillée au centre de la pièce
  + circuits), un seul Ctrl+Z chacun ; « Modifier les packs… » (communs à tous les chantiers, sur ce PC).
- Packs de base : chambre 3 prises + point lumineux + interrupteur + RJ45 ; séjour prises selon la norme (1 par 4 m²,
  5 min, 7 au-delà de 28 m²) + 2 RJ45 ; cuisine 6 prises + 3 spécialisées ; salle de bain/d'eau prise + point + applique ;
  WC ; dégagement ; bureau ; garage ; cellier. Choix pris sans réponse de Kévin : packs communs (pas encore par
  pavillonneur), pose automatique puis ajustement à la main.
- Essai PASQUIER (murs et pièces seuls) : 47 appareils posés dans 8 pièces, interrupteurs à côté des portes.
- Tests : 30 + 48 + 112 = 190.

## Version 39 (26/10/2026) — livrée : trois modes de pieuvre et leur comparatif
- Proximité (le moins de cuivre, une pièce peut être partagée), Équilibrée (boîtes régulières, départs à peu près égaux,
  « qui plaisent à l'œil », comme le bureau d'études), Par pièce (une boîte par pièce, petites pièces rattachées à la
  voisine — réglage « gaines minimum », extérieur vers la pièce la plus proche, boîte posée dans sa pièce).
- Onglet Câblage → Boîtes : choix « Pieuvre » (mode du chantier, utilisé au prochain placement) + « Comparer les 3
  modes » : mini-plans, boîtes, circuits, fil, gaine, départs, régularité, pièces par boîte, alertes ; « Appliquer »
  (boîtes + circuits, un seul Ctrl+Z ; les boîtes verrouillées restent).
- Essai PASQUIER (relevé v2) : proximité 5 boîtes / 1 309 m de fil ; équilibrée 5 boîtes / 1 368 m, départs 11 à 12 ;
  par pièce 9 boîtes / 1 592 m, 17 circuits.
- Suite : v40 packs et pieuvres types.
- Tests : 30 + 46 + 111 = 187.

## Version 38 (26/10/2026) — livrée : câblage selon les règles KiTéOHM
- Origine : la bande LI05 d'EVRARD relue avec Kévin (prises en 2,5 rouge/bleu au lieu de 1,5 gris/bleu foncé, retour
  orphelin sur I17 : allumage coupé entre deux boîtes). Règles complètes dans `docs/regles-cablage.md`.
- Fait : circuits par boîte (éclairage rouge/bleu, prises 1,5 gris/bleu foncé ≤ 8, cuisine 2,5 rouge/bleu ≤ 6, parts
  égales au-delà) ; une terre par boîte ; bagues (n° du circuit sans « C », T1…) sur l'alimentation, accolades sur le
  schéma ; ronde orange/violet/noir/marron/ivoire par boîte, même ordre partout (allumages les plus fréquents du chantier
  d'abord) ; gaines identiques comptées (×n) ; câbles du stock choisis selon les fils (3G, 4G, 5G… 1,5 / 2,5), âmes
  repérées, fil en trop isolé, réglage « le bleu peut servir » ; commandes au même endroit sur le même circuit ;
  allumage jamais coupé (déplacement d'une gaine, « ← Sélection »), alerte rouge sur le plan et « Ramener dans la même
  boîte ». Anciens réglages enregistrés (2,5 mm² pour les prises…) remplacés automatiquement.
- Prochaines : v39 trois modes de pieuvre (proximité / équilibrée / par pièce) + comparatif ; v40 packs et pieuvres
  types ; puis nouvel appareillage (interrupteur à voyant…) et SPV.
- Tests : 30 + 44 + 110 = 184.

## Version 37 (26/10/2026) — livrée : symboles, filtre de vue, boîtes avec points d'accroche
- Demandes de Kévin : symboles carrés, colorés eux-mêmes par leur circuit ; filtre rapide de la vue ; boîtes qui ne
  changent pas de taille au zoom ; points d'accroche par face (réglage) pour que les gaines ne se croisent pas ;
  appliques tournées contre leur mur ; spot avec éclat ; quadrillage plus fin ; deux barres d'outils.
- Ses choix : sans circuit = rouge (sauf lignes directes) ; 2 barres visibles en même temps ; gaines rangées
  automatiquement + déplaçables à la main ; boutons + 3 vues toutes prêtes.
- Fait : symboles carrés (prises, RJ45, commandes, BP, VMC, SC), lumières rondes, spot avec éclat, applique tournée
  dos à son mur (écran et PDF) ; couleur du circuit sur le symbole (vue Câblage), rouge si pas de circuit sauf RJ45,
  prises spécialisées et SC ; barres « Implantation bâti » (bord orange, avec l'outil Échelle) et « Implantation
  appareils » (bord bleu) ; filtre en haut à droite : vues Bâti / Implantation / Câblage (Alt+1/2/3) + 9 boutons
  (fond, murs, pièces, appareils, liaisons, boîtes, gaines, cotes, quadrillage) ; quadrillage 5 cm à 10 m selon le
  zoom, trait marqué tous les mètres ; boîte de taille fixe sur le plan (comme les symboles, jamais moins de 34 px)
  avec 6 points par face (réglage « départs par face »), gaines rangées dans l'ordre de leur direction, bout de gaine
  tiré sur un autre point = épinglé (le moteur de câblage et les numéros de gaine suivent).
- Choix technique : « ne change pas de taille au zoom » compris comme taille fixe SUR LE PLAN (avant : taille fixe à
  l'écran, donc la boîte rapetissait par rapport au plan en zoomant).
- Tests : 30 + 38 + 108 = 176.

## Comparatif des moteurs IA sur le plan PASQUIER (26/10/2026, même consigne, PDF seul, conversation neuve)
| Moteur | Durée | Pièces fermées | Ouvertures placées | Appareils | Liaisons justes | VV |
|---|---|---|---|---|---|---|
| Claude Haiku | 30 s | 7 dont 3 fausses (Ch1 26,8 m², terrasse fermée) | 10/11 | 37 | 0 | 0 |
| Claude Sonnet | 3 min | 8/8 (Ch1 12,5, SdE 8,0, Dgt 4,3) | 17/17 | 69 | ~11/17 | 6 |
| Claude Opus | 4 min | 3/8 (murs coupés aux portes) | 11/16 | 79 | 21/21 | 12 |
| OpenAI Luna | 2 min | 10 dont pièces inventées (Ch2 7,4, SdE 2,6, garage 18,9) | 10/15 | 50 | ~2/9 | 1 |
| OpenAI Sol | 5 min | 8/8 à 1-2 % (garage 14,8) | 15/16 | 77 | 21/21 | 12 |
| OpenAI Astra | 5 min | 8/8 à 1-2 % (garage 14,7) | 17/17 | 70 (aucune SC) | 21/21 | 12 |
| Référence (Claude, mesure au pixel) | — | 8/8 à 1-2 % | 17/17 | 81 | 21/21 | 12 |
- OpenAI Sol et Astra (géométrie quasi identique) : relevés complets et justes ; Astra ne met aucune sortie de câble, Sol compte les commandes VR en SC (pièces, appareils, liaisons) ; manquent sonnette, chauffe-eau et PAC.
- Opus lit aussi bien l'électricité mais coupe les murs aux portes ; Sonnet ferme les pièces mais rate des liaisons.
- Piste : recoller les murs coupés aux portes (ouverture tombée dans un trou entre deux bouts alignés) → le relevé d'Opus
  fermerait ses pièces.

## PROCHAINE MISE À JOUR : à décider avec Kévin
Les mises à jour 41 à 54 sont toutes livrées (48 en dernier, le 27/10/2026). Pistes : retours de Kévin sur les schémas (essai avec un câbleur débutant), SPV pour Counter, page « Reprendre le projet ».

## Limites connues
- Pas encore : pièces en L / détection automatique des pièces fermées, étages, scinder/fusionner un mur, accrochages milieu/intersection/perpendiculaire, sortie PDF imprimable.
- Chantiers stockés dans le navigateur du PC (pas encore de serveur partagé) : faire « Fichier » pour sauvegarder.
- Prototype navigateur : le serveur C#, les comptes et le multi-sites viendront ensuite.

## Feuille de route
1. **Détection automatique des murs par le logiciel (sans IA ni API)**, demandée par Kévin le 25/10/2026 :
   - PDF vectoriel (cas des plans pavillonneurs) : lire les tracés du PDF, repérer les paires de traits parallèles espacés de 7 à 30 cm (= un mur, épaisseur mesurée), recoller les morceaux, créer murs + sommets ; les interruptions dans un mur deviennent des ouvertures (porte/fenêtre à confirmer).
   - Plan scanné, dessin ou photo : repli par analyse d'image (seuillage, aplats sombres épais).
   - L'utilisateur valide et corrige ensuite ; premier essai sur le PDF EVRARD (Maisons CPR).
   Puis appareils attachés à leur mur, accrochages fins, scinder un mur.
2. Étages, pièces en L, import + mise à l'échelle d'un fond.
3. Câblage (étape 2) : calcul des boîtes (max gaines réglable, économie de cuivre, descentes + marge) et bandes de câblage ; règles métier demandées à Kévin.
4. Lecture du plan par IA (format d'import commun), puis export SPV pour Counter. L'assistant pourra ensuite poser des appareils lui-même (avec validation).

## À faire — prochaine mise à jour (notes du 26/10/2026, soir)

- **Bandeau d'aide près de l'objet** : corrigé (commit 614836a) ; vérifié avec la v41. ✓
- **Panneau de droite** : il est trop large. Propriétés, Câblage, Packs, Étapes passent dans le bandeau supérieur, groupe « Panneaux ».
- **Bandeau supérieur** : trois groupes séparés par un titre court : Vues (Bâti, Implantation bâtie, Implantation appareils, Câblage), Actions (outils de dessin et de modification), Panneaux.
- **Contenu des panneaux** : une zone étroite qui s'ouvre sous le bandeau, avec seulement l'onglet ouvert, et se ferme en recliquant l'onglet.
- **Assistant** : encart fermé en bas à droite, agrandi au clic, réduit par la croix ; il ne recouvre le dessin que lorsqu'il est agrandi.
- **Impression** (demandé par Kévin) :
  - ajouter les boîtes (faces A–D, numéros de gaine, couleurs des circuits) ;
  - ajouter les gaines avec leurs points intermédiaires ;
  - ajouter les liaisons en forme courbe, comme à l'écran ;
  - imprimer selon le filtre de vues actif (Bâti, Implantation, Câblage) ;
  - une case par calque dans la fenêtre d'impression ;
  - vérifier le rendu sur le PDF produit, comme pour l'échelle.
- **Règle de travail** : ne pas pousser avant la mise à jour ; committer seulement quand Kévin le demande.
- **Surfaces des pièces** (demandé par Kévin, 26/10 soir) : retirer les m² partout (libellé de pièce à l'écran et à l'impression, nomenclature de l'impression, liste du panneau Packs, liste de détection des pièces, total « m² habitables »). Ajouter un réglage « Afficher les surfaces des pièces » dans Paramètres, désactivé par défaut. La surface reste calculée (utile au nombre de prises de la norme pour le séjour).
- **Paramètres** (demandé par Kévin) : les regrouper. Proposition : Affichage (surfaces, calques par défaut), Relevé IA (clés et modèles), Câblage (circuits, gaines, boîtes, câbles), Packs (renvoi vers l'onglet Packs). Une section par thème, avec un titre et une courte aide, à valider avec Kévin avant de coder.
- **Moins de clics, contrôle et essai** (demandé par Kévin, 26/10 soir). Ordre prévu :
  1. Contrôle des appareils seuls : compteur « ⚠ n » dans le bandeau du haut (commandes sans lumière, lumières sans commande, va-et-vient incomplets, appareils sans circuit, allumages coupés), un clic zoome sur le cas suivant, halo orange sur le plan, liste dans l'onglet Câblage.
  2. Pack sur une pièce en peu de clics : bouton « Pack ▾ » dans le bandeau de la pièce (pièce, Pack, type = 3 clics), touche P puis un chiffre, option « Pieuvre type », option « même pack pour les pièces du même nom ». Jamais automatique ; un seul Ctrl+Z.
  3. Mode essai : clic sur un interrupteur = allume / éteint ses lampes (halo jaune) ; va-et-vient en inversion ; télérupteur par bouton-poussoir ; disjoncteur par circuit dans l'onglet Câblage ; bouton « Tester tout » qui liste les commandes sans effet ou sur un autre circuit. À confirmer : « éteindre la lampe » = deuxième clic sur l'interrupteur (ou clic direct sur la lampe aussi).
- **Retours de Kévin sur ces trois points** (26/10 soir) :
  - Point 1 (Pack en peu de clics) : validé tel que proposé.
  - Point 2 (appareils seuls) : le compteur « ⚠ n » est actif en permanence (contrôle continu, calcul léger à chaque dessin) ; halo orange animé (pulsation douce), pas fixe.
  - Point 3 (mode essai) : lumière animée et soignée, pas un simple jaune qui s'allume : fondu à l'allumage et à l'extinction, halo qui éclaire autour de la lampe, légère variation d'intensité en continu. Prévoir la réduction des animations si le système la demande.
  - Disjoncteurs : un **onglet « Tableau »** où l'on trace le tableau complet (disjoncteurs, circuits), disjoncteurs déplaçables sur les rangées ; modèle de tableau au choix (grand Schneider), avec taille et nombre de rangées. À faire juste après le mode essai ; le disjoncteur de chaque circuit commande alors l'essai.
  - Kévin n'a pas encore dit « go » : attendre sa confirmation et ses autres remarques avant de coder.

## À faire — feuille de boîte (notes du 26/10/2026, photo annotée de Kévin sur LI01)

Mise à jour prévue avant l'impression. Plan d'ensemble : 41 mise en page, 42 Paramètres et surfaces, 43 contrôle des appareils seuls, 44 Pack en peu de clics, 45 mode essai, 46 onglet Tableau, 47 feuille de boîte, 48 impression complète.

- **En-tête** : en haut à gauche Pavillonneur (= client du chantier) et Chantier ; en haut à droite N° d'affaire, « Nom BE » (libellé seul), puis cadre d'émargement du câbleur (initiales à la main : la feuille est une étiquette collée sur la boîte). Ancienne ligne de sous-titre supprimée (nom, n°, RDC, « au-dessus de », nombre de gaines et de raccordements).
- **Flèche** : grosse flèche vers le tableau, en haut au centre, mot « TABLEAU » dessous ; elle tourne selon la direction réelle du tableau depuis la boîte.
- **Faces** : lettre + pièce écrites à l'extérieur de la boîte, sur les quatre bords de la feuille. Pas de miroir : A haut, B droite, C bas, D gauche restent ainsi même couvercle vers le bas (le plan est collé sur le couvercle, la boîte est percée en conséquence). Pièce d'une face = pièce des appareils desservis par les gaines de la face (la plus fréquente ; égalité : pièce vers laquelle la face regarde ; face avec la seule alimentation : « Tableau »).
- **Ordre de câblage** (cadre à droite) : une ligne par couleur et section, avec la quantité de fils et le n° de raccordement (borne). Ordre : vert/jaune, bleu 2,5, rouge 2,5, bleu foncé 1,5, gris 1,5, bleu 1,5, rouge 1,5, puis va-et-vient / retours / navettes. Exemple : « Vert/jaune · 12 fils · borne 1 ».
- **Numérotation des raccordements** : suit cet ordre (terres, puis par circuit neutre puis phase : cuisine, prises, éclairage, puis retours et navettes), à la place de « tous les neutres puis toutes les phases ».
- **Code barre** (en bas à droite) : code 128 unique, fabriqué sans bibliothèque à partir de l'identifiant du chantier + nom de la boîte (stable à chaque réimpression) ; sa signification sera décidée plus tard.
- **Modèle de boîte** (en bas à gauche) : réglage de la boîte, « Boîte pavillonnaire carrée » (seul modèle connu, liste prévue pour d'autres) ; « Couvercle : haut / bas » = simple mention, sans effet sur le plan, les gaines ni le dessin.
- **Textes** : plus gros ; plus de lettres Ph / N / PE ; gaine écrite « LI01.10 · P14 · 4,8 m · Ø16 » (repère de l'appareil, pas son nom long ; gaines groupées : « P17 + P18 + I12 »).
- **Alimentation** : plus de « Ph C1 / N C1 » sur chaque fil ; accolade par paire sous les bornes avec son chiffre (bague 1, 2…), comme sur le croquis de Kévin.
