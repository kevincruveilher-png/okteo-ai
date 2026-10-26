// Oktéo AI — cœur : Panneau de droite : propriétés de l'objet sélectionné, calques.
// Module issu du découpage de app.js (v26). L'état partagé est dans K (core/k.js).
import { K } from "./k.js";
import { CH, TYPES, dist, layers, node, nodeById, segById, segDir, segLen, state, uidS } from "./model.js";
import { markDirty, save, snapshot } from "./persist.js";
import { repMap } from "./view.js";
import { draw } from "./render.js";
import { reattach, removeSeg, roomArea } from "./attach.js";
import { pref } from "../prefs.js";
import { currentGroup, deleteGroup, duplicateGroup, groupCount, multi, resizeRoom, transformGroup } from "./groups.js";
import { posOnWall, wallMeasure } from "./interact.js";
import { applyCalib, applyRatio, buildTools, hintFor, setHint } from "./controls.js";

// ---------- panneau ----------
export function layerPanel() {
  const names = {
    fond: "Fond",
    pieces: "Pièces",
    murs: "Murs",
    ouvertures: "Ouvertures",
    appareils: "Appareils",
    liaisons: "Liaisons",
    cotes: "Cotes",
    boites: "Boîtes",
    gaines: "Gaines",
    grille: "Quadrillage"
  };
  return `<h3 style="margin-top:14px">Calques</h3>` + Object.keys(layers).map(k => `<div class="lay"><span>${names[k]}</span><span class="btns">
    <button data-lay="${k}" data-act="on">${layers[k].on ? "👁" : "—"}</button><button data-lay="${k}" data-act="lock">${layers[k].lock ? "🔒" : "🔓"}</button></span></div>`).join("");
}

export function wireLayers(b) {
  b.querySelectorAll("[data-lay]").forEach(btn => btn.onclick = () => {
    const k = btn.dataset.lay;
    if (btn.dataset.act === "on") layers[k].on = !layers[k].on;else layers[k].lock = !layers[k].lock;
    save();
    draw();
    showSide();
  });
}

