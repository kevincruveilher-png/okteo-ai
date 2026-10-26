# Feuille de route — mises à jour 41 à 48 (rédigée le 26/10/2026)

Décidée avec Kévin le 26/10/2026. Détail des échanges : `docs/journal.md` (sections « À faire »).

## Règles de travail
- **Une mise à jour à la fois**, lancée seulement quand Kévin dit « go ». Il fait avancer de mise à jour en mise à jour.
- **Rien n'est poussé avant le « go » d'une mise à jour.** À la fin de chacune : `npm run check` vert, journal et CLAUDE.md à jour, `npm run deploy`, puis push (les commits de notes partent avec la 41).
- Chaque nouvelle fonction : entrée dans `src/ext/catalog.js`, étape dans la visite guidée si c'est une nouvelle zone de l'écran, test dans `scripts/smoke.mjs` (et `scripts/cablage.test.mjs` pour le moteur).
- Kévin est débutant sur l'interface : infobulles, raccourcis affichés, le moins de clics possible. Les fonctions de câblage restent des options, jamais automatiques.

## 41 — Mise en page de l'écran — FAIT (livrée avec la 42, 26/10/2026)
- Bandeau du haut en trois groupes avec un titre court : **Vues** (Bâti, Implantation bâtie, Implantation appareils, Câblage), **Actions** (outils de dessin et de modification), **Panneaux** (Propriétés, Câblage, Packs, Étapes).
- Le contenu d'un panneau s'ouvre dans une zone plus étroite sous le bandeau et se ferme en recliquant l'onglet.
- L'assistant : petit encart fermé en bas à droite, agrandi au clic, réduit par la croix ; il ne recouvre le dessin que lorsqu'il est agrandi.
- Fait avant le reste parce que les boutons des mises à jour suivantes (compteur, Pack, Essai) s'y rangent.
- Corrigé : le bandeau d'aide près de l'objet restait affiché (`.hud[hidden]`).

## 42 — Paramètres et surfaces des pièces — FAIT (26/10/2026)
- Paramètres regroupés en sections avec titre et courte aide : **Affichage** (surfaces), **Assistant et relevé IA** (clés, modèles), **Câblage** (circuits, couleurs, boîtes, gaines et câbles, longueurs), **Packs** (renvoi vers le panneau Packs) ; sommaire et recherche.
- Les m² des pièces disparaissent partout (libellé écran et impression, nomenclature, liste des Packs, liste de détection, total « m² habitables »). Réglage « Afficher les surfaces des pièces », désactivé par défaut. La surface reste calculée (nombre de prises de la norme pour le séjour).

## 43 — Contrôle des appareils seuls — FAIT (26/10/2026)
- Compteur « ⚠ n » actif en permanence dans le bandeau (calcul léger à chaque dessin).
- Cas : commande sans lumière, lumière sans commande, va-et-vient incomplet, appareil sans circuit, allumage coupé entre deux boîtes, commande et lumière dans deux boîtes.
- Halo orange animé (pulsation douce) sur le plan ; un clic sur le compteur zoome sur le cas suivant ; liste dans l'onglet Câblage.

## 44 — Pack en peu de clics — FAIT (26/10/2026 ; raccourci Maj+P, P = outil Prise)
- Bouton « Pack ▾ » dans le bandeau de la pièce : pièce, Pack, type = 3 clics. Touche P puis un chiffre.
- Options : « Pieuvre type » (pack + boîte), « même pack pour les pièces du même nom ».
- Jamais automatique à la création d'une pièce ; un seul Ctrl+Z.

