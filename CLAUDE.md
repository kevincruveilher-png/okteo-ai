# Oktéo AI — consignes pour Claude

## Le projet
Logiciel de dessin pour le bureau d'études de pieuvres électriques de KiTéOHM (câblage de maisons individuelles :
boîtes, bandes de câblage, SPV pour Counter). Il doit remplacer FTZ, dont la régénération écrase les corrections manuelles.
Cible prioritaire : maisons 90–150 m² d'une trentaine de pavillonneurs (60 % des plans).
Référence complète : `docs/cahier-des-charges.md`. État et suite : `docs/journal.md` (à tenir à jour à chaque version).

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
  (`gaineFor(sections, remplissage)` : surfaces des fils H07V-U vs surface intérieure ICTA), `circuits.js`
  (`computeCircuits(items, links, S)`, `checkCircuits`). Circuits stockés dans le chantier : `K.CAB.circuits`
  (dans `packState`, tous niveaux, annulable) ; `okteo.cab`, `setCircuits(list)`, `showCircuits`, `allApps()` (tous
  niveaux, avec pièce et repère), `allLinks()`, `circuitColors` ; anneaux `circle.circ` dans `draw` (`circuitMap`).
  Interface : `src/ext/cablage-ui.js` (onglet « Câblage ») ; réglages dans `settings.js` (page Paramètres).
- Boîtes et gaines (v29–v30) : `src/cablage/boites.js` (`buildUnits` = allumages indivisibles + appareils seuls des
  circuits à boîte ; `placeBoxes(items, links, circuits, tabs, S)` = regroupement avec capacité (18 départs dont une
  alimentation par circuit, 6 par face) + médiane de Weiszfeld attirée par le tableau, k essayés ; `faceToward`,
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
  gaine `alim:<i>` avec `circuits` [noms] et `wires[].circuit` ; `placeBoxes` compte ces gaines (`S.alimCount`). Réglage `bornes`
  (« 2,3,5,8,12 »). Interface : `src/ext/cablage-bandes.js` (onglet `bandes`, `boxSheets(api)`, `facesSides` dans
  cablage-data.js = pièce de chaque côté, `wireSolid`) + `src/ext/bandes-pdf.js` (jsPDF A4, schéma en JPEG — un PNG
  ferait un PDF énorme —, texte WinAnsi via `win()`). `okteoExt.pages.bandes.ui.last` = dernier PDF (tests).
- Version en ligne : GitHub Pages, branche `gh-pages` = `dist/` (`vite.config.js` base "./"). Après chaque mise à jour
  poussée : `npm run deploy` (scripts/deploy.mjs). Le relais `/ai/*` n'existe qu'en local.
- Un objet `window.__okteo` expose `state` et `draw` pour les tests.

## Vérification obligatoire
Après chaque modification : `npm run check` = `scripts/syntax.mjs` (syntaxe de tous les fichiers) + `scripts/walls.test.mjs` (30 vérifications : relevé des murs, des pièces et des
appareils sur le vrai PDF EVRARD) + `scripts/cablage.test.mjs` (32 : gaines, circuits, boîtes, fils, tracés, schémas) + `scripts/smoke.mjs` (96 vérifications Playwright ; faux serveur IA, aucune vraie clé). Ajouter un test dans `scripts/smoke.mjs`
pour chaque nouvelle fonction importante. Ne pas annoncer une fonction comme faite sans l'avoir vue marcher.

## Travail à deux (GitHub)
Dépôt privé `kevincruveilher-png/okteo-ai`, branche `main`. Kévin modifie aussi le code dans VS Code : toujours
`git pull` (ou fetch + fusion) AVANT de commencer, et pousser à la fin de chaque mise à jour. Ne jamais réécrire l'historique.

## Pièges connus
- Les murs et appareils du plan EVRARD ne doivent pas être placés « à l'œil » : extraire les vecteurs du PDF
  (`docs/plans/`) ou faire tracer l'utilisateur.
- Ne pas utiliser `alert`/`confirm` (bloquent les tests).
- Noms de modèles IA : vérifier qu'ils existent encore avant de les mettre par défaut (NVIDIA retire des modèles ;
  `nvidia/nemotron-nano-12b-v2-vl` retiré le 26/08/2026 et proposé par erreur le 25/10).
