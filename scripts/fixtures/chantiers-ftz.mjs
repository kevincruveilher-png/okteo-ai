// Contenu de 4 chantiers réels (bandes FTZ fournies par Kévin le 27/10/2026, docs/chantiers/) pour tester le câblage
// d'Oktéo sur des maisons vraies : appareils, repères, pièces de cuisine (fils 2,5 mm²), lumières extérieures (câble 3G)
// et appareils posés au même endroit (gaines partagées), boîte FTZ par boîte FTZ.
// Relevé à la main sur les bandes (pas sur les plans : leur fond est scanné). Les positions sont SCHÉMATIQUES : chaque
// boîte FTZ devient une zone de 7 m, ses endroits sont répartis en cercle autour du centre. Pas encore dans le logiciel :
// volets roulants (VR, CVR, Velux), équipotentielles (EQ), lignes directes de la page « LIGNES DIRECTES » (mise à jour 54).
// Notation : un tableau = un endroit (appareils dans une même gaine FTZ) ; suffixe « c » = prise de cuisine (2,5 mm²),
// « e » = lumière extérieure (applique en câble 3G1,5). Allumages : commandes I, V, BP et lumières L de même numéro.
export const CHANTIERS_FTZ = {
  DUCOURNEAU: { ref: "AF26075150", client: "IMMO CONSTRUCTION", boites: {
    LI01: [["P1c"], ["P2c"], ["P3c"], ["P4c"], ["P5c"], ["HOTTE1c"], ["P6"], ["P7"], ["P12", "V4A"], ["P13", "I5", "V4"], ["I2"], ["L2e"], ["L2Ae"], ["L4"], ["L5"]],
    LI02: [["V3"], ["V3A"], ["L3"], ["V6"], ["V6A"], ["L6"], ["P8"], ["P9"], ["P10"], ["P11"], ["P14"], ["P15"]],
    LI03: [["P26", "I12"], ["L12"], ["P27", "V9"], ["V9A"], ["L9"], ["I1"], ["L1e"], ["L1Ae"], ["P17", "I7", "I8"], ["L7"], ["L8"], ["L8A"], ["P18"], ["P28"], ["P29"], ["P30"]],
    LI04: [["P16", "V10"], ["V10A"], ["L10"], ["V11"], ["V11A"], ["L11"], ["P25", "V13"], ["V13A"], ["L13"], ["P19"], ["P20"], ["P21"], ["P22"], ["P23"], ["P24"]],
  } },
  FALGUA: { ref: "AF26064297", client: "ALPHA CONSTRUCTIONS", boites: {
    LI01: [["BP4"], ["BP4A"], ["BP4B"], ["L4"], ["I7"], ["L7"], ["P2"], ["P3"], ["P4"], ["P5"], ["P6"], ["P7"]],
    LI02: [["I9"], ["L9"], ["I11", "I8"], ["L8"], ["L11"], ["P8"], ["P9"], ["P11"], ["P12"]],
    LI03: [["V12"], ["V12A"], ["L12"], ["I21"], ["L21"], ["I13"], ["L13"], ["I5", "I10"], ["L5"], ["L10"], ["I6"], ["L6"], ["P14"], ["P15"], ["P16"], ["P17"], ["P18"], ["P19"]],
    LI04: [["I1"], ["L1e"], ["BP18"], ["BP18B"], ["I17", "BP18A"], ["L17"], ["L18"], ["P31c", "P31Ac"], ["P33c"], ["P34c"], ["HOTTEc"], ["P36c", "P36Ac"]],
    LI05: [["V16"], ["V16A"], ["L16"], ["I14", "V3"], ["V3A"], ["L3e"], ["L3Ae"], ["L14"], ["I15"], ["L15"], ["P1"], ["P10"], ["P13"], ["P20"], ["P21A", "P21B"], ["P26"]],
    LI06: [["I19"], ["L19"], ["V20"], ["V20A"], ["L20"], ["P24"], ["P25"], ["P27"], ["P28"], ["P29"], ["P30"]],
  } },
  BATELIER: { ref: "AF26064644", client: "MAISONS LARA", boites: {
    LI01: [["P6", "I6", "V7"], ["V7A"], ["L7"], ["L6"], ["L6A"], ["I2"], ["L2e"], ["L2Ae"], ["L2Be"], ["P5"], ["P13"], ["P14"], ["P15"], ["P1c"], ["P2c"], ["P3c"], ["P4c"], ["HOTTE1c"]],
    LI02: [["BP5A"], ["BP5B"], ["V3A", "BP5"], ["L5"], ["V1A", "I4"], ["L4"], ["V1", "P7", "V3"], ["L1e"], ["L1Ae"], ["L3"], ["L3A"], ["P8"], ["P9"], ["P10"], ["P11"], ["P16"]],
    LI03: [["I12"], ["L12"], ["P21"], ["P33"], ["P34"], ["P35"], ["P36"]],
    LI04: [["I14", "P23"], ["L14"], ["V11"], ["V11A"], ["L11"], ["P22"], ["P24"], ["P25"], ["P26"], ["P27"]],
    LI05: [["I13"], ["L13"], ["I15"], ["L15"], ["P28"], ["P29"], ["P30"], ["P31"], ["P32"]],
    LI06: [["P17", "I8", "I9"], ["L8"], ["L9"], ["I10", "P18"], ["L10"], ["P12"], ["P19"], ["P20"]],
  } },
  FONTES: { ref: "AF25124651", client: "POLYGONE 46", boites: {
    LI01: [["V6"], ["V6A"], ["L6"], ["P9", "V7"], ["V7A"], ["L7"], ["P6"], ["P7"], ["P8"], ["P10"], ["P11"], ["P12"]],
    LI02: [["I1", "P1", "V3"], ["L1e"], ["V3A"], ["L3"], ["P14", "I4", "I5"], ["L4"], ["L5"], ["P13"]],
    LI03: [["I2", "V10", "V8", "V9"], ["L2e"], ["V9A", "V8A"], ["V10A"], ["L8"], ["L9"], ["L10"], ["I11", "P15c"], ["L11"], ["P16c"], ["P18c"], ["HOTTEc"], ["P2"], ["P3"], ["P4"], ["P5"], ["P17"]],
  } },
};

