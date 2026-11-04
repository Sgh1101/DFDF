// Fill only inside each own solid's atlas island. Its empty bore is geometry.
'use strict';
const T=require('three');
const normals={east:[1,0,0],west:[-1,0,0],up:[0,1,0],down:[0,-1,0],south:[0,0,1],north:[0,0,-1]};
module.exports=function pad(model,rig,canvases,shade){
  const base=canvases.base;if(!base)return;const layers=Object.values(canvases);
  for(const cube of model.cubes.filter(c=>c.dfdf_mesh))for(const [face,rect]of Object.entries(cube.uv)){
    const [ox,oy]=rect.uv,[w,h]=rect.uv_size,queue=[],seen=new Uint8Array(w*h);
    const offset=i=>((oy+Math.floor(i/w))*base.w+ox+i%w)*4;
    for(let i=0;i<w*h;i++)if(base.data[offset(i)+3]){queue.push(i);seen[i]=1;}
    if(!queue.length){
      // Subpixel islands can have no rasterized texel center. Shade their face center.
      const bone=model.bones.find(b=>b.name===cube.bone),node=rig.getObjectByName('phantom-bone-'+cube.bone),n=new T.Vector3(...normals[face]);
      const p=new T.Vector3(...cube.origin.map((v,i)=>v+cube.size[i]/2)).add(new T.Vector3(...cube.size).multiply(n).multiplyScalar(.5));
      if(cube.rotation){const pivot=new T.Vector3(...(cube.pivot||bone.pivot)),rot=new T.Euler(...cube.rotation.map(v=>v*Math.PI/180),'ZYX');p.sub(pivot).applyEuler(rot).add(pivot);n.applyEuler(rot);}
      p.sub(new T.Vector3(...bone.pivot)).applyMatrix4(node.matrixWorld);n.transformDirection(node.matrixWorld);
      const value=shade({material:cube.material,p:p.toArray(),n:n.toArray(),u:Math.floor(w/2),v:Math.floor(h/2),w,h,cube,face});
      for(let i=0;i<w*h;i++)for(const [name,canvas]of Object.entries(canvases))if(value[name]!=null)canvas.set(ox+i%w,oy+Math.floor(i/w),value[name],value[name+'Alpha']??255);
      continue;
    }
    // Breadth-first nearest fill cannot copy colour across a face or another part.
    for(let read=0;read<queue.length;read++){
      const i=queue[read],x=i%w,y=Math.floor(i/w),next=[];
      if(x)next.push(i-1);if(x+1<w)next.push(i+1);if(y)next.push(i-w);if(y+1<h)next.push(i+w);
      for(const j of next)if(!seen[j]){seen[j]=1;queue.push(j);const a=offset(i),b=offset(j);for(const canvas of layers)canvas.data.set(canvas.data.subarray(a,a+4),b);}
    }
  }
};
