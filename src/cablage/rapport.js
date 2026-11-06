// n° 5 (bloc D, 04/11/2026) : rapport d'analyse clair. Chaque point signalé (contrôle du plan, doutes de l'IA) est rangé
// dans une famille de couleur — l'IA hésite / montage faux / pose / câblage —, expliqué (pourquoi ça clignote), avec ses
// preuves (inscriptions, ce que l'IA a lu, types candidats), la conséquence de chaque choix et une recommandation ; les
// réponses de l'opérateur (qui a décidé quoi) sont gardées pour le technicien BE ; ce que le plan ne dit pas devient une
// question au pavillonneur. Pur (sans DOM).
export const FAMILLES = {
  ia: { label: "L'IA hésite", color: "#2f6fe0", aide: "Information du plan mal lue ou deux types possibles : à trancher en regardant le plan." },
  montage: { label: "Montage faux", color: "#d33a2c", aide: "Ce qui est dessiné ne peut pas marcher tel quel (commande sans lumière, va-et-vient seul…)." },
  pose: { label: "Pose", color: "#f28c1b", aide: "L'appareil est mal placé (hors de son mur, dans un volume de salle de bain, dans une zone d'exclusion, à une hauteur anormale)." },
  cablage: { label: "Câblage", color: "#0b8a7a", aide: "Raccordement à revoir : boîte, circuit, allumage coupé, parcours VMC." },
};
const FAM = {
  lecture: "ia", implantation: "ia",
  cmd: "montage", lum: "montage", vv: "montage", int2: "montage", detecteur: "montage",
  sdb: "pose", mur: "pose", zone: "pose", battant: "pose", embrasure: "pose", hauteur: "pose",
  nobox: "cablage", circ: "cablage", split: "cablage", vmc: "cablage",
};
export const familyOf = (kind) => FAM[kind] || "cablage";
// clé d'un point du contrôle (sorte + appareils) : c'est sous cette clé que la décision de l'opérateur est gardée
export const keyOf = (it) => `${it.kind}:${(it.ids || []).join(",")}`;
// 05/11/2026 : l'opérateur confirme un point (emplacement ou montage voulu) → il ne clignote plus, même si l'appareil
// bouge ensuite. Le câblage (boîte, circuit, allumage coupé, VMC) ne se confirme pas : il se règle dans le panneau Câblage.
export const confirmable = (kind) => familyOf(kind) !== "cablage";
export const isConfirmed = (d) => !!d && (d.choix === "confirme" || d.choix === "garde");
export const silenced = (it, decisions) => confirmable(it.kind) && isConfirmed((decisions || {})[keyOf(it)]);

