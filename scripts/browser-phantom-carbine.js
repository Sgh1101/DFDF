const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// The Champions tab and equip path were explored before changing these UI checks.
(async () => {
  const f = await fixture();
  try {
    await f.h.api("auth", { id: "carbinemove", pw: "password", device: "old-phantom-cache" });
    const record = f.h.user("carbinemove"), stamp = f.h.now() + 5000;
    const oldOwned = { rifle: ["champions_atk", "dragon"], carbine: ["champions_atk", "champions_def", "gold"], scout: ["snow"] };
    Object.assign(record, { own: oldOwned, championCoins: 123, gold: 456, skins: { m: { carbine: "champions_atk" }, t: f.h.now() - 1000 } });
    f.h.db.set("user:carbinemove", JSON.stringify(record));
    const p = await f.page("carbinemove", { width: 1280, height: 800 }, {}, { bootTimeout: 120000, beforeLoad: async p => p.addInitScript(({ stamp, oldOwned }) => {
      localStorage.setItem("lgp_skins:carbinemove", JSON.stringify({ t: stamp, m: { carbine: "champions_def" } }));
      localStorage.setItem("lgp_inv", JSON.stringify({ id: "carbinemove", own: oldOwned, gold: 456 }));
      localStorage.setItem("lgp_pulls", JSON.stringify({ id: "carbinemove", l: [{ g: "carbine", s: "champions_def", t: stamp }] }));
    }, { stamp, oldOwned }) });
    await p.waitForFunction(() => CHAMPIONS_PHANTOM.loaded() && GUN_SKINS.owns("scout", "champions_def") && GUN_SKINS.of("scout").id === "champions_def");
    assert.equal(await p.evaluate(() => GUN_SKINS.of("rifle").id), "default");
    assert.deepEqual(await p.evaluate(() => [WEAPONS.carbine.name, WEAPONS.scout.name, GUN_SKINS.of("carbine").id]), ["정찰 소총", "팬텀", "default"]);
    const cached = await p.evaluate(() => JSON.parse(localStorage.getItem("lgp_skins:carbinemove")));
    assert.equal(cached.m.scout, "champions_def"); assert.equal(cached.m.rifle, undefined); assert.equal(cached.m.carbine, undefined);
    assert.equal(f.h.user("carbinemove").championCoins, 123); assert.equal(f.h.user("carbinemove").gold, 456);
    await p.locator("#go-armory").click(); await p.locator('#ar-tabs [data-tab="champions"]').click();
    assert.match(await p.locator("#champion-shop").innerText(), /장착 대상: 팬텀/);
    await p.locator('[data-champion-buy="champions_def"]').click();
    assert.equal(await p.evaluate(() => GUN_SKINS.of("scout").id), "champions_def");
    await p.evaluate(() => { GUN_SKINS.tab("pull"); });
    assert.equal(await p.locator('#pl-recg .it[data-s="champions_def"]').getAttribute("data-g"), "scout");
    const models = await p.evaluate(() => {
      GUN_SKINS.close(); titleCam = render = () => {}; room.mode = "std"; startGame(AGENTS[0], false); closeShop(); ADMIN.freezeAI = true;
      const check = key => { player.weapons.primary = key; player.slot = "primary"; updateViewmodel(true); return !!VM.current.getObjectByName("phantom-rig"); };
      return { scout: check("scout"), carbine: check("carbine"), rifle: check("rifle") };
    });
    assert.deepEqual(models, { scout: true, carbine: false, rifle: false }); assert.deepEqual(f.errors, []);
    console.log("Phantom target: old rifle/carbine ownership and newer local cache preserved without charge, old pull history relabelled, names swapped, shop equips Phantom, original model only on scout passed");
  } finally { await f.browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
