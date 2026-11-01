// server/render.js, the game server on Render: only the Cloudflare Worker gets in, the API sees the player's own
// address and a bounded body, and PeerJS answers over HTTP and on its WebSocket. The server runs in a child process
// (the PeerJS server keeps timers of its own that would keep a test process alive).
const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const WebSocket = require("ws");

const SECRET = "unit-proxy-secret";
const CHILD = `
const { harness } = require("./tests/api-harness");
const { createServer } = require("./server/render");
const h = harness();
// the address the API was given, shown back in a header
const api = (req, res) => { res.setHeader("X-Seen-Ip", String(req.headers["x-forwarded-for"])); return h.handler(req, res); };
const server = createServer({ api, secret: ${JSON.stringify(SECRET)} });
server.listen(0, "127.0.0.1", () => console.log("port " + server.address().port));
`;

let child, base;
test.before(async () => {
  child = spawn(process.execPath, ["-e", CHILD], { cwd: require("node:path").join(__dirname, ".."), stdio: ["ignore", "pipe", "inherit"] });
  const port = await new Promise((resolve, reject) => {
    child.stdout.on("data", (d) => { const m = /port (\d+)/.exec(String(d)); m && resolve(+m[1]); });
    child.on("exit", (code) => reject(new Error("server exited " + code)));
  });
  base = "http://127.0.0.1:" + port;
});
test.after(() => child.kill());

const viaWorker = (ip) => ({ "x-dfdf-proxy": SECRET, "x-dfdf-client-ip": ip });

test("the health check answers anyone; the API and PeerJS only the Worker", async () => {
  const health = await fetch(base + "/healthz");
  assert.equal(health.status, 200);
  assert.equal(await health.text(), "ok");
  for (const headers of [{}, { "x-dfdf-proxy": "wrong" }]) {
    assert.equal((await fetch(base + "/api/v1?a=config", { headers })).status, 403);
    assert.equal((await fetch(base + "/peerjs/id", { headers })).status, 403);
  }
});

test("the API gets the player's address from the Worker, not from X-Forwarded-For", async () => {
  const res = await fetch(base + "/api/v1?a=config", { headers: { ...viaWorker("203.0.113.9"), "x-forwarded-for": "198.51.100.1" } });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("x-seen-ip"), "203.0.113.9");
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal((await res.json()).ok, true);
});

test("a body reaches the API; one over 1 MB is refused", async () => {
  const post = (body) => fetch(base + "/api/v1?a=guest", { method: "POST", headers: { ...viaWorker("203.0.113.10"), "content-type": "application/json" }, body });
  const guest = await post(JSON.stringify({ device: "render-server-test-device" }));
  assert.equal(guest.status, 200);
  assert.ok((await guest.json()).token, "a guest signed in through the server");
  assert.equal((await post(JSON.stringify({ device: "x".repeat(1100000) }))).status, 413);
});

test("PeerJS: an id over HTTP, and its WebSocket through the Worker only", async () => {
  const id = await fetch(base + "/peerjs/id", { headers: viaWorker("203.0.113.11") });
  assert.equal(id.status, 200);
  assert.match(await id.text(), /^[0-9a-f-]{36}$/);
  const open = (headers) => new Promise((resolve) => {
    const ws = new WebSocket(base.replace("http", "ws") + "/peerjs?key=peerjs&id=unit" + Math.random().toString(36).slice(2) + "&token=t", { headers });
    ws.on("message", (m) => { resolve(JSON.parse(String(m)).type); ws.close(); });
    ws.on("unexpected-response", (req, res) => resolve(res.statusCode));
    ws.on("error", () => {});
  });
  assert.equal(await open(viaWorker("203.0.113.12")), "OPEN");
  assert.equal(await open({}), 401);
  assert.equal(await open({ "x-dfdf-proxy": "wrong" }), 401);
});
