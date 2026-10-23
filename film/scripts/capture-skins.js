// The armoury with every skin owned, one picture per skin on the same gun, for the skins beat.
// The film's account is signed up on the in-memory test API and given every skin with the owner
// page's own "grant all" (a_user_set op grant, item all); nothing touches production.
// Writes film/screens/14-skin-<id>.png and skins.json (which skins, their names and tiers as shown).
//   FILM_SKINS=phoenix,abyss node film/scripts/capture-skins.js
const path = require("node:path"), fs = require("node:fs");
const { chromium } = require("playwright");
const { harness } = require("../../tests/api-harness");
const BASE = process.env.DFDF_BASE_URL || "http://127.0.0.1:3000";
const OUT = path.resolve(__dirname, "../screens");
const GUN = process.env.FILM_GUN || "rifle";
const SKINS = (process.env.FILM_SKINS || "phoenix,abyss,synth,opal,galaxy,lava,storm,champion,laurel,kintsugi,prism,koi").split(",").filter(Boolean);
const ACCOUNT = { id: "hana", pw: "film-demo-1" };

(async () => {
  const h = harness({ now: Date.now() }), errors = [];
  const made = await h.api("auth", { id: ACCOUNT.id, pw: ACCOUNT.pw, device: "film-capture" });
  const owner = await h.api("auth", { id: "owner", pw: "owner-password", device: "film-capture" });
  const grant = await h.api("a_user_set", { atoken: owner.atoken, id: ACCOUNT.id, op: "grant", item: "all" });
  if (made.status !== 200 || grant.status !== 200) throw new Error("test account setup failed");
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || "/opt/pw-browsers/chromium", headless: true, args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const ctx = await browser.newContext({ locale: "ko-KR", timezoneId: "Asia/Seoul", serviceWorkers: "block", viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.25 });
  await ctx.addInitScript(() => { const original = requestAnimationFrame; window.requestAnimationFrame = (fn) => setTimeout(() => original(fn), 120); });
  await ctx.route("**/api/v1?*", async (route) => {
    const result = await h.api(new URL(route.request().url()).searchParams.get("a"), route.request().postDataJSON() || {});
    await route.fulfill({ status: result.status, contentType: "application/json", body: JSON.stringify(result) });
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(180000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.fill("#uid", ACCOUNT.id); await page.fill("#upw", ACCOUNT.pw);
  await page.locator("#doAuth").click();
  await page.waitForSelector("#enter:visible");
  await page.locator("#enter").click();
  await page.waitForFunction(() => window.GAME_BOOT && !document.documentElement.dataset.gameLoading);
  await page.evaluate(() => setQuality("visual"));
  await page.waitForTimeout(2000);
  const owned = await page.evaluate(async () => { for (let k = 0; k < 20 && !GUN_SKINS.mineItems().length; k++) { try { await GUN_SKINS.sync(); } catch (e) {} if (!GUN_SKINS.mineItems().length) await new Promise((r) => setTimeout(r, 1500)); } return GUN_SKINS.mineItems().length; });
  await page.evaluate(() => loadMap(MAP_LIST[0].key));
  await page.locator("#go-armory").click();
  await page.locator('#ar-tabs [data-tab="gun"]').click();
  await page.waitForTimeout(1500);
  // the gun list: pick the rifle by its data attribute (logged, in case the markup changes)
  const guns = await page.evaluate(() => [...document.querySelectorAll("#armory [data-g], #armory [data-gun], #armory [data-k]")].slice(0, 40).map((n) => ({ id: n.id, cls: n.className, g: n.dataset.g || n.dataset.gun || n.dataset.k, text: n.textContent.trim().slice(0, 20) })));
  const pick = await page.evaluate((gun) => { const n = document.querySelector(`#armory [data-g="${gun}"], #armory [data-gun="${gun}"], #armory [data-k="${gun}"]`); if (n) { n.click(); return true; } return false; }, GUN);
  await page.waitForTimeout(2000);
  const shot = [];
  for (const id of SKINS) {
    const ok = await page.locator(`#ar-skins [data-s="${id}"]`).click({ timeout: 10000 }).then(() => true, () => false);
    if (!ok) { errors.push("no tile for " + id); continue; }
    await page.waitForTimeout(3000);
    const file = `14-skin-${id}.png`;
    await page.screenshot({ path: path.join(OUT, file), timeout: 180000 });
    const shown = await page.evaluate(() => { const t = document.querySelector("#armory .ar-pv-name, #ar-pv-name, #armory h3"); return t ? t.textContent.trim().slice(0, 40) : null; });
    shot.push({ id, file, shown });
    console.log(id, file, shown);
  }
  const log = { capturedAt: new Date().toISOString(), account: { id: ACCOUNT.id, signup: made.status, grantAll: grant.status, owned }, gun: GUN, pickedGun: pick, guns, shot, errors };
  fs.writeFileSync(path.join(OUT, "skins.json"), JSON.stringify(log, null, 2) + "\n");
  console.log(JSON.stringify({ owned, pick, n: shot.length, errors }, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
