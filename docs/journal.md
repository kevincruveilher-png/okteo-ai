## 06/11/2026 — MAJ norme n° 1 fusionnée dans `main`

- `npm run check` vert sur GitHub Actions (run 42223606044 : smoke 222/222, norme, chantiers 176, MAILLARD 14). Corrigé
  avant fusion : `okteo.normeVersion()` relit la fiche enregistrée (la page Chantiers en modifie une autre copie).
  Workflow temporaire retiré.

## 06/11/2026 — MAJ norme n° 1 : socle des règles de la NF C 15-100 (go de Kévin, 13:55)

Contexte : « Bible des règles Oktéo — NF C 15-100 (2024) » (document du projet claude.ai, 91 règles résumées avec nos
mots, codes PC-01… DOC-05, articles de la série 2024 vérifiés sur les normes le 06/11). Ordre décidé par Kévin : n° 1 socle,
n° 2 minimums par pièce + lecture du plan avant dessin, n° 3 volumes de salle d'eau, n° 4 plafonds par circuit, n° 5 tableau,
n° 6 fiche d'autocontrôle + documents à remettre. Les règles de la norme donnent des ALERTES SIMPLES, jamais bloquantes
(l'impression reste toujours possible). Licence : AUCUN texte de norme dans le dépôt (exemplaires sous licence, hors dépôt) ;
seulement nos résumés et les numéros d'article.

- `src/norme/nfc15100.js` (pur) : `REGLES` [{code, theme, niveau O|R|BE, art (2024), texte, R (règles du journal KiTéOHM
  sur le même sujet)}], `regle(code)`, `refOf(code, v)` (« PC-01 · NF C 15-100-10 § 10.1.6.3.2 », ou l'article de l'A5
  2015 par `art2015`), `versionFor(meta)` (série 2024 si le permis est déposé après le 31/08/2025, sinon 2002 + A5 ;
  sans date : 2024, `sure: false`), `THEMES`, `forJournal(R-xxx)`.
- Fiche du chantier : « Dépôt du permis » (`input[data-f=permis]`, `meta.permis`) + version affichée (`#ch-norme`),
  événement `okteo:norme` ; `okteo.normeVersion()`.
- Tests : `scripts/norme.test.mjs` (dans `npm run check`, et `npm run test:norme`), smoke (date du permis → version).

## 06/11/2026 — MAJ mémoire (pavillonneur / tous) et MAJ pose fusionnées dans `main`

- `npm run check` vert sur GitHub Actions : mémoire run 42207276115, pose run 42207333809. Workflow temporaire retiré.

## 06/11/2026 — MAJ « pose » : plus d'alerte battant de porte ni embrasure (go de Kévin, 12:01)

- check.js `POSE_OFF` (battant, embrasure) : ces deux contrôles de pose (3D-6, `src/3d/pose.js`) ne sont plus signalés,
  ni sur le plan (halo orange) ni en 3D (la 3D lit `okteo.control`). Les fonctions pures restent (v3d.test.mjs).
- Restent en orange : appareil hors de son mur, volumes de salle de bains, zones d'exclusion, hauteur de pose.
- Smoke : l'essai 3D-6 vérifie maintenant qu'aucune de ces deux alertes n'apparaît.
## 06/11/2026 — MAJ mémoire « par pavillonneur, ou pour tous » (go de Kévin, 11:55)

- Par défaut, une variante ne sert qu'aux plans de son pavillonneur (décision du 04/11, gardée). Case « Valable pour tous
  les pavillonneurs » (`#why-tous` dans « Pourquoi ça clignote ? », `[data-tous]` sur chaque variante de la bibliothèque) :
  la variante sert partout ; celle du pavillonneur reste prioritaire (`own` passe avant, ai-memory.js), la note et la
  consigne copiée disent « tous les pavillonneurs ».
- Défaut corrigé : une variante enregistrée sans pavillonneur n'était jamais réutilisée (clé « (sans pavillonneur) » à
  l'écriture, clé vide à la lecture : `keyOf`). Et le pavillonneur est maintenant demandé avant d'enregistrer
  (`#why-pav`), puis rangé dans la fiche du chantier (`api.setClient`, événement `okteo:chantier`).
- Serveur : colonne `tous` (ajoutée à la table existante), renvoyée par `/api/symbol-memory` ; symbol-memory.js `setTous`.
- Ajouté (go de Kévin, 12:01) : mémoire relue sur le serveur juste avant une réponse collée et avant l'analyse avec
  outils (`freshMemory`, 3 s au plus), et toutes les 5 minutes (`startMemoryTimer`) : un symbole appris sur un autre PC
  sert sans recharger. Hésitation entre deux types (« INT ou VV ? », souvent deux symboles qui se chevauchent) : la
  lecture apprise est la paire (`doubtKey` / `readKey`, ordre indifférent) ; consigne copiée et outil « legende » :
  comparer d'abord avec la mémoire en cas d'hésitation ou de chevauchement.
- Tests : ai-memory.test.mjs (7), web.test.mjs (`tous`), smoke (pavillonneur demandé, case « tous », priorité).

## 05/11/2026 — MAJ affichage fusionnée dans `main`

- `npm run check` vert sur GitHub Actions (run 42038694694). Corrigé avant fusion : « ressources hors ligne prêtes » ne
  passe plus le voyant en « Hors ligne » ; la barre des niveaux n'est jamais rognée. Workflow temporaire retiré.

## 05/11/2026 — MAJ pieuvres et MAJ mémoire fusionnées dans `main`

- `npm run check` vert sur GitHub Actions : pieuvres run 42035757271 (smoke 218/218), mémoire run 42035762828 (smoke 219/219,
  ai-memory 5, web). Essais rendus indépendants de la place des boîtes (gaine tirée loin de la boîte, cadenas dans l'écran,
  appareil 3D essayé jusqu'à 6 fois, circuits et bagues d'une boîte qui a plus de 8 prises). Workflow temporaire retiré.
## 05/11/2026 — MAJ « affichage » : bandeau 1 fixe sur une ligne, bandeau 2 selon la vue (go de Kévin, 13:54)

- Bandeau 1 (`.top`, du logo à « Fonctions ») : visible sur toutes les vues (accueil, Paramètres et Symboles compris),
  sur une ligne (`flex-wrap: nowrap`, nom du chantier et niveaux qui se réduisent) ; plus de jauge d'avancement (elle
  reste dans le panneau Étapes, `.sg-big`) ; « Imprimer » et « Fonctions » en icônes seules ; voyant `#web-dot`
  « Connecté » / « Hors ligne » / « Session expirée » à la place de la phrase du bandeau en ligne (détail en infobulle,
  clic = accueil) ; « À vérifier » gardé.
- Bandeau 2 (`.top2`) : seulement sur le plan et la 3D (`body[data-tab]`) ; `.app` en colonne flexible.
- Le glissement « classeur » des pages est gardé.

## 05/11/2026 — MAJ « mémoire des symboles » : un symbole appris n'est plus réappris (go de Kévin, 13:54)

- Constat : l'IA ne recevait la mémoire qu'en texte (mode 4 avec clé) et pas du tout dans la consigne copiée.
- Chaque fiche garde ce que l'IA avait lu : `lu` (type donné, ex. « XYZ » ou « LUM » avec doute) et `inscription`
  (why-blink « Enregistrer comme variante », Propriétés « Mémoriser ») ; Worker : colonnes `lu`, `inscription` (ajoutées
  à la table existante, `symbolTable` une fois par instance).
