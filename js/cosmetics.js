// Profile cosmetics (칭호, 네임카드, 킬 효과): the catalogue shared by the homepage and the
// game. The server (api/v1.js, COS) keeps the same ids with their slot and tier and decides who
// owns what; here are the names and the looks. A test checks the two lists match.
(() => {
  const en = () => "en" === (window.GAME_LANG || (function () { try { return localStorage.getItem("lgp_lang"); } catch (e) { return ""; } })());
  const I = (id, s, r, ko, enName, extra) => Object.assign({ id, s, r, ko, en: enName }, extra || {});
  const ITEMS = [
    // titles, shown under the name
    I("rookie", "title", 1, "신참", "Rookie"), I("scout", "title", 1, "탐험가", "Scout"), I("patrol", "title", 1, "야간 순찰", "Night Patrol"), I("scrap", "title", 1, "고철 수집가", "Scrap Collector"),
    I("marksman", "title", 2, "명사수", "Marksman"), I("bulwark", "title", 2, "철벽", "Bulwark"), I("shade", "title", 2, "그림자", "Shade"), I("tempest", "title", 2, "폭풍", "Tempest"),
    I("commander", "title", 3, "전장의 지휘관", "Field Commander"), I("deadeye", "title", 3, "백발백중", "Deadeye"), I("phoenix", "title", 3, "불사조", "Phoenix"), I("wraith", "title", 3, "유령", "Wraith"),
    I("legend13", "title", 4, "13의 전설", "Legend of 13"), I("sovereign", "title", 4, "전장의 지배자", "Sovereign"), I("flawless", "title", 4, "무결점", "Flawless"),
    // name cards: the background of the profile
    I("snow", "card", 1, "설원", "Snowfield", { css: "linear-gradient(135deg,#1c2733,#2c4057 60%,#3a5573)" }),
    I("dusk", "card", 1, "노을", "Dusk", { css: "linear-gradient(120deg,#2a1620,#5a2a3a 55%,#c0603a)" }),
    I("neoncity", "card", 2, "네온 도시", "Neon city", { css: "repeating-linear-gradient(0deg,rgba(0,212,200,.10) 0 1px,transparent 1px 14px),repeating-linear-gradient(90deg,rgba(255,60,240,.10) 0 1px,transparent 1px 14px),linear-gradient(135deg,#120a2a,#2b1055 55%,#0a5a66)" }),
    I("dancheong", "card", 2, "단청", "Dancheong", { css: "repeating-linear-gradient(45deg,rgba(255,255,255,.05) 0 10px,transparent 10px 20px),linear-gradient(135deg,#16302a,#1f4a3d 55%,#7a2a22)" }),
    I("galaxy", "card", 3, "은하수", "Galaxy", { css: "radial-gradient(ellipse at 18% 22%,rgba(140,100,255,.55),transparent 55%),radial-gradient(ellipse at 82% 78%,rgba(40,110,230,.5),transparent 55%),#0a0720" }),
    I("magma", "card", 3, "용암", "Magma", { css: "radial-gradient(ellipse at 70% 120%,rgba(255,170,0,.65),transparent 60%),linear-gradient(160deg,#1a0604,#7a1a08 70%)" }),
    I("laurelc", "card", 4, "금빛 월계", "Golden laurel", { css: "radial-gradient(circle at 50% 50%,rgba(255,221,120,.22),transparent 60%),linear-gradient(135deg,#062418,#0d3d2a 55%,#8a6d1e)" }),
    I("aurorac", "card", 4, "오로라", "Aurora", { css: "linear-gradient(120deg,rgba(46,242,176,.4),rgba(124,77,255,.4) 55%,rgba(41,182,246,.4)),#06121f" }),
    // kill effects: the colour of the kill banner
    I("gold", "banner", 2, "금빛", "Gilded", { c: "#ffc849", g: "255,200,73" }),
    I("bolt", "banner", 2, "푸른 번개", "Blue bolt", { c: "#7aa7ff", g: "92,141,255" }),
    I("sakura", "banner", 2, "벚꽃", "Sakura", { c: "#ff9ec0", g: "255,143,179" }),
    I("neonpink", "banner", 3, "네온 핑크", "Neon pink", { c: "#ff5cf4", g: "255,60,240" }),
    I("flame", "banner", 3, "불꽃", "Flame", { c: "#ffa733", g: "255,143,0" }),
    I("frost", "banner", 3, "서리", "Frost", { c: "#9be7ff", g: "128,222,234" }),
    I("ink", "banner", 4, "먹물", "Ink", { c: "#f4f4ef", g: "20,20,24", dark: !0 }),
    I("stars", "banner", 4, "별빛", "Starlight", { c: "#fff1b8", g: "124,77,255" }),
  ];
  const BY = {};
  ITEMS.forEach((x) => (BY[x.id] = x));
  const SLOTS = ["title", "card", "banner"];
  const NAME = { title: ["칭호", "Titles"], card: ["네임카드", "Name cards"], banner: ["킬 효과", "Kill effects"] };
  const TIER = [null, ["일반", "Common", "#4ade80"], ["희귀", "Rare", "#38bdf8"], ["영웅", "Epic", "#c084fc"], ["전설", "Legendary", "#ffc849"]];
  const nm = (x) => (x ? (en() ? x.en : x.ko) : "");
  // what an account has on (from the user the server sent): only ids that exist, in their own slot
  const equipped = (u) => {
    const eq = (u && u.cos && u.cos.eq) || {},
      out = {};
    for (const s of SLOTS) out[s] = BY[eq[s]] && BY[eq[s]].s === s ? BY[eq[s]] : null;
    return out;
  };
  window.COSMETICS = { items: ITEMS, by: BY, slots: SLOTS, slotName: (s) => NAME[s][en() ? 1 : 0], tier: (r) => TIER[r], name: nm, equipped, card: (id) => (BY[id] && BY[id].css) || "", banner: (id) => (BY[id] && BY[id].s === "banner" ? BY[id] : null) };
})();
