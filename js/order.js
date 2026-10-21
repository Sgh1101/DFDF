// 치트 구매: pick the cheats and a length, get an order code and the account to pay into, and wait for the
// owner to open them. Payment is a bank transfer outside the game; nothing here takes money. The owner opens
// the sale (and names the account) in the admin page, so the entry stays hidden until then.
// Shared by the homepage and the game's title screen.
(() => {
  if (window.ORDERS) return;
  const curEn = () => "en" === window.GAME_LANG || "en" === (() => { try { return localStorage.getItem("lgp_lang"); } catch (e) { return ""; } })();
  const API = "/api/v1";
  function create(EN) {
    const L = (ko, en) => (EN ? en : ko);
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    const won = (n) => Number(n || 0).toLocaleString(EN ? "en" : "ko-KR") + L("원", " KRW");
    const session = () => { try { return JSON.parse(localStorage.getItem("lgp_session") || "null"); } catch (e) { return null; } };
    async function call(a, body) {
      const f = window.GAME_REQUEST || (async (u, o) => { const r = await fetch(u, o); return { response: r, data: await r.json().catch(() => ({ ok: false, error: "error" })) }; });
      const { response, data } = await f(API + "?a=" + a, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!data.ok) throw Object.assign(new Error(data.error || "error"), { status: response.status });
      return data;
    }
    const STATUS = { pending: [L("입금 대기", "Waiting for payment"), "#ffc849"], granted: [L("열림", "Opened"), "#4ade80"], rejected: [L("거절됨", "Declined"), "#ff6b6b"], cancelled: [L("취소함", "Cancelled"), "#8a97ab"], refunded: [L("환불됨", "Refunded"), "#ff9a4d"] };
    const CSS = `
#od-back{position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;padding:14px;background:rgba(3,5,9,.78);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);font-family:var(--f-body,system-ui,sans-serif);color:var(--ink,#e8edf4)}
#od-back[hidden]{display:none}
#od{width:min(720px,100%);max-height:min(94dvh,800px);display:flex;flex-direction:column;border-radius:20px;border:1px solid rgba(255,255,255,.14);background:radial-gradient(520px 220px at 100% 0,rgba(255,59,78,.12),transparent 70%),radial-gradient(500px 200px at 0 0,rgba(255,200,73,.1),transparent 70%),linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.01)),#121722;box-shadow:0 40px 100px -30px #000,inset 0 1px 0 rgba(255,255,255,.08);overflow:hidden;position:relative}
#od::before{content:"";position:absolute;left:24px;right:24px;top:0;height:2px;background:linear-gradient(90deg,transparent,#ff5a6a,rgba(255,200,73,.5) 70%,transparent);box-shadow:0 0 16px rgba(255,90,106,.5)}
#od header{display:flex;align-items:center;gap:10px;padding:16px 18px 8px}
#od header h2{margin:0;font:700 18px/1.2 var(--f-display,inherit);letter-spacing:.06em;flex:1}
#od header small{display:block;font:600 9px/1 var(--f-display,inherit);letter-spacing:.3em;color:#ff8a96;opacity:.9;margin-bottom:5px}
#od .od-x{min-width:36px;min-height:36px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:inherit;font:inherit;cursor:pointer}
#od .od-tabs{display:flex;gap:6px;padding:0 18px 10px}
#od .od-tabs button{flex:1;min-height:36px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#9aa6b8;font:700 12px/1 inherit;cursor:pointer}
#od .od-tabs button.on{color:#14100a;background:linear-gradient(180deg,#ffd869,#f0b72d);border-color:transparent}
#od .od-body{overflow:auto;padding:4px 18px 12px;display:flex;flex-direction:column;gap:12px;min-height:0}
#od .od-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
#od .od-it{display:flex;gap:10px;align-items:flex-start;text-align:left;padding:10px 12px;min-height:56px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.035);color:inherit;font:inherit;cursor:pointer;transition:border-color .15s,background .15s}
#od .od-it:hover{border-color:rgba(255,255,255,.3)}
#od .od-it.on{border-color:#ffc849;background:linear-gradient(180deg,rgba(255,200,73,.16),rgba(255,200,73,.03))}
#od .od-it i{flex:none;width:18px;height:18px;margin-top:1px;border-radius:5px;border:1.5px solid rgba(255,255,255,.35);display:grid;place-items:center;font-style:normal;font-size:12px;color:#14100a}
#od .od-it.on i{background:#ffc849;border-color:#ffc849}
#od .od-it b{display:block;font-size:13px}#od .od-it span{display:block;font-size:10.5px;color:#8a97ab;line-height:1.4;margin-top:2px}
#od .od-it em{margin-left:auto;font-style:normal;font:700 12px/1 var(--f-display,inherit);color:#ffd869;white-space:nowrap}
#od .od-dur{display:flex;gap:8px;flex-wrap:wrap}
#od .od-dur button{flex:1;min-width:84px;min-height:44px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#c9d2de;font:700 13px/1.2 inherit;cursor:pointer}
#od .od-dur button small{display:block;font-weight:600;font-size:10px;color:#8a97ab;margin-top:2px}
#od .od-dur button.on{border-color:#ffc849;color:#fff;background:rgba(255,200,73,.14)}
#od label{display:flex;flex-direction:column;gap:5px;font-size:11.5px;font-weight:600;color:#aab4c3}
#od input{width:100%;box-sizing:border-box;padding:10px 12px;min-height:40px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.3);color:#e8edf4;font:400 13px/1.45 inherit;outline:none}
#od input:focus{border-color:#ffc849;box-shadow:0 0 0 3px rgba(255,200,73,.18)}
#od .od-note{font-size:11px;line-height:1.55;color:#8a97ab}
#od .od-warn{padding:9px 12px;border-radius:10px;border:1px solid rgba(255,138,150,.4);background:rgba(255,59,78,.08);font-size:11.5px;line-height:1.55;color:#ffc2c8}
#od footer{display:flex;align-items:center;gap:12px;padding:12px 18px 16px;border-top:1px solid rgba(255,255,255,.08)}
#od footer .od-total{flex:1;font:800 20px/1.1 var(--f-display,inherit);color:#ffd869}
#od footer .od-total small{display:block;font:600 10px/1 inherit;color:#8a97ab;margin-bottom:4px;letter-spacing:.05em}
#od footer .od-msg{font-size:12px;max-width:42%}#od footer .od-msg.err{color:#ff8a8a}
#od .od-go{min-height:42px;padding:0 24px;border-radius:12px;border:0;background:linear-gradient(180deg,#ff5a6a,#e03247);color:#fff;font:800 13px/1 inherit;letter-spacing:.05em;cursor:pointer;box-shadow:0 8px 22px -8px rgba(255,59,78,.7)}
#od .od-go:disabled{opacity:.5;cursor:default}
#od .od-pay{border-radius:14px;border:1px solid rgba(255,200,73,.45);background:linear-gradient(180deg,rgba(255,200,73,.12),rgba(255,200,73,.03));padding:14px 16px;display:flex;flex-direction:column;gap:10px}
#od .od-pay h3{margin:0;font-size:14px;color:#ffe9a8}
#od .od-kv{display:grid;grid-template-columns:96px 1fr auto;gap:8px 10px;align-items:center;font-size:13px}
#od .od-kv span:nth-child(3n+1){color:#8a97ab;font-size:11.5px}
#od .od-kv b{font-size:15px;word-break:break-all}
#od .od-kv button{min-height:30px;padding:0 12px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font:600 11px/1 inherit;cursor:pointer}
#od .od-item{padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03);display:flex;flex-direction:column;gap:5px}
#od .od-item .t{display:flex;gap:8px;align-items:center;flex-wrap:wrap}#od .od-item .t b{font-size:13px}
#od .od-item em{font-style:normal;font-size:10.5px;padding:2px 8px;border-radius:999px;border:1px solid currentColor}
#od .od-item small{color:#7d8a9d;font-size:10.5px;line-height:1.5}
#od .od-item button{align-self:flex-start;min-height:30px;padding:0 12px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.05);color:inherit;font:600 11px/1 inherit;cursor:pointer}
#od .od-empty{padding:22px;text-align:center;color:#7d8a9d;font-size:12.5px}
@media (max-height:520px),(max-width:560px){
  #od-back{padding:6px}#od{max-height:96dvh;border-radius:14px}
  #od header{padding:10px 12px 4px}#od header small{display:none}#od header h2{font-size:15px}
  #od .od-tabs{padding:0 12px 6px}#od .od-body{padding:2px 12px 8px;gap:9px}
  #od .od-it span{display:none}#od .od-it{min-height:44px;padding:8px 10px}
  #od footer{padding:8px 12px 10px}#od footer .od-total{font-size:16px}
  #od .od-kv{grid-template-columns:78px 1fr auto}
}
@media (max-width:560px){#od .od-grid{grid-template-columns:1fr}}`;
    let root = null,
      opener = null,
      info = null;
    const st = { tab: "new", items: new Set(), days: 7, busy: !1, pay: null };
    function build() {
      if (root) return;
      const s = document.createElement("style");
      s.id = "od-css";
      s.textContent = CSS;
      document.head.appendChild(s);
      root = document.createElement("div");
      root.id = "od-back";
      root.hidden = !0;
      root.innerHTML = `<div id="od" role="dialog" aria-modal="true" aria-labelledby="od-h"><header><div style="flex:1"><small>CHEAT SHOP</small><h2 id="od-h">${L("치트 구매", "Buy cheats")}</h2></div><button class="od-x" type="button" aria-label="${L("닫기", "Close")}">✕</button></header><div class="od-tabs"><button type="button" data-t="new" class="on">${L("주문하기", "Order")}</button><button type="button" data-t="mine">${L("내 주문", "My orders")}</button></div><div class="od-body" id="od-body"></div><footer id="od-foot"><div class="od-total" id="od-total"></div><span class="od-msg" id="od-msg"></span><button class="od-go" id="od-go" type="button">${L("주문하기", "Place order")}</button></footer></div>`;
      document.body.appendChild(root);
      root.addEventListener("click", (e) => { e.target === root && close(); });
      root.querySelector(".od-x").onclick = close;
      root.querySelectorAll(".od-tabs button").forEach((b) => (b.onclick = () => { st.tab = b.dataset.t; st.pay = null; paint(); }));
      root.querySelector("#od-go").onclick = submit;
      document.addEventListener("keydown", (e) => { "Escape" === e.key && root && !root.hidden && (e.stopPropagation(), close()); }, !0);
    }
    const item = (k) => (info && info.items.find((x) => x.k === k)) || {};
    // the cheats are priced by length, gold is paid once
    const cheatKeys = () => [...st.items].filter((k) => !item(k).gold);
    const total = () => {
      if (!info) return 0;
      const d = info.durations.find((x) => x.days === st.days),
        sum = (ks) => ks.reduce((n, k) => n + (item(k).price || 0), 0);
      return Math.round((sum(cheatKeys()) * (d ? d.mult : 0)) / 100) * 100 + sum([...st.items].filter((k) => item(k).gold));
    };
    const paintTotal = () => { root.querySelector("#od-total").innerHTML = `<small>${L("결제할 금액", "To pay")}</small>${won(total())}`; root.querySelector("#od-go").disabled = !st.items.size || !total(); };
    async function paint() {
      const body = root.querySelector("#od-body"),
        msg = root.querySelector("#od-msg"),
        foot = root.querySelector("#od-foot");
      root.querySelectorAll(".od-tabs button").forEach((b) => b.classList.toggle("on", b.dataset.t === st.tab));
      msg.textContent = "";
      msg.className = "od-msg";
      foot.hidden = "new" !== st.tab || !!st.pay;
      if (st.pay) return void pay(body, st.pay);
      if ("mine" === st.tab) return void mine(body);
      if (!info) { body.innerHTML = `<div class="od-empty">${L("불러오는 중…", "Loading…")}</div>`; try { info = await call("order_info", {}); } catch (e) { body.innerHTML = `<div class="od-empty">${esc(e.message === "offline" ? L("서버에 연결할 수 없습니다", "Cannot reach the server") : e.message)}</div>`; return; } }
      if (!info.on) { foot.hidden = !0; body.innerHTML = `<div class="od-empty">${L("지금은 판매하지 않습니다.", "Not on sale right now.")}</div>`; return; }
      body.innerHTML = `<div class="od-warn">${L("랭크전에서는 치트가 꺼집니다. 결제는 게임 밖에서 계좌이체로 하며, 입금을 확인한 운영자가 직접 열어 드립니다.", "Cheats are always off in ranked matches. You pay by bank transfer outside the game; the owner opens the cheats by hand once the money arrives.")}</div>
        <div class="od-grid" role="group">${info.items.map((x) => { return `<button type="button" class="od-it ${st.items.has(x.k) ? "on" : ""}" data-k="${x.k}" aria-pressed="${st.items.has(x.k)}"><i>${st.items.has(x.k) ? "✓" : ""}</i><div><b>${esc(x.name)}</b><span>${esc(x.desc)}</span></div><em>${won(x.price)}<br><small style="color:#6e7b8e;font-weight:600">${x.gold ? L("한 번", "once") : L("7일", "7 days")}</small></em></button>`; }).join("")}</div>
        ${cheatKeys().length || !st.items.size ? `<div class="od-dur" role="group" aria-label="${L("기간", "Length")}">${info.durations.map((d) => `<button type="button" data-d="${d.days}" class="${st.days === d.days ? "on" : ""}">${esc(d.label)}<small>× ${d.mult}</small></button>`).join("")}</div>` : ""}
        <label>${L("입금자명 (통장에 찍히는 이름)", "Name on the transfer")}<input id="od-dep" maxlength="20" value="${esc(st.dep || "")}" placeholder="${L("비워 두면 계정 이름", "Blank: your account name")}"></label>`;
      body.querySelectorAll(".od-it").forEach((b) => (b.onclick = () => {
        st.items.has(b.dataset.k) ? st.items.delete(b.dataset.k) : st.items.add(b.dataset.k);
        paint();
      }));
      body.querySelectorAll(".od-dur button").forEach((b) => (b.onclick = () => { st.days = +b.dataset.d; paint(); }));
      body.querySelector("#od-dep").oninput = (e) => (st.dep = e.target.value);
      paintTotal();
      const s = session();
      if (!s || !s.token || (s.user && s.user.guest)) { msg.textContent = L("계정으로 로그인해야 주문할 수 있습니다", "Sign in with an account to order"); msg.className = "od-msg err"; root.querySelector("#od-go").disabled = !0; }
    }
    function pay(body, p) {
      const o = p.order, pay = p.pay || {};
      body.innerHTML = `<div class="od-pay"><h3>${L("주문이 접수되었습니다. 아래 계좌로 입금해 주세요", "Order received — please transfer to this account")}</h3><div class="od-kv"><span>${L("은행·계좌", "Account")}</span><b>${esc(pay.bank)}</b><button type="button" data-copy="${esc(pay.bank)}">${L("복사", "Copy")}</button><span>${L("예금주", "Holder")}</span><b>${esc(pay.holder)}</b><i></i><span>${L("입금액", "Amount")}</span><b>${won(o.total)}</b><button type="button" data-copy="${o.total}">${L("복사", "Copy")}</button><span>${L("입금자명", "Sender name")}</span><b>${esc(o.depositor)}</b><i></i><span>${L("주문번호", "Order no.")}</span><b>${esc(o.id)}</b><i></i></div></div><div class="od-note">${esc(pay.note || "")}<br>${L("입금자명과 금액이 다르면 확인이 늦어질 수 있습니다. 확인되면 '내 주문'에 '열림'으로 바뀌고 치트가 계정에 적용됩니다.", "If the name or amount differs, it may take longer. Once it is confirmed the order shows Opened and the cheats are on your account.")}</div>`;
      body.querySelectorAll("[data-copy]").forEach((b) => (b.onclick = () => { try { navigator.clipboard.writeText(b.dataset.copy); b.textContent = L("복사됨", "Copied"); } catch (e) {} }));
      root.querySelector("#od-foot").hidden = !0;
    }
    async function mine(body) {
      body.innerHTML = `<div class="od-empty">${L("불러오는 중…", "Loading…")}</div>`;
      const s = session();
      if (!s || !s.token) return void (body.innerHTML = `<div class="od-empty">${L("로그인 후 볼 수 있습니다", "Sign in to see yours")}</div>`);
      try {
        if (!info) info = await call("order_info", {});
        const j = await call("order_mine", { token: s.token }),
          names = Object.assign({}, info.legacy || {}, Object.fromEntries((info.items || []).map((x) => [x.k, x.name]))),
          lasting = (o) => o.items.some((k) => !((info.items || []).find((x) => x.k === k) || {}).gold);
        const day = (d) => (d ? L(`${d}일`, `${d} days`) : L("영구", "permanent"));
        body.innerHTML = (j.perm ? `<div class="od-warn" style="border-color:rgba(74,222,128,.4);background:rgba(74,222,128,.08);color:#b6f2c8">${L("지금 쓸 수 있는 치트가 있습니다", "You have cheats on")}${j.perm.until ? " · " + L("기한 ", "until ") + new Date(j.perm.until).toLocaleDateString(EN ? "en" : "ko-KR") : " · " + L("영구", "permanent")}</div>` : "") +
          (j.orders.length ? j.orders.map((o) => { const t = STATUS[o.status] || STATUS.pending; return `<div class="od-item"><div class="t"><b>${esc(o.items.map((k) => names[k] || k).join(" · "))}</b><em style="color:${t[1]}">${esc(t[0])}</em></div><small>${esc(o.id)} · ${lasting(o) ? day(o.days) + " · " : ""}${won(o.total)} · ${L("입금자", "from")} ${esc(o.depositor)} · ${new Date(o.t).toLocaleString(EN ? "en" : "ko-KR", { dateStyle: "medium", timeStyle: "short" })}${o.reason ? `<br>${esc(o.reason)}` : ""}</small>${"pending" === o.status ? `<button type="button" data-cancel="${esc(o.id)}">${L("주문 취소", "Cancel order")}</button>` : ""}</div>`; }).join("") : `<div class="od-empty">${L("아직 주문이 없습니다", "No orders yet")}</div>`) +
          (j.pay ? `<div class="od-pay"><h3>${L("입금 계좌", "Pay to")}</h3><div class="od-kv"><span>${L("은행·계좌", "Account")}</span><b>${esc(j.pay.bank)}</b><i></i><span>${L("예금주", "Holder")}</span><b>${esc(j.pay.holder)}</b><i></i></div></div>` : "");
        body.querySelectorAll("[data-cancel]").forEach((b) => (b.onclick = async () => { try { await call("order_cancel", { token: s.token, id: b.dataset.cancel }); mine(body); } catch (e) { b.textContent = e.message; } }));
      } catch (e) {
        body.innerHTML = `<div class="od-empty">${esc("offline" === e.message ? L("서버에 연결할 수 없습니다", "Cannot reach the server") : e.message)}</div>`;
      }
    }
    async function submit() {
      if (st.busy) return;
      const s = session(),
        msg = root.querySelector("#od-msg"),
        go = root.querySelector("#od-go");
      msg.className = "od-msg";
      if (!s || !s.token || (s.user && s.user.guest)) { msg.textContent = L("계정으로 로그인해야 합니다", "Sign in with an account"); msg.className = "od-msg err"; return; }
      st.busy = !0;
      go.disabled = !0;
      try {
        const j = await call("order_create", { token: s.token, items: [...st.items], days: st.days, depositor: st.dep || "" });
        st.pay = j;
        st.items = new Set();
        paint();
      } catch (e) {
        msg.textContent = "offline" === e.message ? L("서버에 연결할 수 없습니다", "Cannot reach the server") : e.message;
        msg.className = "od-msg err";
        go.disabled = !1;
      } finally {
        st.busy = !1;
      }
    }
    function open(o) {
      build();
      opener = document.activeElement;
      st.tab = (o && o.tab) || "new";
      st.pay = null;
      info = null;
      root.hidden = !1;
      paint();
      setTimeout(() => { const f = root.querySelector(".od-it") || root.querySelector(".od-x"); f && f.focus(); }, 40);
    }
    function close() { if (root) { root.hidden = !0; opener && opener.focus && opener.focus(); } }
    return { open, close, destroy: () => { root && root.remove(); const c = document.getElementById("od-css"); c && c.remove(); root = null; }, en: EN };
  }
  let inst = null;
  window.ORDERS = {
    open(o) { const en = curEn(); if (!inst || inst.en !== en) { inst && inst.destroy(); inst = create(en); } inst.open(o); },
    close() { inst && inst.close(); },
    // is the shop open? (the entries stay hidden until the owner opens it)
    async isOn() {
      try {
        const f = window.GAME_REQUEST || (async (u, o) => { const r = await fetch(u, o); return { response: r, data: await r.json() }; });
        const { data } = await f(API + "?a=order_info", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        return !!(data && data.ok && data.on);
      } catch (e) { return !1; }
    },
  };
})();
