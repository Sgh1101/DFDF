const test = require("node:test"), assert = require("node:assert/strict");
const { harness } = require("./api-harness");
const DAY = 864e5;
const login = (h, id = "player") => h.api("auth", { id, pw: id === "owner" ? "owner-password" : "password", device: "device-" + id });
const body = (p, mt, win = true) => ({ token: p.token, mt, win, outcome: win ? "win" : "loss", match: { mode: "std", s: win ? [13, 7] : [7, 13] } });
// one valid match: a ticket, a minute of play, the report; returns what the server answered
async function play(h, p, win = true) {
  const t = await h.api("match_start", { token: p.token });
  assert.equal(t.status, 200);
  h.advance(61000);
  const b = body(p, t.ticket, win), r = await h.api("progress", b);
  assert.equal(r.status, 200);
  return Object.assign(r, { body: b });
}
async function setConfig(h, owner, edit) {
  const c = JSON.parse(JSON.stringify(h.config));
  edit(c);
  assert.equal((await h.api("a_config_set", { atoken: owner.atoken, config: c })).status, 200);
  h.advance(30000);
}

test("the defaults: 30 coins and 6000 XP a day, and the owner can see both in the settings", async () => {
  const h = harness(), owner = await login(h, "owner");
  const j = await h.api("a_config_get", { atoken: owner.atoken });
  assert.equal(j.defaults.gold.coinsPerDay, 30); assert.equal(j.defaults.xp.maxPerDay, 6000);
  assert.equal(j.config.gold.coinsPerDay, 30); assert.equal(j.config.xp.maxPerDay, 6000);
  // a stored config from before the caps still gets them
  const old = JSON.parse(JSON.stringify(h.config)); delete old.gold.coinsPerDay; delete old.xp.maxPerDay;
  h.db.set("config", JSON.stringify(old)); h.advance(30000);
  const j2 = await h.api("a_config_get", { atoken: owner.atoken });
  assert.equal(j2.config.gold.coinsPerDay, 30); assert.equal(j2.config.xp.maxPerDay, 6000);
});

test("coins stop at 30 a day, the capped match still counts, the answer says what was given, and they resume the next Korean day", async () => {
  const h = harness(), p = await login(h);
  let last;
  for (let i = 0; i < 30; i++) { last = await play(h, p); assert.equal(last.coinGain, 1, "match " + i); }
  assert.equal(last.user.championCoins, 30);
  const first = await play(h, p), xpBefore = h.user("player").xp;
  assert.equal(first.coinGain, 0, "the 31st match gives no coin");
  assert.equal(first.user.championCoins, 30);
  assert.equal(h.user("player").championCoins, 30);
  assert.equal(h.user("player").matches, 31, "it still counts");
  assert.ok(first.gain > 0 && first.gold > 0, "xp and gold are not coins");
  const hist = h.user("player").hist;
  assert.equal(hist[0].coinGain, 0); assert.equal(hist[1].coinGain, 1, "the history says what was given");
  assert.equal((await play(h, p)).coinGain, 0);
  assert.equal(h.user("player").xp > xpBefore, true);
  // the same report again is the same receipt (the ticket lives a few hours, so this is the same day)
  const replay = await h.api("progress", first.body);
  assert.equal(replay.status, 200); assert.equal(replay.coinGain, 0); assert.equal(replay.gain, first.gain); assert.equal(replay.user.championCoins, 30);
  assert.equal(h.user("player").matches, 32);
  // midnight in Korea has passed: coins again
  h.advance(16 * 3600 * 1000);
  const next = await play(h, p);
  assert.equal(next.coinGain, 1); assert.equal(next.user.championCoins, 31);
  assert.deepEqual(h.user("player").coinDay.n, 1);
});

test("a coin cap of 0 means no cap, and the owner's number is used", async () => {
  const h = harness(), p = await login(h), owner = await login(h, "owner");
  await setConfig(h, owner, (c) => { c.gold.coinsPerDay = 2; });
  assert.deepEqual([(await play(h, p)).coinGain, (await play(h, p)).coinGain, (await play(h, p)).coinGain], [1, 1, 0]);
  await setConfig(h, owner, (c) => { c.gold.coinsPerDay = 0; });
  const r = await play(h, p);
  assert.equal(r.coinGain, 1); assert.equal(r.user.championCoins, 3);
});

test("XP stops at the day's ceiling: the answer's gain is what was given, a replay is the same receipt, and it resumes the next Korean day", async () => {
  const h = harness(), p = await login(h), owner = await login(h, "owner");
  await setConfig(h, owner, (c) => { c.xp.maxPerDay = 100; });
  const xp0 = h.user("player").xp || 0;
  const a = await play(h, p), b = await play(h, p), c = await play(h, p);
  assert.equal(a.gain, 70); assert.equal(b.gain, 30, "only what is left of the day"); assert.equal(c.gain, 0);
  assert.equal(h.user("player").xp, xp0 + 100);
  assert.equal(b.user.xp, xp0 + 100);
  assert.equal(h.user("player").matches, 3, "all three count");
  const hist = h.user("player").hist;
  assert.deepEqual(hist.slice(0, 3).map((m) => m.xp), [0, 30, 70]);
  assert.equal(c.coinGain, 1, "coins are a separate cap");
  const replay = await h.api("progress", b.body);
  assert.equal(replay.gain, 30); assert.equal(h.user("player").xp, xp0 + 100, "a replay gives nothing");
  assert.deepEqual(h.user("player").xpDay.n, 100);
  h.advance(16 * 3600 * 1000);
  const owner2 = await login(h, "owner");
  assert.equal((await play(h, p)).gain, 70, "the next day");
  // 0 = no ceiling
  await setConfig(h, owner2, (c) => { c.xp.maxPerDay = 0; });
  for (let i = 0; i < 3; i++) assert.equal((await play(h, p)).gain, 70);
});
