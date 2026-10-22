// Captures the real screens the film is built from: a fresh guest on the local API
// harness, Korean locale, real web fonts. Writes film/screens/*.png and
// film/screens/path.json (every click from the link to a live round, plus the counts
// read from the running game). Staged steps (closing the shop, planting the spike
// with the game's own plantSpike) are listed in path.json as "staged".
const path = require("node:path"), fs = require("node:fs");
const { chromium } = require("playwright");
const { harness } = require("../../tests/api-harness");
const BASE = process.env.DFDF_BASE_URL || "http://127.0.0.1:3000";
const OUT = path.resolve(__dirname, "../screens");
const CHROME = process.env.CHROME_BIN || "/opt/pw-browsers/chromium";
const SIGNUP = { id: "hana", pw: "film-demo-1" }; // typed into the landing form; the harness makes the account

async function prepare(context, h) {
  // Same rAF throttle as scripts/browser-fixture.js so SwiftShader keeps up.
  await context.addInitScript(() => { const original = requestAnimationFrame; window.requestAnimationFrame = (fn) => setTimeout(() => original(fn), 120); });
  context.on("response", async (r) => { if (r.url().includes("/api/") && !r.url().includes("/api/v1?")) console.error("unrouted api", r.status(), r.url()); });
  context.on("requestfailed", (r) => { if (r.url().includes("/api/")) console.error("failed api", r.url(), r.failure() && r.failure().errorText); });
  await context.route("**/api/v1?*", async (route) => {
    const result = await h.api(new URL(route.request().url()).searchParams.get("a"), route.request().postDataJSON() || {});
    await route.fulfill({ status: result.status, contentType: "application/json", body: JSON.stringify(result) });
  });
}
const press = (page, selector) => page.evaluate((s) => document.querySelector(s).click(), selector);
const booted = (page) => page.waitForFunction(() => window.GAME_BOOT && !document.documentElement.dataset.gameLoading, null, { timeout: 180000 });
// Network toasts from the local harness under SwiftShader load are not part of the game; wait them out.
const settled = (page) => page.waitForFunction(() => ![...document.querySelectorAll("body *")].some((n) => n.offsetParent && n.childElementCount === 0 && /요청 시간이 초과|offline/.test(n.textContent)), null, { timeout: 60000 });
const inRound = (page) => page.waitForFunction(() => window.world && world.actors && world.actors.length > 0 && typeof myActor === "function" && myActor(), null, { timeout: 180000 });

