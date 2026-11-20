"use strict";
/* Service worker : l'appli marche sans réseau.
   Coque (pages, styles, scripts, données) mise en cache à l'installation ; photos mises en cache à la première vue. */
importScripts("version.js");
const CACHE = "carnet-" + self.VERSION;
const COQUE = ["./", "index.html", "style.css", "app.js", "version.js", "themes.css", "themes.js", "manifest.webmanifest", "data/especes.json", "icons/icon-192.png", "icons/icon-512.png",
  "fonts/caveat.woff2", "fonts/nunito.woff2", "fonts/nunito-italique.woff2"];

self.addEventListener("install", (e) => {
  // Pas de skipWaiting ici : la nouvelle version s'installe en fond puis attend. L'appli affiche « Nouvelle version
  // disponible » et c'est l'utilisatrice qui redémarre (message MAJ).
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(COQUE.map((f) => new Request(f, { cache: "reload" })))));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("carnet-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("message", (e) => {
  if (!e.data) return;
  if (e.data.type === "MAJ") self.skipWaiting();
  if (e.data.type === "VERSION" && e.ports[0]) e.ports[0].postMessage(self.VERSION);
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((rep) => {
      if (rep && rep.ok && new URL(e.request.url).origin === location.origin) {
        const copie = rep.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copie));
      }
      return rep;
    }).catch(() => (e.request.mode === "navigate" ? caches.match("index.html") : undefined)))
  );
});
