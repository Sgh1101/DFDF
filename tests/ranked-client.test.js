const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm");
const read = (name) => fs.readFileSync(fs.readdirSync("js/legacy").filter((f) => f.startsWith(name)).map((f) => "js/legacy/" + f)[0], "utf8");
const plain = (x) => JSON.parse(JSON.stringify(x)); // objects made inside the vm come from another realm
const tick = () => new Promise((r) => setImmediate(r));
// a document that accepts whatever the modules do to it
const node = () => new Proxy(function () {}, { get: (t, k) => (k === "classList" ? { toggle() {}, add() {}, remove() {}, contains: () => false } : k === "style" ? {} : k === "length" ? 0 : k === Symbol.toPrimitive ? () => "" : node()), set: () => true, apply: () => node() });
function world(extra = {}) {
  const timers = [], listeners = {};
  const sb = {
    console, Date, Map, Set, Promise, JSON, Math, Object, Array, String, Number, Error, atob: (s) => Buffer.from(s, "base64").toString("binary"), URL,
    setTimeout, clearTimeout, setInterval: (fn) => timers.push(fn), localStorage: { getItem: () => null, setItem() {} },
    document: { getElementById: () => null, createElement: () => node(), body: node(), head: node(), querySelector: () => null, querySelectorAll: () => [] },
    MutationObserver: class { observe() {} },
    addEventListener: (name, fn) => (listeners[name] = (listeners[name] || []).concat(fn)),
    ADMIN_DEF: { run: 9, walk: 3.8, god: false, infAmmo: false, fastFire: 1 }, GAME_LANG: "ko",
    room: { ranked: false, members: new Map(), slots: { atk: [], def: [] }, code: "ABC123" },
    NET: { mode: "client", room: "ABC123", id: "me-peer", peer: { id: "me-peer" }, onAction() {}, onEvent() {} },
    world: { actors: [] }, banner() {}, ...extra,
  };
  sb.window = sb; sb.ADMIN = Object.assign({}, sb.ADMIN_DEF);
  return { sb, timers, listeners, run: (code) => vm.runInContext(code, vm.createContext(sb)), ctx: null };
}
function boot81(sb, timers) {
  Object.assign(sb, { lobbyReset() {}, lobbySetOpt() {}, lobbySnapshot: () => ({}), sendEventAll() {}, sendEventTo() {}, renderLobby() {}, netShutdown() {}, paintSelMaps() {}, createRoom() {}, joinRoom() {}, lobbyStart() {}, hostStartMatch() {}, clientBeginMatch() {}, clientEnterMatch() {} });
  sb.ADMIN2 = { P: { god: false, speed: 1, fastFire: 1 }, G: { roundT: 100, buyT: 0, matchT: 0, infAll: false }, PEERS: new Map(), setPersonal(k, v) { this.P[k] = v; }, afterChange() {} };
  sb.HUNTX = { HUNT: { unlocked: false, granted: false, code: "" }, OK: new Set(), GRANT: new Set(), OWNP: new Set() };
  sb.ACCOUNT = { session: () => ({ token: "t", user: { id: "me" } }), online: true, api: async () => ({ ticket: null }), runCmd() {} };
  vm.createContext(sb);
  vm.runInContext(read("81-ranked-play"), sb);
  return () => { for (const fn of timers) fn(); };
}

test("a ranked room shuts admin and cheats for a normal account, even one claiming to be the owner", async () => {
  const w = world(), pump = boot81(w.sb, w.timers);
  w.sb.room.ranked = true; w.sb.window.IS_OWNER = true; w.sb.window.ADMIN_GRANTED = true;
  pump(); await tick(); await tick(); pump();
  assert.equal(w.sb.RANKED.locked, true);
  w.sb.ADMIN.god = true; w.sb.ADMIN.run = 99;
  assert.deepEqual([w.sb.ADMIN.god, w.sb.ADMIN.run, w.sb.window.IS_OWNER, w.sb.window.ADMIN_GRANTED, w.sb.RANKED.isOperator()], [false, 9, false, false, false]);
  // leaving the room gives the claim back and lifts the lock
  w.sb.room.ranked = false; pump();
  assert.deepEqual([w.sb.RANKED.locked, w.sb.window.IS_OWNER], [false, true]);
});

