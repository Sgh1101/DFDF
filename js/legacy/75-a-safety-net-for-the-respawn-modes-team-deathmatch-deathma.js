
(() => {
  // A safety net for the respawn modes (team deathmatch, deathmatch): the host
  // brings a dead fighter back 3 s after the death. If a death ever slips past
  // that (no timer set), a fighter dead for over 4 s with no timer running gets
  // one, so nobody stays dead for the rest of a match.
  if ("undefined" == typeof netStep || !window.GAME_MODES) return;
  const respawnOn = () => !!(GAME_MODES[room.mode] && GAME_MODES[room.mode].respawn);
  const host = () => "undefined" == typeof NET || "client" !== NET.mode;
  const _ns = netStep;
  netStep = function (dt) {
    const r = _ns.apply(this, arguments);
    try {
      if (host() && respawnOn() && world.actors && world.actors.length && !world.over && ("live" === world.phase || "buy" === world.phase))
        for (const a of world.actors) {
          if (a.alive || "dead" === a.ctrl) {
            a.__deadFor = 0;
            continue;
          }
          if (a._respawnT > 0) continue;
          a.__deadFor = (a.__deadFor || 0) + (dt || 0.016);
          if (a.__deadFor > 4) {
            a.__deadFor = 0;
            a._respawnT = 0.01;
            window.RESPAWN_GUARD = (window.RESPAWN_GUARD || 0) + 1;
          }
        }
    } catch (e) {}
    return r;
  };
})();
