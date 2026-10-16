const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// The daily shop in the armoury: today's twenty skins with their prices, a skin bought
// with two presses (and gold taken), then worn; too dear says why; fits a phone held sideways.
(async () => {
  const f = await fixture();
  try {
    const page = await f.page("shopper", { width: 1280, height: 800 });
    const owner = await f.h.api("auth", { id: "owner", pw: "owner-password", device: "browser-owner-device" });
    await f.h.api("a_user_set", { atoken: owner.atoken, id: "shopper", op: "gold", gold: 20000 });
    await page.evaluate(() => GUN_SKINS.sync());
    await page.waitForFunction(() => GUN_SKINS.gold() === 20000, null, { timeout: 20000 });
    await page.evaluate(() => GUN_SKINS.open(null, "shop"));
    await page.waitForFunction(() => document.querySelectorAll("#sh-list .it:not(.wk)").length === 20 && document.querySelectorAll("#sh-list .it.wk").length === 5, null, { timeout: 30000 });
    const view = await page.evaluate(() => ({
      tab: GUN_SKINS.curTab(),
      cards: document.querySelectorAll("#sh-list .it:not(.wk)").length,
      weekly: [...document.querySelectorAll("#sh-list .it.wk")].map((e) => ({ rib: e.querySelector(".wkr").textContent, was: !!e.querySelector(".pr s") })),
      weekHead: (document.getElementById("sh-wt") || {}).textContent,
      weeklyFirst: document.querySelector("#sh-list .it").classList.contains("wk"),
      prices: [...document.querySelectorAll("#sh-list .it:not(.wk) .pr")].map((e) => +e.textContent.replace(/[^\d]/g, "")),
      tiers: GUN_SKINS.shop().items.filter((x) => !x.w).map((x) => x.r),
      timer: document.getElementById("sh-t").textContent,
      first: document.querySelector("#sh-list .it") && document.querySelector("#sh-list .it").dataset.s,
      slot: !!document.querySelector("#slot-shop .ar-view"),
    }));
    console.log(JSON.stringify(view));
    assert.equal(view.tab, "shop");
    assert.equal(view.cards, 20);
    assert.ok(view.weekly.length === 5 && view.weekly.every((w) => /주간 −30%/.test(w.rib) && w.was) && view.weeklyFirst && /일|시간|:/.test(view.weekHead), "the weekly deal: five cards first, marked, with the old price struck through, and a countdown: " + JSON.stringify(view));
    assert.ok(view.prices.every((p) => p >= 1200), "every price shown");
    assert.deepEqual([1, 2, 3, 4].map((r) => view.tiers.filter((t) => t === r).length), [7, 6, 4, 3]);
    assert.match(view.timer, /^\d\d:\d\d:\d\d$/);
    assert.ok(view.slot, "the turntable sits in the shop");
    await page.screenshot({ path: process.env.SHOT_DIR ? process.env.SHOT_DIR + "/shop.png" : "/tmp/shop.png" });
    // an epic we can afford: one press arms, the second buys
    const it = await page.evaluate(() => GUN_SKINS.shop().items.find((x) => !x.w && x.r === 3 && x.price <= 20000));
    await page.click(`#sh-list .it[data-g="${it.g}"][data-s="${it.s}"]`);
    await page.click("#sh-buy");
    assert.ok(await page.evaluate(() => /한 번 더|again/.test(document.getElementById("sh-buy").textContent)), "the first press only arms");
    assert.equal(f.h.user("shopper").gold, 20000, "nothing bought yet");
    await page.click("#sh-buy");
    await page.waitForFunction(([g, s]) => GUN_SKINS.owns(g, s) && document.getElementById("sh-wear"), [it.g, it.s], { timeout: 20000 });
    const after = await page.evaluate(([g, s]) => ({ gold: GUN_SKINS.gold(), badge: document.querySelector(`#sh-list .it[data-g="${g}"][data-s="${s}"]`).classList.contains("eq") }), [it.g, it.s]);
    assert.equal(after.gold, 20000 - it.price);
    assert.ok(after.badge, "the card says owned");
    assert.ok(f.h.user("shopper").own[it.g].includes(it.s), "the server has it");
    await page.click("#sh-wear");
    assert.equal(await page.evaluate((g) => GUN_SKINS.of(g).id, it.g), it.s, "worn");
    // a weekly-deal legendary: bought at the discounted price
    const wk = await page.evaluate(() => GUN_SKINS.shop().items.find((x) => x.w && x.r === 4 && x.price <= GUN_SKINS.gold()));
    const g0 = await page.evaluate(() => GUN_SKINS.gold());
    await page.click(`#sh-list .it.wk[data-g="${wk.g}"][data-s="${wk.s}"]`);
    await page.click("#sh-buy");
    await page.click("#sh-buy");
    await page.waitForFunction(([g, s]) => GUN_SKINS.owns(g, s), [wk.g, wk.s], { timeout: 20000 });
    assert.equal(await page.evaluate(() => GUN_SKINS.gold()), g0 - wk.price, "the weekly price, not the daily one");
    assert.ok(wk.price < wk.was && f.h.user("shopper").own[wk.g].includes(wk.s));
    // a legendary that costs more than is left: the button is off and says how much is missing
    const dear = await page.evaluate(() => GUN_SKINS.shop().items.find((x) => x.r === 4 && !GUN_SKINS.owns(x.g, x.s) && x.price > GUN_SKINS.gold()));
    await page.click(`#sh-list .it[data-g="${dear.g}"][data-s="${dear.s}"]`);
    const d = await page.evaluate(() => ({ off: document.getElementById("sh-buy").disabled, why: (document.querySelector("#sh-info .sh-why") || {}).textContent || "" }));
    assert.ok(d.off && /부족|short/.test(d.why), "too dear: " + JSON.stringify(d));
    // the pull page links here
    await page.evaluate(() => GUN_SKINS.tab("pull"));
    await page.click("#pl-shop");
    assert.equal(await page.evaluate(() => GUN_SKINS.curTab()), "shop");
    // a phone held sideways: no sideways scroll, the cards still there
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(400);
    const ph = await page.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, list: document.getElementById("sh-list").getBoundingClientRect().height, buy: (document.querySelector("#sh-info .btn") || { getBoundingClientRect: () => ({ height: 0 }) }).getBoundingClientRect().height }));
    await page.screenshot({ path: process.env.SHOT_DIR ? process.env.SHOT_DIR + "/shop-phone.png" : "/tmp/shop-phone.png" });
    assert.ok(ph.over <= 1 && ph.list > 60 && ph.buy >= 32, "fits a phone: " + JSON.stringify(ph));
    assert.deepEqual(f.errors, []);
    console.log("daily shop: twenty skins with prices, bought with two presses, worn, too dear explained, fits a phone");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
