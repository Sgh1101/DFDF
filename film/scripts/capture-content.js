// Captures what is inside the game for the content beat: the agent grid with one agent's four
// abilities (one frame), six maps seen from the home screen's aerial camera, and the armoury's
// skins. Writes film/screens/11-abilities.png, 12-map-*.jpg, 13-skins.png and content.json
// (GAME_CATALOG.counts() — the counts the game computes at runtime — and what was shot).
//   FILM_MAPS=pogu,neon node film/scripts/capture-content.js   (default: the six in the film)
const path = require("node:path"), fs = require("node:fs");
const { chromium } = require("playwright");
const { harness } = require("../../tests/api-harness");
const BASE = process.env.DFDF_BASE_URL || "http://127.0.0.1:3000";
const OUT = path.resolve(__dirname, "../screens");
const MAPS = (process.env.FILM_MAPS || "pogu,neon,shift,train,nightport,dunes").split(",").filter(Boolean);

(async () => {
  const h = harness({ now: Date.now() }), errors = [];
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || "/opt/pw-browsers/chromium", headless: true, args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const ctx = await browser.newContext({ locale: "ko-KR", timezoneId: "Asia/Seoul", serviceWorkers: "block", viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.25 });
  // the notice card (#np-back) is the homepage's, not part of the film's path: never in a frame
  await ctx.addInitScript(() => {
    try { localStorage.setItem("lgp_notice_seen", "film"); } catch (e) {}
    const st = () => { const s = document.createElement("style"); s.textContent = "#np-back,#np{display:none!important}"; (document.head || document.documentElement).appendChild(s); };
    document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", st) : st();
  });
  await ctx.addInitScript(() => { const original = requestAnimationFrame; window.requestAnimationFrame = (fn) => setTimeout(() => original(fn), 120); });
  await ctx.route("**/api/v1?*", async (route) => {
    const result = await h.api(new URL(route.request().url()).searchParams.get("a"), route.request().postDataJSON() || {});
    await route.fulfill({ status: result.status, contentType: "application/json", body: JSON.stringify(result) });
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(180000);
  page.on("pageerror", (e) => errors.push(e.message));
  const shot = (name) => page.screenshot({ path: path.join(OUT, name + ".png"), timeout: 180000 });
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.locator("#doGuest").click();
  await page.waitForSelector("#enter:visible");
  await page.locator("#enter").click();
  await page.waitForFunction(() => window.GAME_BOOT && !document.documentElement.dataset.gameLoading);
  await page.evaluate(() => setQuality("visual"));
  await page.waitForTimeout(2000);
  const counts = await page.evaluate(() => GAME_CATALOG.counts());
  const homeFoot = await page.evaluate(() => document.querySelector(".title-foot")?.textContent || null);

  // the agent grid once every visible portrait is drawn, with the selected agent's four
  // abilities scrolled into view in the same frame
  await page.locator("#go-play").click();
  const started = Date.now();
  for (;;) {
    await page.waitForTimeout(5000);
    const [cards, drawn] = await page.evaluate(() => { const c = [...document.querySelectorAll("#sel-grid > *")].filter((n) => { const r = n.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight - 200; }); return [c.length, c.filter((n) => n.querySelector("canvas, img") && [...n.querySelectorAll("img")].every((i) => i.complete && i.naturalWidth > 0)).length]; });
    if ((cards > 0 && drawn >= cards && Date.now() - started > 30000) || Date.now() - started > 120000) break;
  }
  const agent = await page.evaluate(() => { const a = picked || AGENTS[0]; return { key: a.key, name: a.name, abilities: (a.abilities || []).map((x) => x.name) }; });
  await page.evaluate(() => { const ab = document.querySelector("#sel-detail .ab"); ab && ab.scrollIntoView({ block: "start" }); });
  await page.waitForTimeout(1500);
  await shot("11-abilities");
  await page.locator("#sel-back").click();

  // maps from the home screen's own aerial camera, UI hidden
  const all = await page.evaluate(() => MAP_LIST.map((m) => ({ key: m.key, name: m.name || m.label || m.key })));
  const keys = MAPS;
  const shotMaps = [];
  for (const key of keys) {
    try {
      await page.evaluate((k) => { loadMap(k); titleAngle = 0.9; }, key);
      await page.waitForTimeout(3500);
      await page.evaluate(() => { document.querySelectorAll(".screen, #hud, .home-guide, #acct-notice").forEach((n) => (n.style.visibility = "hidden")); titleCam(0); render(); });
      await page.waitForTimeout(600);
      const file = `12-map-${key}.jpg`;
      await page.screenshot({ path: path.join(OUT, file), type: "jpeg", quality: 92, timeout: 180000 });
      shotMaps.push({ key, name: all.find((m) => m.key === key)?.name, file });
      await page.evaluate(() => document.querySelectorAll(".screen, #hud, .home-guide, #acct-notice").forEach((n) => (n.style.visibility = "")));
    } catch (e) { errors.push(key + ": " + e.message); }
  }

  // the armoury's skins for one gun
  await page.evaluate(() => loadMap(MAP_LIST[0].key));
  await page.locator("#go-armory").click();
  await page.locator('#ar-tabs [data-tab="gun"]').click();
  await page.waitForTimeout(1500);
  await page.locator('#ar-skins [data-s="dragon"]').click().catch(() => {});
  await page.waitForTimeout(2500);
  await shot("13-skins");

  const log = { capturedAt: new Date().toISOString(), base: BASE, counts, homeFoot, agent, maps: all, shotMaps, errors };
  fs.writeFileSync(path.join(OUT, "content.json"), JSON.stringify(log, null, 2) + "\n");
  console.log(JSON.stringify({ counts, homeFoot, agent, shotMaps: shotMaps.map((m) => m.key + " " + m.name), nMaps: all.length, errors }, null, 2));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
