const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), crypto = require("node:crypto");
const { schedule } = require("../js/phantom-audio");
const base = "assets/champions-phantom/2026-0.1.0/audio/";
const recipe = JSON.parse(fs.readFileSync(base + "kill-sequences.json"));
test("actual kill hook plays original Phantom ladders on scout and excludes rifle and abilities", () => {
  const vm = require("node:vm"), source = fs.readFileSync("js/phantom-audio.js", "utf8"), actor = {}, played = [];
  let generic = 0;
  const ctx = { SFX: { kill() { generic++; return "generic"; } }, world: { round: 1 }, counts: new WeakMap(),
    myActor: () => actor, play: count => played.push(count), phantom: id => ["champions_atk", "champions_def"].includes(id) };
  ctx.VALORANT_DATA = require("../js/valorant-data"); ctx.root = ctx; vm.createContext(ctx);
  vm.runInContext(source.slice(source.indexOf("  const kill = SFX.kill;"), source.indexOf("  const clear = clearStatus;")), ctx);
  for (let i = 1; i <= 5; i++) {
    ctx.KILL_EVENT = { gun: "scout", skin: i % 2 ? "champions_atk" : "champions_def", kind: i % 2 ? "gun" : "head" };
    assert.equal(ctx.SFX.kill(), false);
  }
  assert.deepEqual(played, [1, 2, 3, 4, 5]); assert.equal(generic, 0);
  for (const event of [{ gun: "rifle", skin: "champions_atk", kind: "gun" }, { gun: "scout", skin: "champions_atk", kind: "ability" }, { gun: "scout", skin: "default", kind: "gun" }]) {
    ctx.KILL_EVENT = event; assert.equal(ctx.SFX.kill(), "generic");
  }
  assert.equal(generic, 3); assert.equal(played.length, 5);
  ctx.world.round++; ctx.KILL_EVENT = { gun: "scout", skin: "champions_def", kind: "gun" }; ctx.SFX.kill();
  assert.equal(played.at(-1), 1);
});
test("all five original kill arrangements reference byte-verified note-block recordings", () => {
  const manifest = JSON.parse(fs.readFileSync(base + "samples.json"));
  assert.deepEqual(Object.values(recipe.profiles).map(p => p.events.length), [10, 10, 12, 12, 63]);
  assert.equal(Object.keys(manifest.samples).length, 9);
  for (const meta of Object.values(manifest.samples)) {
    const raw = fs.readFileSync(base + meta.file);
    assert.equal(raw.subarray(0, 4).toString(), "OggS");
    assert.equal(raw.length, meta.bytes);
    for (const alg of ["sha1", "sha256"]) assert.equal(crypto.createHash(alg).update(raw).digest("hex"), meta[alg]);
  }
  for (const p of Object.values(recipe.profiles)) for (const e of p.events) {
    assert.ok(manifest.samples[e.sound]); assert.ok(e.at >= 0 && e.at <= 2.625); assert.ok(e.volume > 0 && Number.isFinite(e.pitch));
  }
});

test("original inspect and finisher songs preserve the source tables, loop bounds and duration cutoff", () => {
  const music = JSON.parse(fs.readFileSync(base + "music-sequences.json")), manifest = JSON.parse(fs.readFileSync(base + "samples.json"));
  assert.equal(music.sourceClassSha256, recipe.sourceClassSha256);
  assert.equal(music.sourceJarSha256, recipe.sourceJarSha256);
  assert.deepEqual(Object.values(music.profiles).map(p => p.events.length), [104, 305]);
  assert.ok(Math.abs(music.profiles.inspect.loopStart - .6) < .00001);
  assert.ok(Math.abs(music.profiles.inspect.loopEnd - 10.2) < .00001);
  for (const p of Object.values(music.profiles)) for (const e of p.events) assert.ok(manifest.samples[e.sound]);
  const scheduled = [], voices = new Set(), profile = music.profiles.finisher_music;
  const context = { createBufferSource: () => ({ playbackRate: {}, connect() {}, start(t) { this.at = t; }, stop(t) { scheduled.push([this.at, t]); } }), createGain: () => ({ gain: {}, connect() {} }) };
  schedule(context, {}, profile, new Map(Object.keys(manifest.samples).map(k => [k, {}])), 3.03, voices, 8);
  assert.equal(scheduled.length, profile.events.filter(e => e.at < 4.97).length);
  assert.ok(scheduled.every(([at, end]) => at < 8 && end === 8));
});
test("scheduler preserves simultaneous chords, source pitch/volume and exact timing, and releases voices", () => {
  for (const profile of Object.values(recipe.profiles)) {
    const sources = [], gains = [], voices = new Set();
    const buffers = new Map(profile.events.map(e => [e.sound, { sound: e.sound }]));
    const output = {};
    const context = {
      createBufferSource() { const s = { playbackRate: {}, connect(g) { this.gain = g; }, start(t) { this.at = t; }, disconnect() { this.disconnected = true; } }; sources.push(s); return s; },
      createGain() { const g = { gain: {}, connect(o) { assert.equal(o, output); }, disconnect() { this.disconnected = true; } }; gains.push(g); return g; },
    };
    schedule(context, output, profile, buffers, 12.04, voices);
    assert.equal(voices.size, profile.events.length);
    profile.events.forEach((note, i) => {
      assert.equal(sources[i].buffer.sound, note.sound); assert.equal(sources[i].at, 12.04 + note.at);
      assert.equal(sources[i].playbackRate.value, Math.max(0.5, Math.min(2, note.pitch))); assert.equal(gains[i].gain.value, note.volume);
      sources[i].onended(); assert.ok(sources[i].disconnected && gains[i].disconnected);
    });
    assert.equal(voices.size, 0);
  }
});
