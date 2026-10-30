const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { harness } = require("./api-harness");

// ── leaving a ranked match: the host reports who was away, the server decides and applies the loss ──
const login = (h, id) => h.api("auth", { id, pw: "password", device: "device-123" });
const squad = async (h, ids) => Object.fromEntries(await Promise.all(ids.map(async (id) => [id, (await login(h, id)).token])));
const ownerLogin = (h) => h.api("auth", { id: "owner", pw: "owner-password", device: "device-123" });
const setRR = async (h, ids, rr) => { const o = await ownerLogin(h); for (const id of ids) assert.equal((await h.api("a_user_set", { atoken: o.atoken, id, op: "rr", rr })).status, 200); };
const open = async (h, tok, a, b, o = {}) => {
  const room = o.room || "LVE001", host = a[0], all = a.concat(b);
  assert.equal((await h.api("room_up", { token: tok[host], code: room, ranked: true, players: all })).status, 200);
  const start = await h.api("ranked_start", { token: tok[host], room, a, b });
  assert.equal(start.status, 200);
  const mt = {};
  for (const id of all) if (!(o.skip || []).includes(id)) { const r = await h.api("match_start", { token: tok[id], ranked: true, room }); assert.equal(r.status, 200); mt[id] = r.ticket; }
  return { h, tok, a, b, room, start, mt, host };
};
const result = (m, gone, w = "a", k = {}) => { m.h.advance(61000); m.w = w; return m.h.api("ranked_result", { token: m.tok[m.host], rm: m.start.rm, w, k, gone }); };
const settle = (m, id, extra = {}) => m.h.api("progress", { token: m.tok[id], mt: m.mt[id], kills: 0, win: m.a.includes(id) === (m.w === "a"), match: { mode: "std", s: [7, 3] }, ...extra });
const IDS = ["player", "bobby", "carol", "dave1"];
const fresh = async (rr = 300) => { const h = harness(), tok = await squad(h, IDS); await setRR(h, IDS, rr); return { h, tok }; };

test("config: the leave, AFK and surrender settings have defaults, the game gets them, the owner page labels them", async () => {
  const h = harness(), R = h.config.rank;
  assert.deepEqual({ leaveRR: R.leaveRR, leaveGraceS: R.leaveGraceS, afkWarnS: R.afkWarnS, afkLeaveS: R.afkLeaveS, surrenderRound: R.surrenderRound, surrenderS: R.surrenderS, surrenderVoteS: R.surrenderVoteS, surrenderCoolS: R.surrenderCoolS },
    { leaveRR: 8, leaveGraceS: 60, afkWarnS: 90, afkLeaveS: 30, surrenderRound: 5, surrenderS: 240, surrenderVoteS: 15, surrenderCoolS: 60 });
  const c = await h.api("config");
  assert.equal(c.status, 200);
  assert.deepEqual(c.config.rank, { minHumans: 3, leaveGraceS: 60, afkWarnS: 90, afkLeaveS: 30, surrenderRound: 5, surrenderS: 240, surrenderVoteS: 15, surrenderCoolS: 60 });
  assert.equal("win" in c.config.rank || "loss" in c.config.rank || "leaveRR" in c.config.rank, false, "the RR numbers stay on the server");
  const admin = fs.readFileSync("admin.html", "utf8");
  for (const key of ["leaveRR", "leaveGraceS", "afkWarnS", "afkLeaveS", "surrenderRound", "surrenderS", "surrenderVoteS", "surrenderCoolS"]) assert.ok(admin.includes(`"rank.${key}"`), "admin.html labels rank." + key);
  // a value the owner changes is the one used
  const o = await ownerLogin(h), cur = (await h.api("a_config_get", { atoken: o.atoken })).config;
  cur.rank.leaveRR = 15; cur.rank.afkWarnS = 0;
  assert.equal((await h.api("a_config_set", { atoken: o.atoken, config: cur })).status, 200);
  const c2 = await h.api("config");
  assert.equal(c2.config.rank.afkWarnS, 0);
  assert.equal(c2.config.rank.leaveGraceS, 60, "the rest keep their defaults");
});

