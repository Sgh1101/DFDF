(() => {
  // The leaderboard: the season's top 50 accounts by RR (placed accounts that
  // played ranked this season), my row marked, and next to it the all-time boards (kills, level, wins, matches played and
  // the clans by the XP of their members) as tabs, each with my own place even when it is outside the list. Opened from the home menu
  // (home-navigation.js adds the button) or with play.html#ranks.
  if (!window.ACCOUNT || "undefined" == typeof show || "undefined" == typeof SCREENS || !document.getElementById("s-title")) return;
  const $ = (id) => document.getElementById(id),
    EN = window.GAME_LANG === "en",
    L = (ko, en) => (EN ? en : ko);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const AC = () => window.ACCOUNT;
  const TOP = 50;
  const user = () => {
    try {
      const s = AC().session();
      return (s && s.user) || null;
    } catch (e) {
      return null;
    }
  };
  const tier = (t, div) => {
    const names = (window.RANK && RANK.names) || [];
    return (names[t] || "") + (div ? " " + div : "");
  };
  const badge = (t, div, px) => (window.RANK && RANK.badge ? RANK.badge(t, div, px) : "");
  const color = (t) => (window.RANK && RANK.colors && RANK.colors[t]) || "#c9d3de";

  const scr = document.createElement("div");
  scr.className = "screen";
  scr.id = "s-ranks";
  scr.hidden = !0;
  scr.innerHTML = `
<div class="lbd-top">
  <button class="mu-back" id="lbd-back" aria-label="${L("뒤로", "Back")}"><i>‹</i><span>${L("뒤로", "Back")}</span></button>
  <div class="mu-h"><b>${L("순위표", "Leaderboard")}</b><span id="lbd-season"></span></div>
  <button class="mu-ref" id="lbd-ref" title="${L("새로고침", "Refresh")}" aria-label="${L("순위표 새로고침", "Refresh leaderboard")}">⟳</button>
</div>
<div class="lbd-tabs" id="lbd-tabs" role="tablist"></div>
<div class="lbd-me" id="lbd-me"></div>
<div class="lbd-body" id="lbd-body" role="region" aria-live="polite"></div>`;
  $("s-title").after(scr);
  SCREENS.includes("s-ranks") || SCREENS.push("s-ranks");

  let rows = [],
    season = null,
    state = "idle", // idle | busy | failed | ok
    at = 0;
  // the tabs: the season's ranked board first, then the all-time ones (api `board`)
  const TABS = [["rank", "랭크", "Ranked"], ["kills", "킬", "Kills"], ["level", "레벨", "Level"], ["wins", "승리", "Wins"], ["matches", "경기", "Matches"], ["clan", "클랜", "Clans"]];
  let tab = "rank";
  const B = {}; // by tab: { rows, me, state, at, off }
  const bd = () => B[tab] || (B[tab] = { rows: [], me: null, state: "idle", at: 0, off: false });
  const num = (n) => Number(n || 0).toLocaleString();
  const tagChip = (t) => (t ? `<em class="lbd-tag">[${esc(t)}]</em>` : "");
  const mine = (r) => {
    const u = user();
    return !!(u && !u.guest && r && String(r.name).toLowerCase() === String(u.id).toLowerCase());
  };
  function paintMe() {
    const u = user(),
      el = $("lbd-me"),
      row = rows.find(mine),
      p = u && u.placement;
    let h = "";
    if (!u || u.guest) h = L("로그인한 계정만 순위에 오를 수 있습니다", "Only signed-in accounts are ranked");
    else if (p && p.done < p.of) h = `${badge(-1, 0, 26)}<span><b>${L("배치", "Placement")} ${p.done}/${p.of}</b> · ${L("배치를 마치고 랭크전을 한 판 더 하면 순위에 오릅니다", "finish placement and play a ranked match to be listed")}</span>`;
    else if (row) h = `${badge(row.t, row.div, 26)}<span><b>${L(`${row.pos}위`, `#${row.pos}`)}</b> · ${esc(tier(row.t, row.div))} · ${row.rr} RR</span>`;
    else if (u.rank) h = `${badge(u.rank.t, u.rank.div, 26)}<span><b>${esc(tier(u.rank.t, u.rank.div))}</b> · ${u.rank.rr} RR · ${L(`상위 ${TOP}위 밖이거나 이번 시즌 랭크전을 아직 하지 않았습니다`, `outside the top ${TOP}, or no ranked match yet this season`)}</span>`;
    el.innerHTML = h;
    el.hidden = !h;
  }
  function paintTabs() {
    $("lbd-tabs").innerHTML = TABS.map(([k, ko, en]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${k === tab}" class="${k === tab ? "on" : ""}">${L(ko, en)}</button>`).join("");
  }
  const BCOLS = { kills: ["", L("킬", "KILLS")], level: [L("레벨", "LEVEL"), "XP"], wins: ["", L("승", "WINS")], matches: ["", L("경기", "MATCHES")], clan: [L("인원", "MEMBERS"), L("경험치", "XP")] };
  function paintBoard() {
    const body = $("lbd-body"),
      ref = $("lbd-ref"),
      b = bd(),
      me = $("lbd-me");
    ref.disabled = "busy" === b.state;
    ref.classList.toggle("spin", "busy" === b.state);
    $("lbd-season").textContent = L(`전체 기간 · 상위 ${TOP}위`, `All time · top ${TOP}`);
    const u = user();
    let h = "";
    if (!u || u.guest) h = L("로그인한 계정만 순위에 오를 수 있습니다", "Only signed-in accounts are ranked");
    else if (b.me && b.me.pos) h = `<span><b>${L(`${b.me.pos}위`, `#${b.me.pos}`)}</b> · ${"clan" === tab ? tagChip(b.me.tag) + esc(b.me.name) : esc(b.me.name)} · ${"level" === tab ? `Lv ${b.me.lv} · ` : ""}${num(b.me.v)} ${"clan" === tab || "level" === tab ? "XP" : esc(BCOLS[tab][1])}${b.me.pos > TOP ? L(` · 상위 ${TOP}위 밖`, ` · outside the top ${TOP}`) : ""}</span>`;
    else if ("clan" === tab) h = L("클랜에 들어가면 클랜 순위에 오릅니다 (홈페이지의 클랜 칸)", "Join a clan to be on the clan board (the Clan section of the homepage)");
    else if ("ok" === b.state) h = L("아직 순위에 없습니다. 경기를 한 판 마치면 올라갑니다", "Not listed yet. Finish a match to be listed");
    me.innerHTML = h;
    me.hidden = !h;
    if ("failed" === b.state && !b.rows.length) return void (body.innerHTML = `<div class="mu-empty"><b>${L("순위표를 불러오지 못했습니다", "Could not load the leaderboard")}</b><span>${L("⟳ 를 눌러 다시 시도하세요", "Press ⟳ to retry")}</span></div>`);
    if ("busy" === b.state && !b.rows.length) return void (body.innerHTML = `<div class="mu-empty">${L("불러오는 중…", "Loading…")}</div>`);
    if (b.off) return void (body.innerHTML = `<div class="mu-empty"><b>${L("클랜이 꺼져 있습니다", "Clans are switched off")}</b></div>`);
    if (!b.rows.length) return void (body.innerHTML = `<div class="mu-empty"><b>${L("아직 순위에 오른 플레이어가 없습니다", "Nobody is listed yet")}</b><span>${L("경기를 한 판 마치면 이름이 올라갑니다", "Finish a match to be listed")}</span></div>`);
    const mineRow = (r) => ("clan" === tab ? !!(b.me && b.me.pos === r.pos) : mine(r));
    body.innerHTML = `<div class="lbd-row bd hd"><span>#</span><span>${"clan" === tab ? L("클랜", "CLAN") : L("플레이어", "PLAYER")}</span><span class="n">${BCOLS[tab][0]}</span><span class="n">${BCOLS[tab][1]}</span></div>${b.rows
      .slice(0, TOP)
      .map((r) => {
        const extra = "level" === tab ? "Lv " + r.lv : "clan" === tab ? r.n : "";
        return `<div class="lbd-row bd${mineRow(r) ? " me" : ""}" data-pos="${r.pos}"><span class="rk">${r.pos}</span><span class="nm">${"clan" === tab ? tagChip(r.tag) + esc(r.name) : esc(r.name) + tagChip(r.clan)}${"clan" !== tab && mine(r) ? `<i>${L("나", "ME")}</i>` : ""}</span><span class="n">${extra}</span><span class="n">${num(r.v)}</span></div>`;
      })
      .join("")}`;
    const m = body.querySelector(".lbd-row.me");
    m && m.scrollIntoView && m.scrollIntoView({ block: "nearest" });
  }
  function paint() {
    paintTabs();
    if ("rank" !== tab) return paintBoard();
    const body = $("lbd-body"),
      ref = $("lbd-ref");
    ref.disabled = "busy" === state;
    ref.classList.toggle("spin", "busy" === state);
    $("lbd-season").textContent = season
      ? L(`시즌 ${season.n} · ${Math.max(1, Math.ceil((season.end - Date.now()) / 864e5))}일 남음 · 상위 ${TOP}위`, `Season ${season.n} · ${Math.max(1, Math.ceil((season.end - Date.now()) / 864e5))} days left · top ${TOP}`)
      : L("이번 시즌의 상위 플레이어", "This season's top players");
    paintMe();
    if ("failed" === state && !rows.length) return void (body.innerHTML = `<div class="mu-empty"><b>${L("순위표를 불러오지 못했습니다", "Could not load the leaderboard")}</b><span>${L("⟳ 를 눌러 다시 시도하세요", "Press ⟳ to retry")}</span></div>`);
    if ("busy" === state && !rows.length) return void (body.innerHTML = `<div class="mu-empty">${L("불러오는 중…", "Loading…")}</div>`);
    if (!rows.length) return void (body.innerHTML = `<div class="mu-empty"><b>${L("아직 순위에 오른 플레이어가 없습니다", "Nobody is listed yet")}</b><span>${L("배치 5판을 마치고 랭크전을 한 판 이상 하면 이름이 올라갑니다", "Finish 5 placement matches and play a ranked match to be listed")}</span></div>`);
    body.innerHTML = `<div class="lbd-row hd"><span>#</span><span>${L("티어", "TIER")}</span><span>${L("플레이어", "PLAYER")}</span><span class="n">RR</span><span class="n">${L("승", "W")}</span><span class="n lbd-pl">${L("경기", "PLAYED")}</span></div>${rows
      .slice(0, TOP)
      .map((r) => `<div class="lbd-row${mine(r) ? " me" : ""}" data-pos="${r.pos}"><span class="rk">${r.pos}</span><span class="tr" style="color:${color(r.t)}">${badge(r.t, r.div, 26)}<em>${esc(tier(r.t, r.div))}</em></span><span class="nm">${esc(r.name)}${mine(r) ? `<i>${L("나", "ME")}</i>` : ""}</span><span class="n">${r.rr}</span><span class="n">${r.wins | 0}</span><span class="n lbd-pl">${r.played | 0}</span></div>`)
      .join("")}`;
    const m = body.querySelector(".lbd-row.me");
    m && m.scrollIntoView && m.scrollIntoView({ block: "nearest" });
  }
  async function loadBoard() {
    const b = bd();
    if ("busy" === b.state) return;
    const was = tab;
    b.state = "busy";
    paint();
    try {
      const u = user(),
        j = await AC().api("board", { kind: was, n: TOP, token: u && !u.guest ? AC().session().token : undefined });
      b.rows = Array.isArray(j.rows) ? j.rows : [];
      b.me = j.me || null;
      b.off = !!j.off;
      b.state = "ok";
      b.at = Date.now();
    } catch (e) {
      b.state = "failed";
    }
    scr.hidden || paint();
  }
  async function load() {
    if ("rank" !== tab) return loadBoard();
    if ("busy" === state) return;
    state = "busy";
    paint();
    try {
      const j = await AC().api("leaderboard", { n: TOP });
      rows = Array.isArray(j.rows) ? j.rows : [];
      season = j.season || null;
      state = "ok";
      at = Date.now();
    } catch (e) {
      state = "failed";
    }
    scr.hidden || paint();
  }
  function setTab(k) {
    if (!TABS.some((t) => t[0] === k)) return;
    tab = k;
    paint();
    const stale = "rank" === tab ? Date.now() - at > 15000 : Date.now() - bd().at > 15000;
    stale && load();
  }
  $("lbd-tabs").onclick = (e) => {
    const b = e.target.closest("button[data-tab]");
    b && setTab(b.dataset.tab);
  };
  function open() {
    show("s-ranks");
    paint();
    ("rank" === tab ? Date.now() - at > 15000 : Date.now() - bd().at > 15000) && load();
    try {
      $("lbd-back").focus();
    } catch (e) {}
  }
  const back = () => show("s-title");
  $("lbd-back").onclick = back;
  $("lbd-ref").onclick = load;
  addEventListener(
    "keydown",
    (e) => {
      "Escape" === e.key && !scr.hidden && (e.stopPropagation(), back());
    },
    !0
  );
  // the same look as the other full screens (play together)
  const css = document.createElement("style");
  css.textContent = `
#s-ranks{background:linear-gradient(180deg,rgba(7,9,13,.94),rgba(7,9,13,.86));padding:clamp(16px,4vh,40px) clamp(16px,5vw,72px);gap:14px;overflow-y:auto}
#s-ranks[hidden]{display:none}
.lbd-top{display:flex;align-items:center;gap:16px;max-width:900px;width:100%;margin:0 auto}
.lbd-top .mu-h{flex:1;min-width:0}
.lbd-tabs{display:flex;gap:6px;max-width:900px;width:100%;margin:0 auto;overflow-x:auto;scrollbar-width:none}
.lbd-tabs button{flex:none;padding:7px 14px;border-radius:999px;border:1px solid var(--line,#2a3444);background:rgba(255,255,255,.03);color:#c9d3de;font:700 12.5px var(--f-body,inherit);cursor:pointer;white-space:nowrap}
.lbd-tabs button.on{border-color:var(--gold,#ffc849);color:var(--gold,#ffc849);background:rgba(255,200,73,.1)}
.lbd-row.bd{grid-template-columns:44px minmax(0,1fr) 84px 110px}
.lbd-tag{font-style:normal;margin-right:6px;padding:0 6px;border-radius:999px;border:1px solid rgba(34,211,238,.5);background:rgba(34,211,238,.1);color:#67e8f9;font:700 10px/16px var(--f-display);letter-spacing:.04em}
.lbd-row.bd .nm .lbd-tag{margin:0 0 0 6px}
.lbd-row.bd .nm .lbd-tag:first-child{margin:0 6px 0 0}
.lbd-me{display:flex;align-items:center;gap:10px;max-width:900px;width:100%;margin:0 auto;padding:10px 14px;border-radius:var(--r,14px);border:1px solid rgba(255,200,73,.35);background:rgba(255,200,73,.06);font-size:13px;color:#e8edf4}
.lbd-me[hidden]{display:none}
.lbd-me b{color:var(--gold,#ffc849)}
.lbd-body{display:flex;flex-direction:column;gap:3px;max-width:900px;width:100%;margin:0 auto;min-height:0}
.lbd-row{display:grid;grid-template-columns:44px minmax(110px,1.1fr) minmax(0,1.6fr) 64px 48px 56px;align-items:center;gap:8px;padding:6px 12px;border-radius:10px;border:1px solid transparent;background:rgba(255,255,255,.03);font-size:13px}
.lbd-row.hd{background:none;font-size:10px;letter-spacing:.14em;color:var(--steel-dim,#6b7789)}
.lbd-row.me{border-color:rgba(255,200,73,.6);background:rgba(255,200,73,.12)}
.lbd-row .rk{font-family:var(--f-display);font-weight:700;text-align:center}
.lbd-row:nth-child(2) .rk{color:#ffd76a}
.lbd-row .tr{display:flex;align-items:center;gap:6px;min-width:0}
.lbd-row .tr em{font-style:normal;font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lbd-row .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lbd-row .nm i{font-style:normal;margin-left:6px;padding:0 6px;border-radius:999px;border:1px solid rgba(255,200,73,.6);color:var(--gold,#ffc849);font-size:9px;letter-spacing:.1em}
.lbd-row .n{text-align:right;font-family:var(--f-display)}
@media (max-width:600px){.lbd-row.bd{grid-template-columns:34px minmax(0,1fr) 60px 74px}.lbd-row{grid-template-columns:34px minmax(0,1.3fr) minmax(0,1.4fr) 54px 40px;gap:6px;padding:6px 8px;font-size:12px}.lbd-pl{display:none}.lbd-row .tr em{display:none}}
@media (max-height:560px){#s-ranks{padding:10px 16px;gap:8px}.lbd-top .mu-h span{display:none}}`;
  document.head.appendChild(css);

  // play.html#ranks (from the homepage) opens it once the title is up
  function openLink() {
    if ("#ranks" !== location.hash || document.documentElement.dataset.gameLoading) return;
    const tt = $("s-title");
    if ("object" == typeof world && "menu" === world.phase && tt && !tt.hidden && "none" !== getComputedStyle(tt).display) {
      try {
        history.replaceState(null, "", location.pathname + location.search);
      } catch (e) {}
      open();
    }
  }
  addEventListener("hashchange", openLink);
  setInterval(openLink, 1000);
  window.LEADERBOARD = { open, back, load, paint, rows: () => rows, tab: setTab, board: () => bd().rows };
})();
