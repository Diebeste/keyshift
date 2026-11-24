// @ts-nocheck
// Key Shift service worker. Pages: network-first (fresh fixes always win), precache as offline fallback.
// Hashed assets: cache-first. Audio never leaves the device; this worker only caches the app itself.
const CACHE = 'keyshift-v1.1.1+202611241224';
const PRECACHE = ["./","./assets/index-C85lvblZ.js","./assets/ffmpeg-DdP2t_0p.js","./assets/index-CvwMOwoK.css","./assets/key.worker-C9srwOtZ.js","./assets/shift.worker-15kjMBXk.js","./assets/soundtouch-processor-BKTidsbT.js","./assets/worker-BOtfBjWk.js","./assets/essentia-wasm.es-DCu77Bjw.js","./assets/essentia.js-core.es-8McKYW9j.js","./assets/rubberband-Tl2Bn4wL.wasm","./manifest.webmanifest","./favicon.svg","./icon-192.png","./icon-512.png"];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const isPage = req.mode === 'navigate' || req.destination === 'document' || /\/(index\.html)?$/.test(new URL(req.url).pathname)
    || /\.(webmanifest)$/.test(req.url);
  if (isPage) {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then((r) => r || caches.match('./'))),
    );
    return;
  }
  e.respondWith(caches.match(req).then((r) => r || fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  })));
});
