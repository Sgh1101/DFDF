// Review artifact: actual game builders/materials, plus representative first-person views.
const fs=require('node:fs'),path=require('node:path'),{fixture}=require('./browser-fixture');
(async()=>{const f=await fixture(),out=process.env.SHOT_DIR||'test-results/skin-correction/knives';fs.mkdirSync(out,{recursive:true});try{
  const p=await f.page('knifedesigns',{width:1200,height:1000});
  const owner=await f.h.api('auth',{id:'owner',pw:'owner-password',device:'knife-design-owner'});
  for(const id of ['karambit','flip','tanto','kukri','bayonet','gut','bowie','kunai','stiletto'])await f.h.api('a_user_set',{atoken:owner.atoken,id:'knifedesigns',op:'grant',item:'knife|'+id});
  await p.evaluate(()=>GUN_SKINS.sync());
  await p.evaluate(()=>{window.__knifeProofRender=render;render=()=>{};titleCam=()=>{};room.mode='std';room.map='glacier';startGame(AGENTS[0],false);closeShop();world.phase='live';world.roundTime=999;ADMIN.freezeAI=true;player.slot=Object.keys(player.weapons).find(s=>player.weapons[s]==='knife');});
  for(const id of ['default','karambit','flip']){
    await p.evaluate(id=>{GUN_SKINS.set('knife',id);updateViewmodel(true);for(let i=0;i<100;i++)tickViewmodel(.02);followCamera(myActor(),.016);window.__knifeProofRender();},id);
    await p.screenshot({path:path.join(out,id+'-held.png')});
  }
  await p.evaluate(()=>{
    const ids=['stock','karambit','flip','tanto','kukri','bayonet','gut','bowie','kunai','stiletto'];
    const labels=['전투 나이프 · Ridge','카람빗 · Ember','접이식 · Relay','탄토 · Vector','쿠크리 · Canopy','총검 · Rampart','거트 · Briar','보위 · Outrider','쿠나이 · Petal','스틸레토 · Marrow'];
    const cover=document.createElement('div');cover.style.cssText='position:fixed;inset:0;z-index:99999;background:#10151f;color:#eef2f8';document.body.append(cover);
    const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(1200,1000);renderer.setClearColor(0x10151f);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;cover.append(renderer.domElement);renderer.setScissorTest(true);
    ids.forEach((id,i)=>{
      const skin=GUN_SKINS.list.find(s=>s.id===(id==='stock'?'default':id)),obj=GUN_SKINS.buildFor('knife',skin);GUN_SKINS.apply(obj,skin);
      const box=new T.Box3().setFromObject(obj),center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());obj.position.sub(center);
      const sc=new T.Scene();sc.environment=scene.environment;sc.add(obj);sc.add(new T.HemisphereLight(0xe3efff,0x384254,2));
      const light=new T.DirectionalLight(0xfff2d8,4);light.position.set(2,3,-1);sc.add(light);
      const camera=new T.PerspectiveCamera(30,580/154,.01,20),axis=new T.Vector3(3,.6,.8).normalize();let distance=Math.max(size.x,size.y,size.z)*1.4;
      for(let k=0;k<12;k++){
        camera.position.copy(axis).multiplyScalar(distance);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);let fits=true;
        for(const x of [-size.x/2,size.x/2])for(const y of [-size.y/2,size.y/2])for(const z of [-size.z/2,size.z/2]){const v=new T.Vector3(x,y,z).project(camera);fits&&=Math.abs(v.x)<.9&&Math.abs(v.y)<.87;}
        if(fits)break;distance*=1.16;
      }
      const col=i%2,row=Math.floor(i/2),x=col*600+10,y=1000-row*200-192;renderer.setViewport(x,y,580,154);renderer.setScissor(x,y,580,154);renderer.render(sc,camera);
      const text=document.createElement('div');text.textContent=labels[i];text.style.cssText=`position:absolute;left:${col*600+20}px;top:${row*200+12}px;font:600 16px sans-serif;letter-spacing:.4px`;cover.append(text);
    });
    window.__knifeContactSheet=renderer;
  });
  await p.screenshot({path:path.join(out,'native-ten-designs.png')});console.log('Rendered ten native knife designs and three first-person views; page errors',f.errors);
}finally{await f.browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
