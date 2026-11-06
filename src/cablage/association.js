// Association au même endroit (lot 2 de la reprise des paramètres du BE, 06/11/2026, décision n° 4 de Kévin) :
// liste « CAT_PROX » du BE — des appareils à moins de memeEndroit (0,30 m) partagent une gaine seulement si ce sont des
// prises entre elles (cuisine comprise), une prise et une liaison équipotentielle, une prise et des commandes, ou des
// commandes entre elles. Jamais le courant faible, jamais une lumière ni un appareil spécialisé. Pur ; partagé par le
// placement des boîtes (boites.js, nombre de départs) et le câblage (gaines.js).
const ASSOC = { PC16: "prise", INT: "cmd", VV: "cmd", BP: "cmd", CVR: "cmd", CVMC: "cmd", EQL: "le", LEM: "le" };
const OK = new Set(["prise|prise", "prise|le", "le|prise", "prise|cmd", "cmd|prise", "cmd|cmd"]);
export const assocOK = (t1, t2) => OK.has(`${ASSOC[t1] || "-"}|${ASSOC[t2] || "-"}`);
