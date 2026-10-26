const test = require("node:test");
const assert = require("node:assert/strict");
const { harness } = require("./api-harness");
const login = (h, id) => h.api("auth", { id, pw: id === "owner" ? "owner-password" : "password", device: "device-" + id });
const DAY = 864e5;
const FULL = ["radar", "wall", "cheat", "god", "oneShot", "infAmmo", "noRecoil"];

// What the host of a room is told about a guest's account (perm_ticket, then perm_check).
const seenByHost = async (h, token, room = "ROOM01") => {
  const t = await h.api("perm_ticket", { token, room });
  return t.ticket ? (await h.api("perm_check", { ticket: t.ticket, room })).perm : null;
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
