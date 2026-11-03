# Banc d'essai des 4 modes d'« Analyse IA » (v76)

But : mesurer, plan par plan, ce que chaque mode apporte (rappel, omissions, faux positifs, durée, coût) avant de
fixer les seuils de la recommandation et les points « Durée / coût » de l'écran. **Aucun taux n'est annoncé tant que
ce banc n'a pas tourné sur des plans validés par le BE**, et un résultat reste propre à l'essai qui l'a produit.

## 1. Le jeu d'essai

Au moins 3 plans par catégorie (9 plans pour commencer), de préférence des maisons de la cible (90–150 m²) :

| Catégorie | Exemples | À noter dans la fiche |
|---|---|---|
| `vectoriel` | PDF d'architecte exporté (traits) | pavillonneur, A3/A4, densité |
| `scan-net` | scan droit, contrasté, ≥ 200 dpi | dpi, origine |
| `scan-degrade` | scan incliné, pâle, bruité, annoté à la main | défauts visibles |

Le dépôt est public : Kévin a accepté que les plans d'essai y soient (03/11/2026). Ranger chaque essai dans
`docs/essais-v76/<PLAN>/` : le PDF, la vérité terrain, les exports par mode et la ligne du tableau.

## 2. La vérité terrain

1. Ouvrir le plan dans Oktéo, dessiner ou corriger l'implantation **à la main** (ou partir d'un relevé IA et tout
   vérifier), sans rien laisser « à confirmer ».
2. Faire valider par le BE : chaque appareil, son type, sa position (à ± 30 cm), ses liaisons.
3. Exporter le chantier (`.okteo`) : c'est `VERITE.okteo`. Ne plus recalibrer l'échelle ensuite : les essais doivent
   garder les mêmes mètres.

## 3. Un essai par mode

Pour chaque mode 1 à 4, sur une **copie** du chantier (même échelle, dessin vide ou sans appareils) :
1. Menu Relevé → « ✦ Analyse IA » → noter le mode recommandé, puis choisir le mode de l'essai → « Lancer ».
2. Garder les appareils (cases de l'aperçu), « Ajouter la sélection », laisser les relectures automatiques aller au bout.
3. Exporter tout de suite (`.okteo`), **avant toute correction à la main** : `RESULTAT_mode1.okteo`, etc.
4. Noter ce que l'écran a dit : écarts proposés, documents recoupés (mode 4), tuiles en échec.

## 4. La mesure

```
node scripts/modes-bench.mjs --verite VERITE.okteo RESULTAT_mode1.okteo RESULTAT_mode2.okteo RESULTAT_mode3.okteo RESULTAT_mode4.okteo \
  --categorie scan-net --csv docs/essais-v76/resultats.csv --detail
```

- appariement : même niveau, même famille de type (prises, commandes, lumières…), à 30 cm au plus (`--tol`) ;
- **rappel** = appareils de la vérité retrouvés ; **omissions** = appareils de la vérité absents du relevé ;
  **faux positifs** = appareils relevés qui ne sont pas dans la vérité ; **types justes** = type exact parmi les trouvés ;
- durée, tokens, coût : journal de l'analyse enregistré dans le chantier (lecture globale, tuiles, zooms, relectures),
  coût au tarif configuré (la facture Anthropic fait foi) ;
- `--detail` liste les omis et les « en trop » avec leur position, pour les retrouver sur le plan.

## 5. Ce qu'on en tire

- par catégorie : le mode le moins cher dont les omissions sont acceptables pour le BE → seuils de
  `RECO_SEUILS` (src/walls/ai-modes.js) et points « Durée / coût » de l'écran ;
- les zones souvent ratées (petits symboles, extérieurs, cuisine) → consignes des tuiles ;
- les écarts « à vérifier » qui étaient de vraies erreurs → valeur réelle des modes 2 à 4.
- Chaque essai est ensuite analysé avec Claude (nouvelles règles éventuelles dans `docs/journal-regles-cablage.md`),
  puis on repart du dessin vide pour l'essai suivant.
