const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// Volume sliders, footsteps that come from a side, key bindings (read by the key's place, so the Korean input method cannot
// hide W) and the vibration switch. The settings are opened and clicked the way a player does it; screenshots go to
// test-results/audio-keys-*.png. All failures are listed together.
const bad = [];
const check = (ok, message) => { if (!ok) bad.push(message); };
const START = () => { titleCam = () => {}; room.mode = "std"; room.map = "field"; startGame(AGENTS[0], false); closeShop(); world.phase = "live"; world.roundTime = 1e5; ADMIN.freezeAI = true; };
(async () => {
  const f = await fixture();
  try {
    const lang = (l) => (p) => p.addInitScript((v) => { try { if (v) localStorage.setItem("lgp_lang", v); } catch (e) {} }, l);
    const page = await f.page("audiokeys", { width: 1280, height: 720 }, {}, { bootTimeout: 120000 });

    // ── defaults: nothing about the keys, volumes or vibration changed for a player who never opens the settings ──
    const d = await page.evaluate(() => ({ binds: SETTINGS.binds, vol: [SETTINGS.volMaster, SETTINGS.volFx, SETTINGS.volSteps], haptic: SETTINGS.haptic, defBinds: SET_DEF.binds }));
    check(JSON.stringify(d.binds) === "{}" && JSON.stringify(d.vol) === "[1,1,1]" && d.haptic === true, "defaults: no rebinding, full volumes, vibration on: " + JSON.stringify(d));

    // ── in a match: a Hangul W, the default keys, text fields ──
    await page.evaluate(START);
    await page.waitForTimeout(800);
    const key = (type, init) => page.evaluate(([t, i]) => { const e = new KeyboardEvent(t, Object.assign({ bubbles: true, cancelable: true }, i)); (i.target === "input" ? document.getElementById("probe-input") : document.body).dispatchEvent(e); return e.defaultPrevented; }, [type, init]);
    const flags = () => page.evaluate(() => ({ w: !!keys.w, a: !!keys.a, s: !!keys.s, d: !!keys.d, f: !!keys.f, space: !!keys.space, shift: !!keys.shift, r: !!keys.r, junk: Object.keys(keys).filter((k) => keys[k] && !/^(w|a|s|d|f|r|space|shift|fire|ads|control|_fired)$/.test(k)) }));
    await key("keydown", { key: "ㅈ", code: "KeyW" });
    let s = await flags(); check(s.w && !s.junk.length, "a keydown of 'ㅈ' with code KeyW is Forward (keys.w): " + JSON.stringify(s));
    const moved = await page.evaluate(() => { const me = myActor(), y = me.yaw, x0 = me.pos.x, z0 = me.pos.z; const g = gatherInput(); movePlayer(0.2); return { mv: g.mv, dot: (me.pos.x - x0) * -Math.sin(y) + (me.pos.z - z0) * -Math.cos(y) }; });
    check(moved.mv[1] === -1 && moved.dot > 0.05, "the player moves forward on a Hangul W: " + JSON.stringify(moved));
    await key("keyup", { key: "ㅈ", code: "KeyW" });
    check(!(await flags()).w, "the keyup of 'ㅈ' lets Forward go");
    await key("keydown", { key: "Process", code: "KeyD", keyCode: 229 });
    check((await flags()).d, "a 'Process' keydown (keyCode 229) with code KeyD is Right"); await key("keyup", { key: "Process", code: "KeyD", keyCode: 229 });
    // the other default keys, by their own codes
    for (const [code, flag] of [["KeyA", "a"], ["KeyS", "s"], ["KeyF", "f"], ["Space", "space"], ["ShiftLeft", "shift"], ["ShiftRight", "shift"]]) {
      await key("keydown", { key: "x", code }); const on = (await flags())[flag]; await key("keyup", { key: "x", code }); const off = !(await flags())[flag];
      check(on && off, "default " + code + " holds and lets go keys." + flag);
    }
    // the action keys (a stub stands in for each action)
    const acts = await page.evaluate(() => {
      const seen = [], orig = { startReload, useAbility, toggleShop, switchSlot, jump };
      startReload = () => seen.push("reload"); useAbility = (i) => seen.push("ability" + i); toggleShop = () => seen.push("shop"); switchSlot = (s) => seen.push("slot:" + s); jump = () => seen.push("jump");
      locked = true; player.weapons.primary = player.weapons.primary || "rifle";
      for (const code of ["KeyR", "KeyQ", "KeyE", "KeyC", "KeyX", "KeyB", "Digit1", "Digit2", "Space"]) { document.body.dispatchEvent(new KeyboardEvent("keydown", { code, key: "ㅁ", bubbles: true })); document.body.dispatchEvent(new KeyboardEvent("keyup", { code, key: "ㅁ", bubbles: true })); }
      Object.assign(window, orig); locked = false; return seen;
    });
    check(JSON.stringify(acts) === JSON.stringify(["reload", "ability0", "ability1", "ability2", "ability3", "shop", "slot:primary", "slot:secondary", "jump"]), "the default action keys work with a Hangul 'key': " + JSON.stringify(acts));
    // text fields: nothing typed there moves the player
    await page.evaluate(() => { const i = document.createElement("input"); i.id = "probe-input"; i.type = "text"; document.body.appendChild(i); const t = document.createElement("textarea"); t.id = "probe-area"; document.body.appendChild(t); });
    for (const sel of ["#probe-input", "#probe-area"]) {
      await page.focus(sel); await page.keyboard.type("wasd f", { delay: 10 }); await page.keyboard.down("Shift"); await page.keyboard.down("Space"); await page.keyboard.up("Space"); await page.keyboard.up("Shift");
      s = await flags(); check(!s.w && !s.a && !s.s && !s.d && !s.f && !s.space && !s.shift, sel + ": keys typed into it do not move the player: " + JSON.stringify(s));
      check((await page.inputValue(sel)).startsWith("wasd f"), sel + ": the text is typed as it should be");
    }
    // a key held while the focus goes into a field is still let go by its key-up there
    await page.evaluate(() => document.body.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW", key: "w", bubbles: true })));
    await page.focus("#probe-input"); await page.keyboard.down("w"); await page.keyboard.up("w");
    check(!(await flags()).w, "a key-up inside a text field does not leave Forward held");
    await page.evaluate(() => { document.getElementById("probe-input").remove(); document.getElementById("probe-area").remove(); document.activeElement.blur(); });

    // ── footsteps: panned by the source against the camera ──
    const pans = await page.evaluate(() => {
      const ctx = GAME_AUDIO.context(), made = [], orig = ctx.createStereoPanner.bind(ctx);
      ctx.createStereoPanner = () => { const p = orig(); made.push(p); return p; };
      const bot = world.actors.find((a) => "me" !== a.ctrl && a.alive) || world.actors.find((a) => "me" !== a.ctrl);
      bot.alive = true; ADMIN.freezeAI = true;
      const out = {};
      player.pos.x = 0; player.pos.z = 0; player.y = groundAt(0, 0, 5); camera.rotation.order = "YXZ"; camera.position.set(0, 1.6, 0); camera.rotation.set(0, 0, 0); camera.updateMatrixWorld();
      for (const [name, x, z] of [["left", -8, 0], ["right", 8, 0], ["behind", 0, 8], ["ahead", 0, -8], ["behindLeft", -6, 6]]) {
        made.length = 0; bot.pos.x = x; bot.pos.z = z; bot.y = groundAt(x, z, 5); bot.onGround = true; bot.vel.x = 0; bot.vel.z = 0; bot.root = 0; bot.slow = 1; bot.stunned = 0;
        bot.input = { mv: [0, 0], yaw: bot.yaw, pitch: 0, btn: 0 }; bot._stepAcc = 99; bot._stepMode = "run";
        const sx = bot.pos.x;
        const real = SFX.step, args = []; SFX.step = function () { args.push([...arguments]); return real.apply(this, arguments); };
        try { bot.vel.x = 4; simMove(bot, 0.016); } finally { SFX.step = real; }
        out[name] = { calls: args.length, argPan: args[0] && args[0][3], panners: made.map((p) => p.pan.value), moved: bot.pos.x !== sx };
      }
      // the camera turned: the same source swaps sides (a quarter turn to the left puts a source at -x ahead)
      camera.rotation.y = Math.PI / 2; camera.updateMatrixWorld(); made.length = 0; bot.pos.x = 0; bot.pos.z = -8; bot._stepAcc = 99; bot.vel.x = 4;
      const real = SFX.step; try { simMove(bot, 0.016); } finally { SFX.step = real; }
      out.turned = { panners: made.map((p) => p.pan.value) };
      return out;
    });
    const one = (k) => (pans[k] && pans[k].panners.length === 1 ? pans[k].panners[0] : NaN);
    check(pans.left && pans.left.calls === 1, "a step is played for the moving fighter: " + JSON.stringify(pans.left));
    check(one("left") < -0.7, "a step to the left is panned left: " + one("left"));
    check(one("right") > 0.7, "a step to the right is panned right: " + one("right"));
    check(Math.abs(one("behind")) < 0.1, "a step behind is in the middle: " + one("behind"));
    check(Math.abs(one("ahead")) < 0.1, "a step ahead is in the middle: " + one("ahead"));
    check(one("behindLeft") < -0.4, "a step behind and to the left is still on the left: " + one("behindLeft"));
    check(pans.turned && Math.abs(pans.turned.panners[0]) > 0.7, "turning the camera changes the side: " + JSON.stringify(pans.turned));

    // ── nothing reaches the speakers past the sliders; the sliders set the gains ──
    const route = await page.evaluate(async () => {
      const ctx = GAME_AUDIO.context(), direct = [], orig = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function (dest) { dest === ctx.destination && direct.push(this.constructor.name); return orig.apply(this, arguments); };
      try {
        SFX.beep(true); SFX.step("run", "stone", 0.2, -0.5); SFX.kill && SFX.kill(); SFX.gun && SFX.gun("rifle", 0.3);
        const o = ctx.createOscillator(); o.connect(GAME_AUDIO.output);
      } finally { AudioNode.prototype.connect = orig; }
      return direct;
    });
    check(route.every((n) => n === "DynamicsCompressorNode"), "only the limiter connects to the destination: " + route.join());

    // ── the settings screen ──
    await page.evaluate(() => togglePause());
    await page.waitForTimeout(300);
    check(await page.isVisible("#pause"), "the pause menu opens");
    await page.click("#pause .pz-tabs button[data-tab=snd]");
    for (const id of ["st-vol-master", "st-vol-fx", "st-vol-steps"]) check(await page.isVisible("#" + id), id + " slider is shown in the sound tab");
    await page.waitForTimeout(900);
    await page.screenshot({ path: "test-results/audio-keys-sound.png" });
    const setVol = (id, v) => page.evaluate(([i, val]) => { const e = document.getElementById(i); e.value = val; e.dispatchEvent(new Event("input", { bubbles: true })); }, [id, v]);
    await setVol("st-vol-master", 40); await setVol("st-vol-fx", 70); await setVol("st-vol-steps", 25);
    await page.waitForTimeout(250);
    let g = await page.evaluate(() => ({ m: GAME_AUDIO.master.gain.value, fx: GAME_AUDIO.output.gain.value, st: GAME_AUDIO.steps.gain.value, set: [SETTINGS.volMaster, SETTINGS.volFx, SETTINGS.volSteps], label: document.getElementById("st-vol-master-v").textContent, stored: JSON.parse(localStorage.getItem("lgp_set")) }));
    check(Math.abs(g.m - 0.4) < 0.02 && Math.abs(g.fx - 0.7) < 0.02 && Math.abs(g.st - 0.25) < 0.02, "the sliders set the master, effects and footsteps gains: " + JSON.stringify(g));
    check(JSON.stringify(g.set) === "[0.4,0.7,0.25]" && g.label === "40%", "the settings and the label follow the sliders: " + JSON.stringify(g.set) + g.label);
    check(g.stored.volMaster === 0.4 && g.stored.volFx === 0.7 && g.stored.volSteps === 0.25, "the volumes are saved with the settings");
    await page.click("#st-sfx"); await page.waitForTimeout(250);
    check(await page.evaluate(() => GAME_AUDIO.master.gain.value) < 0.02, "the sound-effects switch still mutes everything");
    await page.click("#st-sfx"); await page.waitForTimeout(250);

    // ── key settings ──
    await page.click("#pause .pz-tabs button[data-tab=keys]");
    const labels = await page.evaluate(() => [...document.querySelectorAll('#pause [data-pane="keys"] .kb-key')].map((b) => b.dataset.action + "=" + b.textContent));
    check(labels.length === 22 && labels.includes("forward=W") && labels.includes("crouch=Shift (L) / Shift (R)"), "every action has a box showing its key: " + labels.join(" "));
    await page.waitForTimeout(900);
    await page.screenshot({ path: "test-results/audio-keys-keys.png" });
    // Forward -> I, with the keyboard the way a player does it
    await page.click('#pause .kb-key[data-action="forward"]');
    check((await page.textContent('#pause .kb-key[data-action="forward"]')) !== "W", "the box waits for a key");
    await page.keyboard.press("i");
    check((await page.textContent('#pause .kb-key[data-action="forward"]')) === "I", "Forward now shows I");
    check(await page.isVisible("#pause"), "pressing the new key does not close the pause menu");
    // Jump -> Q: Q was Ability 1, so the two swap
    await page.click('#pause .kb-key[data-action="jump"]'); await page.keyboard.press("q");
    const swap = await page.evaluate(() => ({ jump: KEYMAP.codes("jump"), ab: KEYMAP.codes("ability1"), msg: document.getElementById("kb-msg").textContent, boxes: [document.querySelector('[data-action="jump"]').textContent, document.querySelector('[data-action="ability1"]').textContent] }));
    check(swap.jump[0] === "KeyQ" && swap.ab[0] === "Space" && swap.boxes.join() === "Q,Space", "a key in use swaps: " + JSON.stringify(swap));
    // Escape cancels, a reserved key is refused
    await page.click('#pause .kb-key[data-action="reload"]'); await page.keyboard.press("Escape");
    check(await page.isVisible("#pause") && (await page.textContent('#pause .kb-key[data-action="reload"]')) === "R", "Escape cancels the binding and keeps the menu");
    await page.click('#pause .kb-key[data-action="reload"]'); await page.keyboard.press("F9");
    check((await page.textContent('#pause .kb-key[data-action="reload"]')) === "R" && /can't|쓸 수 없/.test(await page.textContent("#kb-msg")), "a reserved key is refused");
    // the new keys drive the game
    await page.evaluate(() => togglePause()); await page.waitForTimeout(200);
    check(await page.evaluate(() => $("pause").hidden), "the menu is closed for the next step");
    await key("keydown", { key: "ㅑ", code: "KeyI" });
    s = await flags(); check(s.w, "the new Forward key (a Hangul 'ㅑ' on KeyI) is keys.w");
    await key("keyup", { key: "ㅑ", code: "KeyI" });
    await key("keydown", { key: "w", code: "KeyW" }); s = await flags(); check(!s.w, "the old Forward key no longer is"); await key("keyup", { key: "w", code: "KeyW" });
    const jumps = await page.evaluate(() => { const seen = []; const j = jump; jump = () => seen.push("jump"); const u = useAbility; useAbility = (i) => seen.push("a" + i); locked = true; for (const code of ["KeyQ", "Space"]) document.body.dispatchEvent(new KeyboardEvent("keydown", { code, key: "x", bubbles: true })); locked = false; jump = j; useAbility = u; return seen; });
    check(JSON.stringify(jumps) === '["jump","a0"]', "after the swap Q jumps and Space is Ability 1: " + JSON.stringify(jumps));
    // saved, and still there after a reload
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("lgp_set")).binds);
    check(JSON.stringify(saved.forward) === '["KeyI"]' && JSON.stringify(saved.jump) === '["KeyQ"]' && JSON.stringify(saved.ability1) === '["Space"]', "the bindings are saved with the settings: " + JSON.stringify(saved));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.GAME_BOOT && !document.documentElement.dataset.gameLoading, null, { timeout: 120000 });
    const after = await page.evaluate(() => { document.body.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyI", key: "ㅑ", bubbles: true })); const r = { forward: KEYMAP.codes("forward"), w: !!keys.w }; document.body.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyI", key: "ㅑ", bubbles: true })); return r; });
    check(after.forward[0] === "KeyI" && after.w, "after a reload Forward is still on I: " + JSON.stringify(after));
    // reset keys
    await page.click("#go-set"); await page.click("#pause .pz-tabs button[data-tab=keys]");
    check((await page.textContent('#pause .kb-key[data-action="forward"]')) === "I", "the key settings show the saved key after a reload");
    await page.click("#kb-reset");
    const reset = await page.evaluate(() => ({ codes: KEYMAP.ACTIONS.map((a) => KEYMAP.codes(a.id).join("+")).join(), binds: JSON.parse(localStorage.getItem("lgp_set")).binds, box: document.querySelector('[data-action="forward"]').textContent }));
    check(reset.codes === "KeyW,KeyS,KeyA,KeyD,Space,ShiftLeft+ShiftRight,KeyR,Digit1+Numpad1,Digit2+Numpad2,Digit3+Numpad3,KeyG,KeyY,KeyQ,KeyE,KeyC,KeyX,KeyF,Digit4+Numpad4,KeyB,Tab,KeyN,KeyM" && JSON.stringify(reset.binds) === "{}" && reset.box === "W", "the reset button brings every key back and saves: " + JSON.stringify(reset));
    // a damaged saved value does not break the keys
    await page.evaluate(() => { localStorage.setItem("lgp_set", JSON.stringify({ binds: { forward: "x", jump: [5], reload: ["Escape"] } })); });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.GAME_BOOT && !document.documentElement.dataset.gameLoading, null, { timeout: 120000 });
    check(await page.evaluate(() => KEYMAP.codes("forward")[0] === "KeyW" && KEYMAP.codes("jump")[0] === "Space" && KEYMAP.codes("reload")[0] === "KeyR"), "damaged saved bindings fall back to the defaults");
    await page.evaluate(() => localStorage.removeItem("lgp_set"));
    await page.context().close();

    // ── vibration: a touch phone ──
    const phone = await f.page("audiokeysphone", { width: 740, height: 360 }, { hasTouch: true, isMobile: true }, { bootTimeout: 120000 });
    await phone.evaluate(START); await phone.waitForTimeout(800);
    const buzz = () => phone.evaluate(() => { window.__buzz = []; Object.defineProperty(navigator, "vibrate", { configurable: true, value: (ms) => (window.__buzz.push(ms), true) }); const tab = document.querySelector("#tabil .tab"); tab.dispatchEvent(new Event("touchstart", { bubbles: true })); const am = document.getElementById("ammo"); document.body.classList.add("touching"); am.dispatchEvent(new Event("touchstart", { bubbles: true, cancelable: true })); const c = document.getElementById("tb-crouch"); c.dispatchEvent(new Event("touchstart", { bubbles: true, cancelable: true })); return window.__buzz.length; });
    check(await phone.evaluate(() => SETTINGS.haptic) === true, "vibration is on by default");
    const on = await buzz(); check(on >= 2, "with vibration on, touch buttons vibrate (" + on + " calls)");
    await phone.evaluate(() => togglePause()); await phone.waitForTimeout(300);
    await phone.click("#pause .pz-tabs button[data-tab=ctl]");
    check(await phone.isVisible("#st-haptic"), "the vibration switch is in the controls tab on a touch phone");
    await phone.evaluate(() => document.querySelector("#st-haptic").scrollIntoView());
    await phone.screenshot({ path: "test-results/audio-keys-vibration.png" });
    await phone.click("#st-haptic"); await phone.waitForTimeout(100);
    check(await phone.evaluate(() => SETTINGS.haptic === false && JSON.parse(localStorage.getItem("lgp_set")).haptic === false && !document.getElementById("st-haptic").classList.contains("on")), "the switch turns vibration off and saves it");
    await phone.evaluate(() => togglePause());
    const off = await buzz(); check(off === 0, "with vibration off, nothing vibrates (" + off + " calls)");
    await phone.click("#go-set").catch(() => {});
    await phone.evaluate(() => { SETTINGS.haptic = true; });
    await phone.context().close();

    // ── English ──
    const en = await f.page("audiokeysen", { width: 1280, height: 720 }, {}, { bootTimeout: 120000, beforeLoad: lang("en") });
    await en.click("#go-set");
    const text = await en.evaluate(() => {
      const out = {};
      for (const tab of ["ctl", "snd", "keys"]) { document.querySelector(`#pause .pz-tabs button[data-tab=${tab}]`).click(); out[tab] = [...document.querySelectorAll(`#pause [data-pane="${tab}"] *`)].filter((e) => !e.children.length && /[가-힣]/.test(e.textContent)).map((e) => e.textContent.trim()); }
      out.tab = document.querySelector('#pause .pz-tabs button[data-tab="keys"]').textContent;
      return out;
    });
    for (const k of ["ctl", "snd", "keys"]) check(!text[k].length, "English settings, " + k + " tab: Korean left: " + text[k].join(" | "));
    check(text.tab === "Keys", "English tab name: " + text.tab);
    check(f.errors.length === 0, "page errors: " + f.errors.join(" | "));
    await en.context().close();
  } finally { await f.browser.close(); }
  assert.equal(bad.length, 0, "\n" + bad.join("\n"));
  console.log("volume sliders, panned footsteps, key bindings (Hangul W, rebinding, reset, text fields) and the vibration switch passed");
})().then(() => process.exit(0), (e) => { console.error(e.message || e); process.exit(1); });
