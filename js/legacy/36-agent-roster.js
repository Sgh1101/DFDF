
(() => {
  // Thirty-six more agents (60 in all). Same recipe as the last ten: each kit
  // is four existing abilities by type (so bots, motions and multiplayer all
  // know them) with new names; the description stays the original so it says
  // what the ability really does. Looks: clothing colours from the agent's
  // colour, and one signature piece (hood, hat, visor, horns...) on the model
  // and on the portrait.
  if (AGENTS.length >= 60) return;
  const SRC = {};
  for (const a of AGENTS) for (const ab of a.abilities) SRC[ab.type] || (SRC[ab.type] = ab);
  // id, name, role, colour, piece, [Q, E, C, X types], [names], quote, desc
  const D = [
    ["baram", "바람", "타격대", "#4dd0e1", "headband", ["dash", "flash", "static_orb", "ult_lightning"], ["질풍", "눈보라 섬광", "회오리 구체", "폭풍우"], "바람보다 먼저 닿는다.", "누구보다 빨리 뛰어들어 시야를 뺏고 흔드는 돌격수."],
    ["cheolhyeol", "철혈", "타격대", "#b71c1c", "pads", ["charge", "shield", "blood_drain", "ult_undying"], ["철혈 돌진", "강철 방패", "피의 일격", "불사신"], "쓰러지는 건 내가 아니다.", "방패를 들고 밀고 들어가 피를 빼앗아 버티는 탱커형 돌격수."],
    ["yeomhwa", "염화", "타격대", "#ff6d00", "flame", ["proj_fire", "wall_fire", "dash", "ult_fire"], ["염화구", "불의 장막", "불꽃 걸음", "대화재"], "타오르는 곳이 곧 전장이다.", "불길로 길을 끊고 뛰어드는 화염 돌격수."],
    ["seomgwang", "섬광", "타격대", "#fff176", "visor", ["flash", "blink", "nade", "ult_smash"], ["눈부심", "빛살 이동", "섬광탄", "낙광 강타"], "눈을 뜨면 이미 끝나 있다.", "섬광과 순간이동으로 각을 여는 기습형."],
    ["pokpung", "폭풍", "타격대", "#5c6bc0", "spikes", ["bolt_jump", "static_orb", "charge", "ult_lightning"], ["폭풍 도약", "뇌운", "돌풍 돌격", "천벌"], "폭풍은 경고하지 않는다.", "공중으로 뛰어올라 번개로 자리를 터뜨리는 돌파형."],
    ["hyeollang", "혈랑", "타격대", "#880e4f", "ears", ["blood_eye", "blood_drain", "dash", "ult_undying"], ["사냥꾼의 눈", "송곳니", "늑대 걸음", "혈월의 늑대"], "피 냄새는 숨길 수 없다.", "적을 표시하고 물어뜯으며 끝까지 버티는 사냥꾼."],
    ["hwasan", "화산", "타격대", "#d84315", "horns", ["nade", "smoke_fire", "wall_fire", "ult_smash"], ["용암탄", "화산재", "용암벽", "분화"], "땅 밑은 늘 끓고 있다.", "폭발과 화염으로 자리를 통째로 지우는 파괴형."],
    ["kallal", "칼날", "타격대", "#cfd8dc", "mask", ["blink", "blood_orb", "flash", "ult_fire"], ["그림자 베기", "피의 구체", "칼빛", "칼날 폭풍"], "한 번이면 충분하다.", "순간이동으로 파고들어 끝내는 암살자."],
    ["cheondung", "천둥", "타격대", "#ffeb3b", "spikes", ["bolt_jump", "nade", "shield", "ult_lightning"], ["천둥 도약", "벼락탄", "번개 방패", "만뢰"], "하늘이 내 편이다.", "방패와 수류탄을 함께 쓰는 정면 돌파형."],
    ["binggyeol", "빙결", "감시자", "#81d4fa", "hood", ["trap_slow", "wall_ice", "sound_sensor", "ult_ice"], ["살얼음", "서리 장벽", "얼음 귀", "절대 영도"], "얼어붙은 길은 되돌아갈 수 없다.", "얼음으로 길을 막고 발소리로 적을 찾는 수비수."],
    ["cheolbyeok", "철벽", "감시자", "#78909c", "pads", ["mag_turret", "shield", "tripwire", "ult_polarity"], ["철벽 포탑", "방호벽", "경계선", "자기 폭풍"], "여기서부터는 못 지나간다.", "포탑과 방패로 사이트를 틀어막는 요새형."],
    ["maenun", "매눈", "감시자", "#a1887f", "hat", ["pierce", "sensor", "tripwire", "ult_snipe"], ["관통 화살", "매의 눈", "올가미", "천리안 사격"], "멀수록 잘 보인다.", "멀리서 적을 찾아 꿰뚫는 저격형 수비수."],
    ["eunjong", "은종", "감시자", "#b0bec5", "halo", ["sound_sensor", "ripple_dome", "trap_slow", "ult_bell"], ["은방울", "은빛 결계", "멈춤 덫", "은종의 울림"], "종이 울리면 모두 멈춘다.", "소리와 결계로 적을 묶는 수비수."],
    ["jaseok", "자석", "감시자", "#9575cd", "goggles", ["mag_net", "mag_anchor", "mag_turret", "ult_polarity"], ["자기 그물", "자력 닻", "자석 포탑", "극성 역전"], "끌어당길지 밀어낼지는 내가 정한다.", "자력 장치로 적의 움직임을 뒤흔드는 기술자."],
    ["seori", "서리", "감시자", "#e1f5fe", "scarf", ["smoke_ice", "trap_slow", "pierce", "ult_ice"], ["서리 안개", "얼음 덫", "고드름 화살", "빙하기"], "차가운 쪽이 오래 버틴다.", "냉기와 고드름으로 진입로를 얼리는 수비수."],
    ["pasu", "파수", "감시자", "#607d8b", "helmet", ["tripwire", "sensor", "wall_ice", "ult_snipe"], ["경보선", "감시 장치", "방어벽", "정조준"], "내 눈을 피해 갈 길은 없다.", "경보와 감시로 뒤를 지키는 파수꾼."],
    ["geomi", "거미", "감시자", "#4e342e", "mask", ["tripwire", "mag_net", "sound_sensor", "ult_bell"], ["거미줄", "끈끈이 그물", "떨림 감지", "거미 여왕의 노래"], "걸리면 끝이다.", "덫과 그물을 겹겹이 깔아 두는 매복형."],
    ["suho", "수호", "감시자", "#43a047", "halo", ["shield", "ripple_dome", "mag_anchor", "ult_polarity"], ["수호 방패", "보호막", "닻", "수호의 장"], "등 뒤는 내가 지킨다.", "방패와 결계로 아군을 지키는 수호자."],
    ["songgol", "송골", "척후대", "#8d6e63", "hat", ["recon_dart", "scout_swarm", "flash", "ult_recon"], ["매 화살", "정찰 매", "번쩍임", "하늘의 눈"], "하늘에서 보면 숨을 곳이 없다.", "화살과 매로 적을 찾아내는 정찰병."],
    ["yeongwol", "영월", "척후대", "#6a1b9a", "hood", ["decoy", "blink", "mirror_pulse", "ult_mirror"], ["달그림자", "월영", "거울 파동", "만월의 환영"], "네가 쫓는 건 그림자다.", "분신과 거울로 적을 속이는 기만형."],
    ["yangbong", "양봉", "척후대", "#f9a825", "hat", ["hunt_bee", "hive_trap", "scout_swarm", "ult_queen"], ["일벌", "벌집 덫", "벌떼 정찰", "꿀벌 군단"], "한 마리가 보면 모두가 본다.", "벌떼로 적을 찾고 몰아내는 사육사."],
    ["padong", "파동", "척후대", "#00acc1", "goggles", ["rift_wave", "sensor", "flash", "ult_mirror"], ["파동", "음파 탐지", "충격 섬광", "공명"], "흔들리면 보인다.", "파동으로 적을 흔들고 위치를 드러내는 탐지형."],
    ["chujeok", "추적", "척후대", "#5d4037", "ears", ["recon_dart", "dash", "hunt_bee", "ult_recon"], ["추적탄", "질주", "추적벌", "끝없는 추적"], "발자국은 거짓말을 하지 않는다.", "흔적을 쫓아 끝까지 따라붙는 추적자."],
    ["hwanyeong", "환영", "척후대", "#ce93d8", "mask", ["decoy", "mirror_pulse", "rift_wave", "ult_mirror"], ["환영", "거울 맥동", "일렁임", "환영의 숲"], "어느 쪽이 진짜일까.", "환영을 흩뿌려 적의 판단을 흐리는 마술사."],
    ["byeolbit", "별빛", "척후대", "#7986cb", "halo", ["recon_dart", "flash", "blink", "ult_recon"], ["별똥별", "별빛 섬광", "은하 이동", "별자리"], "밤하늘은 모든 걸 비춘다.", "별빛으로 적을 비추고 순간이동하는 정찰병."],
    ["kkulbeol", "꿀벌", "척후대", "#ffca28", "ears", ["hive_trap", "hunt_bee", "decoy", "ult_queen"], ["꿀 함정", "침", "가짜 벌집", "여왕의 행진"], "달콤한 건 늘 함정이다.", "벌집 덫과 미끼로 적을 끌어들이는 함정꾼."],
    ["ullim", "울림", "척후대", "#4db6ac", "headband", ["sensor", "rift_wave", "scout_swarm", "ult_recon"], ["메아리", "울림파", "박쥐 떼", "온 땅의 울림"], "소리는 벽을 넘는다.", "메아리로 벽 너머까지 듣는 탐지형."],
    ["angae", "안개", "전략가", "#b0bec5", "hood", ["smoke", "quicksand", "heal", "ult_tomb"], ["짙은 안개", "늪안개", "이슬", "안개 무덤"], "보이지 않으면 싸울 수 없다.", "안개로 시야를 덮고 아군을 돌보는 지휘관."],
    ["morae", "모래", "전략가", "#d7ccc8", "scarf", ["sand_smoke", "sand_wall", "quicksand", "ult_tomb"], ["모래 폭풍", "사구 벽", "개미지옥", "사막의 무덤"], "모래는 모든 걸 삼킨다.", "모래로 길을 나누고 적을 가라앉히는 전략가."],
    ["yakcho", "약초", "전략가", "#81c784", "hat", ["heal", "smoke", "root", "ult_res"], ["약초 처방", "쑥 연기", "덩굴 손", "되살림"], "아픈 곳은 내가 안다.", "치료와 연막으로 팀을 살리는 의원."],
    ["hoero", "회로", "전략가", "#ffd740", "goggles", ["emp", "drone", "mine", "ult_emp"], ["합선", "정찰 드론", "지뢰 회로", "전면 정전"], "전선 하나면 충분해.", "드론과 전자파로 적의 능력을 끄는 기술자."],
    ["deonggul", "덩굴", "전략가", "#558b2f", "horns", ["root", "sand_wall", "smoke", "ult_res"], ["옭아매기", "가시 담장", "포자 구름", "새싹"], "뿌리는 깊을수록 질기다.", "덩굴로 적을 묶고 벽을 세우는 정원사."],
    ["jeongjeon", "정전", "전략가", "#546e7a", "visor", ["emp", "sand_smoke", "drone", "ult_emp"], ["차단기", "검은 연기", "정전 드론", "대정전"], "불이 꺼지면 내 차례다.", "전력을 끊고 연막을 깔아 적을 눈멀게 하는 교란형."],
    ["yeonkkot", "연꽃", "전략가", "#f48fb1", "halo", ["heal", "mirror_pulse", "smoke", "ult_bell"], ["연꽃 이슬", "꽃잎 물결", "꽃가루 연막", "연못의 종"], "흙탕물에서도 꽃은 핀다.", "치유와 종소리로 전장을 다스리는 지원형."],
    ["neupji", "늪지", "전략가", "#33691e", "hood", ["quicksand", "root", "mine", "ult_tomb"], ["늪", "갈대 손", "늪 가스", "늪의 무덤"], "한 발 들이면 못 빠져나간다.", "늪과 덩굴로 길목을 묶는 매복형 전략가."],
    ["deungbul", "등불", "전략가", "#ffb74d", "lantern", ["smoke", "heal", "drone", "ult_res"], ["등불 연기", "따뜻한 불빛", "반딧불 드론", "다시 켜진 불"], "어둠 속에서도 길은 있다.", "등불로 길을 밝히고 쓰러진 아군을 일으키는 안내자."],
  ];
  const col = (h) => new T.Color(h);
  const hex = (c) => c.getHex();
  const dark = (h, k) => hex(col(h).lerp(new T.Color(0x0a0d12), k));
  const SKINS = [0xe2bfa3, 0xd8b088, 0xc89c7c, 0xdcc0a6, 0xe4c6aa, 0xd9ad8c, 0xcaa88a, 0xb88a6a];
  const HAIRS = [0x1a1210, 0x2b1d14, 0x0c0806, 0x3a2a1a, 0x6d4c41, 0xd7ccc8, 0x263238, 0x4a1010];
  const geo = (n, f) => chGeo("ax60_" + n, f);
  const cone = (r, h, s = 12) => geo(`cone${r}_${h}_${s}`, () => new T.ConeGeometry(r, h, s));
  // signature pieces on the model
  const PIECE = {
    hood: ({ add, neck }, c, a) => add(neck, G_HSPH(0.16, 0.62), chMat(dark(c, 0.55), "cloth"), 0, 0.22, 0.01, { s: [1.05, 1.15, 1.1], sh: 1 }),
    hat: ({ add, neck }, c) => {
      const m = chMat(dark(c, 0.45), "leather");
      add(neck, G_CYL(0.28, 0.28, 0.02, 22), m, 0, 0.31, 0, { sh: 1 });
      add(neck, G_CYL(0.12, 0.14, 0.12, 16), m, 0, 0.38, 0, { sh: 1 });
    },
    visor: ({ add, neck }, c) => add(neck, G_BOX(0.22, 0.045, 0.05), chGlow(hex(col(c)), 1.6), 0, 0.26, -0.105),
    goggles: ({ add, neck }, c) => {
      const g = chGlow(hex(col(c)), 1.3);
      [-1, 1].forEach((s) => add(neck, G_CYL(0.035, 0.035, 0.03, 12), g, s * 0.055, 0.27, -0.11, { r: [Math.PI / 2, 0, 0] }));
      add(neck, G_TOR(0.125, 0.012, 4, 20), chMat(0x222222, "rubber"), 0, 0.27, 0, { r: [Math.PI / 2 - 0.1, 0, 0] });
    },
    headband: ({ add, neck }, c) => {
      const b = chMat(hex(col(c)), "cloth");
      add(neck, G_TOR(0.125, 0.018, 6, 20), b, 0, 0.3, 0, { r: [Math.PI / 2 - 0.12, 0, 0] });
      add(neck, G_BOX(0.03, 0.18, 0.01), b, 0.04, 0.22, 0.15, { r: [0.4, 0, 0.2] });
    },
    horns: ({ add, neck }, c) => [-1, 1].forEach((s) => add(neck, cone(0.03, 0.16, 6), chMat(dark(c, 0.2), "paint"), s * 0.09, 0.4, 0, { r: [0, 0, -s * 0.5] })),
    spikes: ({ add, neck }, c) => {
      const y = chGlow(hex(col(c)), 1.5);
      for (let i = 0; i < 5; i++) add(neck, cone(0.03, 0.15, 6), y, (i - 2) * 0.045, 0.37, 0.01, { r: [0, 0, (i - 2) * -0.35] });
    },
    ears: ({ add, neck }, c) => [-1, 1].forEach((s) => add(neck, cone(0.045, 0.12, 4), chMat(dark(c, 0.35), "fur"), s * 0.1, 0.38, 0.02, { r: [0, 0, -s * 0.25] })),
    mask: ({ add, neck }, c) => add(neck, G_BOX(0.2, 0.07, 0.04), chMat(dark(c, 0.6), "cloth"), 0, 0.19, -0.11),
    halo: ({ add, neck }, c) => add(neck, G_TOR(0.12, 0.012, 4, 24), chGlow(hex(col(c)), 1.6), 0, 0.5, 0, { r: [Math.PI / 2, 0, 0] }),
    scarf: ({ add, chest }, c) => add(chest, G_TOR(0.12, 0.04, 6, 16), chMat(hex(col(c)), "cloth"), 0, 0.42, 0, { r: [Math.PI / 2, 0, 0] }),
    pads: ({ add, chest, S }, c) => [-1, 1].forEach((s) => add(chest, G_SPH(0.1, 10, 8), chMat(dark(c, 0.3), "metal"), s * 0.22 * S.w, 0.36, 0, { s: [1.2, 0.6, 1], sh: 1 })),
    helmet: ({ add, neck }, c) => add(neck, G_HSPH(0.15, 0.55), chMat(dark(c, 0.3), "metal"), 0, 0.25, 0.0, { s: [1.05, 1, 1.1], sh: 1 }),
    flame: ({ add, neck }, c) => {
      const f = chGlow(hex(col(c)), 1.8);
      for (let i = 0; i < 4; i++) add(neck, cone(0.04, 0.18 - i * 0.02, 6), f, 0, 0.38 - i * 0.015, 0.06 * i - 0.06);
    },
    lantern: ({ add, chest }, c) => {
      add(chest, G_CYL(0.05, 0.05, 0.1, 10), chGlow(hex(col(c)), 1.7), -0.16, -0.05, -0.12);
      add(chest, G_CYL(0.055, 0.055, 0.015, 10), chMat(0x3e2723, "metal"), -0.16, 0.01, -0.12);
    },
  };
  // the same piece on the portrait
  const PAINT = {
    hood: (g, W, H, X, Y, R, c) => {
      g.fillStyle = c;
      g.beginPath();
      g.moveTo(X - R * 1.5, Y + R * 2.2);
      g.quadraticCurveTo(X - R * 1.6, Y - R * 1.9, X, Y - R * 1.75);
      g.quadraticCurveTo(X + R * 1.6, Y - R * 1.9, X + R * 1.5, Y + R * 2.2);
      g.lineTo(X + R * 1.05, Y + R * 1.6);
      g.quadraticCurveTo(X + R * 1.15, Y - R * 1.1, X, Y - R * 1.15);
      g.quadraticCurveTo(X - R * 1.15, Y - R * 1.1, X - R * 1.05, Y + R * 1.6);
      g.closePath();
      g.fill();
    },
    hat: (g, W, H, X, Y, R, c) => {
      g.fillStyle = c;
      g.beginPath();
      g.ellipse(X, Y - R * 0.95, R * 2.0, R * 0.3, 0, 0, 7);
      g.fill();
      g.fillRect(X - R * 0.8, Y - R * 1.7, R * 1.6, R * 0.8);
    },
    visor: (g, W, H, X, Y, R, c) => {
      g.fillStyle = c;
      g.shadowColor = c;
      g.shadowBlur = R * 0.7;
      g.fillRect(X - R * 0.95, Y - R * 0.3, R * 1.9, R * 0.32);
      g.shadowBlur = 0;
    },
    goggles: (g, W, H, X, Y, R, c) => {
      g.fillStyle = "#222";
      g.fillRect(X - R * 1.05, Y - R * 0.18, R * 2.1, R * 0.18);
      g.fillStyle = c;
      [-1, 1].forEach((s) => {
        g.beginPath();
        g.arc(X + s * R * 0.4, Y - R * 0.05, R * 0.26, 0, 7);
        g.fill();
      });
    },
    headband: (g, W, H, X, Y, R, c) => {
      g.fillStyle = c;
      g.fillRect(X - R * 1.05, Y - R * 0.75, R * 2.1, R * 0.26);
      g.beginPath();
      g.moveTo(X + R * 1.0, Y - R * 0.7);
      g.lineTo(X + R * 1.9, Y - R * 0.2);
      g.lineTo(X + R * 1.7, Y + R * 0.05);
      g.lineTo(X + R * 1.0, Y - R * 0.45);
      g.fill();
    },
    horns: (g, W, H, X, Y, R, c) => {
      g.fillStyle = c;
      [-1, 1].forEach((s) => {
        g.beginPath();
        g.moveTo(X + s * R * 0.55, Y - R * 0.9);
        g.lineTo(X + s * R * 1.05, Y - R * 2.0);
        g.lineTo(X + s * R * 0.85, Y - R * 0.8);
        g.fill();
      });
    },
    spikes: (g, W, H, X, Y, R, c) => {
      g.fillStyle = c;
      g.shadowColor = c;
      g.shadowBlur = R * 0.6;
      for (let i = -2; i <= 2; i++) {
        g.beginPath();
        g.moveTo(X + i * R * 0.42 - R * 0.22, Y - R * 0.75);
        g.lineTo(X + i * R * 0.62, Y - R * 1.9 + Math.abs(i) * R * 0.25);
        g.lineTo(X + i * R * 0.42 + R * 0.22, Y - R * 0.75);
        g.fill();
      }
      g.shadowBlur = 0;
    },
    ears: (g, W, H, X, Y, R, c) => {
      g.fillStyle = c;
      [-1, 1].forEach((s) => {
        g.beginPath();
        g.moveTo(X + s * R * 0.45, Y - R * 0.95);
        g.lineTo(X + s * R * 0.95, Y - R * 1.85);
        g.lineTo(X + s * R * 1.05, Y - R * 0.7);
        g.fill();
      });
    },
    mask: (g, W, H, X, Y, R, c) => {
      g.fillStyle = c;
      g.fillRect(X - R * 0.95, Y + R * 0.15, R * 1.9, R * 0.75);
    },
    halo: (g, W, H, X, Y, R, c) => {
      g.strokeStyle = c;
      g.shadowColor = c;
      g.shadowBlur = R * 0.7;
      g.lineWidth = R * 0.14;
      g.beginPath();
      g.ellipse(X, Y - R * 1.6, R * 0.95, R * 0.25, 0, 0, 7);
      g.stroke();
      g.shadowBlur = 0;
    },
    scarf: (g, W, H, X, Y, R, c) => {
      g.fillStyle = c;
      g.fillRect(X - R * 1.3, Y + R * 1.45, R * 2.6, R * 0.45);
      g.fillRect(X + R * 0.6, Y + R * 1.6, R * 0.4, R * 1.1);
    },
    pads: (g, W, H, X, Y, R, c) => {
      g.fillStyle = c;
      [-1, 1].forEach((s) => {
        g.beginPath();
        g.ellipse(X + s * R * 1.7, Y + R * 2.2, R * 0.75, R * 0.45, 0, 0, 7);
        g.fill();
      });
    },
    helmet: (g, W, H, X, Y, R, c) => {
      g.fillStyle = c;
      g.beginPath();
      g.ellipse(X, Y - R * 0.5, R * 1.15, R * 0.95, 0, Math.PI, 0);
      g.fill();
    },
    flame: (g, W, H, X, Y, R, c) => {
      g.shadowColor = c;
      g.shadowBlur = R * 0.8;
      g.fillStyle = c;
      g.beginPath();
      g.moveTo(X - R * 0.45, Y - R * 0.7);
      g.quadraticCurveTo(X - R * 0.5, Y - R * 1.8, X, Y - R * 2.4);
      g.quadraticCurveTo(X + R * 0.6, Y - R * 1.2, X + R * 0.45, Y - R * 0.7);
      g.fill();
      g.shadowBlur = 0;
    },
    lantern: (g, W, H, X, Y, R, c) => {
      g.fillStyle = c;
      g.shadowColor = c;
      g.shadowBlur = R;
      g.beginPath();
      g.arc(X - R * 1.6, Y + R * 2.4, R * 0.35, 0, 7);
      g.fill();
      g.shadowBlur = 0;
    },
  };
  const face = (g, X, Y, R, eye) => {
    g.fillStyle = "#1b1b1f";
    [-1, 1].forEach((s) => {
      g.beginPath();
      g.ellipse(X + s * R * 0.38, Y, R * 0.13, R * 0.09, 0, 0, 7);
      g.fill();
    });
    g.fillStyle = eye;
    [-1, 1].forEach((s) => {
      g.beginPath();
      g.arc(X + s * R * 0.38 + R * 0.03, Y - R * 0.01, R * 0.045, 0, 7);
      g.fill();
    });
    g.strokeStyle = "rgba(90,40,40,.7)";
    g.lineWidth = R * 0.05;
    g.beginPath();
    g.moveTo(X - R * 0.18, Y + R * 0.5);
    g.quadraticCurveTo(X, Y + R * 0.56, X + R * 0.18, Y + R * 0.5);
    g.stroke();
  };

  const mine = {};
  D.forEach(([id, name, role, color, piece, types, names, quote, desc], i) => {
    if (AGENTS.some((x) => x.id === id)) return;
    const abilities = types.map((t, k) => {
      const s = SRC[t];
      if (!s) throw new Error("ability type missing: " + t);
      return Object.assign({}, s, { key: "QECX"[k], name: names[k] });
    });
    const accent = "#" + col(color).lerp(new T.Color(0xffffff), 0.55).getHexString();
    AGENTS.push({ id, key: id, name, role, color, accent, quote, desc, abilities });
    const skin = SKINS[i % SKINS.length],
      hair = HAIRS[(i * 3) % HAIRS.length];
    try {
      CH_STYLE[id] = Object.assign({}, CH_STYLE._default, { w: 1, bulk: 1, eye: 0x222222, skin, hair, coat: dark(color, 0.7), trim: hex(col(color)) });
    } catch (e) {}
    try {
      CH_BASE_EXTRA[id] = {
        top: dark(color, 0.72),
        sleeve: [dark(color, 0.6), "cloth"],
        fore: [dark(color, 0.66), "cloth"],
        hand: [dark(color, 0.85), "leather"],
        pants: dark(color, 0.8),
        boot: [dark(color, 0.88), "leather"],
      };
    } catch (e) {}
    CH_OUTFIT[id] = (e) => PIECE[piece](e, color);
    mine[id] = { piece, color };
  });
  window.AGENT_COUNT = AGENTS.length;

  const _ap = agentPortrait;
  agentPortrait = function (ag, w, h) {
    const id = ag && (ag.id || ag.key),
      m = mine[id];
    if (!m) return _ap.apply(this, arguments);
    const key = id + "_" + (w || 300) + "_" + (h || 380) + "_x60";
    if (PORTRAIT_CACHE[key]) return PORTRAIT_CACHE[key];
    let cv = null;
    const ce = document.createElement;
    document.createElement = function (t) {
      const el = ce.apply(document, arguments);
      "canvas" === String(t).toLowerCase() && !cv && (cv = el);
      return el;
    };
    let url;
    try {
      url = _ap.apply(this, arguments);
    } finally {
      document.createElement = ce;
    }
    if (!cv) return url;
    const g = cv.getContext("2d"),
      W = cv.width,
      H = cv.height,
      X = W * 0.5,
      Y = H * 0.37,
      R = W * 0.12;
    try {
      face(g, X, Y, R, ag.accent || "#ddd");
      PAINT[m.piece](g, W, H, X, Y, R, "#" + col(m.color).getHexString());
      url = cv.toDataURL();
    } catch (e) {}
    return (PORTRAIT_CACHE[key] = url);
  };
  // the title roster and the solo picker were drawn before these existed
  try {
    const tr = document.getElementById("title-roster");
    if (tr && tr.childElementCount && tr.childElementCount < AGENTS.length)
      for (let i = tr.childElementCount; i < AGENTS.length; i++) {
        const t = AGENTS[i],
          c = tr.firstElementChild.cloneNode(!0);
        c.style.setProperty("--ac", t.color);
        c.style.animationDelay = 20 * i + "ms";
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
  // sixty faces on the title screen: smaller chips, three rows
  const st = document.createElement("style");
  st.textContent = ".title-roster{gap:4px!important;max-width:min(640px,100%)!important}.title-roster .tr-chip{width:27px!important;height:27px!important;box-shadow:0 0 0 2px rgba(10,13,18,.8)!important}@media (max-width:600px){.title-roster .tr-chip{width:22px!important;height:22px!important}}";
  document.head.appendChild(st);
})();
