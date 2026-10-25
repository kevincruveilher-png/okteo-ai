// Sauvegarde sûre :
// 1. le navigateur est prié de ne jamais effacer les données d'Oktéo (stockage « persistant ») ;
// 2. sauvegarde automatique : une copie .okteo du chantier ouvert est écrite dans un dossier du PC choisi une fois
//    (Chrome / Edge), 20 s après la dernière modification, et quand on quitte la page ;
// 3. si l'enregistrement dans le navigateur échoue, une alerte le dit et propose d'enregistrer le fichier tout de suite.
import * as CHS from "../chantiers.js";
import { buildOkteo, download, fileName } from "./okteo-file.js";
import { esc, store, storeSet } from "./util.js";

const KEY = "okteo.backup.v1";
const DELAY = 20000;
let api = null, dir = null, perm = "none", timer = null, pending = false, busy = false;
let info = store(KEY, { dir: "", last: {} });
const listeners = new Set();
const changed = () => listeners.forEach((f) => f());

export const supported = () => typeof window.showDirectoryPicker === "function";
const hhmm = (t) => new Date(t).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

async function permission(h, ask) {
  if (!h) return "none";
  try {
    const q = h.queryPermission ? await h.queryPermission({ mode: "readwrite" }) : "granted";
    if (q === "granted" || !ask) return q;
    return await h.requestPermission({ mode: "readwrite" });
  } catch { return "denied"; }
}

async function setDir(h, { remember = true } = {}) {
  dir = h; perm = await permission(h, false);
  info.dir = h ? h.name : ""; storeSet(KEY, info);
  if (remember) { try { await CHS.putFile("backup:dir", h); } catch { /* handle non mémorisable (tests) */ } }
  changed(); paintChip();
  if (perm === "granted") await now();
}

export async function choose() {
  if (!supported()) return false;
  let h; try { h = await window.showDirectoryPicker({ id: "okteo-sauvegardes", mode: "readwrite" }); } catch { return false; }
  await setDir(h); return true;
}

export async function reactivate() { perm = await permission(dir, true); changed(); paintChip(); if (perm === "granted") await now(); return perm === "granted"; }

export async function stop() { dir = null; perm = "none"; info.dir = ""; storeSet(KEY, info); try { await CHS.delFile("backup:dir"); } catch { /* */ } changed(); paintChip(); }

// écrit la copie du chantier ouvert dans le dossier (si actif) ; renvoie true si c'est fait
export async function now() {
  clearTimeout(timer); pending = false;
  if (!dir || perm !== "granted" || busy) return false;
  busy = true;
  try {
    const c = api.ch, blob = await buildOkteo(c, api.packData());
    const fh = await dir.getFileHandle(fileName(c), { create: true });
    const w = await fh.createWritable(); await w.write(blob); await w.close();
    info.last[c.id] = Date.now(); storeSet(KEY, info);
    return true;
  } catch (e) {
    perm = /permission|not allowed|NotAllowed/i.test(String(e)) ? "prompt" : perm;
    info.error = String(e.message || e); storeSet(KEY, info);
    return false;
  } finally { busy = false; changed(); paintChip(); }
}

function schedule() { if (!dir || perm !== "granted") return; pending = true; clearTimeout(timer); timer = setTimeout(now, DELAY); }

export function status() {
  const last = api && info.last[api.ch.id];
  return { supported: supported(), dir: info.dir, active: !!dir && perm === "granted", needsPermission: !!dir && perm !== "granted", last: last || null, pending };
}

function paintChip() {
  const el = document.getElementById("bkp"); if (!el) return;
  const s = status();
  el.hidden = !s.dir;
  el.className = "bkp" + (s.needsPermission ? " warn" : "");
  el.textContent = s.needsPermission ? "⚠ copie à réactiver" : s.last ? `copie ${hhmm(s.last)}` : "copie…";
  el.title = s.needsPermission ? `Sauvegarde automatique dans « ${s.dir} » en pause : cliquez pour la réactiver (le navigateur redemande l'autorisation à chaque ouverture).`
    : `Sauvegarde automatique : une copie .okteo est écrite dans le dossier « ${s.dir} » 20 s après chaque modification.`;
}

