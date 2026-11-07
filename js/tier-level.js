(function (root) {
  'use strict';
  // The account's level, shown as a tier (2026-11-07: ranked play was removed at the owner's request and the level number
  // is no longer shown; the tiers it used are the way progress is shown instead). Three levels make a division, three
  // divisions a tier, 구리 to 금강, then 왕좌 from level 73. Shared by the game (js/legacy/71-the-tier-...), the home page
  // (index.html, js/home-clan.js) and the tests.
  const LEVELS_PER_DIVISION = 3;
  const LAST_STEP = 24; // 8 tiers x 3 divisions, then 왕좌
  const NAMES = {
    ko: ['구리', '청동', '은빛', '금빛', '백금', '비취', '홍옥', '금강', '왕좌'],
    en: ['Copper', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Jade', 'Ruby', 'Adamant', 'Throne'],
  };
  const COLORS = ['#8a8f98', '#c07a4a', '#c9d3de', '#ffc849', '#3fd0c9', '#b48cff', '#3ddc84', '#ff4d6d', '#fff3a0'];
  const lvOf = (level) => Math.max(1, Math.floor(+level) || 1);
  // a level as a tier: { t: 0..8, div: 1..3 (0 at 왕좌), step: 0..24 }
  function of(level) {
    const step = Math.min(LAST_STEP, Math.floor((lvOf(level) - 1) / LEVELS_PER_DIVISION));
    return step >= LAST_STEP ? { t: 8, div: 0, step } : { t: Math.floor(step / 3), div: (step % 3) + 1, step };
  }
  const nameOf = (r, lang) => NAMES[lang === 'en' ? 'en' : 'ko'][r.t] + (r.div ? ' ' + r.div : '');
  const text = (level, lang) => nameOf(of(level), lang);
  // the first level of the next division (null at 왕좌)
  const nextAt = (level) => { const s = of(level).step; return s >= LAST_STEP ? null : (s + 1) * LEVELS_PER_DIVISION + 1; };
  // how far into the division: 0..1, from the levels done in it and the XP into the current level (into/need)
  function progress(level, into, need) {
    const s = of(level).step;
    if (s >= LAST_STEP) return 1;
    const done = lvOf(level) - 1 - s * LEVELS_PER_DIVISION, part = need > 0 ? Math.max(0, Math.min(1, (into || 0) / need)) : 0;
    return Math.max(0, Math.min(1, (done + part) / LEVELS_PER_DIVISION));
  }
  const api = { LEVELS_PER_DIVISION, of, text, nameOf, nextAt, progress, names: NAMES, colors: COLORS };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.TIER_LEVEL = api;
})(typeof window === 'object' ? window : globalThis);
