(() => {
  // Knife tricks that turn the knife, not the arm. The first-person knife and
  // the hand holding it used to be baked into one mesh, so every spin turned
  // the whole arm. Now the knife hangs on a pivot and the hand and arm stay:
  // the pivot is at the middle of the grip for most knives and at the RING for
  // the karambit (it spins on the index finger through its ring, as the real
  // one does). Every knife has its own inspect, built from what people do with
  // it:
  //   combat knife — one spin round the fingers, a toss with it
  //   butterfly — the handles whirl round the pin, a rollover along the
  //               blade, an aerial
  //   flip knife — closed with a flick and flicked open again, twice, then
  //                tossed flat in the palm
  //   tanto — turned blade-down into a reverse grip, a stab, and back
  //   kukri — a heavy windmill that ends in a chop
  //   karambit — a chain on the finger: two forward spins, a back flip, a flat
  //              "helicopter", then thrown up with two flips and caught by the
  //              ring, with light trails behind the blade and a chime on the catch
  // Fingers close round the grip and open while the knife is turning.
  // Looks only: nothing about a cut changes.
  if ("function" != typeof vmWithHands || "function" != typeof vmArm || "undefined" == typeof VM || "function" != typeof tickViewmodel) return;
  const PI = Math.PI,
    c01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x),
    seg = (t, a, b) => c01((t - a) / (b - a)),
    ezS = (x) => x * x * (3 - 2 * x),
    ezIO = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    bump = (k) => Math.sin(c01(k) * PI);
  // seconds for each knife's inspect
  const INSPECT = { "": 2.7, butterfly: 3.2, flip: 3.0, tanto: 2.9, kukri: 3.0, karambit: 4.0 };
  // seconds for the little trick each knife does now and then while it is held still
  const IDLE_D = { "": 0.65, butterfly: 0.9, flip: 0.7, tanto: 1.0, kukri: 1.0, karambit: 1.1 };
  window.KNIVES && ((KNIVES.inspD = (m) => INSPECT[m || ""] || 2.7), (KNIVES.idleD = (m) => IDLE_D[m || ""] || 0.65));

  // ── the rig ──
  let building = !1;
  const _arm = vmArm;
  vmArm = function (parent) {
    const n0 = parent && parent.children ? parent.children.length : 0;
    const r = _arm.apply(this, arguments);
    if (building && parent && parent.children) for (let i = n0; i < parent.children.length; i++) parent.children[i].userData.armPart = 1;
    return r;
  };
  const isHand = (x) => x.isMesh && x.geometry && "SphereGeometry" === x.geometry.type && x.geometry.parameters && Math.abs(x.geometry.parameters.radius - 0.043) < 0.006;
  const live = (m) => ((m.userData.live = !0), (m.renderOrder = 999), (m.frustumCulled = !1), (m.castShadow = m.receiveShadow = !1), m);
  function rig(o, m) {
    o.updateMatrixWorld(!0);
    let hand = null;
    o.traverse((x) => !hand && isHand(x) && (hand = x));
    const grip = new T.Vector3();
    if (hand) {
      hand.getWorldPosition(grip);
      o.worldToLocal(grip);
    }
    // the karambit turns about its ring, the rest about the grip
    const at = grip.clone();
    if ("karambit" === m) {
      let ring = null;
      o.traverse((x) => x.userData && "spin" === x.userData.kpart && (ring = x));
      if (ring) {
        ring.getWorldPosition(at);
        o.worldToLocal(at);
      }
    }
    const pv = new T.Group();
    pv.name = "knife-pivot";
    pv.rotation.order = "YXZ";
    pv.position.copy(at);
    o.add(pv);
    pv.updateMatrixWorld(!0);
    const fist = o.userData.fist;
    for (const c of o.children.slice()) c === pv || c.userData.armPart || c === fist || pv.attach(c);
    pv.traverse((x) => x.isMesh && (x.userData.live = !0));
    pv.userData.p0 = pv.position.clone();
    pv.userData.hand = !!hand;
    pv.userData.grip = grip.clone();
    o.userData.kpivot = pv;
    const glove = hand && hand.material ? hand.material : new T.MeshStandardMaterial({ color: 0x262a31, roughness: 0.5 });
    const cyl = (r, len, x, y, z, rx, ry, rz) => {
      const c = new T.Mesh(new T.CylinderGeometry(r, r, len, 10), glove);
      c.position.set(x, y, z);
      c.rotation.set(rx || 0, ry || 0, rz || 0);
      return live(c);
    };
    const ball = (r, x, y, z) => {
      const b = new T.Mesh(new T.SphereGeometry(r, 10, 8), glove);
      b.position.set(x, y, z);
      return live(b);
    };
    // fingers: curled round the grip of the knives held the usual way
    if ("karambit" !== m) {
      const fg = new T.Group();
      fg.position.copy(grip);
      for (let i = 0; i < 4; i++) {
        const z = (i - 1.5) * 0.0185;
        fg.add(cyl(0.0105, 0.056, 0, -0.03, z, 0, 0, PI / 2));
        fg.add(ball(0.0112, -0.028, -0.024, z));
        fg.add(ball(0.0108, 0.028, -0.026, z));
      }
      const th = cyl(0.0105, 0.05, -0.016, 0.03, -0.035, PI / 2 - 0.25, 0, 0);
      fg.add(th, ball(0.0112, -0.016, 0.03, -0.062));
      o.add(fg);
      o.userData.fingers = fg;
    } else {
      // the index finger through the ring, and its knuckle down to the fist
      const fg = new T.Group();
      fg.add(cyl(0.0125, 0.1, at.x, at.y, at.z, 0, 0, PI / 2));
      fg.add(cyl(0.0135, Math.max(0.02, at.y - grip.y), at.x, (at.y + grip.y) / 2, at.z - 0.002, 0, 0, 0));
      fg.add(ball(0.0135, at.x - 0.052, at.y, at.z));
      o.add(fg);
      o.userData.ringFinger = fg;
      // light trails: copies of the knife that lag behind it while it spins
      const glow = (window.GUN_SKINS && GUN_SKINS.of && GUN_SKINS.of("knife") && GUN_SKINS.of("knife").glow) || 0x7fdcff;
      const ghosts = [],
        originals = pv.children.slice();
      for (let i = 1; i <= 3; i++) {
        const g = new T.Group();
        const mat = new T.MeshBasicMaterial({ color: glow, transparent: !0, opacity: 0, blending: T.AdditiveBlending, depthWrite: !1, fog: !1 });
        for (const c of originals) {
          const cl = c.clone(!0);
          cl.traverse((x) => x.isMesh && ((x.material = mat), live(x)));
          g.add(cl);
        }
        g.visible = !1;
        g.rotation.order = "YXZ";
        pv.add(g);
        ghosts.push({ g, mat, lag: 0.011 * i, w: 0.4 / i });
      }
      pv.userData.ghosts = ghosts;
    }
    return pv;
  }
  const _vwh = vmWithHands;
  vmWithHands = function (e, t) {
    if ("knife" !== t) return _vwh.apply(this, arguments);
    building = !0;
    let o;
    try {
      o = _vwh.apply(this, arguments);
    } finally {
      building = !1;
    }
    try {
      o && rig(o, window.KNIVES ? KNIVES.model() : "");
    } catch (err) {
      console.warn("knife pivot", err);
    }
    return o;
  };
  // knives built before this ran had no pivot
  try {
    VM.current && VM.root.remove(VM.current);
    VM.current = null;
    for (const k in VM.cache) /^knife\|/.test(k) && delete VM.cache[k];
  } catch (e) {}

  // every frame starts with the knife straight in the hand
  const pivotOf = (a) => (a && a.userData && a.userData.kpivot) || null;
  const _uv = updateViewmodel;
  updateViewmodel = function () {
    const r = _uv.apply(this, arguments);
    const pv = pivotOf(VM.current);
    if (pv) {
      pv.rotation.set(0, 0, 0);
      pv.position.copy(pv.userData.p0);
    }
    return r;
  };
  // a spin for other modules: turns the knife on its pivot (or the whole gun, for anything else)
  window.KNIFE_PIVOT = {
    of: pivotOf,
    spin(a, axis, ang) {
      const pv = pivotOf(a);
      (pv || a).rotation[axis] += ang;
      return !!pv;
    },
  };

  // ── sounds ──
  const chime = () => {
    try {
      const c = GAME_AUDIO.context(),
        t0 = c.currentTime;
      for (const [f, v, d] of [[2093, 0.1, 0.5], [3136, 0.05, 0.35], [4186, 0.03, 0.25]]) {
        const o = c.createOscillator(),
          g = c.createGain();
        o.type = "sine";
        o.frequency.value = f;
        g.gain.setValueAtTime(1e-4, t0);
        g.gain.exponentialRampToValueAtTime(v, t0 + 0.004);
        g.gain.exponentialRampToValueAtTime(1e-4, t0 + d);
        o.connect(g);
        g.connect(GAME_AUDIO.output);
        o.start(t0);
        o.stop(t0 + d + 0.02);
      }
    } catch (e) {}
  };
  const swish = () => {
    try {
      window.SKIN_PERKS && SKIN_PERKS.swish && SKIN_PERKS.swish();
    } catch (e) {}
  };

  // ── each knife's trick, by the second of its inspect ──
  // every one starts and ends with the knife as it is held: rotations come back to a whole turn
  // t = { rx, ry, rz, px, py, pz, open, hA, hB, blade }
  const SHOW = {
    // the combat knife: round the fingers, thrown a little
    "": (s, t) => {
      const k = seg(s, 0.6, 1.5);
      t.rx = 2 * PI * ezIO(k);
      t.py = 0.035 * bump(k);
      t.open = 0.6 * bump(seg(s, 0.55, 1.55));
    },
    // the balisong: the handles whirl round the pin, a rollover, an aerial
    butterfly: (s, t) => {
      const f = ezIO(seg(s, 0.45, 1.35));
      t.hA = 4 * PI * f;
      t.hB = -4 * PI * f;
      t.rz = 2 * PI * ezIO(seg(s, 1.45, 2.15));
      const k = seg(s, 2.25, 2.85);
      t.rx = 2 * PI * ezIO(k);
      t.py = 0.12 * bump(k);
      t.open = 0.5 * bump(seg(s, 1.4, 2.2)) + bump(seg(s, 2.2, 2.9));
    },
    // the flipper: flicked shut and open twice, then tossed flat
    flip: (s, t) => {
      const shut1 = ezS(seg(s, 0.4, 0.66)),
        open1 = ezS(seg(s, 0.66, 0.76)),
        shut2 = ezS(seg(s, 0.92, 1.12)),
        open2 = ezS(seg(s, 1.12, 1.2));
      t.blade = PI * (shut1 - open1 + shut2 - open2);
      const k = seg(s, 1.65, 2.3);
      t.ry = 2 * PI * ezIO(k);
      t.py = 0.09 * bump(k);
      t.open = bump(seg(s, 1.6, 2.35));
    },
    // the tanto: blade down into a reverse grip, a stab, and back over
    tanto: (s, t) => {
      t.rx = PI * ezS(seg(s, 0.5, 0.9)) + PI * ezS(seg(s, 1.6, 2.05));
      t.pz = -0.07 * bump(seg(s, 1.1, 1.4));
      t.py = -0.03 * bump(seg(s, 1.1, 1.4)) + 0.025 * bump(seg(s, 1.6, 2.05));
      t.open = 0.5 * (bump(seg(s, 0.45, 0.95)) + bump(seg(s, 1.55, 2.1)));
    },
    // the kukri: heavy, a windmill that ends in a chop
    kukri: (s, t) => {
      const k = seg(s, 0.55, 1.6);
      t.rx = 2 * PI * ezIO(k) * (1 - 0.0);
      t.rx -= 0.28 * bump(seg(s, 1.6, 1.85));
      t.py = -0.035 * bump(seg(s, 1.6, 1.85)) + 0.03 * bump(k);
      t.open = 0.4 * bump(seg(s, 0.5, 1.65));
    },
    // the karambit: a chain on the finger
    karambit: (s, t) => {
      const A = seg(s, 0.45, 1.15), // two forward spins
        B = seg(s, 1.22, 1.68), // a back flip
        up = seg(s, 1.75, 2.0), // the blade levels out
        H = seg(s, 2.0, 2.8), // the helicopter: flat, two turns
        dn = seg(s, 2.8, 3.05), // and back down
        X = seg(s, 3.12, 3.72); // thrown, two flips, caught
      t.rx = 4 * PI * ezIO(A) - 2 * PI * ezIO(B) + (PI / 2) * (ezS(up) - ezS(dn)) + 4 * PI * ezIO(X);
      t.ry = 4 * PI * ezIO(H);
      t.py = 0.17 * bump(X) - 0.014 * bump(seg(s, 3.72, 3.88)) + 0.02 * bump(A) + 0.015 * bump(B);
      // the fist opens for the whole chain, the finger stays in the ring
      t.open = ezS(seg(s, 0.4, 0.55)) * (1 - ezS(seg(s, 3.7, 3.9)));
    },
  };
  // the short ones, k from 0 to 1 (the karambit does a different one each time)
  const IDLE_SHOW = {
    "": (k, t) => {
      t.rx = 2 * PI * ezIO(k);
      t.py = 0.025 * bump(k);
      t.open = 0.5 * bump(k);
    },
    butterfly: (k, t) => {
      const f = ezIO(k);
      t.hA = 2 * PI * f;
      t.hB = -2 * PI * f;
      t.open = 0.3 * bump(k);
    },
    flip: (k, t) => {
      t.blade = PI * (ezS(seg(k, 0, 0.45)) - ezS(seg(k, 0.45, 0.6)));
    },
    tanto: (k, t) => {
      t.rx = 2 * PI * ezIO(k);
      t.open = 0.5 * bump(k);
    },
    kukri: (k, t, n) => {
      t.rx = 2 * PI * ezIO(k);
      t.py = -0.02 * bump(seg(k, 0.8, 1)) + 0.02 * bump(k);
      t.open = 0.4 * bump(k);
    },
    karambit: (k, t, n) => {
      const v = n % 3;
      if (0 === v) t.rx = 4 * PI * ezIO(k); // two forward spins
      else if (1 === v) {
        // a back flip, then a flat turn
        t.rx = -2 * PI * ezIO(seg(k, 0, 0.5)) + 2 * PI * 0;
        t.ry = 2 * PI * ezIO(seg(k, 0.5, 1));
      } else {
        // thrown a little and caught
        t.rx = 2 * PI * ezIO(k);
        t.py = 0.1 * bump(k);
      }
      t.open = ezS(seg(k, 0, 0.12)) * (1 - ezS(seg(k, 0.88, 1)));
    },
  };
  const TR = { rx: 0, ry: 0, rz: 0, px: 0, py: 0, pz: 0, open: 0, hA: 0, hB: 0, blade: 0 };
  const S = { prevS: -1, half: 0, prev: { x: 0, y: 0, z: 0 }, speed: 0, caught: !1, idleN: 0, idleWas: !1 };
  function trick(dt) {
    const a = VM.current,
      pv = pivotOf(a),
      M = window.SKIN_PERKS && SKIN_PERKS.state;
    if (!pv || !M || !player.alive || player.ultW || "knife" !== curWeaponKey()) return;
    const m = window.KNIVES ? KNIVES.model() : "",
      kp = KNIVES.parts(a),
      fn = SHOW[m];
    for (const k in TR) TR[k] = 0;
    const idleOn = !(M.insp.t >= 0) && window.KNIVES && KNIVES.idle && KNIVES.idle.anim >= 0 && IDLE_SHOW[m];
    idleOn && !S.idleWas && S.idleN++;
    S.idleWas = !!idleOn;
    const on = (M.insp.t >= 0 && fn) || idleOn;
    if (on) {
      idleOn ? IDLE_SHOW[m](c01(KNIVES.idle.anim / KNIVES.idleD(m)), TR, S.idleN) : fn(M.insp.t, TR);
      const R = pv.rotation,
        P = pv.position;
      R.x += TR.rx;
      R.y += TR.ry;
      R.z += TR.rz;
      P.x += TR.px;
      P.y += TR.py;
      P.z += TR.pz;
      kp.hA && (kp.hA.rotation.x = TR.hA);
      kp.hB && (kp.hB.rotation.x = TR.hB);
      kp.blade && TR.blade && (kp.blade.rotation.x = TR.blade);
    }
    // the fingers close on the grip and open while the knife turns
    const open = on ? c01(TR.open) : 0,
      fg = a.userData.fingers;
    fg && fg.scale.set(1 - 0.2 * open, 1 - 0.85 * open, 1 - 0.2 * open);
    if (on && a.userData.fist && open > 0) a.userData.fist.scale.set(1 - 0.3 * open, 1 - 0.92 * open, 1 - 0.3 * open);
    // the swishes: one for every half turn of the karambit and the flipped knives
    const spinning = on ? Math.abs(pv.rotation.x) + Math.abs(pv.rotation.y) + Math.abs(pv.rotation.z) : 0;
    const half = Math.floor(spinning / PI);
    if (!on) S.half = 0;
    else if (half !== S.half) {
      (half > S.half || half < S.half) && swish();
      S.half = half;
    }
    // the catch
    if (on && "karambit" === m) {
      const s = M.insp.t;
      s >= 3.7 && !S.caught && ((S.caught = !0), chime());
      s < 3.7 && (S.caught = !1);
    } else S.caught = !1;
    // trails behind a fast-turning karambit
    const gh = pv.userData.ghosts;
    if (gh) {
      const R = pv.rotation,
        d = Math.max(dt, 0.004),
        wx = (R.x - S.prev.x) / d,
        wy = (R.y - S.prev.y) / d,
        wz = (R.z - S.prev.z) / d;
      S.prev.x = R.x;
      S.prev.y = R.y;
      S.prev.z = R.z;
      const sp = Math.min(40, Math.hypot(wx, wy, wz));
      S.speed += (sp - S.speed) * Math.min(1, 14 * dt);
      const f = c01((S.speed - 6) / 14);
      for (const g of gh) {
        g.g.visible = f > 0.02;
        g.mat.opacity = g.w * f;
        const lg = Math.min(0.75, g.lag * S.speed);
        const k = S.speed > 0.01 ? lg / S.speed : 0;
        g.g.rotation.set(-wx * k, -wy * k, -wz * k);
      }
    }
  }
  const _tick = tickViewmodel;
  tickViewmodel = function (dt) {
    const r = _tick.apply(this, arguments);
    try {
      trick(dt || 0.016);
    } catch (e) {
      window.__knifeErr = e;
    }
    return r;
  };
  window.KNIFE_TRICKS = { SHOW, IDLE_SHOW, INSPECT, IDLE_D, S };
})();