- `src/walls/ai-memory.js` (pur) : `memoryFixes` (appareil douteux lu de la même façon chez ce pavillonneur → type
  validé, `aiStatus: "lu"`, note « reconnu par la mémoire », `memoire: true`), `memoryPrompt` ; ai-releve.js
  `memoryStep` après chaque lecture (réponse collée, mode 4) → « N symbole(s) reconnu(s) par la mémoire » ; consigne
  copiée avec la liste (`pastePrompt({memory})`) ; outil « legende » : « lu comme » + jusqu'à 6 dessins en images
  (ai-agent.js : plusieurs images par résultat d'outil).
- La mémoire est rangée par pavillonneur : le champ « Pavillonneur » du chantier doit être rempli.
- Tests : `scripts/ai-memory.test.mjs` (5), web.test.mjs (`lu`, `inscription`), smoke (réponse collée reconnue).

## 05/11/2026 — MAJ « pieuvres » : une pièce entière par boîte, coupe par pans de mur, croisements évités (go de Kévin, 13:54)

- Demande de Kévin : des gaines se croisaient, une prise de chambre pouvait partir dans la boîte du séjour. Règles : une
  pièce entière dans une boîte (deux pièces voisines possibles) ; pièce trop chargée = deux boîtes, coupées par pan de mur ;
  couloir / dégagement / entrée avec la voisine la plus logique ; croisements évités aussi entre boîtes (gardés s'il n'y a
  pas le choix).
- boites.js (mode BE) : réunion de deux pièces qui ne se touchent pas seulement si la petite n'a aucune voisine qui puisse
  la prendre ; groupe trop chargé coupé par pièces entières de proche en proche (`splitGroup`), puis pièce seule par pans
  de mur (`wallRuns`, `wallParts` : centre = lumières et commandes, murs dans l'ordre du contour, un mur entier passe
  dans la boîte suivante) ; séjour trop chargé : un pan de mur vers la cuisine (et non des prises prises çà et là) ;
  `settleBoxes` : chaque boîte (et celle des volets) au point de ses pièces qui croise le moins les gaines des autres
  (droites boîte → endroit, 1 croisement = 4 m), jamais à moins d'1 m d'une autre boîte ; `boxCrossings`.
- Maison type de mode-be.test.mjs : 19 croisements entre boîtes → 8 (dont 7 de la boîte des volets, seule par règle) ;
  1 entre les boîtes des pièces. Tests : chaque pièce dans une seule boîte, coupe par pans de mur, `wallRuns`.
- Bibliothèque de symboles : cartes, dessins et étiquettes sur fond blanc, traits foncés (`#bibliotheque .sy-card…`).

## 05/11/2026 — Lots 2 à 6 fusionnés dans `main` (grosse mise à jour, go de Kévin)

- Une fusion par lot (2 symboles, 3 navigation, 4 implantation, 5 étapes, 6 relevé). `npm run check` vert sur la pile
  complète (GitHub Actions, run 42019579696 : smoke 218/218, web, MAILLARD 14/14, ai-align 12, échelle 17).
- Essais adaptés : plus d'onglet Chantiers (`okteo.setTab("chantiers")` ou `.top .brand`), 7 onglets, Packs hors du
  bandeau, 9 étapes, mode BE à l'écran (MAILLARD garde le mode demandé du moteur : `cabler(api, {mode})`), gaine et
  appareil 3D choisis loin des bords et des boîtes. Workflow temporaire `verification-lots.yml` retiré.

## 05/11/2026 — Lot 1 fusionné dans `main` (grosse mise à jour, go de Kévin)

- Valider toujours visible, « Pourquoi ça clignote » réparé, mode 4 seul, échelle (cm, échelle écrite, plausibilité,
  blocage du collage à 10 %), boîtes d'obstacles des étiquettes bornées. Détail : entrée « Grosse mise à jour » (lots 1 à 6).
- `npm run check` vert sur GitHub Actions (run 42016616834, smoke 214/214) ; workflow temporaire `verification-lots.yml` retiré.
## 05/11/2026 — Grosse mise à jour (lots 1 à 6, go de Kévin pour les 6 lots, 11:49)

Liste et ordre : `docs/feuille-de-route.md`, section « Grosse mise à jour du 05/11/2026 ». Un lot = une branche
`feat/lotN-…`, vérifiée sur GitHub Actions (workflow temporaire `verification-lots.yml`, retiré à la fusion), puis
fusionnée dans `main` (un commit de fusion par lot, annulable seul).

**Lot 1 — urgences**
- Carte de la réponse IA collée : `.wcard` bornée à la zone du plan (`max-height`, défilement interne, en-tête et
  boutons `.ai-act` collants) : « Ajouter la sélection » / « Annuler » toujours visibles (style.css, ai-releve.js).
- « Pourquoi ça clignote ? » : Modifier = appareil sélectionné, centré, Propriétés ouvertes ; Question au pavillonneur =
  question affichée et modifiable (`.why-qbox`), confirmation « Question ajoutée au rapport » + lien vers le rapport ;
  cartes `.whyb` / `.rapcard` au premier plan (z-index 40). Cause probable du « rien ne se passe » : les actions
  agissaient sans retour visible.
- Un seul mode d'analyse : `only4()` toujours vrai (ai-modes-ui.js) ; les 4 cartes seulement avec `modesIA = "dev"`
  (essais) ; « Refaire » relance le mode 4 ou le collage.
- Échelle : `src/walls/echelle.js` `writtenScale` (« Ech : 1:50 », « 1/100 »…) ; digits.js : cotes en cm entiers à
  4 chiffres (« 1840 », « 1 840 »), `cotValue`, `solveReadable` (police lisible : valeurs lues directement, rapport le
  plus fréquent) ; pdf-page.js `autoScale` : plausibilité 1/18 – 1/220 (`plausible`, `ratioOf`), écart > 10 % entre
  cotes et échelle écrite = rien n'est appliqué (`why`), échelle écrite en secours.
- Réponse collée : échelle de l'IA (`scaleCheck` des remarques) à plus de 10 % du fond → collage bloqué (`askScale`),
  boutons « Régler l'échelle d'après la réponse » (`#ai-scale-fix`), « Régler à la main », « Annuler ».
- Étiquettes : place.js `clipSeg`, `MAX_BOXES` (600), `wallBoxes` / `lineBoxes` rognées à la zone visible (render.js
  `CLIP`) ; `Placer` : boîte de plus de 1 024 cases rangée à part (`big`) : une échelle fausse ne fige plus le plan.
- Tests : `scripts/echelle.test.mjs` (17) + smoke (carte sur petit écran, blocage de l'échelle, échelle écrite,
  question au pavillonneur).

**Lot 2 — symboles**
- `api.planSymbolMarkup(type, h)` : le symbole tel que le plan le dessine (FTZ du BE si la charte est active, sinon
  Oktéo) ; la bibliothèque l'utilise (`okteo:ftz-ready` la redessine).
- Bibliothèque : « Variantes enregistrées » de chaque symbole (dessins rattachés, par pavillonneur, extrait, chantier,
  auteur, date, « Oublier »), nombre sur la carte (`.sy-nvar`).
- Mémoire des symboles COMMUNE (décision de Kévin) : Worker `/api/symbol-memory` (GET, POST sans doublon) et
  `/api/symbol-memory/delete` (auteur ou administrateur), table `symbol_memory` créée à la première utilisation
  (`symbolTable`, aussi `migrations/0002_symbol_memory.sql`) ; extrait ≤ 90 Ko, aucun plan entier. Client :
  symbol-memory.js `variantsOf`, `syncMemory` (au démarrage et à l'ouverture de la bibliothèque), fiches `pending`
  renvoyées. À terme : mémoire de l'entreprise (type SharePoint) par export / import.
- « Pourquoi ça clignote ? » : bloc `.why-fix` : « C'est un [type] » + Changer le type, « Enregistrer ce dessin comme
  variante du symbole choisi » (mémoire + type + décision `variante`), « Je ne sais pas → suivant » (décision
  `inconnu`, le point reste ouvert), « ‹ Précédent / Suivant › » (`navList`).
- Tests : web.test.mjs (mémoire commune) + smoke (actions, bibliothèque).

**Lot 3 — navigation**
- `src/ext/home-shell.js` : plus d'onglet Chantiers ; logo `.brand` = accueil ; en-tête `#home-head` (logo, chantier
  ouvert, bandeau de la version en ligne rangé dedans, « Ouvrir le plan › ») ; pastille `#web-warn` sur le plan pour
  un avertissement du bandeau (hors ligne, session expirée, secours, budget).
- Accueil, Paramètres, Bibliothèque = pages entières (`body.page-full` : sans `.top`, `.top2`, `.side`), arrivée par la
  droite (`.cl-in`), poignée « ‹‹ » à droite (`#cl-fold`) ou Échap = la page se range à gauche et le plan revient
  (`.cl-out`). Paramètres plus aérés en page entière. Visite guidée : étape 1 sur le logo.

**Lot 4 — implantation**
- Packs : plus de bouton dans le bandeau (`panel.register({hidden})`), éditeur dans Paramètres → Packs
  (`mountEditor`) ; bandeau de la pièce : « ⚡ Implantation rapide » (`okteo:pack-quick`, Maj+P) = pack reconnu d'après
  le nom posé tout de suite, liste des packs seulement si le nom n'en désigne aucun.
- Boîtes : `BOX_MODE = "be"` (cablage-data.js) pour le panneau Câblage, le Mode IA et l'Étude ; plus de choix de mode,
  de comparaison ni de nombre imposé à l'écran (le moteur garde les autres modes) ; bouton « ⚡ Implantation rapide des
  pieuvres » (`#bx-auto`). Pas de répartition automatique des boîtes après l'analyse IA.

**Lot 5 — étapes**
- tour.js : 9 étapes (import, échelle confirmée, vérification murs et pièces, vérification appareils = alertes traitées,
  implantation des boîtes, vérification des boîtes, câblage, vérification du tableau, impression) ; les vérifications
  se valident (« C'est vérifié », `cab.etapes[k] = {by, at}`, Ctrl+Z) ; jauge `#st-gauge` dans le bandeau (clic =
  panneau Étapes) et barre `.sg-big` en tête du panneau.

**Lot 6 — relevé**
- ai-align.js `mergeBands` : bandes collées du PDF (maçonnerie + doublage, écart ≤ 3 cm, recouvrement ≥ 50 %) réunies
  en un mur d'axe au milieu de l'épaisseur totale avant le recalage.
- ai-plan.js `aiToPlan` : murs croisés en X coupés au croisement (`stats.croisements`).
- Vue 3D : rien de modifié ; propositions dans la feuille de route.

## 05/11/2026 — Grosse mise à jour décidée (notes, pas de code)

- Liste complète de Kévin (11:16) rangée en 6 lots : `docs/feuille-de-route.md`, section « Grosse mise à jour du 05/11/2026 ».
- Décisions : un seul mode d'analyse IA (mode 4) ; boîtes en mode Bureau d'études seul ; pas de répartition automatique
  des boîtes par l'IA ; packs dans les paramètres avec « Implantation rapide » ; étapes de vérification en 9 étapes + jauge ;
  dessins de la bibliothèque = symboles dessinés par Oktéo sur le plan.
- **Mémoire des symboles collective** (serveur D1, puis mémoire de l'entreprise type SharePoint à la mise en ligne générale).
- Rien de codé : chaque lot attend le « go » de Kévin, en commençant par le lot 1.

## 05/11/2026 — Plan fluide : un dessin par image, fond gardé, plus de mesure forcée de l'écran

- Constat de Kévin (chantier COURIAUT, 119 appareils, fond du PDF) : plan très lent, la page plante au zoom.
- Mesure (sonde temporaire sur GitHub Actions, maison type 18 × 9 m, 120 appareils, 30 liaisons, fond 4 500 px, 165 points
  signalés) : un dessin = 38 ms sur la machine de test (bien plus sur un portable), dont 25 % pour `getBoundingClientRect`
  (mise en page forcée à chaque dessin) ; la molette dessinait tout le plan à CHAQUE cran, et le fond (image de plusieurs
  millions de pixels) était recréé à chaque dessin (nouveau décodage à chaque cran : mémoire qui explose, page qui plante).
- `render.js` : `drawSoon()` (un seul dessin à l'image suivante, `requestAnimationFrame`, `K.rafDraw`) ; `draw()` annule un
  dessin en attente ; fond = même élément `<image>` remis à sa place (`K.bgEl`, emplacement `g.bgslot`).
- `interact.js` : molette et `pointermove` (glisser, déplacer, tracer) passent par `drawSoon()`.
- `view.js` : `syncVB(measure)` : pendant le dessin, taille mémorisée par le ResizeObserver (`watchSize`), sans mesure.
- Résultat de la sonde : dessin 38 → 16 ms (vue entière), 48 → 17 ms (zoom ×12) ; fond décodé une seule fois.
- Test smoke : 40 crans de molette → moins de 40 dessins ; le fond reste le même élément d'un dessin à l'autre.
- Fusion dans `main` le 05/11/2026 (go de Kévin) : `npm run check` vert sur GitHub Actions (run 42002250587, smoke 210/210).

## 05/11/2026 — Interrupteurs et va-et-vient collés au mur, trait perpendiculaire vers la pièce

- Demande de Kévin (capture à l'appui) : le rond de l'interrupteur collé contre la paroi, le trait du symbole
  perpendiculaire au mur, tourné vers l'intérieur de la pièce ; pareil pour les va-et-vient.
- `src/place.js` (commun écran + papier) : `WALL_SWITCH` (INT, VV), `SWITCH_R` (0,55 unité de symbole),
  `switchParts(t)` (rond centré, axe +x = vers la pièce : un trait avec crochet ; va-et-vient : deux traits en V à ±22°),
  `glueToWall(p, w, R)` (centre du rond posé exactement contre la face du mur côté pièce, même s'il était plus loin).
- Écran (`render.js`) : `wallSwitch(a)` (INT/VV accroché à un mur), `switchGlyph(t)` ; position affichée collée au mur,
  rotation = normale du mur côté pièce (comme l'applique) ; sans mur : dessin d'avant. Avec les symboles FTZ du BE
  (préférence `charteBE`, active par défaut) : même règle sur le symbole de la charte (rond en bas, trait vers le haut) :
  bas du rond contre la face (`h/2` × `FTZK`), trait tourné vers la pièce (`atan2(nx, -ny)`).
- Papier (`print.js`) : même collage et `symbol(..., nrm)` (rond + traits tournés vers la pièce) ; symbole FTZ (mm réels)
  collé de la même façon et tourné par `drawSymbol`.
- Tests : `scripts/placement.test.mjs` (6) ; smoke (symboles Oktéo puis FTZ : écart rond / face = rayon, sens vers la pièce, papier) ;
  le contrôle n° 13 (symboles poussés hors du mur) ne compte plus INT / VV.
- Fusion dans `main` le 05/11/2026 (go de Kévin) : `npm run check` vert sur GitHub Actions (run 41993507221, smoke 209/209) ;
  workflow temporaire retiré.

## 05/11/2026 — « Je confirme l'emplacement » arrête le clignotement, noté dans le rapport pour le BE

- Constat de Kévin : dans « Pourquoi ça clignote ? », « Vu, je garde » notait la décision mais l'appareil continuait de
  clignoter. Demande : soit modifier, soit confirmer l'emplacement, et la confirmation arrête le clignotement ; la
  validation est notée dans le rapport transmis à Thibaut (technicien BE).
- `src/cablage/rapport.js` : `keyOf(it)`, `confirmable(kind)` (toutes les familles sauf câblage : boîte, circuit,
  allumage coupé, VMC se règlent dans le panneau Câblage), `isConfirmed(d)` (choix `confirme`, ou l'ancien `garde`),
  `silenced(it, decisions)` ; `buildRapport` → `validations` [{rep, kind, alerte, label, by, at}] (confirmés + points
  « Modifier » qui ne sont plus signalés = « corrigé par l'opérateur ») ; `rapportText` : rubrique « Emplacements
  confirmés et corrections ».
- `src/core/check.js` `controlIssues` : les points confirmés sont retirés (plus de halo, compteur, ni bouton du menu
  flottant), même si l'appareil est déplacé ensuite (clé = sorte + appareils).
- `src/ext/why-blink.js` : boutons « Je confirme l'emplacement » (« Je confirme, c'est voulu » pour un montage) `[data-ok]`
  et « Modifier » `[data-mod]` (carte fermée, appareil sélectionné, décision « en cours de modification ») à la place de
  « Vu, je garde » ; un emplacement « à préciser » (équipements, VMC) passe à `implantation.etat = confirmee` dans le même
  Ctrl+Z ; décision avec `rep` et `alerte` ; carte du rapport : section `.rap-val`. Catalogue `ai.rapport` mis à jour.
- Tests : `scripts/rapport.test.mjs` (4) ; smoke (confirmation, déplacement, rapport, Ctrl+Z, Modifier).
- La carte rappelle les points déjà confirmés de l'appareil (« ✓ emplacement confirmé — qui, quand »).
- Fusion dans `main` le 05/11/2026 (go de Kévin) : `npm run check` vert sur GitHub Actions (run 41990372145, smoke 208/208) ;
  workflow temporaire retiré.

## 04/11/2026 — n° 5 : rapport d'analyse clair (« Pourquoi ça clignote ? », familles de couleur, décisions, questions au pavillonneur) (bloc D)

- Constat du 04/11 : le même halo orange pour les doutes de l'IA, les montages faux, la pose et le câblage ; le clic
  n'expliquait rien. Demande de Kévin : bulle au clic, une couleur par famille, preuves, conséquence de chaque choix,
  recommandation, questionnaire pour Kévin puis relais au technicien BE (qui a décidé quoi), questions au pavillonneur.
- `src/cablage/rapport.js` (pur) : `FAMILLES` (ia bleu « L'IA hésite », montage rouge, pose orange, câblage vert),
  `familyOf(kind)`, `candidates(note)` (« INT ou VV ? » → types), `consequence(t)`, `explain(issue, a)` (pourquoi,
  preuves : inscription, lecture et remarque de l'IA, calibre ; choix et conséquences ; recommandation ; question au
  pavillonneur), `buildRapport`, `rapportText`.
- Plan : halo d'un appareil à la couleur de sa famille la plus grave (`fx-halo fam-…`, render.js `drawFx`). Menu flottant
  d'un appareil signalé : « Pourquoi ça clignote ? » (`data-h="why"` → `okteo:why`). `src/ext/why-blink.js` : carte
  `.whyb` (extrait du plan autour de l'appareil, points expliqués, boutons des types candidats = type changé + décision,
  « Question au pavillonneur », « Vu, je garde »), décisions `cab.decisions` {clé: {choix, label, by, at}} et
  `cab.questions` (annulables, enregistrées avec le chantier) ; carte `.rapcard` « Rapport d'analyse » (points par
  famille, décidés ou à décider, questions ; « Copier pour le BE », « Copier les questions ») ; catalogue `ai.rapport`.
- Tests : `scripts/rapport.test.mjs` (3, dans check) ; smoke (halos rouges, bulle, question, choix VV, rapport, Ctrl+Z).
- Fusion dans `main` le 04/11/2026 (go de Kévin pour le bloc D) : `npm run check` vert sur GitHub Actions (run 41913594686,
  smoke 207/207) ; workflow temporaire retiré. Bloc D terminé (n° 15, 3 + 16, 5).

## 04/11/2026 — n° 3 + 16 : outils de l'IA pendant l'analyse, mode 4 seul, échelle bloquante, mémoire des symboles (bloc D)

- Relais en ligne (`server/worker.js`) : jusqu'ici « aucun outil ». Ouvert aux **outils définis par Oktéo seulement**
  (12 au plus, {name, description, input_schema} sans « type » : ni recherche web, ni exécution de code, ni outil serveur),
  blocs `tool_use` (réponse de l'IA rejouée, outil déclaré) et `tool_result` (texte ou image base64, aucune adresse) ;
  outils comptés avec la consigne (count_tokens) : même réservation de budget. Test `scripts/web.test.mjs`.
- `ai.js` `chat({tools})` : outils transmis, réponse avec `content` (blocs) et `stop` (raison d'arrêt).
- `src/walls/ai-tools.js` (pur) : `AI_TOOLS` (legende, symboles, textes, murs, zoom, verifier), `runTool`, `checkReleve`
  (décompte, lumières sans commande, commandes sans lumière, va-et-vient seul, VR / CVR, symboles du PDF non couverts),
  `TOOLS_GUIDE`. `src/ext/ai-agent.js` : `toolContext(api, G, S)` (formes, textes et légende du PDF vectoriel et murs
  détectés, en pixels de l'image envoyée ; zoom rendu depuis le PDF ; mémoire des symboles) et `readWithTools` (boucle
  bornée : `toursOutils` 8, 8 zooms). Mode 4 (`ai-modes-run.js`) : la lecture globale passe par les outils ; journal
  `outils`, `outilsListe` ; carte du relevé « n outils d'Oktéo utilisés ».
- « Analyse IA » : préférence `modesIA` = « 4 » (seul le mode 4 à l'écran, choisi d'office ; « Afficher aussi les modes
  1 à 3 » → « tous ») ; mode 4 : 5 relectures (au lieu de 3) ; **échelle bloquante** : fond pas mis à l'échelle, ou cotes
  du plan qui s'écartent de plus de 3 % → encart `.am-scale` (Relever les murs / Régler l'échelle), lancement refusé.
- n° 16 : `src/ext/symbol-memory.js` (`okteo.symmemo.v1` par pavillonneur : type, description, extrait du dessin, chantier,
  qui, date ; `symbolMemory(pav)` y ajoute les symboles BE communs avec correspondance Oktéo ; `remember`, `forget`,
  `cropAround`) ; Propriétés d'un appareil relevé par l'IA : « Mémoriser ce symbole » (`#f_memo` → `okteo:symbol-memo`).
  Lue par l'outil « legende » ; la légende du plan reste prioritaire (contradiction à signaler dans les remarques).
- Pas encore : signalement automatique des contradictions dans le rapport de Thibaut, question à l'opérateur pendant
  l'analyse pour un symbole inconnu (il reste INCONNU, à mémoriser après correction), outil « suivre_trait », mémoire
  partagée entre opérateurs (elle est dans le coffre de chaque compte ; la bibliothèque commune reste éditée par l'administration).
- Tests : `scripts/ai-tools.test.mjs` (5, dans check), `web.test.mjs` (outils au relais), `ai-modes.test.mjs` (5 relectures) ;
  smoke : mode 4 avec outils (faux serveur : 3 outils puis relevé), mode 4 seul + échelle bloquante, mémoire d'un symbole.

- Fusion dans `main` le 04/11/2026 (go de Kévin pour le bloc D) : `npm run check` vert (run 41911939621, smoke 206/206) et
  `npm run test:web` vert (16/16, relais en ligne) sur GitHub Actions ; workflow temporaire retiré. À vérifier en ligne :
  première analyse mode 4 réelle (outils appelés par Claude, coût).

## 04/11/2026 — n° 15 : import du dossier PDF par rôle de page (bloc D, go de Kévin)

- Décision de Kévin : on importe le dossier PDF entier, l'opérateur désigne les pages (implantation par niveau, plan cuisine,
  devis) ; le reste est ignoré ; l'IA ne lit que les pages désignées.
- `src/walls/page-roles.js` (pur) : `ROLES` (niv:RDC, niv:R+1, niv:R+2, niv:Sous-sol, niv:Combles, cuisine, devis, ignorer),
  `proposeRole(page)` d'après le texte de la page (mots du plan électrique, du plan cuisine, du devis, façades / coupes /
  plan de masse ; niveau écrit : sous-sol, combles, R+2, R+1 / étage, sinon RDC) et son sens (texte illisible : paysage =
  plan, portrait = à ignorer, confiance basse) ; `proposeRoles` (une page par niveau : la plus probable, à égalité la
  dernière en paysage comme avant) ; `setRole` (une page prise pour un niveau libère l'ancienne) ; `dossierOf` ;
  `analysisPages`.
- `fond-import.js` `pdfThumbs` : texte de chaque page (6 000 caractères). `chantiers-page.js` : liste du rôle sous chaque
  vignette (`.pg-role`, orange « ? » si douteux, infobulle = raison) ; un clic sur une vignette la prend pour le RDC
  (nouveau chantier) ou le niveau ouvert. Nouveau chantier : un niveau par page d'implantation (RDC = 1er, clés
  habituelles ; les autres `l…`), chacun avec son fond et son PDF ; `meta.dossier` {name, at, levels, cuisine, devis,
  ignorer, pages}. Changer le fond : rôles enregistrés, fond du niveau ouvert seulement (pas de création de niveau).
- Mode 4 (`ai-cross.js`) : avec un dossier, seules les pages « plan cuisine » et « devis » du PDF du chantier sont jointes
  (libellées), sinon comme avant toutes les pages hors plans ; écran des modes : « n pages du dossier jointes
  automatiquement ». Catalogue `help.dossier`.
- Tests : `scripts/page-roles.test.mjs` (4, dans check) ; smoke : rôles d'EVRARD (page 3 = RDC, pages sans texte à ignorer),
  modifiés à la main ; dossier de 3 pages généré (RDC, R+1, devis) → chantier à 2 niveaux avec leur fond, devis joint.

- Fusion dans `main` le 04/11/2026 (go de Kévin pour le bloc D) : `npm run check` vert sur GitHub Actions (run 41910067884,
  smoke 204/204) ; workflow temporaire retiré.

## 04/11/2026 — n° 11 : bibliothèque de mobilier (lot C)

- Demande de Kévin : un petit bouton qui affiche les meubles à implanter (canapé, table, chaise, plante, meuble TV, lit…),
  sans électricité ni repère, pour rendre la 3D parlante puis implanter les meubles avec le client.
- Meubles = « appareils » sans électricité posés comme les sanitaires (`volumes.js` `meuble: true`, `isMeuble`) : CANAPE,
  FAUTEUIL, TABLE, CHAISE, LIT2, LIT1, MTV, ARMOIRE, MBUREAU, PLANTE ; `saniShape` (assise, dossier, accoudoirs, oreillers,
  portes, feuilles), `sani3d` (assise 42 cm, dossier 85 cm, plateau 75 cm sur pieds, lit 50 cm + tête, armoire 2 m, pot +
  feuillage) ; `appareils.js` groupe « Mobilier » (hors « Autres »).
- Barre des appareils : bouton « Mobilier ▾ » (`[data-tool="__meubles"]`, `K.moreOpen = "meubles"`, même menu que
  « Autres »). Plan et impression : trait gris clair continu (sanitaires : gris pointillé). 3D : bois clair, plante verte.
  Propriétés : longueur, largeur, rotation + aide. Catalogue `help.mobilier`.
- Le relevé IA ne propose ni meubles ni zones d'exclusion (`AI_TYPES` les écarte).
- Tests : `scripts/mobilier.test.mjs` (4, dans check) ; smoke (bouton, 10 meubles, canapé + table, 3D, Ctrl+Z).

- Fusion dans `main` le 04/11/2026 (go de Kévin « go bloc C et fusionne ») : `npm run check` vert sur GitHub Actions
  (run 41904201702, smoke 202/202) ; workflow temporaire retiré. **Lot C terminé** (n° 10, 11).

## 04/11/2026 — n° 10 : zones d'exclusion (lot C, go de Kévin)

- Décision de Kévin : une zone d'exclusion exclut tout (boîtes, gaines, appareils, lignes directes) ; hachurée en 2D, bloc
  rouge transparent en 3D ; contournement automatique, longueurs recalculées ; sur le plan, seules les lignes directes qui
  contournent un obstacle sont tracées.
- Une zone est un « appareil » sans électricité ni repère, posé comme un sanitaire : types `ZONE` (rectangle) et `ZONEC`
  (cercle / ellipse) dans `volumes.js` (`zone: true`, `saniShape`, `sani3d` sur toute la hauteur) et `appareils.js` (groupe
  « Zones d'exclusion » du bouton « Autres ») ; Propriétés : longueur, largeur, rotation, aide propre.
- `src/cablage/exclusion.js` (pur) : `isZone`, `zonePoly`, `zonesByLevel`, `segHits`, `detour(A, B, polys)` (plus court
  chemin par les sommets des zones agrandies de 15 cm, graphe de visibilité ; une zone qui contient un bout est ignorée),
  `detourVia` (avec les points tracés à la main), `pushOut` (boîte repoussée hors de la zone + 15 cm), `insideAny`.
- Moteur : `gaines.js` : gaines d'appareil, d'alimentation, tronçons de pontage et lignes directes contournent les zones de
  leur niveau (`g.via`, `g.detour`, longueur par le contournement) ; `boites.js` `placeBoxes` repousse les boîtes placées.
  Contrôle `zone` (check.js) : appareil électrique posé dans une zone.
- Plan : zone hachurée rouge (`g.sani.zone`, motif `#zhatch`) ; gaines et pontages en tracé brisé autour des zones ; ligne
  directe qui contourne = tracé en tirets du tableau à l'appareil (`path.direct-route.detour`) + flèche. Impression : mêmes
  tracés (`ends[].auto` sans ronds de points de passage, `direct[].via`), zone hachurée rouge. 3D : bloc rouge transparent
  (`userData.zone`), gaines 3D par les points du contournement.
- Limite : un appareil n'est pas déplacé automatiquement hors d'une zone (signalé par le contrôle) ; une boîte glissée à la
  main dans une zone n'est pas signalée.
- Tests : `scripts/zones.test.mjs` (7, dans check) ; smoke : zone posée entre une boîte et un appareil, groupes « Autres » à 8.

- Fusion dans `main` le 04/11/2026 (go de Kévin « go bloc C et fusionne ») : `npm run check` vert sur GitHub Actions
  (smoke 201/201) ; workflow temporaire retiré.
## 04/11/2026 — n° 4 : consigne du relevé IA réécrite (validée par l'essai de Kévin)

- Essai de Kévin le 04/11 (consigne type par copier-coller, plan d'une maison de plain-pied, page entière 4961 × 3508 px) :
  murs extérieurs en un seul mur de 34 cm (emprise 10,31 m conforme aux cotes), échelle mesurée sur 5 cotes (236 px/m =
  1:50 à 300 dpi), rangée du séjour juste (3 prises, 2 RJ45, 1 TV), 10 plafonniers et 5 appliques tous reliés, doutes tous
  entre deux types nommés, placards fermés sur 3 côtés. Réserves : guillemets typographiques (lus par `parseAiJson`),
  une applique posée sur le « tableau » du placard technique.
- `ai-plan.js` `promptBody` (commun au relevé avec clé et au collage) : échelle mesurée sur au moins 3 cotes, écrite en tête
  de « remarques » ; mur extérieur maçonnerie + doublage = un seul mur (axe de l'ensemble, épaisseur totale) ; cloisons
  prolongées jusqu'à l'axe ; pointillés et tirets jamais des murs ; placard fermé sur 3 côtés ; symboles tournés avec leur
  mur ; doute = toujours entre deux types nommés, sinon INCONNU ; guillemets droits demandés. Format JSON inchangé.
- Contrôle d'échelle : `scaleClaim(texte)` (« N pixels par mètre », « N px/m ») et `scaleCheck(texte, map)` (écart avec
  l'échelle de l'image, 3 % de tolérance) ; carte du relevé IA (`ai-releve.js` `scaleStep`) : « échelle de l'IA conforme au
  fond » ou « ⚠ échelle annoncée … : vérifiez l'échelle du fond ou le « ref » ».
- Tests : `scripts/ai-align.test.mjs` (consigne avec et sans clé, échelle, réponse à guillemets typographiques).
- Reste du n° 4 : banc d'essai du mode 4 sur ce plan (avec clé, en ligne).
- Fusion dans `main` le 04/11/2026 (go de Kévin) : `npm run check` vert sur GitHub Actions (run 41902521558,
  smoke 200/200) ; workflow temporaire retiré.


## 04/11/2026 — n° 7 : mode de pieuvre « Bureau d'études » (lot B)

- Demande de Kévin : séjour seul ou + garage ; cuisine seule ou + PC du séjour ou + cellier proche ; chambre 1 + 2 ;
  chambre + dégagement ; SdB + chambre ; boîte VR seule ; pieuvres équitables ; le moins de croisements possible.
- `boites.js` : `MODES.be` = « Bureau d'études », `BE_KINDS` / `beKindOf(nom)` (sejour, cuisine, garage, cellier, sdb,
  chambre (bureau compris), passage (dégagement, couloir, entrée, WC, placard, dressing…), autre), `BE_COUPLES`,
  `placeLevelBE` : une boîte par pièce (appareil hors pièce → pièce la plus proche), puis fusions de pièces VOISINES (moins
  de 35 cm entre contours) par priorité — passage avec une voisine (entrée → séjour / cuisine, WC → salle de bain,
  dégagement → côté nuit), puis les couples (chambre + chambre, chambre + salle de bain, cuisine + cellier, séjour +
  garage), puis petite pièce (moins que « départs minimum ») avec sa voisine ; jamais plus de deux pièces principales ;
  à priorité égale, la fusion la plus petite d'abord (équité) ; une place de marge (R-073). Séjour trop chargé : ses unités
  de prises (`u.prises`, nouveau champ de `buildUnits`) les plus proches de la cuisine vont dans la boîte de la cuisine ;
  encore trop chargé : coupé en parts (comme « par pièce »). Boîte posée dans ses pièces. Volets : `placeBoxes` met
  toujours les volets à part en mode BE, dans une seule boîte (deux seulement si la capacité l'impose).
- Interface : liste des modes (Câblage, Mode IA, journal des règles) ; comparatif : 5 modes (« Comparer les modes »),
  description du mode BE ; catalogue `help.modes`. Les pièces sont transmises au placement (`autoBoxes`).
- Tests : `scripts/mode-be.test.mjs` (8, maison synthétique de 10 pièces) ; smoke : comparatif à 5 modes.

- Fusion dans `main` le 04/11/2026 (go de Kévin « go et fusionne B ») : `npm run check` vert sur GitHub Actions
  (run 41900550854, smoke 200/200) ; workflow temporaire retiré. **Lot B terminé** (n° 6, 7).

## 04/11/2026 — n° 6 : association et pontage dans le moteur de câblage (lot B, go de Kévin)

- Décisions de Kévin (04/11) : association toujours active ; jamais un courant faible avec une prise ou une commande ;
  commandes associables dans un même boîtier ; pontage = option du chantier, prises et lumières, 5 à la suite au plus
  (réglable), même section, **d'une pièce à l'autre permis**.
- Association : existait (`memeEndroit` 0,30 m : une gaine, fils communs une fois) ; `gaines.js` interdit maintenant de
  grouper un appareil de courant faible (`isFaible`) avec un autre. Libellé du réglage : « Association : … ».
- Pontage (`gaines.js`, avant la ronde R-072 pour que les couleurs tiennent compte de la gaine commune) : endroits
  « pontables » = même niveau, mêmes fils (prises PC16 d'un même circuit, ou lumières d'un même allumage : même retour),
  ni extérieur (câble), ni courant faible, ni circuit spécialisé ; chaîne depuis l'endroit le plus proche de la boîte, puis
  le plus proche du dernier tant qu'il est plus près de lui que de la boîte, au plus `S.pontageMax` endroits. La gaine de la
  boîte va au 1er endroit (`g.length`, face et point d'accroche d'après lui) ; tronçons `g.ponts` [{de, vers, from, to, ids,
  length}] (longueur : à plat + descentes des deux côtés + surlongueur d'appareil aux deux bouts), `g.pontLen` ; libellé
  « P1 → P2 → P3 (pontage) » ; cuivre, longueur de la boîte et total de gaine comptent les tronçons.
- Choix du chantier `cab.choix.pontage` (case `#bx-pont` dans le panneau Câblage, sous les modes) → `cabS(api)` et
  `plan-wiring.js` ; réglage `pontageMax` (5, Paramètres → Gaines et câbles).
- Plan : `setGaineGroups` reçoit `__ponts` par boîte ; `boxLayout` regroupe d'après le calcul quand il est connu,
  `d.head` (appareils reliés à la boîte) et `d.ponts` ; gaines dessinées vers `d.head`, tronçons `path.pont` en trait mixte
  de la même couleur ; courbures, croisements et `hitRoute` ignorent les appareils pontés. Impression : `deps[].ponts`
  (levels.js, tourné par `rotateGeo`), trait mixte. Pieuvre → Boîtes : « + pontage … m » ; bande (écran `.bd-ponts` et PDF) :
  ligne « Pontages ». Le QR de la bande ne contient pas encore les tronçons. Le placement des boîtes compte encore un départ
  par endroit (le pontage est appliqué au calcul des gaines) : à revoir avec le n° 7 si besoin.
- Catalogue `help.pontage`. Tests : `scripts/pontage.test.mjs` (7, dans check) ; smoke (case cochée → moins de départs,
  tronçons sur le plan, un Ctrl+Z).

- Fusion dans `main` le 04/11/2026 (go de Kévin « go et fusionne B ») : `npm run check` vert sur GitHub Actions
  (smoke 200/200) ; workflow temporaire retiré.

## 04/11/2026 — n° 12 : cotes des boîtes depuis la face EXTÉRIEURE du mur extérieur (réponse de Kévin)

- Kévin : « extérieur de la boîte est extérieure du mur » → la cote part de la face extérieure du mur extérieur (et plus de
  la face côté pièce, choix provisoire du lot A). `ftz-sheet.js` `extHit` : dernière face rencontrée par le rayon ; le trait
  d'attache côté mur s'arrêtait déjà sur la face extérieure (`drawBoxCotes`). Côté boîte : centre de la boîte (décision de
  Kévin le 04/11 : « prend le centre »).
- Test : `scripts/charte.test.mjs` (valeurs + épaisseur du mur extérieur, fenêtre comprise).

- Fusion dans `main` le 04/11/2026 : `npm run check` vert sur GitHub Actions (smoke 199/199) ; workflow temporaire retiré.

## 04/11/2026 — n° 9 : sanitaires WC, lavabo, vasque, évier ; tous en gris pointillé et en volume dans la vue 3D (lot A)

- Demande de Kévin : ajouter WC, lavabo, vasque, évier (dessin inspiré des plans de pavillonneurs), tous les sanitaires en
  trait gris fin pointillé, visibles en 3D.
- `src/cablage/volumes.js` : `SANI` + `WC` (0,38 × 0,68 : réservoir + cuvette), `LAVABO` (0,60 × 0,45 : bassin ovale,
  robinet), `VASQUE` (0,80 × 0,50 ; double à partir de 1,20 m), `EVIER` (1,20 × 0,60 : bac + égouttoir) ; `vol: true`
  seulement pour BAIG / RECV / DITAL (`hasVolumes` : volumes et contrôle de la salle de bain inchangés).
  `saniShape(a)` = dessin commun écran / impression ([{k out|in|line, pts}], repère local tourné par `a.srot`, dos côté
  v = -d/2) ; `sani3d(a)` = volumes 3D ([{pts, z0, z1}] : WC cuvette 40 cm + réservoir 80 cm, lavabo suspendu 70–85 cm,
  vasque sur meuble 15–85 cm, évier 90 cm, baignoire 55 cm, receveur 6 cm, pomme de douche fixe à 2 m).
- `appareils.js` : 4 types du groupe « Sanitaires » (bouton « Autres »), sans circuit ni repère (famille SANI) ; listes
  codées en dur remplacées par `isSani` (circuits.js, render.js `__need`, ai-bench.js). L'IA connaît les nouveaux types
  (`AI_TYPES` suit `APPAREILS`).
- Écran (render.js) : volumes dessinés d'abord, puis chaque sanitaire en gris `#8a8f96`, 1 cm, pointillé ; sélection en
  couleur de sélection. `exportGeometry().sanis` [{id, t, x, y, shape, solid}] (tourné par `rotateGeo`) ; print.js même
  dessin (gris 130, pointillé 0,7/0,45 mm, contour blanc). 3D (scene.js `buildHouse`, `house.sanis`) : volumes blancs à
  arêtes grises, sur tous les niveaux affichés ; la signature de reconstruction de la vue 3D inclut les sanitaires (poser
  ou déplacer un sanitaire met la 3D à jour). Propriétés : texte d'aide propre aux sanitaires sans volume. Catalogue
  `help.sani`.
- Tests : `scripts/charte.test.mjs` (formes, rotation, vasque double, pas de volume ni de contrôle, volumes 3D) ; smoke
  (4 sanitaires posés : pointillés, sans repère ni circuit, PDF, 3D, un Ctrl+Z).
- Fusion dans `main` le 04/11/2026 (lot A, go de Kévin) : `npm run check` vert sur GitHub Actions (run 41893797352,
  smoke 199/199) ; workflow temporaire retiré. **Lot A terminé** (n° 1, 14, 13 + 8, 12, 2, 9).

## 04/11/2026 — n° 2 : la légende de la feuille A3 s'adapte et ne passe plus sur le plan (lot A)

- Constat de Kévin : à l'impression, la légende se superposait au plan. Cause : `freeCorner` essayait 4 coins du rectangle
  englobant le plan et, faute de coin libre, prenait le moins mauvais.
- `src/print/ftz-sheet.js` : `legendCols` (1 à 3 colonnes équilibrées), `legendSize(rows, {cols, k})`, `LEGEND_LAYOUTS`
  (k = 1 → 0,7 × 1 à 3 colonnes), `legendFit(area, blocked, rows)` (grille de 2 mm, somme cumulée : la plus grande mise en
  page qui tient, au plus près d'un coin) ; `drawLegend(doc, rows, x, y, drawSym, {cols, k})` (symboles et textes réduits).
- `print.js` `buildFtz` : `blockedFor(zone, page…)` = ce qu'occupe la page (murs, pièces, appareils, boîtes, gaines, lignes
  directes, bandes des cotes des boîtes, encarts) ; sur la page de la légende, plan centré, sinon décalé à gauche, à droite, en
  haut ou en bas (`LayP`, `planP`, cotes et QR suivent) ; en dernier recours une page « Légende » à part (cadre + cartouche).
  `legends[].where` (« plan », « plan décalé », « main », « page à part »), `cols`, `k`. Légende déplacée à la main dans la
  préparation (`legendAt`) : inchangée.
- Tests : `scripts/charte.test.mjs` (colonnes, coin libre, plan presque plein, aucune place) ; smoke : légende dans la zone de
  dessin, avec sa mise en page.

- Fusion dans `main` le 04/11/2026 (lot A, go de Kévin) avec le n° 2 (sa branche contient le n° 12) : `npm run check`
  vert sur GitHub Actions (run 41892789253, smoke 198/198) ; workflow temporaire retiré.

## 04/11/2026 — n° 12 : cotes des boîtes prises sur le mur extérieur (lot A)

- Demande de Kévin : les cotes de position des boîtes (feuille A3 du BE) doivent être prises sur le mur extérieur, et le trait
  doit rejoindre la boîte (avant : distance au mur le plus proche, souvent une cloison ; trait d'attache arrêté au mur).
- `src/print/ftz-sheet.js` : `rayHits` (toutes les rencontres d'un rayon avec les murs), `extHit` (face côté pièce du DERNIER
  mur rencontré = mur extérieur ; rayons décalés jusqu'à ±1,5 m si le rayon passe par une fenêtre) ; `boxCotes` mesure sur le
  mur extérieur le plus proche dans chaque axe ; `drawBoxCotes` : trait d'attache côté mur arrêté au mur extérieur, côté boîte
  prolongé jusqu'à la boîte. Choix à confirmer avec Kévin : face côté pièce du mur extérieur (et non face extérieure).
- Test : `scripts/charte.test.mjs` (cote mesurée sur le mur extérieur et non sur la cloison, y compris à travers une fenêtre).

- Fusion dans `main` le 04/11/2026 (lot A, go de Kévin) avec le n° 2 (sa branche contient le n° 12) : `npm run check`
  vert sur GitHub Actions (run 41892789253, smoke 198/198) ; workflow temporaire retiré.

## 04/11/2026 — n° 13 + 8 : appareils contre les murs, dans le sens du mur ; repères lisibles et déplaçables (lot A)

- Constats de Kévin : appareils à cheval sur les murs, tableau qui ne suit pas le sens du mur, repères (P5, P6…) dans les murs
  ou masqués, impossibles à déplacer. Cause du chevauchement : centre posé à 6 cm de la face du mur, symbole affiché de 15 à
  25 cm de rayon.
- `src/place.js` : `pushOff(p, wall, R)` (symbole poussé hors du mur, bord contre la face, à tous les zooms ; position réelle
  inchangée), `wallBoxes(P)`, `lineBoxes(pts)`, `repCandidates(p, R, gap, h, side)` (3 couronnes de 12, côté pièce d'abord).
- Écran (`render.js`) : `wallU(a)` donne aussi axe, normale côté appareil et épaisseur ; `K.dispPos` = position poussée puis
  écartée, `K.dispLead` = seuls les appareils écartés par un voisin ont un trait de rappel ; `appRot(a)` : tout appareil
  mural tourne avec son mur, ramené dans (-90°, 90°] (jamais à l'envers, vue tournée comprise ; l'applique garde son dos au mur).
  Repères : murs = obstacles durs (`WALLS`), liaisons et gaines = à éviter si possible (`SOFT`), trait de rappel au-delà de
  la 1re couronne au lieu de masquer, `text.rep[data-id]`, `K.repLabelBoxes`.
- Repère déplaçable : glisser `text.rep` (interact `K.repDrag`) → `a.rpx` / `a.rpy` (m depuis l'appareil, un Ctrl+Z) ; Propriétés
  `#f_rep0` « Replacer le repère » ; exporté (`exportGeometry().apps[].rpx/rpy`) et repris à l'impression.
- Impression (`print.js`) : même poussée hors du mur, même rotation (normalisée après `rotateGeo`, axe et normale tournés),
  repères hors des murs (`WB`), trait de rappel, plus de repère masqué.
- Côté pièce : `snapToWall(x, y, t)` choisit la face où il y a une pièce pour un appareil d'intérieur (`EXTERIEURS` : PCEXT, GEXT,
  PX4, MGAR, ANT, VREJ) ; `importDevices` passe le type. Contrôle `mur` (« appareil dans l'épaisseur d'un mur ») ;
  `okteo.reattachWalls()` + catalogue `app.reattach` « Recoller les appareils à leur mur ».
  Le collage côté pièce ne joue que pour un relevé IA (`importDevices(..., {roomSide: true})`) et un appareil posé dans
  l'épaisseur du mur (sinon le relevé automatique et le câblage changeaient). Clic : un symbole affiché plus près que le
  sommet du mur gagne (`hitAny`) ; un point de passage de gaine reste saisissable sous un symbole ; un repère cliqué dans son
  texte gagne sur le symbole voisin. Impression : `rotD` ignore une forme sans tracé (symbole du BE tourné).
- Tests : `scripts/placement.test.mjs` (5) dans `npm run check` ; smoke : symboles hors du mur, rotation sur mur vertical,
  contrôle `mur` + recollage, repère glissé et Ctrl+Z.

- Fusion dans `main` le 04/11/2026 (lot A, go de Kévin) : `npm run check` vert sur GitHub Actions (run 41892006715,
  smoke 197/197) ; workflow temporaire retiré.

## 04/11/2026 — n° 14 : autocorrection des murs (lot A, branche `feat/lot-a-14-murs-equerre`)

- Demande de Kévin : un mur légèrement de travers doit être remis d'équerre (angle en L non droit, rectangle de biais).
  Avant : `aiToPlan` ne redressait qu'à moins de 4° des axes de la PAGE, la fusion de sommets pouvait remettre un mur de biais,
  le relevé automatique ne redressait rien.
- `src/walls/squaring.js` (pur) : `houseAngle` (sens de la maison d'après ses murs, 2 passes, aligné sur la page à ≤ 2°),
  `squarePlan(plan, {tol 10, tol45 10, maxMove 0,15, hardMove 0,5, collinear 0,05, pageSnap 2})` → sommets recalculés par
  groupes (murs h → même v, murs v → même u, moyenne pondérée par la longueur), murs dans le prolongement (≤ 5 cm, ≤ 60 cm
  d'écart) sur la même ligne, murs à 45° remis exacts par leur bout libre, biais au-delà gardés et signalés ; déplacement
  > maxMove = corrigé mais `verifier`, > hardMove = `refus` (pas corrigé) ; `keepOpenings` (place relative), `squareReleve`,
  `squareOptions(prefs)`, `squareText`.
- Branché : `ai-releve.js` `squareStep()` dans `fromText` et `fromPlan` (avant le recalage v77, compte rendu dans la carte),
  `walls-ui.js` (relevé automatique, ligne `#w-square`), `okteo.squareWalls(opts)` (cœur, un Ctrl+Z, appareils et pièces suivent
  leurs murs), bouton Relevé → « Murs d'équerre » `#rv-square`, catalogue `walls.square`, `hooks.squareWalls` (compte rendu
  dans la barre d'aide). Réglages : préférences `equerreTol` 10°, `equerre45` 10°, `equerreMax` 15 cm, Paramètres → Murs
  (`#ps-murs`, 0 = rien corrigé).
- Tests : `scripts/squaring.test.mjs` (9) dans `npm run check` (`npm run test:equerre`) ; smoke : maison relevée de travers
  remise d'équerre par le menu, angles joints, deux Ctrl+Z. Workflow TEMPORAIRE `.github/workflows/verification-lot-a.yml`.

- Fusion dans `main` le 04/11/2026 (lot A, go de Kévin) : `npm run check` vert sur GitHub Actions (run 41890979246) ;
  workflow temporaire `verification-lot-a.yml` retiré.

## 04/11/2026 — v77 fusionnée dans `main` (« go » de Kévin pour le lot A)

- Branche `feat/releve-colle-ref-calibre` fusionnée ; workflow temporaire `verification-releve-colle.yml` retiré. Dernière
  vérification : run 41872805290 vert (smoke 195/195). Feuille de route du 04/11 (16 mises à jour, lots A à D) : document du
  projet claude.ai « claude/feuille-de-route-2026-11.md » ; lot A lancé (n° 14, 13 + 8, 12, 2, 9).

## 04/11/2026 — v77 : réponse IA collée — « ref » tolérant, calibre en texte, recalage sur les murs du PDF (branche `feat/releve-colle-ref-calibre`)

- Constat (relevé collé par Kévin sur un plan client) : 1) « Cette réponse n'indique pas la taille de l'image de
  référence » alors que la réponse avait `"ref":{"w":1568,"h":1100}` (minuscules : seul `W`/`H` était lu) ; 2) « Appareil 41 :
  calibre invalide » pour `"calibre":"20 A"` (seul un nombre passait) ; 3) relevé décalé sur le fond. Mesuré sur la page
  rendue : l'image fait 1 568 × 1 109 px (l'IA a annoncé 1 100, +0,8 % d'étirement vertical) et ses murs sont estimés à
  l'œil (mur droit 15 px trop à droite, largeur globale ~1 % trop grande).
- `ai-plan.js` `refOf(raw, {fondW, fondH})` : `W/H`, `w/h`, `width/height`, `largeur/hauteur`, nombres ou textes (« 1109 px ») ;
  hauteur recalculée d'après la largeur si la proportion annoncée diffère de moins de 3 % de celle du fond (`ajuste`,
  `annonce`). Message d'erreur avec un exemple de « ref ».
- `ai-data.js` `calibreOf` : `20`, `"20 A"`, `"32A"`, `"16"` acceptés (nombre gardé) ; texte illisible toujours refusé.
  Consigne : « calibre » en nombre d'ampères sans unité.
- `src/walls/ai-align.js` (pur) : `axisLines`, `alignTransform`, `alignPlan` = recalage u' = a·u + b par axe sur les murs
  du PDF vectoriel (`detectWalls`) : décalage grossier (essais = écarts entre murs, 15 cm), puis moindres carrés pondérés
  (tolérances 60 → 15 cm), puis chaque mur reconnu collé sur son mur du PDF (30 cm) ; ouvertures gardées à la même place
  relative sur leur mur ; appareils, pièces et ouvertures perdues : recalage d'ensemble seulement (l'IA place souvent mieux
  les symboles que les murs ; les muraux sont recollés à l'ajout). Garde-fous : ≥ 6 murs droits, ≥ 60 % de leur longueur
  retrouvée, décalage ≤ 1,5 m, échelle ± 5 % ; sinon rien ne bouge et la carte l'écrit (« non recalé sur le PDF (…) »).
- `ai-releve.js` : `realign()` après `fromText` (réponse collée ET relevé avec clé, mode 1 ; les modes 2 à 4 ne changent
  pas) ; case « Recaler sur les murs du PDF » `#ai-recal` (cochée, décochable avant l'ajout) ; `okteoExt.aiReleve.recal`.
  Essai sur la réponse réelle (axes mesurés sur l'image) : 33 murs collés, écart moyen 9 → 4 cm, x × 0,989.
- Angles des murs (remarque de Kévin : « deux rectangles pas joints » aux angles extérieurs) : chaque mur avait son propre
  contour. Écran (`render.js`) : couche `g.walls-out` (toutes les formes en #222, trait .024) puis formes remplies sans
  trait (murs puis carrés de jonction) ; mur sélectionné en `g.walls-sel`. Impression (`print.js`) : même principe (passe
  contour gris 32 trait 0,1 mm, puis remplissage, hachures et ondulations). Smoke : contour unique vérifié.
- Tests : `scripts/ai-align.test.mjs` (8, maison synthétique, aucun plan client) dans `npm run check` (`npm run
  test:recalage`) ; smoke : réponse collée avec « ref » minuscule et calibres texte. Vérification : workflow TEMPORAIRE
  `.github/workflows/verification-releve-colle.yml` (à retirer avant fusion) : run 41871291592 vert (smoke 194/194, ai-align 8) ; avec les angles : run 41872805290 vert (smoke 195/195).

## 04/11/2026 — Q-111 « distance depuis l'angle » à trancher avec Thibaut ; QR de la bande sans nom dans `main`

- Décision de Kévin (00:19) : la règle actuelle de distance « depuis l'angle » (`a.wa`, demi-épaisseur la plus grosse du
  sommet retirée, même d'un mur dans le prolongement) est CONSERVÉE ; question Q-111 ouverte dans
  `docs/journal-regles-cablage.md` (« à trancher avec Thibaut »), historique H-046, `npm run regles` relancé
  (111 questions, 46 entrées d'historique). Aucun code du cœur modifié.
- Branche `feat/bande-qr-sans-nom` fusionnée dans `main` (« go » de Kévin) : QR de la bande sans pavillonneur, chantier
  ni n° d'affaire (run 41737217417 vert).

## 04/11/2026 — QR de la bande de boîte sans aucun nom (branche `feat/bande-qr-sans-nom`)

- Demande de Kévin : aucun nom dans un QR code. `bande-code.js` `packSheet` : pavillonneur, nom du chantier, n° d'affaire
  et code de la boîte (qui contient le n° d'affaire) ne sont plus mis dans le QR (places gardées vides : les anciens QR
  restent lisibles). Le code-barre et l'en-tête imprimés sur la feuille ne changent pas.
- `bande.html` : en-tête = boîte, niveau, sens du couvercle, modèle ; titre de l'onglet « Boîte LI01 — bande de câblage ».
- Test smoke : le QR de la bande relu ne contient ni le nom, ni le client, ni le n° du chantier. Validation : run
  41737217417 vert (smoke 193/193). La branche `verification-bande` n'a pas pu être supprimée depuis la session
  (refusé par le relais GitHub) : à supprimer à la main sur GitHub, comme `verification-charte-v73(-captures)`.

## 04/11/2026 — Vue 3D (3D-1 à 3D-8, 3D-10) fusionnée dans `main` (« go » de Kévin)

- Branche `feat/3d-1-visionneuse` fusionnée dans `main` ; workflow temporaire `verification-3d.yml` retiré. Dernière
  vérification complète : run 41735764026 vert (smoke 193/193, v3d 48, build:web, test:web). Déploiement Cloudflare
  Pages automatique depuis `main` ; la page `plan3d.html` est publique comme `bande.html`.
- Dépendance ajoutée par la 3D : three 0.169.0 (MIT). Aucune autre.
- Reste : 3D-9 (essai chantier par Kévin, puis version client) ; questions ouvertes : repère `a.wa` (distance à l'angle
  faussée par un mur dans le prolongement), noms dans le QR de la bande de boîte, lisibilité du QR de 48 mm.

## 03/11/2026 — 3D-8 maquette 3D d'une face du plan par QR code (branche `feat/3d-1-visionneuse`)

- `src/3d/plan-code.js` (pur) : `packPlan(S)` / `unpackPlan(P)` (coque : sommets, murs avec épaisseur et hauteur,
  ouvertures avec gond, sens, allège, linteau ; pièces (nom, contour, hauteur sous plafond) ; appareils (type, position,
  hauteur, mur, repère) ; boîtes ; gaines (boîte, appareils, passage par le sol, points de passage) ; lignes directes ;
  hauteurs de départ ; version et date), centimètres entiers en différences successives, deflate + base64url
  (`encodeSheet` de la bande) ; `planUrl(S)` → `plan3d.html#p=…`, allégé si besoin (repères, puis sols), `tooBig` au-delà
  de 2 900 caractères. AUCUN nom de client, de chantier ni de n° d'affaire (vérifié par test).
  MAILLARD : recto (88 appareils, 10 boîtes, 97 gaines) = 2 493 caractères, verso (lignes directes) = 1 272.
- `src/ext/plan3d-qr.js` : `faceData(api, {apps, boxes, direct})` / `faceUrl` (planData de la 3D + gaines de `wiringNow`
  + lignes directes d'`exportGeometry`).
- Impression A3 du BE (`print.js` `buildFtz`, option `ftz.qr3d(face)`) : un QR de 48 mm par face, dans le coin libre de
  la zone de dessin (hors légende, le moins possible sur le plan), légende « Maquette 3D de cette face » ; `r.qrs`.
  Préparation d'impression : case « QR maquette 3D sur chaque face » (`#prep-qr3d`, `meta.impression.qr3d`, cochée par
  défaut). Taille : un QR de ~2 500 caractères est une version 37–39 (≈ 170 modules) : à 48 mm, 0,28 mm par module ;
  à essayer au chantier avec plusieurs téléphones (si besoin : deux QR par face, ou moins de contenu).
- Page publique `plan3d.html` + `src/plan3d-view.js` + `src/plan3d.css` (3e entrée Vite) : maquette (murs, ouvertures,
  sols, appareils, boîtes, gaines couleur de boîte, lignes directes en bleu), calques, vues Ensemble / Dessus, toucher =
  fiche (appareil, boîte, gaine, ligne directe), « Visite » à la manette tactile (collisions sur les murs, passages par
  les portes) ; `window.__plan3d` (tests). Worker : `/plan3d.html` et `/plan3d` publics comme la bande ; `test:web`.
- Remarque : le QR existant de la bande de boîte (v49) contient le pavillonneur, le nom et le n° du chantier (en-tête
  de la page bande). Non modifié : à décider avec Kévin (la consigne « aucun nom » portait sur le QR du plan).
- Tests : v3d (taille MAILLARD recto / verso, relecture au cm, aucun nom, allègement, version inconnue) + smoke (deux
  faces A3 avec QR, page téléphone : murs, gaines, fiche, visite) + test:web. Une gaine dont l'appareil n'est pas sur le
  niveau n'est pas mise dans le QR. Validation : run 41735764026 vert (smoke 193/193, v3d 48, build:web, test:web).
- Reste de la feuille de route 3D : 3D-9 = essai chantier par Kévin (puis version client). Avant la fusion dans `main` :
  retirer `.github/workflows/verification-3d.yml`.

## 03/11/2026 — 3D-10 tous les niveaux en 3D (branche `feat/3d-1-visionneuse`)

- Cœur : `okteo.inLevel(id, fn)` (exécute `fn` avec un autre niveau chargé dans `state`, via `withLevel` ; lecture seule).
- `vue3d.js` : bascule « Niveau ouvert / Tous les niveaux » (`.v3d-lvs [data-lvm]`, cachée s'il n'y a qu'un niveau,
  `ui.levels(m)`) ; les niveaux sont empilés dans l'ordre de la liste (de bas en haut) : hauteur du niveau (plus haut
  plafond de ses pièces) + dalle de 25 cm ; le niveau ouvert reste à la hauteur 0 (visite, clics, gaines, contrôles
  inchangés), le sol des ombres descend sous le plus bas ; `S3.others` [{id, name, y, house, devs}] ; liaisons
  commande ↔ lumière entre deux niveaux en pointillés rouges (`S3.vlinks`, `api.allLinks()`). Seul le niveau ouvert se
  touche et se modifie. Escaliers et trémies ne sont pas dans le dessin : dalles pleines (dit dans la note du panneau).
- Correctif 3D-7 (run 41732198060 rouge : « Cannot read properties of null (reading 'highlight') ») : deux
  reconstructions de la maquette pouvaient se croiser (attente du module de scène) ; `build` porte un numéro
  (`S3.gen`), n'attend plus qu'avant de toucher la scène, et la fiche d'une gaine vérifie que les gaines existent.
- Tests : smoke (étage créé avec ses murs, lumière liée à un interrupteur du RDC, empilé au-dessus des autres niveaux,
  pointillés, retour au niveau ouvert, nettoyage). Validation 3D-7 + 3D-10 : run 41734307163 vert (smoke 192/192).

## 03/11/2026 — 3D-7 élévations de murs (branche `feat/3d-1-visionneuse`)

- `src/3d/elevation.js` (pur) : `wallElevation(data, apps, rooms, segId, side, H)` = face d'un mur à plat, vue depuis
  la pièce (u = 0 au coin gauche de l'observateur) : longueur de la face (retrait de la demi-épaisseur d'un mur qui part
  de ce côté, prolongement jusqu'au coin extérieur d'un angle sortant), pièce de ce côté, ouvertures (allège / linteau),
  appareils de cette face avec leur distance au coin le plus proche et leur hauteur (* = hauteur de départ) ;
  `roomFaces(data, room)` (faces du contour tournées vers l'intérieur) ; `elevationDraw(E)` (primitives en mètres,
  partagées écran / PDF) ; `elevationSVG(E, {px})`.
- `src/ext/elevations-pdf.js` : `buildElevationsPdf(list, {chantier, level})` (jsPDF, A4 paysage, une élévation par page,
  1:20, 1:25, 1:50 ou 1:100 selon la place, cotes bleues, légende).
- 3D : clic sur un mur (rien d'autre sous la souris) → carte large : élévation de la face touchée (normale de la face,
  sinon côté de la caméra), « Autre face », « PDF de ce mur », « PDF de la pièce » (toutes ses faces intérieures),
  « Voir sur le plan » ; `ui.showWall(seg, side)`, `ui.elevPdf`, `ui.lastElev` (tests). Catalogue : `vue.3d.elevation`.
- Constat : le repère `a.wa` du plan (distance « depuis la face du mur d'angle ») retire la plus grosse demi-épaisseur du
  sommet, même celle d'un mur dans le prolongement (cas fréquent sur MAILLARD : 43 appareils sur 77, écarts de 3 à
  15 cm). Ce n'est pas corrigé dans le cœur (les appareils se replacent d'après `wa` : les corriger les déplacerait) ;
  l'élévation donne la vraie distance au coin de la face. À décider avec Kévin.
- Tests : v3d (face intérieure / extérieure, inversion gauche-droite, pièce, allège, cotes et hauteurs) + smoke (clic
  sur un mur, élévation, PDF à l'échelle, autre face, Ctrl+Z).

## 03/11/2026 — 3D-6 contrôles de pose (branche `feat/3d-1-visionneuse`)

- `src/3d/pose.js` (pur) `poseIssues(plan, apps, {pmr, H})` → `battant` (commande dans la bande du battant ouvert :
  côté charnière, face où la porte s'ouvre, longueur du battant + 10 cm, 25 cm de profondeur), `embrasure` (appareil
  mural dans la largeur ET la hauteur du vide d'une ouverture, à plus de 5 cm du tableau ; allège / linteau de
  Propriétés ou hauteurs de départ ; une prise sous l'allège est acceptée), `hauteur` (PMR : commande hors 90–130 cm,
  prise d'usage sous 40 cm, R-110 ; hors PMR : commande sous 60 ou au-dessus de 160 cm seulement). Conventions des
  portes reprises de render.js (`swing` ext = côté de la normale (-uy, ux), `hinge` d = vers le bout b).
- `src/core/check.js` : `posesAll()` (tous les niveaux) ajoutée à `controlIssues()` ; nouvelles sortes dans
  `CHECK_KINDS` (`POSE_KINDS`) : le compteur « à vérifier » les compte et y mène ; `controle-ui.js` : explication
  `it.text` quand l'anomalie en porte une (aussi pour les volumes de salle de bain et la VMC).
- 3D : `scene.js` `buildMarks` (anneau rouge clignotant face au mur, volumes 1 et 2 de la salle de bain en verre
  teinté) ; `vue3d.js` : liste `.v3d-pose` (poses à revoir + volumes de salle de bain), clic = caméra devant l'appareil
  + fiche avec l'explication (`.v3d-bad`), calque « Volumes de la salle de bain », mise à jour sur `okteo:control`.
- Constat sur MAILLARD (dessin de Kévin) : 24 poses signalées (surtout des commandes de volet et interrupteurs dans la
  largeur d'une fenêtre ou d'une porte, et 3 derrière un battant) : soit l'appareil, soit l'ouverture est mal placé ; les
  sens d'ouverture des portes relevées par l'IA sont souvent ceux par défaut (gond gauche, intérieur) : à corriger sur le
  plan pour que le contrôle du battant soit juste.
- Tests : v3d (cas d'école battant / embrasure / hauteurs / allège / charnière inversée) + smoke (compteur, 3D, fiche, Ctrl+Z).
  Validation : run 41731331613 vert (smoke 190/190, v3d 41, build:web, test:web).

## 03/11/2026 — 3D-5 gaines en 3D et passage par le sol (branche `feat/3d-1-visionneuse`)

Réponses de Kévin : la réserve en boîte est un réglage (elle existe déjà : Paramètres → Câblage → Longueurs,
« surlongueur côté boîte » `margeBoite`, et côté appareil `margeApp`) ; le passage par le sol est une propriété de la gaine.
- `src/cablage/gaines.js` : `box.sol = {appId | "tab": true}` → gaine `g.sol` ; longueur d'une gaine par le sol =
  traversée + hauteur sous plafond + hauteur de l'appareil (descente au sol puis remontée) au lieu de la descente du
  plafond ; alimentation par le sol : jusqu'au haut du tableau. La longueur de la bande suit.
- `src/ext/cablage-data.js` : `setGaineSol(api, boxId, keys, on)` (un Ctrl+Z, `api.setBoxes`), `gaineKeys(g)`.
- Propriété dans la fiche de la gaine sur le plan (carte « Pourquoi » d'une gaine sélectionnée, `.why-sol`) et dans la
  fiche de la gaine en 3D (`.v3d-sol`).
- `plan3d.js` : `gainePath({box, route, end, sol, H, wall})` (tracé du plan en traits droits, points de passage
  `box.routes`, au-dessus du plafond, descente verticale dans le mur ; par le sol : descente dans le mur le plus proche
  de la boîte hors passage `nearestWall`, dalle, remontée) ; `scene.js` `buildGaines` (tube couleur de la boîte
  `boxColor`, double clair visible à travers les murs, tube invisible pour le clic, `highlight`).
- `vue3d.js` : gaines calculées par `wiringNow(api)` (mêmes n° et longueurs que les bandes) ; calques « Gaines » et
  « Gaines visibles à travers les murs » ; clic sur une gaine → fiche (n°, appareil, longueur de la bande, tracé 3D,
  diamètre, passage) + « Voir sur le plan » ; clic sur une boîte → ses gaines ; reconstruction sur `okteo:cab`.
- Tests : v3d (tracés plafond / sol / plafond d'un point lumineux, descente hors porte, longueur de la bande par le sol)
  + smoke (gaines dessinées, fiche, « Passage par le sol » → plus longue et dans la dalle, Ctrl+Z).
- La case « Passage par le sol » rend la main dès qu'on la coche (Ctrl+Z est ignoré dans un champ). Test de la visite :
  sortie par la pause (« Quitter la visite »). Validation : run 41727704875 vert (smoke 189/189, v3d, build:web, test:web).

## 03/11/2026 — 3D-4 visite à pied et pose au viseur (branche `feat/3d-1-visionneuse`)

- `src/ext/vue3d-walk.js` (`createWalk({api, S3, el, cv})`) : bouton « Visite à pied · ZQSD » (`.v3d-walk`) du panneau 3D ;
  ZQSD = touches physiques (WASD en QWERTY), flèches, Maj = courir, souris (verrouillage du pointeur, sinon glisser) ;
  collisions sur les murs du plan nettoyé (passages = ouvertures dont l'allège est au sol) ; départ au nom de la plus
  grande pièce ; plafonds affichés pendant la visite. Outils 1–6 / molette : prise PC16, interrupteur, RJ45, point
  lumineux (au plafond), applique, gomme ; hauteur normale du type (`api.TYPES[t].h`) ou hauteur visée (H) ; aperçu vert,
  raison affichée sinon. Pose = `api.importDevices([...], [], {stay: true})` (nouvelle option du cœur : on reste sur
  l'onglet et l'outil) → vrai appareil, recollé à son mur (`snapToWall` + `attach`), un Ctrl+Z ; gomme =
  `api.removeApps([id])`. Les touches de la visite sont capturées avant les raccourcis du plan (Ctrl+Z passe).
  Échap : pause (reprendre / quitter) ; quitter l'onglet quitte la visite. Catalogue `vue.3d.visite`.
- Test smoke : marcher, poser une prise (rattachée, onglet 3D conservé), Ctrl+Z, gomme, Échap.
- Validation 3D-3 + 3D-4 : run 41721996246 vert (check complet dont smoke 188/188, v3d 30/30, build:web, test:web 15/15).

## 03/11/2026 — 3D-3 hauteurs réglables (branche `feat/3d-1-visionneuse`)

« 3 et 4 go » de Kévin. Hauteurs de la vue 3D : valeurs de départ réglables, et réglage une par une.
- `src/prefs.js` : `h3dPlafond` 250, `h3dAllege` 90, `h3dLinteau` 215, `h3dPorte` 204, `h3dBaie` 215, `h3dGarage` 220
  (cm, préférences de ce PC). Paramètres : section « Vue 3D » `#ps-3d` (`[data-h3d]`), dans le sommaire.
- Propriétés : ouverture → « Allège » (fenêtre) et « Haut. linteau » (`#oal`, `#oli` → `o.allege`, `o.linteau` en cm,
  vide = valeur de départ, un Ctrl+Z) ; pièce → « Sous plafond » (`#rhsp` → `r.hsp` en cm).
- `plan3d.js` : `heightsFrom(prefs)` → hauteurs en m (boîtes 35 cm au-dessus du plafond), `cleanPlan(data, tol, H)`,
  mur `top` = la plus haute pièce qu'il borde (`r.cycle`), `wallPrisms` jusqu'à `top`, lumière au plafond de sa pièce ;
  `cut` par défaut illimité. `scene.js` : `H`, plafonds par pièce (`house.ceilings`, cachés hors visite).
- `vue3d.js` : `planData` → `segs[].top`, `openings[].allege/linteau` (m), `apps[].hsp`, `rooms[].hsp`, `H` ; la coupe
  va jusqu'au plus haut mur ; texte des hauteurs de départ + « Régler… » (→ Paramètres, Vue 3D) ; reconstruction sur
  `okteo:prefs` (clés `h3d*`).
- Tests : v3d (hauteurs de départ, fenêtre réglée, mur à 2,80 m, lumière sous son plafond) + smoke (Paramètres → 3D,
  fenêtre réglée, champs de Propriétés).

## 03/11/2026 — 3D-1 visionneuse 3D + 3D-2 géométrie propre (branche `feat/3d-1-visionneuse`, pas encore dans `main`)

« GO 3d1 ET 2 » de Kévin. Les deux mises à jour sont livrées ensemble sur la même branche (la visionneuse a besoin du
nettoyage de la géométrie pour être propre sur de vrais plans).
- `src/3d/plan3d.js` (pur, sans DOM ni three.js) : `H3D` (valeurs de départ : sous plafond 2,50, allège 0,90, linteau
  2,15, porte 2,04, baie 2,15, garage 2,20, boîtes à 2,85 dans les combles ; réglables en 3D-3), `cleanPlan(data)`
  (3D-2 : sommets à moins de 2 cm fusionnés, murs nuls retirés, murs en double gardés une fois, bout libre arrêté à moins
  de 8 cm de la face d'un mur recollé en T ou en angle, murs qui se croisent sans sommet coupés, chevauchements et bouts
  libres à moins de 30 cm signalés, ouvertures plus larges que leur mur ou qui se chevauchent signalées ;
  `defects [{kind, level info|warn, text, x, y, ids}]`), `wallEnds` (onglets aux angles, coupes en T), `wallPrisms`
  (un volume par morceau plein, allèges, linteaux, coupe « maison de poupée » ; coin d'onglet borné quand une ouverture
  touche un angle), `openingParts` (vitrages, battants à 70° côté charnière / sens du dessin), `devicesOf` (appareil mural
  plaqué contre la face de son mur, normale, hauteur du dessin ou valeur de départ `defH`, plafond pour LUM/SPOT…),
  `prismIssues` (contrôle des volumes), `planBounds`. Le dessin n'est JAMAIS modifié : le nettoyage ne sert qu'au rendu.
- `src/3d/scene.js` : `buildHouse(THREE, {plan, rooms, devices, boxes}, {cut, contrast})` (three.js passé en paramètre) :
  murs contrastés (façade pierre, cloison gris bleuté, doublage, plinthe 8 cm, faces orientées, bas assombri), dessus des
  murs bleu nuit, arêtes, sols par pièce (pièces d'eau en gris-vert), noms de pièces, appareils à leur hauteur colorés par
  circuit, boîtes `LIxx` dans les combles ; `setCut(h)`, `pick` (clic), `dispose`.
- `src/ext/vue3d.js` : onglet « 3D » (`#tabs button[data-tab="vue3d"]`, page `#vue3d`, Alt+4, catalogue `vue.3d`, étape
  de la visite : 28 étapes) ; `planData(api)` lit `api.state` + `exportGeometry()` sans rien modifier ; three.js 0.169.0
  (MIT) chargé à la première ouverture ; vues Ensemble / Dessus, coupe 0,90–2,50 m, calques (murs contrastés, appareils,
  boîtes) ; clic sur un appareil → fiche (repère, pièce, hauteur, « valeur de départ ») + « Voir sur le plan »
  (`api.select` + `api.zoomTo`) ; reconstruction sur `okteo:saved` / `okteo:level` quand l'onglet est ouvert ; boucle
  d'affichage arrêtée quand l'onglet est caché. 3D-2 : liste repliable « points de géométrie » (⚠ à vérifier / ⓘ corrigé
  pour la 3D), un clic sélectionne les murs concernés sur le plan ; pièce au contour hors du bâtiment = pas de sol, signalée.
- Tests : `scripts/v3d.test.mjs` (dans `npm run check`) : cas d'école (jonction à 4 cm, mur en double, 2 croisements,
  muret à 20 cm, fenêtre trop large, porte contre l'angle) + MAILLARD (dessin du BE, 22 ouvertures, 77 appareils muraux)
  + relevés IA MAILLARD et PASQUIER + EVRARD (murs relevés dans le PDF, si pdf.js installé) : aucun volume faux, coupe à
  1 m. Les 4 chantiers FTZ n'ont pas de murs (positions schématiques, fonds scannés) : non testés en 3D. Smoke : 2 tests
  (onglet 3D, fiche, « Voir sur le plan », coupe ; défaut signalé et cliquable).
- Dépendance : `three` 0.169.0 (MIT). Workflow TEMPORAIRE `.github/workflows/verification-3d.yml` (complète le verrou
  npm) : à retirer avant fusion.
- Banc local (sans npm) : rendu vérifié sur MAILLARD avec three.js r169 hors dépôt (aucune erreur, fiche au clic).
- Validation : run 41717413720 vert (licences : three 0.169.0 MIT, 84 paquets permissifs ; v3d 26/26 dont EVRARD 35 murs,
  83 volumes, 18 ouvertures sur 18 ; check complet dont smoke 186/186 ; build:web ; test:web 15/15).

## 03/11/2026 — v76 fusionnée dans `main` ; feuille de route 3D décidée

- « go v76 » de Kévin : branche `feat/analyse-ia-modes-v76` fusionnée dans `main` (avance rapide, aucun changement de
  `main` entre-temps). Workflows temporaires `verification-v76.yml` et `raster-v76.yml` retirés. Code validé par le run
  41669930082 (check complet dont smoke 184/184, build:web, test:web 15/15).
- 3D (discussion du 03/11, maquette de démonstration en artefact, maison fictive, aucune donnée client) : décidé de faire
  une vue 3D construite depuis le dessin, en 11 mises à jour, TOUTES avant l'essai sur chantier, dans l'ordre
  3D-0 (maquette téléphone, artefact seul) → 3D-1 visionneuse dans Oktéo (`src/3d/`, three.js MIT chargé à la demande)
  → 3D-2 géométrie propre sur plans réels → 3D-3 hauteurs (valeurs de départ 2,50 / 0,90 / 2,15 / 2,04 m, réglables dans
  Paramètres, section 3D, et par pièce / ouverture) → 3D-4 visite à pied + pose au viseur → 3D-5 gaines en 3D et longueurs
  → 3D-6 contrôles en 3D → 3D-7 élévation de mur → 3D-10 étages → 3D-8 page téléphone par QR de feuille → 3D-9 essai.
- Règles données par Kévin : une gaine suit le tracé du plan en traits droits (la courbe du 2D est esthétique), au-dessus
  du plafond, en diagonale si besoin, puis descend dans le mur jusqu'à l'appareil ; passage par le sol à prévoir (pas
  encore dans le plan) ; gaines visibles en transparence dans les murs (option). QR code : un par face imprimée du plan,
  contenant exactement ce qui y est imprimé (pas sur le QR de la boîte), données dans le `#` (rien sur le serveur), aucun
  nom ni adresse ; capacité d'un QR mesurée pendant 3D-8, décision ensuite.
- Encore attendu de Kévin avant 3D-5 : réserve en boîte, façon de désigner une gaine par le sol (gaine, type, pièce).

## 03/11/2026 — v76 : écran « Analyse IA » sur une seule page

Branche `feat/analyse-ia-modes-v76`, demande de Kévin : tout l'écran des modes tient sur une page (plus de défilement de
la page) ; un texte trop long défile DANS sa carte.
- `.am-in` = hauteur de la fenêtre ; tailles du titre, des textes, des marges et du bouton en `clamp(…vh…)` ; la grille
  prend la place restante (`grid-auto-rows: minmax(0, 1fr)`) ; carte = en-tête, titre, accroche, puis zone `.am-scroll`
  (description, « Recommandé pour », mention « En préparation ») qui défile, et ligne « Durée / coût » toujours visible ;
  dégradé en bas de la zone + infobulle « Faites défiler… » quand il reste du texte (`.am-scroll.more`).
- Carte = `div role="button" tabindex="0"` (aria-pressed, Entrée / Espace) au lieu de `<button>` : le contenu d'un
  bouton ne défile pas dans tous les navigateurs.
- Corrigé au passage : `.am-reco` servait au bandeau de recommandation ET au texte « Recommandé pour » des cartes (qui
  prenait le fond du bandeau) → texte des cartes en `.am-recotxt`.
- Téléphone (< 640 px) ou fenêtre très basse (< 520 px) : 4 cartes ne tiennent pas sur un écran, la page défile.
- 4 colonnes jusqu'à 900 px de large (en 1100 × 800, 2 rangées de cartes cachaient la ligne « Durée / coût » :
  1er essai, run 41669226007) ; 2 colonnes en dessous (tablette en hauteur) ; en-têtes et pied des cartes jamais écrasés.
- Validation : run 41669930082 vert (chemin des scans, check complet dont smoke 184/184, build:web, test:web 15/15).
- Tests : smoke « l'écran des modes tient sur une page » (1500 × 900, 1366 × 768, 1280 × 720, 1100 × 800, mode 4 et
  ses documents compris ; « Durée / coût » visible dans chaque carte ; Entrée choisit) ; captures 1366 × 768 et 1280 × 720.

## 03/11/2026 — v76 mode 3 : OpenCV.js dans un Web Worker (gel de la page corrigé), vérifications bornées

Branche `feat/analyse-ia-modes-v76`.
- Cause du gel (vérifications 41625086289 et 41633481383 arrêtées à 60 min) : le module d'OpenCV.js est « thenable » ;
  `loadCv` résolvait une promesse AVEC lui, ce qui le fait relire sans fin (boucle de micro-tâches : page figée, aucun
  délai ne pouvait se déclencher). Correction : `src/ext/ai-cv-worker.js` (OpenCV.js dans un Web Worker : `ping`,
  `skew`, `clean` ; module rendu emballé `{ cv }` ; Promise ou `onRuntimeInitialized` comme dans la doc de
  @techstark/opencv-js) ; ai-raster.js parle au worker (`cvWorker`), délai par appel (chargement 150 s, mesure et
  nettoyage 60 s), worker arrêté s'il ne répond pas → l'analyse continue avec l'image d'origine (signalé). Étapes
  écrites dans la console (`[okteo mode 3] …`, `rasterState`).
- Vérification courte `scripts/raster.browser.mjs` (workflow temporaire `raster-v76.yml`, quelques minutes) : run
  41646903138 vert — OpenCV.js prêt en 1 s, inclinaison mesurée 1,93° pour 2° appliqués, copie nettoyée, OCR
  « CUISINE » / « CHAMBRE » lus sur l'origine ET la copie (96 %), 3 s en tout.
- Smoke : limite de 6 min par vérification imposée depuis Node (rechargement de la page après un dépassement) ; la page
  d'attente (« Votre plan est prêt ») est fermée comme par l'opérateur après une analyse longue (elle recouvrait l'écran
  et faisait échouer la suite). Run 41644689440 : smoke 183/183, build:web, test:web 15/15.
- Validation complète sur le dernier code : run 41647151360 vert — chemin des scans (OpenCV.js + Tesseract.js), check
  (modes 21, murs 42, câblage 87, chantiers 176, MAILLARD 14, smoke 183/183), build:web, test:web 15/15.
  Reste avant fusion (sur « go » de Kévin) : retirer les workflows temporaires verification-v76.yml et raster-v76.yml.

## 03/11/2026 — v76 fonctions complémentaires : recommandation de mode, escalade, banc d'essai

Branche `feat/analyse-ia-modes-v76`.
- Mode 3, vérification de l'étape 3 : le plan EVRARD des tests est un PDF VECTORIEL ; le mode 3 y a bien fait ce que
  la règle demande (aucun nettoyage, textes du PDF) — c'est le test qui supposait un scan. Deux tests à la place :
  mode 3 sur PDF vectoriel (une image par tuile, textes « (texte du PDF) », pas d'OpenCV), et chemin des scans avec le
  vrai OpenCV.js + Tesseract.js sur une image de test inclinée de 2° (angle mesuré, copie nettoyée, « CUISINE » lu).
  Licences : 83 paquets livrés, tous permissifs (ISC / 0BSD / Zlib listés comme équivalents) ; /vendor : OpenCV
  10,4 Mo, OCR 31,3 Mo (moteurs SIMD / non SIMD + fra), chargés seulement en mode 3.
- Recommandation : `src/walls/ai-stats.js` (pur, `imageStats` : contraste 95e − 2e centile, encre, bruit, inclinaison
  par profil de projection ±4°) ; `ai-modes.js` `RECO_SEUILS` (premiers seuils, à régler au banc d'essai),
  `recommend(stats)` (scan incliné / pâle / bruité → 3 ; faible définition / dense → 2 ; sinon 1 ; autres pages du PDF
  signalées pour le mode 4) ; `src/ext/ai-reco.js` (`planStats`, `recommendFor`). Écran : bandeau `.am-reco` + étiquette
  « Recommandé » ; « Choisir ce mode » (`#am-reco-ok`) ne choisit qu'au clic : rien n'est sélectionné d'office. À l'import
  d'un plan (`okteo:fond`) : recommandation dans la barre d'aide.
- Escalade : `escalade({mode, rest, initial})` (≥ 3 alertes restantes, ou ≥ 30 % de celles du départ ; jamais au-delà
  du mode 4) ; fin de la boucle de relecture : message + `#rk-up` « Relancer en mode N… » → `okteo:ai-escalade` →
  écran des modes avec « Relance proposée » (étiquette « Proposé »). `recheck.last.escalade`.
- Banc d'essai : `src/walls/ai-bench.js` (pur : `devicesOf` (.okteo tous niveaux ou JSON), `score` (même niveau, même
  famille, 30 cm : rappel, omissions, faux positifs, précision, types justes, omis / en trop, par type), `journalOf`,
  `benchLine`) ; `scripts/modes-bench.mjs` (`--verite`, `--tol`, `--csv`, `--categorie`, `--detail`) ; protocole
  `docs/banc-essai-v76.md` (9 plans pour commencer : vectoriel, scan net, scan dégradé ; vérité validée par le BE).
  Essai à blanc : MAILLARD comparé à lui-même = 102/102.
- Tests : ai-modes.test.mjs 21 ; smoke : recommandation + escalade.
- Non mesuré : les seuils de recommandation et d'escalade sont des valeurs de départ, à régler avec le banc d'essai.

## 03/11/2026 — v76 étape 4 : mode 4 « Analyse approfondie » (seconde lecture, contrôle croisé)

Branche `feat/analyse-ia-modes-v76`. Licences : `scripts/licences.mjs` lit les expressions SPDX « AND » (pako = MIT AND
Zlib, dépendance de pdf-lib) ; Zlib signalé comme équivalent permissif. Déclarées : tesseract.js Apache-2.0,
@techstark/opencv-js Apache-2.0, @tesseract.js-data/fra MIT (paquet ; données tessdata Apache-2.0).
- `src/walls/ai-cross.js` (pur) : `SECOND_METHOD` (seconde lecture indépendante, pièce par pièce), `planSummary`
  (décompte par type et par pièce la plus proche, approximatif), `summaryText`, `crossPrompt` (équipements cités dans
  les documents absents du plan ou en quantité différente, source + extrait < 15 mots, rien d'inventé), `parseCross`
  (quantités égales écartées, 60 écarts au plus), `CROSS_OFF`.
- `src/ext/ai-cross.js` : `secondReading` (plan entier rendu à la meilleure définition permise), `otherPages(api)`,
  `gatherDocs(api, fichiers)` (autres pages du PDF du chantier hors pages de plan des niveaux + PDF / images joints ;
  texte pdf.js, page sans texte envoyée en image ; 10 sources, 6 images, 6 000 caractères par page, 30 000 au total),
  `crossCheck` (un appel ; sans document → partie désactivée, message `CROSS_OFF`).
- ai-modes-run.js : mode 4 = mode 3 + seconde lecture (fusionnée, écarts « 2e » : vu par elle seule / non vu par elle)
  + contrôle croisé (`plan.docEcarts`, journal `docs`). Carte de l'aperçu : « Contrôle croisé avec les documents ».
- Écran des modes : mode 4 choisi → bloc `.am-docs` (autres pages du PDF comptées, `#am-docs-file` pour joindre devis /
  plan cuisine, `.am-chip` retirables) ; les documents restent sur le PC, seul leur contenu part à l'IA.
- Tests : ai-modes.test.mjs 17 (+ contrôle croisé) ; smoke mode 4 (PDF joint, seconde lecture, écarts « 2e », écart
  « Lave-vaisselle » du devis affiché).
- Non mesuré : taux d'équipements oubliés retrouvés ; justesse du décompte par pièce (pièce la plus proche).

## 03/11/2026 — v76 étape 3 : mode 3 « Plan dégradé » (OpenCV.js, Tesseract.js)

Branche `feat/analyse-ia-modes-v76`. Étape 2 validée : GitHub Actions run 41623306045 (smoke 180/180, test:web 15/15).
- Dépendances (licences vérifiées automatiquement à chaque vérification par `scripts/licences.mjs`, ajouté à `npm run
  check` : toute dépendance livrée doit être MIT, Apache-2.0 ou BSD ; ISC / 0BSD signalés comme équivalents ; AGPL / GPL /
  licence commerciale et Scribe.js refusés) : `tesseract.js` 5.1.1 (Apache-2.0, avec `tesseract.js-core`),
  `@tesseract.js-data/fra` 1.0.0 (données tessdata, Apache-2.0), `@techstark/opencv-js` 4.10.0-release.1 (OpenCV, Apache-2.0).
  Le verrou npm est complété par la vérification GitHub (npm refusé dans la session de développement).
- `scripts/vendor-ia.mjs` (`npm run vendor`, lancé par dev / build / build:web / check) : copie OpenCV.js, le worker et
  le moteur Tesseract, `fra.traineddata.gz` et leurs licences dans `public/vendor/` (non versionné) : servis par
  okteo-ai.pages.dev, jamais par un CDN. Worker : CSP `'wasm-unsafe-eval'`, `/vendor/*` gardé un jour.
- `src/ext/ai-raster.js` : `loadCv` (attend `cv.Mat`, jamais `await cv`), `skewAngle` (médiane des longs traits ±5°),
  `cleanTile` (redressement si ≥ 0,3°, CLAHE 2,0, médian 3 × 3 ; aucun seuillage ni érosion), `mergeOcr` (pur : même
  texte à 15 px = « both », confiance < 30 % écartée), `createRaster()` → `prepare(R)` → {images : ORIGINE puis
  NETTOYÉE, rot, ocr (positions dans l'image nettoyée), cleaned}. OCR (PSM 11, texte épars) sur l'origine ET la copie.
  OpenCV absent → image d'origine seule + OCR, signalé dans le journal.
- ai-modes-run.js : mode 3 raster = OpenCV + OCR par tuile ; mode 3 sur PDF vectoriel = pas de nettoyage, textes de la
  tuile pris dans le PDF (`chantierTexts`, unités de page × s0). Points de Claude sur l'image redressée ramenés dans
  l'image d'origine (`unrotate`, convention OpenCV vérifiée par un test) avant la conversion en mètres. Journal :
  `nettoyees`, `ocrMots`, angle ; « Refaire » relance le même mode (`aiReleve.setAgain`).
- Tests : ai-modes.test.mjs 16 (+ OCR comparé, convention de rotation) ; smoke mode 3 sur le plan EVRARD (raster) avec
  le vrai OpenCV.js et le vrai Tesseract.js.
- Non mesuré : gain sur de vrais scans dégradés (inclinés, bruités) et temps de l'OCR selon le PC ; CSP avec OpenCV.js
  à vérifier sur la version de test Cloudflare (les tests tournent sous Vite, sans la CSP du Worker).

## 03/11/2026 — v76 étape 2 : mode 2 « Analyse renforcée » (tuiles, zoom à la demande, cache de prompt)

Branche `feat/analyse-ia-modes-v76` (« go » de Kévin pour les étapes 2, 3, 4 à la suite). Écran des modes : cartes du
rose pâle au rouge foncé (planche de Kévin), coche nette — la règle générale `svg{background:var(--bg);width:100%}`
colorait le fond de l'icône (carré sombre) ; `.am svg` l'annule.
- Vérifié dans la doc officielle (03/11/2026) : images ≤ 1 568 px / ~1,15 Mpx (au-delà réduites sans gain), > 20 images
  = 2 000 px ; cache Opus 5.5 : 512 tokens au moins, écriture 5 min 1,25 × (5 USD/Mtok), lecture 0,05 × (0,20 USD),
  4 marques au plus, entrée disponible seulement après le début de la 1re réponse (d'où : 1re tuile seule, puis les
  autres en parallèle). `src/ai-config.js` : `ANALYSE_PRICE` + `cacheWrite`/`cacheRead`, `CACHE_RATIO`, `IMAGE_LIMITS`.
- `src/walls/ai-tiles.js` (pur) : `chooseGrid` (auto 4 × 3 / 3 × 4 / 3 × 3, ou réglage), `tileGrid` (recouvrement 8 %,
  `core` = zone propre), `fitSize` (jamais d'agrandissement d'un scan ; PDF vectoriel rendu plus fin), `regionMap`,
  `toMeters`/`toPixels`, `unrotate` (mode 3), `tileRules` (consigne fixe, mise en cache) / `tilePrompt` / `zoomPrompt`,
  `parseZooms` (bornés, 24 px mini, 3 par tuile), `tileToDevices` (aiToPlan avec la map de la tuile), `mergeReadings`
  (doublons des recouvrements réunis à 0,3 m même famille ; type lu en tuile dans sa zone propre remplace celui de la
  lecture globale, gardé dans `aiTypeGlobal` + `a_confirmer` ; rien supprimé ; écarts `ajout` / `type` / `seul-base`),
  `ecartsCount`.
- `src/ext/ai-render.js` : `planSource(api)` → source { kind vector|raster, iw, ih, srcMap, box (bords du dessin),
  render(région, {maxSide, maxPixels, minSide}) } ; vectoriel = page pdf.js rendue sur la région (viewport décalé),
  raster = pixels du fond (JPEG d'import), zooms d'un scan agrandis à 400 px au plus pour l'API et dits « sans détail
  ajouté ». Le PDF n'est utilisé que si son rapport largeur/hauteur est celui du fond.
- `src/ext/ai-modes-run.js` : `createModeRunner({api, aiReleve})` → `okteoExt.aiRunner.run(mode, {docs})` : lecture
  globale (celle du mode 1) puis tuiles (1re seule, puis `tuilesParallele` en même temps ; 429 → une reprise après 4 s),
  zooms dans la même conversation (tuile en cache), fusion, `aiReleve.fromPlan` (même aperçu, mêmes cases, un Ctrl+Z),
  Arrêter. Tuile en échec : signalée, la zone garde la lecture globale. Journal : `zones`, `zooms`, `tuilesKo`, `grille`,
  `source`, `ecartsN`, `appels` [{phase, tuile, ms, tin, tout, cw, cr}], `cw`/`cr` ; `cab.releves[lv].ecarts`.
- ai-releve.js : `prepare({needClaude})` (plan, clé, Claude obligatoire pour les modes 2 à 4, échelle), `fromPlan`,
  `show`/`message`/`setBusy` exposés ; carte : « N écarts entre lectures » (`.ai-ecarts`, bouton Voir = zoom).
  ai-recheck-ui.js : `cyclesFor(mode, réglage)` (ai-modes.js) : 3 relectures pour les modes 2 à 4, réglage pour le 1.
- ai.js : `m.blocks` (blocs API passés tels quels), usage `cw`/`cr` ; journal : `tinOf`, `callCost` avec cache, `addUsage`.
- Worker : `systemOf` (texte ou ≤ 4 blocs), `cache_control` {type:'ephemeral'} seul (pas d'1 h), 4 marques au plus,
  coût = entrée + écriture 1,25 × + lecture 0,05 × + sortie (`CACHE_RATIO`) ; CSP des pages connectées :
  `'wasm-unsafe-eval'` ; `/vendor/*` gardé un jour par le navigateur (pour l'étape 3).
- Paramètres (section IA) : `#pref-grille` (`grilleIA`), `#pref-parallele` (`tuilesParallele`, 2), `#pref-zooms`
  (`zoomsIA`, 12). `concurrent_limit` de production inconnu : régler « Tuiles envoyées en même temps » dessus.
- Tests : ai-modes.test.mjs 15 (grille, tailles, repères aller-retour, zooms, fusion, cache, cycles, consignes) ;
  web.test (+1 cache) ; smoke mode 2 de bout en bout (faux serveur : tuiles, zoom, cache, fusion, journal, Ctrl+Z).
- Non mesuré : gain de détection, durée et coût réels (dépend du plan, de la grille et des zooms) ; à mesurer avec le
  banc d'essai (étape 7). `ai-raster.js` / `ai-cross.js` : emplacements des étapes 3 et 4.

## 03/11/2026 — v76 étapes 0 et 1 : modèle d'analyse verrouillé, journal d'analyse, écran « Analyse IA » (4 modes)

Branche `feat/analyse-ia-modes-v76` (accès en écriture limité à cette branche, rien sur `main` sans « go »). Mission :
4 modes d'analyse IA (standard, renforcée, plan dégradé, approfondie). Constats de départ (lecture du dépôt) : la
« lecture par quarts » et la légende n'existent que dans la consigne (`ai-plan.js` `method`) ; Claude reçoit une seule
image ≤ 1 568 px (l'API réduit au-delà, doc Vision vérifiée le 03/11/2026) ; le Worker refuse outils et `cache_control`
(autorisation de Kévin d'ouvrir `cache_control` à l'étape 3 ; zoom = demandes dans le JSON, sans outils) ; relectures
automatiques = réglage 0–3, 2 par défaut.
- Étape 0 : `src/ai-config.js` (`ANALYSE_MODEL` = `claude-opus-5-5`, `ANALYSE_PRICE` 4 / 20 USD) importé par `ai.js`,
  `server/worker.js` (regroupé par esbuild) et `src/web/workspace.js`. `modelFor(…, "analyse")` ignore tout ancien
  réglage `anthropicAnalyse` ; champ `.ma` de Paramètres remplacé par `.ma-lock` (lecture seule). Worker : `pricing`
  renvoie toujours `ANALYSE_MODEL` pour l'analyse (même si `config.analysis_model` dit autre chose) ; `/api/admin/config`
  refuse un `analysis_model` différent (400), garde les prix d'analyse ; fenêtre Budget : modèle affiché « verrouillé ».
  La conversation de l'assistant (Sonnet) est hors périmètre, inchangée.
- Journal d'analyse : `src/walls/ai-journal.js` (pur : `newAnalyseId`, `callCost` (coût du Worker sinon tarif public),
  `analysesOf(releve)`, `fmtUsd`, `fmtMs`). Rien de stocké à part : l'élément `releve` du rapport porte
  `analyse {id, mode}`, `ms`, `usd` ; chaque `relecture` porte `analyse` (id), `usd`, `reste` (points encore signalés).
  `chat()` renvoie `usage.usd` en ligne (`body.okteo.cost`). Étude → rapport IA : ligne `.ia-journal` par analyse
  (mode, appels, durée, tokens, coût estimé, zones, zooms, alertes avant → après, écarts proposés « à valider »).
  Message d'attente du relevé : affiche maintenant le vrai modèle d'analyse (il montrait le modèle de conversation).
- Étape 1 : `src/walls/ai-modes.js` (pur : `MODES_IA` textes validés, `pts`, `ready`, `cycles` null = réglage pour le
  mode 1 / 3 pour les modes 2 à 4, `MODES_PAGE`, `dossierRef`, `dotsLabel`, `launchState`) + `src/ext/ai-modes-ui.js`
  (`createAiModes({api, aiReleve})`, `okteoExt.aiModes` : `open/close/select/launch`, `selected`, `launched`, `visible` ;
  `#ai-modes.am`, cartes `.am-card[data-mode][aria-pressed]`, `.sel`, `.soon`, `#am-go[aria-disabled]`, Échap, flèches).
  Maquette page 8 suivie (fond #04284A, grille de 4, coche, bordure corail, 4 points, mention, bouton) ; référence du
  dossier dynamique (nom · numéro) ; titre et introduction en tailles souples (`clamp`) ; 2 colonnes < 1180 px, 1 < 640 px.
  `LOGO` exporté par `attente.js`. Entrées : `#rv-ai` (libellé « ✦ Analyse IA ») et `#ia-rel` du Mode IA ;
  `hooks.aiReleve` (catalogue `releve.ai`) ouvre aussi l'écran ; « Analyser le plan » de l'assistant inchangé.
  Mode 1 → `aiReleve.open({mode: 1})` : flux v75 inchangé. Modes 2 à 4 : sélectionnables, « En préparation »,
  lancement grisé. Visite : texte du menu Relevé mis à jour.
- Tests : `scripts/ai-modes.test.mjs` (6, pur, ajouté en tête de `npm run check`) ; web.test.mjs (+1 : modèle verrouillé,
  refusé s'il diffère, ignoré même écrit en base, prix réglables) ; smoke : nouvel écran (« v76 : Analyse IA… »), relevé
  par l'IA passé par l'écran (mode 1, journal `analyse.mode` = 1, modèle Opus), test v75 des modèles adapté.
  `scripts/shots-v76.mjs` (captures 1440 / 1920 / 1100 / 390 px). npm bloqué dans la session de développement
  (refus 403 du proxy) : vérification par le workflow TEMPORAIRE `.github/workflows/verification-v76.yml` sur la
  branche elle-même (à retirer avant fusion).
- Non mesuré : rien de nouveau à mesurer à ce stade (le mode 1 est le flux v75) ; points durée / coût = niveaux relatifs.
- Validation GitHub Actions run 41619410480 : `npm run check` vert (modes 6, murs 42, câblage 87, chantiers 176, MAILLARD 14,
  smoke 179/179), `build:web` et `test:web` 14/14. Le test smoke « outil Liaison : clic sur une commande… » échouait par
  moments (déjà avant v76, run 41547204988) : le clic visant la lumière tombait sur le trait de la liaison et faussait toute
  la suite ; il cadre maintenant la vue sur la commande et sa lumière, puis remet la vue.

## 03/11/2026 — v75 (suite) : Sonnet pour la conversation, Opus pour l'analyse

v75 (micro + modèles) fusionnée dans `main` sur « go and push » de Kévin (GitHub Actions : check complet, smoke 178/178,
test:web 13/13).

- `ai.js` : `PROVIDERS.anthropic.analyseModel` = `claude-opus-5-5`, `modelFor(provider, purpose)` ; `chat({purpose})` :
  `"chat"` (conversation de l'assistant, Sonnet 5.5) ou `"analyse"` (« Analyser le plan », relevé IA, relectures ciblées :
  Opus 5.5). En local : réglages `models.anthropic` (conversation) et `models.anthropicAnalyse` (champ `.ma` dans
  Paramètres → Claude). En ligne : le client envoie seulement `purpose` ; le Worker choisit (`pricing(c, purpose)`) :
  `config.model` pour la conversation, `config.analysis_model` (Opus par défaut) pour l'analyse, chacun à son tarif
  (Opus 5.5 : 4 / 20 USD par million de tokens par défaut) ; colonnes `analysis_*` ajoutées à la première sauvegarde du
  budget (`analysisColumns`, pas de migration à lancer) ; fenêtre Budget de l'administrateur : 3 champs de plus.
  `purpose` n'est jamais transmis à Anthropic. En-tête de l'assistant : « sonnet · analyse opus ».
- Tests : web.test.mjs (+1 : modèle et tarif par usage, réglage admin), smoke « IA (v75) ».

## 03/11/2026 — v75 : micro dans l'assistant (dictée)

Branche `feat/assistant-micro-v75`.
- `src/ext/micro.js` (`createMicro({onText, onState, lang, win})`, `speechCtor`, `MIC_ERRORS`) : reconnaissance de la
  parole du navigateur (Web Speech API, `fr-FR`, continue, phrases provisoires) ; Chrome / Edge / Safari récent, pas Firefox
  (bouton grisé avec explication). Aucune clé ni serveur Oktéo : le navigateur envoie le son à son propre service.
- Assistant : bouton `.as-mic` (🎤, rouge et pulsé pendant l'écoute, `aria-pressed`), message `.as-mic-msg` (micro
  refusé, rien entendu…), le texte dicté s'ajoute à ce qui est déjà écrit ; recliquer ou Échap arrête ; finir la phrase
  par « envoie » envoie la question. Raccourci **Alt+V** (main.js `hooks.dictate`, ouvre l'assistant) ; Alt+D n'est pas
  pris car le navigateur l'utilise (barre d'adresse). Catalogue `ai.dictee`. API : `okteoExt.assistant.micro`, `dictate()`.
- Pas de `Permissions-Policy` dans le Worker : le micro reste autorisé sur okteo-ai.pages.dev (HTTPS).
- Tests : `scripts/micro.test.mjs` (3, fausse reconnaissance, ajouté à `npm run check`), smoke « assistant (v75) ».

## 03/11/2026 — v74 MAJ 4 et 5 : plan pieuvre et page 2 équipements aux couleurs du BE

Branche `feat/plan-ftz-v74`, fusionnée dans `main` sur « go and push » de Kévin (GitHub Actions : check complet, smoke
176/176, test:web vert).
- `src/print/ftz-symbols.js` (pur) : `BOX_COLORS` / `boxColor(n)` (ordre verrouillé : LI01 rouge, LI02 vert, LI03 magenta,
  LI04 bleu, LI05 noir, LI06 orange, LI07 violet, puis le cycle recommence), `symIndex(charte)`, `ftzSymbol(idx, t, h)`
  (via `FTZ_NAMES`, prise haute si h ≥ 100), `plaques(apps)` (commandes / prises du même mur à moins de 25 cm → plaque
  double ou triple, verticale si les hauteurs diffèrent de plus de 20 cm ; une boîte PROF 50 par plaque, **à confirmer
  avec le BE**). ftz-sheet.js : `rotD`, `drawSymbol(doc, sym, cx, cy, k, rot)`.
- Feuille A3 du BE (`buildFtz` → `drawPlan(..., {ftzSyms})`) : symboles FTZ à leur taille réelle (tournés pour les
  appliques), repères Courier gras 2,97 mm ×0,95 noirs, boîtes = carré + nom Times vert, gaines à la couleur de la boîte,
  plaques multipostes côté pièce + « PROF 50 » (Courier), légende avec les symboles FTZ (réduits à la hauteur de la rangée).
  Page 2 (lignes directes) : libellé de la flèche à une place libre (Placer), omis s'il redit le repère : plus de
  chevauchement « AQUA AIR ». Résultat de `buildFtz` : `plaques` [{page, list}].
- Écran : préférence `charteBE` (vraie par défaut, Paramètres → Affichage « Plan aux symboles du BE (FTZ) ») : symboles FTZ
  dans `g.dev` (`g.ftz`, chargés à la demande `ftzIdx()`, anneau `circle.cring` à la couleur du circuit quand les circuits
  sont affichés), gaines à la couleur de la boîte. La barre d'outils garde les symboles Oktéo.
- Logement PMR : `meta.pmr`, case `#ch-pmr` (fiche du chantier), `isPmr()` / `hDefault(t)` (model.js : 30 → 40 cm pour
  les nouveaux appareils, `hDef` de l'impression), `api.setPmr(on, {apply})` (remonte / redescend ceux déjà posés, un
  Ctrl+Z ; événement `okteo:pmr`), `api.pmr`.
- Légende : plaques multipostes posées ajoutées (avant la boîte et la flèche). Symbole FTZ à l'écran : petit disque de clic
  invisible `circle.fhit` (un symbole sans remplissage, comme le point lumineux, laissait passer le clic vers la liaison).
- Tests : charte.test.mjs (+3 : couleurs, symboles, plaques), smoke « plan du BE (v74 MAJ 4) ».

## 03/11/2026 — v74 MAJ 3 : volumes de la salle de bain

Branche `feat/plan-ftz-v74`, fusionnée dans `main` sur « go and push » de Kévin (GitHub Actions : check complet, smoke
175/175, test:web vert). Halo du contrôle sur l'appareil seulement (`sani` = id du sanitaire en cause).
- `src/cablage/volumes.js` (pur) : sanitaires `SANI` (BAIG baignoire 170 × 75, RECV receveur 90 × 90, DITAL douche à
  l'italienne = pomme fixe), `saniRect` (dimensions `a.sw`/`a.sd` en m, rotation `a.srot`), `volumesOf(a, contour de la
  pièce)` → {v0, v1, v2} : volume 0/1 = emprise, 2 = 0,60 m autour (coins arrondis) ; italienne : 1 = 1,20 m autour de
  la pomme, 2 = 1,80 m ; chaque volume découpé par le contour intérieur de la pièce (`clipConvex`, Sutherland–Hodgman) ;
  `volumeAt(x, y, h, V)` (hauteurs 0,60 / 2,25 / 3 m, 3 cm de tolérance pour les appareils muraux), `volumeRule` (volume 0 :
  rien ; 1 : ni prise, ni commande, ni chauffage, luminaire TBTS 12 V ; 2 : ni prise ni commande, luminaire et
  sèche-serviette classe II), `checkVolumes`. Règles simplifiées, **à valider avec le référentiel du BE**.
- Sanitaires = appareils du groupe « Sanitaires » (bouton Autres) : `racc: "aucun"`, famille `SANI` sans repère (repMap),
  exclus des circuits (circuits.js, `circuitMap().__need`), des symboles écartés et de la légende ; dessinés à leur vraie
  taille avec le bâti (render `g.sdb`, `g.sani`, `polygon.vol.v1/.v2`) ; saisis dans tout leur contour (hitApp).
  Propriétés : longueur, largeur, rotation (`#f_sw`, `#f_sd`, `#f_srot`).
- Contrôle : sorte `sdb` « Appareil dans un volume de salle de bain » (check.js, tous niveaux ; bloquant pour prise /
  commande / chauffage) ; étude.js la reprend.
- Impression : `exportGeometry().volumes` (sanitaires retirés de `apps`), print.js dessine volumes (hachures pointillées)
  et sanitaires sur le plan classique et sur la feuille A3 du BE ; `rotateGeo` les tourne.
- Tests : charte.test.mjs (+3 : baignoire, italienne, contrôle), smoke « salle de bain (v74 MAJ 3) ».

## 03/11/2026 — v74 MAJ 2 : bâti du plan du BE (types de murs, noms abrégés, cotes des boîtes)

Branche `feat/plan-ftz-v74`, fusionnée dans `main` sur « go and push » de Kévin (GitHub Actions : check complet, smoke
174/174, test:web vert).
- **Type de mur** (`seg.mat` : `maconnerie` | `cloison` | `doublage`, absent = automatique) : `matOf(seg)` (model.js) =
  le type posé, sinon 16 cm et plus, ou mur de façade (un côté hors de toute pièce, `wallFacade`) de 10 cm et plus =
  maçonnerie, sinon cloison. Propriétés du mur : `#f_mat`. API `wallMats()`, `setWallMat(ids, mat)` (annulable).
  Le relevé n'écrit rien : la règle automatique s'applique à tous les murs relevés (épaisseur + façade).
- **Style du bâti du chantier** (`meta.bati` : `hachures` | `gris`) : `batiStyle()`, `setBatiStyle` (panel.js, événement
  `okteo:bati`), `#f_bati` (Propriétés du mur) et `#prep-bati` (Préparation d'impression). `src/plan-style.js` `wallLook`
  (maçonnerie hachurée ou gris #9A9A9A, cloison pleine #202020, doublage blanc + ondulation `wavePoints`) : même dessin à
  l'écran (render.js, `polyline.wave`) et sur le papier (print.js, `geo.wallMat`, `geo.wallAxis`, `geo.batiStyle`,
  `joints[].mat`).
- **Noms de pièces abrégés** sur la feuille A3 du BE : `src/print/abrev.js` (`ABREV_DEFAUT`, `parseAbrev`, `abrevRoom` :
  mot entier, expression la plus longue, numéro collé « CH2 ») ; préférence `abrev` (Paramètres → Affichage,
  `#pref-abrev`, exemples en direct) ; print.js `o.ftzRooms` : Courier gras 6,52 mm ×0,66, bleu #0000FF. L'écran garde
  les noms complets.
- **Cotes de position des boîtes** : `boxCotes(boxes, walls)` (ftz-sheet.js : distance au premier mur à gauche / droite et
  en haut / bas, en cm) + `drawBoxCotes` (violet #800080, Courier gras 2,97 mm ×0,66, hors du plan, côté le plus proche
  de la boîte, empilées de 5 mm, lignes d'attache jusqu'au premier mur venant de l'extérieur, rien sous 20 cm : boîte contre un mur) ; case « Cotes des boîtes » par page (`pg.cotes`) ; `buildFtz` rend `cotes`.
- Le fond du constructeur n'est jamais imprimé sur la feuille du BE.
- Tests : charte.test.mjs (+3 : abréviations, cotes, dessin des murs), smoke « bâti du BE (v74 MAJ 2) ».
- Reste pour la suite : volumes de la salle de bain (appareils sanitaires à ajouter d'abord), deviner le type de mur
  d'après les aplats du PDF du constructeur.

## 02/11/2026 (nuit) — v74 MAJ 1 : préparation d'impression (plan A3 au format du BE)

Branche `feat/plan-ftz-v74`, fusionnée dans `main` avec la v73 le 02/11/2026 sur accord de Kévin (vérification GitHub
Actions : `npm run check` 173/173 en smoke, `test:web` vert). Bouton « Préparation d'impression (A3 BE)… » dans la fenêtre Imprimer, commande du
catalogue `file.prep`, `okteoExt.prep` (open, close, addItem, select, bg, prep, last).
- `src/print/ftz-sheet.js` (pur, jsPDF) : cadre, cartouche FTZ (logo KiTéOHM HD `public/assets/kiteohm-logo-hd.png`),
  textes avec compression horizontale (`Tz`), légende = seulement les symboles utilisés + boîte « LI » + flèche « ligne
  vers le tableau », `freeCorner` (coin libre), encarts `drawItem` (texte encadré ou non, flèche, ⚠, zone interdite
  hachurée rectangle/ellipse, image), `ENCARTS` (encarts types).
- `src/ext/print.js` : `buildPlanPdf(geo, {ftz})` → `buildFtz` : A3 paysage, échelle 1/50 sinon 1/75…1/200, une page
  par entrée de `pages` [{boxes "all"|[ids], direct, autres, legend, legendAt}] ; par défaut recto = toutes les boîtes,
  verso = lignes directes + légende. `drawPlan` : options `appIds`, `boxIds`, `directOn`, `bare` (sans cadre ni bandeau).
- `src/ext/prep-ui.js` : feuille rendue par pdf.js (sans les encarts) + calque SVG en mm pour poser/glisser/agrandir les
  encarts ; légende déplaçable (glisser) ou « coin libre » ; panneau de style du texte (police, taille, gras, italique,
  alignement, couleurs, cadre, fond blanc) ; « Garder comme encart type » (localStorage `okteo.encarts.v1`, tous chantiers).
  Enregistré dans le chantier : `meta.impression` {pages, items, date} ; images dans le stockage des fichiers
  (`img:<chantier>:<id>`, JPEG ≤ 1600 px). Champs du cartouche ajoutés à la fiche chantier : `clientBE`, `affaire`,
  `dessinateur` (aussi dans `exportGeometry().chantier`).
- Sens du plan (`meta.impression.sens`) : automatique = quart de tour si le plan tient ainsi à une plus grande échelle
  (MAILLARD : 1/75 → 1/50), comme la vue, ou imposé. Cadrage sur murs, appareils et noms de pièces (un contour de pièce
  mal relevé ne décentre plus le plan).
- Le plan de travail n'est jamais touché : cartouche, légende et encarts n'existent que dans cette vue et le PDF.
- Smoke : test « préparation d'impression (v74) » (2 pages A3, légende au verso, encart texte au recto seulement, champ
  enregistré). `scripts/shots-v74.mjs` : captures EVRARD câblé (CI).
- Pas encore : symboles FTZ sur le plan lui-même, couleurs verrouillées des boîtes, noms de pièces abrégés (MAJ 2 et 3).

## 02/11/2026 (nuit) — v74 (fondation) : relevé de la charte des plans FTZ

Branche `feat/plan-ftz-v74` (partie de `feat/charte-v73`, pas encore sur `main`). Objectif de Kévin : un plan Oktéo
impossible à distinguer d'un plan FTZ du BE. Décisions et analyse : `docs/charte-plan-ftz.md`.
- `scripts/charte/ftz-pdf.mjs` : lecteur sans dépendance des flux de contenu PDF (tracés, couleurs, épaisseurs, textes,
  état graphique), sur un PDF décompressé par qpdf. `scripts/charte/ftz-charte.mjs` : écrit `src/print/ftz-charte.json`
  (palette, styles de texte, 39 symboles des légendes FTZ avec leur dessin exact, cartouche avec champs à remplir).
  Aucune donnée du client n'est gardée (valeurs du cartouche remplacées par {client}, {chantier}, {affaire}…).
- `src/print/ftz-draw.js` : dessin SVG des symboles et du cartouche depuis la charte. `scripts/charte/planche.mjs` :
  planche de contrôle FTZ d'origine / Oktéo. Test `scripts/charte.test.mjs` (10) ajouté à `npm run check`.
- Les plans de référence (EVRARD, VILLANOVA, MAILLARD) ne sont pas ajoutés au dépôt (public, vrais clients).
- Test smoke « une seule fenêtre de travail » : il ouvrait le relevé des pièces avant la fin du relevé des murs (dont la
  carte se rouvrait ensuite) ; il attend maintenant le bouton « Ajouter » des murs (échecs intermittents de v73.1).

## 02/11/2026 (nuit) — v73.1 : tailles adaptées à l'écran (retour de Kévin sur son portable)

- Sur le petit PC de Kévin (affichage Windows à 150 % : environ 1280 × 600 utiles), le bandeau prenait la moitié de
  l'écran et Panneaux passait sous Actions. Les tailles suivent maintenant la largeur ET la hauteur de la fenêtre
  (`--fb = clamp(11px, min(0,94vw, 1,67vh), 18px)`, `--hb`, `--fs`, `--r` en découlent) : 18 px à 1920 × 1080 comme la
  maquette, ~11 px sur le portable.
- Bandeau des outils sur une seule ligne : Actions | Vues | Panneaux (grille `act view pan`), panneaux empilés à droite
  des Vues ; sous 1500 px les raccourcis Alt+1/2/3 des vues ne restent que dans l'infobulle ; sous
  1400 px « Angles droits » n'affiche que la case (infobulle) ; sous 1000 px, Vues et Panneaux passent sous Actions.
- Accueil (connexion) et page d'attente réduits en hauteur sur les petits écrans (vh, `zoom`).
- Captures de vérification aussi en 1280 × 600.
- Validation GitHub Actions run 41522818747 : smoke seul 172/172 puis `npm run check` complet vert (murs 42, câblage 87,
  chantiers 176, MAILLARD 14, smoke 172/172), `build:web` et `test:web` réussis. Le test « une seule fenêtre de travail »
  (lecture du PDF EVRARD) a échoué deux fois sur quatre passages, jamais seul : délai de lecture du PDF, diagnostic des
  cartes ajouté au test pour le prochain échec.

## 02/11/2026 (nuit) — v73 : charte graphique Oktéo appliquée (planches 5, 6, 7 de l'identité de marque)

Branche `feat/charte-v73` (pas encore sur `main` : attendre le « go » de Kévin). Source : artefact « Oktéo AI —
Identité de marque », planches 5 (écran de travail), 6 (accueil animé) et 7 (page d'attente). La planche 8 n'existe pas.
- **Écran de travail (planche 5)** : palette bleu nuit (#031E38 / #04284A / #0A3A66, actif #0B6E99, corail #E8534A,
  vert #3DDC97) par variables CSS (`src/style.css`, section v73) ; thème sombre par défaut, ◐ passe au clair (version
  claire de la même charte, bouton `#theme` : défaut « dark »). Polices Rubik (logo, titres), Inter, JetBrains Mono.
  Logo (pieuvre + maison KiTéOHM + « oktéo ») dans `.brand` ; icônes SVG de la maquette pour Relevé, Annuler,
  Rétablir, Imprimer, Fonctions, outils (`TI` en 24 × 24) et panneaux (Propriétés, Câblage, Packs, Étapes,
  Assistant). Bandeau Actions / Vues / Panneaux avec titres au-dessus des encarts, appareils en pastilles blanches,
  intercalaires, Ajuster et Assistant comme la maquette. Tailles de la maquette (1920 × 1080) à partir de 1800 px de
  large, un peu réduites en dessous (variables `--hb`, `--fb`). Plan : toujours blanc ; couleurs lisibles sur blanc
  forcées sur `#sv`/`#fx`. Aucun identifiant ni structure HTML changés (tests).
- **Accueil animé (planche 6)** : `public/login.html` réécrit : la pieuvre se dessine et tourne (3 s, CSS seul,
  respect de « réduire les animations »), puis le formulaire de connexion (mêmes champs, `login.js` inchangé).
  `server/worker.js` : la page de connexion autorise Google Fonts (style-src / font-src), comme l'application.
- **Page d'attente (planche 7)** : `src/ext/attente.js` (`createAttente({api})` → `start`, `finish(id, ok)`, `show`,
  `hide`, `close`, `visible`), branchée sur le relevé par l'IA (`ai-releve.js`, `okteoExt.aiReleve.attente`).
  S'ouvre seulement si l'IA met plus de 2 s ; temps écoulé, phrases, jeux « Mémoire » et « Câble » (records dans
  localStorage `okteo.attente.v1`) ; « Revenir au plan » / Échap = l'analyse continue ; fin = « Votre plan est
  prêt » + « Ouvrir le chantier » ; échec = fermée (message habituel). Clavier capturé tant qu'elle est visible.
- Test smoke ajouté (page d'attente).
- Validation GitHub Actions (Chromium, run 41519118481) : `npm run check` vert (murs 42, câblage 87, chantiers 176,
  MAILLARD 14, **smoke 172/172**), `build:web` et `test:web` réussis ; captures d'écran vérifiées à 1920 et 1500 px
  (écran de travail sombre et clair, accueil, page d'attente). Test « boîte à taille fixe » : zoom ±1,6 / ±2 m (bandeau
  plus haut). Branches `verification-charte-v73` et `verification-charte-v73-captures` à supprimer (suppression refusée depuis la session de Claude). Reste : recette de Kévin sur l'aperçu
  Cloudflare de `feat/charte-v73`, puis « go » pour `main`.

## 02/11/2026 (soir) — v72.1 fusionnée dans `main` et mise en production

- « Go » de Kévin (20:41). `main` avancée sur `feat/web-entreprise-v72` (avance rapide, sans réécriture d'historique,
  PR #1 fermée par la fusion). Cloudflare construit la production : https://okteo-ai.pages.dev (base D1 `okteo-accounts`).
- Recette faite sur l'aperçu : connexion, création du compte administrateur, changement de mot de passe (vérifié dans
  D1). Restent à faire en production : import PDF, secours chiffré, QR code des bandes ; IA dès que la clé sera ajoutée.
- `gh-pages` (ancienne adresse GitHub Pages) : remplacée par les pages de redirection de
  `docs/redirection-github-pages/` (un commit ajouté, historique conservé ; les anciens QR gardent leur `#`).
- Branches restantes : `main`, `feat/web-entreprise-v72` (gardée pour l'historique de la PR), `gh-pages`.
- Prochaine mise à jour prévue : identité de marque (artefact « Oktéo AI — Identité de marque ») appliquée à l'interface.

## 02/11/2026 (après-midi) — v72.1 : mise en place Cloudflare et page blanche corrigée

- Configuration faite par Kévin (avec Claude dans Chrome) : build `npm run build:web`, sortie `dist`, `NODE_VERSION=22`,
  aperçus de branche actifs, secret `BOOTSTRAP_PASSWORD` (Production et Preview). `ANTHROPIC_API_KEY` pas encore créée :
  l'IA est refusée avec un message clair, le reste fonctionne.
- Bases D1 créées par Claude (connecteur Cloudflare), région Europe de l'Ouest, schéma `migrations/0001_enterprise.sql`
  appliqué (sans `PRAGMA foreign_keys`, non accepté par D1 et inutile : D1 vérifie les clés étrangères) :
  `okteo-accounts` (id 40d80429-695e-4208-a6d2-67c5cc14b3a5) liée en Production, `okteo-accounts-preview`
  (id 8d62529a-9a01-4f9f-8cda-d5c0bf9512d4) liée en Preview, nom de liaison `DB`.
- 1re compilation de l'aperçu réussie (416020b), mais **page blanche** : `env.ASSETS.fetch` de Cloudflare applique ses
  redirections `.html` (`/login.html` → 308 `/login`) ; le Worker renvoyait cette redirection sans son adresse.
  Correction : `assetPage()` suit les redirections internes (connexion et page bande). Test `web.test.mjs` avec un faux
  ASSETS qui imite ce comportement (les tests précédents ne pouvaient pas le voir).
- Aperçu : https://feat-web-entreprise-v72.okteo-ai.pages.dev (recette par Kévin dans Edge ou Chrome).

## 02/11/2026 — v72.1 : reprise de la v72 par Claude, une seule version en ligne

**Contexte.** Kévin avait trois versions sans le savoir : GitHub Pages = v70 (29/10), Cloudflare `okteo-ai.pages.dev` =
`main` v71 servi sans compilation (sources brutes : import PDF cassé), branche `feat/web-entreprise-v72` (ChatGPT,
30/10, PR #1) jamais publiée. Le dépôt `okteo-ai-v14` est vide. Décision de Kévin (02/11) : **Cloudflare seule
adresse** ; Claude reprend la v72 (crédits ChatGPT épuisés).

Relecture de la v72 : architecture saine (comptes, budget atomique, coffre chiffré, exports en dossiers, tests serveur).
Défauts bloquants corrigés :
- **QR code des bandes** : il pointait vers GitHub Pages et, sur Cloudflare, `bande.html` exigeait un compte → le
  câbleur ne pouvait plus l'ouvrir. `PUBLIC_BASE` = `https://okteo-ai.pages.dev/` ; le Worker sert sans session
  uniquement `/bande.html` et les fichiers compilés hachés (`PUBLIC_ASSET`, js/css) ; fonds, plans, version, API restent
  fermés. Tests ajoutés dans `scripts/web.test.mjs`.
- **Délai IA** : 3 min coupait les relevés (5 à 10 min mesurés sur MAILLARD) et gardait la réservation « incertaine ».
  `AI_TIMEOUT` = 15 min ; un appel « pending » ne devient incertain qu'après ce délai + 1 min.

**Régressions de la v71 trouvées et corrigées** (la v71 n'avait jamais pu passer les tests navigateur : ~30 contrôles
smoke en échec, identiques sur `main`) :
- depuis v71, `draw()` recalcule le câblage pour les flèches ; un appareil d'une boîte sans circuit (état normal pendant
  l'édition) faisait planter `computeWiring` (`circOf.get(id).kind`) → plan figé. Lecture protégée dans `gaines.js`,
  `plan-wiring.js` ne fait plus jamais planter le dessin, test de régression dans `cablage.test.mjs` ;
- `hitPort` utilisait une variable `on` inexistante (saisie des points d'accroche cassée) ;
- l'image du plan envoyée à l'IA (« Analyser le plan ») ne contenait plus le fond, masqué par défaut depuis v71 ;
- tests smoke mis à jour pour les choix volontaires de v71/v72 (ouvrants masqués, points d'accroche sur la boîte
  sélectionnée, murs #202020 hachurés, boîtes imprimées sans faces ni n° de gaine, relecture sans sens des portes, nom de
  fichier `.okteo` avec révision), avec le détail affiché en cas d'échec ; délai PDF 30 s.
- **défaut connu depuis v66 corrigé** : étiquettes qui se chevauchaient de 1 à 3 px (`place.js` hauteur réelle 1,4 ×
  la police ; noms de pièces mesurés lettre par lettre, `nameEm`).

**Validation (GitHub Actions, Chromium, 2 passages identiques, run 41450303488)** : syntaxe 112 fichiers ; VMC 15,
équipements 13, lecture IA 12, symboles 14, règles 8, murs 42, câblage 87, chantiers 176, MAILLARD 14, **smoke 171/171** ;
parcours navigateur VMC, MAJ 3/4, MAJ 1/2, bibliothèque ; serveur `test:web` 11/11 ; `build:web` réussi. `npm run check`
est entièrement vert pour la première fois depuis v66. Non vérifié : le déploiement Cloudflare réel (D1, secrets, Edge),
aucune vraie clé Claude utilisée.

À trancher par Kévin : le plan imprimé v71 n'a plus les n° de gaine ni les lettres de face autour des boîtes (ils
restent sur les bandes) — voulu ?

Harmonisation : `CLAUDE.md` commence par « À LIRE EN PREMIER » (valable pour toutes les IA, `AGENTS.md` y renvoie) ;
README, feuille de route et `scripts/deploy.mjs` ne parlent plus de GitHub Pages ; pages de redirection prêtes dans
`docs/redirection-github-pages/` (gardent le `#` des anciens QR) ; script temporaire `_tmp_li05.mjs` retiré.

Points ouverts signalés à Kévin : dépôt public avec plans clients ; plan Cloudflare gratuit peut-être trop juste en CPU
(connexion PBKDF2, gros relevés) ; en mode clé, l'image du relevé est réduite à 1 568 px alors que les essais
demandent ≥ 3 000 px (piste « zoom ciblé » de Notion) ; code v72 écrit en lignes très compactes, difficile à relire.

## 30/10/2026 — v72 : branche entreprise Cloudflare, comptes, secours et dossiers

**État : branche `feat/web-entreprise-v72`, recette Edge/Cloudflare restante avant fusion.** Demande explicite « go and push » de Kévin. Base v71 `68c146f` préservée. Pas de modification des règles métier ni de la charte du plan.

- Cause PDF vérifiée : Cloudflare sert `/src/app.js` / `/src/ext/main.js`. Build Vite + Worker Pages Advanced mode, worker PDF compilé, procédure précise `npm run build:web` → `dist`.
- Backend `server/` + migration D1 : comptes, sessions, Kevin au bootstrap par secret, trois admins maximum, reset administrateur, permissions serveur, Claude centralisé, réservations de budget atomiques, versions communes et propositions. Aucun secret réel ni plan persistant côté serveur.
- `src/web/` : connexion, administration, secours AES-GCM avec fichiers, verrou d'onglet, journaux d'éléments, dossiers autonomes v2 + contrôle SHA-256, finalisation Chantier / Rapport_Thibaut sans ZIP, compatibilité v1, ressources hors ligne et notification de version. Collage d'analyse conservé.
- Paramètres et bibliothèque épinglés dans chaque chantier ; adoption explicite journalisée ; publication admin et retour arrière versionné. Édition guidée et JSON avancé.
- Hypothèse budgétaire documentée : 30 chantiers/semaine, plafond initial réglable 50 USD/mois, limite initiale par compte 25 USD/mois, deux appels simultanés. Coût réel fournisseur non mesuré.
- Vérifications : tests serveur/crypto/format et suites métier hors navigateur réussis ; compilation production réussie. `npm run check` bloqué au navigateur MAILLARD ; Chromium indisponible/interdit dans cet environnement, smoke et visuel non validés. Aucun déploiement Cloudflare réel ni appel payant.
- Configuration requise avant usage : D1 `DB`, migration SQL, secrets `BOOTSTRAP_PASSWORD` / `ANTHROPIC_API_KEY`, correction build/output Cloudflare ; anciennes données navigateur à exporter puis retirer du poste partagé.
- Transmission complète et retour arrière : [déploiement](deploiement-web-v72.md), [recette détaillée](recette-web-v72.md). Ne pas assimiler un push de branche à une mise en production validée.

## 30/10/2026 — v71 : rendu du plan KiTéOHM

Demande de Kévin : conserver les symboles, adapter fond, murs, boîtes et gaines au modèle MAILLARD ; masquer les ouvrants en gardant les passages et les outils ; représenter alimentations et lignes directes par des flèches avec possibilité de réafficher leur parcours.

- Fond blanc, pièces sans aplat ; fond PDF toujours disponible par le calque Fond, désactivé par défaut pour les nouveaux réglages. Murs de 16 cm et plus hachurés, cloisons fines noires (classification par épaisseur, pas une détection sémantique des façades).
- Boîtes nommées dans leur carré ; sélection : faces et ports d’édition disponibles. Gaines fines. Flèches avec les étiquettes issues du calcul de câblage.
- Boutons Ouvrants / Parcours complets dans les vues, préférences et palette de fonctions ; options équivalentes dans Imprimer. Les ouvertures, routes d’alimentation et longueurs sont conservées. Les lignes directes suivent le trajet rectiligne utilisé par le calcul existant ; aucun éditeur de détour des lignes directes n’est ajouté.
- Prompt commun aux modes avec clé et copier/coller : centres et largeurs des passages uniquement, axes continus ; plus de demande de gonds/arc. Relecture du sens désactivée par défaut ; compatibilité de lecture des anciens champs conservée.
- Vérification : compilation production, 42 tests murs/relevé, 86 tests câblage, 176 tests chantiers ; test navigateur ciblé sous Edge (flèches, parcours, invariance du modèle et génération PDF), inspection des PNG et du PDF.
- Limite locale : suite smoke et essai MAILLARD complets bloqués par le chargement natif esbuild de la configuration Vite sous Windows ; Chromium headless local refuse le lancement (EPERM). Le test ciblé utilise la compilation avec configuration chargée par Node et Edge (`OKTEO_TEST_BROWSER=msedge`).

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

## Bibliothèque de symboles (29/10/2026) — première intégration à relire
Demande de Kévin : commencer la bibliothèque, conserver la charte du logiciel de base et réduire les étiquettes pour afficher plus de symboles. Consultation et insertion ; variantes BE signalées non reconnues ; modifications sans code pour le moment.
- Nouvel onglet **Symboles**, dans la navigation existante, et commande `symbols.open` dans Ctrl+K. Couleurs, typographies et thèmes clair/sombre repris de `src/style.css` ; cartes compactes et panneau de fiche intégré. Le panneau Propriétés est masqué uniquement sur cette page pour laisser de la place à la grille.
- Les types viennent de `api.TYPES` : aucun catalogue parallèle d’appareils natifs. Nouvelle API `symbolMarkup(type)` pour utiliser exactement les mêmes dessins SVG que le plan, via l’interface publique du cœur.
- Recherche sans accents, mots cumulés (nom, identifiant, source, notes, règles), filtres catégorie/origine, aperçu, hauteur par défaut et raccordement actuel. Insérer revient au plan et active l’outil de pose existant ; aucune implantation automatique.
- Fiches liées aux règles réelles du journal (`getJournal`) : description, source, certitude et statut affichés sans requalifier une règle en règle validée. Les liens sont éditables et les identifiants vérifiés ; les fiches ne modifient pas les règles exécutées par le moteur.
- BE : ajout d’une fiche avec image PNG/JPEG/WebP (5 Mo max, réduite à 600 px), source, notes et correspondance facultative. Sans correspondance : « Non reconnu par Oktéo », insertion bloquée. Une correspondance manuelle autorise la pose du symbole Oktéo désigné ; elle ne forme pas les détecteurs/IA au dessin BE. Les vrais dessins BE restent à fournir.
- Cas KICHOUH 32 A : une fiche d’attente, sans faux dessin ni correspondance imposée. **PLAQ existe déjà** dans le catalogue (32 A) ; ne pas confondre absence du type et échec de reconnaissance. Cette mise à jour n’altère pas les relevés IA ni les détecteurs existants.
- Pas de halo violet dans la bibliothèque : cette couleur garde le sens d’emplacement à préciser sur le plan. Statut BE affiché en orange.
- Modification des métadonnées et des fiches BE sans code, conformément à la demande actuelle. Stockage local `okteo.symbols.v1`, historique et export JSON avec images ; échec d’enregistrement signalé. Aucun partage multi-postes ni réimport ajouté à cette première version ; le futur contrôle par code reste à réaliser.
- Fichiers : `src/ext/symbols-data.js`, `src/ext/symbols-ui.js`, intégration `main.js`, `catalog.js`, `index.html`, onglets `controls.js`, API `api.js`, styles et tests.
- Validation : build Vite et syntaxe réussis ; tests murs 41/41, câblage 86/86, chantiers 176/176 ; bibliothèque 14/14 (données, recherche, liens réels, sauvegarde et quota). Régressions navigateur ajoutées (`npm run test:symboles:navigateur`) mais **non exécutées** : Chromium local refuse les sockets du profil (`Operation not permitted`) ; l’outil navigateur distant ne démarre pas. MAILLARD et smoke navigateur restent non vérifiés dans cet environnement (Chromium Playwright absent). Contrôle visuel à réaliser avant publication.
- Travail préparé sur une branche dédiée ; aucune publication du logiciel en production dans cette intervention.

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


## v67 — Bibliothèque des règles (29/10/2026)
- Demande de Kévin : rendre toutes les règles consultables par un novice, séparer le tableau du câblage et filtrer par validation.
- Domaines, familles, types, recherche insensible aux accents et synonymes, filtres combinables avec compteurs, pages de 24 règles. Questions et historique ont leur propre vue.
- Fiches avec résumé, contexte, vérifications et exemple de consultation ; texte intégral, paramètres, preuves et historique dans les détails techniques.
- Validation distincte de la prise en charge logicielle : automatique, partielle, alerte, manuelle, non intégrée ou à documenter. Les modifications locales retirent toute affirmation d’automatisation non revue.
- Accès direct « Règles du tableau » depuis Tableau. Les 117 règles, identifiants, données exportées et moteurs de calcul sont conservés.
- Architecture : `src/cablage/regles-library.js` contient uniquement les métadonnées de présentation et filtres ; `regles-data.js` reste la référence métier.
- Vérifications : tests purs de classification, recherche, combinaisons, conservation des données et modifications locales ; parcours navigateur adaptés à la pagination.

Validation v67 : 89 fichiers contrôlés, 8 tests de bibliothèque, 41 murs, 86 câblage, 176 chantiers, 14 MAILLARD et 168 parcours navigateur réussis (Actions 40883533722). L’unique échec global concerne le chevauchement d’étiquettes déjà reproduit sur v66/v66.1 (2 en vue d’ensemble, 1 en zoom) ; aucun moteur de dessin modifié ici. Build réussi. La capture visuelle a révélé puis permis de corriger un héritage `white-space: nowrap` dans les fiches ; contrôle ciblé du débordement après correction.

## v68 — MAJ 1/2 du relevé IA et fusion de la bibliothèque de symboles (29/10/2026)

- Autorisation de Kévin : MAJ 1 et 2 seulement, avec intégration de `feature/bibliotheque-symboles` dans le tronc. Les styles et fonctions de la bibliothèque des règles v67 sont conservés.
- MAJ 1 : informations de lecture structurées (`qty`, calibre, inscriptions, regroupement, origine, incertitude), type `INCONNU` visible plutôt qu'ignoré, `PC32` distinct de PC20/PLAQ, réponse source conservée. Propriétés consultables, champs repris par les API et les fichiers existants sans migration destructive. Préflight avant remplacement des appareils.
- MAJ 2 : introduction dessinateur dans « Copier la consigne », prompt initial fidèle aux quantités/calibres, libellé « Commande non identifiée », interprétation des détecteurs réservée à la relecture ciblée existante. La rubrique `lectures` conserve mode/alimentation/preuve ; sans preuve, à confirmer. Aucun raccordement détecteur automatique ajouté (MAJ 4 différée).
- Documentation de transmission : `docs/releve-ia-v68.md`. Nouveaux tests dans `scripts/ai-reading.test.mjs`, avec parcours Chromium ; attentes historiques adaptées uniquement à la conservation des inconnus.
- Limites : quantité des blocs conservée, pas encore étude détaillée de l'appareillage ; ni MAJ 3 à 6 ni charte graphique. Les spots ajoutés par le BE sur KICHOUH ne sont pas des oublis IA.
- Validation : voir entrée de validation v68 ajoutée après exécution des contrôles.

### Validation v68 et transmission (29/10/2026)

- Révision testée sous Chromium : `e96fa7c6a1a528f5e43e07ec4e8bd6ba34241277` sur `verification-maj12-v68`. Exécution : https://github.com/kevincruveilher-png/okteo-ai/actions/runs/40930261783.
- Réussis : syntaxe de 92 fichiers ; 12 contrôles lecture IA, 14 bibliothèque de symboles, 8 bibliothèque de règles, 41 murs, 86 câblage, 176 chantiers et 14 MAILLARD ; compilation Vite.
- Parcours généraux : 168 réussis, un échec déjà reproduit avant cette livraison : chevauchement d'étiquettes (2 en vue d'ensemble, 1 en zoom). La validation d'intégration accepte uniquement cet échec identifié, avec avertissement ; elle ne masque aucun autre défaut. `npm run check` seul conserve donc un code de sortie d'échec tant que ce défaut de dessin n'est pas corrigé.
- Nouveaux parcours Chromium réussis : réponse tronquée sans modification du chantier ; import des quantités, calibres et inconnus ; propriétés et échappement du texte ; correction détecteur avec preuve ; annuler/rétablir ; export `.okteo` ; sauvegarde/réouverture ; bibliothèque PC32. Aucune vraie requête à un fournisseur IA.
- Parcours bibliothèque réussis : recherche, catégories/origines, thèmes clair/sombre, insertion, fiches BE sans substitution automatique, édition locale, conservation des règles métier et absence d'injection HTML. Capture de la bibliothèque examinée.
- Attentes historiques actualisées : inconnus désormais conservés ; sept onglets avec Symboles ; libellé « commande non identifiée ». Le test d'export lit bien `dessin.s`, le format de sauvegarde existant. Aucun ancien test fonctionnel supprimé.
- La bibliothèque `feature/bibliotheque-symboles` est intégrée en conservant son historique et les styles de la bibliothèque des règles v67. Les modifications de fiches restent propres au navigateur : pas de base partagée créée.
- Documentation du format, du premier cycle et des limites : `docs/releve-ia-v68.md`. La bibliothèque et les MAJ 1/2 constituent le périmètre autorisé ; les équipements systématiques, halos violets, antenne automatique, raccordement détecteur et réseau VMC restent réservés aux lots suivants.
- Publication : construire la révision validée de `main`, mettre à jour `gh-pages` sans réécrire son historique et vérifier la version déployée. `version.json` identifie le commit source du build ; les workflows de vérification/publication restent sur leurs branches de travail.

### Publication v68 confirmée

- Build source : `93b045f0d9eca35c20703968715918e15a8663f9` (`main`, MAJ 1/2 et bibliothèque intégrée).
- Construction/publication : https://github.com/kevincruveilher-png/okteo-ai/actions/runs/40931077854 ; commit `gh-pages` : `472df74629da93c898855da77b6cc09ad04a1f1f`, ajouté sans réécriture d'historique.
- Déploiement Pages réussi : https://github.com/kevincruveilher-png/okteo-ai/actions/runs/40931140474.
- Vérification HTTP : `https://kevincruveilher-png.github.io/okteo-ai/version.json` répond 200 et annonce `0.68.0` / source `93b045f0d9eca35c20703968715918e15a8663f9`.
- Cette dernière consignation ne change que le journal, pas le code du build publié. Les réserves et lots futurs décrits ci-dessus restent applicables.

## v69 — MAJ 3/4 : équipements et détecteurs (29/10/2026)

- Autorisation : « Go maj 3 et 4 et push sur git ». Base `main` : `539fa13fa8fdb08a559e212bcd9cea5465de4b5e`, bibliothèque et MAJ 1/2 conservées.
- MAJ 3 : cinq équipements systématiques selon pièce, antenne si TV, sans doublon ni déplacement d’existant ; PC32 cuisine attribué aux plaques en conservant la lecture. Propositions avec halo violet et confirmation explicite, état indépendant des doutes électriques, sauvegarde/export/PDF et annulation multi-niveaux.
- Accès Étude + catalogue ; complément automatique après précontrôle lors du câblage. Ajouts de circuits sans effacer les circuits existants, hormis le recalcul historique du mode par boîte. Une consultation d’onglet ne modifie pas le chantier.
- MAJ 4 : raccordement phase/neutre/terre au circuit éclairage de la boîte uniquement si détecteur intégré, alimentation permanente et preuve confirmés. Détecteur séparé/ambigu reste à résoudre ; commande manuelle contradictoire = doute bloquant. Pas de retour flottant ni interrupteur inventé.
- Transmission : `docs/equipements-v69.md`, API `applyEquipmentProposal`, `implantation` sauvegardée, modules purs `equipements.js` et `detecteur.js`. Tests dédiés + smoke ajoutés. VMC et charte graphique hors périmètre.
- Résultats de validation et références : voir la transmission ci-dessous.

### Validation v69 et transmission

- Tests ciblés : 13 vérifications équipements/détecteurs (absence de doublons, positions existantes, PC32, indications de principe, pièces absentes, métadonnées, preuves détecteur, raccordement permanent y compris câble extérieur 3G1,5 et contradiction transmise entre boîtes).
- Parcours Chromium MAJ 3/4 : ajout via Étude, relance, halos, confirmation explicite, annuler/rétablir, géométrie et fichier `.okteo`, réouverture, ajout multi-niveaux sans changer le niveau ouvert, contrôle initial puis détecteur confirmé et contradiction. Câblage après précontrôle, chantier inchangé si blocage, circuit manuel conservé et annulation unique des ajouts automatiques.
- Régressions MAJ 1/2 et bibliothèque de symboles conservées ; aucun fournisseur IA appelé avec une vraie clé. Compilation Vite réussie.
- Réserve générale : le défaut de chevauchement des étiquettes déjà documenté en v67/v68 reste présent (2 en vue d’ensemble, 1 en zoom). Le contrôle d’intégration n’accepte que ce défaut précis ; `npm run check` conserve son code d’échec tant que le dessin n’est pas corrigé.
- Les workflows de vérification et publication sont conservés sur leurs branches de travail, sans être installés dans `main`. Aucun historique réécrit.

- Révision finale testée : `0086649305b7504f476fde3d1a6258c43fc962d5`, branche `verification-maj34-v69`. Actions : https://github.com/kevincruveilher-png/okteo-ai/actions/runs/40934689444 (intégration réussie avec l’avertissement préexistant décrit ci-dessus).
- Résultats : syntaxe 95 fichiers ; 13 équipements/détecteurs, 12 lecture IA, 14 symboles, 8 règles, 41 murs, 86 câblage, 176 chantiers, 14 MAILLARD ; smoke 169 réussis et le seul échec connu d’étiquettes. Parcours dédiés MAJ 3/4, MAJ 1/2 et bibliothèque réussis. Build réussi. Capture des halos et des propriétés examinée.

### Publication v69 confirmée

- Source du build : `a3facdfb02058eee8d6229b91007ae5e370f7d2b`, intégrée dans `main` et `integration/maj-3-4-v69` sans réécriture de l’historique.
- Construction/publication réussie : https://github.com/kevincruveilher-png/okteo-ai/actions/runs/40935297543 ; commit `gh-pages` : `7988c9197a0be659eb245792a8abcc7f93975138`.
- Vérification HTTP : `https://kevincruveilher-png.github.io/okteo-ai/version.json` répond 200 avec `0.69.0` et la source `a3facdfb02058eee8d6229b91007ae5e370f7d2b`.
- Cette consignation finale ne modifie que le journal ; le code déployé reste celui de la révision validée. VMC et charte graphique réservées aux lots suivants.
- Déploiement Pages réussi : https://github.com/kevincruveilher-png/okteo-ai/actions/runs/40935356917.

## v70 — MAJ 5/6 : VMC, comparaisons et diagnostics

- Autorisation Kévin : « Maj 5 et 6 ». Base `96e5100bc044a9322659573b80008cc6a789f8ac`. Périmètre du lot 6 retrouvé dans la note acceptée : comparaisons et diagnostics des pièces/tableau ; charte et ouvrants exclus.
- MAJ 5 : réseau VMC indépendant, réutilisation des bouches existantes, groupe proposé près de la trappe identifiée puis dégagement/garage hors garage, bouches WC/SDB/cuisine, commande cuisine associée, rejet. Emplacements provisoires clignotants violets et confirmation ; ajout d’une bouche et de sa gaine, parcours modifiables avec altitudes, rejet >3 m bloquant, longueurs minimales si altitudes absentes. Affichage indépendant, export géométrie/PDF, sauvegarde et annulation.
- MAJ 6 : formulaire source/preuve et appariement explicite, comparaison séparant blocs/points physiques/repères/gaines, ajout BE distinct d’oubli IA, mal interprété/à préciser/appariement perdu. Diagnostics pièces/tableau et rapport JSON. Pas de lecture automatique de dossier BE promise.
- Ajustement API : identifiants des ajouts renvoyés dans l’ordre d’entrée sur plusieurs niveaux ; nécessaire pour ne pas croiser les gaines.
- Transmission : `docs/vmc-comparaison-v70.md`, CLAUDE et README mis à jour ; modules et catalogue complétés. Vérifications à consigner après exécution.

### Validation locale v70 et blocage de publication

- Réussis localement : 98 fichiers vérifiés en syntaxe ; 15 nouveaux tests VMC/comparaison ; 13 équipements/détecteurs, 12 lecture IA, 14 symboles, 8 règles, 41 murs, 86 câblage et 176 chantiers. Compilation Vite réussie. Les bouches passives ne sont pas ajoutées aux circuits électriques ; ancien type VMC câblé et alias PC EXT testés.
- `npm run check` s’arrête au lancement Chromium utilisé par MAILLARD : navigateur Playwright absent ; le Chromium système est également empêché par le runtime (`socket() failed: Operation not permitted`). MAILLARD, smoke et parcours navigateur MAJ 5/6 restent donc à exécuter. Aucune réussite navigateur v70 ni publication n’est revendiquée.
- Le contrôle automatique a rejeté deux fois la création de l’arbre GitHub vers le dépôt public `kevincruveilher-png/okteo-ai`, jugeant « Maj 5 et 6 » insuffisamment explicite pour cette publication. Le second essai suivait la vérification du dépôt public, de l’origin et des fichiers modifiés ; après ce second refus, aucun autre moyen d’envoi n’a été tenté.
- Travail conservé sur la branche locale `integration/maj-5-6-v70`, avec workflow de vérification prêt. Prochaine étape : confirmation explicite de Kévin pour l’envoi vers ce dépôt public, puis tests Chromium, correction des éventuels défauts, intégration `main` et publication Pages. La version en ligne v69 n’a pas été modifiée par ce lot.

### Autorisation de push et validation Chromium v70

- Kévin confirme « Push » après la question explicite sur `kevincruveilher-png/okteo-ai` public. Le blocage précédent est levé : envoi réussi vers `verification-maj56-v70`.
- Premier passage Chromium : parcours dédiés VMC/comparaison, MAJ 3/4, lecture IA et bibliothèque réussis ; compilation réussie. Le smoke a révélé un sélecteur trop large incluant le nouveau tableau BE dans les modes de pieuvre. Le tableau des modes reçoit un identifiant et le test cible ses quatre lignes, sans supprimer d’assertion.
- Captures examinées : réseau VMC avec bouches/rejet et formulaire de comparaison. Ajustement de lisibilité : une altitude encore inconnue ne superpose pas de halo rouge à la proposition violette ; un vrai blocage de rejet reste signalé. Affichage des repères VMC plutôt que des identifiants internes dans l’Étude.

### Validation finale v70

- Révision testée : `71808f2970273f725b42650cabc27ba6b25380ef`, branche `verification-maj56-v70`. Intégration réussie : https://github.com/kevincruveilher-png/okteo-ai/actions/runs/40939830580.
- Syntaxe : 98 fichiers. Réussis : 15 VMC/comparaison, 13 équipements/détecteurs, 12 lecture IA, 14 symboles, 8 règles, 41 murs, 86 câblage, 176 chantiers et 14 MAILLARD ; compilation Vite.
- Smoke : 170 réussis et un seul défaut préexistant d’étiquettes (2 chevauchements en vue d’ensemble, 1 en zoom). Le garde-fou CI accepte uniquement cet échec précis ; `npm run check` seul reste en échec jusqu’à sa correction.
- Parcours dédiés Chromium réussis : VMC/comparaison (complétion, relance sans doublon, ajout/annulation de bouche, tracés, halos et confirmation, parcours/altitudes, rejet, export, appariement de prise double et réouverture), MAJ 3/4, MAJ 1/2 et bibliothèque. Captures finales examinées. Aucun fournisseur IA réellement appelé.
- Workflows de vérification/publication conservés dans leurs branches de travail ; le workflow temporaire est retiré de la livraison `main`. L’autorisation « Push » permet de terminer l’intégration et la publication précédemment bloquées.

### Publication v70

- Source du build validé : `2c0e7e6a85981492eaf3fe134172ee2ea78a87c3` (`main` et branche d’intégration).
- Construction et envoi sur `gh-pages` réussis : https://github.com/kevincruveilher-png/okteo-ai/actions/runs/40940334880 ; commit `87b68d95d613d19dc804b10a094328a70883561d`, sans réécriture de l’historique.
- Déploiement Pages réussi : https://github.com/kevincruveilher-png/okteo-ai/actions/runs/40940389089.
- Vérification HTTP : `https://kevincruveilher-png.github.io/okteo-ai/version.json` répond 200 et annonce `0.70.0`, source `2c0e7e6a85981492eaf3fe134172ee2ea78a87c3`.
- Cette consignation finale ne change que le journal ; le code publié reste celui validé par Chromium. Limites documentées : géométrie toiture et altitudes à confirmer, référence BE/appareillages détaillés non déduits automatiquement, charte/ouvrants reportés et défaut d’étiquettes connu.
