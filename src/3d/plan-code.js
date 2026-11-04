// 3D-8 : maquette 3D d'une face imprimée du plan dans un QR code (pur, navigateur et Node).
// Contenu : la coque (murs, ouvertures, pièces), les appareils de la face, ses boîtes et leurs gaines (tracé du plan,
// passage par le sol) et ses lignes directes ; version et date. AUCUN nom (client, chantier, n° d'affaire, adresse) :
// seuls les noms de pièces et les repères d'appareils y sont. Coordonnées en centimètres entiers, relatives au coin du
// plan, différences successives (elles se compressent mieux) ; compression deflate + base64url (encodeSheet de la bande).
import { encodeSheet, decodeSheet, PUBLIC_BASE } from "../cablage/bande-code.js";

export const PLAN3D_V = 1;
const KIND = ["porte", "fenetre", "garage"];
const cm = (m) => Math.round(m * 100);

// S = { data {nodes, segs [{id,a,b,ep,top?}], openings [{seg,t,w,kind,hinge,swing,allege?,linteau? (m)}]},
//       rooms [{name, poly}], apps [{id,t,x,y,h (cm|null),seg,rep}], boxes [{id,n,x,y}],
//       gaines [{box (id), apps [ids] | ["tab"], route [{x,y}], sol, no ("04")}], direct [{app (id), label}], H (m),
//       date "AAAA-MM-JJ", level, face {i, n, label} (face i sur n de l'impression), plan (empreinte du chantier, sans nom),
//       stamp (moment de l'impression : le même sur toutes les faces d'une impression) }
export function packPlan(S) {
  const nodes = S.data.nodes || [], ni = new Map(nodes.map((n, i) => [n.id, i]));
  const segs = (S.data.segs || []).filter((s) => !s.virt && ni.has(s.a) && ni.has(s.b)), si = new Map(segs.map((s, i) => [s.id, i]));
  const xs = [...nodes.map((n) => n.x), ...(S.apps || []).map((a) => a.x)], ys = [...nodes.map((n) => n.y), ...(S.apps || []).map((a) => a.y)];
  const ox = cm(Math.min(0, ...xs.filter(Number.isFinite))), oy = cm(Math.min(0, ...ys.filter(Number.isFinite)));
  const X = (x) => cm(x) - ox, Y = (y) => cm(y) - oy;
  // suite de points → différences successives
  const delta = (pts) => { const out = []; let px = 0, py = 0; for (const p of pts) { const x = X(p.x), y = Y(p.y); out.push(x - px, y - py); px = x; py = y; } return out; };
  const apps = (S.apps || []).filter((a) => Number.isFinite(a.x) && Number.isFinite(a.y)), ai = new Map(apps.map((a, i) => [a.id, i]));
  const bi = new Map((S.boxes || []).map((b, i) => [b.id, i]));
  return {
    v: PLAN3D_V, d: S.date || "", l: S.level || "",
    f: S.face ? [S.face.i || 1, S.face.n || 1, S.face.label || ""] : null, k: S.plan || "", t: S.stamp || "",
    o: [ox, oy],
    H: [S.H.plafond, S.H.allege, S.H.linteau, S.H.porte, S.H.baie, S.H.garage].map(cm),
    N: delta(nodes),
    S: segs.flatMap((s) => [ni.get(s.a), ni.get(s.b), cm(s.ep > 0 ? s.ep : 0.2), s.top ? cm(s.top) : 0]),
    O: (S.data.openings || []).filter((o) => si.has(o.seg) && o.w > 0).flatMap((o) => [si.get(o.seg), cm(o.t), cm(o.w), Math.max(0, KIND.indexOf(o.kind)), (o.hinge === "d" ? 1 : 0) + (o.swing === "ext" ? 2 : 0), o.allege > 0 ? cm(o.allege) : 0, o.linteau > 0 ? cm(o.linteau) : 0]),
    R: (S.rooms || []).filter((r) => r.poly && r.poly.length > 2).map((r) => [r.name || "", delta(r.poly), r.hsp > 0 ? cm(r.hsp) : 0]),
    // appareils : différences successives de position, hauteur (cm, -1 = hauteur de départ), mur (-1 = posé), repère
    A: (() => { const out = []; let px = 0, py = 0; for (const a of apps) { const x = X(a.x), y = Y(a.y); out.push(a.t, x - px, y - py, Number.isFinite(a.h) ? Math.round(a.h) : -1, a.seg && si.has(a.seg) ? si.get(a.seg) : -1, a.rep || ""); px = x; py = y; } return out; })(),
    B: (S.boxes || []).flatMap((b) => [b.n || "", X(b.x), Y(b.y)]),
    G: (S.gaines || []).filter((g) => bi.has(g.box)).map((g) => [bi.get(g.box), (g.apps || []).map((id) => (id === "tab" ? -1 : ai.has(id) ? ai.get(id) : -2)).filter((k) => k !== -2), g.sol ? 1 : 0, delta(g.route || []), g.no || ""]).filter((g) => g[1].length),
    L: (S.direct || []).filter((d) => ai.has(d.app)).flatMap((d) => [ai.get(d.app), d.label || ""]),
  };
}

