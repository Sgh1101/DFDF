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
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const refused = (status) => Object.assign(new Error("너무 자주 보냈습니다"), { status });
test("a ticket the server would not give is asked for again while the match runs", async () => {
  let calls = 0, errors = 0;
  const report = create({ token: () => "player", retryMs: 5, onError: () => errors++, request: async () => { if (++calls < 3) throw refused(429); return { ticket: "late" }; } });
  report.begin(true); await wait(60);
  assert.equal(calls, 3); assert.equal(errors, 1, "the player is told once, not at every try");
  assert.equal(await report.finish(), "late"); assert.equal(report.missed(), null);
});
test("a match that never got its ticket says why, and asking stops when it ends", async () => {
  let calls = 0;
  const report = create({ token: () => "player", retryMs: 5, request: async () => { calls++; throw refused(429); } });
  report.begin(true); await wait(30);
  assert.equal(await report.finish(), ""); assert.equal(report.missed().status, 429);
  const n = calls; await wait(30);
  assert.equal(calls, n, "no more asking once the match is over");
  // a refusal that asking again cannot change (not a participant, signed out) is not asked again
  let other = 0;
  const firm = create({ token: () => "player", retryMs: 5, request: async () => { other++; throw refused(403); } });
  firm.begin(true); await wait(30);
  assert.equal(other, 1); assert.equal(await firm.finish(), ""); assert.equal(firm.missed().status, 403);
  // a match with its ticket, or none asked for, has nothing to say
  const fine = create({ token: () => "player", request: async () => ({ ticket: "t" }) });
  fine.begin(true); assert.equal(await fine.finish(), "t"); assert.equal(fine.missed(), null);
  assert.equal(await fine.finish(), ""); assert.equal(fine.missed(), null);
});
