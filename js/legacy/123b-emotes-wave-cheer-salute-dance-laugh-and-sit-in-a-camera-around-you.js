(() => {
  // Emotes. T (rebindable: Settings → keys) plays the emote you chose; hold it, or press it twice, for a wheel of the six (1-6 or the
  // mouse pick one, and a touch button does the same). While you emote the camera goes round to the front of your own body, held
  // off walls by the same wall ray the shots use, and the body plays the keyframes of js/emotes.js on its parts. Moving, jumping,
  // firing, aiming, an ability, a weapon switch, reloading or taking damage ends it; so does dying, planting or defusing, and it
  // cannot start in the shop, in a menu or while one of those is going on.
  // Network, the way the chat does it (js/legacy/115): a guest sends {t:"emote", e: 0..5} (or e: -1 to stop) on the reliable link;
  // the host checks it (a known emote, a live body that is not planting, 2 starts then one per 2 s per player) and relays
  // {t:"emote", id, e} to everyone else; the host's own emote and a bot's go out the same way. Every screen plays it on that
  // body's model. An older game ignores the message. The owner can switch it all off (game.emotes). After a kill a bot sometimes
  // answers with one (a small chance, and only when no enemy is in sight); the bot stands still for it.
  if ("undefined" == typeof NET || "undefined" == typeof world || "undefined" == typeof T || !window.EMOTES || "function" != typeof NET.onAction || "undefined" == typeof KEYMAP) return;
  const EM = window.EMOTES,
    EN = "en" === window.GAME_LANG,
    L = (ko, en) => (EN ? en : ko),
    $ = (id) => document.getElementById(id),
    NOW = () => performance.now();
  const on = () => {
    const c = window.SERVER_CFG;
    return !(c && c.game && !1 === c.game.emotes);
  };
  const S = { me: null, k: 0, cd: 0, chosen: 0, wheel: null, sel: -1, last: 0, tap: 0, down: 0, hold: 0, hp: 0, stats: { played: 0, cancelled: 0, bots: 0, dropped: 0, relayed: 0 }, why: "" };
  try {
    const v = parseInt(localStorage.getItem("dfdf_emote"), 10);
    EM.valid(v) && (S.chosen = v);
  } catch (e) {}
  const BUCKET = new Map(),
    LOCAL = "\0local";
  const me = () => ("function" == typeof myActor && myActor()) || null,
    byId = (id) => (world.actors || []).find((a) => a.id === id) || null,
    inMatch = () => !!(world.actors && world.actors.length && "menu" !== world.phase && !world.over),
    modal = () => ["pause", "admin", "lobby"].some((id) => $(id) && !$(id).hidden) || !!($("shop") && !$("shop").hidden),
    key = (a) => ("client" === NET.mode ? NET.peer && NET.peer.id : NET.id) || "me";

  // ── playing one on a body ──
  // the axes the walking animation writes every frame (they blend from what it just wrote); the others start from what they were
  const AF = { hips: "yz", chest: "xyz", neck: "x", armL: "x", foreL: "x", armR: "x", foreR: "x", legL: "xz", shinL: "x", legR: "xz", shinR: "x" };
  const parts = (m) => ({ hips: m.hips, chest: m.chest, neck: m.neck, armL: m.armL.arm, foreL: m.armL.fore, armR: m.armR.arm, foreR: m.armR.fore, legL: m.legL.leg, shinL: m.legL.shin, legR: m.legR.leg, shinR: m.legR.shin });
  const rig = (m) => !!(m && m.hips && m.chest && m.neck && m.armL && m.armR && m.legL && m.legR);
  function start(a, i) {
    if (!a || !EM.valid(i) || !rig(a.model)) return null;
    a._emo && finish(a);
    const em = { i, t0: NOW(), snap: null, cancelT: 0, hid: !1 };
    a._emo = em;
    return em;
  }
  // the parts go back to what they were, and the gun comes back
  function finish(a) {
    const em = a._emo;
    a._emo = null;
    if (!em) return;
    try {
      const m = a.model;
      if (em.snap && rig(m)) {
        const P = parts(m);
        for (const k in P) ["x", "y", "z"].forEach((ax, j) => AF[k].includes(ax) || (P[k].rotation[ax] = em.snap[k][j]));
      }
      em.hid && m.gun && a.alive && !a.ultW && !a._kneel && (m.gun.visible = !0);
    } catch (e) {}
    "me" === a.ctrl && S.me === em && (S.me = null);
  }
  // asks an emote to end: it eases out over a quarter of a second
  function stop(a) {
    const em = a && a._emo;
    em && !em.cancelT && (em.cancelT = NOW());
  }
  function frame(a, em) {
    if (!a.alive) return finish(a);
    const m = a.model, t = (NOW() - em.t0) / 1e3, fade = em.cancelT ? Math.max(0, 1 - (NOW() - em.cancelT) / 250) : 1;
    if (t > EM.LIST[em.i].dur || fade <= 0) return finish(a);
    // another body that walks off stops it (its own player ends it on this machine and sends the stop; this is for the ones that never come)
    if ("me" !== a.ctrl) {
      const d = em.lx === undefined ? 0 : Math.hypot(a.pos.x - em.lx, a.pos.z - em.lz);
      em.lx = a.pos.x; em.lz = a.pos.z;
      if (d > 0.12) return finish(a);
    }
    const p = EM.pose(em.i, t);
    if (!p) return finish(a);
    const w = EM.weight(em.i, t) * fade, P = parts(m);
    if (!em.snap) {
      em.snap = {};
      for (const k in P) em.snap[k] = [P[k].rotation.x, P[k].rotation.y, P[k].rotation.z];
    }
    for (const k in P) {
      const v = p[k];
      if (!v) continue;
      const r = P[k].rotation;
      ["x", "y", "z"].forEach((ax, j) => {
        const base = AF[k].includes(ax) ? r[ax] : em.snap[k][j];
        r[ax] = base + (v[j] - base) * w;
      });
    }
    if (void 0 !== p.hy) m.hips.position.y += (p.hy - m.hips.position.y) * w;
    if (m.gun && w > 0.05) { m.gun.visible = !1; em.hid = !0; }
  }
  if ("function" == typeof animateFighter) {
    const _af = animateFighter;
    animateFighter = function (e) {
      const r = _af.apply(this, arguments);
      try {
        e && e._emo && frame(e, e._emo);
      } catch (x) {}
      return r;
    };
  }
  // your own body is not drawn in your own view; while you emote it is (the camera is in front of it)
  const _sam = syncActorModel;
  syncActorModel = function (e) {
    const r = _sam.apply(this, arguments);
    try {
      if (e && "me" === e.ctrl && (S.k > 0.01 || e._emo) && e.alive && e.group && e.model) {
        e.group.visible = !0;
        "function" == typeof animateFighter && animateFighter(e, world._adt || 0.016);
      }
    } catch (x) {}
    return r;
  };

  // ── who may, and the wire ──
  const busy = (a) => !a || !a.alive || a.planting > 0 || a.defusing > 0 || a.ultW || a._kneel;
  const walking = () => !!(keys.w || keys.a || keys.s || keys.d || (touch && touch.on && Math.hypot(touch.move.x, touch.move.y) > 0.2));
  function canStart(a) {
    if (!on() || !inMatch() || modal() || busy(a)) return !1;
    if (!(locked || IS_TOUCH)) return !1;
    if (walking() || keys.space || keys.fire || keys.ads || a.ads || !a.onGround) return !1;
    if (a.spectateT > 0 || (typeof FLY !== "undefined" && FLY.on)) return !1;
    return !0;
  }
  // the host: what a guest asks for, checked
  function hostEmote(peer, msg) {
    if (!on()) return "off";
    if (!msg || "object" != typeof msg || !Number.isInteger(msg.e)) return "bad";
    if (null === peer) return -1 === msg.e ? (cancel("host"), "ok") : play(msg.e) ? "ok" : "no";
    const a = (world.actors || []).find((x) => x.ctrl === peer);
    if (!a || !inMatch()) return "nobody";
    if (-1 === msg.e) {
      if (a._emo) {
        stop(a);
        relay(peer, a, -1);
      }
      return "ok";
    }
    if (!EM.valid(msg.e)) return "bad";
    if (busy(a)) return "busy";
    if (!EM.take(BUCKET, peer)) return S.stats.dropped++, "rate";
    start(a, msg.e);
    relay(peer, a, msg.e);
    return "ok";
  }
  function relay(from, a, e) {
    S.stats.relayed++;
    const out = { t: "emote", id: a.id, e };
    if ("host" === NET.mode)
      for (const [p, c] of NET.conns) {
        if (c.quiet || p === from || !c.event || !c.event.open) continue;
        sendEventTo(p, out);
      }
  }
  // the host's own emote, and the bots': nothing to check but the rate (the host cannot be rate limited by itself)
  function recv(e) {
    if (!on() || !e || ("string" != typeof e.id && "number" != typeof e.id) || !Number.isInteger(e.e) || e.e < -1 || e.e >= EM.LIST.length) return;
    const a = byId(e.id);
    if (!a || "me" === a.ctrl) return;
    if (-1 === e.e) return void stop(a);
    a.alive && start(a, e.e);
  }
  const _oa = NET.onAction;
  NET.onAction = function (peer, msg) {
    if (msg && "object" == typeof msg && "emote" === msg.t) {
      "host" === NET.mode && hostEmote(peer, msg);
      return;
    }
    return _oa.apply(this, arguments);
  };
  const _oe = NET.onEvent;
  NET.onEvent = function (e) {
    if (e && "object" == typeof e && "emote" === e.t) return void recv(e);
    return _oe && _oe.apply(this, arguments);
  };
  const _pg = NET.onPeerGone;
  NET.onPeerGone = function (peer) {
    BUCKET.delete(peer);
    return _pg && _pg.apply(this, arguments);
  };

  // ── your own ──
  function play(i) {
    const a = me();
    if (!a || !EM.valid(i)) return !1;
    if (NOW() < S.cd) return !1;
    if (!canStart(a)) return !1;
    if (!EM.take(BUCKET, LOCAL)) return !1;
    S.chosen = i;
    try {
      localStorage.setItem("dfdf_emote", String(i));
    } catch (e) {}
    const em = start(a, i);
    if (!em) return !1;
    em.reload0 = a.reloading > 0;
    S.me = em;
    S.cd = NOW() + 250;
    S.hp = a.hp + (a.armor || 0);
    S.stats.played++;
    "client" === NET.mode ? sendAction({ t: "emote", e: i }) : relay(null, a, i);
    wheelClose();
    paintBtn();
    return !0;
  }
  function cancel(why) {
    const a = me(),
      em = S.me;
    if (!em) return;
    S.me = null;
    S.why = why || "";
    S.stats.cancelled++;
    a && stop(a);
    "client" === NET.mode ? sendAction({ t: "emote", e: -1 }) : a && relay(null, a, -1);
  }
  // the things that end it, polled once a frame (and the keys and calls below, for the ones that do not leave a trace)
  function check(a) {
    const em = S.me;
    if (!em) return;
    if (!on() || !inMatch() || modal() || !a || !a.alive) return cancel("state");
    if (a.planting > 0 || a.defusing > 0) return cancel("plant");
    if (a.ultW || a._kneel) return cancel("ability");
    if (walking()) return cancel("move");
    if (keys.space || !a.onGround) return cancel("jump");
    if (keys.fire) return cancel("fire");
    if (keys.ads || a.ads) return cancel("aim");
    em.reload0 && !(a.reloading > 0) && (em.reload0 = !1);
    if (keys.r || (a.reloading > 0 && !em.reload0)) return cancel("reload");
    const hp = a.hp + (a.armor || 0);
    if (hp < S.hp - 0.01) return cancel("damage");
    S.hp = hp;
    // it ran its course
    (NOW() - em.t0) / 1e3 > EM.LIST[em.i].dur && (S.me = null);
  }
  const CANCEL_KEYS = ["forward", "back", "left", "right", "jump", "reload", "slot1", "slot2", "slot3", "grenade", "ability1", "ability2", "ability3", "ability4", "use", "plant", "inspect", "shop"];
  const WHY = { forward: "move", back: "move", left: "move", right: "move", jump: "jump", reload: "reload", slot1: "switch", slot2: "switch", slot3: "switch", grenade: "ability", ability1: "ability", ability2: "ability", ability3: "ability", ability4: "ability", use: "plant", plant: "plant", inspect: "switch", shop: "state" };
  // the calls that end it (a touch button reaches them without a key)
  const wrapCancel = (get, set, why) => {
    const g = get();
    "function" == typeof g &&
      set(function () {
        S.me && cancel(why);
        return g.apply(this, arguments);
      });
  };
  try {
    wrapCancel(() => useAbility, (f) => (useAbility = f), "ability");
    wrapCancel(() => switchSlot, (f) => (switchSlot = f), "switch");
    wrapCancel(() => startReload, (f) => (startReload = f), "reload");
    wrapCancel(() => jump, (f) => (jump = f), "jump");
  } catch (e) {}

  // ── the camera: round to the front of your own body, kept off the walls ──
  const ease = (x) => x * x * (3 - 2 * x),
    cp = new T.Vector3(),
    ct = new T.Vector3(),
    cd = new T.Vector3(),
    cf = new T.Vector3(),
    q0 = new T.Quaternion(),
    q1 = new T.Quaternion();
  const BODY = () => ("number" == typeof BODY_K ? BODY_K : 1);
  function thirdPerson(a, dt) {
    const want = S.me && !S.me.cancelT ? 1 : 0;
    S.k = Math.max(0, Math.min(1, S.k + (want ? dt / 0.35 : -dt / 0.3)));
    if (S.k <= 0) return void (S.dist = 0.4);
    const K = ease(S.k), h = BODY(), fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw);
    ct.set(a.pos.x, a.y + 1.3 * h, a.pos.z);
    const lift = 0.3 + 0.6 * Math.max(-0.3, Math.min(0.9, a.pitch || 0));
    cd.set(fx * 2.7, lift, fz * 2.7);
    let dist = cd.length();
    cd.normalize();
    // the wall ray from the body toward where the camera would be; the camera stops short of what it hits
    if ("function" == typeof window.WALL_T) {
      const t = window.WALL_T(ct.x, ct.y, ct.z, cd.x, cd.y, cd.z, dist + 0.35);
      t < dist + 0.35 && (dist = Math.max(0.45, t - 0.35));
    }
    S.dist = void 0 === S.dist ? 0.4 : S.dist;
    S.dist = dist < S.dist ? dist : S.dist + (dist - S.dist) * Math.min(1, 5 * dt);
    cp.copy(ct).addScaledVector(cd, S.dist);
    q0.copy(camera.quaternion);
    cf.copy(camera.position);
    camera.position.lerpVectors(cf, cp, K);
    camera.lookAt(ct);
    q1.copy(camera.quaternion);
    camera.quaternion.copy(q0).slerp(q1, K);
    S.camPos = camera.position.toArray();
    S.camTarget = ct.toArray();
  }
  const _fc = followCamera;
  followCamera = function (e, t) {
    const r = _fc.apply(this, arguments);
    try {
      const a = me();
      a && e === a && (S.k > 0 || S.me) && thirdPerson(a, t);
    } catch (x) {}
    return r;
  };
  // no hands and no gun in front of the camera while the body is in view
  if ("function" == typeof tickViewmodel) {
    const _tv = tickViewmodel;
    tickViewmodel = function () {
      const r = _tv.apply(this, arguments);
      try {
        S.k > 0.05 && VM && VM.root && (VM.root.visible = !1);
      } catch (x) {}
      return r;
    };
  }

  // ── bots answer a kill, now and then ──
  const BOT = { p: 0.1, dur: [0, 1, 2, 3, 4] };
  const seen = (b) => (world.actors || []).some((a) => a.alive && a.team !== b.team && Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z) < 80 && !rayBlocked(b.pos.x, (b.y || 0) + 1.5, b.pos.z, a.pos.x, (a.y || 0) + 1.4, a.pos.z));
  function botEmote(b) {
    if (!on() || "client" === NET.mode || !b || !b.alive || b._emo || busy(b) || "live" !== world.phase && "end" !== world.phase) return !1;
    if ((b._emoCd || 0) > NOW() || seen(b)) return !1;
    const i = BOT.dur[Math.floor(Math.random() * BOT.dur.length)],
      em = start(b, i);
    if (!em) return !1;
    em.bot = !0;
    em.hp = b.hp;
    b._emoCd = NOW() + 20000;
    b.root = Math.max(b.root || 0, EM.LIST[i].dur);
    S.stats.bots++;
    relay(null, b, i);
    return !0;
  }
  function botTick() {
    for (const b of world.actors || []) {
      const em = b._emo;
      if (!em || !em.bot) continue;
      if (b.hp < em.hp - 0.01 || (NOW() - (em.seenT || 0) > 300 && ((em.seenT = NOW()), seen(b)))) {
        b.root = 0;
        stop(b);
        relay(null, b, -1);
      }
    }
  }
  const _ka = killActor;
  killActor = function (v, k) {
    const r = _ka.apply(this, arguments);
    try {
      v && v._emo && !v.alive && finish(v);
      "client" !== NET.mode && k && k !== v && "function" == typeof isAI && isAI(k) && k.team !== v.team && Math.random() < BOT.p && setTimeout(() => botEmote(k), 600 + 700 * Math.random());
    } catch (x) {}
    return r;
  };

  // ── every frame ──
  const _st = step;
  step = function (dt) {
    const r = _st.apply(this, arguments);
    try {
      const a = me();
      S.me && check(a);
      (!a || !a.alive) && ((S.k = 0), (S.me = null));
      "client" !== NET.mode && botTick();
    } catch (x) {}
    return r;
  };
  // the cancel keys (before the game reads them: an ability key that starts an ability ends the emote at once)
  addEventListener(
    "keydown",
    (e) => {
      if (!S.me || e.repeat) return;
      for (const id of CANCEL_KEYS) if (KEYMAP.is(e, id)) return void cancel(WHY[id]);
    },
    !0,
  );

  // ── the key: a tap plays, holding or tapping twice opens the wheel ──
  const HOLD = 320,
    DOUBLE = 380;
  function onKey(e) {
    if (!KEYMAP.is(e, "emote")) return;
    if (e.ctrlKey || e.metaKey || e.altKey || KEYMAP.editing(e.target) || !on() || !inMatch()) return;
    if ("keydown" === e.type) {
      if (e.repeat) return void (S.down && e.stopImmediatePropagation());
      if (modal()) return;
      e.stopImmediatePropagation();
      const t = NOW();
      S.down = t;
      if (S.wheel) return void wheelClose();
      if (S.tapT && t - S.tapT < DOUBLE) {
        S.tapT = 0;
        clearTimeout(S.hold);
        S.down = 0;
        return void wheelOpen("sticky");
      }
      if (S.me && t - S.me.t0 > DOUBLE) return (S.down = 0), void cancel("key");
      clearTimeout(S.hold);
      S.hold = setTimeout(() => {
        S.down && wheelOpen("hold");
      }, HOLD);
    } else if ("keyup" === e.type) {
      if (!S.down) return;
      e.stopImmediatePropagation();
      const held = NOW() - S.down;
      S.down = 0;
      clearTimeout(S.hold);
      if (S.wheel && "hold" === S.wheel.mode) return void (S.sel >= 0 ? pick(S.sel) : wheelClose());
      if (S.wheel) return;
      if (held < HOLD) {
        S.tapT = NOW();
        play(S.chosen);
      }
    }
  }
  for (const ev of ["keydown", "keyup"]) addEventListener(ev, onKey, !0);

  // ── the wheel ──
  const css = document.createElement("style");
  css.textContent = `#emo-wheel{position:fixed;left:50%;top:50%;width:0;height:0;z-index:63;pointer-events:none}
#emo-wheel[hidden]{display:none}
#emo-wheel::before{content:"";position:fixed;inset:0;background:radial-gradient(circle at 50% 50%,rgba(6,9,14,.62) 0,rgba(6,9,14,.5) 150px,rgba(6,9,14,.22) 100%);pointer-events:none}
body.touching #emo-wheel::before{background:rgba(6,9,14,.7)}
#emo-wheel .emo-hub{position:absolute;left:0;top:0;transform:translate(-50%,18px);width:112px;text-align:center;font:700 12px/1.35 'Noto Sans KR',system-ui,sans-serif;color:#cfd8e6;text-shadow:0 1px 6px #000}
#emo-wheel .emo-hub small{display:block;margin-top:3px;font-weight:500;font-size:10px;color:#8a97ab}
#emo-wheel .emo-b{position:absolute;left:0;top:0;width:96px;height:48px;margin:-24px 0 0 -48px;transform:rotate(var(--a)) translateY(-112px) rotate(calc(-1*var(--a)));pointer-events:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;padding:0;border-radius:12px;border:1.5px solid rgba(255,255,255,.2);background:rgba(14,19,27,.86);color:#e8edf4;font:700 12.5px/1.1 'Noto Sans KR',system-ui,sans-serif;backdrop-filter:blur(6px);cursor:pointer;touch-action:manipulation}
#emo-wheel .emo-b kbd{font:700 9.5px/1 system-ui;color:#8a97ab}
#emo-wheel .emo-b.cur{border-color:rgba(255,200,73,.7)}
#emo-wheel .emo-b.sel,#emo-wheel .emo-b:hover{background:rgba(255,200,73,.22);border-color:#ffc849;color:#fff}
body.touching #emo-wheel .emo-b{width:92px;height:44px;margin:-22px 0 0 -46px;transform:rotate(var(--a)) translateY(-104px) rotate(calc(-1*var(--a)))}
body.emoting #cross,body.emoting #crosshair{opacity:0!important}
body.emo-off #tb-emote,body.emo-off #emo-wheel{display:none!important}
.emo-tb{position:absolute;width:calc(46px*var(--mbs,1));height:calc(46px*var(--mbs,1));border-radius:50%;pointer-events:auto;display:grid;place-items:center;background:rgba(14,19,27,.62);border:1.5px solid rgba(255,255,255,.22);color:#e8edf4;font:700 calc(10.5px*var(--mbs,1))/1 'Noto Sans KR',system-ui,sans-serif;backdrop-filter:blur(6px);touch-action:none;padding:0}
#tb-emote{border-color:rgba(138,226,255,.65);color:#bdeeff;background:rgba(80,190,255,.14);left:calc(114px + env(safe-area-inset-left));top:106px}
#tb-emote.on{background:rgba(80,190,255,.4)}`;
  document.head.appendChild(css);
  const root = document.createElement("div");
  root.id = "emo-wheel";
  root.hidden = !0;
  root.setAttribute("role", "menu");
  root.setAttribute("aria-label", L("이모트", "Emotes"));
  root.innerHTML = '<div class="emo-hub"></div>';
  EM.LIST.forEach((e, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "emo-b";
    b.dataset.i = i;
    b.style.setProperty("--a", (360 / EM.LIST.length) * i + "deg");
    b.setAttribute("role", "menuitem");
    b.innerHTML = `<kbd>${i + 1}</kbd><span>${EN ? e.en : e.ko}</span>`;
    b.addEventListener("click", (ev) => {
      ev.stopPropagation();
      pick(i);
    });
    b.addEventListener("pointerenter", () => setSel(i));
    root.appendChild(b);
  });
  document.body.appendChild(root);
  const hub = root.querySelector(".emo-hub");
  function setSel(i) {
    S.sel = i;
    root.querySelectorAll(".emo-b").forEach((b, j) => b.classList.toggle("sel", j === i));
    hub.innerHTML = i >= 0 ? EM.name(i, EN) : L("이모트", "Emotes");
    hub.innerHTML += `<small>${S.wheel && "hold" === S.wheel.mode ? L("놓으면 선택", "Release to pick") : IS_TOUCH ? L("눌러서 선택", "Tap one") : L("1-6 · 마우스 · Esc", "1-6 · mouse · Esc")}</small>`;
  }
  function wheelOpen(mode) {
    if (!on() || !inMatch() || modal() || busy(me())) return;
    S.wheel = { mode, dx: 0, dy: 0 };
    root.hidden = !1;
    root.querySelectorAll(".emo-b").forEach((b, j) => b.classList.toggle("cur", j === S.chosen));
    setSel(-1);
    paintBtn();
  }
  function wheelClose() {
    S.wheel = null;
    root.hidden = !0;
    setSel(-1);
    paintBtn();
  }
  function pick(i) {
    wheelClose();
    S.chosen = i;
    play(i) || (S.chosen = i);
  }
  // while the wheel is up the mouse picks (the pointer is locked, so the movement is what counts) and does not turn the view
  addEventListener(
    "mousemove",
    (e) => {
      if (!S.wheel) return;
      e.stopImmediatePropagation();
      if (!locked) return;
      const w = S.wheel;
      w.dx = Math.max(-90, Math.min(90, w.dx + (e.movementX || 0)));
      w.dy = Math.max(-90, Math.min(90, w.dy + (e.movementY || 0)));
      if (Math.hypot(w.dx, w.dy) < 22) return;
      const n = EM.LIST.length,
        ang = (Math.atan2(w.dx, -w.dy) + 2 * Math.PI) % (2 * Math.PI),
        i = Math.floor((ang + Math.PI / n) / ((2 * Math.PI) / n)) % n;
      i !== S.sel && setSel(i);
    },
    !0,
  );
  addEventListener(
    "mousedown",
    (e) => {
      if (!S.wheel || e.target.closest("#emo-wheel")) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      0 === e.button && S.sel >= 0 ? pick(S.sel) : wheelClose();
    },
    !0,
  );
  addEventListener(
    "keydown",
    (e) => {
      if (!S.wheel || KEYMAP.is(e, "emote")) return;
      const d = /^(?:Digit|Numpad)([1-9])$/.exec(e.code || "");
      if (d && +d[1] <= EM.LIST.length) (e.preventDefault(), e.stopImmediatePropagation(), pick(+d[1] - 1));
      else if ("Escape" === e.key) (e.preventDefault(), e.stopImmediatePropagation(), wheelClose());
    },
    !0,
  );

  // ── touch: a button, movable in the layout editor (tap plays, a long press or two taps open the list) ──
  const tb = document.createElement("button");
  tb.type = "button";
  tb.id = "tb-emote";
  tb.className = "emo-tb";
  tb.textContent = L("이모트", "Emote");
  tb.setAttribute("aria-label", L("이모트", "Emote"));
  let tapT = 0, lpT = 0, lp = !1;
  const tbPress = () => {
    if (S.wheel) return void wheelClose();
    if (S.me) return void cancel("key");
    const t = NOW();
    if (t - tapT < DOUBLE) return void wheelOpen("sticky");
    tapT = t;
    play(S.chosen);
  };
  tb.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      lp = !1;
      clearTimeout(lpT);
      lpT = setTimeout(() => ((lp = !0), wheelOpen("sticky")), 450);
      tb._at = NOW();
    },
    { passive: !1 },
  );
  tb.addEventListener("touchend", (e) => {
    e.preventDefault();
    clearTimeout(lpT);
    lp || tbPress();
    tb._tapped = NOW();
  });
  tb.addEventListener("touchcancel", () => clearTimeout(lpT));
  tb.addEventListener("click", () => NOW() - (tb._tapped || 0) > 600 && tbPress());
  const touchBox = $("touch");
  touchBox && touchBox.appendChild(tb);
  const paintBtn = () => tb.classList.toggle("on", !!(S.me || S.wheel));
  // the touch controls that end it (a tap on fire, aim, jump, reload, grenade, use or an ability)
  touchBox &&
    touchBox.addEventListener(
      "touchstart",
      (e) => {
        if (!S.me || e.target.closest("#tb-emote")) return;
        e.target.closest("button, .tab") && cancel("touch");
      },
      !0,
    );

  // ── the page follows the owner's switch and what the match is doing ──
  function sync() {
    const off = !on();
    document.body.classList.toggle("emo-off", off);
    document.body.classList.toggle("emoting", S.k > 0.2);
    if (S.wheel && (off || !inMatch() || modal() || busy(me()))) wheelClose();
    S.me && off && cancel("state");
    paintBtn();
  }
  setInterval(sync, 250);
  addEventListener("server-config", sync);
  if ("function" == typeof netShutdown) {
    const _sd = netShutdown;
    netShutdown = function () {
      try {
        BUCKET.clear();
        S.me = null;
        S.k = 0;
        wheelClose();
        for (const a of world.actors || []) a._emo && finish(a);
      } catch (e) {}
      return _sd.apply(this, arguments);
    };
  }
  window.EMOTE = {
    on,
    state: S,
    stats: S.stats,
    play,
    cancel,
    stop: () => me() && stop(me()),
    wheelOpen,
    wheelClose,
    hostEmote,
    botEmote,
    recv,
    start,
    take: (k) => EM.take(BUCKET, k),
    resetLimits: () => BUCKET.clear(),
    chosen: () => S.chosen,
    canStart: () => canStart(me()),
    camera: () => ({ pos: S.camPos || null, target: S.camTarget || null, k: S.k, dist: S.dist }),
    sync,
  };
})();
