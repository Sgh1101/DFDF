(function (root) {
  // context -> limiter -> master -> { fx (`output`: guns, abilities, hits, UI beeps), steps (footsteps) }.
  // Every sound the game makes joins `output`, so the master slider reaches all of them without touching their code.
  let context = null, master = null, fx = null, steps = null;
  const level = (key) => {
    const v = typeof SETTINGS === "object" && SETTINGS ? SETTINGS[key] : 1;
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
  };
  const on = () => typeof SETTINGS !== "object" || !SETTINGS || !!SETTINGS.sfx;
  // The pan of a sound at `src` for a listener at `from` looking along `yaw` (the game's yaw: forward is (-sin, -cos),
  // right is (cos, -sin)): -1 is full left, 1 full right. Straight ahead or behind is the middle; a source on top of the
  // listener has no side.
  function panFor(from, src) {
    const dx = src.x - from.x, dz = src.z - from.z, d = Math.hypot(dx, dz);
    if (!(d > 1e-6)) return 0;
    const side = (dx * Math.cos(from.yaw) - dz * Math.sin(from.yaw)) / d;
    return Math.max(-1, Math.min(1, side * Math.min(1, d / 1.5)));
  }
  function apply(fast) {
    if (!context) return;
    const t = context.currentTime, k = fast ? 0.005 : 0.02;
    master.gain.setTargetAtTime(on() ? level("volMaster") : 0, t, k);
    fx.gain.setTargetAtTime(level("volFx"), t, k);
    steps.gain.setTargetAtTime(level("volSteps"), t, k);
  }
  function get() {
    if (!context) {
      const Audio = root.AudioContext || root.webkitAudioContext;
      if (!Audio) return null;
      context = new Audio();
      master = context.createGain(); fx = context.createGain(); steps = context.createGain();
      const limiter = context.createDynamicsCompressor();
      limiter.threshold.value = -6; limiter.knee.value = 6; limiter.ratio.value = 12;
      fx.connect(master); steps.connect(master); master.connect(limiter); limiter.connect(context.destination);
      apply(true);
    }
    if (context.state === "suspended") context.resume().catch(() => {});
    return context;
  }
  const api = { context: get, panFor, apply, get output() { get(); return fx; }, get steps() { get(); return steps; }, get master() { get(); return master; } };
  if (typeof module === "object" && module.exports) { module.exports = api; return; }
  setInterval(() => apply(false), 100);
  root.GAME_AUDIO = api;
})(typeof window === "object" ? window : globalThis);
