// Multiplayer lag fixes, checked on two real game pages over the shaped test transport (scripts/network-test-transport.js)
// with the browser's real requestAnimationFrame. Every check is reported; the run fails if any does.
const assert = require('node:assert/strict'), { fixture } = require('./browser-fixture');
const { startPair, instrument, reset, report, sleep } = require('./net-lag-harness');
(async () => {
  const f = await fixture(), fails = [];
  const check = async (name, fn) => { try { await fn(); console.log('ok   ', name); } catch (e) { fails.push(name); console.log('FAIL ', name, '-', String(e.message).split('\n').slice(0, 3).join(' | ')); } };
  let pair;
  try {
    pair = await startPair(f); await instrument(pair);
    const { host, guest, transport, bot } = pair;
    const guestId = await guest.evaluate(() => myActor().id);

    // a frame is never exactly 1/60 s: with 16.1 ms frames, the old code (accumulator reset to 0 after a send) sent every 4th
    // frame, 15.5 Hz; carrying the remainder over keeps 20 Hz
    await check('send timing: 16.1 ms frames still send 20 snapshots a second', async () => {
      const at = await host.evaluate(() => {
        const ss = sendSnapshot, at = []; let n = 0; sendSnapshot = function () { at.push(n); };
        for (let i = 0; i < 620; i++) { n++; netStep(1 / 62); }
        sendSnapshot = ss; return at;
      });
      const gaps = at.slice(1).map((x, i) => x - at[i]);
      assert.ok(at.length >= 198 && at.length <= 202, `${at.length} sends in 10 s`);
      assert.ok(Math.max(...gaps) <= 4 && Math.min(...gaps) >= 3, `gaps in frames ${[...new Set(gaps)]}`);
    });
    await check('send timing: a 30 fps host still averages 20 Hz', async () => {
      const sends = await host.evaluate(() => { let n = 0; const ss = sendSnapshot; sendSnapshot = function () { n++; }; for (let i = 0; i < 300; i++) netStep(1 / 30); sendSnapshot = ss; return n; });
      assert.ok(sends >= 195 && sends <= 205, `${sends} sends in 10 s of 30 fps frames`);
    });
    await check('input timing: a 60 fps guest sends one input per frame', async () => {
      const sends = await guest.evaluate(() => { let n = 0; const si = sendInput; sendInput = function (m) { m && 'in' === m.t && n++; }; for (let i = 0; i < 300; i++) netStep(1 / 60); sendInput = si; return n; });
      assert.ok(sends >= 298, `${sends} inputs for 300 frames`);
    });

    await check('late and reordered snapshots are not applied', async () => {
      transport.seed(11); transport.shape('state', { delay: 30, jitter: 5, loss: 0.2, rto: 260, reorder: 0.1, reorderMs: 120 }); transport.shape('event', { delay: 30 });
      await sleep(1000); await reset(pair); await sleep(7000);
      const r = await report(pair, 7);
      console.log('     arrive k-backwards', r.arrive.kBackwards, 'applied k-backwards', r.applied.kBackwards, 'applied', r.applied.n);
      assert.ok(r.arrive.kBackwards > 0, 'the link produced no late snapshots; the check proves nothing');
      assert.equal(r.applied.kBackwards, 0);
      assert.ok(r.applied.n > 40, 'snapshots stopped being applied');
    });
    await check('a host whose counter starts again is followed after about 2 s', async () => {
      transport.unshape('state'); transport.unshape('event');
      await sleep(500);
      await host.evaluate(() => { NET.tick = 0; });
      await guest.waitForFunction(() => NET.lastK != null && NET.lastK < 400 && NET.lastSnap && NET.lastSnap.k < 400, null, { timeout: 8000 });
    });

    await check('a send buffer that is backed up gets no snapshots, and none are queued behind it', async () => {
      const peer = await host.evaluate(() => [...NET.conns.keys()][0]);
      await sleep(600);
      await guest.evaluate(() => { window.__n = 0; const f = NET.onSnapshot; NET.onSnapshot = function () { __n++; return f.apply(this, arguments); }; });
      await host.evaluate((p) => { NET.conns.get(p).state.dataChannel = { bufferedAmount: 1e6 }; }, peer);
      await sleep(1500);
      const held = await guest.evaluate(() => __n);
      await host.evaluate((p) => { NET.conns.get(p).state.dataChannel = { bufferedAmount: 0 }; }, peer);
      await sleep(1500);
      const after = await guest.evaluate(() => __n);
      assert.ok(held <= 2, `${held} snapshots arrived while the buffer was backed up`);
      assert.ok(after - held >= 15, `only ${after - held} snapshots after it drained`);
    });
    await check('a guest with a backed up send buffer sends no inputs', async () => {
      await host.evaluate(() => { window.__in = 0; const o = NET.onInput; NET.onInput = function () { __in++; return o.apply(this, arguments); }; });
      await guest.evaluate(() => { NET.up.state.dataChannel = { bufferedAmount: 1e6 }; });
      await sleep(1200);
      const held = await host.evaluate(() => __in);
      await guest.evaluate(() => { NET.up.state.dataChannel = { bufferedAmount: 0 }; });
      await sleep(1200);
      const after = await host.evaluate(() => __in);
      assert.ok(held <= 3, `${held} inputs while backed up`);
      assert.ok(after - held >= 20, `only ${after - held} inputs after it drained`);
    });

    await check('ping: NET.latency follows the delay on the link (2 x 70 ms)', async () => {
      transport.shape('state', { delay: 70 }); transport.shape('event', { delay: 70 });
      await guest.waitForFunction(() => NET.latency >= 120, null, { timeout: 8000 });
      const v = await guest.evaluate(() => NET.latency);
      console.log('     NET.latency', v);
      assert.ok(v >= 130 && v <= 220, `latency ${v}`);
    });
    await check('ping: the host lists it in the scoreboard message and the Tab scoreboard shows it', async () => {
      await guest.evaluate(() => { window.__sb = null; const o = NET.onEvent; NET.onEvent = function (e) { if (e && e.t === 'sb') window.__sb = e; return o.apply(this, arguments); }; });
      await guest.waitForFunction(() => window.__sb, null, { timeout: 5000 });
      await host.waitForFunction((id) => { const a = actorById(id); const o = NET.conns.get(a.ctrl); return o && o.ping >= 120; }, guestId, { timeout: 8000 });
      const hostSees = await host.evaluate((id) => NET.conns.get(actorById(id).ctrl).ping, guestId);
      await sleep(1500);
      const row = await guest.evaluate((id) => { const r = window.__sb.r.find((x) => x[0] === id); return r; }, guestId);
      assert.ok(row && row[5] >= 120 && row[5] <= 240, `sb row ${JSON.stringify(row)}`);
      await guest.setViewportSize({ width: 1100, height: 620 });
      await guest.evaluate(() => { QOL.openBoard('sb', true); });
      const cell = await guest.evaluate((ph) => [...document.querySelectorAll('#board .bd-row.me .pg')].map((n) => n.textContent), null);
      await guest.screenshot({ path: 'test-results/net-lag-board.png' }).catch(() => {});
      await guest.evaluate(() => QOL.closeBoard());
      await guest.setViewportSize({ width: 320, height: 180 });
      assert.ok(cell.length === 1 && Number(cell[0]) >= 120, `board ping cell ${JSON.stringify(cell)}`);
      assert.ok(hostSees >= 120, `host side ${hostSees}`);
    });
    await check('ping: a small readout shows next to the FPS counter when it is on', async () => {
      await guest.evaluate(() => { SETTINGS.showFps = true; $('fps').hidden = false; });
      await guest.waitForFunction(() => { const n = document.getElementById('netping'); return n && !n.hidden && /\d+ ms/.test(n.textContent); }, null, { timeout: 5000 });
      await guest.setViewportSize({ width: 1100, height: 620 });
      await guest.screenshot({ path: 'test-results/net-lag-ping-hud.png' }).catch(() => {});
      await guest.evaluate(() => document.body.classList.add('touching'));
      await guest.screenshot({ path: 'test-results/net-lag-ping-hud-touch.png' }).catch(() => {});
      await guest.evaluate(() => document.body.classList.remove('touching'));
      await guest.setViewportSize({ width: 320, height: 180 });
      await guest.evaluate(() => { SETTINGS.showFps = false; $('fps').hidden = true; });
      await guest.waitForFunction(() => document.getElementById('netping').hidden, null, { timeout: 3000 });
    });
    transport.unshape('state'); transport.unshape('event');

    await check('a guest gets one hit marker, sound and damage number for a 7-pellet shot', async () => {
      await guest.evaluate(() => {
        window.__h = { marker: 0, sound: 0, num: [], events: [] };
        const hm = hitMarker; hitMarker = function () { __h.marker++; return hm.apply(this, arguments); };
        const sh = SFX.hit; SFX.hit = function () { __h.sound++; return sh.apply(this, arguments); };
        const dn = dmgNumber; dmgNumber = function (e, t) { __h.num.push(Math.round(t)); return dn.apply(this, arguments); };
        const oe = NET.onEvent; NET.onEvent = function (e) { e && e.t === 'hit' && __h.events.push(e); return oe.apply(this, arguments); };
      });
      await host.evaluate(({ bot, guestId }) => {
        const b = actorById(bot), g = actorById(guestId); b.invuln = 0; b.hp = 100; b.armor = 0;
        for (let i = 0; i < 7; i++) dealDamage(b, 10, false, g);
      }, { bot, guestId });
      await guest.waitForFunction(() => __h.events.length >= 1, null, { timeout: 5000 });
      await sleep(600);
      const h = await guest.evaluate(() => __h);
      assert.equal(h.events.length, 1, `${h.events.length} hit events for one shot`);
      assert.equal(h.events[0].amt, 70);
      assert.equal(h.marker, 1); assert.equal(h.sound, 1); assert.deepEqual(h.num, [70]);
    });
    await check('bot shots draw their tracer', async () => {
      const r = await host.evaluate((bot) => {
        const a = actorById(bot); a.alive = true; a.fireCd = 0; a.reloading = 0; a.suppress = 0; GFX.tracer = true;
        let n = 0; const wt = worldTracer; worldTracer = function () { n++; return wt.apply(this, arguments); };
        const key = actorWeaponKey(a); a.ammo[key] = Math.max(a.ammo[key] || 0, 10);
        try { actorFire(a); } finally { worldTracer = wt; }
        return n;
      }, bot);
      assert.equal(r, 1);
    });
    await check('a guest whose yaw has grown past 1000 still moves', async () => {
      await guest.evaluate(() => { world.phase === 'buy' && 0; });
      await host.evaluate(() => { world.phase = 'live'; });
      const before = await host.evaluate((id) => { const a = actorById(id); return [a.pos.x, a.pos.z]; }, guestId);
      await guest.evaluate(() => { locked = true; for (let i = 0; i < 30; i++) document.dispatchEvent(new MouseEvent('mousemove', { movementX: 40000 })); keys.w = true; });
      const yaw = await guest.evaluate(() => myActor().yaw);
      await sleep(2000);
      const after = await host.evaluate((id) => { const a = actorById(id); return { p: [a.pos.x, a.pos.z], yaw: a.yaw }; }, guestId);
      await guest.evaluate(() => { keys.w = false; locked = false; });
      const moved = Math.hypot(after.p[0] - before[0], after.p[1] - before[1]);
      assert.ok(Math.abs(yaw) <= Math.PI + 1e-9, `the guest's yaw is ${yaw}`);
      assert.ok(moved > 1, `the body moved ${moved.toFixed(2)} m`);
      assert.ok(Math.abs(after.yaw) <= Math.PI + 1e-9);
    });
    await check('no page errors, no transport errors', async () => { assert.deepEqual(f.errors, []); assert.deepEqual(transport.errors, []); });
  } finally { pair && pair.transport.stop(); await f.browser.close(); }
  if (fails.length) { console.log('\nFAILED:', fails.length); process.exitCode = 1; } else console.log('\nnet-lag checks passed');
})().catch((e) => { console.error(e); process.exitCode = 1; });
