const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../js/ability-profiles');
const actor=(id,x,z,alive=true)=>({id,pos:{x,z},alive});
test('chain never jumps beyond reach, repeats a target or crosses blocked sight',()=>{
  const a=actor('a',0,0),b=actor('b',4,0),c=actor('c',8,0),d=actor('d',20,0),dead=actor('dead',1,0,false);
  assert.deepEqual(P.chainTargets(a,[a,b,c,d,dead],5,4).map(a=>a.id),['a','b','c']);
  assert.deepEqual(P.chainTargets(a,[a,b,c,d],5,4,(x,y)=>y!==b).map(a=>a.id),['a']);
  assert.deepEqual(P.chainTargets(null,[a,b],5,4),[]);
});
test('equidistant chain targets are deterministic across roster order and peers',()=>{
  const a=actor('a',0,0),b=actor('b',1,0),c=actor('c',-1,0);
  assert.deepEqual(P.chainTargets(a,[c,b,a],2,2).map(a=>a.id),['a','b']);
  assert.deepEqual(P.chainTargets(a,[b,a,c],2,2).map(a=>a.id),['a','b']);
});
test('segment distance includes endpoints and a degenerate tether',()=>{
  assert.equal(P.lineDistance({x:4,z:3},{x:0,z:0},{x:8,z:0}),3);
  assert.equal(P.lineDistance({x:12,z:3},{x:0,z:0},{x:8,z:0}),5);
  assert.equal(P.lineDistance({x:3,z:4},{x:0,z:0},{x:0,z:0}),5);
});
test('every authored gesture has finite phases, smooth recovery and no leftover pose',()=>{
  for(const row of P.rows)for(const verb of row[2].split(' '))assert.ok(P.actions[verb],row[0]+': '+verb);
  for(const duration of [.38,.5,.55,.65,.7,.85,1])for(const release of [.18,.42,.46,.5,.58,.64,.65]){
    const p={duration,release};
    assert.equal(P.phase(p,0).weight,0);assert.equal(P.phase(p,duration).weight,0);
    for(let i=0;i<=100;i++)for(const n of Object.values(P.phase(p,duration*i/100)))assert.ok(Number.isFinite(n)&&n>=0&&n<=1);
  }
});
test('roster mismatches and shared types cannot silently inherit a generic profile',()=>{
  const result=P.build([{id:'unknown',abilities:[]}]);assert.ok(result.errors.includes('Unprofiled agent unknown'));
  const roster=P.rows.map(([id])=>({id,abilities:['Q','E','C','X'].map(key=>({key,type:id+key,ult:key==='X'?6:0}))}));
  const valid=P.build(roster);assert.deepEqual(valid.errors,[]);assert.equal(Object.keys(valid.profiles).length,172);
  roster[1].abilities[0].type=roster[0].abilities[0].type;assert.ok(P.build(roster).errors.some(e=>e.startsWith('Repeated type')));
});
