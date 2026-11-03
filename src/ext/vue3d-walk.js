// 3D-4 : visite à pied dans la vue 3D (ZQSD = touches physiques, donc aussi WASD en QWERTY ; flèches) et pose
// d'appareils au viseur. Chaque pose ou retrait passe par l'interface publique (api.importDevices / api.removeApps) :
// c'est un vrai appareil du chantier, visible en 2D, rattaché à son mur, annulable d'un Ctrl+Z.
import { esc } from "./util.js";

const fr = (v, d = 2) => Number(v).toFixed(d).replace(".", ",");
const EYE = 1.62, RADIUS = 0.22;
export const WALK_TOOLS = [
  { t: "PC16", n: "Prise" }, { t: "INT", n: "Interrupteur" }, { t: "RJ45", n: "RJ45" },
  { t: "LUM", n: "Point lumineux" }, { t: "APP", n: "Applique" }, { t: null, n: "Gomme" },
];
const MOVE = ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ShiftLeft", "ShiftRight"];

export function createWalk({ api, S3, el, cv }) {
  const W = { on: false, locked: false, wasLocked: false, noLock: false, yaw: 0, pitch: -0.05, p: { x: 0, y: 0 }, keys: new Set(), tool: 0, norm: true, drag: null, msg: "", msgAt: 0, aimTxt: "", last: null, solids: [] };
  // éléments de la visite (dans la page 3D)
  const ui = document.createElement("div");
  ui.className = "v3w";
  ui.hidden = true;
  ui.innerHTML = `<div class="v3w-cross"></div>
    <div class="v3w-bar"><div class="v3w-tools" role="group" aria-label="Outil à poser">${WALK_TOOLS.map((t, i) => `<button type="button" data-i="${i}" aria-pressed="${i === 0}"><kbd>${i + 1}</kbd>${esc(t.n)}</button>`).join("")}</div>
      <div class="v3w-aim" aria-live="polite"></div>
      <div class="v3w-keys"><b>ZQSD</b> ou flèches : marcher · <b>Maj</b> : courir · <b>souris</b> : regarder · <b>clic</b> : poser · <b>1–6</b> ou molette : outil · <b>H</b> : hauteurs normalisées <b class="v3w-norm">oui</b> · <b>Ctrl+Z</b> : annuler · <b>Échap</b> : pause</div></div>
    <div class="v3w-pause" hidden><div class="v3w-pcard"><span class="k">Visite en pause</span><button type="button" class="pri" data-w="go">Reprendre la visite</button><button type="button" data-w="quit">Quitter la visite</button><p>Les appareils posés sont dans le chantier (onglet Plan) ; Ctrl+Z annule la dernière pose.</p></div></div>`;
  el.querySelector(".v3d-stage").appendChild(ui);
  const $ = (s) => ui.querySelector(s), cross = $(".v3w-cross"), aimEl = $(".v3w-aim"), pause = $(".v3w-pause");
  const setTool = (i) => { W.tool = (i + WALK_TOOLS.length) % WALK_TOOLS.length; ui.querySelectorAll(".v3w-tools button").forEach((b, j) => b.setAttribute("aria-pressed", String(j === W.tool))); };
  $(".v3w-tools").onclick = (e) => { const b = e.target.closest("button"); if (b) setTool(+b.dataset.i); };
  const flash = (m) => { W.msg = m; W.msgAt = performance.now(); };

  // parois pour les collisions : murs sans les passages (portes, baies, garage) ; les fenêtres restent des murs
  function solidsOf(plan) {
    const out = [];
    for (const w of plan.walls) {
      const sg = (s0, s1) => out.push({ ax: w.A.x + w.ux * s0, ay: w.A.y + w.uy * s0, bx: w.A.x + w.ux * s1, by: w.A.y + w.uy * s1, h: w.ep / 2 });
      let s = 0;
      for (const [a, b] of (plan.openings.get(w.key) || []).filter((o) => o.y0 < 0.3).map((o) => [o.c - o.w / 2, o.c + o.w / 2]).sort((p, q) => p[0] - q[0])) { if (a > s) sg(s, a); s = Math.max(s, b); }
      if (w.L > s) sg(s, w.L);
    }
    return out;
  }
  function collide(p) {
    for (let k = 0; k < 3; k++) for (const s of W.solids) {
      const dx = s.bx - s.ax, dy = s.by - s.ay, L2 = dx * dx + dy * dy || 1e-9, t = Math.max(0, Math.min(1, ((p.x - s.ax) * dx + (p.y - s.ay) * dy) / L2));
      const cx = s.ax + dx * t, cy = s.ay + dy * t, ex = p.x - cx, ey = p.y - cy, dd = Math.hypot(ex, ey), m = s.h + RADIUS;
      if (dd < m && dd > 1e-6) { p.x = cx + ex / dd * m; p.y = cy + ey / dd * m; }
    }
  }
  // départ : au nom de la plus grande pièce, regard vers le haut du plan
  function spawn() {
    const R = (S3.P && S3.P.rooms || []).filter((r) => r.poly && r.poly.length > 2);
    const area = (P) => { let a = 0; for (let i = 0, j = P.length - 1; i < P.length; j = i++) a += (P[j].x + P[i].x) * (P[j].y - P[i].y); return Math.abs(a / 2); };
    const big = R.sort((p, q) => area(q.poly) - area(p.poly))[0];
    if (big) { const L = big.label || big.poly.reduce((s, p) => ({ x: s.x + p.x / big.poly.length, y: s.y + p.y / big.poly.length }), { x: 0, y: 0 }); return { x: L.x, y: L.y }; }
    const c = S3.center || [0, 0]; return { x: c[0], y: c[1] };
  }

  function lock() { if (W.noLock) return; try { const p = cv.requestPointerLock(); if (p && p.catch) p.catch(() => { W.noLock = true; }); } catch { W.noLock = true; } }
  function enter() {
    if (!S3.house || !S3.plan || !S3.plan.walls.length) return false;
    W.saved = { pos: S3.cam.position.clone(), tgt: S3.ctl.target.clone(), fov: S3.cam.fov, cut: S3.cut };
    W.on = true; S3.walking = true; S3.anim = null; S3.ctl.enabled = false;
    W.solids = solidsOf(S3.plan); W.p = spawn(); W.yaw = 0; W.pitch = -0.05; collide(W.p);
    const top = +el.querySelector(".v3d-cut").max; if (S3.cut < top - 1e-6) { S3.cut = top; S3.house.setCut(top); }
    S3.house.ceilings.visible = true;
    S3.cam.fov = 72; S3.cam.updateProjectionMatrix();
    el.classList.add("walking"); ui.hidden = false; pause.hidden = true;
    cv.focus(); lock();
    flash(W.noLock ? "Glissez la souris pour regarder autour de vous" : "Visite à pied : ZQSD pour marcher, clic pour poser");
    return true;
  }
  function exit() {
    if (!W.on) return;
    W.on = false; S3.walking = false; W.keys.clear(); W.drag = null;
    if (document.pointerLockElement === cv) document.exitPointerLock();
    el.classList.remove("walking"); ui.hidden = true; pause.hidden = true;
    if (W.ghost) W.ghost.visible = false;
    if (W.halo) W.halo.visible = false;
    if (S3.house) S3.house.ceilings.visible = false;
    S3.cam.fov = W.saved.fov; S3.cam.updateProjectionMatrix(); S3.cam.position.copy(W.saved.pos); S3.ctl.target.copy(W.saved.tgt); S3.ctl.enabled = true;
  }
  const showPause = () => { if (!W.on) return; W.keys.clear(); pause.hidden = false; };
  pause.onclick = (e) => { const a = e.target.closest("button")?.dataset.w; if (a === "go") { pause.hidden = true; cv.focus(); lock(); } if (a === "quit") exit(); };
  document.addEventListener("pointerlockchange", () => { W.locked = document.pointerLockElement === cv; if (W.locked) pause.hidden = true; else if (W.on && W.wasLocked) showPause(); W.wasLocked = W.locked; });
  document.addEventListener("pointerlockerror", () => { W.noLock = true; if (W.on) flash("Glissez la souris pour regarder autour de vous"); });
  const look = (dx, dy) => { W.yaw -= dx * 0.0022; W.pitch = Math.max(-1.45, Math.min(1.45, W.pitch - dy * 0.0022)); };
  cv.addEventListener("mousedown", (e) => { if (!W.on || !pause.hidden) return; if (W.locked) { if (e.button === 0) act(); return; } W.drag = { moved: 0 }; });
  window.addEventListener("mousemove", (e) => { if (!W.on) return; if (W.locked) look(e.movementX, e.movementY); else if (W.drag) { look(e.movementX, e.movementY); W.drag.moved += Math.abs(e.movementX) + Math.abs(e.movementY); } });
  window.addEventListener("mouseup", () => { if (W.on && W.drag) { if (W.drag.moved < 5) act(); W.drag = null; } });
  cv.addEventListener("wheel", (e) => { if (!W.on) return; e.preventDefault(); e.stopPropagation(); setTool(W.tool + (e.deltaY > 0 ? 1 : -1)); }, { passive: false, capture: true });
  // touches : capturées avant les raccourcis du plan (Z, S, D… y changeraient d'outil) ; Ctrl+Z passe (annuler)
  window.addEventListener("keydown", (e) => {
    if (!W.on || el.hidden) return;
    if (e.ctrlKey || e.metaKey) return;
    if (e.key === "Escape") { e.stopImmediatePropagation(); if (W.locked) { document.exitPointerLock(); showPause(); } else if (pause.hidden) showPause(); else exit(); return; }
    if (!pause.hidden) return;
    e.stopImmediatePropagation();
    if (MOVE.includes(e.code)) { W.keys.add(e.code); e.preventDefault(); return; }
    const dg = /^Digit([1-6])$/.exec(e.code); if (dg) { setTool(+dg[1] - 1); e.preventDefault(); return; }
    if (e.code === "KeyH") { W.norm = !W.norm; $(".v3w-norm").textContent = W.norm ? "oui" : "non"; flash(W.norm ? "Hauteurs normalisées (prise 0,30 m, interrupteur 1,10 m…)" : "Hauteur libre : l'appareil se pose à la hauteur visée"); }
  }, true);
  window.addEventListener("keyup", (e) => W.keys.delete(e.code));
  window.addEventListener("blur", () => W.keys.clear());

  // ---------- viseur ----------
  const wallMeshes = () => S3.house.walls.children.filter((o) => o.isMesh && o.userData.wall);
  const hNorm = (t) => { const h = api.TYPES[t] && api.TYPES[t].h; return Number.isFinite(h) ? h / 100 : null; };
  function aim() {
    const T = S3.T, ray = new T.Raycaster();
    ray.setFromCamera(new T.Vector2(0, 0), S3.cam); ray.far = 6;
    const tool = WALK_TOOLS[W.tool];
    if (!tool.t) {
      const hit = ray.intersectObjects(S3.house.pick.filter((m) => m.userData.dev), false)[0];
      return hit ? { ok: true, del: hit.object.userData.dev, p: hit.point } : { ok: false, why: "Visez un appareil pour le retirer" };
    }
    const wh = ray.intersectObjects(wallMeshes(), false).find((h) => h.face && Math.abs(h.face.normal.y) < 0.5);
    if (tool.t === "LUM") {
      const o = ray.ray.origin, d = ray.ray.direction, H = (S3.H && S3.H.plafond) || 2.5;
      if (d.y <= 0.05) return { ok: false, why: "Levez les yeux : un point lumineux se pose au plafond" };
      const t = (H - o.y) / d.y;
      if (t > 6 || (wh && wh.distance < t)) return { ok: false, why: "Visez le plafond" };
      const x = o.x + d.x * t, y = o.z + d.z * t;
      return { ok: true, t: "LUM", x, y, h: H - 0.08, hcm: null, gp: new T.Vector3(x, H - 0.08, y) };
    }
    if (!wh) return { ok: false, why: "Visez un mur (à moins de 6 m)" };
    const n = wh.face.normal, P = wh.point;
    const h = W.norm && hNorm(tool.t) != null ? hNorm(tool.t) : Math.min(2.3, Math.max(0.1, P.y));
    const probe = new T.Raycaster(new T.Vector3(P.x + n.x * 0.1, h, P.z + n.z * 0.1), new T.Vector3(-n.x, 0, -n.z), 0, 0.2);
    if (!probe.intersectObjects(wallMeshes(), false).length) return { ok: false, why: `Pas de mur à ${fr(h)} m à cet endroit (porte, fenêtre)` };
    const x = P.x + n.x * 0.008, y = P.z + n.z * 0.008;
    return { ok: true, t: tool.t, x, y, h, hcm: Math.round(h * 100), n: [n.x, n.z], gp: new T.Vector3(x, h, y) };
  }
  function ensureFx() {
    if (W.ghost) return;
    const T = S3.T, mat = new T.MeshBasicMaterial({ color: 0x3ddc97, transparent: true, opacity: 0.6, depthTest: false });
    W.gPlate = new T.Mesh(new T.BoxGeometry(0.09, 0.09, 0.02), mat); W.gPlate.position.z = 0.01;
    W.gBall = new T.Mesh(new T.SphereGeometry(0.07, 20, 14), mat);
    W.ghost = new T.Group(); W.ghost.add(W.gPlate, W.gBall); W.ghost.renderOrder = 10; S3.scene.add(W.ghost);
    W.halo = new T.Mesh(new T.SphereGeometry(0.16, 20, 14), new T.MeshBasicMaterial({ color: 0xe8534a, transparent: true, opacity: 0.3, depthWrite: false })); W.halo.visible = false; S3.scene.add(W.halo);
  }
  function updateAim(now) {
    ensureFx();
    const a = (W.last = aim()), tool = WALK_TOOLS[W.tool];
    W.ghost.visible = a.ok && !a.del; W.halo.visible = !!a.del;
    if (a.del) { const d = S3.devs.find((x) => x.id === a.del); if (d) W.halo.position.set(d.x, d.h, d.y); }
    if (W.ghost.visible) { W.gPlate.visible = a.t !== "LUM"; W.gBall.visible = a.t === "LUM"; W.ghost.position.copy(a.gp); if (a.n) W.ghost.lookAt(a.gp.x + a.n[0], a.gp.y, a.gp.z + a.n[1]); }
    cross.classList.toggle("ok", a.ok);
    const fresh = now - W.msgAt < 2600, rep = (id) => { const d = S3.devs.find((x) => x.id === id); return d ? `${d.rep || d.t} (${d.name.toLowerCase()})` : "l'appareil"; };
    const txt = fresh ? W.msg : a.del ? `Gomme · clic pour retirer ${rep(a.del)}` : a.ok ? `${tool.n} · clic pour poser à ${fr(a.h)} m` : `${tool.n} · ${a.why}`;
    if (txt !== W.aimTxt) { aimEl.textContent = txt; W.aimTxt = txt; aimEl.classList.toggle("bad", !a.ok && !fresh); }
  }
  // pose ou retrait : un seul pas d'annulation, comme dans le plan
  function act() {
    const a = (W.last = aim());
    if (!a.ok) { flash(a.why); return null; }
    if (a.del) { const d = S3.devs.find((x) => x.id === a.del), r = d ? d.rep || d.t : "Appareil"; api.removeApps([a.del]); flash(`${r} retiré (Ctrl+Z pour annuler)`); return { removed: a.del }; }
    const res = api.importDevices([{ t: a.t, x: a.x, y: a.y, ...(a.hcm ? { h: a.hcm } : {}) }], [], { stay: true });
    const id = res && res.ids && res.ids[0];
    const placed = id && api.state.app.find((x) => x.id === id);
    flash(placed ? `Posé : ${WALK_TOOLS[W.tool].n.toLowerCase()} à ${fr(a.h)} m${placed.seg ? ", rattaché à son mur" : ""} (Ctrl+Z pour annuler)` : "Pose impossible ici");
    return { added: id };
  }

  function update(dt, now) {
    const K = W.keys;
    let f = (K.has("KeyW") || K.has("ArrowUp") ? 1 : 0) - (K.has("KeyS") || K.has("ArrowDown") ? 1 : 0);
    let s = (K.has("KeyD") || K.has("ArrowRight") ? 1 : 0) - (K.has("KeyA") || K.has("ArrowLeft") ? 1 : 0);
    if (f || s) {
      const L = Math.hypot(f, s), sp = (K.has("ShiftLeft") || K.has("ShiftRight") ? 3.2 : 1.5) * dt, sy = Math.sin(W.yaw), cy = Math.cos(W.yaw);
      f /= L; s /= L;
      W.p.x += (-sy * f + cy * s) * sp; W.p.y += (-cy * f - sy * s) * sp; collide(W.p);
    }
    S3.cam.position.set(W.p.x, EYE, W.p.y); S3.cam.rotation.set(W.pitch, W.yaw, 0, "YXZ");
    if (S3.house) updateAim(now);
  }
  // après une reconstruction de la maquette (pose, retrait, Ctrl+Z) : plafonds et parois de la nouvelle maquette
  function rebuilt() { if (!W.on || !S3.house) return; S3.house.ceilings.visible = true; W.solids = solidsOf(S3.plan); }
  return { state: W, enter, exit, update, rebuilt, act, setTool, get on() { return W.on; } };
}
