// Catalogue des règles KiTéOHM (lot 1 de la page Paramètres, 06/11/2026, demande de Kévin).
// Pur (sans DOM) : la page Paramètres (src/ext/settings.js) l'affiche, l'export « catalogue » le met en texte.
//
// Une FICHE = une règle lisible par un opérateur BE : ce qu'Oktéo fait (valeur), pourquoi (d'où ça vient), son état,
// où elle sert. Les fiches viennent de l'étude des fichiers FTZ de KiTéOHM (décisions de Kévin du 06/11/2026, tenues
// dans le document « decisions-ftz » du projet claude.ai, n° 1 à 69) : on reprend le savoir du BE, pas la forme de FTZ.
// RÈGLES DE CONFIDENTIALITÉ : aucun prix, aucun code article commercial, aucun nom de client ni de personne du BE ici
// (dépôt public) ; aucun texte de norme (seulement nos résumés, voir src/norme/nfc15100.js).
//
// Un identifiant de fiche (CB-01…) ne change jamais. État :
//   actif    = appliquée par Oktéo aujourd'hui
//   decide   = décidée, pas encore appliquée (sera intégrée rubrique par rubrique)
//   question = en attente d'une réponse du BE
//   plustard = repoussée (impression, plomberie…)
//   ecarte   = étudiée et écartée
//   info     = repère pour comprendre (rien à appliquer)

export const ETATS = {
  actif: { label: "Appliquée par Oktéo", court: "Appliquée", sym: "✓" },
  decide: { label: "Décidée, à intégrer", court: "À intégrer", sym: "●" },
  question: { label: "Question au BE", court: "Question", sym: "?" },
  plustard: { label: "Plus tard", court: "Plus tard", sym: "…" },
  ecarte: { label: "Écartée", court: "Écartée", sym: "✕" },
  info: { label: "Pour information", court: "Info", sym: "i" },
};

// rubriques de la page Paramètres : g = "kiteohm" (règles de l'entreprise) ou "poste" (réglages de ce PC)
export const RUBRIQUES = [
  { id: "chantier", g: "kiteohm", titre: "Chantier et clients", intro: "Ce qu'Oktéo doit savoir d'une affaire avant de dessiner : identité, finitions commandées, consignes du pavillonneur, pièces du dossier, contraintes de construction." },
  { id: "appareils", g: "kiteohm", titre: "Appareils", intro: "Ce qu'on pose sur le plan : catalogue, variantes, groupes en un clic, hauteurs, kits matériel, implantation type des pièces (packs)." },
  { id: "cablage", g: "kiteohm", titre: "Câblage", intro: "Comment les appareils sont reliés : circuits, couleurs des fils, association au même endroit, composition des gaines par type d'appareil." },
  { id: "conducteurs", g: "kiteohm", titre: "Fils, câbles et gaines", intro: "Ce qu'on met dans les gaines : fils et câbles disponibles, place occupée, capacité des gaines, longueurs et surlongueurs." },
  { id: "pieuvres", g: "kiteohm", titre: "Pieuvres et boîtes", intro: "Où vont les boîtes et comment elles sont chargées : départs par boîte, connecteurs, obstacles, couleurs des boîtes, vues du plan." },
  { id: "tableau", g: "kiteohm", titre: "Tableau", intro: "Le tableau électrique : calibres, appareils par départ, différentiels, modulaires et domotique, tableaux types, coffrets." },
  { id: "norme", g: "kiteohm", titre: "Norme NF C 15-100", intro: "Les minimums de la norme, contrôlés par-dessus nos règles. Ce sont des alertes simples : rien n'est bloqué, l'impression reste possible. Résumés avec nos mots, l'article sert à vérifier dans la norme." },
  { id: "fabrication", g: "kiteohm", titre: "Fabrication et échanges", intro: "Ce qui part du BE : fichier .spv pour Counter, export vers ALTIOR, totaux du planning du BE, documents imprimés." },
  { id: "journal", g: "kiteohm", titre: "Journal des règles (R-…)", intro: "Toutes les règles de câblage écrites avec le BE depuis le début, avec leurs preuves et leurs questions." },
  { id: "questions", g: "kiteohm", titre: "Questions au BE", intro: "Ce qu'il reste à demander au BE avant d'appliquer certaines règles. En attendant la réponse, Oktéo fait comme FTZ." },
  { id: "historique", g: "kiteohm", titre: "Historique", intro: "Les réglages changés sur ce poste : quand, quoi, ancienne et nouvelle valeur." },
  { id: "affichage", g: "poste", titre: "Affichage", intro: "Thème clair ou sombre et ce qu'on voit sur le plan. Réglages de ce PC, pour tous les chantiers." },
  { id: "ia", g: "poste", titre: "Assistant et IA", intro: "Clés, modèles, lecture du plan par l'IA, coûts d'un chantier." },
  { id: "releve", g: "poste", titre: "Relevé des plans", intro: "Murs remis d'équerre après un relevé." },
  { id: "v3d", g: "poste", titre: "Vue 3D", intro: "Hauteurs utilisées par la 3D quand le dessin ne les donne pas." },
  { id: "clavier", g: "poste", titre: "Raccourcis et Stream Deck", intro: "Les touches du BE et le Stream Deck." },
];