test("a player the host reports as away at the end gets a loss and the extra penalty; the others are untouched", async () => {
  const { h, tok } = await fresh();
  const m = await open(h, tok, ["player", "bobby"], ["carol", "dave1"]);
  const r = await result(m, { carol: { s: 200, end: 1 }, bobby: { s: 0, end: 0 } }, "a");
  assert.equal(r.status, 200); assert.equal(r.accepted, true); assert.equal(r.left, 1); assert.equal(r.applied, 1);
  const mmr0 = 1300; // 1000 + 300 RR
  // an even match: the loss is 12 RR, the penalty 8 more; MMR the same way (32 * 0.5 = 16, and 8)
  assert.equal(h.user("carol").rr, 300 - 12 - 8);
  assert.equal(h.user("carol").mmr, mmr0 - 16 - 8);
  assert.deepEqual(h.user("carol").rmDone, [m.start.id]);
  assert.equal(h.user("bobby").rr, 300, "a player the host listed but with no absence is not touched");
  assert.equal(h.user("dave1").rr, 300);
  // the log line the owner sees
  const log = h.db.get("ulog:carol").map((x) => JSON.parse(x)).find((x) => x.d && x.d.left);
  assert.ok(log && log.m.startsWith("랭크 이탈"), "the account's log says he left");
  // the result is stored once; asking again changes nothing, the penalty is not applied twice
  const again = await h.api("ranked_result", { token: tok.player, rm: m.start.rm, w: "b", gone: { dave1: { s: 500, end: 1 } } });
  assert.equal(again.status, 200); assert.equal(again.duplicate, true); assert.equal(again.w, "a"); assert.equal(again.applied, 0);
  assert.equal(h.user("carol").rr, 300 - 20); assert.equal(h.user("dave1").rr, 300, "a later report cannot name more players");
});

test("a drop that came back inside the window is not leaving; one that lasted the window or more is", async () => {
  const { h, tok } = await fresh();
  const m = await open(h, tok, ["player", "bobby"], ["carol", "dave1"]);
  // carol was away 59 s and is back; dave1 was away exactly the window and is back
  const r = await result(m, { carol: { s: 59, end: 0 }, dave1: { s: 60, end: 0 } }, "a");
  assert.equal(r.left, 1);
  assert.equal(h.user("carol").rr, 300, "back inside the window: no penalty");
  assert.equal(h.user("dave1").rr, 280, "away for the whole window: left, even though he is back");
  // the numbers come from the owner's settings
  const g = await fresh();
  const o = await ownerLogin(g.h), cur = (await g.h.api("a_config_get", { atoken: o.atoken })).config;
  cur.rank.leaveGraceS = 10; cur.rank.leaveRR = 0;
  await g.h.api("a_config_set", { atoken: o.atoken, config: cur });
  const n = await open(g.h, g.tok, ["player", "bobby"], ["carol", "dave1"]);
  await result(n, { carol: { s: 9, end: 0 }, dave1: { s: 10, end: 0 } }, "a");
  assert.equal(g.h.user("carol").rr, 300);
  assert.equal(g.h.user("dave1").rr, 288, "no extra penalty when leaveRR is 0: just the loss");
});

test("only an account that sat in the room can be reported, never the host; too few humans: nobody is penalised", async () => {
  const { h, tok } = await fresh();
  // dave1 is listed but never took a ticket: a host cannot make him lose RR by naming him
  const m = await open(h, tok, ["player", "bobby"], ["carol", "dave1"], { skip: ["dave1"] });
  const r = await result(m, { dave1: { s: 999, end: 1 }, player: { s: 999, end: 1 }, nobody: { s: 999, end: 1 }, CAROL: { s: 99, end: 0 } }, "a");
  assert.equal(r.left, 1, "only carol, matched without regard to case");
  assert.equal(h.user("dave1").rr, 300); assert.equal(h.user("player").rr, 300);
  assert.equal(h.user("carol").rr, 280);
  // two humans only: below rank.minHumans, a leave is not penalised (RR never moves in such a match)
  const g = await fresh();
  const n = await open(g.h, g.tok, ["player"], ["carol"]);
  const r2 = await result(n, { carol: { s: 999, end: 1 } }, "a");
  assert.equal(r2.left, 0); assert.equal(g.h.user("carol").rr, 300);
  // malformed reports are ignored
  const k = await fresh();
  const p = await open(k.h, k.tok, ["player", "bobby"], ["carol", "dave1"]);
  const r3 = await result(p, { carol: "gone", dave1: null, bobby: { s: "x" } }, "a");
  assert.equal(r3.status, 200); assert.equal(r3.left, 0);
});

