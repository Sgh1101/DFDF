(() => {
  // Profile cosmetics: a 꾸미기 tab in the armoury where a title, a name card and a kill effect
  // are bought for gold (the server keeps what is owned and what is on) and put on. A title
  // shows under your name on the homepage and on the result screen, a name card is the
  // background of your profile there, a kill effect re-colours the kill banner. They show to you
  // only. The catalogue (names and looks) is js/cosmetics.js.
  if (!window.COSMETICS || !window.ACCOUNT || "function" != typeof ACCOUNT.session) return;
  const C = window.COSMETICS,
    EN = "en" === window.GAME_LANG,
    L = (ko, en) => (EN ? en : ko),
    $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  const session = () => {
    try {
      return ACCOUNT.session() || null;
    } catch (e) {
      return null;
    }
  };
  const token = () => (session() && session().token) || "";
  const me = () => (session() && session().user) || null;
  const signed = () => {
    const o = ACCOUNT.online;
    return !!token() && ("function" == typeof o ? !!o() : !!o);
  };
  const S = { items: [], on: !0, own: [], eq: { title: "", card: "", banner: "" }, loaded: 0, busy: !1, sel: null, arm: null, armT: 0, msg: "" };
  const price = (id) => ((S.items.find((x) => x.id === id) || {}).price | 0);
  const owned = (id) => S.own.includes(id);
  const gold = () => {
    const u = me();
    return u && "number" == typeof u.gold ? u.gold : 0;
  };
  // the account's own copy (sent with every profile) is what the effects read
  const mine = () => C.equipped(me());
  function take(j) {
    if (!j) return;
    Array.isArray(j.own) && (S.own = j.own);
    j.eq && (S.eq = j.eq);
    try {
      const s = session();
      if (s && j.user) {
        s.user = j.user;
        localStorage.setItem("lgp_session", JSON.stringify(s));
      } else if (s && s.user) {
        s.user.cos = { own: S.own, eq: S.eq };
        "number" == typeof j.gold && (s.user.gold = j.gold);
        localStorage.setItem("lgp_session", JSON.stringify(s));
      }
    } catch (e) {}
    try {
      window.GUN_SKINS && GUN_SKINS.sync && GUN_SKINS.sync();
    } catch (e) {}
  }
  async function load(force) {
    if (!force && S.loaded && Date.now() - S.loaded < 30000) return paint();
    try {
      const j = await ACCOUNT.api("cos", token() ? { token: token() } : {});
      S.items = j.items || [];
      S.on = !1 !== j.on;
      S.own = j.own || [];
      S.eq = j.eq || S.eq;
      S.loaded = Date.now();
      S.msg = "";
    } catch (e) {
      S.msg = (e && e.message) || L("불러오지 못했습니다", "Could not load");
    }
    paint();
  }

  // ── the tab ──
  const css = document.createElement("style");
  css.textContent = `
#ar-p-cos .cs-wrap{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;gap:12px;overflow:auto;padding-right:4px}
#ar-p-cos .cs-sec h4{margin:0 0 8px;font:700 12px/1.2 var(--f-display,system-ui);letter-spacing:.14em;color:var(--steel)}
#ar-p-cos .cs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
#ar-p-cos .cs-it{position:relative;display:flex;flex-direction:column;gap:6px;padding:8px;border:1px solid var(--line);border-bottom:2px solid var(--rc,var(--line));border-radius:12px;background:var(--panel);text-align:left;cursor:pointer;min-width:0;color:var(--ink)}
#ar-p-cos .cs-it:hover{border-color:var(--steel-dim);border-bottom-color:var(--rc)}
#ar-p-cos .cs-it.on{box-shadow:0 0 0 2px var(--gold)}
#ar-p-cos .cs-it.worn::after{content:attr(data-w);position:absolute;top:6px;right:6px;padding:1px 7px;border-radius:99px;background:var(--gold);color:#14100a;font:700 9px/1.6 var(--f-display)}
#ar-p-cos .cs-pv{height:48px;border-radius:8px;display:grid;place-items:center;overflow:hidden;background:#0d1118;font:700 13px/1 var(--f-display,system-ui);color:#fff;text-align:center;padding:0 6px}
#ar-p-cos .cs-it b{font-size:12px}
#ar-p-cos .cs-it i{font-style:normal;font-size:10px;color:var(--rc)}
#ar-p-cos .cs-it em{font-style:normal;font-family:var(--f-display);font-size:11px;font-weight:700;color:#ffc849}
#ar-p-cos .cs-bar{flex:0 0 auto;display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:10px 12px;border:1px solid var(--line);border-radius:14px;background:var(--panel)}
#ar-p-cos .cs-bar .cs-pv{width:150px;height:52px}
#ar-p-cos .cs-bar p{margin:0;font-size:12px;color:var(--steel);flex:1 1 200px}
#ar-p-cos .cs-bar .btn{min-height:40px}
#ar-p-cos .cs-arm{background:#ff6b3d!important;border-color:#ff6b3d!important;color:#fff!important}
#ar-p-cos .cs-note{font-size:12px;color:var(--steel);padding:30px 10px;text-align:center}`;
  document.head.appendChild(css);

  function preview(x, big) {
    if ("title" === x.s) return `<div class="cs-pv"><span style="color:${C.tier(x.r)[2]}">${esc(C.name(x))}</span></div>`;
    if ("card" === x.s) return `<div class="cs-pv" style="background:${x.css}"><span style="text-shadow:0 1px 6px #000">${esc((me() && me().id) || "NAME")}</span></div>`;
    const b = x;
    return `<div class="cs-pv" style="background:${b.dark ? "rgba(244,244,239,.92)" : `linear-gradient(180deg,rgba(${b.g},.35),rgba(${b.g},.12))`};border:2px solid ${b.c};box-shadow:0 0 16px -4px ${b.c};color:${b.dark ? "#14161c" : "#fff"}"><span style="text-shadow:${b.dark ? "none" : `0 0 12px ${b.c}`}">${L("처치", "KILL")}</span></div>`;
  }
  function cardOf(x) {
    const has = owned(x.id),
      worn = S.eq[x.s] === x.id,
      t = C.tier(x.r),
      b = document.createElement("button");
    b.className = "cs-it" + (S.sel === x.id ? " on" : "") + (worn ? " worn" : "");
    b.dataset.id = x.id;
    b.dataset.w = L("착용 중", "On");
    b.style.setProperty("--rc", t[2]);
    b.innerHTML = `${preview(x)}<b>${esc(C.name(x))}</b><i>${esc(EN ? t[1] : t[0])}</i>${has ? `<em style="color:#4ade80">${L("보유", "Owned")}</em>` : `<em>🪙 ${price(x.id).toLocaleString()}</em>`}`;
    b.onclick = () => {
      S.sel = x.id;
      S.arm = null;
      paint();
    };
    return b;
  }
  function paint() {
    const p = $("ar-p-cos");
    if (!p || p.hidden && !S.force) return;
    if (!signed()) {
      p.innerHTML = `<div class="cs-note">${L("로그인하면 칭호·네임카드·킬 효과를 골드로 살 수 있습니다", "Sign in to buy titles, name cards and kill effects with gold")}</div>`;
      return;
    }
    if (S.msg && !S.items.length) {
      p.innerHTML = `<div class="cs-note">${esc(S.msg)}</div>`;
      return;
    }
    if (!S.on) {
      p.innerHTML = `<div class="cs-note">${L("지금은 꾸미기 상점이 닫혀 있습니다", "The cosmetics shop is closed for now")}</div>`;
      return;
    }
    p.innerHTML = `<div class="cs-wrap" id="cs-wrap"></div><div class="cs-bar" id="cs-bar"></div>`;
    const w = $("cs-wrap");
    for (const s of C.slots) {
      const sec = document.createElement("div");
      sec.className = "cs-sec";
      sec.innerHTML = `<h4>${esc(C.slotName(s))}</h4><div class="cs-grid"></div>`;
      const g = sec.querySelector(".cs-grid");
      for (const x of C.items.filter((y) => y.s === s).sort((a, b) => a.r - b.r)) S.items.some((y) => y.id === x.id) && g.appendChild(cardOf(x));
      w.appendChild(sec);
    }
    bar();
  }
  function bar() {
    const el = $("cs-bar");
    if (!el) return;
    const x = S.sel && C.by[S.sel];
    if (!x) return void (el.innerHTML = `<p>${L("아이템을 눌러 미리 보고, 사거나 착용합니다. 칭호는 이름 아래에, 네임카드는 프로필 배경에, 킬 효과는 처치 배너에 나옵니다 (본인 화면에만 보입니다).", "Pick one to preview it, buy it or put it on. A title sits under your name, a name card is your profile background, a kill effect colours the kill banner (you see them; others do not).")}</p>`);
    const has = owned(x.id),
      worn = S.eq[x.s] === x.id,
      pr = price(x.id),
      short = Math.max(0, pr - gold()),
      armed = S.arm === x.id && Date.now() - S.armT < 4000;
    el.innerHTML = `${preview(x)}<p><b>${esc(C.name(x))}</b> · ${esc(C.slotName(x.s))}<br>${has ? (worn ? L("착용 중입니다", "Worn now") : L("가지고 있습니다", "Owned")) : short ? L(`골드 ${short.toLocaleString()} 부족 · 경기와 미션으로 모으세요`, `${short.toLocaleString()} gold short · earn it in matches and missions`) : L(`🪙 ${pr.toLocaleString()} · 내 골드 🪙 ${gold().toLocaleString()}`, `🪙 ${pr.toLocaleString()} · you have 🪙 ${gold().toLocaleString()}`)}</p>${has ? `<button class="btn btn-go" id="cs-eq"${S.busy ? " disabled" : ""}>${worn ? L("벗기", "Take off") : L("착용", "Put on")}</button>` : `<button class="btn btn-go${armed ? " cs-arm" : ""}" id="cs-buy"${short || S.busy ? " disabled" : ""}>${armed ? L(`한 번 더 누르면 구매 · 🪙 ${pr.toLocaleString()}`, `Tap again to buy · 🪙 ${pr.toLocaleString()}`) : L(`구매 · 🪙 ${pr.toLocaleString()}`, `Buy · 🪙 ${pr.toLocaleString()}`)}</button>`}`;
    const eq = $("cs-eq"),
      buy = $("cs-buy");
    eq && (eq.onclick = () => equip(x.s, worn ? "" : x.id));
    buy &&
      (buy.onclick = () => {
        if (!(S.arm === x.id && Date.now() - S.armT < 4000)) {
          S.arm = x.id;
          S.armT = Date.now();
          bar();
          setTimeout(() => S.arm === x.id && Date.now() - S.armT >= 4000 && ((S.arm = null), bar()), 4100);
          return;
        }
        purchase(x.id);
      });
  }
  async function purchase(id) {
    if (S.busy) return;
    S.busy = !0;
    S.arm = null;
    bar();
    try {
      const j = await ACCOUNT.api("cos_buy", { token: token(), id });
      take(j);
      // a new buy is put on at once
      const x = C.by[id];
      x && !S.eq[x.s] && (await equip(x.s, id, !0));
      toast(L(`구매했습니다 · ${C.name(C.by[id])}`, `Bought · ${C.name(C.by[id])}`));
    } catch (e) {
      toast((e && e.message) || L("구매하지 못했습니다", "The purchase failed"));
    }
    S.busy = !1;
    paint();
  }
  async function equip(slot, id, quiet) {
    if (S.busy && !quiet) return;
    !quiet && (S.busy = !0);
    try {
      take(await ACCOUNT.api("cos_equip", { token: token(), slot, id }));
      !quiet && toast(id ? L("착용했습니다", "Put on") : L("벗었습니다", "Taken off"));
    } catch (e) {
      !quiet && toast((e && e.message) || L("바꾸지 못했습니다", "Could not change it"));
    }
    !quiet && (S.busy = !1);
    paint();
    wear();
  }
  function toast(msg) {
    try {
      const t = $("ar-toast");
      if (t && window.GUN_SKINS && GUN_SKINS.isOpen()) {
        t.textContent = msg;
        t.classList.add("on");
        setTimeout(() => t.classList.remove("on"), 2200);
      } else banner(msg, "#8a97ab");
    } catch (e) {}
  }
  const tabs = ["pull", "shop", "mine", "gun"];
  function mount() {
    const nav = $("ar-tabs"),
      shop = $("ar-p-shop");
    if (!nav || !shop || $("ar-tab-cos")) return;
    const b = document.createElement("button");
    b.className = "ar-tab";
    b.id = "ar-tab-cos";
    b.dataset.tab = "cos";
    b.textContent = L("꾸미기", "Style");
    nav.appendChild(b);
    const pane = document.createElement("section");
    pane.className = "ar-pane";
    pane.id = "ar-p-cos";
    pane.hidden = !0;
    shop.parentElement.appendChild(pane);
    const show = (on) => {
      pane.hidden = !on;
      b.classList.toggle("on", on);
      if (on) {
        for (const k of tabs) {
          const p = $("ar-p-" + k);
          p && (p.hidden = !0);
        }
        for (const t of nav.querySelectorAll(".ar-tab")) t !== b && t.classList.remove("on");
        S.force = !0;
        load(!1);
        S.force = !1;
      }
    };
    b.addEventListener("click", (e) => {
      e.stopImmediatePropagation();
      show(!0);
    }, !0);
    for (const t of nav.querySelectorAll(".ar-tab")) t !== b && t.addEventListener("click", () => show(!1));
    window.__csShow = show;
  }
  setInterval(() => {
    try {
      mount();
      wear();
    } catch (e) {}
  }, 800);
  // from the homepage: play.html#cos opens the armoury at this tab
  function openLink() {
    if ("#cos" !== location.hash || document.documentElement.dataset.gameLoading || !window.GUN_SKINS) return;
    const tt = $("s-title");
    if ("menu" === world.phase && tt && !tt.hidden && "none" !== getComputedStyle(tt).display) {
      try {
        history.replaceState(null, "", location.pathname + location.search);
      } catch (e) {}
      GUN_SKINS.open(null, "pull");
      setTimeout(() => (mount(), window.__csShow && window.__csShow(!0)), 200);
    }
  }
  addEventListener("hashchange", openLink);
  setInterval(openLink, 1000);

  // ── what is on ──
  // the kill banner: the equipped effect's colours over the skin's own
  const rules = C.items
    .filter((x) => "banner" === x.s)
    .map((b) => {
      const k = `#killfx.kx-${b.id}`;
      return `${k} #kf-badge{background:${b.dark ? "rgba(244,244,239,.94)" : `linear-gradient(180deg,rgba(${b.g},.38),rgba(${b.g},.12))`};border:2px solid ${b.c};box-shadow:0 0 34px -4px ${b.c}${"stars" === b.id ? ",0 0 0 1px rgba(255,255,255,.4)" : ""}}${k} #kf-main{color:${b.dark ? "#14161c" : "#fff"};text-shadow:${b.dark ? "none" : `0 0 18px ${b.c},0 0 3px #fff`}}${k} #kf-sub{color:${b.dark ? "#3a3f4a" : b.c}}${k} #kf-badge::after{display:none}${k} #kf-main::before,${k} #kf-main::after{color:${b.c};filter:drop-shadow(0 0 5px ${b.c})}${"stars" === b.id ? `${k} #kf-badge{background:radial-gradient(1px 1px at 15% 30%,#fff,transparent),radial-gradient(1.5px 1.5px at 70% 20%,#fff,transparent),radial-gradient(1px 1px at 45% 80%,#fff,transparent),linear-gradient(120deg,#1a0f3a,#3b2a7a 60%,#7c4dff)}` : ""}${"neonpink" === b.id || "flame" === b.id ? `${k} #kf-badge{animation:kfPulse 1.1s ease-in-out infinite}` : ""}`;
    });
  const st = document.createElement("style");
  st.textContent = rules.join("\n");
  document.head.appendChild(st);
  if ("function" == typeof playKillFx) {
    const _pk = playKillFx;
    playKillFx = function () {
      const r = _pk.apply(this, arguments);
      try {
        const o = $("killfx");
        if (o) {
          for (const c of [...o.classList]) c.startsWith("kx-") && o.classList.remove(c);
          const b = mine().banner;
          b && o.classList.add("kx-" + b.id);
        }
      } catch (e) {}
      return r;
    };
  }
  // the result screen: title and name on the card the player chose
  const _go = gameOver;
  gameOver = function () {
    const r = _go.apply(this, arguments);
    try {
      let el = $("ov-who");
      const E = mine(),
        u = me();
      if (!el) {
        el = document.createElement("div");
        el.id = "ov-who";
        el.style.cssText = "margin-top:14px;padding:7px 18px;border-radius:999px;font:700 14px/1.2 var(--f-display,system-ui);letter-spacing:.06em;color:#e8edf5;border:1px solid rgba(255,255,255,.18)";
        const sc = $("ov-score");
        sc && sc.after(el);
      }
      if (u && (E.title || E.card)) {
        el.hidden = !1;
        el.style.background = E.card ? E.card.css : "rgba(255,255,255,.04)";
        el.innerHTML = `${E.title ? `<span style="color:${C.tier(E.title.r)[2]}">${esc(C.name(E.title))}</span> · ` : ""}${esc(u.id || "")}`;
      } else el && (el.hidden = !0);
    } catch (e) {}
    return r;
  };
  function wear() {}
  window.COSMETIC_SHOP = { S, load, purchase, equip, mine, mount };
})();
