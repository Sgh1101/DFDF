const test = require("node:test");
const assert = require("node:assert/strict");
const { harness } = require("./api-harness");

// The event map (사막 마을) is gone. A server config saved while it existed still has its two switches, and an old admin
// page may send them again: neither breaks the settings, and the public config announces no event map.
test("a saved config that still has the old event map switches is read as no event map", async () => {
  const h = harness({ now: Date.UTC(2026, 10, 1, 3) });
  const owner = await h.api("auth", { id: "owner", pw: "owner-password", device: "device-123" });
  const stale = JSON.parse(JSON.stringify(h.config));
  Object.assign(stale.game, { eventMap: true, eventMapEnd: "20261130", extraMaps: "desert_town" });
  const saved = await h.api("a_config_set", { atoken: owner.atoken, config: stale });
  assert.equal(saved.status, 200, "the old switches do not make the save fail");
  const pub = (await h.api("config", {})).config;
  assert.equal(pub.eventMap, undefined, "no event map is announced");
  assert.ok(!("eventMap" in pub.game) && !("eventMapEnd" in pub.game), "the old switches are not in the public settings");
  const defaults = JSON.parse(JSON.stringify(h.config));
  assert.ok(!("eventMap" in defaults.game) && !("eventMapEnd" in defaults.game), "the default settings no longer have them");
});
