const test = require("node:test");
const assert = require("node:assert/strict");
const { harness } = require("./api-harness");
const login = (h, id = "player") => h.api("auth", { id, pw: id === "owner" ? "owner-password" : "password", device: "device-123" });
const squad = async (h, ids) => Object.fromEntries(await Promise.all(ids.map(async (id) => [id, (await login(h, id)).token])));


test("owner attestation cannot be used as a player or admin credential", async () => {
  const h = harness(), owner = await login(h, "owner");
  assert.equal(owner.status, 200);
  const issued = await h.api("owner_ticket", { token: owner.token, room: "ABC123", p: "peer-1" });
  assert.equal(issued.status, 200);
  assert.equal((await h.api("owner_check", { ticket: issued.ticket, room: "ABC123", p: "peer-1" })).owner, true);
  for (const body of [{ token: owner.token }, { ticket: issued.ticket, room: "XYZ123", p: "peer-1" }, { ticket: issued.ticket, room: "ABC123", p: "peer-2" }, { ticket: issued.ticket + ".extra", room: "ABC123", p: "peer-1" }]) assert.equal((await h.api("owner_check", body)).owner, false);
  assert.equal((await h.api("me", { token: issued.ticket })).status, 401);
  assert.equal((await h.api("a_config_get", { atoken: issued.ticket })).status, 401);
  assert.equal((await h.api("a_config_get", { atoken: owner.atoken })).status, 200);
  h.advance(300001);
  assert.equal((await h.api("owner_check", { ticket: issued.ticket, room: "ABC123", p: "peer-1" })).owner, false);
});

test("nonowners and malformed scopes cannot acquire owner authority", async () => {
  const h = harness(), player = await login(h);
  assert.equal((await h.api("owner_ticket", { token: player.token, room: "ABC123", p: "peer-1" })).ticket, null);
  const owner = await login(h, "owner");
  for (const room of ["", "ABC123x", "abc123", "ABC123/", "ABC123 "]) assert.equal((await h.api("owner_ticket", { token: owner.token, room, p: "peer-1" })).status, 400);
  assert.equal((await h.api("me", { token: h.sign({ k: "p", id: "owner", o: 1, exp: h.now() + 100000 }) })).status, 401);
  assert.equal((await h.api("a_config_get", { atoken: h.sign({ k: "admin", exp: h.now() + 100000 }) })).status, 401);
});

test("parallel pulls preserve every charge and awarded item", async () => {
  const h = harness(), player = await login(h), admin = await login(h, "owner");
  await h.api("a_user_set", { atoken: admin.atoken, id: "player", op: "gold", gold: 900 });
  const results = await Promise.all(Array.from({ length: 3 }, () => h.api("gacha", { token: player.token })));
  assert.deepEqual(results.map((x) => x.status), [200, 200, 200]);
  const user = h.user("player");
  assert.equal(user.gold, 0); assert.equal(user.pulls, 3);
  assert.equal(Object.values(user.own).flat().length, 3);
});

test("ban and password changes cannot be overwritten by stale wallet requests", async () => {
  const h = harness(), player = await login(h), admin = await login(h, "owner");
  await h.api("a_user_set", { atoken: admin.atoken, id: "player", op: "password", pw: "changed-password" });
  assert.equal((await h.api("me", { token: player.token })).status, 401);
  const next = await h.api("auth", { id: "player", pw: "changed-password", device: "device-123" });
  await Promise.all([h.api("gacha", { token: next.token }), h.api("a_user_set", { atoken: admin.atoken, id: "player", op: "ban", reason: "test" })]);
  assert.equal((await h.api("gacha", { token: next.token })).status, 403);
  assert.equal(h.user("player").ban.reason, "test");
});

test("older preference and skin updates preserve newer records", async () => {
  const h = harness(), p = await login(h);
  await h.api("prefs", { token: p.token, set: { touch: { "tb-fire": [0.8, 0.5, 1] } }, t: 2000 });
  await h.api("prefs", { token: p.token, set: { touch: { "tb-fire": [0.1, 0.5, 1] } }, t: 1000 });
  assert.equal(h.user("player").prefs.t, 2000);
  await h.api("skins", { token: p.token, set: {}, t: 2000 });
  await h.api("skins", { token: p.token, set: {}, t: 1000 });
  assert.equal(h.user("player").skins.t, 2000);
});

test("unverified reports award nothing; verified reports can be replayed once", async () => {
  const h = harness(), p = await login(h);
  assert.equal((await h.api("progress", { token: p.token, kills: 60, win: true })).status, 409);
  assert.equal(h.user("player").matches, 0);
  const mt = await h.api("match_start", { token: p.token });
  h.advance(61000);
  const body = { token: p.token, mt: mt.ticket, kills: 4, win: true, match: { mode: "std", s: [13, 7] } };
  const first = await h.api("progress", body), replay = await h.api("progress", body);
  assert.equal(first.status, 200); assert.deepEqual(replay, first);
  assert.equal(h.user("player").matches, 1);
  // 300 sign-up + 100 win + 4 x 5 kills, and the rewards of progression: 40 for the level reached (110 XP), the first win of the day 100, the first-win achievement 100
  assert.equal(h.user("player").gold, 420 + 40 + 100 + 100);
});

test("a failed report commit preserves its ticket and succeeds on retry", async () => {
  const h = harness(), p = await login(h), mt = await h.api("match_start", { token: p.token });
  h.advance(61000); h.failCommit();
  const b = { token: p.token, mt: mt.ticket, kills: 1, win: false };
  assert.equal((await h.api("progress", b)).status, 500);
  assert.equal(h.user("player").matches, 0);
  h.advance(21000);
  assert.equal((await h.api("progress", b)).status, 200);
  assert.equal(h.user("player").matches, 1);
});

test("replaying an old award preserves current wallet and inventory", async () => {
  const h = harness(), p = await login(h), admin = await login(h, "owner");
  const mt = await h.api("match_start", { token: p.token }); h.advance(61000);
  const body = { token: p.token, mt: mt.ticket, win: true, kills: 0, match: { mode: "std", s: [13, 7] } };
  const original = await h.api("progress", body);
  await h.api("gacha", { token: p.token });
  await h.api("a_user_set", { atoken: admin.atoken, id: "player", op: "grant", item: "rifle|dragon" });
  const replay = await h.api("progress", body);
  assert.equal(replay.gold, original.gold); assert.equal(replay.user.gold, 100 + 40 + 100 + 100); // 300 + 100 - the 300 pull, and the rewards of progression
  assert.equal(replay.user.owned, 2); assert.equal(replay.hist.length, 1);
});

test("a draw is not a win", async () => {
  const h = harness(), p = await login(h);
  const mt = await h.api("match_start", { token: p.token }); h.advance(61000);
  const r = await h.api("progress", { token: p.token, mt: mt.ticket, outcome: "draw", win: true, match: { mode: "tdm", s: [10, 10] } });
  assert.equal(r.status, 200); assert.equal(r.user.wins, 0); assert.equal(r.user.matches, 1);
  assert.equal("rank" in r.user || "rr" in r || "ranked" in r, false, "no rank in the answer");
});

