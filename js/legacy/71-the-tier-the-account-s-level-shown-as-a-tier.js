(() => {
  // The tier: the account's level, shown as a tier. Ranked play (rank rating, placement, seasons) was removed on
  // 2026-11-07 at the owner's request; the tiers stay as the way the account's progress is shown instead of a level
  // number. Three levels make a division, three divisions a tier, 구리 to 금강, then 왕좌 (from level 73). Here: the
  // mapping (TIER.of / TIER.text, used wherever a level used to be shown) and the tier chip on the title screen
  // (the "tier up" banner is the account report's, js/legacy/44-account-sync.js).
  if (!window.ACCOUNT || "function" != typeof ACCOUNT.session) return;
  const EN = "en" === window.GAME_LANG,
    L = (ko, en) => (EN ? en : ko);
  const $ = (id) => document.getElementById(id);
  // the names, colours and the level-to-tier mapping are shared with the home page (js/tier-level.js)
  const TL = window.TIER_LEVEL;
  if (!TL) return;
  const NAMES = TL.names[EN ? "en" : "ko"];
  const COL = TL.colors;
  const nameOf = (r) => NAMES[r.t] + (r.div ? " " + r.div : "");
  // a gem in the tier's colour, more points the higher, a pip a division (as on the homepage)
  function badge(t, div, px) {
    if (t < 0) return hiddenBadge(px);
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
  // the gem of an account still placing: grey, a question mark
  function hiddenBadge(px) {
    return `<svg viewBox="0 0 48 48" width="${px}" height="${px}" style="vertical-align:middle" aria-hidden="true"><path d="M24 2l19 10.5v23L24 46 5 35.5v-23z" fill="#1b222e" stroke="#8a8f98" stroke-width="1.5" stroke-dasharray="3 2"/><text x="24" y="31" text-anchor="middle" font-size="22" font-weight="800" fill="#c9d3de" font-family="sans-serif">?</text></svg>`;
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
  const of = TL.of, text = (level) => TL.text(level, EN ? "en" : "ko"), nextAt = TL.nextAt;

  // ── the tier on the title screen, left of the gold ──
  function chip() {
    let b = $("rank-chip");
    const u = user(),
      t = $("s-title"),
      show = !!(u && !u.guest) && "menu" === phase() && t && !t.hidden && "none" !== getComputedStyle(t).display;
    if (!show) return void (b && (b.style.display = "none"));
    if (!b) {
      b = document.createElement("a");
      b.id = "rank-chip";
      b.href = "./#records-stats";
      b.style.cssText = "position:fixed;top:10px;right:12px;z-index:40;display:flex;align-items:center;gap:5px;padding:3px 11px 3px 5px;border-radius:99px;background:rgba(20,25,34,.86);border:1px solid #2a3444;font-size:12px;font-weight:800;text-decoration:none";
      document.body.appendChild(b);
    }
    const r = of(u.level),
      next = nextAt(u.level),
      key = r.step + "|" + (u.level | 0);
    if (b.dataset.k !== key) {
      b.dataset.k = key;
      b.innerHTML = `${badge(r.t, r.div, 22)}<span>${nameOf(r)}</span>`;
      b.style.color = COL[r.t];
      b.style.borderColor = COL[r.t] + "66";
      b.title = next ? L(`경험치를 모아 오릅니다 · 다음 단계까지 ${next - (u.level | 0)}레벨분`, `Grows with XP · ${next - (u.level | 0)} more to the next division`) : L("가장 높은 티어", "The highest tier");
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
      chip();
    } catch (e) {}
  }, 500);
  window.TIER = { of, text, nextAt, badge, names: NAMES, colors: COL };
  // the old name, for the leaderboard and the pre-match screen
  window.RANK = { badge, names: NAMES, colors: COL, of, text };
})();
