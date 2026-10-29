# MAJ 3 et 4 — v69

Autorisation : « Go maj 3 et 4 et push sur git », le 29 octobre 2026. Complète v68 et conserve la bibliothèque intégrée.

## MAJ 3 — compléments d’étude et implantation

- Cuisine : four, lave-vaisselle, plaques. Cellier par défaut : lave-linge et sèche-linge. Pièce non reconnue : proposition provisoire au centre du plan avec motif explicite. Règles métier KITeOHM, pas des observations de l’IA ni une affirmation de conformité réglementaire.
- Si une prise TV existe, prévoir une antenne unique. Sans indication, proposer le milieu de la maison près du faîtage, avec position à confirmer ; le logiciel ne reconnaît pas la géométrie de toiture.
- Ne pas doubler les appareils existants ni déplacer leurs positions lues ou corrigées. PC32 en cuisine : usage PLAQ attribué par la règle métier sans changer le calibre ni la lecture originale. « Voir plan cuisine » et indications de principe restent provisoires. Une prise 32 A hors cuisine ne devient pas automatiquement plaque.
- Violet : position précise à définir. L’utilisateur déplace ou vérifie puis clique « Confirmer cet emplacement » dans Propriétés. Déplacer seul ne retire pas le halo. « Remettre à préciser » permet une nouvelle revue. L’état ne supprime pas les autres doutes électriques ou de lecture.
- Complétion par bouton Étude et commande de catalogue, également lors de « Câbler le chantier » après précontrôle réussi. Relancer ne crée pas de doublons et respecte les confirmations. Pas de modification lors de la simple consultation d’un onglet.
- Application sur tous les niveaux via API, annulable en une étape. Métadonnées sauvegardées, exportées dans `.okteo` et géométrie, halo repris dans le PDF de plan. Les circuits existants sont conservés et seuls les ajouts métier non couverts reçoivent des circuits supplémentaires ; le mode historique « circuits par boîte » conserve son recalcul.

## MAJ 4 — détecteur intégré et alimentation permanente

Le premier relevé signale toujours une commande non identifiée. La relecture ciblée v68 peut établir une commande structurée : `mode=detecteur`, `detecteur=integre`, `alimentation=permanente`, `preuve` non vide. Ces quatre conditions sont obligatoires.

Sans liaison manuelle contradictoire, une APP/LUM/SPOT ainsi confirmée reçoit phase permanente, neutre et terre sur les raccordements du même circuit éclairage dans sa boîte. Les sections et couleurs suivent les règles existantes. Aucun interrupteur fictif, aucun retour lampe flottant. Un détecteur séparé, une preuve absente ou une alimentation inconnue reste à résoudre. Commande manuelle liée à un détecteur intégré déclaré permanent : alerte de contrôle et doute de câblage bloquant ; aucun remplacement silencieux par une alimentation permanente.

Le mode essai ne simule pas les mouvements : alimentation permanente ne signifie pas lampe toujours allumée.

## Hors périmètre

VMC/bouches/gaines/commande (lot suivant), charte graphique/ouvrants et étude détaillée de l’appareillage. L’objectif de détection exhaustive reste à mesurer sur un corpus ; aucune garantie de 99,99 % n’est annoncée.

## Validation

Tests purs de proposition et de câblage, parcours Chromium (complétion, halo, confirmation, annuler/rétablir, export, réouverture, niveaux, contrôle détecteur), smoke existant et build. Les résultats et références Git exacts sont consignés dans `docs/journal.md` après exécution.
