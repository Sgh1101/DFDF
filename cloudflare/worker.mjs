// The site on Cloudflare. The pages, scripts and art are static assets (wrangler.jsonc) and are served without this
// Worker; it answers only what is not a file: the home page (/), the owner's page (/admin), and the game server on
// Render (/api/*, /peerjs), which it reaches with the shared secret and the address the player connected from.
// _headers sets the headers of the static files; the responses made here get the same ones from this file.
const SITE = { "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin" };
const ADMIN = { "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store", "X-Frame-Options": "DENY" };
const PAGES = { "/": ["/index.html", SITE], "/admin": ["/admin.html", { ...SITE, ...ADMIN }] };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/") || url.pathname === "/peerjs" || url.pathname.startsWith("/peerjs/")) return toServer(request, env, url);
    const [file, headers] = PAGES[url.pathname] || [url.pathname, SITE];
    return withHeaders(await env.ASSETS.fetch(new Request(new URL(file + url.search, url), request)), headers);
  },
};

function withHeaders(response, headers) {
  const out = new Response(response.body, response);
  for (const [name, value] of Object.entries(headers)) out.headers.set(name, value);
  return out;
}

// the game server (server/render.js). A WebSocket (PeerJS) goes through as it is: fetch() answers it with the
// server's 101 and the socket, which is handed back to the player unchanged
async function toServer(request, env, url) {
  if (!env.SERVER_ORIGIN || !env.PROXY_SECRET)
    return new Response(JSON.stringify({ ok: false, error: "게임 서버가 아직 연결되지 않았습니다" }), { status: 503, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...SITE } });
  const headers = new Headers(request.headers);
  headers.set("X-DFDF-Proxy", env.PROXY_SECRET);
  headers.set("X-DFDF-Client-IP", request.headers.get("CF-Connecting-IP") || "");
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : request.body;
  return fetch(new URL(url.pathname + url.search, env.SERVER_ORIGIN), { method: request.method, headers, body, redirect: "manual" });
}
