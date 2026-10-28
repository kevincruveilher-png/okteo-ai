// Généré par scripts/regles-import.mjs depuis docs/journal-regles-cablage.md — ne pas modifier à la main.
export const REGLES_BASE = {
 "version": "2026-10-28.42",
 "rules": [
  {
   "id": "R-001",
   "titre": "Départs par boîte",
   "categorie": "boites",
   "description": "une boîte accepte 16 départs au plus, sans compter l'alimentation ; 6 gaines au plus par face, alimentation comprise (faces A à D). Règle non fixée sur les chantiers de Kévin : il garde celle de Claude (27/10/2026, Q-50), avec une limite abaissée de 18 à 12 départs le 27/10/2026 (12:00), puis portée à 16 le 28/10/2026 (00:01) après la comparaison avec les bandes du BE (MAILLARD : jusqu'à 15 départs, LI02 et LI04). Conséquence : la boîte LI03 de la bande DUCOURNEAU (18 départs) ne rentre toujours pas dans une seule boîte.",
   "details": [],
   "condition": "",
   "action": "",
   "parametres": {
    "departs_max": 16,
    "gaines_par_face_max": 6
   },
   "parametres_texte": "`departs_max = 16` (hors alimentation), `gaines_par_face_max = 6` (alimentation comprise), réglables",
   "certitude": "confirmee",
   "si_doute": "avertir",
   "statut": "active",
   "source": "règles de câblage v28, réglage « départs par face » v37.",
   "note": "",
   "precise": "",
   "questions_liees": [
    "Q-50"
   ],
   "noeud": "chantier/boites/R-001",
   "depends_on": [],
   "choix": null,
   "preuves": [
    "Bande DUCOURNEAU : LI03 a 19 gaines : 18 départs + l'alimentation. 18 départs : au-dessus de la limite Oktéo de 12 (voulu, Q-69). Face B de LI03 : 6 gaines, alimentation comprise."
   ],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "Kévin"
  },
  {
   "id": "R-002",
   "titre": "Commande et lumières dans la même boîte",
   "categorie": "boites",
   "description": "une commande et les lumières qu'elle allume sont raccordées à la même boîte. L'allumage n'est jamais coupé entre deux boîtes ; sinon alerte rouge et « Ramener dans la même boîte ».",
   "details": [],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "supposee",
   "si_doute": "avertir",
   "statut": "a_valider",
   "source": "v28, v38.",
   "note": "",
   "precise": "",
   "questions_liees": [],
   "noeud": "chantier/boites/R-002",
   "depends_on": [],
   "choix": null,
   "preuves": [
    "Bande DUCOURNEAU : 13 allumages sur 13 ont leur commande et leurs lumières dans la même boîte."
   ],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "IA (à valider par Kévin)"
  },
  {
   "id": "R-003",
   "titre": "Lignes directes",
   "categorie": "appareils",
   "description": "les circuits spécialisés, les sorties de câble, les RJ45 et la TV ne passent pas par une boîte : ils vont en ligne directe jusqu'au tableau.",
   "details": [
    "**Tout le courant faible va en ligne directe** (TV, antenne, RJ45, interphones…) ; **la sonnette aussi**.",
    "**Courant fort et courant faible : jamais dans la même boîte ni la même gaine** (Q-34). Comme le courant faible est toujours en ligne directe, il ne peut pas entrer dans une boîte (confirmé)."
   ],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "confirmee",
   "si_doute": "avertir",
   "statut": "active",
   "source": "règles de câblage v28, Kévin 27/10/2026.",
   "note": "Kévin, 27/10/2026, Q-33 et Q-34, pour le courant faible et la sonnette",
   "precise": "",
   "questions_liees": [
    "Q-33",
    "Q-34"
   ],
   "noeud": "chantier/appareils/R-003",
   "depends_on": [],
   "choix": null,
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "Kévin"
  },
  {
   "id": "R-004",
   "titre": "Boîtes verrouillées",
   "categorie": "boites",
   "description": "une boîte déplacée ou retracée à la main est verrouillée ; au recalcul, les boîtes verrouillées restent en place sauf décision contraire.",
   "details": [],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "supposee",
   "si_doute": "avertir",
   "statut": "a_valider",
   "source": "v32.",
   "note": "",
   "precise": "",
   "questions_liees": [],
   "noeud": "chantier/boites/R-004",
   "depends_on": [],
   "choix": null,
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "IA (à valider par Kévin)"
  },
  {
   "id": "R-005",
   "titre": "Plusieurs pièces et plusieurs niveaux par boîte",
   "categorie": "boites",
   "description": "une boîte peut desservir plusieurs pièces et plusieurs niveaux (RDC et étage).",
   "details": [],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "confirmee",
   "si_doute": "avertir",
   "statut": "active",
   "source": "réponse de Kévin, 27/10/2026 (Q-29).",
   "note": "",
   "precise": "",
   "questions_liees": [
    "Q-29"
   ],
   "noeud": "chantier/boites/R-005",
   "depends_on": [],
   "choix": null,
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "Kévin"
  },
  {
   "id": "R-006",
   "titre": "Éclairage et prises dans la même boîte",
   "categorie": "boites",
   "description": "une boîte peut mélanger des circuits d'éclairage et de prises ; chaque circuit garde ses propres neutre et phase.",
   "details": [],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "confirmee",
   "si_doute": "avertir",
   "statut": "active",
   "source": "réponse de Kévin, 27/10/2026 (Q-30).",
   "note": "",
   "precise": "",
   "questions_liees": [
    "Q-30"
   ],
   "noeud": "chantier/boites/R-006",
   "depends_on": [],
   "choix": null,
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "Kévin"
  },
  {
   "id": "R-007",
   "titre": "Un circuit ne passe que par une seule boîte",
   "categorie": "boites",
   "description": "un circuit n'est jamais réparti sur deux boîtes. Tous les appareils d'un même circuit (par exemple les 8 prises) sont raccordés à la même boîte. Le moteur ne coupe jamais un circuit entre deux boîtes ; si le circuit ne tient pas dans la boîte (départs ou gaine pleins), c'est un **doute** à signaler, pas une répartition automatique.",
   "details": [
    "Conséquence : liaison interdite « circuit sur deux boîtes ». Si trop de prises dans une boîte : R-085."
   ],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "confirmee",
   "si_doute": "avertir",
   "statut": "active",
   "source": "réponse de Kévin, 27/10/2026 (Q-31).",
   "note": "",
   "precise": "",
   "questions_liees": [
    "Q-31"
   ],
   "noeud": "chantier/boites/R-007",
   "depends_on": [
    "R-085"
   ],
   "choix": null,
   "preuves": [
    "Bande DUCOURNEAU : Chaque circuit n'est que dans une boîte."
   ],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "Kévin"
  },
  {
   "id": "R-008",
   "titre": "Pas de boîte à boîte (sauf mode Plug de pieuvre)",
   "categorie": "boites",
   "description": "par défaut, toute boîte est alimentée directement depuis le tableau. L'alimentation d'une boîte par une autre boîte n'existe que dans un chantier spécifique, en mode **Plug de pieuvre** (voir R-009).",
   "details": [],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "confirmee",
   "si_doute": "avertir",
   "statut": "active",
   "source": "réponse de Kévin, 27/10/2026 (Q-32).",
   "note": "",
   "precise": "",
   "questions_liees": [
    "Q-32"
   ],
   "noeud": "chantier/boites/R-008",
   "depends_on": [
    "R-009"
   ],
   "choix": null,
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "Kévin"
  },
  {
   "id": "R-009",
   "titre": "Mode de pieuvre « Plug de pieuvre »",
   "categorie": "boites",
   "description": "quatrième mode de pieuvre, à ajouter à Proximité, Équilibrée et Par pièce, pour certains chantiers spécifiques où une boîte peut en alimenter une autre. **Définition à compléter (Q-42 et Q-44)** : le logiciel ne peut pas câbler ce mode tant que ces règles manquent.",
   "details": [
    "Réponses de Kévin du 27/10/2026 (12:51) :\n- **Liaison (Q-41)** : la boîte 2 est alimentée par une gaine **ou** par un connecteur. Les deux cas existent et sont à choisir dans le chantier.\n- **Circuits (Q-43)** : dans ce mode, on peut soit répartir un circuit sur plusieurs boîtes, soit le limiter à une seule boîte, au choix (réglage du chantier). R-007 ne s'applique donc pas quand « répartir » est choisi.",
    "Choix ajoutés (`choix`) : `liaison_boites` = gaine | connecteur ; `repartition_circuits` = repartie | limitee_a_une_boite.",
    "Reste inconnu : combien de boîtes en chaîne et qui alimente qui (Q-42) ; chantier concerné (Q-44). Kévin transmettra un chantier de ce type : on en déduira les règles."
   ],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "inconnue",
   "si_doute": "bloquer",
   "statut": "brouillon",
   "source": "Kévin, 27/10/2026.",
   "note": "",
   "precise": "",
   "questions_liees": [
    "Q-42",
    "Q-44",
    "Q-41",
    "Q-43"
   ],
   "noeud": "chantier/boites/R-009",
   "depends_on": [
    "R-007"
   ],
   "choix": [
    {
     "nom": "liaison_boites",
     "valeurs": [
      "gaine",
      "connecteur"
     ]
    },
    {
     "nom": "repartition_circuits",
     "valeurs": [
      "repartie",
      "limitee_a_une_boite"
     ]
    }
   ],
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "IA (à valider par Kévin)"
  },
  {
   "id": "R-010",
   "titre": "Une seule gaine d'alimentation par boîte",
   "categorie": "gaines",
   "description": "une gaine d'alimentation par boîte contient la phase et le neutre de chaque circuit et une seule terre. Elle est divisée en deux seulement si elle passerait en Ø25 ; la terre reste alors dans la 1re. Les fils du télérupteur sont dans cette gaine.",
   "details": [],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "supposee",
   "si_doute": "avertir",
   "statut": "a_valider",
   "source": "retour de Kévin, v33.",
   "note": "",
   "precise": "",
   "questions_liees": [],
   "noeud": "chantier/gaines/R-010",
   "depends_on": [],
   "choix": null,
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "IA (à valider par Kévin)"
  },
  {
   "id": "R-011",
   "titre": "Longueur d'une gaine",
   "categorie": "gaines",
   "description": "longueur = tracé + 10 %, plus descentes et surlongueurs, puis arrondi. Le +10 % reste appliqué sur un tracé modifié à la main.",
   "details": [],
   "condition": "",
   "action": "",
   "parametres": {
    "marge_pct": 10
   },
   "parametres_texte": "`marge_pct = 10`, surlongueurs et arrondi réglables. **Valeurs de surlongueur à confirmer (Q-07).**",
   "certitude": "supposee",
   "si_doute": "avertir",
   "statut": "a_valider",
   "source": "v29/v30, décision v32.",
   "note": "",
   "precise": "",
   "questions_liees": [
    "Q-07"
   ],
   "noeud": "chantier/gaines/R-011",
   "depends_on": [],
   "choix": null,
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "IA (à valider par Kévin)"
  },
  {
   "id": "R-012",
   "titre": "Diamètre selon le remplissage",
   "categorie": "gaines",
   "description": "le diamètre de la gaine se calcule d'après la place des fils (remplissage). **Capacité par diamètre à confirmer (Q-06).**",
   "details": [],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "supposee",
   "si_doute": "avertir",
   "statut": "a_valider",
   "source": "règles de câblage v28.",
   "note": "",
   "precise": "",
   "questions_liees": [
    "Q-06"
   ],
   "noeud": "chantier/gaines/R-012",
   "depends_on": [],
   "choix": null,
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "IA (à valider par Kévin)"
  },
  {
   "id": "R-013",
   "titre": "Gaine partagée",
   "categorie": "gaines",
   "description": "des appareils au même endroit partagent une gaine (ex. « P17 + P18 + I12 »). Les gaines identiques se comptent (×n).",
   "details": [],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "supposee",
   "si_doute": "avertir",
   "statut": "a_valider",
   "source": "v34, v38.",
   "note": "",
   "precise": "",
   "questions_liees": [],
   "noeud": "chantier/gaines/R-013",
   "depends_on": [],
   "choix": null,
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "IA (à valider par Kévin)"
  },
  {
   "id": "R-014",
   "titre": "Câble extérieur",
   "categorie": "gaines",
   "description": "câble 3G pour l'extérieur : éclairage extérieur en 3G1,5 (L1, L1A, L2, L2A de la bande DUCOURNEAU), prises extérieures en 3G2,5.",
   "details": [],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "confirmee",
   "si_doute": "avertir",
   "statut": "active",
   "source": "v34.",
   "note": "Kévin, 27/10/2026, Q-56",
   "precise": "",
   "questions_liees": [
    "Q-56"
   ],
   "noeud": "chantier/gaines/R-014",
   "depends_on": [],
   "choix": null,
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "Kévin"
  },
  {
   "id": "R-020",
   "titre": "Circuit d'éclairage",
   "categorie": "circuits",
   "description": "éclairage en 1,5 mm², fils rouge / bleu. **Le rouge 1,5 est la phase des circuits lumières, et uniquement d'eux.**",
   "details": [],
   "condition": "",
   "action": "",
   "parametres": {
    "section": 1.5,
    "couleurs": "rouge/bleu"
   },
   "parametres_texte": "",
   "certitude": "confirmee",
   "si_doute": "avertir",
   "statut": "active",
   "source": "v38 (bande LI05 EVRARD), Kévin 27/10/2026.",
   "note": "Kévin, 27/10/2026, Q-64",
   "precise": "",
   "questions_liees": [
    "Q-64"
   ],
   "noeud": "chantier/circuits/R-020",
   "depends_on": [],
   "choix": null,
   "preuves": [
    "Bande DUCOURNEAU : Éclairage R/B 1,5 ; prises GR/BF 1,5 (LI04 en a exactement 8) ; cuisine R/B 2,5 (5 prises + hotte = 6)."
   ],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "Kévin"
  },
  {
   "id": "R-021",
   "titre": "Circuit de prises",
   "categorie": "circuits",
   "description": "prises en 1,5 mm², fils gris / bleu foncé, 8 prises au plus par circuit. **Le gris est la phase des circuits prises et des circuits de volets roulants, et uniquement d'eux** ; le neutre les distingue : bleu foncé pour les prises, bleu clair pour les volets (R-079).",
   "details": [
    "Pourquoi : cette séparation des phases évite les erreurs de câblage. Elle s'applique quel que soit le nombre de circuits dans la boîte, y compris pour un 2e circuit (R-085)."
   ],
   "condition": "",
   "action": "",
   "parametres": {
    "section": 1.5,
    "prises_max": 8,
    "couleurs": "gris/bleu foncé"
   },
   "parametres_texte": "`section = 1.5`, `prises_max = 8`",
   "certitude": "confirmee",
   "si_doute": "avertir",
   "statut": "active",
   "source": "v38 (correction : la bande LI05 avait du 2,5 rouge / bleu), Kévin 27/10/2026.",
   "note": "Kévin, 27/10/2026, Q-64 et Q-82",
   "precise": "",
   "questions_liees": [
    "Q-64",
    "Q-82"
   ],
   "noeud": "chantier/circuits/R-021",
   "depends_on": [
    "R-079",
    "R-085"
   ],
   "choix": null,
   "preuves": [
    "Bande DUCOURNEAU : Éclairage R/B 1,5 ; prises GR/BF 1,5 (LI04 en a exactement 8) ; cuisine R/B 2,5 (5 prises + hotte = 6)."
   ],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "Kévin"
  },
  {
   "id": "R-022",
   "titre": "Circuit cuisine",
   "categorie": "circuits",
   "description": "cuisine en 2,5 mm², fils rouge / bleu, 6 prises au plus ; au-delà, parts égales entre circuits.",
   "details": [],
   "condition": "",
   "action": "",
   "parametres": {
    "section": 2.5,
    "prises_max": 6,
    "couleurs": "rouge/bleu"
   },
   "parametres_texte": "`section = 2.5`, `prises_max = 6`",
   "certitude": "supposee",
   "si_doute": "avertir",
   "statut": "a_valider",
   "source": "v38.",
   "note": "",
   "precise": "",
   "questions_liees": [],
   "noeud": "chantier/circuits/R-022",
   "depends_on": [],
   "choix": null,
   "preuves": [
    "Bande DUCOURNEAU : Éclairage R/B 1,5 ; prises GR/BF 1,5 (LI04 en a exactement 8) ; cuisine R/B 2,5 (5 prises + hotte = 6)."
   ],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "IA (à valider par Kévin)"
  },
  {
   "id": "R-023",
   "titre": "Couleurs de la ronde (retours et navettes)",
   "categorie": "circuits",
   "description": "retours et navettes en orange, violet, noir, marron, ivoire. Même ordre partout dans une boîte, les allumages les plus fréquents du chantier d'abord.",
   "details": [
    "Le violet est bien utilisé chez KiTéOHM (Kévin, 28/10/2026, 00:01), même si la bande MAILLARD du BE n'en a pas : la ronde reste inchangée."
   ],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "supposee",
   "si_doute": "avertir",
   "statut": "a_valider",
   "source": "v34, v38. **3e paire de couleurs phase / neutre : Q-12.**",
   "note": "précisée par R-072",
   "precise": "",
   "questions_liees": [
    "Q-12"
   ],
   "noeud": "chantier/circuits/R-023",
   "depends_on": [
    "R-072"
   ],
   "choix": null,
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "IA (à valider par Kévin)"
  },
  {
   "id": "R-024",
   "titre": "Paires de couleurs par circuit",
   "categorie": "circuits",
   "description": "deux circuits de natures différentes dans une même gaine n'ont jamais les mêmes couleurs (ex. rouge/bleu et gris/bleu foncé). Exception : un 2e circuit de même nature garde les couleurs du 1er et se distingue par sa bague (R-085).",
   "details": [],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "supposee",
   "si_doute": "avertir",
   "statut": "a_valider",
   "source": "comparaison avec la boîte FTZ LI03, v34.",
   "note": "",
   "precise": "",
   "questions_liees": [],
   "noeud": "chantier/circuits/R-024",
   "depends_on": [
    "R-085"
   ],
   "choix": null,
   "preuves": [
    "Bande DUCOURNEAU : Éclairage 1,5 et cuisine 2,5 sont tous deux rouge/bleu clair dans LI01 : la couleur peut se répéter si la section diffère."
   ],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "IA (à valider par Kévin)"
  },
  {
   "id": "R-030",
   "titre": "Une terre par boîte",
   "categorie": "raccordements",
   "description": "",
   "details": [],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "supposee",
   "si_doute": "avertir",
   "statut": "a_valider",
   "source": "v38.",
   "note": "",
   "precise": "",
   "questions_liees": [],
   "noeud": "chantier/raccordements/R-030",
   "depends_on": [],
   "choix": null,
   "preuves": [
    "Bande DUCOURNEAU : Une seule terre V/J 9 par boîte."
   ],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "IA (à valider par Kévin)"
  },
  {
   "id": "R-031",
   "titre": "Ordre de numérotation des raccordements",
   "categorie": "raccordements",
   "description": "n° 1 = terres, puis par circuit neutre puis phase (cuisine, prises, éclairage), puis retours et navettes. C'est l'ordre de câblage du câbleur.",
   "details": [],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "confirmee",
   "si_doute": "avertir",
   "statut": "active",
   "source": "v33, v47.",
   "note": "Kévin, 27/10/2026 : « ma règle », pas celle de FTZ",
   "precise": "",
   "questions_liees": [],
   "noeud": "chantier/raccordements/R-031",
   "depends_on": [],
   "choix": null,
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "Kévin"
  },
  {
   "id": "R-040",
   "titre": "Repères par allumage",
   "categorie": "allumages",
   "description": "commande et lumières reliées portent le même numéro (I3, L3). Le 2e du même type prend la lettre A, le 3e B (VV1 / VV1A, L3 / L3A, BP1 / BP1A / BP1B). Seul : numéro sans lettre. Non relié : garde son numéro.",
   "details": [
    "Familles : spot S, applique AP, va-et-vient VV."
   ],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "supposee",
   "si_doute": "avertir",
   "statut": "a_valider",
   "source": "v32.",
   "note": "",
   "precise": "",
   "questions_liees": [],
   "noeud": "chantier/allumages/R-040",
   "depends_on": [],
   "choix": null,
   "preuves": [
    "Bande DUCOURNEAU : Repères par allumage : In/Vn avec Ln, suffixe A pour le 2e (L1A, L2A, L8A, V3A…)."
   ],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "IA (à valider par Kévin)"
  },
  {
   "id": "R-041",
   "titre": "Repères fixes",
   "categorie": "allumages",
   "description": "le numéro est stocké sur l'appareil ; il ne change qu'avec la commande « Renuméroter les repères ».",
   "details": [],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "supposee",
   "si_doute": "avertir",
   "statut": "a_valider",
   "source": "v21.",
   "note": "",
   "precise": "",
   "questions_liees": [],
   "noeud": "chantier/allumages/R-041",
   "depends_on": [],
   "choix": null,
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "IA (à valider par Kévin)"
  },
  {
   "id": "R-050",
   "titre": "Différentiels",
   "categorie": "tableau",
   "description": "ID 40 A 30 mA type A pour les circuits spécialisés ; ID type AC selon la surface (1 jusqu'à 35 m², 2 jusqu'à 100 m², 3 au-delà) ; 8 circuits au plus par ID ; une rangée par ID ; pas de disjoncteur pour les RJ45 ; réserve de 20 %.",
   "details": [
    "**Hypothèses à valider (Q-24)** : pas de parafoudre dans le coffret de base ; ID 40 A partout."
   ],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "supposee",
   "si_doute": "avertir",
   "statut": "a_valider",
   "source": "v46, v49.",
   "note": "",
   "precise": "",
   "questions_liees": [
    "Q-24"
   ],
   "noeud": "chantier/tableau/R-050",
   "depends_on": [],
   "choix": null,
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "IA (à valider par Kévin)"
  },
  {
   "id": "R-060",
   "titre": "Libellé de gaine",
   "categorie": "gaines",
   "description": "« LI01.10 · P14 · 4,8 m · Ø16 » (repère de l'appareil, pas son nom long).",
   "details": [],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "supposee",
   "si_doute": "avertir",
   "statut": "a_valider",
   "source": "v47.",
   "note": "",
   "precise": "",
   "questions_liees": [],
   "noeud": "chantier/gaines/R-060",
   "depends_on": [],
   "choix": null,
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "IA (à valider par Kévin)"
  },
  {
   "id": "R-070",
   "titre": "Allumage simple",
   "categorie": "allumages",
   "description": "Commande In : phase (R 1) + retour. Lumière Ln : neutre (B 2) + même retour + terre (V/J 9). Preuves : I5/L5, I7/L7, I8/L8, I12/L12.",
   "details": [],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "supposee",
   "si_doute": "avertir",
   "statut": "a_valider",
   "source": "Journal des règles, 27/10/2026",
   "note": "",
   "precise": "",
   "questions_liees": [],
   "noeud": "chantier/allumages/R-070",
   "depends_on": [],
   "choix": null,
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "IA (à valider par Kévin)"
  },
  {
   "id": "R-071",
   "titre": "Va-et-vient",
   "categorie": "allumages",
   "description": "1re commande Vn : phase R 1 + 2 navettes. 2e commande VnA : les 2 mêmes navettes + le retour. Lumière Ln : neutre + retour + terre. Preuves : V3/V3A/L3, V4/V4A/L4, V6/V6A/L6, V9/V9A/L9, V10/V10A/L10, V11/V11A/L11, V13/V13A/L13 (7 sur 13 allumages).",
   "details": [
    "Vocabulaire : FTZ écrit « V », Oktéo écrit « VV » (v32)."
   ],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "supposee",
   "si_doute": "avertir",
   "statut": "a_valider",
   "source": "Journal des règles, 27/10/2026",
   "note": "",
   "precise": "",
   "questions_liees": [],
   "noeud": "chantier/allumages/R-071",
   "depends_on": [],
   "choix": null,
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "IA (à valider par Kévin)"
  },
  {
   "id": "R-072",
   "titre": "Ronde Oktéo des navettes et retours",
   "categorie": "allumages",
   "description": "Constat FTZ, pour mémoire et non copié : 1er va-et-vient navettes marron/marron + retour orange, 2e ivoire/ivoire + noir, 3e comme le 1er ; allumages simples ivoire, noir, orange, ivoire ; un même allumage a deux couleurs différentes (interrupteur ivoire, lumière en câble 3G marron) ; des couleurs répétées entre allumages sans repère.",
   "details": [
    "Base : la ronde de Kévin (R-023) orange, violet, noir, marron, ivoire, avec la structure de FTZ : va-et-vient d'abord, allumages simples ensuite ; navettes d'un va-et-vient = 2 fils de la même couleur, retour d'une autre couleur.",
    "Règles d'attribution :\n1. Un allumage garde **la même couleur sur tous ses fils** (interrupteur, lumière, gaines).\n2. Dans une même gaine, deux allumages ont **toujours des couleurs différentes**.\n3. Lumière en câble 3G (extérieur) : la couleur de l'allumage est le **marron** du câble ; les autres allumages de la boîte évitent le marron tant qu'une autre couleur est libre.\n4. Couleurs données dans l'ordre de la ronde, **sans répétition tant qu'il en reste une libre dans la boîte** : d'abord les couleurs imposées (câble 3G), puis les va-et-vient, puis les allumages simples, par ordre de repère. Même ordre de ronde dans toutes les boîtes du chantier.\n5. Une couleur réutilisée (plus d'allumages que de couleurs) ne l'est que pour des allumages qui ne partagent aucune gaine, et chaque fil concerné reçoit une **bague portant le numéro de l'allumage** (12 pour L12).\n6. Un va-et-vient prend 2 couleurs de la ronde (navettes, retour) et n'a jamais deux fois la même dans une gaine.\n7. Impossible de respecter 2 ou 6 : **doute bloquant** sur la gaine.",
    "Numéros de raccordement : suivent R-031 (retours et navettes en dernier).",
    "Exemple LI03 : L1/L1A (câble 3G) marron ; va-et-vient 9 : navettes orange, retour violet ; I7 noir ; I8 ivoire ; I12 orange avec bague 12."
   ],
   "condition": "",
   "action": "",
   "parametres": {
    "ronde": "orange, violet, noir, marron, ivoire"
   },
   "parametres_texte": "",
   "certitude": "supposee",
   "si_doute": "bloquer",
   "statut": "a_valider",
   "source": "conçue par Claude sur mandat de Kévin, 27/10/2026 ; à valider sur une boîte exemple",
   "note": "conçue par Claude sur mandat de Kévin, 27/10/2026 ; à valider sur une boîte exemple",
   "precise": "",
   "questions_liees": [],
   "noeud": "chantier/allumages/R-072",
   "depends_on": [
    "R-023",
    "R-031"
   ],
   "choix": null,
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "IA (à valider par Kévin)"
  },
  {
   "id": "R-073",
   "titre": "Gaine partagée",
   "categorie": "gaines",
   "description": "Les fils des appareils au même endroit sont réunis dans une gaine, avec la phase R 1 et la terre comptées une seule fois (P13+I5+V4 = 7 fils). Libellé : prises, puis interrupteurs, puis va-et-vient.",
   "details": [
    "Une commande et des prises au même endroit peuvent partager une gaine (Kévin, 28/10/2026, 00:32), **mais on évite les gaines ICTA 25 dans les boîtes** : si le regroupement demande plus qu'une ICTA 20, les appareils repartent dans des gaines séparées (prises d'un côté, commandes de l'autre). « Pas évident » : à revoir sur les prochains chantiers."
   ],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "supposee",
   "si_doute": "avertir",
   "statut": "a_valider",
   "source": "Journal des règles, 27/10/2026",
   "note": "",
   "precise": "précise R-013",
   "questions_liees": [],
   "noeud": "chantier/gaines/R-073",
   "depends_on": [
    "R-013"
   ],
   "choix": null,
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "IA (à valider par Kévin)"
  },
  {
   "id": "R-074",
   "titre": "Diamètre des gaines",
   "categorie": "gaines",
   "description": "Somme des sections nominales ≤ 7,5 mm² → ICTA 16 (5×1,5 ou 3×2,5) ; au-delà → ICTA 20. Maximum vu : 13,5 mm² (7 fils). Vérifié sur toutes les gaines des 5 boîtes.",
   "details": [
    "Principe confirmé par Kévin (27/10/2026) : addition des sections et place dans la gaine, avec le même ratio pour tous les diamètres.",
    "Paramètre réglable : capacité en mm² par diamètre. ICTA 16 = 7,5 (vu). ICTA 20 = 13,5 (maximum vu ; Kévin garde le même ratio que pour 16, 27/10/2026 12:43 : **valeur retenue**, ajustable si la valeur exacte est trouvée, Q-49). Au-dessus de la capacité connue : doute bloquant."
   ],
   "condition": "",
   "action": "",
   "parametres": {
    "icta16_mm2": 7.5,
    "icta20_mm2": 13.5
   },
   "parametres_texte": "",
   "certitude": "supposee",
   "si_doute": "bloquer",
   "statut": "a_valider",
   "source": "Journal des règles, 27/10/2026",
   "note": "",
   "precise": "précise R-012",
   "questions_liees": [
    "Q-49"
   ],
   "noeud": "chantier/gaines/R-074",
   "depends_on": [
    "R-012"
   ],
   "choix": null,
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "IA (à valider par Kévin)"
  },
  {
   "id": "R-075",
   "titre": "Alimentation d'une boîte",
   "categorie": "gaines",
   "description": "Gaine .01, avec les couleurs : éclairage R / B (1,5), prises GR / BF (1,5), cuisine R / B (2,5), volets roulants GR / B clair (1,5).",
   "details": [
    "**Numéros de raccordement : ceux de R-031 (terres en n° 1), pas ceux de FTZ.** Les numéros vus sur les bandes FTZ (R 1, B 2, GR 3, BF 4, R 7, B 8, terre 9, GR 11, B 12) ne sont pas repris (rectification de Kévin, 27/10/2026, 14:29).",
    "Une seule terre V/J, de la plus forte section de la gaine (2,5 en LI01 à cause de la cuisine ; 2,5 en LI03 à cause de EQ1/EQ2). Confirmé par Kévin (27/10/2026, Q-57).",
    "Au plus un circuit éclairage et un circuit prises par boîte (confirmé, Q-53), sauf plus de 8 prises : voir R-085."
   ],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "supposee",
   "si_doute": "avertir",
   "statut": "a_valider",
   "source": "Journal des règles, 27/10/2026",
   "note": "numérotation : R-031",
   "precise": "précise R-010",
   "questions_liees": [
    "Q-57",
    "Q-53"
   ],
   "noeud": "chantier/gaines/R-075",
   "depends_on": [
    "R-010",
    "R-031",
    "R-085"
   ],
   "choix": null,
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "IA (à valider par Kévin)"
  },
  {
   "id": "R-076",
   "titre": "Numéros de raccordement FTZ",
   "categorie": "gaines",
   "description": "1/2 éclairage, 3/4 prises, 7/8 cuisine, 9 terre, 11 et plus : navettes et retours. Les numéros 5, 6 et 10 ne sont jamais utilisés. R-031 (terres en premier) n'est pas celle de FTZ : voir Q-45.",
   "details": [],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "supposee",
   "si_doute": "avertir",
   "statut": "archivee",
   "source": "écartée par Kévin le 27/10/2026 : on garde R-031",
   "note": "écartée par Kévin le 27/10/2026 : on garde R-031",
   "precise": "écart avec R-031",
   "questions_liees": [
    "Q-45"
   ],
   "noeud": "chantier/gaines/R-076",
   "depends_on": [
    "R-031"
   ],
   "choix": null,
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "IA (à valider par Kévin)"
  },
  {
   "id": "R-077",
   "titre": "Numéro de gaine",
   "categorie": "gaines",
   "description": "NomBoîte.NN ; .01 = alimentation ; les autres **strictement** dans le sens **anti-horaire** à partir de l'alimentation, pour que les numéros se lisent de gauche à droite sur chaque face. Les inversions vues dans FTZ (LI01.06/.07, LI03.06, LI03.10) ne sont pas à reproduire. FTZ et le BE numérotent dans le sens horaire : écart voulu.",
   "details": [],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "confirmee",
   "si_doute": "avertir",
   "statut": "active",
   "source": "Kévin, 27/10/2026, Q-52 ; sens changé le 27/10/2026, 23:19",
   "note": "Kévin, 27/10/2026, Q-52 ; sens changé le 27/10/2026, 23:19",
   "precise": "",
   "questions_liees": [
    "Q-52"
   ],
   "noeud": "chantier/gaines/R-077",
   "depends_on": [],
   "choix": null,
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "Kévin"
  },
  {
   "id": "R-078",
   "titre": "Longueurs",
   "categorie": "gaines",
   "description": "Affichées au 0,1 m (de 2,10 à 8,10 m dans les boîtes). Le sens de l'arrondi n'est pas visible : Q-07.",
   "details": [],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "supposee",
   "si_doute": "avertir",
   "statut": "a_valider",
   "source": "Journal des règles, 27/10/2026",
   "note": "",
   "precise": "",
   "questions_liees": [
    "Q-07"
   ],
   "noeud": "chantier/gaines/R-078",
   "depends_on": [],
   "choix": null,
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "IA (à valider par Kévin)"
  },
  {
   "id": "R-079",
   "titre": "Volets roulants",
   "categorie": "appareils",
   "description": "Boîte dédiée (LI05 : 6 moteurs, 7 gaines) sur un circuit dédié, une gaine ICTA 16 par moteur : gris (phase), bleu clair (neutre), vert/jaune (terre) — couleurs validées par Kévin le 27/10/2026 (Q-82) ; numéros de raccordement selon R-031. Repère VRn ; commande filaire ou connectée : R-096.",
   "details": [
    "Décision de Kévin (27/10/2026, Q-51) : **option du chantier** — boîte à part ou volets mélangés aux autres boîtes (ou ligne directe selon le cas). Pas de maximum de moteurs fixé par le logiciel : la limite vient de la norme NF C 15-100 (R-087)."
   ],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "confirmee",
   "si_doute": "avertir",
   "statut": "active",
   "source": "Kévin, 27/10/2026, Q-51 et Q-82",
   "note": "Kévin, 27/10/2026, Q-51 et Q-82",
   "precise": "",
   "questions_liees": [
    "Q-51",
    "Q-82"
   ],
   "noeud": "chantier/appareils/R-079",
   "depends_on": [
    "R-031",
    "R-096",
    "R-087"
   ],
   "choix": [
    {
     "nom": "volets",
     "valeurs": [
      "boite_a_part",
      "melanges"
     ]
    }
   ],
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "Kévin"
  },
  {
   "id": "R-080",
   "titre": "Liaison équipotentielle",
   "categorie": "raccordements",
   "description": "Locale (EQ1, EQ2) : gaine ICTA 16 avec un seul fil V/J 2,5 depuis la terre (9) de la boîte LI03. Principale (EQ3) : 10 mm², ICTA 20, ligne directe au tableau. La locale concerne la salle de bain (Kévin, 27/10/2026, Q-48).",
   "details": [],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "supposee",
   "si_doute": "avertir",
   "statut": "a_valider",
   "source": "Journal des règles, 27/10/2026",
   "note": "",
   "precise": "",
   "questions_liees": [
    "Q-48"
   ],
   "noeud": "chantier/raccordements/R-080",
   "depends_on": [],
   "choix": null,
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "IA (à valider par Kévin)"
  },
  {
   "id": "R-081",
   "titre": "Repère de circuit au tableau",
   "categorie": "tableau",
   "description": "Numéro encadré de 1 à 10 sur tout le chantier, à côté de chaque paire d'alimentation (LI01 : 1, 2, 3 ; LI02 : 4, 5 ; LI03 : 6, 7 ; LI04 : 8, 9 ; LI05 : 10) et page « REPÈRES TABLEAU ». Réponse à Q-23. Déjà présent sur les boîtes de l'appli Oktéo.",
   "details": [],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "confirmee",
   "si_doute": "avertir",
   "statut": "active",
   "source": "Kévin, 27/10/2026, Q-54",
   "note": "Kévin, 27/10/2026, Q-54",
   "precise": "",
   "questions_liees": [
    "Q-54",
    "Q-23"
   ],
   "noeud": "chantier/tableau/R-081",
   "depends_on": [],
   "choix": null,
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "Kévin"
  },
  {
   "id": "R-082",
   "titre": "Lignes directes",
   "categorie": "appareils",
   "description": "En ligne directe : convecteurs, sèche-serviette, VMC et sa commande, équipotentielle principale, TV, antenne, RJ45 (gaine ICTA_V20), four, lave-linge, lave-vaisselle, sèche-linge, plaque, chauffe-eau, prises extérieures, interphones, sonnette (Kévin, Q-33).",
   "details": [
    "Tableau : étiquette, longueur, gaine, fil, aboutissant, vérification ; total par diamètre (11 ICTA 16, 16 ICTA 20, 1 gaine aiguillée Ø40 = 28 gaines)."
   ],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "supposee",
   "si_doute": "avertir",
   "statut": "a_valider",
   "source": "Journal des règles, 27/10/2026",
   "note": "",
   "precise": "précise R-003",
   "questions_liees": [
    "Q-33"
   ],
   "noeud": "chantier/appareils/R-082",
   "depends_on": [
    "R-003"
   ],
   "choix": null,
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "IA (à valider par Kévin)"
  },
  {
   "id": "R-083",
   "titre": "Neutre à l'interrupteur",
   "categorie": "allumages",
   "description": "Un interrupteur reçoit le bleu (neutre, B 2) en plus de la phase et du retour s'il est à voyant ou domotique. Cela explique I1 et I2 dans la bande DUCOURNEAU.",
   "details": [
    "Reste ouvert : pourquoi L1, L1A, L2, L2A sont en câble 3G1,5 (Q-56)."
   ],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "confirmee",
   "si_doute": "avertir",
   "statut": "active",
   "source": "Kévin, 27/10/2026, Q-47",
   "note": "Kévin, 27/10/2026, Q-47",
   "precise": "",
   "questions_liees": [
    "Q-47",
    "Q-56"
   ],
   "noeud": "chantier/allumages/R-083",
   "depends_on": [],
   "choix": null,
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "Kévin"
  },
  {
   "id": "R-084",
   "titre": "Nouveaux types d'appareils et raccordement modifiable",
   "categorie": "appareils",
   "description": "Types validés : radiateur (convecteur), sèche-serviette, caisson VMC, commande VMC, prise spécialisée nommée (four, lave-linge, lave-vaisselle, sèche-linge), plaque de cuisson (6 mm²), chauffe-eau thermodynamique et prises extérieures (sortie de câble 3G2,5), interphones, antenne et prises TV, équipotentielle principale et locale, moteur de volet roulant.",
   "details": [
    "Pour chaque type, la nature du raccordement (câble ou fils) et la section sont **modifiables**.",
    "Courant faible (TV, antenne, RJ45) : gaine verte Ø20 (ICTA_V20 dans FTZ), pour tous les chantiers (Kévin, 27/10/2026 : les anciens chantiers en ICTA 16 sont abandonnés). Types ajoutés le 27/10/2026 (Q-74) : module Aqua Air (alimentation 3G2,5 et pilotage 3×1,5), bouche de diffusion motorisée (YSYT 2×1 souple, sans gaine), prise extérieure 4G1,5, Velux motorisé (dans la boîte des volets, comme un volet), moteur de garage (ligne directe 1,5 GR + BF + V/J), interrupteur de coupure (ligne directe ICTA 16, 1,5 R + N), climatisation (4G1,5 ICTA 20), G EXT en 3G1,5 ICTA 16 ou 3G2,5 ICTA 20 selon le chantier.",
    "Hotte : en boîte (circuit cuisine) ou en ligne directe, « ça dépend » (Q-60). Moteur de volet roulant : boîte ou ligne directe selon l'option du chantier (R-079).",
    "Types ajoutés le 28/10/2026 (bande MAILLARD du BE, Kévin 00:01) : **îlot** (prises de l'îlot central en ligne directe, 1,5 GR + BF + V/J, ICTA 16 ; pas de disjoncteur propre : branché au tableau sur le disjoncteur d'un circuit prises, avis de Kévin du 28/10/2026, 00:13 — ses prises comptent dans les 8 de ce circuit, supposé) ; **bouton poussoir de sonnette** BPS (ligne directe, câble 1P 9/10, ICTA 16) ; **sonnette** SON (carillon dans une boîte, gaine 1,5 R + B + V/J, ICTA 16)."
   ],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "confirmee",
   "si_doute": "avertir",
   "statut": "active",
   "source": "Kévin, 27/10/2026, Q-55",
   "note": "Kévin, 27/10/2026, Q-55",
   "precise": "",
   "questions_liees": [
    "Q-55",
    "Q-74",
    "Q-60"
   ],
   "noeud": "chantier/appareils/R-084",
   "depends_on": [
    "R-079"
   ],
   "choix": null,
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "Kévin"
  },
  {
   "id": "R-085",
   "titre": "Plus de 8 prises dans une boîte",
   "categorie": "circuits",
   "description": "Deux solutions, au choix du **mode de pieuvre** (Proximité, Équilibrée, Par pièce, Plug de pieuvre) : (a) créer un 2e circuit prises dans l'alimentation de la même boîte ; (b) mettre les prises en trop dans une autre boîte. Réglage modifiable chantier par chantier.",
   "details": [
    "Un circuit n'est jamais réparti sur deux boîtes (R-007).",
    "Couleurs du 2e circuit (Kévin, 27/10/2026, Q-62), fixées par la section : en 2,5 mm² bleu clair (B) + rouge (R) + V/J ; en 1,5 mm² prises : gris + bleu foncé (BF) + V/J (R-021). Le rouge 1,5 reste réservé à l'éclairage (R-020) : on ne mélange jamais les phases (confirmé, Q-64). Les couleurs d'un 2e circuit sont celles du 1er : elles ne changent pas, quel que soit le nombre de circuits dans la boîte ni la boîte. Les circuits qui ont les mêmes couleurs dans une même gaine se distinguent par leur bague (numéro du circuit, R-075). Exception à R-024."
   ],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "confirmee",
   "si_doute": "avertir",
   "statut": "active",
   "source": "Kévin, 27/10/2026, Q-59",
   "note": "Kévin, 27/10/2026, Q-59",
   "precise": "",
   "questions_liees": [
    "Q-59",
    "Q-62",
    "Q-64"
   ],
   "noeud": "chantier/circuits/R-085",
   "depends_on": [
    "R-007",
    "R-021",
    "R-020",
    "R-075",
    "R-024"
   ],
   "choix": [
    {
     "nom": "mode_pieuvre",
     "valeurs": [
      "proximite",
      "equilibree",
      "par_piece",
      "plug"
     ]
    }
   ],
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "Kévin"
  },
  {
   "id": "R-086",
   "titre": "Choix de raccordement par le client ou le BE",
   "categorie": "appareils",
   "description": "Pour la hotte, et tout appareil à choix : en boîte (circuit cuisine) ou en ligne directe, selon un choix du client ou du BE, enregistré sur l'appareil ou le chantier (`raccordement : boite | ligne_directe | a_choisir`).",
   "details": [
    "Tant que le choix n'est pas fait (`a_choisir`) : doute signalé sur cet appareil seulement ; le reste du câblage continue."
   ],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "confirmee",
   "si_doute": "avertir",
   "statut": "active",
   "source": "Kévin, 27/10/2026, Q-60",
   "note": "Kévin, 27/10/2026, Q-60",
   "precise": "",
   "questions_liees": [
    "Q-60"
   ],
   "noeud": "chantier/appareils/R-086",
   "depends_on": [],
   "choix": [
    {
     "nom": "raccordement",
     "valeurs": [
      "boite",
      "ligne_directe",
      "a_choisir"
     ]
    }
   ],
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "Kévin"
  },
  {
   "id": "R-087",
   "titre": "Volets roulants et NF C 15-100",
   "categorie": "circuits",
   "description": "Circuit dédié (jamais sur un circuit d'éclairage ou de prises) ; section 1,5 mm² au minimum ; protection 16 A au maximum (10 A possible).",
   "details": [
    "La norme ne donne pas de nombre de moteurs : la limite est la puissance admissible, de 2 300 W (10 A) à 3 680 W (16 A) pour des conducteurs de 1,5 mm². Le logiciel compare la somme des intensités des moteurs au calibre du disjoncteur ; **la puissance d'un moteur est une donnée de l'appareil.** Valeur retenue par Kévin le 27/10/2026 (Q-63) : **50 W par moteur** (`puissance_moteur_w = 50`, modifiable par appareil). Maximum de moteurs par circuit = puissance admissible ÷ 50 W : 46 moteurs sous 10 A (2 300 W), 73 sous 16 A (3 680 W). Calibre par défaut : 10 A (`calibre_volets_a = 10`, réglable). Puissance de l'appareil absente : doute.",
    "Deux circuits de volets sont recommandés, non obligatoires (garder des volets en cas de panne). Calibre de 10 A confirmé par le plan DUCOURNEAU (LI05 VR 10 A, 6 moteurs)."
   ],
   "condition": "",
   "action": "",
   "parametres": {
    "puissance_moteur_w": 50,
    "calibre_volets_a": 10
   },
   "parametres_texte": "",
   "certitude": "supposee",
   "si_doute": "avertir",
   "statut": "a_valider",
   "source": "legrand.fr (« Combien de volets roulants par disjoncteur ? »), hager.com (NF C 15-100, disjoncteur). À recouper avec le texte de la norme.",
   "note": "sources lues le 27/10/2026",
   "precise": "",
   "questions_liees": [
    "Q-63"
   ],
   "noeud": "chantier/circuits/R-087",
   "depends_on": [],
   "choix": null,
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "IA (à valider par Kévin)"
  },
  {
   "id": "R-088",
   "titre": "Face pleine : passage sur la face voisine",
   "categorie": "boites",
   "description": "Quand une face de la boîte est pleine (6 gaines, alimentation comprise, R-001), la gaine passe sur la face voisine. **Aucun avertissement.** La numérotation reste strictement dans le sens horaire (R-077).",
   "details": [
    "Si plus aucune face n'est libre (12 départs atteints, R-001) : doute bloquant (ajout de Claude, à confirmer)."
   ],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "confirmee",
   "si_doute": "bloquer",
   "statut": "active",
   "source": "Q-36",
   "note": "Q-36",
   "precise": "",
   "questions_liees": [
    "Q-36"
   ],
   "noeud": "chantier/boites/R-088",
   "depends_on": [
    "R-001",
    "R-077"
   ],
   "choix": null,
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "Kévin"
  },
  {
   "id": "R-089",
   "titre": "Une gaine par appareil, et gaines partagées",
   "categorie": "boites",
   "description": "Jamais deux gaines vers le même appareil, jamais un appareil sur deux gaines.",
   "details": [
    "Exception : une gaine à deux circuits peut alimenter deux appareils situés au même endroit (gaine partagée, R-073).",
    "**Les circuits spécialisés ne sont jamais dans une gaine partagée.**"
   ],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "confirmee",
   "si_doute": "avertir",
   "statut": "active",
   "source": "Q-35, Q-37",
   "note": "Q-35, Q-37",
   "precise": "",
   "questions_liees": [
    "Q-35",
    "Q-37"
   ],
   "noeud": "chantier/boites/R-089",
   "depends_on": [
    "R-073"
   ],
   "choix": null,
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "Kévin"
  },
  {
   "id": "R-090",
   "titre": "Phases et neutres jamais partagés entre circuits",
   "categorie": "boites",
   "description": "Deux circuits ne partagent jamais leur phase ni leur neutre (sinon le différentiel disjoncte). Les **terres** peuvent être regroupées (une terre par gaine d'alimentation, R-010). Liaison interdite pour le logiciel.",
   "details": [],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "confirmee",
   "si_doute": "avertir",
   "statut": "active",
   "source": "Q-39",
   "note": "Q-39",
   "precise": "",
   "questions_liees": [
    "Q-39"
   ],
   "noeud": "chantier/boites/R-090",
   "depends_on": [
    "R-010"
   ],
   "choix": null,
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "Kévin"
  },
  {
   "id": "R-091",
   "titre": "Autres liaisons interdites",
   "categorie": "boites",
   "description": "Un va-et-vient n'est jamais coupé entre deux boîtes (R-002).",
   "details": [
    "Une prise de la salle de bain ne va jamais sur le circuit de la cuisine.",
    "Une boîte n'en alimente pas une autre, sauf en Plug de pieuvre (R-008, R-009)."
   ],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "confirmee",
   "si_doute": "avertir",
   "statut": "active",
   "source": "Q-40",
   "note": "Q-40",
   "precise": "",
   "questions_liees": [
    "Q-40"
   ],
   "noeud": "chantier/boites/R-091",
   "depends_on": [
    "R-002",
    "R-008",
    "R-009"
   ],
   "choix": null,
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "Kévin"
  },
  {
   "id": "R-092",
   "titre": "Bornes de raccordement",
   "categorie": "circuits",
   "description": "Le nombre de fils par borne n'est **pas une contrainte** : on peut faire des ponts au câblage pour prolonger une borne au-delà de 12. La capacité d'une borne n'influence ni les circuits ni le câblage des boîtes ; le logiciel ne la contrôle pas.",
   "details": [
    "Une borne ne réunit jamais des fils de sections différentes (un circuit de prises 2,5 n'est jamais mélangé avec un circuit de prises 1,5).",
    "**Seule exception : les terres** se raccordent ensemble quelle que soit leur section (Kévin, 27/10/2026, Q-80)."
   ],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "confirmee",
   "si_doute": "avertir",
   "statut": "active",
   "source": "Q-38",
   "note": "Q-38",
   "precise": "",
   "questions_liees": [
    "Q-38",
    "Q-80"
   ],
   "noeud": "chantier/circuits/R-092",
   "depends_on": [],
   "choix": null,
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "Kévin"
  },
  {
   "id": "R-093",
   "titre": "Télérupteur et boutons poussoirs",
   "categorie": "allumages",
   "description": "Le télérupteur est dans le tableau. Chaque bouton poussoir (BP, BP1A, BP1B…) a dans sa gaine la phase et un fil de commande ; le retour va aux lumières commandées. Commande et retour prennent chacun une couleur de la ronde (R-072) ; les lumières commandées reçoivent la couleur du retour. Les deux fils du télérupteur passent par la gaine d'alimentation de la boîte (R-010).",
   "details": [
    "**Le neutre n'est pas obligatoire dans la gaine du bouton poussoir** : il n'y est que si le bouton est à voyant ou domotique (R-083)."
   ],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "confirmee",
   "si_doute": "avertir",
   "statut": "active",
   "source": "bande FALGUA E6390 (LI01, LI04, LI06).",
   "note": "Kévin, 27/10/2026, Q-70",
   "precise": "",
   "questions_liees": [
    "Q-70"
   ],
   "noeud": "chantier/allumages/R-093",
   "depends_on": [
    "R-072",
    "R-010",
    "R-083"
   ],
   "choix": null,
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "Kévin"
  },
  {
   "id": "R-094",
   "titre": "Boîtes de volets roulants selon le mode de pieuvre",
   "categorie": "boites",
   "description": "**Proximité** : le logiciel choisit la solution la plus économique (boîtes de volets multiples, ou volets mélangés aux autres boîtes, selon la longueur de fil et de gaine).",
   "details": [
    "**Équilibrée** : une seule boîte pour tous les volets. En mode Équilibrée, le choix des boîtes vise **le moins de boîtes possible**, comme le BE (Kévin, 28/10/2026, 00:32 ; bande MAILLARD : 5 boîtes de 11 à 15 départs + 1 boîte de volets) ; le critère « plus petite longueur de gaine d'abord » (Q-77) reste celui du mode Proximité.",
    "Critère de « plus économique » (confirmé par Kévin le 27/10/2026, Q-77) : plus petite longueur totale de gaine, puis moins de boîtes, puis moins de départs. C'est aussi le score des alternatives dans l'étude (section 3 ter).",
    "Par pièce : chaque volet dans la boîte de sa pièce (supposé par le logiciel depuis la mise à jour 62, à valider : Q-87). Plug de pieuvre : non précisé (doute, `avertir`).",
    "Équilibrée, volets aux deux bouts de la maison : deux boîtes de volets si cela évite de traverser toute la maison (supposé depuis la mise à jour 62, à valider : Q-87).",
    "Précise R-079."
   ],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "confirmee",
   "si_doute": "avertir",
   "statut": "active",
   "source": "Kévin, 27/10/2026, Q-71",
   "note": "Kévin, 27/10/2026, Q-71",
   "precise": "",
   "questions_liees": [
    "Q-71",
    "Q-77",
    "Q-87"
   ],
   "noeud": "chantier/boites/R-094",
   "depends_on": [
    "R-079"
   ],
   "choix": null,
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "Kévin"
  },
  {
   "id": "R-095",
   "titre": "Bouchon dans la boîte (obligatoire)",
   "categorie": "gaines",
   "description": "Une gaine qui amène l'air extérieur (câble 3G1,5 des appliques extérieures) reçoit **obligatoirement** un petit bouchon dans la boîte, pour éviter que l'air extérieur entre dans la boîte, qui communique avec l'intérieur. Ce n'est pas une option (rectification de Kévin, 27/10/2026, 14:07). Repéré « BOUCHON » sur la bande FTZ.",
   "details": [
    "Le logiciel marque automatiquement toutes les gaines concernées sur la bande et dans le décompte."
   ],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "confirmee",
   "si_doute": "avertir",
   "statut": "active",
   "source": "Kévin, 27/10/2026, Q-72",
   "note": "Kévin, 27/10/2026, Q-72",
   "precise": "",
   "questions_liees": [
    "Q-72"
   ],
   "noeud": "chantier/gaines/R-095",
   "depends_on": [],
   "choix": null,
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "Kévin"
  },
  {
   "id": "R-096",
   "titre": "Commande de volet roulant : filaire ou connectée",
   "categorie": "appareils",
   "description": "Chaque volet roulant est soit **filaire** (commande CVR : l'alimentation gris + bleu clair, plus deux fils de commande marron et noir pris dans la ronde de couleurs, R-072), soit **connecté** (micromodule : gris + bleu clair + V/J seulement). Le choix se fait par volet sur le plan.",
   "details": [
    "Pour un volet filaire, la gaine du CVR et la gaine du moteur portent les deux mêmes fils de commande ; chaque couple a ses propres numéros.",
    "Qui décide : le **BE**, chantier par chantier (Kévin, 28/10/2026, 00:32) ; le plan ne le dit pas (MAILLARD : 8 commandes de volet dessinées, volets connectés chez le BE). Le logiciel demande le choix pour le chantier (réglage des choix) et ne le déduit pas du plan."
   ],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "confirmee",
   "si_doute": "avertir",
   "statut": "active",
   "source": "bande BATELIER JEAN LOUIS (CVR3 à CVR5, VR1 et VR2 connectés).",
   "note": "Kévin, 27/10/2026, Q-75",
   "precise": "",
   "questions_liees": [
    "Q-75"
   ],
   "noeud": "chantier/appareils/R-096",
   "depends_on": [
    "R-072"
   ],
   "choix": [
    {
     "nom": "commande_volet",
     "valeurs": [
      "filaire",
      "connecte"
     ]
    }
   ],
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "Kévin"
  },
  {
   "id": "R-097",
   "titre": "Gaine aiguillée en attente",
   "categorie": "appareils",
   "description": "une gaine vide, aiguillée, laissée en attente (fibre, réseau…) est un appareil à poser sur le plan ; elle part en ligne directe du tableau, sans fil.",
   "details": [],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "`diametre = 40` (vu sur DUCOURNEAU, AIG2 : Ø40, 1,2 m), modifiable par appareil.",
   "certitude": "confirmee",
   "si_doute": "avertir",
   "statut": "active",
   "source": "bande DUCOURNEAU (lignes directes), réponse de Kévin du 27/10/2026 (15:55).",
   "note": "Kévin, 27/10/2026",
   "precise": "",
   "questions_liees": [],
   "noeud": "chantier/appareils/R-097",
   "depends_on": [],
   "choix": null,
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "Kévin"
  },
  {
   "id": "R-098",
   "titre": "Prises de plan de travail",
   "categorie": "circuits",
   "description": "dans la cuisine, seules les prises du plan de travail (et la hotte, quand elle va en boîte : R-086) sont sur le circuit cuisine 2,5 mm² rouge / bleu (R-022, 6 au plus) ; les autres prises de la pièce restent sur un circuit prises 1,5 mm² gris / bleu foncé (R-021).",
   "details": [
    "Le repère est porté par la prise elle-même (« prise de plan de travail »), pas par le nom de la pièce : une cuisine ouverte dans une pièce de vie est ainsi traitée comme une cuisine fermée.",
    "Reconnaissance automatique (Kévin, 28/10/2026, 00:13 : « fixons cette règle et nous verrons sur les prochains chantiers ») : une prise posée entre 1,00 m et 1,30 m de hauteur, dans une pièce de cuisine OU à moins de 3 m d'un appareil de cuisine (plaque, hotte, four, lave-vaisselle), est marquée « plan de travail ». Le marquage reste modifiable prise par prise. À revoir sur les prochains chantiers."
   ],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "confirmee",
   "si_doute": "avertir",
   "statut": "active",
   "source": "bande MAILLARD du BE (P28 à P31 + hotte en 2,5 ; P19 et P27, même pièce, en 1,5), réponse de Kévin du 28/10/2026 (00:01).",
   "note": "Kévin, 28/10/2026, 00:01",
   "precise": "",
   "questions_liees": [],
   "noeud": "chantier/circuits/R-098",
   "depends_on": [
    "R-086",
    "R-022",
    "R-021"
   ],
   "choix": null,
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "Kévin"
  },
  {
   "id": "R-100",
   "titre": "Équipements hors plan",
   "categorie": "appareils",
   "description": "une partie des lignes et appareils ne figure pas sur le plan électrique ; le BE les ajoute d'après le chantier et le **devis** (cuisine équipée, VMC, équipotentielles, antenne, sonnette…). Le journal tient le compte, chantier par chantier, de ces équipements (registre ci-dessous). Un équipement présent sur la plupart des chantiers est proposé par défaut sur les suivants, marqué « à vérifier avec le devis » (jamais ajouté sans le dire) ; les autres restent à ajouter à la main.",
   "details": [
    "Seuil de proposition : à fixer quand le registre aura plusieurs chantiers (supposé : présent sur 80 % des chantiers comptés).",
    "Registre (nombre de lignes par chantier) :"
   ],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "supposee",
   "si_doute": "avertir",
   "statut": "active",
   "source": "Kévin, 28/10/2026, 00:32 : « ils ne sont pas sur le plan ; tiens un compte de ces gaines »",
   "note": "Kévin, 28/10/2026, 00:32 : « ils ne sont pas sur le plan ; tiens un compte de ces gaines »",
   "precise": "",
   "questions_liees": [],
   "noeud": "chantier/appareils/R-100",
   "depends_on": [],
   "choix": null,
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "IA (à valider par Kévin)"
  },
  {
   "id": "R-099",
   "titre": "Total des gaines des lignes directes",
   "categorie": "appareils",
   "description": "le total des gaines du tableau des lignes directes compte aussi les liaisons sans gaine (YSYT des bouches motorisées) ; les gaines vertes V20 sont comptées avec les ICTA 20. Exemple MAILLARD : 10 ICTA 16 + 15 ICTA 20 (dont 10 V20) + 7 YSYT = 32.",
   "details": [],
   "condition": "",
   "action": "",
   "parametres": {},
   "parametres_texte": "",
   "certitude": "confirmee",
   "si_doute": "avertir",
   "statut": "active",
   "source": "bande MAILLARD du BE (page « Lignes directes »).",
   "note": "Kévin, 28/10/2026, 00:01",
   "precise": "",
   "questions_liees": [],
   "noeud": "chantier/appareils/R-099",
   "depends_on": [],
   "choix": null,
   "preuves": [],
   "version": 1,
   "cree_le": "2026-10-27",
   "modifie_le": "2026-10-27",
   "modifie_par": "Kévin"
  }
 ],
 "questions": [
  {
   "id": "Q-01",
   "section": "A. Boîtes",
   "question": "18 départs par boîte : valeur fixe pour toutes les boîtes, ou dépend du modèle de boîte ?",
   "reponse": "",
   "suppose": "fixe",
   "si_doute": "bloquer",
   "statut": "ouverte",
   "statut_texte": ""
  },
  {
   "id": "Q-02",
   "section": "A. Boîtes",
   "question": "Distance maximale entre une boîte et l'appareil qu'elle dessert ?",
   "reponse": "",
   "suppose": "pas de limite",
   "si_doute": "avertir",
   "statut": "ouverte",
   "statut_texte": ""
  },
  {
   "id": "Q-03",
   "section": "A. Boîtes",
   "question": "Pièces où la boîte est interdite (salle de bain, garage, extérieur, placard…) ?",
   "reponse": "",
   "suppose": "aucune",
   "si_doute": "avertir",
   "statut": "ouverte",
   "statut_texte": ""
  },
  {
   "id": "Q-04",
   "section": "A. Boîtes",
   "question": "Hauteur de pose de la boîte (plafond ? à combien du sol) ?",
   "reponse": "",
   "suppose": "non utilisée",
   "si_doute": "avertir",
   "statut": "ouverte",
   "statut_texte": ""
  },
  {
   "id": "Q-05",
   "section": "B. Gaines",
   "question": "Diamètres de gaine utilisés (16, 20, 25, 32 ?) et diamètre mini pour un appareil seul ?",
   "reponse": "",
   "suppose": "Ø16 / Ø20 / Ø25",
   "si_doute": "bloquer",
   "statut": "ouverte",
   "statut_texte": ""
  },
  {
   "id": "Q-06",
   "section": "B. Gaines",
   "question": "Combien de fils (par section) dans chaque diamètre ?",
   "reponse": "",
   "suppose": "calcul par remplissage",
   "si_doute": "bloquer",
   "statut": "ouverte",
   "statut_texte": ""
  },
  {
   "id": "Q-07",
   "section": "B. Gaines",
   "question": "Surlongueurs : à la boîte, à l'appareil, par descente ? Arrondi (au 0,1 m, 0,5 m, 1 m) ?",
   "reponse": "",
   "suppose": "valeurs du v29",
   "si_doute": "avertir",
   "statut": "ouverte",
   "statut_texte": ""
  },
  {
   "id": "Q-08",
   "section": "B. Gaines",
   "question": "Hauteur des descentes selon l'appareil (interrupteur, prise, plafonnier, applique, tableau) ?",
   "reponse": "",
   "suppose": "valeurs du v29",
   "si_doute": "avertir",
   "statut": "ouverte",
   "statut_texte": ""
  },
  {
   "id": "Q-09",
   "section": "B. Gaines",
   "question": "Longueur maximale d'une gaine ?",
   "reponse": "",
   "suppose": "pas de limite",
   "si_doute": "avertir",
   "statut": "ouverte",
   "statut_texte": ""
  },
  {
   "id": "Q-10",
   "section": "C. Circuits et couleurs",
   "question": "Nombre maximum de points lumineux par circuit d'éclairage ?",
   "reponse": "",
   "suppose": "8",
   "si_doute": "bloquer",
   "statut": "ouverte",
   "statut_texte": ""
  },
  {
   "id": "Q-11",
   "section": "C. Circuits et couleurs",
   "question": "Circuits spécialisés : liste exacte (four, plaque, LL, LV, SL, chauffe-eau, VMC, PAC, volets, sonnette…), section et protection de chacun ?",
   "reponse": "",
   "suppose": "table du v28",
   "si_doute": "bloquer",
   "statut": "ouverte",
   "statut_texte": ""
  },
  {
   "id": "Q-12",
   "section": "C. Circuits et couleurs",
   "question": "3e paire de couleurs phase / neutre quand les deux premières sont prises ?",
   "reponse": "",
   "suppose": "aucune",
   "si_doute": "bloquer",
   "statut": "ouverte",
   "statut_texte": ""
  },
  {
   "id": "Q-13",
   "section": "C. Circuits et couleurs",
   "question": "Couleurs des câbles spécialisés et extérieurs (3G, 4G, 5G) ?",
   "reponse": "",
   "suppose": "couleurs du câble",
   "si_doute": "avertir",
   "statut": "ouverte",
   "statut_texte": ""
  },
  {
   "id": "Q-14",
   "section": "C. Circuits et couleurs",
   "question": "Les prises sont-elles regroupées par pièce, par zone, ou par proximité pour faire un circuit ?",
   "reponse": "",
   "suppose": "proximité",
   "si_doute": "avertir",
   "statut": "ouverte",
   "statut_texte": ""
  },
  {
   "id": "Q-15",
   "section": "C. Circuits et couleurs",
   "question": "Volets roulants : circuit propre ? commande en SC, en boîte ?",
   "reponse": "",
   "suppose": "non relevés",
   "si_doute": "bloquer",
   "statut": "ouverte",
   "statut_texte": ""
  },
  {
   "id": "Q-16",
   "section": "D. Allumages",
   "question": "Contenu exact de la gaine d'un va-et-vient (nombre de fils, couleurs : navettes, retour, phase) ?",
   "reponse": "",
   "suppose": "2 navettes + retour",
   "si_doute": "bloquer",
   "statut": "ouverte",
   "statut_texte": ""
  },
  {
   "id": "Q-17",
   "section": "D. Allumages",
   "question": "Contenu exact des gaines d'un télérupteur et d'un bouton poussoir ?",
   "reponse": "",
   "suppose": "fils dans la gaine d'alimentation",
   "si_doute": "bloquer",
   "statut": "ouverte",
   "statut_texte": ""
  },
  {
   "id": "Q-18",
   "section": "D. Allumages",
   "question": "Permutateur (3 points ou plus) : traité comment ?",
   "reponse": "",
   "suppose": "non géré",
   "si_doute": "bloquer",
   "statut": "ouverte",
   "statut_texte": ""
  },
  {
   "id": "Q-19",
   "section": "D. Allumages",
   "question": "Interrupteur à voyant (neutre) : quand est-il utilisé, quel fil en plus ?",
   "reponse": "",
   "suppose": "non géré",
   "si_doute": "bloquer",
   "statut": "ouverte",
   "statut_texte": ""
  },
  {
   "id": "Q-20",
   "section": "D. Allumages",
   "question": "Détecteur de présence, variateur, minuterie : câblage ?",
   "reponse": "",
   "suppose": "non géré",
   "si_doute": "bloquer",
   "statut": "ouverte",
   "statut_texte": ""
  },
  {
   "id": "Q-21",
   "section": "E. Raccordements et feuille de boîte",
   "question": "Connecteurs : tailles disponibles et choix quand le nombre de fils tombe entre deux tailles ?",
   "reponse": "",
   "suppose": "8 pour les tailles intermédiaires",
   "si_doute": "avertir",
   "statut": "ouverte",
   "statut_texte": ""
  },
  {
   "id": "Q-22",
   "section": "E. Raccordements et feuille de boîte",
   "question": "« Ouverture vers le haut » : sens exact ?",
   "reponse": "",
   "suppose": "non défini",
   "si_doute": "avertir",
   "statut": "ouverte",
   "statut_texte": ""
  },
  {
   "id": "Q-23",
   "section": "E. Raccordements et feuille de boîte",
   "question": "N° de circuit du tableau à afficher à côté de l'alimentation : lequel ?",
   "reponse": "",
   "suppose": "aucun",
   "si_doute": "avertir",
   "statut": "ouverte",
   "statut_texte": ""
  },
  {
   "id": "Q-24",
   "section": "F. Tableau",
   "question": "ID 40 A partout ? parafoudre, contacteur heures creuses, délesteur : par défaut dans le coffret ou fournis à part ?",
   "reponse": "",
   "suppose": "non",
   "si_doute": "avertir",
   "statut": "ouverte",
   "statut_texte": ""
  },
  {
   "id": "Q-25",
   "section": "F. Tableau",
   "question": "Hauteur du haut du tableau (1,80 m supposé) ?",
   "reponse": "",
   "suppose": "1,80 m",
   "si_doute": "avertir",
   "statut": "ouverte",
   "statut_texte": ""
  },
  {
   "id": "Q-26",
   "section": "G. Portée des règles",
   "question": "Une règle peut-elle changer selon le pavillonneur ou le chantier (ex. norme, section) ? Lesquelles ?",
   "reponse": "Oui : règles communes à tous les pavillonneurs (Kévin, 15:55)",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue"
  },
  {
   "id": "Q-27",
   "section": "G. Portée des règles",
   "question": "Que doit faire le logiciel s'il n'y a aucune solution (trop de départs, gaine trop pleine) : s'arrêter, ajouter une boîte, ou te demander ?",
   "reponse": "",
   "suppose": "te demander",
   "si_doute": "bloquer",
   "statut": "ouverte",
   "statut_texte": ""
  },
  {
   "id": "Q-28",
   "section": "G. Portée des règles",
   "question": "Qui valide une règle nouvelle : toi seul ?",
   "reponse": "",
   "suppose": "toi seul",
   "si_doute": "",
   "statut": "ouverte",
   "statut_texte": ""
  },
  {
   "id": "Q-29",
   "section": "H. Boîtes — questions du 27/10/2026 (focus actuel)",
   "question": "Une boîte peut-elle desservir plusieurs pièces et plusieurs niveaux ?",
   "reponse": "Oui, oui (R-005)",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue"
  },
  {
   "id": "Q-30",
   "section": "H. Boîtes — questions du 27/10/2026 (focus actuel)",
   "question": "Une boîte peut-elle mélanger éclairage et prises ?",
   "reponse": "Oui (R-006)",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue"
  },
  {
   "id": "Q-31",
   "section": "H. Boîtes — questions du 27/10/2026 (focus actuel)",
   "question": "Un même circuit peut-il passer par deux boîtes ?",
   "reponse": "Non (R-007)",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue"
  },
  {
   "id": "Q-32",
   "section": "H. Boîtes — questions du 27/10/2026 (focus actuel)",
   "question": "Une boîte peut-elle en alimenter une autre ?",
   "reponse": "Seulement dans un chantier spécifique : mode Plug de pieuvre (R-008, R-009)",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue"
  },
  {
   "id": "Q-33",
   "section": "H. Boîtes — questions du 27/10/2026 (focus actuel)",
   "question": "Quels appareils vont toujours en ligne directe ? (VMC, volets, chauffe-eau, sonnette ?)",
   "reponse": "Spécialisés, sorties de câble, RJ45, TV, tout le courant faible et la sonnette en ligne directe (R-003)",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue"
  },
  {
   "id": "Q-34",
   "section": "H. Boîtes — questions du 27/10/2026 (focus actuel)",
   "question": "Courant fort et courant faible dans la même boîte ou la même gaine ?",
   "reponse": "Jamais dans la même boîte ni la même gaine ; le courant faible est toujours en ligne directe (R-003)",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue"
  },
  {
   "id": "Q-35",
   "section": "H. Boîtes — questions du 27/10/2026 (focus actuel)",
   "question": "Quels appareils n'ont pas le droit de partager une gaine ?",
   "reponse": "Jamais dans une gaine partagée (R-089)",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue"
  },
  {
   "id": "Q-36",
   "section": "H. Boîtes — questions du 27/10/2026 (focus actuel)",
   "question": "Face pleine (6 gaines) : passer sur la face voisine ?",
   "reponse": "Oui, sur la face voisine, sans avertissement (R-088)",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue"
  },
  {
   "id": "Q-37",
   "section": "H. Boîtes — questions du 27/10/2026 (focus actuel)",
   "question": "Deux gaines vers le même appareil, ou un appareil sur deux gaines ?",
   "reponse": "Jamais, sauf une gaine à deux circuits pour deux appareils au même endroit (R-089)",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue"
  },
  {
   "id": "Q-38",
   "section": "H. Boîtes — questions du 27/10/2026 (focus actuel)",
   "question": "Nombre maximum de fils par connecteur ; 1,5 et 2,5 mélangés ?",
   "reponse": "Pas de maximum (ponts possibles, sans effet sur circuits ni boîtes) ; jamais de sections différentes dans une borne (R-092)",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue"
  },
  {
   "id": "Q-39",
   "section": "H. Boîtes — questions du 27/10/2026 (focus actuel)",
   "question": "Une phase peut-elle être raccordée avec la phase d'un autre circuit ?",
   "reponse": "Jamais de phase ni de neutre partagés ; terres oui (R-090)",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue"
  },
  {
   "id": "Q-40",
   "section": "H. Boîtes — questions du 27/10/2026 (focus actuel)",
   "question": "Autres liaisons interdites que tu connais déjà ?",
   "reponse": "Va-et-vient jamais coupé, salle de bain jamais sur cuisine, pas de boîte à boîte sauf Plug (R-091)",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue"
  },
  {
   "id": "Q-41",
   "section": "H. Boîtes — questions du 27/10/2026 (focus actuel)",
   "question": "Plug de pieuvre : comment les boîtes sont-elles reliées entre elles (gaine, connecteur enfichable) ?",
   "reponse": "Gaine ou connecteur, les deux à choisir dans le chantier (R-009)",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue"
  },
  {
   "id": "Q-42",
   "section": "H. Boîtes — questions du 27/10/2026 (focus actuel)",
   "question": "Plug de pieuvre : quelle boîte alimente laquelle, et combien de boîtes en chaîne au maximum ?",
   "reponse": "La boîte 2 est alimentée par la boîte 1 ; le reste est à déduire du chantier que Kévin transmettra",
   "suppose": "",
   "si_doute": "",
   "statut": "attente",
   "statut_texte": "partielle, en attente du chantier"
  },
  {
   "id": "Q-43",
   "section": "H. Boîtes — questions du 27/10/2026 (focus actuel)",
   "question": "Plug de pieuvre : quels circuits passent d'une boîte à l'autre (R-007 ne s'applique-t-elle plus) ?",
   "reponse": "Au choix : circuit réparti sur plusieurs boîtes ou limité à une boîte (R-009)",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue"
  },
  {
   "id": "Q-44",
   "section": "H. Boîtes — questions du 27/10/2026 (focus actuel)",
   "question": "Plug de pieuvre : quel chantier ou pavillonneur, et choisi à la main dans le chantier ?",
   "reponse": "choisi à la main ; Kévin transmettra un chantier de ce type",
   "suppose": "",
   "si_doute": "",
   "statut": "attente",
   "statut_texte": "en attente du chantier"
  },
  {
   "id": "Q-45",
   "section": "I. Questions issues de la bande DUCOURNEAU (27/10/2026)",
   "question": "Numérotation des raccordements : FTZ ou ta règle (R-031, terres en premier) ?",
   "reponse": "Sa règle R-031 ; FTZ écarté (R-076 archivée)",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue"
  },
  {
   "id": "Q-46",
   "section": "I. Questions issues de la bande DUCOURNEAU (27/10/2026)",
   "question": "Couleurs des navettes et retours (voir R-072)",
   "reponse": "« Je ne comprends pas la question »",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue (voir Q-58)"
  },
  {
   "id": "Q-47",
   "section": "I. Questions issues de la bande DUCOURNEAU (27/10/2026)",
   "question": "Pourquoi un bleu à I1 et I2, et du câble 3G1,5 pour L1, L1A, L2, L2A ?",
   "reponse": "Bleu à l'interrupteur si voyant ou domotique (R-083)",
   "suppose": "",
   "si_doute": "",
   "statut": "partielle",
   "statut_texte": "répondue en partie (reste Q-56)"
  },
  {
   "id": "Q-48",
   "section": "I. Questions issues de la bande DUCOURNEAU (27/10/2026)",
   "question": "Terre de l'alimentation de la plus forte section ? EQ1 / EQ2 : quelles pièces ?",
   "reponse": "EQ1 / EQ2 : salle de bain (R-080)",
   "suppose": "",
   "si_doute": "",
   "statut": "partielle",
   "statut_texte": "répondue en partie (reste Q-57)"
  },
  {
   "id": "Q-49",
   "section": "I. Questions issues de la bande DUCOURNEAU (27/10/2026)",
   "question": "Capacité d'ICTA 20 et au-delà (ICTA 25, deux gaines) ?",
   "reponse": "« Je ne sais pas, je me renseigne » ; addition des sections et place dans la gaine, même ratio pour 16 et 20 (R-074)",
   "suppose": "",
   "si_doute": "",
   "statut": "partielle",
   "statut_texte": "répondue provisoirement : Kévin garde le même ratio, ICTA 20 = 13,5 mm² (R-074), à ajuster si Kévin trouve la valeur exacte"
  },
  {
   "id": "Q-50",
   "section": "I. Questions issues de la bande DUCOURNEAU (27/10/2026)",
   "question": "18 départs sans l'alimentation ? 6 par face en la comptant ?",
   "reponse": "Règle non fixée chez eux : on garde celle de Claude (R-001)",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue"
  },
  {
   "id": "Q-51",
   "section": "I. Questions issues de la bande DUCOURNEAU (27/10/2026)",
   "question": "Volets roulants : boîte à part, maximum, commande filaire ?",
   "reponse": "Option du chantier : boîte à part ou mélangés ; pas de maximum sauf norme NF (R-079)",
   "suppose": "",
   "si_doute": "",
   "statut": "partielle",
   "statut_texte": "répondue (reste Q-61)"
  },
  {
   "id": "Q-52",
   "section": "I. Questions issues de la bande DUCOURNEAU (27/10/2026)",
   "question": "Numérotation des gaines strictement dans le sens horaire ?",
   "reponse": "Oui, strictement (R-077)",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue"
  },
  {
   "id": "Q-53",
   "section": "I. Questions issues de la bande DUCOURNEAU (27/10/2026)",
   "question": "Un seul circuit éclairage et un seul circuit prises par boîte ?",
   "reponse": "Oui",
   "suppose": "",
   "si_doute": "",
   "statut": "partielle",
   "statut_texte": "répondue (reste Q-59)"
  },
  {
   "id": "Q-54",
   "section": "I. Questions issues de la bande DUCOURNEAU (27/10/2026)",
   "question": "Repère de circuit au tableau (numéro encadré) ?",
   "reponse": "Oui, déjà sur les boîtes de l'appli (R-081)",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue"
  },
  {
   "id": "Q-55",
   "section": "I. Questions issues de la bande DUCOURNEAU (27/10/2026)",
   "question": "Appareils inconnus du logiciel : tableau de la section J.",
   "reponse": "Propositions acceptées (R-084)",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue"
  },
  {
   "id": "Q-56",
   "section": "I. Questions issues de la bande DUCOURNEAU (27/10/2026)",
   "question": "Pourquoi L1, L1A, L2, L2A sont-elles en câble 3G1,5 ?",
   "reponse": "Oui : éclairage extérieur (R-014)",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue"
  },
  {
   "id": "Q-57",
   "section": "I. Questions issues de la bande DUCOURNEAU (27/10/2026)",
   "question": "Terre de l'alimentation toujours de la plus forte section des fils de la gaine ?",
   "reponse": "Oui (R-075)",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue"
  },
  {
   "id": "Q-58",
   "section": "I. Questions issues de la bande DUCOURNEAU (27/10/2026)",
   "question": "Retours et navettes : quelle liste de couleurs, dans quel ordre (Q-46 reformulée) ?",
   "reponse": "Adapter la ronde de Kévin avec celle de FTZ, sans copier : faire mieux et plus intelligent (R-072 réécrite)",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue"
  },
  {
   "id": "Q-59",
   "section": "I. Questions issues de la bande DUCOURNEAU (27/10/2026)",
   "question": "Plus de 8 prises dans une boîte : autre boîte ?",
   "reponse": "Oui, ou 2e circuit prises dans l'alimentation ; réglable selon le mode de pieuvre (R-085)",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue"
  },
  {
   "id": "Q-60",
   "section": "I. Questions issues de la bande DUCOURNEAU (27/10/2026)",
   "question": "Hotte : en boîte ou en ligne directe, « ça dépend » de quoi ?",
   "reponse": "Choix du client ou du BE (R-086)",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue"
  },
  {
   "id": "Q-61",
   "section": "I. Questions issues de la bande DUCOURNEAU (27/10/2026)",
   "question": "Volets roulants : valeur NF C 15-100 à retenir ?",
   "reponse": "Recherchée par Claude (R-087) : pas de nombre de moteurs, limite par intensité",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue"
  },
  {
   "id": "Q-62",
   "section": "I. Questions issues de la bande DUCOURNEAU (27/10/2026)",
   "question": "Quelles couleurs pour la paire d'un 2e circuit prises dans une même boîte (et d'un 2e circuit éclairage) ?",
   "reponse": "En 2,5 : B + R + V/J ; en 1,5 : BF + R + V/J ; les couleurs ne changent pas (R-085)",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue (corrigée par Q-64)"
  },
  {
   "id": "Q-64",
   "section": "I. Questions issues de la bande DUCOURNEAU (27/10/2026)",
   "question": "Confirmer : 2e circuit en 1,5 = phase rouge + neutre bleu foncé, y compris pour un 2e circuit d'éclairage, distingué par la bague. Ce mélange (phase de l'éclairage, neutre des prises) te va ?",
   "reponse": "Non : rouge 1,5 = phase des circuits lumières, gris = phase des circuits prises, pour éviter les erreurs de câblage, quel que soit le nombre de circuits dans la boîte. 2e circuit prises 1,5 = gris + BF + V/J (R-020, R-021, R-085)",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue"
  },
  {
   "id": "Q-63",
   "section": "I. Questions issues de la bande DUCOURNEAU (27/10/2026)",
   "question": "Intensité à retenir par moteur de volet roulant (donnée fabricant, par modèle) ?",
   "reponse": "50 W par moteur (Kévin, 12:46) ; 46 moteurs sous 10 A, 73 sous 16 A (R-087)",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue"
  },
  {
   "id": "Q-65",
   "section": "K. Plan et tableau DUCOURNEAU : constats (27/10/2026)",
   "question": "Un disjoncteur d'éclairage peut-il regrouper les éclairages de deux boîtes (LI01 + LI02) ? Dans quel cas ?",
   "reponse": "Oui, sous une limite de points ou de puissance ; le circuit reste repéré par boîte (R-007 intacte)",
   "suppose": "",
   "si_doute": "",
   "statut": "reportee",
   "statut_texte": "reportée (tableau, Kévin 13:39)"
  },
  {
   "id": "Q-66",
   "section": "K. Plan et tableau DUCOURNEAU : constats (27/10/2026)",
   "question": "Quels circuits vont sur un différentiel de type A et lesquels sur AC ? Calibre : 63 A ou 40 A ?",
   "reponse": "Type A : plaque, lave-linge, sèche-linge, et selon le cas four et lave-vaisselle ; 63 A",
   "suppose": "",
   "si_doute": "",
   "statut": "reportee",
   "statut_texte": "reportée (tableau, Kévin 13:39)"
  },
  {
   "id": "Q-67",
   "section": "K. Plan et tableau DUCOURNEAU : constats (27/10/2026)",
   "question": "Parafoudre, 2 prises dans le coffret, TYWELL PRO (2 A) : toujours présents, ou selon le chantier ?",
   "reponse": "Selon le chantier (option)",
   "suppose": "",
   "si_doute": "",
   "statut": "reportee",
   "statut_texte": "reportée (tableau, Kévin 13:39)"
  },
  {
   "id": "Q-68",
   "section": "K. Plan et tableau DUCOURNEAU : constats (27/10/2026)",
   "question": "Deux convecteurs sur un même disjoncteur 16 A 1,5 : règle de regroupement (nombre, puissance) ?",
   "reponse": "Deux convecteurs par disjoncteur, sous la limite de puissance",
   "suppose": "",
   "si_doute": "",
   "statut": "reportee",
   "statut_texte": "reportée (tableau, Kévin 13:39)"
  },
  {
   "id": "Q-69",
   "section": "L. Test des règles sur DUCOURNEAU (27/10/2026, 13:50)",
   "question": "Limite de départs par boîte : 12 pour tous les chantiers (6 boîtes pour DUCOURNEAU) ou plus élevée pour IMMO CONSTRUCTION (18, comme LI03) ?",
   "reponse": "Réglable par pavillonneur (`departs_max`) ; 12 par défaut",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue : 12 départs est une règle propre à Oktéo, voulue ; DUCOURNEAU aura donc 6 boîtes (R-001)"
  },
  {
   "id": "Q-70",
   "section": "M. Bande FALGUA E6390 (27/10/2026, 14:05)",
   "question": "Télérupteur : confirmes-tu que la gaine du bouton poussoir porte phase + commande + neutre, que commande et retour utilisent chacun une couleur de la ronde, et que les lumières commandées prennent la couleur du retour ?",
   "reponse": "Oui ; neutre au bouton poussoir seulement si voyant ou domotique (R-093)",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue"
  },
  {
   "id": "Q-71",
   "section": "M. Bande FALGUA E6390 (27/10/2026, 14:05)",
   "question": "Volets roulants : quand le logiciel crée-t-il deux boîtes de volets (ici 4 et 3 moteurs) : par zone, ou à partir d'un nombre de moteurs ?",
   "reponse": "Selon le mode de pieuvre : Proximité = le plus économique ; Équilibrée = une seule boîte (R-094)",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue"
  },
  {
   "id": "Q-72",
   "section": "M. Bande FALGUA E6390 (27/10/2026, 14:05)",
   "question": "« BOUCHON » sur une gaine à câble 3G1,5 : à quoi sert-il et que doit-on écrire sur le plan ?",
   "reponse": "Petit bouchon obligatoire dans la boîte contre l'air extérieur (R-095, rectifié à 14:07)",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue"
  },
  {
   "id": "Q-73",
   "section": "M. Bande FALGUA E6390 (27/10/2026, 14:05)",
   "question": "RJ45 : gaine verte Ø20 (R-084) pour tous les pavillonneurs, ou ICTA 16 pour ALPHA CONSTRUCTIONS ?",
   "reponse": "ICTA 20V (verte Ø20) partout ; ICTA 16 des anciens chantiers abandonné (R-084)",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue"
  },
  {
   "id": "Q-74",
   "section": "M. Bande FALGUA E6390 (27/10/2026, 14:05)",
   "question": "Aqua Air et K1 à K6 : acceptes-tu mes propositions de types (tableau ci-dessus) ?",
   "reponse": "Oui, types acceptés (R-084 étendue)",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue"
  },
  {
   "id": "Q-75",
   "section": "N. Bande BATELIER JEAN LOUIS L51S078C (27/10/2026, 14:25)",
   "question": "Commande filaire de volet (CVR) : le logiciel doit-il distinguer un volet « filaire » (CVR : alimentation + marron + noir) d'un volet « connecté » (micromodule, gris + bleu clair + V/J seulement) ? Qui décide : le plan, ou un choix par volet ?",
   "reponse": "Oui, choix par volet sur le plan (R-096)",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue"
  },
  {
   "id": "Q-76",
   "section": "N. Bande BATELIER JEAN LOUIS L51S078C (27/10/2026, 14:25)",
   "question": "Velux motorisé (VEL1) et moteur de garage (MOTEUR1) : acceptes-tu de les créer comme types (Velux = comme un volet roulant dans la boîte des volets ; moteur de garage = ligne directe 1,5 GR + BF + V/J) ?",
   "reponse": "Oui",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue : types acceptés (R-084 étendue)"
  },
  {
   "id": "Q-77",
   "section": "O. Bande FONTES D2129 MAISON 1 « plan expé pieuvre » (27/10/2026, 14:35)",
   "question": "« Plan expé pieuvre » : que compare cette expérimentation (mode de pieuvre, longueur totale de gaine par boîte) ? Les longueurs par boîte sont-elles le « score » des alternatives dans l'étude (arbre d'étude, section 3 ter) ?",
   "reponse": "Oui : le score d'un mode est la longueur totale de gaine, avec le nombre de boîtes et de départs",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue : critère confirmé par Kévin (15:55) : longueur totale de gaine, puis nombre de boîtes, puis départs"
  },
  {
   "id": "Q-78",
   "section": "O. Bande FONTES D2129 MAISON 1 « plan expé pieuvre » (27/10/2026, 14:35)",
   "question": "Valides-tu les nouveaux types : interrupteur de coupure (ligne directe 1,5 R + N), climatisation (4G1,5 ICTA 20), et G EXT en 3G1,5 ICTA 16 ou 3G2,5 ICTA 20 selon le chantier ?",
   "reponse": "Oui ; G EXT selon le choix du chantier",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue : types acceptés (R-084 étendue)"
  },
  {
   "id": "Q-79",
   "section": "O. Bande FONTES D2129 MAISON 1 « plan expé pieuvre » (27/10/2026, 14:35)",
   "question": "Plaque de cuisson en 6 mm² (3 fils = 18 mm²) : FTZ la met en ICTA 20, au-delà des 13,5 mm² de R-074. Quel diamètre pour les lignes directes de grosse section (6 et 10 mm²) ?",
   "reponse": "Exception : B + R + V/J 6 mm² en ICTA 20 (R-074) ; 10 mm² : Q-81",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue"
  },
  {
   "id": "Q-80",
   "section": "O. Bande FONTES D2129 MAISON 1 « plan expé pieuvre » (27/10/2026, 14:35)",
   "question": "Terres de sections différentes (2,5 de l'alimentation, 1,5 des appareils) sur la borne n° 1 : autorisé (R-092 parle des circuits) ?",
   "reponse": "Oui : seules les terres se câblent ensemble malgré leur section (R-092)",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue"
  },
  {
   "id": "Q-81",
   "section": "O. Bande FONTES D2129 MAISON 1 « plan expé pieuvre » (27/10/2026, 14:35)",
   "question": "Ligne B + R + V/J en 10 mm² (3 × 10 mm²) : ICTA 25 (même tolérance que la plaque 6 mm² en ICTA 20) ou ICTA 32 (règle du tiers de la section de la gaine) ?",
   "reponse": "ICTA 25 (Kévin, 15:52)",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue"
  },
  {
   "id": "Q-82",
   "section": "O. Bande FONTES D2129 MAISON 1 « plan expé pieuvre » (27/10/2026, 14:35)",
   "question": "Volets roulants : les bandes FTZ ont une phase grise (GR 11) et un neutre bleu clair (B 12). Or R-021 dit « le gris est la phase des prises, et uniquement d'elles ». Le gris des volets est-il une exception voulue ?",
   "reponse": "Oui : volets en bleu clair + gris + vert/jaune, validé ; R-021 modifiée",
   "suppose": "",
   "si_doute": "",
   "statut": "repondue",
   "statut_texte": "répondue"
  },
  {
   "id": "Q-83",
   "section": "O. Bande FONTES D2129 MAISON 1 « plan expé pieuvre » (27/10/2026, 14:35)",
   "question": "Radiateurs à fil pilote : FTZ met le fil pilote en noir (C1 à C3) et en ivoire (C4) sur DUCOURNEAU. Une couleur par zone de chauffage, ou une seule couleur ?",
   "reponse": "Peut-être une couleur par zone de chauffage (Kévin, pas sûr) ; noir pour tous en attendant, à vérifier",
   "suppose": "",
   "si_doute": "",
   "statut": "attente",
   "statut_texte": "en attente (collègue qualifié)"
  },
  {
   "id": "Q-84",
   "section": "O. Bande FONTES D2129 MAISON 1 « plan expé pieuvre » (27/10/2026, 14:35)",
   "question": "Calibres non relevés sur les tableaux : moteur de garage, climatisation, prise extérieure 4G1,5, G EXT (16 A supposé). Quels calibres ?",
   "reponse": "16 A, à vérifier",
   "suppose": "",
   "si_doute": "",
   "statut": "attente",
   "statut_texte": "en attente (collègue qualifié)"
  },
  {
   "id": "Q-85",
   "section": "O. Bande FONTES D2129 MAISON 1 « plan expé pieuvre » (27/10/2026, 14:35)",
   "question": "Module Aqua Air : la bande MAILLARD du BE n'a qu'une ligne directe (alimentation 3G2,5 ICTA 20) ; R-084 (Q-74) ajoute une ligne de pilotage 3×1,5 ICTA 16. Une ligne ou deux ?",
   "reponse": "Deux lignes (R-084), à vérifier",
   "suppose": "",
   "si_doute": "",
   "statut": "attente",
   "statut_texte": "en attente (Thibault)"
  },
  {
   "id": "Q-86",
   "section": "O. Bande FONTES D2129 MAISON 1 « plan expé pieuvre » (27/10/2026, 14:35)",
   "question": "Mise à jour 62 (Kévin, 28/10/2026, 08:45 : « économique, c'est le moins de cuivre ») : le critère Q-77 « plus petite longueur totale de gaine, puis boîtes, puis départs » devient-il « le moins de cuivre (longueur de chaque gaine × nombre de fils), dans la limite d'une belle pieuvre » ? Proposition de note « belle pieuvre » commune à tous les modes : aucun croisement de gaines dans une même boîte (obligatoire), pas d'appareil d'une boîte au milieu de ceux d'une autre, cuivre, gaine, nombre de boîtes (une boîte de plus vaut 25 m de fil, réglable), départs équilibrés, gaines de plus de 12 m, pièces par boîte",
   "reponse": "Mode Économique = le moins de cuivre (avec le coût d'une boîte) ; l'étude garde le rang Q-77 et affiche la note à côté",
   "suppose": "",
   "si_doute": "",
   "statut": "ouverte",
   "statut_texte": "ouverte (proposée par Claude)"
  },
  {
   "id": "Q-87",
   "section": "O. Bande FONTES D2129 MAISON 1 « plan expé pieuvre » (27/10/2026, 14:35)",
   "question": "Volets roulants selon le mode (R-094) : en Par pièce, chaque volet dans la boîte de sa pièce ? En Équilibrée, deux boîtes de volets quand les volets sont aux deux bouts de la maison (plus de 14 m entre les extrêmes et 40 % de gaine en moins) ?",
   "reponse": "Oui aux deux (MAILLARD reste à une boîte de volets, comme le BE)",
   "suppose": "",
   "si_doute": "",
   "statut": "ouverte",
   "statut_texte": "ouverte (proposée par Claude)"
  }
 ],
 "history": [
  {
   "id": "H-001",
   "date": "27/10/2026",
   "regle": "R-001 à R-060",
   "action": "Création",
   "avant": "—",
   "apres": "Statut `a_valider`",
   "motif": "Reprise des règles du journal de développement",
   "par": "IA",
   "code_valide": null
  },
  {
   "id": "H-002",
   "date": "27/10/2026",
   "regle": "Journal",
   "action": "Renommé « Journal des règles de câblage » ; ajout de la gestion du doute et du registre de 28 questions",
   "avant": "Journal de règles",
   "apres": "Journal des règles de câblage",
   "motif": "Demande de Kévin : zéro erreur silencieuse",
   "par": "IA",
   "code_valide": null
  },
  {
   "id": "H-003",
   "date": "27/10/2026",
   "regle": "R-005 à R-009",
   "action": "Création",
   "avant": "—",
   "apres": "R-005 à R-008 `active` · `confirmee` ; R-009 `brouillon` · `inconnue`",
   "motif": "Réponses de Kévin Q-29 à Q-32 ; focus sur le câblage des boîtes ; nouveau mode Plug de pieuvre",
   "par": "IA",
   "code_valide": null
  },
  {
   "id": "H-004",
   "date": "27/10/2026",
   "regle": "R-070 à R-082",
   "action": "Création",
   "avant": "—",
   "apres": "`a_valider` · `supposee`",
   "motif": "Relecture de la bande DUCOURNEAU (AF26075150) : 13 règles déduites, 7 règles confirmées, questions Q-45 à Q-55, tableau des appareils inconnus",
   "par": "IA",
   "code_valide": null
  },
  {
   "id": "H-005",
   "date": "27/10/2026",
   "regle": "R-001, R-031, R-074, R-076, R-077, R-079 à R-084",
   "action": "Modification",
   "avant": "Voir H-004",
   "apres": "R-001, R-031, R-077, R-081, R-083, R-084 `active` · `confirmee` ; R-076 `archivee` ; R-074, R-079, R-080 précisées ; Q-56 à Q-61 ajoutées",
   "motif": "Réponses de Kévin du 27/10/2026 (11:45) aux Q-45 à Q-55",
   "par": "IA (validée par Kévin)",
   "code_valide": null
  },
  {
   "id": "H-006",
   "date": "27/10/2026",
   "regle": "R-014, R-072, R-075, R-079, R-085 à R-087",
   "action": "Modification et création",
   "avant": "R-072 : constat FTZ",
   "apres": "R-072 : ronde Oktéo ; R-014 `confirmee` ; R-085, R-086 `confirmee` ; R-087 `a_valider` ; Q-62 et Q-63 ajoutées",
   "motif": "Réponses de Kévin du 27/10/2026 (11:52) ; recherche de la norme NF C 15-100 pour les volets roulants",
   "par": "IA (validée par Kévin)",
   "code_valide": null
  },
  {
   "id": "H-007",
   "date": "27/10/2026",
   "regle": "R-085",
   "action": "Modification",
   "avant": "Couleurs du 2e circuit : Q-62",
   "apres": "Couleurs fixées par la section (2,5 : B + R + V/J ; 1,5 : BF + R + V/J) ; Q-64 ajoutée",
   "motif": "Réponse de Kévin du 27/10/2026 (11:56)",
   "par": "IA (validée par Kévin)",
   "code_valide": null
  },
  {
   "id": "H-008",
   "date": "27/10/2026",
   "regle": "R-001 ; journal",
   "action": "Modification et création",
   "avant": "R-001 : 18 départs",
   "apres": "R-001 : 12 départs ; section 3 bis « Arbre des règles » ; champs `noeud`, `depends_on`, `choix`",
   "motif": "Demande de Kévin du 27/10/2026 (12:00)",
   "par": "IA (validée par Kévin)",
   "code_valide": null
  },
  {
   "id": "H-009",
   "date": "27/10/2026",
   "regle": "Journal",
   "action": "Modification et création",
   "avant": "Section 3 bis : arbre mêlant règles et chantier",
   "apres": "3 bis : arbre de nos règles (navigation, dépendances, usage) ; 3 ter : arbre d'étude (trace du calcul, états, « où ça coince », statistiques)",
   "motif": "Précision de Kévin du 27/10/2026 (12:07) : deux arbres distincts",
   "par": "IA (validée par Kévin)",
   "code_valide": null
  },
  {
   "id": "H-010",
   "date": "27/10/2026",
   "regle": "Journal",
   "action": "Modification",
   "avant": "3 bis : arbre des règles ; 3 ter : arbre d'étude",
   "apres": "3 bis : tableau filtrable + fiche de règle ; 3 ter : bande de 9 étapes, « Où ça coince », « Pourquoi ? », tableau de statistiques ; champs `noeud`, `depends_on`, `choix` conservés",
   "motif": "Avis de Claude validé par Kévin le 27/10/2026 (12:30) : l'arbre n'apporte pas de valeur en profondeur",
   "par": "IA (validée par Kévin)",
   "code_valide": null
  },
  {
   "id": "H-011",
   "date": "27/10/2026",
   "regle": "R-020, R-021, R-024, R-074, R-085",
   "action": "Modification",
   "avant": "R-085 : 2e circuit en 1,5 avec phase rouge ; ICTA 20 provisoire",
   "apres": "R-020, R-021 `active` · `confirmee` (rouge 1,5 = lumières, gris = prises, jamais mélangés) ; R-085 : 2e circuit prises 1,5 = gris + BF + V/J ; R-024 : exception du 2e circuit ; ICTA 20 = 13,5 mm² retenue ; Q-64 répondue, Q-49 répondue provisoirement",
   "motif": "Réponse de Kévin du 27/10/2026 (12:43)",
   "par": "IA (validée par Kévin)",
   "code_valide": null
  },
  {
   "id": "H-012",
   "date": "27/10/2026",
   "regle": "R-087",
   "action": "Modification",
   "avant": "Puissance d'un moteur à renseigner",
   "apres": "50 W par moteur ; 46 moteurs sous 10 A, 73 sous 16 A ; calibre par défaut 10 A ; Q-63 répondue",
   "motif": "Réponse de Kévin du 27/10/2026 (12:46)",
   "par": "IA (validée par Kévin)",
   "code_valide": null
  },
  {
   "id": "H-013",
   "date": "27/10/2026",
   "regle": "R-009",
   "action": "Modification",
   "avant": "Plug de pieuvre : définition vide",
   "apres": "Liaison gaine ou connecteur (choix) ; circuits répartis ou limités à une boîte (choix) ; restent Q-42 et Q-44, en attente d'un chantier",
   "motif": "Réponse de Kévin du 27/10/2026 (12:51)",
   "par": "IA (validée par Kévin)",
   "code_valide": null
  },
  {
   "id": "H-014",
   "date": "27/10/2026",
   "regle": "R-003, R-082",
   "action": "Modification",
   "avant": "R-003 `a_valider`",
   "apres": "R-003 `active` · `confirmee` : courant faible et sonnette en ligne directe, courant fort et faible jamais ensemble ; Q-33 et Q-34 répondues",
   "motif": "Réponse de Kévin du 27/10/2026 (12:55)",
   "par": "IA (validée par Kévin)",
   "code_valide": null
  },
  {
   "id": "H-015",
   "date": "27/10/2026",
   "regle": "R-088 à R-091",
   "action": "Création",
   "avant": "—",
   "apres": "Liaisons possibles et interdites `active` · `confirmee` ; Q-35, Q-36, Q-37, Q-39, Q-40 répondues ; Q-38 à reformuler (répondue ensuite, H-016)",
   "motif": "Réponse de Kévin du 27/10/2026 (13:02)",
   "par": "IA (validée par Kévin)",
   "code_valide": null
  },
  {
   "id": "H-016",
   "date": "27/10/2026",
   "regle": "R-092",
   "action": "Création",
   "avant": "—",
   "apres": "Bornes : pas de limite de fils, jamais de sections mélangées ; Q-38 répondue",
   "motif": "Réponse de Kévin du 27/10/2026 (13:04)",
   "par": "IA (validée par Kévin)",
   "code_valide": null
  },
  {
   "id": "H-017",
   "date": "27/10/2026",
   "regle": "Journal (section K)",
   "action": "Création",
   "avant": "—",
   "apres": "Constats du plan et du tableau DUCOURNEAU ; Q-65 à Q-68 ; R-050 à corriger (63 A)",
   "motif": "Plan transmis par Kévin le 27/10/2026 (13:37)",
   "par": "IA (validée par Kévin)",
   "code_valide": null
  },
  {
   "id": "H-018",
   "date": "27/10/2026",
   "regle": "Q-65 à Q-68",
   "action": "Modification",
   "avant": "`ouverte`",
   "apres": "`reportée` : le tableau sera traité plus tard",
   "motif": "Décision de Kévin du 27/10/2026 (13:39)",
   "par": "IA (validée par Kévin)",
   "code_valide": null
  },
  {
   "id": "H-019",
   "date": "27/10/2026",
   "regle": "Journal (section L)",
   "action": "Création",
   "avant": "—",
   "apres": "Test de R-001, R-021, R-022, R-074, R-075, R-077, R-081 sur DUCOURNEAU ; écarts sur le nombre de départs ; Q-69",
   "motif": "Demande de Kévin du 27/10/2026 (13:41)",
   "par": "IA (validée par Kévin)",
   "code_valide": null
  },
  {
   "id": "H-020",
   "date": "27/10/2026",
   "regle": "R-001, Q-69",
   "action": "Confirmation",
   "avant": "12 départs, écart avec FTZ à vérifier",
   "apres": "12 départs confirmé pour tous les chantiers ; l'écart avec FTZ (15 à 18) est voulu",
   "motif": "Réponse de Kévin du 27/10/2026 (13:45)",
   "par": "IA (validée par Kévin)",
   "code_valide": null
  },
  {
   "id": "H-021",
   "date": "27/10/2026",
   "regle": "Journal (section M)",
   "action": "Création",
   "avant": "—",
   "apres": "Bande FALGUA E6390 (ALPHA CONSTRUCTIONS) : 8 boîtes, télérupteur, volets en 2 boîtes, appareils Aqua Air ; Q-70 à Q-74",
   "motif": "Bande et plan transmis par Kévin le 27/10/2026 (13:47)",
   "par": "IA (validée par Kévin)",
   "code_valide": null
  },
  {
   "id": "H-022",
   "date": "27/10/2026",
   "regle": "R-084, R-093 à R-095",
   "action": "Création et modification",
   "avant": "Q-70 à Q-74 ouvertes",
   "apres": "R-093 (télérupteur), R-094 (volets selon le mode de pieuvre), R-095 (bouchon) `active` · `confirmee` ; R-084 étendue (ICTA 20V partout, types Aqua Air) ; Q-70 à Q-74 répondues",
   "motif": "Réponses de Kévin du 27/10/2026 (14:06)",
   "par": "IA (validée par Kévin)",
   "code_valide": null
  },
  {
   "id": "H-023",
   "date": "27/10/2026",
   "regle": "R-095",
   "action": "Modification",
   "avant": "Bouchon : option",
   "apres": "Bouchon obligatoire pour les gaines qui amènent l'air extérieur",
   "motif": "Rectification de Kévin du 27/10/2026 (14:07)",
   "par": "IA (validée par Kévin)",
   "code_valide": null
  },
  {
   "id": "H-024",
   "date": "27/10/2026",
   "regle": "Journal (section N)",
   "action": "Création",
   "avant": "—",
   "apres": "Bande BATELIER JEAN LOUIS (MAISONS LARA) : 7 boîtes, règles confirmées, CVR et Velux ; Q-75 et Q-76",
   "motif": "Bande et plans transmis par Kévin le 27/10/2026 (14:08)",
   "par": "IA (validée par Kévin)",
   "code_valide": null
  },
  {
   "id": "H-025",
   "date": "27/10/2026",
   "regle": "R-084, R-096",
   "action": "Création et modification",
   "avant": "Q-75, Q-76 ouvertes",
   "apres": "R-096 `active` · `confirmee` (volet filaire ou connecté) ; Velux et moteur de garage ajoutés à R-084 ; Q-75, Q-76 répondues",
   "motif": "Réponses de Kévin du 27/10/2026 (14:12)",
   "par": "IA (validée par Kévin)",
   "code_valide": null
  },
  {
   "id": "H-026",
   "date": "27/10/2026",
   "regle": "Journal (section O)",
   "action": "Création",
   "avant": "—",
   "apres": "Bande FONTES D2129 MAISON 1 (POLYGONE 46) : 4 boîtes, longueur totale par boîte, I COUPURE, CLIM ; Q-77 et Q-78",
   "motif": "Bande et plan transmis par Kévin le 27/10/2026 (14:20)",
   "par": "IA (validée par Kévin)",
   "code_valide": null
  },
  {
   "id": "H-027",
   "date": "27/10/2026",
   "regle": "R-084, Q-77, Q-78",
   "action": "Modification",
   "avant": "Q-78 ouverte",
   "apres": "Types acceptés (coupure, climatisation, G EXT) ; Q-77 reformulée",
   "motif": "Réponse de Kévin du 27/10/2026 (14:21)",
   "par": "IA (validée par Kévin)",
   "code_valide": null
  },
  {
   "id": "H-028",
   "date": "27/10/2026",
   "regle": "Journal",
   "action": "Modification",
   "avant": "En-tête et notes obsolètes (limite de 18, « toutes à valider »)",
   "apres": "En-tête à jour (52 règles), regroupement par catégorie complété, doublon de R-084 retiré, section 6 mise à jour",
   "motif": "Préparation de la passation au développement, demande de Kévin du 27/10/2026 (14:22)",
   "par": "IA (validée par Kévin)",
   "code_valide": null
  },
  {
   "id": "H-029",
   "date": "27/10/2026",
   "regle": "R-075",
   "action": "Modification",
   "avant": "Alimentation avec les numéros FTZ (R 1 / B 2, GR 3 / BF 4, R 7 / B 8, terre 9, GR 11 / B 12)",
   "apres": "Couleurs seules ; numérotation selon R-031 (terres n° 1)",
   "motif": "Contradiction avec R-031 relevée au développement ; Kévin : « on conserve notre règle » (14:29)",
   "par": "IA (validée par Kévin)",
   "code_valide": null
  },
  {
   "id": "H-030",
   "date": "27/10/2026",
   "regle": "Q-79, Q-80",
   "action": "Création",
   "avant": "—",
   "apres": "Deux questions ouvertes",
   "motif": "Cas rencontrés en appliquant R-074 et R-092 au câblage (mise à jour 52)",
   "par": "IA",
   "code_valide": null
  },
  {
   "id": "H-031",
   "date": "27/10/2026",
   "regle": "R-074",
   "action": "Modification",
   "avant": "Au-delà de 13,5 mm² : doute",
   "apres": "Exception : plaque B + R + V/J 6 mm² en ICTA 20 ; Q-79 répondue, Q-81 ouverte (10 mm²)",
   "motif": "Réponse de Kévin du 27/10/2026 (15:50)",
   "par": "IA (validée par Kévin)",
   "code_valide": null
  },
  {
   "id": "H-032",
   "date": "27/10/2026",
   "regle": "R-092",
   "action": "Modification",
   "avant": "Sections jamais mélangées sur une borne",
   "apres": "Sauf les terres, raccordées ensemble quelle que soit leur section ; Q-80 répondue",
   "motif": "Réponse de Kévin du 27/10/2026 (15:50)",
   "par": "IA (validée par Kévin)",
   "code_valide": null
  },
  {
   "id": "H-033",
   "date": "27/10/2026",
   "regle": "R-074",
   "action": "Modification",
   "avant": "10 mm² : en attente",
   "apres": "Exception : B + R + V/J 10 mm² en ICTA 25 ; Q-81 répondue",
   "motif": "Réponse de Kévin du 27/10/2026 (15:52)",
   "par": "IA (validée par Kévin)",
   "code_valide": null
  },
  {
   "id": "H-034",
   "date": "27/10/2026",
   "regle": "R-094, R-097, Q-26, Q-77",
   "action": "Modification et création",
   "avant": "Q-26, Q-77 ouvertes ; AIG2 à préciser",
   "apres": "Critère « plus économique » confirmé ; règles communes à tous les pavillonneurs ; R-097 gaine aiguillée en attente",
   "motif": "Réponses de Kévin du 27/10/2026 (15:55)",
   "par": "IA (validée par Kévin)",
   "code_valide": null
  },
  {
   "id": "H-035",
   "date": "27/10/2026",
   "regle": "Q-82 à Q-84",
   "action": "Création",
   "avant": "—",
   "apres": "Trois questions ouvertes",
   "motif": "Cas rencontrés en ajoutant les appareils de R-084 (mise à jour 54)",
   "par": "IA",
   "code_valide": null
  },
  {
   "id": "H-036",
   "date": "27/10/2026",
   "regle": "R-021, R-079, Q-82 à Q-84",
   "action": "Modification",
   "avant": "R-021 : gris = prises seulement ; R-079 à valider",
   "apres": "R-021 : gris = phase des prises et des volets (neutre bleu clair pour les volets) ; R-079 confirmée ; Q-83 et Q-84 en attente d'un collègue plus qualifié",
   "motif": "Réponse de Kévin du 27/10/2026 (18:39)",
   "par": "IA (validée par Kévin)",
   "code_valide": null
  },
  {
   "id": "H-037",
   "date": "27/10/2026",
   "regle": "R-077",
   "action": "Modification",
   "avant": "Sens horaire depuis l'alimentation",
   "apres": "Sens anti-horaire depuis l'alimentation (.01 reste l'alimentation) : numéros lus de gauche à droite sur chaque face",
   "motif": "Demande de Kévin du 27/10/2026 (23:19, précisée à 23:21)",
   "par": "IA (validée par Kévin)",
   "code_valide": null
  },
  {
   "id": "H-038",
   "date": "28/10/2026",
   "regle": "R-001",
   "action": "Modification",
   "avant": "12 départs hors alimentation",
   "apres": "16 départs hors alimentation",
   "motif": "Bande MAILLARD du BE (jusqu'à 15 départs), réponse de Kévin du 28/10/2026 (00:01)",
   "par": "IA (validée par Kévin)",
   "code_valide": null
  },
  {
   "id": "H-039",
   "date": "28/10/2026",
   "regle": "R-023, R-084, R-098, R-099, Q-85",
   "action": "Modification et création",
   "avant": "—",
   "apres": "Violet confirmé dans la ronde ; types îlot, BPS, sonnette ; R-098 prises de plan de travail ; R-099 total des gaines des lignes directes ; Q-85 (Aqua Air) en attente de Thibault",
   "motif": "Comparaison avec la bande MAILLARD du BE, réponses de Kévin du 28/10/2026 (00:01)",
   "par": "IA (validée par Kévin)",
   "code_valide": null
  },
  {
   "id": "H-040",
   "date": "28/10/2026",
   "regle": "R-098, R-084",
   "action": "Modification",
   "avant": "—",
   "apres": "R-098 : reconnaissance des prises de plan de travail (1,00–1,30 m, cuisine ou près d'un appareil de cuisine) ; îlot sur le disjoncteur d'un circuit prises",
   "motif": "Réponses de Kévin du 28/10/2026 (00:13)",
   "par": "IA (validée par Kévin)",
   "code_valide": null
  },
  {
   "id": "H-041",
   "date": "28/10/2026",
   "regle": "R-073, R-094, R-096, R-100",
   "action": "Modification et création",
   "avant": "—",
   "apres": "R-073 : commande + prises dans une gaine, sans ICTA 25 dans les boîtes ; R-094 : mode Équilibrée = le moins de boîtes ; R-096 : filaire / connecté décidé par le BE ; R-100 : équipements hors plan, registre (MAILLARD)",
   "motif": "Comparaison Oktéo / BE sur MAILLARD, réponses de Kévin du 28/10/2026 (00:32)",
   "par": "IA (validée par Kévin)",
   "code_valide": null
  },
  {
   "id": "H-042",
   "date": "28/10/2026",
   "regle": "R-094, Q-77, Q-86, Q-87",
   "action": "Proposition",
   "avant": "Q-86, Q-87 ouvertes",
   "apres": "Mise à jour 62 : mode Économique = le moins de cuivre, note « belle pieuvre » commune ; volets en Par pièce dans la boîte de leur pièce, deux boîtes de volets en Équilibrée si les volets sont aux deux bouts de la maison (supposés, à valider)",
   "motif": "Réponses de Kévin du 28/10/2026 (08:38–08:46), décisions laissées à Claude",
   "par": "IA (à valider par Kévin)",
   "code_valide": null
  }
 ]
};
