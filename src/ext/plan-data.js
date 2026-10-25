// Ce que l'IA reçoit du plan : une description chiffrée (objets, positions, pièces) + une image.

const r2 = (v) => Math.round(v * 100) / 100;

function roomOfPoint(api, x, y) {
  const r = api.roomAt(x, y);
  return r ? r.id : null;
}

export function planSummary(api) {
  const S = api.state, reps = api.repMap();
  const nodes = Object.fromEntries(S.nodes.map((n) => [n.id, n]));
  const rooms = S.rooms.map((r) => {
    const w = Math.abs(r.x1 - r.x0), h = Math.abs(r.y1 - r.y0);
    return { id: r.id, nom: r.name, x0: r2(Math.min(r.x0, r.x1)), y0: r2(Math.min(r.y0, r.y1)), largeur_m: r2(w), profondeur_m: r2(h), surface_m2: r2(w * h) };
  });
  const app = S.app.map((a) => ({
    id: a.id, repere: reps[a.id], type: a.t, nom: api.TYPES[a.t]?.n, x: r2(a.x), y: r2(a.y),
    hauteur_cm: a.h ?? "plafond", sur_mur: a.seg || null, piece: roomOfPoint(api, a.x, a.y),
  }));
  const murs = S.segs.map((s) => {
    const a = nodes[s.a], b = nodes[s.b];
    return a && b ? { id: s.id, x1: r2(a.x), y1: r2(a.y), x2: r2(b.x), y2: r2(b.y), longueur_m: r2(Math.hypot(b.x - a.x, b.y - a.y)) } : null;
  }).filter(Boolean);
  const ouvertures = S.openings.map((o) => ({ id: o.id, type: o.kind, mur: o.seg, largeur_m: o.w }));
  const liaisons = S.lia.map((l) => ({ commande: l.c, commande_repere: reps[l.c], lumiere: l.l, lumiere_repere: reps[l.l] }));
  const parType = {};
  S.app.forEach((a) => { parType[a.t] = (parType[a.t] || 0) + 1; });
  return {
    chantier: api.chantier,
    unites: "mètres ; origine en haut à gauche ; x vers la droite, y vers le bas",
    epaisseur_murs_m: S.wallEp,
    totaux: { pieces: rooms.length, murs: murs.length, ouvertures: ouvertures.length, appareils: app.length, liaisons: liaisons.length, appareils_par_type: parType },
    pieces: rooms, appareils: app, liaisons, ouvertures, murs,
  };
}

// ---------- image du plan ----------
// On recadre sur tout le dessin, on copie le SVG en remplaçant les variables de couleur par leur valeur,
// on y incruste le fond de plan, puis on le dessine dans un canvas → JPEG.

async function toDataURL(url) {
  const r = await fetch(url); const b = await r.blob();
  return await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); });
}

function cssText() {
  let t = "";
  for (const sh of document.styleSheets) {
    try { for (const rule of sh.cssRules) t += rule.cssText + "\n"; } catch { /* feuille externe (polices) : ignorée */ }
  }
  return t;
}

export async function planImage(api, { width = 1600, maxB64 = 0 } = {}) {
  const sv = api.sv;
  const saved = { ...api.view };
  const e = api.extent();                      // tout le dessin ET tout le fond de plan dans le cadre
  api.zoomToBox(e.x0, e.y0, e.x1, e.y1);
  const vb = sv.getAttribute("viewBox").split(/\s+/).map(Number);
  const clone = sv.cloneNode(true);
  api.view = saved; api.draw();               // l'utilisateur garde sa vue

  const height = Math.round(width * vb[3] / vb[2]);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", width); clone.setAttribute("height", height);
  clone.querySelectorAll("image").forEach((im) => im.setAttribute("data-src", im.getAttribute("href")));
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = cssText();
  clone.insertBefore(style, clone.firstChild);

  let s = new XMLSerializer().serializeToString(clone);
  const cs = getComputedStyle(document.documentElement);
  // valeurs sans guillemets doubles : elles atterrissent aussi dans des attributs (ex. polices "Inter", …)
  s = s.replace(/var\(\s*(--[\w-]+)\s*(?:,[^()]*)?\)/g, (m, name) => (cs.getPropertyValue(name).trim() || "#888").replace(/"/g, "'"));
  // fond de plan incrusté (sinon l'image SVG ne peut pas le charger)
  const hrefs = [...s.matchAll(/data-src="([^"]+)"/g)].map((m) => m[1]);
  for (const h of new Set(hrefs)) {
    if (h.startsWith("data:")) continue;
    try { const d = await toDataURL(h); s = s.split(`href="${h}"`).join(`href="${d}"`); } catch { /* fond absent : on continue */ }
  }

  const blobUrl = URL.createObjectURL(new Blob([s], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error("Rendu de l'image du plan impossible")); img.src = blobUrl; });
    const c = document.createElement("canvas"); c.width = width; c.height = height;
    const g = c.getContext("2d");
    g.fillStyle = cs.getPropertyValue("--bg").trim() || "#fff"; g.fillRect(0, 0, width, height);
    g.drawImage(img, 0, 0, width, height);
    let url = c.toDataURL("image/jpeg", 0.85);
    // fournisseur avec limite de poids : on baisse la qualité, puis la taille, jusqu'à passer
    for (let q = 0.7, cur = c; maxB64 && url.length > maxB64 && cur.width > 500; q -= 0.12) {
      if (q < 0.45) { const s2 = document.createElement("canvas"); s2.width = Math.round(cur.width * 0.8); s2.height = Math.round(cur.height * 0.8); s2.getContext("2d").drawImage(cur, 0, 0, s2.width, s2.height); cur = s2; q = 0.7; }
      url = cur.toDataURL("image/jpeg", Math.max(0.45, q));
    }
    return { type: "image/jpeg", data: url.split(",")[1], url, width, height };
  } finally { URL.revokeObjectURL(blobUrl); }
}
