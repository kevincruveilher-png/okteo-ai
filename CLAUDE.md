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
- Pas de framework : `index.html` + `src/app.js` (cœur, script module, ~850 lignes denses) + `src/style.css`. Vite sert la page.
- `src/app.js` expose `window.okteo` (state, setTool, select, zoomTo, renameRoom, setTab, extent…) et émet `okteo:ready` / `okteo:tab`.
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
- Un objet `window.__okteo` expose `state` et `draw` pour les tests.

## Vérification obligatoire
Après chaque modification : `npm run check` = `scripts/walls.test.mjs` (28 vérifications : relevé des murs, des pièces et des
appareils sur le vrai PDF EVRARD) + `scripts/smoke.mjs` (65 vérifications Playwright ; faux serveur IA, aucune vraie clé). Ajouter un test dans `scripts/smoke.mjs`
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
