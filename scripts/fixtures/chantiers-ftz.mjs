// Contenu de 4 chantiers réels (bandes FTZ fournies par Kévin le 27/10/2026, docs/chantiers/) pour tester le câblage
// d'Oktéo sur des maisons vraies : appareils, repères, pièces de cuisine (fils 2,5 mm²), lumières extérieures (câble 3G)
// et appareils posés au même endroit (gaines partagées), boîte FTZ par boîte FTZ.
// Relevé à la main sur les bandes (pas sur les plans : leur fond est scanné). Les positions sont SCHÉMATIQUES : chaque
// boîte FTZ devient une zone de 7 m, ses endroits sont répartis en cercle autour du centre.
// (v54 : volets roulants, CVR, Velux, équipotentielles locales « EQnl », hotte, lignes directes de DUCOURNEAU ajoutés.)
// Notation : un tableau = un endroit (appareils dans une même gaine FTZ) ; suffixe « c » = prise de cuisine (2,5 mm²),
// « e » = lumière extérieure (applique en câble 3G1,5). Allumages : commandes I, V, BP et lumières L de même numéro.
export const CHANTIERS_FTZ = {
  DUCOURNEAU: { ref: "AF26075150", client: "IMMO CONSTRUCTION", boites: {
    LI01: [["P1c"], ["P2c"], ["P3c"], ["P4c"], ["P5c"], ["HOTTE1c"], ["P6"], ["P7"], ["P12", "V4A"], ["P13", "I5", "V4"], ["I2"], ["L2e"], ["L2Ae"], ["L4"], ["L5"]],
    LI02: [["V3"], ["V3A"], ["L3"], ["V6"], ["V6A"], ["L6"], ["P8"], ["P9"], ["P10"], ["P11"], ["P14"], ["P15"]],
    LI03: [["P26", "I12"], ["L12"], ["P27", "V9"], ["V9A"], ["L9"], ["I1"], ["L1e"], ["L1Ae"], ["P17", "I7", "I8"], ["L7"], ["L8"], ["L8A"], ["P18"], ["P28"], ["P29"], ["P30"], ["EQ1l"], ["EQ2l"]],
    LI04: [["P16", "V10"], ["V10A"], ["L10"], ["V11"], ["V11A"], ["L11"], ["P25", "V13"], ["V13A"], ["L13"], ["P19"], ["P20"], ["P21"], ["P22"], ["P23"], ["P24"]],
    LI05: [["VR1"], ["VR2"], ["VR3"], ["VR4"], ["VR5"], ["VR6"]],
  },
  // feuille « LIGNES DIRECTES » de FTZ : étiquette, type Oktéo (variante), gaine et fil relevés
  lignes: [["C1", "RAD", "ICTA16", "1.5B+N+M+V/J"], ["C2", "RAD", "ICTA16", "1.5B+N+M+V/J"], ["C3", "RAD", "ICTA16", "1.5B+N+M+V/J"], ["C4", "RAD", "ICTA16", "1.5B+IV+M+V/J"],
    ["SS1", "SS", "ICTA16", "1.5BF+M+V/J"], ["C VMC1", "CVMC", "ICTA16", "1.5GR+N"], ["VMC1", "VMCG", "ICTA16", "1.5R+B+V/J"], ["EQ3", "EQP", "ICTA20", "10V/J"],
    ["ANT1", "ANT", "ICTA_V20", "17 VATC"], ["TV1", "TV", "ICTA_V20", "17 VATC"], ["TV2", "TV", "ICTA_V20", "17 VATC"], ["FOUR1", "FOUR", "ICTA16", "2.5B+R+V/J"],
    ["LL1", "LL", "ICTA16", "2.5B+R+V/J"], ["LV1", "LV", "ICTA16", "2.5B+R+V/J"], ["SL1", "SL", "ICTA16", "2.5B+R+V/J"], ["CETH1", "CETH", "ICTA20", "3G2.5"],
    ["G EXT1", "GEXT", "ICTA20", "3G2.5"], ["PC EXT1", "PCEXT", "ICTA20", "3G2.5"], ["PC EXT2", "PCEXT", "ICTA20", "3G2.5"], ["INTERCO1", "INTERCO", "ICTA20", "4G1.5"],
    ["PLAQUES1", "PLAQ", "ICTA20", "6R+B+V/J"], ["INTERCO2", "INTERCO:7g15", "ICTA20", "7G1.5"], ["RJ1", "RJ45", "ICTA_V20", "grade-3_TV"], ["RJ2", "RJ45", "ICTA_V20", "grade-3_TV"],
    ["RJ3", "RJ45", "ICTA_V20", "grade-3_TV"], ["RJ4", "RJ45", "ICTA_V20", "grade-3_TV"], ["RJ5", "RJ45", "ICTA_V20", "grade-3_TV"], ["AIG2", "AIG", "GAINE_AIGUILLEE40", ""]],
  lignesTotal: { ICTA16: 11, ICTA20: 16, AIG: 1 } },
  FALGUA: { ref: "AF26064297", client: "ALPHA CONSTRUCTIONS", boites: {
    LI01: [["BP4"], ["BP4A"], ["BP4B"], ["L4"], ["I7"], ["L7"], ["P2"], ["P3"], ["P4"], ["P5"], ["P6"], ["P7"]],
    LI02: [["I9"], ["L9"], ["I11", "I8"], ["L8"], ["L11"], ["P8"], ["P9"], ["P11"], ["P12"], ["EQ1l"], ["EQ3l"]],
    LI03: [["V12"], ["V12A"], ["L12"], ["I21"], ["L21"], ["I13"], ["L13"], ["I5", "I10"], ["L5"], ["L10"], ["I6"], ["L6"], ["P14"], ["P15"], ["P16"], ["P17"], ["P18"], ["P19"]],
    LI04: [["I1"], ["L1e"], ["BP18"], ["BP18B"], ["I17", "BP18A"], ["L17"], ["L18"], ["P31c", "P31Ac"], ["P33c"], ["P34c"], ["HOTTEc"], ["P36c", "P36Ac"]],
    LI05: [["V16"], ["V16A"], ["L16"], ["I14", "V3"], ["V3A"], ["L3e"], ["L3Ae"], ["L14"], ["I15"], ["L15"], ["P1"], ["P10"], ["P13"], ["P20"], ["P21A", "P21B"], ["P26"]],
    LI06: [["I19"], ["L19"], ["V20"], ["V20A"], ["L20"], ["P24"], ["P25"], ["P27"], ["P28"], ["P29"], ["P30"]],
    LI07: [["VR2"], ["VR3"], ["VR4"], ["VR5"]],
    LI08: [["VR1"], ["VR6"], ["VR7"]],
  } },
  BATELIER: { ref: "AF26064644", client: "MAISONS LARA", boites: {
    LI01: [["P6", "I6", "V7"], ["V7A"], ["L7"], ["L6"], ["L6A"], ["I2"], ["L2e"], ["L2Ae"], ["L2Be"], ["P5"], ["P13"], ["P14"], ["P15"], ["P1c"], ["P2c"], ["P3c"], ["P4c"], ["HOTTE1c"]],
    LI02: [["BP5A"], ["BP5B"], ["V3A", "BP5"], ["L5"], ["V1A", "I4"], ["L4"], ["V1", "P7", "V3"], ["L1e"], ["L1Ae"], ["L3"], ["L3A"], ["P8"], ["P9"], ["P10"], ["P11"], ["P16"]],
    LI03: [["I12"], ["L12"], ["P21"], ["P33"], ["P34"], ["P35"], ["P36"]],
    LI04: [["I14", "P23"], ["L14"], ["V11"], ["V11A"], ["L11"], ["P22"], ["P24"], ["P25"], ["P26"], ["P27"]],
    LI05: [["I13"], ["L13"], ["I15"], ["L15"], ["P28"], ["P29"], ["P30"], ["P31"], ["P32"]],
    LI06: [["P17", "I8", "I9"], ["L8"], ["L9"], ["I10", "P18"], ["L10"], ["P12"], ["P19"], ["P20"], ["EQ1l"]],
    LI07: [["CVR3"], ["CVR4"], ["CVR5"], ["VEL1"], ["VR1"], ["VR2"], ["VR3"], ["VR4"], ["VR5"]],
  } },
  FONTES: { ref: "AF25124651", client: "POLYGONE 46", boites: {
    LI01: [["V6"], ["V6A"], ["L6"], ["P9", "V7"], ["V7A"], ["L7"], ["P6"], ["P7"], ["P8"], ["P10"], ["P11"], ["P12"]],
    LI02: [["I1", "P1", "V3"], ["L1e"], ["V3A"], ["L3"], ["P14", "I4", "I5"], ["L4"], ["L5"], ["P13"], ["EQ1l"], ["EQ2l"]],
    LI03: [["I2", "V10", "V8", "V9"], ["L2e"], ["V9A", "V8A"], ["V10A"], ["L8"], ["L9"], ["L10"], ["I11", "P15c"], ["L11"], ["P16c"], ["P18c"], ["HOTTEc"], ["P2"], ["P3"], ["P4"], ["P5"], ["P17"]],
    LI04: [["VR1"], ["VR2"], ["VR3"], ["VR4"]],
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
        const cuis = /c$/.test(raw) && /^(P|HOTTE)/.test(raw), ext = /e$/.test(raw) && /^L/.test(raw), eql = /^EQ\d+l$/.test(raw);
        const rep = raw.replace(/[cel]$/, "");
        const t = eql ? "EQL" : /^HOTTE/.test(rep) ? "HOTTE" : /^CVR/.test(rep) ? "CVR" : /^VR/.test(rep) ? "VR" : /^VEL/.test(rep) ? "VEL" : /^BP/.test(rep) ? "BP" : /^V/.test(rep) ? "VV" : /^I/.test(rep) ? "INT" : /^L/.test(rep) ? (ext ? "APP" : "LUM") : "PC16";
        const h = t === "LUM" || t === "VEL" ? null : t === "APP" ? 180 : t === "PC16" || t === "EQL" ? 30 : t === "VR" ? 220 : t === "HOTTE" ? 200 : 110;
        items.push({ id: `${name}:${rep}`, t, x: x + k * 0.05, y, h, lv: "rdc", lvName: "RDC", room: cuis || t === "HOTTE" ? "Cuisine" : `Pièce ${bn}`, rep, ext: ext || undefined, ftz: bn, ...(t === "HOTTE" ? { racc: "boite" } : {}) });
      });
    });
  });
  const num = (rep) => (rep.match(/\d+/) || [""])[0];
  for (const c of items.filter((a) => ["INT", "VV", "BP"].includes(a.t)))
    for (const l of items.filter((a) => (a.t === "LUM" || a.t === "APP") && num(a.rep) === num(c.rep))) links.push({ c: c.id, l: l.id });
  // commande de volet filaire : CVRn → VRn (R-096)
  for (const c of items.filter((a) => a.t === "CVR")) for (const v of items.filter((a) => a.t === "VR" && num(a.rep) === num(c.rep))) links.push({ c: c.id, l: v.id });
  // lignes directes de la feuille FTZ (positions schématiques autour du tableau)
  (C.lignes || []).forEach(([rep, tv], i) => { const [t, v] = tv.split(":"); items.push({ id: `${name}:${rep}`, t, x: -6 - (i % 5), y: Math.floor(i / 5) * 1.5, h: 30, lv: "rdc", lvName: "RDC", room: "Pièce lignes", rep, ...(v ? { var: v } : {}) }); });
  const tab = { id: `${name}:TAB`, t: "TAB", x: -4, y: 0, h: 180, lv: "rdc", lvName: "RDC", room: "Garage", rep: "TD1" };
  items.push(tab);
  return { items, links, tab, ftzBoxes: boxes.length, client: C.client, ref: C.ref, lignes: C.lignes || null, lignesTotal: C.lignesTotal || null };
}
