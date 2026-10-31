const assert = require("node:assert/strict"), fs = require("node:fs"), { fixture } = require("./browser-fixture");
const W = require("../js/map-week.js");
// The map of the week: the server picks one of the switched-off maps for the week (same for everyone), it joins the map list
// first with a "이번 주 맵" tag on the agent select screen, the owner's switch and exclusion list act, it loads and plays; and
// every map that can be picked loads, has both spawns and its sites, and lets the game's own bots walk from the attack spawn to
// each site (a map that failed this would be left out of js/map-week.js CANDIDATES).
const dir = process.env.SHOT_DIR || "test-results/map-week";
(async () => {
  fs.mkdirSync(dir, { recursive: true });
  const f = await fixture();
  try {
    const owner = await f.h.api("auth", { id: "owner", pw: "owner-password", device: "browser-owner-device" });
    const setGame = async (g) => { const c = JSON.parse(JSON.stringify(f.h.config)); Object.assign(c.game, g); const r = await f.h.api("a_config_set", { atoken: owner.atoken, config: c }); assert.equal(r.status, 200); };
    // (the list without the event map: while one is open it comes first, in a box of its own above the list)
    const info = (page) => page.evaluate(() => ({ week: window.SERVER_CFG && SERVER_CFG.weekMap, key: window.WEEK_MAP_KEY, list: MAP_LIST.map((m) => m.key).filter((k) => k !== window.EVENT_MAP_KEY), pool: POGU.pool.slice() }));
    const open = async (name, vp, ctx) => {
      const page = await f.page(name, vp, ctx);
      await page.waitForFunction(() => window.SERVER_CFG && "weekMap" in SERVER_CFG, null, { timeout: 30000 });
      await page.waitForTimeout(1200); // the pool follows the settings within half a second
      return page;
    };
    const expected = W.choose(Date.now(), true, "");

    // ── in the list, first, tagged, and it plays ──
    for (const [name, vp, ctx] of [["desk", { width: 1280, height: 720 }, {}], ["phone", { width: 852, height: 393 }, { hasTouch: true, isMobile: true }]]) {
      const page = await open("wk" + name, vp, ctx);
      const i = await info(page);
      assert.equal(i.week.key, expected.key, "the server's pick is the module's pick for this week");
      assert.equal(i.key, expected.key); assert.equal(i.list[0], expected.key, "first in the list");
      assert.ok(!i.pool.includes(expected.key), "it is one that was outside the normal pool");
      assert.ok(i.list.slice(1).every((k) => i.pool.includes(k)), "the rest is the normal pool");
      assert.ok(i.week.until > Date.now() && i.week.until - Date.now() <= 7 * 864e5 && new Date(i.week.until + 9 * 36e5).toISOString().slice(10) === "T00:00:00.000Z" && 1 === new Date(i.week.until + 9 * 36e5).getUTCDay(), "it ends at a Monday 0:00 in Korea");
      await page.mouse.click(vp.width / 2, vp.height / 2);
      await page.evaluate(() => document.getElementById("go-play").click());
      await page.waitForSelector("#sel-maps .lb-map", { state: "attached" });
      await page.waitForTimeout(1500);
      const chips = await page.evaluate(() => [...document.querySelectorAll("#sel-maps .lb-map:not(.lbm-rand)")].map((c) => ({ t: c.textContent, tag: !!c.querySelector(".map-wk"), shown: !c.hidden })));
      assert.equal(chips.length, i.list.length, "one chip a map"); assert.equal(chips.filter((c) => c.tag).length, 1, "one chip carries the tag");
      assert.match(chips[0].t, /이번 주 맵/, "the first chip: " + chips[0].t);
      // the maps are in the sheet the map button opens: the tagged chip is the first one and can be read there
      await page.click("#sel-pick");
      await page.waitForTimeout(500);
      const tag = await page.evaluate(() => { const t = document.querySelector("#sel-maps .map-wk"), r = t.getBoundingClientRect(), c = t.parentElement.getBoundingClientRect(); return { w: r.width, h: r.height, inside: r.right <= c.right + 1, first: t.parentElement === [...document.querySelectorAll("#sel-maps .lb-map:not(.lbm-rand)")].find((e) => !e.hidden) }; });
      assert.ok(tag.w > 20 && tag.h > 8 && tag.inside && tag.first, "the tag is shown in the sheet, on the first chip: " + JSON.stringify(tag));
      await page.screenshot({ path: `${dir}/select-${name}.png` });
      await page.click("#sel-pick");
      // it can be picked and the match loads on it
      await page.evaluate(() => document.querySelector("#sel-maps .lb-map:not(.lbm-rand)").click());
      assert.equal(await page.evaluate(() => room.map), expected.key);
      await page.evaluate(() => { room.mode = "std"; startGame(AGENTS[0], false); });
      await page.waitForFunction((k) => CUR_MAP_KEY === k && myActor(), expected.key, { timeout: 30000 });
      assert.ok(await page.evaluate(() => world.actors.length > 1 && !!MAP.attackSpawn && MAP.sites.length > 0));
      await page.screenshot({ path: `${dir}/match-${name}.png` });
      await page.context().close();
    }

    // ── the owner's list and switch ──
    await setGame({ weekMapExclude: W.CANDIDATES.filter((k) => k !== "g12").join(",") });
    let page = await open("wkx", { width: 1280, height: 720 });
    assert.equal((await info(page)).list[0], "g12", "everything else excluded: g12");
    await page.context().close();
    await setGame({ weekMapExclude: "", weekMap: false });
    page = await open("wkoff", { width: 1280, height: 720 });
    let i = await info(page);
    assert.equal(i.week, null); assert.equal(i.key, ""); assert.deepEqual(i.list, i.pool.filter((k) => i.list.includes(k)), "the normal pool only");
    await page.mouse.click(640, 360);
    await page.evaluate(() => document.getElementById("go-play").click());
    await page.waitForSelector("#sel-maps .lb-map", { state: "attached" });
    await page.waitForTimeout(1500);
    assert.equal(await page.evaluate(() => document.querySelectorAll("#sel-maps .map-wk").length), 0, "no tag while it is switched off");
    await page.context().close();
    await setGame({ weekMap: true });

    // ── every candidate ──
    page = await f.page("wkvet", { width: 1280, height: 720 });
    const bad = [];
    for (const key of W.CANDIDATES) {
      const r = await page.evaluate(async (key) => {
        const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
        titleCam = () => {}; render = () => {};
        if (!MAPS[key]) return { key, error: "no such map" };
        room.mode = "std"; room.map = key; startGame(AGENTS[0], false);
        for (let i = 0; i < 150 && !(myActor() && CUR_MAP_KEY === key); i++) await sleep(100);
        if (CUR_MAP_KEY !== key) return { key, error: "did not load: " + CUR_MAP_KEY };
        closeShop();
        ADMIN.freezeAI = true; world.roundTime = 0.01; step(0.05); world.roundTime = 1e6; ADMIN.freezeAI = false;
        const me = myActor(); me && releaseToAI(me.id);
        checkRoundEnd = function () {};
        const out = { key, size: MAP_SIZE(key), sites: MAP.sites.length, seats: world.actors.length, spawns: !!(MAP.attackSpawn && MAP.defendSpawn), walks: [] };
        if (!out.spawns || !out.sites) return out;
        const bot = world.actors.find((a) => a.team === "atk"), from = { x: bot.pos.x, z: bot.pos.z, y: bot.y || 0 };
        let target = null;
        const goal = aiGoal;
        aiGoal = function (e) { return e === bot && target ? { x: target.x, z: target.z } : goal.apply(this, arguments); };
        const walk = (to) => {
          for (const a of world.actors) if (a !== bot) { a.alive = false; a.hp = 0; }
          Object.assign(bot, { alive: true, hp: 100, ctrl: "ai", ai: freshAIState(), hasSpike: false, root: 0, slow: 1, y: from.y, vy: 0 });
          bot.pos.x = from.x; bot.pos.z = from.z;
          intelClear(); target = to;
          let best = 1e9, bestAt = 0;
          for (let t = 0; t < 120; t += 0.05) {
            step(0.05);
            const d = Math.hypot(bot.pos.x - to.x, bot.pos.z - to.z);
            if (d < best - 0.3) { best = d; bestAt = t; }
            if (d < 4) return { ok: true, t: +t.toFixed(1) };
            if (t - bestAt > 12) break;
          }
          return { ok: false, at: [+bot.pos.x.toFixed(1), +bot.pos.z.toFixed(1)], best: +best.toFixed(1) };
        };
        for (const s of MAP.sites) out.walks.push(Object.assign({ site: s.id }, walk(s)));
        aiGoal = goal;
        return out;
      }, key);
      const ok = !r.error && r.spawns && r.sites > 0 && r.seats >= 2 * r.size && r.walks.every((w) => w.ok);
      ok || bad.push(JSON.stringify(r));
    }
    assert.deepEqual(bad, [], "maps that cannot be the map of the week");
    console.log(`map of the week: ${expected.key} first in the list with its tag, the owner's list and switch act; all ${W.CANDIDATES.length} candidates load, have spawns and sites, and a bot walks to every site`);
    assert.deepEqual(f.errors, []);
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
