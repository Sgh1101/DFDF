const test = require("node:test"), assert = require("node:assert/strict");
const tiers = require("../js/skin-tiers"), { harness } = require("./api-harness");
test("Transcendent ranks above Legendary and only the two Phantom skins move to tier five", async () => {
  assert.deepEqual(tiers.list.map((t) => [t.id, t.key, t.ko]), [[1, "common", "일반"], [2, "rare", "희귀"], [3, "epic", "영웅"], [4, "legendary", "전설"], [5, "transcendent", "초월"]]);
  assert.equal(tiers.max, 5); assert.equal(tiers.label(5), "초월"); assert.notEqual(tiers.list[3].c, tiers.list[4].c);
  const h = harness(), catalog = await h.api("catalog");
  assert.deepEqual(Object.keys(catalog.tiers).filter((id) => catalog.tiers[id] === 5).sort(), ["champions_atk", "champions_def"]);
  for (const id of ["lava", "galaxy", "storm", "laurel"]) assert.equal(catalog.tiers[id], 4);
  assert.equal(catalog.items, 545);
});
