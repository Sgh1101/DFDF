// The all-time boards (kills, XP / level, wins, matches played, and the clans by the XP of their members): sorted sets written
// only by a match with a valid ticket, cached for ten seconds like the season board, with guests and banned accounts left out
// and the signed-in account's own place given even when it is outside the list.
const test = require("node:test"), assert = require("node:assert/strict");
const { harness } = require("./api-harness");
let n = 0;
async function acct(h, id) {
  const r = await h.api("auth", { id, pw: "password", device: "dev-" + id }, { "x-forwarded-for": "10.2." + (n >> 8) + "." + (n++ & 255) });
  assert.equal(r.status, 200, JSON.stringify(r));
  return r;
}
const put = (h, id, edit) => { const u = h.user(id); edit(u); h.db.set("user:" + id.toLowerCase(), JSON.stringify(u)); };
const owner = (h) => h.api("auth", { id: "owner", pw: "owner-password", device: "dev-owner" }, { "x-forwarded-for": "10.9.9.9" });
// one match with a valid ticket (a minute of play), reported with this many kills; `noTicket` reports without one
async function play(h, p, { kills = 0, win = true, noTicket = false } = {}) {
  const t = await h.api("match_start", { token: p.token });
  assert.equal(t.status, 200, JSON.stringify(t));
  h.advance(61000);
  const r = await h.api("progress", { token: p.token, mt: noTicket ? "" : t.ticket, win, outcome: win ? "win" : "loss", kills, match: { mode: "std", s: win ? [13, 7] : [7, 13] } });
  h.advance(21000);
  return r;
}
const board = async (h, kind, body = {}) => { const r = await h.api("board", { kind, ...body }); assert.equal(r.status, 200, JSON.stringify(r)); return r; };
const levelOf = (xp) => Math.floor((Math.sqrt(1 + 8 * xp / 100) - 1) / 2) + 1; // 100 XP a level, the harness default
const names = (r) => r.rows.map((x) => x.name);

test("a match with a valid ticket puts the account on the kills, XP, wins and matches boards with its totals; a match without one does nothing", async () => {
  const h = harness(), a = await acct(h, "alice"), b = await acct(h, "bobby");
  assert.deepEqual((await board(h, "kills")).rows, [], "nobody yet");
  const bad = await play(h, a, { kills: 9, noTicket: true });
  assert.equal(bad.status, 409);
  h.advance(11000);
  assert.deepEqual((await board(h, "kills")).rows, [], "no ticket, no place");
  await play(h, a, { kills: 7 });
  await play(h, b, { kills: 3, win: false });
  h.advance(11000);
  const k = await board(h, "kills");
  assert.deepEqual(k.rows.map((x) => [x.pos, x.name, x.v]), [[1, "alice", 7], [2, "bobby", 3]]);
  assert.deepEqual((await board(h, "wins")).rows.map((x) => [x.name, x.v]), [["alice", 1], ["bobby", 0]]);
  // equal totals: the sorted set's own order for equal scores, the later name first
  assert.deepEqual((await board(h, "matches")).rows.map((x) => [x.name, x.v]), [["bobby", 1], ["alice", 1]]);
  const lv = await board(h, "level");
  assert.deepEqual(lv.rows.map((x) => x.name), ["alice", "bobby"]);
  assert.equal(lv.rows[0].v, h.user("alice").xp); assert.equal(lv.rows[0].lv, levelOf(h.user("alice").xp));
  assert.equal(JSON.stringify(k).includes("pass"), false);
});

test("the boards hold totals: a replayed report counts once, and an account from before the boards arrives with everything it had", async () => {
  const h = harness(), a = await acct(h, "veteran");
  put(h, "veteran", (u) => { u.kills = 500; u.wins = 40; u.matches = 90; u.xp = 5000; });
  const t = await h.api("match_start", { token: a.token });
  h.advance(61000);
  const rep = { token: a.token, mt: t.ticket, win: true, outcome: "win", kills: 4, match: { mode: "std", s: [13, 5] } };
  const first = await h.api("progress", rep), again = await h.api("progress", rep);
  assert.equal(first.status, 200); assert.deepEqual(again, first);
  h.advance(11000);
  const k = await board(h, "kills", { token: a.token });
  assert.deepEqual(k.rows.map((x) => [x.name, x.v]), [["veteran", 504]]);
  assert.deepEqual((await board(h, "wins")).rows.map((x) => x.v), [41]);
  assert.deepEqual((await board(h, "matches")).rows.map((x) => x.v), [91]);
  const lv = (await board(h, "level")).rows[0];
  assert.equal(lv.v, h.user("veteran").xp); assert.ok(lv.v > 5000); assert.equal(lv.lv, levelOf(lv.v)); assert.ok(lv.lv >= 10);
});

