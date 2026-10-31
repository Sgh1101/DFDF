// Account guessing spread over many addresses, the relay credentials, and what an unexpected server failure tells the caller.
const test = require("node:test");
const assert = require("node:assert/strict");
const { harness } = require("./api-harness");
const from = (n) => ({ "x-forwarded-for": "10.0.0." + n });

test("wrong passwords from many addresses lock that account for 15 minutes, and a right one clears the count", async () => {
  const h = harness();
  assert.equal((await h.api("auth", { id: "victim", pw: "right-pw" })).ok, true);
  // ten wrong guesses, each from its own address (the per-address brake never trips)
  for (let i = 0; i < 10; i++) assert.equal((await h.api("auth", { id: "victim", pw: "guess" + i }, from(i))).status, 401);
  // the eleventh try is refused before the password is looked at, even the right one from a new address
  const locked = await h.api("auth", { id: "victim", pw: "right-pw" }, from(99));
  assert.equal(locked.status, 429);
  assert.match(locked.error, /비밀번호를 너무 많이 틀렸습니다/);
  // another account is not touched
  assert.equal((await h.api("auth", { id: "bystander", pw: "other-pw" }, from(99))).ok, true);
  h.advance(15 * 60 * 1000 + 1000);
  assert.equal((await h.api("auth", { id: "victim", pw: "right-pw" }, from(99))).ok, true, "open again after 15 minutes");
  // a right password clears the count: nine more wrong ones after it do not lock
  for (let i = 0; i < 5; i++) await h.api("auth", { id: "victim", pw: "typo" + i }, from(i));
  assert.equal((await h.api("auth", { id: "victim", pw: "right-pw" }, from(50))).ok, true);
  for (let i = 0; i < 9; i++) await h.api("auth", { id: "victim", pw: "typo" + i }, from(60 + i));
  assert.equal((await h.api("auth", { id: "victim", pw: "right-pw" }, from(70))).ok, true);
});

test("the relay credentials go to signed-in players only, a few times per address", async () => {
  const h = harness();
  assert.equal((await h.api("ice", {})).status, 401, "no token");
  assert.equal((await h.api("ice", { token: "forged.token" })).status, 401, "a token that does not verify");
  const guest = await h.api("guest", { device: "dev-ice-1" });
  const r = await h.api("ice", { token: guest.token });
  assert.equal(r.ok, true);
  assert.ok(Array.isArray(r.iceServers));
  let last;
  for (let i = 0; i < 30; i++) last = await h.api("ice", { token: guest.token });
  assert.equal(last.status, 429, "the 31st ask from one address in 10 minutes");
  assert.equal((await h.api("ice", { token: guest.token }, from(7))).ok, true, "another address still gets them");
});

test("an unexpected failure answers in plain words, not with its inner message", async () => {
  const h = harness();
  const p = await h.api("auth", { id: "player", pw: "password" });
  h.failPipeline();
  const r = await h.api("progress", { token: p.token, kills: 1, win: true, mode: "std" });
  assert.equal(r.status, 500);
  assert.equal(r.error, "서버 오류가 났습니다. 잠시 후 다시 시도해 주세요");
  assert.doesNotMatch(JSON.stringify(r), /pipeline failed/);
  // a refusal of ours keeps its words
  const bad = await h.api("auth", { id: "x", pw: "password" });
  assert.equal(bad.status, 400);
  assert.match(bad.error, /아이디는 2~16자/);
});
