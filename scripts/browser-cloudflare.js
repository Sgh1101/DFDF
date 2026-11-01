// The site as it runs on Cloudflare: wrangler dev serves the pages as static assets and runs cloudflare/worker.mjs, with
// the API inside it on a stand-in of Upstash's REST API (the fixture's in-memory store, so the fixture's accounts sign
// in there too). Checks that the addresses and their headers are the ones Vercel gave, that the repository's own files
// are not served, and that a guest signs in on the home page, the game boots on the real API and the owner signs in on
// /admin, all through the Worker. DFDF_WRANGLER_BIN may point at another wrangler (bin/wrangler.js).
const assert = require("node:assert/strict"), http = require("node:http"), path = require("node:path"), { spawn } = require("node:child_process");
const { fixture } = require("./browser-fixture");

const REDIS_PORT = 10097, SITE_PORT = 8797, SITE = "http://127.0.0.1:" + SITE_PORT;
const until = async (check, ms, what) => { for (const end = Date.now() + ms; Date.now() < end; await new Promise((r) => setTimeout(r, 250))) if (await check()) return; throw new Error("timed out: " + what()); };

(async () => {
  const f = await fixture();
  // Upstash's REST API on the fixture's store: POST / runs one command, POST /pipeline a list
  const redis = http.createServer((req, res) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => {
      const cmds = JSON.parse(b);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(req.url.endsWith("/pipeline") ? cmds.map((c) => ({ result: f.h.redis(c) })) : { result: f.h.redis(cmds) }));
    });
  });
  await new Promise((r) => redis.listen(REDIS_PORT, "127.0.0.1", r));
  // the Worker's secrets: the ones tests/api-harness.js signs with
  const vars = { KV_REST_API_URL: "http://127.0.0.1:" + REDIS_PORT, KV_REST_API_TOKEN: "test", SESSION_SECRET: "test-secret", ADMIN_MASTER_PASS: "owner-password", OWNER_ID: "owner" };
  // (the package exports only its API and package.json, so the command is found next to package.json)
  const bin = process.env.DFDF_WRANGLER_BIN || path.join(path.dirname(require.resolve("wrangler/package.json")), "bin", "wrangler.js");
  const args = [bin, "dev", "--config", path.join(__dirname, "..", "wrangler.jsonc"), "--port", String(SITE_PORT), "--ip", "127.0.0.1", ...Object.entries(vars).flatMap(([k, v]) => ["--var", k + ":" + v])];
  const wrangler = spawn(process.execPath, args, { env: { ...process.env, WRANGLER_SEND_METRICS: "false", CI: "1" }, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  wrangler.stdout.on("data", (d) => (log += d));
  wrangler.stderr.on("data", (d) => (log += d));
  try {
    await until(() => fetch(SITE + "/robots.txt").then((r) => r.ok, () => !1), 120000, () => "wrangler dev\n" + log.slice(-2000));

    // 1. the addresses stay as they were on Vercel (no /about.html → /about), with the same headers
    const get = async (p) => { const r = await fetch(SITE + p, { redirect: "manual" }); return { status: r.status, h: (n) => r.headers.get(n), text: await r.text() }; };
    const home = await get("/");
    assert.equal(home.status, 200); assert.match(home.text, /<title>/); assert.equal(home.h("x-content-type-options"), "nosniff"); assert.equal(home.h("referrer-policy"), "strict-origin-when-cross-origin");
    for (const p of ["/index.html", "/about.html", "/privacy.html", "/play.html", "/robots.txt", "/sitemap.xml", "/.well-known/assetlinks.json", "/js/legacy/manifest.json"]) {
      const r = await get(p);
      assert.equal(r.status, 200, p + " is served as it is"); assert.equal(r.h("x-content-type-options"), "nosniff", p);
    }
    for (const p of ["/admin", "/admin.html"]) { const a = await get(p); assert.equal(a.status, 200); assert.equal(a.h("x-frame-options"), "DENY", p); assert.equal(a.h("x-robots-tag"), "noindex, nofollow", p); assert.equal(a.h("cache-control"), "no-store", p); }
    const sw = await get("/sw.js");
    assert.equal(sw.h("cache-control"), "no-cache"); assert.equal(sw.h("service-worker-allowed"), "/");
    assert.equal((await get("/manifest.webmanifest")).h("content-type"), "application/manifest+json");
    for (const p of ["/package.json", "/AGENTS.md", "/api/v1.js", "/api/release.js", "/cloudflare/worker.mjs", "/scripts/dev-server.js", "/tests/api-harness.js", "/wrangler.jsonc", "/vercel.json", "/_headers", "/.assetsignore", "/node_modules/three/package.json", "/docs/", "/sources/", "/api/nothing"]) assert.equal((await get(p)).status, 404, p + " is not part of the site");
    const cfg = await get("/api/v1?a=config");
    assert.equal(cfg.status, 200); assert.equal(JSON.parse(cfg.text).ok, true, "the API answers from the Worker");
    assert.equal(JSON.parse((await get("/api/release")).text).commit, "local");

    // 2. a guest signs in on the home page, through the Worker's API
    const ctx = await f.browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: "block" });
    const hp = await ctx.newPage();
    await hp.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await hp.goto(SITE + "/", { waitUntil: "domcontentloaded" });
    await hp.waitForSelector("#doGuest", { state: "visible", timeout: 30000 });
    await hp.click("#doGuest");
    await hp.waitForSelector("#v-dash:not([hidden])", { timeout: 30000 });
    assert.match(await hp.textContent("#meName"), /게스트|Guest/, "signed in as a guest");

    // 3. the game boots on the real API: the owner's settings and the sign-in checked by the Worker
    process.env.DFDF_BASE_URL = SITE;
    const game = await f.page("cfplayer", undefined, undefined, { realApi: true });
    await game.waitForFunction(() => window.SERVER_CFG && SERVER_CFG.game, null, { timeout: 30000 });
    assert.equal(await game.evaluate(() => !!(ACCOUNT.session() && ACCOUNT.session().user && ACCOUNT.session().user.id === "cfplayer")), true, "still signed in after the Worker's check");

    // 4. the owner signs in on /admin and the owner's settings come from the Worker
    const ap = await ctx.newPage();
    await ap.goto(SITE + "/admin", { waitUntil: "domcontentloaded" });
    await ap.fill("#pw", "owner-password");
    await ap.click("#go");
    await ap.waitForSelector("#app:not([hidden])", { timeout: 30000 });
    assert.deepEqual(f.errors, []);
    console.log("cloudflare: pages and headers as on Vercel, the repository's own files not served, a guest on the home page, the game and the owner's page on the Worker's API");
  } finally {
    wrangler.kill();
    redis.close();
    await f.browser.close();
  }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
