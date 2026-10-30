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
    e.setRoom(roomNow());
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
  // The first shot of a gun used to render its takes on the spot (and the room's reverb on the first shot of all), a hitch
  // in the middle of a fight. While a match runs, the takes of every gun held by someone in it are rendered ahead, mine first,
  // one piece per idle callback; the shot itself is the same buffer that would have been rendered.
  const idle = (f) => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 3000 }) : setTimeout(f, 60));
  let warming = !1;
  const inPlay = () => {
    const me = "function" == typeof myActor ? myActor() : null,
      keys = new Set();
    for (const a of [me, ...((world && world.actors) || [])])
      if (a && a.weapons) for (const k of Object.values(a.weapons)) GUNSYNTH.has(k) && keys.add(k);
    return [...keys];
  };
  let roomed = "";
  const roomNow = () => ("hospital" === CUR_MAP_KEY ? "indoor" : "open");
  const warmNext = () => {
    warming = !1;
    try {
      const e = get();
      if (!e || !e.warm) return;
      const room = roomNow(),
        k = inPlay().find((k) => !e.warmed(k));
      if (roomed !== room) ((roomed = room), e.setRoom(room));
      else if (k) e.warm(k);
      warming = roomed !== room || inPlay().some((k) => !e.warmed(k));
      warming && idle(warmNext);
    } catch (e) {
      warming = !1;
    }
  };
  setInterval(() => {
    if (warming || document.hidden || "undefined" == typeof world || ("buy" !== world.phase && "live" !== world.phase)) return;
    if (!eng || roomed !== roomNow() || inPlay().some((k) => !eng.warmed(k))) ((warming = !0), idle(warmNext));
  }, 1000);
  window.GUNSOUND_ENGINE = () => eng;
})();
