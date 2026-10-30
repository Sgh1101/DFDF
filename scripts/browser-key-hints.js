const assert = require("node:assert/strict"), fs = require("node:fs"), { fixture } = require("./browser-fixture");
// Ping and quick chat are rebindable actions (they were V and Z fixed in the chat's own key handler, so another action
// bound to V or Z fired together with them), and the hints that name keys (the controls list, the big map's close hint, the
// spike plant hint) show the bound key. Through the pause menu's key tab, as a player does it.
const dir = process.env.SHOT_DIR || "test-results/key-hints";
(async () => {
  fs.mkdirSync(dir, { recursive: true });
  const f = await fixture();
  try {
    const start = async (name, vp, ctx, options) => {
      const page = await f.page(name, vp, ctx, options);
      await page.evaluate(() => { room.mode = "std"; room.map = "field"; startGame(AGENTS[0], false); closeShop(); world.phase = "live"; ADMIN.freezeAI = true; locked = true; });
      await page.waitForTimeout(1200);
      return page;
    };
    const page = await start("keyh", { width: 1280, height: 720 });
    const sounds = () => page.evaluate(() => CHAT.stats.pingSounds);
    const qmUp = () => page.evaluate(() => !document.getElementById("cht-qm").hidden);
    // the ray under the crosshair needs the floor in front of the player
    await page.evaluate(() => { const a = myActor(); a.pitch = -0.55; a.input && (a.input.pitch = a.pitch); });
    await page.waitForFunction(() => !!CHAT.aim(), null, { timeout: 30000 });
    // the key tab lists both, with the keys they had
    await page.evaluate(() => togglePause(true));
    await page.click('#pause .pz-tabs button[data-tab=keys]');
    assert.equal(await page.textContent('.kb-key[data-action=ping]'), "V");
    assert.equal(await page.textContent('.kb-key[data-action=quickchat]'), "Z");
    await page.screenshot({ path: `${dir}/keys-tab.png` });
    await page.evaluate(() => togglePause(false));
    // as ever: V pings, Z opens quick chat
    await page.evaluate(() => { CHAT.resetLimits(); locked = true; });
    const s0 = await sounds();
    await page.keyboard.press("v");
    await page.waitForFunction((n) => CHAT.stats.pingSounds > n, s0, { timeout: 10000 });
    await page.keyboard.press("z");
    assert.equal(await qmUp(), true, "Z opens quick chat");
    await page.keyboard.press("Escape");
    assert.equal(await qmUp(), false);
    // another action onto V (grenade): V is the grenade's, the ping has the key that was the grenade's, and V no longer pings
    const rebind = async (action, key) => {
      await page.evaluate(() => togglePause(true));
      await page.click('#pause .pz-tabs button[data-tab=keys]');
      await page.click(`.kb-key[data-action=${action}]`);
      await page.keyboard.press(key);
      await page.evaluate(() => togglePause(false));
      await page.evaluate(() => { CHAT.resetLimits(); locked = true; });
    };
    await rebind("grenade", "v");
    assert.deepEqual(await page.evaluate(() => [KEYMAP.codes("grenade"), KEYMAP.codes("ping")]), [["KeyV"], ["KeyG"]]);
    const s1 = await sounds();
    await page.keyboard.press("v");
    await page.waitForTimeout(500);
    assert.equal(await sounds(), s1, "V no longer pings: it is the grenade's now");
    await page.keyboard.press("g");
    await page.waitForFunction((n) => CHAT.stats.pingSounds > n, s1, { timeout: 10000 });
    // the same for quick chat: Z gives way to J
    await rebind("quickchat", "j");
    await page.keyboard.press("z");
    assert.equal(await qmUp(), false, "Z does not open it any more");
    await page.keyboard.press("j");
    assert.equal(await qmUp(), true, "J opens it");
    await page.keyboard.press("j");
    assert.equal(await qmUp(), false, "and J closes it");
    // Enter stays Enter
    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => !document.getElementById("cht-box").hidden), true, "Enter still opens the chat box");
    await page.keyboard.press("Escape");
    // typing a rebound key into the box does not fire it
    await page.keyboard.press("Enter"); await page.keyboard.type("gj"); await page.keyboard.press("Escape");
    assert.equal(await qmUp(), false);

    // ── hints ──
    const hints = () => page.evaluate(() => ({ tips: document.getElementById("tips").textContent.replace(/\s+/g, " ").trim(), spike: document.getElementById("sp-txt").textContent }));
    let h = await hints();
    assert.match(h.tips, /WASD 이동 · SHIFT 앉기 · SPACE 점프/); assert.match(h.tips, /R 재장전/); assert.match(h.tips, /4 또는 F 길게/); assert.match(h.tips, /B 상점/);
    await rebind("reload", "t"); await rebind("plant", "i"); await rebind("use", "k"); await rebind("shop", "o"); await rebind("forward", "ArrowUp"); await rebind("map", "u");
    await page.evaluate(() => { player.team = "atk"; player.hasSpike = true; world.spike.state = "carried"; world.phase = "live"; step(0.05); });
    h = await hints();
    assert.match(h.tips, /T 재장전/); assert.doesNotMatch(h.tips, /R 재장전/); assert.match(h.tips, /I 또는 K 길게 — 설치/); assert.match(h.tips, /K 길게 — 해제/); assert.match(h.tips, /O 상점/);
    assert.match(h.tips, /↑ASD 이동/, "the moving keys: " + h.tips);
    assert.match(h.spike, /사이트 안에서 I 또는 K를 눌러 설치/, "the spike hint names the bound keys: " + h.spike);
    await page.evaluate(() => toggleBigMap(true));
    assert.equal(await page.textContent("#bm-hint"), "U · 닫기", "the big map's hint");
    await page.screenshot({ path: `${dir}/bigmap-rebound.png` });
    await page.evaluate(() => toggleBigMap(false));
    await page.evaluate(() => { document.getElementById("tips").classList.add("show"); });
    await page.screenshot({ path: `${dir}/hints-rebound.png` });
    // and back: a reset puts the defaults back on screen
    await page.evaluate(() => togglePause(true));
    await page.click('#pause .pz-tabs button[data-tab=keys]');
    await page.click("#kb-reset");
    await page.evaluate(() => togglePause(false));
    await page.evaluate(() => step(0.05));
    h = await hints();
    assert.match(h.tips, /WASD 이동 · SHIFT 앉기 · SPACE 점프/); assert.match(h.tips, /R 재장전/); assert.match(h.tips, /4 또는 F 길게/);
    assert.match(h.spike, /4 또는 F를 눌러 설치/);
    await page.evaluate(() => toggleBigMap(true));
    assert.equal(await page.textContent("#bm-hint"), "M · 닫기"); await page.evaluate(() => toggleBigMap(false));

    // ── English page: the same hints in English ──
    const en = await start("keyhen", { width: 1280, height: 720 }, {}, { bootTimeout: 120000, beforeLoad: (p) => p.addInitScript(() => { try { localStorage.setItem("lgp_lang", "en"); } catch (e) {} }) });
    await en.evaluate(() => { KEYMAP.bind("plant", "KeyI"); KEYMAP.bind("use", "KeyK"); player.team = "atk"; player.hasSpike = true; world.spike.state = "carried"; step(0.05); });
    const t = await en.evaluate(() => ({ spike: document.getElementById("sp-txt").textContent, tips: document.getElementById("tips").textContent.replace(/\s+/g, " ") }));
    assert.match(t.spike, /press I or K inside a site to plant/, t.spike);
    assert.doesNotMatch(t.tips, /[가-힣]/, "English controls hint: " + t.tips);
    assert.match(t.tips, /I or K/);
    assert.deepEqual(f.errors, []);
    console.log("key hints: ping and quick chat follow the key tab (V and Z free for other actions), Enter stays, the controls list, big map and spike hints show the bound keys, in Korean and English");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