(async () => {
  const h = harness({ now: Date.now() }), errors = [], clicks = [], staged = [];
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + ".png"), timeout: 180000 });
  const ko = { locale: "ko-KR", timezoneId: "Asia/Seoul", serviceWorkers: "block" };

  // Desktop: from the link to a live round, counting every click.
  const desk = await browser.newContext({ ...ko, viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.25 });
  await prepare(desk, h);
  const page = await desk.newPage();
  page.setDefaultTimeout(120000);
  page.on("pageerror", (e) => errors.push(e.message));
  const click = async (selector) => {
    const label = (await page.locator(selector).innerText()).split("\n")[0].trim();
    const box = await page.locator(selector).boundingBox();
    clicks.push({ step: clicks.length + 1, page: new URL(page.url()).pathname, selector, label, box });
    await page.locator(selector).click();
  };
  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(800);
  await shot(page, "01-landing");
  // sign up the way the film shows it: pick an id and a password, one click (a new id is an account)
  await page.locator("#uid").fill(SIGNUP.id); await page.locator("#upw").fill(SIGNUP.pw);
  await page.waitForTimeout(300);
  await shot(page, "01b-landing-typed");
  await click("#doAuth");
  await page.waitForSelector("#enter:visible");
  await page.waitForTimeout(800);
  await shot(page, "02-landing-in");
  await click("#enter");
  await booted(page);
  await page.waitForTimeout(3000);
  await shot(page, "03-home");
  const home = await page.evaluate(() => ({ solo: document.querySelector("#go-play")?.innerText.replace(/\s+/g, " ").trim(), together: document.querySelector("#go-host")?.innerText.replace(/\s+/g, " ").trim() }));
  await click("#go-play");
  await page.waitForTimeout(1500);
  await shot(page, "04-select");
  const roster = await page.evaluate(() => ({
    agents: AGENTS.length,
    abilitySlots: [...new Set(AGENTS.map((a) => (a.abilities || []).length))],
    keysShown: [...document.querySelectorAll("#sel-detail .ab")].map((n) => n.innerText.trim().split(/\s+/)[0]),
  }));
  await click("#sel-go");
  await inRound(page);
  await page.waitForTimeout(4000);
  await shot(page, "05-buy");
  const teams = await page.evaluate(() => {
    const me = myActor();
    return { total: world.actors.length, myTeam: me.team, mine: world.actors.filter((a) => a.team === me.team).length, theirs: world.actors.filter((a) => a.team !== me.team).length, mode: room && room.mode, phase: world.phase };
  });
  staged.push("05→06: ADMIN.freezeAI=true and closeShop() (solo pauses the clock while the shop is open), buy timer set to 0.01 s, so the game's own step() opens the round (clock 1:40, shop closes)");
  await page.evaluate(() => { closeShop(); ADMIN.freezeAI = true; world.roundTime = 0.01; });
  await page.waitForFunction(() => world.phase === "live");
  await page.waitForTimeout(3000);
  await settled(page);
  await shot(page, "06-live");
  const hud = await page.evaluate(() => {
    const r = (n) => { const b = n.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; };
    const roster = document.querySelector("#roster");
    return { roster: r(roster), faces: [...roster.children].filter((n) => n.offsetWidth > 0).map(r), clock: r(document.querySelector("#tb-time")), abilities: [...document.querySelectorAll("#abar > *, .abar > *, #abilities > *")].filter((n) => n.offsetWidth > 0).map(r) };
  });
  staged.push("06→07: player moved to the first site centre, then plantSpike() — the game's own plant routine");
  const plant = await page.evaluate(() => {
    const me = myActor(), site = MAP.sites[0];
    const x = site.x ?? site.cx ?? (site.x0 + site.x1) / 2, z = site.z ?? site.cz ?? (site.z0 + site.z1) / 2;
    me.pos.x = x + 2.2; me.pos.z = z + 2.2; if (window.player && player !== me && player.pos) { player.pos.x = me.pos.x; player.pos.z = me.pos.z; }
    me.yaw = Math.atan2(2.2, 2.2); me.pitch = -0.45;
    plantSpike(x, z, site, me.team === "atk");
    return { site: site.id, team: me.team, state: world.spike.state, fuse: world.spike.timer };
  });
  await page.waitForTimeout(1200);
  await settled(page);
  await shot(page, "07-planted");
  const spikeOnScreen = await page.evaluate(() => {
    const v = world.spike.mesh.position.clone(); v.y += 0.4; v.project(camera);
    return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight };
  });

  // Phone landscape with touch, same game, same path (FILM_NO_PHONE=1 skips it; the film does not use it).
  let touch = null;
  if (process.env.FILM_NO_PHONE !== "1") {
  const phone = await browser.newContext({ ...ko, viewport: { width: 852, height: 393 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36" });
  await prepare(phone, h);
  const mp = await phone.newPage();
  mp.setDefaultTimeout(120000);
  mp.on("pageerror", (e) => errors.push("phone: " + e.message));
  await mp.goto(BASE + "/", { waitUntil: "networkidle", timeout: 120000 });
  await mp.locator("#uid").fill(SIGNUP.id + "m"); await mp.locator("#upw").fill(SIGNUP.pw);
  await press(mp, "#doAuth");
  await mp.waitForSelector("#enter:visible");
  await press(mp, "#enter");
  await booted(mp);
  await mp.waitForTimeout(2500);
  await shot(mp, "08-phone-home");
  await press(mp, "#go-play");
  await mp.waitForTimeout(1500);
  await press(mp, "#sel-go");
  await inRound(mp);
  await mp.waitForTimeout(4000);
  await mp.evaluate(() => { closeShop(); ADMIN.freezeAI = true; world.roundTime = 0.01; });
  await mp.waitForFunction(() => world.phase === "live");
  await mp.waitForTimeout(3000);
  await settled(mp);
  await shot(mp, "09-phone-live");
  touch = await mp.evaluate(() => [...document.querySelectorAll("[id*=touch],[class*=touch],[id*=joy],[class*=joy]")].filter((n) => n.offsetWidth > 0).length);
  }

  const log = { capturedAt: new Date().toISOString(), base: BASE, chromium: browser.version(), viewport: { width: 1600, height: 900, deviceScaleFactor: 1.25 }, signup: SIGNUP.id, clicks, home, roster, teams, plant, hud, spikeOnScreen, touchControlsVisible: touch, staged, errors };
  fs.writeFileSync(path.join(OUT, "path.json"), JSON.stringify(log, null, 2) + "\n");
  console.log(JSON.stringify(log, null, 2));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