test("invalid configuration is rejected and old zero-level settings remain readable", async () => {
  const h = harness(), owner = await login(h, "owner");
  const c = JSON.parse(JSON.stringify(h.config)); c.xp.perLevel = 0;
  assert.equal((await h.api("a_config_set", { atoken: owner.atoken, config: c })).status, 400);
  c.xp.perLevel = 100; c.gacha.cost1 = -1;
  assert.equal((await h.api("a_config_set", { atoken: owner.atoken, config: c })).status, 400);
});

test("pipeline errors fail closed instead of dropping ban checks", async () => {
  const h = harness(), p = await login(h); h.failPipeline();
  const result = await h.api("gacha", { token: p.token });
  assert.equal(result.status, 500); assert.equal(h.user("player").pulls || 0, 0);
});


test("delete and recreate never revives the old session or match ticket", async () => {
  const h = harness(), old = await login(h), owner = await login(h, "owner");
  const mt = await h.api("match_start", { token: old.token });
  await h.api("a_user_set", { atoken: owner.atoken, id: "player", op: "delete" });
  assert.equal((await h.api("me", { token: old.token })).status, 401);
  const fresh = await login(h);
  assert.notEqual(fresh.token, old.token);
  for (const action of ["me", "prefs", "skins", "missions", "match_start", "gacha"])
    assert.equal((await h.api(action, { token: old.token })).status, 401, action);
  h.advance(61000);
  assert.equal((await h.api("progress", { token: fresh.token, mt: mt.ticket, win: true })).status, 409);
  assert.equal(h.user("player").matches, 0);
});


test("common auth enforces device and IP bans for players and guests, including expiry", async () => {
  for (const kind of ["player", "guest"]) {
    const h = harness();
    const account = kind === "player" ? await login(h) : await h.api("guest", { device: "device-123" });
    for (const key of ["ban:dev:device-123", "ban:ip:127.0.0.1"]) {
      h.db.set(key, JSON.stringify({ reason: "test restriction", until: h.now() + 1000 }));
      for (const action of ["me", "prefs", "skins", "missions", "gacha", "match_start"])
        assert.equal((await h.api(action, { token: account.token })).status, 403, kind + " " + action);
      h.advance(1001);
      assert.equal((await h.api("me", { token: account.token })).status, 200);
    }
  }
});

test("records without a session version require login instead of accepting an unversioned token", async () => {
  const h = harness(); await login(h);
  const record = h.user("player"); delete record.sessionVersion; h.db.set("user:player", JSON.stringify(record));
  const token = h.sign({ k: "p", id: "player", exp: h.now() + 10000 });
  assert.equal((await h.api("me", { token })).status, 401);
  assert.equal((await login(h)).status, 200);
});

test("match tickets have a limit, and an old client asking for a ranked one gets a plain one", async () => {
  const h = harness(), tok = await squad(h, ["bobby"]);
  // twelve tickets in ten minutes, then the limit; a request that still says ranked (an old client) is a plain match
  for (let i = 0; i < 12; i++) {
    const r = await h.api("match_start", { token: tok.bobby, ranked: i === 0, room: "RNK001" });
    assert.equal(r.status, 200, "ticket " + i); assert.equal("ranked" in r, false);
  }
  assert.equal((await h.api("match_start", { token: tok.bobby })).status, 429);
});

test("aim assist: phones on by default, a computer only when the owner opens it, with an end date", async () => {
  const h = harness(), player = await login(h), owner = await login(h, "owner");
  const me = async () => (await h.api("me", { token: player.token })).user.aim;
  assert.deepEqual(await me(), { pc: false, mobile: true, until: 0 });
  assert.equal((await h.api("a_user_set", { atoken: owner.atoken, id: "player", op: "aim", pc: true, mobile: false, days: 2 })).status, 200);
  const a = await me();
  assert.equal(a.pc, true); assert.equal(a.mobile, false); assert.ok(a.until > h.now());
  h.advance(3 * 864e5);
  assert.equal((await me()).pc, false);
  const owner2 = await login(h, "owner");
  const cfg = (await h.api("config", {})).config.aim;
  assert.deepEqual(cfg, { mobile: true, pc: true, strength: 35, range: 45, cone: 8, ranked: true });
  const c = JSON.parse(JSON.stringify(h.config)); c.aim.strength = 140;
  assert.equal((await h.api("a_config_set", { atoken: owner2.atoken, config: c })).status, 400);
  c.aim.strength = 60; c.aim.pc = false;
  assert.equal((await h.api("a_config_set", { atoken: owner2.atoken, config: c })).status, 200);
  h.advance(30000);
  assert.deepEqual((await h.api("config", {})).config.aim, { mobile: true, pc: false, strength: 60, range: 45, cone: 8, ranked: true });
});

test("the owner's dashboard summary counts accounts, grants and the day's log", async () => {
  const h = harness(), player = await login(h), owner = await login(h, "owner");
  await h.api("a_user_set", { atoken: owner.atoken, id: "player", op: "aim", pc: true });
  assert.equal((await h.api("a_user_set", { atoken: owner.atoken, id: "player", op: "rr", rr: 950 })).status, 400, "no rank points to set");
  await h.api("a_user_set", { atoken: owner.atoken, id: "player", op: "gold", gold: 1234 });
  assert.equal((await h.api("a_summary", { atoken: player.token })).status, 401);
  const j = await h.api("a_summary", { atoken: owner.atoken });
  assert.equal(j.status, 200);
  const s = j.summary;
  assert.equal(s.scanned, 2); assert.equal(s.aimPc, 1); assert.equal(s.new1, 2);
  assert.ok(s.gold >= 1234);
  assert.equal("ranks" in s || "topRR" in s || "season" in s || "ranked" in s || "ranked" in j.rooms || "season" in j.config, false, "nothing of ranked play");
  assert.equal(s.signups[13], 2, "both signed up today");
  assert.ok(j.logs.login + j.logs.join >= 1);
  assert.ok(j.recent.some((r) => /aim/.test(r.msg)));
  assert.deepEqual(j.config.aim, { mobile: true, pc: true, strength: 35, range: 45, cone: 8, ranked: true });
  assert.equal(j.items, 604);
});

test("retired skins leave the collection and come back as gold, once", async () => {
  const h = harness(), player = await login(h), owner = await login(h, "owner");
  await h.api("a_user_set", { atoken: owner.atoken, id: "player", op: "gold", gold: 0 });
  const u = h.user("player");
  u.own = { rifle: ["holo", "lava"], pistol: ["ice", "obsidian"] };
  u.skins = { m: { rifle: "holo", pistol: "ice" }, t: 1 };
  h.db.set("user:player", JSON.stringify(u));
  const j = await h.api("skins", { token: player.token });
  assert.equal(j.status, 200);
  assert.deepEqual(j.own, { rifle: ["lava"], pistol: [] });
  assert.equal(j.gold, 300 * 3 + 300 + 300);
  assert.equal((await h.api("skins", { token: player.token })).gold, 1500, "only once");
  assert.equal(h.user("player").skins.m.rifle, undefined);
  assert.equal((await h.api("a_user_set", { atoken: owner.atoken, id: "player", op: "grant", item: "rifle|holo" })).status, 400);
});

