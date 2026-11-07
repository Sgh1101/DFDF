
(() => {
  // Tier perks for gun skins. Looks only: nothing here changes damage, rate
  // of fire or range.
  //   rare+      a flourish when the gun is drawn, and an inspect motion (Y, or
  //              a touch button next to the abilities)
  //   epic+      the shot's effects (muzzle flash, tracer, impact spark, a
  //              shell ember) in the skin's accent colour, and the knife
  //              alternates a slash and a stab
  //   legendary  a burst of the accent colour where a kill lands (everyone in
  //              the room sees it), and the knife spins: a full turn when
  //              drawn, a twirl now and then when idle, a spinning slash
  if (!window.GUN_SKINS || "undefined" == typeof VM || "undefined" == typeof player || "undefined" == typeof NET || "undefined" == typeof WEAPONS) return;
  const GS = window.GUN_SKINS;
  const EN = "en" === window.GAME_LANG,
    L = (ko, en) => (EN ? en : ko),
    $ = (id) => document.getElementById(id);
  const c01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x),
    ezS = "function" == typeof _ezS ? _ezS : (x) => x * x * (3 - 2 * x),
    ezO = "function" == typeof _ezO ? _ezO : (x) => 1 - Math.pow(1 - x, 3);
  const key = () => {
    try {
      return curWeaponKey();
    } catch (e) {
      return "";
    }
  };
  // the tier of the skin in my hands (0 with an ultimate weapon out)
  const tier = () => {
    try {
      return player && player.ultW ? 0 : GS.of(key()).rar | 0;
    } catch (e) {
      return 0;
    }
  };
  const holding = () => !!(window.ARMS && ARMS.hold && ARMS.hold.state && ARMS.hold.state.on);
  const typed = () => {
    try {
      return "knife" === key() && window.KNIVES ? KNIVES.model() : "";
    } catch (e) {
      return "";
    }
  };
  // every knife's inspect (the stock one too) is done by the knife-tricks module, arm and all
  const knifeOwn = () => "knife" === key() && !!window.KNIFE_TRICKS;
  // the Champions Phantom keeps the inspect it has always had (its music runs with it)
  const champions = () => {
    try {
      return !!(window.CHAMPIONS_PHANTOM && CHAMPIONS_PHANTOM.isSkin(GS.of(key()).id));
    } catch (e) {
      return !1;
    }
  };
  const inspD = () => ("knife" === key() && window.KNIVES && KNIVES.inspD ? KNIVES.inspD(typed()) : champions() ? 2.6 : GUN_D);
  // ── how a hand moves a gun to look at it ──
  // keyframes [[t, v], ...]: a smooth curve through them (Catmull-Rom; flat at the first and last)
  const kf = (K, x) => {
    const n = K.length;
    if (x <= K[0][0]) return K[0][1];
    if (x >= K[n - 1][0]) return K[n - 1][1];
    let i = 0;
    while (x > K[i + 1][0]) i++;
    const m = (j) => (0 === j || j === n - 1 ? 0 : (K[j + 1][1] - K[j - 1][1]) / (K[j + 1][0] - K[j - 1][0]));
    const t0 = K[i][0],
      h = K[i + 1][0] - t0,
      u = (x - t0) / h,
      u2 = u * u,
      u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * K[i][1] + (u3 - 2 * u2 + u) * h * m(i) + (-2 * u3 + 3 * u2) * K[i + 1][1] + (u3 - u2) * h * m(i + 1);
  };
  // a small dip first, the gun swung up and over to show its left side (it carries a little past and settles),
  // held, turned the other way and rolled to show the right side and the top, held, and brought back down
  // (a touch past rest as the weight settles). Never quite still while it is held up.
  const GUN_D = 3.3;
  const GUN = {
    x: [[0, 0], [0.55, -0.1], [0.7, -0.104], [1.35, -0.095], [1.95, -0.06], [2.55, -0.065], [3.05, 0.004], [3.3, 0]],
    y: [[0, 0], [0.22, -0.012], [0.6, 0.055], [0.75, 0.05], [1.35, 0.052], [1.95, 0.07], [2.55, 0.066], [2.85, 0.012], [3.05, -0.008], [3.3, 0]],
    z: [[0, 0], [0.6, 0.09], [1.35, 0.085], [1.95, 0.06], [2.55, 0.06], [3.05, 0], [3.3, 0]],
    rx: [[0, 0], [0.22, -0.04], [0.62, 0.22], [1.35, 0.2], [2.0, 0.12], [2.6, 0.14], [3.0, -0.015], [3.3, 0]],
    ry: [[0, 0], [0.22, -0.05], [0.62, 0.85], [0.78, 0.8], [1.35, 0.74], [2.0, -0.5], [2.15, -0.46], [2.6, -0.42], [3.0, 0.03], [3.3, 0]],
    rz: [[0, 0], [0.62, -0.3], [1.35, -0.26], [2.0, 0.55], [2.15, 0.5], [2.6, 0.48], [3.0, -0.03], [3.3, 0]],
  };
  function gunInspect(a, s) {
    const P = a.position,
      R = a.rotation,
      held = c01(s / 0.6) * c01((GUN_D - 0.3 - s) / 0.5);
    P.x += kf(GUN.x, s) + held * 0.0025 * Math.sin(s * 3.1);
    P.y += kf(GUN.y, s) + held * 0.0035 * Math.sin(s * 2.3 + 1);
    P.z += kf(GUN.z, s);
    R.x += kf(GUN.rx, s) + held * 0.012 * Math.sin(s * 2.7 + 2);
    R.y += kf(GUN.ry, s) + held * 0.01 * Math.sin(s * 1.6 + 3);
    R.z += kf(GUN.rz, s) + held * 0.015 * Math.sin(s * 1.9 + 0.5);
  }
  const me = () => {
    try {
      return "function" == typeof myActor ? myActor() : null;
    } catch (e) {
      return null;
    }
  };
  const hk = (a) => ("client" === NET.mode && "me" !== a.ctrl && a.netWeapon ? a.netWeapon : actorWeaponKey(a));
  const skinHeld = (a) => {
    try {
      return a ? GS.skinOf(a, hk(a)) : null;
    } catch (e) {
      return null;
    }
  };
  // the accent colour of an epic or legendary skin in an actor's hands, else 0
  const accentOf = (a) => {
    const s = skinHeld(a);
    return s && s.rar >= 3 && s.glow ? s.glow : 0;
  };

  // ── 1. motions on the gun in my hands ──
  const M = { draw: { t: -1, D: 0.45, spin: !1 }, insp: { t: -1 }, knife: { t: -1, D: 0.26, kind: "" }, twirl: { t: -1 }, idleT: 0, nextTwirl: 2.5, alt: 0, cd: 0 };
  const cancelAll = () => {
    M.draw.t = M.insp.t = M.knife.t = M.twirl.t = -1;
  };
  function onDraw() {
    cancelAll();
    M.idleT = 0;
    M.nextTwirl = 2.5;
    const t = tier(),
      m = typed();
    if (holding()) return;
    if (m) return void (M.draw = { t: 0, D: KNIVES.drawD(m), spin: !1, typed: !0 });
    const spin = t >= 4 && "knife" === key();
    M.draw = { t: 0, D: t >= 2 ? (spin ? 0.5 : 0.45) : 0.32, spin, plain: t < 2 };
  }
  const _uv = updateViewmodel;
  updateViewmodel = function () {
    const before = VM.current;
    const r = _uv.apply(this, arguments);
    try {
      VM.current && VM.current !== before && onDraw();
    } catch (e) {}
    return r;
  };
  function motion(dt) {
    const a = VM.current;
    if (!player.alive || !VM.root.visible || !a || !a.visible || holding() || player.ultW) return void cancelAll();
    const t = tier(),
      own = !!typed();
    // drawn: raised into place; a quick turn of the wrist on a rare one (the legendary knife makes a full turn)
    if (M.draw.t >= 0) {
      M.draw.t += dt;
      const k = c01(M.draw.t / M.draw.D);
      if (k >= 1) M.draw.t = -1;
      else if (own || M.draw.typed) {
      } else if (M.draw.plain) {
        const e = 1 - ezO(k);
        a.position.y -= 0.2 * e;
        a.position.x += 0.05 * e;
        a.rotation.x -= 0.38 * e;
        a.rotation.z -= 0.16 * e;
        a.position.y += 0.012 * Math.sin(k * Math.PI) * (1 - e);
      } else if (M.draw.spin) {
        window.KNIFE_PIVOT ? KNIFE_PIVOT.spin(a, "x", 2 * Math.PI * ezO(k)) : (a.rotation.x += 2 * Math.PI * ezO(k));
        a.position.y += 0.02 * Math.sin(k * Math.PI);
      } else {
        const e = 1 - ezO(k);
        a.rotation.z -= 0.9 * e;
        a.rotation.y += 0.5 * e;
        a.position.x += 0.08 * e;
        a.position.y -= 0.05 * Math.sin(k * Math.PI);
      }
    }
    // inspect: raise, look along both sides, roll, back
    if (M.insp.t >= 0) {
      if (player.ads || player.reloading > 0 || keys.fire) M.insp.t = -1;
      else {
        M.insp.t += dt;
        const s = M.insp.t;
        if (s >= inspD()) M.insp.t = -1;
        else if (own || knifeOwn()) {
        } else if (!champions()) gunInspect(a, s);
        else {
          const up = ezS(c01(s / 0.4)) * (1 - ezS(c01((s - 2.1) / 0.5)));
          a.position.x -= 0.1 * up;
          a.position.y += 0.06 * up;
          a.position.z += 0.1 * up;
          a.rotation.y += up * (1.1 - 2 * ezS(c01((s - 0.4) / 1)));
          a.rotation.z += up * 0.9 * Math.sin(c01((s - 1.4) / 0.7) * Math.PI);
          a.rotation.x += 0.25 * up;
        }
      }
    }
    // the knife: slash, stab, or a spinning slash (the spins turn the knife in the hand, not the arm)
    if (M.knife.t >= 0) {
      M.knife.t += dt;
      const k = c01(M.knife.t / M.knife.D);
      if (k >= 1) M.knife.t = -1;
      else if (own) {
      } else if (window.KNIVES && KNIVES.cut) {
        // the same cuts as the other knives (wind-up, stroke, follow-through); the legendary one spins in the hand
        // as it slashes, flicked round fast and caught
        if ("spin" === M.knife.kind) {
          KNIVES.cut("slash", k, a);
          const f = 1 - Math.pow(1 - c01((k - 0.12) / 0.6), 3);
          window.KNIFE_PIVOT ? KNIFE_PIVOT.spin(a, "y", 2 * Math.PI * f) : (a.rotation.y += 2 * Math.PI * f);
        } else KNIVES.cut(M.knife.kind, k, a);
      }
    }
    // a guest's knife: the host swings it for real, but the hand here moves as soon as the button goes down
    if ("client" === NET.mode && "knife" === key() && t >= 3) {
      M.cd -= dt;
      if (keys.fire && M.cd <= 0 && !(player.reloading > 0) && "buy" !== world.phase && "end" !== world.phase) {
        M.cd = 60 / (WEAPONS.knife.rpm || 140);
        viewmodelFireKick();
      }
    }
    // the legendary knife, held still: a twirl now and then
    if (t >= 4 && "knife" === key() && !own) {
      const still = Math.hypot(player.vel.x, player.vel.z) < 0.5 && !keys.fire && M.knife.t < 0 && M.draw.t < 0 && M.insp.t < 0;
      if (!still) M.idleT = 0;
      else if (((M.idleT += dt), M.twirl.t < 0 && M.idleT > M.nextTwirl)) {
        M.twirl.t = 0;
        M.idleT = 0;
        M.nextTwirl = 7 + 4 * Math.random();
      }
      if (M.twirl.t >= 0) {
        M.twirl.t += dt;
        const k = c01(M.twirl.t / 0.95);
        if (k >= 1) M.twirl.t = -1;
        else {
          // the wrist cocks, flicks the knife round the fingers and gives a little on the catch
          const tw = window.KNIFE_TRICKS && KNIFE_TRICKS.sample("idle", "", 0.95 * k);
          if (tw) {
            window.KNIFE_PIVOT ? KNIFE_PIVOT.spin(a, "x", tw.T.rx) : (a.rotation.x += tw.T.rx);
            a.rotation.x += tw.A.pitch;
            a.position.y += tw.A.y;
          } else {
            window.KNIFE_PIVOT ? KNIFE_PIVOT.spin(a, "x", 2 * Math.PI * ezS(k)) : (a.rotation.x += 2 * Math.PI * ezS(k));
            a.position.y += 0.03 * Math.sin(k * Math.PI);
          }
        }
      }
    } else M.twirl.t = -1;
  }
  const _tick = tickViewmodel;
  tickViewmodel = function (dt) {
    const r = _tick.apply(this, arguments);
    try {
      motion(dt || 0.016);
    } catch (e) {}
    return r;
  };
  // every shot of mine: the knife swings by tier, the inspect stops, an epic gun throws an ember with its shell
  const _vfk = viewmodelFireKick;
  viewmodelFireKick = function () {
    const r = _vfk.apply(this, arguments);
    try {
      M.insp.t = -1;
      const t = tier();
      const m = typed();
      if ("knife" === key()) {
        if (m) {
          M.twirl.t = -1;
          M.idleT = 0;
          const at = KNIVES.attack(m, ++M.alt);
          M.knife = { t: 0, D: at[1], kind: at[0] };
          swish();
          ("chop" === at[0] || "cleave" === at[0] || "sweep" === at[0] || "jab" === at[0]) && setTimeout(swish, 90);
        } else if (t >= 3) {
          M.twirl.t = -1;
          M.idleT = 0;
          if (t >= 4) {
            M.knife = { t: 0, D: 0.34, kind: "spin" };
            swish();
            setTimeout(swish, 110);
          } else {
            M.alt ^= 1;
            M.knife = M.alt ? { t: 0, D: 0.26, kind: "slash" } : { t: 0, D: 0.26, kind: "stab" };
            swish();
          }
        } else {
          // the plain knife: a real stab (it used to get only the guns' recoil, which pulled it back toward you)
          M.twirl.t = -1;
          M.idleT = 0;
          M.knife = { t: 0, D: 0.3, kind: "stab" };
          swish();
        }
        // a knife's own cut moves it: the guns' recoil (back toward you, tipped up) is not added on top
        if (M.knife.t === 0 && window.KNIVES && KNIVES.cut) VM.kick = VM.kickRot = 0;
      } else if (t >= 3) ember(accentOf(me()) || GS.of(key()).glow);
    } catch (e) {}
    return r;
  };
  // inspect: Y, or the touch button
  function inspect() {
    if (!player.alive || holding() || player.ultW || ["menu", "over", "end"].includes(world.phase)) return !1;
    for (const id of ["shop", "pause", "armory"]) if ($(id) && !$(id).hidden) return !1;
    if (tier() < 2 && !typed()) return !1;
    if (M.insp.t >= 0) {
      M.insp.t = -1;
      return !0;
    }
    cancelAll();
    M.insp.t = 0;
    return !0;
  }
  addEventListener("keydown", (e) => {
    if (!KEYMAP.is(e, "inspect") || e.repeat) return;
    const t = e.target;
    if (t?.closest?.('input,textarea,[contenteditable="true"]')) return;
    for (const id of ["shop", "pause", "armory"]) {
      const s = $(id);
      if (s && !s.hidden) return;
    }
    inspect();
  });
  const css = document.createElement("style");
  css.textContent = `#tb-inspect{border-color:rgba(56,189,248,.7)!important;background:rgba(56,189,248,.16)!important}
#tb-inspect[hidden]{display:none!important}
#tb-inspect .in-ic{position:absolute;inset:0;display:grid;place-items:center;font-style:normal;font-size:calc(20px*var(--mbs,1));line-height:1;pointer-events:none}`;
  document.head.appendChild(css);
  const tb = document.createElement("button");
  tb.className = "tab tab-inspect";
  tb.id = "tb-inspect";
  tb.hidden = !0;
  tb.setAttribute("aria-label", L("점검", "Inspect"));
  tb.innerHTML = `<em class="in-ic">✦</em><i>Y</i>`;
  const tab = $("tabil");
  tab && tab.appendChild(tb);
  tb.addEventListener("touchstart", (e) => (e.preventDefault(), inspect()), { passive: !1 });
  tb.addEventListener("click", inspect);
  let placedQ = null,
    placedKey = "",
    placedAt = -1e9;
  function placeButton() {
    const live = !!(world.actors && world.actors.length > 0 && "menu" !== world.phase && "over" !== world.phase);
    tb.hidden = !(live && player.alive && (tier() >= 2 || typed()) && !holding());
    if (tb.hidden) return;
    // just left of the grenade button when it is out, else left of Q
    const nade = $("tb-nade"),
      q = nade && !nade.hidden ? nade : document.querySelector('#tabil .tab[data-a="0"]');
    // measuring forces a layout: done only when something that moves the anchor changed (a resize or turn, the touch layout
    // or its edit, the control size, the grenade button coming or going), not every frame
    const key = [innerWidth, innerHeight, document.body.className, document.documentElement.style.cssText, q && q.style.cssText, q && q.id, !!(nade && !nade.hidden), nade && nade.style.cssText, window.TOUCHLAY ? TOUCHLAY.layout().t : 0].join("|");
    const now = performance.now();
    (q !== placedQ || key !== placedKey) && (placedAt = now);
    // for 0.7 s after a change it is measured every frame (the anchor may still be sliding to its new place)
    if (now - placedAt >= 700 && tb.style.getPropertyValue("left")) return;
    const r = q && q.getBoundingClientRect();
    q && ((placedQ = q), (placedKey = key)); // (also when Q is not laid out, as on a desktop: not measured again until something changes)
    if (!r || !(r.width > 0)) return;
    const set = (k, v) => tb.style.setProperty(k, v, "important");
    set("position", "fixed");
    set("width", r.width + "px");
    set("height", r.height + "px");
    set("left", Math.max(4, r.left - r.width - Math.max(6, 0.14 * r.width)) + "px");
    set("top", r.top + "px");
    set("right", "auto");
    set("bottom", "auto");
  }
  if ("function" == typeof updateHUD) {
    const _uh = updateHUD;
    updateHUD = function () {
      const r = _uh.apply(this, arguments);
      try {
        placeButton();
      } catch (e) {}
      return r;
    };
  }

  // ── 2. a swish for the knife ──
  let actx = null,
    aout = null;
  const audio = () => {
    if ("object" == typeof SETTINGS && SETTINGS && !SETTINGS.sfx) return null;
    if (actx) return "suspended" === actx.state && actx.resume(), actx;
    try {
      const A = window.AudioContext || window.webkitAudioContext;
      if (!A) return null;
      actx = GAME_AUDIO.context();
      aout = actx.createGain();
      aout.gain.value = 0.2;
      aout.connect(GAME_AUDIO.output);
    } catch (e) {
      actx = null;
    }
    return actx;
  };
  function swish() {
    const c = audio();
    if (!c) return;
    try {
      const n = Math.floor(0.11 * c.sampleRate),
        b = c.createBuffer(1, n, c.sampleRate),
        d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (2 * Math.random() - 1) * Math.sin((i / n) * Math.PI);
      const s = c.createBufferSource();
      s.buffer = b;
      const f = c.createBiquadFilter();
      f.type = "bandpass";
      f.Q.value = 1.2;
      f.frequency.setValueAtTime(900, c.currentTime);
      f.frequency.exponentialRampToValueAtTime(2600, c.currentTime + 0.09);
      const g = c.createGain();
      g.gain.value = 0.9;
      s.connect(f);
      f.connect(g);
      g.connect(aout);
      s.start();
      const o = c.createOscillator(),
        og = c.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(760, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(380, c.currentTime + 0.08);
      og.gain.setValueAtTime(0.12, c.currentTime);
      og.gain.exponentialRampToValueAtTime(1e-4, c.currentTime + 0.09);
      o.connect(og);
      og.connect(aout);
      o.start();
      o.stop(c.currentTime + 0.1);
    } catch (e) {}
  }

  // ── 3. effects in the accent colour (epic and legendary) ──
  // While a shot's effects are being made for an actor with such a skin, the
  // accent is set here and the effect makers below read it.
  const FXS = { cur: 0 };
  const withAccent = (col, fn) => {
    const was = FXS.cur;
    FXS.cur = col || 0;
    try {
      return fn();
    } finally {
      FXS.cur = was;
    }
  };
  const WHITE = new T.Color(0xffffff);
  const _af = actorFire;
  actorFire = function (e) {
    const col = e ? accentOf(e) : 0;
    const args = arguments,
      self = this;
    return col ? withAccent(col, () => _af.apply(self, args)) : _af.apply(this, arguments);
  };
  // a guest's own predicted shot: the tracer and the flash come straight from the prediction
  const mine = (fn, self, args) => {
    if (FXS.cur || "client" !== NET.mode) return fn.apply(self, args);
    const col = accentOf(me());
    return col ? withAccent(col, () => fn.apply(self, args)) : fn.apply(self, args);
  };
  const _at = addTracer;
  addTracer = function () {
    return mine(_at, this, arguments);
  };
  const _mf = muzzleFlash;
  muzzleFlash = function () {
    return mine(_mf, this, arguments);
  };
  // a shot seen from the host's effect list: the actor nearest the muzzle is the shooter
  if ("function" == typeof playRemoteFX && "object" == typeof FX && "object" == typeof Q && Q.unpos) {
    const shotAccent = (x, z) => {
      let best = null,
        bd = 0.9;
      for (const a of world.actors || []) {
        if (!a.alive || "me" === a.ctrl) continue;
        const d = Math.hypot(a.pos.x - x, a.pos.z - z);
        d < bd && ((bd = d), (best = a));
      }
      return best ? accentOf(best) : 0;
    };
    const _prf = playRemoteFX;
    playRemoteFX = function (list) {
      if (!Array.isArray(list) || !list.length) return _prf.apply(this, arguments);
      const rest = [],
        self = this;
      for (const f of list) {
        let col = 0;
        try {
          if (f[0] === FX.SHOT) {
            // the host names the shooter; an old one does not, and the actor nearest the muzzle is guessed
            const who = null != f[5] ? actorById(f[5]) : null;
            col = null != f[5] ? (who && who.alive && "me" !== who.ctrl ? accentOf(who) : 0) : shotAccent(Q.unpos(f[1]), Q.unpos(f[3]));
          }
        } catch (e) {}
        col ? withAccent(col, () => _prf.call(self, [f])) : rest.push(f);
      }
      return rest.length ? _prf.call(this, rest) : undefined;
    };
  }
  // the makers: a tracer line, the muzzle flash planes, the flash light, the impact spark
  const _afx = addFx;
  addFx = function (m) {
    try {
      if (FXS.cur && m) {
        if (m.isLine && m.material && m.material.color) m.material.color.setHex(FXS.cur);
        else if (m.isGroup && m.children.length && "undefined" != typeof FXG && m.children[0].geometry === FXG.flash && m.children[0].material) m.children[0].material.color.setHex(FXS.cur).lerp(WHITE, 0.3);
      }
    } catch (e) {}
    return _afx.apply(this, arguments);
  };
  const _ff = fxFlash;
  fxFlash = function (col) {
    if (FXS.cur && (16766602 === col || 16762992 === col)) arguments[0] = FXS.cur;
    return _ff.apply(this, arguments);
  };
  const _is = impactSpark;
  impactSpark = function (x, y, z, col) {
    if (FXS.cur) arguments[3] = FXS.cur;
    return _is.apply(this, arguments);
  };
  // an ember rides along with the shell
  function ember(col, at) {
    if (!col || "function" != typeof glowDot) return;
    try {
      let p = at;
      if (!p) {
        const f = new T.Vector3(),
          u = new T.Vector3(),
          r = new T.Vector3();
        camera.getWorldDirection(f);
        u.copy(camera.up).applyQuaternion(camera.quaternion);
        r.crossVectors(f, u).normalize();
        const ads = !!player.ads;
        p = camera.position
          .clone()
          .addScaledVector(r, ads ? 0.07 : 0.2)
          .addScaledVector(u, ads ? -0.07 : -0.13)
          .addScaledVector(f, ads ? 0.42 : 0.5);
      }
      const d = glowDot(col, 0.07, 2.2),
        v = new T.Vector3(0.6 * (Math.random() - 0.5), 0.9 + 0.5 * Math.random(), 0.6 * (Math.random() - 0.5));
      d.position.copy(p);
      addFx(d, 0.35, (o, t, dt) => {
        const s = dt || 0.016;
        o.position.addScaledVector(v, s);
        v.y -= 4 * s;
        o.material.opacity = 1 - t;
        o.scale.setScalar(0.07 * (1 - 0.6 * t));
      });
    } catch (e) {}
  }
  if ("function" == typeof ejectShell) {
    const _es = ejectShell;
    ejectShell = function (o) {
      FXS.cur && o && ember(FXS.cur, o.clone());
      return _es.apply(this, arguments);
    };
  }

  // ── 4. a legendary kill: a burst where it lands, for everyone in the room ──
  function burst(x, y, z, col) {
    if (!col || "function" != typeof glowDot) return 0;
    const n = Math.max(8, Math.round(18 * (("object" == typeof GFX && GFX.fx) || 1)));
    for (let i = 0; i < n; i++) {
      const d = glowDot(col, 0.16, 2),
        th = Math.random() * 2 * Math.PI,
        ph = (Math.random() - 0.5) * Math.PI,
        sp = 2.5 + 3 * Math.random(),
        v = new T.Vector3(Math.cos(th) * Math.cos(ph) * sp, Math.sin(ph) * sp + 1.5, Math.sin(th) * Math.cos(ph) * sp);
      d.position.set(x, y, z);
      addFx(d, 0.55 + 0.3 * Math.random(), (o, t, dt) => {
        const s = dt || 0.016;
        o.position.addScaledVector(v, s);
        v.y -= 7 * s;
        o.material.opacity = 1 - t;
        o.scale.setScalar(0.16 * (1 - 0.5 * t));
      });
    }
    try {
      const ring = new T.Mesh(new T.RingGeometry(0.75, 0.95, 40), new T.MeshBasicMaterial({ color: col, transparent: !0, opacity: 0.9, side: T.DoubleSide, depthWrite: !1, blending: T.AdditiveBlending }));
      ring.position.set(x, y, z);
      ring.rotation.x = -Math.PI / 2;
      addFx(ring, 0.5, (o, t) => {
        o.scale.setScalar(0.3 + 2.2 * ezO(t));
        o.material.opacity = 0.9 * (1 - t);
      });
      "function" == typeof fxFlash && fxFlash(col, 1.3, 11, x, y, z, 0.28, 2);
    } catch (e) {}
    return n;
  }
  const _ka = killActor;
  killActor = function (e, t) {
    const r = _ka.apply(this, arguments);
    try {
      if ("client" !== NET.mode && e && t && t !== e) {
        const s = skinHeld(t);
        if (s && s.rar >= 4 && s.glow) {
          const x = e.pos.x,
            y = (e.y || 0) + 1,
            z = e.pos.z;
          burst(x, y, z, s.glow);
          "host" === NET.mode && sendEventAll({ t: "skx", k: 1, x: Math.round(100 * x), y: Math.round(100 * y), z: Math.round(100 * z), i: s.i, a: t.id });
        }
      }
    } catch (x) {}
    return r;
  };
  const _oe = NET.onEvent;
  NET.onEvent = function (e) {
    if (e && "skx" === e.t) {
      try {
        // online, only for a killer the server vouches wears this skin
        const s = GS.list[e.i | 0];
        s && s.glow && (!GS.vouch || GS.vouch(actorById(e.a), null, e.i | 0)) && burst(e.x / 100, e.y / 100, e.z / 100, s.glow);
      } catch (x) {}
      return;
    }
    return _oe.apply(this, arguments);
  };

  window.SKIN_PERKS = { tier, inspect, state: M, burst, accent: accentOf, swish, fx: FXS };
})();
