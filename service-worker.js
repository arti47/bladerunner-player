// service-worker.js — network-first, caches the app shell + all data files.
// Bump CACHE_VERSION on ANY shipped-file change (CLAUDE.md §10.6).
const CACHE_VERSION = "brp-v23";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.json",
  "./icon.svg",
  "./data.js",
  "./data-npcs.js",
  "./data-solo.js",
  "./data-gm.js",
  "./src/main.js",
  "./src/core.js",
  "./src/ui.js",
  "./src/rules.js",
  "./src/derived.js",
  "./src/settings.js",
  "./src/store.js",
  "./src/screens.js",
  "./src/router.js",
  "./src/wizard.js",
  "./src/sheet.js",
  "./src/roller.js",
  "./src/combat.js",
  "./src/solo.js",
  "./src/gm.js",
  "./src/sync.js",
  "./firebase-config.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((c) => c.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return; // don't touch Firebase / cross-origin
  event.respondWith(
    fetch(request)
      .then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE_VERSION).then((c) => c.put(request, copy)).catch(() => {});
        return resp;
      })
      .catch(() => caches.match(request).then((r) => r || caches.match("./index.html")))
  );
});
