const test = require("node:test"), assert = require("node:assert/strict");
const G = require("../js/gunshot-synth.js");
// The gunshot model (js/gunshot-synth.js) is plain arithmetic, so it can be measured here: every gun renders to a finite,
// unclipped, sensibly long sound, the guns differ from one another in measurable ways, and the differences go the way the
// real weapons go (a suppressed gun has no crack and little treble; a big round has more bass and a longer decay).
const SR = 44100;
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = i + k + len / 2, tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}
function features(x) {
  const N = 1 << 15, re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < Math.min(N, x.length); i++) re[i] = x[i];
  fft(re, im);
  let tot = 0, low = 0, high = 0, cen = 0;
  for (let k = 1; k < N / 2; k++) {
    const f = (k * SR) / N, p = re[k] * re[k] + im[k] * im[k];
    tot += p; cen += f * p; f < 220 && (low += p); f > 3000 && (high += p);
  }
  let pk = 0, e = 0, last = 0;
  for (let i = 0; i < x.length; i++) { pk = Math.max(pk, Math.abs(x[i])); e += x[i] * x[i]; }
  // when the sound has fallen under 5 % of its peak for good (RMS of 5 ms windows)
  const w = Math.floor(SR * 0.005);
  for (let i = 0; i + w < x.length; i += w) { let s = 0; for (let j = 0; j < w; j++) s += x[i + j] * x[i + j]; if (Math.sqrt(s / w) > 0.05 * pk) last = i + w; }
  return { dur: x.length / SR, decay: last / SR, centroid: cen / tot, low: low / tot, high: high / tot, rms: Math.sqrt(e / x.length), peak: pk };
}
const keys = Object.keys(G.SPEC), F = {};
for (const k of keys) F[k] = features(G.render(G.SPEC[k], SR, 11));
test("every gun renders: finite, unclipped, loud enough, not endless", () => {
  assert.ok(keys.length >= 30, "all the game's guns have a model: " + keys.length);
  for (const k of keys) {
    const x = G.render(G.SPEC[k], SR, 11);
    assert.ok(x.every(Number.isFinite), k + " has no NaN");
    assert.ok(F[k].peak <= 0.96 && F[k].peak > 0.9, k + " peak " + F[k].peak.toFixed(2));
    assert.ok(F[k].dur >= 0.1 && F[k].dur <= 1.9, k + " length " + F[k].dur.toFixed(2));
    assert.ok(F[k].rms > 0.02, k + " is not silent");
    assert.ok(x[x.length - 1] === 0 || Math.abs(x[x.length - 1]) < 0.01, k + " ends without a click");
  }
});
test("two takes of one gun differ, and are the same kind of sound", () => {
  for (const k of keys) {
    const a = G.render(G.SPEC[k], SR, 11), b = G.render(G.SPEC[k], SR, 97);
    let d = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) d += Math.abs(a[i] - b[i]);
    assert.ok(d / a.length > 0.005, k + " takes differ");
    const fa = features(a), fb = features(b);
    assert.ok(Math.abs(fa.centroid - fb.centroid) / fa.centroid < 0.25, k + " takes share a colour: " + Math.round(fa.centroid) + " vs " + Math.round(fb.centroid));
  }
});
test("the same take twice is the same sound (the render is deterministic)", () => {
  const a = G.render(G.SPEC.rifle, SR, 5), b = G.render(G.SPEC.rifle, SR, 5);
  assert.deepEqual(Array.from(a.slice(0, 2000)), Array.from(b.slice(0, 2000)));
});
test("every pair of guns differs in length, colour or weight (no two guns share a sound)", () => {
  const close = [];
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
    const a = F[keys[i]], b = F[keys[j]];
    const d = Math.abs(Math.log(a.decay / b.decay)) / 0.12 + Math.abs(Math.log(a.centroid / b.centroid)) / 0.1 + Math.abs(a.low - b.low) / 0.05 + Math.abs(Math.log(a.rms / b.rms)) / 0.15;
    d < 1 && close.push([keys[i], keys[j], +d.toFixed(2)]);
  }
  assert.deepEqual(close, [], "too close: " + JSON.stringify(close));
});
test("the differences go the way the real weapons go", () => {
  // a suppressed gun is dull and has no crack
  for (const k of ["silenced", "whisper"]) {
    assert.ok(F[k].high < F.pistol.high * 0.5, k + " has less treble than a pistol");
    // (every buffer is normalised to its peak; the playback level is the gun's own)
    assert.ok(F[k].rms * G.SPEC[k].lvl < F.pistol.rms * G.SPEC.pistol.lvl, k + " is quieter than a pistol");
  }
  // bigger rounds: more of the sound is bass
  assert.ok(F.sniper.low > F.rifle.low && F.rifle.low > F.pistol.low, "bass: sniper > rifle > pistol");
  assert.ok(F.antimat.low > F.sniper.low * 0.9, "the anti-materiel rifle is at least as heavy as the sniper");
  // bigger rounds ring longer
  assert.ok(F.sniper.decay > F.rifle.decay && F.rifle.decay > F.pistol.decay, "decay: sniper > rifle > pistol");
  assert.ok(F.shotgun.decay > F.smg.decay, "a shotgun rings longer than an SMG");
  // a short barrel is sharper than a long one
  assert.ok(F.carbine.centroid > F.battle.centroid, "carbine brighter than the battle rifle");
  assert.ok(F.pdw.centroid > F.vector.centroid, "5.7 mm brighter than .45");
  // the bolt and pump come later than the shot: the sound is longer than the same gun without them
  assert.ok(F.sniper.dur > 0.8 && F.shotgun.dur > F.autoshot.dur, "bolt and pump are in the sound");
});
test("the old shot kinds map to guns that exist", () => {
  for (const [kind, gun] of Object.entries(G.KIND)) assert.ok(G.has(gun), kind + " -> " + gun);
});
test("the room impulse is finite, decays, and the indoor room is longer", () => {
  const open = G.reverbIR(SR, G.ROOMS.open.rt, G.ROOMS.open.dark, 7), indoor = G.reverbIR(SR, G.ROOMS.indoor.rt, G.ROOMS.indoor.dark, 7);
  assert.ok(open.every(Number.isFinite) && indoor.every(Number.isFinite));
  assert.ok(indoor.length > open.length * 2, "the hospital is a bigger room");
  const e = (x, a, b) => { let s = 0; for (let i = Math.floor(a * SR); i < Math.min(x.length, Math.floor(b * SR)); i++) s += x[i] * x[i]; return s; };
  assert.ok(e(indoor, 0.5, 0.6) < e(indoor, 0.05, 0.15) * 0.2, "it dies away");
});

