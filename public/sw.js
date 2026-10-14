/* Same-origin offline shell only. No automatic care or protection. */
const CACHE = "gecko-lab-phase3-shell-8";
const STATIC_ASSETS = ["/manifest.webmanifest", "/icon.svg", "/ui/gecko-lab-mark.svg", "/ui/terrarium.svg", "/ui/home-terrarium.png", "/ui/home-wordmark.svg", "/ui/incubator/scene.png"];
self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE), response = await fetch("/", { cache: "reload" });
    if (!response.ok) throw new Error("offline shell unavailable");
    const html = await response.clone().text();
    await cache.put("/", response);
    const assets = [...new Set([...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"<>]+)"/g)].map(m => m[1]))];
    await cache.addAll([...STATIC_ASSETS, ...assets]);
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith("gecko-lab-phase3-shell-") && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (request.mode === "navigate" && url.pathname === "/") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try { const response = await fetch(request); if (response.ok) await cache.put("/", response.clone()).catch(() => {}); return response; }
      catch { return await cache.match("/") || Response.error(); }
    })());
  } else if (url.pathname.startsWith("/_next/static/") || STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE), hit = await cache.match(request);
      if (hit) return hit;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone()).catch(() => {});
      return response;
    })());
  }
});
