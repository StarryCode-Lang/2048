const CACHE_NAME = "2048-shell-v2.0.0";
const SHELL_URL = "/";
const CORE_ASSETS = ["/manifest.webmanifest", "/favicon.svg"];

async function putIfCacheable(cache, request, response) {
  if (response.ok && (response.type === "basic" || response.type === "default")) {
    await cache.put(request, response.clone());
  }
  return response;
}

async function precacheShell() {
  const cache = await caches.open(CACHE_NAME);
  const shellResponse = await fetch(SHELL_URL, { cache: "reload" });
  if (!shellResponse.ok) throw new Error("Unable to precache the 2048 shell");
  await cache.put(SHELL_URL, shellResponse.clone());

  const html = await shellResponse.text();
  const assets = new Set(CORE_ASSETS);
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    const url = new URL(match[1], self.location.origin);
    if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
      assets.add(`${url.pathname}${url.search}`);
    }
  }

  await Promise.all([...assets].map(async (asset) => {
    const response = await fetch(asset, { cache: "reload" });
    if (!response.ok) throw new Error(`Unable to precache ${asset}`);
    await cache.put(asset, response);
  }));
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("2048-shell-") && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  const immutableAsset = requestUrl.pathname.startsWith("/_next/static/");
  if (immutableAsset) {
    event.respondWith(caches.match(event.request).then((cached) => cached ?? fetch(event.request).then(async (response) => {
      const cache = await caches.open(CACHE_NAME);
      return putIfCacheable(cache, event.request, response);
    })));
    return;
  }

  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      const cache = await caches.open(CACHE_NAME);
      return putIfCacheable(cache, event.request, response);
    } catch {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      if (event.request.mode === "navigate") {
        const shell = await caches.match(SHELL_URL);
        if (shell) return shell;
      }
      return Response.error();
    }
  })());
});
