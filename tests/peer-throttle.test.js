const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm");
const src = fs.readFileSync("js/legacy/112-the-host-throttles-what-a-guest-can-make-it-ask-the-server.js", "utf8");

// a host page with stub globals; time and timers are driven by the test
function setup(mode = "host") {
  const log = [], warns = [], timers = [];
  let now = 1000000;
  const FakeDate = { now: () => now };
  const NET = { mode, conns: new Map([["g1", {}], ["g2", {}]]) };
  NET.onAction = (peer, msg) => { log.push([peer, msg]); };
  NET.onPeerGone = (peer) => { log.push(["gone", peer]); };
  const MOBP = new Set(["g1"]);
  const c = {
    NET, Date: FakeDate, console: { warn: (...a) => warns.push(a.join(" ")) },
    window: { MOBILE: { peers: MOBP } },
    netShutdown: () => { log.push(["shutdown"]); },
    setTimeout: (fn, ms) => { const t = { fn, at: now + ms, dead: false }; timers.push(t); return t; },
    clearTimeout: (t) => { t && (t.dead = true); },
  };
  vm.createContext(c);
  vm.runInContext(src, c);
  const advance = (ms) => {
    now += ms;
    for (const t of timers.filter((t) => !t.dead && t.at <= now)) { t.dead = true; t.fn(); }
  };
  return { c, NET, log, warns, timers, advance, MOBP, T: c.window.PEER_THROTTLE, tick: () => now };
}
const sent = (log, peer, t) => log.filter((e) => e[0] === peer && e[1] && e[1].t === t).length;

test("a burst of skins and hellos is cut to the budget, other messages pass untouched and in order", () => {
  const h = setup();
  for (let i = 0; i < 50; i++) h.NET.onAction("g1", { t: "skins", k: "ticket" + i });
  for (let i = 0; i < 20; i++) h.NET.onAction("g1", { t: "hello", name: "x" });
  assert.equal(sent(h.log, "g1", "skins"), h.T.rules.skins.cap);
  assert.equal(sent(h.log, "g1", "hello"), h.T.rules.hello.cap);
  assert.equal(h.warns.length, 2, "one console line per peer and type");
  h.log.length = 0;
  const order = [{ t: "move", team: "atk", slot: 1 }, { t: "abil", i: 0 }, { t: "buy", id: "a" }, { t: "own", op: "x" }, { t: "padm", p: {} }, { t: "mob", on: 1 }];
  for (let i = 0; i < 100; i++) for (const m of order) h.NET.onAction("g1", m);
  assert.equal(h.log.length, 600, "unthrottled types are never dropped");
  assert.deepEqual(h.log.slice(0, 6).map((e) => e[1]), order);
  assert.equal(h.log[0][1], order[0], "the same message object is passed on");
});

test("budgets are per peer and per type", () => {
  const h = setup();
  for (let i = 0; i < 30; i++) h.NET.onAction("g1", { t: "hello" });
  assert.equal(sent(h.log, "g1", "hello"), h.T.rules.hello.cap);
  h.NET.onAction("g2", { t: "hello" });
  assert.equal(sent(h.log, "g2", "hello"), 1, "another peer has its own bucket");
  h.NET.onAction("g1", { t: "perm-hi", ticket: "t" });
  h.NET.onAction("g1", { t: "own-hi", ticket: "t" });
  assert.equal(sent(h.log, "g1", "perm-hi") + sent(h.log, "g1", "own-hi"), 2, "another type has its own bucket");
});

test("honest clients stay inside the budgets: join, redial, repeated hello, equipping skins", () => {
  const h = setup();
  // join: hello + skins together; a few hellos in a row (name-safety test sends two at a time, twice)
  h.NET.onAction("g1", { t: "hello" }); h.NET.onAction("g1", { t: "skins", k: "a" });
  for (let i = 0; i < 4; i++) h.NET.onAction("g1", { t: "hello" });
  assert.equal(sent(h.log, "g1", "hello"), 5);
  assert.equal(h.warns.length, 0);
  // a redial is a new peer id: its first hello, skins, own-hi and perm-hi all pass
  h.NET.onAction("g3", { t: "hello", prev: "g1" }); h.NET.onAction("g3", { t: "skins", k: "b" });
  h.NET.onAction("g3", { t: "own-hi", ticket: "o" }); h.NET.onAction("g3", { t: "perm-hi", ticket: "p" });
  assert.equal(h.log.filter((e) => e[0] === "g3").length, 4);
  // ten quick equips in a row all reach the host
  for (let i = 0; i < 10; i++) h.NET.onAction("g2", { t: "skins", k: "k" + i });
  assert.equal(sent(h.log, "g2", "skins"), 10);
  assert.equal(h.warns.length, 0, "nothing was throttled");
  // one equip every few seconds for a minute, and a refreshed owner ticket every minute
  for (let s = 0; s < 60; s++) { h.advance(1000); if (s % 4 === 0) h.NET.onAction("g4", { t: "skins", k: "s" + s }); if (s % 60 === 59) h.NET.onAction("g4", { t: "own-hi" }); }
  assert.equal(h.warns.length, 0);
});