// objet compact → { data, rooms, apps, boxes, gaines, direct, H, date, level } (identifiants recréés : n0…, s0…, a0…, b0…)
export function unpackPlan(P) {
  if (!P || P.v !== PLAN3D_V) throw new Error("Version de maquette inconnue : mettez à jour l'impression du plan.");
  const [ox, oy] = P.o, m = (v) => v / 100, H = P.H.map(m);
  const undelta = (d) => { const pts = []; let x = 0, y = 0; for (let i = 0; i + 1 < d.length; i += 2) { x += d[i]; y += d[i + 1]; pts.push({ x: m(x + ox), y: m(y + oy) }); } return pts; };
  const nodes = undelta(P.N).map((p, i) => ({ id: "n" + i, ...p }));
  const segs = []; for (let i = 0; i < P.S.length; i += 4) segs.push({ id: "s" + segs.length, a: "n" + P.S[i], b: "n" + P.S[i + 1], ep: m(P.S[i + 2]), top: P.S[i + 3] ? m(P.S[i + 3]) : null });
  const openings = []; for (let i = 0; i < P.O.length; i += 7) { const [s, t, w, k, f, al, li] = P.O.slice(i, i + 7); openings.push({ id: "o" + openings.length, seg: "s" + s, t: m(t), w: m(w), kind: KIND[k] || "porte", hinge: f & 1 ? "d" : "g", swing: f & 2 ? "ext" : "int", allege: al ? m(al) : undefined, linteau: li ? m(li) : undefined }); }
  const rooms = P.R.map(([name, d, hsp], i) => ({ id: "r" + i, name, poly: undelta(d), hsp: hsp ? m(hsp) : null }));
  const apps = []; { let x = 0, y = 0; for (let i = 0; i < P.A.length; i += 6) { const [t, dx, dy, h, s, rep] = P.A.slice(i, i + 6); x += dx; y += dy; apps.push({ id: "a" + apps.length, t, x: m(x + ox), y: m(y + oy), h: h >= 0 ? h : null, seg: s >= 0 ? "s" + s : null, rep }); } }
  const boxes = []; for (let i = 0; i < P.B.length; i += 3) boxes.push({ id: "b" + boxes.length, n: P.B[i], x: m(P.B[i + 1] + ox), y: m(P.B[i + 2] + oy) });
  const gaines = P.G.map(([b, list, sol, d, no], i) => ({ id: "g" + i, box: "b" + b, apps: list.map((k) => (k < 0 ? "tab" : "a" + k)), sol: !!sol, route: undelta(d), no: no || "" }));
  const direct = []; for (let i = 0; i < P.L.length; i += 2) direct.push({ app: "a" + P.L[i], label: P.L[i + 1] });
  return { data: { nodes, segs, openings }, rooms, apps, boxes, gaines, direct, H: { plafond: H[0], allege: H[1], linteau: H[2], porte: H[3], baie: H[4], garage: H[5], combles: Math.max(H[0], ...segs.map((s) => s.top || 0)) + 0.35 }, date: P.d, level: P.l, face: P.f ? { i: P.f[0], n: P.f[1], label: P.f[2] } : null, plan: P.k || "", stamp: P.t || "" };
}

// empreinte courte d'un texte (FNV-1a 32 bits) : reconnaît un même chantier sur deux faces sans y mettre son nom
export function fingerprint(txt) { let h = 0x811c9dc5; for (const c of String(txt)) { h ^= c.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); }

export const QR_MAX = 2900;
export const plan3dUrl = (data, base = PUBLIC_BASE) => base.replace(/\/?$/, "/") + "plan3d.html#p=" + data;
// → { url, size, tooBig, light } ; trop gros : on retire d'abord les repères, puis les contours des pièces (sols)
export async function planUrl(S, base) {
  let P = packPlan(S), url = plan3dUrl(await encodeSheet(P), base), light = 0;
  if (url.length > QR_MAX) { P = { ...P, A: P.A.map((v, i) => (i % 6 === 5 ? "" : v)) }; url = plan3dUrl(await encodeSheet(P), base); light = 1; }
  if (url.length > QR_MAX) { P = { ...P, R: P.R.map(([n, d, h]) => [n, d.slice(0, 2), h]) }; url = plan3dUrl(await encodeSheet(P), base); light = 2; }
  return { url, size: url.length, tooBig: url.length > QR_MAX, light };
}
export const decodePlan = async (txt) => unpackPlan(await decodeSheet(txt));
