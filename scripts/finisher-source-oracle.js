const fs=require('node:fs'),path=require('node:path');
// Independent comparison against the supplied GeckoLib's absolute pivot matrix walk.
// Do not call the game's converter here: that would only compare it with itself.
module.exports=async function sourceOracle(page){
  const raw=Object.fromEntries(['dragon_low','serpent_cream','serpent_red'].map(n=>[n,JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/champions-phantom/2026-0.1.0/geo/finisher/'+n+'.geo.json')))['minecraft:geometry'][0]]));
  return page.evaluate(raw=>{
    const figure=[...FINISHERS.active][0]?.getObjectByName('champions-original-finisher');
    if(!figure)throw new Error('No original finisher to compare');
    const results=[];
    function turn(point,degrees,pivot){
      let [x,y,z]=point.map((v,i)=>v-pivot[i]);
      const [ax,ay,az]=[-(degrees?.[0]||0),-(degrees?.[1]||0),degrees?.[2]||0].map(n=>n*Math.PI/180);
      const y1=y*Math.cos(ax)-z*Math.sin(ax),z1=y*Math.sin(ax)+z*Math.cos(ax);y=y1;z=z1;
      const x1=x*Math.cos(ay)+z*Math.sin(ay),z2=-x*Math.sin(ay)+z*Math.cos(ay);x=x1;z=z2;
      return [x*Math.cos(az)-y*Math.sin(az)+pivot[0],x*Math.sin(az)+y*Math.cos(az)+pivot[1],z+pivot[2]];
    }
    for(const [name,geo]of Object.entries(raw)){
      const rig=figure.getObjectByName('original-'+name);if(!rig)continue;
      if(rig.userData.coordinates!=='geckolib-4.4.4')throw new Error('Legacy coordinate path '+name);
      rig.updateWorldMatrix(true,true);const inverse=new T.Matrix4().copy(rig.matrixWorld).invert(),bones=new Map(geo.bones.map(b=>[b.name,b]));
      let count=0,maxError=0;const headVertices=[];
      for(const bone of geo.bones){
        if(!bone.cubes?.length)continue;
        const node=rig.getObjectByName('phantom-bone-'+bone.name),mesh=node.children.find(o=>o.isMesh),position=mesh.geometry.attributes.position;
        let offset=0;
        for(const cube of bone.cubes){
          const [x,y,z]=cube.origin,[w,h,d]=cube.size,cp=[-(cube.pivot?.[0]||0),cube.pivot?.[1]||0,cube.pivot?.[2]||0],corners=[];
          for(const X of [-x-w,-x])for(const Y of [y,y+h])for(const Z of [z,z+d]){
            let p=turn([X,Y,Z],cube.rotation,cp);
            for(let b=bone;b;b=bones.get(b.parent)){const p0=b.pivot||[0,0,0];p=turn(p,b.rotation,[-p0[0],p0[1],p0[2]]);}
            corners.push(p);
          }
          for(let i=0;i<36;i++){
            const p=new T.Vector3().fromBufferAttribute(position,offset++).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse),xyz=p.toArray();
            const error=Math.min(...corners.map(q=>Math.hypot(...q.map((v,j)=>v-xyz[j]))));maxError=Math.max(maxError,error);count++;
            if(bone.name==='head')headVertices.push(xyz.map(n=>n/16));
          }
        }
      }
      // Author-provided eye locations from client.c.h, before the finisher's 1.25 pivot.
      const eyes=name==='dragon_low'?[[-3.9383,6.9484,1.2611],[-3.6727,6.9484,.2518]]:[[3.5307,14.9521,.8355],[4.8021,14.9521,2.1622]];
      const eyeDistance=eyes.map(p=>Math.min(...headVertices.map(q=>Math.hypot(...q.map((v,i)=>v-p[i])))));
      results.push({name,count,maxError,eyeDistance});
    }
    return results;
  },raw);
};
