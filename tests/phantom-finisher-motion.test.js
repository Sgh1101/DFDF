const test = require("node:test"), assert = require("node:assert/strict"), M = require("../js/phantom-finisher-motion");
const event = { x: 1.25, z: -4.5, finisherTick: 123456 };
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`);
test("original Java unsigned 64-bit random sequence survives overflow and negative seeds", () => {
  for (const [seed, value] of [[0n, 0.8451708262410406], [1n, 0.7310331401380312], [-1n, 0.4694044434094865], [123456789012345n, 0.43082357077759204]]) close(M.random(seed), value);
  assert.equal(M.seed(event), BigInt(Math.trunc(event.x * 7919)) ^ BigInt(Math.trunc(event.z * 104729)) << 16n ^ 123456n);
});
test("source coils contract and rotate at their original staggered times, then disappear", () => {
  assert.equal(M.coil(0.41, 0.41, 0, 6.5, 0.8), null);
  const a = M.coil(0.6, 0.41, 0, 6.5, 0.8), b = M.coil(0.7, 0.41, 0, 6.5, 0.8);
  assert.equal(a.points.length, 29); assert.notDeepEqual(a.points, b.points);
  close(Math.hypot(...a.points.at(-1)), 6.5 * Math.exp(-Math.log(6.5 / 0.35) / 6 * (0.6 - 0.41) * 7));
  assert.equal(M.frame(0.4, true, event).ribbons.length, 0);
  assert.equal(M.frame(0.7, true, event).ribbons.length, 9);
  assert.equal(M.frame(1.251, true, event).ribbons.length, 0);
});
test("source swirl rotates; flash follows the 3s start / 0.6s cycle / 0.1s pulse", () => {
  const find = t => M.frame(t, true, event).sprites.find(s => s.id === "swirl");
  close(find(2).angle - find(1.5).angle, Math.PI / 12);
  assert.equal(find(2.4), undefined);
  close(M.pulse(2.99), 0); close(M.pulse(3), 1); close(M.pulse(3.05), 0.5); close(M.pulse(3.2), 0); close(M.pulse(3.6), 1);
  assert.equal(M.frame(3.2, true, event).beams.filter(b => b.id.startsWith("arc-")).length, 24);
  assert.deepEqual(M.frame(3, true, event).sprites.find(s => s.id === "eye-0").color, [1, 0.45, 0.12]);
  assert.deepEqual(M.frame(3, false, event).sprites.find(s => s.id === "eye-0").color, [0.85, 0.95, 1]);
});
test("same kill yields the same moving particles for peers; geometry changes with time and stops at eight seconds", () => {
  const a = M.frame(4, true, event), b = M.frame(4.2, true, event);
  assert.deepEqual(a, M.frame(4, true, { ...event }));
  assert.equal(a.sprites.filter(s => s.id.startsWith("ember-")).length, 40);
  assert.equal(a.beams.filter(s => s.id.startsWith("falling-")).length, 14);
  assert.notDeepEqual(a.sprites.find(s => s.id === "ember-0").center, b.sprites.find(s => s.id === "ember-0").center);
  assert.notDeepEqual(a.beams.find(s => s.id === "falling-0").a, b.beams.find(s => s.id === "falling-0").a);
  assert.equal(M.frame(7.5, true, event).sprites.find(s => s.id === "pulse-star").alpha <= 0.5, true);
  const end = M.frame(8, true, event); assert.deepEqual([end.sprites, end.ribbons, end.beams], [[], [], []]);
  for (let t = 0; t <= 8; t += 0.01) assert.doesNotMatch(JSON.stringify(M.frame(t, false, event)), /null|NaN|Infinity/);
});
