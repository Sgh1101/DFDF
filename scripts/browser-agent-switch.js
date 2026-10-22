const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// Agents the owner switched off (settings game.disabledAgents): gone from the picker, the bots, the random pick and the
// agent list; one picked before it went off gives way; back on, they return in their old place; a bad setting never leaves
// the game with too few agents; the owner page lists every agent and saves the switches.
(async () => {
  const f = await fixture();
  try {
    const owner = await f.h.api("auth", { id: "owner", pw: "owner-password", device: "ag-owner" });
    const page = await f.page("agswitch", { width: 1280, height: 800 });
    const roster = require("../js/agent-roster.json");
    // the roster file the owner page reads is the game's own roster, same order
    const live = await page.evaluate(() => AGENT_SWITCH.all().map((a) => [a.id, a.name, a.role]));
    assert.deepEqual(live, roster.map((a) => [a.id, a.name, a.role]), "js/agent-roster.json is out of date: run the dump again");
    const setOff = async (ids) => {
      const c = JSON.parse(JSON.stringify(f.h.config)); c.game.disabledAgents = ids.join(",");
      assert.equal((await f.h.api("a_config_set", { atoken: owner.atoken, config: c })).status, 200);
      f.h.advance(30000);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.GAME_BOOT && !document.documentElement.dataset.gameLoading);
      await page.waitForFunction((n) => window.SERVER_CFG && SERVER_CFG.game && SERVER_CFG.game.disabledAgents.split(",").filter(Boolean).length === n, ids.length, { timeout: 20000 });
      // the switch is made on the title screen once the page has loaded
      await page.waitForFunction((n) => AGENTS.length === AGENT_SWITCH.all().length - n, ids.length, { timeout: 20000 });
    };
    // 1. two off, one of them the one picked
    const off = ["hwaryeong", "chujeok", "geomi"];
    await page.evaluate(() => { titleCam = () => {}; picked = AGENTS.find((a) => a.id === "hwaryeong"); });
    await setOff(off);
    const a = await page.evaluate((off) => {
      const out = { n: AGENTS.length, left: AGENTS.some((x) => off.includes(x.id)), off: AGENT_SWITCH.off(), picked: picked.id, count: window.AGENT_COUNT };
      // the picker draws only the ones on
      renderSelect(); show("s-select");
      out.cards = document.querySelectorAll("#sel-grid .acard").length;
      // the bots and the random pick never pick one that is off
      let bad = 0;
      for (let i = 0; i < 400; i++) { world.actors = []; const r = pickFreeAgent("f0"); r && off.includes(r.id) && bad++; }
      out.bad = bad;
      out.byKey = [typeof agentByKey("hwaryeong"), agentByKey("hwaryeong") && agentByKey("hwaryeong").id];
      return out;
    }, off);
    assert.equal(a.n, roster.length - 3); assert.equal(a.left, false); assert.deepEqual(a.off.sort(), off.slice().sort());
    assert.ok(!off.includes(a.picked), "the picked one gave way: " + a.picked);
    assert.equal(a.count, roster.length - 3);
    assert.equal(a.cards, roster.length - 3, "the picker draws only the ones on");
    assert.equal(a.bad, 0, "the random pick never gives an agent that is off");
    assert.deepEqual(a.byKey, ["object", "hwaryeong"], "a lookup by key still finds an off agent (another player's list may still have it)");
    // a whole match: the bots of both teams
    const m = await page.evaluate((off) => { room.mode = "std"; room.map = "field"; startGame(AGENTS[0], false); return world.actors.filter((x) => x.agent && off.includes(x.agent.id)).length + ":" + world.actors.length; }, off);
    assert.ok(/^0:/.test(m), "no bot plays an agent that is off: " + m);
    // 2. back on: all there, in the old place
    await setOff([]);
    const b = await page.evaluate(() => ({ ids: AGENTS.map((x) => x.id), off: AGENT_SWITCH.off() }));
    assert.deepEqual(b.ids, roster.map((x) => x.id)); assert.deepEqual(b.off, []);
    // 3. a bad setting at the game's end (too few on) leaves the whole roster
    await page.evaluate((ids) => { AGENT_SWITCH.apply(new Set(ids)); }, roster.slice(0, roster.length - 5).map((x) => x.id));
    assert.equal(await page.evaluate(() => AGENTS.length), roster.length, "too few on: the game keeps them all");
    // 4. the owner page: every agent listed by role, a switch each, saved to the settings
    const ctx = await f.browser.newContext({ viewport: { width: 1280, height: 900 } });
    const ap = await ctx.newPage();
    ap.on("pageerror", (e) => f.errors.push(e.message)); ap.on("dialog", (d) => d.accept());
    await ap.route("**/api/v1?*", async (route) => { const r = await f.h.api(new URL(route.request().url()).searchParams.get("a"), route.request().postDataJSON() || {}); await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r) }); });
    await ap.addInitScript((t) => sessionStorage.setItem("adm_t", t), owner.atoken);
    await ap.goto((process.env.DFDF_BASE_URL || "http://127.0.0.1:3000") + "/admin.html", { waitUntil: "domcontentloaded" });
    await ap.waitForSelector('#nav [data-v="agents"]');
    await ap.click('#nav [data-v="agents"]');
    await ap.waitForSelector("#main [data-id]");
    assert.equal(await ap.locator("#main [data-id]").count(), roster.length);
    assert.match(await ap.textContent("#agn"), new RegExp(roster.length + " / " + roster.length));
    await ap.uncheck('[data-id="heuksa"]'); await ap.uncheck('[data-id="suho"]');
    assert.match(await ap.textContent("#agn"), new RegExp((roster.length - 2) + " / " + roster.length));
    await ap.screenshot({ path: (process.env.SHOT_DIR || "/tmp") + "/agent-switch-admin.png" });
    await ap.click("#agsave");
    await ap.waitForFunction(() => /2명을 껐습니다/.test(document.getElementById("toast").textContent));
    assert.equal(JSON.parse(f.h.db.get("config")).game.disabledAgents, "heuksa,suho");
    // too many off: the server refuses and says why
    for (const r of roster.filter((x) => x.role === "감시자")) await ap.uncheck(`[data-id="${r.id}"]`);
    await ap.click("#agsave");
    await ap.waitForFunction(() => /역할/.test(document.getElementById("toast").textContent));
    await ctx.close();
    assert.deepEqual(f.errors, []);
    console.log("agent switch: " + roster.length + " agents listed, off ones leave the picker, bots and random pick, back on in place, a bad setting is refused, the owner page saves");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
