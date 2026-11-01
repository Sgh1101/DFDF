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
test("signing up cannot take a name a guest already goes by", async () => {
  const h = harness();
  h.db.set("gname:alice", "some-guest-device");
  const r = await h.api("auth", { id: "Alice", pw: "password", device: "device-123" });
  assert.equal(r.status, 409);
  assert.equal(h.db.get("user:alice") ?? null, null);
  assert.equal((await h.api("auth", { id: "bob", pw: "password", device: "device-123" })).status, 200);
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