test("the operator keeps his own cheats in a ranked room once the server confirmed him; room-wide switches stay shut", async () => {
  const w = world(), pump = boot81(w.sb, w.timers);
  let asked = null;
  w.sb.ACCOUNT.api = async (action, body) => { asked = { action, body }; return { ticket: "signed", exp: Date.now() + 1e5 }; };
  w.sb.room.ranked = true; w.sb.window.IS_OWNER = true;
  pump(); await tick(); await tick(); pump();
  assert.deepEqual(plain(asked), { action: "owner_ticket", body: { token: "t", room: "ABC123", p: "me-peer" } });
  assert.deepEqual([w.sb.RANKED.isOperator(), w.sb.RANKED.operator, w.sb.RANKED.locked, w.sb.window.IS_OWNER], [true, true, false, true]);
  w.sb.ADMIN.god = true; w.sb.ADMIN.run = 99; w.sb.ADMIN2.P.god = true; pump();
  assert.deepEqual([w.sb.ADMIN.god, w.sb.ADMIN.run, w.sb.ADMIN2.P.god], [true, 9, true], "his personal flags stay, the speed everybody runs at does not move");
  // the confirmation is for this room only
  w.sb.NET.room = "ZZZ999"; pump();
  assert.deepEqual([w.sb.RANKED.isOperator(), w.sb.RANKED.locked], [false, true]);
});

test("the host hears an operator guest only about himself, and nobody else's cheat requests", () => {
  const w = world(), pump = boot81(w.sb, w.timers);
  const got = [];
  w.sb.NET.onAction = (peer, msg) => got.push([peer, msg.t, msg.op].filter(Boolean).join(":"));
  vm.runInContext(read("81-ranked-play"), vm.createContext(w.sb)); // wraps the handler the test just set
  w.sb.NET.mode = "host"; w.sb.room.ranked = true; w.sb.HUNTX.OWNP.add("op");
  w.sb.world.actors = [{ id: 1, ctrl: "op", alive: true }, { id: 2, ctrl: "pl", alive: true }, { id: 3, ctrl: "me", alive: true }];
  const send = (peer, msg) => w.sb.NET.onAction(peer, msg);
  for (const [peer, msg] of [["pl", { t: "padm", p: { god: true } }], ["pl", { t: "kit", key: "x" }], ["pl", { t: "perm-hi", ticket: "x" }], ["pl", { t: "hunt-try", c: "1" }], ["pl", { t: "own", op: "hp", id: 2, v: 5 }], ["op", { t: "own", op: "kill", id: 2 }], ["op", { t: "own", op: "cheat", id: 2, v: true }], ["op", { t: "own", op: "hp", id: 2, v: 5 }], ["op", { t: "perm-hi", ticket: "x" }]]) send(peer, msg);
  assert.deepEqual(got, []);
  for (const [peer, msg] of [["op", { t: "padm", p: { god: true } }], ["op", { t: "own", op: "hp", id: 1, v: 500 }], ["op", { t: "own", op: "god", id: 1, v: 1 }], ["pl", { t: "input" }], ["pl", { t: "hello" }]]) send(peer, msg);
  assert.deepEqual(got, ["op:padm", "op:own:hp", "op:own:god", "pl:input", "pl:hello"]);
  // a ranked room grants nobody cheats by name or by account, the operator excepted
  w.sb.HUNTX.GRANT.add("pl"); w.sb.HUNTX.GRANT.add("op");
  assert.deepEqual([w.sb.HUNTX.GRANT.has("pl"), w.sb.HUNTX.GRANT.has("op")], [false, true]);
  // outside a ranked room nothing of this applies
  w.sb.room.ranked = false; got.length = 0; send("pl", { t: "padm", p: {} });
  assert.deepEqual(got, ["pl:padm"]);
});

