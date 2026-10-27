# Oktéo AI — Remarques pour le développement (journal des règles de câblage)

Note de passation de la discussion du 27/10/2026. À lire avec le fichier **journal-regles-cablage.md** (52 règles, registre de questions, historique H-001 à H-028). Aucune ligne de code n'a été écrite dans cette discussion : le code de l'application n'y était pas accessible. Tout ce qui suit est à construire dans la discussion qui a le code.

**Principe de travail de Kévin (à respecter)** : Claude pilote le développement, décide techniquement et avance par gros incréments ; Kévin n'est pas expert en dessin industriel et valide ou corrige. Il communique en français.

---

## 1. Ce qu'il faut retenir en dix lignes

1. Le journal est la **référence unique des règles de câblage**. Il vit dans **Paramètres → Journal des règles de câblage**.
2. Il n'est **modifiable que par l'IA** : ajouter, modifier, supprimer = proposition avant / après, validation de Kévin, entrée d'historique. Pas d'édition directe.
3. **Toute modification demandera un code** : à noter seulement. Prévoir une fonction unique `autoriserModification(action, regle)` qui renvoie toujours « autorisé » pour l'instant, et le champ `code_valide` dans l'historique.
4. **Le logiciel ne devine jamais.** Aucune valeur par défaut silencieuse : sans règle `confirmee`, il signale un doute (section 3 du journal).
5. La commande IA « câbler » fait un **précontrôle** ; elle ne câble seule que si aucun point `bloquer` n'est ouvert.
6. Une règle a une **certitude** (`confirmee`, `supposee`, `inconnue`) et un **comportement en cas de doute** (`bloquer`, `avertir`). Les résultats issus d'une règle non confirmée portent la marque « à vérifier », y compris sur la bande imprimée.
7. **Pas d'arbre** à l'écran : un tableau filtrable pour les règles, une bande de 9 étapes pour l'étude, une liste « Où ça coince », et « Pourquoi ? » sur le plan. Les champs `noeud`, `depends_on`, `choix` sont conservés dans les données.
8. L'état des règles : 25 `active` · `confirmee`, 25 `a_valider`, 1 `brouillon` (R-009 Plug de pieuvre), 1 `archivee` (R-076). Les `a_valider` restent en vigueur comme comportements actuels du logiciel, avec la marque « à vérifier ».
9. **Quatre pavillonneurs, aucune différence de règles** : les règles sont communes à tous (Q-26 à confirmer par Kévin).
10. Tableau (différentiels, parafoudre…) : **reporté par Kévin** (Q-65 à Q-68). Ne pas toucher à R-050 pour l'instant, sauf pour noter que les bandes montrent des ID de 63 A et pas de 40 A.

---

## 2. À construire (par ordre conseillé)

### A. Le journal dans Paramètres
- Stockage JSON : règles, questions, historique ; import / export du journal complet.
- Format d'une règle : voir la section 1 du journal (`id`, `titre`, `categorie`, `description`, `condition`, `action`, `parametres`, `certitude`, `si_doute`, `statut`, `source`, `questions_liees`, `noeud`, `depends_on`, `choix`, `version`, dates, `modifie_par`).
- Vue 1 : tableau filtrable (identifiant, titre, catégorie, certitude en pastille verte / orange / rouge, statut), filtres catégorie / certitude / statut / recherche, compteur par catégorie, catégorie rouge si une règle `bloquer` est inconnue.
- Vue 2 : fiche d'une règle avec « dépend de », « utilisée par », choix possibles, historique, pastilles d'usage.
- En tête du tableau, les **choix du chantier** (réglables par le client ou le BE) : mode de pieuvre (Proximité, Équilibrée, Par pièce, Plug de pieuvre), volets (boîte à part ou mélangés), hotte et appareils à choix (boîte, ligne directe, à choisir).
- Commande IA « modifier une règle » : avant / après, validation, historique, `autoriserModification()`.

