# À LIRE EN PREMIER — état du projet (mis à jour le 06/11/2026, v77 + vue 3D + lots A à D du 04/11 + grosse mise à jour du 05/11 (lots 1 à 6) + MAJ norme n° 1 à 6 + parafoudre + page Paramètres du 06/11 dans `main`)

Ce fichier sert à TOUTES les IA qui travaillent sur le dépôt (Claude, ChatGPT/Codex…) : `AGENTS.md` y renvoie.
Plusieurs IA se sont succédé (Claude jusqu'à v66, ChatGPT v67 à v72, Claude depuis v72.1) : garder une seule source de
vérité, celle-ci, et tenir `docs/journal.md` à jour à CHAQUE modification (entrée datée en tête du journal).

- **Une seule version en ligne : Cloudflare Pages, https://okteo-ai.pages.dev/** (déployée automatiquement depuis `main`,
  commande de build `npm run build:web`, dossier `dist`, D1 `DB`, secrets `ANTHROPIC_API_KEY` / `BOOTSTRAP_PASSWORD` :
  `docs/deploiement-web-v72.md`). L'ancienne adresse GitHub Pages (`kevincruveilher-png.github.io/okteo-ai`) est
  fermée : la branche `gh-pages` ne contient plus qu'une redirection vers Cloudflare (`docs/redirection-github-pages/`).
  `npm run deploy` ne publie plus rien. Le dépôt `okteo-ai-v14` est vide et inutile.
