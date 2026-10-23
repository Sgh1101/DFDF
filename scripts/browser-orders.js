const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// 치트 구매 (bank transfer): the entry stays hidden until the owner opens the sale; pick cheats and a
// length, the price follows; the order shows the account to pay, an amount and a code; the owner's
// "구매 주문" page lists it (badge), opens it by hand once the money is in; the buyer sees it opened.
(async () => {
  const f = await fixture();
  try {
    const base = process.env.DFDF_BASE_URL || "http://127.0.0.1:3000", dir = process.env.SHOT_DIR || "/tmp";
    const owner = await f.h.api("auth", { id: "owner", pw: "owner-password", device: "od-owner" });
    const page = await f.page("buyer", { width: 1280, height: 800 });
    // closed: no entry anywhere
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById("go-order")).display), "none", "hidden while closed");
    // the owner opens the sale and names the account
    const c = JSON.parse(JSON.stringify(f.h.config));
    c.order.on = true; c.order.bank = "국민 123456-78-901234"; c.order.holder = "홍길동";
    assert.equal((await f.h.api("a_config_set", { atoken: owner.atoken, config: c })).status, 200);
    f.h.advance(30000);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.GAME_BOOT && !document.documentElement.dataset.gameLoading);
    await page.waitForFunction(() => getComputedStyle(document.getElementById("go-order")).display !== "none", null, { timeout: 15000 });
    await page.evaluate(() => { localStorage.setItem("lgp_lang", "ko"); });
    // the homepage chip too
    await page.goto(base + "/index.html", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.getElementById("orderOpen") && !document.getElementById("orderOpen").hidden, null, { timeout: 15000 });
    await page.click("#orderOpen");
    await page.waitForSelector("#od-back:not([hidden]) .od-it");
    assert.equal(await page.locator("#od .od-it").count(), 12);
    assert.equal(await page.locator('#od .od-it[data-k="admin"]').count(), 0, "admin mode is not on sale");
    assert.equal(await page.locator('#od .od-it[data-k="god"]').count(), 0, "invincibility is not on sale");
    assert.equal(await page.locator("#od-go").isDisabled(), true, "nothing picked, nothing to order");
    await page.screenshot({ path: dir + "/order-form.png" });
    // gold is one price and takes the length away
    await page.click('#od .od-it[data-k="gold5k"]');
    assert.equal(await page.locator("#od .od-dur").count(), 0, "gold has no length");
    assert.match(await page.textContent("#od-total"), /9,000원/);
    await page.click('#od .od-it[data-k="gold5k"]');
    assert.equal(await page.locator("#od .od-dur").count(), 1);
    await page.click('#od .od-it[data-k="radar"]');
    await page.click('#od .od-it[data-k="wall"]');
    assert.match(await page.textContent("#od-total"), /8,000원/, "seven days");
    await page.click('#od .od-dur button[data-d="30"]');
    assert.match(await page.textContent("#od-total"), /24,000원/, "thirty days");
    await page.fill("#od-dep", "홍철수");
    await page.click("#od-go");
    await page.waitForSelector("#od .od-pay");
    const pay = await page.textContent("#od .od-pay");
    assert.match(pay, /국민 123456-78-901234/); assert.match(pay, /홍길동/); assert.match(pay, /24,000원/); assert.match(pay, /홍철수/);
    await page.screenshot({ path: dir + "/order-pay.png" });
    const stored = [...f.h.db.entries()].filter(([k]) => /^ord:[A-Z0-9]+$/.test(k)).map(([, v]) => JSON.parse(v));
    assert.equal(stored.length, 1); assert.deepEqual(stored[0].items.sort(), ["radar", "wall"]); assert.equal(stored[0].days, 30); assert.equal(stored[0].status, "pending");
    // mine: waiting
    await page.click('#od .od-tabs [data-t="mine"]');
    await page.waitForSelector("#od .od-item");
    assert.match(await page.textContent("#od-body"), /입금 대기/);
    assert.equal(await page.locator("#od [data-cancel]").count(), 1);

    // a phone sideways: the form fits and the button can be pressed
    const ph = await f.page("odphone", { width: 568, height: 320 }, { hasTouch: true, isMobile: true });
    await ph.evaluate(() => localStorage.setItem("lgp_lang", "ko"));
    await ph.goto(base + "/index.html", { waitUntil: "domcontentloaded" });
    await ph.waitForFunction(() => document.getElementById("orderOpen") && !document.getElementById("orderOpen").hidden, null, { timeout: 15000 });
    await ph.tap("#orderOpen");
    await ph.waitForSelector("#od .od-it");
    await ph.tap('#od .od-it[data-k="radar"]');
    const fit = await ph.evaluate(() => { const r = (e) => e.getBoundingClientRect(), box = r(document.getElementById("od")), go = r(document.getElementById("od-go")), hit = document.elementFromPoint(go.left + go.width / 2, go.top + go.height / 2); return { inside: box.top >= 0 && box.bottom <= innerHeight && box.right <= innerWidth, go: go.bottom <= innerHeight && go.top >= 0, hit: hit === document.getElementById("od-go"), enabled: !document.getElementById("od-go").disabled }; });
    assert.deepEqual(fit, { inside: true, go: true, hit: true, enabled: true });
    await ph.screenshot({ path: dir + "/order-phone.png" });
    await ph.context().close();

    // the owner opens it
    const ctx = await f.browser.newContext({ viewport: { width: 1280, height: 900 } });
    const ap = await ctx.newPage();
    ap.on("pageerror", (e) => f.errors.push(e.message)); ap.on("dialog", (d) => d.accept());
    await ap.route("**/api/v1?*", async (route) => {
      const r = await f.h.api(new URL(route.request().url()).searchParams.get("a"), route.request().postDataJSON() || {});
      await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r) });
    });
    await ap.addInitScript((t) => sessionStorage.setItem("adm_t", t), owner.atoken);
    await ap.goto(base + "/admin.html", { waitUntil: "domcontentloaded" });
    await ap.waitForFunction(() => document.getElementById("odBadge") && document.getElementById("odBadge").textContent === "1", null, { timeout: 15000 });
    await ap.click('#nav [data-v="orders"]');
    await ap.waitForSelector("#ol tr[data-id]");
    const row = await ap.textContent("#ol tr[data-id]");
    assert.match(row, /buyer/); assert.match(row, /레이더/); assert.match(row, /벽 투시/); assert.match(row, /24,000원/); assert.match(row, /홍철수/); assert.match(row, /입금 대기/);
    assert.match(await ap.textContent("#osum"), /판매 중/);
    await ap.screenshot({ path: dir + "/order-admin.png" });
    await ap.click('#ol [data-op="grant"]');
    await ap.waitForFunction(() => /열어 줌/.test(document.querySelector("#ol tr[data-id]").textContent));
    assert.equal(await ap.evaluate(() => document.getElementById("odBadge").textContent), "", "no more waiting");
    const perm = f.h.user("buyer").perm;
    assert.ok(perm.on && perm.radar && perm.wall && !perm.god, "the cheats are on the account");
    assert.ok(perm.until > Date.now() + 29 * 864e5, "thirty days");
    // the buyer sees it
    await page.click("#od-back .od-x");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !document.getElementById("orderOpen").hidden);
    await page.click("#orderOpen");
    await page.click('#od .od-tabs [data-t="mine"]');
    await page.waitForSelector("#od .od-item");
    const mine = await page.textContent("#od-body");
    assert.match(mine, /열림/); assert.match(mine, /지금 쓸 수 있는 치트/);
    assert.equal(await page.locator("#od [data-cancel]").count(), 0);
    // the books: the opened order is a paid line; the revoke button is on the opened order and takes back only the cheats
    await ap.click('#nav [data-v="ledger"]');
    await ap.waitForSelector("#ll table tr:nth-child(3)");
    const books = await ap.textContent("#ll"), sum = await ap.textContent("#lsum");
    assert.match(books, /입금 확인/); assert.match(books, /주문 접수/); assert.match(books, /\+24,000원/); assert.match(sum, /순매출 24,000원/);
    await ap.screenshot({ path: dir + "/order-ledger.png" });
    await ap.click('#nav [data-v="orders"]');
    await ap.waitForSelector('#ol [data-op="revoke"]');
    assert.equal(await ap.locator('#ol [data-op="refund"]').count(), 1, "refund stays next to the revoke");
    await ap.click('#ol [data-op="revoke"]');
    await ap.waitForFunction(() => /회수/.test(document.querySelector("#ol tr[data-id] td:nth-child(8)").textContent));
    assert.equal(f.h.user("buyer").perm.on, false, "the cheats are taken back");
    assert.equal(await ap.locator('#ol [data-op="revoke"]').count(), 0, "once");
    await ap.click('#nav [data-v="ledger"]');
    await ap.waitForFunction(() => /회수/.test(document.getElementById("ll").textContent));
    assert.match(await ap.textContent("#lsum"), /회수 1건/);
    await ap.selectOption("#lk", "revoke");
    await ap.waitForFunction(() => document.querySelectorAll("#ll tr").length === 2);
    await ctx.close();
    assert.deepEqual(f.errors, []);
    console.log("orders: hidden until opened, pick and price, pay screen, my orders, the owner's list with badge, open by hand, the buyer sees it opened, phone fit");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
