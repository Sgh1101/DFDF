const assert=require('node:assert/strict');
const {chromium}=require(process.env.DFDF_PLAYWRIGHT_MODULE || 'playwright');
const {harness}=require('../tests/api-harness');
(async()=>{
 const h=harness(),session=await h.api('auth',{id:'tester',pw:'password',device:'device-123'}),admin=await h.api('auth',{id:'owner',pw:'owner-password',device:'device-456'});
 console.log('grant',await h.api('a_user_set',{atoken:admin.atoken,id:'tester',op:'grant',item:'rifle|dragon'}));
 const browser=await chromium.launch({...(process.env.CHROME_BIN ? {executablePath:process.env.CHROME_BIN}:{}),headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:852,height:393},serviceWorkers:'block'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 // the homepage's notice card (promo film) would cover the sign-out button after sign-in: leave the film out
 await page.route('**/js/promo.js',async route=>{const res=await route.fetch();await route.fulfill({response:res,body:(await res.text()).replace(/video: "https?:[^"]*"/,'video: "PROMO_VIDEO_URL"'),contentType:'text/javascript'});});
 await page.route('**/api/v1?*',async r=>{const a=new URL(r.request().url()).searchParams.get('a'),j=await h.api(a,r.request().postDataJSON()||{});await r.fulfill({status:j.status,contentType:'application/json',body:JSON.stringify(j)});});
 if(process.env.DFDF_THREE_PATH) await page.route('https://cdnjs.cloudflare.com/ajax/libs/three.js/**',r=>r.fulfill({path:process.env.DFDF_THREE_PATH,contentType:'text/javascript'}));
 await page.route('https://fonts.googleapis.com/**',r=>r.abort());await page.route('https://fonts.gstatic.com/**',r=>r.abort());
 await page.addInitScript(s=>{localStorage.setItem('lgp_session',JSON.stringify(s));sessionStorage.setItem('lgp_gate',s.token);const original=requestAnimationFrame;window.requestAnimationFrame=f=>setTimeout(()=>original(f),120);},session);
 await page.goto('' + (process.env.DFDF_BASE_URL || 'http://127.0.0.1:3000') + '/play.html',{waitUntil:'domcontentloaded',timeout:60000});await page.waitForTimeout(1200);
 assert.deepEqual(errors,[]);
 await page.locator('#go-play').click();await page.waitForTimeout(200);assert.equal(await page.locator('#s-select').isVisible(),true);
 console.log('agent selection',await page.evaluate(()=>({height:innerHeight,buttons:document.querySelectorAll('#sel-maps button').length,abilities:document.querySelectorAll('#sel-detail .ab').length})));
 await page.locator('#sel-back').click();await page.locator('#go-armory').click();
 await page.locator('#ar-tabs [data-tab="gun"]').click();await page.waitForTimeout(200);
 await page.locator('#ar-skins [data-s="dragon"]').click();
 assert.match(await page.locator('#skin-sample-label').textContent(),/용|Dragon/);
 await page.locator('[data-sample="shot"]').click();await page.locator('[data-sample="fin"]').click();
 const preview=await page.evaluate(()=>FINISHERS.active.size);assert.equal(preview,1);
 await page.locator('[data-sample="stop"]').click();assert.equal(await page.evaluate(()=>FINISHERS.active.size),0);
 console.log('skin previews passed');
 await page.evaluate(()=>GUN_SKINS.close());
 await page.evaluate(()=>GUN_SKINS.sync());console.log('inventory',await page.evaluate(()=>GUN_SKINS.inv()));
 const kill=await page.evaluate(()=>{
  room.mode='std';startGame(AGENTS[0],false);world.phase='live';
  const a=myActor();const set=GUN_SKINS.set('rifle','dragon');a.invuln=0;a.suppress=0;a.reloading=0;
  a.weapons.primary='rifle';a.slot='primary';a.ammo.rifle=30;a.reserve.rifle=100;a.fireCd=0;a.yaw=0;a.pitch=0;
  const foes=world.actors.filter(x=>x.team!==a.team);for(const x of foes)x.alive=false;
  const victim=foes[0];victim.alive=true;victim.hp=1;victim.armor=0;victim.invuln=0;victim.shielded=0;victim.y=a.y||0;let found=false;
  for(let i=0;i<16;i++){const angle=i*Math.PI/8,dx=Math.sin(angle)*3,dz=Math.cos(angle)*3;
   if(!rayBlocked(a.pos.x,actorEye(a),a.pos.z,a.pos.x+dx,victim.y+1,a.pos.z+dz)&&!collideXZ(a.pos.x+dx,a.pos.z+dz,victim.y+1,.65)){
    victim.pos.set(a.pos.x+dx,victim.y,a.pos.z+dz);a.yaw=Math.atan2(-dx,-dz);a.pitch=Math.atan2(victim.y+1-actorEye(a),3);found=true;break;
   }
  }
  victim.group.position.copy(victim.pos);scene.updateMatrixWorld(true);
  actorFire(a);
  return {dead:!victim.alive,active:FINISHERS.active.size,skin:GUN_SKINS.of('rifle').id,phase:world.phase,set,weapon:actorWeaponKey(a),ammo:a.ammo.rifle,alive:a.alive,found,eye:actorEye(a),pitch:a.pitch,targetHP:victim.hp,targetTeam:victim.team,team:a.team};
 });console.log('standard last kill',kill);assert.equal(kill.dead,true);assert.equal(kill.active,1);
 const controls=await page.evaluate(()=>{const before=player.alive;FINISHERS.clear();return {before,after:player.alive,active:FINISHERS.active.size};});assert.equal(controls.before,controls.after);assert.equal(controls.active,0);
 const invalid=await page.evaluate(()=>{const a=myActor(),before=a.input.seq;NET.onInput(a.ctrl,{seq:before+1,mv:null,yaw:NaN,pitch:Infinity,btn:0});return a.input.seq===before;});assert.equal(invalid,true);
 h.advance(61000);await page.evaluate(()=>gameOver());await page.waitForTimeout(500);
 const result=await page.evaluate(()=>window.LAST_MATCH);console.log('result',result.outcome,result.k);
 await page.goto('' + (process.env.DFDF_BASE_URL || 'http://127.0.0.1:3000') + '/' ,{waitUntil:'domcontentloaded'});await page.waitForTimeout(400);await page.locator('#logout').click();assert.equal(await page.locator('#hist').isVisible(),false);
 assert.deepEqual(errors,[]);console.log('all browser flow checks passed');
 await browser.close();
})();
