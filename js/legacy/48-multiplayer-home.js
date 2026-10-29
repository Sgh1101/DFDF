
(() => {
  // One menu. The homepage only logs you in and shows your level; what you
  // can do lives here, once: play alone, or "play together", a screen with
  // the servers and their open rooms, making a room, and joining by code.
  // (The old "custom game" button and the code box on the title are gone;
  // the code box itself moved into this screen and works as before.)
  const $ = (id) => document.getElementById(id);
  const EN = "en" === window.GAME_LANG,
    L = (ko, en) => (EN ? en : ko);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const AC = () => window.ACCOUNT || null;
  const online = () => !!(AC() && AC().online);
  const isMob = () => !!window.IS_MOBILE;
  const chans = () => {
    const c = (window.SERVER_CFG && SERVER_CFG.channels) || [];
    return c.length ? c : [{ id: "s1", name: "서버 1", en: "Server 1" }];
  };
  const chMob = (id) => !!(chans().find((c) => c.id === id) || {}).mobile;
  const chName = (c) => (EN ? c.en || c.name : c.name);
  const MODE_EN = { std: "Standard", swift: "Swift", rush: "Spike Rush", tdm: "Team DM", dm: "Deathmatch", knife: "Knife Fight", gun: "Gun Game", range: "Target Range", hill: "Conquest", ctf: "Capture the Flag", zone: "Shrinking Zone", inf: "Infection" };
  const modeName = (k) => (EN ? MODE_EN[k] : window.GAME_MODES && GAME_MODES[k] && GAME_MODES[k].name) || k || "";
  const mapName = (k) => {
    const m = "undefined" != typeof MAP_LIST && MAP_LIST.find((x) => x.key === k);
    return m ? m.name : "";
  };
  // the server shown: the player's own pick (remembered), else phones start
  // on the mobile-only server and computers on the first other one. Until
  // the server list arrives the default is only provisional.
  let CH = "",
    pref = "",
    picked = !1;
  try {
    pref = localStorage.getItem("lgp_ch") || "";
  } catch (e) {}
  let ROOMS = [],
    loaded = !1,
    failed = !1,
    busy = !1,
    updatedAt = 0;

  // ── the title: 혼자 하기 · 같이 하기 · (range, map tour, settings) ──
  const host = $("go-host"),
    tj = document.querySelector(".tt-join");
  const multi = document.createElement("button");
  multi.className = "tt-item";
  multi.id = "go-multi";
  multi.innerHTML = `<span><b>${L("같이 하기", "Play together")}</b><small>${L("방 만들기 · 열린 방 참가 · 초대 코드", "Make a room · join an open one · invite code")}</small></span><i>›</i>`;
  host ? host.replaceWith(multi) : $("go-play") && $("go-play").after(multi);
  // what's new, for this version
  const news = document.querySelector(".tt-news ul");
  news &&
    (news.innerHTML = [
      [L("요원 36명 · 능력 144개", "36 agents · 144 abilities"), L("재밌는 요원만 남기고 능력을 전부 새로 만들었습니다. 같은 능력은 하나도 없습니다", "Only the fun ones stayed, every ability rebuilt. No two alike")],
      [L("같이 하기", "Play together"), L("서버별 방 목록 · 방 만들기 · 초대 코드가 한 화면에", "Rooms by server, make a room, invite code: one screen")],
      [L("모드 11종", "11 modes"), L("신속플레이 · 스파이크 돌격 · 팀 데스매치 · 데스매치 · 칼 대난투 · 총기 순환 · 감염 · 점령전 · 깃발 탈취 · 축소전", "Swift · Spike Rush · Team Deathmatch · Deathmatch · Knife Fight · Gun Game · Infection · Conquest · Capture the Flag · Shrinking Zone")],
    ]
      .map(([b, s]) => `<li><b>${b}</b><span>${s}</span></li>`)
      .join(""));

  // ── the screen ──
  const scr = document.createElement("div");
  scr.className = "screen";
  scr.id = "s-multi";
  scr.hidden = !0;
  scr.innerHTML = `
<div class="mu-top">
  <button class="mu-back" id="mu-back" aria-label="${L("뒤로", "Back")}"><i>‹</i><span>${L("뒤로", "Back")}</span></button>
  <div class="mu-h"><b>${L("같이 하기", "Play together")}</b><span>${L("방을 만들어 친구를 부르거나, 열린 방에 들어가세요. 빈자리는 AI가 채웁니다.", "Make a room and invite friends, or join an open one. AI fills the empty seats.")}</span></div>
</div>
<div class="mu-body">
  <section class="mu-list">
    <div class="mu-bar"><div class="mu-chs" id="mu-chs"></div><button class="mu-ref" id="mu-ref" title="${L("새로고침", "Refresh")}">⟳</button></div>
    <div id="mu-status" role="status" aria-live="polite" style="font-size:11px;color:var(--steel-dim);padding:4px 0"></div>
    <div class="mu-note" id="mu-note" hidden></div>
    <div class="mu-rooms" id="mu-rooms"></div>
  </section>
  <aside class="mu-side">
    <div class="mu-card mu-make">
      <div class="mu-ct">${L("방 만들기", "Make a room")}</div>
      <input id="mu-name" maxlength="30" autocomplete="off" spellcheck="false">
      <label class="mu-ck"><input type="checkbox" id="mu-priv"><span>${L("비공개 · 코드로만 참가", "Private · code only")}</span></label>
      <button class="mu-go" id="mu-create"><b>${L("방 만들기", "Make room")}</b><small id="mu-where"></small></button>
    </div>
    <div class="mu-card mu-code" id="mu-code">
      <div class="mu-ct">${L("초대 코드로 참가", "Join with a code")}</div>
      <div class="mu-row" id="mu-code-row"></div>
    </div>
  </aside>
</div>`;
  ($("s-title") || document.body).after(scr);
  // the title's code box moves in here with its handlers (6 letters join at once)
  const jc = $("join-code"),
    jg = $("go-join"),
    je = $("join-err");
  jc && jg && $("mu-code-row").append(jc, jg);
  je && $("mu-code").append(je);
  tj && tj.remove();
  if ("undefined" != typeof SCREENS && !SCREENS.includes("s-multi")) SCREENS.push("s-multi");

  const open = () => {
    if ("undefined" == typeof show) return;
    show("s-multi");
    const nm = $("mu-name");
    try {
      nm.placeholder = L(`${myName()}의 방`, `${myName()}'s room`);
    } catch (e) {}
    paint();
    load();
  };
  const back = () => "undefined" != typeof show && show("s-title");
  multi.onclick = open;
  $("mu-back").onclick = back;
  $("mu-ref").onclick = () => load(!0);
  addEventListener("keydown", (e) => {
    if ("Escape" === e.key && !scr.hidden && document.activeElement !== jc) (e.stopPropagation(), back());
  }, !0);

  function pickDefault() {
    const cs = chans();
    const p = cs.find((c) => c.id === pref);
    // a phone-only server stays picked on a computer only when clicked this visit
    if (p && (picked || !(p.mobile && !isMob()))) return void (CH = p.id);
    const mob = cs.find((c) => c.mobile);
    CH = (isMob() && mob ? mob : cs.find((c) => !c.mobile) || cs[0]).id;
  }
  // a ranked room's skill band (its average rating, as the tier it sits in) and how far from it a player may be
  function bandChip(r) {
    const n = window.RANKED && RANKED.bandName && RANKED.bandName(r.band);
    return n ? `<span class="mu-band" title="${esc(L("방 평균 실력대 · 너무 먼 실력은 들어갈 수 없습니다", "Room's average skill · players too far from it cannot join"))}">${esc(n)}</span>` : "";
  }
  function paint() {
    pickDefault();
    const age = updatedAt ? Math.max(0, Math.floor((Date.now() - updatedAt) / 1000)) : 0;
    $("mu-status").textContent = busy ? L("방 목록 갱신 중…", "Refreshing rooms…") : updatedAt ? L(`마지막 갱신 ${age}초 전${failed || age >= 30 ? " · 이전 목록" : ""}`, `Updated ${age}s ago${failed || age >= 30 ? " · Previous list" : ""}`) : failed ? L("갱신 실패 · 다시 시도하세요", "Refresh failed · Try again") : "";
    $("mu-ref").disabled = busy;
    $("mu-ref").setAttribute("aria-label", L("방 목록 새로고침", "Refresh rooms"));
    $("mu-rooms").setAttribute("aria-busy", String(busy));
    const cs = chans();
    $("mu-chs").innerHTML = cs
      .map((c) => {
        const n = ROOMS.filter((r) => r.ch === c.id).length,
          off = c.mobile && !isMob();
        return `<button class="mu-ch${c.id === CH ? " on" : ""}${off ? " off" : ""}" data-ch="${esc(c.id)}">${c.mobile ? "📱 " : ""}${esc(chName(c))}<em>${n}</em></button>`;
      })
      .join("");
    const mob = chMob(CH),
      pcOff = mob && !isMob(),
      note = $("mu-note");
    const notes = [],
      jm = window.RANKED && RANKED.joinMsg;
    jm && Date.now() - jm.at < 12000 && notes.push(jm.text); // why a ranked room would not take me
    failed && ROOMS.length && notes.push(L("방 목록 갱신에 실패했습니다. 이전 목록을 표시합니다.", "Refresh failed. Showing the previous room list."));
    mob && notes.push(pcOff ? L("📱 모바일 전용 서버입니다. PC에서는 방을 만들거나 들어갈 수 없습니다.", "📱 Mobile-only server: rooms here can't be made or joined from a PC.") : L("📱 모바일 전용 서버 · 폰과 앱 유저끼리만 만납니다.", "📱 Mobile-only server · phone and app players only."));
    online() || notes.push(L("방 목록은 온라인 서버에서 보입니다. 방 만들기와 코드 참가는 그대로 됩니다.", "The room list shows on the online server. Making a room and joining by code still work."));
    note.hidden = !notes.length;
    note.textContent = notes.join(" ");
    const list = ROOMS.filter((r) => r.ch === CH).sort((a, b) => Number(a.n >= a.max) - Number(b.n >= b.max) || Number(a.state !== "lobby") - Number(b.state !== "lobby") || a.created - b.created);
    let h = "";
    if (list.length)
      h = list
        .map((r) => {
          const full = r.n >= r.max,
            live = "lobby" !== r.state,
            dis = full || pcOff;
          const where = [modeName(r.mode), mapName(r.map)].filter(Boolean).join(" · ");
          return `<div class="mu-room"><div class="mu-rt"><b>${esc(r.name)}${r.ranked ? `<span class="mu-rk">${L("랭크", "RANKED")}</span>${bandChip(r)}` : ""}</b><span>${esc(r.host)}${where ? " · " + esc(where) : ""}</span></div><span class="mu-st${live ? " live" : ""}">${live ? L("경기 중", "In game") : L("대기", "Lobby")}</span><span class="mu-n">${r.n | 0}<i>/${r.max | 0}</i></span><button class="mu-join" data-code="${esc(r.code)}"${dis ? " disabled" : ""}>${pcOff ? L("PC 불가", "No PC") : full ? L("가득 참", "Full") : L("참가", "Join")}</button></div>`;
        })
        .join("");
    else
      h = `<div class="mu-empty">${!online() ? "" : !loaded ? L("방 목록을 불러오는 중…", "Loading rooms…") : failed ? L("방 목록을 불러오지 못했습니다. ⟳ 를 눌러 다시 시도하세요.", "Could not load the rooms. Press ⟳ to retry.") : `<b>${L("열린 방이 없습니다", "No open rooms")}</b><span>${L("오른쪽에서 방을 만들고 친구에게 코드를 알려 주세요.", "Make one and send your friends the code.")}</span>`}</div>`;
    $("mu-rooms").innerHTML = h;
    const c = chans().find((x) => x.id === CH);
    $("mu-where").textContent = c ? (c.mobile ? "📱 " : "") + chName(c) + L("에 열기", "") : "";
  }
  async function load(force) {
    if (!online() || busy || !AC() || !AC().api) return paint();
    busy = !0;
    $("mu-ref").classList.add("spin");
    paint();
    try {
      ROOMS = (await AC().api("rooms")).rooms || [];
      failed = !1;
      updatedAt = Date.now();
    } catch (e) {
      failed = !0;
    }
    busy = !1;
    loaded = !0;
    $("mu-ref").classList.remove("spin");
    scr.hidden || paint();
  }
  setInterval(() => {
    scr.hidden || document.hidden || load();
  }, 10000);

  $("mu-chs").onclick = (e) => {
    const b = e.target.closest("[data-ch]");
    if (!b) return;
    CH = pref = b.dataset.ch;
    picked = !0;
    try {
      localStorage.setItem("lgp_ch", CH);
    } catch (x) {}
    paint();
  };
  $("mu-rooms").onclick = (e) => {
    const b = e.target.closest("[data-code]");
    if (!b || b.disabled) return;
    jc && (jc.value = b.dataset.code);
    joinRoom(b.dataset.code);
  };
  $("mu-create").onclick = () => {
    if (chMob(CH) && !isMob()) return "function" == typeof banner && banner(L("📱 모바일 전용 서버는 폰·앱에서만 방을 열 수 있습니다", "📱 Only phones and the app can open rooms on the mobile-only server"), "#ffc849");
    const m = AC() && AC().meta;
    if (m) {
      m.name = $("mu-name").value.trim();
      m.ch = CH;
      m.priv = $("mu-priv").checked;
    }
    createRoom();
  };
  $("mu-name").onkeydown = (e) => {
    e.stopPropagation();
    "Enter" === e.key && $("mu-create").click();
  };

  // a room link (invite, or the homepage's invited room): join once the page
  // has finished loading, and try again if the first try runs out of time
  function roomLink() {
    const code = window.__PENDING_ROOM;
    if (!code || $("acct-gate")) return; // with the login screen up, the login joins it
    window.__PENDING_ROOM = null;
    jc && (jc.value = code);
    try {
      const u = new URL(location.href);
      u.searchParams.set("room", code);
      history.replaceState(null, "", u.pathname + u.search + u.hash); // a reload comes back to the room
    } catch (e) {}
    let n = 0;
    const go = async () => {
      if ("menu" !== world.phase || "solo" !== NET.mode) return;
      n++;
      await joinRoom(code);
      if ("client" === NET.mode || n >= 3) return;
      "function" == typeof banner && banner(L("다시 연결하는 중…", "Connecting again…"), "#ffc849");
      setTimeout(go, 1500);
    };
    setTimeout(go, 700);
  }
  "complete" === document.readyState ? roomLink() : addEventListener("load", roomLink);

  // leaving a lobby comes back to the room list, not the title
  const lv = $("lb-leave");
  if (lv && lv.onclick) {
    const _lv = lv.onclick;
    lv.onclick = function () {
      const r = _lv.apply(this, arguments);
      "menu" === world.phase && open();
      return r;
    };
  }

  const st = document.createElement("style");
  st.textContent = `
#s-multi{background:linear-gradient(180deg,rgba(7,9,13,.94),rgba(7,9,13,.86));padding:clamp(16px,4vh,40px) clamp(16px,5vw,72px);gap:18px}
#s-multi[hidden]{display:none}
.mu-top{display:flex;align-items:center;gap:16px;max-width:1120px;width:100%;margin:0 auto}
.mu-back{display:flex;align-items:center;gap:6px;padding:10px 16px 10px 12px;border-radius:999px;border:1px solid var(--stroke2);background:var(--glass);color:var(--ink);font-size:13px;font-weight:700;flex:none;transition:border-color .2s,transform .2s}
.mu-back i{font-style:normal;font-size:20px;line-height:1;margin-top:-2px}
.mu-back:hover{border-color:rgba(255,255,255,.3);transform:translateX(-2px)}
.mu-h b{display:block;font-size:clamp(22px,3vw,30px);font-weight:900;letter-spacing:.02em}
.mu-h span{display:block;margin-top:2px;font-size:12.5px;color:var(--steel)}
.mu-body{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:16px;max-width:1120px;width:100%;margin:0 auto;flex:1;min-height:0}
.mu-list{display:flex;flex-direction:column;gap:10px;min-width:0;min-height:0}
.mu-bar{display:flex;gap:8px;align-items:center}
.mu-chs{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;flex:1;min-width:0}
.mu-chs::-webkit-scrollbar{display:none}
.mu-ch{flex:none;display:flex;align-items:center;gap:7px;padding:9px 14px;border-radius:999px;border:1px solid var(--stroke2);background:var(--glass);color:#c9d2de;font-size:13px;font-weight:700;transition:border-color .2s,color .2s,background .2s}
.mu-ch em{font-style:normal;font-family:var(--f-display);font-size:11px;color:var(--steel-dim);min-width:16px;padding:1px 6px;border-radius:99px;background:rgba(255,255,255,.06)}
.mu-ch:hover{border-color:rgba(255,255,255,.28)}
.mu-ch.on{border-color:var(--gold);color:var(--gold);background:rgba(255,200,73,.08)}
.mu-ch.on em{color:var(--gold);background:rgba(255,200,73,.14)}
.mu-ch.off{opacity:.55}
.mu-ref{flex:none;width:38px;height:38px;border-radius:50%;border:1px solid var(--stroke2);background:var(--glass);color:var(--steel);font-size:18px;line-height:1}
.mu-ref:hover{color:var(--ink);border-color:rgba(255,255,255,.28)}
.mu-ref.spin{animation:muSpin .8s linear infinite}
@keyframes muSpin{to{transform:rotate(360deg)}}
.mu-note{padding:9px 14px;border-radius:12px;border:1px solid #5c4b1f;background:rgba(255,200,73,.07);color:var(--gold);font-size:12.5px;line-height:1.6}
.mu-rooms{display:flex;flex-direction:column;gap:8px;overflow-y:auto;min-height:0;flex:1;padding-right:2px}
.mu-room{display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;align-items:center;gap:14px;padding:13px 14px 13px 18px;border-radius:var(--r);border:1px solid var(--stroke);background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.012)),var(--glass);transition:border-color .2s}
.mu-room:hover{border-color:var(--stroke2)}
.mu-rt{min-width:0}
.mu-rt b{display:block;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mu-rt span{display:block;margin-top:2px;font-size:12px;color:var(--steel);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mu-st{font-size:11px;font-weight:700;padding:3px 9px;border-radius:99px;border:1px solid var(--stroke2);color:var(--steel)}
.mu-st.live{color:var(--green);border-color:rgba(74,222,128,.35)}
.mu-n{font-family:var(--f-display);font-size:15px;font-weight:700;min-width:44px;text-align:right}
.mu-n i{font-style:normal;color:var(--steel-dim);font-size:12px}
.mu-join{padding:9px 18px;border-radius:10px;border:1px solid rgba(255,110,122,.5);background:linear-gradient(180deg,#ff5b6b,#e0303f);color:#fff;font-size:13px;font-weight:800;min-width:72px}
.mu-join:hover{filter:brightness(1.08)}
.mu-join:disabled{background:rgba(255,255,255,.05);border-color:var(--stroke2);color:var(--steel-dim);cursor:default;filter:none}
.mu-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:150px;padding:24px;border:1px dashed var(--stroke2);border-radius:var(--r);color:var(--steel);font-size:13px;text-align:center}
.mu-empty b{color:var(--ink);font-size:15px}
.mu-empty:empty{display:none}
.mu-side{display:flex;flex-direction:column;gap:12px}
.mu-card{display:flex;flex-direction:column;gap:10px;padding:16px;border-radius:var(--r);border:1px solid var(--stroke);background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.012)),var(--glass2)}
.mu-ct{font-size:12px;font-weight:800;letter-spacing:.08em;color:var(--steel)}
.mu-card input[type=text],.mu-card #mu-name,.mu-card #join-code{width:100%;min-width:0;padding:11px 13px;border-radius:10px;border:1px solid var(--stroke2);background:rgba(0,0,0,.35);color:var(--ink);font-family:inherit;font-size:14px;outline:none}
.mu-card #mu-name:focus,.mu-card #join-code:focus{border-color:var(--cyan)}
.mu-card #join-code{font-family:var(--f-display);letter-spacing:.24em;text-transform:uppercase;font-size:15px}
.mu-ck{display:flex;align-items:center;gap:8px;font-size:12.5px;color:#c9d2de;cursor:pointer}
.mu-ck input{width:16px;height:16px;accent-color:var(--gold)}
.mu-go{display:flex;flex-direction:column;align-items:center;gap:2px;padding:12px;border-radius:12px;border:1px solid rgba(255,200,73,.6);background:linear-gradient(180deg,#ffd469,#f0b429);color:#17120a}
.mu-go b{font-size:14.5px;font-weight:900}
.mu-go small{font-size:11px;font-weight:600;opacity:.72}
.mu-go:hover{filter:brightness(1.06)}
.mu-row{display:flex;gap:6px}
.mu-row .btn{padding:10px 16px;font-size:12px;letter-spacing:.06em;border-radius:10px;flex:none}
.mu-code .tj-err{color:#ff8a94;font-size:12px}
@media (max-width:760px){
  .mu-body{grid-template-columns:1fr;flex:none}
  .mu-side{order:-1;display:grid;grid-template-columns:1fr 1fr}
  .mu-rooms{overflow:visible}
}
@media (max-width:520px){.mu-side{grid-template-columns:1fr}.mu-room{grid-template-columns:minmax(0,1fr) auto auto;gap:10px}.mu-st{display:none}}
@media (max-height:560px){
  #s-multi{padding:10px 16px;gap:10px}
  .mu-h b{font-size:20px}
  .mu-h span{display:none}
  .mu-back{padding:7px 13px 7px 10px}
  .mu-body{grid-template-columns:minmax(0,1fr) 250px;gap:10px}
  .mu-card{padding:11px 12px;gap:7px}
  .mu-card #mu-name,.mu-card #join-code{padding:8px 11px}
  .mu-go{padding:8px}
  .mu-room{padding:8px 10px 8px 14px;gap:10px}
  .mu-ch{padding:6px 11px}
  .mu-ref{width:32px;height:32px}
  .mu-empty{min-height:90px;padding:14px}
}
@media (max-height:560px) and (max-width:760px){.mu-body{grid-template-columns:1fr}}`;
  document.head.appendChild(st);
  window.MULTI = { open, back, paint, load, rooms: () => ROOMS, ch: () => CH };
})();
