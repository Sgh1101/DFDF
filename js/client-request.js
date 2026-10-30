// The server's error texts (api/v1.js `fail`) in English, for the English page (localStorage lgp_lang = "en", set on the home
// page); the Korean page keeps them as they are. GAME_REQUEST puts the English in `error` and the Korean in `errorKo`.
(function () {
  const EN = {
  "이용이 제한되었습니다": "Your access has been restricted", "비밀번호가 틀렸습니다": "Wrong password",
  "서버 응답을 읽을 수 없습니다": "Could not read the server's reply", "요청 시간이 초과되었습니다. 다시 시도해 주세요": "The request timed out. Please try again",
  "다른 요청과 겹쳤습니다. 다시 시도해 주세요": "Another request overlapped. Please try again", "이미 처리된 경기입니다": "This match was already processed",
  "아이디는 2~16자 (한글·영문·숫자·_)": "ID must be 2-16 characters (Korean, English, digits, _)", "비밀번호는 4~64자": "Password must be 4-64 characters",
  "잠시 후 다시 시도하세요": "Please try again in a moment", "너무 많이 시도했습니다. 15분 뒤에 다시": "Too many attempts. Try again in 15 minutes",
  "이미 있는 아이디입니다. 내 계정이면 비밀번호를 확인하고, 새로 가입하려면 다른 아이디를 쓰세요": "That ID already exists. If it is your account, check the password; to sign up, use a different ID",
  "지금은 새 가입을 받지 않습니다": "New sign-ups are closed right now", "게스트·플레이어로 시작하는 아이디는 쓸 수 없습니다": "IDs that start with Guest or Player cannot be used", "쓸 수 없는 아이디입니다": "That ID cannot be used",
  "이용이 제한된 계정입니다": "This account is restricted", "지금은 게스트 입장이 막혀 있습니다": "Guest entry is closed right now", "기기 정보가 없습니다": "Device information is missing",
  "다시 로그인해 주세요": "Please sign in again", "방 또는 연결 정보가 이상합니다": "The room or connection information is invalid", "잠시 뒤에 다시 시도해 주세요": "Please try again later", "연결 정보가 없습니다": "Connection information is missing",
  "종류를 골라 주세요": "Please pick a type", "내용을 5자 이상 적어 주세요": "Please write at least 5 characters", "요원 이름을 적어 주세요": "Please enter the agent's name", "능력을 하나 이상 설명해 주세요": "Please describe at least one ability", "신고할 사용자의 이름을 적어 주세요": "Please enter the name of the user to report",
  "문의를 너무 자주 보내고 있습니다. 잠시 후 다시 시도해 주세요": "You are sending messages too often. Please try again shortly", "같은 내용을 방금 보내셨습니다": "You just sent the same message",
  "이 주문을 다른 요청이 처리 중입니다. 잠시 후 다시 시도해 주세요": "Another request is processing this order. Please try again shortly", "게스트는 구매할 수 없습니다. 계정을 만들어 주세요": "Guests cannot buy. Please create an account",
  "지금은 판매하지 않습니다": "Not on sale right now", "입금 계좌가 아직 정해지지 않았습니다": "The deposit account has not been set yet", "원하는 상품을 하나 이상 골라 주세요": "Please pick at least one product", "기간을 골라 주세요": "Please pick a period",
  "가격이 정해지지 않았습니다": "The price has not been set", "오늘은 더 주문할 수 없습니다": "You cannot place more orders today", "입금 확인을 기다리는 주문이 이미 3건 있습니다": "You already have 3 orders waiting for payment confirmation",
  "없는 주문입니다": "No such order", "내 주문이 아닙니다": "This is not your order", "이미 처리된 주문입니다": "This order was already processed", "너무 빨리 눌렀습니다": "You pressed too fast",
  "초월 상점에 없는 스킨입니다": "That skin is not in the Transcendent shop", "이미 보유한 스킨입니다": "You already own this skin", "초월 코인이 부족합니다 (700개 필요)": "Not enough Transcendent coins (700 needed)",
  "지금은 꾸미기 상점이 닫혀 있습니다": "The cosmetics shop is closed right now", "없는 아이템입니다": "No such item", "이미 가진 아이템입니다": "You already have this item", "없는 칸입니다": "No such slot",
  "이 칸에 맞지 않는 아이템입니다": "This item does not fit this slot", "가지고 있지 않은 아이템입니다": "You do not own this item", "시즌 보상 스킨은 찜할 수 없습니다": "Season reward skins cannot be wishlisted",
  "지금은 상점이 닫혀 있습니다": "The shop is closed right now", "상점이 새로 바뀌었습니다. 다시 확인해 주세요": "The shop has refreshed. Please check again", "주간 특가가 새로 바뀌었습니다. 다시 확인해 주세요": "The weekly deal has changed. Please check again",
  "이미 가진 스킨입니다": "You already have this skin", "너무 빨리 뽑고 있습니다": "You are pulling too fast", "받을 보상이 없습니다": "No reward to claim",
  "랭크전은 계정으로 로그인해야 합니다": "Ranked matches need an account sign-in", "랭크전 방이 아닙니다": "This is not a ranked room", "랭크전이 아직 시작되지 않았습니다": "The ranked match has not started yet", "이 랭크전의 참가자가 아닙니다": "You are not a participant of this ranked match",
  "너무 자주 보냈습니다": "Sent too often", "경기 결과를 기다리는 중입니다": "Waiting for the match result", "보고한 결과가 경기 기록과 다릅니다": "The reported result does not match the match record", "내가 연 랭크전 방이 아닙니다": "This is not a ranked room you opened",
  "같은 계정이 두 번 들어 있습니다": "The same account is listed twice", "방장이 참가자에 없습니다": "The host is not among the participants", "유효한 랭크전 확인표가 없습니다": "No valid ranked ticket", "없는 랭크전입니다": "No such ranked match",
  "경기가 너무 짧습니다": "The match was too short", "결과가 이상합니다": "The result looks invalid", "없는 방입니다": "No such room", "다른 플레이어의 결과 확인을 기다리는 중입니다": "Waiting for another player's result to be confirmed",
  "방 코드가 이상합니다": "The room code is invalid", "다른 사람의 방입니다": "That room belongs to someone else", "방을 너무 자주 열고 있습니다. 잠시 후 다시 시도해 주세요": "You are opening rooms too often. Please try again shortly",
  "관리자 비밀번호가 서버에 설정되지 않았습니다": "The admin password is not set on the server",
  };
  // clans and the leaderboards
  Object.assign(EN, {
  "클랜은 지금 쓸 수 없습니다": "Clans are switched off right now", "게스트는 클랜을 쓸 수 없습니다. 계정을 만들어 주세요": "Guests cannot use clans. Please make an account",
  "클랜 이름은 2~16자 (한글·영문·숫자, 낱말 사이 띄어쓰기 하나)": "Clan name: 2-16 characters (Korean, English, digits, one space between words)", "클랜 태그는 2~4자 (한글·영문·숫자)": "Clan tag: 2-4 characters (Korean, English, digits)",
  "쓸 수 없는 말이 들어 있습니다": "That text has a word that is not allowed", "이미 클랜에 들어 있습니다": "You are already in a clan", "이미 있는 클랜 이름입니다": "That clan name is taken", "이미 있는 클랜 태그입니다": "That clan tag is taken",
  "없는 클랜입니다": "No such clan", "클랜이 가득 찼습니다": "The clan is full", "클랜에 들어 있지 않습니다": "You are not in a clan", "클랜장만 할 수 있습니다": "Only the clan leader can do that",
  "자기 자신은 내보낼 수 없습니다": "You cannot kick yourself", "그 사람은 이 클랜에 없습니다": "That player is not in this clan", "순위표를 고르세요": "Pick a leaderboard",
  });
  const PAT = [[/^골드가 부족합니다 \((.+) 필요\)$/, "Not enough gold ($1 needed)"], [/^찜은 (\d+)개까지입니다$/, "You can wishlist up to $1"], [/^클랜 소개는 (\d+)자까지입니다$/, "The description can be up to $1 characters"]];
  window.GAME_ERROR_EN = function (m) {
    try { if ("en" !== localStorage.getItem("lgp_lang") || "string" !== typeof m) return m; } catch (e) { return m; }
    if (Object.prototype.hasOwnProperty.call(EN, m)) return EN[m];
    for (const [re, to] of PAT) if (re.test(m)) return m.replace(re, to);
    return m;
  };
})();
window.GAME_REQUEST = async function (url, options = {}) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const data = await response.json().catch(() => ({ ok: false, error: "서버 응답을 읽을 수 없습니다" }));
    if (typeof data.error === "string") { const en = window.GAME_ERROR_EN(data.error); if (en !== data.error) { data.errorKo = data.error; data.error = en; } }
    if (response.status >= 500 && typeof CustomEvent === 'function') {
      const action = new URL(url, location.href).searchParams.get('a') || '';
      if (/^[a-z_]{1,40}$/.test(action)) window.dispatchEvent(new CustomEvent('api-diagnostic', {detail:{action,status:response.status,requestId:response.headers?.get('X-Request-Id')||''}}));
    }
    return { response, data };
  } catch (e) {
    throw Object.assign(new Error(e.name === "AbortError" ? window.GAME_ERROR_EN("요청 시간이 초과되었습니다. 다시 시도해 주세요") : "offline"), { network: true });
  } finally { clearTimeout(timer); }
};
