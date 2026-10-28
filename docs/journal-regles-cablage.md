# Journal des règles de câblage — Oktéo AI

Référence unique des règles de câblage (boîtes, gaines, circuits, couleurs, raccordements, repères, tableau). Il sert à l'onglet **Paramètres → Journal des règles de câblage**.
Créé le 27/10/2026. État au 28/10/2026 (00:01, H-039) : 55 règles (R-001 à R-099, numérotation discontinue ; décompte exact donné par le logiciel). État au 27/10/2026 (14:30) : 52 règles (25 `active` · `confirmee`, 25 `a_valider`, 1 `brouillon`, 1 `archivee`). Les règles `a_valider` viennent du journal de développement ou ont été déduites des bandes ; Kévin les confirme au fil de ses réponses. Règles testées sur 5 chantiers FTZ (DUCOURNEAU, FALGUA E6390, BATELIER JEAN LOUIS, FONTES D2129 MAISON 1) : voir sections 5 K à O.

**Objectif : le logiciel ne se trompe plus, et quand il ne sait pas, il le dit.** La commande IA « câbler » ne devine jamais : elle applique des règles confirmées, et signale tout doute ou toute règle absente.

---

## 1. Format d'une règle

Chaque règle est un objet JSON. Une règle supprimée passe en statut `archivee` (restaurable), jamais effacée.

```json
{
  "id": "R-001",
  "titre": "Court, lisible",
  "categorie": "boites | gaines | circuits | couleurs | reperes | raccordements | tableau | plan | presentation",
  "description": "Phrase en français que Kévin peut relire.",
  "condition": "Quand la règle s'applique",
  "action": "Ce que le logiciel fait / impose",
  "parametres": { "nom": "valeur réglable" },
  "certitude": "confirmee | supposee | inconnue",
  "si_doute": "bloquer | avertir",
  "statut": "active | a_valider | desactivee | brouillon | archivee",
  "source": "bande LI05 EVRARD, échange du 26/10, etc.",
  "questions_liees": ["Q-04"],
  "noeud": "chantier/boites/capacite",
  "depends_on": ["R-007"],
  "choix": { "nom": "mode_pieuvre", "valeurs": ["proximite", "equilibree", "par_piece", "plug"] },
  "version": 1,
  "cree_le": "2026-10-27",
  "modifie_le": "2026-10-27",
  "modifie_par": "Kévin | IA (validée par Kévin)"
}
```

Nouveaux champs :
- `certitude` : `confirmee` (Kévin l'a dit ou une bande le montre), `supposee` (déduite, à valider), `inconnue` (on sait qu'il en faut une, on ne la connaît pas).
- `si_doute` : ce que fait le logiciel quand la règle n'est pas confirmée. `bloquer` = le câblage s'arrête sur ce point ; `avertir` = il continue et marque le résultat « à vérifier ».

## 2. Règles de fonctionnement du journal

1. **Modification par l'IA uniquement** : ajouter, modifier ou supprimer passe par l'assistant. Pas d'édition directe.
2. **Proposer puis valider** : l'IA présente un avant / après ; rien n'est appliqué sans validation de Kévin.
3. **Historique obligatoire** : chaque changement crée une entrée (section 7) avec avant, après, date, motif.
4. **Suppression logique** : statut `archivee`, jamais d'effacement.
5. **Une règle = un sujet.** Si deux sujets se mélangent, on la scinde.
6. **Une règle sans source reste `brouillon`.**
7. **Export / import JSON** du journal complet (règles, questions, historique).
8. **Code de modification (à implémenter plus tard).** Toute modification exigera un code. Prévoir dès maintenant une fonction unique `autoriserModification(action, regle)` qui renvoie toujours « autorisé » pour l'instant, pour y brancher le code sans rien refaire. Champ réservé dans l'historique : `code_valide: true|false`.

## 3. Gestion du doute (le logiciel ne devine jamais)

**Principe : aucune valeur inventée.** Si le moteur a besoin d'une valeur (section, diamètre, couleur, surlongueur…) et qu'aucune règle `confirmee` ne la donne, il ne met pas de valeur par défaut en silence.

1. **Précontrôle avant câblage.** La commande IA « câbler » (ou le bouton) commence par lister les règles dont elle a besoin pour ce chantier. Pour chacune :
   - `confirmee` → appliquée ;
   - `supposee` → appliquée seulement si `si_doute = avertir`, et tout ce qu'elle produit est marqué **« supposé (R-xxx) »** ;
   - `inconnue` ou absente → si `si_doute = bloquer`, le câblage **ne démarre pas pour ce point** ; la question correspondante est posée à Kévin.
2. **Cas non prévus.** Un appareil, une pièce ou une situation qu'aucune règle ne couvre (ex. type d'appareil inconnu, gaine qui dépasse la capacité du plus grand Ø) : le moteur ne choisit pas, il crée un **doute** à la place.
3. **Doutes visibles.** Chaque doute apparaît : sur le plan (marqueur dédié, comme le halo orange du contrôle), dans le compteur du bandeau, dans une liste cliquable, et dans un **rapport de câblage** (règle manquante, appareil concerné, question à poser).
4. **Doute sur la bande.** Un élément de la bande de câblage issu d'une règle non confirmée est imprimé avec une marque « à vérifier » : une bande imprimée ne peut pas mélanger du certain et du supposé sans le dire.
5. **Réponse = règle.** Quand Kévin répond à une question, l'IA propose la règle correspondante (avant / après), puis la passe en `confirmee` après validation. Les questions ne sont jamais reposées.
6. **Qui peut lancer « câbler ».** L'IA peut activer le câblage seule si aucun point `bloquer` n'est ouvert. Sinon elle répond : « Je ne peux pas câbler : il manque N règles » + la liste.

---

## 3 bis. Bibliothèque des règles : tableau filtrable (décidé le 27/10/2026)

**Principe.** C'est la vue de **nos règles à nous**, indépendante de tout chantier. Nos règles sont presque à plat (peu de dépendances réelles), donc la forme retenue est un **tableau filtrable**, pas un arbre à déplier. L'arbre n'est pas supprimé côté données : les champs `noeud`, `depends_on` et `choix` restent dans chaque règle, pour dessiner un arbre plus tard si le besoin apparaît.

**Champs de chaque règle** : `noeud` (chemin logique, ex. « chantier/boites/capacite »), `depends_on` (règles dont elle dépend), `choix` (si la règle ouvre un choix : nom et valeurs, comme le mode de pieuvre).

**Vue 1 : tableau des règles (Paramètres → Journal des règles de câblage)**
- Colonnes : identifiant, titre, catégorie, certitude (pastille verte / orange / rouge), statut.
- Filtres : catégorie, certitude, statut, recherche libre. Un compteur par catégorie indique combien de règles sont encore supposées ou inconnues.
- Une catégorie passe en rouge si au moins une de ses règles `bloquer` est inconnue.

**Vue 2 : fiche d'une règle** (clic sur une ligne)
- Description, condition, action, paramètres, source, questions liées, historique de la règle.
- **« Dépend de »** et **« Utilisée par »** : les dépendances ne s'affichent qu'ici (exemples : R-085 ← R-007 et R-075 ; R-072 ← R-070 et R-071 ; R-023 précisée par R-072).
- Si la règle ouvre un choix, ses valeurs sont listées (mode de pieuvre : Proximité | Équilibrée | Par pièce | Plug de pieuvre).
- Pastilles d'usage venues des études (section 3 ter) : applications, doutes, blocages, corrections manuelles.

**Les choix du chantier** (réglables par le client ou le BE) forment une courte liste en tête du tableau :
- Mode de pieuvre : Proximité | Équilibrée | Par pièce | Plug de pieuvre (R-009, R-085)
- Volets roulants : boîte à part | mélangés aux autres boîtes (R-079)
- Hotte et appareils à choix : boîte | ligne directe | à choisir (R-086)
- Pavillonneur : règles communes à tous (confirmé par Kévin le 27/10/2026, Q-26 ; aucune différence constatée sur IMMO CONSTRUCTION, ALPHA CONSTRUCTIONS, MAISONS LARA, POLYGONE 46)

**Regroupement par catégorie (repère de lecture)**
- Boîtes : R-001, R-002, R-004 à R-009, R-088, R-089, R-090, R-091, R-094
- Circuits et couleurs : R-020 à R-024, R-085, R-087, R-092, R-098
- Allumages : R-040, R-041, R-070 à R-072, R-083, R-093
- Gaines : R-010 à R-014, R-060, R-073 à R-075, R-077, R-078, R-095
- Raccordements : R-030, R-031, R-080
- Tableau : R-050, R-081, R-101 à R-161
- Appareils et lignes directes : R-003, R-079, R-082, R-084, R-086, R-096, R-097, R-099, R-100

L'IA modifie la bibliothèque comme le reste : proposition avant / après, validation de Kévin, historique, code de modification plus tard.

---

## 3 ter. Étude d'une maison : bande d'étapes, « où ça coince », « Pourquoi ? » (décidé le 27/10/2026)

**But.** Quand l'IA lance l'étude d'une maison, nos règles font le calcul. On garde la trace de chaque décision pour comprendre les automatismes, voir où ça coince et décider s'il faut revoir une règle. Le calcul est un enchaînement de 9 étapes, avec quelques choix à alternatives (mode de pieuvre, 2e circuit de prises) : il n'a pas besoin d'un arbre profond. Trois vues suffisent.

**Une trace par étude lancée** (chantier, niveau, date, version du journal de règles).

**Vue 1 : la bande des 9 étapes.** Chaque étape porte une pastille d'état. Un clic sur une étape liste ses décisions : règles appliquées (R-xxx), entrées, résultat, et **alternatives étudiées avec leur score** (fil, gaines, départs) quand il y en a.
1. Lecture du plan (pièces, appareils)
2. Choix du mode de pieuvre
3. Placement des boîtes
4. Répartition des circuits
5. Allumages (couleurs, repères)
6. Gaines (alimentation, partage, diamètre, longueur)
7. Raccordements
8. Tableau
9. Contrôle

**États d'une décision**
- ✓ appliqué (règle confirmée)
- ◐ supposé (règle supposée, résultat marqué « à vérifier »)
- ? doute (information ou règle manquante, signalé, avec la question à poser)
- ✕ bloqué (arrêt sur ce point, le reste continue quand c'est possible)
- ✎ corrigé à la main (Kévin ou le BE a modifié le résultat ; la correction survit aux recalculs)

**Vue 2 : « Où ça coince ».** Une liste unique de tous les doutes, blocages et corrections manuelles d'une étude, triée par gravité (bloqué, doute, supposé, corrigé). Chaque ligne indique l'étape, la règle en cause, la question à poser et un bouton **« Proposer une modification de la règle »** : l'IA prépare l'avant / après avec les cas observés comme preuve.

**Vue 3 : « Pourquoi ? » sur le plan.** Un clic sur une gaine, un fil ou une boîte affiche la chaîne de règles qui l'a produit (exemple : ICTA 20 ← R-074 somme des sections ← R-073 gaine partagée ← R-070 allumage simple). C'est la vue la plus précieuse : elle remplace la lecture d'un arbre.

**Tableau de bord des statistiques** (page à part, sur tous les chantiers de ce PC ; export JSON pour regrouper plusieurs PC)
- Par règle : applications, doutes, blocages, corrections manuelles, avec leur taux.
- Signaux : règle souvent corrigée à la main = « à revoir » ; étape qui bloque = « règle manquante ou cas non prévu » ; alternative jamais retenue = « à supprimer ou à revoir ».

**À noter pour le code.** Instrumenter chaque étape du moteur de câblage pour produire la trace ; format JSON de la trace enregistré dans le chantier ; vues et statistiques dans Paramètres. Pas de code pour l'instant.

---

## 4. Règles (état au 27/10/2026)

Les règles `active` · `confirmee` sont validées par Kévin. Les règles `a_valider` restent en vigueur comme comportements actuels du logiciel, mais leurs résultats sont marqués « à vérifier » tant que Kévin ne les a pas confirmées.

### Boîtes

**R-001 · Départs par boîte** — `active` · `confirmee`
- Description : une boîte accepte 16 départs au plus, sans compter l'alimentation ; 6 gaines au plus par face, alimentation comprise (faces A à D). Règle non fixée sur les chantiers de Kévin : il garde celle de Claude (27/10/2026, Q-50), avec une limite abaissée de 18 à 12 départs le 27/10/2026 (12:00), puis portée à 16 le 28/10/2026 (00:01) après la comparaison avec les bandes du BE (MAILLARD : jusqu'à 15 départs, LI02 et LI04). Conséquence : la boîte LI03 de la bande DUCOURNEAU (18 départs) ne rentre toujours pas dans une seule boîte.
- Paramètres : `departs_max = 16` (hors alimentation), `gaines_par_face_max = 6` (alimentation comprise), réglables
- Source : règles de câblage v28, réglage « départs par face » v37.

**R-002 · Commande et lumières dans la même boîte** — `a_valider`
- Description : une commande et les lumières qu'elle allume sont raccordées à la même boîte. L'allumage n'est jamais coupé entre deux boîtes ; sinon alerte rouge et « Ramener dans la même boîte ».
- Source : v28, v38.

**R-003 · Lignes directes** — `active` · `confirmee` (Kévin, 27/10/2026, Q-33 et Q-34, pour le courant faible et la sonnette)
- Description : les circuits spécialisés, les sorties de câble, les RJ45 et la TV ne passent pas par une boîte : ils vont en ligne directe jusqu'au tableau.
- **Tout le courant faible va en ligne directe** (TV, antenne, RJ45, interphones…) ; **la sonnette aussi**.
- **Courant fort et courant faible : jamais dans la même boîte ni la même gaine** (Q-34). Comme le courant faible est toujours en ligne directe, il ne peut pas entrer dans une boîte (confirmé).
- Source : règles de câblage v28, Kévin 27/10/2026.

**R-004 · Boîtes verrouillées** — `a_valider`
- Description : une boîte déplacée ou retracée à la main est verrouillée ; au recalcul, les boîtes verrouillées restent en place sauf décision contraire.
- Source : v32.

**R-005 · Plusieurs pièces et plusieurs niveaux par boîte** — `active` · `confirmee`
- Description : une boîte peut desservir plusieurs pièces et plusieurs niveaux (RDC et étage).
- Source : réponse de Kévin, 27/10/2026 (Q-29).

**R-006 · Éclairage et prises dans la même boîte** — `active` · `confirmee`
- Description : une boîte peut mélanger des circuits d'éclairage et de prises ; chaque circuit garde ses propres neutre et phase.
- Source : réponse de Kévin, 27/10/2026 (Q-30).

**R-007 · Un circuit ne passe que par une seule boîte** — `active` · `confirmee`
- Description : un circuit n'est jamais réparti sur deux boîtes. Tous les appareils d'un même circuit (par exemple les 8 prises) sont raccordés à la même boîte. Le moteur ne coupe jamais un circuit entre deux boîtes ; si le circuit ne tient pas dans la boîte (départs ou gaine pleins), c'est un **doute** à signaler, pas une répartition automatique.
- Conséquence : liaison interdite « circuit sur deux boîtes ». Si trop de prises dans une boîte : R-085.
- Source : réponse de Kévin, 27/10/2026 (Q-31).

**R-008 · Pas de boîte à boîte (sauf mode Plug de pieuvre)** — `active` · `confirmee`
- Description : par défaut, toute boîte est alimentée directement depuis le tableau. L'alimentation d'une boîte par une autre boîte n'existe que dans un chantier spécifique, en mode **Plug de pieuvre** (voir R-009).
- Source : réponse de Kévin, 27/10/2026 (Q-32).

**R-009 · Mode de pieuvre « Plug de pieuvre »** — `brouillon` · `inconnue` · `si_doute = bloquer`
- Description : quatrième mode de pieuvre, à ajouter à Proximité, Équilibrée et Par pièce, pour certains chantiers spécifiques où une boîte peut en alimenter une autre. **Définition à compléter (Q-42 et Q-44)** : le logiciel ne peut pas câbler ce mode tant que ces règles manquent.
- Réponses de Kévin du 27/10/2026 (12:51) :
  - **Liaison (Q-41)** : la boîte 2 est alimentée par une gaine **ou** par un connecteur. Les deux cas existent et sont à choisir dans le chantier.
  - **Circuits (Q-43)** : dans ce mode, on peut soit répartir un circuit sur plusieurs boîtes, soit le limiter à une seule boîte, au choix (réglage du chantier). R-007 ne s'applique donc pas quand « répartir » est choisi.
- Choix ajoutés (`choix`) : `liaison_boites` = gaine | connecteur ; `repartition_circuits` = repartie | limitee_a_une_boite.
- Reste inconnu : combien de boîtes en chaîne et qui alimente qui (Q-42) ; chantier concerné (Q-44). Kévin transmettra un chantier de ce type : on en déduira les règles.
- Source : Kévin, 27/10/2026.

### Gaines

**R-010 · Une seule gaine d'alimentation par boîte** — `a_valider`
- Description : une gaine d'alimentation par boîte contient la phase et le neutre de chaque circuit et une seule terre. Elle est divisée en deux seulement si elle passerait en Ø25 ; la terre reste alors dans la 1re. Les fils du télérupteur sont dans cette gaine.
- Source : retour de Kévin, v33.

**R-011 · Longueur d'une gaine** — `a_valider`
- Description : longueur = tracé + 10 %, plus descentes et surlongueurs, puis arrondi. Le +10 % reste appliqué sur un tracé modifié à la main.
- Paramètres : `marge_pct = 10`, surlongueurs et arrondi réglables. **Valeurs de surlongueur à confirmer (Q-07).**
- Source : v29/v30, décision v32.

**R-012 · Diamètre selon le remplissage** — `a_valider`
- Description : le diamètre de la gaine se calcule d'après la place des fils (remplissage). **Capacité par diamètre à confirmer (Q-06).**
- Source : règles de câblage v28.

**R-013 · Gaine partagée** — `a_valider`
- Description : des appareils au même endroit partagent une gaine (ex. « P17 + P18 + I12 »). Les gaines identiques se comptent (×n).
- Source : v34, v38.

**R-014 · Câble extérieur** — `active` · `confirmee` (Kévin, 27/10/2026, Q-56)
- Description : câble 3G pour l'extérieur : éclairage extérieur en 3G1,5 (L1, L1A, L2, L2A de la bande DUCOURNEAU), prises extérieures en 3G2,5.
- Source : v34.

### Circuits et couleurs

**R-020 · Circuit d'éclairage** — `active` · `confirmee` (Kévin, 27/10/2026, Q-64)
- Description : éclairage en 1,5 mm², fils rouge / bleu. **Le rouge 1,5 est la phase des circuits lumières, et uniquement d'eux.**
- Source : v38 (bande LI05 EVRARD), Kévin 27/10/2026.

**R-021 · Circuit de prises** — `active` · `confirmee` (Kévin, 27/10/2026, Q-64 et Q-82)
- Description : prises en 1,5 mm², fils gris / bleu foncé, 8 prises au plus par circuit. **Le gris est la phase des circuits prises et des circuits de volets roulants, et uniquement d'eux** ; le neutre les distingue : bleu foncé pour les prises, bleu clair pour les volets (R-079).
- Pourquoi : cette séparation des phases évite les erreurs de câblage. Elle s'applique quel que soit le nombre de circuits dans la boîte, y compris pour un 2e circuit (R-085).
- Paramètres : `section = 1.5`, `prises_max = 8`
- Source : v38 (correction : la bande LI05 avait du 2,5 rouge / bleu), Kévin 27/10/2026.

**R-022 · Circuit cuisine** — `a_valider`
- Description : cuisine en 2,5 mm², fils rouge / bleu, 6 prises au plus ; au-delà, parts égales entre circuits.
- Paramètres : `section = 2.5`, `prises_max = 6`
- Source : v38.

**R-023 · Couleurs de la ronde (retours et navettes)** — `a_valider` (précisée par R-072)
- Description : retours et navettes en orange, violet, noir, marron, ivoire. Même ordre partout dans une boîte, les allumages les plus fréquents du chantier d'abord.
- Le violet est bien utilisé chez KiTéOHM (Kévin, 28/10/2026, 00:01), même si la bande MAILLARD du BE n'en a pas : la ronde reste inchangée.
- Source : v34, v38. **3e paire de couleurs phase / neutre : Q-12.**

