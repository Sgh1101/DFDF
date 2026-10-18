const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// Profile cosmetics: a 꾸미기 tab in the armoury (three sections), a title/name card/kill effect
// bought with two presses and put on; the title and card on the homepage and the result screen;
// the kill banner re-coloured; the account keeps it all.
(async () => {
  const f = await fixture();
  try {
    const dir = process.env.SHOT_DIR || "/tmp";
    const owner = await f.h.api("auth", { id: "owner", pw: "owner-password", device: "cos-owner" });
    const page = await f.page("styler", { width: 1280, height: 800 });
    await f.h.api("a_user_set", { atoken: owner.atoken, id: "styler", op: "gold", gold: 30000 });
    await page.evaluate(() => GUN_SKINS.sync());
    await page.waitForFunction(() => GUN_SKINS.gold() === 30000, null, { timeout: 20000 });
    await page.evaluate(() => GUN_SKINS.open(null, "pull"));
    await page.waitForSelector("#ar-tab-cos", { timeout: 10000 });
    await page.click("#ar-tab-cos");
    await page.waitForSelector("#ar-p-cos .cs-it", { timeout: 20000 });
    const view = await page.evaluate(() => ({ secs: document.querySelectorAll("#ar-p-cos .cs-sec").length, items: document.querySelectorAll("#ar-p-cos .cs-it").length, panesHidden: ["pull", "shop", "mine", "gun"].every((k) => document.getElementById("ar-p-" + k).hidden), on: document.getElementById("ar-tab-cos").classList.contains("on") }));
    assert.deepEqual(view, { secs: 3, items: 73, panesHidden: true, on: true });
    await page.screenshot({ path: dir + "/cos-tab.png" });
    // a title: select, arm, buy; it is put on at once
    await page.click('#ar-p-cos .cs-it[data-id="marksman"]');
    await page.click("#cs-buy");
    assert.equal(f.h.user("styler").gold, 30000, "the first press only arms");
    await page.click("#cs-buy");
    await page.waitForFunction(() => COSMETIC_SHOP.S.own.includes("marksman") && COSMETIC_SHOP.S.eq.title === "marksman", null, { timeout: 20000 });
    assert.equal(f.h.user("styler").gold, 30000 - 1800);
    assert.deepEqual(f.h.user("styler").cos, { own: ["marksman"], eq: { title: "marksman", card: "", banner: "" } });
    assert.ok(await page.evaluate(() => document.querySelector('#ar-p-cos .cs-it[data-id="marksman"]').classList.contains("worn")), "the card says worn");
    // a name card and a kill effect (the bar says how short, when short)
    for (const id of ["galaxy", "flame"]) {
      await page.click(`#ar-p-cos .cs-it[data-id="${id}"]`);
      await page.click("#cs-buy"); await page.click("#cs-buy");
      await page.waitForFunction((i) => COSMETIC_SHOP.S.own.includes(i), id, { timeout: 20000 });
    }
    await f.h.api("a_user_set", { atoken: owner.atoken, id: "styler", op: "gold", gold: 5000 });
    await page.evaluate(() => GUN_SKINS.sync());
    await page.waitForFunction(() => GUN_SKINS.gold() === 5000, null, { timeout: 20000 });
    await page.click('#ar-p-cos .cs-it[data-id="legend13"]');
    assert.ok(await page.evaluate(() => /부족|short/.test(document.getElementById("cs-bar").textContent) && document.getElementById("cs-buy").disabled), "too dear: the button is off and says how much is missing");
    assert.deepEqual(f.h.user("styler").cos.eq, { title: "marksman", card: "galaxy", banner: "flame" });
    // off and on again
    await page.click('#ar-p-cos .cs-it[data-id="galaxy"]'); await page.click("#cs-eq");
    await page.waitForFunction(() => COSMETIC_SHOP.S.eq.card === "", null, { timeout: 10000 });
    await page.click("#cs-eq");
    await page.waitForFunction(() => COSMETIC_SHOP.S.eq.card === "galaxy", null, { timeout: 10000 });
    // the other tabs still work and hide this one
    await page.click('#ar-tabs .ar-tab[data-tab="shop"]');
    await page.waitForFunction(() => document.getElementById("ar-p-cos").hidden && !document.getElementById("ar-p-shop").hidden);
    await page.evaluate(() => GUN_SKINS.close());
    // the kill banner takes the effect's colours
    await page.evaluate(() => { titleCam = () => {}; render = () => {}; room.mode = "std"; startGame(AGENTS[0], false); closeShop(); world.phase = "live"; ADMIN.freezeAI = true; });
    await page.waitForTimeout(600);
    const kb = await page.evaluate(() => { playKillFx("처치 테스트", false); const o = document.getElementById("killfx"); return { cls: o.className, border: getComputedStyle(document.getElementById("kf-badge")).borderTopColor }; });
    assert.match(kb.cls, /kx-flame/);
    assert.equal(kb.border, "rgb(255, 167, 51)", "the effect's colour: " + JSON.stringify(kb));
    await page.screenshot({ path: dir + "/cos-kill.png" });
    // the result screen: title and name on the card
    await page.evaluate(() => { world.over = !1; gameOver(); });
    const ov = await page.evaluate(() => ({ text: document.getElementById("ov-who").textContent, bg: getComputedStyle(document.getElementById("ov-who")).backgroundImage.slice(0, 20) }));
    assert.match(ov.text, /명사수 · styler/); assert.match(ov.bg, /gradient/);
    await page.screenshot({ path: dir + "/cos-over.png" });
    // the homepage: title under the name, the card behind the profile, a link back here
    await page.evaluate(() => localStorage.setItem("lgp_lang", "ko"));
    await page.goto((process.env.DFDF_BASE_URL || "http://127.0.0.1:3000") + "/index.html", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.getElementById("meTitle") && !document.getElementById("meTitle").hidden, null, { timeout: 20000 });
    const home = await page.evaluate(() => ({ title: document.getElementById("meTitle").textContent, card: document.querySelector(".card").style.background.slice(0, 40), link: document.getElementById("meCos").getAttribute("href") }));
    assert.equal(home.title, "명사수"); assert.match(home.card, /gradient/); assert.match(home.link, /#cos$/);
    await page.screenshot({ path: dir + "/cos-home.png" });
    // #cos opens the armoury at this tab
    await page.goto((process.env.DFDF_BASE_URL || "http://127.0.0.1:3000") + "/play.html#cos", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.GAME_BOOT && !document.documentElement.dataset.gameLoading);
    await page.waitForSelector("#ar-p-cos .cs-it", { timeout: 30000 });
    assert.ok(await page.evaluate(() => !document.getElementById("ar-p-cos").hidden));
    // a guest sees a prompt, not the shop
    const g = await f.page("nostyle");
    assert.deepEqual(f.errors, []);
    console.log("cosmetics: the tab, buying with two presses, putting on and off, the kill banner, the result screen, the homepage, the link");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
