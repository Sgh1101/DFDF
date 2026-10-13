
(() => {
  // Ten more agents. Each kit takes four of the existing abilities (by
  // type, so behaviour, bots, motions and network replay all work as they
  // do today) and gives them a new name; the description is the original,
  // so it always says what the ability really does.
  const SRC = {};
  for (const a of AGENTS) for (const ab of a.abilities) SRC[ab.type] = ab;
  const kit = (list) =>
    list.map(([type, name], i) => {
      const s = SRC[type];
      if (!s) throw new Error("ability type missing: " + type);
      return Object.assign({}, s, { key: "QECX"[i], name });
    });
  const NEW = [
    {
      id: "cheongram",
      name: "청람",
      role: "감시자",
      color: "#26a69a",
      accent: "#a7ffeb",
      quote: "한 발짝도 그냥 지나가게 두지 않는다.",
      desc: "얼음과 그물로 통로를 묶어 두는 수비형. 들키지 않고는 사이트에 들어올 수 없다.",
      abilities: kit([["trap_slow", "서릿발"], ["sound_sensor", "청음석"], ["mag_net", "얼음 그물"], ["ult_ice", "만년설"]]),
      look: { skin: 0xd6b49a, hair: 0x0e2a2a, coat: 0x14403c, trim: 0x26a69a },
    },
    {
      id: "jeogwol",
      name: "적월",
      role: "타격대",
      color: "#e53935",
      accent: "#ff8a80",
      quote: "달이 붉으면 아무도 살아 나가지 못한다.",
      desc: "먼저 뛰어들어 피를 빼앗고 버티는 돌격형. 쓰러져도 한 번은 일어선다.",
      abilities: kit([["blood_drain", "흡혈 일섬"], ["dash", "월영 보법"], ["flash", "붉은 달빛"], ["ult_undying", "혈월"]]),
      look: { skin: 0xe2bfa3, hair: 0x1a0606, coat: 0x3a0c10, trim: 0xe53935 },
    },
    {
      id: "sahyeon",
      name: "사현",
      role: "척후대",
      color: "#8d6e63",
      accent: "#d7ccc8",
      quote: "숨은 곳은 이미 다 알고 있다.",
      desc: "화살과 벌떼로 적을 찾아내고 몰아내는 사냥꾼.",
      abilities: kit([["recon_dart", "추적 화살"], ["hunt_bee", "사냥벌"], ["sensor", "덫 감지기"], ["ult_queen", "벌떼 사냥"]]),
      look: { skin: 0xc89c7c, hair: 0x2b1d14, coat: 0x4e3a2e, trim: 0xd7ccc8 },
    },
    {
      id: "unhae",
      name: "운해",
      role: "전략가",
      color: "#90a4ae",
      accent: "#eceff1",
      quote: "구름이 걷히면 이미 끝나 있다.",
      desc: "연막과 모래벽으로 전장을 나누고, 한 번에 적을 묻어 버린다.",
      abilities: kit([["smoke", "운무"], ["sand_wall", "구름 성벽"], ["quicksand", "늪 구름"], ["ult_tomb", "운해 매장"]]),
      look: { skin: 0xdcc0a6, hair: 0xb0bec5, coat: 0x37474f, trim: 0x90a4ae },
    },
    {
      id: "jinroe",
      name: "진뢰",
      role: "타격대",
      color: "#fdd835",
      accent: "#fff59d",
      quote: "천둥은 두 번 경고하지 않는다.",
      desc: "번개처럼 뛰어올라 수류탄과 전기 구체로 자리를 터뜨리는 돌파형.",
      abilities: kit([["bolt_jump", "뇌격 도약"], ["nade", "천둥탄"], ["static_orb", "뇌전 구체"], ["ult_smash", "낙뢰 강타"]]),
      look: { skin: 0xd8b088, hair: 0x2a2a10, coat: 0x2e2a10, trim: 0xfdd835 },
    },
    {
      id: "mukhyang",
      name: "묵향",
      role: "전략가",
      color: "#6d4c41",
      accent: "#bcaaa4",
      quote: "먹물이 번지면 기계도 눈을 감는다.",
      desc: "먹빛 연막과 진흙으로 길을 막고, 상대의 능력을 꺼 버리는 교란형.",
      abilities: kit([["sand_smoke", "먹구름"], ["emp", "묵인"], ["root", "진흙 손"], ["ult_emp", "먹물 폭풍"]]),
      look: { skin: 0xcaa88a, hair: 0x0c0806, coat: 0x2a1d18, trim: 0xbcaaa4 },
    },
    {
      id: "seohwi",
      name: "서휘",
      role: "감시자",
      color: "#7e57c2",
      accent: "#d1c4e9",
      quote: "선을 넘는 순간 나는 이미 보고 있다.",
      desc: "인계철선과 자석 포탑으로 사이트를 지키는 기술자.",
      abilities: kit([["tripwire", "보랏빛 철선"], ["mag_turret", "자기 포탑"], ["ripple_dome", "파문 결계"], ["ult_polarity", "극성 반전"]]),
      look: { skin: 0xe0c2a8, hair: 0x221438, coat: 0x2a1f44, trim: 0x7e57c2 },
    },
    {
      id: "haerang",
      name: "해랑",
      role: "척후대",
      color: "#29b6f6",
      accent: "#b3e5fc",
      quote: "파도는 어디로든 들어온다.",
      desc: "파동으로 적을 흔들고 순간이동으로 빈틈을 파고드는 기동형.",
      abilities: kit([["rift_wave", "너울"], ["scout_swarm", "물새 정찰"], ["blink", "물길"], ["ult_mirror", "신기루 파도"]]),
      look: { skin: 0xd8b494, hair: 0x0a2236, coat: 0x0d2f45, trim: 0x29b6f6 },
    },
    {
      id: "danbi",
      name: "단비",
      role: "전략가",
      color: "#66bb6a",
      accent: "#c8e6c9",
      quote: "가뭄 끝에 오는 비처럼.",
      desc: "아군을 치료하고 드론으로 길을 살피며, 종소리로 모두를 멈춰 세우는 지원형.",
      abilities: kit([["heal", "단비"], ["drone", "잠자리 드론"], ["mirror_pulse", "물결 맥동"], ["ult_bell", "산사의 종"]]),
      look: { skin: 0xe4c6aa, hair: 0x1b3a1d, coat: 0x1f3a22, trim: 0x66bb6a },
    },
    {
      id: "hongyeom",
      name: "홍염",
      role: "타격대",
      color: "#ff7043",
      accent: "#ffccbc",
      quote: "불꽃은 멈추는 법을 모른다.",
      desc: "화염탄과 돌진으로 밀고 들어가 지뢰로 뒤를 막는 공격수. 마지막엔 하늘에서 벼락을 부른다.",
      abilities: kit([["proj_fire", "홍염탄"], ["charge", "불기둥 돌진"], ["mine", "불씨 지뢰"], ["ult_lightning", "천화"]]),
      look: { skin: 0xd9ad8c, hair: 0x3a0e04, coat: 0x40160a, trim: 0xff7043 },
    },
  ];
  for (const a of NEW) {
    if (AGENTS.some((x) => x.id === a.id)) continue;
    const look = a.look;
    delete a.look;
    a.key = a.id;
    AGENTS.push(a);
    try {
      CH_STYLE[a.id] = Object.assign({}, CH_STYLE._default, { w: 1, bulk: 1, eye: 0x222222 }, look);
    } catch (e) {}
  }
  window.AGENT_COUNT = AGENTS.length;
  // the title roster and the solo picker were drawn before these existed
  try {
    const tr = document.getElementById("title-roster");
    if (tr && tr.childElementCount && tr.childElementCount < AGENTS.length)
      for (let i = tr.childElementCount; i < AGENTS.length; i++) {
        const t = AGENTS[i],
          c = tr.firstElementChild.cloneNode(!0);
        c.style.setProperty("--ac", t.color);
        c.style.animationDelay = 45 * i + "ms";
        c.title = t.name + " · " + t.role;
        const img = c.querySelector("img");
        img && (img.src = agentPortrait(t, 120, 150));
        c.querySelectorAll("b,span,em").forEach((e) => /[가-힣]/.test(e.textContent) && e.textContent.length <= 4 && (e.textContent = t.name));
        tr.appendChild(c);
      }
  } catch (e) {}
  try {
    typeof renderSelect == "function" && renderSelect();
  } catch (e) {}
})();
