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
