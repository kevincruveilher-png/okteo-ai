// Extraction des tracés vectoriels d'une page PDF (pdf.js), sans IA.
// Résultat : liste de segments droits en coordonnées de page (points PDF, y vers le bas, origine en haut à gauche),
// avec le style du tracé (épaisseur de trait, couleur de trait / de remplissage, peint en trait ou en aplat).
// Les courbes (arcs de portes, symboles ronds) ne donnent pas de segments (un mur est toujours fait de segments droits) ;
// en plus, chaque sous-chemin peint est rendu dans `shapes` (courbes échantillonnées) pour reconnaître les symboles d'appareils.
// Ce module ne dépend que de l'objet `OPS` de pdf.js : il marche dans le navigateur et dans Node (tests).

const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

function colorArg(raw) {
  if (!raw) return null;
  const args = Array.from(raw);                                                  // pdf.js donne parfois un tableau typé
  if (typeof args[0] === "string") return args[0].toLowerCase();               // pdf.js donne déjà "#rrggbb"
  const big = args.some((v) => v > 1);                                           // 0–255 (pdf.js) ou 0–1 (PDF brut)
  const hx = (v) => Math.max(0, Math.min(255, Math.round(big ? v : v * 255))).toString(16).padStart(2, "0");
  if (args.length >= 3) return "#" + args.slice(0, 3).map(hx).join("");
  if (args.length === 1) { const g = hx(args[0]); return "#" + g + g + g; }
  return null;
}

