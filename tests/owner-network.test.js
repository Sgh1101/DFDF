const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm");
const source = fs.readFileSync("play.html", "utf8");
const helloSource = source.slice(source.indexOf('  let helloKey = ""'), source.indexOf('  // ── host: what each op does'));
const hostStart = source.indexOf("  const ownerRequests = new Map()");
const hostSource = source.slice(hostStart, source.indexOf("  const _oe = NET.onEvent;", hostStart));

test("owner hello sends only scoped proof and retries a failed issuance", async () => {
  const sent = []; let calls = 0;
  const context = { NET: { mode: "client", status: "open", room: "ABC123", peer: { id: "peer" } }, Date, isClient: () => true, sess: () => ({ token: "private-player-credential" }), sendAction: (value) => sent.push(value), AC: { api: async (action, body) => { assert.equal(action, "owner_ticket"); assert.equal(body.token, "private-player-credential"); if (++calls === 1) throw new Error("temporary failure"); return { ticket: "scoped-proof", exp: Date.now() + 300000 }; } } };
  vm.createContext(context); vm.runInContext(helloSource, context);
  await context.hello(); await context.hello(); await context.hello();
  assert.equal(calls, 2); assert.equal(sent.length, 1);
  assert.equal(sent[0].ticket, "scoped-proof"); assert.equal(Object.hasOwn(sent[0], "token"), false);
});

test("disconnect and replacement channels reject late owner grants", async () => {
  let resolve, granted = 0;
  const connection = { event: {} }, X = { OWNP: new Set() };
  const NET = { room: "ABC123", peer: {}, conns: new Map([["peer", connection]]), onAction() {}, onPeerGone() {} };
  const context = { NET, X, Date, Map, setInterval() {}, isClient: () => false, netShutdown() {}, world: { actors: [] }, sendEventTo: () => granted++, myActor() {}, run() {}, AC: { api: (action, body) => { assert.equal(action, "owner_check"); assert.equal(body.p, "peer"); assert.equal(Object.hasOwn(body, "token"), false); return new Promise((r) => resolve = r); } } };
  vm.createContext(context); vm.runInContext(hostSource, context);
  NET.onAction("peer", { t: "own-hi", ticket: "proof" });
  connection.event = {};
  resolve({ owner: true, exp: Date.now() + 300000 }); await Promise.resolve();
  assert.equal(granted, 0); assert.equal(X.OWNP.size, 0);
  NET.onAction("peer", { t: "own-hi", ticket: "proof" });
  resolve({ owner: true, exp: Date.now() + 300000 }); await Promise.resolve();
  assert.equal(granted, 1); assert.equal(X.OWNP.has("peer"), true);
  NET.onPeerGone("peer"); assert.equal(X.OWNP.size, 0);
  NET.onAction("peer", { t: "own-hi", ticket: "proof" }); NET.onPeerGone("peer");
  resolve({ owner: true, exp: Date.now() + 300000 }); await Promise.resolve();
  assert.equal(X.OWNP.size, 0); assert.equal(granted, 1);
});
