// Measurement harness for the host-authoritative snapshot stream (host page + guest page over the shaped test transport).
// It keeps the browser's real requestAnimationFrame (scripts/browser-fixture.js realRaf) and measures on the guest:
//   arrivals   gap between snapshots reaching clientRecv, how many carry a tick counter k lower than one already seen
//   applied    the same for the snapshots the game actually applied (NET.onSnapshot)
//   corrections  how far reconcileLocal moved the local player per snapshot
//   still      share of game frames where a remote bot walking at constant speed was drawn where it already was
// and on the host: gaps between the snapshots it sent. Run `node scripts/net-lag-harness.js` through /tmp/agent-browser.sh-style env.
// Wave 2 adds: speed (per-frame speed of the constant-speed bot: mean, sd, coefficient of variation), hold() (hold W for 2 s and
// let go at 50/100/200 ms one-way delay: correction sizes, snaps over 2.5 m, the slide after release), chatter() (messages and
// bytes per second per guest in a 10-actor fight, and how late events arrive over a link that loses 3% of them).
// `LAG_SCENARIOS=smooth,hold,chatter,send` picks which parts run (default all); send is the host's time in sendSnapshot with 9 guests.
const { fixture } = require('./browser-fixture'), { installTransport } = require('./network-test-transport');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function startPair(f, { keepBots = 1, viewport = { width: 320, height: 180 }, mode = 'std', map = 'pogu' } = {}) {
  const host = await f.page('lag_host', viewport, {}, { realRaf: true }), guest = await f.page('lag_guest', viewport, {}, { realRaf: true });
  const transport = await installTransport([host, guest]);
  for (const page of [host, guest]) await page.evaluate(() => { render = () => {}; titleCam = () => {}; });
  const code = await host.evaluate(async () => { await createRoom(); return NET.room; });
  await guest.evaluate((code) => joinRoom(code), code);
  await host.waitForFunction(() => room.members.size === 2 && NET.conns.size === 1);
  await host.evaluate(({ mode, map }) => { room.mode = mode; room.map = map; hostStartMatch(); ADMIN.freezeAI = true; world.phase = 'live'; }, { mode, map });
  await guest.waitForFunction(() => world.actors.length > 0 && myActor() && world.phase !== 'menu');
  // fewer bodies keep the two pages at a frame rate the machine can hold; one bot stays as the constant-speed walker
  const bot = await host.evaluate((keep) => {
    const ais = world.actors.filter((a) => a.ctrl === 'ai');
    for (const a of ais.slice(keep)) { a.group && scene.remove(a.group); world.actors.splice(world.actors.indexOf(a), 1); }
    return ais[0] ? ais[0].id : null;
  }, keepBots);
  return { host, guest, transport, bot };
}
async function instrument({ host, guest, bot }, { speed = 4, span = 6, walk = true } = {}) {
  await host.evaluate(({ bot, speed, span }) => {
    const H = window.__hostLag = { sends: [], steps: 0 };
    const hs = step; step = function () { H.steps++; return hs.apply(this, arguments); };
    const ss = sendSnapshot; sendSnapshot = function (s) { H.sends.push(performance.now()); return ss.apply(this, arguments); };
    const a = actorById(bot), x0 = a.pos.x; let s = 0;
    const sm = simMove; simMove = function (e, dt) {
      if (e !== a) return sm.apply(this, arguments);
      s += speed * dt; const m = s % (2 * span), d = m > span ? 2 * span - m : m; e.pos.x = x0 + d; e.vel.x = e.vel.z = 0;
    };
  }, { bot, speed, span });
  await guest.evaluate(({ bot, walk }) => {
    // the local player walks about so that reconcileLocal has a prediction to correct
    const pat = [['w'], ['w', 'd'], ['w'], ['w', 'a'], ['s'], ['s', 'd'], ['s'], ['s', 'a']]; let pi = 0;
    walk && setInterval(() => { for (const k of ['w', 'a', 's', 'd']) keys[k] = false; for (const k of pat[pi++ % pat.length]) keys[k] = true; }, 600);
    const L = window.__lag = { arrive: [], applied: [], corr: [], steps: 0, frames: 0, still: 0, last: null, speeds: [], me: [], snaps: 0 };
    const gs = step; step = function () { L.steps++; return gs.apply(this, arguments); };
    const rc = clientRecv; clientRecv = function (e) { if (e && e.t === 's') L.arrive.push([e.k, performance.now()]); return rc.apply(this, arguments); };
    const os = NET.onSnapshot; NET.onSnapshot = function (s) { L.applied.push([s.k, performance.now()]); return os.apply(this, arguments); };
    const rl = reconcileLocal; reconcileLocal = function (e) { const x = e.pos.x, z = e.pos.z; const r = rl.apply(this, arguments); const c = Math.hypot(e.pos.x - x, e.pos.z - z); L.corr.push(c); c > 2.5 && L.snaps++; return r; };
    const sy = syncActorModel; syncActorModel = function (o) {
      const r = sy.apply(this, arguments);
      const now = performance.now();
      if (o.id === bot && world.phase !== 'menu') {
        const p = { x: o.pos.x, z: o.pos.z, t: now };
        if (L.last) { const d = Math.hypot(p.x - L.last.x, p.z - L.last.z); L.frames++; if (d < 1e-4) L.still++; if (now > L.last.t) L.speeds.push(d / ((now - L.last.t) / 1000)); }
        L.last = p;
      }
      if (o.ctrl === 'me' && world.phase !== 'menu') L.me.push([now, o.pos.x, o.pos.z]);
      return r;
    };
  }, { bot, walk });
}
const gaps = (ts) => ts.slice(1).map((t, i) => t - ts[i]);
const pct = (a, p) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
const back = (list) => { let top = -Infinity, n = 0; for (const [k] of list) { if (k <= top) n++; else top = k; } return n; };
const r1 = (x) => Math.round(x * 10) / 10;
async function reset(pair) {
  await pair.host.evaluate(() => { __hostLag.sends.length = 0; __hostLag.steps = 0; });
  await pair.guest.evaluate(() => { const L = __lag; L.arrive.length = L.applied.length = L.corr.length = L.speeds.length = L.me.length = 0; L.frames = L.still = L.steps = L.snaps = 0; L.last = null; });
}
async function report(pair, seconds) {
  const hostSteps = await pair.host.evaluate(() => __hostLag.steps), h = await pair.host.evaluate(() => __hostLag.sends.slice()), L = await pair.guest.evaluate(() => ({ ...__lag }));
  const sendGap = gaps(h), arrGap = gaps(L.arrive.map((x) => x[1])), appGap = gaps(L.applied.map((x) => x[1]));
  const stat = (g) => ({ n: g.length + 1, hz: r1(((g.length + 1) / seconds)), mean: r1(mean(g)), sd: r1(sd(g)), p50: r1(pct(g, 0.5)), p95: r1(pct(g, 0.95)), max: r1(Math.max(0, ...g)) });
  const corr = L.corr.filter((c) => c > 0);
  return {
    fps: { host: r1(hostSteps / seconds), guest: r1(L.steps / seconds) },
    hostSend: stat(sendGap), arrive: { ...stat(arrGap), kBackwards: back(L.arrive) }, applied: { ...stat(appGap), kBackwards: back(L.applied) },
    corrections: { n: L.corr.length, moved: corr.length, mean: r1(1000 * mean(corr)) / 1000, p95: Math.round(1000 * pct(corr, 0.95)) / 1000, max: Math.round(1000 * Math.max(0, ...corr)) / 1000, snaps: L.snaps },
    still: { frames: L.frames, still: L.still, share: L.frames ? Math.round((1000 * L.still) / L.frames) / 10 : 0 },
    // the bot walks at 4 m/s: a smooth picture has every frame near 4 (the turns at the ends of its 6 m beat are included)
    speed: { n: L.speeds.length, mean: r1(mean(L.speeds)), sd: r1(sd(L.speeds)), cv: Math.round(100 * sd(L.speeds) / (mean(L.speeds) || 1)) / 100, p5: r1(pct(L.speeds, 0.05)), p95: r1(pct(L.speeds, 0.95)) },
  };
}
// scenarios: [name, shape for "state", shape for "event"]
const SCENARIOS = {
  clean: { state: { delay: 25, jitter: 3 }, event: { delay: 25, jitter: 3 } },
  jitter: { state: { delay: 40, jitter: 25 }, event: { delay: 40, jitter: 25 } },
  lossy: { state: { delay: 40, jitter: 10, loss: 0.1, rto: 250, reorder: 0.05, reorderMs: 90 }, event: { delay: 40, jitter: 10, loss: 0.03, rto: 250 } },
};
async function measure(f, { seconds = 8, scenarios = Object.keys(SCENARIOS) } = {}) {
  const pair = await startPair(f); await instrument(pair);
  const out = {};
  try {
    for (const name of scenarios) {
      pair.transport.seed(7); pair.transport.shape('state', SCENARIOS[name].state); pair.transport.shape('event', SCENARIOS[name].event);
      await sleep(1500); await reset(pair); await sleep(seconds * 1000);
      out[name] = await report(pair, seconds);
    }
  } finally { pair.transport.stop(); }
  return { out, pair };
}