test("a placing player who left loses MMR and uses up a placement match; the last one sets his RR", async () => {
  const h = harness(), tok = await squad(h, IDS);
  const m = await open(h, tok, ["player", "bobby"], ["carol", "dave1"]);
  const before = h.user("carol"), placed0 = before.placed | 0, mmr0 = Number.isFinite(before.mmr) ? before.mmr : 1000;
  await result(m, { carol: { s: 0, end: 1 } }, "a");
  const u = h.user("carol");
  assert.equal(u.placed, placed0 + 1);
  assert.equal(u.mmr, mmr0 - 60 - 8, "placement swings hard (K 120 * 0.5), and the extra on top");
  assert.equal(u.rr | 0, before.rr | 0, "RR stays hidden while placing");
});

test("a leaver's own report afterwards pays the plain reward, no RR, and is not a second loss", async () => {
  const { h, tok } = await fresh();
  const m = await open(h, tok, ["player", "bobby"], ["carol", "dave1"]);
  await result(m, { carol: { s: 0, end: 1 } }, "a");
  const rrAfter = h.user("carol").rr;
  // his team lost; had it won he would still get nothing for the win
  const out = {};
  for (let pass = 0; pass < 2; pass++) for (const id of IDS) if (!out[id] || out[id].status === 425) out[id] = await settle(m, id, { kills: id === "carol" ? 5 : 0 });
  assert.equal(out.carol.status, 200); assert.equal(out.carol.rankedCounted, false); assert.equal(out.carol.rankedWhy, "left"); assert.equal(out.carol.rr, 0);
  assert.equal(h.user("carol").rr, rrAfter);
  assert.equal(h.user("carol").kills || 0, 0, "kills he claims do not count");
  for (const id of ["player", "bobby", "dave1"]) { assert.equal(out[id].rankedCounted, true, id); }
  // the other team's winners still gain
  assert.ok(h.user("player").rr > 300 && h.user("bobby").rr > 300);
  // a leaver on the winning side gets no win either
  const g = await fresh();
  const n = await open(g.h, g.tok, ["player", "bobby"], ["carol", "dave1"]);
  await result(n, { bobby: { s: 0, end: 1 } }, "a");
  assert.equal(g.h.user("bobby").rr, 300 - 12 - 8, "left from the winning team: a loss all the same");
  const o2 = {};
  for (let pass = 0; pass < 2; pass++) for (const id of IDS) if (!o2[id] || o2[id].status === 425) o2[id] = await settle(n, id);
  assert.equal(o2.bobby.rankedWhy, "left"); assert.equal(o2.bobby.rr, 0);
  assert.equal(g.h.user("bobby").wins || 0, 0);
});

