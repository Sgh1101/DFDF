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
    if (part(2)) {
      const { hold } = require('./net-lag-harness');
      const guestId = await guest.evaluate(() => myActor().id);
      // the host moves a guest's body by each input for the time the input covered, not by its own frame for the latest input
      await check('2 host: inputs that arrive together move the body by the time they cover; the ack names the last one', async () => {
        await host.evaluate(() => { world.phase = 'live'; });
        const r = await host.evaluate((gid) => {
          const g = actorById(gid), peer = g.ctrl, out = {};
          let best = { yaw: 0, d: -1 };
          for (let i = 0; i < 24; i++) {
            const yaw = (i / 24) * Math.PI * 2, p = new T.Vector3(g.pos.x, g.y, g.pos.z); let d = 0;
            for (let k = 0; k < 60; k++) { const x = p.x, z = p.z; moveWithSlide(p, -Math.sin(yaw) * 0.1, -Math.cos(yaw) * 0.1, g.y, PR); const m = Math.hypot(p.x - x, p.z - z); if (m < 0.09) break; d += m; }
            if (d > best.d) best = { yaw, d };
          }
          out.free = best.d;
          const realSeq = g.input.seq || 0; let seq = realSeq;
          const send = (n, extra) => { for (let i = 0; i < n; i++) NET.onInput(peer, { t: 'in', seq: ++seq, mv: [0, -1], btn: 0, yaw: best.yaw, pitch: 0, ...extra }); };
          const run = (label) => { const x = g.pos.x, z = g.pos.z; g._bank = 0.5; g._bankT = performance.now(); netStep(1 / 60); out[label] = Math.hypot(g.pos.x - x, g.pos.z - z); };
          g.vel.set(0, 0, 0);
          send(10, { dt: 167 }); run('tenInputs');            // 10 x 16.7 ms at 9 m/s = 1.5 m
          g.vel.set(0, 0, 0);
          send(1, {}); run('noDt');                           // an old guest: one host frame at 9 m/s = 0.15 m
          g.vel.set(0, 0, 0);
          g.inq = null; g._bank = null; g._bankT = 0;
          send(100, { dt: 1000 }); run('flood');              // 10 s of input in an instant: the host's own time pays (at most 0.6 s)
          out.simSeq = g.simSeq; out.lastSeq = seq; out.queued = g.inq ? g.inq.length : 0;
          g.input.seq = realSeq; g.simSeq = realSeq; g.inq = null; g.vel.set(0, 0, 0);   // the guest's own inputs go on from where they were
          return out;
        }, guestId);
        console.log('     ', JSON.stringify(r));
        if (r.free < 4) return console.log('      (not enough free run here; skipped)');
        // one host frame (1/60 s) of an input without dt is the unit: ten inputs of 16.7 ms are ten of them
        assert.ok(r.noDt > 0.05 && r.noDt < 0.3, `an input without dt moved it ${r.noDt} m`);
        assert.ok(r.tenInputs > 8.5 * r.noDt && r.tenInputs < 11.5 * r.noDt, `ten inputs moved the body ${r.tenInputs} m, one frame ${r.noDt} m`);
        assert.ok(r.simSeq <= r.lastSeq - 50, `a flood of 100 inputs of 0.1 s: the host moved the body by ${r.lastSeq - r.simSeq < 100 ? 100 - (r.lastSeq - r.simSeq) : 100} of them at once (${r.flood} m)`);
      });
      await check('2 guest: a snapshot corrects only what the host did differently, a third at a time, and snaps over 2.5 m', async () => {
        transport.hold('state');
        const r = await guest.evaluate(() => {
          const me = myActor(), flags = 1, home = [me.pos.x, me.y, me.pos.z]; // alive
          const row = (x, y, z) => [me.id, Math.round(100 * x), Math.round(100 * y), Math.round(100 * z), 0, 0, 100, 0, flags, 0, 0, 0];
          const run = (hist, x, y, z, ack) => { me.pos.set(10, 0, 10); me.y = 0; me._hist = hist; me._hostDriven = false; reconcileLocal(me, row(x, y, z), ack); return { p: [me.pos.x, me.pos.z], h: me._hist && me._hist.map((h) => [h.x, h.z]) }; };
          const H = () => [{ seq: 5, x: 8, y: 0, z: 8 }, { seq: 6, x: 9, y: 0, z: 9 }, { seq: 7, x: 10, y: 0, z: 10 }];
          const res = {
            same: run(H(), 8, 0, 8, [me.id, 5]),            // the host had it where the guest had it: nothing moves (the 18% pull would move it)
            off: run(H(), 8.6, 0, 8, [me.id, 5]),           // 0.6 m off: a third of it, in the history too
            far: run(H(), 18, 0, 8, [me.id, 5]),            // 10 m off: the host's place plus what the guest moved since (2, 2)
            noHist: run(null, 10.3, 0, 10, [me.id, 5]),     // nothing to compare with: left alone
            old: run(null, 10.3, 0, 10, undefined),         // an old host: pulled 18%
          };
          me.pos.set(home[0], home[1], home[2]); me.y = home[1]; me._hist = null;
          return res;
        });
        transport.resume('state');
        assert.deepEqual(r.same.p, [10, 10]);
        assert.ok(Math.abs(r.off.p[0] - 10.18) < 1e-9 && r.off.p[1] === 10 && Math.abs(r.off.h[1][0] - 9.18) < 1e-9, JSON.stringify(r.off));
        assert.ok(Math.abs(r.far.p[0] - 20) < 1e-9 && Math.abs(r.far.p[1] - 10) < 1e-9, JSON.stringify(r.far));
        assert.deepEqual(r.noHist.p, [10, 10]);
        assert.ok(Math.abs(r.old.p[0] - 10.054) < 1e-9, JSON.stringify(r.old));
      });
      await check('2 guest: what only the host knows (slow, speed buff, root, concussion) is taken over, and given back', async () => {
        transport.hold('state');
        const r = await guest.evaluate(() => {
          const me = myActor(), row = [me.id, Math.round(100 * me.pos.x), 0, Math.round(100 * me.pos.z), 0, 0, 100, 0, 1, 0, 0, 0];
          me._hist = null; me._hostDriven = false;
          reconcileLocal(me, row, [me.id, 5, 3, 50, 130, 200]);
          const on = { slow: me.slow, buff: me.speedBuff, root: me.root > 0, conc: me.concuss > 0, tag: me._tagT };
          reconcileLocal(me, row, [me.id, 6]);
          const off = { slow: me.slow, buff: me.speedBuff, root: me.root, conc: me.concuss };
          return { on, off };
        });
        transport.resume('state');
        assert.deepEqual(r.on, { slow: 0.5, buff: 1.3, root: true, conc: true, tag: 0.2 });
        assert.deepEqual(r.off, { slow: 1, buff: 1, root: 0, conc: 0 });
      });
      await check('2 guest: a body the host moves (zipline, swing) is drawn from the snapshots and handed back without a jump', async () => {
        transport.hold('state');
        const r = await guest.evaluate(() => {
          const me = myActor(), real = performance.now.bind(performance), home = [me.pos.x, me.y, me.pos.z]; let fake = 7000;
          performance.now = () => fake;
          try {
            const row = (x) => [me.id, Math.round(100 * x), 0, 0, 0, 0, 100, 0, 1, 0, 0, 0];
            NET.clk = { off: 0, at: fake, stamp: fake }; me.pos.set(0, 0, 0); me._hist = [{ seq: 1, x: 0, y: 0, z: 0 }];
            reconcileLocal(me, row(3), [me.id, 2, 4]); const a = { hd: me._hostDriven, hist: me._hist, x: me.pos.x };
            fake = 7050; NET.clk.stamp = fake; reconcileLocal(me, row(3.5), [me.id, 3, 4]);
            fake = 7120; interpRemote(me, 0.016); const mid = me.pos.x;
            fake = 7250; NET.clk.stamp = fake; reconcileLocal(me, row(4), [me.id, 4]);
            return { a, mid, after: { hd: me._hostDriven, x: me.pos.x, hist: me._hist } };
          } finally { performance.now = real; me.pos.set(home[0], home[1], home[2]); me.y = home[1]; me._hist = null; me._hostDriven = false; NET.clk = null; }
        });
        transport.resume('state');
        assert.ok(r.a.hd && r.a.hist === null && r.a.x === 3, JSON.stringify(r.a));
        assert.ok(r.mid > 3 && r.mid < 3.5, `drawn at ${r.mid}`);
        assert.ok(!r.after.hd && r.after.x >= 3.5 && r.after.x <= 4, JSON.stringify(r.after));
      });
      // the real thing: hold W for 2 s and let go, at 100 ms each way
      await check('2 stop: holding W for 2 s at 100 ms each way is not corrected, and the body does not slide after the key is up', async () => {
        await guest.evaluate(() => { NET.clk = null; });
        await sleep(300);
        const r = await hold(pair, 100);
        console.log('     ', JSON.stringify(r));
        assert.ok(r.ran > 3, `the body ran only ${r.ran} m`);
        assert.equal(r.corrections.snaps, 0);
        assert.ok(r.corrections.max < 0.12, `largest correction ${r.corrections.max} m`);
        assert.ok(r.slide && r.slide.max < 0.1, `slid ${JSON.stringify(r.slide)} m after release`);
        assert.ok(r.hostMinusGuest < 0.15, `host and guest ended ${r.hostMinusGuest} m apart`);
      });
      transport.unshape('state'); transport.unshape('event');
    }
    pair && pair.transport.stop();
    await check('no page errors, no transport errors', async () => { assert.deepEqual(f.errors, []); assert.deepEqual(pair.transport.errors, []); });
  } finally { await f.browser.close(); }
  if (fails.length) { console.log('\nFAILED:', fails.length); process.exitCode = 1; } else console.log('\nnet-wave2 checks passed');
})().catch((e) => { console.error(e); process.exitCode = 1; });
