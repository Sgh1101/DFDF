
(() => {
  // The rank. Each match report moves the account's rank rating (RR) on the
  // server: a win lifts it (more with kills), a loss takes a little. 100 RR is
  // a division, three divisions a tier, Iron to Immortal, then Radiant. Here:
  // the RR the match brought on the result screen, a banner on a promotion or
  // a demotion, and the tier next to the gold on the title screen.
  if (!window.ACCOUNT || "function" != typeof ACCOUNT.session) return;
  const EN = "en" === window.GAME_LANG,
    L = (ko, en) => (EN ? en : ko);
  const $ = (id) => document.getElementById(id);
  const NAMES = EN ? ["Iron", "Bronze", "Silver", "Gold", "Platinum", "Diamond", "Ascendant", "Immortal", "Radiant"] : ["아이언", "브론즈", "실버", "골드", "플래티넘", "다이아몬드", "초월자", "불멸", "레디언트"];
  const COL = ["#8a8f98", "#c07a4a", "#c9d3de", "#ffc849", "#3fd0c9", "#b48cff", "#3ddc84", "#ff4d6d", "#fff3a0"];
  const nameOf = (r) => NAMES[r.t] + (r.div ? " " + r.div : "");
  const step = (r) => (r.t >= 8 ? 24 : r.t * 3 + (r.div || 1) - 1);
  // a gem in the tier's colour, more points the higher, a pip a division (as on the homepage)
  function badge(t, div, px) {
    const c = COL[t] || COL[0],
      n = t >= 8 ? 8 : 4 + Math.floor(t / 2),
      id = "rkg" + t + "_" + Math.round(Math.random() * 1e6);
    let star = "";
    for (let i = 0; i < 2 * n; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / n,
        r = i % 2 ? 5 : 11 + (t >= 8 ? 3 : 0);
      star += (i ? "L" : "M") + (24 + r * Math.cos(a)).toFixed(1) + " " + (22 + r * Math.sin(a)).toFixed(1);
    }
    let pips = "";
    for (let i = 0; i < (div || 0); i++) {
      const x = 24 + (i - (div - 1) / 2) * 7;
      pips += `<path d="M${x} 33l2.6 2.6-2.6 2.6-2.6-2.6z" fill="#fff" opacity=".9"/>`;
    }
    return `<svg viewBox="0 0 48 48" width="${px}" height="${px}" style="vertical-align:middle;filter:drop-shadow(0 0 6px ${c}88)" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".35" stop-color="${c}"/><stop offset="1" stop-color="#0c1018"/></linearGradient></defs><path d="M24 2l19 10.5v23L24 46 5 35.5v-23z" fill="url(#${id})" stroke="${c}" stroke-width="1.5"/><path d="M24 7l15 8.3v17.4L24 41 9 32.7V15.3z" fill="#0c1018" opacity=".45"/><path d="${star}Z" fill="${c}" stroke="#fff" stroke-opacity=".6" stroke-width=".8"/>${pips}</svg>`;
  }
  const user = () => {
    try {
      const s = ACCOUNT.session();
      return (s && s.user) || null;
    } catch (e) {
      return null;
    }
  };
  const phase = () => ("undefined" != typeof world && world ? world.phase : "");

  // ── the result screen and the banner ──
  // While a match runs, keep the rank it started from; once it is over, the
  // report's answer replaces the signed-in user, and the difference shows.
  const R = { base: null, baseUser: null, last: -1 };
  function overCell() {
    const u = user(),
      ph = phase();
    if ("over" !== ph) {
      R.base = u && u.rank ? u.rank : null;
      R.baseUser = u;
      R.last = R.base ? step(R.base) : -1;
      const c = $("ov-rank");
      c && (c.hidden = !0);
      return;
    }
    if (!u || !u.rank || !R.base || u === R.baseUser) return;
    // RR moves in ranked matches only: no cell for a normal one
    const h0 = ((ACCOUNT.session() || {}).hist || [])[0];
    if (!(h0 && h0.rk)) {
      const c0 = $("ov-rank");
      return void (c0 && (c0.hidden = !0));
    }
    const st = document.querySelector("#s-over .ov-stats");
    if (!st) return;
    let c = $("ov-rank");
    if (!c) {
      c = document.createElement("div");
      c.className = "ov-st";
      c.id = "ov-rank";
      c.innerHTML = `<b></b><span class="lbl"></span>`;
      st.appendChild(c);
    }
    const d = u.rank.rr - R.base.rr;
    c.hidden = !1;
    c.querySelector("b").innerHTML = `${badge(u.rank.t, u.rank.div, 26)} <span style="color:${d > 0 ? "#4ade80" : d < 0 ? "#ff6b7a" : "#8a97ab"}">${d > 0 ? "+" : d < 0 ? "−" : "±"}${Math.abs(d)}</span>`;
    c.querySelector(".lbl").textContent = nameOf(u.rank) + " · RR";
    c.querySelector(".lbl").style.color = COL[u.rank.t];
    c.title = u.rank.t >= 8 ? `${u.rank.rr} RR` : L(`다음 단계까지 ${100 - u.rank.into} RR`, `${100 - u.rank.into} RR to the next division`);
    const now = step(u.rank);
    if (R.last >= 0 && now !== R.last) {
      const up = now > R.last;
      R.last = now;
      // after the XP banner the report brings
      setTimeout(() => {
          try {
            "function" == typeof banner && banner(up ? L(`승급! ${nameOf(u.rank)}`, `Promoted! ${nameOf(u.rank)}`) : L(`강등 · ${nameOf(u.rank)}`, `Demoted · ${nameOf(u.rank)}`), up ? COL[u.rank.t] : "#ff6b7a");
          } catch (e) {}
        }, 2300);
    }
  }

  // ── the tier on the title screen, left of the gold ──
  function chip() {
    let b = $("rank-chip");
    const u = user(),
      t = $("s-title"),
      show = !!(u && u.rank) && "menu" === phase() && t && !t.hidden && "none" !== getComputedStyle(t).display;
    if (!show) return void (b && (b.style.display = "none"));
    if (!b) {
      b = document.createElement("a");
      b.id = "rank-chip";
      b.href = "./";
      b.style.cssText = "position:fixed;top:10px;right:12px;z-index:40;display:flex;align-items:center;gap:5px;padding:3px 11px 3px 5px;border-radius:99px;background:rgba(20,25,34,.86);border:1px solid #2a3444;font-size:12px;font-family:var(--f-display);letter-spacing:.03em;text-decoration:none";
      document.body.appendChild(b);
    }
    const r = u.rank,
      key = r.t + "|" + r.div + "|" + r.rr;
    if (b.dataset.k !== key) {
      b.dataset.k = key;
      b.innerHTML = `${badge(r.t, r.div, 22)}<span>${nameOf(r)}</span>`;
      b.style.color = COL[r.t];
      b.style.borderColor = COL[r.t] + "66";
      b.title = (r.t >= 8 ? `${r.rr} RR` : L(`${r.into}/100 RR · 랭크전에서만 오르고 내려갑니다`, `${r.into}/100 RR · only ranked matches move it`));
    }
    // left of the gold chip (itself left of the account chip)
    let right = 12;
    for (const id of ["acct-chip", "gold-chip"]) {
      const o = $(id);
      o && o.offsetWidth && "none" !== o.style.display && (right = Math.max(right, (parseFloat(o.style.right) || 12) + o.offsetWidth + 8));
    }
    b.style.right = right + "px";
    b.style.display = "flex";
  }
  setInterval(() => {
    try {
      overCell();
      chip();
    } catch (e) {}
  }, 500);
  // what's new on the title screen
  try {
    const ul = document.querySelector(".tt-news ul");
    if (ul) {
      const li = document.createElement("li");
      li.innerHTML = EN ? `<b>Tiers · 10 new skins</b><span>Iron to Radiant: wins raise your RR, losses take a little. Phoenix, Thunderstorm, Aurora, Dragon scale and more in the crates</span>` : `<b>티어 · 새 스킨 10종</b><span>아이언부터 레디언트까지: 이기면 RR이 오르고 지면 조금 내려갑니다. 봉황 · 뇌전 · 오로라 · 용비늘 등 상자에 추가</span>`;
      ul.prepend(li);
      while (ul.children.length > 3) ul.lastElementChild.remove();
    }
  } catch (e) {}
  window.RANK = { badge, names: NAMES, colors: COL, state: R };
})();
