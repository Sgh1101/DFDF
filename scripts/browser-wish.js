const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// The wishlist: ★ on a locked skin in the armoury (kept on the account), ★ on the shop
// cards, and a note on the title screen when a wished skin is in today's shop.
(async () => {
  const f = await fixture();
  try {
    const page = await f.page("wisher", { width: 1280, height: 800 });
    // by gun: a skin not owned, looked at, wished
    await page.evaluate(() => GUN_SKINS.open("smg", "gun"));
    await page.waitForSelector("#ar-skins .ar-sk.locked");
    const sid = await page.evaluate(() => document.querySelector("#ar-skins .ar-sk.locked").dataset.s);
    await page.click(`#ar-skins .ar-sk[data-s="${sid}"]`);
    await page.waitForSelector("#ar-wish");
    await page.click("#ar-wish");
    await page.waitForFunction((s) => GUN_SKINS.wish().includes("smg|" + s), sid);
    assert.deepEqual(f.h.user("wisher").wish, ["smg|" + sid], "kept on the account");
    assert.ok(await page.evaluate((s) => document.querySelector(`#ar-skins .ar-sk[data-s="${s}"]`).classList.contains("wish"), sid), "the card shows the star");
    // a skin in today's shop, wished from the shop tab
    await page.evaluate(() => GUN_SKINS.tab("shop"));
    await page.waitForFunction(() => document.querySelectorAll("#sh-list .it:not(.wk)").length === 20, null, { timeout: 30000 });
    const it = await page.evaluate(() => GUN_SKINS.shop().items.find((x) => !x.w && !GUN_SKINS.owns(x.g, x.s)));
    await page.click(`#sh-list .it[data-g="${it.g}"][data-s="${it.s}"]`);
    await page.click("#sh-wish");
    await page.waitForFunction(([g, s]) => document.querySelector(`#sh-list .it[data-g="${g}"][data-s="${s}"]`).classList.contains("wish"), [it.g, it.s]);
    const head = await page.evaluate(() => document.getElementById("sh-f").textContent);
    assert.match(head, /찜한 스킨 1개/);
    // back on the title screen: the note, once a day, opens the shop
    await page.evaluate(() => { GUN_SKINS.close(); localStorage.removeItem("lgp_wish_seen"); GUN_SKINS.wishNotice(); });
    await page.waitForSelector("#wish-note:not([hidden])", { timeout: 10000 });
    const text = await page.evaluate(() => document.getElementById("wish-note").textContent);
    assert.match(text, /찜한 스킨 1개가 오늘 상점에 있습니다/);
    await page.screenshot({ path: process.env.SHOT_DIR ? process.env.SHOT_DIR + "/wish-note.png" : "/tmp/wish-note.png" });
    await page.click("#wn-go");
    assert.equal(await page.evaluate(() => GUN_SKINS.isOpen() && GUN_SKINS.curTab()), "shop");
    await page.evaluate(() => { GUN_SKINS.close(); GUN_SKINS.wishNotice(); });
    assert.ok(await page.evaluate(() => document.getElementById("wish-note").hidden), "seen today: no note again");
    // off again
    await page.evaluate(([g, s]) => GUN_SKINS.toggleWish(g, s), [it.g, it.s]);
    await page.waitForFunction(([g, s]) => !GUN_SKINS.wish().includes(g + "|" + s), [it.g, it.s]);
    assert.deepEqual(f.h.user("wisher").wish, ["smg|" + sid]);
    assert.deepEqual(f.errors, []);
    console.log("wishlist: star a locked skin, star in the shop, note on the title screen once a day");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
