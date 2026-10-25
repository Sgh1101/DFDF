// Abilities you can see. A slow, a root, a stun, a shield or a reveal changed numbers on the fighter it hit and
// nothing on the fighter itself, so a hit ability looked like a miss. Every fighter now wears what is on them:
//   slow      an ice-blue ring at the feet with shards turning round it
//   root      a green ring with thorns standing up
//   concuss   stars circling the head
//   suppress  a gold halo (the weapon is sealed)
//   vuln      a pale blue band round the chest, pulsing
//   shield    a clear bubble round the body (gold while invulnerable)
//   reveal    a red diamond over the head
//   blind     a white flare at the eyes
// and a small line over the head names what is on them ("둔화 · 노출"). When someone else casts, the ability's
// name rises over their head in their agent's colour (bigger and gold for an ultimate). Your own statuses show in
// the status row under the crosshair, which now also lists slow, root, blind, shield and reveal. Nothing is drawn
// on your own body in first person, and nothing shows through walls.
(() => {
  if ("undefined" == typeof T || "function" != typeof castAbility || "function" != typeof abilTick || "undefined" == typeof scene) return;

  const NAMES = {
    slowT: ["둔화", "#5fd8ff"],
    root: ["속박", "#7dff6a"],
    blind: ["실명", "#ffffff"],
    shielded: ["보호막", "#66e0ff"],
    revealed: ["노출", "#ff5a5a"],
  };
  // the status row under the crosshair: the engine's own list, plus the ones it left out
  if ("undefined" != typeof STATUS_LABEL)
    for (const k in NAMES) STATUS_LABEL.some((s) => s[0] === k) || STATUS_LABEL.push([k, NAMES[k][0], NAMES[k][1]]);
  const LABEL = new Map(("undefined" != typeof STATUS_LABEL ? STATUS_LABEL : []).map((s) => [s[0], s[1]]));
  for (const k in NAMES) LABEL.has(k) || LABEL.set(k, NAMES[k][0]);
  // statuses shorter than this are the blink of a respawn or a dash, not something to show
  const MIN = { invuln: 0.5 };
  const on = (a, k) => (a[k] || 0) > (MIN[k] || 0);

  // ── text over a head (one texture per text and colour) ──
  const TEX = new Map();
  function textTex(text, color, big) {
    const key = text + "|" + color + "|" + (big ? 1 : 0);
    let t = TEX.get(key);
    if (t) return t;
    if (TEX.size > 160) {
      for (const v of TEX.values()) v.tex.dispose();
      TEX.clear();
    }
    const px = big ? 64 : 44,
      cv = document.createElement("canvas"),
      cx = cv.getContext("2d");
    cx.font = `900 ${px}px 'Noto Sans KR', system-ui, sans-serif`;
    const w = Math.ceil(cx.measureText(text).width) + px,
      h = Math.ceil(px * 1.5);
    cv.width = w;
    cv.height = h;
    cx.font = `900 ${px}px 'Noto Sans KR', system-ui, sans-serif`;
    cx.textAlign = "center";
    cx.textBaseline = "middle";
    cx.lineJoin = "round";
    cx.lineWidth = px * 0.22;
    cx.strokeStyle = "rgba(6,8,12,.9)";
    cx.strokeText(text, w / 2, h / 2);
    cx.fillStyle = color;
    cx.fillText(text, w / 2, h / 2);
    const tex = new T.CanvasTexture(cv);
    "SRGBColorSpace" in T && (tex.colorSpace = T.SRGBColorSpace);
    t = { tex, aspect: w / h };
    TEX.set(key, t);
    return t;
  }
  function sprite(text, color, height, big) {
    const t = textTex(text, color, big),
      s = new T.Sprite(new T.SpriteMaterial({ map: t.tex, transparent: !0, depthWrite: !1 }));
    s.scale.set(height * t.aspect, height, 1);
    s.renderOrder = 5;
    s.userData.text = text;
    return s;
  }
  function setText(s, text, color, height) {
    if (s.userData.text === text) return;
    const t = textTex(text, color, !1);
    s.material.map = t.tex;
    s.material.needsUpdate = !0;
    s.scale.set(height * t.aspect, height, 1);
    s.userData.text = text;
  }

  // ── shared shapes ──
  const G = {
    ring: new T.RingGeometry(0.62, 0.8, 40),
    torus: new T.TorusGeometry(0.62, 0.05, 6, 36),
    halo: new T.TorusGeometry(0.3, 0.035, 6, 28),
    band: new T.TorusGeometry(0.58, 0.035, 6, 36),
    shard: new T.OctahedronGeometry(0.09),
    thorn: new T.ConeGeometry(0.06, 0.42, 5),
    star: new T.OctahedronGeometry(0.085),
    bubble: new T.SphereGeometry(1, 24, 16),
    diamond: new T.OctahedronGeometry(0.17),
    flare: new T.CircleGeometry(0.2, 20),
  };
  for (const g of Object.values(G)) g.userData.shared = !0;
  const mat = (c, o, extra) => {
    const m = new T.MeshBasicMaterial(Object.assign({ color: c, transparent: !0, opacity: o, depthWrite: !1, side: T.DoubleSide }, extra || {}));
    m.userData.shared = !0;
    return m;
  };
  const M = {
    slow: mat(0x5fd8ff, 0.75),
    root: mat(0x7dff6a, 0.85),
    concuss: mat(0xd6c6ff, 0.95),
    suppress: mat(0xffd166, 0.9),
    vuln: mat(0x9ab8ff, 0.8),
    shield: mat(0x66e0ff, 0.16, { side: T.FrontSide }),
    invuln: mat(0xffd54a, 0.18, { side: T.FrontSide }),
    reveal: mat(0xff4b4b, 0.95),
    blind: mat(0xffffff, 0.9),
  };

  const PARTS = {
    slowT(g) {
      const r = new T.Mesh(G.ring, M.slow);
      r.rotation.x = -Math.PI / 2;
      r.position.y = 0.06;
      g.add(r);
      const spin = new T.Group();
      for (let i = 0; i < 5; i++) {
        const s = new T.Mesh(G.shard, M.slow), a = (i / 5) * Math.PI * 2;
        s.position.set(Math.cos(a) * 0.72, 0.25 + 0.12 * (i % 2), Math.sin(a) * 0.72);
        spin.add(s);
      }
      g.add(spin);
      return (t, m) => (spin.rotation.y = t * 1.6 * m);
    },
    root(g) {
      const r = new T.Mesh(G.torus, M.root);
      r.rotation.x = -Math.PI / 2;
      r.position.y = 0.08;
      g.add(r);
      for (let i = 0; i < 7; i++) {
        const s = new T.Mesh(G.thorn, M.root), a = (i / 7) * Math.PI * 2;
        s.position.set(Math.cos(a) * 0.62, 0.2, Math.sin(a) * 0.62);
        s.rotation.z = -Math.cos(a) * 0.35;
        s.rotation.x = Math.sin(a) * 0.35;
        g.add(s);
      }
    },
    concuss(g, H) {
      const spin = new T.Group();
      spin.position.y = H + 0.2;
      for (let i = 0; i < 3; i++) {
        const s = new T.Mesh(G.star, M.concuss), a = (i / 3) * Math.PI * 2;
        s.position.set(Math.cos(a) * 0.34, 0, Math.sin(a) * 0.34);
        spin.add(s);
      }
      g.add(spin);
      return (t, m) => ((spin.rotation.y = t * 4 * m), (spin.position.y = H + 0.2 + Math.sin(t * 5) * 0.04 * m));
    },
    suppress(g, H) {
      const h = new T.Mesh(G.halo, M.suppress);
      h.rotation.x = -Math.PI / 2;
      h.position.y = H + 0.32;
      g.add(h);
    },
    vuln(g, H) {
      const b = new T.Mesh(G.band, M.vuln);
      b.rotation.x = -Math.PI / 2;
      b.position.y = H * 0.6;
      g.add(b);
      return (t, m) => b.scale.setScalar(1 + 0.08 * Math.sin(t * 6) * m);
    },
    shielded(g, H) {
      const b = new T.Mesh(G.bubble, M.shield);
      b.scale.set(0.85, H * 0.62, 0.85);
      b.position.y = H * 0.55;
      g.add(b);
      return (t, m) => (M.shield.opacity = 0.13 + 0.05 * Math.sin(t * 3) * m);
    },
    invuln(g, H) {
      const b = new T.Mesh(G.bubble, M.invuln);
      b.scale.set(0.9, H * 0.64, 0.9);
      b.position.y = H * 0.55;
      g.add(b);
    },
    revealed(g, H) {
      const d = new T.Mesh(G.diamond, M.reveal);
      d.scale.y = 1.5;
      d.position.y = H + 0.7;
      g.add(d);
      return (t, m) => ((d.rotation.y = t * 2.4 * m), (d.position.y = H + 0.7 + Math.sin(t * 3) * 0.05 * m));
    },
    blind(g, H) {
      const f = new T.Mesh(G.flare, M.blind);
      f.position.y = H - 0.12;
      g.add(f);
      return (t, m, cam) => (f.quaternion.copy(cam.quaternion), f.scale.setScalar(1 + 0.25 * Math.sin(t * 9) * m));
    },
  };
  const KEYS = Object.keys(PARTS);

  // ── per fighter ──
  const FX = new Map();
  function rigOf(a) {
    let r = FX.get(a);
    if (!r) {
      const g = new T.Group();
      g.userData.keep = !0;
      g.userData.statusFx = !0;
      r = { g, parts: {}, label: null };
      FX.set(a, r);
    }
    r.g.parent !== scene && scene.add(r.g);
    return r;
  }
  function drop(a) {
    const r = FX.get(a);
    if (!r) return;
    r.g.parent && r.g.parent.remove(r.g);
    r.label && r.label.material.dispose();
    FX.delete(a);
  }
  const head = () => ("undefined" != typeof EYE ? EYE : 1.85) + 0.12;
  const motion = () => ("undefined" != typeof SETTINGS && 0 === SETTINGS.motion ? 0 : 1);

  function update() {
    const list = "undefined" != typeof world && world && Array.isArray(world.actors) ? world.actors : [];
    const seen = new Set(), t = performance.now() / 1000, m = motion(), H = head(), cam = camera;
    for (const a of list) {
      if (!a || !a.pos) continue;
      seen.add(a);
      const active = a.alive !== !1 ? KEYS.filter((k) => on(a, k)) : [],
        named = a.alive !== !1 ? [...LABEL.keys()].filter((k) => on(a, k)) : [];
      const r = FX.get(a);
      if (!active.length && !named.length) {
        r && (r.g.visible = !1);
        continue;
      }
      const rig = rigOf(a), y = a.y || 0;
      rig.g.position.set(a.pos.x, y, a.pos.z);
      // first person: the camera is inside this head, so nothing is drawn on it
      rig.g.visible = Math.hypot(cam.position.x - a.pos.x, cam.position.y - (y + H), cam.position.z - a.pos.z) > 1.2;
      for (const k of KEYS) {
        let p = rig.parts[k];
        const want = active.includes(k);
        if (want && !p) {
          const g = new T.Group();
          rig.g.add(g);
          p = rig.parts[k] = { g, tick: PARTS[k](g, H) };
        }
        if (p) {
          p.g.visible = want;
          want && p.tick && p.tick(t, m, cam);
        }
      }
      const text = named.map((k) => LABEL.get(k)).join(" · ");
      if (text) {
        rig.label ? setText(rig.label, text, "#ffffff", 0.24) : rig.g.add((rig.label = sprite(text, "#ffffff", 0.24)));
        rig.label.position.y = H + 0.42;
        rig.label.visible = !0;
      } else rig.label && (rig.label.visible = !1);
    }
    for (const a of [...FX.keys()]) seen.has(a) || drop(a);
    tickCallouts(t);
  }

  // ── the ability's name over the one who cast it ──
  const CALL = [];
  function callout(a, def) {
    if (!a || !a.pos || !def || !def.name) return;
    const me = "function" == typeof localActor ? localActor() : null;
    if (me && a === me) return;
    const ult = !!def.ult,
      color = ult ? "#ffd54a" : (a.agent && a.agent.color) || "#ffffff",
      s = sprite(def.name, color, ult ? 0.52 : 0.4, ult);
    s.userData.keep = !0;
    const y0 = (a.y || 0) + head() + 0.85;
    s.position.set(a.pos.x, y0, a.pos.z);
    scene.add(s);
    // a second cast before the first faded pushes the old name up
    for (const c of CALL) c.a === a && (c.y0 += 0.36);
    CALL.push({ s, a, y0, t0: performance.now() / 1000, life: ult ? 2.2 : 1.5 });
  }
  function tickCallouts(t) {
    for (let i = CALL.length - 1; i >= 0; i--) {
      const c = CALL[i], k = (t - c.t0) / c.life;
      if (k >= 1 || !c.a.pos) {
        c.s.parent && c.s.parent.remove(c.s);
        c.s.material.dispose();
        CALL.splice(i, 1);
        continue;
      }
      c.s.position.set(c.a.pos.x, c.y0 + k * 0.45, c.a.pos.z);
      c.s.material.opacity = k < 0.12 ? k / 0.12 : k > 0.7 ? (1 - k) / 0.3 : 1;
    }
  }

  const _cast = castAbility;
  castAbility = function (type, def) {
    const who = "undefined" != typeof player ? player : null;
    const r = _cast.apply(this, arguments);
    try {
      // a cast at nothing gives the charge back: no name for that
      ("undefined" == typeof CAST_REFUND || !CAST_REFUND) && callout(who, def);
    } catch (e) {}
    return r;
  };
  const _tick = abilTick;
  abilTick = function (dt) {
    const r = _tick.apply(this, arguments);
    try {
      update();
    } catch (e) {}
    return r;
  };

  window.ABILITY_VISIBILITY = { fx: FX, callouts: CALL, labels: LABEL, update };
})();
