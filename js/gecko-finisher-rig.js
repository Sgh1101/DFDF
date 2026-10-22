// Static finisher geometry, using the supplied GeckoLib 4.4.4 baking convention.
// This is deliberately separate from the game's calibrated weapon/Neon view models.
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;else root.GECKO_FINISHER_RIG=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const rad=Math.PI/180,tri=[0,1,2,0,2,3];
  const pivot=p=>[-(p?.[0]||0),p?.[1]||0,p?.[2]||0];
  const rotation=r=>[-(r?.[0]||0)*rad,-(r?.[1]||0)*rad,(r?.[2]||0)*rad];
  // RenderUtils applies Z, then Y, then X to the matrix (Rz * Ry * Rx).
  function rotate(p,r){
    let [x,y,z]=p;const [a,b,c]=r;
    [y,z]=[y*Math.cos(a)-z*Math.sin(a),y*Math.sin(a)+z*Math.cos(a)];
    [x,z]=[x*Math.cos(b)+z*Math.sin(b),-x*Math.sin(b)+z*Math.cos(b)];
    return [x*Math.cos(c)-y*Math.sin(c),x*Math.sin(c)+y*Math.cos(c),z];
  }
  function data(bone,desc){
    const positions=[],normals=[],uv=[],bp=pivot(bone.pivot);
    for(const cube of bone.cubes||[]){
      const [sx,sy,sz]=cube.size,[ox,oy,oz]=cube.origin,f=cube.inflate??bone.inflate??0;
      const x0=-ox-sx-f,x1=-ox+f,y0=oy-f,y1=oy+sy+f,z0=oz-f,z1=oz+sz+f;
      const v={lb:[x0,y0,z0],rb:[x0,y0,z1],tlb:[x0,y1,z0],trb:[x0,y1,z1],tlf:[x1,y1,z0],trf:[x1,y1,z1],lf:[x1,y0,z0],rf:[x1,y0,z1]};
      const faces={west:['trb','tlb','lb','rb'],east:['tlf','trf','rf','lf'],north:['tlb','tlf','lf','lb'],south:['trf','trb','rb','rf'],up:['trb','trf','tlf','tlb'],down:['lb','lf','rf','rb']};
      const ns={west:[-1,0,0],east:[1,0,0],north:[0,0,-1],south:[0,0,1],up:[0,1,0],down:[0,-1,0]};
      const cp=pivot(cube.pivot),cr=rotation(cube.rotation),mirror=cube.mirror===true;
      const boxUV=Array.isArray(cube.uv),box=boxUV?(()=>{
        const [u,w]=cube.uv,x=Math.floor(sx),y=Math.floor(sy),z=Math.floor(sz);
        return {west:[u+z+x,w+z,z,y],east:[u,w+z,z,y],north:[u+z,w+z,x,y],south:[u+z+x+z,w+z,x,y],up:[u+z,w,x,z],down:[u+z+x,w+z,x,-z]};
      })():null;
      for(const face of ['west','east','north','south','up','down']){
        const spec=boxUV?{uv:box[face].slice(0,2),uv_size:box[face].slice(2)}:cube.uv?.[face];
        if(!spec)continue;
        let selected=face;
        if(mirror){if(face==='west')selected='east';else if(face==='east')selected='west';else if(!boxUV&&face==='up')selected='down';else if(!boxUV&&face==='down')selected='up';}
        const [u,w]=spec.uv,[du,dv]=spec.uv_size;
        // GeoQuad.build assigns the right U first on a non-mirrored cube.
        const us=mirror?[u,u+du,u+du,u]:[u+du,u,u,u+du],vs=[w,w,w+dv,w+dv];
        const n=rotate(ns[face].map((x,i)=>i===0&&mirror?-x:x),cr);
        for(const i of tri){
          const p=rotate(v[faces[selected][i]].map((x,j)=>x-cp[j]),cr).map((x,j)=>x+cp[j]-bp[j]);
          positions.push(...p);normals.push(...n);uv.push(us[i]/desc.texture_width,1-vs[i]/desc.texture_height);
        }
      }
    }
    return {positions,normals,uv};
  }
  function build(geo,material,T=globalThis.THREE){
    const root=new T.Group(),nodes=new Map();root.userData.coordinates='geckolib-4.4.4';
    const byName=new Map(geo.bones.map(b=>[b.name,b]));
    for(const b of geo.bones){
      const node=new T.Group(),p=pivot(b.pivot),parent=pivot(byName.get(b.parent)?.pivot),r=rotation(b.rotation);
      node.name='phantom-bone-'+b.name;node.position.set(...p.map((x,i)=>x-parent[i]));node.rotation.set(...r,'ZYX');
      node.userData.sourcePivot=(b.pivot||[0,0,0]).slice();
      if(b.cubes?.length){
        const d=data(b,geo.description),g=new T.BufferGeometry();
        g.setAttribute('position',new T.Float32BufferAttribute(d.positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(d.normals,3));g.setAttribute('uv',new T.Float32BufferAttribute(d.uv,2));
        node.add(new T.Mesh(g,material));
      }
      nodes.set(b.name,node);
    }
    for(const b of geo.bones)(nodes.get(b.parent)||root).add(nodes.get(b.name));
    return root;
  }
  return Object.freeze({pivot,rotation,rotate,data,build});
});
