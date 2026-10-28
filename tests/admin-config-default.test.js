const test = require("node:test");
const assert = require("node:assert/strict");
const { harness } = require("./api-harness");
const login = (h, id, pw) => h.api("auth", { id, pw: pw || (id === "owner" ? "owner-password" : "password"), device: "device-" + id });
const clone = (o) => JSON.parse(JSON.stringify(o));
// a harness with an owner, and the settings as the owner page would send them
async function setup() {
  const h = harness(), owner = await login(h, "owner"), A = owner.atoken;
  const get = async () => (await h.api("a_config_get", { atoken: A }));
  const stored = (k) => JSON.parse(h.db.get(k));
  return { h, A, get, stored };
}

test("a_config_default_set saves the settings as the config and as the owner's default", async () => {
  const { h, A, get, stored } = await setup();
  assert.equal((await get()).saved, null, "nothing saved yet");
  const c = clone(h.config); c.aim.strength = 77; c.game.announcement = "기본 공지"; c.gacha.cost1 = 321;
  const r = await h.api("a_config_default_set", { atoken: A, config: c });
  assert.equal(r.status, 200);
  assert.equal(r.config.aim.strength, 77); assert.equal(r.saved.config.gacha.cost1, 321); assert.ok(r.saved.t > 0);
  assert.equal(stored("config").aim.strength, 77, "the live config holds it");
  assert.equal(stored("config:default").config.game.announcement, "기본 공지", "so does the default");
  assert.equal(stored("config:default").t, h.now());
  const g = await get();
  assert.equal(g.config.aim.strength, 77);
  assert.equal(g.saved.config.gacha.cost1, 321); assert.equal(g.saved.t, h.now());
  assert.equal(g.defaults.aim.strength, h.config.aim.strength, "the factory values are still there");
  assert.notEqual(g.defaults.aim.strength, 77);
});

test("a_config_reset goes back to the saved default; to:factory goes back to the built-in values", async () => {
  const { h, A, get } = await setup();
  const c = clone(h.config); c.aim.strength = 77; c.gacha.cost1 = 321; c.game.maintenanceMsg = "저장해 둔 문구";
  await h.api("a_config_default_set", { atoken: A, config: c });
  const edit = async (f) => { const x = clone((await get()).config); f(x); assert.equal((await h.api("a_config_set", { atoken: A, config: x })).status, 200); };
  await edit((x) => { x.aim.strength = 5; x.gacha.cost1 = 9; x.game.maintenanceMsg = "다른 문구"; });
  assert.equal((await get()).config.aim.strength, 5);
  let r = await h.api("a_config_reset", { atoken: A });
  assert.equal(r.status, 200); assert.equal(r.to, "saved");
  assert.equal(r.config.aim.strength, 77);
  let g = await get();
  assert.equal(g.config.aim.strength, 77); assert.equal(g.config.gacha.cost1, 321); assert.equal(g.config.game.maintenanceMsg, "저장해 둔 문구");
  assert.ok(g.saved, "the default is still stored");
  r = await h.api("a_config_reset", { atoken: A, to: "factory" });
  assert.equal(r.to, "factory");
  g = await get();
  assert.equal(g.config.aim.strength, h.config.aim.strength); assert.equal(g.config.gacha.cost1, h.config.gacha.cost1); assert.equal(g.config.game.maintenanceMsg, h.config.game.maintenanceMsg);
  assert.equal(g.saved.config.aim.strength, 77, "going back to the factory values keeps the saved default");
  // and the saved default is one press away again
  assert.equal((await h.api("a_config_reset", { atoken: A })).config.aim.strength, 77);
});

test("with nothing saved, a_config_reset gives the built-in values and says so", async () => {
  const { h, A, get } = await setup();
  const c = clone(h.config); c.aim.strength = 5; c.xp.perKill = 99;
  await h.api("a_config_set", { atoken: A, config: c });
  const r = await h.api("a_config_reset", { atoken: A });
  assert.equal(r.status, 200); assert.equal(r.to, "factory");
  const g = await get();
  assert.equal(g.config.aim.strength, h.config.aim.strength); assert.equal(g.config.xp.perKill, h.config.xp.perKill);
  assert.equal(g.saved, null);
});

test("both kinds of reset keep the season clock and number and today's and this week's shop numbers", async () => {
  const { h, A, get } = await setup();
  const dflt = clone(h.config); dflt.aim.strength = 77; dflt.season.startDay = 20260101; dflt.season.skip = 1; dflt.shop.reroll = 2; dflt.shop.weekly.reroll = 3;
  await h.api("a_config_default_set", { atoken: A, config: dflt });
  const cur = clone(dflt); cur.aim.strength = 5; cur.season.startDay = 20261020; cur.season.skip = 4; cur.shop.reroll = 8; cur.shop.weekly.reroll = 9;
  const keep = (g, why) => {
    assert.equal(g.config.season.startDay, 20261020, why); assert.equal(g.config.season.skip, 4, why);
    assert.equal(g.config.shop.reroll, 8, why); assert.equal(g.config.shop.weekly.reroll, 9, why);
  };
  await h.api("a_config_set", { atoken: A, config: cur });
  let r = await h.api("a_config_reset", { atoken: A });
  assert.equal(r.config.aim.strength, 77); keep(r, "reset to the saved default"); keep(await get(), "reset to the saved default, read back");
  await h.api("a_config_set", { atoken: A, config: cur });
  r = await h.api("a_config_reset", { atoken: A, to: "factory" });
  assert.equal(r.config.aim.strength, h.config.aim.strength); keep(r, "reset to the factory values"); keep(await get(), "reset to the factory values, read back");
  // with no saved default at all
  const { h: h2, A: A2, get: get2 } = await setup();
  await h2.api("a_config_set", { atoken: A2, config: cur });
  keep(await h2.api("a_config_reset", { atoken: A2 }), "nothing saved"); keep(await get2(), "nothing saved, read back");
  // the built-in values are not touched by any of it
  assert.equal(h.config.season.skip, 0); assert.equal(h.config.shop.reroll, 0); assert.equal(h.config.shop.weekly.reroll, 0);
});

