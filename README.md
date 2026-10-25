# Oktéo AI — prototype de dessin

Logiciel de dessin pour le bureau d'études de pieuvres électriques (KiTéOHM).
Version du prototype : **v22** (25/10/2026) : WC et dégagement séparés du séjour, appliques reconnues.
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

## Vérifier que rien n'est cassé

```
npm run check
```

Ouvre le logiciel dans un navigateur invisible et fait 93 vérifications (dessin, palette, paramètres, assistant, relais IA avec un faux serveur Claude/NVIDIA : aucune vraie clé utilisée).
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
| `src/app.js` | Cœur du logiciel : modèle, dessin, outils, raccourcis ; expose `window.okteo` |
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
