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

// ---- orders -------------------------------------------------------------------------------------
async function shop() {
  const h = harness(), p = await login(h), owner = await login(h, "owner");
  await setConfig(h, owner, (c) => { c.order.on = true; c.order.bank = "국민 000000-00-000000"; c.order.holder = "홍길동"; });
  const ow = await login(h, "owner");
  const make = async (items, days) => { const r = await h.api("order_create", { token: p.token, items, days }); assert.equal(r.status, 200); return r.order.id; };
  const set = (id, op, extra = {}) => h.api("a_order_set", Object.assign({ atoken: ow.atoken, id, op }, extra));
  const grant = async (items, days) => { const id = await make(items, days); assert.equal((await set(id, "grant")).status, 200); return id; };
  const perm = () => h.user("player").perm;
  return { h, p, ow, make, set, grant, perm };
}
const on = (perm) => ["radar", "wall", "cheat", "oneShot", "infAmmo", "noRecoil"].filter((k) => perm[k]).join(",");

test("a revoke takes back all the gold even if it is spent: the balance goes below nothing, pulls fail until it is earned back", async () => {
  const { h, p, grant, set } = await shop();
  const before = h.user("player").gold;
  const id = await grant(["gold5k"], 0);
  assert.equal(h.user("player").gold, before + 5000);
  h.db.set("user:player", JSON.stringify({ ...h.user("player"), gold: 100 })); // spent
  assert.equal((await set(id, "revoke", { reason: "x" })).status, 200);
  assert.equal(h.user("player").gold, 100 - 5000);
  const me = await h.api("me", { token: p.token });
  assert.equal(me.user.gold, -4900, "reading the account keeps the debt");
  assert.equal(h.user("player").gold, -4900);
  const pull = await h.api("gacha", { token: p.token });
  assert.equal(pull.status, 402); assert.equal(h.user("player").gold, -4900);
  assert.equal((await h.api("shop_buy", { token: p.token, id: "x" })).status < 500, true);
  // a match adds to the debt's balance, it does not reset it
  const r = await play(h, p);
  assert.equal(r.user.gold, -4900 + r.gold); assert.ok(r.user.gold < 0);
  // refund with revoke is the same
  const id2 = await grant(["gold1k"], 0);
  const g = h.user("player").gold;
  assert.equal((await set(id2, "refund", { revoke: true })).status, 200);
  assert.equal(h.user("player").gold, g - 1000);
  h.db.set("user:player", JSON.stringify({ ...h.user("player"), gold: 0 }));
  const id3 = await grant(["gold1k"], 0);
  h.db.set("user:player", JSON.stringify({ ...h.user("player"), gold: 0 }));
  assert.equal((await set(id3, "refund", { revoke: true })).status, 200);
  assert.equal(h.user("player").gold, -1000);
});

test("revoking one of two orders that grant the same cheat keeps that cheat on; the timed end drops by this order's days", async () => {
  const { h, grant, set, perm } = await shop();
  const t0 = h.now();
  const a = await grant(["radar", "wall"], 7), b = await grant(["radar", "oneShot"], 30);
  assert.equal(on(perm()), "radar,wall,oneShot");
  assert.ok(Math.abs(perm().until - (t0 + 37 * DAY)) < 5000);
  assert.equal((await set(a, "revoke")).status, 200);
  assert.equal(on(perm()), "radar,oneShot", "radar stays (the other order grants it), wall goes");
  assert.equal(perm().on, true);
  assert.ok(Math.abs(perm().until - (t0 + 30 * DAY)) < 5000, "the seven days come off");
  assert.equal((await set(b, "revoke")).status, 200);
  assert.equal(perm().on, false); assert.equal(on(perm()), "");
});

