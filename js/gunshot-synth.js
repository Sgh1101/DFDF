(function (root) {
  "use strict";
  // Gunshots, one model per gun. A real shot is not a tone: it is (1) the crack of the bullet's shock wave, a
  // sharp broadband click that only supersonic rounds have; (2) the muzzle blast, a burst of noise whose length and
  // darkness follow the powder and the barrel; (3) the boom, the low pressure wave that drops in pitch; (4) a thud
  // in the low mids, because laptop speakers cannot play the boom; (5) the action (slide, bolt, pump) a moment
  // later; (6) the room, which is the biggest part of what makes a shot sound like a place. The first five are
  // rendered once per gun into short buffers (two takes each, so a burst is never one sample on repeat); the room
  // is a convolution reverb shared by all guns, longer indoors. No recordings: every number below is a choice made
  // from what the real weapon is, and the lab page (gunshot-lab.html) plays them one by one.
  //
  // The render is plain arithmetic on Float32Arrays: it runs in Node (tests) and in the browser the same way.

  // ── tools ──
  const rng = (seed) => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  // an RBJ biquad, direct form I
  function biquad(type, f, q, sr) {
    const w = (2 * Math.PI * Math.min(f, sr * 0.45)) / sr,
      cw = Math.cos(w),
      al = Math.sin(w) / (2 * q);
    let b0, b1, b2;
    if ("lp" === type) ((b0 = (1 - cw) / 2), (b1 = 1 - cw), (b2 = b0));
    else if ("hp" === type) ((b0 = (1 + cw) / 2), (b1 = -(1 + cw)), (b2 = b0));
    else ((b0 = al), (b1 = 0), (b2 = -al));
    const a0 = 1 + al,
      n0 = b0 / a0,
      n1 = b1 / a0,
      n2 = b2 / a0,
      a1 = (-2 * cw) / a0,
      a2 = (1 - al) / a0;
    let x1 = 0,
      x2 = 0,
      y1 = 0,
      y2 = 0;
    return (x) => {
      const y = n0 * x + n1 * x1 + n2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1;
      x1 = x;
      y2 = y1;
      y1 = y;
      return y;
    };
  }
  const pair = (type, f, q, sr) => {
    const a = biquad(type, f, q, sr),
      b = biquad(type, f, q, sr);
    return (x) => b(a(x));
  };

  // ── the guns ──
  // crack [level, high-pass Hz, ms]; blast [level, low-pass Hz, ms]; boom [level, Hz at start, Hz at end, ms];
  // thud [level, low-pass Hz, ms]; hiss [level, high-pass Hz, ms] (air: darts, rockets); tail [level, ms];
  // act [[delay ms, level, band Hz, clicks]]; sub: low-pass of the whole (a suppressed gun); wet: how much room
  const SPEC = {
    pistol: { ko: "권총", note: "9mm 반자동", rpm: 400, crack: [0.9, 2600, 7], blast: [0.75, 5200, 26], boom: [0.45, 150, 75, 95], thud: [0.55, 420, 60], tail: [0.14, 160], act: [[70, 0.16, 3200, 1]], wet: 0.9, lvl: 0.8 },
    silenced: { ko: "소음권총", note: "아음속 9mm와 소음기: 폭발음이 없고 슬라이드 소리가 남는다", rpm: 380, blast: [0.5, 1500, 38], boom: [0.25, 120, 70, 70], thud: [0.4, 360, 45], tail: [0.06, 80], act: [[8, 0.55, 3000, 2]], sub: 2400, wet: 0.5, lvl: 0.33 },
    revolver: { ko: "리볼버", note: ".357 매그넘: 날카롭고 길다", rpm: 180, crack: [1, 2200, 9], blast: [0.95, 4200, 48], boom: [0.75, 115, 52, 190], thud: [0.7, 380, 95], tail: [0.22, 380], wet: 1.1, lvl: 0.95 },
    machpist: { ko: "기관권총", note: "9mm 완전자동 소형: 짧고 딱딱하다", rpm: 900, crack: [0.85, 3200, 5], blast: [0.65, 5600, 20], boom: [0.3, 170, 90, 60], thud: [0.4, 450, 40], tail: [0.1, 110], wet: 0.8, lvl: 0.65 },
    handcan: { ko: "핸드캐논", note: ".50 AE 자동권총: 권총인데 소총보다 크다", rpm: 120, crack: [1, 1800, 11], blast: [1, 3600, 70], boom: [0.95, 95, 38, 280], thud: [0.85, 330, 130], tail: [0.3, 560], act: [[130, 0.2, 2400, 1]], wet: 1.2, lvl: 1 },
    smg: { ko: "기관단총", note: "9mm 서브머신건", rpm: 780, crack: [0.85, 2800, 6], blast: [0.7, 5000, 24], boom: [0.4, 160, 80, 80], thud: [0.5, 430, 50], tail: [0.12, 140], wet: 0.85, lvl: 0.75 },
    vector: { ko: "속사 SMG", note: ".45 ACP 고속연사: 낮고 두껍다", rpm: 1100, crack: [0.7, 2300, 6], blast: [0.7, 4200, 24], boom: [0.5, 125, 68, 85], thud: [0.6, 400, 55], tail: [0.1, 120], wet: 0.8, lvl: 0.7 },
    pdw: { ko: "경량 PDW", note: "5.7mm 고속탄: 가늘고 날카롭다", rpm: 650, crack: [1, 3600, 5], blast: [0.6, 6200, 22], boom: [0.28, 180, 95, 60], thud: [0.3, 480, 36], tail: [0.1, 130], wet: 0.85, lvl: 0.7 },
    ripper: { ko: "드럼 기관단총", note: "9mm 장탄창: 기관단총보다 한 단 낮다", rpm: 850, crack: [0.7, 2300, 6], blast: [0.8, 4300, 28], boom: [0.55, 125, 66, 95], thud: [0.65, 390, 58], tail: [0.13, 160], wet: 0.9, lvl: 0.78 },
    burstsmg: { ko: "점사 기관단총", note: "9mm 3점사: 밝고 또렷하다", rpm: 1000, crack: [1, 3300, 5], blast: [0.6, 5800, 21], boom: [0.3, 175, 90, 60], thud: [0.4, 460, 40], tail: [0.1, 115], wet: 0.8, lvl: 0.7 },
    whisper: { ko: "소음 기관단총", note: "아음속과 소음기: 노리쇠 달그락 소리가 총소리보다 크다", rpm: 720, blast: [0.45, 1700, 30], boom: [0.18, 130, 75, 55], thud: [0.35, 380, 38], tail: [0.05, 70], act: [[10, 0.75, 2800, 2]], sub: 2600, wet: 0.45, lvl: 0.3 },
    stinger: { ko: "독침 권총", note: "압축 공기식: 총성이 없고 쉬익 하는 바람소리와 딸깍", rpm: 1000, hiss: [0.7, 2200, 70], thud: [0.25, 300, 30], act: [[2, 0.5, 4200, 1]], wet: 0.4, lvl: 0.4 },
    pocketshot: { ko: "산탄 권총", note: "소형 산탄: 작은데 퍽 하고 크다", rpm: 140, crack: [1, 1900, 10], blast: [1, 3400, 58], boom: [0.8, 105, 45, 200], thud: [0.8, 360, 90], tail: [0.25, 420], wet: 1.1, lvl: 0.9 },
    shotgun: { ko: "산탄총", note: "12게이지 펌프: 쾅, 그리고 펌프 철컥", rpm: 180, crack: [0.9, 1500, 12], blast: [1, 3000, 80], boom: [0.95, 90, 36, 240], thud: [0.9, 320, 120], tail: [0.3, 520], act: [[190, 0.5, 1800, 2]], wet: 1.15, lvl: 1 },
    autoshot: { ko: "자동 산탄총", note: "12게이지 반자동: 펌프 없이 연속으로", rpm: 330, crack: [0.9, 1700, 10], blast: [0.95, 3300, 60], boom: [0.8, 100, 42, 190], thud: [0.8, 340, 95], tail: [0.25, 420], wet: 1.05, lvl: 0.95 },
    slugger: { ko: "슬러그건", note: "12게이지 슬러그탄: 가장 낮고 둔하다", rpm: 150, crack: [1, 1400, 14], blast: [1, 2600, 90], boom: [1, 80, 30, 320], thud: [1, 300, 150], tail: [0.35, 640], act: [[230, 0.5, 1700, 2]], wet: 1.25, lvl: 1.05 },
    doublebarrel: { ko: "더블배럴", note: "12게이지 쌍발: 한 방에 두 배의 폭발", rpm: 260, crack: [1, 1500, 13], blast: [1, 2900, 85], boom: [1, 85, 32, 280], thud: [1, 310, 135], tail: [0.35, 600], wet: 1.2, lvl: 1.05 },
    rifle: { ko: "돌격소총", note: "7.62×39와 5.56 계열", rpm: 620, crack: [1, 2000, 8], blast: [0.9, 4400, 44], boom: [0.7, 115, 50, 140], thud: [0.7, 380, 80], tail: [0.2, 340], wet: 1, lvl: 0.9 },
    carbine: { ko: "카빈", note: "5.56mm 짧은 총열: 날카롭고 가볍다", rpm: 700, crack: [1, 2700, 7], blast: [0.9, 5100, 36], boom: [0.5, 135, 60, 105], thud: [0.55, 400, 62], tail: [0.16, 260], wet: 0.95, lvl: 0.85 },
    battle: { ko: "전투소총", note: "7.62×51 NATO: 묵직하다", rpm: 480, crack: [1, 1700, 10], blast: [1, 3800, 56], boom: [0.9, 98, 42, 200], thud: [0.85, 350, 105], tail: [0.26, 460], wet: 1.05, lvl: 0.97 },
    burst: { ko: "점사소총", note: "5.56mm 3점사: 소총보다 밝다", rpm: 900, crack: [1, 2300, 7], blast: [0.85, 4800, 38], boom: [0.55, 125, 56, 115], thud: [0.6, 390, 68], tail: [0.17, 290], wet: 0.95, lvl: 0.85 },
    scout: { ko: "정찰 소총", note: ".223 경량: 가볍게 탁 튄다", rpm: 300, crack: [1, 2500, 7], blast: [0.85, 4800, 40], boom: [0.5, 135, 58, 115], thud: [0.55, 390, 68], tail: [0.2, 320], wet: 1, lvl: 0.84 },
    bullpup: { ko: "불펍 소총", note: "5.56mm 불펍: 폭발이 귀 옆에서 나서 둔탁하다", rpm: 760, crack: [0.85, 1800, 8], blast: [0.95, 3400, 42], boom: [0.65, 118, 52, 120], thud: [0.8, 350, 80], tail: [0.18, 300], wet: 0.95, lvl: 0.88 },
    lmg: { ko: "경기관총", note: "벨트급탄: 소총보다 길고 안정적이다", rpm: 700, crack: [1, 1900, 9], blast: [1, 3900, 50], boom: [0.85, 105, 45, 170], thud: [0.85, 360, 90], tail: [0.26, 420], wet: 1.05, lvl: 0.95 },
    hmg: { ko: "중기관총", note: ".50 BMG 계열: 땅이 울린다", rpm: 580, crack: [1, 1500, 12], blast: [1, 3000, 78], boom: [1, 70, 30, 300], thud: [1, 300, 140], tail: [0.35, 600], wet: 1.2, lvl: 1.1 },
    minigun: { ko: "회전 기관총", note: "7.62mm 초고속 연사: 한 발 한 발이 이어붙어 부르르 소리가 된다", rpm: 1200, crack: [0.7, 2200, 5], blast: [0.7, 4200, 22], boom: [0.55, 100, 60, 60], thud: [0.7, 340, 40], tail: [0.08, 100], wet: 0.75, lvl: 0.8 },
    marksman: { ko: "지정사수총", note: ".308 반자동: 느리고 크다", rpm: 110, crack: [1, 1700, 10], blast: [1, 3500, 64], boom: [0.95, 85, 38, 250], thud: [0.9, 330, 115], tail: [0.34, 620], wet: 1.15, lvl: 1 },
    sniper: { ko: "저격총", note: ".338 볼트액션: 날카로운 충격파와 긴 여운, 뒤이어 노리쇠", rpm: 45, crack: [1, 1400, 14], blast: [1, 2800, 90], boom: [1, 72, 28, 340], thud: [1, 300, 160], tail: [0.42, 900], act: [[520, 0.55, 1800, 2]], wet: 1.35, lvl: 1.1 },
    antimat: { ko: "대물 저격총", note: ".50 BMG 단발: 총구 제동기의 거대한 블래스트", rpm: 35, crack: [1, 1300, 16], blast: [1, 2500, 110], boom: [1, 60, 24, 420], thud: [1, 280, 190], tail: [0.5, 1200], act: [[800, 0.6, 1500, 2]], wet: 1.5, lvl: 1.2 },
    rpg: { ko: "RPG", note: "로켓 발사: 쉬익, 쿵", rpm: 40, blast: [0.6, 1800, 200], boom: [0.9, 70, 32, 380], thud: [0.9, 260, 180], hiss: [0.8, 1400, 380], tail: [0.35, 900], wet: 1.1, lvl: 1 },
  };
  // the game's older shot kinds (bots, fallbacks) map to a gun
  const KIND = { rifle: "rifle", sniper: "sniper", shotgun: "shotgun", heavy: "lmg", pistol: "pistol", quiet: "silenced" };
  // two rooms: the open air (a little slap from the ground and the walls) and the hospital
  const ROOMS = { open: { rt: 0.55, dark: 0.7, wet: 1 }, indoor: { rt: 1.5, dark: 0.55, wet: 1.3 } };

  // ── the render: one take of one gun ──
  function lengthOf(S) {
    let ms = 60;
    S.crack && (ms = Math.max(ms, S.crack[2] * 6));
    S.blast && (ms = Math.max(ms, S.blast[2] * 3));
    S.boom && (ms = Math.max(ms, S.boom[3] * 1.3));
    S.thud && (ms = Math.max(ms, S.thud[2] * 2.2));
    S.hiss && (ms = Math.max(ms, S.hiss[2] * 2.6));
    S.tail && (ms = Math.max(ms, S.tail[1] * 1.1));
    for (const a of S.act || []) ms = Math.max(ms, a[0] + (a[3] || 1) * 18 + 50);
    return Math.min(1.8, ms / 1000 + 0.04);
  }
  function render(S, sr, seed) {
    const r = rng(seed),
      shared = rng(31337),
      n = Math.ceil(sr * lengthOf(S)),
      out = new Float32Array(n),
      // most of the noise is the same in every take of a gun and a part is the take's own: two takes are two
      // shots of one gun (the same colour, never the same sample), not two different guns
      nz = () => 0.7 * (shared() * 2 - 1) + 0.3 * (r() * 2 - 1);
    if (S.crack) {
      const [lv, hz, ms] = S.crack,
        f = pair("hp", hz, 0.7, sr),
        tau = ms / 1000 / 3.2,
        m = Math.min(n, Math.ceil(sr * (ms / 1000) * 6));
      // the shock wave starts at full strength: no attack at all
      for (let i = 0; i < m; i++) out[i] += lv * f(nz()) * Math.exp(-i / sr / tau);
    }
    if (S.blast) {
      const [lv, hz, ms] = S.blast,
        f = pair("lp", hz, 0.6, sr),
        g = pair("lp", hz * 0.45, 0.6, sr),
        tau = ms / 1000 / 2.4,
        m = Math.min(n, Math.ceil(sr * (ms / 1000) * 3));
      for (let i = 0; i < m; i++) {
        const t = i / sr,
          x = nz(),
          att = Math.min(1, t / 0.0004);
        // brighter at the start, darker as the gas expands
        out[i] += lv * att * Math.exp(-t / tau) * (0.55 * f(x) + 0.75 * g(x) * (1 - Math.exp(-t / (tau * 0.5))) + 0.45 * g(x));
      }
    }
    if (S.boom) {
      const [lv, f0, f1, ms] = S.boom,
        tau = ms / 1000 / 3,
        m = Math.min(n, Math.ceil(sr * (ms / 1000) * 1.3));
      let ph = 0;
      for (let i = 0; i < m; i++) {
        const t = i / sr,
          f = f1 + (f0 - f1) * Math.exp(-t / (ms / 4000)),
          e = Math.exp(-t / tau) * Math.min(1, t / 0.002);
        ph += (2 * Math.PI * f) / sr;
        // the second harmonic is what a small speaker can actually play
        out[i] += lv * e * (Math.sin(ph) + 0.35 * Math.sin(2 * ph + 0.6));
      }
    }
    if (S.thud) {
      const [lv, hz, ms] = S.thud,
        f = pair("lp", hz, 0.7, sr),
        tau = ms / 1000 / 2.4,
        m = Math.min(n, Math.ceil(sr * (ms / 1000) * 2.2));
      for (let i = 0; i < m; i++) out[i] += lv * 1.5 * f(nz()) * Math.exp(-i / sr / tau) * Math.min(1, i / sr / 0.0015);
    }
    if (S.hiss) {
      const [lv, hz, ms] = S.hiss,
        f = pair("hp", hz, 0.7, sr),
        tau = ms / 1000 / 2,
        m = Math.min(n, Math.ceil(sr * (ms / 1000) * 2.6));
      for (let i = 0; i < m; i++) {
        const t = i / sr;
        out[i] += lv * 0.7 * f(nz()) * Math.exp(-t / tau) * Math.min(1, t / 0.006);
      }
    }
    if (S.tail) {
      const [lv, ms] = S.tail,
        f = pair("lp", 650, 0.7, sr),
        tau = ms / 1000 / 3,
        st = Math.floor(sr * 0.01);
      for (let i = st; i < Math.min(n, st + Math.ceil(sr * (ms / 1000) * 1.1)); i++) out[i] += lv * f(nz()) * Math.exp(-(i - st) / sr / tau);
    }
    for (const [d, lv, hz, cnt] of S.act || []) {
      for (let k = 0; k < (cnt || 1); k++) {
        const f = biquad("bp", hz * (0.92 + 0.16 * r()), 2.2, sr),
          st = Math.floor(sr * ((d + k * 18) / 1000)),
          m = Math.ceil(sr * 0.03);
        let ph = 0;
        for (let i = 0; i < m && st + i < n; i++) {
          const t = i / sr;
          ph += (2 * Math.PI * 170) / sr;
          out[st + i] += lv * (2.2 * f(nz()) * Math.exp(-t / 0.003) + 0.35 * Math.sin(ph) * Math.exp(-t / 0.009));
        }
      }
    }
    if (S.sub) {
      const f = pair("lp", S.sub, 0.7, sr);
      for (let i = 0; i < n; i++) out[i] = f(out[i]);
    }
    // a soft clip adds the grit of a real peak, then the level is set and the end faded
    let pk = 1e-9;
    const drive = 1.5,
      td = Math.tanh(drive);
    for (let i = 0; i < n; i++) {
      out[i] = Math.tanh(drive * out[i]) / td;
      pk = Math.max(pk, Math.abs(out[i]));
    }
    const fade = Math.floor(sr * 0.006);
    for (let i = 0; i < n; i++) out[i] *= (0.95 / pk) * (i > n - fade ? (n - i) / fade : 1);
    return out;
  }
  // an impulse response for the room: a few early reflections, then noise that dies away and darkens
  function reverbIR(sr, rt, dark, seed) {
    const r = rng(seed),
      n = Math.ceil(sr * rt * 1.05),
      out = new Float32Array(n),
      tau = rt / 6.9;
    let y = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr,
        a = Math.max(0.05, (1 - (t / rt) * 0.9) * dark);
      y += a * (r() * 2 - 1 - y);
      out[i] = y * Math.exp(-t / tau) * Math.min(1, t / 0.004);
    }
    for (const [t, g] of [[0.011, 0.5], [0.019, -0.4], [0.031, 0.35], [0.047, -0.3], [0.067, 0.25]]) {
      const k = Math.floor(t * sr);
      k < n && (out[k] += g * (0.6 + dark));
    }
    return out;
  }

  // ── the player ──
  function engine(c, dest) {
    const bus = c.createGain(),
      comp = c.createDynamicsCompressor(),
      conv = c.createConvolver(),
      wetIn = c.createGain(),
      wetLP = c.createBiquadFilter();
    bus.gain.value = 0.26;
    comp.threshold.value = -16;
    comp.knee.value = 14;
    comp.ratio.value = 5;
    comp.attack.value = 0.002;
    comp.release.value = 0.14;
    wetLP.type = "lowpass";
    wetLP.frequency.value = 5200;
    bus.connect(comp);
    comp.connect(dest);
    wetIn.connect(conv);
    conv.connect(wetLP);
    wetLP.connect(bus);
    const takes = {},
      irs = {};
    let room = "",
      roomWet = 1,
      active = 0;
    const toBuf = (arr) => {
      const b = c.createBuffer(1, arr.length, c.sampleRate);
      b.copyToChannel ? b.copyToChannel(arr, 0) : b.getChannelData(0).set(arr);
      return b;
    };
    const eng = {
      setRoom(name) {
        if (name === room) return;
        room = name;
        const p = ROOMS[name] || ROOMS.open;
        roomWet = p.wet;
        conv.buffer = irs[name] || (irs[name] = toBuf(reverbIR(c.sampleRate, p.rt, p.dark, 7)));
      },
      take(key) {
        const S = SPEC[key];
        if (!S) return null;
        if (!takes[key]) takes[key] = [toBuf(render(S, c.sampleRate, 11 + key.length * 131))];
        takes[key].length < 2 && setTimeout(() => takes[key] && takes[key].length < 2 && takes[key].push(toBuf(render(S, c.sampleRate, 97 + key.length * 53))), 30);
        return takes[key][Math.floor(Math.random() * takes[key].length)];
      },
      // Renders ahead what the first shot of `key` would render, one take per call so an idle callback can take them one at a
      // time. True while a take is left; warmed(key) says both are in.
      warm(key) {
        const S = SPEC[key];
        if (!S) return false;
        if (!takes[key]) takes[key] = [toBuf(render(S, c.sampleRate, 11 + key.length * 131))];
        else if (takes[key].length < 2) takes[key].push(toBuf(render(S, c.sampleRate, 97 + key.length * 53)));
        return takes[key].length < 2;
      },
      warmed: (key) => !!(takes[key] && takes[key].length > 1),
      // far: 0 (at your ear) to 1 (across the map); the sound arrives later, duller, quieter and wetter
      play(key, far) {
        const S = SPEC[key];
        if (!S) return false;
        far = Math.min(1, Math.max(0, far || 0));
        const k = 1 - 0.82 * far;
        // a crowd firing at once: far shots are dropped first, so the ones near you are never the ones cut
        if (k < 0.06 || active >= 40 || (active >= 24 && far > 0.45)) return true;
        const b = eng.take(key),
          src = c.createBufferSource(),
          g = c.createGain(),
          lp = c.createBiquadFilter(),
          send = c.createGain();
        room || eng.setRoom("open");
        src.buffer = b;
        src.playbackRate.value = 0.97 + Math.random() * 0.06;
        g.gain.value = S.lvl * k * (0.92 + 0.16 * Math.random());
        lp.type = "lowpass";
        lp.frequency.value = 19000 - 16500 * Math.pow(far, 0.6);
        send.gain.value = (S.wet || 1) * roomWet * (0.28 + 0.55 * far);
        src.connect(g);
        g.connect(lp);
        lp.connect(bus);
        lp.connect(send);
        send.connect(wetIn);
        active++;
        src.onended = () => {
          active--;
          try {
            src.disconnect();
            g.disconnect();
            lp.disconnect();
            send.disconnect();
          } catch (e) {}
        };
        src.start(c.currentTime + 0.2 * far);
        return true;
      },
    };
    return eng;
  }

  const API = { SPEC, KIND, ROOMS, render, reverbIR, engine, has: (k) => !!SPEC[k], rng };
  if ("undefined" != typeof module && module.exports) module.exports = API;
  else root.GUNSYNTH = API;
})("undefined" != typeof window ? window : globalThis);
