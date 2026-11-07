const test = require("node:test");
const assert = require("node:assert/strict");
const { harness } = require("./api-harness");
// Ranked play was removed on 2026-11-07 (the owner's call), and its data with it: an account's RR, hidden MMR, placement,
// season record and AI rating, the season boards and what ranked matches kept. Match history, logs and owned skins stay.
const login = (h, id) => h.api("auth", { id, pw: id === "owner" ? "owner-password" : "password", device: "device-123" });
const OLD = { rr: 950, mmr: 1950, placed: 5, ssn: { n: 2, end: 1, played: 4, w: 3, need: 3 }, ssnLog: [{ n: 1, t: 3, rr: 950 }], ai: { rr: 420, played: 9, w: 5, best: 500 }, aiDay: { d: "2026-11-06", n: 30 }, rrDay: { d: "2026-11-06", n: 40 }, rmDone: ["abc"] };
const FIELDS = Object.keys(OLD);
const give = (h, id, extra) => { const u = h.user(id); Object.assign(u, OLD, extra); h.db.set("user:" + id, JSON.stringify(u)); };

test("an account's rank data is deleted when it is next read; its history and skins stay, and no answer carries a rank", async () => {
  const h = harness();
  await login(h, "player");
  give(h, "player", { hist: [{ mode: "std", map: "glacier", k: 3, win: true, rk: 1, t: h.now() }], own: { rifle: ["laurel"] } });
  const r = await login(h, "player");
  assert.equal(r.status, 200);
  const u = h.user("player");
  for (const k of FIELDS) assert.equal(k in u, false, k + " is gone from the account");
  assert.equal(u.hist.length, 1, "the match history stays");
  assert.ok(u.own.rifle.includes("laurel"), "a season skin it won stays");
  const me = await h.api("me", { token: r.token });
  for (const k of ["rank", "ai", "placement", "season"]) assert.equal(k in me.user, false, "me has no " + k);
  const cfg = await h.api("config");
  assert.equal("aiComp" in cfg.config, false);
  assert.deepEqual(Object.keys(cfg.config.rank).sort(), ["afkLeaveS", "afkWarnS", "leaveGraceS", "minHumans", "surrenderCoolS", "surrenderRound", "surrenderS", "surrenderVoteS"]);
});

test("the ranked actions are gone; a match ticket is one kind and a match pays as any other", async () => {
  const h = harness(), p = await login(h, "player");
  for (const a of ["ranked_start", "ranked_result", "ranked_void", "ranked_can_join", "leaderboard"]) assert.equal((await h.api(a, { token: p.token, room: "RNK001", code: "RNK001" })).status, 404, a);
  const mt = await h.api("match_start", { token: p.token, ranked: true, room: "RNK001" });
  assert.equal(mt.status, 200); assert.equal("ranked" in mt, false);
  h.advance(61000);
  const r = await h.api("progress", { token: p.token, mt: mt.ticket, kills: 4, win: true, match: { mode: "std", map: "glacier", s: [13, 7], aic: 1, n: 10 } });
  assert.equal(r.status, 200);
  for (const k of ["ranked", "rankedCounted", "rankedWhy", "placement", "rr", "rank", "rankBefore", "ai"]) assert.equal(k in r, false, "progress has no " + k);
  assert.equal(r.user.wins, 1); assert.ok(r.gain > 0 && r.gold > 0);
  const u = h.user("player");
  for (const k of FIELDS) assert.equal(k in u, false, k + " is never written");
  assert.equal("rk" in u.hist[0] || "ac" in u.hist[0] || "rr" in u.hist[0], false);
  // the owner can no longer set rank points
  const o = await login(h, "owner");
  assert.equal((await h.api("a_user_set", { atoken: o.atoken, id: "player", op: "rr", rr: 300 })).status, 400);
});

test("the season boards and the ranked-match keys go on the first request, then every account, a step a minute", async () => {
  const h = harness();
  // what an older server left: season boards, ranked matches, a player's open ranked match; the all-time boards stay
  for (const k of ["lb:1", "lb:2", "rm:abc", "rmres:abc", "rmroom:RNK001", "rmt:abc:bobby", "rmv:abc", "rmvoid:abc:bobby", "rmopen:bobby", "rstart:bobby"]) h.db.set(k, "x");
  h.db.set("lb:all:kills", "keep"); h.db.set("lbx", "keep");
  await login(h, "player");
  for (const k of ["lb:1", "lb:2", "rm:abc", "rmres:abc", "rmroom:RNK001", "rmt:abc:bobby", "rmv:abc", "rmvoid:abc:bobby", "rmopen:bobby", "rstart:bobby"]) assert.equal(h.db.has(k), false, k + " is deleted");
  assert.equal(h.db.get("lb:all:kills"), "keep"); assert.equal(h.db.get("lbx"), "keep");
  assert.equal(JSON.parse(h.db.get("purge:ranked")).at, 0);
  // accounts nobody reads keep their fields until the sweep reaches them
  await login(h, "bobby"); await login(h, "carol");
  give(h, "bobby", {}); give(h, "carol", { hist: [{ mode: "std", k: 1, rk: 1 }] });
  await h.api("config");
  assert.equal(h.user("bobby").rr, 950, "not before a minute has passed");
  h.advance(61000);
  await h.api("config");
  for (const id of ["bobby", "carol"]) for (const k of FIELDS) assert.equal(k in h.user(id), false, id + " " + k);
  assert.equal(h.user("carol").hist.length, 1);
  const st = JSON.parse(h.db.get("purge:ranked"));
  assert.equal(st.done, 1); assert.equal(st.users, 2);
  // done: it never runs again, even with new keys of that shape
  h.db.set("rm:new", "x"); h.advance(120000); await h.api("config");
  assert.equal(h.db.get("rm:new"), "x");
});