export function showSide() {
  const b = document.getElementById("sidebody");
  if (K.sel && K.sel.kind === "segDelAsk") {
    const id = K.sel.id,
      n = K.sel.n;
    b.innerHTML = `<h3>Supprimer le mur</h3><p class="note" style="margin-top:0">Ce mur porte <b>${n} appareil${n > 1 ? "s" : ""}</b> (prises, interrupteurs…).</p>
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px"><button id="sd-all" class="danger">Supprimer le mur et ses ${n} appareil${n > 1 ? "s" : ""}</button>
      <button id="sd-keep">Supprimer le mur, garder les appareils</button><button id="sd-no">Annuler</button></div>
      <p class="note">Les appareils gardés restent à leur place, détachés : glissez-les contre un autre mur pour les raccrocher. Ctrl+Z annule.</p>`;
    b.querySelector("#sd-all").onclick = () => removeSeg(id, true);
    b.querySelector("#sd-keep").onclick = () => removeSeg(id, false);
    b.querySelector("#sd-no").onclick = () => {
      K.sel = {
        kind: "seg",
        id
      };
      draw();
      showSide();
    };
    return;
  }
  // outil Échelle, avant les deux points : on peut aussi saisir l'échelle écrite dans le cartouche (1/50…)
  if (K.tool === "calib" && !(K.sel && K.sel.kind === "calibAsk")) {
    const pw = CH.fond && CH.fond.paperW;
    b.innerHTML = `<h3>Mise à l'échelle du fond</h3>
      <p class="note" style="margin-top:0"><b>Soit</b> cliquez sur le plan les deux bouts d'une cote connue (la plus longue possible), puis tapez sa longueur.</p>
      ${pw ? `<p class="note"><b>Soit</b> tapez l'échelle écrite dans le cartouche du plan (le PDF doit être au format d'origine, ici une feuille de ${Math.round(pw * 1000)} mm de large) :</p>
      <div style="display:flex;gap:6px;align-items:center"><span>1 /</span><input id="cr-N" type="number" min="1" step="1" value="50" style="width:80px" title="Échelle du plan, ex. 50 pour 1/50"><button id="cr-ok" class="on" title="Met le fond à l'échelle 1/N">Appliquer</button></div>`
      : `<p class="note">Ce fond est une image : l'échelle ne peut se régler que sur une cote (deux points).</p>`}`;
    const ok = b.querySelector("#cr-ok");
    if (ok) {
      const go = () => { const N = +String(b.querySelector("#cr-N").value).replace(",", "."); if (N > 0) applyRatio(N); };
      ok.onclick = go;
      b.querySelector("#cr-N").onkeydown = e => { if (e.key === "Enter") go(); };
    }
    return;
  }
  if (K.sel && K.sel.kind === "calibAsk" && K.calib && K.calib.b) {
    const d = dist(K.calib.a.x, K.calib.a.y, K.calib.b.x, K.calib.b.y);
    b.innerHTML = `<h3>Mise à l'échelle du fond</h3>
      <div class="prop"><div class="field full"><label>Longueur réelle entre les deux points <span class="u">m</span></label><input id="cl-L" type="number" step="0.01" min="0.1" placeholder="ex. 13.00"></div></div>
      <div style="display:flex;gap:6px;margin-top:10px"><button id="cl-ok" class="on">Valider l'échelle</button><button id="cl-redo">Recommencer</button><button id="cl-no">Annuler</button></div>
      <p class="note">Mesure actuelle : <b class="num">${d.toFixed(3)} m</b>. Choisissez la plus grande cote lisible du plan (ex. la longueur totale de la maison) : l'erreur sera plus petite.
      Le fond est agrandi ou réduit autour du premier point ; le dessin existant ne bouge pas.</p>`;
    const inp = b.querySelector("#cl-L");
    setTimeout(() => inp.focus(), 0);
    const ok = () => {
      const L = +String(inp.value).replace(",", ".");
      if (!(L > 0)) {
        inp.focus();
        return;
      }
      applyCalib(L);
    };
    b.querySelector("#cl-ok").onclick = ok;
    inp.onkeydown = e => {
      if (e.key === "Enter") ok();
    };
    b.querySelector("#cl-redo").onclick = () => {
      K.calib = null;
      K.sel = null;
      setHint(hintFor("calib"));
      draw();
      showSide();
    };
    b.querySelector("#cl-no").onclick = () => {
      K.calib = null;
      K.sel = null;
      K.tool = "sel";
      buildTools();
      setHint(hintFor("sel"));
      draw();
      showSide();
    };
    return;
  }
  if (K.tab === "chantiers") {
    b.innerHTML = `<h3>Chantiers</h3><p class="note">Chantier ouvert : <b>${CH.nom}</b>${CH.numero ? " · " + CH.numero : ""}. Cliquez sur <b>Plan</b> pour revenir au dessin.</p>`;
    return;
  }
  if (K.tab === "params") {
    b.innerHTML = `<h3>Paramètres</h3><p class="note">Réglez ici les clés IA. Cliquez sur <b>Plan</b> pour revenir au dessin.</p>`;
    return;
  }
  if (K.tab !== "plan") {
    const T = { boites: "Boîtes : chaque boîte, ses gaines, leurs longueurs et leurs fils.", bandes: "Bandes : le schéma de chaque boîte pour le câbleur, à imprimer.", lignes: "Lignes directes : les circuits qui partent directement du tableau.", tableau: "Tableau : le coffret, ses différentiels et ses disjoncteurs. Glissez-les pour les déplacer ; les manettes coupent les circuits pour le mode essai." };
    b.innerHTML = `<h3>${K.tab}</h3><p class="note">${T[K.tab] || ""} Cliquez sur <b>Plan</b> pour revenir au dessin.</p>`;
    return;
  }
  if (K.sel && K.sel.kind === "offsetAsk") {
    b.innerHTML = `<h3>Cloison parallèle</h3>
      <div class="prop"><div class="field full"><label>Distance <span class="u">m</span></label><input id="od" type="number" step="0.01" value="0.80" autofocus></div></div>
      <div style="display:flex;gap:6px;margin-top:10px"><button id="odok" class="on">Créer</button><button id="odc">Annuler</button></div>
      <p class="note">Crée un mur parallèle à celui sélectionné, du côté où vous avez cliqué.</p>`;
    b.querySelector("#odok").onclick = () => {
      const dd = +b.querySelector("#od").value;
      const s = segById(K.sel.seg);
      if (s && dd > 0) {
        const d = segDir(s);
        const nx = -d.uy * dd * K.sel.side,
          ny = d.ux * dd * K.sel.side;
        snapshot();
        const a2 = node(d.a.x + nx, d.a.y + ny),
          b2 = node(d.b.x + nx, d.b.y + ny);
        state.segs.push({
          id: uidS(),
          a: a2.id,
          b: b2.id
        });
        markDirty();
      }
      K.sel = null;
      K.tool = "sel";
      buildTools();
      draw();
      showSide();
    };
    b.querySelector("#odc").onclick = () => {
      K.sel = null;
      draw();
      showSide();
    };
    return;
  }
  if (multi.size > 1) {
    const G = currentGroup();
    const nm = state.segs.filter(s => G.nodes.has(s.a) && G.nodes.has(s.b)).length;
    const row = (l, v) => v ? `<div class="kv"><span>${l}</span><span class="num">${v}</span></div>` : "";
    b.innerHTML = `<h3>Sélection · ${groupCount(G)} objets</h3>
      ${row("Pièces", G.rooms.size)}${row("Murs", nm)}${row("Ouvertures", G.opens.size)}${row("Appareils", G.apps.size)}${row("Cotes", G.dims.size)}
      <div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap">
        <button id="g_ccw" title="Maj+R">⟲ 90°</button><button id="g_cw" title="R">⟳ 90°</button>
        <button id="g_mx" title="X">⇋ Symétrie</button><button id="g_my" title="Y">⇵ Symétrie</button></div>
      <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><button id="g_dup">Dupliquer</button><button id="g_del" class="danger">Supprimer</button></div>
      <p class="note">Glissez n'importe quel élément de la sélection pour déplacer le groupe (Maj : reste dans l'axe). Ctrl+C / Ctrl+V pour copier-coller sous le curseur.<br>
      Cadre de sélection : de gauche à droite (bleu) = objets entièrement dedans ; de droite à gauche (vert) = objets touchés. Maj+clic pour ajouter ou retirer.</p>`;
    b.querySelector("#g_ccw").onclick = () => transformGroup("ccw");
    b.querySelector("#g_cw").onclick = () => transformGroup("cw");
    b.querySelector("#g_mx").onclick = () => transformGroup("mx");
    b.querySelector("#g_my").onclick = () => transformGroup("my");
    b.querySelector("#g_dup").onclick = duplicateGroup;
    b.querySelector("#g_del").onclick = () => deleteGroup(currentGroup());
    return;
  }
  if (K.sel && K.sel.kind === "open") {
    const o = state.openings.find(x => x.id === K.sel.id);
    const L = segLen(segById(o.seg));
    b.innerHTML = `<h3>${o.kind === "porte" ? "Porte" : "Fenêtre"}</h3>
     <div class="prop">
      <div class="field"><label>Largeur <span class="u">m</span></label><input id="ow" type="number" step="0.01" value="${o.w}"></div>
      <div class="field"><label>Position <span class="u">m</span></label><input id="ot" type="number" step="0.01" value="${o.t.toFixed(2)}"></div>
      <div class="field"><label>Type</label><select id="ok"><option value="porte"${o.kind === "porte" ? " selected" : ""}>Porte</option><option value="fenetre"${o.kind === "fenetre" ? " selected" : ""}>Fenêtre</option></select></div>
      <div class="field"><label>Gond</label><select id="oh"><option value="g"${o.hinge === "g" ? " selected" : ""}>Gauche</option><option value="d"${o.hinge === "d" ? " selected" : ""}>Droit</option></select></div>
      <div class="field full"><label>Ouverture</label><select id="os"><option value="int"${o.swing === "int" ? " selected" : ""}>Vers l'intérieur</option><option value="ext"${o.swing === "ext" ? " selected" : ""}>Vers l'extérieur</option></select></div>
     </div>
     <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap"><button id="ihg">Inverser gond</button><button id="ihs">Inverser sens</button></div>
     <div style="margin-top:8px"><button id="delo" class="danger">Supprimer</button></div>
     <p class="note">Glissez l'ouverture le long du mur pour la déplacer ; tirez une poignée pour la largeur. Raccourcis : G gond · S sens · Suppr.</p>`;
    const re = () => {
      draw();
      showSide();
    };
    b.querySelector("#ow").onchange = e => {
      snapshot();
      o.w = +(+e.target.value).toFixed(2);
      markDirty();
      re();
    };
    b.querySelector("#ot").onchange = e => {
      snapshot();
      o.t = +(+e.target.value).toFixed(2);
      markDirty();
      re();
    };
    b.querySelector("#ok").onchange = e => {
      snapshot();
      o.kind = e.target.value;
      markDirty();
      re();
    };
    b.querySelector("#oh").onchange = e => {
      snapshot();
      o.hinge = e.target.value;
      markDirty();
      re();
    };
    b.querySelector("#os").onchange = e => {
      snapshot();
      o.swing = e.target.value;
      markDirty();
      re();
    };
    b.querySelector("#ihg").onclick = () => {
      snapshot();
      o.hinge = o.hinge === "g" ? "d" : "g";
      markDirty();
      re();
    };
    b.querySelector("#ihs").onclick = () => {
      snapshot();
      o.swing = o.swing === "int" ? "ext" : "int";
      markDirty();
      re();
    };
    b.querySelector("#delo").onclick = () => {
      snapshot();
      state.openings = state.openings.filter(x => x.id !== o.id);
      K.sel = null;
      markDirty();
      re();
    };
    return;
  }
  if (K.sel && K.sel.kind === "dim") {
    const d = state.dims.find(x => x.id === K.sel.id);
    const L = dist(d.a.x, d.a.y, d.b.x, d.b.y);
    b.innerHTML = `<h3>Cote</h3><div class="kv"><span>Mesure</span><span class="num">${L.toFixed(2)} m</span></div>
     <div style="margin-top:12px"><button id="deld" class="danger">Supprimer</button></div>`;
    b.querySelector("#deld").onclick = () => {
      snapshot();
      state.dims = state.dims.filter(x => x.id !== d.id);
      K.sel = null;
      markDirty();
      draw();
      showSide();
    };
    return;
  }
  if (K.sel && K.sel.kind === "room") {
    const r = state.rooms.find(x => x.id === K.sel.id);
    const w = Math.abs(r.x1 - r.x0),
      hh = Math.abs(r.y1 - r.y0);
    b.innerHTML = `<h3>Pièce</h3>
     <div class="prop"><div class="field full"><label>Nom</label><input id="rn" type="text" value="${r.name.replace(/"/g, '&quot;')}"></div>
      ${r.cycle ? "" : `<div class="field"><label>Largeur <span class="u">m</span></label><input id="rw" type="number" step="0.01" value="${w.toFixed(2)}"></div>
      <div class="field"><label>Profondeur <span class="u">m</span></label><input id="rh" type="number" step="0.01" value="${hh.toFixed(2)}"></div>`}</div>
     ${pref("surfaces") ? `<div class="kv"><span>${r.cycle ? "Surface habitable" : "Surface"}</span><span class="num">${roomArea(r).toFixed(2).replace(".", ",")} m²</span></div>` : ""}
     ${r.cycle ? `<div class="kv"><span>Murs du contour</span><span class="num">${r.cycle.length}</span></div>` : ""}
     ${r.open ? `<p class="note warn">Un mur de son contour a été supprimé : la pièce n'est plus fermée (forme figée). Relancez « Détecter les pièces ».</p>` : ""}
     ${r.also && r.also.length ? `<p class="note warn">Le plan indique aussi ici : <b>${r.also.join(", ")}</b>. Un mur manque peut-être pour les séparer.</p>` : ""}
     <div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap">
       <button id="r_ccw" title="Maj+R">⟲ 90°</button><button id="r_cw" title="R">⟳ 90°</button><button id="r_mx" title="X">⇋</button><button id="r_my" title="Y">⇵</button></div>
     <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><button id="r_dup">Dupliquer</button><button id="delr" class="danger">Supprimer</button></div>
     <p class="note">${r.cycle ? "Pièce détectée d'après ses murs : sa forme et sa surface suivent les murs quand on les déplace. Surface mesurée entre les faces intérieures des murs." : "La largeur et la profondeur déplacent réellement les murs de droite et du bas."} Glissez la pièce sélectionnée pour la déplacer avec ses murs et ses appareils. Supprimer retire la pièce, ses murs et son contenu.</p>`;
    b.querySelector("#rn").onchange = e => {
      snapshot();
      r.name = e.target.value || r.name;
      markDirty();
      draw();
    };
    if (b.querySelector("#rw")) b.querySelector("#rw").onchange = e => {
      const v = +e.target.value;
      if (v > 0.3) {
        snapshot();
        resizeRoom(r, v, null);
        markDirty();
        draw();
        showSide();
      }
    };
    if (b.querySelector("#rh")) b.querySelector("#rh").onchange = e => {
      const v = +e.target.value;
      if (v > 0.3) {
        snapshot();
        resizeRoom(r, null, v);
        markDirty();
        draw();
        showSide();
      }
    };
    b.querySelector("#r_ccw").onclick = () => transformGroup("ccw");
    b.querySelector("#r_cw").onclick = () => transformGroup("cw");
    b.querySelector("#r_mx").onclick = () => transformGroup("mx");
    b.querySelector("#r_my").onclick = () => transformGroup("my");
    b.querySelector("#r_dup").onclick = duplicateGroup;
    b.querySelector("#delr").onclick = () => deleteGroup(currentGroup());
    return;
  }
  if (K.sel && K.sel.kind === "seg") {
    const s = segById(K.sel.id);
    const a = nodeById(s.a),
      c = nodeById(s.b);
    const L = dist(a.x, a.y, c.x, c.y);
    b.innerHTML = `<h3>${s.virt ? "Limite de pièce" : "Mur"}</h3><div class="prop">
      <div class="field full"><label>Longueur <span class="u">m</span></label><input id="f_L" type="number" step="0.01" value="${L.toFixed(2)}"></div>
      ${s.virt ? "" : `<div class="field full"><label>Épaisseur des murs <span class="u">m</span></label><input id="f_ep" type="number" step="0.01" value="${state.wallEp}"></div>`}</div>
     <label class="ck" style="margin-top:10px" title="Une limite sépare deux pièces sans mur (séjour / dégagement, cuisine ouverte) : pointillés, pas imprimée comme un mur, pas d'appareil collé dessus."><input type="checkbox" id="f_virt" ${s.virt ? "checked" : ""}> Limite de pièce (pas un vrai mur)</label>
     <div style="margin-top:12px"><button id="delseg" class="danger">Supprimer ce mur</button></div>
     <p class="note">Modifier la longueur déplace l'extrémité B. Glissez un sommet pour ajuster un angle.</p>`;
    b.querySelector("#f_L").onchange = e => {
      const nl = +e.target.value,
        d = dist(a.x, a.y, c.x, c.y) || 1;
      snapshot();
      c.x = +(a.x + (c.x - a.x) / d * nl).toFixed(3);
      c.y = +(a.y + (c.y - a.y) / d * nl).toFixed(3);
      markDirty();
      draw();
      showSide();
    };
    if (b.querySelector("#f_ep")) b.querySelector("#f_ep").onchange = e => {
      snapshot();
      state.wallEp = +(+e.target.value).toFixed(2);
      markDirty();
      draw();
      showSide();
    };
    b.querySelector("#f_virt").onchange = e => {
      snapshot();
      if (e.target.checked) {
        s.virt = true;
        state.openings = state.openings.filter(o => o.seg !== s.id);
        state.app.forEach(x => {
          if (x.seg === s.id) reattach(x);
        });
      } else delete s.virt;
      markDirty();
      draw();
      showSide();
    };
    b.querySelector("#delseg").onclick = () => {
      snapshot();
      state.openings = state.openings.filter(o => o.seg !== K.sel.id);
      state.segs = state.segs.filter(x => x.id !== K.sel.id);
      cleanNodes();
      K.sel = null;
      markDirty();
      draw();
      showSide();
    };
    return;
  }
  if (K.sel && K.sel.kind === "node") {
    const n = nodeById(K.sel.id);
    b.innerHTML = `<h3>Sommet</h3><div class="prop"><div class="field"><label>X <span class="u">m</span></label><input id="nx" type="number" step="0.01" value="${n.x}"></div>
     <div class="field"><label>Y <span class="u">m</span></label><input id="ny" type="number" step="0.01" value="${n.y}"></div></div>
     <div style="margin-top:12px"><button id="deln" class="danger">Supprimer le sommet</button></div>
     <p class="note">Relie ${state.segs.filter(s => s.a === n.id || s.b === n.id).length} mur(s).</p>`;
    b.querySelector("#nx").onchange = e => {
      snapshot();
      n.x = +(+e.target.value).toFixed(3);
      markDirty();
      draw();
      showSide();
    };
    b.querySelector("#ny").onchange = e => {
      snapshot();
      n.y = +(+e.target.value).toFixed(3);
      markDirty();
      draw();
      showSide();
    };
    b.querySelector("#deln").onclick = () => {
      snapshot();
      state.segs = state.segs.filter(s => s.a !== n.id && s.b !== n.id);
      state.nodes = state.nodes.filter(x => x.id !== n.id);
      K.sel = null;
      markDirty();
      draw();
      showSide();
    };
    return;
  }
  if (K.sel && K.sel.kind === "app") {
    const a = state.app.find(x => x.id === K.sel.id);
    const rm = repMap();
    const m = a.seg ? wallMeasure(a.seg, a.x, a.y) : null;
    b.innerHTML = `<h3>Appareil · <span style="color:var(--accent2)">${rm[a.id] || ""}</span></h3>
     <div class="prop">
      <div class="field full"><label>Type</label><select id="f_t">${Object.keys(TYPES).map(t => `<option value="${t}"${t === a.t ? " selected" : ""}>${TYPES[t].n}</option>`).join("")}</select></div>
      ${m ? `<div class="field"><label>Depuis l'angle A <span class="u">cm</span></label><input id="f_dA" type="number" step="1" value="${Math.round(m.dA * 100)}"></div>
      <div class="field"><label>Depuis l'angle B <span class="u">cm</span></label><input id="f_dB" type="number" step="1" value="${Math.round(m.dB * 100)}"></div>` : ""}
      <div class="field"><label>X plan <span class="u">m</span></label><input id="f_x" type="number" step="0.01" value="${a.x}"></div>
      <div class="field"><label>Y plan <span class="u">m</span></label><input id="f_y" type="number" step="0.01" value="${a.y}"></div>
      <div class="field full"><label>Hauteur <span class="u">cm</span></label><input id="f_h" type="number" step="1" value="${a.h ?? ""}" ${a.h == null ? 'placeholder="— plafond —"' : ''}></div></div>
     <div style="display:flex;gap:6px;margin-top:12px"><button id="dup">Dupliquer</button><button id="del" class="danger">Supprimer</button></div>
     <p class="note">${m ? "Fixé au mur : les distances sont mesurées depuis la face intérieure du mur d'angle, comme sur le chantier. Tapez 30 pour « à 30 cm de l'angle »." : "Approchez l'appareil d'un mur pour qu'il s'y fixe et afficher ses distances aux angles."}</p>`;
    const re = () => {
      draw();
      showSide();
    };
    if (m) {
      b.querySelector("#f_dA").onchange = e => {
        snapshot();
        const p = posOnWall(m, true, +e.target.value / 100);
        a.x = p.x;
        a.y = p.y;
        markDirty();
        re();
      };
      b.querySelector("#f_dB").onchange = e => {
        snapshot();
        const p = posOnWall(m, false, +e.target.value / 100);
        a.x = p.x;
        a.y = p.y;
        markDirty();
        re();
      };
    }
    b.querySelector("#f_t").onchange = e => {
      snapshot();
      a.t = e.target.value;
      if (a.h == null && TYPES[a.t].h != null) a.h = TYPES[a.t].h;
      markDirty();
      re();
    };
    b.querySelector("#f_x").onchange = e => {
      snapshot();
      a.x = +(+e.target.value).toFixed(2);
      markDirty();
      re();
    };
    b.querySelector("#f_y").onchange = e => {
      snapshot();
      a.y = +(+e.target.value).toFixed(2);
      markDirty();
      re();
    };
    b.querySelector("#f_h").onchange = e => {
      snapshot();
      a.h = e.target.value === "" ? null : +e.target.value;
      markDirty();
      re();
    };
    b.querySelector("#dup").onclick = duplicateGroup;
    b.querySelector("#del").onclick = delSel;
    return;
  }
  // rien sélectionné : stats + calques
  const counts = {};
  state.app.forEach(a => counts[a.t] = (counts[a.t] || 0) + 1);
  const totA = state.rooms.reduce((s, r) => s + roomArea(r), 0);
  b.innerHTML = `<h3>Chantier</h3>
    <div class="kv"><span>Pièces</span><span class="num">${state.rooms.length}${totA && pref("surfaces") ? ` · ${totA.toFixed(1).replace(".", ",")} m²` : ""}</span></div>
    <div class="kv"><span>Murs</span><span class="num">${state.segs.length}</span></div>
    <div class="kv"><span>Ouvertures</span><span class="num">${state.openings.length}</span></div>
    <div class="kv"><span>Appareils</span><span class="num">${state.app.length}</span></div>
    <div class="kv"><span>Liaisons</span><span class="num">${state.lia.length}</span></div>
    ${Object.keys(counts).length ? Object.keys(counts).map(t => `<div class="kv"><span>${TYPES[t]?.n || t}</span><span class="num">${counts[t]}</span></div>`).join("") : ""}
    ${layerPanel()}
    <p class="note">Outils : <b>Pièce</b> (rectangle), <b>Mur</b> (cloisons), <b>Porte</b>/<b>Fenêtre</b> (cliquer un mur), <b>// Cloison</b> (parallèle), <b>Cote</b> (2 points), puis les appareils. Raccourcis : E pièce · B mur · V sélection.</p>`;
  wireLayers(b);
}

