// Sortie PDF imprimable du plan (vectorielle, à l'échelle exacte) : page 1 = plan + légende + échelle graphique
// + cartouche ; page 2 = nomenclature (appareils par pièce, surfaces) et liste des appareils.
// Unités jsPDF : millimètres. Échelle 1:N → 1 m réel = 1000/N mm sur le papier.

export const PAPERS = { A4: [297, 210], A3: [420, 297] };
const AUTO = [["A4", 50], ["A3", 50], ["A4", 75], ["A3", 75], ["A4", 100], ["A3", 100], ["A3", 125], ["A3", 150], ["A3", 200]];
const MARGIN = 10, BAND = 44;                       // marge, bandeau bas (légende + cartouche)
const SHORT = { PC16: "16", PC20: "20", RJ45: "RJ", VMC: "V", TAB: "TD" };
const COLS = ["PC16", "PC20", "RJ45", "LUM", "APP", "SPOT", "INT", "VV", "BP", "VMC", "SC", "TAB"];
const COLNAME = { PC16: "16 A", PC20: "20 A", RJ45: "RJ45", LUM: "Point", APP: "Appl.", SPOT: "Spot", INT: "Int.", VV: "VV", BP: "BP", VMC: "VMC", SC: "SC", TAB: "TD" };
const fr = (v, d = 2) => v.toFixed(d).replace(".", ",");

let lib = null;
async function jspdf() { if (!lib) lib = (await import("jspdf")).jsPDF; return lib; }

export function extentOf(geo) {
  const pts = [...geo.walls.flat(), ...geo.apps.map((a) => ({ x: a.x, y: a.y })), ...geo.rooms.flatMap((r) => r.poly)];
  if (!pts.length && geo.fond) pts.push({ x: geo.fond.x, y: geo.fond.y }, { x: geo.fond.x + geo.fond.w, y: geo.fond.y + geo.fond.h });
  if (!pts.length) return { x0: 0, y0: 0, x1: 10, y1: 8 };
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y), pad = 0.6;
  return { x0: Math.min(...xs) - pad, y0: Math.min(...ys) - pad, x1: Math.max(...xs) + pad, y1: Math.max(...ys) + pad };
}

// choix format / orientation / échelle ; `fits` = le plan entre dans la zone de dessin
export function layoutPlan(geo, { paper = "auto", orient = "auto", scale = "auto" } = {}) {
  const ext = extentOf(geo), ew = ext.x1 - ext.x0, eh = ext.y1 - ext.y0;
  const tries = [];
  const papers = paper === "auto" ? ["A4", "A3"] : [paper];
  const scales = scale === "auto" ? null : [+scale];
  const list = scales ? papers.flatMap((p) => scales.map((s) => [p, s])) : AUTO.filter(([p]) => papers.includes(p));
  for (const [p, s] of list) {
    const [L, S] = PAPERS[p];
    for (const o of orient === "auto" ? ["paysage", "portrait"] : [orient]) {
      const W = o === "paysage" ? L : S, H = o === "paysage" ? S : L;
      const area = { x: MARGIN, y: MARGIN, w: W - 2 * MARGIN, h: H - 2 * MARGIN - BAND };
      const f = 1000 / s, fits = ew * f <= area.w && eh * f <= area.h;
      tries.push({ paper: p, orient: o, W, H, scale: s, f, area, fits, ext });
    }
  }
  return tries.find((t) => t.fits) || tries.sort((a, b) => Math.min(b.area.w / (ew * b.f), b.area.h / (eh * b.f)) - Math.min(a.area.w / (ew * a.f), a.area.h / (eh * a.f)))[0];
}

async function toDataURL(url) {
  const b = await (await fetch(url)).blob();
  return await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });
}

