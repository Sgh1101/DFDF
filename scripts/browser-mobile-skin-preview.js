const assert=require('node:assert/strict'),fs=require('node:fs'),{fixture}=require('./browser-fixture');
// Explored actual By gun / My skins / Shop / Champions views on a touch phone.
(async()=>{const f=await fixture(),rows=[];fs.mkdirSync('test-results/mobile-preview',{recursive:true});try{
 const p=await f.page('mobilepreview',{width:852,height:393},{isMobile:true,hasTouch:true,deviceScaleFactor:2},{bootTimeout:120000});
 const owner=await f.h.api('auth',{id:'owner',pw:'owner-password',device:'preview-owner'});
 for(const skin of ['champions_atk','champions_def'])await f.h.api('a_user_set',{atoken:owner.atoken,id:'mobilepreview',op:'grant',item:'scout|'+skin});
 await p.evaluate(()=>GUN_SKINS.sync());await p.waitForFunction(()=>VALORANT_PACK.status==='ready'&&CHAMPIONS_PHANTOM.loaded());
 await p.locator('#go-armory').click();await p.locator('#ar-tabs [data-tab="gun"]').click();
 await p.locator('#ar-guns .ar-gun').filter({hasText:/^팬텀/}).click();
 async function check(label,minHeight=110,broadside=true){
  // A rotating barrel seen end-on is naturally thin. Measure size in a fixed
  // broadside pose; the real drag and tilted-tab checks keep their own pose.
  if(broadside)await p.evaluate(()=>{const P=GUN_SKINS._pv();P.auto=false;P.yaw=0;P.pitch=.18;});
  await p.waitForFunction(()=>{const P=GUN_SKINS._pv(),c=document.getElementById('ar-cv');return P?.obj&&Math.abs(P.pc-P.pitch)<.01&&Math.abs(P.d-P.dist)<.025&&c.width===Math.round(c.clientWidth*P.r.getPixelRatio());},null,{timeout:30000});
  const r=await p.evaluate(()=>{
   const P=GUN_SKINS._pv(),cv=P.r.domElement,b=cv.getBoundingClientRect(),cap=document.getElementById('ar-cap'),cb=cap.getBoundingClientRect();
   const hits=[];for(const [x,y] of [[.2,.2],[.5,.2],[.8,.2],[.2,.5],[.5,.5],[.8,.5],[.2,.8],[.5,.8],[.8,.8]]){const e=document.elementFromPoint(b.x+b.width*x,b.y+b.height*y);hits.push(e===cv);}
   P.sc.updateMatrixWorld(true);P.cam.updateMatrixWorld(true);let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,count=0;const v=new T.Vector3();
   P.obj.traverseVisible(n=>{const a=n.geometry?.attributes?.position;if(!a||Math.abs(n.matrixWorld.determinant())<1e-12)return;for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i).applyMatrix4(n.matrixWorld).project(P.cam);if(v.z>1||v.z< -1)continue;count++;minX=Math.min(minX,v.x);maxX=Math.max(maxX,v.x);minY=Math.min(minY,v.y);maxY=Math.max(maxY,v.y);}});
   return {width:b.width,height:b.height,left:b.left,right:b.right,top:b.top,bottom:b.bottom,viewport:[innerWidth,innerHeight],hits,captionVisible:getComputedStyle(cap).display!=='none',captionTop:cb.top,model:{minX,maxX,minY,maxY,count},slot:cv.closest('.ar-slot').id};
  });
  assert.ok(r.width>=180&&r.height>=minHeight,label+' usable canvas '+JSON.stringify(r));
  assert.ok(r.left>=0&&r.top>=0&&r.right<=r.viewport[0]+1&&r.bottom<=r.viewport[1]+1,label+' viewport bounds');
  assert.ok(r.hits.every(Boolean),label+' canvas is not covered by another panel');
  if(r.captionVisible&&r.viewport[1]<=540)assert.ok(r.captionTop>=r.bottom-1,label+' caption below the model');
  assert.ok(r.model.count>0);assert.ok(r.model.minX>=-1.03&&r.model.maxX<=1.03&&r.model.minY>=-1.03&&r.model.maxY<=1.03,label+' full source model fits '+JSON.stringify(r.model));
  if(broadside)assert.ok(Math.max(r.model.maxX-r.model.minX,r.model.maxY-r.model.minY)>.55,label+' model is large enough to inspect');
  rows.push({label,...r});return r;
 }
 for(const [w,h] of [[568,320],[667,375],[740,360],[844,390],[932,430]]){
  await p.setViewportSize({width:w,height:h});
  for(const skin of ['default','snow','champions_atk']){
   await p.locator('#ar-skins [data-s="'+skin+'"]').click();
   await p.waitForFunction(id=>{const n=document.querySelector('#ar-skins [data-s="'+id+'"]');return n&&(n.classList.contains('on')||n.classList.contains('peek'));},skin);
   const r=await check(w+'x'+h+' '+skin);
   await p.locator('#ar-skins').evaluate(n=>n.scrollTop=n.scrollHeight);
   const next=await p.locator('#ar-cv').boundingBox();assert.ok(Math.abs(next.y-r.top)<1,'scrolling skins keeps the turntable fixed');
   if(skin==='champions_atk')await p.screenshot({path:'test-results/mobile-preview/gun-'+w+'.png'});
  }
 }
 await p.setViewportSize({width:568,height:320});
 for(const name of ['오퍼레이터','아웃로','전투 나이프']){
  await p.locator('#ar-guns .ar-gun').filter({hasText:name}).click();
  await p.locator('#ar-skins [data-s="default"]').click();
  await check('small phone '+name);
 }
 const cv=await p.locator('#ar-cv').boundingBox();
 await p.mouse.move(cv.x+cv.width*.35,cv.y+cv.height*.25);await p.mouse.down();
 await p.mouse.move(cv.x+cv.width*.65,cv.y+cv.height*.8,{steps:8});
 await p.waitForFunction(()=>{const P=GUN_SKINS._pv();return P.drag&&P.pc===P.pitch;});
 assert.ok(await p.evaluate(()=>{const P=GUN_SKINS._pv();return Math.abs(P.d-P.dist)<1e-6;}),'dragging fits the current pitch immediately');
 await check('small phone knife during drag',110,false);await p.mouse.up();
 assert.equal(await p.evaluate(()=>GUN_SKINS._pv().auto),false,'dragging controls the source model');
 await check('small phone dragged knife',110,false);
 const dragPitch=await p.evaluate(()=>GUN_SKINS._pv().pitch);
 for(const [width,height] of [[568,320],[844,390]]){
 await p.setViewportSize({width,height});
 for(const tab of ['mine','shop','champions']){
  await p.locator('#ar-tabs [data-tab="'+tab+'"]').click();
  await p.evaluate(pitch=>GUN_SKINS._pv().pitch=pitch,dragPitch);
  if(tab==='mine')await p.locator('#mi-list [data-th="scout|champions_atk"]').click();
  if(tab==='shop'){await p.waitForFunction(()=>document.querySelector('#sh-list [data-th]'));await p.locator('#sh-list [data-th]').first().click();}
  await check(width+' '+tab+' tilted',90,false);
  const r=await check(width+' '+tab+' broadside',90);
  if(tab==='champions'){
   const content=p.locator('#champions-content');await content.evaluate(n=>n.scrollTop=n.scrollHeight);const b=await p.locator('#ar-cv').boundingBox();assert.equal(b.y,r.top,'Champions details scroll independently');
  }
  await p.screenshot({path:'test-results/mobile-preview/'+tab+'-'+width+'.png'});
 }
 }
 await p.locator('#ar-tabs [data-tab="gun"]').click();await p.setViewportSize({width:1280,height:800});await check('desktop',200);
 assert.deepEqual(f.errors,[]);fs.writeFileSync('test-results/mobile-preview/measurements.json',JSON.stringify(rows,null,2));console.log('Mobile skin preview: full model, clear canvas, caption separation, stable scrolling and all tabs',rows.map(r=>({view:r.label,canvas:[Math.round(r.width),Math.round(r.height)]})));
}finally{await f.browser.close();}})().then(()=>process.exit(0),e=>{console.error(e);process.exit(1);});
