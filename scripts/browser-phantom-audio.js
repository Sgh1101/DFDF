const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
(async () => {
  const f = await fixture();
  try {
    let release;
    const coldLoad = new Promise(resolve => { release = resolve; });
    const p = await f.page("soundtest", { width: 1280, height: 800 }, {}, { bootTimeout: 120000,
      beforeLoad: p => p.route("**/audio/samples.json*", async route => {
        await coldLoad;
        // Emulate the old installed worker's immutable manifest entry. The new
        // versioned request must bypass it without flushing all map textures.
        if (!new URL(route.request().url()).searchParams.has('v')) {
          const stale = structuredClone(require('../assets/champions-phantom/2026-0.1.0/audio/samples.json'));
          delete stale.samples['block.note_block.hat'];delete stale.samples['block.note_block.snare'];
          return route.fulfill({ contentType: 'application/json', body: JSON.stringify(stale) });
        }
        await route.continue();
      }) });
    await p.locator("#go-armory").click();
    await p.locator('#ar-tabs [data-tab="champions"]').click();
    await p.evaluate(() => {
      const ac = GAME_AUDIO.context();
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
    await p.waitForFunction(() => document.querySelector('#phantom-audio-status').textContent.includes('불러오는'));
    // A cold mobile request must survive the old 1.5s combat-note expiry.
    await new Promise(resolve => setTimeout(resolve, 1800)); release();
    await p.waitForFunction(() => __audio.rms > 0.001);
    assert.equal(await p.evaluate(() => __audio.sources.length), 10);
    console.log("decoded original audio RMS", await p.evaluate(() => __audio.rms));
    await p.locator("#phantom-stop").click();
    await p.evaluate(() => { __audio.sources.length = 0; __audio.rms = 0; });
    await p.locator('[data-phantom-demo="inspect"]').click();
    await p.waitForFunction(() => __audio.sources.length === 104 && __audio.rms > .001);
    assert.match(await p.locator('#phantom-audio-status').innerText(), /원본 연주/);
    await p.locator("#phantom-stop").click();
    await p.evaluate(() => { __audio.sources.length = 0; __audio.rms = 0; });
    await p.waitForFunction(() => CHAMPIONS_PHANTOM.loaded());
    await p.locator('[data-phantom-demo="fin"]').click();
    const music = require('../assets/champions-phantom/2026-0.1.0/audio/music-sequences.json').profiles.finisher_music;
    const finNotes = music.events.filter(e => e.at < 8 - 3.03).length;
    await p.waitForFunction(n => __audio.sources.length >= n, finNotes);
    await p.waitForFunction(() => GAME_AUDIO.context().currentTime > __audio.sources[0].at + .1);
    await p.evaluate(() => { __audio.rms = 0; });
    await p.waitForFunction(() => __audio.rms > .001);
    await p.locator("#phantom-stop").click();
    // Cancellation while still loading cannot resurrect sound after Stop.
    await p.evaluate(() => { __audio.sources.length = 0; void CHAMPIONS_AUDIO.playMusic('inspect', true); CHAMPIONS_AUDIO.stopPreview(); });
    assert.equal(await p.evaluate(() => __audio.sources.length), 0);
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
    await p.close();
    let attempts = 0;
    const retry = await f.page('soundretry', { width: 844, height: 390 }, {}, { beforeLoad: p => p.route('**/audio/music-sequences.json', route => ++attempts <= 2 ? route.fulfill({ status: 503, body: 'test unavailable' }) : route.continue()) });
    await retry.waitForFunction(() => !!CHAMPIONS_AUDIO.error());
    await retry.locator('#go-armory').click();await retry.locator('#ar-tabs [data-tab="champions"]').click();
    await retry.locator('[data-phantom-demo="inspect"]').click();
    await retry.waitForFunction(() => document.querySelector('#phantom-audio-status').textContent.includes('재시도'));
    await retry.locator('[data-phantom-demo="inspect"]').click();
    await retry.waitForFunction(() => document.querySelector('#phantom-audio-status').textContent.includes('재생 중')).catch(async e => {
      e.message += '\nRetry diagnostics: ' + JSON.stringify({ attempts, state: await retry.evaluate(() => ({ error: CHAMPIONS_AUDIO.error(), ready: CHAMPIONS_AUDIO.ready(), context: GAME_AUDIO.context().state, text: document.querySelector('#phantom-audio-status').textContent, hidden: document.querySelector('#phantom-audio-status').hidden })) }); throw e;
    });
    await retry.locator('#phantom-stop').click();
    assert.deepEqual(f.errors, []);
    console.log("Original audio: cold preview >1.5s, audible inspect/finisher music, five kill ladders, Stop/cancel, sound setting, ability isolation and 503/retry on a small viewport passed. No forced audio resume.");
  } finally { await f.browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
