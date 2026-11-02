const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),T=require('three');
const file='js/legacy/67-knives.js',source=fs.readFileSync(file,'utf8');
function build(id){
 const GUNMAT=new Proxy({},{get:(_,name)=>(color)=>{const m=new T.MeshStandardMaterial({color:color||0x778899});m.name=String(name);return m;}});
 const box={WEAPONS:{knife:{}},VM:{},GUNMAT,T,window:{}};
 vm.runInNewContext(source.slice(0,source.indexOf('  const HAND ='))+'window.BUILD=BUILD;})();',box);
 return box.window.BUILD[id]();
}
for(const id of ['karambit','butterfly'])test(id+' is an original finite mesh with its existing animation pivots and a bounded render cost',()=>{
 const g=build(id);assert.equal(g.userData.design,'dfdf-'+id+'-v2');g.updateMatrixWorld(true);
 const parts={};let triangles=0,meshes=0;
 g.traverse(o=>{if(o.userData.kpart){assert.ok(!parts[o.userData.kpart]);parts[o.userData.kpart]=o;}
  if(o.isMesh){meshes++;const p=o.geometry.attributes.position;for(const v of p.array)assert.ok(Number.isFinite(v));for(const v of o.geometry.attributes.normal.array)assert.ok(Number.isFinite(v));triangles+=(o.geometry.index?.count||p.count)/3;}
 });
 const b=new T.Box3().setFromObject(g),size=b.getSize(new T.Vector3());assert.ok(size.x>0&&size.x<.12&&size.y>.03&&size.y<.45&&size.z>.4&&size.z<1);
 assert.ok(meshes>=8&&meshes<=65);assert.ok(triangles<32000);
 const expected=id==='karambit'?{spin:[0,.008,.25]}:{hA:[0,.014,0],hB:[0,-.014,0]};
 for(const [name,position] of Object.entries(expected)){assert.deepEqual(parts[name]?.position.toArray(),position);parts[name].traverse(o=>{if(o.isMesh)assert.equal(o.userData.live,true,'the moving part must stay out of static baking');});}
 if(id==='karambit')assert.equal(parts.spin.parent,g);else{assert.equal(parts.hA.parent,g);assert.equal(parts.hB.parent,g);}
});
