const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), crypto = require('node:crypto'), path = require('node:path');
const base = 'assets/rgx-firefly/v1';
test('only the explicitly retained RGX butterfly is imported, with verified original bytes', () => {
  assert.ok(fs.existsSync(base + '/manifest.json'), 'the retained RGX Firefly must have a separate, selective package');
  const manifest = JSON.parse(fs.readFileSync(base + '/manifest.json'));
  assert.equal(manifest.sourceItem, 'future_butterfly');
  for (const file of manifest.files) {
    assert.ok(!file.name.includes('..'));
    const bytes = fs.readFileSync(path.join(base, file.name));
    assert.equal(bytes.length, file.size);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), file.sha256);
    assert.ok(/^(model\.json|animation\.json|texture\.png|sounds\/future_butterfly_[a-z_0-9]+\.ogg)$/.test(file.name), file.name);
  }
  assert.ok(manifest.files.some(f => f.name === 'model.json'));
  assert.ok(manifest.files.some(f => f.name === 'texture.png'));
  assert.ok(manifest.files.some(f => f.name === 'animation.json'));
});
test('RGX animation data keeps source zero scales and numeric interpolation without evaluating source expressions', () => {
  assert.ok(fs.existsSync('js/rgx-firefly-data.js'), 'the RGX-only data reader is required');
  const D = require('../js/rgx-firefly-data');
  assert.deepEqual(D.sample(0, 1, [1, 1, 1]), [0, 0, 0]);
  assert.deepEqual(D.sample({'0':[0,2,4],'1':[10,12,14]}, .5, [0,0,0]), [5,7,9]);
  assert.deepEqual(D.sample(['bad()',0,0], 0, [1,1,1]), [1,1,1]);
  const source = {description:{texture_width:512},bones:[{name:'blade',pivot:[1,2,3],rotation:[10,20,30],cubes:[{origin:[1,2,3],size:[4,5,6],rotation:[3,4,5],uv:[0,0]}]}]};
  const rendered = D.renderGeometry(source);
  assert.deepEqual(rendered.bones[0].rotation, [-10,20,-30]);
  assert.deepEqual(rendered.bones[0].cubes[0].rotation, [-3,4,-5]);
  assert.deepEqual(source.bones[0].rotation, [10,20,30]);
  assert.deepEqual(D.parse('{/*note*/"path":"a//b", "x":[1,2,],}'), {path:'a//b',x:[1,2]});
});
