const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// The "click the screen" cover (#lockhint) on a computer:
//  · it is up when a match starts and the mouse is not locked yet, and says Enter is the chat
//  · once the mouse has been locked in that match it does not come back: not when the lock is let go, not in the next round
//    (the shop lets the mouse go every round); a click on the game locks it again
//  · Enter opens the team chat with the mouse free and no cover
//  · the next match starts with the cover again
(async () => {
  const f = await fixture();
  try {
    const p = await f.page("lockhint", { width: 1280, height: 720 });
    const shown = () => p.evaluate(() => !document.getElementById("lockhint").hidden);
    // a start whose lock request the browser refuses (as it may with no click behind it): the case the cover is for
    const start = async () => {
      await p.evaluate(() => {
        titleCam = () => {};
        canvas.requestPointerLock = () => Promise.reject(new Error("refused"));
        room.mode = "std"; room.map = "field"; startGame(AGENTS[0], false); closeShop(); world.phase = "live"; world.roundTime = 99999; ADMIN.freezeAI = true;
      });
      await p.waitForTimeout(900);
      await p.evaluate(() => { delete canvas.requestPointerLock; });
    };
    const unlock = async () => { await p.evaluate(() => document.pointerLockElement && document.exitPointerLock()); await p.waitForFunction(() => !locked); };
    await start();
    await unlock();
    await p.evaluate(() => { $("pause").hidden = true; updateLockHint(); });
    assert.equal(await shown(), true, "the cover is up at the start of a match");
    assert.match(await p.textContent("#lockhint"), /Enter 채팅/);
    // the player clicks the start button: the mouse is locked and the cover goes
    await p.click("#lh-start");
    await p.waitForFunction(() => locked, null, { timeout: 10000 });
    assert.equal(await shown(), false);
    // the lock is let go (as the shop does every round), then the next round: no cover
    await unlock();
    await p.evaluate(() => { $("pause").hidden = true; updateLockHint(); });
    assert.equal(await shown(), false, "no cover once the mouse was locked in this match");
    await p.evaluate(() => { startRound(); closeShop(); world.phase = "live"; world.roundTime = 99999; $("pause").hidden = true; document.pointerLockElement && document.exitPointerLock(); });
    await p.waitForFunction(() => !locked);
    await p.evaluate(() => { $("pause").hidden = true; updateLockHint(); });
    assert.equal(await shown(), false, "no cover in the next round either");
    // Enter opens the team chat, with the mouse free; Escape closes it
    await p.keyboard.press("Enter");
    await p.waitForFunction(() => CHAT.state.open, null, { timeout: 5000 });
    assert.equal(await p.evaluate(() => CHAT.state.scope), "t");
    assert.equal(await shown(), false);
    await p.keyboard.press("Escape");
    await p.waitForFunction(() => !CHAT.state.open);
    // a click on the game locks the mouse again
    await p.evaluate(() => { $("pause").hidden = true; lockCooldown = 0; updateLockHint(); });
    await p.mouse.click(640, 360);
    await p.waitForFunction(() => locked, null, { timeout: 10000 });
    // a new match: the cover is back until the mouse is locked
    await start();
    await unlock();
    await p.evaluate(() => { $("pause").hidden = true; updateLockHint(); });
    assert.equal(await shown(), true, "the next match starts with the cover");
    assert.deepEqual(f.errors, []);
    console.log("lock cover: up at a match's start, gone for the rest of it once the mouse was locked (rounds, shop), Enter opens the chat, back for the next match");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
