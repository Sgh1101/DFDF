(() => {
  // Knife tricks, done the way a hand does them. The knife hangs on a pivot in the fingers (at the middle of
  // the grip, or at the RING for the karambit, which spins on the index finger through it), and the arm moves
  // with it: the hand is brought up to look at the knife, the forearm rolls to show one flat and then the other,
  // and every trick is driven by the wrist —
  //   a spin round the fingers: the wrist cocks the other way, flicks, and gives a little when the fingers
  //     catch the knife, which knocks against them and settles;
  //   a toss: the hand dips to load, drives up and lets go, waits under the knife (which flies on a parabola,
  //     turning at an even rate about its own centre of mass, as a thrown thing does), rises a touch to meet it
  //     and gives on the catch.
  // The hand is never quite still while it holds the knife up (a slow drift, as breathing gives), and it comes
  // in with a little overshoot and goes out with a little lift first. Every knife has its own inspect:
  //   combat knife — both flats, one spin round the fingers
  //   butterfly — the handles fanned round the pin by the wrist, a rollover, an aerial
  //   flip knife — flicked shut and open twice (a click on each lock), tossed flat
  //   tanto — flipped into a reverse grip, a downward stab, flipped back
  //   kukri — heavy: a windmill with the whole arm, ending in a chop
  //   karambit — a chain on the ring finger: two spins with the wrist circling, a back flip, a flat
  //              "helicopter", then thrown up with two flips and caught by the ring (trails, a chime)
  //   bayonet, gut, bowie, kunai, stiletto — see SHOW below
  // Looks only: nothing about a cut changes.
  if ("function" != typeof vmWithHands || "function" != typeof vmArm || "undefined" == typeof VM || "function" != typeof tickViewmodel) return;
  const PI = Math.PI,
    c01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x),
    seg = (t, a, b) => c01((t - a) / (b - a)),
    ezS = (x) => x * x * (3 - 2 * x),
    ezIO = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    bump = (k) => Math.sin(c01(k) * PI);
  // seconds for each knife's inspect (the hand comes down over the last 0.64)
  const INSPECT = { "": 3.4, butterfly: 4.2, flip: 3.7, tanto: 3.7, kukri: 3.8, karambit: 5.1, bayonet: 3.9, gut: 3.9, bowie: 3.9, kunai: 4.1, stiletto: 4.7 };
  // seconds for the little trick each knife does now and then while it is held still
  const IDLE_D = { "": 0.95, butterfly: 1.15, flip: 0.95, tanto: 1.05, kukri: 1.2, karambit: 1.35, bayonet: 1.05, gut: 1.05, bowie: 1.2, kunai: 1.2, stiletto: 1.25 };
  // the knives that leave light trails when they turn fast (the legendary ones)
  const TRAILS = { karambit: 1, stiletto: 1 };
  // the second of the inspect at which the karambit lands back on the finger (the chime)
  const CATCH = { karambit: 4.37 };
  window.KNIVES && ((KNIVES.inspD = (m) => INSPECT[m || ""] || 3.4), (KNIVES.idleD = (m) => IDLE_D[m || ""] || 0.95));

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
    // the knife's centre (where it turns about when it flies), seen from the pivot
    try {
      const bb = new T.Box3().setFromObject(pv);
      bb.isEmpty() || (pv.userData.com = pv.worldToLocal(bb.getCenter(new T.Vector3())));
    } catch (e) {}
    pv.userData.hand = !!hand;
    pv.userData.grip = grip.clone();
    // a knife with a ring it turns on (the kunai): where the ring is, seen from the pivot
    let rg = null;
    pv.traverse((x) => x.userData && "ring" === x.userData.kpart && (rg = x));
    if (rg && "karambit" !== m) {
      const w = new T.Vector3();
      rg.getWorldPosition(w);
      pv.userData.ring = pv.worldToLocal(w);
    }
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
    }
    // light trails: copies of the knife that lag behind it while it spins
    if (TRAILS[m]) {
      const glow = (window.GUN_SKINS && GUN_SKINS.of && GUN_SKINS.of("knife") && GUN_SKINS.of("knife").glow) || 0x7fdcff;
      const ghosts = [],
        originals = pv.children.slice();
      for (let i = 1; i <= 3; i++) {
        const g = new T.Group();
        const mat = new T.MeshBasicMaterial({ color: glow, transparent: !0, opacity: 0, blending: T.AdditiveBlending, depthWrite: !1, fog: !1 });
        for (const c of originals) {
          const cl = c.clone(!0);
          // (the copies' moving parts are renamed, so the knife's own parts are found and not these)
          cl.traverse((x) => (x.isMesh && ((x.material = mat), live(x)), x.userData && x.userData.kpart && ((x.userData.ghostPart = x.userData.kpart), delete x.userData.kpart)));
          g.add(cl);
        }
        g.visible = !1;
        g.rotation.order = "YXZ";
        pv.add(g);
        let gb = null;
        g.traverse((x) => x.userData && "blade" === x.userData.ghostPart && (gb = x));
        ghosts.push({ g, mat, lag: 0.011 * i, w: 0.4 / i, blade: gb });
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

  // ── curves ──
  const TAU = 2 * PI;
  // in-out with a touch of anticipation and overshoot (c: how much)
  const backIO = (x, c) => {
    x = c01(x);
    const c2 = (c == null ? 0.9 : c) * 1.525;
    return x < 0.5 ? (Math.pow(2 * x, 2) * ((c2 + 1) * 2 * x - c2)) / 2 : (Math.pow(2 * x - 2, 2) * ((c2 + 1) * (2 * x - 2) + c2) + 2) / 2;
  };
  // out, arriving a little past and settling back
  const backO = (x, c) => {
    x = c01(x);
    c = c == null ? 1 : c;
    return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
  };
  // a knock that dies out: 0 at the start, swings to +1 side first, exactly 0 again after len seconds
  const wob = (tau, len, w) => (tau <= 0 || tau >= len ? 0 : Math.sin((w || 24) * tau) * Math.exp((-4 * tau) / len) * (1 - tau / len));
  // a flick round the fingers: speeds up fast, turns, is slowed by the fingers (0..1)
  const spinK = (x) => {
    x = c01(x);
    const a = 0.18,
      d = 0.32,
      v = 1 / (1 - a / 2 - d / 2);
    return x < a ? (v * x * x) / (2 * a) : x < 1 - d ? v * (a / 2 + x - a) : 1 - (v * (1 - x) * (1 - x)) / (2 * d);
  };
  // keyframes [[t, v], ...]: a smooth curve through them (Catmull-Rom; flat at the first and last)
  const kf = (K, x) => {
    const n = K.length;
    if (x <= K[0][0]) return K[0][1];
    if (x >= K[n - 1][0]) return K[n - 1][1];
    let i = 0;
    while (x > K[i + 1][0]) i++;
    const m = (j) => (0 === j || j === n - 1 ? 0 : (K[j + 1][1] - K[j - 1][1]) / (K[j + 1][0] - K[j - 1][0]));
    const t0 = K[i][0],
      h = K[i + 1][0] - t0,
      u = (x - t0) / h,
      u2 = u * u,
      u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * K[i][1] + (u3 - 2 * u2 + u) * h * m(i) + (-2 * u3 + 3 * u2) * K[i + 1][1] + (u3 - u2) * h * m(i + 1);
  };

  // ── the moves ──
  // T: the knife in the fingers { rx, ry, rz (turns on the pivot), px, py, pz, open (the fingers), hA, hB (the
  //    balisong's handles), blade (a folding blade), slide (the stiletto's blade in), about ("ring": turn on the
  //    kunai's ring), com (1: turn about the knife's centre of mass, in the air) }
  // A: the arm, about the hand { x, y, z (metres, screen space), pitch (+ tip up), yaw (+ tip left), roll (about
  //    the forearm, as the forearm turns) }
  // which way the wrist flicks for a turn about each axis
  const WR = { rx: "pitch", ry: "yaw", rz: "roll" };
  // the hand brought up to look at the knife: in with a little overshoot, out with a little lift first; never quite still
  function hold(s, D, A, P) {
    const e = backO(seg(s, 0.02, 0.62), 0.9) * (1 - backIO(seg(s, D - 0.64, D - 0.02), 0.5));
    for (const k in P) A[k] += P[k] * e;
    A.x += e * 0.0025 * Math.sin(s * 3.1);
    A.y += e * 0.0035 * Math.sin(s * 2.3 + 1);
    A.pitch += e * 0.014 * Math.sin(s * 2.7 + 2);
    A.yaw += e * 0.01 * Math.sin(s * 1.6 + 3);
    A.roll += e * 0.02 * Math.sin(s * 1.9 + 0.5);
    return e;
  }
  // a turn of the forearm (or the hand) to look at the knife another way; it goes back as the hand comes down
  const look = (A, e, s, t0, dur, ch, v) => (A[ch] += v * e * backIO(seg(s, t0, t0 + dur), 0.6));
  // spun round the fingers: turns (whole or half) about an axis, starting at t0
  function spin(s, t0, dur, ax, turns, T, A, w) {
    w = null == w ? 1 : w;
    const dir = turns < 0 ? -1 : 1;
    T[ax] += turns * TAU * spinK((s - t0) / dur) + dir * 0.17 * wob(s - t0 - dur, 0.38);
    A[WR[ax]] += dir * w * kf([[t0 - 0.18, 0], [t0 - 0.03, -0.16], [t0 + 0.1, 0.13], [t0 + 0.7 * dur, 0.02], [t0 + dur + 0.06, -0.04], [t0 + dur + 0.36, 0]], s);
    A.y += w * kf([[t0 - 0.18, 0], [t0 - 0.03, -0.006], [t0 + 0.12, 0.008], [t0 + dur, 0], [t0 + dur + 0.07, -0.007], [t0 + dur + 0.36, 0]], s);
    T.open += 0.75 * kf([[t0 - 0.04, 0], [t0 + 0.06, 1], [t0 + dur - 0.06, 1], [t0 + dur + 0.04, 0]], s);
  }
  // spun on a finger through a ring (the karambit's, the kunai's): the wrist circles to keep it going
  function ringSpin(s, t0, dur, turns, T, A, ring) {
    spin(s, t0, dur, "rx", turns, T, A, 0.5);
    const ang = turns * TAU * spinK((s - t0) / dur),
      on = bump(seg(s, t0, t0 + dur));
    A.pitch += 0.05 * on * Math.sin(ang);
    A.yaw += 0.035 * on * Math.sin(ang + 1.2);
    A.y += 0.006 * on * Math.sin(ang + 0.4);
    ring && s > t0 - 0.2 && s < t0 + dur + 0.4 && (T.about = "ring");
  }
  // thrown up and caught: h metres high, turns about ax while it flies (hv: how heavy)
  function toss(s, t0, dur, ax, turns, h, T, A, hv) {
    hv = hv || 1;
    const x = (s - t0) / dur,
      dir = turns < 0 ? -1 : 1;
    if (x > 0 && x < 1) {
      T.py += 4 * h * x * (1 - x);
      T[ax] += turns * TAU * x;
      T.com = 1;
    } else if (x >= 1) T[ax] += turns * TAU;
    T[ax] += dir * 0.12 * wob(s - t0 - dur, 0.34);
    A.y += kf([[t0 - 0.26, 0], [t0 - 0.07, -0.02 * hv], [t0 + 0.05, 0.016], [t0 + 0.2, -0.004], [t0 + dur - 0.1, 0.008], [t0 + dur + 0.06, -0.026 * hv], [t0 + dur + 0.42, 0]], s);
    A[WR[ax]] += dir * kf([[t0 - 0.26, 0], [t0 - 0.07, -0.12], [t0 + 0.04, 0.15], [t0 + 0.24, 0], [t0 + dur, 0.02], [t0 + dur + 0.08, -0.07 * hv], [t0 + dur + 0.42, 0]], s);
    T.open += kf([[t0 - 0.06, 0], [t0 + 0.03, 1], [t0 + dur - 0.05, 1], [t0 + dur + 0.04, 0]], s);
  }
  // a folding blade flicked shut (to = 1) or open (to = 0) at t0: it hits the stop and bounces
  function fold(s, t0, shut, T, A) {
    const x = c01((s - t0) / 0.13),
      sg = shut ? 1 : -1;
    T.blade += sg * (PI * x * x - 0.1 * wob(s - t0 - 0.13, 0.22));
    A.pitch += sg * kf([[t0 - 0.12, 0], [t0 - 0.02, 0.07], [t0 + 0.08, -0.11], [t0 + 0.32, 0]], s);
  }
  // a click of the wrist (a blade going in or out): a tiny jerk
  const jerk = (s, t, A) => (A.pitch += 0.03 * wob(s - t, 0.2, 40));
  // the balisong's handles fanned round the pin, turns of them; the wrist rolls back and forth to swing them
  function fan(s, t0, dur, turns, T, A) {
    const x = seg(s, t0, t0 + dur),
      a = turns * TAU * spinK(x);
    T.hA += a;
    T.hB -= a;
    A.roll += 0.3 * Math.sin(a) * bump(x);
    A.y += 0.006 * Math.abs(Math.sin(a)) * bump(x);
    T.open += 0.5 * bump(x);
  }
  // the hand thrust down and forward (a stab), or brought down hard (a chop)
  const stab = (s, t0, A, k) => {
    k = k || 1;
    A.y += k * kf([[t0, 0], [t0 + 0.12, 0.02], [t0 + 0.26, -0.05], [t0 + 0.42, -0.04], [t0 + 0.72, 0]], s);
    A.z += k * kf([[t0, 0], [t0 + 0.12, 0.02], [t0 + 0.26, -0.07], [t0 + 0.42, -0.06], [t0 + 0.72, 0]], s);
    A.pitch += k * kf([[t0, 0], [t0 + 0.12, 0.08], [t0 + 0.26, -0.12], [t0 + 0.42, -0.1], [t0 + 0.72, 0]], s);
  };

  // how the hand holds each knife up to look at it
  const P0 = { x: -0.09, y: 0.06, z: 0.11, yaw: 0.95, pitch: 0.2, roll: -0.6 };
  const POSE = {
    "": P0,
    butterfly: { x: -0.09, y: 0.06, z: 0.11, yaw: 0.85, pitch: 0.16, roll: -0.45 },
    flip: P0,
    tanto: P0,
    kukri: { x: -0.08, y: 0.05, z: 0.1, yaw: 0.95, pitch: 0.26, roll: -0.7 },
    karambit: { x: -0.08, y: 0.08, z: 0.1, yaw: 0.45, pitch: 0.12, roll: -0.5 },
    bayonet: { x: -0.09, y: 0.06, z: 0.11, yaw: 1.1, pitch: 0.18, roll: -0.6 },
    gut: P0,
    bowie: { x: -0.08, y: 0.055, z: 0.11, yaw: 1.05, pitch: 0.22, roll: -0.65 },
    kunai: P0,
    stiletto: P0,
  };

  // ── each knife's inspect, by the second ──
  // every one starts and ends with the knife as it is held: its turns come back to whole turns, the arm to rest
  const SHOW = {
    // the combat knife: one flat, the other, one spin round the fingers
    "": (s, T, A, D) => {
      const e = hold(s, D, A, POSE[""]);
      // the other flat: the forearm turns in and the wrist drops (worked out so the tip still points left)
      look(A, e, s, 0.95, 0.55, "roll", -1.75);
      look(A, e, s, 0.95, 0.55, "pitch", -0.45);
      look(A, e, s, 1.75, 0.5, "roll", 1.75);
      look(A, e, s, 1.75, 0.5, "pitch", 0.45);
      spin(s, 2.25, 0.42, "rx", 1, T, A);
    },
    // the balisong: the handles fanned twice round the pin, a rollover along the blade, an aerial
    butterfly: (s, T, A, D) => {
      hold(s, D, A, POSE.butterfly);
      fan(s, 0.75, 0.95, 2, T, A);
      spin(s, 2.0, 0.55, "rz", 1, T, A);
      toss(s, 2.95, 0.5, "rx", 1, 0.12, T, A);
    },
    // the flipper: flicked shut and open twice, then tossed flat
    flip: (s, T, A, D) => {
      const e = hold(s, D, A, POSE.flip);
      look(A, e, s, 0.6, 0.4, "roll", -0.8);
      fold(s, 0.95, 1, T, A);
      fold(s, 1.2, 0, T, A);
      fold(s, 1.55, 1, T, A);
      fold(s, 1.75, 0, T, A);
      toss(s, 2.35, 0.5, "ry", 1, 0.09, T, A);
    },
    // the tanto: flipped blade-down into a reverse grip, a stab, flipped back
    tanto: (s, T, A, D) => {
      const e = hold(s, D, A, POSE.tanto);
      look(A, e, s, 0.75, 0.45, "roll", -1.0);
      look(A, e, s, 0.75, 0.45, "pitch", -0.25);
      spin(s, 1.4, 0.3, "rx", 0.5, T, A);
      stab(s, 1.85, A);
      spin(s, 2.65, 0.3, "rx", 0.5, T, A);
    },
    // the kukri: heavy; a windmill with the whole arm that ends in a chop
    kukri: (s, T, A, D) => {
      const e = hold(s, D, A, POSE.kukri);
      look(A, e, s, 0.7, 0.5, "roll", -1.0);
      look(A, e, s, 0.7, 0.5, "pitch", -0.25);
      spin(s, 1.4, 0.7, "rx", 1, T, A, 1.5);
      const x = seg(s, 1.4, 2.1);
      A.x -= 0.03 * Math.sin(TAU * x);
      A.y += 0.016 * (1 - Math.cos(TAU * x));
      stab(s, 2.2, A, 1.3);
    },
    // the karambit: a chain on the finger
    karambit: (s, T, A, D) => {
      hold(s, D, A, POSE.karambit);
      ringSpin(s, 0.8, 0.75, 2, T, A);
      spin(s, 1.8, 0.42, "rx", -1, T, A, 0.7);
      // the blade levels out for the helicopter, and drops back after it
      T.rx += (PI / 2) * (ezS(seg(s, 2.3, 2.5)) - ezS(seg(s, 3.35, 3.55)));
      spin(s, 2.5, 0.8, "ry", 2, T, A, 0.8);
      toss(s, 3.75, 0.62, "rx", 2, 0.17, T, A);
    },
    // the bayonet: turned to look down the flat, both sides, flipped round the fingers, flicked into a reverse
    // grip and back
    bayonet: (s, T, A, D) => {
      const e = hold(s, D, A, POSE.bayonet);
      look(A, e, s, 0.85, 0.5, "roll", -1.75);
      look(A, e, s, 0.85, 0.5, "pitch", -0.45);
      look(A, e, s, 1.45, 0.45, "roll", 1.75);
      look(A, e, s, 1.45, 0.45, "pitch", 0.45);
      spin(s, 2.0, 0.45, "rx", 1, T, A);
      spin(s, 2.7, 0.2, "rx", 0.5, T, A, 0.6);
      spin(s, 3.0, 0.2, "rx", 0.5, T, A, 0.6);
    },
    // the gut knife: spun flat on the palm, the forearm rolled to show the hook, tossed and caught
    gut: (s, T, A, D) => {
      const e = hold(s, D, A, POSE.gut);
      look(A, e, s, 0.55, 0.3, "pitch", -0.15);
      spin(s, 0.85, 0.55, "ry", 1, T, A);
      look(A, e, s, 1.6, 0.4, "roll", -1.0);
      look(A, e, s, 2.15, 0.35, "roll", 1.0);
      toss(s, 2.75, 0.45, "rx", 1, 0.09, T, A);
    },
    // the bowie: heavy; turned to show the long flat and the clip, then thrown up end over end and caught with
    // the weight dropping the hand
    bowie: (s, T, A, D) => {
      const e = hold(s, D, A, POSE.bowie);
      look(A, e, s, 0.8, 0.5, "yaw", 0.35);
      look(A, e, s, 1.2, 0.55, "roll", -1.6);
      look(A, e, s, 1.2, 0.55, "pitch", -0.4);
      look(A, e, s, 1.75, 0.45, "roll", 1.6);
      look(A, e, s, 1.75, 0.45, "pitch", 0.4);
      toss(s, 2.3, 0.62, "rx", 1, 0.15, T, A, 1.6);
    },
    // the kunai: the finger slips into the ring and the knife whirls round it, three turns and one back, then it
    // is thrown up flat and caught by the handle
    kunai: (s, T, A, D) => {
      hold(s, D, A, POSE.kunai);
      ringSpin(s, 0.75, 1.0, 3, T, A, 1);
      ringSpin(s, 1.95, 0.45, -1, T, A, 1);
      toss(s, 2.85, 0.55, "ry", 1, 0.13, T, A);
    },
    // the stiletto: the blade clicked in, the closed handle spun flat twice, thrown end over end with the blade
    // firing out in the air, caught, two quick clicks in and out, a last roll
    stiletto: (s, T, A, D) => {
      hold(s, D, A, POSE.stiletto);
      for (const [a, b] of [[0.45, 2.0], [2.85, 3.05], [3.25, 3.45]]) T.slide += ezS(seg(s, a, a + 0.05)) * (1 - ezS(seg(s, b, b + 0.05)));
      for (const c of CLICKS.stiletto) jerk(s, c, A);
      spin(s, 0.7, 0.75, "ry", 2, T, A);
      toss(s, 1.75, 0.7, "rx", 2, 0.17, T, A);
      spin(s, 3.6, 0.45, "rz", 1, T, A, 0.7);
    },
  };
  // the sharp sounds of a knife that clicks, by the second of its inspect
  const CLICKS = { stiletto: [0.45, 2.0, 2.85, 3.05, 3.25, 3.45], flip: [1.21, 1.76] };
  // the flourish while the knife is drawn, by the second of the draw (the arm's part of the draw is in the knives module)
  const DRAW_SHOW = {
    bayonet: (s, T, A) => spin(s, 0.08, 0.32, "rx", 1, T, A, 0.6),
    gut: (s, T, A) => spin(s, 0.06, 0.34, "ry", 1, T, A, 0.6),
    bowie: (s, T, A) => spin(s, 0.1, 0.32, "rz", 1, T, A, 0.6),
    kunai: (s, T, A) => ringSpin(s, 0.06, 0.4, -2, T, A, 1),
    stiletto: (s, T, A) => {
      T.slide = 1 - ezS(seg(s, 0.2, 0.24));
      jerk(s, 0.2, A);
      A.roll += 0.3 * bump(seg(s, 0.22, 0.4));
    },
  };
  const DRAW_CLICK = { stiletto: 0.2 };
  // the short ones now and then while it is held still, by the second (the karambit and stiletto do different ones)
  const IDLE_SHOW = {
    "": (s, T, A) => spin(s, 0.2, 0.4, "rx", 1, T, A, 0.7),
    butterfly: (s, T, A) => fan(s, 0.2, 0.6, 1, T, A),
    flip: (s, T, A) => (fold(s, 0.22, 1, T, A), fold(s, 0.5, 0, T, A)),
    tanto: (s, T, A) => spin(s, 0.2, 0.45, "rx", 1, T, A, 0.7),
    kukri: (s, T, A) => spin(s, 0.25, 0.55, "rx", 1, T, A, 1.2),
    karambit: (s, T, A, n) => {
      const v = n % 3;
      if (0 === v) ringSpin(s, 0.2, 0.65, 2, T, A);
      else if (1 === v) spin(s, 0.2, 0.4, "rx", -1, T, A, 0.6), spin(s, 0.68, 0.32, "ry", 1, T, A, 0.6);
      else toss(s, 0.3, 0.4, "rx", 1, 0.08, T, A);
    },
    bayonet: (s, T, A) => spin(s, 0.2, 0.45, "rx", 1, T, A, 0.7),
    gut: (s, T, A) => spin(s, 0.2, 0.45, "ry", 1, T, A, 0.7),
    // the bowie is too heavy to play with: the hand turns it to look along the flat
    bowie: (s, T, A) => {
      const e = kf([[0, 0], [0.35, 1], [0.8, 1], [1.2, 0]], s);
      A.yaw += 0.45 * e;
      A.roll -= 0.5 * e;
      A.y += 0.015 * e;
      A.x -= 0.02 * e;
    },
    kunai: (s, T, A) => ringSpin(s, 0.2, 0.6, 2, T, A, 1),
    stiletto: (s, T, A, n) => {
      if (n % 2) {
        T.slide = ezS(seg(s, 0.15, 0.2)) * (1 - ezS(seg(s, 0.88, 0.93)));
        jerk(s, 0.15, A);
        jerk(s, 0.88, A);
        spin(s, 0.32, 0.42, "ry", 1, T, A, 0.6);
      } else toss(s, 0.3, 0.4, "rx", 1, 0.06, T, A);
    },
  };
  const TR = { rx: 0, ry: 0, rz: 0, px: 0, py: 0, pz: 0, open: 0, hA: 0, hB: 0, blade: 0, slide: 0, about: "", com: 0 };
  const AR = { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0 };
  const S = { prevS: -1, half: 0, prev: { x: 0, y: 0, z: 0 }, speed: 0, caught: !1, idleN: 0, idleWas: !1, prevD: -1 };
  // what a knife's move does at second s: { T, A } (for tests and for anyone who wants to look)
  const sample = (kind, m, s, n) => {
    const T = { ...TR },
      A = { ...AR };
    for (const k in T) T[k] = "about" === k ? "" : 0;
    for (const k in A) A[k] = 0;
    const fn = ("insp" === kind ? SHOW : "idle" === kind ? IDLE_SHOW : DRAW_SHOW)[m || ""];
    fn && fn(s, T, A, "insp" === kind ? INSPECT[m || ""] : n || 0);
    return { T, A };
  };
  // the arm turned about the hand (the forearm rolls about its own length, as it does when the wrist turns) and moved
  const FORE = new T.Vector3(0.1, -0.3, 0.44).normalize(),
    _q = new T.Quaternion(),
    _q2 = new T.Quaternion(),
    _eu = new T.Euler(0, 0, 0, "YXZ"),
    _v = new T.Vector3(),
    _w = new T.Vector3();
  function moveArm(a, H, A) {
    _eu.set(A.pitch, A.yaw, 0, "YXZ");
    _q.setFromEuler(_eu).multiply(_q2.setFromAxisAngle(FORE, A.roll));
    _v.copy(H).applyQuaternion(_q);
    _w.copy(H).sub(_v).multiply(a.scale).applyQuaternion(a.quaternion);
    a.quaternion.multiply(_q);
    a.position.add(_w);
    a.position.x += A.x;
    a.position.y += A.y;
    a.position.z += A.z;
  }
  // the click of a blade locking
  const click = () => {
    try {
      const c = GAME_AUDIO.context(),
        t0 = c.currentTime,
        n = Math.floor(0.03 * c.sampleRate),
        b = c.createBuffer(1, n, c.sampleRate),
        d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 6);
      const src = c.createBufferSource(),
        f = c.createBiquadFilter(),
        g = c.createGain();
      src.buffer = b;
      f.type = "bandpass";
      f.frequency.value = 3800;
      f.Q.value = 2.5;
      g.gain.value = 0.5;
      src.connect(f);
      f.connect(g);
      g.connect(GAME_AUDIO.output);
      src.start(t0);
    } catch (e) {}
  };
  function trick(dt) {
    const a = VM.current,
      pv = pivotOf(a),
      M = window.SKIN_PERKS && SKIN_PERKS.state;
    if (!pv || !M || !player.alive || player.ultW || "knife" !== curWeaponKey()) return;
    const m = window.KNIVES ? KNIVES.model() : "",
      kp = KNIVES.parts(a),
      fn = SHOW[m];
    for (const k in TR) TR[k] = 0;
    TR.about = "";
    for (const k in AR) AR[k] = 0;
    const idleOn = !(M.insp.t >= 0) && window.KNIVES && KNIVES.idle && KNIVES.idle.anim >= 0 && IDLE_SHOW[m];
    idleOn && !S.idleWas && S.idleN++;
    S.idleWas = !!idleOn;
    const drawOn = !(M.insp.t >= 0) && !idleOn && M.draw.t >= 0 && DRAW_SHOW[m];
    const on = (M.insp.t >= 0 && fn) || idleOn || drawOn;
    if (on) {
      if (idleOn) IDLE_SHOW[m](Math.min(KNIVES.idle.anim, KNIVES.idleD(m)), TR, AR, S.idleN);
      else if (drawOn) DRAW_SHOW[m](c01(M.draw.t / (M.draw.D || 0.5)) * (M.draw.D || 0.5), TR, AR);
      else fn(M.insp.t, TR, AR, INSPECT[m]);
      const R = pv.rotation,
        P = pv.position;
      R.x += TR.rx;
      R.y += TR.ry;
      R.z += TR.rz;
      P.x += TR.px;
      P.y += TR.py;
      P.z += TR.pz;
      // turning on the ring instead of the grip (the kunai), or in the air about its centre of mass: that point stays put
      const c = "ring" === TR.about && pv.userData.ring ? pv.userData.ring : TR.com && pv.userData.com;
      if (c) {
        const v = c.clone().applyEuler(R);
        P.x += c.x - v.x;
        P.y += c.y - v.y;
        P.z += c.z - v.z;
      }
      kp.hA && (kp.hA.rotation.x = TR.hA);
      kp.hB && (kp.hB.rotation.x = TR.hB);
      kp.blade && TR.blade && (kp.blade.rotation.x = TR.blade);
      // the arm moves with the trick
      pv.userData.grip && moveArm(a, pv.userData.grip, AR);
    }
    // a blade that slides into its handle (the stiletto): 0 out, 1 in
    if (kp.blade && "stiletto" === m) {
      const b = kp.blade;
      void 0 === b.userData.z0 && (b.userData.z0 = b.position.z);
      b.position.z = b.userData.z0 + 0.25 * c01(on ? TR.slide : 0);
      const gh = pv.userData.ghosts;
      gh && gh.forEach((g) => g.blade && (g.blade.position.z = b.position.z));
    }
    // clicks at their seconds
    const cl = CLICKS[m];
    if (cl && M.insp.t >= 0) {
      const s0 = S.prevS,
        s1 = M.insp.t;
      s1 > s0 && cl.some((c) => s0 < c && s1 >= c) && click();
      S.prevS = s1;
    } else S.prevS = -1;
    if (null != DRAW_CLICK[m] && drawOn) {
      const k = c01(M.draw.t / (M.draw.D || 0.5));
      S.prevD < DRAW_CLICK[m] && k >= DRAW_CLICK[m] && click();
      S.prevD = k;
    } else S.prevD = -1;
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
      s >= CATCH.karambit && !S.caught && ((S.caught = !0), chime());
      s < CATCH.karambit && (S.caught = !1);
    } else S.caught = !1;
    // trails behind a fast-turning karambit
    const gh = pv.userData.ghosts;
    if (gh) {
      const R = pv.rotation,
        d = Math.max(dt, 0.004),
        // (a turn back to rest at the end is a jump of whole turns, not speed)
        dw = (v, p) => ((((v - p + PI) % TAU) + TAU) % TAU) - PI,
        wx = dw(R.x, S.prev.x) / d,
        wy = dw(R.y, S.prev.y) / d,
        wz = dw(R.z, S.prev.z) / d;
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
  window.KNIFE_TRICKS = { SHOW, IDLE_SHOW, DRAW_SHOW, INSPECT, IDLE_D, POSE, CLICKS, CATCH, S, sample, curves: { backIO, backO, wob, spinK, kf } };
})();
