// The words of the progression rewards (Korean and English), shared by the homepage and the game: the achievements, the
// names of modes and roles a mission names, and the line a pooled mission reads as. The server (api/v1.js) decides what is
// earned; the ids here are its ids (ACH, MODES, ROLE_ID).
(() => {
  const en = () => "en" === (window.GAME_LANG || (function () { try { return localStorage.getItem("lgp_lang"); } catch (e) { return ""; } })());
  const L = (ko, e) => (en() ? e : ko);
  const ACH = {
    win1: ["첫 승리", "First win", "경기에서 처음으로 이기기", "Win your first match"],
    kill100: ["백 명 처치", "100 kills", "적을 모두 합쳐 100명 처치하기", "Get 100 kills in total"],
    play50: ["50경기", "50 matches", "경기 50판 하기", "Play 50 matches"],
    mast5: ["숙련의 길", "Getting good", "요원 한 명의 숙련도를 5단계로 올리기", "Raise one agent's mastery to level 5"],
    roles: ["모든 역할의 승자", "Every role", "타격대·감시자·척후대·전략가로 각각 승리하기", "Win with a Duelist, Sentinel, Initiator and Controller"],
    modes: ["모든 모드 정복", "Every mode", "표적 사격을 뺀 모든 모드에서 승리하기", "Win a match in every mode but the target range"],
  };
  const MODE = { std: ["일반전", "Standard"], swift: ["신속플레이", "Swift"], rush: ["스파이크 돌격", "Spike Rush"], tdm: ["팀 데스매치", "Team DM"], dm: ["데스매치", "Deathmatch"], knife: ["칼 대난투", "Knife Fight"], gun: ["총기 순환", "Gun Game"], hill: ["점령전", "Conquest"], ctf: ["깃발 탈취", "Capture the Flag"], zone: ["축소전", "Shrinking Zone"], inf: ["감염", "Infection"] };
  const ROLE = { duelist: ["타격대", "Duelist"], sentinel: ["감시자", "Sentinel"], initiator: ["척후대", "Initiator"], controller: ["전략가", "Controller"] };
  const pick = (t, k) => (t[k] ? t[k][en() ? 1 : 0] : k);
  // 로 / 으로 after a Korean name
  const ro = (s) => { const c = String(s).charCodeAt(String(s).length - 1) - 0xac00; return c >= 0 && c < 11172 && c % 28 !== 0 && c % 28 !== 8 ? "으로" : "로"; };
  // a pooled mission (the server's {stat: play|wins|kills, n, f: {k: mode|role|agent, v}}) as a line; agent: the agent's name for an id
  function mission(x, agentName) {
    const n = x.n, k = x.f.k, v = x.f.v;
    const who = "mode" === k ? pick(MODE, v) : "role" === k ? pick(ROLE, v) : (agentName && agentName(v)) || v;
    if (!en()) {
      if ("wins" === x.stat) return "mode" === k ? `${who}에서 ${n}번 승리` : `${who}${ro(who)} ${n}번 승리`;
      if ("play" === x.stat) return "mode" === k ? `${who} ${n}판 하기` : `${who}${ro(who)} ${n}판 하기`;
      return "mode" === k ? `${who}에서 적 ${n}명 처치` : `${who}${ro(who)} 적 ${n}명 처치`;
    }
    const m = n > 1 ? "matches" : "match";
    if ("wins" === x.stat) return "mode" === k ? `Win ${n} ${m} in ${who}` : "role" === k ? `Win ${n} ${m} with a ${who}` : `Win ${n} ${m} as ${who}`;
    if ("play" === x.stat) return "mode" === k ? `Play ${n} ${m} in ${who}` : "role" === k ? `Play ${n} ${m} as a ${who}` : `Play ${n} ${m} as ${who}`;
    return "mode" === k ? `Get ${n} kill${n > 1 ? "s" : ""} in ${who}` : "role" === k ? `Get ${n} kill${n > 1 ? "s" : ""} with a ${who}` : `Get ${n} kill${n > 1 ? "s" : ""} as ${who}`;
  }
  window.PROGRESSION = {
    ids: Object.keys(ACH),
    ach: (id) => (ACH[id] ? { name: ACH[id][en() ? 1 : 0], desc: ACH[id][en() ? 3 : 2] } : { name: id, desc: "" }),
    mode: (v) => pick(MODE, v),
    role: (v) => pick(ROLE, v),
    mission,
    L,
  };
})();
