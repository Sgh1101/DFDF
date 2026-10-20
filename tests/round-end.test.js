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
test('respawn modes cannot show a stale result over a menu, new map, new match or guest',()=>{
  for(const change of [()=>{},f=>f.world.phase='menu',f=>f.world.round++,f=>f.ctx.CUR_MAP_KEY='hospital',f=>f.ctx.room.mode='dm',f=>f.world.actors=[],f=>f.ctx.NET.mode='client',f=>f.ctx.cancelRoundEnd()]){
    const f=fixture();f.world.actors=[];f.world.phase='end';f.world.over=true;f.ctx.CUR_MAP_KEY='glacier';f.ctx.room={mode:'ctf'};
    f.ctx.scheduleMatchFinish();change(f);f.advance(2600);assert.equal(f.results,change.toString()==='()=>{}'?1:0);
  }
});
test('simultaneous elimination follows the existing planted/unplanted rule and scores once',()=>{
  for(const [state,atk,def,winner]of [['carried',0,0,'def'],['planted',0,0,'atk'],['carried',1,0,'atk'],['planted',0,1,null],['carried',1,1,'def']]){
    const f=fixture();f.world.spike={state};f.world.roundTime=0;f.world.actors=[...Array.from({length:atk},()=>({alive:true,team:'atk'})),...Array.from({length:def},()=>({alive:true,team:'def'})),{alive:false,team:'atk'}];
    vm.runInContext(engine.slice(engine.indexOf('function checkRoundEnd()'),engine.indexOf('function winRounds()')),f.ctx);
    f.ctx.checkRoundEnd();f.ctx.checkRoundEnd();assert.equal(f.world.scoreAtk,winner==='atk'?1:0);assert.equal(f.world.scoreDef,winner==='def'?1:0);assert.equal(f.timers.size,winner?1:0);
  }
});
test('defuse and detonation in one processing window keep the first committed result once',()=>{
  for(const first of ['defuseDone','detonate']){
    const f=fixture();f.world.spike={state:'planted',x:0,z:0};f.world.entities=[];f.world.actors=[];
    Object.assign(f.ctx,{T:require('three'),SFX:{defused(){},boom(){}},screenShake(){},fxFlash(){},addFx(){},rnd:(a,b)=>(a+b)/2});
    vm.runInContext(engine.slice(engine.indexOf('function defuseDone('),engine.indexOf('function spikeUI(')),f.ctx);
    f.ctx[first]('player');f.ctx[first==='defuseDone'?'detonate':'defuseDone']('player');
    assert.equal(f.world.scoreAtk,first==='detonate'?1:0);assert.equal(f.world.scoreDef,first==='defuseDone'?1:0);
    assert.equal(f.world.spike.state,first==='detonate'?'boom':'defused');assert.equal(f.timers.size,1);f.advance(3600);assert.equal(f.starts,1);
  }
});
