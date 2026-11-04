const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const reference = require('../docs/superpowers/records/2026-11-04-champions-reference-hashes.json');
const bundle = path.resolve(__dirname, '../assets/champions-phantom/dfdf-1');

test('the default Champions gun uses our own artwork instead of copying the reference JAR bytes', () => {
  for (const file of reference.files) {
    const bytes = fs.readFileSync(path.join(bundle, file.name));
    assert.notEqual(crypto.createHash('sha256').update(bytes).digest('hex'), file.sha256,
      file.name + ': the reference is visual guidance, not the shipped artwork');
  }
});

test('the shipped Champions gun retains the approved native design and mobile geometry budget', () => {
  const geo = JSON.parse(fs.readFileSync(path.join(bundle, 'geo/phantom_champions_2026.geo.json')))['minecraft:geometry'][0];
  assert.equal(geo.description.identifier, 'geometry.dfdf_champions_phantom');
  assert.equal(geo.description.texture_width, 512);
  assert.equal(geo.description.texture_height, 512);
  const cubes = geo.bones.flatMap(b => b.cubes || []);
  assert.ok(cubes.length >= 100 && cubes.length <= 240, `${cubes.length} cubes`);
  assert.deepEqual(geo.bones.find(b => b.name === 'muzzle_pos').pivot, [41.25, 0, 0]);
  for (const c of cubes) assert.ok([...c.origin, ...c.size, ...(c.rotation || [])].every(Number.isFinite));
});
