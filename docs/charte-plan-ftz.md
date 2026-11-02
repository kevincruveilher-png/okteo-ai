# Charte du plan : identique aux plans FTZ du BE (décisions de Kévin, 02/11/2026)

Objectif : on ne doit pas voir la différence entre un plan FTZ du BE KiTéOHM et un plan sorti d'Oktéo (murs,
symboles, encarts, encadrés, couleurs, textes). Référence : `docs/plans/EVRARD_04949_plan.pdf` (= AF26074879
PLAN_EXPE_PIEUVRE1 : pages 1 et 2 sorties FTZ, 100 % vectorielles, textes dessinés en traits ; page 3 = plan du
constructeur). D'autres PLAN_EXPE FTZ seront fournis par Kévin.

## Décisions
1. **Format** : A3 paysage au 1/50, comme le BE (le PDF reçu est l'A3 réduit en A4 par l'impression PDF).
2. **Deux pages (recto / verso)**, même plan de base :
   - page 1 = les boîtes de pieuvre (LI01, LI02…) ;
   - page 2 = les lignes directes (et les équipements, comme la page 2 FTZ) + la **légende** dans un coin libre.
   - À l'impression, on choisit ce qui est affiché sur chaque page : boîte 1, 2, 3… et/ou lignes directes.
3. **Polices** : les plus proches des polices FTZ (inconnues, textes vectorisés).
4. **Légende** : automatique, seulement les symboles utilisés sur le plan, + la flèche « ligne vers le tableau »
   (alimentation de boîte, lignes directes).
5. **Zones de texte** : encadrées ou non, outil de mise en forme complet (couleur, gras, italique, taille…).
6. **Couleur par boîte**, ordre FTZ : LI01 rouge, LI02 vert, LI03 magenta, LI04 bleu, LI05 noir, LI06 orange,
   LI07 violet ; à partir de LI08 le cycle recommence.
7. **Noms de pièces abrégés** (SEJOUR, DEGT, DRESS, CH1, SDB…) : table de correspondance modifiable dans Paramètres.
8. **Cartouche** : Client = constructeur / entreprise (ex. MENUISERIE ISOLATION DU CENTRE (MIDC)), Chantier, N° =
   n° d'affaire (ex. AF26074879), Échelle, Dessinateur, Date → nouveaux champs de la fiche chantier.
9. **Écran et papier** : symboles et couleurs FTZ sur le plan à l'écran ET sur le PDF. Mais cartouche, légende,
   bandeaux et textes ajoutés se placent dans une **vue « Préparation d'impression »** : ils ne se superposent
   jamais au plan de travail (le calque de dessin reste propre).
10. Symboles : ceux vus sur les plans de référence d'abord ; les autres plus tard.

## Méthode
- Fondation : relevé automatique de la charte dans le PDF FTZ (couleurs, épaisseurs, dessin exact de chaque symbole,
  tailles des textes et encadrés) + comparateur dans les tests (planche FTZ / Oktéo côte à côte, écart mesuré).
- Puis une mise à jour à la fois, sur « go » : 1. préparation d'impression (feuille A3, cartouche, pages, légende,
  textes) ; 2. bâti ; 3. symboles du plan pieuvre, couleurs par boîte, repères, flèche ; 4. page 2 équipements.
