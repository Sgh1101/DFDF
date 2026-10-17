const test = require("node:test"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const tiers = require("../js/skin-tiers"), { harness } = require("./api-harness");
const login = (h, id = "coiner") => h.api("auth", { id, pw: "password", device: "coin-device" });
const seed = (h, id, values) => h.db.set("user:" + id, JSON.stringify({ ...h.user(id), ...values }));

test("existing Phantom ownership and equipment migrate to carbine once without charging or replacing another chosen skin", async () => {
  const h = harness(), p = await login(h);
  seed(h, "coiner", { championCoins: 123, gold: 456, own: { rifle: ["champions_atk", "champions_def", "dragon"], carbine: ["champions_atk", "gold"] }, skins: { m: { rifle: "champions_def", pistol: "default" }, t: 12 } });
  await h.api("me", { token: p.token });
  const first = h.user("coiner");
  assert.deepEqual(first.own.rifle, ["dragon"]); assert.deepEqual(first.own.carbine, ["champions_atk", "gold", "champions_def"]);
  assert.equal(first.skins.m.carbine, "champions_def"); assert.equal(first.skins.m.rifle, undefined); assert.ok(first.skins.t > 12);
  assert.equal(first.championCoins, 123); assert.equal(first.gold, 456);
  await h.api("me", { token: p.token }); assert.deepEqual(h.user("coiner").skins, first.skins);
  seed(h, "coiner", { own: { rifle: ["champions_atk"], carbine: ["gold"] }, skins: { m: { rifle: "champions_atk", carbine: "gold" }, t: 20 } });
  await h.api("me", { token: p.token }); assert.equal(h.user("coiner").skins.m.carbine, "gold");
  seed(h, "coiner", { own: {}, skins: { m: { rifle: "champions_def" }, t: 30 } });
  await h.api("me", { token: p.token }); assert.equal(h.user("coiner").skins.m.carbine, undefined, "an invalid saved skin cannot grant ownership");
});
test("the requested decimal chance is exactly one in 10^19, with unbiased 64-bit rejection", () => {
  assert.equal(tiers.transcendentPercent, "0.00000000000000001"); assert.equal(tiers.chanceDenominator, "10000000000000000000");
  assert.equal(tiers.rollTranscendent(() => Buffer.alloc(8)), true);
  const lose = Buffer.alloc(8); lose[7] = 1; assert.equal(tiers.rollTranscendent(() => lose), false);
  let calls = 0;
  assert.equal(tiers.rollTranscendent((n) => { assert.equal(n, 8); return ++calls === 1 ? Buffer.alloc(8, 255) : Buffer.alloc(8); }), true);
  assert.equal(calls, 2, "out-of-range samples are rejected instead of reduced modulo 10^19");
  const boundary = Buffer.alloc(8); boundary.writeBigUInt64BE(BigInt(tiers.chanceDenominator) - 1n);
  assert.equal(tiers.rollTranscendent(() => boundary), false);
});
test("each valid win, loss or draw earns one coin; replay and invalid reports earn none", async () => {
  const h = harness(), p = await login(h);
  assert.equal(p.user.championCoins, 0);
  assert.equal((await h.api("progress", { token: p.token, championCoins: 999 })).status, 409);
  const early = await h.api("match_start", { token: p.token }); h.advance(21000);
  assert.equal((await h.api("progress", { token: p.token, mt: early.ticket })).status, 409);
  assert.equal(h.user("coiner").championCoins, 0);
  let original;
  for (const [i, outcome] of ["win", "loss", "draw"].entries()) {
    const mt = await h.api("match_start", { token: p.token }); h.advance(61000);
    const body = { token: p.token, mt: mt.ticket, win: outcome === "win", outcome, championCoins: 999, match: { mode: "std", s: outcome === "draw" ? [5, 5] : [13, 7] } };
    const result = await h.api("progress", body);
    assert.equal(result.status, 200); assert.equal(result.coinGain, 1); assert.equal(result.user.championCoins, i + 1);
    assert.equal((await h.api("progress", body)).user.championCoins, i + 1);
    original ||= body;
  }
  assert.equal((await h.api("progress", original)).user.championCoins, 3);
  assert.equal(h.user("coiner").matches, 3);
});
test("coin award and match ticket commit atomically and can retry a failed commit", async () => {
  const h = harness(), p = await login(h), mt = await h.api("match_start", { token: p.token }); h.advance(61000); h.failCommit();
  const body = { token: p.token, mt: mt.ticket, win: true };
  assert.equal((await h.api("progress", body)).status, 500); assert.equal(h.user("coiner").championCoins, 0);
  h.advance(21000);
  assert.equal((await h.api("progress", body)).user.championCoins, 1);
  assert.equal((await h.api("progress", body)).user.championCoins, 1);
});
test("700 coins buy one variant, never gold; insufficient, duplicate and parallel purchases cannot overdraw", async () => {
  const h = harness(), p = await login(h), body = { token: p.token, g: "carbine", s: "champions_atk", price: 0, championCoins: 700 };
  assert.equal((await h.api("champion_buy", { ...body, token: "" })).status, 401);
  seed(h, "coiner", { championCoins: 699, gold: 100000 });
  assert.equal((await h.api("champion_buy", body)).status, 402);
  assert.equal(h.user("coiner").championCoins, 699);
  seed(h, "coiner", { championCoins: 700 });
  assert.equal((await h.api("champion_buy", { ...body, g: "rifle" })).status, 400);
  assert.equal(h.user("coiner").championCoins, 700, "the old gun target cannot spend coins");
  const results = await Promise.all([h.api("champion_buy", body), h.api("champion_buy", { ...body, s: "champions_def" })]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 402]);
  const user = h.user("coiner"), bought = user.own.carbine[0];
  assert.equal(user.championCoins, 0); assert.equal(user.gold, 100000); assert.equal(user.own.carbine.length, 1);
  assert.equal((await h.api("champion_buy", { ...body, s: bought })).status, 409);
  assert.equal((await h.api("champion_buy", { ...body, s: "dragon" })).status, 400);
  const shop = await h.api("champion_shop", { token: p.token });
  assert.equal(shop.championCoins, 0); assert.ok(shop.offers.every((item) => item.g === "carbine" && item.price === 700 && item.r === 5));
  assert.equal((await h.api("me", { token: p.token })).user.championCoins, 0);
});
test("an old reward receipt returns the current coin balance after a purchase", async () => {
  const h = harness(), p = await login(h); seed(h, "coiner", { championCoins: 699 });
  const mt = await h.api("match_start", { token: p.token }); h.advance(61000);
  const body = { token: p.token, mt: mt.ticket, win: true };
  assert.equal((await h.api("progress", body)).user.championCoins, 700);
  assert.equal((await h.api("champion_buy", { token: p.token, g: "carbine", s: "champions_atk" })).status, 200);
  assert.equal((await h.api("progress", body)).user.championCoins, 0);
  assert.equal(h.user("coiner").championCoins, 0);
});
test("a concurrent completed match and purchase preserve the earned coin", async () => {
  const h = harness(), p = await login(h); seed(h, "coiner", { championCoins: 700 });
  const mt = await h.api("match_start", { token: p.token }); h.advance(61000);
  const results = await Promise.all([h.api("progress", { token: p.token, mt: mt.ticket, win: false }), h.api("champion_buy", { token: p.token, g: "carbine", s: "champions_atk" })]);
  assert.deepEqual(results.map((r) => r.status), [200, 200]);
  assert.equal(h.user("coiner").championCoins, 1); assert.equal(h.user("coiner").matches, 1);
  assert.deepEqual(h.user("coiner").own.carbine, ["champions_atk"]);
});
test("a winning exact draw grants tier five; owning both variants returns to ordinary drops", async () => {
  const h = harness({ randomBytes: (n) => n === 8 ? Buffer.alloc(8) : crypto.randomBytes(n) }), p = await login(h);
  seed(h, "coiner", { gold: 10000 });
  const first = await h.api("gacha", { token: p.token }), second = await h.api("gacha", { token: p.token });
  assert.equal(first.results[0].r, 5); assert.equal(second.results[0].r, 5); assert.notEqual(first.results[0].s, second.results[0].s);
  assert.ok((await h.api("gacha", { token: p.token })).results[0].r <= 4);
  assert.equal(h.user("coiner").championCoins, 0, "a pull does not consume or award match coins");
});
test("ordinary completion cannot upgrade to Transcendent; gold shop cannot sell it", async () => {
  const h = harness({ randomBytes: (n) => { const bytes = crypto.randomBytes(n); if (n === 8) { bytes.fill(0); bytes[7] = 1; } return bytes; } }), p = await login(h);
  const catalog = await h.api("catalog"), own = {};
  for (const g of catalog.guns) own[g] = Object.keys(catalog.tiers).filter((s) => catalog.tiers[s] <= 4 && s !== "laurel" && (!catalog.only[s] || catalog.only[s] === g));
  own.pistol = own.pistol.filter((s) => s !== "snow");
  const config = JSON.parse(JSON.stringify(h.config)); config.gacha.odds = { common: 0, rare: 0, epic: 0, legendary: 1 };
  h.db.set("config", JSON.stringify(config)); h.advance(30001);
  seed(h, "coiner", { gold: 10000, own });
  const fallback = await h.api("gacha", { token: p.token });
  assert.deepEqual(fallback.results, [{ g: "pistol", s: "snow", r: 1 }], "a completed Legendary tier falls back to ordinary skins, never guaranteed Transcendent");
  assert.equal((await h.api("gacha", { token: p.token })).status, 409);
  assert.equal(h.user("coiner").gold, 9700);
  assert.equal((await h.api("shop_buy", { token: p.token, g: "carbine", s: "champions_atk" })).status, 404);
  assert.equal((await h.api("wish", { token: p.token, item: "carbine|champions_atk", on: true })).status, 400);
});
