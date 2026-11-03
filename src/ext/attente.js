// v73 : page d'attente des analyses IA longues (planche 7 « Page d'attente (jeu) » de l'identité de marque).
// Plein écran bleu nuit : temps écoulé, phrase qui change toutes les 7 s, et deux jeux pour patienter :
//   « Mémoire » (répéter la séquence des bras de la pieuvre) et « Câble » (guider le câble vers les appareils).
// La page ne s'ouvre qu'après SHOW_MS (une réponse rapide ne la montre jamais) ; « Revenir au plan » ou Échap la
// masque, l'analyse continue. À la fin : « Votre plan est prêt » puis « Ouvrir le chantier ». Échec : elle se ferme.
// Tant qu'elle est visible, le clavier ne va pas au plan (aucun raccourci ne part par erreur pendant un jeu).

const SHOW_MS = 2000;
const QUIPS = [
  "L'IA suit les murs du doigt…",
  "Elle compte les prises. Deux fois.",
  "C'est le moment d'un café.",
  "Les pieuvres adorent les plans bien cotés.",
  "Elle vérifie que chaque gaine arrive quelque part.",
  "Si ça dure, c'est que le plan est costaud.",
];
const PTS = [[50, 12], [76.9, 23.1], [88, 50], [76.9, 76.9], [50, 88], [23.1, 76.9], [12, 50], [23.1, 23.1]];
const NAMES = ["haut", "haut droite", "droite", "bas droite", "bas", "bas gauche", "gauche", "haut gauche"];
const ARMS = ["M50 50 Q57.5 29.3 50 12", "M50 50 Q69.9 40.7 76.9 23.1", "M50 50 Q70.7 57.5 88 50", "M50 50 Q59.3 69.9 76.9 76.9", "M50 50 Q42.5 70.7 50 88", "M50 50 Q30.1 59.3 23.1 76.9", "M50 50 Q29.3 42.5 12 50", "M50 50 Q40.7 30.1 23.1 23.1"];
const HOUSE = `<path d="M50 41.3 L57.2 46.8 V57.7 H42.8 V46.8 Z" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="1.6" stroke-linejoin="round"/><path d="M47.8 56.67 A4.8 4.8 0 1 1 52.2 56.67 V59 H47.8 Z" fill="#E8534A"/><path d="M50 55.4 V60" fill="none" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round"/>`;
export const LOGO = `<svg class="aw-logo" viewBox="0 0 100 100" aria-hidden="true"><g fill="none" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round">${ARMS.map((d) => `<path d="${d}"/>`).join("")}</g><g fill="#FFFFFF">${PTS.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="8"/>`).join("")}</g><circle cx="50" cy="50" r="19" fill="#E8534A"/>${HOUSE}</svg>`;
const N = 16, CELL = 27;   // plateau du câble : 16 × 16 cases de 27 px
const best = { mem: 0, cab: 0 };
try { Object.assign(best, JSON.parse(localStorage.getItem("okteo.attente.v1") || "{}")); } catch { /* sans stockage */ }
const saveBest = () => { try { localStorage.setItem("okteo.attente.v1", JSON.stringify(best)); } catch { /* sans stockage */ } };

export function createAttente({ api } = {}) {
  let root = null, t0 = 0, showT = 0, tick = 0, state = "off", game = "mem", job = 0;
  const timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const clearT = () => { timers.forEach(clearTimeout); timers.length = 0; };
  const M = { mode: "idle", seq: [], pos: 0, lit: -1, score: 0 };
  const C = { mode: "idle", snake: [], dir: [1, 0], next: [1, 0], food: null, score: 0, t: 0 };

  const $ = (s) => root && root.querySelector(s);
  const chantier = () => { const c = api && api.ch; return c ? (c.nom || "") + (c.numero ? " · " + c.numero : "") : ""; };

  function build() {
    root = document.createElement("div");
    root.className = "aw"; root.hidden = true;
    root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-labelledby", "aw-title");
    root.innerHTML = `
      <div class="aw-top">
        <div class="aw-brand">${LOGO}<span class="brand-word">okt<span class="brand-e">e</span>o</span></div>
        <div class="aw-tr"><button class="aw-ghost" id="aw-back" title="Masquer cette page et revenir au plan : l'analyse continue, son résultat s'affichera sur le plan (Échap)">Revenir au plan</button><span class="aw-ch" id="aw-ch"></span></div>
      </div>
      <div class="aw-body">
        <div class="aw-wait">
          <div class="aw-tt"><h1 id="aw-title"></h1><p id="aw-sub"></p></div>
          <div class="aw-clock"><span id="aw-clock" class="num">00:00</span><span id="aw-clock-l"></span></div>
          <div class="aw-run" id="aw-run">
            <div class="aw-bar"><div class="aw-slide"></div></div>
            <div class="aw-st"><span class="aw-pulse"></span><span>Analyse en cours</span></div>
            <p id="aw-quip" aria-live="polite"></p>
          </div>
          <button class="aw-cta" id="aw-open" hidden>Ouvrir le chantier</button>
        </div>
        <div class="aw-games">
          <div class="aw-tabs" role="group" aria-label="Choix du jeu"><button class="aw-tab" data-g="mem">Mémoire</button><button class="aw-tab" data-g="cab">Câble</button></div>
          <div class="aw-game" data-g="mem">
            <div class="aw-gh"><div><div class="aw-k">En attendant</div><div class="aw-gt">Travaillons notre mémoire</div></div>
              <div class="aw-sc"><div><div class="aw-k2">Séquence</div><div class="num" id="aw-m-sc">0</div></div><div><div class="aw-k2">Record</div><div class="num" id="aw-m-best">0</div></div></div></div>
            <div class="aw-octo">
              <svg viewBox="0 0 100 100" aria-hidden="true"><g fill="none" stroke="#FFFFFF" stroke-width="4.5" stroke-linecap="round" opacity="0.85">${ARMS.map((d) => `<path d="${d}"/>`).join("")}</g><circle cx="50" cy="50" r="18" fill="#E8534A"/>${HOUSE}</svg>
              <button class="aw-hit aw-house" id="aw-start" aria-label="Lancer la partie"></button>
              ${PTS.map(([x, y], i) => `<button class="aw-hit aw-node" data-i="${i}" aria-label="Bras ${i + 1}, ${NAMES[i]}" style="left:${(x - 5.45).toFixed(2)}%;top:${(y - 5.45).toFixed(2)}%"></button>`).join("")}
            </div>
            <p class="aw-msg" id="aw-m-msg" aria-live="polite"></p>
          </div>
          <div class="aw-game" data-g="cab" hidden>
            <div class="aw-gh"><div><div class="aw-k">En attendant</div><div class="aw-gt">Tire le câble</div></div>
              <div class="aw-sc"><div><div class="aw-k2">Appareils</div><div class="num" id="aw-c-sc">0</div></div><div><div class="aw-k2">Record</div><div class="num" id="aw-c-best">0</div></div></div></div>
            <div class="aw-board" id="aw-board" role="img" aria-label="Plateau du jeu : un câble corail à guider vers les appareils"></div>
            <div class="aw-cf"><p class="aw-msg" id="aw-c-msg" aria-live="polite"></p><button class="aw-play" id="aw-play">Jouer</button></div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(root);
    $("#aw-back").onclick = hide;
    $("#aw-open").onclick = close;
    root.querySelectorAll(".aw-tab").forEach((b) => (b.onclick = () => setGame(b.dataset.g)));
    $("#aw-start").onclick = memStart;
    root.querySelectorAll(".aw-node").forEach((b) => (b.onclick = () => memPress(+b.dataset.i)));
    $("#aw-play").onclick = cabStart;
    // clavier : rien ne part vers le plan tant que la page est visible ; flèches (ou ZQSD / WASD) pour le câble
    window.addEventListener("keydown", onKey, true);
    setGame("mem"); memPaint(); cabPaint();
  }

  function onKey(e) {
    if (!root || root.hidden) return;
    e.stopPropagation();
    if (e.key === "Escape") { e.preventDefault(); return state === "done" ? close() : hide(); }
    if (game !== "cab" || C.mode !== "run") return;
    const map = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], z: [0, -1], w: [0, -1], s: [0, 1], q: [-1, 0], a: [-1, 0], d: [1, 0] };
    const d = map[e.key] || map[e.key.toLowerCase && e.key.toLowerCase()];
    if (!d) return;
    e.preventDefault();
    if (d[0] === -C.dir[0] && d[1] === -C.dir[1]) return;
    C.next = d;
  }

  function setGame(g) {
    game = g;
    if (g === "mem") { clearTimeout(C.t); if (C.mode === "run") C.mode = "idle"; cabPaint(); }
    else { clearT(); M.mode = "idle"; M.lit = -1; memPaint(); }
    root.querySelectorAll(".aw-tab").forEach((b) => { const on = b.dataset.g === g; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); });
    root.querySelectorAll(".aw-game").forEach((el) => (el.hidden = el.dataset.g !== g));
  }

  // ---- Mémoire : la séquence s'allume sur les bras, on la répète ----
  function memPaint() {
    root.querySelectorAll(".aw-node").forEach((b) => b.classList.toggle("lit", +b.dataset.i === M.lit));
    $("#aw-m-sc").textContent = M.score; $("#aw-m-best").textContent = best.mem || 0;
    $("#aw-start").setAttribute("aria-label", M.mode === "show" || M.mode === "input" ? "Recommencer la partie" : "Lancer la partie");
    $("#aw-m-msg").textContent = M.mode === "show" ? "Regardez bien…" : M.mode === "input" ? `À vous ! ${M.pos + 1} sur ${M.seq.length}` : M.mode === "over" ? "Raté ! Touchez la maison pour rejouer." : "Touchez la maison pour jouer.";
  }
  function memShow(seq) {
    clearT(); Object.assign(M, { mode: "show", lit: -1, pos: 0 }); memPaint();
    const step = Math.max(260, 480 - seq.length * 14);
    let t = 600;
    seq.forEach((i) => { later(() => { M.lit = i; memPaint(); }, t); later(() => { M.lit = -1; memPaint(); }, t + Math.round(step * 0.7)); t += step; });
    later(() => { Object.assign(M, { mode: "input", pos: 0, lit: -1 }); memPaint(); }, t + 100);
  }
  function memStart() { const r = () => Math.floor(Math.random() * 8); M.seq = [r(), r(), r()]; M.score = 0; memShow(M.seq); }
  function memPress(i) {
    if (M.mode !== "input") return;
    later(() => { M.lit = -1; memPaint(); }, 200);
    if (i !== M.seq[M.pos]) { M.mode = "over"; M.lit = i; best.mem = Math.max(best.mem || 0, M.score); saveBest(); return memPaint(); }
    M.lit = i;
    if (M.pos + 1 === M.seq.length) {
      M.score = M.seq.length; best.mem = Math.max(best.mem || 0, M.score); saveBest();
      M.seq = M.seq.concat([Math.floor(Math.random() * 8)]); M.mode = "show"; memPaint();
      later(() => memShow(M.seq), 900);
    } else { M.pos++; memPaint(); }
  }

  // ---- Câble : guider le câble vers les appareils sans toucher les bords ni lui-même ----
  function cabPaint() {
    const b = $("#aw-board");
    b.innerHTML = C.snake.map((p, i) => `<i class="aw-seg${i ? "" : " head"}" style="left:${p[0] * CELL + 1}px;top:${p[1] * CELL + 1}px"></i>`).join("") +
      (C.food ? `<i class="aw-food" style="left:${C.food[0] * CELL + 3}px;top:${C.food[1] * CELL + 3}px"></i>` : "");
    $("#aw-c-sc").textContent = C.score; $("#aw-c-best").textContent = best.cab || 0;
    $("#aw-c-msg").textContent = C.mode === "run" ? "Reliez les appareils sans toucher les bords ni votre câble." : C.mode === "over" ? `Perdu ! ${C.score} appareil${C.score > 1 ? "s" : ""} relié${C.score > 1 ? "s" : ""}.` : "Appuyez sur Jouer, puis guidez le câble avec les flèches du clavier.";
    $("#aw-play").textContent = C.mode === "idle" ? "Jouer" : "Rejouer";
  }
  function food() { let p; do p = [Math.floor(Math.random() * N), Math.floor(Math.random() * N)]; while (C.snake.some((q) => q[0] === p[0] && q[1] === p[1])); return p; }
  function cabStart() {
    clearTimeout(C.t);
    Object.assign(C, { mode: "run", snake: [[8, 8], [7, 8], [6, 8]], dir: [1, 0], next: [1, 0], score: 0 });
    C.food = food(); cabPaint();
    $("#aw-play").blur();
    C.t = setTimeout(cabTick, 170);
  }
  function cabTick() {
    if (C.mode !== "run") return;
    const d = C.next, h = C.snake[0], nh = [h[0] + d[0], h[1] + d[1]];
    const eats = !!C.food && nh[0] === C.food[0] && nh[1] === C.food[1];
    const body = eats ? C.snake : C.snake.slice(0, -1);
    if (nh[0] < 0 || nh[0] >= N || nh[1] < 0 || nh[1] >= N || body.some((p) => p[0] === nh[0] && p[1] === nh[1])) {
      C.mode = "over"; best.cab = Math.max(best.cab || 0, C.score); saveBest(); return cabPaint();
    }
    C.snake = [nh].concat(body); C.dir = d;
    if (eats) { C.score++; best.cab = Math.max(best.cab || 0, C.score); saveBest(); C.food = food(); }
    cabPaint();
    C.t = setTimeout(cabTick, Math.max(70, 170 - C.score * 4));
  }

  // ---- attente ----
  function paint() {
    if (!root) return;
    const done = state === "done", el = Math.floor(((done ? root._t1 : Date.now()) - t0) / 1000);
    $("#aw-clock").textContent = String(Math.floor(el / 60)).padStart(2, "0") + ":" + String(el % 60).padStart(2, "0");
    $("#aw-clock-l").textContent = done ? "durée de l'analyse" : "temps écoulé";
    $("#aw-title").textContent = done ? "Votre plan est prêt" : root._title;
    $("#aw-sub").textContent = done ? "Vous pouvez ouvrir le chantier." : "La durée dépend du plan : de quelques minutes à bien plus. Restez jouer, ou revenez plus tard : l'analyse continue sans vous.";
    $("#aw-quip").textContent = QUIPS[Math.floor(el / 7) % QUIPS.length];
    $("#aw-run").hidden = done; $("#aw-open").hidden = !done;
    $("#aw-back").hidden = done;
    $("#aw-ch").textContent = chantier();
  }
  function show() {
    if (!root) build();
    const was = root.hidden;
    root.hidden = false; document.body.classList.add("aw-on"); paint();
    clearInterval(tick); tick = setInterval(paint, 1000);
    if (was) setTimeout(() => (state === "done" ? $("#aw-open") : $("#aw-back")).focus(), 30);
  }
  function hide() {
    if (!root) return;
    root.hidden = true; document.body.classList.remove("aw-on");
    clearInterval(tick); clearT(); clearTimeout(C.t);
    if (M.mode !== "over") M.mode = "idle"; M.lit = -1; if (C.mode === "run") C.mode = "idle";
    memPaint(); cabPaint();
  }
  function close() { hide(); state = "off"; }

  return {
    // début d'une analyse longue ; rend un jeton à passer à finish()
    start({ title = "L'IA étudie votre plan" } = {}) {
      clearTimeout(showT);
      if (!root) build();
      root._title = title; t0 = Date.now(); state = "run"; const id = ++job;
      showT = setTimeout(() => { if (state === "run" && job === id) show(); }, SHOW_MS);
      return id;
    },
    // fin de l'analyse : ok = résultat prêt (la page passe à « Votre plan est prêt » si elle est visible)
    finish(id, ok = true) {
      if (id !== job || state !== "run") return;
      clearTimeout(showT);
      root._t1 = Date.now();
      if (!ok || root.hidden) { close(); return; }
      state = "done"; paint();
      setTimeout(() => $("#aw-open").focus(), 30);
    },
    show, hide, close,
    get visible() { return !!root && !root.hidden; },
    get state() { return state; },
    el: () => root,
  };
}