// Part 2: hold W for 2 s at a one-way delay, then let go. The guest predicts its own body; the host's snapshots say where the host
// had it. Reports how far each snapshot moved the guest's body, how many of those were snaps (over 2.5 m), and the slide after the
// key is released (the body creeping on after it had stopped).
async function hold(pair, oneWay, { holdMs = 2000 } = {}) {
  const { host, guest, transport } = pair;
  transport.seed(5); transport.shape('state', { delay: oneWay }); transport.shape('event', { delay: oneWay });
  await sleep(2500);
  const dir = await guest.evaluate(() => {
    const me = myActor(); let best = { yaw: 0, d: -1 };
    for (let i = 0; i < 24; i++) {
      const yaw = (i / 24) * Math.PI * 2, p = new T.Vector3(me.pos.x, me.y, me.pos.z); let d = 0;
      for (let k = 0; k < 200; k++) { const x = p.x, z = p.z; moveWithSlide(p, -Math.sin(yaw) * 0.1, -Math.cos(yaw) * 0.1, me.y, PR); const m = Math.hypot(p.x - x, p.z - z); if (m < 0.09) break; d += m; }
      if (d > best.d) best = { yaw, d };
    }
    return best;
  });
  // the run speed is 9 m/s: shorten the hold if the free run is shorter than 2 s of it
  const ms = Math.min(holdMs, Math.floor((dir.d / 9) * 1000 * 0.9));
  await guest.evaluate((yaw) => { myActor().yaw = yaw; }, dir.yaw);
  await sleep(600);
  await reset(pair);
  const t0 = await guest.evaluate(() => { keys.w = true; return performance.now(); });
  await sleep(ms);
  const tR = await guest.evaluate(() => { keys.w = false; return performance.now(); });
  await sleep(3500);
  const L = await guest.evaluate(() => ({ corr: __lag.corr.slice(), snaps: __lag.snaps, me: __lag.me.slice() }));
  const hostPos = await host.evaluate(() => { const g = world.actors.find((a) => a.ctrl !== 'me' && a.ctrl !== 'ai'); return [g.pos.x, g.pos.z]; });
  const at = L.me.find((p) => p[0] >= tR + 400), end = L.me[L.me.length - 1];
  const run = L.me.filter((p) => p[0] >= t0 && p[0] <= tR), start = run[0] || L.me[0];
  const d2 = (a, b) => Math.hypot(a[1] - b[1], a[2] - b[2]);
  const afterRelease = L.me.filter((p) => p[0] >= tR + 400);
  const moved = L.corr.filter((c) => c > 0);
  return {
    oneWayMs: oneWay, holdMs: ms, freeRun: r1(dir.d),
    ran: r1(start && at ? d2(start, at) : 0),
    corrections: { n: L.corr.length, moved: moved.length, mean: Math.round(1000 * mean(moved)) / 1000, p95: Math.round(1000 * pct(moved, 0.95)) / 1000, max: Math.round(1000 * Math.max(0, ...moved)) / 1000, snaps: L.snaps },
    // from where the body had stopped 0.4 s after the key came up to where it ended, and the furthest it strayed from there
    slide: at ? { end: Math.round(100 * d2(at, end)) / 100, max: Math.round(100 * Math.max(0, ...afterRelease.map((p) => d2(at, p)))) / 100 } : null,
    hostMinusGuest: Math.round(100 * Math.hypot(hostPos[0] - end[1], hostPos[1] - end[2])) / 100,
  };
}

