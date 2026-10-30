// Measurement harness for the host-authoritative snapshot stream (host page + guest page over the shaped test transport).
// It keeps the browser's real requestAnimationFrame (scripts/browser-fixture.js realRaf) and measures on the guest:
//   arrivals   gap between snapshots reaching clientRecv, how many carry a tick counter k lower than one already seen
//   applied    the same for the snapshots the game actually applied (NET.onSnapshot)
//   corrections  how far reconcileLocal moved the local player per snapshot
//   still      share of game frames where a remote bot walking at constant speed was drawn where it already was
// and on the host: gaps between the snapshots it sent. Run `node scripts/net-lag-harness.js` through /tmp/agent-browser.sh-style env.
const { fixture } = require('./browser-fixture'), { installTransport } = require('./network-test-transport');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function startPair(f, { keepBots = 1, viewport = { width: 320, height: 180 } } = {}) {
  const host = await f.page('lag_host', viewport, {}, { realRaf: true }), guest = await f.page('lag_guest', viewport, {}, { realRaf: true });
  const transport = await installTransport([host, guest]);
  for (const page of [host, guest]) await page.evaluate(() => { render = () => {}; titleCam = () => {}; });
  const code = await host.evaluate(async () => { await createRoom(); return NET.room; });
  await guest.evaluate((code) => joinRoom(code), code);
  await host.waitForFunction(() => room.members.size === 2 && NET.conns.size === 1);
  await host.evaluate(() => { room.mode = 'std'; room.map = 'pogu'; hostStartMatch(); ADMIN.freezeAI = true; world.phase = 'live'; });
  await guest.waitForFunction(() => world.actors.length > 0 && myActor() && world.phase !== 'menu');
  // fewer bodies keep the two pages at a frame rate the machine can hold; one bot stays as the constant-speed walker
  const bot = await host.evaluate((keep) => {
    const ais = world.actors.filter((a) => a.ctrl === 'ai');
    for (const a of ais.slice(keep)) { a.group && scene.remove(a.group); world.actors.splice(world.actors.indexOf(a), 1); }
    return ais[0] ? ais[0].id : null;
  }, keepBots);
  return { host, guest, transport, bot };
}
async function instrument({ host, guest, bot }, { speed = 4, span = 6 } = {}) {
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
  await guest.evaluate((bot) => {
    // the local player walks about so that reconcileLocal has a prediction to correct
    const pat = [['w'], ['w', 'd'], ['w'], ['w', 'a'], ['s'], ['s', 'd'], ['s'], ['s', 'a']]; let pi = 0;
    setInterval(() => { for (const k of ['w', 'a', 's', 'd']) keys[k] = false; for (const k of pat[pi++ % pat.length]) keys[k] = true; }, 600);
    const L = window.__lag = { arrive: [], applied: [], corr: [], steps: 0, frames: 0, still: 0, last: null, steps: 0 };
    const gs = step; step = function () { L.steps++; return gs.apply(this, arguments); };
    const rc = clientRecv; clientRecv = function (e) { if (e && e.t === 's') L.arrive.push([e.k, performance.now()]); return rc.apply(this, arguments); };
    const os = NET.onSnapshot; NET.onSnapshot = function (s) { L.applied.push([s.k, performance.now()]); return os.apply(this, arguments); };
    const rl = reconcileLocal; reconcileLocal = function (e) { const x = e.pos.x, z = e.pos.z; const r = rl.apply(this, arguments); L.corr.push(Math.hypot(e.pos.x - x, e.pos.z - z)); return r; };
    const sy = syncActorModel; syncActorModel = function (o) {
      const r = sy.apply(this, arguments);
      if (o.id === bot && world.phase !== 'menu') { const p = { x: o.pos.x, z: o.pos.z }; if (L.last) { L.frames++; if (Math.hypot(p.x - L.last.x, p.z - L.last.z) < 1e-4) L.still++; } L.last = p; }
      return r;
    };
  }, bot);
}
const gaps = (ts) => ts.slice(1).map((t, i) => t - ts[i]);
const pct = (a, p) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
const back = (list) => { let top = -Infinity, n = 0; for (const [k] of list) { if (k <= top) n++; else top = k; } return n; };
const r1 = (x) => Math.round(x * 10) / 10;
async function reset(pair) {
  await pair.host.evaluate(() => { __hostLag.sends.length = 0; __hostLag.steps = 0; });
  await pair.guest.evaluate(() => { const L = __lag; L.arrive.length = L.applied.length = L.corr.length = 0; L.frames = L.still = L.steps = 0; L.last = null; });
}
async function report(pair, seconds) {
  const hostSteps = await pair.host.evaluate(() => __hostLag.steps), h = await pair.host.evaluate(() => __hostLag.sends.slice()), L = await pair.guest.evaluate(() => ({ ...__lag }));
  const sendGap = gaps(h), arrGap = gaps(L.arrive.map((x) => x[1])), appGap = gaps(L.applied.map((x) => x[1]));
  const stat = (g) => ({ n: g.length + 1, hz: r1(((g.length + 1) / seconds)), mean: r1(mean(g)), sd: r1(sd(g)), p50: r1(pct(g, 0.5)), p95: r1(pct(g, 0.95)), max: r1(Math.max(0, ...g)) });
  const corr = L.corr.filter((c) => c > 0);
  return {
    fps: { host: r1(hostSteps / seconds), guest: r1(L.steps / seconds) },
    hostSend: stat(sendGap), arrive: { ...stat(arrGap), kBackwards: back(L.arrive) }, applied: { ...stat(appGap), kBackwards: back(L.applied) },
    corrections: { n: L.corr.length, moved: corr.length, mean: r1(1000 * mean(corr)) / 1000, p95: Math.round(1000 * pct(corr, 0.95)) / 1000, max: Math.round(1000 * Math.max(0, ...corr)) / 1000 },
    still: { frames: L.frames, still: L.still, share: L.frames ? Math.round((1000 * L.still) / L.frames) / 10 : 0 },
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
module.exports = { startPair, instrument, reset, report, measure, SCENARIOS, sleep };
if (require.main === module) {
  (async () => {
    const f = await fixture();
    try { const { out } = await measure(f, { seconds: Number(process.env.LAG_SECONDS) || 8 }); console.log(JSON.stringify(out, null, 1)); }
    finally { await f.browser.close(); }
  })().catch((e) => { console.error(e); process.exitCode = 1; });
}
