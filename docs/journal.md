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

## PROCHAINE MISE À JOUR (v26) — à choisir
Découpage d'app.js en modules (maintenance, VS Code) ; parcours « Premiers pas ». Puis le câblage (boîtes, bandes, SPV)
— règles à demander à Kévin. En attente : PDF d'autres pavillonneurs (dont un R+1).

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
