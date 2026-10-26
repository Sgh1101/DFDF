
(() => {
  // Accounts and the owner, on the game side: the signed-in name, the owner's
  // settings (cheat rules, forced room rules, maintenance, notice), bans, the
  // public room list (a host reports its room every few seconds and picks up
  // the owner's commands: kick, move, message, close), experience after each
  // match, a room opened from the homepage, and English text.
  const API = "/api/v1";
  const $ = (id) => document.getElementById(id);
  const online = /^https?:/.test(location.protocol);
  let S = null;
  try {
    S = JSON.parse(localStorage.getItem("lgp_session") || "null");
  } catch (e) {}
  const token = () => (S && S.token) || "";
  function sessionMatches(ownerToken) {
    if (token() !== ownerToken) return false;
    try { return JSON.parse(localStorage.getItem("lgp_session") || "null")?.token === ownerToken; }
    catch (error) { return false; }
  }
  async function api(a, b) {
    const { response: r, data: j } = await GAME_REQUEST(API + "?a=" + a, { method: b ? "POST" : "GET", headers: { "Content-Type": "application/json" }, body: b ? JSON.stringify(b) : void 0 });
    if (!j.ok) throw Object.assign(new Error(j.error || "error"), { status: r.status, ban: j.ban, retryable: j.retryable });
    return j;
  }
  const params = new URLSearchParams(location.search);

  // ── English ──
  const LANG = (() => {
    try {
      return localStorage.getItem("lgp_lang") || "ko"; // the homepage stores the choice
    } catch (e) {
      return "ko";
    }
  })();
  window.GAME_LANG = LANG;
  const DICT = {"휠":"Wheel","뒤로":"Back","확인":"OK","장전":"Reload","시점":"View","처치":"Kills","참가":"Join","조작":"Controls","사격":"Fire","사망":"Deaths","공격":"Attack","닫기":"Close","권총":"Pistol","승리":"Victory","모드":"Mode","조준":"Aim","설정":"Settings","점프":"Jump","상점":"Shop","소리":"Sound","준비":"Ready","체력":"Health","수비":"Defense","재장전":"Reload","좌클릭":"Left click","명중률":"Accuracy","우클릭":"Right click","마우스":"Mouse","그래픽":"Graphics","피해량":"Damage","방어구":"Armor","기본값":"Default","잠그기":"Lock","효과음":"Sound effects","라운드":"Round","나가기":"Leave","관리자":"Admin","맵 구경":"Map tour","하강 ·":"Down ·","처음으로":"Home","맵 장치":"Map gadgets","원점으로":"Reset view","사망 시":"When dead","걷기 ·":"Walk ·","무기 ·":"Weapons ·","사격 ·":"Fire ·","이동 ·":"Move ·","일시정지":"Paused","조준 ·":"Aim ·","능력 ·":"Abilities ·","계속하기":"Resume","상점 ·":"Shop ·","상승 ·":"Up ·","링크 복사":"Copy link","혼자 하기":"Play solo","전술 지도":"Tactical map","맵 바꾸기":"Change map","코드 복사":"Copy code","요원 선택":"Choose agent","피해 숫자":"Damage numbers","초대 코드":"Invite code","화면 연출":"Effects","장비 구매":"Buy gear","연출 강도":"Effect strength","터치 감도":"Touch sensitivity","AI 자리":"AI slot","설치/해제":"Plant/Defuse","교전 시작":"Start match","전투 투입":"Deploy","맵 디테일":"Map detail","다시 하기":"Play again","AI 난이도":"AI difficulty","새로워진 점":"What's new","사격 연습장":"Shooting range","커스텀 게임":"Custom game","전부 기본값":"Reset all","궁극기 컷인":"Ultimate cut-in","모바일 조작":"Mobile controls","관리자 모드":"Admin mode","FPS 표시":"Show FPS","화면 흔들림":"Screen shake","총성·처치음":"Gunshot & kill sounds","동적 해상도":"Dynamic resolution","마우스 감도":"Mouse sensitivity","닫기 (B)":"Close (B)","관전 준비 중":"Getting ready to spectate","속도 조절 ·":"Speed ·","관리자 조절판":"Admin panel","조준 시 감도":"Aim sensitivity","게임 모드 5종":"5 game modes","AI 전부 빼기":"Remove all AI","스파이크 설치 중":"Planting spike","초대 코드로 참가":"Join with code","나가기 (ESC)":"Leave (ESC)","이 요원으로 시작":"Start with this agent","화면을 클릭하세요":"Click the screen","길게 — 설치/해제":"Hold — plant/defuse","빈 자리 전부 AI":"Fill empty slots with AI","커스텀 게임 만들기":"Create custom game","시점 고정/해제 ·":"Lock/unlock view ·","이 요원으로 시작 ›":"Start with this agent ›","팀 안에서 중복 불가":"No duplicates within a team","비밀번호를 입력하세요":"Enter the password","비밀번호가 틀렸습니다":"Wrong password","클릭으로 아군 시점 전환":"Click to switch to a teammate's view","궁 사용 시 전체 화면 연출":"Full-screen effect on ultimates","화면 왼쪽 위에 초당 프레임":"Frames per second in the top left","피격·폭발 시 카메라 흔들림":"Camera shake on hits and blasts","숫자를 직접 입력해도 됩니다":"You can type numbers directly","빈 자리를 눌러 팀을 옮기고,":"Tap an empty slot to switch teams,","설정 (감도 · 모바일 조작)":"Settings (sensitivity · mobile controls)","마우스 대신 모바일 조작 쓰기":"Use mobile controls instead of a mouse","열네 명 중 한 명을 고르십시오":"Pick your agent","10개 맵 전부 새로 꾸몄습니다":"All maps redecorated","구매 단계에만 이용할 수 있습니다":"Only available during the buy phase","마우스를 고정해야 시야가 돌아갑니다":"Lock the mouse to look around","AI 대전 · 모드 5종 · 맵 10종":"Versus AI · 5 modes · 40 maps","순간이동 발판 · 여닫이 문 · 집라인":"Teleport pads · doors · ziplines","끄면 조이스틱과 터치 버튼이 사라집니다":"Turn off to hide the joystick and touch buttons","친구를 초대하고 빈자리는 AI로 채웁니다":"Invite friends; AI fills empty slots","오리지널 요원과 맵으로 제작된 팬 게임입니다":"A game with original agents and maps","맞힌 적 위로 준 피해가 뜬다 (머리는 노란색)":"Damage shows over enemies you hit (headshots in yellow)","프레임이 떨어지면 해상도를 잠깐 낮춰 끊김을 막는다":"Lowers resolution briefly when frames drop","신속플레이 · 스파이크 돌격 · 팀 데스매치 · 데스매치":"Swift · Spike Rush · Team Deathmatch · Deathmatch","좌클릭 / 우클릭 · 다음 아군 시점  ·  라운드 종료까지 대기":"Left / right click · next teammate · wait for the round to end","칸을 눌러 봇을 켜고 끕니다. 비워둔 자리는 아무도 안 들어갑니다.":"Tap a slot to toggle a bot. Empty slots stay empty.","요원 14명 · 모드 5종 · 맵 10종 · 게임 중 화면을 클릭하면 시야가 고정됩니다":"24 agents · 5 modes · 40 maps · click the screen in game to lock the view","사이트를 두고 벌이는 5대5 전술 교전. 열네 요원의 능력으로 각을 열고, 연막으로 시야를 지우고, 스파이크로 승부를 낸다.":"5v5 tactical fights over the sites. Open angles with abilities, blind with smokes, settle it with the spike.","점":"Dot","원":"Circle","색":"Color","플":"Plus","앉기":"Crouch","모양":"Shape","십자":"Cross","T자":"T-shape","길이":"Length","두께":"Thickness","간격":"Gap","장비":"Gear","무료":"Free","기본":"Basic","빡셈":"Brutal","빼기":"Remove","순한맛":"Mild","불투명도":"Opacity","비밀번호":"Password","AI 봇":"AI bot","가운데 점":"Center dot","요원 변경":"Change agent","신속플레이":"Swift play","₩ 무제한":"₩ Unlimited","경기 크레딧 무제한":"Unlimited match credits","검은 테두리":"Black outline","🎲 무작위":"🎲 Random","M · 닫기":"M · Close","경량 방어구":"Light armor","중형 방어구":"Heavy armor","선택한 요원":"Selected agent","조준점 기본값":"Default crosshair","치트 비밀번호":"Cheat code","근접 · 보조":"Melee · Sidearm","터치 버튼 크기":"Touch button size","움직이면 벌어짐":"Spreads when moving","요원 자동 배정":"Auto-assign agents","터치 버튼 투명도":"Touch button opacity","기관총 · 저격총":"Machine guns · Snipers","기관단총 · 산탄총":"SMGs · Shotguns","맵 40종 · 요원 24명":"40 maps · 24 agents","스물네 명 중 한 명을 고르십시오":"Pick one of 24 agents","AI 대전 · 모드 5종 · 맵 40종":"Versus AI · 5 modes · 40 maps","새 맵 30개와 새 요원 10명이 추가되었습니다":"30 new maps and 10 new agents","요원 24명 · 모드 5종 · 맵 40종 · 게임 중 화면을 클릭하면 시야가 고정됩니다":"24 agents · 5 modes · 40 maps · click the screen in game to lock the view","사이트를 두고 벌이는 5대5 전술 교전. 스물네 요원의 능력으로 각을 열고, 연막으로 시야를 지우고, 스파이크로 승부를 낸다.":"5v5 tactical fights over the sites. Open angles with 24 agents' abilities, blind with smokes, settle it with the spike.","구매 단계나 쓰러져 있을 때는 바로 바뀝니다. 교전 중에 고르면 다음 라운드(부활)부터 바뀝니다. 아군이 쓰는 요원은 고를 수 없고, 아군 AI가 쓰고 있으면 서로 바꿉니다.":"Changes at once during the buy phase or while dead; otherwise from the next round. You can't take a teammate's agent; a teammate bot swaps with you.","일반전":"Standard","신속전":"Swift","스파이크 돌격":"Spike Rush","팀 데스매치":"Team Deathmatch","데스매치":"Deathmatch","타격대":"Duelist","감시자":"Sentinel","척후대":"Initiator","전략가":"Controller","구매 단계":"Buy phase","교전 중":"Live","라운드 승리":"Round won","라운드 패배":"Round lost","승리!":"Victory!","패배":"Defeat","무승부":"Draw","스파이크 설치됨":"Spike planted","스파이크 해제됨":"Spike defused","스파이크 폭발":"Spike detonated","공격 시작":"Attackers start","수비 시작":"Defenders start","치트":"Cheats","방 설정":"Room settings","열기":"Open","틀렸습니다":"Wrong","치트 잠그기":"Lock cheats","치트가 열렸습니다 · 이번 라운드만":"Cheats unlocked · this round only","작은 지도에 적 표시":"Enemies on minimap","벽 너머 적 보기":"See enemies through walls","치트 모드":"Cheat mode","무적":"God mode","한 방 처치":"One-shot kills","탄약 무제한":"Unlimited ammo","반동 없음":"No recoil","내 이동 속도":"My move speed","내 연사 속도":"My fire rate","조준점":"Crosshair","감도":"Sensitivity","화질":"Quality","낮음":"Low","보통":"Normal","높음":"High","쉬움":"Easy","어려움":"Hard","켜기":"On","끄기":"Off","주무기":"Primary","보조무기":"Secondary","기관단총":"SMG","산탄총":"Shotgun","소총":"Rifle","저격총":"Sniper","기관총":"Machine gun","보조":"Sidearm","무제한":"Unlimited","대기실":"Lobby","방장":"Host","게스트":"Guest","플레이어":"Player","점수판":"Scoreboard","전투 기록":"Combat log"};
  const PAT = [
    [/^(\d+) 라운드 · 구매 단계$/, "Round $1 · Buy phase"],
    [/^\S+ 명 중 한 명을 고르십시오$/, "Pick your agent"],
    [/^사이트를 두고 벌이는 5대5 전술 교전\. \S+ 요원의 능력으로/, "5v5 tactical fights over the sites. Open angles with abilities, blind with smokes, settle it with the spike."],
    [/^요원 (\d+)명 · 모드 (\d+)종 · 맵 (\d+)종 · 게임 중 화면을 클릭하면 시야가 고정됩니다$/, "$1 agents · $2 modes · $3 maps · click the screen in game to lock the view"],
    [/^맵 (\d+)종 · 요원 (\d+)명$/, "$1 maps · $2 agents"],
    [/^새 맵 (\d+)개와 새 요원 (\d+)명이 추가되었습니다$/, "$1 new maps and $2 new agents"],
    [/^(\d+) 라운드$/, "Round $1"],
    [/^라운드 승리 · (.+)$/, "Round won · $1"],
    [/^라운드 패배 · (.+)$/, "Round lost · $1"],
    [/^(\d+)초$/, "$1s"],
    [/^피해 (\S+) · 연사 (\d+) · 탄창 (\d+)( · 보유중)?$/, (m, d, r, g, o) => `Dmg ${d} · RPM ${r} · Mag ${g}${o ? " · Owned" : ""}`],
    [/^방어구 (\d+)$/, "Armor $1"],
    [/^보유 (\d+)\/(\d+)$/, "Owned $1/$2"],
    [/^재사용 (\d+)초$/, "Cooldown $1s"],
    [/^궁극기 · 충전 (\d+)$/, "Ultimate · $1 points"],
    [/^최대 (\d+)회$/, "Up to $1"],
    [/^(\d+)선취$/, "First to $1"],
    [/^(\d+)선승 · (\d+):(\d+)면 서든데스$/, "First to $1 · sudden death at $2:$3"],
    [/^(.+) \(나\)$/, "$1 (me)"],
    [/^(.+) · ([A-C]) 사이트$/, "$1 · Site $2"],
    [/^(타격대|감시자|척후대|전략가) · (.+)$/, (m, r, x) => ({ 타격대: "Duelist", 감시자: "Sentinel", 척후대: "Initiator", 전략가: "Controller" })[r] + " · " + x],
  ];
  // Labels added after the first pass: the graphics presets and motion levels in the settings, the controls hint of the
  // HUD, and the equipment shop (js/weapon-shop.js). Weapon, agent and skin names stay as they are.
  Object.assign(DICT, {
    "휴대폰": "Phone", "성능": "Performance", "비주얼": "Visual", "최고": "Ultra",
    "선명한 화면 유지 · 가벼운 맵·재질, 그림자·후처리 끄기": "Sharp picture · light maps and materials, shadows and post-processing off",
    "프레임 우선 · 해상도 절약, 그림자·후처리 끄기, 가벼운 이펙트": "Frame rate first · saves resolution, shadows and post-processing off, light effects",
    "선명한 화면 · 상세 총기, 고해상도 그림자, 조명·잔광 켜기": "Sharp picture · detailed guns, high-resolution shadows, lights and glow on",
    "최대 품질 · 높은 화면 해상도, 정밀 그림자, 풍부한 조명·이펙트": "Best quality · high render resolution, precise shadows, rich lights and effects",
    "흔들림·번쩍임 없음, 능력 효과만 표시": "No shake or flashes, only ability effects",
    "멀미가 있거나 화면이 어지러울 때": "If you get motion sick or the screen feels busy",
    "차분하게": "Calm", "입자와 번쩍임이 크게": "Bigger particles and flashes", "과하게 화려 — 시야를 가릴 수 있음": "Very flashy — can block your view",
    "앉기 ·": "Crouch ·", "무기 (휠) ·": "Weapons (wheel) ·", "또는": "or",
    "길게 — 설치 (사이트 안, 멈춘 채로) ·": "Hold — plant (inside a site, standing still) ·", "길게 — 해제": "Hold — defuse",
    "준비를 마치고": "Get ready for", "다음 라운드로": "the next round", "경기 크레딧": "Match credits",
    "스킬 & 장비": "Skills & gear", "나이프는 기본 보유": "Knife included", "기본 지급": "Included", "보유 중": "Owned",
    "보조 무기": "Sidearms", "저격소총": "Sniper rifles", "중화기": "Heavy weapons", "스킬": "Skill", "수류탄": "Grenade",
    "기본 스킨": "Default skin", "사격 방식": "Fire mode", "로켓": "Rocket", "점사": "Burst", "자동": "Auto", "단발": "Single shot",
    "연사 속도": "Fire rate", "탄창": "Magazine", "사거리": "Range", "보유": "Owned", "최대": "Max",
    "타격 부위": "Hit zone", "머리": "Head", "몸통": "Body", "기본 피해": "Base damage", "산탄 1발 기준": "Per pellet",
    "최대 폭발 피해": "Max blast damage", "발사당 산탄": "Pellets per shot", "기본 피해 · 거리 보정 전": "Base damage · before range falloff",
    "구매 단계 · 전투를 준비하세요": "Buy phase · get ready to fight", "총 위에 마우스 · 클릭하여 구매": "Hover a gun · click to buy",
    "구매하면 바로 장착합니다": "Equipped as soon as you buy it", "구매 즉시 보유 장비에 추가됩니다": "Added to your gear as soon as you buy it",
    "이미 보유한 무기입니다": "You already own this weapon", "최대로 보유하고 있습니다": "You already hold the maximum",
    "다음 라운드에 구매할 수 있습니다": "You can buy next round", "호스트의 구매 확인을 기다리는 중입니다": "Waiting for the host to confirm the purchase",
    "구매 결과가 확인되지 않았습니다. 보유 장비와 연결 상태를 확인하세요.": "The purchase could not be confirmed. Check your gear and your connection.",
    "원본 모델 불러오는 중…": "Loading the original model…", "모델을 불러오지 못했습니다": "Could not load the model",
    "선택한 장비 정보": "Selected gear details", "선택한 총의 실제 장착 모델": "In-hand model of the selected gun",
    "받는 피해를 흡수해 생존을 돕습니다. 이미 더 높은 방어구를 보유했다면 추가 구매할 수 없습니다.": "Absorbs incoming damage. You cannot buy it if you already wear better armor.",
    "G로 핀을 뽑고 발사 버튼으로 던집니다. 최대 2개까지 보유합니다.": "Press G to pull the pin and fire to throw. Hold up to 2.",
    "라운드에서 사용할 스킬 충전을 추가합니다.": "Adds a charge of this skill for the round.",
    "전투 상황에 맞춰 사용하는 무기입니다.": "A weapon for the fight at hand.",
    "가벼운 기본 보조 무기. 빠르게 꺼내 근거리와 중거리에 대응합니다.": "A light starter sidearm. Quick to draw for close and medium range.",
    "소음기를 장착한 정밀 보조 무기. 조용한 사격과 정확한 조준에 적합합니다.": "A suppressed precision sidearm for quiet, accurate shots.",
    "한 발의 위력이 높은 보조 무기. 정확히 조준해 강력한 피해를 줍니다.": "A hard-hitting sidearm. Aim carefully for heavy damage.",
    "짧은 거리에서 여러 산탄을 발사하는 보조 무기. 모퉁이와 좁은 통로에서 유용합니다.": "A sidearm that fires several pellets up close. Good around corners and in tight passages.",
    "자동 사격이 가능한 보조 무기. 가까운 거리에서 빠르게 연사합니다.": "A full-auto sidearm that sprays fast at close range.",
    "빠른 연사로 근거리 교전에 대응하는 기관단총입니다.": "A submachine gun for close fights, with a fast fire rate.",
    "소음기를 갖춘 기관단총. 근거리에서 빠른 연사로 대응합니다.": "A suppressed submachine gun for fast fire up close.",
    "연속 사격이 가능한 산탄총. 가까운 거리에서 여러 탄환이 한 번에 퍼집니다.": "A full-auto shotgun. Several pellets spread at once at close range.",
    "여러 산탄을 한 번에 발사하는 단발 산탄총. 가까운 거리의 교전에 적합합니다.": "A single-shot shotgun that fires several pellets at once. Made for close fights.",
    "정확한 조준과 강한 한 발을 갖춘 자동 소총. 중거리 교전에 적합합니다.": "An automatic rifle with accurate aim and strong shots. Good at medium range.",
    "빠른 연사와 소음기를 갖춘 자동 소총. 이동 후 짧게 끊어 쏘며 사용합니다.": "A suppressed automatic rifle with a fast fire rate. Fire in short bursts after moving.",
    "세 발씩 점사하는 소총. 연속 발사 사이에 조준을 가다듬어 사용합니다.": "A rifle that fires three-round bursts. Settle your aim between bursts.",
    "소음기와 30발 탄창을 갖춘 자동 소총. 사격을 누르고 있으면 계속 연사합니다.": "A suppressed automatic rifle with a 30-round magazine. Hold fire to keep shooting.",
    "스코프를 갖춘 단발 정찰 소총. 중장거리에서 한 발씩 정밀 사격합니다.": "A scoped single-shot scout rifle. Precise shots at medium to long range.",
    "짧은 총몸 뒤에 탄창을 배치한 코멧 자동 소총. 30발 탄창과 빠른 연사로 근거리·중거리 교전에 대응합니다.": "The Comet automatic rifle with its magazine behind a short body. A 30-round magazine and fast fire for close and medium fights.",
    "넉넉한 탄창으로 긴 시간 사격하는 기관총. 진입로와 좁은 구역을 견제합니다.": "A machine gun with a big magazine for long fire. Holds down entrances and tight areas.",
    "두 발을 빠르게 이어 쏘는 저격소총. 짧은 틈에 집중 사격할 수 있습니다.": "A sniper rifle that fires two quick shots. Focus fire in a short window.",
    "한 발의 위력이 높은 장거리 저격소총. 조준경을 사용해 멀리 있는 적을 노립니다.": "A hard-hitting long-range sniper rifle. Use the scope to pick off distant enemies.",
    "폭발 피해를 주는 로켓 발사기. 한 발을 발사한 뒤 재장전해야 합니다.": "A rocket launcher with explosive damage. Reload after every shot.",
  });
  PAT.push(
    [/^(최소|아주 약하게|약하게|보통|강하게|최대) \((\d+)%\)$/, (m, name, n) => ({ 최소: "Minimum", "아주 약하게": "Very low", 약하게: "Low", 보통: "Normal", 강하게: "High", 최대: "Maximum" })[name] + " (" + n + "%)"],
    [/^총기 (\d+)종 · 칼 별도$/, "$1 guns · knife separate"],
    [/^([\d,]+) 크레딧$/, "$1 credits"],
    [/^([\d,]+) 크레딧이 부족합니다$/, "$1 credits short"],
    [/^구매 · (.+)$/, (m, price) => "Buy · " + (tr(price) || price)],
    [/^(\d+)\/(\d+) · (.+)$/, (m, a, b, price) => a + "/" + b + " · " + (tr(price) || price)],
    [/^방어구 (\d+) 제공$/, "Gives $1 armor"],
    [/^보유 (\d+) \/ (\d+)$/, "Owned $1 / $2"],
    [/^([\d.]+)발\/초$/, "$1 rounds/s"],
    [/^(\d+)발$/, "$1 rounds"],
    [/^(.+) 구매 완료$/, "$1 bought"],
    [/^(.+) 구매 요청 중…$/, "Buying $1…"]
  );
  const HANGUL = /[가-힣]/;
  const NORM = {};
  for (const k in DICT) NORM[k.replace(/\s+/g, " ")] = DICT[k];
  function tr(s) {
    const t = s.trim();
    if (!t || !HANGUL.test(t)) return null;
    if (DICT[t]) return s.replace(t, DICT[t]);
    const nt = t.replace(/\s+/g, " ");
    if (NORM[nt]) return s.replace(t, NORM[nt]);
    for (const [re, to] of PAT) if (re.test(t)) return s.replace(t, String(re).includes("$/") ? t.replace(re, to) : typeof to === "string" ? to : t.replace(re, to));
    return null;
  }
  function walk(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const p = n.parentNode;
      if (p && (p.nodeName === "SCRIPT" || p.nodeName === "STYLE")) continue;
      const v = tr(n.nodeValue);
      v && v !== n.nodeValue && (n.nodeValue = v);
    }
    // the added element's own attributes too (a button made with a title), and what a screen reader reads
    const ATTR = "[placeholder],[title],[aria-label]";
    root.querySelectorAll && [...(root.matches && root.matches(ATTR) ? [root] : []), ...root.querySelectorAll(ATTR)].forEach((e) => ["placeholder", "title", "aria-label"].forEach((a) => { const v = e.getAttribute(a); const t = v && tr(v); t && e.setAttribute(a, t); }));
  }
  if ("en" === LANG) {
    document.documentElement.lang = "en";
    walk(document.body);
    new MutationObserver((ms) => {
      for (const m of ms) {
        if ("attributes" === m.type) {
          // a title or label set after the element was added (the translated value has no Korean left, so this settles)
          const v = tr(m.target.getAttribute(m.attributeName) || "");
          v && m.target.setAttribute(m.attributeName, v);
        } else if ("characterData" === m.type) {
          const v = tr(m.target.nodeValue);
          v && v !== m.target.nodeValue && (m.target.nodeValue = v);
        } else m.addedNodes.forEach((n) => (3 === n.nodeType ? (() => { const v = tr(n.nodeValue); v && (n.nodeValue = v); })() : 1 === n.nodeType && walk(n)));
      }
    }).observe(document.body, { childList: !0, subtree: !0, characterData: !0, attributes: !0, attributeFilter: ["placeholder", "title", "aria-label"] });
  }
  const L = (ko, en) => ("en" === LANG ? en : ko);

  // ── a full-screen notice (ban, maintenance) ──
  function wall(title, text) {
    let d = $("acct-wall");
    if (!d) {
      d = document.createElement("div");
      d.id = "acct-wall";
      d.style.cssText = "position:fixed;inset:0;z-index:999;background:rgba(6,8,12,.96);display:flex;align-items:center;justify-content:center;text-align:center;color:#e8edf4;font-family:inherit;padding:20px";
      document.body.appendChild(d);
    }
    d.innerHTML = `<div style="max-width:420px"><div style="font-size:22px;font-weight:900;color:#ff9aa5">${title}</div><p style="color:#8a97ab;margin:12px 0 18px;line-height:1.7">${text}</p><a href="./" style="color:#ffc849">${L("처음 화면으로", "Back to home")}</a></div>`;
    try {
      typeof netShutdown === "function" && NET.mode !== "solo" && netShutdown();
      world.phase = "menu";
      document.exitPointerLock();
    } catch (e) {}
  }
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const banText = (b) => (b.reason ? L("사유: ", "Reason: ") + esc(b.reason) + "<br>" : "") + (b.until ? new Date(b.until).toLocaleString() + L(" 까지", "") : L("영구", "Permanent"));

  // ── the owner's settings ──
  function applyCfg(c) {
    window.SERVER_CFG = c;
    window.POGU && POGU.setPool();
    dispatchEvent(new CustomEvent("server-config", { detail: c }));
    if (!c || !c.game) return;
    if (c.game.maintenance) wall(L("점검 중", "Maintenance"), esc(c.game.maintenanceMsg));
    let n = $("acct-notice");
    // an X sets it aside for this visit (a changed announcement comes back)
    let closed = "";
    try { closed = sessionStorage.getItem("lgp_notice_x") || ""; } catch (e) {}
    if (c.game.announcement && closed !== c.game.announcement) {
      if (!n) {
        n = document.createElement("div");
        n.id = "acct-notice";
        n.style.cssText = "position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:60;max-width:min(680px,92vw);display:flex;align-items:center;gap:8px;padding:7px 8px 7px 14px;border-radius:10px;background:rgba(20,16,4,.88);border:1px solid #5c4b1f;color:#ffc849;font-size:12.5px;pointer-events:none";
        n.innerHTML = '<span></span><button type="button" aria-label="' + L("닫기", "Close") + '" style="pointer-events:auto;flex:none;min-width:28px;min-height:28px;border-radius:8px;border:1px solid #5c4b1f;background:transparent;color:inherit;font:inherit;cursor:pointer">✕</button>';
        n.querySelector("button").onclick = () => { try { sessionStorage.setItem("lgp_notice_x", n.firstChild.dataset.t || ""); } catch (e) {} n.remove(); };
        document.body.appendChild(n);
      }
      n.firstChild.dataset.t = c.game.announcement;
      n.firstChild.textContent = "📢 " + c.game.announcement;
    } else n && n.remove();
  }
  async function loadCfg() {
    try {
      applyCfg((await api("config")).config);
    } catch (e) {}
  }
  // the notice only on the title and lobby screens
  setInterval(() => {
    const n = $("acct-notice");
    n && (n.style.display = "menu" === world.phase ? "" : "none");
  }, 700);

  // ── who am I ──
  async function checkMe() {
    const requestToken = token();
    if (!requestToken) return;
    try {
      const j = await api("me", { token: requestToken });
      if (!sessionMatches(requestToken)) return;
      if (online && !gatePassed()) return; // an old saved sign-in counts for nothing until the login screen
      S.user = j.user;
      localStorage.setItem("lgp_session", JSON.stringify(S));
      localStorage.setItem("lgp_name", j.user.id);
      window.ADMIN_GRANTED = !!j.user.admin;
      window.IS_OWNER = !!j.user.owner;
      S.atoken = j.atoken || "";
      localStorage.setItem("lgp_session", JSON.stringify(S));
    } catch (e) {
      if (!sessionMatches(requestToken)) return;
      if (e.status === 401) {
        S = null; localStorage.removeItem("lgp_session"); sessionStorage.removeItem("lgp_gate");
        location.replace("./"); return;
      }
      e.ban && wall(L("이용이 제한되었습니다", "Access restricted"), banText(e.ban));
    }
  }
  if (S && S.user && S.user.id) {
    try {
      localStorage.setItem("lgp_name", S.user.id);
    } catch (e) {}
  }
  if (online) {
    loadCfg();
    checkMe();
    setInterval(loadCfg, 180000);
    setInterval(checkMe, 300000);
  }

  // ── relay servers (TURN) for networks that cannot connect directly ──
  let ICE = [];
  const iceReady = online
    ? api("ice")
        .then((j) => {
          ICE = (j.iceServers || []).filter((x) => x && x.urls);
          window.NET_RELAY = !!j.relay;
        })
        .catch(() => {})
    : Promise.resolve();
  const _po = peerOpts;
  peerOpts = function () {
    const o = _po.apply(this, arguments);
    try {
      ICE.length && (o.config = Object.assign({}, o.config, { iceServers: (o.config && o.config.iceServers ? o.config.iceServers : []).concat(ICE) }));
    } catch (e) {}
    return o;
  };
  // making or joining a room waits a moment for the relay list
  const waitIce = () => Promise.race([iceReady, new Promise((r) => setTimeout(r, 2500))]);
  const _cr = createRoom;
  createRoom = async function () {
    const intent = NET.intent = (NET.intent || 0) + 1;
    await waitIce();
    if (NET.intent === intent) return _cr.apply(this, arguments);
  };
  const _jr = joinRoom;
  joinRoom = async function () {
    const intent = NET.intent = (NET.intent || 0) + 1;
    await waitIce();
    if (NET.intent === intent) return _jr.apply(this, arguments);
  };

  // ── a login every time the game is opened ──
  // A sign-in saved from an earlier visit no longer lets anyone straight in:
  // each new visit asks for the id and password again (a new id signs up),
  // so the owner and everyone else are always who they say they are.
  // Making or joining a room waits until this is done.
  const CHO = "r R s e E f a q Q t T d w W c z x v g".split(" "), JUNG = "k o i O j p u P h hk ho hl y n nj np nl b m ml l".split(" "), JONG = ",r,R,rt,s,sw,sg,e,f,fr,fa,fq,ft,fx,fv,fg,a,q,qt,t,T,d,w,c,z,x,v,g".split(",");
  const JAMO = { ㄱ: "r", ㄲ: "R", ㄳ: "rt", ㄴ: "s", ㄵ: "sw", ㄶ: "sg", ㄷ: "e", ㄸ: "E", ㄹ: "f", ㄺ: "fr", ㄻ: "fa", ㄼ: "fq", ㄽ: "ft", ㄾ: "fx", ㄿ: "fv", ㅀ: "fg", ㅁ: "a", ㅂ: "q", ㅃ: "Q", ㅄ: "qt", ㅅ: "t", ㅆ: "T", ㅇ: "d", ㅈ: "w", ㅉ: "W", ㅊ: "c", ㅋ: "z", ㅌ: "x", ㅍ: "v", ㅎ: "g", ㅏ: "k", ㅐ: "o", ㅑ: "i", ㅒ: "O", ㅓ: "j", ㅔ: "p", ㅕ: "u", ㅖ: "P", ㅗ: "h", ㅘ: "hk", ㅙ: "ho", ㅚ: "hl", ㅛ: "y", ㅜ: "n", ㅝ: "nj", ㅞ: "np", ㅟ: "nl", ㅠ: "b", ㅡ: "m", ㅢ: "ml", ㅣ: "l" };
  const keysOf = (s) => [...s].map((c) => { const n = c.charCodeAt(0) - 0xac00; if (n >= 0 && n < 11172) return CHO[Math.floor(n / 588)] + JUNG[Math.floor((n % 588) / 28)] + JONG[n % 28]; return JAMO[c] || c; }).join("");
  const device = (() => {
    try {
      let d = localStorage.getItem("lgp_device");
      d || ((d = "d" + crypto.getRandomValues(new Uint32Array(3)).join("").slice(0, 24)), localStorage.setItem("lgp_device", d));
      return d;
    } catch (e) {
      return "d" + Date.now();
    }
  })();
  function gatePassed() {
    try {
      const g = sessionStorage.getItem("lgp_gate");
      return token() ? g === token() : "offline" === g; // "offline": the homepage's guest while the account server is down
    } catch (e) {
      return !1;
    }
  }
  const gateOk = gatePassed;
  let GATE = null;
  const queued = [];
  function openGate() {
    if (GATE) return;
    GATE = document.createElement("div");
    GATE.id = "acct-gate";
    GATE.innerHTML = `<form class="ag-box" autocomplete="on" onsubmit="return false">
  <div class="ag-logo">13</div>
  <div class="ag-sub">${L("로그인하고 시작하세요", "Sign in to play")}</div>
  <input id="ag-id" name="username" autocomplete="username" maxlength="16" placeholder="${L("아이디", "ID")}">
  <input id="ag-pw" name="password" type="password" autocomplete="current-password" maxlength="64" placeholder="${L("비밀번호", "Password")}">
  <button id="ag-go" type="button">${L("로그인 / 가입", "Sign in / Sign up")}</button>
  <button id="ag-guest" type="button" class="ag-ghost">${L("게스트로 하기", "Play as guest")}</button>
  <div id="ag-err"></div>
  <div class="ag-note">${L("처음이면 쓰고 싶은 아이디·비밀번호를 넣으면 바로 가입됩니다.", "New here? Pick an ID and password and you are signed up.")}</div>
</form>`;
    document.body.appendChild(GATE);
    const id = $("ag-id"),
      pw = $("ag-pw");
    try {
      id.value = (S && S.user && !S.user.guest && S.user.id) || localStorage.getItem("lgp_name") || "";
    } catch (e) {}
    id.setAttribute("aria-label", L("아이디", "ID"));
    pw.setAttribute("aria-label", L("비밀번호", "Password"));
    (id.value ? pw : id).focus();
    $("ag-go").onclick = () => signIn(!1);
    $("ag-guest").onclick = () => signIn(!0);
    pw.onkeydown = (e) => {
      if ("Enter" === e.key) signIn(!1);
    };
    id.onkeydown = (e) => {
      if ("Enter" === e.key) pw.focus();
    };
    try {
      document.exitPointerLock();
    } catch (e) {}
  }
  async function signIn(guest) {
    if ($("ag-go").disabled) return;
    const err = $("ag-err");
    err.textContent = "";
    $("ag-go").disabled = $("ag-guest").disabled = !0;
    try {
      const j = guest ? await api("guest", { device }) : await api("auth", { id: $("ag-id").value.trim(), pw: keysOf($("ag-pw").value), device });
      S = { token: j.token, user: j.user, atoken: j.atoken || "" };
      localStorage.setItem("lgp_session", JSON.stringify(S));
      localStorage.setItem("lgp_name", j.user.id);
      sessionStorage.setItem("lgp_gate", j.token);
      // Account-scoped modules captured their cache keys during boot. Reload
      // before any queued action or old account request can use the new token.
      const pending = window.__PENDING_ROOM;
      if (pending) history.replaceState(null, "", location.pathname + "?room=" + encodeURIComponent(pending));
      if (typeof netShutdown === "function") netShutdown();
      location.reload();
    } catch (e) {
      if (e.ban) return wall(L("이용이 제한되었습니다", "Access restricted"), banText(e.ban));
      err.textContent = "offline" === e.message ? L("서버에 연결할 수 없습니다", "Cannot reach the server") : e.message;
    } finally {
      $("ag-go") && ($("ag-go").disabled = $("ag-guest").disabled = !1);
    }
  }
  if (online && !gateOk() && !window.__TO_HOME) openGate(); // normally the homepage has done this already
  for (const name of ["createRoom", "joinRoom"]) {
    const orig = window[name];
    window[name] = function () {
      const args = arguments,
        self = this;
      if (GATE) return void queued.push(() => window[name].apply(self, args));
      return orig.apply(this, arguments);
    };
  }
  const gs = document.createElement("style");
  gs.textContent = `
#acct-gate{position:fixed;inset:0;z-index:1000;background:radial-gradient(ellipse at 50% 30%,rgba(255,200,73,.08),transparent 60%),rgba(6,8,12,.97);display:flex;justify-content:center;padding:16px;font-family:inherit;overflow-y:auto}
#acct-gate .ag-box{width:min(340px,100%);display:flex;flex-direction:column;gap:10px;text-align:center;margin:auto 0}
#acct-gate .ag-logo{font-size:56px;font-weight:900;letter-spacing:-2px;color:#ffc849;line-height:1}
#acct-gate .ag-sub{color:#8a97ab;font-size:13px;margin-bottom:6px}
#acct-gate input{padding:12px 14px;border-radius:12px;border:1px solid #2a3140;background:rgba(255,255,255,.05);color:#fff;font-family:inherit;font-size:15px}
#acct-gate input:focus{outline:none;border-color:#ffc849}
#acct-gate button{padding:12px;border-radius:12px;border:0;background:#ffc849;color:#14100a;font-family:inherit;font-size:15px;font-weight:800;cursor:pointer}
#acct-gate button:disabled{opacity:.6}
#acct-gate .ag-ghost{background:transparent;border:1px solid #2a3140;color:#c9d2de;font-weight:600}
#acct-gate #ag-err{min-height:18px;color:#ff8a8a;font-size:13px}
#acct-gate .ag-note{color:#6b7789;font-size:12px;line-height:1.6}
@media (max-height:460px){#acct-gate{padding:10px}#acct-gate .ag-box{gap:7px}#acct-gate .ag-logo{font-size:34px}#acct-gate .ag-sub{margin-bottom:0}#acct-gate input,#acct-gate button{padding:9px 12px}}`;
  document.head.appendChild(gs);

  // ── a room opened from the homepage ──
  const META = { name: params.get("rn") || "", ch: params.get("ch") || "s1", priv: "1" === params.get("priv") };

  // ── the mobile-only server: phones and the app only ──
  const IS_MOBILE = (() => {
    try {
      if ("app" === params.get("source")) sessionStorage.setItem("lgp_app", "1");
      return (
        "1" === sessionStorage.getItem("lgp_app") ||
        /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
        (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent)) ||
        matchMedia("(pointer: coarse)").matches ||
        matchMedia("(display-mode: standalone)").matches ||
        matchMedia("(display-mode: fullscreen)").matches ||
        document.referrer.startsWith("android-app://")
      );
    } catch (e) {
      return !1;
    }
  })();
  window.IS_MOBILE = IS_MOBILE;
  const chMobile = (id) => {
    const c = ((window.SERVER_CFG && SERVER_CFG.channels) || []).find((x) => x.id === id);
    return c ? !!c.mobile : "mobile" === id;
  };
  if (chMobile(META.ch) && !IS_MOBILE) {
    // a PC cannot open a room there
    META.ch = "s1";
    setTimeout(() => banner(L("모바일 전용 서버는 폰·앱에서만 방을 만들 수 있어 서버 1에 열었습니다", "Mobile-only server is for phones and the app; opened on Server 1"), "#ffc849"), 2500);
  }
  // a guest says what it plays on; a mobile-only host turns PCs away
  const _sa = sendAction;
  sendAction = function (m) {
    if (m && "hello" === m.t) m = Object.assign({}, m, { mob: IS_MOBILE });
    return _sa.call(this, m);
  };
  const _oaM = NET.onAction;
  NET.onAction = (peer, msg) => {
    if (msg && "hello" === msg.t && "host" === NET.mode && chMobile(META.ch) && !msg.mob) {
      try {
        sendEventTo(peer, { t: "kicked", why: "mobile", msg: L("📱 모바일 전용 서버의 방입니다. 폰이나 앱으로 들어와 주세요.", "📱 This room is on the mobile-only server. Join from a phone or the app.") });
      } catch (e) {}
      setTimeout(() => {
        try {
          const c = NET.conns.get(peer);
          c && ("function" == typeof c.close ? c.close() : ["state", "event"].forEach((k) => c[k] && c[k].open && c[k].close()));
        } catch (e) {}
      }, 400);
      return;
    }
    return _oaM(peer, msg);
  };
  if ("1" === params.get("create")) {
    const go = () => {
      if (typeof createRoom !== "function" || typeof MAP_LIST === "undefined") return setTimeout(go, 300);
      setTimeout(() => createRoom(), 500);
    };
    go();
  }

  // ── the room list: report, and take the owner's orders ──
  let reported = null,
    hb = 0;
  const memberByName = (n) => {
    for (const [peer, m] of room.members) if (m.name === n) return peer;
    return null;
  };
  function kick(peer, why) {
    if (!peer) return;
    if (peer === NET.id) return closeRoom(why);
    try {
      sendEventTo(peer, { t: "kicked", msg: why });
    } catch (e) {}
    setTimeout(() => {
      try {
        const c = NET.conns.get(peer);
        c && ("function" == typeof c.close ? c.close() : ["state", "event"].forEach((k) => c[k] && c[k].open && c[k].close()));
      } catch (e) {}
      try {
        room.started ? leaveInProgress(peer) : lobbyRemove(peer);
        room.started || (sendEventAll(lobbySnapshot()), renderLobby(lobbySnapshot()));
      } catch (e) {}
    }, 300);
  }
  function closeRoom(why) {
    try {
      sendEventAll({ t: "kicked", msg: why });
    } catch (e) {}
    setTimeout(() => {
      try {
        netShutdown();
      } catch (e) {}
      world.phase = "menu";
      try {
        $("lobby").hidden = !0;
        hideAll();
        show("s-title");
        netAlert(why);
      } catch (e) {}
    }, 300);
  }
  function move(peer, team) {
    if (!peer || room.started || !room.slots[team]) return;
    let i = room.slots[team].indexOf(null);
    if (i < 0) (i = room.slots[team].indexOf("ai")), i >= 0 && (room.slots[team][i] = null);
    if (i < 0) return;
    lobbyMove(peer, team, i) && (sendEventAll(lobbySnapshot()), renderLobby(lobbySnapshot()));
  }
  function runCmd(c) {
    const who = c.name ? memberByName(c.name) : null;
    switch (c.cmd) {
      case "kick":
        kick(who, L("운영자가 방에서 내보냈습니다", "You were removed from the room by the operator"));
        break;
      case "move":
        move(who, "def" === c.team ? "def" : "atk");
        break;
      case "msg":
        try {
          sendEventAll({ t: "round", msg: "📢 " + c.text, color: "#ffc849" });
        } catch (e) {}
        banner("📢 " + c.text, "#ffc849");
        break;
      case "close":
        closeRoom(L("운영자가 방을 닫았습니다", "The operator closed this room"));
        break;
      default:
        // health, kill, unkillable, pin, cheats: the owner module does these
        window.OWNER_UI && OWNER_UI.byName(c);
    }
  }
  async function beat() {
    if (!online || "host" !== NET.mode || !NET.room || "open" !== NET.status || !token()) return;
    const code = NET.room, owner = NET.peer, ownerToken = token();
    const players = [...room.members.values()].map((m) => m.name);
    try {
      const j = await api("room_up", {
        token: ownerToken,
        code,
        name: META.name || L(myName() + "의 방", myName() + "'s room"),
        ch: META.ch,
        private: META.priv && !room.ranked,
        ranked: !!room.ranked,
        mode: room.mode,
        map: room.map,
        players,
        max: 2 * ("function" == typeof window.MAP_SIZE ? MAP_SIZE(room.map) : 5),
        state: room.started ? "live" : "lobby",
      });
      if (NET.mode !== "host" || NET.room !== code || NET.peer !== owner || !sessionMatches(ownerToken)) return;
      reported = code;
      j.config && applyCfg(Object.assign({}, window.SERVER_CFG || {}, j.config));
      (j.cmds || []).forEach(runCmd);
      (j.banned || []).forEach((n) => kick(memberByName(n), L("이용이 제한된 계정입니다", "This account is restricted")));
    } catch (e) {}
  }
  setInterval(() => {
    (hb += 1) >= ("host" === NET.mode && reported !== NET.room ? 1 : 20) && ((hb = 0), beat());
  }, 1000);
  const down = () => {
    if (!reported || !token()) return;
    const body = JSON.stringify({ token: token(), code: reported });
    try {
      navigator.sendBeacon ? navigator.sendBeacon(API + "?a=room_down", body) : api("room_down", JSON.parse(body));
    } catch (e) {}
    reported = null;
  };
  const _sd = netShutdown;
  netShutdown = function () {
    "host" === NET.mode && down();
    return _sd.apply(this, arguments);
  };
  addEventListener("pagehide", down);
  // a guest the owner removed
  const _oe = NET.onEvent;
  NET.onEvent = (e) => {
    if (e && "kicked" === e.t) {
      try {
        netShutdown();
      } catch (x) {}
      world.phase = "menu";
      try {
        $("lobby").hidden = !0;
        hideAll();
        show("s-title");
        netAlert(e.msg || "");
      } catch (x) {}
      // turned away from a mobile-only room: keep the reason on screen
      "mobile" === e.why &&
        setTimeout(() => {
          try {
            window.NET_RC && (NET_RC.quit = !0);
          } catch (x) {}
          wall(L("📱 모바일 전용 서버", "📱 Mobile-only server"), esc(e.msg || ""));
        }, 600);
      return;
    }
    return _oe(e);
  };

  // ── room rules the owner forces on every host ──
  const _sr = startRound;
  startRound = function () {
    const r = _sr.apply(this, arguments);
    try {
      const R = window.SERVER_CFG && window.SERVER_CFG.room;
      if (R && R.force && "client" !== NET.mode && window.ADMIN2) {
        const G = ADMIN2.G;
        R.roundT > 0 && (G.roundT = R.roundT);
        R.buyT > 0 && (G.buyT = R.buyT);
        R.matchT > 0 && (G.matchT = R.matchT);
        G.infAll = !!R.infAll;
        if (R.run > 0) (ADMIN.run = R.run), (ADMIN.walk = +((R.run * 4.3) / 10.6).toFixed(2)), (ADMIN.crouch = +((R.run * 4.7) / 10.6).toFixed(2));
        R.jumpV > 0 && (ADMIN.jumpV = R.jumpV);
        R.gravity > 0 && (ADMIN.gravity = R.gravity);
        R.aiSpeed > 0 && (ADMIN.aiSpeed = R.aiSpeed);
        ADMIN.freezeAI = !!R.freezeAI;
        ADMIN2.afterChange();
      }
    } catch (e) {}
    return r;
  };

  // ── experience after each match ──
  let lastPhase = "";
  const reportSession = GAME_MATCH_REPORT({ token, request: async (ownerToken) => {
    // a ranked ticket (the host's roster is in first, see 109-ranked-flow) the server
    // will not give still leaves a plain one (XP and gold, no RR)
    const ranked = window.RANKED && RANKED.flow ? await RANKED.flow.ticket(ownerToken, api) : null;
    return ranked || api("match_start", { token: ownerToken });
  }, onError: (e) => banner(e.message, "#ff8a9a") });
  const pendingKey = () => "lgp_reports:" + (S && S.user && S.user.id || "local");
  let pending = [];
  try { pending = JSON.parse(localStorage.getItem(pendingKey()) || "[]"); } catch (e) {}
  const keepReports = () => { try { localStorage.setItem(pendingKey(), JSON.stringify(pending.slice(-20))); } catch (e) { banner(L("보상 기록을 기기에 저장하지 못했습니다", "Could not save the reward retry record"), "#ff8a9a"); } };
  function beginReport(fresh = false) { if (online && !window.GAME_PRACTICE) return reportSession.begin(fresh); }
  let reporting = false;
  // A ranked report waits for the host's result (425); after this long it takes the plain reward (giveUp)
  const GIVE_UP_MS = 120000;
  async function flushReports() {
    if (reporting || !token() || !pending.length) return;
    reporting = true;
    const ownerToken = token();
    try {
      // `rk` and `at` are ours (a ranked ticket, when the report began); the server hears the rest
      const { rk, at, ...job } = pending[0];
      rk && at && Date.now() - at > GIVE_UP_MS && (job.giveUp = true);
      const j = await api("progress", { token: ownerToken, ...job });
      if (!sessionMatches(ownerToken)) return;
      pending.shift(); keepReports();
      S.user = j.user; S.hist = j.hist || S.hist;
      localStorage.setItem("lgp_session", JSON.stringify(S));
      const reward = j.levelUp ? L(`레벨 업! Lv.${j.user.level}`, `Level up! Lv.${j.user.level}`) : `+${j.gain} XP · 🪙 +${j.gold}`;
      banner(reward + (j.coinGain ? L(" · 초월 코인 +1", " · Transcendent coin +1") : ""), "#ffc849");
      dispatchEvent(new CustomEvent("account-reward", { detail: j }));
    } catch (e) {
      if (!sessionMatches(ownerToken)) return;
      // the host's result is not in yet: keep the report and ask again shortly
      if (425 === e.status) return void setTimeout(flushReports, 5000);
      if ([400, 409].includes(e.status) && !e.retryable) { pending.shift(); keepReports(); }
      banner(L("경기 보상: ", "Match reward: ") + e.message, "#ff8a9a");
    } finally { reporting = false; }
  }
  addEventListener("match-finished", async (e) => {
    const match = e.detail, ownerToken = token();
    if (!match || !ownerToken) return;
    const mt = await reportSession.finish();
    if (!mt || ownerToken !== token()) return;
    // the host's own report goes after the result it just attested
    window.RANKED && RANKED.flow && await RANKED.flow.settled();
    if (ownerToken !== token()) return;
    const rk = window.RANKED && RANKED.flow && RANKED.flow.isRanked(mt);
    pending.push({ kills: match.k, win: match.win, outcome: match.outcome, mt, match, ...(rk ? { rk: 1, at: Date.now() } : {}) });
    keepReports(); flushReports();
  });
  const _reportStart = lobbyStart;
  lobbyStart = function () { beginReport(true); return _reportStart.apply(this, arguments); };
  const _reportClientStart = clientBeginMatch;
  clientBeginMatch = function () { beginReport(true); return _reportClientStart.apply(this, arguments); };
  setInterval(() => {
    const ph = world.phase;
    if (["buy", "live"].includes(ph) && ["", "menu", "over"].includes(lastPhase)) beginReport();
    lastPhase = ph;
    pending.length && flushReports();
  }, 10000);

  // the level next to my name on the title screen
  setInterval(() => {
    try {
      if (!S || !S.user || "menu" !== world.phase) return;
      let b = $("acct-chip");
      if (!b) {
        b = document.createElement("a");
        b.id = "acct-chip";
        b.href = "./";
        b.style.cssText = "position:fixed;top:10px;right:12px;z-index:40;padding:6px 12px;border-radius:99px;background:rgba(20,25,34,.8);border:1px solid #2a3444;color:#e8edf4;font-size:12px;text-decoration:none";
        document.body.appendChild(b);
      }
      b.textContent = `${S.user.id} · Lv.${S.user.level || 1}`;
      b.style.display = $("s-title") && !$("s-title").hidden && getComputedStyle($("s-title")).display !== "none" ? "" : "none";
    } catch (e) {}
  }, 1000);
  window.ACCOUNT = { api, beat, runCmd, beginReport, flushReports, session: () => S, meta: META, chMobile, online };
})();
