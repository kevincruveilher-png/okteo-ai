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
   LI07 violet ; à partir de LI08 le cycle recommence. **Ordre verrouillé** (Kévin, 02/11) même si les plans FTZ varient.
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

## Analyse des plans VILLANOVA et MAILLARD (02/11/2026)
- **VILLANOVA (AF25114192)** : export natif FTZ (« SchemBAT 15.08 », FTZ PDF Library), vectoriel avec de vraies polices
  PDF standard : **Courier-Bold** (repères, pièces), **Helvetica** (légende, cartouche), **Times-Roman**. Ce sont les polices
  de base de jsPDF : reproduction exacte possible. C'est la meilleure référence (préférer les exports FTZ directs aux PDF
  « PDFCreator » ou aux scans).
- Dossier FTZ type : 1. pieuvre (+ légende des symboles utilisés), 2. équipements / lignes directes (+ légende + matériel :
  gaines Ø80/Ø125 renforcées, support box CAE, passerelle connectée, cornet, connecteur RJ45 en image), 3. **plomberie**
  (sorties d'eau Ø, collecteur, eau froide bleue / chaude rouge, tableau des hauteurs de sorties d'eau dans le cartouche),
  4. tableau (face avant), 5. schéma unifilaire. MAILLARD (scan) : même dossier + documents du constructeur / cuisiniste.
- La légende est en haut à droite (VILLANOVA) ou en haut à gauche (MAILLARD) : coin libre. EVRARD n'en a pas.
- Encart image produit possible (« GIGA OCTO ! » sur VILLANOVA).
- **Couleurs des boîtes : l'ordre n'est pas le même d'un plan à l'autre** (EVRARD LI02 vert / LI03 magenta / LI04 bleu ;
  VILLANOVA LI02 magenta / LI03 bleu / LI04 vert) → décision : on verrouille l'ordre EVRARD (point 6).
- **Murs** : hachurés en diagonale (VILLANOVA, MAILLARD) ou gris plein + cloisons ondulées (EVRARD) : suit le plan du
  constructeur → style de bâti au choix par chantier.
- **Deux types de boîte** : boîte carrée (combles) et « boîte pavillonnaire pot de centre » (cercle vert autour du point
  lumineux, ex. LI04 sur L10 ; posée au plafond avec la documentation fournisseur « GIGA OCTO » en image). **Plus tard.**
- Zone hachurée en pointillés autour de la douche (volumes de la SDB) = « zone interdite ».
- Radiateurs électriques sur le plan électrique, radiateurs à eau sur le plan plomberie (décision de Kévin).

## Compléments (Kévin, 02/11/2026, soir)
- EVRARD a été « imprimé » en PDF par PDFCreator (imprimante virtuelle : textes transformés en traits, A3 réduit en A4) ;
  VILLANOVA a été exporté par FTZ lui-même. Cartouche et textes viennent de FTZ dans les deux cas.
- Images : documentation fournisseur (ex. pose des boîtes pot de centre), pas de la publicité.
- Murs : le style suit les conventions de dessin du plan du constructeur. Piste : un **type de mur** par mur (maçonnerie,
  cloison plâtre, doublage / cloison isolée) dessiné selon la convention, deviné au relevé d'après les aplats du PDF.
- Schémas unifilaires : à faire aussi.
- **Deux dossiers séparés** : le dossier du client (ses documents : plans constructeur, cuisiniste…) et le dossier du
  bureau d'études (pieuvre, équipements / lignes directes, plomberie, tableau, unifilaire). Pas d'annexes mélangées.

## Relevé de la charte (fondation v74, d'après VILLANOVA)
Outils : `scripts/charte/ftz-pdf.mjs` (lecture d'un PDF FTZ décompressé par qpdf), `scripts/charte/ftz-charte.mjs`
(→ `src/print/ftz-charte.json`), `src/print/ftz-draw.js` (dessin SVG), `scripts/charte/planche.mjs` (planche de contrôle),
test `scripts/charte.test.mjs` (dans `npm run check`). FTZ écrit chaque texte deux fois : texte invisible (police,
taille, position) + contours remplis (ce qu'on voit, couleur). Les plans de référence restent hors du dépôt.
- Feuille : zone imprimée 410 × 289 mm (A3 paysage moins les marges de l'imprimante), cadre et cartouche en bas.
- Repères (P1, L10, I2, PROF 50, LI04.01…) : Courier gras, hauteur 2,97 mm, largeur ×0,95, noir.
- Noms de pièces : Courier gras 6,52 mm, étroit (×0,66), bleu #0000FF.
- Boîtes (LI01…) : Times 3,52 mm, étroit (×0,59), vert #008000. Cotes de boîtes : Courier gras 2,97 mm ×0,66, violet #800080.
- Légende : Helvetica 2,2 mm (×0,82), noir ; tableau 2 colonnes, rangées séparées par des traits pleine largeur.
- Cartouche : libellés en Times (Client, Chantier, N° en noir ; Echelle, Dess., Date en bleu #0080FF), « www.kiteohm.fr »
  en Helvetica, avertissement rouge #FF0000 en Helvetica dans un cadre arrondi rouge, logo KiTéOHM bleu nuit #00004F
  et rouge #FF3737. Les valeurs du client sont en italique étroit (police visible à confirmer).
- Gaines : courbes de 0,12 mm à la couleur de la boîte. Symboles : 39 relevés (19 plan pieuvre, 20 plan équipements),
  avec leurs couleurs exactes (point lumineux et interrupteurs rouges, prises bleu #0080FF, RJ45/TV verts…).
- Plomberie (page 3) : tableau des hauteurs de sorties d'eau dans le cartouche, avertissement dans un cadre à gauche.
