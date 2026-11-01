// cloudflare/worker.mjs: what it answers (the home page, the owner's page, the game server) and the headers it gives,
// with the static assets and the game server stood in for.
const test = require("node:test");
const assert = require("node:assert/strict");

let worker;
test.before(async () => { worker = (await import("../cloudflare/worker.mjs")).default; });

// static assets that answer with the path they were asked for
const ASSETS = { fetch: async (req) => new Response("asset " + new URL(req.url).pathname, { status: new URL(req.url).pathname === "/missing.html" ? 404 : 200, headers: { "Content-Type": "text/html" } }) };
const ENV = { ASSETS, SERVER_ORIGIN: "https://dfdf-server.example", PROXY_SECRET: "worker-secret" };
const call = (path, init = {}, env = ENV) => worker.fetch(new Request("https://13fps.xyz" + path, init), env);

test("/ is the home page and /admin the owner's page, each with its headers", async () => {
  const home = await call("/");
  assert.equal(await home.text(), "asset /index.html");
  assert.equal(home.headers.get("x-content-type-options"), "nosniff");
  assert.equal(home.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.equal(home.headers.get("x-frame-options"), null);
  const admin = await call("/admin");
  assert.equal(await admin.text(), "asset /admin.html");
  assert.equal(admin.headers.get("x-frame-options"), "DENY");
  assert.equal(admin.headers.get("x-robots-tag"), "noindex, nofollow");
  assert.equal(admin.headers.get("cache-control"), "no-store");
  const missing = await call("/missing.html");
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get("x-content-type-options"), "nosniff");
});

test("/api and /peerjs go to the game server with the secret and the player's address", async (t) => {
  const seen = [];
  t.mock.method(globalThis, "fetch", async (url, init) => { seen.push({ url: String(url), init }); return new Response("{}", { status: 200 }); });
  await call("/api/v1?a=config", { headers: { "CF-Connecting-IP": "203.0.113.20", "X-DFDF-Proxy": "forged", "X-DFDF-Client-IP": "198.51.100.2" } });
  await call("/api/v1?a=auth", { method: "POST", body: '{"id":"a"}', headers: { "CF-Connecting-IP": "203.0.113.21" } });
  await call("/peerjs/id?ts=1");
  await call("/peerjs?key=peerjs&id=x&token=y", { headers: { Upgrade: "websocket" } });
  assert.deepEqual(seen.map((s) => s.url), ["https://dfdf-server.example/api/v1?a=config", "https://dfdf-server.example/api/v1?a=auth", "https://dfdf-server.example/peerjs/id?ts=1", "https://dfdf-server.example/peerjs?key=peerjs&id=x&token=y"]);
  const h = (i, name) => new Headers(seen[i].init.headers).get(name);
  assert.equal(h(0, "x-dfdf-proxy"), "worker-secret", "a forged secret is replaced");
  assert.equal(h(0, "x-dfdf-client-ip"), "203.0.113.20", "and so is a forged address");
  assert.equal(seen[1].init.method, "POST");
  assert.equal(await new Response(seen[1].init.body).text(), '{"id":"a"}');
  assert.equal(h(1, "x-dfdf-client-ip"), "203.0.113.21");
  assert.equal(seen[0].init.body, undefined);
  assert.equal(h(3, "upgrade"), "websocket", "a WebSocket goes through as one");
});

test("without the game server's address or secret the API says so instead of failing", async (t) => {
  t.mock.method(globalThis, "fetch", async () => { throw new Error("not expected"); });
  for (const env of [{ ...ENV, SERVER_ORIGIN: "" }, { ...ENV, PROXY_SECRET: "" }]) {
    const res = await call("/api/v1?a=config", {}, env);
    assert.equal(res.status, 503);
    assert.equal((await res.json()).ok, false);
  }
});
