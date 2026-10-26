const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { harness } = require("./api-harness");

// ── server: nobody is credited before the others could dispute; averages only count who played ──
const login = (h, id) => h.api("auth", { id, pw: "password", device: "device-123" });
const squad = async (h, ids) => Object.fromEntries(await Promise.all(ids.map(async (id) => [id, (await login(h, id)).token])));
const ownerLogin = (h) => h.api("auth", { id: "owner", pw: "owner-password", device: "device-123" });
const setRR = async (h, ids, rr) => { const o = await ownerLogin(h); for (const id of ids) assert.equal((await h.api("a_user_set", { atoken: o.atoken, id, op: "rr", rr })).status, 200); };
const GRACE = 60000;
// a ranked match: the first of `a` is the host; ids in o.skip never take a ticket (listed, but not in the room)
const open = async (h, tok, a, b, o = {}) => {
  const room = o.room || "RNK001", host = a[0], all = a.concat(b);
  assert.equal((await h.api("room_up", { token: tok[host], code: room, ranked: true, players: all })).status, 200);
  const start = await h.api("ranked_start", { token: tok[host], room, a, b });
  assert.equal(start.status, 200);
  const mt = {};
  for (const id of all) if (!(o.skip || []).includes(id)) { const r = await h.api("match_start", { token: tok[id], ranked: true, room }); assert.equal(r.status, 200); mt[id] = r.ticket; }
  return { h, tok, a, b, room, start, mt, host };
};
const finish = async (m, w = "a", k = {}) => {
  m.h.advance(61000); m.w = w;
  const r = await m.h.api("ranked_result", { token: m.tok[m.host], rm: m.start.rm, w, k });
  assert.equal(r.status, 200);
  return r;
};
// what the client sends: the truth about its team's outcome, unless `win` says otherwise
const settle = (m, id, extra = {}) => m.h.api("progress", { token: m.tok[id], mt: m.mt[id], kills: 0, win: m.a.includes(id) === (m.w === "a"), match: { mode: "std", s: [7, 3] }, ...extra });
// the client's loop: ask again after a 425 (a second pass is enough, the last voter settles in the first)
const settleAll = async (m, ids) => {
  const out = {};
  for (let pass = 0; pass < 2; pass++) for (const id of ids) if (!out[id] || out[id].status === 425) out[id] = await settle(m, id);
  return out;
};
const WAIT = "다른 플레이어의 결과 확인을 기다리는 중입니다";

test("the host reports first: 425 until the others have voted, then a dissenting majority leaves the host uncounted", async () => {
  const ids = ["player", "carol", "dave1", "erin1"], h = harness(), tok = await squad(h, ids);
  await setRR(h, ids, 300);
  // nobody but the host on his team: his word against team b's
  const m = await open(h, tok, ["player"], ["carol", "dave1", "erin1"]);
  await finish(m, "a");
  // the host (a) says a won and asks to settle at once: nothing is credited, and he is told to wait
  const first = await settle(m, "player");
  assert.equal(first.status, 425); assert.equal(first.error, WAIT);
  assert.equal(h.user("player").rr, 300); assert.equal(h.user("player").matches || 0, 0);
  assert.equal(h.db.get("rmv:" + m.start.id + ":player"), "1", "his vote is recorded before he waits");
  // team b (two of its three) report the truth about their match: it is not what the host said
  for (const id of ["carol", "dave1"]) assert.equal((await settle(m, id, { win: true })).status, 409);
  // one voter left; whoever asks now gets the same answer, the host included
  assert.equal((await settle(m, "player")).status, 425);
  const e = await settle(m, "erin1");
  assert.equal(e.status, 200); assert.equal(e.rankedCounted, false); assert.equal(e.rankedWhy, "disputed");
  const r = await settle(m, "player");
  assert.equal(r.status, 200); assert.equal(r.rankedCounted, false); assert.equal(r.rankedWhy, "disputed");
  assert.equal(h.user("player").rr, 300, "the host keeps his RR");
});

test("everybody agrees: all are counted, with the same decision, whoever asks first", async () => {
  const ids = ["player", "bobby", "carol", "dave1"], h = harness(), tok = await squad(h, ids);
  await setRR(h, ids, 300);
  const m = await open(h, tok, ["player", "bobby"], ["carol", "dave1"]);
  await finish(m, "a");
  const first = {};
  for (const id of ["player", "bobby", "carol"]) { first[id] = await settle(m, id); assert.equal(first[id].status, 425, id); assert.equal(first[id].error, WAIT); }
  const last = await settle(m, "dave1");
  assert.equal(last.status, 200); assert.equal(last.rankedCounted, true);
  const rest = {};
  for (const id of ["player", "bobby", "carol"]) { rest[id] = await settle(m, id); assert.equal(rest[id].status, 200, id); assert.equal(rest[id].rankedCounted, true, id); assert.equal(rest[id].rankedWhy, "", id); }
  assert.ok(h.user("player").rr > 300 && h.user("bobby").rr > 300, "the winners gain");
  assert.ok(h.user("carol").rr < 300 && h.user("dave1").rr < 300, "the losers lose");
  // a replay is the receipt, and the match settles once
  assert.deepEqual(await settle(m, "player"), rest.player);
  assert.equal(h.user("player").matches, 1);
});

