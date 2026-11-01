// A new account needs a password of 8 characters; an account made with a shorter one (4 or more was allowed) keeps signing in.
const test = require("node:test");
const assert = require("node:assert/strict");
const { harness } = require("./api-harness");

test("signing up with a password under 8 characters is refused, and 8 works", async () => {
  const h = harness();
  const short = await h.api("auth", { id: "newbie", pw: "abc1234", device: "device-newbie" });
  assert.equal(short.status, 400);
  assert.match(short.error, /8자 이상/);
  assert.equal(h.db.has("user:newbie"), false, "no account was made");
  const ok = await h.api("auth", { id: "newbie", pw: "abc12345", device: "device-newbie" });
  assert.equal(ok.ok, true);
  assert.equal(ok.created, true);
});

test("an account whose password is 4-7 characters keeps signing in", async () => {
  const h = harness();
  const owner = await h.api("auth", { id: "owner", pw: "owner-password", device: "device-owner" });
  await h.api("auth", { id: "oldtimer", pw: "longenough1", device: "device-old" });
  // the owner's tool can still set a short password (what accounts made before the rule have)
  assert.equal((await h.api("a_user_set", { atoken: owner.atoken, id: "oldtimer", op: "password", pw: "1234" })).ok, true);
  const again = await h.api("auth", { id: "oldtimer", pw: "1234", device: "device-old" });
  assert.equal(again.ok, true);
  assert.ok(!again.created, "the same account, not a new one");
  assert.equal((await h.api("auth", { id: "oldtimer", pw: "123", device: "device-old" })).status, 400, "under 4 is still refused");
});

test("a name that is taken is still said to be taken, even with a short password", async () => {
  const h = harness();
  await h.api("auth", { id: "taken", pw: "longenough1", device: "device-a" });
  const r = await h.api("auth", { id: "taken", pw: "short12", device: "device-b" });
  assert.equal(r.status, 401);
  assert.match(r.error, /이미 있는 아이디/);
});
