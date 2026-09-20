/* Child Care Passport — minimal service worker.
 * Strategy: cache only the public app shell and static assets so the app
 * installs and opens fast. Private routes (/app, /institution, /s, /api,
 * /files) are NEVER cached: child care information must not live in the
 * offline cache. */
const CACHE = "ccp-shell-v1";
const SHELL = ["/", "/login", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];
const PRIVATE_PREFIXES = ["/app", "/institution", "/s/", "/api", "/files", "/verify-email", "/reset-password"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => undefined)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (PRIVATE_PREFIXES.some((p) => url.pathname.startsWith(p))) return; // network only
  const isStatic = url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icons/");
  if (isStatic) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })),
    );
    return;
  }
  // Public pages: network first, shell fallback.
  event.respondWith(fetch(req).catch(() => caches.match(req).then((hit) => hit || caches.match("/"))));
});
