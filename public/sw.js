// Nidan service worker.
//
// Precaches the public shell so the app still opens without a network. Daily
// check-ins written offline are queued in IndexedDB and replayed when
// connectivity returns.
//
// ── What must never happen here ───────────────────────────────
// This worker registers ONLY in a production build, so a mistake in it is
// invisible on a dev laptop and appears for the first time on a deployment.
//
// v1 precached /patient/records and /patient/card, which are behind auth. On
// a signed-out install the fetch followed the redirect to /login/patient and
// stored the *login page* under the /patient/records key. A signed-in user
// could then be served that cached login screen and conclude that signing in
// had silently failed. Hence:
//
//   1. Never precache a route that requires a session.
//   2. Never cache a redirected, errored or non-200 response.
//   3. Never cache API routes or RSC payloads — they are per-session.

const VERSION = "nidan-v3";

// Public routes only. Every one of these renders for a signed-out visitor.
const SHELL = ["/", "/manifest.webmanifest", "/icon.svg"];

/** Auth-gated areas. Cached opportunistically after a real 200, never
 *  precached, and never used as a generic offline fallback. */
const PRIVATE = /^\/(patient|doctor)(\/|$)/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      // Individually, so one missing asset cannot abort the whole install the
      // way addAll() does.
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function cacheable(res) {
  if (!res || !res.ok || res.status !== 200) return false;
  // A followed redirect stored against the original URL is exactly how a
  // login page ends up masquerading as a records page.
  if (res.redirected) return false;
  if (res.type === "opaqueredirect" || res.type === "error") return false;
  return true;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API routes and RSC payloads carry per-session data; a stale one is worse
  // than no response at all.
  if (url.pathname.startsWith("/api/")) return;
  if (url.searchParams.has("_rsc") || request.headers.get("RSC")) return;

  // Network-first, so a signed-in user always sees fresh data. The cache is
  // strictly a fallback for when the network is gone.
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (cacheable(res)) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(async () => {
        const hit = await caches.match(request);
        if (hit) return hit;
        if (request.mode === "navigate" && !PRIVATE.test(url.pathname)) {
          return (await caches.match("/")) ?? Response.error();
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
