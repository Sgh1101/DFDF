
(() => {
  // 1. God mode leaked: fire walls, burning, mines, traps, decay and the
  //    spike blast take health without going through dealDamage. Guard the
  //    health value itself: a god's hp never goes down and it cannot die.
  const isGod = (a) => {
    if (!a || a._ownForce) return !1; // the owner's own order wins over god mode
    if ("me" === a.ctrl && ADMIN.god) return !0;
    try {
      const f = window.ADMIN2 && ADMIN2.flagsFor(a);
      return !!(f && f.god);
    } catch (e) {
      return !1;
    }
  };
  window.isGodActor = isGod;
  const guard = (a) => {
    if (!a || a._hpGuard) return;
    a._hpGuard = 1;
    let v = a.hp;
    Object.defineProperty(a, "hp", {
      configurable: !0,
      enumerable: !0,
      get: () => v,
      set: (n) => {
        if (n < v && a.alive && isGod(a)) return;
        v = n;
      },
    });
  };
  const _ka = killActor;
  killActor = function (e) {
    if (e && e.alive && isGod(e)) return void (e.hp = Math.max(e.hp || 0, 100));
    return _ka.apply(this, arguments);
  };
  const _ad = applyDecay;
  applyDecay = function (e) {
    if (isGod(e)) return;
    return _ad.apply(this, arguments);
  };
  const _st = step;
  step = function () {
    try {
      for (const a of world.actors || []) {
        guard(a);
        a.alive && a.hp < 100 && isGod(a) && ((a._hpGuard = 1), Object.getOwnPropertyDescriptor(a, "hp").set.call(a, 100), (a.decayAmt = 0));
      }
    } catch (e) {}
    return _st.apply(this, arguments);
  };

  // 2. Deathmatch with abilities (every player for themselves, so "enemy"
  //    is everyone else; ultimate points still come from kills)
  try {
    const dm = GAME_MODES.dm;
    dm.noAbil = !1;
    dm.sub = "개인전 40킬 · 부활 · 능력 사용";
  } catch (e) {}
})();
