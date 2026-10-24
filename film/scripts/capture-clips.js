// Records moving pictures from the running game as JPEG frame sequences, by stepping the
// game's own loop one frame at a time (requestAnimationFrame is switched off, then tick(t)
// is called with t advancing 1/fps per frame, so simulation, bots and rendering all run at
// a fixed rate no matter how slow the software renderer is).
//
// A virtual clock runs the page while a round clip records: performance.now(), setTimeout and
// the page's CSS animations all follow t, so effects the game times in real time (the kill
// banner's pop, the headshot X, the kill flash, a legendary skin's finisher) play at their own
// speed in the clip instead of finishing between two frames.
//
//   node film/scripts/capture-clips.js            -> film/screens/clips/<name>/NNN.jpg + clips.json
//   FILM_CLIPS=open node film/scripts/capture-clips.js   (one clip)
//   FILM_PROBE=1 ...                               (10 frames per clip, to time it)
//   FILM_EVERY=6 ...                               (step every frame, keep every 6th picture: a fast look)
const path = require("node:path"), fs = require("node:fs");
const { chromium } = require("playwright");
const { harness } = require("../../tests/api-harness");
const BASE = process.env.DFDF_BASE_URL || "http://127.0.0.1:3000";
const OUT = process.env.FILM_OUT ? path.resolve(process.env.FILM_OUT) : path.resolve(__dirname, "../screens/clips"); // FILM_OUT: try a plan without touching the real clips
const PROBE = process.env.FILM_PROBE === "1";
const EVERY = Math.max(1, +process.env.FILM_EVERY || 1);
const ONLY = (process.env.FILM_CLIPS || "").split(",").filter(Boolean);
// the account the path screens sign up with; on the in-memory test API the owner's
// "grant every skin" (the owner page's button: a_user_set op grant, item all) is run on it first
const ACCOUNT = { id: "hana", pw: "film-demo-1" };

const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
// A clip is a plan: which map and agent, and what the player does on each second.
// mv: [strafe, forward] like gatherInput; yaw/pitch in radians; q/fire: press on that frame.
// aim: [from, to, mix] blends the free look (-1) and the head of foe n, so a flick lands on a head.
const OPEN_SHOTS = [24, 28, 40, 44]; // frames at 30 fps: two taps on each head (the Phantom is 660 rpm: 2.7 frames apart). Early on purpose: the Champions finisher's dragon rises 2.66 s after the last kill and the film shrinks the picture into a window at 2.5 s, so the later the kills, the less of the dragon is seen
const CLIPS = [
  // the opening: walk out of spawn, two taps to one head, flick, two taps to the next (hip fire:
  // aiming down sights puts the rifle's front sight over the target's head in this game; at 6-7 m the
  // hip spread, 0.018 rad, still keeps a first shot inside the 0.17 m head sphere).
  // The other three enemies are taken out by teammates before the clip starts, so the second kill
  // ends the round and the Champions skin plays its finisher over where that enemy fell.
  { name: "open", map: "glacier", agent: "hwaryeong", fps: 30, seconds: 5, mode: "round", gun: "scout", skin: { scout: "champions_atk" },
    // spawn points are picked at random each round: start from one of glacier's (probed, open ahead).
    // The player stops walking at 0.25 s and is standing still by the first shot (the spread grows with
    // speed: 0.34 × m/s); the foes are about 6 m away, where the hip spread (±0.018 rad) stays inside the head.
    // Heavy armour on both (what bots usually buy): a head shot is 102 before fall-off, so it takes two.
    duel: { at: { x: -132.545, z: -6.183, yaw: -Math.PI / 2 }, foes: [{ d: 9.8, l: 2.4, armor: 50 }, { d: 10.3, l: -1.5, armor: 50 }] },
    script: (t, a) => {
      const i = Math.round(t * 30), last = OPEN_SHOTS.filter((f) => f < i).pop();
      const kick = last == null || OPEN_SHOTS.includes(i) ? 0 : 0.012 * Math.exp(-(i - last) / 1.8); // the camera's recoil after a shot, recovered in a few frames
      const sway = 0.035 * Math.sin(t * 1.3);
      const aim = t < 0.4 ? [-1, -1, 0] : t < 0.98 ? [-1, 0, ease((t - 0.4) / 0.32)] : t < 1.22 ? [0, 1, ease((t - 0.98) / 0.24)] : [1, 1, 1];
      const after = ease((t - 1.6) / 1.2); // after the round ends: lift the eyes to the finisher over the body
      return { mv: [0, t < 0.25 ? -1 : 0], yaw: a.yaw0 + sway, pitch: -0.03, aim, dpitch: kick + 0.1 * after, dyaw: 0.02 * Math.sin(t * 0.9) * after,
        fire: OPEN_SHOTS.includes(i) };
    } },
  { name: "cast", map: "neon", agent: "hwaryeong", fps: 30, seconds: 2.5, mode: "round", skin: { rifle: "abyss" },
    script: (t, a) => ({ mv: [0, t < 0.4 ? -1 : 0], yaw: a.yaw0 + 0.15 * Math.sin(t * 1.3), pitch: -0.04, q: Math.abs(t - 0.5) < 0.02, e: Math.abs(t - 1.4) < 0.02, fire: t > 2.0 && t < 2.4 }) },
  // the home screen's own orbit (titleCam from js/legacy/08-…js), advanced 0.2 s per frame
  { name: "map-pogu", map: "pogu", fps: 24, seconds: 2, mode: "orbit", step: 0.2 },
  { name: "map-neon", map: "neon", fps: 24, seconds: 2, mode: "orbit", step: 0.2 },
  { name: "map-train", map: "train", fps: 24, seconds: 2, mode: "orbit", step: 0.2 },
];

