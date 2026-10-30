const assert = require("node:assert/strict"), fs = require("node:fs"), { fixture } = require("./browser-fixture");
// Render cost: the shadow map is drawn on its cadence (GFX.shadowEvery) and at once on a jump, the glass blur behind the HUD
// exists only on the visual and ultra presets (class gfx-blur), startGame leaves the materials alone when the preset is the
// one already applied, and the guns in a match have their takes rendered ahead of the first shot.
// Explored the match HUD, the pause menu and the weapon shop on desktop and on a phone (touch) at each preset first
// (test-results/render-cost-*.png).
const PHONE = { isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36" };
const HUD = ["#roster", "#topbar", "#vitals", "#ammo", "#tacmap", "#tips", "#fps", "#netping", "#tb-menu", "#mode-board"];
const startMatch = (page, touch) => page.evaluate((touch) => {
  window.requestAnimationFrame = () => 0; // frames are driven by the test
  room.mode = "std"; room.map = "field"; startGame(AGENTS[0], false); closeShop(); world.phase = "live"; world.roundTime = 9999; ADMIN.freezeAI = true;
  if (touch) document.body.classList.add("touching");
  myActor().invuln = 1e6;
}, touch);
// the computed backdrop-filter of every HUD element the page has, plus the elements made at run time
const blurs = (page) => page.evaluate((ids) => {
  const out = {}, sel = [...ids, ".tb", ".tab", ".tm", ".mb", ".cht-tb", "#stick", "#btn-touch", "#tb-shop", "#pause", "#shop", "#bigmap", "#agent-swap"];
  for (const s of sel) { const list = [...document.querySelectorAll(s)]; if (!list.length) continue; out[s] = [...new Set(list.map((e) => { const c = getComputedStyle(e); return (c.backdropFilter || c.webkitBackdropFilter || "none"); }))].join(","); }
  return { cls: document.body.classList.contains("gfx-blur"), q: SETTINGS.quality, out };
}, HUD);
(async () => {
  const f = await fixture(); fs.mkdirSync("test-results", { recursive: true });
  try {
    // ── behind the agent select screen: one real frame builds the match's shaders (nothing else is drawn there) ──
    const sp = await f.page("rcost0", { width: 960, height: 540 }, {}, { quality: "visual", bootTimeout: 120000 });
    await sp.evaluate(() => { window.__pr = 0; const pr = postRender; postRender = function () { if (!document.getElementById("s-select").hidden) window.__pr++; return pr.apply(this, arguments); }; });
    await sp.waitForTimeout(1500);
    await sp.locator("#go-play").click();
    if (await sp.locator("#sel-pick").isVisible().catch(() => false)) await sp.locator("#sel-pick").click();
    await sp.waitForFunction(() => !document.getElementById("s-select").hidden);
    await sp.waitForFunction(() => SELECT_MAPSHOT.cache.size > 0 && window.__pr >= 1, null, { timeout: 90000 });
    await sp.waitForTimeout(3000);
    await sp.evaluate(() => { window.__pr0 = window.__pr; });
    await sp.waitForTimeout(2500);
    const warm = await sp.evaluate(() => ({ before: window.__pr0, after: window.__pr, warmed: [...SELECT_MAPSHOT.warmed], map: CUR_MAP_KEY }));
    console.log("frames drawn behind select:", JSON.stringify(warm));
    assert.ok(warm.before === 1 && warm.warmed.includes(warm.map), "the real pipeline was drawn once behind the select screen: " + JSON.stringify(warm));
    assert.equal(warm.after, warm.before, "and nothing more is drawn behind it");
    await sp.context().close();

    // ── desktop: the blur follows the preset, in a match, in the pause menu and in the shop ──
    const p = await f.page("rcost1", { width: 1280, height: 720 }, {}, { quality: "visual", bootTimeout: 120000 });
    await startMatch(p, false);
    const seen = {};
    for (const q of ["visual", "ultra", "perf", "mobile", "visual"]) {
      await p.evaluate((q) => setQuality(q), q);
      const open = q === "perf" || q === "visual" && Object.keys(seen).length > 0;
      const r = await blurs(p); seen[q + (seen[q] ? "2" : "")] = r;
      const want = q === "visual" || q === "ultra";
      assert.equal(r.cls, want, q + ": body class gfx-blur");
      const names = Object.keys(r.out);
      assert.ok(names.includes("#roster") && names.includes("#topbar") && names.includes("#vitals") && names.includes("#ammo"), "the HUD is in the page: " + names);
      for (const [sel, v] of Object.entries(r.out)) {
        if (want) { if (["#roster", "#topbar", "#vitals", "#ammo", "#tacmap", "#tips", "#tb-menu", "#fps"].includes(sel)) assert.match(v, /blur\(/, q + " keeps the blur on " + sel + ": " + v); }
        else assert.equal(v, "none", q + " has no blur on " + sel + ": " + v);
      }
      await p.waitForTimeout(200);
      await p.screenshot({ path: "test-results/render-cost-desktop-" + q + ".png" });
    }
    // the pause menu and the weapon shop (full-screen layers over the live canvas)
    for (const q of ["perf", "ultra"]) {
      await p.evaluate((q) => setQuality(q), q);
      await p.evaluate(() => { togglePause(true); });
      let r = await blurs(p);
      assert.equal(r.out["#pause"] !== "none", q === "ultra", q + " pause blur: " + r.out["#pause"]);
      await p.screenshot({ path: "test-results/render-cost-pause-" + q + ".png" });
      await p.evaluate(() => { togglePause(false); });
      await p.evaluate(() => { world.phase = "buy"; openShop(); });
      await p.waitForTimeout(300);
      r = await blurs(p);
      assert.ok(r.out["#shop"], "the shop is in the page");
      assert.equal(r.out["#shop"] !== "none", q === "ultra", q + " shop blur: " + r.out["#shop"]);
      await p.screenshot({ path: "test-results/render-cost-shop-" + q + ".png" });
      await p.evaluate(() => { closeShop(); world.phase = "live"; });
    }
    // ── the shadow map: a draw every shadowEvery frames, at once when the sun jumps ──
    const shadows = async (q) => {
      await p.evaluate((q) => setQuality(q), q);
      return p.evaluate(() => {
        const sm = renderer.shadowMap, sr = sm.render; let draws = 0;
        sm.render = function () { if (sm.needsUpdate) draws++; return sr.apply(this, arguments); };
        try {
          const me = myActor(); for (let i = 0; i < 6; i++) { world.phase = "live"; step(.016); render(); }
          draws = 0; const every = GFX.shadowEvery;
          for (let i = 0; i < 24; i++) { world.phase = "live"; me.pos.x += .1; step(.016); render(); }
          const cadence = draws; draws = 0;
          render(); const idle0 = draws; // right after some draw or not: only count the jump below
          for (let i = 0; i < 4; i++) render(); // settle
          const settled = draws; draws = 0;
          me.pos.x += 30; me.pos.z += 30; camera.position.x += 30; camera.position.z += 30; render(); const jump = draws;
          return { every, cadence, jump, shadowOn: renderer.shadowMap.enabled };
        } finally { sm.render = sr; }
      });
    };
    const vis = await shadows("visual"), ult = await shadows("ultra");
    console.log("shadow draws in 24 moving frames: visual", JSON.stringify(vis), "ultra", JSON.stringify(ult));
    assert.equal(vis.every, 2); assert.equal(vis.cadence, 12, "visual: one shadow draw per 2 frames");
    assert.equal(ult.every, 1); assert.equal(ult.cadence, 24, "ultra: a shadow draw every frame");
    assert.equal(vis.jump, 1, "a jump of the sun is drawn at once"); assert.equal(ult.jump, 1);
    const off = await p.evaluate(() => { setQuality("perf"); let d = 0; const sm = renderer.shadowMap, sr = sm.render; sm.render = function () { if (sm.needsUpdate) d++; return sr.apply(this, arguments); }; for (let i = 0; i < 10; i++) render(); sm.render = sr; return d; });
    assert.equal(off, 0, "perf has no shadow map");

    // ── startGame leaves the materials alone while the preset is the one applied ──
    const sg = await p.evaluate(() => {
      const mats = new Set(); scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => mats.add(m)); });
      const versions = () => { let n = 0; mats.forEach((m) => { n += m.version; }); return n; };
      let calls = 0; const orig = setQuality; setQuality = function () { calls++; return orig.apply(this, arguments); };
      const out = {};
      try {
        setQuality("visual"); calls = 0; const v0 = versions();
        room.mode = "std"; room.map = "field"; startGame(AGENTS[0], false); closeShop();
        startGame(AGENTS[1] || AGENTS[0], false); closeShop();
        out.same = { calls, versionDelta: versions() - v0 };
        GFX.bloom = GFX.bloom + .5; calls = 0; const v1 = versions();
        startGame(AGENTS[0], false); closeShop();
        out.changed = { calls, versionDelta: versions() - v1 };
        calls = 0; const v2 = versions(); startGame(AGENTS[0], false); closeShop();
        out.again = { calls, versionDelta: versions() - v2 };
        out.pixel = renderer.getPixelRatio(); out.want = Math.min(devicePixelRatio || 1, GFX.pixel);
      } finally { setQuality = orig; }
      return out;
    });
    console.log("startGame:", JSON.stringify(sg));
    assert.equal(sg.same.calls, 0, "an unchanged preset: startGame does not call setQuality");
    assert.equal(sg.same.versionDelta, 0, "and no material is marked for update");
    assert.equal(sg.changed.calls, 1, "graphics changed since the last apply: setQuality runs");
    assert.ok(sg.changed.versionDelta > 0);
    assert.equal(sg.again.calls, 0, "and it is skipped again once applied");
    assert.equal(sg.pixel, sg.want);

    // ── the first shot of a gun: its takes are in the cache ──
    await p.evaluate(() => { setQuality("perf"); room.mode = "std"; room.map = "field"; startGame(AGENTS[0], false); closeShop(); world.phase = "live"; world.roundTime = 9999; ADMIN.freezeAI = true; });
    const keys = await p.evaluate(() => { const me = myActor(); return Object.values(me.weapons).filter((k) => GUNSYNTH.has(k)); });
    assert.ok(keys.length >= 1, "the player holds a gun: " + keys);
    await p.evaluate(() => { SETTINGS.sfx = true; GAME_AUDIO.context(); SFX.gun("pistol", 0); }); // the audio engine exists (a shot, then the rest is cached)
    await p.waitForFunction((keys) => { const e = GUNSOUND_ENGINE(); return !!e && !!e.warmed && keys.every((k) => e.warmed(k)); }, keys, { timeout: 30000 });
    const shot = await p.evaluate((keys) => {
      const c = GAME_AUDIO.context(), create = c.createBuffer; let made = 0; c.createBuffer = function () { made++; return create.apply(this, arguments); };
      const t = performance.now(); try { for (const k of keys) SFX.gun(k, 0); } finally { c.createBuffer = create; }
      return { made, ms: performance.now() - t, keys };
    }, keys);
    console.log("first shot of", shot.keys.join(","), "->", JSON.stringify(shot));
    assert.equal(shot.made, 0, "the first shot of each gun in the loadout renders nothing");
    await p.waitForTimeout(100);
    const later = await p.evaluate(() => GUNSOUND_ENGINE().warmed("pistol"));
    assert.ok(later);
    await p.context().close();

    // ── phone: touch buttons and chat button lose their blur on the phone and performance presets ──
    const ph = await f.page("rcost2", { width: 852, height: 393 }, PHONE, { quality: "mobile", bootTimeout: 120000 });
    await startMatch(ph, true);
    for (const q of ["mobile", "visual", "perf"]) {
      await ph.evaluate((q) => setQuality(q), q);
      await ph.waitForTimeout(300);
      const r = await blurs(ph), want = q === "visual";
      assert.equal(r.cls, want);
      assert.ok(r.out[".mb"], "the touch buttons are in the page");
      for (const sel of [".mb", "#stick", ".tab", ".tb", "#tb-menu", "#roster", ".cht-tb"]) if (r.out[sel]) {
        if (want) assert.match(r.out[sel], /blur\(/, q + " keeps the blur on " + sel); else assert.equal(r.out[sel], "none", q + " " + sel + ": " + r.out[sel]);
      }
      // text stays readable: the buttons' background is more opaque without the blur
      const alphas = await ph.evaluate(() => [...document.querySelectorAll(".mb:not(.on)")].map((m) => { const c = getComputedStyle(m).backgroundColor.match(/[\d.]+/g); return [m.id || m.className, c.length > 3 ? +c[3] : 1]; }).filter((v) => v[1] > 0));
      const alpha = Math.min(...alphas.map((v) => v[1]));
      if (want) assert.ok(alpha <= .5, "visual keeps the glass: " + alpha); else assert.ok(alpha >= .65, q + " touch buttons are more opaque: " + JSON.stringify(alphas));
      await ph.screenshot({ path: "test-results/render-cost-phone-" + q + ".png" });
    }
    assert.deepEqual(f.errors, []);
    console.log("render cost checks passed");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
