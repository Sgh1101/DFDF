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

// ── account ids that are also keys of every plain object ──
test("new accounts cannot take __proto__, constructor or prototype", async () => {
  const h = harness();
  for (const id of ["__proto__", "constructor", "prototype", "Constructor", "PROTOTYPE", "__PROTO__"]) {
    const r = await h.api("auth", { id, pw: "password", device: "device-123" });
    assert.equal(r.status, 400, id);
    assert.equal(h.db.has("user:" + id.toLowerCase()), false, id);
  }
  assert.equal((await login(h, "constructors")).status, 200, "only the exact names are closed");
});

test("an old account named __proto__ still counts in the ranked team averages", async () => {
  const h = harness();
  const host = await login(h, "alpha");
  await login(h, "bravo");
  // such an account can only exist from before the rule: write one by hand
  const old = JSON.parse(h.db.get("user:alpha"));
  old.id = "__proto__"; old.mmr = 1400; old.guest = undefined;
  h.db.set("user:__proto__", JSON.stringify(old));
  const alpha = h.user("alpha"), bravo = h.user("bravo");
  const a = ["alpha", "__proto__"], b = ["bravo"], all = a.concat(b);
  assert.equal((await h.api("room_up", { token: host.token, code: "RNK001", ranked: true, players: all })).status, 200);
  const start = await h.api("ranked_start", { token: host.token, room: "RNK001", a, b });
  assert.equal(start.status, 200);
  assert.deepEqual(start.a, a);
  const rec = JSON.parse(h.db.get("rm:" + start.id));
  assert.equal(rec.mmr["__proto__"], 1400);
  assert.equal(rec.mmr.alpha, alpha.mmr);
  assert.ok(Number.isFinite(rec.avgA) && Number.isFinite(rec.avgB), "no NaN or null average");
  assert.equal(rec.avgA, (alpha.mmr + 1400) / 2);
  assert.equal(rec.avgB, bravo.mmr);
  assert.ok(Object.hasOwn(start.lv, "__proto__") && start.lv.__proto__.level >= 1, "the Lv chip for that account is there");
});

// ── keys that a plain object inherits are not types, actions or items ──
test("feedback type must be one of the listed strings", async () => {
  const h = harness(), p = await login(h), owner = await login(h, "owner");
  const send = (type, extra) => h.api("feedback_submit", Object.assign({ token: p.token, type, text: "내용을 적었습니다 " + Math.random() }, extra));
  for (const type of ["constructor", "__proto__", "toString", "hasOwnProperty", ["agent"], ["bug"], { toString: () => "bug" }, 1, null, undefined]) assert.equal((await send(type)).status, 400, JSON.stringify(type));
  assert.equal((await send("other")).status, 200);
  const list = await h.api("a_feedback", { atoken: owner.atoken });
  assert.equal(list.status, 200);
  assert.deepEqual(Object.keys(list.counts.byType), ["other"]);
  assert.equal(list.counts.total, 1);
});

test("an inherited name is no action, admin action or cosmetic", async () => {
  const h = harness(), p = await login(h), owner = await login(h, "owner");
  for (const a of ["__proto__", "constructor", "hasOwnProperty", "toString", "valueOf", "isPrototypeOf"]) {
    const r = await h.api(a, { token: p.token });
    assert.equal(r.status, 404, a);
    assert.equal(r.error, "없는 기능", a);
    const ra = await h.api("a_" + a, { atoken: owner.atoken });
    assert.equal(ra.status, 404, "a_" + a);
  }
  assert.equal((await h.api("nope", {})).status, 404);
  // the cosmetics shop
  const gold0 = h.user("player").gold;
  for (const id of ["constructor", "__proto__", "toString"]) assert.equal((await h.api("cos_buy", { token: p.token, id })).status, 404, id);
  assert.equal((await h.api("cos_equip", { token: p.token, slot: "title", id: "constructor" })).status, 400);
  assert.equal(h.user("player").gold, gold0);
  assert.equal(h.user("player").cos, undefined);
  // the wishlist and the owner's item grant
  assert.equal((await h.api("wish", { token: p.token, item: "rifle|constructor" })).status, 400);
  assert.equal((await h.api("a_user_set", { atoken: owner.atoken, id: "player", op: "grant", item: "rifle|__proto__" })).status, 400);
});

// ── a bad signature is a 401, never a 500 ──
test("a signature of multibyte characters is rejected, not thrown on", async () => {
  const h = harness(), p = await login(h), owner = await login(h, "owner");
  const forge = (t, sig) => t.split(".")[0] + "." + sig;
  const real = p.token.split(".")[1];
  for (const sig of ["é".repeat(real.length), "한".repeat(real.length), "é".repeat(real.length / 2 | 0), real.slice(0, -1) + "é", ""]) {
    assert.equal((await h.api("me", { token: forge(p.token, sig) })).status, 401, sig);
    assert.equal((await h.api("a_config_get", { atoken: forge(owner.atoken, sig) })).status, 401, "admin " + sig);
  }
  assert.equal((await h.api("me", { token: p.token })).status, 200);
  assert.equal((await h.api("a_config_get", { atoken: owner.atoken })).status, 200);
});
