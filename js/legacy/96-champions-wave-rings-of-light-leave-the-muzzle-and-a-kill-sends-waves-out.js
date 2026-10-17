(() => {
  // 챔피언의 물결 (our own legendary skin): every shot sends three rings of light out of the muzzle, one after
  // the other, growing as they go (a wave leaving the gun); a kill sends gold-and-violet waves out over the ground
  // from where the target fell. The skin's accent (violet tracer, flash, sparks, embers, burst) is the legendary
  // perks' own (60-skin-perks.js); this adds the rings. Seen by everyone in the room, only for a wearer
  // the server vouches for, like the burst.
  if ("undefined" == typeof actorFire || !window.GUN_SKINS || "function" != typeof addFx) return;
  const GS = window.GUN_SKINS;
  const ID = "champion";
  const GOLD = 0xe6bd4f,
    AQUA = 0xc060ff;
  const hk = (a) => ("client" === NET.mode && "me" !== a.ctrl && a.netWeapon ? a.netWeapon : actorWeaponKey(a));
  const wears = (a) => {
    try {
      if (!a || !a.alive) return !1;
      const key = hk(a);
      if ("knife" === key) return !1;
      const s = GS.skinOf(a, key);
      return !!s && s.id === ID;
    } catch (e) {
      return !1;
    }
  };
  const q = () => Math.max(0.4, ("object" == typeof GFX && GFX.fx) || 1);

  // ── rings that leave the muzzle: faces the way it points, growing and fading ──
  let RING = null;
  const ringGeo = () => RING || ((RING = new T.RingGeometry(0.86, 1, 56)), (RING.userData.shared = !0), RING);
  function rings(pos, dir, big) {
    if (!pos || !dir) return;
    const n = Math.max(2, Math.round(3 * q()));
    for (let i = 0; i < n; i++) {
      const col = i % 2 ? GOLD : AQUA,
        mat = new T.MeshBasicMaterial({ color: col, transparent: !0, opacity: 0, depthWrite: !1, side: T.DoubleSide, blending: T.AdditiveBlending });
      mat.color.multiplyScalar(1.5);
      const m = new T.Mesh(ringGeo(), mat),
        d = dir.clone().normalize(),
        delay = i * 0.055;
      m.position.copy(pos);
      m.lookAt(pos.clone().add(d));
      m.userData.noCollide = !0;
      let started = !1;
      addFx(m, 0.62 + delay, (o, t) => {
        const life = 0.62 + delay,
          k = Math.max(0, t * life - delay) / 0.62; // 0..1 once its turn has come
        if (k <= 0) return void (o.material.opacity = 0);
        started || ((started = !0), o.position.copy(pos));
        o.position.copy(pos).addScaledVector(d, 0.1 + k * (big ? 1.7 : 1.2));
        o.scale.setScalar((big ? 0.12 : 0.08) + k * (big ? 0.55 : 0.4));
        o.material.opacity = 0.9 * (1 - k) * (1 - k);
      });
    }
  }
  // my own shot: from just in front of the gun, along the view
  function mine() {
    const f = new T.Vector3(),
      u = new T.Vector3(),
      r = new T.Vector3();
    camera.getWorldDirection(f);
    u.copy(camera.up).applyQuaternion(camera.quaternion);
    r.crossVectors(f, u).normalize();
    const ads = !!player.ads;
    rings(camera.position.clone().addScaledVector(r, ads ? 0.04 : 0.17).addScaledVector(u, ads ? -0.05 : -0.1).addScaledVector(f, ads ? 0.55 : 0.62), f, !1);
  }
  const forward = (a) => {
    const cp = Math.cos(a.pitch || 0);
    return new T.Vector3(-Math.sin(a.yaw) * cp, Math.sin(a.pitch || 0), -Math.cos(a.yaw) * cp);
  };
  // another actor's shot: from their muzzle
  const _wm = "function" == typeof worldMuzzleFlash ? worldMuzzleFlash : null;
  if (_wm)
    worldMuzzleFlash = function (e) {
      const r = _wm.apply(this, arguments);
      try {
        if (e && "me" !== e.ctrl && wears(e) && e.model) {
          const p = new T.Vector3(),
            mz = e.model.muzzle;
          mz ? mz.getWorldPosition(p) : p.set(e.pos.x, e.y + 1.35, e.pos.z);
          rings(p, forward(e), !0);
        }
      } catch (x) {}
      return r;
    };
  const _af = actorFire;
  actorFire = function (e) {
    const r = _af.apply(this, arguments);
    try {
      "me" === (e && e.ctrl) && wears(e) && !player.ultW && mine();
    } catch (x) {}
    return r;
  };

  // ── a kill: waves over the ground ──
  let FLAT = null;
  const flatGeo = () => FLAT || ((FLAT = new T.RingGeometry(0.9, 1, 64)), (FLAT.userData.shared = !0), FLAT);
  function waves(x, y, z) {
    const n = Math.max(2, Math.round(4 * q()));
    for (let i = 0; i < n; i++) {
      const mat = new T.MeshBasicMaterial({ color: i % 2 ? GOLD : AQUA, transparent: !0, opacity: 0, depthWrite: !1, side: T.DoubleSide, blending: T.AdditiveBlending });
      mat.color.multiplyScalar(1.4);
      const m = new T.Mesh(flatGeo(), mat),
        delay = i * 0.09,
        life = 1 + delay;
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, Math.max(0.06, y - 0.9), z);
      m.userData.noCollide = !0;
      addFx(m, life, (o, t) => {
        const k = Math.max(0, t * life - delay);
        o.material.opacity = k <= 0 ? 0 : 0.85 * Math.pow(1 - k, 2);
        o.scale.setScalar(0.3 + k * 4.2);
      });
    }
  }
  const _ka = killActor;
  killActor = function (e, t) {
    const had = e && t && t !== e && "client" !== NET.mode && wears(t),
      x = e && e.pos.x,
      y = e && (e.y || 0) + 1,
      z = e && e.pos.z;
    const r = _ka.apply(this, arguments);
    try {
      if (had) {
        waves(x, y, z);
        // the guests' own copy comes with the burst the legendary perks send (skx): see below
      }
    } catch (c) {}
    return r;
  };
  const _oe = NET.onEvent;
  NET.onEvent = function (e) {
    const r = _oe && _oe.apply(this, arguments);
    try {
      if (e && "skx" === e.t) {
        const s = GS.list[e.i | 0];
        s && s.id === ID && (!GS.vouch || GS.vouch(actorById(e.a), null, e.i | 0)) && waves(e.x / 100, e.y / 100, e.z / 100);
      }
    } catch (x) {}
    return r;
  };

  window.CHAMPION_WAVE = { rings, waves, wears };
})();
