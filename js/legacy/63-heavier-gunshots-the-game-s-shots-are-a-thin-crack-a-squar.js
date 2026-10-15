
(() => {
  // Heavier gunshots. The game's shots are a thin crack (a square or saw wave
  // around 300 Hz and a burst of noise); this adds what a real shot has under
  // the crack: a low thump that drops in pitch, a dark body of noise, and a
  // short tail — more of all three the bigger the gun — and takes a little of
  // the bite off the crack itself. The sound of other guns, far away, goes
  // quieter and dull as before (the weight fades with distance too, a bit slower
  // than the crack, as bass does). Sound only; no change to a fight.
  if ("undefined" == typeof SFX || "function" != typeof SFX.gun || "function" != typeof SFX.shot) return;

  // [thump Hz, thump s, body low-pass Hz, body s, tail s, strength]
  const W = {
    knife: null,
    silenced: [95, 0.07, 700, 0.05, 0.06, 0.3],
    pistol: [105, 0.1, 1500, 0.07, 0.14, 0.7],
    machpist: [100, 0.08, 1500, 0.06, 0.1, 0.6],
    revolver: [78, 0.2, 1300, 0.12, 0.3, 1],
    handcan: [66, 0.26, 1100, 0.15, 0.36, 1.15],
    smg: [92, 0.09, 1400, 0.07, 0.12, 0.7],
    vector: [96, 0.08, 1500, 0.065, 0.1, 0.65],
    pdw: [90, 0.1, 1400, 0.075, 0.12, 0.7],
    rifle: [78, 0.14, 1250, 0.1, 0.2, 0.95],
    carbine: [84, 0.12, 1300, 0.09, 0.17, 0.85],
    battle: [68, 0.18, 1150, 0.12, 0.26, 1.1],
    burst: [86, 0.11, 1350, 0.085, 0.15, 0.8],
    lmg: [66, 0.16, 1100, 0.12, 0.26, 1.05],
    hmg: [58, 0.2, 1000, 0.14, 0.3, 1.2],
    shotgun: [56, 0.26, 1000, 0.17, 0.34, 1.25],
    autoshot: [62, 0.2, 1050, 0.14, 0.26, 1.1],
    slugger: [50, 0.3, 900, 0.19, 0.4, 1.35],
    marksman: [58, 0.26, 1000, 0.17, 0.42, 1.25],
    sniper: [46, 0.38, 850, 0.22, 0.6, 1.5],
    // the older shot kinds the game falls back on
    _sniper: [46, 0.38, 850, 0.22, 0.6, 1.5],
    _shotgun: [56, 0.26, 1000, 0.17, 0.34, 1.25],
    _heavy: [66, 0.18, 1100, 0.12, 0.24, 1.05],
    _pistol: [105, 0.1, 1500, 0.07, 0.14, 0.7],
    _quiet: [95, 0.07, 700, 0.05, 0.06, 0.3],
    _default: [80, 0.13, 1250, 0.09, 0.18, 0.9],
  };

  let ac = null,
    bus = null,
    noise = null;
  const ctx = () => {
    if ("object" == typeof SETTINGS && SETTINGS && !SETTINGS.sfx) return null;
    if (ac) return "suspended" === ac.state && ac.resume(), ac;
    try {
      const A = window.AudioContext || window.webkitAudioContext;
      if (!A) return null;
      ac = GAME_AUDIO.context();
      bus = ac.createGain();
      bus.gain.value = 0.22;
      bus.connect(GAME_AUDIO.output);
    } catch (e) {
      ac = null;
    }
    return ac;
  };
  // one second of noise, kept and re-read with different filters and lengths
  const noiseBuf = (c) => {
    if (noise && noise.sampleRate === c.sampleRate) return noise;
    const n = Math.max(1, Math.floor(c.sampleRate)),
      b = c.createBuffer(1, n, c.sampleRate),
      d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = 2 * Math.random() - 1;
    return (noise = b);
  };
  const thump = (c, hz, len, vol) => {
    const o = c.createOscillator(),
      g = c.createGain(),
      t0 = c.currentTime;
    o.type = "sine";
    o.frequency.setValueAtTime(hz * 1.9, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(24, hz * 0.45), t0 + len);
    g.gain.setValueAtTime(1e-4, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(1e-4, t0 + len);
    o.connect(g);
    g.connect(bus);
    o.start(t0);
    o.stop(t0 + len + 0.03);
  };
  const body = (c, cut, len, vol, delay) => {
    const s = c.createBufferSource(),
      f = c.createBiquadFilter(),
      g = c.createGain(),
      t0 = c.currentTime + (delay || 0);
    s.buffer = noiseBuf(c);
    f.type = "lowpass";
    f.frequency.setValueAtTime(cut, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(120, cut * 0.25), t0 + len);
    g.gain.setValueAtTime(1e-4, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.003);
    g.gain.exponentialRampToValueAtTime(1e-4, t0 + len);
    s.connect(f);
    f.connect(g);
    g.connect(bus);
    s.start(t0, Math.random() * 0.5);
    s.stop(t0 + len + 0.03);
  };
  // the weight under one shot: far = 0 (at your ear) … 1 (far away)
  function layer(w, far) {
    const c = ctx();
    if (!c || !w) return;
    const k = 1 - 0.7 * Math.min(Math.max(far || 0, 0), 1);
    if (k < 0.08) return;
    const [hz, tl, cut, bl, tail, str] = w,
      v = str * k;
    thump(c, hz, tl, 0.62 * v);
    body(c, cut, bl, 0.5 * v, 0);
    // the tail: a low rumble of the room after the shot
    body(c, cut * 0.45, tail, 0.17 * v, 0.03);
  }

  // ── hooks: the game's own shot plays, softened, and the weight goes under it ──
  // a little duller up close, exactly as before from far away
  const soften = (t) => Math.min(1, (t || 0) + 0.12 * Math.pow(1 - Math.min(Math.max(t || 0, 0), 1), 4));
  let depth = 0;
  const _gun = SFX.gun,
    _shot = SFX.shot;
  SFX.gun = function (e, t) {
    depth++;
    try {
      _gun.call(this, e, "number" == typeof t ? soften(t) : t);
    } finally {
      depth--;
    }
    try {
      if (!depth) {
        const w = Object.prototype.hasOwnProperty.call(W, e) ? W[e] : W._default;
        layer(w, t);
      }
    } catch (x) {}
  };
  SFX.shot = function (kind, t) {
    _shot.call(this, kind, "number" == typeof t ? soften(t) : t);
    try {
      if (!depth) layer(W["_" + kind] || W._default, t);
    } catch (x) {}
  };
  window.GUNSOUND = { weights: W, layer, soften };
})();
