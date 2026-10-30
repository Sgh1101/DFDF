// Progression rewards, all from matches with a valid ticket: gold and a cosmetic for levels, the first win of the day,
// missions picked from a pool each day and week, and achievements.
const test = require("node:test"), assert = require("node:assert/strict");
const { harness } = require("./api-harness");
const roster = require("../js/agent-roster.json");
const login = (h, id = "player") => h.api("auth", { id, pw: id === "owner" ? "owner-password" : "password", device: "device-" + id });
// one match with a valid ticket (a minute of play unless `ms`), reported with the given agent / mode / kills
async function play(h, p, o = {}) {
  const t = await h.api("match_start", { token: p.token });
  assert.equal(t.status, 200, JSON.stringify(t));
  h.advance(o.ms || 61000);
  const win = o.win !== false;
  const r = await h.api("progress", { token: p.token, mt: o.noTicket ? "" : t.ticket, win, outcome: win ? "win" : "loss", kills: o.kills || 0, match: { mode: o.mode || "std", agent: o.agent, s: o.s || (win ? [13, 7] : [7, 13]) } });
  o.keep || h.advance(21000);
  return r;
}
async function setConfig(h, owner, edit) {
  const c = JSON.parse(JSON.stringify(h.config));
  edit(c);
  const r = await h.api("a_config_set", { atoken: owner.atoken, config: c });
  assert.equal(r.status, 200, JSON.stringify(r));
  h.advance(30000);
}
const put = (h, id, edit) => { const u = h.user(id); edit(u); h.db.set("user:" + id, JSON.stringify(u)); };
// only one of the new rewards at a time, with no match gold, so a number is what that reward gave
const only = (...keep) => (c) => {
  c.gold.perWin = c.gold.perLoss = c.gold.perKill = 0;
  for (const k of ["firstWin", "lvReward", "ach", "mission2"]) c[k].on = keep.includes(k);
  c.mastery.on = false;
};
const KR_DAY = 15 * 3600 * 1000; // the harness clock starts at 00:00 UTC = 09:00 in Korea; +15 h is the next midnight there

test("a level gained pays gold, and a milestone level also gold and its cosmetic, once", async () => {
  const h = harness(), p = await login(h), owner = await login(h, "owner");
  await setConfig(h, owner, (c) => { only("lvReward")(c); c.xp.perWin = 100; c.xp.perMatch = 0; c.xp.perKill = 0; });
  // 100 XP a level at level 1 (n -> n+1 costs 100 x n): 950 is level 4, 1000 is level 5
  put(h, "player", (u) => { u.xp = 950; });
  const g0 = h.user("player").gold;
  const a = await play(h, p);
  assert.equal(a.user.level, 5); assert.equal(a.levelUp, true);
  assert.deepEqual([a.lvReward.from, a.lvReward.to, a.lvReward.gold, a.lvReward.cos, a.lvReward.ms], [4, 5, 240, ["scout"], [5]], "40 for the level and 200 + a title at the milestone");
  assert.equal(h.user("player").gold, g0 + 240);
  assert.ok(a.user.cos.own.includes("scout"), "the cosmetic is the account's");
  // a level that is not a milestone: gold only
  put(h, "player", (u) => { u.xp = 1450; });
  const b = await play(h, p);
  assert.equal(b.user.level, 6); assert.deepEqual([b.lvReward.gold, b.lvReward.cos, b.lvReward.ms], [40, [], []]);
  // a match that gains no level: nothing
  const c = await play(h, p);
  assert.equal(c.lvReward, null);
  // a replay of the same report is the same receipt and pays nothing more
  const t = await h.api("match_start", { token: p.token });
  h.advance(61000);
  const body = { token: p.token, mt: t.ticket, win: true, outcome: "win", kills: 0, match: { mode: "std", s: [13, 7] } };
  put(h, "player", (u) => { u.xp = 2050; }); // level 6 is 1500..2099: this match reaches 2150 = level 7
  const g1 = h.user("player").gold, first = await h.api("progress", body);
  assert.equal(first.lvReward.gold, 40);
  h.advance(30000);
  const replay = await h.api("progress", body);
  assert.deepEqual(replay.lvReward, first.lvReward);
  assert.equal(h.user("player").gold, g1 + 40, "paid once");
});

