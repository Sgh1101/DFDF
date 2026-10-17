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
      const f = (time - +keys[i - 1]) / (+keys[i] - +keys[i - 1]);
      if (track[keys[i]]?.lerp_mode !== "catmullrom" && track[keys[i - 1]]?.lerp_mode !== "catmullrom") return a.map((n, j) => n + (b[j] - n) * f);
      const p = vector(track[keys[Math.max(0, i - 2)]], fallback), q = vector(track[keys[Math.min(keys.length - 1, i + 1)]], fallback);
      return a.map((n, j) => 0.5 * (2 * n + (-p[j] + b[j]) * f + (2 * p[j] - 5 * n + 4 * b[j] - q[j]) * f * f + (-p[j] + 3 * n - 3 * b[j] + q[j]) * f * f * f));
    }
    return vector(track[keys[keys.length - 1]], fallback);
  }
  // Sprint multiplier and slide distance/duration are the supplied Java constants.
  // Durations, costs and ultimate damage are DFDF balance values.
  const config = Object.freeze({ sprintMultiplier: 1.4, sprintDuration: 10, slideDistance: 6, slideDuration: 0.8333, killsPerSlide: 2, wallLength: 30, wallDuration: 6, wallGap: 3.6, boltSpeed: 38, boltGravity: 4.8, boltLife: 2.25, boltDelay: 0.35, concussRadius: 3.5, concussDuration: 3, ultimateDuration: 20, ultimateRange: 40, ultimateDamage: 18, ultimateRate: 0.1 });
  const api = { vector, sample, config };
  if (typeof module === "object" && module.exports) module.exports = api; else root.NEON_DATA = api;
})(typeof window === "object" ? window : globalThis);