- Accès à la version en ligne par compte (v72) ; seule la page `bande.html` du QR code est publique (données dans le
  `#` de l'adresse, jamais envoyées au serveur). Clé Claude uniquement côté serveur. Aucun plan stocké côté serveur.
- En local (`npm run dev`) : ancien mode prototype, clé saisie dans Paramètres ou `.env`, relais `/ai/*` de Vite.
- **Dépôt GitHub PUBLIC** : il contient de vrais plans clients (`docs/chantiers`, `docs/exemples`, `docs/plans`,
  `public/assets/fond-evrard-04949.jpg`). Décision de Kévin attendue (dépôt privé ou retrait des plans). N'en ajouter aucun.
- Ne lancer une mise à jour que sur ordre de Kévin ; ne rien pousser sur `main` sans son « go ». Branches de travail :
  `feat/…`, vérification par GitHub Actions sur une branche `verification-…` supprimée après usage.
- `npm run check` entièrement vert (03/11/2026, v76 : smoke 184/184, run 41669930082 ; branche 3D (3D-1 à 3D-8, 3D-10) : smoke 193/193, run 41735764026 ; lot A : smoke 199/199, run 41893797352 ; lot B : smoke 200/200, run 41900550854 ; lot C : smoke 202/202, run 41904201702 ; bloc D : smoke 207/207, run 41913594686 ; confirmation d'emplacement : smoke 208/208, run 41990372145 ; interrupteurs au mur : smoke 209/209, run 41993507221 ; plan fluide : smoke 210/210, run 42002250587 ; grosse mise à jour du 05/11 (lots 1 à 6) : smoke 218/218, run 42019579696 ; MAJ norme n° 1 à 6 du 06/11 : smoke 224/224, run 42225339450 ; parafoudre : smoke 225/225, run 42227973132 ; page Paramètres : smoke 225/225, run 42273573467 ; lots 2 et 3 (câblage du BE, options des appareils) : run 42278123819 ; lots 4 et 5 (.spv Counter, groupes) : run 42280434989 ; lots 6 à 8 (raccourcis FTZ, LE menuiserie, SharePoint) : smoke 230/230, run 42285792088 ; lots 9 et 10 (nuage, dossier) : smoke 232/232, run 42288253656). Sans navigateur en local : faire tourner les
  tests sur GitHub Actions (workflow temporaire sur une branche `verification-…`, voir journal v72.1).

# Oktéo AI — consignes pour Claude

## Le projet
Logiciel de dessin pour le bureau d'études de pieuvres électriques de KiTéOHM (câblage de maisons individuelles :
boîtes, bandes de câblage, SPV pour Counter). Il doit remplacer FTZ, dont la régénération écrase les corrections manuelles.
Cible prioritaire : maisons 90–150 m² d'une trentaine de pavillonneurs (60 % des plans).
Référence complète : `docs/cahier-des-charges.md`. Mises à jour à venir (41–48) : `docs/feuille-de-route.md` — une à la fois, sur « go » de Kévin, push seulement à la fin de chacune. État et suite : `docs/journal.md` (à tenir à jour à chaque version).

## L'utilisateur
Kévin, responsable chez KiTéOHM. Spécialiste pieuvre et câblage, **pas** du dessin industriel.
- Répondre en français, directement, sans flatterie.
- Claude pilote le développement et prend les décisions techniques ; avancer par gros incréments, mais
  **un sujet à la fois** pour ne pas oublier de détails.
- Il travaille souvent la nuit : ne pas commenter l'heure.
- Il est débutant sur l'interface : chaque nouvelle fonction doit être découvrable (infobulle, raccourci affiché, aide).

## Organisation produit (décidée le 25/10/2026)
1. Étape « dessin » : bâtiment **et** implantation des appareils dans le même éditeur (ne pas séparer).
2. Étape câblage : boîtes, liaisons, bandes, SPV — plus tard ; demander les règles métier à Kévin.

## Code
- Pas de framework : `index.html` + `src/app.js` (point d'entrée) + `src/core/*.js` (le cœur, un fichier par thème)
  + `src/style.css`. Vite sert la page.
- Cœur découpé (v26) : `core/k.js` = objet partagé `K` qui contient TOUTES les variables modifiables (K.tool, K.sel,
  K.view, K.BG, K.FOND, K.LV…) ; les fonctions et constantes sont exportées par leur module et importées par les autres
  (imports croisés autorisés : rien ne s'exécute au chargement d'un module). Les instructions de démarrage sont dans des
  fonctions `initN()` appelées par `src/app.js` dans l'ordre. Modules : model (chantier, état, types, géométrie),
  persist (annuler, enregistrement), view (vue, accrochage, repères), render (`draw`), attach (hit-tests, appareils
  attachés), groups (sélection multiple), interact (souris, clavier), hud (menu flottant), panel (panneau Propriétés),
  controls (barres, démarrage), levels (niveaux, géométrie d'impression), api (`window.okteo`).
  Nouvelle variable modifiable = `K.nom` (jamais `let` au niveau d'un module) ; nouvelle fonction = `export function`.
- Le cœur expose `window.okteo` (state, setTool, select, zoomTo, renameRoom, setTab, extent…) et émet `okteo:ready` / `okteo:tab`.
  Les extensions (`src/ext/`) ne passent QUE par cette interface.
- `src/ext/catalog.js` = liste de toutes les fonctions (palette Ctrl+K, infobulles, assistant). **Toute nouvelle fonction y est ajoutée.**
- `src/ext/panel.js` = panneau de droite à onglets (Propriétés + extensions enregistrées via `panel.register`).
- `src/ext/assistant.js` = assistant IA ; protocole d'actions : bloc ```okteo {"actions":[…],"suggest":[…]}``` en fin de réponse ;
  actions possibles : cmd (id du catalogue), select, zoom, rename, delete (toujours confirmée par l'utilisateur).
- `src/ext/ai.js` + `vite.config.js` : appels Claude (Messages API) / NVIDIA (API compatible OpenAI) via le relais local `/ai/*`.
  NVIDIA : Nemotron 3.5 Super VL par défaut (`chat_template_kwargs.enable_thinking` : faux pour les questions, vrai pour l'analyse ;
  balises <think> retirées ; image ≤ 180 Ko). Modèle retiré (410) ou absent (404) → remplaçant choisi dans `/ai/nvidia/models` et mémorisé.
  Clés : onglet Paramètres (localStorage `okteo.settings.v1`) ou `.env`. Ne jamais mettre une clé dans le code ni dans l'export.
- Unités : mètres dans le modèle ; `view` (cx, cy, scale) pour la vue ; `W2V`/`V2W` monde↔viewBox ; `evWorld(e)` écran→monde
  via `getScreenCTM().inverse()` (ne jamais calculer à la main depuis clientX).
- Modèle `state` : `nodes {id,x,y}`, `segs {id,a,b}` (murs), `rooms`, `app` (appareils {id,t,x,y,h,seg?}), `lia` (liaisons {c,l}),
  `openings {id,seg,t,w,kind,hinge,swing}`, `dims`, `wallEp` (0,20 m).
- Toute modification passe par `snapshot()` (annuler) puis `markDirty()` (sauvegarde) puis `draw()` + `showSide()`.
- Chantiers (`src/chantiers.js`, partagé cœur + extensions) : liste dans localStorage `okteo.chantiers.v1`, chantier ouvert
  `okteo.current` ; dessin de chaque chantier sous sa clé `meta.key` (EVRARD garde l'ancienne `okteo.evrard.04949.v4`) ;
  fichiers lourds dans IndexedDB `okteo/files` : `fond:<id>` (JPEG rendu ~4500 px) et `pdf:<id>` (PDF d'origine, pour le relevé des murs).
  Changer de chantier = `setCurrent` + rechargement de la page. Fichier d'échange `.okteo` (JSON : chantier, dessin, fond image + PDF en data URL).
- Fond : `FOND` (URL), position/taille `BG` en mètres, stockés dans `meta.fond` ({src: asset|idb, pxW, pxH, x, y, w, h, calibre}).
  Outil `calib` (mise à l'échelle 2 points + longueur réelle) : le fond est mis à l'échelle autour du 1er point, le dessin ne bouge pas.
  Import PDF par pdf.js (`pdfjs-dist` 4.10.38, chargé à la demande) dans `src/ext/fond-import.js` ; page Chantiers : `src/ext/chantiers-page.js`.
- Relevé automatique des murs (sans IA) : `src/walls/extract.js` (traits du PDF via pdf.js : segments, épaisseur, couleurs,
  n° de polygone `pid`) + `src/walls/detect.js` (bandes entre bords parallèles d'un même polygone rempli, recollage, ouvertures,
  jonctions L/T, sommets fusionnés ; secours sur les traits si le plan n'a pas d'aplats). Interface : `src/ext/walls-ui.js`
  (aperçu `okteo.setPreview`, ajout `okteo.importWalls` = un seul Ctrl+Z). Chaque mur peut avoir sa propre épaisseur `seg.ep`
  (sinon `state.wallEp`) : toujours passer par `epOf(seg)` dans le cœur.
- Appareils attachés (v16) : `a.wa = {e:"a"|"b", d, s}` = distance d depuis la FACE du mur d'angle le plus proche (côté e
  du mur `a.seg`), côté s (±1). `followWalls()` (début de `draw`) replace les appareils d'après `a.wa` et `followRooms()`
  recale les pièces sur leurs murs. Toute écriture directe de `a.x/a.y` d'un appareil mural doit être suivie de `attach(a)`
  (ou `reattach(a)` s'il a quitté son mur). Mur supprimé : appareils détachés, ou supprimés via `removeSeg(id, true)`.
- Pièces détectées (v17) : `src/walls/rooms.js` (faces fermées du graphe des axes de murs après retrait des murs
  pendants ; `r.cycle = [{seg, from}]` ; `r.poly` = contour intérieur (décalé de ep/2) recalculé par `followRooms` ;
  surface habitable = `roomArea(r)` ; `roomAt` teste le polygone). Noms : `src/walls/labels.js` (textes du PDF ≥ 1,3 × la
  taille médiane) + `decodeLabels` (texte lisible, ou police codée décodée par la forme des mots, groupe police+taille,
  correspondance code→lettre cohérente, 1re lettre parfois absente). Interface : `src/ext/rooms-ui.js`, page PDF partagée
  `src/ext/pdf-page.js`. Une pièce sans `cycle` reste un rectangle (outil Pièce).
- Impression (v18) : `okteo.exportGeometry()` (murs découpés aux ouvertures, portes + arc, pièces, appareils avec repère et
  pièce, liaisons, cotes, fond) → `src/ext/print.js` (jsPDF 2.5.2, unités mm, échelle 1:N exacte, mise en page auto
  A4→A3 et 1:50→1:200, légende, échelle graphique, cartouche, page 2 nomenclature) ; fenêtre `src/ext/print-ui.js` (Ctrl+P,
  aperçu dessiné par pdf.js). Le test relit le PDF produit et mesure la largeur des murs pour vérifier l'échelle.
- Relevé des appareils (v19) : `extract.js` rend aussi `shapes` (chaque sous-chemin peint, courbes échantillonnées, boîte,
  couleur) sans changer `segs`. `src/walls/devices.js` `detectDevices(ex, pageTexts(page), {k,ox,oy})` : cercles → compagnons
  de même couleur (traits intérieurs, rayons, queues, croix, cercle concentrique), tailles relatives au petit cercle le plus
  fréquent ; prises 20 A = début du texte voisin de même longueur que le texte le plus fréquent (« 16A ») et même dernière
  lettre (police codée) ou lecture directe si lisible ; liaisons = traits non symboles reliant commande et lumière, propagées
  de lumière en lumière sans traverser une autre commande. Type `SC` (sortie de câble) ajouté. Interface `src/ext/devices-ui.js`
  (aperçu `setPreview({devices,links,unknown})`, ajout `okteo.importDevices(list, links, {replace})` = un seul Ctrl+Z, muraux
  collés via `snapToWall` + `attach`). Événements `okteo:rooms-imported` (enchaînement) et `okteo:devices`.
- Chiffres en police codée (v20) : `src/walls/digits.js` `solveDigits(texts, segs, k)` → par police {map code→chiffre, sep,
  checked, scale} : textes courts posés le long d'un trait parallèle (cote) ; essai de facteurs d'échelle 0,3–3, votes
  code→chiffre, 2e passe pour les chiffres rares (gardés s'ils font relire plus de cotes), séparateur = 3e caractère depuis
  la fin. `readDigits` / `parseDeviceLabel` (intensité 10/16/20/32, hauteur). `pageTexts` calcule le milieu et l'angle dans
  le repère du PDF puis les convertit (page tournée !). « 16A » et « H:1.20m » séparés sont réunis. Contrôle d'échelle :
  `chantierScaleCheck(api)` (pdf-page.js) dans la carte du relevé des murs, bouton « Corriger » = `applyCalib`.
- Fiabilité (v21) : repères fixes `a.n` + famille `a.rf` (`ensureReps()` dans `draw` : numéro manquant, en double ou
  famille changée → max+1) ; `okteo.renumberReps()` (commande Ctrl+K). Enregistrement : `writeNow()` signale l'échec
  (`okteo:save-error`, voyant « ⚠ Non enregistré ») et le succès (`okteo:saved`) ; `okteo.packData()` = données vivantes.
  `src/ext/okteo-file.js` (buildOkteo/download/fileName, partagé) ; `src/ext/backup.js` : stockage persistant, dossier
  de sauvegarde (File System Access, handle dans IndexedDB `backup:dir`, permission redemandée à chaque session),
  copie 20 s après `okteo:saved`, alerte d'échec. Barre d'outils sur 2 lignes (`.top` / `.top2 #tools`), icônes `TI`,
  appareils = `glyph(t)` dans `.ticon`, menu `#pop-view` (Affichage) qui contient dims/reps/bg/sym/theme/export.
- v22 : `src/walls/doorways.js` (arcs de porte 70–110°, r 0,5–1,2 m ; porte fermée = rayon charnière→mur opposé ;
  mur + porte ajoutés avec coupe en T, si aucun mur n'est déjà le long ; redressé si presque perpendiculaire), appelé par
  `detectWalls(..., {shapes})`. Limites de pièce = murs `virt:true` (epOf 0, pointillés, pas de cote, pas d'accroche,
  `exportGeometry().limits`, imprimés en pointillés) ; `findLimits` / `addLimit` (rooms.js : coupes depuis les angles
  rentrants qui séparent deux noms) ; `okteo.addLimits`, `okteo.batch(fn)` (un seul Ctrl+Z). Type `APP` (applique,
  demi-cercle `asHalf`, famille L, murale, 180 cm). Tableau : texte lisible seulement.
- Lisibilité (v23) : `src/place.js` (Placer = boîtes + grille, `textBox`, `roomCandidates`) utilisé par `draw()` (passe
  « étiquettes » en fin de dessin, `<g class="labels">` ; tailles en px écran via `pmNow()` ; ordre : symboles = obstacles,
  noms de pièces (forcés, déplacés dans la pièce), cotes libres, repères (8 positions, sinon masqués sauf sélection),
  longueurs de murs (masquées sans place)) et par `print.js` (mêmes règles en mm, `doc.getTextWidth`). `symView()` =
  symbole ≥ 12 px. Liaisons en largeur écran, mises en avant pour l'appareil sélectionné. La carte des pièces se recalcule
  sur `okteo:saved` (annuler/rétablir pendant qu'elle est ouverte).
- Niveaux (v24) : meta `levels:[{id,name,fond}]`, `level` (ouvert), `fond` = copie du fond du niveau ouvert
  (`CHS.update` recopie un `fond` dans `levels`) ; `CHS.levelsOf`, `fondKey`/`pdfKey` (RDC : anciennes clés, sinon
  `fond:<id>@<niveau>`). Cœur : `state` = niveau ouvert, `LV.data` = autres niveaux ; `packState` inclut `level`, `other`,
  `levels` (noms seulement : le fond n'est jamais rejoué par Ctrl+Z ; `levelsTrash` garde la fiche d'un niveau supprimé) ;
  `switchLevel` (snapshot, fond rechargé `loadFondImage`, événement `okteo:level`), `addLevel(name,{withWalls})`,
  `renameLevel`, `removeLevel`, `levelsNow()` (toujours relire la liste enregistrée), ids uniques sur tous les niveaux
  (`bumpIds`), niveau du dessous en `g.below`. Interface : `src/ext/levels.js` (barre `#levels`, Page ↑/↓).
- v25 : liaisons entre niveaux = entrées `lia` ordinaires dont un bout est sur un autre niveau (ids uniques) ;
  `allLinks()`, `appIndex()`, `crossLinks()` ({txt écran avec flèche, word pour le PDF}) ; l'outil Liaison garde la
  commande en changeant de niveau (`sel.lv`). `okteo.exportGeometry(levelId)` via `withLevel(id, fn)` (charge un autre
  niveau dans `state` le temps du calcul), `allLevelsGeometry()`, `levelFond(id)` (async, image du fond).
  `buildPlanPdf(geo | [geo…])` : une page par niveau (mise en page commune), nomenclature commune.
  Pièges : pas de flèches ni de caractères hors WinAnsi dans le PDF ; fonctions appelées par `draw()` au démarrage
  = déclarations `function` (pas de `const f=()=>` plus bas : erreur d'initialisation).
- Premiers pas (v27) : `src/ext/tour.js` (visite `TOUR` = [{t: sélecteur, title, text}] → anneau `.tour-ring` + bulle
  `.tour-bub` ; invitation `.tour-invite` à la 1re ouverture, état `okteo.tour.v1` ; onglet « Étapes » enregistré dans
  le panneau, étapes calculées depuis `api.state`/`api.ch`, rafraîchi sur okteo:saved/level/fond/calibrated/tab/printed).
  Toute nouvelle zone importante de l'écran : ajouter une étape à `TOUR`. Ne pas donner la classe `wcard` à ces éléments
  (les tests cherchent `.wcard`).
- Câblage (v28, règles : `docs/regles-cablage.md`) : `src/cablage/` = moteur pur (sans DOM sauf localStorage) :
  `settings.js` (CAB_DEFAULTS, getCab/setCab, `okteo.cablage.v1`, fiche CAB_FIELDS pour Paramètres), `gaine.js`
  (`gaineFor` : v52 somme des sections, R-074), `circuits.js`
  (`computeCircuits(items, links, S)`, `checkCircuits`). Circuits stockés dans le chantier : `K.CAB.circuits`
  (dans `packState`, tous niveaux, annulable) ; `okteo.cab`, `setCircuits(list)`, `showCircuits`, `allApps()` (tous
  niveaux, avec pièce et repère), `allLinks()`, `circuitColors` ; couleur du circuit sur le symbole dans `draw` (`circuitMap`).
  Interface : `src/ext/cablage-ui.js` (onglet « Câblage ») ; réglages dans `settings.js` (page Paramètres).
- Boîtes et gaines (v29–v30) : `src/cablage/boites.js` (`buildUnits` = allumages indivisibles + appareils seuls des
  circuits à boîte ; `placeBoxes(items, links, circuits, tabs, S)` = regroupement avec capacité (v52 : 12 départs sans
  l'alimentation, 6 gaines par face) + médiane de Weiszfeld attirée par le tableau, k essayés ; `faceToward`,
  `assignFaces`) et `src/cablage/gaines.js` (`computeWiring` → boîtes {gaines [{no, face, kind app|alim, label, circuit,
  length, diam, wires [{fn, color, section, n}]}], nets (raccordements, n° 1 = terres)}, direct (lignes directes), issues,
  totals ; `gaineLength` ; rôles des fils : prise, lumière, INT, va-et-vient, télérupteur). Boîtes stockées dans
  `K.CAB.boxes` [{id, n, lv, x, y, apps, manual}] ; tout le reste est recalculé (déplacer une boîte = nouvelles longueurs).
  Cœur : boîtes dessinées si `K.showCirc` (`g.box`, `hitBox`, glisser = `K.boxDrag`, `okteo:box-select`) ;
  `okteo.setBoxes`, `setCab`, `boxSel`. Interface : `cablage-ui.js` (section Boîtes), `cablage-data.js` (`wiringNow`,
  `autoBoxes`), `cablage-pages.js` (onglets Boîtes et Lignes directes). Piège : ne jamais donner la classe `app` à un
  élément (c'est la grille de la page).
- v31 : liaisons (render : `path.lia`, `circle.lia-miss` / `.lia-on` avec l'outil Liaison ; attach.js `linkRole`,
  `linkCtrl`, `hitLink` ; interact.js `linkInfo`/`lightInfo`/`linkSummary` ; `K.linkHot` (Suppr la retire), `K.linkLight`).
  Menu `#pop-relev` (index.html, `popMenu` dans ext/main.js) : `#rv-walls`/`#rv-rooms`/`#rv-devices`/`#rv-ai`.
  `autoScale(api)` (pdf-page.js) : échelle déduite des cotes (≥ 4) si le fond n'est pas calibré (walls-ui, devices-ui,
  ai-releve ; `autoScale.busy` évite la proposition « Relever les murs » en double). Relevé IA : `src/walls/ai-plan.js`
  (pur : `aiPrompt`, `parseAiJson`, `aiToPlan` → murs redressés, sommets fusionnés, T coupés, ouvertures sur le mur le
  plus proche, en pixels × `map` {x0,y0,sx,sy}) + `src/ext/ai-releve.js` (image du fond rognée ≤ 1568 px, aperçu, cases
  murs/pièces/appareils, `fromText(text, map)` pour les tests). ai.js : Claude appelé directement
  (`anthropic-dangerous-direct-browser-access`) quand le relais local manque ; NVIDIA refusé en ligne (message clair).
- v32 : repères par allumage = `repMap()` (view.js) : composantes commande↔lumière (tous niveaux, `allLinks`), numéro
  d'allumage `a.g` (gardé ; sinon celui de la commande s'il est libre), lettre A, B… par famille dans l'allumage ;
  non reliés = `a.n` (déplacé seulement en cas de collision). Familles : SPOT `S`, APP `AP`, VV `VV` (avant L/L/I).
  `repMap()` couvre tous les niveaux (`repOn` s'en sert). Gaines tracées : `box.routes = {appId | "tab": [{x,y}…]}`,
  `viaLen` (gaines.js), face = vers le 1er point ; render `polyline.gaine`, `circle.wp`, cadenas `g.lock` (`lockPos`,
  `hitLock`, `hitRoute`) ; interact : `K.routeDrag` (point créé au 1er mouvement, Maj = droit), double-clic maison
  `K.wpClick` + `removeWaypoint` (le plan est redessiné entre deux clics : le dblclick du navigateur n'arrive pas),
  `routeHint` (distance à la face du mur). `box.locked` (auto au déplacement / tracé) ; `placeBoxes(..., {keep})`
  garde les boîtes non cochées ; `autoBoxes(api, keepIds)`.
- v33 : schémas de boîte = `src/cablage/schema.js` (pur : `parseSizes`, `connectorsFor` (ponts au-delà du plus gros),
  `boxSteps` (une étape par n°), `boxMaterial`, `boxChecks`, `shortLabel`, `schemaSVG(box, steps, {color, sides})`) ;
  n° de raccordement dans l'ordre de câblage (gaines.js : terres, neutres, phases, retours/navettes).
  Alimentation : `packAlim` (gaine.js) = une gaine pour tous les circuits de la boîte, une terre, coupée avant Ø25 ;
  gaine `alim:<i>` avec `circuits` [noms] et `wires[].circuit` ; une seule terre par boîte (1re gaine) ; `placeBoxes` compte ces gaines (`S.alimCount`). Réglage `bornes`
  (« 2,3,4,5,6,8,10,12 », les connecteurs de KiTéOHM). Interface : `src/ext/cablage-bandes.js` (onglet `bandes`, `boxSheets(api)`, `facesSides` dans
  cablage-data.js = pièce de chaque côté, `wireSolid`) + `src/ext/bandes-pdf.js` (jsPDF A4, schéma en JPEG — un PNG
  ferait un PDF énorme —, texte WinAnsi via `win()`). `okteoExt.pages.bandes.ui.last` = dernier PDF (tests).
- v34 : gaines.js `parsePairs` (réglage `pairesCircuits` « rouge/bleu, gris/bleu foncé » : paire par circuit et par
  section dans la boîte, `keyColor` par n°), `couleursCommande` (retours/navettes à tour de rôle, navettes d'un VV de
  même couleur), `memeEndroit` (0,3 m : appareils groupés dans une gaine, fils dédoublonnés par n° ; gaine `appIds`),
  `cableExt` + `cableColors` (appareil `ext` → `g.cable` « 3G1,5 »). `markExterior(api, items)` (cablage-data.js :
  aucune pièce sur l'appareil ni à 12 cm autour). Placement : `spotPts` (un point par endroit). schema.js `boxWires`
  (fils par section/couleur). Couleurs CSS en plus : bleu foncé, ivoire.
- v35 : HUD : `clearSel()` quand on saisit boîte / cadenas / gaine, bouton ✕ (`data-h="close"`). Boîte : Suppr si
  `K.boxSel` sans sélection → `okteo:box-delete` → `removeBoxPlan` (cablage-data.js, allumages vers la boîte la plus
  proche). Bout de gaine : `gaineEnds`/`hitGaineEnd` (render.js, boîte choisie), `K.endDrag` → `okteo:gaine-move` →
  `moveGaine` (cablage-ui.js : même endroit + allumage, boîtes verrouillées, circuits ajoutés à l'alimentation,
  alertes de la boîte). `placeBoxes(..., {count})` (réparti par niveau, plus forts restes), `boxName` = LI01 ;
  n° de gaine `LI01.04` ; anciens noms convertis dans `applyPack`. Liaisons droites (`linkCtrl` = milieu), gaines en
  arc (`gaineCtrl`, `path.gaine`, hit-test sur l'arc). Échelle : `meta.fond.paperW` (m, feuille du PDF),
  `applyRatio(N)` / `okteo.applyScaleRatio(N)`, panneau de l'outil Échelle (`#cr-N`), `ensurePaperW`, `isScanned`
  (pdf-page.js), contrôle par les cotes sur `okteo:calibrated` (main.js). Schéma : nouveau `schemaSVG` (fils `g.w`,
  bornes `.term`, points `.node`, liaisons `.lnk`, attribut `data-c` = circuits) ; calque dans cablage-bandes.js.
  Fils d'appareil : `wires[].circuit`. Exemples de Kévin : `docs/exemples/` (format SPV supposé dans LISEZMOI.md).
- v36 : relevé IA sans clé : `fromPaste` / `pastePanel` (ai-releve.js), réponse JSON avec `"ref":{"W","H"}` = pixels de la page
  entière ; exemples et comparatif des moteurs dans `docs/exemples/` (journal : tableau comparatif).
- v37 : symboles carrés sauf LUM/APP/SPOT (`glyph`, couleur = `var(--c)` : couleur du circuit sur le symbole, rouge `#d33` sans
  circuit sauf lignes directes `circuitMap().__direct` RJ45/PC20/SC ; groupe `g.dev` + `g.circ`/`.nocirc`) ; `appRot(a)` tourne
  l'applique dos à son mur (aussi dans `exportGeometry` → `print.js symbol(..., rot)`). Calques en plus : `boites`, `gaines`,
  `grille` ; filtre rapide `#vfilter` (controls.js `buildFilter`, `viewPreset("bati"|"impl"|"cab")` Alt+1/2/3, `toggleView`,
  `okteo.viewPreset/toggleView`) ; deux barres `#tools .trow.bati` / `.trow.appa` (outil `calib` = Échelle). Quadrillage
  `g.grid.minor/major` (5 cm…10 m selon le zoom, trait marqué au mètre). Boîtes : `boxLayout(b)` (render.js) = côté fixe sur
  le plan (3 symboles, ≥ 34 px), N = `departsFace` points par face (`circle.port`), départs = un par endroit + alimentation ;
  `portLayout`/`portXY` (boites.js, pur, aussi utilisé par gaines.js) range sans croisement, `box.ports` = épinglages
  {appId|"tab": {f,i}} ; bout de gaine (`circle.gend[data-k]`) lâché sur un point = épingle, sur une autre boîte = déplacement.
- v38 (règles KiTéOHM, `docs/regles-cablage.md`) : circuits.js `circuitsByBox` (réglage `circuitsParBoite` : après le
  placement / déplacement des boîtes, chaque boîte a ses circuits éclairage / prises / cuisine, parts égales au-delà de la
  norme, commandes au même endroit sur le même circuit) + `isCuisine` (réglage `motsCuisine`) ; cablage-ui `commitBoxes`
  (boîtes + circuits en un Ctrl+Z), `withAllumage` (on ne coupe jamais un allumage), `fixSplits` (`okteo:fix-splits`).
  gaines.js : `pairOf(kind)` (couleursPrises/Eclairage/Cuisine/Specialise), `bagueOf` (C5 → « 5 », `w.bague` sur
  l'alimentation, T1… télérupteur), ronde par boîte avec harmonisation (`boxGroups` + fréquence des compositions),
  `chooseCable`/`parseStock`/`cableCores` (âme `w.core`, fil `fn:"isole"`), `W.splits`, `W.series` + `g.serie`.
  schema.js : accolades `g.bague`, gaine de câble `g.cable`, `wireName(w)` (« marron repéré orange »). Réglages : version
  `_v` (anciennes valeurs de base remplacées, `OLD_DEFAULTS`). Plan : `line.split` + `g.split-mark` (allumage coupé).
- v39 : modes de pieuvre (boites.js `placeBoxes(..., {mode, rooms})`, `MODES`) : `proximite` (k-means avec capacité,
  le moins de cuivre), `equilibre` (`bisect` : coupes successives à parts de départs égales, même k que la proximité,
  boîte au point médian sans attraction du tableau), `piece` (`placeLevelRooms` : pièce des lumières de l'unité
  `u.room`, petites pièces < `piecesMinDeparts` gaines rattachées à la voisine, extérieur → pièce la plus proche, coupe si
  trop chargée, boîte dans le polygone de la pièce) ; `boxOk`, `seat`. Mode du chantier : `K.CAB.mode`. ext :
  `roomsByLevel`, `autoBoxes(api, keep, count, mode, circuits)`, `compareModes(api)` (cablage-data.js) ;
  `src/ext/pieuvre-compare.js` (`.cmpcard`, mini-plans, chiffres, « Appliquer » = `setCab({mode, boxes, circuits})`),
  `okteo:compare-modes` ; onglet Câblage : `#bx-mode`, `#bx-cmp`.
- v40 : packs = `src/cablage/packs.js` (pur : `PACK_DEFAULTS` norme + pratique KiTéOHM, `parseItems` « PC16×3, LUM, INT »
  / « PC16×norme » (`prisesNorme`), `packFor(nom)` (mots, le plus long gagne), `missing` (décompte par famille :
  commande INT/VV/BP, lumière LUM/SPOT/APP), `placePack(room, openings, need, existing)` → commande à côté de la porte
  côté poignée (15 cm), lumières au centre, prises/RJ45/SC réparties sur le contour loin des ouvertures et des angles,
  RJ45 à côté d'une prise, liaisons). `src/ext/packs-ui.js` : onglet « Packs » (`okteoExt.packs.rooms/completeAll/
  completeOne/pieuvre`), packs dans localStorage `okteo.packs.v1`, éditeur ; pieuvre type = compléter + boîte verrouillée
  `{pack}` au centre de la pièce + circuits (`api.batch`). `importDevices` : liaison vers un id existant, renvoie `ids`.
- v41 : bandeau `.top2` en trois encarts `.grp` (`.glab` = titre) : `.grp-act` (#tools), `.grp-view` (#vfilter), `.grp-pan`
  (#panes = boutons des panneaux, rendus par `ext/panel.js`). `createSidePanel` (clé `okteo.side.v2`, 280 px) : `show`,
  `toggle` (2e clic = fermer), `close(id)`, `isOpen`, `state.open` ; panneau fermé = `.side.collapsed{display:none}` ;
  `#side-head` = titre + croix `.col`. Assistant = `register({..., dock:true})` → encart `#as-dock` dans `.stage`
  (`.dk-pill` réduit, `.dk-card` agrandi, `.dk-min`, Échap) ; plus de `#btn-assistant`. Un encart agrandi couvre le bas
  droit du plan : les tests qui cliquent sur le plan le ferment d'abord (`okteoExt.panel.close("assistant")`).
- v42 : `src/prefs.js` (partagé cœur + extensions : `getPrefs`, `pref(k)`, `setPref` → `okteo:prefs`, localStorage
  `okteo.prefs.v1`) ; `surfaces` (faux par défaut) masque les m² dans render.js (étiquettes, aperçu), panel.js, rooms-ui,
  packs-ui et print.js (option `surfaces`). Paramètres : `mountParams(el, {…, openPacks})`, sections `.pset-sec`
  (#ps-aff, #ps-ia, #cab-set, #ps-packs), sommaire `.pset-nav`, recherche `.pset-find` ; `CAB_FIELDS` = [titre, lignes, aide].
- v43–v45 : `src/core/check.js` (`controlIssues()` → [{kind cmd|lum|vv|circ|split, ids, lv}], `linkTables`, essai :
  `K.essai` {sw, tl, off}, `lampLit`, `litSet`, `essaiPress(id)` (lumière → sa commande), `setBreaker`, `testAll()`) ;
  `src/core/fx.js` `fxDraw(items)` = couche `<svg id="fx">` (au-dessus de #sv, pointer-events none) dont les éléments
  sont gardés par clé (`halo:<id>`, `glow:<id>`) : ne jamais la reconstruire dans `draw` (animations). `drawFx()` en fin
  de `draw` : `K.ctl`, événements `okteo:control` (liste changée) et `okteo:essai` (mode changé). API : `okteo.control`,
  `controlKinds`, `okteo.essai` {press, reset, lit, off, breaker, testAll}, `setEssai(on)`. Préférence `halos`.
  Ext : `controle-ui.js` (compteur `#ctl`, `go/next`, `controlSection` en tête du panneau Câblage), `essai-ui.js`
  (`.essai-card`), packs-ui `openMenu/applyPack` (événement `okteo:pack-menu` envoyé par le bouton `data-h="pack"`
  du HUD pièce ; Maj+P ; `.pk-menu`). `exportGeometry().rooms[].id`. Visite : 28 étapes (3D-1).
  v45.1 : `linkTables` ne compte que les vraies commandes et suit les chaînes de lumières ; alertes `int2`, `nobox` ;
  quadrillage `layers.grille.on=false` par défaut (drapeau `g451` dans les données enregistrées).
- v46 : `src/cablage/tableau.js` (pur : `MODELS` Resi9, `autoTableau(circuits, {model, area})`, `syncTableau`,
  `tableauIssues`, `protections` (ID = le plus proche à gauche sur la rangée), `moveItem`, `addBreaker`, `newId`,
  `suggestModel`) ; `cab.tableau = {model, rows:[[{k:"id"|"cb", id, a, type?, c?, w}]]}` (absent = disposition auto non
  enregistrée) ; page `src/ext/tableau-page.js` (onglet `tableau`, glisser-déposer HTML5, manettes `[data-cut]` /
  `[data-lev]` → `okteo.essai.breaker`).
- v47 : numérotation des raccordements par circuit (gaines.js `RANK` cuisine, spécialisé, prises, éclairage : N puis P) ;
  `g.reps` (repères des appareils de la gaine) ; schema.js : faces + pièces en `g.face[data-f]` aux bords, titres
  3 lignes, plus de `FN_TAG` au bout des fils, `orderLines(steps)`, `BOX_MODELS` ; cablage-data `facesSides` (pièce des
  gaines de la face) + `facesLook` (ancienne règle) ; cablage-bandes `boxSheets` → `order`, `tabAng`, `code`, `model`,
  `cover` (`box.cover` haut|bas), `arrowSVG` ; `src/ext/barcode.js` (`code128` via jsbarcode CODE128B, `bars`,
  `barsSVG`, `boxCode`) ; bandes-pdf.js page 1 = étiquette. Playwright : garder la version qui correspond au navigateur
  installé (`npm install --no-save playwright@1.63.0` si `npm install` la change).
- v49 : `src/cablage/bande-code.js` (pur : `packSheet`/`unpackSheet` (feuille réduite), `encodeSheet`/`decodeSheet`
  (CompressionStream deflate-raw + base64url), `sheetUrl(S)` → `PUBLIC_BASE` + `bande.html#b=…`, `tooBig` > 2 900) ;
  page téléphone `bande.html` + `src/bande-view.js` + `src/bande.css` (2e entrée Vite : `build.rollupOptions.input`) ;
  `barcode.js` `qrMatrix` (bibliothèque qrcode 1.5.4, niveau L) / `qrSVG` ; QR dans cablage-bandes (`#bd-qr`,
  `data-url`) et bandes-pdf (34 mm, bas droite). Tableau : `MODELS[].brand/range` (Resi9 + Drivia), `BRANDS`, `MODS`
  (appareillage modulaire, `{k:"mod", t, w, label}`), `addModular`, `removeItem` ; `.tb-brand.se/.lg`. interact.js :
  clic sans glisser sur un appareil `TAB` → `setTab("tableau")`.
- v50 : `src/ext/labels-pdf.js` (`buildLabelsPdf(sheets)` : 4 étiquettes 148,5 × 105 par A4 paysage, `schemaSVG(..., {big})`)
  ; `src/ext/dossier.js` (`buildDossier(api)` = garde + `buildPlanPdf` + `buildTableauPdf` + `buildBandsPdf`, fusion
  pdf-lib ; `tableauNow`, `downloadBlob`) ; `src/ext/logo.js` (`logoData()` → assets/kiteohm-logo.jpg, `LOGO_RATIO`) ;
  print.js : logo dans le cartouche (`o.logo === false` pour l'enlever). Onglet Bandes : `#bd-lab-one`, `#bd-lab-all`,
  `#bd-one`, `#bd-all` (bandes détaillées), `#bd-dossier` ; `ui.lastLabels`, `ui.lastDossier` (tests).
- v51 : journal des règles de câblage = référence des règles KiTéOHM. Source : `docs/journal-regles-cablage.md` (tenu avec
  Kévin) → `npm run regles` (scripts/regles-import.mjs) → `src/cablage/regles-data.js` (généré, ne pas modifier) ;
  `src/cablage/regles.js` (`getJournal`, `stats`, `totals`, `filterRules`, `ecarts(J, getCab())`, `CAB_RULES`,
  `propose`/`apply` (historique `local:true`), `autoriserModification`, export/import, `journalForAI`) ;
  `src/ext/regles-ui.js` (`mountRegles`, section `#ps-regles` de Paramètres : choix du chantier `K.CAB.mode` +
  `K.CAB.choix {volets, raccordement}`, écarts, tableau `.rg-row`, fiche `.rg-fiche`, `.rg-ask`) ; assistant : action
  `{"do":"rule",op,id,patch|rule,motif}` → carte `.rg-prop` (`.rg-ok`/`.rg-no`), jamais appliquée sans validation.
  Note de passation et plan 52–54 : `docs/remarques-dev-journal-regles.md`, feuille de route. Chantiers de test : `docs/chantiers/`.
- v52 (règles du journal dans le moteur) : gaine.js `gaineFor(sections, S)` = somme des sections (R-074, `icta16`
  7,5 / `icta20` 13,5, null au-delà = doute), `packAlim(circs, S)` ; boites.js `departsOf` = endroits desservis SANS
  l'alimentation (R-001, `departsMax` 12), `faceDeps` (faces avec l'alimentation) ; gaines.js : ronde R-072 par
  emplacements (`slots`, `keySpots`, `touch`/`clash`, marron imposé pour les lumières en câble, `rondeBague` → `w.bague`
  sur les gaines d'appareil), n° R-077 (rotation horaire depuis `alim:0`), `g.sum`, `g.bouchon`, `g.rules`,
  `box.longueur`/`bouchons`/`rules`, `W.doutes` [{rule, text, box, bloquant}] (aussi en texte dans `W.issues`) ;
  cablage-bandes `aVerifier(ids)` → `S.verifier`, `S.longueur`. Tests : `scripts/chantiers.test.mjs` sur
  `scripts/fixtures/chantiers-ftz.mjs` (4 chantiers FTZ, positions schématiques).
- v53 : `src/cablage/etude.js` (pur : `STEPS` (9), `ETATS`, `neededRules`/`precontrole(J, ctx)`, `contextOf`, `buildTrace`
  → {steps[{state, decisions[{rule, state, text, box, ids, question}]}], alternatives (rang Q-77), where, counts},
  `scoreOf`/`cmpScore`, `questionOf`, `whyBox`/`whyGaine`/`whyWire`, `statsOf`) ; `src/ext/etude-ui.js` (`etudeNow(api)`,
  `cabler(api)` (api.batch : un Ctrl+Z, `cab.etude`), `buildReport`, page `#etude` (onglet « Étude », `.et-step[data-n]`,
  `#et-cabler`, `#et-report`, `#et-where`), `createDoubts` (compteur `#dbt`, `okteo.setDoubts` → `K.doubts` → fx
  `.fx-doubt`), `createWhy` (carte `.why-card` sur `okteo:box-select` {id, key}), stats localStorage `okteo.etudes.v1`).
  Assistant : une commande du catalogue peut renvoyer un texte (compte rendu). gaine.js `GROS_FILS` {6: 20, 10: 25}.
- v54 : `src/cablage/appareils.js` (pur : `APPAREILS` {n, r, h, lab, groupe, mural, racc direct|boite|choix, lignes
  [{fils "2,5 B+R+V/J" | cable, gaine 16|20|"V20"|40|null}], variantes, circuit {section, prot}, faible, volet, voletCmd,
  terre}, `GROUPES`, `raccOf(a)`, `lignesOf(a)` (variante `a.var`), `parseFils`, `gaineLabel`, `isVolet`, `isFaible`) ;
  cœur : TYPES étendus (model.js), `glyph` par défaut (abréviation), `wallMounted` (+ `muraux`), `linkRole` CVR → c,
  VR/VEL → l (volet sans CVR = connecté, pas d'alerte), bouton `[data-tool="__more"]` + `.more-pop` (K.moreOpen),
  Propriétés `raccHTML` (`#f_var`, `#f_racc`, `#f_p`), `allApps()` ajoute var, racc (hotte : choix du chantier), p.
  Moteur : circuits `volets` (`maxMoteurs`, `voletChunks`), `comm` = courant faible + lignes sans disjoncteur ;
  boites `u.volet`, option `placeBoxes(..., {volets})` ; gaines : rôles CVR/VR (`cmdV1`/`cmdV2`, slots `pref` marron/noir),
  EQL (terre 2,5), `W.direct[{etiquette, fil, gaine, gaineTxt, diam, faible, aboutissant}]`, `W.directTotals`.
  Page « Lignes directes » `.dl-tab`. Fixtures : volets, EQ locales, hotte, 28 lignes directes de DUCOURNEAU.
- v48 (livrée après la 54) : impression complète. `okteoGeo()` rend `boxes` (deps {face, slot, tab, ends [{key, x, y,
  route, color}]}, depuis `boxLayout(b, 1)`) et `apps[].color/circuit` ; print.js : options `murs, ouvertures, pieces,
  appareils, boites, gaines, circuits, gaineNos`, `rgb(hex)`, `symbol(..., col)`, boîte = carré `BS` mm (portXY en
  mètres `BS/f`), n° de gaine horizontaux sur fond blanc ; print-ui : cases `.pr-layers`, `fromView()` à l'ouverture
  (calques + `showCircuits`), `.pr-fromview`, `gaineNos()` via `wiringNow`. Journal : `pendingQuestions(J)`,
  `filterRules(..., {attente})`, bouton `#rg-f-wait`, `.rg-wait(.col)`.
- v55.1 : ai-plan.js `AI_TYPES` = 12 de base + `APPAREILS` (descriptions `HINT`), `promptBody` commun, `aiPrompt` (avec
  clé) et `pastePrompt()` (sans clé, « ref » page entière) ; import : `h` (cm, 0–300) et liaisons CVR → VR/VEL ;
  ai-releve `#ai-copy` (presse-papiers avec délai 1,5 s, sinon dans `#ai-paste`), `okteoExt.aiReleve.copied`.
- v55.2 : `parseAiJson` accepte les guillemets typographiques (2e lecture) ; ouverture sur un morceau de mur trop court
  ou décalée → recentrée / rétrécie (≥ 0,4 m), `stats.ouverturesAjustees`.
- v56 : réglages `departsMax` 16 (`CAB_V` 4, `OLD_DEFAULTS` valeur ou liste) ; gaines.js n° anti-horaires (R-077),
  `etiq` (RJ45 → RJn), `directTotals` par diamètre (V20 dans ICTA 20, YSYT) + `directVertes`, découpage R-073 (somme >
  `icta20` → prises / commandes séparées), doute R-096 ; boites.js `placeLevelBalanced` depuis `minBoxes` (Équilibrée =
  le moins de boîtes), `bisect` pondéré par `departsOf` ; circuits.js `isCuisine(a, S, items)` = `a.pt` ou
  `planTravailAuto` (R-098, `APP_CUISINE`), `isCuisineRoom` ; appareils.js ILOT / BPS / SON (`eclairage: true` → circuit
  éclairage), `sansCvr(items, S)` (S.voletsConnectes) appliqué dans computeCircuits / circuitsByBox / placeBoxes /
  computeWiring ; ext `cabS(api)` (réglages + choix du chantier `commandeVolet`) à passer au moteur au lieu de getCab() ;
  `markExterior` ignore VR/VEL ; `okteo.setGaineGroups` (K.gaineGroups) : boxLayout suit le découpage des gaines ;
  Propriétés `#f_pt` ; Câblage `#bx-cvol` ; journal `#rg-cvol`. Référence : `scripts/maillard.test.mjs` (recâble
  `docs/chantiers/MAILLARD_kevin.okteo` via `scripts/chantier-wiring.mjs`, options `--recable --connecte --mode= --departs=`).
- v58 : `autoSymCm()` (view.js) + `K.symAuto` (persist `symAuto`, case `#symauto`) ; `spreadSymbols(items, D)` (place.js)
  → `K.dispPos` (render : symbole au point affiché, `g.leader`, `g.dev[data-id]`, `data-moved` ; repères, halos, `hitApp`) ;
  `wallU(a)` ; `exportGeometry().apps[].wall`, print.js même décalage en mm, `u ≥ 1,6` ; boîte `S = max(symCm·2,2/100,
  26 px)`, print `BS = max(3,6 u, 9)` ; noms de pièces `r.lx/r.ly` (glisser : `K.labelDrag`, `K.roomLabelBoxes`,
  `okteo.roomLabels`), `K.roomTxt` (`setRoomTxt`, `#roomtxt`, `#r_txt`, `#r_lab`, `geo.roomTxt`, `rooms[].labelFixed`) ;
  rotation de la vue `K.view.rot` (`viewRot`, `W2V`/`V2W` tournés, `viewTransform()` pour `g.world` et fx, `viewWorldBox`,
  `rotExtent` dans fit/zoomToBox, `rotateView(deg, abs)`, `upright(svg)` pour les textes, symboles contre-tournés,
  boutons `#vr-*`, `okteo.rotateView/viewRot/shownAt/symCm`).
- v57 (0.58.1, après la 58) : hors plan R-100 = `src/cablage/horsplan.js` (pur : `HP_ITEMS`, `proposal` (registre
  localStorage `okteo.horsplan.v1`, `HP_SEED` MAILLARD, coché ≥ `HP_FREQ` 80 %), `placeHorsPlan(list, rooms, {tab, have})`,
  `recordChantier`) + `src/ext/horsplan-ui.js` (`hpSection`/`wireHpSection` dans le panneau Câblage `#hp-sec`, `#hp-go`,
  `poserHorsPlan` = `api.batch` : `cab.horsplan` + `importDevices(..., hp:true)`) ; marque `rect.hp-mark` (render),
  Propriétés `#f_hp`/`#f_hpok`. Relecture ciblée : `src/walls/ai-recheck.js` (pur : `recheckPoints` (cadre {x0,y0,w,h}
  en m, positions en %, `done`, `a.aiNo` exclus), `recheckPrompt`, `parseCorrections` → {links ("add:i"), adds, nope,
  errors, silent}, `shouldContinue`) + `src/ext/ai-recheck-ui.js` (`.rkcard`, `#rk-copy`, `#rk-paste`, `#rk-read`,
  `#rk-ok`, `#rk-auto`, `#rk-stop` ; `loop({max, ids})` sur `okteo:ai-releve` {devices, mode:"key"}, préférence
  `relectures` 0–3 dans prefs.js, `#pref-relect`). Consigne : `gx,gy,vx,vy` → `hinge`/`swing`, `t:"garage"`, `pt`.
  Ouverture `kind:"garage"` (render, levels sans arc, print, panel, hud). API `setAppFlags`, `removeApps`.
- v59 : `src/cablage/trace.js` (pur : `ctrl`, `curve`, `segX`, `polyCross`, `chooseBows(list [{key "boîte|clé", P, T}], fixed)`
  → Map clé → k parmi `BOWS`, `crossings`) ; boites.js `portLayout` + `uncross` (échanges / point libre, `PORT_S` 0,6 m,
  face tournée vers l'appareil, épinglées fixes ; deps `pts` = tous les appareils de la gaine, passés aussi par gaines.js) ;
  render `levelBows` (cache `K.bowCache`, gelé pendant un glisser), `K.gaineBows`, `bowOf(boxId, key)` (hitRoute, tests),
  `gaineCrossings()` → `okteo.gaineCrossings()` (`#bx-cross` dans le panneau Câblage) ; attach `gaineCtrl(b, a, k)` ;
  print.js `chooseBows` avec ses points d'accroche. `chantier-wiring.mjs` rend `traces` {gaines, intra, total, sansAlim, arcUnique}.
- v60 : schema.js `routeInside(box, tr, term)` → {nodes (connecteurs `g.node` rect), links (`path.lnk` « M x y L … »), fails}
  (couloirs réservés H/V, propriétaire `o` = fil, départs B/D réservés d'avance, entrées et demi-entrées, espacement 9 →
  4,5), `BOX` (IN0/IN1 derrière 2 rangs de bornes), `overlaps(links)` ; bornes en quinconce (`stag`, `term.stub`) ; gaines
  triées par `slot` sur chaque face ; `trancheOrder(box, f, n)` (vue de l'extérieur = rang décroissant), `tranchesSVG(box,
  {sides, n})` (`g.tranche[data-f]`, `g.trou[data-no]`, `circle.trou.libre`) ; Bandes `.bd-tranches`, `#bd-tr-h` ; bandes-pdf
  page 2 « perçage des tranches » (`svgToPng(svg, px, py)`) ; bande-code : 10e élément de gaine = `slot` ; bande-view `.tr`.
- v61 : ai-recheck.js `recheckPoints(ctx {apps (a.out), issues, openings, missing, lost, remarques, nope, kitchen}, {frame,
  done, max 20, maxDoors 8})` (sortes `RECHECK_KINDS`, ordre `ORDER`, `EXT_OK`), `recheckPrompt(P, {mode, page, zoom})`
  (rubriques selon les sortes), `parseCorrections` → {links, adds, types, moves, dels, heights, opens, doors, walls, nope,
  nopeKeys, acts Map clé → textes, errors, count}, `recheckReport(points, C, still)` → {rows, total, ok, pct} ; ai-plan.js
  `doorSense`, openings `ai`/`adj`/`sens`, `plan.lost`, devices `hNo`, `pastePrompt({page})`. Cœur : openings `aiRel`,
  `aiAdj`, `aiSens` ; apps `hNo` ; API `openingsInfo()`, `updateApps(list)`, `placeOpening({id, x, y, w, kind, g, v})`,
  `addWalls(list)`. ext : ai-recheck-ui.js `recordReleve` (appelé par ai-releve add), `releveOf`, `cab.releves[lv]`
  {pieces, lost, remarques, nope, rapport[]}, `zooms` (Claude : `images` en plus dans `chat`), `reportHTML`/`reportText`
  (Étude `#et-ia`, `#et-ia-copy`, `.ia-pass`), carte `#rk-rep`, `#rk-again`.
- v61.1 : render `levelBows` par boîte (`K.bowCache` = Map boxId → {sig, map}, gelé pendant glisser et molette
  `K.wheelAt`) ; view `pxPerVB` sur `K.svSize` (ResizeObserver `K.svObs`, mis à jour par `syncVB`).
- v63 : Mode IA = `src/ext/ia-mode.js` (`createIaMode({api, aiReleve, recheck, ctl})` : colonne `#iapane` dans `.main`,
  `.ia-step[data-s=1..7]` done|todo|wait, boutons `#ia-plan`, `#ia-scale`, `#ia-rel` (clé) / `#ia-rel-paste` (sans clé),
  `#ia-rk-auto`, `#ia-rk`, `#ia-hp`, `#ia-mode`, `#ia-cab`, `#ia-alerts li[data-i]` (contrôle + doutes + `a.aiNo`),
  `#ia-dossier` (`lastDossier`), `#ia-rep`, `#ia-cost`) ; bascule `#mode-sw [data-m]` + Alt+M, préférence `ui` be|ia,
  `body.mode-ia` masque le bandeau BE, événement `okteo:ui`. `src/ext/temps.js` (`createTemps` : temps BE dans
  `meta.temps {be, ia, days}` via `CHS.update`, 15 s par tick si activité < 2 min ; `iaUsage(api)` = jetons
  `rapport[].tin/tout` de `cab.releves` ; `estimateReleve`, `coutTemps`) ; prefs `prixIn`, `prixOut`, `tauxHoraire`
  (Paramètres `#ps-couts`, `[data-cost]`). `chat()` renvoie `usage` ; `recordReleve(..., {usage})`.
- v62 (0.63.1, après la 63) : `src/cablage/qualite.js` (pur : `CRITERES`, `POIDS` {commun, proximite, equilibre, piece},
  `intrusions(groups)` (appareil au fond de l'enveloppe d'une autre boîte et nettement plus près d'elle), `mesures(W, {items,
  boxes, S})` → {croise, terr, cuivre, gaine, boites, equil, longues, pieces} (boîte des volets sans territoire), `noter(list)`
  → [{note, ok, pen}], `noteOf`) ; boites.js `wiresOf(a)`, `spotPts(..., cu)` (poids = fils), `levelCost` (cuivre +
  `coutBoite` par boîte + `TERR_COST` par intrusion), `absorbSmall` (boîtes < 3 départs), `voletsBalanced` (`VOLETS_SPAN`),
  `MODES.proximite` = « Économique » ; réglages `coutBoite` 25, `gaineLongue` 12 ; ext `compareModes` → `r.q`, `r.note`,
  `noteNow(api, W)` (cablage-data.js), `.cmp-note` ; étude : alternatives `note`. Impression : print.js `rotateGeo(geo, deg)`
  (option `rot` de `buildPlanPdf`, `rotImage` pour le fond, boîtes `b.rot` → `portW`), print-ui case `sensVue`
  (`#pr-rotwrap`), dossier `rot: api.viewRot`.
- v62.1 (0.63.2) : mode `zone` (boites.js `ZONES`, `ZONE_MOTS`, `zoneOfName` (mots ≤ 3 lettres entiers), `zonesOf(rooms)`
  (voisines à moins de 35 cm), `placeLevelZones` ; boîtes `zone`) ; `autoBoxes` passe `rooms` pour piece et zone ;
  qualite.js ignore les gaines tracées à la main (`box.routes`) ; compareModes : départs sans l'alimentation.
- v64 : `src/ext/one-card.js` (`createOneCard()` : MutationObserver ; une carte `CARDS` = `.wcard:not(.save-alert), .cmpcard`
  qui devient visible ferme les autres par leur `.wx` ; `okteoExt.oneCard`) ; compteur unique `#ctl` (controle-ui : doutes
  reçus par `okteo:doubts` {detail: liste, box, ids}, `goDoubt`, classe `blq`) ; `#dbt` toujours caché ; onglets : controls.js
  `PIEUVRE_TABS`, bouton `data-tab="boites"` libellé « Pieuvre », `K.pieuvreSub` ; index.html `#pg-pieuvre` (`.pgroup`) +
  `#subtabs [data-sub]` + sections boites/bandes/lignes ; tests : `goSub(sub)` dans smoke.mjs (jamais
  `#tabs button[data-tab="bandes"]`). Câblage : `#cb-circ` (details, `circOpen` = clic sur le titre seulement), boîtes en
  premier quand il y en a, aides `.info[title]`. Visite : 28 étapes (3D-1).
- v64.1 : ai-plan.js `method(first)` (Méthode obligatoire : définition, légende, quarts, décompte) dans `promptBody(coords,
  first)`, `METHOD_PASTE(page)`, `MIN_REF_W` 3 000 (ai-releve : alerte « basse définition » au collage).
- v66 : tableau.js `nbIdCommuns(n)` (max(2, ceil(n/8)), R-127), `idCalibre(cs)` / `idCalibreMin` (R-124, `isHeavy`),
  `GTL_INTERDIT` (R-105), `tableauIssues(tab, circuits, ctx {tabRoom, rj45})` (alertes préfixées « R-1xx : ») ;
  `tabCtx(api)` (tableau-page.js) passé aussi à `buildTableauPdf(..., {ctx})` ; `idsAC(area)` n'est plus utilisé.
  Journal : R-101 à R-161, Q-89 à Q-110 (regles-import accepte `Q-\d{2,3}`).
- v66.1 : `autoTableau(circuits, {model, previous})` conserve les accessoires de `previous` (rangée, identifiant,
  largeur, libellé), avec `reviewPlacement` jusqu'à revue par le BE. Fractionne les groupes au-delà de 63 A calculés.
  `idCalibre` et `suggestModel` peuvent retourner `null` (aucun matériel disponible). Suggestions dans la même marque,
  réserve sur capacité totale ; H-045 corrige R-144 sans modifier son statut normatif. Tests de régression dans
  cablage.test.mjs et smoke.mjs. Les références d'appareils et leur raccordement électrique restent à compléter.
- Version en ligne : Cloudflare Pages (voir « À LIRE EN PREMIER »), construite par `npm run build:web` à chaque push sur
  `main`. Le relais `/ai/*` de Vite n'existe qu'en local ; en ligne, `/ai/anthropic` est le Worker `server/worker.js`.
- Un objet `window.__okteo` expose `state` et `draw` pour les tests.
- 05/11/2026 (plan fluide) : événements fréquents (molette, `pointermove`) → `drawSoon()` (un dessin par image), jamais
  `draw()` directement ; `syncVB(false)` dans `draw` (pas de `getBoundingClientRect`) ; le fond est un seul élément
  `<image>` gardé (`K.bgEl`, `g.bgslot`) : ne jamais le remettre dans le texte de `sv.innerHTML`.

### Grosse mise à jour du 05/11/2026 (lots 1 à 6) — détail : journal du 05/11
- Un seul mode d'analyse IA (mode 4) ; `modesIA = "dev"` réservé aux essais. Réponse collée bloquée si l'échelle de l'IA
  diffère de plus de 10 % du fond (`askScale`). Échelle : `src/walls/echelle.js`, digits.js `solveReadable` / `cotValue`,
  pdf-page.js `plausible`. Étiquettes : place.js `clipSeg`, `MAX_BOXES`, `Placer.big`.
- Mémoire des symboles commune : Worker `/api/symbol-memory` (+ `/delete`), symbol-memory.js `syncMemory` /
  `variantsOf` ; `api.planSymbolMarkup` ; « Pourquoi ça clignote ? » `.why-fix` (type, variante, je ne sais pas, nav).
- Navigation : `src/ext/home-shell.js` (logo = accueil, `body.page-full`, `#cl-fold`, bandeau en ligne dans `#home-head`,
  `#web-warn`) ; plus d'onglet Chantiers (tests : `okteo.setTab("chantiers")` ou `.top .brand`).
- Packs : panneau caché (`register({hidden})`), éditeur dans Paramètres (`mountEditor`), « ⚡ Implantation rapide »
  (`okteo:pack-quick`). Boîtes : `BOX_MODE = "be"` seul à l'écran.
- Étapes : 9 étapes, validations `cab.etapes`, jauge `#st-gauge`. Relevé : ai-align.js `mergeBands`, ai-plan.js
  croisements en X coupés.

### MAJ du 05/11/2026 après-midi (pieuvres, mémoire, affichage) — détail : journal du 05/11
- Pieuvres (mode BE) : boites.js `splitGroup` (pièces entières), `wallRuns` / `wallParts` (pans de mur), `settleBoxes`
  (moins de croisements entre boîtes, 1 m entre deux boîtes), `boxCrossings` ; séjour → cuisine par pan de mur.
- Mémoire : fiches `lu` / `inscription` ; `src/walls/ai-memory.js` (`memoryFixes`, `memoryPrompt`) ; ai-releve
  `memoryStep` ; consigne copiée `pastePrompt({memory})` ; outil « legende » avec images (`out.images`).
- Affichage : bandeau 1 toujours visible sur une ligne (`#web-dot`, pas de jauge), bandeau 2 seulement plan et 3D.

### MAJ du 06/11/2026 (mémoire par pavillonneur ou pour tous, pose)
- symbol-memory.js `keyOf` (pavillonneur vide = « (sans pavillonneur) »), fiches `tous` (case `#why-tous`, `[data-tous]`,
  `setTous`, colonne serveur `tous`), `own` prioritaire ; `freshMemory` (avant collage / analyse avec outils),
  `startMemoryTimer` (5 min) ; ai-memory.js `doubtKey` / `readKey` (hésitation « A ou B ») ; `api.setClient`.
- check.js `POSE_OFF` : plus d'alerte battant ni embrasure (pose.js garde les fonctions).

### Page Paramètres et catalogue des règles (06/11/2026, lot 1)
- Paramètres = interface à part, plein écran, fond corail (`body[data-tab="params"]` masque bandeau, onglets, panneau).
  `src/referentiel/catalogue.js` (pur) : `RUBRIQUES` (« Règles KiTéOHM » / « Ce poste »), `FICHES` (id fixe AA-00, état
  actif | decide | question | plustard | ecarte | info, source, usage, `cab`), `QUESTIONS`, `catalogueTexte`, historique.
  Toute nouvelle règle métier = une fiche (ou une fiche passée en `actif`) ; jamais de prix ni de nom de client.
  settings.js : une rubrique à la fois (`ui.setActive`), recherche dans toutes, `#pp-back`, `#pp-export` ; ouvrir une
  rubrique depuis ailleurs : `okteo:params-goto` {detail: id}. Thème : préférence `theme` + `applyTheme`.
  Tests smoke : `openParams(rub)`, `toPlan()` (jamais `#tabs button[data-tab="plan"]` depuis Paramètres).

### Reprise des paramètres du BE — lots 2 et 3 (06/11/2026)
- R-074 en PLACE occupée (gaine.js `PLACE_FIL`, `placeCable`, `placeFils`, `gaineFor(fils, S, {cable})`, ICTA 16 = 44,
  ICTA 20 = 90) ; calibres éclairage 10 A, cuisine 16 A, radiateur 10 A ; ronde O, IV, M, N, V ; surlongueur des FILS
  seulement (`gaineLength` sans marges, `coupeFils`) ; association du BE `src/cablage/association.js` `assocOK`
  (gaines.js ET boites.js `spotPts`) ; âmes des câbles X. Options Propriétés `#f_et` (`a.et`), `#f_tem` (`a.temoin` :
  neutre en plus), hauteurs rapides `[data-hq]` ; obstacles TR50 / TR100 / TR200 / RS50 / RS100 (zones d'exclusion).

### Norme NF C 15-100 (MAJ norme du 06/11/2026) — bible : document du projet claude.ai « Bible des règles Oktéo »
- RÈGLE DE LICENCE : aucun texte de norme dans le dépôt ni dans les consignes de l'IA (exemplaires sous licence, hors
  dépôt) ; seulement nos résumés, les valeurs et les numéros d'article. Les règles de la norme = ALERTES SIMPLES (Kévin),
  jamais bloquantes : l'impression reste toujours possible.
- `src/norme/nfc15100.js` (pur) : `REGLES` (91 codes stables PC-01… DOC-05, niveau O / R / BE, article 2024, résumé, R-xxx
  du journal), `refOf(code, v)`, `art2015`, `versionFor(meta)` (2024 si permis déposé après le 31/08/2025 ; `meta.permis`,
  champ « Dépôt du permis » de la fiche du chantier), `okteo.normeVersion()`.
- n° 2 : `src/norme/pieces.js` (`roomKind`, `prisesSejour`, `checkPieces` → PC / ECL / COM, clé « norme:CODE:pièce ») ;
  `src/ext/norme-ui.js` (`okteoExt.norme`) : section « Norme » du panneau Étapes (`#nm-host`), Voir / Question au
  pavillonneur (`cab.questions`) / Voulu (`cab.decisions[key].choix = "garde"`) ; après un relevé IA, la ligne d'aide
  annonce les points sous le minimum (lecture du plan avant dessin).
- n° 3 : volumes.js aligné sur 2024 (volume 2 = même hauteur que le volume 1, 2,25 m ; volume 0 de la douche à
  l'italienne jusqu'à 10 cm), textes `volumeRule` avec code SDE, `volumeZones` → `placeBoxes` repousse les boîtes hors des
  volumes 0 à 2.
- n° 4 : `src/norme/circuits.js` (`NORME`, `prisesMax`, `protMax` (tableau 10-1F), `normeCircuits`, `normeSettings`) ;
  `checkCircuits` y ajoute les dépassements de la norme (`issues[].code`) ; Paramètres → Câblage `#cab-norme`.
- n° 5 : tableau.js `needsF` (type F : PAC, clim, piscine), `isIrve` (un ID par borne), `isExt` (extérieurs à part) ;
  `autoTableau` loge ces petits groupes dans la place libre des rangées ; R-134 = 4 spécialisés ; messages « R-1xx (CODE) ».
- n° 6 : `src/norme/documents.js` (`unifilaire`, `reperage`, `liensCom`, `autocontrole`) + `src/ext/documents-pdf.js`
  (`documentsData`, `buildDocumentsPdf`) : partie « Documents à remettre » du dossier, bouton Bandes `#bd-docs`
  (`ui.lastDocs`) ; version de la norme sur la page de garde, les documents et le rapport copié.
- Parafoudre (06/11) : `src/norme/parafoudre.js` (pur : `NK` par département (carte de l'annexe 10A, valeurs seules),
  `depOf`, `nkOf`, `etudeParafoudre(meta, choix, v)`, `withParafoudre(rows, on, type)` (en tête de la 1re rangée, `auto`),
  `parafoudreIssues` (PF-01 à PF-04), `ecartParafoudre`) ; fiche du chantier `input[data-f="cp"]` (`meta.cp`, `#ch-nk`) ;
  `okteo.parafoudre()` ; choix `cab.choix.parafoudre` {arrivee, paratonnerre, securite, comCuivre, be auto|oui|non, by,
  at, initial, motif} ; bloc `#nm-pf` (Étapes → Norme) ; `MODS.pf1` ; `autoTableau(..., {parafoudre})`, `tabCtx` → `pf`,
  `tabs` ; rapport : `ecartsHumains(decisions, extra)` (rapport.js) = rubrique « Étude initiale et modifications
  humaines » (`.rap-ecarts`, `okteoExt.whyBlink.ecarts()`) ; autocontrôle PF-01 vérifié sur le plan.
- Reprise des paramètres FTZ (en cours, rien de codé) : décisions de Kévin dans `claude/decisions-ftz.md` (projet claude.ai).

### Fabrication et groupes — lots 4 et 5 (06/11/2026)
- `src/cablage/spv.js` (pur : `spvLines`, `spvText` CRLF, `spvName`, `cableTxt`, `filsTxt`, `totaux`) : un seul .spv par
  chantier (jamais découpé : l'atelier le sépare), 24 champs, surlongueur des fils seulement, champ 6 vide ; Bandes
  `#bd-spv` / `#bd-planning` (`spvNow(api)`, `ui.lastSpv`, `ui.lastPlanning`). Test `scripts/spv.test.mjs`.
- `src/cablage/groupes.js` (`GROUPES_POSE`, `groupePositions`) ; bouton « Groupes ▾ » `[data-tool="__groupes"]`, `K.group`.

### Raccourcis du BE, LE menuiserie, SharePoint — lots 6 à 8 (06/11/2026)
- `src/ext/raccourcis.js` (`ACTIONS` touches de FTZ → id du catalogue, `keyName` touche physique, `INTERDITES`, `setKey`,
  `createRaccourcis` en phase de capture, plan seulement) ; Paramètres → Raccourcis `#kb-tab` ; `okteoExt.raccourcis`.
  Ctrl+Y = copier (FTZ) : Rétablir = Ctrl+Maj+Z (tests smoke compris). TA-02 dans `checkCircuits`.
- Type `LEM` (LE menuiserie) ; toujours tester une liaison équipotentielle avec `isEq(t)` (appareils.js), jamais `=== "EQL"`.
  spv.js `pieceDefaut` (GARAGE / EXTERIEUR / CELLIER si pièce inconnue).
- `src/referentiel/sharepoint.js` `sharepointUrl` ; préférence `sharepoint` (`#pref-sp`) ; lien `#ch-sp` dans la fiche du chantier.

### Nuage de révision, pièces du dossier, finitions — lots 9 et 10 (06/11/2026)
- `src/print/nuage.js` (pur) ; `state.nuages` (LKEYS, annulable, `uidQ`), outil `nuage` (`K.cloudDraft`), sélection kind
  `nuage` (contour), Propriétés `#f_ind`, indice courant `K.CAB.indice`, `exportGeometry().nuages`, print.js (option `nuages`).
- `src/referentiel/dossier.js` (`PIECES`, `piecesOf`, `piecesResume`, `FAMILLES`, `CHAMPS`, `finition`) ; fiche du chantier
  `#ch-pieces` (`meta.pieces`, auto d'après `meta.dossier` / `meta.pmr`) et `#ch-fins` (`meta.finitions`).

## Vérification obligatoire
Après chaque modification : `npm run check` = `scripts/syntax.mjs` (syntaxe de tous les fichiers) + `scripts/walls.test.mjs` (42 vérifications : relevé des murs, des pièces et des
appareils sur le vrai PDF EVRARD) + `scripts/cablage.test.mjs` (87 : gaines, circuits, boîtes, fils, tracés, schémas) + `scripts/chantiers.test.mjs` (176 : règles du journal sur 4 chantiers réels) + `scripts/maillard.test.mjs` (14 : chantier de référence MAILLARD comparé au BE) + `scripts/v3d.test.mjs` (vue 3D) + `scripts/smoke.mjs` (171 vérifications Playwright ; faux serveur IA, aucune vraie clé). Ajouter un test dans `scripts/smoke.mjs`
pour chaque nouvelle fonction importante. Ne pas annoncer une fonction comme faite sans l'avoir vue marcher.

## Travail à deux (GitHub)
Dépôt **public** `kevincruveilher-png/okteo-ai`, branche `main`. Kévin modifie aussi le code dans VS Code : toujours
`git pull` (ou fetch + fusion) AVANT de commencer, et pousser à la fin de chaque mise à jour. Ne jamais réécrire l'historique.

## Pièges connus
- Les murs et appareils du plan EVRARD ne doivent pas être placés « à l'œil » : extraire les vecteurs du PDF
  (`docs/plans/`) ou faire tracer l'utilisateur.
- Ne pas utiliser `alert`/`confirm` (bloquent les tests).
- Noms de modèles IA : vérifier qu'ils existent encore avant de les mettre par défaut (NVIDIA retire des modèles ;
  `nvidia/nemotron-nano-12b-v2-vl` retiré le 26/08/2026 et proposé par erreur le 25/10).

### Bibliothèque des règles (v67)
`src/cablage/regles-library.js` : domaines/familles/types, recherche et état d’application ; métadonnées de consultation, jamais moteur normatif. `src/ext/regles-ui.js` : fiches paginées, filtres, vues Questions/Historique ; `openRulesLibrary(api, domaine)` pour un accès ciblé. Conserver les identifiants et données métier. Une règle validée n’est pas forcément automatisée ; tout périmètre non relu reste « À documenter ». Tests dédiés : `scripts/regles-library.test.mjs`.

### Relevé IA v68 (MAJ 1/2)
`src/walls/ai-data.js` : introduction commune, métadonnées de lecture et validation du relevé. `INCONNU` est un vrai objet consultable sans circuit inventé ; `PC32` est un calibre générique, pas forcément PLAQ. `aiReading` et `cab.releves[lv].evidence` gardent l'original. `lectures` en relecture → `readingData` → `api.updateApps`, en un batch annulable. Depuis v69, `commande` autorise un raccordement permanent uniquement selon les conditions strictes MAJ 4 ci-dessous. Notes détaillées et périmètre : `docs/releve-ia-v68.md`. Tests : `scripts/ai-reading.test.mjs` (+ `--browser`). Bibliothèque de symboles fusionnée sans écraser les règles v67.

### Équipements et détecteurs v69 (MAJ 3/4)
`src/cablage/equipements.js` propose FOUR/LV/PLAQ en Cuisine, LL/SL en Cellier et ANT si TV ; `src/ext/equipements-etude.js` ne passe que par l’API. Complétion explicite depuis Étude ou automatique dans « Câbler le chantier » après précontrôle. `api.applyEquipmentProposal` valide avant mutation, tous niveaux, un seul annuler. Ne jamais déplacer un équipement existant ni effacer une confirmation manuelle. `implantation.etat=a_preciser|confirmee` est indépendant de `aiStatus` : violet signifie emplacement à préciser, confirmé explicitement dans Propriétés (déplacer seul ne confirme pas). Export et sauvegarde conservent cet état. PC32 en cuisine peut devenir PLAQ par règle métier en conservant calibre et lecture originale ; une indication de principe reste violette. ANT au centre proposé, faîtage jamais prétendu reconnu sans modèle de toiture.
`src/cablage/detecteur.js` : uniquement LUM/APP/SPOT avec mode détecteur + intégré + alimentation permanente + preuve non vide. Sans commande manuelle liée, `gaines.js` raccorde phase/neutre/terre au circuit éclairage de la boîte, sans retour inventé ; contradiction manuelle = doute bloquant. Détecteur séparé ou douteux reste à résoudre. Pas de simulation du mouvement. VMC et charte graphique différées. Détails : `docs/equipements-v69.md`. Tests : `scripts/equipements.test.mjs` (+ `--browser`) et contrôle smoke.

### VMC et comparaison v70 (MAJ 5/6)
`src/cablage/vmc.js` : réseau aéraulique séparé (`cab.vmc`), propositions groupe/bouches/commande/rejet, parcours 3D, rejet >3 m bloquant ; altitudes absentes = minimum en plan, jamais validation. `VEX`/`VREJ` passifs exclus des circuits et orphelins, `BOUCHE` motorisée conservée distincte. `implantation.origine=vmc` clignote violet jusqu’à confirmation ; faîtage non reconnu automatiquement. Conserver positions et routes manuelles. `applyEquipmentProposal` ids suivent l’ordre d’entrée, même multi-niveaux. `src/cablage/comparaison.js` : lignes de référence avec source/preuve, appariements explicites uniques, blocs/points/repères/gaines séparés. Aucun ajout BE qualifié d’oubli automatiquement ; quantité concordante ne valide ni position ni câblage. UI Étude `vmc-comparaison.js` via API uniquement. Détails et limites : `docs/vmc-comparaison-v70.md`. Tests `scripts/vmc-comparaison.test.mjs` (+ `--browser`) et smoke. Charte et ouvrants reportés.

### Charte graphique v73
`src/style.css` section « v73 » : variables de la charte Oktéo (bleu nuit, corail, Rubik/Inter/JetBrains Mono), sombre par
défaut (`#theme` → clair), tailles `--hb`/`--fb` (maquette à partir de 1800 px). Plan blanc : couleurs forcées sur `#sv`/`#fx`.
Logo `.brand` (`.brand-mark`, `.brand-word`, `.brand-e`) ; icônes `TI` en 24 × 24 ; icônes des panneaux en SVG dans `register`.
`public/login.html` = accueil animé (CSS seul). `src/ext/attente.js` = page d'attente `.aw` (jeux) du relevé IA, montrée
après 2 s seulement (`okteoExt.aiReleve.attente`). Planches source : artefact « Oktéo AI — Identité de marque ».

### Préparation d'impression v74 (plan A3 du BE)
`src/print/ftz-charte.json` (généré par `scripts/charte/ftz-charte.mjs` depuis des PDF FTZ hors dépôt, sans donnée client),
`src/print/ftz-sheet.js` (feuille, cartouche, légende, encarts), `buildPlanPdf(geo, {ftz})` (print.js `buildFtz`),
`src/ext/prep-ui.js` (`okteoExt.prep`, `meta.impression`, images `img:<chantier>:<id>`). Décisions : `docs/charte-plan-ftz.md`.
MAJ 2 : `matOf(seg)` / `seg.mat` (maconnerie | cloison | doublage), `batiStyle()` / `meta.bati` (hachures | gris),
`wallLook` / `wavePoints` (plan-style.js, écran + papier), `src/print/abrev.js` (préférence `abrev`), `boxCotes` /
`drawBoxCotes` (ftz-sheet.js) ; n° 12 : cote depuis la face EXTÉRIEURE du mur extérieur (`extHit`).
MAJ 3 : `src/cablage/volumes.js` (sanitaires BAIG / RECV / DITAL = appareils sans circuit ni repère, `a.sw/sd/srot` ;
`volumesOf`, `checkVolumes` → contrôle `sdb` ; `exportGeometry().volumes`).
MAJ 4-5 : `src/print/ftz-symbols.js` (`boxColor`, `ftzSymbol`, `plaques`), préférence `charteBE` (symboles FTZ à l'écran
`g.ftz`, gaines couleur de boîte), `drawPlan(..., {ftzSyms})`, PMR (`meta.pmr`, `hDefault`, `api.setPmr`).

### Micro de l'assistant v75
`src/ext/micro.js` (`createMicro`, Web Speech API fr-FR) ; assistant `.as-mic` / `.as-mic-msg`, « envoie » = envoi, Alt+V
(`hooks.dictate`), catalogue `ai.dictee`. Test `scripts/micro.test.mjs`.
Modèles : `chat({purpose: "chat"|"analyse"})`, `modelFor` (Sonnet conversation, Opus analyse) ; Worker `pricing(c, purpose)`,
colonnes `config.analysis_model/analysis_input_price/analysis_output_price` (créées par `analysisColumns`).

### Analyse IA en 4 modes v76 (dans `main` depuis le 03/11/2026)
- `src/ai-config.js` : `ANALYSE_MODEL` (Opus 5.5, verrouillé : client, Worker, fenêtre Budget), `ANALYSE_PRICE` (avec
  cache), `CACHE_RATIO`, `IMAGE_LIMITS` (1 568 px / 1,15 Mpx, doc vérifiée le 03/11/2026). Ne jamais réécrire l'identifiant ailleurs.
- Écran `#ai-modes` (`src/ext/ai-modes-ui.js`, `okteoExt.aiModes`, textes `src/walls/ai-modes.js`) ouvert par `#rv-ai`,
  `#ia-rel`, `hooks.aiReleve`, `okteo:ai-escalade` ; recommandation `recommend()` (ai-stats.js, ext/ai-reco.js), jamais
  choisie d'office ; mode 4 : documents joints `#am-docs-file`. Mode 1 = `aiReleve.open({mode:1})`, flux v75 INCHANGÉ.
- Modes 2 à 4 : `src/ext/ai-modes-run.js` (`okteoExt.aiRunner.run(mode, {docs})`) : lecture globale (mode 1) + tuiles
  (`src/walls/ai-tiles.js` grille / tailles / repères / fusion ; `src/ext/ai-render.js` PDF vectoriel rendu de nouveau, scan
  découpé sans agrandissement) + zooms demandés dans le JSON + cache_control ; mode 3 : `src/ext/ai-raster.js` (OpenCV.js,
  Tesseract.js depuis `/vendor`, raster seulement ; PDF vectoriel = textes du PDF) ; mode 4 : `src/ext/ai-cross.js` +
  `src/walls/ai-cross.js` (seconde lecture, contrôle croisé). Puis `aiReleve.fromPlan` (même aperçu, un Ctrl+Z) et 3 cycles
  de la boucle `loop()` existante (`cyclesFor`), jamais une boucle concurrente ; `escalade()` en fin de boucle.
- Repères : une seule chaîne pixel → mètres (`regionMap`, `unrotate` convention OpenCV) ; écarts = propositions à valider
  (`plan.ecarts`, `plan.docEcarts`, `cab.releves[lv].ecarts`), aucun taux de détection promis.
- Journal (`src/walls/ai-journal.js`) : `analyse {id, mode}`, `ms`, `usd`, `tin/tout/cw/cr`, `zones`, `zooms`, `appels`…
- Dépendances : `scripts/licences.mjs` (dans check : MIT / Apache-2.0 / BSD, équivalents ISC / 0BSD / Zlib signalés) ;
  `scripts/vendor-ia.mjs` copie OpenCV / Tesseract / fra dans `public/vendor` (non versionné). Worker : CSP `'wasm-unsafe-eval'`.
- Banc d'essai : `src/walls/ai-bench.js`, `scripts/modes-bench.mjs`, protocole `docs/banc-essai-v76.md`.
- Tests : `scripts/ai-modes.test.mjs` (pur) + smoke (écran, modes 1 à 4, scan réel OpenCV/OCR, recommandation, escalade).
  Les workflows temporaires `verification-v76.yml` / `raster-v76.yml` ont été retirés à la fusion ; pour revérifier, en
  recréer un sur une branche `verification-…` (voir journal v76).

### Vue 3D 3D-1 à 3D-8, 3D-10 (dans `main` depuis le 04/11/2026 ; 3D-9 = essai chantier)
- `src/3d/plan3d.js` (pur : `H3D`, `cleanPlan` → défauts, `wallEnds`, `wallPrisms`, `openingParts`, `devicesOf`,
  `prismIssues`) ; `src/3d/scene.js` (`buildHouse(THREE, …)`, three.js passé en paramètre) ; `src/ext/vue3d.js`
  (onglet `vue3d`, Alt+4, `okteoExt.pages.vue3d.ui.state`, three.js 0.169.0 chargé à la demande, couleurs gérées par
  three ≥ r152 : `colorSpace`, intensités × π ; couleurs des sommets converties à la main). Le dessin n'est jamais modifié
  par la 3D. Feuille de route 3D (11 MAJ, toutes avant l'essai chantier) : journal du 03/11/2026.
  3D-3 : `heightsFrom(prefs h3d*)`, `o.allege`/`o.linteau`/`r.hsp` (cm, Propriétés), mur `top`, Paramètres `#ps-3d`.
  3D-4 : `src/ext/vue3d-walk.js` (`ui.walk` : enter/exit/act/update), `importDevices(..., {stay})`, touches capturées.
  3D-5 : `gainePath`, `nearestWall`, `buildGaines`, `box.sol` (gaines.js : longueur par le sol), `setGaineSol`/`gaineKeys`.
  3D-6 : `src/3d/pose.js` `poseIssues` (battant, embrasure, hauteur) → `check.js` `posesAll` (compteur « à vérifier »),
  `scene.js` `buildMarks` (anneaux, volumes SDB), `.v3d-pose`, `ui.focusDev`.
  3D-7 : `src/3d/elevation.js` (`wallElevation`, `roomFaces`, `elevationDraw`, `elevationSVG`), `src/ext/elevations-pdf.js`,
  clic sur un mur en 3D → `ui.showWall(seg, side)` (`.v3d-card.wide`), `ui.lastElev`.
  3D-10 : `okteo.inLevel(id, fn)`, `.v3d-lvs` / `ui.levels("tous"|"ouvert")`, `S3.others`, `S3.vlinks` ; `build` numéroté (`S3.gen`).
  3D-8 : `src/3d/plan-code.js` (`packPlan`/`unpackPlan`/`planUrl`, ≤ 2 900, aucun nom), `src/ext/plan3d-qr.js` (`faceUrl`),
  `buildFtz` option `ftz.qr3d` → `r.qrs`, `#prep-qr3d` ; page publique `plan3d.html` + `src/plan3d-view.js` (`window.__plan3d`), Worker. Tests :
  `scripts/v3d.test.mjs` + smoke. Workflow temporaire `verification-3d.yml` retiré à la fusion (pour revérifier : en recréer un sur une branche `verification-…`).

### Réponse IA collée v77 (dans `main` depuis le 04/11/2026)
`ai-plan.js` `refOf` (« ref » W/H, w/h, width/height ; hauteur corrigée si proportion à 3 % de celle du fond) ;
`ai-data.js` `calibreOf` (« 20 A » accepté) ; `src/walls/ai-align.js` (`alignPlan` : recalage par axe sur les murs du PDF,
garde-fous ≥ 6 murs / 60 % / 1,5 m / 5 %) ; `ai-releve.js` `realign()` après `fromText` (mode 1), case `#ai-recal`,
`okteoExt.aiReleve.recal`. Test `scripts/ai-align.test.mjs`. Murs : un seul contour d'ensemble (render.js `g.walls-out`,
print.js passe contour puis remplissage). Feuille de route du 04/11 (lots A à D) : document du projet claude.ai
`claude/feuille-de-route-2026-11.md`, résumé dans le journal.

### Rapport d'analyse clair (n° 5, bloc D du 04/11/2026)
`src/cablage/rapport.js` (`FAMILLES`, `familyOf`, `explain`, `buildRapport`, `rapportText`) ; halos `fam-…` (drawFx) ; HUD
`data-h="why"` → `okteo:why` → `src/ext/why-blink.js` (`.whyb`, `.rapcard`, `cab.decisions`, `cab.questions`,
`okteoExt.whyBlink`). Test `scripts/rapport.test.mjs`.
05/11 : « Je confirme l'emplacement » (`[data-ok]`, décision `confirme`) / « Modifier » (`[data-mod]`) ; `silenced(it, decisions)`
filtre `controlIssues` (sauf famille câblage) ; `buildRapport().validations` → rubrique « Emplacements confirmés et corrections ».

### Outils de l'IA et mémoire des symboles (n° 3 + 16, bloc D du 04/11/2026)
Worker : outils définis par Oktéo seulement (pas d'outil serveur), `tool_use` / `tool_result` contrôlés. `chat({tools})` →
`content`, `stop`. `src/walls/ai-tools.js` (`AI_TOOLS`, `runTool`, `checkReleve`) + `src/ext/ai-agent.js` (`toolContext`,
`readWithTools`) dans la lecture globale du mode 4. Préférences `modesIA` (« 4 » | « tous »), `toursOutils` ; mode 4 = 5
relectures ; échelle bloquante (`.am-scale`). Mémoire : `src/ext/symbol-memory.js`, `#f_memo` → `okteo:symbol-memo`.

### Rôle des pages du dossier (n° 15, bloc D du 04/11/2026)
`src/walls/page-roles.js` (`proposeRoles`, `setRole`, `dossierOf`, `analysisPages`) ; `pdfThumbs` rend le texte ; chantiers-page
`.pg-role` ; nouveau chantier = un niveau par page d'implantation ; `meta.dossier` ; mode 4 (`ai-cross.js`) ne joint que plan
cuisine et devis. Test `scripts/page-roles.test.mjs`.

### Consigne du relevé IA (n° 4, 04/11/2026)
`ai-plan.js` `promptBody` : échelle sur 3 cotes en tête de « remarques », mur extérieur maçonnerie + doublage = un seul mur,
cloisons jusqu'à l'axe, pointillés jamais des murs, placards sur 3 côtés, symboles tournés, doutes à deux types, guillemets
droits ; `scaleClaim` / `scaleCheck` (3 %) → carte du relevé (`ai-releve.js` `scaleStep`).

### Murs d'équerre (n° 14, lot A du 04/11/2026)
`src/walls/squaring.js` (pur : `houseAngle`, `squarePlan`, `keepOpenings`, `squareReleve`, `squareOptions`, `squareText`) ;
appliqué après chaque relevé (`ai-releve.js` `squareStep`, `walls-ui.js`) et par `okteo.squareWalls(opts)` (Relevé →
`#rv-square`, catalogue `walls.square`) ; préférences `equerreTol` / `equerre45` / `equerreMax` (Paramètres `#ps-murs`).
Test `scripts/squaring.test.mjs`.

### Association et pontage (n° 6, lot B du 04/11/2026)
gaines.js : association `memeEndroit` (jamais courant faible + autre) ; pontage si `S.pontage` (choix du chantier
`cab.choix.pontage`, `#bx-pont`, passé par `cabS` / `plan-wiring.js`), `S.pontageMax` ; gaine `ponts` [{de, vers, from, to, ids,
length}] + `pontLen` (comptés dans cuivre / longueur / totaux). Plan : `__ponts` dans `setGaineGroups`, `boxLayout` `d.head` /
`d.ponts`, `path.pont` ; geo `deps[].ponts`. Test `scripts/pontage.test.mjs`.

### Mode « Bureau d'études » (n° 7, lot B du 04/11/2026)
boites.js `MODES.be`, `beKindOf`, `BE_COUPLES`, `placeLevelBE` (pièces voisines fusionnées : passages, puis couples, puis
petites pièces ; séjour trop chargé → prises vers la cuisine ; boîte dans ses pièces) ; volets toujours à part en mode BE ;
`autoBoxes` passe les pièces. Test `scripts/mode-be.test.mjs`.

### Mobilier (n° 11, lot C du 04/11/2026)
volumes.js `meuble: true` / `isMeuble` (10 meubles, `saniShape`, `sani3d` matière meuble / plante) ; appareils.js groupe
« Mobilier » ; bouton `[data-tool="__meubles"]` (`K.moreOpen = "meubles"`) ; `AI_TYPES` sans Mobilier ni Zones.
Test `scripts/mobilier.test.mjs`.

### Zones d'exclusion (n° 10, lot C du 04/11/2026)
Types `ZONE` / `ZONEC` (volumes.js `zone: true`, groupe « Zones d'exclusion ») ; `src/cablage/exclusion.js` (`zonesByLevel`,
`detour`, `detourVia`, `pushOut`) ; gaines / pontages / alimentations / lignes directes `via` + `detour` (gaines.js) ;
`placeBoxes` repousse les boîtes ; contrôle `zone` ; render / print / 3D suivent `via`.

### Sanitaires (n° 9, lot A du 04/11/2026)
volumes.js `SANI` + WC / LAVABO / VASQUE / EVIER (`vol` seulement BAIG / RECV / DITAL : `hasVolumes`), `saniShape(a)`
(dessin commun écran + impression, gris pointillé), `sani3d(a)` (volumes 3D) ; `exportGeometry().sanis` ; scene.js
`house.sanis`. Toujours tester un sanitaire avec `isSani` (jamais une liste de types codée en dur).

### Appareils et repères (n° 13 + 8, lot A du 04/11/2026)
place.js `pushOff`, `wallBoxes`, `lineBoxes`, `repCandidates` ; render `wallU` (axe, normale, ep), `K.dispPos` / `K.dispLead`,
`appRot` pour tout appareil mural (normalisé, jamais à l'envers), repères `text.rep` + `K.repLabelBoxes`, glisser `K.repDrag` →
`a.rpx/rpy` (Propriétés `#f_rep0`) ; print.js mêmes règles ; `snapToWall(x, y, t)` côté pièce (`EXTERIEURS`) ; contrôle `mur`,
`okteo.reattachWalls()` (catalogue `app.reattach`). Test `scripts/placement.test.mjs`.
05/11 : INT / VV muraux = rond collé à la face (`glueToWall`), trait perpendiculaire vers la pièce (`switchParts`, place.js) ;
render `wallSwitch` / `switchGlyph` / `FTZK`, print `symbol(..., nrm)` ; symboles FTZ : même collage, rotation `atan2(nx, -ny)`.

### Entreprise Cloudflare v72 / v72.1
`server/worker.js` (Worker Pages Advanced mode, généré en `dist/_worker.js` par `scripts/build-web.mjs`) : comptes,
sessions, budget Claude (D1, `migrations/0001_enterprise.sql`), relais Claude avec réservation atomique.
`src/web/` : démarrage authentifié (`boot.js`, actif sur `*.pages.dev` ou build `--mode enterprise`), coffre chiffré
remplaçant localStorage (`vault.js`), exports en dossiers (`exchange.js`), bibliothèque commune, administration.
v72.1 : `PUBLIC_ASSET` (fichiers compilés hachés js/css) + `/bande.html` publics, `AI_TIMEOUT` 15 min, `PUBLIC_BASE`
= pages.dev. Tests : `npm run test:web` (Node 24 ou 22 avec `node:sqlite`).
