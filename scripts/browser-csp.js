// The Content-Security-Policy in vercel.json (scripts/build-csp.js), put on every page the way the host does: the game to
// the start of a solo match, the home page signed in (menus, my records), the owner's page, the site pages. Nothing of the
// site's own may be blocked (a violation event or a console message), and injected script is: an inline <script>, an
// inline event attribute, a script from another host.
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { fixture } = require("./browser-fixture");

const config = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "vercel.json"), "utf8"));
const CSP = config.headers.flatMap((r) => r.headers).find((h) => h.key === "Content-Security-Policy").value;
const BASE = process.env.DFDF_BASE_URL || "http://127.0.0.1:3000";

// every document answers with the policy; a violation is noted in the page (window.__csp) and in the console
const withPolicy = async (page, seen) => {
  await page.route("**/*", async (route) => {
    if (route.request().resourceType() !== "document") return route.fallback();
    const res = await route.fetch();
    await route.fulfill({ response: res, headers: { ...res.headers(), "content-security-policy": CSP } });
  });
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => __csp.push(e.violatedDirective + " " + e.blockedURI + " " + (e.sample || "").slice(0, 50)));
  });
  page.on("console", (m) => /Content Security Policy|Content-Security-Policy/.test(m.text()) && seen.push(m.text().slice(0, 200)));
};
const violations = async (page, seen) => [...new Set([...(await page.evaluate(() => window.__csp || [])), ...seen])];

(async () => {
  const f = await fixture(), seen = [];
  try {
    assert.match(CSP, /script-src 'self' 'unsafe-hashes' 'sha256-/);
    assert.ok(!/script-src[^;]*'unsafe-inline'/.test(CSP), "inline script is allowed by hash only");

    // 1. the game, to the start of a solo match
    const game = await f.page("cspgame", { width: 1280, height: 800 }, {}, { bootTimeout: 120000, beforeLoad: (p) => withPolicy(p, seen) });
    await game.waitForFunction(() => window.GAME_BOOT && !document.documentElement.dataset.gameLoading);
    await game.locator("#go-play").click();
    if (await game.locator("#sel-pick").isVisible()) await game.locator("#sel-pick").click();
    await game.locator("#sel-go").click();
    await game.waitForFunction(() => !!myActor(), null, { timeout: 120000 });
    await game.waitForTimeout(3000);
    assert.deepEqual(await violations(game, seen), [], "the game: nothing of ours is blocked");

    // 2. injected script is blocked: an inline block, an event attribute, a script from another host
    const injected = await game.evaluate(async () => {
      const s = document.createElement("script"); s.textContent = "window.__inline = 1"; document.head.append(s);
      const d = document.createElement("div"); d.innerHTML = '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" onload="window.__attr = 1">'; document.body.append(d);
      const x = document.createElement("script"); x.src = "https://evil.example/x.js"; document.head.append(x);
      await new Promise((r) => setTimeout(r, 500));
      return { inline: window.__inline, attr: window.__attr, log: window.__csp.slice() };
    });
    assert.equal(injected.inline, undefined, "an injected inline script did not run");
    assert.equal(injected.attr, undefined, "an injected event attribute did not run");
    assert.ok(injected.log.some((l) => l.startsWith("script-src") && l.includes("evil.example")), "the other host's script was blocked: " + injected.log);

    // 3. the home page signed in, and the owner's page (their own contexts; the API is the fixture's)
    const open = async (url, check) => {
      const ctx = await f.browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: "block" }), page = await ctx.newPage(), mine = [];
      page.on("pageerror", (e) => mine.push("pageerror " + e.message));
      await page.route("**/api/v1?*", async (route) => {
        const result = await f.h.api(new URL(route.request().url()).searchParams.get("a"), route.request().postDataJSON() || {});
        await route.fulfill({ status: result.status, contentType: "application/json", body: JSON.stringify(result) });
      });
      await page.route(/fonts\.(googleapis|gstatic)\.com|13fps-film\.vercel\.app/, (r) => r.abort());
      // the notice card that comes up after signing in would cover the buttons: no film, as in the fixture's pages
      await page.route("**/js/promo.js", async (route) => { const res = await route.fetch(); await route.fulfill({ response: res, body: (await res.text()).replace(/video: "https?:[^"]*"/, 'video: "PROMO_VIDEO_URL"') }); });
      await withPolicy(page, mine);
      await page.goto(BASE + url, { waitUntil: "domcontentloaded" });
      await check(page);
      const out = await violations(page, mine);
      await ctx.close();
      return out;
    };
    assert.deepEqual(await open("/index.html", async (p) => {
      await p.waitForSelector("#doGuest", { state: "visible" }); await p.click("#doGuest");
      await p.waitForSelector("#v-dash:not([hidden])");
      await p.click("#guideBtn"); await p.keyboard.press("Escape"); await p.click("#menuBtn"); await p.keyboard.press("Escape");
      await p.click("#recLink"); await p.waitForSelector("#v-rec:not([hidden])");
    }), [], "the home page");
    assert.deepEqual(await open("/admin.html", async (p) => {
      await p.fill("#pw", "owner-password"); await p.click("#go");
      await p.waitForSelector("#app:not([hidden])");
    }), [], "the owner's page");

    // 4. the site pages
    for (const name of ["about", "guide", "controls", "modes", "maps", "agents", "patch-notes", "contact", "privacy"]) assert.deepEqual(await open("/" + name + ".html", async (p) => { await p.waitForLoadState("load"); }), [], name + ".html");
    assert.deepEqual(f.errors, []);
    console.log("csp: the game to a solo match, the home page, the owner's page and the site pages run under the policy with nothing blocked; injected inline script, an event attribute and another host's script are blocked");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
