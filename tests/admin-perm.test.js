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

test("a paid order opened during admin mode is the account's own cheat: it stays after the admin mode and does not widen it", async () => {
  const h = harness(), owner = await login(h, "owner"), p = await login(h, "carol");
  const A = owner.atoken, c = JSON.parse(JSON.stringify(h.config));
  c.order.on = true; c.order.bank = "bank 1"; c.order.price = Object.assign({}, c.order.price, { radar: 1000 });
  assert.equal((await h.api("a_config_set", { atoken: A, config: c })).status, 200);
  await h.api("a_user_set", { atoken: A, id: "carol", op: "admin", days: 2 });
  const ord = await h.api("order_create", { token: p.token, items: ["radar"], days: 30, depositor: "x" });
  assert.equal(ord.status, 200);
  assert.equal((await h.api("a_order_set", { atoken: A, id: ord.order.id, op: "grant" })).status, 200);
  h.advance(3 * DAY);
  const perm = await seenByHost(h, p.token);
  assert.equal(perm.radar, true, "the paid radar is there");
  for (const k of FULL.filter((k) => k !== "radar")) assert.equal(perm[k], false, k + " was not paid for");
  assert.ok(Math.abs(perm.until - (h.now() + 27 * DAY)) < 5000, "radar still runs about 27 more days");
  // taking the order back switches it off
  const A2 = (await login(h, "owner")).atoken;
  assert.equal((await h.api("a_order_set", { atoken: A2, id: ord.order.id, op: "revoke", reason: "t" })).status, 200);
  assert.equal(await seenByHost(h, p.token), null);
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
