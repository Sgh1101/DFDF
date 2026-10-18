const assert=require('node:assert/strict'),{fixture}=require('./browser-fixture');
// The existing buy-phase shop and the new category/model paths were explored
// in Chromium before writing these interaction checks.
(async()=>{const f=await fixture();try{
 const p=await f.page('equipmentbuyer',{width:1440,height:900},{},{bootTimeout:120000});
 await p.waitForFunction(()=>VALORANT_PACK.status==='ready',null,{timeout:120000});
 const owner=await f.h.api('auth',{id:'owner',pw:'owner-password',device:'equipment-owner'});
 await f.h.api('a_user_set',{atoken:owner.atoken,id:'equipmentbuyer',op:'grant',item:'carbine|champions_atk'});
 await p.evaluate(async()=>{await GUN_SKINS.sync();room.map='pogu';startGame(AGENTS[0],true);ADMIN.freezeAI=true;world.phase='buy';world.roundTime=999;const a=myActor();a.credits=10000;a.abilities[0].charges=0;openShop();});
 await p.waitForFunction(()=>document.querySelectorAll('#shop-grid .buy-gun-image[src]').length===17,null,{timeout:120000});
 assert.equal(await p.locator('#shop-grid [data-kind="weapon"]').count(),17);
 const catalog=await p.evaluate(()=>({keys:Object.keys(WEAPONS),profiles:Object.fromEntries(Object.keys(VALORANT_DATA.names).map(k=>[k,VALORANT_DATA.profiles[k]]))}));
 assert.equal(catalog.keys.length,18);for(const key of ['machpist','whisper','burst','shotgun','scout'])assert.ok(catalog.keys.includes(key));for(const key of Object.keys(catalog.profiles))assert.ok(catalog.keys.includes(key));
 assert.deepEqual(await p.evaluate(()=>[...document.querySelectorAll('#shop-grid .buy-group')].map(g=>g.querySelectorAll('[data-kind="weapon"]').length)),[5,2,2,4,2,2,0]);
 const filled=async()=>p.evaluate(()=>[...document.querySelectorAll('#shop-grid .shop-col')].map(c=>{const r=c.getBoundingClientRect(),last=c.lastElementChild.getBoundingClientRect();return Math.abs(r.bottom-last.bottom)<2;}));
 assert.ok((await filled()).every(Boolean),'desktop categories fill the available column height');
 const carbine=p.locator('#shop-grid [data-kind="weapon"][data-key="carbine"]');
 await carbine.hover();await p.waitForFunction(()=>document.getElementById('buy-name').textContent==='팬텀');
 assert.ok(await p.evaluate(()=>{let found=false;WEAPON_SHOP.preview().obj.traverse(n=>{if(n.userData.valorantItem==='phantom')found=true;});return found;}),'detail uses the actual supplied Phantom');
 const cost=await p.evaluate(()=>WEAPONS.carbine.cost);await carbine.click();
 assert.deepEqual(await p.evaluate(()=>({key:myActor().weapons.primary,credits:myActor().credits})),{key:'carbine',credits:10000-cost});
 await p.locator('#shop-grid [data-key="carbine"]').click({force:true});assert.equal(await p.evaluate(()=>myActor().credits),10000-cost,'owned gun cannot be charged twice');
 await p.evaluate(()=>{GUN_SKINS.set('carbine','champions_atk');renderShop();});await carbine.hover();
 await p.waitForFunction(()=>document.getElementById('buy-preview').dataset.skin==='champions_atk');
 assert.ok(await p.evaluate(()=>!!WEAPON_SHOP.preview().obj.getObjectByName('phantom-rig')),'Champions keeps its original carbine model');
 await p.screenshot({path:'test-results/weapon-shop-desktop.png'});
 await p.locator('#shop-grid [data-kind="armor"][data-key="heavy"]').click();assert.equal(await p.evaluate(()=>myActor().armor),50);
 const protectedCredits=await p.evaluate(()=>myActor().credits);await p.locator('#shop-grid [data-kind="armor"][data-key="light"]').click({force:true});assert.equal(await p.evaluate(()=>myActor().credits),protectedCredits,'lower armor cannot replace or charge over heavy armor');
 for(let i=0;i<3;i++)await p.locator('#buy-utility [data-kind="nade"]').click({force:true});
 assert.deepEqual(await p.evaluate(()=>({n:myActor().nades,credits:myActor().credits})),{n:2,credits:protectedCredits-600});
 const ability=await p.evaluate(()=>({cost:myActor().abilities[0].def.cost,credits:myActor().credits}));
 await p.locator('#buy-utility [data-kind="ability"][data-key="0"]').click();assert.deepEqual(await p.evaluate(()=>({count:myActor().abilities[0].charges,credits:myActor().credits})),{count:1,credits:ability.credits-ability.cost});
 await p.evaluate(()=>{myActor().credits=0;renderShop();});await p.locator('#shop-grid [data-key="sniper"]').hover();assert.ok(await p.locator('#buy-purchase').isDisabled());assert.match(await p.locator('#buy-why').innerText(),/부족/);await p.locator('#shop-grid [data-key="sniper"]').click({force:true});assert.equal(await p.evaluate(()=>myActor().weapons.primary),'carbine');
 const client=await p.evaluate(()=>{const a=myActor();a.credits=5000;const mode=NET.mode,send=sendAction;NET.mode='client';const packets=[];sendAction=x=>packets.push(x);renderShop();const b=document.querySelector('#shop-grid [data-key="rifle"]');b.click();document.querySelector('#shop-grid [data-key="rifle"]').click();NET.mode=mode;sendAction=send;return{packets,credits:a.credits,weapon:a.weapons.primary};});
 assert.deepEqual(client,{packets:[{t:'buy',kind:'weapon',key:'rifle'}],credits:5000,weapon:'carbine'},'client sends one existing host action, blocks repeats while waiting, and makes no local charge');
 await p.evaluate(()=>{myActor().credits=5000;renderShop();closeShop();openShop();});
 for(const viewport of [{width:844,height:390},{width:390,height:844}]){
  await p.setViewportSize(viewport);await p.locator('#shop-grid [data-key="carbine"]').focus();
  await p.waitForFunction(()=>{const c=document.getElementById('buy-canvas'),r=c.getBoundingClientRect();return Math.abs(c.width-r.width*Math.min(devicePixelRatio||1,2))<3;});
  const boxes=await p.evaluate(()=>{const ids=['shop','shop-grid','buy-detail','shop-close'];return Object.fromEntries(ids.map(id=>{const r=document.getElementById(id).getBoundingClientRect();return[id,{x:r.x,right:r.right,width:r.width,height:r.height}];}));});
  for(const [id,r]of Object.entries(boxes))assert.ok(r.x>=-1&&r.right<=viewport.width+1&&r.width>0&&r.height>0,id+' fits '+JSON.stringify(viewport));
  if(viewport.width>600){assert.ok((await filled()).every(Boolean),'landscape categories fill the available column height');const button=await p.locator('#buy-purchase').boundingBox();assert.ok(button.y+button.height<=viewport.height-35,'purchase stays above footer in landscape');assert.ok(await p.locator('#shop-close').isVisible());await p.screenshot({path:'test-results/weapon-shop-landscape.png'});}else await p.screenshot({path:'test-results/weapon-shop-portrait.png',fullPage:true});
 }
 await p.setViewportSize({width:1280,height:800});await p.evaluate(()=>{world.phase='live';renderShop();});await p.locator('#shop-grid [data-key="rifle"]').hover();assert.ok(await p.locator('#buy-purchase').isDisabled());
 await p.locator('#shop-close').click();assert.ok(await p.locator('#shop').isHidden());assert.deepEqual(f.errors,[]);
 console.log('Equipment shop: 17 gun cards plus the separate knife, supplied/carbine models, purchases and credit gates, armor/nade/ability limits, host action, landscape/portrait layout and close passed. Match purchases use the in-memory fixture; no store payment.');
}finally{await f.browser.close();}})().then(()=>process.exit(0),e=>{console.error(e);process.exit(1);});