// Part 3: what a guest receives in a 10-actor fight (every bot firing about 6 times a second), by message type; and how late events
// arrive over a link that loses some of them (the event link is ordered: a lost message holds up the ones behind it).
async function chatter(f, { seconds = 12, loss = 0 } = {}) {
  const pair = await startPair(f, { keepBots: 99 }); await instrument(pair, { walk: false });
  const { host, guest, transport } = pair;
  try {
    await host.evaluate(() => {
      const bots = world.actors.filter((a) => a.ctrl === 'ai');
      window.__fight = setInterval(() => {
        for (const a of bots) {
          const foes = world.actors.filter((x) => x.alive && x.team !== a.team); if (!a.alive || !foes.length) continue;
          const t = foes[Math.floor(Math.random() * foes.length)];
          a.yaw = Math.atan2(-(t.pos.x - a.pos.x), -(t.pos.z - a.pos.z)); a.fireCd = 0; a.reloading = 0; a.suppress = 0;
          const key = actorWeaponKey(a); a.ammo[key] = 30;
          if (Math.random() < 0.55) actorFire(a);
          if (Math.random() < 0.05) { t.hp = Math.max(t.hp, 80); t.invuln = 0; dealDamage(t, 12, false, a); }
        }
      }, 100);
      window.__probe = setInterval(() => sendEventAll({ t: 'probe', n: ++window.__probeN || (window.__probeN = 1), ts: Date.now() }), 200);
    });
    await guest.evaluate(() => {
      const C = window.__chat = { msgs: {}, bytes: {}, probe: [] };
      const rc = clientRecv; clientRecv = function (e) {
        if (e && e.t) { const n = JSON.stringify(e).length; C.msgs[e.t] = (C.msgs[e.t] || 0) + 1; C.bytes[e.t] = (C.bytes[e.t] || 0) + n; if (e.t === 'probe') C.probe.push(Date.now() - e.ts); }
        return rc.apply(this, arguments);
      };
    });
    transport.seed(9);
    const shape = { state: { delay: 40, jitter: 10 }, event: loss ? { delay: 40, jitter: 10, loss, rto: 250 } : { delay: 40, jitter: 10 } };
    transport.shape('state', shape.state); transport.shape('event', shape.event);
    await sleep(1500);
    await guest.evaluate(() => { const C = window.__chat; C.msgs = {}; C.bytes = {}; C.probe.length = 0; });
    await sleep(seconds * 1000);
    const C = await guest.evaluate(() => window.__chat);
    const total = (o) => Object.values(o).reduce((a, b) => a + b, 0), per = (o) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, r1(v / seconds)]));
    const event = (o) => Object.entries(o).filter(([k]) => k !== 's').reduce((a, [, v]) => a + v, 0);
    return {
      loss, seconds,
      perSecond: { messages: r1(total(C.msgs) / seconds), bytes: Math.round(total(C.bytes) / seconds), stateMessages: r1((C.msgs.s || 0) / seconds), stateBytes: Math.round((C.bytes.s || 0) / seconds), eventMessages: r1(event(C.msgs) / seconds), eventBytes: Math.round(event(C.bytes) / seconds) },
      messagesByType: per(C.msgs), bytesByType: per(C.bytes),
      eventDelayMs: { n: C.probe.length, mean: r1(mean(C.probe)), p50: r1(pct(C.probe, 0.5)), p95: r1(pct(C.probe, 0.95)), max: r1(Math.max(0, ...C.probe)) },
    };
  } finally { transport.stop(); await pair.host.close().catch(() => {}); await pair.guest.close().catch(() => {}); }
}