## 45 — Mode essai — FAIT (26/10/2026 ; disjoncteurs dans l'encart Essai en attendant l'onglet Tableau)
- Bouton « Essai » : un clic sur un interrupteur allume / éteint ses lampes (deuxième clic sur l'interrupteur ; à confirmer : clic direct sur la lampe aussi).
- Lumière soignée : fondu à l'allumage et à l'extinction, halo qui éclaire autour de la lampe, légère variation d'intensité en continu ; animations réduites si le système le demande.
- Va-et-vient en inversion, télérupteur par bouton-poussoir, un disjoncteur simple par circuit dans l'onglet Câblage.
- Bouton « Tester tout » : liste les commandes sans effet ou sur un autre circuit.

## 45.1 — Retours de Kévin du 26/10 — FAIT (27/10/2026)
- **Quadrillage retiré** du fond du plan (trop d'informations, on ne s'y retrouve plus) : calque « Quadrillage » désactivé par défaut et retiré des vues Bâti / Implantation / Câblage (il reste activable à la main dans l'encart Vues).
- **Contrôle — lampes raccordées à rien** : vérifier pourquoi des lampes sans liaison n'apparaissent pas comme des interrupteurs seuls (le cas « lumière sans commande » existe déjà : chercher le cas manqué sur le chantier de Kévin, ex. lumière reliée seulement à une autre lumière, spot, applique, lumière d'un autre niveau).
- **Effets (retour de Kévin)** : lumière de l'essai moins forte (effet et halo gardés : intensité du dégradé ≈ −40 %, rayon un peu réduit) ; alertes plus visibles et plus rouges (anneau rouge-orangé #e4472b plus épais, pulsation plus marquée).
- **Contrôle — deux interrupteurs simples sur la même lampe** : nouvelle alerte « Deux interrupteurs sur la même lumière : il faut des va-et-vient » (aussi un interrupteur simple mêlé à un va-et-vient) ; le mode essai et « Tester tout » la signalent aussi.

## 46 — Onglet Tableau
- Tracé du tableau complet : disjoncteurs et circuits, disjoncteurs déplaçables sur les rangées.
- Modèle de tableau au choix (grand Schneider), avec sa taille et son nombre de rangées.
- Remplace les disjoncteurs simples du mode essai.

## 47 — Feuille de boîte
Spécification complète : `docs/journal.md`, section « feuille de boîte ». En bref :
- En-tête : Pavillonneur et Chantier (haut gauche) ; N° d'affaire, « Nom BE », cadre d'émargement du câbleur (haut droite) ; ancienne ligne de sous-titre supprimée.
- Grosse flèche vers le tableau (direction réelle) avec le mot « TABLEAU » ; lettre et pièce de chaque face à l'extérieur de la boîte, sur les quatre bords ; A, B, C, D inchangés (pas de miroir).
- Pièce d'une face = pièce des appareils desservis par ses gaines (égalité : pièce vers laquelle elle regarde ; alimentation seule : « Tableau »).
- Cadre « Ordre de câblage » : couleur, section, quantité de fils, borne. Raccordements numérotés dans l'ordre : terres, puis par circuit neutre et phase (cuisine, prises, éclairage), puis retours et navettes.
- Code barre unique (code 128, identifiant du chantier + nom de la boîte) ; modèle de boîte (pavillonnaire carrée) et couvercle haut / bas en simple mention.
- Textes plus gros, sans Ph / N / PE ; gaine écrite « LI01.10 · P14 · 4,8 m · Ø16 » ; alimentation avec accolades et bagues 1, 2… sous les bornes.

## 48 — Impression complète du plan
- Boîtes (faces, numéros de gaine, couleurs des circuits), gaines avec leurs points intermédiaires, liaisons en courbe comme à l'écran.
- Impression selon le filtre de vues actif, une case par calque dans la fenêtre d'impression.
- Rendu vérifié sur le PDF produit, comme pour l'échelle. Placée en dernier : le dessin des boîtes et des gaines peut encore bouger avec le tableau.

## Sans date
- Interrupteur à voyant (avec neutre) et nouvel appareillage.
- Export SPV pour Counter.
- Packs propres à chaque pavillonneur (aujourd'hui communs, enregistrés sur le PC).
- Relevé IA en ligne avec une clé (OpenAI Sol / Astra : clé et CORS à vérifier).
- Recollage des murs coupés aux portes pour le relevé Opus.
- Page « Reprendre le projet » : seulement quand Kévin le demandera.
