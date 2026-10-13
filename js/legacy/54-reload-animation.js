
(() => {
  // Reloads you can watch. The gun tips toward the free hand, the hand pulls
  // the magazine out and drops it, brings a fresh one up and seats it, then
  // works the bolt. Pistols swap the magazine in the grip and rack the slide,
  // shotguns are fed shell by shell and pumped, machine guns get a new belt,
  // and the RPG takes a new rocket in at the muzzle. Every step is timed to
  // the gun's own reload (the old pose assumed 1.9 s for every gun, so the
  // slow ones bobbed the wrong way).
  if ("undefined" == typeof VM || "function" != typeof getVMFor || "function" != typeof tickViewmodel || "function" != typeof vmArm) return;

  // ── small sounds for the hands ──
  const SND = (() => {
    let ctx = null,
      out = null;
    const ac = () => {
      if ("object" == typeof SETTINGS && SETTINGS && !SETTINGS.sfx) return null;
      if (ctx) return "suspended" === ctx.state && ctx.resume(), ctx;
      try {
        const C = window.AudioContext || window.webkitAudioContext;
        if (!C) return null;
        ctx = GAME_AUDIO.context();
        out = ctx.createGain();
        out.gain.value = 0.2;
        out.connect(GAME_AUDIO.output);
      } catch (e) {
        ctx = null;
      }
      return ctx;
    };
    const tone = (f, d, w, v, f2, at) => {
      const c = ac();
      if (!c) return;
      const t0 = c.currentTime + (at || 0),
        o = c.createOscillator(),
        g = c.createGain();
      o.type = w || "square";
      o.frequency.setValueAtTime(f, t0);
      f2 && o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + d);
      g.gain.setValueAtTime(1e-4, t0);
      g.gain.exponentialRampToValueAtTime(v || 0.2, t0 + 0.004);
      g.gain.exponentialRampToValueAtTime(1e-4, t0 + d);
      o.connect(g);
      g.connect(out);
      o.start(t0);
      o.stop(t0 + d + 0.02);
    };
    const noise = (d, v, cut, type, at) => {
      const c = ac();
      if (!c) return;
      const t0 = c.currentTime + (at || 0),
        n = Math.max(1, Math.floor(c.sampleRate * d)),
        b = c.createBuffer(1, n, c.sampleRate),
        ch = b.getChannelData(0);
      for (let i = 0; i < n; i++) ch[i] = (2 * Math.random() - 1) * Math.pow(1 - i / n, 2.2);
      const s = c.createBufferSource();
      s.buffer = b;
      const fl = c.createBiquadFilter();
      fl.type = type || "lowpass";
      fl.frequency.value = cut || 2000;
      const g = c.createGain();
      g.gain.value = v || 0.3;
      s.connect(fl);
      fl.connect(g);
      g.connect(out);
      s.start(t0);
    };
    return {
      magOut() {
        noise(0.05, 0.35, 2600);
        tone(900, 0.025, "square", 0.12, 600);
      },
      magIn() {
        noise(0.06, 0.5, 1700);
        tone(320, 0.045, "square", 0.2, 190);
      },
      rack() {
        noise(0.07, 0.4, 3200, "bandpass");
        tone(540, 0.05, "square", 0.16, 260);
        noise(0.05, 0.4, 2400, "lowpass", 0.08);
        tone(700, 0.04, "square", 0.16, 420, 0.08);
      },
      shell() {
        noise(0.04, 0.3, 2400, "highpass");
        tone(760, 0.03, "triangle", 0.14, 520);
      },
      pump() {
        noise(0.06, 0.45, 1500);
        tone(260, 0.05, "square", 0.18, 150);
        noise(0.06, 0.45, 1900, "lowpass", 0.11);
        tone(330, 0.05, "square", 0.18, 200, 0.11);
      },
      rocketIn() {
        noise(0.14, 0.55, 700);
        tone(140, 0.12, "sawtooth", 0.2, 70);
      },
      pin() {
        noise(0.03, 0.25, 4000, "highpass");
        tone(2600, 0.16, "sine", 0.16, 2450);
        tone(3900, 0.1, "sine", 0.08, 3800, 0.01);
      },
      spoon() {
        tone(1900, 0.08, "triangle", 0.14, 900);
        noise(0.06, 0.22, 3000, "highpass", 0.02);
      },
    };
  })();
  window.VM_SND = SND;

  // ── tag what moves while a first-person gun is built ──
  // (the rest of the gun and the right hand are still merged into a few meshes)
  const BUILD = { on: !1, lhand: null, rhand: null };
  const live = (m, k) => {
    if (!m || !m.isMesh) return;
    m.userData.live = !0;
    m.userData[k] = !0;
  };
  const _gb = GunBuilder;
  GunBuilder = function () {
    const b = _gb.apply(this, arguments);
    if (!BUILD.on || !b || !b.group) return b;
    const tagNew = (name, k) => {
      const f = b[name];
      if ("function" != typeof f) return;
      b[name] = function () {
        const n0 = b.group.children.length;
        const r = f.apply(this, arguments);
        for (let i = n0; i < b.group.children.length; i++) live(b.group.children[i], k);
        r && r.isMesh && live(r, k);
        return r;
      };
    };
    tagNew("mag", "isMag");
    tagNew("magCurved", "isMag");
    tagNew("belt", "isMag");
    return b;
  };
  const _arm = vmArm;
  vmArm = function (parent, hand, elbow, sl, gl, tr, isLeft) {
    const n0 = parent && parent.children ? parent.children.length : 0;
    const r = _arm.apply(this, arguments);
    if (BUILD.on && parent && hand) {
      if (isLeft) {
        for (let i = n0; i < parent.children.length; i++) live(parent.children[i], "lhand");
        BUILD.lhand = hand.clone();
      } else BUILD.rhand || (BUILD.rhand = hand.clone());
    }
    return r;
  };
  // the drum on the drum SMG is two plain cylinders under the gun
  const DRUM = { ripper: (m) => m.geometry && "CylinderGeometry" === m.geometry.type && m.position.y < -0.08 && m.position.z < -0.08 && m.position.z > -0.12 };

  const styleOf = (key) => {
    const w = WEAPONS[key] || {};
    if ("knife" === key || "근접" === w.cls) return "";
    if (w.launcher) return "rocket";
    if ("산탄총" === w.cls || w.pellets > 1 || "revolver" === key) return "shells";
    if ("보조" === w.cls) return "pistol";
    return "mag";
  };
  const V = (x, y, z) => new T.Vector3(x, y, z);

  function prep(a, key) {
    a.updateMatrixWorld(!0);
    const inv = new T.Matrix4().copy(a.matrixWorld).invert();
    const boxOf = (o) => new T.Box3().setFromObject(o).applyMatrix4(inv);
    const gunBox = BUILD.gunBox ? BUILD.gunBox.clone() : boxOf(a);
    const rl = { key, style: styleOf(key), gun: gunBox, P0: BUILD.lhand ? BUILD.lhand.clone() : null, R: BUILD.rhand ? BUILD.rhand.clone() : null };
    const mags = [],
      hands = [],
      rockets = [];
    a.traverse((m) => {
      if (!m.isMesh) return;
      m.userData.isMag && mags.push(m);
      m.userData.lhand && hands.push(m);
      m.userData.isRocket && rockets.push(m);
    });
    if (DRUM[key]) a.traverse((m) => m.isMesh && !m.userData.isMag && DRUM[key](m) && (live(m, "isMag"), mags.push(m)));
    const group = (list, name) => {
      if (!list.length) return null;
      const g = new T.Group();
      g.name = name;
      a.add(g);
      g.updateMatrixWorld(!0);
      for (const m of list) g.attach(m);
      return g;
    };
    rl.lh = group(hands, "rl-lhand");
    rl.mag = group(mags, "rl-mag");
    rl.rk = group(rockets, "rl-rocket");
    rl.magBox = rl.mag ? boxOf(rl.mag) : null;
    // a pistol's magazine hides in the grip: a stand-in slides out of it
    if ("pistol" === rl.style && rl.R) {
      const g = new T.Group();
      g.name = "rl-mag";
      const mat = new T.MeshStandardMaterial({ color: 0x23262b, roughness: 0.55, metalness: 0.4 });
      const body = new T.Mesh(new T.BoxGeometry(0.022, 0.09, 0.038), mat);
      const plate = new T.Mesh(new T.BoxGeometry(0.026, 0.01, 0.044), mat);
      plate.position.y = -0.048;
      g.add(body, plate);
      g.position.set(rl.R.x, gunBox.min.y + 0.04, rl.R.z + 0.008);
      g.rotation.x = 0.27;
      g.visible = !1;
      a.add(g);
      rl.mag = g;
      rl.prop = !0;
      rl.magBox = boxOf(g);
    }
    // a shotgun shell (or a revolver round) held in the fingers
    if ("shells" === rl.style && rl.lh) {
      const g = new T.Group();
      const rev = "revolver" === key;
      const tube = new T.Mesh(new T.CylinderGeometry(rev ? 0.0055 : 0.0105, rev ? 0.0055 : 0.0105, rev ? 0.03 : 0.046, 10), new T.MeshStandardMaterial({ color: rev ? 0xc9a14a : 0xb3261e, roughness: 0.5, metalness: rev ? 0.8 : 0.1 }));
      const base = new T.Mesh(new T.CylinderGeometry(rev ? 0.0062 : 0.0112, rev ? 0.0062 : 0.0112, 0.01, 10), new T.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.35, metalness: 0.85 }));
      base.position.y = rev ? -0.018 : -0.026;
      g.add(tube, base);
      g.rotation.x = -1.15;
      g.position.copy(rl.P0 || V(0, 0, 0)).add(V(-0.02, 0.05, -0.05));
      g.visible = !1;
      rl.lh.add(g);
      rl.shell = g;
    }
    a.traverse((m) => {
      if (m.isMesh) (m.renderOrder = 999), (m.frustumCulled = !1), (m.castShadow = !1);
    });
    if (rl.mag) rl.mag0 = rl.mag.position.clone();
    if (rl.rk) rl.rk0 = rl.rk.position.clone();
    if (rl.lh) rl.lh0 = rl.lh.position.clone();
    a.userData.rl = rl;
    return rl;
  }

  const _vwh = vmWithHands;
  vmWithHands = function (g) {
    BUILD.lhand = BUILD.rhand = BUILD.gunBox = null;
    try {
      // the gun alone (the hands and arms are added next and baked in with it)
      g.updateMatrixWorld(!0);
      BUILD.gunBox = new T.Box3().setFromObject(g);
    } catch (e) {}
    return _vwh.apply(this, arguments);
  };
  const _get = getVMFor;
  getVMFor = function (key) {
    const was = BUILD.on;
    BUILD.on = !0;
    let a;
    try {
      a = _get.apply(this, arguments);
    } finally {
      BUILD.on = was;
    }
    try {
      a && !a.userData.rl && !String(key).startsWith("ultw:") && prep(a, key);
    } catch (e) {
      console.warn("reload rig", e);
      a && (a.userData.rl = { style: "" });
    }
    return a;
  };
  // guns built before this ran had nothing tagged
  try {
    VM.current && VM.root.remove(VM.current);
    VM.current = null;
    VM.cache = {};
  } catch (e) {}

  // ── the motion ──
  const ez = (x) => (x < 0 ? 0 : x > 1 ? 1 : x),
    seg = (k, a, b) => ez((k - a) / (b - a)),
    sm = (x) => x * x * (3 - 2 * x),
    out3 = (x) => 1 - (1 - x) * (1 - x) * (1 - x),
    bump = (k, at, w) => {
      const d = (k - at) / w;
      return d < 0 || d > 1 ? 0 : Math.sin(d * Math.PI) * (1 - d);
    };
  const lerpV = (o, a, b, t) => o.set(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
  // a path through points: [[until, point], ...] starting at p0
  const path = (o, k, p0, legs) => {
    let s = 0,
      from = p0;
    for (const [until, to, e] of legs) {
      if (k <= until) return lerpV(o, from, to, (e || sm)(seg(k, s, until)));
      s = until;
      from = to;
    }
    return o.copy(from);
  };
  const RL = { on: !1, D: 1, last: 0, key: "", cues: null };
  window.VM_RELOAD = () => [0, 0]; // the base pose leaves reloads to this module
  window.VM_RL = RL;
  const H = V(0, 0, 0),
    M = V(0, 0, 0),
    tmp = V(0, 0, 0),
    ZERO = V(0, 0, 0);
  const cue = (name, k, at, f) => {
    if (k >= at && !RL.cues[name]) {
      RL.cues[name] = 1;
      try {
        f();
      } catch (e) {}
    }
  };

  // how far the whole gun turns while it is being reloaded:
  // drop, pitch (muzzle up), yaw (muzzle left), roll, sideways, back
  const POSE = {
    mag: { dy: 0.035, rx: 0.15, ry: 0.45, rz: -0.3, dx: -0.05, dz: 0.03 },
    pistol: { dy: 0.03, rx: 0.25, ry: 0.3, rz: -0.3, dx: -0.03, dz: 0.02 },
    shells: { dy: 0.035, rx: 0.1, ry: 0.3, rz: -0.55, dx: -0.03, dz: 0.02 },
    // the launcher swings its muzzle in toward the middle, so the new rocket going in is in view
    rocket: { dy: 0.02, rx: -0.1, ry: 0.5, rz: -0.15, dx: -0.05, dz: 0.1 },
  };
  window.VM_RL_POSE = POSE;
  function pose(a, rl, k) {
    const inn = sm(seg(k, 0, 0.14)),
      outk = sm(seg(k, 0.84, 1)),
      hold = inn * (1 - outk);
    const st = rl.style,
      F = POSE[st] || POSE.mag;
    let dy = F.dy * hold,
      rx = F.rx * hold,
      ry = F.ry * hold,
      rz = F.rz * hold,
      dx = F.dx * hold,
      dz = F.dz * hold;
    const P0 = rl.P0 || V(-0.05, -0.1, -0.3);
    if ("mag" === st || "pistol" === st) {
      const pis = "pistol" === st;
      // the old magazine drops out at once (the one that falls to the floor),
      // the hand goes down for a fresh one, seats it, then works the bolt
      rx += 0.07 * bump(k, 0.53, 0.12);
      dy -= 0.012 * bump(k, 0.53, 0.12);
      dz += 0.03 * bump(k, 0.63, 0.1);
      rz -= 0.06 * bump(k, 0.63, 0.1);
      const mb = rl.magBox;
      const top = mb ? V((mb.min.x + mb.max.x) / 2, mb.min.y, (mb.min.z + mb.max.z) / 2) : V(P0.x + 0.02, (rl.R ? rl.R.y : P0.y) - 0.07, (P0.z + (rl.R ? rl.R.z : P0.z + 0.2)) / 2);
      const G = top.clone().add(V(-0.012, 0.005, 0.01)); // the palm under the magazine
      const AWAY = G.clone().add(V(-0.07, -0.46, 0.12)),
        BACK = G.clone().add(V(-0.005, -0.12, 0.02));
      const gb = rl.gun;
      const C = V(gb.min.x - 0.014, Math.min(gb.max.y - 0.02, top.y + 0.1), top.z - 0.02),
        C2 = C.clone().add(V(0, 0, 0.06));
      // a pistol's slide is let go by the thumb, so that hand goes straight back to the grip
      path(
        H,
        k,
        P0,
        pis
          ? [
              [0.1, G],
              [0.24, AWAY],
              [0.44, BACK, out3],
              [0.53, G],
              [0.7, P0],
            ]
          : [
              [0.1, G],
              [0.24, AWAY],
              [0.44, BACK, out3],
              [0.53, G],
              [0.59, C],
              [0.64, C2, out3],
              [0.68, C],
              [0.86, P0],
            ]
      );
      if (rl.mag) {
        const fresh = k > 0.26 && k < 0.53; // the new one, in the hand
        M.set(0, 0, 0);
        if (k < 0.07) M.y = -0.06 * sm(k / 0.07); // the old one slips out
        else if (fresh) M.copy(H).sub(G);
        rl.mag.position.copy(rl.mag0).add(M);
        rl.mag.rotation.z = fresh ? -0.25 * Math.min(1, M.length() / 0.2) : 0;
        rl.mag.visible = rl.prop ? k < 0.06 || fresh : k < 0.06 || k > 0.26;
      }
      cue("out", k, 0.01, () => SND.magOut());
      cue("in", k, 0.52, () => SND.magIn());
      cue("rack", k, 0.62, () => SND.rack());
    } else if ("shells" === st) {
      const R = rl.R || P0.clone().add(V(0.02, 0.02, 0.22));
      const port = V((P0.x + R.x) / 2 + 0.005, Math.min(P0.y, R.y) - 0.005, P0.z + (R.z - P0.z) * 0.45);
      const low = port.clone().add(V(-0.012, -0.075, 0.03));
      const n = 4,
        a0 = 0.12,
        a1 = 0.76;
      if (k < a0) path(H, k, P0, [[a0, low]]);
      else if (k < a1) {
        const c = ((k - a0) / (a1 - a0)) * n,
          i = Math.floor(c),
          f = c - i;
        // up into the port, then back down for the next one
        lerpV(H, low, port, f < 0.55 ? sm(f / 0.55) : 1 - sm((f - 0.55) / 0.45));
        rl.shell && (rl.shell.visible = f < 0.5);
        cue("sh" + i, k, a0 + ((i + 0.5) / n) * (a1 - a0), () => SND.shell());
      } else {
        rl.shell && (rl.shell.visible = !1);
        const pumpBack = P0.clone().add(V(0, -0.004, 0.065));
        path(H, k, low, [
          [0.84, P0],
          [0.9, pumpBack, out3],
          [0.95, P0],
        ]);
        cue("pump", k, 0.86, () => SND.pump());
        dz += 0.025 * bump(k, 0.86, 0.1);
      }
      k < a0 && rl.shell && (rl.shell.visible = k > 0.08);
    } else if ("rocket" === st) {
      dz += 0.03 * bump(k, 0.72, 0.1);
      // the hand fetches a rocket from below, holds it up in front of the
      // muzzle and pushes it home, then goes back to the grip
      const below = V(0, -0.8, 0.1),
        front = V(0, 0, -0.17);
      M.copy(below);
      if (k >= 0.42 && k < 0.62) lerpV(M, below, front, out3(seg(k, 0.42, 0.62)));
      else if (k >= 0.62) lerpV(M, front, ZERO, sm(seg(k, 0.62, 0.74)));
      if (rl.rk) {
        rl.rk.visible = k >= 0.42;
        rl.rk.position.copy(rl.rk0).add(M);
      }
      const hp = rl.rkHold || (rl.rk ? (rl.rkHold = rkHoldPoint(rl, a)) : P0.clone().add(V(0, 0, -0.2)));
      if (k < 0.42) path(H, k, P0, [[0.16, tmp.copy(hp).add(below)]]);
      else if (k < 0.74) H.copy(hp).add(M);
      else path(H, k, hp, [[0.74, hp], [0.9, P0]]);
      cue("rin", k, 0.72, () => SND.rocketIn());
    }
    if (rl.lh && rl.P0) rl.lh.position.copy(rl.lh0).add(H).sub(P0);
    return { dy, rx, ry, rz, dx, dz };
  }
  // where the left hand holds a rocket sitting in the tube (under its back half)
  function rkHoldPoint(rl, a) {
    a.updateMatrixWorld(!0);
    const inv = new T.Matrix4().copy(a.matrixWorld).invert();
    const p = rl.rk.position.clone();
    rl.rk.position.copy(rl.rk0);
    const b = new T.Box3().setFromObject(rl.rk).applyMatrix4(inv);
    rl.rk.position.copy(p);
    return V((b.min.x + b.max.x) / 2 - 0.01, b.min.y - 0.012, b.max.z - 0.02);
  }
  function rest(rl) {
    if (rl.lh && rl.lh0) rl.lh.position.copy(rl.lh0);
    if (rl.mag && rl.mag0) {
      rl.mag.position.copy(rl.mag0);
      rl.mag.rotation.z = 0;
      rl.mag.visible = !rl.prop;
    }
    rl.shell && (rl.shell.visible = !1);
    if (rl.rk) {
      rl.rk.position.copy(rl.rk0);
      rl.rk.visible = ((player.ammo && player.ammo[rl.key]) | 0) > 0 || !!ADMIN.infAmmo;
    }
  }

  const _tick = tickViewmodel;
  tickViewmodel = function (dt) {
    const r = _tick.apply(this, arguments);
    try {
      const a = VM.current,
        rl = a && a.userData.rl;
      const rel = player.alive && player.reloading > 0 && !player.ultW;
      if (rel && (!RL.on || player.reloading > RL.last + 0.05 || RL.key !== curWeaponKey())) {
        RL.on = !0;
        RL.D = Math.max(0.35, player.reloading);
        RL.key = curWeaponKey();
        RL.cues = {};
      }
      if (!rel) RL.on = !1;
      RL.last = rel ? player.reloading : 0;
      if (!a || !rl || !rl.style) return r;
      if (!RL.on || RL.key !== rl.key) return rest(rl), r;
      if (!player.alive || !VM.root.visible || !a.visible) return r; // not posed this frame
      const k = Math.min(1, Math.max(0, 1 - player.reloading / RL.D));
      const o = pose(a, rl, k);
      a.position.y -= o.dy;
      a.position.x += o.dx;
      a.position.z += o.dz;
      a.rotation.x += o.rx;
      a.rotation.y += o.ry;
      a.rotation.z += o.rz;
    } catch (e) {}
    return r;
  };
})();