**R-024 · Paires de couleurs par circuit** — `a_valider`
- Description : deux circuits de natures différentes dans une même gaine n'ont jamais les mêmes couleurs (ex. rouge/bleu et gris/bleu foncé). Exception : un 2e circuit de même nature garde les couleurs du 1er et se distingue par sa bague (R-085).
- Source : comparaison avec la boîte FTZ LI03, v34.

### Raccordements

**R-030 · Une terre par boîte** — `a_valider`
- Source : v38.

**R-031 · Ordre de numérotation des raccordements** — `active` · `confirmee` (Kévin, 27/10/2026 : « ma règle », pas celle de FTZ)
- Description : n° 1 = terres, puis par circuit neutre puis phase (cuisine, prises, éclairage), puis retours et navettes. C'est l'ordre de câblage du câbleur.
- Source : v33, v47.

### Repères

**R-040 · Repères par allumage** — `a_valider`
- Description : commande et lumières reliées portent le même numéro (I3, L3). Le 2e du même type prend la lettre A, le 3e B (VV1 / VV1A, L3 / L3A, BP1 / BP1A / BP1B). Seul : numéro sans lettre. Non relié : garde son numéro.
- Familles : spot S, applique AP, va-et-vient VV.
- Source : v32.

**R-041 · Repères fixes** — `a_valider`
- Description : le numéro est stocké sur l'appareil ; il ne change qu'avec la commande « Renuméroter les repères ».
- Source : v21.

### Tableau

**R-050 · Différentiels** — `a_valider`
- Description : ID 40 A 30 mA type A pour les circuits spécialisés ; ID type AC selon la surface (1 jusqu'à 35 m², 2 jusqu'à 100 m², 3 au-delà) ; 8 circuits au plus par ID ; une rangée par ID ; pas de disjoncteur pour les RJ45 ; réserve de 20 %.
- **Hypothèses à valider (Q-24)** : pas de parafoudre dans le coffret de base ; ID 40 A partout.
- Source : v46, v49.
- Mise à jour 66 (29/10/2026) : le nombre de différentiels ne dépend plus de la surface mais des circuits (R-102, R-119, R-122, R-127) ; règles du tableau R-101 à R-161, à valider.

### Présentation

