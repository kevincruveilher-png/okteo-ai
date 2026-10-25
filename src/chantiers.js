// Registre des chantiers, partagé par le cœur (app.js) et les extensions.
// - la liste des chantiers (nom, numéro, pavillonneur, fond, statistiques) : localStorage "okteo.chantiers.v1"
// - le dessin de chaque chantier : localStorage, clé propre au chantier (champ `key`)
// - les gros fichiers (image du fond, PDF d'origine) : IndexedDB "okteo", magasin "files"
//   clés "fond:<id>" (JPEG rendu) et "pdf:<id>" (PDF d'origine, gardé pour le futur relevé automatique des murs)

export const IDX = "okteo.chantiers.v1", CUR = "okteo.current";
const K0 = 13.0 / 841; // échelle connue du fond EVRARD (m par pixel)

// Chantier d'essai livré avec le logiciel ; reprend l'ancienne sauvegarde (clé v4) telle quelle
export const EVRARD = {
  id: "evrard-04949", nom: "EVRARD", numero: "04949", client: "Maisons CPR",
  key: "okteo.evrard.04949.v4", created: Date.parse("2026-10-24T22:00:00Z"), updated: 0, stats: null,
  fond: { src: "asset", url: "assets/fond-evrard-04949.jpg", name: "EVRARD_04949_plan.pdf (page 3)", pxW: 981, pxH: 710,
    x: -70 * K0, y: -70 * K0, w: 981 * K0, h: 710 * K0, calibre: true },
};

const read = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

export function list() {
  let l = read(IDX, null);
  if (!Array.isArray(l) || !l.length) { l = [EVRARD]; write(IDX, l); }
  return l;
}
export const saveList = (l) => write(IDX, l);
export const get = (id) => list().find((c) => c.id === id) || null;
export function current() { const l = list(); return l.find((c) => c.id === localStorage.getItem(CUR)) || l[0]; }
export function setCurrent(id) { try { localStorage.setItem(CUR, id); } catch { /* */ } }
export function update(id, patch) {
  const l = list(); const i = l.findIndex((c) => c.id === id); if (i < 0) return null;
  l[i] = { ...l[i], ...patch }; saveList(l); return l[i];
}
export function add(meta) { const l = list(); l.push(meta); saveList(l); return meta; }
export function remove(id) { saveList(list().filter((c) => c.id !== id)); }

export function newId(nom, numero) {
  const slug = `${nom || "chantier"}-${numero || ""}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "chantier";
  const ids = new Set(list().map((c) => c.id));
  let id = slug, n = 2; while (ids.has(id)) id = `${slug}-${n++}`;
  return id;
}
export const dataKey = (id) => "okteo.ch." + id;
export const readData = (meta) => read(meta.key, null);
export const writeData = (meta, v) => write(meta.key, v);

// ---------- IndexedDB (fichiers lourds) ----------
let dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open("okteo", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("files");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((res, rej) => { const t = d.transaction("files", mode); const st = t.objectStore("files"); const r = fn(st); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); });
}
export const putFile = (key, blob) => tx("readwrite", (s) => s.put(blob, key));
export const getFile = (key) => tx("readonly", (s) => s.get(key));
export const delFile = (key) => tx("readwrite", (s) => s.delete(key));
