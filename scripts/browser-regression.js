const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
(async () => {
  const f = await fixture();
  try {
    const page = await f.page("regression");
    await page.locator("#go-play").click();
    assert.equal(await page.evaluate(() => document.pointerLockElement === null), true);
    try { await page.locator("#agent-favorites button").nth(1).click({timeout:20000}); }
    catch (error) {
      console.log("failed selection", await page.evaluate(() => {
        const e = document.querySelector("#agent-favorites button:nth-child(2)"), r = e.getBoundingClientRect();
        return {x:r.x,y:r.y,w:r.width,h:r.height,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2).outerHTML.slice(0,160),template:getComputedStyle(document.getElementById("s-select")).gridTemplateAreas};
      }));
      await page.screenshot({path:"/tmp/dfdf-selection-failed.png"}); throw error;
    }
    await page.locator("#agent-favorites button").first().click();
    assert.equal(await page.locator("#sel-grid .acard:visible").count(), 1);
    await page.locator('#sel-roles [data-role="감시자"]').click();
    assert.equal(await page.locator("#sel-grid .acard:visible").count(), await page.evaluate(() => picked.role === "감시자" ? 1 : 0));
    await page.locator('#sel-roles [data-role=""]').click();
    if (await page.locator("#sel-pick").isVisible()) await page.locator("#sel-pick").click(); // small landscape: map and mode live in a sheet
    await page.locator("#mode-guide summary").click(); assert.match(await page.locator("#mode-guide p").textContent(), /스파이크/);
    await page.locator("#sel-back").click(); await page.locator("#go-armory").click();
    assert.equal(await page.locator("#armory").getAttribute("role"), "dialog");
    await page.evaluate(() => { const items = [...document.querySelectorAll('#armory button,input,select,textarea,a[href],summary,[tabindex]')].filter((e) => !e.disabled && e.tabIndex >= 0 && e.getClientRects().length); items.at(-1).focus(); });
    await page.keyboard.press("Tab"); assert.equal(await page.evaluate(() => document.getElementById("armory").contains(document.activeElement)), true);
    await page.evaluate(() => GUN_SKINS.close());
    assert.equal(await page.evaluate(() => document.activeElement.id), "go-armory");
    const staticCamera = await page.evaluate(() => {
      SETTINGS.motion = 0; document.getElementById("s-title").classList.add("home-reduced"); titleCam(0);
      const before = camera.position.clone(), map = CUR_MAP_KEY;
      for (let i = 0; i < 100; i++) titleCam(1);
      SETTINGS.motion = 1; document.getElementById("s-title").classList.remove("home-reduced");
      return before.equals(camera.position) && map === CUR_MAP_KEY;
    }); assert.equal(staticCamera, true);
    const result = await page.evaluate(() => {
      room.mode = "std"; room.diff = "hard"; startGame(AGENTS[0], false); ADMIN.freezeAI = true; world.phase = "live";
      const events = [];
      addEventListener("kill-confirmed", (event) => events.push(event.detail));
      const a = myActor(), foes = world.actors.filter((o) => o.team !== a.team), victim = foes[0];
      for (const o of foes) o.alive = o === victim;
      a.weapons.primary = "rpg"; a.slot = "primary"; GUN_SKINS.set("rpg", "dragon");
      a.invuln = victim.invuln = 0; victim.hp = 1; victim.armor = victim.shielded = 0;
      let found = false;
      for (let i = 0; i < 16; i++) {
        const angle = i * Math.PI / 8, dx = Math.sin(angle) * 3, dz = Math.cos(angle) * 3;
        if (!rayBlocked(a.pos.x, actorEye(a), a.pos.z, a.pos.x + dx, 1, a.pos.z + dz) && !collideXZ(a.pos.x + dx, a.pos.z + dz, 1, .65)) {
          victim.pos.set(a.pos.x + dx, 0, a.pos.z + dz); a.yaw = Math.atan2(-dx, -dz); a.pitch = Math.atan2(1 - actorEye(a), 3); found = true; break;
        }
      }
      ARMS.hostLaunch("rocket", a);
      a.slot = "secondary";
      for (let i = 0; i < 300 && victim.alive; i++) abilTick(.02);
      const first = { dead: !victim.alive, event: events.at(-1), effects: FINISHERS.active.size };
      FINISHERS.clear(); victim.alive = true; victim.hp = 1;
      DAMAGE_CAUSE.run(DAMAGE_CAUSE.capture(a, "rpg", "gun", world.round, "dragon"), () => dealDamage(victim, 999, false, a));
      const revived = { effects: FINISHERS.active.size, event: events.at(-1) };
      world.round++; startRound(); world.phase = "live"; victim.alive = true; victim.hp = 1; victim.invuln = 0;
      for (const o of foes) o.alive = o === victim;
      DAMAGE_CAUSE.run(DAMAGE_CAUSE.capture(a, "nade", "grenade", world.round, "dragon"), () => dealDamage(victim, 999, false, a));
      const grenade = { effects: FINISHERS.active.size, event: events.at(-1) };
      return { found, first, revived, grenade, recent: JSON.parse(localStorage.getItem("lgp_recent:regression")) };
    });
    assert.equal(result.found, true); assert.equal(result.first.dead, true); assert.equal(result.first.event.gun, "rpg"); assert.equal(result.first.event.skin, "dragon"); assert.equal(result.first.effects, 1);
    assert.equal(result.revived.effects, 0); assert.equal(result.revived.event.finisher, false); assert.equal(result.grenade.effects, 0); assert.equal(result.grenade.event.kind, "grenade"); assert.equal(result.recent.diff, "hard");
    console.log("home favorites, mode guide, modal focus, static camera, physical rocket, revival, grenade checks passed");
    const cycles = await page.evaluate(() => {
      const samples = [];
      for (let i = 0; i < 12; i++) {
        room.mode = i % 2 ? "tdm" : "std"; startGame(AGENTS[i % AGENTS.length], false);
        for (let j = 0; j < 30; j++) step(.033);
        gameOver(); netShutdown(); world.phase = "menu";
        samples.push({ entities: ABIL_ENTS.length, rockets: ARMS.fly.size, finishers: FINISHERS.active.size, actors: world.actors.length });
      }
      return samples;
    });
    assert.equal(cycles.every((s) => s.rockets === 0 && s.finishers === 0 && s.actors <= 10), true);
    console.log("12 alternating-mode match cycles", cycles.at(-1));
    await page.evaluate(() => show("s-title"));
    assert.equal(await page.locator("#shop").isVisible(), false);
    await page.setViewportSize({ width: 1440, height: 900 }); await page.screenshot({ path: "/tmp/dfdf-home-desktop-v2.png" });
    await page.setViewportSize({ width: 852, height: 393 }); await page.screenshot({ path: "/tmp/dfdf-home-mobile-v2.png" });
    assert.deepEqual(f.errors, []);
  } finally { await f.browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