// « INT ou VV ? … » → ["INT", "VV"] (types connus seulement)
export function candidates(note, types) {
  const m = String(note || "").match(/\b([A-Z][A-Z0-9]{1,7})\s+ou\s+([A-Z][A-Z0-9]{1,7})\b/);
  if (!m) return [];
  return [m[1], m[2]].filter((t) => !types || types[t]);
}
// conséquence (pour le câblage) de choisir un type
export function consequence(t, names = {}) {
  const n = names[t] || t;
  if (t === "INT") return `${n} : simple allumage, une seule commande pour ces lumières (phase + retour).`;
  if (t === "VV") return `${n} : il faut un 2e va-et-vient pour les mêmes lumières (navettes entre les deux commandes).`;
  if (t === "BP") return `${n} : télérupteur au tableau (commande TL + retour).`;
  if (t === "TAB") return `${n} : tableau électrique ; toutes les alimentations partent de lui.`;
  if (t === "SC") return `${n} : sortie de câble, ligne directe depuis le tableau ou circuit à définir.`;
  if (t === "INCONNU") return "Reste à identifier : aucun circuit n'est inventé tant que le type n'est pas connu.";
  if (/^(PC16|PC20|PC32)$/.test(t)) return `${n} : prise sur un circuit de prises (16 A) ou spécialisé (20 / 32 A).`;
  if (/^(LUM|APP|SPOT)$/.test(t)) return `${n} : point d'éclairage, il lui faut une commande.`;
  return `${n}.`;
}
const WHY = {
  lecture: "L'IA n'est pas sûre de ce qu'elle a lu sur le plan à cet endroit.",
  implantation: "L'emplacement exact n'est pas donné par le plan (équipement proposé par Oktéo ou par l'IA).",
  cmd: "Cette commande n'est reliée à aucune lumière : soit une liaison manque, soit ce n'est pas une commande.",
  lum: "Cette lumière n'a pas de commande : soit la liaison manque sur le plan, soit sa commande n'a pas été relevée.",
  vv: "Un va-et-vient ne marche qu'à deux (ou plus) sur la même lumière ; ici il est seul.",
  int2: "Un interrupteur simple et une autre commande sur la même lumière : il faut deux va-et-vient (ou un télérupteur).",
  detecteur: "Lumière à détecteur intégré mais une commande manuelle y est reliée : le fonctionnement est contradictoire.",
  sdb: "L'appareil est dans un volume de la salle de bain où il est interdit ou limité (NF C 15-100, 7-701).",
  mur: "L'appareil est posé dans l'épaisseur d'un mur sans y être accroché.",
  zone: "L'appareil est dans une zone d'exclusion (rien ne doit y être posé).",
  battant: "La commande est derrière le battant d'une porte ouverte.",
  embrasure: "L'appareil tombe dans le vide d'une ouverture (porte, fenêtre).",
  hauteur: "La hauteur de pose sort des règles (hauteur du chantier, PMR).",
  nobox: "L'appareil n'est dans aucune boîte : il ne sera pas raccordé.",
  circ: "L'appareil n'est sur aucun circuit.",
  split: "La commande et sa lumière sont dans deux boîtes différentes : l'allumage est coupé.",
  vmc: "Le parcours de VMC est à vérifier (longueur, rejet).",
};
const RECO = {
  lecture: "Regardez l'extrait du plan et choisissez le bon type ; s'il ne se lit pas, posez la question au pavillonneur.",
  implantation: "Déplacez l'appareil à sa place réelle puis confirmez-le dans Propriétés.",
  cmd: "Reliez-la à sa lumière (outil Liaison), ou changez son type si ce n'est pas une commande.",
  lum: "Cherchez la commande près de la porte la plus proche (souvent à l'intérieur) et reliez-la ; sinon question au pavillonneur.",
  vv: "Ajoutez le 2e va-et-vient (autre porte de la pièce) ou passez-le en interrupteur simple.",
  int2: "Passez les deux commandes en va-et-vient.",
  detecteur: "Retirez la liaison manuelle ou passez la lumière en commande manuelle.",
  sdb: "Déplacez l'appareil hors du volume (ou choisissez du matériel autorisé dans ce volume).",
  mur: "Ctrl+K → « Recoller les appareils à leur mur », ou glissez-le contre le mur.",
  zone: "Déplacez l'appareil hors de la zone hachurée rouge.",
  battant: "Placez la commande côté poignée de la porte.",
  embrasure: "Décalez l'appareil à côté de l'ouverture.",
  hauteur: "Corrigez la hauteur dans Propriétés.",
  nobox: "Panneau Câblage → placer les boîtes, ou tirer une gaine depuis une boîte.",
  circ: "Panneau Câblage → répartir les circuits, ou l'ajouter à un circuit.",
  split: "Panneau Câblage → « Ramener dans la même boîte ».",
  vmc: "Vérifiez le parcours dans l'étude VMC.",
};
// questions au pavillonneur : ce que le plan ne dit pas
const ASK = {
  lum: (r) => `Quelle commande allume ${r} (aucune commande ne lui est reliée sur le plan) ?`,
  lecture: (r, a) => `${r} : quel est cet appareil${a && a.inscription ? ` (inscription « ${a.inscription} »)` : ""} ?`,
  implantation: (r) => `Où exactement placer ${r} ?`,
  vv: (r) => `${r} : va-et-vient avec quelle autre commande (la 2e n'est pas sur le plan) ?`,
};