test("ordering: highest first; the list is cut at n and the account's own place is given even outside it", async () => {
  const h = harness(), ps = [];
  for (const [id, kills] of [["p1", 9], ["p2", 5], ["p3", 12], ["p4", 1], ["p5", 7]]) { const p = await acct(h, id); ps.push(p); await play(h, p, { kills }); }
  h.advance(11000);
  const all = await board(h, "kills");
  assert.deepEqual(all.rows.map((x) => [x.pos, x.name, x.v]), [[1, "p3", 12], [2, "p1", 9], [3, "p5", 7], [4, "p2", 5], [5, "p4", 1]]);
  assert.equal(all.me, null, "no token: no place");
  const top2 = await board(h, "kills", { n: 2, token: ps[1].token });
  assert.deepEqual(names(top2), ["p3", "p1"]);
  assert.deepEqual(top2.me, { name: "p2", pos: 4, v: 5 }, "p2 is fourth, outside the two shown");
  assert.deepEqual((await board(h, "kills", { n: 2, token: ps[2].token })).me, { name: "p3", pos: 1, v: 12 });
  // an account that has not played a ticketed match: no place, its own number
  const fresh = await acct(h, "fresh");
  put(h, "fresh", (u) => { u.kills = 4; });
  assert.deepEqual((await board(h, "kills", { token: fresh.token })).me, { name: "fresh", pos: null, v: 4 });
  // level rows give the level
  const lv = await board(h, "level", { token: ps[0].token });
  assert.ok(lv.me.lv >= 1 && lv.me.pos >= 1);
  assert.equal((await h.api("board", { kind: "nonsense" })).status, 400);
});

test("the list is cached for ten seconds like the season board", async () => {
  const h = harness(), a = await acct(h, "cacher"), b = await acct(h, "cached2");
  await play(h, a, { kills: 2 }); await play(h, b, { kills: 5 });
  h.advance(11000);
  assert.deepEqual(names(await board(h, "kills")), ["cached2", "cacher"]);
  put(h, "cached2", (u) => { u.ban = { reason: "t", until: 0, at: h.now() }; });
  h.advance(9000);
  assert.deepEqual(names(await board(h, "kills")), ["cached2", "cacher"], "nine seconds on: still the list that was made");
  h.advance(2000);
  assert.deepEqual(names(await board(h, "kills")), ["cacher"], "eleven seconds on: made again");
  // each board has its own cache, and a smaller n is cut from a bigger one
  assert.deepEqual(names(await board(h, "wins", { n: 1 })), ["cacher"]);
});

test("guests and banned accounts are left out; the owner's ban takes an account off, and it comes back with its next match", async () => {
  const h = harness(), a = await acct(h, "honest"), c = await acct(h, "cheater"), o = await owner(h);
  const g = await h.api("guest", { device: "guest-lb-1" }, { "x-forwarded-for": "10.8.8.8" });
  const gm = await h.api("match_start", { token: g.token });
  assert.equal(gm.status, 200, "a guest can take a ticket and report a match");
  h.advance(61000);
  const gp = await h.api("progress", { token: g.token, mt: gm.ticket, win: true, outcome: "win", kills: 30, match: { mode: "std", s: [13, 0] } });
  assert.equal(gp.status, 200, JSON.stringify(gp)); h.advance(21000);
  await play(h, a, { kills: 3 });
  await play(h, c, { kills: 20 });
  h.advance(11000);
  assert.deepEqual(names(await board(h, "kills")), ["cheater", "honest"], "no guest");
  assert.equal((await h.api("a_user_set", { atoken: o.atoken, id: "cheater", op: "ban", days: 0, reason: "x" })).status, 200);
  h.advance(11000);
  for (const k of ["kills", "level", "wins", "matches"]) assert.deepEqual(names(await board(h, k)), ["honest"], k);
  assert.equal((await h.api("board", { kind: "kills", token: c.token })).me, null, "a banned account gets no place either");
  // a ban that runs out: the list checks the account too, so an old entry never shows a banned name
  put(h, "honest", (u) => { u.ban = { reason: "t", until: h.now() + 5000, at: h.now() }; });
  h.advance(11000);
  assert.deepEqual(names(await board(h, "kills")), ["honest"], "the ban ran out");
  await h.api("a_user_set", { atoken: o.atoken, id: "cheater", op: "unban" });
  await play(h, c, { kills: 1 });
  h.advance(11000);
  assert.deepEqual(names(await board(h, "kills")), ["cheater", "honest"]);
  // an account the owner deletes leaves the boards
  await h.api("a_user_set", { atoken: o.atoken, id: "cheater", op: "delete" });
  h.advance(11000);
  assert.deepEqual(names(await board(h, "kills")), ["honest"]);
});