test("the owner's room commands (kick, move, message, close) do not run in a ranked room", () => {
  const w = world(); let ran = 0;
  w.sb.ACCOUNT = { session: () => ({ user: { id: "me" } }), online: true, api: async () => ({}), runCmd: () => ran++ };
  Object.assign(w.sb, { lobbyReset() {}, lobbySetOpt() {}, lobbySnapshot: () => ({}), sendEventAll() {}, sendEventTo() {}, renderLobby() {}, netShutdown() {}, paintSelMaps() {}, createRoom() {}, joinRoom() {}, lobbyStart() {}, hostStartMatch() {}, clientBeginMatch() {}, clientEnterMatch() {} });
  vm.createContext(w.sb); vm.runInContext(read("81-ranked-play"), w.sb);
  w.sb.ACCOUNT.runCmd({ cmd: "kick" }); assert.equal(ran, 1);
  w.sb.room.ranked = true; w.sb.ACCOUNT.runCmd({ cmd: "kick" }); w.sb.ACCOUNT.runCmd({ cmd: "close" }); assert.equal(ran, 1);
});

function boot109(sb) {
  Object.assign(sb, { hostStartMatch() {}, clientBeginMatch() {}, joinRoom: async () => "joined", netAlert() {}, sendEventAll() {}, netShutdown() {}, hideAll() {}, show() {}, RANK: { names: ["아이언", "브론즈", "실버", "골드", "플래티넘", "다이아몬드", "초월자", "불멸", "레디언트"] } });
  sb.RANKED = { on: () => !!sb.room.ranked };
  sb.ACCOUNT = { online: true, session: () => ({ token: "tok", user: { id: "Host1", guest: false } }), api: async () => ({}) };
  vm.createContext(sb);
  vm.runInContext(read("109-ranked-flow"), sb);
  return sb.RANKED;
}

test("bands show as the tier their rating sits in, and a placing account sees its count", () => {
  const w = world(), RK = boot109(w.sb);
  assert.equal(RK.bandName(1000), "아이언 1");
  assert.equal(RK.bandName(1350), "브론즈 1");
  assert.equal(RK.bandName(1050 + 2400), "레디언트");
  assert.equal(RK.bandName(null), "");
  w.sb.ACCOUNT.session = () => ({ user: { id: "a", placement: { done: 2, of: 5 }, rank: { t: 0, div: 1, rr: 0, into: 0, hidden: true } } });
  assert.match(RK.myLine(), /배치 2\/5/);
  w.sb.ACCOUNT.session = () => ({ user: { id: "a", placement: { done: 5, of: 5 }, rank: { t: 3, div: 2, rr: 1040, into: 40 } } });
  assert.equal(RK.myLine(), "골드 2 · 40/100 RR");
});

