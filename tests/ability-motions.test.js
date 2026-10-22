const test=require('node:test'),assert=require('node:assert/strict');
const M=require('../js/ability-motions'),P=require('../js/ability-profiles');
const KINDS=['flash','bolt','ring','ring2','ring3','shock','spark','swirl','charge'];
const TOOLS=['launch','spin','rewind','roll','flip','tilt','shake','spread','fade','pulse'];
test('every agent with authored gestures has a motion for each of its abilities, all different within the agent',()=>{
  const byAgent={};for(const [type,m] of Object.entries(M.motions))(byAgent[m.agent]=byAgent[m.agent]||[]).push([type,m.shape]);
  for(const [id,,verbs] of P.rows){
    if(id==='neon_agent')continue;
    const own=verbs.split(' ').filter(v=>v!=='native').length;
    assert.equal((byAgent[id]||[]).length,own,id);
    const shapes=byAgent[id].map(r=>r[1]);assert.equal(new Set(shapes).size,shapes.length,id+' repeats a motion: '+shapes);
  }
  assert.equal(Object.keys(byAgent).length,P.rows.length-1);
});
test('a cast starts and ends out of view, stays in view through its middle and never goes near the eye',()=>{
  for(const [type,m] of Object.entries(M.motions)){
    for(const o of [0,1]){const s=M.sample(type,o);assert.equal(s.weight,0,type);s.hand.forEach((v,i)=>assert.ok(Math.abs(v-M.poses.low[i])<1e-6,type+' '+o));}
    for(let i=0;i<=100;i++){
      const o=i/100,s=M.sample(type,o),t=M.toolPose(type,o);
      for(const v of [...s.hand,...(s.support||[]),s.dip,s.weight,...t])assert.ok(Number.isFinite(v),type+' at '+o);
      if(o>=.25&&o<=.8){
        const [x,y,z]=s.hand;
        assert.ok(x>-.5&&x<.55&&y>-.42&&y<.46&&z>-.42&&z<.2,type+' hand leaves the view at '+o+': '+s.hand.map(v=>v.toFixed(2)));
      }
      assert.ok(s.dip>=0&&s.dip<=.45&&t[6]>0&&t[7]>=0&&t[7]<=1,type);
    }
    assert.ok(m.rel>.25&&m.rel<.85,type+' release '+m.rel);
    assert.ok(!m.dur||(m.dur>=.35&&m.dur<=1.1),type+' duration');
    assert.ok(TOOLS.includes(m.tool),type+' tool '+m.tool);
    for(const [kind,time] of M.cues(type)){assert.ok(KINDS.includes(kind),type+' '+kind);assert.ok(time>=0&&time<1,type);}
    assert.ok(m.trail>=0&&m.trail<=1,type);
  }
});
test('no two abilities share a motion: hand path, tool and effects together are unique',()=>{
  const sig=(type)=>{const m=M.motions[type],path=[];for(let i=1;i<20;i++){const s=M.sample(type,i/20);path.push(...s.hand.map(v=>v.toFixed(3)),s.support?1:0);}return JSON.stringify([path,m.tool,m.fx,m.dur||0,m.rel]);};
  const seen=new Map();
  for(const type of Object.keys(M.motions)){const k=sig(type);assert.ok(!seen.has(k),type+' moves exactly like '+seen.get(k));seen.set(k,type);}
  // and within one agent the hand paths themselves are far apart, not one path with another effect
  const byAgent={};for(const [type,m] of Object.entries(M.motions))(byAgent[m.agent]=byAgent[m.agent]||[]).push(type);
  for(const types of Object.values(byAgent))for(let a=0;a<types.length;a++)for(let b=a+1;b<types.length;b++){
    let d=0;for(let i=1;i<40;i++){const p=M.sample(types[a],i/40).hand,q=M.sample(types[b],i/40).hand;d+=Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2]);}
    assert.ok(d/39>.03,types[a]+' and '+types[b]+' move too alike ('+(d/39).toFixed(3)+')');
  }
});
test('reduced motion keeps the gesture but drops the tremble and shake',()=>{
  const type='ult_fire',a=M.sample(type,.5,false).hand,b=M.sample(type,.5,true).hand;
  assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])<.02);
  const c=M.sample('x_ground_slam',.55,false).hand,d=M.sample('x_ground_slam',.55,true).hand;
  assert.ok(Math.hypot(c[0]-d[0],c[1]-d[1])>0&&Math.hypot(c[0]-d[0],c[1]-d[1])<.02);
});
test('the support hand mirrors across the view',()=>{
  const p=M.poses.far,m=M.mirror(p);
  // the left hand at x=-0.1+p0 lands near +0.12 (+0.02) on the right; turns flip sign
  assert.ok(Math.abs((.12+m[0])-(-(-.1+p[0])+.02))<1e-9);assert.equal(m[4],-p[4]);assert.equal(m[5],-p[5]);
});
