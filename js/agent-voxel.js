/* Actual in-game block characters, built from shared cuboids and baked per
 * animated joint. All forty outfits follow the final ability catalogue. */
(() => {
  "use strict";
  if (
    typeof buildFighter !== "function" ||
    typeof CH_OUTFIT === "undefined" ||
    !window.AGENTS
  )
    return;
  const VERSION = 4,
    dark = 0x27303b,
    metal = 0x8898a5,
    cream = 0xe5e2d2;
  const shade = (c, k) => new T.Color(c).multiplyScalar(k).getHex();
  const tint = (a, b, k) => new T.Color(a).lerp(new T.Color(b), k).getHex();
  // id, coat, ability colour, secondary cloth, cut, hair, signature, description
  const DEFINITIONS = [
    [
      "hwaryeong",
      0x3d3440,
      0xf77a42,
      0x9f4935,
      "jacket",
      "spiky",
      "fire",
      "화염 장갑 · 열 카트리지 · 불꽃 문양",
    ],
    [
      "seorin",
      0x4776a1,
      0x9de8fa,
      0xe3eef4,
      "coat",
      "bob",
      "ice",
      "얼음 덫 · 방한 코트 · 서리 결정",
    ],
    [
      "muyeong",
      0x333046,
      0xab86dc,
      0x5c476e,
      "hood",
      "short",
      "shadow",
      "그림자 두건 · 정찰 화살 · 보랏빛 눈",
    ],
    [
      "gangcheol",
      0x677886,
      0xeab268,
      0x394b59,
      "armor",
      "buzz",
      "shield",
      "접힌 방패 · 강철 주먹 · 어깨 장갑",
    ],
    [
      "yeonhwa",
      0x4b8262,
      0xb9e29d,
      0xe2debd,
      "robe",
      "braid",
      "flower",
      "꽃 어깨 · 회복 씨앗 · 비취 겹옷",
    ],
    [
      "noeun",
      0x8a914f,
      0x8ce3c7,
      0x374c45,
      "jacket",
      "bob",
      "radio",
      "전파 배낭 · 감시 드론 수납부 · 수신기",
    ],
    [
      "baekho",
      0xd9e4e6,
      0x8fc4df,
      0x3e5368,
      "cape",
      "short",
      "bow",
      "흰 망토 · 관측 렌즈 · 빛의 활",
    ],
    [
      "noeha",
      0x4c5d92,
      0xb2cdff,
      0x30394f,
      "jacket",
      "spiky",
      "bolt",
      "전도 장갑 · 축전 코일 · 번개 장화",
    ],
    [
      "gyeongyeon",
      0x687e9c,
      0xc8bdf4,
      0xc3cedd,
      "coat",
      "bob",
      "mirror",
      "거울 다섯 조각 · 은빛 코트 · 손등 거울",
    ],
    [
      "heuksa",
      0x655744,
      0xd0b780,
      0x3f3a34,
      "hood",
      "short",
      "sand",
      "모래 두건 · 입자 용기 · 겹친 숄",
    ],
    [
      "myeongjong",
      0x875f4d,
      0xd6b26e,
      0xd6c6a8,
      "robe",
      "topknot",
      "bell",
      "청동 종 · 공명판 · 손목 릴",
    ],
    [
      "jacheol",
      0x527386,
      0x80c8dc,
      0xa18b6b,
      "jacket",
      "short",
      "magnet",
      "ㄷ자 자석 · 자기 닻 · 작업 장갑",
    ],
    [
      "hongyeol",
      0x883d55,
      0xe17893,
      0x362c3d,
      "coat",
      "long",
      "blood",
      "피 채찍 손목 띠 · 진홍 코트 · 혈액 코어",
    ],
    [
      "gunbong",
      0x938047,
      0xf1ce69,
      0x41483b,
      "vest",
      "short",
      "hive",
      "벌집 배낭 · 정찰 벌 표식",
    ],
    [
      "baram",
      0x3e96a1,
      0x9ee5e6,
      0xd7e8e5,
      "jacket",
      "spiky",
      "wind",
      "청록 스카프 · 기류 날개 · 가벼운 장화",
    ],
    [
      "geomi",
      0x3d343b,
      0xeb7779,
      0x8f9da5,
      "suit",
      "short",
      "spider",
      "접힌 거미 다리 네 개 · 손목 거미줄 릴",
    ],
    [
      "byeolbit",
      0x3b446d,
      0xc4ceff,
      0x9097c8,
      "cape",
      "short",
      "star",
      "네모 별 코어 · 궤도 조각 · 별 망토",
    ],
    [
      "kallal",
      0x36414f,
      0xc8d8e0,
      0x687984,
      "suit",
      "ponytail",
      "blades",
      "교차 칼집 · 부메랑 칼날 · 표식 단검",
    ],
    [
      "deonggul",
      0x68864a,
      0xb4cf7a,
      0x79694e,
      "vest",
      "short",
      "vine",
      "잎 어깨 · 손목 덩굴 · 가시 말뚝",
    ],
    [
      "neupji",
      0x536746,
      0xc3e871,
      0x364938,
      "hood",
      "short",
      "toxin",
      "방독면 · 독액 탱크 · 생체 샘플 통",
    ],
    [
      "deungbul",
      0xe1d6b9,
      0xffd783,
      0x8e744a,
      "robe",
      "bob",
      "lantern",
      "사각 등불 · 빛 렌즈 · 따뜻한 겹옷",
    ],
    [
      "hwanyeong",
      0x775483,
      0xd9b1eb,
      0x403353,
      "coat",
      "long",
      "illusion",
      "비대칭 코트 · 분신 결정 · 다섯 투사 눈금",
    ],
    [
      "ullim",
      0x3c6c72,
      0x86ddd3,
      0x344c59,
      "jacket",
      "short",
      "sound",
      "네모 헤드폰 · 공명 스피커",
    ],
    [
      "hwasan",
      0x685047,
      0xfb9766,
      0x3b3437,
      "armor",
      "spiky",
      "lava",
      "현무암 어깨 · 용암 틈 · 분화 배기구",
    ],
    [
      "suho",
      0xb4cac2,
      0xa4e3c2,
      0x4e7e67,
      "armor",
      "short",
      "guard",
      "네 방향 결계판 · 수호 방패 · 녹색 흉장",
    ],
    [
      "hyeollang",
      0x59424d,
      0xe37b94,
      0x9fa2a3,
      "vest",
      "short",
      "wolf",
      "늑대 귀 · 짧은 털 칼라 · 발톱 장갑",
    ],
    [
      "songgol",
      0x8c7155,
      0xdcd5be,
      0x4e5744,
      "vest",
      "short",
      "falcon",
      "매 어깨 장식 · 깃털 화살 · 사냥 장갑",
    ],
    [
      "haerang",
      0x426c9e,
      0x9edff0,
      0xdbebeb,
      "shawl",
      "long",
      "water",
      "물결 숄 · 손목 물대포 · 파도 문양",
    ],
    [
      "mukhyang",
      0xe5ddc9,
      0x34353a,
      0xa95f52,
      "robe",
      "topknot",
      "ink",
      "네모 갓 · 먹 붓 · 붉은 낙관",
    ],
    [
      "yeongwol",
      0x75538c,
      0xddd3ef,
      0x453557,
      "robe",
      "long",
      "moon",
      "초승달 머리핀 · 달빛 띠 · 보라 겹옷",
    ],
    [
      "danbi",
      0x7ba884,
      0xb6dfee,
      0xeee6bc,
      "poncho",
      "bob",
      "rain",
      "방수 모자 · 초록 우비 · 노란 장화",
    ],
    [
      "cheolhyeol",
      0x626c7b,
      0xc8787c,
      0x333b4a,
      "armor",
      "buzz",
      "heavy",
      "중량 어깨 · 충격 피스톤 · 착지 장화",
    ],
    [
      "chujeok",
      0x826c55,
      0xe0ad6d,
      0x4f5a45,
      "coat",
      "short",
      "hound",
      "추적 단말 · 조명탄 · 사냥개 표식",
    ],
    [
      "hoero",
      0x3d4657,
      0xf0d67a,
      0x738b9b,
      "jacket",
      "short",
      "drone",
      "네 칸 드론 도킹부 · 손목 해킹 단말",
    ],
    [
      "yakcho",
      0xe2d9bf,
      0x9acb91,
      0x6f9868,
      "apron",
      "braid",
      "herbs",
      "약초 앞치마 · 세 물약 · 약재 바구니",
    ],
    [
      "cheolbyeok",
      0x647c87,
      0xf1cf70,
      0x3e4c5b,
      "vest",
      "buzz",
      "mortar",
      "공병 모자 · 사각 박격포 · 지뢰",
    ],
    [
      "chochim",
      0x655078,
      0xe1bf76,
      0xded5bf,
      "coat",
      "bob",
      "clock",
      "네모 시계 · 되감기 손목 장치 · 보라 코트",
    ],
    [
      "gwanmun",
      0x48375f,
      0xb396ef,
      0x77639b,
      "hood",
      "short",
      "portal",
      "두 사각 차원문 · 위상 두건 · 문 표식",
    ],
    [
      "hwangya",
      0x9b6e48,
      0xe2ab74,
      0x536e86,
      "vest",
      "short",
      "outlaw",
      "네모 모자 · 붉은 스카프 · 홀스터",
    ],
    [
      "nachim",
      0x3c7581,
      0x90d9cd,
      0xdacead,
      "coat",
      "ponytail",
      "compass",
      "지도통 · 측량 말뚝 · 네모 나침반",
    ],
  ];
  const ICONS = {
    fire: ["010", "111", "111", "010"],
    ice: ["101", "010", "101"],
    shadow: ["110", "011", "110"],
    shield: ["111", "111", "010"],
    flower: ["010", "111", "010"],
    radio: ["101", "010", "010"],
    bow: ["110", "101", "110"],
    bolt: ["011", "110", "011", "010"],
    mirror: ["010", "101", "010"],
    sand: ["111", "010", "111"],
    bell: ["010", "111", "111", "010"],
    magnet: ["101", "101", "111"],
    blood: ["010", "111", "111"],
    hive: ["111", "101", "111"],
    wind: ["110", "011", "110"],
    spider: ["10101", "01110", "00100", "01110"],
    star: ["00100", "01110", "11111", "01110", "00100"],
    blades: ["101", "010", "101"],
    vine: ["100", "110", "010", "011"],
    toxin: ["101", "010", "101"],
    lantern: ["010", "111", "101", "111"],
    illusion: ["101", "111", "101"],
    sound: ["101", "111", "010"],
    lava: ["100", "110", "011", "001"],
    guard: ["111", "101", "111"],
    wolf: ["101", "111", "010"],
    falcon: ["10101", "11111", "01110", "00100"],
    water: ["1010", "0101"],
    ink: ["110", "011", "001"],
    moon: ["011", "110", "110", "011"],
    rain: ["1111", "0110", "1010"],
    heavy: ["101", "111", "101"],
    hound: ["101", "111", "010"],
    drone: ["101", "010", "101"],
    herbs: ["010", "110", "011"],
    mortar: ["010", "010", "111"],
    clock: ["111", "101", "111"],
    portal: ["111", "101", "101", "111"],
    outlaw: ["010", "111", "010"],
    compass: ["010", "101", "010"],
  };
  const CATALOG = Object.create(null);
  function cube(x, parent, color, size, position, rotation) {
    const mesh = x.add(
      parent,
      G_BOX(...size),
      chMat(color, "cloth"),
      ...position,
      rotation ? { r: rotation, sh: 1 } : { sh: 1 },
    );
    mesh.userData.voxel = true;
    x.voxels++;
    return mesh;
  }
  function pixel(x, parent, color, px, py, pz, w = 0.024, h = 0.024) {
    return cube(x, parent, color, [w, h, 0.004], [px, py, pz]);
  }
  function pattern(x, parent, color, rows, center, unit = 0.022) {
    rows.forEach((row, j) =>
      [...row].forEach((p, i) => {
        if (p !== "0")
          pixel(
            x,
            parent,
            color,
            center[0] + (i - (row.length - 1) / 2) * unit,
            center[1] - j * unit,
            center[2],
            unit,
            unit,
          );
      }),
    );
  }
  function frame(x, parent, color, pos, w, h, depth = 0.04, thickness = 0.025) {
    const [px, py, pz] = pos;
    for (const s of [-1, 1]) {
      cube(x, parent, color, [w, thickness, depth], [px, py + (s * h) / 2, pz]);
      cube(x, parent, color, [thickness, h, depth], [px + (s * w) / 2, py, pz]);
    }
  }
  function dial(x, parent, color, pos, size = 0.085) {
    frame(x, parent, color, pos, size, size, 0.016, 0.014);
    cube(
      x,
      parent,
      cream,
      [size * 0.72, size * 0.72, 0.012],
      [pos[0], pos[1], pos[2] - 0.004],
    );
    pixel(
      x,
      parent,
      dark,
      pos[0],
      pos[1] + size * 0.16,
      pos[2] - 0.014,
      0.012,
      size * 0.35,
    );
    pixel(
      x,
      parent,
      dark,
      pos[0] + size * 0.15,
      pos[1],
      pos[2] - 0.015,
      size * 0.3,
      0.012,
    );
  }
  function pack(x, color, w = 0.24, h = 0.28, depth = 0.105) {
    cube(x, x.chest, color, [w, h, depth], [0, 0.2, 0.17 + depth / 2]);
    for (const s of [-1, 1])
      cube(
        x,
        x.chest,
        shade(color, 0.72),
        [0.035, h + 0.04, 0.024],
        [s * w * 0.32, 0.2, 0.155 + depth],
      );
  }
  function vial(x, parent, color, pos) {
    cube(x, parent, color, [0.042, 0.076, 0.042], pos);
    cube(
      x,
      parent,
      cream,
      [0.044, 0.018, 0.044],
      [pos[0], pos[1] + 0.046, pos[2]],
    );
    pixel(
      x,
      parent,
      tint(color, 0xffffff, 0.4),
      pos[0] - 0.01,
      pos[1] + 0.008,
      pos[2] - 0.024,
      0.008,
      0.04,
    );
  }
  function leaf(x, parent, color, pos) {
    cube(x, parent, color, [0.05, 0.09, 0.035], pos);
    cube(x, parent, color, [0.09, 0.04, 0.033], pos);
  }
  function scarf(x, color, long = false) {
    cube(x, x.chest, color, [0.25, 0.065, 0.25], [0, 0.415, 0]);
    cube(
      x,
      x.chest,
      color,
      [0.07, long ? 0.42 : 0.2, 0.025],
      [-0.06, long ? 0.19 : 0.3, 0.15],
    );
    if (long)
      cube(
        x,
        x.chest,
        shade(color, 0.8),
        [0.06, 0.3, 0.025],
        [0.025, 0.25, 0.18],
      );
  }
  function hat(x, color, wide = false) {
    cube(
      x,
      x.neck,
      color,
      [wide ? 0.46 : 0.37, 0.035, wide ? 0.4 : 0.35],
      [0, 0.38, 0],
    );
    cube(x, x.neck, color, [wide ? 0.27 : 0.33, 0.09, 0.28], [0, 0.43, 0.01]);
    cube(
      x,
      x.neck,
      shade(color, 0.68),
      [wide ? 0.28 : 0.34, 0.025, 0.29],
      [0, 0.4, 0.01],
    );
  }
  function hood(x, d, mask) {
    cube(x, x.neck, d.color, [0.38, 0.06, 0.35], [0, 0.37, 0.01]);
    for (const s of [-1, 1])
      cube(x, x.neck, d.color, [0.045, 0.3, 0.34], [s * 0.173, 0.2, 0.01]);
    cube(x, x.neck, d.color, [0.35, 0.32, 0.03], [0, 0.2, 0.175]);
    if (mask)
      cube(x, x.neck, d.under, [0.315, 0.105, 0.018], [0, 0.115, -0.159]);
  }
  function hair(x, d) {
    const c = x.S.hair;
    cube(x, x.neck, c, [0.334, 0.06, 0.315], [0, 0.358, 0.003]);
    for (const s of [-1, 1])
      cube(
        x,
        x.neck,
        c,
        [0.035, d.hair === "buzz" ? 0.07 : 0.15, 0.29],
        [s * 0.156, d.hair === "buzz" ? 0.32 : 0.28, 0.01],
      );
    if (d.hair !== "buzz")
      for (let i = 0; i < 3; i++)
        cube(
          x,
          x.neck,
          c,
          [0.075, 0.04 + (i % 2) * 0.025, 0.026],
          [-0.105 + i * 0.075, 0.312 - (i % 2) * 0.01, -0.154],
        );
    if (d.hair === "spiky")
      for (let i = -1; i <= 1; i++)
        cube(
          x,
          x.neck,
          c,
          [0.08, 0.055 + (1 - Math.abs(i)) * 0.035, 0.14],
          [i * 0.095, 0.4 + 0.01 * (1 - Math.abs(i)), 0.025],
        );
    if (d.hair === "long" || d.hair === "bob") {
      cube(
        x,
        x.neck,
        c,
        [0.315, d.hair === "long" ? 0.35 : 0.19, 0.055],
        [0, d.hair === "long" ? 0.16 : 0.24, 0.178],
      );
      if (d.hair === "long")
        for (const s of [-1, 1])
          cube(x, x.neck, c, [0.05, 0.28, 0.065], [s * 0.15, 0.155, 0.11]);
    }
    if (d.hair === "ponytail")
      cube(x, x.neck, c, [0.085, 0.23, 0.075], [0, 0.22, 0.23]);
    if (d.hair === "topknot")
      cube(x, x.neck, c, [0.085, 0.085, 0.08], [0, 0.42, 0.07]);
    if (d.hair === "braid")
      for (let i = 0; i < 4; i++)
        cube(
          x,
          x.neck,
          c,
          [0.055, 0.06, 0.05],
          [0.135 + (i % 2) * 0.012, 0.2 - i * 0.05, -0.03],
        );
  }
  function body(x, d) {
    const parts = [
      x.hips,
      x.chest,
      x.neck,
      x.armL.arm,
      x.armL.fore,
      x.armR.arm,
      x.armR.fore,
      x.legL.leg,
      x.legL.shin,
      x.legR.leg,
      x.legR.shin,
    ];
    for (const part of parts)
      for (const child of [...part.children])
        if (child.isMesh) part.remove(child);
    const w = x.S.w,
      b = x.S.bulk,
      skin = x.S.skin;
    cube(x, x.hips, d.under, [0.35 * w, 0.19, 0.25], [0, 0, 0]);
    cube(x, x.chest, d.color, [0.4 * w, 0.55, 0.255], [0, 0.125, 0]);
    cube(x, x.neck, skin, [0.105, 0.15, 0.1], [0, 0.025, 0]);
    cube(x, x.neck, skin, [0.32, 0.32, 0.3], [0, 0.2, 0]);
    const masked = ["muyeong", "neupji", "geomi"].includes(d.id);
    for (const s of [-1, 1]) {
      pixel(x, x.neck, 0xe9eee8, s * 0.073, 0.224, -0.153, 0.052, 0.024);
      pixel(
        x,
        x.neck,
        shade(x.S.eye, 0.72),
        s * 0.073 - s * 0.006,
        0.224,
        -0.156,
        0.024,
        0.024,
      );
      pixel(
        x,
        x.neck,
        shade(x.S.hair, 0.75),
        s * 0.073,
        0.267,
        -0.154,
        0.061,
        0.015,
      );
    }
    if (!masked) {
      cube(
        x,
        x.neck,
        tint(skin, 0xffffff, 0.1),
        [0.032, 0.043, 0.027],
        [0, 0.181, -0.158],
      );
      pixel(
        x,
        x.neck,
        tint(skin, 0x754744, 0.55),
        0,
        0.122,
        -0.153,
        0.043,
        0.009,
      );
    }
    hair(x, d);
    const bare = ["gangcheol", "hwasan", "baram", "hyeollang"].includes(d.id);
    for (const [limb, s] of [
      [x.armL, -1],
      [x.armR, 1],
    ]) {
      cube(
        x,
        limb.arm,
        bare ? skin : d.color,
        [0.145 * b, 0.292, 0.155],
        [0, -0.146, 0],
      );
      cube(
        x,
        limb.fore,
        bare ? skin : d.color,
        [0.133 * b, 0.225, 0.145],
        [0, -0.112, 0],
      );
      cube(
        x,
        limb.fore,
        shade(d.under, 0.8),
        [0.14 * b, 0.038, 0.15],
        [0, -0.19, 0],
      );
      cube(
        x,
        limb.fore,
        d.clothes === "robe" ? skin : dark,
        [0.13 * b, 0.09, 0.14],
        [0, -0.25, -0.005],
      );
      pixel(x, limb.arm, d.trim, -s * 0.045, -0.16, -0.081, 0.026, 0.07);
    }
    for (const limb of [x.legL, x.legR]) {
      const lw = Math.min(0.18 * b, 0.205 * w);
      cube(x, limb.leg, d.under, [lw, 0.42, 0.195], [0, -0.21, 0]);
      pixel(x, limb.leg, shade(d.under, 0.83), 0, -0.31, -0.101, 0.08, 0.026);
      cube(x, limb.shin, d.under, [lw - 0.008, 0.365, 0.185], [0, -0.175, 0]);
      cube(
        x,
        limb.shin,
        d.id === "danbi" ? 0xe4bf52 : shade(d.under, 0.73),
        [lw + 0.01, 0.15, 0.255],
        [0, -0.35, -0.03],
      );
      cube(
        x,
        limb.shin,
        0x252b35,
        [lw + 0.015, 0.028, 0.26],
        [0, -0.41, -0.03],
      );
      pixel(x, limb.shin, d.trim, 0, -0.27, -0.096, 0.07, 0.026);
    }
    cube(x, x.hips, shade(d.under, 0.7), [0.365 * w, 0.05, 0.27], [0, 0.06, 0]);
    pixel(x, x.hips, d.trim, 0, 0.06, -0.14, 0.057, 0.04);
    if (["jacket", "vest", "coat", "cape"].includes(d.clothes)) {
      pixel(x, x.chest, d.under, 0, 0.18, -0.131, 0.16, 0.29);
      for (const s of [-1, 1])
        pixel(x, x.chest, d.trim, s * 0.091, 0.21, -0.134, 0.018, 0.29);
    } else if (d.clothes === "robe") {
      for (const s of [-1, 1])
        for (let i = 0; i < 3; i++)
          pixel(
            x,
            x.chest,
            d.under,
            s * (0.09 - i * 0.028),
            0.34 - i * 0.03,
            -0.134,
            0.04,
            0.037,
          );
    } else {
      pixel(x, x.chest, d.trim, 0, 0.19, -0.132, 0.018, 0.3);
    }
    pattern(x, x.chest, d.trim, ICONS[d.gear], [0.12 * w, 0.31, -0.139], 0.017);
    if (d.clothes === "coat" || d.clothes === "robe")
      for (const [leg, s] of [
        [x.legL.leg, -1],
        [x.legR.leg, 1],
      ]) {
        cube(x, leg, d.color, [0.06, 0.3, 0.24], [s * 0.085, -0.095, 0.015]);
        pixel(x, leg, d.trim, s * 0.085, -0.235, -0.111, 0.06, 0.025);
      }
    if (d.clothes === "cape" || d.clothes === "robe")
      cube(
        x,
        x.chest,
        shade(d.color, 0.85),
        [0.36 * w, 0.43, 0.025],
        [0, 0.12, 0.16],
      );
    if (d.clothes === "vest")
      for (const s of [-1, 1])
        cube(
          x,
          x.chest,
          shade(d.color, 0.76),
          [0.075, 0.29, 0.027],
          [s * 0.11, 0.19, -0.144],
        );
    if (d.clothes === "armor") {
      cube(
        x,
        x.chest,
        tint(d.color, metal, 0.28),
        [0.43 * w, 0.34, 0.035],
        [0, 0.21, -0.145],
      );
      for (const s of [-1, 1])
        cube(x, x.chest, d.color, [0.2, 0.13, 0.23], [s * 0.235 * w, 0.345, 0]);
      pattern(x, x.chest, d.trim, ICONS[d.gear], [0, 0.32, -0.168]);
    }
    if (d.clothes === "hood") hood(x, d, masked);
    if (d.clothes === "shawl" || d.clothes === "poncho") {
      cube(x, x.chest, d.color, [0.48 * w, 0.13, 0.3], [0, 0.345, 0]);
      cube(x, x.chest, d.color, [0.445 * w, 0.2, 0.285], [0, 0.19, 0]);
      if (d.clothes === "poncho")
        cube(x, x.chest, d.color, [0.47 * w, 0.13, 0.28], [0, 0.035, 0]);
    }
    if (d.clothes === "apron") {
      pixel(x, x.chest, d.under, 0, 0.16, -0.137, 0.255, 0.31);
      cube(x, x.hips, d.under, [0.285, 0.24, 0.025], [0, -0.035, -0.144]);
      pixel(x, x.hips, shade(d.under, 0.8), 0, -0.04, -0.16, 0.18, 0.08);
    }
  }
  const GEAR = {
    fire(x, d) {
      for (const s of [-1, 1])
        cube(x, x.chest, d.trim, [0.08, 0.25, 0.09], [s * 0.075, 0.2, 0.245]);
      cube(
        x,
        x.armR.fore,
        shade(d.color, 0.7),
        [0.17, 0.16, 0.17],
        [0, -0.12, 0],
      );
      for (let i = 0; i < 3; i++)
        pixel(
          x,
          x.armR.fore,
          d.trim,
          -0.045 + i * 0.045,
          -0.12,
          -0.09,
          0.025,
          0.1,
        );
    },
    ice(x, d) {
      cube(x, x.chest, d.under, [0.24, 0.07, 0.27], [0, 0.405, 0]);
      for (let i = -1; i <= 1; i++)
        cube(
          x,
          x.chest,
          i % 2 ? d.trim : d.under,
          [0.06, 0.12 + (1 - Math.abs(i)) * 0.1, 0.065],
          [i * 0.075, 0.25, 0.215],
        );
      for (const s of [-1, 1])
        cube(x, x.hips, d.trim, [0.06, 0.09, 0.055], [s * 0.17, 0, -0.07]);
    },
    shadow(x, d) {
      for (let i = -1; i <= 1; i++) {
        cube(
          x,
          x.chest,
          d.under,
          [0.025, 0.34, 0.025],
          [i * 0.045, 0.25, 0.205],
        );
        cube(
          x,
          x.chest,
          d.trim,
          [0.045, 0.065, 0.04],
          [i * 0.045, 0.43, 0.205],
        );
      }
      cube(x, x.chest, d.under, [0.36, 0.32, 0.025], [0, 0.215, 0.17]);
    },
    shield(x, d) {
      cube(x, x.chest, d.under, [0.3, 0.39, 0.055], [-0.035, 0.22, 0.22]);
      frame(
        x,
        x.chest,
        d.trim,
        [-0.035, 0.22, 0.253],
        0.29,
        0.38,
        0.025,
        0.025,
      );
      for (const arm of [x.armL, x.armR])
        cube(x, arm.fore, metal, [0.18, 0.16, 0.19], [0, -0.15, -0.01]);
    },
    flower(x, d) {
      const p = [-0.235, 0.39, -0.02];
      cube(x, x.chest, d.trim, [0.06, 0.06, 0.065], p);
      for (const [px, py] of [
        [-0.07, 0],
        [0.07, 0],
        [0, -0.07],
        [0, 0.07],
      ])
        cube(
          x,
          x.chest,
          cream,
          [0.06, 0.06, 0.04],
          [p[0] + px, p[1] + py, p[2]],
        );
      for (let i = -1; i <= 1; i++)
        vial(x, x.hips, d.trim, [i * 0.065, 0.015, -0.16]);
    },
    radio(x, d) {
      pack(x, d.under, 0.28, 0.27);
      cube(x, x.chest, d.trim, [0.15, 0.07, 0.02], [0, 0.24, 0.287]);
      cube(x, x.chest, dark, [0.02, 0.18, 0.02], [-0.12, 0.41, 0.245]);
      cube(x, x.neck, d.under, [0.04, 0.06, 0.08], [0.18, 0.22, 0]);
    },
    bow(x, d) {
      for (let i = 0; i < 7; i++)
        cube(
          x,
          x.chest,
          metal,
          [0.035, 0.055, 0.035],
          [-0.13 + Math.abs(i - 3) * 0.025, 0.03 + i * 0.065, 0.205],
        );
      cube(x, x.chest, d.trim, [0.008, 0.4, 0.008], [-0.055, 0.22, 0.205]);
      cube(x, x.neck, dark, [0.1, 0.055, 0.035], [0.085, 0.228, -0.174]);
      pixel(x, x.neck, d.trim, 0.095, 0.228, -0.194, 0.033, 0.032);
    },
    bolt(x, d) {
      for (const arm of [x.armL, x.armR])
        for (let i = 0; i < 3; i++)
          cube(
            x,
            arm.fore,
            i % 2 ? metal : d.trim,
            [0.155, 0.022, 0.16],
            [0, -0.06 - i * 0.05, 0],
          );
      for (const leg of [x.legL, x.legR])
        pattern(x, leg.shin, d.trim, ICONS.bolt, [0, -0.16, -0.1], 0.026);
    },
    mirror(x, d) {
      for (let i = 0; i < 5; i++)
        cube(
          x,
          x.chest,
          i % 2 ? metal : d.trim,
          [0.045, 0.17, 0.025],
          [(i - 2) * 0.055, 0.32 + Math.abs(i - 2) * 0.02, 0.21],
          [0, 0, (i - 2) * 0.11],
        );
      cube(x, x.armL.fore, d.trim, [0.08, 0.09, 0.02], [0, -0.12, -0.085]);
    },
    sand(x, d) {
      scarf(x, d.under);
      for (let i = 0; i < 3; i++)
        cube(
          x,
          x.chest,
          i === 1 ? d.trim : d.under,
          [0.19 - i * 0.025, 0.07, 0.12],
          [0, 0.14 + i * 0.07, 0.235],
        );
      cube(x, x.hips, d.trim, [0.07, 0.09, 0.055], [0.18, 0, 0]);
    },
    bell(x, d) {
      for (const s of [-1, 1]) {
        cube(
          x,
          x.chest,
          d.trim,
          [0.05, 0.055, 0.05],
          [s * 0.135, 0.325, -0.17],
        );
        cube(x, x.chest, d.trim, [0.09, 0.07, 0.075], [s * 0.135, 0.27, -0.17]);
        cube(
          x,
          x.chest,
          shade(d.trim, 0.7),
          [0.11, 0.025, 0.085],
          [s * 0.135, 0.225, -0.17],
        );
      }
      dial(x, x.armL.fore, d.trim, [0, -0.12, -0.09], 0.07);
    },
    magnet(x, d) {
      frame(x, x.chest, metal, [0, 0.23, 0.23], 0.22, 0.25, 0.075, 0.055);
      cube(x, x.chest, d.color, [0.13, 0.13, 0.082], [0, 0.36, 0.23]);
      for (const s of [-1, 1])
        cube(
          x,
          x.chest,
          s < 0 ? 0xe2837d : 0x8dcde5,
          [0.06, 0.06, 0.08],
          [s * 0.11, 0.36, 0.23],
        );
    },
    blood(x, d) {
      pattern(
        x,
        x.armR.fore,
        d.trim,
        ["100", "110", "010", "011"],
        [0, -0.05, -0.08],
        0.026,
      );
      for (const s of [-1, 1]) vial(x, x.hips, d.trim, [s * 0.155, 0, -0.075]);
      pixel(x, x.neck, d.trim, 0, 0.11, -0.154, 0.035, 0.015);
    },
    hive(x, d) {
      pack(x, d.under, 0.27, 0.26);
      for (let row = 0; row < 3; row++)
        for (let col = 0; col < 3; col++)
          cube(
            x,
            x.chest,
            (row + col) % 2 ? d.trim : shade(d.trim, 0.7),
            [0.062, 0.055, 0.022],
            [(col - 1) * 0.075, 0.125 + row * 0.072, 0.29],
          );
      cube(x, x.neck, d.under, [0.35, 0.04, 0.035], [0, 0.29, -0.162]);
    },
    wind(x, d) {
      scarf(x, d.trim, true);
      for (const s of [-1, 1])
        for (let i = 0; i < 2; i++)
          cube(
            x,
            s < 0 ? x.armL.fore : x.armR.fore,
            d.under,
            [0.035, 0.13 - i * 0.03, 0.09],
            [s * (0.078 + i * 0.025), -0.12, 0.015],
          );
    },
    spider(x, d) {
      cube(x, x.neck, d.under, [0.3, 0.085, 0.018], [0, 0.115, -0.159]);
      for (const s of [-1, 1])
        pixel(x, x.neck, d.trim, s * 0.117, 0.267, -0.163, 0.019, 0.019);
      cube(x, x.chest, d.under, [0.15, 0.2, 0.07], [0, 0.23, 0.2]);
      for (const s of [-1, 1])
        for (let i = 0; i < 2; i++) {
          const y = 0.34 - i * 0.2,
            px = s * (0.2 + i * 0.02);
          cube(x, x.chest, d.under, [0.23, 0.035, 0.04], [s * 0.12, y, 0.245]);
          cube(x, x.chest, d.under, [0.035, 0.2, 0.04], [px, y - 0.085, 0.245]);
          cube(x, x.chest, d.trim, [0.05, 0.05, 0.05], [px, y, 0.245]);
        }
      for (const arm of [x.armL, x.armR])
        pixel(x, arm.fore, cream, 0, -0.13, -0.078, 0.065, 0.022);
    },
    star(x, d) {
      pattern(x, x.chest, d.trim, ICONS.star, [0, 0.36, 0.203], 0.045);
      cube(x, x.armL.fore, d.trim, [0.08, 0.075, 0.03], [0, -0.12, -0.09]);
      for (let i = 0; i < 3; i++)
        pixel(x, x.chest, d.trim, (i - 1) * 0.1, 0.05, 0.181, 0.025, 0.025);
    },
    blades(x, d) {
      for (const s of [-1, 1]) {
        cube(
          x,
          x.chest,
          dark,
          [0.035, 0.43, 0.04],
          [s * 0.065, 0.22, 0.22],
          [0, 0, s * 0.52],
        );
        cube(x, x.chest, d.trim, [0.1, 0.022, 0.045], [s * 0.18, 0.42, 0.22]);
        cube(x, x.chest, d.under, [0.035, 0.09, 0.045], [s * 0.18, 0.46, 0.22]);
      }
      cube(x, x.hips, d.trim, [0.025, 0.14, 0.035], [0.18, -0.02, -0.04]);
    },
    vine(x, d) {
      for (let i = 0; i < 3; i++)
        leaf(x, x.chest, i % 2 ? d.trim : d.under, [
          -0.21 - i * 0.025,
          0.35 - i * 0.045,
          0.015,
        ]);
      pattern(x, x.armR.fore, d.trim, ICONS.vine, [0, -0.04, -0.077], 0.03);
      cube(
        x,
        x.hips,
        shade(d.under, 0.8),
        [0.09, 0.12, 0.06],
        [0.15, -0.01, 0.02],
      );
    },
    toxin(x, d) {
      pack(x, d.under, 0.23, 0.28, 0.11);
      cube(x, x.chest, d.trim, [0.15, 0.16, 0.022], [0, 0.19, 0.29]);
      cube(x, x.neck, dark, [0.15, 0.065, 0.055], [0, 0.145, -0.178]);
      for (const s of [-1, 1])
        cube(
          x,
          x.neck,
          d.under,
          [0.055, 0.055, 0.07],
          [s * 0.115, 0.14, -0.174],
        );
    },
    lantern(x, d) {
      frame(
        x,
        x.hips,
        d.under,
        [-0.23, -0.02, 0.01],
        0.105,
        0.145,
        0.07,
        0.022,
      );
      cube(x, x.hips, d.trim, [0.075, 0.115, 0.055], [-0.23, -0.02, 0.01]);
      for (const y of [0.065, -0.105])
        cube(x, x.hips, d.under, [0.13, 0.025, 0.09], [-0.23, y, 0.01]);
      dial(x, x.armL.fore, d.trim, [0, -0.1, -0.09], 0.07);
    },
    illusion(x, d) {
      cube(x, x.armL.arm, d.under, [0.18, 0.12, 0.18], [0, -0.055, 0]);
      for (let i = 0; i < 5; i++)
        pixel(x, x.chest, d.trim, (i - 2) * 0.05, 0.27, 0.153, 0.032, 0.045);
      for (const s of [-1, 1])
        cube(
          x,
          x.armL.fore,
          d.trim,
          [0.03, 0.05, 0.015],
          [s * 0.025, -0.1, -0.085],
        );
    },
    sound(x, d) {
      for (const s of [-1, 1]) {
        cube(x, x.neck, d.under, [0.055, 0.105, 0.09], [s * 0.185, 0.22, 0]);
        cube(x, x.neck, d.trim, [0.012, 0.065, 0.06], [s * 0.218, 0.22, 0]);
      }
      cube(x, x.neck, d.under, [0.37, 0.025, 0.055], [0, 0.395, 0]);
      pack(x, d.under, 0.23, 0.27);
      for (const y of [0.12, 0.26]) {
        cube(x, x.chest, dark, [0.105, 0.1, 0.015], [0, y, 0.283]);
        cube(x, x.chest, d.trim, [0.05, 0.045, 0.016], [0, y, 0.295]);
      }
    },
    lava(x, d) {
      cube(x, x.armR.arm, d.under, [0.21, 0.16, 0.22], [0.02, -0.04, 0]);
      pattern(
        x,
        x.chest,
        d.trim,
        ["10010", "11010", "01011", "01100"],
        [0, 0.29, -0.17],
        0.038,
      );
      for (const s of [-1, 1])
        cube(x, x.chest, d.trim, [0.05, 0.15, 0.05], [s * 0.085, 0.28, 0.215]);
    },
    guard(x, d) {
      cube(x, x.chest, d.under, [0.3, 0.36, 0.04], [0, 0.21, 0.21]);
      frame(x, x.chest, d.trim, [0, 0.21, 0.238], 0.29, 0.35, 0.02, 0.024);
      pattern(x, x.chest, d.trim, ICONS.guard, [0, 0.29, 0.252], 0.043);
    },
    wolf(x, d) {
      for (const s of [-1, 1]) {
        cube(x, x.neck, d.under, [0.075, 0.1, 0.08], [s * 0.125, 0.415, 0.01]);
        pixel(x, x.neck, d.trim, s * 0.125, 0.42, -0.035, 0.035, 0.06);
      }
      cube(x, x.chest, d.under, [0.33, 0.075, 0.28], [0, 0.41, 0.01]);
      for (const arm of [x.armL, x.armR])
        for (let i = -1; i <= 1; i++)
          cube(
            x,
            arm.fore,
            cream,
            [0.018, 0.095, 0.025],
            [i * 0.035, -0.28, -0.087],
          );
    },
    falcon(x, d) {
      /* A folded falcon insignia; the ability bird stays separate. */ cube(
        x,
        x.chest,
        d.under,
        [0.085, 0.12, 0.07],
        [-0.235, 0.43, 0],
      );
      cube(x, x.chest, d.trim, [0.065, 0.065, 0.065], [-0.235, 0.505, -0.012]);
      cube(
        x,
        x.chest,
        0xc5a060,
        [0.035, 0.025, 0.035],
        [-0.235, 0.495, -0.055],
      );
      for (const s of [-1, 1])
        cube(
          x,
          x.chest,
          d.under,
          [0.035, 0.1, 0.075],
          [-0.235 + s * 0.055, 0.425, 0.02],
        );
      for (let i = 0; i < 3; i++)
        cube(
          x,
          x.chest,
          d.trim,
          [0.02, 0.32, 0.02],
          [0.1 + i * 0.035, 0.2, 0.2],
        );
    },
    water(x, d) {
      scarf(x, d.under);
      for (const arm of [x.armL, x.armR]) {
        cube(x, arm.fore, d.trim, [0.16, 0.065, 0.17], [0, -0.13, 0]);
        pattern(x, arm.fore, d.under, ICONS.water, [0, -0.07, -0.09], 0.02);
      }
    },
    ink(x, d) {
      hat(x, d.trim, true);
      for (const [px, py, w, h] of [
        [-0.12, 0.12, 0.07, 0.09],
        [0.1, 0.27, 0.045, 0.06],
        [0.12, -0.01, 0.05, 0.04],
      ])
        pixel(x, x.chest, d.trim, px, py, -0.134, w, h);
      cube(
        x,
        x.chest,
        0x786449,
        [0.03, 0.43, 0.035],
        [0.11, 0.21, 0.21],
        [0, 0, -0.2],
      );
      cube(x, x.chest, d.trim, [0.065, 0.13, 0.06], [0.065, 0.03, 0.21]);
      cube(x, x.hips, d.under, [0.06, 0.075, 0.06], [0.18, -0.01, -0.04]);
    },
    moon(x, d) {
      pattern(
        x,
        x.neck,
        d.trim,
        ["011", "110", "110", "011"],
        [0.13, 0.32, -0.174],
        0.022,
      );
      cube(x, x.hips, d.trim, [0.365 * x.S.w, 0.075, 0.275], [0, 0.04, 0]);
      for (let i = 0; i < 3; i++)
        pixel(x, x.chest, d.trim, (i - 1) * 0.04, 0.15, -0.139, 0.018, 0.018);
    },
    rain(x, d) {
      hat(x, d.color);
      for (let i = 0; i < 4; i++)
        pixel(
          x,
          x.chest,
          [0xd88b7b, 0xd2bb6f, 0x97bf8a, 0x8cbdd9][i],
          0,
          0.12 - i * 0.025,
          -0.149,
          0.31,
          0.018,
        );
      vial(x, x.chest, d.trim, [0.24, 0.18, 0.1]);
    },
    heavy(x, d) {
      for (const [leg, s] of [
        [x.legL, -1],
        [x.legR, 1],
      ]) {
        cube(x, leg.shin, d.color, [0.215, 0.17, 0.265], [0, -0.34, -0.03]);
        cube(
          x,
          leg.shin,
          metal,
          [0.035, 0.23, 0.035],
          [s * 0.105, -0.16, 0.02],
        );
        cube(x, x.chest, d.under, [0.22, 0.13, 0.25], [s * 0.25, 0.33, 0]);
      }
      cube(x, x.chest, d.trim, [0.09, 0.22, 0.02], [0, 0.21, -0.173]);
    },
    hound(x, d) {
      dial(x, x.armL.fore, d.trim, [0, -0.12, -0.09], 0.08);
      for (let i = 0; i < 3; i++)
        vial(x, x.hips, i % 2 ? d.trim : metal, [(i - 1) * 0.065, 0.01, -0.16]);
      pattern(x, x.chest, d.trim, ["101", "111", "010"], [-0.11, 0.28, -0.143]);
    },
    drone(x, d) {
      pack(x, d.under, 0.28, 0.27);
      for (const px of [-0.065, 0.065])
        for (const py of [0.13, 0.26]) {
          cube(x, x.chest, dark, [0.1, 0.09, 0.06], [px, py, 0.295]);
          pixel(x, x.chest, d.trim, px, py, 0.328, 0.06, 0.025);
        }
      cube(x, x.armL.fore, metal, [0.08, 0.115, 0.025], [0, -0.12, -0.085]);
      pixel(x, x.armL.fore, d.trim, 0, -0.12, -0.1, 0.055, 0.08);
      cube(x, x.neck, d.trim, [0.04, 0.08, 0.023], [-0.085, 0.31, -0.17]);
    },
    herbs(x, d) {
      for (let i = -1; i <= 1; i++)
        vial(x, x.hips, [0x9fd793, 0xd6a0aa, 0xe0cd8c][i + 1], [
          i * 0.065,
          0.015,
          -0.18,
        ]);
      pack(x, 0x927b55, 0.24, 0.22, 0.11);
      for (let i = -1; i <= 1; i++)
        cube(
          x,
          x.chest,
          0xbdac7d,
          [0.025, 0.22, 0.015],
          [i * 0.07, 0.2, 0.293],
        );
      for (let i = 0; i < 3; i++)
        leaf(x, x.chest, d.trim, [
          -0.07 + i * 0.07,
          0.36 + (i % 2) * 0.035,
          0.23,
        ]);
    },
    mortar(x, d) {
      hat(x, d.trim);
      cube(
        x,
        x.chest,
        d.under,
        [0.11, 0.38, 0.11],
        [0.09, 0.24, 0.23],
        [0.1, 0, -0.15],
      );
      cube(x, x.chest, metal, [0.135, 0.06, 0.135], [0.115, 0.43, 0.23]);
      cube(x, x.chest, dark, [0.075, 0.007, 0.075], [0.115, 0.464, 0.23]);
      for (const s of [-1, 1])
        cube(x, x.hips, d.trim, [0.08, 0.075, 0.055], [s * 0.16, 0.01, -0.07]);
    },
    clock(x, d) {
      pack(x, d.under, 0.24, 0.26, 0.065);
      dial(x, x.chest, d.trim, [0, 0.22, 0.245], 0.19);
      dial(x, x.armL.fore, d.trim, [0, -0.12, -0.09], 0.08);
      for (let i = 0; i < 3; i++)
        pixel(x, x.chest, d.trim, 0.13, 0.25 - i * 0.06, -0.135, 0.022, 0.022);
    },
    portal(x, d) {
      for (const s of [-1, 1])
        frame(
          x,
          x.chest,
          s < 0 ? d.trim : 0x829cde,
          [s * 0.095, 0.22, 0.23],
          0.13,
          0.31,
          0.035,
          0.025,
        );
      for (const arm of [x.armL, x.armR])
        pattern(x, arm.fore, d.trim, ICONS.portal, [0, -0.08, -0.079], 0.018);
    },
    outlaw(x, d) {
      hat(x, d.color, true);
      scarf(x, 0xb95b51);
      cube(x, x.hips, d.under, [0.07, 0.16, 0.09], [0.19, -0.035, 0]);
      for (let i = 0; i < 3; i++)
        cube(
          x,
          x.chest,
          d.trim,
          [0.023, 0.065, 0.025],
          [-0.1 + i * 0.05, 0.29 - i * 0.06, -0.145],
        );
    },
    compass(x, d) {
      dial(x, x.chest, d.trim, [0.1, 0.27, -0.155], 0.08);
      cube(x, x.chest, d.under, [0.075, 0.37, 0.075], [-0.11, 0.21, 0.21]);
      for (const y of [0.06, 0.36])
        cube(x, x.chest, d.trim, [0.085, 0.035, 0.085], [-0.11, y, 0.21]);
      for (let i = 0; i < 3; i++)
        cube(
          x,
          x.chest,
          metal,
          [0.02, 0.32, 0.025],
          [0.05 + i * 0.04, 0.22, 0.205],
        );
      pixel(x, x.hips, d.under, -0.15, -0.03, -0.15, 0.08, 0.13);
    },
  };
  for (const entry of DEFINITIONS) {
    const [id, color, trim, under, clothes, hairStyle, gear, design] = entry,
      agent = AGENTS.find((a) => (a.id || a.key) === id);
    if (!agent) continue;
    const d = { id, color, trim, under, clothes, hair: hairStyle, gear };
    CH_STYLE[id] = {
      ...CH_STYLE._default,
      ...CH_STYLE[id],
      w: Math.min(1.16, Math.max(0.94, CH_STYLE[id]?.w || 1)),
      bulk: Math.min(1.18, Math.max(0.94, CH_STYLE[id]?.bulk || 1)),
    };
    CH_OUTFIT[id] = function (original) {
      const x = { ...original, voxels: 0 };
      body(x, d);
      GEAR[gear](x, d);
      x.hips.userData.voxelCount = x.voxels;
    };
    CATALOG[id] = Object.freeze({
      id,
      name: agent.name,
      design,
      abilities: agent.abilities.map((a) => a.name).join(" · "),
      version: VERSION,
      style: "voxel",
    });
  }
  const previous = buildFighter;
  buildFighter = function (teamColor, agent) {
    const model = previous.apply(this, arguments),
      id = agent && (agent.id || agent.key);
    if (!CATALOG[id]) return model;
    const style = CH_STYLE[id];
    model.group.name = "agent:" + id;
    model.group.userData.agentModel = {
      id,
      version: VERSION,
      style: "voxel",
      blocks: model.hips.userData.voxelCount,
    };
    const names = {
      hips: model.hips,
      chest: model.chest,
      head: model.neck,
      upper_arm_l: model.armL.arm,
      forearm_l: model.armL.fore,
      upper_arm_r: model.armR.arm,
      forearm_r: model.armR.fore,
      thigh_l: model.legL.leg,
      shin_l: model.legL.shin,
      thigh_r: model.legR.leg,
      shin_r: model.legR.shin,
    };
    for (const [name, joint] of Object.entries(names)) joint.name = name;
    for (const joint of [model.armL.arm, model.armR.arm])
      for (const m of joint.children)
        if (m.isMesh && m.material === model.teamMat) {
          m.geometry = G_BOX(1, 1, 1);
          m.scale.set(0.155 * style.bulk, 0.023, 0.166);
          m.position.set(0, -0.1, 0);
        }
    const bounds = new T.Box3();
    for (const mesh of model.chest.children)
      if (mesh.isMesh && mesh.userData.baked) {
        mesh.geometry.computeBoundingBox();
        bounds.union(mesh.geometry.boundingBox);
      }
    for (const mesh of model.chest.children)
      if (mesh.isMesh && mesh.material === model.teamMat) {
        if (mesh.position.z > 0) {
          mesh.position.set(0, 0.34, bounds.max.z + 0.008);
          mesh.scale.set(1, 1, 1);
        } else {
          mesh.position.set(-0.13 * style.w, 0.35, bounds.min.z - 0.008);
          mesh.scale.set(1, 1, 1);
        }
      }
    return model;
  };
  // Project the same block meshes into queued portraits. No new WebGL context
  // or shader compilation can delay the first Armory button or home paint.
  const fallbackPortrait = agentPortrait,
    portraits = new Map();
  agentPortrait = function (agent, width = 300, height = 380) {
    const id = agent && (agent.id || agent.key);
    if (!CATALOG[id]) return fallbackPortrait.apply(this, arguments);
    const key = id + ":" + width + ":" + height;
    if (portraits.has(key)) return portraits.get(key);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d"),
      model = buildFighter(0x8aaeba, agent, { bodyOnly: true });
    try {
      model.armL.arm.rotation.set(0.06, 0, 0.1);
      model.armR.arm.rotation.set(0.06, 0, -0.1);
      model.armL.fore.rotation.set(-0.1, 0, 0);
      model.armR.fore.rotation.set(-0.1, 0, 0);
      model.gun.visible = false;
      model.group.updateMatrixWorld(true);
      const top = new T.Box3().setFromObject(model.group).max.y,
        targetY = top - 0.75,
        aspect = width / height,
        camera = new T.OrthographicCamera(
          -0.88 * aspect,
          0.88 * aspect,
          0.88,
          -0.88,
          0.1,
          20,
        );
      camera.position.set(2.8, targetY + 0.8, -5);
      camera.lookAt(0, targetY, 0);
      camera.updateMatrixWorld(true);
      camera.updateProjectionMatrix();
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, "#263344");
      grad.addColorStop(1, "#101821");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = agent.color || "#8aaeba";
      ctx.globalAlpha = 0.13;
      ctx.fillRect(0, height * 0.57, width, height * 0.43);
      ctx.globalAlpha = 1;
      const faces = [],
        light = new T.Vector3(-0.5, 0.85, -1).normalize(),
        eye = camera.position
          .clone()
          .sub(new T.Vector3(0, targetY, 0))
          .normalize();
      model.group.traverse((node) => {
        if (!node.isMesh || !node.visible || !node.userData.baked) return;
        const g = node.geometry,
          pos = g.attributes.position,
          colors = g.attributes.color,
          normalMatrix = new T.Matrix3().getNormalMatrix(node.matrixWorld);
        if (!colors) return;
        // Each baked cuboid face is two adjacent triangles. Draw its four
        // corners once, avoiding diagonal seams and half the canvas calls.
        for (let i = 0; i < pos.count; i += 6) {
          const normal = new T.Vector3()
            .fromBufferAttribute(g.attributes.normal, i)
            .applyNormalMatrix(normalMatrix);
          if (normal.dot(eye) <= 0) continue;
          const p = [0, 1, 4, 2].map((j) =>
            new T.Vector3()
              .fromBufferAttribute(pos, i + j)
              .applyMatrix4(node.matrixWorld)
              .project(camera),
          );
          const color = new T.Color()
            .fromBufferAttribute(colors, i)
            .multiplyScalar(0.73 + 0.35 * Math.max(0, normal.dot(light)))
            .convertLinearToSRGB();
          faces.push({
            p,
            color: "#" + color.getHexString(T.LinearSRGBColorSpace),
            z: p.reduce((s, v) => s + v.z, 0) / p.length,
          });
        }
      });
      faces.sort((a, b) => b.z - a.z);
      ctx.lineWidth = 0.45;
      for (const face of faces) {
        ctx.fillStyle = ctx.strokeStyle = face.color;
        ctx.beginPath();
        face.p.forEach((v, i) => {
          const px = ((v.x + 1) * width) / 2,
            py = ((1 - v.y) * height) / 2;
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      const url = canvas.toDataURL("image/webp", 0.88);
      portraits.set(key, url);
      return url;
    } finally {
      chDispose(model.group);
    }
  };
  window.AGENT_MODELS = Object.freeze({
    version: VERSION,
    style: "voxel",
    catalog: Object.freeze(CATALOG),
  });
  if (new URLSearchParams(location.search).get("model-review") === "1")
    GAME_BOOT.ready.then(() => {
      const script = document.createElement("script");
      script.src = "./js/agent-model-review.js";
      document.body.append(script);
    });
})();
