// Oktéo AI — cœur : Dessin du plan (SVG) : fond, murs, ouvertures, pièces, appareils, étiquettes sans chevauchement.
// Module issu du découpage de app.js (v26). L'état partagé est dans K (core/k.js).
import { K } from "./k.js";
import { labelPoint, pointInPoly } from "../walls/rooms.js";
import { Placer, roomCandidates, textBox } from "../place.js";
import { TYPES, VB, dist, epOf, layers, nodeById, pmNow, segById, segDir, segLen, state, symView } from "./model.js";
import { V2W, W2V, ensureReps, pxPerVB, repMap, syncVB } from "./view.js";
import { followWalls, gaineCtrl, linkCtrl, linkRole, openHandles, roomArea, roomPoly } from "./attach.js";
import { bbox, currentGroup, groupPoints, isSel, multi } from "./groups.js";
import { placeHud } from "./hud.js";
import { allLinks, belowData, crossLinks } from "./levels.js";

// ---------- rendu ----------
export const sv = document.getElementById("sv");

export function glyph(t) {
  switch (t) {
    case "PC16":
      return `<circle r="0.9" class="gy"/><text y="0.3" class="gl">16</text>`;
    case "PC20":
      return `<circle r="0.9" class="gf"/><text y="0.3" class="glw">20</text>`;
    case "RJ45":
      return `<rect x="-0.8" y="-0.8" width="1.6" height="1.6" rx="0.2" class="gy"/><text y="0.3" class="gl">RJ</text>`;
    case "APP":
      return `<path d="M-0.9 0.25A0.9 0.9 0 0 1 0.9 0.25Z" class="gy"/><path d="M-0.55 -0.3L0.55 0.25M0.55 -0.3L-0.55 0.25" class="gs"/>`;
    case "LUM":
      return `<circle r="0.9" class="gy"/><path d="M-0.6 -0.6L0.6 0.6M0.6 -0.6L-0.6 0.6" class="gs"/>`;
    case "SPOT":
      return `<circle r="0.6" class="gy"/><circle r="0.22" class="gf"/>`;
    case "INT":
      return `<circle r="0.55" class="gy"/><line x1="0.35" y1="-0.35" x2="0.95" y2="-0.95" class="gs"/>`;
    case "VV":
      return `<circle r="0.55" class="gy"/><line x1="0.35" y1="-0.35" x2="0.95" y2="-0.95" class="gs"/><line x1="-0.1" y1="0.3" x2="0.5" y2="-0.3" class="gs"/>`;
    case "BP":
      return `<circle r="0.55" class="gy"/><circle r="0.2" class="gf"/>`;
    case "VMC":
      return `<rect x="-0.8" y="-0.8" width="1.6" height="1.6" rx="0.3" class="gy"/><text y="0.3" class="gl">V</text>`;
    case "SC":
      return `<circle r="0.6" class="gy"/><path d="M-0.85 -0.85L0.85 0.85M0.85 -0.85L-0.85 0.85" class="gs"/>`;
    case "TAB":
      return `<rect x="-1" y="-1.2" width="2" height="2.4" rx="0.2" class="gf"/><text y="0.3" class="glw">TD</text>`;
  }
  return `<circle r="0.8" class="gy"/>`;
}

export function lightsOn(cid) {
  const s = new Set();
  state.lia.filter(x => x.c === cid).forEach(x => s.add(x.l));
  return s;
}

// intervalles pleins d'un mur en retirant les ouvertures

// intervalles pleins d'un mur en retirant les ouvertures
export function wallIntervals(seg) {
  const L = segLen(seg);
  const ops = state.openings.filter(o => o.seg === seg.id).map(o => [o.t - o.w / 2, o.t + o.w / 2]).sort((a, b) => a[0] - b[0]);
  const out = [];
  let cur = 0;
  ops.forEach(([s, e]) => {
    if (s > cur) out.push([cur, Math.min(s, L)]);
    cur = Math.max(cur, e);
  });
  if (cur < L) out.push([cur, L]);
  return out;
}

