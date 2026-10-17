const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm");
const engine = fs.readFileSync("js/legacy/03-engine.js", "utf8");
function fixture() {
  let now = 1000, starts = 0, results = 0, id = 0;
  const timers = new Map(), world = { phase: "live", round: 1, scoreAtk: 0, scoreDef: 0, over: false };
  const ctx = { world, NET: { mode: "solo" }, player: { team: "atk" }, performance: { now: () => now }, closeShop() {}, chargeUlt() {}, banner() {}, updateHUD() {}, winRounds: () => 13, halfTime: () => 99,
    setTimeout(fn, delay) { timers.set(++id, { fn, at: now + delay }); return id; }, clearTimeout(id) { timers.delete(id); },
    startRound() { starts++; world.phase = "buy"; world.over = false; }, gameOver() { results++; world.phase = "over"; } };
  vm.createContext(ctx);
  vm.runInContext(engine.slice(engine.indexOf("let roundEndTimer ="), engine.indexOf("function startRound()")) + engine.slice(engine.indexOf("function endRound("), engine.indexOf("function checkRoundEnd()")), ctx);
  return { ctx, world, timers, get starts() { return starts; }, get results() { return results; }, advance(ms) { now += ms; for (const [id, t] of [...timers]) if (t.at <= now) { timers.delete(id); t.fn(); } }, now: () => now };
}
test("Champions waits eight seconds from the actual kill, scores once and starts one next round", () => {
  const f = fixture(); f.world.championsFinishUntil = f.now() + 8000; f.advance(40);
  f.ctx.endRound("atk", "last kill"); f.ctx.endRound("atk", "duplicate");
  assert.equal(f.world.scoreAtk, 1); assert.equal(f.timers.size, 1);
  f.advance(7959); assert.equal(f.starts, 0); assert.equal(f.world.phase, "end");
  f.advance(1); assert.equal(f.starts, 1); assert.equal(f.world.round, 2);
  f.advance(9000); assert.equal(f.starts, 1);
});
test("ordinary endings keep 3.6 seconds; match point waits eight seconds before results", () => {
  const f = fixture(); f.ctx.endRound("def", "timeout"); f.advance(3599); assert.equal(f.starts, 0); f.advance(1); assert.equal(f.starts, 1);
  const last = fixture(); last.world.scoreAtk = 12; last.world.championsFinishUntil = last.now() + 8000;
  last.ctx.endRound("atk", "last kill"); last.advance(7999); assert.equal(last.results, 0); last.advance(1); assert.equal(last.results, 1); assert.equal(last.starts, 0);
});
test("cancelled or obsolete round callbacks cannot restart a menu, new round or guest session", () => {
  for (const change of [f => f.ctx.cancelRoundEnd(), f => { f.world.phase = "menu"; }, f => { f.world.round++; }, f => { f.ctx.NET.mode = "client"; }]) {
    const f = fixture(); f.ctx.endRound("atk", "end"); change(f); f.advance(9000); assert.equal(f.starts, 0); assert.equal(f.results, 0);
  }
});
