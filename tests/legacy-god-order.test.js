const test = require("node:test");
const assert = require("node:assert/strict");
const { harness } = require("./api-harness");
const login = (h, id) => h.api("auth", { id, pw: id === "owner" ? "owner-password" : "password", device: "device-" + id });

// God mode is no longer sold, but an order made while it was (items: ["god"]) must still open it when the owner grants it.
test("granting a legacy god-mode order opens god mode, and taking it back closes it", async () => {
  const h = harness(), owner = await login(h, "owner"), p = await login(h, "bobby");
  const A = owner.atoken, c = JSON.parse(JSON.stringify(h.config));
  c.order.on = true; c.order.bank = "bank 1"; c.order.price = Object.assign({}, c.order.price, { radar: 1000 });
  assert.equal((await h.api("a_config_set", { atoken: A, config: c })).status, 200);
  const ord = await h.api("order_create", { token: p.token, items: ["radar"], days: 7, depositor: "x" });
  assert.equal(ord.status, 200);
  // as it was stored back when god mode was on sale
  const key = "ord:" + ord.order.id, o = JSON.parse(h.db.get(key));
  o.items = ["god"];
  h.db.set(key, JSON.stringify(o));
  assert.equal((await h.api("a_order_set", { atoken: A, id: o.id, op: "grant" })).status, 200);
  const stored = JSON.parse(h.db.get(key));
  assert.equal(stored.status, "granted");
  let perm = (await h.api("me", { token: p.token })).user.perm;
  assert.equal(perm.on, true);
  assert.equal(perm.god, true, "the paid god mode is open");
  assert.equal(perm.radar, false, "nothing else was paid for");
  assert.ok(stored.until > h.now(), "it runs for the order's length");
  assert.equal((await h.api("a_order_set", { atoken: A, id: o.id, op: "revoke", reason: "t" })).status, 200);
  perm = (await h.api("me", { token: p.token })).user.perm;
  assert.equal(!!(perm && perm.on && perm.god), false, "taken back");
});
