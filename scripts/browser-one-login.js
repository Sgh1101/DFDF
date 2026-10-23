const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// One signed-in tab per browser: two tabs of ONE browser context share localStorage. The tab that signs in last keeps
// the account; the older one is sent back to the homepage login (the storage listeners in index.html and
// game-events.js). A tab that is only at the login screen moves nobody.
(async () => {
  const f = await fixture();
  try {
    const A = await f.page("tablocka", { width: 960, height: 540 }, {}, { quality: "perf" });
    const open = async () => {
      const page = await A.context().newPage(); page.on("pageerror", (e) => f.errors.push(e.message));
      await page.route("**/api/v1?*", async (route) => {
        const r = await f.h.api(new URL(route.request().url()).searchParams.get("a"), route.request().postDataJSON() || {});
        await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r) });
      });
      if (process.env.DFDF_THREE_PATH) await page.route("https://cdnjs.cloudflare.com/ajax/libs/three.js/**", (route) => route.fulfill({ path: process.env.DFDF_THREE_PATH, contentType: "text/javascript" }));
      if (process.env.DFDF_PEERJS_PATH) await page.route("**/peerjs.min.js", (route) => route.fulfill({ path: process.env.DFDF_PEERJS_PATH, contentType: "text/javascript" }));
      await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
      await page.route("https://fonts.gstatic.com/**", (route) => route.abort());
      await page.goto((process.env.DFDF_BASE_URL || "http://127.0.0.1:3000") + "/", { waitUntil: "domcontentloaded", timeout: 120000 });
      return page;
    };
    const state = (p) => p.evaluate(() => ({ flag: sessionStorage.getItem("lgp_gate") ? "yes" : "no", id: (JSON.parse(localStorage.getItem("lgp_session") || "null") || { user: {} }).user.id }));
    // the second tab is the homepage (a play page without a login goes there)
    const homeSignIn = async (p, id) => {
      await p.waitForSelector("#uid", { state: "visible", timeout: 30000 });
      await p.fill("#uid", id); await p.fill("#upw", "password"); await p.click("#doAuth");
      await p.waitForFunction(() => !!sessionStorage.getItem("lgp_gate"), null, { timeout: 30000 });
    };
    // 1. A is in
    let a = await state(A);
    assert.deepEqual([a.flag, a.id], ["yes", "tablocka"]);
    // 2. a second tab only shows the login: A is not touched
    const B = await open();
    await B.waitForSelector("#uid", { state: "visible", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 800));
    a = await state(A);
    assert.equal(a.flag, "yes", "a tab at the login screen moves nobody");
    // 3. B signs in as someone else: A is signed out, B keeps the account
    await homeSignIn(B, "tablockb");
    await A.waitForFunction(() => /\/$|\/\?/.test(location.pathname + location.search) || location.pathname.endsWith("/index.html"), null, { timeout: 15000 });
    await A.waitForSelector("#uid", { state: "visible", timeout: 30000 });
    assert.equal((await state(A)).flag, "no", "the older tab is back at the login");
    const b = await state(B);
    assert.deepEqual([b.flag, b.id], ["yes", "tablockb"]);
    // 4. the older tab signs in again: now it is the newest, B is signed out
    await homeSignIn(A, "tablocka");
    await B.waitForSelector("#uid", { state: "visible", timeout: 15000 });
    assert.equal((await state(B)).flag, "no");
    assert.equal((await state(A)).id, "tablocka");
    assert.deepEqual(f.errors, []);
    console.log("One login per browser: a tab at the login moves nobody, the last sign-in keeps the account and the older tab goes back to the login. Browser only.");
  } finally { await f.browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
