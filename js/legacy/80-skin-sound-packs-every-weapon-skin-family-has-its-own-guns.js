
(() => {
  // Skin sound packs: every weapon skin family has its own gunshot colour, kill
  // sound, headshot sound and finisher (ace / 5-kill streak / last enemy), all
  // synthesized here like the rest of the game's sounds (no audio files).
  // The stock skin keeps the game's sound exactly. A pack's gunshot is a layer on
  // top of the gun's own shot, so a sniper still sounds like a sniper.
  // Respects the 효과음 setting (SETTINGS.sfx); one shared noise buffer, a few
  // short oscillators per sound.
  if ("undefined" == typeof SFX || "function" != typeof SFX.gun) return;

  // A voice: w = wave ("sine" "square" "sawtooth" "triangle" or "noise"), f = Hz,
  // to = slide to Hz, d = length s, v = volume, at = start s, cut = filter Hz,
  // ft = filter type, q = filter Q. Tonal voices follow the streak pitch.
  const PACKS = {
    bouncy: {
      ko: "쫀득한", en: "Bouncy",
      shot: [{ w: "sine", f: 520, to: 1300, d: 0.05, v: 0.22 }, { w: "sine", f: 1300, to: 380, d: 0.09, v: 0.2, at: 0.045 }, { w: "noise", d: 0.03, v: 0.18, cut: 3000, ft: "bandpass", q: 4 }],
      kill: [{ w: "sine", f: 330, to: 990, d: 0.08, v: 0.3 }, { w: "sine", f: 990, to: 495, d: 0.1, v: 0.28, at: 0.08 }, { w: "sine", f: 660, to: 1320, d: 0.12, v: 0.24, at: 0.17 }],
      head: [{ w: "sine", f: 1320, to: 2640, d: 0.06, v: 0.22, at: 0.05 }, { w: "sine", f: 2640, to: 1760, d: 0.1, v: 0.16, at: 0.11 }],
      fin: [{ w: "sine", f: 262, to: 784, d: 0.12, v: 0.3, at: 0.3 }, { w: "sine", f: 392, to: 1175, d: 0.12, v: 0.28, at: 0.42 }, { w: "sine", f: 523, to: 1568, d: 0.3, v: 0.28, at: 0.54 }, { w: "sine", f: 1568, to: 784, d: 0.25, v: 0.18, at: 0.84 }],
    },
    heavy: {
      ko: "묵직한", en: "Heavy",
      shot: [{ w: "sine", f: 120, to: 34, d: 0.2, v: 0.5 }, { w: "noise", d: 0.16, v: 0.34, cut: 420 }],
      kill: [{ w: "sine", f: 90, to: 30, d: 0.35, v: 0.55 }, { w: "noise", d: 0.2, v: 0.35, cut: 500 }, { w: "triangle", f: 220, to: 110, d: 0.22, v: 0.26, at: 0.06 }],
      head: [{ w: "square", f: 165, to: 55, d: 0.16, v: 0.2, at: 0.04 }, { w: "noise", d: 0.08, v: 0.3, cut: 1500, ft: "bandpass", at: 0.04 }],
      fin: [{ w: "sine", f: 70, to: 26, d: 0.9, v: 0.6, at: 0.3 }, { w: "sawtooth", f: 110, d: 0.5, v: 0.16, at: 0.3, cut: 600 }, { w: "noise", d: 0.7, v: 0.3, cut: 300, at: 0.3 }],
    },
    energy: {
      ko: "전자/에너지", en: "Energy",
      shot: [{ w: "sawtooth", f: 1800, to: 240, d: 0.07, v: 0.16, cut: 4000 }, { w: "square", f: 3600, to: 900, d: 0.04, v: 0.08 }],
      kill: [{ w: "sawtooth", f: 220, to: 1760, d: 0.14, v: 0.22, cut: 3500 }, { w: "square", f: 880, d: 0.05, v: 0.14, at: 0.14 }, { w: "square", f: 1320, d: 0.05, v: 0.14, at: 0.2 }],
      head: [{ w: "sawtooth", f: 3000, to: 6000, d: 0.08, v: 0.12, at: 0.05 }, { w: "noise", d: 0.06, v: 0.2, cut: 7000, ft: "highpass", at: 0.05 }],
      fin: [{ w: "sawtooth", f: 110, to: 3520, d: 0.5, v: 0.22, at: 0.3, cut: 5000 }, { w: "square", f: 1760, d: 0.06, v: 0.12, at: 0.82 }, { w: "square", f: 2349, d: 0.06, v: 0.12, at: 0.9 }, { w: "square", f: 3520, d: 0.2, v: 0.12, at: 0.98 }, { w: "noise", d: 0.3, v: 0.16, cut: 8000, ft: "highpass", at: 0.8 }],
    },
    crystal: {
      ko: "크리스탈", en: "Crystal",
      shot: [{ w: "sine", f: 2637, d: 0.14, v: 0.1 }, { w: "sine", f: 3951, d: 0.09, v: 0.06 }, { w: "noise", d: 0.03, v: 0.14, cut: 8000, ft: "highpass" }],
      kill: [{ w: "sine", f: 1568, d: 0.5, v: 0.22 }, { w: "sine", f: 2349, d: 0.4, v: 0.14, at: 0.04 }, { w: "sine", f: 3136, d: 0.35, v: 0.1, at: 0.08 }],
      head: [{ w: "sine", f: 4186, d: 0.3, v: 0.12, at: 0.12 }, { w: "triangle", f: 5274, d: 0.2, v: 0.07, at: 0.16 }],
      fin: [{ w: "sine", f: 1047, d: 0.7, v: 0.18, at: 0.3 }, { w: "sine", f: 1319, d: 0.7, v: 0.16, at: 0.38 }, { w: "sine", f: 1568, d: 0.7, v: 0.16, at: 0.46 }, { w: "sine", f: 2093, d: 0.9, v: 0.16, at: 0.54 }, { w: "noise", d: 0.6, v: 0.1, cut: 9000, ft: "highpass", at: 0.5 }],
    },
    retro: {
      ko: "레트로 8비트", en: "Retro 8-bit",
      shot: [{ w: "square", f: 880, to: 110, d: 0.06, v: 0.14 }, { w: "noise", d: 0.04, v: 0.14, cut: 2500 }],
      kill: [{ w: "square", f: 523, d: 0.05, v: 0.18 }, { w: "square", f: 659, d: 0.05, v: 0.18, at: 0.05 }, { w: "square", f: 784, d: 0.05, v: 0.18, at: 0.1 }, { w: "square", f: 1047, d: 0.1, v: 0.18, at: 0.15 }],
      head: [{ w: "square", f: 1568, d: 0.04, v: 0.14, at: 0.25 }, { w: "square", f: 2093, d: 0.08, v: 0.14, at: 0.29 }],
      fin: [{ w: "square", f: 523, d: 0.08, v: 0.16, at: 0.3 }, { w: "square", f: 523, d: 0.08, v: 0.16, at: 0.4 }, { w: "square", f: 523, d: 0.08, v: 0.16, at: 0.5 }, { w: "square", f: 659, d: 0.16, v: 0.16, at: 0.6 }, { w: "square", f: 784, d: 0.16, v: 0.16, at: 0.78 }, { w: "square", f: 1047, d: 0.35, v: 0.18, at: 0.96 }, { w: "triangle", f: 131, d: 0.6, v: 0.25, at: 0.6 }],
    },
    dragon: {
      ko: "용/불꽃", en: "Dragonfire",
      shot: [{ w: "noise", d: 0.18, v: 0.3, cut: 1200, ft: "bandpass", q: 0.8 }, { w: "sawtooth", f: 95, to: 45, d: 0.16, v: 0.2, cut: 700 }],
      kill: [{ w: "noise", d: 0.4, v: 0.35, cut: 900, ft: "bandpass", q: 0.7 }, { w: "sawtooth", f: 150, to: 60, d: 0.35, v: 0.24, cut: 900 }, { w: "triangle", f: 440, to: 880, d: 0.2, v: 0.16, at: 0.15 }],
      head: [{ w: "noise", d: 0.12, v: 0.3, cut: 4000, ft: "highpass", at: 0.05 }, { w: "sawtooth", f: 660, to: 1320, d: 0.14, v: 0.12, at: 0.05, cut: 2500 }],
      fin: [{ w: "sawtooth", f: 80, to: 220, d: 0.6, v: 0.3, at: 0.3, cut: 800 }, { w: "noise", d: 1, v: 0.35, cut: 700, ft: "bandpass", q: 0.6, at: 0.3 }, { w: "triangle", f: 587, d: 0.4, v: 0.16, at: 0.8 }, { w: "triangle", f: 880, d: 0.5, v: 0.16, at: 0.9 }],
    },
    cosmic: {
      ko: "우주", en: "Cosmic",
      shot: [{ w: "sine", f: 600, to: 150, d: 0.12, v: 0.16 }, { w: "triangle", f: 1200, to: 2400, d: 0.08, v: 0.06 }],
      kill: [{ w: "sine", f: 440, to: 220, d: 0.4, v: 0.24 }, { w: "sine", f: 660, to: 1320, d: 0.4, v: 0.14, at: 0.05 }, { w: "triangle", f: 1760, d: 0.25, v: 0.08, at: 0.2 }, { w: "triangle", f: 2217, d: 0.25, v: 0.08, at: 0.28 }],
      head: [{ w: "sine", f: 2960, to: 1480, d: 0.3, v: 0.12, at: 0.08 }],
      fin: [{ w: "sine", f: 55, to: 110, d: 1.2, v: 0.4, at: 0.3 }, { w: "sine", f: 880, to: 1760, d: 0.9, v: 0.12, at: 0.3 }, { w: "sine", f: 1320, to: 660, d: 0.9, v: 0.12, at: 0.4 }, { w: "noise", d: 1, v: 0.12, cut: 6000, ft: "highpass", at: 0.4 }],
    },
    royal: {
      ko: "황금/왕실", en: "Royal",
      shot: [{ w: "triangle", f: 1175, d: 0.08, v: 0.1 }, { w: "noise", d: 0.05, v: 0.16, cut: 5000, ft: "highpass" }],
      kill: [{ w: "triangle", f: 784, d: 0.18, v: 0.24 }, { w: "triangle", f: 988, d: 0.18, v: 0.2, at: 0.06 }, { w: "triangle", f: 1175, d: 0.3, v: 0.2, at: 0.12 }, { w: "sine", f: 2349, d: 0.4, v: 0.08, at: 0.12 }],
      head: [{ w: "sine", f: 3136, d: 0.35, v: 0.1, at: 0.15 }, { w: "noise", d: 0.2, v: 0.1, cut: 9000, ft: "highpass", at: 0.15 }],
      fin: [{ w: "sawtooth", f: 392, d: 0.15, v: 0.14, at: 0.3, cut: 2000 }, { w: "sawtooth", f: 523, d: 0.15, v: 0.14, at: 0.45, cut: 2000 }, { w: "sawtooth", f: 659, d: 0.15, v: 0.14, at: 0.6, cut: 2000 }, { w: "sawtooth", f: 784, d: 0.6, v: 0.16, at: 0.75, cut: 2400 }, { w: "noise", d: 0.6, v: 0.12, cut: 9000, ft: "highpass", at: 0.75 }],
    },
    blade: {
      ko: "바람/칼날", en: "Blade wind",
      shot: [{ w: "noise", d: 0.09, v: 0.26, cut: 2500, ft: "bandpass", q: 2 }, { w: "sine", f: 1800, to: 900, d: 0.05, v: 0.06 }],
      kill: [{ w: "noise", d: 0.16, v: 0.4, cut: 3000, ft: "bandpass", q: 3 }, { w: "triangle", f: 1760, to: 2637, d: 0.12, v: 0.12, at: 0.12 }, { w: "sine", f: 2637, d: 0.3, v: 0.1, at: 0.18 }],
      head: [{ w: "noise", d: 0.06, v: 0.3, cut: 6000, ft: "highpass", at: 0.08 }, { w: "sine", f: 3520, d: 0.2, v: 0.08, at: 0.1 }],
      fin: [{ w: "noise", d: 0.14, v: 0.4, cut: 2500, ft: "bandpass", q: 3, at: 0.3 }, { w: "noise", d: 0.14, v: 0.4, cut: 3500, ft: "bandpass", q: 3, at: 0.42 }, { w: "noise", d: 0.2, v: 0.4, cut: 5000, ft: "bandpass", q: 3, at: 0.54 }, { w: "sine", f: 1760, d: 0.8, v: 0.12, at: 0.7 }, { w: "sine", f: 2637, d: 0.8, v: 0.08, at: 0.72 }],
    },
  };
  // skin id → pack (the stock skin has none and keeps the game's own sound)
  const SKIN_PACK = {
    sakura: "bouncy", hex: "bouncy", flip: "bouncy", butterfly: "bouncy",
    obsidian: "heavy", urban: "heavy", navy: "heavy", jungle: "heavy", kukri: "heavy",
    neon: "energy", circuit: "energy", storm: "energy", holo: "energy",
    ice: "crystal", snow: "crystal", celadon: "crystal", marble: "crystal",
    carbon: "retro", desert: "retro",
    dragon: "dragon", phoenix: "dragon", lava: "dragon", tiger: "dragon",
    galaxy: "cosmic", aurora: "cosmic",
    gold: "royal", dancheong: "royal",
    ink: "blade", wave: "blade", tanto: "blade", karambit: "blade",
  };

  // ── the synth ──
  let ac = null,
    bus = null,
    nb = null;
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
      const n = ac.sampleRate; // one second of noise, made once and reused
      nb = ac.createBuffer(1, n, n);
      const d = nb.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = 2 * Math.random() - 1;
    } catch (e) {
      ac = null;
    }
    return ac;
  };
  addEventListener("pointerdown", ctx, { passive: !0 });
  addEventListener("keydown", ctx, { passive: !0 });
  function voice(c, x, vol, pitch, base) {
    const t0 = c.currentTime + (base || 0) + (x.at || 0),
      d = x.d || 0.1,
      g = c.createGain();
    let src,
      head = g;
    if ("noise" === x.w) {
      src = c.createBufferSource();
      src.buffer = nb;
    } else {
      src = c.createOscillator();
      src.type = x.w || "sine";
      src.frequency.setValueAtTime(x.f * pitch, t0);
      x.to && src.frequency.exponentialRampToValueAtTime(Math.max(20, x.to * pitch), t0 + d);
    }
    if (x.cut) {
      const f = c.createBiquadFilter();
      f.type = x.ft || "lowpass";
      f.frequency.value = x.cut;
      x.q && (f.Q.value = x.q);
      f.connect(g);
      head = f;
    }
    g.gain.setValueAtTime(1e-4, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(2e-4, (x.v || 0.2) * vol), t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(1e-4, t0 + d);
    src.connect(head);
    g.connect(bus);
    "noise" === x.w ? src.start(t0, Math.random() * 0.5) : src.start(t0);
    src.stop(t0 + d + 0.03);
    if (sampling) previewVoices.add(src);
    src.onended = () => { previewVoices.delete(src); src.disconnect(); g.disconnect(); if (head !== g) head.disconnect(); };
  }
  function play(list, vol, pitch, base) {
    const c = ctx();
    if (!c || !list) return;
    for (const x of list) voice(c, x, vol == null ? 1 : vol, pitch || 1, base);
  }
  const packOfSkin = (s) => (s && PACKS[SKIN_PACK[s.id || s]]) || null;
  const mine = () => ("function" == typeof myActor ? myActor() : window.player) || null;
  function skinFor(a, key) {
    try {
      return a && window.GUN_SKINS && GUN_SKINS.skinOf ? GUN_SKINS.skinOf(a, key) : null;
    } catch (e) {
      return null;
    }
  }

  // ── gunshots: who is firing ──
  let shooter = null;
  if ("function" == typeof window.actorFire) {
    const _af = window.actorFire;
    window.actorFire = function (e) {
      const was = shooter;
      shooter = e;
      try {
        return _af.apply(this, arguments);
      } finally {
        shooter = was;
      }
    };
  }
  const shotTimes = new Map();
  const _gun = SFX.gun;
  SFX.gun = function (key, far) {
    const r = _gun.apply(this, arguments);
    try {
      // my own predicted shots (guest) come without a shooter at distance 0
      const a = shooter || window.SKIN_SHOOTER || (0 === far ? mine() : null);
      if (!a || a.ultW) return r;
      const skin = window.SKIN_SHOT && window.SKIN_SHOT.actor === a.id ? window.SKIN_SHOT.skin : skinFor(a, key);
      const P = packOfSkin(skin);
      if (!P) return r;
      const now = performance.now();
      const shotKey = String(a.id) + "|" + key;
      if (now - (shotTimes.get(shotKey) || -100) < 25) return r;
      shotTimes.set(shotKey, now);
      if (shotTimes.size > 100) shotTimes.delete(shotTimes.keys().next().value);
      const k = 1 - 0.75 * Math.min(Math.max(+far || 0, 0), 1);
      k > 0.1 && play(P.shot, k, skinPitch(skin));
    } catch (e) {}
    return r;
  };

  // ── kills: called from the kill layer (returns true when a pack played) ──
  const curKey = () => {
    try {
      return "function" == typeof curWeaponKey ? curWeaponKey() : actorWeaponKey(mine());
    } catch (e) {
      return null;
    }
  };
  function onKill(k, head, st) {
    k = window.KILL_EVENT || k;
    if (!k || ["ability", "grenade", "environment"].includes(k.kind)) return !1;
    const me = mine();
    if (!me || (!window.KILL_EVENT && me.ultW)) return !1;
    const P = packOfSkin(k.skin || skinFor(me, curKey()));
    if (!P) return !1;
    const p = Math.pow(1.059, Math.min(Math.max(st | 0, 1), 8) - 1); // a semitone up per kill in a streak
    play(P.kill, 1, p);
    (head || "head" === k.kind) && play(P.head, 1, p);
    GAME_RULES.finisher(k) && play(P.fin, 0.7, 1);
    return !0;
  }
  const previewVoices = new Set();
  let sampling = false, previewTimers = [];
  function stopPreview() {
    previewTimers.forEach(clearTimeout); previewTimers = [];
    for (const node of previewVoices) try { node.stop(); } catch (e) {}
    previewVoices.clear();
    window.FINISHERS && FINISHERS.clear();
  }
  function skinPitch(skin) {
    const id = String(skin && (skin.id || skin) || "default");
    let seed = 0; for (const ch of id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    return 0.94 + (seed % 13) / 100;
  }
  function preview(skin, part = "shot", gun = "rifle") {
    stopPreview();
    const P = packOfSkin(skin);
    if (!ctx() && part !== "fin") return false;
    sampling = true;
    try {
      if (part === "shot") {
        for (let i = 0; i < 3; i++) {
          if (P) play(P.shot, 1, skinPitch(skin), i * 0.15);
          previewTimers.push(setTimeout(() => _gun.call(SFX, gun, 0), i * 150));
        }
      } else if (part === "kill" && P) { play(P.kill, 1, 1); play(P.head, 0.7, 1); }
      else if (part === "fin" && P) { play(P.fin, 0.8, 1); window.FINISHERS && FINISHERS.preview(skin); }
      else return false;
    } finally { sampling = false; }
    return true;
  }
  window.SOUNDPACK = { packs: PACKS, skins: SKIN_PACK, onKill, preview, stop: stopPreview, play };

})();
