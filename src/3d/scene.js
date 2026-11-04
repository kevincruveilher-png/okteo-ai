// 3D-1 : scène three.js construite depuis plan3d.js (géométrie pure). three.js est passé en paramètre (chargé à la
// demande par la page 3D) : ce module ne l'importe pas lui-même. Repère three.js : x = x du plan, y = hauteur,
// z = y du plan. Couleurs de la charte : façades pierre, cloisons gris bleuté, dessus des murs bleu nuit, plinthes.
import { H3D, wallPrisms, openingParts, PLAFOND_TYPES } from "./plan3d.js";

export const WALLC = { ext: "#D8C7AD", clo: "#CBD5E0", doublage: "#E4DCCB", plain: "#F1F3F5", plinthe: "#5A6472", cap: "#2B3F58" };
const FLOOR = ["#C9A77F", "#BF9E78", "#C4A27B", "#B8B3AA", "#9FB4B7", "#9CB6B3", "#A8A7A1"];
const WET = /bain|douche|wc|eau|sdb|buand|cellier|garage|cuisine|cellier/i;

// prisme vertical d'un quadrilatère (au sol) entre y0 et y1 : faces latérales + dessous, et dessus à part (« coupe »)
function prismGeo(T, q, y0, y1) {
  const V = [], Vt = [], cx = q.reduce((s, p) => s + p[0], 0) / 4, cz = q.reduce((s, p) => s + p[1], 0) / 4, cy = (y0 + y1) / 2;
  const tri = (arr, a, b, c) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const mx = (a[0] + b[0] + c[0]) / 3 - cx, my = (a[1] + b[1] + c[1]) / 3 - cy, mz = (a[2] + b[2] + c[2]) / 3 - cz;
    if (nx * mx + ny * my + nz * mz < 0) arr.push(...a, ...c, ...b); else arr.push(...a, ...b, ...c);
  };
  const P = (p, y) => [p[0], y, p[1]];
  for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4]; tri(V, P(a, y0), P(b, y0), P(b, y1)); tri(V, P(a, y0), P(b, y1), P(a, y1)); }
  tri(V, P(q[0], y0), P(q[2], y0), P(q[1], y0)); tri(V, P(q[0], y0), P(q[3], y0), P(q[2], y0));
  tri(Vt, P(q[0], y1), P(q[1], y1), P(q[2], y1)); tri(Vt, P(q[0], y1), P(q[2], y1), P(q[3], y1));
  const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(V, 3)); g.computeVertexNormals();
  const gt = new T.BufferGeometry(); gt.setAttribute("position", new T.Float32BufferAttribute(Vt, 3)); gt.computeVertexNormals();
  return { g, gt };
}
// couleur des sommets : type de mur, faces est-ouest plus sombres, bas assombri, plinthe (les couleurs des sommets ne
// passent pas par la gestion des couleurs de three.js : conversion sRGB → linéaire ici)
function paint(T, g, base, plinth, contrast) {
  const p = g.attributes.position, n = g.attributes.normal, col = new Float32Array(p.count * 3), c = new T.Color(), pl = new T.Color(WALLC.plinthe);
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), side = Math.abs(n.getX(i)) > Math.abs(n.getZ(i));
    if (plinth && Math.abs(n.getY(i)) < 0.5) c.copy(pl);
    else { const t = Math.min(1, Math.max(0, y / 1.4)), h = contrast ? 0.74 + 0.26 * t * t * (3 - 2 * t) : 0.9 + 0.1 * t; c.copy(base).multiplyScalar(h * (contrast && side ? 0.84 : 1)); }
    c.convertSRGBToLinear();
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new T.BufferAttribute(col, 3));
}