test("a voter who never reports holds the others for 60 s after the result, then settlement goes on", async () => {
  const ids = ["player", "bobby", "carol", "dave1"], h = harness(), tok = await squad(h, ids);
  await setRR(h, ids, 300);
  const m = await open(h, tok, ["player", "bobby"], ["carol", "dave1"]);
  await finish(m, "a");
  for (const id of ["player", "bobby", "carol"]) assert.equal((await settle(m, id)).status, 425, id); // dave1 never reports
  h.advance(GRACE - 1000);
  assert.equal((await settle(m, "player")).status, 425, "still inside the grace");
  h.advance(1000);
  for (const id of ["player", "bobby", "carol"]) { const r = await settle(m, id); assert.equal(r.status, 200, id); assert.equal(r.rankedCounted, true, id); }
  // and he, late, is judged like the rest
  const late = await settle(m, "dave1");
  assert.equal(late.status, 200); assert.equal(late.rankedCounted, true);
});

test("giveUp settles at once with the votes cast so far", async () => {
  const ids = ["player", "bobby", "carol", "dave1"], h = harness(), tok = await squad(h, ids);
  await setRR(h, ids, 300);
  const m = await open(h, tok, ["player", "bobby"], ["carol", "dave1"]);
  await finish(m, "a");
  assert.equal((await settle(m, "player")).status, 425);
  const gu = await settle(m, "player", { giveUp: true });
  assert.equal(gu.status, 200); assert.equal(gu.rankedCounted, true); assert.ok(h.user("player").rr > 300);
  // no result at all: the plain reward, as before
  const n = await open(h, tok, ["bobby", "player"], ["carol", "dave1"], { room: "RNK002" });
  h.advance(61000);
  assert.equal((await settle(n, "carol")).status, 425);
  const none = await settle(n, "carol", { giveUp: true });
  assert.equal(none.status, 200); assert.equal(none.rankedCounted, false); assert.equal(none.rankedWhy, "no_result");
});

test("the wait does not use up the progress rate limit, and settlement right after it is not rate limited", async () => {
  const ids = ["player", "bobby", "carol", "dave1"], h = harness(), tok = await squad(h, ids);
  await setRR(h, ids, 300);
  const m = await open(h, tok, ["player", "bobby"], ["carol", "dave1"]);
  assert.equal((await settle(m, "player")).status, 425, "no result yet");
  await finish(m, "a");
  for (let i = 0; i < 6; i++) assert.equal((await settle(m, "player")).status, 425, "retry " + i); // never 429
  for (const id of ["bobby", "carol"]) assert.equal((await settle(m, id)).status, 425);
  assert.equal((await settle(m, "dave1")).status, 200);
  const r = await settle(m, "player");
  assert.equal(r.status, 200, "the first accepted report is not rate limited"); assert.equal(r.rankedCounted, true);
});

test("a team average counts the accounts that took a ticket, not the ones the host merely listed", async () => {
  const ids = ["player", "bobby", "carol", "dave1", "erin1", "frank"], h = harness(), tok = await squad(h, ids);
  await setRR(h, ["player", "bobby", "erin1", "carol"], 500);
  await setRR(h, ["dave1", "frank"], 2000); // strong accounts listed on the other side that never sat in the room
  const mmr = (id) => h.user(id).mmr;
  assert.ok(mmr("dave1") > 2500 && mmr("player") < 1600);
  // a win over a team that is really just carol: an even match
  const m = await open(h, tok, ["player", "bobby", "erin1"], ["carol", "dave1", "frank"], { skip: ["dave1", "frank"] });
  const rec = JSON.parse(h.db.get("rm:" + m.start.id));
  assert.equal(rec.mmr.dave1, mmr("dave1"), "every listed account's MMR is kept at the start");
  assert.ok(Number.isFinite(rec.avgA) && rec.avgB > mmr("carol"), "the record keeps the listed averages");
  await finish(m, "a");
  const out = await settleAll(m, ["player", "bobby", "erin1", "carol"]);
  for (const id of ["player", "bobby", "erin1"]) { assert.equal(out[id].status, 200, id); assert.equal(out[id].rankedCounted, true, id); assert.equal(out[id].rr, 20, id + ": the odds were even"); }
  assert.equal(out.carol.rr, -12);
  // a team with nobody at the table takes the other team's average
  const n = await open(h, tok, ["player", "bobby", "erin1"], ["dave1", "frank"], { room: "RNK002", skip: ["dave1", "frank"] });
  await finish(n, "a");
  const o2 = await settleAll(n, ["player", "bobby", "erin1"]);
  for (const id of ["player", "bobby", "erin1"]) { assert.equal(o2[id].status, 200, id); assert.equal(o2[id].rankedCounted, true, id); assert.equal(o2[id].rr, 20, id); }
});

