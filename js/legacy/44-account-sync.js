
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
    if (!j.ok) throw Object.assign(new Error(j.error || "error"), { status: r.status, ban: j.ban, retryable: j.retryable, ko: j.errorKo });
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
  const DICT = {"휠":"Wheel","뒤로":"Back","확인":"OK","장전":"Reload","시점":"View","처치":"Kills","참가":"Join","조작":"Controls","사격":"Fire","사망":"Deaths","공격":"Attack","닫기":"Close","권총":"Pistol","승리":"Victory","모드":"Mode","조준":"Aim","설정":"Settings","점프":"Jump","상점":"Shop","소리":"Sound","준비":"Ready","체력":"Health","수비":"Defense","재장전":"Reload","좌클릭":"Left click","명중률":"Accuracy","우클릭":"Right click","마우스":"Mouse","그래픽":"Graphics","피해량":"Damage","방어구":"Armor","기본값":"Default","잠그기":"Lock","효과음":"Sound effects","라운드":"Round","나가기":"Leave","관리자":"Admin","맵 구경":"Map tour","하강 ·":"Down ·","처음으로":"Home","맵 장치":"Map gadgets","원점으로":"Reset view","사망 시":"When dead","걷기 ·":"Walk ·","무기 ·":"Weapons ·","사격 ·":"Fire ·","이동 ·":"Move ·","일시정지":"Paused","조준 ·":"Aim ·","능력 ·":"Abilities ·","계속하기":"Resume","상점 ·":"Shop ·","상승 ·":"Up ·","링크 복사":"Copy link","혼자 하기":"Play solo","전술 지도":"Tactical map","맵 바꾸기":"Change map","코드 복사":"Copy code","요원 선택":"Choose agent","피해 숫자":"Damage numbers","초대 코드":"Invite code","화면 연출":"Effects","장비 구매":"Buy gear","연출 강도":"Effect strength","터치 감도":"Touch sensitivity","AI 자리":"AI slot","설치/해제":"Plant/Defuse","교전 시작":"Start match","전투 투입":"Deploy","맵 디테일":"Map detail","다시 하기":"Play again","AI 난이도":"AI difficulty","새로워진 점":"What's new","사격 연습장":"Shooting range","커스텀 게임":"Custom game","전부 기본값":"Reset all","궁극기 컷인":"Ultimate cut-in","모바일 조작":"Mobile controls","관리자 모드":"Admin mode","FPS 표시":"Show FPS","화면 흔들림":"Screen shake","총성·처치음":"Gunshot & kill sounds","동적 해상도":"Dynamic resolution","마우스 감도":"Mouse sensitivity","닫기 (B)":"Close (B)","관전 준비 중":"Getting ready to spectate","속도 조절 ·":"Speed ·","관리자 조절판":"Admin panel","조준 시 감도":"Aim sensitivity","게임 모드 5종":"5 game modes","AI 전부 빼기":"Remove all AI","스파이크 설치 중":"Planting spike","초대 코드로 참가":"Join with code","나가기 (ESC)":"Leave (ESC)","이 요원으로 시작":"Start with this agent","화면을 클릭하세요":"Click the screen","길게 — 설치/해제":"Hold — plant/defuse","빈 자리 전부 AI":"Fill empty slots with AI","커스텀 게임 만들기":"Create custom game","시점 고정/해제 ·":"Lock/unlock view ·","이 요원으로 시작 ›":"Start with this agent ›","팀 안에서 중복 불가":"No duplicates within a team","비밀번호를 입력하세요":"Enter the password","비밀번호가 틀렸습니다":"Wrong password","클릭으로 아군 시점 전환":"Click to switch to a teammate's view","궁 사용 시 전체 화면 연출":"Full-screen effect on ultimates","화면 왼쪽 위에 초당 프레임":"Frames per second in the top left","피격·폭발 시 카메라 흔들림":"Camera shake on hits and blasts","숫자를 직접 입력해도 됩니다":"You can type numbers directly","빈 자리를 눌러 팀을 옮기고,":"Tap an empty slot to switch teams,","설정 (감도 · 모바일 조작)":"Settings (sensitivity · mobile controls)","마우스 대신 모바일 조작 쓰기":"Use mobile controls instead of a mouse","열네 명 중 한 명을 고르십시오":"Pick your agent","10개 맵 전부 새로 꾸몄습니다":"All maps redecorated","구매 단계에만 이용할 수 있습니다":"Only available during the buy phase","마우스를 고정해야 시야가 돌아갑니다":"Lock the mouse to look around","AI 대전 · 모드 5종 · 맵 10종":"Versus AI · 5 modes · 40 maps","순간이동 발판 · 여닫이 문 · 집라인":"Teleport pads · doors · ziplines","끄면 조이스틱과 터치 버튼이 사라집니다":"Turn off to hide the joystick and touch buttons","친구를 초대하고 빈자리는 AI로 채웁니다":"Invite friends; AI fills empty slots","오리지널 요원과 맵으로 제작된 팬 게임입니다":"A game with original agents and maps","맞힌 적 위로 준 피해가 뜬다 (머리는 노란색)":"Damage shows over enemies you hit (headshots in yellow)","프레임이 떨어지면 해상도를 잠깐 낮춰 끊김을 막는다":"Lowers resolution briefly when frames drop","신속플레이 · 스파이크 돌격 · 팀 데스매치 · 데스매치":"Swift · Spike Rush · Team Deathmatch · Deathmatch","좌클릭 / 우클릭 · 다음 아군 시점  ·  라운드 종료까지 대기":"Left / right click · next teammate · wait for the round to end","칸을 눌러 봇을 켜고 끕니다. 비워둔 자리는 아무도 안 들어갑니다.":"Tap a slot to toggle a bot. Empty slots stay empty.","요원 14명 · 모드 5종 · 맵 10종 · 게임 중 화면을 클릭하면 시야가 고정됩니다":"24 agents · 5 modes · 40 maps · click the screen in game to lock the view","사이트를 두고 벌이는 5대5 전술 교전. 열네 요원의 능력으로 각을 열고, 연막으로 시야를 지우고, 스파이크로 승부를 낸다.":"5v5 tactical fights over the sites. Open angles with abilities, blind with smokes, settle it with the spike.","점":"Dot","원":"Circle","색":"Color","플":"Plus","앉기":"Crouch","모양":"Shape","십자":"Cross","T자":"T-shape","길이":"Length","두께":"Thickness","간격":"Gap","장비":"Gear","무료":"Free","기본":"Basic","빡셈":"Brutal","빼기":"Remove","순한맛":"Mild","불투명도":"Opacity","비밀번호":"Password","AI 봇":"AI bot","가운데 점":"Center dot","요원 변경":"Change agent","신속플레이":"Swift play","₩ 무제한":"₩ Unlimited","경기 크레딧 무제한":"Unlimited match credits","검은 테두리":"Black outline","🎲 무작위":"🎲 Random","M · 닫기":"M · Close","경량 방어구":"Light armor","중형 방어구":"Heavy armor","선택한 요원":"Selected agent","조준점 기본값":"Default crosshair","근접 · 보조":"Melee · Sidearm","터치 버튼 크기":"Touch button size","움직이면 벌어짐":"Spreads when moving","요원 자동 배정":"Auto-assign agents","터치 버튼 투명도":"Touch button opacity","기관총 · 저격총":"Machine guns · Snipers","기관단총 · 산탄총":"SMGs · Shotguns","맵 40종 · 요원 24명":"40 maps · 24 agents","스물네 명 중 한 명을 고르십시오":"Pick one of 24 agents","AI 대전 · 모드 5종 · 맵 40종":"Versus AI · 5 modes · 40 maps","새 맵 30개와 새 요원 10명이 추가되었습니다":"30 new maps and 10 new agents","요원 24명 · 모드 5종 · 맵 40종 · 게임 중 화면을 클릭하면 시야가 고정됩니다":"24 agents · 5 modes · 40 maps · click the screen in game to lock the view","사이트를 두고 벌이는 5대5 전술 교전. 스물네 요원의 능력으로 각을 열고, 연막으로 시야를 지우고, 스파이크로 승부를 낸다.":"5v5 tactical fights over the sites. Open angles with 24 agents' abilities, blind with smokes, settle it with the spike.","구매 단계나 쓰러져 있을 때는 바로 바뀝니다. 교전 중에 고르면 다음 라운드(부활)부터 바뀝니다. 아군이 쓰는 요원은 고를 수 없고, 아군 AI가 쓰고 있으면 서로 바꿉니다.":"Changes at once during the buy phase or while dead; otherwise from the next round. You can't take a teammate's agent; a teammate bot swaps with you.","일반전":"Standard","신속전":"Swift","스파이크 돌격":"Spike Rush","팀 데스매치":"Team Deathmatch","데스매치":"Deathmatch","타격대":"Duelist","감시자":"Sentinel","척후대":"Initiator","전략가":"Controller","구매 단계":"Buy phase","교전 중":"Live","라운드 승리":"Round won","라운드 패배":"Round lost","승리!":"Victory!","패배":"Defeat","무승부":"Draw","스파이크 설치됨":"Spike planted","스파이크 해제됨":"Spike defused","스파이크 폭발":"Spike detonated","공격 시작":"Attackers start","수비 시작":"Defenders start","치트":"Cheats","방 설정":"Room settings","열기":"Open","치트 잠그기":"Lock cheats","작은 지도에 적 표시":"Enemies on minimap","벽 너머 적 보기":"See enemies through walls","치트 모드":"Cheat mode","무적":"God mode","한 방 처치":"One-shot kills","탄약 무제한":"Unlimited ammo","반동 없음":"No recoil","내 이동 속도":"My move speed","내 연사 속도":"My fire rate","조준점":"Crosshair","감도":"Sensitivity","화질":"Quality","낮음":"Low","보통":"Normal","높음":"High","쉬움":"Easy","어려움":"Hard","켜기":"On","끄기":"Off","주무기":"Primary","보조무기":"Secondary","기관단총":"SMG","산탄총":"Shotgun","소총":"Rifle","저격총":"Sniper","기관총":"Machine gun","보조":"Sidearm","무제한":"Unlimited","대기실":"Lobby","방장":"Host","게스트":"Guest","플레이어":"Player","점수판":"Scoreboard","전투 기록":"Combat log"};
  const PAT = [
    [/^(\d+) 라운드 · 구매 단계$/, "Round $1 · Buy phase"],
    [/^\S+ 명 중 한 명을 고르십시오$/, "Pick your agent"],
    [/^사이트를 두고 벌이는 5대5 전술 교전\. \S+ 요원의 능력으로/, "5v5 tactical fights over the sites. Open angles with abilities, blind with smokes, settle it with the spike."],
    [/^요원 (\d+)명 · 모드 (\d+)종 · 맵 (\d+)종 · 게임 중 화면을 클릭하면 시야가 고정됩니다$/, "$1 agents · $2 modes · $3 maps · click the screen in game to lock the view"],
    [/^맵 (\d+)종 · 요원 (\d+)명$/, "$1 maps · $2 agents"],
    [/^새 맵 (\d+)개와 새 요원 (\d+)명이 추가되었습니다$/, "$1 new maps and $2 new agents"],
    [/^(\d+) 라운드$/, "Round $1"],
    [/^라운드 승리 · (.+)$/, (m, r) => "Round won · " + (tr(r) || r)],
    [/^라운드 패배 · (.+)$/, (m, r) => "Round lost · " + (tr(r) || r)],
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
  // Banners and messages during a match (rounds and phases, the spike, deaths and takeovers, ability results, cheat and
  // admin messages, room and connection messages). "A — B" and "A · B" texts are also translated piece by piece (see tr).
  // Agent, weapon, skin and ability names stay Korean. The server's error texts are translated in js/client-request.js.
  Object.assign(DICT, {
    "적": "Enemy", "아군": "Ally", "적군": "Enemy", "킬": "Kills", "데스": "Deaths", "도움": "Assists", "피해": "Damage", "전체": "All",
    "시점 고정": "View locked", "시점 해제": "View released", "시작 지점": "Start point",
    "사망 · 아군 시점으로 전환": "Dead · switching to a teammate's view", "사망 · 아군 인계 대기": "Dead · waiting to take over a teammate",
    "클릭하면 조종": "click to control", "아군 전원 사망": "All allies are dead", "라운드 종료 대기": "waiting for the round to end",
    "능력 봉인됨": "Abilities sealed", "궁극기 충전 부족": "Ultimate not charged", "사용 가능 횟수 없음": "No uses left", "대상 없음": "No target",
    "관통 명중": "Wall-bang hit", "관통 사격": "Wall-bang shot", "적 감지됨": "Enemy detected", "연막 전개": "Smoke deployed",
    "뇌진탕": "Concussed", "취약": "Vulnerable", "무기 봉인": "Weapons sealed", "근시": "Nearsighted", "부패": "Decay", "흡혈": "Lifesteal", "불사": "Undying", "강제 앉기": "Forced crouch",
    "체력 일시 감소": "health temporarily reduced", "불사 발동": "Undying triggered", "되살아난다": "you rise again",
    "소탕 모드": "Clean-up mode", "적이 설치를 시작했다": "The enemy started planting", "스파이크 설치됨": "Spike planted",
    "스파이크 낙하": "Spike dropped", "스파이크 회수": "Spike picked up", "스파이크 해제": "Spike defused", "스파이크 소지": "Carrying the spike",
    "스파이크 작동 중": "Spike active", "접근해 F": "go close and press F", "회수 필요": "pick it up",
    "스파이크 소지 · 사이트 안에서 4 또는 F를 눌러 설치": "Carrying the spike · press 4 or F inside a site to plant",
    "절반 해제": "Half defused", "여기서 재개됩니다": "resumes from here", "해제 중": "Defusing", "해제 중단": "Defuse stopped", "절반 지점 유지": "half progress kept",
    "스파이크: 떨어져 있음": "Spike: on the ground",
    "수비팀 전멸": "Defenders eliminated", "공격팀 전멸": "Attackers eliminated", "시간 초과": "Time ran out",
    "진영 교대": "Switching sides", "경기 종료": "Match over", "서든데스 · 이번 라운드로 결판": "Sudden death · this round decides it",
    "헤드샷": "Headshot", "더블 킬": "Double kill", "트리플 킬": "Triple kill", "쿼드라 킬": "Quadra kill", "에이스": "Ace",
    "승리": "Victory", "무승부": "Draw",
    "사망 · 3초 후 부활": "Dead · respawning in 3s", "부활": "Respawned", "데스매치에서는 능력을 쓸 수 없습니다": "Abilities are disabled in deathmatch",
    "이번 라운드는 무기가 정해져 있습니다": "This round's weapon is fixed", "아군이 이미 쓰는 요원입니다": "An ally is already using this agent",
    "황금 권총 획득 · 딱 한 발": "Golden pistol picked up · one shot only", "황금 권총 소멸": "Golden pistol gone", "닿을 곳이 없습니다": "Nothing in reach",
    "궁극기 충전": "Ultimate charge", "무기 보급": "Weapon supply", "체력 회복": "Health", "신속": "Haste", "황금 총 · 피해 2배": "Golden gun · double damage",
    "관리자 설정: 봇 정지 켜짐": "Admin setting: bots frozen",
    "기본값으로 되돌렸습니다": "Reset to defaults", "관리자 모드를 잠갔습니다": "Admin mode locked", "설정을 기본값으로 되돌렸습니다": "Settings reset to defaults",
    "치트를 잠갔습니다": "Cheats locked", "복사하지 못했습니다": "Could not copy", "초대 코드를 복사했습니다": "Invite code copied", "초대 링크를 복사했습니다": "Invite link copied",
    "교전에 합류했습니다": "You joined the fight", "교전 개시": "Fight started", "다시 연결했습니다": "Reconnected",
    "연결이 끊겼습니다": "Disconnected", "방장이 나갔습니다. 대기실로 돌아갑니다.": "The host left. Returning to the lobby.",
    "방 코드는 6자리입니다.": "Room codes have 6 characters.", "코드는 6자리입니다": "Codes have 6 characters",
    "접속하지 못했습니다. 코드를 확인해 주세요.": "Could not connect. Check the code.", "방을 만드는 중…": "Creating the room…", "방에 접속하는 중…": "Joining the room…",
    "연결 요청이 취소되었습니다": "The connection request was cancelled", "네트워크 모듈을 불러오지 못했습니다": "The network module did not load",
    "방 생성 시간이 초과되었습니다": "Creating the room timed out", "방 연결이 닫혔습니다": "The room connection closed", "방과의 연결이 닫혔습니다": "The connection to the room closed", "방을 찾지 못했습니다": "Room not found",
    "수비 몰림": "defenders stacked", "진입 실패": "entry failed", "러시": "Rush", "스플릿": "Split", "기본 운영 후 합류": "Default, then join",
    "아무도 없음": "nobody there", "라운드 종료": "Round over", "월드": "World", "배": "x", "초": "s", "분": "min", "· 우클릭 일제 투척": "· right-click to throw them all",
    "거울상 깨짐": "Mirror image broken", "은빛 파동": "Silver pulse", "자장 역전": "Field reversal", "만화경": "Kaleidoscope", "표식": "Mark", "역병": "Plague", "여명": "Dawn", "반향": "Echo",
    "매의 눈": "Hawk eye", "썰물": "Ebb tide", "낙관": "Seal stamp", "격노": "Rage", "잠듦": "Asleep", "역행": "Reverse", "우클릭 일제 투척": "right-click to throw them all", "없음": "none", "나에게": "you", "아군 회복": "allies healed", "적 노출": "enemies revealed", "적 발견": "enemy spotted",
    "인계철선 작동": "tripwire triggered", "종소리 센서 작동": "Bell sensor triggered", "벌집 함정 작동": "Hive trap triggered", "비명 지뢰 작동": "Scream mine triggered",
    "받는 피해 1.5배": "takes 1.5x damage", "칼날 재충전": "blades recharged", "능력 봉인": "abilities sealed",
    "눈부심": "Dazzled", "거미줄에 걸림": "Caught in a web", "자리가 바뀌었다": "Places swapped", "추적 다트 명중": "Tracking dart hit",
    "체력 30 아래면 즉시 처치": "instant kill below 30 health", "처형 표식이 붙었다": "You are marked for execution", "해킹당함": "Hacked", "맞으면 깬다": "wakes when hit",
    "피해 +30%": "+30% damage", "귀환": "return", "되감기": "Rewind", "3초 전 자리로": "back to where you were 3s ago", "8초간 준 피해가 한 번 더": "damage dealt in the last 8s hits again",
    "한 번 더 누르면 두 번째 문": "press again for the second portal", "한 번 지나가면 닫힙니다": "closes after one pass", "차원문 하나": "One portal", "차원문 열림": "Portal open",
    "처치하면 팀 전원 궁극기": "a kill gives the whole team an ultimate", "팀 전원 궁극기 +1": "whole team +1 ultimate", "현상금 획득": "Bounty claimed",
    "결투! 둘 중 하나만 나간다": "Duel! Only one walks out", "좌표 이동 취소": "Teleport cancelled", "궁극기를 돌려받았습니다": "ultimate refunded", "궁극기 반환": "ultimate refunded", "대상이 없습니다": "No target",
    "벽으로 걸어가면 올라갑니다 (10초)": "walk into a wall to climb (10s)", "거미 타기": "Spider climb",
    "4초간 이 안에서는 아무도 다치지 않습니다": "no one gets hurt in here for 4s", "퇴장!": "sent off!", "가면과 체력이 바뀌었습니다": "mask and health swapped", "체력을 맞바꿨습니다": "health swapped", "탈바꿈": "Transformation",
    "자기 닻 설치": "Magnetic anchor placed", "E를 다시 눌러 귀환": "press E again to return",
    "공격 시작": "Attackers start", "수비 시작": "Defenders start", "화면을 누르면 닫힘": "Tap the screen to close",
    "점수판": "Scoreboard", "전투 기록": "Combat log", "아직 이번 라운드 교전 기록이 없습니다": "No fights recorded this round yet", "받은 피해": "Damage taken", "경기 전체 준 피해": "Damage dealt this match",
    "요원 변경": "Change agent", "아군 사용 중": "Used by an ally", "사용 중": "In use", "AI와 교체": "Swap with the AI", "AI 봇": "AI bot", "미선택": "Not picked", "빈 자리": "Empty slot", "눌러서 이 자리로 이동": "Tap to move to this slot",
    "관전 준비 중": "Getting ready to spectate", "양 팀에 최소 1명": "At least 1 per team", "봇": "Bot",
    "다시 연결하는 중": "Reconnecting", "치트": "Cheats", "관리자": "Admin", "다음 세트": "Next set", "이전 세트": "Previous set", "원래 능력": "Original abilities", "세트": "set", "· 내 능력": "· my abilities",
    "개인 설정": "Personal", "전체 설정": "Global", "나만": "Only me", "방 전체": "Whole room", "방장만 바꿀 수 있습니다.": "Only the host can change these.",
    "나에게만 적용됩니다. 다른 사람 화면에는 아무 표시도 없고, 새로고침하면 모두 꺼집니다.": "Applies only to you. Nobody else sees any sign of it, and everything turns off on refresh.",
    "방 전체(모든 플레이어와 봇)에 적용됩니다. 멀티에서는 방장만 바꿀 수 있습니다.": "Applies to the whole room (every player and bot). In multiplayer only the host can change it.",
    "지금 값은 방장이 정한 설정입니다.": "The current values are the host's settings.",
    "작은 지도에 적 표시": "Enemies on minimap", "보이든 안 보이든 모든 적의 위치가 미니맵에 빨간 점으로 뜹니다": "Every enemy shows as a red dot on the minimap, seen or not",
    "벽 뒤에 있는 적도 빨간 발광으로 보입니다": "Enemies behind walls show up with a red glow",
    "능력이 5초마다 다시 찹니다 (궁극기는 그대로). ← → 로 다른 요원의 능력 4개 세트로 바꾸고 ↓ 로 원래대로 (겉모습은 그대로)": "Abilities recharge every 5 seconds (ultimates unchanged). Use ← → to swap to another agent's four abilities and ↓ to go back (your look stays the same)",
    "어떤 피해도 받지 않습니다": "You take no damage", "내가 맞히면 무조건 쓰러집니다": "Anything you hit goes down", "재장전 없이 탄창이 항상 가득": "Magazine always full, no reloading",
    "쏴도 조준이 흔들리지 않습니다": "Your aim does not move when you fire", "나만 빨라집니다. 다른 사람과 봇은 그대로": "Only you get faster. Others and bots stay the same", "내 총만 더 빨리 쏩니다": "Only your gun fires faster",
    "이동 속도 (모두)": "Move speed (everyone)", "모든 플레이어와 봇의 달리기 속도. 걷기·앉아 걷기도 같은 비율로 바뀝니다": "Run speed of every player and bot. Walking and crouch-walking change by the same ratio",
    "라운드 시간": "Round time", "교전 단계 시간. 다음 라운드부터 적용": "Length of the fight phase. Applies from the next round", "구매 시간": "Buy time", "0이면 모드 기본값. 다음 라운드부터 적용": "0 uses the mode default. Applies from the next round",
    "데스매치 경기 시간": "Deathmatch length", "팀 데스매치·데스매치 한 판의 길이. 0이면 모드 기본값. 다음 판부터 적용": "Length of one Team Deathmatch or Deathmatch. 0 uses the mode default. Applies from the next match",
    "점프 높이": "Jump height", "모두의 점프 힘": "Everyone's jump force", "중력": "Gravity", "낮출수록 오래 뜹니다": "The lower, the longer you float", "봇 속도 배율": "Bot speed multiplier", "봇 이동 속도": "Bot move speed",
    "모든 능력 무제한": "Unlimited abilities", "모든 플레이어와 봇이 충전·쿨다운 없이 능력을 씁니다": "Every player and bot uses abilities with no charge or cooldown", "봇 정지": "Freeze bots", "봇이 움직이지 않습니다 (사격은 합니다). 새로고침하면 꺼집니다": "Bots stand still (they still shoot). Turns off on refresh",
    "능력 무제한": "Unlimited abilities", "충전·쿨다운 없이 Q E C X 계속 사용": "Use Q E C X with no charge or cooldown", "재장전 없이 탄창이 항상 가득": "Magazine always full, no reloading",
    "달리기 속도": "Run speed", "걷기 속도": "Walk speed", "앉기 속도": "Crouch speed", "조준 속도 배율": "Aim speed multiplier", "점프 힘": "Jump force", "연사 배율": "Fire rate multiplier",
        "두 번 누르면 기본값": "Double-click for the default", "전능": "Almighty", "연습장": "Practice range", "달나라": "Moon", "슈퍼 점프": "Super jump", "번개": "Lightning", "무중력": "Zero gravity",
    "내가 맞히면 무조건 즉사": "Anything you hit dies instantly", "어떤 피해도 받지 않는다": "You take no damage", "쏴도 조준선이 흔들리지 않는다": "Your crosshair does not move when you fire", "봇이 움직이지 않는다 (사격은 한다)": "Bots stand still (they still shoot)",
    "충전·쿨다운 없이 Q E C X 계속 사용": "Use Q E C X with no charge or cooldown",
  });
  PAT.push(
    [/^(.+) 인계 — 조작 가능$/, "Took over $1 — you are in control"],
    [/^(.+) 시점$/, (m, n) => (tr(n) || n) + "'s view"],
    [/^(.+)\(으\)로 변경$/, "Changed to $1"],
    [/^다음 라운드부터 (.+)$/, "$1 from next round"],
    [/^(.+) 획득$/, "Picked up $1"],
    [/^(탭|F) · (.+?)(\(으\)로 교체| 줍기)$/, (m, k, w, a) => ("탭" === k ? "Tap" : k) + " · " + (" 줍기" === a ? "Pick up " : "Swap to ") + w],
    [/^이번 라운드 무기 · (.+)$/, "This round's weapon · $1"],
    [/^(.+) · (개인전 )?(\d+)킬 먼저$/, (m, n, f, k) => (tr(n) || n) + " · " + (f ? "free-for-all " : "") + "first to " + k + " kills"],
    [/^(\d+)킬$/, "$1 kills"],
    [/^(.+) · (\d+)킬$/, (m, n, k) => (tr(n) || n) + " · " + k + " kills"],
    [/^(\d+)킬 · 1위 (\d+)킬$/, "$1 kills · 1st has $2"],
    [/^(\d+)위$/, "Place $1"],
    [/^(\d+) 라운드 · (공격|수비)$/, (m, n, s) => "Round " + n + " · " + ("공격" === s ? "Attack" : "Defense")],
    [/^(\d+)명 (탐지|취약|감염)$/, (m, n, w) => n + " " + ({ 탐지: "detected", 취약: "vulnerable", 감염: "infected" })[w]],
    [/^(\d+)마리 추적$/, "tracking $1"],
    [/^(.+) 사이트 설치 완료$/, "Spike planted at site $1"],
    [/^(.+) 사이트 · 4 또는 F를 누르고 있으면 설치$/, "Site $1 · hold 4 or F to plant"],
    [/^(.+) 사이트 · 멈추면 설치 진행$/, "Site $1 · stand still to keep planting"],
    [/^(.+) 사이트 설치 중$/, "Planting at site $1"],
    [/^([A-Z?]) 사이트$/, "Site $1"],
    [/^([\d.]+)초( 남음)?$/, (m, n, l) => n + "s" + (l ? " left" : "")],
    [/^스파이크: ([A-Z?]) 사이트에 설치됨$/, "Spike: planted at site $1"],
    [/^스파이크: (.+) 소지$/, (m, n) => "Spike: carried by " + (tr(n) || n)],
    [/^닻이 너무 멀다 \((\d+)m\)$/, "The anchor is too far ($1m)"],
    [/^반경 (\d+)m 무기 봉인$/, "weapons sealed within $1m"],
    [/^황금 상자 여는 중 (.+)$/, "Opening the golden chest $1"],
    [/^(길게 눌러|F 길게 눌러) 황금 상자 열기$/, (m, k) => ("F 길게 눌러" === k ? "Hold F" : "Hold") + " to open the golden chest"],
    [/^작전 변경: (.+)로 이동 \((.+)\)$/, (m, s, w) => "Plan changed: moving to " + s + " (" + (tr(w) || w) + ")"],
    [/^작전: (\S+) (.+)$/, (m, s, n) => "Plan: " + s + " " + (tr(n) || n)],
    [/^다시 연결하는 중 \((.+)\)$/, "Reconnecting ($1)"],
    [/^방장 응답을 기다리는 중… (\d+)초$/, "Waiting for the host… $1s"],
    [/^방을 만들지 못했습니다\. ?(.*)$/, (m, r) => "Could not create the room." + (r ? " " + (tr(r) || r) : "")],
    [/^(\d+)개 항목이 기본값과 다릅니다$/, "$1 items differ from the defaults"],
    [/^개인 (\d+)개 · 전체 (\d+)개 변경됨$/, "$1 personal · $2 global changed"],
    [/^남은 (\d+)발$/, "$1 rounds left"],
    [/^(반향|매의 눈) — (\d+)명$/, (m, h, n) => (tr(h) || h) + " — " + n + " spotted"]
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
    // "A — B" and "A · B": each piece on its own (a piece that is a name, or has no entry, stays as it is)
    if (/ [—·] /.test(nt)) {
      let hit = false;
      const out = nt.split(/( [—·] )/).map((p, i) => { const v = i % 2 ? null : tr(p); v && (hit = true); return v || p; }).join("");
      if (hit) return s.replace(t, out);
    }
    return null;
  }
  // a text in English if it has an entry (the Korean page gets it as it is)
  window.GAME_EN = (m) => ("en" === LANG && "string" === typeof m && tr(m)) || m;
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
  // the result screen says so, under the score, when a match brings nothing because its ticket never came (the server's
  // limit on matches started, or no answer), rather than the reward just not being there
  function noReward(e) {
    let c = $("ov-noreward");
    if (!e) return void (c && (c.hidden = true));
    const score = document.querySelector("#s-over .ov-score");
    if (!score) return;
    if (!c) {
      c = document.createElement("div");
      c.id = "ov-noreward";
      c.style.cssText = "margin-top:10px;padding:0 16px;font-size:13px;font-weight:700;color:#ff8a9a;text-align:center";
      score.after(c);
    }
    c.hidden = false;
    c.textContent = L("보상 없음 · ", "No reward · ") + (429 === e.status ? L("경기를 너무 자주 시작해 이번 경기는 기록되지 않았습니다", "too many matches started, so this one was not recorded") : L("이번 경기는 기록되지 않았습니다", "this match was not recorded") + (e.message ? " (" + e.message + ")" : ""));
  }
  addEventListener("match-finished", async (e) => {
    const match = e.detail, ownerToken = token();
    if (!match || !ownerToken) return;
    noReward(null);
    const mt = await reportSession.finish();
    if (ownerToken !== token()) return;
    if (!mt) return void noReward(reportSession.missed());
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
