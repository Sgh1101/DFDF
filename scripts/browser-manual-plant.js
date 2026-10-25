const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// The attacker plants only by holding 4 or F, standing still inside a site; it is never automatic.
(async () => {
  const f = await fixture();
  try {
    const p = await f.page("manualplant", { width: 960, height: 540 }, {}, { quality: "perf" });
    await p.locator("#go-play").click();
    await p.locator("#sel-grid .acard").first().click();
    await p.locator("#sel-go").click();
    await p.waitForFunction(() => !!myActor() && world.actors.length >= 4);
    // the test steps the spike logic itself: stop the game's own frame loop so the two never race. One frame is
    // already scheduled when the loop is cut (tick() asks for the next frame first), and it would run at a random
    // moment between two of the test's steps and undo a position change (the "walking pauses it" check).
    // So wait until that last frame has fired into the stub before touching anything.
    await p.evaluate(() => { window.__rafCut = 0; window.requestAnimationFrame = () => { window.__rafCut++; return 0; }; });
    await p.waitForFunction(() => window.__rafCut > 0, null, { timeout: 60000 });
    const setup = await p.evaluate(() => {
      closeShop(); ADMIN.freezeAI = true;
      const me = myActor();
      for (const a of world.actors) if (a !== me) { a.pos.x = 400; a.pos.z = 400; a.invuln = 999; }
      me.team = "atk"; player.team = "atk"; me.invuln = 999;
      me.hasSpike = true; player.hasSpike = true; world.spike.state = "carried"; world.spike.carrier = me;
      world.phase = "live"; world.phaseT = 999;
      const site = MAP.sites[0];
      me.pos.x = site.x; me.pos.z = site.z; me.vel && me.vel.set(0, 0, 0);
      return { id: site.id, inSite: !!siteAt(me.pos.x, me.pos.z) };
    });
    assert.ok(setup.inSite, "standing in site " + setup.id);
    const run = (secs) => p.evaluate(async (secs) => {
      const end = performance.now() + secs * 1000;
      while (performance.now() < end) { await new Promise((r) => setTimeout(r, 50)); }
      return { planting: player.planting, state: world.spike.state, text: document.getElementById("sp-txt") && document.getElementById("sp-txt").textContent };
    }, secs);
    const hold = (state) => p.evaluate((state) => { keys.f = state; }, state);
    // keep the game stepping by hand: the headless page throttles frames
    const step = (n) => p.evaluate((n) => { for (let i = 0; i < n; i++) { world.phase = "live"; player.alive = true; handleSpike(0.05); } return { planting: player.planting, state: world.spike.state, text: document.getElementById("sp-txt").textContent, anchor: !!player.plantAnchor }; }, n);
    // 1. standing in the site, no key: 6 seconds and nothing happens
    let r = await step(120);
    assert.equal(r.state, "carried", "never plants by itself");
    assert.equal(r.planting, 0);
    assert.match(r.text, /4 또는 F/, "the hint says what to press: " + r.text);
    // 2. F held: it counts up and plants
    await hold(true);
    r = await step(20);
    assert.ok(r.planting > 0.5 && r.state === "carried", "F starts planting: " + JSON.stringify(r));
    // letting go cancels it
    await hold(false);
    r = await step(2);
    assert.equal(r.planting, 0, "releasing stops it");
    assert.equal(r.state, "carried");
    // 3. key 4 plants too, and finishes after the plant time
    await p.evaluate(() => { keys["4"] = true; });
    r = await step(Math.ceil((await p.evaluate(() => SPIKE.PLANT)) / 0.05) + 6);
    assert.equal(r.state, "planted", "holding 4 for the plant time plants: " + JSON.stringify(r));
    await p.evaluate(() => { keys["4"] = false; });
    // 4. moving while holding pauses the count; outside a site the key does nothing
    await p.evaluate(() => { const me = myActor(); world.spike.state = "carried"; world.spike.carrier = me; me.hasSpike = player.hasSpike = true; player.planting = 0; player.plantAnchor = null; const s = MAP.sites[0]; me.pos.x = s.x; me.pos.z = s.z; keys.f = true; });
    r = await step(30);
    assert.ok(r.planting > 1, "counting");
    const before = r.planting;
    await p.evaluate(() => { const me = myActor(); me.pos.x += 4; });
    r = await step(1);
    assert.ok(r.planting <= before + 1e-6 && /멈추면/.test(r.text), "walking while holding pauses it: " + JSON.stringify(r));
    r = await step(10);
    assert.ok(r.planting > before, "and standing still again resumes it: " + JSON.stringify(r));
    await p.evaluate(() => { const me = myActor(); me.pos.x = -9999; me.pos.z = -9999; keys.f = true; });
    r = await step(60);
    assert.equal(r.state, "carried");
    assert.equal(r.planting, 0);
    assert.match(r.text, /4 또는 F/);
    assert.deepEqual(f.errors, []);
    console.log("Manual plant: no automatic plant in a site, hold F or 4 in place to plant, release stops it, moving pauses it, outside a site nothing. Browser only.");
  } finally { await f.browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
