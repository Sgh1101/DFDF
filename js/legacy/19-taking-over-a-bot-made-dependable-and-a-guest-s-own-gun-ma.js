
(() => {
  // Taking over a bot, made dependable, and a guest's own gun made to feel like
  // theirs: 1) a taken-over body drops whatever the bot was halfway through;
  // 2) a guest waiting for a takeover asks again until the host answers;
  // 3) guests see their own shots right away (flash, kick, casing, sound,
  //    ammo count) and the host keeps their ammo in step.
  const me = () => ("function" == typeof myActor && myActor()) || null;
  const respawnMode = () => !!(window.GAME_MODES && GAME_MODES[room.mode] && GAME_MODES[room.mode].respawn);

  // 1. a clean body
  function cleanBody(a) {
    if (!a) return;
    a.planting = 0;
    a.defusing = 0;
    a.plantAnchor = null;
    a._held = !1;
    a.burstLeft = 0;
    a.ads = !1;
    a.input && ((a.input.mv = [0, 0]), (a.input.btn = 0));
  }
  const _to = takeOver;
  takeOver = function (id) {
    const r = _to.apply(this, arguments);
    try {
      r && cleanBody(r);
    } catch (e) {}
    return r;
  };
  const _toa = takeOverAlly;
  takeOverAlly = function () {
    // respawn modes bring you back yourself; taking a bot there left your own
    // body to respawn with nobody driving it, frozen in the spawn
    if (respawnMode()) return !1;
    const r = _toa.apply(this, arguments);
    try {
      if (r && "client" !== NET.mode) {
        keys.fire = !1;
        keys.ads = !1;
      }
    } catch (e) {}
    return r;
  };

  // 2. guests: keep asking while dead in a live round with bots left to take
  let lastAsk = 0,
    asks = 0,
    deadSince = 0;
  function guestRetry() {
    if ("client" !== NET.mode || respawnMode()) return;
    const m = me();
    if (!m || m.alive || "live" !== world.phase || world.over) {
      asks = 0;
      deadSince = 0;
      return;
    }
    const now = performance.now();
    deadSince || (deadSince = now);
    if (now - deadSince < 2600 || now - lastAsk < 2000 || asks >= 6) return;
    const bots = world.actors.some((o) => o !== m && o.alive && o.team === m.team && "ai" === o.ctrl);
    if (!bots) return;
    lastAsk = now;
    asks++;
    try {
      sendAction({ t: "takeover", id: null });
    } catch (e) {}
  }

  // 3. host → guests: ammo, slot and reload state for the body they drive
  let ammoAcc = 0;
  function hostSync(dt) {
    if ("host" !== NET.mode) return;
    ammoAcc += dt;
    if (ammoAcc < 0.25) return;
    ammoAcc = 0;
    for (const a of world.actors) {
      if (!a.ctrl || "me" === a.ctrl || "ai" === a.ctrl || "dead" === a.ctrl) continue;
      const k = actorWeaponKey(a);
      sendEventTo(a.ctrl, { t: "am", id: a.id, k, n: a.ammo[k] | 0, r: a.reserve ? a.reserve[k] : 0, rl: a.reloading > 0 ? 1 : 0 });
    }
  }
  const PRED = { cd: 0, held: !1, until: 0 };
  const _oe = NET.onEvent;
  NET.onEvent = (e) => {
    if (e && "am" === e.t) {
      const m = me();
      if (m && m.id === e.id && m.ammo) {
        // our own prediction runs ahead of the host for a moment; do not snap back up mid-burst
        const cur = m.ammo[e.k] | 0;
        (performance.now() > PRED.until || e.n < cur || e.rl) && (m.ammo[e.k] = e.n);
        null != e.r && m.reserve && (m.reserve[e.k] = e.r);
      }
      return;
    }
    return _oe(e);
  };
  // guests: show your own shot the moment you pull the trigger
  function guestPredict(dt) {
    if ("client" !== NET.mode) return;
    const m = me();
    PRED.cd -= dt;
    if (!m || !m.alive || m.ultW || m.reloading > 0 || "end" === world.phase || "buy" === world.phase) return void (PRED.held = !!keys.fire);
    const k = actorWeaponKey(m),
      w = WEAPONS[k];
    if (!w || "knife" === k) return;
    if (!keys.fire) return void (PRED.held = !1);
    if (PRED.cd > 0 || (!w.auto && PRED.held)) return;
    PRED.held = !0;
    if ((m.ammo[k] | 0) <= 0) return;
    PRED.cd = 60 / w.rpm;
    m.ammo[k]--;
    PRED.until = performance.now() + 400;
    try {
      viewmodelFireKick();
      muzzleFlash();
      SFX.gun(k, 0);
      GFX.tracer && !w.launcher && addTracer(new T.Vector3(m.pos.x, actorEye(m), m.pos.z), m.yaw, m.pitch || 0, w.range);
      window.GUNFX && GUNFX.ejectMine && GUNFX.ejectMine(k);
    } catch (e) {}
  }

  // host: nothing alive may be left without a driver
  let orphanAcc = 0;
  function freeOrphans(dt) {
    if (!isHost() || !world.actors) return;
    orphanAcc += dt;
    if (orphanAcc < 0.5) return;
    orphanAcc = 0;
    for (const a of world.actors) {
      if (!a.alive) continue;
      const gone = "dead" === a.ctrl || (a.ctrl && "me" !== a.ctrl && "ai" !== a.ctrl && "host" === NET.mode && !NET.conns.has(a.ctrl));
      if (!gone) continue;
      releaseToAI(a.id);
      a._releaseName && ((a.name = a._releaseName), (a._releaseName = null));
      "host" === NET.mode && sendEventAll({ t: "ctrl", id: a.id, ctrl: "ai", name: a.name });
      window.ORPHANS_FREED = (window.ORPHANS_FREED || 0) + 1;
    }
  }

  const _ns = netStep;
  netStep = function (dt) {
    const r = _ns.apply(this, arguments);
    try {
      guestRetry();
      freeOrphans(dt || 0.016);
      hostSync(dt || 0.016);
      guestPredict(dt || 0.016);
    } catch (e) {}
    return r;
  };
  window.NETFEEL = { PRED, cleanBody };
})();
