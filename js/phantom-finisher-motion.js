// Seafle's supplied 0.1.0 finisher: client.c.b.i/j/m/p/q/s and c.b.a.
// The source dragon/serpent bones are static. These source VFX move around them.
(function (root) {
  "use strict";
  const clamp = n => Math.max(0, Math.min(1, n)), ramp = (t, a, b) => clamp((t - a) / (b - a));
  const add = (a, b) => a.map((v, i) => v + b[i]), sub = (a, b) => a.map((v, i) => v - b[i]), mul = (a, k) => a.map(v => v * k);
  const length = a => Math.hypot(...a), unit = a => length(a) > 1e-10 ? mul(a, 1 / length(a)) : [1, 0, 0];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const inversePivot = a => [a[0] / 1.25, (a[1] - 4.15 * (1 - 1.25)) / 1.25, a[2] / 1.25];
  const textures = ["ribbon_white", "ribbon_red", "glow", "star8", "swirl", "ring", "ray", "ember", "diamond", "white"];
  function random(seed) {
    let n = BigInt.asUintN(64, (seed ^ 0x9e3779b97f4a7c15n) * -4658895280553007687n);
    n = BigInt.asUintN(64, (n ^ n >> 27n) * -7723592293110705685n); n ^= n >> 31n;
    return Number(n >> 11n) * 2 ** -53;
  }
  function seed(event = {}) {
    return BigInt(Math.trunc((event.x || 0) * 7919)) ^ BigInt(Math.trunc((event.z || 0) * 104729)) << 16n ^ BigInt(event.finisherTick || 0);
  }
  function pulse(t) { const p = (t - 3) % 0.6; return t >= 3 && p < 0.1 ? 1 - p / 0.1 : 0; }
  function coil(t, start, angle, radius, width) {
    const age = t - start, end = Math.min(6, age * 7), begin = Math.max(0, end - 4);
    if (age <= 0 || end - begin < 0.05) return null;
    const points = [], widths = [], normals = [], decay = Math.log(radius / 0.35) / 6;
    for (let i = 0; i <= 28; i++) {
      const f = i / 28, s = begin + (end - begin) * f, a = angle + s + (t - 0.41) * 1.2;
      const normal = [Math.cos(a), Math.sin(a), 0];
      points.push(mul(normal, radius * Math.exp(-decay * s))); normals.push(normal);
      widths.push(width * Math.sin(Math.PI * f) * ramp(age, 0, 0.05));
    }
    return { points, normals, widths };
  }
  // Positions here are original source meters, before the source's 1.25 pivot transform.
  function frame(t, attacker, event = {}) {
    const sprites = [], ribbons = [], beams = [], sourceSeed = seed(event), rnd = offset => random(sourceSeed + BigInt(offset));
    const fade = 1 - ramp(t, 7, 8), present = t >= 2.66 && t < 8, age = t - 2.66;
    const sprite = (texture, center, x, y, angle, color, alpha, id, blend = "add") => {
      if (alpha > 0) sprites.push({ texture, center, x, y, angle, color, alpha, id, blend });
    };
    const beam = (a, b, width, color, alpha, id, texture = "ray") => { if (alpha > 0) beams.push({ a, b, width, color, alpha, id, texture }); };
    // c.b.i/j: nine contracting white/red ribbons, in the viewer-facing victim plane.
    if (t >= 0.41 && t <= 1.25) {
      const alpha = 1 - ramp(t, 1, 1.25), specs = [[0.41, -60, 6.5, 0.8], [0.55, 150, 6, 0.75], [0.58, 250, 5.5, 0.7]];
      for (let i = 0; i < 3; i++) for (const [start, angle, radius, width] of [[0.61 + i * 0.015, 40, 7.5 * (1 + (i - 1) * 0.07), 0.32 - i * 0.05], [0.66 + i * 0.015, 215, 7 * (1 + (i - 1) * 0.07), 0.28 - i * 0.05]]) specs.push([start, angle, radius, width]);
      specs.forEach(([start, angle, radius, width], i) => {
        const strip = coil(t, start, angle * Math.PI / 180, radius, width);
        if (strip) ribbons.push({ ...strip, texture: i < 3 ? "ribbon_white" : "ribbon_red", alpha, id: "coil-" + i, blend: i < 3 ? "add" : "blend" });
      });
    }
    // c.b.h/m: initial star, then the rotating swirl and two fixed rings.
    const star = t >= 0.15 && t <= 1 ? Math.min(ramp(t, 0.15, 0.25), ramp(1 - t, 0, 0.15)) : 0;
    sprite("star8", inversePivot([0, 1.08 * 2.31, 0]), 1.7 / 1.25, 1.7 / 1.25, (t - 0.15) * 0.3, [1, 0.92, 0.7], star, "opening-star");
    const swirl = t >= 1.25 && t < 2.4 ? ramp(t, 1.25, 1.38) * (1 - ramp(t, 2.38, 2.4)) : 0;
    const victimCenter = inversePivot([0, Math.min(3, 2.31 * 1.08), 0]);
    sprite("swirl", victimCenter, 2.15 / 1.25, 2.15 / 1.25, Math.PI / 6 * (t - 1.25), [1, 0.8, 0.4], swirl, "swirl");
    sprite("ring", victimCenter, 1.9 / 1.25, 1.9 / 1.25, 0, [1, 0.85, 0.45], swirl, "ring-outer");
    sprite("ring", victimCenter, 1.55 / 1.25, 1.55 / 1.25, 0, [1, 1, 0.9], swirl * 0.8, "ring-inner");
    if (!present) return { sprites, ribbons, beams, pulse: 0 };
    // c.b.p/q: outward rays and twenty drifting, rotating diamonds at reveal.
    if (t <= 3.2) for (let i = 0; i < 32; i++) {
      const life = 0.3 + rnd(500 + i) * 0.25; if (age > life) continue;
      const h = 1 + rnd(600 + i) * 11, a = rnd(700 + i) * Math.PI * 2, p = (rnd(800 + i) - 0.5) * 0.5;
      const direction = [Math.cos(a) * Math.cos(p), Math.sin(p), Math.sin(a) * Math.cos(p)];
      const end = add([0, h, 0], mul(direction, (1 + age * 18) / 1.25));
      beam(sub(end, mul(direction, (0.6 + rnd(900 + i) * 0.6) / 1.25)), end, 0.08 / 1.25, [1, 0.32, 0.12], 1 - age / life, "burst-" + i);
    }
    if (t <= 3.5) for (let i = 0; i < 20; i++) {
      const center = [(rnd(1000 + i) - 0.5) * 8 + (rnd(1300 + i) - 0.5) * age * 0.8 / 1.25, 0.2 + rnd(1100 + i) * 1.3 + age * 0.3 / 1.25, 1 + rnd(1200 + i) * 6];
      const size = 0.12 + rnd(1400 + i) * 0.18, color = [[1, 1, 1], [1, 0.82, 0.25], [1, 0.5, 0.12]][i % 3];
      sprite("diamond", center, size * 0.6 / 1.25, size / 1.25, age * 4 + i, color, 1 - ramp(t, 3.2, 3.5), "diamond-" + i, "blend");
    }
    // c.b.s: recurring 0.6s flashes, forty rising embers and fourteen falling rays.
    const p = pulse(t), eye = [0.1846, 12.1377, -0.0086];
    sprite("star8", eye, (0.5 + 1.3 * p), (0.5 + 1.3 * p), 0.3, [1, 0.95, 0.6], (0.25 + 0.75 * p) * fade, "pulse-star");
    sprite("glow", eye, 2.6, 2.6, 0, [1, 0.82, 0.38], (0.3 + 0.25 * p) * fade, "pulse-glow");
    const eyes = [[-3.9383, 6.9484, 1.2611], [-3.6727, 6.9484, 0.2518], [3.5307, 14.9521, 0.8355], [4.8021, 14.9521, 2.1622]];
    eyes.forEach((center, i) => {
      const dragon = i < 2, warm = dragon ? attacker || t < 2.8 : !attacker;
      if (warm && !dragon) {
        sprite("glow", center, 0.65, 0.65, 0, [1, 0.25, 0.1], fade, "eye-" + i);
        sprite("glow", center, 0.22, 0.22, 0, [1, 0.92, 0.85], fade, "eye-core-" + i);
      } else sprite("glow", center, warm ? 0.35 : 0.3, warm ? 0.35 : 0.3, 0, warm ? [1, 0.45, 0.12] : [0.85, 0.95, 1], fade * (warm ? 1 : 0.8), "eye-" + i);
    });
    const cycleAge = (t - 3) % 0.6, cycle = Math.floor((t - 3) / 0.6);
    if (t >= 3 && cycleAge >= 0.1 && cycleAge < 0.4) for (let i = 0; i < 3; i++) {
      const id = cycle * 7 + i, side = rnd(id * 13) < 0.5 ? 1 : -1, angle = rnd(id * 29) * Math.PI * 2;
      let previous;
      for (let k = 0; k <= 8; k++) {
        const a = angle + k * 0.17, radius = 1.05 + (rnd(id * 101 + k) - 0.5) * 0.25, jitter = (rnd(id * 131 + k) - 0.5) * 0.2;
        const x = Math.cos(a) * radius, z = Math.sin(a) * radius, y = side * (1.85 + jitter), tilt = Math.PI * 2 / 9;
        const point = add(eye, [x * Math.cos(tilt) - y * Math.sin(tilt), x * Math.sin(tilt) + y * Math.cos(tilt), z]);
        if (previous) beam(previous, point, 0.05 / 1.25, [1, 0.95, 0.35], (1 - (cycleAge - 0.1) / 0.3) * fade, `arc-${i}-${k}`, "white");
        previous = point;
      }
    }
    for (let i = 0; i < 40; i++) {
      const r = 1 + rnd(2000 + i) * 6, a = rnd(2100 + i) * Math.PI * 2 + age * 0.15;
      const y = (rnd(2200 + i) * 16 + age * (0.3 + rnd(2300 + i) * 0.3)) % 16 + 0.5;
      const size = (0.05 + rnd(2400 + i) * 0.06) / 1.25;
      sprite("ember", [Math.cos(a) * r, y, Math.sin(a) * r], size, size, 0, [1, 0.55, 0.15], (0.6 + 0.4 * Math.sin(age * 8 + i)) * fade, "ember-" + i);
    }
    for (let i = 0; i < 14; i++) {
      const r = 0.8 + rnd(2500 + i) * 5, a = rnd(2600 + i) * Math.PI * 2;
      const end = [Math.cos(a) * r, 21 - (rnd(2700 + i) * 18 + age * 1.5) % 18, Math.sin(a) * r];
      beam(add(end, [0, -2.4, 0]), end, 0.04 / 1.25, [1, 0.82, 0.4], 0.35 * fade, "falling-" + i);
    }
    return { sprites, ribbons, beams, pulse: p };
  }
  function create(parent, texture, attacker, event, scale, offset, yaw) {
    const T = root.THREE, group = new T.Group(), batches = new Map();
    group.name = "champions-source-motion"; group.userData.phantom = true; group.userData.source = "client.c.b.i/j/m/p/q/s";
    group.userData.seed = seed(event).toString();
    // Reserve the full moving extent, including the early coils below the victim.
    group.userData.previewBounds = new T.Box3(new T.Vector3(-8, -4, -8), new T.Vector3(8, 22, 8));
    group.position.y = offset; group.rotation.y = yaw; group.scale.setScalar(scale * 1.25); parent.add(group);
    // Original FX are in source meters; the model's 1.25 pivot shift applies once.
    const pivot = new T.Group(); pivot.position.y = 4.15 * (1 - 1.25) / 1.25; group.add(pivot);
    const maxVertices = 4096;
    function batch(name, blend) {
      const key = name + ":" + blend;
      if (!batches.has(key)) {
        const geo = new T.BufferGeometry();
        for (const [name, size] of [["position", 3], ["uv", 2], ["color", 4]]) geo.setAttribute(name, new T.BufferAttribute(new Float32Array(maxVertices * size), size).setUsage(T.DynamicDrawUsage));
        const material = new T.MeshBasicMaterial({ map: texture("textures/finisher/fx/" + name + ".png"), vertexColors: true, transparent: true, depthWrite: false, side: T.DoubleSide, alphaTest: 0.004, blending: blend === "add" ? T.AdditiveBlending : T.NormalBlending });
        const mesh = new T.Mesh(geo, material); mesh.frustumCulled = false; mesh.name = "source-fx-" + key; pivot.add(mesh);
        batches.set(key, { mesh, count: 0 });
      }
      return batches.get(key);
    }
    function quad(textureName, blend, points, color, alpha, uv = [[0, 1], [1, 1], [1, 0], [0, 0]]) {
      const b = batch(textureName, blend), attributes = b.mesh.geometry.attributes;
      for (const index of [0, 1, 2, 0, 2, 3]) {
        if (b.count >= maxVertices) throw Error("Original finisher FX buffer capacity exceeded");
        attributes.position.setXYZ(b.count, ...points[index]); attributes.uv.setXY(b.count, ...uv[index]); attributes.color.setXYZW(b.count, ...color, alpha); b.count++;
      }
    }
    function step(t, camera) {
      for (const b of batches.values()) b.count = 0;
      const data = frame(t, attacker, event), cameraPosition = new T.Vector3();
      camera.getWorldPosition(cameraPosition); group.updateWorldMatrix(true, false); pivot.worldToLocal(cameraPosition);
      const cameraLocal = cameraPosition.toArray();
      function basis(center) {
        const direction = unit(sub(center, cameraLocal)), right = unit(cross(direction, [0, 1, 0]));
        return [right, unit(cross(right, direction))];
      }
      for (const s of data.sprites) {
        const [right, up] = basis(s.center), c = Math.cos(s.angle), n = Math.sin(s.angle);
        const x = mul(add(mul(right, c), mul(up, n)), s.x), y = mul(sub(mul(up, c), mul(right, n)), s.y);
        quad(s.texture, s.blend, [add(sub(s.center, x), y), add(add(s.center, x), y), sub(add(s.center, x), y), sub(sub(s.center, x), y)], s.color, s.alpha);
      }
      for (const strip of data.ribbons) {
        const center = inversePivot([0, Math.min(3, 2.31 * 1.08), 0]), [right, up] = basis(center);
        const convert = p => add(center, mul(add(mul(right, p[0]), mul(up, p[1])), 1 / 1.25));
        for (let i = 0; i < strip.points.length - 1; i++) {
          const a = strip.points[i], b = strip.points[i + 1], x = mul(strip.normals[i], strip.widths[i] * 0.5), y = mul(strip.normals[i + 1], strip.widths[i + 1] * 0.5);
          quad(strip.texture, strip.blend, [convert(sub(a, x)), convert(sub(b, y)), convert(add(b, y)), convert(add(a, x))], [1, 1, 1], strip.alpha, [[0, 1], [0, 1], [0, 0], [0, 0]]);
        }
      }
      for (const b of data.beams) {
        const middle = mul(add(b.a, b.b), 0.5), side = mul(unit(cross(sub(b.b, b.a), sub(middle, cameraLocal))), b.width / 2);
        quad(b.texture, "add", [sub(b.a, side), add(b.a, side), add(b.b, side), sub(b.b, side)], b.color, b.alpha);
      }
      for (const b of batches.values()) {
        b.mesh.geometry.setDrawRange(0, b.count); b.mesh.visible = b.count > 0;
        for (const attribute of Object.values(b.mesh.geometry.attributes)) attribute.needsUpdate = true;
      }
      group.visible = t < 8; group.userData.time = t; group.userData.pulse = data.pulse;
      group.userData.vertices = [...batches.values()].reduce((sum, b) => sum + b.count, 0);
    }
    return { group, step };
  }
  const api = { random, seed, pulse, coil, frame, create, textures };
  if (typeof module === "object" && module.exports) module.exports = api; else root.PHANTOM_FINISHER_MOTION = api;
})(typeof window === "object" ? window : globalThis);
