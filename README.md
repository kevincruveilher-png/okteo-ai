# Oktéo AI — prototype de dessin

Logiciel de dessin pour le bureau d'études de pieuvres électriques (KiTéOHM).
Version du prototype : **v14** (25/10/2026) : gestion des chantiers, import du plan (PDF ou image) et mise à l'échelle.
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

Ouvre le logiciel dans un navigateur invisible et fait 34 vérifications (dessin, palette, paramètres, assistant, relais IA avec un faux serveur Claude/NVIDIA : aucune vraie clé utilisée).
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
