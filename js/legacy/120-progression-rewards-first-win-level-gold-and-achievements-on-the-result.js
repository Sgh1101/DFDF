(() => {
  // What a match paid beyond its own XP and gold (counted by the server in A.progress, only for a match with a valid ticket):
  // the first win of the day, the gold and the cosmetic of a level gained, and achievements reached. Here they are only shown,
  // as tiles under the result's numbers (next to the mastery and rank tiles), and as a banner for a level reward.
  if (!window.ACCOUNT || "function" != typeof ACCOUNT.session || !window.PROGRESSION) return;
  const EN = "en" === window.GAME_LANG,
    L = (ko, en) => (EN ? en : ko);
  const $ = (id) => document.getElementById(id);
  const PR = window.PROGRESSION;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const cosName = (id) => {
    const x = window.COSMETICS && COSMETICS.by[id];
    return x ? `${COSMETICS.slotName(x.s).replace(/s$/, "")} ${COSMETICS.name(x)}` : id;
  };
  const css = document.createElement("style");
  css.textContent =
    "#s-over .ov-st.prg b{display:block;font-size:15px;white-space:nowrap}" +
    "#s-over .ov-st.prg .sub{display:block;margin-top:3px;color:#ffc849;font-weight:700;font-size:12px;letter-spacing:0;white-space:normal}" +
    "#s-over .ov-st.prg .lbl{display:block}";
  document.head.appendChild(css);
  // one tile, made when it is needed and reused (the same id) by the next result
  function tile(id, head, main, subs, title) {
    const st = document.querySelector("#s-over .ov-stats");
    if (!st) return;
    let c = $(id);
    if (!c) {
      c = document.createElement("div");
      c.className = "ov-st prg";
      c.id = id;
      c.innerHTML = `<b></b><span class="lbl"></span>`;
      st.appendChild(c);
    }
    c.hidden = false;
    c.querySelector("b").textContent = main;
    c.querySelector(".lbl").innerHTML = esc(head) + subs.map((s) => `<span class="sub">${esc(s)}</span>`).join("");
    c.title = title || "";
  }
  const hide = (id) => $(id) && ($(id).hidden = true);
  const gold = (n) => `🪙 +${n}`;
  addEventListener("account-reward", (e) => {
    try {
      const j = e.detail;
      if (!j) return;
      // the first win of the day
      const fw = j.firstWin;
      if (fw) tile("ov-fw", L("오늘의 첫 승리 보너스", "First win of the day"), fw.gold ? gold(fw.gold) : fw.xp ? `+${fw.xp} XP` : L("상한에 도달", "daily limit reached"), fw.gold && fw.xp ? [`+${fw.xp} XP`] : [], L("하루에 한 번, 한국 시간 자정에 새로 시작합니다", "Once a day; it resets at midnight in Korea"));
      else hide("ov-fw");
      // the level gained
      const lv = j.lvReward;
      if (lv) {
        const subs = (lv.cos || []).map((id) => L("획득: ", "Unlocked: ") + cosName(id));
        tile("ov-lvr", `${L("레벨 보상", "Level reward")} · Lv ${lv.from} → ${lv.to}`, lv.gold ? gold(lv.gold) : L("골드 상한 도달", "daily gold limit reached"), subs, "");
      } else hide("ov-lvr");
      // achievements
      const ach = j.ach || [];
      if (ach.length) tile("ov-ach", L("업적 달성", "Achievement"), ach.map((x) => PR.ach(x.id).name).join(" · "), ach.map((x) => gold(x.gold)), ach.map((x) => PR.ach(x.id).desc).join("\n"));
      else hide("ov-ach");
      if (lv && lv.cos && lv.cos.length && "function" == typeof banner) setTimeout(() => banner(L(`레벨 보상 · ${lv.cos.map(cosName).join(", ")}`, `Level reward · ${lv.cos.map(cosName).join(", ")}`), "#ffc849"), 3000);
      if (ach.length && "function" == typeof banner) setTimeout(() => banner(L(`업적 달성 · ${PR.ach(ach[0].id).name}`, `Achievement · ${PR.ach(ach[0].id).name}`), "#4ade80"), 4800);
    } catch (err) {}
  });
  // a new match: last match's tiles go
  setInterval(() => {
    try {
      "over" !== world.phase && ["ov-fw", "ov-lvr", "ov-ach"].forEach(hide);
    } catch (e) {}
  }, 2000);
  window.PROGRESSION_UI = { tile };
})();
