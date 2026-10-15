
(() => {
  // Daily and weekly missions. The server counts them from each match report
  // (matches, kills, wins) and pays the gold when one is claimed; here, a
  // 미션 chip on the title screen (with how many are ready), the window with
  // both lists, progress bars, the time left and the 받기 buttons, and a
  // banner when a match finishes one.
  if (!window.ACCOUNT || "function" != typeof ACCOUNT.api) return;
  const EN = "en" === window.GAME_LANG,
    L = (ko, en) => (EN ? en : ko);
  const $ = (id) => document.getElementById(id);
  const sess = () => {
    try {
      return ACCOUNT.session() || null;
    } catch (e) {
      return null;
    }
  };
  const token = () => {
    const s = sess();
    return (s && s.token) || "";
  };
  const user = () => {
    const s = sess();
    return (s && s.user) || null;
  };
  const phase = () => ("undefined" != typeof world && world ? world.phase : "");
  const save = (u) => {
    try {
      const s = sess();
      if (!s || !u) return;
      s.user = u;
      localStorage.setItem("lgp_session", JSON.stringify(s));
    } catch (e) {}
  };
  const TXT = {
    play: (n) => L(`경기 ${n}판 하기`, `Play ${n} match${n > 1 ? "es" : ""}`),
    kills: (n) => L(`적 ${n}명 처치`, `Get ${n} kill${n > 1 ? "s" : ""}`),
    wins: (n) => L(`${n}번 승리`, `Win ${n} time${n > 1 ? "s" : ""}`),
  };
  const ICON = { play: "M5 4l14 8-14 8z", kills: "M12 3v4M12 17v4M3 12h4M17 12h4M12 8a4 4 0 1 0 .01 0", wins: "M7 4h10v4a5 5 0 0 1-10 0zM5 5H3v2a3 3 0 0 0 3 3M19 5h2v2a3 3 0 0 1-3 3M12 13v4M8 21h8M9 17h6" };
  const left = (t) => {
    const s = Math.max(0, Math.round((t - Date.now()) / 1e3)),
      d = Math.floor(s / 86400),
      h = Math.floor((s % 86400) / 3600),
      m = Math.floor((s % 3600) / 60);
    return d > 0 ? L(`${d}일 ${h}시간`, `${d}d ${h}h`) : h > 0 ? L(`${h}시간 ${m}분`, `${h}h ${m}m`) : L(`${m}분`, `${m}m`);
  };

  // ── look ──
  const css = document.createElement("style");
  css.textContent = `
#mis-chip{position:fixed;top:10px;z-index:40;display:none;align-items:center;gap:6px;padding:5px 12px 5px 9px;border-radius:99px;background:rgba(20,25,34,.86);border:1px solid #2a3444;color:#e8edf4;font:600 12px/1 var(--f-display,system-ui);letter-spacing:.03em;cursor:pointer}
#mis-chip svg{width:15px;height:15px;stroke:#ffc849;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
#mis-chip b{display:none;min-width:17px;height:17px;padding:0 4px;border-radius:99px;background:#ff4d6d;color:#fff;font-size:11px;line-height:17px;text-align:center}
#mis-chip.ready b{display:inline-block}
#mis-chip.ready{border-color:#ffc84988;box-shadow:0 0 14px rgba(255,200,73,.25)}
#mis{position:fixed;inset:0;z-index:80;display:none;place-items:center;background:rgba(5,7,10,.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);padding:12px}
#mis.on{display:grid}
#mis .ms-card{width:min(560px,96vw);max-height:92vh;overflow:auto;border-radius:18px;border:1px solid var(--stroke2,#2a3444);background:var(--glass2,#121722);box-shadow:0 40px 90px -30px rgba(0,0,0,.9);padding:16px 18px 18px;color:#e8edf4;text-align:left}
#mis .ms-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;position:sticky;top:-16px;background:var(--glass2,#121722);padding:4px 0 8px;z-index:1}
#mis h3{margin:0;font:700 17px var(--f-display,system-ui);letter-spacing:.08em}
#mis .ms-x{width:34px;height:34px;border-radius:10px;border:1px solid #2a3444;background:rgba(255,255,255,.04);color:#e8edf4;font-size:18px;cursor:pointer}
#mis .ms-sec{display:flex;justify-content:space-between;align-items:baseline;margin:12px 2px 6px;font-size:12px;color:#8a97ab}
#mis .ms-sec b{color:#e8edf4;font-size:13px;letter-spacing:.06em}
#mis .ms-row{display:flex;align-items:center;gap:11px;padding:10px 12px;border:1px solid #232c3a;border-radius:12px;background:rgba(255,255,255,.025);margin-bottom:6px}
#mis .ms-row.done{border-color:#ffc84966;background:rgba(255,200,73,.06)}
#mis .ms-row.got{opacity:.5}
#mis .ms-ic{flex:none;width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:rgba(255,255,255,.05)}
#mis .ms-ic svg{width:17px;height:17px;stroke:#ffc849;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
#mis .ms-mid{flex:1;min-width:0}
#mis .ms-t{font-size:13px;font-weight:600;display:flex;justify-content:space-between;gap:8px}
#mis .ms-t span{color:#8a97ab;font-weight:500;font-size:12px}
#mis .ms-bar{height:6px;border-radius:99px;background:rgba(255,255,255,.08);margin-top:6px;overflow:hidden}
#mis .ms-bar i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#ffb020,#ffc849)}
#mis .ms-btn{flex:none;min-width:74px;height:36px;border-radius:10px;border:1px solid #2a3444;background:rgba(255,255,255,.04);color:#8a97ab;font:700 12px var(--f-display,system-ui);cursor:default}
#mis .ms-btn.on{background:#ffc849;border-color:#ffc849;color:#14171d;cursor:pointer}
#mis .ms-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:12px;font-size:12px;color:#8a97ab}
#mis .ms-all{height:38px;padding:0 16px;border-radius:10px;border:none;background:#ffc849;color:#14171d;font:700 13px var(--f-display,system-ui);cursor:pointer}
#mis .ms-all[disabled]{opacity:.35;cursor:default}
#mis .ms-msg{min-height:16px;font-size:12px;color:#ff8a9a;margin-top:6px}
@media (max-height:480px){#mis .ms-card{padding:10px 12px 12px}#mis .ms-row{padding:7px 10px}#mis .ms-sec{margin:8px 2px 4px}#mis h3{font-size:15px}}`;
  document.head.appendChild(css);

  const chip = document.createElement("button");
  chip.id = "mis-chip";
  chip.innerHTML = `<svg viewBox="0 0 24 24"><path d="M9 4h6v3H9zM6 6h12v15H6zM9 12l2 2 4-4M9 17h6"/></svg><span>${L("미션", "Missions")}</span><b></b>`;
  document.body.appendChild(chip);
  const box = document.createElement("div");
  box.id = "mis";
  box.innerHTML = `<div class="ms-card" role="dialog" aria-label="${L("미션", "Missions")}"><div class="ms-head"><h3>${L("미션", "MISSIONS")}</h3><button class="ms-x" aria-label="${L("닫기", "Close")}">✕</button></div><div class="ms-body"></div><div class="ms-msg"></div><div class="ms-foot"><span class="ms-gold"></span><button class="ms-all">${L("모두 받기", "Claim all")}</button></div></div>`;
  document.body.appendChild(box);

  const M = { st: null, busy: !1, loading: !1, at: 0 };
  function row(x) {
    const pct = Math.round((100 * x.have) / x.n),
      b = x.got ? L("받음", "Claimed") : x.done ? L(`받기 ${x.gold}`, `Claim ${x.gold}`) : `🪙 ${x.gold}`;
    return `<div class="ms-row ${x.got ? "got" : x.done ? "done" : ""}"><div class="ms-ic"><svg viewBox="0 0 24 24"><path d="${ICON[x.stat] || ICON.play}"/></svg></div><div class="ms-mid"><div class="ms-t">${TXT[x.stat] ? TXT[x.stat](x.n) : x.id}<span>${x.have}/${x.n}</span></div><div class="ms-bar"><i style="width:${pct}%"></i></div></div><button class="ms-btn ${x.done && !x.got ? "on" : ""}" data-id="${x.id}">${b}</button></div>`;
  }
  function draw() {
    const st = M.st,
      body = box.querySelector(".ms-body");
    if (!st) return void (body.innerHTML = `<div class="ms-sec">${token() ? L("불러오는 중…", "Loading…") : L("로그인하면 미션을 할 수 있습니다", "Sign in to play missions")}</div>`);
    const d = st.list.filter((x) => "d" === x.per),
      w = st.list.filter((x) => "w" === x.per);
    body.innerHTML =
      (d.length ? `<div class="ms-sec"><b>${L("일일 미션", "DAILY")}</b><span>${L("초기화까지", "resets in")} ${left(st.dayEnd)}</span></div>${d.map(row).join("")}` : "") +
      (w.length ? `<div class="ms-sec"><b>${L("주간 미션", "WEEKLY")}</b><span>${L("초기화까지", "resets in")} ${left(st.weekEnd)}</span></div>${w.map(row).join("")}` : "");
    const u = user();
    box.querySelector(".ms-gold").textContent = u ? `🪙 ${u.gold || 0}` : "";
    box.querySelector(".ms-all").disabled = !st.ready || M.busy;
  }
  const msg = (t) => (box.querySelector(".ms-msg").textContent = t || "");
  async function load() {
    if (!token() || M.loading || M.busy) return draw();
    M.loading = true;
    const ownerToken = token();
    try {
      const j = await ACCOUNT.api("missions", { token: ownerToken });
      if (token() !== ownerToken) return;
      M.st = j.missions;
      M.at = Date.now();
      j.user && save(j.user);
    } catch (e) {
      msg(e.message || "");
    } finally { M.loading = false; }
    draw();
  }
  async function claim(id) {
    if (M.busy || M.loading || !token()) return;
    M.busy = !0;
    msg("");
    try {
      const j = await ACCOUNT.api("mission_claim", { token: token(), id });
      M.st = j.missions;
      j.user && save(j.user);
      try {
        "function" == typeof banner && banner(L(`미션 보상 🪙 +${j.gold}`, `Mission reward 🪙 +${j.gold}`), "#ffc849");
        "undefined" != typeof SFX && SFX.pick && SFX.pick();
      } catch (e) {}
    } catch (e) {
      msg(e.message || "");
    }
    M.busy = !1;
    draw();
  }
  function open() {
    box.classList.add("on");
    draw();
    load();
  }
  const close = () => box.classList.remove("on");
  chip.onclick = open;
  box.querySelector(".ms-x").onclick = close;
  box.addEventListener("click", (e) => {
    if (e.target === box) return close();
    const b = e.target.closest(".ms-btn.on");
    b && claim(b.dataset.id);
  });
  box.querySelector(".ms-all").onclick = () => claim("all");
  addEventListener("keydown", (e) => "Escape" === e.key && box.classList.contains("on") && (close(), e.stopPropagation()), !0);

  // ── the chip on the title screen, left of the other chips ──
  function place() {
    const u = user(),
      t = $("s-title"),
      show = !!(u && token()) && "menu" === phase() && t && !t.hidden && "none" !== getComputedStyle(t).display;
    if (!show) return void (chip.style.display = "none");
    const n = u.misReady | 0;
    chip.classList.toggle("ready", n > 0);
    chip.querySelector("b").textContent = n || "";
    let right = 12;
    for (const id of ["acct-chip", "gold-chip", "rank-chip"]) {
      const o = $(id);
      o && o.offsetWidth && "none" !== o.style.display && (right = Math.max(right, (parseFloat(o.style.right) || 12) + o.offsetWidth + 8));
    }
    chip.style.right = right + "px";
    chip.style.display = "flex";
  }
  // a match that finishes a mission says so on the result screen
  let lastReady = -1;
  setInterval(() => {
    try {
      place();
      const u = user(),
        n = u ? u.misReady | 0 : 0;
      if ("over" === phase() && lastReady >= 0 && n > lastReady) setTimeout(() => "function" == typeof banner && banner(L(`미션 완료! 보상을 받으세요 (${n})`, `Mission complete! Claim your reward (${n})`), "#ffc849"), 4200);
      lastReady = n;
      box.classList.contains("on") && M.st && Date.now() - M.at > 6e4 && load();
    } catch (e) {}
  }, 600);
  window.MISSIONS = { open, close, load, claim, state: M };
})();
