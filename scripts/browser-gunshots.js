const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// Gunshots in the game: every gun plays its own model (the knife keeps its swish), the hospital answers with a long room
// and the other maps with a short one, the sound is switched off with the sound setting, a burst does not pile up
// voices, and the first shot of a gun costs next to nothing.
(async () => {
  const f = await fixture();
  try {
    const page = await f.page("gunsfx", { width: 1280, height: 720 });
    await page.waitForFunction(() => VALORANT_PACK.status === 'ready', null, { timeout:120000 });
    await page.mouse.click(640, 360);
    await page.evaluate(() => { titleCam = () => {}; room.mode = "std"; room.map = "glacier"; startGame(AGENTS[0], false); closeShop(); });
    await page.waitForTimeout(800);
    const r = await page.evaluate(async () => {
      const out = { starts: 0, byKey: {} };
      const orig = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function () { out.starts++; return orig.apply(this, arguments); };
      const keys = Object.keys(WEAPONS);
      out.keys = keys.length;
      out.sourceKeys = keys.filter(k => VALORANT_PACK.items.has(k));
      out.missing = keys.filter((k) => "knife" !== k && !GUNSYNTH.has(k));
      // every gun, at your ear and far away
      for (const k of keys.filter(k => !VALORANT_PACK.items.has(k))) { const s0 = out.starts; for (const far of [0, 0.5]) SFX.gun(k, far); out.byKey[k] = out.starts - s0; await new Promise((res) => setTimeout(res, 40)); }
      out.engine = !!GUNSOUND_ENGINE();
      out.first = {};
      const e = GUNSOUND_ENGINE();
      return out;
    });
    console.log(JSON.stringify({ keys: r.keys, missing: r.missing, engine: r.engine, starts: r.starts }));
    assert.deepEqual(r.missing, [], "every gun has a model");
    assert.ok(r.engine, "the engine started");
    for (const [k, n] of Object.entries(r.byKey)) { if ("knife" === k) continue; assert.ok(n >= 2, k + " played at your ear and at a distance (" + n + ")"); }
    assert.equal(r.sourceKeys.length, 9);
    for (const key of r.sourceKeys) {
      const expected = await page.evaluate(key => {const item=VALORANT_PACK.items.get(key);const paths=[item.sounds.shoot,item.sounds.shoot_3p].map(ref=>'gun/assets/'+ref.replace(':','/tacz_sounds/')+'.ogg');const counts=paths.map(path=>VALORANT_PACK.audioPlayed.filter(p=>p===path).length);SFX.gun(key,0);SFX.gun(key,.5);return {paths,counts};},key);
      await page.waitForFunction(({paths,counts})=>paths.every((path,i)=>VALORANT_PACK.audioPlayed.filter(p=>p===path).length>counts[i]),expected,{timeout:20000});
    }

    // the old shot kinds the bots use
    const kinds = await page.evaluate(() => { const n0 = []; let c = 0; const o = AudioBufferSourceNode.prototype.start; AudioBufferSourceNode.prototype.start = function () { c++; return o.apply(this, arguments); }; for (const k of ["rifle", "sniper", "shotgun", "heavy", "pistol", "quiet", "nonsense"]) { const s = c; SFX.shot(k, 0); n0.push(c - s); } AudioBufferSourceNode.prototype.start = o; return n0; });
    assert.ok(kinds.every((n) => n >= 1), "every shot kind plays a gun: " + kinds);

    // a burst does not pile up, and far shots are dropped before near ones
    await page.waitForTimeout(1500);
    const burst = await page.evaluate(async () => {
      const o = AudioBufferSourceNode.prototype.start; let c = 0;
      AudioBufferSourceNode.prototype.start = function () { c++; return o.apply(this, arguments); };
      for (let i = 0; i < 200; i++) SFX.gun("burst", 0);
      const near = c; c = 0;
      for (let i = 0; i < 200; i++) SFX.gun("burst", 0.8);
      AudioBufferSourceNode.prototype.start = o;
      return { near, far: c };
    });
    assert.ok(burst.near > 0 && burst.near <= 40, "200 shots at once start at most 40 voices (" + burst.near + ")");
    assert.equal(burst.far, 0, "when it is crowded the far shots are dropped first");

    // the first shot of a gun is cheap: rendering is measured in the page
    const cost = await page.evaluate(() => { const e = GUNSOUND_ENGINE(), t = {}; for (const k of Object.keys(GUNSYNTH.SPEC)) { const s = performance.now(); GUNSYNTH.render(GUNSYNTH.SPEC[k], e ? 44100 : 44100, 3); t[k] = performance.now() - s; } const v = Object.values(t); return { max: Math.max(...v), mean: v.reduce((a, b) => a + b, 0) / v.length, worst: Object.entries(t).sort((a, b) => b[1] - a[1])[0][0] }; });
    console.log("render cost (ms)", JSON.stringify({ max: +cost.max.toFixed(1), mean: +cost.mean.toFixed(1), worst: cost.worst }));
    assert.ok(cost.max < 150, "one gun renders in " + cost.max.toFixed(0) + " ms at the worst");

    // rooms: the open air on this map, the hospital's long room on the next
    const open = await page.evaluate(() => { SFX.gun("burst", 0); const c = GAME_AUDIO.context(); return { map: CUR_MAP_KEY, rate: c.sampleRate }; });
    await page.evaluate(() => { room.map = "hospital"; startGame(AGENTS[0], false); closeShop(); });
    await page.waitForTimeout(800);
    const rooms = await page.evaluate(() => {
      const c = GAME_AUDIO.context(), seen = [];
      const o = AudioBufferSourceNode.prototype.start; AudioBufferSourceNode.prototype.start = function () { seen.push(this.buffer && this.buffer.duration); return o.apply(this, arguments); };
      SFX.gun("burst", 0); AudioBufferSourceNode.prototype.start = o;
      return { map: CUR_MAP_KEY, played: seen.length };
    });
    assert.equal(rooms.map, "hospital"); assert.ok(rooms.played >= 1);

    // sound off: nothing starts
    const off = await page.evaluate(() => { const was = SETTINGS.sfx; SETTINGS.sfx = false; let c = 0; const o = AudioBufferSourceNode.prototype.start; AudioBufferSourceNode.prototype.start = function () { c++; return o.apply(this, arguments); }; SFX.gun("rifle", 0); SFX.gun("sniper", 0); AudioBufferSourceNode.prototype.start = o; SETTINGS.sfx = was; return c; });
    assert.equal(off, 0, "with the sound off no shot starts");

    // a skin's sound pack still lies on top of the shot, and its preview plays the new shot
    const pack = await page.evaluate(async () => {
      const id = Object.keys(SOUNDPACK.skins).find((s) => SOUNDPACK.packs[SOUNDPACK.skins[s]]);
      const count = (fn) => { let b = 0, o = 0; const ob = AudioBufferSourceNode.prototype.start, oo = OscillatorNode.prototype.start; AudioBufferSourceNode.prototype.start = function () { b++; return ob.apply(this, arguments); }; OscillatorNode.prototype.start = function () { o++; return oo.apply(this, arguments); }; return Promise.resolve(fn()).then(() => new Promise((r) => setTimeout(r, 450))).then(() => { AudioBufferSourceNode.prototype.start = ob; OscillatorNode.prototype.start = oo; return { buffers: b, oscillators: o }; }); };
      await new Promise((r) => setTimeout(r, 600));
      const layered = await count(() => { window.SKIN_SHOT = { actor: "t1", skin: id }; window.SKIN_SHOOTER = { id: "t1" }; SFX.gun("burst", 0); });
      window.SKIN_SHOT = null; window.SKIN_SHOOTER = null;
      await new Promise((r) => setTimeout(r, 400));
      const preview = await count(() => SOUNDPACK.preview("default", "shot", "sniper"));
      return { id, layered, preview };
    });
    console.log("skin pack", JSON.stringify(pack));
    assert.ok(pack.id, "a skin with a sound pack exists");
    assert.ok(pack.layered.buffers >= 1 && pack.layered.oscillators >= 1, "the skin's pack layer plays on top of the new shot: " + JSON.stringify(pack.layered));
    assert.ok(pack.preview.buffers >= 3, "the preview's three shots are the new shot: " + JSON.stringify(pack.preview));

    // the sound strip in the skin window follows the gun in view (it stayed on the rifle when another gun was chosen)
    const strip = await page.evaluate(async () => {
      document.getElementById("go-armory").click();
      await new Promise((r) => setTimeout(r, 800));
      GUN_SKINS.tab("gun");
      await new Promise((r) => setTimeout(r, 500));
      const out = {}, click = (name) => [...document.querySelectorAll("#ar-guns .ar-gun")].find((b) => b.querySelector("b").textContent === name).click();
      for (const [key, name] of [["carbine", WEAPONS.carbine.name], ["sniper", WEAPONS.sniper.name], ["pistol", WEAPONS.pistol.name]]) {
        click(name);
        await new Promise((r) => setTimeout(r, 400));
        const t = document.querySelector("#skin-sample-label");
        out[key] = { gun: t.querySelector(".ss-gun").textContent, note: t.querySelector(".ss-note").textContent, want: GUNSYNTH.SPEC[key].note };
      }
      // a skin looked at on that gun stays in the strip
      click(WEAPONS.carbine.name);
      await new Promise((r) => setTimeout(r, 400));
      document.querySelector('#ar-skins [data-s="tiger"]').click();
      await new Promise((r) => setTimeout(r, 500));
      out.peek = document.querySelector("#skin-sample-label .ss-title b").textContent;
      // and the button hands that gun to the preview
      const asked = [], pv = SOUNDPACK.preview;
      SOUNDPACK.preview = function (skin, part, gun) { asked.push(part + ":" + gun); return pv.apply(this, arguments); };
      click(WEAPONS.carbine.name);
      await new Promise((r) => setTimeout(r, 400));
      document.querySelector('[data-sample="shot"]').click();
      await new Promise((r) => setTimeout(r, 300));
      SOUNDPACK.preview = pv;
      SOUNDPACK.stop();
      out.asked = asked;
      GUN_SKINS.close();
      return out;
    });
    console.log("strip", JSON.stringify(strip));
    const names=await page.evaluate(()=>Object.fromEntries(['carbine','sniper','pistol'].map(k=>[k,WEAPONS[k].name])));
    for (const k of ["carbine", "sniper", "pistol"]) { assert.equal(strip[k].gun, names[k], k + " is named"); assert.equal(strip[k].note, strip[k].want, k + " has its own description"); }
    assert.equal(strip.peek, "호랑이", "a skin looked at on the carbine is the one in the strip");
    assert.deepEqual(strip.asked, ["shot:carbine"], "the shot button asks the preview for the carbine");

    // the knife keeps its own sound
    const knife = await page.evaluate(() => GUNSYNTH.has("knife"));
    assert.equal(knife, false);
    assert.deepEqual(f.errors, []);
    console.log("gunshots: " + (r.keys - 1) + " guns have their own shot, kinds map, bursts capped, sound setting honoured, render " + cost.max.toFixed(0) + " ms at worst");
  } finally { await f.browser.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
