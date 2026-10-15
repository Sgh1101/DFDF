
(() => {
  // Two-handed rifle hold for third-person models. The gun rides a mount on
  // the chest (stock at the right shoulder) and both arms are solved with
  // two-bone IK so the right hand sits on the grip and the left hand on the
  // handguard. Casts only move the left arm, reloads the left arm, and
  // plant/defuse and ult weapons keep the original animation.
  const DOWN = new T.Vector3(0, -1, 0),
    V = () => new T.Vector3(),
    tmp = { a: V(), b: V(), c: V(), d: V(), e: V(), q: new T.Quaternion(), qi: new T.Quaternion() };
  const GRIP = new T.Vector3(-0.015, -0.06, 0.02),
    GUARD = new T.Vector3(0, -0.035, -0.2),
    POLE_R = new T.Vector3(1, -1, 0.45).normalize(),
    POLE_L = new T.Vector3(-0.55, -1, 0.15).normalize();

  const _bf = buildFighter;
  buildFighter = function () {
    const m = _bf.apply(this, arguments);
    try {
      const bones = [m.armL.arm, m.armL.fore, m.armR.arm, m.armR.fore];
      const mount = new T.Group();
      mount.position.set(0.05, 0.24, -0.16);
      m.chest.add(mount);
      m._ik = {
        mount,
        base: bones.map((b) => b.rotation.clone()),
        bones,
        gunHome: { parent: m.gun.parent, pos: m.gun.position.clone(), rot: m.gun.rotation.clone() },
        lu: Math.abs(m.armR.fore.position.y) || 0.28,
        lf: 0.245,
      };
    } catch (e) {}
    return m;
  };

  function mountGun(m, on) {
    const g = m.gun,
      k = m._ik;
    if (on) {
      if (g.parent !== k.mount) k.mount.add(g), g.position.set(0, 0, 0), g.rotation.set(0, 0, 0);
    } else if (g.parent !== k.gunHome.parent) k.gunHome.parent.add(g), g.position.copy(k.gunHome.pos), g.rotation.copy(k.gunHome.rot);
  }
  // point the chain arm -> fore so the hand lands on `target` (chest space)
  function solve(arm, fore, target, pole, lu, lf) {
    const S = arm.position,
      d = tmp.a.subVectors(target, S);
    let L = d.length();
    const dir = d.normalize();
    L = Math.min(Math.max(L, Math.abs(lu - lf) + 1e-3), lu + lf - 1e-3);
    const cosA = Math.min(1, Math.max(-1, (lu * lu + L * L - lf * lf) / (2 * lu * L))),
      sinA = Math.sqrt(1 - cosA * cosA);
    const perp = tmp.b.copy(pole).addScaledVector(dir, -pole.dot(dir)).normalize();
    const E = tmp.c.copy(S).addScaledVector(dir, lu * cosA).addScaledVector(perp, lu * sinA);
    const H = tmp.d.copy(S).addScaledVector(dir, L);
    arm.quaternion.setFromUnitVectors(DOWN, tmp.e.subVectors(E, S).normalize());
    tmp.qi.copy(arm.quaternion).invert();
    fore.quaternion.setFromUnitVectors(DOWN, tmp.e.subVectors(H, E).normalize().applyQuaternion(tmp.qi));
  }

  const _af = animateFighter;
  animateFighter = function (e, t) {
    const m = e && e.model,
      k = m && m._ik;
    // undo last frame's IK so the original animation starts from the build pose
    if (k) k.bones.forEach((b, i) => b.rotation.copy(k.base[i]));
    const r = _af.apply(this, arguments);
    if (!k || !e.alive) return r;
    try {
      const plain = !e._kneel && !e.ultW;
      mountGun(m, plain);
      if (!plain) return r;
      const v = Math.max(-0.9, Math.min(0.9, e.pitch || 0)),
        rc = e.recoil || 0;
      // keep the barrel on the aim line whatever the torso is doing
      k.mount.rotation.set(v - 0.85 * m.chest.rotation.x + 0.1 * rc, -0.04, 0);
      k.mount.position.z = -0.16 + 0.05 * rc;
      k.mount.updateMatrix();
      const grip = tmp.a.copy(GRIP).applyMatrix4(k.mount.matrix);
      solve(m.armR.arm, m.armR.fore, grip.clone(), POLE_R, k.lu, k.lf);
      if (!(e._castT > 0) && !(e.reloading > 0)) {
        const guard = tmp.a.copy(GUARD).applyMatrix4(k.mount.matrix);
        solve(m.armL.arm, m.armL.fore, guard.clone(), POLE_L, k.lu, k.lf);
      }
    } catch (x) {}
    return r;
  };
})();