// étiquette (nom de pièce, boîte) : texte dessiné sur une toile, posé à plat ou face à la caméra
export function textMesh(T, text, sub, { w = 2.4, color = "rgba(4,40,74,0.85)" } = {}) {
  const c = document.createElement("canvas"); c.width = 512; c.height = 160; const g = c.getContext("2d");
  g.fillStyle = color; g.font = "600 54px Rubik, Inter, sans-serif"; g.textAlign = "center"; g.fillText(String(text).slice(0, 18), 256, 74);
  if (sub) { g.fillStyle = "rgba(4,40,74,0.55)"; g.font = "500 34px 'JetBrains Mono', monospace"; g.fillText(sub, 256, 128); }
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
  return new T.Mesh(new T.PlaneGeometry(w, w * 0.3125), new T.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
}

// ---------- la maison ----------
// data3d = { plan (cleanPlan), rooms [{id,name,poly}], devices (devicesOf), boxes [{id,n,x,y}] }
// → { group, walls (groupe des murs, reconstruit par setCut), devices (groupe), boxes (groupe), pick [meshes], setCut, dispose }
export function buildHouse(T, data3d, { cut = Infinity, contrast = true, H = H3D } = {}) {
  const root = new T.Group();
  const M = {
    wall: new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, vertexColors: true }),
    cap: new T.MeshStandardMaterial({ color: WALLC.cap, roughness: 0.7 }),
    edge: new T.LineBasicMaterial({ color: 0x04284a, transparent: true, opacity: contrast ? 0.45 : 0.22 }),
    glass: new T.MeshStandardMaterial({ color: 0xa9cbe3, roughness: 0.1, transparent: true, opacity: 0.32 }),
    leaf: new T.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.6 }),
    plate: new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 }),
    dark: new T.MeshStandardMaterial({ color: 0x222222 }),
    ceil: new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: T.DoubleSide }),
  };
  const wallG = new T.Group(), floorG = new T.Group(), devG = new T.Group(), boxG = new T.Group(), ceilG = new T.Group();
  ceilG.visible = false;   // plafonds : montrés pendant la visite à pied (3D-4)
  root.add(wallG, floorG, devG, boxG, ceilG);
  const disposeGroup = (g) => { while (g.children.length) { const o = g.children.pop(); o.traverse((x) => { if (x.geometry) x.geometry.dispose(); }); } };

  function buildWalls(cutH) {
    disposeGroup(wallG);
    const base = { ext: new T.Color(contrast ? WALLC.ext : WALLC.plain), clo: new T.Color(contrast ? WALLC.clo : WALLC.plain), doublage: new T.Color(contrast ? WALLC.doublage : WALLC.plain) };
    for (const p of wallPrisms(data3d.plan, { cut: cutH, H })) {
      const col = p.mat === "doublage" ? base.doublage : p.ext ? base.ext : base.clo;
      // plinthe : 8 cm du bas, à part
      const parts = contrast && p.y0 < 0.08 && p.y1 > 0.08 ? [[p.y0, 0.08, true], [0.08, p.y1, false]] : [[p.y0, p.y1, false]];
      for (const [y0, y1, pl] of parts) {
        const { g, gt } = prismGeo(T, p.q, y0, y1); paint(T, g, col, pl, contrast);
        const m = new T.Mesh(g, M.wall); m.castShadow = m.receiveShadow = true; m.userData.wall = p.wall;
        const c = new T.Mesh(gt, M.cap); c.receiveShadow = true;
        wallG.add(m, c, new T.LineSegments(new T.EdgesGeometry(g, 25), M.edge));
      }
    }
    for (const o of openingParts(data3d.plan, { cut: cutH })) {
      if (o.kind !== "porte" || !o.hinge) {
        if (o.kind === "porte" || o.kind === "garage") continue;   // passage (baie, garage) : ouvert
        const h = o.y1 - o.y0, gl = new T.Mesh(new T.BoxGeometry(Math.max(0.05, o.w - 0.06), Math.max(0.02, h - 0.04), 0.02), M.glass);
        gl.position.set(o.cx, o.y0 + h / 2, o.cy); gl.rotation.y = -o.ang; wallG.add(gl);
        continue;
      }
      const hh = o.y1 - 0.01; if (hh <= 0.05) continue;
      const leaf = new T.Mesh(new T.BoxGeometry(o.leafW, hh, 0.035), M.leaf); leaf.position.set(o.leafW / 2, hh / 2, 0); leaf.castShadow = true;
      const piv = new T.Group(); piv.add(leaf); piv.position.set(o.hinge[0], 0, o.hinge[1]);
      piv.rotation.y = -Math.atan2(o.leafDir[1], o.leafDir[0]);
      wallG.add(piv);
    }
  }
  buildWalls(cut);

  // sols et noms de pièces
  (data3d.rooms || []).forEach((r, i) => {
    const P = (r.poly || []).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    if (P.length < 3) return;
    const sh = new T.Shape(P.map((p) => new T.Vector2(p.x, -p.y)));
    const g = new T.ShapeGeometry(sh); g.rotateX(-Math.PI / 2);
    const col = WET.test(r.name || "") ? FLOOR[3 + (i % 4)] : FLOOR[i % 3];
    const f = new T.Mesh(g, new T.MeshStandardMaterial({ color: col, roughness: 0.95 })); f.position.y = 0.002; f.receiveShadow = true; f.userData.room = r.id;
    floorG.add(f);
    const c = new T.Mesh(g.clone(), M.ceil); c.position.y = r.hsp > 0 ? r.hsp : H.plafond; ceilG.add(c);
    let ax = 0, ay = 0; P.forEach((p) => { ax += p.x; ay += p.y; });
    const lx = r.label ? r.label.x : ax / P.length, ly = r.label ? r.label.y : ay / P.length;
    const xs = P.map((p) => p.x), ys = P.map((p) => p.y), wmin = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    const lb = textMesh(T, r.name || "", r.area ? (Math.round(r.area * 10) / 10).toString().replace(".", ",") + " m²" : "");
    lb.scale.setScalar(Math.max(0.35, Math.min(1, (wmin - 0.3) / 2.4))); lb.rotation.x = -Math.PI / 2; lb.position.set(lx, 0.01, ly);
    floorG.add(lb);
  });

  // appareils à leur hauteur
  const pick = [];
  const mat = (c, em = 0) => new T.MeshStandardMaterial({ color: c, roughness: 0.4, emissive: em ? c : 0x000000, emissiveIntensity: em });
  for (const d of data3d.devices || []) {
    const col = d.color || "#E8534A", g = new T.Group();
    if (d.mount === "plafond" || PLAFOND_TYPES.has(d.t) && d.mount !== "mur") {
      const rose = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 0.02, 24), M.plate); rose.position.y = 0.07;
      const bulb = new T.Mesh(new T.SphereGeometry(0.055, 24, 16), new T.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffd66b, emissiveIntensity: 0.9 }));
      const ring = new T.Mesh(new T.TorusGeometry(0.075, 0.012, 8, 24), mat(col, 0.3)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.07;
      g.add(rose, bulb, ring);
    } else if (d.t === "TAB") {
      const b = new T.Mesh(new T.BoxGeometry(0.45, 0.55, 0.12), mat(0xdde2e8)); b.position.z = 0.06; g.add(b);
      for (let r = 0; r < 3; r++) { const row = new T.Mesh(new T.BoxGeometry(0.36, 0.05, 0.02), mat(r === 0 ? 0xe8534a : 0x9aa7b6)); row.position.set(0, 0.16 - r * 0.15, 0.125); g.add(row); }
    } else {
      const plate = new T.Mesh(new T.BoxGeometry(0.085, 0.085, 0.014), M.plate); plate.position.z = 0.007; plate.castShadow = true; g.add(plate);
      if (/^(INT|VV|BP|CVR)$/.test(d.t)) { const k = new T.Mesh(new T.BoxGeometry(0.04, 0.06, 0.01), mat(col, 0.25)); k.position.z = 0.018; g.add(k); }
      else if (d.t === "APP") { const k = new T.Mesh(new T.BoxGeometry(0.14, 0.07, 0.07), new T.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffd66b, emissiveIntensity: 0.6 })); k.position.z = 0.05; g.add(k); }
      else {
        const face = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.008, 20), mat(d.t === "RJ45" ? 0x3a4656 : col, 0.25)); face.rotation.x = Math.PI / 2; face.position.z = 0.018; g.add(face);
        if (/^PC/.test(d.t)) for (const s of [-1, 1]) { const hole = new T.Mesh(new T.CylinderGeometry(0.004, 0.004, 0.01, 8), M.dark); hole.rotation.x = Math.PI / 2; hole.position.set(s * 0.01, 0, 0.022); g.add(hole); }
      }
    }
    g.position.set(d.x, d.h, d.y);
    if (d.n) g.lookAt(d.x + d.n[0], d.h, d.y + d.n[1]);
    g.traverse((o) => { if (o.isMesh) { o.userData.dev = d.id; pick.push(o); } });
    g.userData.dev = d.id;
    devG.add(g);
  }

  // boîtes de la pieuvre, dans les combles
  for (const b of data3d.boxes || []) {
    const m = new T.Mesh(new T.BoxGeometry(0.36, 0.2, 0.36), new T.MeshStandardMaterial({ color: b.color || "#E5484D", roughness: 0.5 }));
    m.position.set(b.x, H.combles, b.y); m.castShadow = true; m.userData.box = b.id; boxG.add(m); pick.push(m);
    const lb = textMesh(T, b.n || "Boîte", "boîte de dérivation"); lb.scale.setScalar(0.55); lb.position.set(b.x, H.combles + 0.32, b.y); lb.userData.billboard = true; boxG.add(lb);
  }

  // n° 9 : sanitaires (baignoire, receveur, WC, lavabo, vasque, évier) en volume blanc, contours gris ; pas cliquables
  const saniG = new T.Group(); saniG.name = "sanitaires";
  const saniM = new T.MeshStandardMaterial({ color: "#F4F6F8", roughness: 0.35 }), saniE = new T.LineBasicMaterial({ color: "#8A8F96" });
  // n° 10 : zone d'exclusion = bloc rouge transparent (on voit à travers, on comprend qu'il faut l'éviter)
  const zoneM = new T.MeshBasicMaterial({ color: "#E5484D", transparent: true, opacity: 0.22, depthWrite: false, side: T.DoubleSide }), zoneE = new T.LineBasicMaterial({ color: "#C0262D" });
  for (const s of data3d.sanis || []) for (const p of s.solid || []) {
    if (!p.pts || p.pts.length < 3 || !(p.z1 > p.z0)) continue;
    const sh = new T.Shape(); p.pts.forEach((q, i) => (i ? sh.lineTo(q.x, -q.y) : sh.moveTo(q.x, -q.y)));
    const z1 = p.zone ? Math.max(p.z1, H.plafond || 2.5) : p.z1;
    const g = new T.ExtrudeGeometry(sh, { depth: z1 - p.z0, bevelEnabled: false, curveSegments: 4 });
    const m = new T.Mesh(g, p.zone ? zoneM : saniM); m.rotation.x = -Math.PI / 2; m.position.y = p.z0; m.castShadow = !p.zone; m.receiveShadow = !p.zone; m.userData.sani = s.id; if (p.zone) { m.userData.zone = s.id; m.renderOrder = 5; }
    const e = new T.LineSegments(new T.EdgesGeometry(g, 30), p.zone ? zoneE : saniE); e.rotation.x = -Math.PI / 2; e.position.y = p.z0;
    saniG.add(m, e);
  }
  root.add(saniG);

  return {
    group: root, walls: wallG, floors: floorG, devices: devG, boxes: boxG, ceilings: ceilG, sanis: saniG, pick, M,
    setCut(h) { buildWalls(h); },
    dispose() { [wallG, floorG, devG, boxG, ceilG, saniG].forEach(disposeGroup); Object.values(M).forEach((m) => m.dispose()); saniM.dispose(); saniE.dispose(); zoneM.dispose(); zoneE.dispose(); },
  };
}

