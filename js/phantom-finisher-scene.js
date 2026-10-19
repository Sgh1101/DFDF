// The supplied finisher's star dome, hourglass and gold player statues.
(() => {
  const clamp=n=>Math.max(0,Math.min(1,n)), ease=n=>(n=clamp(n))*n*(3-2*n);
  let view=null;
  const follow=followCamera;
  followCamera=function(actor,dt){
    const r=follow.apply(this,arguments);
    if(!view||actor.id!==view.killer||world.phase!=='end'||!actor.alive)return r;
    const age=(performance.now()-view.started)/1000;if(age>=8){view=null;document.body.classList.remove('champions-finishing');return r;}
    const k=ease((age-2.25)/.6);if(!k)return r;
    const {center,bounds,direction}=view,half=Math.tan(camera.fov*Math.PI/360),out=direction.clone();out.y=.08;out.normalize();
    const right=new T.Vector3(0,1,0).cross(out).normalize(),up=out.clone().cross(right).normalize();let distance=0;
    for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
      const v=new T.Vector3(x,y,z).sub(center),depth=v.dot(out);distance=Math.max(distance,depth+Math.abs(v.dot(up))/(half*.83),depth+Math.abs(v.dot(right))/(half*camera.aspect*.83));
    }
    const position=center.clone().addScaledVector(out,distance);
    const rotation=camera.quaternion.clone(),target=new T.Object3D();target.position.copy(position);target.lookAt(center);target.rotateY(Math.PI);
    camera.position.lerp(position,k);camera.quaternion.slerpQuaternions(rotation,target.quaternion,k);camera.updateMatrixWorld();
    return r;
  };
  function gold(original){
    const mat=new T.MeshBasicMaterial({map:original.map||null,color:original.color||0xffffff,transparent:true,depthWrite:true,alphaTest:.1,side:T.DoubleSide});
    mat.onBeforeCompile=s=>{
      s.vertexShader='varying vec3 phNormal;varying vec3 phView;\n'+s.vertexShader.replace('void main() {','void main() {\nphNormal=normalize(normalMatrix*normal);phView=-(modelViewMatrix*vec4(position,1.)).xyz;');
      s.fragmentShader='varying vec3 phNormal;varying vec3 phView;\n'+s.fragmentShader.replace('#include <opaque_fragment>',`#include <opaque_fragment>
      float l=clamp(dot(diffuseColor.rgb,vec3(.299,.587,.114))*1.25+.15,0.,1.);
      float s=min(floor(l*5.)/4.,1.);vec3 base=s<.5?mix(vec3(.48,.3,.06),vec3(.83,.61,.13),s*2.):mix(vec3(.83,.61,.13),vec3(1.,.9,.54),(s-.5)*2.);
      vec3 N=normalize(phNormal),V=normalize(phView),R=reflect(-V,N),up=normalize(mat3(viewMatrix)*vec3(0.,1.,0.));float ry=dot(R,up);
      float env=ry>=0.?mix(.8,1.35,smoothstep(.05,.7,ry)):mix(.8,.42,smoothstep(0.,.45,-ry));env*=1.-.35*exp(-pow((ry+.12)/.1,2.));
      vec3 L0=normalize(vec3(.2,1.,-.7)),L1=normalize(vec3(-.2,1.,.7));float lightF=min(1.,.4+.6*(max(0.,dot(N,L0))+max(0.,dot(N,L1))));
      float spec=pow(max(dot(R,L0),0.),32.)*.85+pow(max(dot(R,L1),0.),32.)*.35;float fres=pow(1.-clamp(dot(N,V),0.,1.),4.)*.3;
      gl_FragColor.rgb=base*(.45+.55*lightF)*env+vec3(1.,.92,.65)*(spec+fres);`);
    };mat.customProgramCacheKey=()=> 'champions-source-gold-statue-v1';return mat;
  }
  const poses={killer:[-.1329,.1123,-.5166,-.3771,0,0,-.7608,-.8902,.152,-1.8313,-.709,.933,-1.4633,0,0,-1.8067,.7346,.7958,-1.1177,0,0,-.181,-.0539,.0396,1.1281,0,0,-1.9105,-.0817,-.0286,2.2177,0,0],victim:[.3,0,0,.34,0,0,.32,0,0,4.5156,0,-.7884,-.28,0,0,-1.3616,0,-1.2352,-.28,0,0,-.8929,0,.1605,.75,0,0,-.521,0,-.1399,.4,0,0]};
  function statue(actor,position,rotation,stage,pose){
    if(!actor?.group)return null;
    const copy=actor.group.clone(true),holder=new T.Group(),nodes=new Map();
    const pair=(a,b)=>{nodes.set(a,b);a.children.forEach((c,i)=>pair(c,b.children[i]));};pair(actor.group,copy);
    holder.name='champions-gold-'+actor.id;holder.position.fromArray(position);holder.rotation.y=rotation;holder.scale.setScalar(2.4*1.8/(2.1*BODY_K));holder.add(copy);copy.position.set(0,0,0);copy.rotation.set(0,0,0);copy.scale.setScalar(1);copy.visible=true;
    const m=actor.model||{},targets=[m.root||actor.group,m.chest,m.neck,m.armR?.arm,m.armR?.fore,m.armL?.arm,m.armL?.fore,m.legR?.leg,m.legR?.shin,m.legL?.leg,m.legL?.shin].map(n=>nodes.get(n));
    holder.userData.poseStep=k=>targets.forEach((n,i)=>{if(n)n.rotation.set(...pose.slice(i*3,i*3+3).map(v=>v*k),'ZYX');});holder.userData.poseStep(1);
    const sprites=[];copy.traverse(p=>{if(p.isSprite||p.isLight){sprites.push(p);return;}p.userData={...p.userData,phantom:true};if(p.isMesh){p.geometry=p.geometry.clone();p.material=gold(Array.isArray(p.material)?p.material[0]:p.material);p.renderOrder=852;}});sprites.forEach(p=>p.removeFromParent());
    stage.add(holder);return holder;
  }
  function create(group,figure,texture,event,attacker){
    const preview=event.x==null,studio=preview?GUN_SKINS._pv():null,sc=studio?studio.sc:scene;
    const stars=texture('textures/finisher/fx/sky_stars.png').clone();stars.wrapS=stars.wrapT=T.RepeatWrapping;stars.repeat.set(10,5);stars.needsUpdate=true;
    // Blend in the opaque pass, after the world but before the opaque hands/gun.
    // A transparent dome would paint over the first-person weapon afterwards.
    const sky=new T.Mesh(new T.SphereGeometry(1,32,16),new T.ShaderMaterial({uniforms:{stars:{value:stars},alpha:{value:0}},vertexShader:'varying vec2 starUv;void main(){starUv=uv*vec2(10.,5.);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform sampler2D stars;uniform float alpha;varying vec2 starUv;void main(){vec4 s=texture2D(stars,starUv);gl_FragColor=vec4(s.rgb*s.a,alpha);}',side:T.BackSide,transparent:false,blending:T.CustomBlending,blendSrc:T.SrcAlphaFactor,blendDst:T.OneMinusSrcAlphaFactor,blendSrcAlpha:T.OneFactor,blendDstAlpha:T.OneMinusSrcAlphaFactor,depthWrite:false,depthTest:false,toneMapped:false}));
    sky.name='champions-original-star-dome';sky.frustumCulled=false;sky.renderOrder=800;sky.visible=false;sc.add(sky);
    sky.onBeforeRender=(r,s,cam)=>{sky.position.copy(cam.position);sky.scale.setScalar(cam.far*.95);sky.updateMatrixWorld();};sky.onAfterRender=r=>r.clearDepth();
    const stage=new T.Group();stage.name='champions-original-trophy-stage';stage.scale.setScalar(1.25);stage.position.y=4.15*(1-1.25);figure.add(stage);
    const trophy=new T.Group();trophy.name='champions-original-hourglass';trophy.position.set(.1846,12.1377,-.0086);trophy.rotation.z=40*Math.PI/180;stage.add(trophy);
    const trophyMat=new T.MeshPhongMaterial({color:0xffdb5c,emissive:0xb78c18,emissiveIntensity:.25,shininess:80,side:T.DoubleSide,transparent:true});
    for(const side of [-1,1]){const cone=new T.Mesh(new T.CylinderGeometry(1.09,.12,1.875,40,6,true),trophyMat);cone.position.y=side*1.875/2;if(side<0)cone.rotation.z=Math.PI;cone.renderOrder=853;trophy.add(cone);}
    const killer=statue(actorById(event.killer)||myActor(),[-.273,4.4031,.3566],0,stage,poses.killer),victim=statue(actorById(event.victim),[2.2667,13.5916,-.5551],-35*Math.PI/180,stage,poses.victim);
    figure.traverse(p=>{if(p.isMesh)p.renderOrder=Math.max(p.renderOrder,850);});
    if(!preview&&event.killer===myActor()?.id){
      group.updateWorldMatrix(true,true);const bounds=new T.Box3().setFromObject(figure),center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3()),direction=camera.position.clone().sub(center);direction.y=0;direction.normalize();
      view={killer:event.killer,started:performance.now(),center,size,bounds,direction,group};
      document.body.classList.add('champions-finishing');
    }
    const dispose=()=>{if(view?.group===group){view=null;document.body.classList.remove('champions-finishing');}sc.remove(sky);sky.geometry.dispose();sky.material.dispose();stars.dispose();};
    return {dispose,step(t){
      const fade=1-clamp(t-7),dark=ease((t-2.8)/.5)*fade;sky.visible=dark>.001;sky.material.uniforms.alpha.value=dark;
      trophyMat.opacity=fade;trophyMat.emissiveIntensity=.25+.5*PHANTOM_FINISHER_MOTION.pulse(t);
      if(victim){const age=Math.max(0,t-2.66),k=age>=.13?1:1+2*Math.pow(age/.13-1,3)+Math.pow(age/.13-1,2);victim.userData.poseStep(k);victim.position.y=13.5916+.3*(1-Math.exp(-age/6));}
      stage.traverse(p=>{if(p.isMesh&&p.material!==trophyMat)p.material.opacity=fade;});
      group.userData.starOpacity=dark;
    }};
  }
  window.PHANTOM_FINISHER_SCENE={create};
})();
