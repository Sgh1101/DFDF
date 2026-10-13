
(() => {
  // Faster movement everywhere, admin switches that should not silently
  // outlive the page, and bots that stand still with an enemy in sight.

  // 1. run faster (bots use the same numbers)
  const OLD = { run: 9, walk: 3.8, crouch: 4.2 },
    NEW = { run: 10.6, walk: 4.3, crouch: 4.7 };
  Object.assign(ADMIN_DEF, NEW);
  // saved admin settings still holding the old defaults move up too
  for (const k in OLD) ADMIN[k] === OLD[k] && (ADMIN[k] = NEW[k]);

  // 2. "bot stop" (the practice preset) was saved and came back every visit,
  //    so bots stood in spawn from the first second. Keep it for this page
  //    only, and say so when a match starts with it on.
  if (ADMIN.freezeAI || !(ADMIN.aiSpeed > 0.05)) {
    ADMIN.freezeAI = !1;
    ADMIN.aiSpeed > 0.05 || (ADMIN.aiSpeed = 1);
    try {
      saveAdmin();
    } catch (e) {}
  }
  const _sr = startRound;
  startRound = function () {
    const r = _sr.apply(this, arguments);
    try {
      ADMIN.freezeAI && setTimeout(() => banner("관리자 설정: 봇 정지 켜짐", "#ffc849"), 1400);
    } catch (e) {}
    return r;
  };

  // 3. a bot "fighting" someone it can see but cannot walk toward (a railing,
  //    a window, a low wall in the way) used to strafe on the spot forever.
  //    After a few seconds of that it stops looking and walks a real path to
  //    where the enemy was; then it fights again.
  const ST = new Map();
  const _pick = aiPickTarget;
  aiPickTarget = function (e) {
    const s = ST.get(e.id);
    if (s && s.chase > 0) return null;
    return _pick.apply(this, arguments);
  };
  function watch(dt) {
    if (!isHost() || "live" !== world.phase) return void ST.clear();
    for (const a of world.actors) {
      if (!a.alive || !isAI(a) || !a.ai) {
        ST.delete(a.id);
        continue;
      }
      let s = ST.get(a.id);
      s || ST.set(a.id, (s = { x: a.pos.x, z: a.pos.z, t: 0, chase: 0 }));
      if (s.chase > 0) {
        s.chase -= dt;
        continue;
      }
      if (Math.hypot(a.pos.x - s.x, a.pos.z - s.z) > 1.5) {
        s.x = a.pos.x;
        s.z = a.pos.z;
        s.t = 0;
        continue;
      }
      if ("fight" !== a.ai.state || a.planting > 0 || a.defusing > 0) {
        s.t = 0;
        continue;
      }
      const ls = a.ai.lastSeen;
      if (!ls || Math.hypot(ls.x - a.pos.x, ls.z - a.pos.z) < 22) {
        s.t = 0;
        continue;
      }
      s.t += dt;
      if (s.t > 4) {
        s.t = 0;
        s.chase = 3.5;
        // make sure it knows where to go while it is not "seeing" the target
        try {
          const tgt = world.actors.find((o) => o.alive && o.team !== a.team && Math.hypot(o.pos.x - ls.x, o.pos.z - ls.z) < 3);
          tgt && intelReport(a, tgt);
        } catch (e) {}
        Object.assign(a.ai, { state: "hunt", path: [], pathIdx: 0, repathCd: 0 });
        window.BOT_CHASES = (window.BOT_CHASES || 0) + 1;
      }
    }
  }
  const _ns = netStep;
  netStep = function (dt) {
    const r = _ns.apply(this, arguments);
    try {
      watch(dt || 0.016);
    } catch (e) {}
    return r;
  };
})();