// the virtual clock (installed for a round clip, removed after it)
function installClock() {
  const W = window;
  if (!W.__real) W.__real = { now: performance.now.bind(performance), st: W.setTimeout.bind(W), ct: W.clearTimeout.bind(W) };
  W.__clipT = W.__real.now();
  performance.now = () => W.__clipT;
  const timers = new Map(), frames = new Map(); let id = 1e9;
  W.setTimeout = (fn, ms, ...args) => { const k = ++id; timers.set(k, { due: W.__clipT + (+ms || 0), fn, args }); return k; };
  W.clearTimeout = (k) => (timers.has(k) ? timers.delete(k) : W.__real.ct(k));
  // tick() asks for the next frame itself; we call it, so only other callers are queued
  W.requestAnimationFrame = (cb) => { if (cb === W.tick) return 0; const k = ++id; frames.set(k, cb); return k; };
  W.cancelAnimationFrame = (k) => frames.delete(k);
  // draw = false: simulate without painting (the software renderer is most of a frame's cost)
  W.__advance = (ms, draw = true) => {
    W.__clipT += ms;
    if (draw) W.tick(W.__clipT); else { const rr = renderer.render; renderer.render = () => {}; try { W.tick(W.__clipT); } finally { renderer.render = rr; } }
    for (let n = 0; n < 200; n++) { let k = null, v = null; for (const [kk, vv] of timers) if (vv.due <= W.__clipT && (!v || vv.due < v.due)) { k = kk; v = vv; } if (!v) break; timers.delete(k); try { typeof v.fn === "function" ? v.fn(...v.args) : 0; } catch (e) {} }
    const now = [...frames]; frames.clear(); for (const [, cb] of now) { try { cb(W.__clipT); } catch (e) {} }
    for (const an of document.getAnimations()) { if (an.__v0 == null) { an.__v0 = W.__clipT; an.pause(); } an.currentTime = W.__clipT - an.__v0; }
  };
}
function removeClock() {
  const W = window; if (!W.__real) return;
  performance.now = W.__real.now; W.setTimeout = W.__real.st; W.clearTimeout = W.__real.ct;
  W.requestAnimationFrame = () => 0;
  for (const an of document.getAnimations()) an.play();
}

