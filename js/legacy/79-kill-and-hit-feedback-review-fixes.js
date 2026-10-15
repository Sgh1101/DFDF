
(() => {
  // Kill and hit feedback (review-fixes):
  // 1) kill sounds differ by how the kill was made (melee, sniper, ability, headshot),
  //    rise in pitch with the streak, and the last enemy / an ace get their own sting
  // 2) an X hit marker on headshots, an armor-break sound, a sharper sound when I am hit
  // Every sound respects the 효과음 setting (SETTINGS.sfx); the marker is purely visual.
  if ("undefined" == typeof SFX || "function" != typeof killActor || "function" != typeof dealDamage) return;
  // ── a tiny synth of our own (the base SFX keeps its helpers private) ──
  let ac = null,
    out = null;
  function ctx() {
    if ("object" == typeof SETTINGS && SETTINGS && !SETTINGS.sfx) return null;
    if (ac) return "suspended" === ac.state && ac.resume(), ac;
    try {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ac = GAME_AUDIO.context();
      out = ac.createGain();
      out.gain.value = 0.22;
      out.connect(GAME_AUDIO.output);
    } catch (e) {
      ac = null;
    }
    return ac;
  }
  addEventListener("pointerdown", ctx, { passive: !0 });
  addEventListener("keydown", ctx, { passive: !0 });
  function tone(f, d, w, v, to, delay) {
    const c = ctx();
    if (!c) return;
    const t0 = c.currentTime + (delay || 0),
      o = c.createOscillator(),
      g = c.createGain();
    o.type = w || "square";
    o.frequency.setValueAtTime(f, t0);
    to && o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + d);
    g.gain.setValueAtTime(1e-4, t0);
    g.gain.exponentialRampToValueAtTime(v || 0.3, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(1e-4, t0 + d);
    o.connect(g), g.connect(out), o.start(t0), o.stop(t0 + d + 0.02);
  }
  function noise(d, v, cut, type, delay) {
    const c = ctx();
    if (!c) return;
    const t0 = c.currentTime + (delay || 0),
      n = Math.max(1, Math.floor(c.sampleRate * d)),
      buf = c.createBuffer(1, n, c.sampleRate),
      ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = (2 * Math.random() - 1) * Math.pow(1 - i / n, 2.2);
    const src = c.createBufferSource(),
      f = c.createBiquadFilter(),
      g = c.createGain();
    src.buffer = buf;
    f.type = type || "lowpass";
    f.frequency.value = cut || 2000;
    g.gain.value = v || 0.4;
    src.connect(f), f.connect(g), g.connect(out), src.start(t0);
  }

  // ── how the last kill was made ──
  let gunCtx = 0; // >0 while a gun shot (or knife swing) is being resolved
  const wrapGun = (name) => {
    const f = window[name];
    if ("function" != typeof f) return;
    window[name] = function () {
      gunCtx++;
      try {
        return f.apply(this, arguments);
      } finally {
        gunCtx--;
      }
    };
  };
  ["actorFire", "hitscan", "actorHitscan"].forEach(wrapGun);
  function kindOf(killer, head) {
    if (!killer || !gunCtx || killer.ultW) return "ability";
    let w = null;
    try {
      w = WEAPONS["function" == typeof actorWeaponKey ? actorWeaponKey(killer) : null];
    } catch (e) {}
    if (w && "근접" === w.cls) return "melee";
    if (head) return "head";
    if (w && "저격총" === w.cls) return "sniper";
    return "gun";
  }
  let KILL = null; // what killActor knows, read by SFX.kill a moment later
  const _ka = killActor;
  killActor = function (e, t) {
    try {
      if (e && e.alive && t && "me" === t.ctrl && e !== t && e.team !== t.team) {
        const foes = (world.actors || []).filter((a) => a && a.team !== t.team);
        e._kbm = 1; // killed by me (cleared when someone else gets the kill)
        const left = foes.filter((a) => a !== e && a.alive).length;
        const mine = foes.filter((a) => (a === e || !a.alive) && a._kbm).length;
        KILL = { kind: kindOf(t, !!e._lastHead), last: 0 === left && foes.length > 1, ace: 0 === left && foes.length >= 3 && mine >= foes.length };
      } else e && (e._kbm = 0);
    } catch (x) {
      KILL = null;
    }
    try {
      return _ka.apply(this, arguments);
    } finally {
      KILL = null;
    }
  };

  // ── kill sounds ──
  // The base kill sound (the KILLFX ladder: higher with every kill in a streak,
  // richer with better skins, its own headshot note) stays as it is; on top of it
  // comes a short layer for how the kill was made, and a sting for the round's
  // last enemy or an ace.
  const _kill = SFX.kill;
  SFX.kill = function (head) {
    const k = KILL || { kind: head ? "head" : "gun" };
    try {
      _kill.apply(SFX, arguments);
    } catch (e) {}
    if (!ctx()) return;
    const st = "number" == typeof killStreak ? Math.max(1, killStreak) : 1,
      p = Math.pow(1.06, Math.min(st, 6) - 1); // the layer climbs with the streak too
    // a skin with a sound pack plays its own kill / headshot / finisher instead of this layer
    try {
      if (window.SOUNDPACK && SOUNDPACK.onKill(k, head, st)) return;
    } catch (e) {}
    switch (k.kind) {
      case "melee": // a heavy slash: swoosh, then a thud
        noise(0.12, 0.45, 1800, "bandpass"), tone(320 * p, 0.09, "sawtooth", 0.22, 90), tone(150 * p, 0.16, "triangle", 0.28, 60, 0.07);
        break;
      case "sniper": // a long ringing ping
        noise(0.05, 0.3, 4200, "highpass"), tone(880 * p, 0.34, "sine", 0.2, 0, 0.04), tone(1760 * p, 0.44, "sine", 0.1, 0, 0.08);
        break;
      case "ability": // a quick sparkling run
        [0, 1, 2, 3].forEach((i) => tone(700 * p * Math.pow(1.26, i), 0.08, "triangle", 0.16, 0, 0.04 * i));
        noise(0.14, 0.14, 6000, "highpass", 0.1);
        break;
      case "head": // an extra bright crack above the base headshot note
        noise(0.04, 0.3, 6500, "highpass"), tone(2400 * p, 0.12, "sine", 0.12, 0, 0.02);
        break;
    }
    if (k.ace && st < 5) {
      // an ace the streak didn't already announce (the base multi() plays its own at 5 in a row)
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.18, "square", 0.16, 0, 0.32 + 0.08 * i));
      tone(1568, 0.6, "triangle", 0.2, 0, 0.75), noise(0.5, 0.16, 5000, "highpass", 0.75);
    } else if (k.last && !k.ace) {
      // the round is decided: two low hits and a bright tail
      tone(196, 0.16, "sawtooth", 0.22, 0, 0.3), tone(196, 0.16, "sawtooth", 0.22, 0, 0.46), tone(1175, 0.4, "triangle", 0.18, 0, 0.62);
    }
  };

  // ── X marker for headshots ──
  const css = document.createElement("style");
  css.textContent =
    "#hsx{position:fixed;left:50%;top:50%;width:30px;height:30px;margin:-15px 0 0 -15px;pointer-events:none;z-index:40;opacity:0}#hsx i{position:absolute;left:50%;top:50%;width:3px;height:13px;margin:-6.5px 0 0 -1.5px;background:#ff3b4e;box-shadow:0 0 4px rgba(0,0,0,.7)}#hsx i:nth-child(1){transform:rotate(45deg) translateY(-10px)}#hsx i:nth-child(2){transform:rotate(135deg) translateY(-10px)}#hsx i:nth-child(3){transform:rotate(225deg) translateY(-10px)}#hsx i:nth-child(4){transform:rotate(315deg) translateY(-10px)}#hsx.on{animation:hsxPop .28s ease-out}@keyframes hsxPop{0%{opacity:1;transform:scale(1.35)}60%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1)}}";
  document.head.appendChild(css);
  const hsx = document.createElement("div");
  hsx.id = "hsx";
  hsx.innerHTML = "<i></i><i></i><i></i><i></i>";
  document.body.appendChild(hsx);
  if ("function" == typeof hitMarker) {
    const _hm = hitMarker;
    hitMarker = function (head) {
      const r = _hm.apply(this, arguments);
      if (head)
        try {
          hsx.classList.remove("on"), void hsx.offsetWidth, hsx.classList.add("on");
        } catch (e) {}
      return r;
    };
  }

  // ── armor break / being hit ──
  let hurtT = 0,
    breakT = 0;
  SFX.armorBreak = function () {
    const n = performance.now();
    if (n - breakT < 120) return;
    breakT = n;
    noise(0.18, 0.55, 3800, "highpass"), tone(1250, 0.07, "square", 0.22, 520), tone(700, 0.12, "triangle", 0.2, 260, 0.05);
  };
  const _hurt = SFX.hurt;
  SFX.hurt = function () {
    const n = performance.now();
    if (n - hurtT < 70) return; // a shotgun blast is one sound, not eight
    hurtT = n;
    // the old muffled hit, plus a deep body thump only I hear
    try {
      _hurt.apply(SFX, arguments);
    } catch (e) {}
    tone(95, 0.14, "sine", 0.4, 45), noise(0.05, 0.25, 400, "lowpass", 0.01);
  };
  const _dd = dealDamage;
  dealDamage = function (e, t, o, a) {
    const had = e && e.armor > 0;
    const r = _dd.apply(this, arguments);
    try {
      if (had && !(e.armor > 0) && ("me" === e.ctrl || (a && "me" === a.ctrl && a !== e))) SFX.armorBreak();
    } catch (x) {}
    return r;
  };
})();
