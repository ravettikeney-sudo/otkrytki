// Keeps the app working offline: the page, the card engine, icons and fonts are cached; fresh versions load when online.
const CACHE = "otkrytki-v6";
const SHELL = ["./", "./index.html", "./cards.js", "./video.js", "./3d.js", "./manifest.json", "./icon-192.png", "./icon-512.png", "./og-image.jpg"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  const ok = url.origin === location.origin || url.hostname.endsWith("googleapis.com") || url.hostname.endsWith("gstatic.com") || url.hostname === "unpkg.com";
  if(e.request.method !== "GET" || !ok || url.pathname.endsWith(".apk")) return;
  e.respondWith(fetch(e.request, url.origin === location.origin ? { cache: "no-cache" } : {})
    .then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: url.origin === location.origin && url.pathname.endsWith("/") })));
});
