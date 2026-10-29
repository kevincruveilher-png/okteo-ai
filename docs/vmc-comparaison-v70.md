# MAJ 5 et 6 — v70

Autorisation Kévin : « Maj 5 et 6 ». Complète v69 ; la charte et les ouvrants restent reportés.

## MAJ 5 — réseau VMC

Dans Étude, « Préparer / compléter la VMC » prévoit le groupe, les bouches WC/SDB/cuisine, la commande cuisine associée et le rejet de toiture. Les bouches du plan sont réutilisées, sans les confondre avec les bouches de diffusion motorisées BOUCHE. Les types passifs VEX/VREJ ne créent aucun circuit électrique. Le groupe VMCG conserve son raccordement existant en 1,5 mm² / 2 A ; aucune nouvelle règle normative n’est déduite de ces propositions.

La trappe explicitement identifiée par inscription est prioritaire ; sinon proposition près du dégagement ou du garage, hors du garage. Le logiciel ne connaît pas le faîtage : ce placement en combles doit être vérifié. Sans pièces reconnues, trois bouches provisoires sont néanmoins proposées, avec le nom de la pièce attendue. Aucun déplacement automatique des appareils déjà présents. Les propositions VMC clignotent violet jusqu’à confirmation explicite dans Propriétés ; préférence système de réduction des animations respectée.

Les gaines de ventilation sont stockées dans `cab.vmc`, indépendamment des gaines électriques. Leur visibilité se règle séparément. Un bouton ajoute une bouche et sa gaine ; déplacer la bouche sur le plan ajuste les extrémités. Le parcours se précise par points intermédiaires et altitudes absolues en mètres. Sans altitudes complètes, la longueur affichée est seulement le minimum en plan : elle ne valide pas le rejet. Le rejet au-delà de 3 m déclenche un blocage dans les contrôles et l’étude. Cette limite est la règle métier demandée, pas une norme universelle. Un endpoint supprimé est signalé ; une gaine peut être retirée puis recréée par complétion. Les parcours renseignés sont conservés à la relance.

Gaines présentes dans le rendu et l’export géométrique/PDF ; sauvegarde `.okteo`, annulation et réouverture avec le chantier. Pour plusieurs niveaux, les tracés sont des projections sur les plans concernés ; les altitudes et le passage réel restent à renseigner. La commande cuisine est associée à sa bouche dans le réseau ; aucune liaison d’éclairage artificielle ni modèle électrique de vitesse inventé.

## MAJ 6 — comparaison et diagnostics

Un formulaire Étude permet de saisir chaque ligne de référence avec son origine (plan soumis, ajout/modification BE, inconnue), preuve/page, type, quantité physique, repères et gaine. L’appariement aux objets est explicite et un objet ne peut être consommé par deux lignes. Les lignes restent dans `cab.comparaison`, sont annulables et sauvegardées ; retrait et export du rapport sont disponibles.

Un objet double `qty=2` = un bloc et deux points physiques. Les repères P15+P16 et la gaine constituent des colonnes distinctes : aucune déduction automatique des mécanismes, plaques ou pontages. Un ajout BE n’est pas un oubli IA. Un oubli ne peut être qualifié que sur une source attestée, sans objet correspondant ou candidat du même type ; un inconnu empêche une conclusion hâtive. Types mal interprétés, quantités inconnues, appariements perdus et écarts quantitatifs restent séparés. Une quantité concordante laisse l’implantation et le câblage à vérifier séparément. PC EXT ne devient pas G EXT.

Les diagnostics des pièces et du tableau signalent noms absents/répétés, tableau absent/multiple ou hors pièce reconnue et circuits spécialisés non attribués. Ils ne déplacent rien et n’affirment pas de conformité réglementaire. L’export JSON rassemble référence, comparaison, diagnostics, réseau et longueurs. La lecture automatique d’un dossier BE entier n’est pas incluse : la source de référence et les appariements sont saisis par le BE.

## Transmission technique

Modules purs : `src/cablage/vmc.js`, `src/cablage/comparaison.js`. UI : `src/ext/vmc-comparaison.js`, accédant uniquement à l’API. `applyEquipmentProposal` renvoie désormais les identifiants dans l’ordre des propositions, y compris sur plusieurs niveaux, pour associer correctement les gaines. Contrôles VMC via `core/check.js`, trace dans `cablage/etude.js`. Catalogue et tests smoke complétés.

Validation : tests purs et parcours Chromium dédiés, régressions existantes et build ; résultats exacts dans `docs/journal.md`.
