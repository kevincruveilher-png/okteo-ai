# MAILLARD (AF26074801) — Oktéo (relevé IA + corrections de Kévin) comparé au bureau d'études

Comparaison faite le 28/10/2026 (00:30) par Claude.
- **Côté Oktéo** : `.okteo` envoyé par Kévin le 28/10/2026 à 00:17. Il contient le relevé Opus, les corrections de Kévin, 10 boîtes, le mode « Équilibrée » et la boîte LI02 posée et verrouillée à la main. Le câblage est calculé par `scripts/chantier-wiring.mjs`, avec les réglages de base, en version 0.55.2. Deux recalculs complets ont aussi été faits avec les règles actuelles : un à 12 départs, un à 16.
- **Côté BE** : `MAILLARD_bandes_FTZ.pdf`, 6 boîtes et 32 lignes directes.

## 1. Ce qui est identique (contenu des gaines)
- **Prises** : gris + bleu foncé + vert/jaune 1,5.
- **Lumières** : bleu + retour + vert/jaune.
- **Commandes** : phase rouge + retour, sans terre.
- **Va-et-vient** : 2 navettes de même couleur + 1 retour d'une autre couleur. Les va-et-vient d'un même endroit sont groupés dans une gaine.
- **Alimentation 2 circuits** (R B GR BF V/J) : ICTA 16. Terre en 2,5 si une EQ locale ou la cuisine est dans la boîte.
- **Lumières extérieures** : câble 3G1,5 (bleu, marron, vert/jaune) en ICTA 16, ce qui correspond à L1, L1A et L3 chez le BE.
- **Lignes directes communes** : moteur de garage, interphone 4G1,5, TV et RJ45 en gaine verte (grade 3, 17 VATC). Le fil et la gaine sont identiques.
- **Doutes** : aucun doute bloquant côté Oktéo.

