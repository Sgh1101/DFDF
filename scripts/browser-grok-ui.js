const assert = require('node:assert/strict'), fs = require('node:fs');
const { fixture } = require('./browser-fixture');
const out = 'test-results/grok-ui-20261103';
const visible = (p, id) => p.waitForFunction(id => { const e=document.getElementById(id); return e && !e.hidden && !!e.getClientRects().length; }, id);
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const f = await fixture();
  try {
    f.h.config.game.announcement = 'Multiplayer is in beta. Performance is still being improved.';
    const guest = await f.h.api('guest', { device: 'grok-ui-regression' });
    const p = await f.page('grokuitest', { width:1280, height:700 }, {}, { quality:'perf', beforeLoad: p => p.addInitScript(s => {
      if (!sessionStorage.getItem('guest-regression-seeded')) {
        localStorage.setItem('lgp_lang','en');localStorage.setItem('lgp_session',JSON.stringify(s));sessionStorage.setItem('lgp_gate',s.token);sessionStorage.setItem('guest-regression-seeded','1');
      }
    }, guest) });
    p.setDefaultTimeout(30000);
    const practice = p.locator('.home-practice:not(.home-more)');
    await practice.locator('summary').click();await p.keyboard.press('Escape');
    assert.equal(await practice.evaluate(e=>e.open),false,'Escape closes Practice');
    await practice.locator('summary').click();await p.locator('#go-multi').click();
    assert.equal(await practice.evaluate(e=>e.open),false,'outside navigation closes Practice');
    await p.evaluate(()=>show('s-title'));
    console.log('menus passed');
    await p.locator('#go-signin').click();await visible(p,'acct-gate');
    assert.equal(await p.locator('#ag-id').inputValue(),'','guest handle is not prefilled as a new account ID');
    await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.getElementById('acct-gate'));
    assert.equal(await p.evaluate(()=>ACCOUNT.session().token),guest.token,'cancelling sign-in preserves the guest');
    console.log('cancel passed');
    for (const height of [680,700,720]) {
      await p.setViewportSize({ width:1280,height });
      console.log('height',height);
      await p.locator('#go-play').click();await visible(p,'sel-detail');
      assert.equal(await p.locator('#acct-notice').isVisible(),false,'announcement stays on home');
      const ultimate=p.locator('#sel-detail .ab').last();await ultimate.scrollIntoViewIfNeeded();
      const a=await ultimate.boundingBox(),foot=await p.locator('.sel-foot').boundingBox();
      assert(a.y>=0 && a.y+a.height<=foot.y+1,'ultimate is fully reachable above footer');
      await p.locator('#sel-pick').click();await p.waitForFunction(()=>document.getElementById('sel-pick').getAttribute('aria-expanded')==='true');
      const lastMap=p.locator('#sel-maps .lb-map').last();await lastMap.scrollIntoViewIfNeeded();
      const m=await lastMap.boundingBox();assert(m.x>=0&&m.x+m.width<=1281&&m.y+m.height<=foot.y,'last map is reachable');
      assert.equal(await lastMap.evaluate(e=>e.scrollWidth>e.clientWidth),false,'map text is not clipped');
      await p.screenshot({path:`${out}/fixed-selection-${height}.png`});
      await p.keyboard.press('Escape');await p.locator('#sel-back').click();
      await p.locator('#go-set').click();await visible(p,'pause');
      await p.locator('.pz-card').evaluate(e=>Promise.all(e.getAnimations().map(a=>a.finished)));
      const sizes=[];
      for (const tab of ['ctl','gfx','snd','keys']) {
        await p.locator(`.pz-tabs [data-tab="${tab}"]`).click();sizes.push(await p.locator('.pz-card').boundingBox());
      }
      assert(Math.max(...sizes.map(r=>r.height))-Math.min(...sizes.map(r=>r.height))<2,'settings height stays stable');
      assert.equal(await p.locator('#acct-notice').isVisible(),true,'home notice exists behind settings');
      assert.equal(await p.evaluate(()=>{const e=document.querySelector('.pz-card'),r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true,'settings are above the home');
      await p.locator('.pz-pane.on').evaluate(e=>Promise.all(e.getAnimations().map(a=>a.finished)));
      await p.screenshot({path:`${out}/fixed-settings-${height}.png`});await p.keyboard.press('Escape');
    }
    await p.locator('#acct-chip').waitFor();assert.match(await p.locator('#acct-chip').getAttribute('href'),/#records-stats$/);
    await p.locator('#go-ranks').click();await p.locator('[data-tab="clan"]').click();
    assert.doesNotMatch(await p.locator('#lbd-me').innerText(),/Only signed-in accounts are ranked/);
    await p.locator('#lbd-back').click();
    await p.locator('#go-set').click();await visible(p,'pause');
    await p.locator('#pz-armory').click();await visible(p,'armory');
    await p.locator('#ar-tabs [data-tab="pull"]').click();
    assert.match(await p.locator('#ar-odds').innerText(),/0\.00000000000000001%/);
    assert.equal(await p.locator('#ar-odds i').evaluateAll(es=>es.every(e=>getComputedStyle(e).whiteSpace==='nowrap')),true);
    await p.screenshot({path:`${out}/fixed-armory.png`});await p.locator('#ar-close').click();await p.keyboard.press('Escape');
    // Home page auth is the same real guest session, without a logout first.
    const base=new URL(p.url()).origin;
    await p.goto(base+'/');await visible(p,'v-dash');
    if (await p.locator('#np-back:not([hidden])').count()) await p.locator('#np .np-x').click();
    await p.locator('#guestSignIn').click();await visible(p,'v-auth');
    await p.locator('#authBack').click();await visible(p,'v-dash');
    assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('lgp_session')).token),guest.token);
    assert.match(await p.locator('#feat').innerText(),/21 permanent maps/);
    assert.match(await p.locator('#feat').innerText(),/601 collectible items/);
    await p.goto(base+'/play.html');await p.waitForFunction(()=>window.GAME_BOOT&&!document.documentElement.dataset.gameLoading);
    await p.setViewportSize({width:852,height:393});
    await p.locator('#go-signin').click();await visible(p,'acct-gate');await p.locator('#ag-cancel').click();
    await p.locator('#go-play').click();await p.locator('#sel-detail .ab').last().scrollIntoViewIfNeeded();
    const phoneUltimate=await p.locator('#sel-detail .ab').last().boundingBox(),phoneFooter=await p.locator('.sel-foot').boundingBox(),phoneDetail=await p.locator('#sel-detail').boundingBox();
    // On a short phone the detail column extends beside the left-hand footer.
    assert(phoneUltimate.y>=phoneDetail.y&&phoneUltimate.y+phoneUltimate.height<=phoneDetail.y+phoneDetail.height+1);
    assert(phoneUltimate.x>=phoneFooter.x+phoneFooter.width||phoneUltimate.y+phoneUltimate.height<=phoneFooter.y+1);
    await p.locator('#sel-pick').click();await p.locator('#sel-maps .lb-map').last().scrollIntoViewIfNeeded();
    assert.equal(await p.locator('#sel-maps').evaluate(e=>e.scrollWidth>e.clientWidth),false,'phone map list stays within its sheet');
    await p.screenshot({path:`${out}/fixed-phone-maps.png`});await p.keyboard.press('Escape');await p.locator('#sel-back').click();
    await p.setViewportSize({width:1280,height:700});
    // Fill the scoreboard with genuine local kills, rather than just asserting static row markup.
    await p.evaluate(()=>{room.map='pogu';startGame(AGENTS[0],true);ADMIN.freezeAI=true;world.phase='buy';world.roundTime=999;myActor().credits=10000;openShop();});
    await p.locator('[data-kind="armor"][data-key="heavy"]').click();
    await p.waitForFunction(()=>myActor().armor===50&&document.querySelector('[data-key="heavy"]')?.innerText.includes('Owned'));
    assert.match(await p.locator('[data-kind="armor"][data-key="light"]').innerText(),/Higher armor equipped/);
    assert.doesNotMatch(await p.locator('[data-kind="armor"][data-key="light"]').innerText(),/Owned/);
    await p.evaluate(()=>{closeShop();world.phase='live';const attacker=world.actors.find(a=>a!==myActor()&&a.team===myActor().team),victim=world.actors.find(a=>a.team!==attacker.team);killActor(victim,attacker);QOL.openBoard('sb',true);});
    await visible(p,'board');
    const stats=await p.evaluate(()=>({actors:world.actors.length,rows:document.querySelectorAll('#bd-body .bd-row:not(.hd)').length,others:[...document.querySelectorAll('#bd-body .bd-row:not(.hd):not(.me)')].map(e=>[...e.querySelectorAll('.n')].slice(0,2).map(n=>Number(n.textContent)))}));
    assert.equal(stats.rows,stats.actors);assert(stats.others.some(([k,d])=>k>0||d>0),'other players have K/D');
    await p.evaluate(()=>{QOL.closeBoard();world.phase='buy';world.roundTime=999;});
    await p.waitForFunction(()=>document.getElementById('tips').classList.contains('show')&&getComputedStyle(document.getElementById('tips')).opacity==='1');
    await p.waitForFunction(()=>{const g=document.getElementById('mini-set');return !g.hidden&&g.getBoundingClientRect().top>0;});
    const hud=await p.evaluate(()=>{const r=id=>{const a=document.getElementById(id).getBoundingClientRect();return {top:a.top,bottom:a.bottom};};return{tips:r('tips'),vitals:r('vitals'),gear:r('mini-set'),feed:r('klog')};});
    assert(hud.vitals.top-hud.tips.bottom>=12,'hints have a clear gap above health');assert(hud.feed.top-hud.gear.bottom>=12,'kill feed clears the settings button');
    await p.screenshot({path:`${out}/fixed-hud.png`});
    await p.reload();await p.waitForFunction(()=>window.GAME_BOOT&&!document.documentElement.dataset.gameLoading);
    await p.locator('#go-signin').click();await p.locator('#ag-id').fill('uifixaccount');await p.locator('#ag-pw').fill('browser-test-password');await p.locator('#ag-go').click();
    await p.waitForFunction(()=>window.ACCOUNT?.session()?.user?.id==='uifixaccount'&&!document.documentElement.dataset.gameLoading || document.getElementById('ag-err')?.textContent);
    assert.equal(await p.locator('#ag-err').count() ? await p.locator('#ag-err').innerText() : '', '', 'sign-up succeeded');
    assert.equal(await p.evaluate(()=>!!ACCOUNT.session().user.guest),false,'guest can sign up from the lobby');
    assert.deepEqual(f.errors,[]);console.log('PASS Grok UI: home/lobby guest auth, menus, 3 desktop heights, phone, settings, clan board, armor, scoreboard, HUD');
  } finally { await f.browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