test("the daily shop: twenty skins by tier, the same for everyone all day, bought once for gold", async () => {
  const h = harness(), player = await login(h), owner = await login(h, "owner");
  const a = await h.api("shop", {}), b = await h.api("shop", { token: player.token });
  assert.equal(a.status, 200);
  assert.equal(a.items.length, 20);
  assert.deepEqual(a.items.map((x) => x.g + "|" + x.s), b.items.map((x) => x.g + "|" + x.s), "the same shop for everyone");
  assert.deepEqual([1, 2, 3, 4].map((r) => a.items.filter((x) => x.r === r).length), [7, 6, 4, 3]);
  assert.equal(new Set(a.items.map((x) => x.g + "|" + x.s)).size, 20);
  assert.ok(a.resetAt > h.now() && a.resetAt - h.now() <= 864e5);
  for (const x of a.items) assert.equal(x.price, [0, 1200, 3000, 7000, 15000][x.r] * (["flip", "tanto", "kukri", "karambit", "butterfly", "bayonet", "gut", "bowie", "kunai", "stiletto"].includes(x.s) ? 1.5 : 1));
  const it = a.items.find((x) => x.r === 4);
  await h.api("a_user_set", { atoken: owner.atoken, id: "player", op: "gold", gold: 1000 });
  assert.equal((await h.api("shop_buy", { token: player.token, g: it.g, s: it.s, day: a.day })).status, 402);
  await h.api("a_user_set", { atoken: owner.atoken, id: "player", op: "gold", gold: 40000 });
  const ok = await h.api("shop_buy", { token: player.token, g: it.g, s: it.s, day: a.day });
  assert.equal(ok.status, 200);
  assert.equal(ok.gold, 40000 - it.price);
  assert.ok(ok.own[it.g].includes(it.s));
  assert.equal((await h.api("shop_buy", { token: player.token, g: it.g, s: it.s, day: a.day })).status, 409, "not twice");
  assert.equal((await h.api("shop", { token: player.token })).items.find((x) => x.g === it.g && x.s === it.s).own, true);
  // something not in today's shop, a stale day, no sign-in
  const off = ["rifle", "pistol", "smg"].flatMap((g) => ["snow", "lava", "koi"].map((s) => ({ g, s }))).find((x) => !a.items.some((y) => y.g === x.g && y.s === x.s));
  assert.equal((await h.api("shop_buy", { token: player.token, g: off.g, s: off.s })).status, 404);
  assert.equal((await h.api("shop_buy", { token: player.token, g: a.items[0].g, s: a.items[0].s, day: "2000-01-01" })).status, 409);
  assert.equal((await h.api("shop_buy", { g: a.items[0].g, s: a.items[0].s })).status, 401);
  assert.ok(h.db.get("logs").some((l) => /구매/.test(l)));
  // tomorrow: a different shop
  h.advance(864e5);
  const next = await h.api("shop", {});
  assert.notDeepEqual(next.items.map((x) => x.g + "|" + x.s), a.items.map((x) => x.g + "|" + x.s));
  // the owner rerolls, changes the mix and prices, closes it
  const owner2 = await login(h, "owner");
  const c = JSON.parse(JSON.stringify(h.config));
  c.shop.reroll = 1; c.shop.mix = { common: 2, rare: 2, epic: 1, legendary: 1 }; c.shop.price.legendary = 30000;
  assert.equal((await h.api("a_config_set", { atoken: owner2.atoken, config: c })).status, 200);
  h.advance(30000);
  const r = await h.api("shop", {});
  assert.equal(r.items.length, 6);
  assert.ok(r.items.filter((x) => x.r === 4).every((x) => x.price === 30000 || x.price === 45000));
  c.shop.mix = { common: 0, rare: 0, epic: 0, legendary: 0 };
  assert.equal((await h.api("a_config_set", { atoken: owner2.atoken, config: c })).status, 400);
  c.shop.mix = { common: 1, rare: 0, epic: 0, legendary: 0 }; c.shop.on = false;
  assert.equal((await h.api("a_config_set", { atoken: owner2.atoken, config: c })).status, 200);
  h.advance(30000);
  assert.deepEqual((await h.api("shop", {})).items, []);
  assert.equal((await h.api("shop_buy", { token: player.token, g: "rifle", s: "snow" })).status, 403);
});

test("the wishlist: toggled per item, checked, capped, marked in the shop, dropped once bought", async () => {
  const h = harness(), player = await login(h), owner = await login(h, "owner");
  assert.deepEqual((await h.api("wish", { token: player.token })).wish, []);
  assert.equal((await h.api("wish", { token: player.token, item: "rifle|nope" })).status, 400);
  assert.equal((await h.api("wish", { token: player.token, item: "rifle|karambit" })).status, 400, "a knife skin only fits the knife");
  const shop = await h.api("shop", {});
  const it = shop.items.find((x) => x.r === 2), key = it.g + "|" + it.s;
  assert.deepEqual((await h.api("wish", { token: player.token, item: key, on: true })).wish, [key]);
  assert.deepEqual((await h.api("wish", { token: player.token, item: "rifle|lava", on: true })).wish, [key, "rifle|lava"]);
  const marked = await h.api("shop", { token: player.token });
  assert.equal(marked.items.find((x) => x.g === it.g && x.s === it.s).wished, true);
  assert.deepEqual(marked.wish, [key, "rifle|lava"]);
  assert.deepEqual((await h.api("wish", { token: player.token, item: "rifle|lava", on: false })).wish, [key]);
  await h.api("a_user_set", { atoken: owner.atoken, id: "player", op: "gold", gold: 50000 });
  assert.equal((await h.api("shop_buy", { token: player.token, g: it.g, s: it.s, day: shop.day })).status, 200);
  assert.deepEqual((await h.api("wish", { token: player.token })).wish, [], "bought, so off the list");
  assert.equal((await h.api("wish", { item: key, on: true })).status, 401);
});

