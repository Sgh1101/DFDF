(() => {
  // Ranked seasons, seen from the game. The server ends a season every few weeks:
  // each account keeps part of its RR, and whoever played enough ranked matches
  // gets gold for the tier it finished on (and from Gold up the season's own skin,
  // 월계관, on every gun). Here: the season and the days left on the tier chip of
  // the title screen, and once a note on the title screen when a season has ended
  // (the homepage shows the same note; seen on one, gone from both).
  if (!window.ACCOUNT || "function" != typeof ACCOUNT.session) return;
  const EN = "en" === window.GAME_LANG,
    L = (ko, en) => (EN ? en : ko);
  const $ = (id) => document.getElementById(id);
  const NAMES = EN ? ["Iron", "Bronze", "Silver", "Gold", "Platinum", "Diamond", "Ascendant", "Immortal", "Radiant"] : ["아이언", "브론즈", "실버", "골드", "플래티넘", "다이아몬드", "초월자", "불멸", "레디언트"];
  const user = () => {
    try {
      const s = ACCOUNT.session();
      return (s && s.user) || null;
    } catch (e) {
      return null;
    }
  };
  const season = () => {
    const u = user();
    return u && !u.guest && u.season ? u.season : null;
  };
  const daysLeft = (s) => Math.max(1, Math.ceil((s.end - Date.now()) / 864e5));
  const line = (s) => L(`시즌 ${s.n} · ${daysLeft(s)}일 남음 · 랭크전 ${s.played || 0}판${(s.need || 0) > (s.played || 0) ? ` (보상까지 ${s.need - s.played}판 더)` : ""}`, `Season ${s.n} · ${daysLeft(s)} days left · ${s.played || 0} ranked${(s.need || 0) > (s.played || 0) ? ` (${s.need - s.played} more for the reward)` : ""}`);
  const seen = () => {
    try {
      return +localStorage.getItem("lgp_ssn_seen") || 0;
    } catch (e) {
      return 0;
    }
  };
  // the note's own style says display:flex, which beats the hidden attribute: it is hidden by its display too (with only
  // hidden set, its button did nothing until the page was loaded again)
  const put = (n, on) => ((n.hidden = !on), (n.style.display = on ? "flex" : "none"));
  function note() {
    let n = $("ssn-note");
    const s = season(),
      last = s && s.last,
      t = $("s-title"),
      onTitle = "object" == typeof world && "menu" === world.phase && t && !t.hidden && "none" !== getComputedStyle(t).display;
    if (!onTitle || !last || last.n <= seen()) return void (n && put(n, !1));
    if (!n) {
      n = document.createElement("div");
      n.id = "ssn-note";
      n.style.cssText = "position:fixed;left:50%;top:max(58px,8vh);transform:translateX(-50%);z-index:58;display:flex;align-items:center;gap:12px;max-width:min(600px,92vw);padding:10px 12px 10px 16px;border-radius:14px;border:1px solid rgba(255,200,73,.6);background:rgba(14,18,26,.95);box-shadow:0 12px 40px -12px rgba(255,200,73,.45);color:var(--steel,#aab4c3);font-size:12px;line-height:1.45";
      n.innerHTML = `<span id="sn-t"></span><button id="sn-ok" style="flex:none;min-height:36px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,200,73,.6);background:transparent;color:#ffc849;font:inherit;cursor:pointer">${L("확인", "OK")}</button>`;
      document.body.appendChild(n);
      $("sn-ok").onclick = () => {
        const s2 = season();
        try {
          localStorage.setItem("lgp_ssn_seen", String((s2 && s2.last && s2.last.n) || 0));
        } catch (e) {}
        put(n, !1);
      };
    }
    const tier = NAMES[last.t] + (last.div ? " " + last.div : "");
    $("sn-t").innerHTML = L(
      `<b style="color:#ffc849">시즌 ${last.n} 종료</b> — ${tier}로 마쳤습니다. ${last.gold ? `보상 🪙${last.gold.toLocaleString()}` : "랭크전을 더 했다면 보상이 있었습니다"}${last.skin ? ` · 전용 스킨 「월계관」 총 ${last.skin}종` : ""} · RR은 ${last.after || 0}부터 다시`,
      `<b style="color:#ffc849">Season ${last.n} is over</b> — you finished ${tier}. ${last.gold ? `Reward 🪙${last.gold.toLocaleString()}` : "More ranked matches would have earned a reward"}${last.skin ? ` · season skin Laurel on ${last.skin} guns` : ""} · RR starts again from ${last.after || 0}`
    );
    put(n, !0);
  }
  // the tier chip says which season and how long is left
  function chipTitle() {
    const b = $("rank-chip"),
      s = season();
    if (!b || !s) return;
    const base = (b.title || "").split(" · " + L("시즌", "Season"))[0],
      want = base + " · " + line(s);
    b.title !== want && (b.title = want);
  }
  setInterval(() => {
    try {
      chipTitle();
      note();
    } catch (e) {}
  }, 1000);
  window.SEASON = { line, note, season };
})();