test("the host opens the match with its roster; a guest waits for it, then takes the ranked ticket (409 until the roster is in)", async () => {
  const w = world(), RK = boot109(w.sb), sb = w.sb;
  const sent = [], calls = [];
  sb.sendEventAll = (e) => sent.push(e);
  sb.NET.mode = "host"; sb.NET.id = "hp"; sb.room.ranked = true;
  sb.room.members = new Map([["hp", { name: "Host1", team: "atk" }], ["g1", { name: "guest1", team: "def" }], ["g2", { name: "Guest1", team: "def" }], ["g3", { name: "third", team: "atk" }]]);
  sb.ACCOUNT.api = async (action, body) => { calls.push(action); if (action === "ranked_start") return { id: "m1", rm: "RMTICKET", a: ["Host1", "third"], b: ["guest1"] }; throw new Error("unexpected " + action); };
  sb.hostStartMatch();
  assert.deepEqual(plain(RK.flow.roster()), { a: ["Host1", "third"], b: [] }, "by team; a name two players share belongs to neither (see ranked-integrity.test.js)");
  assert.equal((await RK.flow.current().start).rm, "RMTICKET");
  assert.deepEqual(plain(sent), [{ t: "rk-go", id: "m1" }]);
  // the host's own ticket waits for the roster, then asks as ranked for this room
  const seen = [];
  const t = await RK.flow.ticket("tok", async (a, b) => { seen.push([a, b]); return { ticket: "mt", ranked: true }; });
  assert.deepEqual(plain([t.ranked, seen]), [true, [["match_start", { token: "tok", ranked: true, room: "ABC123" }]]]);
  // the host's result: the host's own outcome on its team, kills per canonical account id
  sb.RESULTS = { rows: () => [{ a: { name: "guest1" }, s: { k: 4 } }, { a: { name: "HOST1" }, s: { k: 2 } }, { a: { name: "bot" }, s: { k: 9 } }] };
  sb.ACCOUNT.api = async (action, body) => { calls.push(action); sent.push(body); return {}; };
  w.listeners["match-finished"].forEach((fn) => fn({ detail: { outcome: "win" } }));
  await RK.flow.settled();
  assert.deepEqual(plain(sent[1]), { token: "tok", rm: "RMTICKET", w: "a", k: { guest1: 4, Host1: 2 } });
  // once only
  w.listeners["match-finished"].forEach((fn) => fn({ detail: { outcome: "loss" } }));
  await tick(); assert.equal(calls.filter((c) => c === "ranked_result").length, 1);

  // a guest: waits for the host's rk-go, and retries 409 (the roster is not in yet) before giving up
  const g = world(), RG = boot109(g.sb);
  g.sb.room.ranked = true; g.sb.NET.mode = "client";
  g.sb.clientBeginMatch();
  const order = []; let n = 0;
  const p = RG.flow.ticket("tok", async (a, b) => { order.push("ask"); if (++n < 2) throw Object.assign(new Error("not started"), { status: 409 }); return { ticket: "mt2", ranked: true }; });
  await tick(); assert.deepEqual(order, [], "it has not asked: the host's roster is not in");
  g.sb.NET.onEvent({ t: "rk-go", id: "m1" });
  const got = await p;
  assert.deepEqual([got.ticket, order.length], ["mt2", 2]);
  // a 403 (not in the roster) leaves the plain ticket to the caller
  g.sb.clientBeginMatch(); g.sb.NET.onEvent({ t: "rk-go" });
  assert.equal(await RG.flow.ticket("tok", async () => { throw Object.assign(new Error("no"), { status: 403 }); }), null);
  // not ranked, or a guest account: no ranked ticket at all
  g.sb.room.ranked = false;
  assert.equal(await RG.flow.ticket("tok", async () => assert.fail("asked")), null);
});

test("a ranked ticket is recognised from its signed payload", () => {
  const w = world(), RK = boot109(w.sb), enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url") + ".sig";
  assert.equal(RK.flow.isRanked(enc({ k: "match", r: 1, m: "x" })), true);
  assert.equal(RK.flow.isRanked(enc({ k: "match", r: 0 })), false);
  assert.equal(RK.flow.isRanked("garbage"), false);
});

test("a ranked room turns away guests and rooms out of range; the answer is read raw (ok:false is a verdict, not an error)", async () => {
  const w = world({ GAME_REQUEST: null }), RK = boot109(w.sb), sb = w.sb;
  let answer = { status: 200, data: { ok: false, ranked: true, range: 150, band: 1350 } }, posts = 0;
  sb.GAME_REQUEST = async (url, opts) => { posts++; assert.match(url, /a=ranked_can_join/); assert.deepEqual(JSON.parse(opts.body), { token: "tok", code: "ABCDEF" }); return { response: { status: answer.status }, data: answer.data }; };
  const alerts = []; let joined = 0;
  sb.netAlert = (m) => alerts.push(m);
  sb.joinRoom = async () => ++joined;
  vm.runInContext(read("109-ranked-flow"), vm.createContext(sb)); // wrap the stub as the game does
  await sb.joinRoom("abcdef");
  assert.equal(joined, 0); assert.match(alerts[0], /실력대\(브론즈 1 부근\)가 나와 너무 달라 들어갈 수 없습니다/);
  assert.match(sb.RANKED.joinMsg.text, /입장 범위가 넓어집니다/);
  // the same room within range, and a normal room
  answer = { status: 200, data: { ok: true, ranked: true, range: 300, band: 1350 } };
  await sb.joinRoom("ABCDEF"); // cached for a few seconds
  assert.equal(joined, 0);
  sb.RANKED.canJoin("QWERTY").then(() => {});
  assert.equal((await sb.RANKED.canJoin("QWERTY")).ok, true);
  assert.equal(sb.RANKED.joinNote({ ranked: false }), "");
  // an unknown room or a failed answer: the join itself says what is wrong
  answer = { status: 404, data: { ok: false, error: "없는 방입니다" } };
  assert.equal((await sb.RANKED.canJoin("NOPE01")).ok, true);
  // a guest account
  sb.ACCOUNT.session = () => ({ token: "tok", user: { id: "guest-1", guest: true } });
  assert.match(sb.RANKED.joinNote({ ranked: true, ok: true }), /로그인한 계정만/);
});