export async function buildPlanPdf(geo, opts = {}) {
  const o = { fond: false, cotes: true, reperes: true, liaisons: true, nomenclature: true, date: new Date(), ...opts };
  const Lay = layoutPlan(geo, o);
  const JsPDF = await jspdf();
  const doc = new JsPDF({ orientation: Lay.W > Lay.H ? "landscape" : "portrait", unit: "mm", format: Lay.paper.toLowerCase() });
  const { area, f, ext } = Lay;
  const cx = (ext.x0 + ext.x1) / 2, cy = (ext.y0 + ext.y1) / 2;
  const X = (x) => area.x + area.w / 2 + (x - cx) * f, Y = (y) => area.y + area.h / 2 + (y - cy) * f;
  const pt = (mm) => mm * 72 / 25.4;                 // taille de police (pt) pour une hauteur en mm
  const poly = (P, style) => {
    if (P.length < 3) return;
    const v = []; for (let i = 1; i < P.length; i++) v.push([X(P[i].x) - X(P[i - 1].x), Y(P[i].y) - Y(P[i - 1].y)]);
    doc.lines(v, X(P[0].x), Y(P[0].y), [1, 1], style, true);
  };
  const line = (a, b) => doc.line(X(a.x), Y(a.y), X(b.x), Y(b.y));
  doc.setFont("helvetica", "normal");
  doc.setProperties({ title: `Plan électrique ${geo.chantier.nom} ${geo.chantier.numero}`.trim(), creator: "Oktéo AI — KiTéOHM" });

  // ---------- zone de dessin (découpée) ----------
  doc.saveGraphicsState();
  doc.rect(area.x, area.y, area.w, area.h, null); doc.clip(); doc.discardPath();
  if (o.fond && geo.fond) {
    try {
      const img = await toDataURL(geo.fond.url);
      doc.setGState(new doc.GState({ opacity: 0.3 }));
      doc.addImage(img, "JPEG", X(geo.fond.x), Y(geo.fond.y), geo.fond.w * f, geo.fond.h * f, undefined, "FAST");
      doc.setGState(new doc.GState({ opacity: 1 }));
    } catch { /* fond illisible : plan sans fond */ }
  }
  // pièces : fond très clair
  doc.setFillColor(242, 246, 249);
  geo.rooms.forEach((r) => poly(r.poly, "F"));
  // murs
  doc.setFillColor(60, 60, 60); doc.setDrawColor(60, 60, 60); doc.setLineWidth(0.05);
  geo.walls.forEach((P) => poly(P, "F"));
  geo.joints.forEach((j) => doc.rect(X(j.x - j.e / 2), Y(j.y - j.e / 2), j.e * f, j.e * f, "F"));
  // limites de pièce (sans mur) : trait fin en pointillés
  if (geo.limits && geo.limits.length) {
    doc.setDrawColor(150, 150, 150); doc.setLineWidth(0.1); doc.setLineDashPattern([0.6, 0.6], 0);
    geo.limits.forEach((l) => doc.line(X(l.a.x), Y(l.a.y), X(l.b.x), Y(l.b.y)));
    doc.setLineDashPattern([], 0);
  }
  // ouvertures
  doc.setDrawColor(40, 40, 40);
  geo.openings.forEach((op) => {
    const e2 = op.ep / 2, n = op.n;
    if (op.kind === "fenetre") {
      doc.setLineWidth(0.2);
      line({ x: op.j1.x + n.x * e2, y: op.j1.y + n.y * e2 }, { x: op.j2.x + n.x * e2, y: op.j2.y + n.y * e2 });
      line({ x: op.j1.x - n.x * e2, y: op.j1.y - n.y * e2 }, { x: op.j2.x - n.x * e2, y: op.j2.y - n.y * e2 });
      doc.setLineWidth(0.1); line(op.j1, op.j2);
    } else {
      doc.setLineWidth(0.25); line(op.hinge, op.leaf);
      doc.setLineWidth(0.12); doc.setLineDashPattern([0.8, 0.6], 0);
      for (let i = 1; i < op.arc.length; i++) line(op.arc[i - 1], op.arc[i]);
      doc.setLineDashPattern([], 0);
    }
  });
  // cotes des murs
  if (o.cotes) {
    doc.setTextColor(110, 110, 110); doc.setFontSize(6);
    geo.wallDims.forEach((d) => {
      if (d.L < 0.5) return;
      let a = -d.ang * 180 / Math.PI; if (a > 90 || a <= -90) a += 180;
      doc.text(fr(d.L), X(d.x), Y(d.y), { align: "center", baseline: "middle", angle: a });
    });
    doc.setDrawColor(60, 90, 160); doc.setTextColor(60, 90, 160); doc.setLineWidth(0.15);
    geo.dims.forEach((d) => {
      line(d.a, d.b);
      const ux = (d.b.x - d.a.x) / (d.L || 1), uy = (d.b.y - d.a.y) / (d.L || 1), t = 0.12;
      [d.a, d.b].forEach((p) => line({ x: p.x - uy * t, y: p.y + ux * t }, { x: p.x + uy * t, y: p.y - ux * t }));
      let a = -Math.atan2(uy, ux) * 180 / Math.PI; if (a > 90 || a <= -90) a += 180;
      doc.text(fr(d.L), X((d.a.x + d.b.x) / 2 - uy * 0.18), Y((d.a.y + d.b.y) / 2 + ux * 0.18), { align: "center", baseline: "middle", angle: a });
    });
  }
  // noms et surfaces des pièces : décalés si un appareil (la lumière centrale, souvent) est dessous
  doc.setTextColor(30, 30, 30);
  const inPoly = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; };
  const clear = (x, y) => !geo.apps.some((a) => Math.abs(a.x - x) < 1.1 && Math.abs(a.y - y) < 0.55);
  geo.rooms.forEach((r) => {
    if (!clear(r.label.x, r.label.y)) {
      const tries = [[0, -0.75], [0, 0.75], [0, -1.3], [0, 1.3], [-1.2, 0], [1.2, 0]].map(([dx, dy]) => ({ x: r.label.x + dx, y: r.label.y + dy }));
      const ok = tries.find((q) => inPoly(q.x, q.y, r.poly) && clear(q.x, q.y)) || tries.find((q) => inPoly(q.x, q.y, r.poly));
      if (ok) r = { ...r, label: ok };
    }
    doc.setFont("helvetica", "bold"); doc.setFontSize(Math.max(6, Math.min(11, 0.5 * f * 2.83)));
    doc.text(r.name, X(r.label.x), Y(r.label.y), { align: "center", baseline: "bottom" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(Math.max(5, Math.min(8, 0.34 * f * 2.83)));
    doc.text(`${fr(r.area, 1)} m²`, X(r.label.x), Y(r.label.y) + 0.8, { align: "center", baseline: "top" });
  });
  // liaisons commande → lumière
  if (o.liaisons && geo.links.length) {
    doc.setDrawColor(50, 90, 200); doc.setLineWidth(0.15); doc.setLineDashPattern([1.2, 0.8], 0);
    geo.links.forEach((l) => line(l.a, l.b));
    doc.setLineDashPattern([], 0);
  }
  // appareils
  const u = geo.symU * f;                            // unité de symbole en mm
  geo.apps.forEach((a) => symbol(doc, a.t, X(a.x), Y(a.y), u));
  if (o.reperes) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(Math.max(5, pt(u * 0.9))); doc.setTextColor(200, 70, 40);
    geo.apps.forEach((a) => {
      doc.text(a.rep || "", X(a.x) + u * 1.1, Y(a.y) - u * 0.9, { baseline: "bottom" });
      if (a.h != null && a.h !== a.hDef) { doc.setFont("helvetica", "normal"); doc.text(`h ${fr(a.h / 100)}`, X(a.x) + u * 1.1, Y(a.y) + u * 1.6, { baseline: "bottom" }); doc.setFont("helvetica", "bold"); }
    });
  }
  doc.restoreGraphicsState();
  doc.setDrawColor(0); doc.setLineWidth(0.3); doc.rect(area.x, area.y, area.w, area.h);

  // ---------- bandeau : légende, échelle graphique, cartouche ----------
  const by = Lay.H - MARGIN - BAND + 4, bh = BAND - 4;
  const present = COLS.filter((t) => geo.apps.some((a) => a.t === t));
  const cartW = 128, legW = Lay.W - 2 * MARGIN - cartW - 4;
  doc.setLineWidth(0.25); doc.rect(MARGIN, by, legW, bh);
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(0);
  doc.text("LÉGENDE", MARGIN + 3, by + 5);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7);
  const perCol = 5, colW = 46;
  present.forEach((t, i) => {
    const c = Math.floor(i / perCol), r = i % perCol, x = MARGIN + 6 + c * colW, y = by + 10 + r * 5.6;
    if (x + colW > MARGIN + legW - 50) return;
    symbol(doc, t, x, y, 2.2);
    doc.setTextColor(0); doc.setFontSize(7); doc.setFont("helvetica", "normal");
    doc.text(`${geo.apps.find((a) => a.t === t).name}  × ${geo.apps.filter((a) => a.t === t).length}`, x + 4, y, { baseline: "middle" });
  });
  if (!present.length) { doc.setTextColor(120); doc.text("Aucun appareil posé.", MARGIN + 6, by + 11); }
  // échelle graphique (0 – 1 – 2 – 5 m)
  const sx = MARGIN + legW - 46, sy = by + bh - 8, m1 = f;
  doc.setTextColor(0); doc.setFontSize(6.5); doc.setLineWidth(0.2); doc.setDrawColor(0);
  const steps = [0, 1, 2, 5].filter((v) => v * m1 <= 42);
  for (let i = 0; i + 1 < steps.length; i++) { doc.setFillColor(i % 2 ? 255 : 0); doc.rect(sx + steps[i] * m1, sy, (steps[i + 1] - steps[i]) * m1, 1.6, "FD"); }
  steps.forEach((v) => doc.text(`${v}`, sx + v * m1, sy - 1, { align: "center" }));
  doc.text("m", sx + steps[steps.length - 1] * m1 + 2.5, sy + 1.4);
  doc.setFont("helvetica", "bold"); doc.text(`ÉCHELLE 1:${Lay.scale}`, sx, sy + 5.5);
  // cartouche
  const kx = Lay.W - MARGIN - cartW;
  doc.setFont("helvetica", "normal"); doc.setLineWidth(0.3); doc.rect(kx, by, cartW, bh);
  doc.setFillColor(30, 45, 60); doc.rect(kx, by, cartW, 8, "F");
  doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  doc.text("PLAN ÉLECTRIQUE — IMPLANTATION", kx + 3, by + 5.3);
  doc.setFontSize(7); doc.text("KiTéOHM · Oktéo AI", kx + cartW - 3, by + 5.3, { align: "right" });
  const ch = geo.chantier, d = o.date;
  const rows = [
    ["Chantier", `${ch.nom}${ch.numero ? "  ·  n° " + ch.numero : ""}`],
    ["Pavillonneur", ch.client || "—"],
    ["Niveau", o.niveau || "RDC"],
    ["Échelle · format", `1:${Lay.scale}  ·  ${Lay.paper} ${Lay.orient}`],
    ["Date · indice", `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}  ·  ${o.indice || "A"}`],
  ];
  doc.setTextColor(0);
  rows.forEach(([k, v], i) => {
    const y = by + 13.5 + i * 5.6;
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); doc.setTextColor(110); doc.text(k, kx + 3, y);
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(0); doc.text(v, kx + 32, y);
    doc.setDrawColor(200); doc.setLineWidth(0.1); if (i < rows.length - 1) doc.line(kx + 2, y + 1.8, kx + cartW - 2, y + 1.8);
  });
  const totA = geo.rooms.reduce((s, r) => s + r.area, 0);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(90);
  doc.text(`${geo.rooms.length} pièces · ${fr(totA, 1)} m² habitables · ${geo.apps.length} appareils`, MARGIN + 3, by + bh - 2.5);
  if (!Lay.fits) { doc.setTextColor(200, 40, 40); doc.setFontSize(7); doc.text("Attention : le plan dépasse du cadre à cette échelle.", area.x + 2, area.y + 4); }

  // ---------- page 2 : nomenclature ----------
  if (o.nomenclature) {
    doc.addPage(Lay.paper.toLowerCase(), Lay.W > Lay.H ? "landscape" : "portrait");
    let y = MARGIN + 6;
    doc.setTextColor(0); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text(`Nomenclature — ${ch.nom}${ch.numero ? " · n° " + ch.numero : ""}`, MARGIN, y);
    y += 8;
    const names = [...geo.rooms.map((r) => r.name)];
    if (geo.apps.some((a) => !a.room)) names.push("Hors pièce");
    const colX = [MARGIN, MARGIN + 52, MARGIN + 70];
    const cw = Math.min(16, (Lay.W - 2 * MARGIN - 70 - 16) / COLS.length);
    const head = () => {
      doc.setFillColor(30, 45, 60); doc.rect(MARGIN, y - 4.5, Lay.W - 2 * MARGIN, 6.5, "F");
      doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
      doc.text("Pièce", colX[0] + 2, y); doc.text("Surface", colX[1] + 14, y, { align: "right" });
      COLS.forEach((t, i) => doc.text(COLNAME[t], colX[2] + i * cw + cw / 2, y, { align: "center" }));
      doc.text("Total", colX[2] + COLS.length * cw + 8, y, { align: "center" });
      doc.setTextColor(0); y += 6.5;
    };
    head();
    const tot = Object.fromEntries(COLS.map((t) => [t, 0]));
    names.forEach((nm, ri) => {
      if (y > Lay.H - MARGIN - 6) { doc.addPage(Lay.paper.toLowerCase(), Lay.W > Lay.H ? "landscape" : "portrait"); y = MARGIN + 6; head(); }
      const room = geo.rooms.find((r) => r.name === nm), apps = geo.apps.filter((a) => (a.room || "Hors pièce") === nm);
      if (ri % 2) { doc.setFillColor(244, 247, 250); doc.rect(MARGIN, y - 4.3, Lay.W - 2 * MARGIN, 6, "F"); }
      doc.setFont("helvetica", "normal"); doc.setFontSize(8);
      doc.text(nm, colX[0] + 2, y); doc.text(room ? `${fr(room.area, 1)} m²` : "", colX[1] + 14, y, { align: "right" });
      COLS.forEach((t, i) => { const n = apps.filter((a) => a.t === t).length; tot[t] += n; if (n) doc.text(String(n), colX[2] + i * cw + cw / 2, y, { align: "center" }); });
      doc.setFont("helvetica", "bold"); doc.text(String(apps.length), colX[2] + COLS.length * cw + 8, y, { align: "center" });
      y += 6;
    });
    doc.setDrawColor(0); doc.setLineWidth(0.3); doc.line(MARGIN, y - 4.3, Lay.W - MARGIN, y - 4.3);
    doc.setFont("helvetica", "bold"); doc.text("TOTAL", colX[0] + 2, y); doc.text(`${fr(totA, 1)} m²`, colX[1] + 14, y, { align: "right" });
    COLS.forEach((t, i) => doc.text(String(tot[t]), colX[2] + i * cw + cw / 2, y, { align: "center" }));
    doc.text(String(geo.apps.length), colX[2] + COLS.length * cw + 8, y, { align: "center" });
    y += 12;
    // liste des appareils
    if (geo.apps.length) {
      doc.setFontSize(10); doc.text("Appareils", MARGIN, y); y += 6;
      doc.setFontSize(7.5);
      const list = geo.apps.slice().sort((a, b) => (a.room || "~").localeCompare(b.room || "~") || String(a.rep).localeCompare(String(b.rep), "fr", { numeric: true }));
      const colsN = Lay.W > 300 ? 3 : 2, cwid = (Lay.W - 2 * MARGIN) / colsN, y0 = y;
      let col = 0;
      list.forEach((a) => {
        if (y > Lay.H - MARGIN - 4) { col++; y = y0; if (col >= colsN) { doc.addPage(Lay.paper.toLowerCase(), Lay.W > Lay.H ? "landscape" : "portrait"); col = 0; y = MARGIN + 6; } }
        const x = MARGIN + col * cwid;
        doc.setFont("helvetica", "bold"); doc.text(a.rep || "", x, y);
        doc.setFont("helvetica", "normal"); doc.text(`${a.name}${a.h != null ? ` · h ${fr(a.h / 100)} m` : " · plafond"} · ${a.room || "hors pièce"}`, x + 12, y);
        y += 4.6;
      });
    }
  }
  const blob = doc.output("blob");
  return { blob, layout: Lay, pages: doc.getNumberOfPages() };
}

