// The site as it runs on Cloudflare and Render: wrangler dev serves the pages and runs cloudflare/worker.mjs in front of
// server/render.js (here with the fixture's API and its in-memory Redis). Checks the addresses and their headers, that
// only the Worker reaches the server, and that two players make and join a room through our own PeerJS server
// (game.ownPeer) at the site's /peerjs; with the server down, the game takes the public PeerJS server instead.
// DFDF_WRANGLER_BIN may point at another wrangler (bin/wrangler.js).
const assert = require("node:assert/strict"), path = require("node:path"), { spawn } = require("node:child_process");
const WebSocket = require("ws");
const { fixture } = require("./browser-fixture");
const { createServer } = require("../server/render");

const SERVER_PORT = 10093, SITE_PORT = 8793, SECRET = "browser-host-secret", SITE = "http://127.0.0.1:" + SITE_PORT;
const until = async (check, ms, what) => { for (const end = Date.now() + ms; Date.now() < end; await new Promise((r) => setTimeout(r, 250))) if (await check()) return; throw new Error("timed out: " + what); };

(async () => {
  const f = await fixture();
  // the game server; the realm of its PeerJS server is counted through the API stand-in below
  const server = createServer({ api: f.h.handler, secret: SECRET });
  // every socket, the PeerJS WebSockets too (closing the server waits for them, and closeAllConnections() skips them)
  const sockets = new Set();
  server.on("connection", (s) => { sockets.add(s); s.on("close", () => sockets.delete(s)); });
  await new Promise((r) => server.listen(SERVER_PORT, "127.0.0.1", r));
  const bin = process.env.DFDF_WRANGLER_BIN || require.resolve("wrangler/bin/wrangler.js");
  const wrangler = spawn(process.execPath, [bin, "dev", "--config", path.join(__dirname, "..", "wrangler.jsonc"), "--port", String(SITE_PORT), "--ip", "127.0.0.1", "--var", "SERVER_ORIGIN:http://127.0.0.1:" + SERVER_PORT, "--var", "PROXY_SECRET:" + SECRET], { env: { ...process.env, WRANGLER_SEND_METRICS: "false", CI: "1" }, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  wrangler.stdout.on("data", (d) => (log += d));
  wrangler.stderr.on("data", (d) => (log += d));
  try {
    await until(() => fetch(SITE + "/robots.txt").then((r) => r.ok, () => !1), 90000, "wrangler dev\n" + log.slice(-2000));

    // 1. the addresses stay as they were on Vercel (no /about.html → /about), with the same headers
    const get = async (p) => { const r = await fetch(SITE + p, { redirect: "manual" }); return { status: r.status, h: (n) => r.headers.get(n), text: await r.text() }; };
    const home = await get("/");
    assert.equal(home.status, 200); assert.match(home.text, /<title>/); assert.equal(home.h("x-content-type-options"), "nosniff");
    for (const p of ["/index.html", "/about.html", "/privacy.html", "/play.html", "/robots.txt", "/sitemap.xml", "/.well-known/assetlinks.json"]) assert.equal((await get(p)).status, 200, p + " is served as it is");
    for (const p of ["/admin", "/admin.html"]) { const a = await get(p); assert.equal(a.status, 200); assert.equal(a.h("x-frame-options"), "DENY", p); assert.equal(a.h("x-robots-tag"), "noindex, nofollow", p); assert.equal(a.h("cache-control"), "no-store", p); }
    const sw = await get("/sw.js");
    assert.equal(sw.h("cache-control"), "no-cache"); assert.equal(sw.h("service-worker-allowed"), "/");
    assert.equal((await get("/manifest.webmanifest")).h("content-type"), "application/manifest+json");
    for (const p of ["/package.json", "/AGENTS.md", "/server/render.js", "/cloudflare/worker.mjs", "/scripts/dev-server.js", "/tests/api-harness.js", "/wrangler.jsonc", "/render.yaml", "/vercel.json", "/node_modules/three/package.json", "/docs/", "/sources/"]) assert.equal((await get(p)).status, 404, p + " is not part of the site");
    const cfg = await get("/api/v1?a=config");
    assert.equal(cfg.status, 200); assert.equal(JSON.parse(cfg.text).ok, true, "the API answers through the Worker");
    assert.equal((await get("/api/release")).status, 200);

    // 2. only the Worker reaches the server: straight to it, the API and the PeerJS socket are refused
    assert.equal((await fetch("http://127.0.0.1:" + SERVER_PORT + "/api/v1?a=config")).status, 403);
    const refused = await new Promise((resolve) => { const ws = new WebSocket("ws://127.0.0.1:" + SERVER_PORT + "/peerjs?key=peerjs&id=nope&token=t"); ws.on("unexpected-response", (q, r) => resolve(r.statusCode)); ws.on("message", () => resolve("opened")); ws.on("error", () => {}); });
    assert.equal(refused, 401);

    // 3. two players on our PeerJS server: the owner switches it on, the host makes a room and the guest joins by its code
    const owner = await f.h.api("auth", { id: "owner", pw: "owner-password", device: "browser-owner-device" });
    const conf = (await f.h.api("a_config_get", { atoken: owner.atoken })).config;
    await f.h.api("a_config_set", { atoken: owner.atoken, config: { ...conf, game: { ...conf.game, ownPeer: true } } });
    process.env.DFDF_BASE_URL = SITE;
    const host = await f.page("hosthost"), guest = await f.page("hostguest");
    for (const p of [host, guest]) await p.waitForFunction(() => window.SERVER_CFG && SERVER_CFG.game && SERVER_CFG.game.ownPeer === true, null, { timeout: 20000 });
    // the options every Peer is made with, seen as they are made
    for (const p of [host, guest]) await p.evaluate(async () => { await ensurePeerLib(); const P = window.Peer; window.__peerOpts = []; window.Peer = function (id, o) { __peerOpts.push(o); return new P(id, o); }; window.Peer.prototype = P.prototype; });
    const code = await host.evaluate(async () => { await createRoom(); return NET.room; });
    assert.ok(code, "the host made a room");
    await guest.evaluate((c) => joinRoom(c), code);
    await host.waitForFunction(() => NET.conns.size === 1 && room.members.size === 2, null, { timeout: 60000 });
    for (const p of [host, guest]) {
      const o = await p.evaluate(() => __peerOpts[0]);
      assert.deepEqual([o.host, o.port, o.secure, o.path], ["127.0.0.1", SITE_PORT, false, "/"], "the Peer met on the site's own /peerjs");
    }

    // 4. our server down: a new room would go to the public PeerJS server (the options carry no host of ours). The Peer
    // is stopped as it is made, so the test never reaches the public server
    server.close(); for (const s of sockets) s.destroy();
    await host.evaluate(() => { netShutdown(); __peerOpts.length = 0; window.Peer = function (id, o) { __peerOpts.push(o); throw new Error("stopped by the test"); }; });
    await host.evaluate(() => { createRoom().catch(() => {}); });
    await host.waitForFunction(() => __peerOpts.length > 0, null, { timeout: 20000 });
    assert.equal(await host.evaluate(() => __peerOpts[0].host), undefined, "with ours not answering, the public server");
    console.log("host: pages and headers as on Vercel, only the Worker reaches the server, a room made and joined through our PeerJS server, the public one when ours is down");
  } finally {
    wrangler.kill();
    await f.browser.close();
  }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
