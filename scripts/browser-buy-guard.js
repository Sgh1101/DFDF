const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// The host takes a guest's purchase request at its word: the key was looked up in the weapon table, which also
// holds the golden chest pistol (kept out of the shop and every list, one bullet for 200). Free and in the table, it
// could be "bought" in the buy phase and reloaded for ever. The host now sells only what the shop lists.
(async () => {
  const f = await fixture();
  try {
    const page = await f.page("buyguard", { width: 1280, height: 720 });
    const out = await page.evaluate(() => {
      render = () => {};
      titleCam = () => {};
      room.mode = "std"; room.map = "field"; startGame(AGENTS[0], false); closeShop();
      const me = myActor(), g = world.actors.find((a) => a !== me && isAI(a));
      g.ctrl = "peer-x"; g.credits = 999999; // a guest: its credits are the match's unlimited ones
      world.phase = "buy";
      const buy = (key) => { g.weapons.primary = null; g.weapons.secondary = "pistol"; hostHandleBuy("peer-x", { t: "buy", kind: "weapon", key }); return [g.weapons.primary, g.weapons.secondary]; };
      return { golden: buy("golden"), rifle: buy("rifle"), shop: Object.keys(WEAPONS).includes("golden") };
    });
    console.log(JSON.stringify(out));
    assert.equal(out.shop, false, "the golden pistol is not in the weapon list");
    assert.deepEqual(out.golden, [null, "pistol"], "the golden pistol cannot be bought");
    assert.deepEqual(out.rifle, ["rifle", "pistol"], "a shop gun still can");
    assert.deepEqual(f.errors, [], "no page errors");
    console.log("buy guard: ok");
  } finally {
    await f.browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
