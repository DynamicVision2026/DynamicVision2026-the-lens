/* Lens Snap service worker — small and hand-written.
 * - App shell (index.html + hashed /assets/*) cached so the app opens offline.
 * - Navigations: network first (fresh app when online), cached index.html when offline.
 * - /assets/*: cache first (file names are content-hashed, so a cached copy never goes stale).
 * - /api/* is NEVER cached or touched. Photos and pages live in IndexedDB, not here.
 * Bump VERSION to drop every old cache on the next activate.
 */
const VERSION = "v1";
const CACHE = `lens-snap-${VERSION}`;
const SHELL = "/index.html";
const STATIC = ["/manifest.webmanifest", "/icon.svg", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png"];

/** Hashed asset URLs referenced by an index.html. */
function assetsIn(html) {
  return [...new Set(html.match(/\/assets\/[^"'\s)]+/g) || [])];
}

async function cacheShell() {
  const cache = await caches.open(CACHE);
  const res = await fetch(SHELL, { cache: "no-store" });
  if (!res.ok) return;
  const html = await res.clone().text();
  await cache.put(SHELL, res);
  await Promise.all(
    [...assetsIn(html), ...STATIC].map((url) => cache.add(url).catch(() => undefined)),
  );
}

/** Keep only the assets the current index.html uses (old hashed files go away). */
async function pruneAssets(html) {
  const keep = new Set(assetsIn(html));
  const cache = await caches.open(CACHE);
  for (const req of await cache.keys()) {
    const path = new URL(req.url).pathname;
    if (path.startsWith("/assets/") && !keep.has(path)) await cache.delete(req);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("lens-snap-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname === "/api") return; // never cache the API

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          const type = res.headers.get("content-type") || "";
          if (res.ok && type.includes("text/html")) {
            const html = await res.clone().text();
            const cache = await caches.open(CACHE);
            await cache.put(SHELL, res.clone());
            event.waitUntil(pruneAssets(html));
          }
          return res;
        } catch {
          const cached = await caches.match(SHELL);
          return cached || Response.error();
        }
      })(),
    );
    return;
  }

  if (url.pathname.startsWith("/assets/") || STATIC.includes(url.pathname)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        if (res.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(req, res.clone());
        }
        return res;
      })(),
    );
  }
});
