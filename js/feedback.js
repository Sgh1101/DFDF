// 문의 · 제안: one form for bug reports, agent ideas, player reports, suggestions, reviews, questions and the rest.
// Shared by the homepage and the game's title screen; it needs a signed-in account or guest (the token the
// game keeps in localStorage) and shows the sender what they sent before, where it stands, and the answer.
(() => {
  if (window.FEEDBACK) return;
  const curEn = () => "en" === window.GAME_LANG || "en" === (() => { try { return localStorage.getItem("lgp_lang"); } catch (e) { return ""; } })();
  // the form is drawn in the language of the moment (the homepage switches without a reload)
  function create(EN) {
  const L = (ko, en) => (EN ? en : ko);
  const API = "/api/v1";
  const TYPES = [
    ["bug", "🐞", L("버그 신고", "Bug report"), L("고장 난 것, 이상하게 움직이는 것", "Something broken or odd")],
    ["agent", "🧑‍🎤", L("요원 제안", "Agent idea"), L("새 요원과 능력을 설명해 주세요", "Describe a new agent and its abilities")],
    ["report", "🚩", L("사용자 신고", "Report a player"), L("치트, 욕설, 방해 같은 행동", "Cheating, abuse, griefing")],
    ["idea", "💡", L("추가했으면 하는 점 (제안)", "Wish list (suggestion)"), L("바꾸거나 있었으면 하는 것", "Something to change or add")],
    ["review", "⭐", L("후기", "Review"), L("해 본 느낌을 들려주세요", "Tell us how it played")],
    ["ask", "❓", L("문의", "Question"), L("궁금한 것", "Anything you want to ask")],
    ["other", "💬", L("기타", "Other"), L("위에 없는 이야기", "Anything else")],
  ];
  const BUG_WHERE = [L("게임 중", "In a match"), L("메뉴 · 홈", "Menus · home"), L("상점 · 무기고", "Shop · armoury"), L("온라인 방", "Online room"), L("연결 끊김", "Connection lost"), L("모바일 조작", "Touch controls"), L("소리 · 화면", "Sound · graphics"), L("기타", "Other")];
  const ROLES = ["타격대", "감시자", "척후대", "전략가"];
  const ROLE_EN = { 타격대: "Striker", 감시자: "Sentinel", 척후대: "Scout", 전략가: "Strategist" };
  const REASONS = [["cheat", L("치트 · 핵", "Cheating")], ["abuse", L("욕설 · 비매너", "Abuse")], ["grief", L("팀킬 · 방해", "Griefing")], ["afk", L("자리 비움", "AFK")], ["name", L("부적절한 이름", "Bad name")], ["other", L("기타", "Other")]];
  const STATUS = { new: [L("접수됨", "Received"), "#8a97ab"], read: [L("확인함", "Seen"), "#38bdf8"], doing: [L("처리 중", "In progress"), "#ffc849"], done: [L("완료", "Done"), "#4ade80"], no: [L("보류 · 어려움", "Not planned"), "#ff6b6b"] };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const session = () => { try { return JSON.parse(localStorage.getItem("lgp_session") || "null"); } catch (e) { return null; } };
  async function call(a, body) {
    const f = window.GAME_REQUEST || (async (u, o) => { const r = await fetch(u, o); return { response: r, data: await r.json().catch(() => ({ ok: false, error: "error" })) }; });
    const { response, data } = await f(API + "?a=" + a, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!data.ok) throw Object.assign(new Error(data.error || "error"), { status: response.status });
    return data;
  }
  const CSS = `
#fb-back{position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;padding:14px;background:rgba(3,5,9,.78);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);font-family:var(--f-body,system-ui,sans-serif);color:var(--ink,#e8edf4)}
#fb-back[hidden]{display:none}
#fb{width:min(680px,100%);max-height:min(92dvh,760px);display:flex;flex-direction:column;border-radius:20px;border:1px solid rgba(255,255,255,.14);background:radial-gradient(500px 200px at 0 0,rgba(255,200,73,.1),transparent 70%),linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.01)),#121722;box-shadow:0 40px 100px -30px #000,inset 0 1px 0 rgba(255,255,255,.08);overflow:hidden;position:relative}
#fb::before{content:"";position:absolute;left:24px;right:24px;top:0;height:2px;background:linear-gradient(90deg,transparent,#ffc849,rgba(255,200,73,.2) 70%,transparent);box-shadow:0 0 16px rgba(255,200,73,.5)}
#fb header{display:flex;align-items:center;gap:10px;padding:16px 18px 10px}
#fb header h2{margin:0;font:700 18px/1.2 var(--f-display,inherit);letter-spacing:.06em;flex:1}
#fb header small{display:block;font:600 9px/1 var(--f-display,inherit);letter-spacing:.3em;color:#ffc849;opacity:.85;margin-bottom:5px}
#fb .fb-x{min-width:36px;min-height:36px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:inherit;font:inherit;cursor:pointer}
#fb .fb-tabs{display:flex;gap:6px;padding:0 18px 10px}
#fb .fb-tabs button{flex:1;min-height:36px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#9aa6b8;font:700 12px/1 inherit;cursor:pointer}
#fb .fb-tabs button.on{color:#14100a;background:linear-gradient(180deg,#ffd869,#f0b72d);border-color:transparent}
#fb .fb-body{overflow:auto;padding:4px 18px 14px;display:flex;flex-direction:column;gap:12px;min-height:0}
#fb .fb-types{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
#fb .fb-types button{display:flex;flex-direction:column;align-items:flex-start;gap:3px;text-align:left;padding:10px 12px;min-height:56px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.035);color:inherit;font:inherit;cursor:pointer;transition:border-color .15s,background .15s,transform .15s}
#fb .fb-types button:hover{transform:translateY(-1px);border-color:rgba(255,255,255,.3)}
#fb .fb-types button.on{border-color:#ffc849;background:linear-gradient(180deg,rgba(255,200,73,.16),rgba(255,200,73,.03));box-shadow:0 8px 20px -12px rgba(255,200,73,.7)}
#fb .fb-types b{font-size:13px}#fb .fb-types span{font-size:10.5px;color:#8a97ab;line-height:1.35}
#fb label,#fb .fb-lab{display:flex;flex-direction:column;gap:5px;font-size:11.5px;font-weight:600;color:#aab4c3}
#fb input,#fb select,#fb textarea{width:100%;box-sizing:border-box;padding:10px 12px;min-height:40px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.3);color:#e8edf4;font:400 13px/1.45 inherit;outline:none}
#fb textarea{min-height:110px;resize:vertical}
#fb input:focus,#fb select:focus,#fb textarea:focus{border-color:#ffc849;box-shadow:0 0 0 3px rgba(255,200,73,.18)}
#fb .fb-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
#fb .fb-ab{display:grid;grid-template-columns:34px minmax(0,.8fr) minmax(0,2fr);gap:8px;align-items:center}
#fb .fb-ab i{display:grid;place-items:center;width:34px;height:34px;border-radius:9px;background:rgba(255,106,74,.18);border:1px solid rgba(255,106,74,.5);color:#ffb4a2;font:700 12px/1 var(--f-display,inherit);font-style:normal}
#fb .fb-rate{display:flex;align-items:center;gap:2px;flex-wrap:wrap}
#fb .fb-rate button{min-width:36px;min-height:36px;padding:0;border-radius:10px;border:0;background:none;color:#4a5568;font-size:24px;line-height:1;cursor:pointer}
#fb .fb-rate button.on{color:#ffc849;text-shadow:0 0 12px rgba(255,200,73,.5)}
#fb .fb-rate em{font-style:normal;font-size:11px;color:#8a97ab;margin-left:6px}
#fb .fb-cnt{align-self:flex-end;font-size:10px;color:#6e7b8e;margin-top:-6px}
#fb .fb-note{font-size:11px;line-height:1.5;color:#8a97ab}
#fb footer{display:flex;align-items:center;gap:10px;padding:12px 18px 16px;border-top:1px solid rgba(255,255,255,.08)}
#fb footer .fb-msg{flex:1;font-size:12px;min-height:16px}
#fb footer .fb-msg.err{color:#ff8a8a}#fb footer .fb-msg.ok{color:#4ade80}
#fb .fb-go{min-height:42px;padding:0 24px;border-radius:12px;border:0;background:linear-gradient(180deg,#ff5a6a,#e03247);color:#fff;font:800 13px/1 inherit;letter-spacing:.05em;cursor:pointer;box-shadow:0 8px 22px -8px rgba(255,59,78,.7)}
#fb .fb-go:disabled{opacity:.55;cursor:default}
#fb .fb-mine{display:flex;flex-direction:column;gap:8px}
#fb .fb-item{padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03)}
#fb .fb-item b{font-size:13px}#fb .fb-item em{font-style:normal;font-size:10.5px;padding:2px 8px;border-radius:999px;border:1px solid currentColor;margin-left:8px}
#fb .fb-item small{display:block;color:#7d8a9d;font-size:10.5px;margin-top:3px}
#fb .fb-item p{margin:7px 0 0;padding:8px 10px;border-radius:9px;background:rgba(255,200,73,.08);border:1px solid rgba(255,200,73,.3);font-size:12px;line-height:1.5;color:#ffe9a8}
#fb .fb-empty{padding:22px;text-align:center;color:#7d8a9d;font-size:12.5px}
@media (max-height:520px),(max-width:560px){
  #fb-back{padding:6px}#fb{max-height:96dvh;border-radius:14px}
  #fb header{padding:10px 12px 6px}#fb header small{display:none}#fb header h2{font-size:15px}
  #fb .fb-tabs{padding:0 12px 6px}#fb .fb-body{padding:2px 12px 8px;gap:9px}
  #fb .fb-types{grid-template-columns:repeat(3,1fr);gap:6px}#fb .fb-types button{min-height:46px;padding:7px 9px}#fb .fb-types span{display:none}
  #fb textarea{min-height:76px}#fb footer{padding:8px 12px 10px}
  #fb .fb-row{grid-template-columns:1fr}
}
@media (max-width:560px) and (min-height:521px){#fb .fb-types{grid-template-columns:repeat(2,1fr)}}`;
  let root = null,
    opener = null;
  const state = { type: "bug", tab: "new", busy: !1 };
  const draft = () => { try { return JSON.parse(sessionStorage.getItem("lgp_fb_draft") || "{}"); } catch (e) { return {}; } };
  const keep = (d) => { try { sessionStorage.setItem("lgp_fb_draft", JSON.stringify(d)); } catch (e) {} };

  // the connection story saved when a multiplayer connection broke (js/legacy/110-…): sessionStorage "lgp_ice_report"
  const ice = () => { try { const r = window.iceSaved ? window.iceSaved() : JSON.parse(sessionStorage.getItem("lgp_ice_report") || "null"); return r && Array.isArray(r.lines) && r.lines.length && Date.now() - r.saved <= 30 * 60000 ? r : null; } catch (e) { return null; } };

  function build() {
    if (root) return root;
    const st = document.createElement("style");
    st.id = "fb-css";
    st.textContent = CSS;
    document.head.appendChild(st);
    root = document.createElement("div");
    root.id = "fb-back";
    root.hidden = !0;
    root.innerHTML = `<div id="fb" role="dialog" aria-modal="true" aria-labelledby="fb-h"><header><div style="flex:1"><small>FEEDBACK</small><h2 id="fb-h">${L("문의 · 제안", "Feedback")}</h2></div><button class="fb-x" type="button" aria-label="${L("닫기", "Close")}">✕</button></header><div class="fb-tabs"><button type="button" data-t="new" class="on">${L("보내기", "Send")}</button><button type="button" data-t="mine">${L("내 문의", "Mine")}</button></div><div class="fb-body" id="fb-body"></div><footer><span class="fb-msg" id="fb-msg"></span><button class="fb-go" id="fb-go" type="button">${L("보내기", "Send")}</button></footer></div>`;
    document.body.appendChild(root);
    root.addEventListener("click", (e) => { e.target === root && close(); });
    root.querySelector(".fb-x").onclick = close;
    root.querySelectorAll(".fb-tabs button").forEach((b) => (b.onclick = () => { state.tab = b.dataset.t; paint(); }));
    root.querySelector("#fb-go").onclick = submit;
    document.addEventListener("keydown", (e) => { "Escape" === e.key && root && !root.hidden && (e.stopPropagation(), close()); }, !0);
    return root;
  }
  const val = (id) => { const e = root.querySelector("#" + id); return e ? e.value : ""; };
  function collect() {
    const d = { type: state.type, title: val("fb-title"), text: val("fb-text"), contact: val("fb-contact") };
    if ("bug" === state.type) d.bug = { where: val("fb-where"), steps: val("fb-steps") };
    if ("agent" === state.type) d.agent = { name: val("fb-an"), role: val("fb-role"), abilities: [0, 1, 2, 3].map((i) => ({ name: val("fb-n" + i), desc: val("fb-d" + i) })) };
    if ("review" === state.type) d.rating = val("fb-rating");
    if ("report" === state.type) d.report = { target: val("fb-target"), reason: val("fb-reason"), room: val("fb-room") };
    return d;
  }
  function paint() {
    const body = root.querySelector("#fb-body"),
      msg = root.querySelector("#fb-msg");
    root.querySelectorAll(".fb-tabs button").forEach((b) => b.classList.toggle("on", b.dataset.t === state.tab));
    msg.textContent = "";
    msg.className = "fb-msg";
    root.querySelector("#fb-go").hidden = "new" !== state.tab;
    if ("mine" === state.tab) return void mine(body, msg);
    const d = draft()[state.type] || {};
    const f = (id, label, ph, v, max, tag = "input") => `<label>${esc(label)}${"textarea" === tag ? `<textarea id="${id}" maxlength="${max}" placeholder="${esc(ph)}">${esc(v || "")}</textarea>` : `<input id="${id}" maxlength="${max}" placeholder="${esc(ph)}" value="${esc(v || "")}">`}</label>`;
    let extra = "";
    if ("bug" === state.type) {
      const b = d.bug || {};
      extra = `<div class="fb-row"><label>${L("어디서 일어났나요?", "Where did it happen?")}<select id="fb-where">${BUG_WHERE.map((w) => `<option${b.where === w ? " selected" : ""}>${esc(w)}</option>`).join("")}</select></label>${f("fb-steps", L("어떻게 하면 생기나요?", "How can it be repeated?"), L("1. … 2. …", "1. … 2. …"), b.steps, 600)}</div>`;
    } else if ("agent" === state.type) {
      const a = d.agent || {},
        ab = a.abilities || [];
      extra = `<div class="fb-row">${f("fb-an", L("요원 이름", "Agent name"), L("예: 시계공", "e.g. Clockwright"), a.name, 20)}<label>${L("역할", "Role")}<select id="fb-role"><option value="">${L("고르지 않음", "Not sure")}</option>${ROLES.map((r) => `<option value="${r}"${a.role === r ? " selected" : ""}>${esc(EN ? ROLE_EN[r] : r)}</option>`).join("")}</select></label></div>` +
        ["Q", "E", "C", "X"].map((k, i) => `<div class="fb-ab"><i>${k}${3 === i ? "★" : ""}</i><input id="fb-n${i}" maxlength="24" placeholder="${3 === i ? L("궁극기 이름", "Ultimate name") : L("능력 이름", "Ability name")}" value="${esc((ab[i] || {}).name)}"><input id="fb-d${i}" maxlength="300" placeholder="${L("어떻게 작동하나요? 쓰면 무슨 일이 생기나요?", "What does it do? How long, how far?")}" value="${esc((ab[i] || {}).desc)}"></div>`).join("") +
        `<div class="fb-note">${L("능력은 기존 요원과 겹치지 않는 편이 좋습니다. 쿨타임·범위·지속 시간을 적어 주시면 더 빨리 검토할 수 있어요.", "Abilities that no one has yet work best. Say how long, how far and the cooldown if you can.")}</div>`;
    } else if ("report" === state.type) {
      const r = d.report || {};
      extra = `<div class="fb-row">${f("fb-target", L("신고할 사용자 이름", "Player's name"), L("게임 안에서 보인 이름", "As shown in game"), r.target, 30)}<label>${L("이유", "Reason")}<select id="fb-reason">${REASONS.map(([k, n]) => `<option value="${k}"${r.reason === k ? " selected" : ""}>${esc(n)}</option>`).join("")}</select></label></div>${f("fb-room", L("방 코드 (있다면)", "Room code (if any)"), "ABC123", r.room, 8)}`;
    } else if ("review" === state.type) {
      const r = Math.min(5, +d.rating || 0);
      extra = `<div class="fb-lab">${L("별점 (선택)", "Rating (optional)")}<input type="hidden" id="fb-rating" value="${r || ""}"><div class="fb-rate" role="radiogroup" aria-label="${L("별점", "Rating")}">${[1, 2, 3, 4, 5].map((i) => `<button type="button" role="radio" data-r="${i}" class="${i <= r ? "on" : ""}" aria-checked="${i === r}" aria-label="${L(i + "점", i + (1 === i ? " star" : " stars"))}">★</button>`).join("")}<em id="fb-rate-n">${r ? r + " / 5" : ""}</em></div></div>`;
    }
    const t = TYPES.find((x) => x[0] === state.type);
    body.innerHTML = `<div class="fb-types" role="group" aria-label="${L("종류", "Kind")}">${TYPES.map(([k, ic, n, s]) => `<button type="button" data-k="${k}" class="${k === state.type ? "on" : ""}" aria-pressed="${k === state.type}"><b>${ic} ${esc(n)}</b><span>${esc(s)}</span></button>`).join("")}</div>${f("fb-title", L("제목 (선택)", "Title (optional)"), "", d.title, 60)}${extra}${f("fb-text", "agent" === state.type ? L("요원 소개와 콘셉트", "The agent in a few lines") : "report" === state.type ? L("무슨 일이 있었나요?", "What happened?") : "review" === state.type ? L("후기", "Your review") : L("내용", "Details"), t[3], d.text, 2000, "textarea")}<div class="fb-cnt" id="fb-cnt">0 / 2000</div>${f("fb-contact", L("답장 받을 곳 (선택)", "Where to answer (optional)"), L("디스코드·이메일 등. 비워 두면 '내 문의'에서 답을 확인합니다", "Discord, e-mail… or leave it and check “Mine”"), d.contact, 80)}<div class="fb-note">${L("보낸 분의 계정 이름과 레벨, 화면 크기, 지금 하던 모드·맵이 함께 전달됩니다. 비밀번호는 전달되지 않습니다.", "Your account name and level, screen size and the mode and map you were in go with it. Never your password.")}</div>`;
    const cnt = body.querySelector("#fb-cnt"),
      tx = body.querySelector("#fb-text");
    const attached = "bug" === state.type && ice();
    if (attached) {
      const row = document.createElement("div");
      row.id = "fb-ice";
      row.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;padding:8px 10px;border-radius:10px;border:1px solid rgba(255,200,73,.35);background:rgba(255,200,73,.07);font-size:12px";
      row.innerHTML = `<b id="fb-ice-line">${L(`연결 기록 첨부됨 (${attached.lines.length}줄)`, `Connection log attached (${attached.lines.length} lines)`)}</b><label style="flex-direction:row;align-items:center;gap:6px;font-weight:500"><input id="fb-ice-skip" type="checkbox" style="width:18px;min-height:18px">${L("첨부하지 않기", "Leave it out")}</label><span class="fb-note" style="flex-basis:100%">${L("시간·연결 상태·후보 종류(직접/중계)만 담기고 주소는 담기지 않습니다.", "Times, states and candidate types (direct / relayed) only. No addresses.")}</span>`;
      body.append(row);
    }
    if(window.GAME_DIAGNOSTICS){const label=document.createElement('label');label.style.cssText='display:flex;flex-direction:row;align-items:center;gap:8px';const check=document.createElement('input');check.id='fb-diagnostic';check.type='checkbox';check.style.cssText='width:18px;min-height:18px';label.append(check,document.createTextNode(L('진단 요약 함께 보내기 (버전·품질·프레임·자원 수)','Include diagnostic summary (version, quality, frames, resource counts)')));body.append(label);}
    const upd = () => (cnt.textContent = `${tx.value.length} / 2000`);
    tx.oninput = upd;
    upd();
    const stars = body.querySelectorAll(".fb-rate button");
    // a star sets the rating; the same star again clears it
    stars.forEach((b) => (b.onclick = () => {
      const hid = body.querySelector("#fb-rating"), n = +b.dataset.r === +hid.value ? 0 : +b.dataset.r;
      hid.value = n || "";
      stars.forEach((x) => { x.classList.toggle("on", +x.dataset.r <= n); x.setAttribute("aria-checked", String(+x.dataset.r === n)); });
      body.querySelector("#fb-rate-n").textContent = n ? n + " / 5" : "";
      hid.dispatchEvent(new Event("input", { bubbles: !0 }));
    }));
    body.querySelectorAll(".fb-types button").forEach((b) => (b.onclick = () => { const all = draft(); all[state.type] = collect(); keep(all); state.type = b.dataset.k; paint(); }));
    body.addEventListener("input", () => { const all = draft(); all[state.type] = collect(); keep(all); });
    if (!session()) { msg.textContent = L("로그인(또는 게스트 입장) 후 보낼 수 있습니다", "Sign in (or enter as a guest) first"); msg.className = "fb-msg err"; }
  }
  async function mine(body, msg) {
    body.innerHTML = `<div class="fb-empty">${L("불러오는 중…", "Loading…")}</div>`;
    const s = session();
    if (!s || !s.token) return void (body.innerHTML = `<div class="fb-empty">${L("로그인 후 볼 수 있습니다", "Sign in to see yours")}</div>`);
    try {
      const j = await call("feedback_mine", { token: s.token });
      const kind = (k) => (TYPES.find((x) => x[0] === k) || [])[2] || k;
      body.innerHTML = j.items.length
        ? `<div class="fb-mine">${j.items.map((x) => { const st = STATUS[x.status] || STATUS.new; return `<div class="fb-item"><b>${esc(x.title)}</b><em style="color:${st[1]}">${esc(st[0])}</em><small>${esc(kind(x.type))} · ${new Date(x.t).toLocaleString(EN ? "en" : "ko-KR", { dateStyle: "medium", timeStyle: "short" })}</small>${x.reply ? `<p>💬 ${esc(x.reply)}</p>` : ""}</div>`; }).join("")}</div>`
        : `<div class="fb-empty">${L("아직 보낸 문의가 없습니다", "You have not sent anything yet")}</div>`;
    } catch (e) {
      body.innerHTML = `<div class="fb-empty">${esc(e.message === "offline" ? L("서버에 연결할 수 없습니다", "Cannot reach the server") : e.message)}</div>`;
    }
  }
  async function submit() {
    if (state.busy) return;
    const msg = root.querySelector("#fb-msg"),
      go = root.querySelector("#fb-go"),
      s = session();
    msg.className = "fb-msg";
    if (!s || !s.token) { msg.textContent = L("로그인(또는 게스트 입장) 후 보낼 수 있습니다", "Sign in (or enter as a guest) first"); msg.className = "fb-msg err"; return; }
    const d = collect();
    if ((d.text || "").trim().length < 5) { msg.textContent = L("내용을 5자 이상 적어 주세요", "Write at least 5 characters"); msg.className = "fb-msg err"; root.querySelector("#fb-text").focus(); return; }
    if ("agent" === d.type && !(d.agent.name || "").trim()) { msg.textContent = L("요원 이름을 적어 주세요", "Name the agent"); msg.className = "fb-msg err"; root.querySelector("#fb-an").focus(); return; }
    if ("agent" === d.type && !d.agent.abilities.some((a) => (a.name || a.desc || "").trim())) { msg.textContent = L("능력을 하나 이상 설명해 주세요", "Describe at least one ability"); msg.className = "fb-msg err"; return; }
    if ("report" === d.type && !(d.report.target || "").trim()) { msg.textContent = L("신고할 사용자의 이름을 적어 주세요", "Name the player"); msg.className = "fb-msg err"; root.querySelector("#fb-target").focus(); return; }
    if ("review" === d.type) +d.rating >= 1 ? (d.rating = +d.rating) : delete d.rating;
    d.ctx = { ua: navigator.userAgent, view: `${innerWidth}x${innerHeight}`, page: /play\.html/.test(location.pathname) ? "play" : "home", mode: (typeof room!=='undefined' && room.mode) || "", map: (typeof room!=='undefined' && room.map) || "", lang: EN ? "en" : "ko" };
    if(root.querySelector('#fb-diagnostic')?.checked&&window.GAME_DIAGNOSTICS){const r=GAME_DIAGNOSTICS.report();d.ctx.diagnostic={version:r.release.version,commit:r.release.commit,quality:r.game.quality,medianMs:r.frameMs.median,p95Ms:r.frameMs.p95,geometries:r.gpu.geometries,textures:r.gpu.textures};}
    const att = "bug" === d.type && !root.querySelector("#fb-ice-skip")?.checked && root.querySelector("#fb-ice") && ice();
    if (att) d.ctx.ice = { reason: att.reason, lines: att.lines };
    state.busy = !0;
    go.disabled = !0;
    msg.textContent = L("보내는 중…", "Sending…");
    try {
      await call("feedback_submit", Object.assign({ token: s.token }, d));
      if (att && window.iceClear) window.iceClear();
      const all = draft();
      delete all[state.type];
      keep(all);
      state.tab = "mine";
      paint();
      const m2 = root.querySelector("#fb-msg");
      m2.textContent = L("접수되었습니다. 감사합니다!", "Received — thank you!");
      m2.className = "fb-msg ok";
    } catch (e) {
      msg.textContent = "offline" === e.message ? L("서버에 연결할 수 없습니다", "Cannot reach the server") : e.message;
      msg.className = "fb-msg err";
    } finally {
      state.busy = !1;
      go.disabled = !1;
    }
  }
  function open(o) {
    build();
    opener = document.activeElement;
    o = o || {};
    o.type && TYPES.some((x) => x[0] === o.type) && (state.type = o.type);
    if ("connection" === o.where) {
      // from the "connection lost" card: where = connection lost, and a first line so it can be sent at once
      const all = draft(), b = (all.bug = all.bug || {});
      b.bug = Object.assign({}, b.bug, { where: L("연결 끊김", "Connection lost") });
      b.text || (b.text = L("멀티플레이 중 연결이 끊겼습니다.", "I was disconnected during multiplayer."));
      keep(all);
    }
    state.tab = o.tab || "new";
    root.hidden = !1;
    paint();
    setTimeout(() => { const f = root.querySelector("#fb-text") || root.querySelector(".fb-x"); f && f.focus(); }, 30);
  }
  function close() {
    if (!root) return;
    root.hidden = !0;
    opener && opener.focus && opener.focus();
  }
  const destroy = () => { root && root.remove(); const c = document.getElementById("fb-css"); c && c.remove(); root = null; };
  return { open, close, destroy, TYPES, STATUS, en: EN };
  }
  let inst = null;
  window.FEEDBACK = {
    open(o) { const en = curEn(); if (!inst || inst.en !== en) { inst && inst.destroy(); inst = create(en); } inst.open(o); },
    close() { inst && inst.close(); },
    get types() { return (inst || (inst = create(curEn()))).TYPES; },
  };
})();
