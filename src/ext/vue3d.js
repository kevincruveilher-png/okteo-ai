// 3D-1 : onglet « 3D » : maquette du niveau ouvert, construite depuis le dessin (murs, ouvertures, pièces, appareils,
// boîtes). three.js (licence MIT) n'est chargé qu'à la première ouverture de l'onglet. Rien n'est modifié dans le
// dessin depuis cette page : un appareil touché en 3D se montre sur le plan (« Voir sur le plan »).
// 3D-2 : les défauts de géométrie trouvés en construisant la maquette (cleanPlan) sont listés, cliquables vers le plan.
import { cleanPlan, devicesOf, planBounds, H3D, heightsFrom, gainePath, nearestWall } from "../3d/plan3d.js";
import { wiringNow, setGaineSol, gaineKeys } from "./cablage-data.js";
import { boxColor } from "../print/ftz-symbols.js";
import { getPrefs } from "../prefs.js";
import { createWalk } from "./vue3d-walk.js";
import { wallElevation, roomFaces, elevationSVG } from "../3d/elevation.js";
import { downloadBlob } from "./dossier.js";
import { esc } from "./util.js";

const fr = (v, d = 2) => Number(v).toFixed(d).replace(".", ",");

// données du niveau ouvert, lues par l'interface publique (jamais modifiées)
export function planData(api) {
  const st = api.state, geo = api.exportGeometry();
  const wallEp = st.wallEp > 0 ? st.wallEp : 0.2, H = heightsFrom(getPrefs());
  // 3D-3 : hauteur sous plafond d'une pièce (Propriétés, cm) → hauteur des murs de son contour (la plus haute l'emporte)
  const top = new Map();
  for (const r of st.rooms) if (r.hsp > 0 && Array.isArray(r.cycle)) for (const c of r.cycle) top.set(c.seg, Math.max(top.get(c.seg) || 0, r.hsp / 100));
  const cm = (v) => (Number.isFinite(+v) && +v > 0 ? +v / 100 : undefined);
  const data = {
    nodes: st.nodes.map((n) => ({ id: n.id, x: n.x, y: n.y })),
    segs: st.segs.map((s) => ({ id: s.id, a: s.a, b: s.b, ep: s.ep > 0 ? s.ep : wallEp, mat: s.mat || null, virt: !!s.virt, top: top.get(s.id) || null })),
    openings: st.openings.map((o) => ({ id: o.id, seg: o.seg, t: o.t, w: o.w, kind: o.kind, hinge: o.hinge, swing: o.swing, allege: cm(o.allege), linteau: cm(o.linteau) })),
  };
  const hspOf = new Map(st.rooms.filter((r) => r.hsp > 0).map((r) => [r.id, r.hsp / 100]));
  const inPoly = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i].y > y) !== (P[j].y > y) && x < (P[j].x - P[i].x) * (y - P[i].y) / (P[j].y - P[i].y) + P[i].x) c = !c; return c; };
  const info = new Map((geo.apps || []).map((a) => [a.id, a]));
  const apps = st.app.filter((a) => info.has(a.id)).map((a) => {
    const g = info.get(a.id);
    const room = (geo.rooms || []).find((r) => hspOf.has(r.id) && r.poly && inPoly(a.x, a.y, r.poly));
    return { hsp: room ? hspOf.get(room.id) : null, id: a.id, t: a.t, x: a.x, y: a.y, h: Number.isFinite(a.h) ? a.h : null, hDef: Number.isFinite(g.hDef) ? g.hDef : null, seg: a.seg || null, rep: g.rep || "", name: g.name || a.t, room: g.room || null, color: g.color || null, circuit: g.circuit || null };
  });
  const cyc = new Map(st.rooms.map((r) => [r.id, r.cycle || null]));
  const rooms = (geo.rooms || []).map((r) => ({ id: r.id, name: r.name, poly: r.poly, area: r.area, label: r.label, hsp: hspOf.get(r.id) || null, cycle: cyc.get(r.id) }));
  // boîtes au-dessus du plus haut plafond
  H.combles = Math.max(H.plafond, ...[...top.values()]) + 0.35;
  const boxes = (geo.boxes || []).map((b) => ({ id: b.id, n: b.n, x: b.x, y: b.y, color: boxColor(b.n) }));
  return { data, apps, rooms, boxes, level: geo.level, H, volumes: geo.volumes || [], sanis: geo.sanis || [] };
}

