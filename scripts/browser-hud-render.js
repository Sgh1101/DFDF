const assert = require("node:assert/strict"), fs = require("node:fs"), { fixture } = require("./browser-fixture");
// Frame work: the HUD is drawn once per rendered frame (not per simulation step), the two maps on a wall clock, nothing while the tab
// is hidden; no frames are drawn behind agent select, the lobby, the results or a paused solo match; the title is capped at about
// 30 fps; the grenade / inspect buttons are measured only when something that moves them changed; the roster counters, the
// crosshair and the hit-direction glow no longer rewrite the DOM or repaint a gradient every frame.
// Explored the title, agent select, a solo match (paused, shop, results) and a phone-size match in the browser first (test-results/hud-render-*.png).
// Frames come from timers at 60 Hz (the fixture's own rAF is slowed to 8 fps) and the 3D draw is counted instead of done.
(async () => {
  const f = await fixture();
  const step = (page, ms) => page.waitForTimeout(ms);
  const setup = (page, refreshMs = 16) => page.evaluate((ms) => {
    window.requestAnimationFrame = (fn) => setTimeout(() => fn(performance.now()), ms);
    const C = (window.__c = { frames: 0, passes: 0, inPost: 0, hud: 0, cross: 0, mini: 0, tac: 0, steps: 0, real: false });
    const rr = renderer.render.bind(renderer);
    renderer.render = function (s, c) { C.passes++; C.inPost || c !== camera || C.frames++; return C.real ? rr(s, c) : undefined; };
    const pr = postRender; postRender = function () { C.frames++; C.inPost++; try { return pr.apply(this, arguments); } finally { C.inPost--; } };
    const wrap = (name, key) => { const o = window[name]; window[name] = function () { C[key]++; return o.apply(this, arguments); }; };
    wrap("updateHUD", "hud"); wrap("updateCross", "cross"); wrap("drawMini", "mini"); wrap("drawTac", "tac"); wrap("step", "steps");
  }, refreshMs);
  const frames = (page) => page.evaluate(() => window.__c.frames);
  const counts = (page) => page.evaluate(() => ({ ...window.__c }));
  const reset = (page) => page.evaluate(() => { for (const k of ["frames", "passes", "hud", "cross", "mini", "tac", "steps"]) window.__c[k] = 0; });
  const startMatch = (page, touch) => page.evaluate((touch) => {
    room.mode = "std"; room.map = "field"; startGame(AGENTS[0], false); closeShop(); world.phase = "live"; world.roundTime = 9999; ADMIN.freezeAI = true;
    if (touch) document.body.classList.add("touching");
    const me = myActor(); me.nades = 2; me.invuln = 1e6;
    if (touch) try { GUN_SKINS.set(curWeaponKey(), "dragon"); } catch (e) {} // a skin of a high tier shows the inspect button
  }, touch);
  try {
    // ── desktop: title, select, lobby, match, pause, shop, results ──
    const page = await f.page("hudr1", { width: 960, height: 540 }, {}, { quality: "visual" });
    await setup(page);
    await step(page, 2500);
    await reset(page); await step(page, 2000);
    let c = await counts(page);
    console.log("title (visual):", c.frames / 2, "frames/s");
    assert.ok(c.frames / 2 >= 15 && c.frames / 2 <= 36, "the full title is drawn at about 30 fps, not at every refresh: " + c.frames / 2);
    await page.locator("#go-play").click();
    if (await page.locator("#sel-pick").isVisible().catch(() => false)) await page.locator("#sel-pick").click();
    await page.waitForFunction(() => !document.getElementById("s-select").hidden);
    await step(page, 1200);
    await reset(page); await step(page, 1500);
    c = await counts(page);
    console.log("agent select:", c.frames, "frames in 1.5 s");
    assert.ok(c.frames <= 1, "nothing is drawn behind agent select: " + c.frames);
    await page.screenshot({ path: "test-results/hud-render-select.png" });
    await page.evaluate(() => { document.getElementById("s-select").hidden = true; document.getElementById("lobby").hidden = false; });
    await step(page, 400); await reset(page); await step(page, 1500);
    c = await counts(page);
    console.log("lobby:", c.frames, "frames in 1.5 s");
    assert.equal(c.frames, 0, "nothing is drawn behind the lobby");
    await page.evaluate(() => { document.getElementById("lobby").hidden = true; });
    await startMatch(page, false);
    await step(page, 800); await reset(page); await step(page, 1000);
    c = await counts(page);
    console.log("live:", c.frames, "frames/s, hud", c.hud, "mini", c.mini, "tac", c.tac, "steps", c.steps);
    assert.ok(c.frames >= 25, "a live match draws every frame: " + c.frames);
    assert.ok(c.hud <= c.frames + 1 && c.hud >= c.frames - 2, `the HUD is updated once per drawn frame: ${c.hud} for ${c.frames}`);
    assert.ok(c.mini >= 8 && c.mini <= 20 && c.tac >= 8 && c.tac <= 20, `the maps are redrawn about 15 times a second: mini ${c.mini}, tac ${c.tac}`);
    // pause: drawn once when it opens, again after a resize or a click inside it, then stopped; resumes when closed
    // (the first one or two frames come when the screen opens; opening the shop is slow here, so wait until they are done)
    const quiet = async (label, ms = 1500) => { for (let i = 0, n = -1; i < 20 && n !== (n = await frames(page)); i++) await step(page, 600); await reset(page); await step(page, ms); const n = await frames(page); console.log(label + ":", n, "frames in", ms, "ms"); assert.equal(n, 0, label + " draws nothing while nothing changes"); };
    await page.evaluate(() => togglePause(true));
    await quiet("solo pause");
    await page.screenshot({ path: "test-results/hud-render-pause.png" });
    await reset(page); await page.setViewportSize({ width: 1000, height: 540 }); await step(page, 600);
    assert.ok((await frames(page)) >= 1, "a resize draws the paused scene again");
    await quiet("solo pause after a resize");
    await reset(page); await page.evaluate(() => document.querySelector("#pause .pz-tabs button").click()); await step(page, 400);
    assert.ok((await frames(page)) >= 1, "a click inside the pause screen (a setting) draws the scene again");
    await page.evaluate(() => togglePause(false));
    await step(page, 500); await reset(page); await step(page, 1000);
    assert.ok((await frames(page)) >= 25, "closing the pause screen draws every frame again");
    await page.evaluate(() => { world.phase = "buy"; openShop(); });
    await quiet("solo shop");
    await page.evaluate(() => { closeShop(); world.phase = "live"; });
    await step(page, 500);
    // results
    await page.evaluate(() => gameOver());
    await page.waitForFunction(() => !document.getElementById("s-over").hidden);
    await quiet("results screen");
    await reset(page); await page.setViewportSize({ width: 960, height: 540 }); await step(page, 600);
    assert.ok((await frames(page)) >= 1, "a resize draws the scene behind the results again");
    await page.screenshot({ path: "test-results/hud-render-results.png" });
    await page.context().close();

    // ── one HUD update per rendered frame, however many steps the frame ran ──
    const p2 = await f.page("hudr2", { width: 960, height: 540 }, {}, { quality: "mobile" });
    await setup(p2); await startMatch(p2, false); await step(p2, 800);
    const r = await p2.evaluate(() => {
      const C = window.__c, out = {}, raf = window.requestAnimationFrame;
      window.requestAnimationFrame = () => 0; // the manual frames below must not start more loops
      const reset = () => { for (const k of ["frames", "hud", "cross", "mini", "tac", "steps"]) C[k] = 0; };
      reset(); tick(last + 300); out.hitch = { ...C };  // a 300 ms hitch: the frame runs its substeps
      reset(); const t0 = performance.now(); for (let i = 0; i < 120; i++) tick(last + 7); out.burst = { ...C, ms: performance.now() - t0 };
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      reset(); tick(last + 16); out.hiddenTab = { ...C };
      delete document.hidden;
      reset(); step(0.03); out.bgStep = { ...C };  // the hidden host's timer calls step() on its own
      window.requestAnimationFrame = raf;
      return out;
    });
    console.log("hitch frame:", JSON.stringify(r.hitch), "| burst:", JSON.stringify(r.burst), "| hidden tab:", JSON.stringify(r.hiddenTab), "| step():", JSON.stringify(r.bgStep));
    assert.ok(r.hitch.steps >= 2, "the hitch ran substeps: " + r.hitch.steps);
    assert.equal(r.hitch.hud, 1, "one HUD update for a frame of several steps"); assert.equal(r.hitch.cross, 1);
    assert.equal(r.burst.hud, 120, "one HUD update per frame");
    assert.ok(r.burst.mini >= 1 && r.burst.mini <= r.burst.ms / 55 + 2 && r.burst.tac >= 1 && r.burst.tac <= r.burst.ms / 55 + 2, `maps follow the wall clock, not the frame count: ${JSON.stringify(r.burst)}`);
    assert.ok(r.hiddenTab.steps >= 1 && r.hiddenTab.hud === 0 && r.hiddenTab.cross === 0 && r.hiddenTab.mini === 0 && r.hiddenTab.tac === 0, "a hidden tab draws no HUD or maps");
    assert.ok(r.bgStep.steps === 1 && r.bgStep.hud === 0 && r.bgStep.cross === 0 && r.bgStep.mini === 0 && r.bgStep.tac === 0, "step() on its own (the hidden host's timer) draws no HUD or maps");

    // ── the roster counters, the crosshair and the hit glow ──
    const rc = await p2.evaluate(() => {
      const out = {}, raf = window.requestAnimationFrame; window.requestAnimationFrame = () => 0; // (synchronous: no timer runs while it is stubbed)
      const me = myActor(), cross = document.getElementById("cross");
      const roster = new MutationObserver(() => {}), crossObs = new MutationObserver(() => {});
      roster.observe(document.getElementById("rs-n-mine"), { childList: true, characterData: true, subtree: true });
      const bars = () => [...cross.children].filter((i) => i.dataset.d);
      const topOf = () => bars().find((i) => i.dataset.d === "0,-1").getBoundingClientRect().top;
      me.vel.set(0, 0, 0); me.recoil = 0; for (let i = 0; i < 3; i++) tick(last + 16);
      const still = topOf();
      crossObs.observe(cross, { childList: true, subtree: true });
      for (let i = 0; i < 30; i++) tick(last + 16);
      for (const v of [2, 4, 0, 4, 2, 0]) { me.vel.set(v, 0, 0); tick(last + 16); }
      me.vel.set(4, 0, 0); tick(last + 16);
      out.moved = still - topOf(); // up by the spread (1.5 x 4 = 6)
      me.vel.set(0, 0, 0); tick(last + 16); out.back = still - topOf();
      out.rosterWrites = roster.takeRecords().length; out.crossRebuilds = crossObs.takeRecords().length;
      window.requestAnimationFrame = raf; roster.disconnect(); crossObs.disconnect();
      return out;
    });
    console.log("roster / crosshair:", JSON.stringify(rc));
    assert.equal(rc.rosterWrites, 0, "the roster counters are written only when they change");
    assert.equal(rc.crossRebuilds, 0, "a spreading crosshair slides its bars with transforms, the markup is not rebuilt");
    assert.ok(Math.abs(rc.moved - 6) <= 1.5 && Math.abs(rc.back) <= 1, "the crosshair still spreads with speed and closes again: " + JSON.stringify(rc));
    await p2.evaluate(() => { const me = myActor(), foe = world.actors.find((a) => a.team !== me.team); me.invuln = 0; me.hp = 100; me.yaw = 0; foe.pos.set(me.pos.x + 8, me.pos.y, me.pos.z); dealDamage(me, 5, false, foe); me.hp = 100; me.invuln = 1e6; window.__edge = document.querySelector("#hit-dir .hd-edge"); window.__mo = new MutationObserver(() => {}); window.__mo.observe(window.__edge, { attributes: true }); });
    await step(p2, 150);
    const t1 = await p2.evaluate(() => ({ t: __edge.style.transform, op: +__edge.style.opacity }));
    await p2.evaluate(() => { myActor().yaw = 1.5; });
    await step(p2, 150);
    const hd = await p2.evaluate(() => {
      const edge = window.__edge, recs = window.__mo.takeRecords();
      return { edges: document.querySelectorAll("#hit-dir .hd-edge").length, t1: null, t2: edge.style.transform, styleBg: edge.style.background, cssBg: getComputedStyle(edge).backgroundImage.slice(0, 20), gradientWrites: recs.filter((r) => /gradient/.test(edge.getAttribute("style") || "")).length };
    });
    hd.t1 = t1.t; hd.op = t1.op;
    console.log("hit glow:", JSON.stringify(hd));
    assert.ok(hd.edges >= 1 && hd.op > 0, "a hit shows the glow");
    assert.ok(!hd.gradientWrites && hd.styleBg === "" && /gradient/.test(hd.cssBg), "the glow's gradient is painted once by the stylesheet, not rewritten");
    assert.ok(hd.t1 && hd.t2 && hd.t1 !== hd.t2, "the glow moves round the screen with the view by a transform");
    await p2.context().close();

    // ── a phone: the grenade / inspect buttons are measured on change, and still land right after a turn or a layout edit ──
    const p3 = await f.page("hudr3", { width: 852, height: 393 }, { hasTouch: true, isMobile: true }, { quality: "mobile" });
    await setup(p3); await startMatch(p3, true); await step(p3, 1200);
    await p3.evaluate(() => { window.__q = document.querySelector('#tabil .tab[data-a="0"]'); window.__qm = 0; const o = Element.prototype.getBoundingClientRect; Element.prototype.getBoundingClientRect = function () { if (this === window.__q) window.__qm++; return o.apply(this, arguments); }; });
    const place = () => p3.evaluate(() => {
      const q = document.querySelector('#tabil .tab[data-a="0"]'), tb = document.getElementById("tb-nade"), ins = document.getElementById("tb-inspect");
      const R = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; };
      const compact = document.body.classList.contains("touching") && matchMedia("(orientation:landscape) and (max-height:600px)").matches && !q.style.getPropertyValue("left");
      return { q: R(q), n: R(tb), nadeShown: !tb.hidden, compact, ins: ins && !ins.hidden ? R(ins) : null };
    });
    const expectNade = (s) => {
      const gap = Math.max(6, s.q.w * 0.14);
      return s.compact ? [s.q.l + s.q.w + gap, Math.max(56, s.q.t - s.q.h - gap)] : [Math.max(4, s.q.l - s.q.w - gap), s.q.t];
    };
    const check = async (label) => {
      await step(p3, 500);
      const s = await place();
      assert.ok(s.nadeShown, label + ": the grenade button is out");
      const [x, y] = expectNade(s);
      assert.ok(Math.abs(s.n.l - x) <= 1.5 && Math.abs(s.n.t - y) <= 1.5 && Math.abs(s.n.w - s.q.w) <= 1.5 && Math.abs(s.n.h - s.q.h) <= 1.5, `${label}: grenade button at ${s.n.l},${s.n.t} ${s.n.w}x${s.n.h}, expected ${x},${y} ${s.q.w}x${s.q.h} (compact ${s.compact})`);
      if (s.ins) { const gap = Math.max(6, s.n.w * 0.14); assert.ok(Math.abs(s.ins.l - Math.max(4, s.n.l - s.n.w - gap)) <= 1.5 && Math.abs(s.ins.t - s.n.t) <= 1.5, label + ": the inspect button sits left of the grenade button"); }
      console.log(label + ":", JSON.stringify({ nade: [Math.round(s.n.l), Math.round(s.n.t)], q: [Math.round(s.q.l), Math.round(s.q.t)], compact: s.compact, inspect: !!s.ins }));
    };
    await check("landscape phone");
    await p3.screenshot({ path: "test-results/hud-render-phone.png" });
    await p3.evaluate(() => (window.__qm = 0)); await step(p3, 1500);
    const idle = await p3.evaluate(() => window.__qm);
    console.log("measurements of Q in 1.5 s of play:", idle);
    assert.ok(idle <= 1, "Q is not measured every frame: " + idle);
    await p3.setViewportSize({ width: 393, height: 852 }); await check("portrait phone");
    await p3.setViewportSize({ width: 932, height: 430 }); await check("larger landscape phone");
    await p3.evaluate(() => TOUCHLAY.set("tab-0", [0.3, 0.8, 1])); await check("Q moved by the touch layout");
    await p3.evaluate(() => TOUCHLAY.reset()); await check("touch layout reset");
    assert.deepEqual(f.errors, []);
    console.log("hud render: HUD once per frame, maps on the clock, no frames behind covered screens, buttons placed on change");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