// symboles normalisés simplifiés (mêmes formes qu'à l'écran) ; u = unité de symbole en mm
export function symbol(doc, t, x, y, u) {
  doc.setLineWidth(Math.max(0.12, u * 0.08)); doc.setDrawColor(20, 60, 110); doc.setFillColor(255, 255, 255);
  const txt = (s, white) => { doc.setFont("helvetica", "bold"); doc.setFontSize(Math.max(3.5, u * 0.85 * 72 / 25.4)); doc.setTextColor(white ? 255 : 20, white ? 255 : 60, white ? 255 : 110); doc.text(s, x, y + u * 0.05, { align: "center", baseline: "middle" }); };
  switch (t) {
    case "PC16": doc.circle(x, y, 0.9 * u, "FD"); txt(SHORT.PC16); break;
    case "PC20": doc.setFillColor(20, 60, 110); doc.circle(x, y, 0.9 * u, "FD"); txt(SHORT.PC20, true); break;
    case "RJ45": doc.roundedRect(x - 0.8 * u, y - 0.8 * u, 1.6 * u, 1.6 * u, 0.2 * u, 0.2 * u, "FD"); txt(SHORT.RJ45); break;
    case "APP": { const r = 0.9 * u; const n = 12, P = []; for (let i = 0; i <= n; i++) { const a = Math.PI + Math.PI * i / n; P.push([x + Math.cos(a) * r, y + 0.25 * u + Math.sin(a) * r]); }
      doc.lines(P.slice(1).map((p, i) => [p[0] - P[i][0], p[1] - P[i][1]]), P[0][0], P[0][1], [1, 1], "FD", true); doc.line(x - 0.55 * u, y - 0.3 * u, x + 0.55 * u, y + 0.25 * u); doc.line(x + 0.55 * u, y - 0.3 * u, x - 0.55 * u, y + 0.25 * u); break; }
    case "LUM": doc.circle(x, y, 0.9 * u, "FD"); doc.line(x - 0.6 * u, y - 0.6 * u, x + 0.6 * u, y + 0.6 * u); doc.line(x + 0.6 * u, y - 0.6 * u, x - 0.6 * u, y + 0.6 * u); break;
    case "SPOT": doc.circle(x, y, 0.6 * u, "FD"); doc.setFillColor(20, 60, 110); doc.circle(x, y, 0.22 * u, "F"); break;
    case "INT": doc.circle(x, y, 0.55 * u, "FD"); doc.line(x + 0.35 * u, y - 0.35 * u, x + 0.95 * u, y - 0.95 * u); break;
    case "VV": doc.circle(x, y, 0.55 * u, "FD"); doc.line(x + 0.35 * u, y - 0.35 * u, x + 0.95 * u, y - 0.95 * u); doc.line(x - 0.1 * u, y + 0.3 * u, x + 0.5 * u, y - 0.3 * u); break;
    case "BP": doc.circle(x, y, 0.55 * u, "FD"); doc.setFillColor(20, 60, 110); doc.circle(x, y, 0.2 * u, "F"); break;
    case "VMC": doc.roundedRect(x - 0.8 * u, y - 0.8 * u, 1.6 * u, 1.6 * u, 0.3 * u, 0.3 * u, "FD"); txt(SHORT.VMC); break;
    case "SC": doc.circle(x, y, 0.6 * u, "FD"); doc.line(x - 0.85 * u, y - 0.85 * u, x + 0.85 * u, y + 0.85 * u); doc.line(x + 0.85 * u, y - 0.85 * u, x - 0.85 * u, y + 0.85 * u); break;
    case "TAB": doc.setFillColor(20, 60, 110); doc.roundedRect(x - u, y - 1.2 * u, 2 * u, 2.4 * u, 0.2 * u, 0.2 * u, "FD"); txt(SHORT.TAB, true); break;
    default: doc.circle(x, y, 0.8 * u, "FD");
  }
}
