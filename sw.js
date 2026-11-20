"use strict";
/* Service worker : l'appli marche sans réseau.
   Coque (pages, styles, scripts, données) mise en cache à l'installation ; photos mises en cache à la première vue. */
importScripts("version.js");
const CACHE = "carnet-" + self.VERSION;
const COQUE = ["./", "index.html", "style.css", "app.js", "version.js", "manifest.webmanifest", "data/especes.json", "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(COQUE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("carnet-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
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
