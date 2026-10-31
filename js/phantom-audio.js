// Champions Phantom music: DFDF's own arrangements (scripts/champions-phantom/audio.js),
// played on instruments synthesized here from numeric recipes. No recordings are loaded.
(function (root) {
  const TYPES = ["kick", "snare", "hat", "pluck", "fm", "breath"];
  // Validates one instrument recipe from samples.json before anything is rendered.
  function recipe(meta) {
    if (!meta || !TYPES.includes(meta.type)) throw new Error("Phantom instrument type");
    for (const [k, v] of Object.entries(meta)) if (k !== "type" && !(Number.isFinite(v) && v >= 0 && v <= 2000)) throw new Error("Phantom instrument value: " + k);
    if (!(meta.duration > 0 && meta.duration <= 3)) throw new Error("Phantom instrument duration");
    return meta;
  }
  // Renders one note (pitch 1) as mono samples. Deterministic: same recipe, same samples.
  function render(meta, rate) {
    recipe(meta);
    const n = Math.ceil(meta.duration * rate), out = new Float32Array(n), TAU = Math.PI * 2;
    let seed = 0x2f6b1d, low = 0, prev = 0, phase = 0;
    const noise = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2147483648) - 1;
    const tail = (t) => Math.min(1, (meta.duration - t) / 0.02); // click-free end
    if (meta.type === "pluck") { // plucked string: a filtered noise burst circulating in a delay line
      const period = Math.max(2, Math.round(rate / meta.base)), line = new Float32Array(period), bright = Math.min(0.99, meta.bright);
      for (let i = 0; i < period; i++) { low += (noise() - low) * bright; line[i] = low; }
      for (let i = 0, k = 0; i < n; i++, k = (k + 1) % period) {
        const t = i / rate, y = line[k];
        line[k] = (y + line[(k + 1) % period]) * 0.5 * 0.998;
        out[i] = (y * 1.6 + (meta.sub || 0) * Math.sin(TAU * meta.base * t)) * Math.exp(-t * meta.decay) * tail(t);
      }
    } else for (let i = 0; i < n; i++) {
      const t = i / rate;
      if (meta.type === "kick") {
        phase += TAU * (meta.end + (meta.base - meta.end) * Math.exp(-t * 28)) / rate;
        out[i] = (Math.sin(phase) * Math.exp(-t * 9) + meta.click * noise() * Math.exp(-t * 380)) * tail(t);
      } else if (meta.type === "snare") {
        const white = noise(), high = white - prev; prev = white;
        out[i] = (meta.tone * Math.sin(TAU * meta.base * t) * Math.exp(-t * 24) + meta.noise * high * 0.6 * Math.exp(-t * 15)) * tail(t);
      } else if (meta.type === "hat") {
        const white = noise(), high = white - prev; prev = white;
        out[i] = meta.noise * high * Math.exp(-t * 55) * tail(t);
      } else if (meta.type === "fm") {
        const env = Math.exp(-t * meta.decay) * Math.min(1, t / 0.004);
        out[i] = Math.sin(TAU * meta.base * t + meta.index * Math.exp(-t * meta.decay * 0.6) * Math.sin(TAU * meta.base * meta.ratio * t)) * env * tail(t);
      } else { // breath: a soft flute-like tone with vibrato and a little air
        phase += TAU * meta.base * (1 + meta.vibrato * Math.sin(TAU * 5.5 * t)) / rate;
        low += (noise() - low) * 0.2;
        const env = Math.min(1, t / meta.attack) * (t < meta.duration - 0.18 ? 0.85 + 0.15 * Math.exp(-t * 8) : 0.85 * Math.max(0, (meta.duration - t) / 0.18));
        out[i] = (Math.sin(phase) + 0.18 * Math.sin(2 * phase) + meta.noise * low) * env;
      }
    }
    let peak = 0; for (const v of out) peak = Math.max(peak, Math.abs(v));
    if (peak > 0) for (let i = 0; i < n; i++) out[i] *= 0.9 / peak;
    return out;
  }
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
  if (typeof module === "object" && module.exports) { module.exports = { schedule, render, recipe }; return; }
  const base = "./assets/champions-phantom/dfdf-1/audio/";
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
      // The installed worker caches /assets by exact URL; the version query
      // keeps an older cached instrument list from being reused after an upgrade.
      const [kills, songs, manifest] = await Promise.all([json("kill-sequences.json"), json("music-sequences.json"), json("samples.json?v=synth-1")]);
      const context = GAME_AUDIO.context(), rendered = new Map();
      for (const [sound, meta] of Object.entries(manifest.samples || {})) {
        const data = render(meta, context.sampleRate), buffer = context.createBuffer(1, data.length, context.sampleRate);
        buffer.getChannelData(0).set(data); rendered.set(sound, buffer);
      }
      const all = { ...kills.profiles, ...songs.profiles };
      for (const profile of Object.values(all)) for (const note of profile.events) if (!rendered.has(note.sound)) throw new Error("Missing Phantom instrument: " + note.sound);
      rendered.forEach((buffer, name) => buffers.set(name, buffer)); profiles = all;
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
