// The AI competitive match in solo: a rating of its own (u.ai) on the tier scale of the real rank. It counts only for a match
// with a valid ticket that the client reports as one and the server finds whole, and it never touches RR, MMR, placement,
// seasons or the leaderboard.
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs");
const { harness } = require("./api-harness");
const login = (h, id = "player") => h.api("auth", { id, pw: id === "owner" ? "owner-password" : "password", device: "device-" + id });
// one solo AI competitive match with a valid ticket: 13 rounds to 7 by default, `ms` of play, any field of the report changed by `o`
async function play(h, p, o = {}) {
  const t = await h.api("match_start", { token: p.token });
  assert.equal(t.status, 200, JSON.stringify(t));
  h.advance(o.ms || 400000);
  const win = o.win !== false, match = { mode: "std", map: "Ascent", agent: o.agent, n: 10, s: win ? [13, 7] : [7, 13], aic: 1, ...(o.match || {}) };
  const r = await h.api("progress", { token: p.token, mt: o.noTicket ? "" : t.ticket, win, outcome: win ? "win" : "loss", kills: o.kills || 0, match, ...(o.body || {}) });
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
const real = (u) => JSON.stringify([u.rr, u.mmr, u.placed, u.ssn, u.rmDone]);

test("config: the AI competitive numbers have defaults, the game gets them, the owner page labels them, ranges are checked", async () => {
  const h = harness(), A = h.config.aiComp;
  assert.deepEqual({ ...A }, { on: true, win: 18, loss: 10, perKill: 1, maxKill: 8, maxPerDay: 150 });
  const c = await h.api("config");
  assert.deepEqual({ ...c.config.aiComp }, { ...A });
  const admin = fs.readFileSync("admin.html", "utf8");
  for (const key of ["aiComp", "aiComp.on", "aiComp.win", "aiComp.loss", "aiComp.perKill", "aiComp.maxKill", "aiComp.maxPerDay"]) assert.ok(admin.includes(`"${key}"`) || admin.includes(`  ${key}:`), "admin.html labels " + key);
  const o = await login(h, "owner"), cur = (await h.api("a_config_get", { atoken: o.atoken })).config;
  cur.aiComp.win = 30; cur.aiComp.on = false;
  assert.equal((await h.api("a_config_set", { atoken: o.atoken, config: cur })).status, 200);
  const c2 = await h.api("config");
  assert.equal(c2.config.aiComp.win, 30); assert.equal(c2.config.aiComp.on, false); assert.equal(c2.config.aiComp.loss, 10, "the rest keep their defaults");
  for (const [k, v] of [["win", -1], ["win", 5000], ["perKill", 1000], ["maxPerDay", -5]]) {
    const bad = JSON.parse(JSON.stringify(cur)); bad.aiComp[k] = v;
    assert.equal((await h.api("a_config_set", { atoken: o.atoken, config: bad })).status, 400, `aiComp.${k} = ${v} is refused`);
  }
});

test("a new account starts at the bottom with no record, a guest has none; the real rank is a separate field", async () => {
  const h = harness(), p = await login(h), g = await h.api("guest", { device: "guest-device-ai1" });
  assert.deepEqual({ ...p.user.ai }, { rr: 0, t: 0, tier: "iron", div: 1, into: 0, played: 0, w: 0, best: 0 });
  assert.equal(g.user.ai, null);
  assert.ok(p.user.rank && p.user.rank !== p.user.ai);
});

test("a win and a loss move the AI rating by the owner's numbers (kill bonus up to maxKill, a loss softened by it); the match pays XP, gold and counts as usual", async () => {
  const h = harness(), p = await login(h);
  const u0 = h.user("player");
  const a = await play(h, p, { kills: 3 });
  assert.equal(a.status, 200, JSON.stringify(a));
  assert.deepEqual([a.ai.counted, a.ai.why, a.ai.rr, a.ai.capped], [true, "", 18 + 3, false]);
  assert.equal(a.ai.before.rr, 0); assert.equal(a.ai.after.rr, 21);
  assert.equal(a.user.ai.rr, 21); assert.deepEqual([a.user.ai.played, a.user.ai.w, a.user.ai.best], [1, 1, 21]);
  assert.ok(a.gain > 0 && a.gold > 0, "XP and gold as in any solo match");
  assert.equal(a.user.matches, 1); assert.equal(a.user.wins, 1); assert.equal(a.user.kills, 3);
  assert.equal(a.rankedCounted, false); assert.equal(a.rr, 0);
  assert.equal(h.user("player").hist[0].ac, 1, "the match history marks it");
  // kills past maxKill add no more
  const b = await play(h, p, { kills: 30, ms: 600000 });
  assert.equal(b.ai.rr, 18 + 8);
  assert.equal(b.user.ai.rr, 47);
  // a loss: 10 less half of the kill bonus, never under half of it
  const c = await play(h, p, { win: false, kills: 4 });
  assert.equal(c.ai.rr, -(10 - 2)); assert.equal(c.user.ai.rr, 39); assert.deepEqual([c.user.ai.played, c.user.ai.w, c.user.ai.best], [3, 2, 47]);
  const d = await play(h, p, { win: false, kills: 30 });
  assert.equal(d.ai.rr, -6, "the bonus is capped first (8, half of it off the loss)"); assert.equal(d.user.ai.rr, 33);
  // it reaches the tier scale of the real rank
  put(h, "player", (u) => { u.ai.rr = 295; });
  const e = await play(h, p);
  assert.deepEqual([e.user.ai.rr, e.user.ai.tier, e.user.ai.div], [313, "bronze", 1]);
  assert.ok(h.user("player").gold > u0.gold);
});

test("the rating never goes under 0", async () => {
  const h = harness(), p = await login(h);
  const r = await play(h, p, { win: false });
  assert.equal(r.ai.counted, true); assert.equal(r.ai.rr, 0); assert.equal(r.user.ai.rr, 0); assert.equal(r.user.ai.played, 1);
});

test("it never touches RR, MMR, placement, seasons or the leaderboard", async () => {
  const h = harness(), p = await login(h), owner = await login(h, "owner");
  assert.equal((await h.api("a_user_set", { atoken: owner.atoken, id: "player", op: "rr", rr: 450 })).status, 200);
  const before = real(h.user("player")), rank0 = (await h.api("me", { token: p.token })).user.rank;
  for (let i = 0; i < 4; i++) assert.equal((await play(h, p, { win: i % 2 === 0, kills: 5 })).ai.counted, true);
  assert.equal(real(h.user("player")), before);
  assert.deepEqual({ ...(await h.api("me", { token: p.token })).user.rank }, { ...rank0 });
  const lb = await h.api("leaderboard", {});
  assert.equal(JSON.stringify(lb).includes("player"), false, "not on the board");
  assert.ok(h.user("player").ai.played === 4);
});

test("a replay of the same report is the same receipt and counts once", async () => {
  const h = harness(), p = await login(h);
  const t = await h.api("match_start", { token: p.token });
  h.advance(400000);
  const body = { token: p.token, mt: t.ticket, win: true, outcome: "win", kills: 2, match: { mode: "std", n: 10, s: [13, 4], aic: 1 } };
  const first = await h.api("progress", body);
  assert.equal(first.ai.rr, 20);
  h.advance(30000);
  const again = await h.api("progress", body);
  assert.deepEqual(again.ai, first.ai);
  assert.equal(h.user("player").ai.rr, 20); assert.equal(h.user("player").ai.played, 1);
});

test("without a valid ticket nothing is paid or counted", async () => {
  const h = harness(), p = await login(h);
  const r = await play(h, p, { noTicket: true });
  assert.equal(r.status, 409);
  assert.equal(h.user("player").ai, undefined);
  const short = await play(h, p, { ms: 30000 });
  assert.equal(short.status, 409, "a match under a minute earns nothing at all");
  assert.equal(h.user("player").ai, undefined);
});

test("only a solo, standard, 5v5, played-out match long enough counts; the rest still pay as any match and say why", async () => {
  const h = harness(), p = await login(h);
  const why = async (o) => { const r = await play(h, p, o); assert.equal(r.status, 200, JSON.stringify(r)); assert.ok(r.gain > 0, "the match itself still pays"); return r; };
  const cases = [
    [{ match: { mode: "swift", s: [5, 2] } }, "mode"],
    [{ match: { mode: "tdm" } }, "mode"],
    [{ match: { n: 6 } }, "size"],
    [{ match: { n: 2 } }, "size"],
    [{ match: { n: 12 } }, "size"],
    [{ match: { s: [10, 7] } }, "unfinished"],
    [{ match: { s: [13, 13] } }, "unfinished"],
    [{ match: { s: [14, 7] } }, "unfinished"],
    [{ match: { s: [5, 13] }, win: true }, "mismatch"],
    [{ match: { s: [13, 5] }, win: false }, "mismatch"],
    [{ ms: 100000 }, "too_short"],
    [{ body: { humans: ["player", "bobby", "carol"] } }, "not_solo"],
  ];
  for (const [o, expect] of cases) {
    const r = await why(o);
    assert.deepEqual([r.ai.counted, r.ai.why, r.ai.rr], [false, expect, 0], JSON.stringify(o));
    assert.equal(r.user.ai.played, 0, "no record: " + JSON.stringify(o));
  }
  assert.equal(h.user("player").ai, undefined, "never written");
  // not reported as one: nothing about it
  const plain = await why({ match: { aic: undefined } });
  assert.equal(plain.ai, null); assert.equal(plain.user.ai.played, 0);
  const forged = await why({ match: { aic: "1" } });
  assert.equal(forged.ai, null);
  // and the one that fits counts
  const ok = await play(h, p);
  assert.equal(ok.ai.counted, true); assert.equal(ok.user.ai.played, 1);
});

test("a ranked ticket is not an AI competitive match", async () => {
  const h = harness(), p = await login(h);
  const tk = h.sign({ k: "match", u: "player", v: h.user("player").sessionVersion, n: "ranked-ticket-1", t0: h.now(), exp: h.now() + 36e5, r: 1, m: "M1" });
  h.db.set("mt:ranked-ticket-1", "player");
  h.advance(400000);
  const r = await h.api("progress", { token: p.token, mt: tk, win: true, kills: 0, giveUp: true, match: { mode: "std", n: 10, s: [13, 7], aic: 1 } });
  assert.equal(r.status === 200 ? r.ai.counted : false, false);
  assert.equal(h.user("player").ai, undefined);
});

test("a day's gain has a ceiling; losses are not capped; the next day starts again; 0 means none", async () => {
  const h = harness(), p = await login(h), owner = await login(h, "owner");
  await setConfig(h, owner, (c) => { c.aiComp.maxPerDay = 30; });
  const a = await play(h, p);
  assert.deepEqual([a.ai.rr, a.ai.capped, a.user.ai.rr], [18, false, 18]);
  const b = await play(h, p);
  assert.deepEqual([b.ai.rr, b.ai.capped, b.user.ai.rr], [12, true, 30], "the day's last 12");
  const c = await play(h, p);
  assert.deepEqual([c.ai.counted, c.ai.rr, c.ai.capped, c.user.ai.rr, c.user.ai.played, c.user.ai.w], [true, 0, true, 30, 3, 3], "counted, but no more");
  const d = await play(h, p, { win: false });
  assert.equal(d.ai.rr, -10); assert.equal(d.user.ai.rr, 20);
  const e = await play(h, p);
  assert.equal(e.ai.rr, 0, "a loss did not give the ceiling back");
  // Korea's midnight
  h.advance(15 * 3600 * 1000);
  const f = await play(h, p);
  assert.equal(f.ai.rr, 18);
  await setConfig(h, await login(h, "owner"), (c) => { c.aiComp.maxPerDay = 0; });
  for (let i = 0; i < 3; i++) await play(h, p);
  assert.equal(h.user("player").ai.rr, 20 + 18 + 3 * 18);
});

test("switched off, it counts and shows nothing new; the record stays", async () => {
  const h = harness(), p = await login(h), owner = await login(h, "owner");
  await play(h, p);
  await setConfig(h, owner, (c) => { c.aiComp.on = false; });
  const r = await play(h, p);
  assert.equal(r.status, 200); assert.equal(r.ai, null); assert.ok(r.gain > 0);
  assert.equal(h.user("player").ai.rr, 18); assert.equal(h.user("player").ai.played, 1);
});

test("a guest earns the match as usual but has no AI rating", async () => {
  const h = harness(), g = await h.api("guest", { device: "guest-device-ai2" });
  const t = await h.api("match_start", { token: g.token });
  h.advance(400000);
  const r = await h.api("progress", { token: g.token, mt: t.ticket, win: true, outcome: "win", kills: 2, match: { mode: "std", n: 10, s: [13, 3], aic: 1 } });
  assert.equal(r.status, 200); assert.ok(r.gain > 0);
  assert.deepEqual([r.ai.counted, r.ai.why], [false, "guest"]);
  assert.equal(r.user.ai, null);
  const key = [...h.db.keys()].find((k) => k.startsWith("guest:"));
  assert.equal(JSON.parse(h.db.get(key)).ai, undefined);
});

test("the owner page profile and the account log carry the AI rating", async () => {
  const h = harness(), p = await login(h), owner = await login(h, "owner");
  await play(h, p, { kills: 1 });
  const prof = await h.api("a_user_profile", { atoken: owner.atoken, id: "player" });
  assert.equal(prof.status, 200, JSON.stringify(prof));
  assert.equal(prof.profile.acct.ai.rr, 19);
  const log = h.db.get("ulog:player").map((x) => JSON.parse(x)).find((x) => x.m && x.m.includes("AI경쟁전"));
  assert.ok(log && log.m.includes("+19"), JSON.stringify(log));
});
