(() => {
  // Gunshots: each gun has a shot of its own (js/gunshot-synth.js renders them), and the room answers. The game
  // had a tone and a puff of noise per gun class, and eleven guns had no sound of their own at all. This replaces
  // the shot for every gun the model knows (all but the knife, which keeps its swish) and leaves the rest of the
  // sound alone. It loads between the heavier-shot module and the skin sound packs, so a skin's own layer still
  // sits on top of the shot and the pack preview plays this shot. The hospital is a long room, every other map
  // is open air. Sound only; no change to a fight.
  if ("undefined" == typeof SFX || "function" != typeof SFX.gun || "function" != typeof SFX.shot || !window.GUNSYNTH || "undefined" == typeof GAME_AUDIO) return;
  let eng = null;
  const get = () => {
    if ("object" == typeof SETTINGS && SETTINGS && !SETTINGS.sfx) return null;
    try {
      if (!eng) {
        const c = GAME_AUDIO.context();
        if (!c) return null;
        eng = GUNSYNTH.engine(c, GAME_AUDIO.output);
      }
      const c = GAME_AUDIO.context();
      c && "suspended" === c.state && c.resume();
    } catch (e) {
      eng = null;
    }
    return eng;
  };
  const play = (key, far) => {
    const e = get();
    if (!e) return !0;
    e.setRoom("hospital" === CUR_MAP_KEY ? "indoor" : "open");
    return e.play(key, far);
  };
  const _gun = SFX.gun,
    _shot = SFX.shot;
  SFX.gun = function (key, far) {
    if (GUNSYNTH.has(key)) {
      try {
        if (play(key, "number" == typeof far ? far : 0)) return;
      } catch (e) {}
    }
    return _gun.apply(this, arguments);
  };
  SFX.shot = function (kind, far) {
    const key = GUNSYNTH.KIND[kind] || "rifle";
    try {
      if (play(key, "number" == typeof far ? far : 0)) return;
    } catch (e) {}
    return _shot.apply(this, arguments);
  };
  window.GUNSOUND_ENGINE = () => eng;
})();