test("several levels in one match pay each, milestones included, up to maxGold; a level paid once is not paid again if XP rules move it", async () => {
  const h = harness(), p = await login(h), owner = await login(h, "owner");
  await setConfig(h, owner, (c) => { only("lvReward")(c); c.xp.perWin = 600; c.xp.perMatch = 0; c.xp.perKill = 0; c.xp.maxPerReport = 600; c.lvReward.maxGold = 100000; c.lvReward.milestones = "3:rookie,6:marksman"; });
  const r = await play(h, p);
  // 600 XP from nothing: level 1 -> 4 (100, 300 and 600 start levels 2, 3 and 4)
  assert.equal(r.user.level, 4);
  assert.deepEqual([r.lvReward.from, r.lvReward.to, r.lvReward.gold, r.lvReward.cos], [1, 4, 3 * 40 + 200, ["rookie"]], "levels 2, 3 and 4, 3 is a milestone");
  // the cap on one match's level gold
  await setConfig(h, owner, (c) => { only("lvReward")(c); c.xp.perWin = 600; c.xp.perMatch = 0; c.xp.perKill = 0; c.lvReward.maxGold = 90; c.lvReward.milestones = "5,6:marksman"; });
  const g = h.user("player").gold;
  const r2 = await play(h, p);
  assert.equal(r2.user.level, 5); assert.equal(r2.lvReward.gold, 90, "at most maxGold"); assert.equal(h.user("player").gold, g + 90);
  // the owner makes levels cost more, so the account falls back below what it was paid for, then back up: no second payment
  const lv = r2.user.level;
  await setConfig(h, owner, (c) => { only("lvReward")(c); c.xp.perLevel = 1000; c.xp.perWin = 0; c.xp.perMatch = 0; });
  assert.ok((await h.api("me", { token: p.token })).user.level < lv);
  await setConfig(h, owner, (c) => { only("lvReward")(c); c.xp.perLevel = 100; c.xp.perWin = 50; c.xp.perMatch = 0; });
  const g2 = h.user("player").gold, again = await play(h, p);
  assert.equal(again.user.level >= lv, true);
  assert.equal(h.user("player").lvPaid >= lv, true);
  assert.equal(h.user("player").gold, g2 + (again.lvReward ? again.lvReward.gold : 0));
  assert.ok(!again.lvReward || again.lvReward.from >= lv, "only the levels above the highest paid");
});

test("an account from before level rewards starts at the level it has: no back pay", async () => {
  const h = harness(), p = await login(h);
  put(h, "player", (u) => { u.xp = 9000; delete u.lvPaid; }); // a high level
  const lv = (await h.api("me", { token: p.token })).user.level;
  assert.ok(lv >= 10);
  const r = await play(h, p);
  assert.equal(h.user("player").lvPaid, r.user.level);
  assert.ok(!r.lvReward || r.lvReward.from >= lv, "nothing for the levels it already had");
  assert.ok(!r.user.cos.own.includes("scout") && !r.user.cos.own.includes("neoncity"), "and no milestone cosmetics for them");
});