// the pending report queue of 44-account-sync
const account = read("44-account-sync").replace(/\r\n/g, "\n");
const flushSrc = account.slice(account.indexOf("  // A ranked report waits for the host's result"), account.indexOf('  addEventListener("match-finished"'));
function queue(pending, api) {
  const events = [], banners = [], timers = [];
  const c = { pending, api, Date, Promise, JSON, token: () => "t", sessionMatches: () => true, keepReports() {}, S: { user: {} }, localStorage: { setItem() {} }, L: (ko) => ko, banner: (m) => banners.push(m), CustomEvent: class { constructor(n, o) { this.type = n; this.detail = o && o.detail; } }, dispatchEvent: (e) => events.push(e), setTimeout: (fn, ms) => timers.push(ms), reporting: false };
  vm.createContext(c); vm.runInContext(flushSrc + "\nthis.flush = flushReports;", c);
  return { c, events, banners, timers };
}
test("a ranked report waits (425), takes the plain reward after two minutes (giveUp) and drops on 409; the server never hears our bookkeeping", async () => {
  const sent = [], answers = [Object.assign(new Error("wait"), { status: 425 }), Object.assign(new Error("wait"), { status: 425 }), { gain: 5, gold: 1, user: { level: 2 }, ranked: true, rr: 3 }];
  const q = queue([{ kills: 3, win: true, mt: "ticket", match: { s: [7, 1] }, rk: 1, at: Date.now() - 1000 }], async (a, b) => { sent.push(b); const r = answers.shift(); if (r instanceof Error) throw r; return r; });
  await q.c.flush();
  assert.equal(q.c.pending.length, 1, "kept: the host's result is not in yet");
  assert.deepEqual(plain([q.timers, "rk" in sent[0], "at" in sent[0], "giveUp" in sent[0]]), [[5000], false, false, false]);
  q.c.pending[0].at = Date.now() - 121000;
  await q.c.flush();
  assert.equal(sent[1].giveUp, true);
  answers.length = 1; await q.c.flush();
  assert.equal(q.c.pending.length, 0);
  assert.deepEqual(plain([q.events.length, q.events[0].type, q.events[0].detail.rr, "giveUp" in sent[2]]), [1, "account-reward", 3, true], "the plain reward is still asked for with giveUp while the clock is past two minutes");
  // a refused report (the player's result differs from the host's) is dropped, not retried for ever
  const q2 = queue([{ kills: 0, win: false, mt: "x", rk: 1, at: Date.now() }], async () => { throw Object.assign(new Error("다름"), { status: 409 }); });
  await q2.c.flush();
  assert.deepEqual([q2.c.pending.length, q2.banners.length], [0, 1]);
  // a plain report has no ranked bookkeeping and never gives up
  const sent3 = [], q3 = queue([{ kills: 1, win: true, mt: "y", match: {} }], async (a, b) => { sent3.push(b); return { gain: 1, gold: 1, user: {} }; });
  await q3.c.flush();
  assert.deepEqual(Object.keys(sent3[0]).sort(), ["kills", "match", "mt", "token", "win"]);
});
