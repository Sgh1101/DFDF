
(() => {
  // Gun feel: brass that flies out of the ejection port and bounces on the
  // floor, magazines that drop on reload, bullet impacts that spark, puff dust,
  // throw chips and leave a hole, and a sight + edge shade while aiming.
  const rnd = (a, b) => a + Math.random() * (b - a);
  const me = () => ("function" == typeof myActor && myActor()) || player;
  const shared = (g) => ((g.userData.shared = !0), g);
  const Q = () => Math.max(0.3, GFX.fx || 1);
  const near = (x, y, z, d) => camera.position.distanceToSquared(_v.set(x, y, z)) < d * d;
  const _v = new T.Vector3();

  // highest walkable surface under (x, z) at or below y
  function groundAt(x, z, y) {
    let g = 0;
    for (const c of COLLIDERS) if (c.h <= y + 0.05 && c.h > g && x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ) g = c.h;
    return g;
  }

  // ── casings and magazines ──
  const G = {
    brass: shared(new T.CylinderGeometry(0.0085, 0.0085, 0.036, 7)),
    shell: shared(new T.CylinderGeometry(0.014, 0.014, 0.05, 8)),
    big: shared(new T.CylinderGeometry(0.011, 0.011, 0.058, 7)),
    mag: shared(new T.BoxGeometry(0.035, 0.12, 0.06)),
    chip: shared(new T.BoxGeometry(0.028, 0.028, 0.028)),
    hole: shared(new T.PlaneGeometry(1, 1)),
  };
  const M = {
    brass: new T.MeshStandardMaterial({ color: 0xd6a04a, metalness: 0.9, roughness: 0.3, emissive: 0x3a2508 }),
    shell: new T.MeshStandardMaterial({ color: 0xb8242c, metalness: 0.3, roughness: 0.5, emissive: 0x2a0406 }),
    mag: new T.MeshStandardMaterial({ color: 0x23262c, metalness: 0.6, roughness: 0.45 }),
  };
  Object.values(M).forEach((m) => (m.userData.keep = !0));
  const LIVE = [];
  const MAX_LIVE = 48;
  let lastTink = 0;
  function tink(x, y, z, heavy) {
    const now = performance.now();
    if (now - lastTink < 45 || !near(x, y, z, 6)) return;
    lastTink = now;
    try {
      const S = SFX;
      S && S.tone ? S.tone(heavy ? 420 : 2600 + rnd(-300, 300), 0.05, "triangle", 0.035) : playTink(heavy);
    } catch (e) {}
  }
  let AC = null;
  function playTink(heavy) {
    if ("object" == typeof SETTINGS && SETTINGS && !SETTINGS.sfx) return;
    AC || (AC = GAME_AUDIO.context());
    const t = AC.currentTime,
      o = AC.createOscillator(),
      g = AC.createGain();
    o.type = heavy ? "square" : "triangle";
    o.frequency.setValueAtTime(heavy ? 220 : 2400 + rnd(-400, 400), t);
    o.frequency.exponentialRampToValueAtTime(heavy ? 90 : 1500, t + 0.06);
    g.gain.setValueAtTime(heavy ? 0.03 : 0.018, t);
    g.gain.exponentialRampToValueAtTime(1e-4, t + (heavy ? 0.09 : 0.07));
    o.connect(g).connect(AC.destination);
    o.start(t);
    o.stop(t + 0.1);
  }
  // a small body that flies, falls, bounces, rests, then shrinks away
  function toss(geo, mat, pos, vel, spin, opts) {
    if (LIVE.length >= MAX_LIVE) {
      const old = LIVE.shift();
      old.mesh.parent && old.mesh.parent.remove(old.mesh);
    }
    const m = new T.Mesh(geo, mat);
    m.position.copy(pos);
    m.rotation.set(rnd(0, 6), rnd(0, 6), rnd(0, 6));
    m.castShadow = !1;
    m.userData.noMerge = !0;
    const s = (opts && opts.scale) || 1;
    m.scale.setScalar(s);
    scene.add(m);
    LIVE.push({ mesh: m, vel, spin, t: 0, rest: 0, life: (opts && opts.life) || 2.6, bounce: (opts && opts.bounce) || 0.38, heavy: opts && opts.heavy, s, hops: 0 });
  }
  function tickLive(dt) {
    for (let i = LIVE.length - 1; i >= 0; i--) {
      const b = LIVE[i],
        m = b.mesh;
      b.t += dt;
      if (b.rest > 0) {
        b.rest += dt;
        const f = b.rest > b.life - 0.4 ? Math.max(0, (b.life - b.rest) / 0.4) : 1;
        m.scale.setScalar(b.s * f);
        if (b.rest >= b.life) {
          scene.remove(m);
          LIVE.splice(i, 1);
        }
        continue;
      }
      b.vel.y -= 13 * dt;
      m.position.addScaledVector(b.vel, dt);
      m.rotation.x += b.spin.x * dt;
      m.rotation.y += b.spin.y * dt;
      m.rotation.z += b.spin.z * dt;
      // walls push casings back instead of letting them pass through
      if ("function" == typeof collideXZ && collideXZ(m.position.x, m.position.z, m.position.y, 0.02)) {
        m.position.x -= b.vel.x * dt;
        m.position.z -= b.vel.z * dt;
        b.vel.x *= -0.35;
        b.vel.z *= -0.35;
      }
      const g = groundAt(m.position.x, m.position.z, m.position.y + 0.1) + 0.012;
      if (m.position.y <= g) {
        m.position.y = g;
        if (Math.abs(b.vel.y) > 1.1 && b.hops < 3) {
          b.hops++;
          b.vel.y = -b.vel.y * b.bounce;
          b.vel.x *= 0.55;
          b.vel.z *= 0.55;
          b.spin.multiplyScalar(0.6);
          tink(m.position.x, m.position.y, m.position.z, b.heavy);
        } else {
          // settle on its side
          b.rest = 1e-3;
          m.rotation.x = Math.PI / 2;
          m.rotation.z = 0;
        }
      }
      if (b.t > 6) b.rest = b.life - 0.4;
    }
  }
  function shellKind(key) {
    const w = WEAPONS[key] || {};
    if (w.pellets > 1) return { geo: G.shell, mat: M.shell, heavy: !0 };
    if ("sniper" === key || "marksman" === key || "battle" === key) return { geo: G.big, mat: M.brass };
    return { geo: G.brass, mat: M.brass };
  }
  const tmpF = new T.Vector3(),
    tmpR = new T.Vector3(),
    tmpU = new T.Vector3();
  // first person: out of the right side of the gun, a little up and back
  function ejectMine(key) {
    const p = me();
    if (!p || !camera) return;
    camera.getWorldDirection(tmpF);
    tmpU.copy(camera.up).applyQuaternion(camera.quaternion);
    tmpR.crossVectors(tmpF, tmpU).normalize();
    const ads = !!p.ads;
    const pos = camera.position
      .clone()
      .addScaledVector(tmpR, ads ? 0.07 : 0.2)
      .addScaledVector(tmpU, ads ? -0.07 : -0.13)
      .addScaledVector(tmpF, ads ? 0.42 : 0.5);
    const vel = tmpR
      .clone()
      .multiplyScalar(rnd(1.9, 2.7))
      .addScaledVector(tmpU, rnd(1.5, 2.3))
      .addScaledVector(tmpF, rnd(-0.6, -0.2));
    p.vel && ((vel.x += p.vel.x || 0), (vel.z += p.vel.z || 0));
    const k = shellKind(key);
    toss(k.geo, k.mat, pos, vel, new T.Vector3(rnd(10, 20), rnd(-6, 6), rnd(14, 26)), { heavy: k.heavy });
  }
  // third person, from the muzzle point the game already works out
  const _ej = "function" == typeof ejectShell ? ejectShell : null;
  ejectShell = function (o, yaw, key) {
    if (!near(o.x, o.y, o.z, 40)) return;
    const f = new T.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)),
      r = new T.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const pos = o.clone().addScaledVector(f, -0.38);
    const vel = r.multiplyScalar(rnd(1.8, 2.8));
    vel.y = rnd(1.8, 2.8);
    vel.addScaledVector(f, rnd(-0.5, 0));
    const k = shellKind(key || "rifle");
    toss(k.geo, k.mat, pos, vel, new T.Vector3(rnd(10, 20), rnd(-6, 6), rnd(14, 26)), { scale: 1.5, heavy: k.heavy });
  };
  function dropMag(a, isMe) {
    const key = isMe ? curWeaponKey() : actorWeaponKey(a);
    if (!key || "knife" === key || WEAPONS[key].pellets > 1) return;
    let pos, vel;
    if (isMe) {
      camera.getWorldDirection(tmpF);
      tmpU.copy(camera.up).applyQuaternion(camera.quaternion);
      tmpR.crossVectors(tmpF, tmpU).normalize();
      pos = camera.position.clone().addScaledVector(tmpR, 0.12).addScaledVector(tmpU, -0.3).addScaledVector(tmpF, 0.45);
      vel = tmpF.clone().multiplyScalar(0.4).addScaledVector(tmpU, -0.6);
    } else {
      if (!near(a.pos.x, a.y, a.pos.z, 30)) return;
      const f = new T.Vector3(-Math.sin(a.yaw), 0, -Math.cos(a.yaw));
      pos = new T.Vector3(a.pos.x, a.y + 1.05, a.pos.z).addScaledVector(f, 0.35);
      vel = f.multiplyScalar(0.5);
      vel.y = -0.5;
    }
    a.vel && ((vel.x += a.vel.x || 0), (vel.z += a.vel.z || 0));
    toss(G.mag, M.mag, pos, vel, new T.Vector3(rnd(-4, 4), rnd(-3, 3), rnd(-4, 4)), { life: 4, bounce: 0.2, heavy: !0, scale: isMe ? 1 : 1.3 });
  }

  const shellsOn = () => GFX.shells || (GFX.fx || 1) >= 0.5;
  const ammoOf = (a, k) => (a && a.ammo ? a.ammo[k] | 0 : 0);
  if ("function" == typeof actorFire) {
    const _af = actorFire;
    actorFire = function (a) {
      const k = a && !a.ultW ? actorWeaponKey(a) : null,
        before = k ? ammoOf(a, k) : 0;
      const r = _af.apply(this, arguments);
      try {
        if (k && "knife" !== k && ammoOf(a, k) < before && shellsOn() && "me" === a.ctrl) ejectMine(k);
      } catch (e) {}
      return r;
    };
  }
  if ("function" == typeof fire) {
    const _f = fire;
    fire = function () {
      const k = curWeaponKey(),
        before = ammoOf(player, k);
      const r = _f.apply(this, arguments);
      try {
        "knife" !== k && ammoOf(player, k) < before && shellsOn() && ejectMine(k);
      } catch (e) {}
      return r;
    };
  }
  // other shooters: the game calls ejectShell(muzzle, yaw) from worldMuzzleFlash;
  // pass the weapon through and let it run even on lighter presets
  if ("function" == typeof worldMuzzleFlash) {
    const _wm = worldMuzzleFlash;
    worldMuzzleFlash = function (a) {
      const was = GFX.shells;
      GFX.shells = !1;
      let r;
      try {
        r = _wm.apply(this, arguments);
      } finally {
        GFX.shells = was;
      }
      try {
        if (a && a.model && shellsOn() && Math.random() < 0.85) {
          const o = new T.Vector3();
          a.model.muzzle ? a.model.muzzle.getWorldPosition(o) : o.set(a.pos.x, a.y + 1.35, a.pos.z);
          ejectShell(o, a.yaw, actorWeaponKey(a));
        }
      } catch (e) {}
      return r;
    };
  }
  const _sr = startReload;
  startReload = function () {
    const was = player.reloading > 0;
    const r = _sr.apply(this, arguments);
    try {
      !was && player.reloading > 0 && dropMag(player, !0);
    } catch (e) {}
    return r;
  };
  if ("function" == typeof actorReload) {
    const _ar = actorReload;
    actorReload = function (a) {
      const was = a && a.reloading > 0;
      const r = _ar.apply(this, arguments);
      try {
        a && !was && a.reloading > 0 && dropMag(a, "me" === a.ctrl);
      } catch (e) {}
      return r;
    };
  }

  // ── bullet impacts ──
  // which face of which box (or the floor) is this point on?
  function surfaceAt(x, y, z) {
    if (y < 0.04) return { n: new T.Vector3(0, 1, 0), c: null };
    let best = null,
      bd = 0.09;
    for (const c of COLLIDERS) {
      if (!(c.h > 0.02)) continue;
      const e = 0.09;
      if (x < c.minX - e || x > c.maxX + e || z < c.minZ - e || z > c.maxZ + e || y > c.h + e || y < (c.y0 || 0) - e) continue;
      const cand = [
        [Math.abs(x - c.minX), -1, 0, 0],
        [Math.abs(x - c.maxX), 1, 0, 0],
        [Math.abs(z - c.minZ), 0, 0, -1],
        [Math.abs(z - c.maxZ), 0, 0, 1],
        [Math.abs(y - c.h), 0, 1, 0],
        ...(c.y0 ? [[Math.abs(y - c.y0), 0, -1, 0]] : []),
      ];
      for (const [d, nx, ny, nz] of cand) d < bd && ((bd = d), (best = { n: new T.Vector3(nx, ny, nz), c }));
    }
    return best;
  }
  function surfColor(c) {
    const m = c && c.mesh && c.mesh.material;
    const col = m && !Array.isArray(m) && m.color ? m.color.clone() : new T.Color(0xb7ae9e);
    return col.lerp(new T.Color(0xffffff), 0.25);
  }
  let _holeTex = null;
  function holeTex() {
    if (_holeTex) return _holeTex;
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    let gr = g.createRadialGradient(32, 32, 0, 32, 32, 31);
    gr.addColorStop(0, "rgba(8,8,8,1)");
    gr.addColorStop(0.2, "rgba(12,11,10,.95)");
    gr.addColorStop(0.32, "rgba(40,34,28,.55)");
    gr.addColorStop(0.62, "rgba(30,26,22,.18)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    g.strokeStyle = "rgba(20,18,16,.55)";
    g.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2,
        l = 12 + Math.random() * 12;
      g.beginPath();
      g.moveTo(32 + Math.cos(a) * 6, 32 + Math.sin(a) * 6);
      g.lineTo(32 + Math.cos(a + 0.2) * l * 0.6, 32 + Math.sin(a + 0.2) * l * 0.6);
      g.lineTo(32 + Math.cos(a) * l, 32 + Math.sin(a) * l);
      g.stroke();
    }
    _holeTex = new T.CanvasTexture(c);
    _holeTex.colorSpace = T.SRGBColorSpace;
    return _holeTex;
  }
  const HOLE_MAT = () =>
    HOLE_MAT.m ||
    (HOLE_MAT.m = new T.MeshBasicMaterial({ map: holeTex(), transparent: !0, depthWrite: !1, polygonOffset: !0, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  const HOLES = [];
  const maxHoles = () => Math.round(70 * Math.min(1.6, Q()));
  function addHole(x, y, z, n) {
    const m = new T.Mesh(G.hole, HOLE_MAT());
    m.position.set(x, y, z).addScaledVector(n, 0.006);
    m.lookAt(_v.set(x, y, z).add(n));
    m.rotateZ(rnd(0, 6.28));
    m.scale.setScalar(rnd(0.11, 0.14));
    m.renderOrder = 1;
    m.userData.noMerge = !0;
    scene.add(m);
    HOLES.push(m);
    while (HOLES.length > maxHoles()) {
      const o = HOLES.shift();
      o.parent && o.parent.remove(o);
    }
  }
  function clearHoles() {
    for (const o of HOLES) o.parent && o.parent.remove(o);
    HOLES.length = 0;
    for (const b of LIVE) b.mesh.parent && b.mesh.parent.remove(b.mesh);
    LIVE.length = 0;
  }
  function wallImpact(x, y, z) {
    const s = surfaceAt(x, y, z);
    if (!s) return; // shot ended in mid-air
    const n = s.n;
    addHole(x, y, z, n);
    const far = !near(x, y, z, 45);
    if (far) return;
    const q = Q(),
      col = surfColor(s.c);
    // sparks: fast, bright, short
    const ns = Math.max(2, Math.round(rnd(4, 7) * q));
    for (let i = 0; i < ns; i++) {
      const sp = glowDot(0xffb45a, rnd(0.05, 0.085), 2.2);
      sp.position.set(x, y, z).addScaledVector(n, 0.02);
      const v = n.clone().multiplyScalar(rnd(2.5, 5.5)).add(new T.Vector3(rnd(-2.6, 2.6), rnd(-1, 2.6), rnd(-2.6, 2.6)));
      addFx(sp, rnd(0.16, 0.3), (e, t, dt) => {
        const d = dt || 0.016;
        v.y -= 14 * d;
        e.position.addScaledVector(v, d);
        e.material.opacity = 1 - t * t;
        e.scale.setScalar(0.075 * (1 - 0.6 * t));
      });
    }
    // dust: soft, slow, surface-coloured
    const nd = Math.max(1, Math.round(2.5 * q));
    for (let i = 0; i < nd; i++) {
      const mat = new T.SpriteMaterial({ map: glowTex(), color: col, transparent: !0, depthWrite: !1, opacity: 0.55 });
      const d = new T.Sprite(mat);
      d.position.set(x, y, z).addScaledVector(n, 0.05);
      const v = n.clone().multiplyScalar(rnd(0.5, 1.3)).add(new T.Vector3(rnd(-0.35, 0.35), rnd(0.05, 0.45), rnd(-0.35, 0.35)));
      const s0 = rnd(0.16, 0.26),
        life = rnd(0.55, 0.9);
      addFx(d, life, (e, t, dt) => {
        const k = dt || 0.016;
        e.position.addScaledVector(v, k);
        v.multiplyScalar(1 - 2.2 * k);
        e.scale.setScalar(s0 * (1 + 2.4 * t));
        e.material.opacity = 0.5 * (1 - t) * (1 - t);
      });
    }
    // chips: a few flecks of the wall itself
    const nc = Math.max(1, Math.round(rnd(2, 4) * q));
    const cm = new T.MeshStandardMaterial({ color: col.clone().multiplyScalar(0.8), roughness: 0.9, transparent: !0 });
    for (let i = 0; i < nc; i++) {
      const c = new T.Mesh(G.chip, cm);
      c.position.set(x, y, z).addScaledVector(n, 0.03);
      c.scale.setScalar(rnd(0.5, 1.2));
      const v = n.clone().multiplyScalar(rnd(1.5, 3.2)).add(new T.Vector3(rnd(-1.4, 1.4), rnd(0.4, 2.2), rnd(-1.4, 1.4)));
      addFx(c, rnd(0.5, 0.8), (e, t, dt) => {
        const k = dt || 0.016;
        v.y -= 12 * k;
        e.position.addScaledVector(v, k);
        e.position.y < 0.02 && ((e.position.y = 0.02), (v.y = Math.abs(v.y) * 0.3), (v.x *= 0.5), (v.z *= 0.5));
        e.rotation.x += 9 * k;
        e.rotation.y += 7 * k;
        e.material.opacity = t > 0.7 ? (1 - t) / 0.3 : 1;
      });
    }
    // a short hot flash right on the surface
    const fl = glowDot(0xffe2a8, 0.22, 2.4);
    fl.position.set(x, y, z).addScaledVector(n, 0.03);
    addFx(fl, 0.07, (e, t) => {
      e.material.opacity = 1 - t;
      e.scale.setScalar(0.22 * (1 + t));
    });
  }
  window.GUNFX = { wallImpact, ejectMine, dropMag, surfaceAt, HOLES, LIVE, clearHoles };

  const WALL_COLS = new Set([16767392, 10135480]);
  let lastPush = null;
  const _ps = impactSpark;
  impactSpark = function (x, y, z, col) {
    const r = _ps.apply(this, arguments);
    try {
      if (WALL_COLS.has(col)) {
        const dup = lastPush && performance.now() - lastPush[3] < 60 && Math.abs(lastPush[0] - x) < 1e-3 && Math.abs(lastPush[1] - y) < 1e-3 && Math.abs(lastPush[2] - z) < 1e-3;
        dup || wallImpact(x, y, z);
      }
    } catch (e) {}
    return r;
  };
  // the host sees every shooter's impacts, not only its own
  const _pf = pushFX;
  pushFX = function (type, x, y, z) {
    const r = _pf.apply(this, arguments);
    try {
      if (type === FX.IMPACT && "client" !== NET.mode) {
        wallImpact(x, y, z);
        lastPush = [x, y, z, performance.now()];
      }
    } catch (e) {}
    return r;
  };

  const _lm = loadMap;
  loadMap = function () {
    clearHoles();
    return _lm.apply(this, arguments);
  };
  const _stR = startRound;
  startRound = function () {
    clearHoles();
    return _stR.apply(this, arguments);
  };


  // ── where it came from: red glow on the edge of the screen, turning with the view ──
  const dir = document.createElement("div");
  dir.id = "hit-dir";
  (document.getElementById("hud") || document.body).appendChild(dir);
  const ds = document.createElement("style");
  ds.textContent = `
#hit-dir{position:absolute;inset:0;pointer-events:none;z-index:7;overflow:hidden}
#hit-dir .hd-edge{position:absolute;inset:0;opacity:0;will-change:opacity}
#hit-dir .hd-arc{position:absolute;left:50%;top:50%;width:180px;height:44px;margin:-22px 0 0 -90px;opacity:0;will-change:transform,opacity;overflow:visible}
#hit-dir .hd-arc path{fill:none;stroke:#ff2a3c;stroke-width:6;stroke-linecap:round;filter:drop-shadow(0 0 6px rgba(255,30,50,.95)) drop-shadow(0 0 14px rgba(255,30,50,.6))}
#hit-dir .hd-arc path.core{stroke:#ffc2c7;stroke-width:1.6;filter:none}
#hit-dir .hd-arc.miss path{stroke:#ffab3d;stroke-width:4;filter:drop-shadow(0 0 6px rgba(255,160,60,.85))}
#hit-dir .hd-arc.miss path.core{display:none}`;
  document.head.appendChild(ds);
  const IND = [];
  function indicate(x, z, amt, key, miss) {
    let d = IND.find((o) => o.key === key && o.miss === miss);
    if (!d) {
      if (IND.length >= 5) {
        const o = IND.shift();
        o.arc.remove();
        o.edge.remove();
      }
      const edge = document.createElement("div");
      edge.className = "hd-edge";
      const arc = document.createElement("div");
      arc.className = "hd-arc" + (miss ? " miss" : "");
      arc.innerHTML = '<svg viewBox="0 0 180 44" width="180" height="44" style="overflow:visible"><path d="M14 38 Q90 -4 166 38"/><path class="core" d="M30 31 Q90 1 150 31"/></svg>';
      dir.append(edge, arc);
      d = { key, miss, edge, arc };
      IND.push(d);
    }
    d.x = x;
    d.z = z;
    d.t = 0;
    d.life = miss ? 0.9 : 1.8;
    d.k = miss ? 0.45 : Math.min(1, 0.55 + (amt || 0) / 60);
  }
  function tickDir(dt) {
    const p = player;
    for (let i = IND.length - 1; i >= 0; i--) {
      const d = IND[i];
      d.t += dt;
      if (d.t >= d.life || !p || !p.alive) {
        d.arc.remove();
        d.edge.remove();
        IND.splice(i, 1);
        continue;
      }
      const dx = d.x - p.pos.x,
        dz = d.z - p.pos.z,
        sy = Math.sin(p.yaw),
        cy = Math.cos(p.yaw),
        f = -dx * sy - dz * cy,
        r = dx * cy - dz * sy,
        a = Math.atan2(r, f);
      const fade = d.t < 0.08 ? d.t / 0.08 : 1 - Math.pow((d.t - 0.08) / (d.life - 0.08), 1.6),
        op = Math.max(0, fade * d.k);
      const R = Math.min(innerWidth, innerHeight) * 0.24;
      d.arc.style.transform = `rotate(${a}rad) translateY(${-R}px)`;
      d.arc.style.opacity = op;
      if (!d.miss) {
        const ex = 50 + Math.sin(a) * 62,
          ey = 50 - Math.cos(a) * 62;
        d.edge.style.background = `radial-gradient(ellipse 55% 60% at ${ex}% ${ey}%,rgba(255,24,44,.62),rgba(255,24,44,.18) 45%,transparent 70%)`;
        d.edge.style.opacity = op;
      }
    }
  }
  const isMine = (a) => a && ("me" === a.ctrl || a === player);
  const _dd2 = dealDamage;
  dealDamage = function (v, amt, head, att) {
    const hp = v ? v.hp : 0;
    const r = _dd2.apply(this, arguments);
    try {
      isMine(v) && att && att !== v && att.pos && v.hp < hp && indicate(att.pos.x, att.pos.z, hp - v.hp, "a" + (att.id != null ? att.id : att.name));
    } catch (e) {}
    return r;
  };
  if ("function" == typeof damageEntity) {
    // legacy solo path: bots are entities, the attacker is whoever is closest in view of us
    const _de = damageEntity;
    damageEntity = function (v, amt, head, src) {
      const hp = v ? v.hp : 0;
      const r = _de.apply(this, arguments);
      try {
        if (v === player && v.hp < hp && src && src.pos) indicate(src.pos.x, src.pos.z, hp - v.hp, "e" + (src.id || src.name));
      } catch (e) {}
      return r;
    };
  }
  // clients hear about their hits from the host
  const _oe2 = NET.onEvent;
  NET.onEvent = (e) => {
    try {
      if (e && "hit" === e.t && !e.kill) {
        const mine = myActor(),
          a = actorById(e.from);
        mine && e.to === mine.id && a && a !== mine && a.pos && indicate(a.pos.x, a.pos.z, e.amt, "a" + a.id);
      }
    } catch (x) {}
    return _oe2(e);
  };
  // near misses: an enemy shot that passes close to your head
  const _ah = actorHitscan;
  actorHitscan = function (e, t, o, a) {
    const r = _ah.apply(this, arguments);
    try {
      const p = player;
      if (p && p.alive && e && e !== p && e.team !== p.team) {
        const hx = p.pos.x - t.x,
          hy = p.y + 1.6 - t.y,
          hz = p.pos.z - t.z,
          u = hx * o.x + hy * o.y + hz * o.z;
        if (u > 0 && u < a.range) {
          const cx = hx - o.x * u,
            cy = hy - o.y * u,
            cz = hz - o.z * u,
            d = Math.hypot(cx, cy, cz);
          d < 1.6 && d > 0.25 && indicate(e.pos.x, e.pos.z, 0, "m" + e.id, !0);
        }
      }
    } catch (x) {}
    return r;
  };
  window.HITDIR = { indicate, IND };
  // your own blood used to burst right in front of the camera as big red blobs
  if ("function" == typeof bloodBurst) {
    const _bb = bloodBurst;
    bloodBurst = function (x, y, z) {
      if (camera && camera.position.distanceToSquared(_v.set(x, y, z)) < 1.6) return;
      return _bb.apply(this, arguments);
    };
  }

  // ── aim-down-sights for non-scoped guns: a sight reticle and shaded edges ──
  const ads = document.createElement("div");
  ads.id = "ads-view";
  ads.innerHTML =
    '<svg class="ads-ret" viewBox="-50 -50 100 100" aria-hidden="true"><circle r="21" class="r1"/><path class="tk" d="M-34 0h-9M34 0h9"/><circle r="1.9" class="dot"/></svg>';
  (document.getElementById("hud") || document.body).appendChild(ads);
  const st = document.createElement("style");
  st.textContent = `
#ads-view{position:absolute;inset:0;pointer-events:none;z-index:5;opacity:0;transition:opacity .14s ease-out;background:radial-gradient(ellipse 62% 70% at 50% 50%,transparent 46%,rgba(0,0,0,.26) 70%,rgba(0,0,0,.62) 100%)}
#ads-view.on{opacity:1}
#ads-view .ads-ret{position:absolute;left:50%;top:50%;width:104px;height:104px;margin:-52px 0 0 -52px;transform:scale(1.25);transition:transform .16s ease-out;filter:drop-shadow(0 0 2px rgba(0,0,0,.8))}
#ads-view.on .ads-ret{transform:scale(1)}
#ads-view .r1{fill:none;stroke:var(--adsc,#7dffc8);stroke-width:1.3;opacity:.75;stroke-dasharray:28 5}
#ads-view .tk{stroke:var(--adsc,#7dffc8);stroke-width:1.8;stroke-linecap:round;opacity:.9}
#ads-view .dot{fill:var(--adsc,#7dffc8)}
body.ads-on #cross{opacity:0!important;transition:opacity .1s}`;
  document.head.appendChild(st);
  function adsColor() {
    try {
      const x = JSON.parse(localStorage.getItem("lgp_xhair") || "{}");
      return x.color || "#7dffc8";
    } catch (e) {
      return "#7dffc8";
    }
  }
  let adsWas = !1,
    lastT = performance.now();
  function frame() {
    const now = performance.now(),
      dt = Math.min(0.05, (now - lastT) / 1e3);
    lastT = now;
    try {
      tickLive(dt);
      tickDir(dt);
      const p = player;
      const k = p && p.weapons ? curWeaponKey() : null;
      const on = !!(p && p.alive && p.ads && !p.ultW && k && "knife" !== k && !isScoped() && "menu" !== world.phase && !p.spectate);
      if (on !== adsWas) {
        adsWas = on;
        on && ads.style.setProperty("--adsc", adsColor());
        ads.classList.toggle("on", on);
        document.body.classList.toggle("ads-on", on);
      }
    } catch (e) {}
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