test("the first win of the day pays gold and XP once, a loss or a draw does not use it, and the next Korean day brings it back", async () => {
  const h = harness(), p = await login(h), owner = await login(h, "owner");
  await setConfig(h, owner, (c) => { only("firstWin")(c); c.xp.perWin = c.xp.perMatch = c.xp.perKill = 0; });
  const lost = await play(h, p, { win: false });
  assert.equal(lost.firstWin, null, "a loss is not a win");
  assert.equal(lost.user.fw, 0);
  const draw = await h.api("match_start", { token: p.token });
  h.advance(61000);
  const dr = await h.api("progress", { token: p.token, mt: draw.ticket, outcome: "draw", match: { mode: "std", s: [10, 10] } });
  assert.equal(dr.firstWin, null); h.advance(21000);
  const g0 = h.user("player").gold, x0 = h.user("player").xp || 0;
  const w1 = await play(h, p);
  assert.deepEqual(w1.firstWin, { gold: 100, xp: 50 });
  assert.equal(w1.user.fw, 1);
  assert.equal(h.user("player").gold, g0 + 100); assert.equal(h.user("player").xp, x0 + 50);
  assert.equal(w1.gain, 0, "the match's own XP is separate");
  const w2 = await play(h, p);
  assert.equal(w2.firstWin, null, "once a day");
  assert.equal(h.user("player").gold, g0 + 100);
  // the day turns at midnight in Korea, not UTC: 00:00 UTC is 09:00 there, so +14 h 59 m is still the same day
  const day = Date.UTC(2026, 9, 13, 15, 0, 0); // the next Korean midnight
  h.advance(day - h.now() - 2 * 60000);
  const early = await play(h, p, { keep: true });
  assert.ok(h.now() < day + 61000);
  // the match just played ended at or after midnight (it took 61 s): find out which day it counted in from the answer
  if (h.now() < day) assert.equal(early.firstWin, null, "before midnight in Korea");
  h.advance(KR_DAY);
  const next = await play(h, p);
  assert.deepEqual(next.firstWin, { gold: 100, xp: 50 }, "a new day");
  assert.equal((await play(h, p)).firstWin, null);
});

test("the first win bonus respects the day's gold and XP ceilings, and is used up even when the ceiling leaves nothing", async () => {
  const h = harness(), p = await login(h), owner = await login(h, "owner");
  await setConfig(h, owner, (c) => { only("firstWin")(c); c.gold.perWin = 100; c.gold.maxPerDay = 130; c.xp.maxPerDay = 90; c.xp.perWin = 80; c.xp.perMatch = 0; c.xp.perKill = 0; });
  const r = await play(h, p);
  assert.equal(r.gold, 100); assert.deepEqual(r.firstWin, { gold: 30, xp: 10 }, "only what is left of the day");
  assert.equal(h.user("player").goldDay.n, 130); assert.equal(h.user("player").xpDay.n, 90);
  const r2 = await play(h, p);
  assert.equal(r2.firstWin, null, "taken for today");
  // a day with nothing left at all still uses the bonus
  const q = await login(h, "other");
  await play(h, q, { win: false }); // 30 gold... perLoss is 0 here
  put(h, "other", (u) => { u.goldDay = { d: new Date(h.now() + 9 * 36e5).toISOString().slice(0, 10), n: 130 }; });
  const r3 = await play(h, q);
  assert.deepEqual(r3.firstWin, { gold: 0, xp: 10 });
  assert.equal((await play(h, q)).firstWin, null);
});

test("level and first-win gold come out of the gold ceiling, after the match's; a cosmetic is given anyway", async () => {
  const h = harness(), p = await login(h), owner = await login(h, "owner");
  await setConfig(h, owner, (c) => { c.mastery.on = false; c.ach.on = false; c.gold.perWin = 100; c.gold.maxPerDay = 150; c.xp.perWin = 100; c.xp.perMatch = 0; c.xp.perKill = 0; });
  put(h, "player", (u) => { u.xp = 950; });
  const g0 = h.user("player").gold;
  const r = await play(h, p);
  // 100 match gold; 50 left of 150: the level (40 + 200 milestone) gets 50, the first win 0
  assert.equal(r.gold, 100); assert.equal(r.lvReward.gold, 50); assert.deepEqual(r.lvReward.cos, ["scout"]);
  assert.deepEqual(r.firstWin, { gold: 0, xp: 50 });
  assert.equal(h.user("player").gold, g0 + 150); assert.equal(h.user("player").goldDay.n, 150);
  assert.ok(r.user.cos.own.includes("scout"));
  // the next day it all works again, the first win included
  h.advance(KR_DAY);
  const r2 = await play(h, p);
  assert.equal(r2.firstWin.gold, 100 - 100 > 0 ? 0 : 50, "100 match gold, 50 left for the first win");
});

