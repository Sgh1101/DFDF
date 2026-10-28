const test = require("node:test");
const assert = require("node:assert/strict");
const { harness } = require("./api-harness");
const login = (h, id, pw) => h.api("auth", { id, pw: pw || (id === "owner" ? "owner-password" : "password"), device: "device-" + id });

test("the owner sets a level or xp in one step: a huge number cannot hang the server or wrap around", async () => {
  const h = harness(), owner = await login(h, "owner"), A = owner.atoken;
  await login(h, "bobby");
  const per = h.config.xp.perLevel;
  assert.equal((await h.api("a_user_set", { atoken: A, id: "bobby", op: "level", level: 5 })).status, 200);
  assert.equal(h.user("bobby").xp, per * 10, "level 5 starts at perLevel * (1+2+3+4)");
  assert.equal((await h.api("a_user_set", { atoken: A, id: "bobby", op: "level", level: 1 })).status, 200);
  assert.equal(h.user("bobby").xp, 0);
  const t0 = Date.now();
  assert.equal((await h.api("a_user_set", { atoken: A, id: "bobby", op: "level", level: 2e7 })).status, 200);
  assert.ok(Date.now() - t0 < 1000, "no loop over the levels");
  assert.ok(h.user("bobby").xp > 0 && h.user("bobby").xp <= 1e12, "kept inside what the account can count: " + h.user("bobby").xp);
  // xp above 2^31 used to wrap to a negative number and be stored as 0
  assert.equal((await h.api("a_user_set", { atoken: A, id: "bobby", op: "xp", xp: 3e9 })).status, 200);
  assert.equal(h.user("bobby").xp, 3e9);
  assert.equal((await h.api("a_user_set", { atoken: A, id: "bobby", op: "xp", xp: -5 })).status, 200);
  assert.equal(h.user("bobby").xp, 0);
  assert.equal((await h.api("a_user_set", { atoken: A, id: "bobby", op: "xp", xp: "abc" })).status, 200);
  assert.equal(h.user("bobby").xp, 0);
});

test("signing in as the owner only counts wrong passwords against the lock, not the right ones", async () => {
  const h = harness();
  for (let i = 0; i < 12; i++) assert.equal((await login(h, "owner")).status, 200, "owner sign-in " + i);
  for (let i = 0; i < 12; i++) assert.equal((await h.api("admin_login", { pw: "owner-password" })).status, 200, "admin login " + i);
  // wrong guesses still run into the lock, and it also shuts the right password out until it expires
  for (let i = 0; i < 8; i++) assert.equal((await h.api("admin_login", { pw: "nope" })).status, 401);
  assert.equal((await h.api("admin_login", { pw: "nope" })).status, 429);
  assert.equal((await h.api("admin_login", { pw: "owner-password" })).status, 429);
  assert.equal((await login(h, "owner")).status, 429);
  h.advance(15 * 60000 + 1000);
  assert.equal((await h.api("admin_login", { pw: "owner-password" })).status, 200);
});

test("a rate-limit key whose EXPIRE was lost still ends: the next call gives it a window, and a live window is never extended", async () => {
  const h = harness();
  // the first wrong guess's EXPIRE is lost, so the key has no end date after it
  h.dropExpires(1);
  for (let i = 0; i < 9; i++) assert.equal((await h.api("admin_login", { pw: "nope" })).status, i < 8 ? 401 : 429);
  h.advance(15 * 60000 + 1000);
  assert.equal((await h.api("admin_login", { pw: "owner-password" })).status, 200, "the lock lifts after the window");
  // the window runs from the first guess: later guesses do not push it out
  const h2 = harness();
  for (let i = 0; i < 4; i++) await h2.api("admin_login", { pw: "nope" });
  h2.advance(10 * 60000);
  for (let i = 0; i < 4; i++) await h2.api("admin_login", { pw: "nope" });
  assert.equal((await h2.api("admin_login", { pw: "nope" })).status, 429);
  h2.advance(5 * 60000 + 1000);
  assert.equal((await h2.api("admin_login", { pw: "owner-password" })).status, 200, "15 minutes after the first guess");
});
