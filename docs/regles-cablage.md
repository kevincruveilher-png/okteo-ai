# Règles de câblage (pieuvre) — recueillies auprès de Kévin

Document de référence pour l'étape 2 (boîtes, bandes, SPV). Chaque règle devient un **réglage** du logiciel,
avec une valeur de base modifiable.

## Réponses de Kévin (25/10/2026)

1. **Boîtes — nombre de départs** : réglable ; **18 départs** par boîte par défaut.
2. **Longueurs (descentes, marges)** : réglables ; valeurs de base choisies par Claude (voir « Réglages proposés »).
3. **Boîtes et bandes** :
   - boîtes **carrées**, quatre faces **A, B, C, D** ; une gaine qui part **vers le haut du plan** sort par la **face A** ;
   - pour **chaque gaine**, la bande indique : **n° de gaine**, **longueur**, **nom de l'appareil**, **couleur et section
     de chaque fil**, **diamètre de gaine** ;
   - chaque fil porte un **n° de circuit de câblage** : tous les fils qui se raccordent ensemble dans la boîte portent le
     même n° (ex. tous les vert/jaune ensemble) ; le câblage de la boîte s'en déduit ;
   - les boîtes sont **placées automatiquement pour économiser au maximum le cuivre**, puis **déplaçables** à la main.
4. **SPV pour Counter** : plus tard.

## Réponses de Kévin (25/10/2026, suite)

1. **Emplacement** : boîtes dans les combles / faux plafond au-dessus des pièces, gaines qui descendent dans les murs
   jusqu'aux appareils ; en R+1, boîtes du RDC dans le plancher de l'étage.
2. **Départs** : **6 par face** au maximum, **18 au total** par boîte (réglables).
3. **Faces** : A = haut du plan, B = droite, C = bas, D = gauche (sens horaire).
4. **Tableau** : chaque boîte a son **alimentation** depuis le tableau ; les circuits spécialisés (four, plaque,
   lave-linge…) sont des **lignes directes** tableau → appareil, sans boîte.
5. **Circuits** : répartition automatique selon la NF C 15-100, modifiable (≤ 8 prises 16 A en 2,5 mm² ; ≤ 8 points
   lumineux en 1,5 mm² ; un circuit par prise spécialisée).
6. **Couleurs** : phase rouge, neutre bleu, terre vert/jaune, retour lampe orange, navettes violet et noir.
7. **Diamètre de gaine** : c'est une question de **place occupée** (addition des sections des fils) :
   5 fils de 1,5 mm² → Ø16 ; au-delà → Ø20 ; 4 fils de 1,5 + 1 fil de 2,5 → Ø20.
   → règle retenue : surface occupée par les fils (diamètre extérieur des conducteurs H07V-U) comparée à la surface
   intérieure de la gaine, avec un taux de remplissage maximum réglable, calé sur ces exemples (Ø16 accepte 5 × 1,5 mais
   pas 4 × 1,5 + 1 × 2,5).
8. **Tracé** : ligne droite dans les combles, légèrement arrondie → **+10 %** sur la partie horizontale.
9. **Hauteurs et marges** : réglables (hauteur sous plafond, traversée plancher/isolation, marges boîte / appareil,
   arrondi).
10. **Document de câblage** : la **boîte carrée dessinée avec ses quatre faces et ses gaines** ; pour chaque gaine :
    n°, longueur, appareil, fils (couleur, section, n° de circuit), diamètre ; les **retours lampe et les navettes sont
    tracés** dans la boîte (d'une gaine à l'autre).
11. **RJ45 / TV** : lignes directes (pas dans les boîtes).
12. **Pas de modèle à reproduire** : le document est conçu pour **un câbleur débutant** qui doit pouvoir câbler la
    boîte seul en le lisant.

## Découpage prévu (une mise à jour à la fois)

1. Réglages du câblage + circuits (répartition NF C 15-100, modifiable).
2. Placement automatique des boîtes (économie de cuivre), boîtes déplaçables, faces A–D, 6 / 18 départs.
3. Gaines : affectation boîte → appareil, longueurs (+10 %, descente, marges), fils (couleur, section, n° de circuit),
   diamètre par remplissage ; alimentations de boîte et lignes directes.
4. Schéma de boîte pour le câbleur : boîte carrée, gaines par face, fils numérotés, retours lampe et navettes tracés,
   bornes par n° de circuit, impression.
5. SPV pour Counter (plus tard).

## Schéma de boîte (v33) — précisions de Kévin (26/10/2026)

- Les gaines arrivent **déjà repérées** au câbleur : pas d'étiquettes à imprimer.
- Raccordements par **connecteurs rapides** (fil dénudé enfoncé) de **2, 3, 4, 5, 6, 8, 10 et 12 entrées** (réglage
  « Connecteurs rapides disponibles ») ; au-delà de 12 fils : deux connecteurs reliés par un pont.
- **Ordre de câblage** : terres, neutres circuit par circuit, phases, puis retours lampe et navettes ; les n° de
  raccordement suivent cet ordre.
- Le document est conçu pour un câbleur débutant : orientation de la boîte (pièce de chaque côté), matériel, étapes à
  cocher, contrôle final. À valider en le faisant utiliser par un débutant.
- **Alimentation d'une boîte** (26/10/2026) : **une seule gaine** depuis le tableau pour tous les circuits de la boîte —
  phase + neutre de chaque circuit et **fils de télérupteur** s'il y en a, **une seule terre** (à la plus grosse section) ;
  dès que la gaine passerait en **Ø25**, on la divise en deux gaines — **toujours une seule terre**, dans la 1re gaine.

## Couleurs, gaines partagées, extérieur (v34) — Kévin, 26/10/2026, après la boîte FTZ « LI03 »

- **Couleurs par circuit** : dans une boîte, 1er circuit d'une section = rouge/bleu, 2e = gris/bleu foncé (3e : à définir).
- **Retours et navettes** : orange, marron, noir, ivoire à tour de rôle (les 2 navettes d'un va-et-vient : même couleur).
- **Gaine partagée** : appareils **au même endroit** dans une seule gaine, sans limite de nombre.
- **Câble** : pour les appareils **à l'extérieur**.
- Les n° encadrés à côté de l'alimentation (5, 6, 7 sur FTZ) = n° de circuit au tableau ; « Ouverture vers le haut »
  sert à orienter la boîte. Liste des fils par couleur et section : reprise sur le schéma.
