// v76 : mesures d'une image de plan en niveaux de gris (pur, sans DOM) pour la recommandation de mode (ai-modes.js).
// gray = Uint8Array w × h ; → { contrast (95e − 2e centile), ink (part d'encre), noise (part d'encre isolée), skew (°) }
export function imageStats(gray, w, h) {
  const n = w * h, hist = new Uint32Array(256);
  let ink = 0, iso = 0;
  for (let i = 0; i < n; i++) hist[gray[i]]++;
  const pct = (p) => { let c = 0; for (let v = 0; v < 256; v++) { c += hist[v]; if (c >= p * n) return v; } return 255; };
  const lo = pct(0.02), hi = pct(0.95), thr = Math.min(160, (lo + hi) / 2);
  const pts = [];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x; if (gray[i] >= thr) continue;
    ink++; if (pts.length < 60000 && (i % 3 === 0)) pts.push(x, y);
    let nb = 0; for (const d of [-w - 1, -w, -w + 1, -1, 1, w - 1, w, w + 1]) if (gray[i + d] < thr) nb++;
    if (nb <= 1) iso++;
  }
  // inclinaison : angle qui rend le profil horizontal des points d'encre le plus « piqué » (somme des carrés)
  const score = (deg) => { const a = -deg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), bins = new Map(); for (let k = 0; k < pts.length; k += 2) { const yy = Math.round(pts[k] * sa + pts[k + 1] * ca); bins.set(yy, (bins.get(yy) || 0) + 1); } let s = 0; for (const v of bins.values()) s += v * v; return s; };
  let best = 0, bs = score(0);
  if (pts.length > 400) for (let d = -4; d <= 4.001; d += 0.25) { const sc = score(d); if (sc > bs * 1.03) { bs = sc; best = d; } }
  return { contrast: hi - lo, ink: ink / n, noise: ink ? iso / ink : 0, skew: Math.round(best * 100) / 100 };
}

