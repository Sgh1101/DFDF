
(() => {
  // Gun skins. Every gun is built from the same small set of materials
  // (GUNMAT: steel, polymer, blued, glow...), so a skin is a recipe that swaps
  // each of those for its own: a colour and finish for the body, the metal and
  // the dark parts, an accent for the lights, and for some a painted pattern
  // (camo, carbon, tiger, petals, ink, dancheong...) or a glow that pulses or
  // cycles. One recipe fits all thirty-two guns. The skin shows in your own
  // hands, on your body as others see it, and on the gun you drop. Picks are
  // made in the armoury (무기고), kept on this device and, signed in, on the
  // account. Others in a room are told what you wear. Online a skin is worn
  // only once it is owned: pulled in the armoury for gold (won in matches) or
  // granted by the owner.
  if ("undefined" == typeof GUNMAT || "undefined" == typeof GUN_BUILD || "undefined" == typeof WEAPONS || "undefined" == typeof NET) return;
  const EN = "en" === window.GAME_LANG,
    L = (ko, en) => (EN ? en : ko),
    $ = (id) => document.getElementById(id);

  // ── 1. materials say what they are ──
  // (GUN_BUILD looks GUNMAT up by name at build time, so wrapping the entries
  // tags every material a gun is ever built from)
  for (const k of Object.keys(GUNMAT)) {
    const f = GUNMAT[k];
    GUNMAT[k] = function () {
      const m = f.apply(this, arguments);
      m && m.userData && (m.userData.kind = k);
      return m;
    };
  }
  // what a skin treats alike: the receiver and furniture, the bright metal, the dark fittings, lights, lenses
  const CLASS = { polymer: "body", darkpoly: "body", tan: "body", olive: "body", wood: "body", woodDark: "body", black: "body", steel: "metal", gunmetal: "metal", chrome: "metal", brass: "metal", copper: "metal", blade: "metal", blued: "dark", rubber: "dark", glass: "glass", glow: "glow" };

  // ── 2. the skins ──
  // body/metal/dark: [colour, roughness, metalness]; glow: the accent; pat: a
  // painted pattern on the body; em: the pattern also glows; anim: pulse (the
  // glow breathes), hue (the sheen cycles through colours), drift (the pattern moves)
  const RAR = [
    { ko: "기본", en: "Stock", c: "#8a97ab" },
    ...SKIN_TIERS.list,
  ];
  const SKINS = [
    { id: "default", ko: "기본", en: "Stock", rar: 0 },
    { id: "obsidian", gone: !0, ko: "흑요석", en: "Obsidian", rar: 1, body: [0x15171c, 0.5, 0.3], metal: [0x3a3f4a, 0.35, 0.8], dark: [0x0b0c0f, 0.7, 0.2], glow: 0xff2d55, glass: 0xff6b81 },
    { id: "snow", ko: "설원 위장", en: "Snow camo", rar: 1, body: [0xffffff, 0.85, 0], pat: "camo", pal: ["#eef2f5", "#c7d0d8", "#9aa7b4", "#5f6b78"], metal: [0xb9c2cc, 0.35, 0.75], dark: [0x3a414a, 0.7, 0.2], glow: 0x9be7ff },
    { id: "jungle", ko: "밀림 위장", en: "Jungle camo", rar: 1, body: [0xffffff, 0.88, 0], pat: "camo", pal: ["#4a6a30", "#6f9440", "#26391c", "#8d8a52"], metal: [0x4f5b48, 0.5, 0.6], dark: [0x1f261b, 0.8, 0.1], glow: 0xb2ff59 },
    { id: "desert", ko: "사막 위장", en: "Desert camo", rar: 1, body: [0xffffff, 0.85, 0], pat: "digi", pal: ["#cdb78e", "#a88f63", "#e3d4ab", "#7d6a45"], metal: [0x8c7352, 0.42, 0.7], dark: [0x4a3d2a, 0.8, 0.15], glow: 0xffd180 },
    { id: "carbon", ko: "카본", en: "Carbon", rar: 2, body: [0xffffff, 0.32, 0.55], pat: "carbon", pal: ["#1a1d22", "#30353d", "#0b0c0e"], metal: [0xc9d1d9, 0.2, 0.9], dark: [0x101216, 0.6, 0.3], glow: 0x00e5ff, glass: 0x80f4ff },
    { id: "tiger", ko: "호랑이", en: "Tiger", rar: 2, body: [0xffffff, 0.7, 0.05], pat: "stripes", pal: ["#f08a24", "#1a1410", "#ffb347"], metal: [0x1b1b1b, 0.4, 0.7], dark: [0x0e0c0a, 0.75, 0.2], glow: 0xffab00 },
    { id: "sakura", ko: "벚꽃", en: "Cherry blossom", rar: 2, body: [0xffffff, 0.6, 0.05], pat: "petals", pal: ["#f7d6e0", "#f48fb1", "#fff4f7", "#c2185b"], metal: [0xe8a9a0, 0.3, 0.85], dark: [0x5a3a44, 0.7, 0.2], glow: 0xff80ab },
    { id: "ice", gone: !0, ko: "얼음", en: "Ice", rar: 2, body: [0xbfe9ff, 0.08, 0.15], emis: [0x2a5a7a, 0.25], metal: [0xdaf2ff, 0.1, 0.95], dark: [0x2f4f66, 0.5, 0.3], glow: 0xe0f7ff, glass: 0xffffff },
    { id: "celadon", ko: "청자", en: "Celadon", rar: 2, body: [0xffffff, 0.18, 0.05], pat: "crackle", pal: ["#8fc1a9", "#6fa58d", "#a9d3bf", "#3f6f5a"], metal: [0xc9a14a, 0.3, 0.85], dark: [0x2f4a3d, 0.6, 0.2], glow: 0xa5d6a7 },
    { id: "dancheong", ko: "단청", en: "Dancheong", rar: 3, body: [0xffffff, 0.55, 0.05], pat: "dancheong", pal: ["#2e7d5b", "#c62828", "#1e4fa3", "#f2c230", "#f5efe3"], metal: [0xd4af37, 0.3, 0.85], dark: [0x2a1f1a, 0.7, 0.2], glow: 0xffd54f },
    { id: "ink", ko: "수묵", en: "Ink wash", rar: 3, body: [0xffffff, 0.6, 0.02], pat: "ink", pal: ["#f4f1ea", "#1b1b1b", "#555"], metal: [0x1a1a1a, 0.45, 0.7], dark: [0x111111, 0.7, 0.2], glow: 0x90caf9 },
    { id: "gold", ko: "황금", en: "Gold", rar: 3, body: [0xf1c232, 0.28, 0.95], metal: [0xffd966, 0.22, 1], dark: [0x8a6a14, 0.4, 0.9], glow: 0xfff176, glass: 0xfff8e1 },
    { id: "neon", ko: "네온", en: "Neon", rar: 3, body: [0xffffff, 0.5, 0.3], pat: "grid", em: !0, pal: ["#0f1116", "#00e5ff", "#ff2bd6"], anim: "pulse", metal: [0x2a2f3a, 0.35, 0.8], dark: [0x090a0d, 0.7, 0.2], glow: 0x00e5ff, glass: 0x80f4ff },
    { id: "lava", ko: "용암", en: "Lava", rar: 4, body: [0xffffff, 0.85, 0.1], pat: "cracks", em: !0, pal: ["#1a1412", "#ff7a1a", "#ffd166"], anim: "pulse", metal: [0x2b2420, 0.5, 0.7], dark: [0x0d0a09, 0.8, 0.2], glow: 0xff7043, glass: 0xffb27a },
    { id: "galaxy", ko: "은하", en: "Galaxy", rar: 4, body: [0xffffff, 0.45, 0.2], pat: "galaxy", em: !0, pal: ["#120a2a", "#3b1d7a", "#1b3a8a", "#c56bff"], anim: "drift", metal: [0x3a2a5a, 0.35, 0.8], dark: [0x120d1f, 0.7, 0.2], glow: 0xb388ff, glass: 0xd1b3ff },
    { id: "holo", gone: !0, ko: "홀로그램", en: "Holo", rar: 4, body: [0xe8ecf3, 0.2, 0.6], emis: [0x4080ff, 0.35], anim: "hue", metal: [0xd0d6e0, 0.15, 1], dark: [0x2a2e38, 0.5, 0.4], glow: 0xffffff, glass: 0xffffff },
    // knives that are other knives (only: the one gun they fit; model: its build in KNIVES)
    { id: "flip", ko: "접이식 나이프", en: "Flip knife", rar: 2, only: "knife", model: "flip", body: [0xffffff, 0.32, 0.55], pat: "carbon", pal: ["#1a1d22", "#30353d", "#0b0c0e"], metal: [0xc9d1d9, 0.3, 0.7], dark: [0x101216, 0.6, 0.3], glow: 0x00e5ff },
    { id: "tanto", ko: "탄토", en: "Tanto", rar: 3, only: "knife", model: "tanto", body: [0x14161b, 0.72, 0.1], metal: [0xeef2f6, 0.3, 0.6], dark: [0x2a2e38, 0.6, 0.3], glow: 0xffffff },
    { id: "kukri", ko: "쿠크리", en: "Kukri", rar: 3, only: "knife", model: "kukri", keep: ["wood", "woodDark", "brass"], body: [0x5a3a22, 0.7, 0.05], metal: [0xd3dae2, 0.35, 0.7], dark: [0x2a1f1a, 0.7, 0.2], glow: 0xffb300 },
    { id: "karambit", ko: "카람빗", en: "Karambit", rar: 4, only: "knife", model: "karambit", keep: ["chrome"], body: [0x15171c, 0.55, 0.3], metal: [0xa9b2bf, 0.4, 0.7], dark: [0x0b0c0f, 0.7, 0.2], glow: 0xff3d5a },
    { id: "butterfly", ko: "발리송", en: "Butterfly knife", rar: 4, only: "knife", model: "butterfly", keep: ["chrome"], body: [0x7e7553, 0.78, 0.12], metal: [0x2c3038, 0.32, 0.8], dark: [0x14171c, 0.6, 0.3], glow: 0x40c4ff },
    // the second set (after the knives: the numbers sent to a room stay the same)
    { id: "urban", ko: "도심 위장", en: "Urban camo", rar: 1, body: [0xffffff, 0.82, 0], pat: "digi", pal: ["#8d949c", "#5d646d", "#b9bec4", "#3a3f46"], metal: [0x6d737b, 0.4, 0.7], dark: [0x262a30, 0.75, 0.2], glow: 0xcfd8dc },
    { id: "navy", ko: "해군 위장", en: "Navy camo", rar: 1, body: [0xffffff, 0.84, 0], pat: "camo", pal: ["#2c3e5c", "#1b2840", "#4a6488", "#7d93b2"], metal: [0x3a4a62, 0.4, 0.7], dark: [0x121a28, 0.75, 0.2], glow: 0x82b1ff },
    { id: "marble", ko: "대리석", en: "Marble", rar: 2, body: [0xffffff, 0.22, 0.05], pat: "marble", pal: ["#eeeae4", "#8a8580", "#c9a86a"], metal: [0xc9a86a, 0.25, 0.9], dark: [0x3b3633, 0.6, 0.2], glow: 0xfff3d6 },
    { id: "hex", ko: "벌집", en: "Hive", rar: 2, body: [0xffffff, 0.45, 0.25], pat: "hex", pal: ["#16181c", "#22262c", "#ffb300", "#0c0d10"], metal: [0x2c3036, 0.35, 0.8], dark: [0x0c0d10, 0.7, 0.2], glow: 0xffb300 },
    { id: "wave", ko: "청해파", en: "Blue waves", rar: 2, body: [0xffffff, 0.5, 0.05], pat: "wave", pal: ["#0d2a4a", "#1f5f99", "#e8f1fa"], metal: [0xb0c4d8, 0.3, 0.85], dark: [0x0b1c30, 0.7, 0.2], glow: 0x4fc3f7 },
    { id: "circuit", ko: "회로", en: "Circuit", rar: 3, body: [0xffffff, 0.45, 0.25], pat: "circuit", em: !0, pal: ["#0b1a12", "#1de9b6", "#b9ffea"], anim: "pulse", metal: [0x1d2b25, 0.35, 0.8], dark: [0x07100b, 0.7, 0.2], glow: 0x1de9b6, glass: 0x84ffe4 },
    { id: "dragon", ko: "용비늘", en: "Dragon scale", rar: 3, body: [0xffffff, 0.35, 0.35], pat: "scale", pal: ["#0e2a22", "#1f7a5c", "#9be7c4", "#082019"], metal: [0xd4af37, 0.25, 0.95], dark: [0x0c1a15, 0.6, 0.3], glow: 0x69f0ae },
    { id: "aurora", ko: "오로라", en: "Aurora", rar: 3, body: [0xffffff, 0.4, 0.2], pat: "aurora", em: !0, pal: ["#06121f", "#2ef2b0", "#7c4dff", "#29b6f6"], anim: "drift", metal: [0x22313f, 0.3, 0.8], dark: [0x050b13, 0.7, 0.2], glow: 0x64ffda, glass: 0xb2fff0 },
    { id: "phoenix", ko: "봉황", en: "Phoenix", rar: 4, body: [0xffffff, 0.5, 0.2], pat: "flame", em: !0, pal: ["#2a0806", "#d81b0c", "#ff8f00", "#ffe57f"], anim: "pulse", metal: [0xd4af37, 0.25, 0.95], dark: [0x1a0604, 0.7, 0.2], glow: 0xff6d00, glass: 0xffd180 },
    { id: "storm", ko: "뇌전", en: "Thunderstorm", rar: 4, body: [0xffffff, 0.4, 0.3], pat: "storm", em: !0, pal: ["#10131c", "#5c8dff", "#e6f0ff", "#2a3350"], anim: "pulse", metal: [0x3a4258, 0.3, 0.85], dark: [0x0a0c12, 0.7, 0.2], glow: 0x82b1ff, glass: 0xd6e4ff },
    // five more knives (after the second set, so the numbers sent to a room stay the same), one or two in every tier
    { id: "bayonet", ko: "총검", en: "Bayonet", rar: 1, only: "knife", model: "bayonet", keep: ["chrome"], body: [0x2a2d33, 0.8, 0.05], metal: [0xb8c0c8, 0.35, 0.75], dark: [0x1d2026, 0.5, 0.6], glow: 0x9be7ff },
    { id: "gut", ko: "거트 나이프", en: "Gut knife", rar: 1, only: "knife", model: "gut", keep: ["chrome"], body: [0x3a4a30, 0.85, 0.05], metal: [0xc9d1d9, 0.3, 0.75], dark: [0x2e4a2a, 0.9, 0.05], glow: 0xb2ff59 },
    { id: "bowie", ko: "보위 나이프", en: "Bowie knife", rar: 2, only: "knife", model: "bowie", keep: ["brass", "tan", "woodDark", "chrome"], body: [0x3b2a1e, 0.7, 0.05], metal: [0xdfe5ea, 0.25, 0.85], dark: [0x15171c, 0.6, 0.3], glow: 0xffb74d },
    { id: "kunai", ko: "쿠나이", en: "Kunai", rar: 3, only: "knife", model: "kunai", keep: ["chrome"], body: [0x111216, 0.6, 0.3], metal: [0x9aa3ad, 0.32, 0.85], dark: [0x4a1030, 0.85, 0.05], glow: 0xff2bd6 },
    { id: "stiletto", ko: "스틸레토", en: "Stiletto", rar: 4, only: "knife", model: "stiletto", keep: ["chrome"], body: [0x0e0f12, 0.35, 0.6], metal: [0xe8edf2, 0.15, 0.95], dark: [0x3a2c10, 0.3, 0.85], glow: 0xffd54f, anim: "pulse" },
    // six more (after the knives, so the numbers sent to a room stay the same): drawn at 512 px,
    // the patterns join up at the edges, the bodies lacquered
    { id: "koi", ko: "비단잉어", en: "Koi", rar: 3, res: 512, tile: 0.42, pat: "koi", pal: ["#06303a", "#0f5560", "#ff7a1f", "#fff6ea", "#d7261e", "#e9c46a", "#1f5a33"], body: [0xffffff, 0.32, 0.08], coat: [1, 0.08], metal: [0xd4af37, 0.24, 0.95], dark: [0x0a262c, 0.6, 0.3], glow: 0xff8a3d },
    { id: "kintsugi", ko: "금이음", en: "Kintsugi", rar: 3, res: 512, tile: 0.34, pat: "kintsugi", em: !0, anim: "pulse", pal: ["#0f0f12", "#202027", "#d4a73a", "#ffe9a8"], body: [0xffffff, 0.42, 0.1], coat: [0.7, 0.25], metal: [0xd4a73a, 0.22, 1], dark: [0x0c0c0e, 0.7, 0.2], glow: 0xffd166 },
    { id: "prism", ko: "프리즘", en: "Prism", rar: 3, res: 512, tile: 0.3, pat: "facet", pal: ["#2b1055", "#5a4fcf", "#00d4c8", "#f6d365", "#ff6fb5"], body: [0xffffff, 0.28, 0.35], coat: [1, 0.05], metal: [0xc7ccff, 0.2, 0.9], dark: [0x1a1033, 0.5, 0.4], glow: 0x00e5d0 },
    { id: "abyss", ko: "심해", en: "Abyss", rar: 4, res: 512, tile: 0.4, pat: "abyss", em: !0, anim: "pulse", pal: ["#020c1a", "#06264a", "#2ef2ff", "#ff4fd8", "#b8f7ff"], body: [0xffffff, 0.38, 0.2], coat: [1, 0.12], metal: [0x1d3b5a, 0.3, 0.85], dark: [0x020a14, 0.7, 0.2], glow: 0x2ef2ff },
    { id: "synth", ko: "신스웨이브", en: "Synthwave", rar: 4, res: 512, tile: 0.34, vOff: 0.24, pat: "synth", em: !0, anim: "pulse", pal: ["#1a0633", "#ff2e88", "#ffb347", "#12001f", "#ff3cf0", "#fff27a"], body: [0xffffff, 0.35, 0.2], coat: [0.8, 0.1], metal: [0x3a1a5a, 0.3, 0.85], dark: [0x12001f, 0.6, 0.3], glow: 0xff2e88 },
    { id: "opal", ko: "오팔", en: "Opal", rar: 4, res: 512, tile: 0.3, pat: "opal", em: !0, pal: ["#dfe9f3", "#bcd0e6", "#efe4ff"], body: [0xffffff, 0.22, 0.1], coat: [1, 0.04], irid: [1, 1.35], metal: [0xe6eef8, 0.12, 1], dark: [0x2a3442, 0.4, 0.5], glow: 0x9ad1ff, glass: 0xe0f0ff },
    // the season's own skin (excl): no pull and no shop; finishing a season at gold or above
    { id: "laurel", ko: "월계관", en: "Laurel", rar: 4, excl: "season", res: 512, tile: 0.36, pat: "laurel", em: !0, anim: "pulse", pal: ["#062418", "#0d3d2a", "#d4af37", "#fff1b8", "#fff6d6", "#c62828"], body: [0xffffff, 0.3, 0.2], coat: [1, 0.06], metal: [0xd4af37, 0.18, 1], dark: [0x072016, 0.5, 0.45], glow: 0xffd54f },
  ];
  // Append only: the numeric indices already sent to rooms must stay stable.
  SKINS.push(
    { id: "champions_atk", ko: "챔피언스 팬텀 · 공격", en: "Champions Phantom · Attack", rar: 5, excl: "coins", only: "carbine", body: [0x21171c, 0.3, 0.65], metal: [0xdfbc77, 0.23, 0.95], dark: [0x100b10, 0.5, 0.4], glow: 0xff405d, anim: "pulse" },
    { id: "champions_def", ko: "챔피언스 팬텀 · 수비", en: "Champions Phantom · Defense", rar: 5, excl: "coins", only: "carbine", body: [0xf2e7ce, 0.3, 0.55], metal: [0xdfbc77, 0.23, 0.95], dark: [0x22252a, 0.5, 0.4], glow: 0xffe5a3, anim: "pulse" },
  );
  // which skins a gun can wear
  const fits = (s, key) => !s.gone && (!s.only || s.only === key);
  // (shown by tier: the second set sits after the knives in the list)
  const skinsFor = (key) => SKINS.filter((s) => fits(s, key)).sort((a, b) => a.rar - b.rar || a.i - b.i);
  // a gun in a skin: the knife skins that are other knives have builds of their own
  const KNIFE0 = GUN_BUILD.knife;
  function buildFor(key, skin) {
    const K = window.KNIVES;
    if ("knife" === key) {
      if (skin && skin.model && K && K.build[skin.model]) return K.build[skin.model]();
      return K && K.build.stock ? K.build.stock() : KNIFE0 ? KNIFE0() : null;
    }
    return GUN_BUILD[key] ? GUN_BUILD[key]() : null;
  }
  // my own hands: the game builds the knife through GUN_BUILD
  GUN_BUILD.knife = () => buildFor("knife", mySkin("knife"));
  const BY = {};
  SKINS.forEach((s, i) => ((BY[s.id] = s), (s.i = i)));
  const skinById = (id) => BY[id] || SKINS[0];
  const nameOf = (s) => (EN ? s.en : s.ko);

  // ── 3. patterns, painted once each ──
  // a seeded random, and a drawer that repeats a shape across the tile's edges so the tiles join
  const rng = (seed) => {
    let s = seed;
    return () => ((s = (s * 16807) % 2147483647) / 2147483647);
  };
  const wrapper = (W, H) => (x, y, r, draw) => {
    for (const dx of [-W, 0, W]) for (const dy of [-H, 0, H]) x + dx + r > 0 && x + dx - r < W && y + dy + r > 0 && y + dy - r < H && draw(x + dx, y + dy);
  };
  const PAT = {
    camo(g, W, H, pal) {
      g.fillStyle = pal[0];
      g.fillRect(0, 0, W, H);
      let s = 7;
      const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 22; i++) {
        g.fillStyle = pal[1 + ((i * 7) % 3)];
        g.beginPath();
        const x = r() * W,
          y = r() * H,
          n = 5 + ((i * 3) % 4);
        for (let k = 0; k <= n; k++) {
          const a = (k / n) * Math.PI * 2,
            rr = W * (0.14 + 0.16 * r());
          k ? g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8) : g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8);
        }
        g.closePath();
        g.fill();
      }
    },
    digi(g, W, H, pal) {
      g.fillStyle = pal[0];
      g.fillRect(0, 0, W, H);
      let s = 11;
      const r = () => ((s = (s * 48271) % 2147483647) / 2147483647);
      const c = W / 8;
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) {
          const v = r();
          if (v < 0.55) continue;
          g.fillStyle = pal[1 + Math.floor((v - 0.55) * 6.6) % 3];
          g.fillRect(x * c, y * c, c * (1 + (r() < 0.4 ? 1 : 0)), c);
        }
    },
    carbon(g, W, H, pal) {
      g.fillStyle = pal[0];
      g.fillRect(0, 0, W, H);
      const c = W / 10;
      for (let y = 0; y < 10; y++)
        for (let x = 0; x < 10; x++) {
          const h = (x + y) % 2;
          const grad = g.createLinearGradient(x * c, y * c, h ? x * c + c : x * c, h ? y * c : y * c + c);
          grad.addColorStop(0, pal[2]);
          grad.addColorStop(0.5, pal[1]);
          grad.addColorStop(1, pal[2]);
          g.fillStyle = grad;
          g.fillRect(x * c + 0.5, y * c + 0.5, c - 1, c - 1);
        }
    },
    stripes(g, W, H, pal) {
      g.fillStyle = pal[0];
      g.fillRect(0, 0, W, H);
      g.strokeStyle = pal[1];
      g.lineCap = "round";
      for (let i = -1; i < 6; i++) {
        g.lineWidth = W * (0.06 + 0.05 * ((i * 5) % 3));
        g.beginPath();
        g.moveTo(i * W * 0.22, -10);
        g.bezierCurveTo(i * W * 0.22 + W * 0.14, H * 0.3, i * W * 0.22 - W * 0.14, H * 0.7, i * W * 0.22 + W * 0.08, H + 10);
        g.stroke();
      }
      g.strokeStyle = pal[2];
      g.lineWidth = W * 0.02;
      for (let i = 0; i < 4; i++) {
        g.beginPath();
        g.moveTo(i * W * 0.27 + W * 0.09, -10);
        g.lineTo(i * W * 0.27 - W * 0.03, H + 10);
        g.stroke();
      }
    },
    petals(g, W, H, pal) {
      g.fillStyle = pal[0];
      g.fillRect(0, 0, W, H);
      let s = 5;
      const r = () => ((s = (s * 69621) % 2147483647) / 2147483647);
      for (let i = 0; i < 12; i++) {
        const x = r() * W,
          y = r() * H,
          a = r() * Math.PI,
          k = W * (0.06 + 0.06 * r());
        g.save();
        g.translate(x, y);
        g.rotate(a);
        g.fillStyle = i % 3 ? pal[1] : pal[3];
        for (let p = 0; p < 5; p++) {
          g.rotate((Math.PI * 2) / 5);
          g.beginPath();
          g.ellipse(0, k, k * 0.55, k, 0, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = pal[2];
        g.beginPath();
        g.arc(0, 0, k * 0.3, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    },
    crackle(g, W, H, pal) {
      const grad = g.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, pal[2]);
      grad.addColorStop(0.5, pal[0]);
      grad.addColorStop(1, pal[1]);
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);
      g.strokeStyle = pal[3];
      g.lineWidth = 1.2;
      let s = 3;
      const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 18; i++) {
        let x = r() * W,
          y = r() * H;
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 6; k++) {
          x += (r() - 0.5) * W * 0.35;
          y += (r() - 0.5) * H * 0.35;
          g.lineTo(x, y);
        }
        g.stroke();
      }
    },
    dancheong(g, W, H, pal) {
      const band = H / 5;
      [pal[0], pal[4], pal[1], pal[4], pal[2]].forEach((c, i) => {
        g.fillStyle = c;
        g.fillRect(0, i * band, W, band);
      });
      g.fillStyle = pal[3];
      for (let i = 0; i < 8; i++) {
        const x = (i + 0.5) * (W / 8);
        [0, 2, 4].forEach((row) => {
          const y = row * band + band / 2;
          g.beginPath();
          g.moveTo(x, y - band * 0.36);
          g.lineTo(x + band * 0.3, y);
          g.lineTo(x, y + band * 0.36);
          g.lineTo(x - band * 0.3, y);
          g.closePath();
          g.fill();
        });
      }
      g.fillStyle = pal[1];
      for (let i = 0; i < 8; i++) {
        const x = (i + 0.5) * (W / 8);
        [1, 3].forEach((row) => {
          g.beginPath();
          g.arc(x, row * band + band / 2, band * 0.22, 0, Math.PI * 2);
          g.fill();
        });
      }
    },
    ink(g, W, H, pal) {
      g.fillStyle = pal[0];
      g.fillRect(0, 0, W, H);
      let s = 9;
      const r = () => ((s = (s * 48271) % 2147483647) / 2147483647);
      g.fillStyle = pal[1];
      for (let i = 0; i < 5; i++) {
        const x = r() * W,
          y = r() * H,
          k = W * (0.08 + 0.14 * r());
        g.beginPath();
        g.ellipse(x, y, k, k * (0.6 + 0.6 * r()), r() * Math.PI, 0, Math.PI * 2);
        g.fill();
        for (let d = 0; d < 7; d++) {
          const a = r() * Math.PI * 2,
            L = k * (1.1 + 1.6 * r());
          g.beginPath();
          g.arc(x + Math.cos(a) * L, y + Math.sin(a) * L, k * 0.12 * (0.5 + r()), 0, Math.PI * 2);
          g.fill();
        }
      }
      g.strokeStyle = pal[2];
      g.lineWidth = W * 0.012;
      g.beginPath();
      g.moveTo(0, H * 0.72);
      g.bezierCurveTo(W * 0.3, H * 0.55, W * 0.6, H * 0.9, W, H * 0.68);
      g.stroke();
    },
    // the glowing lines of the neon and lava skins are painted on their own
    // canvas: the base map stays dark, the emissive map carries the light
    grid(g, W, H, pal, em) {
      if (!em) {
        g.fillStyle = pal[0];
        g.fillRect(0, 0, W, H);
        return;
      }
      g.fillStyle = "#000";
      g.fillRect(0, 0, W, H);
      g.lineWidth = W * 0.028;
      const c = W / 3;
      g.strokeStyle = pal[1];
      for (let i = 0; i <= 3; i++) {
        g.beginPath();
        g.moveTo(i * c, 0);
        g.lineTo(i * c, H);
        g.stroke();
      }
      g.strokeStyle = pal[2];
      for (let i = 0; i <= 3; i++) {
        g.beginPath();
        g.moveTo(0, i * c);
        g.lineTo(W, i * c);
        g.stroke();
      }
    },
    cracks(g, W, H, pal, em) {
      g.fillStyle = em ? "#000" : pal[0];
      g.fillRect(0, 0, W, H);
      let s = 21;
      const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 7; i++) {
        let x = r() * W,
          y = r() * H;
        g.strokeStyle = em ? (i % 3 ? pal[1] : pal[2]) : "#2a1f1a";
        g.lineWidth = W * (em ? 0.022 : 0.034);
        g.lineCap = "round";
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 6; k++) {
          x += (r() - 0.5) * W * 0.45;
          y += (r() - 0.5) * H * 0.45;
          g.lineTo(x, y);
        }
        g.stroke();
      }
    },
    galaxy(g, W, H, pal, em) {
      if (em) {
        g.fillStyle = "#000";
        g.fillRect(0, 0, W, H);
      } else {
        const grad = g.createLinearGradient(0, 0, W, H);
        grad.addColorStop(0, pal[0]);
        grad.addColorStop(0.45, pal[1]);
        grad.addColorStop(0.7, pal[2]);
        grad.addColorStop(1, pal[0]);
        g.fillStyle = grad;
        g.fillRect(0, 0, W, H);
        const rg = g.createRadialGradient(W * 0.6, H * 0.4, 0, W * 0.6, H * 0.4, W * 0.5);
        rg.addColorStop(0, pal[3] + "66");
        rg.addColorStop(1, pal[3] + "00");
        g.fillStyle = rg;
        g.fillRect(0, 0, W, H);
      }
      let s = 33;
      const r = () => ((s = (s * 48271) % 2147483647) / 2147483647);
      for (let i = 0; i < 40; i++) {
        const x = r() * W,
          y = r() * H,
          k = (i % 7 ? 1.2 : 3) * (W / 256);
        g.fillStyle = em ? (i % 4 ? "#fff" : pal[3]) : "#ffffffcc";
        g.beginPath();
        g.arc(x, y, k, 0, Math.PI * 2);
        g.fill();
      }
    },
    // ── patterns of the second set ──
    marble(g, W, H, pal) {
      g.fillStyle = pal[0];
      g.fillRect(0, 0, W, H);
      let s = 21;
      const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 9; i++) {
        let x = r() * W,
          y = -10;
        g.strokeStyle = i % 3 ? pal[1] : pal[2];
        g.globalAlpha = 0.35 + 0.5 * r();
        g.lineWidth = W * (0.004 + 0.012 * r());
        g.beginPath();
        g.moveTo(x, y);
        while (y < H + 10) {
          const nx = x + (r() - 0.5) * W * 0.22,
            ny = y + H * (0.08 + 0.1 * r());
          g.quadraticCurveTo(x + (r() - 0.5) * W * 0.3, (y + ny) / 2, nx, ny);
          x = nx;
          y = ny;
        }
        g.stroke();
      }
      g.globalAlpha = 1;
    },
    hex(g, W, H, pal, em) {
      g.fillStyle = em ? "#000" : pal[0];
      g.fillRect(0, 0, W, H);
      const R = W / 4 / Math.sqrt(3),
        dx = W / 4,
        dy = R * 1.5;
      let s = 9;
      const r = () => ((s = (s * 48271) % 2147483647) / 2147483647);
      for (let row = -1; row * dy < H + R; row++)
        for (let col = -1; col * dx < W + dx; col++) {
          const cx = col * dx + (row % 2 ? dx / 2 : 0),
            cy = row * dy;
          g.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = Math.PI / 6 + (k * Math.PI) / 3;
            k ? g.lineTo(cx + R * 0.9 * Math.cos(a), cy + R * 0.9 * Math.sin(a)) : g.moveTo(cx + R * 0.9 * Math.cos(a), cy + R * 0.9 * Math.sin(a));
          }
          g.closePath();
          const lit = r() < 0.3;
          if (lit || !em) {
            g.fillStyle = lit ? pal[2] : pal[1];
            em || g.fill();
            lit && em && g.fill();
          }
          g.strokeStyle = em ? pal[2] : pal[3] || pal[0];
          g.lineWidth = W * 0.008;
          em || g.stroke();
        }
    },
    wave(g, W, H, pal) {
      // the old blue-sea wave (청해파): rows of scales of rings
      g.fillStyle = pal[0];
      g.fillRect(0, 0, W, H);
      const R = W / 4;
      for (let row = -1; row < (H / R) * 2 + 2; row++)
        for (let col = -1; col < W / (2 * R) + 2; col++) {
          const cx = col * 2 * R + (row % 2 ? R : 0),
            cy = row * R * 0.5;
          for (let k = 5; k >= 1; k--) {
            g.fillStyle = k % 2 ? pal[1] : pal[2];
            g.beginPath();
            g.arc(cx, cy, (R * k) / 5, Math.PI, 0);
            g.closePath();
            g.fill();
          }
        }
    },
    circuit(g, W, H, pal, em) {
      g.fillStyle = em ? "#000" : pal[0];
      g.fillRect(0, 0, W, H);
      let s = 17;
      const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      const c = W / 16;
      g.lineCap = "round";
      for (let i = 0; i < 26; i++) {
        let x = Math.floor(r() * 16) * c + c / 2,
          y = Math.floor(r() * 16) * c + c / 2;
        g.strokeStyle = i % 4 ? pal[1] : pal[2];
        g.lineWidth = W * (em ? 0.008 : 0.012);
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 4; k++) {
          const d = Math.floor(r() * 4),
            n = (1 + Math.floor(r() * 4)) * c;
          x += [n, -n, 0, 0][d];
          y += [0, 0, n, -n][d];
          g.lineTo(x, y);
        }
        g.stroke();
        g.fillStyle = pal[2];
        g.beginPath();
        g.arc(x, y, c * 0.28, 0, Math.PI * 2);
        g.fill();
      }
    },
    scale(g, W, H, pal) {
      // dragon scales: overlapping shields, light at the top
      g.fillStyle = pal[3];
      g.fillRect(0, 0, W, H);
      const R = W / 5;
      for (let row = -1; row < (H / R) * 1.6 + 2; row++)
        for (let col = -1; col < W / (2 * R) + 2; col++) {
          const cx = col * 2 * R + (row % 2 ? R : 0),
            cy = row * R * 0.62;
          const gr = g.createRadialGradient(cx, cy - R * 0.4, R * 0.1, cx, cy, R * 1.1);
          gr.addColorStop(0, pal[2]);
          gr.addColorStop(0.7, pal[1]);
          gr.addColorStop(1, pal[3]);
          g.fillStyle = gr;
          g.beginPath();
          g.moveTo(cx - R, cy - R * 0.2);
          g.quadraticCurveTo(cx - R, cy + R * 0.9, cx, cy + R);
          g.quadraticCurveTo(cx + R, cy + R * 0.9, cx + R, cy - R * 0.2);
          g.closePath();
          g.fill();
          g.strokeStyle = pal[0];
          g.lineWidth = W * 0.006;
          g.stroke();
        }
    },
    aurora(g, W, H, pal, em) {
      g.fillStyle = em ? "#000" : pal[0];
      g.fillRect(0, 0, W, H);
      for (let b = 0; b < 4; b++) {
        const col = pal[1 + (b % 3)];
        for (let x = 0; x < W; x += 2) {
          const y0 = H * (0.18 + 0.2 * b) + Math.sin((x / W) * Math.PI * 2 * (1 + (b % 2)) + b) * H * 0.08,
            h = H * (0.18 + 0.06 * Math.sin((x / W) * Math.PI * 4 + b * 2));
          const gr = g.createLinearGradient(0, y0, 0, y0 + h);
          gr.addColorStop(0, col + "00");
          gr.addColorStop(0.35, col + (em ? "cc" : "aa"));
          gr.addColorStop(1, col + "00");
          g.fillStyle = gr;
          g.fillRect(x, y0, 2, h);
        }
      }
    },
    flame(g, W, H, pal, em) {
      g.fillStyle = em ? "#000" : pal[0];
      g.fillRect(0, 0, W, H);
      let s = 13;
      const r = () => ((s = (s * 48271) % 2147483647) / 2147483647);
      for (let i = 0; i < 18; i++) {
        const x = r() * W,
          base = H * (0.55 + 0.5 * r()),
          w = W * (0.07 + 0.08 * r()),
          h = H * (0.3 + 0.35 * r());
        for (let k = 0; k < 3; k++) {
          const f = 1 - k * 0.3;
          g.fillStyle = pal[1 + k];
          g.beginPath();
          g.moveTo(x - w * f, base);
          g.bezierCurveTo(x - w * f, base - h * f * 0.5, x + w * 0.6 * f, base - h * f * 0.6, x + w * 0.1, base - h * f);
          g.bezierCurveTo(x + w * f * 0.2, base - h * f * 0.55, x + w * f, base - h * f * 0.4, x + w * f, base);
          g.closePath();
          g.fill();
        }
      }
    },
    storm(g, W, H, pal, em) {
      if (em) {
        g.fillStyle = "#000";
        g.fillRect(0, 0, W, H);
      } else {
        const gr = g.createLinearGradient(0, 0, W, H);
        gr.addColorStop(0, pal[0]);
        gr.addColorStop(0.5, pal[3]);
        gr.addColorStop(1, pal[0]);
        g.fillStyle = gr;
        g.fillRect(0, 0, W, H);
      }
      let s = 29;
      const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      g.lineJoin = "miter";
      for (let i = 0; i < 6; i++) {
        let x = r() * W,
          y = -5;
        const pts = [[x, y]];
        while (y < H + 5) {
          x += (r() - 0.5) * W * 0.16;
          y += H * (0.05 + 0.08 * r());
          pts.push([x, y]);
        }
        for (const [lw, col] of [
          [W * 0.02, pal[1] + (em ? "66" : "55")],
          [W * 0.006, pal[2]],
        ]) {
          g.strokeStyle = col;
          g.lineWidth = lw;
          g.beginPath();
          pts.forEach(([px, py], k) => (k ? g.lineTo(px, py) : g.moveTo(px, py)));
          g.stroke();
        }
      }
    },
    // ── the newest patterns, drawn at 512 px; anything near an edge is drawn again on the far side, so the tiles join ──
    koi(g, W, H, pal) {
      const R = rng(71),
        wrap = wrapper(W, H);
      const bg = g.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, pal[0]);
      bg.addColorStop(0.5, pal[1]);
      bg.addColorStop(1, pal[0]);
      g.fillStyle = bg;
      g.fillRect(0, 0, W, H);
      // ripples
      for (let i = 0; i < 9; i++) {
        const x = R() * W,
          y = R() * H;
        wrap(x, y, W * 0.2, (cx, cy) => {
          for (let k = 1; k <= 3; k++) {
            g.strokeStyle = `rgba(255,255,255,${0.09 - k * 0.02})`;
            g.lineWidth = W * 0.004;
            g.beginPath();
            g.ellipse(cx, cy, W * 0.05 * k, H * 0.035 * k, 0, 0, 2 * Math.PI);
            g.stroke();
          }
        });
      }
      // lily pads
      for (let i = 0; i < 4; i++) {
        const x = R() * W,
          y = R() * H,
          r = W * (0.06 + 0.03 * R()),
          a = R() * 6.28;
        wrap(x, y, r, (cx, cy) => {
          g.fillStyle = pal[6];
          g.beginPath();
          g.moveTo(cx, cy);
          g.arc(cx, cy, r, a + 0.35, a + 2 * Math.PI - 0.35);
          g.closePath();
          g.fill();
          g.strokeStyle = "rgba(0,0,0,.25)";
          g.lineWidth = W * 0.003;
          for (let k = 0; k < 7; k++) {
            const b = a + 0.5 + k * 0.78;
            g.beginPath();
            g.moveTo(cx, cy);
            g.lineTo(cx + Math.cos(b) * r * 0.9, cy + Math.sin(b) * r * 0.9);
            g.stroke();
          }
        });
      }
      // the fish: a white body with orange and red patches, fins and a forked tail
      const fish = (cx, cy, ang, L, hue) => {
        g.save();
        g.translate(cx, cy);
        g.rotate(ang);
        g.fillStyle = "rgba(0,0,0,.22)";
        g.beginPath();
        g.ellipse(L * 0.04, L * 0.05, L * 0.48, L * 0.13, 0, 0, 2 * Math.PI);
        g.fill();
        const body = new Path2D();
        body.moveTo(L * 0.5, 0);
        body.bezierCurveTo(L * 0.42, -L * 0.15, -L * 0.1, -L * 0.17, -L * 0.42, -L * 0.03);
        body.lineTo(-L * 0.42, L * 0.03);
        body.bezierCurveTo(-L * 0.1, L * 0.17, L * 0.42, L * 0.15, L * 0.5, 0);
        // tail and fins, a little see-through
        g.fillStyle = "rgba(255,240,225,.75)";
        g.beginPath();
        g.moveTo(-L * 0.4, 0);
        g.quadraticCurveTo(-L * 0.6, -L * 0.22, -L * 0.72, -L * 0.2);
        g.quadraticCurveTo(-L * 0.6, 0, -L * 0.72, L * 0.2);
        g.quadraticCurveTo(-L * 0.6, L * 0.22, -L * 0.4, 0);
        g.fill();
        for (const sy of [-1, 1]) {
          g.beginPath();
          g.moveTo(L * 0.2, sy * L * 0.1);
          g.quadraticCurveTo(L * 0.1, sy * L * 0.3, -L * 0.02, sy * L * 0.24);
          g.quadraticCurveTo(L * 0.06, sy * L * 0.14, L * 0.2, sy * L * 0.1);
          g.fill();
        }
        g.fillStyle = pal[3];
        g.fill(body);
        g.save();
        g.clip(body);
        g.fillStyle = hue;
        for (let k = 0; k < 3; k++) {
          g.beginPath();
          g.ellipse(L * (0.3 - 0.28 * k), (k % 2 ? 1 : -1) * L * 0.05, L * (0.13 + 0.03 * k), L * 0.11, 0.4 * k, 0, 2 * Math.PI);
          g.fill();
        }
        // scales: a light sheen along the back
        const sh = g.createLinearGradient(0, -L * 0.15, 0, L * 0.15);
        sh.addColorStop(0, "rgba(255,255,255,.35)");
        sh.addColorStop(0.5, "rgba(255,255,255,0)");
        sh.addColorStop(1, "rgba(0,0,0,.18)");
        g.fillStyle = sh;
        g.fill(body);
        g.restore();
        g.fillStyle = "#111";
        g.beginPath();
        g.arc(L * 0.4, -L * 0.05, L * 0.018, 0, 2 * Math.PI);
        g.arc(L * 0.4, L * 0.05, L * 0.018, 0, 2 * Math.PI);
        g.fill();
        g.restore();
      };
      for (let i = 0; i < 6; i++) {
        const x = R() * W,
          y = R() * H,
          L = W * (0.2 + 0.08 * R()),
          a = R() * 6.28,
          hue = i % 3 ? pal[2] : pal[4];
        wrap(x, y, L * 0.75, (cx, cy) => fish(cx, cy, a, L, hue));
      }
      // gold leaf
      for (let i = 0; i < 70; i++) {
        const x = R() * W,
          y = R() * H,
          s = W * (0.004 + 0.008 * R());
        g.fillStyle = pal[5];
        g.globalAlpha = 0.5 + 0.4 * R();
        g.save();
        g.translate(x, y);
        g.rotate(R() * 3);
        g.fillRect(-s, -s * 0.6, 2 * s, 1.2 * s);
        g.restore();
      }
      g.globalAlpha = 1;
    },
    kintsugi(g, W, H, pal, em) {
      const R = rng(37),
        wrap = wrapper(W, H);
      if (em) {
        g.fillStyle = "#000";
        g.fillRect(0, 0, W, H);
      } else {
        g.fillStyle = pal[0];
        g.fillRect(0, 0, W, H);
        // the glaze: soft mottling
        for (let i = 0; i < 260; i++) {
          const x = R() * W,
            y = R() * H,
            r = W * (0.01 + 0.05 * R());
          wrap(x, y, r, (cx, cy) => {
            const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
            gr.addColorStop(0, R() < 0.5 ? "rgba(60,60,70,.16)" : "rgba(0,0,0,.2)");
            gr.addColorStop(1, "rgba(0,0,0,0)");
            g.fillStyle = gr;
            g.fillRect(cx - r, cy - r, 2 * r, 2 * r);
          });
        }
      }
      // the mended cracks: gold seams that wander and branch
      const seams = [];
      const walk = (x, y, a, n, w) => {
        const pts = [[x, y]];
        for (let i = 0; i < n; i++) {
          a += (R() - 0.5) * 0.9;
          x += Math.cos(a) * W * 0.03;
          y += Math.sin(a) * H * 0.03;
          pts.push([x, y]);
          if (R() < 0.12 && w > 0.4) walk(x, y, a + (R() < 0.5 ? 1 : -1) * (0.6 + R()), (n - i) * 0.6, w * 0.6);
        }
        seams.push({ pts, w });
      };
      for (let i = 0; i < 6; i++) walk(R() * W, R() * H, R() * 6.28, 16 + R() * 14, 1);
      for (const { pts, w } of seams) {
        const xs = pts.map((p) => p[0]),
          ys = pts.map((p) => p[1]),
          cx = (Math.min(...xs) + Math.max(...xs)) / 2,
          cy = (Math.min(...ys) + Math.max(...ys)) / 2,
          rad = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2 + W * 0.02;
        wrap(cx, cy, rad, (ox, oy) => {
          const dx = ox - cx,
            dy = oy - cy;
          for (const [lw, col] of em
            ? [[W * 0.03 * w, "rgba(212,167,58,.35)"], [W * 0.011 * w, pal[2]], [W * 0.004 * w, pal[3]]]
            : [[W * 0.016 * w, "#6b4d12"], [W * 0.011 * w, pal[2]], [W * 0.004 * w, pal[3]]]) {
            g.strokeStyle = col;
            g.lineWidth = lw;
            g.lineCap = g.lineJoin = "round";
            g.beginPath();
            pts.forEach(([x, y], k) => (k ? g.lineTo(x + dx, y + dy) : g.moveTo(x + dx, y + dy)));
            g.stroke();
          }
        });
      }
    },
    facet(g, W, H, pal) {
      // a low-poly field: a jittered grid that repeats, each triangle a shade between the palette's colours
      const R = rng(19),
        N = 7,
        J = [];
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) J.push([(R() - 0.5) * 0.7, (R() - 0.5) * 0.7]);
      const P = (i, j) => {
        const q = J[(((j % N) + N) % N) * N + (((i % N) + N) % N)];
        return [((i + 0.5 + q[0]) * W) / N, ((j + 0.5 + q[1]) * H) / N];
      };
      const mix = (a, b, t) => {
        const A = parseInt(a.slice(1), 16),
          B = parseInt(b.slice(1), 16);
        const c = (s) => Math.round(((A >> s) & 255) * (1 - t) + ((B >> s) & 255) * t);
        return [c(16), c(8), c(0)];
      };
      for (let j = -1; j <= N; j++)
        for (let i = -1; i <= N; i++) {
          const a = P(i, j),
            b = P(i + 1, j),
            c = P(i, j + 1),
            d = P(i + 1, j + 1);
          for (const tri of [[a, b, d], [a, d, c]]) {
            const mx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3,
              my = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
            // the colour runs round the tile, so it joins up at the edges
            const t = (Math.sin((mx / W) * 2 * Math.PI) + Math.cos((my / H) * 2 * Math.PI) + 2) / 4,
              k = Math.min(pal.length - 2, Math.floor(t * (pal.length - 1))),
              f = t * (pal.length - 1) - k,
              [r, gg, bb] = mix(pal[k], pal[k + 1], f),
              l = 0.68 + 0.42 * R();
            g.fillStyle = `rgb(${Math.min(255, r * l) | 0},${Math.min(255, gg * l) | 0},${Math.min(255, bb * l) | 0})`;
            g.beginPath();
            g.moveTo(tri[0][0], tri[0][1]);
            g.lineTo(tri[1][0], tri[1][1]);
            g.lineTo(tri[2][0], tri[2][1]);
            g.closePath();
            g.fill();
            g.strokeStyle = "rgba(255,255,255,.16)";
            g.lineWidth = W * 0.0025;
            g.stroke();
          }
        }
    },
    abyss(g, W, H, pal, em) {
      const R = rng(53),
        wrap = wrapper(W, H);
      if (em) {
        g.fillStyle = "#000";
        g.fillRect(0, 0, W, H);
      } else {
        g.fillStyle = pal[0];
        g.fillRect(0, 0, W, H);
        for (let i = 0; i < 14; i++) {
          const x = R() * W,
            y = R() * H,
            r = W * (0.15 + 0.2 * R());
          wrap(x, y, r, (cx, cy) => {
            const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
            gr.addColorStop(0, pal[1] + "aa");
            gr.addColorStop(1, pal[1] + "00");
            g.fillStyle = gr;
            g.fillRect(cx - r, cy - r, 2 * r, 2 * r);
          });
        }
        // light from far above, broken by the water
        g.strokeStyle = "rgba(120,200,255,.07)";
        g.lineWidth = W * 0.006;
        for (let i = 0; i < 10; i++) {
          const y0 = R() * H;
          g.beginPath();
          for (let x = 0; x <= W; x += W / 32) g.lineTo(x, y0 + Math.sin((x / W) * 2 * Math.PI * 3 + i) * H * 0.02);
          g.stroke();
        }
      }
      // jellyfish: a glowing bell and trailing threads
      for (let i = 0; i < 6; i++) {
        const x = R() * W,
          y = R() * H,
          r = W * (0.05 + 0.04 * R()),
          col = i % 2 ? pal[3] : pal[2],
          ph = R() * 6;
        wrap(x, y, r * 3.5, (cx, cy) => {
          const gr = g.createRadialGradient(cx, cy - r * 0.2, r * 0.1, cx, cy, r * 1.1);
          gr.addColorStop(0, pal[4]);
          gr.addColorStop(0.45, col);
          gr.addColorStop(1, col + "00");
          g.fillStyle = gr;
          g.globalAlpha = em ? 0.95 : 0.8;
          g.beginPath();
          g.ellipse(cx, cy, r, r * 0.8, 0, Math.PI, 2 * Math.PI);
          g.quadraticCurveTo(cx, cy + r * 0.25, cx - r, cy);
          g.fill();
          g.strokeStyle = col;
          g.lineWidth = W * 0.003;
          for (let k = 0; k < 6; k++) {
            const sx = cx - r * 0.8 + (k * r * 1.6) / 5;
            g.globalAlpha = em ? 0.8 : 0.55;
            g.beginPath();
            g.moveTo(sx, cy + r * 0.05);
            for (let t = 1; t <= 10; t++) g.lineTo(sx + Math.sin(t * 0.8 + ph + k) * r * 0.18, cy + t * r * 0.26);
            g.stroke();
          }
          g.globalAlpha = 1;
        });
      }
      // drifting specks
      for (let i = 0; i < 160; i++) {
        const x = R() * W,
          y = R() * H,
          s = W * (0.0015 + 0.004 * R());
        g.fillStyle = R() < 0.7 ? pal[4] : pal[2];
        g.globalAlpha = em ? 0.9 : 0.6;
        g.beginPath();
        g.arc(x, y, s, 0, 2 * Math.PI);
        g.fill();
      }
      g.globalAlpha = 1;
    },
    synth(g, W, H, pal, em) {
      // a sun going down behind a grid: sky above, the grid below
      const hz = H * 0.64;
      if (em) {
        g.fillStyle = "#000";
        g.fillRect(0, 0, W, H);
      } else {
        const sky = g.createLinearGradient(0, 0, 0, hz);
        sky.addColorStop(0, pal[0]);
        sky.addColorStop(0.65, pal[1]);
        sky.addColorStop(1, pal[2]);
        g.fillStyle = sky;
        g.fillRect(0, 0, W, hz);
        const gr = g.createLinearGradient(0, hz, 0, H);
        gr.addColorStop(0, "#2a0040");
        gr.addColorStop(1, pal[3]);
        g.fillStyle = gr;
        g.fillRect(0, hz, W, H - hz);
        // stars
        const R = rng(5);
        g.fillStyle = "#fff";
        for (let i = 0; i < 40; i++) {
          g.globalAlpha = 0.3 + 0.6 * R();
          g.fillRect(R() * W, R() * hz * 0.5, W * 0.003, W * 0.003);
        }
        g.globalAlpha = 1;
      }
      // the sun, cut by bars that thicken toward the horizon
      const sr = W * 0.3,
        sx = W / 2,
        sy = hz - sr * 0.15;
      g.save();
      g.beginPath();
      g.rect(0, 0, W, hz);
      g.clip();
      const sun = g.createLinearGradient(0, sy - sr, 0, sy + sr);
      sun.addColorStop(0, pal[5]);
      sun.addColorStop(0.6, pal[2]);
      sun.addColorStop(1, pal[1]);
      g.fillStyle = sun;
      g.globalAlpha = em ? 0.9 : 1;
      g.beginPath();
      g.arc(sx, sy, sr, 0, 2 * Math.PI);
      g.fill();
      g.globalAlpha = 1;
      g.globalCompositeOperation = "destination-out";
      for (let k = 0; k < 6; k++) {
        const y = sy + sr * (0.05 + k * 0.17),
          h = sr * (0.025 + k * 0.018);
        g.fillRect(sx - sr, y, 2 * sr, h);
      }
      g.globalCompositeOperation = "source-over";
      if (!em) {
        // what was cut out shows the sky again
        g.globalCompositeOperation = "destination-over";
        const sky = g.createLinearGradient(0, 0, 0, hz);
        sky.addColorStop(0, pal[0]);
        sky.addColorStop(0.65, pal[1]);
        sky.addColorStop(1, pal[2]);
        g.fillStyle = sky;
        g.fillRect(0, 0, W, hz);
        g.globalCompositeOperation = "source-over";
      }
      g.restore();
      // the grid
      g.strokeStyle = pal[4];
      g.shadowColor = pal[4];
      g.shadowBlur = W * 0.02;
      g.lineWidth = W * 0.005;
      g.beginPath();
      g.moveTo(0, hz);
      g.lineTo(W, hz);
      g.stroke();
      g.lineWidth = W * 0.0035;
      for (let k = 1; k <= 8; k++) {
        const y = hz + (H - hz) * Math.pow(k / 8, 1.8);
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(W, y);
        g.stroke();
      }
      for (let k = -8; k <= 8; k++) {
        g.beginPath();
        g.moveTo(W / 2 + k * W * 0.03, hz);
        g.lineTo(W / 2 + k * W * 0.2, H);
        g.stroke();
      }
      g.shadowBlur = 0;
    },
    opal(g, W, H, pal, em) {
      // milky stone with flashes of every colour (the material adds the shimmer that moves with the light)
      const R = rng(97),
        wrap = wrapper(W, H);
      if (em) {
        g.fillStyle = "#000";
        g.fillRect(0, 0, W, H);
      } else {
        g.fillStyle = pal[0];
        g.fillRect(0, 0, W, H);
        for (let i = 0; i < 30; i++) {
          const x = R() * W,
            y = R() * H,
            r = W * (0.08 + 0.15 * R());
          wrap(x, y, r, (cx, cy) => {
            const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
            gr.addColorStop(0, R() < 0.5 ? pal[1] : pal[2]);
            gr.addColorStop(1, "rgba(255,255,255,0)");
            g.fillStyle = gr;
            g.fillRect(cx - r, cy - r, 2 * r, 2 * r);
          });
        }
      }
      for (let i = 0; i < 300; i++) {
        const x = R() * W,
          y = R() * H,
          r = W * (0.014 + 0.045 * R()),
          hue = (R() * 360) | 0,
          n = 5 + ((R() * 3) | 0),
          rot = R() * 6.28;
        const pts = [];
        for (let k = 0; k < n; k++) {
          const a = rot + (k / n) * 2 * Math.PI,
            rr = r * (0.55 + 0.45 * R());
          pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
        }
        wrap(x, y, r, (cx, cy) => {
          g.fillStyle = `hsla(${hue},100%,${em ? 50 : 56}%,${em ? 0.45 : 0.78})`;
          g.beginPath();
          pts.forEach(([px, py], k) => (k ? g.lineTo(cx + px, cy + py) : g.moveTo(cx + px, cy + py)));
          g.closePath();
          g.fill();
        });
      }
    },
    // the season's own skin: gold laurel wreaths on deep green lacquer, a star in each,
    // a red ribbon where the branches meet; fine gold pinstripes between
    laurel(g, W, H, pal, em) {
      const R = rng(53),
        wrap = wrapper(W, H);
      if (em) {
        g.fillStyle = "#000";
        g.fillRect(0, 0, W, H);
      } else {
        const bg = g.createLinearGradient(0, 0, W, H);
        bg.addColorStop(0, pal[0]);
        bg.addColorStop(0.5, pal[1]);
        bg.addColorStop(1, pal[0]);
        g.fillStyle = bg;
        g.fillRect(0, 0, W, H);
        // pinstripes on the diagonal, drawn on both sides of every edge so they join
        g.strokeStyle = "rgba(212,175,55,.16)";
        g.lineWidth = W * 0.004;
        for (let i = -8; i <= 8; i++) {
          const x = (i * W) / 8;
          g.beginPath();
          g.moveTo(x, 0);
          g.lineTo(x + W, H);
          g.stroke();
        }
      }
      const leaf = (x, y, a, L, wd) => {
        g.save();
        g.translate(x, y);
        g.rotate(a);
        g.beginPath();
        g.moveTo(0, 0);
        g.quadraticCurveTo(L * 0.5, -wd, L, 0);
        g.quadraticCurveTo(L * 0.5, wd, 0, 0);
        g.closePath();
        if (em) {
          g.fillStyle = "rgba(255,214,102,.5)";
          g.fill();
        } else {
          g.fillStyle = pal[2];
          g.fill();
          g.strokeStyle = "rgba(60,40,6,.75)";
          g.lineWidth = W * 0.0025;
          g.stroke();
          // the midrib catching the light
          g.strokeStyle = pal[3];
          g.lineWidth = W * 0.002;
          g.beginPath();
          g.moveTo(L * 0.1, 0);
          g.lineTo(L * 0.85, 0);
          g.stroke();
        }
        g.restore();
      };
      const star = (x, y, r) => {
        g.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5,
            q = i % 2 ? r * 0.42 : r;
          i ? g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q) : g.moveTo(x + Math.cos(a) * q, y + Math.sin(a) * q);
        }
        g.closePath();
        g.fillStyle = em ? "rgba(255,240,190,.85)" : pal[4];
        g.fill();
      };
      const wreath = (cx, cy, r) => {
        for (const side of [-1, 1]) {
          // the stem: from the bottom round the side to near the top
          const a0 = Math.PI / 2 + side * 0.32,
            a1 = Math.PI / 2 + side * (Math.PI - 0.42),
            n = 9;
          if (!em) {
            g.strokeStyle = "#6b4d12";
            g.lineWidth = W * 0.006;
            g.beginPath();
            g.arc(cx, cy, r, Math.min(a0, a1), Math.max(a0, a1));
            g.stroke();
          }
          for (let k = 0; k < n; k++) {
            const t = k / (n - 1),
              a = a0 + (a1 - a0) * t,
              px = cx + Math.cos(a) * r,
              py = cy + Math.sin(a) * r,
              tang = a + side * (Math.PI / 2),
              L = r * (0.42 - 0.16 * t);
            leaf(px, py, tang - side * 0.55, L, L * 0.32);
            leaf(px, py, tang + side * 0.55 + Math.PI * 0.12 * side, L * 0.9, L * 0.3);
          }
        }
        star(cx, cy, r * 0.34);
        if (!em) {
          // the ribbon tying the two stems
          g.fillStyle = pal[5];
          for (const s of [-1, 1]) {
            g.beginPath();
            g.moveTo(cx, cy + r * 1.02);
            g.lineTo(cx + s * r * 0.34, cy + r * 1.42);
            g.lineTo(cx + s * r * 0.18, cy + r * 1.46);
            g.closePath();
            g.fill();
          }
          g.beginPath();
          g.arc(cx, cy + r, r * 0.09, 0, 2 * Math.PI);
          g.fill();
        }
      };
      // a staggered grid of wreaths, each a little turned
      const cols = 3,
        rows = 3;
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) {
          const x = ((i + (j % 2) * 0.5 + 0.25) * W) / cols,
            y = ((j + 0.5) * H) / rows,
            r = W * (0.085 + 0.012 * R());
          wrap(x, y, r * 1.6, (cx, cy) => {
            g.save();
            g.translate(cx, cy);
            g.rotate((R() - 0.5) * 0.3);
            wreath(0, 0, r);
            g.restore();
          });
        }
    },
  };
  const TEX = {};
  function texture(skin, em) {
    const key = skin.id + (em ? "|em" : "");
    if (TEX[key]) return TEX[key];
    const cv = document.createElement("canvas");
    const R = skin.res || 256;
    cv.width = cv.height = R;
    const g = cv.getContext("2d");
    PAT[skin.pat](g, R, R, skin.pal, em);
    const t = new T.CanvasTexture(cv);
    t.colorSpace = T.SRGBColorSpace;
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.repeat.set(1, 1);
    t.anisotropy = 4;
    t.userData.keep = !0;
    return (TEX[key] = t);
  }

  // ── 4. one material per skin and class, shared by every gun ──
  const MAT = {};
  const ANIM = []; // materials that move
  function skinMat(skin, cls, orig) {
    const key = skin.id + "|" + cls;
    if (MAT[key]) return MAT[key];
    let m = null;
    if ("body" === cls || "metal" === cls || "dark" === cls) {
      const [c, r, mt] = skin[cls];
      // a lacquer coat (and, for opal, the play of colour) on the newest skins' bodies
      m = "body" === cls && (skin.coat || skin.irid) ? new T.MeshPhysicalMaterial({ color: c, roughness: r, metalness: mt, clearcoat: skin.coat ? skin.coat[0] : 0, clearcoatRoughness: skin.coat ? skin.coat[1] : 0, iridescence: skin.irid ? skin.irid[0] : 0, iridescenceIOR: skin.irid ? skin.irid[1] : 1.3, iridescenceThicknessRange: [120, 520] }) : new T.MeshStandardMaterial({ color: c, roughness: r, metalness: mt });
      if ("body" === cls && skin.pat) {
        m.map = texture(skin);
        if (skin.em) {
          m.emissiveMap = texture(skin, !0);
          m.emissive = new T.Color(0xffffff);
          m.emissiveIntensity = 1.1;
        }
      }
      if ("body" === cls && skin.emis) {
        m.emissive = new T.Color(skin.emis[0]);
        m.emissiveIntensity = skin.emis[1];
      }
      if (skin.anim && ("body" === cls || ("metal" === cls && "hue" === skin.anim))) {
        if ("hue" === skin.anim && !m.emissive.getHex()) m.emissive = new T.Color(0x4080ff);
        if ("hue" === skin.anim) m.emissiveIntensity = "metal" === cls ? 0.3 : 0.35;
        ANIM.push({ m, kind: skin.anim, base: m.emissiveIntensity, map: m.map, seed: Object.keys(MAT).length });
      }
    } else if ("glow" === cls) {
      m = new T.MeshStandardMaterial({ color: skin.glow, emissive: skin.glow, emissiveIntensity: 0.9, roughness: 0.35 });
    } else if ("glass" === cls) {
      m = new T.MeshStandardMaterial({ color: skin.glass || skin.glow, roughness: 0.08, metalness: 0.4, transparent: !0, opacity: 0.85 });
    }
    if (!m) return null;
    m.userData.kind = orig && orig.userData ? orig.userData.kind : cls;
    m.userData.skin = skin.id;
    m.userData.keep = !0;
    return (MAT[key] = m);
  }
  // a painted part's uv is stretched to its real size, so one tile of the
  // pattern covers TILE metres whether the part is a grip or a receiver
  const TILE = 0.16;
  function fitUV(mesh, tile, vOff) {
    tile = tile || TILE;
    // each part starts the pattern where it sits on the gun, so the pattern runs on from part to part
    const ou = (mesh.position.x + mesh.position.z) / tile,
      ov = (vOff || 0) + (0.5 * mesh.position.y) / tile;
    const g = mesh.geometry,
      uv = g && g.attributes.uv;
    if (!uv || g.userData.uvFit === tile) return;
    // (the first fit keeps the original uv, so a part dressed again in another skin is fitted from that)
    g.userData.uv0 = g.userData.uv0 || uv.array.slice();
    uv.array.set(g.userData.uv0);
    g.userData.uvFit = tile;
    const P = g.parameters || {},
      t = g.type;
    let f = null;
    if ("BoxGeometry" === t) {
      const w = P.width || 1,
        h = P.height || 1,
        d = P.depth || 1,
        span = [
          [d, h],
          [d, h],
          [w, d],
          [w, d],
          [w, h],
          [w, h],
        ];
      f = (i) => span[Math.min(5, (i / 4) | 0)];
    } else if ("CylinderGeometry" === t || "ConeGeometry" === t) {
      const r = Math.max(P.radiusTop || 0, P.radiusBottom || 0, P.radius || 0),
        c = [2 * Math.PI * r, P.height || 1];
      f = () => c;
    } else return;
    for (let i = 0; i < uv.count; i++) {
      const [su, sv] = f(i);
      uv.setXY(i, (uv.getX(i) * su) / tile + ou, (uv.getY(i) * sv) / tile + ov);
    }
    uv.needsUpdate = !0;
  }
  // dress a built gun (or anything with GUNMAT parts) in a skin
  function applySkin(root, skin) {
    skin = "string" == typeof skin ? skinById(skin) : skin || SKINS[0];
    if (!root) return root;
    if (window.CHAMPIONS_PHANTOM && CHAMPIONS_PHANTOM.isSkin(skin.id)) return CHAMPIONS_PHANTOM.dress(root, skin);
    if ("default" !== skin.id)
      root.traverse((o) => {
        if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
        const kind = o.material.userData && o.material.userData.kind,
          cls = kind && CLASS[kind];
        if (!cls || (skin.keep && skin.keep.includes(kind))) return;
        const m = skinMat(skin, cls, o.material);
        if (!m) return;
        o.material = m;
        m.map && fitUV(o, skin.tile, skin.vOff);
      });
    root.userData.skin = skin.id;
    return root;
  }
  // the skins that move: lights breathe, the holo sheen cycles, the galaxy drifts
  let animT = 0;
  function animate(dt) {
    if (!ANIM.length) return;
    animT += dt;
    for (const a of ANIM) {
      if ("pulse" === a.kind) a.m.emissiveIntensity = a.base * (0.72 + 0.28 * Math.sin(animT * 2.6 + a.seed));
      else if ("hue" === a.kind) a.m.emissive.setHSL((animT * 0.12 + a.seed * 0.1) % 1, 0.85, 0.55);
      else if ("drift" === a.kind && a.map) a.map.offset.set((animT * 0.02) % 1, (animT * 0.011) % 1);
    }
  }

  // ── 5. the account's collection and gold ──
  // Online, a skin can be worn only once it is owned (a pull in the armoury,
  // or a grant from the owner). Opened from a file, with no account server,
  // everything is free. The last answer is kept on the device so a hiccup in
  // the server does not lock the armoury.
  const AC = () => window.ACCOUNT || null;
  const session = () => {
    try {
      return (AC() && AC().session && AC().session()) || null;
    } catch (e) {
      return null;
    }
  };
  const token = () => {
    const s = session();
    return (s && s.token) || "";
  };
  const isOnline = () => {
    try {
      const o = AC() && AC().online;
      return "function" == typeof o ? !!o() : !!o;
    } catch (e) {
      return !1;
    }
  };
  const INV = { gold: 0, own: {}, items: 0, synced: !1, busy: !1 };
  try {
    const j = JSON.parse(localStorage.getItem("lgp_inv") || "null"),
      me = session() && session().user;
    if (j && j.own && "object" == typeof j.own && me && j.id === me.id) {
      INV.own = j.own;
      INV.gold = +j.gold || 0;
      INV.items = +j.items || 0;
    }
  } catch (e) {}
  const saveInv = () => {
    try {
      const me = session() && session().user;
      localStorage.setItem("lgp_inv", JSON.stringify({ id: me ? me.id : "", own: INV.own, gold: INV.gold, items: INV.items }));
    } catch (e) {}
  };
  const gated = () => isOnline();
  const signed = () => gated() && !!token();
  const owns = (key, id) => "default" === id || (!!BY[id] && fits(BY[id], key) && (!gated() || !!(INV.own[key] && INV.own[key].includes(id))));
  const pullableLeft = () => Object.keys(WEAPONS).reduce((n, key) => n + skinsFor(key).filter((s) => s.rar > 0 && !s.excl && !owns(key, s.id)).length, 0);
  const totalOf = (key) => skinsFor(key).length - 1;
  const ownedOf = (key) => (gated() ? (INV.own[key] || []).filter((id) => BY[id] && fits(BY[id], key)).length : totalOf(key));
  const ownedAll = () => {
    let n = 0;
    for (const k in WEAPONS) n += ownedOf(k);
    return n;
  };
  const itemsAll = () => {
    if (INV.items > 0) return INV.items;
    let n = 0;
    for (const k in WEAPONS) n += totalOf(k);
    return n;
  };
  const GC = () => (window.SERVER_CFG && window.SERVER_CFG.gacha) || {};
  const costOf = (n) => {
    const v = 10 === n ? GC().cost10 : GC().cost1;
    return isFinite(+v) && null != v ? Math.max(0, +v) : 10 === n ? 2700 : 300;
  };

  // ── 5b. my picks ──
  const skinCacheKey = "lgp_skins:" + ((window.ACCOUNT && ACCOUNT.session() && ACCOUNT.session().user.id) || "local");
  const SK = { mine: {}, t: 0 };
  try {
    const j = JSON.parse(localStorage.getItem(skinCacheKey) || "null");
    if (j && j.m) {
      SK.mine = j.m;
      SK.t = +j.t || 0;
    }
  } catch (e) {}
  const save = () => {
    try {
      localStorage.setItem(skinCacheKey, JSON.stringify({ t: SK.t, m: SK.mine }));
    } catch (e) {}
  };
  const clean = (m) => {
    const o = {};
    if (m && "object" == typeof m) for (const k in m) WEAPONS[k] && BY[m[k]] && "default" !== m[k] && fits(BY[m[k]], k) && (o[k] = m[k]);
    return o;
  };
  SK.mine = clean(SK.mine);
  // picks of skins not owned fall back to stock (once the account has answered)
  function enforce() {
    if (!gated() || !INV.synced) return !1;
    let n = 0;
    for (const k in SK.mine) owns(k, SK.mine[k]) || (delete SK.mine[k], n++);
    return n > 0;
  }
  const mySkin = (key) => skinById(SK.mine[key]);
  // the table as sent to a room: skin numbers by gun
  const pack = (m) => {
    const o = {};
    for (const k in m) o[k] = skinById(m[k]).i;
    return o;
  };
  const unpack = (p) => {
    const o = {};
    if (p && "object" == typeof p) for (const k in p) WEAPONS[k] && SKINS[p[k] | 0] && (p[k] | 0) && (o[k] = SKINS[p[k] | 0].id);
    return o;
  };

  // ── 6. in my hands ──
  const _bpw = buildProcWeapon;
  buildProcWeapon = function (key) {
    const g = _bpw.apply(this, arguments);
    try {
      applySkin(g, mySkin(key));
    } catch (e) {}
    return g;
  };
  function refreshVM() {
    try {
      // every gun built so far goes (the grenade in hand has no key and stays)
      for (const c of VM.root.children.slice()) c.userData && c.userData.key && VM.root.remove(c);
      VM.cache = {};
      VM.current = null;
      "undefined" != typeof player && player && player.alive && updateViewmodel(!0);
    } catch (e) {}
  }

  // ── 7. in everyone's hands: the real gun, in its owner's skin ──
  // (the third-person body used to hold one generic rifle shape)
  const TPL = new Map();
  function template(key, skin) {
    const id = key + "|" + skin.id;
    if (TPL.has(id)) return TPL.get(id);
    let g = null;
    try {
      g = buildFor(key, skin);
    } catch (e) {
      g = null;
    }
    if (!g) {
      TPL.set(id, null);
      return null;
    }
    applySkin(g, skin);
    g.scale.setScalar(0.88);
    const w = new T.Group();
    w.add(g);
    try {
      bakeDeep(w);
    } catch (e) {}
    let n = 0;
    w.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = n < 3;
      o.userData.cast = n < 3;
      o.receiveShadow = !1;
      n++;
    });
    const b = new T.Box3().setFromObject(w);
    w.userData.muzzle = [(b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, b.min.z - 0.01];
    TPL.set(id, w);
    return w;
  }
  const PEER = new Map(); // host: what each guest wears, by peer id
  let seed = (Math.random() * 1e9) >>> 0;
  // bots wear a skin on some of their guns: the same ones all match long, and
  // never above the tier the owner allows them (so the rare ones stay rare)
  function botSkins(a) {
    if (a._botSk) return a._botSk;
    const t = {},
      v = GC().botMaxTier,
      cap = null != v && isFinite(+v) ? Math.max(0, Math.min(SKIN_TIERS.max, +v)) : 2,
      pool = SKINS.filter((s) => !s.gone && !s.excl && s.rar >= 1 && s.rar <= cap);
    let h = (((a.id | 0) + 1) * 2654435761 + seed) >>> 0;
    for (const k of Object.keys(WEAPONS)) {
      h ^= h << 13;
      h >>>= 0;
      h ^= h >>> 17;
      h ^= h << 5;
      h >>>= 0;
      const fit = pool.filter((s) => fits(s, k));
      if (fit.length && h % 100 < 38) t[k] = fit[h % fit.length].id;
    }
    return (a._botSk = t);
  }
  const heldKey = (a) => ("client" === NET.mode && "me" !== a.ctrl && a.netWeapon ? a.netWeapon : actorWeaponKey(a));
  function skinOf(a, key) {
    if (!a) return SKINS[0];
    if ("me" === a.ctrl) return mySkin(key);
    if ("client" === NET.mode) return SKINS[a.netSkin | 0] || SKINS[0];
    if ("ai" === a.ctrl) return skinById(botSkins(a)[key]);
    const t = a.ctrl && PEER.get(a.ctrl);
    return t ? skinById(t[key]) : SKINS[0];
  }
  function dressGun(a) {
    const m = a.model;
    if (!m || !m.gun) return;
    const key = heldKey(a),
      skin = skinOf(a, key),
      id = key + "|" + skin.id;
    if (m.gun.userData.tp === id) return;
    const t = template(key, skin);
    if (!t) return;
    for (const c of m.gun.children.slice()) (c.isMesh || c.isGroup) && m.gun.remove(c);
    m.gun.add(t.clone());
    m.gun.userData.tp = id;
    m.muzzle && t.userData.muzzle && m.muzzle.position.fromArray(t.userData.muzzle);
  }
  // a gun that leaves a hand (a swap, a death) lies there in its owner's skin
  const PEND = [];
  const noteDrop = (a, key) => {
    if (!a || !key || !WEAPONS[key]) return;
    PEND.push({ x: a.pos.x, z: a.pos.z, i: skinOf(a, key).i, a: a.id, t: performance.now() });
    PEND.length > 24 && PEND.shift();
  };
  const _sam = syncActorModel;
  syncActorModel = function (a) {
    const r = _sam.apply(this, arguments);
    try {
      if (a && a.weapons) {
        const p = a.weapons.primary || null;
        if (a._skPrim !== p) {
          if (a._skPrim && p && "live" === world.phase && "client" !== NET.mode) {
            noteDrop(a, a._skPrim);
            dropScan();
          }
          a._skPrim = p;
        }
        a.group && a.group.visible && dressGun(a);
      }
    } catch (e) {}
    return r;
  };
  const _ka = killActor;
  killActor = function (a) {
    try {
      "client" !== NET.mode && a && a.weapons && a.weapons.primary && noteDrop(a, a.weapons.primary);
    } catch (e) {}
    const r = _ka.apply(this, arguments);
    try {
      dropScan();
    } catch (e) {}
    return r;
  };

  // ── 8. guns on the ground ──
  const DSK = new Map(); // "x,z" in cm → skin number
  const DSA = new Map(); // "x,z" in cm → who dropped it (actor id), for the guests to check
  const posKey = (x, z) => Math.round(100 * x) + "," + Math.round(100 * z);
  function resolveDrop(x, z) {
    const k = posKey(x, z);
    if (DSK.has(k)) return DSK.get(k);
    let best = null,
      bd = 0.9;
    const now = performance.now();
    for (const p of PEND) {
      if (now - p.t > 4000) continue;
      const d = Math.hypot(p.x - x, p.z - z);
      d < bd && ((bd = d), (best = p));
    }
    if (!best) return 0;
    PEND.splice(PEND.indexOf(best), 1);
    DSK.set(k, best.i);
    DSA.set(k, best.a);
    DSK.size > 200 && DSK.delete(DSK.keys().next().value);
    DSA.size > 200 && DSA.delete(DSA.keys().next().value);
    return best.i;
  }
  function dropScan() {
    for (const g of scene.children) {
      if (!g.isGroup || !g.userData.spin || g.userData.skinDone) continue;
      g.userData.skinDone = 1;
      const i = resolveDrop(g.position.x, g.position.z);
      i && applySkin(g.userData.spin, SKINS[i]);
    }
  }
  // host: the drops list carries each gun's skin
  const _sea = sendEventAll;
  sendEventAll = function (e) {
    try {
      if (e && "drops" === e.t && Array.isArray(e.l)) {
        e.l = e.l.map((r) => (r.length > 4 ? r : [r[0], r[1], r[2], r[3], resolveDrop(r[2] / 100, r[3] / 100), DSA.get(posKey(r[2] / 100, r[3] / 100))]));
        dropScan();
      }
    } catch (x) {}
    return _sea.apply(this, arguments);
  };

  // ── 9. the room: what everyone wears ──
  // Online, what another player wears is shown only as the server signed it.
  // Each player's table travels with a ticket the server signs: the owned
  // picks only, bound to the player's connection (its peer id), so a ticket
  // copied from someone else is worth nothing. The host checks its guests'
  // tickets and passes every ticket on with whose connection it is, so each
  // online player checks everyone's. A modified game can dress its own
  // screen, not anyone else's. Bots are held to the bot tier. With no server
  // (opened from a file) tables are taken as sent.
  const canCheck = () => isOnline() && !!AC() && "function" == typeof AC().api;
  const myPeerId = () => (NET.peer && NET.peer.id) || "";
  const TK = { t: "", sig: "", at: 0, p: null };
  function myTicket() {
    const t = token(),
      p = myPeerId();
    if (!t || !p || !canCheck()) return Promise.resolve("");
    const sig = p + "|" + JSON.stringify(SK.mine);
    if (TK.t && TK.sig === sig && Date.now() - TK.at < 6 * 36e5) return Promise.resolve(TK.t);
    if (TK.p && TK.sig === sig) return TK.p;
    TK.sig = sig;
    TK.t = "";
    return (TK.p = AC()
      .api("skin_ticket", { token: t, m: SK.mine, p })
      .then((j) => {
        const k = (j && j.ticket) || "";
        TK.sig === sig && ((TK.p = null), (TK.t = k), (TK.at = Date.now()));
        return k;
      })
      .catch(() => (TK.sig === sig && (TK.p = null), "")));
  }
  // ticket → {m: the table the server signed, p: whose connection}, or null; asked once per ticket
  const CHK = new Map();
  function checkTicket(k) {
    if (!k || !canCheck()) return Promise.resolve(null);
    if (!CHK.has(k)) {
      CHK.set(
        k,
        AC()
          .api("skin_check", { ticket: k })
          .then((j) => (j && j.m && "object" == typeof j.m && j.p ? { m: clean(j.m), p: String(j.p) } : null))
          .catch(() => (CHK.delete(k), null)),
      );
      CHK.size > 300 && CHK.delete(CHK.keys().next().value);
    }
    return CHK.get(k);
  }
  const botCap = () => {
    const v = GC().botMaxTier;
    return null != v && isFinite(+v) ? Math.max(0, Math.min(SKIN_TIERS.max, +v)) : 2;
  };
  // guest: my table and its ticket to the host; the newest call wins, and a
  // ticket the server did not give is asked for again a little later
  let tellN = 0;
  function tellHost() {
    if ("client" !== NET.mode) return;
    const n = ++tellN;
    myTicket().then((k) => {
      if (n !== tellN || "client" !== NET.mode) return;
      try {
        sendAction({ t: "skins", m: pack(SK.mine), k });
      } catch (e) {}
      clearTimeout(tellHost.r);
      !k && canCheck() && token() && (tellHost.r = setTimeout(tellHost, 15000));
    });
  }
  const _sa = sendAction;
  sendAction = function (m) {
    const r = _sa.apply(this, arguments);
    m && "hello" === m.t && tellHost();
    return r;
  };
  // host: each guest's ticket (by peer), checked; the table shown is the
  // signed one, and only when the ticket was made for that guest's connection
  const TICK = new Map();
  const _oa = NET.onAction;
  NET.onAction = function (peer, m) {
    if (m && "skins" === m.t) {
      if (!canCheck()) PEER.set(peer, unpack(m.m));
      else {
        const k = "string" == typeof m.k ? m.k.slice(0, 4000) : "";
        PEER.has(peer) || PEER.set(peer, {});
        TICK.set(peer, k);
        checkTicket(k).then((t) => {
          if (TICK.get(peer) !== k) return;
          const ok = !!t && t.p === peer;
          ok || TICK.set(peer, "");
          PEER.set(peer, ok ? t.m : {});
          hostSkt();
        });
      }
      return;
    }
    return _oa.apply(this, arguments);
  };
  // host: every player's ticket and connection to every guest (bots marked):
  // now and then, after a change, at the start and when a body changes hands
  let sktN = 0;
  function hostSkt() {
    if ("host" !== NET.mode) return;
    clearTimeout(hostSkt.t);
    hostSkt.t = setTimeout(() => {
      const n = ++sktN;
      myTicket().then((mine) => {
        if (n !== sktN || "host" !== NET.mode || !world.actors) return;
        const me = NET.id || myPeerId(),
          l = world.actors.map((a) => ("ai" === a.ctrl ? [a.id, 0, 1, "ai"] : "me" === a.ctrl ? [a.id, mine || 0, 0, me] : [a.id, TICK.get(a.ctrl) || 0, 0, String(a.ctrl || "")]));
        try {
          sendEventAll({ t: "skt", l });
        } catch (e) {}
      });
    }, 250);
  }
  setInterval(() => "host" === NET.mode && world.actors && world.actors.length && hostSkt(), 8000);
  const _seb = sendEventAll;
  sendEventAll = function (e) {
    const r = _seb.apply(this, arguments);
    e && ("begin" === e.t || "ctrl" === e.t) && hostSkt();
    return r;
  };
  // guest: what each actor may be shown in (actor id → {k, m, p} | "bot" | null)
  const VER = new Map(),
    WANT = new Map(),
    NOT_PEER = new Set(["", "ai", "me", "remote", "dead"]);
  function takeSkt(l) {
    if (!canCheck()) return;
    // a connection named for two bodies, or my own for another body, vouches for nobody
    const seen = new Map(),
      mine = myPeerId();
    for (const r of l) Array.isArray(r) && !r[2] && "string" == typeof r[3] && seen.set(r[3], (seen.get(r[3]) || 0) + 1);
    for (const r of l) {
      if (!Array.isArray(r)) continue;
      const id = r[0];
      if (r[2]) {
        WANT.set(id, "bot");
        VER.set(id, "bot");
        continue;
      }
      const p = "string" == typeof r[3] ? r[3] : "",
        k = "string" == typeof r[1] && !NOT_PEER.has(p) && 1 === seen.get(p) && p !== mine ? r[1] : "";
      if (!k) {
        WANT.set(id, "");
        VER.set(id, null);
        continue;
      }
      const w = k + "@" + p;
      if (WANT.get(id) === w) continue;
      WANT.set(id, w);
      checkTicket(k).then((t) => {
        if (WANT.get(id) !== w) return;
        t && t.p === p ? VER.set(id, { k, m: t.m, p }) : (VER.set(id, null), WANT.delete(id));
      });
    }
  }
  // guest, online: may this body be shown in skin i (on gun key, or on any gun)?
  function vouched(a, key, i) {
    if (!i || "client" !== NET.mode || !canCheck()) return !0;
    if (a && "me" === a.ctrl) return !0;
    const sk = SKINS[i];
    if (!sk || !a) return !1;
    const v = VER.get(a.id),
      c = "string" == typeof a.ctrl ? a.ctrl : "",
      player = !NOT_PEER.has(c);
    if ("bot" === v) return sk.rar <= botCap() && !player;
    return !!(v && v.m && (!player || c === v.p) && (key ? v.m[key] === sk.id : Object.values(v.m).includes(sk.id)));
  }
  const _oe = NET.onEvent;
  NET.onEvent = function (e) {
    if (e && "skt" === e.t && Array.isArray(e.l)) return void takeSkt(e.l);
    e && "begin" === e.t && (VER.clear(), WANT.clear());
    if (e && "drops" === e.t && Array.isArray(e.l)) {
      for (const r of e.l) {
        if (null == r[4]) continue;
        const i = r[4] | 0;
        DSK.set(r[2] + "," + r[3], vouched(actorById(r[5]), r[1], i) ? i : 0);
      }
      const r = _oe.apply(this, arguments);
      try {
        dropScan();
      } catch (x) {}
      return r;
    }
    return _oe.apply(this, arguments);
  };
  const _pa = packActor;
  packActor = function (a) {
    const r = _pa.apply(this, arguments);
    try {
      r[13] = skinOf(a, heldKey(a)).i;
    } catch (e) {}
    return r;
  };
  const _as = applySnapshot;
  applySnapshot = function (s) {
    const r = _as.apply(this, arguments);
    try {
      for (const t of s.a) {
        const a = actorById(t[0]);
        if (!a || "me" === a.ctrl) continue;
        // online, only what the server vouched for: a player's signed pick for the gun in hand, a bot up to the bot tier
        const i = t[13] | 0;
        a.netSkin = vouched(a, heldKey(a), i) ? i : 0;
      }
    } catch (e) {}
    return r;
  };

  // ── 10. every frame: moving skins, guns on the ground ──
  let scanT = 0;
  const _render = render;
  render = function () {
    try {
      const now = performance.now();
      animate(Math.min(0.1, (now - (animate.last || now)) / 1e3));
      animate.last = now;
      if (now - scanT > 400) {
        scanT = now;
        dropScan();
      }
    } catch (e) {}
    // the skin page covers the whole screen: the world behind it is not drawn
    if (AR.open) return;
    return _render.apply(this, arguments);
  };

  // ── 11. after a change ──
  let pushTO = 0;
  function changed() {
    SK.t = Date.now();
    save();
    refreshVM();
    tellHost();
    "host" === NET.mode && hostSkt();
    try {
      const me = "function" == typeof myActor && myActor();
      me && me.model && me.model.gun && (me.model.gun.userData.tp = null);
    } catch (e) {}
    try {
      "function" == typeof renderShop && !$("shop").hidden && renderShop();
    } catch (e) {}
    clearTimeout(pushTO);
    pushTO = setTimeout(push, 1500);
  }
  function setSkin(key, id) {
    if (!WEAPONS[key] || !BY[id]) return !1;
    if (!owns(key, id)) {
      note(L("아직 없는 스킨입니다 · 뽑기에서 얻을 수 있습니다", "Not owned yet · win it in a pull"));
      return !1;
    }
    "default" === id ? delete SK.mine[key] : (SK.mine[key] = id);
    changed();
    return !0;
  }
  // the same skin on every gun that has it
  function setAll(id) {
    if (!BY[id]) return;
    SK.mine = {};
    if ("default" !== id) for (const k in WEAPONS) fits(BY[id], k) && owns(k, id) && (SK.mine[k] = id);
    changed();
  }
  // each gun: stock or one of the skins it owns, at random
  function setRandom() {
    SK.mine = {};
    for (const k in WEAPONS) {
      const pool = skinsFor(k).filter((s) => s.rar > 0 && owns(k, s.id));
      const s = pool[Math.floor(Math.random() * (pool.length + 1))];
      s && (SK.mine[k] = s.id);
    }
    changed();
  }

  // ── 12. the account keeps them (signed in): picks, the collection, gold ──
  let pulled = "";
  // the signed-in record as the game's account module holds it
  const syncSession = (user) => {
    try {
      const s = session();
      if (s && user) {
        s.user = user;
        localStorage.setItem("lgp_session", JSON.stringify(s));
      }
    } catch (e) {}
  };
  function setGold(v) {
    if ("number" != typeof v || !isFinite(v)) return;
    INV.gold = v;
    try {
      const s = session();
      s && s.user && ((s.user.gold = v), localStorage.setItem("lgp_session", JSON.stringify(s)));
    } catch (e) {}
    saveInv();
    paintGold();
  }
  // an answer from the server that carries the collection
  function takeInv(j) {
    if (!j || !j.own || "object" != typeof j.own) return;
    if (j.user) syncSession(j.user);
    if (Number.isSafeInteger(j.championCoins)) {
      const s = session();
      if (s && s.user) { s.user.championCoins = j.championCoins; syncSession(s.user); }
      dispatchEvent(new CustomEvent("champion-wallet", { detail: { coins: j.championCoins } }));
    }
    INV.own = j.own;
    j.items > 0 && (INV.items = +j.items);
    INV.synced = !0;
    "number" == typeof j.gold ? setGold(j.gold) : saveInv();
    enforce() && changed();
    armoryPaint();
    paintGacha();
  }
  async function push() {
    const t = token();
    if (!t || !isOnline()) return;
    try {
      takeInv(await AC().api("skins", { token: t, set: SK.mine, t: SK.t }));
    } catch (e) {}
  }
  let syncing = !1, syncError = !1;
  async function sync(force) {
    const t = token();
    if (!t || !isOnline() || syncing || (!force && pulled === t)) return;
    pulled = t;
    syncing = !0;
    syncError = !1;
    paintGacha();
    try {
      const j = await AC().api("skins", { token: t }),
        srv = j && j.skins;
      if (srv && srv.m && (+srv.t || 0) > SK.t) {
        SK.mine = clean(srv.m);
        SK.t = +srv.t || Date.now();
        save();
        refreshVM();
        tellHost();
      }
      takeInv(j);
      if (SK.t && (!srv || (+srv.t || 0) < SK.t)) push();
    } catch (e) {
      pulled = "";
      syncError = !0;
    }
    syncing = !1;
    paintGacha();
  }
  GAME_BOOT.ready.then(() => sync(!1));
  setInterval(() => sync(!1), 2500);
  function openSkinLink() {
    if (document.documentElement.dataset.gameLoading) return;
    const h = location.hash, tt = $("s-title");
    if (/^#skins(?:-mine)?$/.test(h) && "menu" === world.phase && tt && !tt.hidden && "none" !== getComputedStyle(tt).display) {
      try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
      openArmory(null, "#skins-mine" === h ? "mine" : "pull");
    }
  }
  GAME_BOOT.ready.then(openSkinLink);
  addEventListener("hashchange", openSkinLink);
  // gold moves on the account (a match report, the owner): the wallet follows
  let ovBase = -1;
  setInterval(() => {
    try {
      overGold(!0);
      const s = session(),
        u = s && s.user;
      u && "number" == typeof u.gold && u.gold !== INV.gold && setGold(u.gold);
      overGold(!1);
      goldChip();
      // the homepage's skin button: play.html#skins (pulls) or #skins-mine opens the page at the menu
      openSkinLink();
    } catch (e) {}
  }, 1000);
  // a pull: gold out, skins in, then the reveal
  async function pull(n) {
    n = 10 === n ? 10 : 1;
    if (INV.busy || !signed()) return null;
    const left = pullableLeft();
    if (left < n) return note(left > 0 ? L(`남은 스킨이 ${left}개뿐입니다`, `Only ${left} skins left`) : L("일반~전설 뽑기 스킨을 모두 모았습니다", "You own every Common-Legendary pull skin")), null;
    if (INV.gold < costOf(n)) return note(L("골드가 부족합니다", "Not enough gold")), null;
    INV.busy = !0;
    paintGacha();
    // the crate drops at once; the answer decides its colour and what is inside
    startReveal(n);
    let j = null;
    try {
      j = await AC().api("gacha", { token: token(), n });
      j.user && syncSession(j.user);
      addHist(j.results || []);
      takeInv(j);
      revealResults(j.results || []);
    } catch (e) {
      revealFail(e && e.message ? e.message : L("뽑기에 실패했습니다", "The pull failed"));
      j = null;
    }
    INV.busy = !1;
    paintGacha();
    armoryPaint();
    return j;
  }
  // the result screen: the gold this match brought
  function overGold(before) {
    const ph = "undefined" != typeof world && world ? world.phase : "";
    if ("over" !== ph) {
      before && (ovBase = INV.gold);
      const c = $("ov-gold");
      c && (c.hidden = !0);
      return;
    }
    if (before) return void (ovBase < 0 && (ovBase = INV.gold));
    if (!signed()) return;
    const st = document.querySelector("#s-over .ov-stats");
    if (!st) return;
    let c = $("ov-gold");
    if (!c) {
      c = document.createElement("div");
      c.className = "ov-st";
      c.id = "ov-gold";
      c.innerHTML = `<b></b><span class="lbl">${L("골드", "Gold")}</span>`;
      st.appendChild(c);
    }
    // nothing this time because the day's match gold is used up: say so
    const d = Math.max(0, INV.gold - ovBase),
      u = (session() || {}).user,
      capped = !(d > 0) && !!u && 0 === u.goldLeft;
    c.hidden = !(d > 0) && !capped;
    c.querySelector("b").textContent = capped ? L("🪙 오늘 한도", "🪙 Daily cap") : "🪙 +" + d.toLocaleString();
    c.querySelector("b").style.color = "#ffc849";
  }
  // the gold next to my name on the title screen; it opens the armoury
  function goldChip() {
    let b = $("gold-chip");
    const t = $("s-title"),
      show = signed() && "menu" === world.phase && t && !t.hidden && "none" !== getComputedStyle(t).display;
    if (!show) return void (b && (b.style.display = "none"));
    if (!b) {
      b = document.createElement("button");
      b.id = "gold-chip";
      b.style.cssText = "position:fixed;top:10px;right:12px;z-index:40;padding:6px 12px;border-radius:99px;background:rgba(36,28,8,.86);border:1px solid #5c4b1f;color:#ffc849;font-size:12px;font-family:var(--f-display);letter-spacing:.04em;cursor:pointer";
      b.title = L("스킨 뽑기", "Skin pulls");
      b.onclick = () => openArmory(null, "pull");
      document.body.appendChild(b);
    }
    const a = $("acct-chip");
    b.style.right = (a && a.offsetWidth && "none" !== a.style.display ? 12 + a.offsetWidth + 8 : 12) + "px";
    b.style.display = "";
    const txt = "🪙 " + INV.gold.toLocaleString();
    b.textContent !== txt && (b.textContent = txt);
  }

  // ── 13. the skin page (무기고) ──
  // Three tabs: pulls (a supply crate drops, glows in the colour of the best
  // skin inside, epic and legendary ones climbing a colour on the way, and
  // bursts open; the best gun rises out of it and the cards fly out and turn
  // over), my skins (everything owned, worn or not) and by gun (each gun's
  // skins). One WebGL turntable moves to whichever of them is showing; a
  // second small one paints the gun pictures on the cards.
  const css = document.createElement("style");
  css.textContent = `
#armory{position:fixed;inset:0;z-index:60;background:#080a0f;display:flex;flex-direction:column;padding:clamp(12px,2.2vw,26px);color:var(--ink)}
#armory[hidden]{display:none}
.ar-hd{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding-bottom:12px;border-bottom:1px solid var(--line);flex:0 0 auto}
.ar-hd h2{font-family:var(--f-display);font-size:20px;letter-spacing:.14em}
.ar-hd-r{margin-left:auto;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.ar-hd-r .btn{padding:10px 18px;font-size:11px}
.ar-gold{font-family:var(--f-display);font-size:13px;color:var(--gold);padding:8px 12px;border:1px solid rgba(255,200,73,.35);border-radius:999px;background:rgba(255,200,73,.06);white-space:nowrap}
.ar-tabs{display:flex;gap:4px;padding:4px;border:1px solid var(--line);border-radius:999px;background:rgba(255,255,255,.02)}
.ar-tab{padding:8px 18px;border-radius:999px;font-size:12px;font-weight:700;color:var(--steel);letter-spacing:.04em;min-height:38px;white-space:nowrap}
.ar-tab:hover{color:var(--ink)}
.ar-tab.on{background:var(--gold);color:#14100a}
.ar-tab i{font-style:normal;font-size:10px;margin-left:6px;opacity:.75}
.ar-pane{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;padding-top:14px}
.ar-pane[hidden]{display:none}
.ar-tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center;flex:0 0 auto}
.ar-tools .btn{padding:9px 16px;font-size:11px;min-height:38px}
.ar-tip{font-size:11px;color:var(--steel-dim);margin-right:auto}
.ar-slot{min-height:0;display:flex}
.ar-slot>.ar-view{flex:1 1 auto}
#ar-toast{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);z-index:9;padding:8px 14px;border-radius:999px;background:rgba(20,25,34,.95);border:1px solid var(--line);font-size:12px;pointer-events:none;opacity:0;transition:opacity .25s;white-space:nowrap}
#ar-toast.on{opacity:1}
.ar-body{flex:1 1 auto;min-height:0;display:grid;grid-template-columns:minmax(150px,210px) minmax(0,1fr) minmax(220px,330px);gap:14px;padding-top:14px}
.ar-guns{overflow-y:auto;min-height:0;display:flex;flex-direction:column;gap:3px;padding-right:4px}
.ar-cls{font-family:var(--f-display);font-size:9px;letter-spacing:.16em;color:var(--steel-dim);text-transform:uppercase;padding:10px 8px 4px}
.ar-gun{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:8px 10px;border:1px solid transparent;border-radius:10px;text-align:left;transition:.15s}
.ar-gun b{font-size:12.5px;font-weight:600}
.ar-gun span{font-size:10px;color:var(--steel-dim)}
.ar-gun.skinned span{color:var(--gold)}
.ar-gun:hover{background:rgba(255,255,255,.04)}
.ar-gun.on{border-color:var(--gold);background:rgba(255,200,73,.08)}
.ar-view{position:relative;min-height:0;border:1px solid var(--line);border-radius:18px;background:radial-gradient(ellipse at 50% 40%,#1b2230,#0b0e14 70%);overflow:hidden;display:flex;align-items:center;justify-content:center}
.ar-view canvas{position:absolute;inset:0;width:100%;height:100%;display:block;cursor:grab;touch-action:none}
.ar-cap{position:absolute;left:14px;bottom:12px;font-family:var(--f-display);font-size:13px;letter-spacing:.08em}
.ar-cap i{display:inline-block;margin-left:8px;padding:2px 8px;border-radius:999px;font-size:9px;letter-spacing:.14em;font-style:normal;border:1px solid currentColor}
.ar-cap em{display:block;font-family:var(--f-body);font-size:10px;color:var(--steel-dim);letter-spacing:0;font-style:normal;margin-top:3px}
.ar-hint{position:absolute;right:14px;bottom:12px;font-size:10px;color:var(--steel-dim)}
.ar-skins{overflow-y:auto;min-height:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px;align-content:start;padding-right:4px}
.ar-sk{position:relative;display:flex;flex-direction:column;align-items:stretch;gap:5px;padding:7px;border:1px solid var(--line);border-radius:12px;background:var(--panel);transition:.15s;text-align:left}
.ar-sk:hover{border-color:var(--steel-dim);transform:translateY(-1px)}
.ar-sk.on{border-color:var(--gold);box-shadow:0 0 0 1px var(--gold),0 8px 22px -10px rgba(255,200,73,.6)}
.ar-sk canvas{width:100%;height:46px;border-radius:7px;display:block}
.ar-sk b{font-size:11.5px;font-weight:600}
.ar-sk i{font-size:9px;letter-spacing:.12em;font-style:normal;font-family:var(--f-display)}
.ar-sk.locked canvas{opacity:.35;filter:grayscale(.5)}
.ar-sk.locked b{color:var(--steel-dim)}
.ar-sk.locked::after{content:"🔒";position:absolute;top:6px;right:8px;font-size:12px;filter:drop-shadow(0 1px 2px #000)}
.ar-sk.peek{border-color:var(--steel)}
.sk-chip{display:inline-block;margin-left:6px;padding:1px 6px;border-radius:999px;font-size:9px;font-style:normal;letter-spacing:.06em;color:var(--gold);border:1px solid rgba(255,200,73,.4);vertical-align:middle}
#go-armory b{color:#f3d58a}
.tt-sub{grid-template-columns:repeat(4,1fr)}
.pl{flex:1 1 auto;min-height:0;overflow-y:auto;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;align-content:start;padding-bottom:4px}
.pl-card{border:1px solid var(--line);border-radius:18px;background:var(--panel);padding:18px 20px;min-width:0}
.pl-card>.lbl{margin-bottom:10px}
.pl-hero{grid-column:1/-1;display:grid;grid-template-columns:minmax(0,1.25fr) minmax(290px,1fr);min-height:350px;padding:0;overflow:hidden;background:linear-gradient(120deg,#131a28,#0c1018 62%);border-color:#2f3a4d}
.pl-show{position:relative;min-height:0;display:flex;overflow:hidden;--fc:#ffc849;background:radial-gradient(ellipse at 50% 56%,color-mix(in srgb,var(--fc) 22%,transparent),transparent 62%);transition:background .6s}
.pl-rays{position:absolute;left:50%;top:54%;width:220%;aspect-ratio:1;transform:translate(-50%,-50%);background:repeating-conic-gradient(from 0deg,color-mix(in srgb,var(--fc) 15%,transparent) 0 5deg,transparent 5deg 15deg);-webkit-mask-image:radial-gradient(circle,#000 0,transparent 46%);mask-image:radial-gradient(circle,#000 0,transparent 46%);animation:rvSpin 46s linear infinite;pointer-events:none}
.pl-show .ar-slot{flex:1 1 auto;position:relative;z-index:1}
.pl-show .ar-view,#slot-rv .ar-view{border:0;border-radius:0;background:transparent}
.pl-show .ar-cap,.pl-show .ar-hint,#slot-rv .ar-cap,#slot-rv .ar-hint{display:none}
.pl-tag{position:absolute;left:18px;top:16px;z-index:2;font-size:10px;letter-spacing:.2em;font-family:var(--f-display);color:var(--fc);border:1px solid color-mix(in srgb,var(--fc) 55%,transparent);padding:3px 10px;border-radius:99px;background:rgba(0,0,0,.4);pointer-events:none}
.pl-feat{position:absolute;left:18px;right:18px;bottom:14px;z-index:2;pointer-events:none;display:flex;flex-direction:column;gap:2px}
.pl-feat small{font-size:10px;letter-spacing:.14em;color:var(--steel-dim)}
.pl-feat b{font-family:var(--f-display);font-size:22px;letter-spacing:.06em;color:var(--fc);text-shadow:0 0 18px color-mix(in srgb,var(--fc) 55%,transparent)}
.pl-feat span{font-size:12px;color:var(--steel)}
.pl-act{padding:22px 24px;display:flex;flex-direction:column;gap:12px;justify-content:center;border-left:1px solid var(--line);background:rgba(8,11,17,.5)}
.pl-act h3{font-family:var(--f-display);font-size:24px;letter-spacing:.1em}
.pl-act p{font-size:12px;color:var(--steel);line-height:1.65}
.pl-wallet{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-radius:12px;background:rgba(255,200,73,.06);border:1px solid rgba(255,200,73,.25)}
.pl-wallet span{font-size:11px;color:var(--steel)}
.pl-wallet b{font-family:var(--f-display);font-size:20px;color:var(--gold)}
.pl-btns{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.ar-pull{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:68px;padding:10px 12px;border-radius:14px;font-size:15px;font-weight:800;letter-spacing:.04em;overflow:hidden;transition:transform .15s,filter .15s}
.ar-pull i{font-style:normal;font-family:var(--f-display);font-size:12px;opacity:.9}
.ar-pull em{position:absolute;top:6px;right:7px;font-style:normal;font-size:9px;padding:1px 6px;border-radius:99px;background:#ff5a3c;color:#fff;font-weight:700;letter-spacing:0}
#ar-pull1{background:linear-gradient(180deg,#ffd76a,#eea528);border:1px solid #ffd76a;color:#1a1204;box-shadow:0 10px 30px -12px rgba(255,200,73,.85)}
#ar-pull10{background:linear-gradient(180deg,#2b2311,#17130a);border:1px solid #c99a2e;color:var(--gold)}
.ar-pull:not(:disabled):hover{filter:brightness(1.08);transform:translateY(-1px)}
.ar-pull:not(:disabled):active{transform:translateY(1px) scale(.98)}
.ar-pull:not(:disabled)::after{content:"";position:absolute;inset:0;background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.32) 50%,transparent 65%);transform:translateX(-130%);animation:plShine 3.4s ease-in-out infinite;pointer-events:none}
@keyframes plShine{0%,62%{transform:translateX(-130%)}100%{transform:translateX(130%)}}
.ar-pull:disabled{opacity:.42;cursor:not-allowed;filter:grayscale(.45);box-shadow:none}
.ar-why{font-size:11px;color:var(--steel-dim);min-height:15px}
.pl-earn{font-size:11px;color:var(--steel-dim)}
.pl-prog b{font-family:var(--f-display);font-size:28px}
.pl-prog span{font-size:12px;color:var(--steel);margin-left:4px}
.pl-bar{height:8px;border-radius:99px;background:rgba(255,255,255,.07);overflow:hidden;margin:8px 0 12px}
.pl-bar i{display:block;height:100%;background:linear-gradient(90deg,var(--gold),#ff8a3c);border-radius:99px;transition:width .5s}
.pl-tier{display:grid;grid-template-columns:54px 56px minmax(0,1fr) 62px;gap:10px;align-items:center;font-size:12px;padding:7px 0;border-top:1px solid var(--line)}
.pl-tier b{font-family:var(--f-display);letter-spacing:.06em;font-size:12px}
.pl-tier em{font-style:normal;color:var(--steel)}
.pl-tier .pl-bar{margin:0;height:6px}
.pl-tier small{text-align:right;color:var(--steel-dim);font-size:11px}
.pl-odds-t{font-size:10px;color:var(--steel-dim);margin-top:8px}
.ar-odds{display:inline-flex;gap:8px;flex-wrap:wrap}
.ar-odds i{font-style:normal;font-family:var(--f-display);letter-spacing:.06em}
.pl-recg{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:8px;max-height:300px;overflow-y:auto;padding-right:2px}
.pl-empty{grid-column:1/-1;font-size:12px;color:var(--steel-dim);padding:16px;border:1px dashed var(--line);border-radius:12px;text-align:center}
.it{position:relative;display:flex;flex-direction:column;gap:3px;padding:7px;border:1px solid var(--line);border-bottom:2px solid var(--rc);border-radius:12px;background:var(--panel);text-align:left;transition:border-color .15s,transform .15s;--rc:var(--line);min-width:0}
.it:hover{border-color:var(--steel-dim);border-bottom-color:var(--rc);transform:translateY(-1px)}
.it .th{width:100%;height:58px;border-radius:8px;display:block;object-fit:cover;background:#0d1118}
.it .th.r{object-fit:contain;background:radial-gradient(circle at 50% 62%,color-mix(in srgb,var(--rc) 24%,#18202c),#0b0f16 74%)}
.it small{font-size:10px;color:var(--steel);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.it b{font-size:12px;font-weight:600;line-height:1.2}
.it i{font-size:9px;letter-spacing:.12em;font-style:normal;font-family:var(--f-display);color:var(--rc)}
.it.on{border-color:var(--gold);box-shadow:0 0 0 1px var(--gold)}
.it.eq::after{content:attr(data-eq);position:absolute;top:5px;right:5px;font-size:9px;padding:1px 6px;border-radius:99px;background:var(--gold);color:#14100a;font-weight:700}
.it.wish::before{content:"★";position:absolute;top:4px;left:7px;font-size:13px;color:#ffc849;text-shadow:0 1px 3px #000;z-index:1}
.ar-sk.wish::before{content:"★";position:absolute;top:5px;left:8px;font-size:12px;color:#ffc849;text-shadow:0 1px 3px #000;z-index:1}
.ar-cap .ar-wish,.sh-wbtn{pointer-events:auto}
.ar-wish{display:inline-block;margin-top:6px;padding:5px 11px;border-radius:999px;border:1px solid rgba(255,200,73,.5);background:rgba(10,13,18,.7);color:#ffc849;font-size:11px;font-family:var(--f-body);letter-spacing:0;cursor:pointer}
.ar-wish.on,.sh-wbtn.on{background:rgba(255,200,73,.16);border-color:#ffc849;color:#ffc849}
.sh-wn{color:#ffc849}
#wish-note{position:fixed;left:50%;bottom:max(18px,4vh);transform:translateX(-50%);z-index:58;display:flex;align-items:stretch;border:1px solid rgba(255,200,73,.6);border-radius:14px;background:rgba(14,18,26,.94);box-shadow:0 12px 40px -12px rgba(255,200,73,.45);max-width:min(560px,92vw);animation:wnIn .4s cubic-bezier(.2,.8,.2,1)}
#wish-note[hidden]{display:none}
#wish-note .wn-go{display:flex;flex-direction:column;gap:2px;padding:10px 14px;text-align:left;background:none;border:0;color:var(--ink);cursor:pointer;min-height:44px}
#wish-note .wn-go b{color:#ffc849;font-size:13px}#wish-note .wn-go span{font-size:11px;color:var(--steel)}
#wish-note .wn-x{padding:0 14px;background:none;border:0;border-left:1px solid var(--line);color:var(--steel);font-size:18px;cursor:pointer;min-width:44px}
@keyframes wnIn{from{opacity:0;transform:translate(-50%,12px)}}
.pl-shop{margin-top:10px;width:100%;min-height:40px;font-size:12px;border-color:rgba(255,200,73,.45);color:#ffc849}
.it .pr{font-style:normal;font-family:var(--f-display);font-size:11px;font-weight:700;color:#ffc849;margin-top:1px}
.it.eq .pr{color:var(--steel-dim);text-decoration:line-through}
.it.dear .pr{color:#ff8a8a}.it.dear .th{filter:saturate(.6) brightness(.8)}
.sh-f{flex-wrap:wrap;align-items:center;gap:6px 14px}
.it.wk{box-shadow:0 0 0 1px rgba(255,107,61,.75),0 0 18px -4px rgba(255,107,61,.55)}
.it .wkr{position:absolute;top:6px;left:6px;padding:2px 7px;border-radius:99px;background:#ff6b3d;color:#fff;font-style:normal;font:700 10px/1.4 var(--f-display);letter-spacing:.04em;pointer-events:none}
.it .pr s{color:var(--steel);font-weight:400;margin-right:3px}
.sh-hd .sh-wk{color:#ff9a73}.sh-hd .sh-wk b{color:#ff6b3d}
.sh-hd{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}.sh-hd>b{font-size:15px;color:var(--ink)}.sh-hd span{font-size:11px;color:var(--steel)}.sh-hd span b{font-family:var(--f-display);color:#ffc849;font-size:13px;margin-left:4px;letter-spacing:.06em}
.sh-note{flex:1 1 280px;font-size:11px;color:var(--steel-dim);line-height:1.45}
.sh-why{color:#ff9aa5!important}
#sh-buy.sh-arm{background:#ff6b3d;border-color:#ff6b3d;color:#fff;animation:shArm .5s ease-in-out infinite alternate}
@keyframes shArm{to{box-shadow:0 0 0 3px rgba(255,107,61,.35)}}
@media(max-width:860px),(max-height:520px){.sh-note{display:none}.sh-f{gap:4px 10px}}
.mi-f{display:flex;gap:6px;flex-wrap:wrap;align-items:center;flex:0 0 auto}
.mi-f button{padding:5px 12px;border-radius:999px;border:1px solid var(--line);font-size:11px;color:var(--steel);min-height:32px}
.mi-f button.on{border-color:var(--rc,var(--gold));color:var(--rc,var(--gold));background:rgba(255,255,255,.05)}
.mi-f select{background:var(--panel);color:var(--ink);border:1px solid var(--line);border-radius:999px;padding:6px 10px;font-size:11px;min-height:32px}
.mi-n{margin-left:auto;font-size:11px;color:var(--steel)}
.mi{flex:1 1 auto;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,380px);gap:14px;padding-top:12px}
.mi-list{min-height:0;overflow-y:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(122px,1fr));gap:8px;align-content:start;padding-right:4px}
.mi-side{min-height:0;display:flex;flex-direction:column;gap:10px}
.mi-side .ar-slot{flex:1 1 auto;min-height:200px}
.mi-info{border:1px solid var(--line);border-radius:14px;background:var(--panel);padding:12px 14px;display:flex;flex-direction:column;gap:8px;flex:0 0 auto}
.mi-info h4{font-size:15px;font-weight:700}
.mi-info h4 i{font-style:normal;font-size:10px;letter-spacing:.12em;font-family:var(--f-display);margin-left:8px}
.mi-info p{font-size:11px;color:var(--steel)}
.mi-info .row{display:flex;gap:8px;flex-wrap:wrap}
.mi-info .btn{padding:9px 14px;font-size:11px;min-height:40px}
.mi-empty{grid-column:1/-1;padding:34px 14px;text-align:center;color:var(--steel);font-size:13px;border:1px dashed var(--line);border-radius:14px;display:flex;flex-direction:column;gap:12px;align-items:center}
.mi-empty .btn{padding:10px 18px;font-size:12px;min-height:40px}
#ar-reveal{position:absolute;inset:0;z-index:6;display:flex;justify-content:center;padding:clamp(10px,2vw,22px);overflow:hidden;background:#04060a;--rc:#8a97ab}
#ar-reveal[hidden]{display:none}
.rv-bg{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 40%,color-mix(in srgb,var(--rc) 24%,transparent),transparent 58%),radial-gradient(ellipse at 50% 112%,#121a2b,#04060a 70%);transition:background .5s}
.rv-rays{position:absolute;left:50%;top:40%;width:260vmax;height:260vmax;transform:translate(-50%,-50%);background:repeating-conic-gradient(from 0deg,color-mix(in srgb,var(--rc) 28%,transparent) 0 4deg,transparent 4deg 14deg);-webkit-mask-image:radial-gradient(circle,#000 0,transparent 26%);mask-image:radial-gradient(circle,#000 0,transparent 26%);opacity:0;transition:opacity .7s;animation:rvSpin 32s linear infinite}
#ar-reveal.burst .rv-rays{opacity:.78}
@keyframes rvSpin{to{transform:translate(-50%,-50%) rotate(360deg)}}
.rv-flash{position:absolute;inset:0;pointer-events:none;opacity:0;z-index:4;background:radial-gradient(circle at 50% 40%,#fff 0,color-mix(in srgb,var(--rc) 70%,#fff) 18%,transparent 64%)}
#ar-reveal.flash .rv-flash{animation:rvFlash .85s ease-out forwards}
@keyframes rvFlash{0%{opacity:0}9%{opacity:1}100%{opacity:0}}
.rv-fx{position:absolute;inset:0;pointer-events:none;z-index:3;overflow:hidden}
.rv-p{position:absolute;width:var(--s,6px);height:var(--s,6px);margin:calc(var(--s,6px) / -2) 0 0 calc(var(--s,6px) / -2);border-radius:50%;background:var(--c);box-shadow:0 0 10px var(--c);animation:rvP var(--d,1s) cubic-bezier(.15,.7,.3,1) forwards}
.rv-p.sq{border-radius:2px;height:calc(var(--s,6px) * .55)}
@keyframes rvP{from{transform:translate(0,0) scale(1) rotate(0);opacity:1}to{transform:translate(var(--dx),var(--dy)) scale(.15) rotate(var(--r,0deg));opacity:0}}
.rv-fall{position:absolute;top:-20px;width:9px;height:5px;border-radius:1px;background:var(--c);box-shadow:0 0 8px var(--c);animation:rvFall var(--d,2.4s) linear forwards}
@keyframes rvFall{from{transform:translate(0,0) rotate(0);opacity:1}85%{opacity:1}to{transform:translate(var(--dx),110vh) rotate(var(--r,540deg));opacity:0}}
.rv-ring{position:absolute;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;border:3px solid var(--c);box-shadow:0 0 18px var(--c);animation:rvRingX .75s ease-out forwards}
@keyframes rvRingX{from{transform:scale(.3);opacity:1}to{transform:scale(var(--k,9));opacity:0}}
#ar-reveal.shake .rv-box{animation:rvShake .5s}
@keyframes rvShake{0%,100%{transform:none}15%{transform:translate(-8px,4px)}30%{transform:translate(7px,-5px)}45%{transform:translate(-5px,-3px)}60%{transform:translate(4px,5px)}75%{transform:translate(-2px,2px)}}
.rv-box{position:relative;z-index:2;width:100%;max-width:1120px;display:flex;flex-direction:column;align-items:center;gap:10px;min-height:0;overflow-y:auto;overflow-x:hidden}
.rv-hd{text-align:center;flex:0 0 auto}
.rv-hd h3{font-family:var(--f-display);font-size:18px;letter-spacing:.14em;margin-top:2px}
.rv-main{flex:1 0 auto;min-height:0;width:100%;display:flex;flex-direction:column;gap:12px;align-items:center}
#ar-reveal.many.dealt .rv-show{min-height:150px}
.rv-show{position:relative;width:100%;flex:1 1 auto;min-height:220px;display:flex}
#ar-reveal.one .rv-show{min-height:300px}
.rv-show .ar-slot{flex:1 1 auto}
.rv-cap{position:absolute;left:5%;right:5%;bottom:6%;text-align:left;pointer-events:none;opacity:0;transform:translateY(12px);transition:opacity .4s,transform .4s;z-index:2}
.rv-cap.on{opacity:1;transform:none}
.rv-cap b{display:block;font-family:var(--f-display);font-size:clamp(22px,3.4vw,38px);letter-spacing:.08em;color:var(--rc);text-shadow:0 0 26px color-mix(in srgb,var(--rc) 65%,transparent)}
.rv-cap span{font-size:13px;color:var(--ink)}
.rv-cap i{display:inline-block;margin-left:8px;font-style:normal;font-size:10px;letter-spacing:.16em;padding:2px 9px;border-radius:99px;border:1px solid var(--rc);color:var(--rc);font-family:var(--f-display);vertical-align:2px}
.rv-grid{display:grid;gap:10px;width:100%;justify-content:center;flex:0 0 auto}
#ar-reveal:not(.dealt) .rv-grid{display:none}
.rv-card{perspective:900px;aspect-ratio:4/5;position:relative;cursor:pointer;--rc:var(--line);opacity:0;transform:translate(var(--fx,0px),var(--fy,0px)) scale(.18) rotate(-14deg)}
.rv-card.go{transition:transform .62s cubic-bezier(.2,.9,.25,1.12),opacity .2s}
.rv-card.in{opacity:1;transform:none}
.rv-in{position:relative;width:100%;height:100%;transform-style:preserve-3d;transition:transform .5s cubic-bezier(.2,.7,.2,1);transform:rotateY(180deg)}
.rv-card.open .rv-in{transform:rotateY(0)}
.rv-f,.rv-b{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;border-radius:14px;border:1px solid var(--line);overflow:hidden}
.rv-b{transform:rotateY(180deg);display:grid;place-items:center;background:repeating-linear-gradient(135deg,rgba(255,255,255,.035) 0 6px,transparent 6px 14px),linear-gradient(160deg,#1d2534,#0e1219)}
.rv-b span{font-family:var(--f-display);font-size:28px;color:#3d485c;letter-spacing:.04em;text-shadow:0 1px 0 #000}
.rv-card.charge .rv-b{border-color:var(--rc);box-shadow:0 0 30px var(--rc),inset 0 0 24px color-mix(in srgb,var(--rc) 45%,transparent);animation:rvCharge .42s ease-in}
.rv-card.charge .rv-b span{color:var(--rc)}
@keyframes rvCharge{0%{transform:rotateY(180deg)}20%{transform:rotateY(180deg) translateX(-3px) rotate(-2deg)}40%{transform:rotateY(180deg) translateX(3px) rotate(2deg)}60%{transform:rotateY(180deg) translateX(-3px) rotate(-1deg)}80%{transform:rotateY(180deg) translateX(2px)}100%{transform:rotateY(180deg) scale(1.05)}}
.rv-f{display:flex;flex-direction:column;gap:3px;padding:7px 8px 8px;border-color:var(--rc);background:linear-gradient(180deg,color-mix(in srgb,var(--rc) 18%,#151b26),#0f141c 58%);box-shadow:0 0 22px -8px var(--rc)}
.rv-f .th{width:100%;flex:1 1 auto;min-height:0;object-fit:contain;border-radius:8px}
.rv-f small{font-size:10px;color:var(--steel);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rv-f b{font-size:13px;line-height:1.15}
.rv-f i{font-size:9px;letter-spacing:.14em;font-style:normal;font-family:var(--f-display);color:var(--rc)}
.rv-card.leg.open .rv-f{animation:rvLeg 1.2s ease-in-out infinite alternate}
@keyframes rvLeg{from{box-shadow:0 0 10px -2px rgba(255,200,73,.4)}to{box-shadow:0 0 30px 2px rgba(255,200,73,.85)}}
.rv-card.sel .rv-f{outline:2px solid var(--gold);outline-offset:2px}
.rv-card.ring::after{content:"";position:absolute;inset:-6px;border-radius:18px;border:2px solid var(--rc);animation:rvRing .75s ease-out forwards;pointer-events:none}
@keyframes rvRing{0%{transform:scale(.85);opacity:1}100%{transform:scale(1.3);opacity:0}}
.rv-btns{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;flex:0 0 auto;transition:opacity .3s}
#ar-reveal:not(.done) .rv-btns{opacity:0;pointer-events:none}
.rv-btns .btn{padding:10px 20px;font-size:12px;min-height:42px}
.rv-btns .btn:disabled{opacity:.4}
.rv-hint{font-size:11px;color:var(--steel-dim);flex:0 0 auto}
@media(max-width:860px){.ar-body{grid-template-columns:1fr;grid-template-rows:auto minmax(170px,32vh) 1fr}.ar-guns{flex-direction:row;overflow-x:auto;overflow-y:hidden;gap:6px;padding-bottom:4px}.ar-cls{display:none}.ar-gun{flex:0 0 auto;padding:7px 10px}.ar-skins{grid-template-columns:repeat(auto-fill,minmax(88px,1fr))}.ar-hd h2{font-size:16px}.tt-sub{grid-template-columns:repeat(2,1fr)}
.ar-hd{gap:8px;padding-bottom:10px}.ar-tabs{order:3;width:100%}.ar-tab{flex:1;padding:8px 4px;font-size:12px}.ar-hd-r .btn{padding:9px 14px}
.pl{grid-template-columns:1fr}.pl-hero{grid-template-columns:1fr}.pl-show{min-height:220px}.pl-act{border-left:0;border-top:1px solid var(--line);padding:16px}.pl-card{padding:14px}.pl-tier{grid-template-columns:44px 48px minmax(0,1fr) 56px;gap:8px}
.mi{grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr)}.mi-side{flex-direction:row;gap:8px}.mi-side .ar-slot{min-height:0;height:150px;flex:1 1 55%}.mi-info{flex:1 1 45%;padding:10px;gap:6px}.mi-info h4{font-size:13px}.mi-info .btn{padding:8px 10px}.mi-list{grid-template-columns:repeat(auto-fill,minmax(100px,1fr))}.ar-tools .ar-tip{display:none}}
@media(max-width:600px){.rv-cap{text-align:center;bottom:2px}.rv-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}#ar-reveal.one .rv-grid{grid-template-columns:repeat(1,minmax(0,150px))!important}.rv-show{min-height:200px}}
@media(max-height:520px) and (min-width:600px){.ar-hd{padding-bottom:6px}.ar-hd>div:first-child{display:none}.ar-tabs{order:0;width:auto}.ar-tab{flex:0 0 auto;padding:8px 14px}.ar-pane{padding-top:8px}
.pl-hero{grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);min-height:0;height:calc(100vh - 96px);min-height:230px}.pl-show{min-height:0}.pl-act{border-top:0;border-left:1px solid var(--line);padding:12px 14px;gap:8px}.pl-act p,.pl-act h3,.pl-act>.lbl{display:none}.ar-pull{min-height:50px;font-size:13px}.pl-feat b{font-size:16px}
.mi{grid-template-columns:minmax(0,1fr) minmax(220px,36%);grid-template-rows:none;padding-top:8px}.mi-side{flex-direction:column;gap:6px}.mi-side .ar-slot{height:auto;flex:1 1 auto;min-height:0}.mi-info{flex:0 0 auto}.mi-info p{display:none}.mi-info:not(:has(h4)){display:none}.mi-f button,.mi-f select{min-height:30px;padding:4px 10px}
.rv-hd{display:none}.rv-main{flex-direction:row;align-items:stretch}.rv-show,#ar-reveal.one .rv-show{flex:1 1 42%;min-height:0}.rv-grid{flex:1 1 58%;align-content:center;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:6px}#ar-reveal.one .rv-grid{grid-template-columns:repeat(1,minmax(0,130px))!important}.rv-f b{font-size:11px}.rv-f small{font-size:9px}.rv-cap b{font-size:20px}.rv-btns .btn{padding:8px 14px;min-height:40px}}
/* a phone held sideways: by gun = the guns and the skins on the left, the preview on the right,
   a slim header, so every skin can be seen and tapped */
@media(orientation:landscape) and (max-height:540px){
#armory{padding:8px 12px calc(8px + env(safe-area-inset-bottom)) calc(12px + env(safe-area-inset-left))}
.ar-hd{gap:8px;padding-bottom:6px}.ar-hd>div:first-child{display:none}.ar-tabs{order:0;width:auto}.ar-tab{flex:0 0 auto;padding:6px 14px;min-height:34px;font-size:12px}
.ar-hd-r{margin-left:auto}.ar-hd-r .btn{padding:7px 14px;min-height:34px}.ar-gold{padding:5px 10px;font-size:12px}
.ar-pane{padding-top:6px}
.ar-tools{gap:6px}.ar-tools .ar-tip{display:none}.ar-tools .btn{padding:5px 12px;min-height:32px;font-size:11px}
#ar-p-gun .ar-body{grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);grid-template-rows:auto minmax(0,1fr);grid-template-areas:"guns view" "skins view";gap:8px;padding-top:8px}
#ar-p-gun .ar-guns{grid-area:guns;flex-direction:row;overflow-x:auto;overflow-y:hidden;gap:5px;padding:0 0 4px}
#ar-p-gun .ar-cls{display:none}
#ar-p-gun .ar-gun{flex:0 0 auto;padding:5px 10px;min-height:34px;justify-content:center}#ar-p-gun .ar-gun span{display:none}
#ar-p-gun #slot-gun{grid-area:view;min-height:0}
#ar-p-gun .ar-skins{grid-area:skins;grid-template-columns:repeat(auto-fill,minmax(82px,1fr));gap:6px;min-height:0}
#ar-p-gun .ar-sk{padding:5px;gap:3px}#ar-p-gun .ar-sk canvas{height:34px}#ar-p-gun .ar-sk b{font-size:11px}
#ar-p-gun .ar-cap{left:10px;bottom:8px;font-size:12px}#ar-p-gun .ar-hint{display:none}
}
/* held upright (the game asks for sideways, but the page can still be opened): a smaller preview, the skins get the room */
@media(orientation:portrait) and (max-width:600px){
#ar-p-gun .ar-body{grid-template-rows:auto minmax(120px,24vh) minmax(0,1fr)}
}
`;
  document.head.appendChild(css);
  const ar = document.createElement("div");
  ar.id = "armory";
  ar.hidden = !0;
  ar.innerHTML = `<div class="ar-hd"><div><div class="lbl">${L("무기고", "Armoury")}</div><h2>${L("총 스킨", "Gun skins")}</h2></div>
    <nav class="ar-tabs" id="ar-tabs"><button class="ar-tab" data-tab="pull">${L("뽑기", "Pull")}</button><button class="ar-tab" data-tab="shop">${L("상점", "Shop")}</button><button class="ar-tab" data-tab="champions">${L("챔피언스", "Champions")}</button><button class="ar-tab" data-tab="mine">${L("내 스킨", "My skins")}<i id="ar-mine-n"></i></button><button class="ar-tab" data-tab="gun">${L("총별 장착", "By gun")}</button></nav>
    <div class="ar-hd-r"><span class="ar-gold" id="ar-gold">🪙 0</span><button class="btn btn-go" id="ar-close">${L("닫기", "Close")}</button></div></div>
    <section class="ar-pane" id="ar-p-pull"><div class="pl">
      <div class="pl-card pl-hero">
        <div class="pl-show" id="pl-show"><div class="pl-rays"></div><span class="pl-tag" id="pl-tag"></span><div class="ar-slot" id="slot-pull"></div><div class="pl-feat" id="pl-feat"></div></div>
        <div class="pl-act"><div class="lbl">${L("보급 상자", "Supply crate")}</div><h3>${L("스킨 뽑기", "Skin pull")}</h3>
          <p>${L("상자 하나에 총 한 자루용 스킨이 들어 있습니다 (예: 용암 돌격소총). 이미 가진 스킨은 다시 나오지 않고, 한 등급을 다 모으면 그 위 등급에서 나옵니다.", "Each crate holds a skin for one gun (say, a Lava assault rifle). Nothing you own comes again; once a tier is complete the next one up pays out.")}</p>
          <div class="pl-wallet"><span>${L("내 골드", "My gold")}</span><b id="pl-gold">🪙 0</b></div>
          <div class="pl-btns ar-gacha" id="ar-gacha"><button class="btn ar-pull" id="ar-pull1"></button><button class="btn ar-pull" id="ar-pull10"></button></div>
          <div class="ar-why" id="ar-why"></div><div class="pl-earn" id="pl-earn"></div><button class="btn pl-shop" id="pl-shop">${L("원하는 스킨은 상점에서 골라 사기 →", "Want a particular skin? Buy it in the shop →")}</button></div>
      </div>
      <div class="pl-card"><div class="lbl">${L("모은 스킨", "Collection")}</div><div class="pl-prog"><b id="pl-own">0</b><span id="pl-tot"></span></div><div class="pl-bar"><i id="pl-bar"></i></div><div id="pl-tiers"></div>
        <div class="pl-odds-t"><span class="ar-count" id="ar-count"></span> · <span class="ar-odds" id="ar-odds"></span></div></div>
      <div class="pl-card pl-rec"><div class="lbl">${L("최근 뽑은 스킨", "Recent pulls")}</div><div class="pl-recg" id="pl-recg"></div></div>
    </div></section>
    <section class="ar-pane" id="ar-p-shop" hidden>
      <div class="mi-f sh-f" id="sh-f"></div>
      <div class="mi"><div class="mi-list" id="sh-list"></div><div class="mi-side"><div class="ar-slot" id="slot-shop"></div><div class="mi-info" id="sh-info"></div></div></div>
    </section>
    <section class="ar-pane" id="ar-p-mine" hidden>
      <div class="mi-f" id="mi-f"></div>
      <div class="mi"><div class="mi-list" id="mi-list"></div><div class="mi-side"><div class="ar-slot" id="slot-mine"></div><div class="mi-info" id="mi-info"></div></div></div>
    </section>
    <section class="ar-pane" id="ar-p-gun" hidden>
      <div class="ar-tools"><span class="ar-tip">${L("총마다 스킨을 고릅니다. 내 손, 다른 사람 눈, 바닥에 떨어진 총에 모두 보입니다. 🔒 스킨은 눌러서 미리 보기만 됩니다.", "Pick a skin for each gun. It shows in your hands, to others and on the ground. 🔒 skins are preview only.")}</span><button class="btn" id="ar-all">${L("모든 총에 적용", "Apply to all")}</button><button class="btn" id="ar-rand">${L("무작위", "Random")}</button><button class="btn" id="ar-reset">${L("전부 기본", "All stock")}</button></div>
      <div class="ar-body"><div class="ar-guns" id="ar-guns"></div><div class="ar-slot" id="slot-gun"><div class="ar-view"><canvas id="ar-cv"></canvas><div class="ar-cap" id="ar-cap"></div><div class="ar-hint">${L("끌어서 돌리기", "Drag to turn")}</div></div></div><div class="ar-skins" id="ar-skins"></div></div>
    </section>
    <section class="ar-pane" id="ar-p-champions" hidden>
      <div class="champions-layout"><div class="ar-slot" id="slot-champions"></div><div id="champions-content"><h2>${L("챔피언스", "Champions")}</h2><p class="champions-intro">${L("초월 등급 팬텀 · 경기 완료로 모은 코인으로 원하는 스킨을 구매하세요. 뽑기는 기존 뽑기 탭에서 함께 진행합니다.", "Transcendent Phantom · Buy your skin with coins earned by completing matches. Champions drops remain in the regular Pull tab.")}</p></div></div>
    </section>
    <div id="ar-reveal" hidden><div class="rv-bg"><i class="rv-rays"></i></div><div class="rv-flash"></div><div class="rv-fx" id="rv-fx"></div>
      <div class="rv-box"><div class="rv-hd"><div class="lbl">${L("뽑기", "Pull")}</div><h3 id="rv-title"></h3></div>
        <div class="rv-main"><div class="rv-show"><div class="ar-slot" id="slot-rv"></div><div class="rv-cap" id="rv-cap"></div></div><div class="rv-grid" id="rv-grid"></div></div>
        <div class="rv-btns"><button class="btn btn-go" id="rv-equip">${L("장착", "Equip")}</button><button class="btn" id="rv-one">${L("1회 더", "Pull ×1 again")}</button><button class="btn" id="rv-ten">${L("10회 더", "Pull ×10 again")}</button><button class="btn" id="rv-close">${L("닫기", "Close")}</button></div>
        <div class="rv-hint" id="rv-hint"></div></div></div>
    <div id="ar-toast"></div>`;
  document.body.appendChild(ar);
  // tab: pull | mine | gun; view: an owned skin looked at in "my skins" (peek: one not owned); feat: the pull page's showcase
  const AR = { open: !1, key: "rifle", pv: null, raf: 0, peek: null, view: null, tab: "pull", feat: null, fi: -1, featT: 0 };
  try {
    const t = localStorage.getItem("lgp_ar_tab");
    ["pull", "shop", "champions", "mine", "gun"].includes(t) && (AR.tab = t);
  } catch (e) {}
  let noteT = 0;
  function note(msg) {
    const t = $("ar-toast");
    if (!AR.open || !t) {
      try {
        banner(msg, "#8a97ab");
      } catch (e) {}
      return;
    }
    t.textContent = msg;
    t.classList.add("on");
    clearTimeout(noteT);
    noteT = setTimeout(() => t.classList.remove("on"), 2200);
  }
  // the gold in the header and on the pull page, counting up or down
  let goldShown = 0,
    goldAnim = 0;
  function paintGold() {
    const el = $("ar-gold"),
      el2 = $("pl-gold");
    if (!el) return;
    clearInterval(goldAnim);
    const from = goldShown,
      to = INV.gold,
      t0 = Date.now();
    const step = () => {
      const k = Math.min(1, (Date.now() - t0) / 400);
      goldShown = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
      const txt = "🪙 " + goldShown.toLocaleString();
      el.textContent = txt;
      el2 && (el2.textContent = txt);
      k >= 1 && clearInterval(goldAnim);
    };
    step();
    from !== to && (goldAnim = setInterval(step, 16));
    paintGacha();
  }
  const TIERS = [
    ["common", 1],
    ["rare", 2],
    ["epic", 3],
    ["legendary", 4],
    ["transcendent", 5],
  ];
  // the pull page: prices, odds, the collection by tier, why a pull is off, the last pulls
  function paintGacha() {
    const row = $("ar-gacha");
    if (!row || !AR.open) return;
    const odds = GC().odds || { common: 60, rare: 25, epic: 11, legendary: 4 },
      w = (k) => Math.max(0, +odds[k] || 0),
      tot = TIERS.reduce((a, [k]) => a + w(k), 0) || 1;
    $("ar-odds").innerHTML = TIERS.map(([k, r]) => `<i style="color:${RAR[r].c}">${EN ? RAR[r].en : RAR[r].ko} ${r === 5 ? SKIN_TIERS.transcendentPercent + "%" : Math.round((1000 * w(k)) / tot) / 10 + "%"}</i>`).join("");
    $("ar-count").textContent = `${L("스킨", "Skins")} ${ownedAll()}/${itemsAll()}`;
    const left = pullableLeft(),
      disc = Math.round(100 * (1 - costOf(10) / Math.max(1, 10 * costOf(1))));
    let why1 = "";
    for (const n of [1, 10]) {
      const b = $("ar-pull" + n),
        cost = costOf(n);
      b.innerHTML = `${L(n + "회 뽑기", 1 === n ? "Pull ×1" : "Pull ×10")}<i>🪙 ${cost.toLocaleString()}</i>${10 === n && disc > 0 ? `<em>${disc}% ${L("할인", "off")}</em>` : ""}`;
      const why = !gated() ? L("파일로 연 게임: 모든 스킨이 열려 있습니다", "Opened from a file: every skin is free") : !token() ? L("로그인하면 뽑을 수 있습니다", "Sign in to pull") : !INV.synced ? (syncError ? L("스킨 정보를 불러오지 못했습니다 · 무기고를 다시 열어주세요", "Could not load skins · reopen the armory to retry") : L("스킨 정보를 불러오는 중…", "Loading your skins…")) : INV.busy ? L("뽑는 중…", "Pulling…") : left < n ? (left > 0 ? L(`남은 스킨 ${left}개`, `${left} skins left`) : L("일반~전설 뽑기 스킨을 모두 모았습니다", "You own every Common-Legendary pull skin")) : INV.gold < cost ? L("골드가 부족합니다 · 경기를 이기면 100, 지면 30, 처치마다 5", "Not enough gold · a win pays 100, a loss 30, each kill 5") : "";
      b.disabled = !!why;
      b.title = why;
      1 === n && (why1 = why);
    }
    $("ar-why").textContent = why1;
    const own = ownedAll(),
      all = itemsAll();
    $("pl-own").textContent = own.toLocaleString();
    $("pl-tot").textContent = "/ " + all.toLocaleString() + L("개", "");
    $("pl-bar").style.width = (all ? (100 * own) / all : 0).toFixed(1) + "%";
    $("pl-tiers").innerHTML = TIERS.map(([k, r]) => {
      let t = 0,
        o = 0;
      for (const g in WEAPONS)
        for (const s of skinsFor(g))
          if (s.rar === r) {
            t++;
            owns(g, s.id) && o++;
          }
      return `<div class="pl-tier"><b style="color:${RAR[r].c}">${EN ? RAR[r].en : RAR[r].ko}</b><em>${r === 5 ? SKIN_TIERS.transcendentPercent + "%" : Math.round((1000 * w(k)) / tot) / 10 + "%"}</em><div class="pl-bar"><i style="width:${t ? ((100 * o) / t).toFixed(1) : 0}%;background:${RAR[r].c}"></i></div><small>${o}/${t}</small></div>`;
    }).join("");
    const G = (window.SERVER_CFG && window.SERVER_CFG.gold) || {},
      gv = (k, d) => (isFinite(+G[k]) && null != G[k] ? +G[k] : d);
    $("pl-earn").textContent = L(`골드 얻는 법: 이기면 ${gv("perWin", 100)} · 지면 ${gv("perLoss", 30)} · 처치마다 ${gv("perKill", 5)}`, `Earn gold: a win ${gv("perWin", 100)} · a loss ${gv("perLoss", 30)} · each kill ${gv("perKill", 5)}`);
    paintRecent();
    const mn = $("ar-mine-n");
    mn && (mn.textContent = own ? own.toLocaleString() : "");
  }
  // the last pulls, kept on this device for this account
  const HK = "lgp_pulls";
  const hist = () => {
    try {
      const j = JSON.parse(localStorage.getItem(HK) || "null"),
        me = session() && session().user;
      return j && Array.isArray(j.l) && me && j.id === me.id ? j.l : [];
    } catch (e) {
      return [];
    }
  };
  function addHist(results) {
    try {
      const me = session() && session().user;
      if (!me) return;
      const l = results
        .map((r) => ({ g: r.g, s: r.s, t: Date.now() }))
        .reverse()
        .concat(hist())
        .slice(0, 40);
      localStorage.setItem(HK, JSON.stringify({ id: me.id, l }));
    } catch (e) {}
  }
  // a card for one item, a gun in a skin: a picture of the gun once it is painted
  function itemCard(g, s, extra) {
    const b = document.createElement("button");
    b.className = "it" + (extra || "");
    b.style.setProperty("--rc", RAR[s.rar].c);
    b.dataset.g = g;
    b.dataset.s = s.id;
    const th = thumbCached(g, s.id);
    b.innerHTML = `<img alt="" class="th${th ? " r" : ""}" src="${th || swatchURL(s)}" data-th="${g}|${s.id}"><small>${(WEAPONS[g] || { name: g }).name}</small><b>${nameOf(s)}</b><i>${EN ? RAR[s.rar].en : RAR[s.rar].ko}</i>`;
    return b;
  }
  function paintRecent() {
    const box = $("pl-recg");
    if (!box) return;
    const l = hist()
      .filter((r) => WEAPONS[r.g] && BY[r.s])
      .slice(0, 20);
    const sig = l.map((r) => r.g + r.s).join();
    if (box.dataset.sig === sig && box.childElementCount) return;
    box.dataset.sig = sig;
    box.innerHTML = "";
    if (!l.length) {
      box.innerHTML = `<div class="pl-empty">${signed() ? L("아직 뽑은 스킨이 없습니다", "No pulls yet") : gated() ? L("로그인하면 골드로 스킨을 뽑을 수 있습니다", "Sign in to pull skins with gold") : L("파일로 연 게임에서는 모든 스킨이 열려 있습니다 · 내 스킨 탭에서 고르세요", "Opened from a file every skin is free · pick one under My skins")}</div>`;
      return;
    }
    for (const r of l) {
      const c = itemCard(r.g, BY[r.s]);
      c.onclick = () => {
        setTab("mine");
        selectItem(r.g, r.s);
      };
      box.appendChild(c);
    }
    box.querySelectorAll("img.th:not(.r)").forEach(thLater);
  }

  // ── sounds for the pull (made on the spot; off with the game's sound setting) ──
  const AU = { c: null, g: null, nb: null };
  function au() {
    if ("object" == typeof SETTINGS && SETTINGS && !SETTINGS.sfx) return null;
    try {
      if (!AU.c) {
        const C = window.AudioContext || window.webkitAudioContext;
        if (!C) return null;
        AU.c = GAME_AUDIO.context();
        AU.g = AU.c.createGain();
        AU.g.gain.value = 0.3;
        AU.g.connect(GAME_AUDIO.output);
      }
      "suspended" === AU.c.state && AU.c.resume();
      return AU.c;
    } catch (e) {
      return null;
    }
  }
  function tone(f, d, o) {
    o = o || {};
    const c = au();
    if (!c) return;
    try {
      const t = c.currentTime + (o.at || 0),
        os = c.createOscillator(),
        g = c.createGain();
      os.type = o.w || "sine";
      os.frequency.setValueAtTime(f, t);
      o.to && os.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + d);
      g.gain.setValueAtTime(1e-4, t);
      g.gain.exponentialRampToValueAtTime(o.v || 0.3, t + (o.a || 0.01));
      g.gain.exponentialRampToValueAtTime(1e-4, t + d);
      os.connect(g);
      g.connect(AU.g);
      os.start(t);
      os.stop(t + d + 0.05);
    } catch (e) {}
  }
  function hiss(d, o) {
    o = o || {};
    const c = au();
    if (!c) return;
    try {
      if (!AU.nb) {
        AU.nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
        const a = AU.nb.getChannelData(0);
        for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1;
      }
      const t = c.currentTime + (o.at || 0),
        s = c.createBufferSource(),
        f = c.createBiquadFilter(),
        g = c.createGain();
      s.buffer = AU.nb;
      f.type = o.ft || "bandpass";
      f.frequency.setValueAtTime(o.f || 1200, t);
      o.fto && f.frequency.exponentialRampToValueAtTime(o.fto, t + d);
      f.Q.value = o.q || 0.8;
      g.gain.setValueAtTime(1e-4, t);
      g.gain.exponentialRampToValueAtTime(o.v || 0.3, t + (o.a || 0.01));
      g.gain.exponentialRampToValueAtTime(1e-4, t + d);
      s.connect(f);
      f.connect(g);
      g.connect(AU.g);
      s.start(t, Math.random());
      s.stop(t + d + 0.05);
    } catch (e) {}
  }
  // the crate's hum, rising until it bursts
  function hum() {
    const c = au(),
      none = { stop() {} };
    if (!c) return none;
    try {
      const t = c.currentTime,
        o1 = c.createOscillator(),
        o2 = c.createOscillator(),
        f = c.createBiquadFilter(),
        g = c.createGain(),
        lfo = c.createOscillator(),
        lg = c.createGain();
      o1.type = "sawtooth";
      o2.type = "triangle";
      o1.frequency.setValueAtTime(70, t);
      o1.frequency.exponentialRampToValueAtTime(240, t + 1.5);
      o2.frequency.setValueAtTime(141, t);
      o2.frequency.exponentialRampToValueAtTime(490, t + 1.5);
      f.type = "lowpass";
      f.frequency.setValueAtTime(260, t);
      f.frequency.exponentialRampToValueAtTime(2200, t + 1.5);
      f.Q.value = 5;
      lfo.frequency.setValueAtTime(5, t);
      lfo.frequency.linearRampToValueAtTime(19, t + 1.5);
      lg.gain.value = 0.05;
      lfo.connect(lg);
      lg.connect(g.gain);
      g.gain.setValueAtTime(1e-4, t);
      g.gain.exponentialRampToValueAtTime(0.11, t + 0.5);
      o1.connect(f);
      o2.connect(f);
      f.connect(g);
      g.connect(AU.g);
      [o1, o2, lfo].forEach((o) => o.start(t));
      return {
        stop() {
          try {
            const n = c.currentTime;
            g.gain.cancelScheduledValues(n);
            g.gain.setValueAtTime(0.08, n);
            g.gain.exponentialRampToValueAtTime(1e-4, n + 0.08);
            [o1, o2, lfo].forEach((o) => o.stop(n + 0.1));
          } catch (e) {}
        },
      };
    } catch (e) {
      return none;
    }
  }
  const SND = {
    thud() {
      tone(92, 0.38, { to: 36, v: 0.55 });
      hiss(0.28, { f: 240, ft: "lowpass", v: 0.4 });
    },
    shift(r) {
      const f = [0, 660, 784, 988, 1319][r] || 880;
      tone(f, 0.55, { v: 0.16, w: "triangle" });
      tone(f * 1.5, 0.7, { v: 0.09, at: 0.06 });
      hiss(0.3, { f: 5000, ft: "highpass", v: 0.08 });
    },
    boom(r) {
      hiss(0.95, { f: 1000, fto: 110, ft: "lowpass", v: 0.6, q: 0.5 });
      tone(128, 0.75, { to: 30, v: 0.55 });
      const up = r >= 4 ? 1.26 : 1;
      if (r >= 3) [523, 659, 784, 1047].forEach((f, i) => tone(f * up, 1.5, { v: 0.085, w: "triangle", at: 0.05 + i * 0.035 }));
      else [523, 784].forEach((f, i) => tone(f, 0.9, { v: 0.06, w: "triangle", at: 0.05 + i * 0.04 }));
    },
    flip() {
      hiss(0.13, { f: 3400, ft: "highpass", v: 0.13 });
    },
    card(r) {
      const b = [0, 523, 587, 659, 784, 1047][r] || 523;
      tone(b * 2, 0.26, { v: 0.11, w: "triangle" });
      r >= 3 && tone(b * 3, 0.5, { v: 0.09, at: 0.07 });
      r >= 4 && [1, 1.26, 1.5, 2].forEach((k, i) => tone(b * 2 * k, 0.7, { v: 0.075, at: 0.12 + i * 0.07 }));
    },
    charge() {
      tone(380, 0.4, { to: 1300, v: 0.07, w: "sawtooth" });
    },
    fizzle() {
      hiss(0.45, { f: 700, fto: 140, v: 0.22 });
      tone(210, 0.45, { to: 60, v: 0.14, w: "sawtooth" });
    },
  };

  // ── sparks, rings, gold flakes over the reveal ──
  function fxAt(nodes, ms) {
    const box = $("rv-fx");
    if (!box) return;
    const f = document.createDocumentFragment();
    nodes.forEach((n) => f.appendChild(n));
    box.appendChild(f);
    setTimeout(() => nodes.forEach((n) => n.remove()), ms);
  }
  function fxBurst(x, y, col, n, o) {
    o = o || {};
    const l = [],
      d = o.d || 0.9;
    for (let i = 0; i < n; i++) {
      const p = document.createElement("i"),
        a = Math.random() * Math.PI * 2,
        sp = (o.sp || 260) * (0.35 + Math.random() * 0.9);
      p.className = "rv-p" + (o.sq && Math.random() < 0.5 ? " sq" : "");
      p.style.cssText = `left:${x}px;top:${y}px;--c:${Math.random() < (o.white || 0.22) ? "#fff" : col};--s:${((o.size || 6) * (0.5 + Math.random())).toFixed(1)}px;--dx:${(Math.cos(a) * sp).toFixed(0)}px;--dy:${(Math.sin(a) * sp + (o.fall || 0) * Math.random()).toFixed(0)}px;--d:${(d * (0.6 + Math.random() * 0.7)).toFixed(2)}s;--r:${Math.round(Math.random() * 720 - 360)}deg`;
      l.push(p);
    }
    fxAt(l, d * 1400 + 150);
  }
  function fxRing(x, y, col, k) {
    const r = document.createElement("i");
    r.className = "rv-ring";
    r.style.cssText = `left:${x}px;top:${y}px;--c:${col};--k:${k || 9}`;
    fxAt([r], 900);
  }
  function confetti(col) {
    const b = $("ar-reveal");
    if (!b) return;
    const W = b.clientWidth,
      l = [];
    for (let i = 0; i < 46; i++) {
      const p = document.createElement("i");
      p.className = "rv-fall";
      p.style.cssText = `left:${(Math.random() * W).toFixed(0)}px;--c:${Math.random() < 0.3 ? "#fff6d5" : col};--dx:${(Math.random() * 120 - 60).toFixed(0)}px;--d:${(1.8 + Math.random() * 1.6).toFixed(2)}s;--r:${Math.round(Math.random() * 900 + 200)}deg;animation-delay:${(Math.random() * 0.9).toFixed(2)}s`;
      l.push(p);
    }
    fxAt(l, 4600);
  }
  // the middle of the showcase, in the reveal's own coordinates (and the page's)
  function fxCenter(page) {
    const s = $("slot-rv"),
      b = $("ar-reveal");
    if (!s || !b) return [0, 0];
    const r = s.getBoundingClientRect(),
      q = b.getBoundingClientRect(),
      x = r.left + r.width / 2,
      y = r.top + r.height * 0.52;
    return page ? [x, y] : [x - q.left, y - q.top];
  }

  // ── the turntable: one canvas, moved to the pane that shows it ──
  const easeBack = (k) => 1 + 2.4 * Math.pow(k - 1, 3) + 1.4 * Math.pow(k - 1, 2);
  function studio(r) {
    const sc = new T.Scene();
    sc.add(new T.HemisphereLight(0xcfe3ff, 0x2a2420, 0.9));
    const key = new T.DirectionalLight(0xfff1dc, 2.2);
    key.position.set(2, 3, 2.5);
    sc.add(key);
    const rim = new T.DirectionalLight(0x8ab8ff, 1.1);
    rim.position.set(-3, 1.5, -2);
    sc.add(rim);
    // a room of lit panels to reflect in the metal
    try {
      const env = new T.Scene();
      env.background = new T.Color(0x1a2030);
      const panel = (c, x, y, z, sx, sy, sz) => {
        const m = new T.Mesh(new T.BoxGeometry(sx, sy, sz), new T.MeshBasicMaterial({ color: c }));
        m.position.set(x, y, z);
        env.add(m);
      };
      panel(0xffffff, 0, 5, 0, 6, 0.2, 6);
      panel(0xffe6c0, 4, 1, 2, 0.2, 2.5, 3);
      panel(0x9fc4ff, -4, 1.5, -1, 0.2, 2, 4);
      panel(0x303848, 0, -3, 0, 8, 0.2, 8);
      const pg = new T.PMREMGenerator(r);
      sc.environment = pg.fromScene(env, 0.04).texture;
      pg.dispose();
    } catch (e) {}
    return sc;
  }
  const look = (r) => {
    try {
      r.outputColorSpace = renderer.outputColorSpace;
      r.toneMapping = renderer.toneMapping;
      r.toneMappingExposure = renderer.toneMappingExposure;
    } catch (e) {}
  };
  function pvInit() {
    if (AR.pv) return AR.pv;
    const cv = $("ar-cv"),
      r = new T.WebGLRenderer({ canvas: cv, antialias: !0, alpha: !0 });
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    look(r);
    const sc = studio(r);
    const cam = new T.PerspectiveCamera(28, 1, 0.01, 40);
    const pivot = new T.Group(),
      stage = new T.Group();
    sc.add(pivot, stage);
    AR.pv = { r, sc, cam, pivot, stage, obj: null, yaw: 0, pitch: 0.18, pc: 0.18, dist: 1, d: 1, ty: 0, tyc: 0, shake: 0, popT: 0, drag: null, auto: !0, last: 0, dt: 0.016, cine: null, rise: null };
    // drag to turn (not while a crate is still opening)
    const P = AR.pv;
    cv.addEventListener("pointerdown", (e) => {
      if (P.cine && !RV.done) return;
      P.drag = { x: e.clientX, y: e.clientY, yaw: P.yaw, pitch: P.pitch };
      P.auto = !1;
      cv.setPointerCapture && cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener("pointermove", (e) => {
      if (!P.drag) return;
      P.yaw = P.drag.yaw + (e.clientX - P.drag.x) * 0.012;
      P.pitch = Math.max(-1.2, Math.min(1.2, P.drag.pitch + (e.clientY - P.drag.y) * 0.008));
      pvRender();
    });
    const up = () => (P.drag = null);
    cv.addEventListener("pointerup", up);
    cv.addEventListener("pointercancel", up);
    return P;
  }
  // what the turntable shows: the reveal's pick, the pull page's showcase, or the gun being dressed
  function pvTarget() {
    if (RV.on) return RV.item;
    if ("pull" === AR.tab) return AR.feat;
    if ("shop" === AR.tab) return shopPick();
    const id = AR.peek && BY[AR.peek] ? AR.peek : AR.view && BY[AR.view] ? AR.view : mySkin(AR.key).id;
    return { g: AR.key, s: id };
  }
  function pvClear(P) {
    if (!P.obj) return;
    P.pivot.remove(P.obj);
    P.obj.traverse((o) => o.isMesh && o.geometry && o.geometry.dispose());
    P.obj = null;
  }
  function pvShow() {
    const P = pvInit();
    pvClear(P);
    const tg = pvTarget();
    if (!tg || !WEAPONS[tg.g]) return void pvRender();
    const shown = skinById(tg.s);
    if (window.CHAMPIONS_PHANTOM?.isSkin(shown.id) && !CHAMPIONS_PHANTOM.loaded()) return void pvRender();
    let g = null;
    try {
      g = buildFor(tg.g, shown);
    } catch (e) {}
    if (!g) return void pvRender();
    applySkin(g, shown);
    const b = new T.Box3().setFromObject(g),
      c = b.getCenter(new T.Vector3()),
      s = b.getSize(new T.Vector3());
    g.position.sub(c);
    const w = new T.Group();
    w.add(g);
    // the showcase and the reveal show every gun the same size; dressing shows it as it is
    if (RV.on || "pull" === AR.tab || "shop" === AR.tab) {
      const k = 0.95 / Math.max(s.x, s.y, s.z, 0.05);
      w.scale.setScalar(k);
      P.fit = { L: k * Math.max(s.x, s.z), H: k * s.y, w: RV.on ? 0.48 : 0.6, h: RV.on ? 0.5 : 0.56 };
    } else {
      P.fit = null;
      P.dist = Math.max(s.z * 2.3, s.y * 2.8, s.x * 2.8, 0.45);
    }
    P.pivot.add(w);
    P.obj = w;
    P.ty = 0;
    if (!P.rise) {
      P.pivot.position.y = 0;
      P.popT = performance.now();
    }
    P.cine || (P.auto = !0);
    pvRender();
  }
  function pvRender(now) {
    const P = AR.pv;
    if (!P) return;
    now = now || performance.now();
    const cv = P.r.domElement,
      w = cv.clientWidth || 300,
      h = cv.clientHeight || 220;
    (cv.width !== Math.round(w * P.r.getPixelRatio()) || cv.height !== Math.round(h * P.r.getPixelRatio())) && P.r.setSize(w, h, !1);
    P.cam.aspect = w / h;
    P.cam.updateProjectionMatrix();
    // a framed gun fills a share of the view, whatever its shape
    if (P.fit && !P.cine) {
      const tan = Math.tan((P.cam.fov * Math.PI) / 360);
      P.dist = Math.max(P.fit.L / (2 * tan * P.cam.aspect * P.fit.w), P.fit.H / (2 * tan * P.fit.h), 0.9);
    } else if (P.fit && P.cine && P.cine.bt) {
      const tan = Math.tan((P.cam.fov * Math.PI) / 360);
      P.dist = Math.max(P.fit.L / (2 * tan * P.cam.aspect * P.fit.w), P.fit.H / (2 * tan * P.fit.h), 1.6);
    }
    // the camera eases to where it should be; a drag moves it at once
    const k = Math.min(1, (P.dt || 0.016) * 7);
    P.d += (P.dist - P.d) * k;
    P.tyc += (P.ty - P.tyc) * k;
    P.pc = P.drag ? P.pitch : P.pc + (P.pitch - P.pc) * k;
    // a new gun pops in
    if (!P.rise) {
      const pk = P.popT ? Math.min(1, (now - P.popT) / 420) : 1;
      P.pivot.scale.setScalar(0.8 + 0.2 * easeBack(pk));
    }
    // seen from the side, the muzzle to the left, a little from above
    P.pivot.rotation.set(0, Math.PI / 2 + 0.35 + P.yaw, 0);
    let sx = 0,
      sy = 0;
    if (P.shake > 0.002) {
      sx = (Math.random() - 0.5) * P.shake;
      sy = (Math.random() - 0.5) * P.shake;
      P.shake *= 0.86;
    }
    P.cam.position.set(sx, P.tyc + Math.sin(P.pc) * P.d + sy, Math.cos(P.pc) * P.d);
    P.cam.lookAt(sx * 0.5, P.tyc, 0);
    P.r.render(P.sc, P.cam);
  }

  // ── the supply crate ──
  let shadowTex = null;
  function buildCrate() {
    const W = 0.96,
      H = 0.56,
      D = 0.62,
      th = 0.045;
    const shell = new T.MeshStandardMaterial({ color: 0x4a5870, metalness: 0.55, roughness: 0.38 }),
      frame = new T.MeshStandardMaterial({ color: 0x1a1f28, metalness: 0.6, roughness: 0.45 }),
      tape = new T.MeshStandardMaterial({ color: 0xe8b23a, metalness: 0.25, roughness: 0.55 }),
      glow = new T.MeshStandardMaterial({ color: 0x050505, emissive: 0xffffff, emissiveIntensity: 1, roughness: 0.6, metalness: 0 }),
      pad = new T.MeshStandardMaterial({ color: 0x050505, emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 0.6, metalness: 0, side: T.DoubleSide });
    const mats = [shell, frame, tape, glow, pad];
    const box = (w, h, d, m, x, y, z, p) => {
      const o = new T.Mesh(new T.BoxGeometry(w, h, d), m);
      o.position.set(x, y, z);
      p.add(o);
      return o;
    };
    const root = new T.Group();
    box(W, th, D, frame, 0, th / 2, 0, root);
    box(W - 0.12, 0.01, D - 0.12, glow, 0, th + 0.006, 0, root);
    // four walls, each hinged at its foot so it can fall open
    const wall = (axis, sgn) => {
      const p = new T.Group(),
        front = "z" === axis;
      front ? p.position.set(0, th, (sgn * D) / 2) : p.position.set((sgn * W) / 2, th, 0);
      const ww = front ? W : th,
        dd = front ? th : D,
        ox = front ? 0 : (-sgn * th) / 2,
        oz = front ? (-sgn * th) / 2 : 0;
      box(ww, H, dd, shell, ox, H / 2, oz, p);
      // bands, corner posts and a seam of light at each end
      for (const y of [H * 0.18, H * 0.82]) box(front ? W + 0.012 : th + 0.014, 0.05, front ? th + 0.014 : D + 0.012, frame, ox, y, oz, p);
      if (front) {
        for (const x of [-W / 2 + 0.035, W / 2 - 0.035]) box(0.07, H, th + 0.03, frame, x, H / 2, oz, p);
        // the emblem: a ring and a diamond of light; hazard tape on the back
        if (sgn > 0) {
          const ring = new T.Mesh(new T.TorusGeometry(0.1, 0.013, 10, 40), glow);
          ring.position.set(0, H / 2, oz + th / 2 + 0.008);
          p.add(ring);
          const dia = new T.Mesh(new T.OctahedronGeometry(0.045), glow);
          dia.position.set(0, H / 2, oz + th / 2 + 0.02);
          p.add(dia);
          for (const x of [-W * 0.3, W * 0.3]) box(0.16, 0.045, th + 0.016, tape, x, H * 0.5, oz, p);
        } else box(W * 0.8, 0.07, th + 0.016, tape, 0, H / 2, oz, p);
      } else for (const z of [-D / 2 + 0.06, D / 2 - 0.06]) box(th + 0.02, H * 0.86, 0.016, glow, ox + (sgn * th) / 2, H / 2, z, p);
      root.add(p);
      return p;
    };
    const walls = [wall("z", 1), wall("z", -1), wall("x", -1), wall("x", 1)];
    // the lid: a slab, a plate and a cross of light
    const lid = new T.Group();
    lid.position.y = th + H;
    box(W + 0.05, 0.07, D + 0.05, shell, 0, 0.035, 0, lid);
    box(W * 0.56, 0.02, D * 0.56, frame, 0, 0.08, 0, lid);
    box(W * 0.62, 0.012, 0.03, glow, 0, 0.092, 0, lid);
    box(0.03, 0.012, D * 0.62, glow, 0, 0.092, 0, lid);
    root.add(lid);
    const light = new T.PointLight(0xffffff, 0, 3.2, 2);
    light.position.set(0, H * 0.6, 0);
    root.add(light);
    // a ring of light on the floor and a soft shadow
    const base = new T.Group();
    const ringM = new T.Mesh(new T.RingGeometry(0.66, 0.7, 64), pad);
    ringM.rotation.x = -Math.PI / 2;
    ringM.position.y = 0.003;
    base.add(ringM);
    if (!shadowTex) {
      const c = document.createElement("canvas");
      c.width = c.height = 128;
      const g = c.getContext("2d"),
        gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
      gr.addColorStop(0, "rgba(0,0,0,.6)");
      gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
      shadowTex = new T.CanvasTexture(c);
    }
    const sh = new T.Mesh(new T.CircleGeometry(0.85, 40), new T.MeshBasicMaterial({ map: shadowTex, transparent: !0, depthWrite: !1 }));
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.001;
    base.add(sh);
    mats.push(sh.material);
    return { root, walls, lid, lidY: lid.position.y, glow, pad, light, base, mats, H };
  }
  function crateColor(cr, col) {
    const c = new T.Color(col);
    cr.glow.emissive.copy(c);
    cr.pad.emissive.copy(c);
    cr.light.color.copy(c);
  }
  function cineStart(P) {
    cineEnd(P);
    const cr = buildCrate(),
      base = -0.44;
    cr.root.position.y = base + 1.9;
    cr.root.rotation.y = -0.5;
    cr.base.position.y = base;
    P.stage.add(cr.root, cr.base);
    crateColor(cr, "#7f90aa");
    P.cine = { t0: performance.now(), cr, base, ry: -0.5, big: !1, landed: !1, bt: 0, fail: 0 };
    P.fit = null;
    P.dist = P.d = 2.75;
    P.pitch = P.pc = 0.4;
    P.ty = P.tyc = -0.16;
    P.yaw = 0;
    P.auto = !1;
    P.rise = null;
    P.pivot.position.y = 0;
    P.pivot.scale.setScalar(1);
  }
  function cineEnd(P) {
    const C = P.cine;
    if (C) {
      P.stage.remove(C.cr.root, C.cr.base);
      for (const o of [C.cr.root, C.cr.base]) o.traverse((m) => m.isMesh && m.geometry && m.geometry.dispose());
      C.cr.mats.forEach((m) => m.dispose());
    }
    P.cine = null;
    P.rise = null;
    P.pivot.position.y = 0;
    P.pivot.scale.setScalar(1);
    P.ty = 0;
    P.pitch = 0.18;
    P.auto = !0;
  }
  function cineStep(P, now) {
    const C = P.cine;
    if (!C) return;
    const cr = C.cr,
      t = (now - C.t0) / 1e3;
    if (C.fail) {
      // nothing came back: the crate sputters and shrinks away
      const u = (now - C.fail) / 1e3,
        s = Math.max(0.001, 1 - u / 0.45);
      cr.root.scale.setScalar(s);
      cr.glow.emissiveIntensity = 0.15;
      cr.light.intensity = 0;
      return;
    }
    // the drop, a bounce, the landing
    const dropT = 0.5;
    let y = 0;
    if (t < dropT) {
      const k = t / dropT;
      y = 1.9 * (1 - k * k);
    } else if (t < dropT + 0.24) y = 0.11 * Math.sin((Math.PI * (t - dropT)) / 0.24);
    if (!C.landed && t >= dropT) {
      C.landed = !0;
      P.shake = 0.07;
    }
    if (!C.bt) {
      cr.root.position.y = C.base + y;
      // the charge: brighter seams, a faster pulse, a harder tremble
      const k = Math.max(0, Math.min(1, (t - dropT) / 1.1)),
        pul = 0.5 + 0.5 * Math.sin(t * (8 + 28 * k)),
        amp = (0.002 + 0.016 * k * k) * (C.big ? 1.8 : 1);
      cr.root.position.x = (Math.random() - 0.5) * amp * 2;
      cr.root.position.z = (Math.random() - 0.5) * amp * 2;
      cr.root.rotation.y = C.ry + Math.sin(t * 1.2) * 0.06 + (Math.random() - 0.5) * amp * 3;
      cr.glow.emissiveIntensity = 0.55 + 0.85 * k + 0.45 * k * pul;
      cr.pad.emissiveIntensity = 0.45 + 0.9 * k;
      cr.light.intensity = 0.15 + 2.8 * k * (0.7 + 0.3 * pul);
      cr.lid.position.y = cr.lidY + 0.014 * k * pul;
      return;
    }
    const u = (now - C.bt) / 1e3;
    cr.root.position.set(0, C.base, 0);
    // the lid flies off, spinning
    cr.lid.position.set(0.9 * u, cr.lidY + 3.4 * u - 2.6 * u * u, -0.2 * u);
    cr.lid.rotation.set(1.5 * u, 0, -2.4 * u);
    // the walls fall open
    const a = Math.min(1, u / 0.3),
      ang = (Math.PI / 2) * (1 - Math.pow(1 - a, 3));
    cr.walls[0].rotation.x = ang;
    cr.walls[1].rotation.x = -ang;
    cr.walls[2].rotation.z = ang;
    cr.walls[3].rotation.z = -ang;
    // a flash from inside, then the light settles
    cr.light.intensity = u < 0.08 ? 16 * (u / 0.08) : 16 * Math.exp(-(u - 0.08) * 4) + 1.2;
    cr.glow.emissiveIntensity = 3.6 * Math.exp(-u * 2) + 0.6;
    cr.pad.emissiveIntensity = 2.4 * Math.exp(-u * 1.5) + 0.9;
    // once the gun is up the crate sinks away; the ring of light stays under it
    if (u > 0.6) {
      const s = Math.max(0, 1 - (u - 0.6) / 0.45);
      cr.root.scale.setScalar(Math.max(0.001, s));
      cr.root.position.y = C.base - (1 - s) * 0.2;
      s <= 0 && (cr.root.visible = cr.base.visible = !1);
      cr.base.scale.setScalar(Math.max(0.001, s));
    }
  }
  // the best gun rises out of the open crate, spinning down to the turntable's pace
  function riseStep(P, now) {
    const u = (now - P.rise.t0) / 1e3,
      k = Math.min(1, u / 0.7),
      e = easeBack(k);
    P.pivot.position.y = -0.36 + 0.4 * e;
    P.pivot.scale.setScalar(Math.max(0.05, 0.2 + 0.8 * e));
    P.yaw += (P.dt || 0.016) * (0.45 + 15 * Math.exp(-u * 3.2));
    if (u > 1.5) {
      P.rise = null;
      P.popT = 0;
      P.pivot.position.y = 0.04;
      P.pivot.scale.setScalar(1);
      P.auto = !0;
    }
  }
  function pvLoop(t) {
    if (!AR.open) return;
    const P = AR.pv;
    if (P) {
      const dt = Math.max(0, Math.min(0.1, (t - (P.last || t)) / 1e3));
      P.last = t;
      P.dt = dt || 0.016;
      // the pull page's showcase turns to the next skin every few seconds
      if (!RV.on && "pull" === AR.tab && AR.feat && t > AR.featT && !P.drag) {
        nextFeat();
        pvShow();
      }
      cineStep(P, t);
      if (P.rise) riseStep(P, t);
      else P.auto && !P.drag && (P.yaw += P.dt * 0.45);
      animate(P.dt);
      pvRender(t);
    }
    AR.raf = requestAnimationFrame(pvLoop);
  }

  // ── the gun pictures on the cards: a second small renderer, one picture per gun and skin ──
  const TH = { r: null, sc: null, cam: null, cache: new Map(), q: [], timer: 0 };
  const thumbCached = (g, s) => TH.cache.get(g + "|" + s) || "";
  function thInit() {
    if (TH.r) return TH.r;
    const cv = document.createElement("canvas");
    cv.width = 256;
    cv.height = 128;
    const r = new T.WebGLRenderer({ canvas: cv, antialias: !0, alpha: !0, preserveDrawingBuffer: !0 });
    r.setPixelRatio(1);
    r.setSize(256, 128, !1);
    look(r);
    TH.sc = studio(r);
    TH.cam = new T.PerspectiveCamera(22, 2, 0.01, 40);
    TH.r = r;
    return r;
  }
  function thumbNow(g, sid) {
    const key = g + "|" + sid;
    if (TH.cache.has(key)) return TH.cache.get(key);
    let url = "";
    try {
      thInit();
      const skin = skinById(sid),
        gun = WEAPONS[g] ? buildFor(g, skin) : null;
      if (gun) {
        applySkin(gun, skin);
        const w = new T.Group();
        w.add(gun);
        gun.position.sub(new T.Box3().setFromObject(gun).getCenter(new T.Vector3()));
        w.rotation.y = Math.PI / 2 + 0.3;
        TH.sc.add(w);
        w.updateMatrixWorld(!0);
        const b = new T.Box3().setFromObject(w),
          s = b.getSize(new T.Vector3());
        w.position.sub(b.getCenter(new T.Vector3()));
        const tan = Math.tan((TH.cam.fov * Math.PI) / 360),
          d = Math.max((s.y * 1.3) / (2 * tan), (s.x * 1.12) / (2 * tan * TH.cam.aspect)) + s.z / 2;
        TH.cam.position.set(0, d * 0.16, d);
        TH.cam.lookAt(0, 0, 0);
        TH.r.render(TH.sc, TH.cam);
        url = TH.r.domElement.toDataURL("image/png");
        TH.sc.remove(w);
        w.traverse((o) => o.isMesh && o.geometry && o.geometry.dispose());
      }
    } catch (e) {
      url = "";
    }
    TH.cache.set(key, url);
    return url;
  }
  function thQueue(img) {
    TH.q.push(img);
    TH.timer || (TH.timer = setTimeout(thPump, 16));
  }
  // a few pictures at a time, so nothing stalls
  function thPump() {
    TH.timer = 0;
    const t0 = performance.now();
    while (TH.q.length && performance.now() - t0 < 18) {
      const img = TH.q.shift();
      if (!img || !img.isConnected || !img.dataset.th) continue;
      const [g, s] = img.dataset.th.split("|"),
        u = thumbNow(g, s);
      u && ((img.src = u), img.classList.add("r"));
    }
    TH.q.length && (TH.timer = setTimeout(thPump, 30));
  }
  const TIO = "IntersectionObserver" in window ? new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && (TIO.unobserve(e.target), thQueue(e.target))), { rootMargin: "160px" }) : null;
  const thLater = (img) => (TIO ? TIO.observe(img) : thQueue(img));

  // ── the reveal: a crate drops, charges, bursts; cards fly out and turn over ──
  const RV = { on: !1, timers: [], res: [], sel: -1, done: !1, n: 0, best: 0, item: null, burst: !1, skip: !1, hum: null };
  const rvT = (fn, ms) => RV.timers.push(setTimeout(fn, Math.max(0, ms)));
  const tierOf = (r) => skinById(r.s).rar;
  // the canvas goes to the reveal while it runs, else to the open tab
  function placeView() {
    const v = ar.querySelector(".ar-view"),
      slot = $(RV.on ? "slot-rv" : "mine" === AR.tab ? "slot-mine" : "pull" === AR.tab ? "slot-pull" : "shop" === AR.tab ? "slot-shop" : "champions" === AR.tab ? "slot-champions" : "slot-gun");
    v && slot && v.parentNode !== slot && slot.appendChild(v);
  }
  function startReveal(n) {
    // the sound is woken here, inside the press (a browser keeps it muted if it starts later)
    au();
    closeReveal(!0);
    const box = $("ar-reveal");
    Object.assign(RV, { on: !0, n, res: [], done: !1, sel: -1, item: null, burst: !1, skip: !1 });
    box.hidden = !1;
    box.className = n > 1 ? "many" : "one";
    box.style.setProperty("--rc", "#7f90aa");
    $("rv-grid").innerHTML = "";
    $("rv-cap").className = "rv-cap";
    $("rv-title").textContent = n > 1 ? L("보급 상자 ×10", "Supply crate ×10") : L("보급 상자", "Supply crate");
    $("rv-hint").textContent = L("누르면 바로 엽니다", "Tap to open it now");
    for (const id of ["rv-equip", "rv-one", "rv-ten"]) $(id).disabled = !0;
    placeView();
    const P = pvInit();
    pvClear(P);
    cineStart(P);
    pvRender();
    rvT(() => {
      SND.thud();
      const [x, y] = fxCenter();
      fxRing(x, y + 40, "#a9b8cc", 7);
      fxBurst(x, y + 50, "#7f8da3", 14, { sp: 150, size: 5, white: 0, d: 0.7 });
    }, 500);
    rvT(() => RV.on && !RV.burst && (RV.hum = hum()), 560);
  }
  // the server answered: cards are dealt face down, the colour is set, the burst is timed
  function revealResults(results) {
    if (!RV.on) return;
    RV.res = (results || []).filter((r) => r && BY[r.s]);
    if (!RV.res.length) return revealFail(L("결과가 비어 있습니다", "Nothing came back"));
    let best = 0;
    RV.res.forEach((r, i) => tierOf(r) > tierOf(RV.res[best]) && (best = i));
    RV.best = best;
    buildCards();
    if (RV.skip) return revealAll();
    const top = tierOf(RV.res[best]),
      P = AR.pv,
      C = P && P.cine,
      el = C ? (performance.now() - C.t0) / 1e3 : 0,
      at = Math.max(el + 0.4, top >= 4 ? 2.05 : top >= 3 ? 1.85 : 1.55);
    // the crate glows green or blue at first; an epic one turns purple, a legendary one purple and then gold
    C && (crateColor(C.cr, RAR[Math.min(top, 2)].c), (C.big = top >= 3));
    $("ar-reveal").style.setProperty("--rc", RAR[Math.min(top, 2)].c);
    const shift = (r) => () => {
      if (!RV.on || RV.burst) return;
      const P2 = AR.pv,
        C2 = P2 && P2.cine;
      C2 && crateColor(C2.cr, RAR[r].c);
      P2 && (P2.shake = 0.035);
      $("ar-reveal").style.setProperty("--rc", RAR[r].c);
      SND.shift(r);
      const [x, y] = fxCenter();
      fxRing(x, y, RAR[r].c, 6);
      fxBurst(x, y, RAR[r].c, 18, { sp: 170, size: 4, d: 0.7 });
    };
    if (top >= 3) rvT(shift(3), (at - (top >= 4 ? 0.95 : 0.5) - el) * 1e3);
    if (top >= 4) rvT(shift(4), (at - (top >= 5 ? 0.64 : 0.42) - el) * 1e3);
    if (top >= 5) rvT(shift(5), (at - 0.24 - el) * 1e3);
    rvT(() => burst(!1), (at - el) * 1e3);
  }
  function buildCards() {
    const grid = $("rv-grid"),
      n = RV.res.length;
    grid.innerHTML = "";
    grid.style.gridTemplateColumns = n > 1 ? `repeat(${Math.min(5, n)}, minmax(84px, 128px))` : "repeat(1, minmax(110px, 150px))";
    RV.res.forEach((r, i) => {
      const s = skinById(r.s),
        g = WEAPONS[r.g] || { name: r.g },
        c = document.createElement("div"),
        th = thumbCached(r.g, r.s);
      c.className = "rv-card" + (s.rar >= 4 ? " leg" : "") + (s.rar === 5 ? " transcendent" : "");
      c.style.setProperty("--rc", RAR[s.rar].c);
      c.dataset.i = i;
      c.innerHTML = `<div class="rv-in"><div class="rv-f"><img class="th" alt="" src="${th || swatchURL(s)}" data-th="${r.g}|${r.s}"><small>${g.name}</small><b>${nameOf(s)}</b><i>${EN ? RAR[s.rar].en : RAR[s.rar].ko}</i></div><div class="rv-b"><span>13</span></div></div>`;
      c.onclick = (e) => {
        e.stopPropagation();
        if (!RV.done) return revealAll();
        selectCard(i);
      };
      grid.appendChild(c);
      th || thQueue(c.querySelector("img"));
    });
  }
  function burst(fast) {
    if (!RV.on || RV.burst || !RV.res.length) return;
    RV.burst = !0;
    RV.hum && RV.hum.stop();
    RV.hum = null;
    const top = tierOf(RV.res[RV.best]),
      col = RAR[top].c,
      box = $("ar-reveal"),
      P = pvInit(),
      C = P.cine,
      now = performance.now();
    box.style.setProperty("--rc", col);
    box.classList.add("burst");
    C && (crateColor(C.cr, col), (C.bt = now - (fast ? 1200 : 0)));
    // the best one rises out of the crate
    RV.item = { g: RV.res[RV.best].g, s: RV.res[RV.best].s };
    P.rise = { t0: now - (fast ? 2000 : 0) };
    P.pivot.position.y = -0.36;
    P.pivot.scale.setScalar(0.2);
    pvShow();
    P.pitch = 0.2;
    if (fast) {
      showCap(RV.best);
      return;
    }
    box.classList.remove("flash", "shake");
    void box.offsetWidth;
    box.classList.add("flash");
    top >= 3 && box.classList.add("shake");
    P.shake = top >= 3 ? 0.1 : 0.05;
    SND.boom(top);
    const [x, y] = fxCenter();
    fxBurst(x, y, col, top >= 4 ? 90 : top >= 3 ? 62 : 36, { sp: top >= 4 ? 540 : 400, size: 7, sq: top >= 4, white: 0.3, d: 1.1 });
    fxRing(x, y, col, 12);
    top >= 3 && setTimeout(() => RV.on && fxRing(x, y, "#ffffff", 17), 130);
    top >= 4 && confetti(col);
    rvT(() => showCap(RV.best), 450);
    rvT(() => dealCards(!1), 420);
  }
  // the cards fly out of the crate to their places, then turn over left to right (epic and legendary ones charge first)
  function dealCards(fast) {
    const grid = $("rv-grid"),
      cards = [...grid.children];
    $("ar-reveal").classList.add("dealt");
    if (fast) {
      cards.forEach((c, i) => {
        c.classList.remove("go");
        c.classList.add("in");
        openCard(i, !0);
      });
      return revealDone();
    }
    const [cx, cy] = fxCenter(!0);
    cards.forEach((c) => {
      const b = c.getBoundingClientRect();
      c.style.setProperty("--fx", (cx - (b.left + b.width / 2)).toFixed(0) + "px");
      c.style.setProperty("--fy", (cy - (b.top + b.height / 2)).toFixed(0) + "px");
    });
    void grid.offsetWidth;
    cards.forEach((c, i) => {
      c.style.transitionDelay = i * 45 + "ms";
      c.classList.add("go", "in");
    });
    let t = 560 + cards.length * 45;
    RV.res.forEach((r, i) => {
      const k = tierOf(r);
      if (k >= 3) {
        rvT(() => chargeCard(i), t);
        t += 430;
      }
      rvT(() => openCard(i), t);
      t += k >= 3 ? 380 : 140;
    });
    rvT(revealDone, t + 320);
  }
  function chargeCard(i) {
    const c = $("rv-grid").children[i];
    if (!c || c.classList.contains("open")) return;
    c.classList.add("in", "charge");
    SND.charge();
  }
  function openCard(i, quiet) {
    const c = $("rv-grid").children[i];
    if (!c || c.classList.contains("open")) return;
    c.classList.add("in", "open");
    c.classList.remove("charge");
    if (quiet) return;
    const r = tierOf(RV.res[i]);
    r >= 3 && c.classList.add("ring");
    SND.flip();
    SND.card(r);
    if (r >= 2) {
      const b = c.getBoundingClientRect(),
        q = $("ar-reveal").getBoundingClientRect();
      fxBurst(b.left - q.left + b.width / 2, b.top - q.top + b.height / 2, RAR[r].c, r >= 4 ? 36 : r >= 3 ? 22 : 8, { sp: r >= 4 ? 210 : 130, size: 5, d: 0.8 });
    }
  }
  function showCap(i) {
    const r = RV.res[i];
    if (!r) return;
    const s = skinById(r.s),
      cap = $("rv-cap");
    cap.style.setProperty("--rc", RAR[s.rar].c);
    cap.innerHTML = `<b>${nameOf(s)}</b><span>${(WEAPONS[r.g] || { name: r.g }).name}</span><i>${EN ? RAR[s.rar].en : RAR[s.rar].ko}</i>`;
    cap.classList.add("on");
  }
  // skip: everything at once (or, the server not having answered yet, the moment it does)
  function revealAll() {
    if (!RV.on || RV.done) return;
    if (!RV.res.length) return void (RV.skip = !0);
    RV.timers.forEach(clearTimeout);
    RV.timers = [];
    RV.burst || burst(!0);
    showCap(RV.best);
    dealCards(!0);
  }
  function revealDone() {
    if (RV.done || !RV.on) return;
    RV.done = !0;
    RV.res.forEach((r, i) => openCard(i, !0));
    $("ar-reveal").classList.add("done");
    $("rv-equip").disabled = !1;
    const left = pullableLeft();
    $("rv-one").disabled = left < 1 || INV.gold < costOf(1);
    $("rv-ten").disabled = left < 10 || INV.gold < costOf(10);
    selectCard(RV.best);
    $("rv-hint").textContent = RV.n > 1 ? L("카드를 누르면 그 총을 돌려 봅니다", "Tap a card to turn that gun") : L("끌어서 돌려 보세요", "Drag to turn it");
    paintGacha();
  }
  function selectCard(i) {
    const r = RV.res[i];
    if (!r) return;
    RV.sel = i;
    [...$("rv-grid").children].forEach((c, k) => c.classList.toggle("sel", k === i));
    WEAPONS[r.g] && (AR.key = r.g);
    showCap(i);
    if (!RV.item || RV.item.g !== r.g || RV.item.s !== r.s) {
      RV.item = { g: r.g, s: r.s };
      const P = AR.pv;
      P && P.rise && ((P.rise = null), (P.pivot.position.y = 0.04));
      pvShow();
      P && (P.pivot.position.y = 0.04);
    }
  }
  function revealFail(msg) {
    if (!RV.on) return note(msg);
    RV.hum && RV.hum.stop();
    RV.hum = null;
    RV.timers.forEach(clearTimeout);
    RV.timers = [];
    SND.fizzle();
    const P = AR.pv;
    P && P.cine && (P.cine.fail = performance.now());
    rvT(() => {
      closeReveal();
      note(msg);
    }, 600);
  }
  function closeReveal(quiet) {
    RV.timers.forEach(clearTimeout);
    RV.timers = [];
    RV.hum && RV.hum.stop();
    RV.hum = null;
    const was = RV.on;
    RV.on = !1;
    RV.item = null;
    const box = $("ar-reveal");
    box.hidden = !0;
    box.className = "";
    $("rv-fx").innerHTML = "";
    AR.pv && cineEnd(AR.pv);
    if (!quiet && was) {
      placeView();
      AR.open && pvShow();
    }
  }
  $("ar-reveal").onclick = () => {
    RV.done || revealAll();
  };
  $("rv-equip").onclick = (e) => {
    e.stopPropagation();
    const r = RV.res[RV.sel];
    closeReveal();
    if (r && WEAPONS[r.g]) {
      AR.key = r.g;
      AR.peek = null;
      AR.view = null;
      setSkin(r.g, r.s) && note(L(`장착했습니다 · ${WEAPONS[r.g].name} ${nameOf(skinById(r.s))}`, `Equipped · ${nameOf(skinById(r.s))} ${WEAPONS[r.g].name}`));
      MI.sel = r.g + "|" + r.s;
    }
    armoryPaint();
    pvShow();
  };
  $("rv-one").onclick = (e) => {
    e.stopPropagation();
    pull(1);
  };
  $("rv-ten").onclick = (e) => {
    e.stopPropagation();
    pull(10);
  };
  $("rv-close").onclick = (e) => {
    e.stopPropagation();
    closeReveal();
    armoryPaint();
  };
  $("ar-pull1").onclick = () => pull(1);
  $("ar-pull10").onclick = () => pull(10);

  // ── the pull page's showcase: the legendary and epic skins, each on a gun, one after another ──
  const FEAT = [];
  function featList() {
    if (FEAT.length) return FEAT;
    const guns = ["rifle", "vector", "sniper", "carbine", "bullpup", "marksman", "shotgun", "lmg", "smg"].filter((k) => WEAPONS[k]);
    let gi = Math.floor(Math.random() * Math.max(1, guns.length));
    for (const s of SKINS.filter((x) => !x.gone && !x.excl && x.rar >= 3).sort((a, b) => b.rar - a.rar || a.i - b.i)) {
      const g = s.only || guns[gi++ % guns.length];
      g && WEAPONS[g] && FEAT.push({ g, s: s.id });
    }
    return FEAT;
  }
  function nextFeat() {
    const l = featList();
    if (!l.length) return;
    AR.fi = (AR.fi + 1) % l.length;
    AR.feat = l[AR.fi];
    AR.featT = performance.now() + 4200;
    paintFeat();
  }
  function paintFeat() {
    const f = AR.feat,
      el = $("pl-feat");
    if (!f || !el) return;
    const s = skinById(f.s),
      c = RAR[s.rar].c;
    $("pl-show").style.setProperty("--fc", c);
    $("pl-tag").textContent = EN ? RAR[s.rar].en.toUpperCase() : RAR[s.rar].ko + " " + L("스킨", "");
    el.innerHTML = `<small>${gated() && owns(f.g, f.s) ? L("이미 가진 스킨", "Already yours") : L("상자에서 나올 수 있는 스킨", "Can come out of a crate")}</small><b>${nameOf(s)}</b><span>${(WEAPONS[f.g] || { name: "" }).name}</span>`;
  }

  // ── the tabs ──
  let previewFrame = 0;
  function setTab(t) {
    ["pull", "shop", "champions", "mine", "gun"].includes(t) || (t = "pull");
    AR.tab = t;
    if (t !== "champions") AR.peek = null;
    try {
      localStorage.setItem("lgp_ar_tab", t);
    } catch (e) {}
    for (const b of document.querySelectorAll("#ar-tabs .ar-tab")) b.classList.toggle("on", b.dataset.tab === t);
    for (const pane of ar.querySelectorAll(":scope > .ar-pane")) pane.hidden = pane.id !== "ar-p-" + t;
    "shop" === t && loadShop();
    if ("mine" === t && MI.sel) {
      const [g, s] = MI.sel.split("|");
      WEAPONS[g] && owns(g, s) ? ((AR.key = g), (AR.view = s)) : (MI.sel = null);
    } else AR.view = null;
    "pull" === t && (AR.feat ? paintFeat() : nextFeat());
    placeView();
    if (!AR.open) return;
    armoryPaint();
    if (AR.pv) pvShow();
    else {
      // Let the controls paint before creating the first WebGL preview.
      cancelAnimationFrame(previewFrame);
      previewFrame = requestAnimationFrame(() => {
        previewFrame = requestAnimationFrame(() => {
          previewFrame = 0;
          if (AR.open && !AR.pv) pvShow();
        });
      });
    }
  }
  for (const b of document.querySelectorAll("#ar-tabs .ar-tab")) b.onclick = () => setTab(b.dataset.tab);
  const championPane = $("ar-p-champions");
  let championWasHidden = true;
  new MutationObserver(() => {
    const entered = championWasHidden && !championPane.hidden;
    championWasHidden = championPane.hidden;
    if (entered) dispatchEvent(new CustomEvent("champions-open"));
  }).observe(championPane, { attributes: true, attributeFilter: ["hidden"] });
  $("pl-shop") && ($("pl-shop").onclick = () => setTab("shop"));

  const ORDER = ["근접", "보조", "기관단총", "산탄총", "소총", "기관총", "저격총", "중화기"];
  const gunList = () => {
    const g = {};
    for (const k in WEAPONS) (g[WEAPONS[k].cls] = g[WEAPONS[k].cls] || []).push(k);
    const cls = ORDER.filter((c) => g[c]).concat(Object.keys(g).filter((c) => !ORDER.includes(c)));
    return cls.map((c) => [c, g[c]]);
  };
  // a flat picture of each skin, for the cards until the gun's own picture is painted
  function swatch(skin, cv) {
    const g = cv.getContext("2d"),
      W = cv.width,
      H = cv.height;
    if (skin.pat) {
      const src = texture(skin).image;
      g.drawImage(src, 0, 0, src.width, src.height, 0, 0, W, H);
      if (skin.em) {
        g.globalCompositeOperation = "lighter";
        g.drawImage(texture(skin, !0).image, 0, 0, src.width, src.height, 0, 0, W, H);
        g.globalCompositeOperation = "source-over";
      }
    } else {
      const c = (v) => "#" + new T.Color(v).getHexString();
      const grad = g.createLinearGradient(0, 0, W, H);
      if ("default" === skin.id) {
        grad.addColorStop(0, "#4a5260");
        grad.addColorStop(0.5, "#2b313b");
        grad.addColorStop(1, "#1a1e25");
      } else {
        grad.addColorStop(0, c(skin.body[0]));
        grad.addColorStop(0.55, c(skin.metal[0]));
        grad.addColorStop(1, c(skin.dark[0]));
      }
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);
      if ("holo" === skin.id) {
        const r = g.createLinearGradient(0, H, W, 0);
        ["#ff5c8a", "#ffd166", "#5cff9d", "#5cc8ff", "#c56bff"].forEach((col, i) => r.addColorStop(i / 4, col));
        g.globalAlpha = 0.55;
        g.fillStyle = r;
        g.fillRect(0, 0, W, H);
        g.globalAlpha = 1;
      }
    }
    if (skin.glow && "default" !== skin.id) {
      g.fillStyle = "#" + new T.Color(skin.glow).getHexString();
      g.fillRect(0, H - 5, W, 5);
    }
  }
  const SWU = {};
  function swatchURL(s) {
    if (SWU[s.id]) return SWU[s.id];
    try {
      const cv = document.createElement("canvas");
      cv.width = 120;
      cv.height = 56;
      swatch(s, cv);
      SWU[s.id] = cv.toDataURL();
    } catch (e) {
      SWU[s.id] = "";
    }
    return SWU[s.id];
  }

  // ── my skins: every gun-and-skin owned, filtered, one picked to look at and wear ──
  const MI = { tier: 0, cls: "", eq: !1, sel: null };
  function mineItems() {
    const out = [];
    gunList().forEach(([cls, keys], ci) =>
      keys.forEach((g, gi) => {
        for (const s of skinsFor(g)) s.rar > 0 && owns(g, s.id) && out.push({ g, s, cls, o: ci * 100 + gi });
      }),
    );
    return out;
  }
  function selectItem(g, s) {
    if (!WEAPONS[g] || !BY[s] || !owns(g, s)) return;
    MI.sel = g + "|" + s;
    AR.key = g;
    AR.view = s;
    AR.peek = null;
    armoryPaint();
    pvShow();
    const c = document.querySelector(`#mi-list .it[data-g="${g}"][data-s="${s}"]`);
    c && c.scrollIntoView && c.scrollIntoView({ block: "nearest" });
  }
  function previewItem(g, id) {
    if (!WEAPONS[g] || !BY[id] || !fits(BY[id], g)) return;
    AR.key = g; AR.peek = id;
    paintCap(); pvShow();
  }
  // this one skin on every gun that has it (the rest keep theirs)
  function wearEverywhere(id) {
    let n = 0;
    for (const k in WEAPONS) BY[id] && fits(BY[id], k) && owns(k, id) && ((SK.mine[k] = id), n++);
    n && changed();
    return n;
  }
  function paintMine() {
    const all = mineItems(),
      f = $("mi-f");
    const cnt = (r) => all.filter((x) => !r || x.s.rar === r).length;
    const classes = [...new Set(all.map((x) => x.cls))];
    MI.cls && !classes.includes(MI.cls) && (MI.cls = "");
    f.innerHTML =
      RAR.map((_, r) => `<button data-r="${r}" class="${MI.tier === r ? "on" : ""}" style="--rc:${r ? RAR[r].c : "var(--gold)"}">${r ? (EN ? RAR[r].en : RAR[r].ko) : L("전체", "All")} ${cnt(r)}</button>`).join("") +
      `<select id="mi-cls"><option value="">${L("모든 총", "All guns")}</option>${classes.map((c) => `<option value="${c}"${c === MI.cls ? " selected" : ""}>${c}</option>`).join("")}</select>` +
      `<button data-eq="1" class="${MI.eq ? "on" : ""}">${L("장착 중만", "Worn only")}</button><span class="mi-n" id="mi-n"></span>`;
    f.querySelectorAll("button[data-r]").forEach((b) => (b.onclick = () => ((MI.tier = +b.dataset.r), paintMine())));
    f.querySelector("button[data-eq]").onclick = () => ((MI.eq = !MI.eq), paintMine());
    $("mi-cls").onchange = (e) => ((MI.cls = e.target.value), paintMine());
    const list = all.filter((x) => (!MI.tier || x.s.rar === MI.tier) && (!MI.cls || x.cls === MI.cls) && (!MI.eq || mySkin(x.g).id === x.s.id)).sort((a, b) => b.s.rar - a.s.rar || a.o - b.o || a.s.i - b.s.i);
    const worn = all.filter((x) => mySkin(x.g).id === x.s.id).length;
    $("mi-n").textContent = L(`보유 ${all.length}개 · 장착 ${worn}개`, `${all.length} owned · ${worn} worn`);
    const box = $("mi-list");
    box.innerHTML = "";
    if (!all.length) {
      box.innerHTML = `<div class="mi-empty"><span>${signed() ? L("아직 가진 스킨이 없습니다. 경기에서 골드를 모아 뽑아 보세요.", "No skins yet. Win gold in matches and pull some.") : L("로그인하면 스킨을 모을 수 있습니다.", "Sign in to collect skins.")}</span>${signed() ? `<button class="btn btn-go" id="mi-go">${L("뽑기로 가기", "Go to pulls")}</button>` : ""}</div>`;
      const go = $("mi-go");
      go && (go.onclick = () => setTab("pull"));
    } else if (!list.length) box.innerHTML = `<div class="mi-empty"><span>${L("조건에 맞는 스킨이 없습니다", "Nothing matches")}</span></div>`;
    const frag = document.createDocumentFragment();
    for (const x of list) {
      const eq = mySkin(x.g).id === x.s.id,
        c = itemCard(x.g, x.s, (MI.sel === x.g + "|" + x.s.id ? " on" : "") + (eq ? " eq" : ""));
      eq && (c.dataset.eq = L("장착 중", "Worn"));
      c.onclick = () => selectItem(x.g, x.s.id);
      frag.appendChild(c);
    }
    box.appendChild(frag);
    box.querySelectorAll("img.th:not(.r)").forEach(thLater);
    // the picked one: what it is, wear it or take it off, or on every gun
    const info = $("mi-info"),
      sel = MI.sel && MI.sel.split("|");
    if (!sel || !WEAPONS[sel[0]] || !BY[sel[1]] || !owns(sel[0], sel[1])) {
      info.innerHTML = `<p>${all.length ? L("스킨을 누르면 여기서 돌려 보고 장착합니다.", "Pick a skin to turn it here and wear it.") : L("스킨이 생기면 여기서 돌려 보고 장착합니다.", "Skins you own are turned and worn here.")}</p>`;
      return;
    }
    const [g, id] = sel,
      s = BY[id],
      eq = mySkin(g).id === id,
      many = Object.keys(WEAPONS).filter((k) => k !== g && fits(s, k) && owns(k, id)).length;
    info.innerHTML = `<h4>${WEAPONS[g].name} · ${nameOf(s)}<i style="color:${RAR[s.rar].c}">${EN ? RAR[s.rar].en : RAR[s.rar].ko}</i></h4><p>${eq ? L("지금 이 총에 장착되어 있습니다", "Worn on this gun now") : L(`이 총은 지금 「${nameOf(mySkin(g))}」을 쓰고 있습니다`, `This gun wears ${nameOf(mySkin(g))} now`)}</p>
      <div class="row">${eq ? `<button class="btn" id="mi-off">${L("장착 해제", "Take off")}</button>` : `<button class="btn btn-go" id="mi-on">${L("장착", "Wear")}</button>`}${many ? `<button class="btn" id="mi-all">${L(`이 스킨 가진 총 전부 (${many + 1})`, `Every gun with it (${many + 1})`)}</button>` : ""}<button class="btn" id="mi-gun">${L("이 총 스킨 전체 보기", "All skins of this gun")}</button></div>`;
    const on = $("mi-on"),
      off = $("mi-off"),
      ev = $("mi-all");
    on && (on.onclick = () => (setSkin(g, id) && note(L("장착했습니다", "Worn")), armoryPaint(), pvShow()));
    off && (off.onclick = () => (setSkin(g, "default"), note(L("기본으로 돌렸습니다", "Back to stock")), armoryPaint(), pvShow()));
    ev &&
      (ev.onclick = () => {
        const n = wearEverywhere(id);
        note(L(`${n}개 총에 장착했습니다`, `Worn on ${n} guns`));
        armoryPaint();
        pvShow();
      });
    $("mi-gun").onclick = () => {
      AR.key = g;
      setTab("gun");
    };
  }
  // ── the daily shop: twenty skins a day, the same for everyone, bought outright for gold ──
  const SH = { items: [], day: "", week: "", weekResetAt: 0, resetAt: 0, on: !0, sel: null, busy: !1, at: 0, err: "", arm: null, armT: 0 };
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  const shopOk = (x) => x && WEAPONS[x.g] && BY[x.s] && fits(BY[x.s], x.g);
  async function loadShop(force) {
    const fresh = SH.at && Date.now() - SH.at < 60000 && !(SH.resetAt && Date.now() >= SH.resetAt);
    if (fresh && !force) return void paintShop();
    if (!AC() || !AC().api) {
      SH.err = L("상점은 게임 서버에 접속했을 때 열립니다", "The shop opens when the game server is reachable");
      return void paintShop();
    }
    try {
      const j = await AC().api("shop", token() ? { token: token() } : {});
      // the weekly deal's skins ride in the same list, marked w
      SH.items = (j.weekly || []).map((x) => Object.assign(x, { w: 1 })).concat(j.items || []).filter(shopOk);
      SH.day = j.day || "";
      SH.week = j.week || "";
      SH.weekResetAt = +j.weekResetAt || 0;
      SH.resetAt = +j.resetAt || 0;
      SH.on = !1 !== j.on;
      SH.at = Date.now();
      SH.err = "";
      Array.isArray(j.wish) && token() && takeWish(j.wish);
      "number" == typeof j.gold && setGold(j.gold);
      (SH.sel && SH.items.some((x) => x.g + "|" + x.s === SH.sel)) || (SH.sel = SH.items.length ? SH.items.slice().sort((a, b) => b.r - a.r)[0].g + "|" + SH.items.slice().sort((a, b) => b.r - a.r)[0].s : null);
    } catch (e) {
      SH.err = (e && e.message) || L("상점을 불러오지 못했습니다", "The shop did not load");
    }
    if (AR.open && "shop" === AR.tab) {
      paintShop();
      pvShow();
    }
  }
  function shopPick() {
    const it = SH.sel && SH.items.find((x) => x.g + "|" + x.s === SH.sel);
    return it ? { g: it.g, s: it.s } : null;
  }
  const hms = (ms) => {
    const t = Math.max(0, Math.floor(ms / 1000));
    return [Math.floor(t / 3600), Math.floor((t % 3600) / 60), t % 60].map((n) => String(n).padStart(2, "0")).join(":");
  };
  const owned = (x) => (gated() ? owns(x.g, x.s) : !!x.own);
  function paintShopTime() {
    const t = $("sh-t");
    t && (t.textContent = SH.resetAt ? hms(SH.resetAt - Date.now()) : "--:--:--");
    const w = $("sh-wt");
    if (w) {
      const left = Math.max(0, SH.weekResetAt - Date.now()),
        d = Math.floor(left / 864e5);
      w.textContent = d >= 1 ? L(`${d}일 ${Math.floor((left % 864e5) / 36e5)}시간 남음`, `${d}d ${Math.floor((left % 864e5) / 36e5)}h left`) : hms(left);
    }
  }
  function paintShop() {
    const f = $("sh-f"),
      box = $("sh-list"),
      info = $("sh-info");
    if (!f || !box) return;
    const gold = INV.gold || 0,
      list = SH.items.slice().sort((a, b) => (b.w | 0) - (a.w | 0) || b.r - a.r || a.price - b.price),
      have = list.filter(owned).length;
    f.innerHTML = `<span class="sh-hd"><b>${L("오늘의 상점", "Today's shop")}</b><span>${L("다음 교체까지", "New items in")} <b id="sh-t"></b></span>${SH.weekResetAt ? `<span class="sh-wk">${L("주간 특가", "Weekly deal")} <b id="sh-wt"></b></span>` : ""}</span><span class="sh-note">${L("원하는 스킨을 골라 골드로 바로 삽니다. 뽑기보다 비싸지만 고른 스킨이 확실히 들어옵니다. 매일 자정(한국 시간)에 20개가 바뀝니다.", "Pick the skin you want and buy it outright. Dearer than a pull, but you get the one you chose. Twenty new ones every midnight (Korea time).")}</span><span class="mi-n">${(() => { const w = list.filter((x) => !owned(x) && wished(x.g, x.s)).length; return w ? `<b class="sh-wn">★ ${L(`찜한 스킨 ${w}개`, `${w} wishlisted`)}</b> · ` : ""; })()}${L(`보유 ${have}/${list.length}`, `${have}/${list.length} owned`)} · 🪙 ${gold.toLocaleString()}</span>`;
    paintShopTime();
    box.innerHTML = "";
    if (SH.err || !SH.on || !list.length) {
      box.innerHTML = `<div class="mi-empty"><span>${SH.err ? esc(SH.err) : !SH.on ? L("지금은 상점이 닫혀 있습니다", "The shop is closed for now") : L("불러오는 중…", "Loading…")}</span></div>`;
      info.innerHTML = "";
      return;
    }
    const frag = document.createDocumentFragment();
    for (const x of list) {
      const s = BY[x.s],
        mine = owned(x),
        c = itemCard(x.g, s, (SH.sel === x.g + "|" + x.s ? " on" : "") + (mine ? " eq" : "") + (!mine && gold < x.price ? " dear" : "") + (!mine && wished(x.g, x.s) ? " wish" : ""));
      mine && (c.dataset.eq = L("보유", "Owned"));
      const pr = document.createElement("em");
      pr.className = "pr";
      pr.innerHTML = (x.w && x.was ? `<s>${x.was.toLocaleString()}</s> ` : "") + "🪙 " + x.price.toLocaleString();
      c.appendChild(pr);
      if (x.w) {
        c.classList.add("wk");
        const rb = document.createElement("i");
        rb.className = "wkr";
        rb.textContent = L(`주간 −${Math.round(100 - (100 * x.price) / (x.was || x.price))}%`, `Weekly −${Math.round(100 - (100 * x.price) / (x.was || x.price))}%`);
        c.appendChild(rb);
      }
      c.onclick = () => {
        SH.sel = x.g + "|" + x.s;
        SH.arm = null;
        paintShop();
        pvShow();
      };
      frag.appendChild(c);
    }
    box.appendChild(frag);
    box.querySelectorAll("img.th:not(.r)").forEach(thLater);
    const it = SH.sel && list.find((x) => x.g + "|" + x.s === SH.sel);
    if (!it) return void (info.innerHTML = `<p>${L("스킨을 누르면 여기서 돌려 보고 삽니다.", "Pick a skin to turn it here and buy it.")}</p>`);
    const s = BY[it.s],
      mine = owned(it),
      short = Math.max(0, it.price - gold),
      armed = SH.arm === SH.sel && Date.now() - SH.armT < 4000;
    const why = mine ? "" : !signed() ? L("로그인하면 살 수 있습니다", "Sign in to buy") : short ? L(`골드 ${short.toLocaleString()} 부족 · 경기와 미션으로 모으세요`, `${short.toLocaleString()} gold short · earn it in matches and missions`) : "";
    info.innerHTML = `<h4>${WEAPONS[it.g].name} · ${nameOf(s)}<i style="color:${RAR[s.rar].c}">${EN ? RAR[s.rar].en : RAR[s.rar].ko}</i></h4>
      <p>${mine ? L("이미 가진 스킨입니다", "You own this one") : L(`가격 🪙 ${it.price.toLocaleString()} · 내 골드 🪙 ${gold.toLocaleString()}`, `Price 🪙 ${it.price.toLocaleString()} · You have 🪙 ${gold.toLocaleString()}`)}</p>
      <div class="row">${mine ? (mySkin(it.g).id === it.s ? `<button class="btn" disabled>${L("장착 중", "Worn")}</button>` : `<button class="btn btn-go" id="sh-wear">${L("장착", "Wear")}</button>`) : `<button class="btn btn-go${armed ? " sh-arm" : ""}" id="sh-buy"${why || SH.busy ? " disabled" : ""}>${SH.busy ? L("구매 중…", "Buying…") : armed ? L(`한 번 더 누르면 구매 · 🪙 ${it.price.toLocaleString()}`, `Tap again to buy · 🪙 ${it.price.toLocaleString()}`) : L(`구매 · 🪙 ${it.price.toLocaleString()}`, `Buy · 🪙 ${it.price.toLocaleString()}`)}</button>`}${mine ? "" : `<button class="btn sh-wbtn${wished(it.g, it.s) ? " on" : ""}" id="sh-wish">${wished(it.g, it.s) ? L("★ 찜함", "★ Wishlisted") : L("☆ 찜하기", "☆ Wishlist")}</button>`}</div>${why ? `<p class="sh-why">${why}</p>` : ""}`;
    const buy = $("sh-buy"),
      wear = $("sh-wear");
    buy &&
      (buy.onclick = () => {
        // two presses: the first arms the button (it is a lot of gold), the second buys
        if (!(SH.arm === SH.sel && Date.now() - SH.armT < 4000)) {
          SH.arm = SH.sel;
          SH.armT = Date.now();
          paintShop();
          setTimeout(() => SH.arm === it.g + "|" + it.s && Date.now() - SH.armT >= 4000 && ((SH.arm = null), AR.open && "shop" === AR.tab && paintShop()), 4100);
          return;
        }
        buyShop(it.g, it.s);
      });
    wear && (wear.onclick = () => (setSkin(it.g, it.s) && note(L("장착했습니다", "Worn")), paintShop(), pvShow()));
    const wb = $("sh-wish");
    wb && (wb.onclick = () => toggleWish(it.g, it.s));
  }
  async function buyShop(g, sid) {
    if (SH.busy || !signed()) return null;
    SH.busy = !0;
    SH.arm = null;
    paintShop();
    let j = null;
    try {
      const wk = SH.items.find((x) => x.g === g && x.s === sid);
      j = await AC().api("shop_buy", { token: token(), g, s: sid, day: SH.day, w: wk && wk.w ? 1 : 0, week: wk && wk.w ? SH.week : "" });
      j.user && syncSession(j.user);
      takeInv(j);
      const it = SH.items.find((x) => x.g === g && x.s === sid);
      it && (it.own = !0);
      au();
      note(L(`구매했습니다 · ${WEAPONS[g].name} ${nameOf(BY[sid])}`, `Bought · ${WEAPONS[g].name} ${nameOf(BY[sid])}`));
    } catch (e) {
      note((e && e.message) || L("구매하지 못했습니다", "The purchase failed"));
      /바뀌었/.test((e && e.message) || "") && (SH.at = 0);
      j = null;
    }
    SH.busy = !1;
    SH.at ? paintShop() : loadShop(!0);
    return j;
  }
  setInterval(() => {
    if (!AR.open || "shop" !== AR.tab) return;
    paintShopTime();
    ((SH.resetAt && Date.now() >= SH.resetAt + 1500) || (SH.weekResetAt && Date.now() >= SH.weekResetAt + 1500)) && Date.now() - SH.at > 5000 && loadShop(!0);
  }, 1000);
  // ── the wishlist: ★ on a skin not owned; the game says when one is in today's shop ──
  const WL = { set: new Set(), busy: !1, tried: !1 };
  const wkey = (g, s) => g + "|" + s;
  const wished = (g, s) => WL.set.has(wkey(g, s));
  try {
    const j = JSON.parse(localStorage.getItem("lgp_wish") || "null"),
      me = session() && session().user;
    j && Array.isArray(j.l) && me && j.id === me.id && (WL.set = new Set(j.l));
  } catch (e) {}
  function takeWish(list) {
    if (!Array.isArray(list)) return;
    WL.set = new Set(list);
    try {
      const me = session() && session().user;
      localStorage.setItem("lgp_wish", JSON.stringify({ id: me ? me.id : "", l: list }));
    } catch (e) {}
  }
  async function toggleWish(g, sid) {
    if (!signed()) return void note(L("로그인하면 찜할 수 있습니다", "Sign in to keep a wishlist"));
    if (WL.busy) return;
    WL.busy = !0;
    const on = !wished(g, sid);
    try {
      takeWish((await AC().api("wish", { token: token(), item: wkey(g, sid), on })).wish);
      note(on ? L("찜했습니다 · 오늘의 상점에 뜨면 알려 드립니다", "Wishlisted · you'll hear when it's in the shop") : L("찜을 풀었습니다", "Off the wishlist"));
    } catch (e) {
      note((e && e.message) || L("찜하지 못했습니다", "Could not change the wishlist"));
    }
    WL.busy = !1;
    armoryPaint();
  }
  // on the title screen, once a day: a wished skin is in today's shop
  function wishNotice() {
    let n = $("wish-note");
    const t = $("s-title"),
      day = SH.day || "",
      onTitle = signed() && "menu" === world.phase && t && !t.hidden && "none" !== getComputedStyle(t).display;
    let seen = "";
    try {
      seen = localStorage.getItem("lgp_wish_seen") || "";
    } catch (e) {}
    const hits = SH.items.filter((x) => wished(x.g, x.s) && !owned(x));
    if (!onTitle || !hits.length || seen === day || AR.open) return void (n && (n.hidden = !0));
    if (!n) {
      n = document.createElement("div");
      n.id = "wish-note";
      n.innerHTML = `<button class="wn-go" id="wn-go"></button><button class="wn-x" id="wn-x" aria-label="${L("닫기", "Close")}">×</button>`;
      document.body.appendChild(n);
      const done = () => {
        try {
          localStorage.setItem("lgp_wish_seen", SH.day || "");
        } catch (e) {}
        n.hidden = !0;
      };
      $("wn-go").onclick = () => (done(), openArmory(null, "shop"));
      $("wn-x").onclick = done;
    }
    const first = hits[0];
    $("wn-go").innerHTML = `<b>★ ${L(`찜한 스킨 ${hits.length}개가 오늘 상점에 있습니다`, `${hits.length} wishlisted skin${hits.length > 1 ? "s are" : " is"} in today's shop`)}</b><span>${WEAPONS[first.g].name} · ${nameOf(BY[first.s])}${hits.length > 1 ? L(` 외 ${hits.length - 1}개`, ` and ${hits.length - 1} more`) : ""} · ${L("보러 가기", "Take a look")} →</span>`;
    n.hidden = !1;
  }
  setInterval(() => {
    try {
      if (!signed() || "menu" !== world.phase) return;
      if (!WL.tried) {
        WL.tried = !0;
        loadShop(!0).then(wishNotice);
      } else wishNotice();
    } catch (e) {}
  }, 2500);
  function paintCap() {
    const shown = AR.peek && BY[AR.peek] ? BY[AR.peek] : AR.view && BY[AR.view] ? BY[AR.view] : mySkin(AR.key),
      r = RAR[shown.rar];
    $("ar-cap").innerHTML = `${WEAPONS[AR.key].name} · ${nameOf(shown)}<i style="color:${r.c}">${EN ? r.en : r.ko}</i>${AR.peek ? (BY[AR.peek] && BY[AR.peek].excl ? `<em>${L("시즌 보상 · 랭크전 시즌을 골드 티어 이상으로 마치면 모든 총에", "Season reward · finish a ranked season at Gold or above for every gun")}</em>` : `<em>${L("미보유 · 뽑기나 상점에서 획득", "Not owned · pull it or buy it in the shop")}</em><button class="ar-wish${wished(AR.key, AR.peek) ? " on" : ""}" id="ar-wish">${wished(AR.key, AR.peek) ? L("★ 찜함", "★ Wishlisted") : L("☆ 찜하기 · 상점에 뜨면 알림", "☆ Wishlist · told when it's in the shop")}</button>`) : ""}`;
    const aw = $("ar-wish");
    if (shown.excl === "coins") $("ar-cap").innerHTML = `${WEAPONS[AR.key].name} · ${nameOf(shown)}<i style="color:${r.c}">${EN ? r.en : r.ko}</i><em>${L("초월 상점 · 코인 700개 또는 뽑기 0.00000000000000001%", "Transcendent shop · 700 coins or 0.00000000000000001% pull")}</em>`;
    aw && (aw.onclick = () => toggleWish(AR.key, AR.peek));
  }
  // by gun: the gun list, the turntable, that gun's skins (owned ones worn on a tap, the rest only looked at)
  function armoryPaint() {
    if (!AR.open) return;
    "mine" === AR.tab && paintMine();
    "shop" === AR.tab && paintShop();
    if (AR.tab !== "gun") { paintGacha(); return; }
    const gl = $("ar-guns");
    gl.innerHTML = "";
    for (const [cls, keys] of gunList()) {
      const h = document.createElement("div");
      h.className = "ar-cls";
      h.textContent = cls;
      gl.appendChild(h);
      for (const k of keys) {
        const b = document.createElement("button"),
          s = mySkin(k);
        b.className = "ar-gun" + (k === AR.key ? " on" : "") + ("default" !== s.id ? " skinned" : "");
        b.innerHTML = `<b>${WEAPONS[k].name}</b><span>${nameOf(s)}${gated() ? ` · ${ownedOf(k)}/${totalOf(k)}` : ""}</span>`;
        b.onclick = () => {
          AR.key = k;
          AR.peek = null;
          armoryPaint();
          pvShow();
        };
        gl.appendChild(b);
      }
    }
    const sl = $("ar-skins");
    sl.innerHTML = "";
    const cur = mySkin(AR.key);
    AR.peek && (!BY[AR.peek] || owns(AR.key, AR.peek)) && (AR.peek = null);
    for (const s of skinsFor(AR.key)) {
      const b = document.createElement("button"),
        has = owns(AR.key, s.id);
      b.className = "ar-sk" + (s === cur && !AR.peek ? " on" : "") + (has ? "" : " locked") + (AR.peek === s.id ? " peek" : "") + (!has && wished(AR.key, s.id) ? " wish" : "");
      b.dataset.s = s.id;
      b.dataset.g = AR.key;
      has || (b.title = s.excl === "coins" ? L("미보유 · 초월 코인 700개로 구매", "Not owned · 700 Transcendent coins") : L("미보유 · 뽑기에서 획득", "Not owned · win it in a pull"));
      const cv = document.createElement("canvas");
      cv.width = 120;
      cv.height = 56;
      swatch(s, cv);
      b.appendChild(cv);
      const nm = document.createElement("b");
      nm.textContent = nameOf(s);
      const rr = document.createElement("i");
      rr.textContent = EN ? RAR[s.rar].en : RAR[s.rar].ko;
      rr.style.color = RAR[s.rar].c;
      b.append(nm, rr);
      b.onclick = () => {
        // a locked skin is only looked at
        AR.peek = has ? null : s.id;
        has && setSkin(AR.key, s.id);
        armoryPaint();
        pvShow();
      };
      sl.appendChild(b);
    }
    paintCap();
    paintGacha();
  }
  // open(gun) goes to that gun's skins; open() to the tab used last; open(null, tab) to a tab
  function openArmory(key, tab) {
    if (AR.open) {
      if (key && WEAPONS[key]) { AR.key = key; AR.peek = null; }
      return void ((tab || key) && setTab(tab || "gun"));
    }
    AR.open = !0;
    key && WEAPONS[key] && (AR.key = key);
    AR.peek = null;
    ar.hidden = !1;
    try {
      document.exitPointerLock && document.exitPointerLock();
    } catch (e) {}
    goldShown = INV.gold;
    paintGold();
    setTab(tab || (key && WEAPONS[key] ? "gun" : AR.tab));
    sync(!0);
    // Card thumbnails initialize their renderer only when a visible card needs it.
    cancelAnimationFrame(AR.raf);
    AR.raf = requestAnimationFrame(pvLoop);
  }
  function refreshAssets() {
    TPL.clear(); TH.cache.clear();
    refreshVM();
    for (const actor of (world.actors || [])) if (actor.model && actor.model.gun) {
      actor.model.gun.userData.tp = "";
      dressGun(actor);
    }
    for (const drop of scene.children.slice()) {
      const old = drop.userData.spin, skin = old && BY[old.userData.skin];
      if (!skin || !window.CHAMPIONS_PHANTOM || !CHAMPIONS_PHANTOM.isSkin(skin.id)) continue;
      const fresh = buildFor("carbine", skin);
      applySkin(fresh, skin);
      fresh.position.copy(old.position); fresh.rotation.copy(old.rotation); fresh.scale.copy(old.scale);
      const parent = old.parent;
      if (parent) { parent.remove(old); parent.add(fresh); }
      old.traverse((part) => { if (part.geometry && !part.geometry.userData.shared) part.geometry.dispose(); });
      drop.userData.spin = fresh;
    }
    if (AR.open) pvShow();
  }
  function closeArmory() {
    window.SOUNDPACK && SOUNDPACK.stop();
    if (!AR.open) return;
    closeReveal(!0);
    placeView();
    AR.open = !1;
    ar.hidden = !0;
    cancelAnimationFrame(previewFrame);
    previewFrame = 0;
    cancelAnimationFrame(AR.raf);
  }
  $("ar-close").onclick = closeArmory;
  // The local asset importer can invalidate models without changing ownership or picks.
  window.refreshSkinAssets = refreshAssets;
  $("ar-all").onclick = () => {
    setAll(mySkin(AR.key).id);
    armoryPaint();
  };
  $("ar-rand").onclick = () => {
    setRandom();
    armoryPaint();
    pvShow();
  };
  $("ar-reset").onclick = () => {
    setAll("default");
    armoryPaint();
    pvShow();
  };
  // keys stay in the skin page while it is open: Esc closes (the reveal first), Space or Enter opens a crate at once
  addEventListener(
    "keydown",
    (e) => {
      if (!AR.open || e.key === "Tab") return;
      e.stopImmediatePropagation();
      if ("Escape" === e.key) RV.on ? (closeReveal(), armoryPaint()) : closeArmory();
      else if ((" " === e.key || "Enter" === e.key) && RV.on && !RV.done) {
        e.preventDefault();
        revealAll();
      }
    },
    !0,
  );
  // ways in: the title, agent select, the pause menu, the shop
  const way = (parent, id, cls, text, before) => {
    if (!parent) return null;
    const existing = $(id), b = existing || document.createElement("button");
    b.id = id;
    b.className = cls;
    b.innerHTML = text;
    b.onclick = () => openArmory();
    if (!existing) before && before.parentNode === parent ? parent.insertBefore(b, before) : parent.appendChild(b);
    GAME_BOOT.ready.then(() => { b.disabled = false; });
    return b;
  };
  try {
    const sub = document.querySelector("#s-title .tt-sub");
    way(sub, "go-armory", "tt-item tt-mini", `<b>${L("스킨 · 뽑기", "Skins · pulls")}</b>`, $("go-set"));
    const top = document.querySelector("#s-select .sel-top");
    const b = way(top, "sel-armory", "btn", L("스킨", "Skins"));
    b && ((b.style.marginLeft = "auto"), (b.style.padding = "9px 18px"), (b.style.fontSize = "11px"));
    way(document.querySelector("#pause .pz-btns"), "pz-armory", "btn", L("스킨", "Skins"), $("pz-close"));
    const ft = document.querySelector("#shop .shop-ft");
    const sb = way(ft, "shop-skins", "btn", L("총 스킨", "Gun skins"), $("shop-close"));
    sb && ((sb.style.padding = "9px 20px"), (sb.style.fontSize = "11px"), (sb.style.marginLeft = "auto"), (sb.style.marginRight = "8px"));
  } catch (e) {}
  // the shop says which skin each gun wears
  const _rs = renderShop;
  renderShop = function () {
    const r = _rs.apply(this, arguments);
    try {
      const byName = {};
      for (const k in WEAPONS) byName[WEAPONS[k].name] = k;
      document.querySelectorAll("#shop-grid .sitem").forEach((c) => {
        const b = c.querySelector("b"),
          sp = c.querySelector("span"),
          k = b && byName[b.textContent.trim()];
        if (!k || !sp) return;
        const s = mySkin(k);
        "default" !== s.id && !c.querySelector(".sk-chip") && (sp.innerHTML += `<i class="sk-chip">${nameOf(s)}</i>`);
      });
    } catch (e) {}
    return r;
  };
  // what's new on the title screen
  try {
    const ul = document.querySelector(".tt-news ul");
    if (ul) {
      const li = document.createElement("li");
      li.innerHTML = EN ? `<b>Skin page · supply crates</b><span>Pull, my skins and by-gun tabs. A crate drops, glows in the colour of the best skin inside and bursts open</span>` : `<b>스킨 페이지 · 보급 상자</b><span>뽑기 · 내 스킨 · 총별 장착 탭. 상자가 떨어져 안에 든 최고 등급 색으로 빛나다 터집니다</span>`;
      ul.prepend(li);
      while (ul.children.length > 3) ul.lastElementChild.remove();
    }
  } catch (e) {}

  window.GUN_SKINS = { preview: previewItem, receive: takeInv, shop: () => SH, loadShop, buyShop, wish: () => [...WL.set], toggleWish, wishNotice, ticket: myTicket, vouch: vouched, _ver: () => VER, _tick: () => TICK, tab: setTab, curTab: () => AR.tab, selectItem, mineItems: () => mineItems().map((x) => x.g + "|" + x.s.id), thumb: thumbNow, feat: () => AR.feat, _reveal: (res) => (startReveal(res.length || 1), setTimeout(() => revealResults(res), 250)), _skip: () => revealAll(), list: SKINS, fits, skinsFor, buildFor, rar: RAR, guns: () => Object.keys(WEAPONS), mine: () => SK.mine, of: mySkin, set: setSkin, setAll, random: setRandom, apply: applySkin, template, open: openArmory, close: closeArmory, isOpen: () => AR.open, peer: PEER, skinOf, pending: PEND, drops: DSK, owns, inv: () => INV, gold: () => INV.gold, gated, pull, sync: () => sync(!0), paint: armoryPaint, reveal: () => RV, _pv: () => AR.pv, _show: pvShow, dress: dressGun };
})();
