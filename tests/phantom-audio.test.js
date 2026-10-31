const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), crypto = require("node:crypto");
const { schedule, render, recipe: checkRecipe } = require("../js/phantom-audio");
const base = "assets/champions-phantom/dfdf-1/audio/";
const recipe = JSON.parse(fs.readFileSync(base + "kill-sequences.json"));
test("actual kill hook plays the Phantom kill ladder on scout and excludes rifle and abilities", () => {
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
test("all five kill cues use DFDF's synthesized instruments, climb with the kill count and fit the 2.625 s window", () => {
  const manifest = JSON.parse(fs.readFileSync(base + "samples.json"));
  assert.deepEqual(Object.keys(recipe.profiles), ["kill_1", "kill_2", "kill_3", "kill_4", "kill_5"]);
  assert.equal(manifest.synthesized, true);
  assert.equal(Object.keys(manifest.samples).length, 9);
  for (const name of fs.readdirSync(base)) assert.match(name, /\.json$/, "no recorded audio is bundled");
  const lengths = Object.values(recipe.profiles).map(p => p.events.length);
  assert.ok(lengths[4] > 3 * lengths[0], "the fifth kill is the long fanfare");
  const top = Object.values(recipe.profiles).slice(0, 4).map(p => Math.max(...p.events.filter(e => e.sound === "flute").map(e => e.pitch)));
  assert.deepEqual(top, top.slice().sort((x, y) => x - y), "each kill cue reaches higher than the last");
  for (const p of Object.values(recipe.profiles)) for (const e of p.events) {
    assert.ok(manifest.samples[e.sound]); assert.ok(e.at >= 0 && e.at <= 2.625); assert.ok(e.volume > 0 && e.pitch >= 0.5 && e.pitch <= 2);
  }
});
test("instrument synthesis is deterministic, audible, finite and rejects unsafe recipes", () => {
  const manifest = JSON.parse(fs.readFileSync(base + "samples.json"));
  for (const [name, meta] of Object.entries(manifest.samples)) {
    const a = render(meta, 22050), b = render(meta, 22050);
    assert.equal(a.length, Math.ceil(meta.duration * 22050), name);
    assert.deepEqual(a, b, name + " renders the same samples every time");
    let peak = 0, energy = 0; for (const v of a) { assert.ok(Number.isFinite(v)); peak = Math.max(peak, Math.abs(v)); energy += v * v; }
    assert.ok(peak > 0.5 && peak <= 0.9001, name + " peak " + peak); assert.ok(Math.sqrt(energy / a.length) > 0.01, name + " is audible");
    assert.ok(Math.abs(a[a.length - 1]) < 0.05, name + " ends without a click");
  }
  assert.throws(() => checkRecipe({ type: "eval", duration: 1 }), /type/);
  assert.throws(() => checkRecipe({ type: "kick", duration: 60 }), /duration/);
  assert.throws(() => checkRecipe({ type: "fm", duration: 1, base: "1e9" }), /value/);
});

test("inspect and finisher songs keep their loop bounds and the finisher duration cutoff", () => {
  const music = JSON.parse(fs.readFileSync(base + "music-sequences.json")), manifest = JSON.parse(fs.readFileSync(base + "samples.json"));
  assert.equal(music.generator, recipe.generator);
  assert.deepEqual(Object.keys(music.profiles), ["inspect", "finisher_music"]);
  assert.ok(music.profiles.inspect.events.every(e => e.at < 10.2) && music.profiles.finisher_music.events.every(e => e.at < 19.2));
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
