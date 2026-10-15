
(() => {
  // Kills that sound and look like the skin in your hands, and like how many
  // you have just made. Every kill plays a two-note "ta-DAN" whose pitch climbs
  // a pentatonic ladder with each kill in the streak (a streak runs while the
  // next kill comes within 4.5 s), and a double kill to an ace adds a rising
  // flourish — an ace ends on a full fanfare. Epic skins add a bell and tint the
  // kill banner and the flash with the skin's colour; legendary skins add a deep
  // hit, sparkles, an echo, a gold banner with a sweeping shine and the skin's
  // name. Looks and sound only; nothing changes in a fight.
  if ("undefined" == typeof SFX || "undefined" == typeof playKillFx || "undefined" == typeof GUN_SKINS || "undefined" == typeof SKIN_PERKS) return;
  const $ = (id) => document.getElementById(id);
  const EN = () => "en" === window.GAME_LANG;

  // ── a small synth of its own (the game's keeps its voices to itself) ──
  let ac = null,
    bus = null,
    echo = null;
  const ctx = () => {
    if ("object" == typeof SETTINGS && SETTINGS && !SETTINGS.sfx) return null;
    if (ac) return "suspended" === ac.state && ac.resume(), ac;
    try {
      const A = window.AudioContext || window.webkitAudioContext;
      if (!A) return null;
      ac = GAME_AUDIO.context();
      bus = ac.createGain();
      bus.gain.value = 0.2;
      bus.connect(GAME_AUDIO.output);
      // a short feedback echo for the legendary kill
      echo = ac.createGain();
      echo.gain.value = 0;
      const dl = ac.createDelay(0.5),
        fb = ac.createGain(),
        lp = ac.createBiquadFilter();
      dl.delayTime.value = 0.17;
      fb.gain.value = 0.38;
      lp.type = "lowpass";
      lp.frequency.value = 3200;
      echo.connect(dl);
      dl.connect(lp);
      lp.connect(fb);
      fb.connect(dl);
      lp.connect(bus);
    } catch (e) {
      ac = null;
    }
    return ac;
  };
  // one note: freq, start (s from now), length, wave, gain, optional slide to, optional echo send
  const note = (f, at, len, type, vol, to, send) => {
    const c = ctx();
    if (!c) return;
    const t0 = c.currentTime + at,
      o = c.createOscillator(),
      g = c.createGain();
    o.type = type || "triangle";
    o.frequency.setValueAtTime(f, t0);
    to && o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + len);
    g.gain.setValueAtTime(1e-4, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.3, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(1e-4, t0 + len);
    o.connect(g);
    g.connect(bus);
    if (send && echo) {
      const s = c.createGain();
      s.gain.value = send;
      g.connect(s);
      s.connect(echo);
      echo.gain.value = 1;
    }
    o.start(t0);
    o.stop(t0 + len + 0.03);
  };
  const tick = (at, vol, hp) => {
    const c = ctx();
    if (!c) return;
    const n = Math.floor(c.sampleRate * 0.05),
      b = c.createBuffer(1, n, c.sampleRate),
      d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (2 * Math.random() - 1) * Math.pow(1 - i / n, 2.6);
    const s = c.createBufferSource(),
      f = c.createBiquadFilter(),
      g = c.createGain();
    s.buffer = b;
    f.type = "highpass";
    f.frequency.value = hp || 2600;
    g.gain.value = vol || 0.4;
    s.connect(f);
    f.connect(g);
    g.connect(bus);
    s.start(c.currentTime + (at || 0));
  };

  // ── the ladder: a major pentatonic climbing from A4 ──
  const SEMI = [0, 2, 4, 7, 9, 12, 14, 16];
  const hz = (st) => 440 * Math.pow(2, st / 12);
  const step = (n) => hz(SEMI[Math.min(Math.max(n, 1), 8) - 1]);

  // what the kill being played is: set by the wrapper below, read by the voices
  const K = { tier: 1, streak: 1, hs: !1, col: 0, key: "" };

  // ta-DAN: a short low pickup and the note proper
  const kill = (hs) => {
    const base = step(K.streak),
      t = K.tier;
    tick(0, 0.42, 3200);
    note(base * 0.75, 0, 0.06, "square", 0.22);
    note(base, 0.055, 0.15, "triangle", 0.34, null, t >= 4 ? 0.3 : 0);
    note(base * 2, 0.055, 0.1, "sine", 0.16);
    if (hs) {
      note(base * 3, 0.13, 0.16, "triangle", 0.2);
      tick(0.13, 0.22, 5200);
    }
    if (t >= 3) {
      // a bell: the note's partials ringing on
      note(base * 2, 0.06, 0.55, "sine", 0.22);
      note(base * 3.01, 0.06, 0.42, "sine", 0.12);
      note(base * 4.2, 0.06, 0.3, "sine", 0.07);
    }
    if (t >= 4) {
      // a deep hit under it and a fast sparkle above
      note(base / 4, 0, 0.42, "sine", 0.5, base / 6);
      for (let i = 0; i < 5; i++) note(base * 2 * Math.pow(2, SEMI[i % 5] / 12), 0.09 + 0.05 * i, 0.12, "sine", 0.1, null, 0.5);
    }
  };
  // the streak's flourish, a beat after the kill: double → ace
  const multi = (n) => {
    const t = K.tier;
    n = Math.min(Math.max(n, 2), 5);
    const run = [[0, 1], [0, 1, 2], [0, 1, 2, 3], [0, 1, 2, 3, 4, 5]][n - 2];
    const top = SEMI[Math.min(K.streak, 8) - 1];
    run.forEach((k, i) => {
      const f = hz(top + 12 + [0, 4, 7, 12, 16, 19][k]);
      note(f, 0.05 * i, 0.16 + (t >= 3 ? 0.1 : 0), "triangle", 0.2 + 0.02 * k, null, t >= 4 ? 0.35 : 0);
      t >= 3 && note(f * 2, 0.05 * i, 0.3, "sine", 0.07);
    });
    if (n >= 5) {
      // ace: a chord and a rumble
      [0, 4, 7, 12].forEach((s, i) => note(hz(top + s), 0.28, 0.9, i ? "triangle" : "sawtooth", 0.14, null, 0.4));
      note(60, 0.28, 0.8, "sine", 0.5, 38);
      tick(0.28, 0.35, 1800);
      for (let i = 0; i < 8; i++) note(hz(top + 24 + SEMI[i % 5]), 0.34 + 0.04 * i, 0.14, "sine", 0.09, null, 0.5);
    }
  };
  SFX.kill = kill;
  SFX.multi = multi;

  // ── the banner ──
  const css = document.createElement("style");
  css.textContent = `
#killfx.t3 #kf-badge{background:linear-gradient(180deg,color-mix(in srgb,var(--kfc) 30%,transparent),color-mix(in srgb,var(--kfc) 12%,transparent));border-color:color-mix(in srgb,var(--kfc) 70%,#fff 10%);box-shadow:0 0 36px -4px var(--kfc),inset 0 1px 0 rgba(255,255,255,.2)}
#killfx.t3 #kf-main{text-shadow:0 0 20px var(--kfc),0 0 3px #fff}
#killfx.t3 #kf-sub{color:color-mix(in srgb,var(--kfc) 40%,#fff)}
#killfx.t4 #kf-badge{position:relative;overflow:hidden;padding:12px 40px;background:linear-gradient(180deg,rgba(60,38,6,.82),rgba(26,16,4,.82));border:1px solid #ffd76a;box-shadow:0 0 46px -2px var(--kfc),0 0 0 1px rgba(255,215,106,.35),inset 0 1px 0 rgba(255,255,255,.3);animation:kfPop .5s cubic-bezier(.15,.9,.25,1.25)}
#killfx.t4 #kf-badge::after{content:"";position:absolute;top:0;bottom:0;width:38%;left:-45%;background:linear-gradient(105deg,transparent,rgba(255,255,255,.55),transparent);animation:kfShine 1.1s .15s ease-out forwards}
#killfx.t4 #kf-main{font-size:23px;color:#fff3c9;text-shadow:0 0 24px var(--kfc),0 0 6px #ffd76a}
#killfx.t4 #kf-sub{color:#ffe9a8}
#kf-tag{font-family:var(--f-display);font-size:10px;letter-spacing:.2em;color:var(--kfc,#ffd76a);text-indent:.2em;text-shadow:0 0 10px var(--kfc,#ffd76a);display:none}
#killfx.t3 #kf-tag,#killfx.t4 #kf-tag{display:block}
#killfx.ace #kf-streak{font-size:19px;letter-spacing:.3em;color:#fff3c9;text-shadow:0 0 22px #ffb300,0 0 6px #fff}
#killfx.t4.ace #kf-badge{animation:kfPop .5s cubic-bezier(.15,.9,.25,1.25),kfAce 1.6s ease-in-out}
body.kf-acc #killflash{background:radial-gradient(ellipse at center,transparent 50%,color-mix(in srgb,var(--kfc) 38%,transparent) 100%)}
@keyframes kfShine{to{left:120%}}
@keyframes kfAce{0%,100%{filter:none}35%{filter:drop-shadow(0 0 16px var(--kfc)) brightness(1.25)}}`;
  document.head.appendChild(css);
  const badge = $("kf-badge");
  let tag = null;
  if (badge) {
    tag = document.createElement("div");
    tag.id = "kf-tag";
    badge.appendChild(tag);
  }
  const hex = (n) => "#" + (n >>> 0).toString(16).padStart(6, "0");
  let accT = 0;

  // ── hook: work out the skin and the streak, then let the game do its part ──
  const _pk = playKillFx;
  playKillFx = function (who, hs) {
    let s = null,
      tier = 1;
    try {
      const my = "function" == typeof myActor ? myActor() : null;
      tier = SKIN_PERKS.tier() || 1;
      s = my && tier >= 3 ? GUN_SKINS.skinOf(my, curWeaponKey()) : null;
      if (s && !(s.rar >= 3)) s = null;
    } catch (e) {}
    K.tier = tier;
    K.hs = !!hs;
    K.streak = Math.min(8, (killStreak | 0) + 1);
    K.col = s && s.glow ? s.glow : 0;
    const r = _pk.apply(this, arguments);
    try {
      const fx = $("killfx");
      if (fx) {
        fx.classList.toggle("t3", tier === 3);
        fx.classList.toggle("t4", tier >= 4);
        fx.classList.toggle("ace", K.streak >= 5);
        if (K.col) {
          fx.style.setProperty("--kfc", hex(K.col));
          document.documentElement.style.setProperty("--kfc", hex(K.col));
          document.body.classList.add("kf-acc");
          clearTimeout(accT);
          accT = setTimeout(() => document.body.classList.remove("kf-acc"), 1900);
        } else document.body.classList.remove("kf-acc");
        if (tag) tag.textContent = s ? `${EN() ? s.en : s.ko} · ${tier >= 4 ? (EN() ? "LEGENDARY" : "전설") : EN() ? "EPIC" : "영웅"}` : "";
        // the banner plays its entrance again for the new look
        if (badge) {
          badge.style.animation = "none";
          badge.offsetWidth;
          badge.style.animation = "";
        }
      }
    } catch (e) {}
    return r;
  };

  window.KILLFX = { K, kill, multi, step, ladder: SEMI };
})();