// 3D-5 : gaines de la pieuvre : un tube par gaine, couleur de sa boîte, et un double plus clair dessiné par-dessus les
// murs (on voit la descente dans le mur par transparence) ; un tube invisible plus gros sert au clic.
// list [{ id, pts [[x,h,y]…], color }] → { group, tubes Map id → {tube, ghost, pick}, setXray(on), highlight(id|null), dispose }
export function buildGaines(T, list, { xray = true } = {}) {
  const group = new T.Group(), tubes = new Map();
  const pickMat = new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  for (const g of list) {
    if (!g.pts || g.pts.length < 2) continue;
    const path = new T.CurvePath();
    for (let i = 1; i < g.pts.length; i++) path.add(new T.LineCurve3(new T.Vector3(...g.pts[i - 1]), new T.Vector3(...g.pts[i])));
    const seg = 16 * (g.pts.length - 1);
    const geo = new T.TubeGeometry(path, seg, 0.012, 6, false);
    const tube = new T.Mesh(geo, new T.MeshStandardMaterial({ color: g.color, roughness: 0.55, transparent: true, opacity: 0.95 }));
    const ghost = new T.Mesh(geo, new T.MeshBasicMaterial({ color: new T.Color(g.color).lerp(new T.Color("#ffffff"), 0.35), transparent: true, opacity: 0.38, depthTest: false, depthWrite: false }));
    ghost.renderOrder = 5; ghost.visible = xray;
    const pick = new T.Mesh(new T.TubeGeometry(path, seg, 0.06, 6, false), pickMat); pick.userData.gaine = g.id;
    group.add(tube, ghost, pick);
    tubes.set(g.id, { tube, ghost, pick, g });
  }
  let hl = null;
  return {
    group, tubes,
    setXray(on) { tubes.forEach((t) => { t.ghost.visible = on; }); },
    highlight(id) {
      if (hl) { group.remove(hl); hl.geometry.dispose(); hl = null; }
      tubes.forEach((t, k) => { const on = !id || k === id; t.tube.material.opacity = on ? 0.95 : 0.15; t.ghost.material.opacity = on ? 0.42 : 0.04; });
      const t = id && tubes.get(id);
      if (t) {
        const path = new T.CurvePath(); const P = t.g.pts;
        for (let i = 1; i < P.length; i++) path.add(new T.LineCurve3(new T.Vector3(...P[i - 1]), new T.Vector3(...P[i])));
        hl = new T.Mesh(new T.TubeGeometry(path, 16 * (P.length - 1), 0.028, 8, false), new T.MeshBasicMaterial({ color: 0xff5a4e, depthTest: false, transparent: true, opacity: 1 }));
        hl.renderOrder = 6; group.add(hl);
      }
    },
    dispose() { while (group.children.length) { const o = group.children.pop(); if (o.geometry) o.geometry.dispose(); } },
  };
}

