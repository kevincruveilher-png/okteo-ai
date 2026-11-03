// 3D-1 : onglet « 3D » : maquette du niveau ouvert, construite depuis le dessin (murs, ouvertures, pièces, appareils,
// boîtes). three.js (licence MIT) n'est chargé qu'à la première ouverture de l'onglet. Rien n'est modifié dans le
// dessin depuis cette page : un appareil touché en 3D se montre sur le plan (« Voir sur le plan »).
// 3D-2 : les défauts de géométrie trouvés en construisant la maquette (cleanPlan) sont listés, cliquables vers le plan.
import { cleanPlan, devicesOf, planBounds, H3D } from "../3d/plan3d.js";
import { esc } from "./util.js";

const fr = (v, d = 2) => Number(v).toFixed(d).replace(".", ",");

// données du niveau ouvert, lues par l'interface publique (jamais modifiées)
export function planData(api) {
  const st = api.state, geo = api.exportGeometry();
  const wallEp = st.wallEp > 0 ? st.wallEp : 0.2;
  const data = {
    nodes: st.nodes.map((n) => ({ id: n.id, x: n.x, y: n.y })),
    segs: st.segs.map((s) => ({ id: s.id, a: s.a, b: s.b, ep: s.ep > 0 ? s.ep : wallEp, mat: s.mat || null, virt: !!s.virt })),
    openings: st.openings.map((o) => ({ id: o.id, seg: o.seg, t: o.t, w: o.w, kind: o.kind, hinge: o.hinge, swing: o.swing })),
  };
  const info = new Map((geo.apps || []).map((a) => [a.id, a]));
  const apps = st.app.filter((a) => info.has(a.id)).map((a) => {
    const g = info.get(a.id);
    return { id: a.id, t: a.t, x: a.x, y: a.y, h: Number.isFinite(a.h) ? a.h : null, hDef: Number.isFinite(g.hDef) ? g.hDef : null, seg: a.seg || null, rep: g.rep || "", name: g.name || a.t, room: g.room || null, color: g.color || null, circuit: g.circuit || null };
  });
  const rooms = (geo.rooms || []).map((r) => ({ id: r.id, name: r.name, poly: r.poly, area: r.area, label: r.label }));
  const boxes = (geo.boxes || []).map((b) => ({ id: b.id, n: b.n, x: b.x, y: b.y }));
  return { data, apps, rooms, boxes, level: geo.level };
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
      <label class="v3d-row" title="Baisser la coupe pour voir dans les pièces (maison de poupée)">Coupe <input type="range" class="v3d-cut" min="0.9" max="${H3D.plafond}" step="0.05" value="${H3D.plafond}"><span class="v3d-cutv">${fr(H3D.plafond)} m</span></label>
      <div class="v3d-lay">
        <label title="Façades pierre, cloisons gris bleuté, plinthes : on distingue mieux les murs de l'intérieur"><input type="checkbox" data-l="contrast" checked> Murs contrastés</label>
        <label><input type="checkbox" data-l="devices" checked> Appareils à leur hauteur</label>
        <label><input type="checkbox" data-l="boxes" checked> Boîtes de la pieuvre</label>
      </div>
      <p class="v3d-note">Hauteurs absentes du dessin : valeurs de départ (sous plafond ${fr(H3D.plafond)} m, allège ${fr(H3D.allege)} m, fenêtre ${fr(H3D.linteau)} m, porte ${fr(H3D.porte)} m).</p>
      <details class="v3d-def" hidden><summary></summary><ul></ul></details>
    </section>
    <div class="v3d-card" hidden aria-live="polite"></div>
  </div>`;
  const $ = (s) => el.querySelector(s);
  const cv = $(".v3d-cv"), msg = $(".v3d-msg"), card = $(".v3d-card");
  const S3 = { T: null, R: null, scene: null, cam: null, ctl: null, house: null, plan: null, devs: [], cut: H3D.plafond, contrast: true, anim: null, running: false, sig: "", ready: null, lastBuild: 0 };

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
      Object.assign(S3, { R, scene, cam, ctl, sun, fill });
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
    await load();
    const { T, scene } = S3;
    const P = planData(api);
    const sig = JSON.stringify([P.level, P.data, P.apps.map((a) => [a.id, a.x, a.y, a.h, a.color, a.rep]), P.boxes, P.rooms.map((r) => [r.name, r.poly]), S3.contrast]);
    if (!force && sig === S3.sig && S3.house) return;
    const sameLevel = S3.level === P.level && S3.house;
    S3.sig = sig; S3.level = P.level;
    if (S3.house) { scene.remove(S3.house.group); S3.house.dispose(); S3.house = null; }
    const plan = cleanPlan(P.data), devs = devicesOf(P.apps, P.data), { buildHouse } = await import("../3d/scene.js");
    // 3D-2 : pièce dont le contour sort nettement du bâtiment (contour enregistré incohérent) : pas de sol, signalée
    const B0 = planBounds(plan), out = (p) => p.x < B0.x0 - 1 || p.x > B0.x1 + 1 || p.y < B0.y0 - 1 || p.y > B0.y1 + 1;
    const rooms = P.rooms.filter((r) => {
      if (!plan.walls.length || !(r.poly || []).some(out)) return true;
      const q = r.poly.filter((p) => !out(p))[0] || r.poly[0];
      plan.defects.push({ kind: "piece", level: "warn", text: `Contour de « ${r.name || "pièce"} » hors du bâtiment : sol non dessiné en 3D`, x: q.x, y: q.y, ids: [r.id] });
      return false;
    });
    const house = buildHouse(T, { plan, rooms, devices: devs, boxes: P.boxes }, { cut: S3.cut, contrast: S3.contrast });
    house.devices.visible = $('[data-l="devices"]').checked; house.boxes.visible = $('[data-l="boxes"]').checked;
    scene.add(house.group);
    Object.assign(S3, { house, plan, devs, P });
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
    if (card.dataset.id && !devs.some((d) => d.id === card.dataset.id)) showCard(null);
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
  $(".v3d-cut").oninput = (e) => { S3.cut = +e.target.value; $(".v3d-cutv").textContent = fr(S3.cut) + " m"; if (S3.house) S3.house.setCut(S3.cut); };
  el.querySelectorAll("[data-l]").forEach((c) => (c.onchange = () => {
    if (c.dataset.l === "contrast") { S3.contrast = c.checked; build(true); return; }
    if (!S3.house) return;
    S3.house.devices.visible = $('[data-l="devices"]').checked; S3.house.boxes.visible = $('[data-l="boxes"]').checked;
    if (!S3.house.devices.visible) showCard(null);
  }));

  // ---------- clic sur un appareil : fiche + « Voir sur le plan » ----------
  let down = null, halo = null;
  cv.addEventListener("pointerdown", (e) => { down = [e.clientX, e.clientY]; });
  cv.addEventListener("pointerup", (e) => {
    if (!S3.house || !down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
    const r = cv.getBoundingClientRect(), T = S3.T, ray = new T.Raycaster();
    ray.setFromCamera(new T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), S3.cam);
    const vis = S3.house.pick.filter((m) => (m.userData.dev ? S3.house.devices.visible : S3.house.boxes.visible));
    const hit = ray.intersectObjects(vis, false)[0];
    showCard(hit ? (hit.object.userData.dev || null) : null, hit && hit.object.userData.box);
  });
  function showCard(id, boxId) {
    if (halo) { S3.scene.remove(halo); halo.geometry.dispose(); halo = null; }
    card.dataset.id = id || "";
    if (boxId) {
      const b = S3.P.boxes.find((x) => x.id === boxId);
      card.innerHTML = `<span class="k">Boîte</span><b class="t">${esc(b.n || "")}</b><p>Boîte de dérivation, posée dans les combles pour la vue 3D (passage des gaines : mise à jour 3D-5).</p><div class="acts"><button type="button" data-a="close">Fermer</button></div>`;
      card.hidden = false;
    } else if (!id) { card.hidden = true; return; }
    else {
      const d = S3.devs.find((x) => x.id === id); if (!d) { card.hidden = true; return; }
      const T = S3.T;
      halo = new T.Mesh(new T.SphereGeometry(0.16, 24, 16), new T.MeshBasicMaterial({ color: 0xe8534a, transparent: true, opacity: 0.28, depthWrite: false }));
      halo.position.set(d.x, d.h, d.y); S3.scene.add(halo);
      card.innerHTML = `<span class="k">${esc(d.rep || d.t)}${d.circuit ? " · " + esc(String(d.circuit)) : ""}</span><b class="t">${esc(d.name)}</b>
        <dl><dt>Pièce</dt><dd>${esc(d.room || "—")}</dd><dt>Hauteur</dt><dd>${fr(d.h)} m${d.defH ? " (valeur de départ)" : ""}</dd><dt>Pose</dt><dd>${d.mount === "mur" ? "au mur" : d.mount === "plafond" ? "au plafond" : "posé"}</dd></dl>
        <div class="acts"><button type="button" class="pri" data-a="plan" title="Sélectionne l'appareil et le montre dans l'onglet Plan">Voir sur le plan</button><button type="button" data-a="close">Fermer</button></div>`;
      card.hidden = false;
    }
  }
  card.onclick = (e) => {
    const a = e.target.closest("button")?.dataset.a; if (!a) return;
    if (a === "close") showCard(null);
    if (a === "plan" && card.dataset.id) { const id = card.dataset.id; api.select([id]); api.zoomTo([id]); }
  };

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
  function loop(now) {
    if (el.hidden || !S3.R) { S3.running = false; return; }
    if (S3.anim) { const k = Math.min(1, (now - S3.anim.t0) / 800), e = ease(k); S3.cam.position.lerpVectors(S3.anim.p0, S3.anim.p1, e); S3.ctl.target.lerpVectors(S3.anim.q0, S3.anim.t1, e); if (k >= 1) S3.anim = null; }
    S3.ctl.update();
    if (S3.house) S3.house.boxes.children.forEach((o) => { if (o.userData.billboard) o.quaternion.copy(S3.cam.quaternion); });
    if (halo) halo.material.opacity = 0.2 + 0.1 * Math.sin(now / 260);
    S3.R.render(S3.scene, S3.cam);
    requestAnimationFrame(loop);
  }
  function start() { if (!S3.running && S3.R) { S3.running = true; size(); requestAnimationFrame(loop); } }

  // le dessin change (ou le niveau) pendant que l'onglet est ouvert : la maquette suit
  let timer = 0;
  const later = () => { if (el.hidden) return; clearTimeout(timer); timer = setTimeout(() => build(false).then(start), 250); };
  document.addEventListener("okteo:saved", later);
  document.addEventListener("okteo:level", later);

  const ui = {
    render() { build(false).then(start).catch((e) => { msg.hidden = false; msg.textContent = "La vue 3D n'a pas pu s'afficher : " + (e && e.message || e); }); },
    view, state: S3,
  };
  ui.render();
  return ui;
}
