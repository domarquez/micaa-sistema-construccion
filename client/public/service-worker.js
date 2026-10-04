/* Reemplazo del SW antiguo (cache-first "micaa-v2", podía servir un index.html viejo).
 * Si algún navegador aún lo tiene registrado, al actualizarse borra sus cachés y se desregistra;
 * el cliente nuevo registra /sw.js. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith("micaa-sw-")).map((k) => caches.delete(k))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll({ type: "window" }))
      .then((clients) => clients.forEach((c) => c.navigate(c.url))),
  );
});
