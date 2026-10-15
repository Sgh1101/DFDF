window.GAME_AUDIO = (() => {
  let context = null, output = null;
  function get() {
    if (!context) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return null;
      context = new Audio();
      output = context.createGain();
      const limiter = context.createDynamicsCompressor();
      limiter.threshold.value = -6; limiter.knee.value = 6; limiter.ratio.value = 12;
      output.connect(limiter); limiter.connect(context.destination);
    }
    if (context.state === "suspended") context.resume().catch(() => {});
    return context;
  }
  setInterval(() => { if (output && typeof SETTINGS === "object") output.gain.setTargetAtTime(SETTINGS.sfx ? 1 : 0, context.currentTime, 0.02); }, 100);
  return { context: get, get output() { get(); return output; } };
})();