export function draw() {
  syncVB();
  followWalls();
  ensureReps();
  const s = K.view.scale,
    [bx, by] = W2V(K.BG.x, K.BG.y),
    ep = state.wallEp;
  let h = `<style>
  .gy{fill:var(--panel);stroke:var(--accent);stroke-width:.14}.gf{fill:var(--accent);stroke:var(--accent);stroke-width:.14}
  .gs{stroke:var(--accent);stroke-width:.16;fill:none}.gl{fill:var(--accent);font:600 .75px var(--fm);text-anchor:middle}
  .glw{fill:#fff;font:600 .7px var(--fm);text-anchor:middle}</style>`;
  if (K.bgLevel > 0 && layers.fond.on && K.FOND) h += `<image href="${K.FOND}" x="${bx}" y="${by}" width="${K.BG.w * s}" height="${K.BG.h * s}" opacity="${K.bgLevel}" preserveAspectRatio="none"/>`;
  const g = 1 * s;
  if (g > 6) {
    let gl = "";
    for (let x = ((0 - K.view.cx) * s + VB.w / 2) % g; x < VB.w; x += g) gl += `<line x1="${x}" y1="0" x2="${x}" y2="${VB.h}"/>`;
    for (let y = ((0 - K.view.cy) * s + VB.h / 2) % g; y < VB.h; y += g) gl += `<line x1="0" y1="${y}" x2="${VB.w}" y2="${y}"/>`;
    h += `<g stroke="var(--grid)" stroke-width=".4">${gl}</g>`;
  }
  h += `<g transform="translate(${VB.w / 2} ${VB.h / 2}) scale(${s}) translate(${-K.view.cx} ${-K.view.cy})">`;
  // groupe sélectionné (sélection multiple ou pièce) : ce qui bougera
  const GH = multi.size > 1 || K.sel && K.sel.kind === "room" ? currentGroup() : null;
  // niveau du dessous en transparence (pour caler les murs de l'étage)
  if (K.showBelow) {
    const B = belowData();
    if (B && B.segs && B.segs.length) {
      const N = Object.fromEntries((B.nodes || []).map(n => [n.id, n]));
      let gb = "";
      B.segs.forEach(sg => {
        if (sg.virt) return;
        const a = N[sg.a],
          b = N[sg.b];
        if (!a || !b) return;
        const L = dist(a.x, a.y, b.x, b.y) || 1,
          e = (sg.ep > 0 ? sg.ep : state.wallEp) / 2,
          nx = -(b.y - a.y) / L * e,
          ny = (b.x - a.x) / L * e;
        gb += `<polygon points="${a.x + nx},${a.y + ny} ${b.x + nx},${b.y + ny} ${b.x - nx},${b.y - ny} ${a.x - nx},${a.y - ny}"/>`;
      });
      h += `<g class="below" fill="var(--mut)" opacity="0.22">${gb}</g>`;
    }
  }
  // pièces
  if (layers.pieces.on) {
    let rf = "";
    state.rooms.forEach(r => {
      const on = isSel("room", r.id) || GH && GH.rooms.has(r.id);
      rf += `<polygon points="${roomPoly(r).map(p => p.x + "," + p.y).join(" ")}" fill="var(--accent)" opacity="${on ? 0.14 : 0.07}"/>`;
    });
    h += `<g>${rf}</g>`;
  }
  // murs (intervalles pleins) + jonctions
  if (layers.murs.on) {
    let mp = "",
      jn = "";
    state.segs.forEach(seg => {
      const d = segDir(seg);
      if (!d.a) return;
      const on = K.sel && (K.sel.kind === "seg" || K.sel.kind === "segDelAsk") && K.sel.id === seg.id || GH && GH.nodes.has(seg.a) && GH.nodes.has(seg.b);
      const col = on ? 'var(--sel)' : 'var(--wall)';
      if (seg.virt) {
        mp += `<line x1="${d.a.x}" y1="${d.a.y}" x2="${d.b.x}" y2="${d.b.y}" stroke="${on ? 'var(--sel)' : 'var(--mut)'}" stroke-width="${on ? 0.05 : 0.03}" stroke-dasharray="0.14 0.09"/>`;
        return;
      }
      const e2 = epOf(seg) / 2,
        nx = -d.uy * e2,
        ny = d.ux * e2;
      wallIntervals(seg).forEach(([s0, s1]) => {
        const ax = d.a.x + d.ux * s0,
          ay = d.a.y + d.uy * s0,
          bxp = d.a.x + d.ux * s1,
          byp = d.a.y + d.uy * s1;
        mp += `<polygon points="${ax + nx},${ay + ny} ${bxp + nx},${byp + ny} ${bxp - nx},${byp - ny} ${ax - nx},${ay - ny}" fill="${col}"/>`;
      });
    });
    state.nodes.forEach(n => {
      let e = 0;
      state.segs.forEach(s => {
        if (s.a === n.id || s.b === n.id) e = Math.max(e, epOf(s));
      });
      if (e > 0) jn += `<rect x="${n.x - e / 2}" y="${n.y - e / 2}" width="${e}" height="${e}" fill="var(--wall)"/>`;
    });
    h += `<g>${jn}${mp}</g>`;
  }
  // ouvertures (portes/fenêtres)
  if (layers.ouvertures.on) {
    let op = "";
    state.openings.forEach(o => {
      const seg = segById(o.seg);
      if (!seg) return;
      const d = segDir(seg);
      const cx = d.a.x + d.ux * o.t,
        cy = d.a.y + d.uy * o.t,
        nx = -d.uy,
        ny = d.ux;
      const hw = o.w / 2,
        ep = epOf(seg);
      const on = isSel("open", o.id) || GH && GH.opens.has(o.id);
      const c = on ? 'var(--sel)' : 'var(--accent2)';
      const j1x = cx - d.ux * hw,
        j1y = cy - d.uy * hw,
        j2x = cx + d.ux * hw,
        j2y = cy + d.uy * hw;
      if (o.kind === "fenetre") {
        op += `<line x1="${j1x + nx * ep / 2}" y1="${j1y + ny * ep / 2}" x2="${j2x + nx * ep / 2}" y2="${j2y + ny * ep / 2}" stroke="${c}" stroke-width="0.04"/>`;
        op += `<line x1="${j1x - nx * ep / 2}" y1="${j1y - ny * ep / 2}" x2="${j2x - nx * ep / 2}" y2="${j2y - ny * ep / 2}" stroke="${c}" stroke-width="0.04"/>`;
        op += `<line x1="${(j1x + j2x) / 2 + nx * ep / 2}" y1="${(j1y + j2y) / 2 + ny * ep / 2}" x2="${(j1x + j2x) / 2 - nx * ep / 2}" y2="${(j1y + j2y) / 2 - ny * ep / 2}" stroke="${c}" stroke-width="0.03" opacity="0.6"/>`;
      } else {
        // porte : gond à une extrémité, battant + arc
        const sdir = o.swing === "ext" ? 1 : -1,
          hinge = o.hinge === "d" ? 1 : -1;
        const hx = o.hinge === "d" ? j2x : j1x,
          hy = o.hinge === "d" ? j2y : j1y;
        // battant ouvert ~ perpendiculaire
        const lx = hx + nx * sdir * o.w,
          ly = hy + ny * sdir * o.w;
        op += `<line x1="${hx}" y1="${hy}" x2="${lx}" y2="${ly}" stroke="${c}" stroke-width="0.04"/>`;
        // arc du battant (quart de cercle)
        const fx = o.hinge === "d" ? j1x : j2x,
          fy = o.hinge === "d" ? j1y : j2y;
        op += `<path d="M ${lx} ${ly} A ${o.w} ${o.w} 0 0 ${hinge * sdir > 0 ? 1 : 0} ${fx} ${fy}" fill="none" stroke="${c}" stroke-width="0.03" opacity="0.7"/>`;
      }
      if (isSel("open", o.id)) op += `<circle cx="${cx}" cy="${cy}" r="${hw + 0.15}" fill="none" stroke="var(--sel)" stroke-width="0.05" stroke-dasharray="0.3 0.2"/>`;
    });
    h += `<g>${op}</g>`;
  }
  // aperçus
  if (K.tool === "mur" && K.draftFrom && K.draftPt) {
    const f = nodeById(K.draftFrom);
    if (f) h += `<line x1="${f.x}" y1="${f.y}" x2="${K.draftPt.x}" y2="${K.draftPt.y}" stroke="var(--accent)" stroke-width="${ep}" stroke-linecap="round" opacity=".5"/>`;
  }
  if (K.tool === "piece" && K.roomDraft) {
    const x = Math.min(K.roomDraft.x0, K.roomDraft.x1),
      y = Math.min(K.roomDraft.y0, K.roomDraft.y1),
      w = Math.abs(K.roomDraft.x1 - K.roomDraft.x0),
      hh = Math.abs(K.roomDraft.y1 - K.roomDraft.y0);
    h += `<rect x="${x}" y="${y}" width="${w}" height="${hh}" fill="var(--accent)" opacity=".1" stroke="var(--accent)" stroke-width="${ep}" stroke-dasharray="0.3 0.2"/>`;
  }
  if (K.tool === "cote" && K.dimDraft && K.draftPt) {
    h += `<line x1="${K.dimDraft.x}" y1="${K.dimDraft.y}" x2="${K.draftPt.x}" y2="${K.draftPt.y}" stroke="var(--dimc)" stroke-width="0.05" stroke-dasharray="0.2 0.15"/>`;
  }
  // cotes libres (le texte est placé avec les autres étiquettes)
  const dimTexts = [];
  if (layers.cotes.on) {
    let fd = "";
    state.dims.forEach(dd => {
      const on = isSel("dim", dd.id) || GH && GH.dims.has(dd.id);
      const c = on ? 'var(--sel)' : 'var(--dimc)';
      const L = dist(dd.a.x, dd.a.y, dd.b.x, dd.b.y);
      const mx = (dd.a.x + dd.b.x) / 2,
        my = (dd.a.y + dd.b.y) / 2;
      const ux = (dd.b.x - dd.a.x) / (L || 1),
        uy = (dd.b.y - dd.a.y) / (L || 1),
        nx = -uy,
        ny = ux;
      fd += `<line x1="${dd.a.x}" y1="${dd.a.y}" x2="${dd.b.x}" y2="${dd.b.y}" stroke="${c}" stroke-width="0.04"/>`;
      fd += `<line x1="${dd.a.x - nx * 0.1}" y1="${dd.a.y - ny * 0.1}" x2="${dd.a.x + nx * 0.1}" y2="${dd.a.y + ny * 0.1}" stroke="${c}" stroke-width="0.04"/>`;
      fd += `<line x1="${dd.b.x - nx * 0.1}" y1="${dd.b.y - ny * 0.1}" x2="${dd.b.x + nx * 0.1}" y2="${dd.b.y + ny * 0.1}" stroke="${c}" stroke-width="0.04"/>`;
      dimTexts.push({
        x: mx,
        y: my,
        nx,
        ny,
        c,
        str: L.toFixed(2)
      });
    });
    h += `<g>${fd}</g>`;
  }
  // liaisons
  if (layers.liaisons.on) {
    const byId = Object.fromEntries(state.app.map(a => [a.id, a]));
    let ll = "";
    // trait fin et discret ; ceux de l'appareil sélectionné (ou de la commande testée) ressortent, les autres s'effacent
    // avec l'outil Liaison : toutes les liaisons en trait épais, la commande choisie et ses lumières ressortent,
    // les commandes et lumières sans liaison sont cerclées en orange (on voit tout de suite ce qui manque)
    const pmL = pmNow(),
      tool = K.tool === "lien",
      focus = K.sel && (K.sel.kind === "app" || K.sel.kind === "link") ? K.sel.id : tool ? K.linkLight : null,
      hotLink = K.linkHot;
    state.lia.forEach(x => {
      const c = byId[x.c],
        l = byId[x.l];
      if (!c || !l) return;
      const q = linkCtrl(c, l);
      const picked = hotLink && hotLink.c === x.c && hotLink.l === x.l,
        hot = picked || K.testMode && K.sel && K.sel.id === c.id || focus && (focus === c.id || focus === l.id),
        dim = (focus || hotLink) && !hot;
      const w = (picked ? 4 : hot ? 3 : tool ? 2.2 : 1.4) * pmL,
        op = hot ? 0.95 : tool ? (dim ? 0.4 : 0.8) : dim ? 0.25 : 0.55;
      ll += `<path class="lia" d="M${c.x} ${c.y} Q ${q.x} ${q.y} ${l.x} ${l.y}" fill="none" stroke="${hot ? 'var(--accent2)' : 'var(--accent)'}" stroke-width="${w}" opacity="${op}"/>`;
    });
    if (tool) {
      const linked = new Set();
      allLinks().forEach(x => { linked.add(x.c); linked.add(x.l); });
      const r = 13 * pmL;
      state.app.forEach(a => {
        const role = linkRole(a.t);
        if (!role) return;
        if (focus && role === "l" && state.lia.some(x => x.c === focus && x.l === a.id)) ll += `<circle class="lia-on" cx="${a.x}" cy="${a.y}" r="${r}" fill="none" stroke="var(--accent2)" stroke-width="${2.4 * pmL}"/>`;
        else if (!linked.has(a.id)) ll += `<circle class="lia-miss" cx="${a.x}" cy="${a.y}" r="${r}" fill="none" stroke="#f28c1b" stroke-width="${2 * pmL}" stroke-dasharray="${4 * pmL} ${3 * pmL}"/>`;
      });
    }
    h += `<g>${ll}</g>`;
  }
  // boîtes de pieuvre (onglet Câblage) : liens boîte → appareils, alimentation depuis le tableau, carré + nom
  if (K.showCirc && (K.CAB.boxes || []).length) {
    const pm = pmNow(), cm = circuitMap(), byId = Object.fromEntries(state.app.map(a => [a.id, a])), tab = state.app.find(a => a.t === "TAB");
    let bl = "", bx = "";
    let wp = "";
    K.CAB.boxes.filter(b => b.lv === K.LV.cur).forEach(b => {
      const on = K.boxSel === b.id,
        R = b.routes || {};
      // gaine = ligne brisée boîte → points de passage → appareil (ligne droite tant qu'on ne l'a pas modifiée)
      // gaine : arc de la boîte à l'appareil (comme sur les plans KiTéOHM) ; tracée à la main : ligne brisée
      const gpath = (key, t) => {
        const pts = R[key];
        if (pts && pts.length) return "M" + [b, ...pts, t].map(p => p.x + " " + p.y).join(" L ");
        const q = gaineCtrl(b, t);
        return `M${b.x} ${b.y} Q ${q.x} ${q.y} ${t.x} ${t.y}`;
      };
      b.apps.forEach(id => {
        const a = byId[id];
        if (!a) return;
        const c = cm[id];
        bl += `<path class="gaine" data-b="${b.id}" data-k="${id}" d="${gpath(id, a)}" fill="none" stroke="${c ? c.color : "var(--mut)"}" stroke-width="${(on ? 2 : 1.1) * pm}" opacity="${on ? 0.9 : 0.55}"/>`;
      });
      if (tab) bl += `<path class="gaine alim" data-b="${b.id}" data-k="tab" d="${gpath("tab", tab)}" fill="none" stroke="var(--fg)" stroke-width="${1.2 * pm}" stroke-dasharray="${6 * pm} ${4 * pm}" opacity="0.45"/>`;
      for (const pts of Object.values(R)) pts.forEach(p => {
        wp += `<circle class="wp" cx="${p.x}" cy="${p.y}" r="${(on ? 4 : 3) * pm}" fill="var(--panel)" stroke="${on ? "var(--sel)" : "var(--fg)"}" stroke-width="${1.4 * pm}"/>`;
      });
      const q = 16 * pm,
        lk = lockPos(b, pm);
      bx += `<g class="box" data-id="${b.id}"><rect x="${b.x - q / 2}" y="${b.y - q / 2}" width="${q}" height="${q}" fill="var(--panel)" stroke="${on ? "var(--sel)" : "var(--fg)"}" stroke-width="${(on ? 2.4 : 1.6) * pm}"/>` +
        `<text x="${b.x}" y="${b.y - q / 2 - 4 * pm}" text-anchor="middle" font-size="${11 * pm}" font-weight="700" font-family="var(--fm)" fill="var(--fg)">${b.n}</text>` +
        ["A", "B", "C", "D"].map((f, i) => { const dx = [0, 1, 0, -1][i] * q * 0.32, dy = [-1, 0, 1, 0][i] * q * 0.32; return `<text x="${b.x + dx}" y="${b.y + dy}" text-anchor="middle" dominant-baseline="central" font-size="${6 * pm}" font-family="var(--fm)" fill="var(--mut)">${f}</text>`; }).join("") +
        // cadenas : fermé = la boîte ne bouge plus au recalcul ; un clic l'ouvre ou le ferme
        `<g class="lock${b.locked ? " on" : ""}" transform="translate(${lk.x} ${lk.y}) scale(${pm})"><title>${b.locked ? "Boîte verrouillée : elle ne bouge pas au recalcul (clic pour déverrouiller)" : "Clic pour verrouiller la boîte"}</title>` +
        `<rect x="-5" y="-2" width="10" height="8" rx="1.5" fill="${b.locked ? "var(--accent2)" : "var(--panel)"}" stroke="${b.locked ? "var(--accent2)" : "var(--mut)"}" stroke-width="1.3"/>` +
        `<path d="${b.locked ? "M-3 -2V-4.5a3 3 0 0 1 6 0V-2" : "M-3 -2V-4.5a3 3 0 0 1 6 0"}" fill="none" stroke="${b.locked ? "var(--accent2)" : "var(--mut)"}" stroke-width="1.3"/></g></g>`;
    });
    bx += wp;
    // bouts des gaines côté boîte (boîte choisie) : une poignée à tirer vers une autre boîte
    const sb = K.boxSel && K.CAB.boxes.find(b => b.id === K.boxSel && b.lv === K.LV.cur);
    if (sb) gaineEnds(sb).forEach(e => {
      bx += `<circle class="gend" cx="${e.x}" cy="${e.y}" r="${4.5 * pm}" fill="var(--sel)" stroke="var(--panel)" stroke-width="${1.2 * pm}"><title>Tirer vers une autre boîte pour y raccorder cette gaine</title></circle>`;
    });
    if (K.endDrag) bx += `<line x1="${K.endDrag.x}" y1="${K.endDrag.y}" x2="${K.endDrag.ax}" y2="${K.endDrag.ay}" stroke="var(--sel)" stroke-width="${2 * pm}" stroke-dasharray="${5 * pm} ${3 * pm}"/><circle cx="${K.endDrag.x}" cy="${K.endDrag.y}" r="${5 * pm}" fill="var(--sel)"/>`;
    h += `<g class="boxlinks">${bl}</g>`;
    K.__boxLayer = bx;
  } else K.__boxLayer = "";
  // appareils + repères
  if (layers.appareils.on) {
    const onSet = K.testMode && K.sel ? lightsOn(K.sel.id) : null,
      ss = symView(),
      rm = K.showReps ? repMap() : null;
    const circ = K.showCirc ? circuitMap() : null;
    let ap = "";
    state.app.forEach(a => {
      const aSel = isSel("app", a.id) || GH && GH.apps.has(a.id),
        lit = onSet && onSet.has(a.id);
      ap += `<g transform="translate(${a.x} ${a.y})"><g transform="scale(${ss})">`;
      if (lit) ap += `<circle r="1.5" fill="var(--warn)" opacity=".5"/>`;
      if (aSel) ap += `<circle r="1.5" fill="none" stroke="var(--sel)" stroke-width=".12" stroke-dasharray=".3 .25"/>`;
      // couleur du circuit (onglet Câblage) : anneau autour du symbole ; appareil sans circuit = anneau rouge pointillé
      if (circ) {
        const c = circ[a.id];
        if (c) ap += `<circle class="circ" data-c="${c.n}" r="1.28" fill="none" stroke="${c.color}" stroke-width=".34"/>`;else if (circ.__need(a)) ap += `<circle class="circ nocirc" r="1.28" fill="none" stroke="#d33" stroke-width=".22" stroke-dasharray=".25 .2"/>`;
      }
      ap += glyph(a.t) + `</g>`;
      ap += `</g>`;
    });
    h += `<g>${ap}</g>`;
  }
  if (K.__boxLayer) h += `<g class="boxes">${K.__boxLayer}</g>`;
  // ---------- étiquettes : taille fixe à l'écran, placées sans chevauchement (les moins importantes sont masquées) ----------
  {
    const pm = 1 / (pxPerVB() * s),
      PL = new Placer(pm * 48);
    let lb = "";
    const ssv = symView(),
      R = 0.95 * ssv;
    const txt = (x, y, str, px, fill, fam, extra = "") => `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" fill="${fill}" font-size="${px * pm}" font-family="${fam}"${extra}>${str}</text>`;
    // les symboles des appareils sont des obstacles
    if (layers.appareils.on) state.app.forEach(a => PL.add({
      x0: a.x - R,
      y0: a.y - R,
      x1: a.x + R,
      y1: a.y + R
    }));
    // 1. noms et surfaces des pièces (toujours affichés ; déplacés dans la pièce s'ils gênent)
    if (layers.pieces.on) {
      const F1 = 13,
        F2 = 11;
      state.rooms.slice().sort((p, q) => roomArea(q) - roomArea(p)).forEach(r => {
        const P = roomPoly(r),
          lp = r.poly ? labelPoint(r.poly) : {
            x: (r.x0 + r.x1) / 2,
            y: (r.y0 + r.y1) / 2
          },
          ar = roomArea(r).toFixed(1) + " m²";
        const w = Math.max(r.name.length * 0.55 * F1, ar.length * 0.6 * F2) * pm,
          hh = (F1 + F2 + 3) * pm;
        const bb = {
          x0: Math.min(...P.map(p => p.x)),
          y0: Math.min(...P.map(p => p.y)),
          x1: Math.max(...P.map(p => p.x)),
          y1: Math.max(...P.map(p => p.y))
        };
        const box = c => ({
          x0: c.x - w / 2,
          y0: c.y - hh / 2,
          x1: c.x + w / 2,
          y1: c.y + hh / 2
        });
        const inPoly = b => [[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1]].every(([x, y]) => pointInPoly(x, y, P));
        const cands = roomCandidates(lp, bb, (x, y) => pointInPoly(x, y, P), Math.max(0.25, 24 * pm)).slice(0, 80).map(box);
        const got = PL.first(cands.filter(inPoly)) || PL.first(cands) || PL.add(box(lp));
        const cx = (got.x0 + got.x1) / 2,
          cy = (got.y0 + got.y1) / 2;
        lb += txt(cx, cy - (F2 + 3) * pm / 2, r.name, F1, "var(--fg)", "var(--ff)", ' font-weight="600"') + txt(cx, cy + (F1 + 3) * pm / 2, ar, F2, "var(--mut)", "var(--fm)");
      });
    }
    // 2. cotes libres (posées par l'utilisateur : toujours affichées)
    dimTexts.forEach(d => {
      const F = 11,
        off = 9 * pm;
      let x = d.x + d.nx * off,
        y = d.y + d.ny * off;
      const b = textBox(x, y, d.str, F * pm);
      if (!PL.free(b)) {
        const x2 = d.x - d.nx * off,
          y2 = d.y - d.ny * off,
          b2 = textBox(x2, y2, d.str, F * pm);
        if (PL.free(b2)) {
          x = x2;
          y = y2;
        }
      }
      PL.add(textBox(x, y, d.str, F * pm));
      lb += txt(x, y, d.str, F, d.c, "var(--fm)");
    });
    // 3. repères des appareils : autour du symbole, à la première place libre ; l'appareil sélectionné passe en premier
    if (layers.appareils.on && K.showReps) {
      const rm = repMap(),
        F = 11;
      const order = state.app.slice().sort((p, q) => (isSel("app", q.id) ? 1 : 0) - (isSel("app", p.id) ? 1 : 0));
      order.forEach(a => {
        const str = rm[a.id];
        if (!str) return;
        const g = R + 3 * pm,
          h2 = F * pm * 0.5;
        const pos = [[g, -g, "start"], [g, g, "start"], [-g, -g, "end"], [-g, g, "end"], [g + 0 * pm, 0, "start"], [-g, 0, "end"], [0, -g - h2, "middle"], [0, g + h2, "middle"]];
        const cands = pos.map(([dx, dy, an]) => ({
          b: textBox(a.x + dx, a.y + dy, str, F * pm, {
            anchor: an
          }),
          x: a.x + dx,
          y: a.y + dy,
          an
        }));
        let c = cands.find(c => PL.free(c.b));
        if (!c && isSel("app", a.id)) c = cands[0];
        if (!c) return;
        PL.add(c.b);
        lb += `<text x="${c.x}" y="${c.y}" text-anchor="${c.an}" dominant-baseline="central" fill="var(--accent2)" font-size="${F * pm}" font-weight="600" font-family="var(--fm)">${str}</text>`;
      });
    }
    // 3 bis. liaisons vers un autre niveau : « → L3 R+1 » à côté de l'appareil (toujours affiché)
    if (layers.appareils.on && layers.liaisons.on) {
      const F = 10.5,
        byId = Object.fromEntries(state.app.map(a => [a.id, a])),
        seen = {};
      crossLinks().forEach(x => {
        const a = byId[x.id];
        if (!a) return;
        const k = seen[x.id] = (seen[x.id] || 0) + 1,
          g = R + 3 * pm,
          dy = (k - 1) * (F + 2) * pm;
        const pos = [[g, g + dy, "start"], [-g, g + dy, "end"], [g, -g - dy, "start"], [-g, -g - dy, "end"]];
        const cands = pos.map(([dx, yy, an]) => ({
          b: textBox(a.x + dx, a.y + yy, x.txt, F * pm, {
            anchor: an
          }),
          x: a.x + dx,
          y: a.y + yy,
          an
        }));
        const c = cands.find(c => PL.free(c.b)) || cands[0];
        PL.add(c.b);
        lb += `<text class="xlink" x="${c.x}" y="${c.y}" text-anchor="${c.an}" dominant-baseline="central" fill="var(--warn)" font-size="${F * pm}" font-weight="700" font-family="var(--fm)">${x.txt}</text>`;
      });
    }
    // 4. longueur des murs : d'un côté ou de l'autre du mur, seulement s'il y a la place
    if (K.showDims && layers.cotes.on && layers.murs.on) {
      const F = 10;
      state.segs.forEach(seg => {
        if (seg.virt) return;
        const d = segDir(seg);
        if (!d.a || d.L < 0.3) return;
        const str = d.L.toFixed(2),
          mx = (d.a.x + d.b.x) / 2,
          my = (d.a.y + d.b.y) / 2,
          e = epOf(seg) / 2 + 8 * pm;
        for (const sg of [1, -1]) {
          const x = mx - d.uy * e * sg,
            y = my + d.ux * e * sg,
            b = textBox(x, y, str, F * pm);
          if (PL.free(b)) {
            PL.add(b);
            lb += txt(x, y, str, F, "var(--mut)", "var(--fm)");
            break;
          }
        }
      });
    }
    h += `<g class="labels">${lb}</g>`;
  }
  // nœuds
  if ((K.tool === "mur" || K.tool === "sel") && layers.murs.on) {
    let nn = "";
    const pmN = pmNow();
    state.nodes.forEach(n => {
      const on = isSel("node", n.id) || GH && GH.nodes.has(n.id);
      const q = (on ? 9 : 7) * pmN;
      nn += `<rect x="${n.x - q / 2}" y="${n.y - q / 2}" width="${q}" height="${q}" fill="${on ? 'var(--sel)' : 'var(--panel)'}" stroke="var(--accent)" stroke-width="${1.3 * pmN}"/>`;
    });
    h += `<g>${nn}</g>`;
  }
  // guides d'alignement
  if (K.guides && K.guides.length) {
    const [wx0, wy0] = V2W(0, 0),
      [wx1, wy1] = V2W(VB.w, VB.h);
    let gg = "";
    K.guides.forEach(gd => {
      if (gd.v) gg += `<line x1="${gd.at}" y1="${wy0}" x2="${gd.at}" y2="${wy1}" stroke="var(--accent2)" stroke-width="0.03" stroke-dasharray="0.2 0.15" opacity="0.8"/>`;else gg += `<line x1="${wx0}" y1="${gd.at}" x2="${wx1}" y2="${gd.at}" stroke="var(--accent2)" stroke-width="0.03" stroke-dasharray="0.2 0.15" opacity="0.8"/>`;
    });
    h += `<g>${gg}</g>`;
  }
  // poignées d'ouverture sélectionnée
  if (K.sel && K.sel.kind === "open") {
    const so = state.openings.find(x => x.id === K.sel.id);
    const H = so && openHandles(so);
    if (H) {
      [H.j1, H.j2].forEach(j => {
        h += `<circle cx="${j.x}" cy="${j.y}" r="0.12" fill="var(--panel)" stroke="var(--sel)" stroke-width="0.05"/>`;
      });
    }
  }
  if (K.draftPt && K.draftPt.snap) h += `<circle cx="${K.draftPt.x}" cy="${K.draftPt.y}" r="0.18" fill="none" stroke="var(--snap)" stroke-width="0.05"/>`;
  // cadre englobant du groupe sélectionné
  if (GH && !K.drag) {
    const bb = bbox(groupPoints(GH));
    if (bb) {
      const m = 0.25;
      h += `<rect x="${bb.x0 - m}" y="${bb.y0 - m}" width="${bb.x1 - bb.x0 + 2 * m}" height="${bb.y1 - bb.y0 + 2 * m}" fill="none" stroke="var(--sel)" stroke-width="0.04" stroke-dasharray="0.25 0.18" opacity="0.8"/>`;
    }
  }
  // cadre de sélection en cours : bleu plein = entièrement dedans ; vert pointillé = touché
  if (K.marquee && K.marquee.moved) {
    const cr = K.marquee.x1 < K.marquee.x0,
      x = Math.min(K.marquee.x0, K.marquee.x1),
      y = Math.min(K.marquee.y0, K.marquee.y1),
      w = Math.abs(K.marquee.x1 - K.marquee.x0),
      hh = Math.abs(K.marquee.y1 - K.marquee.y0);
    h += `<rect x="${x}" y="${y}" width="${w}" height="${hh}" fill="${cr ? 'var(--ok)' : 'var(--accent)'}" fill-opacity="0.08" stroke="${cr ? 'var(--ok)' : 'var(--accent)'}" stroke-width="0.05" ${cr ? 'stroke-dasharray="0.3 0.2"' : ''}/>`;
  }
  // aperçu de pose d'appareil sous le curseur
  if (K.ghost && TYPES[K.tool] && layers.appareils.on) {
    const ss2 = symView();
    h += `<g transform="translate(${K.ghost.x} ${K.ghost.y}) scale(${ss2})" opacity="0.5">${glyph(K.ghost.t)}</g>`;
  }
  // aperçu de série
  if (K.seriesMode && K.seriesPrev) {
    const src = state.app.find(a => a.id === K.seriesMode.src),
      ss2 = symView();
    if (src) {
      K.seriesPrev.forEach(p => {
        h += `<g transform="translate(${p.x} ${p.y}) scale(${ss2})" opacity="0.55">${glyph(src.t)}</g>`;
      });
      const last = K.seriesPrev[K.seriesPrev.length - 1];
      if (last) h += `<line x1="${src.x}" y1="${src.y}" x2="${last.x}" y2="${last.y}" stroke="var(--accent2)" stroke-width="0.03" stroke-dasharray="0.2 0.15"/>`;
    }
  }
  // aperçu du relevé automatique des murs (avant validation)
  if (K.preview) {
    const P = K.preview;
    let pv = "";
    (P.rooms || []).forEach(r => {
      const lp = labelPoint(r.poly);
      pv += `<polygon points="${r.poly.map(p => p.x + "," + p.y).join(" ")}" fill="var(--accent2)" fill-opacity="0.16" stroke="var(--accent2)" stroke-width="0.03" stroke-dasharray="0.15 0.1"/>` + `<text x="${lp.x}" y="${lp.y}" text-anchor="middle" fill="var(--accent2)" font-size="0.42" font-weight="700" font-family="var(--ff)">${r.name}</text><text x="${lp.x}" y="${lp.y + 0.45}" text-anchor="middle" fill="var(--accent2)" font-size="0.32" font-family="var(--fm)">${r.area.toFixed(1)} m²</text>`;
    });
    (P.walls || []).forEach(w => {
      const a = P.nodes[w.a],
        b = P.nodes[w.b];
      const L = dist(a.x, a.y, b.x, b.y) || 1,
        nx = -(b.y - a.y) / L * w.ep / 2,
        ny = (b.x - a.x) / L * w.ep / 2;
      pv += `<polygon points="${a.x + nx},${a.y + ny} ${b.x + nx},${b.y + ny} ${b.x - nx},${b.y - ny} ${a.x - nx},${a.y - ny}" fill="var(--accent2)" fill-opacity="0.5" stroke="var(--accent2)" stroke-width="0.02"/>`;
    });
    (P.openings || []).forEach(o => {
      const w = P.walls[o.seg],
        a = P.nodes[w.a],
        b = P.nodes[w.b];
      const L = dist(a.x, a.y, b.x, b.y) || 1,
        ux = (b.x - a.x) / L,
        uy = (b.y - a.y) / L;
      pv += `<line x1="${a.x + ux * (o.t - o.w / 2)}" y1="${a.y + uy * (o.t - o.w / 2)}" x2="${a.x + ux * (o.t + o.w / 2)}" y2="${a.y + uy * (o.t + o.w / 2)}" stroke="${o.kind === "porte" ? "#e07b00" : "var(--ok)"}" stroke-width="${Math.max(0.06, w.ep * 0.8)}"/>`;
    });
    (P.walls ? P.nodes : []).forEach(n => {
      pv += `<circle cx="${n.x}" cy="${n.y}" r="0.05" fill="var(--accent2)"/>`;
    });
    (P.limits || []).forEach(l => {
      pv += `<line x1="${l.a.x}" y1="${l.a.y}" x2="${l.b.x}" y2="${l.b.y}" stroke="var(--accent2)" stroke-width="0.06" stroke-dasharray="0.15 0.1"/>`;
    });
    if (P.devices) {
      const D = P.devices,
        ss = symView();
      (P.links || []).forEach(l => {
        const c = D[l.c],
          m = D[l.l];
        if (c && m) pv += `<line x1="${c.x}" y1="${c.y}" x2="${m.x}" y2="${m.y}" stroke="var(--accent2)" stroke-width="0.025" stroke-dasharray="0.12 0.08" opacity="0.8"/>`;
      });
      D.forEach(d => {
        pv += `<circle cx="${d.x}" cy="${d.y}" r="${ss * 1.25}" fill="var(--accent2)" fill-opacity="0.25" stroke="var(--accent2)" stroke-width="0.02"/><g transform="translate(${d.x} ${d.y}) scale(${ss})">${glyph(d.t)}</g>`;
      });
      (P.unknown || []).forEach(u => {
        pv += `<circle cx="${u.x}" cy="${u.y}" r="${ss * 0.9}" fill="none" stroke="#d33" stroke-width="0.025" stroke-dasharray="0.05 0.04"/>`;
      });
    }
    h += `<g>${pv}</g>`;
  }
  // mise à l'échelle du fond : segment entre les deux points cliqués
  if (K.calib && K.calib.a) {
    const b = K.calib.b || K.calib.cur;
    const cs = 0.22 / Math.max(0.6, K.view.scale / 20);
    const cross = p => `<path d="M${p.x - cs} ${p.y}H${p.x + cs}M${p.x} ${p.y - cs}V${p.y + cs}" stroke="var(--accent2)" stroke-width="0.04"/><circle cx="${p.x}" cy="${p.y}" r="${cs * 0.55}" fill="none" stroke="var(--accent2)" stroke-width="0.03"/>`;
    h += cross(K.calib.a);
    if (b) {
      h += `<line x1="${K.calib.a.x}" y1="${K.calib.a.y}" x2="${b.x}" y2="${b.y}" stroke="var(--accent2)" stroke-width="0.05" stroke-dasharray="0.25 0.12"/>` + cross(b);
    }
  }
  h += `</g>`;
  sv.innerHTML = h;
  if (typeof placeHud === "function") placeHud();
}

