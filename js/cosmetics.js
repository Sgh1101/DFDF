// Profile cosmetics (칭호, 네임카드, 킬 효과): the catalogue shared by the homepage and the
// game. The server (api/v1.js, COS) keeps the same ids with their slot and tier and decides who
// owns what; here are the names and the looks. A test checks the two lists match.
(() => {
  const en = () => "en" === (window.GAME_LANG || (function () { try { return localStorage.getItem("lgp_lang"); } catch (e) { return ""; } })());
  const I = (id, s, r, ko, enName, extra) => Object.assign({ id, s, r, ko, en: enName }, extra || {});
  const ITEMS = [
    // titles, shown under the name
    I("rookie", "title", 1, "신참", "Rookie"), I("scout", "title", 1, "탐험가", "Scout"), I("patrol", "title", 1, "야간 순찰", "Night Patrol"), I("scrap", "title", 1, "고철 수집가", "Scrap Collector"),
    I("recruit", "title", 1, "신병", "Recruit"), I("lookout", "title", 1, "망루지기", "Lookout"), I("fieldmedic", "title", 1, "야전 의무병", "Field Medic"), I("sprinter", "title", 1, "단거리 주자", "Sprinter"),
    I("tinker", "title", 1, "땜장이", "Tinkerer"), I("sentry", "title", 1, "초병", "Sentry"),
    I("marksman", "title", 2, "명사수", "Marksman"), I("bulwark", "title", 2, "철벽", "Bulwark"), I("shade", "title", 2, "그림자", "Shade"), I("tempest", "title", 2, "폭풍", "Tempest"),
    I("tracker", "title", 2, "추적자", "Tracker"), I("ambusher", "title", 2, "매복자", "Ambusher"), I("breacher", "title", 2, "돌파수", "Breacher"), I("brawler", "title", 2, "난전꾼", "Brawler"),
    I("nightowl", "title", 2, "올빼미", "Night Owl"), I("hawkeye", "title", 2, "매의 눈", "Hawkeye"), I("rescuer", "title", 2, "구조대원", "Rescuer"), I("demolition", "title", 2, "폭파 전문가", "Demolitionist"),
    I("commander", "title", 3, "전장의 지휘관", "Field Commander"), I("deadeye", "title", 3, "백발백중", "Deadeye"), I("phoenix", "title", 3, "불사조", "Phoenix"), I("wraith", "title", 3, "유령", "Wraith"),
    I("vanguard", "title", 3, "선봉장", "Vanguard"), I("lastline", "title", 3, "최후의 방어선", "Last Line"), I("clutch", "title", 3, "역전의 명수", "Clutch Master"), I("silentfox", "title", 3, "침묵의 여우", "Silent Fox"),
    I("webacrobat", "title", 3, "거미줄 곡예사", "Web Acrobat"), I("hospghost", "title", 3, "병원의 유령", "Ward Ghost"), I("harbormaster", "title", 3, "항구의 주인", "Harbor Master"),
    I("legend13", "title", 4, "13의 전설", "Legend of 13"), I("sovereign", "title", 4, "전장의 지배자", "Sovereign"), I("flawless", "title", 4, "무결점", "Flawless"), I("unbroken", "title", 4, "불패", "Unbroken"),
    I("thirteenth", "title", 4, "열세 번째", "The Thirteenth"), I("grandmaster", "title", 4, "그랜드마스터", "Grandmaster"), I("avatar13", "title", 4, "13의 화신", "Avatar of 13"), I("apex", "title", 4, "정점", "Apex"),
    // name cards: the background of the profile
    I("snow", "card", 1, "설원", "Snowfield", { css: "linear-gradient(135deg,#1c2733,#2c4057 60%,#3a5573)" }),
    I("dusk", "card", 1, "노을", "Dusk", { css: "linear-gradient(120deg,#2a1620,#5a2a3a 55%,#c0603a)" }),
    I("forest", "card", 1, "숲", "Forest", { css: "linear-gradient(135deg,#0d1f17,#17402b 60%,#2c6a3f)" }),
    I("harbor", "card", 1, "항구", "Harbor", { css: "repeating-linear-gradient(0deg,rgba(255,255,255,.05) 0 2px,transparent 2px 12px),linear-gradient(160deg,#0e1b2a,#183a56 60%,#2b6a86)" }),
    I("concrete", "card", 1, "콘크리트", "Concrete", { css: "repeating-linear-gradient(45deg,rgba(255,255,255,.04) 0 3px,transparent 3px 9px),linear-gradient(135deg,#23262b,#3a3f46)" }),
    I("sandstorm", "card", 1, "모래바람", "Sandstorm", { css: "linear-gradient(120deg,#2b2113,#6b5230 60%,#b08a4e)" }),
    I("neoncity", "card", 2, "네온 도시", "Neon city", { css: "repeating-linear-gradient(0deg,rgba(0,212,200,.10) 0 1px,transparent 1px 14px),repeating-linear-gradient(90deg,rgba(255,60,240,.10) 0 1px,transparent 1px 14px),linear-gradient(135deg,#120a2a,#2b1055 55%,#0a5a66)" }),
    I("dancheong", "card", 2, "단청", "Dancheong", { css: "repeating-linear-gradient(45deg,rgba(255,255,255,.05) 0 10px,transparent 10px 20px),linear-gradient(135deg,#16302a,#1f4a3d 55%,#7a2a22)" }),
    I("rooftopc", "card", 2, "옥상 야경", "Rooftop night", { css: "repeating-linear-gradient(90deg,rgba(255,220,120,.12) 0 3px,transparent 3px 22px),linear-gradient(180deg,#0b1020,#1a2447 70%,#3a3f6b)" }),
    I("wardhall", "card", 2, "폐병원 복도", "Abandoned ward", { css: "repeating-linear-gradient(90deg,rgba(255,255,255,.05) 0 2px,transparent 2px 26px),linear-gradient(135deg,#17231f,#2c4a43 60%,#5a6f66)" }),
    I("carbon", "card", 2, "카본", "Carbon", { css: "repeating-linear-gradient(45deg,rgba(255,255,255,.06) 0 2px,transparent 2px 6px),repeating-linear-gradient(-45deg,rgba(0,0,0,.35) 0 2px,transparent 2px 6px),#14171c" }),
    I("bluehour", "card", 2, "푸른 시간", "Blue hour", { css: "linear-gradient(180deg,#0a1230,#1c3a78 60%,#e08a6a)" }),
    I("tacmap", "card", 2, "작전 지도", "Tactical map", { css: "repeating-linear-gradient(0deg,rgba(80,200,140,.14) 0 1px,transparent 1px 16px),repeating-linear-gradient(90deg,rgba(80,200,140,.14) 0 1px,transparent 1px 16px),#0b1812" }),
    I("galaxy", "card", 3, "은하수", "Galaxy", { css: "radial-gradient(ellipse at 18% 22%,rgba(140,100,255,.55),transparent 55%),radial-gradient(ellipse at 82% 78%,rgba(40,110,230,.5),transparent 55%),#0a0720" }),
    I("magma", "card", 3, "용암", "Magma", { css: "radial-gradient(ellipse at 70% 120%,rgba(255,170,0,.65),transparent 60%),linear-gradient(160deg,#1a0604,#7a1a08 70%)" }),
    I("thunder", "card", 3, "뇌우", "Thunderstorm", { css: "radial-gradient(ellipse at 75% 20%,rgba(190,210,255,.5),transparent 45%),linear-gradient(160deg,#0b1020,#1f2a4d 70%,#3a4a7a)" }),
    I("bloodmoon", "card", 3, "핏빛 달", "Blood moon", { css: "radial-gradient(circle at 78% 30%,rgba(255,80,60,.65),transparent 38%),linear-gradient(160deg,#14060a,#3a0d16 70%,#0a0306)" }),
    I("abyss", "card", 3, "심해", "Abyss", { css: "radial-gradient(ellipse at 50% 0%,rgba(40,200,220,.35),transparent 55%),linear-gradient(180deg,#041a26,#03111a 70%,#010609)" }),
    I("circuit", "card", 3, "회로", "Circuit", { css: "repeating-linear-gradient(90deg,rgba(0,255,200,.14) 0 1px,transparent 1px 12px),repeating-linear-gradient(0deg,rgba(0,255,200,.10) 0 1px,transparent 1px 18px),radial-gradient(ellipse at 20% 80%,rgba(0,200,160,.35),transparent 55%),#04120f" }),
    I("laurelc", "card", 4, "금빛 월계", "Golden laurel", { css: "radial-gradient(circle at 50% 50%,rgba(255,221,120,.22),transparent 60%),linear-gradient(135deg,#062418,#0d3d2a 55%,#8a6d1e)" }),
    I("aurorac", "card", 4, "오로라", "Aurora", { css: "linear-gradient(120deg,rgba(46,242,176,.4),rgba(124,77,255,.4) 55%,rgba(41,182,246,.4)),#06121f" }),
    I("prism", "card", 4, "프리즘", "Prism", { css: "conic-gradient(from 210deg at 70% 40%,rgba(255,80,120,.45),rgba(255,200,60,.45),rgba(60,255,180,.45),rgba(60,140,255,.45),rgba(190,80,255,.45),rgba(255,80,120,.45)),#0b0b14" }),
    I("eclipsec", "card", 4, "일식", "Eclipse", { css: "radial-gradient(circle at 74% 42%,#000 0 14%,rgba(255,214,120,.95) 15% 17%,rgba(255,170,60,.35) 18% 34%,transparent 52%),linear-gradient(135deg,#0a0810,#1b1230)" }),
    I("royalc", "card", 4, "왕관", "Royal", { css: "radial-gradient(circle at 50% 120%,rgba(255,221,120,.5),transparent 55%),linear-gradient(135deg,#1c0a33,#3b1366 60%,#8a6d1e)" }),
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
