const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), crypto = require("node:crypto");
const { vector, sample, config } = require("../js/neon-data");
test("Neon numeric tracks unwrap original nested vectors and never evaluate expressions", () => {
  assert.deepEqual(vector({ post: { vector: [1, 2, 3] } }, [0, 0, 0]), [1, 2, 3]);
  assert.deepEqual(sample({ 0: { post: { vector: [0, 2, 4] } }, 1: { post: { vector: [2, 4, 6] } } }, 0.5), [1, 3, 5]);
  assert.deepEqual(sample({ 0: [0, 0, 0], 1: ["query.time", 2, 3] }, 1), [0, 0, 0]);
  assert.equal(config.sprintMultiplier, 1.4); assert.equal(config.slideDistance, 6); assert.equal(config.slideDuration, 0.8333);
});
test("original Neon arms, icons, particles and slide survive byte for byte, with no executable mod classes", () => {
  const base = "assets/neon/1.0.0/", manifest = JSON.parse(fs.readFileSync(base + "manifest.json"));
  assert.equal(manifest.files.length, 28); assert.equal(manifest.sound, false);
  for (const meta of manifest.files) {
    assert.match(meta.file, /\.(png|json)$/); assert.ok(!meta.file.includes(".."));
    const raw = fs.readFileSync(base + meta.file); assert.equal(raw.length, meta.bytes);
    assert.equal(crypto.createHash("sha256").update(raw).digest("hex"), meta.sha256);
  }
  const slide = JSON.parse(fs.readFileSync(base + "player_animations/slide.json")).animations.Slide;
  assert.deepEqual(sample(slide.bones.body.position, 0.25), [0, -7, 0]);
  assert.deepEqual(sample(slide.bones.rightLeg.rotation, 0.25), [85.0641, 7.4355, 0.9845]);
  assert.deepEqual(sample(slide.bones.body.position, 0.8333), [0, 0, 0]);
});
