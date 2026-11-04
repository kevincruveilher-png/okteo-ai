// 3D-8 : la page « maquette 3D » (plan3d.html) reste utilisable sans réseau sur le chantier.
// Portée limitée à /plan3d… : le logiciel lui-même n'est pas concerné. Seuls les fichiers de la page sont gardés
// (page, scripts, styles) ; les données du plan sont dans l'adresse (#p=…) et ne passent jamais par ici.
const CACHE = "okteo-plan3d-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith("okteo-plan3d-") && k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener("fetch", (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin) return;
  // la page : réseau d'abord (nouvelle version), sinon la copie gardée
  if (r.mode === "navigate") {
    // (copie faite tout de suite : une fois la réponse rendue à la page, son contenu n'est plus lisible)
    e.respondWith(fetch(r).then((res) => { if (res.ok) { const cp = res.clone(); e.waitUntil(caches.open(CACHE).then((c) => c.put(u.pathname, cp))); } return res; })
      .catch(async () => (await caches.match(u.pathname)) || (await caches.match("/plan3d.html")) || (await caches.match("/plan3d")) || Response.error()));
    return;
  }
  // scripts, styles, polices : la copie gardée d'abord (fichiers à nom haché en ligne)
  e.respondWith(caches.match(r).then((hit) => hit || fetch(r).then((res) => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(r, cp)); } return res; })));
});