// ---------- encart de la page Chantiers ----------
export function backupBox() {
  const s = status();
  if (!s.supported) return `<section class="ch-bkp"><b>Sauvegarde automatique</b><p class="mut sm">Disponible avec Chrome ou Edge. Ici : utilisez le bouton <b>Fichier</b> de chaque chantier.</p></section>`;
  return `<section class="ch-bkp"><b>Sauvegarde automatique</b>
    ${!s.dir ? `<p class="mut sm">Une copie .okteo du chantier ouvert est écrite toute seule dans un dossier de votre PC (ou du réseau), 20 s après chaque modification. Si le navigateur perd ses données, rien n'est perdu.</p>
      <button class="on" id="bk-choose">Choisir le dossier de sauvegarde…</button>`
    : s.needsPermission ? `<p class="warn">En pause : le navigateur redemande l'autorisation d'écrire dans « ${esc(s.dir)} ».</p><button class="on" id="bk-react">Réactiver</button> <button id="bk-choose">Changer de dossier</button>`
    : `<p class="ok sm">✓ Active dans « ${esc(s.dir)} »${s.last ? ` · dernière copie de ce chantier à ${hhmm(s.last)}` : ""}.</p>
      <button id="bk-now">Copier maintenant</button> <button id="bk-choose">Changer de dossier</button> <button id="bk-stop">Arrêter</button>`}
  </section>`;
}
export function wireBackupBox(root, rerender) {
  const on = (id, f) => { const b = root.querySelector(id); if (b) b.onclick = async () => { await f(); rerender(); }; };
  on("#bk-choose", choose); on("#bk-react", reactivate); on("#bk-now", now); on("#bk-stop", stop);
}
export const onChange = (f) => { listeners.add(f); return () => listeners.delete(f); };

// ---------- alerte d'échec d'enregistrement ----------
function alertCard(message) {
  let card = document.getElementById("save-alert");
  if (!card) {
    card = document.createElement("div"); card.id = "save-alert"; card.className = "wcard save-alert"; card.setAttribute("role", "alert");
    document.querySelector(".stage").appendChild(card);
  }
  const s = status();
  card.innerHTML = `<div class="wcard-h"><b>⚠ Dessin non enregistré</b><button class="wx" title="Fermer">✕</button></div>
    <p>L'enregistrement dans le navigateur a échoué (${esc(message)}). Vos dernières modifications sont seulement à l'écran.</p>
    <p class="mut sm">${s.active ? `La sauvegarde automatique continue dans « ${esc(s.dir)} ».` : "Enregistrez le chantier en fichier maintenant, puis libérez de la place (supprimez d'anciens chantiers après les avoir enregistrés en fichier)."}</p>
    <div class="wrow"><button class="on" id="sa-file">Enregistrer en fichier</button>${s.active ? `<button id="sa-copy">Copier dans le dossier</button>` : ""}</div>`;
  card.hidden = false;
  card.querySelector(".wx").onclick = () => { card.hidden = true; };
  card.querySelector("#sa-file").onclick = async () => { download(await buildOkteo(api.ch, api.packData()), fileName(api.ch)); };
  const cp = card.querySelector("#sa-copy"); if (cp) cp.onclick = () => now();
}

export async function initBackup(a) {
  api = a;
  try { await navigator.storage?.persist?.(); } catch { /* */ }
  const chip = document.querySelector("#savedot")?.parentElement;
  if (chip && !document.getElementById("bkp")) {
    chip.insertAdjacentHTML("afterend", `<button id="bkp" class="bkp" hidden></button>`);
    document.getElementById("bkp").onclick = async () => { if (status().needsPermission) await reactivate(); else api.setTab("chantiers"); };
  }
  try { const h = await CHS.getFile("backup:dir"); if (h && h.getFileHandle) { dir = h; perm = await permission(h, false); } } catch { /* */ }
  if (!dir && info.dir) { info.dir = ""; storeSet(KEY, info); }
  paintChip();
  document.addEventListener("okteo:saved", schedule);
  document.addEventListener("okteo:save-error", (e) => { alertCard(e.detail?.message || "stockage indisponible"); now(); });
  document.addEventListener("okteo:saved", (e) => { if (e.detail?.recovered) { const c = document.getElementById("save-alert"); if (c) c.hidden = true; } });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && pending) now(); });
  return { choose, reactivate, now, stop, status, setDir };
}
