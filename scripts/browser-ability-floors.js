const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{fixture}=require('./browser-fixture');
// Actual hospital navigation/physics was explored: floor 4, old zone 0 and
// floor-0 actors incorrectly accepted. No ray/ground/collision stubs here.
(async()=>{const f=await fixture();try{
 const p=await f.page('abilityfloors',{width:852,height:393});
 const report=await p.evaluate(()=>{
  render=()=>{};titleCam=()=>{};room.map='glacier';room.mode='std';startGame(AGENTS[0],false);closeShop();ADMIN.freezeAI=true;
  const me=myActor(),enemy=world.actors.find(a=>a.team!==me.team),out={maps:[],hospital:[]};
  function check(x,z,reference){startRound();closeShop();world.phase='live';world.roundTime=999;me.pos.x=x;me.pos.z=z;me.y=reference;me.invuln=999;
   const ground=groundAt(x,z,reference),zone=makeZone(x,z,2,1.2,8,0xff4400,{dps:20});
   Object.assign(enemy,{alive:true,y:ground+6,hp:100,armor:0,invuln:0,shielded:0,undying:0});enemy.pos.x=x;enemy.pos.z=z;updateZones(.1);const above=enemy.hp;
   enemy.y=ground-4;updateZones(.1);const below=enemy.hp;enemy.y=ground;updateZones(.1);
   return {ground,zone:zone.y,mesh:zone.mesh.position.y,above,below,same:enemy.hp};
  }
  setQuality('mobile');
  for(const key of [...new Set(MAP_LIST.map(m=>m.key))].filter(k=>k!=='ascent_trial')){
   room.map=key;loadMap(key);const slab=COLLIDERS.find(c=>!c.temp&&c.h>1&&c.maxX-c.minX>1&&c.maxZ-c.minZ>1&&!collideXZ((c.minX+c.maxX)/2,(c.minZ+c.maxZ)/2,c.h,PR));
   const x=slab?(slab.minX+slab.maxX)/2:MAP.attackSpawn.x,z=slab?(slab.minZ+slab.maxZ)/2:MAP.attackSpawn.z,y=slab?slab.h:0;
   out.maps.push({key,...check(x,z,y)});
  }
  for(const mode of GRAPHICS_SETTINGS.order){setQuality(mode);room.map='hospital';loadMap('hospital');const P=HOSPITAL_PLAN,G=HOSPITAL_NAV.graph();
   for(let level=0;level<3;level++){const i=Array.from(G.free).findIndex((v,i)=>v&&i>=level*P.rows*P.cols&&i<(level+1)*P.rows*P.cols),cell=i%(P.rows*P.cols),x=P.origin[0]+(cell%P.cols+.5)*P.cell,z=P.origin[1]+(Math.floor(cell/P.cols)+.5)*P.cell;
    out.hospital.push({mode,level,...check(x,z,level*P.floorH)});
   }
  }
  return out;
 });
 assert.ok(report.maps.length>=20);for(const row of [...report.maps,...report.hospital]){assert.equal(row.zone,row.ground,JSON.stringify(row));assert.equal(row.mesh,row.ground);assert.equal(row.above,100);assert.equal(row.below,100);assert.ok(row.same<100,JSON.stringify(row));}
 assert.equal(report.hospital.length,12);assert.deepEqual([...new Set(report.hospital.map(r=>r.ground))].sort((a,b)=>a-b),[0,4,8]);
 const dir=process.env.SHOT_DIR||'test-results/ability-floors';fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'floors.json'),JSON.stringify(report,null,2));
 assert.deepEqual(f.errors,[]);console.log('All ordinary maps and hospital 3 floors × 4 quality modes: physical placement, same-floor damage, above/below exclusion passed');
}finally{await f.browser.close();}})().then(()=>process.exit(0),e=>{console.error(e);process.exit(1);});
