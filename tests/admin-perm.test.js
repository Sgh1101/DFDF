const test = require("node:test");
const assert = require("node:assert/strict");
const { harness } = require("./api-harness");
const login = (h, id) => h.api("auth", { id, pw: id === "owner" ? "owner-password" : "password", device: "device-" + id });
const DAY = 864e5;
const FULL = ["radar", "wall", "cheat", "god", "oneShot", "infAmmo", "noRecoil"];

// What the host of a room is told about a guest's account (perm_ticket, then perm_check).
const seenByHost = async (h, token, room = "ROOM01", p = "guest-1") => {
  const t = await h.api("perm_ticket", { token, room, p });
  return t.ticket ? (await h.api("perm_check", { ticket: t.ticket, room, p })).perm : null;
};

test("admin mode lends every cheat only while it lasts: the account's own cheats come back when it runs out", async () => {
  const h = harness(), owner = await login(h, "owner"), p = await login(h, "bobby");
  const A = owner.atoken;
  await h.api("a_user_set", { atoken: A, id: "bobby", op: "perm", perm: { on: true, radar: true }, days: 30 });
  await h.api("a_user_set", { atoken: A, id: "bobby", op: "admin", days: 1 });
  let perm = await seenByHost(h, p.token);
  for (const k of FULL) assert.equal(perm[k], true, k + " while admin");
  assert.equal(perm.speed, 3);
  h.advance(2 * DAY);
  assert.equal((await h.api("me", { token: p.token })).user.admin, false, "the admin mode is over");
  perm = await seenByHost(h, p.token);
  assert.equal(perm.radar, true, "its own radar stays");
  for (const k of FULL.filter((k) => k !== "radar")) assert.equal(perm[k], false, k + " was only lent");
  assert.equal(perm.speed, 1);
  assert.equal(perm.fastFire, 1);
  assert.equal((await h.api("me", { token: p.token })).user.perm.god, false);
  // an account with no cheats of its own has none left
  const q = await login(h, "carol"), A2 = (await login(h, "owner")).atoken; // the owner's admin sign-in lasts 12 hours
  await h.api("a_user_set", { atoken: A2, id: "carol", op: "admin", days: 1 });
  assert.ok(await seenByHost(h, q.token), "cheats while admin");
  h.advance(2 * DAY);
  assert.equal(await seenByHost(h, q.token), null);
  assert.equal((await h.api("me", { token: q.token })).user.perm, null);
});

// A perm left by the old paid sales: the same shape, but nobody stamped it as the owner's grant.
const legacyPerm = (h, id, extra) => h.db.set("user:" + id, JSON.stringify({ ...h.user(id), perm: { on: true, radar: true, wall: true, cheat: false, god: false, oneShot: false, infAmmo: false, noRecoil: false, speed: 1.5, fastFire: 1, buff: 0, until: 0, ...extra } }));

test("cheats the owner grants from the admin page are stamped and work", async () => {
  const h = harness(), owner = await login(h, "owner"), p = await login(h, "bobby");
  assert.equal((await h.api("a_user_set", { atoken: owner.atoken, id: "bobby", op: "perm", perm: { on: true, radar: true, speed: 1.5 }, days: 30 })).status, 200);
  assert.equal(h.user("bobby").perm.src, "admin", "the grant carries the stamp");
  const perm = await seenByHost(h, p.token);
  assert.equal(perm.radar, true);
  assert.equal(perm.speed, 1.5);
  assert.equal((await h.api("me", { token: p.token })).user.perm.radar, true);
});

test("cheats with no admin stamp (the old purchases) are off, but stay stored", async () => {
  const h = harness(), owner = await login(h, "owner"), p = await login(h, "bobby");
  legacyPerm(h, "bobby");
  assert.equal(await seenByHost(h, p.token), null, "the host is told nothing");
  const me = (await h.api("me", { token: p.token })).user;
  assert.equal(me.perm, null);
  assert.equal(h.user("bobby").perm.radar, true, "the stored data is untouched");
  const row = await h.api("a_user_profile", { atoken: owner.atoken, id: "bobby" });
  assert.equal(row.status, 200);
  assert.equal(row.profile.acct.permActive, false);
  assert.equal(row.profile.acct.permLegacy, true, "the owner page can say why");
  // a perm that never had the stamp stays off however it is dated
  legacyPerm(h, "bobby", { until: h.now() + 30 * DAY });
  assert.equal(await seenByHost(h, p.token), null);
});

test("saving the permission again from the admin page turns the old cheats back on", async () => {
  const h = harness(), owner = await login(h, "owner"), p = await login(h, "bobby");
  legacyPerm(h, "bobby");
  assert.equal(await seenByHost(h, p.token), null);
  assert.equal((await h.api("a_user_set", { atoken: owner.atoken, id: "bobby", op: "perm", perm: h.user("bobby").perm, days: 0 })).status, 200);
  assert.equal(h.user("bobby").perm.src, "admin");
  const perm = await seenByHost(h, p.token);
  assert.ok(perm && perm.radar && perm.wall && perm.speed === 1.5, "the saved cheats work again");
});

