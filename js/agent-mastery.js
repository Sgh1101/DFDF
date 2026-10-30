(function (root) {
  "use strict";
  // Mastery of an agent, level 1-10 (the server counts it: api/v1.js masteryAward). This file only draws it: a hexagon with
  // the level, its colour stepping up with the level, shared by the game (agent cards, the pre-match screen, the result)
  // and the homepage (the profile's list). Nothing here decides a level.
  const MAX = 10;
  // 1-2 steel, 3-4 green, 5-6 blue, 7-8 violet, 9 gold, 10 flame
  const COLORS = ["#8a97ab", "#4ade80", "#38bdf8", "#b78bff", "#ffc849", "#ff6a3c"];
  const clampLv = (lv) => Math.max(1, Math.min(MAX, Math.floor(+lv) || 1));
  const step = (lv) => { lv = clampLv(lv); return lv >= 10 ? 5 : lv >= 9 ? 4 : lv >= 7 ? 3 : lv >= 5 ? 2 : lv >= 3 ? 1 : 0; };
  const color = (lv) => COLORS[step(lv)];
  const lang = () => root.GAME_LANG || (root.document && root.document.documentElement && root.document.documentElement.lang) || "ko";
  const label = (lv) => ("en" === lang() ? "Mastery Lv " : "숙련도 Lv ") + clampLv(lv);
  // a level from what the server gave: the account's own view ({id: {lv}}) or another player's ({id: level}); an agent
  // not in it is level 1 for an account that has one, which is `dflt`
  function levelOf(mast, id, dflt) {
    const v = mast && Object.prototype.hasOwnProperty.call(mast, id) ? mast[id] : null;
    const n = v && "object" == typeof v ? v.lv : v;
    return Number.isFinite(+n) && +n >= 1 ? clampLv(n) : dflt === undefined ? 1 : dflt;
  }
  const CSS =
    ".mastb{position:relative;display:inline-grid;place-items:center;width:1.7em;height:1.9em;font:800 12px/1 var(--f-display,system-ui);filter:drop-shadow(0 1px 2px rgba(0,0,0,.8));vertical-align:middle;flex:none;--mc:#8a97ab}" +
    ".mastb::before,.mastb::after{content:'';position:absolute;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)}" +
    ".mastb::before{inset:0;background:var(--mc)}" +
    ".mastb::after{inset:2px;background:linear-gradient(180deg,#1b222e,#0b0e13)}" +
    ".mastb b{position:relative;z-index:1;color:var(--mc);font-weight:800;font-size:1em;letter-spacing:0}" +
    ".mastb.s1{--mc:#4ade80}.mastb.s2{--mc:#38bdf8}.mastb.s3{--mc:#b78bff}.mastb.s4{--mc:#ffc849}" +
    ".mastb.s5{--mc:#ff6a3c;filter:drop-shadow(0 0 5px rgba(255,106,60,.85))}.mastb.s5::before{background:linear-gradient(135deg,#ffd166,#ff6a3c 55%,#ff2e63)}" +
    ".mastb.s4{filter:drop-shadow(0 0 4px rgba(255,200,73,.6))}";
  function ensureCss() {
    const d = root.document;
    if (!d || !d.head || d.getElementById("mastb-css")) return;
    const s = d.createElement("style");
    s.id = "mastb-css";
    s.textContent = CSS;
    d.head.appendChild(s);
  }
  // `size` in px (the number scales with it)
  function badge(lv, size) {
    ensureCss();
    lv = clampLv(lv);
    return `<span class="mastb s${step(lv)}" data-lv="${lv}" role="img" aria-label="${label(lv)}" title="${label(lv)}" style="font-size:${Math.round(size || 12)}px"><b>${lv}</b></span>`;
  }
  const api = { MAX, COLORS, step, color, label, levelOf, badge, ensureCss, css: CSS };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MASTERY = api;
})(typeof window === "object" ? window : globalThis);
