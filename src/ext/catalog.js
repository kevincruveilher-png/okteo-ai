// Catalogue de TOUTES les fonctions du logiciel.
// Sert à trois choses : la palette Ctrl+K, les infobulles de la barre, et l'assistant IA
// (qui reçoit cette liste pour savoir ce qui existe et peut lancer une commande par son id).
// Règle : chaque nouvelle fonction du logiciel doit être ajoutée ici.
//   id    identifiant stable (utilisé par l'assistant)
//   cat   rubrique
//   label nom affiché
//   keys  raccourci (texte affiché)
//   desc  comment s'en servir, en une ou deux phrases
//   run   action (absente = geste ou mode d'emploi, rien à lancer)

export const CATS = ["Dessiner", "Niveaux", "Appareils", "Câblage", "Relier", "Sélection et édition", "Vue", "Fichier", "Aide et IA", "Gestes"];

export function buildCatalog(api, hooks) {
  const T = (id) => () => api.setTool(id);
  const C = [];
  const add = (cat, id, label, keys, desc, run) => C.push({ cat, id, label, keys: keys || "", desc, run: run || null });

  // Dessiner
  add("Dessiner", "tool.sel", "Sélection", "V", "Cliquer un objet pour le sélectionner et le modifier ; glisser dans le vide pour un cadre de sélection.", T("sel"));
  add("Dessiner", "tool.piece", "Tracer une pièce", "E", "Glisser un rectangle : crée les 4 murs et la pièce d'un coup. Le nom se change dans le menu au-dessus de la pièce.", T("piece"));
  add("Dessiner", "tool.mur", "Tracer des murs", "B", "Cliquer point après point pour enchaîner les murs ; taper une longueur (en m) puis Entrée pour la fixer ; double-clic ou Échap pour finir.", T("mur"));
  add("Dessiner", "tool.porte", "Poser une porte", "O", "Cliquer sur un mur : la porte le perce. Glisser pour la déplacer, poignées pour la largeur, G et S pour le gond et le sens.", T("porte"));
  add("Dessiner", "tool.fenetre", "Poser une fenêtre", "F", "Cliquer sur un mur : la fenêtre le perce. Même réglages que la porte.", T("fenetre"));
  add("Câblage", "cab.pane", "Circuits du chantier (onglet Câblage)", "", "Onglet « Câblage » du panneau de droite : liste des circuits, couleur de chacun sur le plan, section, protection, appareils sans circuit.", () => hooks.cablage());
  add("Câblage", "cab.auto", "Répartir les appareils en circuits (NF C 15-100)", "", "Éclairage par allumage (max 8 points), prises voisines (max 8), un circuit par prise spécialisée et sortie de câble (ligne directe), RJ45 en lignes directes. Tous niveaux. Ctrl+Z pour annuler.", () => hooks.circuitsAuto());
  add("Câblage", "cab.move", "Changer un appareil de circuit", "", "Sélectionner le ou les appareils sur le plan, puis « ← Sélection » sur le circuit voulu (onglet Câblage).", () => hooks.cablage());
  add("Câblage", "cab.boxes", "Placer les boîtes automatiquement", "", "Après la répartition en circuits : les boîtes sont placées pour utiliser le moins de cuivre possible (max 18 départs, 6 par face, une commande et ses lumières dans la même boîte), chaque boîte alimentée depuis le tableau. Ctrl+Z pour annuler.", () => hooks.boxesAuto());
  add("Câblage", "cab.movebox", "Déplacer une boîte", "glisser", "Onglet Câblage ouvert (couleurs des circuits affichées), outil Sélection : glisser le carré de la boîte sur le plan. Longueurs, faces et diamètres se recalculent.", () => hooks.cablage());
  add("Câblage", "cab.bandes", "Schémas de boîte pour le câbleur (onglet Bandes)", "", "Onglet « Bandes » à gauche : pour chaque boîte, la boîte carrée avec ses faces A–D et ses gaines (n°, longueur, Ø, appareil, fils couleur + n°), les connecteurs, retours lampe et navettes tracés, l'orientation (pièce de chaque côté), le matériel (connecteurs 2, 3, 5… entrées) et les raccordements à faire dans l'ordre, à cocher. Impression : une feuille A4 par boîte.", () => api.setTab("bandes"));
  add("Câblage", "cab.route", "Modifier le passage d'une gaine", "tirer", "Couleurs des circuits affichées, outil Sélection : attraper une gaine sur le plan et la tirer = un point de passage (libre, la distance au mur s'affiche). Maj : tronçon horizontal ou vertical. Double-clic sur un point : le supprimer. « Remettre en ligne droite » dans la liste des boîtes. Les longueurs se recalculent (+10 % gardés).", () => hooks.cablage());
  add("Câblage", "cab.lock", "Verrouiller une boîte (cadenas)", "", "Une boîte verrouillée 🔒 ne bouge plus quand on recalcule les boîtes : elle garde sa place, ses appareils et ses tracés. Une boîte déplacée ou retracée se verrouille toute seule. Clic sur le cadenas (sur le plan, coin haut droit de la boîte, ou dans la liste) pour verrouiller / déverrouiller. Au recalcul, on coche les boîtes à refaire.", () => hooks.cablage());
  add("Câblage", "cab.gaines", "Gaines et fils de chaque boîte", "", "Onglet « Boîtes » (à gauche) : pour chaque boîte, ses gaines (n°, face, appareil, circuit, longueur, diamètre, fils avec couleur, section et n° de raccordement) et la liste des raccordements.", () => api.setTab("boites"));
  add("Câblage", "cab.direct", "Lignes directes", "", "Onglet « Lignes directes » : prises spécialisées, sorties de câble et RJ45, du tableau (ou du coffret) jusqu'à l'appareil, avec longueur, diamètre et fils.", () => api.setTab("lignes"));
  add("Câblage", "cab.settings", "Réglages du câblage", "", "Paramètres → Câblage : départs par boîte (18) et par face (6), hauteurs, surlongueurs, +10 % de tracé, remplissage des gaines, limites, sections, protections, couleurs des fils.", () => api.setTab("params"));
  add("Aide et IA", "help.tour", "Visite guidée (premiers pas)", "", "Présentation de l'écran, zone par zone (2 min) : chantier, échelle, relevés automatiques, outils, appareils, propriétés, liaisons, niveaux, affichage, enregistrement, impression, fonctions, assistant.", () => hooks.tour());
  add("Aide et IA", "help.steps", "Étapes du chantier", "", "Onglet « Étapes » du panneau de droite : ce qui est fait, ce qui reste, et le bouton qui lance l'étape suivante.", () => hooks.steps());
  add("Dessiner", "walls.detect", "Relever les murs du PDF (automatique)", "", "Lit les murs dessinés dans le PDF du plan (sans IA) : épaisseurs, angles, portes et fenêtres. Aperçu en orange, puis « Ajouter au dessin ». Menu « ⤓ Relevé » → 1. Murs. L'échelle est réglée toute seule d'après les cotes du plan si elle ne l'est pas encore.", () => hooks.detectWalls());
  add("Dessiner", "releve.menu", "Menu Relevé (murs, pièces, appareillage, IA)", "", "Bouton « ⤓ Relevé » en haut : trois relevés séparés (1. Murs, 2. Pièces, 3. Appareillage), chacun avec son aperçu et son bouton d'ajout, plus le relevé par l'IA pour comparer.", () => hooks.openReleve());
  add("Aide et IA", "releve.ai", "Relevé par l'IA (murs, pièces, appareils)", "", "L'IA regarde l'image du plan et propose murs, portes et fenêtres, pièces, appareils et liaisons, en aperçu orange par-dessus le dessin actuel pour comparer avec le relevé sans IA. On coche ce qu'on garde ; Ctrl+Z annule. En ligne : clé Claude ; en local : Claude ou NVIDIA.", () => hooks.aiReleve());
  add("Aide et IA", "releve.paste", "Relevé IA : coller une réponse (sans clé)", "", "Sans clé IA : colle (ou charge depuis un fichier .json) un relevé préparé à part ; il s'affiche en aperçu orange comme le relevé par l'IA, avec les mêmes cases à cocher. Le plan doit être à l'échelle.", () => hooks.aiPaste());
  add("Appareils", "help.liaisons", "Voir et modifier les liaisons", "", "Outil Liaison : toutes les liaisons s'affichent en trait épais, les commandes et lumières sans liaison sont cerclées en orange. Cliquez une commande : ses lumières ressortent ; cliquez une lumière pour la relier ou la détacher. Cliquez une liaison puis Suppr pour la retirer.", () => api.setTool("lien"));
  add("Dessiner", "rooms.detect", "Détecter les pièces (automatique)", "", "Trouve les pièces fermées par les murs (y compris en L), leur surface habitable et leur nom lu sur le plan PDF. Aperçu, puis « Ajouter les pièces ». Proposé automatiquement après un relevé des murs.", () => hooks.detectRooms());
  add("Appareils", "devices.detect", "Relever les appareils du PDF (automatique)", "", "Lit les symboles du plan PDF (sans IA) : prises 16/20 A, RJ45, interrupteurs, va-et-vient, points lumineux, spots, sorties de câble, bouches VMC, et les liaisons commande → lumière. Aperçu, puis « Ajouter les appareils » ; les appareils muraux se collent à leur mur. Proposé après la détection des pièces.", () => hooks.detectDevices());
  add("Dessiner", "help.echelle", "Contrôle de l'échelle par les cotes du plan", "", "À l'ouverture du relevé des murs, Oktéo relit les cotes du PDF (même en police codée) et les compare aux longueurs mesurées : « ✓ Échelle confirmée » ou « ⚠ décalée de x % » avec un bouton « Corriger l'échelle » (tant qu'aucun mur n'est dessiné).", () => hooks.detectWalls());
  add("Niveaux", "level.add", "Ajouter un niveau (R+1, combles, sous-sol)", "", "Bouton « ＋ Niveau » à côté du nom du chantier. Les murs extérieurs du niveau ouvert peuvent être recopiés. Chaque niveau a son propre plan de fond (page Chantiers → « Ajouter un fond… » ; une autre page du même PDF reprend l'échelle du RDC).", () => hooks.levels().add());
  add("Niveaux", "level.up", "Niveau du dessus", "Page ↑", "Ouvre le niveau suivant dans la barre des niveaux.", () => hooks.levels().up());
  add("Niveaux", "level.down", "Niveau du dessous", "Page ↓", "Ouvre le niveau précédent dans la barre des niveaux.", () => hooks.levels().down());
  add("Niveaux", "level.rename", "Renommer le niveau", "double-clic", "Double-clic sur le nom du niveau dans la barre, ou cette commande.", () => hooks.levels().rename());
  add("Niveaux", "help.xlink", "Relier une commande à une lumière d'un autre niveau", "", "Outil Liaison : cliquer l'interrupteur, puis Page ↑ / Page ↓ (la commande reste choisie) et cliquer la lumière de l'autre niveau. Les deux appareils affichent « → L3 R+1 » / « ← I5 RDC », aussi à l'impression.", () => api.setTool("lien"));
  add("Niveaux", "help.printall", "Imprimer tous les niveaux", "Ctrl+P", "Fenêtre Imprimer → « Niveaux imprimés : Tous les niveaux » : une page par niveau, même format et même échelle, nomenclature commune.", () => hooks.print());
  add("Niveaux", "help.below", "Voir le niveau du dessous en transparence", "", "Menu Affichage → « Niveau du dessous en transparence » : les murs du niveau inférieur en gris clair, pour caler ceux de l'étage (murs porteurs, trémie d'escalier).", () => api.toggle("below"));
  add("Dessiner", "help.limite", "Limite de pièce (séparer deux pièces sans mur)", "", "Pour séparer un dégagement, une cuisine ouverte… du séjour sans mur : dessiner un mur à l'endroit voulu, le sélectionner, cocher « Limite de pièce » dans son menu (pointillés, pas imprimé comme un mur). La détection des pièces en propose automatiquement aux étranglements quand deux noms du plan tombent dans la même pièce.");
  add("Dessiner", "help.epmur", "Épaisseur d'un mur", "", "Sélectionner le mur : champ « ép. » (cm) dans son menu flottant. Les murs relevés du PDF gardent leur épaisseur réelle.");
  add("Dessiner", "tool.offset", "Cloison parallèle", "", "Cliquer un mur du côté voulu, puis indiquer la distance : crée un mur parallèle.", T("offset"));
  add("Dessiner", "tool.cote", "Coter", "C", "Cliquer deux points pour poser une cote mesurée.", T("cote"));
  add("Dessiner", "help.angles", "Angles droits", "", "Case « Angles droits » en haut : force les murs à l'horizontale ou à la verticale.", () => api.toggle("ortho"));

  // Appareils
  const keysOf = { PC16: "P", LUM: "R", INT: "I" };
  for (const t of api.PAL) {
    const ty = api.TYPES[t];
    add("Appareils", "app." + t, "Poser : " + ty.n, keysOf[t] || "", "L'outil reste actif : chaque clic pose un appareil. Près d'un mur, il s'y colle tout seul." + (ty.h ? ` Hauteur par défaut ${ty.h} cm.` : ""), T(t));
  }
  add("Appareils", "help.reps", "Repères par allumage (I3 → L3, L3A)", "", "Une commande et les lumières qu'elle allume portent le même numéro : I3 et L3 ; le 2e du même type prend A, le 3e B (VV1 et VV1A, L3 et L3A, BP1, BP1A, BP1B ; spot S3, applique AP3). Le numéro suit tout seul quand on ajoute ou retire une liaison. Les appareils non reliés (prises, RJ45…) gardent leur propre numéro.");
  add("Appareils", "app.renumber", "Renuméroter les repères", "", "Les repères (P1, I3, L2…) sont fixes : supprimer P3 ne renumérote pas les suivants. Cette commande les renumérote proprement, pièce par pièce, de gauche à droite et de haut en bas (Ctrl+Z pour annuler).", () => { const n = api.renumberReps(); api.setHint(`${n} repères renumérotés pièce par pièce. Ctrl+Z pour annuler.`); });
  add("Appareils", "help.distance", "Poser à une distance exacte de l'angle", "chiffres + Entrée", "Avec un outil d'appareil mural, approcher le mur puis taper la distance en cm (ex. 30) et Entrée : l'appareil est posé à 30 cm de la face intérieure du mur d'angle le plus proche.", T("PC16"));
  add("Appareils", "help.attache", "Appareils attachés à leur mur", "", "Une prise ou un interrupteur posé contre un mur le suit : mur déplacé, tourné, allongé ou épaissi, l'appareil garde sa distance à l'angle (mesurée depuis la face du mur d'angle). Supprimer un mur qui porte des appareils : Oktéo demande s'il faut les supprimer ou les garder détachés.");
  add("Appareils", "help.serie", "Poser une série équirépartie", "", "Sélectionner un appareil, dans son menu taper le nombre (×3…) puis « Série », et cliquer le point d'arrivée.");
  add("Appareils", "help.hauteur", "Changer la hauteur d'un appareil", "", "Sélectionner l'appareil : champ « h » (cm) dans son menu flottant.");
  add("Appareils", "help.taille", "Taille des symboles", "", "Curseur « App. » en haut : diamètre des symboles en cm.");

  // Relier
  add("Relier", "tool.lien", "Relier une commande à des lumières", "L", "Cliquer un interrupteur (ou bouton/va-et-vient), puis la ou les lumières qu'il commande.", T("lien"));
  add("Relier", "mode.test", "Tester les commandes", "", "Bouton « Test » : cliquer une commande allume ses lumières à l'écran.", () => api.toggleTest());

  // Sélection et édition
  add("Sélection et édition", "edit.all", "Tout sélectionner", "Ctrl+A", "Sélectionne tous les objets du plan.", () => api.selectAll());
  add("Sélection et édition", "edit.none", "Désélectionner / annuler l'outil", "Échap", "Vide la sélection et revient à l'outil Sélection.", () => api.clearSel());
  add("Sélection et édition", "edit.dup", "Dupliquer la sélection", "Ctrl+D", "Crée une copie décalée de la sélection.", () => api.duplicate());
  add("Sélection et édition", "edit.copy", "Copier / coller", "Ctrl+C / Ctrl+V", "Copie la sélection ; Ctrl+V la colle sous le curseur.");
  add("Sélection et édition", "edit.del", "Supprimer la sélection", "Suppr", "Supprime les objets sélectionnés (une pièce part avec ses murs et son contenu).", () => api.deleteSelection());
  add("Sélection et édition", "edit.cw", "Tourner de 90° à droite", "R", "Avec une sélection de plusieurs objets ou une pièce.", () => api.transform("cw"));
  add("Sélection et édition", "edit.ccw", "Tourner de 90° à gauche", "Maj+R", "Avec une sélection de plusieurs objets ou une pièce.", () => api.transform("ccw"));
  add("Sélection et édition", "edit.mx", "Symétrie gauche-droite", "X", "Avec une sélection de plusieurs objets ou une pièce.", () => api.transform("mx"));
  add("Sélection et édition", "edit.my", "Symétrie haut-bas", "Y", "Avec une sélection de plusieurs objets ou une pièce.", () => api.transform("my"));
  add("Sélection et édition", "edit.undo", "Annuler", "Ctrl+Z", "Annule la dernière modification (80 niveaux).", () => api.undo());
  add("Sélection et édition", "edit.redo", "Rétablir", "Ctrl+Y", "Refait ce qui vient d'être annulé.", () => api.redo());
  add("Sélection et édition", "help.resize", "Redimensionner une pièce", "", "Sélectionner la pièce et tirer ses poignées : les murs suivent.");
  add("Sélection et édition", "help.mur", "Changer la longueur d'un mur", "", "Sélectionner le mur : champ « L » (m) dans son menu flottant.");
  add("Sélection et édition", "help.gond", "Gond et sens d'une porte", "G / S", "Porte sélectionnée : G change le côté du gond, S le sens d'ouverture.");

  // Vue
  add("Vue", "view.fit", "Ajuster la vue au plan", "", "Recadre pour voir tout le dessin.", () => api.fit());
  add("Vue", "view.in", "Zoom avant", "molette", "", () => api.zoom(1.25));
  add("Vue", "view.out", "Zoom arrière", "molette", "", () => api.zoom(0.8));
  add("Vue", "tool.pan", "Main (déplacer la vue)", "M", "Glisser pour déplacer la vue. Le clic droit glissé fait pareil avec n'importe quel outil.", T("pan"));
  add("Vue", "view.dims", "Afficher / masquer les cotes", "", "Case « Cotes » en haut.", () => api.toggle("dims"));
  add("Vue", "view.reps", "Afficher / masquer les repères", "", "Case « Repères » en haut (P1, L1, I1…).", () => api.toggle("reps"));
  add("Vue", "view.theme", "Thème clair / sombre", "", "Bouton ◐ en haut.", () => document.getElementById("theme").click());
  add("Vue", "help.fond", "Visibilité du fond de plan", "", "Curseur « Fond » en haut.");
  add("Vue", "help.calques", "Calques", "", "Panneau Propriétés sans sélection : afficher (œil) ou verrouiller (cadenas) chaque calque.");

  // Fichier
  add("Fichier", "file.chantiers", "Chantiers : ouvrir, créer, dupliquer", "", "Onglet « Chantiers » (en haut à gauche, ou clic sur le nom du chantier dans la barre) : liste des chantiers, nouveau chantier avec son plan PDF ou image.", () => api.setTab("chantiers"));
  add("Fichier", "file.calib", "Régler l'échelle du fond", "", "Zoomer sur une cote connue du plan, cliquer ses deux extrémités, taper sa longueur réelle : le fond est remis à l'échelle autour du premier point.", () => api.startCalib());
  add("Fichier", "help.nouveau", "Nouveau chantier avec son plan", "", "Chantiers → « Nouveau chantier » : nom, n°, pavillonneur, puis le PDF (choisir la page) ou une photo du plan ; ensuite régler l'échelle.");
  add("Fichier", "help.fichier", "Enregistrer / ouvrir un fichier chantier", "", "Chantiers → bouton « Fichier » : copie .okteo (dessin + fond) ; « Ouvrir un fichier .okteo » pour la recharger sur ce PC ou un autre.");
  add("Fichier", "file.print", "Imprimer / PDF du plan", "Ctrl+P", "Plan vectoriel à l'échelle (1:50 par défaut), A4 ou A3, avec légende, échelle graphique et cartouche (chantier, pavillonneur, date, indice) ; page 2 : nomenclature des appareils par pièce. Aperçu puis « Télécharger le PDF ».", () => hooks.print());
  add("Fichier", "file.export", "Exporter le chantier (JSON)", "", "Copie tout le chantier au format JSON (murs, pièces, appareils, liaisons, cotes).", () => document.getElementById("export").click());
  add("Fichier", "help.save", "Sauvegarde", "", "Automatique, sur ce PC (pastille « Enregistré » en haut).");

  // Aide et IA
  add("Aide et IA", "ai.open", "Ouvrir l'assistant", "A", "Panneau de droite : posez une question en français, il trouve la fonction ou agit si vous le lui demandez.", () => hooks.openAssistant());
  add("Aide et IA", "ai.analyse", "Analyser le plan avec l'IA", "", "Envoie l'image du plan et la liste des objets à l'IA, qui signale oublis et incohérences.", () => hooks.analyse());
  add("Aide et IA", "ai.params", "Paramètres (clés IA)", "", "Onglet « Paramètres » à gauche : clé Claude et/ou NVIDIA, choix du fournisseur, test.", () => api.setTab("params"));
  add("Aide et IA", "help.palette", "Chercher une fonction", "Ctrl+K", "Cette liste, avec recherche.", () => hooks.openPalette());

  // Gestes
  add("Gestes", "help.cadre", "Sélection au cadre", "glisser", "Gauche → droite : seulement ce qui est entièrement dedans. Droite → gauche : tout ce qui est touché.");
  add("Gestes", "help.maj", "Ajouter à la sélection", "Maj+clic", "Ajoute ou retire un objet de la sélection.");
  add("Gestes", "help.glisser", "Déplacer", "glisser", "Glisser un objet sélectionné le déplace ; glisser un mur le déplace parallèlement.");
  add("Gestes", "help.molette", "Zoomer", "molette", "Zoom centré sur le curseur.");

  return C;
}

// Infobulle d'un bouton d'outil de la barre (data-tool)
export function tooltipFor(catalog, toolId) {
  const id = toolId === "__test" ? "mode.test" : toolId === "pan" ? "tool.pan" : catalog.find((c) => c.id === "tool." + toolId) ? "tool." + toolId : "app." + toolId;
  const c = catalog.find((x) => x.id === id);
  return c ? `${c.label}${c.keys ? " (" + c.keys + ")" : ""}\n${c.desc}` : "";
}