test("no ticket, a short match or a replay: no level, first-win, mission or achievement reward", async () => {
  const h = harness(), p = await login(h);
  put(h, "player", (u) => { u.xp = 950; });
  const before = JSON.stringify(h.user("player"));
  const none = await play(h, p, { noTicket: true, kills: 5, agent: roster[0].id });
  assert.equal(none.status, 409);
  const short = await play(h, p, { ms: 5000, kills: 5, agent: roster[0].id });
  assert.equal(short.status, 409);
  const forged = await h.api("progress", { token: p.token, mt: "x.y", win: true, kills: 60, match: { mode: "std", agent: roster[0].id } });
  assert.equal(forged.status, 409);
  const u = h.user("player");
  assert.equal(u.lvPaid, undefined); assert.equal(u.fwDay, undefined); assert.equal(u.ach, undefined);
  assert.equal(u.gold, JSON.parse(before).gold); assert.equal(u.xp, 950); assert.equal(u.cos, undefined);
  assert.deepEqual(u.mis && u.mis.p || {}, {}, "no mission progress");
  // the same ticket cannot be used twice for another reward
  const ok = await play(h, p, { win: true, agent: roster[0].id });
  assert.equal(ok.status, 200); assert.ok(ok.firstWin && ok.lvReward);
});

// ── missions ──
const dyn = (st) => st.list.filter((x) => "x" === x.id[1]);
const missions = async (h, p) => (await h.api("missions", { token: p.token })).missions;
// a match that counts for a mission: its mode / role / agent
function matchFor(x, win) {
  const o = { win, mode: "std", keep: false };
  if ("mode" === x.f.k) o.mode = x.f.v;
  else if ("agent" === x.f.k) o.agent = x.f.v;
  else o.agent = roster.find((a) => ({ 타격대: "duelist", 감시자: "sentinel", 척후대: "initiator", 전략가: "controller" })[a.role] === x.f.v).id;
  if ("kills" === x.stat) o.kills = Math.min(24, x.n);
  return o;
}

test("each day and week the same missions are picked for everyone from the pool; they change with the day and not within it", async () => {
  const h = harness(), p = await login(h), q = await login(h, "other");
  const a = await missions(h, p), b = await missions(h, q);
  assert.ok(dyn(a).length === 4, "2 daily + 2 weekly");
  assert.deepEqual(dyn(a).map((x) => [x.id, x.n, x.gold, x.f]), dyn(b).map((x) => [x.id, x.n, x.gold, x.f]), "the same for everyone");
  assert.deepEqual(dyn(a).map((x) => x.id), dyn(await missions(h, p)).map((x) => x.id), "and for the whole day");
  assert.equal(a.list.filter((x) => "x" !== x.id[1]).length, 6, "the six fixed ones stay");
  for (const x of dyn(a)) {
    assert.ok(["play", "wins", "kills"].includes(x.stat)); assert.ok(["mode", "role", "agent"].includes(x.f.k)); assert.ok(x.f.v);
    assert.equal(x.id, `${x.per}x:${x.stat}:${x.f.k}:${x.f.v}`);
  }
  const daily = dyn(a).filter((x) => x.per === "d"), weekly = dyn(a).filter((x) => x.per === "w");
  assert.equal(new Set(daily.map((x) => x.stat)).size, 2, "different stats first");
  assert.deepEqual([daily[0].gold, weekly[0].gold], [120, 400]);
  // another server (same secret) works out the same; the next day gives other daily ones, the weekly ones stay until Monday
  const h2 = harness(), p2 = await login(h2);
  assert.deepEqual(dyn(await missions(h2, p2)).map((x) => x.id), dyn(a).map((x) => x.id));
  const ids = new Set(daily.map((x) => x.id));
  let changed = 0, sameWeek = 0;
  for (let i = 0; i < 6; i++) {
    h.advance(KR_DAY + 3600e3); // Oct 14 .. 19: a Tuesday to a Sunday, the week of Monday Oct 12 stays
    const s = dyn(await missions(h, p));
    s.filter((x) => x.per === "d").some((x) => !ids.has(x.id)) && changed++;
    s.filter((x) => x.per === "w").every((x) => weekly.some((y) => y.id === x.id)) && sameWeek++;
  }
  assert.ok(changed >= 5, "a new pick each day: " + changed); assert.equal(sameWeek, 6, "the week's stay for the week");
  h.advance(2 * 864e5);
  assert.ok(dyn(await missions(h, p)).filter((x) => x.per === "w").some((x) => !weekly.some((y) => y.id === x.id)), "a new week on Monday");
});

