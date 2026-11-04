const test=require('node:test'),assert=require('node:assert/strict'),W=require('../js/phantom-gun-wave');
test('source kill sweep starts at zero, preserves the previous sweep and keeps the coat for 8.7 seconds',()=>{
  assert.deepEqual(W.sample(undefined,1),{current:1,previous:1,hold:0,flame:0});
  const first=W.trigger(undefined,10);assert.equal(W.sample(first,10).current,0);assert.equal(W.sample(first,10.625).current,.5);
  const next=W.trigger(first,10.5),state=W.sample(next,10.5);assert.equal(state.current,0);assert.equal(state.previous,.4);
  assert.equal(W.sample(first,18.69).hold,.6);assert.ok(W.sample(first,18.8).hold>0);assert.equal(W.sample(first,19.04).hold,0);
  assert.equal(W.sample(first,10.2).flame,0);assert.ok(W.sample(first,10.35).flame>0);assert.equal(W.sample(first,10.5).flame,1);
});
test('the kill-coat palettes in the runtime file match our painted gun',()=>{
  const {PALETTES}=require('../scripts/champions-phantom/gun-paint'),source=require('node:fs').readFileSync(require.resolve('../js/phantom-gun-wave'),'utf8');
  const group=side=>JSON.stringify([PALETTES[side].body,PALETTES[side].trim,PALETTES[side].dark,PALETTES[side].glow]);
  assert.ok(source.includes('const palettes=attacker?'+group('attacker')+':'+group('defender')+';'),'run node scripts/champions-phantom/build.js to sync the palettes');
});
