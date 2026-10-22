// The one TIMELINE: every scene, beat, move, shot, click, line of copy and sound cue.
// film.html reads it to paint frames and render audio; the Node scripts read it for the
// captions, the stills and the checks. Times are seconds; 120 BPM, so one beat = 0.5 s
// and scenes change on the two-bar grid (every 4 beats = 2 s) where the music does.
(function (root) {
  // Screens are 2000x1125 px captures of the running game (scripts/capture-screens.js).
  // Click targets are the clicked element's centre from screens/path.json, x1.25 (DPR).
  const TIMELINE = {
    fps: 60,
    duration: 30,
    bpm: 120,
    idea: "13은 링크 하나로 열리는 5대5 전술 FPS다. 클릭 네 번이면 라운드 안이고, 빈자리는 AI가 채운다.",
    outcome: "다운로드 없이 13fps.vercel.app에서 지금 혼자서도 5대5 한 판을 시작할 수 있다는 걸 안다.",
    question: "5대5 전술 FPS, 다운로드부터 해야 할까?",

    scenes: [
      { id: "S1", t0: 0, t1: 3, arc: "Question", teaches: "익숙한 믿음: 전술 FPS는 다운로드를 기다리는 데서 시작한다.", check: "‘아, 다운로드 바’라고 알아본다." },
      { id: "S2", t0: 3, t1: 9, arc: "Model", teaches: "13은 주소 하나로 열리고, 한 판은 열 자리(5대5)다.", check: "‘링크로 여는 5대5 게임’이라고 말한다." },
      { id: "S3", t0: 9, t1: 20, arc: "Proof", teaches: "실제 경로: 클릭 네 번이면 라운드 안, 그 열 자리가 HUD의 열 명이다.", check: "‘클릭 네 번이면 들어간다’고 말한다." },
      { id: "S4", t0: 20, t1: 26, arc: "Turn", teaches: "빈자리를 누가 채우는지만 바꾼다: 혼자면 AI, 링크를 보내면 친구.", check: "‘친구도 링크로 들어온다’고 말한다." },
      { id: "S5", t0: 26, t1: 30, arc: "Payoff", teaches: "처음의 바는 다운로드 바가 아니라 주소창이었다.", check: "주소를 기억하고 지금 해 볼 수 있다." },
    ],

    screens: {
      landing: "screens/01-landing.png",
      landingIn: "screens/02-landing-in.png",
      home: "screens/03-home.png",
      select: "screens/04-select.png",
      buy: "screens/05-buy.png",
      live: "screens/06-live.png",
    },
    screenPx: [2000, 1125],

    // What the browser window shows, from t on. Hard cuts, each after the click ring is gone.
    shots: [
      { t: 4.25, src: "landing" },
      { t: 10.85, src: "landingIn" },
      { t: 12.85, src: "home" },
      { t: 14.85, src: "select" },
      { t: 17.1, src: "buy" },
      { t: 18.0, src: "live" },
    ],

    // The camera inside the window: reach focus (image px) and scale by t0 + d (d 0 = cut).
    zoom: [
      { t0: 0, d: 0, cx: 1000, cy: 562.5, s: 1 },
      { t0: 9.25, d: 0.5, cx: 1397.5, cy: 690, s: 1.7 }, // login card
      { t0: 13.25, d: 0.5, cx: 520, cy: 560, s: 1.7 }, // 혼자 하기
      { t0: 15.25, d: 0.5, cx: 1700, cy: 960, s: 1.7 }, // 전투 투입
      { t0: 17.1, d: 0, cx: 1000, cy: 562.5, s: 1 }, // cut to the buy phase, whole screen
      { t0: 18.0, d: 0, cx: 1000, cy: 300, s: 1.6 }, // cut to the live round, HUD 5:5 roster
      { t0: 19.25, d: 0.5, cx: 1000, cy: 562.5, s: 1 },
    ],

    // show: when the button's screen is up and its name appears; t: the click itself.
    clicks: [
      { show: 9.25, t: 10.5, n: 1, label: "게스트로 시작", at: [1397.5, 713.4] },
      { show: 11.0, t: 12.5, n: 2, label: "게임 들어가기", at: [1397.5, 711.3] },
      { show: 13.0, t: 14.5, n: 3, label: "혼자 하기", at: [395, 541.4] },
      { show: 15.0, t: 16.5, n: 4, label: "전투 투입", at: [1878, 995.5] },
    ],
    ring: 0.35,
    // The click counter replaces the copy while the path is walked.
    counter: { t0: 9.25, t1: 17.1, kicker: "클릭" },

    // HUD faces in screens/06-live.png (image px), left five = our team.
    hudFaces: [[783, 104], [823, 104], [863, 104], [903, 104], [943, 104], [1056, 104], [1096, 104], [1136, 104], [1176, 104], [1216, 104]],
    hudFaceSize: 36,

    // On-screen words (also the captions). l2 may arrive later than l1 (l2at).
    barLabel: { t0: 0.25, t1: 3.0, text: "다운로드 중" },
    copy: [
      { t0: 0.25, t1: 3.0, l1: "5대5 전술 FPS,", l2: "다운로드부터 해야 할까?", l2at: 0.25 },
      { t0: 4.25, t1: 6.4, l1: "링크 하나면 된다.", l2: "", l2at: 4.25 },
      { t0: 7.0, t1: 8.85, l1: "한 판에 열 자리.", l2: "", l2at: 7.0 },
      { t0: 17.1, t1: 19.9, l1: "클릭 네 번이면 라운드 안.", l2: "열 자리가 그대로 5:5.", l2at: 18.15 },
      { t0: 20.5, t1: 25.85, l1: "혼자 하면 빈자리는 AI가.", l2: "친구는 링크로 합류.", l2at: 22.0 },
      { t0: 26.75, t1: 30.0, l1: "다운로드 대신, 주소창.", l2: "지금 혼자서도 한 판.", l2at: 26.75 },
    ],

    url: "13fps.vercel.app",

    // Named moves: [start, duration]. Every tween in film.html reads one of these.
    moves: {
      barIn: [0, 0.5],
      fillRetract: [2.85, 0.15], // gone before the bar starts to round
      barToField: [3.0, 0.5],
      type: [3.5, 0.5],
      enter: [4.0, 0.5],
      winOpen: [4.25, 0.75],
      winHide: [6.5, 0.25],
      atkIn: [7.0, 0.5], // stagger 0.05 s per marker
      defIn: [7.25, 0.5],
      rowOut: [8.75, 0.25],
      winBack: [9.0, 0.25],
      cursorIn: [9.5, 0.25],
      cursorOut: [17.0, 0.1],
      stripIn: [18.0, 0.15],
      toHud: [18.15, 0.6], // stagger 0.02 s per marker
      hudFade: [19.0, 0.25],
      hudFadeReduced: [19.6, 0.25], // no move to watch in the reduced cut, so the seats hold on the HUD longer
      winOut: [20.0, 0.25],
      barToPill: [20.25, 0.5],
      backToRow: [20.5, 0.5],
      labelsIn: [21.0, 0.25],
      chip: [21.5, 0.5],
      flips: [22.0, 0.25], // one per 0.25 s for the four teammates
      clear: [26.0, 0.25], // seats and chip are gone before the bar moves
      barHome: [26.2, 0.5],
      fillHome: [26.45, 0.5],
      logoIn: [26.7, 0.5],
    },
    // The download bar crawls in steps on the beat: [t, fill].
    crawl: [[0.5, 0.04], [1.0, 0.07], [1.5, 0.09], [2.0, 0.12], [2.5, 0.135]],
    soloNames: ["나", "AI", "AI", "AI", "AI", "AI", "AI", "AI", "AI", "AI"],
    friendName: "친구",

    // Sound. motif = the game's own two-note kill sound (‘ta-DAN’, A major pentatonic
    // ladder from A4, js/legacy/61-kills-…js); it climbs each time the idea returns.
    // chords: [start, semitones from A4, root] — I vi IV V | I vi | I, changing with the scenes.
    chords: [[4, [-12, -8, -5, 2], -24], [8, [-15, -12, -8, -5], -27], [12, [-19, -15, -12, -10], -31], [16, [-17, -13, -10, -5], -29], [20, [-12, -8, -5, 2], -24], [24, [-15, -12, -8, -5], -27], [26, [-12, -8, -5, 4], -24]],
    cues: [
      { t: 0, type: "ticks", until: 3 },
      { t: 0, type: "drone", until: 4.5 },
      { t: 4.0, type: "motif", step: 1, why: "the link opens the game" },
      { t: 4.0, type: "bed", until: 30 },
      { t: 10.5, type: "click" },
      { t: 12.5, type: "click" },
      { t: 14.5, type: "click" },
      { t: 16.5, type: "click" },
      { t: 22.0, type: "motif", step: 3, why: "friends join by the link" },
      { t: 22.25, type: "pop" },
      { t: 22.5, type: "pop" },
      { t: 22.75, type: "pop" },
      { t: 27.0, type: "motif", step: 6, bell: true, why: "the bar was the address bar" },
    ],

    // A still at every beat that carries meaning (contact sheet, legibility checks).
    beats: [
      { t: 1.5, id: "S1 다운로드 바" },
      { t: 3.9, id: "S2 주소 입력" },
      { t: 5.2, id: "S2 탭이 열림" },
      { t: 8.0, id: "S2 열 자리" },
      { t: 10.3, id: "S3 클릭 1 직전" },
      { t: 10.7, id: "S3 클릭 1" },
      { t: 12.7, id: "S3 클릭 2" },
      { t: 14.7, id: "S3 클릭 3" },
      { t: 16.8, id: "S3 클릭 4" },
      { t: 17.5, id: "S3 구매 단계" },
      { t: 18.6, id: "S3 열 자리 = HUD" },
      { t: 19.5, id: "S3 라운드 안" },
      { t: 21.3, id: "S4 빈자리는 AI" },
      { t: 24.0, id: "S4 친구 합류" },
      { t: 29.0, id: "S5 주소창" },
    ],
  };
  if (typeof module !== "undefined" && module.exports) module.exports = TIMELINE;
  else root.TIMELINE = TIMELINE;
})(typeof window !== "undefined" ? window : globalThis);