export async function extractSegments(page, OPS) {
  const vp = page.getViewport({ scale: 1 });
  const base = vp.transform;                       // PDF → page (y vers le bas)
  const ol = await page.getOperatorList();
  const segs = [];
  let ctm = base.slice(), stack = [];
  let gs = { lw: 1, stroke: "#000000", fill: "#000000" }, gstack = [];
  let pending = [];                                // sous-chemins du chemin en construction : [[x,y], …] (closed)
  let shapesPending = [];                          // mêmes sous-chemins, courbes comprises : {pts, curves, closed}
  const shapes = [];
  let pid = 0;                                     // numéro du chemin peint : les bords d'un même polygone partagent le même pid
  const names = Object.fromEntries(Object.entries(OPS).map(([k, v]) => [v, k]));

  function buildPath(ops, coords) {
    let k = 0, cur = null, start = null, sub = [], full = [], curves = 0;
    const flush = (closed) => { if (sub.length > 1) pending.push({ pts: sub, closed }); sub = []; };
    const flushFull = (closed) => { if (full.length > 1) shapesPending.push({ pts: full, curves, closed }); full = []; curves = 0; };
    const bez = (p0, p1, p2, p3) => { for (let t = 1; t <= 8; t++) { const u = t / 8, v = 1 - u; full.push([v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0], v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1]]); } curves++; };
    for (const op of ops) {
      if (op === OPS.moveTo) { flush(false); flushFull(false); cur = apply(ctm, coords[k], coords[k + 1]); start = cur; sub = [cur]; full = [cur]; k += 2; }
      else if (op === OPS.lineTo) { cur = apply(ctm, coords[k], coords[k + 1]); sub.push(cur); full.push(cur); k += 2; }
      else if (op === OPS.curveTo) {                                                          // courbe : on coupe les segments
        const p1 = apply(ctm, coords[k], coords[k + 1]), p2 = apply(ctm, coords[k + 2], coords[k + 3]), p3 = apply(ctm, coords[k + 4], coords[k + 5]);
        if (cur) bez(cur, p1, p2, p3); cur = p3; flush(false); sub = [cur]; k += 6;
      }
      else if (op === OPS.curveTo2 || op === OPS.curveTo3) {
        const pa = apply(ctm, coords[k], coords[k + 1]), p3 = apply(ctm, coords[k + 2], coords[k + 3]);
        if (cur) bez(cur, op === OPS.curveTo2 ? cur : pa, op === OPS.curveTo2 ? pa : p3, p3); cur = p3; flush(false); sub = [cur]; k += 4;
      }
      else if (op === OPS.closePath) { if (start && sub.length) sub.push(start); if (start && full.length) full.push(start); flush(true); flushFull(true); sub = start ? [start] : []; full = start ? [start] : []; }
      else if (op === OPS.rectangle) {
        flush(false); flushFull(false);
        const [x, y, w, h] = [coords[k], coords[k + 1], coords[k + 2], coords[k + 3]]; k += 4;
        const p = [apply(ctm, x, y), apply(ctm, x + w, y), apply(ctm, x + w, y + h), apply(ctm, x, y + h)];
        pending.push({ pts: [...p, p[0]], closed: true, rect: true });
        shapesPending.push({ pts: [...p, p[0]], curves: 0, closed: true, rect: true });
      }
    }
    flush(false); flushFull(false);
  }

  function paint(mode) {   // mode : "stroke" | "fill" | "both"
    pid++;
    const scale = Math.sqrt(Math.abs(ctm[0] * ctm[3] - ctm[1] * ctm[2])) || 1;
    for (const p of pending) {
      // un remplissage ferme toujours la forme, même sans « closePath » dans le PDF
      if (mode !== "stroke" && p.pts.length > 2) {
        const f = p.pts[0], l = p.pts[p.pts.length - 1];
        if (Math.hypot(f[0] - l[0], f[1] - l[1]) > 0.05) p.pts = [...p.pts, f];
        p.closed = true;
      }
      for (let i = 0; i + 1 < p.pts.length; i++) {
        const [x1, y1] = p.pts[i], [x2, y2] = p.pts[i + 1];
        if (Math.hypot(x2 - x1, y2 - y1) < 0.05) continue;
        segs.push({ x1, y1, x2, y2, pid, lw: gs.lw * scale, stroke: mode !== "fill" ? gs.stroke : null, fill: mode !== "stroke" ? gs.fill : null, closed: p.closed, rect: !!p.rect });
      }
    }
    pending = [];
    for (const p of shapesPending) {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const [x, y] of p.pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      shapes.push({ pid, pts: p.pts, curves: p.curves, closed: p.closed || mode !== "stroke", rect: !!p.rect, x0, y0, x1, y1,
        lw: gs.lw * scale, stroke: mode !== "fill" ? gs.stroke : null, fill: mode !== "stroke" ? gs.fill : null });
    }
    shapesPending = [];
  }

  for (let i = 0; i < ol.fnArray.length; i++) {
    const fn = ol.fnArray[i], args = ol.argsArray[i];
    switch (fn) {
      case OPS.save: stack.push(ctm.slice()); gstack.push({ ...gs }); break;
      case OPS.restore: if (stack.length) { ctm = stack.pop(); gs = gstack.pop(); } break;
      case OPS.transform: ctm = mul(ctm, args); break;
      case OPS.paintFormXObjectBegin: stack.push(ctm.slice()); gstack.push({ ...gs }); if (args && args[0]) ctm = mul(ctm, args[0]); break;
      case OPS.paintFormXObjectEnd: if (stack.length) { ctm = stack.pop(); gs = gstack.pop(); } break;
      case OPS.setLineWidth: gs.lw = args[0]; break;
      case OPS.setStrokeRGBColor: case OPS.setStrokeGray: case OPS.setStrokeColor: case OPS.setStrokeCMYKColor: { const c = colorArg(args); if (c) gs.stroke = c; break; }
      case OPS.setFillRGBColor: case OPS.setFillGray: case OPS.setFillColor: case OPS.setFillCMYKColor: { const c = colorArg(args); if (c) gs.fill = c; break; }
      case OPS.constructPath: buildPath(args[0], args[1]); break;
      case OPS.stroke: case OPS.closeStroke: paint("stroke"); break;
      case OPS.fill: case OPS.eoFill: paint("fill"); break;
      case OPS.fillStroke: case OPS.eoFillStroke: case OPS.closeFillStroke: case OPS.closeEOFillStroke: paint("both"); break;
      case OPS.endPath: pending = []; shapesPending = []; break;
      default: void names; break;
    }
  }
  return { segs, shapes, width: vp.width, height: vp.height };
}
