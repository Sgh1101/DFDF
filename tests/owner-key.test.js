const test = require("node:test");
const assert = require("node:assert/strict");
const { harness } = require("./api-harness");

const GDEV = "guest-device-0001";
// a guest that goes by "alice", as an account does (a guest from before the names were kept apart)
async function aliceGuest(h) {
  const g = await h.api("guest", { device: GDEV });
  assert.equal(g.status, 200);
  const rec = JSON.parse(h.db.get("guest:" + GDEV));
  rec.id = "alice";
  h.db.set("guest:" + GDEV, JSON.stringify(rec));
  return g.token;
}
async function shopOpen(h) {
  const owner = await h.api("auth", { id: "owner", pw: "owner-password", device: "device-owner" });
  const c = JSON.parse(JSON.stringify(h.config));
  c.order.on = true; c.order.bank = "국민 000000-00-000000"; c.order.holder = "홍길동";
  assert.equal((await h.api("a_config_set", { atoken: owner.atoken, config: c })).status, 200);
  h.advance(30000);
}

test("signing up cannot take a name a guest already goes by", async () => {
  const h = harness();
  h.db.set("gname:alice", "some-guest-device");
  const r = await h.api("auth", { id: "Alice", pw: "password", device: "device-123" });
  assert.equal(r.status, 409);
  assert.equal(h.db.get("user:alice") ?? null, null);
  assert.equal((await h.api("auth", { id: "bob", pw: "password", device: "device-123" })).status, 200);
});

test("a guest with an account's name cannot see or cancel the account's orders", async () => {
  const h = harness();
  await shopOpen(h);
  const a = await h.api("auth", { id: "alice", pw: "password", device: "device-alice" });
  const o = (await h.api("order_create", { token: a.token, items: ["gold20k"], days: 7 })).order;
  assert.ok(o && o.id);
  const gt = await aliceGuest(h);
  assert.deepEqual((await h.api("order_mine", { token: gt })).orders, []);
  assert.equal((await h.api("order_cancel", { token: gt, id: o.id })).status, 403);
  // an order kept before the owner key: still only the account's
  const old = JSON.parse(h.db.get("ord:" + o.id));
  delete old.byKey;
  h.db.set("ord:" + o.id, JSON.stringify(old));
  assert.equal((await h.api("order_cancel", { token: gt, id: o.id })).status, 403);
  assert.equal(JSON.parse(h.db.get("ord:" + o.id)).status, "pending");
  assert.equal((await h.api("order_mine", { token: a.token })).orders.length, 1);
  assert.equal((await h.api("order_cancel", { token: a.token, id: o.id })).status, 200);
});

test("a guest with an account's name cannot change or close the account's room", async () => {
  const h = harness();
  const a = await h.api("auth", { id: "alice", pw: "password", device: "device-alice" });
  assert.equal((await h.api("room_up", { token: a.token, code: "ALICE1", name: "mine", players: ["alice"] })).status, 200);
  const gt = await aliceGuest(h);
  assert.equal((await h.api("room_up", { token: gt, code: "ALICE1", name: "taken", players: [] })).status, 409);
  await h.api("room_down", { token: gt, code: "ALICE1" });
  assert.equal(JSON.parse(h.db.get("room:ALICE1")).name, "mine");
  // a room kept before the owner key goes by the name, and the account's name is the account's
  const old = JSON.parse(h.db.get("room:ALICE1"));
  delete old.hostKey;
  h.db.set("room:ALICE1", JSON.stringify(old));
  assert.equal((await h.api("room_up", { token: gt, code: "ALICE1", name: "taken", players: [] })).status, 409);
  await h.api("room_down", { token: gt, code: "ALICE1" });
  assert.ok(h.db.get("room:ALICE1"));
  assert.equal((await h.api("room_up", { token: a.token, code: "ALICE1", name: "mine", players: ["alice"] })).status, 200);
  // the guest's own room is still its own, and the account cannot touch it
  assert.equal((await h.api("room_up", { token: gt, code: "GUEST1", players: [] })).status, 200);
  assert.equal((await h.api("room_up", { token: a.token, code: "GUEST1", players: [] })).status, 409);
  await h.api("room_down", { token: gt, code: "GUEST1" });
  assert.equal(h.db.get("room:GUEST1") ?? null, null);
  await h.api("room_down", { token: a.token, code: "ALICE1" });
  assert.equal(h.db.get("room:ALICE1") ?? null, null);
});