test("the weekly deal: epic and legendary skins at a discount all week, from Monday, bought at the weekly price", async () => {
  const h = harness({ now: Date.parse("2026-10-14T03:00:00Z") }), player = await login(h), owner = await login(h, "owner");
  const a = await h.api("shop", { token: player.token }), key = (x) => x.g + "|" + x.s;
  assert.equal(a.week, "2026-10-12", "the week starts on a Monday (Korea)");
  assert.deepEqual([3, 4].map((r) => a.weekly.filter((x) => x.r === r).length), [2, 3]);
  assert.equal(a.weekResetAt, Date.parse("2026-10-18T15:00:00Z"), "the next Monday, midnight in Korea");
  assert.ok(a.weekly.every((x) => x.w === 1 && x.price < x.was && Math.abs(x.price - x.was * 0.7) <= 10 && x.s !== "laurel"));
  assert.equal(new Set(a.weekly.map((x) => x.g)).size, a.weekly.length, "a gun once");
  assert.ok(a.items.every((x) => !a.weekly.some((w) => key(w) === key(x))), "not also in the day's list");
  // the same all week, a new one on Monday
  h.advance(3 * 864e5);
  assert.deepEqual((await h.api("shop", {})).weekly.map(key), a.weekly.map(key));
  const mon = Date.parse("2026-10-18T15:00:01Z") - h.now();
  h.advance(mon);
  const next = await h.api("shop", {});
  assert.equal(next.week, "2026-10-19");
  assert.notDeepEqual(next.weekly.map(key), a.weekly.map(key));
  // bought from the weekly list at the weekly price, not twice, not at the wrong week
  const it = next.weekly.find((x) => x.r === 4), owner2 = await login(h, "owner");
  assert.equal((await h.api("a_user_set", { atoken: owner2.atoken, id: "player", op: "gold", gold: 40000 })).status, 200);
  assert.equal((await h.api("shop_buy", { token: player.token, g: it.g, s: it.s, w: 1, week: "2026-10-12" })).status, 409);
  assert.equal((await h.api("shop_buy", { token: player.token, g: it.g, s: it.s })).status, 404, "daily list only without the weekly flag");
  const ok = await h.api("shop_buy", { token: player.token, g: it.g, s: it.s, w: 1, week: next.week });
  assert.equal(ok.status, 200);
  assert.equal(ok.gold, 40000 - it.price);
  assert.ok(h.db.get("logs").some((l) => /구매\(주간 특가\)/.test(l)));
  assert.equal((await h.api("shop_buy", { token: player.token, g: it.g, s: it.s, w: 1, week: next.week })).status, 409);
  // the owner: the discount, the mix, a reroll, off
  const c = JSON.parse(JSON.stringify(h.config));
  c.shop.weekly.off = 50; c.shop.weekly.mix = { epic: 1, legendary: 1 };
  assert.equal((await h.api("a_config_set", { atoken: owner2.atoken, config: c })).status, 200);
  h.advance(30000);
  const half = await h.api("shop", {});
  assert.equal(half.weekly.length, 2);
  assert.ok(half.weekly.every((x) => Math.abs(x.price - x.was * 0.5) <= 10));
  c.shop.weekly.off = 95;
  assert.equal((await h.api("a_config_set", { atoken: owner2.atoken, config: c })).status, 400);
  c.shop.weekly.off = 50; c.shop.weekly.reroll = 1;
  assert.equal((await h.api("a_config_set", { atoken: owner2.atoken, config: c })).status, 200);
  h.advance(30000);
  assert.notDeepEqual((await h.api("shop", {})).weekly.map(key), half.weekly.map(key));
  c.shop.weekly.on = false;
  assert.equal((await h.api("a_config_set", { atoken: owner2.atoken, config: c })).status, 200);
  h.advance(30000);
  const off = await h.api("shop", {});
  assert.deepEqual([off.weekly.length, off.items.length], [0, 20]);
  const sm = await h.api("a_summary", { atoken: owner2.atoken });
  assert.deepEqual(sm.weekly, []);
});

test("profile cosmetics: bought with gold, owned once, equipped only in their own slot, kept on the account", async () => {
  const fs = require("node:fs"), path = require("node:path");
  const h = harness(), p = await login(h), owner = await login(h, "owner");
  // the game's own list (js/cosmetics.js) and the server's name the same items, slots and tiers
  const win = {}, ctx = { window: win, localStorage: { getItem: () => "ko" } };
  new Function("window", "localStorage", fs.readFileSync(path.join(__dirname, "..", "js", "cosmetics.js"), "utf8"))(win, ctx.localStorage);
  const a = await h.api("cos", { token: p.token });
  assert.equal(a.status, 200);
  assert.deepEqual(a.items.map((x) => x.id + ":" + x.s + ":" + x.r).sort(), win.COSMETICS.items.map((x) => x.id + ":" + x.s + ":" + x.r).sort(), "the server and the game agree on the catalogue");
  assert.deepEqual(a.items.filter((x) => x.r === 1).map((x) => x.price), a.items.filter((x) => x.r === 1).map(() => 600));
  assert.deepEqual(a.own, []);
  assert.deepEqual(a.eq, { title: "", card: "", banner: "" });
  // too poor, then bought, not twice
  assert.equal((await h.api("cos_buy", { token: p.token, id: "marksman" })).status, 402, "300 gold only");
  await h.api("a_user_set", { atoken: owner.atoken, id: "player", op: "gold", gold: 12000 });
  const ok = await h.api("cos_buy", { token: p.token, id: "marksman" });
  assert.equal(ok.status, 200);
  assert.equal(ok.gold, 12000 - 1800);
  assert.deepEqual(ok.own, ["marksman"]);
  assert.equal((await h.api("cos_buy", { token: p.token, id: "marksman" })).status, 409);
  assert.equal((await h.api("cos_buy", { token: p.token, id: "nothing" })).status, 404);
  assert.equal((await h.api("cos_buy", { id: "gold" })).status, 401);
  assert.ok(h.db.get("logs").some((l) => /꾸미기 구매: title\/marksman/.test(l)));
  // equipped: only what is owned, only in its own slot, off again with an empty id
  assert.equal((await h.api("cos_equip", { token: p.token, slot: "title", id: "rookie" })).status, 403, "not owned");
  assert.equal((await h.api("cos_equip", { token: p.token, slot: "card", id: "marksman" })).status, 400, "wrong slot");
  assert.equal((await h.api("cos_equip", { token: p.token, slot: "hat", id: "marksman" })).status, 400);
  const eq = await h.api("cos_equip", { token: p.token, slot: "title", id: "marksman" });
  assert.equal(eq.status, 200);
  assert.deepEqual(eq.eq, { title: "marksman", card: "", banner: "" });
  // the account carries it (the profile the game and the homepage read)
  const me = await h.api("me", { token: p.token });
  assert.deepEqual(me.user.cos, { own: ["marksman"], eq: { title: "marksman", card: "", banner: "" } });
  assert.deepEqual(h.user("player").cos, { own: ["marksman"], eq: { title: "marksman", card: "", banner: "" } });
  assert.deepEqual((await h.api("cos_equip", { token: p.token, slot: "title", id: "" })).eq.title, "");
  // the owner: prices and the switch
  const c = JSON.parse(JSON.stringify(h.config));
  c.cos.price[4] = 25000; c.cos.on = false;
  assert.equal((await h.api("a_config_set", { atoken: owner.atoken, config: c })).status, 200);
  h.advance(30000);
  assert.equal((await h.api("cos_buy", { token: p.token, id: "legend13" })).status, 403, "closed");
  const closed = await h.api("cos", { token: p.token });
  assert.equal(closed.on, false);
  assert.equal(closed.items.find((x) => x.id === "legend13").price, 25000);
  // a retired or unknown id in an account's record is dropped, never shown as owned
  const u = h.user("player");
  u.cos = { own: ["marksman", "gone"], eq: { title: "gone", card: "marksman", banner: "" } };
  h.db.set("user:player", JSON.stringify(u));
  assert.deepEqual((await h.api("me", { token: p.token })).user.cos, { own: ["marksman"], eq: { title: "", card: "", banner: "" } });
});