const F = (id, rub, etat, titre, valeur, pourquoi, extra = {}) => ({ id, rub, etat, titre, valeur, pourquoi, ...extra });
const FTZ = "Pratique du BE, reprise de FTZ";

// fiches (n = n° de la décision dans « decisions-ftz » ; cab = réglages d'Oktéo liés, affichés avec leur valeur actuelle ;
// usage = où la règle sert dans Oktéo ; source = d'où elle vient)
export const FICHES = [
  // ---- Chantier et clients
  F("CH-01", "chantier", "actif", "Identité de l'affaire", "N° d'affaire (AF…), pavillonneur, nom du client, nom du chantier.",
    "Ces champs sont écrits dans le fichier .spv, l'export ALTIOR et le planning du BE. Ils sont dans la fiche du chantier (accueil) : « N° d'affaire », « Pavillonneur », « Nom » ; le .spv signale ceux qui manquent.",
    { n: [54], source: "Format du .spv et de l'export ALTIOR", usage: "Fiche du chantier, .spv, ALTIOR, planning" }),
  F("CH-02", "chantier", "decide", "Finitions commandées", "Par famille (appareillage, étanche intérieur et extérieur, éclairage, VMC, tableau) : marque, gamme, couleur, plaque. Exemple : SCHNEIDER · ODACE · BLANC · BLANC.",
    "ALTIOR choisit le vrai produit d'après ces finitions. Elles sont lues dans le fichier passerelle d'ALTIOR (une ligne par affaire), comme le fait FTZ, et restent modifiables.",
    { n: [61], source: "Fichier passerelle ALTIOR → FTZ", usage: "Fiche du chantier, export ALTIOR" }),
  F("CH-03", "chantier", "question", "Consignes du pavillonneur", "16 consignes par pavillonneur : mode constructif, cloisons, fils et norme, prises intérieures et extérieures, boîtes de dérivation, réseau, neutre sur interrupteur, lumière extérieure, type de postes, boîte micromodule, commande et emplacement des volets, réseau de terre, parafoudre, prises modulaires.",
    "Elles sont dans la fiche chantier du BE. À terme Oktéo la consultera (lecture seule) pour pré-remplir les choix du chantier ; le BE garde la main et tout écart est noté au rapport, comme pour le parafoudre. En attente du format d'échange avec la nouvelle application des fiches chantier.",
    { n: [65, 69], source: "Fiche chantier du BE", usage: "Choix du chantier (volets, parafoudre, pontage…)" }),
  F("CH-04", "chantier", "decide", "Pièces du dossier", "Plan client à jour, devis, coupes, plan cuisine, étude thermique, étude VMC, documentation du chauffage, emplacements U INT, CETH, G EXT, convecteurs et tableau, photos, PMR.",
    "La fiche chantier les vérifie avant la production. Oktéo reconnaît déjà le rôle des pages du dossier (plan, cuisine, devis, VMC) : il proposera ces cases, sans remplacer la fiche chantier.",
    { n: [66], source: "Fiche chantier du BE", usage: "Chantiers, rôle des pages" }),
  F("CH-05", "chantier", "question", "Contraintes de construction", "Passage sous poutre oui / non, garage à contourner, combles perdus ou aménageables, charpente traditionnelle, étage, sous-sol, toit plat.",
    "Elles changent la pose des pieuvres : zones interdites aux boîtes, passages imposés. Les règles exactes restent à écrire avec le BE.",
    { n: [67], source: "Fiche chantier du BE", usage: "Placement des boîtes et des gaines" }),
  F("CH-06", "chantier", "decide", "Abréviations des pièces", "BUAND, CH1…, DEGT, SDE1, WC2… (la table complète se règle plus bas).",
    "Les noms courts des pièces sur les plans et les bandes du BE. On reprend ceux du BE.",
    { n: [6], source: FTZ, usage: "Plan imprimé, bandes, .spv", ancre: "ps-abrev" }),
  F("CH-07", "chantier", "actif", "Pièce par défaut", "Cellier, garage, extérieur… selon le type de départ.",
    "Seulement quand la pièce d'un appareil est inconnue. Sinon Oktéo garde la pièce lue sur le plan. Appliqué le 06/11/2026 (lot 7) dans le .spv : moteur de porte de garage → GARAGE, appareil dehors → EXTERIEUR, le reste → CELLIER.",
    { n: [15], source: FTZ, usage: "Circuits, .spv" }),
  F("CH-08", "chantier", "actif", "Dossier SharePoint du chantier", "Un lien vers le dossier de l'affaire, construit d'après le n° d'affaire.",
    "Le BE l'ouvre depuis le logiciel au lieu de le chercher. Appliqué le 06/11/2026 (lot 8) : modèle d'adresse avec {affaire} ci-dessous (réglage du poste) ; la fiche du chantier montre « Dossier SharePoint ↗ » dès qu'il y a un n° d'affaire.",
    { n: [33], source: FTZ, usage: "Fiche du chantier" }),

  // ---- Appareils
  F("AP-01", "appareils", "actif", "Option « étanche »", "Applique, prise, interrupteur, bouton poussoir, sortie de câble, prises 20 et 32 A.",
    "Une option de l'appareil, pas un appareil de plus : le symbole et le câblage restent les mêmes, le kit matériel change. Appliqué le 06/11/2026 (lot 3) : case « Étanche (IP) » dans Propriétés ; le kit matériel suivra avec l'export ALTIOR.",
    { n: [19], source: FTZ, usage: "Propriétés de l'appareil, export ALTIOR" }),
  F("AP-02", "appareils", "decide", "Appareils à ajouter", "Prise commandée, prise congélateur, gâche + bouton, interrupteur temporisé, contact de fenêtre, sèche-serviette par puissance, bouches VMC, borne de recharge, téléreport, KNX, détection incendie, désenfumage, arrêt d'urgence, chauffage complet (thermostat, gestionnaire, fil pilote, PAC intérieure et extérieure, split, sonde, T-ONE, interconnexions)…",
    "Toutes les catégories du BE absentes d'Oktéo sont reprises, avec leur composition de gaine (à valider par le BE).",
    { n: [20], source: FTZ, usage: "Barre des appareils, câblage" }),
  F("AP-03", "appareils", "decide", "Variantes des appareils", "Haute, cuisine, hotte, îlot, extérieure, USB / USB-C, HDMI, connectée, bus, variateur, volet micromodule, prises de communication, répartiteurs TV, supports box…",
    "La bibliothèque du BE compte environ 500 symboles. On reprend les variantes utiles ; la plomberie viendra plus tard.",
    { n: [49], source: FTZ, usage: "Barre des appareils, propriétés" }),
  F("AP-04", "appareils", "actif", "Groupes en un clic", "PC+RJ, PC+TV, PC+RJ+TV, 2PC+2RJ+TV, 3PC+2RJ+TV, RJ+RJ, RJ+TV, 2PC, 3PC, 3PC cuisine, SA+SA, SA+VV, SA+BP, VV+VV, VV+BP, BP+BP ; chauffage : CETH split, CETH thermo, PAC intérieure, PAC extérieure, convecteur et sèche-serviette fournis.",
    "Un groupe pose d'un coup les appareils d'une plaque, côte à côte sur le mur, déjà associés, aux bonnes hauteurs (prises 30 cm, commandes 1,10 ou 1,20 m). Les appareils d'une même plaque comptent chacun pour le câblage. Appliqué le 06/11/2026 (lot 5) : bouton « Groupes ▾ » de la barre des appareils (17 groupes) ; les groupes de chauffage (CETH, PAC, appareils fournis) et le kit matériel viendront avec les nouveaux appareils.",
    { n: [25, 48], source: FTZ, usage: "Pose des appareils, Stream Deck" }),
  F("AP-05", "appareils", "decide", "Plaques", "Simple, double, triple, quadruple ; horizontale ou verticale.",
    "La plaque fait partie du kit matériel et de l'export ALTIOR.",
    { n: [26], source: FTZ, usage: "Groupes, export ALTIOR" }),
  F("AP-06", "appareils", "actif", "Interrupteur lumineux ou à témoin", "Un neutre bleu en plus dans la gaine de commande.",
    "Appliqué le 06/11/2026 (lot 3) : case « Lumineux / témoin » dans Propriétés ; le neutre du circuit va dans la gaine de la commande et dans l'alimentation.",
    { n: [2], source: FTZ, usage: "Propriétés, gaines" }),
  F("AP-07", "appareils", "actif", "Liaison équipotentielle des menuiseries", "Un appareil « LE menuiserie ».",
    "Comme sur les plans du BE. Appliqué le 06/11/2026 (lot 7) : appareil « LE menuiserie » (Terre et attentes), un fil vert/jaune 2,5 seul dans sa gaine depuis la boîte, sans circuit.",
    { n: [27], source: FTZ, usage: "Barre des appareils, câblage" }),
  F("AP-08", "appareils", "actif", "Hauteurs rapides", "120, 110 et 40 cm en un clic ou une touche.",
    "Les hauteurs que le BE change le plus souvent. Appliqué le 06/11/2026 (lot 3) : boutons 120 · 110 · 40 à côté de la hauteur dans Propriétés.",
    { n: [31], source: FTZ, usage: "Propriétés, raccourcis" }),
  F("AP-09", "appareils", "question", "Boîtes 40-50 / 40-60 et hauteur des commandes", "Commandes à 1,10 m ou 1,20 m ? Boîtes « 40-50 » et « 40-60 » : pour quel mur ?",
    "Les deux hauteurs existent dans les groupes du BE ; en attendant la réponse, Oktéo garde celle du groupe.",
    { n: [52], source: "Question au BE", usage: "Groupes" }),
  F("AP-10", "appareils", "decide", "Kit matériel de chaque appareil", "Appareil + boîte + plaque + bornes + connecteurs + chevilles, en articles génériques.",
    "La somme des kits donne la nomenclature et l'export ALTIOR. Données commerciales : rangées sur le serveur de l'entreprise, jamais dans le code.",
    { n: [50, 14], source: FTZ, usage: "Export ALTIOR, nomenclature" }),

  // ---- Câblage
  F("CB-01", "cablage", "actif", "Ordre des couleurs des retours", "Orange, ivoire, marron, noir, violet (dans cet ordre).",
    "Mêmes couleurs qu'Oktéo ; seul l'ordre de la ronde change pour être celui du BE. « V » veut dire violet, pas vert : il n'y a pas de vert en 1,5.",
    { n: [1, 37], source: FTZ, usage: "Bandes, schémas de boîte, .spv", cab: ["couleursCommande"] }),
  F("CB-02", "cablage", "actif", "Association au même endroit", "Dans une même gaine : prises entre elles (cuisine comprise), prise + liaison équipotentielle, prise + commandes, commandes entre elles. Jamais courant faible avec le reste.",
    "La liste exacte du BE remplace la règle actuelle d'Oktéo (« tout sauf le courant faible »).",
    { n: [4], source: FTZ, usage: "Gaines", cab: ["memeEndroit"] }),
  F("CB-03", "cablage", "actif", "Points par circuit", "8 prises en 1,5 mm², 12 en 2,5 mm², 8 points d'éclairage, 6 prises de cuisine.",
    "FTZ ne limite pas (sauf cuisine) ; on garde les limites de la norme.",
    { n: [5], source: "Norme NF C 15-100", usage: "Circuits", cab: ["maxPoints", "maxPrises", "maxPrisesCuisine"] }),
  F("CB-04", "cablage", "question", "Composition des gaines des nouveaux appareils", "Fils et câbles de chaque nouvelle catégorie (borne VE, téléreport, KNX, incendie, chauffage, PAC, VMC…).",
    "Reprises du BE ; le fichier du BE contient aussi 3 erreurs de numérotation (convecteur, téléreport, PAC) à trancher. À valider par le BE avant application.",
    { n: [20], source: FTZ, usage: "Gaines, bandes" }),
  F("CB-05", "cablage", "actif", "Fils autorisés", "Pas de contrôle de la liste des fils.",
    "FTZ ne contrôle pas non plus ; Oktéo ne gère pas de stock.",
    { n: [7], source: FTZ, usage: "—" }),

  // ---- Fils, câbles et gaines
  F("CO-01", "conducteurs", "actif", "Remplissage des gaines par la place occupée", "Place d'un fil : 1,5 → 8,6 ; 2,5 → 11,9 ; 6 → 22,9 ; 10 → 36,3 ; 16 → 50,3 ; 25 → 75,4. Capacité : ICTA 16 → 44 ; ICTA 20 → 90 ; ICTA 25 → 155 ; ICTA 32 → 200 ; ICTA 40 → 255 ; gaine aiguillée 20 / 25 → 70.",
    "Méthode du BE, décidée par Kévin : la somme des places doit tenir dans la gaine. Elle remplace la somme des sections de cuivre (règle R-074 : 7,5 et 13,5 mm²), dont l'historique est gardé.",
    { n: [38], source: FTZ, usage: "Diamètre des gaines", cab: ["icta16", "icta20"], regles: ["R-074"] }),
  F("CO-02", "conducteurs", "actif", "Place des câbles", "35 (3G1,5, courant faible), 70 (4G et 5G 1,5, câbles 2,5, 3G4, 3G6), 130 (4G et 5G 4, 5G6, 5G16, 2X16, HDMI), 170 (10 mm², 3G16).",
    "Même échelle que les fils : un câble se compte dans le remplissage de sa gaine.",
    { n: [43], source: FTZ, usage: "Diamètre des gaines" }),
  F("CO-03", "conducteurs", "decide", "Câbles disponibles", "R2V 2X, 3X, 4X, 3G à 5G de 1,5 à 16 mm², 7G1,5, 12G1,5 ; courant faible et spéciaux (SYT, téléreport, 17 VATC, grade 3, câble HP, YSLY, bus KNX, CR1 et SYT incendie, Cat 6A, Cat 7, LiYCY, cordons HDMI).",
    "Le catalogue complet du BE, avec la composition et la place de chaque câble ; les prix restent hors du code.",
    { n: [41], source: FTZ, usage: "Choix des câbles", cab: ["cablesStock"] }),
  F("CO-04", "conducteurs", "actif", "Couleurs des âmes des câbles", "3G : bleu, marron, vert/jaune · 4G : noir, marron, gris, vert/jaune · 5G : noir, gris, marron, bleu, vert/jaune · 2X : noir, marron · 3X : noir, bleu, marron · 4X : gris, noir, bleu, marron.",
    "Alignées sur les câbles achetés. Appliqué le 06/11/2026 (lot 2) : le 3X est passé de marron, noir, gris à noir, bleu, marron.",
    { n: [42], source: FTZ, usage: "Bandes, schémas" }),
  F("CO-05", "conducteurs", "decide", "Gaines disponibles", "ICTA 16, 20, 25 ; 32 bleue aiguillée ; 40 bleue (tableau) ; verte 20 (courant faible) ; aiguillée 20 / 25 ; VMC 80, 125, 160.",
    "Toutes les gaines du BE, avec leur capacité.",
    { n: [40], source: FTZ, usage: "Gaines, .spv" }),
  F("CO-06", "conducteurs", "info", "Fils disponibles", "1,5 mm² : bleu clair, bleu foncé, marron, gris, ivoire, noir, orange, rouge, vert/jaune, violet. 2,5 mm² : bleu, rouge, vert/jaune. 6 à 25 mm² (rigides) : bleu, rouge, vert/jaune.",
    "Les fils que l'atelier coupe. Pas de vert en 1,5.",
    { n: [37], source: FTZ, usage: "Bandes, .spv" }),
  F("CO-07", "conducteurs", "actif", "Surlongueurs", "Fils : 0,40 m en plus (0,20 côté appareil, 0,20 côté boîte). Gaines : aucune surlongueur.",
    "Appliqué le 06/11/2026 (lot 2) : la gaine n'a plus de surlongueur ; longueur de coupe d'un fil = gaine + 0,40 m (cuivre compté ainsi). Le « +500 mm par gaine » lu chez FTZ reste à expliquer par le BE.",
    { n: [3, 59], source: "Kévin, 06/11/2026", usage: "Longueurs, .spv, export ALTIOR", cab: ["margeBoite", "margeApp"] }),
  F("CO-08", "conducteurs", "decide", "Codes articles", "Chaque fil, câble et gaine a son code d'article (celui d'ALTIOR).",
    "Pour l'export ALTIOR et le chiffrage. Rangés sur le serveur de l'entreprise, avec les prix.",
    { n: [39, 63], source: FTZ, usage: "Export ALTIOR" }),

  // ---- Pieuvres et boîtes
  F("PI-01", "pieuvres", "question", "Couleurs des boîtes", "Rouge, vert, magenta, bleu, orange…",
    "Oktéo colore déjà les boîtes (LI01 rouge, LI02 vert…). Il faut vérifier l'ordre exact du BE.",
    { n: [9], source: FTZ, usage: "Plan, impression" }),
  F("PI-02", "pieuvres", "actif", "Réservations et trémies = obstacles", "Carrées 50 × 50, 100 × 100, 200 × 150 ; rondes Ø50, Ø100 ; prédalle.",
    "Comme les zones d'exclusion : les gaines les contournent et les boîtes en sont repoussées. Appliqué le 06/11/2026 (lot 3) : 5 obstacles dans « Zones d'exclusion » (barre des appareils), dimensions modifiables.",
    { n: [21], source: "Kévin, 06/11/2026", usage: "Placement des boîtes, gaines" }),
  F("PI-03", "pieuvres", "decide", "Vues « Boîtes » et « Forces »", "Boîtes : plaques et cotes des boîtes. Forces : lignes directes et leurs cotes.",
    "« Forces » = lignes directes, avec le vocabulaire du BE.",
    { n: [34], source: FTZ, usage: "Vues du plan" }),
  F("PI-04", "pieuvres", "decide", "Cotes au style du BE", "En centimètres, violettes, à barre oblique.",
    "Seulement là où Oktéo est différent.",
    { n: [28], source: FTZ, usage: "Plan, impression" }),

  // ---- Tableau
  F("TA-01", "tableau", "actif", "Calibres par défaut", "Éclairage 10 A · prises 16 A (8 en 1,5, 12 en 2,5) · prises de cuisine 16 A en 2,5 · four, lave-linge, sèche-linge, lave-vaisselle 20 A · plaques 32 A en 6 mm² · convecteur seul 10 A, deux convecteurs 16 A · sèche-serviette 10 A · volets 10 A · VMC 2 A · chauffe-eau 16 A · CETH 20 A.",
    "Appliqué depuis le 06/11/2026 (lot 2) : l'éclairage est passé de 16 à 10 A, les prises de cuisine de 20 à 16 A en 2,5, le convecteur seul de 16 à 10 A.",
    { n: [11], source: FTZ, usage: "Circuits, tableau", cab: ["protEclairage", "protPrises", "protCuisine", "protSpecialise", "protVolets"] }),
  F("TA-02", "tableau", "actif", "Appareils par départ", "Un seul appareil par circuit spécialisé ; deux convecteurs ou sèche-serviettes au plus.",
    "Comme au BE. Appliqué le 06/11/2026 (lot 6) : Oktéo fait un circuit par appareil spécialisé ; un circuit modifié à la main qui dépasse est signalé (alerte simple).",
    { n: [12], source: FTZ, usage: "Circuits" }),
  F("TA-03", "tableau", "decide", "Modulaires et domotique", "Télérupteurs (1 à 4), relais, variateurs, contacteurs, horloge, interrupteur crépusculaire, comptage, box domotique, BAES, coupure générale, différentiels 2 modules, triphasé, tableau annexe ; départs recharge, photovoltaïque, PAC, spa, piscine, pompe, portail, store, poêle, attentes.",
    "Tous les appareils du tableau du BE (Oktéo en a 9 aujourd'hui).",
    { n: [13, 45], source: FTZ, usage: "Page Tableau" }),
  F("TA-04", "tableau", "question", "Tableaux types selon le chauffage", "PAC duo, CETH + split, Aqua-Air : 3 différentiels communs + 1 du chauffage + 1 type A.",
    "Proposition : point de départ modifiable du tableau, la norme contrôlée par-dessus. À confirmer : le BE part-il toujours de ces modèles ?",
    { n: [46], source: FTZ, usage: "Page Tableau" }),
  F("TA-05", "tableau", "question", "Coffrets", "Coffret de communication (TRI : RJ45, box…) séparé du tableau ; tableau monté câblé (TAMC) 13 × 4 ou 18 × 3.",
    "À confirmer : « TAMC » = monté câblé ? Les départs « non TAMC » sont-ils câblés sur le chantier ?",
    { n: [47], source: FTZ, usage: "Page Tableau" }),
  F("TA-06", "tableau", "actif", "Parafoudre", "Étude selon la norme (densité de foudre du département, ligne aérienne, paratonnerre) ; le choix du BE reste libre et est noté au rapport.",
    "Mise à jour du 06/11/2026. Voir la rubrique Norme (PF-01 à PF-04).",
    { n: [], source: "Norme NF C 15-100", usage: "Étapes → Norme, tableau, rapport" }),

  // ---- Fabrication et échanges
  F("FA-01", "fabrication", "actif", "Fichier .spv pour Counter", "Une ligne par gaine : départ (boîte + face, tableau, coffret), gaine, longueur, arrivée (repères et pièce), câble, fils par section, n° de gaine, type (bras, alimentation, direct, pontages), hauteur, longueur de coupe.",
    "Un seul fichier, tout « à faire » : l'atelier le découpe lui-même. Lignes rangées pour produire les gaines en série (gaine, câble puis fils, composition, longueur) ; Counter n'exige rien. Appliqué le 06/11/2026 (lot 4) : Pieuvre → Bandes → « Fichier .spv (Counter) ». À valider dans Counter sur un chantier réel (FA-09).",
    { n: [53, 55, 58, 59, 8], source: "Fichiers .spv du BE", usage: "Pieuvre → Bandes" }),
  F("FA-02", "fabrication", "decide", "Export vers ALTIOR", "11 fichiers par affaire (appareillage, étanche, éclairage, VMC, tableau, fils et gaines…), un article générique par ligne avec la quantité totale.",
    "ALTIOR en tire l'ordre de fabrication. Les métrages de fils sont exactement la somme du .spv (vérifié sur un chantier réel) : un seul calcul pour les deux.",
    { n: [29, 60], source: "Exports ALTIOR du BE", usage: "Pieuvre → Bandes" }),
  F("FA-03", "fabrication", "question", "Dépôt des fichiers ALTIOR", "Au début : un fichier zip à télécharger.",
    "Oktéo est en ligne et ne voit pas le serveur de fichiers. À confirmer : dossier lu automatiquement par ALTIOR ?",
    { n: [62, 68], source: "Question au BE", usage: "Export ALTIOR" }),
  F("FA-04", "fabrication", "actif", "Totaux du planning du BE", "Surface, nombre de gaines, nombre de boîtes, plomberie oui / non.",
    "L'application du BE les écrit dans le planning. Appliqué le 06/11/2026 (lot 4) : Pieuvre → Bandes → « Totaux du planning » les copie, à coller dans InfoChantier.",
    { n: [30, 64], source: "Application du BE", usage: "Pieuvre" }),
  F("FA-05", "fabrication", "decide", "Nuage et indice de révision", "Mêmes mots qu'au BE : « nuage », « indice de révision ».",
    "Pour signaler sur le plan ce qui a changé d'une version à l'autre.",
    { n: [32], source: FTZ, usage: "Plan, impression" }),
  F("FA-06", "fabrication", "plustard", "Étiquettes et documents imprimés au format du BE", "Étiquettes des disjoncteurs et du coffret, étiquette 70 × 30, schéma unifilaire, légendes de marque, étiquettes d'expédition.",
    "Tout ce qui est impression est repoussé (décision de Kévin du 06/11/2026).",
    { n: [16, 17, 18, 44, 51], source: "Kévin, 06/11/2026", usage: "—" }),
  F("FA-07", "fabrication", "plustard", "Plomberie", "Pieuvres plomberie (PER 12 à 25 bleu et rouge).",
    "Le BE fait aussi des pieuvres plomberie : elles auront leur propre vue, plus tard.",
    { n: [], source: "Kévin, 06/11/2026", usage: "—" }),
  F("FA-08", "fabrication", "ecarte", "Ecodial", "Logiciel de calcul de Schneider.",
    "Personne ne l'utilise au BE.",
    { n: [35], source: "Kévin, 06/11/2026", usage: "—" }),
  F("FA-09", "fabrication", "decide", "Chantier de référence", "Un chantier réel recâblé par Oktéo, comparé au travail du BE, puis son .spv ouvert dans Counter.",
    "Pour valider chaque règle reprise avant de s'en servir en production.",
    { n: [56, 57], source: "Proposition", usage: "Tests" }),

  // ---- Poste : raccourcis
  F("PO-01", "clavier", "actif", "Raccourcis du BE", "Murs orthogonaux, porte, fenêtre, liaison, association, défaire, câble direct, rotation de 90°, copier, gaine, étiquettes… ; les touches interdites par le navigateur (Ctrl+W, Ctrl+N, Ctrl+T) auront un remplacement.",
    "Une page pour voir et changer chaque touche. Appliqué le 06/11/2026 (lot 6) : sur le plan, F6 / F7, Ctrl+8, Ctrl+9, Ctrl+G, Ctrl+7, Ctrl+R, Ctrl+Y, F5 et F2 / F9 font comme dans FTZ ; chaque poste peut changer ses touches ici. Association (Ctrl+J) et câble direct (Ctrl+6) n'ont pas d'équivalent : Oktéo les calcule.",
    { n: [23], source: FTZ, usage: "Tout le logiciel" }),
  F("PO-02", "clavier", "decide", "Stream Deck", "Les touches du Stream Deck envoient les raccourcis d'Oktéo ; Oktéo fournit les icônes.",
    "Par le logiciel d'Elgato d'abord ; un module direct plus tard si besoin.",
    { n: [24], source: "Kévin, 06/11/2026", usage: "Pose des appareils et des groupes" }),
];