test("the last order opened is taken back exactly: the end goes back to what it was; speed and buff levels follow the same rule", async () => {
  const { h, grant, set, perm } = await shop();
  const a = await grant(["speed"], 7), until = perm().until;
  const b = await grant(["speed", "buff"], 30);
  assert.deepEqual([perm().speed, perm().buff, perm().until], [1.5, 10, until + 30 * DAY]);
  await set(b, "revoke");
  assert.deepEqual([perm().on, perm().speed, perm().buff, perm().until], [true, 1.5, 0, until], "speed stays, buff goes, the end is as before");
  await set(a, "revoke");
  assert.equal(perm().on, false); assert.equal(perm().speed, 1);
});

test("timed and permanent orders: a permanent one left keeps the account permanent; when it goes the account falls to the latest end that remains", async () => {
  const { h, grant, set, perm } = await shop();
  const t0 = h.now();
  // a timed order, then a permanent one on top; taking the timed one back leaves the permanent cheat
  const t = await grant(["radar"], 7), pm = await grant(["radar", "wall"], 0);
  assert.equal(perm().until, 0);
  await set(t, "revoke");
  assert.equal(perm().until, 0, "still permanent"); assert.equal(on(perm()), "radar,wall");
  await set(pm, "revoke");
  assert.equal(perm().on, false, "nothing remains");
  // the other way round: a permanent order first, a timed one after it
  const p2 = await grant(["wall"], 0), t2 = await grant(["radar"], 7);
  assert.equal(perm().until, 0);
  await set(p2, "revoke");
  assert.equal(on(perm()), "radar", "only the cheat of the order that remains"); assert.equal(perm().on, true);
  assert.ok(perm().until > 0 && Math.abs(perm().until - (h.now() + 7 * DAY)) < 5000, "it ends when the timed order ends");
  await set(t2, "revoke");
  assert.equal(perm().on, false);
  void t0;
});

test("an order that has already run out leaves the end alone, and only the cheats nobody else grants go", async () => {
  const { h, grant, perm } = await shop();
  const a = await grant(["radar"], 1);
  h.advance(2 * DAY);
  const { ow: ow2, p: p2 } = { ow: await login(h, "owner"), p: await login(h) };
  const bid = (await h.api("order_create", { token: p2.token, items: ["wall"], days: 7 })).order.id;
  assert.equal((await h.api("a_order_set", { atoken: ow2.atoken, id: bid, op: "grant" })).status, 200);
  const b = bid, until = perm().until;
  assert.ok(until > h.now());
  const set2 = (id, op) => h.api("a_order_set", { atoken: ow2.atoken, id, op });
  assert.equal((await set2(a, "revoke")).status, 200);
  assert.equal(perm().until, until); assert.equal(on(perm()), "wall");
  assert.equal((await set2(b, "revoke")).status, 200);
  assert.equal(perm().on, false);
});

test("a revoke leaves the cheats the owner gave by hand", async () => {
  const { h, ow, grant, set, perm } = await shop();
  assert.equal((await h.api("a_user_set", { atoken: ow.atoken, id: "player", op: "perm", perm: { on: true, noRecoil: true }, days: 0 })).status, 200);
  const o = await grant(["radar"], 7);
  assert.equal(on(perm()), "radar,noRecoil");
  await set(o, "revoke");
  assert.equal(on(perm()), "noRecoil"); assert.equal(perm().on, true);
});

test("refund with revoke takes back by the same rule: other orders' cheats and the hand-given ones stay, the gold goes below nothing", async () => {
  const { h, ow, grant, set, perm } = await shop();
  await h.api("a_user_set", { atoken: ow.atoken, id: "player", op: "perm", perm: { on: true, noRecoil: true }, days: 0 });
  const a = await grant(["radar", "wall"], 7), until = perm().until;
  assert.equal(until, 0, "the account was permanent already");
  const b = await grant(["radar", "oneShot", "gold5k"], 30);
  h.db.set("user:player", JSON.stringify({ ...h.user("player"), gold: 10 }));
  const r = await set(b, "refund", { revoke: true, reason: "환불" });
  assert.equal(r.status, 200); assert.equal(r.order.status, "refunded");
  assert.equal(on(perm()), "radar,wall,noRecoil"); assert.equal(perm().on, true);
  assert.equal(h.user("player").gold, 10 - 5000);
  // refunding a pending order takes nothing; an already revoked one is not taken back twice
  const c = await grant(["gold1k"], 0);
  await set(c, "revoke");
  const g = h.user("player").gold;
  assert.equal((await set(c, "refund", { revoke: true })).status, 200);
  assert.equal(h.user("player").gold, g, "revoked once, not twice");
  void a;
});

