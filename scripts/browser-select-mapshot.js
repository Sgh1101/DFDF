const assert = require("node:assert/strict"), fs = require("fs"), path = require("path"), { fixture } = require("./browser-fixture");
// The map on the agent select screen: the picked map, drawn from above at an angle by the game's renderer, is
// the screen's backdrop with its name, team size and footprint in the corner of the map bar; picking another
// map takes a new picture, going back to a map already seen shows it without loading it again, a match in
// progress never loads another map for it, and on a phone the picture heads the map sheet.
const pictureStats = (page, key) => page.evaluate(async (key) => {
  const url = SELECT_MAPSHOT.cache.get(key);
  if (!url) return null;
  const img = new Image();
  await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = url; });
  const c = document.createElement("canvas"); c.width = 64; c.height = 36;
  const x = c.getContext("2d"); x.drawImage(img, 0, 0, 64, 36);
  const d = x.getImageData(0, 0, 64, 36).data;
  let s = 0, s2 = 0;
  for (let i = 0; i < d.length; i += 4) { const v = (d[i] + d[i + 1] + d[i + 2]) / 3; s += v; s2 += v * v; }
  const n = d.length / 4, mean = s / n;
  return { w: img.width, h: img.height, mean, sd: Math.sqrt(s2 / n - mean * mean) };
}, key);
(async () => {
  const f = await fixture();
  const dir = process.env.SHOT_DIR || "test-results/select-mapshot";
  fs.mkdirSync(dir, { recursive: true });
  try {
    const page = await f.page("selmapshot", { width: 1280, height: 720 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.mouse.click(640, 360);
    await page.evaluate(() => { window.__loads = []; const lm = loadMap; loadMap = function (k) { __loads.push(k); return lm.apply(this, arguments); }; document.getElementById("go-play").click(); });
    await page.waitForFunction(() => SELECT_MAPSHOT.cache.has(room.map), null, { timeout: 20000 });
    const first = await page.evaluate(() => ({ key: room.map, has: document.getElementById("s-select").classList.contains("has-mapshot"), bg: getComputedStyle(document.getElementById("s-select")).backgroundImage.includes("data:image/jpeg"), cap: document.getElementById("sel-mapcap").textContent, capShown: !document.getElementById("sel-mapcap").hidden, pick: (() => { const b = document.getElementById("sel-pick"); return b && getComputedStyle(b).display !== "none" ? b.textContent : ""; })() }));
    const pic = await pictureStats(page, first.key);
    await page.screenshot({ path: path.join(dir, "desktop.png") });
    // another map
    const second = await page.evaluate(() => { const c = [...document.querySelectorAll("#sel-maps .lb-map")].find((b) => !b.classList.contains("on") && /모래무덤/.test(b.textContent)); c.click(); return "dunes"; });
    await page.waitForFunction((k) => SELECT_MAPSHOT.cache.has(k) && room.map === k, second, { timeout: 20000 });
    const after = await page.evaluate(() => ({ cur: CUR_MAP_KEY, cap: document.getElementById("sel-mapcap").textContent, loads: __loads.slice() }));
    // back to the first: shown at once from the picture already taken, no new load
    const back = await page.evaluate(async (k) => {
      const n = __loads.length;
      [...document.querySelectorAll("#sel-maps .lb-map")].find((b) => b.textContent.includes("빙하 관측소")).click();
      await new Promise((ok) => setTimeout(ok, 120));
      return { url: getComputedStyle(document.getElementById("s-select")).getPropertyValue("--mapshot").includes(SELECT_MAPSHOT.cache.get(k).slice(30, 90)), cap: document.getElementById("sel-mapcap").textContent, newLoads: __loads.length - n };
    }, first.key);
    // a match in progress: the picker never loads another map
    const live = await page.evaluate(async () => {
      world.phase = "live";
      const n = __loads.length, cur = CUR_MAP_KEY;
      room.map = "jungle"; SELECT_MAPSHOT.check();
      await new Promise((ok) => setTimeout(ok, 3200));
      const out = { newLoads: __loads.length - n, cur: CUR_MAP_KEY === cur, cached: SELECT_MAPSHOT.cache.has("jungle") };
      world.phase = "menu";
      return out;
    });
    console.log(JSON.stringify({ first, pic, after, back, live }));
    assert.ok(first.has && first.bg, "the select screen's backdrop is the map picture");
    assert.ok(first.cap.includes("빙하 관측소") && /5대5/.test(first.cap) && /\d+×\d+m/.test(first.cap), "the corner names the map, its team size and footprint (" + first.cap + ")");
    // a screen up to 920px tall folds the map chips into one button that names the map, as a phone does; a taller
    // one keeps the chips and names it in the corner
    assert.ok(first.capShown || first.pick.includes("빙하 관측소"), "the name shows on a wide screen (" + JSON.stringify(first.pick) + ")");
    assert.ok(pic && pic.w >= 640 && pic.sd > 12, "the picture is a drawn map, not a blank frame");
    assert.equal(after.cur, "dunes", "picking another map loads it");
    assert.ok(after.cap.includes("모래무덤"), "and the corner follows");
    assert.equal(back.newLoads, 0, "going back to a map already seen loads nothing");
    assert.ok(back.url && back.cap.includes("빙하 관측소"), "its picture shows again at once");
    assert.equal(live.newLoads, 0, "a match in progress never loads another map for the picture");
    assert.ok(live.cur && !live.cached, "the match keeps its map");
    await page.context().close();

    // phone: the picture heads the map sheet; the bar has no room for the name, the map button names it
    const phone = await f.page("selmapshotphone", { width: 852, height: 393 }, { hasTouch: true, isMobile: true });
    phone.on("pageerror", (e) => errors.push(e.message));
    await phone.evaluate(() => document.getElementById("go-play").click());
    await phone.waitForFunction(() => SELECT_MAPSHOT.cache.has(room.map), null, { timeout: 20000 });
    await phone.evaluate(() => document.getElementById("sel-pick").click());
    await phone.waitForTimeout(300);
    const sheet = await phone.evaluate(() => { const c = document.getElementById("sel-mapcard"), r = c.getBoundingClientRect(); return { shown: getComputedStyle(c).display !== "none" && r.height > 40, bg: getComputedStyle(c).backgroundImage.includes("data:image/jpeg"), capHidden: document.getElementById("sel-mapcap").hidden, inView: r.top >= 0 && r.bottom <= innerHeight }; });
    await phone.screenshot({ path: path.join(dir, "phone-sheet.png") });
    console.log(JSON.stringify({ sheet }));
    assert.ok(sheet.shown && sheet.bg && sheet.inView, "on a phone the map sheet starts with the picture");
    assert.ok(sheet.capHidden, "the name is left to the map button on a phone");
    assert.deepEqual(errors, [], "no page errors");
    console.log("Select map shot: backdrop picture with name, team size and footprint; new map loads and is pictured, a seen map comes back without loading, none loaded in a match, phone sheet shows the picture");
  } finally { await f.browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
