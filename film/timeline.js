// The one TIMELINE: every scene, beat, move, shot, click, line of copy and sound cue.
// film.html reads it to paint frames and render audio; the Node scripts read it for the
// captions, the stills and the checks. Times are seconds; 120 BPM, so one beat = 0.5 s.
(function (root) {
  // Screens are 2000x1125 px captures of the running game (scripts/capture-screens.js).
  // Click targets are the clicked element's centre from screens/path.json, x1.25 (DPR).
  const TIMELINE = {
    fps: 60,
    duration: 30,
    bpm: 120,
    idea: "13은 링크 하나로 열리는 5대5 전술 FPS다. 클릭 네 번이면 라운드 안이고, 빈자리는 AI가 채운다.",
    outcome: "설치 없이 13fps.vercel.app에서 지금 혼자서도 5대5 한 판을 시작할 수 있다는 걸 안다.",
    question: "5대5 전술 FPS, 설치부터 기다려야 할까?",

    scenes: [
      { id: "S1", t0: 0, t1: 3, arc: "Question", teaches: "익숙한 믿음: 전술 FPS는 설치를 기다리는 데서 시작한다.", check: "‘아, 설치 바’라고 알아본다." },
      { id: "S2", t0: 3, t1: 10.5, arc: "Model", teaches: "13은 주소 하나로 열리고, 안에서는 5대5로 스파이크를 두고 싸운다.", check: "13이 무엇이고 어떻게 이기는 게임인지 한 문장으로 말한다." },
      { id: "S3", t0: 10.5, t1: 22.5, arc: "Proof", teaches: "실제 경로: 클릭 네 번이면 라운드 안, 그 열 명이 HUD의 열 명이다.", check: "‘클릭 네 번이면 들어간다’고 말한다." },
      { id: "S4", t0: 22.5, t1: 27, arc: "Turn", teaches: "빈자리를 누가 채우는지만 바꾼다: 혼자면 AI, 링크를 보내면 친구.", check: "‘친구도 링크로 설치 없이 들어온다’고 말한다." },
      { id: "S5", t0: 27, t1: 30, arc: "Payoff", teaches: "처음의 바는 설치 바가 아니라 주소창이었다.", check: "주소를 기억하고 지금 해 볼 수 있다." },
    ],

    screens: {
      landing: "screens/01-landing.png",
      landingIn: "screens/02-landing-in.png",
      home: "screens/03-home.png",
      select: "screens/04-select.png",
      buy: "screens/05-buy.png",
      live: "screens/06-live.png",
      planted: "screens/07-planted.png",
    },
    screenPx: [2000, 1125],

    // What the browser window shows, from t on (0.2 s cross-fade into each).
    shots: [
      { t: 4.25, src: "landing" },
      { t: 11.75, src: "landingIn" },
      { t: 13.75, src: "home" },
      { t: 15.75, src: "select" },
      { t: 17.75, src: "buy" },
      { t: 18.75, src: "live" },
      { t: 21.0, src: "planted" },
    ],

    // The camera inside the window: reach focus (image px) and scale by t0 + d.
    zoom: [
      { t0: 0, d: 0, cx: 1000, cy: 562.5, s: 1 },
      { t0: 5.25, d: 0.5, cx: 560, cy: 716, s: 2.1 }, // the landing's own line: 설치 없이 브라우저에서 바로.
      { t0: 7.0, d: 0.5, cx: 1000, cy: 562.5, s: 1 },
      { t0: 10.75, d: 0.5, cx: 1397.5, cy: 690, s: 1.7 }, // login card
      { t0: 14.25, d: 0.5, cx: 520, cy: 560, s: 1.7 }, // 혼자 하기
      { t0: 16.25, d: 0.5, cx: 1700, cy: 960, s: 1.7 }, // 전투 투입
      { t0: 17.75, d: 0.5, cx: 1000, cy: 562.5, s: 1 },
      { t0: 18.75, d: 0.5, cx: 1000, cy: 300, s: 1.6 }, // HUD 5:5 roster
      { t0: 20.25, d: 0.5, cx: 1000, cy: 560, s: 1.25 }, // the spike
      { t0: 22.25, d: 0.25, cx: 1000, cy: 562.5, s: 1 },
    ],

    clicks: [
      { t: 11.5, n: 1, label: "게스트로 시작", at: [1397.5, 713.4] },
      { t: 13.5, n: 2, label: "게임 들어가기", at: [1397.5, 711.3] },
      { t: 15.5, n: 3, label: "혼자 하기", at: [395, 541.4] },
      { t: 17.5, n: 4, label: "전투 투입", at: [1878, 995.5] },
    ],

    // Underline drawn under the landing's own sentence (image px).
    tagline: { t0: 5.75, d: 0.5, x0: 486, x1: 728, y: 754 },
    // HUD faces in screens/06-live.png (image px), left five = our team.
    hudFaces: [[783, 104], [823, 104], [863, 104], [903, 104], [943, 104], [1056, 104], [1096, 104], [1136, 104], [1176, 104], [1216, 104]],
    hudFaceSize: 36,
    // The planted spike's on-screen marker in screens/07-planted.png (image px).
    spikeMark: [995, 450],

    // On-screen words (also the captions). l2 may arrive later than l1 (l2at).
    copy: [
      { t0: 0.25, t1: 2.85, l1: "5대5 전술 FPS,", l2: "설치부터 기다려야 할까?", l2at: 0.75 },
      { t0: 4.25, t1: 6.9, l1: "링크 하나면 된다.", l2: "", l2at: 4.25 },
      { t0: 7.75, t1: 10.35, l1: "다섯 명이 한 팀.", l2: "공격은 스파이크 설치, 수비는 해제.", l2at: 8.75 },
      { t0: 18.5, t1: 20.35, l1: "클릭 네 번이면 라운드 안.", l2: "", l2at: 18.5 },
      { t0: 20.5, t1: 22.35, l1: "클릭 네 번에 스파이크까지.", l2: "수비는 45초 안에 해제해야 한다.", l2at: 21.25 },
      { t0: 23.0, t1: 26.85, l1: "혼자 하면 빈자리는 AI가.", l2: "친구는 초대 링크로 합류.", l2at: 24.5 },
      { t0: 27.75, t1: 30.0, l1: "설치 바가 아니라, 주소창.", l2: "13fps.vercel.app에서 지금 한 판.", l2at: 28.5 },
    ],
    // The click counter replaces the copy while the path is walked.
    counter: { t0: 11.5, t1: 18.5, kicker: "클릭" },

    url: "13fps.vercel.app",

    // Named moves: [start, duration]. Every tween in film.html reads one of these.
    moves: {
      barIn: [0, 0.5],
      barToField: [3.0, 0.5],
      type: [3.5, 0.5],
      enter: [4.0, 0.5],
      winOpen: [4.25, 0.75],
      winPark: [7.0, 0.5],
      atkIn: [7.5, 0.5],
      defIn: [8.0, 0.5],
      siteIn: [8.5, 0.5],
      spikeIn: [9.0, 0.25],
      spikeGo: [9.25, 0.5],
      sitePulse: [9.75, 0.75],
      toStrip: [10.5, 0.5],
      winMain: [10.5, 0.5],
      cursorIn: [10.75, 0.25],
      cursorOut: [17.75, 0.25],
      toHud: [19.0, 0.6], // stagger 0.02 s per marker
      hudFade: [19.85, 0.25],
      spikeToScreen: [20.5, 0.5],
      spikeLand: [21.0, 0.25],
      winOut: [22.5, 0.5],
      barToPill: [22.5, 0.5],
      backToRow: [22.75, 0.5],
      labelsIn: [23.25, 0.25],
      chip: [24.0, 0.5],
      flips: [24.5, 0.25], // one per 0.25 s for the four teammates
      clear: [27.0, 0.5],
      barHome: [27.0, 0.5],
      fillHome: [27.25, 0.5],
      logoIn: [27.5, 0.5],
    },
    // The install bar crawls in steps on the beat: [t, fill].
    crawl: [[0.5, 0.04], [1.0, 0.07], [1.5, 0.09], [2.0, 0.12], [2.5, 0.135]],
    teamLabels: { atk: "공격", def: "수비" },
    soloNames: ["나", "AI", "AI", "AI", "AI", "AI", "AI", "AI", "AI", "AI"],
    friendName: "친구",
    chipText: "초대 링크",

    // Sound. motif = the game's own two-note kill sound (‘ta-DAN’, A major pentatonic
    // ladder from A4, js/legacy/61-kills-…js); it climbs each time the idea returns.
    cues: [
      { t: 0, type: "ticks", until: 3 },
      { t: 0, type: "drone", until: 4.5 },
      { t: 4.0, type: "motif", step: 1, why: "the link opens the game" },
      { t: 4.0, type: "bed", until: 30 },
      { t: 9.75, type: "thud", why: "spike planted in the model" },
      { t: 11.5, type: "click" },
      { t: 13.5, type: "click" },
      { t: 15.5, type: "click" },
      { t: 17.5, type: "click" },
      { t: 21.0, type: "plant", why: "spike planted in the real round" },
      { t: 24.5, type: "motif", step: 3, why: "friends join by the link" },
      { t: 24.75, type: "pop" },
      { t: 25.0, type: "pop" },
      { t: 25.25, type: "pop" },
      { t: 28.0, type: "motif", step: 6, bell: true, why: "the bar was the address bar" },
    ],

    // A still at every beat that carries meaning (contact sheet, legibility checks).
    beats: [
      { t: 1.5, id: "S1 설치 바" },
      { t: 3.9, id: "S2 주소 입력" },
      { t: 4.9, id: "S2 탭이 열림" },
      { t: 6.6, id: "S2 제품 문구" },
      { t: 8.4, id: "S2 5대5" },
      { t: 10.0, id: "S2 스파이크 설치" },
      { t: 11.6, id: "S3 클릭 1" },
      { t: 13.6, id: "S3 클릭 2" },
      { t: 15.6, id: "S3 클릭 3" },
      { t: 18.1, id: "S3 클릭 4" },
      { t: 19.5, id: "S3 열 명 = HUD" },
      { t: 21.9, id: "S3 설치 완료" },
      { t: 23.9, id: "S4 빈자리는 AI" },
      { t: 26.2, id: "S4 친구 합류" },
      { t: 29.4, id: "S5 주소창" },
    ],
  };
  if (typeof module !== "undefined" && module.exports) module.exports = TIMELINE;
  else root.TIMELINE = TIMELINE;
})(typeof window !== "undefined" ? window : globalThis);
