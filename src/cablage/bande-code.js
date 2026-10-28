// Bande de câblage dans un QR code (v49) — partie pure (navigateur et Node : CompressionStream).
// La feuille de boîte est réduite à l'essentiel (en-tête, faces, gaines et leurs fils, raccordements), compressée
// (deflate) et mise dans l'adresse de la page « bande.html » de la version en ligne : le téléphone qui scanne le QR
// ouvre la bande sans serveur ni compte, rien n'est envoyé sur Internet.
export const PUBLIC_BASE = "https://kevincruveilher-png.github.io/okteo-ai/";
const FN = ["terre", "neutre", "phase", "retour", "nav1", "nav2", "cmdTL", "retTL", "isole"];

// feuille (boxSheets) → objet compact
export function packSheet(S, { labels = true } = {}) {
  const colors = [], ci = (c) => { if (!c) return -1; let i = colors.indexOf(c); if (i < 0) { i = colors.length; colors.push(c); } return i; };
  const r1 = (v) => (v == null ? null : Math.round(v * 100) / 100);
  const g = S.box.gaines.map((x) => [x.no, x.face, x.kind === "alim" ? 1 : 0, x.kind === "alim" ? "" : (x.reps && x.reps.length ? x.reps.join("+") : x.label || ""),
    r1(x.length), x.diam || 0, x.cable || 0, x.serie || 0,
    x.wires.map((w) => [Math.max(0, FN.indexOf(w.fn)), ci(w.color), w.section || 0, w.n ?? null, ci(w.core && w.core !== w.color ? w.core : ""), w.bague || ""]),
    x.slot ?? -1]);   // v60 : point d'accroche (ordre réel sur la face, tranches pour le perceur)
  return {
    v: 1,
    h: [S.ch.client || "", S.ch.nom || "", S.ch.numero || "", S.box.n, S.level || "", S.cover || "haut", S.model || "", S.code || ""],
    a: S.tabAng == null ? null : Math.round(S.tabAng * 100) / 100,
    s: ["A", "B", "C", "D"].map((f) => S.sides[f] || ""),
    c: colors,
    z: [...new Set(S.steps.flatMap((s) => s.conn.list))].sort((p, q) => p - q),
    g,
    n: S.box.nets.map((t) => [t.n, labels ? t.label : "", Math.max(0, FN.indexOf(t.fn))]),
  };
}

// objet compact → { head, sides, tabAng, box (pour schemaSVG / boxSteps), sizes }
export function unpackSheet(P) {
  const col = (i) => (i >= 0 ? P.c[i] : null);
  const box = {
    n: P.h[3],
    gaines: P.g.map(([no, face, alim, who, length, diam, cable, serie, W, slot]) => ({
      no, face, slot: slot == null || slot < 0 ? null : slot, kind: alim ? "alim" : "app", label: alim ? "Alimentation (tableau)" : who, reps: alim ? [] : who ? [who] : [], length, diam, cable: cable || null, serie: serie || 0, circuits: [],
      wires: W.map(([f, c, section, n, core, bague]) => ({ fn: FN[f], color: col(c), section, n, core: col(core), bague: bague || null })),
    })),
    nets: P.n.map(([n, label, f]) => ({ n, label: label || FN_FR[FN[f]] || "", fn: FN[f] })),
  };
  return {
    head: { client: P.h[0], nom: P.h[1], numero: P.h[2], box: P.h[3], level: P.h[4], cover: P.h[5], model: P.h[6], code: P.h[7] },
    sides: { A: P.s[0], B: P.s[1], C: P.s[2], D: P.s[3] }, tabAng: P.a, box, sizes: P.z && P.z.length ? P.z : [2, 3, 4, 5, 6, 8, 10, 12],
  };
}
const FN_FR = { terre: "Terres", neutre: "Neutre", phase: "Phase", retour: "Retour lampe", nav1: "Navette 1", nav2: "Navette 2", cmdTL: "Commande télérupteur", retTL: "Retour télérupteur", isole: "Fil isolé" };

// ---------- compression + base64url ----------
const b64u = (bytes) => { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const unb64u = (t) => { const s = atob(t.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((t.length + 3) % 4)); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; };
async function pipe(bytes, stream) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer()); }

export async function encodeSheet(obj) {
  return b64u(await pipe(new TextEncoder().encode(JSON.stringify(obj)), new CompressionStream("deflate-raw")));
}
export async function decodeSheet(txt) {
  return JSON.parse(new TextDecoder().decode(await pipe(unb64u(txt), new DecompressionStream("deflate-raw"))));
}
export const bandeUrl = (data, base = PUBLIC_BASE) => base.replace(/\/?$/, "/") + "bande.html#b=" + data;

// adresse de la bande pour le QR ; trop grosse pour un QR (≈ 2 900 octets) : sans les libellés des raccordements
export async function sheetUrl(S, base) {
  let url = bandeUrl(await encodeSheet(packSheet(S)), base), short = false;
  if (url.length > 2800) { url = bandeUrl(await encodeSheet(packSheet(S, { labels: false })), base); short = true; }
  return { url, short, tooBig: url.length > 2900 };
}
