// 3D-8 : la page « maquette 3D » (plan3d.html) reste utilisable sans réseau sur le chantier.
// Portée limitée à /plan3d… : le logiciel lui-même n'est pas concerné. Seuls les fichiers de la page sont gardés
// (page, scripts, styles) ; les données du plan sont dans l'adresse (#p=…) et ne passent jamais par ici.
const CACHE = "okteo-plan3d-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith("okteo-plan3d-") && k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
// la page envoie la liste de ses fichiers après son ouverture : ils sont gardés d'un coup (rien n'est laissé au hasard
// du cache du navigateur)
self.addEventListener("message", (e) => {
  const list = (e.data && e.data.keep) || [];
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(list.filter((u) => new URL(u, location.href).origin === location.origin).map((u) =>
    fetch(u, { cache: "no-store", credentials: "same-origin" }).then((res) => (res.ok ? c.put(new URL(u, location.href).pathname === "/plan3d" ? "/plan3d" : u, res) : null)).catch(() => null)))));
});
self.addEventListener("fetch", (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin) return;
  // la page : réseau d'abord (nouvelle version), sinon la copie gardée
  if (r.mode === "navigate") {
    // (copie faite tout de suite : une fois la réponse rendue à la page, son contenu n'est plus lisible)
    e.respondWith(fetch(r).then((res) => { if (res.ok) { const cp = res.clone(); e.waitUntil(caches.open(CACHE).then((c) => c.put(u.pathname, cp))); } return res; })
      .catch(async () => (await caches.match(u.pathname, { ignoreVary: true })) || (await caches.match("/plan3d.html", { ignoreVary: true })) || (await caches.match("/plan3d", { ignoreVary: true })) || Response.error()));
    return;
  }
  // scripts, styles, polices : la copie gardée d'abord (fichiers à nom haché en ligne)
  // (demandés sans le cache du navigateur : une réponse « 304 inchangé » ne peut pas être gardée)
  e.respondWith(caches.match(r, { ignoreVary: true, ignoreSearch: false }).then((hit) => hit || fetch(r.url, { cache: "no-store", credentials: "same-origin" }).then((res) => { if (res.ok) { const cp = res.clone(); e.waitUntil(caches.open(CACHE).then((c) => c.put(r, cp))); } return res; })));
});
