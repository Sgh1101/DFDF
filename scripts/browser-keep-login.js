// "Keep me signed in on this device": a sign-in with the box ticked carries over to a new tab (a new visit) after the
// server confirms it again; without the box, after logging out, or once the server turns the token down, a new visit
// asks for the login again.
const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
const BASE = process.env.DFDF_BASE_URL || "http://127.0.0.1:3000";
(async () => {
  const f = await fixture();
  try {
    const context = await f.browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    // every tab of this context talks to the test server, as tabs of one browser would
    await context.route("**/api/v1?*", async (route) => {
      const result = await f.h.api(new URL(route.request().url()).searchParams.get("a"), route.request().postDataJSON() || {});
      await route.fulfill({ status: result.status, contentType: "application/json", body: JSON.stringify(result) });
    });
    await context.route("https://fonts.googleapis.com/**", (route) => route.abort());
    await context.route("https://fonts.gstatic.com/**", (route) => route.abort());
    await context.route("**/js/promo.js", async (route) => { const res = await route.fetch(); await route.fulfill({ response: res, body: (await res.text()).replace(/video: "https?:[^"]*"/, 'video: "PROMO_VIDEO_URL"') }); });
    const tab = async () => {
      const p = await context.newPage(); p.on("pageerror", (e) => f.errors.push(e.message));
      await p.goto(BASE + "/index.html", { waitUntil: "domcontentloaded" });
      await p.waitForFunction(() => !document.getElementById("v-auth").hidden || !document.getElementById("v-dash").hidden, null, { timeout: 30000 });
      return p;
    };
    const shown = (p) => p.evaluate(() => (!document.getElementById("v-dash").hidden ? "dash" : "auth"));
    const login = async (p, id, keep) => {
      await p.fill("#uid", id); await p.fill("#upw", "password");
      if (!keep) await p.locator("#keep").uncheck();
      await p.click("#doAuth");
      await p.waitForFunction(() => !document.getElementById("v-dash").hidden, null, { timeout: 30000 });
    };

    // 1. the box is there, ticked, with its label, in Korean
    let p = await tab();
    assert.equal(await shown(p), "auth");
    assert.equal(await p.locator("#keep").isChecked(), true);
    assert.equal((await p.locator(".keep").textContent()).trim(), "이 기기에서 로그인 유지");
    const box = await p.locator(".keep").boundingBox(); assert.ok(box.height >= 30, "a tappable row: " + box.height);
    await p.screenshot({ path: "test-results/keep-login-form.png" }).catch(() => {});
    await login(p, "keeper", true);
    const token = await p.evaluate(() => JSON.parse(localStorage.getItem("lgp_session")).token);
    assert.equal(await p.evaluate(() => localStorage.getItem("lgp_keep")), token);
    await p.close();

    // 2. a new visit: straight to the dashboard after the server says yes (me), and this tab now counts as signed in
    let me = 0; const count = (r) => { if (/[?&]a=me\b/.test(r.url())) me++; };
    context.on("request", count);
    p = await tab();
    await p.waitForFunction(() => !document.getElementById("v-dash").hidden, null, { timeout: 30000 });
    assert.ok(me >= 1, "the kept sign-in is checked with the server");
    assert.equal(await p.evaluate(() => sessionStorage.getItem("lgp_gate")), token);
    context.off("request", count);
    // the game page opens in this tab without being sent back to the homepage
    await p.goto(BASE + "/play.html", { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.GAME_BOOT && !document.documentElement.dataset.gameLoading, null, { timeout: 120000 });
    assert.equal(new URL(p.url()).pathname, "/play.html");
    await p.close();

    // 3. a game link opened in a new tab goes by the homepage, which signs in by itself
    p = await context.newPage(); p.on("pageerror", (e) => f.errors.push(e.message));
    await p.goto(BASE + "/play.html", { waitUntil: "domcontentloaded" });
    await p.waitForURL((u) => u.pathname === "/" || u.pathname === "/index.html", { timeout: 30000 });
    await p.waitForFunction(() => !document.getElementById("v-dash").hidden, null, { timeout: 30000 });
    await p.close();

    // 4. the server turns the token down (it was ended elsewhere): back to the login, nothing kept
    p = await tab();
    await p.evaluate(() => { const s = JSON.parse(localStorage.getItem("lgp_session")); s.token = "gone-token"; localStorage.setItem("lgp_session", JSON.stringify(s)); localStorage.setItem("lgp_keep", "gone-token"); });
    await p.close();
    p = await tab();
    await p.waitForFunction(() => !document.getElementById("v-auth").hidden, null, { timeout: 30000 });
    assert.equal(await p.evaluate(() => localStorage.getItem("lgp_keep")), null);

    // 5. without the box: a new visit asks again, with the id filled in
    await login(p, "keeper", false);
    assert.equal(await p.evaluate(() => localStorage.getItem("lgp_keep")), null);
    await p.close();
    p = await tab();
    assert.equal(await shown(p), "auth");
    assert.equal(await p.inputValue("#uid"), "keeper");

    // 6. logging out forgets the kept sign-in
    await login(p, "keeper", true);
    await p.click("#logout");
    assert.equal(await p.evaluate(() => [localStorage.getItem("lgp_keep"), localStorage.getItem("lgp_session")].join("|")), "|");
    await p.close();
    p = await tab();
    assert.equal(await shown(p), "auth");

    // 7. English
    await p.evaluate(() => localStorage.setItem("lgp_lang", "en")); await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => !document.getElementById("v-auth").hidden);
    assert.equal((await p.locator(".keep").textContent()).trim(), "Keep me signed in on this device");
    assert.deepEqual(f.errors, []);
    console.log("keep login passed: kept across tabs after a server check, game page, game link, refused token, unticked, logout, English");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