// questions encore ouvertes (réponse attendue du BE) : [réf, question, pour quoi faire]
export const QUESTIONS = [
  ["T1", "Le BE part-il toujours des tableaux types (PAC duo, CETH + split, Aqua-Air) ?", "Disposition automatique du tableau (TA-04)"],
  ["T2", "« TAMC » veut-il dire tableau monté câblé ? Les départs « non TAMC » sont-ils câblés sur le chantier ?", "Coffrets (TA-05)"],
  ["T3", "À quoi servent les boîtes « 40-50 » et « 40-60 » ? Quand les choisir ?", "Groupes en un clic (AP-09)"],
  ["T4", "Commandes à 1,10 m ou 1,20 m par défaut ? Selon quoi ?", "Hauteurs (AP-09)"],
  ["T5", "Valider les compositions de gaines des nouvelles catégories et trancher les 3 erreurs du fichier du BE.", "Composition des gaines (CB-04)"],
  ["T6", "Le BE travaille-t-il bien dans l'environnement « KiTeOHM » de FTZ ?", "Fichiers de référence"],
  ["T7", "Dans quel ordre le BE attribue-t-il les couleurs des boîtes ?", "Couleurs des boîtes (PI-01)"],
  ["T8", "Plus tard : dimensions des planches d'étiquettes, imprimante, étiquette 70 × 30.", "Étiquettes (FA-06)"],
  ["T10", "À quoi correspondent la hauteur « 3200 » des alimentations dans le .spv et le « +500 mm par gaine » ?", ".spv, surlongueurs (FA-01, CO-07)"],
  ["T11", "Quelle différence entre « Bras pontage », « Direct pontage » et « Free pontage » ?", ".spv (FA-01)"],
  ["T12", "Les fichiers ALTIOR sont-ils déposés dans un dossier lu automatiquement ? « Version 1 / 2 » ? Plusieurs tableaux (« TabElec01 ») ?", "Export ALTIOR (FA-02, FA-03)"],
  ["T13", "Nouvelle application des fiches chantier : quel format pour qu'Oktéo la lise, où sera-t-elle, pour quand ?", "Consignes du pavillonneur (CH-03)"],
];

