// MAJ norme n° 1 (06/11/2026, go de Kévin) : socle des règles de la NF C 15-100 pour le logement.
// Pur (sans DOM). Source : « Bible des règles Oktéo — NF C 15-100 (2024) » (document du projet, tenu avec Kévin).
// RÈGLE DE LICENCE : aucune phrase de la norme ici. Chaque règle est résumée avec nos mots et renvoie à son article,
// pour qu'on la vérifie dans la norme (exemplaire sous licence, hors dépôt). Les valeurs chiffrées sont des faits.
// Un code (PC-01, SDE-03…) ne change jamais : il sert d'identifiant dans les alertes, le rapport et le journal.
// Niveaux : O = obligatoire (texte normatif) ; R = recommandé (commentaire de la norme) ; BE = choix interne KiTéOHM.
// R : règles du journal KiTéOHM (docs/journal-regles-cablage.md) qui couvrent le même sujet.

export const VERSIONS = {
  "2024": { label: "NF C 15-100 (série d'août 2024)", court: "NF C 15-100:2024" },
  "2015": { label: "NF C 15-100:2002 + amendement A5 (2015)", court: "NF C 15-100 A5:2015" },
};
// série 2024 obligatoire si la demande de permis (à défaut : déclaration préalable, marché, commande) est postérieure
// au 31/08/2025 (avant-propos de la NF C 15-100-10 ; Consuel, lettre n° 12 de septembre 2025)
export const BASCULE = "2025-08-31";

// version applicable au chantier : meta.permis = date « AAAA-MM-JJ » (champ de la fiche du chantier)
// → { v, label, court, sure } ; sans date : 2024 (cas général des chantiers neufs), sure = false
export function versionFor(meta) {
  const d = String((meta && meta.permis) || "").trim();
  const ok = /^\d{4}-\d{2}-\d{2}$/.test(d);
  const v = ok && d <= BASCULE ? "2015" : "2024";
  return { v, ...VERSIONS[v], sure: ok, permis: ok ? d : null };
}

// thèmes, dans l'ordre de la bible
export const THEMES = {
  PC: "Prises de courant", ECL: "Éclairage", CMD: "Commandes", CIR: "Circuits et pontage", SDE: "Salle d'eau",
  CUI: "Cuisine", COM: "Réseau de communication", GTL: "ETEL et GTL", TAB: "Tableau et différentiels",
  IRVE: "Recharge de véhicule", PF: "Parafoudre", DOC: "Documents à remettre",
};