test("the owner's change of an account's XP moves its place and its clan's total", async () => {
  const h = harness(), a = await acct(h, "xpuser"), o = await owner(h);
  put(h, "xpuser", (u) => { u.gold = 5000; });
  const made = await h.api("clan_create", { token: a.token, name: "XP Club", tag: "XPC", desc: "" });
  await play(h, a, { kills: 1 });
  const xp0 = h.user("xpuser").xp;
  await h.api("a_user_set", { atoken: o.atoken, id: "xpuser", op: "xp", xp: 700 });
  h.advance(11000);
  assert.equal((await board(h, "level")).rows[0].v, 700);
  assert.equal((await board(h, "clan")).rows[0].v, 700, "from " + xp0);
});

test("the clan board is the sum of its members' XP: matches add to it, joining adds the newcomer's XP, leaving takes it away, and it is set right when the clan is looked at", async () => {
  const h = harness(), x = await acct(h, "xcap"), y = await acct(h, "ycap"), m = await acct(h, "member");
  for (const id of ["xcap", "ycap", "member"]) put(h, id, (u) => { u.gold = 5000; });
  const cx = await h.api("clan_create", { token: x.token, name: "Xray", tag: "XRY", desc: "" });
  const cy = await h.api("clan_create", { token: y.token, name: "Yankee", tag: "YNK", desc: "" });
  assert.equal(cx.status, 200); assert.equal(cy.status, 200);
  put(h, "member", (u) => { u.xp = 250; });
  await h.api("clan_join", { token: m.token, id: cy.clan.id });
  h.advance(11000);
  let b = await board(h, "clan", { token: m.token });
  assert.deepEqual(b.rows.map((r) => [r.pos, r.name, r.tag, r.n, r.v]), [[1, "Yankee", "YNK", 2, 250], [2, "Xray", "XRY", 1, 0]]);
  assert.deepEqual(b.me, { name: "Yankee", tag: "YNK", pos: 1, v: 250 });
  // a ticketed match adds the XP it earned to the clan
  await play(h, x, { kills: 20 });
  const earned = h.user("xcap").xp;
  assert.ok(earned > 250, "xcap earned " + earned);
  h.advance(11000);
  b = await board(h, "clan");
  assert.deepEqual(b.rows.map((r) => [r.name, r.v]), [["Xray", earned], ["Yankee", 250]]);
  // leaving takes the member's XP along; the other clan's total is not touched
  await h.api("clan_leave", { token: m.token });
  h.advance(11000);
  assert.deepEqual((await board(h, "clan")).rows.map((r) => [r.name, r.v]), [["Xray", earned], ["Yankee", 0]]);
  assert.equal((await h.api("board", { kind: "clan", token: m.token })).me, null, "no clan, no place");
  // an account's own match counts for the clan it is in at the time
  const j = await h.api("clan_join", { token: m.token, id: cx.clan.id });
  assert.equal(j.status, 200);
  await play(h, m, { kills: 5 });
  h.advance(11000);
  const total = h.user("xcap").xp + h.user("member").xp;
  assert.equal((await board(h, "clan")).rows[0].v, total);
  // a total that drifted is set right by looking at the clan
  const view = await h.api("clan_get", { id: cx.clan.id });
  assert.equal(view.clan.xp, total);
  // a clan that is deleted leaves the board
  const op = await owner(h);
  await h.api("a_clan_delete", { atoken: op.atoken, id: cy.clan.id });
  h.advance(11000);
  assert.deepEqual((await board(h, "clan")).rows.map((r) => r.name), ["Xray"]);
  // and with clans off the clan board is empty
  const c = JSON.parse(JSON.stringify(h.config)); c.clan.on = false;
  await h.api("a_config_set", { atoken: op.atoken, config: c });
  h.advance(30000);
  assert.deepEqual(await board(h, "clan"), { status: 200, ok: true, kind: "clan", rows: [], me: null, off: true });
});

test("the clan tag is on the rows of the player boards, from the clan the server lists the account in", async () => {
  const h = harness(), a = await acct(h, "tagged"), b = await acct(h, "plain2");
  put(h, "tagged", (u) => { u.gold = 5000; });
  await h.api("clan_create", { token: a.token, name: "Tag Club", tag: "TAG", desc: "" });
  await play(h, a, { kills: 4 }); await play(h, b, { kills: 2 });
  h.advance(11000);
  const k = await board(h, "kills");
  assert.deepEqual(k.rows.map((r) => [r.name, r.clan]), [["tagged", "TAG"], ["plain2", undefined]]);
});

test("the season board is as it was", async () => {
  const h = harness(), a = await acct(h, "ranker");
  const r = await h.api("leaderboard", { n: 5 });
  assert.equal(r.status, 200); assert.deepEqual(r.rows, []); assert.ok(r.season.n >= 1);
  assert.equal(JSON.stringify(Object.keys(r).sort()), JSON.stringify(["ok", "rows", "season", "status"]));
});
