# Oktéo AI — prototype de dessin

Logiciel de dessin pour le bureau d'études de pieuvres électriques (KiTéOHM).
Version du prototype : **v33** (26/10/2026) : schémas de boîte pour le câbleur (onglet Bandes), à imprimer.

**Version en ligne (sans rien installer) : https://kevincruveilher-png.github.io/okteo-ai/**
Les chantiers restent dans le navigateur de chaque ordinateur (fichier `.okteo` pour les transporter). En ligne, l'IA marche avec une clé Claude ; NVIDIA seulement en version locale.
(v17 : pièces ; v16 : appareils attachés aux murs ; v15 : relevé des murs ; v14 : chantiers.)
(v13 : assistant IA, liste des fonctions Ctrl+K, onglet Paramètres.) Chantier d'essai : EVRARD · 04949.

## Installer (une seule fois)

1. Installer **Node.js LTS** : https://nodejs.org (bouton « LTS », installation par défaut).
2. Installer **Visual Studio Code** : https://code.visualstudio.com
3. Dézipper ce dossier, par exemple dans `Documents\okteo-ai`.
4. Dans VS Code : **Fichier → Ouvrir le dossier…** → choisir `okteo-ai`.
   VS Code propose d'installer les extensions recommandées : accepter (dont **Claude Code**).
5. Ouvrir le terminal : **Affichage → Terminal** (ou Ctrl+ù), puis taper :

   ```
   npm install
   npx playwright install chromium
   ```

## Lancer le logiciel

Dans le terminal :

```
npm run dev
```

Le navigateur s'ouvre sur le logiciel. Chaque modification d'un fichier recharge la page toute seule.
Pour arrêter : Ctrl+C dans le terminal.
(Raccourci : **Terminal → Exécuter la tâche… → Lancer Oktéo AI**.)

Mettre à jour la version en ligne : `npm run deploy` (construit le logiciel et le publie sur la branche `gh-pages` ;
GitHub Pages doit être réglé sur cette branche).

## Vérifier que rien n'est cassé

```
npm run check
```

Ouvre le logiciel dans un navigateur invisible et fait 158 vérifications (dessin, palette, paramètres, assistant, relais IA avec un faux serveur Claude/NVIDIA : aucune vraie clé utilisée).
À lancer après chaque modification.

## Chantiers et plan de fond (v14)

1. Onglet **Chantiers** (en haut à gauche, ou clic sur le nom du chantier dans la barre du haut).
2. **＋ Nouveau chantier** : nom, n° de dossier, pavillonneur, puis le **plan** : un PDF (cliquer la bonne page) ou une image/photo.
   **Créer et ouvrir**.
3. Le logiciel demande tout de suite l'**échelle** : zoomer sur une cote connue du plan (la plus grande possible, ex. la longueur
   totale de la maison), cliquer ses deux extrémités, taper la longueur réelle en mètres, **Valider l'échelle**.
   Vérifier ensuite avec l'outil **Cote** sur une autre dimension du plan.
4. Dans la liste : **Ouvrir**, **Dupliquer** (utile pour un modèle de maison qui revient), **Fichier** (copie `.okteo` du chantier,
   dessin + plan, à ranger sur le réseau), **Supprimer** (avec confirmation). **Ouvrir un fichier .okteo** recharge une copie.

Les chantiers sont enregistrés dans le navigateur de ce PC. Pour ne rien perdre, faire régulièrement **Fichier** sur les chantiers importants.

## Schémas de boîte pour le câbleur (v33)

Onglet **Bandes** (à gauche), une boîte à la fois (boutons B1, B2…), pensé pour un câbleur débutant :
1. **Le schéma** : la boîte carrée, faces A (haut du plan), B, C, D ; chaque gaine sur sa face avec son n°, sa longueur,
   son diamètre, l'appareil et ses fils (pastille de couleur + n° de raccordement) ; au centre, un connecteur par n°
   (nombre de fils, taille du connecteur) ; les retours lampe et les navettes sont tracés de la gaine au connecteur.
2. **Orienter la boîte** : la pièce qu'on trouve de chaque côté (« Face B : côté Bains », « côté façade »).
3. **Le matériel** : nombre de connecteurs rapides de 2, 3, 5… entrées (réglable : Paramètres → Câblage), et les ponts
   quand plus de fils que le plus gros connecteur (12) doivent être réunis.