test("admin mode lends its full set to an account with old cheats and gives the old data back untouched", async () => {
  const h = harness(), owner = await login(h, "owner"), p = await login(h, "bobby");
  legacyPerm(h, "bobby");
  const old = JSON.parse(JSON.stringify(h.user("bobby").perm));
  await h.api("a_user_set", { atoken: owner.atoken, id: "bobby", op: "admin", days: 1 });
  const lent = await seenByHost(h, p.token);
  for (const k of FULL) assert.equal(lent[k], true, k + " while admin");
  h.advance(2 * DAY);
  assert.equal(await seenByHost(h, p.token), null, "the old cheats stay off after admin mode");
  // the owner page reads the account back (the revert is applied as the account is read)
  const acct = (await h.api("a_user_profile", { atoken: (await login(h, "owner")).atoken, id: "bobby" })).profile.acct;
  assert.deepEqual(acct.perm, old, "and were kept as they were");
  assert.equal(acct.permActive, false);
});

test("cheats the owner page sets during admin mode are the account's own: they stay when admin mode ends", async () => {
  const h = harness(), owner = await login(h, "owner"), p = await login(h, "bobby");
  const A = owner.atoken;
  await h.api("a_user_set", { atoken: A, id: "bobby", op: "admin", days: 1 });
  await h.api("a_user_set", { atoken: A, id: "bobby", op: "perm", perm: { on: true, wall: true }, days: 20 });
  assert.equal((await seenByHost(h, p.token)).god, true, "still the full set while admin");
  h.advance(2 * DAY);
  const perm = await seenByHost(h, p.token);
  assert.equal(perm.wall, true);
  assert.equal(perm.god, false);
  assert.ok(Math.abs(perm.until - (h.now() - 2 * DAY + 20 * DAY)) < 5000);
});

test("a cheat ticket is for the peer that asked: another guest, an old client or a missing peer gets nothing", async () => {
  const h = harness(), owner = await login(h, "owner"), p = await login(h, "bobby");
  await h.api("a_user_set", { atoken: owner.atoken, id: "bobby", op: "perm", perm: { on: true, radar: true }, days: 30 });
  const t = await h.api("perm_ticket", { token: p.token, room: "ROOM01", p: "guest-1" });
  assert.equal(typeof t.ticket, "string");
  assert.equal((await h.api("perm_check", { ticket: t.ticket, room: "ROOM01", p: "guest-1" })).perm.radar, true);
  // the same ticket shown by another guest, with no peer, or in another room
  for (const body of [{ p: "guest-2" }, {}, { p: "" }, { p: ["guest-1"] }, { p: "guest-1", room: "ROOM02" }]) {
    const j = await h.api("perm_check", { ticket: t.ticket, room: "ROOM01", ...body });
    assert.deepEqual([j.perm, j.id], [null, null], JSON.stringify(body));
  }
  // an old client sends no peer: no ticket, and no error
  const old = await h.api("perm_ticket", { token: p.token, room: "ROOM01" });
  assert.equal(old.status, 200);
  assert.equal(old.ticket, null);
  assert.equal((await h.api("perm_ticket", { token: p.token, room: "ROOM01", p: "bad peer!" })).ticket, null);
  // a ticket signed without a peer (issued before this check) is refused too
  const legacy = h.sign({ k: "perm", id: "bobby", room: "ROOM01", exp: h.now() + 36e5 });
  assert.equal((await h.api("perm_check", { ticket: legacy, room: "ROOM01", p: "guest-1" })).perm, null);
  assert.equal((await h.api("perm_check", { ticket: legacy, room: "ROOM01" })).perm, null);
  // a ranked room still hands out nothing
  assert.equal((await h.api("room_up", { token: p.token, code: "RNK001", ranked: true, players: ["bobby"] })).status, 200);
  assert.equal((await h.api("perm_ticket", { token: p.token, room: "RNK001", p: "guest-1" })).ticket, null);
});

test("a banned account has no cheats at once, even with a ticket that has not run out; unbanning gives them back", async () => {
  const h = harness(), owner = await login(h, "owner"), p = await login(h, "bobby");
  const A = owner.atoken;
  await h.api("a_user_set", { atoken: A, id: "bobby", op: "perm", perm: { on: true, radar: true }, days: 30 });
  const t = await h.api("perm_ticket", { token: p.token, room: "ROOM01", p: "guest-1" });
  const check = () => h.api("perm_check", { ticket: t.ticket, room: "ROOM01", p: "guest-1" });
  assert.equal((await check()).perm.radar, true);
  assert.equal((await h.api("a_user_set", { atoken: A, id: "bobby", op: "ban", days: 1, reason: "t" })).status, 200);
  assert.deepEqual([(await check()).perm, (await check()).id], [null, null], "banned");
  assert.equal((await h.api("perm_ticket", { token: p.token, room: "ROOM01", p: "guest-1" })).status, 403);
  h.advance(2 * DAY);
  assert.equal((await check()).perm, null, "the ticket ran out after 6 hours");
  await h.api("a_user_set", { atoken: A, id: "bobby", op: "ban", reason: "t" });
  await h.api("a_user_set", { atoken: A, id: "bobby", op: "unban" });
  const t2 = await h.api("perm_ticket", { token: (await login(h, "bobby")).token, room: "ROOM01", p: "guest-1" });
  assert.equal((await h.api("perm_check", { ticket: t2.ticket, room: "ROOM01", p: "guest-1" })).perm.radar, true, "unbanned");
  // a ban on the account's device counts too
  const u = h.user("bobby");
  h.db.set("ban:dev:" + u.dev, JSON.stringify({ reason: "dev", until: 0, at: h.now() }));
  assert.equal((await h.api("perm_check", { ticket: t2.ticket, room: "ROOM01", p: "guest-1" })).perm, null, "device ban");
});
