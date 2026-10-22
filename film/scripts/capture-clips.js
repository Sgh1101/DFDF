// Records moving pictures from the running game as JPEG frame sequences, by stepping the
// game's own loop one frame at a time (requestAnimationFrame is switched off, then tick(t)
// is called with t advancing 1/fps per frame, so simulation, bots and rendering all run at
// a fixed rate no matter how slow the software renderer is).
//   node film/scripts/capture-clips.js            -> film/screens/clips/<name>/NNN.jpg + clips.json
//   FILM_CLIPS=open node film/scripts/capture-clips.js   (one clip)
//   FILM_PROBE=1 ...                               (10 frames per clip, to time it)
const path = require("node:path"), fs = require("node:fs");
const { chromium } = require("playwright");
const { harness } = require("../../tests/api-harness");
const BASE = process.env.DFDF_BASE_URL || "http://127.0.0.1:3000";
const OUT = path.resolve(__dirname, "../screens/clips");
const PROBE = process.env.FILM_PROBE === "1";
const ONLY = (process.env.FILM_CLIPS || "").split(",").filter(Boolean);

// A clip is a plan: which map and agent, and what the player does on each second.
// mv: [strafe, forward] like gatherInput; yaw/pitch in radians; q/fire: press on that frame.
const CLIPS = [
  { name: "open", map: "glacier", agent: "hwaryeong", fps: 30, seconds: 5, mode: "round",
    script: (t, a) => ({ mv: [0, t < 4.2 ? -1 : 0], yaw: a.yaw0 + 0.35 * Math.sin(t * 0.9) * Math.min(1, t), pitch: -0.06 + 0.03 * Math.sin(t * 1.7), q: Math.abs(t - 1.5) < 0.02, fire: t > 3.0 && t < 3.6 }) },
  { name: "cast", map: "neon", agent: "hwaryeong", fps: 30, seconds: 2.5, mode: "round",
    script: (t, a) => ({ mv: [0, t < 0.4 ? -1 : 0], yaw: a.yaw0 + 0.15 * Math.sin(t * 1.3), pitch: -0.04, q: Math.abs(t - 0.5) < 0.02, e: Math.abs(t - 1.4) < 0.02, fire: t > 2.0 && t < 2.4 }) },
  // the home screen's own orbit (titleCam from js/legacy/08-…js), advanced 0.2 s per frame
  { name: "map-pogu", map: "pogu", fps: 24, seconds: 2, mode: "orbit", step: 0.2 },
  { name: "map-neon", map: "neon", fps: 24, seconds: 2, mode: "orbit", step: 0.2 },
  { name: "map-train", map: "train", fps: 24, seconds: 2, mode: "orbit", step: 0.2 },
];

