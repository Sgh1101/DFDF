
(() => {
  // The result screen, filled in: every player of the match ranked by combat
  // score, with kills, deaths, assists and damage, the MVP on top and my row
  // marked (the tallies the Tab scoreboard already keeps). The same numbers
  // make the summary the account keeps as its match history.
  if ("undefined" == typeof world || "undefined" == typeof NET || "function" != typeof gameOver) return;
  const EN = "en" === window.GAME_LANG,
    L = (ko, en) => (EN ? en : ko),
    $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const ST = () => (window.QOL && QOL.ST) || new Map();
  const stOf = (a) => {
    const s = ST().get(a.id) || { k: 0, d: 0, a: 0, dmg: 0 };
    return { k: Math.max(s.k | 0, a.kills | 0), d: s.d | 0, a: s.a | 0, dmg: Math.round(s.dmg || 0) };
  };
  const mode = () => (window.GAME_MODES && GAME_MODES[room.mode]) || {};
  const me = () => {
    try {
      return ("function" == typeof myActor && myActor()) || player;
    } catch (e) {
      return player;
    }
  };
  const nameOf = (a) => {
    try {
      const m = a.ctrl && room.members && room.members.get && room.members.get(a.ctrl);
      return (m && m.name) || a.name || "?";
    } catch (e) {
      return a.name || "?";
    }
  };
  const isBot = (a) => {
    try {
      return "function" == typeof isAI ? !!isAI(a) : "ai" === a.ctrl;
    } catch (e) {
      return "ai" === a.ctrl;
    }
  };
  const rounds = () => Math.max(1, mode().respawn ? 1 : (world.scoreAtk | 0) + (world.scoreDef | 0));
  // combat score per round: damage, with a bonus for each kill and assist
  const score = (s) => Math.round((s.dmg + 50 * s.k + 25 * s.a) / rounds());
  const PIC = {};
  const pic = (a) => {
    try {
      return a.agent ? PIC[a.agent.key] || (PIC[a.agent.key] = agentPortrait(a.agent, 72, 88)) : "";
    } catch (e) {
      return "";
    }
  };
  const mapName = () => {
    try {
      const m = "undefined" != typeof MAP_LIST && MAP_LIST.find((x) => x.key === room.map);
      return m ? m.name : room.map || "";
    } catch (e) {
      return "";
    }
  };
  const css = document.createElement("style");
  css.textContent = `
#ov-board{width:min(860px,94vw);margin-top:26px}
#ov-board[hidden]{display:none}
.ovb-mvp{display:flex;align-items:center;gap:14px;padding:12px 16px;border-radius:16px;border:1px solid rgba(255,200,73,.4);background:linear-gradient(90deg,rgba(255,200,73,.12),rgba(255,255,255,.03));margin-bottom:12px}
.ovb-mvp img{width:64px;height:78px;border-radius:12px;object-fit:cover;border:2px solid var(--ac,#ffc849);background:#1b222e}
.ovb-mvp-t b{display:block;font-size:18px;font-weight:800}
.ovb-mvp-t small{color:var(--steel);font-size:11px}
.ovb-mvp-s{margin-left:auto;display:flex;gap:22px;text-align:center}
.ovb-mvp-s b{display:block;font-family:var(--f-display);font-size:18px}
.ovb-mvp-s span{font-size:9.5px;letter-spacing:.14em;color:var(--steel-dim)}
.ovb-tbl{border-radius:16px;border:1px solid var(--line);background:rgba(20,25,34,.72);overflow:hidden}
.ovb-row{display:grid;grid-template-columns:26px 34px minmax(0,1.8fr) repeat(5,minmax(0,.55fr));align-items:center;gap:6px;padding:6px 10px;font-size:12.5px;border-left:3px solid transparent}
.ovb-row.hd{font-size:10px;letter-spacing:.14em;color:var(--steel-dim);background:rgba(255,255,255,.03);border-left-color:transparent!important}
.ovb-row.mine{border-left-color:#38d6ff}
.ovb-row.foe{border-left-color:#ff4a5c}
.ovb-row.me{background:rgba(255,200,73,.12)}
.ovb-row img{width:30px;height:30px;border-radius:8px;object-fit:cover;background:#1b222e}
.ovb-row .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left}
.ovb-row .nm small{display:block;font-size:10px;color:var(--steel)}
.ovb-row .nm i{font-style:normal;margin-left:6px;padding:0 6px;border-radius:999px;border:1px solid rgba(255,200,73,.5);color:var(--gold);font-size:9px;letter-spacing:.1em;font-family:var(--f-display)}
.ovb-row .n{text-align:center;font-family:var(--f-display);font-size:12px}
.ovb-row .cs{color:var(--gold)}
.ovb-row .rk{color:var(--steel-dim);font-family:var(--f-display);font-size:11px;text-align:center}
@media(max-width:600px){.ovb-row{grid-template-columns:20px 28px minmax(0,1.6fr) repeat(4,minmax(0,.5fr));font-size:11.5px;gap:4px;padding:5px 6px}.ovb-row .dm{display:none}.ovb-mvp{flex-wrap:wrap;gap:10px;padding:10px}.ovb-mvp-s{margin-left:0;width:100%;justify-content:space-around}}
`;
  document.head.appendChild(css);
  function rows() {
    const m = me(),
      ffa = !!mode().ffa;
    return (world.actors || [])
      .map((a) => {
        const s = stOf(a);
        return { a, s, cs: score(s), me: a === m, mine: ffa ? a === m : a.team === m.team };
      })
      .sort((x, y) => (ffa ? y.s.k - x.s.k : y.cs - x.cs) || y.s.k - x.s.k || x.s.d - y.s.d);
  }
  function paint(list) {
    const st = document.querySelector("#s-over .ov-stats");
    if (!st) return;
    let box = $("ov-board");
    if (!box) {
      box = document.createElement("div");
      box.id = "ov-board";
      st.after(box);
    }
    if (!list.length) return void (box.hidden = !0);
    box.hidden = !1;
    const mvp = list[0],
      ag = (r) => (r.a.agent ? r.a.agent.name : "") + (isBot(r.a) ? " · AI" : "");
    box.innerHTML = `<div class="ovb-mvp" style="--ac:${mvp.a.agent && mvp.a.agent.color ? mvp.a.agent.color : "#ffc849"}"><img src="${pic(mvp.a)}" alt=""><div class="ovb-mvp-t"><div class="lbl">MVP</div><b>${esc(nameOf(mvp.a))}</b><small>${esc(ag(mvp))}</small></div>
      <div class="ovb-mvp-s"><div><b>${mvp.cs}</b><span>${L("전투 점수", "COMBAT SCORE")}</span></div><div><b>${mvp.s.k} / ${mvp.s.d} / ${mvp.s.a}</b><span>K / D / A</span></div><div><b>${mvp.s.dmg}</b><span>${L("피해", "DAMAGE")}</span></div></div></div>
      <div class="ovb-tbl"><div class="ovb-row hd"><span>#</span><span></span><span>${L("플레이어", "PLAYER")}</span><span class="n">${L("점수", "SCORE")}</span><span class="n">K</span><span class="n">D</span><span class="n">A</span><span class="n dm">${L("피해", "DMG")}</span></div>${list
        .map((r, i) => `<div class="ovb-row ${r.mine ? "mine" : "foe"}${r.me ? " me" : ""}"><span class="rk">${i + 1}</span><img src="${pic(r.a)}" alt=""><span class="nm">${esc(nameOf(r.a))}${0 === i ? "<i>MVP</i>" : ""}<small>${esc(ag(r))}</small></span><span class="n cs">${r.cs}</span><span class="n">${r.s.k}</span><span class="n">${r.s.d}</span><span class="n">${r.s.a}</span><span class="n dm">${r.s.dmg}</span></div>`)
        .join("")}</div>`;
  }
  // what the account is told about this match
  function summary(list) {
    const m = me(),
      mine = list.find((r) => r.me) || null,
      ffa = !!mode().ffa;
    const sa = world.scoreAtk | 0,
      sd = world.scoreDef | 0,
      myS = "atk" === m.team ? sa : sd,
      thS = "atk" === m.team ? sd : sa,
      rank = mine ? list.indexOf(mine) + 1 : 0,
      outcome = GAME_RULES.outcome(room.mode || "std", [myS, thS], rank),
      win = outcome === "win";
    window.LAST_MATCH = { outcome, mode: room.mode || "std", map: mapName(), agent: m.agent ? m.agent.name : "", k: mine ? mine.s.k : 0, d: mine ? mine.s.d : 0, a: mine ? mine.s.a : 0, dmg: mine ? mine.s.dmg : 0, cs: mine ? mine.cs : 0, rank, n: list.length, s: ffa ? [mine ? mine.s.k : 0, list[0] ? list[0].s.k : 0] : [myS, thS], win, mvp: 1 === rank };
    return window.LAST_MATCH;
  }
  const _go = gameOver;
  gameOver = function () {
    const r = _go.apply(this, arguments);
    try {
      const list = rows();
      paint(list);
      summary(list);
    } catch (e) {}
    return r;
  };
  window.RESULTS = { rows, paint: () => paint(rows()), summary: () => summary(rows()), score };
})();
