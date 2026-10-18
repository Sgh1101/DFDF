// Original Seafle note-block arrangements, played from the original recordings.
(function (root) {
  function schedule(context, output, profile, buffers, start, voices) {
    for (const note of profile.events) {
      const source = context.createBufferSource(), gain = context.createGain();
      source.buffer = buffers.get(note.sound);
      if (!source.buffer) throw new Error("Missing Phantom note: " + note.sound);
      source.playbackRate.value = Math.max(0.5, Math.min(2, note.pitch));
      gain.gain.value = note.volume;
      source.connect(gain); gain.connect(output);
      voices.add(source);
      source.onended = () => { voices.delete(source); source.disconnect(); gain.disconnect(); };
      source.start(start + note.at);
    }
  }
  if (typeof module === "object" && module.exports) { module.exports = { schedule }; return; }
  const base = "./assets/champions-phantom/2026-0.1.0/audio/";
  const buffers = new Map(), live = new Set(), previewVoices = new Set();
  let profiles, loading, error = null, epoch = 0, previewEpoch = 0, counts = new WeakMap();
  const enabled = () => typeof SETTINGS !== "object" || SETTINGS.sfx;
  const phantom = (id) => id === "champions_atk" || id === "champions_def";
  async function json(file) { const r = await fetch(base + file); if (!r.ok) throw new Error(file + ": " + r.status); return r.json(); }
  function load() {
    if (loading) return loading;
    error = null;
    loading = (async () => {
      const [recipe, manifest] = await Promise.all([json("kill-sequences.json"), json("samples.json")]);
      const context = GAME_AUDIO.context();
      const decoded = await Promise.all(Object.entries(manifest.samples).map(async ([sound, meta]) => {
        const r = await fetch(base + meta.file); if (!r.ok) throw new Error(meta.file + ": " + r.status);
        const raw = await r.arrayBuffer();
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", raw)), (b) => b.toString(16).padStart(2, "0")).join("");
        if (raw.byteLength !== meta.bytes || hash !== meta.sha256) throw new Error("Phantom audio integrity: " + meta.file);
        return [sound, await context.decodeAudioData(raw)];
      }));
      decoded.forEach(([name, buffer]) => buffers.set(name, buffer)); profiles = recipe.profiles;
      return true;
    })().catch((e) => { error = e.message; loading = null; console.warn("Phantom audio", error); return false; });
    return loading;
  }
  async function play(count, preview = false) {
    if (!enabled()) return false;
    const generation = epoch, previewGeneration = previewEpoch, requested = performance.now();
    if (!await load() || generation !== epoch || (preview && previewGeneration !== previewEpoch) || !enabled() || performance.now() - requested > 1500) return false;
    const context = GAME_AUDIO.context(); await context.resume();
    if (generation !== epoch || (preview && previewGeneration !== previewEpoch) || !enabled()) return false;
    const n = Math.max(1, Math.min(5, count | 0));
    schedule(context, GAME_AUDIO.output, profiles["kill_" + n], buffers, context.currentTime + (n === 5 ? 0.075 : 0.04), preview ? previewVoices : live);
    return true;
  }
  function stopPreview() { previewEpoch++; for (const s of previewVoices) { try { s.stop(); } catch (_) {} } previewVoices.clear(); }
  function reset() { epoch++; stopPreview(); counts = new WeakMap(); for (const s of live) { try { s.stop(); } catch (_) {} } live.clear(); }
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
  root.CHAMPIONS_AUDIO = { load, play, stopPreview, reset, ready: () => !!profiles, error: () => error };
  void load();
})(typeof window === "object" ? window : globalThis);
