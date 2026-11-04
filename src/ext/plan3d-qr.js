// 3D-8 : contenu du QR « maquette 3D » d'une face imprimée du plan (par l'interface publique seulement).
// Une face = les appareils qu'elle montre, ses boîtes (et leurs gaines : tracé du plan, passage par le sol) et, au verso,
// ses lignes directes. Aucun nom de client ni de chantier : la page plan3d.html n'en affiche pas.
import { planData } from "./vue3d.js";
import { wiringNow, gaineKeys } from "./cablage-data.js";
import { planUrl, fingerprint } from "../3d/plan-code.js";

const today = () => new Date().toISOString().slice(0, 10);

// face { apps: Set d'ids | null (tous), boxes: Set d'ids | null (toutes) | vide, direct: bool, page, pages, label, stamp }
export function faceData(api, face = {}) {
  const P = planData(api), geo = api.exportGeometry();
  const showApp = (id) => !face.apps || face.apps.has(id);
  const boxesLv = (api.cab.boxes || []).filter((b) => b.lv === api.level.id && (!face.boxes || face.boxes.has(b.id)));
  const gaines = [];
  if (boxesLv.length && (api.cab.circuits || []).length) {
    let W = null; try { W = wiringNow(api); } catch { W = null; }
    for (const b of W ? W.boxes : []) {
      const src = boxesLv.find((x) => x.id === b.id); if (!src) continue;
      for (const g of b.gaines) {
        const keys = g.kind === "alim" ? (g.id === "alim:0" ? ["tab"] : []) : gaineKeys(g);
        if (!keys.length) continue;
        gaines.push({ box: src.id, apps: keys, sol: !!g.sol, route: (src.routes || {})[keys[0]] || [], no: String(g.no || "").split(".").pop() });
      }
    }
  }
  const direct = face.direct ? (geo.direct || []).map((d) => ({ app: d.appId, label: d.label || "" })) : [];
  const keep = new Set([...gaines.flatMap((g) => g.apps), ...direct.map((d) => d.app)]);
  const apps = P.apps.filter((a) => showApp(a.id) || keep.has(a.id) || a.t === "TAB").map((a) => ({ id: a.id, t: a.t, x: a.x, y: a.y, h: Number.isFinite(a.h) ? a.h : null, seg: a.seg, rep: a.rep }));
  // une gaine dont l'appareil (ou le tableau) n'est pas sur ce niveau n'est pas dessinable : elle n'est pas mise dans le QR
  const here = new Set(apps.map((a) => a.id)), hasTab = apps.some((a) => a.t === "TAB");
  const drawable = gaines.filter((g) => g.apps.length && (g.apps[0] === "tab" ? hasTab : here.has(g.apps[0])));
  gaines.length = 0; gaines.push(...drawable);
  return { data: P.data, rooms: P.rooms, apps, boxes: boxesLv.map((b) => ({ id: b.id, n: b.n, x: b.x, y: b.y })), gaines, direct, H: P.H, date: today(), level: api.level.name || "",
    face: face.page ? { i: face.page, n: face.pages || 1, label: face.label || "" } : null, plan: fingerprint((api.ch && api.ch.id) || ""), stamp: face.stamp || "" };
}

export async function faceUrl(api, face) { return planUrl(faceData(api, face)); }