### B. Moteur de câblage (src/cablage/) : les paramètres et comportements à brancher
| Règle | Comportement ou paramètre |
|---|---|
| R-001 | `departs_max = 12` (hors alimentation), `gaines_par_face_max = 6` (alimentation comprise). **Règle propre à Oktéo, voulue** : les boîtes FTZ ont 15 à 19 départs, ne pas s'en inspirer. |
| R-088 | Face pleine : la gaine passe sur la face voisine, sans avertissement ; plus de face libre = doute bloquant. |
| R-077 | Numéro de gaine `NomBoîte.NN` : `.01` = alimentation, les autres **strictement dans le sens horaire** (A, B, C, D) à partir de l'alimentation. FTZ ne le fait pas toujours : ne pas reproduire ses inversions. |
| R-031 | Numéros de raccordement (règle de Kévin) : n° 1 = terres, puis par circuit neutre puis phase, puis retours et navettes. Différent de FTZ (R-076 archivée). |
| R-074 | Somme des sections ≤ 7,5 mm² : ICTA 16 ; au-delà : ICTA 20 ; capacité de l'ICTA 20 : 13,5 mm² (paramètres réglables) ; au-delà : doute bloquant. Contrôlé à la main sur les gaines limites (7,5 et 13,5 mm²) et sur plusieurs dizaines d'autres de 4 chantiers, sans exception ; à relancer en test automatique sur toutes les gaines. |
| R-075 | Gaine d'alimentation `.01` : éclairage R / B (1,5), prises GR / BF (1,5), cuisine R / B (2,5), volets GR / B clair ; numéros selon R-031, pas ceux de FTZ (H-029) ; **une seule terre V/J, de la plus grande section** de la gaine (2,5 si cuisine ou équipotentielle locale). Au plus un circuit éclairage et un circuit prises par boîte, sauf R-085. |
| R-020, R-021 | Rouge 1,5 = phase des **lumières uniquement** ; gris = phase des **prises uniquement**. Jamais mélangés, quel que soit le nombre de circuits dans la boîte. Prises : 8 au plus par circuit. |
| R-085 | Plus de 8 prises : 2e circuit prises dans la même alimentation, ou prises en trop dans une autre boîte, selon le mode de pieuvre. Le 2e circuit garde les couleurs du 1er (bague = numéro du circuit). Un circuit n'est jamais réparti sur deux boîtes (R-007), sauf peut-être en Plug de pieuvre. |
| R-022, R-086 | Cuisine en 2,5 mm² (R 7 / B 8), 6 prises au plus ; hotte en boîte ou en ligne directe selon `raccordement : boite | ligne_directe | a_choisir`. |
| R-072, R-023 | Ronde de couleurs Oktéo : orange, violet, noir, marron, ivoire. Même couleur sur tous les fils d'un allumage ; couleurs différentes dans une même gaine ; pas de répétition tant qu'il reste une couleur libre dans la boîte ; bague au numéro de l'allumage en cas de répétition ; impossible = doute bloquant. |
| R-093 | Télérupteur dans le tableau ; bouton poussoir = phase + commande (couleur de la ronde) ; retour aux lumières commandées (autre couleur de la ronde) ; les deux fils du télérupteur passent par la gaine d'alimentation. **Neutre au bouton seulement si voyant ou domotique** (R-083). |
| R-094 | Volets roulants : mode Proximité = solution la plus économique ; mode Équilibrée = une seule boîte pour tous les volets. Critère provisoire de « plus économique » : longueur totale de gaine, puis nombre de boîtes, puis départs (Q-77 ouverte). |
| R-079, R-087 | Volets : circuit dédié, 1,5 mm², gris + bleu clair + V/J, **50 W par moteur** (`puissance_moteur_w = 50`), calibre par défaut 10 A (`calibre_volets_a = 10`) : 46 moteurs au plus sous 10 A, 73 sous 16 A. Puissance absente = doute. |
| R-096 | Chaque volet est **filaire** (CVR : alimentation + 2 fils de commande marron et noir pris dans la ronde, présents dans la gaine du CVR et celle du moteur) ou **connecté** (micromodule : gris + bleu clair + V/J seulement). Choix par volet sur le plan. |
| R-095 | **Bouchon obligatoire** dans la boîte pour toute gaine qui amène l'air extérieur (câble 3G1,5 des appliques extérieures) ; à marquer automatiquement sur la bande et dans le décompte. |
| R-089 à R-092 | Liaisons interdites : deux gaines vers un même appareil (sauf gaine à deux circuits pour deux appareils au même endroit) ; spécialisés dans une gaine partagée ; phase ou neutre partagés entre circuits (les terres oui) ; va-et-vient coupé entre deux boîtes ; prise de la salle de bain sur le circuit cuisine ; boîte à boîte (sauf Plug). Borne : pas de limite de fils, jamais de sections mélangées. |
| R-003, R-082 | Ligne directe : spécialisés, sorties de câble, **tout le courant faible** (RJ45, TV, antenne, interphones, sonnette). Courant fort et faible jamais dans la même boîte ni la même gaine. |
| R-084 | Courant faible : gaine verte Ø20 (ICTA 20V) **pour tous les chantiers**. Nouveaux types d'appareils : voir le point D. |
| R-081 | Repère de circuit au tableau : numéro encadré de 1 à N sur tout le chantier, éclairage puis prises, dans l'ordre des boîtes. Déjà présent sur les boîtes de l'appli. |
| R-005 à R-008 | Une boîte peut desservir plusieurs pièces et niveaux et mélanger éclairage et prises ; un circuit n'est que dans une boîte ; pas de boîte à boîte. |
| R-009 | **Plug de pieuvre : brouillon, bloquant.** Liaison gaine ou connecteur (choix), circuits répartis ou limités à une boîte (choix). Chaîne de boîtes inconnue (Q-42, Q-44) : Kévin transmettra un chantier de ce type. Ne pas câbler ce mode. |