test("the feedback box: each kind is checked, rate limited and kept; the owner reads, marks and answers; the sender sees the answer", async () => {
  const h = harness(), p = await login(h), owner = await login(h, "owner"), other = await login(h, "second");
  const send = (b, who = p) => h.api("feedback_submit", Object.assign({ token: who.token }, b));
  // signed in only
  assert.equal((await h.api("feedback_submit", { type: "bug", text: "에러가 납니다 정말로" })).status, 401);
  // a kind, and words
  assert.equal((await send({ type: "nope", text: "내용이 충분히 깁니다" })).status, 400);
  assert.equal((await send({ type: "bug", text: "짧" })).status, 400);
  // a bug, with where it happened
  const bug = await send({ type: "bug", title: "상점이 안 열려요", text: "구매 단계에서 B를 눌러도 상점이 열리지 않습니다", bug: { where: "게임 중", steps: "1. 시작 2. B" }, ctx: { ua: "UA".repeat(200), view: "844x390", page: "play", mode: "std", map: "field" } });
  assert.equal(bug.status, 200);
  // an agent idea: a name and at least one ability
  assert.equal((await send({ type: "agent", text: "새 요원을 제안합니다 능력은 아래와 같아요", agent: { name: "", abilities: [{ name: "a", desc: "b" }] } })).status, 400, "a name");
  assert.equal((await send({ type: "agent", text: "새 요원을 제안합니다 능력은 아래와 같아요", agent: { name: "시계공", abilities: [] } })).status, 400, "an ability");
  const ag = await send({ type: "agent", text: "시간을 다루는 요원입니다", agent: { name: "시계공", role: "전략가", abilities: [{ name: "되감기", desc: "3초 전 위치로 돌아간다" }, { name: "정지", desc: "" }, { name: "", desc: "" }, { name: "가속", desc: "팀 이동 속도 증가" }, { name: "다섯째", desc: "버려짐" }] } });
  assert.equal(ag.status, 200);
  // a player report needs a name
  assert.equal((await send({ type: "report", text: "벽을 뚫고 쏘는 것 같습니다 의심됩니다", report: { target: "" } })).status, 400);
  assert.equal((await send({ type: "report", text: "벽을 뚫고 쏘는 것 같습니다 의심됩니다", report: { target: "의심자", reason: "cheat", room: "abc123" } }, other)).status, 200);
  // the same words twice are one
  assert.equal((await send({ type: "bug", title: "상점이 안 열려요", text: "구매 단계에서 B를 눌러도 상점이 열리지 않습니다" })).status, 409);
  // a brake: five an hour
  for (let i = 0; i < 2; i++) assert.equal((await send({ type: "idea", text: "개선 제안 번호 " + i + " 입니다 길게" })).status, 200);
  assert.equal((await send({ type: "ask", text: "문의 내용입니다 길게 적었어요" })).status, 429, "the sixth in an hour");
  h.advance(3600001);
  assert.equal((await send({ type: "ask", text: "문의 내용입니다 길게 적었어요" })).status, 200, "an hour later");

  // the owner's box: everything, newest first, with counts
  assert.equal((await h.api("a_feedback", { atoken: p.token })).status, 401, "not for players");
  const o2 = await login(h, "owner");
  const all = await h.api("a_feedback", { atoken: o2.atoken });
  assert.equal(all.status, 200);
  assert.equal(all.items.length, 6);
  assert.equal(all.counts.total, 6); assert.equal(all.counts.new, 6);
  assert.deepEqual(all.counts.byType, { bug: 1, agent: 1, report: 1, idea: 2, ask: 1 });
  assert.equal(all.items[0].type, "ask", "newest first");
  const b0 = all.items.find((x) => x.type === "bug");
  assert.equal(b0.by.id, "player"); assert.equal(b0.by.guest, false); assert.equal(b0.by.level, 1);
  assert.equal(b0.ctx.ua.length, 160, "the browser text is cut"); assert.equal(b0.bug.where, "게임 중");
  const a0 = all.items.find((x) => x.type === "agent");
  assert.deepEqual(a0.agent.abilities.map((x) => x.key + x.name), ["Q되감기", "E정지", "X가속"], "empty rows go, four at most, keys by position");
  assert.equal(a0.title, "요원 제안: 시계공", "an agent idea without a title is named by the agent");
  const r0 = all.items.find((x) => x.type === "report");
  assert.equal(r0.title, "신고: 의심자");
  assert.deepEqual(r0.report, { target: "의심자", reason: "cheat", room: "ABC123" });
  // filters
  assert.equal((await h.api("a_feedback", { atoken: o2.atoken, type: "idea" })).items.length, 2);
  assert.equal((await h.api("a_feedback", { atoken: o2.atoken, q: "시계공" })).items.length, 1);
  assert.equal((await h.api("a_feedback", { atoken: o2.atoken, status: "done" })).items.length, 0);
  // mark, note and answer
  assert.equal((await h.api("a_feedback_set", { atoken: o2.atoken, id: b0.id, status: "weird" })).status, 400);
  assert.equal((await h.api("a_feedback_set", { atoken: o2.atoken, id: "nothing", status: "done" })).status, 404);
  const set = await h.api("a_feedback_set", { atoken: o2.atoken, id: b0.id, status: "doing", note: "재현됨", reply: "확인했습니다. 곧 고칩니다" });
  assert.equal(set.status, 200); assert.equal(set.item.status, "doing"); assert.ok(set.item.replyT > 0);
  assert.equal((await h.api("a_feedback", { atoken: o2.atoken })).counts.new, 5);
  // the sender sees where it stands and the answer; not the note, not others' words
  const mine = await h.api("feedback_mine", { token: p.token });
  assert.equal(mine.status, 200);
  const mb = mine.items.find((x) => x.id === b0.id);
  assert.equal(mb.status, "doing"); assert.equal(mb.reply, "확인했습니다. 곧 고칩니다"); assert.equal(mb.note, undefined);
  assert.ok(mine.items.every((x) => x.id !== r0.id), "someone else's report is not mine");
  assert.equal((await h.api("feedback_mine", {})).status, 401);
  // a delete
  const del = await h.api("a_feedback_del", { atoken: o2.atoken, ids: [b0.id, a0.id] });
  assert.equal(del.status, 200); assert.equal(del.deleted, 2);
  assert.equal((await h.api("a_feedback", { atoken: o2.atoken })).items.length, 4);
  assert.ok(h.db.get("logs").some((l) => /feedback/.test(l) && /상점이 안 열려요/.test(l)), "logged");
});

