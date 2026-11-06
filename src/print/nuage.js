// Lot 9 (06/11/2026, fiche FA-05) — « nuage » et « indice de révision », les mots du BE (FTZ).
// Un nuage entoure une zone modifiée du plan ; le triangle porte l'indice de la révision (A, B, C…).
// Pur : mêmes points pour l'écran (SVG, mètres) et l'impression (jsPDF, mm). Rien sur le DOM.

// rectangle normalisé
export function rectOf(q) { return { x0: Math.min(q.x0, q.x1), y0: Math.min(q.y0, q.y1), x1: Math.max(q.x0, q.x1), y1: Math.max(q.y0, q.y1) }; }

// festons le long du contour : liste de [départ, arrivée] sur le rectangle, longueur ≈ r × 2 (au moins 2 par côté)
export function scallops(q, r) {
  const R = rectOf(q), C = [[R.x0, R.y0], [R.x1, R.y0], [R.x1, R.y1], [R.x0, R.y1]], out = [];
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = C[i], [bx, by] = C[(i + 1) % 4], L = Math.hypot(bx - ax, by - ay), n = Math.max(2, Math.round(L / (2 * r)));
    for (let k = 0; k < n; k++) out.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n, ax + (bx - ax) * (k + 1) / n, ay + (by - ay) * (k + 1) / n]);
  }
  return out;
}

// chemin SVG (arcs vers l'extérieur ; le contour tourne dans le sens horaire en y vers le bas)
export function cloudPath(q, r = 0.18) {
  const S = scallops(q, r);
  if (!S.length) return "";
  let d = `M${S[0][0].toFixed(3)} ${S[0][1].toFixed(3)}`;
  for (const [ax, ay, bx, by] of S) { const h = Math.hypot(bx - ax, by - ay) / 2; d += `A${h.toFixed(3)} ${h.toFixed(3)} 0 0 1 ${bx.toFixed(3)} ${by.toFixed(3)}`; }
  return d + "Z";
}

// points d'un feston (demi-cercle extérieur), pour l'impression : [[x, y]…]
export function cloudPoints(q, r = 0.18, steps = 8) {
  const R = rectOf(q), cx = (R.x0 + R.x1) / 2, cy = (R.y0 + R.y1) / 2, P = [];
  for (const [ax, ay, bx, by] of scallops(q, r)) {
    const mx = (ax + bx) / 2, my = (ay + by) / 2, h = Math.hypot(bx - ax, by - ay) / 2, a0 = Math.atan2(ay - my, ax - mx);
    // sens : le milieu de l'arc doit être du côté opposé au centre du rectangle
    const s = ((mx - cx) * Math.cos(a0 + Math.PI / 2) + (my - cy) * Math.sin(a0 + Math.PI / 2)) > 0 ? 1 : -1;
    for (let k = 0; k <= steps; k++) { const a = a0 + s * Math.PI * k / steps; P.push([mx + h * Math.cos(a), my + h * Math.sin(a)]); }
  }
  return P;
}

// triangle de l'indice, posé sur l'angle haut droit (taille t) : sommets + centre du texte
export function indiceMark(q, t = 0.45) {
  const R = rectOf(q), x = R.x1, y = R.y0 - t * 0.15;
  return { pts: [[x - t / 2, y], [x + t / 2, y], [x, y - t * 0.87]], tx: x, ty: y - t * 0.3, size: t * 0.5 };
}

// indice suivant (A → B, Z → AA) ; vide → A
export function nextIndice(i) {
  const s = String(i || "").toUpperCase().replace(/[^A-Z]/g, "");
  if (!s) return "A";
  const a = s.split("");
  for (let k = a.length - 1; k >= 0; k--) { if (a[k] !== "Z") { a[k] = String.fromCharCode(a[k].charCodeAt(0) + 1); return a.join(""); } a[k] = "A"; }
  return "A" + a.join("");
}

// distance d'un point au contour du nuage (pour le cliquer)
export function nearCloud(q, x, y) {
  const R = rectOf(q), dx = Math.max(R.x0 - x, 0, x - R.x1), dy = Math.max(R.y0 - y, 0, y - R.y1);
  if (dx || dy) return Math.hypot(dx, dy);
  return Math.min(x - R.x0, R.x1 - x, y - R.y0, R.y1 - y);
}