export function cleanNodes() {
  const used = new Set();
  state.segs.forEach(s => {
    used.add(s.a);
    used.add(s.b);
  });
  state.nodes = state.nodes.filter(n => used.has(n.id));
}

export function delSel() {
  if (multi.size > 1 || K.sel && K.sel.kind === "room") {
    deleteGroup(currentGroup());
    return;
  }
  if (!K.sel) return;
  if (K.sel.kind === "app") {
    snapshot();
    state.app = state.app.filter(x => x.id !== K.sel.id);
    state.lia = state.lia.filter(x => x.c !== K.sel.id && x.l !== K.sel.id);
  } else if (K.sel.kind === "seg") {
    const n = state.app.filter(a => a.seg === K.sel.id).length;
    if (n) {
      K.sel = {
        kind: "segDelAsk",
        id: K.sel.id,
        n
      };
      draw();
      showSide();
      document.dispatchEvent(new CustomEvent("okteo:ask"));
      setHint("Ce mur porte " + n + " appareil" + (n > 1 ? "s" : "") + " : choisissez dans le panneau de droite.");
      return;
    }
    snapshot();
    state.openings = state.openings.filter(o => o.seg !== K.sel.id);
    state.segs = state.segs.filter(x => x.id !== K.sel.id);
    cleanNodes();
  } else if (K.sel.kind === "node") {
    snapshot();
    const id = K.sel.id;
    state.segs = state.segs.filter(s => s.a !== id && s.b !== id);
    state.nodes = state.nodes.filter(n => n.id !== id);
  } else if (K.sel.kind === "open") {
    snapshot();
    state.openings = state.openings.filter(x => x.id !== K.sel.id);
  } else if (K.sel.kind === "room") {
    snapshot();
    state.rooms = state.rooms.filter(x => x.id !== K.sel.id);
  } else if (K.sel.kind === "dim") {
    snapshot();
    state.dims = state.dims.filter(x => x.id !== K.sel.id);
  } else return;
  K.sel = null;
  markDirty();
  draw();
  showSide();
}

// ---------- barres ----------
// icônes des outils (traits simples, couleur du texte)