### C. Doutes, précontrôle et étude
- Précontrôle avant « câbler » : liste des règles utiles au chantier avec leur certitude ; doutes visibles sur le plan (marqueur), dans le compteur, dans une liste cliquable et dans un **rapport de câblage**.
- Trace de l'étude (9 étapes : lecture du plan, mode de pieuvre, boîtes, circuits, allumages, gaines, raccordements, tableau, contrôle) avec états ✓ appliqué, ◐ supposé, ? doute, ✕ bloqué, ✎ corrigé à la main ; **alternatives avec leur score** (longueur totale de gaine, boîtes, départs).
- Vues : bande des 9 étapes, liste « Où ça coince » avec bouton « Proposer une modification de la règle », « Pourquoi ? » sur le plan, tableau de statistiques (règle souvent corrigée, étape bloquante, alternative jamais retenue). Détails : section 3 ter du journal.

### D. Types d'appareils à ajouter (R-084, tous acceptés par Kévin ; câble ou fils et section modifiables)
Radiateur (convecteur), sèche-serviette, caisson VMC, commande VMC, prise spécialisée nommée (four, lave-linge, lave-vaisselle, sèche-linge), plaque de cuisson (6 mm²), chauffe-eau thermodynamique, prises extérieures (sortie de câble 3G2,5), interphones, antenne et prises TV (courant faible), équipotentielle principale et locale, moteur de volet roulant, module Aqua Air (3G2,5 + pilotage 3×1,5), bouche de diffusion motorisée (YSYT 2×1 souple, sans gaine), moteur de garage (ligne directe 1,5 GR + BF + V/J), prise extérieure 4G1,5, Velux motorisé (dans la boîte des volets), interrupteur de coupure (ligne directe ICTA 16, 1,5 R + N), climatisation (4G1,5 ICTA 20), G EXT (3G1,5 ICTA 16 ou 3G2,5 ICTA 20 selon le chantier), commande de volet roulant (CVR). **Restent à préciser** : AIG2, gaine aiguillée Ø40 (section J).