test("the order lock and the status-before-ledger order of a take-back are unchanged", async () => {
  const { h, make, grant, set, perm } = await shop();
  const o = await grant(["radar"], 7);
  const first = await set(o, "revoke");
  assert.equal(first.status, 200); assert.equal(JSON.parse(h.db.get("ord:" + o)).status, "revoked");
  assert.equal((await set(o, "revoke")).status, 409, "once");
  assert.equal(perm().on, false);
  const pending = await make(["wall"], 7);
  h.db.set("ordlock:" + pending, "someone-else");
  assert.equal((await set(pending, "grant")).status, 409, "another request holds the order");
});

test("each cheat has its own end: a one-day radar on top of a permanent wall is not permanent, and it runs out alone", async () => {
  const { h, p, grant, perm } = await shop();
  await grant(["wall"], 0);
  const r = await grant(["radar"], 1);
  assert.equal(perm().ends.wall, 0, "wall stays permanent");
  assert.ok(Math.abs(perm().ends.radar - (h.now() + DAY)) < 5000, "radar ends in a day");
  assert.equal((await h.api("me", { token: p.token })).user.perm.radar, true);
  h.advance(2 * DAY);
  const me = (await h.api("me", { token: p.token })).user.perm;
  assert.deepEqual([me.wall, me.radar, me.on, me.until], [true, false, true, 0], "radar is gone, the wall remains");
  const ow2 = await login(h, "owner");
  assert.equal((await h.api("a_order_set", { atoken: ow2.atoken, id: r, op: "revoke" })).status, 200, "an order that has run out can still be taken back");
  assert.equal(perm().wall, true); assert.equal(perm().radar, false);
});

test("a cheat bought again extends its own end only; refund of the later order restores that end, not the others'", async () => {
  const { h, grant, set, perm } = await shop();
  const t0 = h.now();
  await grant(["wall"], 30);
  const radar = await grant(["radar"], 1);
  const more = await grant(["radar"], 7);
  assert.ok(Math.abs(perm().ends.radar - (t0 + 8 * DAY)) < 5000);
  assert.ok(Math.abs(perm().ends.wall - (t0 + 30 * DAY)) < 5000, "wall is untouched");
  await set(more, "refund", { revoke: true });
  assert.ok(Math.abs(perm().ends.radar - (t0 + DAY)) < 5000, "radar is back to one day");
  assert.ok(Math.abs(perm().ends.wall - (t0 + 30 * DAY)) < 5000);
  await set(radar, "revoke");
  assert.equal(perm().radar, false); assert.equal(perm().wall, true);
});

test("a perm from before per-cheat ends (only until) keeps working, and an order merges into it", async () => {
  const { h, grant, set, perm } = await shop();
  const until = h.now() + 20 * DAY;
  h.db.set("user:player", JSON.stringify({ ...h.user("player"), perm: { on: true, radar: true, wall: false, cheat: false, god: false, oneShot: false, infAmmo: false, noRecoil: false, speed: 1, fastFire: 1, buff: 0, until } }));
  const w = await grant(["wall"], 7);
  assert.equal(perm().ends.radar, until, "the old cheat keeps the old end");
  assert.ok(Math.abs(perm().ends.wall - (h.now() + 7 * DAY)) < 5000);
  await set(w, "revoke");
  assert.deepEqual([perm().radar, perm().wall, perm().until], [true, false, until]);
});
