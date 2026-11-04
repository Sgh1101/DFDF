// An operator: an account the owner gives the owner's in-game powers (the panel with every cheat, the room-wide
// settings and the player tab) on the owner page. It is not the owner: no owner page (no atoken), nothing in a
// ranked room, and taking the role away (or a ban) counts at once for a ticket already handed out.
const test = require("node:test");
const assert = require("node:assert/strict");
const { harness } = require("./api-harness");
const login = (h, id) => h.api("auth", { id, pw: id === "owner" ? "owner-password" : "password8", device: "device-" + id });

test("the owner makes an account an operator: the owner's in-game panel, not the owner page", async () => {
  const h = harness(), owner = await login(h, "owner"), op = await login(h, "helper1"), other = await login(h, "player");
  assert.equal(op.status, 200);
  // before: nothing
  assert.equal((await h.api("owner_ticket", { token: op.token, room: "ABC123", p: "peer-1" })).ticket, null);
  // a player cannot make itself one
  assert.equal((await h.api("a_user_set", { atoken: op.atoken, id: "helper1", op: "operator", on: true })).status, 401);
  assert.equal((await h.api("a_user_set", { atoken: owner.atoken, id: "helper1", op: "operator", on: true })).status, 200);
  const me = await h.api("me", { token: op.token });
  assert.equal(me.user.operator, true);
  assert.equal(me.user.admin, true);
  assert.equal(me.user.owner, false);
  assert.equal(me.atoken, undefined, "no owner page");
  assert.equal((await h.api("a_config_get", { atoken: me.atoken })).status, 401);
  // a ticket the host checks with the server, scoped to the room and the peer, like the owner's
  const t = await h.api("owner_ticket", { token: op.token, room: "ABC123", p: "peer-1" });
  assert.equal(typeof t.ticket, "string");
  assert.deepEqual(await h.api("owner_check", { ticket: t.ticket, room: "ABC123", p: "peer-1" }), { status: 200, ok: true, owner: true, id: "helper1", exp: t.exp });
  assert.equal((await h.api("owner_check", { ticket: t.ticket, room: "ABC123", p: "peer-2" })).owner, false);
  assert.equal((await h.api("owner_check", { ticket: t.ticket, room: "XYZ123", p: "peer-1" })).owner, false);
  // another player still gets nothing
  assert.equal((await h.api("owner_ticket", { token: other.token, room: "ABC123", p: "peer-1" })).ticket, null);
  // shown on the owner page, and the log says who did what
  const listed = await h.api("a_users", { atoken: owner.atoken, q: "helper1" });
  assert.equal(listed.users[0].operator, true);
  // taken away: the ticket already handed out stops counting at once
  assert.equal((await h.api("a_user_set", { atoken: owner.atoken, id: "helper1", op: "operator", on: false })).status, 200);
  assert.equal((await h.api("owner_check", { ticket: t.ticket, room: "ABC123", p: "peer-1" })).owner, false);
  assert.equal((await h.api("me", { token: op.token })).user.operator, false);
  assert.equal((await h.api("owner_ticket", { token: op.token, room: "ABC123", p: "peer-1" })).ticket, null);
});

test("an operator has nothing in a ranked room, and a banned one nothing anywhere", async () => {
  const h = harness(), owner = await login(h, "owner"), op = await login(h, "helper1");
  await h.api("a_user_set", { atoken: owner.atoken, id: "helper1", op: "operator", on: true });
  assert.equal((await h.api("room_up", { token: op.token, code: "RNK001", ranked: true, players: ["helper1"] })).status, 200);
  const r = await h.api("owner_ticket", { token: op.token, room: "RNK001", p: "peer-1" });
  assert.equal(r.ticket, null);
  assert.equal(r.ranked, true);
  // the owner keeps his
  assert.equal(typeof (await h.api("owner_ticket", { token: owner.token, room: "RNK001", p: "peer-1" })).ticket, "string");
  // a ticket from before a ban counts for nothing
  const t = await h.api("owner_ticket", { token: op.token, room: "ABC123", p: "peer-1" });
  assert.equal(typeof t.ticket, "string");
  await h.api("a_user_set", { atoken: owner.atoken, id: "helper1", op: "ban", days: 1, reason: "test" });
  assert.equal((await h.api("owner_check", { ticket: t.ticket, room: "ABC123", p: "peer-1" })).owner, false);
});

test("a guest cannot be made an operator", async () => {
  const h = harness(), owner = await login(h, "owner");
  const g = await h.api("guest", { device: "device-guest-1" });
  assert.equal(g.status, 200);
  const r = await h.api("a_user_set", { atoken: owner.atoken, id: g.user.id, op: "operator", on: true });
  assert.notEqual(r.status, 200);
});
