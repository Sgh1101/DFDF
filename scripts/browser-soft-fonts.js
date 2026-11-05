const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { fixture } = require('./browser-fixture');

const DISPLAY = /^Galmuri11\b/;
const BODY = /^"Pretendard Variable"/;
const output = process.env.DFDF_SCREENSHOT_DIR || 'test-results/retro-fonts';
const family = (page, selector) => page.locator(selector).first().evaluate(element => getComputedStyle(element).fontFamily);

async function loadLocalFaces(page) {
  const loaded = await page.evaluate(async () => {
    const pixel = await document.fonts.load('700 24px Galmuri11', '라운드 승리 Round 30');
    const reading = await document.fonts.load('400 16px "Pretendard Variable"', '능력 설명 Settings');
    return [pixel, reading].every(group => group.length > 0 && group.every(face => face.status === 'loaded'));
  });
  assert.equal(loaded, true, 'both local faces load Korean and Latin');
}

(async () => {
  const f = await fixture();
  fs.mkdirSync(output, { recursive: true });
  try {
    const page = await f.page('softfonts', { width: 1280, height: 720 }, { locale: 'ko-KR' });
    await loadLocalFaces(page);
    assert.match(await family(page, '.title-mark'), DISPLAY);
    await page.evaluate(() => { titleCam = () => {}; document.getElementById('go-play').click(); });
    await page.locator('#sel-detail .det-name').waitFor({ state: 'attached' });
    for (const selector of ['.acard-name', '.det-name']) {
      assert.match(await family(page, selector), DISPLAY, selector);
      assert.equal(await page.locator(selector).first().evaluate(e => getComputedStyle(e).fontWeight), '700');
    }
    assert.match(await family(page, '.det-desc'), BODY);
    await page.evaluate(() => { room.mode = 'std'; room.map = 'pogu'; startGame(AGENTS[0], false); closeShop(); ADMIN.freezeAI = true; world.phase = 'live'; });
    await page.waitForFunction(() => myActor()?.alive && !document.getElementById('hud').hidden);

    await page.evaluate(() => { window.KILL_EVENT = null; killStreak = 0; playKillFx('화령', false); banner('라운드 승리', '#4ade80'); });
    for (const selector of ['#kf-main', '#kf-tag', '#banner', '#am-count']) assert.match(await family(page, selector), DISPLAY, selector);
    for (const selector of ['#kf-sub', '#kf-streak', '#roster', 'body', '#am-count small', '#am-credit', '#tb-time']) assert.match(await family(page, selector), BODY, selector);
    for (const selector of ['#v-hp', '#v-ar', '#am-count', '#am-count small', '#tb-time']) {
      assert.match(await page.locator(selector).evaluate(e => getComputedStyle(e).fontVariantNumeric), /tabular-nums/, selector);
    }

    await page.evaluate(() => { window.KILL_EVENT = { kind: 'gun', skin: 'champions_atk' }; killStreak = 0; playKillFx('화령', false); });
    assert.match(await page.locator('#killfx').getAttribute('class'), /phantom-attack/);
    for (const selector of ['#kf-main', '#kf-tag', '#kf-streak']) assert.equal(await family(page, selector), 'Orbitron, system-ui, sans-serif');
    for (const selector of ['#kf-sub', '#phantom-emblems']) assert.equal(await family(page, selector), '"Noto Sans KR", system-ui, sans-serif');
    assert.equal(await page.locator('#kf-main').evaluate(e => getComputedStyle(e).fontWeight), '400');
    await page.evaluate(() => { window.KILL_EVENT = null; killStreak = 0; playKillFx('화령', false); });
    assert.match(await family(page, '#kf-main'), DISPLAY, 'regular kill title after a Champions kill');

    await page.setViewportSize({ width: 568, height: 320 });
    const bounds = await page.evaluate(() => {
      banner('공격 팀과 수비 팀의 위치가 바뀝니다', '#4ade80');
      const round = document.querySelector('#banner').getBoundingClientRect();
      const ammo = document.querySelector('#am-count').getBoundingClientRect();
      const panel = document.querySelector('#ammo').getBoundingClientRect();
      return { left: round.left, right: round.right, viewport: innerWidth, ammo: ammo.width, panel: panel.width };
    });
    assert.ok(bounds.left >= 0 && bounds.right <= bounds.viewport, JSON.stringify(bounds));
    assert.ok(bounds.ammo <= bounds.panel, JSON.stringify(bounds));
    await page.screenshot({ path: path.join(output, 'game-568.png') });
    await page.evaluate(() => togglePause(true));
    await page.locator('#pause').waitFor({ state: 'visible' });
    assert.match(await family(page, '#pause .pz-tabs button'), BODY);
    await page.context().close();

    const context = await f.browser.newContext({ viewport: { width: 360, height: 640 }, locale: 'ko-KR', serviceWorkers: 'block' });
    const home = await context.newPage();
    await home.route('**/api/v1?*', async route => {
      const action = new URL(route.request().url()).searchParams.get('a');
      const result = await f.h.api(action, route.request().postDataJSON() || {});
      await route.fulfill({ status: result.status, contentType: 'application/json', body: JSON.stringify(result) });
    });
    const base = process.env.DFDF_BASE_URL || 'http://127.0.0.1:3000';
    await home.goto(base + '/index.html', { waitUntil: 'load' });
    await loadLocalFaces(home);
    assert.match(await family(home, '#publicIntro h1'), DISPLAY);
    assert.match(await family(home, '.entry-lead'), BODY);
    assert.ok(await home.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await home.screenshot({ path: path.join(output, 'home-360.png') });
    await home.goto(base + '/guide.html', { waitUntil: 'load' });
    await loadLocalFaces(home);
    assert.match(await family(home, 'h1'), DISPLAY);
    assert.match(await family(home, 'main p'), BODY);
    assert.ok(await home.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await context.close();
    assert.deepEqual(f.errors, []);
    console.log('Local Galmuri11 and Pretendard loaded. Lobby, agent text, settings, round banner, small HUD and guide passed.');
  } finally {
    await f.browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