### E. Bande et tableau des lignes directes
- Bande de boîte : étiquettes `NomBoîte.NN · repère · longueur · Ø`, marque « à vérifier » pour toute valeur non confirmée, marque « BOUCHON » (R-095), **longueur totale de la boîte** imprimée sous son nom (FTZ le fait sur la bande FONTES ; à valider : somme des longueurs des gaines).
- Tableau des lignes directes : étiquette, longueur, gaine, fil, aboutissant, vérification ; total par diamètre.

---

## 3. Chantiers réels pour les tests (tous issus de FTZ SchemBAT)

| Chantier | Pavillonneur | Boîtes | Départs par boîte (FTZ) |
|---|---|---|---|
| DUCOURNEAU AF26075150 | IMMO CONSTRUCTION | 5 | 15, 12, 18, 15, 6 |
| FALGUA E6390 AF26064297 | ALPHA CONSTRUCTIONS | 8 | 12, 11, 19, 12, 16, 11, 4, 3 |
| BATELIER JEAN LOUIS L51S078C AF26064644 | MAISONS LARA | 7 | 18, 16, 7, 10, 9, 9, 8 |
| FONTES D2129 MAISON 1 AF25124651 | POLYGONE 46 | 4 | 12, 10, 17, 4 |

Tests à écrire (invariants vérifiés à la main sur ces quatre chantiers) :
1. Jamais plus de 6 gaines par face. 2. Diamètre : somme ≤ 7,5 = ICTA 16, jusqu'à 13,5 = ICTA 20. 3. Une terre de la plus forte section dans l'alimentation. 4. Repères de circuit 1…N dans l'ordre des boîtes, éclairage puis prises. 5. Prises ≤ 8 par circuit, cuisine ≤ 6. 6. Numéro de gaine strictement horaire. 7. Couleurs de la ronde sans répétition dans une gaine. 8. Volets : circuit gris / bleu clair, 10 A.
**Attention : le nombre de boîtes ne doit pas être comparé à FTZ** (limite de 12 départs chez nous). Avec 12 départs par boîte, DUCOURNEAU devrait avoir environ 6 boîtes au lieu de 5.

---

## 4. Points ouverts (ne pas coder en dur)
- **Q-77** : critère de « plus économique » en mode Proximité (proposé : longueur totale de gaine, puis boîtes, puis départs). Kévin a demandé une explication, pas encore de réponse.
- **Q-42, Q-44** : Plug de pieuvre, en attente d'un chantier de ce type.
- **Q-65 à Q-68** : tableau, reporté.
- **Q-26** : règles communes à tous les pavillonneurs, à confirmer.
- **Registre Q-01 à Q-28** : jamais refermé formellement, à repasser avec Kévin.
- **Par pièce** et **Plug de pieuvre** pour les volets (R-094) : pas de règle, doute `avertir`.
- **R-088** : plus aucune face libre = doute bloquant (ajout de Claude, non validé).

## 5. Pièges à éviter
- **FTZ n'est pas la référence.** Kévin a explicitement écarté FTZ sur : numérotation des raccordements (terres d'abord, R-031), limite de départs (12), sens horaire strict, ronde de couleurs (« fais mieux et plus intelligent », R-072). FTZ a utilisé le violet à deux endroits (commande de télérupteur, navette de va-et-vient) ; cela confirme sa place dans la ronde.
- **Les règles `supposee` et `a_valider`** ne sont pas des faits : le logiciel marque leurs résultats « à vérifier ». Le journal consigne qui a décidé quoi (Kévin ou déduction de Claude).
- **Le journal n'est pas du code** : ne pas inventer de règle absente ; en cas de doute, le moteur crée un doute et pose la question.
- **Le tableau** n'est pas traité : ne pas figer R-050.