// [code, niveau, article 2024, résumé (nos mots), règles R du journal]
// Articles : « 10.1.x » = NF C 15-100-10 ; « -11 x » = NF C 15-100-11 ; « -1 x » = NF C 15-100-1 ; « -7-722 », « -8-1 ».
const RAW = [
  ["PC-01", "O", "10.1.6.3.2", "Chambre : 3 prises 16 A au moins, réparties dans la pièce.", ["R-131"]],
  ["PC-02", "O", "10.1.6.3.2", "Séjour jusqu'à 28 m² : une prise par tranche de 4 m², 5 au moins.", ["R-131"]],
  ["PC-03", "O", "10.1.6.3.2", "Séjour de plus de 28 m² : 7 prises au moins, le reste à convenir avec le maître d'ouvrage.", ["R-131"]],
  ["PC-04", "O", "10.1.6.3.2", "Cuisine ouverte sur le séjour : surface du séjour = surface totale moins 8 m².", ["R-131"]],
  ["PC-05", "O", "10.1.6.3.2", "Cuisine : 6 prises hors spécialisées, dont 4 au-dessus du plan de travail ; 3 si la cuisine fait 4 m² ou moins.", ["R-131", "R-132"]],
  ["PC-06", "O", "10.1.6.3.2", "Autre pièce ou dégagement de plus de 4 m² : une prise au moins.", ["R-131"]],
  ["PC-07", "O", "10.1.6.3.2", "Compter socle par socle ; les prises USB ou à induction et les prises de la GTL ne comptent pas.", []],
  ["PC-08", "O", "-11 5.5", "Deux prises « multimédia » en plus, là où le client le demande, sinon au séjour.", []],
  ["PC-09", "O", "-1 555.1.9", "Axe de la prise à 5 cm au moins du sol fini (jusqu'à 20 A), 12 cm au-delà de 20 A.", []],
  ["PC-10", "O", "10.1.6.3.1", "Prises à obturateurs ; appareillage fixé par vis, jamais par griffes.", []],
  ["ECL-01", "O", "10.1.6.2.1", "Un point d'éclairage au moins par pièce principale, pièce de service et dégagement (sauf placards et annexes non attenantes).", []],
  ["ECL-02", "O", "10.1.6.2.1", "Extérieur : un point d'éclairage par entrée principale ou de service.", []],
  ["ECL-03", "O", "10.1.6.2.2", "Plancher en dalle, prédalle, dalles alvéolées ou poutrelles-hourdis : un point au plafond dans chaque pièce principale.", []],
  ["ECL-04", "O", "10.1.6.2.2", "WC et salle de bain : pas d'éclairage par prise commandée.", []],
  ["ECL-05", "O", "10.1.6.2.5", "Boîte au point lumineux avec socle DCL, sauf allumages multiples ou luminaire de plus de 6 A.", []],
  ["CMD-01", "O", "10.1.6.8.1", "Chaque local éclairé a au moins une commande fixe.", []],
  ["CMD-02", "R", "10.1.6.8.1", "Neutre disponible à chaque point de commande.", []],
  ["CMD-03", "O", "10.1.6.8.2", "Un interrupteur commande deux prises au plus, dans la même pièce ; une prise commandée compte comme un point lumineux.", []],
  ["CMD-04", "O", "10.1.6.8.3", "VMC : un dispositif d'arrêt (le disjoncteur dédié suffit).", ["R-139"]],
  ["CIR-01", "O", "10.1.6.3.3", "Prises 16 A : 8 au plus par circuit en 1,5 mm², 12 au plus en 2,5 mm².", ["R-130"]],
  ["CIR-02", "O", "10.1.6.2.3", "Éclairage : 8 points au plus par circuit ; spots et rubans : un point par tranche de 300 VA dans la même pièce.", ["R-129"]],
  ["CIR-03", "O", "10.1.6.2.4", "Deux circuits d'éclairage au moins (un seul si une seule pièce principale).", ["R-129"]],
  ["CIR-04", "O", "10.1.6.3.3", "Les 6 prises de la cuisine sur un circuit dédié en 2,5 mm², sans autre prise.", ["R-132"]],
  ["CIR-05", "O", "10.1.6.4", "Quatre circuits spécialisés au moins : cuisson (32 A mono / 20 A tri) et trois en 16 A (lave-linge, lave-vaisselle, sèche-linge ou four).", ["R-133", "R-134"]],
  ["CIR-06", "O", "10.1.6.4", "Circuit spécialisé pour chaque gros appareil prévu : chauffe-eau, chauffage, pompe à chaleur, volets roulants, VMC, extérieurs, recharge, congélateur…", ["R-135", "R-136", "R-138", "R-139", "R-143"]],
  ["CIR-07", "R", "10.1.6.4", "Congélateur : différentiel 30 mA dédié, de préférence à immunité renforcée.", ["R-126"]],
  ["CIR-08", "O", "10.1.6.4", "Sonnette admise sur le circuit des automatismes ou sur un circuit d'éclairage.", []],
  ["CIR-09", "O", "10.1.6.5", "Chauffage : 3 500 W / 16 A / 1,5 mm² ; 4 500 W / 20 A / 2,5 mm² ; 5 750 W / 25 A / 4 mm² ; 7 250 W / 32 A / 6 mm² par circuit.", ["R-136"]],
  ["CIR-10", "O", "10.1.6.6", "Circuits extérieurs en câble, sous un différentiel distinct des circuits intérieurs.", ["R-143"]],
  ["CIR-11", "O", "10.1.7.2.2", "Puissance et communication dans des conduits distincts ; croisements évités ou à angle droit.", []],
  ["CIR-12", "BE", "10.1.6.3.3", "Pontage Oktéo : appareils d'un même circuit seulement, jamais un circuit spécialisé ; le circuit reste dans CIR-01 / CIR-02.", []],
  ["CIR-13", "BE", "-11 5.2.3", "Association Oktéo : jamais de courant faible avec une prise ou une commande ; boîte des volets roulants seule.", []],
  ["SDE-01", "O", "10.1.6.10.1", "Tout local avec baignoire ou douche est concerné, même une chambre ou un garage.", []],
  ["SDE-02", "O", "10.1.3.23", "Volume 0 : intérieur de la baignoire ou du receveur ; douche sans receveur : jusqu'à 10 cm au-dessus du fond.", []],
  ["SDE-03", "O", "10.1.3.24", "Volume 1 : aplomb de la baignoire ou du receveur jusqu'à 2,25 m ; sans receveur : 1,20 m autour du point de référence.", []],
  ["SDE-04", "O", "10.1.3.25", "Volume 2 : 0,60 m autour du volume 1, même hauteur que lui.", []],
  ["SDE-05", "O", "10.1.3.19", "Une paroi fixe pleine hauteur arrête le volume (règle du contournement).", []],
  ["SDE-06", "O", "10.1.3.22", "Appareil à cheval sur deux volumes : la règle du plus strict.", []],
  ["SDE-07", "O", "10.1.6.10.2.2", "Volumes 0 et 1 : ni prise, ni commande, ni boîte de connexion (sauf très basse tension en volume 1).", []],
  ["SDE-08", "O", "10.1.6.10.2.2", "Volume 2 : seulement très basse tension, prise rasoir, DCL ; boîte seulement pour un appareil de ce volume.", []],
  ["SDE-09", "O", "10.1.6.10.2.2", "Volume caché : aucun appareillage.", []],
  ["SDE-10", "O", "10.1.6.10.2.1", "Protection : IPX7 en volume 0, IPX4 en volumes 1, 2 et caché (IPX5 si jets).", []],
  ["SDE-11", "O", "10.1.6.10.2.2", "Tous les circuits du local sous différentiel 30 mA.", []],
  ["SDE-12", "O", "10.1.6.10.2.5", "Chauffe-eau à accumulation hors volume, sinon volume 2 (volume 1 seulement horizontal et en haut).", []],
  ["SDE-13", "O", "10.1.6.10.2.6.5", "Trappe d'accès à une installation électrique jamais en volume 0 ou 1.", []],
  ["SDE-14", "O", "10.1.7.6.2", "Ni ETEL dans le local, ni tableau divisionnaire dans les volumes.", ["R-105"]],
  ["SDE-15", "O", "-11 5.2.3", "RJ45 interdite en volumes 0, 1 et caché ; en volume 2 seulement en très basse tension.", []],
  ["SDE-16", "O", "10.1.5.4", "Liaison équipotentielle supplémentaire du local (se vérifie sur le chantier).", []],
  ["CUI-01", "O", "10.1.6.3.2", "Aucune prise au-dessus de l'évier ni des plaques, sauf la prise de hotte à 1,80 m au moins.", []],
  ["CUI-02", "O", "-11 5.2.3", "Aucune prise RJ45 au-dessus de la cuisson ou de l'évier.", []],
  ["CUI-03", "O", "10.1.7.6.2", "Tableau divisionnaire interdit au-dessus ou au-dessous d'un évier, lavabo, point d'eau, cuisson ou chauffage.", []],
  ["COM-01", "O", "-11 5.2.2.1", "RJ45 : deux côte à côte au séjour ; une de plus (2 pièces principales) ou deux de plus (plus de 2) dans d'autres pièces principales.", ["R-116"]],
  ["COM-02", "O", "-11 5.2.2.1", "Toute RJ45 à proximité d'une prise 16 A.", []],
  ["COM-03", "O", "-11 5.2.2.1", "Chaque RJ45 reliée par sa propre canalisation au tableau de communication.", []],
  ["COM-04", "O", "-11 5.2.2.1", "Lien RJ45 de 35 m au plus jusqu'au tableau de communication, sauf étude.", []],
  ["COM-05", "O", "-11 5.2.4", "Conduit réservé à la communication : 25 mm de diamètre extérieur au moins.", []],
  ["COM-06", "O", "-11 5.2.3", "Prise mixte 16 A + RJ45 : une cloison entre les deux socles.", []],
  ["COM-07", "O", "-11 5.2.2.1", "RJ45 de catégorie 6 au moins (grade 2 TV) ou 6A (grade 3 TV).", []],
  ["COM-08", "O", "-11 5.3.1", "Tableau de communication dans la GTL : DTIo, DTI si cuivre, bandeau de 4 RJ45 au moins, répartiteur TV, terre.", ["R-114"]],
  ["COM-09", "O", "-11 5.3.2", "Volume attenant de 240 × 300 × 200 mm avec deux prises 16 A sur circuit dédié.", ["R-113", "R-115"]],
  ["COM-10", "R", "-11 5.6.1", "Prises TV coaxiales facultatives : 1, 2 ou 3 selon le nombre de pièces principales ; une prise 16 A à côté.", []],
  ["COM-11", "R", "-11 5.6.2", "Lien de déport (fibre + coaxial) facultatif vers l'emplacement multimédia du séjour.", []],
  ["GTL-01", "O", "10.1.7.1.2", "ETEL de 600 × 250 mm, du sol au plafond.", ["R-103", "R-104"]],
  ["GTL-02", "O", "10.1.7.1.3", "ETEL à plus de 10 cm du gaz, 40 cm d'une source de chaleur, 60 cm d'un point d'eau.", ["R-106"]],
  ["GTL-03", "O", "10.1.7.1.3", "ETEL interdit en salle d'eau, local humide, extérieur, sous un escalier, lieu exigu ; jamais un placard.", ["R-105"]],
  ["GTL-04", "O", "10.1.7.1.4", "ETEL de préférence au niveau d'accès : entrée, circulation, dégagement ou local technique.", ["R-105"]],
  ["GTL-05", "O", "10.1.7.1.4", "Passage libre de 70 cm devant les tableaux.", []],
  ["GTL-06", "O", "10.1.7.2.3", "Organes de manœuvre du tableau entre 0,50 et 1,80 m.", ["R-109", "R-110"]],
  ["GTL-07", "O", "10.1.7.4", "Coupure d'urgence dans le logement, manœuvre entre 0,90 et 1,80 m.", ["R-111"]],
  ["GTL-08", "O", "10.1.7.3", "Alimentation du tableau : 10 mm² (AGCP 30-45 A), 16 mm² (60 A), 25 mm² (90 A) ; longueur bornée si éloigné.", ["R-118"]],
  ["GTL-09", "R", "-8-1 6.3", "Tableau au plus près du barycentre des grosses charges.", []],
  ["TAB-01", "O", "10.1.7.6", "Réserve de 20 % dans chaque tableau.", ["R-144", "R-145"]],
  ["TAB-02", "O", "10.1.7.7.3.1", "Chaque circuit sous différentiel 30 mA.", []],
  ["TAB-03", "O", "Tableau 10-1G", "Deux différentiels au moins, 8 circuits au plus chacun ; éclairage et prises sous deux différentiels au moins.", ["R-119", "R-122", "R-123", "R-127"]],
  ["TAB-04", "O", "Tableau 10-1G ; -1 553.2.6.1", "Cuisson et lave-linge en type A ; autres A ou AC ; appareils à variateur monophasé en type F.", ["R-120", "R-121", "R-125"]],
  ["TAB-05", "O", "Tableau 10-1G", "Calibre du différentiel : au moins celui de l'AGCP (+ générateur), ou règle de l'aval.", ["R-124"]],
  ["TAB-06", "O", "10.1.7.7.3.2", "Chauffage à fil pilote : une zone de pilotage sous un même différentiel.", ["R-140"]],
  ["TAB-07", "O", "10.1.7.7.3.1", "Plancher chauffant : 7,5 kW au plus par différentiel en 230 V (13 kW en 400 V).", ["R-137"]],
  ["TAB-08", "R", "10.1.7.7.3.1", "Lave-linge, lave-vaisselle, congélateur : différentiel dédié conseillé.", ["R-126"]],
  ["TAB-09", "O", "10.1.7.7.1", "Sectionnement de chaque circuit, neutre compris ; fil pilote sectionné.", ["R-140"]],
  ["TAB-10", "R", "-1 421.7", "Détecteur d'arc conseillé pour les équipements permanents et les lieux critiques.", []],
  ["IRVE-01", "O", "-7-722", "Recharge de véhicule : circuit et différentiel 30 mA propres à chaque point ; type selon le mode de charge.", ["R-141", "R-142"]],
  ["PF-01", "O", "Tableau 10-1H", "Parafoudre obligatoire avec paratonnerre, ou ligne aérienne en zone Nk > 25, ou sécurité des personnes en jeu en zone Nk > 25.", ["R-150", "R-151"]],
  ["PF-02", "O", "Annexe 10A", "Second parafoudre près des matériels à plus de 10 m de canalisation de l'origine.", ["R-152"]],
  ["PF-03", "O", "10.1.7.7.4", "Parafoudre sur la communication si la puissance en a un et que la communication arrive en cuivre.", ["R-153"]],
  ["PF-04", "O", "10.1.7.7.3.1", "Circuit du parafoudre de tête sous différentiel de type S, jamais sous un 30 mA.", []],
  ["DOC-01", "O", "10.1.8.1", "Repérage de chaque circuit au tableau : local desservi et fonction.", ["R-149"]],
  ["DOC-02", "O", "10.1.8.2", "Schéma unifilaire remis à l'usager (protections, sections, fonction, local).", ["R-149"]],
  ["DOC-03", "O", "-11 5.7", "Communication : chaque lien repéré aux deux bouts ; dossier technique remis.", []],
  ["DOC-04", "R", "10.1.9", "Fiche d'autocontrôle (réalisé / non réalisé / sans objet).", []],
  ["DOC-05", "BE", "Consuel", "Version de la norme indiquée sur le plan et le rapport (demandée sur l'attestation depuis le 01/09/2025).", ["R-101"]],
];