(async () => {
  const h = harness({ now: Date.now() }), errors = [], log = { capturedAt: new Date().toISOString(), clips: [] };
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || "/opt/pw-browsers/chromium", headless: true, args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const ctx = await browser.newContext({ locale: "ko-KR", timezoneId: "Asia/Seoul", serviceWorkers: "block", viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.2 });
  await ctx.route("**/api/v1?*", async (route) => {
    const result = await h.api(new URL(route.request().url()).searchParams.get("a"), route.request().postDataJSON() || {});
    await route.fulfill({ status: result.status, contentType: "application/json", body: JSON.stringify(result) });
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(240000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.locator("#doGuest").click();
  await page.waitForSelector("#enter:visible");
  await page.locator("#enter").click();
  await page.waitForFunction(() => window.GAME_BOOT && !document.documentElement.dataset.gameLoading);
  await page.evaluate(() => setQuality("visual"));
  await page.waitForTimeout(1500);

  for (const clip of CLIPS) {
    if (ONLY.length && !ONLY.includes(clip.name)) continue;
    const dir = path.join(OUT, clip.name); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const frames = PROBE ? 10 : clip.fps * clip.seconds, t0 = Date.now();
    if (clip.mode === "round") {
      await page.evaluate(({ map, agent }) => {
        room.mode = "std"; room.map = map; startGame(AGENTS.find((a) => a.key === agent) || AGENTS[0], false); closeShop();
        const me = myActor(); me.weapons.primary = "rifle"; me.slot = "primary"; me.ammo.rifle = 30; me.reserve.rifle = 90;
        world.roundTime = 0.01;
      }, { map: clip.map, agent: clip.agent });
      await page.waitForFunction(() => world.phase === "live");
      // take the loop over: no more animation frames, we call tick ourselves. There is no
      // pointer lock in headless Chrome, which the game answers by pausing: pretend it is locked.
      await page.evaluate(() => { window.requestAnimationFrame = () => 0; window.__yaw0 = myActor().yaw; window.__clipT = performance.now(); locked = true; updateLockHint(); document.getElementById("pause").hidden = true; });
      await page.waitForTimeout(400);
      console.log(clip.name, "map", await page.evaluate(() => CUR_MAP_KEY), "phase", await page.evaluate(() => world.phase));
      for (let i = 0; i < frames; i++) {
        const t = i / clip.fps, a = { yaw0: await page.evaluate(() => window.__yaw0) };
        const cmd = clip.script(t, a);
        await page.evaluate(({ cmd, dt, i }) => {
          document.getElementById("pause").hidden = true;
          // network toasts from the test API under load are not the game: keep them out of the picture
          for (const n of document.querySelectorAll("body *")) if (n.childElementCount === 0 && /서버 응답|요청 시간이 초과|offline/.test(n.textContent)) n.style.display = "none";
          const me = myActor(); me.hp = 100; me.alive = true;
          keys.w = cmd.mv[1] < 0; keys.s = cmd.mv[1] > 0; keys.a = cmd.mv[0] < 0; keys.d = cmd.mv[0] > 0; keys.fire = !!cmd.fire;
          me.yaw = cmd.yaw; me.pitch = cmd.pitch; if (me.input) { me.input.yaw = me.yaw; me.input.pitch = me.pitch; }
          if (cmd.q) useAbility(0);
          if (cmd.e) useAbility(1);
          window.__clipT += dt * 1000;
          tick(window.__clipT);
        }, { cmd, dt: 1 / clip.fps, i });
        await page.screenshot({ path: path.join(dir, String(i).padStart(3, "0") + ".jpg"), type: "jpeg", quality: 80 });
        if (i % 30 === 0) console.log(clip.name, i, "/", frames, ((Date.now() - t0) / 1000).toFixed(0) + "s");
      }
      await page.evaluate(() => { keys.w = keys.s = keys.a = keys.d = keys.fire = false; world.phase = "menu"; show("s-title"); });
    } else {
      await page.evaluate(({ map }) => { window.requestAnimationFrame = () => 0; loadMap(map); titleCam(0.001); document.querySelectorAll(".screen, #hud, #tb-menu, .home-guide, #acct-notice").forEach((n) => (n.style.visibility = "hidden")); }, { map: clip.map });
      await page.waitForTimeout(3000);
      for (let i = 0; i < frames; i++) {
        await page.evaluate(({ step }) => { titleCam(step); render(); }, { step: clip.step });
        await page.screenshot({ path: path.join(dir, String(i).padStart(3, "0") + ".jpg"), type: "jpeg", quality: 80 });
        if (i % 24 === 0) console.log(clip.name, i, "/", frames, ((Date.now() - t0) / 1000).toFixed(0) + "s");
      }
      await page.evaluate(() => document.querySelectorAll(".screen, #hud, #tb-menu, .home-guide, #acct-notice").forEach((n) => (n.style.visibility = "")));
    }
    log.clips.push({ name: clip.name, map: clip.map, fps: clip.fps, frames, seconds: frames / clip.fps, took: (Date.now() - t0) / 1000 });
    console.log("done", clip.name, frames, "frames in", ((Date.now() - t0) / 1000).toFixed(0) + "s");
  }
  log.errors = errors;
  fs.writeFileSync(path.join(OUT, "clips.json"), JSON.stringify(log, null, 2) + "\n");
  console.log(JSON.stringify(log));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
