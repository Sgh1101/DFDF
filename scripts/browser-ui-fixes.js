const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
const { AUDIT_SRC } = require("./ui-audit-lib");
// UI fixes found by the audit (scripts/browser-ui-audit.js):
//  · agent select on a small landscape phone: the map/mode sheet is above the agent cards (it was drawn under
//    their names and the favourites row), every chip in it is on screen and a tap on one works and closes it;
//    the role tabs and the skins button share one row at 568x320
//  · the result screen: "play again" is on screen without scrolling and works
//  · the play-guide card on the title screen stays under the top bar
//  · small controls have a hit area of 36 px or more on a touch screen
(async () => {
  const f = await fixture();
  try {
    for (const [w, h] of [[568, 320], [667, 375], [844, 390]]) {
      const page = await f.page("fix" + w, { width: w, height: h }, { hasTouch: true, isMobile: true });
      // the chip is drawn after the account loads; a first read can come back empty
      await page.locator('#mis-chip').waitFor({ state: 'visible', timeout: 15000 });
      const mission = await page.locator('#mis-chip').boundingBox();
      assert.ok(mission.width >= 35.5 && mission.height >= 35.5, w + ' mission chip has a full touch target');
      await page.locator('#go-set').tap();
      await page.waitForFunction(()=>document.getElementById('st-touch').getBoundingClientRect().height>=35.5);
      await page.locator('#st-touch').scrollIntoViewIfNeeded();
      const touchBefore=await page.evaluate(()=>IS_TOUCH);
      await page.locator('#st-touch').tap({position:{x:24,y:32}});
      await page.waitForFunction(value=>IS_TOUCH!==value,touchBefore);
      await page.locator('#st-touch').tap({position:{x:24,y:32}});
      await page.waitForFunction(value=>IS_TOUCH===value,touchBefore);
      await page.locator('#pz-close').tap();
      await page.evaluate(() => { titleCam = () => {}; document.getElementById("go-play").click(); });
      await page.waitForTimeout(500);
      const row = await page.evaluate(() => { const r = (e) => e.getBoundingClientRect(); const tabs = r(document.querySelector(".sel-roles")), sk = r(document.getElementById("sel-armory")); return { sameRow: Math.abs(tabs.top - sk.top) < 30 || h2gone(), skinsInside: sk.right <= innerWidth + 1 && sk.left >= 0 }; function h2gone() { return false; } });
      assert.ok(row.skinsInside, w + " skins button on screen");
      if (w === 568) assert.ok(row.sameRow, "role tabs and the skins button on one row at 568");
      const small = await page.evaluate(() => [".sel-roles button", "#agent-favorites .btn", "#sel-armory"].map((q) => Math.min(...[...document.querySelectorAll(q)].filter((e) => e.offsetParent).map((e) => e.getBoundingClientRect().height))));
      assert.ok(small.every((v) => v >= 35.5), w + " touch targets in select: " + small);
      // the sheet
      await page.tap("#sel-pick");
      await page.waitForTimeout(300);
      const sheet = await page.evaluate(() => {
        const mid = document.querySelector("#s-select .sel-mid"), r = mid.getBoundingClientRect();
        const chips = [...mid.querySelectorAll(".lb-map")].filter((e) => e.offsetParent);
        let covered = 0, offscreen = 0;
        for (const c of chips) {
          const b = c.getBoundingClientRect();
          if (b.right > innerWidth + 1 || b.left < -1) offscreen++;
          // chips inside the scrolling sheet may be below its fold; only the visible ones are tested
          if (b.bottom > r.bottom || b.top < r.top) continue;
          const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
          hit && !c.contains(hit) && !hit.contains(c) && covered++;
        }
        return { top: r.top, bottom: r.bottom, h: r.height, vh: innerHeight, covered, offscreen, n: chips.length };
      });
      assert.equal(sheet.covered, 0, w + " nothing draws over the sheet's chips");
      assert.equal(sheet.offscreen, 0);
      assert.ok(sheet.top >= 0 && sheet.bottom <= sheet.vh, w + " the sheet is on screen " + JSON.stringify(sheet));
      // a tap on a map chip picks it and closes the sheet
      const pick = await page.evaluate(() => { const c = [...document.querySelectorAll("#sel-maps .lb-map")].find((e) => /야간 항구/.test(e.textContent)); c.scrollIntoView({ block: "center" }); const b = c.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
      await page.touchscreen.tap(pick[0], pick[1]);
      await page.waitForTimeout(300);
      assert.equal(await page.evaluate(() => room.map), "nightport", w + " the tap picked the map");
      assert.equal(await page.evaluate(() => document.querySelector("#s-select .sel-foot").classList.contains("pick-open")), false, "the sheet closed");
      await page.context().close();
    }
    // the result screen on a phone
    const page = await f.page("fixover", { width: 568, height: 320 }, { hasTouch: true, isMobile: true });
    await page.evaluate(() => { titleCam = () => {}; room.mode = "std"; room.map = "field"; startGame(AGENTS[0], false); closeShop(); world.phase = "live"; world.over = true; gameOver(); });
    await page.waitForTimeout(600);
    const over = await page.evaluate(() => { const b = document.getElementById("ov-again").getBoundingClientRect(), hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return { within: b.top >= 0 && b.bottom <= innerHeight, hit: hit === document.getElementById("ov-again") }; });
    assert.ok(over.within && over.hit, "play again on screen and tappable: " + JSON.stringify(over));
    await page.context().close();
    // the play guide under the top bar
    const desk = await f.page("fixdesk", { width: 1280, height: 720 });
    await desk.waitForTimeout(500);
    const news = await desk.evaluate(() => { const n = document.querySelector(".tt-news").getBoundingClientRect(), hd = document.querySelector(".home-header").getBoundingClientRect(); return { top: n.top, header: hd.bottom, bottom: n.bottom, vh: innerHeight }; });
    assert.ok(news.top >= news.header - 1 && news.bottom <= news.vh, "the guide fits between the bar and the edge " + JSON.stringify(news));
    const tablet=await f.page('fixtablet',{width:1024,height:768},{hasTouch:true,isMobile:true});
    await tablet.locator('#go-play').tap();
    assert.ok((await tablet.locator('#s-select .map-cats button').evaluateAll(a=>a.map(e=>e.getBoundingClientRect().height))).every(h=>h>=35.5),'tablet map filters have full touch targets');
    await tablet.locator('#s-select .map-cats [data-cat="small"]').tap();
    assert.equal(await tablet.locator('#s-select .map-cats [data-cat="small"]').getAttribute('class'),'on');
    await tablet.context().close();
    // A decorative highlight must not look like clipped text, while real
    // overflowing labels must still be reported by the diagnostic.
    const diagnostic=await desk.context().newPage();
    await diagnostic.setContent('<style>button{position:relative;overflow:hidden;white-space:nowrap;width:80px;height:40px;margin:10px}#highlight::after{content:"";position:absolute;left:150px;width:60px;height:5px}#clipped{width:35px}</style><button id="highlight">OK</button><button id="clipped">Long clipped label</button>');
    await diagnostic.evaluate(src=>eval(src),AUDIT_SRC);
    const signals=await diagnostic.evaluate(()=>__audit('diagnostic'));
    assert.ok(!signals.some(s=>s.el==='#highlight'&&s.kind==='text-cut'),'ignore decorative scroll width');
    assert.ok(signals.some(s=>s.el==='#clipped'&&s.kind==='text-cut'),'still catch actual clipped labels');
    await diagnostic.close();
    assert.deepEqual(f.errors, []);
    console.log("ui fixes: the map sheet above the cards and tappable, one row of tabs at 568, result buttons reachable, the guide under the bar, 36 px touch targets");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
