(() => {
  // The "Clan" section of the profile on the homepage (index.html loads this file in <head> and calls HOME_CLAN.draw() from drawMe()):
  // my clan (tag, name, description, the members with level and role, leave; for the owner: kick and edit the description), or
  // a search with the clans that earned the most XP, a way to join one, and a form to make one with its cost. Everything comes
  // from the server (api clan_*); the page's own S (session), CFG (public settings), L (language), api(), save(), drawMe(), esc()
  // and $() are used when it draws.
  const TX = {
    ko: {
      title: "클랜", wait: "불러오는 중…", fail: "클랜 정보를 불러오지 못했습니다", retry: "다시 시도",
      none: "아직 클랜이 없습니다. 클랜에 들어가거나 직접 만들어 보세요. 게임 안에서 이름 옆에 [태그]가 붙습니다.",
      searchPh: "클랜 이름·태그 검색", search: "검색", top: "경험치 상위 클랜", found: (n) => `검색 결과 ${n}개`, nothing: "찾은 클랜이 없습니다", join: "가입", full: "가득 참", seats: (n, m) => `${n}/${m}명`,
      make: "클랜 만들기", namePh: "클랜 이름 (2~16자)", tagPh: "태그 (2~4자)", descPh: "한 줄 소개 (60자까지, 비워도 됩니다)", makeBtn: (c) => (c ? `만들기 · 🪙 ${c.toLocaleString()}` : "만들기 (무료)"),
      cost: (c, g) => (c ? `클랜을 만들려면 🪙 ${c.toLocaleString()}이 듭니다. 지금 ${g.toLocaleString()} 골드를 가지고 있습니다.` : "지금은 무료로 만들 수 있습니다."), rules: "이름과 태그는 한글·영문·숫자만 쓰고, 다른 클랜과 겹칠 수 없습니다.",
      owner: "클랜장", member: "멤버", lv: (n) => `Lv ${n}`, xp: (n) => `경험치 합계 ${n.toLocaleString()}`, noDesc: "소개가 없습니다",
      leave: "클랜 나가기", leaveAsk: (n) => `${n} 클랜에서 나갈까요?`, leaveOwner: "\n클랜장이 나가면 가장 오래된 멤버가 클랜장이 됩니다. 마지막 멤버가 나가면 클랜이 사라집니다.",
      kick: "내보내기", kickAsk: (n) => `${n}님을 클랜에서 내보낼까요?`, descLabel: "소개", save: "저장", saved: "저장했습니다", joined: (n) => `${n} 클랜에 들어갔습니다`, made: (n) => `${n} 클랜을 만들었습니다`, left: "클랜에서 나왔습니다", kicked: (n) => `${n}님을 내보냈습니다`,
    },
    en: {
      title: "Clan", wait: "Loading…", fail: "Could not load the clan", retry: "Try again",
      none: "You are not in a clan yet. Join one or make your own. Its [TAG] shows beside your name in the game.",
      searchPh: "Search clans by name or tag", search: "Search", top: "Clans with the most XP", found: (n) => `${n} found`, nothing: "No clan found", join: "Join", full: "Full", seats: (n, m) => `${n}/${m}`,
      make: "Make a clan", namePh: "Clan name (2-16)", tagPh: "Tag (2-4)", descPh: "One line about it (up to 60, optional)", makeBtn: (c) => (c ? `Make it · 🪙 ${c.toLocaleString()}` : "Make it (free)"),
      cost: (c, g) => (c ? `Making a clan costs 🪙 ${c.toLocaleString()}. You have ${g.toLocaleString()} gold.` : "Making a clan is free right now."), rules: "Names and tags use Korean letters, English letters and digits only, and cannot repeat another clan's.",
      owner: "Leader", member: "Member", lv: (n) => `Lv ${n}`, xp: (n) => `${n.toLocaleString()} XP together`, noDesc: "No description",
      leave: "Leave the clan", leaveAsk: (n) => `Leave ${n}?`, leaveOwner: "\nWhen the leader leaves, the longest-standing member takes over. When the last member leaves, the clan is gone.",
      kick: "Kick", kickAsk: (n) => `Kick ${n} from the clan?`, descLabel: "Description", save: "Save", saved: "Saved", joined: (n) => `You joined ${n}`, made: (n) => `You made ${n}`, left: "You left the clan", kicked: (n) => `${n} was kicked`,
    },
  };
  const tx = (k, ...a) => {
    const v = TX[typeof L !== "undefined" && "en" === L ? "en" : "ko"][k];
    return "function" == typeof v ? v(...a) : v;
  };
  const st = { token: "", state: "idle", mine: null, cfg: null, top: [], found: null, q: "", msg: "", err: "", form: { name: "", tag: "", desc: "" }, desc: null, busy: false };
  const me = () => (typeof S !== "undefined" && S && S.token && S.user && !S.user.guest ? S : null);
  const on = () => typeof CFG !== "undefined" && !!(CFG && CFG.clan && CFG.clan.on);
  const box = () => document.getElementById("clan");
  const tagOf = (c) => `[${c.tag}]`;

  const css = document.createElement("style");
  css.textContent = `
#clan h3{font-family:var(--fd);font-size:12px;letter-spacing:.18em;color:var(--steel-dim);margin:0 0 10px 4px;text-transform:uppercase}
#clan .cl-card{padding:14px 14px 12px;border:1px solid var(--line);border-radius:14px;background:var(--panel)}
#clan .cl-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
#clan .cl-tag{font:900 15px var(--fd);color:var(--gold);padding:2px 9px;border-radius:8px;border:1px solid #5c4b1f;background:rgba(255,200,73,.08);white-space:nowrap}
#clan .cl-name{font-size:17px;font-weight:900;word-break:break-all;min-width:0;flex:1}
#clan .cl-sub{margin:6px 0 0;font-size:12px;color:var(--steel)}
#clan .cl-desc{margin:10px 0 0;font-size:13px;color:var(--ink);line-height:1.5;word-break:break-all}
#clan .cl-desc.none{color:var(--dim)}
#clan .cl-edit{display:flex;gap:8px;margin-top:10px}
#clan .cl-edit .in{margin:0;padding:9px 12px;font-size:13px;flex:1;min-width:0}
#clan .btn{padding:8px 14px;font-size:13px;border-radius:10px}
#clan .btn.bad{border-color:#5c2630;color:#ff9aa5}
#clan .btn[disabled]{opacity:.5;cursor:default}
#clan .cl-list{margin-top:12px;display:flex;flex-direction:column;gap:5px}
#clan .cl-m{display:grid;grid-template-columns:44px minmax(0,1fr) auto auto;gap:4px 10px;align-items:center;padding:7px 10px;border-radius:12px;border:1px solid var(--line);background:#0f141d}
#clan .cl-m.me{border-color:#5c4b1f}
#clan .cl-m .lv{height:26px;border-radius:8px;display:grid;place-items:center;font:700 11px var(--fd);background:#0d121a;border:1px solid var(--line);color:var(--steel);white-space:nowrap}
#clan .cl-m b{font-size:13.5px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#clan .cl-m .role{font-size:10.5px;color:var(--steel);white-space:nowrap}
#clan .cl-m .role.owner{color:var(--gold)}
#clan .cl-m .btn{padding:4px 10px;font-size:11.5px}
#clan .cl-c{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 10px;align-items:center;padding:9px 12px;border-radius:12px;border:1px solid var(--line);background:#0f141d}
#clan .cl-c .nm{display:flex;align-items:center;gap:8px;min-width:0;font-size:14px;font-weight:700;line-height:1.3}
#clan .cl-c .nm span:last-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#clan .cl-c .tg{font:900 12px var(--fd);color:var(--gold);white-space:nowrap}
#clan .cl-c small{grid-column:1;font-size:11px;color:var(--steel);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#clan .cl-c .btn{grid-column:2;grid-row:1 / 3}
#clan .cl-search{display:flex;gap:8px}
#clan .cl-search .in{margin:0;padding:10px 12px;font-size:14px;flex:1;min-width:0}
#clan .cl-h{margin:14px 0 6px 2px;font-size:11.5px;color:var(--steel);letter-spacing:.04em}
#clan .cl-make{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,.8fr);gap:8px}
#clan .cl-make .in{margin:0;padding:10px 12px;font-size:14px}
#clan .cl-make .wide{grid-column:1 / 3}
#clan .cl-make .btn{grid-column:1 / 3}
#clan .cl-note{margin-top:8px;font-size:11.5px;color:var(--steel);line-height:1.55}
#clan .cl-msg{margin:10px 2px 0;font-size:12.5px;min-height:0}
#clan .cl-msg.err{color:#ff8a95}#clan .cl-msg.ok{color:var(--green)}
#clan .cl-msg:empty{display:none}
#clan .empty{padding:14px;text-align:center;color:var(--steel-dim);font-size:12px;border:1px dashed var(--line);border-radius:12px}
@media(max-width:600px){#clan .cl-m{grid-template-columns:40px minmax(0,1fr) auto}#clan .cl-m .role{grid-column:2;grid-row:2}#clan .cl-m .btn{grid-column:3;grid-row:1 / 3}#clan .cl-make{grid-template-columns:1fr}#clan .cl-make .wide,#clan .cl-make .btn{grid-column:1}}
`;
  document.head.appendChild(css);

  async function call(action, body) {
    const j = await api(action, Object.assign({ token: S.token }, body || {}));
    return j;
  }
  async function load() {
    const user = me();
    if (!user || !on()) return;
    st.token = user.token;
    st.state = "busy";
    draw();
    try {
      const j = await call("clan_mine");
      st.mine = j.clan || null;
      st.cfg = j.cfg || null;
      if (!st.mine) {
        const s = await call("clan_search", { q: "" });
        st.top = s.clans || [];
        st.found = null;
      }
      st.state = "ok";
    } catch (e) {
      st.state = "failed";
    }
    draw();
  }
  const say = (kind, text) => {
    st.msg = text;
    st.err = "err" === kind ? text : "";
    st.kind = kind;
  };
  // an action: the button is held until the server answers; its error is shown under the section
  async function act(fn) {
    if (st.busy) return;
    st.busy = true;
    say("", "");
    saveForm();
    draw();
    try {
      await fn();
    } catch (e) {
      say("err", e.message || "error");
    }
    st.busy = false;
    draw();
  }
  function saveForm() {
    const g = (id) => document.getElementById(id);
    g("clanName") && (st.form = { name: g("clanName").value, tag: g("clanTag").value, desc: g("clanDesc").value });
    g("clanQ") && (st.q = g("clanQ").value);
    g("clanDescEdit") && (st.desc = g("clanDescEdit").value);
  }
  const spend = (gold) => {
    typeof gold === "number" && S.user && ((S.user.gold = gold), save(S), typeof drawMe === "function" && drawMe());
  };
  async function search() {
    saveForm();
    const j = await call("clan_search", { q: st.q.trim() });
    st.found = st.q.trim() ? j.clans || [] : null;
    st.top = st.q.trim() ? st.top : j.clans || [];
  }
  const doJoin = (id) => act(async () => {
    const j = await call("clan_join", { id });
    st.mine = j.clan;
    st.desc = null;
    say("ok", tx("joined", tagOf(j.clan) + " " + j.clan.name));
  });
  const doMake = () => act(async () => {
    const f = st.form, j = await call("clan_create", { name: f.name, tag: f.tag, desc: f.desc });
    st.mine = j.clan;
    st.desc = null;
    st.form = { name: "", tag: "", desc: "" };
    say("ok", tx("made", tagOf(j.clan) + " " + j.clan.name));
    spend(j.gold);
  });
  const doLeave = () => {
    const c = st.mine;
    if (!c || !confirm(tx("leaveAsk", tagOf(c) + " " + c.name) + (c.owner.toLowerCase() === S.user.id.toLowerCase() ? tx("leaveOwner") : ""))) return;
    act(async () => {
      await call("clan_leave");
      st.mine = null;
      st.found = null;
      const s = await call("clan_search", { q: "" });
      st.top = s.clans || [];
      say("ok", tx("left"));
    });
  };
  const doKick = (id) => {
    if (!confirm(tx("kickAsk", id))) return;
    act(async () => {
      const j = await call("clan_kick", { id });
      st.mine = j.clan;
      say("ok", tx("kicked", id));
    });
  };
  const doDesc = () => act(async () => {
    const j = await call("clan_edit", { desc: st.desc == null ? st.mine.desc : st.desc });
    st.mine = j.clan;
    st.desc = null;
    say("ok", tx("saved"));
  });

  const clanRow = (c) => `<div class="cl-c" data-id="${esc(c.id)}"><div class="nm"><span class="tg">${esc(tagOf(c))}</span><span>${esc(c.name)}</span></div><small>${esc(c.desc || tx("noDesc"))} · ${esc(tx("seats", c.n, c.max))}</small>${c.n >= c.max ? `<button class="btn" disabled>${esc(tx("full"))}</button>` : `<button class="btn" data-join="${esc(c.id)}"${st.busy ? " disabled" : ""}>${esc(tx("join"))}</button>`}</div>`;
  function mineHtml(c) {
    const mineIsOwner = c.owner.toLowerCase() === S.user.id.toLowerCase();
    const members = c.members.map((m) => `<div class="cl-m${m.id.toLowerCase() === S.user.id.toLowerCase() ? " me" : ""}" data-id="${esc(m.id)}"><span class="lv">${esc(tx("lv", m.level))}</span><b>${esc(m.id)}</b><span class="role${"owner" === m.role ? " owner" : ""}">${esc(tx("owner" === m.role ? "owner" : "member"))}</span>${mineIsOwner && "owner" !== m.role ? `<button class="btn bad" data-kick="${esc(m.id)}"${st.busy ? " disabled" : ""}>${esc(tx("kick"))}</button>` : "<span></span>"}</div>`).join("");
    return `<div class="cl-card"><div class="cl-head"><span class="cl-tag">${esc(tagOf(c))}</span><span class="cl-name">${esc(c.name)}</span><button class="btn bad" id="clanLeave"${st.busy ? " disabled" : ""}>${esc(tx("leave"))}</button></div>
<div class="cl-sub">${esc(tx("seats", c.n, c.max))} · ${esc(tx("xp", c.xp))}</div>
${mineIsOwner ? `<div class="cl-edit"><input class="in" id="clanDescEdit" maxlength="60" placeholder="${esc(tx("descPh"))}" aria-label="${esc(tx("descLabel"))}" value="${esc(st.desc == null ? c.desc : st.desc)}"><button class="btn" id="clanDescSave"${st.busy ? " disabled" : ""}>${esc(tx("save"))}</button></div>` : `<div class="cl-desc${c.desc ? "" : " none"}">${esc(c.desc || tx("noDesc"))}</div>`}
<div class="cl-list" id="clanMembers">${members}</div></div>`;
  }
  function freeHtml() {
    const cfg = st.cfg || CFG.clan, gold = (S.user && S.user.gold) || 0, f = st.form;
    return `<div class="cl-card"><div class="cl-note" style="margin:0 0 10px">${esc(tx("none"))}</div>
<div class="cl-search"><input class="in" id="clanQ" maxlength="16" placeholder="${esc(tx("searchPh"))}" value="${esc(st.q)}"><button class="btn" id="clanSearch"${st.busy ? " disabled" : ""}>${esc(tx("search"))}</button></div>
<div class="cl-h">${esc(st.found ? tx("found", st.found.length) : tx("top"))}</div>
<div class="cl-list" id="clanResults">${(st.found || st.top).map(clanRow).join("") || `<div class="empty">${esc(tx("nothing"))}</div>`}</div>
<div class="cl-h">${esc(tx("make"))}</div>
<div class="cl-make"><input class="in" id="clanName" maxlength="16" placeholder="${esc(tx("namePh"))}" value="${esc(f.name)}" autocomplete="off"><input class="in" id="clanTag" maxlength="4" placeholder="${esc(tx("tagPh"))}" value="${esc(f.tag)}" autocomplete="off"><input class="in wide" id="clanDesc" maxlength="60" placeholder="${esc(tx("descPh"))}" value="${esc(f.desc)}" autocomplete="off"><button class="btn gold" id="clanMake"${st.busy || gold < cfg.cost ? " disabled" : ""}>${esc(tx("makeBtn", cfg.cost))}</button></div>
<div class="cl-note">${esc(tx("cost", cfg.cost, gold))}<br>${esc(tx("rules"))}</div></div>`;
  }
  function draw() {
    const el = box();
    if (!el) return;
    const user = me(), show = !!user && on() && !document.getElementById("v-dash").hidden;
    el.hidden = !show;
    if (!show) return;
    if (st.token !== user.token) {
      Object.assign(st, { token: user.token, state: "idle", mine: null, found: null, top: [], q: "", msg: "", err: "", form: { name: "", tag: "", desc: "" }, desc: null });
    }
    if ("idle" === st.state) return void load();
    document.getElementById("clanTitle").textContent = tx("title");
    const body = document.getElementById("clanBody");
    let h;
    if ("failed" === st.state) h = `<div class="empty">${esc(tx("fail"))} <button class="btn" id="clanRetry">${esc(tx("retry"))}</button></div>`;
    else if ("busy" === st.state && !st.mine && !st.top.length) h = `<div class="empty">${esc(tx("wait"))}</div>`;
    else h = (st.mine ? mineHtml(st.mine) : freeHtml()) + `<div class="cl-msg ${st.err ? "err" : "ok"}" id="clanMsg" role="status">${esc(st.msg)}</div>`;
    body.innerHTML = h;
    const g = (id) => document.getElementById(id);
    g("clanRetry") && (g("clanRetry").onclick = () => ((st.state = "idle"), draw()));
    g("clanLeave") && (g("clanLeave").onclick = doLeave);
    g("clanDescSave") && (g("clanDescSave").onclick = doDesc);
    g("clanDescEdit") && (g("clanDescEdit").onkeydown = (e) => "Enter" === e.key && doDesc());
    g("clanSearch") && (g("clanSearch").onclick = () => act(search));
    g("clanQ") && (g("clanQ").onkeydown = (e) => "Enter" === e.key && act(search));
    g("clanMake") && (g("clanMake").onclick = doMake);
    g("clanDesc") && (g("clanDesc").onkeydown = (e) => "Enter" === e.key && !g("clanMake").disabled && doMake());
    body.querySelectorAll("[data-join]").forEach((b) => (b.onclick = () => doJoin(b.dataset.join)));
    body.querySelectorAll("[data-kick]").forEach((b) => (b.onclick = () => doKick(b.dataset.kick)));
  }
  window.HOME_CLAN = { draw, reload: () => ((st.state = "idle"), draw()), state: st };
})();