test("the owner's notice: the announcement text and the promo-film switch (game.promoNotice, on by default) are saved, read by the homepage, and a missing key falls back to on", async () => {
  const h = harness(), owner = await login(h, "owner");
  const pub = async () => (await h.api("config", {})).config.game;
  assert.equal((await h.api("a_config_get", { atoken: owner.atoken })).defaults.game.promoNotice, true, "on by default");
  assert.equal((await pub()).promoNotice, true);
  assert.equal((await pub()).announcement, "");
  const set = (game) => { const c = JSON.parse(JSON.stringify(h.config)); Object.assign(c.game, game); return h.api("a_config_set", { atoken: owner.atoken, config: c }); };
  const off = await set({ promoNotice: false, announcement: "주말 이벤트" });
  assert.equal(off.status, 200); assert.equal(off.config.game.promoNotice, false);
  assert.deepEqual([(await pub()).promoNotice, (await pub()).announcement], [false, "주말 이벤트"], "the homepage reads both from the public settings");
  // settings saved before the key existed, and a value that is not a boolean
  const c = JSON.parse(JSON.stringify(h.config)); delete c.game.promoNotice;
  assert.equal((await h.api("a_config_set", { atoken: owner.atoken, config: c })).config.game.promoNotice, true, "a missing key is the default, on");
  assert.equal((await set({ promoNotice: "no" })).config.game.promoNotice, true, "a string is not a switch: the default stays");
  assert.equal((await set({ promoNotice: true })).config.game.promoNotice, true);
});

test("the feedback box takes reviews: an optional rating kept between 1 and 5, a guest may leave one, the owner sees them", async () => {
  const h = harness(), p = await login(h), owner = await login(h, "owner");
  const guest = await h.api("guest", { device: "device-review-guest" });
  const send = (b, who = p) => h.api("feedback_submit", Object.assign({ token: who.token }, b));
  const text = (n) => "영상 잘 봤습니다 후기 " + n + " 번째 입니다";
  assert.equal((await send({ type: "reviews", text: text(0) })).status, 400, "a kind that does not exist");
  assert.equal((await send({ type: "review", text: "짧" })).status, 400, "words are still needed");
  assert.equal((await send({ type: "review", title: "재밌어요", text: text(1), rating: 4 })).status, 200);
  assert.equal((await send({ type: "review", text: text(2), rating: 9 })).status, 200, "more than five is five");
  assert.equal((await send({ type: "review", text: text(3), rating: 2.6 })).status, 200, "rounded");
  assert.equal((await send({ type: "review", text: text(4), rating: "abc" })).status, 200, "not a number is no rating");
  assert.equal((await send({ type: "review", text: text(5) })).status, 200, "the rating is optional");
  assert.equal((await send({ type: "review", text: text(6), rating: -3 }, guest)).status, 200, "a guest may review; below one is no rating");
  assert.equal((await send({ type: "idea", text: text(7), rating: 5 }, guest)).status, 200);
  const o = await login(h, "owner");
  const all = await h.api("a_feedback", { atoken: o.atoken, type: "review" });
  assert.equal(all.status, 200);
  assert.equal(all.items.length, 6);
  assert.equal(all.types.review, "후기"); assert.equal(all.types.idea, "추가했으면 하는 점 (제안)");
  const by = (n) => all.items.find((x) => x.text === text(n));
  assert.equal(by(1).rating, 4); assert.equal(by(1).title, "재밌어요");
  assert.equal(by(2).rating, 5); assert.equal(by(3).rating, 3);
  for (const n of [4, 5, 6]) assert.equal("rating" in by(n), false, "no rating kept for " + n);
  assert.equal(by(6).by.guest, true);
  assert.equal(by(5).title, text(5).slice(0, 40), "no title: the first words");
  const idea = (await h.api("a_feedback", { atoken: o.atoken, type: "idea" })).items[0];
  assert.equal("rating" in idea, false, "only a review carries a rating");
  assert.equal((await h.api("a_feedback", { atoken: o.atoken })).counts.byType.review, 6);
  // the sender sees it in the list of mine
  assert.equal((await h.api("feedback_mine", { token: p.token })).items.filter((x) => x.type === "review").length, 5);
});

test("an account the owner makes an admin gets every cheat while it is one, and its own cheats come back after", async () => {
  const h = harness(), p = await login(h), ow = await login(h, "owner");
  assert.equal((await h.api("a_user_set", { atoken: ow.atoken, id: "player", op: "perm", perm: { on: true, radar: true }, days: 5 })).status, 200);
  h.advance(30000);
  // admin mode: only the owner can give it, and it brings every cheat (the invincibility too), ending with it
  const before = JSON.parse(JSON.stringify(h.user("player").perm));
  const t0 = h.now();
  assert.equal((await h.api("a_user_set", { atoken: ow.atoken, id: "player", op: "admin", days: 40 })).status, 200);
  const u = h.user("player");
  for (const k of ["radar", "wall", "cheat", "god", "oneShot", "infAmmo", "noRecoil"]) assert.equal(u.perm[k], true, k);
  assert.deepEqual([u.perm.on, u.perm.speed, u.perm.fastFire, u.perm.buff], [true, 3, 10, 10]);
  assert.ok(Math.abs(u.perm.until - (t0 + 40 * 864e5)) < 5000 && u.perm.until === u.adminUntil, "the cheats end with the admin mode");
  const me = (await h.api("me", { token: p.token })).user;
  assert.equal(me.admin, true); assert.equal(me.perm.god, true);
  // taken away: the cheats from before come back
  assert.equal((await h.api("a_user_set", { atoken: ow.atoken, id: "player", op: "admin", days: 0 })).status, 200);
  const back = h.user("player").perm;
  assert.deepEqual([back.on, back.radar, back.god], [before.on, before.radar, before.god]);
  assert.equal((await h.api("me", { token: p.token })).user.admin, false);
  // someone else cannot give it
  assert.equal((await h.api("a_user_set", { atoken: p.token, id: "player", op: "admin", days: 5 })).status, 401);
});

