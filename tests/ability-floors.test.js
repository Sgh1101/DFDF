const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const engine=fs.readFileSync('js/legacy/03-engine.js','utf8');
test('stacked floors use the physical support below the caster without snapping to the ceiling',()=>{
 const c={player:{y:4},PR:.33,STEP_H:.6,COLLIDERS:[{minX:-2,maxX:2,minZ:-2,maxZ:2,h:4},{minX:-2,maxX:2,minZ:-2,maxZ:2,h:8}],CHASH:{cell:8,cols:0,rows:0,minX:0,minZ:0,buckets:null,dirty:true,out:[],gen:0}};vm.createContext(c);
 // groundAt reads the collider hash: its builder comes from the engine as well
 vm.runInContext(engine.slice(engine.indexOf('function chashBuild('),engine.indexOf('function collideXZ(')),c);
 vm.runInContext(engine.slice(engine.indexOf('function abilityGroundY('),engine.indexOf('function rayBlocked(')),c);
 assert.equal(c.abilityGroundY(0,0,0),0);assert.equal(c.abilityGroundY(0,0),4);assert.equal(c.abilityGroundY(0,0,8),8);assert.equal(c.abilityGroundY(10,10,4),0);
 assert.equal(c.abilityOnFloor({y:0},4),false);assert.equal(c.abilityOnFloor({y:4},4),true);assert.equal(c.abilityOnFloor({y:8},4),false);
 assert.equal(c.abilityOnFloor({y:1},0,3),true,'tall volumes still reach actors within their actual height');
});
