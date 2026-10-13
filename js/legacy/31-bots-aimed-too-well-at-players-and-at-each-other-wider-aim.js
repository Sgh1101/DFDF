
(() => {
  // Bots aimed too well, at players and at each other. Wider aim wobble,
  // fewer headshots, more spread and slower turns on every difficulty.
  const TUNE = {
    easy: { err: 0.6, hs: 0.025, turn: 4 },
    normal: { err: 0.42, hs: 0.08, turn: 6 },
    hard: { err: 0.26, hs: 0.18, turn: 9 },
  };
  for (const k in TUNE) DIFF_TUNE[k] && Object.assign(DIFF_TUNE[k], TUNE[k]);
  // extra cone added to every bot shot (was 0.055 for all)
  const SPREAD = { easy: 0.11, normal: 0.09, hard: 0.072 };
  window.BOT_AIM = { TUNE, SPREAD };
  const _st = step;
  step = function () {
    try {
      const sp = SPREAD[room.diff] || SPREAD.normal;
      for (const a of world.actors || []) {
        if (!a.ai || !isAI(a)) continue;
        // one aimed shot at a time (snipers, semi rifles) gets a tighter cone,
        // or a bot with a sniper never lands anything past a few metres
        const w = WEAPONS[actorWeaponKey(a)];
        const k = w && !w.auto ? ("저격총" === w.cls ? 0.35 : "소총" === w.cls ? 0.6 : 1) : 1;
        a.ai.accuracy = sp * k;
      }
    } catch (e) {}
    return _st.apply(this, arguments);
  };
})();
