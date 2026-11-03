const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), T = require('three');
const engine = fs.readFileSync('js/legacy/03-engine.js', 'utf8');
const paths = [
  'js/legacy/37-agent-abilities.js',
  'js/legacy/72-extra-agents.js',
  'js/legacy/87-two-more-agents-the-mask-who-copies-and-swaps-and-the-referee.js',
];
const actor = (extra = {}) => ({ id: 'caster', ctrl: 'peer', team: 'atk', alive: true, pos: new T.Vector3(), y: 0, yaw: 0, pitch: 0, crouch: false, ...extra });
function runtime(c = actor(), foes = [], blocks = []) {
  const ctx = { T, Math, BODY_K: 1.1, EYE: 1.848, CROUCH_EYE: 1.232, player: c,
    world: { actors: [c, ...foes], props: [] }, DOMES: [], VM: { current: null, root: { visible: false } }, VM_CAST: { t: 0 },
    COLLIDERS: blocks.map(b => ({minX:b[0], maxX:b[1], y0:b[2], h:b[3], minZ:b[4], maxZ:b[5]})),
    myActor: () => c, tickVmCast() {}, scene: new T.Scene(),
    collideXZ: (x, z, y) => blocks.some(b => x >= b[0] && x <= b[1] && y >= b[2] && y <= b[3] && z >= b[4] && z <= b[5]),
    rayBlocked: () => false, domeBlockT: (o, d, max) => max,
    foesOf: a => ctx.world.actors.filter(b => b !== a && b.alive && b.team !== a.team),
  };
  ctx.window = { AB_D: 1 };
  vm.createContext(ctx);
  vm.runInContext(engine.slice(engine.indexOf('function actorEye('), engine.indexOf('function actorFire(')), ctx);
  vm.runInContext(engine.slice(engine.indexOf('function ultwAim('), engine.indexOf('function ultwHurt(')), ctx);
  return ctx;
}
function legacy(ctx, path) {
  const src = fs.readFileSync(path, 'utf8');
  if (path === paths[0]) {
    vm.runInContext(src.slice(src.indexOf('  const clearLen ='), src.indexOf('  const inCone =')), ctx);
    vm.runInContext(src.slice(src.indexOf('  const eye ='), src.indexOf('  function ghostOf')), ctx);
  } else {
    vm.runInContext(src.slice(src.indexOf('  const clearLen ='), src.indexOf('  const live =')), ctx);
  }
  ctx.losOK = () => true;
  return path === paths[2] ? ctx.pick : ctx.scan;
}
for (const path of paths) {
  test(path + ': empty rays follow up/down aim instead of a horizontal plane', () => {
    const c = actor({ y: 8 }), ctx = runtime(c), scan = legacy(ctx, path);
    c.pitch = .6; const up = scan(c, 20, .5);
    c.pitch = -.6; const down = scan(c, 20, .5);
    assert.ok(up.end.y > 19, 'upward shot must climb above the caster');
    assert.ok(down.end.y < 1, 'downward shot must descend toward the ground');
  });
  test(path + ': crouching on a raised floor uses the actual actor eye height', () => {
    const c = actor({ y: 8, crouch: true }), ctx = runtime(c), scan = legacy(ctx, path);
    assert.ok(Math.abs(scan(c, 20, .5).e.y - 9.232) < 1e-9);
    c.crouch = false;
    assert.ok(Math.abs(scan(c, 20, .5).e.y - 9.848) < 1e-9);
  });
  test(path + ': an enemy on another floor requires aiming vertically at it', () => {
    const c = actor({ y: 6 }), enemy = actor({ id: 'enemy', team: 'def', pos: new T.Vector3(0, 0, -12) });
    const ctx = runtime(c, [enemy]), scan = legacy(ctx, path);
    assert.equal(scan(c, 30, .5).hit, null, 'horizontal aim must not hit the lower floor');
    c.pitch = Math.atan2(1.045 - 7.848, 12);
    assert.equal(scan(c, 30, .5).hit, enemy);
  });
}
test('a pitched ability ray stops at the actual ceiling and keeps its configured range', () => {
  const c = actor({ y: 4, pitch: Math.PI / 4 }), ctx = runtime(c, [], [[-2, 2, 8, 8.5, -20, 2]]);
  const scan = legacy(ctx, paths[0]);
  const blocked = scan(c, 20, .5);
  assert.ok(blocked.end.y >= 8 && blocked.end.y < 8.5);
  assert.ok(blocked.L < 5, 'ceiling must stop the beam before its maximum range');
  ctx.window.AB_D = 1.7;
  // Model the real reach wrapper installed by legacy/22.
  vm.runInContext('const originalRay = ultwRay; ultwRay = (a,o,d,len,...args) => originalRay(a,o,d,len * window.AB_D,...args)', ctx);
  ctx.collideXZ = () => false; ctx.COLLIDERS = []; c.pitch = 0;
  assert.ok(Math.abs(scan(c, 20, .5).L - 20) < 1e-9, 'reach is not multiplied a second time');
});
test('projectiles start at the caster wrist, and another actor cannot borrow the local wrist', () => {
  const c = actor({ y: 5, pos: new T.Vector3(2, 0, -2) }), ctx = runtime(c);
  const wrist = new T.Group(); wrist.position.set(2.2, 6.1, -2.5);
  ctx.VM_CAST = { t: .5, grp: wrist, hand: new T.Vector3(0, .3, 0) };
  ctx.VM.root.visible = true;
  ctx.PROJ_GEO = new T.SphereGeometry(.15, 6, 4); ctx.PROJ_BAND = new T.TorusGeometry(.22, .018, 3, 6);
  ctx.glowDot = () => new T.Group(); ctx.eyeHeight = () => c.crouch ? ctx.CROUCH_EYE : ctx.EYE;
  ctx.withCaster = (a, fn) => fn();
  vm.runInContext(engine.slice(engine.indexOf('function throwProjectile('), engine.indexOf('const PROJ_GEO =')), ctx);
  ctx.throwProjectile(0xff0000, 22, () => {});
  assert.ok(ctx.world.props[0].mesh.position.distanceTo(new T.Vector3(2.2, 6.4, -2.5)) < 1e-9);
  const remote = actor({ id: 'remote', y: 9, pos: new T.Vector3(-10, 0, -10) });
  assert.equal(typeof ctx.abilityOrigin, 'function');
  const from = ctx.abilityOrigin(remote);
  assert.ok(from.distanceTo(new T.Vector3(-10, 10.848, -10)) < 1);
  assert.ok(from.distanceTo(new T.Vector3(2.2, 6.4, -2.5)) > 10);
});
for (const [type, next, minHalfY, maxHalfY] of [
  ['x_potion_heal', 'x_sleep_powder', 7, 9],
  ['x_mortar', 'x_minefield_mine', 24, 26],
]) test(type + ': an elevated throw starts at the wrist and never snaps to terrain during flight', () => {
  const c = actor({ y: 8 }), ally = actor({ id: 'ally', hp: 50, pos: new T.Vector3(10, 0, -10) });
  const ctx = runtime(c), wrist = new T.Group(); wrist.position.set(.25, 9.4, -.5);
  ctx.VM_CAST = { t: .5, grp: wrist, hand: new T.Vector3() };
  const src = fs.readFileSync(paths[0], 'utf8');
  Object.assign(ctx, {
    H: {}, within: list => list, mates: () => [ally], aimAt: () => ({ x: 10, y: 0, z: -10 }),
    abilityGroundY: (x, z, y) => Number.isFinite(y) ? y : x < 5 ? 8 : 0,
    mat: () => new T.MeshBasicMaterial(), ring: () => new T.Mesh(new T.CircleGeometry(1, 8), new T.MeshBasicMaterial()), glowDot: () => new T.Group(),
    live: (duration, update) => { ctx.advance = () => update(duration / 2, 0); },
  });
  vm.runInContext(src.slice(src.indexOf('  const groundPosition ='), src.indexOf('  const dot =')), ctx);
  vm.runInContext(src.slice(src.indexOf('  H.' + type + ' ='), src.indexOf('  H.' + next + ' =')), ctx);
  ctx.H[type]();
  const mesh = ctx.scene.children[0];
  assert.ok(mesh.position.distanceTo(new T.Vector3(.25, 9.4, -.5)) < 1e-9, 'first frame starts at the hand');
  ctx.advance();
  assert.ok(mesh.position.y > minHalfY && mesh.position.y < maxHalfY, 'flight interpolates absolute start/end heights');
});
for (const pitch of [-.6, .6]) test('boomerang follows vertical aim at pitch ' + pitch, () => {
  const c = actor({ y: 5, pitch }), ctx = runtime(c), wrist = new T.Group(); wrist.position.set(.25, 6.4, -.5);
  ctx.VM_CAST = { t: .5, grp: wrist, hand: new T.Vector3() };
  Object.assign(ctx, { H: {}, eye: a => ({x: a.pos.x, y: ctx.actorEye(a), z: a.pos.z}),
    clearLen: (x,z,dx,dz,len) => len, within: () => [], DA: () => 1,
    bladeMesh: () => { const g = new T.Group(); ctx.scene.add(g); return g; },
    live: (duration, update) => { ctx.advance = () => update(.1, .1); },
  });
  const src = fs.readFileSync(paths[0], 'utf8'), start = src.indexOf('  H.x_boomerang =');
  vm.runInContext(src.slice(start, src.indexOf('\n  H.', start + 9)), ctx);
  ctx.H.x_boomerang({}, new T.Vector3(0,0,-1)); ctx.advance();
  const y = ctx.scene.children[0].position.y;
  assert.ok(pitch > 0 ? y > 7.4 : y < 5.4, 'boomerang must rise/fall along the aimed trajectory');
});
test('a beam touches a thin ceiling instead of stopping a whole fighter height below it', () => {
  const ctx = runtime(actor({y:4,pitch:Math.PI/4}), [], [[-2,2,8,8.05,-20,2]]);
  // The engine's movement collision has 2.3m headroom; a ray must not inherit it.
  ctx.CHASH = {cell:8,cols:0,rows:0,minX:0,minZ:0,buckets:null,dirty:true,out:[],gen:0};
  vm.runInContext(engine.slice(engine.indexOf('function chashBuild('), engine.indexOf('function blockerTopAt(')),ctx);
  const scan = legacy(ctx,paths[0]), s = scan(ctx.player,20,.5);
  assert.ok(Math.abs(s.end.y - 8) < .001, 'beam must meet the actual underside of the ceiling');
});
test('a wrist beyond a nearby wall cannot spawn a projectile on the other side', () => {
  const c=actor(),ctx=runtime(c,[],[[-1,1,0,3,-.4,-.3]]),wrist=new T.Group();
  wrist.position.set(.25,1.4,-.5);ctx.VM_CAST={t:.5,grp:wrist,hand:new T.Vector3()};
  assert.equal(typeof ctx.abilityOrigin,'function');
  assert.ok(ctx.abilityOrigin(c).distanceTo(new T.Vector3(0,1.848,0)) < .001);
});
