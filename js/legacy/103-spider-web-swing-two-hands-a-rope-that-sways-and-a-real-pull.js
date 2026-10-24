(() => {
  // The spider's E (거미줄 이동). It was one thin tube that was there at once, and a pull in a straight line at one
  // speed. Now both hands shoot a web: the tips fly out and take a moment to land, the strands are slack and whip
  // as they go, then pull tight and tremble. The body is not dragged along a line: it hangs from the rope and
  // swings (gravity, a rope that is reeled in, a rope that cannot get longer), so the way in is an arc that
  // starts slowly and gathers speed. A jump lets go and keeps the speed, as a throw. For the one who is swinging
  // the picture widens a little, leans into the turn, trembles a little and speed lines come in at the edges
  // (all of it off with the motion setting). The cast is the same ability, the same range and the same cooldown;
  // only how it looks, sounds and moves has changed. Cast, rope and sound play on every screen; the body is moved
  // where the body is simulated, as the old pull was.
  if ("undefined" == typeof CAST_EXT || "function" != typeof CAST_EXT.y_webzip || "undefined" == typeof T || "function" != typeof simMove || "function" != typeof followCamera) return;

  const RANGE = 48,
    FLY = 0.16, // the tips reach the wall
    REEL = 44, // how fast the rope is taken in at most (m/s)
    PULL = 48, // the pull along the rope (m/s²)
    GRAV = 9.5,
    VMAX = 46,
    MAXLIFE = 2.4,
    N = 18,
    SIDES = 5,
    WEB = 0xf2f4f7;
  const smooth = (x) => ((x = Math.max(0, Math.min(1, x))), x * x * (3 - 2 * x));
  const motion = () => ("function" == typeof MOT ? MOT() : 1) > 0 && !(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const me = () => ("function" == typeof myActor && myActor()) || null;

  // ── sound: a flick, a strain, a thump (made, not recorded) ──
  let noiseBuf = null;
  const audio = () => {
    try {
      const c = GAME_AUDIO.context();
      if (!c) return null;
      if (!noiseBuf) {
        noiseBuf = c.createBuffer(1, c.sampleRate * 0.6, c.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      return c;
    } catch (e) {
      return null;
    }
  };
  const farOf = (x, z) => {
    const m = me() || ("undefined" != typeof player ? player : null);
    return m && m.pos ? Math.min(1, Math.hypot(m.pos.x - x, m.pos.z - z) / 70) : 0;
  };
  function noise(c, t0, dur, f0, f1, q, gain, type) {
    const s = c.createBufferSource(),
      f = c.createBiquadFilter(),
      g = c.createGain();
    s.buffer = noiseBuf;
    f.type = type || "bandpass";
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0);
    f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.02, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f);
    f.connect(g);
    g.connect(GAME_AUDIO.output);
    s.start(t0, Math.random() * 0.3, dur + 0.05);
  }
  function tone(c, t0, dur, f0, f1, gain, wave) {
    const o = c.createOscillator(),
      g = c.createGain();
    o.type = wave || "sine";
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(GAME_AUDIO.output);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }
  // one hand's flick: air through a rising band, a small pop at the wrist
  function thwip(c, t0, v) {
    noise(c, t0, 0.2, 700, 4200, 5, 0.22 * v);
    tone(c, t0, 0.09, 460, 150, 0.16 * v);
  }
  const sounds = {
    launch(x, z) {
      const c = audio();
      if (!c) return;
      const v = 1 - 0.8 * farOf(x, z),
        t = c.currentTime;
      thwip(c, t, v);
      thwip(c, t + 0.035, v * 0.85);
    },
    // the tips land: a thump and a short crack of thread on stone
    land(x, z) {
      const c = audio();
      if (!c) return;
      const v = 1 - 0.8 * farOf(x, z),
        t = c.currentTime;
      tone(c, t, 0.14, 150, 55, 0.3 * v);
      noise(c, t, 0.05, 3200, 1800, 2, 0.14 * v, "highpass");
    },
    // the rope strains while it pulls, and the air rushes
    pull(x, z, dur) {
      const c = audio();
      if (!c) return;
      const v = 1 - 0.8 * farOf(x, z),
        t = c.currentTime;
      noise(c, t, dur, 500, 2400, 0.8, 0.1 * v);
      const o = c.createOscillator(),
        l = c.createBiquadFilter(),
        g = c.createGain();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(58, t);
      o.frequency.linearRampToValueAtTime(96, t + dur);
      l.type = "lowpass";
      l.frequency.value = 380;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.045 * v, t + 0.12);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(l);
      l.connect(g);
      g.connect(GAME_AUDIO.output);
      o.start(t);
      o.stop(t + dur + 0.05);
    },
  };

  // ── looks ──
  function strand(radius, op) {
    const g = new T.BufferGeometry(),
      idx = [];
    g.setAttribute("position", new T.BufferAttribute(new Float32Array((N + 1) * SIDES * 3), 3));
    for (let i = 0; i < N; i++)
      for (let j = 0; j < SIDES; j++) {
        const a = i * SIDES + j,
          b = i * SIDES + ((j + 1) % SIDES),
          c = (i + 1) * SIDES + j,
          d = (i + 1) * SIDES + ((j + 1) % SIDES);
        idx.push(a, b, c, b, d, c);
      }
    g.setIndex(idx);
    const m = new T.Mesh(g, new T.MeshBasicMaterial({ color: WEB, transparent: !0, opacity: op, depthWrite: !1, side: T.DoubleSide }));
    m.frustumCulled = !1;
    m.userData.radius = radius;
    m.userData.op = op;
    return m;
  }
  const _t = new T.Vector3(),
    _u = new T.Vector3(),
    _w = new T.Vector3(),
    UP = new T.Vector3(0, 1, 0);
  function lay(m, pts) {
    const pos = m.geometry.attributes.position.array,
      r = m.userData.radius;
    for (let i = 0; i <= N; i++) {
      const a = pts[Math.max(0, i - 1)],
        b = pts[Math.min(N, i + 1)];
      _t.set(b.x - a.x, b.y - a.y, b.z - a.z);
      if (_t.lengthSq() < 1e-8) _t.set(0, 0, 1);
      _t.normalize();
      _u.crossVectors(_t, UP);
      if (_u.lengthSq() < 1e-6) _u.set(1, 0, 0);
      _u.normalize();
      _w.crossVectors(_t, _u);
      const p = pts[i],
        rad = r * (0.75 + 0.25 * Math.sin((Math.PI * i) / N));
      for (let j = 0; j < SIDES; j++) {
        const ang = (Math.PI * 2 * j) / SIDES,
          cu = Math.cos(ang) * rad,
          cw = Math.sin(ang) * rad,
          k = (i * SIDES + j) * 3;
        pos[k] = p.x + _u.x * cu + _w.x * cw;
        pos[k + 1] = p.y + _u.y * cu + _w.y * cw;
        pos[k + 2] = p.z + _u.z * cu + _w.z * cw;
      }
    }
    m.geometry.attributes.position.needsUpdate = !0;
  }
  const PTS = Array.from({ length: N + 1 }, () => ({ x: 0, y: 0, z: 0 }));
  // the shape of one rope at a moment: slack and whipping while the tip flies, tight and trembling once it pulls.
  // Only the time and the two ends go in, so every screen draws the same rope.
  function shape(H, A, t, reach, tight, from, speed, phase, twist) {
    const dx = A.x - H.x,
      dy = A.y - H.y,
      dz = A.z - H.z,
      len = Math.hypot(dx, dy, dz) || 0.01;
    const hl = Math.hypot(dx, dz) || 0.01,
      p1x = -dz / hl,
      p1z = dx / hl, // sideways, flat
      nx = dx / len,
      ny = dy / len,
      nz = dz / len;
    // the other sideways: across both the rope and the first one
    const p2x = ny * p1z,
      p2y = nz * p1x - nx * p1z,
      p2z = -ny * p1x;
    const p2l = Math.hypot(p2x, p2y, p2z) || 1;
    const sag = (1 - tight) * Math.min(2.6, 0.12 * len) + 0.05;
    const ta = Math.max(0, t - FLY);
    // a wave that runs out from the hand while it flies and rings down once it holds, then a fine tremble
    const amp = (0.12 + 0.38 * (1 - tight) + 0.5 * Math.exp(-3.2 * ta)) * (1 + (phase ? 0.2 : 0));
    const trem = 0.012 + 0.0035 * Math.min(speed, 40);
    const end = reach;
    for (let i = 0; i <= N; i++) {
      const u = i / N,
        s = from + (end - from) * u, // along the whole rope, 0 at the hand
        sn = Math.sin(Math.PI * s),
        w1 = sn * amp * Math.sin(Math.PI * 2 * (2.1 * t + phase) - 5.5 * s),
        w2 = Math.sin(2 * Math.PI * s) * amp * 0.55 * Math.cos(Math.PI * 2 * 3.1 * t + phase),
        fine = trem * sn * Math.sin(Math.PI * 2 * 17 * t + 9 * s + phase * 3),
        tw = twist * sn * Math.sin(10 * s + 5 * t + phase);
      const p = PTS[i];
      p.x = H.x + dx * s + p1x * (w1 + fine + tw) + (p2x / p2l) * w2;
      p.y = H.y + dy * s - sag * 4 * s * (1 - s) + (p2y / p2l) * w2 + fine * 0.6;
      p.z = H.z + dz * s + p1z * (w1 + fine + tw) + (p2z / p2l) * w2;
    }
    return PTS;
  }
  const basis = (a) => {
    const yaw = a.yaw || 0;
    return { rx: Math.cos(yaw), rz: -Math.sin(yaw), fx: -Math.sin(yaw), fz: -Math.cos(yaw) };
  };
  const handAt = (a, side, out) => {
    const b = basis(a);
    out.x = a.pos.x + b.rx * 0.34 * side + b.fx * 0.42;
    out.y = (a.y || 0) + 1.12;
    out.z = a.pos.z + b.rz * 0.34 * side + b.fz * 0.42;
    return out;
  };
  let webTex = null;
  const sprite = (kind) => {
    if (!webTex) {
      const c = document.createElement("canvas");
      c.width = c.height = 128;
      const g = c.getContext("2d");
      const rg = g.createRadialGradient(64, 64, 2, 64, 64, 60);
      rg.addColorStop(0, "rgba(255,255,255,.9)");
      rg.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = rg;
      g.fillRect(0, 0, 128, 128);
      g.strokeStyle = "rgba(255,255,255,.85)";
      g.lineWidth = 1.6;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.beginPath();
        g.moveTo(64, 64);
        g.lineTo(64 + Math.cos(a) * 58, 64 + Math.sin(a) * 58);
        g.stroke();
      }
      for (const r of [18, 34, 50]) {
        g.beginPath();
        for (let i = 0; i <= 8; i++) {
          const a = (i / 8) * Math.PI * 2,
            rr = r * (i % 2 ? 0.92 : 1);
          i ? g.lineTo(64 + Math.cos(a) * rr, 64 + Math.sin(a) * rr) : g.moveTo(64 + Math.cos(a) * rr, 64 + Math.sin(a) * rr);
        }
        g.stroke();
      }
      webTex = new T.CanvasTexture(c);
    }
    const m = new T.Sprite(new T.SpriteMaterial({ map: webTex, color: WEB, transparent: !0, depthWrite: !1, blending: "flash" === kind ? T.AdditiveBlending : T.NormalBlending, opacity: 0 }));
    m.visible = !1;
    scene.add(m);
    return m;
  };
  const drop = (m) => {
    if (!m) return;
    scene.remove(m);
    m.geometry && m.geometry.dispose();
    m.material && m.material.dispose();
  };

  // ── the cast ──
  function end(a, S, jump, hit) {
    if (S.done) return;
    S.done = !0;
    S.tEnd = S.tv;
    const v = S.v || { x: 0, y: 0, z: 0 },
      floor = groundAt(a.pos.x, a.pos.z, a.y || 0);
    if (jump) {
      a.vy = Math.min(12, Math.max(v.y, 0) * 0.8 + 5.5);
      a.onGround = !1;
      a.__carry = { x: v.x * 0.9, z: v.z * 0.9, t: 0 };
    } else if (hit && (a.y || 0) > floor + 0.5) {
      // against a wall above the floor: hang on it, as the old pull did. The swing is over once the chest is within
      // 1.8 m of the web, which on a flat approach can leave the body more than a metre short of the wall; the hang
      // code lets go of a hang that touches nothing, so the body would drop from the height it swung to. Close the
      // gap first (up to the wall, never through it).
      const gx = S.C.x - a.pos.x,
        gz = S.C.z - a.pos.z,
        gd = Math.hypot(gx, gz);
      if (gd > 0.01)
        for (let k = 0; k < 30; k++) {
          const px = a.pos.x + (gx / gd) * 0.1,
            pz = a.pos.z + (gz / gd) * 0.1;
          if (hitsWall(px, pz, a.y || 0) || Math.hypot(S.C.x - px, S.C.z - pz) < 0.3) break;
          a.pos.x = px;
          a.pos.z = pz;
        }
      a.__climbT = Math.max(a.__climbT || 0, 4);
      a.__hangY = a.y || 0;
      a.vy = 0;
    } else {
      a.vy = Math.min(v.y, 6);
      a.__carry = { x: v.x * 0.55, z: v.z * 0.55, t: 0 };
    }
  }
  CAST_EXT.y_webzip = () => {
    const c = player,
      a = aimPoint(RANGE);
    if (c.__swing) c.__swing.done || end(c, c.__swing, !1, !1);
    const yaw = c.yaw || 0,
      b = basis(c);
    const hands = [-1, 1].map((side) => handAt(c, side, { x: 0, y: 0, z: 0 }));
    const hit = !!(a && a.hit);
    const reachTo = hit ? { x: a.x, y: a.y || 0, z: a.z } : null;
    if (!hit) {
      // nothing to hold on to: the webs fall short, the charge comes back
      const L = RANGE * 0.5,
        pit = c.pitch || 0,
        e = { x: c.pos.x, y: (c.y || 0) + 1.45, z: c.pos.z };
      var miss = { x: e.x - Math.sin(yaw) * Math.cos(pit) * L, y: e.y + Math.sin(pit) * L - 0.6, z: e.z - Math.cos(yaw) * Math.cos(pit) * L };
      try {
        CAST_REFUND = !0;
      } catch (e) {}
      c === me() && "function" == typeof bannerMe && bannerMe("닿을 곳이 없습니다", "#cfd8dc");
    }
    const target = reachTo || miss,
      ay = target.y;
    // the two anchors sit a hand's width apart on the wall
    const A = [-1, 1].map((side) => ({ x: target.x + b.rx * 0.5 * side, y: ay + 0.12 * side, z: target.z + b.rz * 0.5 * side }));
    const S = {
      a: c,
      hit,
      A,
      C: target,
      hands,
      tv: 0,
      t: 0,
      done: !1,
      tEnd: 0,
      rope: 0,
      v: null,
      attached: !1,
      splat: [sprite("web"), sprite("web")],
      flash: [sprite("flash"), sprite("flash")],
      strands: [],
      speed: 0,
      landed: !1,
    };
    for (let h = 0; h < 2; h++) {
      const main = strand(0.024, 0.95),
        thin = strand(0.01, 0.7);
      scene.add(main);
      scene.add(thin);
      S.strands.push(main, thin);
    }
    if (hit) {
      const chest = { x: c.pos.x, y: (c.y || 0) + 1.2, z: c.pos.z };
      S.rope = Math.hypot(target.x - chest.x, target.y - chest.y, target.z - chest.z);
      c.__swing = S;
    } else c.__swing = null;
    sounds.launch(c.pos.x, c.pos.z);
    if (c === me()) FX.kick = 1;
    const hand = { x: 0, y: 0, z: 0 };
    abilSpawn({
      update(dt) {
        S.tv += dt;
        const t = S.tv;
        if (!c.alive && !S.done) {
          S.done = !0;
          S.tEnd = t;
        }
        if (!S.done && (t > MAXLIFE || (hit && !c.__swing))) {
          S.done = !0;
          S.tEnd = t;
        }
        if (!hit && t > 0.9) return !1;
        const gone = S.done ? (t - S.tEnd) / 0.34 : 0;
        if (gone >= 1) return !1;
        // flight of the tips; the second hand a breath later
        for (let h = 0; h < 2; h++) {
          const side = h ? 1 : -1,
            lag = h * 0.03,
            reach = smooth((t - lag) / (hit ? FLY : 0.3)),
            tight = !hit ? 0 : S.attached ? smooth((t - FLY) / 0.3) * 0.88 + 0.1 : 0,
            H = handAt(c, side, hand),
            sp = S.v ? Math.hypot(S.v.x, S.v.y, S.v.z) : 0,
            ph = h * 0.5;
          const ex = A[h];
          const from = S.done ? smooth(gone) * 0.96 : 0;
          const falling = !hit && t > 0.3 ? Math.min(1, (t - 0.3) / 0.6) : 0;
          const end2 = { x: ex.x, y: ex.y - falling * 3, z: ex.z };
          const hp = shape(H, end2, t, Math.max(0.02, reach), tight, from, sp, ph, 0);
          lay(S.strands[h * 2], hp);
          const thinPts = shape(H, end2, t + 0.05, Math.max(0.02, reach), tight, from, sp, ph + 0.31, 0.05);
          lay(S.strands[h * 2 + 1], thinPts);
          const fade = S.done ? 1 - smooth(gone) : !hit ? 1 - falling : 1;
          S.strands[h * 2].material.opacity = S.strands[h * 2].userData.op * fade;
          S.strands[h * 2 + 1].material.opacity = S.strands[h * 2 + 1].userData.op * fade;
          // a flash at the wrist as it fires, a web on the wall where it holds
          const fl = S.flash[h],
            ft = (t - lag) / 0.14;
          fl.visible = ft >= 0 && ft < 1;
          if (fl.visible) {
            fl.position.set(H.x, H.y, H.z);
            fl.scale.setScalar(0.55 * (1 - ft * 0.4));
            fl.material.opacity = 0.9 * (1 - ft);
          }
          const sl = S.splat[h],
            st = t - FLY - lag;
          sl.visible = hit && st >= 0 && !S.done;
          if (hit && st >= 0) {
            sl.visible = st < 2.2;
            sl.position.set(A[h].x, A[h].y, A[h].z);
            sl.scale.setScalar(1.5 * Math.min(1, st / 0.08 + 0.3));
            sl.material.opacity = 0.85 * (st < 1.6 ? 1 : 1 - (st - 1.6) / 0.6);
          }
        }
        if (hit && !S.landed && t >= FLY) {
          S.landed = !0;
          S.attached = !0;
          sounds.land(target.x, target.z);
          try {
            fxRing(target.x, target.z, 1.4, WEB, 0.35);
          } catch (e) {}
          sounds.pull(c.pos.x, c.pos.z, 1.1);
        }
      },
      dispose() {
        S.strands.forEach(drop);
        S.splat.forEach(drop);
        S.flash.forEach(drop);
        c.__swing === S && (c.__swing = null);
      },
    });
  };

  // ── the body: hanging from the rope, swinging, reeled in ──
  const hitsWall = (x, z, y) => collideXZ(x, z, y, 0.4);
  function swingStep(a, S, dt) {
    dt = Math.min(dt, 0.05);
    if (!a.alive) return end(a, S, !1, !1);
    S.t += dt;
    const inp = a.input,
      jump = !!(inp && inp.btn & BTN.JUMP);
    if (S.t < FLY) {
      // the wind-up: held where I stand while the tips fly out
      a.vy = 0;
      a.vel && a.vel.set(0, 0, 0);
      return;
    }
    if (!S.v) {
      // I keep what I was doing: running speed carries into the swing, with a hop off the ground
      S.v = { x: (a.vel && a.vel.x) || 0, y: a.onGround ? 6 : Math.max(a.vy || 0, 0), z: (a.vel && a.vel.z) || 0 };
      a.onGround = !1;
    }
    const k = S.t - FLY;
    if (jump && k > 0.3) return end(a, S, !0, !1);
    // the first moments are weight on the rope (a hop, a drop, a swing); the pull comes in after
    const ramp = smooth((k - 0.1) / 0.4),
      v = S.v;
    S.rope = Math.max(1.2, S.rope - REEL * ramp * dt);
    const cx = a.pos.x,
      cy = (a.y || 0) + 1.2,
      cz = a.pos.z,
      dx = S.C.x - cx,
      dy = S.C.y - cy,
      dz = S.C.z - cz,
      dist = Math.hypot(dx, dy, dz) || 0.01,
      nx = dx / dist,
      ny = dy / dist,
      nz = dz / dist;
    if (dist < 1.8 || S.rope <= 1.25) return end(a, S, !1, !0);
    // the rope pulls, gravity does not stop, the air takes a little
    v.x += nx * PULL * ramp * dt;
    v.y += ny * PULL * ramp * dt - GRAV * dt;
    v.z += nz * PULL * ramp * dt;
    const drag = Math.max(0, 1 - 0.3 * dt);
    v.x *= drag;
    v.y *= drag;
    v.z *= drag;
    const sp = Math.hypot(v.x, v.y, v.z);
    if (sp > VMAX) {
      const q = VMAX / sp;
      v.x *= q;
      v.y *= q;
      v.z *= q;
    }
    // move in short steps so a wall is found, not passed
    const steps = Math.max(1, Math.ceil((Math.hypot(v.x, v.y, v.z) * dt) / 0.45));
    for (let i = 0; i < steps; i++) {
      const nxp = a.pos.x + (v.x * dt) / steps,
        nzp = a.pos.z + (v.z * dt) / steps,
        nyp = (a.y || 0) + (v.y * dt) / steps;
      if (hitsWall(nxp, nzp, nyp)) return end(a, S, !1, !0);
      a.pos.x = nxp;
      a.pos.z = nzp;
      a.y = nyp;
    }
    // a rope does not get longer: whatever it would have stretched is taken back, and the speed along it is lost
    const ex = S.C.x - a.pos.x,
      ey = S.C.y - ((a.y || 0) + 1.2),
      ez = S.C.z - a.pos.z,
      d2 = Math.hypot(ex, ey, ez) || 0.01;
    if (d2 > S.rope) {
      const over = d2 - S.rope,
        ux = ex / d2,
        uy = ey / d2,
        uz = ez / d2;
      const px = a.pos.x + ux * over,
        pz = a.pos.z + uz * over;
      hitsWall(px, pz, a.y || 0) || ((a.pos.x = px), (a.pos.z = pz), (a.y = (a.y || 0) + uy * over));
      const out = -(v.x * ux + v.y * uy + v.z * uz);
      if (out > 0) {
        v.x += ux * out;
        v.y += uy * out;
        v.z += uz * out;
      }
    }
    const floor = groundAt(a.pos.x, a.pos.z, a.y || 0);
    if (a.y < floor) {
      a.y = floor;
      v.y = Math.max(0, v.y);
    }
    a.vy = 0;
    a.onGround = !1;
    a.vel && a.vel.set(0, 0, 0);
    S.speed = Math.hypot(v.x, v.y, v.z);
  }
  // after a let-go the speed fades over the next moments, instead of the run speed taking over at once
  function carryStep(a, dt) {
    const c = a.__carry;
    if (!c) return;
    c.t += dt;
    const f = Math.exp(-(a.onGround ? 9 : 1.9) * dt);
    c.x *= f;
    c.z *= f;
    if (c.t > 1.4 || Math.hypot(c.x, c.z) < 0.6) return void (a.__carry = null);
    "function" == typeof moveWithSlide && moveWithSlide(a.pos, c.x * dt, c.z * dt, a.y || 0, "undefined" != typeof PR ? PR : 0.8);
  }
  const _sim = simMove;
  simMove = function (a, dt) {
    const S = a && a.__swing;
    if (S && !S.done && S.hit) return void swingStep(a, S, dt || 0.016);
    const res = _sim.apply(this, arguments);
    a && a.__carry && carryStep(a, Math.min(dt || 0.016, 0.05));
    return res;
  };

  // ── the picture of the one who swings: wider, leaning, a little shake, speed lines ──
  const FX = { k: 0, lat: 0, kick: 0, t: 0 };
  window.SPIDER_SWING_FX = FX;
  let streak = null;
  const mount = () => {
    if (streak || "undefined" == typeof document) return;
    const st = document.createElement("style");
    st.textContent = "#swing-fx{position:fixed;inset:0;pointer-events:none;z-index:6;opacity:0;" + "background:repeating-conic-gradient(from 0deg at 50% 50%,rgba(255,255,255,0) 0 3deg,rgba(255,255,255,.55) 3.3deg 3.6deg,rgba(255,255,255,0) 4deg 8deg);" + "-webkit-mask:radial-gradient(ellipse at 50% 50%,transparent 36%,#000 86%);mask:radial-gradient(ellipse at 50% 50%,transparent 36%,#000 86%)}";
    document.head.appendChild(st);
    streak = document.createElement("div");
    streak.id = "swing-fx";
    const host = document.getElementById("edgefx");
    host && host.parentNode ? host.parentNode.insertBefore(streak, host) : document.body.appendChild(streak);
  };
  const _cam = followCamera;
  followCamera = function (e, t) {
    _cam.apply(this, arguments);
    try {
      const S = e && e.__swing,
        live = !!(S && !S.done && S.hit && S.v),
        dt = Math.min(t || 0.016, 0.05);
      FX.t += dt;
      const target = live ? Math.max(0.3, Math.min(1, S.speed / 34)) : S && !S.done && S.hit ? 0.25 : 0;
      FX.k += (target - FX.k) * Math.min(1, (target > FX.k ? 7 : 3.2) * dt);
      FX.kick = Math.max(0, FX.kick - 5 * dt);
      if (live) {
        const b = basis(e);
        FX.lat += ((S.v.x * b.rx + S.v.z * b.rz) - FX.lat) * Math.min(1, 6 * dt);
      } else FX.lat *= Math.max(0, 1 - 4 * dt);
      const on = motion() && (FX.k > 0.01 || FX.kick > 0.01);
      if (on) {
        const k = FX.k;
        camera.fov = viewFOV.now + 10 * k;
        camera.updateProjectionMatrix();
        camera.rotation.z += -(FX.lat / 40) * 0.22 * k + 0.02 * k * Math.sin(FX.t * 5) + 0.01 * k * Math.sin(FX.t * 23);
        camera.rotation.x += 0.007 * k * Math.sin(FX.t * 31) + 0.035 * FX.kick;
        camera.position.y += 0.012 * k * Math.sin(FX.t * 37);
        camera.position.x += 0.008 * k * Math.sin(FX.t * 29 + 1);
      }
      mount();
      if (streak) streak.style.opacity = on ? String(Math.min(0.5, FX.k * 0.5)) : "0";
    } catch (err) {
      console.warn("swing view", err);
    }
  };
  window.SPIDER_SWING = { RANGE, FLY };
})();
