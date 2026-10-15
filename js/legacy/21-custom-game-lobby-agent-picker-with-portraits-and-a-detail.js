
(() => {
  // Custom game lobby: agent picker with portraits, and a detail panel on the
  // right (portrait, role, description, every ability) like the solo screen.
  // Hovering a card previews it; the panel otherwise shows your pick.
  const box = document.querySelector("#lobby .lb-agents"),
    row = document.getElementById("lb-agents");
  if (!box || !row) return;
  const wrap = document.createElement("div");
  wrap.className = "lad-wrap";
  const left = document.createElement("div");
  left.className = "lad-left";
  const det = document.createElement("aside");
  det.className = "lad-det";
  det.id = "lb-agdet";
  row.parentNode.insertBefore(wrap, row);
  left.appendChild(row);
  wrap.append(left, det);
  row.classList.add("lad-grid");

  const PIC = {},
    BIG = {};
  const pic = (ag) => PIC[ag.key] || (PIC[ag.key] = agentPortrait(ag, 150, 184));
  const big = (ag) => BIG[ag.key] || (BIG[ag.key] = agentPortrait(ag, 420, 520));
  let hover = null,
    mine = null;
  const byKey = (k) => AGENTS.find((a) => a.key === k);

  function paintDet() {
    const ag = hover || mine || AGENTS[0];
    if (!ag) return;
    const picked = mine === ag;
    det.style.setProperty("--ac", ag.color);
    det.innerHTML = `
      <div class="lad-hero">
        <img alt="" src="${big(ag)}">
        <div class="lad-hero-txt">
          <div class="lad-tag">${picked ? "선택한 요원" : hover ? "미리보기" : "요원을 골라 주세요"}</div>
          <div class="lad-name">${ag.name}</div>
          <div class="lad-role">${ag.role} · ${String(ag.id || ag.key).toUpperCase()}</div>
        </div>
      </div>
      <p class="lad-desc">${ag.desc || ""}</p>
      <div class="lad-abs">${ag.abilities
        .map(
          (a) => `
        <div class="lad-ab">
          <div class="lad-key">${abIcon(a.type)}<b>${a.key}</b></div>
          <div>
            <div class="lad-abn">${a.name}<span>${a.ult ? `궁극기 · 충전 ${a.ult}` : a.cost ? `최대 ${a.charges}회` : `재사용 ${a.cd}초`}</span></div>
            <div class="lad-abd">${a.desc}</div>
          </div>
        </div>`
        )
        .join("")}</div>`;
  }

  paintAgents = function (e, t) {
    const me = myLobbyEntry(e, t);
    const taken = new Map();
    me && e[me.team].forEach((s) => s && !s.ai && s.peer !== t && s.agent && taken.set(s.agent, s.name || "아군"));
    mine = me && me.agent ? byKey(me.agent) : null;
    row.innerHTML = "";
    AGENTS.forEach((ag) => {
      const b = document.createElement("button");
      const on = !!(me && me.agent === ag.key);
      b.className = "lb-agent lad-card" + (on ? " on" : "");
      b.style.setProperty("--ac", ag.color);
      b.disabled = taken.has(ag.key);
      b.innerHTML = `<img alt="" src="${pic(ag)}"><span class="lad-cn">${ag.name}</span><span class="lad-cr">${taken.has(ag.key) ? taken.get(ag.key) : ag.role}</span>`;
      b.onclick = () => requestAgent(ag.key);
      b.onmouseenter = () => ((hover = ag), paintDet());
      b.onmouseleave = () => (hover === ag && (hover = null), paintDet());
      b.onfocus = b.onmouseenter;
      row.appendChild(b);
    });
    // phones have no hover; a tap picks and the panel follows the pick
    hover && !row.matches(":hover") && (hover = null);
    paintDet();
  };

  const st = document.createElement("style");
  st.textContent = `
#lobby .lad-wrap{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:18px;align-items:start}
#lobby .lad-grid{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:8px}
#lobby .lad-card{position:relative;display:flex;flex-direction:column;align-items:stretch;padding:0!important;overflow:hidden;border-radius:12px;text-align:left;background:var(--panel)}
#lobby .lad-card img{width:100%;aspect-ratio:150/150;object-fit:cover;object-position:50% 20%;display:block;filter:saturate(.9);transition:filter .15s}
#lobby .lad-card:hover:not(:disabled) img,#lobby .lad-card.on img{filter:saturate(1.15) brightness(1.08)}
#lobby .lad-cn{display:block;padding:6px 8px 0;font-size:12.5px;font-weight:700;color:var(--ac)}
#lobby .lad-cr{display:block;padding:1px 8px 7px;font-size:9.5px;color:var(--steel-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#lobby .lad-card::after{content:"";position:absolute;left:0;right:0;bottom:0;height:2px;background:var(--ac);opacity:.35}
#lobby .lad-card.on{border-color:var(--ac)!important;box-shadow:0 0 0 1px var(--ac) inset,0 0 22px -6px var(--ac)}
#lobby .lad-card.on::after{opacity:1;height:3px}
#lobby .lad-card.on::before{content:"✓";position:absolute;top:6px;right:6px;width:18px;height:18px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:900;background:var(--ac);color:#0b0e13;z-index:1}
#lobby .lad-card:disabled .lad-cr{color:var(--steel)}
#lobby .lad-det{position:sticky;top:12px;border:1px solid var(--line);border-radius:16px;background:linear-gradient(180deg,color-mix(in srgb,var(--ac) 10%,var(--panel)),var(--panel));padding:12px;box-shadow:0 18px 44px -24px rgba(0,0,0,.9);max-height:calc(100vh - 40px);overflow:auto}
#lobby .lad-hero{position:relative;border-radius:12px;overflow:hidden}
#lobby .lad-hero img{width:100%;aspect-ratio:4/3.2;object-fit:cover;object-position:50% 18%;display:block}
#lobby .lad-hero::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 45%,rgba(6,8,12,.92))}
#lobby .lad-hero-txt{position:absolute;left:14px;right:14px;bottom:12px;z-index:1}
#lobby .lad-tag{display:inline-block;font-size:9.5px;letter-spacing:.12em;padding:2px 7px;border-radius:6px;background:color-mix(in srgb,var(--ac) 30%,rgba(0,0,0,.5));color:#fff;margin-bottom:6px}
#lobby .lad-name{font-family:var(--f-display);font-weight:900;font-size:30px;line-height:1;color:var(--ac);text-shadow:0 2px 22px rgba(0,0,0,.95),0 0 26px color-mix(in srgb,var(--ac) 50%,transparent)}
#lobby .lad-role{font-size:11px;color:var(--steel);margin-top:5px;letter-spacing:.06em}
#lobby .lad-desc{font-size:12px;color:var(--steel);line-height:1.7;margin:12px 2px 4px;padding-bottom:10px;border-bottom:1px solid var(--line)}
#lobby .lad-ab{display:grid;grid-template-columns:34px 1fr;gap:10px;padding:9px 2px;border-bottom:1px solid var(--line)}
#lobby .lad-ab:last-child{border-bottom:none}
#lobby .lad-key{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;width:32px;height:36px;border-radius:9px;background:var(--ac);color:var(--void,#0b0e13);box-shadow:0 0 14px -3px var(--ac)}
#lobby .lad-key svg{width:16px;height:16px;fill:none;stroke:var(--void,#0b0e13);stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
#lobby .lad-key b{font-size:9px;line-height:1;font-family:var(--f-display)}
#lobby .lad-abn{font-size:12.5px;font-weight:700;color:var(--ink,#fff)}
#lobby .lad-abn span{margin-left:7px;font-size:9.5px;font-weight:500;color:var(--gold)}
#lobby .lad-abd{font-size:11px;color:var(--steel);line-height:1.55;margin-top:3px}
@media (max-width:900px){#lobby .lad-wrap{grid-template-columns:minmax(0,1fr) 260px;gap:12px}#lobby .lad-name{font-size:22px}#lobby .lad-hero img{aspect-ratio:4/2.6}#lobby .lad-grid{grid-template-columns:repeat(auto-fill,minmax(74px,1fr));gap:6px}#lobby .lad-desc{font-size:11px}#lobby .lad-abd{font-size:10.5px}}
@media (max-width:600px){#lobby .lad-wrap{grid-template-columns:1fr}#lobby .lad-det{position:static;max-height:none}#lobby .lad-grid{grid-template-columns:repeat(5,1fr)}}`;
  document.head.appendChild(st);
})();
