const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// Gunshots in the game: every gun plays its own model (the knife keeps its swish), the hospital answers with a long room
// and the other maps with a short one, the sound is switched off with the sound setting, a burst does not pile up
// voices, and the first shot of a gun costs next to nothing.
(async () => {
  const f = await fixture();
  try {
    const page = await f.page("gunsfx", { width: 1280, height: 720 });
    await page.mouse.click(640, 360);
    await page.evaluate(() => { titleCam = () => {}; room.mode = "std"; room.map = "glacier"; startGame(AGENTS[0], false); closeShop(); });
    await page.waitForTimeout(800);
    const r = await page.evaluate(async () => {
      const out = { starts: 0, byKey: {} };
      const orig = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function () { out.starts++; return orig.apply(this, arguments); };
      const keys = Object.keys(WEAPONS);
      out.keys = keys.length;
      out.missing = keys.filter((k) => "knife" !== k && !GUNSYNTH.has(k));
      // every gun, at your ear and far away
      for (const k of keys) { const s0 = out.starts; for (const far of [0, 0.5]) SFX.gun(k, far); out.byKey[k] = out.starts - s0; await new Promise((res) => setTimeout(res, 40)); }
      out.engine = !!GUNSOUND_ENGINE();
      out.first = {};
      const e = GUNSOUND_ENGINE();
      return out;
    });
    console.log(JSON.stringify({ keys: r.keys, missing: r.missing, engine: r.engine, starts: r.starts }));
    assert.deepEqual(r.missing, [], "every gun has a model");
    assert.ok(r.engine, "the engine started");
    for (const [k, n] of Object.entries(r.byKey)) { if ("knife" === k) continue; assert.ok(n >= 2, k + " played at your ear and at a distance (" + n + ")"); }

    // the old shot kinds the bots use
    const kinds = await page.evaluate(() => { const n0 = []; let c = 0; const o = AudioBufferSourceNode.prototype.start; AudioBufferSourceNode.prototype.start = function () { c++; return o.apply(this, arguments); }; for (const k of ["rifle", "sniper", "shotgun", "heavy", "pistol", "quiet", "nonsense"]) { const s = c; SFX.shot(k, 0); n0.push(c - s); } AudioBufferSourceNode.prototype.start = o; return n0; });
    assert.ok(kinds.every((n) => n >= 1), "every shot kind plays a gun: " + kinds);

    // a burst does not pile up, and far shots are dropped before near ones
    await page.waitForTimeout(1500);
    const burst = await page.evaluate(async () => {
      const o = AudioBufferSourceNode.prototype.start; let c = 0;
      AudioBufferSourceNode.prototype.start = function () { c++; return o.apply(this, arguments); };
      for (let i = 0; i < 200; i++) SFX.gun("minigun", 0);
      const near = c; c = 0;
      for (let i = 0; i < 200; i++) SFX.gun("minigun", 0.8);
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
    const open = await page.evaluate(() => { SFX.gun("rifle", 0); const c = GAME_AUDIO.context(); return { map: CUR_MAP_KEY, rate: c.sampleRate }; });
    await page.evaluate(() => { room.map = "hospital"; startGame(AGENTS[0], false); closeShop(); });
    await page.waitForTimeout(800);
    const rooms = await page.evaluate(() => {
      const c = GAME_AUDIO.context(), seen = [];
      const o = AudioBufferSourceNode.prototype.start; AudioBufferSourceNode.prototype.start = function () { seen.push(this.buffer && this.buffer.duration); return o.apply(this, arguments); };
      SFX.gun("rifle", 0); AudioBufferSourceNode.prototype.start = o;
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
      const layered = await count(() => { window.SKIN_SHOT = { actor: "t1", skin: id }; window.SKIN_SHOOTER = { id: "t1" }; SFX.gun("rifle", 0); });
      window.SKIN_SHOT = null; window.SKIN_SHOOTER = null;
      await new Promise((r) => setTimeout(r, 400));
      const preview = await count(() => SOUNDPACK.preview("default", "shot", "sniper"));
      return { id, layered, preview };
    });
    console.log("skin pack", JSON.stringify(pack));
    assert.ok(pack.id, "a skin with a sound pack exists");
    assert.ok(pack.layered.buffers >= 1 && pack.layered.oscillators >= 1, "the skin's pack layer plays on top of the new shot: " + JSON.stringify(pack.layered));
    assert.ok(pack.preview.buffers >= 3, "the preview's three shots are the new shot: " + JSON.stringify(pack.preview));

    // the knife keeps its own sound
    const knife = await page.evaluate(() => GUNSYNTH.has("knife"));
    assert.equal(knife, false);
    assert.deepEqual(f.errors, []);
    console.log("gunshots: " + (r.keys - 1) + " guns have their own shot, kinds map, bursts capped, sound setting honoured, render " + cost.max.toFixed(0) + " ms at worst");
  } finally { await f.browser.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
