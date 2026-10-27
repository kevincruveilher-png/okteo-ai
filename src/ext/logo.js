// Logo KiTéOHM (v50) : fichier fourni par Kévin, rogné (public/assets/kiteohm-logo.png, transparent ; .jpg sur fond blanc
// pour les PDF). Chargé une fois, en data URL, pour jsPDF. Proportions : 900 × 189.
export const LOGO_RATIO = 900 / 189;
let cache = null;
export function logoData() {
  if (!cache) cache = fetch("assets/kiteohm-logo.jpg").then((r) => (r.ok ? r.blob() : null)).then((b) => b && new Promise((res) => { const f = new FileReader(); f.onload = () => res(f.result); f.readAsDataURL(b); })).catch(() => null);
  return cache;
}
