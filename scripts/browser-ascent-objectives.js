// Actual selection/terrain were explored before these layered objective checks.
const assert=require('node:assert/strict'),fs=require('node:fs'),{fixture}=require('./browser-fixture');
(async()=>{const f=await fixture();try{
 const p=await f.page('ascentgoals',{width:1280,height:720},{},{bootTimeout:120000,beforeLoad:async p=>p.on('pageerror',e=>console.error('page error:',e.message))});
 await p.locator('#go-play').click();if(await p.locator('#sel-pick').isVisible())await p.locator('#sel-pick').click();
 await p.evaluate(()=>{render=()=>{};titleCam=()=>{};});
 await p.locator('#sel-maps button').filter({hasText:/^황혼 지구$/}).click();await p.waitForFunction(()=>ASCENT_TRIAL.status==='ready');await p.locator('#sel-go').click({timeout:120000});await p.waitForFunction(()=>ASCENT_TRIAL.active&&!!myActor());
 await p.evaluate(()=>{window.__rafCut=0;requestAnimationFrame=()=>{__rafCut++;return 0};});await p.waitForFunction(()=>__rafCut>0);
 const result=await p.evaluate(()=>{
  closeShop();ADMIN.freezeAI=true;const a=myActor(),out={markers:scene.children.filter(g=>g.userData.siteFx).map(g=>({x:g.position.x,y:g.position.y,z:g.position.z})),sites:[],layer:null};
  const at=(s,y=s.y)=>{a.pos.set(s.x,y,s.z);a.y=player.y=y;player.pos.copy(a.pos);a.vel.set(0,0,0);a.vy=0;a.onGround=true;a.alive=player.alive=true;a.invuln=999;};
  const carry=s=>{world.phase='live';world.over=false;world.roundTime=999;world.spike.state='carried';world.spike.carrier=a;a.team=player.team='atk';a.hasSpike=player.hasSpike=true;player.planting=a.planting=0;player.plantAnchor=null;keys.f=false;keys['4']=true;at(s);};
  for(const s of MAP.sites){
   carry(s);if(s.id==='A'){at(s,7.5);for(let i=0;i<Math.ceil(SPIKE.PLANT/.05)+4;i++)handleSpike(.05);out.underPlant=world.spike.state;}
   carry(s);for(let i=0;i<Math.ceil(SPIKE.PLANT/.05)+4;i++)handleSpike(.05);const item={id:s.id,expected:s.y,state:world.spike.state};
   for(let i=0;i<80;i++)tickSpikeMesh(.02,world.spike);item.y=world.spike.mesh.position.y;keys['4']=false;
   if(s.id==='A'){
    a.team=player.team='def';player.defusing=0;keys.f=true;at(s,7.5);for(let i=0;i<Math.ceil(SPIKE.DEFUSE/.05)+4;i++)handleSpike(.05);item.underDefuse=world.spike.state;item.underProgress=player.defusing;
    at(s);for(let i=0;i<Math.ceil(SPIKE.DEFUSE/.05)+4;i++)handleSpike(.05);item.defused=world.spike.state;keys.f=false;
   }
   carry(s);keys['4']=false;dropSpike(s.x,s.z);item.dropY=world.spike.mesh.position.y;out.sites.push(item);
  }
  const previewCam=new T.PerspectiveCamera(40,16/9,1,5000),corners=SELECT_MAPSHOT.frameCamera(previewCam,MAPS.ascent_trial,16/9);
  out.preview=corners.map(p=>p.project(previewCam)).every(p=>Math.abs(p.x)<.94&&Math.abs(p.y)<.94&&p.z>-1&&p.z<1);
  const before=new Set(scene.children);world.spike.state='planted';world.over=false;detonate();out.blast=scene.children.filter(m=>!before.has(m)&&['RingGeometry','SphereGeometry'].includes(m.geometry?.type)).map(m=>({type:m.geometry.type,y:m.position.y}));
  keys.f=keys['4']=false;world.spike.state='carried';a.hasSpike=player.hasSpike=false;world.over=false;world.phase='live';
  // Both decks at this point (the map is mirrored left to right since 2026-11-07) are connected to the main graph.
  const goal={x:114.625,z:55.125},from=MAP.attackSpawn,bot=world.actors.find(q=>q.ai);bot.pos.set(from.x,from.y,from.z);bot.y=from.y;bot.ai.path=null;
  navNext(bot,goal.x,goal.z,.05,13.75);const low=bot.ai.path.at(-1)?.y;
  navNext(bot,goal.x,goal.z,.05,18.75);out.layer={low,high:bot.ai.path.at(-1)?.y,goalY:bot.ai.pathGoal?.y};
  world.spike.state='dropped';world.spike.x=goal.x;world.spike.z=goal.z;world.spike.y=18.75;bot.team='atk';bot.hasSpike=false;
  out.spikeGoal=aiGoal(bot).y;out.wireY=Q.unpos(buildSnapshot(false).sk[5]);
  world.spike.state='carried';for(const q of world.actors)if(q!==bot&&q!==a)q.alive=false;
  a.team='def';a.alive=true;a.pos.set(goal.x,18.75,goal.z);a.y=18.75;bot.ai.path=null;bot.blind=0;bot.ai.skill=null;SWEEP.on=false;TEAM_INTEL.atk.clear();intelReport(bot,a);
  out.intelY=intelNearest(bot)?.y;aiThink(bot,.05);out.chaseY=bot.ai.pathGoal?.y;
  return out;
 });
 fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/ascent-objectives.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 assert.equal(result.markers.length,2,'both planting areas have visible markers');
 for(const r of result.sites){assert.equal(r.state,'planted');assert.equal(r.y,r.expected,'deployment stays above the actual site floor');assert.equal(r.dropY,r.expected);assert.ok(result.markers.some(m=>m.y===r.expected));}
 assert.equal(result.underPlant,'carried');assert.equal(result.sites[0].underDefuse,'planted');assert.equal(result.sites[0].underProgress,0);assert.equal(result.sites[0].defused,'defused');assert.deepEqual(result.layer,{low:13.75,high:18.75,goalY:18.75});for(const k of ['spikeGoal','wireY','intelY','chaseY'])assert.equal(result[k],18.75,k+' preserves the actual goal floor');assert.deepEqual(f.errors,[]);
 assert.ok(result.preview,'the whole terrain bounds fit the preview camera');assert.ok(result.blast.length>=29&&result.blast.every(m=>m.y>=5),'bomb explosion visuals stay above the site floor');
 console.log('Dusk District: manual A/B planting, deployment/drop heights, no use through another floor, defusing, site markers and goal-floor replanning passed. Browser fixture only.');
}finally{await f.browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