test("settings that do not pass the checks are refused and neither the config nor the default changes", async () => {
  const { h, A, get, stored } = await setup();
  const c = clone(h.config); c.aim.strength = 40;
  await h.api("a_config_default_set", { atoken: A, config: c });
  const before = { cfg: h.db.get("config"), def: h.db.get("config:default") };
  const bad = clone(c); bad.aim.strength = 500; // 0..100
  let r = await h.api("a_config_default_set", { atoken: A, config: bad });
  assert.equal(r.status, 400); assert.match(r.error, /aim\.strength/);
  const odds = clone(c); Object.keys(odds.gacha.odds).forEach((k) => (odds.gacha.odds[k] = 0));
  assert.equal((await h.api("a_config_default_set", { atoken: A, config: odds })).status, 400);
  assert.equal((await h.api("a_config_default_set", { atoken: A })).status, 400, "no config at all");
  assert.equal(h.db.get("config"), before.cfg); assert.equal(h.db.get("config:default"), before.def);
  // nothing saved yet: a refused one leaves no default behind
  const fresh = await setup();
  assert.equal((await fresh.h.api("a_config_default_set", { atoken: fresh.A, config: bad })).status, 400);
  assert.equal(fresh.h.db.has("config:default"), false); assert.equal(fresh.h.db.has("config"), false);
  assert.equal(stored("config").aim.strength, 40);
  assert.equal((await get()).saved.config.aim.strength, 40);
});

test("a_config_default_set, and the reset, need the owner's admin token", async () => {
  const { h, A } = await setup();
  const player = await login(h, "bobby");
  for (const [t, label] of [[undefined, "no token"], ["nope", "a bad token"], [player.token, "a player's token"], [player.atoken, "a player's atoken"]]) {
    assert.equal((await h.api("a_config_default_set", { atoken: t, config: h.config })).status, 401, label);
    assert.equal((await h.api("a_config_reset", { atoken: t })).status, 401, label + " (reset)");
    assert.equal((await h.api("a_config_reset", { atoken: t, to: "factory" })).status, 401, label + " (reset to factory)");
  }
  assert.equal(h.db.has("config:default"), false); assert.equal(h.db.has("config"), false);
  assert.equal((await h.api("a_config_default_set", { atoken: A, config: h.config })).status, 200);
});

test("a stored default missing a key the game has since added comes back with the built-in value; keys it dropped disappear", async () => {
  const { h, A, get } = await setup();
  const old = clone(h.config); delete old.aim.cone; delete old.shop.weekly; old.game.gone = "x"; old.removedSection = { a: 1 }; old.aim.strength = 66;
  h.db.set("config:default", JSON.stringify({ config: old, t: 1700000000000 }));
  let g = await get();
  assert.equal(g.saved.t, 1700000000000);
  assert.equal(g.saved.config.aim.strength, 66);
  assert.equal(g.saved.config.aim.cone, h.config.aim.cone, "added later: the built-in value");
  assert.equal(JSON.stringify(g.saved.config.shop.weekly), JSON.stringify(h.config.shop.weekly));
  const r = await h.api("a_config_reset", { atoken: A });
  assert.equal(r.status, 200); assert.equal(r.to, "saved");
  g = await get();
  assert.equal(g.config.aim.strength, 66); assert.equal(g.config.aim.cone, h.config.aim.cone);
  assert.equal(JSON.stringify(g.config.shop.weekly.mix), JSON.stringify(h.config.shop.weekly.mix));
  assert.equal(g.config.game.gone, undefined, "dropped keys do not come back"); assert.equal(g.config.removedSection, undefined);
  assert.equal(JSON.parse(h.db.get("config")).game.gone, undefined);
  // a default with nothing usable in it is as if there were none
  h.db.set("config:default", JSON.stringify({ t: 5 }));
  assert.equal((await get()).saved, null);
});

test("config_get and the resets leave the built-in values alone for the next request", async () => {
  const { h, A } = await setup();
  const before = JSON.stringify(h.config);
  await h.api("a_config_reset", { atoken: A });
  const c = clone(h.config); c.season.skip = 3; c.shop.reroll = 4;
  await h.api("a_config_default_set", { atoken: A, config: c });
  await h.api("a_config_reset", { atoken: A, to: "factory" });
  await h.api("a_config_reset", { atoken: A });
  assert.equal(JSON.stringify(h.config), before);
});
