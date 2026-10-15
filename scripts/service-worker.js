/* Build template: scripts/build-service-worker.mjs emits the production /sw.js. */
/* global self, caches */

const REVISION = __PWA_REVISION__;
const PRECACHE_URLS = __PWA_PRECACHE_URLS__;
const CACHE_PREFIX = "flora-finder-pwa-";
const CURRENT_PREFIX = `${CACHE_PREFIX}${REVISION}-`;
const PRECACHE = `${CURRENT_PREFIX}precache`;
const PAGES = `${CURRENT_PREFIX}pages`;
const PAYLOADS = `${CURRENT_PREFIX}payloads`;
const ASSETS = `${CURRENT_PREFIX}assets`;
const MAX_PAGES = 40;
const MAX_PAYLOADS = 100;
const MAX_ASSETS = 100;
const writeQueues = new Map();
const warmingPages = new Map();
const recentlyWarmed = new Map();

function normalizedPath(pathname) {
  // Next's segment filenames contain characters such as "$". Canonicalizing
  // their encoding makes equivalent literal and escaped request URLs match.
  try {
    return pathname.split("/").map((part) => encodeURIComponent(decodeURIComponent(part))).join("/");
  } catch {
    return pathname;
  }
}

function cacheKey(url) {
  // This is a static export: exported route and RSC contents do not depend on
  // query strings (including Next's changing ?_rsc token). HTML and payloads
  // still have separate cache names and distinct paths.
  return `${self.location.origin}${normalizedPath(url.pathname)}`;
}

const PRECACHE_KEYS = new Set(PRECACHE_URLS.map((path) => cacheKey(new URL(path, self.location.origin))));

function isPage(pathname) {
  return /^\/(?:|index\.html|plant_list(?:\.html)?|offline(?:\.html)?|map(?:\.html)?|plant\/[A-Za-z0-9_-]+(?:\.html)?)\/?$/.test(pathname);
}

function isPayloadPath(pathname) {
  return /^\/(?:index\.txt|__next\.[^/]+\.txt|(?:plant_list|offline|map)\.txt|(?:plant_list|offline|map|plant\/[A-Za-z0-9_-]+)\/[^?]*\.(?:txt|rsc)|plant\/[A-Za-z0-9_-]+\.txt)$/.test(pathname)
    || /^\/(?:plant_list|offline|map|plant\/[A-Za-z0-9_-]+)\.segments\//.test(pathname);
}

function isHtml(response) {
  return /\btext\/html\b/i.test(response.headers.get("content-type") ?? "");
}

function isSuccessful(response) {
  return response.ok
    && response.type !== "opaque"
    && response.type !== "opaqueredirect"
    && response.status !== 206
    && !response.headers.has("content-range");
}

function isCacheable(response, kind) {
  if (!isSuccessful(response)) return false;
  return kind === "page" ? isHtml(response) : !isHtml(response);
}

async function cached(name, key) {
  try {
    return await (await caches.open(name)).match(key, { ignoreVary: true });
  } catch {
    // Cache Storage can be unavailable or evicted. Online requests still work.
    return undefined;
  }
}

function storeResponse(name, key, response, limit) {
  let copy;
  try {
    copy = response.clone();
  } catch {
    return Promise.resolve();
  }
  // Serialize writes per cache so parallel prefetches cannot race the bound.
  const previous = writeQueues.get(name) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(async () => {
    const cache = await caches.open(name);
    await cache.delete(key);
    await cache.put(key, copy);
    const keys = await cache.keys();
    await Promise.all(keys.slice(0, Math.max(0, keys.length - limit)).map((oldKey) => cache.delete(oldKey)));
  }).catch(() => {
    // A quota or storage failure must never turn a successful fetch into an error.
  });
  writeQueues.set(name, next);
  return next;
}

