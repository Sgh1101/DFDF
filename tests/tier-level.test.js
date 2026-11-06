const test = require('node:test'), assert = require('node:assert/strict');
const T = require('../js/tier-level');
test('a level shows as a tier: three levels a division, three divisions a tier, 왕좌 from level 73', () => {
  assert.equal(T.text(1), '구리 1'); assert.equal(T.text(3), '구리 1'); assert.equal(T.text(4), '구리 2');
  assert.equal(T.text(10), '청동 1'); assert.equal(T.text(28), '금빛 1'); assert.equal(T.text(72), '금강 3');
  assert.equal(T.text(73), '왕좌'); assert.equal(T.text(500), '왕좌'); assert.equal(T.text(73, 'en'), 'Throne');
  assert.equal(T.text(0), '구리 1', 'a missing level counts as 1'); assert.equal(T.text('x'), '구리 1');
  assert.deepEqual(T.of(28), { t: 3, div: 1, step: 9 });
});
test('the next division and the way into it', () => {
  assert.equal(T.nextAt(1), 4); assert.equal(T.nextAt(4), 7); assert.equal(T.nextAt(72), 73); assert.equal(T.nextAt(73), null);
  assert.equal(T.progress(1, 0, 100), 0); assert.equal(T.progress(2, 50, 100), 0.5); assert.equal(T.progress(3, 100, 100), 1);
  assert.equal(T.progress(80, 0, 100), 1);
});
