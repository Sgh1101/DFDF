// Authored after exploring the actual Champions menu in test:phantom.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{fixture}=require('./browser-fixture');
(async()=>{
 const f=await fixture(),out=process.env.SHOT_DIR||'test-results/champions-concept/proof',rows=[];fs.mkdirSync(out,{recursive:true});
 try{
  for(const [label,width,height,touch] of [['desktop',1280,800,false],['phone',844,390,true]]){
   const id='concept'+label,p=await f.page(id,{width,height},touch?{isMobile:true,hasTouch:true}:{},{bootTimeout:120000});
   await p.waitForFunction(()=>CHAMPIONS_PHANTOM.loaded());
   const owner=await f.h.api('auth',{id:'owner',pw:'owner-password',device:'concept-owner'});
   for(const s of ['champions_atk','champions_def'])await f.h.api('a_user_set',{atoken:owner.atoken,id,op:'grant',item:'scout|'+s});
   await p.evaluate(()=>GUN_SKINS.sync());
   await p.locator('#go-armory').click();await p.locator('#ar-tabs [data-tab="champions"]').click();
   for(const [skin,side] of [['champions_atk','attacker'],['champions_def','defender']]){
    await p.locator('[data-phantom-skin="'+skin+'"]').click();
    await p.waitForFunction(side=>{const rig=GUN_SKINS._pv()?.obj?.getObjectByName('phantom-rig');let ok=!!rig;rig?.traverse(n=>{if(n.isMesh)ok&&=n.material.map?.name.includes('phantom_'+side+'.png')&&n.material.map.image.complete;});return ok;},side);
    await p.evaluate(()=>{const P=GUN_SKINS._pv();P.auto=false;P.yaw=Math.PI-.53;P.pitch=.12;});
    await p.waitForFunction(()=>{const P=GUN_SKINS._pv(),c=document.getElementById('ar-cv');return (!P.popT||performance.now()-P.popT>600)&&Math.abs(P.pc-P.pitch)<.005&&Math.abs(P.d-P.dist)<.01&&c.width===Math.round(c.clientWidth*P.r.getPixelRatio());});
    const info=await p.evaluate(()=>{
     const P=GUN_SKINS._pv();P.r.render(P.sc,P.cam);const gl=P.r.getContext(),s=P.r.getDrawingBufferSize(new T.Vector2()),bytes=new Uint8Array(s.x*s.y*4);gl.readPixels(0,0,s.x,s.y,gl.RGBA,gl.UNSIGNED_BYTE,bytes);
     let count=0,red=0,light=0,luminance=0;for(let i=0;i<bytes.length;i+=4){if(bytes[i+3]<128)continue;const [r,g,b]=bytes.slice(i,i+3);count++;luminance+=(r+g+b)/3;if(r>g*1.5&&b>g*1.15&&r>b*1.08&&r>20)red++;if(Math.min(r,g,b)>80&&Math.max(r,g,b)-Math.min(r,g,b)<35)light++;}
     let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,verts=0;P.sc.updateMatrixWorld(true);P.cam.updateMatrixWorld(true);const v=new T.Vector3();
     P.obj.getObjectByName('phantom-rig').traverse(n=>{const a=n.geometry?.attributes.position;if(!a)return;verts+=a.count;for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i).applyMatrix4(n.matrixWorld).project(P.cam);minX=Math.min(minX,v.x);maxX=Math.max(maxX,v.x);minY=Math.min(minY,v.y);maxY=Math.max(maxY,v.y);}});
     return {count,red:red/count,light:light/count,luminance:luminance/count,verts,minX,maxX,minY,maxY,gl:gl.getError()};
    });
    console.log(label,side,JSON.stringify(info));rows.push({label,side,...info});
    assert.equal(info.gl,0);assert.ok(info.count>500);assert.ok(info.minX>=-1.02&&info.maxX<=1.02&&info.minY>=-1.02&&info.maxY<=1.02,'the complete gun fits');
    await p.locator('#ar-cv').screenshot({path:path.join(out,label+'-'+side+'-model.png')});
    await p.screenshot({path:path.join(out,label+'-'+side+'-ui.png')});
    const movement=await p.evaluate(()=>{const obj=GUN_SKINS._pv().obj,mag=obj.getObjectByName('phantom-bone-magazine'),bolt=obj.getObjectByName('phantom-bone-bolt');CHAMPIONS_PHANTOM.pose(obj,'idle',0);const a=mag.position.clone(),b=bolt.position.clone();CHAMPIONS_PHANTOM.pose(obj,'reload_tactical',.85);const reload=a.distanceTo(mag.position);CHAMPIONS_PHANTOM.pose(obj,'shoot',.04);const shoot=b.distanceTo(bolt.position);CHAMPIONS_PHANTOM.pose(obj,'inspect',3);const inspect=[...mag.position.toArray(),...mag.quaternion.toArray()].every(Number.isFinite);CHAMPIONS_PHANTOM.pose(obj,'idle',0);return{reload,shoot,inspect};});
    assert.ok(movement.reload>1);assert.ok(movement.shoot>1);assert.ok(movement.inspect);
   }
   const [atk,def]=rows.filter(r=>r.label===label);assert.ok(atk.red>def.red+.005,'attack keeps its crimson body distinct from ivory');assert.ok(def.light>atk.light+.12,'the ivory panels remain distinct from gold');assert.ok(def.luminance>atk.luminance*1.1,'defense remains visibly lighter');
   await p.evaluate(()=>{GUN_SKINS.close();titleCam=()=>{};room.mode='std';room.map='field';startGame(AGENTS[0],false);closeShop();ADMIN.freezeAI=true;world.phase='live';const a=myActor();a.weapons.primary='scout';a.slot='primary';GUN_SKINS.set('scout','champions_atk');followCamera(a,.016);tickViewmodel(.016);});
   await p.waitForFunction(()=>!!VM.current.getObjectByName('phantom-rig'));
   await p.screenshot({path:path.join(out,label+'-first-person.png')});
   await p.context().close();
  }
  assert.deepEqual(f.errors,[]);console.log('Concept: both variant textures, fixed-pose colors, full framing, native reload/shoot/inspect and first-person rig passed');
 }finally{fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify(rows,null,2));await f.browser.close();}
})().then(()=>process.exit(0),e=>{console.error(e);process.exit(1);});
