(() => {
  'use strict';
  const S=window.NEON_EFFECTS={active:new Set()};
  const vertexShader='attribute vec4 sourceColor; varying vec4 tint; varying vec2 sourceUv; void main(){tint=sourceColor;sourceUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
  const fragmentShader='varying vec4 tint; varying vec2 sourceUv; uniform sampler2D sourceMap; uniform bool textured; void main(){gl_FragColor=tint;if(textured)gl_FragColor*=texture2D(sourceMap,sourceUv);}';
  function create(name){
    const root=new T.Group();root.name=name;root.userData.neonSourceEffects=true;S.active.add(root);
    const meshes=new Map();
    const update=batches=>{
      const groups=new Map();for(const b of batches){const key=[!!b.opaque,!!b.additive,b.texture??'none'].join(':');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(b);}
      for(const mesh of meshes.values())mesh.visible=false;
      for(const [key,selected] of groups){
        let count=0;for(const b of selected)count+=b.vertices.length/4*6;if(!count)continue;
        const first=selected[0];let mesh=meshes.get(key);
        if(!mesh){const material=new T.ShaderMaterial({vertexShader,fragmentShader,uniforms:{sourceMap:{value:null},textured:{value:first.texture!=null}},transparent:!first.opaque,depthWrite:!!first.opaque,side:T.DoubleSide,blending:first.additive?T.AdditiveBlending:T.NormalBlending});mesh=new T.Mesh(new T.BufferGeometry(),material);mesh.frustumCulled=false;root.add(mesh);meshes.set(key,mesh);}
        mesh.visible=true;if(first.texture!=null)mesh.material.uniforms.sourceMap.value=S.sparkTextures?.[first.texture]||null;
        if(!mesh.geometry.attributes.position||mesh.geometry.attributes.position.count<count){mesh.geometry.dispose();mesh.geometry=new T.BufferGeometry();const capacity=2**Math.ceil(Math.log2(count));mesh.geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(capacity*3),3).setUsage(T.DynamicDrawUsage));mesh.geometry.setAttribute('sourceColor',new T.BufferAttribute(new Float32Array(capacity*4),4).setUsage(T.DynamicDrawUsage));mesh.geometry.setAttribute('uv',new T.BufferAttribute(new Float32Array(capacity*2),2).setUsage(T.DynamicDrawUsage));}
        const p=mesh.geometry.attributes.position,c=mesh.geometry.attributes.sourceColor,uv=mesh.geometry.attributes.uv;let i=0;
        for(const batch of selected)for(let q=0;q<batch.vertices.length;q+=4)for(const j of [0,1,2,0,2,3]){const v=batch.vertices[q+j];p.array.set(v.slice(0,3),i*3);c.array.set(v.slice(3,7),i*4);uv.array.set(v.slice(7,9),i*2);i++;}
        p.needsUpdate=c.needsUpdate=uv.needsUpdate=true;mesh.geometry.setDrawRange(0,i);
      }
    };
    const dispose=()=>{root.removeFromParent();for(const mesh of meshes.values()){mesh.geometry.dispose();mesh.material.dispose();}S.active.delete(root);};
    return {root,update,dispose};
  }
  S.lane=(wall,age=0)=>{const fx=create('neon-fastlane');fx.wall=wall;fx.updateAge=(age,time=age)=>fx.update(NEON_FX_SOURCE.lane(wall,age,time));fx.updateAge(age);return fx;};
  S.bolt=()=>{const fx=create('neon-relaybolt');fx.updateBolt=(point,velocity,time,id)=>fx.update(NEON_FX_SOURCE.bolt({id,x:point.x,y:point.y,z:point.z,vx:velocity.x,vy:velocity.y,vz:velocity.z},time,camera.position));return fx;};
  S.shock=point=>{const fx=create('neon-relay-charge');fx.updateAge=age=>fx.update(NEON_FX_SOURCE.shock(point,age,wallStripes));fx.updateAge(0);return fx;};
  S.preview=orb=>{const fx=create('neon-lane-preview');fx.updateAge=age=>fx.update(NEON_FX_SOURCE.preview(orb,age,(x,z,y)=>groundAt(x,z,y+3)));return fx;};
  // The original's 36 short wall probes, adapted to DFDF's world colliders.
  function wallStripes(cx,cy,cz,radius,alpha){
    const vertices=[];
    for(let i=0;i<36;i++){
      const a=i*Math.PI*2/36,dx=Math.cos(a),dz=Math.sin(a),x=cx+dx*radius,z=cz+dz*radius;let hit=null;
      for(const c of COLLIDERS){
        if(cy+.1<(c.y0||0)||cy+.1>=c.h)continue;
        for(const [axis,face,normal] of [['x',c.minX,-1],['x',c.maxX,1],['z',c.minZ,-1],['z',c.maxZ,1]]){
          const d=axis==='x'?dx:dz;if(Math.abs(d)<1e-8)continue;const t=(face-(axis==='x'?x:z))/d;if(t<0||t>.6||hit&&t>=hit.t)continue;
          const px=x+dx*t,pz=z+dz*t;if(px<c.minX-1e-6||px>c.maxX+1e-6||pz<c.minZ-1e-6||pz>c.maxZ+1e-6)continue;
          hit={t,x:px+(axis==='x'?normal*.005:0),z:pz+(axis==='z'?normal*.005:0),tx:axis==='z'?1:0,tz:axis==='x'?1:0};
        }
      }
      if(hit){const {x,z,tx,tz}=hit;for(const [s,y,opacity] of [[-1,cy+3.6,0],[1,cy+3.6,0],[1,cy+.1,.6*alpha],[-1,cy+.1,.6*alpha]])vertices.push([x+s*tx*.35,y,z+s*tz*.35,.45,.8,1,opacity,0,0]);}
    }
    return [{opaque:false,vertices}];
  }
})();
