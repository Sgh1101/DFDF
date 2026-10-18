const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
(async () => {
  const f = await fixture();
  try {
    const p = await f.page("soundtest", { width: 1280, height: 800 }, {}, { bootTimeout: 120000 });
    await p.locator("#go-armory").click();
    await p.locator('#ar-tabs [data-tab="champions"]').click();
    await p.waitForFunction(() => CHAMPIONS_AUDIO.ready());
    await p.evaluate(async () => {
      SETTINGS.sfx = true;
      const ac = GAME_AUDIO.context(); await ac.resume();
      const analyser = ac.createAnalyser(), mute = ac.createGain(); mute.gain.value = 0;
      GAME_AUDIO.output.connect(analyser); analyser.connect(mute); mute.connect(ac.destination);
      window.__audio = { sources: [], multi: 0, rms: 0, analyser, mute };
      const original = ac.createBufferSource.bind(ac);
      ac.createBufferSource = () => { const s = original(), start = s.start.bind(s); s.start = (...args) => { __audio.sources.push({ at: args[0], pitch: s.playbackRate.value, duration: s.buffer.duration }); return start(...args); }; return s; };
      SFX.multi = () => __audio.multi++;
      const data = new Float32Array(analyser.fftSize);
      const meter = () => { analyser.getFloatTimeDomainData(data); __audio.rms = Math.max(__audio.rms, Math.sqrt(data.reduce((s, n) => s + n * n, 0) / data.length)); __audio.raf = requestAnimationFrame(meter); }; meter();
    });
    await p.locator('[data-phantom-demo="kill"]').click();
    await p.waitForFunction(() => __audio.rms > 0.001);
    console.log("decoded original audio RMS", await p.evaluate(() => __audio.rms));
    await p.locator("#phantom-stop").click();
    const ladder = await p.evaluate(async () => {
      CHAMPIONS_AUDIO.reset(); __audio.sources.length = 0;
      const me = player; window.myActor = () => me; world.round = 77;
      const counts = [];
      for (let n = 1; n <= 5; n++) {
        window.KILL_EVENT = { gun: "scout", skin: "champions_atk", kind: n % 2 ? "gun" : "head" };
        playKillFx("test", n % 2 === 0); delete window.KILL_EVENT;
        // load() and resume() each yield a microtask before the scheduler runs.
        for (let i = 0; i < 6; i++) await Promise.resolve();
        counts.push(__audio.sources.length);
      }
      return counts;
    });
    assert.deepEqual(ladder, [10, 20, 32, 44, 107], "only the original five arrangements, including on headshots");
    await p.waitForFunction(() => GAME_AUDIO.context().currentTime > __audio.sources[0].at + 0.3);
    assert.equal(await p.evaluate(() => __audio.multi), 0, "stock multikill melody cannot overlap Phantom");
    const settings = await p.evaluate(async () => {
      CHAMPIONS_AUDIO.reset(); __audio.sources.length = 0; SETTINGS.sfx = false;
      const muted = await CHAMPIONS_AUDIO.play(1); SETTINGS.sfx = true;
      world.round++;
      KILL_EVENT = { gun: "scout", skin: "champions_def", kind: "gun" }; const exclusive = SFX.kill(false); delete window.KILL_EVENT;
      for (let i = 0; i < 6; i++) await Promise.resolve();
      const count = __audio.sources.length;
      KILL_EVENT = { gun: "scout", skin: "champions_def", kind: "ability" }; const ability = SFX.kill(false); delete window.KILL_EVENT;
      CHAMPIONS_AUDIO.reset(); cancelAnimationFrame(__audio.raf); GAME_AUDIO.output.disconnect(__audio.analyser); __audio.analyser.disconnect(); __audio.mute.disconnect();
      return { muted, exclusive, count, ability: ability === false };
    });
    assert.deepEqual(settings, { muted: false, exclusive: false, count: 10, ability: false });
    assert.deepEqual(f.errors, []);
    console.log("Original kill recordings: audible browser signal, five ladders, no generic/head/multi overlay, sound setting and ability isolation passed");
  } finally { await f.browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
