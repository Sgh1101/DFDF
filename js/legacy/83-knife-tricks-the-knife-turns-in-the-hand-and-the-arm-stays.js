(() => {
  // Knife tricks that turn the knife, not the arm. The first-person knife and
  // the hand holding it used to be baked into one mesh, so every spin (the
  // legendary knife's draw, its idle twirl, the spinning slash) turned the
  // whole arm with it. Now the knife hangs on a pivot at the middle of the
  // grip, the way knife viewmodels are rigged (a weapon bone in the palm), and
  // the spins turn that pivot while the hand and arm stay put. Each knife then
  // gets the trick it is known for, in its inspect:
  //   default — spun once round the fingers (as a bayonet is)
  //   butterfly — the handles fan open and shut, then an aerial: tossed up,
  //               turned once, caught
  //   karambit — spun on the index finger through its ring (its own part)
  //   flip — flicked open and shut, then tossed in the palm and caught
  //   tanto — turned blade-down into a reverse grip and back
  //   kukri — a slow, heavy fan twirl round the wrist
  // Looks only: nothing about a cut changes.
  if ("function" != typeof vmWithHands || "function" != typeof vmArm || "undefined" == typeof VM || "function" != typeof tickViewmodel) return;
  const PI = Math.PI,
    c01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x),
    seg = (t, a, b) => c01((t - a) / (b - a)),
    ezS = (x) => x * x * (3 - 2 * x),
    ezIO = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

  // ── the rig: the arm's meshes are told apart while a knife is built ──
  let building = !1;
  const _arm = vmArm;
  vmArm = function (parent) {
    const n0 = parent && parent.children ? parent.children.length : 0;
    const r = _arm.apply(this, arguments);
    if (building && parent && parent.children) for (let i = n0; i < parent.children.length; i++) parent.children[i].userData.armPart = 1;
    return r;
  };
  const isHand = (x) => x.isMesh && x.geometry && "SphereGeometry" === x.geometry.type && x.geometry.parameters && Math.abs(x.geometry.parameters.radius - 0.043) < 0.006;
  function rig(o) {
    o.updateMatrixWorld(!0);
    let hand = null;
    o.traverse((x) => !hand && isHand(x) && (hand = x));
    const grip = new T.Vector3();
    if (hand) {
      hand.getWorldPosition(grip);
      o.worldToLocal(grip);
    }
    const pv = new T.Group();
    pv.name = "knife-pivot";
    pv.position.copy(grip);
    o.add(pv);
    pv.updateMatrixWorld(!0);
    const fist = o.userData.fist;
    for (const c of o.children.slice()) c === pv || c.userData.armPart || c === fist || pv.attach(c);
    // kept out of the bake, so it can turn on its own
    pv.traverse((x) => x.isMesh && (x.userData.live = !0));
    pv.userData.p0 = pv.position.clone();
    pv.userData.hand = !!hand;
    o.userData.kpivot = pv;
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
      o && rig(o);
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

  // ── each knife's trick, in its inspect ──
  const model = () => (window.KNIVES ? KNIVES.model() : "");
  function trick() {
    const a = VM.current,
      pv = pivotOf(a),
      M = window.SKIN_PERKS && SKIN_PERKS.state;
    if (!pv || !M || !player.alive || player.ultW || "knife" !== curWeaponKey()) return;
    if (!(M.insp.t >= 0)) return;
    const s = M.insp.t,
      m = model(),
      R = pv.rotation,
      P = pv.position;
    if ("" === m) {
      // round the fingers once
      R.x += 2 * PI * ezIO(seg(s, 0.95, 1.55));
    } else if ("butterfly" === m) {
      // the aerial: up, a full turn, down into the hand
      const k = seg(s, 1.55, 2.05),
        h = Math.sin(k * PI);
      P.y += 0.11 * h;
      P.z -= 0.02 * h;
      R.x += 2 * PI * ezS(k);
    } else if ("flip" === m) {
      // a toss in the palm: a half turn up and back over
      const k = seg(s, 1.75, 2.15),
        h = Math.sin(k * PI);
      P.y += 0.07 * h;
      R.y += 2 * PI * ezS(k);
    } else if ("tanto" === m) {
      // blade down into a reverse grip, a beat, and back
      R.x += PI * (ezS(seg(s, 0.55, 0.85)) - ezS(seg(s, 1.45, 1.75)));
    } else if ("kukri" === m) {
      // heavy and slow: the weight carries it round
      const k = seg(s, 0.8, 1.7);
      R.x -= 2 * PI * (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
    }
  }
  const _tick = tickViewmodel;
  tickViewmodel = function (dt) {
    const r = _tick.apply(this, arguments);
    try {
      trick();
    } catch (e) {}
    return r;
  };
})();