// Part 4: the host's time in sendSnapshot with 9 guests (simulated: 9 stand-ins for PeerJS "json" links, each doing what a link does
// with a message it is handed: UTF-8 bytes of JSON.stringify for an object, nothing for bytes already made), and how often a
// snapshot is serialized per tick. The snapshot of 10 actors with the effects of a fight is built outside the timing.
async function sendBench(f, { guests = 9, ticks = 400 } = {}) {
  const pair = await startPair(f, { keepBots: 99 });
  try {
    return await pair.host.evaluate(({ guests, ticks }) => {
      const enc = new TextEncoder(), saved = new Map(NET.conns); let sink = 0, calls = 0;
      const stringify = JSON.stringify; JSON.stringify = function (v) { v && v.t === 's' && calls++; return stringify.apply(this, arguments); };
      NET.conns.clear();
      for (let i = 0; i < guests; i++) NET.conns.set('fake' + i, { state: { open: true, serialization: 'json', send(o) { sink += enc.encode(JSON.stringify(o)).length; }, _bufferedSend(b) { sink += b.length; } }, event: { open: true, send() {} } });
      try {
        const bots = world.actors;
        const snaps = [];
        for (let i = 0; i < ticks + 50; i++) {
          for (let k = 0; k < 6; k++) pushFX(FX.SHOT, bots[k].pos.x, 1.6, bots[k].pos.z, 100 * k, bots[k].id);
          snaps.push(buildSnapshot());
        }
        for (let i = 0; i < 50; i++) sendSnapshot(snaps[i]);
        calls = 0; sink = 0;
        const t0 = performance.now();
        for (let i = 50; i < ticks + 50; i++) sendSnapshot(snaps[i]);
        const ms = performance.now() - t0;
        return { guests, ticks, actors: bots.length, bytesPerSnapshot: Math.round(stringify(snaps[60]).length), usPerTick: Math.round((ms * 1000) / ticks), serializationsPerTick: Math.round((100 * calls) / ticks) / 100, bytesHandedToLinks: sink };
      } finally { JSON.stringify = stringify; NET.conns.clear(); for (const [k, v] of saved) NET.conns.set(k, v); }
    }, { guests, ticks });
  } finally { pair.transport.stop(); await pair.host.close().catch(() => {}); await pair.guest.close().catch(() => {}); }
}

module.exports = { startPair, instrument, reset, report, measure, hold, chatter, sendBench, SCENARIOS, sleep };
if (require.main === module) {
  (async () => {
    const f = await fixture(), want = (process.env.LAG_SCENARIOS || 'smooth,hold,chatter,send').split(','), out = {};
    try {
      if (want.includes('smooth')) { const m = await measure(f, { seconds: Number(process.env.LAG_SECONDS) || 8 }); out.smooth = m.out; await m.pair.host.close(); await m.pair.guest.close(); }
      if (want.includes('hold')) {
        const pair = await startPair(f); await instrument(pair, { walk: false }); out.hold = {};
        try { for (const d of [50, 100, 200]) out.hold['oneWay' + d] = await hold(pair, d); } finally { pair.transport.stop(); await pair.host.close(); await pair.guest.close(); }
      }
      if (want.includes('chatter')) { out.chatter = {}; for (const loss of [0, 0.03]) out.chatter['loss' + loss] = await chatter(f, { loss }); }
      if (want.includes('send')) out.send = await sendBench(f);
      console.log(JSON.stringify(out, null, 1));
    } finally { await f.browser.close(); }
  })().catch((e) => { console.error(e); process.exitCode = 1; });
}
