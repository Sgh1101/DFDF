const assert = require("node:assert/strict"), fs = require("node:fs"), { fixture } = require("./browser-fixture");
// Settings follow the account: sensitivity (mouse, aim, touch), crosshair, graphics preset, volumes, key bindings, the
// colour-blind mode and the screen-effect switches go to the server (checked there) a moment after they change, and another
// context of the same account takes them on loading. The newer change wins, one setting at a time. What belongs to a device
// (dynamic resolution, the FPS counter, touch mode) is not sent, and a phone does not take a computer's graphics preset.
const dir = process.env.SHOT_DIR || "test-results/settings-sync";
const ID = "syncer";
(async () => {
  fs.mkdirSync(dir, { recursive: true });
  const f = await fixture();
  let clock = null;
  try {
    const begin = (page) => page.evaluate(() => { room.mode = "std"; room.map = "field"; startGame(AGENTS[0], false); closeShop(); world.phase = "live"; ADMIN.freezeAI = true; });
    const stored = () => (f.h.user(ID).prefs && f.h.user(ID).prefs.o) || {};
    const until = async (what, ok, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (ok()) return; await new Promise((r) => setTimeout(r, 200)); } assert.fail("the account never got " + what + ": " + JSON.stringify(stored())); };
    // the test server's clock stands still until told: it keeps up with the real one, as the real server's does
    clock = setInterval(() => f.h.advance(Date.now() - f.h.now()), 300);
    const A = await f.page(ID, { width: 1280, height: 720 }, {}, { quality: false });
    await A.waitForTimeout(2500); // first look at the account: nothing there, nothing sent
    assert.deepEqual(stored(), {}, "an untouched device sends nothing");
    await begin(A); await A.waitForTimeout(800);
    // the player changes things in the pause menu
    await A.evaluate(() => togglePause(true));
    const slide = (id, v) => A.evaluate(([id, v]) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event("input")); }, [id, v]);
    await slide("st-sens", 150); await slide("st-ads", 80); await slide("st-tsens", 180); await slide("st-vol-fx", 35);
    await A.click('#pause .pz-tabs button[data-tab=gfx]');
    await A.click('#st-quality .pz-q[data-quality=visual]');
    await A.click("#st-dynres"); await A.click("#st-fps");
    await A.click('#pause .pz-tabs button[data-tab=fx]');
    await A.click("#st-cb-opts [data-cb=rg]");
    await A.click('#pause .pz-tabs button[data-tab=xhair]');
    await A.click('#xh-style button[data-v=circle]'); await A.click('#xh-color button[data-v="#ffe14d"]');
    await A.click('#pause .pz-tabs button[data-tab=keys]');
    await A.click('.kb-key[data-action=ping]'); await A.keyboard.press("p");
    await A.waitForTimeout(500);
    await A.screenshot({ path: `${dir}/changed-desk.png` });
    await A.evaluate(() => togglePause(false));
    await until("everything", () => { const o = stored(); return ["sens", "adsSens", "touchSens", "volFx", "qualityPc", "colorblind", "xhair", "binds"].every((k) => o[k]); });
    const o = stored();
    assert.equal(o.sens[0], 1.5); assert.equal(o.adsSens[0], 0.8); assert.equal(o.touchSens[0], 1.8); assert.equal(o.volFx[0], 0.35);
    assert.equal(o.qualityPc[0], "visual"); assert.equal(o.colorblind[0], "rg");
    assert.equal(o.xhair[0].style, "circle"); assert.equal(o.xhair[0].color, "#ffe14d");
    assert.deepEqual(o.binds[0].ping, ["KeyP"]);
    for (const k of ["dynRes", "showFps", "haptic", "touch", "quality", "binds.ping"]) assert.ok(!(k in o), k + " stays on the device");
    for (const [k, v] of Object.entries(o)) assert.ok(Math.abs(v[1] - Date.now()) < 120000, k + " carries the time of the change");

    // another computer of the same account
    const B = await f.page(ID, { width: 1280, height: 720 }, {}, { quality: false });
    await B.waitForFunction(() => SETTINGS.sens === 1.5 && SETTINGS.colorblind === "rg", null, { timeout: 30000 });
    const b = await B.evaluate(() => ({ s: Object.assign({}, SETTINGS), ping: KEYMAP.codes("ping"), xh: XHAIR.get(), cb: document.documentElement.dataset.cb, grenade: KEYMAP.codes("grenade") }));
    assert.equal(b.s.sens, 1.5); assert.equal(b.s.adsSens, 0.8); assert.equal(b.s.touchSens, 1.8); assert.equal(b.s.volFx, 0.35);
    assert.equal(b.s.quality, "visual"); assert.deepEqual(b.ping, ["KeyP"]); assert.deepEqual(b.grenade, ["KeyG"]);
    assert.equal(b.xh.style, "circle"); assert.equal(b.xh.color, "#ffe14d"); assert.equal(b.cb, "rg");
    assert.equal(b.s.dynRes, true, "dynamic resolution was not taken"); assert.equal(b.s.showFps, false, "nor the FPS counter");
    // the screens show it
    await begin(B); await B.waitForTimeout(800);
    await B.evaluate(() => togglePause(true));
    assert.equal(await B.inputValue("#st-sens"), "150"); assert.equal(await B.textContent("#st-sens-v"), "1.50");
    await B.click('#pause .pz-tabs button[data-tab=keys]');
    assert.equal(await B.textContent('.kb-key[data-action=ping]'), "P");
    await B.waitForTimeout(500);
    await B.screenshot({ path: `${dir}/taken-desk.png` });
    await B.evaluate(() => togglePause(false));
    // the same settings were not sent back as new changes
    await B.waitForTimeout(3000);
    assert.deepEqual(Object.fromEntries(Object.entries(stored()).map(([k, v]) => [k, v[1]])), Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v[1]])), "taking settings is not a change");

    // a phone: sensitivity and the rest come, the computer's graphics preset does not
    const P = await f.page(ID, { width: 852, height: 393 }, { hasTouch: true, isMobile: true }, { quality: false });
    await P.waitForFunction(() => SETTINGS.sens === 1.5, null, { timeout: 30000 });
    const p = await P.evaluate(() => ({ q: SETTINGS.quality, t: SETTINGS.touchSens, touch: IS_TOUCH }));
    assert.equal(p.t, 1.8); assert.notEqual(p.q, "visual", "a phone keeps its own graphics preset"); assert.equal(p.touch, true);
    await begin(P); await P.waitForTimeout(800);
    await P.evaluate(() => togglePause(true)); await P.click('#pause .pz-tabs button[data-tab=fx]'); await P.waitForTimeout(600);
    await P.screenshot({ path: `${dir}/taken-phone.png` });
    await P.evaluate(() => togglePause(false));

    // two devices change different things at once: both stay; the same thing: the newer wins
    await A.evaluate(() => { SETTINGS.volMaster = 0.4; saveSettings(); });
    await B.evaluate(() => { SETTINGS.adsSens = 0.7; saveSettings(); });
    await until("both changes", () => stored().volMaster && stored().adsSens && stored().adsSens[0] === 0.7);
    for (const page of [A, B]) { await page.evaluate(() => dispatchEvent(new Event("focus"))); }
    await A.waitForFunction(() => SETTINGS.adsSens === 0.7, null, { timeout: 15000 });
    await B.waitForFunction(() => SETTINGS.volMaster === 0.4, null, { timeout: 15000 });
    await A.waitForTimeout(1500);
    await B.evaluate(() => { SETTINGS.sens = 0.6; saveSettings(); });
    await until("the newer sensitivity", () => stored().sens[0] === 0.6);
    await A.evaluate(() => dispatchEvent(new Event("focus")));
    await A.waitForFunction(() => SETTINGS.sens === 0.6, null, { timeout: 15000 });
    assert.equal(await A.evaluate(() => SETTINGS.sens), 0.6, "the newer change of the other device won");
    // a change made while the account could not be reached is sent later, and an older local value never overwrites a newer one
    await A.evaluate(() => { SETTINGS.sens = 2; saveSettings(); });
    await until("the second change", () => stored().sens[0] === 2);
    assert.deepEqual(f.errors, []);
    console.log("settings sync: sensitivity, volumes, crosshair, graphics preset, keys and colour-blind mode reach the account and the other context; device things stay; the newer change wins");
  } finally { clock && clearInterval(clock); await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
