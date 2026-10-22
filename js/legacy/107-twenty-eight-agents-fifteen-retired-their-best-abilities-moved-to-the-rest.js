(() => {
  // The roster cut from 43 to 28. Fifteen agents whose abilities mostly repeated others' (another smoke, another trap,
  // another reveal, another leap) leave the game. The best of what they had moves to the agents who stay, in place of
  // those agents' weakest or most repeated ability, renamed and re-themed for their new owner:
  //   화령 C 잔불(연막) → 용암 갑옷        강철 Q 충격 수류탄 → 지진 강타     홍혈 E 혈안 → 피의 맹세(격노)
  //   칼날 X 천검(자동 추적) → 칼날 만화경  바람 C 역풍 → 칼바람 가르기(균열파) 추적 E 사냥개 → 추적 화살
  //   환영 C 신기루 덫 → 환영 건너기        환영 X 환영 군단 → 환영의 장막(탐지 지움)
  //   별빛 C 반중력 → 별똥 이동(순간이동)   단비 Q 비구름 힐 → 물대포   단비 X 장마 → 벼락 사슬(연쇄 뇌격)
  //   흑사 Q 모래 장막(연막) → 모래 감옥    흑사 X 모래 무덤 → 흑사병(번지는 감염)
  //   덩굴 C 꽃가루 → 흡혈 덩굴             백호 E 경계 센서 → 정찰 화살      백호 C 연막 화살 → 곡사 화살
  //   자철 X 자장 역전 → 자기장 돔(총격 흡수)
  // What an ability does is untouched: it is the same cast under the same type, only its owner, slot, name and wording
  // change. The agents' own code (models, portraits, abilities) stays loaded, so nothing else breaks; they are only no
  // longer in AGENTS.
  if ("undefined" == typeof AGENTS) return;
  const RETIRED = ["noeha", "hwasan", "cheolhyeol", "hyeollang", "muyeong", "gyeongyeon", "songgol", "ullim", "haerang", "mukhyang", "yeongwol", "neupji", "cheolbyeok", "deungbul", "hoero"];
  // [to agent, slot, from agent, from slot, new name, (desc) => new desc]
  const same = (d) => d;
  const MOVES = [
    ["hwaryeong", "C", "hwasan", "C", "용암 갑옷", same],
    ["gangcheol", "Q", "cheolhyeol", "Q", "지진 강타", (d) => d.replace("땅을 내려찍어", "강철 주먹으로 땅을 내려찍어")],
    ["hongyeol", "E", "cheolhyeol", "C", "피의 맹세", (d) => d.replace("체력 20을 바치고", "피 20을 바치고")],
    ["kallal", "X", "gyeongyeon", "X", "칼날 만화경", (d) => d.replace("거울 칼날", "날 선 칼날")],
    ["baram", "C", "gyeongyeon", "E", "칼바람 가르기", (d) => "바람 칼날이 " + d],
    ["chujeok", "E", "songgol", "Q", "추적 화살", (d) => d.replace("깃털 화살", "추적 화살")],
    ["hwanyeong", "C", "yeongwol", "E", "환영 건너기", (d) => d.replace("그림자를", "환영을")],
    ["hwanyeong", "X", "yeongwol", "X", "환영의 장막", (d) => d.replace(/달빛을/g, "환영의 장막을").replace(/달빛/g, "환영")],
    ["byeolbit", "C", "noeha", "E", "별똥 이동", (d) => "별똥별처럼 " + d],
    ["danbi", "Q", "haerang", "Q", "물대포", (d) => d.replace("25m 물줄기", "25m 빗물 줄기")],
    ["danbi", "X", "noeha", "X", "벼락 사슬", (d) => d.replace("전하를 모아", "먹구름에서 벼락을 모아").replace("방전한다", "내리꽂는다")],
    ["heuksa", "Q", "yeongwol", "Q", "모래 감옥", (d) => d.replace("달빛 감옥", "모래 감옥")],
    ["heuksa", "X", "neupji", "X", "흑사병", (d) => d.replace("적을 감염시킨다", "적에게 검은 모래가 옮는다")],
    ["deonggul", "C", "neupji", "C", "흡혈 덩굴", (d) => d.replace("거머리를 쏜다", "가시 덩굴을 쏜다").replace("붙은 적", "감긴 적")],
    ["baekho", "E", "muyeong", "Q", "정찰 화살", same],
    ["baekho", "C", "cheolbyeok", "Q", "곡사 화살", (d) => d.replace("포탄을 쏜다", "화살을 높이 쏘아 올린다")],
    ["jacheol", "X", "ullim", "X", "자기장 돔", (d) => d.replace(/음벽/g, "자기장").replace("공명파", "자기 파동")],
  ];
  const byId = (id) => AGENTS.find((a) => a.id === id);
  const moved = [];
  for (const [to, slot, from, fromSlot, name, word] of MOVES) {
    const host = byId(to),
      donor = byId(from),
      src = donor && donor.abilities.find((x) => x.key === fromSlot);
    const i = host ? host.abilities.findIndex((x) => x.key === slot) : -1;
    if (!src || i < 0) continue;
    const old = host.abilities[i],
      ab = Object.assign({}, src, { key: slot });
    // an ultimate stays an ultimate (its points come with it); anything else is no ultimate
    if (slot === "X") ab.ult = src.ult || old.ult || 7;
    else delete ab.ult;
    host.abilities[i] = ab;
    moved.push({ ab, name, word, to, from, type: src.type, replaced: old.type });
  }
  // the names and wording go on now and again once every script has loaded, as later ones rewrite some ultimates' text
  const rename = () => {
    for (const m of moved) {
      const base = m.ab.desc || "";
      if (m.ab.name === m.name && m.ab._renamed === base) continue;
      m.ab.name = m.name;
      m.ab.desc = m.word(base);
      m.ab._renamed = m.ab.desc;
    }
  };
  rename();
  document.addEventListener("DOMContentLoaded", rename);
  const keep = AGENTS.filter((a) => !RETIRED.includes(a.id));
  AGENTS.length = 0;
  keep.forEach((a) => AGENTS.push(a));
  window.AGENT_COUNT = AGENTS.length;
  window.ROSTER_CUT = { retired: RETIRED.slice(), moved: moved.map(({ to, from, type, replaced, name }) => ({ to, from, type, replaced, name })), rename };
})();