export const REGLES = RAW.map(([code, niveau, art, texte, R]) => ({ code, theme: code.split("-")[0], niveau, art, texte, R }));
const BY = new Map(REGLES.map((r) => [r.code, r]));
export const regle = (code) => BY.get(code) || null;

// article dans l'édition A5 (2015) : la partie logement a seulement été renumérotée (10.1.6 → 10.1.3, 10.1.7 → 10.1.4,
// 10.1.8 → 10.1.5, 10.1.5 → 10.1.2, 10.1.9 → 10.1.6) ; définitions 10.1.3.x → Annexe A du Titre 10 ; -11 → Titre 11
export function art2015(art) {
  const a = String(art || "");
  const m = /^10\.1\.(\d+)(.*)$/.exec(a);
  if (m) {
    if (m[1] === "3") return "Titre 10, Annexe A (définitions)";
    const map = { 5: 2, 6: 3, 7: 4, 8: 5, 9: 6 };
    return map[m[1]] ? `10.1.${map[m[1]]}${m[2]}` : null;
  }
  if (/^-11 /.test(a)) return "Titre 11 (note de 2016)";
  if (/^Tableau 10-1[A-H]$/.test(a)) return a;
  return null;
}
// partie de la série d'un article : « 10.1… » → NF C 15-100-10
export function partOf(art) {
  const a = String(art || "");
  if (/^-(\S+)/.test(a)) return "NF C 15-100" + /^-(\S+)/.exec(a)[1].replace(/^/, "-");
  if (/^Consuel/.test(a)) return "Consuel";
  return "NF C 15-100-10";
}
// référence lisible : « PC-01 · NF C 15-100-10 § 10.1.6.3.2 » (2024) ou « PC-01 · NF C 15-100 A5 § 10.1.3.3.2 »
export function refOf(code, v = "2024") {
  const r = regle(code);
  if (!r) return code;
  if (v === "2015") { const a = art2015(r.art); return a ? `${code} · NF C 15-100 A5 § ${a}` : `${code} · (article de 2024 : ${r.art})`; }
  if (/^Consuel/.test(r.art)) return `${code} · Consuel`;
  const a = r.art.replace(/^-\S+\s*/, "");
  return `${code} · ${partOf(r.art)}${a ? (/^(Tableau|Annexe)/.test(a) ? ", " : " § ") + a : ""}`;
}
// règles d'un thème, ou dont le journal KiTéOHM cite une règle R-xxx
export const ofTheme = (t) => REGLES.filter((r) => r.theme === t);
export const forJournal = (rid) => REGLES.filter((r) => r.R.includes(rid));
