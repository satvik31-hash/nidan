// Nidan service worker.
//
// Precaches the app shell, the emergency screen and the first-aid content —
// "the moment health data matters most is the moment you have neither login
// nor signal". Daily check-ins written offline are queued in IndexedDB and
// replayed when connectivity returns.

const VERSION = "nidan-v1";
const SHELL = [
  "/",
  "/patient/emergency",
  "/patient/records",
  "/patient/card",
  "/manifest.webmanifest",
  "/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Network-first for pages so a signed-in user always sees fresh data, with
  // the cached shell as the fallback when the network is gone.
  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(request, copy));
        return res;
      })
      .catch(async () => {
        const hit = await caches.match(request);
        if (hit) return hit;
        if (request.mode === "navigate") {
          return (await caches.match("/patient/emergency")) ?? Response.error();
        }
        return Response.error();
      }),
  );
});

// Replay queued check-ins once connectivity returns.
self.addEventListener("sync", (event) => {
  if (event.tag === "nidan-checkins") {
    event.waitUntil(
      (async () => {
        const clients = await self.clients.matchAll();
        clients.forEach((c) => c.postMessage({ type: "flush-checkins" }));
      })(),
    );
  }
});
