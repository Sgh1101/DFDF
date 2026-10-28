const test = require("node:test");
const assert = require("node:assert/strict");
const { harness } = require("./api-harness");
const login = (h, id) => h.api("auth", { id, pw: id === "owner" ? "owner-password" : "password", device: "device-" + id });
// The settings of the cheat hunt (digits painted on a building), taken out of the game, plus the on/off switch that
// only ever stood for it. Settings saved before that still carry them in Redis.
const GONE = ["enabled", "codeLength", "startAtMiddle", "moveAfterUse", "resetEachRound", "wrongWaitSec"];
const OLD = { enabled: false, codeLength: 4, startAtMiddle: false, moveAfterUse: false, resetEachRound: false, wrongWaitSec: 7 };
const oldConfig = (h) => { const c = JSON.parse(JSON.stringify(h.config)); Object.assign(c.cheat, OLD, { refillSec: 9 }); return c; };
const none = (cheat, where) => { for (const k of GONE) assert.equal(k in cheat, false, where + ": no cheat." + k); };

test("the default settings no longer carry the cheat hunt's keys", async () => {
  const h = harness(), owner = await login(h, "owner");
  none(h.config.cheat, "DEFAULT_CONFIG");
  const got = await h.api("a_config_get", { atoken: owner.atoken });
  none(got.defaults.cheat, "defaults sent to the owner page"); none(got.config.cheat, "settings sent to the owner page");
  assert.deepEqual(Object.keys(got.config.cheat).sort(), ["allow", "maxFastFire", "maxSpeed", "refillSec", "ultInfinite"]);
});

test("settings saved with the old cheat keys still load, save and reset, and the keys are gone from every answer", async () => {
  const h = harness();
  h.db.set("config", JSON.stringify(oldConfig(h))); // before anyone signs in: the server keeps what it read for a while
  const owner = await login(h, "owner"), A = owner.atoken;
  // load: the page and the game get the rest of the saved cheat settings, without the old keys
  const got = await h.api("a_config_get", { atoken: A });
  assert.equal(got.status, 200);
  none(got.config.cheat, "a_config_get"); assert.equal(got.config.cheat.refillSec, 9, "a setting that is still used is kept");
  const pub = await h.api("config", {});
  none(pub.config.cheat, "config (the game's copy)"); assert.equal(pub.config.cheat.refillSec, 9);
  const dash = await h.api("a_summary", { atoken: A });
  assert.equal(dash.status, 200); assert.equal("cheat" in dash.config, false, "the dashboard no longer carries a cheat switch");
  // save: an old owner page posts the keys back, even with a value the old range check would have refused
  const c = oldConfig(h); c.cheat.codeLength = 99; c.cheat.refillSec = 3;
  const set = await h.api("a_config_set", { atoken: A, config: c });
  assert.equal(set.status, 200);
  none(set.config.cheat, "a_config_set"); assert.equal(set.config.cheat.refillSec, 3);
  none(JSON.parse(h.db.get("config")).cheat, "what is stored"); assert.equal(JSON.parse(h.db.get("config")).cheat.refillSec, 3);
  // a bad number in a key that is still used is still refused
  const bad = oldConfig(h); bad.cheat.maxSpeed = 9;
  assert.equal((await h.api("a_config_set", { atoken: A, config: bad })).status, 400);
  // reset
  h.db.set("config", JSON.stringify(oldConfig(h)));
  const reset = await h.api("a_config_reset", { atoken: A });
  assert.equal(reset.status, 200); none(reset.config.cheat, "a_config_reset"); assert.equal(h.db.has("config"), false);
  none((await h.api("a_config_get", { atoken: A })).config.cheat, "after the reset");
});

test("an old cheat.enabled: false stops nobody: an account the owner gave cheats keeps them", async () => {
  const h = harness();
  h.db.set("config", JSON.stringify(oldConfig(h)));
  const owner = await login(h, "owner"), p = await login(h, "bobby"), A = owner.atoken;
  await h.api("a_user_set", { atoken: A, id: "bobby", op: "perm", perm: { on: true, god: true }, days: 30 });
  const t = await h.api("perm_ticket", { token: p.token, room: "ROOM01", p: "guest-1" });
  assert.ok(t.ticket, "the account still gets its ticket");
  assert.equal((await h.api("perm_check", { ticket: t.ticket, room: "ROOM01", p: "guest-1" })).perm.god, true);
  assert.ok((await h.api("owner_ticket", { token: owner.token, room: "ROOM01", p: "guest-2" })).ticket, "and the owner his");
});
