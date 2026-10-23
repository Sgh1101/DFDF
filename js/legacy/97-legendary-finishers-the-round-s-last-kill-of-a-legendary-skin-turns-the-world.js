(() => {
  // Legendary finishers: in a standard match the kill that ends the round, made with a legendary skin, plays a
  // short cinematic over the ordinary finisher ring (game-events.js calls FINISHER_LEGEND.play): the world's
  // sky and fog turn to the skin's colour, a screen glow, and a signature figure over where the target fell
  // (a serpent that coils up, a firebird's wings, a storm of bolts, a ring of laurel, slashes for the knives...).
  // Pure show: it never touches the fight, is cleaned up with the other finishers when the next round starts,
  // and runs for everyone in the room because the finisher event is itself shared.
  if ("undefined" == typeof addFx || "undefined" == typeof scene) return;
  const q = () => Math.max(.35, Math.min(1, GFX.fx));
  const hex = (c) => new T.Color(c);
  const mat = (c, o, solid) => new T.MeshBasicMaterial({ color: c, transparent: !0, opacity: o == null ? 1 : o, depthWrite: !1, blending: solid ? T.NormalBlending : T.AdditiveBlending, side: T.DoubleSide });
  const ease = (k) => k * k * (3 - 2 * k);
  const hold = (t, a, b) => (t < a ? ease(t / a) : t > b ? ease(Math.max(0, (1 - t) / (1 - b))) : 1); // 0 → 1 → 0

  // each legendary: world colour, glow colour (screen), the figure, its two colours
  const THEMES = {
    lava: { world: 0x6a1500, glow: "255,90,20", fig: "serpent", c: [0xff5a14, 0xffd36a] },
    galaxy: { world: 0x1c0a52, glow: "140,90,255", fig: "stars", c: [0xa070ff, 0x8ce8ff] },
    phoenix: { world: 0x6a2a00, glow: "255,160,40", fig: "wings", c: [0xff7a1c, 0xffe27a] },
    storm: { world: 0x0a1c40, glow: "90,160,255", fig: "bolts", c: [0x9fd2ff, 0xffffff], flicker: !0 },
    abyss: { world: 0x00306e, glow: "30,140,255", fig: "serpent", c: [0x27c9ff, 0x2cffd0] },
    synth: { world: 0x3a0a5a, glow: "255,60,200", fig: "grid", c: [0xff3fd0, 0x3ff3ff] },
    opal: { world: 0x30284a, glow: "220,200,255", fig: "serpent", c: [0xffa6e8, 0x9ff3ff], rainbow: !0 },
    laurel: { world: 0x4a3a08, glow: "255,215,90", fig: "laurel", c: [0xf2c94c, 0xfff3b0] },
    champion: { world: 0x2a0f58, glow: "190,110,255", fig: "serpent", c: [0xb35bff, 0xffc24d], extra: "waves" },
    karambit: { world: 0x5a0a22, glow: "255,60,100", fig: "slash", c: [0xff3b6b, 0xffffff] },
    butterfly: { world: 0x083a5a, glow: "60,200,255", fig: "slash", c: [0x3fd0ff, 0xffffff] },
    stiletto: { world: 0x241a40, glow: "170,130,255", fig: "slash", c: [0xb18bff, 0xffffff] },
  };
  const ring = (r, tube) => new T.TorusGeometry(r, tube, 6, 48);

  // ── the world: sky and fog fade to the colour and back; a glowing screen edge ──
  let tint = null;
  function restore() {
    if (!tint) return;
    try {
      scene.background && scene.background.copy && scene.background.copy(tint.bg);
      scene.fog && scene.fog.color.copy(tint.fog);
    } catch (e) {}
    tint = null;
    const el = document.getElementById("legendFinish");
    el && (el.style.opacity = "0");
  }
  function world(th, life) {
    const started = performance.now();
    if (!tint) tint = { bg: scene.background && scene.background.clone ? scene.background.clone() : hex(0), fog: scene.fog ? scene.fog.color.clone() : hex(0) };
    const base = tint,
      target = hex(th.world),
      work = new T.Color();
    let el = document.getElementById("legendFinish");
    if (!el) {
      el = document.createElement("div");
      el.id = "legendFinish";
      el.setAttribute("aria-hidden", "true");
      el.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:30;opacity:0;transition:opacity .25s";
      document.body.appendChild(el);
    }
    const wc = `${(th.world >> 16) & 255},${(th.world >> 8) & 255},${th.world & 255}`;
    el.style.background = `radial-gradient(ellipse at center, rgba(${wc},.3) 0%, rgba(${wc},.62) 100%)`;
    el.style.boxShadow = `inset 0 0 240px 30px rgba(${th.glow},.55)`;
    const ctl = new T.Group();
    ctl.userData.noCollide = !0;
    addFx(ctl, life, (o, t) => {
      if (life === 8) t = Math.min(1, Math.max(t, (performance.now() - started) / 8000));
      if (tint !== base) return; // a newer finisher or a new round took over
      let k = hold(t, 0.12, 0.7);
      th.flicker && (k *= 0.7 + 0.3 * Math.abs(Math.sin(t * 38) * Math.sin(t * 11)));
      scene.background && scene.background.copy && scene.background.copy(base.bg).lerp(target, 0.9 * k);
      scene.fog && scene.fog.color.copy(base.fog).lerp(target, 0.9 * k);
      el.style.opacity = String(Math.min(1, k * 1.1));
      if (t > 0.985) restore();
    });
  }

  // ── figures ──
  function serpent(g, th, life) {
    // a long coiling body: a line of glowing beads that winds up around the spot, head first
    const n = Math.round(30 * q()) + 8,
      beads = [],
      col = new T.Color();
    for (let i = 0; i < n; i++) {
      const head = 0 === i,
        m = new T.Mesh(head ? new T.OctahedronGeometry(0.26) : new T.SphereGeometry(0.2 - (i / n) * 0.11, 10, 8), mat(th.c[0], 1, !0));
      m.userData.i = i;
      g.add(m);
      beads.push(m);
      if (head) {
        for (const s of [-1, 1]) {
          const eye = new T.Mesh(new T.SphereGeometry(0.06, 6, 4), mat(0xffffff, 1, !0));
          eye.position.set(0.12 * s, 0.06, -0.12);
          m.add(eye);
        }
      }
    }
    const rainbow = th.rainbow,
      A = hex(th.c[0]),
      B = hex(th.c[1]);
    return (t) => {
      const lead = t * 4.2; // how far the head has travelled along the path
      beads.forEach((m, i) => {
        const s = lead - i * 0.115;
        if (s < 0) return void (m.visible = !1);
        const ang = s * 4.4,
          rad = 0.55 + 0.45 * Math.sin(s * 2.1) + s * 0.12,
          y = Math.min(3.6, s * 1.05) + 0.1 * Math.sin(s * 7 + i);
        m.visible = !0;
        m.position.set(Math.cos(ang) * rad, y, Math.sin(ang) * rad);
        m.scale.setScalar(m.userData.i ? 1 : 1.25);
        rainbow ? col.setHSL((i / n + t * 1.2) % 1, 0.9, 0.62) : col.copy(A).lerp(B, i / n);
        m.material.color.copy(col);
        m.material.opacity = 0.95 * hold(t, 0.08, 0.72) * (1 - 0.45 * (i / n));
        if (!i) m.rotation.set(0, -ang, 0);
      });
    };
  }
  function wings(g, th) {
    // a firebird: a fan of feathers on each side that beat, embers lifting off them
    const sides = [],
      F = Math.round(7 * q()) + 3;
    for (const sd of [-1, 1]) {
      const wing = new T.Group();
      wing.position.set(0, 1.1, 0);
      for (let i = 0; i < F; i++) {
        const f = new T.Mesh(new T.PlaneGeometry(0.34, 1.7 - i * 0.07), mat(i % 2 ? th.c[1] : th.c[0]));
        f.geometry.translate(0, 0.85, 0);
        f.userData.i = i;
        wing.add(f);
      }
      g.add(wing);
      sides.push([wing, sd]);
    }
    const embers = [];
    for (let i = 0; i < Math.round(26 * q()); i++) {
      const e = new T.Mesh(new T.TetrahedronGeometry(0.06), mat(th.c[1]));
      e.userData.a = Math.random() * 6.28;
      e.userData.r = 0.3 + Math.random() * 1.6;
      e.userData.s = 0.6 + Math.random() * 1.2;
      g.add(e);
      embers.push(e);
    }
    return (t) => {
      const open = hold(t, 0.2, 0.75),
        beat = Math.sin(t * 20) * 0.18;
      sides.forEach(([wing, sd]) => {
        wing.children.forEach((f, i) => {
          f.rotation.set(0, 0, sd * (0.3 + i * 0.2 + beat * (1 + i * 0.12)) * (0.5 + open * 0.7) - sd * 1.4 * 0);
          f.rotation.z = -sd * (0.25 + i * (0.2 + beat * 0.2)) * (0.3 + open);
          f.material.opacity = 0.85 * open;
        });
        wing.rotation.y = sd * 0.35;
      });
      embers.forEach((e) => {
        const u = e.userData;
        e.position.set(Math.cos(u.a + t * 2) * u.r, 0.2 + t * 3.4 * u.s, Math.sin(u.a + t * 2) * u.r);
        e.material.opacity = (1 - t) * 0.9;
      });
    };
  }
  function bolts(g, th) {
    // forked bolts coming down around the spot, re-flashing as they go
    const list = [],
      n = Math.round(6 * q()) + 2;
    for (let b = 0; b < n; b++) {
      const pts = [],
        ang = (b / n) * 6.28 + Math.random(),
        r = 0.6 + Math.random() * 1.8;
      let x = Math.cos(ang) * r,
        z = Math.sin(ang) * r;
      for (let y = 14; y >= 0; y -= 1.4) {
        pts.push(new T.Vector3(x, y, z));
        x += (Math.random() - 0.5) * 1.2;
        z += (Math.random() - 0.5) * 1.2;
      }
      pts.push(new T.Vector3(Math.cos(ang) * r, 0, Math.sin(ang) * r));
      const line = new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: th.c[b % 2], transparent: !0, opacity: 0, depthWrite: !1 }));
      line.material.color.multiplyScalar(2);
      line.userData.at = 0.05 + (b / n) * 0.5;
      g.add(line);
      list.push(line);
    }
    const shock = new T.Mesh(ring(1, 0.05), mat(th.c[0]));
    shock.rotation.x = Math.PI / 2;
    g.add(shock);
    return (t) => {
      list.forEach((l) => {
        const k = t - l.userData.at;
        l.material.opacity = k < 0 || k > 0.3 ? 0 : (Math.sin(k * 90) > -0.3 ? 1 : 0.3) * (1 - k / 0.3);
      });
      shock.scale.setScalar(0.3 + t * 5);
      shock.material.opacity = 0.8 * (1 - t);
    };
  }
  function stars(g, th) {
    // a galaxy: three arms of stars turning slowly out from the spot, a disc of light under it
    const arms = [],
      per = Math.round(18 * q()) + 6;
    for (let a = 0; a < 3; a++)
      for (let i = 0; i < per; i++) {
        const s = new T.Mesh(new T.OctahedronGeometry(0.05 + (i % 3) * 0.02), mat(i % 2 ? th.c[1] : th.c[0]));
        s.userData.a = (a / 3) * 6.28;
        s.userData.k = i / per;
        g.add(s);
        arms.push(s);
      }
    const disc = new T.Mesh(new T.CircleGeometry(1, 40), mat(th.c[0], 0.3));
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.04;
    g.add(disc);
    return (t) => {
      const open = hold(t, 0.15, 0.7);
      arms.forEach((s) => {
        const u = s.userData,
          ang = u.a + u.k * 4.2 + t * 2.4,
          r = (0.2 + u.k * 3) * open;
        s.position.set(Math.cos(ang) * r, 0.5 + Math.sin(u.k * 9 + t * 5) * 0.35 + u.k * 0.8, Math.sin(ang) * r);
        s.rotation.set(t * 5, ang, 0);
        s.material.opacity = open * (1 - u.k * 0.5);
      });
      disc.scale.setScalar(3.2 * open);
      disc.material.opacity = 0.3 * open;
    };
  }
  function grid(g, th) {
    // a neon floor: rings and spokes light up outward, a sun rising from the middle
    const parts = [];
    for (let i = 1; i <= 4; i++) {
      const r = new T.Mesh(ring(i * 0.8, 0.025), mat(i % 2 ? th.c[0] : th.c[1]));
      r.rotation.x = Math.PI / 2;
      r.position.y = 0.05;
      r.userData.k = i / 4;
      g.add(r);
      parts.push(r);
    }
    for (let i = 0; i < 12; i++) {
      const s = new T.Mesh(new T.PlaneGeometry(3.4, 0.03), mat(th.c[1]));
      s.rotation.set(-Math.PI / 2, 0, (i / 12) * Math.PI);
      s.position.y = 0.05;
      s.userData.k = 0.6;
      g.add(s);
      parts.push(s);
    }
    const sun = new T.Mesh(new T.SphereGeometry(0.7, 20, 14), mat(th.c[0]));
    g.add(sun);
    const beam = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 12, 8, 1, !0), mat(th.c[1], 0.6));
    beam.position.y = 6;
    g.add(beam);
    return (t) => {
      const open = hold(t, 0.12, 0.72);
      parts.forEach((p) => {
        p.material.opacity = open * (0.4 + 0.6 * Math.abs(Math.sin(t * 8 + p.userData.k * 6)));
        p.scale.setScalar(0.4 + open * 0.6);
      });
      sun.position.y = 0.2 + t * 3.2;
      sun.scale.setScalar(0.6 + 0.5 * open);
      sun.material.opacity = open;
      beam.material.opacity = 0.55 * open;
    };
  }
  function laurel(g, th) {
    // a wreath of golden leaves rising and turning, a pillar of light inside it
    const leaves = [],
      n = Math.round(20 * q()) + 8;
    for (let i = 0; i < n; i++) {
      const lf = new T.Mesh(new T.SphereGeometry(0.16, 8, 6), mat(i % 2 ? th.c[1] : th.c[0]));
      lf.scale.set(0.5, 0.18, 1.4);
      lf.userData.a = (i / n) * 6.28;
      g.add(lf);
      leaves.push(lf);
    }
    const beam = new T.Mesh(new T.CylinderGeometry(0.4, 0.4, 14, 14, 1, !0), mat(th.c[1], 0.35));
    beam.position.y = 7;
    g.add(beam);
    return (t) => {
      const open = hold(t, 0.15, 0.72),
        rad = 0.7 + 0.5 * open;
      leaves.forEach((lf, i) => {
        const a = lf.userData.a + t * 3.2;
        lf.position.set(Math.cos(a) * rad, 0.4 + t * 2.8 + Math.sin(a * 3) * 0.12, Math.sin(a) * rad);
        lf.rotation.set(0, -a, 0.5);
        lf.material.opacity = 0.95 * open;
      });
      beam.material.opacity = 0.35 * open;
      beam.scale.set(0.6 + 0.4 * open, 1, 0.6 + 0.4 * open);
    };
  }
  function slash(g, th) {
    // knives: three crossing cuts of light, each swept across in turn
    const cuts = [];
    for (let i = 0; i < 3; i++) {
      const arc = new T.Mesh(new T.TorusGeometry(1.5, 0.045, 5, 36, 2.2), mat(i % 2 ? th.c[1] : th.c[0]));
      arc.position.y = 1.1;
      arc.rotation.set(0.2 * (i - 1), (i / 3) * 6.28 * 0.5, -0.9 + i * 0.9);
      arc.userData.at = 0.08 + i * 0.16;
      g.add(arc);
      cuts.push(arc);
    }
    return (t) => {
      cuts.forEach((a) => {
        const k = (t - a.userData.at) / 0.35;
        if (k < 0 || k > 1) return void (a.material.opacity = 0);
        a.scale.setScalar(0.6 + k * 0.7);
        a.rotation.z += 0.12;
        a.material.opacity = 0.95 * (1 - k * k);
      });
    };
  }
  const FIG = { serpent, wings, bolts, stars, grid, laurel, slash };

  function play(event, skin) {
    const th = skin && THEMES[skin.id];
    if (!th || !FIG[th.fig] || event.x == null) return !1;
    const started = performance.now(), life = window.GAME_RULES && GAME_RULES.championsSkin(skin.id) ? 8 : 2.9,
      g = new T.Group();
    g.position.set(event.x, Math.max(0, event.y - 0.6), event.z);
    g.userData.noCollide = !0;
    const step = FIG[th.fig](g, th, life);
    window.FINISHERS && FINISHERS.active.add(g);
    addFx(g, life, (o, t) => {
      if (life === 8) t = Math.min(1, Math.max(t, (performance.now() - started) / 8000));
      step(t);
      if (t > 0.985 && life !== 8) window.FINISHERS && FINISHERS.active.delete(o);
    });
    world(th, life);
    return !0;
  }
  // a new round (or leaving the match) ends it at once, sky included
  if ("function" == typeof startRound) {
    const _sr = startRound;
    startRound = function () {
      restore();
      return _sr.apply(this, arguments);
    };
  }
  window.FINISHER_LEGEND = { play, restore, themes: THEMES };
})();
