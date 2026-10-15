
(() => {
  // Thirty-six agents in the picker: role tabs with counts (all · duelist ·
  // sentinel · initiator · controller), a random pick, and on a computer
  // smaller cards, six to a row, so the roster is a short scroll.
  const $ = (id) => document.getElementById(id);
  const EN = "en" === window.GAME_LANG,
    L = (ko, en) => (EN ? en : ko);
  const top = document.querySelector("#s-select .sel-top");
  if (!top || "function" != typeof renderSelect) return;
  const ROLES = [
    ["", L("전체", "All")],
    ["타격대", L("타격대", "Duelist")],
    ["감시자", L("감시자", "Sentinel")],
    ["척후대", L("척후대", "Initiator")],
    ["전략가", L("전략가", "Controller")],
  ];
  let role = "";
  try {
    role = sessionStorage.getItem("lgp_selrole") || "";
  } catch (e) {}
  const bar = document.createElement("div");
  bar.className = "sel-roles";
  bar.id = "sel-roles";
  top.appendChild(bar);
  function paintBar() {
    bar.innerHTML =
      ROLES.map(([k, n]) => `<button data-role="${k}" class="${k === role ? "on" : ""}">${n}<em>${k ? AGENTS.filter((a) => a.role === k).length : AGENTS.length}</em></button>`).join("") +
      `<button class="sel-rand" data-rand="1" title="${L("무작위 요원", "Random agent")}">🎲 ${L("무작위", "Random")}</button>`;
  }
  // the cards are drawn in roster order
  function apply() {
    const g = $("sel-grid");
    g &&
      [...g.children].forEach((c, i) => {
        const a = AGENTS[i];
        c.hidden = !!(role && a && a.role !== role);
      });
  }
  bar.onclick = (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.rand) {
      const pool = AGENTS.filter((a) => a !== picked && (!role || a.role === role));
      pool.length && (picked = pool[Math.floor(Math.random() * pool.length)]);
      renderSelect();
      const on = document.querySelector('#sel-grid .acard[aria-pressed="true"]');
      on && on.scrollIntoView({ block: "nearest" });
      return;
    }
    role = b.dataset.role;
    try {
      sessionStorage.setItem("lgp_selrole", role);
    } catch (x) {}
    paintBar();
    apply();
  };
  const _rs = renderSelect;
  renderSelect = function () {
    const r = _rs.apply(this, arguments);
    try {
      // agents added by later scripts (초침, 관문, 황야, 나침) come after this
      // bar was first drawn: count again on every redraw
      paintBar();
      apply();
    } catch (e) {}
    return r;
  };
  paintBar();
  apply();
  const st = document.createElement("style");
  st.textContent = `
#s-select .sel-top{align-items:center}
.sel-roles{margin-left:auto;display:flex;gap:6px;flex-wrap:wrap}
.sel-roles button{display:flex;align-items:center;gap:6px;padding:7px 13px;border-radius:999px;border:1px solid var(--line);background:var(--panel);color:#c9d2de;font-size:12px;font-weight:700;transition:border-color .2s,color .2s,background .2s}
.sel-roles button:hover{border-color:var(--steel-dim)}
.sel-roles button em{font-style:normal;font-family:var(--f-display);font-size:10px;color:var(--steel-dim)}
.sel-roles button.on{border-color:var(--gold);color:var(--gold);background:rgba(255,200,73,.08)}
.sel-roles button.on em{color:var(--gold)}
.sel-roles .sel-rand{border-style:dashed}
#sel-grid .acard[hidden]{display:none!important}
@media (min-width:901px) and (min-height:521px){
  .sel-grid{grid-template-columns:repeat(auto-fill,minmax(126px,1fr));gap:12px;padding:18px 22px}
  .acard{min-height:0;border-radius:16px}
  .acard-body{margin-top:-40px;padding:0 11px 11px}
  .acard-name{font-size:21px}
  .acard-q{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:3px}
}
@media (max-height:520px) and (orientation:landscape){
  #s-select .sel-top .lbl{display:none}
  .sel-roles{gap:4px}
  .sel-roles button{padding:4px 9px;font-size:11px;gap:4px}
}
@media (max-width:520px){#s-select .sel-top .lbl{display:none}.sel-roles{margin-left:0}}`;
  document.head.appendChild(st);
  window.SEL36 = { role: () => role, paintBar, apply };
})();
