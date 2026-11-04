const assert = require('node:assert/strict');
const fs = require('node:fs');
const { fixture } = require('./browser-fixture');
// Explored lobby -> agent selection (#sel-go) -> real match/shop on 2026-11-04.
// Actual cast functions, geometry and collision solver; no ray/terrain stubs.
(async () => {
  const f = await fixture();
  try {
    const p = await f.page('abilityaim', { width: 1280, height: 700 });
    await p.locator('#go-play').click();
    await p.locator('#sel-grid .acard').filter({ hasText: '단비' }).click();
    await p.evaluate(() => { room.map = 'field'; room.mode = 'std'; });
    await p.locator('#sel-go').click();
    await p.waitForFunction(() => !!myActor()?.model && world.actors.length > 1);
    const result = await p.evaluate(() => {
      closeShop(); ADMIN.freezeAI = true; setQuality('mobile');
      const me = myActor(), enemy = world.actors.find(a => a.team !== me.team);
      const out = { beams: [], projectiles: [], arcs: [], ceilings: [], targeting: {}, replay: {} };
      function reset(y, pitch, crouch = false) {
        abilClear(); world.phase = 'live'; world.phaseT = 999; world.roundTime = 999;
        me.pos.set(0, 0, 0); me.y = y; me.pitch = pitch; me.yaw = 0; me.crouch = crouch;
        me.alive = true; me.hp = 100; me.invuln = 999; me.suppress = me.silenced = 0; me.ultW = null;
        me.vel.set(0, 0, 0); CAST_REFUND = false;
        for (const a of world.actors) if (a !== me) a.alive = false;
        camera.position.set(0, actorEye(me), 0); camera.rotation.set(pitch, 0, 0, 'YXZ');
        camera.updateMatrixWorld(true); tickViewmodel(0);
      }
      function cast(type) {
        const agent = AGENTS.find(a => a.abilities.some(d => d.type === type));
        if (!agent) throw Error('Missing live ability ' + type);
        me.agent = agent;
        withCaster(me, () => castAbility(type, agent.abilities.find(d => d.type === type)));
      }
      function beamEndpoints(mesh) {
        if (mesh.isLine && mesh.geometry.attributes.position?.count === 2) {
          const a = mesh.geometry.attributes.position;
          return [new T.Vector3().fromBufferAttribute(a, 0), new T.Vector3().fromBufferAttribute(a, 1)];
        }
        if (mesh.geometry?.type === 'CylinderGeometry' && mesh.geometry.parameters.height === 1 && mesh.scale.y > 3) {
          const axis = new T.Vector3(0, 1, 0).applyQuaternion(mesh.quaternion).multiplyScalar(mesh.scale.y / 2);
          return [mesh.position.clone().sub(axis), mesh.position.clone().add(axis)];
        }
        return null;
      }
      for (const type of ['x_mark_knife', 'x_water_cannon', 'y_time_brand', 'y_yellow', 'pierce']) {
        for (const [y, pitch, crouch] of [[8, .55, false], [8, -.55, true]]) {
          reset(y, pitch, crouch);
          const before = new Set(scene.children); cast(type);
          const from = abilityOrigin(me);
          const beams = scene.children.filter(m => !before.has(m)).map(beamEndpoints).filter(Boolean)
            .filter(([a,b]) => a.distanceTo(b) > 3);
          out.beams.push({ type, y, pitch, crouch, handY: from.y,
            beams: beams.map(([a,b]) => ({ sourceError: a.distanceTo(from), rise: b.y - a.y, startY: a.y, endY: b.y })) });
        }
      }
      for (const type of ['proj_fire', 'recon_dart', 'blood_orb']) {
        for (const pitch of [-.55, .55]) {
          reset(8, pitch, true); const count = world.props.length; cast(type);
          const prop = world.props.slice(count).find(a => a.type === 'proj');
          if (!prop) throw Error('No projectile for ' + type);
          out.projectiles.push({ type, pitch, handY: abilityOrigin(me).y, y: prop.mesh.position.y,
            sourceError: prop.mesh.position.distanceTo(abilityOrigin(me)), vy: prop.vel.y });
        }
      }
      for (const [type, radius, halfTime] of [['x_potion_heal', .18, .25], ['x_mortar', .22, .8]]) {
        reset(12, -.5);
        const before = new Set(scene.children); cast(type);
        const mesh = scene.children.find(m => !before.has(m) && m.geometry?.type === 'SphereGeometry' && m.geometry.parameters.radius === radius);
        if (!mesh) throw Error('No arc mesh for ' + type);
        const start = mesh.position.clone(), sourceError = start.distanceTo(abilityOrigin(me));
        abilTick(halfTime);
        out.arcs.push({ type, sourceError, startY: start.y, midY: mesh.position.y });
      }
      reset(8, 0);
      enemy.alive = true; enemy.y = 12; enemy.pos.set(0, 0, -12); enemy.invuln = 0; enemy.vuln = 0;
      cast('x_mark_knife'); out.targeting.horizontal = enemy.vuln || 0;
      me.pitch = Math.atan2(enemy.y + .95 * BODY_K - actorEye(me), 12);
      camera.rotation.x = me.pitch; camera.updateMatrixWorld(true); tickViewmodel(0);
      cast('x_mark_knife'); out.targeting.upward = enemy.vuln || 0;
      reset(8, .55);
      enemy.agent = AGENTS.find(a => a.abilities.some(d => d.type === 'x_mark_knife'));
      enemy.alive = true; enemy.pos.set(12, 0, -12); enemy.y = 8; enemy.yaw = 0; enemy.pitch = .55;
      enemy.model.group.position.set(12, 8, -12); enemy.model.group.updateMatrixWorld(true);
      const beforeReplay = new Set(scene.children), mode = NET.mode; NET.mode = 'client';
      try { replayCast({t:'cast',a:enemy.id,ty:'x_mark_knife',x:Q.pos(12),y:Q.pos(8),z:Q.pos(-12),yw:Q.ang(0),pt:Q.ang(.55)}); }
      finally { NET.mode = mode; }
      const remoteFrom = abilityOrigin(enemy), localFrom = abilityOrigin(me);
      out.replay = { separation: remoteFrom.distanceTo(localFrom), beams: scene.children.filter(m => !beforeReplay.has(m)).map(beamEndpoints).filter(Boolean)
        .filter(([a,b]) => a.distanceTo(b) > 3).map(([a,b]) => ({sourceError:a.distanceTo(remoteFrom),rise:b.y-a.y})) };
      abilClear(); room.map = 'hospital'; loadMap('hospital');
      const plan = HOSPITAL_PLAN, nav = HOSPITAL_NAV.graph(), cells = plan.rows * plan.cols;
      for (const level of [0, 1]) {
        reset(level * plan.floorH, Math.PI / 2);
        let found = false;
        for (let i = level * cells; i < (level + 1) * cells; i++) {
          if (!nav.free[i]) continue;
          const cell = i % cells, x = plan.origin[0] + (cell % plan.cols + .5) * plan.cell;
          const z = plan.origin[1] + (Math.floor(cell / plan.cols) + .5) * plan.cell;
          const ceilings = COLLIDERS.filter(c => x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ && c.y0 > actorEye(me));
          if (!ceilings.length) continue;
          me.pos.set(x, 0, z);
          const s = abilityAim(me, 20, .5), expected = Math.min(...ceilings.map(c => c.y0));
          out.ceilings.push({level,expected,actual:s.end.y}); found = true; break;
        }
        if (!found) throw Error('No covered hospital floor cell for level ' + level);
      }
      abilClear();
      return out;
    });
    fs.mkdirSync('test-results/ability-aim', { recursive: true });
    fs.writeFileSync('test-results/ability-aim/results.json', JSON.stringify(result, null, 2));
    for (const row of result.beams) {
      assert.ok(row.beams.length, 'actual beam mesh: ' + row.type);
      for (const beam of row.beams) {
        assert.ok(beam.sourceError < .001, JSON.stringify(row));
        assert.ok(row.pitch > 0 ? beam.rise > 3 : beam.rise < -3, JSON.stringify(row));
      }
    }
    for (const row of result.projectiles) {
      assert.ok(row.sourceError < .001, JSON.stringify(row));
      assert.ok(row.y > 8.2, JSON.stringify(row));
      assert.ok(row.pitch > 0 ? row.vy > 0 : row.vy < 0, JSON.stringify(row));
    }
    for (const row of result.arcs) {
      assert.ok(row.sourceError < .001, JSON.stringify(row));
      assert.ok(row.startY > 12.2 && row.midY > 7, JSON.stringify(row));
    }
    assert.equal(result.targeting.horizontal, 0, 'horizontal aim misses the upper floor');
    assert.ok(result.targeting.upward > 0, 'upward aim reaches the elevated target');
    assert.ok(result.replay.separation > 10, 'remote cast cannot borrow the local wrist');
    assert.ok(result.replay.beams.length, 'received cast event creates the actual remote beam');
    for (const beam of result.replay.beams) {
      assert.ok(beam.sourceError < .001, JSON.stringify(result.replay));
      assert.ok(beam.rise > 3, JSON.stringify(result.replay));
    }
    assert.equal(result.ceilings.length, 2);
    for (const row of result.ceilings) assert.ok(Math.abs(row.expected - row.actual) < .001, JSON.stringify(row));
    assert.deepEqual(f.errors, []);
    console.log('Ability aim: 10 beam casts, 6 projectiles, 2 arcs, elevated targets, remote cast-event replay and actual hospital ceilings passed');
  } finally { await f.browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
