const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs");
const { harness } = require("./api-harness");

// The README quotes the skin total as "(현재 N개)". It went stale twice (909, then 973)
// while the catalogue changed, so it is checked against the server catalogue here.
test("README skin count matches the shipped catalogue", async () => {
  const readme = fs.readFileSync(require("node:path").join(__dirname, "..", "README.md"), "utf8");
  const quoted = [...readme.matchAll(/스킨(?: 정리)? \(현재 (\d+)개\)|스킨 아이템은 현재 (\d+)개|스킨은 현재 (\d+)개/g)].map((m) => +(m[1] || m[2] || m[3]));
  assert.ok(quoted.length >= 3, "README should state the current skin count in its three places");
  const { items } = await harness().api("catalog");
  for (const n of quoted) assert.equal(n, items, `README says ${n} skins but the catalogue has ${items}`);
});
