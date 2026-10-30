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
    if (part(3)) {
      const bots = await host.evaluate(() => world.actors.filter((a) => a.ctrl === 'ai').map((a) => a.id));
      const guestId = await guest.evaluate(() => myActor().id);
      transport.unshape('state'); transport.unshape('event');
      // a shot's sound
      await guest.evaluate(() => {
        const W = window.__w3 = { events: {}, shots: [], lines: 0, depth: 0, ownLines: 0 };
        const oe = NET.onEvent; NET.onEvent = function (e) { e && (W.events[e.t] = (W.events[e.t] || 0) + 1); return oe.apply(this, arguments); };
        const sg = SFX.gun; SFX.gun = function (key) { window.SKIN_SHOOTER && W.shots.push(SKIN_SHOOTER.id); return sg.apply(this, arguments); };
        // only the tracers (FX.SHOT) of a snapshot are played, and the lines they make are counted
        const prf = playRemoteFX; playRemoteFX = function (list) { W.depth++; try { return prf.call(this, W.onlyShot && Array.isArray(list) ? list.filter((f) => f[0] === FX.SHOT) : list); } finally { W.depth--; } };
        const sp = T.BufferGeometry.prototype.setFromPoints; T.BufferGeometry.prototype.setFromPoints = function (pts) { W.depth && pts && pts.length === 2 && W.lines++; return sp.apply(this, arguments); };
      });
      const fire = (who, n) => host.evaluate(({ who, n }) => {
        const a = actorById(who); a.alive = true; a.fireCd = 0; a.reloading = 0; a.suppress = 0; GFX.tracer = true; a.weapons && (a.slot = a.weapons.primary ? 'primary' : 'secondary');
        for (let i = 0; i < n; i++) { const key = actorWeaponKey(a); a.ammo[key] = Math.max(a.ammo[key] || 0, 10); a.fireCd = 0; actorFire(a); }
      }, { who, n });
      await check('3 shot sound: no shot-sound messages on the event link, and a guest still hears every shot (with the shooter)', async () => {
        await guest.evaluate(() => { __w3.events = {}; __w3.shots.length = 0; });
        for (let i = 0; i < 6; i++) { await fire(bots[i % bots.length], 1); await sleep(120); }
        await sleep(600);
        const w = await guest.evaluate(() => ({ events: __w3.events, shots: __w3.shots }));
        console.log('     ', JSON.stringify(w));
        assert.equal(w.events['shot-sound'] || 0, 0, 'shot-sound events arrived');
        assert.equal(w.shots.length, 6, `${w.shots.length} of 6 shots were heard`);
        assert.deepEqual(w.shots.slice().sort(), Array.from({ length: 6 }, (_, i) => bots[i % bots.length]).sort(), 'the shooters');
      });
      await check('3 shot sound: a host that is told the guest is old (no nv in its hello) still sends it the event', async () => {
        const peer = await host.evaluate(() => [...NET.conns.keys()][0]);
        await host.evaluate((p) => { NET.conns.get(p).nv = 0; }, peer);
        await guest.evaluate(() => { __w3.events = {}; __w3.shots.length = 0; });
        await fire(bots[0], 1); await sleep(600);
        const w = await guest.evaluate(() => ({ events: __w3.events, shots: __w3.shots }));
        await host.evaluate((p) => { NET.conns.get(p).nv = 2; }, peer);
        assert.equal(w.events['shot-sound'], 1);
        assert.ok(w.shots.length >= 1, 'the event was not played');
      });
      await check('3 shot sound: the guest says nv 2 in its hello', async () => {
        const nv = await host.evaluate(() => [...NET.conns.values()].map((c) => c.nv));
        assert.deepEqual(nv, [2]);
      });
      await check('3 shot sound: the guest draws no second tracer for its own shot, and still draws the others\'', async () => {
        await guest.evaluate(() => { __w3.lines = 0; __w3.onlyShot = true; });
        await fire(guestId, 3); await sleep(700);
        const own = await guest.evaluate(() => __w3.lines);
        await guest.evaluate(() => { __w3.lines = 0; });
        await fire(bots[0], 3); await sleep(700);
        const other = await guest.evaluate(() => { __w3.onlyShot = false; return __w3.lines; });
        console.log('     tracers drawn from the snapshot: for my 3 shots', own, ', for a bot\'s 3 shots', other);
        assert.equal(own, 0, 'the echo of my own shot');
        assert.ok(other >= 3, `only ${other} tracers for the bot's shots`);
      });

      // the skin tickets
      await check('3 skt: sent when it changes, not every 8 s; in parts under the limit; the guest reads them whole', async () => {
        const r = await host.evaluate(async (bots) => {
          // five bodies each named by a 4000 byte connection (20 KB in all, over the 16,300 PeerJS drops at): quiet entries
          // keep the host from handing them back to the bots
          const ids = bots.slice(0, 7), keys = ids.map((id, i) => String(i).repeat(4000));
          ids.forEach((id, i) => { const a = actorById(id); a.ctrl = keys[i]; NET.conns.set(keys[i], { quiet: true }); });
          window.__bigCtrl = { ids, keys };
          sendEventAll({ t: 'ctrl', id: ids[0], ctrl: keys[0], name: actorById(ids[0]).name });
          return ids.length;
        }, bots);
        await guest.evaluate(() => { window.__skt = []; const oe = NET.onEvent; NET.onEvent = function (e) { if (e && e.t === 'skt') __skt.push({ bytes: JSON.stringify(e).length, rows: e.l.length, n: e.n || 1, i: e.i || 0, g: e.g }); return oe.apply(this, arguments); }; });
        await sleep(1500);
        const first = await guest.evaluate(() => __skt.slice());
        // twelve seconds with nothing changing (the old host sent it again at 8 s)
        await guest.evaluate(() => { __skt.length = 0; });
        await sleep(12000);
        const idle = await guest.evaluate(() => __skt.slice());
        // a change: another body takes another name
        await host.evaluate(() => { const { ids } = window.__bigCtrl; const a = actorById(ids[1]); const k = 'z'.repeat(4000); NET.conns.delete(a.ctrl); a.ctrl = k; NET.conns.set(k, { quiet: true }); window.__bigCtrl.keys[1] = k; sendEventAll({ t: 'ctrl', id: a.id, ctrl: k, name: a.name }); });
        await sleep(1500);
        const changed = await guest.evaluate(() => __skt.slice());
        console.log('      first', JSON.stringify(first.map((m) => [m.rows, m.bytes])), 'idle', idle.length, 'after a change', JSON.stringify(changed.map((m) => [m.rows, m.bytes])));
        assert.ok(first.length >= 1, 'the list never arrived (a message over 16,300 bytes is dropped)');
        assert.ok(first.every((m) => m.bytes < 9000), `a part is ${Math.max(...first.map((m) => m.bytes))} bytes`);
        assert.equal(first.reduce((a, m) => a + m.rows, 0), await host.evaluate(() => world.actors.length), 'every body is in the list');
        assert.equal(idle.length, 0, `${idle.length} lists in 12 s of no change`);
        assert.ok(changed.length >= 1, 'a change was not sent');
        await host.evaluate(() => { const { ids, keys } = window.__bigCtrl; ids.forEach((id, i) => { NET.conns.delete(keys[i]); const a = actorById(id); a.ctrl = 'ai'; sendEventAll({ t: 'ctrl', id, ctrl: 'ai', name: a.name }); }); });
      });
    }
    if (part(4)) {
      await check('4 serialize once: a snapshot is turned into bytes once per tick, however many guests there are', async () => {
        const r = await host.evaluate(() => {
          const enc = new TextEncoder(), saved = new Map(NET.conns); let calls = 0, got = [];
          const stringify = JSON.stringify; JSON.stringify = function (v) { v && v.t === 's' && calls++; return stringify.apply(this, arguments); };
          try {
            for (let i = 0; i < 4; i++) NET.conns.set('fake' + i, { state: { open: true, serialization: 'json', send(o) { enc.encode(JSON.stringify(o)); got.push('obj'); }, _bufferedSend(b) { got.push(b.length); } }, event: { open: true, send() {} } });
            // a link of another kind (not "json") gets the object
            NET.conns.set('other', { state: { open: true, serialization: 'binary', send(o) { got.push('obj'); } }, event: { open: true, send() {} } });
            const k0 = NET.tick; calls = 0; sendSnapshot(buildSnapshot()); const n = calls;
            return { calls: n, k: NET.tick - k0, got };
          } finally { JSON.stringify = stringify; for (const k of [...NET.conns.keys()]) saved.has(k) || NET.conns.delete(k); }
        });
        console.log('     ', JSON.stringify(r));
        assert.equal(r.calls, 1, `the snapshot was serialized ${r.calls} times for 6 links`);
        assert.equal(r.got.filter((x) => typeof x === 'number').length, 4);
        assert.equal(new Set(r.got.filter((x) => typeof x === 'number')).size, 1, 'the same bytes');
        assert.equal(r.got.filter((x) => x === 'obj').length, 1, 'the link of another kind');
      });
      await check('4 serialize once: the real guest still receives and applies the snapshots', async () => {
        const k0 = await guest.evaluate(() => NET.lastK); await sleep(1000);
        const k1 = await guest.evaluate(() => NET.lastK);
        assert.ok(k1 - k0 >= 15, `${k1 - k0} snapshots in a second`);
      });
    }
    pair && pair.transport.stop();
    if (part(3)) {
      // hill, flags and zone: the guest gets the state in the snapshot, not on the event link
      for (const [mode, map, read] of [['hill', 'g05', () => ({ i: CONQUEST.Z.i, owner: CONQUEST.Z.owner, x: Math.round(CONQUEST.Z.x), z: Math.round(CONQUEST.Z.z), hud: !!document.getElementById('hill-hud') && !document.getElementById('hill-hud').hidden })], ['ctf', 'g05', () => ({ atk: CTF.F.atk.st, def: CTF.F.def.st, hx: Math.round(CTF.F.atk.home.x), hud: !!document.getElementById('ctf-hud') && !document.getElementById('ctf-hud').hidden })], ['zone', 'nightport', () => ({ stage: SHRINK_ZONE.Z.stage, state: SHRINK_ZONE.Z.state, big: SHRINK_ZONE.Z.r > 0, hud: !!document.getElementById('zone-hud') && !document.getElementById('zone-hud').hidden })]]) {
        const p2 = await startPair(f, { mode, map });
        try {
          const readFn = read.toString();
          await p2.guest.evaluate(() => { window.__st = {}; const rc = clientRecv; clientRecv = function (e) { e && e.t && e.t !== 's' && (__st[e.t] = (__st[e.t] || 0) + 1); return rc.apply(this, arguments); }; });
          await check(`3 mode state: ${mode} reaches the guest in the snapshot, not as event messages`, async () => {
            await sleep(3500);
            const h = await p2.host.evaluate(`(${readFn})()`), g = await p2.guest.evaluate(`(${readFn})()`), seen = await p2.guest.evaluate(() => __st);
            console.log('     ', JSON.stringify({ host: h, guest: g, eventMessages: seen[mode] || 0 }));
            assert.deepEqual(g, h);
            assert.equal(seen[mode] || 0, 0, `${seen[mode]} ${mode} messages on the event link`);
          });
          await check(`3 mode state: ${mode} is still sent as a message to a guest that does not read the snapshot's`, async () => {
            const peer = await p2.host.evaluate(() => [...NET.conns.keys()][0]);
            await p2.host.evaluate((p) => { NET.conns.get(p).nv = 0; }, peer);
            await p2.guest.evaluate(() => { window.__st = {}; });
            await sleep(2500);
            const seen = await p2.guest.evaluate(() => __st);
            assert.ok((seen[mode] || 0) >= 3, `${seen[mode] || 0} ${mode} messages in 2.5 s`);
          });
        } finally { p2.transport.stop(); await p2.host.close().catch(() => {}); await p2.guest.close().catch(() => {}); }
      }
    }
    await check('no page errors, no transport errors', async () => { assert.deepEqual(f.errors, []); assert.deepEqual(pair.transport.errors, []); });
  } finally { await f.browser.close(); }
  if (fails.length) { console.log('\nFAILED:', fails.length); process.exitCode = 1; } else console.log('\nnet-wave2 checks passed');
})().catch((e) => { console.error(e); process.exitCode = 1; });