// un point du contrôle → fiche expliquée. issue = {kind, ids, text?} ; a = appareil principal {id, t, rep, room,
// inscription, aiNote, aiType, calibre} ; types = TYPES (noms) ; decision = réponse déjà donnée
export function explain(issue, a, types = {}, decision = null) {
  const fam = familyOf(issue.kind), names = Object.fromEntries(Object.entries(types).map(([k, v]) => [k, v.n || k]));
  const rep = a ? `${a.rep || a.t}${a.room ? " (" + a.room + ")" : ""}` : "l'appareil";
  const preuves = [];
  if (a && a.inscription) preuves.push(`Inscription lue sur le plan : « ${a.inscription} »`);
  if (a && a.aiType && a.aiType !== a.t) preuves.push(`L'IA l'avait lu comme ${names[a.aiType] || a.aiType}`);
  if (a && a.aiNote) preuves.push(`Remarque de l'IA : ${a.aiNote}`);
  if (a && a.calibre) preuves.push(`Calibre écrit : ${a.calibre} A`);
  if (issue.text) preuves.push(issue.text);
  const cands = a ? candidates(a.aiNote, types) : [];
  const choix = cands.map((t) => ({ type: t, label: `C'est ${names[t] || t}`, consequence: consequence(t, names) }));
  const ask = ASK[issue.kind] ? ASK[issue.kind](rep, a) : null;
  return { key: `${issue.kind}:${(issue.ids || []).join(",")}`, kind: issue.kind, fam, famille: FAMILLES[fam], rep, pourquoi: WHY[issue.kind] || "Point signalé par le contrôle.", preuves, choix, recommandation: RECO[issue.kind] || "", question: ask, decision };
}
// rapport complet : points par famille, décisions (qui a décidé quoi), questions au pavillonneur ; texte pour le BE
export function buildRapport(issues, byId, types = {}, decisions = {}, questions = []) {
  const points = issues.map((it) => explain(it, byId.get((it.ids || [])[0]), types, decisions[keyOf(it)] || null));
  // validations pour le technicien BE : emplacements confirmés, et points corrigés (« Modifier ») qui ne sont plus signalés
  const open = new Set(issues.map(keyOf));
  const validations = Object.entries(decisions || {})
    .filter(([k, d]) => (isConfirmed(d) && confirmable(k.split(":")[0])) || (d.choix === "modifier" && !open.has(k)))
    .map(([k, d]) => ({ key: k, kind: k.split(":")[0], rep: d.rep || k.split(":")[1], alerte: d.alerte || WHY[k.split(":")[0]] || "", label: d.choix === "modifier" ? "corrigé par l'opérateur" : d.label, by: d.by || "", at: d.at || "" }))
    .sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const parFamille = Object.keys(FAMILLES).map((f) => ({ fam: f, ...FAMILLES[f], points: points.filter((p) => p.fam === f) })).filter((g) => g.points.length);
  const Q = [...questions.map((q) => q.text), ...points.filter((p) => p.question && p.decision && p.decision.choix === "pavillonneur").map((p) => p.question)];
  return { points, parFamille, questions: [...new Set(Q)], validations, decided: points.filter((p) => p.decision).length, total: points.length };
}
export function rapportText(R, { chantier = "" } = {}) {
  const L = [`Rapport d'analyse${chantier ? " — " + chantier : ""} : ${R.total} point(s), ${R.decided} décidé(s)`];
  for (const g of R.parFamille) {
    L.push("", `${g.label} (${g.points.length})`);
    for (const p of g.points) L.push(`- ${p.rep} : ${p.pourquoi}${p.decision ? ` → ${p.decision.label}${p.decision.by ? " (" + p.decision.by + (p.decision.at ? ", " + p.decision.at.slice(0, 10) : "") + ")" : ""}` : " → à décider"}`);
  }
  if ((R.validations || []).length) {
    L.push("", `Emplacements confirmés et corrections (${R.validations.length})`);
    for (const v of R.validations) L.push(`- ${v.rep} : ${v.alerte} → ${v.label}${v.by ? " (" + v.by + (v.at ? ", " + v.at.slice(0, 16).replace("T", " ") : "") + ")" : ""}`);
  }
  if (R.questions.length) { L.push("", "Questions au pavillonneur"); R.questions.forEach((q, i) => L.push(`${i + 1}. ${q}`)); }
  return L.join("\n");
}
