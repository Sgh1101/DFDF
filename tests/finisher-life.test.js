const test=require('node:test'),assert=require('node:assert/strict'),T=require('three'),R=require('../js/gecko-finisher-rig');
test('finisher bodies breathe while eye anchors stay fixed and posing is absolute rather than cumulative',()=>{
 const geo=require('../assets/champions-phantom/dfdf-1/geo/finisher/dragon_low.geo.json')['minecraft:geometry'][0],rig=R.build(geo,new T.MeshBasicMaterial(),T);
 const head=rig.getObjectByName('phantom-bone-head'),body=rig.getObjectByName('phantom-bone-seg_04'),p=head.position.clone();
 R.animate(rig,3);const a=body.position.clone();R.animate(rig,3.8);assert.ok(a.distanceTo(body.position)>.01);assert.equal(p.distanceTo(head.position),0);
 const b=body.position.clone();R.animate(rig,3.8);assert.equal(b.distanceTo(body.position),0);rig.traverse(n=>assert.ok([...n.position.toArray(),...n.rotation.toArray().slice(0,3)].every(Number.isFinite)));
});
