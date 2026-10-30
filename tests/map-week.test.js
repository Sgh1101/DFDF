const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { harness } = require("./api-harness");
const W = require("../js/map-week.js");
const login = (h, id = "player") => h.api("auth", { id, pw: id === "owner" ? "owner-password" : "password", device: "device-123" });
const KST = (y, m, d, hh = 0, mm = 0, ss = 0) => Date.UTC(y, m - 1, d, hh - 9, mm, ss);

// The map of the week (js/map-week.js): a week starts Monday 0:00 in Korea, the choice is by the week number alone.
test("the week changes at Monday 0:00 in Korea and at no other time", () => {
  // 2026-11-02 is a Monday
  const sun = W.weekOf(KST(2026, 11, 1, 23, 59, 59)), mon = W.weekOf(KST(2026, 11, 2, 0, 0, 0));
  assert.equal(mon, sun + 1);
  assert.equal(W.weekOf(KST(2026, 11, 8, 23, 59, 59)), mon, "until the next Sunday's last second");
  assert.equal(W.weekOf(KST(2026, 11, 9, 0, 0, 0)), mon + 1);
  assert.equal(W.startOf(mon), KST(2026, 11, 2), "its start is Monday 0:00 Korea time");
  assert.equal(W.startOf(mon + 1) - W.startOf(mon), 7 * 864e5);
  // the same moment is the same week whatever the clock's own time zone: it is a number of milliseconds
  assert.equal(W.weekOf(Date.UTC(2026, 10, 1, 14, 59, 59)), sun, "Sunday 23:59:59 in Korea is 14:59:59 UTC");
  assert.equal(W.weekOf(Date.UTC(2026, 10, 1, 15, 0, 0)), mon);
});

test("the same week gives the same map, a map is only picked from the candidates, and nothing else changes it", () => {
  const t = KST(2026, 11, 4, 12);
  const a = W.choose(t, true, ""), b = W.choose(t + 3 * 864e5, true, "");
  assert.deepEqual(a, b, "any moment of the week");
  assert.ok(W.CANDIDATES.includes(a.key));
  assert.equal(a.until, W.startOf(a.week + 1));
  assert.notEqual(W.choose(t + 7 * 864e5, true, "").week, a.week);
});

test("the whole list goes round before a map comes back, and one is never the map two weeks in a row", () => {
  const n = W.CANDIDATES.length;
  for (const round of [3, 40, 1000]) {
    const seen = new Set();
    for (let i = 0; i < n; i++) seen.add(W.pick(round * n + i, W.CANDIDATES));
    assert.equal(seen.size, n, "round " + round + " has every map once");
  }
  for (let w = 2900; w < 6000; w++) assert.notEqual(W.pick(w, W.CANDIDATES), W.pick(w + 1, W.CANDIDATES), "week " + w);
  assert.equal(W.pick(5, ["only"]), "only");
  assert.equal(W.pick(5, []), null);
});

test("the owner's switch and exclusion list: switched off picks nothing, an excluded map is never picked", () => {
  const t = KST(2026, 11, 4);
  assert.equal(W.choose(t, false, ""), null);
  const all = W.CANDIDATES, keep = ["g07", "d02"];
  const exclude = all.filter((k) => !keep.includes(k)).join(", ");
  const seen = new Set();
  for (let w = 0; w < 30; w++) seen.add(W.choose(t + w * 7 * 864e5, true, exclude).key);
  assert.deepEqual([...seen].sort(), keep.sort());
  assert.equal(W.choose(t, true, all.join(",")), null, "everything excluded: no map of the week");
  assert.deepEqual(W.keys(" g01,, g02  d02 "), ["g01", "g02", "d02"]);
});

test("every candidate is a map the game builds (30 generated, 4 old 5v5, one 3v3, one 1v1)", () => {
  const src = ["js/legacy/34-generated-maps.js", "js/legacy/50-map-sizes.js", "js/engine/maps.js", "js/legacy/03-engine.js"].map((f) => fs.readFileSync(f, "utf8")).join("\n");
  assert.equal(W.CANDIDATES.length, 36);
  for (const k of W.CANDIDATES) assert.ok(new RegExp(`"key":"${k}"|\\b${k}\\s*:|key:\\s*"${k}"`).test(src), k + " is defined");
});

test("the server puts the week's map in the public settings, follows the owner's switch and list, and changes on Monday", async () => {
  const h = harness({ now: KST(2026, 11, 4, 12) }), owner = await login(h, "owner");
  const first = (await h.api("config", {})).config;
  assert.equal(first.weekMap.key, W.choose(h.now(), true, "").key);
  assert.equal(first.weekMap.until, KST(2026, 11, 9));
  assert.equal(first.game.weekMap, true); assert.equal(first.game.weekMapExclude, "");
  const set = (g) => { const c = JSON.parse(JSON.stringify(h.config)); Object.assign(c.game, g); return h.api("a_config_set", { atoken: owner.atoken, config: c }); };
  const others = W.CANDIDATES.filter((k) => k !== "g12").join(",");
  assert.equal((await set({ weekMapExclude: others })).status, 200);
  assert.equal((await h.api("config", {})).config.weekMap.key, "g12", "only g12 is left");
  assert.equal((await set({ weekMap: false })).status, 200);
  assert.equal((await h.api("config", {})).config.weekMap, null, "switched off");
  assert.equal((await set({ weekMap: "no" })).config.game.weekMap, true, "not a switch: the default stays");
  await set({ weekMapExclude: "" });
  const before = (await h.api("config", {})).config.weekMap;
  h.advance(5 * 864e5); // Monday 2026-11-09 12:00
  const after = (await h.api("config", {})).config.weekMap;
  assert.equal(after.week, before.week + 1); assert.notEqual(after.key, before.key);
});

test("the owner's page names both settings", () => {
  const admin = fs.readFileSync("admin.html", "utf8");
  assert.match(admin, /"game\.weekMap":\s*\["이번 주 맵/);
  assert.match(admin, /"game\.weekMapExclude":\s*\["이번 주 맵에서 뺄 맵/);
});