export const fichesOf = (rub) => FICHES.filter((f) => f.rub === rub);
export const fiche = (id) => FICHES.find((f) => f.id === id) || null;

// décompte des états (toutes rubriques, ou une seule)
export function compte(rub) {
  const out = Object.fromEntries(Object.keys(ETATS).map((k) => [k, 0]));
  for (const f of rub ? fichesOf(rub) : FICHES) out[f.etat]++;
  return out;
}

const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
// recherche : tous les mots tapés doivent être dans la fiche (titre, valeur, explication, source, usage, id)
export function cherche(q, list = FICHES) {
  const w = norm(q).split(/\s+/).filter(Boolean);
  if (!w.length) return list;
  return list.filter((f) => { const t = norm([f.id, f.titre, f.valeur, f.pourquoi, f.source, f.usage, ETATS[f.etat].label].join(" ")); return w.every((x) => t.includes(x)); });
}

// le catalogue en texte (Markdown), pour le lire hors du logiciel (Thibault, nouveaux arrivants) ;
// cab = valeurs actuelles des réglages (getCab()), labels = libellés des réglages (clé → libellé)
export function catalogueTexte({ cab = {}, labels = {}, date = "", normes = [] } = {}) {
  const L = [`# Catalogue des règles Oktéo — KiTéOHM`, "", date ? `Édité le ${date}.` : "", "",
    "Chaque fiche dit ce qu'Oktéo fait, pourquoi, et son état : " + Object.values(ETATS).map((e) => `${e.sym} ${e.label}`).join(" · ") + ".", ""];
  for (const r of RUBRIQUES.filter((x) => x.g === "kiteohm" || fichesOf(x.id).length)) {
    const fs = fichesOf(r.id);
    if (!fs.length && r.id !== "norme" && r.id !== "questions") continue;
    L.push(`## ${r.titre}`, "", r.intro, "");
    for (const f of fs) {
      L.push(`### ${f.id} · ${f.titre} — ${ETATS[f.etat].sym} ${ETATS[f.etat].label}`, "", `- Ce qu'Oktéo fait : ${f.valeur}`, `- Pourquoi : ${f.pourquoi}`);
      if (f.cab && f.cab.length) L.push(`- Réglages actuels : ${f.cab.map((k) => `${labels[k] || k} = ${cab[k] === undefined ? "?" : String(cab[k])}`).join(" ; ")}`);
      L.push(`- Source : ${f.source || "—"}${f.n && f.n.length ? ` (décisions n° ${f.n.join(", ")})` : ""}`, `- Sert à : ${f.usage || "—"}`, "");
    }
    if (r.id === "norme") for (const n of normes) L.push(`- ${n.code} (${n.niveau === "O" ? "obligatoire" : n.niveau === "R" ? "recommandé" : "choix KiTéOHM"}, art. ${n.art}) : ${n.texte}`);
    if (r.id === "questions") for (const [ref, q, pour] of QUESTIONS) L.push(`- ${ref} : ${q} — ${pour}`);
    if (r.id === "norme" || r.id === "questions") L.push("");
  }
  return L.join("\n");
}

// historique des réglages changés sur ce poste (le plus récent d'abord, 300 au plus)
const HKEY = "okteo.parametres.historique.v1";
export function historique() { try { return JSON.parse(localStorage.getItem(HKEY) || "[]") || []; } catch { return []; } }
export function noteChangement(quoi, avant, apres, rub = "") {
  if (String(avant) === String(apres)) return historique();
  const h = [{ at: new Date().toISOString(), quoi, avant: String(avant), apres: String(apres), rub }, ...historique()].slice(0, 300);
  try { localStorage.setItem(HKEY, JSON.stringify(h)); } catch { /* stockage indisponible */ }
  return h;
}
