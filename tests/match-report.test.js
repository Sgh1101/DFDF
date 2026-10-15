const test = require("node:test"), assert = require("node:assert/strict");
const create = require("../js/match-report");
test("explicit match start and polling share a single ticket", async () => {
  let calls = 0;
  const report = create({ token: () => "player", request: async () => ({ ticket: "match-" + ++calls }) });
  report.begin(true); await Promise.resolve(); report.begin(); report.begin();
  assert.equal(calls, 1); assert.equal(await report.finish(), "match-1");
  report.begin(true); assert.equal(await report.finish(), "match-2"); assert.equal(calls, 2);
});
test("a new match cannot replace the ticket of a result awaiting its request", async () => {
  let resolveFirst, calls = 0;
  const report = create({ token: () => "player", request: () => ++calls === 1 ? new Promise((r) => resolveFirst = r) : Promise.resolve({ ticket: "second" }) });
  report.begin(true); const finished = report.finish(); report.begin(true);
  resolveFirst({ ticket: "first" }); assert.equal(await finished, "first"); assert.equal(await report.finish(), "second");
});