function unavailablePayload() {
  // Returning the offline HTML for RSC would corrupt Next's router state.
  // An error lets Next fall back to a document navigation instead.
  return new Response("This page is not available offline. Open it while online first.", {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function offlineDocument() {
  return (await cached(PRECACHE, cacheKey(new URL("/offline", self.location.origin))))
    ?? new Response("Flora Finder is offline. Reconnect and try again.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
}

async function networkFirst(event, key, name, kind, limit, mayCache = true) {
  try {
    const response = await fetch(event.request);
    if (mayCache && isCacheable(response, kind)) {
      event.waitUntil(storeResponse(name, key, response, limit));
    }
    if (response.status < 500 && !(kind === "payload" && isHtml(response))) return response;
    const fallback = mayCache ? await cached(name, key) : undefined;
    if (fallback) return fallback;
    return kind === "payload" && isHtml(response) ? unavailablePayload() : response;
  } catch {
    const fallback = mayCache ? await cached(name, key) : undefined;
    if (fallback) return fallback;
    return kind === "page" ? offlineDocument() : unavailablePayload();
  }
}

async function immutableAsset(event, key) {
  const match = (await cached(PRECACHE, key)) ?? (await cached(ASSETS, key));
  if (match) return match;
  const response = await fetch(event.request);
  if (isCacheable(response, "asset")) {
    event.waitUntil(storeResponse(ASSETS, key, response, MAX_ASSETS));
  }
  return response;
}

async function respond(event, url) {
  const key = cacheKey(url);
  const payload = isPayloadPath(url.pathname) || event.request.headers.get("RSC") === "1";
  const page = event.request.mode === "navigate";

  // The core shell, catalog, and its payloads belong to one build. Keep that
  // snapshot consistent until the user accepts a waiting worker's update.
  if (PRECACHE_KEYS.has(key)) {
    const match = await cached(PRECACHE, key);
    if (match && !(payload && isHtml(match))) return match;
  }
  if (payload) {
    return networkFirst(event, key, PAYLOADS, "payload", MAX_PAYLOADS, isPayloadPath(url.pathname));
  }
  if (page) {
    return networkFirst(event, key, PAGES, "page", MAX_PAGES, isPage(url.pathname));
  }
  if (/^\/_next\/static\/.*\.(?:js|css|json|woff2?|ttf|otf|eot|ico|svg|png|jpe?g|webp|avif)$/i.test(url.pathname)) {
    return immutableAsset(event, key);
  }
  // Only the specific same-origin requests above are handled by this worker.
  return fetch(event.request);
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(PRECACHE);
    const results = await Promise.allSettled(PRECACHE_URLS.map(async (path) => {
      const url = new URL(path, self.location.origin);
      const request = new Request(url, { cache: "reload", credentials: "same-origin" });
      const response = await fetch(request);
      const kind = isPage(url.pathname) ? "page" : "asset";
      if (!isCacheable(response, kind)) throw new Error(`Cannot precache ${path}: ${response.status}`);
      await cache.put(cacheKey(url), response);
    }));
    const failed = results.find((result) => result.status === "rejected");
    if (failed) {
      await caches.delete(PRECACHE);
      throw failed.reason;
    }
    // Deliberately wait for user approval before replacing an active worker.
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith(CACHE_PREFIX) && !name.startsWith(CURRENT_PREFIX))
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

function warmPage(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl, self.location.origin);
  } catch {
    return Promise.resolve();
  }
  if (url.origin !== self.location.origin || !isPage(url.pathname)) return Promise.resolve();
  const key = cacheKey(url);
  if (PRECACHE_KEYS.has(key) || Date.now() - (recentlyWarmed.get(key) ?? 0) < 30_000) return Promise.resolve();
  if (warmingPages.has(key)) return warmingPages.get(key);
  // Next client navigation downloads RSC rather than HTML. The client sends
  // CACHE_PAGE only for a visited route, making that route reloadable offline
  // without downloading every document that Next prefetches in a plant grid.
  const promise = (async () => {
    try {
      const response = await fetch(new Request(key, {
        headers: { Accept: "text/html" },
        credentials: "same-origin",
        cache: "no-cache",
      }));
      if (isCacheable(response, "page")) {
        await storeResponse(PAGES, key, response, MAX_PAGES);
        recentlyWarmed.delete(key);
        recentlyWarmed.set(key, Date.now());
        if (recentlyWarmed.size > MAX_PAGES) recentlyWarmed.delete(recentlyWarmed.keys().next().value);
      }
    } catch {
      // Going offline while warming a visited page should not affect browsing.
    } finally {
      warmingPages.delete(key);
    }
  })();
  warmingPages.set(key, promise);
  return promise;
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    event.waitUntil(self.skipWaiting());
  } else if (event.data?.type === "CACHE_PAGE" && typeof event.data.url === "string") {
    event.waitUntil(warmPage(event.data.url));
  }
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET"
    || url.origin !== self.location.origin
    || event.request.headers.has("range")
    || /^\/(?:api|__)\//.test(url.pathname)
    || url.pathname === "/api"
    || url.pathname.startsWith("/datasets/geojson/")) return;
  event.respondWith(respond(event, url));
});