test("the mission pool follows the owner's counts and targets, leaves out switched-off agents, and can be off", async () => {
  const h = harness(), p = await login(h), owner = await login(h, "owner");
  await setConfig(h, owner, (c) => { c.mission2.dCount = 4; c.mission2.wCount = 0; c.mission2.dKill = 0; c.mission2.dWin = 3; });
  let st = dyn(await missions(h, p));
  assert.equal(st.length, 4); assert.ok(st.every((x) => x.per === "d" && x.stat !== "kills"), "a target of 0 leaves that stat out");
  assert.ok(st.filter((x) => x.stat === "wins").every((x) => x.n === 3));
  const a = roster[0].id;
  await setConfig(h, owner, (c) => { c.mission2.dCount = 4; c.mission2.wCount = 4; c.game.disabledAgents = roster.slice(1).filter((x, i) => i >= 12).map((x) => x.id).join(","); });
  st = dyn(await missions(h, p));
  const off = new Set(roster.slice(1).filter((x, i) => i >= 12).map((x) => x.id));
  assert.ok(st.filter((x) => x.f.k === "agent").every((x) => !off.has(x.f.v)), "only agents that are on");
  void a;
  await setConfig(h, owner, (c) => { c.mission2.on = false; });
  const off2 = await missions(h, p);
  assert.equal(dyn(off2).length, 0); assert.equal(off2.list.length, 6);
  // bad numbers are refused
  const c = JSON.parse(JSON.stringify(h.config)); c.mission2.dCount = 9;
  assert.equal((await h.api("a_config_set", { atoken: owner.atoken, config: c })).status, 400);
});

