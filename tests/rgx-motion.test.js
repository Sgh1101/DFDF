const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const D=require('../js/rgx-firefly-data'),{bedrock,THREE}=require('../scripts/champions-phantom/model');
test('source inspect discontinuities approach pre and depart post without an invented turn',()=>{
  const track=D.parse(fs.readFileSync('assets/rgx-firefly/v1/animation.json','utf8')).animations.inspect.bones.butterfly.rotation;
  assert.deepEqual(D.sample(track,5.31665,[0,0,0]),track['5.3333'].pre);
  assert.deepEqual(D.sample(track,5.3333,[0,0,0]),track['5.3333'].post);
});
test('the retained RGX plays its source handles and returns to its exact idle pose',()=>{
  assert.equal(typeof D.prepareRig,'function','the source bone animation adapter must be present');
  const geo=D.parse(fs.readFileSync('assets/rgx-firefly/v1/model.json','utf8'))['minecraft:geometry'][0];
  const clips=D.parse(fs.readFileSync('assets/rgx-firefly/v1/animation.json','utf8')).animations;
  const material=new THREE.MeshBasicMaterial(),rig=bedrock().build(D.renderGeometry(geo),material);
  try{
    D.prepareRig(rig);D.pose(rig,clips,'static_idle',0);
    const handle=rig.getObjectByName('phantom-bone-up'),blade=rig.getObjectByName('phantom-bone-blade2');
    const start=handle.quaternion.clone();
    let travel=0;
    for(const t of [.2,.5,1,2,3,4,5,6]){D.pose(rig,clips,'inspect',t);travel=Math.max(travel,start.angleTo(handle.quaternion));}
    assert.ok(travel>.5,`the original handle must turn, got ${travel}`);
    D.pose(rig,clips,'static_idle',0);rig.updateMatrixWorld(true);
    assert.ok(start.angleTo(handle.quaternion)<1e-7);
    assert.ok([...blade.matrix.elements].every(Number.isFinite));
    const idleAgain=blade.matrix.clone();D.pose(rig,clips,'draw',1);D.pose(rig,clips,'static_idle',0);rig.updateMatrixWorld(true);
    assert.deepEqual(blade.matrix.elements,idleAgain.elements);
    assert.equal(clips.inspect.animation_length,6.5,'preserve the provided inspect duration');
  }finally{rig.traverse(n=>n.geometry?.dispose());material.dispose();}
});
