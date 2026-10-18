const test = require("node:test");
const assert = require("node:assert/strict");
const { harness } = require("./api-harness");
const login = (h, id = "player") => h.api("auth", { id, pw: id === "owner" ? "owner-password" : "password", device: "device-123" });

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
  assert.equal(h.user("player").gold, 420);
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
  assert.equal(replay.gold, original.gold); assert.equal(replay.user.gold, 100);
  assert.equal(replay.user.owned, 2); assert.equal(replay.hist.length, 1);
});

test("draws do not subtract RR", async () => {
  const h = harness(), p = await login(h), admin = await login(h, "owner");
  await h.api("a_user_set", { atoken: admin.atoken, id: "player", op: "rr", rr: 200 });
  const mt = await h.api("match_start", { token: p.token }); h.advance(61000);
  const r = await h.api("progress", { token: p.token, mt: mt.ticket, outcome: "draw", match: { mode: "tdm", s: [10, 10] } });
  assert.equal(r.status, 200); assert.equal(r.rr, 0); assert.equal(r.user.rank.rr, 200);
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

test("RR moves only in a ranked room, with enough people; the owner's powers stay out of it", async () => {
  const h = harness(), p = await login(h), owner = await login(h, "owner");
  const rr = () => h.user("player").rr || 0;
  const play = async (opts, report) => {
    const mt = await h.api("match_start", { token: p.token, ...opts });
    assert.equal(mt.status, 200);
    h.advance(61000);
    return h.api("progress", { token: p.token, mt: mt.ticket, kills: 3, win: true, match: { mode: "std", s: [7, 3] }, ...report });
  };
  // a normal room: XP and gold, but the rank stays
  assert.equal((await play({}, { humans: 8 })).status, 200);
  assert.equal(rr(), 0);
  // a ranked ticket needs a ranked room that exists
  assert.equal((await h.api("match_start", { token: p.token, ranked: true, room: "RNK001" })).status, 409);
  assert.equal((await h.api("room_up", { token: p.token, code: "RNK001", ranked: true, players: ["player"] })).status, 200);
  const listed = await h.api("rooms", {});
  assert.equal((listed.rooms || []).every((r) => r.ranked === !!r.ranked), true);
  // the owner's powers: no ticket for a ranked room, no room commands
  assert.equal((await h.api("owner_ticket", { token: owner.token, room: "RNK001", p: "peer-1" })).ticket, null);
  assert.equal((await h.api("perm_ticket", { token: p.token, room: "RNK001" })).ticket, null);
  // too few real people: counted as a match, no RR
  assert.equal((await play({ ranked: true, room: "RNK001" }, { humans: 2 })).status, 200);
  assert.equal(rr(), 0);
  // enough people: RR moves
  const ok = await play({ ranked: true, room: "RNK001" }, { humans: 6 });
  assert.equal(ok.status, 200);
  assert.equal(ok.ranked, true); assert.equal(ok.rankedCounted, true);
  assert.ok(rr() > 0, "a ranked win raises RR");
  // a ticket for a normal match cannot be used as a ranked one
  const hist = h.user("player").hist;
  assert.equal(hist[0].rk, 1); assert.equal(hist[2].rk, undefined);
});

test("a guest cannot open or play a ranked room", async () => {
  const h = harness(), g = await h.api("guest", { device: "guest-device-1" });
  assert.equal(g.status, 200);
  const up = await h.api("room_up", { token: g.token, code: "GST001", ranked: true, players: [] });
  assert.equal(up.status, 200);
  assert.equal((await h.api("match_start", { token: g.token, ranked: true, room: "GST001" })).status, 403);
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

test("the owner's dashboard summary counts accounts, grants, ranks and the day's log", async () => {
  const h = harness(), player = await login(h), owner = await login(h, "owner");
  await h.api("a_user_set", { atoken: owner.atoken, id: "player", op: "aim", pc: true });
  await h.api("a_user_set", { atoken: owner.atoken, id: "player", op: "rr", rr: 950 });
  await h.api("a_user_set", { atoken: owner.atoken, id: "player", op: "gold", gold: 1234 });
  assert.equal((await h.api("a_summary", { atoken: player.token })).status, 401);
  const j = await h.api("a_summary", { atoken: owner.atoken });
  assert.equal(j.status, 200);
  const s = j.summary;
  assert.equal(s.scanned, 2); assert.equal(s.aimPc, 1); assert.equal(s.new1, 2);
  assert.ok(s.gold >= 1234);
  assert.equal(s.ranks[3], 1, "a gold rank at 950 RR");
  assert.equal(s.topRR[0].id, "player");
  assert.equal(s.signups[13], 2, "both signed up today");
  assert.ok(j.logs.login + j.logs.join >= 1);
  assert.ok(j.recent.some((r) => /aim/.test(r.msg)));
  assert.deepEqual(j.config.aim, { mobile: true, pc: true, strength: 35, range: 45, cone: 8, ranked: true });
  assert.equal(j.items, 607);
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

test("seasons: the end of one pays by tier, gives the season skin from gold up, keeps half the RR", async () => {
  const h = harness({ now: Date.parse("2026-10-20T03:00:00Z") }), p = await login(h), owner = await login(h, "owner");
  const me = async () => (await h.api("me", { token: p.token })).user;
  let u = await me();
  assert.deepEqual([u.season.n, u.season.played, u.season.last], [1, 0, null]);
  assert.equal(u.season.end, Date.parse("2026-10-28T15:00:00Z"), "four weeks from 1 October, midnight in Korea");
  // a season played: three counted ranked matches, finished at 1000 RR (gold 2)
  assert.equal((await h.api("room_up", { token: p.token, code: "SSN001", ranked: true, players: ["player"] })).status, 200);
  for (let i = 0; i < 3; i++) {
    const mt = await h.api("match_start", { token: p.token, ranked: true, room: "SSN001" });
    h.advance(61000);
    assert.equal((await h.api("progress", { token: p.token, mt: mt.ticket, kills: 2, win: true, humans: 6, match: { mode: "std", s: [7, 3] } })).rankedCounted, true);
  }
  assert.equal((await me()).season.played, 3);
  await h.api("a_user_set", { atoken: owner.atoken, id: "player", op: "rr", rr: 1000 });
  const gold0 = h.user("player").gold;
  // the season ends: the reward, the season skin on every gun, half the RR
  h.advance(9 * 864e5);
  u = await me();
  assert.deepEqual([u.season.n, u.season.played], [2, 0]);
  const L = u.season.last;
  assert.deepEqual([L.n, L.tier, L.div, L.played, L.gold, L.skin, L.rr, L.after], [1, "gold", 2, 3, 700, 19, 1000, 500]);
  assert.equal(h.user("player").gold, gold0 + 700);
  assert.equal(h.user("player").rr, 500);
  assert.ok(Object.values(h.user("player").own).every((list) => list.includes("laurel")));
  // seen again: nothing twice
  await me();
  assert.equal(h.user("player").gold, gold0 + 700);
  assert.equal(h.user("player").ssnLog.length, 1);
  // the season skin: no pull, shop or wishlist gives it; the catalogue lists it
  assert.equal((await h.api("wish", { token: p.token, item: "rifle|laurel" })).status, 400);
  assert.ok((await h.api("shop", {})).items.every((x) => x.s !== "laurel"));
  const cat = await h.api("catalog", {});
  assert.equal(cat.tiers.laurel, 4); assert.equal(cat.items, 607);
  // the owner ends the season now: a new one from today; not played, so no reward, the cut still
  const c = JSON.parse(JSON.stringify(h.config));
  c.season.startDay = 20261029; c.season.skip = 2;
  const owner2 = await login(h, "owner");
  assert.equal((await h.api("a_config_set", { atoken: owner2.atoken, config: c })).status, 200);
  h.advance(30000);
  u = await me();
  assert.equal(u.season.n, 3);
  assert.deepEqual([u.season.last.n, u.season.last.gold, u.season.last.after], [2, 0, 250]);
  assert.equal(h.user("player").gold, gold0 + 700);
  // a bad setting is refused
  c.season.weeks = 0;
  assert.equal((await h.api("a_config_set", { atoken: owner2.atoken, config: c })).status, 400);
  // the dashboard shows the season and what RR people will have
  const s = (await h.api("a_summary", { atoken: owner2.atoken })).summary;
  assert.equal(s.season.n, 3);
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

test("paid cheats by bank transfer: an order with a code and the account to pay; the owner opens it, it merges into the account's cheats; reject, refund, cancel", async () => {
  const h = harness(), p = await login(h), owner = await login(h, "owner"), other = await login(h, "second");
  const guest = await h.api("guest", { device: "device-guest-1" });
  const order = (b, who = p) => h.api("order_create", Object.assign({ token: who.token }, b));
  // closed until the owner opens it; nothing about the bank before then
  const info0 = await h.api("order_info", {});
  assert.equal(info0.on, false);
  assert.equal(info0.items.length, 10);
  assert.equal(info0.items.find((x) => x.k === "wall").price, 5000);
  assert.equal(JSON.stringify(info0).includes("bank"), false);
  assert.equal((await order({ items: ["radar"], days: 7 })).status, 403, "closed");
  assert.equal((await h.api("config", {})).config.order.on, false);
  // the owner opens it and names the account
  const c = JSON.parse(JSON.stringify(h.config));
  c.order.on = true; c.order.bank = "국민 000000-00-000000"; c.order.holder = "홍길동";
  assert.equal((await h.api("a_config_set", { atoken: owner.atoken, config: c })).status, 200);
  h.advance(30000);
  assert.equal((await h.api("config", {})).config.order.on, true);
  assert.equal(JSON.stringify((await h.api("config", {})).config).includes("000000"), false, "the account is not in the public settings");
  // who and what
  assert.equal((await order({ items: ["radar"], days: 7 }, guest)).status, 403, "a guest cannot");
  assert.equal((await h.api("order_create", { items: ["radar"], days: 7 })).status, 401);
  assert.equal((await order({ items: [], days: 7 })).status, 400);
  assert.equal((await order({ items: ["nothing"], days: 7 })).status, 400);
  assert.equal((await order({ items: ["radar"], days: 5 })).status, 400);
  // prices: per 7 days, times the length
  const pay = async (days, items = ["radar", "wall"]) => (await order({ items, days, depositor: "홍철수" })).order.total;
  assert.equal(await pay(7), 8000);
  const o30 = await order({ items: ["radar", "wall"], days: 30 }); assert.equal(o30.order.total, 24000);
  const o1 = await order({ items: ["radar", "wall"], days: 1 }); assert.equal(o1.order.total, 2400);
  assert.equal(o1.pay.bank, "국민 000000-00-000000"); assert.equal(o1.pay.holder, "홍길동");
  assert.match(o30.order.id, /^[A-Z2-9]{6}$/);
  assert.equal((await order({ items: ["radar"], days: 0 })).status, 409, "three waiting at most");
  // mine: the account shows only while something waits
  let mine = await h.api("order_mine", { token: p.token });
  assert.equal(mine.orders.length, 3); assert.equal(mine.pay.bank, "국민 000000-00-000000");
  // cancel: only my own, only waiting
  assert.equal((await h.api("order_cancel", { token: other.token, id: o1.order.id })).status, 403);
  assert.equal((await h.api("order_cancel", { token: p.token, id: o1.order.id })).status, 200);
  assert.equal((await h.api("order_cancel", { token: p.token, id: o1.order.id })).status, 409);
  // the owner: the list, then open one
  assert.equal((await h.api("a_orders", { atoken: p.token })).status, 401);
  const ow = await login(h, "owner");
  const list = await h.api("a_orders", { atoken: ow.atoken });
  assert.equal(list.orders.length, 3); assert.equal(list.counts.pending, 2); assert.equal(list.names.wall, "벽 투시");
  const first = list.orders.find((x) => x.days === 7);
  const t0 = h.now();
  const g = await h.api("a_order_set", { atoken: ow.atoken, id: first.id, op: "grant", note: "입금 확인 10:02" });
  assert.equal(g.status, 200); assert.equal(g.order.status, "granted");
  const perm = h.user("player").perm;
  assert.equal(perm.on, true); assert.equal(perm.radar, true); assert.equal(perm.wall, true); assert.equal(perm.god, false);
  assert.ok(Math.abs(perm.until - (t0 + 7 * 864e5)) < 5000, "seven days from now");
  assert.equal((await h.api("me", { token: p.token })).user.perm.radar, true, "the game sees it");
  assert.equal((await h.api("a_order_set", { atoken: ow.atoken, id: first.id, op: "grant" })).status, 409, "once");
  // a second order adds its length and its cheats (speed, buff are level values)
  const o2 = await order({ items: ["god", "speed", "buff"], days: 30 });
  assert.equal(o2.status, 200);
  await h.api("a_order_set", { atoken: ow.atoken, id: o2.order.id, op: "grant" });
  const perm2 = h.user("player").perm;
  assert.deepEqual([perm2.radar, perm2.wall, perm2.god, perm2.speed, perm2.buff], [true, true, true, 1.5, 10]);
  assert.ok(Math.abs(perm2.until - (perm.until + 30 * 864e5)) < 5000, "added to what was running");
  // reject, refund with the cheats taken back
  const rej = await h.api("a_order_set", { atoken: ow.atoken, id: o30.order.id, op: "reject", reason: "입금 없음" });
  assert.equal(rej.order.status, "rejected");
  assert.equal((await h.api("a_order_set", { atoken: ow.atoken, id: o30.order.id, op: "grant" })).status, 409, "no opening a rejected one");
  const ref = await h.api("a_order_set", { atoken: ow.atoken, id: o2.order.id, op: "refund", revoke: true, reason: "환불" });
  assert.equal(ref.order.status, "refunded");
  assert.equal(h.user("player").perm.on, false, "taken back");
  mine = await h.api("order_mine", { token: p.token });
  assert.deepEqual(mine.orders.map((x) => x.status).sort(), ["cancelled", "granted", "refunded", "rejected"].sort());
  assert.equal(mine.pay, null, "nothing waits: no account shown");
  assert.equal((await h.api("a_order_set", { atoken: ow.atoken, id: "NOPE", op: "grant" })).status, 404);
  assert.ok(h.db.get("logs").some((l) => /주문/.test(l) && /열어 줌/.test(l)));
  // a permanent one
  const op = await order({ items: ["noRecoil"], days: 0 });
  assert.equal(op.order.total, 20000);
  await h.api("a_order_set", { atoken: ow.atoken, id: op.order.id, op: "grant" });
  assert.equal(h.user("player").perm.until, 0, "permanent");
});
