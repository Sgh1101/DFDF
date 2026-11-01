const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { harness } = require("./api-harness");
const E = require("../js/event-map.js");
const login = (h, id = "player") => h.api("auth", { id, pw: id === "owner" ? "owner-password" : "password", device: "device-123" });
const KST = (y, m, d, hh = 0, mm = 0, ss = 0) => Date.UTC(y, m - 1, d, hh - 9, mm, ss);

// The event map (js/event-map.js): open while the owner's switch is on, until the end of the last day in Korea.
test("the last day is over at the next midnight in Korea, not before and not by the clock's own zone", () => {
  assert.equal(E.endOf("20261130"), KST(2026, 12, 1), "the end of 30 Nov is Dec 1 0:00 in Korea");
  assert.ok(E.choose(KST(2026, 11, 30, 23, 59, 59), true, "20261130"), "the last second of the last day is still open");
  assert.equal(E.choose(KST(2026, 12, 1, 0, 0, 0), true, "20261130"), null, "gone at 0:00 the day after");
  // 14:59:59 UTC on Nov 30 is 23:59:59 in Korea, 15:00:00 UTC is Dec 1 0:00
  assert.ok(E.choose(Date.UTC(2026, 10, 30, 14, 59, 59), true, "20261130"));
  assert.equal(E.choose(Date.UTC(2026, 10, 30, 15, 0, 0), true, "20261130"), null);
  const e = E.choose(KST(2026, 10, 30, 12), true, "20261130");
  assert.deepEqual(e, { key: "desert_town", last: "20261130", until: KST(2026, 12, 1) });
  assert.ok(E.open(e, KST(2026, 11, 30, 23)) && !E.open(e, KST(2026, 12, 1)), "the page reads the same moment from until");
});
test("a switch that is off, an empty last day (no end) and a last day that is not a date", () => {
  assert.equal(E.choose(KST(2026, 10, 30), false, "20261130"), null);
  const open = E.choose(KST(2030, 1, 1), true, "");
  assert.deepEqual(open, { key: "desert_town", last: "", until: 0 }, "empty = no end");
  assert.ok(E.open(open, KST(2090, 1, 1)));
  for (const bad of ["20261331", "2026-11-30", "abc", "20260230"]) assert.equal(E.valid(bad), false, bad);
  assert.equal(E.valid("20240229"), true, "a leap day");
  assert.equal(E.valid("20261130"), true);
});

test("the server announces the event in the public settings, follows the owner's switch and last day, and ends it by itself", async () => {
  const h = harness({ now: KST(2026, 10, 30, 12) });
  let owner = await login(h, "owner");
  const first = (await h.api("config", {})).config;
  assert.deepEqual(first.eventMap, { key: "desert_town", last: "20261130", until: KST(2026, 12, 1) }, "on by default, until 30 Nov");
  assert.equal(first.game.eventMap, true); assert.equal(first.game.eventMapEnd, "20261130");
  const set = (g) => { const c = JSON.parse(JSON.stringify(h.config)); Object.assign(c.game, g); return h.api("a_config_set", { atoken: owner.atoken, config: c }); };
  assert.equal((await set({ eventMap: false })).status, 200);
  assert.equal((await h.api("config", {})).config.eventMap, null, "switched off");
  assert.equal((await set({ eventMap: true })).status, 200);
  assert.equal((await h.api("config", {})).config.eventMap.key, "desert_town");
  // the day before and after midnight of the last day (the settings are cached for 20 s in a real server: the harness clock moves past that)
  h.advance(31 * 864e5 + 12 * 36e5 - 1000); // 2026-11-30 23:59:59 Korea time
  assert.equal(h.now(), KST(2026, 11, 30, 23, 59, 59));
  assert.ok((await h.api("config", {})).config.eventMap, "the last second of the last day");
  h.advance(1000);
  assert.equal((await h.api("config", {})).config.eventMap, null, "after midnight it is gone by itself");
  owner = await login(h, "owner"); // the owner's ticket is a day old
  // the owner moves the last day, clears it, or types something that is not a day
  assert.equal((await set({ eventMapEnd: "20261215" })).status, 200);
  assert.equal((await h.api("config", {})).config.eventMap.until, KST(2026, 12, 16));
  assert.equal((await set({ eventMapEnd: "" })).status, 200);
  assert.deepEqual((await h.api("config", {})).config.eventMap, { key: "desert_town", last: "", until: 0 }, "no end");
  assert.equal((await set({ eventMapEnd: "20261331" })).status, 400, "not a day");
  assert.equal((await set({ eventMapEnd: "next week" })).status, 400);
  assert.equal((await set({ eventMap: "no" })).config.game.eventMap, true, "not a switch: the default stays");
});

test("the owner's page names both settings and the page loads the module", () => {
  const admin = fs.readFileSync("admin.html", "utf8");
  assert.match(admin, /"game\.eventMap":\s*\["이벤트 맵 켜기/);
  assert.match(admin, /"game\.eventMapEnd":\s*\["이벤트 맵 마지막 날/);
  assert.match(fs.readFileSync("play.html", "utf8"), /js\/event-map\.js/);
});
