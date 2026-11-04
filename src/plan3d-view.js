// 3D-8 : page téléphone « plan3d.html » : la maquette 3D de ce qui est imprimé sur une face du plan (boîtes et gaines,
// ou lignes directes), ouverte en scannant le QR code de la face. Les données sont dans l'adresse (#p=…, compressées) :
// rien n'est chargé d'un serveur, rien n'est envoyé ; aucun nom de client ni de chantier.
// Doigt : tourner ; deux doigts : zoomer et déplacer ; toucher un appareil, une boîte ou une gaine : sa fiche.
// « Visite » : manette en bas à gauche pour marcher, glisser ailleurs pour regarder ; on ne traverse pas les murs.
// Compléments : recherche d'un n° de gaine (LI01.04), d'un repère (P12) ou d'une boîte ; « Plan 2D » (vue de dessus sans
// perspective) ; face n/N et rappel que l'autre face a son QR ; alerte si une autre impression du même chantier a déjà été
// scannée (empreinte du chantier + moment de l'impression, mémorisés sur le téléphone) ; page gardée hors ligne.
import * as T from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { decodePlan } from "./3d/plan-code.js";
import { cleanPlan, devicesOf, planBounds, gainePath, nearestWall } from "./3d/plan3d.js";
import { buildHouse, buildGaines } from "./3d/scene.js";
import { boxColor } from "./print/ftz-symbols.js";
import { APPAREILS } from "./cablage/appareils.js";

const root = document.getElementById("p3");
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fr = (v, d = 2) => Number(v).toFixed(d).replace(".", ",");
const NAMES = { PC16: "Prise 16 A", PC20: "Prise 20 A", RJ45: "Prise RJ45", LUM: "Point lumineux", APP: "Applique", SPOT: "Spot", INT: "Interrupteur", VV: "Va-et-vient", BP: "Bouton-poussoir", VMC: "VMC", TAB: "Tableau électrique", SC: "Sortie de câble", INCONNU: "À identifier" };
const nameOf = (t) => NAMES[t] || (APPAREILS[t] && APPAREILS[t].n) || t;
const DIRECT = "#2f6fe0";

