const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// An account the owner made an operator sees the owner's in-game panel exactly as the owner does (the same tabs, the
// player tab, every cheat open, no admin password), and a plain player does not.
(async () => {
  const f = await fixture();
  try {
    const owner = await f.h.api("auth", { id: "owner", pw: "owner-password", device: "browser-test-owner" });
    await f.h.api("auth", { id: "helper1", pw: "password", device: "browser-test-helper1" });
    assert.equal((await f.h.api("a_user_set", { atoken: owner.atoken, id: "helper1", op: "operator", on: true })).status, 200);
    const panel = async (id, pw) => {
      const page = await f.page(id, { width: 1280, height: 800 }, {}, pw ? { pw } : {});
      await page.waitForTimeout(2500); // the account check after loading (who am I)
      await page.evaluate(() => { titleCam = () => {}; room.mode = "std"; room.map = "glacier"; startGame(AGENTS[0], false); closeShop(); world.phase = "live"; ADMIN.freezeAI = true; });
      await page.waitForFunction(() => myActor()?.alive);
      await page.waitForTimeout(1500); // the owner module looks every second
      const out = await page.evaluate(() => {
        openAdmin();
        const vis = (s) => { const n = document.querySelector(s); return !!n && !n.hidden && n.getBoundingClientRect().width > 0; };
        return { owner: !!window.IS_OWNER, lock: vis("#ad-lock"), panel: vis("#ad-panel"), tabs: [...document.querySelectorAll("#ad-panel .ad-tabs button")].map((b) => b.dataset.t), note: (document.querySelector("#ad-panel .ad-note") || {}).textContent || "" };
      });
      if (out.tabs.includes("own")) { await page.click('#ad-panel .ad-tabs [data-t="own"]'); await page.waitForTimeout(300); out.ownTab = await page.evaluate(() => document.querySelector("#ad-panel").innerText.slice(0, 400)); }
      await page.screenshot({ path: (process.env.DFDF_SHOT_DIR || "/tmp") + "/operator-" + id + ".png" });
      await page.context().close();
      return out;
    };
    // the owner page: "운영자 주기" on the account's row makes it one, and the row says so
    {
      const ctx = await f.browser.newContext({ viewport: { width: 1400, height: 900 }, serviceWorkers: "block" }), page = await ctx.newPage();
      page.on("pageerror", (e) => f.errors.push(e.message));
      await page.route("**/api/v1?*", async (route) => { const r = await f.h.api(new URL(route.request().url()).searchParams.get("a"), route.request().postDataJSON() || {}); await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r) }); });
      await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
      page.on("dialog", (d) => d.accept());
      await page.goto((process.env.DFDF_BASE_URL || "http://127.0.0.1:3000") + "/admin.html");
      await page.fill("#pw", "owner-password"); await page.click("#go");
      await page.click('button[data-v="users"]');
      const row = page.locator('tr[data-id="helper1"]');
      await row.locator('button[data-op="operator"]').waitFor();
      assert.equal(await row.locator('button[data-op="operator"]').textContent(), "운영자 빼기", "helper1 is already one (made above)");
      await row.locator('button[data-op="operator"]').click();
      await page.waitForFunction(() => document.querySelector('tr[data-id="helper1"] button[data-op="operator"]')?.textContent === "운영자 주기");
      assert.equal(!!f.h.user("helper1").operator, false, "taken away");
      await page.locator('tr[data-id="helper1"] button[data-op="operator"]').click();
      await page.waitForFunction(() => document.querySelector('tr[data-id="helper1"] button[data-op="operator"]')?.textContent === "운영자 빼기");
      assert.equal(f.h.user("helper1").operator, true, "given again");
      assert.match(await page.locator('tr[data-id="helper1"]').innerText(), /운영자/);
      await page.screenshot({ path: (process.env.DFDF_SHOT_DIR || "/tmp") + "/operator-admin.png" });
      await ctx.close();
    }
    const me = await panel("owner", "owner-password"), op = await panel("helper1"), plain = await panel("plainone");
    console.log(JSON.stringify({ me, op, plain }));
    assert.equal(me.owner, true);
    assert.ok(me.panel && !me.lock && me.tabs.includes("own"), "the owner's panel opens with the player tab");
    assert.equal(op.owner, true, "an operator is treated as the owner in the game");
    assert.deepEqual(op.tabs, me.tabs, "the operator sees the same tabs as the owner");
    assert.ok(op.panel && !op.lock, "the panel opens without the admin password");
    assert.ok(/운영자|Owner/.test(op.note), "with the owner's note: every cheat open");
    assert.ok(op.ownTab && op.ownTab.length > 20, "the player tab works");
    assert.equal(plain.owner, false);
    assert.ok(!plain.panel && !plain.tabs.includes("own"), "a plain player does not get the panel");
    assert.deepEqual(f.errors, []);
    console.log("operator: an operator gets the owner's in-game panel (same tabs, the player tab, no password); a plain player gets nothing");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