**R-060 · Libellé de gaine** — `a_valider`
- Description : « LI01.10 · P14 · 4,8 m · Ø16 » (repère de l'appareil, pas son nom long).
- Source : v47.

### Règles déduites de la bande DUCOURNEAU (27/10/2026)

Source : bandes FTZ (SchemBAT), chantier DUCOURNEAU, réf. AF26075150, client IMMO CONSTRUCTION, 5 boîtes LI01 à LI05, lignes directes, repères tableau. **Attention : ce sont les règles que FTZ applique, pas forcément les tiennes.** Tout est `a_valider` · `supposee` jusqu'à ta réponse.

**R-070 · Allumage simple** — `a_valider`
- Commande In : phase (R 1) + retour. Lumière Ln : neutre (B 2) + même retour + terre (V/J 9). Preuves : I5/L5, I7/L7, I8/L8, I12/L12.

**R-071 · Va-et-vient** — `a_valider`
- 1re commande Vn : phase R 1 + 2 navettes. 2e commande VnA : les 2 mêmes navettes + le retour. Lumière Ln : neutre + retour + terre. Preuves : V3/V3A/L3, V4/V4A/L4, V6/V6A/L6, V9/V9A/L9, V10/V10A/L10, V11/V11A/L11, V13/V13A/L13 (7 sur 13 allumages).
- Vocabulaire : FTZ écrit « V », Oktéo écrit « VV » (v32).

**R-072 · Ronde Oktéo des navettes et retours** — `a_valider` · `supposee` (conçue par Claude sur mandat de Kévin, 27/10/2026 ; à valider sur une boîte exemple)
- Constat FTZ, pour mémoire et non copié : 1er va-et-vient navettes marron/marron + retour orange, 2e ivoire/ivoire + noir, 3e comme le 1er ; allumages simples ivoire, noir, orange, ivoire ; un même allumage a deux couleurs différentes (interrupteur ivoire, lumière en câble 3G marron) ; des couleurs répétées entre allumages sans repère.
- Base : la ronde de Kévin (R-023) orange, violet, noir, marron, ivoire, avec la structure de FTZ : va-et-vient d'abord, allumages simples ensuite ; navettes d'un va-et-vient = 2 fils de la même couleur, retour d'une autre couleur.
- Règles d'attribution :
  1. Un allumage garde **la même couleur sur tous ses fils** (interrupteur, lumière, gaines).
  2. Dans une même gaine, deux allumages ont **toujours des couleurs différentes**.
  3. Lumière en câble 3G (extérieur) : la couleur de l'allumage est le **marron** du câble ; les autres allumages de la boîte évitent le marron tant qu'une autre couleur est libre.
  4. Couleurs données dans l'ordre de la ronde, **sans répétition tant qu'il en reste une libre dans la boîte** : d'abord les couleurs imposées (câble 3G), puis les va-et-vient, puis les allumages simples, par ordre de repère. Même ordre de ronde dans toutes les boîtes du chantier.
  5. Une couleur réutilisée (plus d'allumages que de couleurs) ne l'est que pour des allumages qui ne partagent aucune gaine, et chaque fil concerné reçoit une **bague portant le numéro de l'allumage** (12 pour L12).
  6. Un va-et-vient prend 2 couleurs de la ronde (navettes, retour) et n'a jamais deux fois la même dans une gaine.
  7. Impossible de respecter 2 ou 6 : **doute bloquant** sur la gaine.
- Numéros de raccordement : suivent R-031 (retours et navettes en dernier).
- Exemple LI03 : L1/L1A (câble 3G) marron ; va-et-vient 9 : navettes orange, retour violet ; I7 noir ; I8 ivoire ; I12 orange avec bague 12.

**R-073 · Gaine partagée** (précise R-013) — `a_valider`
- Les fils des appareils au même endroit sont réunis dans une gaine, avec la phase R 1 et la terre comptées une seule fois (P13+I5+V4 = 7 fils). Libellé : prises, puis interrupteurs, puis va-et-vient.
- Une commande et des prises au même endroit peuvent partager une gaine (Kévin, 28/10/2026, 00:32), **mais on évite les gaines ICTA 25 dans les boîtes** : si le regroupement demande plus qu'une ICTA 20, les appareils repartent dans des gaines séparées (prises d'un côté, commandes de l'autre). « Pas évident » : à revoir sur les prochains chantiers.

**R-074 · Diamètre des gaines** (précise R-012) — `a_valider`
- Somme des sections nominales ≤ 7,5 mm² → ICTA 16 (5×1,5 ou 3×2,5) ; au-delà → ICTA 20. Maximum vu : 13,5 mm² (7 fils). Vérifié sur toutes les gaines des 5 boîtes.
- Principe confirmé par Kévin (27/10/2026) : addition des sections et place dans la gaine, avec le même ratio pour tous les diamètres.
- Paramètre réglable : capacité en mm² par diamètre. ICTA 16 = 7,5 (vu). ICTA 20 = 13,5 (maximum vu ; Kévin garde le même ratio que pour 16, 27/10/2026 12:43 : **valeur retenue**, ajustable si la valeur exacte est trouvée, Q-49). Au-dessus de la capacité connue : doute bloquant.

- **Exception (Kévin, 27/10/2026, Q-79)** : plaque de cuisson B + R + V/J en 6 mm² → ICTA 20 (18 mm², au-delà de la règle des sections). Ligne B + R + V/J en 10 mm² → ICTA 25 (Kévin, 27/10/2026, Q-81).

**R-075 · Alimentation d'une boîte** (précise R-010) — `a_valider` (numérotation : R-031)
- Gaine .01, avec les couleurs : éclairage R / B (1,5), prises GR / BF (1,5), cuisine R / B (2,5), volets roulants GR / B clair (1,5).
- **Numéros de raccordement : ceux de R-031 (terres en n° 1), pas ceux de FTZ.** Les numéros vus sur les bandes FTZ (R 1, B 2, GR 3, BF 4, R 7, B 8, terre 9, GR 11, B 12) ne sont pas repris (rectification de Kévin, 27/10/2026, 14:29).
- Une seule terre V/J, de la plus forte section de la gaine (2,5 en LI01 à cause de la cuisine ; 2,5 en LI03 à cause de EQ1/EQ2). Confirmé par Kévin (27/10/2026, Q-57).
- Au plus un circuit éclairage et un circuit prises par boîte (confirmé, Q-53), sauf plus de 8 prises : voir R-085.

**R-076 · Numéros de raccordement FTZ** (écart avec R-031) — `archivee` (écartée par Kévin le 27/10/2026 : on garde R-031)
- 1/2 éclairage, 3/4 prises, 7/8 cuisine, 9 terre, 11 et plus : navettes et retours. Les numéros 5, 6 et 10 ne sont jamais utilisés. R-031 (terres en premier) n'est pas celle de FTZ : voir Q-45.

**R-077 · Numéro de gaine** — `active` · `confirmee` (Kévin, 27/10/2026, Q-52 ; sens changé le 27/10/2026, 23:19)
- NomBoîte.NN ; .01 = alimentation ; les autres **strictement** dans le sens **anti-horaire** à partir de l'alimentation, pour que les numéros se lisent de gauche à droite sur chaque face. Les inversions vues dans FTZ (LI01.06/.07, LI03.06, LI03.10) ne sont pas à reproduire. FTZ et le BE numérotent dans le sens horaire : écart voulu.

**R-078 · Longueurs** — `a_valider`
- Affichées au 0,1 m (de 2,10 à 8,10 m dans les boîtes). Le sens de l'arrondi n'est pas visible : Q-07.

**R-079 · Volets roulants** — `active` · `confirmee` (Kévin, 27/10/2026, Q-51 et Q-82)
- Boîte dédiée (LI05 : 6 moteurs, 7 gaines) sur un circuit dédié, une gaine ICTA 16 par moteur : gris (phase), bleu clair (neutre), vert/jaune (terre) — couleurs validées par Kévin le 27/10/2026 (Q-82) ; numéros de raccordement selon R-031. Repère VRn ; commande filaire ou connectée : R-096.
- Décision de Kévin (27/10/2026, Q-51) : **option du chantier** — boîte à part ou volets mélangés aux autres boîtes (ou ligne directe selon le cas). Pas de maximum de moteurs fixé par le logiciel : la limite vient de la norme NF C 15-100 (R-087).

**R-080 · Liaison équipotentielle** — `a_valider`
- Locale (EQ1, EQ2) : gaine ICTA 16 avec un seul fil V/J 2,5 depuis la terre (9) de la boîte LI03. Principale (EQ3) : 10 mm², ICTA 20, ligne directe au tableau. La locale concerne la salle de bain (Kévin, 27/10/2026, Q-48).

**R-081 · Repère de circuit au tableau** — `active` · `confirmee` (Kévin, 27/10/2026, Q-54)
- Numéro encadré de 1 à 10 sur tout le chantier, à côté de chaque paire d'alimentation (LI01 : 1, 2, 3 ; LI02 : 4, 5 ; LI03 : 6, 7 ; LI04 : 8, 9 ; LI05 : 10) et page « REPÈRES TABLEAU ». Réponse à Q-23. Déjà présent sur les boîtes de l'appli Oktéo.

**R-082 · Lignes directes** (précise R-003) — `a_valider`
- En ligne directe : convecteurs, sèche-serviette, VMC et sa commande, équipotentielle principale, TV, antenne, RJ45 (gaine ICTA_V20), four, lave-linge, lave-vaisselle, sèche-linge, plaque, chauffe-eau, prises extérieures, interphones, sonnette (Kévin, Q-33).
- Tableau : étiquette, longueur, gaine, fil, aboutissant, vérification ; total par diamètre (11 ICTA 16, 16 ICTA 20, 1 gaine aiguillée Ø40 = 28 gaines).

**R-083 · Neutre à l'interrupteur** — `active` · `confirmee` (Kévin, 27/10/2026, Q-47)
- Un interrupteur reçoit le bleu (neutre, B 2) en plus de la phase et du retour s'il est à voyant ou domotique. Cela explique I1 et I2 dans la bande DUCOURNEAU.
- Reste ouvert : pourquoi L1, L1A, L2, L2A sont en câble 3G1,5 (Q-56).

**R-084 · Nouveaux types d'appareils et raccordement modifiable** — `active` · `confirmee` (Kévin, 27/10/2026, Q-55)
- Types validés : radiateur (convecteur), sèche-serviette, caisson VMC, commande VMC, prise spécialisée nommée (four, lave-linge, lave-vaisselle, sèche-linge), plaque de cuisson (6 mm²), chauffe-eau thermodynamique et prises extérieures (sortie de câble 3G2,5), interphones, antenne et prises TV, équipotentielle principale et locale, moteur de volet roulant.
- Pour chaque type, la nature du raccordement (câble ou fils) et la section sont **modifiables**.
- Courant faible (TV, antenne, RJ45) : gaine verte Ø20 (ICTA_V20 dans FTZ), pour tous les chantiers (Kévin, 27/10/2026 : les anciens chantiers en ICTA 16 sont abandonnés). Types ajoutés le 27/10/2026 (Q-74) : module Aqua Air (alimentation 3G2,5 et pilotage 3×1,5), bouche de diffusion motorisée (YSYT 2×1 souple, sans gaine), prise extérieure 4G1,5, Velux motorisé (dans la boîte des volets, comme un volet), moteur de garage (ligne directe 1,5 GR + BF + V/J), interrupteur de coupure (ligne directe ICTA 16, 1,5 R + N), climatisation (4G1,5 ICTA 20), G EXT en 3G1,5 ICTA 16 ou 3G2,5 ICTA 20 selon le chantier.
- Hotte : en boîte (circuit cuisine) ou en ligne directe, « ça dépend » (Q-60). Moteur de volet roulant : boîte ou ligne directe selon l'option du chantier (R-079).
- Types ajoutés le 28/10/2026 (bande MAILLARD du BE, Kévin 00:01) : **îlot** (prises de l'îlot central en ligne directe, 1,5 GR + BF + V/J, ICTA 16 ; pas de disjoncteur propre : branché au tableau sur le disjoncteur d'un circuit prises, avis de Kévin du 28/10/2026, 00:13 — ses prises comptent dans les 8 de ce circuit, supposé) ; **bouton poussoir de sonnette** BPS (ligne directe, câble 1P 9/10, ICTA 16) ; **sonnette** SON (carillon dans une boîte, gaine 1,5 R + B + V/J, ICTA 16).

**R-085 · Plus de 8 prises dans une boîte** — `active` · `confirmee` (Kévin, 27/10/2026, Q-59)
- Deux solutions, au choix du **mode de pieuvre** (Proximité, Équilibrée, Par pièce, Plug de pieuvre) : (a) créer un 2e circuit prises dans l'alimentation de la même boîte ; (b) mettre les prises en trop dans une autre boîte. Réglage modifiable chantier par chantier.
- Un circuit n'est jamais réparti sur deux boîtes (R-007).
- Couleurs du 2e circuit (Kévin, 27/10/2026, Q-62), fixées par la section : en 2,5 mm² bleu clair (B) + rouge (R) + V/J ; en 1,5 mm² prises : gris + bleu foncé (BF) + V/J (R-021). Le rouge 1,5 reste réservé à l'éclairage (R-020) : on ne mélange jamais les phases (confirmé, Q-64). Les couleurs d'un 2e circuit sont celles du 1er : elles ne changent pas, quel que soit le nombre de circuits dans la boîte ni la boîte. Les circuits qui ont les mêmes couleurs dans une même gaine se distinguent par leur bague (numéro du circuit, R-075). Exception à R-024.

**R-086 · Choix de raccordement par le client ou le BE** — `active` · `confirmee` (Kévin, 27/10/2026, Q-60)
- Pour la hotte, et tout appareil à choix : en boîte (circuit cuisine) ou en ligne directe, selon un choix du client ou du BE, enregistré sur l'appareil ou le chantier (`raccordement : boite | ligne_directe | a_choisir`).
- Tant que le choix n'est pas fait (`a_choisir`) : doute signalé sur cet appareil seulement ; le reste du câblage continue.

**R-087 · Volets roulants et NF C 15-100** — `a_valider` · `supposee` (sources lues le 27/10/2026)
- Circuit dédié (jamais sur un circuit d'éclairage ou de prises) ; section 1,5 mm² au minimum ; protection 16 A au maximum (10 A possible).
- La norme ne donne pas de nombre de moteurs : la limite est la puissance admissible, de 2 300 W (10 A) à 3 680 W (16 A) pour des conducteurs de 1,5 mm². Le logiciel compare la somme des intensités des moteurs au calibre du disjoncteur ; **la puissance d'un moteur est une donnée de l'appareil.** Valeur retenue par Kévin le 27/10/2026 (Q-63) : **50 W par moteur** (`puissance_moteur_w = 50`, modifiable par appareil). Maximum de moteurs par circuit = puissance admissible ÷ 50 W : 46 moteurs sous 10 A (2 300 W), 73 sous 16 A (3 680 W). Calibre par défaut : 10 A (`calibre_volets_a = 10`, réglable). Puissance de l'appareil absente : doute.
- Deux circuits de volets sont recommandés, non obligatoires (garder des volets en cas de panne). Calibre de 10 A confirmé par le plan DUCOURNEAU (LI05 VR 10 A, 6 moteurs).
- Sources : legrand.fr (« Combien de volets roulants par disjoncteur ? »), hager.com (NF C 15-100, disjoncteur). À recouper avec le texte de la norme.

**Règles existantes confirmées par la bande (à passer en `confirmee` si tu valides)**

| Règle | Ce que la bande montre |
|---|---|
| R-001 | LI03 a 19 gaines : 18 départs + l'alimentation. 18 départs : au-dessus de la limite Oktéo de 12 (voulu, Q-69). Face B de LI03 : 6 gaines, alimentation comprise. |
| R-002 | 13 allumages sur 13 ont leur commande et leurs lumières dans la même boîte. |
| R-007 | Chaque circuit n'est que dans une boîte. |
| R-020, R-021, R-022 | Éclairage R/B 1,5 ; prises GR/BF 1,5 (LI04 en a exactement 8) ; cuisine R/B 2,5 (5 prises + hotte = 6). |
| R-024 | Éclairage 1,5 et cuisine 2,5 sont tous deux rouge/bleu clair dans LI01 : la couleur peut se répéter si la section diffère. |
| R-030 | Une seule terre V/J 9 par boîte. |
| R-040 | Repères par allumage : In/Vn avec Ln, suffixe A pour le 2e (L1A, L2A, L8A, V3A…). |

---

### Liaisons possibles et interdites (réponses de Kévin du 27/10/2026, 13:02)

**R-088 · Face pleine : passage sur la face voisine** — `active` · `confirmee` (Q-36)
- Quand une face de la boîte est pleine (6 gaines, alimentation comprise, R-001), la gaine passe sur la face voisine. **Aucun avertissement.** La numérotation reste strictement dans le sens horaire (R-077).
- Si plus aucune face n'est libre (12 départs atteints, R-001) : doute bloquant (ajout de Claude, à confirmer).

**R-089 · Une gaine par appareil, et gaines partagées** — `active` · `confirmee` (Q-35, Q-37)
- Jamais deux gaines vers le même appareil, jamais un appareil sur deux gaines.
- Exception : une gaine à deux circuits peut alimenter deux appareils situés au même endroit (gaine partagée, R-073).
- **Les circuits spécialisés ne sont jamais dans une gaine partagée.**

**R-090 · Phases et neutres jamais partagés entre circuits** — `active` · `confirmee` (Q-39)
- Deux circuits ne partagent jamais leur phase ni leur neutre (sinon le différentiel disjoncte). Les **terres** peuvent être regroupées (une terre par gaine d'alimentation, R-010). Liaison interdite pour le logiciel.

**R-091 · Autres liaisons interdites** — `active` · `confirmee` (Q-40)
- Un va-et-vient n'est jamais coupé entre deux boîtes (R-002).
- Une prise de la salle de bain ne va jamais sur le circuit de la cuisine.
- Une boîte n'en alimente pas une autre, sauf en Plug de pieuvre (R-008, R-009).

**R-092 · Bornes de raccordement** — `active` · `confirmee` (Q-38)
- Le nombre de fils par borne n'est **pas une contrainte** : on peut faire des ponts au câblage pour prolonger une borne au-delà de 12. La capacité d'une borne n'influence ni les circuits ni le câblage des boîtes ; le logiciel ne la contrôle pas.
- Une borne ne réunit jamais des fils de sections différentes (un circuit de prises 2,5 n'est jamais mélangé avec un circuit de prises 1,5).
- **Seule exception : les terres** se raccordent ensemble quelle que soit leur section (Kévin, 27/10/2026, Q-80).

**R-093 · Télérupteur et boutons poussoirs** — `active` · `confirmee` (Kévin, 27/10/2026, Q-70)
- Le télérupteur est dans le tableau. Chaque bouton poussoir (BP, BP1A, BP1B…) a dans sa gaine la phase et un fil de commande ; le retour va aux lumières commandées. Commande et retour prennent chacun une couleur de la ronde (R-072) ; les lumières commandées reçoivent la couleur du retour. Les deux fils du télérupteur passent par la gaine d'alimentation de la boîte (R-010).
- **Le neutre n'est pas obligatoire dans la gaine du bouton poussoir** : il n'y est que si le bouton est à voyant ou domotique (R-083).
- Source : bande FALGUA E6390 (LI01, LI04, LI06).

**R-094 · Boîtes de volets roulants selon le mode de pieuvre** — `active` · `confirmee` (Kévin, 27/10/2026, Q-71)
- **Proximité** : le logiciel choisit la solution la plus économique (boîtes de volets multiples, ou volets mélangés aux autres boîtes, selon la longueur de fil et de gaine).
- **Équilibrée** : une seule boîte pour tous les volets. En mode Équilibrée, le choix des boîtes vise **le moins de boîtes possible**, comme le BE (Kévin, 28/10/2026, 00:32 ; bande MAILLARD : 5 boîtes de 11 à 15 départs + 1 boîte de volets) ; le critère « plus petite longueur de gaine d'abord » (Q-77) reste celui du mode Proximité.
- Critère de « plus économique » (confirmé par Kévin le 27/10/2026, Q-77) : plus petite longueur totale de gaine, puis moins de boîtes, puis moins de départs. C'est aussi le score des alternatives dans l'étude (section 3 ter).
- Par pièce : chaque volet dans la boîte de sa pièce (supposé par le logiciel depuis la mise à jour 62, à valider : Q-87). Plug de pieuvre : non précisé (doute, `avertir`).
- Équilibrée, volets aux deux bouts de la maison : deux boîtes de volets si cela évite de traverser toute la maison (supposé depuis la mise à jour 62, à valider : Q-87).
- Précise R-079.

**R-095 · Bouchon dans la boîte (obligatoire)** — `active` · `confirmee` (Kévin, 27/10/2026, Q-72)
- Une gaine qui amène l'air extérieur (câble 3G1,5 des appliques extérieures) reçoit **obligatoirement** un petit bouchon dans la boîte, pour éviter que l'air extérieur entre dans la boîte, qui communique avec l'intérieur. Ce n'est pas une option (rectification de Kévin, 27/10/2026, 14:07). Repéré « BOUCHON » sur la bande FTZ.
- Le logiciel marque automatiquement toutes les gaines concernées sur la bande et dans le décompte.

**R-096 · Commande de volet roulant : filaire ou connectée** — `active` · `confirmee` (Kévin, 27/10/2026, Q-75)
- Chaque volet roulant est soit **filaire** (commande CVR : l'alimentation gris + bleu clair, plus deux fils de commande marron et noir pris dans la ronde de couleurs, R-072), soit **connecté** (micromodule : gris + bleu clair + V/J seulement). Le choix se fait par volet sur le plan.
- Pour un volet filaire, la gaine du CVR et la gaine du moteur portent les deux mêmes fils de commande ; chaque couple a ses propres numéros.
- Source : bande BATELIER JEAN LOUIS (CVR3 à CVR5, VR1 et VR2 connectés).
- Qui décide : le **BE**, chantier par chantier (Kévin, 28/10/2026, 00:32) ; le plan ne le dit pas (MAILLARD : 8 commandes de volet dessinées, volets connectés chez le BE). Le logiciel demande le choix pour le chantier (réglage des choix) et ne le déduit pas du plan.

---

**R-097 · Gaine aiguillée en attente** — `active` · `confirmee` (Kévin, 27/10/2026)
- Description : une gaine vide, aiguillée, laissée en attente (fibre, réseau…) est un appareil à poser sur le plan ; elle part en ligne directe du tableau, sans fil.
- Paramètres : `diametre = 40` (vu sur DUCOURNEAU, AIG2 : Ø40, 1,2 m), modifiable par appareil.
- Source : bande DUCOURNEAU (lignes directes), réponse de Kévin du 27/10/2026 (15:55).

**R-098 · Prises de plan de travail** — `active` · `confirmee` (Kévin, 28/10/2026, 00:01)
- Description : dans la cuisine, seules les prises du plan de travail (et la hotte, quand elle va en boîte : R-086) sont sur le circuit cuisine 2,5 mm² rouge / bleu (R-022, 6 au plus) ; les autres prises de la pièce restent sur un circuit prises 1,5 mm² gris / bleu foncé (R-021).
- Le repère est porté par la prise elle-même (« prise de plan de travail »), pas par le nom de la pièce : une cuisine ouverte dans une pièce de vie est ainsi traitée comme une cuisine fermée.
- Reconnaissance automatique (Kévin, 28/10/2026, 00:13 : « fixons cette règle et nous verrons sur les prochains chantiers ») : une prise posée entre 1,00 m et 1,30 m de hauteur, dans une pièce de cuisine OU à moins de 3 m d'un appareil de cuisine (plaque, hotte, four, lave-vaisselle), est marquée « plan de travail ». Le marquage reste modifiable prise par prise. À revoir sur les prochains chantiers.
- Source : bande MAILLARD du BE (P28 à P31 + hotte en 2,5 ; P19 et P27, même pièce, en 1,5), réponse de Kévin du 28/10/2026 (00:01).

**R-100 · Équipements hors plan** — `active` · `supposee` (Kévin, 28/10/2026, 00:32 : « ils ne sont pas sur le plan ; tiens un compte de ces gaines »)
- Description : une partie des lignes et appareils ne figure pas sur le plan électrique ; le BE les ajoute d'après le chantier et le **devis** (cuisine équipée, VMC, équipotentielles, antenne, sonnette…). Le journal tient le compte, chantier par chantier, de ces équipements (registre ci-dessous). Un équipement présent sur la plupart des chantiers est proposé par défaut sur les suivants, marqué « à vérifier avec le devis » (jamais ajouté sans le dire) ; les autres restent à ajouter à la main.
- Seuil de proposition : à fixer quand le registre aura plusieurs chantiers (supposé : présent sur 80 % des chantiers comptés).
- Registre (nombre de lignes par chantier) :

| Équipement | MAILLARD AF26074801 (JOYEUX) |
|---|---|
| Four (2,5 B+R+V/J) | 1 |
| Lave-linge, lave-vaisselle, sèche-linge (2,5 B+R+V/J) | 1 + 1 + 1 |
| Plaques (6 R+B+V/J, ICTA 20) | 1 |
| Hotte (en boîte, circuit cuisine) | 1 |
| VMC (1,5 R+B+V/J) + commande VMC (1,5 N+GR) | 1 + 1 |
| Bouches motorisées (YSYT 2×1 souple) | 7 |
| Sèche-serviette (1,5 BF+M+V/J) | 1 |
| Îlot (1,5 GR+BF+V/J) | 1 |
| Équipotentielle principale (10 V/J) / locale (2,5 V/J, en boîte) | 1 / 1 |
| Antenne (17 VATC) | 1 |
| Sonnette (en boîte) + bouton BPS (1P 9/10) | 1 + 1 |
| G EXT (3G2,5) | 1 |

- Source : comparaison Oktéo / BE sur MAILLARD (`docs/chantiers/MAILLARD_comparaison.md`).

**R-099 · Total des gaines des lignes directes** — `active` · `confirmee` (Kévin, 28/10/2026, 00:01)
- Description : le total des gaines du tableau des lignes directes compte aussi les liaisons sans gaine (YSYT des bouches motorisées) ; les gaines vertes V20 sont comptées avec les ICTA 20. Exemple MAILLARD : 10 ICTA 16 + 15 ICTA 20 (dont 10 V20) + 7 YSYT = 32.
- Source : bande MAILLARD du BE (page « Lignes directes »).

---

### Tableau électrique (NF C 15-100:2024) — recherche du 28/10/2026, à valider par Kévin

Source : recherche documentaire transmise par Kévin le 29/10/2026 (00:08) : « il va falloir faire une maj et implanter ces nouvelles règles ». Aucune règle n'est `confirmee` : la norme NF C 15-100-10 elle-même n'a pas été lue (Promotelec, Legrand, Schneider, Consuel, sites secondaires). Elles remplacent le dimensionnement par la surface de R-050 (Q-24).

*Référentiel et principe de calcul*

**R-101 · Référentiel applicable selon la date du projet** — `a_valider` · `supposee`
- Description : le logiciel applique la série NF C 15-100 d'août 2024 (parties 1, 7-701, 7-722, 10 et 11) si l'une de ces dates est postérieure au 31 août 2025 : dépôt du permis de construire, déclaration préalable, signature du marché ou accusé de réception de commande. Le Consuel l'écrit ainsi : « Si l'une des dates précitées est postérieure au 31 août 2025, alors la nouvelle série de normes NF C 15-100 d'août 2024 s'applique ». Sinon, l'édition 2002 + A5 reste admise et le logiciel signale le choix à faire. Selon l'INFOCONSUEL n° 10, le Consuel contrôle les bâtiments neufs selon la nouvelle série à partir d'avril 2026, « sauf déclaration contraire ».
- Paramètres : `date_bascule = 2025-09-01`, `referentiel_par_defaut = NF C 15-100:2024`
- Source : Consuel, « Comment renseigner la version de la norme applicable à mon installation ? » (https://actualites.consuel.com/comment-renseigner-la-version-de-la-normeapplicable-a-mon-installation/) ; Promotelec, « Série de normes NF C15-100 : 2024, les grandes évolutions ! » (https://www.promotelec.com/actualite/serie-de-normes-nf-c15-100-2024-les-grandes-evolutions/).

**R-102 · Dimensionnement par l'installation, pas par la surface** — `a_valider` · `supposee`
- Description : le nombre de différentiels et de rangées se calcule d'après la liste réelle des circuits, jamais d'après une table de surface. Si une table de surface est utilisée, elle sert seulement à proposer des circuits par défaut et le logiciel l'indique comme une estimation.
- Paramètres : `methode_dimensionnement = par_circuits`
- Source : Promotelec, brochure « NF C 15-100 : la réponse aux exigences réglementaires » (https://www.promotelec.com/app/uploads/2023/08/Promotelec_Brochure-NFC_15-100-V2.pdf), passage « l'équipement de protection n'est plus dimensionné en fonction de la taille du logement ».

*Emplacement du tableau et GTL*

**R-103 · Dimensions de l'ETEL** — `a_valider` · `supposee`
- Description : le logiciel réserve un ETEL d'au moins 600 mm de large et 250 mm de profondeur, du sol au plafond. Une fois l'installation faite, la largeur peut être ramenée à la largeur de la GTL + 100 mm.
- Paramètres : `etel_largeur_min_mm = 600`, `etel_profondeur_min_mm = 250`, `etel_largeur_reduite = largeur_GTL + 100 mm`, réglables
- Source : Promotelec, brochure NF C 15-100 (https://www.promotelec.com/app/uploads/2023/08/Promotelec_Brochure-NFC_15-100-V2.pdf) ; Legrand, guide « NF C 15-100 Révision 23 août 2024 – Points clés ».

**R-104 · Hauteur de la GTL** — `a_valider` · `supposee`
- Description : la GTL va du sol au plafond. Elle peut s'arrêter à mi-hauteur si toutes les arrivées et tous les départs passent uniquement par le haut, ou uniquement par le bas.
- Paramètres : `gtl_hauteur = sol_plafond`, `gtl_demi_hauteur_autorisee = si arrivées/départs tous haut ou tous bas`
- Source : Promotelec, brochure NF C 15-100 (https://www.promotelec.com/app/uploads/2023/08/Promotelec_Brochure-NFC_15-100-V2.pdf).

**R-105 · Pièce d'implantation de l'ETEL/GTL** — `a_valider` · `supposee`
- Description : l'ETEL se trouve dans le logement, de préférence près d'une entrée (principale ou de service), ou dans un local annexe directement accessible sans sortir, par exemple un garage attenant. Le logiciel bloque la salle d'eau, les pièces humides ou poussiéreuses, le dessous d'escalier et le placard. L'ETEL ne sert à rien d'autre.
- Paramètres : `pieces_interdites = [salle_d_eau, piece_humide, piece_poussiereuse, sous_escalier, placard]`, `piece_preferee = proche_entree`, réglables
- Source : Promotelec, « Tableau électrique : l'essentiel à savoir » (https://www.promotelec.com/particuliers/fiche/tableau-electrique-lessentiel-a-savoir/) ; Schneider Electric, « Tableau électrique : norme et réglementation » (https://www.se.com/fr/fr/work/support/local/reglementation/norme-nfc15-100/tableau-electrique/). Doute : Legrand semble aussi exclure la cuisine (pièce humide), alors que d'autres sources interdisent seulement le dessus et le dessous d'un point d'eau (voir Q-91).

**R-106 · Distances autour de la GTL fermée** — `a_valider` · `supposee`
- Description : si la GTL est fermée par des cloisons ou une porte, le logiciel vérifie les distances minimales : 10 cm d'une installation de gaz, 40 cm d'une source de chaleur, 60 cm d'un point d'eau.
- Paramètres : `dist_gaz_min_cm = 10`, `dist_chaleur_min_cm = 40`, `dist_point_eau_min_cm = 60`, réglables
- Source : Schneider Electric, « Tableau électrique : norme et réglementation » (https://www.se.com/fr/fr/work/support/local/reglementation/norme-nfc15-100/tableau-electrique/). Seuls Schneider (et une fiche Éduscol pour le gaz) donnent ces chiffres. À vérifier dans la norme.

**R-107 · Tableau dans un garage sans accès direct** — `a_valider` · `supposee`
- Description : si le tableau et le disjoncteur sont placés dans un garage qui ne communique pas directement avec le logement, le logiciel impose un dispositif de coupure d'urgence à l'intérieur du logement.
- Paramètres : `coupure_urgence_interieure_si_garage_sans_acces = oui`
- Source : Promotelec FAQ, « Le tableau général et le disjoncteur peuvent-ils être placés dans un garage sans accès direct avec le logement ? » (https://www.promotelec.com/faq/particuliers/le-tableau-general-et-le-disjoncteur-peuvent-ils-etre-places-dans-un-garage-sans-acces-direct-avec-le-logement/).

**R-108 · Contenu de la GTL** — `a_valider` · `supposee`
- Description : la GTL contient le tableau de répartition principal, le panneau de contrôle (compteur et disjoncteur de branchement) s'il est à l'intérieur, le coffret de communication, au moins 2 prises 2P+T 16 A et les équipements de sécurité (alarme, etc.). Aucun autre fluide ne la traverse.
- Paramètres : `prises_gtl_min = 2`
- Source : Schneider Electric, « Tableau électrique : norme et réglementation » (https://www.se.com/fr/fr/work/support/local/reglementation/norme-nfc15-100/tableau-electrique/) ; Legrand, guide NF C 15-100 2024.

**R-109 · Hauteur des organes de manœuvre du tableau** — `a_valider` · `supposee`
- Description : l'axe des manettes (disjoncteurs, interrupteurs différentiels) est placé entre 0,90 m et 1,80 m du sol fini. Si le coffret a une porte, la rangée basse peut descendre à 0,50 m.
- Paramètres : `manette_h_min_m = 0,90` (coffret sans porte), `manette_h_min_porte_m = 0,50`, `manette_h_max_m = 1,80`, réglables
- Source : Promotelec FAQ, « À quelle hauteur doit se trouver le tableau électrique de mon logement ? » (https://www.promotelec.com/faq/particuliers/a-quelle-hauteur-doit-se-trouver-le-tableau-electrique-de-mon-logement/) ; Legrand, guide NF C 15-100 2024.

**R-110 · Hauteur en logement accessible (PMR)** — `a_valider` · `supposee`
- Description : quand le logement relève de la réglementation accessibilité, la manette la plus haute ne dépasse pas 1,30 m. La limite basse diffère selon les fiches Promotelec : 0,90 m sur promotelec.com, 0,75 m sur l'ancien site particuliers et dans le mémento. Le logiciel vise par défaut la plage 0,90–1,30 m, qui satisfait les deux lectures.
- Paramètres : `pmr_manette_h_max_m = 1,30`, `pmr_manette_h_min_m = 0,90` (valeur prudente ; 0,75 selon d'autres fiches), réglables
- Source : Promotelec FAQ (https://www.promotelec.com/faq/particuliers/a-quelle-hauteur-doit-se-trouver-le-tableau-electrique-de-mon-logement/) ; Promotelec FAQ particuliers, ancienne version (https://particuliers.promotelec.com/fiche-faq/a-hauteur-se-trouver-tableau-electrique-de-logement/). Divergence signalée (Q-92).

**R-111 · Coupure d'urgence et disjoncteur de branchement** — `a_valider` · `supposee`
- Description : la manette du disjoncteur de branchement, qui sert de coupure d'urgence, est placée entre 0,90 m et 1,80 m (au plus 1,30 m en logement accessible), et reste accessible depuis l'intérieur du logement.
- Paramètres : `agcp_h_min_m = 0,90`, `agcp_h_max_m = 1,80`, `agcp_h_max_pmr_m = 1,30`, réglables
- Source : 123elec, « Norme GTL » (https://www.123elec.com/equipement_gtl_norme) ; Batir Moins Cher, « GTL : dimensions, contenu et hauteurs » (https://www.batirmoinscher.com/blog/que-dit-la-norme-concernant-la-gtl/). Ce sont des sources secondaires, à confirmer.

**R-112 · Ordre vertical dans la GTL** — `a_valider` · `supposee`
- Description : par défaut, de haut en bas : panneau de contrôle (disjoncteur de branchement), tableau de répartition (rangée basse au-dessus de 0,90 m), puis coffret de communication.
- Paramètres : `ordre_gtl = [panneau_controle, tableau, coffret_communication]`, réglable
- Source : Schneider Electric (coffret de communication « généralement sous le coffret électrique ») ; Batir Moins Cher. C'est un usage, pas une exigence.

*Communication et GTL*

**R-113 · Circuit des prises de la GTL** — `a_valider` · `supposee`
- Description : les 2 prises 2P+T 16 A de la GTL sont sur un circuit dédié et placées entre 0,05 m et 1,30 m du sol. Le calibre n'est pas fixé par les sources consultées. Le logiciel applique la règle générale des prises : 16 A en 1,5 mm² ou 20 A en 2,5 mm².
- Paramètres : `prises_gtl_min = 2`, `prises_gtl_h_min_m = 0,05`, `prises_gtl_h_max_m = 1,30`, `prises_gtl_calibre_A = 16` (ou 20 en 2,5 mm²), réglables
- Source : Schneider Electric, « Tableau électrique : norme et réglementation » (https://www.se.com/fr/fr/work/support/local/reglementation/norme-nfc15-100/tableau-electrique/) ; Legrand, fiche goulottes GTL (https://assets.legrand.com/general/mediagrp/np-ft-gt/f00382fr-04.pdf).

**R-114 · Composition du tableau de communication** — `a_valider` · `supposee`
- Description : le coffret de communication contient le DTI cuivre et/ou le DTIo fibre, au moins 4 socles RJ45 de brassage, un répartiteur TV, un répartiteur téléphonique si besoin, une barrette de terre, et le câblage en étoile.
- Paramètres : `rj45_brassage_min = 4`
- Source : Promotelec, brochure NF C 15-100 (https://www.promotelec.com/app/uploads/2023/08/Promotelec_Brochure-NFC_15-100-V2.pdf) ; Legrand, guide NF C 15-100 2024.

**R-115 · Volume pour box et ONT** — `a_valider` · `supposee`
- Description : un volume d'au moins 240 × 300 mm sur 200 mm de profondeur, attenant au coffret de communication ou intégré à lui, avec au moins 1 prise 2P+T.
- Paramètres : `volume_box_l_mm = 240`, `volume_box_h_mm = 300`, `volume_box_p_mm = 200`, `prise_volume_box_min = 1`, réglables
- Source : Promotelec, « La norme NF C 15-100 a évolué : le saviez-vous ? » (https://www.promotelec.com/professionnels/fiche/la-norme-nf-c-15-100-a-evolue-le-saviez-vous/) ; Legrand, guide 2024.

**R-116 · Nombre minimal de prises RJ45** — `a_valider` · `supposee`
- Description : pour un T3 ou plus, au moins 4 prises RJ45 : 2 juxtaposées dans le séjour, et 1 dans chacune de 2 autres pièces. Chaque prise RJ45 est placée près d'une prise de courant. Cette règle sert à compter les départs du coffret.
- Paramètres : `rj45_min_T3plus = 4`, `rj45_sejour = 2`, réglables
- Source : Promotelec, brochure NF C 15-100 (https://www.promotelec.com/app/uploads/2023/08/Promotelec_Brochure-NFC_15-100-V2.pdf).

*Branchement*

**R-117 · Réglage du disjoncteur de branchement** — `a_valider` · `supposee`
- Description : en monophasé, le réglage correspond à la puissance souscrite : 6 kVA → 30 A, 9 kVA → 45 A, 12 kVA → 60 A. Le réglage est fait par Enedis, sous plomb. Le logiciel s'en sert pour la règle « amont » de calibrage des interrupteurs différentiels (R-124).
- Paramètres : `agcp_6kVA_A = 30`, `agcp_9kVA_A = 45`, `agcp_12kVA_A = 60`, réglables
- Source : Choisir.com, « Disjoncteur général » (https://www.choisir.com/energie/articles/117195/le-disjoncteur-general) ; Kelwatt, « Ampérage disjoncteur » (https://www.kelwatt.fr/guide/compteur/electricite/amperage). Ce sont des sources secondaires.

**R-118 · Liaison disjoncteur de branchement → tableau** — `a_valider` · `supposee`
- Description : section minimale de cuivre selon le réglage : 30 A et 45 A → 10 mm², 60 A → 16 mm², 90 A → 25 mm². Longueurs maximales pour 2 % de chute de tension en monophasé : 45 A en 10 mm² → 22 m, en 16 mm² → 36 m ; 60 A en 16 mm² → 27 m, en 25 mm² → 42 m.
- Paramètres : `sect_liaison_45A_mm2 = 10`, `sect_liaison_60A_mm2 = 16`, `long_max_45A_10mm2_m = 22`, `long_max_60A_16mm2_m = 27`, réglables
- Source : Promotelec, « Comment choisir la bonne section de câble pour alimenter votre tableau ? » (https://www.promotelec.com/professionnels/fiche/comment-choisir-la-bonne-section-de-cable-pour-alimenter-votre-tableau/) ; Schneider Electric, guide NF C 15-100 2012.

*Différentiels*

**R-119 · Nombre minimal d'interrupteurs différentiels** — `a_valider` · `supposee`
- Description : tout logement comporte au moins 2 dispositifs différentiels 30 mA, et tous les circuits sont protégés par un 30 mA.
- Paramètres : `nb_id_min = 2`, `sensibilite_mA = 30`
- Source : Promotelec, brochure NF C 15-100 (https://www.promotelec.com/app/uploads/2023/08/Promotelec_Brochure-NFC_15-100-V2.pdf) ; Legrand, guide 2024.

**R-120 · Type A obligatoire pour la cuisson, le lave-linge et l'IRVE** — `a_valider` · `supposee`
- Description : les circuits plaque de cuisson ou cuisinière, lave-linge et IRVE sont placés sous un différentiel de type A, ou d'un type supérieur (F ou B). Au moins 1 des différentiels du tableau est donc de type A.
- Paramètres : `circuits_type_A = [cuisson, lave_linge, irve]`, `types_admis = [A, F, B]`, `nb_id_type_A_min = 1`
- Source : Promotelec, brochure NF C 15-100 (https://www.promotelec.com/app/uploads/2023/08/Promotelec_Brochure-NFC_15-100-V2.pdf) ; Legrand, guide 2024.

**R-121 · Type minimal pour les autres circuits** — `a_valider` · `supposee`
- Description : les autres circuits sont protégés au minimum par un type AC. Un type A, F ou B est aussi admis. Le logiciel accepte qu'un circuit « AC » soit placé sous un type A si la répartition l'exige.
- Paramètres : `type_min_autres = AC`
- Source : Promotelec, brochure NF C 15-100 (https://www.promotelec.com/app/uploads/2023/08/Promotelec_Brochure-NFC_15-100-V2.pdf).

**R-122 · Maximum de circuits par interrupteur différentiel** — `a_valider` · `supposee`
- Description : 8 circuits au plus en aval d'un même dispositif différentiel, quel que soit son calibre.
- Paramètres : `circuits_par_id_max = 8`, réglable (une valeur plus basse peut être choisie par habitude chantier, voir Q-95)
- Source : Promotelec, brochure NF C 15-100 (https://www.promotelec.com/app/uploads/2023/08/Promotelec_Brochure-NFC_15-100-V2.pdf) ; Legrand, guide 2024.

**R-123 · Éclairage et prises répartis sous au moins 2 différentiels** — `a_valider` · `supposee`
- Description : pour la continuité de service, les circuits d'éclairage ne sont pas tous sous le même différentiel ; il en va de même pour les circuits de prises. Le logiciel vérifie que chaque famille est présente sous au moins 2 différentiels différents.
- Paramètres : `id_min_par_famille_eclairage = 2`, `id_min_par_famille_prises = 2`
- Source : Promotelec, brochure NF C 15-100 (https://www.promotelec.com/app/uploads/2023/08/Promotelec_Brochure-NFC_15-100-V2.pdf) ; Legrand, guide 2024.

**R-124 · Calibre des interrupteurs différentiels** — `a_valider` · `supposee`
- Description : le calibre est choisi selon l'une de deux règles. Règle amont : calibre de l'ID ≥ réglage du disjoncteur de branchement. Règle aval : calibre de l'ID ≥ 1 × la somme des calibres des circuits de chauffage direct, IRVE et eau chaude, + 0,5 × la somme des autres circuits. Le logiciel arrondit au calibre commercial supérieur (25, 40 ou 63 A). Exemple Legrand : chauffage 20 A + prises 16 A + éclairage 10 A donne 20 + 8 + 5 = 33 A, d'où un ID de 40 A.
- Paramètres : `coef_chauffage_irve_ecs = 1`, `coef_autres = 0,5`, `calibres_id_A = [25, 40, 63]`, réglables
- Source : Promotelec, brochure NF C 15-100 (https://www.promotelec.com/app/uploads/2023/08/Promotelec_Brochure-NFC_15-100-V2.pdf) ; Legrand, guide 2024.

**R-125 · Type F pour les équipements à variateur (option)** — `a_valider` · `supposee`
- Description : pour un circuit qui alimente un équipement à variateur de vitesse monophasé (PAC, climatiseur, pompe), le logiciel propose un type F à la place d'un type A. C'est une recommandation, pas une obligation, et cela devient une option du chantier.
- Paramètres : `proposer_type_F_si_variateur = oui`
- Source : Hager, « La norme électrique NF C 15-100 » (https://hager.com/fr/normes/nfc-15-100) ; Legrand, guide 2024 (tableau des types).

**R-126 · Congélateur sur différentiel dédié (option recommandée)** — `a_valider` · `supposee`
- Description : quand l'emplacement du congélateur est connu, il est conseillé de le mettre sur un circuit spécialisé protégé par un 30 mA propre, de préférence à immunité renforcée (HI/SI). Promotelec recommande fortement la même chose pour le réfrigérateur.
- Paramètres : `congelateur_id_dedie = recommande`, `type_id_congelateur = HI_ou_SI`, réglables
- Source : Legrand FAQ, « Quel disjoncteur pour un congélateur ? » (https://www.legrand.fr/questions-frequentes/quel-disjoncteur-pour-un-congelateur) ; Promotelec FAQ, « Faut-il faire un circuit spécialisé pour le réfrigérateur ? » (https://www.promotelec.com/faq/professionnels/faut-il-faire-un-circuit-specialise-pour-le-refrigerateur/).

**R-127 · Calcul du nombre d'interrupteurs différentiels** — `a_valider` · `supposee`
- Description : le logiciel compte les circuits sous les différentiels communs (hors IRVE), calcule `nb_ID = max(2, arrondi_sup(nb_circuits / 8))`, ajoute 1 différentiel dédié par point de recharge (R-142) et, si l'option est retenue, par congélateur, puis vérifie R-120 et R-123.
- Paramètres : `formule_nb_id = max(nb_id_min, ceil(nb_circuits / circuits_par_id_max))`
- Source : déduit de R-119 à R-123 et de R-142 (sources citées dans ces règles).

*Protections et circuits*

**R-128 · Un disjoncteur par circuit** — `a_valider` · `supposee`
- Description : chaque circuit est protégé contre les surintensités par un disjoncteur ; les coupe-circuits à fusibles sont interdits dans le neuf. Un disjoncteur protège un seul circuit.
- Paramètres : `protection_surintensite = disjoncteur`, `fusible_autorise = non`
- Source : Promotelec, brochure NF C 15-100 (https://www.promotelec.com/app/uploads/2023/08/Promotelec_Brochure-NFC_15-100-V2.pdf) ; Legrand, guide 2024.

**R-129 · Circuits d'éclairage** — `a_valider` · `supposee`
- Description : 1,5 mm², disjoncteur de 16 A au plus (10 A conseillé), 8 points d'éclairage au plus par circuit, et au moins 2 circuits d'éclairage par logement. Une prise commandée compte comme un point d'éclairage.
- Paramètres : `ecl_section_mm2 = 1,5`, `ecl_calibre_max_A = 16`, `ecl_calibre_defaut_A = 10`, `ecl_points_max = 8`, `ecl_circuits_min = 2`, réglables
- Source : Legrand, guide NF C 15-100 2024 (https://assets.legrand.com/editorial/legrandfr/outils/documentations-et-guides/legrand-guide-norme-nf-c-15-100.pdf).

**R-130 · Circuits de prises 16 A** — `a_valider` · `supposee`
- Description : 8 prises au plus en 1,5 mm² / 16 A, ou 12 prises au plus en 2,5 mm² / 20 A. Chaque socle compte pour 1, même dans une boîte multiposte. Une prise USB seule ne compte pas.
- Paramètres : `pc_1_5_calibre_A = 16`, `pc_1_5_max = 8`, `pc_2_5_calibre_A = 20`, `pc_2_5_max = 12`, réglables
- Source : Promotelec, brochure NF C 15-100 (https://www.promotelec.com/app/uploads/2023/08/Promotelec_Brochure-NFC_15-100-V2.pdf) ; Legrand, guide 2024.

**R-131 · Nombre minimal de prises par pièce (pour compter les circuits)** — `a_valider` · `supposee`
- Description : séjour de 28 m² ou moins : 1 prise par tranche de 4 m², avec un minimum de 5. Séjour de plus de 28 m² : au moins 7. Chambre : 3. Cuisine de plus de 4 m² : 6, dont 4 au-dessus du plan de travail (3 si 4 m² ou moins). Autres pièces de plus de 4 m² hors WC : 1. Plus 2 prises « multimédia », de préférence dans le séjour.
- Paramètres : `sejour_m2_par_prise = 4`, `sejour_min = 5`, `sejour_grand_min = 7`, `chambre_min = 3`, `cuisine_min = 6`, `multimedia_sup = 2`, réglables
- Source : Legrand, guide 2024 (https://assets.legrand.com/editorial/legrandfr/outils/documentations-et-guides/legrand-guide-norme-nf-c-15-100.pdf) ; Promotelec, brochure NF C 15-100.

**R-132 · Circuit dédié aux prises de la cuisine** — `a_valider` · `supposee`
- Description : les 6 prises non spécialisées de la cuisine sont sur un circuit à elles seules, en 2,5 mm² / 20 A. Les prises supplémentaires de la cuisine vont sur un autre circuit.
- Paramètres : `pc_cuisine_max = 6`, `pc_cuisine_section_mm2 = 2,5`, `pc_cuisine_calibre_A = 20`
- Source : Promotelec, brochure NF C 15-100 (https://www.promotelec.com/app/uploads/2023/08/Promotelec_Brochure-NFC_15-100-V2.pdf).

**R-133 · Circuit cuisson** — `a_valider` · `supposee`
- Description : un circuit dédié à la plaque ou à la cuisinière, avec sortie de câble ou prise 32 A. En monophasé : 6 mm², disjoncteur 32 A. En triphasé : 2,5 mm², 20 A. Il est placé sous un différentiel de type A (R-120).
- Paramètres : `cuisson_mono_section_mm2 = 6`, `cuisson_mono_calibre_A = 32`, `cuisson_tri_section_mm2 = 2,5`, `cuisson_tri_calibre_A = 20`
- Source : Legrand, guide 2024 ; Voltimum / Promotelec, « Le point sur les circuits électriques spécialisés dans l'habitat » (https://www.voltimum.fr/actualites/promotelec/securite-electrique-le-point-sur-les-circuits).

**R-134 · Au moins 3 circuits spécialisés en 20 A** — `a_valider` · `supposee`
- Description : au moins 3 circuits spécialisés en 2,5 mm² / 20 A, chacun pour un seul appareil (lave-linge, lave-vaisselle, sèche-linge, four, congélateur, etc.). Le logiciel ajoute 1 circuit par gros appareil supplémentaire prévu au plan.
- Paramètres : `specialises_20A_min = 3`, `spec_section_mm2 = 2,5`, `spec_calibre_A = 20`, réglables
- Source : Legrand, guide 2024 ; Voltimum / Promotelec (https://www.voltimum.fr/actualites/promotelec/securite-electrique-le-point-sur-les-circuits).

**R-135 · Chauffe-eau électrique** — `a_valider` · `supposee`
- Description : si un chauffe-eau électrique à accumulation est prévu, il a un circuit dédié en 2,5 mm² / 20 A, piloté le plus souvent par un contacteur heures creuses (R-154).
- Paramètres : `ce_section_mm2 = 2,5`, `ce_calibre_A = 20`
- Source : Legrand, guide 2024 ; Schneider Electric, guide NF C 15-100 2012 (https://www.etablissements-laroche.fr/wp-content/uploads/2018/09/guideNFC-15-100.pdf).

**R-136 · Chauffage électrique par émetteurs muraux** — `a_valider` · `supposee`
- Description : les appareils de chauffage sont toujours sur des circuits dédiés. Section et calibre suivent la puissance totale du circuit : 3 500 W → 1,5 mm² / 16 A ; 4 500 W → 2,5 mm² / 20 A ; 5 750 W → 4 mm² / 25 A ; 7 250 W → 6 mm² / 32 A. Par défaut, le logiciel crée 1 circuit en 20 A par tranche de 4 500 W.
- Paramètres : `chauf_3500W = 1,5 mm² / 16 A`, `chauf_4500W = 2,5 mm² / 20 A`, `chauf_5750W = 4 mm² / 25 A`, `chauf_7250W = 6 mm² / 32 A`, `tranche_defaut_W = 4500`, réglables
- Source : Legrand, guide 2024 (https://assets.legrand.com/editorial/legrandfr/outils/documentations-et-guides/legrand-guide-norme-nf-c-15-100.pdf).

**R-137 · Plancher chauffant électrique** — `a_valider` · `supposee`
- Description : si un plancher rayonnant électrique est prévu : 1 700 W → 1,5 mm² / 16 A ; 3 400 W → 2,5 mm² / 25 A ; 4 200 W → 4 mm² / 32 A ; 5 400 W → 6 mm² / 40 A ; 7 500 W → 10 mm² / 50 A.
- Paramètres : `plancher_1700W = 1,5 mm² / 16 A`, `plancher_3400W = 2,5 mm² / 25 A`, `plancher_4200W = 4 mm² / 32 A`, `plancher_5400W = 6 mm² / 40 A`, `plancher_7500W = 10 mm² / 50 A`, réglables
- Source : Schneider Electric, guide NF C 15-100 2012 (https://www.etablissements-laroche.fr/wp-content/uploads/2018/09/guideNFC-15-100.pdf) ; Nexans, « Section des conducteurs et calibres de protection » (https://home.nexans.fr/section-des-conducteurs-et-calibres-de-protection). Ce guide date d'avant 2024 : à revalider.

**R-138 · Volets roulants** — `a_valider` · `supposee`
- Description : s'il y a des volets motorisés, au moins 1 circuit leur est entièrement dédié, en 1,5 mm² / 16 A ou en 2,5 mm² / 20 A selon la puissance des moteurs. Legrand conseille de répartir les volets sur 2 circuits, ce qui devient une option du chantier, par exemple un circuit par niveau.
- Paramètres : `vr_circuits_min = 1`, `vr_circuits_defaut = 2`, `vr_1_5_calibre_A = 16`, `vr_2_5_calibre_A = 20`, réglables
- Source : Legrand, guide 2024 (https://assets.legrand.com/editorial/legrandfr/outils/documentations-et-guides/legrand-guide-norme-nf-c-15-100.pdf). Le nombre maximal de moteurs par circuit n'est pas fixé par les sources officielles (voir Q-99).

**R-139 · VMC** — `a_valider` · `supposee`
- Description : la VMC individuelle a un circuit dédié en 1,5 mm², avec un disjoncteur de 2 A, ou jusqu'à 16 A selon la notice du fabricant.
- Paramètres : `vmc_section_mm2 = 1,5`, `vmc_calibre_A = 2`, `vmc_calibre_max_A = 16`, réglables
- Source : Schneider Electric, guide NF C 15-100 2012 ; Legrand FAQ congélateur/VMC (https://www.legrand.fr/questions-frequentes/quel-disjoncteur-pour-un-congelateur).

**R-140 · Circuits de commande (asservissement tarifaire, fil pilote)** — `a_valider` · `supposee`
- Description : le circuit d'asservissement tarifaire (bobine du contacteur heures creuses) et les circuits de commande sont en 1,5 mm², protégés par un disjoncteur de 2 A. Chacun compte 1 module de disjoncteur.
- Paramètres : `commande_section_mm2 = 1,5`, `commande_calibre_A = 2`
- Source : Schneider Electric, guide NF C 15-100 2012 (https://www.etablissements-laroche.fr/wp-content/uploads/2018/09/guideNFC-15-100.pdf).

**R-141 · Circuit IRVE (si prévu)** — `a_valider` · `inconnue`
- Description : chaque point de recharge (prise renforcée ou borne) a son propre circuit spécialisé. Prise renforcée en mode 2 : 2,5 mm² / 20 A. Borne de 7,4 kW en monophasé : le calibre (32 ou 40 A) et la section (6 ou 10 mm²) varient selon les sources secondaires et dépendent de la notice et de la longueur. Le logiciel ne fixe pas de valeur et demande la notice.
- Paramètres : `irve_prise_renforcee = 2,5 mm² / 20 A`, `irve_borne_7kW_calibre_A = inconnu` (32 ou 40), `irve_borne_7kW_section_mm2 = inconnue` (6 ou 10), réglables
- Source : Legrand, guide 2024 ; Promotelec, « Série de normes NF C15-100 : 2024 » (https://www.promotelec.com/actualite/serie-de-normes-nf-c15-100-2024-les-grandes-evolutions/).

**R-142 · Différentiel de l'IRVE** — `a_valider` · `supposee`
- Description : chaque point de recharge en courant alternatif est protégé individuellement par un DDR 30 mA, au minimum de type A. En mode 3 monophasé : type A ou F avec détection du courant continu à 6 mA (souvent intégrée à la borne), ou bien type B. En mode 3 triphasé : type B, ou type A/F avec détection 6 mA.
- Paramètres : `irve_ddr_dedie = oui`, `irve_type_min = A`, `irve_detection_dc_mA = 6`
- Source : Promotelec, « Série de normes NF C15-100 : 2024, les grandes évolutions ! » (https://www.promotelec.com/actualite/serie-de-normes-nf-c15-100-2024-les-grandes-evolutions/) ; Legrand, guide 2024.

**R-143 · Circuits extérieurs et annexes** — `a_valider` · `supposee`
- Description : les circuits extérieurs (éclairage de jardin, prises non attenantes, portail, porte de garage) et les circuits vers une annexe sont des circuits spécialisés sous 30 mA. Chaque accès extérieur (entrée principale ou de service) reçoit un point d'éclairage.
- Paramètres : `exterieur_circuit_specialise = oui`, `point_eclairage_par_acces = 1`
- Source : Voltimum / Promotelec, liste des circuits spécialisés (https://www.voltimum.fr/actualites/promotelec/securite-electrique-le-point-sur-les-circuits) ; Legrand, guide 2024.

*Dimensionnement du tableau et réserves*

**R-144 · Réserve de 20 % d'emplacements** — `a_valider` · `supposee`
- Description : en maison individuelle, le tableau garde au moins 20 % d'emplacements libres. La règle de 6 modules au minimum concerne seulement le logement collectif. Le logiciel calcule `modules_installes × 1,2`, arrondi au module supérieur, avant de choisir le coffret.
- Paramètres : `reserve_pct = 20`, `arrondi = module_superieur`, réglables
- Source : Promotelec, brochure NF C 15-100 (https://www.promotelec.com/app/uploads/2023/08/Promotelec_Brochure-NFC_15-100-V2.pdf) ; Legrand, guide 2024.

**R-145 · Répartition de la réserve** — `a_valider` · `supposee`
- Description : la réserve est répartie en bout de rangée, et de préférence sur toutes les rangées, pour qu'on puisse ajouter des disjoncteurs sous chaque différentiel. C'est une recommandation fabricant.
- Paramètres : `reserve_position = fin_de_rangee`, `reserve_repartie_toutes_rangees = oui`, réglables
- Source : Legrand, guide 2024 ; Legrand FAQ, « Quelle est la norme pour un tableau électrique dans une maison individuelle en 2026 ? » (https://www.legrand.fr/questions-frequentes/quelle-est-la-norme-pour-un-tableau-electrique-dans-une-maison-individuelle-en-2026).

**R-146 · Largeur des appareils en modules** — `a_valider` · `inconnue`
- Description : la largeur dépend de la marque et de la gamme. La norme ne la fixe pas. Valeurs par défaut à faire valider : disjoncteur 1P+N = 1 module (18 mm) ; interrupteur différentiel = 2 modules (Legrand DX3 63 A) ou 4 selon la gamme ; parafoudre = 2 modules ; contacteur heures creuses = 1 module ; délesteur = 1 à 2 modules.
- Paramètres : `mod_disj_1PN = 1`, `mod_id = 2` (ou 4), `mod_parafoudre = 2`, `mod_contacteur = 1`, `mod_delesteur = 2`, réglables
- Source : Legrand, guide 2024 (largeur 2 modules pour le DX3-ID 63 A). Les autres valeurs sont supposées et dépendent de la gamme choisie par le pavillonneur (Q-94).

**R-147 · Nombre de rangées** — `a_valider` · `supposee`
- Description : `nb_rangees = arrondi_sup(modules_totaux_avec_reserve / modules_par_rangee)`. La largeur de rangée vient du coffret choisi : 13 modules (GTL de 250 mm) ou 18 modules (GTL plus large). La norme ne fixe aucun nombre de rangées.
- Paramètres : `modules_par_rangee = 13` (13 ou 18 ; 24 hors GTL standard), réglables
- Source : Legrand, fiches goulottes GTL Drivia 13 et 18 modules (https://assets.legrand.com/pim/NP-FT-GT/F00382FR-08.pdf) ; Legrand, guide 2024.

**R-148 · Un différentiel en tête de chaque rangée** — `a_valider` · `supposee`
- Description : par défaut, chaque rangée commence par son interrupteur différentiel, suivi de ses disjoncteurs. Un différentiel n'alimente pas de disjoncteurs sur une autre rangée, sauf choix contraire.
- Paramètres : `id_tete_de_rangee = oui`, `id_multi_rangees = non`, réglables
- Source : Schneider Electric, « Tableau électrique : norme et réglementation » (https://www.se.com/fr/fr/work/support/local/reglementation/norme-nfc15-100/tableau-electrique/). C'est un usage, pas une exigence normative.

**R-149 · Repérage et schéma** — `a_valider` · `supposee`
- Description : chaque disjoncteur est repéré par le local et la fonction (par exemple « Chambre 1 – prises »). Le schéma de l'installation est remis à l'occupant, rangé si possible dans un porte-document de la GTL. Le logiciel génère l'étiquetage.
- Paramètres : `etiquetage_obligatoire = oui`, `schema_remis = oui`
- Source : Schneider Electric, « Tableau électrique : norme et réglementation » (https://www.se.com/fr/fr/work/support/local/reglementation/norme-nfc15-100/tableau-electrique/) ; Legrand, guide 2024.

*Parafoudre*

**R-150 · Cas où le parafoudre est obligatoire** — `a_valider` · `supposee`
- Description : un parafoudre est obligatoire au tableau dans trois cas : (a) bâtiment équipé d'un paratonnerre, toutes zones : type 1, Iimp ≥ 12,5 kA ; (b) bâtiment à moins de 50 m d'un bâtiment équipé d'un paratonnerre ; (c) zone AQ2 avec alimentation entièrement ou partiellement aérienne : type 2, In ≥ 5 kA.
- Paramètres : `pf_obligatoire_si = [paratonnerre, distance_paratonnerre_lt_50m, AQ2_et_aerien]`, `pf_t1_iimp_kA = 12,5`, `pf_t2_in_kA = 5`, réglables
- Source : Legrand, guide 2024 ; Legrand, « Parafoudres : bien se protéger » (https://www.legrand.fr/actualites/parafoudres-bien-se-proteger-contre-la-foudre-et-les-surtensions) ; Dehn, « Vos obligations normatives » (https://www.dehn.fr/fr/tertiaires). Promotelec (« Série de normes NF C15-100 : 2024 », partie 4-43, art. 534.1 de la NF C 15-100-1) exclut explicitement l'habitation de la nouvelle évaluation du risque : « Pour tout autre type de bâtiments, à l'exception des bâtiments d'habitation, une évaluation du risque doit être menée ». Pour l'habitation, les règles de 2002 restent donc applicables.

**R-151 · Cas où le parafoudre est recommandé** — `a_valider` · `supposee`
- Description : en zone AQ2 avec alimentation enterrée, un parafoudre est recommandé (avec analyse de risque) si la maison contient des équipements liés à la sécurité des personnes : alarme, matériel médical, alarme technique. Hors AQ2, il est recommandé en présence d'appareils sensibles. Le logiciel le propose comme option.
- Paramètres : `pf_recommande_si = [AQ2_et_securite_personnes, equipements_sensibles]`
- Source : Legrand, guide 2024 (https://assets.legrand.com/editorial/legrandfr/outils/documentations-et-guides/legrand-guide-norme-nf-c-15-100.pdf).

**R-152 · Parafoudre complémentaire au-delà de 10 m** — `a_valider` · `supposee`
- Description : si un équipement à protéger se trouve à plus de 10 m du parafoudre de tête (la distance était de 30 m auparavant), le logiciel signale qu'il faut un parafoudre complémentaire ou des mesures supplémentaires. C'est utile pour un tableau divisionnaire d'étage ou un garage.
- Paramètres : `pf_distance_max_m = 10`, réglable
- Source : Promotelec, « Série de normes NF C15-100 : 2024 » (https://www.promotelec.com/actualite/serie-de-normes-nf-c15-100-2024-les-grandes-evolutions/) ; Legrand, guide 2024. Doute : Promotelec présente ce chiffre dans la partie générale. Son application stricte en habitation reste à confirmer (Q-103).

**R-153 · Parafoudre du réseau de communication** — `a_valider` · `supposee`
- Description : si l'alimentation électrique est protégée par un parafoudre et que le logement est raccordé à un réseau de communication extérieur en cuivre, le logiciel ajoute un parafoudre de communication. C'est une nouveauté de 2024, qui s'applique aussi à l'habitation.
- Paramètres : `pf_com_si_pf_puissance_et_cuivre = oui`
- Source : Promotelec, « Série de normes NF C15-100 : 2024, les grandes évolutions ! » (https://www.promotelec.com/actualite/serie-de-normes-nf-c15-100-2024-les-grandes-evolutions/).

*Gestion d'énergie et automatismes*

**R-154 · Contacteur heures creuses** — `a_valider` · `supposee`
- Description : le chauffe-eau peut être commandé par un contacteur jour/nuit piloté par le compteur (contact C1/C2). Il faut alors un disjoncteur de commande de 2 A (R-140) en plus du disjoncteur de puissance du chauffe-eau, que le contacteur ne remplace pas.
- Paramètres : `contacteur_hc = option_chantier`, `disj_commande_hc_A = 2`
- Source : Promotelec, « Quels sont les composants de votre installation électrique ? » (https://www.promotelec.com/particuliers/fiche/quels-sont-les-composants-de-votre-installation-electrique/) ; Sparx Élec, « Circuits spécialisés obligatoires » (https://www.sparx-elec.fr/circuits-specialises-obligatoires/).

**R-155 · Délesteur ou gestionnaire d'énergie** — `a_valider` · `inconnue`
- Description : aucune source consultée n'impose de délesteur en pavillon neuf. Le module se place juste après le disjoncteur de branchement. Il coupe les circuits non prioritaires (chauffage par fil pilote, chauffe-eau, IRVE) quand l'appel de puissance approche de l'abonnement. Le logiciel le propose en option et compte ses modules.
- Paramètres : `delesteur = option_chantier`, `circuits_delestables_defaut = [chauffage, chauffe_eau, irve]`, réglables
- Source : Promotelec, « Quels sont les composants de votre installation électrique ? » (https://www.promotelec.com/particuliers/fiche/quels-sont-les-composants-de-votre-installation-electrique/). Legrand mentionne une obligation de 2027 qui vient du décret n° 2023-444 du 7 juin 2023 : elle impose un « système de régulation automatique de la température de chauffage par pièce », et non un délestage. L'échéance est le 1er janvier 2027 pour les permis ou déclarations préalables déposés à partir de cette date, et le 1er janvier 2030 pour l'existant, selon JeChange.

**R-156 · Télérupteurs, minuteries, programmateurs** — `a_valider` · `supposee`
- Description : ces appareils modulaires sont des options. Ils ne protègent rien : le circuit qu'ils commandent garde son disjoncteur. Le logiciel les place dans la rangée de leur circuit et les compte dans les modules.
- Paramètres : `telerupteur = option_chantier`, `mod_telerupteur = 1`, réglables
- Source : Promotelec, « Quels sont les composants de votre installation électrique ? » (https://www.promotelec.com/particuliers/fiche/quels-sont-les-composants-de-votre-installation-electrique/).

*Maison à étage, dépendances, extérieur*

**R-157 · Tableau divisionnaire autorisé** — `a_valider` · `supposee`
- Description : un ou plusieurs tableaux divisionnaires, alimentés par le tableau principal, peuvent être placés hors de la GTL. Ils sont interdits dans les volumes 0, 1 et 2 et dans le volume caché d'une salle d'eau. Par défaut, le logiciel propose un tableau unique dans la GTL ; le divisionnaire d'étage est une option du chantier.
- Paramètres : `tableau_divisionnaire = option_chantier`, `divisionnaire_interdit = [volume_0, volume_1, volume_2, volume_cache]`
- Source : Promotelec FAQ, « Peut-on faire installer un tableau divisionnaire dans une salle d'eau ou salle de bains ? » (https://www.promotelec.com/faq/particuliers/peut-on-faire-installer-un-tableau-divisionnaire-dans-une-salle-deau-ou-salle-de-bains/).

**R-158 · Liaison vers un tableau divisionnaire** — `a_valider` · `inconnue`
- Description : la liaison principal → divisionnaire est protégée par un disjoncteur à son départ. Sa section et sa longueur doivent limiter la chute de tension (1 % selon l'ancien mémento Promotelec, à confirmer). Le guide Schneider 2012 donne en 2,5 mm² / 20 A environ 12 m, et en 4 mm² / 32 A environ 31 m. La place du différentiel 30 mA (au départ ou en tête du divisionnaire) n'est pas tranchée par les sources officielles consultées.
- Paramètres : `chute_tension_liaison_div_pct = 1` (à confirmer), `long_max_2_5mm2_20A_m = 12`, `long_max_4mm2_32A_m = 31`, `position_ddr_divisionnaire = inconnue`, réglables
- Source : Schneider Electric / cours MELEC, tableau « longueur maxi des conducteurs d'alimentation des tableaux de répartition divisionnaire » (http://siteelectrotechnique.free.fr/Documents%20TGE/cours%20Meleec_NORMES_NFC15-100_C.pdf) ; Mémento Promotelec « Locaux d'habitation », 2007, obsolète (https://sti.passtek.net/livres/Electrotechnique/Promotelec%20Habitation.pdf).

**R-159 · Local annexe ou garage non attenant** — `a_valider` · `supposee`
- Description : une annexe (garage séparé, atelier, abri) est alimentée depuis le tableau principal. Elle reçoit un tableau divisionnaire avec dispositif de coupure d'urgence, une protection différentielle (30 mA par défaut dans le logiciel) et une liaison à la terre, en général celle de la maison. La norme n'impose aucun équipement minimal (prises, éclairage) dans les annexes.
- Paramètres : `annexe_tableau_div = oui`, `annexe_coupure_urgence = oui`, `annexe_ddr_mA = 30`, réglables
- Source : Promotelec, « Tout savoir sur les normes électriques pour vos locaux annexes » (https://www.promotelec.com/particuliers/fiche/tout-savoir-sur-les-normes-electriques-pour-vos-locaux-annexes/) ; Promotelec, « Série de normes NF C15-100 : 2024 » (encadré sur les bâtiments à usage domestique).

**R-160 · Coupure d'urgence d'un local indépendant habité** — `a_valider` · `supposee`
- Description : tout local indépendant à usage d'habitation qui comporte plusieurs pièces, par exemple un studio séparé, a son propre dispositif de coupure d'urgence, comme un interrupteur-sectionneur.
- Paramètres : `coupure_urgence_local_independant = oui`
- Source : Legrand, guide 2024 (https://assets.legrand.com/editorial/legrandfr/outils/documentations-et-guides/legrand-guide-norme-nf-c-15-100.pdf) ; Promotelec, brochure NF C 15-100.

**R-161 · Répartition des circuits entre niveaux (option)** — `a_valider` · `supposee`
- Description : dans une maison à étage avec un tableau unique, le logiciel répartit par défaut l'éclairage, les prises et les volets de façon que chaque niveau dépende d'au moins 2 différentiels, et il vérifie la chute de tension pour les pièces de l'étage les plus éloignées.
- Paramètres : `niveaux_sous_2_id_min = oui`, `vr_un_circuit_par_niveau = oui`, réglables
- Source : déduit de R-123 et R-138 (Promotelec, Legrand). C'est un choix de conception, pas une exigence.

**Réserves de la recherche**
- **Aucune lecture directe de la norme.** Le texte de la NF C 15-100-10 (2024) est payant et n'a pas été consulté. Les règles s'appuient sur Promotelec (dont une brochure qui reproduit l'A5 avec l'accord d'AFNOR), les guides Legrand et Schneider, le Consuel et quelques sites secondaires. C'est pourquoi tout est en `supposee` tant que Kévin n'a pas vérifié.
- **Chiffres anciens à revalider.** Plusieurs chiffres viennent de documents antérieurs à 2024 : le guide Schneider 2012 (plancher chauffant, VMC, longueurs de liaison des divisionnaires) et le mémento Promotelec 2007 (chute de tension de 1 %). Les distances autour de la GTL ne sont données que par Schneider.
- **Sources qui divergent.** La hauteur basse en logement accessible, l'exclusion ou non de la cuisine pour la GTL, et la coupure d'urgence des annexes (Promotelec la demande pour tout local annexe, Legrand seulement pour un local indépendant habité de plusieurs pièces) diffèrent selon les sources. Le logiciel retient la lecture la plus prudente et pose la question.

## 5. Questions pour Kévin (registre des inconnues)

Chaque question est suivie ici : `ouverte` → `répondue` → règle créée ou corrigée. **Réponse par défaut** = ce que le logiciel supposerait aujourd'hui (il le marque « supposé » tant que tu n'as pas répondu).

### A. Boîtes
| N° | Question | Supposé aujourd'hui | Si doute |
|---|---|---|---|
| Q-01 | 18 départs par boîte : valeur fixe pour toutes les boîtes, ou dépend du modèle de boîte ? | fixe | bloquer |
| Q-02 | Distance maximale entre une boîte et l'appareil qu'elle dessert ? | pas de limite | avertir |
| Q-03 | Pièces où la boîte est interdite (salle de bain, garage, extérieur, placard…) ? | aucune | avertir |
| Q-04 | Hauteur de pose de la boîte (plafond ? à combien du sol) ? | non utilisée | avertir |

### B. Gaines
| N° | Question | Supposé aujourd'hui | Si doute |
|---|---|---|---|
| Q-05 | Diamètres de gaine utilisés (16, 20, 25, 32 ?) et diamètre mini pour un appareil seul ? | Ø16 / Ø20 / Ø25 | bloquer |
| Q-06 | Combien de fils (par section) dans chaque diamètre ? | calcul par remplissage | bloquer |
| Q-07 | Surlongueurs : à la boîte, à l'appareil, par descente ? Arrondi (au 0,1 m, 0,5 m, 1 m) ? | valeurs du v29 | avertir |
| Q-08 | Hauteur des descentes selon l'appareil (interrupteur, prise, plafonnier, applique, tableau) ? | valeurs du v29 | avertir |
| Q-09 | Longueur maximale d'une gaine ? | pas de limite | avertir |

### C. Circuits et couleurs
| N° | Question | Supposé aujourd'hui | Si doute |
|---|---|---|---|
| Q-10 | Nombre maximum de points lumineux par circuit d'éclairage ? | 8 | bloquer |
| Q-11 | Circuits spécialisés : liste exacte (four, plaque, LL, LV, SL, chauffe-eau, VMC, PAC, volets, sonnette…), section et protection de chacun ? | table du v28 | bloquer |
| Q-12 | 3e paire de couleurs phase / neutre quand les deux premières sont prises ? | aucune | bloquer |
| Q-13 | Couleurs des câbles spécialisés et extérieurs (3G, 4G, 5G) ? | couleurs du câble | avertir |
| Q-14 | Les prises sont-elles regroupées par pièce, par zone, ou par proximité pour faire un circuit ? | proximité | avertir |
| Q-15 | Volets roulants : circuit propre ? commande en SC, en boîte ? | non relevés | bloquer |

### D. Allumages
| N° | Question | Supposé aujourd'hui | Si doute |
|---|---|---|---|
| Q-16 | Contenu exact de la gaine d'un va-et-vient (nombre de fils, couleurs : navettes, retour, phase) ? | 2 navettes + retour | bloquer |
| Q-17 | Contenu exact des gaines d'un télérupteur et d'un bouton poussoir ? | fils dans la gaine d'alimentation | bloquer |
| Q-18 | Permutateur (3 points ou plus) : traité comment ? | non géré | bloquer |
| Q-19 | Interrupteur à voyant (neutre) : quand est-il utilisé, quel fil en plus ? | non géré | bloquer |
| Q-20 | Détecteur de présence, variateur, minuterie : câblage ? | non géré | bloquer |

### E. Raccordements et feuille de boîte
| N° | Question | Supposé aujourd'hui | Si doute |
|---|---|---|---|
| Q-21 | Connecteurs : tailles disponibles et choix quand le nombre de fils tombe entre deux tailles ? | 8 pour les tailles intermédiaires | avertir |
| Q-22 | « Ouverture vers le haut » : sens exact ? | non défini | avertir |
| Q-23 | N° de circuit du tableau à afficher à côté de l'alimentation : lequel ? | aucun | avertir |

### F. Tableau
| N° | Question | Supposé aujourd'hui | Si doute |
|---|---|---|---|
| Q-24 | ID 40 A partout ? parafoudre, contacteur heures creuses, délesteur : par défaut dans le coffret ou fournis à part ? | non | avertir |
| Q-25 | Hauteur du haut du tableau (1,80 m supposé) ? | 1,80 m | avertir |

### G. Portée des règles
| N° | Question | Supposé aujourd'hui | Si doute |
|---|---|---|---|
| Q-26 | Une règle peut-elle changer selon le pavillonneur ou le chantier (ex. norme, section) ? Lesquelles ? | Oui : règles communes à tous les pavillonneurs (Kévin, 15:55) | répondue |
| Q-27 | Que doit faire le logiciel s'il n'y a aucune solution (trop de départs, gaine trop pleine) : s'arrêter, ajouter une boîte, ou te demander ? | te demander | bloquer |
| Q-28 | Qui valide une règle nouvelle : toi seul ? | toi seul | — |

### H. Boîtes — questions du 27/10/2026 (focus actuel)
| N° | Question | Réponse / supposé | Statut |
|---|---|---|---|
| Q-29 | Une boîte peut-elle desservir plusieurs pièces et plusieurs niveaux ? | Oui, oui (R-005) | répondue |
| Q-30 | Une boîte peut-elle mélanger éclairage et prises ? | Oui (R-006) | répondue |
| Q-31 | Un même circuit peut-il passer par deux boîtes ? | Non (R-007) | répondue |
| Q-32 | Une boîte peut-elle en alimenter une autre ? | Seulement dans un chantier spécifique : mode Plug de pieuvre (R-008, R-009) | répondue |
| Q-33 | Quels appareils vont toujours en ligne directe ? (VMC, volets, chauffe-eau, sonnette ?) | Spécialisés, sorties de câble, RJ45, TV, tout le courant faible et la sonnette en ligne directe (R-003) | répondue |
| Q-34 | Courant fort et courant faible dans la même boîte ou la même gaine ? | Jamais dans la même boîte ni la même gaine ; le courant faible est toujours en ligne directe (R-003) | répondue |
| Q-35 | Quels appareils n'ont pas le droit de partager une gaine ? | Jamais dans une gaine partagée (R-089) | répondue |
| Q-36 | Face pleine (6 gaines) : passer sur la face voisine ? | Oui, sur la face voisine, sans avertissement (R-088) | répondue |
| Q-37 | Deux gaines vers le même appareil, ou un appareil sur deux gaines ? | Jamais, sauf une gaine à deux circuits pour deux appareils au même endroit (R-089) | répondue |
| Q-38 | Nombre maximum de fils par connecteur ; 1,5 et 2,5 mélangés ? | Pas de maximum (ponts possibles, sans effet sur circuits ni boîtes) ; jamais de sections différentes dans une borne (R-092) | répondue |
| Q-39 | Une phase peut-elle être raccordée avec la phase d'un autre circuit ? | Jamais de phase ni de neutre partagés ; terres oui (R-090) | répondue |
| Q-40 | Autres liaisons interdites que tu connais déjà ? | Va-et-vient jamais coupé, salle de bain jamais sur cuisine, pas de boîte à boîte sauf Plug (R-091) | répondue |
| Q-41 | Plug de pieuvre : comment les boîtes sont-elles reliées entre elles (gaine, connecteur enfichable) ? | Gaine ou connecteur, les deux à choisir dans le chantier (R-009) | répondue |
| Q-42 | Plug de pieuvre : quelle boîte alimente laquelle, et combien de boîtes en chaîne au maximum ? | La boîte 2 est alimentée par la boîte 1 ; le reste est à déduire du chantier que Kévin transmettra | partielle, en attente du chantier |
| Q-43 | Plug de pieuvre : quels circuits passent d'une boîte à l'autre (R-007 ne s'applique-t-elle plus) ? | Au choix : circuit réparti sur plusieurs boîtes ou limité à une boîte (R-009) | répondue |
| Q-44 | Plug de pieuvre : quel chantier ou pavillonneur, et choisi à la main dans le chantier ? | choisi à la main ; Kévin transmettra un chantier de ce type | en attente du chantier |

### I. Questions issues de la bande DUCOURNEAU (27/10/2026)
| N° | Question | Ma lecture | Statut |
|---|---|---|---|
| Q-45 | Numérotation des raccordements : FTZ ou ta règle (R-031, terres en premier) ? | Sa règle R-031 ; FTZ écarté (R-076 archivée) | répondue |
| Q-46 | Couleurs des navettes et retours (voir R-072) | « Je ne comprends pas la question » | répondue (voir Q-58) |
| Q-47 | Pourquoi un bleu à I1 et I2, et du câble 3G1,5 pour L1, L1A, L2, L2A ? | Bleu à l'interrupteur si voyant ou domotique (R-083) | répondue en partie (reste Q-56) |
| Q-48 | Terre de l'alimentation de la plus forte section ? EQ1 / EQ2 : quelles pièces ? | EQ1 / EQ2 : salle de bain (R-080) | répondue en partie (reste Q-57) |
| Q-49 | Capacité d'ICTA 20 et au-delà (ICTA 25, deux gaines) ? | « Je ne sais pas, je me renseigne » ; addition des sections et place dans la gaine, même ratio pour 16 et 20 (R-074) | répondue provisoirement : Kévin garde le même ratio, ICTA 20 = 13,5 mm² (R-074), à ajuster si Kévin trouve la valeur exacte |
| Q-50 | 18 départs sans l'alimentation ? 6 par face en la comptant ? | Règle non fixée chez eux : on garde celle de Claude (R-001) | répondue |
| Q-51 | Volets roulants : boîte à part, maximum, commande filaire ? | Option du chantier : boîte à part ou mélangés ; pas de maximum sauf norme NF (R-079) | répondue (reste Q-61) |
| Q-52 | Numérotation des gaines strictement dans le sens horaire ? | Oui, strictement (R-077) | répondue |
| Q-53 | Un seul circuit éclairage et un seul circuit prises par boîte ? | Oui | répondue (reste Q-59) |
| Q-54 | Repère de circuit au tableau (numéro encadré) ? | Oui, déjà sur les boîtes de l'appli (R-081) | répondue |
| Q-55 | Appareils inconnus du logiciel : tableau de la section J. | Propositions acceptées (R-084) | répondue |
| Q-56 | Pourquoi L1, L1A, L2, L2A sont-elles en câble 3G1,5 ? | Oui : éclairage extérieur (R-014) | répondue |
| Q-57 | Terre de l'alimentation toujours de la plus forte section des fils de la gaine ? | Oui (R-075) | répondue |
| Q-58 | Retours et navettes : quelle liste de couleurs, dans quel ordre (Q-46 reformulée) ? | Adapter la ronde de Kévin avec celle de FTZ, sans copier : faire mieux et plus intelligent (R-072 réécrite) | répondue |
| Q-59 | Plus de 8 prises dans une boîte : autre boîte ? | Oui, ou 2e circuit prises dans l'alimentation ; réglable selon le mode de pieuvre (R-085) | répondue |
| Q-60 | Hotte : en boîte ou en ligne directe, « ça dépend » de quoi ? | Choix du client ou du BE (R-086) | répondue |
| Q-61 | Volets roulants : valeur NF C 15-100 à retenir ? | Recherchée par Claude (R-087) : pas de nombre de moteurs, limite par intensité | répondue |
| Q-62 | Quelles couleurs pour la paire d'un 2e circuit prises dans une même boîte (et d'un 2e circuit éclairage) ? | En 2,5 : B + R + V/J ; en 1,5 : BF + R + V/J ; les couleurs ne changent pas (R-085) | répondue (corrigée par Q-64) |
| Q-64 | Confirmer : 2e circuit en 1,5 = phase rouge + neutre bleu foncé, y compris pour un 2e circuit d'éclairage, distingué par la bague. Ce mélange (phase de l'éclairage, neutre des prises) te va ? | Non : rouge 1,5 = phase des circuits lumières, gris = phase des circuits prises, pour éviter les erreurs de câblage, quel que soit le nombre de circuits dans la boîte. 2e circuit prises 1,5 = gris + BF + V/J (R-020, R-021, R-085) | répondue |
| Q-63 | Intensité à retenir par moteur de volet roulant (donnée fabricant, par modèle) ? | 50 W par moteur (Kévin, 12:46) ; 46 moteurs sous 10 A, 73 sous 16 A (R-087) | répondue |

Questions du registre éclairées par la bande :
- Q-12 (3e paire de couleurs) : le circuit volets roulants utilise gris / bleu clair.
- Q-16 (contenu d'un va-et-vient) : R-071.
- Q-23 (n° de circuit au tableau) : R-081.
- Q-33 (lignes directes) : R-082 ; les volets roulants vont en boîte dédiée (R-079).
- Q-34 (courant faible) : TV, antenne et RJ45 sont toujours en ligne directe, en gaine ICTA_V20.
- Q-39 (phases de deux circuits) : jamais raccordées entre elles.
- Q-17 (télérupteur), Q-18 (permutateur), Q-19 (voyant), Q-38 (connecteurs) : rien dans cette bande.

### J. Appareils absents du logiciel (bande DUCOURNEAU)
| Repère FTZ | Appareil | Raccordement vu | Ma proposition |
|---|---|---|---|
| C1 à C4 | Convecteur à fil pilote | Ligne directe ICTA 16, 1,5 : B + N (IV pour C4) + M + V/J | Nouveau type « Radiateur » |
| SS1 | Sèche-serviette | Ligne directe, 1,5 BF + M + V/J | Nouveau type |
| VMC1, C VMC1 | Caisson VMC, commande VMC | 1,5 R + B + V/J ; 1,5 GR + N | Nouveaux types (la bouche VMC existe) |
| FOUR1, LL1, LV1, SL1 | Four, lave-linge, lave-vaisselle, sèche-linge | Ligne directe ICTA 16, 2,5 B + R + V/J | Prise spécialisée avec nom |
| PLAQUES1 | Plaque de cuisson | ICTA 20, 6 mm² R + B + V/J | Spécialisée 6 mm² |
| CETH1 | Chauffe-eau thermodynamique | ICTA 20, 3G2,5 | Sortie de câble 3G2,5 |
| G EXT1, PC EXT1, PC EXT2 | Prise garage extérieure, prises extérieures | ICTA 20, 3G2,5 | Sortie de câble ou prise extérieure |
| INTERCO1, INTERCO2 | Interphones | ICTA 20, 4G1,5 ; 7G1,5 | Nouveau type |
| ANT1, TV1, TV2 | Antenne, prises TV | ICTA_V20, câble 17 VATC | Nouveau type courant faible |
| RJ1 à RJ5 | RJ45 | ICTA_V20, câble grade 3 TV | Existe (préciser le câble) |
| EQ3 ; EQ1, EQ2 | Équipotentielle principale ; locale | 10 mm² ICTA 20 ; 2,5 V/J en boîte | Nouveaux types |
| HOTTE1 | Hotte | Circuit cuisine 2,5, en boîte | Prise cuisine |
| VR1 à VR6 | Moteur de volet roulant | Boîte dédiée, GR / B / V/J | Nouveau type « Volet roulant » |
| AIG2 | Gaine aiguillée Ø40 | 1,2 m | Gaine vide en attente, appareil à poser (R-097) |

Décisions de Kévin du 27/10/2026 : toutes les propositions acceptées (R-084). Chauffe-eau, prises extérieures et interphones : câble ou fils modifiable. TV et antenne : gaine verte Ø20. Hotte : en boîte ou en ligne directe selon le cas (Q-60). Volet roulant : selon l'option du chantier (R-079). Reste « à préciser » : AIG2 (gaine aiguillée Ø40).

---

### K. Plan et tableau DUCOURNEAU : constats (27/10/2026)
Source : fichier « AF26075150 DUCOURNEAU – Plans KITEOHM » (5 pages : plan courant fort, plan courant faible, tableau, schéma unifilaire). Client : IMMO CONSTRUCTION ; dessin : mlaurent ; plan KiTéOHM du 16/10/2026.

**Constats**
- 5 boîtes : LI01 (cuisine), LI02 (séjour), LI03 (chambre 2, SDB, WC), LI04 (chambres 1 et 3), LI05 (volets roulants et VMC, 6 moteurs VR1 à VR6). LI05 est une boîte à part (option de R-079).
- Circuit volets `LI05 VR` : 10 A, 1,5 mm². Cela confirme le calibre par défaut de 10 A (R-087) ; 6 moteurs de 50 W = 300 W, très en dessous de la limite.
- Éclairage 10 A en 1,5 mm² ; prises 16 A en 1,5 mm² (R-020, R-021 confirmés). Cuisine : prises en 2,5 mm² (3e circuit de LI01).
- Spécialisés : four 20 A 2,5 ; lave-vaisselle 20 A 2,5 ; plaque 32 A 6 mm² ; chauffe-eau thermodynamique 20 A 2,5 ; lave-linge 20 A 2,5 ; sèche-linge 20 A 2,5 ; VMC 2 A 1,5 ; prises extérieures 16 A 2,5 (courbe D pour G EXT) ; sèche-serviette 10 A 1,5.
- Différentiels : trois de 63 A 30 mA (deux de type AC, un de type A). **R-050 disait 40 A : c'est 63 A ici.** Un parafoudre, deux prises 16 A dans le coffret et un circuit TYWELL PRO (2 A) sont présents.
- **Un même disjoncteur éclairage 10 A regroupe les éclairages de LI01 et LI02** (repères 1 et 4) : plus de circuits repérés que de disjoncteurs.
- Deux convecteurs partagent un disjoncteur 16 A 1,5 (C1 + C2, C3 + C4).

| N° | Question | Ma lecture | Statut |
|---|---|---|---|
| Q-65 | Un disjoncteur d'éclairage peut-il regrouper les éclairages de deux boîtes (LI01 + LI02) ? Dans quel cas ? | Oui, sous une limite de points ou de puissance ; le circuit reste repéré par boîte (R-007 intacte) | reportée (tableau, Kévin 13:39) |
| Q-66 | Quels circuits vont sur un différentiel de type A et lesquels sur AC ? Calibre : 63 A ou 40 A ? | Type A : plaque, lave-linge, sèche-linge, et selon le cas four et lave-vaisselle ; 63 A | reportée (tableau, Kévin 13:39) |
| Q-67 | Parafoudre, 2 prises dans le coffret, TYWELL PRO (2 A) : toujours présents, ou selon le chantier ? | Selon le chantier (option) | reportée (tableau, Kévin 13:39) |
| Q-68 | Deux convecteurs sur un même disjoncteur 16 A 1,5 : règle de regroupement (nombre, puissance) ? | Deux convecteurs par disjoncteur, sous la limite de puissance | reportée (tableau, Kévin 13:39) |

### L. Test des règles sur DUCOURNEAU (27/10/2026, 13:50)
Pavillonneur : IMMO CONSTRUCTION (confirmé par Kévin : client et pavillonneur, c'est pareil). Test sur les 5 boîtes de la bande et le plan KiTéOHM.

| Boîte | Gaines (alim. comprise) | Départs | Gaines par face (A / B / C / D) | Circuits repérés |
|---|---|---|---|---|
| LI01 (cuisine) | 16 | 15 | 4 / 5 / 3 / 4 | 1 éclairage, 2 prises, 3 cuisine 2,5 |
| LI02 (séjour) | 13 | 12 | 1 / 3 / 3 / 6 | 4 éclairage, 5 prises |
| LI03 (chambre 2, SDB, WC) | 19 | 18 | 2 / 6 / 5 / 6 | 6 éclairage, 7 prises |
| LI04 (chambres 1 et 3) | 16 | 15 | 5 / 4 / 3 / 4 | 8 éclairage, 9 prises |
| LI05 (volets roulants) | 7 | 6 | 2 / 2 / 1 / 2 | 10 volets |

**Règles qui tiennent**
- R-001 : 6 gaines par face au plus, respecté sur les 5 boîtes (maximum atteint sur LI02 face D, LI03 faces B et D).
- R-074 : sur 71 gaines, le diamètre suit la somme des sections (7,5 mm² ou moins : ICTA 16 ; au-delà : ICTA 20). Cas limites bons : 7,5 mm² en ICTA 16 (LI02.01, LI04.01, LI03.17, hotte) ; 8,5, 9 et 10,5 mm² en ICTA 20 ; maximum vu 13,5 mm² (LI01.01).
- R-021 : 8 prises par circuit au plus ; LI04 atteint exactement 8 (P16, P19 à P25) ; LI03 en a 7, LI02 6, LI01 4 (plus 5 prises de cuisine et la hotte en 2,5 mm²).
- R-022 : cuisine en 2,5 mm² avec 5 prises et la hotte en boîte (R-086).
- R-075 : une seule terre dans l'alimentation, de la plus grande section : 2,5 mm² dans LI01 (cuisine) et LI03 (équipotentielles EQ1 et EQ2 2,5 mm²), 1,5 mm² ailleurs.
- R-081 : circuits repérés de 1 à 10 dans l'ordre des boîtes, éclairage puis prises (cuisine après les prises dans LI01).
- R-079 et R-087 : volets roulants dans une boîte à part, circuit gris / bleu clair, 10 A, 6 moteurs.
- R-082 : les lignes directes de FTZ (28 gaines) correspondent à la liste du journal.

**Écarts constatés**
1. **Départs : 15, 18 et 15 sur LI01, LI03 et LI04, contre 12 dans R-001.** Avec 12 au maximum, le logiciel devrait créer des boîtes en plus (66 départs en tout : 6 boîtes au lieu de 5). Voulu : règle propre à Oktéo (Q-69 répondue).
2. **Numérotation FTZ pas strictement horaire** (LI01 .06 et .07 inversés, LI03 .06 et .10 à .12, LI04 .14 et .15 inversés). R-077 (strictement horaire) est donc plus rigoureuse que FTZ ; c'est voulu.
3. **Couleurs réutilisées par FTZ** : dans LI04, les va-et-vient V10 et V13 ont tous deux marron, marron, orange (fils 11 à 13 et 17 à 19). FTZ n'utilise pas le violet. R-072 (pas de répétition tant qu'une couleur est libre dans la boîte, violet compris) améliore donc le résultat.
4. **Terre des circuits : numéro 9 chez FTZ** ; R-031 (terres en premier, n° 1) est confirmée comme règle propre à Oktéo (R-076 archivée).

| N° | Question | Ma lecture | Statut |
|---|---|---|---|
| Q-69 | Limite de départs par boîte : 12 pour tous les chantiers (6 boîtes pour DUCOURNEAU) ou plus élevée pour IMMO CONSTRUCTION (18, comme LI03) ? | Réglable par pavillonneur (`departs_max`) ; 12 par défaut | répondue : 12 départs est une règle propre à Oktéo, voulue ; DUCOURNEAU aura donc 6 boîtes (R-001) |

### M. Bande FALGUA E6390 (27/10/2026, 14:05)
Source : « BANDE FALGUA E6390 » (10 pages) et « AF26064297 FALGUA E6390 PLAN KITEOHM » (6 pages). Client et pavillonneur : **ALPHA CONSTRUCTIONS** ; dessin : s.tarnaud ; plan du 06/07/2026. C'est un second pavillonneur (le premier : IMMO CONSTRUCTION).

| Boîte | Gaines (alim. comprise) | Départs | Gaines par face (A / B / C / D) | Circuits repérés |
|---|---|---|---|---|
| LI01 (CH1, CH3) | 13 | 12 | 3 / 3 / 4 / 3 | 1 éclairage (avec télérupteur), 2 prises |
| LI02 (SDB, CH2, dégagement) | 12 | 11 | 6 / 3 / 0 / 3 | 3 éclairage, 4 prises |
| LI03 (CH4, WC, SDE, palier) | 20 | 19 | 2 / 6 / 6 / 6 | 5 éclairage, 6 prises |
| LI04 (cuisine) | 13 | 12 | 6 / 4 / 1 / 2 | 7 éclairage (avec télérupteur), 8 cuisine 2,5 |
| LI05 (séjour, hall) | 17 | 16 | 5 / 1 / 6 / 5 | 9 éclairage, 10 prises |
| LI06 (garage) | 12 | 11 | 5 / 1 / 2 / 4 | 11 éclairage (avec télérupteur), 12 prises |
| LI07 (volets) | 5 | 4 | 2 / 1 / 2 / 0 | 13 volets |
| LI08 (volets) | 4 | 3 | 2 / 1 / 1 / 0 | 14 volets |

**Règles confirmées par ce chantier**
- R-001 : 6 gaines par face au plus (maximum atteint trois fois sur LI03).
- R-074 : diamètres conformes sur toutes les gaines contrôlées ; alimentations de 8,5 mm² et plus en ICTA 20, 7,5 mm² en ICTA 16 ; maximum de nouveau 13,5 mm² (LI04.01), ce qui conforte la valeur de l'ICTA 20.
- R-075 : terre unique de la plus grande section dans l'alimentation (2,5 mm² dans LI02, LI03 avec les équipotentielles EQ1 à EQ3 et dans LI04 avec la cuisine).
- R-077 : numérotation strictement horaire à partir de l'alimentation, ici sans écart (FTZ la respecte sur ce chantier).
- R-081 : circuits repérés de 1 à 14 dans l'ordre des boîtes, éclairage puis prises.
- R-022 et R-086 : cuisine en 2,5 mm² (R 7, B 8), 6 prises (P31, P31A, P33, P34, P36, P36A) et la hotte dans la boîte LI04.
- R-079 et R-087 : volets roulants en boîtes à part, GR 11 / B 12 / V/J 9 (gris / bleu clair), un circuit par boîte.
- R-014 : applique extérieure en gaine ICTA 16 avec câble 3G1,5 (L1, L3, L3A).
- R-040 : repères d'allumage avec lettre (BP4, BP4A, BP4B ; BP18, BP18A, BP18B).

**Nouveautés**
1. **Télérupteur et boutons poussoirs** (LI01, LI04, LI06). Gaine d'un bouton poussoir : R 1 + V 12 (violet) + B 2. L'alimentation de la boîte porte V 12 (commande) et O 11 (retour), qui vont au télérupteur du tableau (R-010). Les lumières commandées reçoivent O 11 (L4 : V/J 9, O 11, B 2). Un bouton poussoir et un interrupteur peuvent partager une plaque (I17 + BP18A : R, B, IV 14, V 12).
2. **Violet** : FTZ l'utilise pour la commande du télérupteur (V 12) et aussi pour une navette de va-et-vient (V 15 dans LI05). Il est donc dans la ronde de R-072, comme chez nous.
3. **Volets roulants en deux boîtes** : 7 moteurs répartis entre LI07 (VR2 à VR5) et LI08 (VR1, VR6, VR7), chaque boîte avec son circuit (13 et 14).
4. **Mots « BOUCHON »** sur les gaines à câble 3G1,5 de LI04 et LI05, et « +BOUCHONS » sur LI06.
5. **Neutre à l'interrupteur dans tous les allumages** (B 2 dans chaque gaine d'interrupteur), conforme à R-083 si tous les interrupteurs sont lumineux.
6. **Chauffage par pompe à chaleur (Aqua Air)** : pas de convecteurs, mais des sèche-serviettes SS1 et SS2, des bouches de diffusion K1 à K6 et un module AQUA AIR.
7. **Lignes directes** (30 gaines) : RJ1 à RJ6 en ICTA 16 (et non ICTA_V20 vert comme chez IMMO CONSTRUCTION) ; câbles YSYT 2×1 souple sans ICTA pour K1 à K6.

**Appareils absents du logiciel (compléments de la section J)**
| Repère FTZ | Appareil | Raccordement vu | Ma proposition |
|---|---|---|---|
| AQUA AIR1, AQUA AIR11 | Module intérieur pompe à chaleur | ICTA 20 3G2,5 ; ICTA 16 3×1,5 | Deux types : alimentation et pilotage |
| K1 à K6 | Bouche de diffusion motorisée | YSYT 2×1 souple, sans gaine | Type courant faible, câble souple |
| MOTEUR1 | Moteur de garage | ICTA 16, 1,5 GR + BF + V/J | Type moteur, ligne directe |
| SS2 | Second sèche-serviette | idem SS1 | Type existant dans la section J |
| G EXT11 | Prise extérieure pilotée | ICTA 20, 4G1,5 | Sortie de câble 4G1,5 |
| EQ4 | Équipotentielle principale | ICTA 20, 10 mm² V/J | Type de la section J |
| PC EXT3 | Prise extérieure | ICTA 20, 3G2,5 | Type de la section J |

| N° | Question | Ma lecture | Statut |
|---|---|---|---|
| Q-70 | Télérupteur : confirmes-tu que la gaine du bouton poussoir porte phase + commande + neutre, que commande et retour utilisent chacun une couleur de la ronde, et que les lumières commandées prennent la couleur du retour ? | Oui ; neutre au bouton poussoir seulement si voyant ou domotique (R-093) | répondue |
| Q-71 | Volets roulants : quand le logiciel crée-t-il deux boîtes de volets (ici 4 et 3 moteurs) : par zone, ou à partir d'un nombre de moteurs ? | Selon le mode de pieuvre : Proximité = le plus économique ; Équilibrée = une seule boîte (R-094) | répondue |
| Q-72 | « BOUCHON » sur une gaine à câble 3G1,5 : à quoi sert-il et que doit-on écrire sur le plan ? | Petit bouchon obligatoire dans la boîte contre l'air extérieur (R-095, rectifié à 14:07) | répondue |
| Q-73 | RJ45 : gaine verte Ø20 (R-084) pour tous les pavillonneurs, ou ICTA 16 pour ALPHA CONSTRUCTIONS ? | ICTA 20V (verte Ø20) partout ; ICTA 16 des anciens chantiers abandonné (R-084) | répondue |
| Q-74 | Aqua Air et K1 à K6 : acceptes-tu mes propositions de types (tableau ci-dessus) ? | Oui, types acceptés (R-084 étendue) | répondue |

### N. Bande BATELIER JEAN LOUIS L51S078C (27/10/2026, 14:25)
Source : « AF26064644 BATELIER JEAN LOUIS L51S078C – BANDES » (9 pages) et « Plans KITEOHM » (7 pages). Client et pavillonneur : **MAISONS LARA** ; dessin : mlaurent ; plans du 07/10/2026. Troisième pavillonneur après IMMO CONSTRUCTION et ALPHA CONSTRUCTIONS.

| Boîte | Gaines (alim. comprise) | Départs | Gaines par face (A / B / C / D) | Circuits repérés |
|---|---|---|---|---|
| LI01 (séjour, cuisine) | 19 | 18 | 6 / 6 / 3 / 4 | 1 éclairage, 2 prises, 3 cuisine 2,5 |
| LI02 (garage, zone jour) | 17 | 16 | 2 / 6 / 5 / 4 | 4 éclairage (télérupteur), 5 prises |
| LI03 (CH3) | 8 | 7 | 0 / 2 / 2 / 4 | 6 éclairage, 7 prises |
| LI04 (CH1) | 11 | 10 | 3 / 2 / 4 / 2 | 8 éclairage, 9 prises |
| LI05 (CH2) | 10 | 9 | 3 / 1 / 3 / 3 | 10 éclairage, 11 prises |
| LI06 (SDB) | 10 | 9 | 0 / 3 / 3 / 4 | 12 éclairage, 13 prises |
| LI07 (volets) | 9 | 8 | 3 / 2 / 1 / 3 | 14 volets |

**Règles confirmées de nouveau**
- R-001 : jamais plus de 6 gaines par face ; LI01 en a 6 sur deux faces, LI02 en a 6 sur une face. Départs de 7 à 18 : la règle des 12 départs reste propre à Oktéo (Q-69).
- R-074 : toutes les gaines contrôlées suivent la somme des sections. Cas limites : 9 fils de 1,5 mm² (13,5 mm²) en ICTA 20 sur LI02.14 ; 7,5 mm² en ICTA 16 sur la hotte, LI04.05, LI06.04, VR4. Maximum de 13,5 mm² atteint une troisième fois : capacité de l'ICTA 20 confirmée à 13,5 mm².
- R-075 : terre unique de la plus grande section : 2,5 mm² dans LI01 (cuisine) et LI06 (équipotentielle EQ1), 1,5 mm² dans les autres.
- R-021 : prises de 5 à 6 par circuit, jamais plus de 8. R-022 : cuisine en 2,5 mm² avec 4 prises (P1 à P4) et la hotte dans la boîte (R-086).
- R-081 : circuits repérés de 1 à 14, éclairage puis prises.
- R-093 (télérupteur) : BP5, BP5A, BP5B avec V 12 + O 11 dans l'alimentation de LI02. **Les gaines de BP5A et BP5B n'ont que la phase et la commande (R 1 + V 12), sans neutre** : le neutre n'est donc bien présent que pour un bouton à voyant ou domotique, comme chez ALPHA CONSTRUCTIONS où il y était.
- R-084 : RJ1 à RJ8 en ICTA_V20 vert : c'est la nouvelle règle (chantier du 07/10/2026).
- Les règles de câblage ne changent pas d'un pavillonneur à l'autre sur ces trois chantiers.

**Nouveautés**
1. **Commande filaire de volet roulant (CVR3, CVR4, CVR5)** : la gaine du CVR porte gris + bleu clair (alimentation) + marron + noir (commande) ; la gaine du moteur VR correspondant porte les mêmes marron et noir avec ses gris, bleu clair et V/J. Chaque couple a ses numéros (11 et 12, 13 et 14, 15 et 16). VR1 et VR2 n'ont pas de commande filaire : micromodule connecté TYXIA 5630 (légende du plan).
2. **Velux motorisé (VEL1)** : gaine gris + bleu clair + V/J dans la boîte des volets.
3. **Moteur de garage (MOTEUR1)** : ligne directe ICTA 16, 1,5 GR + BF + V/J (déjà vu sur FALGUA).
4. **Aqua Air** : à nouveau pompe à chaleur avec K1 à K5 en YSYT 2×1 souple et AQUA AIR1 en 3G2,5 (déjà vu sur FALGUA).
5. Les volets sont tous dans une seule boîte (LI07), comme R-094 le prévoit pour le mode équilibré.

| N° | Question | Ma lecture | Statut |
|---|---|---|---|
| Q-75 | Commande filaire de volet (CVR) : le logiciel doit-il distinguer un volet « filaire » (CVR : alimentation + marron + noir) d'un volet « connecté » (micromodule, gris + bleu clair + V/J seulement) ? Qui décide : le plan, ou un choix par volet ? | Oui, choix par volet sur le plan (R-096) | répondue |
| Q-76 | Velux motorisé (VEL1) et moteur de garage (MOTEUR1) : acceptes-tu de les créer comme types (Velux = comme un volet roulant dans la boîte des volets ; moteur de garage = ligne directe 1,5 GR + BF + V/J) ? | Oui | répondue : types acceptés (R-084 étendue) |

### O. Bande FONTES D2129 MAISON 1 « plan expé pieuvre » (27/10/2026, 14:35)
Source : « Bande AF25124651 FONTES D2 » (6 pages) et « AF25124651 FONTES D2129 MAISON 1 PLAN EXPE PIEUVRE » (5 pages : plans courant fort et faible, notes de modification, électricité cuisine Est et Ouest). Client : **POLYGONE 46** (quatrième client) ; B.E : NC ; bande du 23/09/2026. Quatre boîtes, aucun lien de boîte à boîte (pas de plug). Chaque boîte porte en plus, sous son nom, la **longueur totale de ses gaines** (LI01 68,70 m, LI02 46,50 m, LI03 98,80 m, LI04 29,90 m : 243,90 m au total). J'ai recalculé LI01 et LI04 en additionnant leurs gaines : les chiffres sont exacts.

| Boîte | Gaines (alim. comprise) | Départs | Gaines par face (A / B / C / D) | Circuits repérés | Longueur totale |
|---|---|---|---|---|---|
| LI01 (CH4, entrée) | 13 | 12 | 4 / 1 / 6 / 2 | 1 éclairage, 2 prises | 68,70 m |
| LI02 (SDE) | 11 | 10 | 1 / 5 / 4 / 1 | 3 éclairage, 4 prises | 46,50 m |
| LI03 (cuisine, séjour, CH3) | 18 | 17 | 5 / 6 / 3 / 4 | 5 éclairage, 6 prises, 7 cuisine 2,5 | 98,80 m |
| LI04 (volets) | 5 | 4 | 2 / 0 / 2 / 1 | 8 volets | 29,90 m |

**Règles confirmées de nouveau**
- R-001 : jamais plus de 6 gaines par face (LI01 face C, LI03 face B). LI01 a exactement 12 départs.
- R-074 : alimentations de 7,5 mm² en ICTA 16 (LI01.01), 8,5 mm² en ICTA 20 (LI02.01), 13,5 mm² en ICTA 20 (LI03.01) ; la gaine LI03.11 (3 va-et-vient et un simple : 9 fils de 1,5 mm², soit 13,5 mm²) tient en ICTA 20. Maximum de 13,5 mm² pour la quatrième fois.
- R-075 : terre unique de 2,5 mm² dans LI02 (EQ1, EQ2) et LI03 (cuisine), 1,5 mm² dans LI01.
- R-081 : circuits repérés de 1 à 8 dans l'ordre des boîtes.
- R-072 : trois va-et-vient dans une même gaine (V10, V8, V9) ont chacun sa couleur de navette (marron, ivoire, violet) et l'interrupteur simple son noir.
- R-073 : une gaine peut mêler une prise de cuisine (2,5 mm²) et un interrupteur (LI03.10 : I11 + P15), car R-089 n'interdit le partage que pour les spécialisés.
- R-086 : hotte dans la boîte (LI03.03), cuisine à 6 prises ou moins. R-094 : volets roulants dans une seule boîte (LI04).
- R-084 : RJ1 à RJ4, antenne et prises TV en gaine verte Ø20.

**Écarts**
- La numérotation FTZ n'est pas strictement horaire sur LI02 (gaine .06 placée après .08), alors que R-077 l'est.

**Nouveautés**
1. **Longueur totale de la boîte** : somme des gaines de la boîte, imprimée sous son nom (la bande de DUCOURNEAU, FALGUA et BATELIER ne l'avait pas).
2. **« I COUPURE »** : interrupteur de coupure en ligne directe ICTA 16, 1,5 mm² R + N.
3. **CLIM** : unité de climatisation en 4G1,5, ICTA 20. **G EXT** : 3G1,5 en ICTA 16 sur ce chantier (3G2,5 ICTA 20 ailleurs).
4. **Convecteurs C1 et C2** (1,5 B + N + M + V/J) et **sèche-serviette SS1** : types de la section J.

| N° | Question | Ma lecture | Statut |
|---|---|---|---|
| Q-77 | « Plan expé pieuvre » : que compare cette expérimentation (mode de pieuvre, longueur totale de gaine par boîte) ? Les longueurs par boîte sont-elles le « score » des alternatives dans l'étude (arbre d'étude, section 3 ter) ? | Oui : le score d'un mode est la longueur totale de gaine, avec le nombre de boîtes et de départs | répondue : critère confirmé par Kévin (15:55) : longueur totale de gaine, puis nombre de boîtes, puis départs |
| Q-78 | Valides-tu les nouveaux types : interrupteur de coupure (ligne directe 1,5 R + N), climatisation (4G1,5 ICTA 20), et G EXT en 3G1,5 ICTA 16 ou 3G2,5 ICTA 20 selon le chantier ? | Oui ; G EXT selon le choix du chantier | répondue : types acceptés (R-084 étendue) |

### P. Questions issues du développement (mise à jour 52, 27/10/2026)
| N° | Question | Supposé aujourd'hui | Statut |
|---|---|---|---|
| Q-79 | Plaque de cuisson en 6 mm² (3 fils = 18 mm²) : FTZ la met en ICTA 20, au-delà des 13,5 mm² de R-074. Quel diamètre pour les lignes directes de grosse section (6 et 10 mm²) ? | Exception : B + R + V/J 6 mm² en ICTA 20 (R-074) ; 10 mm² : Q-81 | répondue |
| Q-80 | Terres de sections différentes (2,5 de l'alimentation, 1,5 des appareils) sur la borne n° 1 : autorisé (R-092 parle des circuits) ? | Oui : seules les terres se câblent ensemble malgré leur section (R-092) | répondue |
| Q-81 | Ligne B + R + V/J en 10 mm² (3 × 10 mm²) : ICTA 25 (même tolérance que la plaque 6 mm² en ICTA 20) ou ICTA 32 (règle du tiers de la section de la gaine) ? | ICTA 25 (Kévin, 15:52) | répondue |
| Q-82 | Volets roulants : les bandes FTZ ont une phase grise (GR 11) et un neutre bleu clair (B 12). Or R-021 dit « le gris est la phase des prises, et uniquement d'elles ». Le gris des volets est-il une exception voulue ? | Oui : volets en bleu clair + gris + vert/jaune, validé ; R-021 modifiée | répondue |
| Q-83 | Radiateurs à fil pilote : FTZ met le fil pilote en noir (C1 à C3) et en ivoire (C4) sur DUCOURNEAU. Une couleur par zone de chauffage, ou une seule couleur ? | Peut-être une couleur par zone de chauffage (Kévin, pas sûr) ; noir pour tous en attendant, à vérifier | en attente (collègue qualifié) |
| Q-84 | Calibres non relevés sur les tableaux : moteur de garage, climatisation, prise extérieure 4G1,5, G EXT (16 A supposé). Quels calibres ? | 16 A, à vérifier | en attente (collègue qualifié) |
| Q-85 | Module Aqua Air : la bande MAILLARD du BE n'a qu'une ligne directe (alimentation 3G2,5 ICTA 20) ; R-084 (Q-74) ajoute une ligne de pilotage 3×1,5 ICTA 16. Une ligne ou deux ? | Deux lignes (R-084), à vérifier | en attente (Thibault) |
| Q-86 | Mise à jour 62 (Kévin, 28/10/2026, 08:45 : « économique, c'est le moins de cuivre ») : le critère Q-77 « plus petite longueur totale de gaine, puis boîtes, puis départs » devient-il « le moins de cuivre (longueur de chaque gaine × nombre de fils), dans la limite d'une belle pieuvre » ? Proposition de note « belle pieuvre » commune à tous les modes : aucun croisement de gaines dans une même boîte (obligatoire), pas d'appareil d'une boîte au milieu de ceux d'une autre, cuivre, gaine, nombre de boîtes (une boîte de plus vaut 25 m de fil, réglable), départs équilibrés, gaines de plus de 12 m, pièces par boîte | Mode Économique = le moins de cuivre (avec le coût d'une boîte) ; l'étude garde le rang Q-77 et affiche la note à côté | ouverte (proposée par Claude) |
| Q-87 | Volets roulants selon le mode (R-094) : en Par pièce, chaque volet dans la boîte de sa pièce ? En Équilibrée, deux boîtes de volets quand les volets sont aux deux bouts de la maison (plus de 14 m entre les extrêmes et 40 % de gaine en moins) ? | Oui aux deux (MAILLARD reste à une boîte de volets, comme le BE) | ouverte (proposée par Claude) |
| Q-88 | Mode « Par zone » (demandé par Kévin le 28/10/2026, 08:46 ; le BE ne le fait pas) : zones d'après le nom des pièces — nuit (chambres, salles de bains, salle d'eau, dressing), jour (séjour, pièce de vie, cuisine, salle à manger, entrée, bureau), garage (garage, cellier, buanderie, atelier, local technique) ; WC, dégagements et noms inconnus prennent la zone de leurs voisines ; une boîte par zone, plus si la zone dépasse la capacité ; une zone de moins de 3 départs rejoint la plus proche ; volets dans la boîte de leur zone. Ces regroupements conviennent-ils (bureau en jour, cellier avec le garage) ? | Oui (supposé) | ouverte (proposée par Claude) |

### Q. Tableau électrique — recherche NF C 15-100:2024 (29/10/2026)
| N° | Question | Supposé aujourd'hui | Statut |
|---|---|---|---|
| Q-89 | Les projets sont-ils tous engagés (permis ou marché) après le 31/08/2025, donc en série NF C 15-100:2024 ? | Série 2024 par défaut ; 2002+A5 seulement si l'utilisateur coche « projet antérieur » | ouverte |
| Q-90 | Valides-tu qu'aucune règle ne passe en `confirmee` tant que tu n'as pas vérifié dans la norme NF C 15-100-10 papier ou dans L'Officiel de l'Électricité ? | Toutes les règles en `supposee` ou `inconnue` | ouverte |
| Q-91 | La cuisine (hors zone au-dessus ou au-dessous d'un point d'eau) est-elle acceptée pour la GTL chez tes pavillonneurs ? | Cuisine refusée (lecture prudente, Legrand) | ouverte |
| Q-92 | En logement accessible, quelle hauteur basse retenir pour les manettes : 0,75 m ou 0,90 m ? | Plage 0,90–1,30 m | ouverte |
| Q-93 | Les coffrets ont-ils une porte (rangée basse admise dès 0,50 m) ou non (0,90 m) ? | Sans porte, 0,90 m | ouverte |
| Q-94 | Quelle marque et quelle gamme de tableau (Legrand Drivia, Schneider Resi9, Hager…) pour fixer la largeur réelle des ID, du parafoudre, du contacteur et du délesteur ? | ID = 2 modules, disjoncteur = 1, parafoudre = 2, contacteur = 1, délesteur = 2 | ouverte |
| Q-95 | Gardez-vous 8 circuits par ID ou une limite maison plus basse (6 ou 7) pour garder de la marge ? | 8 | ouverte |
| Q-96 | Coffret de 13 ou de 18 modules par rangée ? Accepte-t-on un tableau de 4 rangées ? | 13 modules, rangées calculées | ouverte |
| Q-97 | Calibre des ID par défaut : 40 A partout sauf rangée chauffage/IRVE en 63 A, ou calcul systématique (R-124) ? | Calcul R-124, puis arrondi à 40 ou 63 A | ouverte |
| Q-98 | Le congélateur et le réfrigérateur ont-ils un ID dédié à immunité renforcée (option recommandée) ? | Proposé, non imposé | ouverte |
| Q-99 | Combien de moteurs de volets au plus par circuit chez vous (aucune limite officielle trouvée) ? Un circuit volets par niveau ? | 2 circuits, un par niveau, sans limite de moteurs | ouverte |
| Q-100 | Chauffage : convecteurs, PAC air/eau, plancher électrique ou poêle ? Puissance par pièce disponible ? | Circuits en 20 A par tranche de 4 500 W si électrique | ouverte |
| Q-101 | PAC ou climatisation à variateur : ID type F imposé ou seulement proposé ? | Proposé | ouverte |
| Q-102 | IRVE : prise renforcée 20 A ou borne 7,4 kW ? Quelle notice (calibre 32 ou 40 A, section 6 ou 10 mm², détection 6 mA intégrée) ? | Prise renforcée 2,5 mm² / 20 A sous ID A dédié ; borne = `inconnue` | ouverte |
| Q-103 | Le parafoudre est-il systématique chez vos clients (même hors cas obligatoires) ? Les communes sont-elles en zone AQ2, avec un branchement aérien ? | Parafoudre seulement si R-150 ; proposé sinon | ouverte |
| Q-104 | Contacteur heures creuses systématique pour le chauffe-eau, ou chauffe-eau thermodynamique piloté autrement ? | Contacteur HC + disjoncteur de commande 2 A si chauffe-eau électrique | ouverte |
| Q-105 | Délesteur ou gestionnaire d'énergie : jamais, toujours avec chauffage électrique, ou dès qu'une borne est prévue ? | Proposé si chauffage électrique ou IRVE, non imposé | ouverte |
| Q-106 | Maison à étage : tableau unique au rez-de-chaussée, ou divisionnaire à l'étage ? Si divisionnaire, différentiel en tête du divisionnaire ou au départ ? | Tableau unique ; divisionnaire = option ; position du DDR `inconnue` | ouverte |
| Q-107 | Garage attenant avec porte vers le logement : GTL dans le garage acceptée ? Garage séparé : tableau divisionnaire systématique ? | Garage attenant accepté ; garage séparé = divisionnaire + coupure d'urgence | ouverte |
| Q-108 | Disjoncteur de branchement fourni par Enedis en 30/60 A, et quelle puissance souscrite visée (9 ou 12 kVA) ? | 9 kVA, 45 A ; liaison 10 mm² au plus sur 22 m | ouverte |
| Q-109 | Les télérupteurs ou minuteries sont-ils montés au tableau ou remplacés par de la domotique (Wiser, Netatmo) ? | Aucun par défaut, ajout manuel | ouverte |
| Q-110 | Le volume box (240 × 300 × 200 mm) est-il intégré au coffret de communication ou fait-il l'objet d'un compartiment séparé dans la GTL ? | Intégré au coffret de communication | ouverte |

## 6. Prochaine étape

**Questions en suspens (« en attente », collègue plus qualifié)** : certaines questions ne sont pas à la portée de Kévin ; elles restent ouvertes, le logiciel garde la valeur supposée et la marque « à vérifier », sans jamais la reposer comme si elle était tranchée (Q-83, Q-84, Q-85). Q-85 est à poser à **Thibault**, le collègue de Kévin qui prendra la suite.

**Questions encore ouvertes (état au 27/10/2026, 14:30)**
- Q-42, Q-44 : Plug de pieuvre (chaîne de boîtes, chantier concerné), en attente d'un chantier de ce type.
- Q-65 à Q-68 : tableau (regroupement d'éclairages, types de différentiels A et AC, calibre 63 A ou 40 A, parafoudre et prises du coffret, convecteurs par disjoncteur), reportées par Kévin.
- Registre d'origine Q-01 à Q-28 : jamais refermé formellement ; plusieurs sont éclairées par les bandes (Q-12 : volets gris / bleu clair ; Q-16 : R-071 ; Q-23 : R-081) et sont à repasser une à une avec Kévin.

**Suite**
1. Kévin répond aux questions (dans l'ordre qu'il veut) ; chaque réponse devient une règle `confirmee`.
2. Kévin donne des bandes de câblage ; pour chacune on relève les règles qu'elle montre (couleurs, sections, ordre, gaines, repères), on les compare à ce journal, puis on ajoute, corrige ou archive.
3. Quand plus aucun point `bloquer` n'est ouvert, la commande IA « câbler » peut tourner seule.
4. Le développement reprend ce journal et la note « Remarques pour le développement » (fichier séparé).

## 7. Historique des modifications

| N° | Date | Règle | Action | Avant | Après | Motif | Par | Code validé |
|---|---|---|---|---|---|---|---|---|
| H-001 | 27/10/2026 | R-001 à R-060 | Création | — | Statut `a_valider` | Reprise des règles du journal de développement | IA | — |
| H-002 | 27/10/2026 | Journal | Renommé « Journal des règles de câblage » ; ajout de la gestion du doute et du registre de 28 questions | Journal de règles | Journal des règles de câblage | Demande de Kévin : zéro erreur silencieuse | IA | — |
| H-003 | 27/10/2026 | R-005 à R-009 | Création | — | R-005 à R-008 `active` · `confirmee` ; R-009 `brouillon` · `inconnue` | Réponses de Kévin Q-29 à Q-32 ; focus sur le câblage des boîtes ; nouveau mode Plug de pieuvre | IA | — |
| H-004 | 27/10/2026 | R-070 à R-082 | Création | — | `a_valider` · `supposee` | Relecture de la bande DUCOURNEAU (AF26075150) : 13 règles déduites, 7 règles confirmées, questions Q-45 à Q-55, tableau des appareils inconnus | IA | — |
| H-005 | 27/10/2026 | R-001, R-031, R-074, R-076, R-077, R-079 à R-084 | Modification | Voir H-004 | R-001, R-031, R-077, R-081, R-083, R-084 `active` · `confirmee` ; R-076 `archivee` ; R-074, R-079, R-080 précisées ; Q-56 à Q-61 ajoutées | Réponses de Kévin du 27/10/2026 (11:45) aux Q-45 à Q-55 | IA (validée par Kévin) | — |
| H-006 | 27/10/2026 | R-014, R-072, R-075, R-079, R-085 à R-087 | Modification et création | R-072 : constat FTZ | R-072 : ronde Oktéo ; R-014 `confirmee` ; R-085, R-086 `confirmee` ; R-087 `a_valider` ; Q-62 et Q-63 ajoutées | Réponses de Kévin du 27/10/2026 (11:52) ; recherche de la norme NF C 15-100 pour les volets roulants | IA (validée par Kévin) | — |
| H-007 | 27/10/2026 | R-085 | Modification | Couleurs du 2e circuit : Q-62 | Couleurs fixées par la section (2,5 : B + R + V/J ; 1,5 : BF + R + V/J) ; Q-64 ajoutée | Réponse de Kévin du 27/10/2026 (11:56) | IA (validée par Kévin) | — |
| H-008 | 27/10/2026 | R-001 ; journal | Modification et création | R-001 : 18 départs | R-001 : 12 départs ; section 3 bis « Arbre des règles » ; champs `noeud`, `depends_on`, `choix` | Demande de Kévin du 27/10/2026 (12:00) | IA (validée par Kévin) | — |
| H-009 | 27/10/2026 | Journal | Modification et création | Section 3 bis : arbre mêlant règles et chantier | 3 bis : arbre de nos règles (navigation, dépendances, usage) ; 3 ter : arbre d'étude (trace du calcul, états, « où ça coince », statistiques) | Précision de Kévin du 27/10/2026 (12:07) : deux arbres distincts | IA (validée par Kévin) | — |
| H-010 | 27/10/2026 | Journal | Modification | 3 bis : arbre des règles ; 3 ter : arbre d'étude | 3 bis : tableau filtrable + fiche de règle ; 3 ter : bande de 9 étapes, « Où ça coince », « Pourquoi ? », tableau de statistiques ; champs `noeud`, `depends_on`, `choix` conservés | Avis de Claude validé par Kévin le 27/10/2026 (12:30) : l'arbre n'apporte pas de valeur en profondeur | IA (validée par Kévin) | — |
| H-011 | 27/10/2026 | R-020, R-021, R-024, R-074, R-085 | Modification | R-085 : 2e circuit en 1,5 avec phase rouge ; ICTA 20 provisoire | R-020, R-021 `active` · `confirmee` (rouge 1,5 = lumières, gris = prises, jamais mélangés) ; R-085 : 2e circuit prises 1,5 = gris + BF + V/J ; R-024 : exception du 2e circuit ; ICTA 20 = 13,5 mm² retenue ; Q-64 répondue, Q-49 répondue provisoirement | Réponse de Kévin du 27/10/2026 (12:43) | IA (validée par Kévin) | — |
| H-012 | 27/10/2026 | R-087 | Modification | Puissance d'un moteur à renseigner | 50 W par moteur ; 46 moteurs sous 10 A, 73 sous 16 A ; calibre par défaut 10 A ; Q-63 répondue | Réponse de Kévin du 27/10/2026 (12:46) | IA (validée par Kévin) | — |
| H-013 | 27/10/2026 | R-009 | Modification | Plug de pieuvre : définition vide | Liaison gaine ou connecteur (choix) ; circuits répartis ou limités à une boîte (choix) ; restent Q-42 et Q-44, en attente d'un chantier | Réponse de Kévin du 27/10/2026 (12:51) | IA (validée par Kévin) | — |
| H-014 | 27/10/2026 | R-003, R-082 | Modification | R-003 `a_valider` | R-003 `active` · `confirmee` : courant faible et sonnette en ligne directe, courant fort et faible jamais ensemble ; Q-33 et Q-34 répondues | Réponse de Kévin du 27/10/2026 (12:55) | IA (validée par Kévin) | — |
| H-015 | 27/10/2026 | R-088 à R-091 | Création | — | Liaisons possibles et interdites `active` · `confirmee` ; Q-35, Q-36, Q-37, Q-39, Q-40 répondues ; Q-38 à reformuler (répondue ensuite, H-016) | Réponse de Kévin du 27/10/2026 (13:02) | IA (validée par Kévin) | — |
| H-016 | 27/10/2026 | R-092 | Création | — | Bornes : pas de limite de fils, jamais de sections mélangées ; Q-38 répondue | Réponse de Kévin du 27/10/2026 (13:04) | IA (validée par Kévin) | — |
| H-017 | 27/10/2026 | Journal (section K) | Création | — | Constats du plan et du tableau DUCOURNEAU ; Q-65 à Q-68 ; R-050 à corriger (63 A) | Plan transmis par Kévin le 27/10/2026 (13:37) | IA (validée par Kévin) | — |
| H-018 | 27/10/2026 | Q-65 à Q-68 | Modification | `ouverte` | `reportée` : le tableau sera traité plus tard | Décision de Kévin du 27/10/2026 (13:39) | IA (validée par Kévin) | — |
| H-019 | 27/10/2026 | Journal (section L) | Création | — | Test de R-001, R-021, R-022, R-074, R-075, R-077, R-081 sur DUCOURNEAU ; écarts sur le nombre de départs ; Q-69 | Demande de Kévin du 27/10/2026 (13:41) | IA (validée par Kévin) | — |
| H-020 | 27/10/2026 | R-001, Q-69 | Confirmation | 12 départs, écart avec FTZ à vérifier | 12 départs confirmé pour tous les chantiers ; l'écart avec FTZ (15 à 18) est voulu | Réponse de Kévin du 27/10/2026 (13:45) | IA (validée par Kévin) | — |
| H-021 | 27/10/2026 | Journal (section M) | Création | — | Bande FALGUA E6390 (ALPHA CONSTRUCTIONS) : 8 boîtes, télérupteur, volets en 2 boîtes, appareils Aqua Air ; Q-70 à Q-74 | Bande et plan transmis par Kévin le 27/10/2026 (13:47) | IA (validée par Kévin) | — |
| H-022 | 27/10/2026 | R-084, R-093 à R-095 | Création et modification | Q-70 à Q-74 ouvertes | R-093 (télérupteur), R-094 (volets selon le mode de pieuvre), R-095 (bouchon) `active` · `confirmee` ; R-084 étendue (ICTA 20V partout, types Aqua Air) ; Q-70 à Q-74 répondues | Réponses de Kévin du 27/10/2026 (14:06) | IA (validée par Kévin) | — |
| H-023 | 27/10/2026 | R-095 | Modification | Bouchon : option | Bouchon obligatoire pour les gaines qui amènent l'air extérieur | Rectification de Kévin du 27/10/2026 (14:07) | IA (validée par Kévin) | — |
| H-024 | 27/10/2026 | Journal (section N) | Création | — | Bande BATELIER JEAN LOUIS (MAISONS LARA) : 7 boîtes, règles confirmées, CVR et Velux ; Q-75 et Q-76 | Bande et plans transmis par Kévin le 27/10/2026 (14:08) | IA (validée par Kévin) | — |
| H-025 | 27/10/2026 | R-084, R-096 | Création et modification | Q-75, Q-76 ouvertes | R-096 `active` · `confirmee` (volet filaire ou connecté) ; Velux et moteur de garage ajoutés à R-084 ; Q-75, Q-76 répondues | Réponses de Kévin du 27/10/2026 (14:12) | IA (validée par Kévin) | — |
| H-026 | 27/10/2026 | Journal (section O) | Création | — | Bande FONTES D2129 MAISON 1 (POLYGONE 46) : 4 boîtes, longueur totale par boîte, I COUPURE, CLIM ; Q-77 et Q-78 | Bande et plan transmis par Kévin le 27/10/2026 (14:20) | IA (validée par Kévin) | — |
| H-027 | 27/10/2026 | R-084, Q-77, Q-78 | Modification | Q-78 ouverte | Types acceptés (coupure, climatisation, G EXT) ; Q-77 reformulée | Réponse de Kévin du 27/10/2026 (14:21) | IA (validée par Kévin) | — |
| H-028 | 27/10/2026 | Journal | Modification | En-tête et notes obsolètes (limite de 18, « toutes à valider ») | En-tête à jour (52 règles), regroupement par catégorie complété, doublon de R-084 retiré, section 6 mise à jour | Préparation de la passation au développement, demande de Kévin du 27/10/2026 (14:22) | IA (validée par Kévin) | — |
| H-029 | 27/10/2026 | R-075 | Modification | Alimentation avec les numéros FTZ (R 1 / B 2, GR 3 / BF 4, R 7 / B 8, terre 9, GR 11 / B 12) | Couleurs seules ; numérotation selon R-031 (terres n° 1) | Contradiction avec R-031 relevée au développement ; Kévin : « on conserve notre règle » (14:29) | IA (validée par Kévin) | — |
| H-030 | 27/10/2026 | Q-79, Q-80 | Création | — | Deux questions ouvertes | Cas rencontrés en appliquant R-074 et R-092 au câblage (mise à jour 52) | IA | — |
| H-031 | 27/10/2026 | R-074 | Modification | Au-delà de 13,5 mm² : doute | Exception : plaque B + R + V/J 6 mm² en ICTA 20 ; Q-79 répondue, Q-81 ouverte (10 mm²) | Réponse de Kévin du 27/10/2026 (15:50) | IA (validée par Kévin) | — |
| H-032 | 27/10/2026 | R-092 | Modification | Sections jamais mélangées sur une borne | Sauf les terres, raccordées ensemble quelle que soit leur section ; Q-80 répondue | Réponse de Kévin du 27/10/2026 (15:50) | IA (validée par Kévin) | — |
| H-033 | 27/10/2026 | R-074 | Modification | 10 mm² : en attente | Exception : B + R + V/J 10 mm² en ICTA 25 ; Q-81 répondue | Réponse de Kévin du 27/10/2026 (15:52) | IA (validée par Kévin) | — |
| H-034 | 27/10/2026 | R-094, R-097, Q-26, Q-77 | Modification et création | Q-26, Q-77 ouvertes ; AIG2 à préciser | Critère « plus économique » confirmé ; règles communes à tous les pavillonneurs ; R-097 gaine aiguillée en attente | Réponses de Kévin du 27/10/2026 (15:55) | IA (validée par Kévin) | — |
| H-035 | 27/10/2026 | Q-82 à Q-84 | Création | — | Trois questions ouvertes | Cas rencontrés en ajoutant les appareils de R-084 (mise à jour 54) | IA | — |
| H-036 | 27/10/2026 | R-021, R-079, Q-82 à Q-84 | Modification | R-021 : gris = prises seulement ; R-079 à valider | R-021 : gris = phase des prises et des volets (neutre bleu clair pour les volets) ; R-079 confirmée ; Q-83 et Q-84 en attente d'un collègue plus qualifié | Réponse de Kévin du 27/10/2026 (18:39) | IA (validée par Kévin) | — |
| H-037 | 27/10/2026 | R-077 | Modification | Sens horaire depuis l'alimentation | Sens anti-horaire depuis l'alimentation (.01 reste l'alimentation) : numéros lus de gauche à droite sur chaque face | Demande de Kévin du 27/10/2026 (23:19, précisée à 23:21) | IA (validée par Kévin) | — |
| H-038 | 28/10/2026 | R-001 | Modification | 12 départs hors alimentation | 16 départs hors alimentation | Bande MAILLARD du BE (jusqu'à 15 départs), réponse de Kévin du 28/10/2026 (00:01) | IA (validée par Kévin) | — |
| H-039 | 28/10/2026 | R-023, R-084, R-098, R-099, Q-85 | Modification et création | — | Violet confirmé dans la ronde ; types îlot, BPS, sonnette ; R-098 prises de plan de travail ; R-099 total des gaines des lignes directes ; Q-85 (Aqua Air) en attente de Thibault | Comparaison avec la bande MAILLARD du BE, réponses de Kévin du 28/10/2026 (00:01) | IA (validée par Kévin) | — |
| H-040 | 28/10/2026 | R-098, R-084 | Modification | — | R-098 : reconnaissance des prises de plan de travail (1,00–1,30 m, cuisine ou près d'un appareil de cuisine) ; îlot sur le disjoncteur d'un circuit prises | Réponses de Kévin du 28/10/2026 (00:13) | IA (validée par Kévin) | — |
| H-041 | 28/10/2026 | R-073, R-094, R-096, R-100 | Modification et création | — | R-073 : commande + prises dans une gaine, sans ICTA 25 dans les boîtes ; R-094 : mode Équilibrée = le moins de boîtes ; R-096 : filaire / connecté décidé par le BE ; R-100 : équipements hors plan, registre (MAILLARD) | Comparaison Oktéo / BE sur MAILLARD, réponses de Kévin du 28/10/2026 (00:32) | IA (validée par Kévin) | — |
| H-042 | 28/10/2026 | R-094, Q-77, Q-86, Q-87 | Proposition | Q-86, Q-87 ouvertes | Mise à jour 62 : mode Économique = le moins de cuivre, note « belle pieuvre » commune ; volets en Par pièce dans la boîte de leur pièce, deux boîtes de volets en Équilibrée si les volets sont aux deux bouts de la maison (supposés, à valider) | Réponses de Kévin du 28/10/2026 (08:38–08:46), décisions laissées à Claude | IA (à valider par Kévin) | — |
| H-043 | 28/10/2026 | Q-88 | Proposition | Q-88 ouverte | Mode « Par zone » (jour / nuit / garage) ajouté au logiciel, définition des zones à valider | Demande de Kévin du 28/10/2026 (08:46) | IA (à valider par Kévin) | — |
| H-044 | 29/10/2026 | R-050, R-101 à R-161, Q-89 à Q-110 | Création | Q-89 à Q-110 ouvertes | Règles d'implantation et de composition du tableau (NF C 15-100:2024) : référentiel, GTL, différentiels, protections, réserve, parafoudre, gestion d'énergie, étage et annexes ; toutes `a_valider` (`supposee` ou `inconnue`) | Recherche documentaire transmise par Kévin le 29/10/2026 (00:08) | IA (à valider par Kévin) | — |
