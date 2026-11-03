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

  return {
    group: root, walls: wallG, floors: floorG, devices: devG, boxes: boxG, ceilings: ceilG, pick, M,
    setCut(h) { buildWalls(h); },
    dispose() { [wallG, floorG, devG, boxG, ceilG].forEach(disposeGroup); Object.values(M).forEach((m) => m.dispose()); },
  };
}
