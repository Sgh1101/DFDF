const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
(async () => {
  const f = await fixture();
  try {
    const page = await f.page("followup", { width: 852, height: 393 }, { hasTouch: true });
    assert.deepEqual(await page.evaluate(() => GAME_CATALOG.counts()), { agents: 42, abilities: 168, weapons: 31, maps: 20, modes: 9, skins: 940 });
    const ch = await page.evaluate(() => { MULTI.paint(); return MULTI.ch(); });
    const rooms = [
      { code: "FULL01", name: "Full", n: 10, max: 10, state: "lobby", created: 1 },
      { code: "LIVE01", name: "Live", n: 1, max: 10, state: "live", created: 2 },
      { code: "OPEN01", name: "Open", n: 1, max: 10, state: "lobby", created: 3 },
    ].map((room) => ({ ...room, ch, mode: "std", map: "", host: "test-host" }));
    await page.route("**/api/v1?a=rooms", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, rooms }) }));
    await page.locator("#go-multi").click(); await page.waitForFunction(() => !document.getElementById("mu-ref").disabled);
    assert.match(await page.locator("#mu-status").textContent(), /마지막 갱신/);
    assert.deepEqual(await page.locator(".mu-rt b").allTextContents(), ["Open", "Live", "Full"]);
    await page.route("**/api/v1?a=rooms", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "temporary test failure" }) }));
    await page.locator("#mu-ref").click(); await page.waitForFunction(() => !document.getElementById("mu-ref").disabled);
    assert.match(await page.locator("#mu-status").textContent(), /이전 목록/);
    await page.locator("#mu-back").click();
    const practice = await page.evaluate(() => {
      let reports = 0; const listener = () => reports++;
      addEventListener("match-finished", listener);
      startGame(AGENTS[0], true); gameOver();
      removeEventListener("match-finished", listener);
      return { practice: GAME_PRACTICE, reports };
    });
    assert.deepEqual(practice, { practice: true, reports: 0 });
    const lifecycle = await page.evaluate(() => {
      room.mode = "std"; startGame(AGENTS[0], false); ADMIN.freezeAI = true;
      const oldGroup = world.actors[0].group;
      const baked = new Set(), shared = new Set(); let released = 0;
      oldGroup.traverse((node) => {
        if (node.geometry && node.userData.baked) baked.add(node.geometry);
        else if (node.geometry) shared.add(node.geometry);
      });
      for (const item of baked) item.addEventListener("dispose", () => released++);
      let sharedDisposed = 0;
      for (const item of shared) item.addEventListener("dispose", () => sharedDisposed++);
      const team = oldGroup.userData.ownedMaterials[0]; let materialDisposed = 0;
      team.addEventListener("dispose", () => materialDisposed++);
      startGame(AGENTS[1], false); world.phase = "live"; closeShop();
      for (let i = 0; i < 6; i++) { setTouchMode(true); setTouchMode(false); }
      setTouchMode(true); myActor().nades = 1; updateHUD();
      return { total: baked.size, released, sharedDisposed, materialDisposed };
    });
    assert.ok(lifecycle.total > 0); assert.equal(lifecycle.released, lifecycle.total); assert.equal(lifecycle.sharedDisposed, 0); assert.equal(lifecycle.materialDisposed, 1);
    console.log("room refresh and actor resource cleanup passed");
    const cdp = await page.context().newCDPSession(page);
    const center = (id) => page.locator(id).evaluate((node) => { const r = node.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    const stick = { ...await center("#stick"), id: 1 }, left = { ...await center("#tb-fire2"), id: 2 }, right = { ...await center("#tb-fire"), id: 3 };
    const touch = (type, points) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points });
    await touch("touchStart", [stick]);
    await touch("touchMove", [{ ...stick, x: stick.x + 20 }]);
    assert.ok(await page.evaluate(() => touch.move.x > 0));
    await touch("touchStart", [stick, left]); await touch("touchStart", [stick, left, right]);
    assert.equal(await page.evaluate(() => keys.fire), true);
    await touch("touchEnd", [stick, right]);
    assert.equal(await page.evaluate(() => keys.fire), true, "releasing one fire button preserves the other held button");
    await touch("touchCancel", []);
    // after the raw CDP touch events below, some headless builds stop delivering real mouse input, so later buttons get the click dispatched on them
    await page.waitForFunction(() => !keys.fire && touch.move.x === 0 && touch.lookId === null && touch.stickId === null);
    assert.deepEqual(await page.evaluate(() => ({ fire: keys.fire, move: touch.move.x, look: touch.lookId, stick: touch.stickId })), { fire: false, move: 0, look: null, stick: null });
    const ads = { ...await center("#tb-ads"), id: 4 };
    await page.evaluate(() => { keys.ads = player.ads = false; });
    await touch("touchStart", [ads]); await touch("touchEnd", []);
    assert.equal(await page.evaluate(() => player.ads), true, "one tap toggles once after repeated mode changes");
    await touch("touchStart", [right]); await page.evaluate(() => dispatchEvent(new Event("blur")));
    assert.equal(await page.evaluate(() => keys.fire), false); await touch("touchCancel", []);
    console.log("CDP multitouch and cancellation passed");
    await page.evaluate(() => { togglePause(true); TOUCHLAY.open(); });
    await page.waitForFunction(() => document.getElementById("mbe-bar").getAttribute("role") === "dialog");
    await page.evaluate(() => document.getElementById("mbe-x").focus());
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => !!document.activeElement.closest(".mbe-part")), true);
    await page.evaluate(() => document.getElementById("tb-nade").focus());
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.evaluate(() => !!TOUCHLAY.layout().m["tb-nade"]), true);
    await page.evaluate(() => TOUCHLAY.set("tb-nade", [.6, .25, 1.2]));
    await page.locator("#mbe-save").dispatchEvent("click");
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("lgp_touch_layout:followup") || "null")?.m["tb-nade"]?.[0] === .6);
    await page.evaluate(() => { TOUCHLAY.open(); TOUCHLAY.set("tb-nade", [.2, .2, 1]); TOUCHLAY.close(false); });
    assert.equal(await page.evaluate(() => TOUCHLAY.layout().m["tb-nade"][0]), .6);
    await page.setViewportSize({ width: 667, height: 375 }); await page.waitForTimeout(500);
    const restored = await center("#tb-nade"); assert.ok(Math.abs(restored.x - 667 * .6) < 2); assert.ok(Math.abs(restored.y - 375 * .25) < 2);
    await page.waitForFunction(() => !document.getElementById("mbe-bar"));
    await page.evaluate(() => { togglePause(false); gameOver(); });
    await page.locator("#ov-menu").dispatchEvent("click");
    await page.evaluate(() => { localStorage.setItem("lgp_favorites:followup", JSON.stringify([AGENTS[0].key])); });
    const fresh = await f.h.api("auth", { id: "nextplayer", pw: "password", device: "next-browser-device" });
    await page.evaluate((session) => { localStorage.setItem("lgp_session", JSON.stringify(session)); sessionStorage.setItem("lgp_gate", session.token); localStorage.setItem("lgp_lang", "en"); }, fresh);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForFunction(() => window.GAME_BOOT && !document.documentElement.dataset.gameLoading);
    assert.equal(await page.evaluate(() => ACCOUNT.session().user.id), "nextplayer");
    assert.deepEqual(await page.evaluate(() => TOUCHLAY.layout().m), {});
    assert.equal(await page.locator("#go-resume").isVisible(), false);
    assert.match(await page.locator("#agent-favorites span").textContent(), /0 saved/);
    assert.equal(await page.locator("html").getAttribute("lang"), "en");
    assert.equal(await page.locator("#tb-fire2").getAttribute("aria-label"), "Left fire");
    assert.match(await page.locator("#go-play b").textContent(), /Play solo/);
    await page.locator("#go-set").dispatchEvent("click");
    assert.equal(await page.locator("#pause").getAttribute("aria-label"), "Settings");
    await page.evaluate(() => TOUCHLAY.open());
    await page.waitForFunction(() => document.getElementById("mbe-bar").getAttribute("aria-label") === "Button layout");
    await page.locator("#mbe-x").dispatchEvent("click");
    await page.evaluate(() => togglePause(false));
    const other = await page.context().newPage(); await other.goto("http://127.0.0.1:3000/privacy.html");
    await other.evaluate(() => localStorage.clear());
    await page.waitForURL((url) => url.pathname === "/", { timeout: 30000 });
    assert.equal(await page.evaluate(() => sessionStorage.getItem("lgp_gate")), null);
    assert.deepEqual(f.errors, []);
    console.log("catalog, room refresh, actor resource disposal, CDP multitouch/cancel, layout save/cancel/resize, account isolation and cross-tab logout passed");
  } finally { await f.browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
