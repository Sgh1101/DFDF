// The one TIMELINE: every scene, beat, move, shot, click, line of copy and sound cue.
// film.html reads it to paint frames and render audio; the Node scripts read it for the
// captions, the stills and the checks. Times are seconds; 120 BPM, so one beat = 0.5 s.
//
// Second build (2026-10-22). Opens on real play, signs up instead of a guest, counts what
// is inside with moving pictures, and says less. Research behind the choices: RESEARCH.md.
(function (root) {
  // Screens are 2000x1125 px captures of the running game (scripts/capture-screens.js,
  // scripts/capture-content.js); clips are JPEG frame sequences recorded by stepping the
  // game's own loop (scripts/capture-clips.js). Click targets are the clicked element's
  // centre from screens/path.json, x1.25 (DPR). Counts are the game's own (content.json).
  const TIMELINE = {
    fps: 60,
    duration: 40,
    bpm: 120,
    idea: "13은 브라우저 탭 하나로 바로 하는 5대5 전술 FPS다. 가입은 클릭 한 번, 교전까지 클릭 네 번, 요원·스킬·맵·스킨은 다 들어 있고, 혼자여도 5대5다.",
    outcome: "다운로드 없이 13fps.vercel.app에서 지금 바로, 혼자서도 내용이 꽉 찬 5대5 한 판을 시작할 수 있다는 걸 안다.",
    question: "이 플레이 화면이 브라우저 탭이라고?",

    scenes: [
      { id: "S1", t0: 0, t1: 6.5, arc: "Hook", teaches: "보고 있던 실제 플레이가 브라우저 탭 안이었다.", check: "‘저게 브라우저에서 돌아간다고?’라고 반응한다." },
      { id: "S2", t0: 6.5, t1: 17, arc: "Path", teaches: "가입은 클릭 한 번, 링크에서 교전까지 클릭 네 번.", check: "‘가입도 바로, 네 번이면 들어간다’고 말한다." },
      { id: "S3", t0: 17, t1: 27, arc: "Inside", teaches: "브라우저 게임이라고 비어 있지 않다: 요원·스킬·맵·스킨.", check: "‘요원도 맵도 스킨도 많다’고 말한다." },
      { id: "S4", t0: 27, t1: 34.5, arc: "Turn", teaches: "혼자여도 5대5(빈자리는 AI), 링크를 보내면 친구가 그 자리에.", check: "‘친구도 링크로 들어온다’고 말한다." },
      { id: "S5", t0: 34.5, t1: 40, arc: "Payoff", teaches: "다운로드 대신 탭 하나. 주소는 13fps.vercel.app.", check: "주소를 기억하고 지금 해 볼 수 있다." },
    ],

    screens: {
      landing: "screens/01-landing.png",
      landingTyped: "screens/01b-landing-typed.png",
      landingIn: "screens/02-landing-in.png",
      home: "screens/03-home.png",
      select: "screens/04-select.png",
      buy: "screens/05-buy.png",
      live: "screens/06-live.png",
      agents: "screens/11-abilities.png",
      skins: "screens/13-skins.png",
    },
    screenPx: [2000, 1125],
    // Frame sequences: dir/NNN.jpg, played from the shot's start at the clip's own rate.
    clips: {
      open: { dir: "screens/clips/open", fps: 30, frames: 150, what: "빙하 관측소, 화령: 달리고, Q 불꽃 장막을 치고, 쏜다" },
      cast: { dir: "screens/clips/cast", fps: 30, frames: 75, what: "네온 정점, 화령: Q 불꽃 장막, E 화염탄, 사격" },
      "map-pogu": { dir: "screens/clips/map-pogu", fps: 24, frames: 48, what: "포구, 홈 화면의 공중 카메라" },
      "map-neon": { dir: "screens/clips/map-neon", fps: 24, frames: 48, what: "네온 정점" },
      "map-train": { dir: "screens/clips/map-train", fps: 24, frames: 48, what: "달리는 열차" },
    },

    // What the window shows, from t on. Hard cuts. "clip:name" plays a frame sequence.
    shots: [
      { t: 0, src: "clip:open" },
      { t: 6.5, src: "landing" },
      { t: 7.2, src: "landingTyped" },
      { t: 9.35, src: "landingIn" },
      { t: 10.85, src: "home" },
      { t: 12.35, src: "select" },
      { t: 13.85, src: "buy" },
      { t: 14.6, src: "live" },
      { t: 17.0, src: "agents" },
      { t: 19.5, src: "clip:cast" },
      { t: 22.0, src: "clip:map-pogu" },
      { t: 22.8, src: "clip:map-neon" },
      { t: 23.6, src: "clip:map-train" },
      { t: 24.5, src: "skins" },
    ],

    // The camera inside the window: reach focus (image px) and scale by t0 + d (d 0 = cut).
    zoom: [
      { t0: 0, d: 0, cx: 1000, cy: 562.5, s: 1 },
      { t0: 6.5, d: 0, cx: 1397.5, cy: 690, s: 1.7 }, // the login card
      { t0: 9.35, d: 0, cx: 1397.5, cy: 700, s: 1.7 }, // the enter button sits where the card was
      { t0: 10.85, d: 0, cx: 520, cy: 560, s: 1.7 }, // 혼자 하기
      { t0: 12.35, d: 0, cx: 1700, cy: 960, s: 1.7 }, // 전투 투입
      { t0: 13.85, d: 0, cx: 1000, cy: 562.5, s: 1 }, // the buy phase, whole
      { t0: 14.6, d: 0, cx: 1000, cy: 300, s: 1.6 }, // the live round: clock and 5:5 roster
      { t0: 15.6, d: 0.5, cx: 1000, cy: 562.5, s: 1 },
      { t0: 17.0, d: 0, cx: 760, cy: 470, s: 1.35 }, // the agent grid
      { t0: 18.2, d: 0.8, cx: 1760, cy: 545, s: 2.1 }, // pan to the same agent's four abilities
      { t0: 19.5, d: 0, cx: 1000, cy: 562.5, s: 1 }, // clips and tiles: whole
      { t0: 24.5, d: 0, cx: 1300, cy: 720, s: 1.3 }, // the armoury: a skin on a gun, the grid
    ],

    // show: when the button's screen is up and its name appears; t: the click itself.
    clicks: [
      { show: 8.0, t: 9.0, n: 1, label: "로그인 / 가입", at: [1397.5, 607.1] },
      { show: 9.5, t: 10.5, n: 2, label: "게임 들어가기", at: [1397.5, 723.8] },
      { show: 11.0, t: 12.0, n: 3, label: "혼자 하기", at: [395, 541.4] },
      { show: 12.5, t: 13.5, n: 4, label: "전투 투입", at: [1878, 995.5] },
    ],
    ring: 0.35,
    counter: { t0: 8.0, t1: 14.6, kicker: "클릭" },
    typing: { t0: 7.2, keys: 6, every: 0.08 },
    // What is inside, counted the way the game counts it (GAME_CATALOG.counts()).
    inventory: {
      t0: 17.0, t1: 27.0, kicker: "있을 건, 다 있습니다.",
      items: [
        { show: 17.0, label: "요원", n: 28, unit: "명" },
        { show: 19.5, label: "스킬", n: 112, unit: "개" },
        { show: 22.0, label: "맵", n: 22, unit: "개" },
        { show: 24.5, label: "스킨", n: 607, unit: "개" },
      ],
    },

    // On-screen words (also the captions). l2 may arrive later than l1 (l2at).
    copy: [
      { t0: 3.0, t1: 5.0, l1: "전부, 브라우저 안에서.", l2: "", l2at: 3.0 },
      { t0: 6.6, t1: 7.9, l1: "가입은 클릭 한 번.", l2: "인증도 이메일도 없습니다.", l2at: 6.6 },
      { t0: 15.3, t1: 16.9, l1: "링크에서 교전까지,", l2: "클릭 네 번.", l2at: 15.3 },
      { t0: 27.5, t1: 30.4, l1: "혼자여도 5대5.", l2: "빈자리는 AI가 채웁니다.", l2at: 28.0 },
      { t0: 30.75, t1: 34.25, l1: "링크 하나 보내면,", l2: "친구가 그 자리에.", l2at: 31.0 },
      { t0: 35.0, t1: 40.0, l1: "다운로드 대신, 탭 하나.", l2: "지금 한 판.", l2at: 35.0 },
    ],
    title: { t0: 5.0, t1: 6.5, sub: "다운로드 없는 5대5 전술 FPS" },

    url: "13fps.vercel.app",

    // Named moves: [start, duration]. Every tween in film.html reads one of these.
    moves: {
      reveal: [2.5, 0.5], // full-frame play shrinks into a browser window
      winHide: [5.0, 0.25],
      titleIn: [5.1, 0.3],
      titleOut: [6.3, 0.2],
      winBack: [6.5, 0.2],
      cursorIn: [8.3, 0.25],
      cursorOut: [13.8, 0.1],
      winOut: [27.0, 0.25],
      barToPill: [27.25, 0.4],
      seatsIn: [27.5, 0.4], // ours first, stagger 0.05 s; theirs 0.25 s later
      labelsIn: [28.0, 0.25],
      chip: [30.5, 0.4],
      flips: [31.0, 0.25], // one per 0.25 s for the four teammates
      clear: [34.5, 0.25],
      barHome: [34.7, 0.4],
      fillHome: [35.0, 0.4],
      logoIn: [35.2, 0.4],
    },
    soloNames: ["나", "AI", "AI", "AI", "AI", "AI", "AI", "AI", "AI", "AI"],
    friendName: "친구",

    // Sound. motif = the game's own two-note kill sound (‘ta-DAN’, A major pentatonic
    // ladder from A4, js/legacy/61-kills-…js); it climbs each time the idea returns.
    // chords: [start, semitones from A4, root] — I vi IV V | I IV V | I vi | I, on the scenes.
    chords: [
      [3, [-12, -8, -5, 2], -24], [7, [-15, -12, -8, -5], -27], [11, [-19, -15, -12, -10], -31], [15, [-17, -13, -10, -5], -29],
      [17, [-12, -8, -5, 2], -24], [21, [-19, -15, -12, -10], -31], [25, [-17, -13, -10, -5], -29],
      [27, [-12, -8, -5, 2], -24], [31, [-15, -12, -8, -5], -27], [35, [-12, -8, -5, 4], -24],
    ],
    cues: [
      { t: 0, type: "bed", until: 40 },
      { t: 1.5, type: "cast", why: "Q in the opening clip" },
      { t: 2.5, type: "motif", step: 1, why: "the play was a browser tab" },
      { t: 3.0, type: "shots", n: 6, every: 0.085, why: "the opening clip fires" },
      { t: 5.0, type: "thud", why: "13" },
      { t: 7.2, type: "keys", n: 6, every: 0.08 },
      { t: 9.0, type: "click" },
      { t: 10.5, type: "click" },
      { t: 12.0, type: "click" },
      { t: 13.5, type: "click" },
      { t: 17.0, type: "count", step: 1 },
      { t: 19.5, type: "count", step: 2 },
      { t: 20.0, type: "cast", why: "Q in the cast clip" },
      { t: 20.9, type: "cast", why: "E in the cast clip" },
      { t: 21.5, type: "shots", n: 5, every: 0.085, why: "the cast clip fires" },
      { t: 22.0, type: "count", step: 3 },
      { t: 24.5, type: "count", step: 4 },
      { t: 31.0, type: "motif", step: 3, why: "friends join by the link" },
      { t: 31.25, type: "pop" },
      { t: 31.5, type: "pop" },
      { t: 31.75, type: "pop" },
      { t: 35.2, type: "motif", step: 6, bell: true, why: "download instead: one tab" },
    ],

    // A still at every beat that carries meaning (contact sheet, legibility checks).
    beats: [
      { t: 1.2, id: "S1 실제 플레이" },
      { t: 2.75, id: "S1 창으로 줄어듦" },
      { t: 4.0, id: "S1 브라우저 안" },
      { t: 5.8, id: "S1 13" },
      { t: 7.5, id: "S2 아이디·비밀번호" },
      { t: 9.2, id: "S2 클릭 1 가입" },
      { t: 10.7, id: "S2 클릭 2" },
      { t: 12.2, id: "S2 클릭 3" },
      { t: 13.7, id: "S2 클릭 4" },
      { t: 15.0, id: "S2 라운드 안" },
      { t: 16.2, id: "S2 클릭 네 번" },
      { t: 18.9, id: "S3 요원 28명" },
      { t: 20.6, id: "S3 스킬 112개" },
      { t: 23.0, id: "S3 맵 22개" },
      { t: 25.8, id: "S3 스킨 607개" },
      { t: 29.0, id: "S4 혼자여도 5대5" },
      { t: 33.0, id: "S4 친구가 그 자리에" },
      { t: 38.5, id: "S5 탭 하나" },
    ],
  };
  if (typeof module !== "undefined" && module.exports) module.exports = TIMELINE;
  else root.TIMELINE = TIMELINE;
})(typeof window !== "undefined" ? window : globalThis);
