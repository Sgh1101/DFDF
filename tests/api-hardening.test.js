const test = require("node:test");
const assert = require("node:assert/strict");
const { harness } = require("./api-harness");
const login = (h, id = "player", device = "device-123") => h.api("auth", { id, pw: id === "owner" ? "owner-password" : "password", device });

// a shop that is open, a player and the owner
async function shop(h) {
  const p = await login(h), owner = await login(h, "owner");
  const c = JSON.parse(JSON.stringify(h.config));
  c.order.on = true; c.order.bank = "국민 000000-00-000000"; c.order.holder = "홍길동";
  assert.equal((await h.api("a_config_set", { atoken: owner.atoken, config: c })).status, 200);
  h.advance(30000);
  const order = async (b) => (await h.api("order_create", Object.assign({ token: p.token }, b))).order;
  const set = (id, op, extra) => h.api("a_order_set", Object.assign({ atoken: owner.atoken, id, op }, extra));
  return { p, owner, order, set };
}
const ledgerOf = (h, id) => h.db.get("ledger").map((x) => JSON.parse(x)).filter((l) => l.id === id).map((l) => l.kind);
const statuses = (rs) => rs.map((r) => r.status).sort();

test("two concurrent grants of one order open it once", async () => {
  const h = harness(), { order, set } = await shop(h);
  const o = await order({ items: ["gold20k"], days: 7 });
  const gold0 = h.user("player").gold;
  const rs = await Promise.all([set(o.id, "grant"), set(o.id, "grant")]);
  assert.deepEqual(statuses(rs), [200, 409]);
  assert.equal(h.user("player").gold, gold0 + 20000);
  assert.equal(JSON.parse(h.db.get("ord:" + o.id)).status, "granted");
  assert.deepEqual(ledgerOf(h, o.id).filter((k) => k === "paid"), ["paid"]);
  assert.equal(h.db.get("ordlock:" + o.id) ?? null, null, "the lock is let go");
});

test("a grant and the player's cancel of one order: one wins, the order and the wallet agree", async () => {
  for (const first of ["grant", "cancel"]) {
    const h = harness(), { p, order, set } = await shop(h);
    const o = await order({ items: ["gold20k"], days: 7 });
    const gold0 = h.user("player").gold;
    const grant = () => set(o.id, "grant"), cancel = () => h.api("order_cancel", { token: p.token, id: o.id });
    const [a, b] = await Promise.all(first === "grant" ? [grant(), cancel()] : [cancel(), grant()]);
    const g = first === "grant" ? a : b, c = first === "grant" ? b : a;
    assert.deepEqual(statuses([g, c]), [200, 409], first);
    const final = JSON.parse(h.db.get("ord:" + o.id)).status;
    assert.equal(final, g.status === 200 ? "granted" : "cancelled");
    assert.equal(h.user("player").gold, gold0 + (g.status === 200 ? 20000 : 0));
    assert.deepEqual(ledgerOf(h, o.id).filter((k) => k !== "order"), [g.status === 200 ? "paid" : "cancel"]);
  }
});

test("two concurrent refunds of one granted order take the gold back once", async () => {
  const h = harness(), { order, set } = await shop(h);
  const o = await order({ items: ["gold5k"], days: 7 });
  assert.equal((await set(o.id, "grant")).status, 200);
  const gold1 = h.user("player").gold;
  const rs = await Promise.all([set(o.id, "refund", { revoke: true }), set(o.id, "refund", { revoke: true })]);
  assert.deepEqual(statuses(rs), [200, 409]);
  assert.equal(h.user("player").gold, gold1 - 5000);
  assert.deepEqual(ledgerOf(h, o.id).filter((k) => k === "refund"), ["refund"]);
  // and two revokes of another order
  const o2 = await order({ items: ["gold1k"], days: 7 });
  assert.equal((await set(o2.id, "grant")).status, 200);
  const gold2 = h.user("player").gold;
  assert.deepEqual(statuses(await Promise.all([set(o2.id, "revoke"), set(o2.id, "revoke")])), [200, 409]);
  assert.equal(h.user("player").gold, gold2 - 1000);
});

test("a lock held by someone else blocks the order; a lock of ours is not released by a stranger", async () => {
  const h = harness(), { order, set } = await shop(h);
  const o = await order({ items: ["gold1k"], days: 7 });
  h.db.set("ordlock:" + o.id, "someone-else");
  assert.equal((await set(o.id, "grant")).status, 409);
  assert.equal(h.db.get("ordlock:" + o.id), "someone-else", "the loser must not delete the holder's lock");
  assert.equal(JSON.parse(h.db.get("ord:" + o.id)).status, "pending");
  h.db.delete("ordlock:" + o.id);
  assert.equal((await set(o.id, "grant")).status, 200);
});

test("a failed ledger line after a grant does not let a retry credit twice", async () => {
  const h = harness(), { order, set } = await shop(h);
  const o = await order({ items: ["gold20k"], days: 7 });
  const gold0 = h.user("player").gold;
  // the books refuse the next write only
  h.failPipeline();
  const first = await set(o.id, "grant");
  assert.equal(first.status, 500);
  assert.equal(JSON.parse(h.db.get("ord:" + o.id)).status, "granted", "the status was saved before the books");
  assert.equal(h.user("player").gold, gold0 + 20000);
  assert.equal((await set(o.id, "grant")).status, 409, "a retry finds it done");
  assert.equal(h.user("player").gold, gold0 + 20000);
});