// plan de test : appareils {id, t, x, y, h, lv, room, rep, ext}, liaisons {c, l}, tableau
export function buildChantier(name) {
  const C = CHANTIERS_FTZ[name], items = [], links = [];
  const boxes = Object.entries(C.boites);
  boxes.forEach(([bn, spots], bi) => {
    const cx = (bi % 2) * 7, cy = Math.floor(bi / 2) * 7, n = spots.length;
    spots.forEach((spot, si) => {
      const ang = (si / n) * 2 * Math.PI, isLight = spot.every((r) => /^L/.test(r));
      const R = isLight ? (spot.some((r) => /e$/.test(r)) ? 3.4 : 1.4) : 2.7;
      const x = +(cx + R * Math.cos(ang)).toFixed(2), y = +(cy + R * Math.sin(ang)).toFixed(2);
      spot.forEach((raw, k) => {
        const cuis = /c$/.test(raw) && /^(P|HOTTE)/.test(raw), ext = /e$/.test(raw) && /^L/.test(raw);
        const rep = raw.replace(/[ce]$/, "");
        const t = /^BP/.test(rep) ? "BP" : /^V/.test(rep) ? "VV" : /^I/.test(rep) ? "INT" : /^L/.test(rep) ? (ext ? "APP" : "LUM") : "PC16";
        const h = t === "LUM" ? null : t === "APP" ? 180 : t === "PC16" ? 30 : 110;
        items.push({ id: `${name}:${rep}`, t, x: x + k * 0.05, y, h, lv: "rdc", lvName: "RDC", room: cuis ? "Cuisine" : `Pièce ${bn}`, rep, ext: ext || undefined, ftz: bn });
      });
    });
  });
  const num = (rep) => (rep.match(/\d+/) || [""])[0];
  for (const c of items.filter((a) => ["INT", "VV", "BP"].includes(a.t)))
    for (const l of items.filter((a) => (a.t === "LUM" || a.t === "APP") && num(a.rep) === num(c.rep))) links.push({ c: c.id, l: l.id });
  const tab = { id: `${name}:TAB`, t: "TAB", x: -4, y: 0, h: 180, lv: "rdc", lvName: "RDC", room: "Garage", rep: "TD1" };
  items.push(tab);
  return { items, links, tab, ftzBoxes: boxes.length, client: C.client, ref: C.ref };
}