async function main() {
  const m = /[#&]p=([A-Za-z0-9_-]+)/.exec(location.hash);
  if (!m) { root.innerHTML = `<div class="err"><h1>Maquette 3D</h1><p>Scannez le QR code « Maquette 3D » d'une face du plan imprimé par Oktéo.</p></div>`; return; }
  let D;
  try { D = await decodePlan(m[1]); }
  catch (e) { root.innerHTML = `<div class="err"><h1>Maquette illisible</h1><p>Le QR code n'a pas pu être lu entièrement. Rescannez-le, ou réimprimez le plan.</p><p><small>${esc(e && e.message || "")}</small></p></div>`; return; }
  const H = D.H, plan = cleanPlan(D.data, undefined, H);
  const hsp = (a) => { const r = D.rooms.find((q) => q.hsp && q.poly.length > 2 && inPoly(a.x, a.y, q.poly)); return r ? r.hsp : null; };
  const devs = devicesOf(D.apps.map((a) => ({ ...a, hsp: hsp(a), name: nameOf(a.t) })), D.data, H);
  const byId = new Map(devs.map((d) => [d.id, d])), tab = devs.find((d) => d.t === "TAB");
  const boxes = D.boxes.map((b) => ({ ...b, color: boxColor(b.n) }));
  const nG = D.gaines.length, nL = D.direct.length, F = D.face;
  // impression déjà vue sur ce téléphone pour ce chantier (empreinte sans nom) : une autre = alerte
  let other = null;
  if (D.plan && D.stamp) {
    try {
      const K = "okteo.plan3d.vus", seen = JSON.parse(localStorage.getItem(K) || "{}"), prev = seen[D.plan];
      if (prev && prev.t !== D.stamp) other = prev.t;
      seen[D.plan] = { t: D.stamp, at: Date.now() }; localStorage.setItem(K, JSON.stringify(seen));
    } catch { /* pas de mémoire sur ce téléphone */ }
  }
  const when = (t) => t ? t.slice(8, 10) + "/" + t.slice(5, 7) + "/" + t.slice(0, 4) + " à " + t.slice(11, 16).replace(":", " h ") : "";
  document.title = `Maquette 3D${D.level ? " — " + D.level : ""}`;
  root.innerHTML = `<canvas class="cv" aria-label="Maquette 3D : un doigt pour tourner, deux pour zoomer, toucher un élément pour sa fiche"></canvas>
    <header class="top"><span class="mark">O</span><div class="ttl"><b>Maquette 3D${D.level ? " · " + esc(D.level) : ""}</b><small>${boxes.length ? `${boxes.length} boîte${boxes.length > 1 ? "s" : ""}, ${nG} gaine${nG > 1 ? "s" : ""}` : ""}${boxes.length && nL ? " · " : ""}${nL ? `${nL} ligne${nL > 1 ? "s" : ""} directe${nL > 1 ? "s" : ""}` : ""}${D.date ? ` · plan du ${esc(D.date.split("-").reverse().join("/"))}` : ""}</small>${F && F.n > 1 ? `<small class="face">Face ${F.i}/${F.n}${F.label ? " · " + esc(F.label) : ""} — l'autre face du plan a son propre QR code</small>` : ""}</div><button type="button" data-a="lay" aria-expanded="false" title="Calques">☰</button></header>
    ${other ? `<p class="warn" role="alert">⚠ Ce téléphone a déjà ouvert une autre impression de ce plan (${esc(when(other))}). Celle-ci date du ${esc(when(D.stamp))} : vérifiez que les feuilles viennent de la même impression. <button type="button" data-a="okwarn">Compris</button></p>` : ""}
    <div class="lay" hidden>
      <label><input type="checkbox" data-l="gaines" checked> Gaines</label>
      <label><input type="checkbox" data-l="xray" checked> Gaines à travers les murs</label>
      <label><input type="checkbox" data-l="direct" checked> Lignes directes</label>
      <label><input type="checkbox" data-l="devices" checked> Appareils</label>
      <label><input type="checkbox" data-l="boxes" checked> Boîtes</label>
      <form class="find" role="search"><input type="search" enterkeyhint="search" placeholder="LI01.04, P12, LI02…" aria-label="Chercher une gaine, un repère ou une boîte"><button type="submit">Chercher</button></form>
      <p class="fmsg" hidden></p>
    </div>
    <nav class="bar" aria-label="Points de vue"><button type="button" data-v="iso" aria-pressed="true">Ensemble</button><button type="button" data-v="top" aria-pressed="false">Dessus</button><button type="button" data-v="plan" aria-pressed="false" title="Le plan à plat, vu de dessus sans perspective">Plan 2D</button><button type="button" data-v="walk" aria-pressed="false">Visite</button></nav>
    <div class="joy" hidden><i></i></div><p class="hint" hidden>Manette : marcher · glisser ailleurs : regarder</p>
    <div class="card" hidden aria-live="polite"></div>`;
  const $ = (s) => root.querySelector(s), cv = $(".cv"), card = $(".card");

  // ---------- scène ----------
  const R = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
  R.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
  const scene = new T.Scene(), cam3 = new T.PerspectiveCamera(42, 1, 0.05, 400), ctl3 = new OrbitControls(cam3, cv);
  ctl3.enableDamping = true; ctl3.dampingFactor = 0.08; ctl3.maxPolarAngle = Math.PI * 0.495; ctl3.minDistance = 1; ctl3.maxDistance = 120;
  // « Plan 2D » : caméra orthogonale au-dessus, sans rotation (glisser = déplacer, pincer = zoomer)
  const cam2 = new T.OrthographicCamera(-10, 10, 10, -10, 0.1, 200), ctl2 = new OrbitControls(cam2, cv);
  ctl2.enableRotate = false; ctl2.screenSpacePanning = true; ctl2.enableDamping = true; ctl2.minZoom = 0.3; ctl2.maxZoom = 12; ctl2.enabled = false;
  ctl2.touches = { ONE: T.TOUCH.PAN, TWO: T.TOUCH.DOLLY_PAN }; ctl2.mouseButtons = { LEFT: T.MOUSE.PAN, MIDDLE: T.MOUSE.DOLLY, RIGHT: T.MOUSE.PAN };
  let cam = cam3, ctl = ctl3;
  scene.add(new T.HemisphereLight(0xffffff, 0xb7c3d3, 0.8 * Math.PI));
  const sun = new T.DirectionalLight(0xffffff, 1.1 * Math.PI); scene.add(sun, sun.target);
  const house = buildHouse(T, { plan, rooms: D.rooms, devices: devs, boxes }, { cut: Infinity, contrast: true, H });
  scene.add(house.group);
  const gl = [], dl = [], skip = [];
  for (const g of D.gaines) {
    const b = boxes.find((x) => x.id === g.box), key = g.apps[0], end = key === "tab" ? tab : byId.get(key);
    if (!b || !end) { skip.push({ g: g.id, box: !!b, key }); continue; }
    const { pts, L } = gainePath({ box: b, route: g.route, end: { x: end.x, y: end.y, h: end.t === "TAB" ? Math.max(end.h, H.plafond - 0.7) : end.h, axis: end.axis, mount: end.mount }, sol: g.sol, H, wall: nearestWall(plan, b.x, b.y) });
    gl.push({ id: g.id, pts, L, color: b.color, box: b.n, apps: g.apps, sol: g.sol, no: g.no ? b.n + "." + g.no : "" });
  }
  for (const [i, d] of D.direct.entries()) {
    const end = byId.get(d.app); if (!end || !tab) continue;
    const p = gainePath({ box: { x: tab.x, y: tab.y }, end: { x: end.x, y: end.y, h: end.h, axis: end.axis, mount: end.mount }, H });
    const pts = [[tab.x, Math.max(tab.h, H.plafond - 0.7), tab.y], ...p.pts];
    dl.push({ id: "d" + i, pts, L: p.L, color: DIRECT, label: d.label, app: d.app });
  }
  const gaines = buildGaines(T, gl, { xray: true }), direct = buildGaines(T, dl, { xray: true });
  scene.add(gaines.group, direct.group);

  const B = planBounds(plan), cx = (B.x0 + B.x1) / 2, cy = (B.y0 + B.y1) / 2, RAD = Math.max(6, Math.hypot(B.x1 - B.x0, B.y1 - B.y0) / 2 + 2);
  sun.position.set(cx - RAD * 0.4, RAD * 1.3, cy + RAD); sun.target.position.set(cx, 0, cy);
  const S = { skip, other, cam: cam3, mode: "iso", anim: null, walk: { p: { x: cx, y: cy }, yaw: 0, pitch: -0.05, mv: [0, 0] }, house, gl, dl, devs, plan, D };
  window.__plan3d = S;

  function size() {
    const r = cv.getBoundingClientRect(); if (!r.width) return;
    R.setSize(r.width, r.height, false); cam3.aspect = r.width / r.height; cam3.updateProjectionMatrix();
    const a = r.width / r.height, hh = Math.max(B.y1 - B.y0, (B.x1 - B.x0) / a) / 2 + 1;
    Object.assign(cam2, { left: -hh * a, right: hh * a, top: hh, bottom: -hh }); cam2.updateProjectionMatrix();
  }
  new ResizeObserver(size).observe(cv); size();

  // ---------- points de vue ----------
  function view(k, now) {
    root.querySelectorAll("[data-v]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === k)));
    if (S.mode === "walk" && k !== "walk") { house.ceilings.visible = false; ctl.enabled = true; $(".joy").hidden = true; $(".hint").hidden = true; }
    S.mode = k;
    // 2D : caméra orthogonale ; sinon la caméra en perspective
    const flat = k === "plan";
    cam = flat ? cam2 : cam3; ctl = flat ? ctl2 : ctl3; ctl2.enabled = flat; ctl3.enabled = !flat && k !== "walk"; S.cam = cam;
    if (flat) { cam2.position.set(cx, 60, cy); cam2.up.set(0, 0, -1); ctl2.target.set(cx, 0, cy); cam2.zoom = 1; cam2.updateProjectionMatrix(); ctl2.update(); S.anim = null; return; }
    if (k === "walk") return startWalk();
    const p = k === "top" ? [cx, RAD * 2.6, cy + 0.01] : [cx - RAD * 0.75, RAD * 1.25, cy + RAD * 1.5], t = [cx, k === "top" ? 0 : 0.6, cy];
    if (now) { cam3.position.set(...p); ctl3.target.set(...t); ctl3.update(); return; }
    S.anim = { t0: performance.now(), p0: cam3.position.clone(), q0: ctl3.target.clone(), p1: new T.Vector3(...p), t1: new T.Vector3(...t) };
  }
  // recherche : n° de gaine « LI01.04 » (ou « 04 » s'il n'y a qu'une boîte), repère d'appareil, nom de boîte, étiquette de ligne directe
  function find(q) {
    const t = String(q || "").trim().toUpperCase().replace(/\s+/g, ""); if (!t) return null;
    const g = gl.find((x) => x.no && (x.no.toUpperCase() === t || (boxes.length === 1 && x.no.split(".")[1] === t)));
    if (g) return { gaine: g.id, at: g.pts[g.pts.length - 1] };
    const d = devs.find((x) => String(x.rep || "").toUpperCase() === t); if (d) return { dev: d.id, at: [d.x, d.h, d.y] };
    const b = boxes.find((x) => String(x.n).toUpperCase() === t); if (b) return { box: b.id, at: [b.x, H.combles, b.y] };
    const l = dl.find((x) => String(x.label || "").toUpperCase().replace(/\s+/g, "") === t); if (l) return { gaine: l.id, at: l.pts[l.pts.length - 1] };
    return null;
  }
  function goTo(u) {
    if (S.mode === "walk") view("iso", true);
    const [x, h, y] = u.at;
    if (S.mode === "plan") { ctl2.target.set(x, 0, y); cam2.position.set(x, 60, y); cam2.zoom = 3; cam2.updateProjectionMatrix(); ctl2.update(); }
    else S.anim = { t0: performance.now(), p0: cam3.position.clone(), q0: ctl3.target.clone(), p1: new T.Vector3(x + 2.2, h + 2.4, y + 3), t1: new T.Vector3(x, h, y) };
    show(u);
  }
  $(".find").onsubmit = (e) => {
    e.preventDefault();
    const q = $(".find input").value, u = find(q), m = $(".fmsg");
    m.hidden = !!u; if (!u) m.textContent = `« ${q} » n'est pas sur cette face.`;
    if (u) { $(".lay").hidden = true; goTo(u); }
  };
  S.find = find; S.goTo = goTo;
  { const w = $('[data-a="okwarn"]'); if (w) w.onclick = () => w.parentElement.remove(); }
  root.querySelectorAll("[data-v]").forEach((b) => (b.onclick = () => view(b.dataset.v)));
  $('[data-a="lay"]').onclick = (e) => { const L = $(".lay"); L.hidden = !L.hidden; e.currentTarget.setAttribute("aria-expanded", String(!L.hidden)); };
  root.querySelectorAll("[data-l]").forEach((c) => (c.onchange = () => {
    const on = (k) => $(`[data-l="${k}"]`).checked;
    gaines.group.visible = on("gaines"); direct.group.visible = on("direct"); gaines.setXray(on("xray")); direct.setXray(on("xray"));
    house.devices.visible = on("devices"); house.boxes.visible = on("boxes");
  }));

  // ---------- visite à pied (manette tactile) ----------
  const solids = [];
  for (const w of plan.walls) {
    const sg = (s0, s1) => solids.push({ ax: w.A.x + w.ux * s0, ay: w.A.y + w.uy * s0, bx: w.A.x + w.ux * s1, by: w.A.y + w.uy * s1, h: w.ep / 2 });
    let s = 0;
    for (const [a, b] of (plan.openings.get(w.key) || []).filter((o) => o.y0 < 0.3).map((o) => [o.c - o.w / 2, o.c + o.w / 2]).sort((p, q) => p[0] - q[0])) { if (a > s) sg(s, a); s = Math.max(s, b); }
    if (w.L > s) sg(s, w.L);
  }
  const collide = (p) => { for (let k = 0; k < 3; k++) for (const s of solids) { const dx = s.bx - s.ax, dy = s.by - s.ay, L2 = dx * dx + dy * dy || 1e-9, t = Math.max(0, Math.min(1, ((p.x - s.ax) * dx + (p.y - s.ay) * dy) / L2)); const qx = s.ax + dx * t, qy = s.ay + dy * t, ex = p.x - qx, ey = p.y - qy, dd = Math.hypot(ex, ey), mm = s.h + 0.25; if (dd < mm && dd > 1e-6) { p.x = qx + ex / dd * mm; p.y = qy + ey / dd * mm; } } };
  S.collide = collide;
  function startWalk() {
    const big = D.rooms.filter((r) => r.poly.length > 2).sort((p, q) => area(q.poly) - area(p.poly))[0];
    if (big) S.walk.p = big.poly.reduce((s, p) => ({ x: s.x + p.x / big.poly.length, y: s.y + p.y / big.poly.length }), { x: 0, y: 0 });
    collide(S.walk.p); S.walk.yaw = 0; S.walk.pitch = -0.05; S.anim = null;
    ctl.enabled = false; house.ceilings.visible = true; $(".joy").hidden = false; $(".hint").hidden = false; card.hidden = true;
    setTimeout(() => { $(".hint").hidden = true; }, 4000);
  }
  const joy = $(".joy"), knob = joy.querySelector("i");
  let jp = null;
  joy.addEventListener("pointerdown", (e) => { jp = e.pointerId; joy.setPointerCapture(e.pointerId); move(e); });
  joy.addEventListener("pointermove", (e) => { if (e.pointerId === jp) move(e); });
  const stop = () => { jp = null; S.walk.mv = [0, 0]; knob.style.transform = ""; };
  joy.addEventListener("pointerup", stop); joy.addEventListener("pointercancel", stop);
  function move(e) {
    const r = joy.getBoundingClientRect(), dx = (e.clientX - r.left - r.width / 2) / (r.width / 2), dy = (e.clientY - r.top - r.height / 2) / (r.height / 2), l = Math.min(1, Math.hypot(dx, dy)) / (Math.hypot(dx, dy) || 1);
    S.walk.mv = [dx * l, dy * l]; knob.style.transform = `translate(${dx * l * 36}px, ${dy * l * 36}px)`;
  }
  let look = null;
  cv.addEventListener("pointerdown", (e) => { if (S.mode === "walk") look = { id: e.pointerId, x: e.clientX, y: e.clientY }; tap = { x: e.clientX, y: e.clientY }; });
  cv.addEventListener("pointermove", (e) => { if (!look || e.pointerId !== look.id) return; S.walk.yaw -= (e.clientX - look.x) * 0.006; S.walk.pitch = Math.max(-1.2, Math.min(1.2, S.walk.pitch - (e.clientY - look.y) * 0.006)); look.x = e.clientX; look.y = e.clientY; });
  cv.addEventListener("pointerup", () => { look = null; });

  // ---------- toucher : fiche ----------
  let tap = null, hl = null;
  cv.addEventListener("pointerup", (e) => {
    if (!tap || Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 8) return;
    const r = cv.getBoundingClientRect(), ray = new T.Raycaster();
    ray.setFromCamera(new T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), cam);
    if (S.mode === "plan") ray.params.Line = { threshold: 0.1 };
    const vis = house.pick.filter((o) => (o.userData.dev ? house.devices.visible : house.boxes.visible));
    if (gaines.group.visible) gaines.tubes.forEach((t) => vis.push(t.pick));
    if (direct.group.visible) direct.tubes.forEach((t) => vis.push(t.pick));
    const hit = ray.intersectObjects(vis, false)[0];
    show(hit ? hit.object.userData : null);
  });
  function show(u) {
    if (hl) { scene.remove(hl); hl.geometry.dispose(); hl = null; }
    gaines.highlight(null); direct.highlight(null);
    if (!u) { card.hidden = true; return; }
    let html = "";
    if (u.gaine && gl.some((g) => g.id === u.gaine)) {
      const g = gl.find((x) => x.id === u.gaine); gaines.highlight(g.id);
      const who = g.apps.map((k) => (k === "tab" ? "Tableau" : (byId.get(k) || {}).rep || nameOf((byId.get(k) || {}).t))).join(", ");
      html = `<span class="k">Gaine ${esc(g.no || "")} · boîte ${esc(g.box)}</span><b class="t">${esc(who)}</b><dl><dt>Passage</dt><dd>${g.sol ? "par le sol" : "par le plafond"}</dd><dt>Tracé 3D</dt><dd>${fr(g.L)} m</dd></dl><p>Longueur de coupe : voir la bande de la boîte.</p>`;
    } else if (u.gaine) {
      const d = dl.find((x) => x.id === u.gaine); direct.highlight(d.id); const a = byId.get(d.app) || {};
      html = `<span class="k">Ligne directe du tableau</span><b class="t">${esc(d.label || a.rep || nameOf(a.t))}</b><dl><dt>Appareil</dt><dd>${esc(nameOf(a.t))}</dd><dt>Tracé 3D</dt><dd>${fr(d.L)} m</dd></dl>`;
    } else if (u.box) {
      const b = boxes.find((x) => x.id === u.box), G = gl.filter((g) => g.box === b.n);
      html = `<span class="k">Boîte de dérivation</span><b class="t">${esc(b.n)}</b><p>${G.length} gaine${G.length > 1 ? "s" : ""} : touchez un numéro pour son tracé.</p>${G.length ? `<div class="gl">${G.map((x) => `<button type="button" data-g="${esc(x.id)}">${esc(x.no ? x.no.split(".")[1] : "·")}</button>`).join("")}</div>` : ""}`;
    } else if (u.dev) {
      const d = byId.get(u.dev); if (!d) return;
      hl = new T.Mesh(new T.SphereGeometry(0.16, 20, 14), new T.MeshBasicMaterial({ color: 0xe8534a, transparent: true, opacity: 0.3, depthWrite: false })); hl.position.set(d.x, d.h, d.y); scene.add(hl);
      html = `<span class="k">${esc(d.rep || d.t)}</span><b class="t">${esc(nameOf(d.t))}</b><dl><dt>Hauteur</dt><dd>${fr(d.h)} m${d.defH ? " (hauteur habituelle)" : ""}</dd><dt>Pose</dt><dd>${d.mount === "mur" ? "au mur" : d.mount === "plafond" ? "au plafond" : "posé"}</dd></dl>`;
    } else { card.hidden = true; return; }
    card.innerHTML = `<button type="button" class="x" aria-label="Fermer">✕</button>${html}`; card.hidden = false;
    card.querySelector(".x").onclick = () => show(null);
    card.querySelectorAll("[data-g]").forEach((b) => (b.onclick = () => show({ gaine: b.dataset.g })));
  }
  S.show = show;

  // ---------- boucle ----------
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  let prev = performance.now();
  function loop(now) {
    const dt = Math.min(0.1, (now - prev) / 1000); prev = now;
    if (S.mode === "walk") {
      const W = S.walk, sp = 1.6 * dt, f = -W.mv[1], s = W.mv[0];
      W.p.x += (-Math.sin(W.yaw) * f + Math.cos(W.yaw) * s) * sp; W.p.y += (-Math.cos(W.yaw) * f - Math.sin(W.yaw) * s) * sp; collide(W.p);
      cam3.position.set(W.p.x, 1.6, W.p.y);
      cam3.lookAt(W.p.x - Math.sin(W.yaw) * Math.cos(W.pitch), 1.6 + Math.sin(W.pitch), W.p.y - Math.cos(W.yaw) * Math.cos(W.pitch));
    } else {
      if (S.anim) { const k = Math.min(1, (now - S.anim.t0) / 700), e = ease(k); cam3.position.lerpVectors(S.anim.p0, S.anim.p1, e); ctl3.target.lerpVectors(S.anim.q0, S.anim.t1, e); if (k >= 1) S.anim = null; }
      ctl.update();
    }
    house.boxes.children.forEach((o) => { if (o.userData.billboard) o.quaternion.copy(cam.quaternion); });
    R.render(scene, cam);
    requestAnimationFrame(loop);
  }
  view("iso", true);
  requestAnimationFrame(loop);
  S.ready = true;
  // page gardée sur le téléphone : se rouvre sans réseau (fichiers de la page seulement ; les données sont dans l'adresse)
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("./plan3d-sw.js", { scope: "./plan3d" }).then(async (r) => {
    S.sw = r.scope;
    const w = (await navigator.serviceWorker.ready).active;
    const keep = [location.pathname, ...performance.getEntriesByType("resource").map((x) => x.name).filter((u) => u.startsWith(location.origin))];
    if (w) w.postMessage({ keep }); S.keep = keep.length;
  }).catch((e) => { S.swErr = String(e && e.message || e); });
}
function inPoly(x, y, P) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i].y > y) !== (P[j].y > y) && x < (P[j].x - P[i].x) * (y - P[i].y) / (P[j].y - P[i].y) + P[i].x) c = !c; return c; }
function area(P) { let a = 0; for (let i = 0, j = P.length - 1; i < P.length; j = i++) a += (P[j].x + P[i].x) * (P[j].y - P[i].y); return Math.abs(a / 2); }

main().catch((e) => { root.innerHTML = `<div class="err"><h1>Maquette indisponible</h1><p>${esc(e && e.message || e)}</p></div>`; });
