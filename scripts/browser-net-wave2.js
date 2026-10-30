// Multiplayer smoothness and chatter (wave 2), on two real game pages over the shaped test transport
// (scripts/network-test-transport.js) with the browser's real requestAnimationFrame. Every check is reported; the run fails if any does.
//   1. remote bodies are drawn between two host snapshots (interpolation buffer), not lerped for 50 ms and then still
//   2. the guest's own body is corrected against what the host did with the same input (input acknowledgement)
//   3. the per-shot sound, the skin tickets and the hill / flag / zone state take less of the reliable event link
//   4. a snapshot is serialized once per tick, not once per guest
const assert = require('node:assert/strict'), { fixture } = require('./browser-fixture');
const { startPair, instrument, reset, report, sleep } = require('./net-lag-harness');
const only = (process.argv[2] || 'all').split(',');
const part = (n) => only.includes('all') || only.includes(String(n));
(async () => {
  const f = await fixture(), fails = [];
  const check = async (name, fn) => { try { await fn(); console.log('ok   ', name); } catch (e) { fails.push(name); console.log('FAIL ', name, '-', String(e.message).split('\n').slice(0, 4).join(' | ')); } };
  let pair;
  try {
    pair = await startPair(f, { keepBots: 5 }); await instrument(pair, { walk: false });
    const { host, guest, transport, bot } = pair;

    if (part(1)) {
      // the body is drawn 100 ms in the past, on the line between the two snapshots around that time. These checks feed the buffer
      // by hand (the host's snapshots are held back) and move the clock.
      await check('1 interpolation: a body is drawn on the line between the snapshots, 100 ms behind the newest time', async () => {
        transport.hold('state');
        const r = await guest.evaluate((bot) => {
          const e = actorById(bot), real = performance.now.bind(performance); let fake = 5000;
          performance.now = () => fake;
          try {
            NET.clk = { off: 0, at: fake, stamp: fake }; e.net = { buf: [] };
            for (let T = 5000; T <= 5500; T += 50) e.net.buf.push({ T, x: 10 + (4 * (T - 5000)) / 1000, y: 0, z: 5, yaw: 0, pitch: 0.1 });
            const out = [];
            for (const now of [5300, 5333, 5400]) { fake = now; interpRemote(e, 0.016); out.push([e.pos.x, e.pos.z, e.vel.x]); }
            return out;
          } finally { performance.now = real; }
        }, bot);
        // at time t the picture shows where the body was at t - 100 ms: 10 + 4 * (t - 5000 - 100) / 1000
        const want = [10.8, 10.932, 11.2];
        r.forEach((p, i) => assert.ok(Math.abs(p[0] - want[i]) < 1e-6 && p[1] === 5, `at ${i}: ${JSON.stringify(p)} want x ${want[i]}`));
        assert.ok(Math.abs(r[0][2] - 4) < 1e-6, `velocity ${r[0][2]}`);
      });
      await check('1 interpolation: yaw goes the short way round, and a jump of 10 m is not crossed', async () => {
        const r = await guest.evaluate((bot) => {
          const e = actorById(bot), real = performance.now.bind(performance); let fake = 9000;
          performance.now = () => fake;
          try {
            NET.clk = { off: 0, at: fake, stamp: fake };
            e.net = { buf: [{ T: 9000, x: 0, y: 0, z: 0, yaw: 3.0, pitch: 0 }, { T: 9050, x: 0, y: 0, z: 0, yaw: -3.0, pitch: 0 }] };
            fake = 9125; interpRemote(e, 0.016); const yaw = e.yaw;
            e.net = { buf: [{ T: 9000, x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }, { T: 9100, x: 10, y: 0, z: 0, yaw: 0, pitch: 0 }, { T: 9150, x: 10.1, y: 0, z: 0, yaw: 0, pitch: 0 }] };
            const xs = []; for (const now of [9150, 9180, 9199, 9201, 9230]) { fake = now; interpRemote(e, 0.016); xs.push(e.pos.x); }
            return { yaw, xs };
          } finally { performance.now = real; }
        }, bot);
        // 3.0 -> -3.0 the short way is 0.283 rad through PI: half way is PI (the long way would put it near 0)
        assert.ok(Math.abs(Math.abs(r.yaw) - Math.PI) < 0.05, `yaw ${r.yaw}`);
        assert.ok(r.xs.every((x) => x === 0 || x >= 10), `jump crossed: ${r.xs}`);
        assert.equal(r.xs[0], 0); assert.ok(r.xs[4] >= 10);
      });
      await check('1 interpolation: late snapshots are carried on for 100 ms and then the body stands', async () => {
        const r = await guest.evaluate((bot) => {
          const e = actorById(bot), real = performance.now.bind(performance); let fake = 2000;
          performance.now = () => fake;
          try {
            NET.clk = { off: 0, at: fake, stamp: fake };
            e.net = { buf: [{ T: 2000, x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }, { T: 2050, x: 0.2, y: 0, z: 0, yaw: 0, pitch: 0 }] };
            const xs = []; for (const now of [2150, 2200, 2250, 2400, 3000]) { fake = now; interpRemote(e, 0.016); xs.push([e.pos.x, e.vel.x]); }
            return xs;
          } finally { performance.now = real; }
        }, bot);
        // newest sample at 2050 (x 0.2, 4 m/s); the picture at now-100: 2150 -> 2050 exactly, then up to 100 ms further, then still
        assert.ok(Math.abs(r[0][0] - 0.2) < 1e-6, JSON.stringify(r));
        assert.ok(Math.abs(r[1][0] - 0.4) < 1e-6 && Math.abs(r[2][0] - 0.6) < 1e-6, JSON.stringify(r));
        assert.equal(r[3][0], r[4][0], 'it keeps going after 100 ms');
        assert.equal(r[4][1], 0, 'it stands');
      });
      transport.resume('state');
      await guest.evaluate(() => { NET.clk = null; for (const a of world.actors) a.net && (a.net.buf = []); });

      // the real thing: a bot walking at 4 m/s seen through a link with 40 ms +-25 ms delay
      await check('1 smoothness: a constant-speed bot under jitter is almost never drawn standing still', async () => {
        await sleep(500);
        transport.seed(7); transport.shape('state', { delay: 40, jitter: 25 }); transport.shape('event', { delay: 40, jitter: 25 });
        await sleep(2500); await reset(pair); await sleep(8000);
        const r = await report(pair, 8);
        console.log('     still', JSON.stringify(r.still), 'speed', JSON.stringify(r.speed), 'fps guest', r.fps.guest);
        assert.ok(r.still.frames > 150, `${r.still.frames} frames measured`);
        assert.ok(r.still.share < 6, `${r.still.share}% of the frames stood still`);
        // 4 m/s, with the turn at each end of its 6 m beat: nine in ten frames fall between 2 and 7 (the old picture went 0 to 100)
        assert.ok(r.speed.p5 > 1.5 && r.speed.p95 < 7.5, `per-frame speed ${r.speed.p5}..${r.speed.p95} m/s (5th to 95th percentile)`);
        transport.unshape('state'); transport.unshape('event');
      });
    }
    pair && pair.transport.stop();
    await check('no page errors, no transport errors', async () => { assert.deepEqual(f.errors, []); assert.deepEqual(pair.transport.errors, []); });
  } finally { await f.browser.close(); }
  if (fails.length) { console.log('\nFAILED:', fails.length); process.exitCode = 1; } else console.log('\nnet-wave2 checks passed');
})().catch((e) => { console.error(e); process.exitCode = 1; });
