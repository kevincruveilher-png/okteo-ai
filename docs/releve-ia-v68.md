# Relevé IA v68 — MAJ 1 et 2

Autorisation : Kévin, 29 octobre 2026, « Go pour maj 1 et 2 » et intégration de la branche bibliothèque dans le tronc.

## Données conservées

La conversion ne supprime plus un type inconnu : il devient `INCONNU`, visible par un `?`, avec son type reçu, son inscription et son point de lecture. Il reste à identifier et ne reçoit pas un circuit inventé. `PC32` distingue une prise/sortie générique 32 A de `PC20` et de la plaque `PLAQ`. Le raccordement de PC32 reprend les caractéristiques 6 mm² / 32 A du type plaque existant, sans lui attribuer cet usage.

Champs optionnels d'un appareil (compatibles avec les anciens fichiers) :

| Champ | Sens |
|---|---|
| `qty` | Quantité physique d'un bloc ; `null` si illisible ; absence sur les anciens relevés = non renseignée. |
| `calibre` | Ampères explicitement lus ; une inscription explicite « 32 A » est aussi conservée. |
| `inscription` | Texte lu à côté du symbole, sans le remplacer par une déduction. |
| `aiGroup` | Regroupement indiqué sur le plan. |
| `aiStatus` | `lu`, `a_identifier`, `a_confirmer`. |
| `aiOrigin` | `plan`, `interpretation`, `regle` ; ne pas confondre observation et proposition. |
| `aiType` | Type reçu avant normalisation lorsqu'il diffère. |
| `aiNote` | Incertitude propre à l'appareil. |
| `aiReading` | Lecture originale en pixels, conservée malgré les corrections. |
| `commande` | Mode et alimentation interprétés en relecture, avec preuve visible. |

La réponse complète est conservée dans `cab.releves[niveau].evidence`. Les réponses aux corrections sont aussi archivées dans leur rapport. Les remarques de relevé ne sont plus tronquées à 600 caractères lors du stockage. Le prompt de relecture garde un extrait synthétique, et les inscriptions des appareils concernés restent disponibles.

Les informations sont visibles dans l'aperçu d'import et sous « Informations relevées sur le plan » dans les propriétés. Elles suivent `allApps`, l'annulation/rétablissement, les sauvegardes et l'export `.okteo`. Aucune migration destructrice des fichiers existants.

## Deux temps de lecture

Le prompt initial et sa méthode par quarts sont conservés. L'introduction dessinateur est partagée entre le mode avec clé et « Copier la consigne ». Le prompt initial conserve les inscriptions, quantités et calibres ; il ne porte pas la procédure détaillée des détecteurs.

Le contrôle logiciel signale « Commande non identifiée », ce qui n'est pas la preuve d'un défaut. Les inconnus et informations incertaines sont également signalés. La relecture existante reçoit une question ciblée, le plan entier et, quand disponibles, les zooms. Elle cherche une commande oubliée ou des indications de détecteur intégré/séparé.

La rubrique `lectures` de sa réponse permet notamment :

```json
{"lectures":[{"rep":"AP1","aiOrigin":"interpretation","aiStatus":"a_confirmer","commande":{"mode":"detecteur","detecteur":"integre","alimentation":"permanente","preuve":"ALIM DETECTEUR PERSONNE et symbole visible"}}]}
```

Modes : `manuelle`, `detecteur`, `inconnue`. Détecteur : `integre`, `separe`, `inconnu`. Alimentation : `permanente`, `commandee`, `inconnue`. Sans preuve, les valeurs restent inconnues. Qualifier un détecteur ne crée aucune liaison ni raccordement : la MAJ 4 est distincte et le contrôle peut donc rester signalé.

## Import sûr

JSON complet et tableaux valides sont vérifiés avant conversion. Une position ou quantité d'appareil invalide annule le relevé avant ajout. `importDevices` vérifie sa liste avant snapshot/remplacement. Une réponse tronquée ne peut plus être interprétée comme un relevé partiel valide (le refus des JSON tronqués existait ; il est conservé et testé).

## Limites voulues de cette livraison

- Les quantités de blocs sont conservées et consultables. Le calcul détaillé de mécanismes, plaques et pontages et l'exploitation complète des quantités dans les bilans/circuits ne sont pas annoncés comme livrés par ce lot.
- Ni équipement spécialisé systématique, ni halo violet, ni antenne automatique, ni nouveau réseau VMC : MAJ 3 à 5 non autorisées ici.
- Pas de refonte de charte des plans ni des ouvrants ; pas de correction opportuniste du placement d'étiquettes déjà signalé en v67.
- La bibliothèque de symboles garde ses modifications locales au navigateur ; cette fusion ne crée pas une base partagée ni une reconnaissance automatique des dessins BE.
- Le taux de 99,99 % est un objectif à mesurer sur une référence du même plan source, pas un résultat de ces tests.

## Contrôles

`npm run check`, `npm run test:lecture:navigateur`, `npm run test:symboles:navigateur` et `npm run build`. Tests ciblés dans `scripts/ai-reading.test.mjs`, y compris le parcours réel d'import/relecture/export/réouverture et l'absence d'injection HTML dans les propriétés. Aucun vrai appel à un fournisseur IA dans ces tests.
