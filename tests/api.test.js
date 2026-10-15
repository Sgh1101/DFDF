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
  assert.equal(j.items, 816);
});