test("no result ever comes: the player who left is judged at his next ranked start, not before", async () => {
  const { h, tok } = await fresh();
  const m = await open(h, tok, ["player", "bobby"], ["carol", "dave1"]);
  assert.ok(h.db.get("rmopen:carol"), "the match he sits in is remembered");
  // carol quit mid-match; the host's result never arrived. A new ranked room, soon after: too early to say
  h.advance(30000);
  const e = await open(h, tok, ["bobby", "dave1"], ["player", "carol"], { room: "LVE002" });
  assert.equal(h.user("carol").rr, 300, "the first match is too young to be called over");
  assert.equal(h.db.get("rmopen:carol"), e.start.id, "he is in the new match now");
  // the same, but long after: carol did not settle the first match
  const f = await fresh();
  const m1 = await open(f.h, f.tok, ["player", "bobby"], ["carol", "dave1"]);
  f.h.advance(121000);
  // bobby stayed to the end: his client waited, then gave up and took the plain reward
  const gu = await settle(m1, "bobby", { giveUp: true });
  assert.equal(gu.status, 200); assert.equal(gu.rankedWhy, "no_result");
  assert.ok(!f.h.db.get("rmopen:bobby"), "a settled match is not judged later");
  const m2 = await open(f.h, f.tok, ["bobby", "dave1"], ["player", "carol"], { room: "LVE002" });
  assert.equal(f.h.user("carol").rr, 280, "carol never settled and left: a loss and the extra penalty");
  assert.equal(f.h.user("bobby").rr, 300, "bobby settled it");
  assert.equal(f.h.user("carol").rmDone[0], m1.start.id);
  assert.equal(f.h.db.get("rmopen:carol"), m2.start.id);
  // it happens once
  await f.h.api("match_start", { token: f.tok.carol, ranked: true, room: "LVE002" });
  assert.equal(f.h.user("carol").rr, 280);
});

test("no result and the host is gone for everybody: a ticketed player's word frees the guests, the host still loses", async () => {
  const { h, tok } = await fresh();
  const m = await open(h, tok, ["player", "bobby"], ["carol", "dave1"]);
  h.advance(121000);
  // the host left; carol and dave1 saw it (they say so), bobby just closed the page
  assert.equal((await h.api("ranked_void", { token: tok.carol, room: m.room })).status, 200);
  assert.equal((await h.api("ranked_void", { token: tok.dave1, room: m.room })).status, 200);
  // someone who is not in the match cannot say it, nor a guest account
  const x = await login(h, "erin1");
  assert.equal((await h.api("ranked_void", { token: x.token, room: m.room })).status, 409);
  const n = await open(h, tok, ["carol", "dave1"], ["player", "bobby"], { room: "LVE002" });
  assert.equal(h.user("carol").rr, 300, "carol was a guest of a vanished host");
  assert.equal(h.user("dave1").rr, 300);
  assert.equal(h.user("player").rr, 280, "the host did not end the match");
  assert.equal(h.user("bobby").rr, 300, "bobby, a guest of the same host: the match was void, he is not blamed");
  assert.ok(n.start.id);
});

test("a result that named a leaver but could not be applied is applied at his next ranked start", async () => {
  const { h, tok } = await fresh();
  const m = await open(h, tok, ["player", "bobby"], ["carol", "dave1"]);
  // the save for carol fails during ranked_result (the host's call still succeeds)
  h.failCommit();
  const r = await result(m, { carol: { s: 0, end: 1 } }, "a");
  assert.equal(r.status, 200); assert.equal(r.left, 1); assert.equal(r.applied, 0);
  assert.equal(h.user("carol").rr, 300);
  await open(h, tok, ["bobby", "dave1"], ["player", "carol"], { room: "LVE002" });
  assert.equal(h.user("carol").rr, 280, "applied when he started the next ranked match");
});

test("a player who left is not waited for, and his vote does not count for or against the result", async () => {
  const { h, tok } = await fresh();
  const m = await open(h, tok, ["player", "bobby"], ["carol", "dave1"]);
  await result(m, { carol: { s: 0, end: 1 } }, "a");
  // the others settle at once (no 60 s wait for carol's vote): the last voter, dave1, settles in the first pass
  const out = {};
  for (let pass = 0; pass < 2; pass++) for (const id of ["player", "bobby", "dave1"]) if (!out[id] || out[id].status === 425) out[id] = await settle(m, id);
  for (const id of ["player", "bobby", "dave1"]) { assert.equal(out[id].status, 200, id); assert.equal(out[id].rankedCounted, true, id); }
  // carol saying the result is wrong (a bot played her seat to the end) cannot dispute it
  const c = await settle(m, "carol", { win: true });
  assert.equal(c.status, 409);
  assert.equal(h.user("carol").rr, 280);
});
