(function (root) {
  // Numeric animation data only. No Molang, class loading or mod execution.
  const vector = (input, fallback) => {
    for (let i = 0; i < 5 && input && !Array.isArray(input) && typeof input === "object"; i++) input = input.post || input.pre || input.vector;
    return Array.isArray(input) && input.length === 3 && input.every(Number.isFinite) ? input : fallback;
  };
  function sample(track, time, fallback = [0, 0, 0]) {
    if (Array.isArray(track) || !track) return vector(track, fallback);
    const keys = Object.keys(track).filter((k) => Number.isFinite(+k)).sort((a, b) => +a - +b);
    if (!keys.length) return fallback;
    if (time <= +keys[0]) return vector(track[keys[0]], fallback);
    for (let i = 1; i < keys.length; i++) if (time <= +keys[i]) {
      if (time === +keys[i]) return vector(track[keys[i]], fallback);
      const a = vector(track[keys[i - 1]], fallback), b = vector(track[keys[i]], fallback);
      let f = (time - +keys[i - 1]) / (+keys[i] - +keys[i - 1]);
      if (track[keys[i]]?.easing === "easeInCirc") f = 1 - Math.sqrt(Math.max(0, 1 - f * f));
      if (track[keys[i]]?.lerp_mode !== "catmullrom" && track[keys[i - 1]]?.lerp_mode !== "catmullrom") return a.map((n, j) => n + (b[j] - n) * f);
      const p = vector(track[keys[Math.max(0, i - 2)]], fallback), q = vector(track[keys[Math.min(keys.length - 1, i + 1)]], fallback);
      return a.map((n, j) => 0.5 * (2 * n + (-p[j] + b[j]) * f + (2 * p[j] - 5 * n + 4 * b[j] - q[j]) * f * f + (-p[j] + 3 * n - 3 * b[j] + q[j]) * f * f * f));
    }
    return vector(track[keys[keys.length - 1]], fallback);
  }
  // GeckoLib 1.20.1 reflects source X and negates X/Y rotations. Keep this
  // adapter separate from TACZ and Champions; the supplied files stay intact.
  const position = (v) => [-v[0], v[1], v[2]], rotation = (v) => [-v[0], -v[1], v[2]];
  function renderGeometry(geo) {
    return { ...geo, bones: geo.bones.map(b => ({ ...b, pivot: position(b.pivot || [0, 0, 0]), rotation: rotation(b.rotation || [0, 0, 0]), cubes: b.cubes?.map(c => {
      const [x, y, z] = c.size, [u, v] = c.uv;
      const face = (u, v, w, h) => ({ uv: [u, v], uv_size: [w, h] });
      return { ...c, origin: [-(c.origin[0] + x), c.origin[1], c.origin[2]], pivot: c.pivot && position(c.pivot), rotation: c.rotation && rotation(c.rotation), uv: {
        east: face(u + z, v + z, -z, y), west: face(u + 2 * z + x, v + z, -z, y),
        north: face(u + z, v + z, x, y), south: face(u + 2 * z + x, v + z, x, y),
        up: face(u + z + x, v, -x, z), down: face(u + z + 2 * x, v, -x, z),
      } };
    }) })) };
  }
  const clamp01 = x => Math.max(0, Math.min(1, x));
  function chargedAlpha(name, time) {
    if (name === 'Neon_ULT') return clamp01((time - .25) / (.4333 - .25));
    if (name === 'Neon_Q') return 1 - clamp01((time - .5) / (.5833 - .5));
    return 1;
  }
  // HeldItemRendererMixin translate(-.25,-.81,-.58), scale(.46), then
  // GeckoLib's item origin translate(.5,.51,.5); geometry units are 1/16m.
  const view = Object.freeze({ scale: .46 / 16, position: [-.25 + .46 * .5, -.81 + .46 * .51, -.58 + .46 * .5] });
  function rayBox(from, to, box) {
    let near = -Infinity, far = Infinity, axis = 'y', normal = 1;
    for (const [key, lo, hi] of [['x', box.minX, box.maxX], ['y', box.y0 || 0, box.h], ['z', box.minZ, box.maxZ]]) {
      const d = to[key] - from[key];
      if (Math.abs(d) < 1e-9) { if (from[key] < lo || from[key] > hi) return null; continue; }
      const enter = (lo - from[key]) / d, exit = (hi - from[key]) / d, t = Math.min(enter, exit);
      if (t > near) { near = t; axis = key; normal = d > 0 ? -1 : 1; }
      far = Math.min(far, Math.max(enter, exit));
    }
    return near <= far && far >= 0 && near >= -1e-6 && near <= 1 ? { t: Math.max(0, near), axis, normal } : null;
  }
  // C/Q physics and visuals, sprint multiplier and slide distance/duration use
  // the supplied Java constants. Costs and ultimate damage remain DFDF balance.
  const config = Object.freeze({ sprintMultiplier: 1.4, sprintDuration: 10, slideDistance: 6, slideDuration: 0.8333, killsPerSlide: 2, wallLength: 25, wallHeight: 4, wallDuration: 4, wallGap: 2.4, laneSpeed: 62.5, boltSpeed: 38, boltGravity: 4.8, boltLife: 2.25, boltAfterBounce: .75, boltDelay: 0.35, concussDelay: .8, concussRadius: 5, concussDuration: 2.5, ultimateDuration: 20, ultimateRange: 40, ultimateDamage: 18, ultimateRate: 0.1 });
  const api = { vector, sample, position, rotation, renderGeometry, chargedAlpha, view, rayBox, config };
  if (typeof module === "object" && module.exports) module.exports = api; else root.NEON_DATA = api;
})(typeof window === "object" ? window : globalThis);
