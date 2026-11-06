(() => {
  // 챔피언의 물결 (our own legendary skin): every shot sends three rings of light out of the muzzle, one after
  // the other, growing as they go (a wave leaving the gun); a kill sends gold-and-violet waves out over the ground
  // from where the target fell. The skin's accent (violet tracer, flash, sparks, embers, burst) is the legendary
  // perks' own (60-skin-perks.js); this adds the rings. Seen by everyone in the room, only for a wearer
  // the server vouches for, like the burst.
  if ("undefined" == typeof actorFire || !window.GUN_SKINS || "function" != typeof addFx) return;
  const GS = window.GUN_SKINS;
  const ID = "champion";
  // the skin's own colours, purple then pink then gold: a shot's rings and a kill's waves run through them in that order
  const COLS = [0xb066ff, 0xff4fb8, 0xffc24d];
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

  // ── rings that leave the muzzle: face the way it points, growing and fading ──
  let RING = null;
  const ringGeo = () => RING || ((RING = new T.RingGeometry(0.8, 1, 56)), (RING.userData.shared = !0), RING);
  function rings(pos, dir, big) {
    if (!pos || !dir) return;
    // purple, pink, then the gold ring last; with fewer rings (low effects) the gold one is kept. The gold ring is drawn a
    // little larger and stays about twice as long, so the shot leaves a gold halo that is still there after the colours
    const n = Math.max(2, Math.round(3 * q())),
      cols = n >= 3 ? COLS : [COLS[0], COLS[2]],
      d = dir.clone().normalize(),
      reach = big ? 2.4 : 1.9,
      size = big ? 0.95 : 0.75;
    for (let i = 0; i < n; i++) {
      // solid colour (not additive), so the ring reads against a bright sky and a bright floor as well as a dark one
      const c = cols[i % cols.length],
        gold = c === COLS[2],
        mat = new T.MeshBasicMaterial({ color: c, transparent: !0, opacity: 0, depthWrite: !1, side: T.DoubleSide }),
        m = new T.Mesh(ringGeo(), mat),
        delay = i * 0.06,
        dur = gold ? 1 : 0.55,
        grow = gold ? 1.15 : 1,
        life = dur + delay;
      m.position.copy(pos);
      m.lookAt(pos.clone().add(d));
      m.userData.noCollide = !0;
      addFx(m, life, (o, t) => {
        const k = Math.max(0, t * life - delay) / dur; // 0..1 once its turn has come
        if (k <= 0) return void (o.material.opacity = 0);
        const e = 1 - (1 - k) * (1 - k);
        o.position.copy(pos).addScaledVector(d, 0.04 + e * reach);
        o.scale.setScalar((0.05 + e * size) * grow);
        o.material.opacity = 0.95 * (1 - Math.pow(k, gold ? 3 : 2));
      });
    }
  }
  // the muzzle of the gun in my hands: the model's own muzzle anchor when it has one (the realistic models mark it), or
  // else found from the gun's own front (the middle of its muzzle end, a little above the bore line), so the rings leave
  // the gun wherever it is on screen
  const MZ = new WeakMap();
  function muzzleOf(g) {
    let l = MZ.get(g);
    if (!l) {
      g.updateWorldMatrix(!0, !0);
      let anchor = null;
      g.traverse((o) => {
        const a = !anchor && o.userData && o.userData.anchors && o.userData.anchors.muzzle;
        a && a.length === 3 && (anchor = { o, p: new T.Vector3(a[0], a[1], a[2]) });
      });
      if (anchor) l = anchor;
      else {
        const inv = g.matrixWorld.clone().invert(),
          box = new T.Box3(),
          b = new T.Box3();
        g.traverse((o) => {
          if (!o.isMesh || !o.geometry || o.userData.kit || !o.visible) return;
          o.geometry.boundingBox || o.geometry.computeBoundingBox();
          b.copy(o.geometry.boundingBox).applyMatrix4(inv.clone().multiply(o.matrixWorld));
          const s = b.getSize(new T.Vector3());
          Math.min(s.x, s.y, s.z) >= 1e-4 && box.union(b);
        });
        if (box.isEmpty()) return null;
        l = { o: g, p: new T.Vector3((box.min.x + box.max.x) / 2, box.min.y + (box.max.y - box.min.y) * 0.7, box.min.z) };
      }
      MZ.set(g, l);
    }
    l.o.updateWorldMatrix(!0, !1);
    return l.o.localToWorld(l.p.clone());
  }
  // my own shot: from the gun's muzzle along the view (from just in front of the camera when the gun cannot be found)
  function mine() {
    const f = new T.Vector3(),
      u = new T.Vector3(),
      r = new T.Vector3();
    camera.getWorldDirection(f);
    let p = null;
    try {
      const g = "undefined" != typeof VM && VM.current;
      g && g.visible && VM.root.visible && (p = muzzleOf(g));
    } catch (e) {}
    if (!p) {
      u.copy(camera.up).applyQuaternion(camera.quaternion);
      r.crossVectors(f, u).normalize();
      const ads = !!player.ads;
      p = camera.position.clone().addScaledVector(r, ads ? 0.04 : 0.17).addScaledVector(u, ads ? -0.05 : -0.1).addScaledVector(f, ads ? 0.55 : 0.62);
    }
    rings(p, f, !1);
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

  // ── a kill: waves over the ground, three ripples (purple, pink, gold) running out from where the target fell ──
  let FLAT = null,
    DISC = null;
  const flatGeo = () => FLAT || ((FLAT = new T.RingGeometry(0.84, 1, 64)), (FLAT.userData.shared = !0), FLAT);
  const discGeo = () => DISC || ((DISC = new T.CircleGeometry(1, 40)), (DISC.userData.shared = !0), DISC);
  function waves(x, y, z) {
    const n = Math.max(2, Math.round(3 * q()));
    const ground = Math.max(0.06, y - 0.9);
    // a flash of colour where it fell
    const dm = new T.Mesh(discGeo(), new T.MeshBasicMaterial({ color: COLS[1], transparent: !0, opacity: 0, depthWrite: !1, side: T.DoubleSide }));
    dm.rotation.x = -Math.PI / 2;
    dm.position.set(x, ground + 0.01, z);
    dm.userData.noCollide = !0;
    addFx(dm, 0.45, (o, t) => {
      o.scale.setScalar(0.4 + t * 2.2);
      o.material.opacity = 0.6 * (1 - t) * (1 - t);
    });
    for (let i = 0; i < n; i++) {
      const mat = new T.MeshBasicMaterial({ color: COLS[i % COLS.length], transparent: !0, opacity: 0, depthWrite: !1, side: T.DoubleSide }),
        m = new T.Mesh(flatGeo(), mat),
        delay = i * 0.11,
        life = 1 + delay;
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, ground + 0.02 + i * 0.005, z);
      m.userData.noCollide = !0;
      addFx(m, life, (o, t) => {
        const k = Math.max(0, t * life - delay),
          e = 1 - (1 - k) * (1 - k);
        o.material.opacity = k <= 0 ? 0 : 0.95 * (1 - k * k);
        o.scale.setScalar(0.3 + e * 4.4);
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

  window.CHAMPION_WAVE = { rings, waves, wears, muzzleOf };
})();
