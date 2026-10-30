const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// The numbers in the home page's feature list (index.html, #feat) must be the numbers the game shows, in both languages.
// Each is counted the way a player meets it in play.html: the agent picker's cards, the four abilities of each agent, the
// weapons the buy-phase shop sells, the mode buttons of the room, the map list of the room (with its 5v5 / 3v3 / 1v1 tabs)
// and the skins the pull gives to every gun. The English text must not carry any Korean.
const BASE = process.env.DFDF_BASE_URL || "http://127.0.0.1:3000";
(async () => {
  const f = await fixture();
  try {
    const page = await f.page("homenumbers", { width: 1440, height: 900 }, {}, { bootTimeout: 120000 });
    // maps added after boot (the Ascent trial map) are in the room's list by the time the tab counts include them
    await page.waitForFunction(() => window.ASCENT_TRIAL && MAP_LIST.some((m) => m.key === "ascent_trial"), null, { timeout: 60000 });
    await page.click("#go-play");
    await page.waitForFunction(() => document.querySelectorAll("#sel-grid .acard").length > 0 && document.querySelectorAll("#sel-maps button").length > 0);
    const game = await page.evaluate(() => {
      const num = (b) => Number(b.querySelector("em").textContent), tabs = Object.fromEntries([...document.querySelector("#sel-maps").previousElementSibling.querySelectorAll("button[data-cat]")].map((b) => [b.dataset.cat || "all", num(b)]));
      const names = AGENTS.flatMap((a) => a.abilities.map((x) => x.name)), types = AGENTS.flatMap((a) => a.abilities.map((x) => x.type));
      return {
        agents: document.querySelectorAll("#sel-grid .acard").length, agentList: AGENTS.length,
        abilities: AGENTS.reduce((n, a) => n + a.abilities.length, 0), distinctNames: new Set(names).size, distinctTypes: new Set(types).size,
        modes: document.querySelectorAll("#sel-modes button").length,
        // every chip but the random one is a map the room can pick
        maps: document.querySelectorAll("#sel-maps button:not(.lbm-rand)").length, chips: [...document.querySelectorAll("#sel-maps button")].map((b) => b.textContent), tabs,
        // the map of the week (js/map-week.js) is in the list on top of the pool while the server has one
        week: MAP_LIST.some((m) => m.key === window.WEEK_MAP_KEY) ? MAP_CAT(window.WEEK_MAP_KEY) : null,
        // the event map (js/event-map.js) has a box of its own: not among the chips, not in the tabs
        event: MAP_LIST.some((m) => m.key === window.EVENT_MAP_KEY) ? window.EVENT_MAP_KEY : null,
        eventChip: !!document.querySelector("#sel-event .lb-map"),
      };
    });
    // the shop of a live match: weapons only (the knife is every player's own, armor and grenades are not guns)
    await page.evaluate(async () => { await GUN_SKINS.sync(); room.map = "pogu"; startGame(AGENTS[0], true); ADMIN.freezeAI = true; world.phase = "buy"; world.roundTime = 999; myActor().credits = 10000; openShop(); });
    await page.waitForFunction(() => document.querySelectorAll('#shop-grid [data-kind="weapon"]').length > 0, null, { timeout: 60000 });
    const shop = await page.evaluate(() => ({ guns: [...document.querySelectorAll('#shop-grid [data-kind="weapon"]')].map((b) => b.dataset.key) }));
    // the pull: every skin that is not retired, not for one gun only and not a prize (season / coins), on each of the shop's guns
    const skins = await page.evaluate((guns) => {
      const pool = (gun) => GUN_SKINS.skinsFor(gun).filter((s) => s.rar > 0 && !s.excl && !s.only).map((s) => s.id);
      return { perGun: guns.map((g) => pool(g).join()), count: pool(guns[0]).length };
    }, shop.guns);
    assert.equal(game.agents, game.agentList, "picker cards = AGENTS");
    assert.equal(game.abilities, game.agents * 4, "four abilities per agent");
    assert.equal(game.distinctNames, game.abilities, "ability names are all different");
    assert.equal(game.distinctTypes, game.abilities, "no two abilities share a type (the copy says no two alike)");
    assert.equal(game.maps, game.tabs.all, "map chips = the all tab");
    assert.equal(game.eventChip, !!game.event, "the event map is in its own box while it is on");
    assert.equal(game.tabs.full + game.tabs.small + game.tabs["1v1"], game.maps, "tabs add up to the maps");
    assert.ok(skins.perGun.every((x) => x === skins.perGun[0]), "every shop gun wears the same skins");
    // the homepage counts the pool: the map of the week comes off its tab and the total
    const wk = (cat) => (game.week === cat ? 1 : 0);
    const truth = { agents: game.agents, abilities: game.abilities, modes: game.modes, maps: game.maps - (game.week ? 1 : 0), big: game.tabs.full - wk("full"), small: game.tabs.small - wk("small"), duel: game.tabs["1v1"] - wk("1v1"), guns: shop.guns.length, skins: skins.count, week: game.week };
    console.log("game", JSON.stringify(truth));

    const feat = async (lang) => {
      await page.evaluate((l) => localStorage.setItem("lgp_lang", l), lang);
      await page.goto(BASE + "/index.html", { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => document.querySelectorAll("#feat li").length > 0, null, { timeout: 15000 });
      // the server's settings (the map of the week) redraw the list once they are in
      await page.waitForFunction(() => { try { return !!CFG; } catch (e) { return !1; } }, null, { timeout: 15000 });
      return page.evaluate(() => [...document.querySelectorAll("#feat li")].map((li) => li.textContent));
    };
    const pick = (text, re, label) => { const m = re.exec(text); assert.ok(m, label + " not found in: " + text); return m.slice(1).map(Number); };
    const check = (lang, items, re) => {
      const read = (i, key) => pick(items[i], re[key], lang + " " + key);
      assert.deepEqual(read(0, "modes"), [truth.modes], lang + " modes");
      assert.deepEqual(read(1, "agents"), [truth.agents], lang + " agents");
      assert.deepEqual(read(1, "abilities"), [truth.abilities], lang + " abilities");
      assert.deepEqual(read(2, "maps"), [truth.maps, truth.big, truth.small, truth.duel], lang + " maps and their split");
      assert.equal(/이번 주 맵|map of the week/.test(items[2]), !!truth.week, lang + " the map line names the map of the week while there is one: " + items[2]);
      assert.equal(/이벤트 맵|event map/.test(items[2]), !!game.event, lang + " the map line names the event map while it is open: " + items[2]);
      assert.deepEqual(read(3, "guns"), [truth.guns], lang + " guns");
      assert.deepEqual(read(4, "skins"), [truth.skins, truth.guns], lang + " skins x guns");
      console.log(lang, "numbers match the game");
    };
    const ko = await feat("ko");
    assert.equal(ko.length, 7);
    check("ko", ko, { modes: /모드 (\d+)종/, agents: /요원 (\d+)명/, abilities: /능력 (\d+)개/, maps: /전장 (\d+)곳 — 5대5 (\d+)곳 · 소규모 3대3 (\d+)곳 · 1대1 (\d+)곳/, guns: /총 (\d+)종/, skins: /스킨 (\d+)종 × 총 (\d+)종/ });
    const en = await feat("en");
    assert.equal(en.length, 7);
    check("en", en, { modes: /(\d+) modes/, agents: /(\d+) agents/, abilities: /(\d+) abilities/, maps: /(\d+) maps — (\d+) for 5v5, (\d+) small 3v3, (\d+) duels/, guns: /(\d+) guns/, skins: /(\d+) skins × (\d+) guns/ });
    assert.ok(!/[ᄀ-ᇿ㄰-㆏가-힯]/.test(en.join("\n")), "English feature text has Hangul: " + en.join(" | "));
    assert.deepEqual(f.errors, [], "page errors");
    console.log("home numbers passed");
  } finally { await f.browser.close(); }
})().catch((error) => { console.error(error); process.exit(1); });