test("mission progress comes only from matches that fit it, counted once with a ticket, and is claimed once", async () => {
  const h = harness(), p = await login(h), owner = await login(h, "owner");
  await setConfig(h, owner, (c) => { c.firstWin.on = c.lvReward.on = c.ach.on = false; c.mission2.wCount = 0; c.mission2.dCount = 4; c.mission2.dPlay = 2; c.mission2.dWin = 2; c.mission2.dKill = 10; });
  const st0 = await missions(h, p), list = dyn(st0);
  assert.equal(list.length, 4);
  // a match that fits none of them (a loss in a mode and with an agent they do not name) does not move them
  const names = new Set(list.map((x) => x.f.v));
  const odd = ["std", "swift", "rush", "tdm", "dm", "knife", "gun", "hill", "ctf", "zone", "inf"].find((m) => !names.has(m));
  const stray = roster.find((a) => !names.has(a.id) && !list.some((x) => "role" === x.f.k && ({ 타격대: "duelist", 감시자: "sentinel", 척후대: "initiator", 전략가: "controller" })[a.role] === x.f.v));
  const r0 = await play(h, p, { mode: odd, agent: stray ? stray.id : undefined, win: false, kills: 3 });
  assert.equal(r0.status, 200);
  assert.ok(dyn(r0.missions).every((x) => x.have === 0 || (stray ? false : true)), "nothing moved: " + JSON.stringify(dyn(r0.missions).map((x) => [x.id, x.have])));
  // play the first one until it is done
  const x = list[0];
  let last = null;
  for (let i = 0; i < 12 && !(last && dyn(last.missions).find((y) => y.id === x.id).done); i++) last = await play(h, p, matchFor(x, true));
  const done = dyn(last.missions).find((y) => y.id === x.id);
  assert.ok(done.done && !done.got, JSON.stringify(done));
  assert.equal(done.have, done.n, "capped at the target");
  const g0 = h.user("player").gold, ready = last.missions.ready;
  assert.ok(ready >= 1); assert.equal(last.user.misReady, ready);
  // claiming: the gold once
  const c1 = await h.api("mission_claim", { token: p.token, id: x.id });
  assert.equal(c1.status, 200); assert.equal(c1.gold, x.gold); assert.equal(h.user("player").gold, g0 + x.gold);
  assert.ok(dyn(c1.missions).find((y) => y.id === x.id).got);
  h.advance(30000);
  assert.equal((await h.api("mission_claim", { token: p.token, id: x.id })).status, 409, "not twice");
  const gAfter = h.user("player").gold;
  // 'all' takes the others that are finished and leaves this one
  const all = await h.api("mission_claim", { token: p.token, id: "all" });
  all.status === 200 ? assert.ok(!all.ids.includes(x.id)) : assert.equal(all.status, 409);
  h.advance(30000);
  assert.equal(h.user("player").gold, gAfter + (all.status === 200 ? all.gold : 0));
  // two claims at once: one wins
  const y = dyn(await missions(h, p)).find((m) => m.id !== x.id);
  let m2 = null;
  for (let i = 0; i < 12 && !(m2 && dyn(m2).find((z) => z.id === y.id).done); i++) m2 = (await play(h, p, matchFor(y, true))).missions;
  const gb = h.user("player").gold;
  const two = await Promise.all([h.api("mission_claim", { token: p.token, id: y.id }), h.api("mission_claim", { token: p.token, id: y.id })]);
  assert.deepEqual(two.map((r) => r.status).sort(), [200, 409]);
  assert.equal(h.user("player").gold, gb + y.gold, "paid once");
  // the next day starts them at zero and unclaimed (new ones, or the same one fresh)
  h.advance(KR_DAY);
  const next = dyn(await missions(h, p)).filter((m) => m.per === "d");
  assert.ok(next.every((m) => !m.got && m.have === 0));
  assert.ok(!Object.keys(h.user("player").mis.p).some((id) => id.startsWith("dx:") && h.user("player").mis.p[id]), "yesterday's progress is gone");
});

test("a win mission in a mode, and kills as a role, count the way they read", async () => {
  const h = harness(), p = await login(h), owner = await login(h, "owner");
  const R = (r) => roster.filter((a) => ({ 타격대: "duelist", 감시자: "sentinel", 척후대: "initiator", 전략가: "controller" })[a.role] === r);
  // look for a day where the pool has a mode win and a role kills mission
  await setConfig(h, owner, (c) => { c.firstWin.on = c.lvReward.on = c.ach.on = false; c.mission2.dCount = 4; c.mission2.wCount = 4; });
  let found = null;
  for (let i = 0; i < 40 && !found; i++) {
    const l = dyn(await missions(h, p));
    const w = l.find((x) => "wins" === x.stat && "mode" === x.f.k), k = l.find((x) => "kills" === x.stat && "role" === x.f.k);
    if (w && k) found = { w, k };
    else h.advance(KR_DAY + 3600e3);
  }
  assert.ok(found, "such a pair exists within a few days");
  const { w, k } = found;
  // a loss in that mode is no win; a win in another mode is none either; then a win in it counts
  await play(h, p, { mode: w.f.v, win: false });
  await play(h, p, { mode: w.f.v === "std" ? "tdm" : "std", win: true });
  let s = dyn(await missions(h, p)), cur = s.find((x) => x.id === w.id);
  assert.equal(cur.have, 0);
  await play(h, p, { mode: w.f.v, win: true });
  s = dyn(await missions(h, p)); assert.equal(s.find((x) => x.id === w.id).have, 1);
  // kills with another role do not count, with the role they do (every kill of the match)
  const other = roster.find((a) => !R(k.f.v).includes(a)), mine = R(k.f.v)[0];
  await play(h, p, { agent: other.id, kills: 4, win: false });
  assert.equal(dyn(await missions(h, p)).find((x) => x.id === k.id).have, 0);
  await play(h, p, { agent: mine.name, kills: 4, win: false });
  assert.equal(dyn(await missions(h, p)).find((x) => x.id === k.id).have, 4);
});

