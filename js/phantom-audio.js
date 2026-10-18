// Original Seafle note-block arrangements, played from the original recordings.
(function (root) {
  function schedule(context, output, profile, buffers, start, voices, end = Infinity) {
    for (const note of profile.events) {
      if (start + note.at >= end) continue;
      const source = context.createBufferSource(), gain = context.createGain();
      source.buffer = buffers.get(note.sound);
      if (!source.buffer) throw new Error("Missing Phantom note: " + note.sound);
      source.playbackRate.value = Math.max(0.5, Math.min(2, note.pitch));
      gain.gain.value = note.volume;
      source.connect(gain); gain.connect(output);
      voices.add(source);
      source.onended = () => { voices.delete(source); source.disconnect(); gain.disconnect(); };
      source.start(start + note.at);
      if (Number.isFinite(end)) source.stop(end);
    }
  }
  if (typeof module === "object" && module.exports) { module.exports = { schedule }; return; }
  const base = "./assets/champions-phantom/2026-0.1.0/audio/";
  const buffers = new Map(), live = new Set(), previewVoices = new Set(), music = new Set();
  let profiles, loading, error = null, epoch = 0, previewEpoch = 0, counts = new WeakMap();
  let musicEpoch = 0;
  const report = state => root.dispatchEvent(new CustomEvent("champions-audio-state", { detail: state }));
  const enabled = () => typeof SETTINGS !== "object" || SETTINGS.sfx;
  const phantom = (id) => id === "champions_atk" || id === "champions_def";
  async function json(file) { const r = await fetch(base + file); if (!r.ok) throw new Error(file + ": " + r.status); return r.json(); }
  function load() {
    if (loading) return loading;
    error = null;
    loading = (async () => {
      // The installed worker caches /assets by exact URL. Leave original samples
      // cached, but bypass the older seven-sample manifest after this upgrade.
      const [recipe, songs, manifest] = await Promise.all([json("kill-sequences.json"), json("music-sequences.json"), json("samples.json?v=music-1")]);
      const context = GAME_AUDIO.context();
      const decoded = await Promise.all(Object.entries(manifest.samples).map(async ([sound, meta]) => {
        const r = await fetch(base + meta.file); if (!r.ok) throw new Error(meta.file + ": " + r.status);
        const raw = await r.arrayBuffer();
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", raw)), (b) => b.toString(16).padStart(2, "0")).join("");
        if (raw.byteLength !== meta.bytes || hash !== meta.sha256) throw new Error("Phantom audio integrity: " + meta.file);
        return [sound, await context.decodeAudioData(raw)];
      }));
      decoded.forEach(([name, buffer]) => buffers.set(name, buffer)); profiles = { ...recipe.profiles, ...songs.profiles };
      return true;
    })().catch((e) => { error = e.message; loading = null; console.warn("Phantom audio", error); return false; });
    return loading;
  }
  async function start(name, preview, voices, duration = Infinity, delay = 0) {
    if (!enabled()) { if (preview) report("muted"); return false; }
    const generation = epoch, previewGeneration = previewEpoch, songGeneration = musicEpoch, requested = performance.now();
    const cancelled = () => generation !== epoch || (preview && previewGeneration !== previewEpoch) || (voices === music && songGeneration !== musicEpoch);
    try {
      // Unlock within the click/keypress, before fetch/digest/decode loses the gesture.
      const context = GAME_AUDIO.context();
      if (!context) throw new Error("Web Audio unavailable");
      const resumed = context.resume().then(() => true, () => false);
      if (preview) report("loading");
      const loaded = await load();
      if (cancelled()) return false;
      if (!loaded) throw new Error(error || "Audio load failed");
      if (!await resumed) throw new Error("Audio context suspended");
      if (cancelled() || !enabled()) return false;
      // An explicit preview waits for slow first loads. Old combat notes still expire.
      if (!preview && performance.now() - requested > 1500) return false;
      if (context.state !== "running") throw new Error("Audio context suspended");
      const start = context.currentTime + delay;
      schedule(context, GAME_AUDIO.output, profiles[name], buffers, start, voices, start + duration);
      if (preview) report("playing");
      return true;
    } catch (e) { if (!cancelled()) { error = e.message; if (preview) report("error"); } return false; }
  }
  function play(count, preview = false) { const n = Math.max(1, Math.min(5, count | 0)); return start("kill_" + n, preview, preview ? previewVoices : live, Infinity, n === 5 ? .075 : .04); }
  function stopVoices(voices) { for (const s of voices) { try { s.stop(); } catch (_) {} } voices.clear(); }
  function stopMusic() { musicEpoch++; stopVoices(music); }
  function playMusic(name, preview = false, duration = 10.2, delay = 0) { stopMusic(); return start(name, preview, music, duration, delay); }
  function stopPreview() { previewEpoch++; stopVoices(previewVoices); stopMusic(); report("idle"); }
  function reset() { epoch++; stopPreview(); counts = new WeakMap(); stopVoices(live); }
  const oldPreview = SOUNDPACK.preview, oldStop = SOUNDPACK.stop;
  SOUNDPACK.stop = function () { stopPreview(); return oldStop.apply(this, arguments); };
  SOUNDPACK.preview = function (skin, part) {
    stopPreview();
    if (phantom(typeof skin === "string" ? skin : skin?.id) && part === "kill") { oldStop(); void play(1, true); return true; }
    return oldPreview.apply(this, arguments);
  };
  const kill = SFX.kill;
  SFX.kill = function () {
    const event = root.KILL_EVENT, actor = myActor() || player;
    // A confirmed projectile carries its skin; abilities cannot borrow the held gun's sound.
    const gun = event ? event.gun : actor && actorWeaponKey(actor);
    const id = event ? event.skin : (actor && GUN_SKINS.skinOf(actor, gun) || {}).id;
    if (actor && gun === root.VALORANT_DATA.championsWeapon && phantom(id) && (!event || event.kind === "gun" || event.kind === "head")) {
      const old = counts.get(actor), round = world.round;
      const count = old && old.round === round ? old.count + 1 : 1;
      counts.set(actor, { round, count }); void play(count);
      return false; // no generic kill/headshot/multikill melody on top of the original
    }
    return kill.apply(this, arguments);
  };
  const clear = clearStatus;
  clearStatus = function (actor) { counts.delete(actor); return clear.apply(this, arguments); };
  for (const name of ["startRound", "startGame", "returnTitle"]) {
    const original = root[name];
    if (typeof original === "function") root[name] = function () { reset(); return original.apply(this, arguments); };
  }
  let inspecting = false;
  const tick = tickViewmodel;
  tickViewmodel = function () {
    const result = tick.apply(this, arguments), me = myActor();
    const active = !!(me?.alive && !me.ultW && phantom(GUN_SKINS.of(curWeaponKey()).id) && SKIN_PERKS.state.insp.t >= 0);
    if (active && !inspecting) void playMusic("inspect", false, 10.2);
    if (!active && inspecting) stopMusic();
    inspecting = active;
    return result;
  };
  root.CHAMPIONS_AUDIO = { load, play, playMusic, stopMusic, stopPreview, reset, ready: () => !!profiles, error: () => error };
  void load();
})(typeof window === "object" ? window : globalThis);