4. **Les raccordements dans l'ordre**, à cocher : terres, neutres circuit par circuit, phases, puis retours et
   navettes ; pour chacun, chaque fil à prendre (gaine, couleur, section, appareil) et le connecteur.
5. **Le contrôle final** (aucun fil libre ; alertes si un fil n'a pas de raccordement ou si un raccordement n'a qu'un fil).

**🖨 Imprimer** : une feuille A4 par boîte (schéma, orientation, matériel), puis la liste à cocher.
Les n° de raccordement suivent maintenant l'ordre de câblage (1 = terres, puis neutres, phases, retours, navettes).
**Alimentation d'une boîte** : une seule gaine depuis le tableau (phase + neutre de chaque circuit, une seule terre) ;
deux gaines seulement si elle passait en Ø25.

## Repères par allumage, passage des gaines, cadenas (v32)

- **Repères par allumage** : une commande et ce qu'elle allume ont le même numéro — I3 et L3 ; le 2e du même type
  prend A, le 3e B : VV1 et VV1A, L3 et L3A, BP1, BP1A, BP1B ; spot S3, applique AP3. Le numéro suit tout seul quand
  on ajoute ou retire une liaison (aussi entre niveaux). Ce qui n'est relié à rien (prises, RJ45…) garde son numéro.
- **Passage d'une gaine** (couleurs des circuits affichées, outil Sélection) : attraper une gaine sur le plan et la
  tirer = un point de passage, posé librement ; la distance au mur le plus proche s'affiche en bas. **Maj** : tronçon
  horizontal ou vertical. **Double-clic** sur un point : le supprimer. « Remettre en ligne droite » dans la liste des
  boîtes. Longueur = le tracé + 10 %, recalculée ; la face de sortie suit le 1er point de passage ; ✎ dans l'onglet Boîtes.
- **Cadenas des boîtes** 🔒 : une boîte verrouillée garde sa place, ses appareils et ses tracés au recalcul. Une boîte
  déplacée ou retracée se verrouille toute seule ; clic sur le cadenas (coin de la boîte sur le plan, ou dans la
  liste) pour changer. « Replacer les boîtes automatiquement… » demande quelles boîtes recalculer (cases à cocher).

## Liaisons et relevés (v31)

- **Outil Liaison** : toutes les liaisons s'affichent en trait épais ; les commandes et lumières sans liaison sont
  **cerclées en orange** ; en bas, « 31 liaisons sur ce niveau · 3 appareils sans liaison ». Clic sur un interrupteur :
  ses lumières ressortent et sont nommées ; clic sur une lumière : on la relie (ou on la détache si elle l'était).
  Clic sur une liaison : elle est choisie, **Suppr** la retire. Ctrl+Z annule.
- **Menu « ⤓ Relevé »** (en haut) : **1. Murs**, **2. Pièces**, **3. Appareillage** — trois relevés séparés, chacun avec
  son aperçu orange et son bouton d'ajout : on garde les murs et pas l'appareillage, par exemple. Si le plan n'est pas
  encore à l'échelle, elle est réglée toute seule d'après les cotes du plan (au moins 4 cotes concordantes).
- **✦ Relevé par l'IA** (même menu) : l'image du plan est envoyée à l'IA, qui propose murs, portes et fenêtres, pièces,
  appareils et liaisons. L'aperçu se pose par-dessus le dessin actuel pour comparer avec le relevé sans IA ; on coche
  ce qu'on garde (murs / pièces / appareils), un seul Ctrl+Z annule. En ligne : clé Claude (appel direct, la clé reste
  dans le navigateur) ; en local : Claude ou NVIDIA.
- Essai sur EVRARD (réponse « IA » rédigée par Claude à l'œil sur la même image) : murs à 6 cm près en moyenne
  (95 % à moins de 15 cm), 8 pièces sur 9 retrouvées, 50 appareils sur 87 au bon endroit. Le relevé sans IA reste
  la référence sur un PDF vectoriel ; l'IA sert pour les plans scannés ou en image.

## Câblage — boîtes, gaines et fils (v29–v30)

- **Poser le tableau** (appareil « Tableau » de la barre) : il sert de départ aux alimentations et aux lignes directes.
- Onglet **Câblage** → **Placer les boîtes automatiquement** : les boîtes sont placées pour utiliser le moins de fil
  possible (sur les appareils EVRARD du test : 1 356 m de fil avec les boîtes placées, contre 1 644 m avec une seule boîte), en respectant 18 départs par
  boîte et 6 par face ; une commande et ses lumières sont toujours dans la même boîte. Chaque boîte reçoit une
  alimentation du tableau par circuit.
- Sur le plan : la boîte (carré « B1 » avec ses faces A B C D), ses liens vers les appareils (couleur du circuit) et son
  alimentation (pointillés vers le tableau). **Glisser une boîte** la déplace : longueurs, faces et diamètres se
  recalculent. « ← Sélection » sur une boîte y raccorde les appareils sélectionnés.
- Onglet **Boîtes** (à gauche) : pour chaque boîte, ses gaines **B1-01, B1-02…** (face A d'abord puis B, C, D) avec
  appareil, circuit, **longueur** (tracé +10 %, descente, surlongueurs, arrondi), **diamètre** (place des fils) et
  **fils** : couleur, section et **n° de raccordement** (tous les fils du même n° se raccordent ensemble ; n° 1 = toutes
  les terres). En dessous, la liste des raccordements de la boîte.
- Contenu des gaines : prise = phase, neutre, terre ; point lumineux = retour lampe, neutre, terre ; interrupteur = phase +
  retour ; va-et-vient = phase + 2 navettes / retour + 2 navettes ; 3 commandes ou bouton poussoir = télérupteur au tableau
  (alerte) ; alimentation = phase, neutre, terre du circuit.
- Onglet **Lignes directes** : prises spécialisées, sorties de câble (tableau → appareil) et RJ45 (coffret), avec longueur,
  diamètre et fils.

## Câblage — réglages et circuits (v28)

- **Paramètres → Câblage** : toutes les valeurs de la pieuvre, modifiables (une valeur changée est surlignée,
  l'infobulle rappelle la valeur de base ; bouton « Valeurs de base ») : 18 départs par boîte et 6 par face, hauteur sous
  plafond, traversée plancher/isolation, surlongueurs boîte / appareil, +10 % de tracé, arrondi, remplissage des gaines
  (40 %), limites NF C 15-100 (8 points, 8 prises), sections, protections, couleurs des fils.
- **Onglet « Câblage »** (panneau de droite) → **Répartir automatiquement** : tous les appareils de tous les niveaux sont
  répartis en circuits — éclairage par allumage (les lumières d'une même commande ensemble, max 8 points, commandes avec
  leurs lumières), prises voisines (max 8), un circuit par prise spécialisée et par sortie de câble (ligne directe),
  RJ45 en lignes directes (COM). Numérotés C1, C2…
- Chaque circuit a **sa couleur sur le plan** (anneau autour du symbole) ; un appareil sans circuit a un anneau rouge
  pointillé. Pour changer un appareil de circuit : le sélectionner sur le plan puis **« ← Sélection »** sur le circuit.
  Section, protection et nom (double-clic) modifiables ; alertes si un circuit dépasse la limite. Un Ctrl+Z par changement.
- Diamètre des gaines (servira à l'étape des gaines) : calculé d'après la place des fils, calé sur tes exemples
  (5 × 1,5 → Ø16 ; 6 × 1,5 → Ø20 ; 4 × 1,5 + 1 × 2,5 → Ø20).

## Premiers pas (v27)

- **Visite guidée** (2 min) : proposée à la première ouverture (petite invitation en bas à gauche, non bloquante), puis
  dans Ctrl+K → « Visite guidée » ou l'onglet Étapes. Chaque zone de l'écran est éclairée avec une explication ;
  Suivant / Précédent (ou flèches ← →), Échap pour quitter.
- **Onglet « Étapes »** du panneau de droite : plan en fond, échelle, murs, pièces, appareils, liaisons, impression,
  sauvegarde automatique. Les étapes se cochent toutes seules ; l'étape suivante est encadrée, avec le bouton qui la lance.

## Niveaux : RDC, R+1, combles (v24)

- Barre des niveaux à côté du nom du chantier : clic = ouvrir le niveau, **Page ↑ / Page ↓** = niveau du dessus / dessous,
  double-clic = renommer, **＋ Niveau** = ajouter (case « murs extérieurs » : recopie les murs épais du niveau ouvert),
  **✕** = supprimer le niveau ouvert (confirmation dans la barre ; Ctrl+Z le rend, avec son plan).
- Chaque niveau a **son dessin et son plan de fond** : page Chantiers → « Ajouter un fond… » sur le niveau ouvert. Si c'est
  une autre page du même PDF, la position et l'échelle du RDC sont reprises (pas besoin de refaire l'échelle).
- Relevé des murs, pièces et appareils : sur le niveau ouvert, avec son plan.
- Le niveau du dessous s'affiche en gris clair (menu Affichage → « Niveau du dessous en transparence »).
- Impression : le niveau ouvert, avec son nom dans le cartouche. Le fichier .okteo contient tous les niveaux.
- **Liaison entre niveaux** (v25, ex. va-et-vient d'escalier) : outil **Liaison**, cliquer l'interrupteur, **Page ↑**
  (la commande reste choisie), cliquer la lumière de l'étage. L'interrupteur affiche « → L1 Étage », la lumière
  « ← I5 RDC » ; à l'impression : « commande L1 (Étage) » / « commandé par I5 (RDC) ».
- **Imprimer tous les niveaux** (v25) : fenêtre Imprimer → « Niveaux imprimés : Tous les niveaux » : une page par
  niveau, même format et même échelle, puis une nomenclature commune (pièces et appareils niveau par niveau).

## Lisibilité du plan (v23)

- Les textes (noms et surfaces des pièces, repères, cotes) gardent **la même taille à l'écran** quel que soit le zoom.
- **Aucun texte ne se chevauche** : un nom de pièce qui gêne se déplace dans sa pièce ; un repère se met à la première
  place libre autour de son symbole ; une longueur de mur qui ne tient pas est masquée (elle réapparaît en zoomant).
  Le repère de l'appareil sélectionné est toujours affiché.
- Les symboles ne descendent pas sous 12 px en vue d'ensemble.
- **Liaisons** : traits fins et discrets ; en sélectionnant un appareil, ses liaisons ressortent et les autres s'effacent.
- **Impression** : même placement sans chevauchement (repères, hauteurs, noms de pièces, cotes).

## Pièces ouvertes, portes en travers, appliques (v22)

- **Porte en travers d'un couloir** (ex. WC qui ouvre sur le dégagement, sans cloison dessinée sur le PDF) : le relevé
  des murs le voit grâce à l'arc de la porte et ajoute un mur avec sa porte → le WC devient une pièce.
- **Pièces ouvertes** : quand deux noms du plan tombent dans la même pièce (séjour + « Dgt »), la détection des pièces
  propose une **limite de pièce** à l'étranglement (trait en pointillés, sans mur). Case à décocher si on n'en veut pas.
  À la main : dessiner un mur, le sélectionner, cocher **Limite de pièce** dans son menu.
- **Appliques** (demi-cercles contre un mur, souvent à l'extérieur) : nouveau type d'appareil, collé au mur, 180 cm
  par défaut, avec ses liaisons. **Tableau** : repéré seulement si le texte « Tableau / TGBT / GTL » est lisible.
- Sur EVRARD : 9 pièces (WC 1,7 m² et Dgt 2,2 m² séparés), 5 appliques.

## Sauvegarde et repères (v21)

- **Sauvegarde automatique** (Chrome / Edge) : page **Chantiers** → *Sauvegarde automatique* → **Choisir le dossier de
  sauvegarde…** (un dossier du PC ou du réseau). Une copie `.okteo` du chantier ouvert y est écrite 20 s après chaque
  modification et quand on quitte la page. En haut à côté de « Enregistré » : « copie 19:32 ». À chaque réouverture du
  logiciel, le navigateur redemande l'autorisation : cliquer « ⚠ copie à réactiver ».
- Si l'enregistrement dans le navigateur échoue (stockage plein…), le voyant passe à **⚠ Non enregistré** et une alerte
  propose **Enregistrer en fichier** tout de suite.
- **Repères fixes** : supprimer P3 ne renumérote plus P4, P5… Une copie reçoit le numéro suivant libre.
  Pour renuméroter proprement (pièce par pièce) : **Ctrl+K** → « Renuméroter les repères ».
- Barre d'outils : 1re ligne = chantier, annuler, enregistrement, **Affichage ▾** (cotes, repères, fond, taille des symboles,
  thème, export JSON), imprimer, fonctions, assistant ; 2e ligne = outils de dessin et appareils (dessinés avec leur
  symbole, nom dans l'infobulle).

## Relever les appareils du PDF (v19)

Après **Ajouter les pièces** (case « Relever ensuite les appareils du plan », cochée par défaut), ou bouton **Relever les appareils**
de la page Chantiers, ou **Ctrl+K** → « Relever les appareils » :
- le logiciel lit les **symboles** du plan PDF, sans IA : prises 16 A et 20/32 A (d'après le texte « 16A », « 20A » à côté),
  RJ45, interrupteurs, va-et-vient, points lumineux, spots, sorties de câble, bouches VMC ;
- il reprend les **liaisons** dessinées (traits bleus) : chaque interrupteur → les lumières qu'il commande ;
- **aperçu** en orange avec la liste par type ; les petits cercles non reconnus (plaques de cuisson, robinets…) sont entourés
  de pointillés rouges ;
- **Ajouter les appareils** : les prises, interrupteurs, RJ45 et sorties de câble se **collent à leur mur** (ils suivent ensuite
  le mur et gardent leur distance à l'angle). Un seul **Ctrl+Z** annule tout.

**Hauteurs (v20)** : les textes « 16A H:1.20m », « 32A H:0.65m »… sont lus, même quand le PDF utilise une police codée
(les chiffres sont retrouvés grâce aux cotes du plan) : la prise reçoit sa hauteur et son intensité. Les autres gardent
la hauteur par défaut. Les appliques à moitié dessinées dans les murs extérieurs ne sont pas encore reconnues.
Sur EVRARD : 82 appareils, 26 liaisons, 13 hauteurs lues.

**Contrôle de l'échelle (v20)** : en ouvrant le relevé des murs, Oktéo relit les cotes du plan et les compare aux
longueurs mesurées sur le fond : « ✓ Échelle confirmée par 40 cotes » ou « ⚠ échelle décalée de 4,6 % » avec le bouton
**Corriger l'échelle** (proposé tant qu'aucun mur n'est dessiné).

## Imprimer le plan en PDF (v18)

Bouton **🖨 Imprimer** (ou **Ctrl+P**) :
- format, orientation et échelle **automatiques** (1:50 en A4 si le plan tient, sinon A3, puis 1:75, 1:100…) ou imposés ;
- page 1 : plan vectoriel à l'échelle exacte (murs, portes, fenêtres, cotes, pièces et surfaces, symboles, repères,
  hauteurs hors standard, liaisons), légende avec quantités, échelle graphique, cartouche (chantier, n°, pavillonneur,
  niveau, échelle, date, indice) ;
- page 2 : **nomenclature** (appareils par pièce et par type, surfaces, totaux) et liste des appareils.
- **Télécharger le PDF**. Pour imprimer à l'échelle : « Taille réelle / 100 % », jamais « Ajuster à la page ».

## Détecter les pièces (v17)

Après un relevé des murs, Oktéo propose tout seul les pièces (case « Détecter ensuite les pièces »). Sinon : Ctrl+K → « pièces ».
- Chaque pièce fermée par des murs est trouvée, **y compris en L**, avec sa **surface habitable** (entre les faces des murs).
- Les **noms sont lus sur le plan PDF** (même quand la police du PDF est « codée »). Sans nom lisible : « Pièce 1, 2… »,
  ou le nom d'une pièce déjà dessinée au même endroit.
- ⚠ Si une pièce contient plusieurs noms (ex. « Espace de Vie » + « WC »), un mur manque sans doute pour les séparer :
  dessinez-le puis relancez la détection.
- Les murs doivent se rejoindre aux angles pour fermer une pièce. La forme et la surface suivent ensuite les murs.

## Appareils attachés à leur mur (v16)

Une prise, un interrupteur ou une RJ45 posé contre un mur **suit ce mur** : déplacé, tourné, symétrisé, allongé ou épaissi,
l'appareil garde sa distance à l'angle le plus proche, mesurée depuis la face du mur d'angle (« 30 cm de l'angle » reste vrai).
- Glisser l'appareil le long du mur, ou taper la distance dans son menu (↤ … cm), met à jour son attache.
- Supprimer un mur qui porte des appareils : Oktéo demande « supprimer avec les appareils » ou « les garder détachés ».
- Après un relevé automatique qui remplace les murs, les appareils se raccrochent au nouveau mur le plus proche (≤ 60 cm).
- La surface d'une pièce suit ses murs.

## Relever les murs automatiquement (v15)

Sur un chantier dont le fond est un **PDF** à l'échelle : juste après le réglage de l'échelle, Oktéo propose
« Relever les murs » (sinon : Chantiers → **Relever les murs**, ou Ctrl+K → « relever »).
1. L'aperçu s'affiche en orange sur le plan, avec le nombre de murs, leurs épaisseurs et les ouvertures trouvées.
2. Si besoin, ajuster **Épaisseur min./max.** (ex. max 12 cm = seulement les cloisons).
3. **Ajouter au dessin**. Tout reste modifiable ; **Ctrl+Z** annule tout l'ajout d'un coup.
4. Vérifier les ouvertures : porte ou fenêtre se change dans le menu de l'ouverture (→ Porte / → Fenêtre), l'épaisseur
   d'un mur dans son menu (champ « ép. »).

Le relevé lit les murs **grisés** du PDF (le cas des plans de pavillonneurs) ; sans aplats, il utilise les traits
(méthode de secours, à vérifier de près). Une photo ou un scan ne contient pas de traits : relevé impossible, dessin à la main.

## L'assistant IA dans le logiciel (v13)

1. Lancer le logiciel avec `npm run dev` (obligatoire : l'IA passe par ce serveur local).
2. Onglet **Paramètres** (en bas à gauche) : coller la clé **Claude** (`sk-ant-…`) et/ou **NVIDIA** (`nvapi-…`),
   puis **Tester la connexion**. Une seule clé suffit ; avec les deux, choisir le fournisseur utilisé.
   Avec NVIDIA, le modèle par défaut est **Nemotron 3.5 Super VL** (gratuit dans la limite des crédits, et il voit l'image du plan).
   Bouton **Charger les modèles** : liste à jour des modèles de ton compte. Si NVIDIA retire un modèle, Oktéo en prend un autre tout seul.
3. Revenir sur **Plan**, puis **✦ Assistant** (ou touche **A**) : le panneau de droite s'ouvre.
   - Poser une question : « comment je fais une série de prises ? »
   - Demander une action : « active l'outil pièce », « sélectionne la chambre 1 », « renomme r2 en Cuisine ».
     Tout ce qu'il fait s'annule avec Ctrl+Z ; une suppression demande toujours ta confirmation.
   - **📐 Analyser le plan** : il reçoit l'image du plan et la liste des objets, et signale oublis et incohérences.
     Les repères comme `r2` ou `a5` sont cliquables : la vue va sur l'objet.
4. **⌕ Fonctions** (ou **Ctrl+K**) : toutes les fonctions, avec recherche et raccourcis ; Entrée pour lancer.

Sans clé, l'assistant cherche quand même dans la liste des fonctions.
Les clés restent sur ce PC (navigateur), jamais dans le chantier exporté. Variante : les mettre dans `.env` (voir `.env.example`).
Chaque analyse du plan consomme un peu de crédit chez le fournisseur.

## Claude dans VS Code (pour développer)

L'extension **Claude Code** de VS Code demande un compte Claude ou une clé **Anthropic** (la clé NVIDIA ne marche pas pour ça).
Claude lit automatiquement `CLAUDE.md` à l'ouverture du dossier : il sait ce qu'est le projet, où en est le développement et quelles règles suivre.

## Contenu du dossier

| Chemin | Rôle |
|---|---|
| `index.html` | Structure de la page (barre, plan, panneaux) |
| `src/app.js` | Point d'entrée du cœur (démarrage) |
| `src/core/` | Cœur du logiciel, un fichier par thème : modèle, dessin, outils, panneau, niveaux… ; `api.js` expose `window.okteo` |
| `src/ext/` | Extensions : assistant, palette Ctrl+K, catalogue des fonctions, paramètres, panneau de droite |
| `vite.config.js` | Serveur local + relais IA (`/ai/anthropic`, `/ai/nvidia`) |
| `src/style.css` | Apparence (thème clair/sombre) |
| `public/assets/` | Fond de plan EVRARD (image) |
| `scripts/smoke.mjs` | Test automatique (`npm run check`) |
| `docs/journal.md` | Journal de développement et feuille de route |
| `docs/cahier-des-charges.md` | Cahier des charges Oktéo AI |
| `docs/plans/` | PDF du chantier d'essai |
| `docs/prototype-v12-autonome.html` | Version tout-en-un (s'ouvre par double-clic, sans installation) |

## Bon à savoir

- Le dessin est sauvegardé dans le navigateur (localStorage). Il est propre à chaque adresse :
  le dessin fait dans l'artefact Claude n'apparaît pas ici. Utiliser **Exporter** pour garder un fichier JSON.
- Conseil : mettre le dossier sous Git (VS Code → icône « Contrôle de code source » → Initialiser) pour pouvoir revenir en arrière.