// ── achievements ──
const ach = (u, id) => u.ach.find((x) => x.id === id);

test("achievements pay once from counted matches: first win, 100 kills, 50 matches", async () => {
  const h = harness(), p = await login(h), owner = await login(h, "owner");
  await setConfig(h, owner, (c) => { only("ach")(c); });
  const g0 = h.user("player").gold;
  const none = await play(h, p, { win: false });
  assert.deepEqual(none.ach, []);
  assert.equal(ach(none.user, "win1").have, 0); assert.equal(ach(none.user, "win1").got, 0);
  const win = await play(h, p);
  assert.deepEqual(win.ach, [{ id: "win1", gold: 100 }]);
  assert.equal(h.user("player").gold, g0 + 100); assert.ok(ach(win.user, "win1").got > 0);
  assert.equal((await play(h, p)).ach.length, 0, "not again");
  // 100 kills across matches
  put(h, "player", (u) => { u.kills = 96; });
  const g1 = h.user("player").gold;
  const k = await play(h, p, { kills: 5, win: false });
  assert.deepEqual(k.ach, [{ id: "kill100", gold: 300 }]);
  assert.equal(h.user("player").gold, g1 + 300);
  assert.equal(ach(k.user, "kill100").have, 100);
  // 50 matches
  put(h, "player", (u) => { u.matches = 49; });
  const t = await h.api("match_start", { token: p.token });
  h.advance(61000);
  const body = { token: p.token, mt: t.ticket, win: false, outcome: "loss", kills: 0, match: { mode: "std", s: [7, 13] } };
  const m = await h.api("progress", body), g2 = h.user("player").gold;
  assert.deepEqual(m.ach, [{ id: "play50", gold: 200 }]);
  // a replay of that report pays nothing more
  h.advance(30000);
  assert.deepEqual((await h.api("progress", body)).ach, [{ id: "play50", gold: 200 }], "the same receipt");
  assert.equal(h.user("player").gold, g2); assert.ok(h.user("player").ach.got.play50 > 0);
});

test("win with every role, win in every mode, mastery 5 with any agent", async () => {
  const h = harness(), p = await login(h), owner = await login(h, "owner");
  await setConfig(h, owner, (c) => { only("ach")(c); c.ach.win1 = 0; });
  const roleOf = { 타격대: "duelist", 감시자: "sentinel", 척후대: "initiator", 전략가: "controller" };
  const byRole = {}; for (const a of roster) byRole[roleOf[a.role]] = byRole[roleOf[a.role]] || a;
  let last;
  for (const r of ["duelist", "sentinel", "initiator"]) { last = await play(h, p, { agent: byRole[r].id }); assert.deepEqual(last.ach, [], r); }
  assert.equal(ach(last.user, "roles").have, 3);
  // a loss with the fourth does not count
  assert.deepEqual((await play(h, p, { agent: byRole.controller.id, win: false })).ach, []);
  last = await play(h, p, { agent: byRole.controller.name });
  assert.deepEqual(last.ach, [{ id: "roles", gold: 500 }]);
  // every mode: 11; the target range and an unknown mode are not among them
  const modes = ["std", "swift", "rush", "tdm", "dm", "knife", "gun", "hill", "ctf", "zone", "inf"];
  for (const m of modes.slice(0, 10)) { last = await play(h, p, { mode: m }); assert.deepEqual(last.ach, [], m); }
  assert.equal(ach(last.user, "modes").have > 0, true);
  await play(h, p, { mode: "range" }); await play(h, p, { mode: "nonsense" });
  assert.equal(ach((await h.api("me", { token: p.token })).user, "modes").have, 10, "range and unknown modes do not count");
  last = await play(h, p, { mode: "inf" });
  assert.deepEqual(last.ach, [{ id: "modes", gold: 800 }]);
  // mastery 5: 1000 XP with one agent
  await setConfig(h, owner, (c) => { only("ach")(c); c.ach.win1 = c.ach.roles = c.ach.modes = 0; c.mastery.on = true; });
  const a = roster[5];
  put(h, "player", (u) => { u.mast = { [a.id]: { xp: 990, m: 10, w: 5, k: 20 } }; });
  assert.equal(ach((await h.api("me", { token: p.token })).user, "mast5").have, 4);
  last = await play(h, p, { agent: a.id });
  assert.deepEqual(last.ach, [{ id: "mast5", gold: 400 }]);
  assert.equal(h.user("player").gold >= 500 + 800 + 400, true);
});