// A fake audio context that counts what the engine builds: createBuffer is where a take or an impulse response is rendered.
function fakeContext() {
  const node = () => ({ connect() {}, disconnect() {}, gain: { value: 0 }, frequency: { value: 0 }, threshold: {}, knee: {}, ratio: {}, attack: {}, release: {}, playbackRate: { value: 1 }, start() { this.started = true; } });
  const c = { sampleRate: 48000, currentTime: 0, buffers: 0, started: 0, destination: node() };
  for (const n of ["createGain", "createDynamicsCompressor", "createConvolver", "createBiquadFilter"]) c[n] = node;
  c.createBufferSource = () => { const s = node(); s.start = () => c.started++; return s; };
  c.createBuffer = (ch, len) => { c.buffers++; const a = new Float32Array(len); return { length: len, getChannelData: () => a, copyToChannel: (x) => a.set(x) }; };
  return c;
}
test("a warmed gun plays its first shot from the cache: nothing is rendered when it is fired", () => {
  const timers = [], realSet = global.setTimeout;
  global.setTimeout = (fn) => timers.push(fn);
  try {
    const c = fakeContext(), e = G.engine(c, c.destination);
    assert.equal(e.warmed("rifle"), false);
    assert.equal(e.warm("rifle"), true, "the first take, then one more");
    assert.equal(e.warmed("rifle"), false);
    assert.equal(e.warm("rifle"), false);
    assert.equal(e.warmed("rifle"), true);
    e.setRoom("open");
    const rendered = c.buffers;
    assert.equal(rendered, 3, "two takes and the room");
    assert.equal(e.play("rifle", 0), true);
    assert.equal(c.buffers, rendered, "the first shot renders nothing");
    assert.equal(c.started, 1);
    for (const fn of timers.splice(0)) fn();
    assert.equal(c.buffers, rendered, "no second take is rendered 30 ms later");
    // the same gun fired cold renders its take now and the second one later: that is the hitch the warm-up removes
    const cold = fakeContext(), ce = G.engine(cold, cold.destination);
    ce.setRoom("open");
    const before = cold.buffers;
    ce.play("rifle", 0);
    assert.equal(cold.buffers, before + 1);
    for (const fn of timers.splice(0)) fn();
    assert.equal(cold.buffers, before + 2);
  } finally { global.setTimeout = realSet; }
});
test("warming renders the same takes as the first shot would", () => {
  const timers = [], realSet = global.setTimeout;
  global.setTimeout = (fn) => timers.push(fn);
  try {
    const grab = (warm) => {
      const c = fakeContext(), made = [];
      const create = c.createBuffer;
      c.createBuffer = (ch, len) => { const b = create(ch, len); made.push(b.getChannelData(0)); return b; };
      const e = G.engine(c, c.destination);
      if (warm) { while (e.warm("pistol")); } else { e.take("pistol"); for (const fn of timers.splice(0)) fn(); }
      return made;
    };
    const a = grab(true), b = grab(false);
    assert.equal(a.length, 2);assert.equal(b.length, 2);
    for (let i = 0; i < 2; i++) assert.ok(a[i].length === b[i].length && a[i].every((v, j) => v === b[i][j]), "take " + i + " is the same sound");
  } finally { global.setTimeout = realSet; }
});
