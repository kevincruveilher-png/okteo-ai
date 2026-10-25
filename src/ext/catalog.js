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

export const CATS = ["Dessiner", "Appareils", "Relier", "Sélection et édition", "Vue", "Fichier", "Aide et IA", "Gestes"];

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
  add("Dessiner", "walls.detect", "Relever les murs du PDF (automatique)", "", "Lit les murs dessinés dans le PDF du plan (sans IA) : épaisseurs, angles, portes et fenêtres. Aperçu en orange, puis « Ajouter au dessin ». Il faut un fond PDF à l'échelle.", () => hooks.detectWalls());
  add("Dessiner", "rooms.detect", "Détecter les pièces (automatique)", "", "Trouve les pièces fermées par les murs (y compris en L), leur surface habitable et leur nom lu sur le plan PDF. Aperçu, puis « Ajouter les pièces ». Proposé automatiquement après un relevé des murs.", () => hooks.detectRooms());
  add("Appareils", "devices.detect", "Relever les appareils du PDF (automatique)", "", "Lit les symboles du plan PDF (sans IA) : prises 16/20 A, RJ45, interrupteurs, va-et-vient, points lumineux, spots, sorties de câble, bouches VMC, et les liaisons commande → lumière. Aperçu, puis « Ajouter les appareils » ; les appareils muraux se collent à leur mur. Proposé après la détection des pièces.", () => hooks.detectDevices());
  add("Dessiner", "help.echelle", "Contrôle de l'échelle par les cotes du plan", "", "À l'ouverture du relevé des murs, Oktéo relit les cotes du PDF (même en police codée) et les compare aux longueurs mesurées : « ✓ Échelle confirmée » ou « ⚠ décalée de x % » avec un bouton « Corriger l'échelle » (tant qu'aucun mur n'est dessiné).", () => hooks.detectWalls());
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