test("achievements: an account's past wins seed roles and modes, a replay and a missing ticket pay nothing, the owner can price or switch them off", async () => {
  const h = harness(), p = await login(h), owner = await login(h, "owner");
  await setConfig(h, owner, (c) => { only("ach")(c); });
  const a = roster[0], b = roster.find((x) => x.role !== a.role);
  put(h, "player", (u) => { u.hist = [{ mode: "rush", agent: a.name, win: true }, { mode: "dm", agent: b.id, win: true }, { mode: "tdm", agent: a.id, win: false }]; delete u.ach; });
  const view = (await h.api("me", { token: p.token })).user;
  assert.equal(ach(view, "roles").have, 2); assert.equal(ach(view, "modes").have, 2, "the last matches are counted, the loss is not");
  assert.equal(h.user("player").ach, undefined, "reading changes nothing");
  // no ticket: nothing
  assert.equal((await play(h, p, { noTicket: true, agent: a.id })).status, 409);
  assert.equal(h.user("player").ach, undefined);
  // priced at 0: not listed until had; switched off: no list, no gold
  await setConfig(h, owner, (c) => { only("ach")(c); c.ach.win1 = 0; c.ach.kill100 = 0; });
  assert.ok(!ach((await h.api("me", { token: p.token })).user, "win1"));
  const r = await play(h, p);
  assert.ok(!r.ach.some((x) => x.id === "win1"));
  await setConfig(h, owner, (c) => { only()(c); });
  const off = await play(h, p);
  assert.deepEqual(off.ach, []); assert.deepEqual(off.user.ach, []);
});

test("the owner's settings: defaults listed, milestones checked, public rewards sent", async () => {
  const h = harness(), owner = await login(h, "owner");
  const j = await h.api("a_config_get", { atoken: owner.atoken });
  assert.deepEqual(j.defaults.firstWin, { on: true, gold: 100, xp: 50 });
  assert.equal(j.defaults.lvReward.milestones, "5:scout,10:neoncity,20:commander,30:galaxy,50:legend13");
  assert.equal(j.defaults.mission2.dCount, 2); assert.equal(j.defaults.ach.modes, 800);
  const bad = async (edit) => { const c = JSON.parse(JSON.stringify(h.config)); edit(c); return (await h.api("a_config_set", { atoken: owner.atoken, config: c })).status; };
  assert.equal(await bad((c) => { c.lvReward.milestones = "5:nothing"; }), 400, "an unknown cosmetic");
  assert.equal(await bad((c) => { c.lvReward.milestones = "x:scout"; }), 400);
  assert.equal(await bad((c) => { c.lvReward.milestones = "1:scout"; }), 400, "level 1 is not a level up");
  assert.equal(await bad((c) => { c.lvReward.gold = -1; }), 400);
  assert.equal(await bad((c) => { c.firstWin.xp = 1e9; }), 400);
  assert.equal(await bad((c) => { c.lvReward.milestones = ""; }), 200, "none is allowed");
  assert.equal(await bad((c) => { c.lvReward.milestones = "7:rookie, 12 , 40:sentry"; }), 200);
  h.advance(30000);
  const pub = (await h.api("config")).config.rewards;
  assert.deepEqual(pub.lv.ms, [{ lv: 7, cos: "rookie" }, { lv: 12, cos: "" }, { lv: 40, cos: "sentry" }]);
  assert.equal(pub.firstWin.gold, 100); assert.equal(pub.lv.gold, 40);
});