// ---------- hit-tests ----------


// couleurs des circuits (même ordre que leur numéro) et correspondance appareil → circuit
export const CIRC_COLORS = ["#e6194b", "#3cb44b", "#4363d8", "#f58231", "#911eb4", "#42d4f4", "#f032e6", "#9a6324", "#469990", "#800000", "#808000", "#000075"];
export function circuitMap() {
  const m = {};
  (K.CAB.circuits || []).forEach((c, i) => {
    const col = CIRC_COLORS[i % CIRC_COLORS.length];
    (c.apps || []).forEach(id => m[id] = {
      n: c.n,
      color: col
    });
  });
  // appareils qui devraient être dans un circuit (pas le tableau, pas les bouches VMC non câblées)
  m.__need = a => !["TAB", "VMC"].includes(a.t);
  return m;
}

// boîte sous le point (monde), niveau ouvert
// bout de chaque gaine côté boîte : à 22 px du centre, dans la direction de la gaine (1er point de passage ou appareil)
export function gaineEnds(b, pm = pmNow()) {
  const byId = Object.fromEntries(state.app.map(a => [a.id, a])), R = b.routes || {}, out = [];
  for (const id of b.apps) {
    const a = byId[id];
    if (!a) continue;
    const t = (R[id] || [])[0] || gaineCtrl(b, a), L = dist(b.x, b.y, t.x, t.y) || 1;
    out.push({ id, x: b.x + (t.x - b.x) / L * 22 * pm, y: b.y + (t.y - b.y) / L * 22 * pm, ax: a.x, ay: a.y });
  }
  return out;
}
export function hitGaineEnd(wx, wy) {
  if (!K.showCirc || !K.boxSel) return null;
  const b = (K.CAB.boxes || []).find(x => x.id === K.boxSel && x.lv === K.LV.cur);
  if (!b) return null;
  const pm = pmNow();
  const e = gaineEnds(b, pm).map(e => ({ ...e, d: dist(wx, wy, e.x, e.y) })).filter(e => e.d <= 7 * pm).sort((p, q) => p.d - q.d)[0];
  return e ? { box: b, ...e } : null;
}
// position du cadenas d'une boîte (coin haut droit)
export function lockPos(b, pm = pmNow()) {
  return { x: b.x + 14 * pm, y: b.y - 13 * pm };
}
export function hitLock(wx, wy) {
  if (!K.showCirc) return null;
  const pm = pmNow();
  return (K.CAB.boxes || []).find(b => b.lv === K.LV.cur && dist(wx, wy, lockPos(b, pm).x, lockPos(b, pm).y) <= 8 * pm) || null;
}
// gaine sous la souris : point de passage existant { box, key, wp } ou tronçon { box, key, seg } (inséré à l'indice seg)
export function hitRoute(wx, wy) {
  if (!K.showCirc) return null;
  const pm = pmNow(), byId = Object.fromEntries(state.app.map(a => [a.id, a])), tab = state.app.find(a => a.t === "TAB");
  let best = null;
  for (const b of (K.CAB.boxes || []).filter(x => x.lv === K.LV.cur)) {
    const R = b.routes || {};
    const keys = [...b.apps.filter(id => byId[id]), ...(tab ? ["tab"] : [])];
    for (const key of keys) {
      const pts = [b, ...(R[key] || []), key === "tab" ? tab : byId[key]];
      for (let i = 1; i < pts.length - 1; i++) {
        const d = dist(wx, wy, pts[i].x, pts[i].y);
        if (d <= 7 * pm && (!best || best.wp == null || d < best.d)) best = { box: b, key, wp: i - 1, d };
      }
      if (best && best.wp != null) continue;
      // gaine sans point de passage : on teste l'arc dessiné
      if (pts.length === 2) {
        const T = pts[1], q = gaineCtrl(b, T);
        for (let s = 1; s < 40; s++) {
          const t = s / 40, u = 1 - t;
          const px = u * u * b.x + 2 * u * t * q.x + t * t * T.x, py = u * u * b.y + 2 * u * t * q.y + t * t * T.y;
          const d = dist(wx, wy, px, py);
          if (d <= 5 * pm && dist(wx, wy, b.x, b.y) > 14 * pm && dist(wx, wy, T.x, T.y) > 8 * pm && (!best || (best.wp == null && d < best.d))) best = { box: b, key, seg: 0, d };
        }
        continue;
      }
      for (let i = 0; i + 1 < pts.length; i++) {
        const A = pts[i], B = pts[i + 1], L = dist(A.x, A.y, B.x, B.y) || 1e-9;
        const t = ((wx - A.x) * (B.x - A.x) + (wy - A.y) * (B.y - A.y)) / (L * L);
        if (t <= 0.02 || t >= 0.98) continue;
        const d = dist(wx, wy, A.x + (B.x - A.x) * t, A.y + (B.y - A.y) * t);
        // près de la boîte (< 14 px) ou de l'appareil : on laisse la main à la boîte / à l'appareil
        if (d <= 5 * pm && dist(wx, wy, b.x, b.y) > 14 * pm && (!best || (best.wp == null && d < best.d))) best = { box: b, key, seg: i, d };
      }
    }
  }
  return best;
}
export function hitBox(wx, wy) {
  if (!K.showCirc) return null;
  const r = 12 * pmNow();
  return (K.CAB.boxes || []).find(b => b.lv === K.LV.cur && Math.abs(b.x - wx) <= r && Math.abs(b.y - wy) <= r) || null;
}