test("the owner can switch agents off: only known ids are kept (in roster order), enough must stay on and every role needs one, and the game reads it from the public settings", async () => {
  const h = harness(), owner = await login(h, "owner");
  const roster = require("../js/agent-roster.json");
  assert.equal(roster.length, new Set(roster.map((a) => a.id)).size, "ids are unique");
  const set = (ids) => { const c = JSON.parse(JSON.stringify(h.config)); c.game.disabledAgents = ids; return h.api("a_config_set", { atoken: owner.atoken, config: c }); };
  assert.equal((await h.api("a_config_get", { atoken: owner.atoken })).config.game.disabledAgents, "", "none off by default");
  // known ids are kept, in roster order; unknown ones and repeats drop out
  const [a, b, c3] = [roster[5].id, roster[2].id, roster[9].id];
  const r = await set(` ${a}, nobody ,${b},${a}\n${c3} `);
  assert.equal(r.status, 200);
  assert.equal(r.config.game.disabledAgents, roster.filter((x) => [a, b, c3].includes(x.id)).map((x) => x.id).join(","));
  h.advance(30000);
  assert.equal((await h.api("config", {})).config.game.disabledAgents, r.config.game.disabledAgents, "the game reads it from the public settings");
  // everything back on
  assert.equal((await set("")).config.game.disabledAgents, "");
  // too few left on, or a whole role gone
  assert.equal((await set(roster.slice(0, roster.length - 9).map((x) => x.id).join(","))).status, 400, "fewer than ten on");
  const role = roster[0].role;
  assert.equal((await set(roster.filter((x) => x.role === role).map((x) => x.id).join(","))).status, 400, "a whole role off");
  // only the owner
  assert.equal((await h.api("a_config_set", { atoken: "nope", config: h.config })).status, 401);
});
test("a name already taken cannot be signed up again, in any case, and says why", async () => {
  const h = harness();
  assert.equal((await h.api("auth", { id: "철수", pw: "password", device: "device-a1" })).created, true);
  for (const id of ["철수", " 철수 "]) {
    const again = await h.api("auth", { id, pw: "other-password", device: "device-b1" });
    assert.equal(again.status, 401);
    assert.match(again.error, /이미 있는 아이디/);
  }
  assert.equal((await h.api("auth", { id: "Alpha", pw: "password", device: "device-a2" })).created, true);
  const upper = await h.api("auth", { id: "ALPHA", pw: "different", device: "device-b2" });
  assert.equal(upper.status, 401);
  // the owner of the name still signs in
  const back = await h.api("auth", { id: "alpha", pw: "password", device: "device-a2" });
  assert.equal(back.status, 200);
  assert.equal(back.created, false);
  assert.equal(back.user.id, "Alpha");
});
test("new accounts cannot take guest or nameless-player names", async () => {
  const h = harness();
  for (const id of ["게스트1234", "Guest77", "플레이어555", "player9"]) {
    const r = await h.api("auth", { id, pw: "password", device: "device-reserved" });
    assert.equal(r.status, 400, id);
    assert.match(r.error, /쓸 수 없습니다/);
  }
});
test("two devices never share a guest name, and a device keeps its own", async () => {
  const h = harness(), names = new Set();
  for (let i = 0; i < 40; i++) {
    const g = await h.api("guest", { device: "guest-device-" + i });
    assert.equal(g.status, 200);
    assert.ok(!names.has(g.user.id), "repeated " + g.user.id);
    names.add(g.user.id);
  }
  const first = (await h.api("guest", { device: "guest-device-0" })).user.id;
  assert.equal((await h.api("guest", { device: "guest-device-0" })).user.id, first);
  assert.ok(names.has(first));
});

test("the per-account log: sign-ins, pulls and the owner's changes land in the account's own list, with no secrets", async () => {
  const h = harness(), owner = await login(h, "owner"), p = await login(h);
  const lines = (id) => (h.db.get("ulog:" + id) || []).map((x) => JSON.parse(x));
  assert.equal(lines("player").length, 1);
  assert.equal(lines("player")[0].k, "join");
  assert.equal(lines("player")[0].d.ip, "127.0.0.1");
  assert.equal(lines("player")[0].d.dev, "device-123");
  // a wrong password is a line on the account it was tried on
  assert.equal((await h.api("auth", { id: "player", pw: "wrong-password", device: "device-evil" })).status, 401);
  assert.equal(lines("player")[0].k, "loginfail");
  assert.ok(!JSON.stringify(lines("player")).includes("wrong-password"));
  await h.api("a_user_set", { atoken: owner.atoken, id: "player", op: "gold", gold: 5000 });
  const g = await h.api("gacha", { token: p.token, n: 10 });
  assert.equal(g.status, 200);
  const gl = lines("player")[0];
  assert.equal(gl.k, "gacha"); assert.equal(gl.d.n, 10); assert.equal(gl.d.dg, -g.cost); assert.equal(gl.d.res.length, 10);
  assert.deepEqual(gl.d.res.map((r) => r[1]), g.results.map((r) => r.s));
  await h.api("a_user_set", { atoken: owner.atoken, id: "player", op: "ban", days: 2, reason: "test" });
  await h.api("a_user_set", { atoken: owner.atoken, id: "player", op: "password", pw: "brand-new-secret" });
  const text = JSON.stringify(lines("player"));
  assert.match(text, /차단 2일/); assert.match(text, /비밀번호 변경/);
  for (const secret of ["brand-new-secret", "owner-password", "test-secret", p.token, h.user("player").pass]) assert.ok(!text.includes(secret), "log leaks " + secret.slice(0, 6));
  assert.ok(h.db.get("ulog:player").every((x) => x.length < 900), "every line stays small");
});

test("ADMIN.user_profile: one call with the account, its log newest first and totals; no secrets; players are refused", async () => {
  const h = harness(), owner = await login(h, "owner"), p = await login(h);
  await h.api("a_user_set", { atoken: owner.atoken, id: "player", op: "gold", gold: 90000 });
  await h.api("a_user_set", { atoken: owner.atoken, id: "player", op: "grant", item: "rifle|dragon" });
  h.advance(1000);
  assert.equal((await h.api("gacha", { token: p.token, n: 10 })).status, 200);
  h.advance(1000);
  assert.equal((await h.api("gacha", { token: p.token, n: 1 })).status, 200);
  await login(h);
  const shop = await h.api("shop", { token: p.token }), item = shop.items.find((x) => !x.own);
  assert.equal((await h.api("shop_buy", { token: p.token, g: item.g, s: item.s, day: shop.day })).status, 200);
  assert.equal((await h.api("wish", { token: p.token, item: "rifle|dragon" })).status, 200);
  assert.equal((await h.api("skins", { token: p.token, t: h.now(), set: { rifle: "dragon" } })).status, 200);
  assert.equal((await h.api("feedback_submit", { token: p.token, type: "ask", text: "how do I get more gold?" })).status, 200);
  // not an admin: the player's own token, no token, and a made-up one are all refused
  for (const atoken of [p.token, "", h.sign({ k: "admin", exp: h.now() + 1e5 })]) assert.equal((await h.api("a_user_profile", { atoken, id: "player" })).status, 401);
  const r = await h.api("a_user_profile", { atoken: owner.atoken, id: "Player" });
  assert.equal(r.status, 200);
  const pr = r.profile, kinds = pr.log.map((e) => e.k);
  assert.equal(pr.acct.id, "player");
  assert.ok(pr.log.every((e, i) => !i || pr.log[i - 1].t >= e.t), "newest first");
  for (const k of ["join", "login", "gacha", "shop", "wish", "equip", "feedback", "admin"]) assert.ok(kinds.includes(k), "missing " + k);
  assert.equal(pr.agg.logins, 2); assert.equal(pr.agg.gacha.pulls, 11); assert.equal(pr.agg.gacha.times, 2);
  assert.equal(Object.values(pr.agg.gacha.byRarity).reduce((a, v) => a + v, 0), 11);
  assert.ok(pr.agg.gold.spent >= 2700 + 300 + item.price, "gold spent: " + pr.agg.gold.spent);
  assert.equal(pr.agg.ips[0].v, "127.0.0.1"); assert.equal(pr.agg.ips[0].n, 2); assert.equal(pr.agg.devs[0].v, "device-123");
  assert.equal(pr.acct.pulls, 11); assert.equal(pr.acct.gold, h.user("player").gold);
  assert.equal(pr.acct.owned.total, 13); assert.equal(pr.acct.equipped.rifle, "dragon"); assert.deepEqual(pr.acct.wish, ["rifle|dragon"]);
  assert.equal(pr.feedback.length, 1);
  for (const k of ["rank", "ai", "season", "seasonLog", "rrDay"]) assert.equal(k in pr.acct, false, "no " + k);
  assert.ok(pr.acct.missions.list.length > 0);
  const text = JSON.stringify(r);
  for (const secret of ['"pass"', "sessionVersion", h.user("player").pass, h.user("player").sessionVersion, p.token, "owner-password", "test-secret"]) assert.ok(!text.includes(secret), "profile leaks " + String(secret).slice(0, 8));
  // a name with no account, guest or log is a 404; a guest is found by its name
  assert.equal((await h.api("a_user_profile", { atoken: owner.atoken, id: "ghost1" })).status, 404);
  const guest = await h.api("guest", { device: "guest-device-77" });
  const gp = await h.api("a_user_profile", { atoken: owner.atoken, id: guest.user.id });
  assert.equal(gp.status, 200); assert.equal(gp.profile.acct.guest, true); assert.equal(gp.profile.log[0].k, "guest");
});

