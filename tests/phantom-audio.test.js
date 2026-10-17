const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), crypto = require("node:crypto");
const { schedule } = require("../js/phantom-audio");
const base = "assets/champions-phantom/2026-0.1.0/audio/";
const recipe = JSON.parse(fs.readFileSync(base + "kill-sequences.json"));
test("all five original kill arrangements reference byte-verified note-block recordings", () => {
  const manifest = JSON.parse(fs.readFileSync(base + "samples.json"));
  assert.deepEqual(Object.values(recipe.profiles).map(p => p.events.length), [10, 10, 12, 12, 63]);
  assert.equal(Object.keys(manifest.samples).length, 7);
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
