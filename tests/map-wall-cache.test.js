const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const engine = fs.readFileSync('js/legacy/03-engine.js', 'utf8');
const terrain = engine.slice(engine.indexOf('const MAP_WALLS ='), engine.indexOf('function drawTac()'));
const corner = engine.slice(engine.indexOf('const MINIW ='), engine.indexOf('function drawMini()'));
function canvas() {
  const g = { rects: [], images: [], fillRect(...r) { this.rects.push(r); }, drawImage(...a) { this.images.push(a); } };
  return { width: 200, height: 160, getContext: () => g, g };
}
function setup() {
  const mini = canvas(), tac = canvas(), images = [];
  const context = { mini, mctx: mini.g, tctx: tac.g, STEP_H: .68, CUR_MAP_KEY: 'first',
    MAP: { bounds: { minX: -100, minZ: -80, maxX: 100, maxZ: 80 } },
    COLLIDERS: [{ minX: -40, minZ: -30, maxX: -20, maxZ: 10, h: 4 }, { minX: 20, minZ: -10, maxX: 40, maxZ: 30, h: .5 }],
    document: { createElement() { const c = canvas(); images.push(c); return c; } } };
  vm.createContext(context); vm.runInContext(terrain + corner, context);
  const draw = () => { context.drawMiniWalls(); context.drawTacWalls(x => x, z => z); };
  return { context, mini, tac, images, draw, revision: () => vm.runInContext('MAP_WALLS.revision', context) };
}
test('unchanged terrain is painted once per map canvas while both views keep blitting', () => {
  const f = setup(); f.draw();
  assert.equal(f.images.length, 2); assert.ok(f.images.every(c => c.g.rects.length === 2));
  for (let i = 0; i < 30; i++) f.draw();
  assert.ok(f.images.every(c => c.g.rects.length === 2));
  assert.equal(f.mini.g.images.length, 31); assert.equal(f.tac.g.images.length, 31);
  assert.deepEqual(f.images[0].g.rects, [[60, 50, 20, 40], [120, 70, 20, 40]]);
});
test('same-count geometry edits, height changes and removals invalidate both caches', () => {
  const f = setup(); f.draw(); let rev = f.revision();
  for (const mutate of [
    c => { c[0].maxX += 3; }, // Width was absent from the old tactical checksum.
    c => { c[0].minX += 10; c[1].minX -= 10; }, // Cancelling edits must still invalidate.
    c => { c[0].h = 0; }, // Opening doors / sinking arena walls changes tactical colour.
    c => { c.splice(0, 1, { ...c[0], minZ: -50 }); },
    c => { c.push({ ...c[0], maxZ: 50 }); },
    c => { c.length = 0; },
  ]) {
    mutate(f.context.COLLIDERS); const old = f.images.map(c => c.g.rects.length); f.draw();
    assert.equal(f.revision(), ++rev);
    f.images.forEach((c, i) => assert.equal(c.g.rects.length - old[i], f.context.COLLIDERS.length));
    f.draw(); assert.equal(f.revision(), rev);
  }
});
test('map bounds, map changes and minimap resizing cannot reuse a stale terrain image', () => {
  const f = setup(); f.draw(); let rev = f.revision();
  f.context.CUR_MAP_KEY = 'second'; f.draw(); assert.equal(f.revision(), ++rev);
  f.context.MAP.bounds.maxX = 200; f.draw(); assert.equal(f.revision(), ++rev);
  const old = f.images.map(c => c.g.rects.length);
  f.mini.width = 300; f.mini.height = 240; f.draw();
  assert.equal(f.revision(), rev); assert.equal(f.images[0].g.rects.length, old[0] + 2);
  assert.equal(f.images[1].g.rects.length, old[1]);
  assert.equal(f.images[0].width, 300); assert.equal(f.images[0].height, 240);
});
