(() => {
  // Mastery of each agent (1-10, counted by the server: A.progress). Here it is only shown:
  //  · a hexagon with the level on every agent card of the multiplayer lobby picker and of the solo select screen, with the
  //    progress to the next level in the card's tooltip (the cards are in AGENTS order, whatever the tabs hide);
  //  · a cell under the result's numbers: the mastery XP of the agent just played, and the level and gold of a level gained.
  // It follows the account that is signed in (a guest has a record of its own too) and nothing at all when the owner has
  // switched mastery off or nobody is signed in.
  if ("undefined" == typeof AGENTS || !window.MASTERY || !window.ACCOUNT || "function" != typeof ACCOUNT.session) return;
  const EN = "en" === window.GAME_LANG,
    L = (ko, en) => (EN ? en : ko);
  const $ = (id) => document.getElementById(id);
  const MT = window.MASTERY;
  const user = () => {
    try {
      const s = ACCOUNT.session();
      return (s && s.user) || null;
    } catch (e) {
      return null;
    }
  };
  const off = () => !!(window.SERVER_CFG && SERVER_CFG.mastery && !1 === SERVER_CFG.mastery.on);
  // my mastery of an agent: the server's view {lv, xp, into, need, m, w, k}, level 1 until I have played it; null when it is not shown
  const mine = (ag) => {
    const u = user();
    if (!u || !ag || off() || !u.mast || "object" != typeof u.mast) return null;
    const r = u.mast[ag.id];
    return r && "object" == typeof r ? r : { lv: 1, xp: 0, into: 0, need: 0, m: 0, w: 0, k: 0 };
  };
  const tip = (r) => MT.label(r.lv) + (r.lv >= MT.MAX ? "" : ` · ${r.into} / ${r.need} XP`) + (r.m ? L(` · ${r.m}경기 ${r.w}승`, ` · ${r.m} matches ${r.w} wins`) : "");
  const css = document.createElement("style");
  css.textContent =
    ".mb-pos{position:absolute;top:5px;left:5px;z-index:2;pointer-events:none;line-height:0}" +
    "#lobby .lad-card.on::before{z-index:3}" +
    "#sel-grid .acard{position:relative}" +
    "#ov-mast b{display:flex;align-items:center;justify-content:center;gap:7px;font-size:15px;white-space:nowrap}" +
    "#ov-mast .mup{margin-top:3px;color:#ffc849;font-weight:700;font-size:12px;letter-spacing:0}" +
    "@media (max-height:520px) and (orientation:landscape){.mb-pos{top:3px;left:3px}.mb-pos .mastb{font-size:10px!important}}";
  document.head.appendChild(css);
  // one badge on a card: replaced when the card is drawn again
  function stamp(card, ag) {
    if (!card) return;
    card.querySelectorAll(":scope > .mb-pos").forEach((x) => x.remove());
    const r = mine(ag);
    if (!r) return;
    const s = document.createElement("span");
    s.className = "mb-pos";
    s.title = tip(r);
    s.innerHTML = MT.badge(r.lv, 12);
    card.appendChild(s);
    card.dataset.mastery = r.lv;
  }
  const paintCards = (grid) => grid && [...grid.children].forEach((c, i) => stamp(c, AGENTS[i]));
  if ("function" == typeof paintAgents) {
    const _pa = paintAgents;
    paintAgents = function () {
      const r = _pa.apply(this, arguments);
      try {
        paintCards($("lb-agents"));
      } catch (e) {}
      return r;
    };
  }
  if ("function" == typeof renderSelect) {
    const _rs = renderSelect;
    renderSelect = function () {
      const r = _rs.apply(this, arguments);
      try {
        paintCards($("sel-grid"));
      } catch (e) {}
      return r;
    };
  }
  // the account's numbers changed (a match report): the cards on screen follow
  const again = () => {
    try {
      $("sel-grid") && $("sel-grid").children.length && paintCards($("sel-grid"));
      $("lb-agents") && $("lb-agents").children.length && paintCards($("lb-agents"));
    } catch (e) {}
  };
  addEventListener("account-reward", again);

  // ── the result ──
  addEventListener("account-reward", (e) => {
    try {
      const j = e.detail,
        m = j && j.mastery;
      if (!m || off()) return;
      const st = document.querySelector("#s-over .ov-stats");
      if (!st) return;
      let c = $("ov-mast");
      if (!c) {
        c = document.createElement("div");
        c.className = "ov-st";
        c.id = "ov-mast";
        c.innerHTML = `<b></b><span class="lbl"></span>`;
        st.appendChild(c);
      }
      const ag = AGENTS.find((a) => a.id === m.id),
        r = j.user && j.user.mast && j.user.mast[m.id];
      c.hidden = false;
      c.querySelector("b").innerHTML = `${MT.badge(m.lv, 14)}<span>+${m.gain} XP</span>`;
      c.querySelector(".lbl").innerHTML = "";
      c.querySelector(".lbl").append((ag ? ag.name + " " : "") + L("숙련도", "mastery") + (r && r.need ? ` · ${r.into} / ${r.need}` : ""));
      if (m.up > 0) {
        const up = document.createElement("div");
        up.className = "mup";
        up.textContent = `Lv ${m.before} → ${m.lv}${m.gold ? ` · 🪙 +${m.gold}` : ""}`;
        c.querySelector(".lbl").append(up);
      }
      c.title = r ? tip(r) : "";
    } catch (err) {}
  });
  // a new match: last match's cell goes
  setInterval(() => {
    try {
      "over" !== world.phase && $("ov-mast") && !$("ov-mast").hidden && ($("ov-mast").hidden = true);
    } catch (e) {}
  }, 2000);
  window.MASTERY_UI = { mine, stamp, paintCards, off };
})();
