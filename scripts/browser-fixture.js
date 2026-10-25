const { chromium } = require(process.env.DFDF_PLAYWRIGHT_MODULE || "playwright");
const { harness } = require("../tests/api-harness");
async function fixture() {
  const h = harness({ now: Date.now() }), errors = [];
  const browser = await chromium.launch({ ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {}), headless: true, args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const owner = await h.api("auth", { id: "owner", pw: "owner-password", device: "browser-owner-device" });
  async function page(id, viewport = { width: 852, height: 393 }, contextOptions = {}, options = {}) {
    const session = await h.api("auth", { id, pw: options.pw || "password", device: "browser-test-" + id });
    for (const item of ["rifle|dragon", "rpg|dragon"]) await h.api("a_user_set", { atoken: owner.atoken, id, op: "grant", item });
    const context = await browser.newContext({ viewport, serviceWorkers: "block", ...contextOptions });
    const page = await context.newPage(); page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.text().includes("network alert")) console.log(id, message.text().slice(0, 180)); });
    await page.route("**/api/v1?*", async (route) => {
      const result = await h.api(new URL(route.request().url()).searchParams.get("a"), route.request().postDataJSON() || {});
      await route.fulfill({ status: result.status, contentType: "application/json", body: JSON.stringify(result) });
    });
    if (process.env.DFDF_THREE_PATH) await page.route("https://cdnjs.cloudflare.com/ajax/libs/three.js/**", (route) => route.fulfill({ path: process.env.DFDF_THREE_PATH, contentType: "text/javascript" }));
    if (process.env.DFDF_PEERJS_PATH) await page.route("**/peerjs.min.js", (route) => route.fulfill({ path: process.env.DFDF_PEERJS_PATH, contentType: "text/javascript" }));
    // the homepage's notice card (js/notice-popup.js) would cover its buttons after every sign-in: the film is left out
    // (the placeholder address) unless a test is about it (options.promo)
    if (!options.promo) await page.route("**/js/promo.js", async (route) => { const res = await route.fetch(); await route.fulfill({ response: res, body: (await res.text()).replace(/video: "https?:[^"]*"/, 'video: "PROMO_VIDEO_URL"'), contentType: "text/javascript" }); });
    await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
    await page.route("https://fonts.gstatic.com/**", (route) => route.abort());
    await page.addInitScript((s) => {
      if (!sessionStorage.getItem("dfdf_fixture_seeded")) {
        localStorage.setItem("lgp_session", JSON.stringify(s)); sessionStorage.setItem("lgp_gate", s.token);
        sessionStorage.setItem("dfdf_fixture_seeded", "1");
      }
      const original = requestAnimationFrame; window.requestAnimationFrame = (fn) => setTimeout(() => original(fn), 120);
    }, session);
    if (options.beforeLoad) await options.beforeLoad(page);
    await page.goto((process.env.DFDF_BASE_URL || "http://127.0.0.1:3000") + (options.path || "/play.html"), { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForFunction(() => window.GAME_BOOT && !document.documentElement.dataset.gameLoading, null, { timeout: options.bootTimeout || Number(process.env.DFDF_BOOT_TIMEOUT) || 90000 }).catch(async error => {
      error.message += "\nBoot diagnostics: " + JSON.stringify({ errors, state: await page.evaluate(() => ({ boot: !!window.GAME_BOOT, loading: document.documentElement.dataset.gameLoading, alerts: [...document.querySelectorAll('.game-load-error')].map(n => n.textContent) })) });
      throw error;
    });
    if (options.quality !== false) await page.evaluate(q => setQuality(q), options.quality || "mobile");
    if (options.syncSkins !== false) await page.evaluate(() => GUN_SKINS.sync());
    console.log("loaded browser account", id);
    return page;
  }
  return { browser, h, page, errors };
}
module.exports = { fixture };