// 3D-6 : contrôles de pose : anneau rouge autour de chaque appareil signalé (face au mur pour un appareil mural) et
// volumes de la salle de bain (volume 1 bleu, volume 2 plus pâle) en verre teinté.
// issues [{ id }], devs (devicesOf), volumes [{ v1, v2 : [{x,y}] | null }] → { group, halos [mesh], vols Group, dispose }
export function buildMarks(T, { issues = [], devs = [], volumes = [] }, { plafond = 2.5 } = {}) {
  const group = new T.Group(), halos = [], vols = new T.Group();
  const ring = new T.MeshBasicMaterial({ color: 0xe8342a, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false, side: T.DoubleSide });
  const byId = new Map(devs.map((d) => [d.id, d])), seen = new Set();
  for (const it of issues) {
    const d = byId.get(it.id);
    if (!d || seen.has(d.id)) continue;
    seen.add(d.id);
    const m = new T.Mesh(new T.RingGeometry(0.11, 0.15, 40), ring.clone());
    m.position.set(d.x, d.h, d.y);
    if (d.n) m.lookAt(d.x + d.n[0], d.h, d.y + d.n[1]); else m.rotation.x = -Math.PI / 2;
    m.renderOrder = 7; m.userData.pose = d.id; group.add(m); halos.push(m);
  }
  const shape = (P) => { const s = new T.Shape(); P.forEach((p, i) => (i ? s.lineTo(p.x, -p.y) : s.moveTo(p.x, -p.y))); return s; };
  const prism = (P, h, color, op) => {
    const g = new T.ExtrudeGeometry(shape(P), { depth: h, bevelEnabled: false });
    const m = new T.Mesh(g, new T.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, side: T.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.renderOrder = 4; return m;
  };
  for (const v of volumes) {
    if (v.v2 && v.v2.length > 2) vols.add(prism(v.v2, Math.min(3, plafond), 0x7fb2ff, 0.1));
    if (v.v1 && v.v1.length > 2) vols.add(prism(v.v1, Math.min(2.25, plafond), 0x2f6fe0, 0.2));
  }
  group.add(vols);
  return {
    group, halos, vols,
    pulse(now) { const k = 0.55 + 0.45 * Math.sin(now / 240); halos.forEach((m) => { m.material.opacity = k; m.scale.setScalar(1 + 0.12 * (1 - k)); }); },
    dispose() { group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); },
  };
}
