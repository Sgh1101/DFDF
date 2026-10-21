const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// Shift crouches (the Ctrl key is not a game key: Ctrl+D and the like are blocked from the browser and never stick A or D);
// there is no walking key any more: Shift is never sent as a walk, and the speed while
// crouched is the crouch speed, not the walk speed.
(async () => {
  const f = await fixture();
  try {
    const page = await f.page("crouch", { width: 1280, height: 800 });
    await page.evaluate(() => { titleCam = () => {}; room.mode = "std"; room.map = "field"; startGame(AGENTS[0], false); closeShop(); world.phase = "live"; world.roundTime = 1e5; ADMIN.freezeAI = true; });
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => {
      const me = myActor(), out = {};
      const btn = () => gatherInput().btn;
      keys.shift = false; keys.control = false;
      out.none = [!!(btn() & BTN.CROUCH), !!(btn() & BTN.WALK)];
      keys.shift = true;
      out.shift = [!!(btn() & BTN.CROUCH), !!(btn() & BTN.WALK)];
      keys.shift = false;
      // the physical Ctrl key does nothing in the game
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Control", ctrlKey: true, bubbles: true }));
      out.ctrl = [!!keys.control, !!(btn() & BTN.CROUCH)];
      document.body.dispatchEvent(new KeyboardEvent("keyup", { key: "Control", bubbles: true }));
      // Ctrl+D: the browser's bookmark is blocked and D does not stay held
      const hold = (key, o = {}) => { const ev = new KeyboardEvent("keydown", Object.assign({ key, bubbles: true, cancelable: true }, o)); document.body.dispatchEvent(ev); return ev.defaultPrevented; };
      out.combos = ["d", "a", "s", "f", "p"].map((k) => [hold(k, { ctrlKey: true }), !!keys[k]]);
      out.zoom = hold("+", { ctrlKey: true });
      out.cmd = [hold("d", { metaKey: true }), !!keys.d];
      // a plain D is held; losing the window lets every key go
      out.plain = [hold("d"), !!keys.d];
      hold("a"); hold("w");
      window.dispatchEvent(new Event("blur"));
      out.afterBlur = ["a", "d", "w"].map((k) => !!keys[k]);
      // the player's own movement: crouched with Shift, up again when it is let go
      keys.shift = true; movePlayer(0.016); out.crouchOn = player.crouch;
      keys.shift = false; movePlayer(0.016); out.crouchOff = player.crouch;
      return out;
    });
    assert.deepEqual(r.none, [false, false]);
    assert.deepEqual(r.shift, [true, false], "Shift crouches and is not a walk");
    assert.deepEqual(r.ctrl, [false, false], "the Ctrl key is not a game key");
    assert.ok(r.combos.every(([blocked, held]) => blocked && !held), "Ctrl+key is blocked and never held: " + JSON.stringify(r.combos));
    assert.equal(r.zoom, false, "the zoom keys stay the browser's own");
    assert.deepEqual(r.cmd, [true, false]);
    assert.deepEqual(r.plain, [false, true], "a plain D is the game's");
    assert.deepEqual(r.afterBlur, [false, false, false], "losing the window lets every key go");
    assert.equal(r.crouchOn, true); assert.equal(r.crouchOff, false);
    const tips = await page.evaluate(() => document.getElementById("tips").textContent);
    assert.match(tips, /SHIFT\s*앉기/); assert.doesNotMatch(tips, /걷기/);
    assert.deepEqual(f.errors, []);
    console.log("crouch: Shift crouches, no walking key; Ctrl combinations blocked and never stuck; keys let go on blur");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
