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

## PROCHAINE MISE À JOUR (v19) — à choisir
Pistes : relevé des appareils du PDF (symboles du plan pavillonneur) ; murs non grisés (cloisons en traits fins : WC/Dgt) ;
étages ; symboles et règles par pavillonneur ; accrochages fins, scinder/fusionner un mur ; parcours « Premiers pas » ;
assistant qui dessine à partir des cotes. Puis le câblage (étape 2 : boîtes, bandes, SPV) — demander les règles à Kévin.

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