test("tokens come back over time", () => {
  const h = setup();
  for (let i = 0; i < 20; i++) h.NET.onAction("g1", { t: "hello" });
  assert.equal(sent(h.log, "g1", "hello"), 5);
  h.advance(h.T.rules.hello.every + 50);
  h.NET.onAction("g1", { t: "hello" });
  assert.equal(sent(h.log, "g1", "hello"), 6);
  h.NET.onAction("g1", { t: "hello" });
  assert.equal(sent(h.log, "g1", "hello"), 6, "only one token came back");
});

test("the newest skins message held back is delivered once a token is back, and only that one", () => {
  const h = setup();
  for (let i = 0; i < 25; i++) h.NET.onAction("g1", { t: "skins", k: "t" + i });
  assert.equal(sent(h.log, "g1", "skins"), 10);
  h.advance(h.T.rules.skins.every + 100);
  const skins = h.log.filter((e) => e[1] && e[1].t === "skins");
  assert.equal(skins.length, 11);
  assert.equal(skins[10][1].k, "t24", "the last one wins");
  h.advance(60000);
  assert.equal(sent(h.log, "g1", "skins"), 11, "nothing else is replayed");
  // hello is not replayed
  for (let i = 0; i < 9; i++) h.NET.onAction("g1", { t: "hello" });
  h.advance(60000);
  assert.equal(sent(h.log, "g1", "hello"), 5);
});

test("a held skins message is dropped when the peer leaves or the room shuts down", () => {
  const h = setup();
  for (let i = 0; i < 15; i++) h.NET.onAction("g1", { t: "skins", k: "t" + i });
  h.NET.conns.delete("g1"); h.NET.onPeerGone("g1");
  h.advance(60000);
  assert.equal(sent(h.log, "g1", "skins"), 10);
  const h2 = setup();
  for (let i = 0; i < 15; i++) h2.NET.onAction("g1", { t: "skins", k: "t" + i });
  h2.c.netShutdown();
  h2.advance(60000);
  assert.equal(sent(h2.log, "g1", "skins"), 10);
  assert.equal(h2.T.size(), 0);
});

test("per-peer state is dropped when a peer leaves and on shutdown, and the old handlers still run", () => {
  const h = setup();
  h.NET.onAction("g1", { t: "hello" }); h.NET.onAction("g2", { t: "hello" });
  assert.equal(h.T.size(), 2);
  h.NET.onPeerGone("g1");
  assert.equal(h.T.size(), 1);
  assert.ok(h.log.some((e) => e[0] === "gone" && e[1] === "g1"), "the previous onPeerGone ran");
  assert.equal(h.MOBP.has("g1"), false, "the phone flag of the peer is cleared");
  h.c.netShutdown();
  assert.equal(h.T.size(), 0);
  assert.ok(h.log.some((e) => e[0] === "shutdown"), "the previous netShutdown ran");
  // a rejoin of the same id after a clear starts with a full bucket
  for (let i = 0; i < 5; i++) h.NET.onAction("g1", { t: "hello" });
  assert.equal(h.log.filter((e) => e[0] === "g1" && e[1] && e[1].t === "hello").length, 6);
});

test("state of peers that left silently is pruned", () => {
  const h = setup();
  for (let i = 0; i < 80; i++) h.NET.onAction("p" + i, { t: "hello" });
  h.NET.onAction("g1", { t: "hello" });
  assert.ok(h.T.size() <= 66, "size " + h.T.size());
  assert.equal(sent(h.log, "g1", "hello"), 1);
});

test("nothing is throttled when this page is not the host, and odd messages do not throw", () => {
  const h = setup("client");
  for (let i = 0; i < 30; i++) h.NET.onAction("g1", { t: "hello" });
  assert.equal(sent(h.log, "g1", "hello"), 30);
  assert.equal(h.T.size(), 0);
  const host = setup();
  for (const odd of [null, undefined, 5, "x", {}, { t: 5 }, { t: "__proto__" }, { t: "constructor" }, { t: "toString" }]) assert.doesNotThrow(() => host.NET.onAction("g1", odd));
  assert.equal(host.log.length, 9, "all passed through");
});