## 2. Écarts dus au relevé (le plan lu par l'IA)
| Appareil | BE | Oktéo | Cause probable |
|---|---|---|---|
| Four, LL, LV, SL, plaques, hotte | présents | absents | non relevés : sur le plan ? (question 1) |
| VMC + commande VMC, bouches K1A à K6 (7) | présents | absents | idem |
| Sèche-serviette SS1, îlot, EQ1 (locale), EQ2 (principale), antenne | présents | absents | idem |
| Sonnette SON + bouton BPS, G EXT | présents | absents | idem |
| Chauffe-eau (CETH) | absent | 1 ligne 3G2,5 | le « cercle du garage » pris pour un chauffe-eau (doute signalé par l'IA) |
| Aqua Air | 1 ligne | 2 modules (unités int. et ext.) × 2 lignes | l'IA a relevé 2 appareils, et notre catalogue met 2 lignes (Q-85, Thibault) |

En lignes directes, cela donne 20 lignes du BE absentes chez nous, et 4 lignes en trop (CETH, 2e Aqua Air, 2 lignes de pilotage). Les 12 lignes restantes concordent : RJ1 à RJ7, TV1, TV2, interphone, moteur, Aqua Air.

## 3. Écarts dus à nos règles ou à notre moteur
1. **Nombre de boîtes : Oktéo 10 (7 + 3 de volets), BE 6 (5 + 1 de volets).**
   - Nos boîtes ont 8 à 11 départs, celles du BE 11 à 15.
   - Après recalcul à 12 départs : 11 boîtes. À 16 départs : 8 boîtes, soit 7 + 1 de volets à 15 départs.
   - Notre moteur garde des boîtes moins pleines parce qu'il cherche d'abord la longueur de gaine la plus courte (Q-77 : longueur, puis boîtes, puis départs). Le BE remplit au maximum : il cherche le moins de boîtes.
   - **Question 2.**
2. **Volets.**
   - Le BE a des volets connectés : 8 moteurs dans une boîte, une gaine GR B V/J par moteur, aucune commande.
   - Oktéo a des volets filaires : une gaine par commande (CVR) et des fils de commande, donc 3 boîtes, ou 1 boîte de 15 départs à 16.
   - **Erreur de notre moteur** : les moteurs de volet, posés dans le mur, sont vus comme « extérieurs », et leur gaine reçoit un câble 5G1,5 au lieu de fils. À corriger : un volet n'est jamais extérieur.
   - Gaine de commande de volet : nous y mettons gris + bleu clair + 2 retours. Le neutre est inutile pour un inverseur : à vérifier si le mode filaire est gardé (question 3).
3. **Cuisine ouverte.** Chez nous, aucun circuit cuisine : P28 à P31 sont sur un circuit prises 1,5. Le BE les met en 2,5 avec la hotte. La règle R-098 est déjà décidée et sera codée en 56.
4. **Commande et prises dans la même gaine.** Oktéo groupe parfois un interrupteur et des prises voisines (« même endroit », 30 cm) dans une gaine ; exemple : LI01.02 = I11 + P9 + P13. Le BE ne mélange jamais : il groupe des prises entre elles (P15+P10), des commandes entre elles (I8+I7) ou des va-et-vient entre eux (V9+V10). **Question 4.**
5. **Circuits.** Oktéo compte 24 circuits (2 par boîte + 3 de volets + spécialisés), contre 12 au BE. La conséquence directe est le nombre de boîtes : moins de boîtes donne moins de circuits.
6. **Étiquettes des lignes directes.**
   - Oktéo écrit « R1 », « AQUA AIR1 », « MOTEUR1 ». Le BE écrit « RJ1 », « AQUA AIR », « MOTEUR » : pas de numéro quand l'appareil est seul.
   - Le total suit la règle R-099 (déjà décidée).
7. **Écarts voulus, non comptés** :
   - numérotation des raccordements, terres n° 1 (R-031) ;
   - sens anti-horaire (R-077) ;
   - pas de page « Repères tableau ».

## 4. Questions pour Kévin
1. Les 20 appareils absents chez nous sont-ils **dessinés sur le plan** ?
   - Si oui : l'IA les a ratés, et la consigne et la relecture doivent les chercher.
   - Si non : le BE les ajoute d'après le chantier (cuisine équipée, VMC, EQ, antenne, sonnette…). Il faut alors un « équipement standard du chantier » à compléter automatiquement, sur le modèle des packs de pièce.
2. Choix des boîtes : **le moins de boîtes possible** (comme le BE), ou **le moins de gaine** (Q-77 aujourd'hui) ?
3. **Volets** : sur ce plan, les commandes de volet sont-elles des télécommandes radio ? Qu'est-ce qui décide « connecté » ou « filaire » ?
4. **Une commande et des prises au même endroit** : jamais dans la même gaine (comme le BE) ?

## 5. Après la mise à jour 56 (28/10/2026)
Recâblage complet avec les nouvelles règles : 16 départs, mode Équilibrée qui cherche le moins de boîtes, volets connectés comme le BE, prises de plan de travail et étiquettes RJ. Test automatique : `scripts/maillard.test.mjs`.
- **6 boîtes, comme le BE** : 5 boîtes + 1 boîte de volets.
  - Départs : 9, 13, 15, 14, 11 et 8 chez Oktéo ; 11, 15, 13, 15, 14 et 8 au BE.
  - LI02 garde ses 9 départs : c'est la boîte posée et verrouillée à la main par Kévin.
- **Boîte des volets identique au BE** : 8 moteurs en gris + bleu clair + vert/jaune ICTA 16, sans commande câblée.
- **Circuits** : 17 contre 24 avant (2 ou 3 par boîte + volets + spécialisés). Le BE en a 12 parce qu'il ajoute les équipements hors plan à des circuits existants.
- **Contenu des gaines** : prises, lumières, commandes et câbles extérieurs comme le BE. Aucune gaine ICTA 25. Aucun doute bloquant.
- **Lignes directes communes** : identiques (RJ1 à RJ7, TV1, TV2, interphone, moteur).
- **Restent à faire en 57** :
  - les équipements hors plan (R-100) ;
  - les doutes du relevé (chauffe-eau, 2e Aqua Air) ;
  - les prises de plan de travail du relevé : leurs hauteurs ne sont pas relevées, il faut les marquer à la main ou les ajouter à la consigne IA.

## 6. Après la mise à jour 57 (28/10/2026)
- **Équipements hors plan** : panneau Câblage → « Équipements hors plan ». La liste de MAILLARD est le 1er chantier du registre (four, plaque, hotte, LV, LL, SL, îlot, VMC + commande, 7 bouches, sèche-serviette, EQ locale et principale, antenne, sonnette + bouton, G EXT). Ils sont posés dans la pièce qui convient, en violet « à vérifier avec le devis ».
- **Relevé** : la consigne demande maintenant les commandes des points extérieurs, les prises de plan de travail (`pt`), le sens des portes et la porte de garage.
- **Relecture ciblée** : les points du contrôle (le WC et les spots extérieurs sur MAILLARD) sont renvoyés à l'IA, à la main sans clé ou automatiquement avec une clé (2 relectures au plus).
- Restent à vérifier sur le prochain essai : le chauffe-eau et le 2e Aqua Air (doutes du relevé).

## 7. Après la mise à jour 59 (28/10/2026) : croisements des gaines sur le plan
- Avec un seul arc pour toutes les gaines : 81 croisements. Avec la 59 : 31, dont 22 avec les alimentations (pointillés), 9 entre gaines d'appareils et 1 dans une même boîte.
- Les croisements qui restent viennent presque tous de la boîte des volets (LI07), qui dessert les 8 volets de toute la maison.