test("one loser saying he won does not void a match the other winners stand by", async () => {
  const ids = ["player", "bobby", "carol", "dave1", "erin1", "frank"], h = harness(), tok = await squad(h, ids);
  await setRR(h, ids, 300);
  // carol is the only real player of team b (the host lists two accounts that never sat in the room next to her)
  const m = await open(h, tok, ["player", "bobby", "erin1"], ["carol", "dave1", "frank"], { skip: ["dave1", "frank"] });
  await finish(m, "a");
  assert.equal((await settle(m, "carol", { win: true })).status, 409);
  const r = await settle(m, "player");
  assert.equal(r.status, 425);
  const rest = await settleAll(m, ["bobby", "erin1", "player"]);
  for (const id of ["player", "bobby", "erin1"]) { assert.equal(rest[id].status, 200, id); assert.equal(rest[id].rankedCounted, true, id); assert.ok(h.user(id).rr > 300, id + " gains RR"); }
});

test("ghosts listed on a team cannot dilute its dissent, nor stand by the host's result", async () => {
  const ids = ["player", "bobby", "carol", "dave1", "erin1", "frank"], h = harness(), tok = await squad(h, ids);
  await setRR(h, ids, 300);
  // the host and carol are the only real players; the host lists two accounts that never sat in the room on each team
  const m = await open(h, tok, ["player", "bobby", "erin1"], ["carol", "dave1", "frank"], { skip: ["bobby", "erin1", "dave1", "frank"] });
  await finish(m, "a");
  assert.equal((await settle(m, "carol", { win: true })).status, 409);
  const r = await settle(m, "player");
  assert.equal(r.status, 200); assert.equal(r.rankedCounted, false); assert.equal(r.rankedWhy, "disputed");
  assert.equal(h.user("player").rr, 300);
});

// ── client: the host's roster leaves out a name two people in the room share ──
test("the host's roster leaves out a name that two people in the room carry; the host's own seat stays", async () => {
  const read = (name) => fs.readFileSync(fs.readdirSync("js/legacy").filter((f) => f.startsWith(name)).map((f) => "js/legacy/" + f)[0], "utf8");
  const node = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => "" : node()), set: () => true, apply: () => node() });
  const sb = {
    console, Date, Map, Set, Promise, JSON, Math, Object, Array, String, Number, Error, atob, URL, setTimeout, clearTimeout, setInterval() {},
    localStorage: { getItem: () => null, setItem() {} }, document: { getElementById: () => null, createElement: () => node(), head: node(), body: node() },
    addEventListener() {}, GAME_LANG: "ko", banner() {},
    room: { ranked: true, members: new Map(), code: "ABC123" }, NET: { mode: "host", room: "ABC123", id: "hp", onEvent() {} },
    hostStartMatch() {}, clientBeginMatch() {}, joinRoom: async () => {}, netAlert() {}, sendEventAll() {}, netShutdown() {}, hideAll() {}, show() {},
    RANK: { names: [] },
  };
  sb.window = sb; sb.RANKED = {};
  sb.ACCOUNT = { online: true, session: () => ({ token: "tok", user: { id: "Host1", guest: false } }), api: async () => ({}) };
  vm.createContext(sb);
  vm.runInContext(read("109-ranked-flow"), sb);
  const roster = (members) => { sb.room.members = new Map(members); return JSON.parse(JSON.stringify(sb.RANKED.flow.roster())); };
  // unique names: every account has a seat, by team
  assert.deepEqual(roster([["hp", { name: "Host1", team: "atk" }], ["p1", { name: "alice", team: "atk" }], ["p2", { name: "bob", team: "def" }]]), { a: ["Host1", "alice"], b: ["bob"] });
  // a guest who names himself after another player takes nobody's seat: neither gets one (case does not matter)
  assert.deepEqual(roster([["hp", { name: "Host1", team: "atk" }], ["p1", { name: "alice", team: "atk" }], ["p2", { name: "Alice", team: "def" }], ["p3", { name: "bob", team: "def" }]]), { a: ["Host1"], b: ["bob"] });
  // three of a kind, too
  assert.deepEqual(roster([["hp", { name: "Host1", team: "atk" }], ["p1", { name: "x", team: "atk" }], ["p2", { name: "X", team: "def" }], ["p3", { name: "x", team: "def" }]]), { a: ["Host1"], b: [] });
  // somebody wearing the host's name: the host's account is the one that is signed in here, so his seat stays
  assert.deepEqual(roster([["hp", { name: "Host1", team: "atk" }], ["p1", { name: "HOST1", team: "def" }], ["p2", { name: "bob", team: "def" }]]), { a: ["Host1"], b: ["bob"] });
  // a player without a seat just takes the plain ticket: one 403, no retries
  sb.NET.mode = "client";
  sb.NET.onEvent({ t: "rk-go", id: "m1" });
  let asked = 0;
  assert.equal(await sb.RANKED.flow.ticket("tok", async () => { asked++; throw Object.assign(new Error("no"), { status: 403 }); }), null);
  assert.equal(asked, 1);
});