export function mountVue3d(el, { api }) {
  el.classList.add("v3d");
  el.innerHTML = `<div class="v3d-stage"><canvas class="v3d-cv" tabindex="0" aria-label="Maquette 3D du niveau : glisser pour tourner, molette pour zoomer, clic droit pour déplacer, clic sur un appareil pour ses détails"></canvas>
    <div class="v3d-msg" hidden></div>
    <section class="v3d-pan" aria-label="Commandes de la vue 3D">
      <div class="v3d-head"><b>Vue 3D</b><span class="v3d-lv"></span></div>
      <div class="v3d-views" role="group" aria-label="Points de vue">
        <button type="button" data-v="iso" aria-pressed="true" title="Vue d'ensemble, de biais">Ensemble</button>
        <button type="button" data-v="top" aria-pressed="false" title="Vue de dessus, comme le plan">Dessus</button>
      </div>
      <div class="v3d-views v3d-lvs" role="group" aria-label="Niveaux affichés" hidden>
        <button type="button" data-lvm="ouvert" aria-pressed="true" title="Seulement le niveau ouvert (celui qu'on modifie)">Niveau ouvert</button>
        <button type="button" data-lvm="tous" aria-pressed="false" title="Tous les niveaux empilés (hauteurs + dalle de 25 cm) ; liaisons entre niveaux en pointillés. Seul le niveau ouvert se touche et se modifie.">Tous les niveaux</button>
      </div>
      <label class="v3d-row" title="Baisser la coupe pour voir dans les pièces (maison de poupée)">Coupe <input type="range" class="v3d-cut" min="0.9" max="${H3D.plafond}" step="0.05" value="${H3D.plafond}"><span class="v3d-cutv">${fr(H3D.plafond)} m</span></label>
      <div class="v3d-lay">
        <label title="Façades pierre, cloisons gris bleuté, plinthes : on distingue mieux les murs de l'intérieur"><input type="checkbox" data-l="contrast" checked> Murs contrastés</label>
        <label><input type="checkbox" data-l="devices" checked> Appareils à leur hauteur</label>
        <label><input type="checkbox" data-l="boxes" checked> Boîtes de la pieuvre</label>
        <label title="Gaines de la pieuvre : tracé du plan en traits droits au-dessus du plafond (ou par le sol), descente dans le mur"><input type="checkbox" data-l="gaines" checked> Gaines</label>
        <label title="Volumes 1 et 2 autour de la baignoire ou de la douche (sanitaires posés sur le plan) : prises, commandes et chauffage interdits dedans"><input type="checkbox" data-l="vol" checked> Volumes de la salle de bain</label>
        <label title="Un double plus clair de chaque gaine se voit à travers les murs : on suit la descente jusqu'à l'appareil"><input type="checkbox" data-l="xray" checked> Gaines visibles à travers les murs</label>
      </div>
      <p class="v3d-note"></p>
      <button type="button" class="v3d-walk" title="Marcher dans la maison comme dans un jeu (clavier et souris) et poser des appareils au viseur : ils sont ajoutés au chantier, Ctrl+Z annule">Visite à pied · ZQSD</button>
      <details class="v3d-pose" open hidden><summary></summary><ul></ul></details>
      <details class="v3d-def" hidden><summary></summary><ul></ul></details>
    </section>
    <div class="v3d-card" hidden aria-live="polite"></div>
  </div>`;
  const $ = (s) => el.querySelector(s);
  const cv = $(".v3d-cv"), msg = $(".v3d-msg"), card = $(".v3d-card");
  const S3 = { T: null, R: null, scene: null, cam: null, ctl: null, house: null, plan: null, devs: [], cut: H3D.plafond, contrast: true, levels: "ouvert", others: [], anim: null, running: false, sig: "", ready: null, lastBuild: 0 };

  // three.js chargé à la demande (premier affichage de l'onglet)
  function load() {
    if (S3.ready) return S3.ready;
    S3.ready = (async () => {
      const T = await import("three"), { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
      S3.T = T;
      const R = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
      R.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
      R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap;
      const scene = new T.Scene(), cam = new T.PerspectiveCamera(38, 1, 0.1, 400);
      const ctl = new OrbitControls(cam, cv);
      ctl.enableDamping = true; ctl.dampingFactor = 0.08; ctl.maxPolarAngle = Math.PI * 0.495; ctl.minDistance = 1.5; ctl.maxDistance = 120;
      // éclairage (intensités en unités physiques de three.js ≥ r155 : × π par rapport à l'ancien réglage)
      scene.add(new T.HemisphereLight(0xffffff, 0xb7c3d3, 0.72 * Math.PI));
      const sun = new T.DirectionalLight(0xffffff, 1.15 * Math.PI); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; scene.add(sun, sun.target);
      const fill = new T.DirectionalLight(0xdfe8ff, 0.25 * Math.PI); scene.add(fill);
      const ground = new T.Mesh(new T.PlaneGeometry(400, 400), new T.ShadowMaterial({ opacity: 0.22 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.01; ground.receiveShadow = true; scene.add(ground);
      Object.assign(S3, { R, scene, cam, ctl, sun, fill, ground });
      new ResizeObserver(size).observe(cv);
    })();
    return S3.ready;
  }
  function size() {
    if (!S3.R) return;
    const r = cv.getBoundingClientRect(); if (!r.width || !r.height) return;
    S3.R.setSize(r.width, r.height, false); S3.cam.aspect = r.width / r.height; S3.cam.updateProjectionMatrix();
  }

  // (re)construction de la maquette depuis le dessin ; la caméra ne bouge pas si le niveau est le même
  async function build(force) {
    // une seule reconstruction à la fois : une plus récente annule celle-ci au retour de chaque attente
    const gen = S3.gen = (S3.gen || 0) + 1;
    await load();
    const mod = await import("../3d/scene.js");
    if (gen !== S3.gen) return;
    const { T, scene } = S3;
    const P = planData(api);
    const sig = JSON.stringify([P.level, P.data, P.apps.map((a) => [a.id, a.x, a.y, a.h, a.color, a.rep, a.hsp]), P.boxes, P.rooms.map((r) => [r.name, r.poly, r.hsp]), P.H, S3.contrast, (api.cab.boxes || []).map((b) => [b.id, b.x, b.y, b.routes, b.sol, b.apps]), (api.cab.circuits || []).length, S3.levels, api.levels.map((l) => l.id), (P.sanis || []).map((s) => [s.id, s.solid])]);
    if (!force && sig === S3.sig && S3.house) return;
    const sameLevel = S3.level === P.level && S3.house;
    S3.sig = sig; S3.level = P.level;
    if (S3.house) { scene.remove(S3.house.group); S3.house.dispose(); S3.house = null; }
    if (S3.gaines) { scene.remove(S3.gaines.group); S3.gaines.dispose(); S3.gaines = null; }
    for (const o of S3.others || []) { scene.remove(o.house.group); o.house.dispose(); }
    S3.others = [];
    if (S3.vlinks) { scene.remove(S3.vlinks); S3.vlinks.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); S3.vlinks = null; }
    const plan = cleanPlan(P.data, undefined, P.H), devs = devicesOf(P.apps, P.data, P.H), { buildHouse, buildMarks, buildGaines } = mod;
    S3.buildMarks = buildMarks;
    // 3D-2 : pièce dont le contour sort nettement du bâtiment (contour enregistré incohérent) : pas de sol, signalée
    const B0 = planBounds(plan), out = (p) => p.x < B0.x0 - 1 || p.x > B0.x1 + 1 || p.y < B0.y0 - 1 || p.y > B0.y1 + 1;
    const rooms = P.rooms.filter((r) => {
      if (!plan.walls.length || !(r.poly || []).some(out)) return true;
      const q = r.poly.filter((p) => !out(p))[0] || r.poly[0];
      plan.defects.push({ kind: "piece", level: "warn", text: `Contour de « ${r.name || "pièce"} » hors du bâtiment : sol non dessiné en 3D`, x: q.x, y: q.y, ids: [r.id] });
      return false;
    });
    const topMax = Math.max(P.H.plafond, ...plan.walls.map((w) => w.top || 0));
    { const c = $(".v3d-cut"); c.max = String(+topMax.toFixed(2)); if (!S3.cutSet || S3.cut > topMax) { S3.cut = topMax; c.value = String(topMax); $(".v3d-cutv").textContent = fr(topMax) + " m"; } }
    const house = buildHouse(T, { plan, rooms, devices: devs, boxes: P.boxes, sanis: P.sanis }, { cut: S3.cut, contrast: S3.contrast, H: P.H });

    house.devices.visible = $('[data-l="devices"]').checked; house.boxes.visible = $('[data-l="boxes"]').checked;
    scene.add(house.group);
    // 3D-10 : autres niveaux empilés (ordre de la liste des niveaux = de bas en haut), le niveau ouvert reste à y = 0
    const L = api.levels, curI = L.findIndex((l) => l.current);
    $(".v3d-lvs").hidden = L.length < 2;
    let ground = -0.01;
    if (S3.levels === "tous" && L.length > 1 && curI >= 0) {
      const DALLE = 0.25, built = L.map((l, i) => {
        if (i === curI) return { id: l.id, name: l.name, P, plan, devs, top: topMax };
        try {
          const P2 = api.inLevel(l.id, () => planData(api)), plan2 = cleanPlan(P2.data, undefined, P2.H);
          return { id: l.id, name: l.name, P: P2, plan: plan2, devs: devicesOf(P2.apps, P2.data, P2.H), top: Math.max(P2.H.plafond, ...plan2.walls.map((w) => w.top || 0)) };
        } catch (e) { S3.lvErr = l.name + " : " + (e && e.message || e); console.warn("niveau en 3D :", e); return { id: l.id, name: l.name, P: null, plan: { walls: [] }, devs: [], top: P.H.plafond }; }
      });
      const off = [0]; for (let i = 1; i < built.length; i++) off[i] = off[i - 1] + built[i - 1].top + DALLE;
      built.forEach((b, i) => {
        b.y = off[i] - off[curI];
        if (i === curI || !b.plan.walls.length) return;
        const h2 = buildHouse(T, { plan: b.plan, rooms: b.P.rooms, devices: b.devs, boxes: [], sanis: b.P.sanis }, { cut: Infinity, contrast: S3.contrast, H: b.P.H });
        h2.group.position.y = b.y; h2.devices.visible = house.devices.visible;
        scene.add(h2.group);
        S3.others.push({ id: b.id, name: b.name, y: b.y, house: h2, devs: b.devs });
      });
      ground = Math.min(...built.map((b) => b.y)) - 0.01;
      // liaisons commande ↔ lumière entre deux niveaux : traits pointillés verticaux
      const at = new Map();
      built.forEach((b) => b.devs.forEach((d) => at.set(d.id, [d.x, d.h + b.y, d.y])));
      const lines = new T.Group(), mat = new T.LineDashedMaterial({ color: 0xe8534a, dashSize: 0.12, gapSize: 0.08, depthTest: false, transparent: true });
      const lvOf = new Map(); built.forEach((b) => b.devs.forEach((d) => lvOf.set(d.id, b.id)));
      for (const k of api.allLinks()) {
        const a = at.get(k.c), b = at.get(k.l);
        if (!a || !b || lvOf.get(k.c) === lvOf.get(k.l)) continue;
        const g = new T.BufferGeometry().setFromPoints([new T.Vector3(...a), new T.Vector3(a[0], b[1], a[2]), new T.Vector3(...b)]);
        const ln = new T.Line(g, mat); ln.computeLineDistances(); ln.renderOrder = 6; ln.userData.link = k.c + ">" + k.l; lines.add(ln);
      }
      S3.vlinks = lines; scene.add(lines);
    }
    S3.ground.position.y = ground;
    // 3D-5 : gaines de la pieuvre du niveau (calcul du câblage : mêmes n° et longueurs que sur les bandes)
    S3.gList = []; S3.gErr = null;
    try {
      const W = (api.cab.circuits || []).length && (api.cab.boxes || []).some((b) => b.lv === api.level.id) ? wiringNow(api) : null;
      const byDev = new Map(devs.map((d) => [d.id, d])), tabDev = devs.find((d) => d.t === "TAB");
      for (const b of W ? W.boxes : []) {
        const src = (api.cab.boxes || []).find((x) => x.id === b.id);
        if (!src || src.lv !== api.level.id) continue;
        const wall = nearestWall(plan, src.x, src.y), col = boxColor(src.n);
        for (const g of b.gaines) {
          const keys = gaineKeys(g), key = keys[0];
          const end = g.kind === "alim" ? (key === "tab" ? tabDev : null) : byDev.get(key);
          if (!end) continue;
          const route = (src.routes || {})[key] || [];
          const { pts, L } = gainePath({ box: src, route, end: { x: end.x, y: end.y, h: end.t === "TAB" ? Math.max(end.h, (P.H.plafond || 2.5) - 0.7) : end.h, axis: end.axis, mount: end.mount }, sol: !!g.sol, H: P.H, wall });
          S3.gList.push({ id: b.id + "|" + g.id, boxId: b.id, box: b.n, no: g.no, label: g.label, length: g.length, diam: g.diam, sol: !!g.sol, keys, pts, L3: L, color: col });
        }
      }
    } catch (e) { S3.gErr = String(e && e.message || e); console.warn("gaines 3D :", e); }
    S3.gaines = buildGaines(T, S3.gList, { xray: $('[data-l="xray"]').checked });
    S3.gaines.group.visible = $('[data-l="gaines"]').checked;
    scene.add(S3.gaines.group);
    { const keep = S3.pendingGaine || card.dataset.gaine; S3.pendingGaine = null; if (keep && !card.hidden) setTimeout(() => showGaine(keep), 0); }
    Object.assign(S3, { house, plan, devs, P, H: P.H });
    if (walk) walk.rebuilt();
    noteHeights(P.H);
    if (S3.others.length) $(".v3d-note").insertAdjacentHTML("beforeend", ` <br><b>Tous les niveaux</b> : escaliers et trémies ne sont pas dans le dessin (dalles pleines) ; seul le niveau ouvert (${esc(P.level || "")}) se touche et se modifie.`);
    S3.lastBuild = Date.now();
    $(".v3d-lv").textContent = P.level || "";
    const empty = !plan.walls.length;
    msg.hidden = !empty;
    if (empty) msg.textContent = "Pas encore de murs sur ce niveau : dessinez ou relevez les murs dans l'onglet Plan, la maquette se construit toute seule.";
    // soleil et cadrage d'après l'emprise du plan
    const B = planBounds(plan), cx = (B.x0 + B.x1) / 2, cy = (B.y0 + B.y1) / 2, R = Math.max(6, Math.hypot(B.x1 - B.x0, B.y1 - B.y0) / 2 + 2);
    S3.center = [cx, cy]; S3.radius = R;
    S3.sun.position.set(cx - R * 0.4, R * 1.3, cy + R); S3.sun.target.position.set(cx, 0, cy);
    Object.assign(S3.sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 0.5, far: R * 4 }); S3.sun.shadow.camera.updateProjectionMatrix();
    S3.fill.position.set(cx + R, R * 0.5, cy - R);
    if (!sameLevel) view("iso", true);
    renderDefects();
    refreshPose();
    if (card.dataset.id && !devs.some((d) => d.id === card.dataset.id)) showCard(null);
  }

  // hauteurs de départ affichées, avec le lien vers leur réglage
  function noteHeights(H) {
    const n = $(".v3d-note");
    n.innerHTML = `Hauteurs absentes du dessin : sous plafond ${fr(H.plafond)} m, allège ${fr(H.allege)} m, fenêtre ${fr(H.linteau)} m, porte ${fr(H.porte)} m. <button type="button" class="v3d-link" title="Paramètres → Vue 3D : changer ces hauteurs de départ">Régler…</button> Une pièce ou une ouverture se règle aussi dans Propriétés.`;
    n.querySelector(".v3d-link").onclick = () => { api.setTab("params"); setTimeout(() => document.getElementById("ps-3d")?.scrollIntoView({ block: "start" }), 150); };
  }
  // ---------- points de vue ----------
  function view(k, now) {
    el.querySelectorAll("[data-v]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === k)));
    const [cx, cy] = S3.center || [5, 4], R = S3.radius || 8;
    const p = k === "top" ? [cx, R * 2.6, cy + 0.01] : [cx - R * 0.75, R * 1.25, cy + R * 1.5], t = [cx, k === "top" ? 0 : 0.6, cy];
    if (now || matchMedia("(prefers-reduced-motion: reduce)").matches) { S3.cam.position.set(...p); S3.ctl.target.set(...t); S3.ctl.update(); return; }
    S3.anim = { t0: performance.now(), p0: S3.cam.position.clone(), q0: S3.ctl.target.clone(), p1: new S3.T.Vector3(...p), t1: new S3.T.Vector3(...t) };
  }
  el.querySelectorAll("[data-v]").forEach((b) => (b.onclick = () => view(b.dataset.v)));
  el.querySelectorAll("[data-lvm]").forEach((b) => (b.onclick = () => {
    S3.levels = b.dataset.lvm;
    el.querySelectorAll("[data-lvm]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    build(true).catch((e) => { S3.lvErr = String(e && e.stack || e); msg.hidden = false; msg.textContent = "Niveaux en 3D : " + (e && e.message || e); });
  }));
  $(".v3d-cut").oninput = (e) => { S3.cut = +e.target.value; S3.cutSet = S3.cut < +e.target.max - 1e-6; $(".v3d-cutv").textContent = fr(S3.cut) + " m"; if (S3.house) S3.house.setCut(S3.cut); };
  el.querySelectorAll("[data-l]").forEach((c) => (c.onchange = () => {
    if (c.dataset.l === "contrast") { S3.contrast = c.checked; build(true); return; }
    if (!S3.house) return;
    S3.house.devices.visible = $('[data-l="devices"]').checked; S3.house.boxes.visible = $('[data-l="boxes"]').checked;
    if (S3.gaines) { S3.gaines.group.visible = $('[data-l="gaines"]').checked; S3.gaines.setXray($('[data-l="xray"]').checked); }
    if (S3.marks) S3.marks.vols.visible = $('[data-l="vol"]').checked;
    S3.others.forEach((o) => { o.house.devices.visible = S3.house.devices.visible; });
    if (!S3.house.devices.visible) showCard(null);
  }));

  // ---------- clic sur un appareil : fiche + « Voir sur le plan » ----------
  let down = null, halo = null;
  cv.addEventListener("pointerdown", (e) => { down = [e.clientX, e.clientY]; });
  cv.addEventListener("pointerup", (e) => {
    if (walk.on || !S3.house || !down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
    const r = cv.getBoundingClientRect(), T = S3.T, ray = new T.Raycaster();
    ray.setFromCamera(new T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), S3.cam);
    const vis = S3.house.pick.filter((m) => (m.userData.dev ? S3.house.devices.visible : S3.house.boxes.visible));
    if (S3.gaines && S3.gaines.group.visible) S3.gaines.tubes.forEach((t) => vis.push(t.pick));
    const hit = ray.intersectObjects(vis, false)[0];
    if (hit && hit.object.userData.gaine) { showGaine(hit.object.userData.gaine); return; }
    // 3D-7 : rien d'autre sous la souris : un mur → son élévation (la face touchée)
    if (!hit) {
      const wh = ray.intersectObjects(S3.house.walls.children.filter((m) => m.isMesh && m.userData.wall), false)[0];
      if (wh) { showWall(wh.object.userData.wall, faceSide(wh)); return; }
    }
    showCard(hit ? (hit.object.userData.dev || null) : null, hit && hit.object.userData.box);
  });
  // 3D-5 : fiche d'une gaine : n°, appareil, longueur de la bande, tracé 3D, passage par le sol (propriété de la gaine)
  function showGaine(gid) {
    if (halo) { S3.scene.remove(halo); halo.geometry.dispose(); halo = null; }
    const g = S3.gList.find((x) => x.id === gid); if (!g) { showCard(null); return; }
    card.classList.remove("wide"); card.dataset.wall = "";
    if (S3.gaines) S3.gaines.highlight(gid); card.dataset.id = ""; card.dataset.gaine = gid;
    card.innerHTML = `<span class="k">Gaine · boîte ${esc(g.box)}</span><b class="t">${esc(g.no)}</b><p>${esc(g.label)}</p>
      <dl><dt>Longueur</dt><dd>${g.length != null ? fr(g.length) + " m" : "—"} (bande, surlongueurs comprises)</dd><dt>Tracé 3D</dt><dd>${fr(g.L3)} m</dd>${g.diam ? `<dt>Diamètre</dt><dd>Ø${esc(String(g.diam))}</dd>` : ""}<dt>Passage</dt><dd>${g.sol ? "par le sol" : "par le plafond"}</dd></dl>
      ${g.keys.length ? `<label class="v3d-sol" title="Propriété de la gaine : descente de la boîte jusqu'au sol, trajet dans la dalle, remontée jusqu'à l'appareil. Longueur recalculée ; Ctrl+Z annule."><input type="checkbox" data-sol ${g.sol ? "checked" : ""}> Passage par le sol</label>` : ""}
      <div class="acts"><button type="button" class="pri" data-a="gplan" title="Montre la boîte et la gaine sur le plan">Voir sur le plan</button><button type="button" data-a="close">Fermer</button></div>`;
    card.hidden = false;
    const so = card.querySelector("[data-sol]");
    // la case rend la main tout de suite : Ctrl+Z (ignoré dans un champ) annule ensuite le changement
    if (so) so.onchange = () => { so.blur(); S3.pendingGaine = gid; setGaineSol(api, g.boxId, g.keys, so.checked); };
  }
  function showCard(id, boxId) {
    if (halo) { S3.scene.remove(halo); halo.geometry.dispose(); halo = null; }
    card.classList.remove("wide"); card.dataset.wall = "";
    card.dataset.id = id || ""; card.dataset.gaine = "";
    if (S3.gaines) S3.gaines.highlight(null);
    if (boxId) {
      const b = S3.P.boxes.find((x) => x.id === boxId), G = S3.gList.filter((x) => x.boxId === boxId);
      card.innerHTML = `<span class="k">Boîte</span><b class="t">${esc(b.n || "")}</b><p>${G.length ? `${G.length} gaines : touchez-en une pour son tracé.` : "Pas encore de gaines calculées (circuits et boîtes : panneau Câblage)."}</p>${G.length ? `<div class="v3d-gl">${G.map((x) => `<button type="button" data-g="${esc(x.id)}" title="${esc(x.label)}">${esc(String(x.no).split(".")[1] || x.no)}</button>`).join("")}</div>` : ""}<div class="acts"><button type="button" data-a="close">Fermer</button></div>`;
      card.hidden = false;
    } else if (!id) { card.hidden = true; return; }
    else {
      const d = S3.devs.find((x) => x.id === id); if (!d) { card.hidden = true; return; }
      const T = S3.T;
      halo = new T.Mesh(new T.SphereGeometry(0.16, 24, 16), new T.MeshBasicMaterial({ color: 0xe8534a, transparent: true, opacity: 0.28, depthWrite: false }));
      halo.position.set(d.x, d.h, d.y); S3.scene.add(halo);
      card.innerHTML = `<span class="k">${esc(d.rep || d.t)}${d.circuit ? " · " + esc(String(d.circuit)) : ""}</span><b class="t">${esc(d.name)}</b>
        <dl><dt>Pièce</dt><dd>${esc(d.room || "—")}</dd><dt>Hauteur</dt><dd>${fr(d.h)} m${d.defH ? " (valeur de départ)" : ""}</dd><dt>Pose</dt><dd>${d.mount === "mur" ? "au mur" : d.mount === "plafond" ? "au plafond" : "posé"}</dd></dl>
        ${(S3.pose || []).filter((p) => p.id === id).map((p) => `<p class="v3d-bad"><b>⚠ ${esc(api.controlKinds[p.kind] || p.kind)}</b> : ${esc(p.text)}</p>`).join("")}
        <div class="acts"><button type="button" class="pri" data-a="plan" title="Sélectionne l'appareil et le montre dans l'onglet Plan">Voir sur le plan</button><button type="button" data-a="close">Fermer</button></div>`;
      card.hidden = false;
    }
  }
  // ---------- 3D-7 : élévation d'un mur ----------
  function segGeo(id) {
    const s = S3.P.data.segs.find((x) => x.id === id), n = (k) => S3.P.data.nodes.find((q) => q.id === k);
    const A = s && n(s.a), B = s && n(s.b); if (!A || !B) return null;
    const L = Math.hypot(B.x - A.x, B.y - A.y) || 1; return { A, ux: (B.x - A.x) / L, uy: (B.y - A.y) / L };
  }
  function faceSide(hit) {
    const g = segGeo(hit.object.userData.wall); if (!g) return 1;
    const nW = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : null, nx = -g.uy, ny = g.ux;
    const k = nW ? nW.x * nx + nW.z * ny : 0;
    if (Math.abs(k) > 0.5) return k > 0 ? 1 : -1;
    const c = S3.cam.position; return (c.x - g.A.x) * nx + (c.z - g.A.y) * ny >= 0 ? 1 : -1;
  }
  const elevOf = (seg, side) => wallElevation(S3.P.data, S3.P.apps, S3.P.rooms, seg, side, S3.H);
  const elevTitle = (E) => `Élévation · ${E.room || "face extérieure"} · mur de ${fr(E.W)} m`;
  function showWall(seg, side) {
    if (halo) { S3.scene.remove(halo); halo.geometry.dispose(); halo = null; }
    const E = elevOf(seg, side); if (!E) { showCard(null); return; }
    S3.elev = { seg, side, E };
    card.dataset.id = ""; card.dataset.gaine = ""; card.dataset.wall = seg;
    const room = E.room && S3.P.rooms.find((r) => r.name === E.room && r.cycle);
    card.classList.add("wide");
    card.innerHTML = `<span class="k">Élévation · ${esc(E.room || "face extérieure")}</span><b class="t">Mur de ${fr(E.W)} m · ${E.devices.length} appareil${E.devices.length > 1 ? "s" : ""}</b>
      <div class="v3d-elev">${elevationSVG(E, { px: 330 })}</div>
      <p class="sm">Cotes en cm depuis la face du mur d'angle (vue depuis ${E.room ? "la pièce" : "l'extérieur"}), hauteurs depuis le sol ; * = hauteur de départ.</p>
      <div class="acts"><button type="button" data-a="wflip" title="L'autre face du même mur">Autre face</button><button type="button" class="pri" data-a="wpdf" title="PDF A4 de cette élévation, à l'échelle">PDF de ce mur</button>${room ? `<button type="button" data-a="rpdf" title="Une élévation par mur de la pièce, vue de l'intérieur">PDF de la pièce</button>` : ""}<button type="button" data-a="wplan" title="Sélectionne le mur sur le plan">Voir sur le plan</button><button type="button" data-a="close">Fermer</button></div>`;
    card.hidden = false;
  }
  async function elevPdf(list, name) {
    const { buildElevationsPdf } = await import("./elevations-pdf.js");
    const r = await buildElevationsPdf(list, { chantier: api.ch && (api.ch.nom || ""), level: api.level && api.level.name });
    ui.lastElev = r; downloadBlob(r.blob, name);
    api.setHint(`Élévations : ${r.pages} page${r.pages > 1 ? "s" : ""} (échelle 1:${[...new Set(r.scales)].join(", 1:")}).`);
    return r;
  }
  card.onclick = (e) => {
    const a = e.target.closest("button")?.dataset.a; if (!a) return;
    if (a === "wflip" && S3.elev) { showWall(S3.elev.seg, -S3.elev.side); return; }
    if (a === "wpdf" && S3.elev) { const E = S3.elev.E; elevPdf([{ E, title: elevTitle(E) }], `elevation-${(E.room || "exterieur").replace(/\s+/g, "-")}.pdf`); return; }
    if (a === "rpdf" && S3.elev) {
      const room = S3.P.rooms.find((r) => r.name === S3.elev.E.room && r.cycle); if (!room) return;
      const list = roomFaces(S3.P.data, room).map((f) => elevOf(f.seg, f.side)).filter((E) => E && E.W > 0.3).map((E) => ({ E, title: elevTitle(E) }));
      elevPdf(list, `elevations-${room.name.replace(/\s+/g, "-")}.pdf`); return;
    }
    if (a === "wplan" && card.dataset.wall) { const id = card.dataset.wall; api.setTab("plan"); api.select([id]); api.zoomTo([id]); return; }
    if (a === "close") showCard(null);
    if (a === "plan" && card.dataset.id) { const id = card.dataset.id; api.select([id]); api.zoomTo([id]); }
    if (a === "gplan" && card.dataset.gaine) {
      const g = S3.gList.find((x) => x.id === card.dataset.gaine), B = g && (api.cab.boxes || []).find((x) => x.id === g.boxId);
      if (B) { api.setTab("plan"); api.showCircuits = true; api.boxSel = B.id; api.zoomToBox(B.x - 3, B.y - 3, B.x + 3, B.y + 3); document.dispatchEvent(new CustomEvent("okteo:box-select", { detail: { id: B.id, key: g.keys[0] || null } })); }
    }
  };
  card.addEventListener("click", (e) => { const b = e.target.closest("[data-g]"); if (b) showGaine(b.dataset.g); });

  // ---------- 3D-4 : visite à pied et pose au viseur ----------
  const walk = createWalk({ api, S3, el, cv });
  $(".v3d-walk").onclick = () => { showCard(null); if (!walk.enter()) { msg.hidden = false; msg.textContent = "La visite à pied demande des murs sur ce niveau."; } };
  document.addEventListener("okteo:tab", (e) => { if (e.detail !== "vue3d") walk.exit(); });

  // ---------- 3D-6 : contrôles de pose (compteur « à vérifier » du cœur) : anneaux rouges, volumes, liste ----------
  const POSE = ["battant", "embrasure", "hauteur", "sdb"];
  function refreshPose() {
    if (!S3.house) return;
    const lv = api.level.id, here = new Set(S3.devs.map((d) => d.id));
    S3.pose = api.control.filter((it) => POSE.includes(it.kind) && (!it.lv || it.lv === lv) && here.has(it.ids[0])).map((it) => ({ id: it.ids[0], kind: it.kind, text: it.text || "" }));
    if (S3.marks) { S3.scene.remove(S3.marks.group); S3.marks.dispose(); }
    S3.marks = S3.buildMarks(S3.T, { issues: S3.pose, devs: S3.devs, volumes: (S3.P && S3.P.volumes) || [] }, { plafond: S3.H.plafond });
    S3.marks.vols.visible = $('[data-l="vol"]').checked;
    S3.scene.add(S3.marks.group);
    const box = $(".v3d-pose"), L = S3.pose;
    box.hidden = !L.length;
    if (!L.length) return;
    const by = new Map(S3.devs.map((d) => [d.id, d]));
    box.querySelector("summary").innerHTML = `<span class="w">⚠ ${L.length}</span> pose${L.length > 1 ? "s" : ""} à revoir (porte, ouverture, hauteur, salle de bain)`;
    box.querySelector("ul").innerHTML = L.map((p, i) => { const d = by.get(p.id); return `<li><button type="button" data-p="${i}" title="${esc(p.text)}"><b>${esc((d && (d.rep || d.t)) || "")}</b> ${esc(api.controlKinds[p.kind] || p.kind)}${d && d.room ? ` · ${esc(d.room)}` : ""}</button></li>`; }).join("");
    box.querySelectorAll("[data-p]").forEach((b) => (b.onclick = () => focusDev(L[+b.dataset.p].id)));
  }
  // caméra devant l'appareil (face au mur), puis sa fiche
  function focusDev(id) {
    const d = S3.devs.find((x) => x.id === id); if (!d || walk.on) return;
    const n = d.n || [0.6, 0.8], dist = 2.4;
    S3.anim = { t0: performance.now(), p0: S3.cam.position.clone(), q0: S3.ctl.target.clone(), p1: new S3.T.Vector3(d.x + n[0] * dist, d.h + 1.1, d.y + n[1] * dist), t1: new S3.T.Vector3(d.x, d.h, d.y) };
    showCard(id);
  }
  document.addEventListener("okteo:control", () => { if (!el.hidden && S3.house) refreshPose(); });

  // ---------- 3D-2 : défauts de géométrie, cliquables vers le plan ----------
  function renderDefects() {
    const box = $(".v3d-def"), D = (S3.plan && S3.plan.defects) || [];
    box.hidden = !D.length;
    if (!D.length) return;
    const warn = D.filter((d) => d.level === "warn").length;
    box.querySelector("summary").innerHTML = `${warn ? `<span class="w">⚠ ${warn}</span> ` : ""}${D.length} point${D.length > 1 ? "s" : ""} de géométrie${warn ? " à vérifier" : " corrigé" + (D.length > 1 ? "s" : "") + " pour la 3D"}`;
    box.querySelector("ul").innerHTML = D.map((d, i) => `<li><button type="button" data-d="${i}" class="${d.level}" title="Montrer cet endroit sur le plan">${d.level === "warn" ? "⚠" : "ⓘ"} ${esc(d.text)}</button></li>`).join("");
    box.querySelectorAll("[data-d]").forEach((b) => (b.onclick = () => { const d = D[+b.dataset.d]; const ids = d.ids.filter((x) => api.state.segs.some((s) => s.id === x) || api.state.openings.some((o) => o.id === x) || api.state.rooms.some((r) => r.id === x)); if (ids.length) { api.select(ids); api.zoomTo(ids); } }));
  }

  // ---------- boucle d'affichage : seulement quand l'onglet est visible ----------
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  let prev = performance.now();
  function loop(now) {
    if (el.hidden || !S3.R) { S3.running = false; return; }
    const dt = Math.min(0.1, (now - prev) / 1000); prev = now;
    if (walk.on) walk.update(dt, now);
    else if (S3.anim) { const k = Math.min(1, (now - S3.anim.t0) / 800), e = ease(k); S3.cam.position.lerpVectors(S3.anim.p0, S3.anim.p1, e); S3.ctl.target.lerpVectors(S3.anim.q0, S3.anim.t1, e); if (k >= 1) S3.anim = null; }
    if (!walk.on) S3.ctl.update();
    if (S3.house) S3.house.boxes.children.forEach((o) => { if (o.userData.billboard) o.quaternion.copy(S3.cam.quaternion); });
    if (halo) halo.material.opacity = 0.2 + 0.1 * Math.sin(now / 260);
    if (S3.marks) S3.marks.pulse(now);
    S3.R.render(S3.scene, S3.cam);
    requestAnimationFrame(loop);
  }
  function start() { if (!S3.running && S3.R) { S3.running = true; size(); requestAnimationFrame(loop); } }

  // le dessin change (ou le niveau) pendant que l'onglet est ouvert : la maquette suit
  let timer = 0;
  const later = () => { if (el.hidden) return; clearTimeout(timer); timer = setTimeout(() => build(false).then(start), 250); };
  document.addEventListener("okteo:saved", later);
  document.addEventListener("okteo:level", later);
  document.addEventListener("okteo:cab", later);
  document.addEventListener("okteo:prefs", (e) => { if (/^h3d/.test(e.detail && e.detail.key || "")) later(); });

  const ui = {
    focusDev: (id) => focusDev(id),
    render() { build(false).then(start).catch((e) => { msg.hidden = false; msg.textContent = "La vue 3D n'a pas pu s'afficher : " + (e && e.message || e); }); },
    levels(m) { S3.levels = m; el.querySelectorAll("[data-lvm]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.lvm === m))); return build(true); },
    view, state: S3, walk, showGaine: (id) => showGaine(id), showWall: (seg, side) => showWall(seg, side), elevPdf,
  };
  ui.render();
  return ui;
}