test("ADMIN.user_profile: before the log began it falls back on the server log, the match record and the sign-up", async () => {
  const h = harness(), owner = await login(h, "owner");
  await login(h);
  // an account from before the per-account log: no list of its own, only the server log line and a match on the record
  h.db.delete("ulog:player");
  const u = h.user("player");
  u.hist = [{ t: h.now() - 5000, win: true, k: 7, mode: "std", map: "harbor", xp: 50, gold: 100 }];
  h.db.set("user:player", JSON.stringify(u));
  const pr = (await h.api("a_user_profile", { atoken: owner.atoken, id: "player" })).profile;
  assert.equal(pr.since, 0);
  const by = (s) => pr.log.filter((e) => e.s === s).map((e) => e.k);
  assert.deepEqual(by("g"), ["join"]);
  assert.deepEqual(by("h"), ["match"]);
  // once a line exists, older server-log lines are shown only when they predate it
  h.advance(10000);
  await login(h);
  const pr2 = (await h.api("a_user_profile", { atoken: owner.atoken, id: "player" })).profile;
  assert.ok(pr2.since > 0);
  assert.equal(pr2.log[0].s, "u");
  assert.equal(pr2.log.filter((e) => e.s === "g" && e.k === "login").length, 0);
  assert.ok(pr2.log.some((e) => e.s === "h" && e.k === "match"));
});

test("levels: the host reads each player's level from the server; public fields only, guests and unknown names read as null", async () => {
  const h = harness(), ids = ["player", "bobby", "carol"], tok = await squad(h, ids), o = await login(h, "owner");
  assert.equal((await h.api("a_user_set", { atoken: o.atoken, id: "player", op: "level", level: 30 })).status, 200);
  assert.equal((await h.api("a_user_set", { atoken: o.atoken, id: "bobby", op: "level", level: 1 })).status, 200);
  // bobby still carries a rank from before ranked play was removed: it never leaves the server
  const u = h.user("bobby"); Object.assign(u, { rr: 700, mmr: 1700, placed: 5 }); h.db.set("user:bobby", JSON.stringify(u));
  const guest = await h.api("guest", { device: "guest-device-lv" });
  const r = await h.api("levels", { ids: ["Player", "bobby", "carol", "NoSuchOne", "플레이어123", "x", "bad id!", guest.user.id] });
  assert.equal(r.status, 200);
  assert.equal(r.users.Player.level, 30);
  assert.deepEqual(r.users.bobby, { level: 1 });
  assert.deepEqual(r.users.carol, { level: 1 });
  const none = { level: null };
  for (const id of ["NoSuchOne", "플레이어123", "x", "bad id!", guest.user.id]) assert.deepEqual(r.users[id], none, id + " reads as nothing");
  // only these fields leave the server
  for (const v of Object.values(r.users)) assert.deepEqual(Object.keys(v), ["level"]);
  assert.ok(!/mmr|rr|pass|token|email|dev|ip|ban|gold|xp|tier|placed/i.test(JSON.stringify(Object.values(r.users))), "no private data");
  assert.deepEqual(Object.keys(r).sort(), ["ok", "status", "users"]);
  // a banned account's level is still just its level; a changed account level is read live
  assert.equal((await h.api("a_user_set", { atoken: o.atoken, id: "player", op: "level", level: 31 })).status, 200);
  assert.equal((await h.api("levels", { ids: ["player"] })).users.player.level, 31);
});

test("levels: at most 12 ids, bad bodies are empty, duplicates collapse, a guest cannot be told apart from an unknown name", async () => {
  const h = harness();
  await squad(h, ["player", "bobby"]);
  const many = Array.from({ length: 20 }, (_, i) => "name" + String(i).padStart(2, "0"));
  assert.equal(Object.keys((await h.api("levels", { ids: many })).users).length, 12);
  assert.deepEqual(Object.keys((await h.api("levels", { ids: ["player", "player", "player"] })).users), ["player"], "the same id twice is one row");
  for (const body of [{}, { ids: "player" }, { ids: null }, { ids: [] }, { ids: [null, 7, {}, "", "  "] }]) {
    const r = await h.api("levels", body);
    assert.equal(r.status, 200);
    assert.ok(Object.keys(r.users).every((k) => ["7", "[object Object]"].includes(k)), JSON.stringify(body) + " " + JSON.stringify(r.users));
  }
  // an id that would be a prototype key is just another unknown name
  const r = await h.api("levels", { ids: ["__proto__", "constructor"] });
  assert.equal(r.status, 200); assert.equal(Object.keys(r.users).length, 2);
  assert.equal(r.users.constructor.level, null);
});

test("levels: a public read with its own rate limit per address", async () => {
  const h = harness();
  await squad(h, ["player"]);
  let last;
  for (let i = 0; i < 120; i++) last = await h.api("levels", { ids: ["player"] });
  assert.equal(last.status, 200);
  const over = await h.api("levels", { ids: ["player"] });
  assert.equal(over.status, 429);
  // other public reads are not touched, and the window ends
  assert.equal((await h.api("board", { kind: "kills" })).status, 200);
  h.advance(61000);
  assert.equal((await h.api("levels", { ids: ["player"] })).status, 200);
});
