// The site on Cloudflare. The pages, scripts and art are static assets (wrangler.jsonc) and are served without this
// Worker; it answers only what is not a file: the home page (/), the owner's page (/admin), and the game's API
// (/api/v1, /api/release), which runs here. _headers sets the headers of the static files; the responses made here get
// the same ones from this file.
import api from "../api/v1.js";
import release from "../api/release.js";
import { CSP } from "./csp.mjs";

// (CSP: [header name, policy] from scripts/build-csp.js, the same policy _headers gives the static files)
const SITE = { "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin", [CSP[0]]: CSP[1] };
const ADMIN = { "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store", "X-Frame-Options": "DENY" };
const PAGES = { "/": ["/index.html", SITE], "/admin": ["/admin.html", { ...SITE, ...ADMIN }] };
const APIS = { "/api/v1": api, "/api/release": release };
// the largest request body the API takes (Vercel stopped bodies at 4.5 MB; nothing the game sends comes near this)
const BODY_MAX = 1 << 20;
const LOCAL = new Set(["localhost", "127.0.0.1", "[::1]"]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // http:// is sent to https:// (wrangler dev on this machine stays on http). This covers what the Worker answers (/, /admin,
    // the API); the static files are served before the Worker runs, so the zone's "Always Use HTTPS" covers those.
    if (url.protocol === "http:" && !LOCAL.has(url.hostname)) { url.protocol = "https:"; return new Response(null, { status: 301, headers: { ...SITE, Location: url.href } }); }
    if (url.pathname.startsWith("/api/")) return Object.hasOwn(APIS, url.pathname) ? run(APIS[url.pathname], request, url) : new Response(null, { status: 404, headers: SITE });
    const [file, headers] = PAGES[url.pathname] || [url.pathname, SITE];
    return withHeaders(await env.ASSETS.fetch(new Request(new URL(file + url.search, url), request)), headers);
  },
};

function withHeaders(response, headers) {
  const out = new Response(response.body, response);
  for (const [name, value] of Object.entries(headers)) out.headers.set(name, value);
  return out;
}

// api/v1.js and api/release.js are Node handlers (req, res), as they were on Vercel. They get the body as text (api/v1.js
// reads req.body when it is set) and the player's address in X-Forwarded-For, from the CF-Connecting-IP header that
// Cloudflare sets (a player cannot set it), and the answer they write is collected into a Response.
async function run(handler, request, url) {
  let body;
  if (request.method === "POST") {
    if (+request.headers.get("content-length") > BODY_MAX) return new Response(null, { status: 413, headers: SITE });
    body = await request.text();
    if (body.length > BODY_MAX) return new Response(null, { status: 413, headers: SITE });
  }
  const headers = Object.fromEntries(request.headers);
  headers["x-forwarded-for"] = request.headers.get("cf-connecting-ip") || "";
  const req = { method: request.method, url: url.pathname + url.search, headers, body, socket: {} };
  return new Promise((resolve) => {
    const out = new Headers(SITE);
    const res = {
      statusCode: 200,
      setHeader: (name, value) => out.set(name, String(value)),
      getHeader: (name) => out.get(name),
      end(text) { resolve(new Response(text ?? null, { status: this.statusCode, headers: out })); },
    };
    Promise.resolve(handler(req, res)).catch((e) => {
      console.error(JSON.stringify({ kind: "worker-api-exception", message: String((e && e.message) || e).slice(0, 300) }));
      resolve(new Response(JSON.stringify({ ok: false, error: "서버 오류가 났습니다. 잠시 후 다시 시도해 주세요" }), { status: 500, headers: { ...SITE, "Content-Type": "application/json; charset=utf-8" } }));
    });
  });
}