(async () => {
  const h = harness({ now: Date.now() }), errors = [], log = { capturedAt: new Date().toISOString(), clips: [] };
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || "/opt/pw-browsers/chromium", headless: true, args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const ctx = await browser.newContext({ locale: "ko-KR", timezoneId: "Asia/Seoul", serviceWorkers: "block", viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.2 });
  await ctx.route("**/api/v1?*", async (route) => {
    const result = await h.api(new URL(route.request().url()).searchParams.get("a"), route.request().postDataJSON() || {});
    await route.fulfill({ status: result.status, contentType: "application/json", body: JSON.stringify(result) });
  });
  // sign the film's account up on the test API and give it every skin the way the owner page does
  const made = await h.api("auth", { id: ACCOUNT.id, pw: ACCOUNT.pw, device: "film-capture" });
  const owner = await h.api("auth", { id: "owner", pw: "owner-password", device: "film-capture" });
  const grant = await h.api("a_user_set", { atoken: owner.atoken, id: ACCOUNT.id, op: "grant", item: "all" });
  // the Champions Phantom skins are coin-only (not in "all"): the owner page grants them one by one, "gun|skin"
  const grantChampions = await Promise.all(["champions_atk", "champions_def"].map((s) => h.api("a_user_set", { atoken: owner.atoken, id: ACCOUNT.id, op: "grant", item: "scout|" + s })));
  log.championsGrant = grantChampions.map((r) => r.status);
  log.account = { id: ACCOUNT.id, signup: made.status, grantAll: grant.status };
  if (made.status !== 200 || grant.status !== 200) throw new Error("test account setup failed: " + JSON.stringify(log.account));
  const page = await ctx.newPage();
  page.setDefaultTimeout(240000);
  page.on("pageerror", (e) => errors.push(e.message));
  // the notice card (#np-back) and the header's ▶ 홍보영상 button (#promo-open) are the homepage's, not the game's: never in a clip
  await page.addInitScript(() => {
    try { localStorage.setItem("lgp_notice_seen", "film"); } catch (e) {}
    const st = () => { const s = document.createElement("style"); s.textContent = "#np-back,#np,#promo-open{display:none!important}"; (document.head || document.documentElement).appendChild(s); };
    document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", st) : st();
  });
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.fill("#uid", ACCOUNT.id); await page.fill("#upw", ACCOUNT.pw);
  await page.locator("#doAuth").click();
  await page.waitForSelector("#enter:visible");
  await page.locator("#enter").click();
  await page.waitForFunction(() => window.GAME_BOOT && !document.documentElement.dataset.gameLoading);
  await page.evaluate(() => setQuality("visual"));
  await page.waitForTimeout(1500);
  log.owned = await page.evaluate(async () => { for (let k = 0; k < 20 && !GUN_SKINS.mineItems().length; k++) { try { await GUN_SKINS.sync(); } catch (e) {} if (!GUN_SKINS.mineItems().length) await new Promise((r) => setTimeout(r, 1500)); } return GUN_SKINS.mineItems().length; });
  await page.waitForFunction(() => window.CHAMPIONS_PHANTOM && CHAMPIONS_PHANTOM.loaded(), null, { timeout: 120000 });
  await page.evaluate(`window.installClock = ${installClock.toString()}; window.removeClock = ${removeClock.toString()};`);
  console.log("signed in as", ACCOUNT.id, "skins owned", log.owned);

  for (const clip of CLIPS) {
    if (ONLY.length && !ONLY.includes(clip.name)) continue;
    const dir = path.join(OUT, clip.name); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const frames = PROBE ? 10 : clip.fps * clip.seconds, t0 = Date.now();
    if (clip.mode === "round") {
      await page.evaluate(({ map, agent, skin, clip }) => {
        room.mode = "std"; room.map = map; startGame(AGENTS.find((a) => a.key === agent) || AGENTS[0], false); closeShop();
        const me = myActor(); const gun = clip.gun || "rifle"; me.weapons.primary = gun; me.slot = "primary"; me.ammo[gun] = 30; me.reserve[gun] = 90;
        window.__skinSet = Object.entries(skin || {}).map(([g, s]) => [g, s, GUN_SKINS.set(g, s)]);
        world.roundTime = 0.01;
      }, { map: clip.map, agent: clip.agent, skin: clip.skin, clip: { gun: clip.gun } });
      // take the loop over: no more animation frames, we call tick ourselves. There is no
      // pointer lock in headless Chrome, which the game answers by pausing: pretend it is locked.
      // The buy phase ends inside tick(), so we step until the round is live.
      await page.evaluate(() => { installClock(); locked = true; updateLockHint(); });
      await page.waitForTimeout(300);
      await page.evaluate(() => { for (let i = 0; i < 120 && world.phase !== "live"; i++) { locked = true; document.getElementById("pause").hidden = true; __advance(50, false); } window.__yaw0 = myActor().yaw; });
      if (await page.evaluate(() => world.phase) !== "live") throw new Error(clip.name + ": the round did not go live");
      console.log(clip.name, "live");
      // a duel: bots hold still (they still turn and shoot), the player takes no damage, the foes
      // stand where the plan says, the rest of their team is taken out by ours and the kill feed clears
      const staged = clip.duel ? await page.evaluate((duel) => {
        ADMIN.freezeAI = true; ADMIN.god = true;
        // the two foes are random agents; a Spider's silk or a sleep powder aimed at the player pulls or roots him
        // (and prints "거미줄 이동" / "잠듦" over the picture) before the first shot. A duel has no casting.
        if (!window.__noCast) { window.__noCast = true; const _s = aiUseSkill, _b = botCast; aiUseSkill = function () { if (window.__duelClip) return; return _s.apply(this, arguments); }; botCast = function () { if (window.__duelClip) return; return _b.apply(this, arguments); }; }
        window.__duelClip = true;
        const me = myActor();
        if (duel.at) { me.pos.x = duel.at.x; me.pos.z = duel.at.z; me.y = groundAt(me.pos.x, me.pos.z, me.y + 2); me.yaw = duel.at.yaw; if (me.input) me.input.yaw = me.yaw; if (me.vel) { me.vel.x = 0; me.vel.z = 0; } }
        const y = me.yaw, f = [-Math.sin(y), -Math.cos(y)], r = [Math.cos(y), -Math.sin(y)];
        const foes = world.actors.filter((a) => a.team !== me.team && a.alive), mates = world.actors.filter((a) => a.team === me.team && a !== me);
        window.__foes = foes.slice(0, duel.foes.length);
        // keep it a duel: once the clip's foes are set, only my shots at them do damage (teammates
        // that cannot move still shoot, and would take the foes before I do)
        if (!window.__guarded) { window.__guarded = true; const _d = dealDamage; dealDamage = function (e, t, o, a) { if (window.__duel && !(a === myActor() && window.__foes.includes(e))) return; return _d.apply(this, arguments); }; }
        window.__duel = false;
        window.__foes.forEach((a, k) => { const p = duel.foes[k], x = me.pos.x + f[0] * p.d + r[0] * p.l, z = me.pos.z + f[1] * p.d + r[1] * p.l;
          a.pos.x = x; a.pos.z = z; a.y = groundAt(x, z, me.y + 2); if (a.vel) { a.vel.x = 0; a.vel.z = 0; } a.crouch = false; if (p.armor != null) a.armor = p.armor;
          a.__check = { free: !collideXZ(x, z, a.y + 1, 0.45), seen: !rayBlocked(me.pos.x, actorEye(me), me.pos.z, x, a.y + 1.86, z), y: a.y }; });
        foes.slice(duel.foes.length).forEach((a, k) => dealDamage(a, 999, false, mates[k % mates.length]));
        // teammates stand behind the camera, out of the picture (they cannot move, and one stood in the line of fire)
        mates.forEach((a, k) => { const x = me.pos.x - f[0] * (5 + 1.5 * k) + r[0] * (k % 2 ? 1.5 : -1.5), z = me.pos.z - f[1] * (5 + 1.5 * k) + r[1] * (k % 2 ? 1.5 : -1.5);
          if (!collideXZ(x, z, me.y + 1, 0.45)) { a.pos.x = x; a.pos.z = z; a.y = groundAt(x, z, me.y + 2); } });
        window.__duel = true;
        for (let i = 0; i < 240; i++) { locked = true; document.getElementById("pause").hidden = true; __advance(1000 / 30, false); }
        // a smoke a frozen bot threw at the round start hangs over the left of the view: let it run out now
        const smokes = world.smokes.length; for (const m of world.smokes) m.life = 0; __advance(1000 / 30, false);
        window.__yaw0 = me.yaw;
        return { smokesCleared: smokes, smokesLeft: world.smokes.length, at: { x: me.pos.x, z: me.pos.z, yaw: me.yaw }, foes: window.__foes.map((a) => ({ name: a.name, hp: a.hp, armor: a.armor, d: Math.hypot(a.pos.x - me.pos.x, a.pos.z - me.pos.z), check: a.__check })), others: foes.slice(duel.foes.length).map((a) => ({ name: a.name, alive: a.alive })), phase: world.phase, clock: world.roundTime };
      }, clip.duel) : null;
      // what happens in the clip, for the sound cues and SOURCES.md: my hits, my kills, a finisher
      await page.evaluate(() => {
        window.__frame = -1; window.__events = [];
        if (!window.__hooked) { window.__hooked = true;
          const _dd = dealDamage; dealDamage = function (e, t, o, a) { const was = e && e.alive; const r = _dd.apply(this, arguments); if (was && !e.alive && a === myActor()) __events.push({ frame: __frame, kill: e.name, head: !!o, d: +Math.hypot(e.pos.x - a.pos.x, e.pos.z - a.pos.z).toFixed(2) }); return r; };
          const _hm = hitMarker; hitMarker = function (h) { __events.push({ frame: __frame, hit: h ? "head" : "body" }); return _hm.apply(this, arguments); };
          if (window.FINISHER_LEGEND) { const _p = FINISHER_LEGEND.play; FINISHER_LEGEND.play = function (ev, skin) { __events.push({ frame: __frame, finisher: skin && skin.id }); return _p.apply(this, arguments); }; }
          if (window.CHAMPIONS_PHANTOM) { const _f = CHAMPIONS_PHANTOM.finisher; CHAMPIONS_PHANTOM.finisher = function (g, skin, ev) { __events.push({ frame: __frame, finisher: skin && skin.id, champions: true }); return _f.apply(this, arguments); }; }
        } });
      await page.waitForTimeout(400);
      console.log(clip.name, "map", await page.evaluate(() => CUR_MAP_KEY), "phase", await page.evaluate(() => world.phase), "skin", JSON.stringify(await page.evaluate(() => window.__skinSet)), "staged", JSON.stringify(staged));
      for (let i = 0; i < frames; i++) {
        const t = i / clip.fps, a = { yaw0: await page.evaluate(() => window.__yaw0) };
        const cmd = clip.script(t, a);
        await page.evaluate(({ cmd, dt, i, draw, dbg }) => {
          // the pointer-lock change event (there is no pointer lock here) flips `locked` back and
          // shows the "click the screen" hint; every frame says again that we are locked
          locked = true; document.getElementById("pause").hidden = true; const lh = document.getElementById("lockhint"); if (lh) lh.hidden = true;
          // network toasts from the test API under load are not the game: keep them out of the picture
          for (const n of document.querySelectorAll("body *")) if (n.childElementCount === 0 && /서버 응답|요청 시간이 초과|offline/.test(n.textContent)) n.style.display = "none";
          const me = myActor(); me.hp = 100; me.alive = true; window.__frame = i;
          keys.w = cmd.mv[1] < 0; keys.s = cmd.mv[1] > 0; keys.a = cmd.mv[0] < 0; keys.d = cmd.mv[0] > 0; keys.fire = !!cmd.fire; keys.ads = !!cmd.ads;
          let yaw = cmd.yaw, pitch = cmd.pitch;
          if (cmd.aim) {
            // a head: the centre of the hit sphere the game tests (js/legacy/11-walls-…js: y + 1.86 × BODY_K
            // standing, radius 0.17 × BODY_K), which is also the middle of the drawn head, seen from the eye
            const K = typeof BODY_K === "number" ? BODY_K : 1;
            const look = (n) => { if (n < 0) return [cmd.yaw, cmd.pitch]; const a = __foes[n]; if (a.alive) a.__head = { x: a.pos.x, y: a.y + (a.crouch ? 1.47 : 1.86) * K, z: a.pos.z };
              const h = a.__head, dx = h.x - me.pos.x, dy = h.y - actorEye(me), dz = h.z - me.pos.z; return [Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz))]; };
            const [f, t, m] = cmd.aim, A = look(f), B = look(t), d = Math.atan2(Math.sin(B[0] - A[0]), Math.cos(B[0] - A[0]));
            yaw = A[0] + d * m; pitch = A[1] + (B[1] - A[1]) * m;
          }
          yaw += cmd.dyaw || 0; pitch += cmd.dpitch || 0;
          me.yaw = yaw; me.pitch = pitch; if (me.input) { me.input.yaw = me.yaw; me.input.pitch = me.pitch; }
          if (cmd.q) useAbility(0);
          if (cmd.e) useAbility(1);
          if (cmd.fire && window.__events) __events.push({ frame: i, fire: true, speed: me.vel ? +Math.hypot(me.vel.x, me.vel.z).toFixed(2) : null });
          __advance(dt * 1000, draw);
          if (dbg && i >= 38 && i <= 70 && i % 3 === 0) { const k = document.getElementById("killfx"), b = document.getElementById("kf-badge"), r = b.getBoundingClientRect(); __events.push({ dbg: i, cls: k.className, hidden: k.hidden, rect: [r.x, r.y, r.width, r.height].map(Math.round).join(","), op: getComputedStyle(b).opacity, disp: getComputedStyle(k).display, anim: getComputedStyle(b).animationName, bg: getComputedStyle(b).backgroundImage.slice(0, 50), main: document.getElementById("kf-main").textContent }); }
        }, { cmd, dt: 1 / clip.fps, i, draw: i % EVERY === 0 || i === frames - 1, dbg: !!process.env.FILM_DEBUG });
        if (i % EVERY === 0 || i === frames - 1) await page.screenshot({ path: path.join(dir, String(i).padStart(3, "0") + ".jpg"), type: "jpeg", quality: 80 });
        if (i % 30 === 0) console.log(clip.name, i, "/", frames, ((Date.now() - t0) / 1000).toFixed(0) + "s");
      }
      clip.events = await page.evaluate(() => window.__events);
      clip.staged = staged;
      clip.skinSet = await page.evaluate(() => window.__skinSet);
      console.log(clip.name, "events", JSON.stringify(clip.events));
      await page.evaluate(() => { keys.w = keys.s = keys.a = keys.d = keys.fire = keys.ads = false; ADMIN.freezeAI = false; ADMIN.god = false; window.__duel = false; world.phase = "menu"; window.__duelClip = false; show("s-title"); removeClock(); });
    } else {
      await page.evaluate(({ map }) => { window.requestAnimationFrame = () => 0; loadMap(map); titleCam(0.001); document.querySelectorAll(".screen, #hud, #tb-menu, #lockhint, .home-guide, #acct-notice").forEach((n) => (n.style.visibility = "hidden")); const lh = document.getElementById("lockhint"); if (lh) lh.hidden = true; }, { map: clip.map });
      await page.waitForTimeout(3000);
      for (let i = 0; i < frames; i++) {
        await page.evaluate(({ step }) => { titleCam(step); render(); }, { step: clip.step });
        await page.screenshot({ path: path.join(dir, String(i).padStart(3, "0") + ".jpg"), type: "jpeg", quality: 80 });
        if (i % 24 === 0) console.log(clip.name, i, "/", frames, ((Date.now() - t0) / 1000).toFixed(0) + "s");
      }
      await page.evaluate(() => document.querySelectorAll(".screen, #hud, #tb-menu, .home-guide, #acct-notice").forEach((n) => (n.style.visibility = "")));
    }
    log.clips.push({ name: clip.name, map: clip.map, agent: clip.agent, skin: clip.skin, fps: clip.fps, frames, seconds: frames / clip.fps, events: clip.events, staged: clip.staged, skinSet: clip.skinSet, took: (Date.now() - t0) / 1000 });
    console.log("done", clip.name, frames, "frames in", ((Date.now() - t0) / 1000).toFixed(0) + "s");
  }
  log.errors = errors;
  // one clip re-recorded keeps the record of the others
  const prev = fs.existsSync(path.join(OUT, "clips.json")) ? JSON.parse(fs.readFileSync(path.join(OUT, "clips.json"), "utf8")) : { clips: [] };
  const mine = new Set(log.clips.map((c) => c.name));
  log.clips = [...(prev.clips || []).filter((c) => !mine.has(c.name)), ...log.clips];
  fs.writeFileSync(path.join(OUT, "clips.json"), JSON.stringify(log, null, 2) + "\n");
  console.log(JSON.stringify(log));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
