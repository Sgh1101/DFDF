// 13 service worker. The game always comes fresh from the network, so an
// update reaches the app at once. Without a connection the game cannot run
// (the 3D engine and multiplayer live online), so pages show a friendly
// "connect and retry" screen instead of a broken one; icons stay cached.
const CACHE = "13-v1";
// photo materials and skies never change under the same name: kept after the
// first download so a phone does not fetch them again every match
const ASSETS = "13-assets-v1";
const SHELL = ["/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];
const OFFLINE = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>13</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0a0d12;color:#e8edf4;font-family:sans-serif;text-align:center">
<div><div style="font-size:64px;font-weight:900">13</div><p>인터넷에 연결되어 있지 않습니다.<br>연결한 뒤 다시 열어 주세요.</p>
<button onclick="location.reload()" style="padding:10px 22px;border-radius:10px;border:0;background:#ff3b4e;color:#fff;font-size:15px">다시 시도</button></div></body>`;
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k !== ASSETS).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // fonts, CDN scripts, PeerJS: browser as usual
  if (url.pathname.startsWith("/assets/")) {
    e.respondWith(
      caches.open(ASSETS).then((c) =>
        c.match(req).then(
          (hit) =>
            hit ||
            fetch(req).then((res) => {
              res.ok && c.put(req, res.clone());
              return res;
            })
        )
      )
    );
    return;
  }
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && SHELL.includes(url.pathname)) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(url.pathname, copy));
        }
        return res;
      })
      .catch(() =>
        req.mode === "navigate"
          ? new Response(OFFLINE, { headers: { "Content-Type": "text/html; charset=utf-8" } })
          : caches.match(url.pathname).then((hit) => hit || Response.error())
      )
  );
});
