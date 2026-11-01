// cloudflare/worker.mjs: the home page and the owner's page with their headers, and the API run inside the Worker
// (api/v1.js through its req/res adapter) with the player's address from CF-Connecting-IP. Redis (Upstash's REST API)
// is the test harness's in-memory store behind a stand-in fetch.
const test = require("node:test");
const assert = require("node:assert/strict");
const { harness } = require("./api-harness");

// api/v1.js reads these when it is loaded, as on Cloudflare (nodejs_compat gives the Worker's secrets as process.env)
Object.assign(process.env, { KV_REST_API_URL: "https://redis.worker.test", KV_REST_API_TOKEN: "t", SESSION_SECRET: "worker-test-secret", ADMIN_MASTER_PASS: "owner-password", OWNER_ID: "owner" });
const store = harness(), commands = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (!String(url).startsWith("https://redis.worker.test")) return realFetch(url, init);
  const body = JSON.parse(init.body), many = String(url).endsWith("/pipeline");
  (many ? body : [body]).forEach((c) => commands.push(c));
  return new Response(JSON.stringify(many ? body.map((c) => ({ result: store.redis(c) })) : { result: store.redis(body) }));
};

let worker;
test.before(async () => { worker = (await import("../cloudflare/worker.mjs")).default; });

// static assets that answer with the path they were asked for
const ASSETS = { fetch: async (req) => new Response("asset " + new URL(req.url).pathname, { status: new URL(req.url).pathname === "/missing.html" ? 404 : 200, headers: { "Content-Type": "text/html" } }) };
const call = (path, init = {}) => worker.fetch(new Request("https://13fps.xyz" + path, init), { ASSETS });
const post = (action, body, ip) => call("/api/v1?a=" + action, { method: "POST", headers: { "Content-Type": "application/json", "CF-Connecting-IP": ip }, body: JSON.stringify(body) });

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
  assert.equal((await call("/api/nothing")).status, 404);
});

test("what the Worker answers itself carries the Content-Security-Policy of the stage (/, /admin, the API, an unknown path)", async () => {
  const { CSP } = await import("../cloudflare/csp.mjs"), { HEADER, policy } = require("../scripts/build-csp");
  assert.deepEqual(CSP, [HEADER, policy()]);
  for (const res of [await call("/"), await call("/admin"), await call("/api/v1?a=config"), await call("/api/release"), await call("/missing.html"), await call("/api/nothing")]) assert.equal(res.headers.get(HEADER), policy());
});

test("the API runs in the Worker: the config, a guest, a new account and the owner", async () => {
  const config = await call("/api/v1?a=config");
  assert.equal(config.status, 200);
  assert.equal(config.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(config.headers.get("x-content-type-options"), "nosniff");
  assert.equal((await config.json()).ok, true);
  const guest = await (await post("guest", { device: "worker-test-device-1" }, "203.0.113.30")).json();
  assert.ok(guest.ok && guest.token, "a guest");
  const made = await (await post("auth", { id: "workeruser", pw: "secret123", device: "worker-test-device-2" }, "203.0.113.31")).json();
  assert.ok(made.ok && made.token && made.created, "a new account");
  const again = await (await post("auth", { id: "workeruser", pw: "secret123", device: "worker-test-device-2" }, "203.0.113.31")).json();
  assert.ok(again.ok && !again.created, "and its password again");
  const owner = await (await post("auth", { id: "owner", pw: "owner-password", device: "worker-test-device-3" }, "203.0.113.32")).json();
  assert.ok(owner.ok && owner.atoken && owner.user.owner, "the owner");
  const wrong = await post("auth", { id: "workeruser", pw: "wrong-pass", device: "worker-test-device-2" }, "203.0.113.31");
  assert.equal(wrong.status, 401);
  assert.equal((await wrong.json()).ok, false);
});

test("the API's limits count the address Cloudflare saw, not one the player sends", async () => {
  commands.length = 0;
  await call("/api/v1?a=auth", { method: "POST", headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.40", "X-Forwarded-For": "198.51.100.9" }, body: JSON.stringify({ id: "limitcheck", pw: "secret123", device: "worker-test-device-4" }) });
  const keys = commands.map((c) => c[1]).filter((k) => typeof k === "string" && k.startsWith("rl:auth:"));
  assert.ok(keys.includes("rl:auth:203.0.113.40"), JSON.stringify(keys));
  assert.ok(!keys.some((k) => k.includes("198.51.100.9")));
});

test("a body over 1 MB is refused before the API reads it", async () => {
  const big = await call("/api/v1?a=auth", { method: "POST", headers: { "CF-Connecting-IP": "203.0.113.50" }, body: "x".repeat(1100000) });
  assert.equal(big.status, 413);
});

test("/api/release says which commit runs", async () => {
  const r = await (await call("/api/release")).json();
  assert.equal(r.version.length > 0, true);
  assert.equal(r.commit, "local");
});
