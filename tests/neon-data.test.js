const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), crypto = require("node:crypto");
const { vector, sample, config } = require("../js/neon-data");
const D = require('../js/neon-data');
test("Neon numeric tracks unwrap original nested vectors and never evaluate expressions", () => {
  assert.deepEqual(vector({ post: { vector: [1, 2, 3] } }, [0, 0, 0]), [1, 2, 3]);
  assert.deepEqual(sample({ 0: { post: { vector: [0, 2, 4] } }, 1: { post: { vector: [2, 4, 6] } } }, 0.5), [1, 3, 5]);
  assert.deepEqual(sample({ 0: [0, 0, 0], 1: ["query.time", 2, 3] }, 1), [0, 0, 0]);
  assert.equal(config.sprintMultiplier, 1.4); assert.equal(config.slideDistance, 6); assert.equal(config.slideDuration, 0.8333);
});
test('Neon matches GeckoLib reflected coordinates, box UVs and the source item transform without rewriting assets', () => {
  const geo=JSON.parse(fs.readFileSync('assets/neon/1.0.0/geo/item/neon_arm.geo.json'))['minecraft:geometry'][0],before=JSON.stringify(geo),render=D.renderGeometry(geo);
  assert.equal(JSON.stringify(geo),before);assert.deepEqual(render.bones[1].pivot,[-6,12,1]);assert.deepEqual(render.bones[2].pivot,[6,12,1]);
  const arm=render.bones[2].cubes[0];assert.deepEqual(arm.origin,[5,0,-1]);assert.deepEqual(arm.size,[3,12,4]);
  assert.deepEqual(arm.uv.east,{uv:[44,20],uv_size:[-4,12]});assert.deepEqual(arm.uv.up,{uv:[47,16],uv_size:[-3,4]});
  assert.deepEqual(D.position([2,-3,4]),[-2,-3,4]);assert.deepEqual(D.rotation([-90,30,-10]),[90,-30,-10]);
  assert.equal(D.view.scale,.46/16);D.view.position.forEach((n,i)=>assert.ok(Math.abs(n-[-.02,-.5754,-.35][i])<1e-12));
});
test('Neon source easing and normal-to-charged transitions keep their authored timings', () => {
  const track={0:{post:{vector:[0,0,0]}},1:{post:{vector:[10,0,0]},easing:'easeInCirc'}};
  assert.ok(Math.abs(sample(track,.5)[0]-10*(1-Math.sqrt(.75)))<1e-12);
  assert.equal(D.chargedAlpha('Neon_ULT',.2),0);assert.equal(D.chargedAlpha('Neon_ULT',.45),1);
  assert.ok(Math.abs(D.chargedAlpha('Neon_ULT',(.25+.4333)/2)-.5)<1e-12);
  assert.equal(D.chargedAlpha('Neon_Q',.49),1);assert.equal(D.chargedAlpha('Neon_Q',.6),0);assert.equal(D.chargedAlpha('Neon_C',.3),1);
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
