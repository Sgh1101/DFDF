(() => {
  'use strict';
  // The JAR's 64x64 PNG contains a complete slim-player skin, although its
  // geometry only defines first-person arms. Reconstruct the skin on DFDF's
  // animated skeleton instead of inventing a separate face, hair and outfit.
  const material=new T.MeshStandardMaterial({alphaTest:.1,roughness:.8});
  material.userData.keep=true;
  const source=window.NEON_SKIN={status:'loading',material};
  function cube(parent,name,size,center,uv,half,layer){
    const [w,h,d]=size,unit=.05625,sourceSize=[w,half?12:h,d];
    const geo={description:{texture_width:64,texture_height:64},bones:[{name,pivot:[0,0,0],cubes:[{origin:[-w/2,-sourceSize[1]/2,-d/2],size:sourceSize,uv}]}]};
    const adapted=NEON_DATA.renderGeometry(geo),c=adapted.bones[0].cubes[0];
    if(half){
      c.origin[1]=-3;c.size[1]=6;
      for(const side of ['east','west','north','south']){c.uv[side].uv[1]+=half==='lower'?6:0;c.uv[side].uv_size[1]=6;}
      // The cut at an elbow/knee has no separate source face. Sample its edge.
      if(half==='lower')c.uv.up={uv:[uv[0]+d,uv[1]+d+6],uv_size:[-w,1]};
      else c.uv.down={uv:[uv[0]+d+w,uv[1]+d+5],uv_size:[-w,1]};
    }
    const rig=BEDROCK_RIG.build(adapted,material),mesh=rig.children[0].children[0];
    mesh.name='neon-source-'+name;mesh.userData.neonSkin=true;mesh.userData.live=true;mesh.userData.baked=true;
    const height=half?(w===3?.28:.41):h*unit;
    mesh.scale.set((w*unit+(layer?.028:0))/w,height/(half?6:sourceSize[1]),(d*unit+(layer?.028:0))/d);
    if(layer)mesh.scale.y+=(.028/(half?6:sourceSize[1]));
    mesh.position.fromArray(center);mesh.castShadow=true;mesh.userData.cast=true;parent.add(mesh);
  }
  function apply(model){
    const gunNodes=new Set();model.gun.traverse(n=>gunNodes.add(n));
    const old=[];model.group.traverse(n=>{if(n.isMesh&&!gunNodes.has(n))old.push(n);});
    for(const mesh of old){mesh.parent.remove(mesh);if(mesh.userData.baked)mesh.geometry.dispose();}
    const add=(parent,name,size,center,uv,overlay,half)=>{
      cube(parent,name,size,center,uv,half,false);cube(parent,name+'-outer',size,center,overlay,half,true);
    };
    add(model.neck,'head',[8,8,8],[0,.22,-.005],[0,0],[32,0]);
    add(model.chest,'body',[8,12,4],[0,.1,0],[16,16],[16,32]);
    for(const [side,arm,leg,armUV,sleeveUV,legUV,pantsUV] of [
      [-1,model.armL,model.legL,[32,48],[48,48],[16,48],[0,48]],
      [1,model.armR,model.legR,[40,16],[40,32],[0,16],[0,32]],
    ]){
      arm.arm.position.x+=side*.084;
      add(arm.arm,'arm-'+side,[3,6,4],[0,-.14,0],armUV,sleeveUV,'upper');
      add(arm.fore,'fore-'+side,[3,6,4],[0,-.14,0],armUV,sleeveUV,'lower');
      add(leg.leg,'thigh-'+side,[4,6,4],[0,-.205,0],legUV,pantsUV,'upper');
      add(leg.shin,'shin-'+side,[4,6,4],[0,-.205,0],legUV,pantsUV,'lower');
    }
    model.group.userData.neonSourceSkin=true;return model;
  }
  const build=buildFighter;
  buildFighter=function(team,agent){const model=build.apply(this,arguments);return agent?.id==='neon_agent'?apply(model):model;};
  const portraits=new Map(),portrait=agentPortrait;let preview;
  agentPortrait=function(agent,width=300,height=380){
    if(agent?.id!=='neon_agent'||source.status!=='ready')return portrait.apply(this,arguments);
    const key=width+'x'+height;if(portraits.has(key))return portraits.get(key);
    if(!preview){
      const renderer=new T.WebGLRenderer({alpha:true,antialias:false,preserveDrawingBuffer:true});renderer.outputColorSpace=T.SRGBColorSpace;
      const scene=new T.Scene();scene.add(new T.HemisphereLight(0xffffff,0xb0bdd6,2));const light=new T.DirectionalLight(0xffffff,2);light.position.set(-2,4,-3);scene.add(light);
      const model=buildFighter(0x41cfff,NEON_AGENT.agent);model.gun.visible=false;
      for(const arm of [model.armL,model.armR]){arm.arm.rotation.set(.08,0,0);arm.fore.rotation.set(0,0,0);}
      scene.add(model.group);preview={renderer,scene};
    }
    const aspect=width/height,camera=new T.OrthographicCamera(-1.3*aspect,1.3*aspect,1.3,-1.3,.1,20);camera.position.set(2,1.8,-4);camera.lookAt(0,1.4,0);
    preview.renderer.setSize(width,height,false);preview.renderer.render(preview.scene,camera);
    const url=preview.renderer.domElement.toDataURL('image/png');portraits.set(key,url);return url;
  };
  NEON_AGENT.assetsReady.then(ready=>{
    if(!ready){source.status='error';return;}
    material.map=NEON_AGENT.sourceSkin();material.needsUpdate=true;source.status='ready';
    const roster=document.getElementById('title-roster');if(roster){GAME_PORTRAITS.clear(roster);roster.innerHTML='';renderTitleRoster();}
    if(document.getElementById('s-select')&&!document.getElementById('s-select').hidden)renderSelect();
  });
})();
