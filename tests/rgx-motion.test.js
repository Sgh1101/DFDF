const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const D=require('../js/rgx-firefly-data'),{bedrock,THREE}=require('../scripts/champions-phantom/model');
test('a discontinuity approaches pre and departs post without an invented turn',()=>{
  const pre=[0,90,0],post=[0,-270,0],track={0:pre,1:{pre,post},2:post};
  assert.deepEqual(D.sample(track,.99,[0,0,0]),pre);
  assert.deepEqual(D.sample(track,1,[0,0,0]),post);
});
test('each SGH motion moves both hinge assemblies and returns to the assembled pose',()=>{
  const geo=D.parse(fs.readFileSync('assets/rgx-firefly/v1/model.json','utf8'))['minecraft:geometry'][0];
  const clips=D.parse(fs.readFileSync('assets/rgx-firefly/v1/animation.json','utf8')).animations;
  const material=new THREE.MeshBasicMaterial(),rig=bedrock().build(D.renderGeometry(geo),material);
  try{
    D.prepareRig(rig);D.pose(rig,clips,'static_idle',0);
    const upper=rig.getObjectByName('phantom-bone-up'),lower=rig.getObjectByName('phantom-bone-down');
    const joints=[upper,lower],start=joints.map(joint=>joint.quaternion.clone());
    const snapshot=()=>{rig.updateMatrixWorld(true);return rig.children[0].children[0].matrixWorld.elements.slice();};
    const idle=snapshot();
    for(const [clip,duration] of Object.entries({draw:2,inspect:6.5,melee_1:2.5,melee_2:2.5,melee_3:3})){
      assert.equal(clips[clip].animation_length,duration);
      const travel=[0,0];
      for(let i=0;i<=40;i++){
        D.pose(rig,clips,clip,duration*i/40);
        assert.ok(snapshot().every(Number.isFinite),clip);
        for(const [n,joint] of joints.entries())travel[n]=Math.max(travel[n],start[n].angleTo(joint.quaternion));
      }
      assert.ok(travel.every(angle=>angle>.5),clip);
      assert.deepEqual(snapshot(),idle,clip);
      assert.ok(joints.every((joint,n)=>start[n].angleTo(joint.quaternion)<1e-7),clip);
    }
  }finally{rig.traverse(n=>n.geometry?.dispose());material.dispose();}
});
