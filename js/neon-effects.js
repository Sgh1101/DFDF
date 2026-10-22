(() => {
  'use strict';
  // Neon's electric effects, drawn by this game: a bolt of light with a crackling trail, the charge that gathers where it
  // lands and bursts, the two walls of the lane with current running up them, the orb that runs ahead to lay them, and
  // sparks off the feet while sprinting. Plain three.js meshes, lines and sprites made here; no outside art.
  const S = window.NEON_EFFECTS = { active: new Set() };
  const CYAN = 0x41cfff, YELLOW = 0xf7ef69, WHITE = 0xeaffff;
  const add = (o) => (o.userData.noMerge = true, o.frustumCulled = false, o);
  const glowMat = (color, opacity) => new T.MeshBasicMaterial({ color, transparent: true, opacity, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, toneMapped: false });
  const lineMat = (color, opacity) => new T.LineBasicMaterial({ color, transparent: true, opacity, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false });
  // a soft round glow, drawn once on a canvas
  let glowTex = null;
  function glowTexture() {
    if (glowTex) return glowTex;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.75)'); r.addColorStop(0.6, 'rgba(255,255,255,.18)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    glowTex = new T.CanvasTexture(c); glowTex.userData = { keep: true };
    return glowTex;
  }
  // a four-pointed spark, drawn once
  let sparkTex = null;
  S.sparkTexture = () => {
    if (sparkTex) return sparkTex;
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d'); g.translate(16, 16);
    const r = g.createRadialGradient(0, 0, 0, 0, 0, 16); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    for (let k = 0; k < 2; k++) { g.rotate(Math.PI / 4 * k); g.beginPath(); g.moveTo(0, -15); g.lineTo(2.2, 0); g.lineTo(0, 15); g.lineTo(-2.2, 0); g.closePath(); g.fill(); g.beginPath(); g.moveTo(-15, 0); g.lineTo(0, 2.2); g.lineTo(15, 0); g.lineTo(0, -2.2); g.closePath(); g.fill(); }
    sparkTex = new T.CanvasTexture(c); sparkTex.userData = { keep: true };
    return sparkTex;
  };
  const sprite = (color, size, opacity) => { const s = new T.Sprite(new T.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false })); s.scale.setScalar(size); return add(s); };
  // a jagged line between two points, new zigzags every call
  function zig(line, a, b, jitter, n) {
    const p = line.geometry.attributes.position, k = Math.min(n, p.count);
    for (let i = 0; i < k; i++) {
      const f = i / (k - 1), j = i === 0 || i === k - 1 ? 0 : jitter;
      p.setXYZ(i, a.x + (b.x - a.x) * f + (Math.random() - .5) * j, a.y + (b.y - a.y) * f + (Math.random() - .5) * j, a.z + (b.z - a.z) * f + (Math.random() - .5) * j);
    }
    line.geometry.setDrawRange(0, k); p.needsUpdate = true;
  }
  const jagged = (n, color, opacity) => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array(n * 3), 3)); return add(new T.Line(g, lineMat(color, opacity))); };
  function create(name) {
    const root = new T.Group(); root.name = name; root.userData.neonEffects = true; root.userData.noMerge = true; S.active.add(root);
    const dispose = () => {
      root.removeFromParent();
      root.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      S.active.delete(root);
    };
    return { root, dispose };
  }

  // ── the bolt: a hot core, a glow, a fading trail of where it has been, and arcs crackling round it ──
  S.bolt = () => {
    const fx = create('neon-relaybolt'), N = 18;
    const core = add(new T.Mesh(new T.SphereGeometry(0.11, 12, 8), glowMat(WHITE, 1)));
    const halo = sprite(CYAN, 1.3, 0.9), outer = sprite(YELLOW, 0.7, 0.55);
    const trailGeo = new T.BufferGeometry(); trailGeo.setAttribute('position', new T.BufferAttribute(new Float32Array(N * 3), 3));
    const trail = add(new T.Line(trailGeo, lineMat(CYAN, 0.85)));
    const arcs = [0, 1, 2].map(() => jagged(6, YELLOW, 0.9));
    fx.root.add(core, halo, outer, trail, ...arcs);
    const past = [];
    fx.updateBolt = (point, velocity, time) => {
      core.position.copy(point); halo.position.copy(point); outer.position.copy(point);
      halo.scale.setScalar(1.1 + 0.25 * Math.sin(time * 40));
      past.unshift(point.clone()); past.length > N && past.pop();
      const p = trailGeo.attributes.position;
      past.forEach((q, i) => p.setXYZ(i, q.x, q.y, q.z)); trailGeo.setDrawRange(0, past.length); p.needsUpdate = true;
      for (const a of arcs) {
        const d = new T.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).setLength(0.35 + Math.random() * 0.3);
        zig(a, point, point.clone().add(d), 0.12, 6);
      }
    };
    return fx;
  };

  // ── where the bolt lands: a ring on the ground that tightens while it charges, then a burst out to the edge ──
  S.shock = (point, radius = 5, delay = 0.8) => {
    const fx = create('neon-relay-charge');
    const ringGeo = new T.RingGeometry(0.86, 1, 48);
    const charge = add(new T.Mesh(ringGeo, glowMat(CYAN, 0.8))), burst = add(new T.Mesh(new T.RingGeometry(0.9, 1, 64), glowMat(YELLOW, 0.9)));
    const disc = add(new T.Mesh(new T.CircleGeometry(1, 48), glowMat(CYAN, 0.18)));
    [charge, burst, disc].forEach((m) => { m.rotation.x = -Math.PI / 2; m.position.set(point.x, point.y + 0.05, point.z); });
    const glow = sprite(CYAN, 1.6, 0.9); glow.position.set(point.x, point.y + 0.4, point.z);
    const arcs = [0, 1, 2, 3].map(() => jagged(7, WHITE, 0.85));
    fx.root.add(disc, charge, burst, glow, ...arcs);
    const at = new T.Vector3(point.x, point.y + 0.3, point.z);
    fx.updateAge = (age) => {
      const k = Math.min(1, age / delay), after = age - delay;
      // charging: the ring closes in, the glow grows, small arcs jump up
      charge.visible = after < 0; disc.visible = after < 0.25;
      charge.scale.setScalar(radius * (1 - 0.82 * k)); charge.material.opacity = 0.35 + 0.55 * k;
      disc.scale.setScalar(radius); disc.material.opacity = after < 0 ? 0.08 + 0.12 * k : 0.2 * (1 - after / 0.25);
      glow.scale.setScalar(after < 0 ? 0.6 + 1.6 * k : Math.max(0.01, 3.2 * (1 - after / 0.5)));
      glow.material.opacity = after < 0 ? 0.5 + 0.4 * k : Math.max(0, 1 - after / 0.5);
      // the burst: a ring out to the edge of the zone, gone in half a second
      burst.visible = after >= 0 && after < 0.55;
      if (burst.visible) { burst.scale.setScalar(0.5 + (radius - 0.5) * Math.min(1, after / 0.22)); burst.material.opacity = 1 - after / 0.55; }
      for (const [i, a] of arcs.entries()) {
        a.visible = age < delay + 0.4;
        if (!a.visible) continue;
        const ang = Math.random() * Math.PI * 2, reach = after < 0 ? 0.6 + 1.4 * k : radius * (0.4 + 0.6 * Math.random());
        zig(a, at, new T.Vector3(point.x + Math.cos(ang) * reach, point.y + 0.1 + (i % 2) * 0.8 * (after < 0 ? k : 0.3), point.z + Math.sin(ang) * reach), after < 0 ? 0.25 : 0.6, 7);
      }
      fx.root.visible = age < delay + 0.6;
    };
    fx.updateAge(0);
    return fx;
  };

  // ── a wall of the lane: current rising up a sheet of light, a bright top edge and a line on the ground ──
  const laneVert = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  const laneFrag = [
    'uniform float uTime; uniform float uFade; uniform float uLen; uniform vec3 uA; uniform vec3 uB; varying vec2 vUv;',
    'float h(float x){ return fract(sin(x * 127.1) * 43758.5453); }',
    'void main(){',
    '  float x = vUv.x * uLen, y = vUv.y;',
    // streaks of current running up the wall, each column at its own speed
    '  float col = floor(x * 2.2); float sp = 0.8 + h(col) * 1.6;',
    '  float streak = smoothstep(0.82, 1.0, fract(y * 1.6 - uTime * sp + h(col + 7.0))) * smoothstep(0.35, 0.05, abs(fract(x * 2.2) - 0.5));',
    // a slow wave along the wall and a bright base fading up
    '  float wave = 0.5 + 0.5 * sin(x * 1.3 - uTime * 3.0 + y * 4.0);',
    '  float base = mix(0.13, 0.02, y) + 0.03 * wave;',
    '  float edge = smoothstep(0.95, 1.0, y) * 0.7 + smoothstep(0.05, 0.0, y) * 0.5;',
    '  vec3 c = mix(uA, uB, streak * 0.6 + edge * 0.3);',
    '  float a = clamp(base + streak * 0.5 + edge, 0.0, 0.85) * uFade;',
    '  gl_FragColor = vec4(c * 0.8, a);',
    '}',
  ].join('\n');
  S.lane = (wall, age = 0, duration = 4) => {
    const fx = create('neon-fastlane'); fx.wall = wall;
    const dx = wall.endX - wall.startX, dz = wall.endZ - wall.startZ, len = Math.max(0.01, Math.hypot(dx, dz));
    const mat = new T.ShaderMaterial({ vertexShader: laneVert, fragmentShader: laneFrag, transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending, toneMapped: false,
      uniforms: { uTime: { value: 0 }, uFade: { value: 0 }, uLen: { value: len }, uA: { value: new T.Color(CYAN) }, uB: { value: new T.Color(WHITE) } } });
    const sheet = add(new T.Mesh(new T.PlaneGeometry(len, wall.height), mat));
    sheet.position.set(wall.startX + dx / 2, wall.startY + wall.height / 2, wall.startZ + dz / 2);
    sheet.rotation.y = Math.atan2(-dz, dx);
    const ground = add(new T.Mesh(new T.PlaneGeometry(len, 0.18), glowMat(YELLOW, 0.8)));
    ground.rotation.set(-Math.PI / 2, 0, Math.atan2(dz, dx)); ground.position.set(sheet.position.x, wall.startY + 0.04, sheet.position.z);
    fx.root.add(sheet, ground);
    fx.updateAge = (a) => {
      const fade = Math.min(1, a / 0.25) * Math.min(1, Math.max(0, (duration - a) / 0.4));
      mat.uniforms.uTime.value = a; mat.uniforms.uFade.value = fade;
      ground.material.opacity = 0.5 * fade; ground.scale.x = Math.min(1, a / 0.18);
    };
    fx.updateAge(age);
    return fx;
  };

  // ── the orb that runs ahead along the floor to lay the lane, with a faint line where each wall will rise ──
  S.preview = (orb, gap = 2.4) => {
    const fx = create('neon-lane-preview');
    const ball = add(new T.Mesh(new T.SphereGeometry(0.18, 12, 8), glowMat(WHITE, 1))), halo = sprite(CYAN, 1.4, 0.9);
    const sides = [-1, 1].map(() => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array(6), 3)); return add(new T.Line(g, lineMat(CYAN, 0.7))); });
    const arc = jagged(6, YELLOW, 0.9);
    fx.root.add(ball, halo, arc, ...sides);
    const px = -orb.dirZ, pz = orb.dirX;
    fx.updateAge = (age) => {
      const y = (orb.startY || 0) + 0.6;
      ball.position.set(orb.curX, y, orb.curZ); halo.position.copy(ball.position); halo.scale.setScalar(1.2 + 0.3 * Math.sin(age * 30));
      sides.forEach((l, i) => {
        const s = i ? 1 : -1, p = l.geometry.attributes.position;
        p.setXYZ(0, orb.startX + px * s * gap / 2, (orb.startY || 0) + 0.05, orb.startZ + pz * s * gap / 2);
        p.setXYZ(1, orb.curX + px * s * gap / 2, (orb.startY || 0) + 0.05, orb.curZ + pz * s * gap / 2); p.needsUpdate = true;
      });
      zig(arc, ball.position, new T.Vector3(orb.curX - orb.dirX * 1.2, y - 0.4, orb.curZ - orb.dirZ * 1.2), 0.3, 6);
    };
    fx.updateAge(0);
    return fx;
  };
})();
