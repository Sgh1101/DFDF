const test = require("node:test"), assert = require("node:assert/strict"), vm = require("node:vm"), fs = require("node:fs");
const all = require("../scripts/game-source")();
const start = all.indexOf("  let worker = null,");
const source = all.slice(start, all.indexOf("  // ── guest ──", start));
test("hidden host has one worker, bounded simulation steps, and stops on return/end", () => {
  let clock = 100, terminated = 0, revoked = 0;
  const events = {}, workers = [], steps = [], document = { hidden: true, addEventListener: (key, fn) => events[key] = fn };
  const context = { document, NET: { mode: "host", conns: new Map([["peer", {}]]) }, world: { phase: "live" }, performance: { now: () => clock }, window: {}, step: (dt) => steps.push(dt), Blob: class {}, URL: { createObjectURL: () => "blob:test", revokeObjectURL: () => revoked++ }, Worker: class { constructor() { workers.push(this); } terminate() { terminated++; } }, addEventListener: (key, fn) => events[key] = fn, setInterval() {}, clearInterval() {}, netShutdown: () => "closed" };
  vm.createContext(context); vm.runInContext(source, context);
  events.visibilitychange(); events.visibilitychange(); assert.equal(workers.length, 1); assert.equal(revoked, 1);
  clock += 33; workers[0].onmessage(); assert.equal(steps.length, 1); assert.ok(Math.abs(steps[0] - .033) < 1e-9);
  clock += 1000; workers[0].onmessage(); assert.equal(steps.length, 6); assert.equal(steps.slice(1).reduce((a, b) => a + b, 0), .25);
  document.hidden = false; events.visibilitychange(); assert.equal(terminated, 1);
  document.hidden = true; events.visibilitychange(); assert.equal(workers.length, 2);
  events["match-finished"](); assert.equal(terminated, 2); assert.equal(context.netShutdown(), "closed"); assert.equal(terminated, 2);
});
